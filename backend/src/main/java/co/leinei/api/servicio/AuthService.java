package co.leinei.api.servicio;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.dominio.AdminSesion;
import co.leinei.api.dominio.AdminUsuario;
import co.leinei.api.repositorio.AdminSesionRepositorio;
import co.leinei.api.repositorio.AdminUsuarioRepositorio;
import co.leinei.api.web.dto.AdminDto;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Sesiones del panel de administración con tokens aleatorios.
 * En la base de datos solo se guarda el hash del token, así que una copia de la base no permite entrar.
 */
@Service
public class AuthService {

    private static final SecureRandom AZAR = new SecureRandom();

    private final AdminUsuarioRepositorio usuarios;
    private final AdminSesionRepositorio sesiones;
    private final PasswordEncoder encoder;
    private final Clock reloj;
    private final Duration duracion;

    public AuthService(AdminUsuarioRepositorio usuarios, AdminSesionRepositorio sesiones, PasswordEncoder encoder,
                       Clock reloj, LeineiProperties props) {
        this.usuarios = usuarios;
        this.sesiones = sesiones;
        this.encoder = encoder;
        this.reloj = reloj;
        this.duracion = Duration.ofHours(props.sesionHoras() > 0 ? props.sesionHoras() : 12);
    }

    @Transactional
    public AdminDto.Sesion login(String usuario, String clave) {
        AdminUsuario u = usuarios.findByUsuarioIgnoreCase(usuario.trim())
                .filter(AdminUsuario::isActivo)
                .filter(x -> encoder.matches(clave, x.getClaveHash()))
                .orElseThrow(() -> new ReglaNegocioException(HttpStatus.UNAUTHORIZED, "Usuario o clave incorrectos."));
        Instant ahora = reloj.instant();
        sesiones.borrarVencidas(ahora);

        byte[] bytes = new byte[32];
        AZAR.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        AdminSesion s = new AdminSesion();
        s.setAdmin(u);
        s.setTokenHash(hash(token));
        s.setExpira(ahora.plus(duracion));
        sesiones.save(s);
        return new AdminDto.Sesion(token, u.getNombre(), u.getUsuario(), s.getExpira());
    }

    @Transactional(readOnly = true)
    public Optional<AdminUsuario> validar(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        Instant ahora = reloj.instant();
        return sesiones.findByTokenHash(hash(token))
                .filter(s -> s.getExpira().isAfter(ahora))
                .map(AdminSesion::getAdmin)
                .filter(AdminUsuario::isActivo);
    }

    @Transactional
    public void logout(String token) {
        if (token != null) sesiones.borrarPorHash(hash(token));
    }

    @Transactional
    public void cambiarClave(Long adminId, String actual, String nueva) {
        AdminUsuario u = usuarios.findById(adminId).orElseThrow();
        if (!encoder.matches(actual, u.getClaveHash())) {
            throw ReglaNegocioException.invalido("La clave actual no es correcta.");
        }
        u.setClaveHash(encoder.encode(nueva));
    }

    @Transactional
    public AdminDto.Yo crearAdmin(String usuario, String nombre, String clave) {
        String u = usuario.trim().toLowerCase(java.util.Locale.ROOT);
        if (usuarios.findByUsuarioIgnoreCase(u).isPresent()) {
            throw ReglaNegocioException.conflicto("Ya existe un administrador con el usuario " + u + ".");
        }
        AdminUsuario a = new AdminUsuario();
        a.setUsuario(u);
        a.setNombre(nombre.trim());
        a.setClaveHash(encoder.encode(clave));
        a = usuarios.save(a);
        return new AdminDto.Yo(a.getId(), a.getUsuario(), a.getNombre());
    }

    /** El superadmin le asigna una clave nueva a un administrador de la empresa (y cierra sus sesiones). */
    @Transactional
    public void restablecerClave(String usuario, String nueva) {
        AdminUsuario u = usuarios.findByUsuarioIgnoreCase(usuario.trim())
                .orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa empresa no tiene un administrador «" + usuario + "»."));
        u.setClaveHash(encoder.encode(nueva));
        u.setActivo(true);
        sesiones.findAll().stream().filter(s -> s.getAdmin().getId().equals(u.getId())).forEach(sesiones::delete);
    }

    @Transactional(readOnly = true)
    public java.util.List<AdminDto.Yo> listarAdmins() {
        return usuarios.findAll().stream().filter(AdminUsuario::isActivo)
                .map(a -> new AdminDto.Yo(a.getId(), a.getUsuario(), a.getNombre())).toList();
    }

    public static String hash(String token) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
