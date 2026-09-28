package co.leinei.api.repositorio;

import co.leinei.api.dominio.ZonaEnvio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ZonaEnvioRepositorio extends JpaRepository<ZonaEnvio, Long> {
    List<ZonaEnvio> findAllByOrderByOrdenAscIdAsc();
    List<ZonaEnvio> findByActivaTrueOrderByOrdenAscIdAsc();
}
