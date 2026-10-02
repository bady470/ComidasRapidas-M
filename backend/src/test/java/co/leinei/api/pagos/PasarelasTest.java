package co.leinei.api.pagos;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PasarelasTest {

    private final ClienteHttp http = new ClienteHttp();
    private final WompiPasarela wompi = new WompiPasarela(http);
    private final BoldPasarela bold = new BoldPasarela(http);

    private static Credenciales wompi(String eventos) {
        return new Credenciales(Proveedor.WOMPI, Credenciales.PRODUCCION, "pub_prod_abc", "",
                "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6", eventos);
    }

    @Test
    void wompiFirmaElCheckoutComoLaDocumentacion() {
        // Ejemplo de la documentación de Wompi: referencia + centavos + moneda + secreto de integridad.
        String url = wompi.iniciar(wompi("x"), "sk8-438k4-xmxm392-sn2m", 24_900, "Pedido", "https://tienda.co/pedido").url();
        assertThat(url).startsWith("https://checkout.wompi.co/p/?public-key=pub_prod_abc")
                .contains("amount-in-cents=2490000")
                .contains("signature:integrity=37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5")
                .contains("redirect-url=https%3A%2F%2Ftienda.co%2Fpedido");
    }

    @Test
    void wompiVerificaLaFirmaDeLosEventos() {
        String secreto = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";
        String checksum = Firmas.sha256("1234-1610641025-49201APPROVED4490000" + "1530291411" + secreto);
        String evento = """
                {"event":"transaction.updated","data":{"transaction":{"id":"1234-1610641025-49201","amount_in_cents":4490000,
                "reference":"LN1-ABC234-1","payment_method_type":"NEQUI","status":"APPROVED"}},"environment":"prod",
                "signature":{"properties":["transaction.id","transaction.status","transaction.amount_in_cents"],
                "checksum":"%s"},"timestamp":1530291411}""".formatted(checksum.toUpperCase());
        byte[] cuerpo = evento.getBytes(StandardCharsets.UTF_8);

        assertThat(wompi.firmaValida(wompi(secreto), cuerpo, Map.of())).isTrue();
        assertThat(wompi.firmaValida(wompi("otro_secreto"), cuerpo, Map.of())).isFalse();
        byte[] alterado = evento.replace("4490000", "100").getBytes(StandardCharsets.UTF_8);
        assertThat(wompi.firmaValida(wompi(secreto), alterado, Map.of())).isFalse();

        Pasarela.Evento e = wompi.leerEvento(cuerpo).orElseThrow();
        assertThat(e.referencia()).isEqualTo("LN1-ABC234-1");
        assertThat(e.resultado().estado()).isEqualTo(EstadoTransaccion.APROBADO);
        assertThat(e.resultado().monto()).isEqualTo(44_900);
        assertThat(e.resultado().medio()).isEqualTo("NEQUI");
    }

    @Test
    void wompiAvisaSiLasLlavesNoCoincidenConElAmbiente() {
        Credenciales pruebasConLlaveReal = new Credenciales(Proveedor.WOMPI, Credenciales.PRUEBAS, "pub_prod_abc", "", "i", "e");
        assertThat(wompi.faltante(pruebasConLlaveReal)).contains("producción");
        assertThat(wompi.faltante(wompi("e"))).isNull();
    }

    @Test
    void boldVerificaLaFirmaHmacDelCuerpoEnBase64() {
        String evento = """
                {"id":"e4f8","type":"SALE_APPROVED","subject":"F8A5","data":{"payment_id":"F8A5D6B7G2H1",
                "amount":{"total":32000},"payment_method":"PSE","metadata":{"reference":"LN7-QWE234-2"}}}""";
        byte[] cuerpo = evento.getBytes(StandardCharsets.UTF_8);
        String secreto = "llave-secreta-bold";
        String firma = Firmas.hmacSha256(secreto, Base64.getEncoder().encodeToString(cuerpo));
        Credenciales c = new Credenciales(Proveedor.BOLD, Credenciales.PRODUCCION, "identidad", "", "", secreto);

        assertThat(bold.firmaValida(c, cuerpo, Map.of("x-bold-signature", firma))).isTrue();
        assertThat(bold.firmaValida(c, cuerpo, Map.of("x-bold-signature", "00" + firma.substring(2)))).isFalse();
        assertThat(bold.firmaValida(c, cuerpo, Map.of())).isFalse();

        Pasarela.Evento e = bold.leerEvento(cuerpo).orElseThrow();
        assertThat(e.referencia()).isEqualTo("LN7-QWE234-2");
        assertThat(e.resultado().estado()).isEqualTo(EstadoTransaccion.APROBADO);
        assertThat(e.resultado().monto()).isEqualTo(32_000);
    }

    @Test
    void hmacConLlaveVaciaComoElAmbienteDePruebasDeBold() {
        // Vector conocido: HMAC-SHA256 con llave y mensaje vacíos.
        assertThat(Firmas.hmacSha256("", "")).isEqualTo("b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad");
    }

    @Test
    void comisionDeLaPlataforma() {
        var plataforma = new ConfigPagosService.Activa(Transaccion.PLATAFORMA, Proveedor.WOMPI, null, new BigDecimal("2.50"), 300);
        assertThat(plataforma.comision(50_000)).isEqualTo(1_550);
        assertThat(plataforma.comision(100)).isEqualTo(100); // nunca más que el pago
        var propia = new ConfigPagosService.Activa(Transaccion.PROPIA, Proveedor.WOMPI, null, new BigDecimal("2.50"), 300);
        assertThat(propia.comision(50_000)).isZero();
    }
}
