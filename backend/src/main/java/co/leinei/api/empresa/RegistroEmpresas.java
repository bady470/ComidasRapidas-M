package co.leinei.api.empresa;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Consulta en la base de control quién es cada empresa (por identificador o por dominio propio),
 * con su marca y módulos. Guarda el resultado unos segundos para no ir a la base en cada petición.
 */
@Component
public class RegistroEmpresas {

    private static final long VIGENCIA_MS = 15_000;

    private record EnCache(Optional<EmpresaActual> empresa, long hasta) {}

    private final JdbcClient control;
    private final Map<String, EnCache> porIdentificador = new ConcurrentHashMap<>();

    public RegistroEmpresas(@Qualifier("controlJdbc") JdbcClient control) {
        this.control = control;
    }

    public Optional<EmpresaActual> porIdentificador(String identificador) {
        String clave = identificador.toLowerCase(Locale.ROOT);
        EnCache c = porIdentificador.get(clave);
        if (c != null && c.hasta() > System.currentTimeMillis()) return c.empresa();
        Optional<EmpresaActual> e = cargar("e.identificador = ?", clave);
        porIdentificador.put(clave, new EnCache(e, System.currentTimeMillis() + VIGENCIA_MS));
        return e;
    }

    public Optional<String> identificadorPorDominio(String dominio) {
        if (dominio == null || dominio.isBlank()) return Optional.empty();
        return control.sql("""
                        SELECT e.identificador FROM plataforma.tbl_empresas e
                        JOIN plataforma.tbl_empresas_marca m ON m.empresa_id = e.id
                        WHERE lower(m.dominio_propio) = lower(?) AND e.estado = 'activa'""")
                .param(dominio.trim())
                .query(String.class)
                .optional();
    }

    public Optional<EmpresaActual> porId(long id) {
        return cargar("e.id = ?", id);
    }

    /** Olvida lo guardado de una empresa (tras cambiar su marca, módulos o estado). */
    public void invalidar(String identificador) {
        if (identificador != null) porIdentificador.remove(identificador.toLowerCase(Locale.ROOT));
    }

    private Optional<EmpresaActual> cargar(String condicion, Object valor) {
        Optional<EmpresaActual> base = control.sql("""
                        SELECT e.id, e.uuid, e.identificador, e.estado, m.nombre_comercial, m.color_primario,
                               m.color_secundario, m.logo_version, (m.logo_datos IS NOT NULL) AS tiene_logo, m.dominio_propio
                        FROM plataforma.tbl_empresas e
                        JOIN plataforma.tbl_empresas_marca m ON m.empresa_id = e.id
                        WHERE\s""" + condicion) // \s: Java quita el espacio final de los bloques de texto
                .param(valor)
                .query((rs, n) -> new EmpresaActual(rs.getLong("id"), rs.getObject("uuid", UUID.class),
                        rs.getString("identificador"), rs.getString("estado"), rs.getString("nombre_comercial"),
                        rs.getString("color_primario"), rs.getString("color_secundario"), rs.getInt("logo_version"),
                        rs.getBoolean("tiene_logo"), rs.getString("dominio_propio"), Set.of()))
                .optional();
        return base.map(e -> {
            Set<String> modulos = new HashSet<>(control.sql("""
                            SELECT md.codigo FROM plataforma.tbl_empresa_modulos em
                            JOIN plataforma.tbl_modulos md ON md.id = em.modulo_id
                            WHERE em.empresa_id = ? AND (em.es_activo OR md.es_base)""")
                    .param(e.id())
                    .query(String.class)
                    .list());
            modulos.add(Modulos.TIENDA);
            return new EmpresaActual(e.id(), e.uuid(), e.identificador(), e.estado(), e.nombreComercial(),
                    e.colorPrimario(), e.colorSecundario(), e.logoVersion(), e.tieneLogo(), e.dominioPropio(),
                    Set.copyOf(modulos));
        });
    }
}
