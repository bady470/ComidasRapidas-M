package co.leinei.api.dominio;

public enum MetodoPago {
    /** Transferencia a una de las cuentas de la tienda (Nequi, Daviplata, banco…). */
    CUENTA,
    EFECTIVO,
    /** Pasarela de pagos (Wompi, Bold…): el pago se confirma solo cuando la pasarela avisa. */
    EN_LINEA
}
