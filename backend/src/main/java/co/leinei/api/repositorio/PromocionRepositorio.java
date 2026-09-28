package co.leinei.api.repositorio;

import co.leinei.api.dominio.Promocion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromocionRepositorio extends JpaRepository<Promocion, Long> {
    List<Promocion> findAllByOrderByIdAsc();
    List<Promocion> findByActivaTrue();
}
