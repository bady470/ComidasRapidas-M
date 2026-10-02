package co.leinei.api.repositorio;

import co.leinei.api.dominio.ComprobantePago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ComprobantePagoRepositorio extends JpaRepository<ComprobantePago, Long> {

    Optional<ComprobantePago> findFirstByPedidoIdOrderByIdDesc(Long pedidoId);

    long countByPedidoId(Long pedidoId);

    /** Ids de pedidos (de la lista dada) que tienen al menos un comprobante. */
    @Query("select distinct c.pedidoId from ComprobantePago c where c.pedidoId in :ids")
    List<Long> pedidosConComprobante(@Param("ids") Collection<Long> ids);
}
