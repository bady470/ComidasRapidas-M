package co.leinei.api.web;

import co.leinei.api.config.TokenAuthFilter.AdminActual;
import co.leinei.api.dominio.EstadoPedido;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.servicio.ArchivoService;
import co.leinei.api.servicio.AvisosService;
import co.leinei.api.servicio.DomiciliarioService;
import co.leinei.api.servicio.PedidoService;
import co.leinei.api.servicio.ReporteService;
import co.leinei.api.web.dto.AdminDto;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/t/{empresa}/admin")
public class AdminPedidoController {

    private final PedidoService pedidos;
    private final ReporteService reportes;
    private final DomiciliarioService domiciliarios;
    private final AvisosService avisos;

    public AdminPedidoController(PedidoService pedidos, ReporteService reportes, DomiciliarioService domiciliarios,
                                 AvisosService avisos) {
        this.pedidos = pedidos;
        this.reportes = reportes;
        this.domiciliarios = domiciliarios;
        this.avisos = avisos;
    }

    @GetMapping("/pedidos")
    public List<AdminDto.Pedido> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
            @RequestParam(required = false) EstadoPedido estado,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean porPagar) {
        return pedidos.listar(fecha, estado, q, porPagar);
    }

    /** Comprobante de pago que adjuntó el cliente. Solo lo ve el administrador (nunca se guarda en caché compartida). */
    @GetMapping("/pedidos/{id}/comprobante")
    public ResponseEntity<byte[]> comprobante(@PathVariable Long id) {
        ArchivoService.Imagen c = pedidos.comprobante(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(c.tipoContenido()))
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline; filename=comprobante-" + id + (c.tipoContenido().equals("application/pdf") ? ".pdf" : ""))
                .body(c.datos());
    }

    @PatchMapping("/pedidos/{id}/domiciliario")
    public AdminDto.Pedido domiciliario(@PathVariable Long id, @RequestBody AdminDto.AsignarDomiciliarioRequest req) {
        return pedidos.asignarDomiciliario(id, req.domiciliarioId());
    }

    // ---- Domiciliarios
    @GetMapping("/domiciliarios")
    public List<AdminDto.Domiciliario> domiciliarios() {
        return domiciliarios.listar();
    }

    @PostMapping("/domiciliarios")
    @ResponseStatus(HttpStatus.CREATED)
    public List<AdminDto.Domiciliario> crearDomiciliario(@Valid @RequestBody AdminDto.DomiciliarioRequest req) {
        return domiciliarios.guardar(null, req);
    }

    @PutMapping("/domiciliarios/{id}")
    public List<AdminDto.Domiciliario> editarDomiciliario(@PathVariable Long id, @Valid @RequestBody AdminDto.DomiciliarioRequest req) {
        return domiciliarios.guardar(id, req);
    }

    // ---- Avisos del portal
    @GetMapping("/avisos")
    public AdminDto.Avisos avisos() {
        return avisos.avisos();
    }

    @PostMapping("/avisos/leidos")
    public AdminDto.Avisos leidos(@Valid @RequestBody AdminDto.MarcarLeidasRequest req) {
        return avisos.marcarLeidas(req.hastaId());
    }

    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDto.Pedido crearManual(@AuthenticationPrincipal AdminActual admin,
                                       @Valid @RequestBody AdminDto.PedidoManualRequest req) {
        EmpresaContexto.exigirModulo(Modulos.PEDIDO_MANUAL, "Pedidos por WhatsApp");
        return pedidos.crearManual(req, admin.nombre());
    }

    @PatchMapping("/pedidos/{id}/estado")
    public AdminDto.Pedido cambiarEstado(@AuthenticationPrincipal AdminActual admin, @PathVariable Long id,
                                         @Valid @RequestBody AdminDto.CambiarEstadoRequest req) {
        return pedidos.cambiarEstado(id, req.estado(), req.nota(), admin.nombre());
    }

    @PatchMapping("/pedidos/{id}/pago")
    public AdminDto.Pedido cambiarPago(@PathVariable Long id, @Valid @RequestBody AdminDto.CambiarPagoRequest req) {
        return pedidos.cambiarPago(id, req.estadoPago());
    }

    /** Días con pedidos: lo usa el filtro de la lista de pedidos, por eso no depende del módulo de reportes. */
    @GetMapping("/reportes/fechas")
    public List<LocalDate> fechas() {
        return reportes.fechas();
    }

    @GetMapping("/reportes/produccion")
    public AdminDto.Produccion produccion(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        EmpresaContexto.exigirModulo(Modulos.REPORTES, "Ventas y reportes");
        return reportes.produccion(fecha);
    }
}
