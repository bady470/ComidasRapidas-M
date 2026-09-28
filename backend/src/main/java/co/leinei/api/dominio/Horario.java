package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.LocalTime;

/** Turno de atención de un día de la semana (1 = lunes … 7 = domingo). */
@Entity
@Table(name = "horario")
public class Horario {

    @Id
    private Short dia;
    private boolean activo = true;
    private LocalTime abre;
    private LocalTime cierra;

    public Horario() {}

    public Horario(int dia, boolean activo, LocalTime abre, LocalTime cierra) {
        this.dia = (short) dia;
        this.activo = activo;
        this.abre = abre;
        this.cierra = cierra;
    }

    /** El turno pasa la medianoche (ej. 18:00 a 02:00). */
    public boolean cruzaMedianoche() {
        return !cierra.isAfter(abre);
    }

    public int getDia() { return dia; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean v) { activo = v; }
    public LocalTime getAbre() { return abre; }
    public void setAbre(LocalTime v) { abre = v; }
    public LocalTime getCierra() { return cierra; }
    public void setCierra(LocalTime v) { cierra = v; }
}
