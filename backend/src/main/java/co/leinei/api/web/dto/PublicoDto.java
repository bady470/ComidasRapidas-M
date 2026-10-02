package co.leinei.api.web.dto;

import co.leinei.api.dominio.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Lo que ve y envía el cliente. Nunca incluye costos ni datos de otros clientes. */
public final class PublicoDto {

    private PublicoDto() {}

    public record Cuenta(Long id, String entidad, String titular, String numero) {}

    public record Zona(Long id, String nombre, int valor) {}

    /** dia: 1 = lunes … 7 = domingo; horas en formato HH:mm. */
    public record HorarioDia(int dia, boolean activo, String abre, String cierra) {}

    public record Tienda(
            // Marca (sale de la base de control)
            String identificador, String nombre, String eslogan, String tituloPortada, String mensaje, String logoUrl,
            String colorPrimario, String colorSecundario,
            // Contacto
            String whatsapp, String direccion, String ciudad, String instagram,
            // Disponibilidad
            boolean abierto, ModoPedido modoPedido, boolean recibePedidos, boolean enHorario,
            LocalDate fechaServicio, Instant cierre, Instant proximaApertura,
            int tiempoMin, int tiempoMax, List<String> franjas, int pedidoMinimo, List<HorarioDia> horarios,
            // Entrega y pagos
            boolean domicilioActivo, int domicilioValor, List<Zona> zonas, boolean recogerActivo,
            boolean efectivo, List<Cuenta> cuentas,
            // Módulos activos del plan de la empresa
            List<String> modulos,
            // Pago en línea con pasarela (null si la tienda no lo ofrece ahora).
            co.leinei.api.pagos.PagosDto.PagoPublico pagoEnLinea,
            // Modo «estamos llenos» vigente (los tiempos y el domicilio de arriba ya lo tienen en cuenta).
            Saturacion saturacion,
            // Cómo se cobra el domicilio (valor fijo, por zona o por distancia en el mapa).
            MapaDto.EntregaPublica entrega) {}

    /**
     * minutosExtra: cuánto se sumó al tiempo de entrega (0 = normal), hasta demoraHasta.
     * domiciliosPausadosHasta / pedidosPausadosHasta: hasta cuándo (null = no hay pausa).
     */
    public record Saturacion(int minutosExtra, Instant demoraHasta, Instant domiciliosPausadosHasta, Instant pedidosPausadosHasta) {}

    public record Categoria(Long id, String nombre) {}

    public record Opcion(Long id, String nombre, int precioExtra, boolean disponible) {}

    public record Grupo(Long id, String nombre, int minimo, int maximo, List<Opcion> opciones) {}

    public record Producto(Long id, Long categoriaId, String nombre, String descripcion, int precio, int precioHoy,
                           Long imagenId, String etiqueta, boolean disponible, List<Grupo> grupos) {}

    public record Promocion(Long id, String nombre, String descripcion, TipoPromocion tipo, Integer cantidad,
                            Integer precio, Integer porcentaje, int minimo, Long productoId,
                            List<Long> productoIds) {}

    public record Catalogo(Tienda tienda, List<Categoria> categorias, List<Producto> productos,
                           List<Promocion> promociones) {}

    public record ItemPedido(
            @NotNull Long productoId,
            @Min(value = 1, message = "La cantidad mínima es 1") @Max(value = 99, message = "Máximo 99 unidades por producto") int cantidad,
            List<Long> opcionIds) {

        public List<Long> opciones() {
            return opcionIds == null ? List.of() : opcionIds;
        }
    }

    /** lat/lng: punto de entrega en el mapa (domicilio por distancia). */
    public record CotizarRequest(@NotEmpty(message = "Agrega al menos un producto") List<@Valid ItemPedido> items,
                                 TipoEntrega tipoEntrega, Long zonaId, Double lat, Double lng) {}

    public record CrearPedidoRequest(
            @NotEmpty(message = "Agrega al menos un producto") List<@Valid ItemPedido> items,
            @NotNull(message = "Escoge si es a domicilio o para recoger") TipoEntrega tipoEntrega,
            Long zonaId,
            @NotBlank(message = "Escribe tu nombre") @Size(max = 80) String nombre,
            @NotBlank @Pattern(regexp = "3\\d{9}", message = "El celular debe tener 10 dígitos y empezar por 3") String celular,
            @Size(max = 80) String barrio,
            @Size(max = 160) String direccion,
            @Size(max = 160) String referencia,
            @Size(max = 60) String franja,
            @NotNull(message = "Escoge cómo vas a pagar") MetodoPago metodoPago,
            Long cuentaId,
            @Size(max = 300) String notas,
            @DecimalMin("-90") @DecimalMax("90") Double lat,
            @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    public record PedidoCreado(String codigo, LocalDate fechaEntrega, String franja, TipoEntrega tipoEntrega,
                               ModoPedido modoPedido, int tiempoMin, int tiempoMax, int total, MetodoPago metodoPago,
                               String cuentaEntidad, String cuentaTitular, String cuentaNumero,
                               String whatsappTienda, String direccionTienda) {}

    public record Evento(EstadoPedido estado, String mensaje, String nota, Instant fecha) {}

    public record ItemSeguimiento(String nombre, String detalle, int cantidad, int precioUnitario) {}

    public record Seguimiento(String codigo, EstadoPedido estado, String estadoMensaje, EstadoPago estadoPago,
                              TipoEntrega tipoEntrega, List<EstadoPedido> flujo, LocalDate fechaEntrega,
                              String franja, String nombre, String barrio, String zona,
                              List<ItemSeguimiento> items, int subtotal, int descuento, String promocion,
                              int domicilio, int total, MetodoPago metodoPago, String cuentaEntidad,
                              String cuentaTitular, String cuentaNumero, List<Evento> eventos, Instant creado,
                              String direccionTienda,
                              // Pago por transferencia: si ya adjuntó comprobante y cuándo.
                              boolean tieneComprobante, Instant pagoReportado,
                              // Quién lleva el pedido (solo nombre y celular del domiciliario).
                              String domiciliarioNombre, String domiciliarioCelular,
                              // Último intento de pago en línea (null si nunca intentó pagar en línea).
                              co.leinei.api.pagos.PagosDto.EstadoPublico pagoEnLinea,
                              // Mapa del pedido (null si la empresa no tiene mapas).
                              MapaDto.MapaSeguimiento mapa) {}
}
