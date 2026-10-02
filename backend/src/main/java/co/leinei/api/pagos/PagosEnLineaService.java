package co.leinei.api.pagos;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.dominio.EstadoPago;
import co.leinei.api.dominio.EstadoPedido;
import co.leinei.api.dominio.Pedido;
import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.plataforma.servicio.ConfiguracionCorreoService;
import co.leinei.api.servicio.PedidoService;
import co.leinei.api.servicio.ReglaNegocioException;
import co.leinei.api.web.dto.PublicoDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.util.*;

/**
 * Cobro en línea de los pedidos y confirmación automática del pago.
 *
 * Flujo:
 *  1. El cliente escoge «Pagar en línea»: se registra un intento (referencia única) en la base de control y se le manda
 *     al checkout de la pasarela.
 *  2. La pasarela avisa por webhook (firmado) → se verifica la firma con las llaves de esa cuenta, se guarda el
 *     resultado y se marca el pedido como pagado en la base de la empresa. El portal y el seguimiento se enteran al
 *     instante por el tiempo real (SSE).
 *  3. Respaldo: al volver del checkout se consulta a la pasarela, y cada 30 s se revisan los intentos pendientes o los
 *     resultados que no alcanzaron a reflejarse en el pedido. Todo se puede repetir sin efectos dobles.
 */
@Service
public class PagosEnLineaService {

    private static final Logger log = LoggerFactory.getLogger(PagosEnLineaService.class);
    private static final int MAXIMO_INTENTOS = 10;

    public enum ResultadoAviso { PROCESADO, IGNORADO, FIRMA_INVALIDA }

    private final ConfigPagosService config;
    private final TransaccionesPago transacciones;
    private final PedidoService pedidos;
    private final RegistroEmpresas registro;
    private final ConfiguracionCorreoService correo;
    private final LeineiProperties props;
    private final JdbcClient control;
    private final TransactionTemplate enControl;

    public PagosEnLineaService(ConfigPagosService config, TransaccionesPago transacciones, PedidoService pedidos,
                               RegistroEmpresas registro, ConfiguracionCorreoService correo, LeineiProperties props,
                               @Qualifier("controlJdbc") JdbcClient control,
                               @Qualifier("controlTx") PlatformTransactionManager controlTx) {
        this.config = config;
        this.transacciones = transacciones;
        this.pedidos = pedidos;
        this.registro = registro;
        this.correo = correo;
        this.props = props;
        this.control = control;
        this.enControl = new TransactionTemplate(controlTx);
    }

    // ------------------------------------------------------------------ cliente (tienda)

    /** Crea el cobro del pedido en la pasarela y devuelve la dirección a la que se manda al cliente. */
    public PagosDto.Inicio iniciar(String codigo, String celular, String retorno) {
        EmpresaActual e = EmpresaContexto.requerida();
        ConfigPagosService.Activa activa = config.activa(e).orElseThrow(() -> ReglaNegocioException.conflicto(
                "Por ahora no recibimos pagos en línea. Escoge transferencia o efectivo."));
        Pedido p = pedidos.delClienteParaPago(codigo, celular);
        if (p.getEstado() == EstadoPedido.CANCELADO) throw ReglaNegocioException.conflicto("Este pedido fue cancelado.");
        if (p.getEstadoPago() == EstadoPago.RECIBIDO) throw ReglaNegocioException.conflicto("Este pedido ya está pagado.");
        if (p.getEstadoPago() == EstadoPago.POR_CONFIRMAR) {
            throw ReglaNegocioException.conflicto("Ya enviaste el comprobante de tu transferencia. La tienda lo está revisando.");
        }
        List<Transaccion> previas = transacciones.dePedido(e.id(), p.getCodigo());
        if (previas.stream().anyMatch(t -> t.estado() == EstadoTransaccion.APROBADO)) {
            throw ReglaNegocioException.conflicto("Ya recibimos el pago de este pedido.");
        }
        if (previas.size() >= MAXIMO_INTENTOS) {
            throw ReglaNegocioException.conflicto("Ya intentaste pagar varias veces. Escríbenos por WhatsApp o escoge otra forma de pago.");
        }
        String regreso = validarRetorno(retorno, e);
        String referencia = "LN" + e.id() + "-" + p.getCodigo().replace("P-", "") + "-" + (previas.size() + 1);
        Transaccion t = transacciones.crear(e.id(), referencia, p.getCodigo(), activa.proveedor(), activa.modalidad(),
                activa.credenciales().ambiente(), p.getTotal());
        try {
            Pasarela.Inicio inicio = config.pasarela(activa.proveedor()).iniciar(activa.credenciales(), referencia, p.getTotal(),
                    "Pedido " + p.getCodigo() + " · " + e.nombreComercial(), regreso);
            if (!inicio.idExterno().isBlank()) transacciones.guardarIdExterno(t.id(), inicio.idExterno());
            return new PagosDto.Inicio(inicio.url());
        } catch (RuntimeException ex) {
            transacciones.marcarError(t.id(), ex.getMessage());
            throw ex instanceof PasarelaException ? ex
                    : new PasarelaException("No pudimos iniciar el pago en línea. Intenta de nuevo o escoge otra forma de pago.", ex);
        }
    }

    /**
     * El cliente volvió del checkout: se le pregunta a la pasarela cómo quedó el pago, sin esperar el aviso.
     * idTransaccion: el id que la pasarela agrega a la dirección de regreso (Wompi lo manda como ?id=).
     */
    public PublicoDto.Seguimiento verificar(String codigo, String celular, String idTransaccion) {
        EmpresaActual e = EmpresaContexto.requerida();
        Pedido p = pedidos.delClienteParaPago(codigo, celular);
        String id = idTransaccion == null ? "" : idTransaccion.trim();
        if (id.length() > 80) id = "";
        for (Transaccion t : transacciones.dePedido(e.id(), p.getCodigo())) {
            if (t.estado() != EstadoTransaccion.PENDIENTE) continue;
            Transaccion consultar = !id.isEmpty() && t.idTransaccion().isBlank() ? conIdTransaccion(t, id) : t;
            if (consultarYAplicar(consultar)) break;
        }
        return pedidos.seguimiento(codigo, celular);
    }

    // ------------------------------------------------------------------ avisos de la pasarela (webhooks)

    /**
     * @param empresa identificador de la empresa si el aviso llegó por su link propio (null: link de la plataforma).
     *                Por el link de una empresa solo se aceptan cobros de esa empresa.
     */
    public ResultadoAviso procesarAviso(Proveedor proveedor, String empresa, byte[] cuerpo, Map<String, String> encabezados) {
        Pasarela pasarela = config.pasarela(proveedor);
        Optional<Pasarela.Evento> evento;
        try {
            evento = pasarela.leerEvento(cuerpo);
        } catch (RuntimeException e) {
            log.warn("Aviso de {} ilegible: {}", proveedor, e.getMessage());
            return ResultadoAviso.IGNORADO;
        }
        if (evento.isEmpty()) return ResultadoAviso.IGNORADO;
        Optional<Transaccion> t = transacciones.porReferencia(evento.get().referencia());
        // Avisos de cobros que no son de la plataforma (la cuenta propia de la empresa puede tener otras ventas).
        if (t.isEmpty() || t.get().proveedor() != proveedor) return ResultadoAviso.IGNORADO;
        if (empresa != null) {
            Long esperada = registro.porIdentificador(empresa).map(EmpresaActual::id).orElse(null);
            if (esperada == null || esperada != t.get().empresaId()) {
                log.warn("Aviso de {} por el link de «{}» con un cobro de otra empresa ({})", proveedor, empresa, t.get().referencia());
                return ResultadoAviso.IGNORADO;
            }
        } else if (!Transaccion.PLATAFORMA.equals(t.get().modalidad())) {
            // Los cobros con la cuenta propia de una empresa solo se aceptan por el link de esa empresa.
            log.warn("Aviso de {} por el link de la plataforma con un cobro de cuenta propia ({})", proveedor, t.get().referencia());
            return ResultadoAviso.IGNORADO;
        }
        Optional<Credenciales> c = config.credencialesDe(t.get());
        if (c.isEmpty()) return ResultadoAviso.IGNORADO;
        if (!pasarela.firmaValida(c.get(), cuerpo, encabezados)) {
            log.warn("Aviso de {} con firma inválida para la referencia {}", proveedor, t.get().referencia());
            return ResultadoAviso.FIRMA_INVALIDA;
        }
        aplicar(t.get(), evento.get().resultado());
        return ResultadoAviso.PROCESADO;
    }

    // ------------------------------------------------------------------ respaldo en segundo plano

    /** Revisa los cobros pendientes y los resultados que todavía no se reflejan en el pedido. */
    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void conciliar() {
        try {
            transacciones.vencerViejas();
            for (Transaccion t : transacciones.porRevisar(50)) {
                try {
                    if (t.estado() == EstadoTransaccion.PENDIENTE) consultarYAplicar(t);
                    else aplicarEnPedido(t);
                } catch (Exception e) {
                    log.warn("No se pudo revisar el pago {}: {}", t.referencia(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error revisando los pagos en línea pendientes", e);
        }
    }

    // ------------------------------------------------------------------ superadmin y portal

    public PagosDto.Recaudos recaudos(Long empresaId, String liquidacion, String estado) {
        List<Transaccion> lista = transacciones.listar(new TransaccionesPago.Filtro(empresaId, liquidacion, estado, 500));
        return new PagosDto.Recaudos(vistas(lista), ConfigPagosService.totales(transacciones.totales(empresaId)));
    }

    public List<PagosDto.TransaccionVista> recientes(long empresaId) {
        return vistas(transacciones.listar(new TransaccionesPago.Filtro(empresaId, null, null, 30)));
    }

    public PagosDto.Liquidados liquidar(List<UUID> uuids, String quien, String nota) {
        return enControl.execute(s -> new PagosDto.Liquidados(transacciones.liquidar(uuids, quien, nota == null ? "" : nota.trim())));
    }

    // ------------------------------------------------------------------ apoyo

    /** Consulta el cobro en la pasarela y aplica lo que responda. true si la pasarela lo reconoció. */
    private boolean consultarYAplicar(Transaccion t) {
        Optional<Credenciales> c = config.credencialesDe(t);
        if (c.isEmpty()) return false;
        Optional<Pasarela.Resultado> r;
        try {
            r = config.pasarela(t.proveedor()).consultar(c.get(), t);
        } catch (PasarelaException e) {
            log.info("No se pudo consultar el pago {} en {}: {}", t.referencia(), t.proveedor(), e.getMessage());
            return false;
        } finally {
            transacciones.marcarConsultada(t.id());
        }
        r.ifPresent(res -> aplicar(t, res));
        return r.isPresent();
    }

    /** Guarda el resultado del cobro (una sola vez por cambio de estado) y lo refleja en el pedido. */
    private void aplicar(Transaccion t, Pasarela.Resultado r) {
        if (r.estado() == EstadoTransaccion.PENDIENTE) {
            if (!r.idTransaccion().isBlank()) transacciones.guardarIdTransaccion(t.id(), r.idTransaccion());
            return;
        }
        EstadoTransaccion estado = r.estado();
        String detalle = r.detalle();
        if (estado == EstadoTransaccion.APROBADO && r.monto() != null && r.monto() != t.monto()) {
            estado = EstadoTransaccion.ERROR;
            detalle = "La pasarela aprobó $" + r.monto() + " pero el pedido vale $" + t.monto() + ". Revísalo antes de entregar.";
            log.warn("Pago {} aprobado por un valor distinto: {} vs {}", t.referencia(), r.monto(), t.monto());
        }
        EstadoTransaccion nuevo = estado;
        String nuevoDetalle = detalle;
        Transaccion guardada = enControl.execute(s -> {
            Transaccion actual = transacciones.bloquear(t.id()).orElseThrow();
            if (actual.estado() == nuevo) return null; // aviso repetido
            // Un pago aprobado solo puede pasar a anulado (reverso); los demás avisos tardíos no lo cambian.
            if (actual.estado() == EstadoTransaccion.APROBADO && nuevo != EstadoTransaccion.ANULADO) return null;
            int comision = 0;
            int neto = 0;
            String liquidacion = "NO_APLICA";
            if (nuevo == EstadoTransaccion.APROBADO) {
                boolean plataforma = Transaccion.PLATAFORMA.equals(actual.modalidad());
                comision = plataforma ? config.comision(actual.empresaId(), actual.monto()) : 0;
                neto = actual.monto() - comision;
                liquidacion = plataforma ? "POR_LIQUIDAR" : "NO_APLICA";
            } else if (nuevo == EstadoTransaccion.ANULADO && "LIQUIDADO".equals(actual.liquidacion())) {
                // Ya se le había pagado a la empresa: queda registrado para cobrárselo de vuelta.
                comision = actual.comision();
                neto = actual.neto();
                liquidacion = "LIQUIDADO";
            }
            return transacciones.actualizarResultado(actual.id(), nuevo, r.idTransaccion(), r.medio(), nuevoDetalle,
                    comision, neto, liquidacion);
        });
        if (guardada != null) aplicarEnPedido(guardada);
    }

    /** Refleja el resultado en el pedido (base de la empresa). Si falla, la revisión periódica lo reintenta. */
    private void aplicarEnPedido(Transaccion t) {
        EmpresaActual e = registro.porId(t.empresaId()).orElse(null);
        if (e == null) return;
        boolean otroAprobado = t.estado() == EstadoTransaccion.APROBADO && transacciones.dePedido(t.empresaId(), t.codigoPedido())
                .stream().anyMatch(x -> x.id() != t.id() && x.estado() == EstadoTransaccion.APROBADO);
        try {
            EmpresaContexto.conEmpresa(e, "pasarela " + t.proveedor().nombre(), () -> {
                pedidos.registrarPagoEnLinea(t.codigoPedido(), t.estado(), t.proveedor().nombre(), medio(t.medio()),
                        t.monto(), otroAprobado);
                return null;
            });
            transacciones.marcarAplicada(t.id());
        } catch (Exception ex) {
            log.warn("No se pudo reflejar el pago {} en el pedido {} de {}: {}", t.referencia(), t.codigoPedido(),
                    e.identificador(), ex.getMessage());
        }
    }

    /**
     * La dirección de regreso la arma el navegador; solo se aceptan las de la plataforma, el dominio propio de la
     * empresa o los orígenes de desarrollo, para que nadie use el cobro para redirigir a otro sitio.
     */
    private String validarRetorno(String retorno, EmpresaActual e) {
        URI u;
        try {
            u = URI.create(retorno.trim());
        } catch (IllegalArgumentException ex) {
            throw ReglaNegocioException.invalido("La dirección de regreso no es válida.");
        }
        String esquema = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
        if (!(esquema.equals("https") || esquema.equals("http")) || host.isEmpty() || u.getUserInfo() != null) {
            throw ReglaNegocioException.invalido("La dirección de regreso no es válida.");
        }
        Set<String> permitidos = new HashSet<>(List.of("localhost", "127.0.0.1"));
        agregarHost(permitidos, correo.efectiva().urlPublica());
        props.listaOrigenes().forEach(o -> agregarHost(permitidos, o));
        if (e.dominioPropio() != null && !e.dominioPropio().isBlank()) permitidos.add(e.dominioPropio().toLowerCase(Locale.ROOT));
        if (!permitidos.contains(host)) throw ReglaNegocioException.invalido("La dirección de regreso no es de esta tienda.");
        return u.toString();
    }

    private static void agregarHost(Set<String> hosts, String url) {
        try {
            String h = URI.create(url.trim()).getHost();
            if (h != null) hosts.add(h.toLowerCase(Locale.ROOT));
        } catch (Exception ignorada) { /* dirección mal escrita en la configuración */ }
    }

    private static Transaccion conIdTransaccion(Transaccion t, String id) {
        return new Transaccion(t.id(), t.uuid(), t.empresaId(), t.referencia(), t.codigoPedido(), t.proveedor(), t.modalidad(),
                t.ambiente(), t.monto(), t.estado(), t.idExterno(), id, t.medio(), t.detalle(), t.comision(), t.neto(),
                t.liquidacion(), t.liquidadoEn(), t.liquidadoPor(), t.notaLiquidacion(), t.aprobadoEn(), t.aplicadoEn(),
                t.consultadoEn(), t.creadoEn(), t.actualizadoEn());
    }

    /** NEQUI → Nequi, CARD → Tarjeta… para los avisos y el seguimiento. */
    public static String medio(String codigo) {
        if (codigo == null || codigo.isBlank()) return "";
        return switch (codigo.toUpperCase(Locale.ROOT)) {
            case "CARD", "CREDIT_CARD" -> "Tarjeta";
            case "NEQUI" -> "Nequi";
            case "PSE" -> "PSE";
            case "BANCOLOMBIA_TRANSFER", "BOTON_BANCOLOMBIA" -> "Botón Bancolombia";
            case "BANCOLOMBIA_QR", "QR" -> "QR";
            case "DAVIPLATA" -> "Daviplata";
            default -> codigo;
        };
    }

    private List<PagosDto.TransaccionVista> vistas(List<Transaccion> lista) {
        Map<Long, String[]> empresas = new HashMap<>();
        Set<Long> ids = new HashSet<>();
        lista.forEach(t -> ids.add(t.empresaId()));
        if (!ids.isEmpty()) {
            String marcas = String.join(", ", Collections.nCopies(ids.size(), "?"));
            control.sql("SELECT e.id, e.identificador, m.nombre_comercial FROM plataforma.tbl_empresas e "
                            + "JOIN plataforma.tbl_empresas_marca m ON m.empresa_id = e.id WHERE e.id IN (" + marcas + ")")
                    .params(new ArrayList<Object>(ids))
                    .query((rs, n) -> empresas.put(rs.getLong(1), new String[]{rs.getString(2), rs.getString(3)}))
                    .list();
        }
        return lista.stream().map(t -> {
            String[] emp = empresas.getOrDefault(t.empresaId(), new String[]{"", ""});
            return new PagosDto.TransaccionVista(t.uuid(), emp[0], emp[1], t.referencia(), t.codigoPedido(), t.proveedor(),
                    t.modalidad(), t.ambiente(), t.monto(), t.estado(), medio(t.medio()), t.detalle(), t.comision(), t.neto(),
                    t.liquidacion(), t.creadoEn(), t.aprobadoEn(), t.liquidadoEn(), t.liquidadoPor(), t.notaLiquidacion());
        }).toList();
    }
}
