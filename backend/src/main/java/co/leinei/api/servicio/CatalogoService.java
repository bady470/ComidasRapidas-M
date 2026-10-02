package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.repositorio.*;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.PublicoDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CatalogoService {

    private final ProductoRepositorio productoRepo;
    private final CategoriaRepositorio categoriaRepo;
    private final PromocionRepositorio promocionRepo;
    private final ArchivoRepositorio archivoRepo;
    private final ConfigService configService;
    private final PrecioService precios;
    private final BannerService banners;

    public CatalogoService(ProductoRepositorio productoRepo, CategoriaRepositorio categoriaRepo,
                           PromocionRepositorio promocionRepo, ArchivoRepositorio archivoRepo,
                           ConfigService configService, PrecioService precios, BannerService banners) {
        this.productoRepo = productoRepo;
        this.categoriaRepo = categoriaRepo;
        this.promocionRepo = promocionRepo;
        this.archivoRepo = archivoRepo;
        this.configService = configService;
        this.precios = precios;
        this.banners = banners;
    }

    // ------------------------------------------------------------------ público

    @Transactional(readOnly = true)
    public PublicoDto.Catalogo catalogoPublico() {
        PublicoDto.Tienda tienda = configService.tiendaPublica();
        List<Promocion> vigentes = promocionesActivas().stream()
                .filter(p -> p.vigentePara(tienda.fechaServicio())).toList();

        List<Categoria> categorias = categoriaRepo.findAllByOrderByOrdenAscIdAsc().stream().filter(Categoria::isActiva).toList();
        Set<Long> activas = categorias.stream().map(Categoria::getId).collect(Collectors.toSet());

        List<PublicoDto.Producto> productos = productoRepo.findAllByOrderByOrdenAscIdAsc().stream()
                // Un producto de una categoría oculta no se muestra; uno sin categoría sí.
                .filter(p -> p.getCategoria() == null || activas.contains(p.getCategoria().getId()))
                .map(p -> new PublicoDto.Producto(p.getId(), p.getCategoria() == null ? null : p.getCategoria().getId(),
                        p.getNombre(), p.getDescripcion(), p.getPrecio(), precios.precioUnitario(p, vigentes),
                        p.getImagenId(), p.getEtiqueta(), p.isDisponible(), gruposPublicos(p)))
                .toList();

        Set<Long> conProductos = productos.stream().map(PublicoDto.Producto::categoriaId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        List<PublicoDto.Categoria> cats = categorias.stream().filter(c -> conProductos.contains(c.getId()))
                .map(c -> new PublicoDto.Categoria(c.getId(), c.getNombre())).toList();

        List<PublicoDto.Promocion> promos = vigentes.stream().filter(Promocion::isDestacada)
                .map(p -> new PublicoDto.Promocion(p.getId(), p.getNombre(), p.getDescripcion(), p.getTipo(),
                        p.getCantidad(), p.getPrecio(), p.getPorcentaje(), p.getMinimo(),
                        p.getProducto() == null ? null : p.getProducto().getId(), idsDe(p)))
                .toList();

        return new PublicoDto.Catalogo(tienda, cats, productos, promos, EmpresaContexto.tieneModulo(Modulos.PROMOCIONES) ? banners.publicos() : List.of());
    }

    private static List<PublicoDto.Grupo> gruposPublicos(Producto p) {
        if (!EmpresaContexto.tieneModulo(Modulos.OPCIONES)) return List.of();
        return p.getGrupos().stream()
                .map(g -> new PublicoDto.Grupo(g.getId(), g.getNombre(), g.getMinimo(), g.getMaximo(),
                        g.getOpciones().stream()
                                .map(o -> new PublicoDto.Opcion(o.getId(), o.getNombre(), o.getPrecioExtra(), o.isDisponible()))
                                .toList()))
                .toList();
    }

    /** Todas las promociones activas; el cálculo filtra por fecha. */
    @Transactional(readOnly = true)
    public List<Promocion> promocionesActivas() {
        if (!EmpresaContexto.tieneModulo(Modulos.PROMOCIONES)) return List.of();
        return promocionRepo.findByActivaTrue();
    }

    @Transactional(readOnly = true)
    public Map<Long, Producto> productosPorId(Collection<Long> ids) {
        Map<Long, Producto> mapa = new HashMap<>();
        productoRepo.findAllById(ids).forEach(p -> {
            p.getGrupos().forEach(g -> g.getOpciones().size()); // cargar opciones dentro de la transacción
            mapa.put(p.getId(), p);
        });
        return mapa;
    }

    // ------------------------------------------------------------------ categorías (admin)

    @Transactional(readOnly = true)
    public List<AdminDto.Categoria> listarCategorias() {
        Map<Long, Long> conteo = productoRepo.findAll().stream().filter(p -> p.getCategoria() != null)
                .collect(Collectors.groupingBy(p -> p.getCategoria().getId(), Collectors.counting()));
        return categoriaRepo.findAllByOrderByOrdenAscIdAsc().stream()
                .map(c -> new AdminDto.Categoria(c.getId(), c.getNombre(), c.isActiva(), c.getOrden(), conteo.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public void guardarCategoria(Long id, AdminDto.CategoriaRequest r) {
        Categoria c = id == null ? new Categoria()
                : categoriaRepo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa categoría no existe."));
        c.setNombre(r.nombre().trim());
        c.setActiva(r.activa());
        c.setOrden(r.orden());
        categoriaRepo.save(c);
    }

    /** Borra la categoría; sus productos quedan sin categoría (no se borran). */
    @Transactional
    public void eliminarCategoria(Long id) {
        Categoria c = categoriaRepo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa categoría no existe."));
        productoRepo.findAll().stream()
                .filter(p -> p.getCategoria() != null && p.getCategoria().getId().equals(id))
                .forEach(p -> p.setCategoria(null));
        categoriaRepo.delete(c);
    }

    // ------------------------------------------------------------------ productos (admin)

    @Transactional(readOnly = true)
    public List<AdminDto.Producto> listarProductos() {
        return productoRepo.findAllByOrderByOrdenAscIdAsc().stream().map(this::aDto).toList();
    }

    @Transactional
    public AdminDto.Producto crearProducto(AdminDto.ProductoRequest r) {
        Producto p = new Producto();
        p.setSlug(slugUnico(r.nombre()));
        aplicar(p, r);
        return aDto(productoRepo.save(p));
    }

    @Transactional
    public AdminDto.Producto actualizarProducto(Long id, AdminDto.ProductoRequest r) {
        Producto p = buscarProducto(id);
        aplicar(p, r);
        return aDto(productoRepo.saveAndFlush(p));
    }

    @Transactional
    public AdminDto.Producto cambiarDisponible(Long id, boolean disponible) {
        Producto p = buscarProducto(id);
        p.setDisponible(disponible);
        return aDto(p);
    }

    @Transactional
    public void eliminarProducto(Long id) {
        Producto p = buscarProducto(id);
        // Borra los precios especiales de ese producto y lo quita de los combos y porcentajes.
        for (Promocion promo : promocionRepo.findAll()) {
            if (promo.getProducto() != null && promo.getProducto().getId().equals(id)) {
                promocionRepo.delete(promo);
            } else {
                promo.getProductos().removeIf(x -> x.getId().equals(id));
            }
        }
        promocionRepo.flush();
        productoRepo.delete(p);
    }

    private void aplicar(Producto p, AdminDto.ProductoRequest r) {
        if (r.imagenId() != null && !archivoRepo.existsById(r.imagenId())) {
            throw ReglaNegocioException.invalido("La imagen ya no existe. Súbela de nuevo.");
        }
        p.setCategoria(r.categoriaId() == null ? null : categoriaRepo.findById(r.categoriaId())
                .orElseThrow(() -> ReglaNegocioException.invalido("Esa categoría no existe.")));
        p.setNombre(r.nombre().trim());
        p.setDescripcion(Objects.requireNonNullElse(r.descripcion(), "").trim());
        p.setPrecio(r.precio());
        p.setCosto(r.costo());
        p.setImagenId(r.imagenId());
        p.setEtiqueta(Objects.requireNonNullElse(r.etiqueta(), "").trim());
        p.setDisponible(r.disponible());
        p.setOrden(r.orden());
        List<AdminDto.Grupo> grupos = r.grupos() == null ? List.of() : r.grupos();
        if (!grupos.isEmpty() && !EmpresaContexto.tieneModulo(Modulos.OPCIONES)) {
            throw new ReglaNegocioException(org.springframework.http.HttpStatus.FORBIDDEN,
                    "Tu plan no incluye «Productos personalizables». Quita las opciones o pide que te activen el módulo.");
        }
        aplicarGrupos(p, grupos);
    }

    /** Actualiza los grupos y opciones conservando sus ids, para no dañar carritos abiertos. */
    private void aplicarGrupos(Producto p, List<AdminDto.Grupo> grupos) {
        Map<Long, GrupoOpcion> existentes = p.getGrupos().stream()
                .filter(g -> g.getId() != null).collect(Collectors.toMap(GrupoOpcion::getId, Function.identity()));
        List<GrupoOpcion> resultado = new ArrayList<>();
        int ordenG = 1;
        for (AdminDto.Grupo gr : grupos) {
            if (gr.minimo() > gr.maximo()) {
                throw ReglaNegocioException.invalido("En «" + gr.nombre() + "» el mínimo no puede ser mayor que el máximo.");
            }
            if (gr.minimo() > gr.opciones().size()) {
                throw ReglaNegocioException.invalido("«" + gr.nombre() + "» pide escoger más opciones de las que tiene.");
            }
            GrupoOpcion g = gr.id() != null && existentes.containsKey(gr.id()) ? existentes.get(gr.id()) : new GrupoOpcion();
            g.setNombre(gr.nombre().trim());
            g.setMinimo(gr.minimo());
            g.setMaximo(gr.maximo());
            g.setOrden(ordenG++);

            Map<Long, Opcion> opcionesExistentes = g.getOpciones().stream()
                    .filter(o -> o.getId() != null).collect(Collectors.toMap(Opcion::getId, Function.identity()));
            List<Opcion> nuevasOpciones = new ArrayList<>();
            int ordenO = 1;
            for (AdminDto.Opcion or : gr.opciones()) {
                Opcion o = or.id() != null && opcionesExistentes.containsKey(or.id()) ? opcionesExistentes.get(or.id()) : new Opcion();
                o.setNombre(or.nombre().trim());
                o.setPrecioExtra(or.precioExtra());
                o.setDisponible(or.disponible());
                o.setOrden(ordenO++);
                nuevasOpciones.add(o);
            }
            g.getOpciones().retainAll(nuevasOpciones);
            for (Opcion o : nuevasOpciones) if (!g.getOpciones().contains(o)) g.agregarOpcion(o);
            resultado.add(g);
        }
        p.getGrupos().retainAll(resultado);
        for (GrupoOpcion g : resultado) if (!p.getGrupos().contains(g)) p.agregarGrupo(g);
    }

    private Producto buscarProducto(Long id) {
        return productoRepo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese producto no existe."));
    }

    private AdminDto.Producto aDto(Producto p) {
        List<AdminDto.Grupo> grupos = p.getGrupos().stream()
                .map(g -> new AdminDto.Grupo(g.getId(), g.getNombre(), g.getMinimo(), g.getMaximo(),
                        g.getOpciones().stream()
                                .map(o -> new AdminDto.Opcion(o.getId(), o.getNombre(), o.getPrecioExtra(), o.isDisponible()))
                                .toList()))
                .toList();
        return new AdminDto.Producto(p.getId(), p.getSlug(), p.getCategoria() == null ? null : p.getCategoria().getId(),
                p.getNombre(), p.getDescripcion(), p.getPrecio(), p.getCosto(), p.getImagenId(), p.getEtiqueta(),
                p.isDisponible(), p.getOrden(), grupos);
    }

    private String slugUnico(String nombre) {
        String base = Normalizer.normalize(nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isEmpty()) base = "producto";
        if (base.length() > 50) base = base.substring(0, 50);
        String slug = base;
        for (int i = 2; productoRepo.existsBySlug(slug); i++) slug = base + "-" + i;
        return slug;
    }

    // ------------------------------------------------------------------ promociones (admin)

    @Transactional(readOnly = true)
    public List<AdminDto.Promocion> listarPromociones() {
        LocalDate fecha = fechaActual();
        return promocionRepo.findAllByOrderByIdAsc().stream().map(p -> aDto(p, fecha)).toList();
    }

    @Transactional
    public AdminDto.Promocion crearPromocion(AdminDto.PromocionRequest r) {
        Promocion p = new Promocion();
        aplicar(p, r);
        return aDto(promocionRepo.save(p), fechaActual());
    }

    @Transactional
    public AdminDto.Promocion actualizarPromocion(Long id, AdminDto.PromocionRequest r) {
        Promocion p = buscarPromocion(id);
        aplicar(p, r);
        return aDto(p, fechaActual());
    }

    @Transactional
    public AdminDto.Promocion cambiarActiva(Long id, boolean activa) {
        Promocion p = buscarPromocion(id);
        p.setActiva(activa);
        return aDto(p, fechaActual());
    }

    @Transactional
    public void eliminarPromocion(Long id) {
        promocionRepo.delete(buscarPromocion(id));
    }

    private void aplicar(Promocion p, AdminDto.PromocionRequest r) {
        switch (r.tipo()) {
            case COMBO -> {
                if (r.cantidad() == null || r.cantidad() < 2) throw ReglaNegocioException.invalido("El combo necesita al menos 2 productos.");
                if (r.precio() == null || r.precio() <= 0) throw ReglaNegocioException.invalido("Escribe el precio del combo.");
            }
            case PORCENTAJE -> {
                if (r.porcentaje() == null || r.porcentaje() < 1 || r.porcentaje() > 90)
                    throw ReglaNegocioException.invalido("El porcentaje va de 1 a 90.");
            }
            case PRECIO_ESPECIAL -> {
                if (r.productoId() == null) throw ReglaNegocioException.invalido("Escoge el producto con precio especial.");
                if (r.precio() == null || r.precio() <= 0) throw ReglaNegocioException.invalido("Escribe el precio especial.");
            }
            case ENVIO_GRATIS -> { }
        }
        if (r.desde() != null && r.hasta() != null && r.hasta().isBefore(r.desde())) {
            throw ReglaNegocioException.invalido("La fecha final no puede ser antes de la inicial.");
        }
        p.setNombre(r.nombre().trim());
        p.setDescripcion(Objects.requireNonNullElse(r.descripcion(), "").trim());
        p.setTipo(r.tipo());
        p.setCantidad(r.tipo() == TipoPromocion.COMBO ? r.cantidad() : null);
        p.setPrecio(r.tipo() == TipoPromocion.COMBO || r.tipo() == TipoPromocion.PRECIO_ESPECIAL ? r.precio() : null);
        p.setPorcentaje(r.tipo() == TipoPromocion.PORCENTAJE ? r.porcentaje() : null);
        p.setMinimo(r.tipo() == TipoPromocion.PORCENTAJE || r.tipo() == TipoPromocion.ENVIO_GRATIS ? r.minimo() : 0);
        p.setProducto(r.tipo() == TipoPromocion.PRECIO_ESPECIAL ? buscarProducto(r.productoId()) : null);
        Set<Producto> alcance = new HashSet<>();
        if ((r.tipo() == TipoPromocion.COMBO || r.tipo() == TipoPromocion.PORCENTAJE) && r.productoIds() != null) {
            productoRepo.findAllById(r.productoIds()).forEach(alcance::add);
        }
        p.getProductos().clear();
        p.getProductos().addAll(alcance);
        p.setActiva(r.activa());
        p.setDestacada(r.destacada());
        p.setDesde(r.desde());
        p.setHasta(r.hasta());
    }

    private Promocion buscarPromocion(Long id) {
        return promocionRepo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa promoción no existe."));
    }

    private LocalDate fechaActual() {
        return configService.disponibilidad().fechaServicio();
    }

    private AdminDto.Promocion aDto(Promocion p, LocalDate fecha) {
        return new AdminDto.Promocion(p.getId(), p.getNombre(), p.getDescripcion(), p.getTipo(), p.getCantidad(),
                p.getPrecio(), p.getPorcentaje(), p.getMinimo(),
                p.getProducto() == null ? null : p.getProducto().getId(), idsDe(p),
                p.isActiva(), p.isDestacada(), p.getDesde(), p.getHasta(), p.vigentePara(fecha));
    }

    private static List<Long> idsDe(Promocion p) {
        return p.getProductos().stream().map(Producto::getId).sorted().toList();
    }
}
