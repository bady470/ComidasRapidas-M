package co.leinei.api.plataforma.servicio;

import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.servicio.ArchivoService;
import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Marca blanca de cada empresa (nombre comercial, colores, logo y dominio propio).
 * Vive en la base de control: la lee la tienda pública y la editan el superadmin y la propia empresa.
 */
@Service
public class MarcaService {

    private static final Pattern COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private final JdbcClient control;
    private final RegistroEmpresas registro;

    public MarcaService(@Qualifier("controlJdbc") JdbcClient control, RegistroEmpresas registro) {
        this.control = control;
        this.registro = registro;
    }

    /** Lo que la empresa puede cambiar desde su portal: nombre comercial y colores (no el dominio). */
    @Transactional("controlTx")
    public void actualizarDesdeEmpresa(EmpresaActual e, String nombre, String colorPrimario, String colorSecundario) {
        validar(nombre, colorPrimario, colorSecundario);
        control.sql("""
                        UPDATE plataforma.tbl_empresas_marca
                           SET nombre_comercial = ?, color_primario = ?, color_secundario = ?, actualizado_en = now()
                         WHERE empresa_id = ?""")
                .params(nombre.trim(), colorPrimario.toUpperCase(Locale.ROOT), colorSecundario.toUpperCase(Locale.ROOT), e.id())
                .update();
        registro.invalidar(e.identificador());
    }

    @Transactional("controlTx")
    public void guardarLogo(long empresaId, String identificador, byte[] datos) {
        if (datos == null || datos.length == 0) throw ReglaNegocioException.invalido("El archivo está vacío.");
        if (datos.length > ArchivoService.MAXIMO_BYTES) throw ReglaNegocioException.invalido("El logo pesa más de 2 MB. Usa uno más liviano.");
        String tipo = ArchivoService.tipoDe(datos);
        if (tipo == null) throw ReglaNegocioException.invalido("El logo debe ser PNG, JPG o WebP.");
        control.sql("""
                        UPDATE plataforma.tbl_empresas_marca
                           SET logo_tipo = ?, logo_datos = ?, logo_version = logo_version + 1, actualizado_en = now()
                         WHERE empresa_id = ?""")
                .params(tipo, datos, empresaId)
                .update();
        registro.invalidar(identificador);
    }

    @Transactional("controlTx")
    public void quitarLogo(long empresaId, String identificador) {
        control.sql("""
                        UPDATE plataforma.tbl_empresas_marca
                           SET logo_tipo = NULL, logo_datos = NULL, logo_version = logo_version + 1, actualizado_en = now()
                         WHERE empresa_id = ?""")
                .param(empresaId)
                .update();
        registro.invalidar(identificador);
    }

    @Transactional(value = "controlTx", readOnly = true)
    public Optional<ArchivoService.Imagen> logo(String identificador) {
        return control.sql("""
                        SELECT m.logo_datos, m.logo_tipo FROM plataforma.tbl_empresas_marca m
                        JOIN plataforma.tbl_empresas e ON e.id = m.empresa_id
                        WHERE e.identificador = ? AND m.logo_datos IS NOT NULL""")
                .param(identificador)
                .query((rs, n) -> new ArchivoService.Imagen(rs.getBytes(1), rs.getString(2)))
                .optional();
    }

    static void validar(String nombre, String colorPrimario, String colorSecundario) {
        if (nombre == null || nombre.isBlank() || nombre.length() > 80) {
            throw ReglaNegocioException.invalido("Escribe el nombre comercial (máximo 80 caracteres).");
        }
        if (colorPrimario == null || !COLOR.matcher(colorPrimario).matches()
                || colorSecundario == null || !COLOR.matcher(colorSecundario).matches()) {
            throw ReglaNegocioException.invalido("Los colores deben tener el formato #RRGGBB.");
        }
    }
}
