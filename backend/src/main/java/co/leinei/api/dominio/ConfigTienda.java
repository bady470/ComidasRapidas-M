package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/** Configuración de la tienda: marca, contacto, forma de pedir, entrega y pagos. Hay una sola fila. */
@Entity
@Table(name = "config_tienda")
public class ConfigTienda {

    @Id
    private Short id = 1;
    // Marca
    private String nombre;
    private String eslogan = "";
    @Column(name = "titulo_portada")
    private String tituloPortada = "";
    private String mensaje = "";
    @Column(name = "logo_id")
    private Long logoId;
    @Column(name = "color_primario")
    private String colorPrimario;
    @Column(name = "color_secundario")
    private String colorSecundario;
    // Contacto
    private String whatsapp = "";
    private String direccion = "";
    private String ciudad = "";
    private String instagram = "";
    // Pedidos
    private boolean abierto = true;
    @Enumerated(EnumType.STRING)
    @Column(name = "modo_pedido")
    private ModoPedido modoPedido = ModoPedido.INMEDIATO;
    @Column(name = "tiempo_min")
    private short tiempoMin;
    @Column(name = "tiempo_max")
    private short tiempoMax;
    @Column(name = "dia_entrega")
    private short diaEntrega;
    @Column(name = "cierre_dias_antes")
    private short cierreDiasAntes;
    @Column(name = "cierre_hora")
    private short cierreHora;
    private String franjas = "";
    @Column(name = "pedido_minimo")
    private int pedidoMinimo;
    // Entrega
    @Column(name = "domicilio_activo")
    private boolean domicilioActivo;
    @Column(name = "domicilio_valor")
    private int domicilioValor;
    @Column(name = "recoger_activo")
    private boolean recogerActivo;
    // Pagos y reportes
    private boolean efectivo;
    @Column(name = "costo_operativo_unidad")
    private int costoOperativoUnidad;
    private Instant actualizado;

    @PreUpdate
    void alActualizar() { actualizado = Instant.now(); }

    /** Horas de entrega del modo programado, una por línea. */
    public List<String> listaFranjas() {
        return Arrays.stream(franjas == null ? new String[0] : franjas.split("\n"))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public Short getId() { return id; }
    public String getNombre() { return nombre; }
    public void setNombre(String v) { nombre = v; }
    public String getEslogan() { return eslogan; }
    public void setEslogan(String v) { eslogan = v; }
    public String getTituloPortada() { return tituloPortada; }
    public void setTituloPortada(String v) { tituloPortada = v; }
    public String getMensaje() { return mensaje; }
    public void setMensaje(String v) { mensaje = v; }
    public Long getLogoId() { return logoId; }
    public void setLogoId(Long v) { logoId = v; }
    public String getColorPrimario() { return colorPrimario; }
    public void setColorPrimario(String v) { colorPrimario = v; }
    public String getColorSecundario() { return colorSecundario; }
    public void setColorSecundario(String v) { colorSecundario = v; }
    public String getWhatsapp() { return whatsapp; }
    public void setWhatsapp(String v) { whatsapp = v; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String v) { direccion = v; }
    public String getCiudad() { return ciudad; }
    public void setCiudad(String v) { ciudad = v; }
    public String getInstagram() { return instagram; }
    public void setInstagram(String v) { instagram = v; }
    public boolean isAbierto() { return abierto; }
    public void setAbierto(boolean v) { abierto = v; }
    public ModoPedido getModoPedido() { return modoPedido; }
    public void setModoPedido(ModoPedido v) { modoPedido = v; }
    public int getTiempoMin() { return tiempoMin; }
    public void setTiempoMin(int v) { tiempoMin = (short) v; }
    public int getTiempoMax() { return tiempoMax; }
    public void setTiempoMax(int v) { tiempoMax = (short) v; }
    public int getDiaEntrega() { return diaEntrega; }
    public void setDiaEntrega(int v) { diaEntrega = (short) v; }
    public int getCierreDiasAntes() { return cierreDiasAntes; }
    public void setCierreDiasAntes(int v) { cierreDiasAntes = (short) v; }
    public int getCierreHora() { return cierreHora; }
    public void setCierreHora(int v) { cierreHora = (short) v; }
    public String getFranjas() { return franjas; }
    public void setFranjas(String v) { franjas = v; }
    public int getPedidoMinimo() { return pedidoMinimo; }
    public void setPedidoMinimo(int v) { pedidoMinimo = v; }
    public boolean isDomicilioActivo() { return domicilioActivo; }
    public void setDomicilioActivo(boolean v) { domicilioActivo = v; }
    public int getDomicilioValor() { return domicilioValor; }
    public void setDomicilioValor(int v) { domicilioValor = v; }
    public boolean isRecogerActivo() { return recogerActivo; }
    public void setRecogerActivo(boolean v) { recogerActivo = v; }
    public boolean isEfectivo() { return efectivo; }
    public void setEfectivo(boolean v) { efectivo = v; }
    public int getCostoOperativoUnidad() { return costoOperativoUnidad; }
    public void setCostoOperativoUnidad(int v) { costoOperativoUnidad = v; }
    public Instant getActualizado() { return actualizado; }
}
