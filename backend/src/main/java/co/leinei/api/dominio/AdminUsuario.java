package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(schema = "cliente", name = "tbl_administradores")
public class AdminUsuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String usuario;
    private String nombre;
    @Column(name = "clave_hash")
    private String claveHash;
    @Column(name = "es_activo")
    private boolean activo = true;
    @Column(name = "creado_en")
    private Instant creado = Instant.now();

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public String getUsuario() { return usuario; }
    public void setUsuario(String v) { usuario = v; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getClaveHash() { return claveHash; }
    public void setClaveHash(String v) { claveHash = v; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean v) { activo = v; }
    public Instant getCreado() { return creado; }
}
