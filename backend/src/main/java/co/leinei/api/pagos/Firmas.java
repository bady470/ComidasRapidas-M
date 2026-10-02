package co.leinei.api.pagos;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

/** SHA-256, HMAC-SHA256 y comparación en tiempo constante para las firmas de las pasarelas. */
final class Firmas {

    private Firmas() {}

    static String sha256(String texto) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String hmacSha256(String secreto, String texto) {
        try {
            byte[] datos = texto.getBytes(StandardCharsets.UTF_8);
            // Java no acepta llaves vacías, y Bold firma con secreto vacío en su ambiente de pruebas.
            if (secreto.isEmpty()) return HexFormat.of().formatHex(hmacConLlaveVacia(datos));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(datos));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** HMAC con llave vacía según RFC 2104: la llave se rellena con ceros hasta el tamaño de bloque. */
    private static byte[] hmacConLlaveVacia(byte[] datos) throws Exception {
        byte[] ipad = new byte[64];
        byte[] opad = new byte[64];
        for (int i = 0; i < 64; i++) { ipad[i] = 0x36; opad[i] = 0x5c; }
        MessageDigest interno = MessageDigest.getInstance("SHA-256");
        interno.update(ipad);
        interno.update(datos);
        byte[] h = interno.digest();
        MessageDigest externo = MessageDigest.getInstance("SHA-256");
        externo.update(opad);
        externo.update(h);
        return externo.digest();
    }

    /** Compara dos firmas en hexadecimal sin filtrar por tiempo cuántos caracteres coinciden. */
    static boolean iguales(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8),
                b.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }
}
