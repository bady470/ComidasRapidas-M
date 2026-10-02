package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.empresa.SedeContexto;
import co.leinei.api.repositorio.*;
import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.MapaDto;
import co.leinei.api.web.dto.SedesDto;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Varias sedes. Toda empresa tiene una sede principal; con el módulo «sedes» puede tener más.
 *
 * Sin el módulo, todo usa la configuración de la tienda como siempre (y la principal se mantiene igual a ella, para
 * que al activar el módulo no haya sorpresas). Con el módulo:
 *  - Lo que cambia por sede (dirección, ubicación, tramos, abierto, tiempos, «estamos llenos», horario) sale de la
 *    sede de la petición (encabezado X-Sede) o de la principal.
 *  - El menú es el de la empresa. Cada sede puede marcar productos agotados y, con el menú «por sede», decidir qué
 *    productos ofrece y con qué precio.
 */
@Service
public class SedeService {

    public static final String MENU_COMPARTIDO = "COMPARTIDO";
    public static final String MENU_POR_SEDE = "POR_SEDE";
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final SedeRepositorio repo;
    private final ProductoSedeRepositorio productosSede;
    private final ProductoRepositorio productos;
    private final HorarioRepositorio horarios;
    private final ConfigTiendaRepositorio configRepo;
    private final TiempoReal tiempoReal;

    public SedeService(SedeRepositorio repo, ProductoSedeRepositorio productosSede, ProductoRepositorio productos,
                       HorarioRepositorio horarios, ConfigTiendaRepositorio configRepo, TiempoReal tiempoReal) {
        this.repo = repo;
        this.productosSede = productosSede;
        this.productos = productos;
        this.horarios = horarios;
        this.configRepo = configRepo;
        this.tiempoReal = tiempoReal;
    }

    // ------------------------------------------------------------------ sede de la petición

    /** La empresa trabaja con varias sedes. */
    public boolean activas() {
        return EmpresaContexto.tieneModulo(Modulos.SEDES);
    }

    @Transactional(readOnly = true)
    public Sede principal() {
        return repo.findFirstByPrincipalTrue()
                .orElseThrow(() -> new IllegalStateException("La empresa no tiene sede principal (migración empresa-014)"));
    }

    /** Sede de esta petición: la escogida si existe y está activa; si no, la principal. Sin el módulo, null. */
    @Transactional(readOnly = true)
    public Sede actual() {
        if (!activas()) return null;
        Long id = SedeContexto.pedida();
        if (id != null) {
            Optional<Sede> s = repo.findById(id).filter(Sede::isActiva);
            if (s.isPresent()) return s.get();
        }
        return principal();
    }

    /** Filtro del portal: la sede escogida en la barra, o null para ver todas (o si no hay varias sedes). */
    @Transactional(readOnly = true)
    public Long filtro() {
        if (!activas()) return null;
        Long id = SedeContexto.pedida();
        return id != null && repo.existsById(id) ? id : null;
    }

    /** Sede donde queda un pedido nuevo (sin el módulo, la principal: así ya queda bien si se activa luego). */
    @Transactional(readOnly = true)
    public Long paraPedido() {
        Sede s = actual();
        return s != null ? s.getId() : principal().getId();
    }

    /** La sede, o null si no existe. */
    @Transactional(readOnly = true)
    public Sede porId(Long id) {
        return id == null ? null : repo.findById(id).orElse(null);
    }

    @Transactional(readOnly = true)
    public Map<Long, String> nombres() {
        return repo.findAll().stream().collect(Collectors.toMap(Sede::getId, Sede::getNombre));
    }

    @Transactional(readOnly = true)
    public List<Sede> activasLista() {
        return repo.findByActivaTrueOrderByOrdenAscIdAsc();
    }

    /**
     * La configuración de la tienda vista desde una sede: una COPIA (nunca se guarda) con lo que cambia por sede.
     * Sin sede (sin el módulo), la configuración tal cual.
     */
    public ConfigTienda vista(ConfigTienda c, Sede s) {
        if (s == null) return c;
        ConfigTienda v = new ConfigTienda();
        BeanUtils.copyProperties(c, v);
        if (!s.getDireccion().isBlank()) v.setDireccion(s.getDireccion());
        if (!s.getCiudad().isBlank()) v.setCiudad(s.getCiudad());
        if (!s.getWhatsapp().isBlank()) v.setWhatsapp(s.getWhatsapp());
        v.setAbierto(c.isAbierto() && s.isAbierta());
        v.setTiempoMin(s.getTiempoMin());
        v.setTiempoMax(s.getTiempoMax());
        v.setLocalLat(s.getLocalLat());
        v.setLocalLng(s.getLocalLng());
        v.setDomicilioTramos(s.getDomicilioTramos());
        v.setMinutosExtra(s.getMinutosExtra());
        v.setDemoraHasta(s.getDemoraHasta());
        v.setDomiciliosPausadosHasta(s.getDomiciliosPausadosHasta());
        v.setPedidosPausadosHasta(s.getPedidosPausadosHasta());
        return v;
    }

    /** Horario de la sede (sin el módulo, el de la principal). */
    @Transactional(readOnly = true)
    public List<Horario> horarios(Sede s) {
        return horarios.findBySedeIdOrderByDiaAsc(s != null ? s.getId() : principal().getId());
    }

    /** Pone en los productos lo de la sede: agotado y, con el menú por sede, si se ofrece y su precio. */
    @Transactional(readOnly = true)
    public void aplicar(Collection<Producto> lista, Sede s) {
        if (s == null || lista.isEmpty()) return;
        boolean porSede = MENU_POR_SEDE.equals(menu());
        Map<Long, ProductoSede> m = productosSede.findBySedeId(s.getId()).stream()
                .collect(Collectors.toMap(ProductoSede::getProductoId, Function.identity()));
        for (Producto p : lista) {
            ProductoSede ps = m.get(p.getId());
            if (ps != null) p.aplicarSede(porSede ? ps.getPrecio() : null, ps.isDisponible(), !porSede || ps.isOfrecido());
        }
    }

    /** Mientras no hay varias sedes, la principal copia los datos de la tienda (al activarlas ya están al día). */
    @Transactional
    public void sincronizarPrincipal(ConfigTienda c) {
        if (activas()) return;
        Sede p = principal();
        p.setDireccion(c.getDireccion());
        p.setCiudad(c.getCiudad());
        p.setWhatsapp(c.getWhatsapp());
        p.setAbierta(c.isAbierto());
        p.setTiempoMin(c.getTiempoMin());
        p.setTiempoMax(c.getTiempoMax());
        p.setLocalLat(c.getLocalLat());
        p.setLocalLng(c.getLocalLng());
        p.setDomicilioTramos(c.getDomicilioTramos());
    }

    // ------------------------------------------------------------------ portal: sedes

    @Transactional(readOnly = true)
    public String menu() {
        return configRepo.findById((short) 1).map(ConfigTienda::getSedesMenu).orElse(MENU_COMPARTIDO);
    }

    @Transactional(readOnly = true)
    public SedesDto.Panel panel() {
        exigir();
        return new SedesDto.Panel(menu(), repo.findAllByOrderByOrdenAscIdAsc().stream().map(this::aDto).toList());
    }

    @Transactional
    public SedesDto.Panel cambiarMenu(String menu) {
        exigir();
        configRepo.findById((short) 1).orElseThrow().setSedesMenu(menu);
        avisarTiendas();
        return panel();
    }

    @Transactional
    public SedesDto.Panel guardar(Long id, SedesDto.SedeRequest r) {
        exigir();
        if (r.tiempoMin() > r.tiempoMax()) throw ReglaNegocioException.invalido("El tiempo mínimo no puede ser mayor que el máximo.");
        if ((r.localLat() == null) != (r.localLng() == null)) throw ReglaNegocioException.invalido("La ubicación de la sede está incompleta.");
        Set<Integer> dias = new HashSet<>();
        r.horarios().forEach(h -> dias.add(h.dia()));
        if (dias.size() != 7) throw ReglaNegocioException.invalido("El horario necesita los 7 días de la semana.");

        Sede s = id == null ? new Sede() : repo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa sede no existe."));
        if (s.isPrincipal() && !r.activa()) throw ReglaNegocioException.conflicto("La sede principal no se puede desactivar.");
        if (id == null) s.setOrden(repo.findAll().size() + 1);
        s.setNombre(r.nombre().trim());
        s.setDireccion(limpio(r.direccion()));
        s.setCiudad(limpio(r.ciudad()));
        s.setWhatsapp(limpio(r.whatsapp()));
        s.setLocalLat(r.localLat());
        s.setLocalLng(r.localLng());
        List<Distancia.Tramo> tramos = (r.tramos() == null ? List.<MapaDto.Tramo>of() : r.tramos()).stream()
                .map(t -> new Distancia.Tramo(Math.round(t.hastaKm() * 10) / 10.0, t.valor()))
                .sorted(Comparator.comparingDouble(Distancia.Tramo::hastaKm)).toList();
        s.setDomicilioTramos(Distancia.texto(tramos));
        s.setAbierta(r.abierta());
        s.setTiempoMin(r.tiempoMin());
        s.setTiempoMax(r.tiempoMax());
        s.setActiva(r.activa());
        Sede guardada = repo.save(s);
        for (AdminDto.Horario h : r.horarios()) {
            Horario e = horarios.findBySedeIdAndDia(guardada.getId(), (short) h.dia())
                    .orElseGet(() -> new Horario(h.dia(), true, LocalTime.of(10, 0), LocalTime.of(22, 0)));
            e.setSedeId(guardada.getId());
            e.setActivo(h.activo());
            e.setAbre(hora(h.abre()));
            e.setCierra(hora(h.cierra()));
            horarios.save(e);
        }
        avisarTiendas();
        return panel();
    }

    // ------------------------------------------------------------------ portal: productos por sede

    @Transactional(readOnly = true)
    public List<SedesDto.ProductoEnSede> productoEnSedes(Long productoId) {
        exigir();
        productos.findById(productoId).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese producto no existe."));
        Map<Long, ProductoSede> m = productosSede.findByProductoId(productoId).stream()
                .collect(Collectors.toMap(ProductoSede::getSedeId, Function.identity()));
        return repo.findAllByOrderByOrdenAscIdAsc().stream().map(s -> {
            ProductoSede ps = m.get(s.getId());
            return new SedesDto.ProductoEnSede(s.getId(), s.getNombre(), ps == null || ps.isDisponible(),
                    ps == null || ps.isOfrecido(), ps == null ? null : ps.getPrecio());
        }).toList();
    }

    @Transactional
    public List<SedesDto.ProductoEnSede> guardarProductoEnSedes(Long productoId, List<SedesDto.ProductoEnSede> lista) {
        exigir();
        productos.findById(productoId).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese producto no existe."));
        Set<Long> sedes = repo.findAll().stream().map(Sede::getId).collect(Collectors.toSet());
        for (SedesDto.ProductoEnSede e : lista) {
            if (!sedes.contains(e.sedeId())) continue;
            ProductoSede ps = productosSede.findByProductoIdAndSedeId(productoId, e.sedeId())
                    .orElseGet(() -> new ProductoSede(productoId, e.sedeId()));
            ps.setDisponible(e.disponible());
            ps.setOfrecido(e.ofrecido());
            ps.setPrecio(e.precio());
            productosSede.save(ps);
        }
        avisarTiendas();
        return productoEnSedes(productoId);
    }

    // ------------------------------------------------------------------ apoyo

    private void exigir() {
        EmpresaContexto.exigirModulo(Modulos.SEDES, "Varias sedes");
    }

    private void avisarTiendas() {
        long empresa = EmpresaContexto.requerida().id();
        tiempoReal.publicar("catalogo", Map.of(), TiempoReal.tienda(empresa), TiempoReal.admin(empresa));
    }

    private SedesDto.Sede aDto(Sede s) {
        List<AdminDto.Horario> hs = horarios.findBySedeIdOrderByDiaAsc(s.getId()).stream()
                .map(h -> new AdminDto.Horario(h.getDia(), h.isActivo(), h.getAbre().format(HH_MM), h.getCierra().format(HH_MM)))
                .toList();
        if (hs.size() != 7) hs = completar(hs);
        List<MapaDto.Tramo> tramos = Distancia.tramos(s.getDomicilioTramos()).stream()
                .map(t -> new MapaDto.Tramo(t.hastaKm(), t.valor())).toList();
        return new SedesDto.Sede(s.getId(), s.getNombre(), s.getDireccion(), s.getCiudad(), s.getWhatsapp(), s.getLocalLat(),
                s.getLocalLng(), tramos, s.isAbierta(), s.getTiempoMin(), s.getTiempoMax(), s.isActiva(), s.isPrincipal(), hs);
    }

    /** Una sede nueva arranca con el horario de la principal. */
    private List<AdminDto.Horario> completar(List<AdminDto.Horario> hs) {
        Map<Integer, AdminDto.Horario> m = new HashMap<>();
        horarios.findBySedeIdOrderByDiaAsc(principal().getId())
                .forEach(h -> m.put(h.getDia(), new AdminDto.Horario(h.getDia(), h.isActivo(), h.getAbre().format(HH_MM), h.getCierra().format(HH_MM))));
        hs.forEach(h -> m.put(h.dia(), h));
        List<AdminDto.Horario> lista = new ArrayList<>();
        for (int d = 1; d <= 7; d++) lista.add(m.getOrDefault(d, new AdminDto.Horario(d, true, "10:00", "22:00")));
        return lista;
    }

    private static LocalTime hora(String hhmm) {
        try {
            return LocalTime.parse(hhmm, HH_MM);
        } catch (Exception e) {
            throw ReglaNegocioException.invalido("La hora " + hhmm + " no es válida.");
        }
    }

    private static String limpio(String s) { return s == null ? "" : s.trim(); }
}
