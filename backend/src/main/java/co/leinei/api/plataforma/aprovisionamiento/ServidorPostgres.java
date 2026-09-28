package co.leinei.api.plataforma.aprovisionamiento;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Datos del servidor PostgreSQL donde viven la base de control, la plantilla y las bases de empresa,
 * con las credenciales OWNER de la plataforma. Solo las usan las migraciones y el aprovisionamiento;
 * la aplicación de cara al público trabaja con credenciales app sin permisos de estructura.
 *
 * @param parametros parámetros extra de la URL JDBC, ej. "sslmode=verify-full" en producción
 */
public record ServidorPostgres(String host, int puerto, String usuarioOwner, String claveOwner,
                               String baseControl, String basePlantilla, String parametros) {

    public String url(String base) {
        String url = "jdbc:postgresql://" + host + ":" + puerto + "/" + base;
        return parametros == null || parametros.isBlank() ? url : url + "?" + parametros;
    }

    /** Conexión owner a una base. Quien la pide la cierra. */
    public Connection conectarComoOwner(String base) throws SQLException {
        return DriverManager.getConnection(url(base), usuarioOwner, claveOwner);
    }
}
