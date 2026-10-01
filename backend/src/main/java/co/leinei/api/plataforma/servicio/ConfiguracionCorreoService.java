package co.leinei.api.plataforma.servicio;

import co.leinei.api.plataforma.aprovisionamiento.CifradoClaves;
import co.leinei.api.plataforma.web.PlataformaDto;
import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * La cuenta de correo desde la que la plataforma envía los datos de acceso. La define el superadmin en el panel
 * (la clave se guarda cifrada). Si el panel no tiene host, se usan las variables de entorno MAIL_* como respaldo.
 */
@Service
public class ConfiguracionCorreoService {

    /** Configuración lista para usar (con la clave ya descifrada). Solo vive en memoria durante un envío. */
    public record Efectiva(String host, int puerto, String seguridad, String usuario, String clave, String remitente,
                           String urlPublica, String origen) {
        public boolean configurado() { return host != null && !host.isBlank(); }
        public String desde() { return !remitente.isBlank() ? remitente : usuario; }
    }

    private final JdbcClient control;
    private final CifradoClaves cifrado;
    private final String envHost;
    private final int envPuerto;
    private final String envUsuario;
    private final String envClave;
    private final String envRemitente;
    private final String envUrl;

    public ConfiguracionCorreoService(@Qualifier("controlJdbc") JdbcClient control, CifradoClaves cifrado,
                                      @Value("${spring.mail.host:}") String envHost,
                                      @Value("${spring.mail.port:587}") int envPuerto,
                                      @Value("${spring.mail.username:}") String envUsuario,
                                      @Value("${spring.mail.password:}") String envClave,
                                      @Value("${leinei.correo-remitente:}") String envRemitente,
                                      @Value("${leinei.url-publica:http://localhost:8080}") String envUrl) {
        this.control = control;
        this.cifrado = cifrado;
        this.envHost = envHost == null ? "" : envHost.trim();
        this.envPuerto = envPuerto;
        this.envUsuario = envUsuario == null ? "" : envUsuario.trim();
        this.envClave = envClave == null ? "" : envClave;
        this.envRemitente = envRemitente == null ? "" : envRemitente.trim();
        this.envUrl = envUrl == null ? "" : envUrl.trim();
    }

    private record Fila(String host, int puerto, String seguridad, String usuario, String claveCifrada, String remitente, String url) {}

    private Fila fila() {
        return control.sql("""
                        SELECT host, puerto, seguridad, usuario, clave_cifrada, remitente, url_publica
                        FROM plataforma.tbl_configuracion_correo WHERE id = 1""")
                .query((rs, n) -> new Fila(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6), rs.getString(7)))
                .optional().orElse(new Fila("", 587, "STARTTLS", "", "", "", ""));
    }

    @Transactional(value = "controlTx", readOnly = true)
    public PlataformaDto.ConfigCorreo ver() {
        Fila f = fila();
        Efectiva e = efectiva();
        return new PlataformaDto.ConfigCorreo(f.host(), f.puerto(), f.seguridad(), f.usuario(), !f.claveCifrada().isEmpty(),
                f.remitente(), f.url(), e.configurado(), e.origen());
    }

    /** Lo que se usa de verdad: lo guardado en el panel, o si está vacío, las variables de entorno. */
    @Transactional(value = "controlTx", readOnly = true)
    public Efectiva efectiva() {
        Fila f = fila();
        String url = !f.url().isBlank() ? f.url() : envUrl;
        if (!f.host().isBlank()) {
            String clave = f.claveCifrada().isEmpty() ? "" : cifrado.descifrar(f.claveCifrada());
            return new Efectiva(f.host(), f.puerto(), f.seguridad(), f.usuario(), clave, f.remitente(), url, "PANEL");
        }
        if (!envHost.isEmpty()) {
            return new Efectiva(envHost, envPuerto, envPuerto == 465 ? "SSL" : "STARTTLS", envUsuario, envClave, envRemitente, url, "ENTORNO");
        }
        return new Efectiva("", 587, "STARTTLS", "", "", "", url, "NINGUNO");
    }

    @Transactional("controlTx")
    public PlataformaDto.ConfigCorreo guardar(PlataformaDto.ConfigCorreoRequest r) {
        String host = r.host().trim();
        String usuario = r.usuario().trim();
        if (!host.isEmpty() && host.matches(".*[\\s/:].*")) {
            throw ReglaNegocioException.invalido("El servidor debe ser solo el nombre, por ejemplo smtp.gmail.com (sin http:// ni el puerto).");
        }
        if (!r.remitente().isBlank() && !r.remitente().contains("@")) {
            throw ReglaNegocioException.invalido("El remitente debe ser un correo, por ejemplo Mi Plataforma <ventas@midominio.com>.");
        }
        Fila actual = fila();
        String clave = r.clave() == null || r.clave().isEmpty() ? actual.claveCifrada() : cifrado.cifrar(r.clave());
        if (host.isEmpty()) clave = ""; // sin servidor no tiene sentido guardar la clave
        control.sql("""
                        UPDATE plataforma.tbl_configuracion_correo SET host = ?, puerto = ?, seguridad = ?, usuario = ?,
                            clave_cifrada = ?, remitente = ?, url_publica = ?, actualizado_en = now()
                        WHERE id = 1""")
                .params(host, r.puerto(), r.seguridad(), usuario, clave, r.remitente().trim(), r.urlPublica().trim().replaceAll("/+$", ""))
                .update();
        return ver();
    }
}
