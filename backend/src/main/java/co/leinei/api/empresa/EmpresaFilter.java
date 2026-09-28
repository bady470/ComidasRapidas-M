package co.leinei.api.empresa;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Para toda petición a /api/t/{empresa}/..., busca la empresa en la base de control y la deja en el
 * contexto antes de la seguridad y de los controladores. Si no existe o no está activa, responde sin
 * tocar ninguna base de empresa.
 */
public class EmpresaFilter extends OncePerRequestFilter {

    private static final Pattern RUTA = Pattern.compile("^/api/t/([^/]+)(/.*)?$");

    private final RegistroEmpresas registro;

    public EmpresaFilter(RegistroEmpresas registro) {
        this.registro = registro;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/t/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Matcher m = RUTA.matcher(req.getRequestURI());
        if (!m.matches()) {
            responder(res, 404, "Esta tienda no existe.");
            return;
        }
        Optional<EmpresaActual> empresa = registro.porIdentificador(m.group(1));
        if (empresa.isEmpty()) {
            responder(res, 404, "Esta tienda no existe.");
            return;
        }
        EmpresaActual e = empresa.get();
        switch (e.estado()) {
            case "activa" -> { }
            case "suspendida" -> { responder(res, 403, "Esta tienda está suspendida temporalmente."); return; }
            default -> { responder(res, 409, "Esta tienda se está preparando. Vuelve en unos minutos."); return; }
        }
        try {
            EmpresaContexto.establecer(e);
            chain.doFilter(req, res);
        } finally {
            EmpresaContexto.limpiar();
        }
    }

    private static void responder(HttpServletResponse res, int estado, String mensaje) throws IOException {
        res.setStatus(estado);
        res.setContentType("application/problem+json");
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.getWriter().write("{\"status\":" + estado + ",\"detail\":\"" + mensaje + "\"}");
    }
}
