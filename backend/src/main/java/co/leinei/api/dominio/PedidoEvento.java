package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "pedido_evento")
public class PedidoEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    private Pedido pedido;

    @Enumerated(EnumType.STRING)
    private EstadoPedido estado;
    private String nota = "";
    private String autor = "";
    private Instant creado = Instant.now();

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
