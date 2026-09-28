package co.leinei.api.repositorio;

import co.leinei.api.dominio.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductoRepositorio extends JpaRepository<Producto, Long> {
    List<Producto> findAllByOrderByOrdenAscIdAsc();
    boolean existsBySlug(String slug);
    boolean existsByImagenId(Long imagenId);
}
