package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/** Cierre de caja de un día de servicio: lo que se contó y una foto de los totales de ese momento. */
@Entity
@Table(schema = "cliente", name = "tbl_cierres_caja")
public class CierreCaja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private LocalDate fecha;
    @Column(name = "sede_id")
    private Long sedeId;
    @Column(name = "base_inicial")
    private int baseInicial;
    private int gastos;
    @Column(name = "nota_gastos")
    private String notaGastos = "";
    @Column(name = "efectivo_recibido")
    private int efectivoRecibido;
    @Column(name = "efectivo_esperado")
    private int efectivoEsperado;
    @Column(name = "efectivo_contado")
    private int efectivoContado;
    private int diferencia;
    private int transferencias;
    @Column(name = "en_linea")
    private int enLinea;
    @Column(name = "por_cobrar")
    private int porCobrar;
    private int ventas;
    private int pedidos;
    private String nota = "";
    @Column(name = "cerrado_por")
    private String cerradoPor = "";
    @Column(name = "cerrado_en")
    private Instant cerradoEn = Instant.now();
    @Column(name = "actualizado_en")
    private Instant actualizado = Instant.now();

    @PreUpdate
    void alActualizar() { actualizado = Instant.now(); }

    public Long getId() { return id; }
    public Long getSedeId() { return sedeId; }
    public void setSedeId(Long v) { sedeId = v; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate v) { fecha = v; }
    public int getBaseInicial() { return baseInicial; }
    public void setBaseInicial(int v) { baseInicial = v; }
    public int getGastos() { return gastos; }
    public void setGastos(int v) { gastos = v; }
    public String getNotaGastos() { return notaGastos; }
    public void setNotaGastos(String v) { notaGastos = v == null ? "" : v; }
    public int getEfectivoRecibido() { return efectivoRecibido; }
    public void setEfectivoRecibido(int v) { efectivoRecibido = v; }
    public int getEfectivoEsperado() { return efectivoEsperado; }
    public void setEfectivoEsperado(int v) { efectivoEsperado = v; }
    public int getEfectivoContado() { return efectivoContado; }
    public void setEfectivoContado(int v) { efectivoContado = v; }
    public int getDiferencia() { return diferencia; }
    public void setDiferencia(int v) { diferencia = v; }
    public int getTransferencias() { return transferencias; }
    public void setTransferencias(int v) { transferencias = v; }
    public int getEnLinea() { return enLinea; }
    public void setEnLinea(int v) { enLinea = v; }
    public int getPorCobrar() { return porCobrar; }
    public void setPorCobrar(int v) { porCobrar = v; }
    public int getVentas() { return ventas; }
    public void setVentas(int v) { ventas = v; }
    public int getPedidos() { return pedidos; }
    public void setPedidos(int v) { pedidos = v; }
    public String getNota() { return nota; }
    public void setNota(String v) { nota = v == null ? "" : v; }
    public String getCerradoPor() { return cerradoPor; }
    public void setCerradoPor(String v) { cerradoPor = v == null ? "" : v; }
    public Instant getCerradoEn() { return cerradoEn; }
    public void setCerradoEn(Instant v) { cerradoEn = v; }
}
