package co.leinei.api.plataforma.servicio;

import co.leinei.api.plataforma.servicio.ConfiguracionCorreoService.Efectiva;
import co.leinei.api.plataforma.web.PlataformaDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import java.text.NumberFormat;
import java.util.Locale;
import java.util.Properties;

/**
 * Correos de la plataforma, enviados con la cuenta que el superadmin configura en el panel (o, de respaldo, con las
 * variables MAIL_*). Si no hay cuenta, no se envía nada y el panel avisa. Nunca hace fallar la creación de una empresa.
 */
@Service
public class CorreoService {

    private static final Logger log = LoggerFactory.getLogger(CorreoService.class);

    public static final String ENVIADO = "ENVIADO";
    public static final String NO_CONFIGURADO = "NO_CONFIGURADO";
    public static final String SIN_CORREO = "SIN_CORREO";
    public static final String FALLO = "FALLO";

    private final ConfiguracionCorreoService config;

    public CorreoService(ConfiguracionCorreoService config) {
        this.config = config;
    }

    /** Envía al responsable de la empresa los datos para entrar. Devuelve ENVIADO, NO_CONFIGURADO, SIN_CORREO o FALLO. */
    public String bienvenida(String destino, String responsable, String negocio, String identificador, String dominio, String usuarioAdmin,
                             String claveAdmin, String plan, String ciclo, int precio) {
        if (destino == null || destino.isBlank()) return SIN_CORREO;
        Efectiva c = config.efectiva();
        if (!c.configurado()) return NO_CONFIGURADO;
        try {
            enviar(c, destino.trim(), "Bienvenido a " + negocio + ": tus datos de acceso",
                    cuerpo(c.urlPublica(), responsable, negocio, identificador, dominio, usuarioAdmin, claveAdmin, plan, ciclo, precio));
            return ENVIADO;
        } catch (Exception e) {
            log.warn("No se pudo enviar el correo de bienvenida a {}: {}", destino, e.getMessage());
            return FALLO;
        }
    }

    /** Avisa al responsable cuando a una empresa ya creada se le asigna o cambia su dominio. */
    public String avisoDominio(String destino, String responsable, String negocio, String dominio) {
        if (destino == null || destino.isBlank() || dominio == null || dominio.isBlank()) return SIN_CORREO;
        Efectiva c = config.efectiva();
        if (!c.configurado()) return NO_CONFIGURADO;
        try {
            String d = dominio.trim();
            enviar(c, destino.trim(), negocio + ": tu dirección propia ya está asignada",
                    "Hola " + responsable + ",\n\nTu negocio «" + negocio + "» ahora se abre en su propia dirección:\n\n"
                            + "  Para tus clientes (publícala):  https://" + d + "\n  Para entrar a administrar:  https://" + d + "/admin/entrar\n\n"
                            + "Para que funcione, el dominio debe apuntar al servidor de la plataforma. Tu usuario y clave siguen siendo los mismos.\n");
            return ENVIADO;
        } catch (Exception e) {
            log.warn("No se pudo enviar el aviso de dominio a {}: {}", destino, e.getMessage());
            return FALLO;
        }
    }

    /** Correo de prueba desde el panel: devuelve el motivo exacto si falla, para poder corregir la cuenta. */
    public PlataformaDto.ResultadoPrueba prueba(String destino) {
        Efectiva c = config.efectiva();
        if (!c.configurado()) return new PlataformaDto.ResultadoPrueba(false, "Primero guarda el servidor de correo.");
        try {
            enviar(c, destino.trim(), "Prueba de correo de la plataforma",
                    "Este es un mensaje de prueba. Si lo estás leyendo, la cuenta de correo quedó bien configurada y "
                            + "los datos de acceso de las nuevas empresas llegarán desde aquí.\n");
            return new PlataformaDto.ResultadoPrueba(true, "Enviado a " + destino.trim() + ". Revisa la bandeja (y el spam).");
        } catch (Exception e) {
            log.warn("Falló el correo de prueba: {}", e.getMessage());
            return new PlataformaDto.ResultadoPrueba(false, "No se pudo enviar: " + motivo(e));
        }
    }

    private static void enviar(Efectiva c, String destino, String asunto, String texto) {
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(c.host());
        s.setPort(c.puerto());
        if (!c.usuario().isBlank()) { s.setUsername(c.usuario()); s.setPassword(c.clave()); }
        Properties p = new Properties();
        p.put("mail.smtp.auth", String.valueOf(!c.usuario().isBlank()));
        p.put("mail.smtp.connectiontimeout", "6000");
        p.put("mail.smtp.timeout", "10000");
        p.put("mail.smtp.writetimeout", "10000");
        if ("SSL".equals(c.seguridad())) p.put("mail.smtp.ssl.enable", "true");
        else if ("STARTTLS".equals(c.seguridad())) { p.put("mail.smtp.starttls.enable", "true"); p.put("mail.smtp.starttls.required", "true"); }
        s.setJavaMailProperties(p);
        SimpleMailMessage m = new SimpleMailMessage();
        if (!c.desde().isBlank()) m.setFrom(c.desde());
        m.setTo(destino);
        m.setSubject(asunto);
        m.setText(texto);
        s.send(m);
    }

    /** Mensaje corto y entendible; nunca incluye la clave. */
    private static String motivo(Throwable e) {
        Throwable raiz = e;
        while (raiz.getCause() != null && raiz.getCause() != raiz) raiz = raiz.getCause();
        String t = (raiz.getMessage() == null ? raiz.getClass().getSimpleName() : raiz.getMessage()).replaceAll("\\s+", " ");
        if (t.contains("535") || t.toLowerCase(Locale.ROOT).contains("authentication")) {
            return "el servidor rechazó el usuario o la clave (en Gmail usa una «contraseña de aplicación»). " + corto(t);
        }
        return corto(t);
    }

    private static String corto(String t) { return t.length() > 200 ? t.substring(0, 200) + "…" : t; }

    static String cuerpo(String urlPublica, String responsable, String negocio, String id, String dominio, String usuarioAdmin, String clave,
                         String plan, String ciclo, int precio) {
        String url = urlPublica.replaceAll("/+$", "");
        String dinero = NumberFormat.getIntegerInstance(Locale.forLanguageTag("es-CO")).format(precio);
        String cada = "ANUAL".equals(ciclo) ? "año" : "mes";
        // Con dominio propio, esas son las direcciones que se publican; si no, las de la plataforma.
        String base = (dominio == null || dominio.isBlank()) ? url + "/" + id : "https://" + dominio.trim();
        String nota = (dominio == null || dominio.isBlank()) ? ""
                : "\nPara que tu dirección propia funcione, el dominio debe apuntar al servidor de la plataforma; si tienes dudas, responde a este correo.\n";
        return """
                Hola %s,

                Tu negocio «%s» ya quedó listo. Estas son tus dos direcciones:

                1) PARA TUS CLIENTES (publícala en tu Instagram, WhatsApp, volantes, etc.):
                   %s

                2) PARA TI, ENTRAR A ATENDER Y ADMINISTRAR (no la compartas):
                   %s/admin/entrar
                   Usuario: %s
                   Clave:   %s

                Plan: %s · $%s por %s
                %s
                Pasos para empezar: entra con tu usuario y clave, cambia la clave, arma tu catálogo y el valor del domicilio, \
                y luego publica la dirección del punto 1.

                Si no esperabas este mensaje, ignóralo.
                """.formatted(responsable, negocio, base, base, usuarioAdmin, clave, plan, dinero, cada, nota);
    }
}
