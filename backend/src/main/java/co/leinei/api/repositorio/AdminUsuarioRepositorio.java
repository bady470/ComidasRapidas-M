package co.leinei.api.repositorio;

import co.leinei.api.dominio.AdminUsuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminUsuarioRepositorio extends JpaRepository<AdminUsuario, Long> {
    Optional<AdminUsuario> findByUsuarioIgnoreCase(String usuario);
}
