package co.leinei.api.pagos;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Bold. Se crea un link de pago con valor cerrado (API Link de pagos) y el cliente paga en el checkout de Bold
 * (Nequi, PSE, tarjeta, Botón Bancolombia). Bold avisa con SALE_APPROVED / SALE_REJECTED / VOID_APPROVED,
 * firmado con HMAC-SHA256 (encabezado x-bold-signature).
 *
 * Documentación: https://developers.bold.co/pagos-en-linea/api-link-de-pagos y https://developers.bold.co/webhook
 */
@Component
public class BoldPasarela implements Pasarela {

    private static final String API = "https://integrations.api.bold.co/online/link/v1";
    private static final Duration VIGENCIA_LINK = Duration.ofHours(2);

    private final ClienteHttp http;

    public BoldPasarela(ClienteHttp http) {
        this.http = http;
    }

    @Override
    public Proveedor proveedor() { return Proveedor.BOLD; }

    @Override
    public String faltante(Credenciales c) {
        if (c.llavePublica().isBlank()) return "Falta la llave de identidad de Bold.";
        if (!c.pruebas() && c.secretoEventos().isBlank()) return "Falta la llave secreta de Bold (con ella se confirman los pagos).";
        return null;
    }

    @Override
    public Inicio iniciar(Credenciales c, String referencia, int monto, String descripcion, String retorno) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("amount_type", "CLOSE");
        cuerpo.put("amount", Map.of("currency", "COP", "total_amount", monto, "tip_amount", 0));
        cuerpo.put("reference", referencia);
        cuerpo.put("description", descripcion.length() > 100 ? descripcion.substring(0, 100) : descripcion);
        Instant vence = Instant.now().plus(VIGENCIA_LINK);
        cuerpo.put("expiration_date", vence.getEpochSecond() * 1_000_000_000L + vence.getNano());
        // Bold solo acepta direcciones de regreso con https.
        if (retorno != null && retorno.startsWith("https://")) cuerpo.put("callback_url", retorno);

        ClienteHttp.Respuesta r = http.post(API, autorizacion(c), cuerpo);
        JsonNode payload = r.cuerpo().path("payload");
        String link = payload.path("payment_link").asString("");
        String url = payload.path("url").asString("");
        if (!r.ok() || link.isBlank() || url.isBlank()) {
            throw new PasarelaException("Bold no pudo crear el cobro" + errores(r.cuerpo()) + ". Intenta de nuevo o escoge otra forma de pago.");
        }
        return new Inicio(url, link);
    }

    @Override
    public Optional<Resultado> consultar(Credenciales c, Transaccion t) {
        if (t.idExterno().isBlank()) return Optional.empty();
        ClienteHttp.Respuesta r = http.get(API + "/" + URLEncoder.encode(t.idExterno(), StandardCharsets.UTF_8), autorizacion(c));
        if (r.estado() == 404) return Optional.empty();
        if (!r.ok()) throw new PasarelaException("Bold respondió con un error (" + r.estado() + ") al consultar el pago.");
        JsonNode link = r.cuerpo().has("payload") ? r.cuerpo().path("payload") : r.cuerpo();
        EstadoTransaccion estado = switch (link.path("status").asString("")) {
            case "PAID" -> EstadoTransaccion.APROBADO;
            case "REJECTED", "CANCELLED" -> EstadoTransaccion.RECHAZADO;
            case "EXPIRED" -> EstadoTransaccion.VENCIDO;
            default -> EstadoTransaccion.PENDIENTE;
        };
        Integer monto = link.has("total") ? link.path("total").asInt() : null;
        return Optional.of(new Resultado(estado, link.path("transaction_id").asString(""), monto,
                link.path("payment_method").asString(""), ""));
    }

    @Override
    public Optional<Evento> leerEvento(byte[] cuerpo) {
        JsonNode e = http.leer(cuerpo);
        EstadoTransaccion estado = switch (e.path("type").asString("")) {
            case "SALE_APPROVED" -> EstadoTransaccion.APROBADO;
            case "SALE_REJECTED" -> EstadoTransaccion.RECHAZADO;
            case "VOID_APPROVED" -> EstadoTransaccion.ANULADO;
            default -> null; // VOID_REJECTED y otros: no cambian nada
        };
        JsonNode data = e.path("data");
        String referencia = data.path("metadata").path("reference").asString("");
        if (estado == null || referencia.isBlank()) return Optional.empty();
        Integer monto = data.path("amount").has("total") ? data.path("amount").path("total").asInt() : null;
        return Optional.of(new Evento(referencia, new Resultado(estado, data.path("payment_id").asString(""), monto,
                data.path("payment_method").asString(""), "")));
    }

    /** Firma de Bold: hex(HMAC-SHA256(llave secreta, base64(cuerpo))). En pruebas la llave es vacía. */
    @Override
    public boolean firmaValida(Credenciales c, byte[] cuerpo, Map<String, String> encabezados) {
        String recibida = encabezados.getOrDefault("x-bold-signature", "");
        if (recibida.isBlank()) return false;
        String calculada = Firmas.hmacSha256(c.secretoEventos(), Base64.getEncoder().encodeToString(cuerpo));
        return Firmas.iguales(calculada, recibida);
    }

    private static Map<String, String> autorizacion(Credenciales c) {
        return Map.of("Authorization", "x-api-key " + c.llavePublica());
    }

    private static String errores(JsonNode cuerpo) {
        StringBuilder sb = new StringBuilder();
        for (JsonNode e : cuerpo.path("errors")) {
            String m = e.isString() ? e.asString("") : e.path("message").asString(e.toString());
            if (!m.isBlank()) sb.append(sb.isEmpty() ? ": " : "; ").append(m);
        }
        return sb.toString();
    }
}
