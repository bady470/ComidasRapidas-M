package co.leinei.api.pagos;

import co.leinei.api.servicio.ReglaNegocioException;

import java.util.Locale;

/** Pasarelas de pago soportadas. */
public enum Proveedor {
    WOMPI("Wompi", "Nequi, PSE, tarjeta o Botón Bancolombia"),
    BOLD("Bold", "Nequi, PSE, tarjeta o Botón Bancolombia");

    private final String nombre;
    private final String medios;

    Proveedor(String nombre, String medios) {
        this.nombre = nombre;
        this.medios = medios;
    }

    public String nombre() { return nombre; }

    /** Cómo puede pagar el cliente (texto para la tienda). */
    public String medios() { return medios; }

    /** Código de la ruta (/pagos/wompi/eventos). */
    public String ruta() { return name().toLowerCase(Locale.ROOT); }

    public static Proveedor deRuta(String ruta) {
        for (Proveedor p : values()) if (p.ruta().equalsIgnoreCase(ruta)) return p;
        throw ReglaNegocioException.noEncontrado("Pasarela desconocida.");
    }
}
