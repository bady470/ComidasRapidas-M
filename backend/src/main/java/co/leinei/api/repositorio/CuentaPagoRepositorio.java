package co.leinei.api.repositorio;

import co.leinei.api.dominio.CuentaPago;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CuentaPagoRepositorio extends JpaRepository<CuentaPago, Long> {
    List<CuentaPago> findAllByOrderByOrdenAscIdAsc();
    List<CuentaPago> findByActivaTrueOrderByOrdenAscIdAsc();
}
