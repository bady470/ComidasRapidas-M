package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Grupo de opciones de un producto.
 * Ejemplos: "Tamaño" (mínimo 1, máximo 1), "Adiciones" (mínimo 0, máximo 5), "Sin…" (mínimo 0, máximo 4).
 */
@Entity
@Table(name = "grupo_opcion")
public class GrupoOpcion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id")
    private Producto producto;
    private String nombre;
    private short minimo;
    private short maximo = 1;
    private int orden;

    @OneToMany(mappedBy = "grupo", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orden ASC, id ASC")
    private List<Opcion> opciones = new ArrayList<>();

    public void agregarOpcion(Opcion o) {
        o.setGrupo(this);
        opciones.add(o);
    }

    public Long getId() { return id; }
    public void setId(Long v) { id = v; }
    public Producto getProducto() { return producto; }
    void setProducto(Producto v) { producto = v; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public int getMinimo() { return minimo; }
    public void setMinimo(int v) { minimo = (short) v; }
    public int getMaximo() { return maximo; }
    public void setMaximo(int v) { maximo = (short) v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
    public List<Opcion> getOpciones() { return opciones; }
}
