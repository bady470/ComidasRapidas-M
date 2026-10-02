package co.leinei.api.servicio;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class DistanciaTest {

    @Test
    void kmEnLineaRecta() {
        // Plaza de Bolívar de Bogotá → Parque de la 93: ~9 km en línea recta.
        double km = Distancia.km(4.598056, -74.075833, 4.676389, -74.048333);
        assertThat(km).isCloseTo(9.2, within(0.3));
        assertThat(Distancia.km(11.5444, -72.9072, 11.5444, -72.9072)).isZero();
    }

    @Test
    void tramosSeOrdenanYSeCobraElPrimeroQueAlcanza() {
        List<Distancia.Tramo> t = Distancia.tramos("4:5000; 2:3000;7.5:8000;mal");
        assertThat(t).extracting(Distancia.Tramo::hastaKm).containsExactly(2.0, 4.0, 7.5);
        assertThat(Distancia.valor(t, 0.4)).isEqualTo(3000);
        assertThat(Distancia.valor(t, 2.0)).isEqualTo(3000);
        assertThat(Distancia.valor(t, 2.01)).isEqualTo(5000);
        assertThat(Distancia.valor(t, 7.5)).isEqualTo(8000);
        assertThat(Distancia.valor(t, 7.6)).isNull();
        assertThat(Distancia.texto(t)).isEqualTo("2:3000;4:5000;7.5:8000");
    }
}
