package co.leinei.api.web.dto;

import co.leinei.api.dominio.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Datos del panel de administración. */
public final class AdminDto {

    private AdminDto() {}

    // ---- Sesión y administradores ----
    public record LoginRequest(@NotBlank(message = "Escribe tu usuario") String usuario,
                               @NotBlank(message = "Escribe tu clave") String clave) {}

    public record Sesion(String token, String nombre, String usuario, Instant expira) {}

    public record Yo(Long id, String usuario, String nombre) {}

    public record CambiarClaveRequest(@NotBlank String actual,
                                      @NotBlank @Size(min = 8, message = "La clave nueva debe tener al menos 8 caracteres") String nueva) {}

    public record NuevoAdminRequest(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,40}", message = "El usuario lleva de 3 a 40 letras o números, sin espacios") String usuario,
            @NotBlank(message = "Escribe el nombre") @Size(max = 80) String nombre,
            @NotBlank @Size(min = 8, message = "La clave debe tener al menos 8 caracteres") String clave) {}

    // ---- Pedidos ----
    public record Item(Long productoId, String nombre, String detalle, int cantidad, int precioUnitario, int costoUnitario) {}

    public record Evento(EstadoPedido estado, String nota, String autor, Instant fecha) {}

    public record Pedido(Long id, String codigo, Instant creado, LocalDate fechaEntrega, String franja,
                         TipoEntrega tipoEntrega, String zona, List<EstadoPedido> flujo,
                         String clienteNombre, String clienteCelular, String barrio, String direccion,
                         String referencia, String notas, List<Item> items, int subtotal, int descuento,
                         String promocion, int domicilio, int total, int costoTotal, MetodoPago metodoPago,
                         String cuentaEntidad, String cuentaTitular, String cuentaNumero, EstadoPago estadoPago,
                         EstadoPedido estado, OrigenPedido origen, List<Evento> eventos,
                         boolean tieneComprobante, Instant pagoReportado,
                         Long domiciliarioId, String domiciliarioNombre, String domiciliarioCelular,
                         Double entregaLat, Double entregaLng, Double distanciaKm) {}

    public record AsignarDomiciliarioRequest(Long domiciliarioId) {}

    /** token: el de su link de reparto (/reparto/{token}). */
    public record Domiciliario(Long id, String nombre, String celular, boolean activo, String token) {}

    public record DomiciliarioRequest(
            @NotBlank(message = "Escribe el nombre del domiciliario") @Size(max = 80) String nombre,
            @Pattern(regexp = "|3\\d{9}", message = "El celular debe tener 10 dígitos y empezar por 3") String celular,
            boolean activo) {}

    public record Notificacion(Long id, String tipo, Long pedidoId, String codigo, String titulo, String mensaje,
                               boolean leida, Instant creado) {}

    /** Lo que el portal revisa cada pocos segundos: avisos y cuántos pedidos faltan por pagar. */
    public record Avisos(long noLeidas, long porPagar, long porConfirmar, List<Notificacion> lista) {}

    public record MarcarLeidasRequest(@NotNull Long hastaId) {}

    public record CambiarEstadoRequest(@NotNull EstadoPedido estado, @Size(max = 200) String nota) {}

    public record CambiarPagoRequest(@NotNull EstadoPago estadoPago) {}

    /** Pedido que llega por WhatsApp o por teléfono y el administrador registra a mano. */
    public record PedidoManualRequest(
            @NotEmpty(message = "Agrega al menos un producto") List<PublicoDto.@Valid ItemPedido> items,
            @NotNull TipoEntrega tipoEntrega,
            Long zonaId,
            @NotBlank(message = "Escribe el nombre") @Size(max = 80) String nombre,
            @Pattern(regexp = "|3\\d{9}", message = "El celular debe tener 10 dígitos y empezar por 3") String celular,
            @Size(max = 80) String barrio,
            @Size(max = 160) String direccion,
            @Size(max = 60) String franja,
            @NotNull MetodoPago metodoPago,
            Long cuentaId,
            LocalDate fechaEntrega,
            @Size(max = 300) String notas) {}

    // ---- Catálogo ----
    public record Categoria(Long id, String nombre, boolean activa, int orden, long productos) {}

    public record CategoriaRequest(@NotBlank(message = "Escribe el nombre de la categoría") @Size(max = 60) String nombre,
                                   boolean activa, int orden) {}

    public record Opcion(Long id, @NotBlank(message = "Cada opción necesita un nombre") @Size(max = 60) String nombre,
                         @Min(0) int precioExtra, boolean disponible) {}

    public record Grupo(Long id, @NotBlank(message = "Cada grupo de opciones necesita un nombre") @Size(max = 60) String nombre,
                        @Min(0) int minimo, @Min(1) int maximo,
                        @NotEmpty(message = "Cada grupo necesita al menos una opción") List<@Valid Opcion> opciones) {}

    public record Producto(Long id, String slug, Long categoriaId, String nombre, String descripcion, int precio,
                           int costo, Long imagenId, String etiqueta, boolean disponible, int orden, List<Grupo> grupos) {}

    public record ProductoRequest(
            Long categoriaId,
            @NotBlank(message = "Escribe el nombre") @Size(max = 80) String nombre,
            @Size(max = 400) String descripcion,
            @Min(value = 50, message = "El precio debe ser mayor a $50") int precio,
            @Min(0) int costo,
            Long imagenId,
            @Size(max = 40) String etiqueta,
            boolean disponible,
            int orden,
            @Size(max = 10, message = "Máximo 10 grupos de opciones") List<@Valid Grupo> grupos) {}

    public record DisponibleRequest(boolean disponible) {}

    public record Promocion(Long id, String nombre, String descripcion, TipoPromocion tipo, Integer cantidad,
                            Integer precio, Integer porcentaje, int minimo, Long productoId, List<Long> productoIds,
                            boolean activa, boolean destacada, LocalDate desde, LocalDate hasta, boolean vigente) {}

    public record PromocionRequest(
            @NotBlank(message = "Escribe el nombre") @Size(max = 80) String nombre,
            @Size(max = 300) String descripcion,
            @NotNull TipoPromocion tipo,
            Integer cantidad, Integer precio, Integer porcentaje,
            @Min(0) int minimo,
            Long productoId,
            List<Long> productoIds,
            boolean activa, boolean destacada,
            LocalDate desde, LocalDate hasta) {}

    public record ActivaRequest(boolean activa) {}

    public record ArchivoSubido(Long id, String tipoContenido, int tamano) {}

    // ---- Configuración ----
    public record Cuenta(Long id,
                         @NotBlank(message = "Escribe la entidad (Nequi, Daviplata, banco…)") @Size(max = 40) String entidad,
                         @NotBlank(message = "Escribe el titular de la cuenta") @Size(max = 80) String titular,
                         @NotBlank(message = "Escribe el número de la cuenta") @Size(max = 40) String numero,
                         boolean activa) {}

    public record Zona(Long id, @NotBlank(message = "Cada zona necesita un nombre") @Size(max = 80) String nombre,
                       @Min(0) int valor, boolean activa) {}

    public record Horario(@Min(1) @Max(7) int dia, boolean activo,
                          @NotBlank @Pattern(regexp = "\\d{2}:\\d{2}", message = "Hora inválida") String abre,
                          @NotBlank @Pattern(regexp = "\\d{2}:\\d{2}", message = "Hora inválida") String cierra) {}

    public record Config(
            // Marca
            @NotBlank(message = "La tienda necesita un nombre") @Size(max = 80) String nombre,
            @Size(max = 160) String eslogan,
            @Size(max = 120) String tituloPortada,
            @Size(max = 400) String mensaje,
            /** Solo lectura: el logo se cambia con POST /marca/logo. */
            String logoUrl,
            @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}", message = "Color principal inválido") String colorPrimario,
            @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}", message = "Color secundario inválido") String colorSecundario,
            // Contacto
            @Pattern(regexp = "|3\\d{9}", message = "El WhatsApp debe tener 10 dígitos y empezar por 3") String whatsapp,
            @Size(max = 160) String direccion,
            @Size(max = 80) String ciudad,
            @Size(max = 60) String instagram,
            // Pedidos
            boolean abierto,
            @NotNull ModoPedido modoPedido,
            @Min(0) @Max(600) int tiempoMin,
            @Min(0) @Max(600) int tiempoMax,
            @Min(1) @Max(7) int diaEntrega,
            @Min(0) @Max(6) int cierreDiasAntes,
            @Min(0) @Max(23) int cierreHora,
            List<@NotBlank String> franjas,
            @Min(0) int pedidoMinimo,
            @Size(min = 7, max = 7, message = "El horario necesita los 7 días") List<@Valid Horario> horarios,
            // Entrega
            boolean domicilioActivo,
            @Min(0) int domicilioValor,
            List<@Valid Zona> zonas,
            boolean recogerActivo,
            // Pagos y reportes
            boolean efectivo,
            List<@Valid Cuenta> cuentas,
            @Min(0) int costoOperativoUnidad) {}

    // ---- Reportes ----
    public record LineaProduccion(String nombre, int unidades, int ventas, int costo, int ganancia) {}

    public record LineaDetalle(String nombre, String detalle, int unidades) {}

    public record PagoPorCuenta(String cuenta, int pedidos, int total, int recibido) {}

    public record Produccion(LocalDate fecha, int pedidos, int unidades, int ventasProductos, int domicilios,
                             int costoProductos, int costoOperativo, int ganancia, int cobrado, int porCobrar,
                             int domicilio, int recoger, List<LineaProduccion> productos, List<LineaDetalle> detalle,
                             List<PagoPorCuenta> pagos) {}
}
