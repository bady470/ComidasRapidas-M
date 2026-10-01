package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/** Aviso para el portal de la empresa: pedido nuevo o comprobante de pago recibido. */
@Entity
@Table(schema = "cliente", name = "tbl_notificaciones")
public class Notificacion {

    public enum Tipo { PEDIDO_NUEVO, PAGO_REPORTADO }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    @Enumerated(EnumType.STRING)
    private Tipo tipo;
    @Column(name = "pedido_id")
    private Long pedidoId;
    private String titulo;
    private String mensaje = "";
    @Column(name = "es_leida")
    private boolean leida;
    @Column(name = "creado_en", updatable = false)
    private Instant creado = Instant.now();

    public static Notificacion de(Tipo tipo, Long pedidoId, String titulo, String mensaje) {
        Notificacion n = new Notificacion();
        n.tipo = tipo;
        n.pedidoId = pedidoId;
        n.titulo = titulo.length() > 120 ? titulo.substring(0, 120) : titulo;
        n.mensaje = mensaje == null ? "" : (mensaje.length() > 300 ? mensaje.substring(0, 300) : mensaje);
        return n;
    }

    public Long getId() { return id; }
    public Tipo getTipo() { return tipo; }
    public Long getPedidoId() { return pedidoId; }
    public String getTitulo() { return titulo; }
    public String getMensaje() { return mensaje; }
    public boolean isLeida() { return leida; }
    public void setLeida(boolean v) { leida = v; }
    public Instant getCreado() { return creado; }
}
