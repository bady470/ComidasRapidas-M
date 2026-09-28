package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(schema = "producto", name = "tbl_pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String codigo;
    @Column(name = "creado_en")
    private Instant creado = Instant.now();
    @Column(name = "actualizado_en")
    private Instant actualizado = Instant.now();
    @Column(name = "entrega_en")
    private LocalDate fechaEntrega;
    private String franja = "";
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_entrega")
    private TipoEntrega tipoEntrega = TipoEntrega.DOMICILIO;
    private String zona = "";
    @Column(name = "cliente_nombre")
    private String clienteNombre;
    @Column(name = "cliente_celular")
    private String clienteCelular;
    private String barrio = "";
    private String direccion = "";
    private String referencia = "";
    private String notas = "";
    private int subtotal;
    private int descuento;
    @Column(name = "promocion_aplicada")
    private String promocionAplicada = "";
    private int domicilio;
    private int total;
    @Column(name = "costo_total")
    private int costoTotal;
    @Enumerated(EnumType.STRING)
    @Column(name = "metodo_pago")
    private MetodoPago metodoPago;
    @Column(name = "cuenta_entidad")
    private String cuentaEntidad = "";
    @Column(name = "cuenta_titular")
    private String cuentaTitular = "";
    @Column(name = "cuenta_numero")
    private String cuentaNumero = "";
    @Enumerated(EnumType.STRING)
    @Column(name = "estado_pago")
    private EstadoPago estadoPago = EstadoPago.PENDIENTE;
    @Enumerated(EnumType.STRING)
    private EstadoPedido estado = EstadoPedido.NUEVO;
    @Enumerated(EnumType.STRING)
    private OrigenPedido origen = OrigenPedido.WEB;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<PedidoItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("creado ASC")
    private List<PedidoEvento> eventos = new ArrayList<>();

    @PreUpdate
    void alActualizar() { actualizado = Instant.now(); }

    public void agregarItem(PedidoItem item) {
        item.setPedido(this);
        items.add(item);
    }

    public void registrarEvento(EstadoPedido estado, String nota, String autor) {
        PedidoEvento e = new PedidoEvento();
        e.setPedido(this);
        e.setEstado(estado);
        e.setNota(nota == null ? "" : nota);
        e.setAutor(autor == null ? "" : autor);
        eventos.add(e);
    }

    public int cantidadUnidades() {
        return items.stream().mapToInt(PedidoItem::getCantidad).sum();
    }

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String v) { codigo = v; }
    public Instant getCreado() { return creado; }
    public Instant getActualizado() { return actualizado; }
    public LocalDate getFechaEntrega() { return fechaEntrega; }
    public void setFechaEntrega(LocalDate v) { fechaEntrega = v; }
    public String getFranja() { return franja; }
    public void setFranja(String v) { franja = v == null ? "" : v; }
    public TipoEntrega getTipoEntrega() { return tipoEntrega; }
    public void setTipoEntrega(TipoEntrega v) { tipoEntrega = v; }
    public String getZona() { return zona; }
    public void setZona(String v) { zona = v == null ? "" : v; }
    public String getClienteNombre() { return clienteNombre; }
    public void setClienteNombre(String v) { clienteNombre = v; }
    public String getClienteCelular() { return clienteCelular; }
    public void setClienteCelular(String v) { clienteCelular = v; }
    public String getBarrio() { return barrio; }
    public void setBarrio(String v) { barrio = v == null ? "" : v; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String v) { direccion = v == null ? "" : v; }
    public String getReferencia() { return referencia; }
    public void setReferencia(String v) { referencia = v == null ? "" : v; }
    public String getNotas() { return notas; }
    public void setNotas(String v) { notas = v == null ? "" : v; }
    public int getSubtotal() { return subtotal; }
    public void setSubtotal(int v) { subtotal = v; }
    public int getDescuento() { return descuento; }
    public void setDescuento(int v) { descuento = v; }
    public String getPromocionAplicada() { return promocionAplicada; }
    public void setPromocionAplicada(String v) { promocionAplicada = v == null ? "" : v; }
    public int getDomicilio() { return domicilio; }
    public void setDomicilio(int v) { domicilio = v; }
    public int getTotal() { return total; }
    public void setTotal(int v) { total = v; }
    public int getCostoTotal() { return costoTotal; }
    public void setCostoTotal(int v) { costoTotal = v; }
    public MetodoPago getMetodoPago() { return metodoPago; }
    public void setMetodoPago(MetodoPago v) { metodoPago = v; }
    public String getCuentaEntidad() { return cuentaEntidad; }
    public void setCuentaEntidad(String v) { cuentaEntidad = v == null ? "" : v; }
    public String getCuentaTitular() { return cuentaTitular; }
    public void setCuentaTitular(String v) { cuentaTitular = v == null ? "" : v; }
    public String getCuentaNumero() { return cuentaNumero; }
    public void setCuentaNumero(String v) { cuentaNumero = v == null ? "" : v; }
    public EstadoPago getEstadoPago() { return estadoPago; }
    public void setEstadoPago(EstadoPago v) { estadoPago = v; }
    public EstadoPedido getEstado() { return estado; }
    public void setEstado(EstadoPedido v) { estado = v; }
    public OrigenPedido getOrigen() { return origen; }
    public void setOrigen(OrigenPedido v) { origen = v; }
    public List<PedidoItem> getItems() { return items; }
    public List<PedidoEvento> getEventos() { return eventos; }
}
