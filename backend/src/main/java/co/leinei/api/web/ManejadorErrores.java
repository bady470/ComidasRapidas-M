package co.leinei.api.web;

import co.leinei.api.servicio.ReglaNegocioException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

/** Convierte los errores en respuestas {status, title, detail, errores} que el frontend muestra tal cual. */
@RestControllerAdvice
public class ManejadorErrores {

    private static final Logger log = LoggerFactory.getLogger(ManejadorErrores.class);

    @ExceptionHandler(ReglaNegocioException.class)
    public ProblemDetail regla(ReglaNegocioException e) {
        return ProblemDetail.forStatusAndDetail(e.getEstado(), e.getMessage());
    }

    /** La pasarela de pagos no respondió o rechazó la solicitud: el mensaje ya es para el usuario. */
    @ExceptionHandler(co.leinei.api.pagos.PasarelaException.class)
    public ProblemDetail pasarela(co.leinei.api.pagos.PasarelaException e) {
        log.warn("Pasarela de pagos: {}", e.getMessage(), e.getCause());
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail validacion(MethodArgumentNotValidException e) {
        Map<String, String> errores = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> errores.putIfAbsent(f.getField(), f.getDefaultMessage()));
        String primero = errores.values().stream().findFirst().orElse("Revisa los datos del formulario.");
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, primero);
        pd.setProperty("errores", errores);
        return pd;
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ProblemDetail archivoGrande(Exception e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE, "El archivo es demasiado pesado. Las fotos del menú pueden pesar hasta 2 MB y los comprobantes hasta 5 MB.");
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ProblemDetail validacionMetodo(HandlerMethodValidationException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Revisa los datos enviados.");
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            org.springframework.web.multipart.support.MissingServletRequestPartException.class})
    public ProblemDetail malFormado(Exception e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "La solicitud tiene datos inválidos.");
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail inesperado(Exception e) {
        if (e instanceof org.springframework.web.ErrorResponse er) {
            return er.getBody(); // errores propios de Spring MVC (404, 405, 415...) con su código correcto
        }
        log.error("Error inesperado", e);
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Algo salió mal de nuestro lado. Intenta de nuevo en un momento.");
    }
}
