package co.leinei.api.repositorio;

import co.leinei.api.dominio.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoriaRepositorio extends JpaRepository<Categoria, Long> {
    List<Categoria> findAllByOrderByOrdenAscIdAsc();
}
