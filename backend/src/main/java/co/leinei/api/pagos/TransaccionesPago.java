package co.leinei.api.pagos;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Acceso a plataforma.tbl_transacciones_pago (base de control). */
@Component
public class TransaccionesPago {

    private static final String COLUMNAS = """
            id, uuid, empresa_id, referencia, codigo_pedido, proveedor, modalidad, ambiente, monto, estado, id_externo,
            id_transaccion, medio, detalle, comision, neto, liquidacion, liquidado_en, liquidado_por, nota_liquidacion,
            aprobado_en, aplicado_en, consultado_en, creado_en, actualizado_en""";

    private static final RowMapper<Transaccion> FILA = (rs, n) -> new Transaccion(
            rs.getLong("id"), rs.getObject("uuid", UUID.class), rs.getLong("empresa_id"), rs.getString("referencia"),
            rs.getString("codigo_pedido"), Proveedor.valueOf(rs.getString("proveedor")), rs.getString("modalidad"),
            rs.getString("ambiente"), rs.getInt("monto"), EstadoTransaccion.valueOf(rs.getString("estado")),
            rs.getString("id_externo"), rs.getString("id_transaccion"), rs.getString("medio"), rs.getString("detalle"),
            rs.getInt("comision"), rs.getInt("neto"), rs.getString("liquidacion"), instante(rs.getTimestamp("liquidado_en")),
            rs.getString("liquidado_por"), rs.getString("nota_liquidacion"), instante(rs.getTimestamp("aprobado_en")),
            instante(rs.getTimestamp("aplicado_en")), instante(rs.getTimestamp("consultado_en")),
            instante(rs.getTimestamp("creado_en")), instante(rs.getTimestamp("actualizado_en")));

    private final JdbcClient control;

    public TransaccionesPago(@Qualifier("controlJdbc") JdbcClient control) {
        this.control = control;
    }

    public Transaccion crear(long empresaId, String referencia, String codigoPedido, Proveedor proveedor, String modalidad,
                             String ambiente, int monto) {
        return control.sql("INSERT INTO plataforma.tbl_transacciones_pago (empresa_id, referencia, codigo_pedido, proveedor, "
                        + "modalidad, ambiente, monto) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING " + COLUMNAS)
                .params(empresaId, referencia, codigoPedido, proveedor.name(), modalidad, ambiente, monto)
                .query(FILA).single();
    }

    public void guardarIdExterno(long id, String idExterno) {
        control.sql("UPDATE plataforma.tbl_transacciones_pago SET id_externo = ?, actualizado_en = now() WHERE id = ?")
                .params(idExterno, id).update();
    }

    public void marcarError(long id, String detalle) {
        control.sql("""
                        UPDATE plataforma.tbl_transacciones_pago SET estado = 'ERROR', detalle = ?, actualizado_en = now()
                        WHERE id = ? AND estado = 'PENDIENTE'""")
                .params(recortar(detalle, 300), id).update();
    }

    public Optional<Transaccion> porReferencia(String referencia) {
        return control.sql("SELECT " + COLUMNAS + " FROM plataforma.tbl_transacciones_pago WHERE referencia = ?")
                .param(referencia).query(FILA).optional();
    }

    /** Bloquea la fila mientras se aplica un resultado (dos avisos al mismo tiempo no se pisan). */
    public Optional<Transaccion> bloquear(long id) {
        return control.sql("SELECT " + COLUMNAS + " FROM plataforma.tbl_transacciones_pago WHERE id = ? FOR UPDATE")
                .param(id).query(FILA).optional();
    }

    public List<Transaccion> dePedido(long empresaId, String codigo) {
        return control.sql("SELECT " + COLUMNAS + " FROM plataforma.tbl_transacciones_pago "
                        + "WHERE empresa_id = ? AND codigo_pedido = ? ORDER BY id DESC")
                .params(empresaId, codigo).query(FILA).list();
    }

    public int contarDePedido(long empresaId, String codigo) {
        return control.sql("SELECT count(*) FROM plataforma.tbl_transacciones_pago WHERE empresa_id = ? AND codigo_pedido = ?")
                .params(empresaId, codigo).query(Integer.class).single();
    }

    /** Guarda lo que informó la pasarela. Devuelve la fila como quedó. */
    public Transaccion actualizarResultado(long id, EstadoTransaccion estado, String idTransaccion, String medio,
                                           String detalle, int comision, int neto, String liquidacion) {
        return control.sql("""
                        UPDATE plataforma.tbl_transacciones_pago
                           SET estado = ?, id_transaccion = COALESCE(NULLIF(?, ''), id_transaccion),
                               medio = COALESCE(NULLIF(?, ''), medio), detalle = ?, comision = ?, neto = ?, liquidacion = ?,
                               aprobado_en = CASE WHEN ? = 'APROBADO' THEN COALESCE(aprobado_en, now()) ELSE aprobado_en END,
                               aplicado_en = NULL, actualizado_en = now()
                         WHERE id = ?
                        RETURNING\s""" + COLUMNAS)
                .params(estado.name(), nulo(idTransaccion), nulo(medio), recortar(detalle, 300), comision, neto, liquidacion,
                        estado.name(), id)
                .query(FILA).single();
    }

    public void guardarIdTransaccion(long id, String idTransaccion) {
        control.sql("UPDATE plataforma.tbl_transacciones_pago SET id_transaccion = ?, actualizado_en = now() WHERE id = ? AND id_transaccion = ''")
                .params(idTransaccion, id).update();
    }

    public void marcarConsultada(long id) {
        control.sql("UPDATE plataforma.tbl_transacciones_pago SET consultado_en = now() WHERE id = ?").param(id).update();
    }

    public void marcarAplicada(long id) {
        control.sql("UPDATE plataforma.tbl_transacciones_pago SET aplicado_en = now() WHERE id = ?").param(id).update();
    }

    /** Cobros que hay que revisar: pendientes recientes sin consultar hace rato, o resultados sin reflejar en el pedido. */
    public List<Transaccion> porRevisar(int limite) {
        return control.sql("SELECT " + COLUMNAS + """
                         FROM plataforma.tbl_transacciones_pago
                        WHERE (estado = 'PENDIENTE' AND creado_en > now() - interval '3 days'
                               AND creado_en < now() - interval '1 minute'
                               AND (consultado_en IS NULL OR consultado_en < now() - make_interval(secs =>
                                    CASE WHEN creado_en > now() - interval '30 minutes' THEN 60 ELSE 600 END)))
                           OR (estado IN ('APROBADO', 'ANULADO') AND aplicado_en IS NULL)
                        ORDER BY creado_en
                        LIMIT ?""")
                .param(limite).query(FILA).list();
    }

    /** Pendientes de hace más de 3 días: el cliente nunca pagó. */
    public int vencerViejas() {
        return control.sql("""
                        UPDATE plataforma.tbl_transacciones_pago SET estado = 'VENCIDO', detalle = 'El cliente no terminó de pagar.',
                               actualizado_en = now()
                         WHERE estado = 'PENDIENTE' AND creado_en <= now() - interval '3 days'""")
                .update();
    }

    // ------------------------------------------------------------------ listados y liquidación

    public record Filtro(Long empresaId, String liquidacion, String estado, int limite) {}

    public record Totales(long aprobados, long montoAprobado, long comisiones, long porLiquidar, long liquidado) {}

    public List<Transaccion> listar(Filtro f) {
        StringBuilder sql = new StringBuilder("SELECT " + COLUMNAS + " FROM plataforma.tbl_transacciones_pago WHERE TRUE");
        var params = new java.util.ArrayList<Object>();
        if (f.empresaId() != null) { sql.append(" AND empresa_id = ?"); params.add(f.empresaId()); }
        if (f.liquidacion() != null) { sql.append(" AND liquidacion = ?"); params.add(f.liquidacion()); }
        if (f.estado() != null) { sql.append(" AND estado = ?"); params.add(f.estado()); }
        sql.append(" ORDER BY id DESC LIMIT ?");
        params.add(f.limite());
        return control.sql(sql.toString()).params(params).query(FILA).list();
    }

    public Totales totales(Long empresaId) {
        return control.sql("""
                        SELECT count(*) FILTER (WHERE estado = 'APROBADO'),
                               COALESCE(sum(monto) FILTER (WHERE estado = 'APROBADO'), 0),
                               COALESCE(sum(comision) FILTER (WHERE estado = 'APROBADO'), 0),
                               COALESCE(sum(neto) FILTER (WHERE estado = 'APROBADO' AND liquidacion = 'POR_LIQUIDAR'), 0),
                               COALESCE(sum(neto) FILTER (WHERE liquidacion = 'LIQUIDADO'), 0)
                          FROM plataforma.tbl_transacciones_pago
                         WHERE (CAST(? AS BIGINT) IS NULL OR empresa_id = ?)""")
                .params(empresaId, empresaId)
                .query((rs, n) -> new Totales(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)))
                .single();
    }

    /** Marca como liquidados (ya se le pagó a la empresa) los cobros aprobados que estaban por liquidar. */
    public int liquidar(List<UUID> uuids, String quien, String nota) {
        int total = 0;
        for (UUID u : uuids) {
            total += control.sql("""
                            UPDATE plataforma.tbl_transacciones_pago
                               SET liquidacion = 'LIQUIDADO', liquidado_en = now(), liquidado_por = ?, nota_liquidacion = ?,
                                   actualizado_en = now()
                             WHERE uuid = ? AND estado = 'APROBADO' AND liquidacion = 'POR_LIQUIDAR'""")
                    .params(quien, recortar(nota, 200), u).update();
        }
        return total;
    }

    private static Instant instante(Timestamp t) { return t == null ? null : t.toInstant(); }

    private static String nulo(String s) { return s == null ? "" : s; }

    static String recortar(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) : s;
    }
}
