package co.leinei.api.repositorio;

import co.leinei.api.dominio.Domiciliario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DomiciliarioRepositorio extends JpaRepository<Domiciliario, Long> {
    List<Domiciliario> findAllByOrderByActivoDescOrdenAscNombreAsc();
}
