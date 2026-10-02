package co.leinei.api.pagos;

import co.leinei.api.empresa.EmpresaActual;
import co.leinei.api.empresa.EmpresaContexto;
import co.leinei.api.empresa.Modulos;
import co.leinei.api.empresa.RegistroEmpresas;
import co.leinei.api.plataforma.servicio.SuperadminAuthService.SuperadminActual;
import co.leinei.api.servicio.ReglaNegocioException;
import co.leinei.api.web.dto.PublicoDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** API de pagos en línea: tienda, avisos de las pasarelas, portal de la empresa y superadmin. */
public final class PagosControllers {

    private PagosControllers() {}

    /** Tienda: pagar un pedido en línea, revisar cómo quedó y cambiar a otra forma de pago. */
    @RestController
    @RequestMapping("/api/t/{empresa}/public/pedidos/{codigo}")
    public static class Publico {
        private final PagosEnLineaService pagos;
        private final co.leinei.api.servicio.PedidoService pedidos;

        public Publico(PagosEnLineaService pagos, co.leinei.api.servicio.PedidoService pedidos) {
            this.pagos = pagos;
            this.pedidos = pedidos;
        }

        @PostMapping("/pago-en-linea")
        public PagosDto.Inicio iniciar(@PathVariable String codigo, @RequestParam String celular,
                                       @Valid @RequestBody PagosDto.IniciarRequest req) {
            return pagos.iniciar(codigo, celular, req.retorno());
        }

        @PostMapping("/pago-en-linea/verificar")
        public PublicoDto.Seguimiento verificar(@PathVariable String codigo, @RequestParam String celular,
                                                @RequestParam(required = false) String transaccion) {
            return pagos.verificar(codigo, celular, transaccion);
        }

        @PostMapping("/metodo-pago")
        public PublicoDto.Seguimiento cambiarMetodo(@PathVariable String codigo, @RequestParam String celular,
                                                    @Valid @RequestBody PagosDto.CambiarMetodoRequest req) {
            return pedidos.cambiarMetodoPago(codigo, celular, req.metodoPago(), req.cuentaId());
        }
    }

    /**
     * Avisos (webhooks) de las pasarelas:
     *  - /{proveedor}/eventos/{empresa}: el link de la cuenta propia de cada empresa (solo acepta cobros de esa empresa).
     *  - /{proveedor}/eventos: el link de las cuentas de la plataforma (solo acepta cobros hechos con ellas).
     * La referencia del cobro dice de qué pedido es y con qué llaves se verifica la firma.
     */
    @RestController
    @RequestMapping("/api/plataforma/publico/pagos")
    public static class Avisos {
        private final PagosEnLineaService pagos;

        public Avisos(PagosEnLineaService pagos) { this.pagos = pagos; }

        @PostMapping("/{proveedor}/eventos")
        public ResponseEntity<Map<String, Object>> evento(@PathVariable String proveedor, @RequestBody(required = false) byte[] cuerpo,
                                                          HttpServletRequest req) {
            return procesar(proveedor, null, cuerpo, req);
        }

        @PostMapping("/{proveedor}/eventos/{empresa}")
        public ResponseEntity<Map<String, Object>> eventoDeEmpresa(@PathVariable String proveedor, @PathVariable String empresa,
                                                                   @RequestBody(required = false) byte[] cuerpo, HttpServletRequest req) {
            return procesar(proveedor, empresa.toLowerCase(Locale.ROOT), cuerpo, req);
        }

        private ResponseEntity<Map<String, Object>> procesar(String proveedor, String empresa, byte[] cuerpo, HttpServletRequest req) {
            Map<String, String> encabezados = new HashMap<>();
            for (String nombre : Collections.list(req.getHeaderNames())) {
                encabezados.put(nombre.toLowerCase(Locale.ROOT), req.getHeader(nombre));
            }
            PagosEnLineaService.ResultadoAviso r = pagos.procesarAviso(Proveedor.deRuta(proveedor), empresa,
                    cuerpo == null ? new byte[0] : cuerpo, encabezados);
            if (r == PagosEnLineaService.ResultadoAviso.FIRMA_INVALIDA) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("recibido", false, "detail", "Firma inválida"));
            }
            // A la pasarela se le responde 200 aunque el aviso no sea de la plataforma, para que no lo reintente.
            return ResponseEntity.ok(Map.of("recibido", true, "resultado", r.name()));
        }
    }

    /** Portal de la empresa: ver sus pagos en línea, escribir sus llaves (cuenta propia) y pausar. */
    @RestController
    @RequestMapping("/api/t/{empresa}/admin/pagos-en-linea")
    public static class Portal {
        private final ConfigPagosService config;
        private final PagosEnLineaService pagos;

        public Portal(ConfigPagosService config, PagosEnLineaService pagos) {
            this.config = config;
            this.pagos = pagos;
        }

        @GetMapping
        public PagosDto.Portal ver() {
            EmpresaActual e = empresa();
            return new PagosDto.Portal(config.vista(e), pagos.recientes(e.id()));
        }

        @PutMapping("/llaves")
        public PagosDto.Portal llaves(@Valid @RequestBody PagosDto.Llaves req) {
            EmpresaActual e = empresa();
            return new PagosDto.Portal(config.guardarLlavesDeEmpresa(e, req), pagos.recientes(e.id()));
        }

        @PutMapping("/pausa")
        public PagosDto.Portal pausa(@RequestBody PagosDto.PausaRequest req) {
            EmpresaActual e = empresa();
            return new PagosDto.Portal(config.pausar(e, req.pausado()), pagos.recientes(e.id()));
        }

        private static EmpresaActual empresa() {
            EmpresaContexto.exigirModulo(Modulos.PAGOS_EN_LINEA, "Pagos en línea");
            return EmpresaContexto.requerida();
        }
    }

    /** Superadmin: cuentas de la plataforma, pagos en línea de cada empresa y liquidaciones. */
    @RestController
    @RequestMapping("/api/plataforma/pagos")
    public static class Plataforma {
        private final ConfigPagosService config;
        private final PagosEnLineaService pagos;
        private final RegistroEmpresas registro;
        private final JdbcClient control;

        public Plataforma(ConfigPagosService config, PagosEnLineaService pagos, RegistroEmpresas registro,
                          @Qualifier("controlJdbc") JdbcClient control) {
            this.config = config;
            this.pagos = pagos;
            this.registro = registro;
            this.control = control;
        }

        @GetMapping("/pasarelas")
        public List<PagosDto.PasarelaPlataforma> pasarelas() { return config.plataforma(); }

        @PutMapping("/pasarelas/{proveedor}")
        public PagosDto.PasarelaPlataforma guardarPasarela(@PathVariable String proveedor,
                                                           @Valid @RequestBody PagosDto.PasarelaPlataformaRequest req) {
            return config.guardarPlataforma(Proveedor.deRuta(proveedor), req);
        }

        @GetMapping("/empresas/{uuid}")
        public PagosDto.ConfigEmpresa empresa(@PathVariable UUID uuid) { return config.vista(buscarEmpresa(uuid)); }

        @PutMapping("/empresas/{uuid}")
        public PagosDto.ConfigEmpresa guardarEmpresa(@PathVariable UUID uuid, @Valid @RequestBody PagosDto.ConfigEmpresaRequest req) {
            return config.guardar(buscarEmpresa(uuid), req);
        }

        @GetMapping("/transacciones")
        public PagosDto.Recaudos transacciones(@RequestParam(required = false) UUID empresa,
                                               @RequestParam(required = false) String liquidacion,
                                               @RequestParam(required = false) String estado) {
            Long id = empresa == null ? null : buscarEmpresa(empresa).id();
            if (liquidacion != null && !Set.of("NO_APLICA", "POR_LIQUIDAR", "LIQUIDADO").contains(liquidacion)) liquidacion = null;
            if (estado != null && Arrays.stream(EstadoTransaccion.values()).noneMatch(x -> x.name().equals(estado))) {
                return pagos.recaudos(id, liquidacion, null);
            }
            return pagos.recaudos(id, liquidacion, estado);
        }

        @PostMapping("/transacciones/liquidar")
        public PagosDto.Liquidados liquidar(@AuthenticationPrincipal SuperadminActual s, @Valid @RequestBody PagosDto.LiquidarRequest req) {
            return pagos.liquidar(req.transacciones(), s.usuario(), req.nota());
        }

        private EmpresaActual buscarEmpresa(UUID uuid) {
            Long id = control.sql("SELECT id FROM plataforma.tbl_empresas WHERE uuid = ?").param(uuid)
                    .query(Long.class).optional()
                    .orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa empresa no existe."));
            return registro.porId(id).orElseThrow(() -> ReglaNegocioException.noEncontrado("Esa empresa no existe."));
        }
    }
}
