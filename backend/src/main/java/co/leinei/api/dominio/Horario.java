package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.LocalTime;
import java.util.UUID;

/** Turno de atención de un día de la semana (1 = lunes … 7 = domingo). */
@Entity
@Table(schema = "cliente", name = "tbl_horarios")
public class Horario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private UUID uuid = UUID.randomUUID();
    private short dia;
    @Column(name = "es_activo")
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

    public Long getId() { return id; }
    public UUID getUuid() { return uuid; }
    public int getDia() { return dia; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean v) { activo = v; }
    public LocalTime getAbre() { return abre; }
    public void setAbre(LocalTime v) { abre = v; }
    public LocalTime getCierra() { return cierra; }
    public void setCierra(LocalTime v) { cierra = v; }
}
