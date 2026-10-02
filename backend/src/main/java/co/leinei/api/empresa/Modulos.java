package co.leinei.api.empresa;

/** Códigos del catálogo de módulos (plataforma.tbl_modulos). */
public final class Modulos {

    private Modulos() {}

    /** Base: catálogo, pedidos, seguimiento y portal. Siempre activo. */
    public static final String TIENDA = "tienda";
    /** Tamaños, adiciones con precio, ingredientes para quitar. */
    public static final String OPCIONES = "opciones";
    public static final String PROMOCIONES = "promociones";
    /** Valor de domicilio por zona o barrio. */
    public static final String ZONAS = "zonas";
    /** Ventas, qué preparar, ganancia y pagos por cuenta. */
    public static final String REPORTES = "reportes";
    /** Registrar en el portal pedidos que llegan por WhatsApp o teléfono. */
    public static final String PEDIDO_MANUAL = "pedido_manual";
    /** Cobro con pasarela (Wompi, Bold) y confirmación automática del pago. */
    public static final String PAGOS_EN_LINEA = "pagos_en_linea";
    /** Cierre de caja del día: efectivo, transferencias, pagos en línea y lo que entrega cada domiciliario. */
    public static final String CAJA = "caja";
    /** Pantalla de cocina y comandas impresas. */
    public static final String COCINA = "cocina";
    /** Clientes frecuentes y recuperar a los que dejaron de pedir. */
    public static final String CLIENTES = "clientes";
    /** Domicilio según la distancia y domiciliario en vivo en el mapa. */
    public static final String MAPAS = "mapas";
}
