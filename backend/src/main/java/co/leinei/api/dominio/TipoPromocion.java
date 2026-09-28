package co.leinei.api.dominio;

public enum TipoPromocion {
    /** N postres por un precio fijo (ej. 3 por $17.000). */
    COMBO,
    /** Porcentaje de descuento, con compra mínima opcional. */
    PORCENTAJE,
    /** Precio rebajado para un postre. */
    PRECIO_ESPECIAL,
    /** Domicilio gratis desde un monto mínimo. */
    ENVIO_GRATIS
}
