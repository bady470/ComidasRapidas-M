package co.leinei.api.web;

import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.plataforma.servicio.MarcaService;
import co.leinei.api.servicio.ArchivoService;
import co.leinei.api.servicio.BannerService;
import co.leinei.api.servicio.CatalogoService;
import co.leinei.api.servicio.ConfigService;
import co.leinei.api.web.dto.AdminDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.util.List;

@RestController
@RequestMapping("/api/t/{empresa}/admin")
public class AdminCatalogoController {

    private final CatalogoService catalogo;
    private final ConfigService config;
    private final ArchivoService archivos;
    private final MarcaService marca;
    private final BannerService banners;

    public AdminCatalogoController(CatalogoService catalogo, ConfigService config, ArchivoService archivos, MarcaService marca, BannerService banners) {
        this.catalogo = catalogo;
        this.config = config;
        this.archivos = archivos;
        this.marca = marca;
        this.banners = banners;
    }

    // ---- Logo de la empresa (se guarda en la base de control, con la marca)
    @PostMapping(value = "/marca/logo", consumes = "multipart/form-data")
    public AdminDto.Config subirLogo(@RequestParam("archivo") MultipartFile archivo) throws IOException {
        EmpresaActual e = EmpresaContexto.requerida();
        marca.guardarLogo(e.id(), e.identificador(), archivo.getBytes());
        return config.verAdmin();
    }

    @DeleteMapping("/marca/logo")
    public AdminDto.Config quitarLogo() {
        EmpresaActual e = EmpresaContexto.requerida();
        marca.quitarLogo(e.id(), e.identificador());
        return config.verAdmin();
    }

    // ---- Imágenes (logo y fotos)
    @PostMapping(value = "/archivos", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDto.ArchivoSubido subir(@RequestParam("archivo") MultipartFile archivo) throws IOException {
        var a = archivos.guardarImagen(archivo.getBytes());
        return new AdminDto.ArchivoSubido(a.getId(), a.getTipoContenido(), a.getTamano());
    }

    // ---- Categorías
    @GetMapping("/categorias")
    public List<AdminDto.Categoria> categorias() {
        return catalogo.listarCategorias();
    }

    @PostMapping("/categorias")
    @ResponseStatus(HttpStatus.CREATED)
    public List<AdminDto.Categoria> crearCategoria(@Valid @RequestBody AdminDto.CategoriaRequest req) {
        catalogo.guardarCategoria(null, req);
        return catalogo.listarCategorias();
    }

    @PutMapping("/categorias/{id}")
    public List<AdminDto.Categoria> actualizarCategoria(@PathVariable Long id, @Valid @RequestBody AdminDto.CategoriaRequest req) {
        catalogo.guardarCategoria(id, req);
        return catalogo.listarCategorias();
    }

    @DeleteMapping("/categorias/{id}")
    public List<AdminDto.Categoria> eliminarCategoria(@PathVariable Long id) {
        catalogo.eliminarCategoria(id);
        return catalogo.listarCategorias();
    }

    // ---- Productos
    @GetMapping("/productos")
    public List<AdminDto.Producto> productos() {
        return catalogo.listarProductos();
    }

    @PostMapping("/productos")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDto.Producto crearProducto(@Valid @RequestBody AdminDto.ProductoRequest req) {
        return catalogo.crearProducto(req);
    }

    @PutMapping("/productos/{id}")
    public AdminDto.Producto actualizarProducto(@PathVariable Long id, @Valid @RequestBody AdminDto.ProductoRequest req) {
        return catalogo.actualizarProducto(id, req);
    }

    @PatchMapping("/productos/{id}/disponible")
    public AdminDto.Producto disponible(@PathVariable Long id, @RequestBody AdminDto.DisponibleRequest req) {
        return catalogo.cambiarDisponible(id, req.disponible());
    }

    @DeleteMapping("/productos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarProducto(@PathVariable Long id) {
        catalogo.eliminarProducto(id);
    }

    // ---- Promociones
    @GetMapping("/promociones")
    public List<AdminDto.Promocion> promociones() {
        exigirPromociones();
        return catalogo.listarPromociones();
    }

    @PostMapping("/promociones")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDto.Promocion crearPromocion(@Valid @RequestBody AdminDto.PromocionRequest req) {
        exigirPromociones();
        return catalogo.crearPromocion(req);
    }

    @PutMapping("/promociones/{id}")
    public AdminDto.Promocion actualizarPromocion(@PathVariable Long id, @Valid @RequestBody AdminDto.PromocionRequest req) {
        exigirPromociones();
        return catalogo.actualizarPromocion(id, req);
    }

    @PatchMapping("/promociones/{id}/activa")
    public AdminDto.Promocion activa(@PathVariable Long id, @RequestBody AdminDto.ActivaRequest req) {
        return catalogo.cambiarActiva(id, req.activa());
    }

    @DeleteMapping("/promociones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarPromocion(@PathVariable Long id) {
        catalogo.eliminarPromocion(id);
    }

    // ---- Banners del carrusel de la portada (forman parte del módulo de promociones)
    @GetMapping("/banners")
    public List<AdminDto.Banner> banners() {
        exigirPromociones();
        return banners.listar();
    }

    @PostMapping("/banners")
    @ResponseStatus(HttpStatus.CREATED)
    public List<AdminDto.Banner> crearBanner(@Valid @RequestBody AdminDto.BannerRequest req) {
        exigirPromociones();
        return banners.crear(req);
    }

    @PutMapping("/banners/orden")
    public List<AdminDto.Banner> ordenarBanners(@Valid @RequestBody AdminDto.OrdenRequest req) {
        exigirPromociones();
        return banners.ordenar(req.ids());
    }

    @PutMapping("/banners/{id}")
    public List<AdminDto.Banner> actualizarBanner(@PathVariable Long id, @Valid @RequestBody AdminDto.BannerRequest req) {
        exigirPromociones();
        return banners.actualizar(id, req);
    }

    @DeleteMapping("/banners/{id}")
    public List<AdminDto.Banner> eliminarBanner(@PathVariable Long id) {
        exigirPromociones();
        return banners.eliminar(id);
    }

    // ---- Configuración de la tienda
    @GetMapping("/config")
    public AdminDto.Config verConfig() {
        return config.verAdmin();
    }

    @PutMapping("/config")
    public AdminDto.Config guardarConfig(@Valid @RequestBody AdminDto.Config req) {
        return config.actualizar(req);
    }

    @PutMapping("/plantilla")
    public AdminDto.Plantilla cambiarPlantilla(@Valid @RequestBody AdminDto.Plantilla req) {
        return new AdminDto.Plantilla(config.cambiarPlantilla(req.plantilla()));
    }

    private static void exigirPromociones() {
        EmpresaContexto.exigirModulo(Modulos.PROMOCIONES, "Promociones");
    }
}
