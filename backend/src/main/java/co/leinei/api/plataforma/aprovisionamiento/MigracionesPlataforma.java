package co.leinei.api.plataforma.aprovisionamiento;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Lo que corre al arrancar, con credenciales OWNER:
 *  1. Migra la base de control.
 *  2. Crea la plantilla si no existe y la sincroniza con el changelog de empresa (como "un cliente más").
 *  3. Migra, una por una y en el mismo orden, todas las bases de empresa, y registra su versión.
 *  4. Cierra el acceso a la base de control y a la plantilla para cualquier rol que no sea el de la plataforma.
 */
public class MigracionesPlataforma {

    public record Resumen(String control, String plantilla, int empresasMigradas, List<String> errores) {}

    private final ServidorPostgres servidor;

    public MigracionesPlataforma(ServidorPostgres servidor) {
        this.servidor = servidor;
    }

    public Resumen migrarTodo(String usuarioAppControl, Consumer<String> log) throws Exception {
        String control;
        try (Connection c = servidor.conectarComoOwner(servidor.baseControl())) {
            control = MigradorLiquibase.migrar(c, MigradorLiquibase.CHANGELOG_CONTROL);
            log.accept("Base de control al día: " + control);
            cerrarAccesoPublico(c, servidor.baseControl());
            darPermisosAppControl(c, usuarioAppControl);

            // Plantilla: se crea si falta y se sincroniza con el candado, para no chocar con un clonado.
            String[] plantilla = new String[1];
            Aprovisionador.conCandado(c, () -> {
                if (!Aprovisionador.existeBase(c, servidor.basePlantilla())) {
                    try (Statement st = c.createStatement()) {
                        st.execute("CREATE DATABASE " + Aprovisionador.id(servidor.basePlantilla()));
                    }
                    log.accept("Plantilla " + servidor.basePlantilla() + " creada");
                }
                try (Connection p = servidor.conectarComoOwner(servidor.basePlantilla())) {
                    plantilla[0] = MigradorLiquibase.migrar(p, MigradorLiquibase.CHANGELOG_EMPRESA);
                    cerrarAccesoPublico(p, servidor.basePlantilla());
                }
            });
            log.accept("Plantilla al día: " + plantilla[0]);

            // Empresas existentes: misma estructura para todas.
            List<String> errores = new ArrayList<>();
            int migradas = 0;
            record Base(long empresaId, String identificador, String nombre, String version) {}
            List<Base> bases = new ArrayList<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("""
                    SELECT e.id, e.identificador, k.nombre_base,
                           (SELECT v.ultima_migracion_aplicada FROM plataforma.tbl_empresa_esquema_version v
                             WHERE v.empresa_id = e.id ORDER BY v.id DESC LIMIT 1)
                    FROM plataforma.tbl_empresas e JOIN plataforma.tbl_empresa_conexiones k ON k.empresa_id = e.id
                    ORDER BY e.id""")) {
                while (rs.next()) bases.add(new Base(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)));
            }
            for (Base b : bases) {
                try (Connection e = servidor.conectarComoOwner(b.nombre())) {
                    String v = MigradorLiquibase.migrar(e, MigradorLiquibase.CHANGELOG_EMPRESA);
                    if (!v.equals(b.version())) {
                        try (PreparedStatement ps = c.prepareStatement(
                                "INSERT INTO plataforma.tbl_empresa_esquema_version (empresa_id, ultima_migracion_aplicada) VALUES (?, ?)")) {
                            ps.setLong(1, b.empresaId());
                            ps.setString(2, v);
                            ps.executeUpdate();
                        }
                        log.accept("Empresa " + b.identificador() + " migrada a " + v);
                    }
                    migradas++;
                } catch (Exception ex) {
                    errores.add(b.identificador() + ": " + ex.getMessage());
                    log.accept("ERROR migrando " + b.identificador() + ": " + ex.getMessage());
                }
            }
            return new Resumen(control, plantilla[0], migradas, errores);
        }
    }

    /** Solo el owner de la plataforma (y a quien se le dé explícitamente) puede conectarse a esta base. */
    private static void cerrarAccesoPublico(Connection c, String base) throws SQLException {
        try (Statement st = c.createStatement()) {
            st.execute("REVOKE CONNECT, TEMPORARY ON DATABASE " + Aprovisionador.id(base) + " FROM PUBLIC");
        }
    }

    /**
     * Si la aplicación usa un usuario distinto al owner para la base de control, ese usuario solo trabaja
     * con datos: nunca con estructura.
     */
    private void darPermisosAppControl(Connection c, String usuarioApp) throws SQLException {
        if (usuarioApp == null || usuarioApp.isBlank() || usuarioApp.equals(servidor.usuarioOwner())) return;
        String app = Aprovisionador.id(usuarioApp), owner = Aprovisionador.id(servidor.usuarioOwner());
        try (Statement st = c.createStatement()) {
            st.execute("GRANT CONNECT ON DATABASE " + Aprovisionador.id(servidor.baseControl()) + " TO " + app);
            st.execute("GRANT USAGE ON SCHEMA plataforma TO " + app);
            st.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA plataforma TO " + app);
            st.execute("REVOKE UPDATE, DELETE, TRUNCATE ON plataforma.tbl_auditoria FROM " + app);
            st.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA plataforma TO " + app);
            st.execute("ALTER DEFAULT PRIVILEGES FOR ROLE " + owner + " IN SCHEMA plataforma GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO " + app);
            st.execute("ALTER DEFAULT PRIVILEGES FOR ROLE " + owner + " IN SCHEMA plataforma GRANT USAGE, SELECT ON SEQUENCES TO " + app);
        }
    }
}
