package co.leinei.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

/** Propiedades bajo el prefijo {@code leinei} en application.yml. */
@ConfigurationProperties(prefix = "leinei")
public record LeineiProperties(
        String zonaHoraria,
        String corsOrigenes,
        int sesionHoras,
        Plataforma plataforma,
        SuperadminInicial superadminInicial
) {
    /**
     * Servidor PostgreSQL y credenciales.
     * owner: crea bases, roles y corre migraciones (solo lo usan el arranque y el aprovisionamiento).
     * app: con el que la aplicación lee y escribe la base de control (sin permisos de estructura).
     */
    public record Plataforma(String host, int puerto, String parametros,
                             String baseControl, String basePlantilla,
                             String usuarioOwner, String claveOwner,
                             String usuarioApp, String claveApp,
                             String llaveMaestra,
                             int poolPorEmpresa,
                             boolean aprovisionamientoHabilitado) {}

    /** Dueño de la plataforma que se crea la primera vez, si no existe ninguno. */
    public record SuperadminInicial(String usuario, String nombre, String clave) {}

    public List<String> listaOrigenes() {
        return Arrays.stream(corsOrigenes == null ? new String[0] : corsOrigenes.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
