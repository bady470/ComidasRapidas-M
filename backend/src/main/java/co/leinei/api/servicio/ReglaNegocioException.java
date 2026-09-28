package co.leinei.api.servicio;

import org.springframework.http.HttpStatus;

/** Error con un mensaje claro para mostrar al usuario. */
public class ReglaNegocioException extends RuntimeException {

    private final HttpStatus estado;

    public ReglaNegocioException(HttpStatus estado, String mensaje) {
        super(mensaje);
        this.estado = estado;
    }

    public static ReglaNegocioException invalido(String mensaje) {
        return new ReglaNegocioException(HttpStatus.BAD_REQUEST, mensaje);
    }

    public static ReglaNegocioException noEncontrado(String mensaje) {
        return new ReglaNegocioException(HttpStatus.NOT_FOUND, mensaje);
    }

    public static ReglaNegocioException conflicto(String mensaje) {
        return new ReglaNegocioException(HttpStatus.CONFLICT, mensaje);
    }

    public HttpStatus getEstado() {
        return estado;
    }
}
