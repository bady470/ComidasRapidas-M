package co.leinei.api.dominio;

import java.util.List;

public enum EstadoPedido {
    NUEVO, CONFIRMADO, PREPARANDO, EN_CAMINO, LISTO, ENTREGADO, CANCELADO;

    private static final List<EstadoPedido> FLUJO_DOMICILIO = List.of(NUEVO, CONFIRMADO, PREPARANDO, EN_CAMINO, ENTREGADO);
    private static final List<EstadoPedido> FLUJO_RECOGER = List.of(NUEVO, CONFIRMADO, PREPARANDO, LISTO, ENTREGADO);

    /** Orden normal de un pedido según cómo se entrega. CANCELADO queda por fuera. */
    public static List<EstadoPedido> flujo(TipoEntrega tipo) {
        return tipo == TipoEntrega.RECOGER ? FLUJO_RECOGER : FLUJO_DOMICILIO;
    }

    /** Texto que ve el cliente en el seguimiento. */
    public String mensaje(TipoEntrega tipo) {
        return switch (this) {
            case NUEVO -> "Pedido recibido";
            case CONFIRMADO -> "Pedido confirmado";
            case PREPARANDO -> "Preparando tu pedido";
            case EN_CAMINO -> "Tu pedido salió a domicilio";
            case LISTO -> "Tu pedido está listo para recoger";
            case ENTREGADO -> tipo == TipoEntrega.RECOGER ? "Pedido recogido" : "Pedido entregado";
            case CANCELADO -> "Pedido cancelado";
        };
    }

    /**
     * Reglas: avanzar en el flujo de su tipo de entrega (se pueden saltar pasos),
     * cancelar mientras no esté entregado y reabrir un cancelado como NUEVO.
     */
    public boolean puedePasarA(EstadoPedido destino, TipoEntrega tipo) {
        if (this == destino) return false;
        if (this == CANCELADO) return destino == NUEVO;
        if (destino == CANCELADO) return this != ENTREGADO;
        List<EstadoPedido> flujo = flujo(tipo);
        return flujo.contains(destino) && flujo.indexOf(destino) > flujo.indexOf(this);
    }
}
