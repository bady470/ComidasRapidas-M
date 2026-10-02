package co.leinei.api.tiemporeal;

import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.servicio.PedidoService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Conexiones de tiempo real (text/event-stream). */
@RestController
public class EventosController {

    private final TiempoReal tiempoReal;
    private final PedidoService pedidos;

    public EventosController(TiempoReal tiempoReal, PedidoService pedidos) {
        this.tiempoReal = tiempoReal;
        this.pedidos = pedidos;
    }

    /** Tienda pública: avisa cuando cambia el catálogo, los precios, el horario o la marca. */
    @GetMapping(value = "/api/t/{empresa}/public/eventos", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter tienda() {
        return tiempoReal.suscribir(TiempoReal.tienda(EmpresaContexto.requerida().id()));
    }

    /** Seguimiento de un pedido: exige el código y el celular, igual que la consulta normal. */
    @GetMapping(value = "/api/t/{empresa}/public/pedidos/{codigo}/eventos", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter pedido(@PathVariable String codigo, @RequestParam String celular) {
        String real = pedidos.seguimiento(codigo, celular).codigo(); // falla con 404 si no coinciden
        return tiempoReal.suscribir(TiempoReal.pedido(EmpresaContexto.requerida().id(), real));
    }

    /** Portal de la empresa (requiere la sesión del administrador). */
    @GetMapping(value = "/api/t/{empresa}/admin/eventos", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter portal() {
        return tiempoReal.suscribir(TiempoReal.admin(EmpresaContexto.requerida().id()));
    }

    /** Superadmin: empresas y su aprovisionamiento. */
    @GetMapping(value = "/api/plataforma/eventos", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter plataforma() {
        return tiempoReal.suscribir(TiempoReal.PLATAFORMA);
    }
}
