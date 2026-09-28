package co.leinei.api.config;

import co.leinei.api.dominio.AdminUsuario;
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

/** Lee el encabezado "Authorization: Bearer <token>" y, si la sesión es válida, marca la petición como ADMIN. */
public class TokenAuthFilter extends OncePerRequestFilter {

    private final AuthService auth;

    public TokenAuthFilter(AuthService auth) {
        this.auth = auth;
    }

    public record AdminActual(Long id, String usuario, String nombre) {}

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = extraerToken(req);
        if (token != null) {
            auth.validar(token).ifPresent((AdminUsuario u) -> {
                var principal = new AdminActual(u.getId(), u.getUsuario(), u.getNombre());
                var autenticacion = new UsernamePasswordAuthenticationToken(principal, token,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                SecurityContextHolder.getContext().setAuthentication(autenticacion);
            });
        }
        chain.doFilter(req, res);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/admin/");
    }

    public static String extraerToken(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        return h != null && h.startsWith("Bearer ") ? h.substring(7).trim() : null;
    }
}
