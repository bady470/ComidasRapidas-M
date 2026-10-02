package co.leinei.api.web.dto;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Estadísticas del negocio, cierre de caja y modo «estamos llenos» (portal de la empresa). */
public final class OperacionDto {

    private OperacionDto() {}

    // ---- Estadísticas
    /** ventas: total de los pedidos no cancelados (incluye domicilio). ganancia: estimada con costos y gasto operativo. */
    public record Resumen(long ventas, int pedidos, long ticketPromedio, int unidades, long ganancia, long cobrado,
                          long porCobrar, int cancelados, int clientes, int clientesNuevos, long domicilios) {}

    public record Dia(LocalDate fecha, long ventas, int pedidos) {}

    public record Producto(String nombre, int unidades, long ventas) {}

    /** hora: 0–23 en la hora de Colombia. */
    public record Hora(int hora, int pedidos, long ventas) {}

    /** dia: 1 = lunes … 7 = domingo. */
    public record DiaSemana(int dia, int pedidos, long ventas) {}

    /** Una parte de un total (cómo pagan, cómo reciben, por dónde piden). */
    public record Parte(String clave, String nombre, int pedidos, long total) {}

    public record Estadisticas(LocalDate desde, LocalDate hasta, LocalDate anteriorDesde, LocalDate anteriorHasta,
                               Resumen actual, Resumen anterior, List<Dia> dias, List<Producto> productos,
                               List<Hora> horas, List<DiaSemana> semana, List<Parte> pagos, List<Parte> entrega,
                               List<Parte> origen) {}

    // ---- Cierre de caja
    /** Cómo entró la plata del día: efectivo, cada cuenta de transferencia y pago en línea. */
    public record Medio(String clave, String nombre, int pedidos, long recibido, long pendiente) {}

    /**
     * efectivoACobrar: pedidos en efectivo que lleva (lo que debe traer al local). efectivoCobrado: de esos, los entregados.
     * domicilios: suma de los domicilios que hizo (por si se le paga por domicilio).
     */
    public record DomiciliarioCaja(Long id, String nombre, int pedidos, int entregados, long efectivoACobrar,
                                   long efectivoCobrado, long domicilios) {}

    public record Pendiente(Long id, String codigo, String cliente, long total, String medio, String estadoPago, String estado) {}

    public record Cierre(int baseInicial, int gastos, String notaGastos, int efectivoContado, int efectivoEsperado,
                         int diferencia, String nota, String cerradoPor, Instant cerradoEn) {}

    public record Caja(LocalDate fecha, int pedidos, long ventas, long efectivoRecibido, long transferencias, long enLinea,
                       long porCobrar, List<Medio> medios, List<DomiciliarioCaja> domiciliarios, List<Pendiente> pendientes,
                       Cierre cierre, List<LocalDate> fechas,
                       /** Sede de la caja (null = todas las sedes sumadas) y si se puede cerrar (solo por sede). */
                       Long sedeId, String sede, boolean puedeCerrar) {}

    public record CierreRequest(
            @Min(value = 0, message = "La base no puede ser negativa") int baseInicial,
            @Min(value = 0, message = "Los gastos no pueden ser negativos") int gastos,
            @Size(max = 200) String notaGastos,
            @Min(value = 0, message = "El efectivo contado no puede ser negativo") int efectivoContado,
            @Size(max = 300) String nota) {}

    // ---- Cocina y comandas
    /**
     * modo: APAGADA, MANUAL (botón imprimir) o AUTOMATICA (el equipo de la cocina imprime solo).
     * momento: NUEVO (al llegar) o CONFIRMADO (al confirmarlo). esperaPago: con pago en línea, esperar a que se confirme.
     */
    public record ConfigCocina(
            @NotNull @Pattern(regexp = "APAGADA|MANUAL|AUTOMATICA") String modo,
            @NotNull @Pattern(regexp = "NUEVO|CONFIRMADO") String momento,
            boolean esperaPago,
            @Min(58) @Max(80) int papel,
            @Min(value = 1, message = "Mínimo una copia") @Max(value = 3, message = "Máximo 3 copias") int copias,
            boolean precios,
            @Size(max = 120) String pie) {}

    // ---- Clientes
    /**
     * diasSinPedir: desde su último pedido. ultimoContacto: la última vez que el negocio le escribió para que volviera;
     * volvio: si pidió después de ese mensaje.
     */
    public record Cliente(String celular, String nombre, int pedidos, long total, long ticketPromedio, Instant primero,
                          Instant ultimo, int diasSinPedir, String favorito, Instant ultimoContacto, boolean volvio) {}

    /** dormidos: no piden hace 30 días o más. recuperados: volvieron a pedir después de que se les escribió. */
    public record ResumenClientes(int total, int frecuentes, int nuevosMes, int dormidos, int contactados, int recuperados) {}

    public record Clientes(ResumenClientes resumen, List<Cliente> lista, String mensaje) {}

    public record ContactoRequest(
            @NotBlank @Pattern(regexp = "3\\d{9}", message = "Celular inválido") String celular,
            @Size(max = 80) String nombre,
            @Size(max = 600) String mensaje) {}

    public record MensajeRequest(@Size(max = 600, message = "El mensaje puede tener máximo 600 caracteres") String mensaje) {}

    // ---- Modo «estamos llenos»
    /**
     * accion: DEMORA (sumar minutosExtra al tiempo de entrega), PAUSAR_DOMICILIOS, PAUSAR_PEDIDOS, cada una por
     * «duracion» minutos; QUITAR_DEMORA, REANUDAR_DOMICILIOS, REANUDAR_PEDIDOS o NORMAL (quita todo).
     */
    public record SaturacionRequest(
            @NotNull @Pattern(regexp = "DEMORA|PAUSAR_DOMICILIOS|PAUSAR_PEDIDOS|QUITAR_DEMORA|REANUDAR_DOMICILIOS|REANUDAR_PEDIDOS|NORMAL")
            String accion,
            @Min(0) @Max(value = 120, message = "Máximo 120 minutos extra") int minutosExtra,
            @Min(0) @Max(value = 480, message = "Máximo 8 horas") int duracion) {}
}
