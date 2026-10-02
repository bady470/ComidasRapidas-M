package co.leinei.api.web;

import co.leinei.api.dominio.EstadoPedido;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.servicio.ConfigService;
import co.leinei.api.servicio.DomiciliarioService;
import co.leinei.api.servicio.RepartoService;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.MapaDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Mapas: la página pública del domiciliario y, en el portal, la configuración del mapa y los domiciliarios en vivo. */
@RestController
@RequestMapping("/api/t/{empresa}")
public class RepartoController {

    private final RepartoService reparto;
    private final DomiciliarioService domiciliarios;
    private final ConfigService config;

    public RepartoController(RepartoService reparto, DomiciliarioService domiciliarios, ConfigService config) {
        this.reparto = reparto;
        this.domiciliarios = domiciliarios;
        this.config = config;
    }

    // ---- Página del domiciliario (el token del link es su clave)
    @GetMapping("/public/reparto/{token}")
    public MapaDto.Reparto ver(@PathVariable String token) { return reparto.ver(token); }

    @PostMapping("/public/reparto/{token}/ubicacion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ubicacion(@PathVariable String token, @Valid @RequestBody MapaDto.UbicacionRequest req) { reparto.ubicar(token, req); }

    @PostMapping("/public/reparto/{token}/pedidos/{codigo}/sali")
    public MapaDto.Reparto sali(@PathVariable String token, @PathVariable String codigo) {
        return reparto.avanzar(token, codigo, EstadoPedido.EN_CAMINO);
    }

    @PostMapping("/public/reparto/{token}/pedidos/{codigo}/entregado")
    public MapaDto.Reparto entregado(@PathVariable String token, @PathVariable String codigo) {
        return reparto.avanzar(token, codigo, EstadoPedido.ENTREGADO);
    }

    // ---- Portal
    @GetMapping("/admin/mapa")
    public MapaDto.ConfigMapa mapa() {
        EmpresaContexto.exigirModulo(Modulos.MAPAS, "Mapas y domiciliario en vivo");
        return config.mapa();
    }

    @PutMapping("/admin/mapa")
    public MapaDto.ConfigMapa guardarMapa(@Valid @RequestBody MapaDto.ConfigMapa req) {
        EmpresaContexto.exigirModulo(Modulos.MAPAS, "Mapas y domiciliario en vivo");
        return config.guardarMapa(req);
    }

    @GetMapping("/admin/domiciliarios/ubicaciones")
    public List<MapaDto.UbicacionDomiciliario> ubicaciones() {
        EmpresaContexto.exigirModulo(Modulos.MAPAS, "Mapas y domiciliario en vivo");
        return domiciliarios.ubicaciones(reparto.enCaminoPorDomiciliario());
    }

    @PostMapping("/admin/domiciliarios/{id}/renovar-link")
    public List<AdminDto.Domiciliario> renovar(@PathVariable Long id) { return domiciliarios.renovarLink(id); }
}
