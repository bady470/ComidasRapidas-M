package co.leinei.api.pagos;

/** La pasarela no respondió o respondió con un error. El mensaje se puede mostrar tal cual. */
public class PasarelaException extends RuntimeException {

    public PasarelaException(String mensaje) {
        super(mensaje);
    }

    public PasarelaException(String mensaje, Throwable causa) {
        super(mensaje, causa);
    }
}
