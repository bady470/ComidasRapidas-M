package co.leinei.api.plataforma.web;

import co.leinei.api.config.TokenAuthFilter;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.plataforma.servicio.EmpresasService;
import co.leinei.api.plataforma.servicio.MarcaService;
import co.leinei.api.plataforma.servicio.SuperadminAuthService;
import co.leinei.api.plataforma.servicio.SuperadminAuthService.SuperadminActual;
import co.leinei.api.servicio.ReglaNegocioException;
import co.leinei.api.web.dto.AdminDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

/** API del superadmin (/api/plataforma/**) y lo poco que la plataforma expone al público. */
public final class PlataformaControllers {

    private PlataformaControllers() {}

    @RestController
    @RequestMapping("/api/plataforma/auth")
    public static class Auth {
        private final SuperadminAuthService auth;

        public Auth(SuperadminAuthService auth) { this.auth = auth; }

        @PostMapping("/login")
        public PlataformaDto.Sesion login(@Valid @RequestBody AdminDto.LoginRequest req) {
            return auth.login(req.usuario(), req.clave());
        }

        @PostMapping("/logout")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void logout(HttpServletRequest req) {
            auth.logout(TokenAuthFilter.extraerToken(req));
        }

        @GetMapping("/yo")
        public PlataformaDto.Superadmin yo(@AuthenticationPrincipal SuperadminActual s) {
            return new PlataformaDto.Superadmin(s.uuid(), s.usuario(), s.nombre());
        }

        @PostMapping("/clave")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void clave(@AuthenticationPrincipal SuperadminActual s, @Valid @RequestBody AdminDto.CambiarClaveRequest req) {
            auth.cambiarClave(s.id(), req.actual(), req.nueva());
        }

        @GetMapping("/superadmins")
        public List<PlataformaDto.Superadmin> superadmins() {
            return auth.listar();
        }

        @PostMapping("/superadmins")
        @ResponseStatus(HttpStatus.CREATED)
        public PlataformaDto.Superadmin crear(@Valid @RequestBody PlataformaDto.NuevoSuperadminRequest req) {
            return auth.crear(req);
        }
    }

    @RestController
    @RequestMapping("/api/plataforma")
    public static class Empresas {
        private final EmpresasService empresas;

        public Empresas(EmpresasService empresas) { this.empresas = empresas; }

        @GetMapping("/modulos")
        public List<PlataformaDto.Modulo> modulos() { return empresas.modulos(); }

        @GetMapping("/resumen")
        public PlataformaDto.Resumen resumen() { return empresas.resumen(); }

        @GetMapping("/empresas")
        public List<PlataformaDto.EmpresaResumen> listar() { return empresas.listar(); }

        @PostMapping("/empresas")
        @ResponseStatus(HttpStatus.CREATED)
        public PlataformaDto.EmpresaDetalle crear(@AuthenticationPrincipal SuperadminActual s,
                                                  @Valid @RequestBody PlataformaDto.CrearEmpresaRequest req) {
            return empresas.crear(req, s.usuario());
        }

        @GetMapping("/empresas/{uuid}")
        public PlataformaDto.EmpresaDetalle detalle(@PathVariable UUID uuid) { return empresas.detalle(uuid); }

        @PutMapping("/empresas/{uuid}")
        public PlataformaDto.EmpresaDetalle actualizar(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid,
                                                       @Valid @RequestBody PlataformaDto.ActualizarEmpresaRequest req) {
            return empresas.actualizar(uuid, req, s.usuario());
        }

        @PostMapping(value = "/empresas/{uuid}/logo", consumes = "multipart/form-data")
        public PlataformaDto.EmpresaDetalle logo(@PathVariable UUID uuid, @RequestParam("archivo") MultipartFile archivo) throws IOException {
            return empresas.subirLogo(uuid, archivo.getBytes());
        }

        @DeleteMapping("/empresas/{uuid}/logo")
        public PlataformaDto.EmpresaDetalle quitarLogo(@PathVariable UUID uuid) { return empresas.quitarLogo(uuid); }

        @PutMapping("/empresas/{uuid}/modulos")
        public PlataformaDto.EmpresaDetalle modulos(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid,
                                                    @Valid @RequestBody PlataformaDto.ModulosRequest req) {
            return empresas.modulos(uuid, req.modulos(), s.usuario());
        }

        @PostMapping("/empresas/{uuid}/suspender")
        public PlataformaDto.EmpresaDetalle suspender(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid) {
            return empresas.cambiarEstado(uuid, false, s.usuario());
        }

        @PostMapping("/empresas/{uuid}/activar")
        public PlataformaDto.EmpresaDetalle activar(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid) {
            return empresas.cambiarEstado(uuid, true, s.usuario());
        }

        @PostMapping("/empresas/{uuid}/reintentar")
        public PlataformaDto.EmpresaDetalle reintentar(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid) {
            return empresas.reintentar(uuid, s.usuario());
        }

        @PostMapping("/empresas/{uuid}/clave-admin")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void claveAdmin(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid,
                               @Valid @RequestBody PlataformaDto.ClaveAdminRequest req) {
            empresas.restablecerClaveAdmin(uuid, req.usuario(), req.nueva(), s.usuario());
        }
    }

    /** Público: a qué empresa pertenece un dominio propio, y el logo de cada empresa. */
    @RestController
    @RequestMapping("/api/plataforma/publico")
    public static class Publico {
        private final RegistroEmpresas registro;
        private final MarcaService marca;

        public Publico(RegistroEmpresas registro, MarcaService marca) {
            this.registro = registro;
            this.marca = marca;
        }

        @GetMapping("/dominio")
        public PlataformaDto.Dominio dominio(@RequestParam String host) {
            return new PlataformaDto.Dominio(registro.identificadorPorDominio(host).orElse(null));
        }

        @GetMapping("/empresas/{identificador}/logo")
        public ResponseEntity<byte[]> logo(@PathVariable String identificador) {
            var img = marca.logo(identificador).orElseThrow(() -> ReglaNegocioException.noEncontrado("Esta empresa no tiene logo."));
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(img.tipoContenido()))
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                    .header("X-Content-Type-Options", "nosniff")
                    .body(img.datos());
        }
    }
}
