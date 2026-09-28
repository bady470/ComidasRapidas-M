package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.PublicoDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
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

    public PedidoService(PedidoRepositorio pedidoRepo, CatalogoService catalogo, ConfigService configService,
                         PrecioService precios, co.leinei.api.config.LeineiProperties props) {
        this.zona = ZoneId.of(props.zonaHoraria());
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
        int domicilio = domicilio(c, tipo, r.zonaId(), false).valor();
        return precios.calcular(lineas(r.items(), true), catalogo.promocionesActivas(), domicilio, fecha);
    }

    @Transactional
    public PublicoDto.PedidoCreado crear(PublicoDto.CrearPedidoRequest r) {
        ConfigTienda c = configService.tienda();
        DisponibilidadService.Disponibilidad d = configService.disponibilidad();
        if (!c.isAbierto()) {
            throw ReglaNegocioException.conflicto("En este momento no estamos recibiendo pedidos. Escríbenos por WhatsApp.");
        }
        if (!d.recibePedidos()) {
            String cuando = d.proximaApertura() == null ? "" : " Abrimos " + DateTimeFormatter.ofPattern("EEEE 'a las' h:mm a",
                    ES_CO).format(d.proximaApertura().atZone(zona)) + ".";
            throw ReglaNegocioException.conflicto("Estamos cerrados en este momento." + cuando);
        }
        Entrega entrega = domicilio(c, r.tipoEntrega(), r.zonaId(), true);
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
        p.setOrigen(OrigenPedido.WEB);
        p.registrarEvento(EstadoPedido.NUEVO, "", "cliente");
        pedidoRepo.save(p);

        return new PublicoDto.PedidoCreado(p.getCodigo(), p.getFechaEntrega(), p.getFranja(), p.getTipoEntrega(),
                c.getModoPedido(), c.getTiempoMin(), c.getTiempoMax(), p.getTotal(), p.getMetodoPago(),
                p.getCuentaEntidad(), p.getCuentaTitular(), p.getCuentaNumero(), c.getWhatsapp(),
                p.getTipoEntrega() == TipoEntrega.RECOGER ? c.getDireccion() : "");
    }

    /** El cliente consulta con su código y su celular; si no coinciden, responde como si no existiera. */
    @Transactional(readOnly = true)
    public PublicoDto.Seguimiento seguimiento(String codigo, String celular) {
        String limpio = celular == null ? "" : celular.replaceAll("\\D", "");
        Pedido p = pedidoRepo.findByCodigo(codigo.trim().toUpperCase(Locale.ROOT))
                .filter(x -> !limpio.isEmpty() && x.getClienteCelular().equals(limpio))
                .orElseThrow(() -> ReglaNegocioException.noEncontrado(
                        "No encontramos un pedido con ese código y ese celular. Revisa los datos."));
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
                p.getCreado(), direccionTienda);
    }

    // ------------------------------------------------------------------ administrador

    @Transactional(readOnly = true)
    public List<AdminDto.Pedido> listar(LocalDate fecha, EstadoPedido estado, String busqueda) {
        List<Pedido> base = fecha != null
                ? pedidoRepo.findByFechaEntregaOrderByCreadoDesc(fecha)
                : pedidoRepo.findAllByOrderByCreadoDesc(PageRequest.of(0, 300));
        String q = busqueda == null ? "" : busqueda.trim().toLowerCase(Locale.ROOT);
        return base.stream()
                .filter(p -> estado == null || p.getEstado() == estado)
                .filter(p -> q.isEmpty() || (p.getCodigo() + " " + p.getClienteNombre() + " " + p.getClienteCelular()
                        + " " + p.getBarrio() + " " + p.getZona()).toLowerCase(Locale.ROOT).contains(q))
                .map(this::aDto)
                .toList();
    }

    /** Pedido que llegó por WhatsApp o por teléfono. No revisa el horario ni el pedido mínimo. */
    @Transactional
    public AdminDto.Pedido crearManual(AdminDto.PedidoManualRequest r, String autor) {
        ConfigTienda c = configService.tienda();
        LocalDate fecha = r.fechaEntrega() != null ? r.fechaEntrega() : configService.disponibilidad().fechaServicio();
        Entrega entrega = domicilio(c, r.tipoEntrega(), r.zonaId(), false);
        PrecioService.Cotizacion cot = precios.calcular(lineas(r.items(), false), catalogo.promocionesActivas(),
                entrega.valor(), fecha);
        Pedido p = nuevoPedido(cot, fecha, franja(c, r.franja()), r.tipoEntrega(), entrega.zona(), r.nombre(),
                Objects.requireNonNullElse(r.celular(), ""), r.barrio(), r.direccion(), "", r.notas());
        asignarPago(p, c, r.metodoPago(), r.cuentaId(), true);
        p.setOrigen(OrigenPedido.WHATSAPP);
        p.setEstado(EstadoPedido.CONFIRMADO);
        p.registrarEvento(EstadoPedido.NUEVO, "Pedido por WhatsApp", autor);
        p.registrarEvento(EstadoPedido.CONFIRMADO, "", autor);
        return aDto(pedidoRepo.save(p));
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
        return aDto(p);
    }

    @Transactional
    public AdminDto.Pedido cambiarPago(Long id, EstadoPago estadoPago) {
        Pedido p = buscar(id);
        p.setEstadoPago(estadoPago);
        return aDto(p);
    }

    // ------------------------------------------------------------------ apoyo

    private record Entrega(int valor, String zona) {}

    private static TipoEntrega tipoPorDefecto(ConfigTienda c, TipoEntrega pedido) {
        if (pedido != null) return pedido;
        return c.isDomicilioActivo() ? TipoEntrega.DOMICILIO : TipoEntrega.RECOGER;
    }

    /** Valor del domicilio según el tipo de entrega y la zona. estricto = exigir zona cuando hay zonas. */
    private Entrega domicilio(ConfigTienda c, TipoEntrega tipo, Long zonaId, boolean estricto) {
        if (tipo == TipoEntrega.RECOGER) {
            if (!c.isRecogerActivo() && estricto) throw ReglaNegocioException.invalido("Por ahora no tenemos recogida en el local.");
            return new Entrega(0, "");
        }
        if (!c.isDomicilioActivo() && estricto) throw ReglaNegocioException.invalido("Por ahora no tenemos domicilios.");
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
                p.getCuentaNumero(), p.getEstadoPago(), p.getEstado(), p.getOrigen(), eventos);
    }
}
