package co.leinei.api.plataforma.servicio;

import co.leinei.api.plataforma.web.PlataformaDto;
import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Planes comerciales: cuánto cuestan (mensual y anual) y qué módulos incluyen. */
@Service
public class PlanesService {

    private final JdbcClient control;

    public PlanesService(@Qualifier("controlJdbc") JdbcClient control) {
        this.control = control;
    }

    @Transactional(value = "controlTx", readOnly = true)
    public List<PlataformaDto.Plan> listar() {
        return control.sql("""
                        SELECT codigo, nombre, descripcion, precio_mensual, precio_anual, modulos, es_activo
                        FROM plataforma.tbl_planes ORDER BY orden, id""")
                .query((rs, n) -> new PlataformaDto.Plan(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4),
                        rs.getInt(5), partir(rs.getString(6)), rs.getBoolean(7)))
                .list();
    }

    /** El plan que se está contratando: tiene que existir y estar activo. */
    @Transactional(value = "controlTx", readOnly = true)
    public PlataformaDto.Plan activo(String codigo) {
        PlataformaDto.Plan p = buscar(codigo);
        if (!p.activo()) throw ReglaNegocioException.invalido("El plan «" + p.nombre() + "» está desactivado.");
        return p;
    }

    /** Un plan existente (aunque esté desactivado: una empresa puede seguir en él). */
    @Transactional(value = "controlTx", readOnly = true)
    public PlataformaDto.Plan buscar(String codigo) {
        String c = codigo == null || codigo.isBlank() ? "basico" : codigo.trim().toLowerCase(Locale.ROOT);
        return listar().stream().filter((p) -> p.codigo().equals(c)).findFirst()
                .orElseThrow(() -> ReglaNegocioException.invalido("Ese plan no existe."));
    }

    public static int precio(PlataformaDto.Plan p, String ciclo) {
        return "ANUAL".equals(ciclo) ? p.precioAnual() : p.precioMensual();
    }

    @Transactional("controlTx")
    public PlataformaDto.Plan crear(PlataformaDto.PlanRequest r) {
        if (existe(r.codigo())) throw ReglaNegocioException.conflicto("Ya hay un plan con el código «" + r.codigo() + "».");
        String modulos = validarModulos(r.modulos());
        control.sql("""
                        INSERT INTO plataforma.tbl_planes (codigo, nombre, descripcion, precio_mensual, precio_anual, modulos, es_activo, orden)
                        VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM plataforma.tbl_planes))""")
                .params(r.codigo(), r.nombre().trim(), texto(r.descripcion()), r.precioMensual(), r.precioAnual(), modulos, r.activo())
                .update();
        return buscar(r.codigo());
    }

    @Transactional("controlTx")
    public PlataformaDto.Plan actualizar(String codigo, PlataformaDto.PlanRequest r) {
        if (!existe(codigo)) throw ReglaNegocioException.noEncontrado("Ese plan no existe.");
        String modulos = validarModulos(r.modulos());
        control.sql("""
                        UPDATE plataforma.tbl_planes SET nombre = ?, descripcion = ?, precio_mensual = ?, precio_anual = ?,
                            modulos = ?, es_activo = ?, actualizado_en = now()
                        WHERE codigo = ?""")
                .params(r.nombre().trim(), texto(r.descripcion()), r.precioMensual(), r.precioAnual(), modulos, r.activo(), codigo)
                .update();
        return buscar(codigo);
    }

    private boolean existe(String codigo) {
        return control.sql("SELECT 1 FROM plataforma.tbl_planes WHERE codigo = ?").param(codigo).query(Integer.class).optional().isPresent();
    }

    private String validarModulos(List<String> pedidos) {
        Set<String> validos = control.sql("SELECT codigo FROM plataforma.tbl_modulos").query(String.class).set();
        for (String m : pedidos) if (!validos.contains(m)) throw ReglaNegocioException.invalido("Módulo desconocido: " + m);
        return String.join(",", pedidos.stream().distinct().toList());
    }

    private static List<String> partir(String s) {
        return s == null || s.isBlank() ? List.of() : Arrays.stream(s.split(",")).map(String::trim).filter((x) -> !x.isEmpty()).collect(Collectors.toList());
    }

    private static String texto(String s) { return s == null ? "" : s.trim(); }
}
