package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(schema = "producto", name = "tbl_pedidos_eventos")
public class PedidoEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    private Pedido pedido;

    @Enumerated(EnumType.STRING)
    private EstadoPedido estado;
    private String nota = "";
    private String autor = "";
    @Column(name = "creado_en")
    private Instant creado = Instant.now();

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public Pedido getPedido() { return pedido; }
    void setPedido(Pedido v) { pedido = v; }
    public EstadoPedido getEstado() { return estado; }
    void setEstado(EstadoPedido v) { estado = v; }
    public String getNota() { return nota; }
    void setNota(String v) { nota = v; }
    public String getAutor() { return autor; }
    void setAutor(String v) { autor = v; }
    public Instant getCreado() { return creado; }
}
