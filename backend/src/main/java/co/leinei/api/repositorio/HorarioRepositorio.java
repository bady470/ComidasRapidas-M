package co.leinei.api.repositorio;

import co.leinei.api.dominio.Horario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HorarioRepositorio extends JpaRepository<Horario, Long> {
    /** Horario de una sede (sin varias sedes, el de la principal). */
    List<Horario> findBySedeIdOrderByDiaAsc(Long sedeId);
    Optional<Horario> findBySedeIdAndDia(Long sedeId, short dia);
}
