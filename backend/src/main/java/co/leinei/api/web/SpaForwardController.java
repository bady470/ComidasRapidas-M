package co.leinei.api.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Reenvía las rutas de navegación del frontend Angular (ej. /la-parrilla/carrito, /la-parrilla/admin/pedidos,
 * /superadmin/empresas/…) a index.html para que el enrutador del navegador las resuelva.
 * Nunca captura /api/** ni archivos con extensión (.js, .css, .png…).
 *
 * Nota: Spring 6+ no admite "**" en medio de un patrón, por eso se listan los niveles de profundidad.
 */
@Controller
public class SpaForwardController {

    private static final String PRIMERO = "{a:(?!api$)[^.]*}";

    @GetMapping({
            "/" + PRIMERO,
            "/" + PRIMERO + "/{b:[^.]*}",
            "/" + PRIMERO + "/{b:[^.]*}/{c:[^.]*}",
            "/" + PRIMERO + "/{b:[^.]*}/{c:[^.]*}/{d:[^.]*}",
            "/" + PRIMERO + "/{b:[^.]*}/{c:[^.]*}/{d:[^.]*}/{e:[^.]*}"})
    public String reenviarAlIndex() {
        return "forward:/index.html";
    }
}
