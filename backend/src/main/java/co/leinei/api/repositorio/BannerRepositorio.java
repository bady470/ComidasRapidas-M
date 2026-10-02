package co.leinei.api.repositorio;

import co.leinei.api.dominio.Banner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BannerRepositorio extends JpaRepository<Banner, Long> {
    List<Banner> findAllByOrderByOrdenAscIdAsc();
    List<Banner> findByActivoTrueOrderByOrdenAscIdAsc();
}
