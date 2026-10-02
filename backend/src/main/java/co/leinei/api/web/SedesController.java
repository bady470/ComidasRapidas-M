package co.leinei.api.web;

import co.leinei.api.servicio.SedeService;
import co.leinei.api.web.dto.SedesDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Portal: las sedes de la empresa, el modo del menú y lo que cambia de cada producto por sede (módulo «sedes»). */
@RestController
@RequestMapping("/api/t/{empresa}/admin")
public class SedesController {

    private final SedeService sedes;

    public SedesController(SedeService sedes) {
        this.sedes = sedes;
    }

    @GetMapping("/sedes")
    public SedesDto.Panel panel() { return sedes.panel(); }

    @PostMapping("/sedes")
    @ResponseStatus(HttpStatus.CREATED)
    public SedesDto.Panel crear(@Valid @RequestBody SedesDto.SedeRequest req) { return sedes.guardar(null, req); }

    @PutMapping("/sedes/{id}")
    public SedesDto.Panel editar(@PathVariable Long id, @Valid @RequestBody SedesDto.SedeRequest req) { return sedes.guardar(id, req); }

    @PutMapping("/sedes/menu")
    public SedesDto.Panel menu(@Valid @RequestBody SedesDto.MenuRequest req) { return sedes.cambiarMenu(req.menu()); }

    @GetMapping("/productos/{id}/sedes")
    public List<SedesDto.ProductoEnSede> productoEnSedes(@PathVariable Long id) { return sedes.productoEnSedes(id); }

    @PutMapping("/productos/{id}/sedes")
    public List<SedesDto.ProductoEnSede> guardarProductoEnSedes(@PathVariable Long id,
                                                                @Valid @RequestBody SedesDto.ProductoEnSedesRequest req) {
        return sedes.guardarProductoEnSedes(id, req.sedes());
    }
}
