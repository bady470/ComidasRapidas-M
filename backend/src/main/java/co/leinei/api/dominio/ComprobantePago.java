package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/** Comprobante de transferencia que adjunta el cliente. Solo lo ve la tienda. */
@Entity
@Table(schema = "producto", name = "tbl_comprobantes_pago")
public class ComprobantePago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    @Column(name = "pedido_id")
    private Long pedidoId;
    @Column(name = "tipo_contenido")
    private String tipoContenido;
    @Basic(fetch = FetchType.LAZY)
    private byte[] datos;
    private int tamano;
    @Column(name = "creado_en", updatable = false)
    private Instant creado = Instant.now();

    public Long getId() { return id; }
    public Long getPedidoId() { return pedidoId; }
    public void setPedidoId(Long v) { pedidoId = v; }
    public String getTipoContenido() { return tipoContenido; }
    public void setTipoContenido(String v) { tipoContenido = v; }
    public byte[] getDatos() { return datos; }
    public void setDatos(byte[] v) { datos = v; tamano = v == null ? 0 : v.length; }
    public int getTamano() { return tamano; }
    public Instant getCreado() { return creado; }
}
