package co.leinei.api.web.dto;

import co.leinei.api.dominio.EstadoPedido;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

/** Mapas: ubicación del local, domicilio por distancia y domiciliario en vivo. */
public final class MapaDto {

    private MapaDto() {}

    public record Tramo(@DecimalMin(value = "0.1", message = "Cada tramo debe ser de al menos 0,1 km")
                        @DecimalMax(value = "50", message = "Máximo 50 km") double hastaKm,
                        @Min(value = 0, message = "El valor no puede ser negativo") int valor) {}

    /** modo FIJO: valor único o por zonas; DISTANCIA: por tramos de km desde el local. */
    public record ConfigMapa(
            @DecimalMin("-90") @DecimalMax("90") Double localLat,
            @DecimalMin("-180") @DecimalMax("180") Double localLng,
            @NotNull @Pattern(regexp = "FIJO|DISTANCIA") String modo,
            @Size(max = 10, message = "Máximo 10 tramos") List<@Valid Tramo> tramos,
            boolean seguimientoVivo) {}

    /** Lo que la tienda necesita para cobrar el domicilio. modo: FIJO, ZONAS o DISTANCIA. */
    public record EntregaPublica(String modo, Double localLat, Double localLng, List<Tramo> tramos, Double radioKm) {}

    /** Dónde va el domiciliario (solo con el pedido en camino y si la ubicación es reciente). */
    public record Repartidor(double lat, double lng, Instant actualizado) {}

    /** Mapa del seguimiento: el local, el punto de entrega y el domiciliario. */
    public record MapaSeguimiento(Double localLat, Double localLng, Double entregaLat, Double entregaLng, Repartidor repartidor) {}

    // ---- Página del domiciliario (/reparto/{token})
    public record PedidoReparto(String codigo, EstadoPedido estado, String cliente, String celular, String direccion,
                                String barrio, String referencia, String notas, Double lat, Double lng, int total,
                                /** Lo que tiene que cobrar en efectivo (0 si ya está pagado o se pagó por otro medio). */
                                int cobrar, String productos) {}

    public record Reparto(String domiciliario, String tienda, Double localLat, Double localLng, boolean seguimientoVivo,
                          List<PedidoReparto> pedidos) {}

    public record UbicacionRequest(@NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                                   @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
                                   @Min(0) Integer precision) {}

    // ---- Portal: domiciliarios en el mapa
    public record UbicacionDomiciliario(Long id, String nombre, Double lat, Double lng, Instant actualizado,
                                        boolean vigente, int enCamino) {}
}
