package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.*;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.PublicoDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ArchivoRepositorio archivoRepo;
    private final DisponibilidadService disponibilidad;

    public ConfigService(ConfigTiendaRepositorio configRepo, HorarioRepositorio horarioRepo, ZonaEnvioRepositorio zonaRepo,
                         CuentaPagoRepositorio cuentaRepo, ArchivoRepositorio archivoRepo,
                         DisponibilidadService disponibilidad) {
        this.configRepo = configRepo;
        this.horarioRepo = horarioRepo;
        this.zonaRepo = zonaRepo;
        this.cuentaRepo = cuentaRepo;
        this.archivoRepo = archivoRepo;
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
        return horarioRepo.findAll(org.springframework.data.domain.Sort.by("dia"));
    }

    @Transactional(readOnly = true)
    public DisponibilidadService.Disponibilidad disponibilidad() {
        return disponibilidad.calcular(tienda(), horarios());
    }

    @Transactional(readOnly = true)
    public List<ZonaEnvio> zonasActivas() {
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
        List<PublicoDto.Zona> zonas = c.isDomicilioActivo()
                ? zonasActivas().stream().map(z -> new PublicoDto.Zona(z.getId(), z.getNombre(), z.getValor())).toList()
                : List.of();
        List<PublicoDto.Cuenta> cuentas = cuentasActivas().stream()
                .map(n -> new PublicoDto.Cuenta(n.getId(), n.getEntidad(), n.getTitular(), n.getNumero())).toList();
        List<PublicoDto.HorarioDia> hs = horarios.stream()
                .map(h -> new PublicoDto.HorarioDia(h.getDia(), h.isActivo(), h.getAbre().format(HH_MM), h.getCierra().format(HH_MM)))
                .toList();
        return new PublicoDto.Tienda(c.getNombre(), c.getEslogan(), c.getTituloPortada(), c.getMensaje(), c.getLogoId(),
                c.getColorPrimario(), c.getColorSecundario(), c.getWhatsapp(), c.getDireccion(), c.getCiudad(),
                c.getInstagram(), c.isAbierto(), c.getModoPedido(), d.recibePedidos(), d.enHorario(), d.fechaServicio(),
                d.cierre(), d.proximaApertura(), c.getTiempoMin(), c.getTiempoMax(), c.listaFranjas(),
                c.getPedidoMinimo(), hs, c.isDomicilioActivo(), c.getDomicilioValor(), zonas, c.isRecogerActivo(),
                c.isEfectivo(), cuentas);
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
        return new AdminDto.Config(c.getNombre(), c.getEslogan(), c.getTituloPortada(), c.getMensaje(), c.getLogoId(),
                c.getColorPrimario(), c.getColorSecundario(), c.getWhatsapp(), c.getDireccion(), c.getCiudad(),
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
        if (!r.efectivo() && cuentas.stream().noneMatch(AdminDto.Cuenta::activa)) {
            throw ReglaNegocioException.invalido("Activa al menos una forma de pago: una cuenta o efectivo.");
        }
        if (r.tiempoMin() > r.tiempoMax()) {
            throw ReglaNegocioException.invalido("El tiempo mínimo de entrega no puede ser mayor que el máximo.");
        }
        if (r.recogerActivo() && blanco(r.direccion())) {
            throw ReglaNegocioException.invalido("Escribe la dirección del local para que los clientes puedan recoger.");
        }
        if (r.logoId() != null && !archivoRepo.existsById(r.logoId())) {
            throw ReglaNegocioException.invalido("El logo ya no existe. Súbelo de nuevo.");
        }
        Set<Integer> dias = new HashSet<>();
        if (r.horarios() != null) r.horarios().forEach(h -> dias.add(h.dia()));
        if (dias.size() != 7) throw ReglaNegocioException.invalido("El horario necesita los 7 días de la semana.");

        ConfigTienda c = tienda();
        c.setNombre(r.nombre().trim());
        c.setEslogan(limpio(r.eslogan()));
        c.setTituloPortada(limpio(r.tituloPortada()));
        c.setMensaje(limpio(r.mensaje()));
        c.setLogoId(r.logoId());
        c.setColorPrimario(r.colorPrimario().toUpperCase(Locale.ROOT));
        c.setColorSecundario(r.colorSecundario().toUpperCase(Locale.ROOT));
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
            Horario e = horarioRepo.findById((short) h.dia())
                    .orElseGet(() -> new Horario(h.dia(), true, LocalTime.of(10, 0), LocalTime.of(22, 0)));
            e.setActivo(h.activo());
            e.setAbre(hora(h.abre()));
            e.setCierra(hora(h.cierra()));
            horarioRepo.save(e);
        }

        reemplazar(zonas, AdminDto.Zona::id, zonaRepo, ZonaEnvio::new, ZonaEnvio::getId, (z, req, orden) -> {
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
