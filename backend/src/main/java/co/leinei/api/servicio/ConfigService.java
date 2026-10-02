package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.pagos.ConfigPagosService;
import co.leinei.api.pagos.PagosDto;
import co.leinei.api.plataforma.servicio.MarcaService;
import co.leinei.api.repositorio.*;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.MapaDto;
import co.leinei.api.web.dto.PublicoDto;
import co.leinei.api.tiemporeal.TiempoReal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;

@Service
public class ConfigService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final ConfigTiendaRepositorio configRepo;
    private final HorarioRepositorio horarioRepo;
    private final ZonaEnvioRepositorio zonaRepo;
    private final CuentaPagoRepositorio cuentaRepo;
    private final MarcaService marca;
    private final DisponibilidadService disponibilidad;
    private final ConfigPagosService pagosEnLinea;
    private final TiempoReal tiempoReal;

    public ConfigService(ConfigTiendaRepositorio configRepo, HorarioRepositorio horarioRepo, ZonaEnvioRepositorio zonaRepo,
                         CuentaPagoRepositorio cuentaRepo, MarcaService marca,
                         DisponibilidadService disponibilidad, ConfigPagosService pagosEnLinea, TiempoReal tiempoReal) {
        this.pagosEnLinea = pagosEnLinea;
        this.tiempoReal = tiempoReal;
        this.configRepo = configRepo;
        this.horarioRepo = horarioRepo;
        this.zonaRepo = zonaRepo;
        this.cuentaRepo = cuentaRepo;
        this.marca = marca;
        this.disponibilidad = disponibilidad;
    }

    // ------------------------------------------------------------------ lectura

    @Transactional(readOnly = true)
    public ConfigTienda tienda() {
        return configRepo.findById((short) 1)
                .orElseThrow(() -> new IllegalStateException("Falta la configuración de la tienda (migración V2)"));
    }

    @Transactional(readOnly = true)
    public List<Horario> horarios() {
        return horarioRepo.findAllByOrderByDiaAsc();
    }

    @Transactional(readOnly = true)
    public DisponibilidadService.Disponibilidad disponibilidad() {
        return disponibilidad.calcular(tienda(), horarios());
    }

    /** Zonas con valor propio; sin el módulo de zonas se cobra el valor único de domicilio. */
    @Transactional(readOnly = true)
    public List<ZonaEnvio> zonasActivas() {
        if (!EmpresaContexto.tieneModulo(Modulos.ZONAS)) return List.of();
        return zonaRepo.findByActivaTrueOrderByOrdenAscIdAsc();
    }

    @Transactional(readOnly = true)
    public List<CuentaPago> cuentasActivas() {
        return cuentaRepo.findByActivaTrueOrderByOrdenAscIdAsc();
    }

    /** Lo que el cliente necesita saber de la tienda: marca, si recibe pedidos, cómo entrega y cómo se paga. */
    @Transactional(readOnly = true)
    public PublicoDto.Tienda tiendaPublica() {
        ConfigTienda c = tienda();
        List<Horario> horarios = horarios();
        DisponibilidadService.Disponibilidad d = disponibilidad.calcular(c, horarios);
        // Modo «estamos llenos»: pausas y minutos extra vigentes en este momento.
        Instant ahora = Instant.now();
        boolean domicilio = c.domicilioDisponible(ahora);
        int extra = c.minutosExtraVigentes(ahora);
        boolean recibe = d.recibePedidos() && !c.pedidosPausados(ahora) && (domicilio || c.isRecogerActivo());
        MapaDto.EntregaPublica entrega = entregaPublica(c);
        List<PublicoDto.Zona> zonas = domicilio && !"DISTANCIA".equals(entrega.modo())
                ? zonasActivas().stream().map(z -> new PublicoDto.Zona(z.getId(), z.getNombre(), z.getValor())).toList()
                : List.of();
        List<PublicoDto.Cuenta> cuentas = cuentasActivas().stream()
                .map(n -> new PublicoDto.Cuenta(n.getId(), n.getEntidad(), n.getTitular(), n.getNumero())).toList();
        List<PublicoDto.HorarioDia> hs = horarios.stream()
                .map(h -> new PublicoDto.HorarioDia(h.getDia(), h.isActivo(), h.getAbre().format(HH_MM), h.getCierra().format(HH_MM)))
                .toList();
        EmpresaActual e = EmpresaContexto.requerida();
        return new PublicoDto.Tienda(e.identificador(), e.nombreComercial(), c.getEslogan(), c.getTituloPortada(), c.getMensaje(),
                e.logoUrl(), e.colorPrimario(), e.colorSecundario(), c.getWhatsapp(), c.getDireccion(), c.getCiudad(),
                c.getInstagram(), c.isAbierto(), c.getModoPedido(), recibe, d.enHorario(), d.fechaServicio(),
                d.cierre(), d.proximaApertura(), c.getTiempoMin() + extra, c.getTiempoMax() + extra, c.listaFranjas(),
                c.getPedidoMinimo(), hs, domicilio, c.getDomicilioValor(), zonas, c.isRecogerActivo(),
                c.isEfectivo(), cuentas, e.modulos().stream().sorted().toList(),
                pagosEnLinea.activa(e).map(a -> new PagosDto.PagoPublico(a.proveedor().name(), a.proveedor().nombre(),
                        a.proveedor().medios())).orElse(null),
                saturacion(c, ahora), entrega);
    }

    /** Cómo se cobra el domicilio: por distancia (si está lista), por zonas o un valor fijo. */
    private MapaDto.EntregaPublica entregaPublica(ConfigTienda c) {
        boolean mapas = EmpresaContexto.tieneModulo(Modulos.MAPAS);
        List<Distancia.Tramo> tramos = Distancia.tramos(c.getDomicilioTramos());
        if (mapas && "DISTANCIA".equals(c.getDomicilioModo()) && c.tieneUbicacion() && !tramos.isEmpty()) {
            return new MapaDto.EntregaPublica("DISTANCIA", c.getLocalLat(), c.getLocalLng(),
                    tramos.stream().map(t -> new MapaDto.Tramo(t.hastaKm(), t.valor())).toList(), tramos.getLast().hastaKm());
        }
        String modo = zonasActivas().isEmpty() ? "FIJO" : "ZONAS";
        // La ubicación del local igual sirve para mostrarlo en el mapa del seguimiento.
        return new MapaDto.EntregaPublica(modo, mapas ? c.getLocalLat() : null, mapas ? c.getLocalLng() : null, List.of(), null);
    }

    // ------------------------------------------------------------------ mapas

    @Transactional(readOnly = true)
    public MapaDto.ConfigMapa mapa() {
        ConfigTienda c = tienda();
        return new MapaDto.ConfigMapa(c.getLocalLat(), c.getLocalLng(), c.getDomicilioModo(),
                Distancia.tramos(c.getDomicilioTramos()).stream().map(t -> new MapaDto.Tramo(t.hastaKm(), t.valor())).toList(),
                c.isSeguimientoVivo());
    }

    @Transactional
    public MapaDto.ConfigMapa guardarMapa(MapaDto.ConfigMapa r) {
        List<MapaDto.Tramo> tramos = r.tramos() == null ? List.of() : r.tramos();
        if ((r.localLat() == null) != (r.localLng() == null)) throw ReglaNegocioException.invalido("La ubicación del local está incompleta.");
        if ("DISTANCIA".equals(r.modo())) {
            if (r.localLat() == null) throw ReglaNegocioException.invalido("Marca en el mapa dónde queda tu local para cobrar por distancia.");
            if (tramos.isEmpty()) throw ReglaNegocioException.invalido("Agrega al menos un tramo (hasta cuántos km y cuánto vale).");
        }
        List<Distancia.Tramo> orden = tramos.stream().map(t -> new Distancia.Tramo(Math.round(t.hastaKm() * 10) / 10.0, t.valor()))
                .sorted(java.util.Comparator.comparingDouble(Distancia.Tramo::hastaKm)).toList();
        for (int i = 1; i < orden.size(); i++) {
            if (orden.get(i).hastaKm() == orden.get(i - 1).hastaKm()) throw ReglaNegocioException.invalido("Hay dos tramos con los mismos km.");
        }
        ConfigTienda c = tienda();
        c.setLocalLat(r.localLat());
        c.setLocalLng(r.localLng());
        c.setDomicilioModo(r.modo());
        c.setDomicilioTramos(Distancia.texto(orden));
        c.setSeguimientoVivo(r.seguimientoVivo());
        long empresa = EmpresaContexto.requerida().id();
        tiempoReal.publicar("catalogo", Map.of(), TiempoReal.tienda(empresa), TiempoReal.admin(empresa));
        return mapa();
    }

    private static PublicoDto.Saturacion saturacion(ConfigTienda c, Instant ahora) {
        int extra = c.minutosExtraVigentes(ahora);
        return new PublicoDto.Saturacion(extra, extra > 0 ? c.getDemoraHasta() : null,
                c.domiciliosPausados(ahora) ? c.getDomiciliosPausadosHasta() : null,
                c.pedidosPausados(ahora) ? c.getPedidosPausadosHasta() : null);
    }

    /** Cómo se imprimen las comandas de la cocina. */
    @Transactional(readOnly = true)
    public co.leinei.api.web.dto.OperacionDto.ConfigCocina cocina() {
        ConfigTienda c = tienda();
        return new co.leinei.api.web.dto.OperacionDto.ConfigCocina(c.getImpresionModo(), c.getImpresionMomento(),
                c.isImpresionEsperaPago(), c.getImpresionPapel(), c.getImpresionCopias(), c.isImpresionPrecios(), c.getImpresionPie());
    }

    @Transactional
    public co.leinei.api.web.dto.OperacionDto.ConfigCocina guardarCocina(co.leinei.api.web.dto.OperacionDto.ConfigCocina r) {
        if (r.papel() != 58 && r.papel() != 80) throw ReglaNegocioException.invalido("El papel debe ser de 58 u 80 mm.");
        ConfigTienda c = tienda();
        c.setImpresionModo(r.modo());
        c.setImpresionMomento(r.momento());
        c.setImpresionEsperaPago(r.esperaPago());
        c.setImpresionPapel(r.papel());
        c.setImpresionCopias(r.copias());
        c.setImpresionPrecios(r.precios());
        c.setImpresionPie(limpio(r.pie()));
        // Los demás equipos del portal (la cocina) toman la configuración nueva al instante.
        tiempoReal.publicar("cocina", Map.of(), TiempoReal.admin(EmpresaContexto.requerida().id()));
        return cocina();
    }

    /**
     * Modo «estamos llenos»: sube el tiempo de entrega, pausa los domicilios o pausa todos los pedidos por un rato.
     * Cada ajuste vence solo. Las tiendas abiertas y los demás administradores lo ven al instante.
     */
    @Transactional
    public PublicoDto.Saturacion cambiarSaturacion(co.leinei.api.web.dto.OperacionDto.SaturacionRequest r) {
        ConfigTienda c = tienda();
        Instant ahora = Instant.now();
        Instant hasta = ahora.plus(java.time.Duration.ofMinutes(r.duracion()));
        boolean conDuracion = r.accion().equals("DEMORA") || r.accion().startsWith("PAUSAR");
        if (conDuracion && r.duracion() < 5) throw ReglaNegocioException.invalido("Escoge por cuánto tiempo (mínimo 5 minutos).");
        switch (r.accion()) {
            case "DEMORA" -> {
                if (r.minutosExtra() < 5) throw ReglaNegocioException.invalido("Escoge cuántos minutos más se demoran los pedidos.");
                c.setMinutosExtra(r.minutosExtra());
                c.setDemoraHasta(hasta);
            }
            case "PAUSAR_DOMICILIOS" -> {
                if (!c.isDomicilioActivo()) throw ReglaNegocioException.conflicto("Tu tienda no tiene domicilios activos.");
                c.setDomiciliosPausadosHasta(hasta);
            }
            case "PAUSAR_PEDIDOS" -> c.setPedidosPausadosHasta(hasta);
            case "QUITAR_DEMORA" -> { c.setMinutosExtra(0); c.setDemoraHasta(null); }
            case "REANUDAR_DOMICILIOS" -> c.setDomiciliosPausadosHasta(null);
            case "REANUDAR_PEDIDOS" -> c.setPedidosPausadosHasta(null);
            default -> {
                c.setMinutosExtra(0);
                c.setDemoraHasta(null);
                c.setDomiciliosPausadosHasta(null);
                c.setPedidosPausadosHasta(null);
            }
        }
        long empresa = EmpresaContexto.requerida().id();
        tiempoReal.publicar("catalogo", Map.of(), TiempoReal.tienda(empresa), TiempoReal.admin(empresa));
        return saturacion(c, ahora);
    }

    @Transactional(readOnly = true)
    public AdminDto.Config verAdmin() {
        ConfigTienda c = tienda();
        List<AdminDto.Horario> horarios = horarios().stream()
                .map(h -> new AdminDto.Horario(h.getDia(), h.isActivo(), h.getAbre().format(HH_MM), h.getCierra().format(HH_MM)))
                .toList();
        List<AdminDto.Zona> zonas = zonaRepo.findAllByOrderByOrdenAscIdAsc().stream()
                .map(z -> new AdminDto.Zona(z.getId(), z.getNombre(), z.getValor(), z.isActiva())).toList();
        List<AdminDto.Cuenta> cuentas = cuentaRepo.findAllByOrderByOrdenAscIdAsc().stream()
                .map(n -> new AdminDto.Cuenta(n.getId(), n.getEntidad(), n.getTitular(), n.getNumero(), n.isActiva()))
                .toList();
        EmpresaActual e = EmpresaContexto.requerida();
        return new AdminDto.Config(e.nombreComercial(), c.getEslogan(), c.getTituloPortada(), c.getMensaje(), e.logoUrl(),
                e.colorPrimario(), e.colorSecundario(), c.getWhatsapp(), c.getDireccion(), c.getCiudad(),
                c.getInstagram(), c.isAbierto(), c.getModoPedido(), c.getTiempoMin(), c.getTiempoMax(),
                c.getDiaEntrega(), c.getCierreDiasAntes(), c.getCierreHora(), c.listaFranjas(), c.getPedidoMinimo(),
                horarios, c.isDomicilioActivo(), c.getDomicilioValor(), zonas, c.isRecogerActivo(), c.isEfectivo(),
                cuentas, c.getCostoOperativoUnidad());
    }

    // ------------------------------------------------------------------ guardar

    @Transactional
    public AdminDto.Config actualizar(AdminDto.Config r) {
        List<AdminDto.Cuenta> cuentas = r.cuentas() == null ? List.of() : r.cuentas();
        List<AdminDto.Zona> zonas = r.zonas() == null ? List.of() : r.zonas();
        if (!r.domicilioActivo() && !r.recogerActivo()) {
            throw ReglaNegocioException.invalido("Activa al menos una forma de entrega: domicilio o recoger en el local.");
        }
        if (!r.efectivo() && cuentas.stream().noneMatch(AdminDto.Cuenta::activa)
                && pagosEnLinea.activa(EmpresaContexto.requerida()).isEmpty()) {
            throw ReglaNegocioException.invalido("Activa al menos una forma de pago: una cuenta, efectivo o pago en línea.");
        }
        if (r.tiempoMin() > r.tiempoMax()) {
            throw ReglaNegocioException.invalido("El tiempo mínimo de entrega no puede ser mayor que el máximo.");
        }
        if (r.recogerActivo() && blanco(r.direccion())) {
            throw ReglaNegocioException.invalido("Escribe la dirección del local para que los clientes puedan recoger.");
        }
        Set<Integer> dias = new HashSet<>();
        if (r.horarios() != null) r.horarios().forEach(h -> dias.add(h.dia()));
        if (dias.size() != 7) throw ReglaNegocioException.invalido("El horario necesita los 7 días de la semana.");

        // La marca vive en la base de control: se guarda allá.
        marca.actualizarDesdeEmpresa(EmpresaContexto.requerida(), r.nombre().trim(), r.colorPrimario(), r.colorSecundario());

        ConfigTienda c = tienda();
        c.setEslogan(limpio(r.eslogan()));
        c.setTituloPortada(limpio(r.tituloPortada()));
        c.setMensaje(limpio(r.mensaje()));
        c.setWhatsapp(limpio(r.whatsapp()));
        c.setDireccion(limpio(r.direccion()));
        c.setCiudad(limpio(r.ciudad()));
        c.setInstagram(limpio(r.instagram()).replaceFirst("^@", ""));
        c.setAbierto(r.abierto());
        c.setModoPedido(r.modoPedido());
        c.setTiempoMin(r.tiempoMin());
        c.setTiempoMax(r.tiempoMax());
        c.setDiaEntrega(r.diaEntrega());
        c.setCierreDiasAntes(r.cierreDiasAntes());
        c.setCierreHora(r.cierreHora());
        c.setFranjas(String.join("\n", (r.franjas() == null ? List.<String>of() : r.franjas()).stream()
                .map(String::trim).filter(s -> !s.isEmpty()).toList()));
        c.setPedidoMinimo(r.pedidoMinimo());
        c.setDomicilioActivo(r.domicilioActivo());
        c.setDomicilioValor(r.domicilioValor());
        c.setRecogerActivo(r.recogerActivo());
        c.setEfectivo(r.efectivo());
        c.setCostoOperativoUnidad(r.costoOperativoUnidad());

        for (AdminDto.Horario h : r.horarios()) {
            Horario e = horarioRepo.findByDia((short) h.dia())
                    .orElseGet(() -> new Horario(h.dia(), true, LocalTime.of(10, 0), LocalTime.of(22, 0)));
            e.setActivo(h.activo());
            e.setAbre(hora(h.abre()));
            e.setCierra(hora(h.cierra()));
            horarioRepo.save(e);
        }

        if (EmpresaContexto.tieneModulo(Modulos.ZONAS)) reemplazar(zonas, AdminDto.Zona::id, zonaRepo, ZonaEnvio::new, ZonaEnvio::getId, (z, req, orden) -> {
            z.setNombre(req.nombre().trim());
            z.setValor(req.valor());
            z.setActiva(req.activa());
            z.setOrden(orden);
        });
        reemplazar(cuentas, AdminDto.Cuenta::id, cuentaRepo, CuentaPago::new, CuentaPago::getId, (n, req, orden) -> {
            n.setEntidad(req.entidad().trim());
            n.setTitular(req.titular().trim());
            n.setNumero(req.numero().trim());
            n.setActiva(req.activa());
            n.setOrden(orden);
        });
        return verAdmin();
    }

    private interface Aplicar<E, R> { void en(E entidad, R req, int orden); }

    /** Actualiza las filas que llegan con id, crea las nuevas y borra las que ya no están. */
    private <E, R> void reemplazar(List<R> lista, Function<R, Long> idReq,
                                   org.springframework.data.jpa.repository.JpaRepository<E, Long> repo,
                                   Supplier<E> nuevo, Function<E, Long> idEntidad, Aplicar<E, R> aplicar) {
        Map<Long, E> existentes = new HashMap<>();
        repo.findAll().forEach(e -> existentes.put(idEntidad.apply(e), e));
        Set<Long> conservadas = new HashSet<>();
        int orden = 1;
        for (R req : lista) {
            Long id = idReq.apply(req);
            E e = id != null && existentes.containsKey(id) ? existentes.get(id) : nuevo.get();
            aplicar.en(e, req, orden++);
            conservadas.add(idEntidad.apply(repo.save(e)));
        }
        existentes.keySet().stream().filter(id -> !conservadas.contains(id)).forEach(repo::deleteById);
    }

    private static LocalTime hora(String hhmm) {
        try {
            return LocalTime.parse(hhmm, HH_MM);
        } catch (Exception e) {
            throw ReglaNegocioException.invalido("La hora " + hhmm + " no es válida.");
        }
    }

    private static boolean blanco(String s) { return s == null || s.isBlank(); }

    private static String limpio(String s) { return s == null ? "" : s.trim(); }
}
