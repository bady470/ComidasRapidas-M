package co.leinei.api.servicio;

import co.leinei.api.dominio.Archivo;
import co.leinei.api.repositorio.ArchivoRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

/**
 * Guarda el logo y las fotos de los productos. Solo acepta PNG, JPG y WebP de hasta 2 MB,
 * y revisa los primeros bytes del archivo en lugar de confiar en la extensión.
 */
@Service
public class ArchivoService {

    public static final int MAXIMO_BYTES = 2 * 1024 * 1024;

    public record Imagen(byte[] datos, String tipoContenido) {}

    private final ArchivoRepositorio repo;

    public ArchivoService(ArchivoRepositorio repo) {
        this.repo = repo;
    }

    @Transactional
    public Archivo guardarImagen(byte[] datos) {
        if (datos == null || datos.length == 0) throw ReglaNegocioException.invalido("El archivo está vacío.");
        if (datos.length > MAXIMO_BYTES) throw ReglaNegocioException.invalido("La imagen pesa más de 2 MB. Usa una más liviana.");
        String tipo = tipoDe(datos);
        if (tipo == null) throw ReglaNegocioException.invalido("Solo se aceptan imágenes PNG, JPG o WebP.");
        Archivo a = new Archivo();
        a.setTipoContenido(tipo);
        a.setDatos(datos);
        return repo.save(a);
    }

    @Transactional(readOnly = true)
    public Imagen leer(Long id) {
        Archivo a = repo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("La imagen no existe."));
        return new Imagen(a.getDatos(), a.getTipoContenido());
    }

    static String tipoDe(byte[] b) {
        if (empieza(b, 0x89, 'P', 'N', 'G')) return "image/png";
        if (empieza(b, 0xFF, 0xD8, 0xFF)) return "image/jpeg";
        if (b.length > 12 && empieza(b, 'R', 'I', 'F', 'F')
                && Arrays.equals(Arrays.copyOfRange(b, 8, 12), "WEBP".getBytes())) return "image/webp";
        return null;
    }

    private static boolean empieza(byte[] b, int... firma) {
        if (b.length < firma.length) return false;
        for (int i = 0; i < firma.length; i++) if ((b[i] & 0xFF) != firma[i]) return false;
        return true;
    }
}
