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
                                 String logoUrl, String dominioPropio, List<String> modulos, Instant creadoEn) {}

    public record Conexion(String host, int puerto, String nombreBase, String usuarioOwner, String usuarioApp,
                           String usuarioLectura) {}

    public record Version(String ultimaMigracionAplicada, Instant aplicadaEn) {}

    public record Aprovisionamiento(String estado, int intentos, String pasoActual, String registro, Instant actualizadoEn) {}

    public record EmpresaDetalle(UUID uuid, String identificador, String razonSocial, String nit,
                                 String responsableNombre, String responsableCorreo, String responsableCelular,
                                 String plan, String estado, String notas, Instant creadoEn,
                                 String nombreComercial, String colorPrimario, String colorSecundario, String logoUrl,
                                 String dominioPropio, List<String> modulos, Conexion conexion,
                                 List<Version> versiones, Aprovisionamiento aprovisionamiento) {}

    public record CrearEmpresaRequest(
            // Empresa
            @NotBlank(message = "Escribe el identificador") String identificador,
            @NotBlank(message = "Escribe la razón social") @Size(max = 160) String razonSocial,
            @Size(max = 20) String nit,
            @NotBlank(message = "Escribe el nombre del responsable") @Size(max = 80) String responsableNombre,
            @Size(max = 120) @Email(message = "El correo del responsable no es válido") String responsableCorreo,
            @Size(max = 20) String responsableCelular,
            @Size(max = 30) String plan,
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
}
