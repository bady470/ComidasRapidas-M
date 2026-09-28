package co.leinei.api.dominio;

public enum ModoPedido {
    /** Comidas rápidas, restaurantes: se pide cuando el local está abierto y se entrega en minutos. */
    INMEDIATO,
    /** Postres, tortas, mercados: se pide durante la semana y se entrega un día fijo. */
    PROGRAMADO
}
