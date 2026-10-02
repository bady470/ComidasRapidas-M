package co.leinei.api.pagos;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Wompi (Bancolombia). El cliente paga en el Web Checkout de Wompi (Nequi, PSE, tarjeta, Botón Bancolombia) y
 * Wompi avisa con el evento «transaction.updated», firmado con el secreto de eventos de la cuenta.
 *
 * Documentación: https://docs.wompi.co/docs/colombia/widget-checkout-web/ y https://docs.wompi.co/docs/colombia/eventos/
 */
@Component
public class WompiPasarela implements Pasarela {

    private static final String CHECKOUT = "https://checkout.wompi.co/p/";
    private static final String API_PRUEBAS = "https://sandbox.wompi.co/v1";
    private static final String API_PRODUCCION = "https://production.wompi.co/v1";

    private final ClienteHttp http;

    public WompiPasarela(ClienteHttp http) {
        this.http = http;
    }

    @Override
    public Proveedor proveedor() { return Proveedor.WOMPI; }

    @Override
    public String faltante(Credenciales c) {
        String pub = c.llavePublica();
        if (pub.isBlank()) return "Falta la llave pública de Wompi (empieza por pub_).";
        if (!pub.startsWith("pub_")) return "La llave pública de Wompi empieza por pub_test_ o pub_prod_.";
        if (c.pruebas() && pub.startsWith("pub_prod_")) return "La llave pública es de producción pero el ambiente dice «Pruebas».";
        if (!c.pruebas() && pub.startsWith("pub_test_")) return "La llave pública es de pruebas pero el ambiente dice «Producción».";
        if (!c.llavePrivada().isBlank() && !c.llavePrivada().startsWith("prv_")) return "La llave privada de Wompi empieza por prv_.";
        if (c.secretoIntegridad().isBlank()) return "Falta el secreto de integridad de Wompi.";
        if (c.secretoEventos().isBlank()) return "Falta el secreto de eventos de Wompi (con él se confirman los pagos).";
        return null;
    }

    @Override
    public Inicio iniciar(Credenciales c, String referencia, int monto, String descripcion, String retorno) {
        long centavos = monto * 100L;
        String firma = Firmas.sha256(referencia + centavos + "COP" + c.secretoIntegridad());
        Map<String, String> p = new LinkedHashMap<>();
        p.put("public-key", c.llavePublica());
        p.put("currency", "COP");
        p.put("amount-in-cents", String.valueOf(centavos));
        p.put("reference", referencia);
        p.put("signature:integrity", firma);
        if (retorno != null && !retorno.isBlank()) p.put("redirect-url", retorno);
        String query = p.entrySet().stream()
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        return new Inicio(CHECKOUT + "?" + query, "");
    }

    @Override
    public Optional<Resultado> consultar(Credenciales c, Transaccion t) {
        String base = c.pruebas() ? API_PRUEBAS : API_PRODUCCION;
        if (!t.idTransaccion().isBlank()) {
            ClienteHttp.Respuesta r = http.get(base + "/transactions/" + URLEncoder.encode(t.idTransaccion(), StandardCharsets.UTF_8), Map.of());
            if (r.estado() == 404) return Optional.empty();
            if (!r.ok()) throw new PasarelaException("Wompi respondió con un error (" + r.estado() + ") al consultar el pago.");
            JsonNode tx = r.cuerpo().path("data");
            // El id puede venir del navegador del cliente: solo vale si es de esta misma referencia.
            if (!t.referencia().equals(tx.path("reference").asString(""))) return Optional.empty();
            return Optional.of(resultado(tx));
        }
        // Sin id de transacción: se busca por referencia (necesita la llave privada).
        if (c.llavePrivada().isBlank()) return Optional.empty();
        ClienteHttp.Respuesta r = http.get(base + "/transactions?reference=" + URLEncoder.encode(t.referencia(), StandardCharsets.UTF_8),
                Map.of("Authorization", "Bearer " + c.llavePrivada()));
        if (!r.ok()) throw new PasarelaException("Wompi respondió con un error (" + r.estado() + ") al buscar el pago.");
        JsonNode elegida = null;
        for (JsonNode tx : r.cuerpo().path("data")) {
            if (!t.referencia().equals(tx.path("reference").asString(""))) continue;
            if ("APPROVED".equals(tx.path("status").asString(""))) { elegida = tx; break; }
            elegida = tx;
        }
        return Optional.ofNullable(elegida).map(this::resultado);
    }

    @Override
    public Optional<Evento> leerEvento(byte[] cuerpo) {
        JsonNode e = http.leer(cuerpo);
        if (!"transaction.updated".equals(e.path("event").asString(""))) return Optional.empty();
        JsonNode tx = e.path("data").path("transaction");
        String referencia = tx.path("reference").asString("");
        if (referencia.isBlank()) return Optional.empty();
        return Optional.of(new Evento(referencia, resultado(tx)));
    }

    /**
     * Firma de Wompi: SHA-256 de los valores de signature.properties (en orden) + timestamp + secreto de eventos.
     */
    @Override
    public boolean firmaValida(Credenciales c, byte[] cuerpo, Map<String, String> encabezados) {
        JsonNode e = http.leer(cuerpo);
        JsonNode firma = e.path("signature");
        StringBuilder texto = new StringBuilder();
        for (JsonNode propiedad : firma.path("properties")) {
            JsonNode valor = e.path("data");
            for (String parte : propiedad.asString("").split("\\.")) valor = valor.path(parte);
            texto.append(valor.isMissingNode() || valor.isNull() ? "" : valor.asString(""));
        }
        texto.append(e.path("timestamp").asString("")).append(c.secretoEventos());
        String recibida = firma.path("checksum").asString(encabezados.getOrDefault("x-event-checksum", ""));
        return !texto.isEmpty() && Firmas.iguales(Firmas.sha256(texto.toString()), recibida);
    }

    private Resultado resultado(JsonNode tx) {
        EstadoTransaccion estado = switch (tx.path("status").asString("")) {
            case "APPROVED" -> EstadoTransaccion.APROBADO;
            case "DECLINED" -> EstadoTransaccion.RECHAZADO;
            case "VOIDED" -> EstadoTransaccion.ANULADO;
            case "ERROR" -> EstadoTransaccion.ERROR;
            default -> EstadoTransaccion.PENDIENTE;
        };
        Integer monto = tx.has("amount_in_cents") ? (int) (tx.path("amount_in_cents").asLong() / 100) : null;
        String detalle = tx.path("status_message").asString("");
        return new Resultado(estado, tx.path("id").asString(""), monto, tx.path("payment_method_type").asString(""), detalle);
    }
}
