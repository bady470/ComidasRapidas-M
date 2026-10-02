package co.leinei.api.repositorio;

import co.leinei.api.dominio.ProductoSede;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductoSedeRepositorio extends JpaRepository<ProductoSede, Long> {
    List<ProductoSede> findBySedeId(Long sedeId);

    List<ProductoSede> findByProductoId(Long productoId);

    Optional<ProductoSede> findByProductoIdAndSedeId(Long productoId, Long sedeId);
}
