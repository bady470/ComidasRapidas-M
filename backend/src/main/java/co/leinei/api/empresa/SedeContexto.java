package co.leinei.api.empresa;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Sede escogida en la petición (encabezado «X-Sede» con el id de la sede):
 *  - En la tienda, la sede donde pide el cliente.
 *  - En el portal, el filtro «sede» de la barra (sin encabezado = todas las sedes).
 * Solo cuenta si la empresa tiene el módulo de sedes; lo valida SedeService.
 */
public final class SedeContexto {

    public static final String ENCABEZADO = "X-Sede";

    private static final ThreadLocal<Long> SEDE = new ThreadLocal<>();

    private SedeContexto() {}

    /** La sede pedida en esta petición (sin validar), o null. */
    public static Long pedida() { return SEDE.get(); }

    /** Para tareas fuera de una petición (o pruebas). */
    public static void establecer(Long sedeId) {
        if (sedeId == null) SEDE.remove(); else SEDE.set(sedeId);
    }

    /** Lee el encabezado en cada petición a /api/t/... y lo limpia al terminar. */
    public static class Filtro extends OncePerRequestFilter {
        @Override
        protected boolean shouldNotFilter(HttpServletRequest req) {
            return !req.getRequestURI().startsWith("/api/t/");
        }

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws ServletException, IOException {
            String valor = req.getHeader(ENCABEZADO);
            try {
                if (valor != null && valor.matches("\\d{1,18}")) SEDE.set(Long.parseLong(valor));
                chain.doFilter(req, res);
            } finally {
                SEDE.remove();
            }
        }
    }
}
