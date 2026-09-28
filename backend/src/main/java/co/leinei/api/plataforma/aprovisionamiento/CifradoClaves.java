package co.leinei.api.plataforma.aprovisionamiento;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifra las credenciales de cada base de empresa antes de guardarlas en la base de control.
 * AES-256-GCM con una llave maestra que llega por variable de entorno (LEINEI_LLAVE_MAESTRA) y nunca
 * se guarda en la base. En producción esta llave, o las credenciales completas, deberían vivir en un
 * gestor de secretos.
 */
public final class CifradoClaves {

    private static final String PREFIJO = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom AZAR = new SecureRandom();
    private static final char[] ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".toCharArray();

    private final SecretKeySpec llave;

    public CifradoClaves(String llaveMaestra) {
        if (llaveMaestra == null || llaveMaestra.length() < 16) {
            throw new IllegalArgumentException("La llave maestra debe tener al menos 16 caracteres (LEINEI_LLAVE_MAESTRA).");
        }
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(llaveMaestra.getBytes(StandardCharsets.UTF_8));
            this.llave = new SecretKeySpec(bytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public String cifrar(String texto) {
        try {
            byte[] iv = new byte[IV_BYTES];
            AZAR.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, llave, new GCMParameterSpec(TAG_BITS, iv));
            byte[] cifrado = c.doFinal(texto.getBytes(StandardCharsets.UTF_8));
            byte[] todo = new byte[iv.length + cifrado.length];
            System.arraycopy(iv, 0, todo, 0, iv.length);
            System.arraycopy(cifrado, 0, todo, iv.length, cifrado.length);
            return PREFIJO + Base64.getEncoder().encodeToString(todo);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo cifrar la credencial", e);
        }
    }

    public String descifrar(String guardado) {
        if (guardado == null || !guardado.startsWith(PREFIJO)) {
            throw new IllegalArgumentException("Credencial con formato desconocido");
        }
        try {
            byte[] todo = Base64.getDecoder().decode(guardado.substring(PREFIJO.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, llave, new GCMParameterSpec(TAG_BITS, todo, 0, IV_BYTES));
            return new String(c.doFinal(todo, IV_BYTES, todo.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo descifrar la credencial. ¿Cambió LEINEI_LLAVE_MAESTRA?", e);
        }
    }

    /** Clave aleatoria de 32 caracteres, solo letras y números (segura para usar dentro de SQL). */
    public static String claveAleatoria() {
        StringBuilder sb = new StringBuilder(32);
        for (int i = 0; i < 32; i++) sb.append(ALFABETO[AZAR.nextInt(ALFABETO.length)]);
        return sb.toString();
    }
}
