package co.leinei.api.servicio;

import co.leinei.api.dominio.EstadoPago;
import co.leinei.api.dominio.EstadoPedido;
import co.leinei.api.dominio.Notificacion;
import co.leinei.api.dominio.Pedido;
import co.leinei.api.repositorio.NotificacionRepositorio;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.web.dto.AdminDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Avisos del portal (pedido nuevo, pago reportado) y conteo de pedidos sin pagar. */
@Service
public class AvisosService {

    private final NotificacionRepositorio notificaciones;
    private final PedidoRepositorio pedidos;

    private final TiempoReal tiempoReal;

    public AvisosService(NotificacionRepositorio notificaciones, PedidoRepositorio pedidos, TiempoReal tiempoReal) {
        this.tiempoReal = tiempoReal;
        this.notificaciones = notificaciones;
        this.pedidos = pedidos;
    }

    @Transactional(readOnly = true)
    public AdminDto.Avisos avisos() {
        List<Notificacion> ultimas = notificaciones.findAllByOrderByIdDesc(PageRequest.of(0, 30));
        Map<Long, String> codigos = pedidos.findAllById(ultimas.stream().map(Notificacion::getPedidoId)
                        .filter(java.util.Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(Pedido::getId, Pedido::getCodigo, (a, b) -> a));
        List<AdminDto.Notificacion> lista = ultimas.stream()
                .map(n -> new AdminDto.Notificacion(n.getId(), n.getTipo().name(), n.getPedidoId(),
                        n.getPedidoId() == null ? "" : codigos.getOrDefault(n.getPedidoId(), ""),
                        n.getTitulo(), n.getMensaje(), n.isLeida(), n.getCreado()))
                .toList();
        long porPagar = pedidos.countByPublicadoTrueAndEstadoPagoInAndEstadoNot(PedidoService.SIN_PAGAR, EstadoPedido.CANCELADO);
        long porConfirmar = pedidos.countByPublicadoTrueAndEstadoPagoInAndEstadoNot(List.of(EstadoPago.POR_CONFIRMAR), EstadoPedido.CANCELADO);
        return new AdminDto.Avisos(notificaciones.countByLeidaFalse(), porPagar, porConfirmar, lista);
    }

    @Transactional
    public AdminDto.Avisos marcarLeidas(long hastaId) {
        notificaciones.marcarLeidasHasta(hastaId);
        // Los demás administradores conectados ven el contador al día.
        tiempoReal.publicar("avisos", java.util.Map.of(), TiempoReal.admin(co.leinei.api.empresa.EmpresaContexto.requerida().id()));
        return avisos();
    }
}
