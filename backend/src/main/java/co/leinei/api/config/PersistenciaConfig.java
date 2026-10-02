package co.leinei.api.config;

import co.leinei.api.empresa.EmpresaFilter;
import co.leinei.api.empresa.EnrutadorDataSource;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.plataforma.aprovisionamiento.CifradoClaves;
import co.leinei.api.plataforma.aprovisionamiento.ServidorPostgres;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

/**
 * Dos mundos de datos:
 * - Base de control (JdbcClient "controlJdbc", transacciones "controlTx"): empresas, marca, módulos, superadmins.
 * - Base de cada empresa (JPA sobre el DataSource enrutado, @Primary): catálogo, pedidos, configuración.
 */
@Configuration
public class PersistenciaConfig {

    private static final Logger log = LoggerFactory.getLogger(PersistenciaConfig.class);

    @Bean
    public ServidorPostgres servidorPostgres(LeineiProperties props) {
        LeineiProperties.Plataforma p = props.plataforma();
        return new ServidorPostgres(p.host(), p.puerto(), p.usuarioOwner(), p.claveOwner(), p.baseControl(),
                p.basePlantilla(), p.parametros());
    }

    @Bean
    public CifradoClaves cifradoClaves(LeineiProperties props) {
        String llave = props.plataforma().llaveMaestra();
        if ("solo-para-desarrollo-cambiala".equals(llave)) {
            log.warn("Se está usando la llave maestra de desarrollo. Define LEINEI_LLAVE_MAESTRA antes de crear empresas reales.");
        }
        return new CifradoClaves(llave);
    }

    /** Conexión de la aplicación a la base de control (usuario app si se configuró; si no, el owner). */
    @Bean(destroyMethod = "close")
    @DependsOn("arranquePlataforma") // primero migraciones, después cualquier consulta
    public HikariDataSource controlDataSource(LeineiProperties props, ServidorPostgres servidor) {
        LeineiProperties.Plataforma p = props.plataforma();
        boolean conApp = p.usuarioApp() != null && !p.usuarioApp().isBlank();
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(servidor.url(p.baseControl()));
        cfg.setUsername(conApp ? p.usuarioApp() : p.usuarioOwner());
        cfg.setPassword(conApp ? p.claveApp() : p.claveOwner());
        cfg.setPoolName("control");
        cfg.setMaximumPoolSize(6);
        cfg.setMinimumIdle(1);
        cfg.setInitializationFailTimeout(-1); // la base puede no existir aún en el primer arranque
        return new HikariDataSource(cfg);
    }

    @Bean
    public JdbcClient controlJdbc(@Qualifier("controlDataSource") DataSource ds) {
        return JdbcClient.create(ds);
    }

    @Bean
    public PlatformTransactionManager controlTx(@Qualifier("controlDataSource") DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }

    /**
     * DataSource de las entidades JPA: enruta a la base de la empresa de la petición.
     * Recibe el DataSource de control (no el bean JdbcClient): Spring Boot hace que los beans JdbcClient
     * esperen a los inicializadores de bases, y eso formaba un ciclo con este DataSource.
     */
    @Bean(destroyMethod = "cerrarTodo")
    @Primary
    public EnrutadorDataSource dataSource(@Qualifier("controlDataSource") DataSource control, CifradoClaves cifrado,
                                          ServidorPostgres servidor, LeineiProperties props) {
        return new EnrutadorDataSource(JdbcClient.create(control), cifrado, servidor, props.plataforma().poolPorEmpresa());
    }

    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(EntityManagerFactory emf) {
        return new JpaTransactionManager(emf);
    }

    /** El filtro de empresa corre antes que la seguridad: el token de un admin se valida en la base de SU empresa. */
    @Bean
    public FilterRegistrationBean<EmpresaFilter> filtroEmpresa(RegistroEmpresas registro) {
        FilterRegistrationBean<EmpresaFilter> r = new FilterRegistrationBean<>(new EmpresaFilter(registro));
        r.setOrder(-200);
        r.addUrlPatterns("/api/t/*");
        return r;
    }

    /** Sede escogida en la petición (encabezado X-Sede), para las empresas con varias sedes. */
    @Bean
    public FilterRegistrationBean<co.leinei.api.empresa.SedeContexto.Filtro> filtroSede() {
        FilterRegistrationBean<co.leinei.api.empresa.SedeContexto.Filtro> r = new FilterRegistrationBean<>(new co.leinei.api.empresa.SedeContexto.Filtro());
        r.setOrder(-190);
        r.addUrlPatterns("/api/t/*");
        return r;
    }
}
