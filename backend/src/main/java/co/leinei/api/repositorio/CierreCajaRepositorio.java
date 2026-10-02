package co.leinei.api.repositorio;

import co.leinei.api.dominio.CierreCaja;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CierreCajaRepositorio extends JpaRepository<CierreCaja, Long> {

    Optional<CierreCaja> findByFecha(LocalDate fecha);

    @Query("select c.fecha from CierreCaja c order by c.fecha desc")
    List<LocalDate> fechasCerradas(Pageable pagina);
}
