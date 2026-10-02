package co.leinei.api.servicio;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.CierreCajaRepositorio;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.web.dto.OperacionDto;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CajaYEstadisticasTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 2);
    private static long siguienteId = 1;

    private static Pedido pedido(int total, MetodoPago metodo, EstadoPago pago, EstadoPedido estado, Domiciliario d) {
        Pedido p = new Pedido();
        ReflectionTestUtils.setField(p, "id", siguienteId++);
        p.setCodigo("P-" + p.getId());
        p.setClienteNombre("Cliente " + p.getId());
        p.setClienteCelular("300000000" + (p.getId() % 10));
        p.setFechaEntrega(HOY);
        p.setTipoEntrega(d == null ? TipoEntrega.RECOGER : TipoEntrega.DOMICILIO);
        p.setTotal(total);
        p.setDomicilio(d == null ? 0 : 3000);
        p.setMetodoPago(metodo);
        if (metodo == MetodoPago.CUENTA) { p.setCuentaEntidad("Nequi"); p.setCuentaTitular("Ana"); }
        if (metodo == MetodoPago.EN_LINEA) { p.setCuentaEntidad("Pago en línea"); p.setCuentaTitular("Wompi"); }
        p.setEstadoPago(pago);
        p.setEstado(estado);
        p.setDomiciliario(d);
        p.setSedeId(1L);
        PedidoItem i = new PedidoItem();
        i.setNombre("Hamburguesa");
        i.setDetalle("");
        i.setCantidad(1);
        i.setPrecioUnitario(total);
        p.agregarItem(i);
        return p;
    }

    /** Empresa sin el módulo de sedes: una sola sede, la principal (id 1). */
    private static SedeService sinSedes() {
        SedeService sedes = mock(SedeService.class);
        Sede principal = new Sede();
        ReflectionTestUtils.setField(principal, "id", 1L);
        when(sedes.activas()).thenReturn(false);
        when(sedes.filtro()).thenReturn(null);
        when(sedes.principal()).thenReturn(principal);
        return sedes;
    }

    private static Domiciliario domiciliario(long id, String nombre) {
        Domiciliario d = new Domiciliario();
        ReflectionTestUtils.setField(d, "id", id);
        d.setNombre(nombre);
        return d;
    }

    @Test
    void elCierreSumaCadaMedioYLoQueDebeEntregarCadaDomiciliario() {
        Domiciliario juan = domiciliario(1, "Juan");
        List<Pedido> dia = List.of(
                pedido(20_000, MetodoPago.EFECTIVO, EstadoPago.PENDIENTE, EstadoPedido.ENTREGADO, juan),   // efectivo cobrado al entregar
                pedido(15_000, MetodoPago.EFECTIVO, EstadoPago.PENDIENTE, EstadoPedido.EN_CAMINO, juan),   // efectivo que todavía lleva
                pedido(30_000, MetodoPago.CUENTA, EstadoPago.RECIBIDO, EstadoPedido.ENTREGADO, null),
                pedido(12_000, MetodoPago.CUENTA, EstadoPago.POR_CONFIRMAR, EstadoPedido.CONFIRMADO, null),
                pedido(25_000, MetodoPago.EN_LINEA, EstadoPago.RECIBIDO, EstadoPedido.PREPARANDO, null),
                pedido(99_000, MetodoPago.EFECTIVO, EstadoPago.PENDIENTE, EstadoPedido.CANCELADO, null)); // no cuenta
        PedidoRepositorio pedidos = mock(PedidoRepositorio.class);
        CierreCajaRepositorio cierres = mock(CierreCajaRepositorio.class);
        when(pedidos.findByPublicadoTrueAndFechaEntregaOrderByCreadoDesc(HOY)).thenReturn(dia);
        when(cierres.findByFechaAndSedeId(HOY, 1L)).thenReturn(Optional.empty());
        when(cierres.save(any())).thenAnswer(a -> a.getArgument(0));

        CajaService caja = new CajaService(pedidos, cierres, sinSedes());
        OperacionDto.Caja c = caja.ver(HOY);

        assertThat(c.pedidos()).isEqualTo(5);
        assertThat(c.ventas()).isEqualTo(102_000);
        assertThat(c.efectivoRecibido()).isEqualTo(20_000);
        assertThat(c.transferencias()).isEqualTo(30_000);
        assertThat(c.enLinea()).isEqualTo(25_000);
        assertThat(c.porCobrar()).isEqualTo(27_000);
        assertThat(c.pendientes()).hasSize(2);
        assertThat(c.medios()).extracting(OperacionDto.Medio::nombre).containsExactly("Efectivo", "Nequi · Ana", "En línea · Wompi");
        OperacionDto.DomiciliarioCaja j = c.domiciliarios().getFirst();
        assertThat(j.efectivoACobrar()).isEqualTo(35_000);
        assertThat(j.efectivoCobrado()).isEqualTo(20_000);
        assertThat(j.entregados()).isEqualTo(1);
        assertThat(j.domicilios()).isEqualTo(6_000);

        // Base 50.000 + 20.000 recibido − 8.000 de gastos = 62.000 esperados; se contaron 60.000 → faltan 2.000.
        OperacionDto.Caja cerrada = caja.cerrar(HOY, new OperacionDto.CierreRequest(50_000, 8_000, "hielo", 60_000, ""), "Ana");
        assertThat(cerrada.cierre().efectivoEsperado()).isEqualTo(62_000);
        assertThat(cerrada.cierre().diferencia()).isEqualTo(-2_000);
        assertThat(cerrada.cierre().cerradoPor()).isEqualTo("Ana");
    }

    @Test
    void lasEstadisticasLlenanLosDiasSinPedidosYComparanConElPeriodoAnterior() {
        PedidoRepositorio pedidos = mock(PedidoRepositorio.class);
        Pedido hoy1 = pedido(10_000, MetodoPago.EFECTIVO, EstadoPago.RECIBIDO, EstadoPedido.ENTREGADO, null);
        Pedido hoy2 = pedido(30_000, MetodoPago.EN_LINEA, EstadoPago.RECIBIDO, EstadoPedido.ENTREGADO, null);
        Pedido antes = pedido(20_000, MetodoPago.CUENTA, EstadoPago.RECIBIDO, EstadoPedido.ENTREGADO, null);
        antes.setFechaEntrega(HOY.minusDays(3));
        when(pedidos.findByPublicadoTrueAndFechaEntregaBetween(HOY.minusDays(5), HOY)).thenReturn(List.of(hoy1, hoy2, antes));
        when(pedidos.primerPedido(any())).thenReturn(List.of());
        ConfigService config = mock(ConfigService.class);
        when(config.tienda()).thenReturn(new ConfigTienda());
        LeineiProperties props = new LeineiProperties("America/Bogota", "", 12, null, null);

        OperacionDto.Estadisticas e = new EstadisticasService(pedidos, config, props, sinSedes()).calcular(HOY.minusDays(2), HOY);

        assertThat(e.dias()).hasSize(3);
        assertThat(e.dias()).extracting(OperacionDto.Dia::ventas).containsExactly(0L, 0L, 40_000L);
        assertThat(e.actual().ventas()).isEqualTo(40_000);
        assertThat(e.actual().ticketPromedio()).isEqualTo(20_000);
        assertThat(e.anterior().ventas()).isEqualTo(20_000);
        assertThat(e.anteriorDesde()).isEqualTo(HOY.minusDays(5));
        assertThat(e.pagos()).extracting(OperacionDto.Parte::nombre).containsExactly("Efectivo", "En línea");
        assertThat(e.productos().getFirst().unidades()).isEqualTo(2);
    }

    @Test
    void elModoLlenoVenceSolo() {
        ConfigTienda c = new ConfigTienda();
        c.setDomicilioActivo(true);
        Instant ahora = Instant.parse("2026-10-02T20:00:00Z");
        c.setMinutosExtra(30);
        c.setDemoraHasta(ahora.plus(Duration.ofMinutes(45)));
        c.setDomiciliosPausadosHasta(ahora.minus(Duration.ofMinutes(1)));
        assertThat(c.minutosExtraVigentes(ahora)).isEqualTo(30);
        assertThat(c.minutosExtraVigentes(ahora.plus(Duration.ofHours(1)))).isZero();
        assertThat(c.domicilioDisponible(ahora)).isTrue();
        c.setDomiciliosPausadosHasta(ahora.plus(Duration.ofMinutes(30)));
        assertThat(c.domicilioDisponible(ahora)).isFalse();
    }
}
