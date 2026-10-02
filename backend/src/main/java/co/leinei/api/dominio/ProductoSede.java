package co.leinei.api.dominio;

import jakarta.persistence.*;

/**
 * Lo que cambia de un producto en una sede: agotado ahí (siempre aplica) y, con el menú personalizado por sede,
 * si la sede lo ofrece y su propio precio. Sin fila, el producto en esa sede es igual al de la empresa.
 */
@Entity
@Table(schema = "producto", name = "tbl_productos_sede")
public class ProductoSede {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    @Column(name = "producto_id")
    private Long productoId;
    @Column(name = "sede_id")
    private Long sedeId;
    @Column(name = "es_disponible")
    private boolean disponible = true;
    @Column(name = "es_ofrecido")
    private boolean ofrecido = true;
    /** null = el precio del producto. */
    private Integer precio;

    public ProductoSede() {}

    public ProductoSede(Long productoId, Long sedeId) {
        this.productoId = productoId;
        this.sedeId = sedeId;
    }

    public Long getId() { return id; }
    public Long getProductoId() { return productoId; }
    public Long getSedeId() { return sedeId; }
    public boolean isDisponible() { return disponible; }
    public void setDisponible(boolean v) { disponible = v; }
    public boolean isOfrecido() { return ofrecido; }
    public void setOfrecido(boolean v) { ofrecido = v; }
    public Integer getPrecio() { return precio; }
    public void setPrecio(Integer v) { precio = v; }
}
