package co.leinei.api.pagos;

import co.leinei.api.dominio.MetodoPago;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Datos de los pagos en línea: tienda, portal de la empresa y superadmin. Las llaves secretas nunca salen. */
public final class PagosDto {

    private PagosDto() {}

    // ---- Tienda
    /** Lo que la tienda muestra si el pago en línea está disponible. */
    public record PagoPublico(String proveedor, String nombre, String medios) {}

    /** Último intento de pago en línea de un pedido (para el seguimiento del cliente). */
    public record EstadoPublico(String proveedor, String nombre, EstadoTransaccion estado, String medio, String detalle,
                                int intentos, Instant actualizado) {}

    public record IniciarRequest(@NotBlank @Size(max = 300) String retorno) {}

    public record Inicio(String url) {}

    public record CambiarMetodoRequest(@NotNull(message = "Escoge cómo vas a pagar") MetodoPago metodoPago, Long cuentaId) {}

    // ---- Llaves (formularios). Un secreto vacío o null deja el que estaba guardado.
    public record Llaves(
            @NotNull Proveedor proveedor,
            @NotNull @Pattern(regexp = "PRUEBAS|PRODUCCION") String ambiente,
            @Size(max = 200) String llavePublica,
            @Size(max = 300) String llavePrivada,
            @Size(max = 300) String secretoIntegridad,
            @Size(max = 300) String secretoEventos) {}

    /** Llaves guardadas, sin los secretos: solo si están o no. */
    public record LlavesGuardadas(Proveedor proveedor, String nombreProveedor, String ambiente, String llavePublica,
                                  boolean tieneLlavePrivada, boolean tieneSecretoIntegridad, boolean tieneSecretoEventos) {}

    // ---- Superadmin: cuentas de la plataforma
    public record PasarelaPlataforma(LlavesGuardadas llaves, boolean activa, boolean completa, String faltante,
                                     String urlEventos, long empresasUsandola) {}

    public record PasarelaPlataformaRequest(@NotNull @Valid Llaves llaves, boolean activa) {}

    // ---- Superadmin: pagos de una empresa
    public record ConfigEmpresa(
            String modalidad, Proveedor proveedor, boolean moduloActivo, boolean editablePorEmpresa, boolean pausado,
            BigDecimal comisionPorcentaje, int comisionFija,
            /** Llaves propias de la empresa (modalidad PROPIA). */
            LlavesGuardadas llaves,
            boolean listo, String motivo, String urlEventos, Totales totales) {}

    public record ConfigEmpresaRequest(
            @NotNull @Pattern(regexp = "APAGADO|PROPIA|PLATAFORMA") String modalidad,
            @NotNull Proveedor proveedor,
            boolean editablePorEmpresa,
            boolean pausado,
            @NotNull @DecimalMin(value = "0", message = "La comisión no puede ser negativa")
            @DecimalMax(value = "50", message = "La comisión no puede pasar del 50 %") BigDecimal comisionPorcentaje,
            @Min(value = 0, message = "La comisión fija no puede ser negativa") int comisionFija,
            @Valid Llaves llaves) {}

    // ---- Portal de la empresa
    public record Portal(ConfigEmpresa config, List<TransaccionVista> recientes) {}

    public record PausaRequest(boolean pausado) {}

    // ---- Transacciones y liquidación
    public record TransaccionVista(UUID uuid, String empresa, String empresaNombre, String referencia, String codigoPedido,
                                   Proveedor proveedor, String modalidad, String ambiente, int monto, EstadoTransaccion estado,
                                   String medio, String detalle, int comision, int neto, String liquidacion,
                                   Instant creado, Instant aprobado, Instant liquidado, String liquidadoPor,
                                   String notaLiquidacion) {}

    public record Totales(long aprobados, long montoAprobado, long comisiones, long porLiquidar, long liquidado) {}

    public record Recaudos(List<TransaccionVista> lista, Totales totales) {}

    public record LiquidarRequest(@NotEmpty(message = "Escoge al menos un pago") List<UUID> transacciones,
                                  @Size(max = 200) String nota) {}

    public record Liquidados(int liquidados) {}
}
