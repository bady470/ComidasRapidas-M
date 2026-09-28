package co.leinei.api.empresa;

import co.leinei.api.plataforma.aprovisionamiento.CifradoClaves;
import co.leinei.api.plataforma.aprovisionamiento.ServidorPostgres;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.AbstractDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * DataSource de la tienda: entrega una conexión a la base de la empresa de la petición actual.
 *
 * - Cada empresa tiene su propio pool pequeño, creado la primera vez que se necesita, con el rol
 *   <b>app</b> de esa empresa (solo datos, sin estructura). Las credenciales salen cifradas de
 *   tbl_empresa_conexiones y se descifran en memoria.
 * - Así, aunque una consulta tuviera un error, nunca podría tocar la base de otra empresa.
 * - En cada préstamo se marca quién está usando la conexión, para la auditoría.
 *
 * En producción, con decenas o cientos de empresas, estos pools van detrás de un pooler en modo
 * transacción (PgBouncer o RDS Proxy); la aplicación no cambia.
 */
public class EnrutadorDataSource extends AbstractDataSource {

    private record Conexion(String host, int puerto, String base, String usuario, String claveCifrada) {}

    private final JdbcClient control;
    private final CifradoClaves cifrado;
    private final ServidorPostgres servidor;
    private final int maximoPorEmpresa;
    private final Map<Long, HikariDataSource> pools = new ConcurrentHashMap<>();

    public EnrutadorDataSource(JdbcClient control, CifradoClaves cifrado, ServidorPostgres servidor, int maximoPorEmpresa) {
        this.control = control;
        this.cifrado = cifrado;
        this.servidor = servidor;
        this.maximoPorEmpresa = Math.max(1, maximoPorEmpresa);
    }

    @Override
    public Connection getConnection() throws SQLException {
        EmpresaActual empresa = EmpresaContexto.actual()
                .orElseThrow(() -> new SQLException("No hay empresa en esta petición: no se sabe a qué base conectarse"));
        Connection c = pools.computeIfAbsent(empresa.id(), this::crearPool).getConnection();
        try (PreparedStatement ps = c.prepareStatement("SELECT set_config('leinei.usuario', ?, false)")) {
            ps.setString(1, EmpresaContexto.usuario());
            ps.execute();
        } catch (SQLException e) {
            c.close();
            throw e;
        }
        return c;
    }

    @Override
    public Connection getConnection(String usuario, String clave) throws SQLException {
        throw new UnsupportedOperationException("Las credenciales las escoge el enrutador según la empresa");
    }

    /** Cierra el pool de una empresa (al suspenderla o si cambian sus credenciales). */
    public void cerrar(long empresaId) {
        HikariDataSource ds = pools.remove(empresaId);
        if (ds != null) ds.close();
    }

    public void cerrarTodo() {
        pools.values().forEach(HikariDataSource::close);
        pools.clear();
    }

    private HikariDataSource crearPool(long empresaId) {
        Conexion k = control.sql("""
                        SELECT host, puerto, nombre_base, usuario_app, clave_app_cifrada
                        FROM plataforma.tbl_empresa_conexiones WHERE empresa_id = ?""")
                .param(empresaId)
                .query((rs, n) -> new Conexion(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getString(4), rs.getString(5)))
                .optional()
                .orElseThrow(() -> new IllegalStateException("La empresa " + empresaId + " todavía no tiene base asignada"));
        HikariConfig cfg = new HikariConfig();
        String url = "jdbc:postgresql://" + k.host() + ":" + k.puerto() + "/" + k.base();
        String parametros = servidor.parametros();
        cfg.setJdbcUrl(parametros == null || parametros.isBlank() ? url : url + "?" + parametros);
        cfg.setUsername(k.usuario());
        cfg.setPassword(cifrado.descifrar(k.claveCifrada()));
        cfg.setPoolName("empresa-" + empresaId);
        cfg.setMaximumPoolSize(maximoPorEmpresa);
        cfg.setMinimumIdle(0);
        cfg.setIdleTimeout(60_000);
        cfg.setMaxLifetime(30 * 60_000);
        cfg.setAutoCommit(true);
        return new HikariDataSource(cfg);
    }
}
