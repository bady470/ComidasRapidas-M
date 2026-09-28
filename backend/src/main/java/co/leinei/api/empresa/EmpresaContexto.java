package co.leinei.api.empresa;

import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * Empresa y usuario de la petición en curso (un valor por hilo). El filtro de empresa lo llena al
 * entrar la petición y lo limpia al salir; el DataSource enrutado lo usa para escoger la base.
 */
public final class EmpresaContexto {

    private static final ThreadLocal<EmpresaActual> EMPRESA = new ThreadLocal<>();
    private static final ThreadLocal<String> USUARIO = new ThreadLocal<>();

    private EmpresaContexto() {}

    public static void establecer(EmpresaActual empresa) { EMPRESA.set(empresa); }

    public static Optional<EmpresaActual> actual() { return Optional.ofNullable(EMPRESA.get()); }

    public static EmpresaActual requerida() {
        EmpresaActual e = EMPRESA.get();
        if (e == null) throw new IllegalStateException("No hay empresa en el contexto de esta petición");
        return e;
    }

    /** Quién está haciendo el cambio; queda en la auditoría de la base de la empresa. */
    public static void usuario(String usuario) { USUARIO.set(usuario); }

    public static String usuario() {
        String u = USUARIO.get();
        return u == null ? "cliente" : u;
    }

    public static void limpiar() {
        EMPRESA.remove();
        USUARIO.remove();
    }

    /** Ejecuta un bloque como si la petición fuera de otra empresa (para tareas del superadmin). */
    public static <T> T conEmpresa(EmpresaActual empresa, String usuario, Supplier<T> bloque) {
        EmpresaActual antes = EMPRESA.get();
        String usuarioAntes = USUARIO.get();
        try {
            EMPRESA.set(empresa);
            USUARIO.set(usuario);
            return bloque.get();
        } finally {
            if (antes == null) EMPRESA.remove(); else EMPRESA.set(antes);
            if (usuarioAntes == null) USUARIO.remove(); else USUARIO.set(usuarioAntes);
        }
    }

    /** Falla con un mensaje claro si el plan de la empresa no incluye el módulo. */
    public static void exigirModulo(String codigo, String nombre) {
        if (!requerida().tieneModulo(codigo)) {
            throw new ReglaNegocioException(HttpStatus.FORBIDDEN,
                    "Tu plan no incluye «" + nombre + "». Escríbele a tu proveedor para activarlo.");
        }
    }

    public static boolean tieneModulo(String codigo) {
        return actual().map(e -> e.tieneModulo(codigo)).orElse(false);
    }
}
