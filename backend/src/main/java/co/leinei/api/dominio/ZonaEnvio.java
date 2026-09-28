package co.leinei.api.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "zona_envio")
public class ZonaEnvio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre;
    private int valor;
    private boolean activa = true;
    private int orden;

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public int getValor() { return valor; }
    public void setValor(int v) { valor = v; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean v) { activa = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
