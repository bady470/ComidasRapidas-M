package co.leinei.api.pagos;

import java.time.Instant;
import java.util.UUID;

/** Un intento de pago en línea (fila de plataforma.tbl_transacciones_pago). */
public record Transaccion(
        long id,
        UUID uuid,
        long empresaId,
        String referencia,
        String codigoPedido,
        Proveedor proveedor,
        /** PROPIA o PLATAFORMA: con qué cuenta se cobró. */
        String modalidad,
        String ambiente,
        int monto,
        EstadoTransaccion estado,
        String idExterno,
        String idTransaccion,
        String medio,
        String detalle,
        int comision,
        int neto,
        /** NO_APLICA, POR_LIQUIDAR o LIQUIDADO. */
        String liquidacion,
        Instant liquidadoEn,
        String liquidadoPor,
        String notaLiquidacion,
        Instant aprobadoEn,
        Instant aplicadoEn,
        Instant consultadoEn,
        Instant creadoEn,
        Instant actualizadoEn) {

    public static final String PROPIA = "PROPIA";
    public static final String PLATAFORMA = "PLATAFORMA";
}
