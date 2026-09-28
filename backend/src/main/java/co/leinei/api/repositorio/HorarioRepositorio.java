package co.leinei.api.repositorio;

import co.leinei.api.dominio.Horario;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HorarioRepositorio extends JpaRepository<Horario, Short> {
}
