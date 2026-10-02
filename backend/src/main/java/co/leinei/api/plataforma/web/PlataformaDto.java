package co.leinei.api.plataforma.web;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Datos del panel de superadministración. */
public final class PlataformaDto {

    private PlataformaDto() {}

    public record Sesion(String token, String nombre, String usuario, Instant expira) {}

    public record Superadmin(UUID uuid, String usuario, String nombre) {}

    public record NuevoSuperadminRequest(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,40}", message = "El usuario lleva de 3 a 40 letras o números, sin espacios") String usuario,
            @NotBlank(message = "Escribe el nombre") @Size(max = 80) String nombre,
            @NotBlank @Size(min = 10, message = "La clave del superadmin debe tener al menos 10 caracteres") String clave) {}

    public record Modulo(String codigo, String nombre, String descripcion, boolean esBase) {}

    public record Resumen(long total, long activas, long suspendidas, long enPreparacion, long conError) {}

    public record EmpresaResumen(UUID uuid, String identificador, String nombreComercial, String razonSocial,
                                 String estado, String plan, String colorPrimario, String colorSecundario,
                                 String logoUrl, String dominioPropio, List<String> modulos, Instant creadoEn,
                                 String cicloFacturacion, int precioPlan) {}

    public record Conexion(String host, int puerto, String nombreBase, String usuarioOwner, String usuarioApp,
                           String usuarioLectura) {}

    public record Version(String ultimaMigracionAplicada, Instant aplicadaEn) {}

    public record Aprovisionamiento(String estado, int intentos, String pasoActual, String registro, Instant actualizadoEn) {}

    public record EmpresaDetalle(UUID uuid, String identificador, String razonSocial, String nit,
                                 String responsableNombre, String responsableCorreo, String responsableCelular,
                                 String plan, String estado, String notas, Instant creadoEn,
                                 String nombreComercial, String colorPrimario, String colorSecundario, String logoUrl,
                                 String dominioPropio, List<String> modulos, Conexion conexion,
                                 List<Version> versiones, Aprovisionamiento aprovisionamiento,
                                 String cicloFacturacion, int precioPlan) {}

    public record CrearEmpresaRequest(
            // Empresa
            @NotBlank(message = "Escribe el identificador") String identificador,
            @NotBlank(message = "Escribe la razón social") @Size(max = 160) String razonSocial,
            @Size(max = 20) String nit,
            @NotBlank(message = "Escribe el nombre del responsable") @Size(max = 80) String responsableNombre,
            @Size(max = 120) @Email(message = "El correo del responsable no es válido") String responsableCorreo,
            @Size(max = 20) String responsableCelular,
            @Size(max = 30) String plan,
            @NotBlank @Pattern(regexp = "MENSUAL|ANUAL", message = "Elige facturación mensual o anual") String cicloFacturacion,
            @Size(max = 400) String notas,
            // Marca
            @NotBlank(message = "Escribe el nombre comercial") @Size(max = 80) String nombreComercial,
            @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}", message = "Color principal inválido") String colorPrimario,
            @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}", message = "Color secundario inválido") String colorSecundario,
            @Size(max = 120) String dominioPropio,
            // Tienda inicial
            @NotBlank @Pattern(regexp = "INMEDIATO|PROGRAMADO") String modoPedido,
            @Pattern(regexp = "|3\\d{9}", message = "El WhatsApp debe tener 10 dígitos y empezar por 3") String whatsapp,
            @Size(max = 80) String ciudad,
            @Size(max = 160) String direccion,
            boolean tieneDomicilio,
            boolean tieneRecogida,
            @Min(0) int domicilioValor,
            // Módulos
            List<String> modulos,
            // Administrador de la empresa
            @NotBlank(message = "Escribe el nombre del administrador") @Size(max = 80) String adminNombre,
            @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,40}", message = "El usuario del administrador lleva de 3 a 40 letras o números") String adminUsuario,
            @NotBlank @Size(min = 8, message = "La clave del administrador debe tener al menos 8 caracteres") String adminClave) {}

    public record ActualizarEmpresaRequest(
            @NotBlank @Size(max = 160) String razonSocial,
            @Size(max = 20) String nit,
            @NotBlank @Size(max = 80) String responsableNombre,
            @Size(max = 120) @Email String responsableCorreo,
            @Size(max = 20) String responsableCelular,
            @Size(max = 30) String plan,
            @NotBlank @Pattern(regexp = "MENSUAL|ANUAL", message = "Elige facturación mensual o anual") String cicloFacturacion,
            @Size(max = 400) String notas,
            @NotBlank @Size(max = 80) String nombreComercial,
            @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}") String colorPrimario,
            @NotBlank @Pattern(regexp = "#[0-9A-Fa-f]{6}") String colorSecundario,
            @Size(max = 120) String dominioPropio) {}

    public record ModulosRequest(@NotNull List<String> modulos) {}

    public record ClaveAdminRequest(
            @NotBlank String usuario,
            @NotBlank @Size(min = 8, message = "La clave debe tener al menos 8 caracteres") String nueva) {}

    public record Dominio(String identificador) {}

    public record ImportarBibliotecaRequest(
            @jakarta.validation.constraints.NotEmpty(message = "Selecciona al menos un producto")
            @jakarta.validation.constraints.Size(max = 200) java.util.List<String> slugs,
            @jakarta.validation.constraints.Min(-50) @jakarta.validation.constraints.Max(200) int ajustePorcentaje) {}

    public record Plan(String codigo, String nombre, String descripcion, int precioMensual, int precioAnual,
                       List<String> modulos, boolean activo) {}

    public record PlanRequest(
            @NotBlank @Pattern(regexp = "[a-z0-9_-]{2,30}", message = "El código lleva de 2 a 30 letras minúsculas, números o guiones") String codigo,
            @NotBlank(message = "Escribe el nombre del plan") @Size(max = 60) String nombre,
            @Size(max = 200) String descripcion,
            @Min(value = 0, message = "El precio mensual no puede ser negativo") int precioMensual,
            @Min(value = 0, message = "El precio anual no puede ser negativo") int precioAnual,
            @NotNull List<String> modulos,
            boolean activo) {}

    /** Resultado de crear una empresa: la empresa y qué pasó con el correo de bienvenida. */
    public record EmpresaCreada(EmpresaDetalle empresa, String correo) {}

    /** La cuenta de correo con la que se envía. Nunca devuelve la clave: solo si hay una guardada. */
    public record ConfigCorreo(String host, int puerto, String seguridad, String usuario, boolean tieneClave,
                               String remitente, String urlPublica, boolean configurado, String origen) {}

    public record ConfigCorreoRequest(
            @NotNull @Size(max = 200) String host,
            @Min(1) @Max(65535) int puerto,
            @NotBlank @Pattern(regexp = "STARTTLS|SSL|NINGUNA") String seguridad,
            @NotNull @Size(max = 200) String usuario,
            /** Vacía = conservar la que ya está guardada. */
            @Size(max = 200) String clave,
            @NotNull @Size(max = 200) String remitente,
            @NotNull @Size(max = 200) String urlPublica) {}

    public record PruebaCorreoRequest(@NotBlank @Email(message = "El correo no es válido") String destino) {}

    public record ResultadoPrueba(boolean enviado, String mensaje) {}
}
