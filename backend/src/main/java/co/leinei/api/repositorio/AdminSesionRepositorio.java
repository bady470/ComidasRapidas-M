package co.leinei.api.repositorio;

import co.leinei.api.dominio.AdminSesion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface AdminSesionRepositorio extends JpaRepository<AdminSesion, Long> {

    Optional<AdminSesion> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from AdminSesion s where s.expira < :ahora")
    int borrarVencidas(Instant ahora);

    @Modifying
    @Query("delete from AdminSesion s where s.tokenHash = :hash")
    int borrarPorHash(String hash);
}
