package co.leinei.api.servicio;

import co.leinei.api.dominio.Domiciliario;
import co.leinei.api.repositorio.DomiciliarioRepositorio;
import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.MapaDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Domiciliarios de la empresa. No se borran (los pedidos viejos los siguen mostrando): se desactivan.
 * Cada uno tiene un link personal de reparto (/reparto/{token}) que se puede renovar.
 */
@Service
public class DomiciliarioService {

    private static final SecureRandom AZAR = new SecureRandom();

    private final DomiciliarioRepositorio repo;

    private final TiempoReal tiempoReal;

    public DomiciliarioService(DomiciliarioRepositorio repo, TiempoReal tiempoReal) {
        this.repo = repo;
        this.tiempoReal = tiempoReal;
    }

    /** Los domiciliarios creados antes de los links de reparto reciben el suyo aquí. */
    @Transactional
    public List<AdminDto.Domiciliario> listar() {
        List<Domiciliario> lista = repo.findAllByOrderByActivoDescOrdenAscNombreAsc();
        lista.stream().filter(d -> d.getToken() == null).forEach(d -> d.setToken(nuevoToken()));
        return lista.stream().map(DomiciliarioService::aDto).toList();
    }

    @Transactional
    public List<AdminDto.Domiciliario> guardar(Long id, AdminDto.DomiciliarioRequest r) {
        Domiciliario d = id == null ? new Domiciliario()
                : repo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese domiciliario no existe."));
        d.setNombre(r.nombre().trim());
        d.setCelular(r.celular() == null ? "" : r.celular().replaceAll("\\D", ""));
        d.setActivo(id == null || r.activo());
        if (d.getToken() == null) d.setToken(nuevoToken());
        repo.save(d);
        tiempoReal.publicar("domiciliarios", Map.of(), TiempoReal.admin(co.leinei.api.empresa.EmpresaContexto.requerida().id()));
        return listar();
    }

    /** Link nuevo (el anterior deja de servir): si el domiciliario cambió de celular o ya no trabaja con la empresa. */
    @Transactional
    public List<AdminDto.Domiciliario> renovarLink(Long id) {
        Domiciliario d = repo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese domiciliario no existe."));
        d.setToken(nuevoToken());
        return listar();
    }

    /** Domiciliarios en el mapa del portal: su última ubicación y cuántos pedidos llevan en camino. */
    @Transactional(readOnly = true)
    public List<MapaDto.UbicacionDomiciliario> ubicaciones(Map<Long, Integer> enCamino) {
        Instant ahora = Instant.now();
        return repo.findAllByOrderByActivoDescOrdenAscNombreAsc().stream()
                .filter(d -> d.isActivo() && d.getUbicacionEn() != null)
                .map(d -> new MapaDto.UbicacionDomiciliario(d.getId(), d.getNombre(), d.getUbicacionLat(), d.getUbicacionLng(),
                        d.getUbicacionEn(), d.ubicacionVigente(ahora, PedidoService.UBICACION_VIGENTE), enCamino.getOrDefault(d.getId(), 0)))
                .toList();
    }

    /** 32 caracteres aleatorios (base64 para URL): imposible de adivinar. */
    static String nuevoToken() {
        byte[] b = new byte[24];
        AZAR.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static AdminDto.Domiciliario aDto(Domiciliario d) {
        return new AdminDto.Domiciliario(d.getId(), d.getNombre(), d.getCelular(), d.isActivo(), d.getToken());
    }
}
