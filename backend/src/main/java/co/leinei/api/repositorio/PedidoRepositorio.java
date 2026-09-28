package co.leinei.api.repositorio;

import co.leinei.api.dominio.Pedido;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PedidoRepositorio extends JpaRepository<Pedido, Long> {

    boolean existsByCodigo(String codigo);

    @EntityGraph(attributePaths = "items")
    Optional<Pedido> findByCodigo(String codigo);

    @EntityGraph(attributePaths = "items")
    List<Pedido> findByFechaEntregaOrderByCreadoDesc(LocalDate fecha);

    @EntityGraph(attributePaths = "items")
    List<Pedido> findAllByOrderByCreadoDesc(Pageable pagina);

    @Query("select distinct p.fechaEntrega from Pedido p order by p.fechaEntrega desc")
    List<LocalDate> fechasConPedidos(Pageable pagina);
}
