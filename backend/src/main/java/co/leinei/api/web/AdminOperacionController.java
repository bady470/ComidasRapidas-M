package co.leinei.api.web;

import co.leinei.api.config.TokenAuthFilter.AdminActual;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.servicio.CajaService;
import co.leinei.api.servicio.ClientesService;
import co.leinei.api.servicio.ConfigService;
import co.leinei.api.servicio.EstadisticasService;
import co.leinei.api.web.dto.OperacionDto;
import co.leinei.api.web.dto.PublicoDto;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Portal: estadísticas, cierre de caja, cocina y comandas, clientes y modo «estamos llenos». */
@RestController
@RequestMapping("/api/t/{empresa}/admin")
public class AdminOperacionController {

    private final EstadisticasService estadisticas;
    private final CajaService caja;
    private final ConfigService config;
    private final ClientesService clientes;

    public AdminOperacionController(EstadisticasService estadisticas, CajaService caja, ConfigService config,
                                    ClientesService clientes) {
        this.clientes = clientes;
        this.estadisticas = estadisticas;
        this.caja = caja;
        this.config = config;
    }

    @GetMapping("/estadisticas")
    public OperacionDto.Estadisticas estadisticas(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
                                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        EmpresaContexto.exigirModulo(Modulos.REPORTES, "Ventas y reportes");
        return estadisticas.calcular(desde, hasta);
    }

    /** Sin fecha: el día de servicio actual. */
    @GetMapping("/caja")
    public OperacionDto.Caja caja(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        EmpresaContexto.exigirModulo(Modulos.CAJA, "Cierre de caja");
        return caja.ver(fecha != null ? fecha : config.disponibilidad().fechaServicio());
    }

    @PutMapping("/caja")
    public OperacionDto.Caja cerrarCaja(@AuthenticationPrincipal AdminActual admin,
                                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
                                        @Valid @RequestBody OperacionDto.CierreRequest req) {
        EmpresaContexto.exigirModulo(Modulos.CAJA, "Cierre de caja");
        return caja.cerrar(fecha, req, admin.nombre());
    }

    // ---- Cocina y comandas
    @GetMapping("/cocina/config")
    public OperacionDto.ConfigCocina cocina() {
        EmpresaContexto.exigirModulo(Modulos.COCINA, "Cocina y comandas");
        return config.cocina();
    }

    @PutMapping("/cocina/config")
    public OperacionDto.ConfigCocina guardarCocina(@Valid @RequestBody OperacionDto.ConfigCocina req) {
        EmpresaContexto.exigirModulo(Modulos.COCINA, "Cocina y comandas");
        return config.guardarCocina(req);
    }

    // ---- Clientes
    @GetMapping("/clientes")
    public OperacionDto.Clientes clientes() {
        EmpresaContexto.exigirModulo(Modulos.CLIENTES, "Recuperar clientes");
        return clientes.listar();
    }

    @PostMapping("/clientes/contactos")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void contacto(@AuthenticationPrincipal AdminActual admin, @Valid @RequestBody OperacionDto.ContactoRequest req) {
        EmpresaContexto.exigirModulo(Modulos.CLIENTES, "Recuperar clientes");
        clientes.registrarContacto(req, admin.nombre());
    }

    @PutMapping("/clientes/mensaje")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void mensaje(@Valid @RequestBody OperacionDto.MensajeRequest req) {
        EmpresaContexto.exigirModulo(Modulos.CLIENTES, "Recuperar clientes");
        clientes.guardarMensaje(req.mensaje());
    }

    @PostMapping("/saturacion")
    public PublicoDto.Saturacion saturacion(@Valid @RequestBody OperacionDto.SaturacionRequest req) {
        return config.cambiarSaturacion(req);
    }
}
