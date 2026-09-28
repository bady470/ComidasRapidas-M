package co.leinei.api.web;

import co.leinei.api.config.TokenAuthFilter;
import co.leinei.api.config.TokenAuthFilter.AdminActual;
import co.leinei.api.servicio.AuthService;
import co.leinei.api.web.dto.AdminDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private final AuthService auth;

    public AdminAuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public AdminDto.Sesion login(@Valid @RequestBody AdminDto.LoginRequest req) {
        return auth.login(req.usuario(), req.clave());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest req) {
        auth.logout(TokenAuthFilter.extraerToken(req));
    }

    @GetMapping("/yo")
    public AdminDto.Yo yo(@AuthenticationPrincipal AdminActual admin) {
        return new AdminDto.Yo(admin.id(), admin.usuario(), admin.nombre());
    }

    @PostMapping("/clave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarClave(@AuthenticationPrincipal AdminActual admin,
                             @Valid @RequestBody AdminDto.CambiarClaveRequest req) {
        auth.cambiarClave(admin.id(), req.actual(), req.nueva());
    }

    @GetMapping("/usuarios")
    public java.util.List<AdminDto.Yo> administradores() {
        return auth.listarAdmins();
    }

    /** Un administrador puede crear otro (por ejemplo, la cuenta de Leidi). */
    @PostMapping("/usuarios")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDto.Yo crearAdmin(@Valid @RequestBody AdminDto.NuevoAdminRequest req) {
        return auth.crearAdmin(req.usuario(), req.nombre(), req.clave());
    }
}
