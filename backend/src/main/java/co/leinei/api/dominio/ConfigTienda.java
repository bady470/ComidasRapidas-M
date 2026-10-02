package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Configuración de la tienda de una empresa (una sola fila en su base).
 * La marca (nombre comercial, logo, colores, dominio) vive en la base de control: ver EmpresaActual.
 */
@Entity
@Table(schema = "cliente", name = "tbl_configuraciones")
public class ConfigTienda implements Saturable {

    @Id
    private Short id = 1;
    @Column(updatable = false)
    private UUID uuid = UUID.randomUUID();
    // Textos de la portada
    private String eslogan = "";
    @Column(name = "titulo_portada")
    private String tituloPortada = "";
    private String mensaje = "";
    // Contacto
    private String whatsapp = "";
    private String direccion = "";
    private String ciudad = "";
    private String instagram = "";
    // Pedidos
    @Column(name = "es_abierta")
    private boolean abierto = true;
    @Enumerated(EnumType.STRING)
    @Column(name = "modo_pedido")
    private ModoPedido modoPedido = ModoPedido.INMEDIATO;
    @Column(name = "tiempo_minimo")
    private short tiempoMin;
    @Column(name = "tiempo_maximo")
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
    @Column(name = "tiene_domicilio")
    private boolean domicilioActivo;
    @Column(name = "domicilio_valor")
    private int domicilioValor;
    @Column(name = "tiene_recogida")
    private boolean recogerActivo;
    // Pagos y reportes
    @Column(name = "tiene_efectivo")
    private boolean efectivo;
    @Column(name = "costo_operativo_unidad")
    private int costoOperativoUnidad;
    @Column(name = "actualizado_en")
    private Instant actualizado;
    // Modo «estamos llenos»: cada ajuste vence solo a su hora.
    @Column(name = "minutos_extra")
    private short minutosExtra;
    @Column(name = "demora_hasta")
    private Instant demoraHasta;
    @Column(name = "domicilios_pausados_hasta")
    private Instant domiciliosPausadosHasta;
    @Column(name = "pedidos_pausados_hasta")
    private Instant pedidosPausadosHasta;

    // Mapas: ubicación del local, domicilio por distancia (tramos «km:valor;…») y seguimiento en vivo.
    @Column(name = "local_lat")
    private Double localLat;
    @Column(name = "local_lng")
    private Double localLng;
    @Column(name = "domicilio_modo")
    private String domicilioModo = "FIJO";
    @Column(name = "domicilio_tramos")
    private String domicilioTramos = "";
    @Column(name = "tiene_seguimiento_vivo")
    private boolean seguimientoVivo = true;
    /** Con varias sedes: COMPARTIDO (el mismo menú) o POR_SEDE (cada sede con sus productos y precios). */
    @Column(name = "sedes_menu")
    private String sedesMenu = "COMPARTIDO";
    // Comandas impresas (ver OperacionDto.ConfigCocina)
    @Column(name = "impresion_modo")
    private String impresionModo = "APAGADA";
    @Column(name = "impresion_momento")
    private String impresionMomento = "NUEVO";
    @Column(name = "impresion_espera_pago")
    private boolean impresionEsperaPago = true;
    @Column(name = "impresion_papel")
    private short impresionPapel = 80;
    @Column(name = "impresion_copias")
    private short impresionCopias = 1;
    @Column(name = "impresion_precios")
    private boolean impresionPrecios = true;
    @Column(name = "impresion_pie")
    private String impresionPie = "";
    /** Mensaje para escribirle a un cliente que dejó de pedir ({nombre}, {tienda}, {link}, {dias}). */
    @Column(name = "mensaje_recuperar")
    private String mensajeRecuperar = "";
    /** Presentación del menú para los clientes. */
    @Enumerated(EnumType.STRING)
    private PlantillaTienda plantilla = PlantillaTienda.CLASICA;

    /** Minutos que se suman al tiempo de entrega mientras dure la demora. */
    public int minutosExtraVigentes(Instant ahora) {
        return demoraHasta != null && demoraHasta.isAfter(ahora) ? minutosExtra : 0;
    }

    public boolean domiciliosPausados(Instant ahora) {
        return domiciliosPausadosHasta != null && domiciliosPausadosHasta.isAfter(ahora);
    }

    public boolean pedidosPausados(Instant ahora) {
        return pedidosPausadosHasta != null && pedidosPausadosHasta.isAfter(ahora);
    }

    /** Domicilio activo y sin pausa en este momento. */
    public boolean domicilioDisponible(Instant ahora) {
        return domicilioActivo && !domiciliosPausados(ahora);
    }

    @PreUpdate
    void alActualizar() { actualizado = Instant.now(); }

    /** Horas de entrega del modo programado, una por línea. */
    public List<String> listaFranjas() {
        return Arrays.stream(franjas == null ? new String[0] : franjas.split("\n"))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public Short getId() { return id; }
    public UUID getUuid() { return uuid; }
    public String getEslogan() { return eslogan; }
    public void setEslogan(String v) { eslogan = v; }
    public String getTituloPortada() { return tituloPortada; }
    public void setTituloPortada(String v) { tituloPortada = v; }
    public String getMensaje() { return mensaje; }
    public void setMensaje(String v) { mensaje = v; }
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
    public Double getLocalLat() { return localLat; }
    public void setLocalLat(Double v) { localLat = v; }
    public Double getLocalLng() { return localLng; }
    public void setLocalLng(Double v) { localLng = v; }
    public String getDomicilioModo() { return domicilioModo; }
    public void setDomicilioModo(String v) { domicilioModo = v; }
    public String getDomicilioTramos() { return domicilioTramos; }
    public void setDomicilioTramos(String v) { domicilioTramos = v == null ? "" : v; }
    public String getSedesMenu() { return sedesMenu; }
    public void setSedesMenu(String v) { sedesMenu = v; }
    public boolean isSeguimientoVivo() { return seguimientoVivo; }
    public void setSeguimientoVivo(boolean v) { seguimientoVivo = v; }
    public boolean tieneUbicacion() { return localLat != null && localLng != null; }
    public String getImpresionModo() { return impresionModo; }
    public void setImpresionModo(String v) { impresionModo = v; }
    public String getImpresionMomento() { return impresionMomento; }
    public void setImpresionMomento(String v) { impresionMomento = v; }
    public boolean isImpresionEsperaPago() { return impresionEsperaPago; }
    public void setImpresionEsperaPago(boolean v) { impresionEsperaPago = v; }
    public int getImpresionPapel() { return impresionPapel; }
    public void setImpresionPapel(int v) { impresionPapel = (short) v; }
    public int getImpresionCopias() { return impresionCopias; }
    public void setImpresionCopias(int v) { impresionCopias = (short) v; }
    public boolean isImpresionPrecios() { return impresionPrecios; }
    public void setImpresionPrecios(boolean v) { impresionPrecios = v; }
    public String getImpresionPie() { return impresionPie; }
    public void setImpresionPie(String v) { impresionPie = v == null ? "" : v; }
    public String getMensajeRecuperar() { return mensajeRecuperar; }
    public void setMensajeRecuperar(String v) { mensajeRecuperar = v == null ? "" : v; }
    public PlantillaTienda getPlantilla() { return plantilla; }
    public void setPlantilla(PlantillaTienda v) { plantilla = v == null ? PlantillaTienda.CLASICA : v; }
    public int getMinutosExtra() { return minutosExtra; }
    public void setMinutosExtra(int v) { minutosExtra = (short) v; }
    public Instant getDemoraHasta() { return demoraHasta; }
    public void setDemoraHasta(Instant v) { demoraHasta = v; }
    public Instant getDomiciliosPausadosHasta() { return domiciliosPausadosHasta; }
    public void setDomiciliosPausadosHasta(Instant v) { domiciliosPausadosHasta = v; }
    public Instant getPedidosPausadosHasta() { return pedidosPausadosHasta; }
    public void setPedidosPausadosHasta(Instant v) { pedidosPausadosHasta = v; }
}
