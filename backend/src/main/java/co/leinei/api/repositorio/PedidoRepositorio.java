package co.leinei.api.repositorio;

import co.leinei.api.dominio.EstadoPago;
import co.leinei.api.dominio.EstadoPedido;
import co.leinei.api.dominio.Pedido;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PedidoRepositorio extends JpaRepository<Pedido, Long> {

    boolean existsByCodigo(String codigo);

    @EntityGraph(attributePaths = {"items", "domiciliario"})
    Optional<Pedido> findByCodigo(String codigo);

    @EntityGraph(attributePaths = {"items", "domiciliario"})
    List<Pedido> findByFechaEntregaOrderByCreadoDesc(LocalDate fecha);

    @EntityGraph(attributePaths = {"items", "domiciliario"})
    List<Pedido> findAllByOrderByCreadoDesc(Pageable pagina);

    /** Pedidos sin pagar de cualquier día (no cancelados): nunca se pierden de vista. */
    @EntityGraph(attributePaths = {"items", "domiciliario"})
    List<Pedido> findByEstadoPagoInAndEstadoNotOrderByCreadoDesc(Collection<EstadoPago> pagos, EstadoPedido estado);

    long countByEstadoPagoInAndEstadoNot(Collection<EstadoPago> pagos, EstadoPedido estado);

    @Query("select distinct p.fechaEntrega from Pedido p order by p.fechaEntrega desc")
    List<LocalDate> fechasConPedidos(Pageable pagina);

    /** Pedidos activos de un domiciliario (su página de reparto), los más viejos primero. */
    @EntityGraph(attributePaths = {"items", "domiciliario"})
    List<Pedido> findByDomiciliarioIdAndEstadoInOrderByCreadoAsc(Long domiciliarioId, Collection<EstadoPedido> estados);

    /** Pedidos de un rango de días (estadísticas). */
    @EntityGraph(attributePaths = {"items"})
    List<Pedido> findByFechaEntregaBetween(LocalDate desde, LocalDate hasta);

    /** Primer día en que pidió cada cliente (para saber cuáles son nuevos). Filas: [celular, fecha]. */
    @Query("""
            select p.clienteCelular, min(p.fechaEntrega) from Pedido p
            where p.estado <> co.leinei.api.dominio.EstadoPedido.CANCELADO and p.clienteCelular in :celulares
            group by p.clienteCelular""")
    List<Object[]> primerPedido(@org.springframework.data.repository.query.Param("celulares") Collection<String> celulares);
}
