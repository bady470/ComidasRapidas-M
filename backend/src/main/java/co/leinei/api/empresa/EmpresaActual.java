package co.leinei.api.empresa;

import java.util.Set;
import java.util.UUID;

/**
 * La empresa a la que va dirigida la petición actual, con su marca y sus módulos activos.
 * Se arma desde la base de control y se guarda en memoria unos segundos (ver RegistroEmpresas).
 */
public record EmpresaActual(
        long id,
        UUID uuid,
        String identificador,
        String estado,
        String nombreComercial,
        String colorPrimario,
        String colorSecundario,
        int logoVersion,
        boolean tieneLogo,
        String dominioPropio,
        Set<String> modulos) {

    public boolean activa() { return "activa".equals(estado); }

    public boolean tieneModulo(String codigo) { return modulos.contains(codigo); }

    /** Dirección pública del logo; cambia de versión al reemplazarlo para que el navegador no use el viejo. */
    public String logoUrl() {
        return tieneLogo ? "/api/plataforma/publico/empresas/" + identificador + "/logo?v=" + logoVersion : null;
    }
}
