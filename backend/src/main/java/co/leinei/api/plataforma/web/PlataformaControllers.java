package co.leinei.api.plataforma.web;

import co.leinei.api.config.TokenAuthFilter;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.plataforma.servicio.BibliotecaService;
import co.leinei.api.plataforma.servicio.ConfiguracionCorreoService;
import co.leinei.api.plataforma.servicio.CorreoService;
import co.leinei.api.plataforma.servicio.PlanesService;
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
        private final PlanesService planes;
        private final CorreoService correo;

        private final ConfiguracionCorreoService configCorreo;

        public Empresas(EmpresasService empresas, PlanesService planes, CorreoService correo, ConfiguracionCorreoService configCorreo) {
            this.configCorreo = configCorreo;
            this.empresas = empresas;
            this.planes = planes;
            this.correo = correo;
        }

        @GetMapping("/correo")
        public PlataformaDto.ConfigCorreo correo() { return configCorreo.ver(); }

        @PutMapping("/correo")
        public PlataformaDto.ConfigCorreo guardarCorreo(@Valid @RequestBody PlataformaDto.ConfigCorreoRequest req) {
            return configCorreo.guardar(req);
        }

        @PostMapping("/correo/prueba")
        public PlataformaDto.ResultadoPrueba pruebaCorreo(@Valid @RequestBody PlataformaDto.PruebaCorreoRequest req) {
            return correo.prueba(req.destino());
        }

        @GetMapping("/planes")
        public List<PlataformaDto.Plan> planes() { return planes.listar(); }

        @PostMapping("/planes")
        @ResponseStatus(HttpStatus.CREATED)
        public PlataformaDto.Plan crearPlan(@Valid @RequestBody PlataformaDto.PlanRequest req) { return planes.crear(req); }

        @PutMapping("/planes/{codigo}")
        public PlataformaDto.Plan actualizarPlan(@PathVariable String codigo, @Valid @RequestBody PlataformaDto.PlanRequest req) {
            return planes.actualizar(codigo, req);
        }

        @GetMapping("/modulos")
        public List<PlataformaDto.Modulo> modulos() { return empresas.modulos(); }

        @GetMapping("/resumen")
        public PlataformaDto.Resumen resumen() { return empresas.resumen(); }

        @GetMapping("/empresas")
        public List<PlataformaDto.EmpresaResumen> listar() { return empresas.listar(); }

        @PostMapping("/empresas")
        @ResponseStatus(HttpStatus.CREATED)
        public PlataformaDto.EmpresaCreada crear(@AuthenticationPrincipal SuperadminActual s,
                                                 @Valid @RequestBody PlataformaDto.CrearEmpresaRequest req) {
            PlataformaDto.EmpresaDetalle d = empresas.crear(req, s.usuario());
            // Después de guardar: si el correo falla la empresa queda creada igual y el panel lo avisa.
            String plan = planes.buscar(d.plan()).nombre();
            String resultado = correo.bienvenida(d.responsableCorreo(), d.responsableNombre(), d.nombreComercial(),
                    d.identificador(), d.dominioPropio(), req.adminUsuario().trim().toLowerCase(), req.adminClave(), plan, d.cicloFacturacion(), d.precioPlan());
            return new PlataformaDto.EmpresaCreada(d, resultado);
        }

        @GetMapping("/empresas/{uuid}")
        public PlataformaDto.EmpresaDetalle detalle(@PathVariable UUID uuid) { return empresas.detalle(uuid); }

        @PutMapping("/empresas/{uuid}")
        public PlataformaDto.EmpresaDetalle actualizar(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid,
                                                       @Valid @RequestBody PlataformaDto.ActualizarEmpresaRequest req) {
            String antes = empresas.detalle(uuid).dominioPropio();
            PlataformaDto.EmpresaDetalle d = empresas.actualizar(uuid, req, s.usuario());
            // Si se asignó o cambió el dominio, se le avisa al responsable (si el correo falla, el cambio ya quedó guardado).
            if (d.dominioPropio() != null && !d.dominioPropio().equalsIgnoreCase(antes == null ? "" : antes)) {
                correo.avisoDominio(d.responsableCorreo(), d.responsableNombre(), d.nombreComercial(), d.dominioPropio());
            }
            return d;
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

        @PostMapping("/empresas/{uuid}/biblioteca")
        public BibliotecaService.Resultado importarBiblioteca(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid,
                                                              @Valid @RequestBody PlataformaDto.ImportarBibliotecaRequest req) {
            return empresas.importarBiblioteca(uuid, req.slugs(), req.ajustePorcentaje(), s.usuario());
        }

        @PostMapping("/empresas/{uuid}/clave-admin")
        @ResponseStatus(HttpStatus.NO_CONTENT)
        public void claveAdmin(@AuthenticationPrincipal SuperadminActual s, @PathVariable UUID uuid,
                               @Valid @RequestBody PlataformaDto.ClaveAdminRequest req) {
            empresas.restablecerClaveAdmin(uuid, req.usuario(), req.nueva(), s.usuario());
        }
    }

    /** Biblioteca de productos precargados para asignar a las empresas. */
    @RestController
    @RequestMapping("/api/plataforma/biblioteca")
    public static class Biblioteca {
        private final BibliotecaService biblioteca;

        public Biblioteca(BibliotecaService biblioteca) { this.biblioteca = biblioteca; }

        @GetMapping
        public BibliotecaService.Biblioteca todo() { return biblioteca.todo(); }
    }

    /** Público: a qué empresa pertenece un dominio propio, y el logo de cada empresa. */
    @RestController
    @RequestMapping("/api/plataforma/publico")
    public static class Publico {
        private final RegistroEmpresas registro;
        private final MarcaService marca;

        private final BibliotecaService biblioteca;

        public Publico(RegistroEmpresas registro, MarcaService marca, BibliotecaService biblioteca) {
            this.registro = registro;
            this.marca = marca;
            this.biblioteca = biblioteca;
        }

        @GetMapping("/dominio")
        public PlataformaDto.Dominio dominio(@RequestParam String host) {
            return new PlataformaDto.Dominio(registro.identificadorPorDominio(host).orElse(null));
        }

        /** Ilustraciones de la biblioteca (públicas: es contenido de ejemplo y un <img> no envía el token). */
        @GetMapping("/biblioteca/imagenes/{nombre}")
        public ResponseEntity<byte[]> imagenBiblioteca(@PathVariable String nombre) {
            var img = biblioteca.imagen(nombre);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(img.tipoContenido()))
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                    .header("X-Content-Type-Options", "nosniff")
                    .body(img.datos());
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
