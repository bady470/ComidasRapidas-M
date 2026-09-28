package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/** Imagen subida desde el panel (logo o foto de producto). */
@Entity
@Table(schema = "producto", name = "tbl_archivos")
public class Archivo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    @Column(name = "tipo_contenido")
    private String tipoContenido;
    @Basic(fetch = FetchType.LAZY)
    private byte[] datos;
    private int tamano;
    @Column(name = "creado_en")
    private Instant creado = Instant.now();

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public String getTipoContenido() { return tipoContenido; }
    public void setTipoContenido(String v) { tipoContenido = v; }
    public byte[] getDatos() { return datos; }
    public void setDatos(byte[] v) { datos = v; tamano = v == null ? 0 : v.length; }
    public int getTamano() { return tamano; }
    public Instant getCreado() { return creado; }
}
