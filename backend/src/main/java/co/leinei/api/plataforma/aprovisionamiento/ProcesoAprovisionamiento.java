package co.leinei.api.plataforma.aprovisionamiento;

import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.config.LeineiProperties;
import co.leinei.api.empresa.RegistroEmpresas;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Proceso de aprovisionamiento: toma las solicitudes pendientes de tbl_aprovisionamientos y corre el
 * pipeline con credenciales OWNER. Deja un registro legible paso a paso en la misma fila.
 *
 * La aplicación de cara al público nunca crea bases: solo inserta la empresa y su solicitud. Este
 * proceso puede apagarse aquí (leinei.plataforma.aprovisionamiento-habilitado=false) y correr en un
 * servicio aparte con el mismo código y sus propias credenciales.
 */
@Component
public class ProcesoAprovisionamiento {

    private static final Logger log = LoggerFactory.getLogger(ProcesoAprovisionamiento.class);

    private record Solicitud(long id, long empresaId, String identificador, Aprovisionador.DatosIniciales datos) {}

    private final ServidorPostgres servidor;
    private final CifradoClaves cifrado;
    private final LeineiProperties props;
    private final RegistroEmpresas registro;
    private final TiempoReal tiempoReal;

    public ProcesoAprovisionamiento(ServidorPostgres servidor, CifradoClaves cifrado, LeineiProperties props,
                                    RegistroEmpresas registro, TiempoReal tiempoReal) {
        this.tiempoReal = tiempoReal;
        this.servidor = servidor;
        this.cifrado = cifrado;
        this.props = props;
        this.registro = registro;
    }

    @Scheduled(fixedDelay = 4000, initialDelay = 3000)
    public void procesarPendientes() {
        if (!props.plataforma().aprovisionamientoHabilitado()) return;
        try {
            Solicitud s;
            while ((s = tomarSiguiente()) != null) procesar(s);
        } catch (Exception e) {
            log.error("Error revisando la cola de aprovisionamiento", e);
        }
    }

    private void procesar(Solicitud s) {
        StringBuilder bitacora = new StringBuilder();
        Aprovisionador ap = new Aprovisionador(servidor, cifrado);
        try {
            ap.aprovisionar(s.empresaId(), s.identificador(), s.datos(), paso -> anotar(s, bitacora, paso));
            terminar(s, "completado", bitacora, null);
            log.info("Empresa {} aprovisionada", s.identificador());
        } catch (Exception e) {
            anotar(s, bitacora, "ERROR: " + e.getMessage());
            terminar(s, "fallido", bitacora, "error_aprovisionamiento");
            log.error("Falló el aprovisionamiento de {}", s.identificador(), e);
        } finally {
            registro.invalidar(s.identificador());
            avisar(s);
        }
    }

    /** Marca como en proceso la siguiente solicitud pendiente, sin chocar con otro proceso que haga lo mismo. */
    private Solicitud tomarSiguiente() throws SQLException {
        try (Connection c = servidor.conectarComoOwner(servidor.baseControl())) {
            c.setAutoCommit(false);
            try (PreparedStatement ps = c.prepareStatement("""
                    UPDATE plataforma.tbl_aprovisionamientos a
                       SET estado = 'en_proceso', intentos = intentos + 1, actualizado_en = now()
                     WHERE a.id = (SELECT id FROM plataforma.tbl_aprovisionamientos
                                    WHERE estado = 'pendiente' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
                    RETURNING a.id, a.empresa_id, a.datos_iniciales ->> 'admin_usuario', a.datos_iniciales ->> 'admin_nombre',
                              a.datos_iniciales ->> 'admin_clave_hash', a.datos_iniciales ->> 'modo_pedido',
                              a.datos_iniciales ->> 'whatsapp', a.datos_iniciales ->> 'ciudad', a.datos_iniciales ->> 'direccion',
                              COALESCE((a.datos_iniciales ->> 'tiene_domicilio')::boolean, TRUE),
                              COALESCE((a.datos_iniciales ->> 'tiene_recogida')::boolean, FALSE),
                              COALESCE((a.datos_iniciales ->> 'domicilio_valor')::int, 0),
                              ARRAY(SELECT jsonb_array_elements_text(COALESCE(a.datos_iniciales -> 'modulos', '[]'::jsonb)))""");
                 ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    c.commit();
                    return null;
                }
                long id = rs.getLong(1), empresaId = rs.getLong(2);
                List<String> modulos = new ArrayList<>(List.of((String[]) rs.getArray(13).getArray()));
                Aprovisionador.DatosIniciales d = new Aprovisionador.DatosIniciales(rs.getString(3), rs.getString(4),
                        rs.getString(5), valor(rs.getString(6), "INMEDIATO"), valor(rs.getString(7), ""),
                        valor(rs.getString(8), ""), valor(rs.getString(9), ""), rs.getBoolean(10), rs.getBoolean(11),
                        rs.getInt(12), modulos);
                String identificador;
                try (PreparedStatement pe = c.prepareStatement(
                        "UPDATE plataforma.tbl_empresas SET estado = 'aprovisionando', actualizado_en = now() WHERE id = ? RETURNING identificador")) {
                    pe.setLong(1, empresaId);
                    try (ResultSet re = pe.executeQuery()) { re.next(); identificador = re.getString(1); }
                }
                c.commit();
                return new Solicitud(id, empresaId, identificador, d);
            }
        }
    }

    private void anotar(Solicitud s, StringBuilder bitacora, String paso) {
        bitacora.append(Instant.now()).append("  ").append(paso).append('\n');
        try (Connection c = servidor.conectarComoOwner(servidor.baseControl());
             PreparedStatement ps = c.prepareStatement(
                     "UPDATE plataforma.tbl_aprovisionamientos SET paso_actual = ?, registro = ?, actualizado_en = now() WHERE id = ?")) {
            ps.setString(1, paso.length() > 80 ? paso.substring(0, 80) : paso);
            ps.setString(2, bitacora.toString());
            ps.setLong(3, s.id());
            ps.executeUpdate();
        } catch (SQLException e) {
            log.warn("No se pudo anotar el paso del aprovisionamiento {}", s.id(), e);
        }
        avisar(s);
    }

    /** El superadmin ve cada paso en vivo. */
    private void avisar(Solicitud s) {
        tiempoReal.publicar("empresa", java.util.Map.of("identificador", s.identificador()), TiempoReal.PLATAFORMA);
    }

    private void terminar(Solicitud s, String estado, StringBuilder bitacora, String estadoEmpresa) {
        try (Connection c = servidor.conectarComoOwner(servidor.baseControl())) {
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE plataforma.tbl_aprovisionamientos SET estado = ?, registro = ?, actualizado_en = now() WHERE id = ?")) {
                ps.setString(1, estado);
                ps.setString(2, bitacora.toString());
                ps.setLong(3, s.id());
                ps.executeUpdate();
            }
            if (estadoEmpresa != null) {
                try (PreparedStatement ps = c.prepareStatement(
                        "UPDATE plataforma.tbl_empresas SET estado = ?, actualizado_en = now() WHERE id = ?")) {
                    ps.setString(1, estadoEmpresa);
                    ps.setLong(2, s.empresaId());
                    ps.executeUpdate();
                }
            }
        } catch (SQLException e) {
            log.error("No se pudo cerrar el aprovisionamiento {}", s.id(), e);
        }
    }

    private static String valor(String v, String porDefecto) {
        return v == null || v.isBlank() ? porDefecto : v;
    }
}
