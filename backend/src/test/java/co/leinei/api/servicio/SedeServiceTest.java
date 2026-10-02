package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.*;
import co.leinei.api.tiemporeal.TiempoReal;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SedeServiceTest {

    private static Producto producto(long id, int precio) {
        Producto p = new Producto();
        ReflectionTestUtils.setField(p, "id", id);
        ReflectionTestUtils.setField(p, "precio", precio);
        p.setDisponible(true);
        return p;
    }

    private static Sede sede(long id) {
        Sede s = new Sede();
        ReflectionTestUtils.setField(s, "id", id);
        return s;
    }

    private static ProductoSede enSede(long producto, long sede, boolean disponible, boolean ofrecido, Integer precio) {
        ProductoSede ps = new ProductoSede(producto, sede);
        ps.setDisponible(disponible);
        ps.setOfrecido(ofrecido);
        ps.setPrecio(precio);
        return ps;
    }

    private static SedeService servicio(String menu, List<ProductoSede> filas) {
        ProductoSedeRepositorio ps = mock(ProductoSedeRepositorio.class);
        when(ps.findBySedeId(2L)).thenReturn(filas);
        ConfigTiendaRepositorio config = mock(ConfigTiendaRepositorio.class);
        ConfigTienda c = new ConfigTienda();
        c.setSedesMenu(menu);
        when(config.findById((short) 1)).thenReturn(Optional.of(c));
        return new SedeService(mock(SedeRepositorio.class), ps, mock(ProductoRepositorio.class), mock(HorarioRepositorio.class),
                config, mock(TiempoReal.class));
    }

    @Test
    void conMenuPorSedeCadaSedeTieneSuPrecioYSusProductos() {
        Producto hamburguesa = producto(10, 14_000);
        Producto perro = producto(11, 9_000);
        Producto pizza = producto(12, 30_000);
        servicio(SedeService.MENU_POR_SEDE, List.of(
                enSede(10, 2, true, true, 16_000),   // más cara en esta sede
                enSede(11, 2, false, true, null),     // agotado en esta sede
                enSede(12, 2, true, false, null)))    // esta sede no vende pizza
                .aplicar(List.of(hamburguesa, perro, pizza), sede(2));

        assertThat(hamburguesa.precioVenta()).isEqualTo(16_000);
        assertThat(hamburguesa.getPrecio()).isEqualTo(14_000); // el precio base no cambia
        assertThat(perro.disponibleVenta()).isFalse();
        assertThat(pizza.ofrecidoEnSede()).isFalse();
    }

    @Test
    void conElMismoMenuSoloCuentaElAgotadoDeLaSede() {
        Producto hamburguesa = producto(10, 14_000);
        Producto perro = producto(11, 9_000);
        servicio(SedeService.MENU_COMPARTIDO, List.of(
                enSede(10, 2, true, false, 16_000),   // precio y «no ofrecido» se ignoran con el menú compartido
                enSede(11, 2, false, true, null)))
                .aplicar(List.of(hamburguesa, perro), sede(2));

        assertThat(hamburguesa.precioVenta()).isEqualTo(14_000);
        assertThat(hamburguesa.ofrecidoEnSede()).isTrue();
        assertThat(perro.disponibleVenta()).isFalse();
    }

    @Test
    void laVistaDeUnaSedeEsUnaCopiaConSusDatos() {
        ConfigTienda c = new ConfigTienda();
        c.setDireccion("Calle 1");
        c.setAbierto(true);
        c.setTiempoMin(20);
        c.setTiempoMax(30);
        c.setEslogan("Lo mejor");
        Sede norte = sede(2);
        norte.setDireccion("Carrera 50 # 80-10");
        norte.setTiempoMin(35);
        norte.setTiempoMax(50);
        norte.setAbierta(false);

        ConfigTienda v = servicio(SedeService.MENU_COMPARTIDO, List.of()).vista(c, norte);

        assertThat(v).isNotSameAs(c);
        assertThat(v.getDireccion()).isEqualTo("Carrera 50 # 80-10");
        assertThat(v.getTiempoMax()).isEqualTo(50);
        assertThat(v.isAbierto()).isFalse();
        assertThat(v.getEslogan()).isEqualTo("Lo mejor");   // lo de la empresa se conserva
        assertThat(c.getDireccion()).isEqualTo("Calle 1");  // la configuración original no se toca
    }
}
