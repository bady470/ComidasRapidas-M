package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.ComprobantePagoRepositorio;
import co.leinei.api.repositorio.DomiciliarioRepositorio;
import co.leinei.api.repositorio.NotificacionRepositorio;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.pagos.ConfigPagosService;
import co.leinei.api.pagos.PagosDto;
import co.leinei.api.pagos.Transaccion;
import co.leinei.api.pagos.TransaccionesPago;
import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.MapaDto;
import co.leinei.api.web.dto.PublicoDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PedidoService {

    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom AZAR = new SecureRandom();
    static final String LO_ANTES_POSIBLE = "Lo antes posible";
    private static final Locale ES_CO = Locale.of("es", "CO");

    private final PedidoRepositorio pedidoRepo;
    private final CatalogoService catalogo;
    private final ConfigService configService;
    private final PrecioService precios;
    private final ZoneId zona;
    private final ComprobantePagoRepositorio comprobantes;
    private final NotificacionRepositorio notificaciones;
    private final DomiciliarioRepositorio domiciliarios;
    private final TiempoReal tiempoReal;
    private final ConfigPagosService pagosEnLinea;
    private final TransaccionesPago transacciones;

    /** Estados de pago que cuentan como "sin pagar". */
    static final List<EstadoPago> SIN_PAGAR = List.of(EstadoPago.PENDIENTE, EstadoPago.POR_CONFIRMAR);
    /** Comprobantes: foto o PDF de hasta 5 MB. */
    public static final int MAXIMO_COMPROBANTE = 5 * 1024 * 1024;

    public PedidoService(PedidoRepositorio pedidoRepo, CatalogoService catalogo, ConfigService configService,
                         PrecioService precios, co.leinei.api.config.LeineiProperties props,
                         ComprobantePagoRepositorio comprobantes, NotificacionRepositorio notificaciones,
                         DomiciliarioRepositorio domiciliarios, TiempoReal tiempoReal, ConfigPagosService pagosEnLinea,
                         TransaccionesPago transacciones) {
        this.tiempoReal = tiempoReal;
        this.pagosEnLinea = pagosEnLinea;
        this.transacciones = transacciones;
        this.zona = ZoneId.of(props.zonaHoraria());
        this.comprobantes = comprobantes;
        this.notificaciones = notificaciones;
        this.domiciliarios = domiciliarios;
        this.pedidoRepo = pedidoRepo;
        this.catalogo = catalogo;
        this.configService = configService;
        this.precios = precios;
    }

    // ------------------------------------------------------------------ cliente

    /** Calcula el carrito. Si hay zonas y el cliente aún no escoge la suya, el domicilio sale en 0. */
    @Transactional(readOnly = true)
    public PrecioService.Cotizacion cotizar(PublicoDto.CotizarRequest r) {
        ConfigTienda c = configService.tienda();
        TipoEntrega tipo = tipoPorDefecto(c, r.tipoEntrega());
        LocalDate fecha = configService.disponibilidad().fechaServicio();
        int domicilio = domicilio(c, tipo, r.zonaId(), r.lat(), r.lng(), false, false).valor();
        return precios.calcular(lineas(r.items(), true), catalogo.promocionesActivas(), domicilio, fecha);
    }

    @Transactional
    public PublicoDto.PedidoCreado crear(PublicoDto.CrearPedidoRequest r) {
        ConfigTienda c = configService.tienda();
        DisponibilidadService.Disponibilidad d = configService.disponibilidad();
        if (!c.isAbierto()) {
            throw ReglaNegocioException.conflicto("En este momento no estamos recibiendo pedidos. Escríbenos por WhatsApp.");
        }
        if (c.pedidosPausados(Instant.now())) {
            // «h:mm a» en español ya termina en punto («10:45 a. m.»): no se agrega otro.
            throw ReglaNegocioException.conflicto("Estamos a tope de pedidos. Volvemos a recibir a las "
                    + DateTimeFormatter.ofPattern("h:mm a", ES_CO).format(c.getPedidosPausadosHasta().atZone(zona)));
        }
        if (!d.recibePedidos()) {
            String cuando = d.proximaApertura() == null ? "" : " Abrimos " + DateTimeFormatter.ofPattern("EEEE 'a las' h:mm a",
                    ES_CO).format(d.proximaApertura().atZone(zona)) + ".";
            throw ReglaNegocioException.conflicto("Estamos cerrados en este momento." + cuando);
        }
        Entrega entrega = domicilio(c, r.tipoEntrega(), r.zonaId(), r.lat(), r.lng(), true, false);
        if (r.tipoEntrega() == TipoEntrega.DOMICILIO) {
            if (blanco(r.direccion())) throw ReglaNegocioException.invalido("Escribe la dirección de entrega.");
            if (entrega.zona().isEmpty() && blanco(r.barrio())) throw ReglaNegocioException.invalido("Escribe el barrio.");
        }
        String franja = franja(c, r.franja());

        PrecioService.Cotizacion cot = precios.calcular(lineas(r.items(), true), catalogo.promocionesActivas(),
                entrega.valor(), d.fechaServicio());
        if (c.getPedidoMinimo() > 0 && cot.subtotal() - cot.descuento() < c.getPedidoMinimo()) {
            throw ReglaNegocioException.invalido("El pedido mínimo es de $" + String.format(ES_CO, "%,d", c.getPedidoMinimo()) + ".");
        }

        Pedido p = nuevoPedido(cot, d.fechaServicio(), franja, r.tipoEntrega(), entrega.zona(), r.nombre(), r.celular(),
                r.tipoEntrega() == TipoEntrega.DOMICILIO ? Objects.requireNonNullElse(r.barrio(), "") : "",
                r.tipoEntrega() == TipoEntrega.DOMICILIO ? r.direccion() : "",
                r.tipoEntrega() == TipoEntrega.DOMICILIO ? r.referencia() : "", r.notas());
        asignarPago(p, c, r.metodoPago(), r.cuentaId(), false);
        p.setEntregaLat(entrega.lat());
        p.setEntregaLng(entrega.lng());
        p.setDistanciaKm(entrega.km());
        p.setOrigen(OrigenPedido.WEB);
        p.registrarEvento(EstadoPedido.NUEVO, "", "cliente");
        pedidoRepo.save(p);
        notificaciones.save(Notificacion.de(Notificacion.Tipo.PEDIDO_NUEVO, p.getId(),
                "Pedido nuevo " + p.getCodigo() + " · " + pesos(p.getTotal()),
                p.getClienteNombre() + (p.getTipoEntrega() == TipoEntrega.RECOGER ? " · recoge en el local" : " · " + lugar(p))
                        + " · " + comoPaga(p)));
        avisarCambio(p, "nuevo");

        int extra = c.minutosExtraVigentes(Instant.now());
        return new PublicoDto.PedidoCreado(p.getCodigo(), p.getFechaEntrega(), p.getFranja(), p.getTipoEntrega(),
                c.getModoPedido(), c.getTiempoMin() + extra, c.getTiempoMax() + extra, p.getTotal(), p.getMetodoPago(),
                p.getCuentaEntidad(), p.getCuentaTitular(), p.getCuentaNumero(), c.getWhatsapp(),
                p.getTipoEntrega() == TipoEntrega.RECOGER ? c.getDireccion() : "");
    }

    /** El cliente consulta con su código y su celular; si no coinciden, responde como si no existiera. */
    @Transactional(readOnly = true)
    public PublicoDto.Seguimiento seguimiento(String codigo, String celular) {
        return aSeguimiento(delCliente(codigo, celular));
    }

    /**
     * El cliente adjunta el comprobante de su transferencia. El pago queda «por confirmar» y la tienda
     * recibe un aviso en su portal. Se puede volver a enviar (si se equivocó de foto) mientras no esté confirmado.
     */
    @Transactional
    public PublicoDto.Seguimiento subirComprobante(String codigo, String celular, byte[] datos) {
        Pedido p = delCliente(codigo, celular);
        if (p.getMetodoPago() != MetodoPago.CUENTA) {
            throw ReglaNegocioException.invalido(p.getMetodoPago() == MetodoPago.EN_LINEA
                    ? "Este pedido se paga en línea. Si prefieres transferir, cambia la forma de pago primero."
                    : "Este pedido se paga en efectivo.");
        }
        if (p.getEstado() == EstadoPedido.CANCELADO) throw ReglaNegocioException.conflicto("Este pedido fue cancelado.");
        if (p.getEstadoPago() == EstadoPago.RECIBIDO) throw ReglaNegocioException.conflicto("Este pedido ya aparece como pagado.");
        if (datos == null || datos.length == 0) throw ReglaNegocioException.invalido("El archivo está vacío.");
        if (datos.length > MAXIMO_COMPROBANTE) throw ReglaNegocioException.invalido("El comprobante pesa más de 5 MB. Envía una captura de pantalla.");
        String tipo = tipoComprobante(datos);
        if (tipo == null) throw ReglaNegocioException.invalido("Envía el comprobante como imagen (PNG, JPG o WebP) o PDF.");
        if (comprobantes.countByPedidoId(p.getId()) >= 5) {
            throw ReglaNegocioException.conflicto("Ya enviaste varios comprobantes. Escríbenos por WhatsApp si necesitas corregirlo.");
        }
        ComprobantePago c = new ComprobantePago();
        c.setPedidoId(p.getId());
        c.setTipoContenido(tipo);
        c.setDatos(datos);
        comprobantes.save(c);
        p.setEstadoPago(EstadoPago.POR_CONFIRMAR);
        p.setPagoReportado(Instant.now());
        notificaciones.save(Notificacion.de(Notificacion.Tipo.PAGO_REPORTADO, p.getId(),
                "Pago reportado " + p.getCodigo() + " · " + pesos(p.getTotal()),
                p.getClienteNombre() + " adjuntó el comprobante de su transferencia por " + p.getCuentaEntidad()
                        + ". Revísalo y confirma el pago."));
        avisarCambio(p, "pago");
        return aSeguimiento(p);
    }

    /** Pedido del cliente (código y celular deben coincidir), para cobrarlo en línea. */
    @Transactional(readOnly = true)
    public Pedido delClienteParaPago(String codigo, String celular) {
        return delCliente(codigo, celular);
    }

    /**
     * El cliente no pudo (o no quiso) pagar en línea y escoge otra forma: transferencia con comprobante o efectivo.
     * Solo mientras el pedido siga sin pagar.
     */
    @Transactional
    public PublicoDto.Seguimiento cambiarMetodoPago(String codigo, String celular, MetodoPago metodo, Long cuentaId) {
        Pedido p = delCliente(codigo, celular);
        if (p.getEstado() == EstadoPedido.CANCELADO) throw ReglaNegocioException.conflicto("Este pedido fue cancelado.");
        if (p.getEstadoPago() == EstadoPago.RECIBIDO) throw ReglaNegocioException.conflicto("Este pedido ya aparece como pagado.");
        if (p.getMetodoPago() != MetodoPago.EN_LINEA) {
            throw ReglaNegocioException.conflicto("La forma de pago de este pedido solo se puede cambiar si era pago en línea.");
        }
        if (metodo == MetodoPago.EN_LINEA) throw ReglaNegocioException.invalido("Escoge transferencia o efectivo.");
        asignarPago(p, configService.tienda(), metodo, cuentaId, false);
        avisarCambio(p, "pago");
        return aSeguimiento(p);
    }

    /**
     * Resultado de un pago en línea que confirmó (o reversó) la pasarela. Se puede llamar varias veces con el mismo
     * resultado: solo cambia el pedido y avisa la primera vez.
     *
     * @param otroYaAprobado otro intento de este mismo pedido ya estaba aprobado (pago repetido).
     */
    @Transactional
    public void registrarPagoEnLinea(String codigo, co.leinei.api.pagos.EstadoTransaccion estado, String proveedor,
                                     String medio, int monto, boolean otroYaAprobado) {
        Pedido p = pedidoRepo.findByCodigo(codigo).orElse(null);
        if (p == null) return;
        String como = medio == null || medio.isBlank() ? proveedor : medio + " (" + proveedor + ")";
        switch (estado) {
            case APROBADO -> {
                if (p.getEstadoPago() == EstadoPago.RECIBIDO) {
                    if (otroYaAprobado) {
                        notificaciones.save(Notificacion.de(Notificacion.Tipo.PAGO_RECIBIDO, p.getId(),
                                "Pago repetido " + p.getCodigo() + " · " + pesos(monto),
                                p.getClienteNombre() + " pagó dos veces este pedido en línea (" + como
                                        + "). Revisa la devolución del pago repetido."));
                        avisarCambio(p, "pago");
                    }
                    return;
                }
                p.setMetodoPago(MetodoPago.EN_LINEA);
                p.setCuentaEntidad("Pago en línea");
                p.setCuentaTitular(proveedor);
                p.setCuentaNumero(medio == null ? "" : medio);
                p.setEstadoPago(EstadoPago.RECIBIDO);
                p.setPagoReportado(Instant.now());
                String cancelado = p.getEstado() == EstadoPedido.CANCELADO ? " Ojo: el pedido estaba cancelado, revisa la devolución." : "";
                notificaciones.save(Notificacion.de(Notificacion.Tipo.PAGO_RECIBIDO, p.getId(),
                        "Pago recibido " + p.getCodigo() + " · " + pesos(monto),
                        p.getClienteNombre() + " pagó en línea con " + como + ". El pago ya quedó confirmado." + cancelado));
                avisarCambio(p, "pago");
            }
            case ANULADO -> {
                if (p.getMetodoPago() != MetodoPago.EN_LINEA || p.getEstadoPago() != EstadoPago.RECIBIDO) return;
                p.setEstadoPago(EstadoPago.PENDIENTE);
                notificaciones.save(Notificacion.de(Notificacion.Tipo.PAGO_REVERSADO, p.getId(),
                        "Pago reversado " + p.getCodigo() + " · " + pesos(monto),
                        proveedor + " reversó el pago en línea de " + p.getClienteNombre() + ". El pedido quedó sin pagar."));
                avisarCambio(p, "pago");
            }
            // Rechazado, vencido o con error: el pedido sigue sin pagar; solo se avisa para que el seguimiento se actualice.
            default -> avisarCambio(p, "pago");
        }
    }

    private Pedido delCliente(String codigo, String celular) {
        String limpio = celular == null ? "" : celular.replaceAll("\\D", "");
        return pedidoRepo.findByCodigo(codigo.trim().toUpperCase(Locale.ROOT))
                .filter(x -> !limpio.isEmpty() && x.getClienteCelular().equals(limpio))
                .orElseThrow(() -> ReglaNegocioException.noEncontrado(
                        "No encontramos un pedido con ese código y ese celular. Revisa los datos."));
    }

    private PublicoDto.Seguimiento aSeguimiento(Pedido p) {
        TipoEntrega tipo = p.getTipoEntrega();
        List<PublicoDto.Evento> eventos = p.getEventos().stream()
                .map(e -> new PublicoDto.Evento(e.getEstado(), e.getEstado().mensaje(tipo), e.getNota(), e.getCreado()))
                .toList();
        List<PublicoDto.ItemSeguimiento> items = p.getItems().stream()
                .map(i -> new PublicoDto.ItemSeguimiento(i.getNombre(), i.getDetalle(), i.getCantidad(), i.getPrecioUnitario()))
                .toList();
        String nombre = p.getClienteNombre().split("\\s+")[0];
        String direccionTienda = tipo == TipoEntrega.RECOGER ? configService.tienda().getDireccion() : "";
        return new PublicoDto.Seguimiento(p.getCodigo(), p.getEstado(), p.getEstado().mensaje(tipo), p.getEstadoPago(),
                tipo, EstadoPedido.flujo(tipo), p.getFechaEntrega(), p.getFranja(), nombre, p.getBarrio(), p.getZona(),
                items, p.getSubtotal(), p.getDescuento(), p.getPromocionAplicada(), p.getDomicilio(), p.getTotal(),
                p.getMetodoPago(), p.getCuentaEntidad(), p.getCuentaTitular(), p.getCuentaNumero(), eventos,
                p.getCreado(), direccionTienda, p.getPagoReportado() != null, p.getPagoReportado(),
                p.getDomiciliario() == null ? "" : p.getDomiciliario().getNombre(),
                p.getDomiciliario() == null ? "" : p.getDomiciliario().getCelular(),
                estadoEnLinea(p), mapa(p));
    }

    /** Ubicación del domiciliario: se muestra si la mandó en los últimos minutos. */
    static final java.time.Duration UBICACION_VIGENTE = java.time.Duration.ofMinutes(5);

    /** Mapa del seguimiento: el local, el punto de entrega y el domiciliario (solo en camino y si es reciente). */
    private MapaDto.MapaSeguimiento mapa(Pedido p) {
        if (!EmpresaContexto.tieneModulo(co.leinei.api.empresa.Modulos.MAPAS)) return null;
        ConfigTienda c = configService.tienda();
        Domiciliario d = p.getDomiciliario();
        MapaDto.Repartidor rep = null;
        if (c.isSeguimientoVivo() && d != null && p.getEstado() == EstadoPedido.EN_CAMINO
                && d.ubicacionVigente(Instant.now(), UBICACION_VIGENTE)) {
            rep = new MapaDto.Repartidor(d.getUbicacionLat(), d.getUbicacionLng(), d.getUbicacionEn());
        }
        if (!c.tieneUbicacion() && p.getEntregaLat() == null && rep == null) return null;
        return new MapaDto.MapaSeguimiento(c.getLocalLat(), c.getLocalLng(), p.getEntregaLat(), p.getEntregaLng(), rep);
    }

    /** Último intento de pago en línea del pedido (null si nunca intentó pagar en línea). */
    private PagosDto.EstadoPublico estadoEnLinea(Pedido p) {
        List<Transaccion> intentos = transacciones.dePedido(EmpresaContexto.requerida().id(), p.getCodigo());
        if (intentos.isEmpty()) return null;
        // Si alguno quedó aprobado, ese es el que cuenta; si no, el más reciente.
        Transaccion t = intentos.stream().filter(x -> x.estado() == co.leinei.api.pagos.EstadoTransaccion.APROBADO)
                .findFirst().orElse(intentos.getFirst());
        return new PagosDto.EstadoPublico(t.proveedor().name(), t.proveedor().nombre(), t.estado(),
                co.leinei.api.pagos.PagosEnLineaService.medio(t.medio()), t.detalle(),
                intentos.size(), t.actualizadoEn());
    }

    // ------------------------------------------------------------------ administrador

    /**
     * Lista del portal. Con porPagar=true trae TODOS los pedidos sin pagar (de cualquier día, sin cancelar),
     * para que un pedido pendiente de pago nunca desaparezca de la vista al cambiar de día.
     */
    @Transactional(readOnly = true)
    public List<AdminDto.Pedido> listar(LocalDate fecha, EstadoPedido estado, String busqueda, boolean porPagar) {
        List<Pedido> base = porPagar
                ? pedidoRepo.findByEstadoPagoInAndEstadoNotOrderByCreadoDesc(SIN_PAGAR, EstadoPedido.CANCELADO)
                : fecha != null
                ? pedidoRepo.findByFechaEntregaOrderByCreadoDesc(fecha)
                : pedidoRepo.findAllByOrderByCreadoDesc(PageRequest.of(0, 300));
        String q = busqueda == null ? "" : busqueda.trim().toLowerCase(Locale.ROOT);
        List<Pedido> lista = base.stream()
                .filter(p -> estado == null || p.getEstado() == estado)
                .filter(p -> q.isEmpty() || (p.getCodigo() + " " + p.getClienteNombre() + " " + p.getClienteCelular()
                        + " " + p.getBarrio() + " " + p.getZona()).toLowerCase(Locale.ROOT).contains(q))
                .toList();
        Set<Long> conComprobante = lista.isEmpty() ? Set.of()
                : new HashSet<>(comprobantes.pedidosConComprobante(lista.stream().map(Pedido::getId).toList()));
        return lista.stream().map(p -> aDto(p, conComprobante.contains(p.getId()))).toList();
    }

    /** Último comprobante que adjuntó el cliente. */
    @Transactional(readOnly = true)
    public ArchivoService.Imagen comprobante(Long pedidoId) {
        buscar(pedidoId);
        ComprobantePago c = comprobantes.findFirstByPedidoIdOrderByIdDesc(pedidoId)
                .orElseThrow(() -> ReglaNegocioException.noEncontrado("Este pedido no tiene comprobante."));
        return new ArchivoService.Imagen(c.getDatos(), c.getTipoContenido());
    }

    /** Asigna (o quita, con null) el domiciliario que lleva el pedido. */
    @Transactional
    public AdminDto.Pedido asignarDomiciliario(Long pedidoId, Long domiciliarioId) {
        Pedido p = buscar(pedidoId);
        if (p.getTipoEntrega() != TipoEntrega.DOMICILIO) throw ReglaNegocioException.invalido("Este pedido es para recoger en el local.");
        if (p.getEstado() == EstadoPedido.CANCELADO) throw ReglaNegocioException.conflicto("Este pedido está cancelado.");
        if (domiciliarioId == null) {
            p.setDomiciliario(null);
        } else {
            Domiciliario d = domiciliarios.findById(domiciliarioId)
                    .orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese domiciliario no existe."));
            if (!d.isActivo()) throw ReglaNegocioException.conflicto(d.getNombre() + " está inactivo.");
            p.setDomiciliario(d);
        }
        avisarCambio(p, "domiciliario");
        return aDto(p);
    }

    /** Pedido que llegó por WhatsApp o por teléfono. No revisa el horario ni el pedido mínimo. */
    @Transactional
    public AdminDto.Pedido crearManual(AdminDto.PedidoManualRequest r, String autor) {
        ConfigTienda c = configService.tienda();
        LocalDate fecha = r.fechaEntrega() != null ? r.fechaEntrega() : configService.disponibilidad().fechaServicio();
        Entrega entrega = domicilio(c, r.tipoEntrega(), r.zonaId(), null, null, false, true);
        PrecioService.Cotizacion cot = precios.calcular(lineas(r.items(), false), catalogo.promocionesActivas(),
                entrega.valor(), fecha);
        Pedido p = nuevoPedido(cot, fecha, franja(c, r.franja()), r.tipoEntrega(), entrega.zona(), r.nombre(),
                Objects.requireNonNullElse(r.celular(), ""), r.barrio(), r.direccion(), "", r.notas());
        asignarPago(p, c, r.metodoPago(), r.cuentaId(), true);
        p.setOrigen(OrigenPedido.WHATSAPP);
        p.setEstado(EstadoPedido.CONFIRMADO);
        p.registrarEvento(EstadoPedido.NUEVO, "Pedido por WhatsApp", autor);
        p.registrarEvento(EstadoPedido.CONFIRMADO, "", autor);
        Pedido guardado = pedidoRepo.save(p);
        avisarCambio(guardado, "nuevo");
        return aDto(guardado);
    }

    @Transactional
    public AdminDto.Pedido cambiarEstado(Long id, EstadoPedido destino, String nota, String autor) {
        Pedido p = buscar(id);
        if (!p.getEstado().puedePasarA(destino, p.getTipoEntrega())) {
            throw ReglaNegocioException.conflicto("Un pedido «" + p.getEstado().mensaje(p.getTipoEntrega()).toLowerCase(Locale.ROOT)
                    + "» no puede pasar a «" + destino.mensaje(p.getTipoEntrega()).toLowerCase(Locale.ROOT) + "».");
        }
        p.setEstado(destino);
        p.registrarEvento(destino, nota, autor);
        avisarCambio(p, "estado");
        return aDto(p);
    }

    @Transactional
    public AdminDto.Pedido cambiarPago(Long id, EstadoPago estadoPago) {
        Pedido p = buscar(id);
        p.setEstadoPago(estadoPago);
        avisarCambio(p, "pago");
        return aDto(p);
    }

    // ------------------------------------------------------------------ apoyo

    /** lat/lng/km: solo con domicilio por distancia. */
    private record Entrega(int valor, String zona, Double lat, Double lng, Double km) {
        Entrega(int valor, String zona) { this(valor, zona, null, null, null); }
    }

    /** Domicilio por distancia: la empresa tiene mapas, lo escogió, marcó su local y tiene tramos. */
    boolean domicilioPorDistancia(ConfigTienda c) {
        return EmpresaContexto.tieneModulo(co.leinei.api.empresa.Modulos.MAPAS) && "DISTANCIA".equals(c.getDomicilioModo())
                && c.tieneUbicacion() && !Distancia.tramos(c.getDomicilioTramos()).isEmpty();
    }

    private static TipoEntrega tipoPorDefecto(ConfigTienda c, TipoEntrega pedido) {
        if (pedido != null) return pedido;
        return c.isDomicilioActivo() ? TipoEntrega.DOMICILIO : TipoEntrega.RECOGER;
    }

    /** Valor del domicilio según el tipo de entrega y la zona. estricto = exigir zona cuando hay zonas. */
    /**
     * @param estricto validar todo (al crear el pedido); sin estricto solo se calcula (cotizar).
     * @param admin pedido que registra el negocio a mano: sin punto en el mapa se cobra el valor fijo.
     */
    private Entrega domicilio(ConfigTienda c, TipoEntrega tipo, Long zonaId, Double lat, Double lng, boolean estricto, boolean admin) {
        if (tipo == TipoEntrega.RECOGER) {
            if (!c.isRecogerActivo() && estricto) throw ReglaNegocioException.invalido("Por ahora no tenemos recogida en el local.");
            return new Entrega(0, "");
        }
        if (!c.isDomicilioActivo() && estricto) throw ReglaNegocioException.invalido("Por ahora no tenemos domicilios.");
        if (estricto && c.domiciliosPausados(Instant.now())) {
            throw ReglaNegocioException.conflicto("Pausamos los domicilios un momento porque estamos a tope. Vuelven a las "
                    + DateTimeFormatter.ofPattern("h:mm a", ES_CO).format(c.getDomiciliosPausadosHasta().atZone(zona))
                    + (c.isRecogerActivo() ? " Mientras tanto puedes recogerlo en el local." : ""));
        }
        if (domicilioPorDistancia(c)) {
            if (lat == null || lng == null) {
                if (estricto) throw ReglaNegocioException.invalido("Marca en el mapa dónde te llevamos el pedido.");
                return new Entrega(admin ? c.getDomicilioValor() : 0, "");
            }
            List<Distancia.Tramo> tramos = Distancia.tramos(c.getDomicilioTramos());
            double km = Math.round(Distancia.km(c.getLocalLat(), c.getLocalLng(), lat, lng) * 100) / 100.0;
            Integer valor = Distancia.valor(tramos, km);
            if (valor == null) {
                throw ReglaNegocioException.invalido(String.format(ES_CO, "Tu dirección queda a %.1f km y llevamos domicilios hasta %s km.",
                        km, String.format(ES_CO, "%.1f", tramos.getLast().hastaKm()).replace(",0", ""))
                        + (c.isRecogerActivo() ? " Puedes pedir para recoger en el local." : ""));
            }
            return new Entrega(valor, String.format(ES_CO, "A %.1f km", km), lat, lng, km);
        }
        List<ZonaEnvio> zonas = configService.zonasActivas();
        if (zonas.isEmpty()) return new Entrega(c.getDomicilioValor(), "");
        Optional<ZonaEnvio> zona = zonas.stream().filter(z -> z.getId().equals(zonaId)).findFirst();
        if (zona.isEmpty()) {
            if (estricto) throw ReglaNegocioException.invalido("Escoge la zona o barrio de entrega.");
            return new Entrega(0, "");
        }
        return new Entrega(zona.get().getValor(), zona.get().getNombre());
    }

    private String franja(ConfigTienda c, String pedida) {
        if (c.getModoPedido() == ModoPedido.INMEDIATO) return LO_ANTES_POSIBLE;
        List<String> franjas = c.listaFranjas();
        String f = pedida == null ? "" : pedida.trim();
        if (franjas.isEmpty()) return f;
        if (!franjas.contains(f)) throw ReglaNegocioException.invalido("Escoge una de las horas de entrega disponibles.");
        return f;
    }

    /** Valida productos y opciones escogidas, y une las líneas iguales. */
    private List<PrecioService.Linea> lineas(List<PublicoDto.ItemPedido> items, boolean soloDisponibles) {
        Map<Long, Producto> productos = catalogo.productosPorId(items.stream().map(PublicoDto.ItemPedido::productoId).toList());
        Map<String, PrecioService.Linea> unidas = new LinkedHashMap<>();
        for (PublicoDto.ItemPedido item : items) {
            Producto p = productos.get(item.productoId());
            if (p == null) throw ReglaNegocioException.invalido("Uno de los productos ya no está en el catálogo. Actualiza la página.");
            if (soloDisponibles && !p.isDisponible()) throw ReglaNegocioException.conflicto(p.getNombre() + " está agotado.");
            List<Opcion> opciones = opcionesValidas(p, item.opciones(), soloDisponibles);
            String clave = p.getId() + ":" + opciones.stream().map(o -> String.valueOf(o.getId())).sorted().collect(Collectors.joining(","));
            PrecioService.Linea previa = unidas.get(clave);
            int cantidad = item.cantidad() + (previa == null ? 0 : previa.cantidad());
            if (cantidad > 99) throw ReglaNegocioException.invalido("Para más de 99 unidades de un producto escríbenos por WhatsApp.");
            unidas.put(clave, new PrecioService.Linea(p, cantidad, opciones));
        }
        return new ArrayList<>(unidas.values());
    }

    private List<Opcion> opcionesValidas(Producto p, List<Long> ids, boolean soloDisponibles) {
        Set<Long> pedidas = new LinkedHashSet<>(ids);
        List<Opcion> escogidas = new ArrayList<>();
        List<GrupoOpcion> grupos = co.leinei.api.empresa.EmpresaContexto.tieneModulo(co.leinei.api.empresa.Modulos.OPCIONES)
                ? p.getGrupos() : List.of();
        for (GrupoOpcion g : grupos) {
            List<Opcion> delGrupo = g.getOpciones().stream().filter(o -> pedidas.contains(o.getId())).toList();
            if (delGrupo.size() < g.getMinimo()) {
                throw ReglaNegocioException.invalido("En " + p.getNombre() + " escoge " + (g.getMinimo() == 1 ? "una opción" : g.getMinimo() + " opciones")
                        + " de «" + g.getNombre() + "».");
            }
            if (delGrupo.size() > g.getMaximo()) {
                throw ReglaNegocioException.invalido("En " + p.getNombre() + " puedes escoger máximo " + g.getMaximo() + " de «" + g.getNombre() + "».");
            }
            for (Opcion o : delGrupo) {
                if (soloDisponibles && !o.isDisponible()) throw ReglaNegocioException.conflicto(o.getNombre() + " está agotado.");
                escogidas.add(o);
                pedidas.remove(o.getId());
            }
        }
        if (!pedidas.isEmpty()) {
            throw ReglaNegocioException.invalido("Las opciones de " + p.getNombre() + " cambiaron. Vuelve a agregarlo al carrito.");
        }
        return escogidas;
    }

    private Pedido nuevoPedido(PrecioService.Cotizacion cot, LocalDate fecha, String franja, TipoEntrega tipo, String zona,
                               String nombre, String celular, String barrio, String direccion, String referencia, String notas) {
        Pedido p = new Pedido();
        p.setCodigo(codigoUnico());
        p.setFechaEntrega(fecha);
        p.setFranja(franja);
        p.setTipoEntrega(tipo);
        p.setZona(zona);
        p.setClienteNombre(nombre.trim());
        p.setClienteCelular(celular.replaceAll("\\D", ""));
        p.setBarrio(barrio == null ? "" : barrio.trim());
        p.setDireccion(direccion == null ? "" : direccion.trim());
        p.setReferencia(referencia == null ? "" : referencia.trim());
        p.setNotas(notas == null ? "" : notas.trim());
        for (PrecioService.LineaCotizada l : cot.lineas()) {
            PedidoItem i = new PedidoItem();
            i.setProductoId(l.productoId());
            i.setNombre(l.nombre());
            i.setDetalle(l.detalle());
            i.setPrecioUnitario(l.precioUnitario());
            i.setCostoUnitario(l.costoUnitario());
            i.setCantidad(l.cantidad());
            p.agregarItem(i);
        }
        p.setSubtotal(cot.subtotal());
        p.setDescuento(cot.descuento());
        p.setPromocionAplicada(cot.promocion());
        p.setDomicilio(cot.domicilio());
        p.setTotal(cot.total());
        p.setCostoTotal(cot.costoTotal());
        return p;
    }

    private void asignarPago(Pedido p, ConfigTienda c, MetodoPago metodo, Long cuentaId, boolean admin) {
        p.setMetodoPago(metodo);
        if (metodo == MetodoPago.EFECTIVO) {
            if (!c.isEfectivo() && !admin) throw ReglaNegocioException.invalido("Por ahora no recibimos pagos en efectivo.");
            p.setCuentaEntidad("");
            p.setCuentaTitular("");
            p.setCuentaNumero("");
            return;
        }
        if (metodo == MetodoPago.EN_LINEA) {
            if (admin) throw ReglaNegocioException.invalido("El pago en línea lo hace el cliente desde la tienda. Escoge otra forma de pago.");
            ConfigPagosService.Activa activa = pagosEnLinea.activa(EmpresaContexto.requerida())
                    .orElseThrow(() -> ReglaNegocioException.invalido("Por ahora no recibimos pagos en línea. Escoge otra forma de pago."));
            p.setCuentaEntidad("Pago en línea");
            p.setCuentaTitular(activa.proveedor().nombre());
            p.setCuentaNumero("");
            return;
        }
        List<CuentaPago> cuentas = configService.cuentasActivas();
        CuentaPago cuenta = cuentas.stream().filter(n -> n.getId().equals(cuentaId)).findFirst()
                .orElse(cuentaId == null && !cuentas.isEmpty() ? cuentas.getFirst() : null);
        if (cuenta == null) throw ReglaNegocioException.invalido("Escoge una cuenta de pago válida.");
        p.setCuentaEntidad(cuenta.getEntidad());
        p.setCuentaTitular(cuenta.getTitular());
        p.setCuentaNumero(cuenta.getNumero());
    }

    private String codigoUnico() {
        for (int intento = 0; intento < 20; intento++) {
            StringBuilder sb = new StringBuilder("P-");
            for (int i = 0; i < 6; i++) sb.append(ALFABETO.charAt(AZAR.nextInt(ALFABETO.length())));
            String codigo = sb.toString();
            if (!pedidoRepo.existsByCodigo(codigo)) return codigo;
        }
        throw new IllegalStateException("No se pudo generar un código de pedido único");
    }

    private Pedido buscar(Long id) {
        return pedidoRepo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese pedido no existe."));
    }

    private static boolean blanco(String s) { return s == null || s.isBlank(); }

    AdminDto.Pedido aDto(Pedido p) {
        return aDto(p, p.getId() != null && comprobantes.countByPedidoId(p.getId()) > 0);
    }

    AdminDto.Pedido aDto(Pedido p, boolean tieneComprobante) {
        Domiciliario d = p.getDomiciliario();
        List<AdminDto.Item> items = p.getItems().stream()
                .map(i -> new AdminDto.Item(i.getProductoId(), i.getNombre(), i.getDetalle(), i.getCantidad(),
                        i.getPrecioUnitario(), i.getCostoUnitario()))
                .toList();
        List<AdminDto.Evento> eventos = p.getEventos().stream()
                .map(e -> new AdminDto.Evento(e.getEstado(), e.getNota(), e.getAutor(), e.getCreado()))
                .toList();
        return new AdminDto.Pedido(p.getId(), p.getCodigo(), p.getCreado(), p.getFechaEntrega(), p.getFranja(),
                p.getTipoEntrega(), p.getZona(), EstadoPedido.flujo(p.getTipoEntrega()),
                p.getClienteNombre(), p.getClienteCelular(), p.getBarrio(), p.getDireccion(), p.getReferencia(),
                p.getNotas(), items, p.getSubtotal(), p.getDescuento(), p.getPromocionAplicada(), p.getDomicilio(),
                p.getTotal(), p.getCostoTotal(), p.getMetodoPago(), p.getCuentaEntidad(), p.getCuentaTitular(),
                p.getCuentaNumero(), p.getEstadoPago(), p.getEstado(), p.getOrigen(), eventos,
                tieneComprobante, p.getPagoReportado(),
                d == null ? null : d.getId(), d == null ? "" : d.getNombre(), d == null ? "" : d.getCelular(),
                p.getEntregaLat(), p.getEntregaLng(), p.getDistanciaKm());
    }

    /** Avisa al portal de la empresa y al cliente que sigue ese pedido (después de guardar). */
    private void avisarCambio(Pedido p, String motivo) {
        long empresa = EmpresaContexto.requerida().id();
        tiempoReal.publicar("pedido", Map.of("id", p.getId(), "codigo", p.getCodigo(), "motivo", motivo),
                TiempoReal.admin(empresa), TiempoReal.pedido(empresa, p.getCodigo()));
    }

    private static String pesos(int valor) {
        return "$" + String.format(ES_CO, "%,d", valor);
    }

    private static String comoPaga(Pedido p) {
        return switch (p.getMetodoPago()) {
            case CUENTA -> "paga por " + p.getCuentaEntidad();
            case EN_LINEA -> "paga en línea (" + p.getCuentaTitular() + ")";
            case EFECTIVO -> "paga en efectivo";
        };
    }

    private static String lugar(Pedido p) {
        String zonaOBarrio = !p.getZona().isBlank() ? p.getZona() : p.getBarrio();
        return zonaOBarrio.isBlank() ? "domicilio" : zonaOBarrio;
    }

    /** Imagen (PNG, JPG, WebP) o PDF, revisando los primeros bytes. */
    static String tipoComprobante(byte[] b) {
        String imagen = ArchivoService.tipoDe(b);
        if (imagen != null) return imagen;
        if (b.length > 4 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') return "application/pdf";
        return null;
    }
}
