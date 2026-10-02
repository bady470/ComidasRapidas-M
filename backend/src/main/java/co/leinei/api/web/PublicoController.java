package co.leinei.api.web;

import co.leinei.api.servicio.ArchivoService;
import co.leinei.api.servicio.CatalogoService;
import co.leinei.api.servicio.PedidoService;
import co.leinei.api.servicio.PrecioService;
import co.leinei.api.web.dto.PublicoDto;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.time.Duration;

/** Endpoints abiertos para los clientes de la tienda. */
@RestController
@RequestMapping("/api/t/{empresa}/public")
public class PublicoController {

    private final CatalogoService catalogo;
    private final PedidoService pedidos;
    private final ArchivoService archivos;

    public PublicoController(CatalogoService catalogo, PedidoService pedidos, ArchivoService archivos) {
        this.catalogo = catalogo;
        this.pedidos = pedidos;
        this.archivos = archivos;
    }

    /** Marca, disponibilidad, categorías, productos con sus opciones y promociones visibles. */
    @GetMapping("/catalogo")
    public PublicoDto.Catalogo catalogo() {
        return catalogo.catalogoPublico();
    }

    /** Calcula el valor del carrito con las promociones del día y el domicilio de la zona. */
    @PostMapping("/cotizar")
    public PrecioService.Cotizacion cotizar(@Valid @RequestBody PublicoDto.CotizarRequest req) {
        return pedidos.cotizar(req);
    }

    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    public PublicoDto.PedidoCreado crearPedido(@Valid @RequestBody PublicoDto.CrearPedidoRequest req) {
        return pedidos.crear(req);
    }

    /** Seguimiento del pedido con el código y el celular con que se hizo. */
    @GetMapping("/pedidos/{codigo}")
    public PublicoDto.Seguimiento seguimiento(@PathVariable String codigo, @RequestParam String celular) {
        return pedidos.seguimiento(codigo, celular);
    }

    /** El cliente adjunta el comprobante de su transferencia (imagen o PDF, campo «archivo»). */
    @PostMapping(value = "/pedidos/{codigo}/comprobante", consumes = "multipart/form-data")
    public PublicoDto.Seguimiento comprobante(@PathVariable String codigo, @RequestParam String celular,
                                              @RequestParam("archivo") MultipartFile archivo) throws IOException {
        return pedidos.subirComprobante(codigo, celular, archivo.getBytes());
    }

    /** Logo y fotos de productos. Una imagen nunca cambia (al reemplazarla se crea otra), así que se guarda en caché. */
    @GetMapping("/archivos/{id}")
    public ResponseEntity<byte[]> archivo(@PathVariable Long id) {
        ArchivoService.Imagen img = archivos.leer(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(img.tipoContenido()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(img.datos());
    }
}
