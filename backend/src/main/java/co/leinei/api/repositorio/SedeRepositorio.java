package co.leinei.api.repositorio;

import co.leinei.api.dominio.Sede;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SedeRepositorio extends JpaRepository<Sede, Long> {
    List<Sede> findAllByOrderByOrdenAscIdAsc();

    List<Sede> findByActivaTrueOrderByOrdenAscIdAsc();

    Optional<Sede> findFirstByPrincipalTrue();
}
