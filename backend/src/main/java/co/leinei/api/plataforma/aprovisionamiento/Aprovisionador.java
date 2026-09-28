package co.leinei.api.plataforma.aprovisionamiento;

import java.sql.*;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

/**
 * Pipeline de aprovisionamiento de una empresa nueva. Corre con credenciales OWNER de la plataforma,
 * separado de la aplicación de cara al público (que solo inserta la empresa y su solicitud).
 *
 * Pasos:
 *  1-2. Clona la plantilla: CREATE DATABASE db_cliente_x TEMPLATE db_leinei_plantilla (estructura completa).
 *  3.   Datos semilla: configuración inicial de la tienda y administrador inicial.
 *  4.   Crea los 3 roles estándar (owner, app, lectura) con claves aleatorias y sus permisos.
 *  5.   Registra la conexión en tbl_empresa_conexiones (claves cifradas).
 *  6.   Registra la migración aplicada en tbl_empresa_esquema_version.
 *  7.   Activa los módulos contratados en tbl_empresa_modulos.
 *  8.   Marca la empresa como activa.
 *
 * Todos los pasos se pueden repetir sin daño, así un reintento continúa donde falló.
 */
public class Aprovisionador {

    /** Datos que el superadmin dejó al crear la empresa. La clave del administrador ya viene en BCrypt. */
    public record DatosIniciales(String adminUsuario, String adminNombre, String adminClaveHash,
                                 String modoPedido, String whatsapp, String ciudad, String direccion,
                                 boolean tieneDomicilio, boolean tieneRecogida, int domicilioValor,
                                 List<String> modulos) {}

    public record Resultado(String nombreBase, String ultimaMigracion) {}

    /** Llave del candado que comparten la sincronización de la plantilla y el clonado. */
    public static final long CANDADO_PLANTILLA = 7_130_001L;

    private final ServidorPostgres servidor;
    private final CifradoClaves cifrado;

    public Aprovisionador(ServidorPostgres servidor, CifradoClaves cifrado) {
        this.servidor = servidor;
        this.cifrado = cifrado;
    }

    public Resultado aprovisionar(long empresaId, String identificador, DatosIniciales datos, Consumer<String> registro)
            throws Exception {
        NombresEmpresa n = new NombresEmpresa(identificador);
        String base = n.nombreBase();

        try (Connection control = servidor.conectarComoOwner(servidor.baseControl())) {
            control.setAutoCommit(true);

            // 1-2. Clonar la plantilla. El candado evita clonar mientras se está migrando la plantilla.
            registro.accept("Clonando la plantilla en " + base);
            conCandado(control, () -> {
                if (!existeBase(control, base)) {
                    clonarPlantilla(control, base);
                    registro.accept("Base " + base + " creada desde " + servidor.basePlantilla());
                } else {
                    registro.accept("La base " + base + " ya existía; se continúa");
                }
            });

            // 4. Roles (se crean antes de la semilla para poder dar permisos en la misma conexión).
            registro.accept("Creando roles owner, app y lectura");
            String claveOwner = CifradoClaves.claveAleatoria();
            String claveApp = CifradoClaves.claveAleatoria();
            String claveLectura = CifradoClaves.claveAleatoria();
            crearORenovarRol(control, n.rolOwner(), claveOwner);
            crearORenovarRol(control, n.rolApp(), claveApp);
            crearORenovarRol(control, n.rolLectura(), claveLectura);

            String ultimaMigracion;
            try (Connection empresa = servidor.conectarComoOwner(base)) {
                empresa.setAutoCommit(true);
                darPermisos(empresa, base, n);
                registro.accept("Permisos aplicados (app: solo datos; lectura: solo consulta; owner: todo menos la auditoría)");

                // 3. Datos semilla.
                sembrar(empresa, datos);
                registro.accept("Datos semilla cargados; administrador inicial: " + datos.adminUsuario());
                ultimaMigracion = MigradorLiquibase.ultimaMigracion(empresa);
            }

            control.setAutoCommit(false);
            try {
                // 5. Conexión.
                guardarConexion(control, empresaId, base, n, claveOwner, claveApp, claveLectura);
                // 6. Versión de esquema.
                try (PreparedStatement ps = control.prepareStatement(
                        "INSERT INTO plataforma.tbl_empresa_esquema_version (empresa_id, ultima_migracion_aplicada) VALUES (?, ?)")) {
                    ps.setLong(1, empresaId);
                    ps.setString(2, ultimaMigracion);
                    ps.executeUpdate();
                }
                // 7. Módulos.
                activarModulos(control, empresaId, datos.modulos());
                // 8. Activa.
                try (PreparedStatement ps = control.prepareStatement(
                        "UPDATE plataforma.tbl_empresas SET estado = 'activa', actualizado_en = now() WHERE id = ?")) {
                    ps.setLong(1, empresaId);
                    ps.executeUpdate();
                }
                control.commit();
            } catch (Exception e) {
                control.rollback();
                throw e;
            }
            registro.accept("Conexión, versión de esquema (" + ultimaMigracion + ") y módulos registrados. Empresa activa.");
            return new Resultado(base, ultimaMigracion);
        }
    }

    // ------------------------------------------------------------------ pasos

    interface Paso { void correr() throws Exception; }

    /** Ejecuta con el candado de la plantilla (sesión), para no chocar con su sincronización. */
    static void conCandado(Connection control, Paso paso) throws Exception {
        try (Statement st = control.createStatement()) {
            st.execute("SELECT pg_advisory_lock(" + CANDADO_PLANTILLA + ")");
        }
        try {
            paso.correr();
        } finally {
            try (Statement st = control.createStatement()) {
                st.execute("SELECT pg_advisory_unlock(" + CANDADO_PLANTILLA + ")");
            }
        }
    }

    private void clonarPlantilla(Connection control, String base) throws Exception {
        String sql = "CREATE DATABASE " + id(base) + " TEMPLATE " + id(servidor.basePlantilla());
        SQLException ultimo = null;
        // Postgres rechaza el clonado si alguien está conectado a la plantilla; se reintenta unos segundos.
        for (int intento = 1; intento <= 10; intento++) {
            try (Statement st = control.createStatement()) {
                st.execute(sql);
                return;
            } catch (SQLException e) {
                if (e.getMessage() == null || !e.getMessage().contains("being accessed by other users")) throw e;
                ultimo = e;
                Thread.sleep(1000L * intento);
            }
        }
        throw ultimo;
    }

    static boolean existeBase(Connection c, String base) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM pg_database WHERE datname = ?")) {
            ps.setString(1, base);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    private static void crearORenovarRol(Connection c, String rol, String clave) throws SQLException {
        boolean existe;
        try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM pg_roles WHERE rolname = ?")) {
            ps.setString(1, rol);
            try (ResultSet rs = ps.executeQuery()) { existe = rs.next(); }
        }
        // La clave es alfanumérica (claveAleatoria), así que se puede escribir literal sin riesgo de inyección.
        String sql = (existe ? "ALTER ROLE " : "CREATE ROLE ") + id(rol)
                + " WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '" + clave + "'";
        try (Statement st = c.createStatement()) { st.execute(sql); }
    }

    private void darPermisos(Connection empresa, String base, NombresEmpresa n) throws SQLException {
        String owner = id(n.rolOwner()), app = id(n.rolApp()), lectura = id(n.rolLectura());
        String migrador = id(servidor.usuarioOwner());
        List<String> sql = new ArrayList<>(List.of(
                // Nadie más que estos tres roles (y el owner de la plataforma) entra a esta base.
                "REVOKE ALL ON DATABASE " + id(base) + " FROM PUBLIC",
                "GRANT CONNECT ON DATABASE " + id(base) + " TO " + owner + ", " + app + ", " + lectura,
                "GRANT USAGE ON SCHEMA cliente, producto TO " + owner + ", " + app + ", " + lectura,
                "GRANT CREATE ON SCHEMA cliente, producto TO " + owner,
                // app: solo datos, sin estructura.
                "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cliente, producto TO " + app,
                "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cliente, producto TO " + app,
                // owner de la empresa: todo sobre sus datos.
                "GRANT ALL ON ALL TABLES IN SCHEMA cliente, producto TO " + owner,
                "GRANT ALL ON ALL SEQUENCES IN SCHEMA cliente, producto TO " + owner,
                // lectura: solo consultar.
                "GRANT SELECT ON ALL TABLES IN SCHEMA cliente, producto TO " + lectura,
                // Auditoría: se puede consultar, nunca modificar (además hay triggers que lo impiden).
                "GRANT USAGE ON SCHEMA plataforma TO " + owner + ", " + lectura,
                "GRANT SELECT ON plataforma.tbl_auditoria TO " + owner + ", " + lectura,
                // Las tablas que creen migraciones futuras heredan los mismos permisos.
                "ALTER DEFAULT PRIVILEGES FOR ROLE " + migrador + " IN SCHEMA cliente, producto GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO " + app,
                "ALTER DEFAULT PRIVILEGES FOR ROLE " + migrador + " IN SCHEMA cliente, producto GRANT USAGE, SELECT ON SEQUENCES TO " + app,
                "ALTER DEFAULT PRIVILEGES FOR ROLE " + migrador + " IN SCHEMA cliente, producto GRANT ALL ON TABLES TO " + owner,
                "ALTER DEFAULT PRIVILEGES FOR ROLE " + migrador + " IN SCHEMA cliente, producto GRANT ALL ON SEQUENCES TO " + owner,
                "ALTER DEFAULT PRIVILEGES FOR ROLE " + migrador + " IN SCHEMA cliente, producto GRANT SELECT ON TABLES TO " + lectura,
                // Cada rol ve primero sus esquemas.
                "ALTER ROLE " + app + " IN DATABASE " + id(base) + " SET search_path = producto, cliente",
                "ALTER ROLE " + lectura + " IN DATABASE " + id(base) + " SET search_path = producto, cliente",
                "ALTER ROLE " + owner + " IN DATABASE " + id(base) + " SET search_path = producto, cliente"));
        try (Statement st = empresa.createStatement()) {
            for (String s : sql) st.execute(s);
        }
    }

    private static void sembrar(Connection empresa, DatosIniciales d) throws SQLException {
        empresa.setAutoCommit(false);
        try {
            try (Statement st = empresa.createStatement()) {
                st.execute("SELECT set_config('leinei.usuario', 'aprovisionamiento', true)");
            }
            try (PreparedStatement ps = empresa.prepareStatement("""
                    UPDATE cliente.tbl_configuraciones SET
                        modo_pedido = ?, whatsapp = ?, ciudad = ?, direccion = ?,
                        tiene_domicilio = ?, tiene_recogida = ?, domicilio_valor = ?,
                        dia_entrega = 7, cierre_dias_antes = 1, cierre_hora = 21, actualizado_en = now()
                    WHERE id = 1""")) {
                ps.setString(1, d.modoPedido());
                ps.setString(2, d.whatsapp());
                ps.setString(3, d.ciudad());
                ps.setString(4, d.direccion());
                ps.setBoolean(5, d.tieneDomicilio());
                ps.setBoolean(6, d.tieneRecogida());
                ps.setInt(7, d.domicilioValor());
                ps.executeUpdate();
            }
            try (PreparedStatement ps = empresa.prepareStatement("""
                    INSERT INTO cliente.tbl_administradores (usuario, nombre, clave_hash) VALUES (?, ?, ?)
                    ON CONFLICT (usuario) DO UPDATE SET nombre = EXCLUDED.nombre, clave_hash = EXCLUDED.clave_hash""")) {
                ps.setString(1, d.adminUsuario());
                ps.setString(2, d.adminNombre());
                ps.setString(3, d.adminClaveHash());
                ps.executeUpdate();
            }
            empresa.commit();
        } catch (SQLException e) {
            empresa.rollback();
            throw e;
        } finally {
            empresa.setAutoCommit(true);
        }
    }

    private void guardarConexion(Connection control, long empresaId, String base, NombresEmpresa n,
                                 String claveOwner, String claveApp, String claveLectura) throws SQLException {
        try (PreparedStatement ps = control.prepareStatement("""
                INSERT INTO plataforma.tbl_empresa_conexiones
                    (empresa_id, host, puerto, nombre_base, usuario_owner, clave_owner_cifrada,
                     usuario_app, clave_app_cifrada, usuario_lectura, clave_lectura_cifrada)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (empresa_id) DO UPDATE SET
                    host = EXCLUDED.host, puerto = EXCLUDED.puerto, nombre_base = EXCLUDED.nombre_base,
                    usuario_owner = EXCLUDED.usuario_owner, clave_owner_cifrada = EXCLUDED.clave_owner_cifrada,
                    usuario_app = EXCLUDED.usuario_app, clave_app_cifrada = EXCLUDED.clave_app_cifrada,
                    usuario_lectura = EXCLUDED.usuario_lectura, clave_lectura_cifrada = EXCLUDED.clave_lectura_cifrada,
                    actualizado_en = now()""")) {
            ps.setLong(1, empresaId);
            ps.setString(2, servidor.host());
            ps.setInt(3, servidor.puerto());
            ps.setString(4, base);
            ps.setString(5, n.rolOwner());
            ps.setString(6, cifrado.cifrar(claveOwner));
            ps.setString(7, n.rolApp());
            ps.setString(8, cifrado.cifrar(claveApp));
            ps.setString(9, n.rolLectura());
            ps.setString(10, cifrado.cifrar(claveLectura));
            ps.executeUpdate();
        }
    }

    private static void activarModulos(Connection control, long empresaId, List<String> pedidos) throws SQLException {
        Set<String> codigos = new LinkedHashSet<>(pedidos == null ? List.of() : pedidos);
        try (PreparedStatement ps = control.prepareStatement("""
                INSERT INTO plataforma.tbl_empresa_modulos (empresa_id, modulo_id, es_activo)
                SELECT ?, m.id, TRUE FROM plataforma.tbl_modulos m
                WHERE m.es_base OR m.codigo = ANY (?)
                ON CONFLICT (empresa_id, modulo_id) DO UPDATE SET es_activo = TRUE""")) {
            ps.setLong(1, empresaId);
            ps.setArray(2, control.createArrayOf("varchar", codigos.toArray()));
            ps.executeUpdate();
        }
    }

    /** Identificador SQL entre comillas dobles. */
    static String id(String nombre) {
        return "\"" + nombre.replace("\"", "\"\"") + "\"";
    }
}
