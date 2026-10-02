package co.leinei.api.pagos;

import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.plataforma.aprovisionamiento.CifradoClaves;
import co.leinei.api.plataforma.servicio.ConfiguracionCorreoService;
import co.leinei.api.servicio.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Configuración de pagos en línea: las cuentas de pasarela de la plataforma y, por cada empresa, la modalidad
 * (apagado, cuenta propia o cuenta de la plataforma), sus llaves cifradas y la comisión.
 *
 * Todo vive en la base de control. Las llaves se cifran con la llave maestra (igual que las claves de las bases)
 * y nunca se devuelven: la API solo dice si están guardadas.
 */
@Service
public class ConfigPagosService {

    public static final String APAGADO = "APAGADO";

    private record FilaLlaves(Proveedor proveedor, String ambiente, String llavePublica, String privadaCifrada,
                              String integridadCifrado, String eventosCifrado) {
        static FilaLlaves vacia(Proveedor p) { return new FilaLlaves(p, Credenciales.PRUEBAS, "", "", "", ""); }
    }

    private record FilaEmpresa(String modalidad, FilaLlaves llaves, boolean editable, boolean pausado,
                               BigDecimal comisionPorcentaje, int comisionFija) {}

    private record FilaPlataforma(FilaLlaves llaves, boolean activa) {}

    /** Cómo cobra hoy la empresa, con las llaves listas para usar. */
    public record Activa(String modalidad, Proveedor proveedor, Credenciales credenciales, BigDecimal comisionPorcentaje,
                         int comisionFija) {

        /** Lo que se queda la plataforma de un pago (solo en la modalidad PLATAFORMA). */
        public int comision(int monto) {
            if (!Transaccion.PLATAFORMA.equals(modalidad)) return 0;
            int porcentaje = BigDecimal.valueOf(monto).multiply(comisionPorcentaje)
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).intValue();
            return Math.min(monto, porcentaje + comisionFija);
        }
    }

    private record Evaluacion(FilaEmpresa fila, boolean modulo, Activa activa, String motivo) {}

    private final JdbcClient control;
    private final CifradoClaves cifrado;
    private final ConfiguracionCorreoService correo;
    private final TransaccionesPago transacciones;
    private final Map<Proveedor, Pasarela> pasarelas = new EnumMap<>(Proveedor.class);

    public ConfigPagosService(@Qualifier("controlJdbc") JdbcClient control, CifradoClaves cifrado,
                              ConfiguracionCorreoService correo, TransaccionesPago transacciones, List<Pasarela> pasarelas) {
        this.control = control;
        this.cifrado = cifrado;
        this.correo = correo;
        this.transacciones = transacciones;
        pasarelas.forEach(p -> this.pasarelas.put(p.proveedor(), p));
    }

    public Pasarela pasarela(Proveedor p) {
        Pasarela pasarela = pasarelas.get(p);
        if (pasarela == null) throw new IllegalStateException("No hay implementación para " + p);
        return pasarela;
    }

    // ------------------------------------------------------------------ lo que usa el cobro

    /** La configuración con la que la empresa cobra en línea, si está lista. */
    public Optional<Activa> activa(EmpresaActual e) {
        return Optional.ofNullable(evaluar(e).activa());
    }

    /** Llaves con que se creó un cobro (para verificar sus avisos y consultarlo). */
    public Optional<Credenciales> credencialesDe(Transaccion t) {
        if (Transaccion.PLATAFORMA.equals(t.modalidad())) {
            return Optional.of(descifrar(filaPlataforma(t.proveedor()).llaves()));
        }
        FilaEmpresa f = filaEmpresa(t.empresaId());
        if (f.llaves().proveedor() != t.proveedor()) return Optional.empty();
        return Optional.of(descifrar(f.llaves()));
    }

    /** Comisión de la plataforma sobre un pago aprobado de la empresa, con lo pactado hoy. */
    public int comision(long empresaId, int monto) {
        FilaEmpresa f = filaEmpresa(empresaId);
        return new Activa(Transaccion.PLATAFORMA, f.llaves().proveedor(), null, f.comisionPorcentaje(), f.comisionFija())
                .comision(monto);
    }

    /** Dirección de avisos de las cuentas de la plataforma (una para todas las empresas que cobran con ellas). */
    public String urlEventos(Proveedor p) {
        String base = correo.efectiva().urlPublica();
        return (base == null ? "" : base.replaceAll("/+$", "")) + "/api/plataforma/publico/pagos/" + p.ruta() + "/eventos";
    }

    /**
     * Dirección de avisos de la cuenta propia de una empresa: lleva su identificador, así cada empresa registra en
     * su pasarela un link distinto y solo se aceptan por ahí los pagos de esa empresa.
     */
    public String urlEventos(Proveedor p, EmpresaActual e) {
        return urlEventos(p) + "/" + e.identificador();
    }

    // ------------------------------------------------------------------ superadmin: empresa

    public PagosDto.ConfigEmpresa vista(EmpresaActual e) {
        Evaluacion ev = evaluar(e);
        FilaEmpresa f = ev.fila();
        TransaccionesPago.Totales t = transacciones.totales(e.id());
        return new PagosDto.ConfigEmpresa(f.modalidad(), f.llaves().proveedor(), ev.modulo(), f.editable(), f.pausado(),
                f.comisionPorcentaje(), f.comisionFija(), guardadas(f.llaves()), ev.activa() != null, ev.motivo(),
                // Link propio de la empresa: es el que se registra en SU cuenta de la pasarela (cuenta propia).
                urlEventos(f.llaves().proveedor(), e), totales(t));
    }

    @Transactional("controlTx")
    public PagosDto.ConfigEmpresa guardar(EmpresaActual e, PagosDto.ConfigEmpresaRequest r) {
        FilaEmpresa actual = filaEmpresa(e.id());
        FilaLlaves llaves = actual.llaves();
        if (r.llaves() != null) {
            if (r.llaves().proveedor() != r.proveedor()) throw ReglaNegocioException.invalido("Las llaves no son de la pasarela escogida.");
            llaves = mezclar(llaves, r.llaves());
        } else if (llaves.proveedor() != r.proveedor()) {
            llaves = FilaLlaves.vacia(r.proveedor());
        }
        guardarFila(e.id(), new FilaEmpresa(r.modalidad(), llaves, r.editablePorEmpresa(), r.pausado(),
                r.comisionPorcentaje().setScale(2, RoundingMode.HALF_UP), r.comisionFija()));
        return vista(e);
    }

    // ------------------------------------------------------------------ portal de la empresa

    /** La empresa escribe sus propias llaves (solo con cuenta propia y si el superadmin lo permite). */
    @Transactional("controlTx")
    public PagosDto.ConfigEmpresa guardarLlavesDeEmpresa(EmpresaActual e, PagosDto.Llaves l) {
        FilaEmpresa f = filaEmpresa(e.id());
        if (!Transaccion.PROPIA.equals(f.modalidad())) {
            throw ReglaNegocioException.conflicto("Tu tienda no cobra con cuenta propia. Escríbele a tu proveedor si quieres cambiarlo.");
        }
        if (!f.editable()) {
            throw ReglaNegocioException.conflicto("Las llaves de tu pasarela las administra tu proveedor de la plataforma.");
        }
        guardarFila(e.id(), new FilaEmpresa(f.modalidad(), mezclar(f.llaves(), l), f.editable(), f.pausado(),
                f.comisionPorcentaje(), f.comisionFija()));
        return vista(e);
    }

    /** La empresa deja de ofrecer (o vuelve a ofrecer) el pago en línea sin perder la configuración. */
    @Transactional("controlTx")
    public PagosDto.ConfigEmpresa pausar(EmpresaActual e, boolean pausado) {
        FilaEmpresa f = filaEmpresa(e.id());
        if (APAGADO.equals(f.modalidad())) throw ReglaNegocioException.conflicto("El pago en línea no está activado para tu tienda.");
        guardarFila(e.id(), new FilaEmpresa(f.modalidad(), f.llaves(), f.editable(), pausado, f.comisionPorcentaje(), f.comisionFija()));
        return vista(e);
    }

    // ------------------------------------------------------------------ superadmin: cuentas de la plataforma

    public List<PagosDto.PasarelaPlataforma> plataforma() {
        return Arrays.stream(Proveedor.values()).map(this::vistaPlataforma).toList();
    }

    @Transactional("controlTx")
    public PagosDto.PasarelaPlataforma guardarPlataforma(Proveedor p, PagosDto.PasarelaPlataformaRequest r) {
        if (r.llaves().proveedor() != p) throw ReglaNegocioException.invalido("Las llaves no son de " + p.nombre() + ".");
        FilaLlaves l = mezclar(filaPlataforma(p).llaves(), r.llaves());
        if (r.activa()) {
            String falta = pasarela(p).faltante(descifrar(l));
            if (falta != null) throw ReglaNegocioException.invalido("No se puede activar: " + falta);
        }
        control.sql("""
                        UPDATE plataforma.tbl_pasarelas_plataforma
                           SET ambiente = ?, llave_publica = ?, llave_privada_cifrada = ?, secreto_integridad_cifrado = ?,
                               secreto_eventos_cifrado = ?, es_activa = ?, actualizado_en = now()
                         WHERE proveedor = ?""")
                .params(l.ambiente(), l.llavePublica(), l.privadaCifrada(), l.integridadCifrado(), l.eventosCifrado(),
                        r.activa(), p.name())
                .update();
        return vistaPlataforma(p);
    }

    private PagosDto.PasarelaPlataforma vistaPlataforma(Proveedor p) {
        FilaPlataforma f = filaPlataforma(p);
        String falta = pasarela(p).faltante(descifrar(f.llaves()));
        long usando = control.sql("SELECT count(*) FROM plataforma.tbl_empresa_pagos WHERE modalidad = 'PLATAFORMA' AND proveedor = ?")
                .param(p.name()).query(Long.class).single();
        return new PagosDto.PasarelaPlataforma(guardadas(f.llaves()), f.activa(), falta == null, falta, urlEventos(p), usando);
    }

    // ------------------------------------------------------------------ apoyo

    private Evaluacion evaluar(EmpresaActual e) {
        FilaEmpresa f = filaEmpresa(e.id());
        boolean modulo = e.tieneModulo(Modulos.PAGOS_EN_LINEA);
        Proveedor p = f.llaves().proveedor();
        if (!modulo) return new Evaluacion(f, false, null, "El plan de la empresa no incluye «Pagos en línea».");
        if (APAGADO.equals(f.modalidad())) return new Evaluacion(f, true, null, "El pago en línea está apagado.");
        if (f.pausado()) return new Evaluacion(f, true, null, "La empresa pausó el pago en línea.");
        Credenciales c;
        if (Transaccion.PLATAFORMA.equals(f.modalidad())) {
            FilaPlataforma pf = filaPlataforma(p);
            if (!pf.activa()) return new Evaluacion(f, true, null, "La cuenta de " + p.nombre() + " de la plataforma no está activa.");
            c = descifrar(pf.llaves());
        } else {
            c = descifrar(f.llaves());
        }
        String falta = pasarela(p).faltante(c);
        if (falta != null) return new Evaluacion(f, true, null, falta);
        return new Evaluacion(f, true, new Activa(f.modalidad(), p, c, f.comisionPorcentaje(), f.comisionFija()), "");
    }

    private FilaEmpresa filaEmpresa(long empresaId) {
        return control.sql("""
                        SELECT modalidad, proveedor, ambiente, llave_publica, llave_privada_cifrada, secreto_integridad_cifrado,
                               secreto_eventos_cifrado, es_editable_por_empresa, es_pausado, comision_porcentaje, comision_fija
                          FROM plataforma.tbl_empresa_pagos WHERE empresa_id = ?""")
                .param(empresaId)
                .query((rs, n) -> new FilaEmpresa(rs.getString(1),
                        new FilaLlaves(Proveedor.valueOf(rs.getString(2)), rs.getString(3), rs.getString(4), rs.getString(5),
                                rs.getString(6), rs.getString(7)),
                        rs.getBoolean(8), rs.getBoolean(9), rs.getBigDecimal(10), rs.getInt(11)))
                .optional()
                .orElse(new FilaEmpresa(APAGADO, FilaLlaves.vacia(Proveedor.WOMPI), true, false, BigDecimal.ZERO.setScale(2), 0));
    }

    private void guardarFila(long empresaId, FilaEmpresa f) {
        FilaLlaves l = f.llaves();
        control.sql("""
                        INSERT INTO plataforma.tbl_empresa_pagos (empresa_id, modalidad, proveedor, ambiente, llave_publica,
                            llave_privada_cifrada, secreto_integridad_cifrado, secreto_eventos_cifrado, es_editable_por_empresa,
                            es_pausado, comision_porcentaje, comision_fija)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (empresa_id) DO UPDATE SET modalidad = EXCLUDED.modalidad, proveedor = EXCLUDED.proveedor,
                            ambiente = EXCLUDED.ambiente, llave_publica = EXCLUDED.llave_publica,
                            llave_privada_cifrada = EXCLUDED.llave_privada_cifrada,
                            secreto_integridad_cifrado = EXCLUDED.secreto_integridad_cifrado,
                            secreto_eventos_cifrado = EXCLUDED.secreto_eventos_cifrado,
                            es_editable_por_empresa = EXCLUDED.es_editable_por_empresa, es_pausado = EXCLUDED.es_pausado,
                            comision_porcentaje = EXCLUDED.comision_porcentaje, comision_fija = EXCLUDED.comision_fija,
                            actualizado_en = now()""")
                .params(empresaId, f.modalidad(), l.proveedor().name(), l.ambiente(), l.llavePublica(), l.privadaCifrada(),
                        l.integridadCifrado(), l.eventosCifrado(), f.editable(), f.pausado(), f.comisionPorcentaje(),
                        f.comisionFija())
                .update();
    }

    private FilaPlataforma filaPlataforma(Proveedor p) {
        return control.sql("""
                        SELECT ambiente, llave_publica, llave_privada_cifrada, secreto_integridad_cifrado, secreto_eventos_cifrado,
                               es_activa
                          FROM plataforma.tbl_pasarelas_plataforma WHERE proveedor = ?""")
                .param(p.name())
                .query((rs, n) -> new FilaPlataforma(new FilaLlaves(p, rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5)), rs.getBoolean(6)))
                .optional()
                .orElse(new FilaPlataforma(FilaLlaves.vacia(p), false));
    }

    /** Combina lo guardado con lo que llega del formulario. Si cambia la pasarela, se empieza de cero. */
    private FilaLlaves mezclar(FilaLlaves actual, PagosDto.Llaves nuevas) {
        FilaLlaves base = actual.proveedor() == nuevas.proveedor() ? actual : FilaLlaves.vacia(nuevas.proveedor());
        String publica = nuevas.llavePublica() == null ? base.llavePublica() : nuevas.llavePublica().trim();
        return new FilaLlaves(nuevas.proveedor(), nuevas.ambiente(), publica,
                secreto(base.privadaCifrada(), nuevas.llavePrivada()),
                secreto(base.integridadCifrado(), nuevas.secretoIntegridad()),
                secreto(base.eventosCifrado(), nuevas.secretoEventos()));
    }

    private String secreto(String guardado, String nuevo) {
        return nuevo == null || nuevo.isBlank() ? guardado : cifrado.cifrar(nuevo.trim());
    }

    private Credenciales descifrar(FilaLlaves l) {
        return new Credenciales(l.proveedor(), l.ambiente(), l.llavePublica(), abrir(l.privadaCifrada()),
                abrir(l.integridadCifrado()), abrir(l.eventosCifrado()));
    }

    private String abrir(String cifrada) {
        return cifrada == null || cifrada.isEmpty() ? "" : cifrado.descifrar(cifrada);
    }

    private static PagosDto.LlavesGuardadas guardadas(FilaLlaves l) {
        return new PagosDto.LlavesGuardadas(l.proveedor(), l.proveedor().nombre(), l.ambiente(), l.llavePublica(),
                !l.privadaCifrada().isEmpty(), !l.integridadCifrado().isEmpty(), !l.eventosCifrado().isEmpty());
    }

    static PagosDto.Totales totales(TransaccionesPago.Totales t) {
        return new PagosDto.Totales(t.aprobados(), t.montoAprobado(), t.comisiones(), t.porLiquidar(), t.liquidado());
    }
}
