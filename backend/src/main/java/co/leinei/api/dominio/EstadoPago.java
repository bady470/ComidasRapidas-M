package co.leinei.api.dominio;

/**
 * PENDIENTE: nadie ha reportado el pago.
 * POR_CONFIRMAR: el cliente adjuntó el comprobante de la transferencia; la tienda debe revisarlo.
 * RECIBIDO: la tienda confirmó el pago.
 */
public enum EstadoPago { PENDIENTE, POR_CONFIRMAR, RECIBIDO }
