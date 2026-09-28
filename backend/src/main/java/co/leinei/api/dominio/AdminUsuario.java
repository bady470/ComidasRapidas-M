package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "admin_usuario")
public class AdminUsuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String usuario;
    private String nombre;
    @Column(name = "clave_hash")
    private String claveHash;
    private boolean activo = true;
    private Instant creado = Instant.now();

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
