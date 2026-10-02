package co.leinei.api.pagos;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/** Llamadas HTTP con JSON a las pasarelas, con tiempos de espera cortos. */
@Component
public class ClienteHttp {

    private static final Duration ESPERA = Duration.ofSeconds(10);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final JsonMapper json = JsonMapper.builder().build();

    /** Respuesta de la pasarela: código HTTP y cuerpo ya leído como JSON (vacío si no era JSON). */
    public record Respuesta(int estado, JsonNode cuerpo) {
        public boolean ok() { return estado >= 200 && estado < 300; }
    }

    public Respuesta get(String url, Map<String, String> encabezados) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url)).timeout(ESPERA).GET();
        encabezados.forEach(b::header);
        return enviar(b.build());
    }

    public Respuesta post(String url, Map<String, String> encabezados, Object cuerpo) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url)).timeout(ESPERA)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(cuerpo), StandardCharsets.UTF_8));
        encabezados.forEach(b::header);
        return enviar(b.build());
    }

    public JsonNode leer(byte[] cuerpo) {
        return json.readTree(cuerpo);
    }

    private Respuesta enviar(HttpRequest req) {
        try {
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode cuerpo;
            try {
                cuerpo = r.body() == null || r.body().isBlank() ? json.createObjectNode() : json.readTree(r.body());
            } catch (RuntimeException noEsJson) {
                cuerpo = json.createObjectNode();
            }
            return new Respuesta(r.statusCode(), cuerpo);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new PasarelaException("Se interrumpió la conexión con la pasarela de pagos.", e);
        } catch (Exception e) {
            throw new PasarelaException("No pudimos conectarnos con la pasarela de pagos. Intenta de nuevo en un momento.", e);
        }
    }
}
