package co.leinei.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

/** Propiedades bajo el prefijo {@code leinei} en application.yml. */
@ConfigurationProperties(prefix = "leinei")
public record LeineiProperties(
        String zonaHoraria,
        String corsOrigenes,
        AdminInicial adminInicial,
        int sesionHoras
) {
    public record AdminInicial(String usuario, String nombre, String clave) {}

    public List<String> listaOrigenes() {
        return Arrays.stream(corsOrigenes == null ? new String[0] : corsOrigenes.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
