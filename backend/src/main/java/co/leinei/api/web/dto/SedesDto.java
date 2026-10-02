package co.leinei.api.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.util.List;

/** Varias sedes: administración, lo que cambia de cada producto por sede y lo que ve la tienda. */
public final class SedesDto {

    private SedesDto() {}

    public record Sede(Long id, String nombre, String direccion, String ciudad, String whatsapp, Double localLat, Double localLng,
                       List<MapaDto.Tramo> tramos, boolean abierta, int tiempoMin, int tiempoMax, boolean activa,
                       boolean principal, List<AdminDto.Horario> horarios) {}

    public record SedeRequest(
            @NotBlank(message = "Escribe el nombre de la sede") @Size(max = 60) String nombre,
            @Size(max = 160) String direccion,
            @Size(max = 80) String ciudad,
            @Pattern(regexp = "|3\\d{9}", message = "El WhatsApp debe tener 10 dígitos y empezar por 3") String whatsapp,
            @DecimalMin("-90") @DecimalMax("90") Double localLat,
            @DecimalMin("-180") @DecimalMax("180") Double localLng,
            @Size(max = 10, message = "Máximo 10 tramos") List<MapaDto.@Valid Tramo> tramos,
            boolean abierta,
            @Min(0) @Max(600) int tiempoMin,
            @Min(0) @Max(600) int tiempoMax,
            boolean activa,
            @Size(min = 7, max = 7, message = "El horario necesita los 7 días") List<AdminDto.@Valid Horario> horarios) {}

    /** menu: COMPARTIDO (el mismo en todas) o POR_SEDE (cada sede con sus productos y precios). */
    public record Panel(String menu, List<Sede> sedes) {}

    public record MenuRequest(@NotNull @Pattern(regexp = "COMPARTIDO|POR_SEDE") String menu) {}

    /** Un producto en una sede. precio null = el del producto. ofrecido y precio solo cuentan con el menú por sede. */
    public record ProductoEnSede(Long sedeId, String sede, boolean disponible, boolean ofrecido,
                                @Positive(message = "El precio debe ser mayor a 0") Integer precio) {}

    public record ProductoEnSedesRequest(@NotNull List<@Valid ProductoEnSede> sedes) {}

    /** Lo que ve la tienda de cada sede para escogerla. */
    public record SedePublica(Long id, String nombre, String direccion, String ciudad, Double lat, Double lng, boolean abierta) {}
}
