package co.leinei.api.servicio;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.dominio.*;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DisponibilidadServiceTest {

    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    private static final LeineiProperties PROPS = new LeineiProperties("America/Bogota", "", null, 12);

    private DisponibilidadService en(LocalDateTime hora) {
        return new DisponibilidadService(Clock.fixed(hora.atZone(BOGOTA).toInstant(), BOGOTA), PROPS);
    }

    private static ConfigTienda programado() {
        ConfigTienda c = new ConfigTienda();
        c.setModoPedido(ModoPedido.PROGRAMADO);
        c.setDiaEntrega(7);       // domingo
        c.setCierreDiasAntes(1);  // sábado
        c.setCierreHora(21);
        c.setAbierto(true);
        return c;
    }

    private static ConfigTienda inmediato() {
        ConfigTienda c = new ConfigTienda();
        c.setModoPedido(ModoPedido.INMEDIATO);
        c.setAbierto(true);
        return c;
    }

    /** Lunes a sábado de 10:00 a 22:00; viernes de 18:00 a 02:00; domingo cerrado. */
    private static List<Horario> horario() {
        List<Horario> hs = new ArrayList<>();
        for (int d = 1; d <= 6; d++) hs.add(new Horario(d, true, LocalTime.of(10, 0), LocalTime.of(22, 0)));
        hs.set(4, new Horario(5, true, LocalTime.of(18, 0), LocalTime.of(2, 0)));
        hs.add(new Horario(7, false, LocalTime.of(10, 0), LocalTime.of(22, 0)));
        return hs;
    }

    @Test
    void programadoEntreSemanaEntregaElDomingo() {
        var d = en(LocalDateTime.of(2026, 9, 23, 10, 0)).calcular(programado(), List.of());
        assertThat(d.fechaServicio()).isEqualTo(LocalDate.of(2026, 9, 27));
        assertThat(d.recibePedidos()).isTrue();
    }

    @Test
    void programadoDespuesDelCierrePasaAlOtroDomingo() {
        var d = en(LocalDateTime.of(2026, 9, 26, 21, 1)).calcular(programado(), List.of());
        assertThat(d.fechaServicio()).isEqualTo(LocalDate.of(2026, 10, 4));
    }

    @Test
    void programadoElMismoDiaSinDiasDeCierre() {
        ConfigTienda c = programado();
        c.setCierreDiasAntes(0);
        c.setCierreHora(10);
        var d = en(LocalDateTime.of(2026, 9, 27, 9, 0)).calcular(c, List.of());
        assertThat(d.fechaServicio()).isEqualTo(LocalDate.of(2026, 9, 27));
    }

    @Test
    void inmediatoAbiertoDentroDelHorario() {
        var d = en(LocalDateTime.of(2026, 9, 28, 12, 0)).calcular(inmediato(), horario()); // lunes
        assertThat(d.recibePedidos()).isTrue();
        assertThat(d.cierre()).isEqualTo(LocalDateTime.of(2026, 9, 28, 22, 0).atZone(BOGOTA).toInstant());
    }

    @Test
    void inmediatoCerradoMuestraProximaApertura() {
        var d = en(LocalDateTime.of(2026, 9, 28, 23, 0)).calcular(inmediato(), horario()); // lunes de noche
        assertThat(d.recibePedidos()).isFalse();
        assertThat(d.proximaApertura()).isEqualTo(LocalDateTime.of(2026, 9, 29, 10, 0).atZone(BOGOTA).toInstant());
    }

    @Test
    void inmediatoTurnoQuePasaLaMedianoche() {
        // Sábado 1:00 a. m. sigue el turno del viernes (18:00 a 02:00)
        var d = en(LocalDateTime.of(2026, 10, 3, 1, 0)).calcular(inmediato(), horario());
        assertThat(d.recibePedidos()).isTrue();
        assertThat(d.fechaServicio()).isEqualTo(LocalDate.of(2026, 10, 2));
    }

    @Test
    void domingoCerradoAbreElLunes() {
        var d = en(LocalDateTime.of(2026, 10, 4, 12, 0)).calcular(inmediato(), horario());
        assertThat(d.recibePedidos()).isFalse();
        assertThat(d.proximaApertura()).isEqualTo(LocalDateTime.of(2026, 10, 5, 10, 0).atZone(BOGOTA).toInstant());
    }

    @Test
    void tiendaCerradaDesdeElPanelNoRecibe() {
        ConfigTienda c = inmediato();
        c.setAbierto(false);
        var d = en(LocalDateTime.of(2026, 9, 28, 12, 0)).calcular(c, horario());
        assertThat(d.recibePedidos()).isFalse();
    }

    @Test
    void reglasDeCambioDeEstado() {
        assertThat(EstadoPedido.PREPARANDO.puedePasarA(EstadoPedido.EN_CAMINO, TipoEntrega.DOMICILIO)).isTrue();
        assertThat(EstadoPedido.PREPARANDO.puedePasarA(EstadoPedido.LISTO, TipoEntrega.DOMICILIO)).isFalse();
        assertThat(EstadoPedido.PREPARANDO.puedePasarA(EstadoPedido.LISTO, TipoEntrega.RECOGER)).isTrue();
        assertThat(EstadoPedido.ENTREGADO.puedePasarA(EstadoPedido.CANCELADO, TipoEntrega.RECOGER)).isFalse();
        assertThat(EstadoPedido.CANCELADO.puedePasarA(EstadoPedido.NUEVO, TipoEntrega.DOMICILIO)).isTrue();
    }
}
