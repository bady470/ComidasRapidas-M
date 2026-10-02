package co.leinei.api.pagos;

/** Estado de un intento de pago en línea (plataforma.tbl_transacciones_pago). */
public enum EstadoTransaccion {
    /** Se creó el cobro; el cliente todavía no termina de pagar. */
    PENDIENTE,
    APROBADO,
    RECHAZADO,
    /** La pasarela reversó un pago que estaba aprobado. */
    ANULADO,
    ERROR,
    /** El cliente nunca pagó y el cobro venció. */
    VENCIDO;

    public boolean terminado() { return this != PENDIENTE; }
}
