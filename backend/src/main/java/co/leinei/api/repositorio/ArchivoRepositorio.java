package co.leinei.api.repositorio;

import co.leinei.api.dominio.Archivo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArchivoRepositorio extends JpaRepository<Archivo, Long> {
}
