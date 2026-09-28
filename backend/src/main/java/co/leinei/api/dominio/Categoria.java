package co.leinei.api.dominio;

import jakarta.persistence.*;

@Entity
@Table(schema = "producto", name = "tbl_categorias")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String nombre;
    @Column(name = "es_activa")
    private boolean activa = true;
    private int orden;

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean v) { activa = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
