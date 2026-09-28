package co.leinei.api.plataforma.servicio;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.plataforma.web.PlataformaDto;
import co.leinei.api.servicio.AuthService;
import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/** Sesiones del superadmin, guardadas en la base de control (solo el hash del token). */
@Service
public class SuperadminAuthService {

    public record SuperadminActual(long id, UUID uuid, String usuario, String nombre) {}

    private record Fila(long id, UUID uuid, String usuario, String nombre, String claveHash, boolean activo) {}

    private static final SecureRandom AZAR = new SecureRandom();

    private final JdbcClient control;
    private final PasswordEncoder encoder;
    private final Clock reloj;
    private final Duration duracion;

    public SuperadminAuthService(@Qualifier("controlJdbc") JdbcClient control, PasswordEncoder encoder, Clock reloj,
                                 LeineiProperties props) {
        this.control = control;
        this.encoder = encoder;
        this.reloj = reloj;
        this.duracion = Duration.ofHours(props.sesionHoras() > 0 ? props.sesionHoras() : 12);
    }

    @Transactional("controlTx")
    public PlataformaDto.Sesion login(String usuario, String clave) {
        Fila f = buscar(usuario)
                .filter(Fila::activo)
                .filter(x -> encoder.matches(clave, x.claveHash()))
                .orElseThrow(() -> new ReglaNegocioException(HttpStatus.UNAUTHORIZED, "Usuario o clave incorrectos."));
        Instant ahora = reloj.instant();
        control.sql("DELETE FROM plataforma.tbl_superadmin_sesiones WHERE expira_en < ?").param(Timestamp.from(ahora)).update();
        byte[] bytes = new byte[32];
        AZAR.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expira = ahora.plus(duracion);
        control.sql("INSERT INTO plataforma.tbl_superadmin_sesiones (token_hash, superadmin_id, expira_en) VALUES (?, ?, ?)")
                .params(AuthService.hash(token), f.id(), Timestamp.from(expira))
                .update();
        return new PlataformaDto.Sesion(token, f.nombre(), f.usuario(), expira);
    }

    @Transactional(value = "controlTx", readOnly = true)
    public Optional<SuperadminActual> validar(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return control.sql("""
                        SELECT s.id, s.uuid, s.usuario, s.nombre FROM plataforma.tbl_superadmin_sesiones x
                        JOIN plataforma.tbl_superadmins s ON s.id = x.superadmin_id
                        WHERE x.token_hash = ? AND x.expira_en > ? AND s.es_activo""")
                .params(AuthService.hash(token), Timestamp.from(reloj.instant()))
                .query((rs, n) -> new SuperadminActual(rs.getLong(1), rs.getObject(2, UUID.class), rs.getString(3), rs.getString(4)))
                .optional();
    }

    @Transactional("controlTx")
    public void logout(String token) {
        if (token != null) control.sql("DELETE FROM plataforma.tbl_superadmin_sesiones WHERE token_hash = ?").param(AuthService.hash(token)).update();
    }

    @Transactional("controlTx")
    public void cambiarClave(long id, String actual, String nueva) {
        String hash = control.sql("SELECT clave_hash FROM plataforma.tbl_superadmins WHERE id = ?").param(id).query(String.class).single();
        if (!encoder.matches(actual, hash)) throw ReglaNegocioException.invalido("La clave actual no es correcta.");
        if (nueva == null || nueva.length() < 10) throw ReglaNegocioException.invalido("La clave nueva debe tener al menos 10 caracteres.");
        control.sql("UPDATE plataforma.tbl_superadmins SET clave_hash = ? WHERE id = ?").params(encoder.encode(nueva), id).update();
    }

    @Transactional(value = "controlTx", readOnly = true)
    public List<PlataformaDto.Superadmin> listar() {
        return control.sql("SELECT uuid, usuario, nombre FROM plataforma.tbl_superadmins WHERE es_activo ORDER BY id")
                .query((rs, n) -> new PlataformaDto.Superadmin(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)))
                .list();
    }

    @Transactional("controlTx")
    public PlataformaDto.Superadmin crear(PlataformaDto.NuevoSuperadminRequest r) {
        String usuario = r.usuario().trim().toLowerCase(Locale.ROOT);
        if (buscar(usuario).isPresent()) throw ReglaNegocioException.conflicto("Ya existe un superadmin con el usuario " + usuario + ".");
        UUID uuid = control.sql("INSERT INTO plataforma.tbl_superadmins (usuario, nombre, clave_hash) VALUES (?, ?, ?) RETURNING uuid")
                .params(usuario, r.nombre().trim(), encoder.encode(r.clave()))
                .query(UUID.class).single();
        return new PlataformaDto.Superadmin(uuid, usuario, r.nombre().trim());
    }

    private Optional<Fila> buscar(String usuario) {
        return control.sql("SELECT id, uuid, usuario, nombre, clave_hash, es_activo FROM plataforma.tbl_superadmins WHERE lower(usuario) = lower(?)")
                .param(usuario.trim())
                .query((rs, n) -> new Fila(rs.getLong(1), rs.getObject(2, UUID.class), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getBoolean(6)))
                .optional();
    }
}
