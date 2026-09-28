package co.leinei.api.web;

import co.leinei.api.config.TokenAuthFilter.AdminActual;
import co.leinei.api.dominio.EstadoPedido;
import co.leinei.api.servicio.PedidoService;
import co.leinei.api.servicio.ReporteService;
import co.leinei.api.web.dto.AdminDto;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminPedidoController {

    private final PedidoService pedidos;
    private final ReporteService reportes;

    public AdminPedidoController(PedidoService pedidos, ReporteService reportes) {
        this.pedidos = pedidos;
        this.reportes = reportes;
    }

    @GetMapping("/pedidos")
    public List<AdminDto.Pedido> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
            @RequestParam(required = false) EstadoPedido estado,
            @RequestParam(required = false) String q) {
        return pedidos.listar(fecha, estado, q);
    }

    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDto.Pedido crearManual(@AuthenticationPrincipal AdminActual admin,
                                       @Valid @RequestBody AdminDto.PedidoManualRequest req) {
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

    @GetMapping("/reportes/fechas")
    public List<LocalDate> fechas() {
        return reportes.fechas();
    }

    @GetMapping("/reportes/produccion")
    public AdminDto.Produccion produccion(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return reportes.produccion(fecha);
    }
}
