package co.leinei.api.pagos;

import java.util.Map;
import java.util.Optional;

/**
 * Una pasarela de pagos (Wompi, Bold…). Cada implementación sabe:
 *  - crear el cobro y devolver la dirección a la que se manda al cliente,
 *  - consultar el estado de un cobro (respaldo por si un aviso no llega),
 *  - leer y verificar la firma de los avisos (webhooks) que la pasarela envía.
 *
 * Agregar otra pasarela es agregar otra implementación; el resto de la plataforma no cambia.
 */
public interface Pasarela {

    Proveedor proveedor();

    /** Qué le falta a las credenciales para poder cobrar, o null si están completas. */
    String faltante(Credenciales c);

    /** Crea el cobro. retorno: página a la que vuelve el cliente al terminar de pagar. */
    Inicio iniciar(Credenciales c, String referencia, int monto, String descripcion, String retorno);

    /** Estado del cobro en la pasarela. Vacío si la pasarela todavía no sabe nada de él. */
    Optional<Resultado> consultar(Credenciales c, Transaccion t);

    /** Lee un aviso (sin verificar todavía): de qué referencia es y qué pasó. Vacío si no es un aviso de pago. */
    Optional<Evento> leerEvento(byte[] cuerpo);

    /** Verifica que el aviso lo firmó la pasarela con el secreto de esa cuenta. */
    boolean firmaValida(Credenciales c, byte[] cuerpo, Map<String, String> encabezados);

    /** Dirección a la que se manda al cliente para pagar; idExterno: id del cobro en la pasarela (si lo hay). */
    record Inicio(String url, String idExterno) {}

    /** monto: en pesos (null si la pasarela no lo informa). */
    record Resultado(EstadoTransaccion estado, String idTransaccion, Integer monto, String medio, String detalle) {}

    record Evento(String referencia, Resultado resultado) {}
}
