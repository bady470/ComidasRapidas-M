package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Entity
@Table(name = "promocion")
public class Promocion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre;
    private String descripcion = "";
    @Enumerated(EnumType.STRING)
    private TipoPromocion tipo;
    /** COMBO: cuántos postres. */
    private Integer cantidad;
    /** COMBO: precio del combo. PRECIO_ESPECIAL: precio rebajado. */
    private Integer precio;
    /** PORCENTAJE: 1 a 90. */
    private Integer porcentaje;
    /** PORCENTAJE y ENVIO_GRATIS: compra mínima. */
    private int minimo;
    /** PRECIO_ESPECIAL: el postre rebajado. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "producto_id")
    private Producto producto;
    private boolean activa = true;
    private boolean destacada = true;
    private LocalDate desde;
    private LocalDate hasta;
    private Instant creado = Instant.now();

    /** COMBO y PORCENTAJE: postres incluidos. Vacío = todos. */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "promocion_producto",
            joinColumns = @JoinColumn(name = "promocion_id"),
            inverseJoinColumns = @JoinColumn(name = "producto_id"))
    private Set<Producto> productos = new HashSet<>();

    /** Si está activa para un domingo de entrega dado. */
    public boolean vigentePara(LocalDate fecha) {
        if (!activa) return false;
        if (desde != null && fecha.isBefore(desde)) return false;
        return hasta == null || !fecha.isAfter(hasta);
    }

    public boolean incluye(Long productoId) {
        return productos.isEmpty() || productos.stream().anyMatch(p -> Objects.equals(p.getId(), productoId));
    }

    public Long getId() { return id; }
    public void setId(Long v) { id = v; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String v) { descripcion = v; }
    public TipoPromocion getTipo() { return tipo; }
    public void setTipo(TipoPromocion v) { tipo = v; }
    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer v) { cantidad = v; }
    public Integer getPrecio() { return precio; }
    public void setPrecio(Integer v) { precio = v; }
    public Integer getPorcentaje() { return porcentaje; }
    public void setPorcentaje(Integer v) { porcentaje = v; }
    public int getMinimo() { return minimo; }
    public void setMinimo(int v) { minimo = v; }
    public Producto getProducto() { return producto; }
    public void setProducto(Producto v) { producto = v; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean v) { activa = v; }
    public boolean isDestacada() { return destacada; }
    public void setDestacada(boolean v) { destacada = v; }
    public LocalDate getDesde() { return desde; }
    public void setDesde(LocalDate v) { desde = v; }
    public LocalDate getHasta() { return hasta; }
    public void setHasta(LocalDate v) { hasta = v; }
    public Instant getCreado() { return creado; }
    public Set<Producto> getProductos() { return productos; }
    public void setProductos(Set<Producto> v) { productos = v; }
}
