package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(schema = "producto", name = "tbl_productos")
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String slug;
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;
    private String nombre;
    private String descripcion = "";
    private int precio;
    /** Costo por unidad. Solo lo ve el administrador. */
    private int costo;
    @Column(name = "archivo_id")
    private Long imagenId;
    private String etiqueta = "";
    @Column(name = "es_disponible")
    private boolean disponible = true;
    private int orden;
    @Column(name = "creado_en")
    private Instant creado = Instant.now();
    @Column(name = "actualizado_en")
    private Instant actualizado = Instant.now();

    @OneToMany(mappedBy = "producto", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orden ASC, id ASC")
    private List<GrupoOpcion> grupos = new ArrayList<>();

    @PreUpdate
    void alActualizar() { actualizado = Instant.now(); }

    public void agregarGrupo(GrupoOpcion g) {
        g.setProducto(this);
        grupos.add(g);
    }

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public void setId(Long v) { id = v; }
    public String getSlug() { return slug; }
    public void setSlug(String v) { slug = v; }
    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria v) { categoria = v; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String v) { descripcion = v; }
    public int getPrecio() { return precio; }

    // Lo que cambia en la sede del pedido (no se guarda: lo pone SedeService al cargar el producto para una sede).
    @Transient
    private Integer precioSede;
    @Transient
    private Boolean disponibleSede;
    @Transient
    private boolean ofrecidoSede = true;

    public void aplicarSede(Integer precio, boolean disponible, boolean ofrecido) {
        precioSede = precio;
        disponibleSede = disponible;
        ofrecidoSede = ofrecido;
    }

    /** Precio de venta: el de la sede si tiene uno propio, si no el del producto. */
    public int precioVenta() { return precioSede != null ? precioSede : precio; }

    /** Disponible para vender: el producto y, si hay sede, también en esa sede. */
    public boolean disponibleVenta() { return disponible && (disponibleSede == null || disponibleSede); }

    /** La sede lo tiene en su menú (con el menú personalizado por sede). */
    public boolean ofrecidoEnSede() { return ofrecidoSede; }
    public void setPrecio(int v) { precio = v; }
    public int getCosto() { return costo; }
    public void setCosto(int v) { costo = v; }
    public Long getImagenId() { return imagenId; }
    public void setImagenId(Long v) { imagenId = v; }
    public String getEtiqueta() { return etiqueta; }
    public void setEtiqueta(String v) { etiqueta = v; }
    public boolean isDisponible() { return disponible; }
    public void setDisponible(boolean v) { disponible = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
    public Instant getCreado() { return creado; }
    public Instant getActualizado() { return actualizado; }
    public List<GrupoOpcion> getGrupos() { return grupos; }
}
