package co.leinei.api.plataforma.aprovisionamiento;

import co.leinei.api.config.LeineiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Antes de que la aplicación reciba peticiones: migra la base de control, sincroniza la plantilla,
 * migra todas las bases de empresa y crea el primer superadmin si no hay ninguno.
 * La base de control arranca sin empresas: se crean desde el panel de superadmin.
 */
@Component("arranquePlataforma")
public class ArranquePlataforma implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(ArranquePlataforma.class);

    private final ServidorPostgres servidor;
    private final LeineiProperties props;

    public ArranquePlataforma(ServidorPostgres servidor, LeineiProperties props) {
        this.servidor = servidor;
        this.props = props;
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        MigracionesPlataforma.Resumen r = new MigracionesPlataforma(servidor)
                .migrarTodo(props.plataforma().usuarioApp(), log::info);
        log.info("Migraciones listas: control {}, plantilla {}, {} empresas al día", r.control(), r.plantilla(), r.empresasMigradas());
        r.errores().forEach(e -> log.error("Empresa sin migrar: {}", e));
        crearSuperadminInicial();
    }

    private void crearSuperadminInicial() throws Exception {
        LeineiProperties.SuperadminInicial s = props.superadminInicial();
        try (Connection c = servidor.conectarComoOwner(servidor.baseControl())) {
            try (ResultSet rs = c.createStatement().executeQuery("SELECT count(*) FROM plataforma.tbl_superadmins")) {
                rs.next();
                if (rs.getLong(1) > 0) return;
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO plataforma.tbl_superadmins (usuario, nombre, clave_hash) VALUES (?, ?, ?)")) {
                ps.setString(1, s.usuario());
                ps.setString(2, s.nombre());
                ps.setString(3, new BCryptPasswordEncoder().encode(s.clave()));
                ps.executeUpdate();
            }
            log.info("Superadmin '{}' creado.", s.usuario());
            if ("cambia-esta-clave".equals(s.clave())) {
                log.warn("El superadmin usa la clave por defecto. Define SUPERADMIN_PASSWORD o cámbiala desde el panel.");
            }
        }
    }
}
