package co.leinei.api.plataforma.servicio;

import co.leinei.api.dominio.Archivo;
import co.leinei.api.dominio.Categoria;
import co.leinei.api.dominio.GrupoOpcion;
import co.leinei.api.dominio.Opcion;
import co.leinei.api.dominio.Producto;
import co.leinei.api.repositorio.ArchivoRepositorio;
import co.leinei.api.repositorio.CategoriaRepositorio;
import co.leinei.api.repositorio.ProductoRepositorio;
import co.leinei.api.servicio.ReglaNegocioException;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Biblioteca de productos precargados que el superadmin puede copiar al catálogo de cualquier empresa
 * (salchipapas, hamburguesas, perros, pizzas, bebidas...). Vive en el código (recursos), no en una base:
 * es igual para todas las empresas y cada empresa recibe su propia copia, que luego edita a su gusto.
 */
@Service
public class BibliotecaService {

    public record Opcion_(String nombre, int precioExtra) {}
    public record Grupo_(String nombre, int minimo, int maximo, List<Opcion_> opciones) {}
    public record Item(String slug, String categoria, String nombre, String descripcion, int precio, int costo,
                       String imagen, String etiqueta, List<String> filtros, List<Grupo_> grupos) {}
    public record CategoriaInfo(String nombre, int orden, int cantidad) {}
    public record Biblioteca(List<CategoriaInfo> categorias, List<String> filtros, List<Item> productos) {}
    public record Resultado(int importados, int omitidos, int categoriasNuevas) {}

    public record Imagen(byte[] datos, String tipoContenido) {}

    private final ProductoRepositorio productoRepo;
    private final CategoriaRepositorio categoriaRepo;
    private final ArchivoRepositorio archivoRepo;

    private final Map<String, Integer> ordenCategorias = new LinkedHashMap<>();
    private final Map<String, Item> porSlug = new LinkedHashMap<>();
    private final Map<String, byte[]> imagenes = new HashMap<>();
    private Biblioteca biblioteca;

    public BibliotecaService(ProductoRepositorio productoRepo, CategoriaRepositorio categoriaRepo, ArchivoRepositorio archivoRepo) {
        this.productoRepo = productoRepo;
        this.categoriaRepo = categoriaRepo;
        this.archivoRepo = archivoRepo;
    }

    // ------------------------------------------------------------------ carga

    @PostConstruct
    void cargar() {
        try (InputStream in = getClass().getResourceAsStream("/catalogo-base/catalogo.txt")) {
            if (in == null) throw new IllegalStateException("Falta catalogo-base/catalogo.txt");
            List<String> lineas = new String(in.readAllBytes(), StandardCharsets.UTF_8).lines().toList();
            leer(lineas);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer la biblioteca de productos", e);
        }
    }

    private void leer(List<String> lineas) {
        List<Item> items = new ArrayList<>();
        String[] p = null;
        List<Grupo_> grupos = null;
        String[] g = null;
        List<Opcion_> ops = null;
        for (String linea : lineas) {
            if (linea.isBlank() || linea.startsWith("#")) continue;
            String[] c = linea.split("\\|", -1);
            switch (c[0]) {
                case "C" -> ordenCategorias.put(c[1], Integer.parseInt(c[2]));
                case "P" -> {
                    if (p != null) items.add(construir(p, grupos, g, ops));
                    p = c; grupos = new ArrayList<>(); g = null; ops = null;
                }
                case "G" -> {
                    if (g != null) grupos.add(new Grupo_(g[1], Integer.parseInt(g[2]), Integer.parseInt(g[3]), ops));
                    g = c; ops = new ArrayList<>();
                }
                case "O" -> ops.add(new Opcion_(c[1], Integer.parseInt(c[2])));
                default -> throw new IllegalStateException("Línea desconocida en la biblioteca: " + linea);
            }
        }
        if (p != null) items.add(construir(p, grupos, g, ops));

        Set<String> filtros = new TreeSet<>();
        Map<String, Integer> cuenta = new HashMap<>();
        for (Item i : items) {
            porSlug.put(i.slug(), i);
            filtros.addAll(i.filtros());
            cuenta.merge(i.categoria(), 1, Integer::sum);
            cargarImagen(i.imagen());
        }
        List<CategoriaInfo> cats = ordenCategorias.entrySet().stream()
                .map(e -> new CategoriaInfo(e.getKey(), e.getValue(), cuenta.getOrDefault(e.getKey(), 0))).toList();
        biblioteca = new Biblioteca(cats, List.copyOf(filtros), List.copyOf(items));
    }

    private static Item construir(String[] p, List<Grupo_> grupos, String[] g, List<Opcion_> ops) {
        List<Grupo_> todos = new ArrayList<>(grupos);
        if (g != null) todos.add(new Grupo_(g[1], Integer.parseInt(g[2]), Integer.parseInt(g[3]), ops));
        List<String> filtros = p[9].isBlank() ? List.of() : List.of(p[9].split(","));
        return new Item(p[1], p[2], p[3], p[4], Integer.parseInt(p[5]), Integer.parseInt(p[6]), p[7], p[8], filtros, todos);
    }

    private void cargarImagen(String nombre) {
        if (imagenes.containsKey(nombre)) return;
        try (InputStream in = getClass().getResourceAsStream("/catalogo-base/img/" + nombre + ".png")) {
            if (in == null) throw new IllegalStateException("Falta la imagen " + nombre);
            imagenes.put(nombre, in.readAllBytes());
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer la imagen " + nombre, e);
        }
    }

    // ------------------------------------------------------------------ consulta

    public Biblioteca todo() { return biblioteca; }

    public Imagen imagen(String nombre) {
        byte[] b = imagenes.get(nombre);
        if (b == null) throw ReglaNegocioException.noEncontrado("La imagen no existe.");
        return new Imagen(b, "image/png");
    }

    // ------------------------------------------------------------------ importación

    /**
     * Copia productos de la biblioteca al catálogo de la empresa que está en el contexto. Debe llamarse
     * dentro de una transacción de esa empresa. Si un producto ya existe (mismo identificador) se omite,
     * así que repetir la importación nunca duplica nada.
     *
     * @param ajustePorcentaje sube o baja todos los precios (por ejemplo 10 = +10 %), redondeando a $100
     */
    public Resultado aplicar(List<String> slugs, int ajustePorcentaje) {
        if (slugs == null || slugs.isEmpty()) throw ReglaNegocioException.invalido("Selecciona al menos un producto.");
        if (ajustePorcentaje < -50 || ajustePorcentaje > 200) throw ReglaNegocioException.invalido("El ajuste de precios debe estar entre -50% y 200%.");
        Set<String> pedidos = new HashSet<>(slugs);
        for (String s : pedidos) if (!porSlug.containsKey(s)) throw ReglaNegocioException.invalido("Producto desconocido: " + s);

        Map<String, Categoria> categorias = new HashMap<>();
        int ordenCat = 0;
        for (Categoria c : categoriaRepo.findAllByOrderByOrdenAscIdAsc()) {
            categorias.put(c.getNombre().toLowerCase(Locale.ROOT), c);
            ordenCat = Math.max(ordenCat, c.getOrden() + 1);
        }
        int ordenProd = (int) productoRepo.count();
        Map<String, Long> archivos = new HashMap<>();
        int importados = 0, omitidos = 0, nuevas = 0;

        // En el orden de la biblioteca, para que cada categoría quede ordenada igual que en el catálogo base.
        for (Item i : biblioteca.productos()) {
            if (!pedidos.contains(i.slug())) continue;
            if (productoRepo.existsBySlug(i.slug())) { omitidos++; continue; }

            Categoria cat = categorias.get(i.categoria().toLowerCase(Locale.ROOT));
            if (cat == null) {
                cat = new Categoria();
                cat.setNombre(i.categoria());
                cat.setActiva(true);
                cat.setOrden(ordenCat++);
                cat = categoriaRepo.save(cat);
                categorias.put(i.categoria().toLowerCase(Locale.ROOT), cat);
                nuevas++;
            }
            Long archivoId = archivos.computeIfAbsent(i.imagen(), k -> {
                Archivo a = new Archivo();
                a.setTipoContenido("image/png");
                a.setDatos(imagenes.get(k));
                return archivoRepo.save(a).getId();
            });

            Producto p = new Producto();
            p.setSlug(i.slug());
            p.setCategoria(cat);
            p.setNombre(i.nombre());
            p.setDescripcion(i.descripcion());
            p.setPrecio(ajustar(i.precio(), ajustePorcentaje));
            p.setCosto(i.costo());
            p.setImagenId(archivoId);
            p.setEtiqueta(i.etiqueta());
            p.setDisponible(true);
            p.setOrden(ordenProd++);
            int og = 0;
            for (Grupo_ gr : i.grupos()) {
                GrupoOpcion go = new GrupoOpcion();
                go.setNombre(gr.nombre());
                go.setMinimo(gr.minimo());
                go.setMaximo(gr.maximo());
                go.setOrden(og++);
                int oo = 0;
                for (Opcion_ op : gr.opciones()) {
                    Opcion o = new Opcion();
                    o.setNombre(op.nombre());
                    o.setPrecioExtra(op.precioExtra());
                    o.setDisponible(true);
                    o.setOrden(oo++);
                    go.agregarOpcion(o);
                }
                p.agregarGrupo(go);
            }
            productoRepo.save(p);
            importados++;
        }
        return new Resultado(importados, omitidos, nuevas);
    }

    static int ajustar(int precio, int pct) {
        long v = Math.round(precio * (100 + pct) / 100.0 / 100.0) * 100L;
        return (int) Math.max(v, 100);
    }
}
