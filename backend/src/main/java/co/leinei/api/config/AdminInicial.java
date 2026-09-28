package co.leinei.api.config;

import co.leinei.api.dominio.AdminUsuario;
import co.leinei.api.repositorio.AdminUsuarioRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Crea el primer administrador al arrancar, solo si todavía no hay ninguno. */
@Component
public class AdminInicial implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInicial.class);

    private final AdminUsuarioRepositorio usuarios;
    private final PasswordEncoder encoder;
    private final LeineiProperties props;

    public AdminInicial(AdminUsuarioRepositorio usuarios, PasswordEncoder encoder, LeineiProperties props) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (usuarios.count() > 0) return;
        LeineiProperties.AdminInicial a = props.adminInicial();
        AdminUsuario u = new AdminUsuario();
        u.setUsuario(a.usuario());
        u.setNombre(a.nombre());
        u.setClaveHash(encoder.encode(a.clave()));
        usuarios.save(u);
        log.info("Administrador '{}' creado.", a.usuario());
        if ("cambia-esta-clave".equals(a.clave())) {
            log.warn("El administrador usa la clave por defecto. Define ADMIN_PASSWORD o cámbiala desde el panel.");
        }
    }
}
