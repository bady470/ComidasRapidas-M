package co.leinei.api.repositorio;

import co.leinei.api.dominio.Domiciliario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DomiciliarioRepositorio extends JpaRepository<Domiciliario, Long> {
    List<Domiciliario> findAllByOrderByActivoDescOrdenAscNombreAsc();

    /** Link personal de reparto. */
    Optional<Domiciliario> findByToken(String token);
}
