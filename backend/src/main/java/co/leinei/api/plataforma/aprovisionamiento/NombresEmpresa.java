package co.leinei.api.plataforma.aprovisionamiento;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Nombres físicos derivados del identificador de una empresa.
 * El identificador solo admite minúsculas, números y guiones sueltos ("la-parrilla"), así que el cambio
 * de guion a guion bajo nunca produce dos empresas con la misma base o los mismos roles.
 */
public final class NombresEmpresa {

    private static final Pattern IDENTIFICADOR = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    /** Palabras que no pueden ser identificador porque chocan con rutas de la aplicación. */
    public static final Set<String> RESERVADOS = Set.of(
            "superadmin", "admin", "api", "plataforma", "assets", "static", "public", "publico",
            "login", "entrar", "seguimiento", "carrito", "pedido", "favicon", "index", "leinei");

    private final String identificador;

    public NombresEmpresa(String identificador) {
        if (!valido(identificador)) throw new IllegalArgumentException("Identificador de empresa inválido: " + identificador);
        this.identificador = identificador;
    }

    public static boolean valido(String identificador) {
        return identificador != null && identificador.length() >= 3 && identificador.length() <= 30
                && IDENTIFICADOR.matcher(identificador).matches() && !RESERVADOS.contains(identificador);
    }

    private String base() { return identificador.replace('-', '_'); }

    public String nombreBase() { return "db_cliente_" + base(); }

    public String rolOwner() { return "rl_" + base() + "_owner"; }

    public String rolApp() { return "rl_" + base() + "_app"; }

    public String rolLectura() { return "rl_" + base() + "_lectura"; }
}
