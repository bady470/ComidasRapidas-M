package co.leinei.api.servicio;

import co.leinei.api.dominio.Banner;
import co.leinei.api.repositorio.ArchivoRepositorio;
import co.leinei.api.repositorio.BannerRepositorio;
import co.leinei.api.web.dto.AdminDto;
import co.leinei.api.web.dto.PublicoDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Carrusel de la portada: el administrador crea, edita, ordena, activa y borra sus banners. */
@Service
public class BannerService {

    private final BannerRepositorio repo;
    private final ArchivoRepositorio archivos;

    public BannerService(BannerRepositorio repo, ArchivoRepositorio archivos) {
        this.repo = repo;
        this.archivos = archivos;
    }

    @Transactional(readOnly = true)
    public List<PublicoDto.Banner> publicos() {
        return repo.findByActivoTrueOrderByOrdenAscIdAsc().stream()
                .map(b -> new PublicoDto.Banner(b.getId(), b.getTitulo(), b.getSubtitulo(), b.getBoton(), b.getImagenId(), b.getColor()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminDto.Banner> listar() {
        return repo.findAllByOrderByOrdenAscIdAsc().stream().map(BannerService::dto).toList();
    }

    @Transactional
    public List<AdminDto.Banner> crear(AdminDto.BannerRequest r) {
        Banner b = new Banner();
        aplicar(b, r);
        b.setOrden(repo.findAll().stream().mapToInt(Banner::getOrden).max().orElse(-1) + 1);
        repo.save(b);
        return listar();
    }

    @Transactional
    public List<AdminDto.Banner> actualizar(Long id, AdminDto.BannerRequest r) {
        Banner b = buscar(id);
        aplicar(b, r);
        repo.save(b);
        return listar();
    }

    @Transactional
    public List<AdminDto.Banner> eliminar(Long id) {
        repo.delete(buscar(id));
        repo.flush();
        return listar();
    }

    /** Deja los banners en el orden de la lista de ids recibida. */
    @Transactional
    public List<AdminDto.Banner> ordenar(List<Long> ids) {
        int i = 0;
        for (Long id : ids) { Banner b = buscar(id); b.setOrden(i++); }
        return listar();
    }

    private void aplicar(Banner b, AdminDto.BannerRequest r) {
        if (r.imagenId() != null && !archivos.existsById(r.imagenId())) {
            throw ReglaNegocioException.invalido("La imagen ya no existe. Súbela de nuevo.");
        }
        b.setTitulo(r.titulo().trim());
        b.setSubtitulo(r.subtitulo() == null ? "" : r.subtitulo().trim());
        b.setBoton(r.boton() == null ? "" : r.boton().trim());
        b.setImagenId(r.imagenId());
        b.setColor(r.color() == null ? "" : r.color().toUpperCase());
        b.setActivo(r.activo());
    }

    private Banner buscar(Long id) {
        return repo.findById(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Ese banner no existe."));
    }

    private static AdminDto.Banner dto(Banner b) {
        return new AdminDto.Banner(b.getId(), b.getTitulo(), b.getSubtitulo(), b.getBoton(), b.getImagenId(), b.getColor(), b.isActivo(), b.getOrden());
    }
}
