package co.leinei.api.repositorio;

import co.leinei.api.dominio.Notificacion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificacionRepositorio extends JpaRepository<Notificacion, Long> {

    List<Notificacion> findAllByOrderByIdDesc(Pageable pagina);

    long countByLeidaFalse();

    @Modifying
    @Query("update Notificacion n set n.leida = true where n.leida = false and n.id <= :hasta")
    int marcarLeidasHasta(@Param("hasta") Long hasta);
}
