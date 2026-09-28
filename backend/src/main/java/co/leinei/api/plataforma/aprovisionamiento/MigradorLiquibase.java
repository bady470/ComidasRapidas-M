package co.leinei.api.plataforma.aprovisionamiento;

import liquibase.Scope;
import liquibase.command.CommandScope;
import liquibase.command.core.UpdateCommandStep;
import liquibase.command.core.helpers.DbUrlConnectionArgumentsCommandStep;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;

/**
 * Aplica un changelog de Liquibase sobre una conexión. Liquibase es la única fuente de verdad de la
 * estructura: guarda sus tablas de control en el esquema "plataforma" de cada base.
 */
public final class MigradorLiquibase {

    public static final String CHANGELOG_CONTROL = "db/changelog/control/master.yaml";
    public static final String CHANGELOG_EMPRESA = "db/changelog/empresa/master.yaml";
    private static final String ESQUEMA_LIQUIBASE = "plataforma";

    private MigradorLiquibase() {}

    /** Aplica lo que falte del changelog y devuelve el id del último changeset aplicado. */
    public static String migrar(Connection conexion, String changelog) throws Exception {
        conexion.setAutoCommit(true);
        try (Statement st = conexion.createStatement()) {
            st.execute("CREATE SCHEMA IF NOT EXISTS " + ESQUEMA_LIQUIBASE);
        }
        Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(conexion));
        database.setLiquibaseSchemaName(ESQUEMA_LIQUIBASE);
        database.setDefaultSchemaName(ESQUEMA_LIQUIBASE);
        Map<String, Object> alcance = Map.of(Scope.Attr.resourceAccessor.name(),
                new ClassLoaderResourceAccessor(MigradorLiquibase.class.getClassLoader()));
        try {
            Scope.child(alcance, () -> new CommandScope(UpdateCommandStep.COMMAND_NAME)
                    .addArgumentValue(DbUrlConnectionArgumentsCommandStep.DATABASE_ARG, database)
                    .addArgumentValue(UpdateCommandStep.CHANGELOG_FILE_ARG, changelog)
                    .execute());
        } finally {
            // Liquibase deja la conexión sin autocommit: se restaura para que lo que siga (CREATE DATABASE,
            // permisos, registro de versión) no quede en una transacción abierta que se pierde al cerrar.
            if (!conexion.getAutoCommit()) {
                conexion.commit();
                conexion.setAutoCommit(true);
            }
        }
        return ultimaMigracion(conexion);
    }

    /** Id del último changeset aplicado en la base, o "" si no tiene ninguno. */
    public static String ultimaMigracion(Connection conexion) throws SQLException {
        try (Statement st = conexion.createStatement();
             ResultSet rs = st.executeQuery("SELECT id FROM " + ESQUEMA_LIQUIBASE
                     + ".databasechangelog ORDER BY orderexecuted DESC LIMIT 1")) {
            return rs.next() ? rs.getString(1) : "";
        }
    }
}
