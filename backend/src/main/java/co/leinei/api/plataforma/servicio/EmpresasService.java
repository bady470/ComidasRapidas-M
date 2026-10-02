package co.leinei.api.plataforma.servicio;

import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.EnrutadorDataSource;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.plataforma.aprovisionamiento.NombresEmpresa;
import co.leinei.api.plataforma.web.PlataformaDto;
import co.leinei.api.servicio.AuthService;
import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * Lo que hace el superadmin con las empresas. Crear una empresa solo la registra y deja la solicitud
 * de aprovisionamiento: la base la crea el proceso de aprovisionamiento, nunca esta capa.
 */
@Service
public class EmpresasService {

    private final JdbcClient control;
    private final PasswordEncoder encoder;
    private final RegistroEmpresas registro;
    private final EnrutadorDataSource enrutador;
    private final MarcaService marca;
    private final AuthService authEmpresa;
    private final TransactionTemplate txEmpresa;
    private final TiempoReal tiempoReal;
    private final BibliotecaService biblioteca;
    private final PlanesService planes;

    public EmpresasService(@Qualifier("controlJdbc") JdbcClient control, PasswordEncoder encoder, RegistroEmpresas registro,
                           EnrutadorDataSource enrutador, MarcaService marca, AuthService authEmpresa,
                           PlatformTransactionManager transactionManager, TiempoReal tiempoReal, BibliotecaService biblioteca,
                           PlanesService planes) {
        this.planes = planes;
        this.tiempoReal = tiempoReal;
        this.biblioteca = biblioteca;
        this.control = control;
        this.encoder = encoder;
        this.registro = registro;
        this.enrutador = enrutador;
        this.marca = marca;
        this.authEmpresa = authEmpresa;
        this.txEmpresa = new TransactionTemplate(transactionManager);
    }

    /** Avisa al superadmin conectado y, si cambió la marca o los módulos, a la tienda y al portal de la empresa. */
    private PlataformaDto.EmpresaDetalle avisar(long id, PlataformaDto.EmpresaDetalle d) {
        tiempoReal.publicar("empresa", java.util.Map.of("uuid", d.uuid().toString(), "estado", d.estado()),
                TiempoReal.PLATAFORMA);
        tiempoReal.publicar("catalogo", java.util.Map.of(), TiempoReal.tienda(id), TiempoReal.admin(id));
        return d;
    }

    // ------------------------------------------------------------------ consultas

    @Transactional(value = "controlTx", readOnly = true)
    public List<PlataformaDto.Modulo> modulos() {
        return control.sql("SELECT codigo, nombre, descripcion, es_base FROM plataforma.tbl_modulos ORDER BY orden, id")
                .query((rs, n) -> new PlataformaDto.Modulo(rs.getString(1), rs.getString(2), rs.getString(3), rs.getBoolean(4)))
                .list();
    }

    @Transactional(value = "controlTx", readOnly = true)
    public PlataformaDto.Resumen resumen() {
        return control.sql("""
                        SELECT count(*),
                               count(*) FILTER (WHERE estado = 'activa'),
                               count(*) FILTER (WHERE estado = 'suspendida'),
                               count(*) FILTER (WHERE estado IN ('pendiente_aprovisionamiento', 'aprovisionando')),
                               count(*) FILTER (WHERE estado = 'error_aprovisionamiento')
                        FROM plataforma.tbl_empresas""")
                .query((rs, n) -> new PlataformaDto.Resumen(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)))
                .single();
    }

    @Transactional(value = "controlTx", readOnly = true)
    public List<PlataformaDto.EmpresaResumen> listar() {
        return control.sql("""
                        SELECT e.id, e.uuid, e.identificador, m.nombre_comercial, e.razon_social, e.estado, e.plan,
                               m.color_primario, m.color_secundario, (m.logo_datos IS NOT NULL), m.logo_version,
                               m.dominio_propio, e.creado_en, e.ciclo_facturacion, e.precio_plan
                        FROM plataforma.tbl_empresas e JOIN plataforma.tbl_empresas_marca m ON m.empresa_id = e.id
                        ORDER BY e.creado_en DESC""")
                .query((rs, n) -> new PlataformaDto.EmpresaResumen(rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8),
                        rs.getString(9), logoUrl(rs.getString(3), rs.getBoolean(10), rs.getInt(11)), rs.getString(12),
                        modulosDe(rs.getLong(1)), rs.getTimestamp(13).toInstant(), rs.getString(14), rs.getInt(15)))
                .list();
    }

    @Transactional(value = "controlTx", readOnly = true)
    public PlataformaDto.EmpresaDetalle detalle(UUID uuid) {
        long id = idDe(uuid);
        PlataformaDto.Conexion conexion = control.sql("""
                        SELECT host, puerto, nombre_base, usuario_owner, usuario_app, usuario_lectura
                        FROM plataforma.tbl_empresa_conexiones WHERE empresa_id = ?""")
                .param(id)
                .query((rs, n) -> new PlataformaDto.Conexion(rs.getString(1), rs.getInt(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6)))
                .optional().orElse(null);
        List<PlataformaDto.Version> versiones = control.sql("""
                        SELECT ultima_migracion_aplicada, aplicada_en FROM plataforma.tbl_empresa_esquema_version
                        WHERE empresa_id = ? ORDER BY id DESC LIMIT 10""")
                .param(id)
                .query((rs, n) -> new PlataformaDto.Version(rs.getString(1), rs.getTimestamp(2).toInstant()))
                .list();
        PlataformaDto.Aprovisionamiento aprov = control.sql("""
                        SELECT estado, intentos, paso_actual, registro, actualizado_en FROM plataforma.tbl_aprovisionamientos
                        WHERE empresa_id = ? ORDER BY id DESC LIMIT 1""")
                .param(id)
                .query((rs, n) -> new PlataformaDto.Aprovisionamiento(rs.getString(1), rs.getInt(2), rs.getString(3),
                        rs.getString(4), rs.getTimestamp(5).toInstant()))
                .optional().orElse(null);
        return control.sql("""
                        SELECT e.uuid, e.identificador, e.razon_social, e.nit, e.responsable_nombre, e.responsable_correo,
                               e.responsable_celular, e.plan, e.estado, e.notas, e.creado_en, m.nombre_comercial,
                               m.color_primario, m.color_secundario, (m.logo_datos IS NOT NULL), m.logo_version, m.dominio_propio,
                               e.ciclo_facturacion, e.precio_plan
                        FROM plataforma.tbl_empresas e JOIN plataforma.tbl_empresas_marca m ON m.empresa_id = e.id
                        WHERE e.id = ?""")
                .param(id)
                .query((rs, n) -> new PlataformaDto.EmpresaDetalle(rs.getObject(1, UUID.class), rs.getString(2),
                        rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7),
                        rs.getString(8), rs.getString(9), rs.getString(10), rs.getTimestamp(11).toInstant(),
                        rs.getString(12), rs.getString(13), rs.getString(14),
                        logoUrl(rs.getString(2), rs.getBoolean(15), rs.getInt(16)), rs.getString(17),
                        modulosDe(id), conexion, versiones, aprov, rs.getString(18), rs.getInt(19)))
                .single();
    }

    // ------------------------------------------------------------------ crear y editar

    @Transactional("controlTx")
    public PlataformaDto.EmpresaDetalle crear(PlataformaDto.CrearEmpresaRequest r, String superadmin) {
        String identificador = r.identificador().trim().toLowerCase(Locale.ROOT);
        if (!NombresEmpresa.valido(identificador)) {
            throw ReglaNegocioException.invalido("El identificador lleva de 3 a 30 letras minúsculas, números y guiones "
                    + "(ej. la-parrilla), y no puede ser una palabra reservada.");
        }
        if (existe("SELECT 1 FROM plataforma.tbl_empresas WHERE identificador = ?", identificador)) {
            throw ReglaNegocioException.conflicto("Ya hay una empresa con el identificador «" + identificador + "».");
        }
        String dominio = dominioLimpio(r.dominioPropio());
        validarDominio(dominio, null);
        Set<String> modulos = validarModulos(r.modulos());
        PlataformaDto.Plan plan = planes.activo(r.plan());
        if (!r.tieneDomicilio() && !r.tieneRecogida()) {
            throw ReglaNegocioException.invalido("Activa al menos una forma de entrega: domicilio o recoger en el local.");
        }
        auditarComo(superadmin);

        long id = control.sql("""
                        INSERT INTO plataforma.tbl_empresas (identificador, razon_social, nit, responsable_nombre,
                            responsable_correo, responsable_celular, plan, ciclo_facturacion, precio_plan, notas)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                .params(identificador, r.razonSocial().trim(), limpio(r.nit()), r.responsableNombre().trim(),
                        limpio(r.responsableCorreo()), limpio(r.responsableCelular()), plan.codigo(), r.cicloFacturacion(),
                        PlanesService.precio(plan, r.cicloFacturacion()), limpio(r.notas()))
                .query(Long.class).single();
        control.sql("""
                        INSERT INTO plataforma.tbl_empresas_marca (empresa_id, nombre_comercial, color_primario, color_secundario, dominio_propio)
                        VALUES (?, ?, ?, ?, ?)""")
                .params(id, r.nombreComercial().trim(), r.colorPrimario().toUpperCase(Locale.ROOT),
                        r.colorSecundario().toUpperCase(Locale.ROOT), dominio)
                .update();
        // Solicitud de aprovisionamiento. La clave del administrador viaja ya cifrada con BCrypt.
        control.sql("""
                        INSERT INTO plataforma.tbl_aprovisionamientos (empresa_id, datos_iniciales)
                        VALUES (?, jsonb_build_object(
                            'admin_usuario', ?::text, 'admin_nombre', ?::text, 'admin_clave_hash', ?::text,
                            'modo_pedido', ?::text, 'whatsapp', ?::text, 'ciudad', ?::text, 'direccion', ?::text,
                            'tiene_domicilio', ?::boolean, 'tiene_recogida', ?::boolean, 'domicilio_valor', ?::int,
                            'modulos', to_jsonb(string_to_array(?::text, ','))))""")
                .params(id, r.adminUsuario().trim().toLowerCase(Locale.ROOT), r.adminNombre().trim(),
                        encoder.encode(r.adminClave()), r.modoPedido(), limpio(r.whatsapp()), limpio(r.ciudad()),
                        limpio(r.direccion()), r.tieneDomicilio(), r.tieneRecogida(), r.domicilioValor(),
                        String.join(",", modulos))
                .update();
        return avisar(id, detalle(uuidDe(id)));
    }

    @Transactional("controlTx")
    public PlataformaDto.EmpresaDetalle actualizar(UUID uuid, PlataformaDto.ActualizarEmpresaRequest r, String superadmin) {
        long id = idDe(uuid);
        String dominio = dominioLimpio(r.dominioPropio());
        validarDominio(dominio, id);
        PlataformaDto.Plan plan = planes.buscar(r.plan());
        auditarComo(superadmin);
        control.sql("""
                        UPDATE plataforma.tbl_empresas SET razon_social = ?, nit = ?, responsable_nombre = ?,
                            responsable_correo = ?, responsable_celular = ?, plan = ?, ciclo_facturacion = ?, precio_plan = ?,
                            notas = ?, actualizado_en = now()
                        WHERE id = ?""")
                .params(r.razonSocial().trim(), limpio(r.nit()), r.responsableNombre().trim(), limpio(r.responsableCorreo()),
                        limpio(r.responsableCelular()), plan.codigo(), r.cicloFacturacion(),
                        PlanesService.precio(plan, r.cicloFacturacion()), limpio(r.notas()), id)
                .update();
        MarcaService.validar(r.nombreComercial(), r.colorPrimario(), r.colorSecundario());
        control.sql("""
                        UPDATE plataforma.tbl_empresas_marca SET nombre_comercial = ?, color_primario = ?,
                            color_secundario = ?, dominio_propio = ?, actualizado_en = now()
                        WHERE empresa_id = ?""")
                .params(r.nombreComercial().trim(), r.colorPrimario().toUpperCase(Locale.ROOT),
                        r.colorSecundario().toUpperCase(Locale.ROOT), dominio, id)
                .update();
        registro.invalidar(identificadorDe(id));
        return avisar(id, detalle(uuid));
    }

    public PlataformaDto.EmpresaDetalle subirLogo(UUID uuid, byte[] datos) {
        long id = idDe(uuid);
        marca.guardarLogo(id, identificadorDe(id), datos);
        return avisar(id, detalle(uuid));
    }

    public PlataformaDto.EmpresaDetalle quitarLogo(UUID uuid) {
        long id = idDe(uuid);
        marca.quitarLogo(id, identificadorDe(id));
        return avisar(id, detalle(uuid));
    }

    /** Activa o desactiva módulos. No toca la base de la empresa: las tablas ya existen; es solo el permiso. */
    @Transactional("controlTx")
    public PlataformaDto.EmpresaDetalle modulos(UUID uuid, List<String> pedidos, String superadmin) {
        long id = idDe(uuid);
        Set<String> activos = validarModulos(pedidos);
        auditarComo(superadmin);
        control.sql("""
                        INSERT INTO plataforma.tbl_empresa_modulos (empresa_id, modulo_id, es_activo)
                        SELECT ?, m.id, (m.es_base OR m.codigo = ANY (string_to_array(?, ',')))
                        FROM plataforma.tbl_modulos m
                        ON CONFLICT (empresa_id, modulo_id) DO UPDATE SET es_activo = EXCLUDED.es_activo,
                            activado_en = CASE WHEN plataforma.tbl_empresa_modulos.es_activo THEN plataforma.tbl_empresa_modulos.activado_en ELSE now() END""")
                .params(id, String.join(",", activos))
                .update();
        registro.invalidar(identificadorDe(id));
        return avisar(id, detalle(uuid));
    }

    @Transactional("controlTx")
    public PlataformaDto.EmpresaDetalle cambiarEstado(UUID uuid, boolean activar, String superadmin) {
        long id = idDe(uuid);
        String actual = estadoDe(id);
        if (activar && !actual.equals("suspendida")) throw ReglaNegocioException.conflicto("Solo se puede reactivar una empresa suspendida.");
        if (!activar && !actual.equals("activa")) throw ReglaNegocioException.conflicto("Solo se puede suspender una empresa activa.");
        auditarComo(superadmin);
        control.sql("UPDATE plataforma.tbl_empresas SET estado = ?, actualizado_en = now() WHERE id = ?")
                .params(activar ? "activa" : "suspendida", id).update();
        if (!activar) enrutador.cerrar(id);
        registro.invalidar(identificadorDe(id));
        return avisar(id, detalle(uuid));
    }

    /** Vuelve a poner en cola un aprovisionamiento que falló (o que quedó a medias). */
    @Transactional("controlTx")
    public PlataformaDto.EmpresaDetalle reintentar(UUID uuid, String superadmin) {
        long id = idDe(uuid);
        String estado = estadoDe(id);
        if (!estado.equals("error_aprovisionamiento") && !estado.equals("aprovisionando")) {
            throw ReglaNegocioException.conflicto("Esta empresa no tiene un aprovisionamiento para reintentar.");
        }
        auditarComo(superadmin);
        int n = control.sql("""
                        UPDATE plataforma.tbl_aprovisionamientos SET estado = 'pendiente', actualizado_en = now()
                        WHERE id = (SELECT id FROM plataforma.tbl_aprovisionamientos WHERE empresa_id = ? ORDER BY id DESC LIMIT 1)""")
                .param(id).update();
        if (n == 0) throw ReglaNegocioException.conflicto("No se encontró la solicitud de aprovisionamiento.");
        control.sql("UPDATE plataforma.tbl_empresas SET estado = 'pendiente_aprovisionamiento', actualizado_en = now() WHERE id = ?")
                .param(id).update();
        registro.invalidar(identificadorDe(id));
        return avisar(id, detalle(uuid));
    }

    /** Le asigna una clave nueva a un administrador de la empresa, escribiendo en la base de ESA empresa. */
    public void restablecerClaveAdmin(UUID uuid, String usuario, String nueva, String superadmin) {
        long id = idDe(uuid);
        EmpresaActual empresa = registro.porId(id).orElseThrow();
        if (!empresa.activa()) throw ReglaNegocioException.conflicto("La empresa debe estar activa para cambiar la clave de su administrador.");
        EmpresaContexto.conEmpresa(empresa, "superadmin:" + superadmin, () -> txEmpresa.execute(t -> {
            authEmpresa.restablecerClave(usuario, nueva);
            return null;
        }));
    }

    /** Copia productos de la biblioteca precargada al catálogo de ESA empresa (su propia base). */
    public BibliotecaService.Resultado importarBiblioteca(UUID uuid, List<String> slugs, int ajustePorcentaje, String superadmin) {
        long id = idDe(uuid);
        EmpresaActual empresa = registro.porId(id).orElseThrow();
        if (!empresa.activa()) throw ReglaNegocioException.conflicto("La empresa debe estar activa para cargarle productos.");
        BibliotecaService.Resultado r = EmpresaContexto.conEmpresa(empresa, "superadmin:" + superadmin,
                () -> txEmpresa.execute(t -> biblioteca.aplicar(slugs, ajustePorcentaje)));
        tiempoReal.publicar("catalogo", java.util.Map.of(), TiempoReal.tienda(id), TiempoReal.admin(id));
        return r;
    }

    // ------------------------------------------------------------------ apoyo

    private long idDe(UUID uuid) {
        return control.sql("SELECT id FROM plataforma.tbl_empresas WHERE uuid = ?").param(uuid)
                .query(Long.class).optional()
                .orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa empresa no existe."));
    }

    private UUID uuidDe(long id) {
        return control.sql("SELECT uuid FROM plataforma.tbl_empresas WHERE id = ?").param(id).query(UUID.class).single();
    }

    private String identificadorDe(long id) {
        return control.sql("SELECT identificador FROM plataforma.tbl_empresas WHERE id = ?").param(id).query(String.class).single();
    }

    private String estadoDe(long id) {
        return control.sql("SELECT estado FROM plataforma.tbl_empresas WHERE id = ?").param(id).query(String.class).single();
    }

    private List<String> modulosDe(long id) {
        return control.sql("""
                        SELECT m.codigo FROM plataforma.tbl_empresa_modulos em JOIN plataforma.tbl_modulos m ON m.id = em.modulo_id
                        WHERE em.empresa_id = ? AND em.es_activo ORDER BY m.orden""")
                .param(id).query(String.class).list();
    }

    private Set<String> validarModulos(List<String> pedidos) {
        Set<String> validos = new HashSet<>(control.sql("SELECT codigo FROM plataforma.tbl_modulos").query(String.class).list());
        Set<String> out = new LinkedHashSet<>();
        for (String m : pedidos == null ? List.<String>of() : pedidos) {
            if (!validos.contains(m)) throw ReglaNegocioException.invalido("El módulo «" + m + "» no existe.");
            out.add(m);
        }
        return out;
    }

    private void validarDominio(String dominio, Long empresaId) {
        if (dominio == null) return;
        if (!dominio.matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")) {
            throw ReglaNegocioException.invalido("El dominio no es válido. Escríbelo sin https:// (ej. pedidos.laparrilla.com).");
        }
        boolean usado = control.sql("SELECT count(*) FROM plataforma.tbl_empresas_marca WHERE lower(dominio_propio) = ? AND empresa_id <> ?")
                .params(dominio, empresaId == null ? -1L : empresaId).query(Long.class).single() > 0;
        if (usado) throw ReglaNegocioException.conflicto("Ese dominio ya lo usa otra empresa.");
    }

    private boolean existe(String sql, Object valor) {
        return control.sql(sql).param(valor).query((ResultSet rs, int n) -> 1).optional().isPresent();
    }

    /** Deja el nombre del superadmin en la auditoría de la base de control (solo para esta transacción). */
    private void auditarComo(String superadmin) {
        control.sql("SELECT set_config('leinei.usuario', ?, true)").param("superadmin:" + superadmin).query(String.class).single();
    }

    private static String logoUrl(String identificador, boolean tiene, int version) {
        return tiene ? "/api/plataforma/publico/empresas/" + identificador + "/logo?v=" + version : null;
    }

    private static String dominioLimpio(String d) {
        if (d == null || d.isBlank()) return null;
        return d.trim().toLowerCase(Locale.ROOT).replaceFirst("^https?://", "").replaceAll("/+$", "");
    }


    private static String limpio(String s) {
        return s == null ? "" : s.trim();
    }
}
