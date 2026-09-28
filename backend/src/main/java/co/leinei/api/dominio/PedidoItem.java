package co.leinei.api.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "pedido_item")
public class PedidoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    private Pedido pedido;

    /** Puede quedar vacío si el producto se elimina después; el nombre y el precio quedan guardados. */
    @Column(name = "producto_id")
    private Long productoId;
    private String nombre;
    /** Opciones escogidas, ej. "Grande · Extra queso · Sin cebolla". */
    private String detalle = "";
    @Column(name = "precio_unitario")
    private int precioUnitario;
    @Column(name = "costo_unitario")
    private int costoUnitario;
    private int cantidad;

    public Long getId() { return id; }
    public Pedido getPedido() { return pedido; }
    void setPedido(Pedido v) { pedido = v; }
    public Long getProductoId() { return productoId; }
    public void setProductoId(Long v) { productoId = v; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getDetalle() { return detalle; }
    public void setDetalle(String v) { detalle = v == null ? "" : v; }
    public int getPrecioUnitario() { return precioUnitario; }
    public void setPrecioUnitario(int v) { precioUnitario = v; }
    public int getCostoUnitario() { return costoUnitario; }
    public void setCostoUnitario(int v) { costoUnitario = v; }
    public int getCantidad() { return cantidad; }
    public void setCantidad(int v) { cantidad = v; }
}
