package co.leinei.api.repositorio;

import co.leinei.api.dominio.Horario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HorarioRepositorio extends JpaRepository<Horario, Long> {
    List<Horario> findAllByOrderByDiaAsc();
    Optional<Horario> findByDia(short dia);
}
