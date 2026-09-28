package co.leinei.api.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "opcion")
public class Opcion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "grupo_id")
    private GrupoOpcion grupo;
    private String nombre;
    @Column(name = "precio_extra")
    private int precioExtra;
    private boolean disponible = true;
    private int orden;

    public Long getId() { return id; }
    public void setId(Long v) { id = v; }
    public GrupoOpcion getGrupo() { return grupo; }
    void setGrupo(GrupoOpcion v) { grupo = v; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public int getPrecioExtra() { return precioExtra; }
    public void setPrecioExtra(int v) { precioExtra = v; }
    public boolean isDisponible() { return disponible; }
    public void setDisponible(boolean v) { disponible = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
