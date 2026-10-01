package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/** Persona que lleva los domicilios. No se borra: se desactiva. */
@Entity
@Table(schema = "cliente", name = "tbl_domiciliarios")
public class Domiciliario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String nombre;
    private String celular = "";
    @Column(name = "es_activo")
    private boolean activo = true;
    private int orden;
    @Column(name = "creado_en", updatable = false)
    private Instant creado = Instant.now();

    public Long getId() { return id; }
    public java.util.UUID getUuid() { return uuid; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getCelular() { return celular; }
    public void setCelular(String v) { celular = v == null ? "" : v; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean v) { activo = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
