package co.leinei.api.servicio;

import co.leinei.api.dominio.Domiciliario;
import co.leinei.api.repositorio.DomiciliarioRepositorio;
import co.leinei.api.tiemporeal.TiempoReal;
import co.leinei.api.web.dto.AdminDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Domiciliarios de la empresa. No se borran (los pedidos viejos los siguen mostrando): se desactivan. */
@Service
public class DomiciliarioService {

    private final DomiciliarioRepositorio repo;

    private final TiempoReal tiempoReal;

    public DomiciliarioService(DomiciliarioRepositorio repo, TiempoReal tiempoReal) {
        this.repo = repo;
        this.tiempoReal = tiempoReal;
    }

    @Transactional(readOnly = true)
    public List<AdminDto.Domiciliario> listar() {
        return repo.findAllByOrderByActivoDescOrdenAscNombreAsc().stream().map(DomiciliarioService::aDto).toList();
    }

    @Transactional
    public List<AdminDto.Domiciliario> guardar(Long id, AdminDto.DomiciliarioRequest r) {
        Domiciliario d = id == null ? new Domiciliario()
                : repo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese domiciliario no existe."));
        d.setNombre(r.nombre().trim());
        d.setCelular(r.celular() == null ? "" : r.celular().replaceAll("\\D", ""));
        d.setActivo(id == null || r.activo());
        repo.save(d);
        tiempoReal.publicar("domiciliarios", java.util.Map.of(), TiempoReal.admin(co.leinei.api.empresa.EmpresaContexto.requerida().id()));
        return listar();
    }

    static AdminDto.Domiciliario aDto(Domiciliario d) {
        return new AdminDto.Domiciliario(d.getId(), d.getNombre(), d.getCelular(), d.isActivo());
    }
}
