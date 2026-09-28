package co.leinei.api.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "categoria")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre;
    private boolean activa = true;
    private int orden;

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean v) { activa = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
