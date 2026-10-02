package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.repositorio.DomiciliarioRepositorio;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.web.dto.MapaDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Página del domiciliario (/reparto/{token}): sus pedidos activos con la dirección y lo que debe cobrar, botones
 * «Salí» y «Entregado», y su ubicación, que su celular manda mientras tiene la página abierta. Con esa ubicación el
 * cliente lo ve acercarse en su seguimiento y el negocio lo ve en el mapa de domiciliarios.
 */
@Service
public class RepartoService {

    /** Asignados y sin entregar (puede asignarse apenas llega el pedido). */
    private static final List<EstadoPedido> ACTIVOS = List.of(EstadoPedido.NUEVO, EstadoPedido.CONFIRMADO, EstadoPedido.PREPARANDO, EstadoPedido.EN_CAMINO);

    private final DomiciliarioRepositorio domiciliarios;
    private final PedidoRepositorio pedidos;
    private final PedidoService pedidoService;
    private final ConfigService config;
    private final TiempoReal tiempoReal;

    public RepartoService(DomiciliarioRepositorio domiciliarios, PedidoRepositorio pedidos, PedidoService pedidoService,
                          ConfigService config, TiempoReal tiempoReal) {
        this.domiciliarios = domiciliarios;
        this.pedidos = pedidos;
        this.pedidoService = pedidoService;
        this.config = config;
        this.tiempoReal = tiempoReal;
    }

    @Transactional(readOnly = true)
    public MapaDto.Reparto ver(String token) {
        Domiciliario d = domiciliario(token);
        ConfigTienda c = config.tienda();
        List<MapaDto.PedidoReparto> lista = activos(d).stream().map(p -> new MapaDto.PedidoReparto(p.getCodigo(), p.getEstado(),
                p.getClienteNombre(), p.getClienteCelular(), p.getDireccion(), !p.getBarrio().isBlank() ? p.getBarrio() : p.getZona(),
                p.getReferencia(), p.getNotas(), p.getEntregaLat(), p.getEntregaLng(), p.getTotal(),
                p.getMetodoPago() == MetodoPago.EFECTIVO && p.getEstadoPago() != EstadoPago.RECIBIDO ? p.getTotal() : 0,
                p.getItems().stream().map(i -> i.getCantidad() + " × " + i.getNombre()).collect(Collectors.joining(", "))))
                .toList();
        return new MapaDto.Reparto(d.getNombre(), EmpresaContexto.requerida().nombreComercial(), c.getLocalLat(), c.getLocalLng(),
                c.isSeguimientoVivo(), lista);
    }

    /** El celular del domiciliario manda dónde está; se avisa al instante al portal y a los clientes que lo esperan. */
    @Transactional
    public void ubicar(String token, MapaDto.UbicacionRequest r) {
        Domiciliario d = domiciliario(token);
        d.ubicar(r.lat(), r.lng(), r.precision());
        long empresa = EmpresaContexto.requerida().id();
        String cuando = d.getUbicacionEn().toString();
        tiempoReal.publicar("ubicacion", Map.of("id", d.getId(), "lat", r.lat(), "lng", r.lng(), "t", cuando), TiempoReal.admin(empresa));
        if (!config.tienda().isSeguimientoVivo()) return;
        for (Pedido p : activos(d)) {
            if (p.getEstado() == EstadoPedido.EN_CAMINO) {
                tiempoReal.publicar("ubicacion", Map.of("lat", r.lat(), "lng", r.lng(), "t", cuando),
                        TiempoReal.pedido(empresa, p.getCodigo()));
            }
        }
    }

    /** «Salí con el pedido» (EN_CAMINO) o «Entregado» desde la página del domiciliario. */
    @Transactional
    public MapaDto.Reparto avanzar(String token, String codigo, EstadoPedido destino) {
        Domiciliario d = domiciliario(token);
        if (destino != EstadoPedido.EN_CAMINO && destino != EstadoPedido.ENTREGADO) {
            throw ReglaNegocioException.invalido("Solo puedes marcar «Salí» o «Entregado».");
        }
        Pedido p = activos(d).stream().filter(x -> x.getCodigo().equalsIgnoreCase(codigo)).findFirst()
                .orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese pedido ya no está asignado a ti."));
        pedidoService.cambiarEstado(p.getId(), destino, destino == EstadoPedido.ENTREGADO ? "Entregado por " + d.getNombre() : "",
                "domiciliario " + d.getNombre());
        return ver(token);
    }

    /** Pedidos en camino por domiciliario (para el mapa del portal). */
    @Transactional(readOnly = true)
    public Map<Long, Integer> enCaminoPorDomiciliario() {
        Map<Long, Integer> m = new HashMap<>();
        for (Domiciliario d : domiciliarios.findAll()) {
            int n = pedidos.findByDomiciliarioIdAndEstadoInOrderByCreadoAsc(d.getId(), List.of(EstadoPedido.EN_CAMINO)).size();
            if (n > 0) m.put(d.getId(), n);
        }
        return m;
    }

    private Domiciliario domiciliario(String token) {
        EmpresaContexto.exigirModulo(Modulos.MAPAS, "Mapas y domiciliario en vivo");
        return domiciliarios.findByToken(token == null ? "" : token.trim())
                .filter(Domiciliario::isActivo)
                .orElseThrow(() -> ReglaNegocioException.noEncontrado("Este link de reparto no existe o ya no sirve. Pídele uno nuevo al negocio."));
    }

    private List<Pedido> activos(Domiciliario d) {
        return pedidos.findByDomiciliarioIdAndEstadoInOrderByCreadoAsc(d.getId(), ACTIVOS).stream()
                .filter(p -> p.getTipoEntrega() == TipoEntrega.DOMICILIO).toList();
    }
}
