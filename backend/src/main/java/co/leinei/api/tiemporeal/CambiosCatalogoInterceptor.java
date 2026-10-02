package co.leinei.api.tiemporeal;

import co.leinei.api.empresa.EmpresaContexto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Cuando el administrador guarda algo de su tienda (productos, categorías, promociones, configuración, logo),
 * avisa a los clientes que tienen la tienda abierta para que vean el cambio sin recargar.
 * Los pedidos, avisos y sesiones tienen sus propios eventos y se excluyen aquí.
 */
public class CambiosCatalogoInterceptor implements HandlerInterceptor {

    private static final Pattern CATALOGO =
            Pattern.compile("^/api/t/[^/]+/admin/(productos|categorias|promociones|config|marca|archivos)(/.*)?$");

    private final TiempoReal tiempoReal;

    public CambiosCatalogoInterceptor(TiempoReal tiempoReal) {
        this.tiempoReal = tiempoReal;
    }

    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        if ("GET".equals(req.getMethod()) || ex != null || res.getStatus() >= 400) return;
        if (!CATALOGO.matcher(req.getRequestURI()).matches()) return;
        EmpresaContexto.actual().ifPresent(e -> tiempoReal.publicar("catalogo", Map.of(),
                TiempoReal.tienda(e.id()), TiempoReal.admin(e.id())));
    }
}
