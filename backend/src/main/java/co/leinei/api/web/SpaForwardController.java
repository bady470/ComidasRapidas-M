package co.leinei.api.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Reenvía las rutas de navegación del frontend Angular (ej. /admin/pedidos, /pedido/P-1234)
 * a index.html para que el enrutador del navegador las resuelva. Las rutas ya mapeadas por
 * otros controladores (/api/**) y los archivos estáticos (con extensión) no pasan por aquí.
 */
@Controller
public class SpaForwardController {

    @RequestMapping({ "/{path:[^.]*}", "/**/{path:[^.]*}" })
    public String reenviarAlIndex() {
        return "forward:/index.html";
    }
}
