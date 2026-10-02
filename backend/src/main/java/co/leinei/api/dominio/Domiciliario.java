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
    /** Link personal de reparto (/reparto/{token}). */
    private String token;
    @Column(name = "ubicacion_lat")
    private Double ubicacionLat;
    @Column(name = "ubicacion_lng")
    private Double ubicacionLng;
    @Column(name = "ubicacion_precision")
    private Integer ubicacionPrecision;
    @Column(name = "ubicacion_en")
    private Instant ubicacionEn;

    public String getToken() { return token; }
    public void setToken(String v) { token = v; }
    public Double getUbicacionLat() { return ubicacionLat; }
    public Double getUbicacionLng() { return ubicacionLng; }
    public Integer getUbicacionPrecision() { return ubicacionPrecision; }
    public Instant getUbicacionEn() { return ubicacionEn; }

    public void ubicar(double lat, double lng, Integer precision) {
        ubicacionLat = lat;
        ubicacionLng = lng;
        ubicacionPrecision = precision;
        ubicacionEn = Instant.now();
    }

    /** Ubicación reciente (de los últimos minutos): si es más vieja, el celular dejó de compartirla. */
    public boolean ubicacionVigente(Instant ahora, java.time.Duration vigencia) {
        return ubicacionEn != null && ubicacionEn.isAfter(ahora.minus(vigencia));
    }

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
