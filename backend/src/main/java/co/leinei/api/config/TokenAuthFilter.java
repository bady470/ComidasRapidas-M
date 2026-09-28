package co.leinei.api.config;

import co.leinei.api.dominio.AdminUsuario;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.plataforma.servicio.SuperadminAuthService;
import co.leinei.api.servicio.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Lee "Authorization: Bearer <token>" y reconoce dos tipos de usuario:
 * - Administrador de una empresa (/api/t/{empresa}/admin/**): el token se busca en la base de ESA empresa,
 *   así que un token de una empresa no sirve en otra.
 * - Superadmin (/api/plataforma/**): el token se busca en la base de control.
 */
public class TokenAuthFilter extends OncePerRequestFilter {

    private static final Pattern ADMIN_EMPRESA = Pattern.compile("^/api/t/[^/]+/admin/.*");

    private final AuthService auth;
    private final SuperadminAuthService superadmins;

    public TokenAuthFilter(AuthService auth, SuperadminAuthService superadmins) {
        this.auth = auth;
        this.superadmins = superadmins;
    }

    public record AdminActual(Long id, String usuario, String nombre) {}

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = extraerToken(req);
        if (token != null) {
            String ruta = req.getRequestURI();
            if (ADMIN_EMPRESA.matcher(ruta).matches() && EmpresaContexto.actual().isPresent()) {
                auth.validar(token).ifPresent((AdminUsuario u) -> {
                    EmpresaContexto.usuario(u.getUsuario());
                    autenticar(new AdminActual(u.getId(), u.getUsuario(), u.getNombre()), token, "ROLE_ADMIN");
                });
            } else if (ruta.startsWith("/api/plataforma/")) {
                superadmins.validar(token).ifPresent(s -> autenticar(s, token, "ROLE_SUPERADMIN"));
            }
        }
        chain.doFilter(req, res);
    }

    private static void autenticar(Object principal, String token, String rol) {
        var autenticacion = new UsernamePasswordAuthenticationToken(principal, token, List.of(new SimpleGrantedAuthority(rol)));
        SecurityContextHolder.getContext().setAuthentication(autenticacion);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String ruta = req.getRequestURI();
        return !(ruta.startsWith("/api/t/") || ruta.startsWith("/api/plataforma/"));
    }

    public static String extraerToken(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        return h != null && h.startsWith("Bearer ") ? h.substring(7).trim() : null;
    }
}
