package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Un local de la empresa. Lo que cambia de un local a otro vive aquí (dirección, ubicación, tramos de domicilio,
 * abierto, tiempos y el modo «estamos llenos»); lo demás es de la empresa (ver ConfigTienda).
 */
@Entity
@Table(schema = "cliente", name = "tbl_sedes")
public class Sede implements Saturable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String nombre;
    private String direccion = "";
    private String ciudad = "";
    private String whatsapp = "";
    @Column(name = "local_lat")
    private Double localLat;
    @Column(name = "local_lng")
    private Double localLng;
    @Column(name = "domicilio_tramos")
    private String domicilioTramos = "";
    @Column(name = "es_abierta")
    private boolean abierta = true;
    @Column(name = "tiempo_minimo")
    private short tiempoMin = 30;
    @Column(name = "tiempo_maximo")
    private short tiempoMax = 45;
    @Column(name = "minutos_extra")
    private short minutosExtra;
    @Column(name = "demora_hasta")
    private Instant demoraHasta;
    @Column(name = "domicilios_pausados_hasta")
    private Instant domiciliosPausadosHasta;
    @Column(name = "pedidos_pausados_hasta")
    private Instant pedidosPausadosHasta;
    @Column(name = "es_activa")
    private boolean activa = true;
    @Column(name = "es_principal")
    private boolean principal;
    private int orden;
    @Column(name = "creado_en", updatable = false)
    private Instant creado = Instant.now();

    public boolean tieneUbicacion() { return localLat != null && localLng != null; }

    public Long getId() { return id; }
    public java.util.UUID getUuid() { return uuid; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String v) { direccion = v == null ? "" : v; }
    public String getCiudad() { return ciudad; }
    public void setCiudad(String v) { ciudad = v == null ? "" : v; }
    public String getWhatsapp() { return whatsapp; }
    public void setWhatsapp(String v) { whatsapp = v == null ? "" : v; }
    public Double getLocalLat() { return localLat; }
    public void setLocalLat(Double v) { localLat = v; }
    public Double getLocalLng() { return localLng; }
    public void setLocalLng(Double v) { localLng = v; }
    public String getDomicilioTramos() { return domicilioTramos; }
    public void setDomicilioTramos(String v) { domicilioTramos = v == null ? "" : v; }
    public boolean isAbierta() { return abierta; }
    public void setAbierta(boolean v) { abierta = v; }
    public int getTiempoMin() { return tiempoMin; }
    public void setTiempoMin(int v) { tiempoMin = (short) v; }
    public int getTiempoMax() { return tiempoMax; }
    public void setTiempoMax(int v) { tiempoMax = (short) v; }
    public int getMinutosExtra() { return minutosExtra; }
    public void setMinutosExtra(int v) { minutosExtra = (short) v; }
    public Instant getDemoraHasta() { return demoraHasta; }
    public void setDemoraHasta(Instant v) { demoraHasta = v; }
    public Instant getDomiciliosPausadosHasta() { return domiciliosPausadosHasta; }
    public void setDomiciliosPausadosHasta(Instant v) { domiciliosPausadosHasta = v; }
    public Instant getPedidosPausadosHasta() { return pedidosPausadosHasta; }
    public void setPedidosPausadosHasta(Instant v) { pedidosPausadosHasta = v; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean v) { activa = v; }
    public boolean isPrincipal() { return principal; }
    public void setPrincipal(boolean v) { principal = v; }
    public int getOrden() { return orden; }
    public void setOrden(int v) { orden = v; }
}
