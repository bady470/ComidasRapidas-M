package co.leinei.api.dominio;

import jakarta.persistence.*;

/** Cuenta a la que el cliente transfiere: Nequi, Daviplata, Bancolombia, una llave Bre-B… */
@Entity
@Table(name = "cuenta_pago")
public class CuentaPago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String entidad;
    private String titular;
    private String numero;
    private boolean activa = true;
    private int orden;

    public Long getId() { return id; }
    public String getEntidad() { return entidad; }
    public void setEntidad(String v) { entidad = v; }
    public String getTitular() { return titular; }
    public void setTitular(String v) { titular = v; }
    public String getNumero() { return numero; }
    public void setNumero(String v) { numero = v; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean v) { activa = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
