package co.leinei.api.servicio;

import co.leinei.api.dominio.Opcion;
import co.leinei.api.dominio.Producto;
import co.leinei.api.dominio.Promocion;
import co.leinei.api.dominio.TipoPromocion;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PrecioServiceTest {

    private final PrecioService servicio = new PrecioService();
    private final LocalDate domingo = LocalDate.of(2026, 9, 27);

    private final Producto maracuya = producto(1L, "Mousse de maracuyá", 6000, 3330);
    private final Producto oreo = producto(2L, "Postre de Oreo", 7500, 4530);
    private final Producto milo = producto(3L, "Postre de Milo", 6000, 3830);

    @Test
    void sinPromocionesSumaPreciosYDomicilio() {
        var c = servicio.calcular(List.of(new PrecioService.Linea(maracuya, 2)), List.of(), 3000, domingo);
        assertThat(c.subtotal()).isEqualTo(12000);
        assertThat(c.descuento()).isZero();
        assertThat(c.domicilio()).isEqualTo(3000);
        assertThat(c.total()).isEqualTo(15000);
        assertThat(c.costoTotal()).isEqualTo(6660);
    }

    @Test
    void comboDeTresArmaElGrupoConLosMasCaros() {
        Promocion combo = combo(3, 17000);
        var lineas = List.of(new PrecioService.Linea(oreo, 3), new PrecioService.Linea(maracuya, 1));
        var c = servicio.calcular(lineas, List.of(combo), 0, domingo);
        // 3 Oreo = 22.500 → combo 17.000 (ahorra 5.500); la maracuyá queda a precio normal.
        assertThat(c.descuento()).isEqualTo(5500);
        assertThat(c.total()).isEqualTo(22500 + 6000 - 5500);
        assertThat(c.promocion()).isEqualTo("Combo 3 postres");
    }

    @Test
    void comboNoAplicaConMenosPostres() {
        var c = servicio.calcular(List.of(new PrecioService.Linea(milo, 2)), List.of(combo(3, 17000)), 0, domingo);
        assertThat(c.descuento()).isZero();
    }

    @Test
    void seAplicaSoloLaPromocionQueMasDescuenta() {
        Promocion porcentaje = new Promocion();
        porcentaje.setId(20L);
        porcentaje.setNombre("10% domingo");
        porcentaje.setTipo(TipoPromocion.PORCENTAJE);
        porcentaje.setPorcentaje(10);
        var lineas = List.of(new PrecioService.Linea(maracuya, 3)); // 18.000
        var c = servicio.calcular(lineas, List.of(porcentaje, combo(3, 17000)), 0, domingo);
        // 10% = 1.800 le gana al combo, que solo ahorra 1.000.
        assertThat(c.descuento()).isEqualTo(1800);
        assertThat(c.promocion()).isEqualTo("10% domingo");
    }

    @Test
    void precioEspecialBajaElPrecioUnitario() {
        Promocion especial = new Promocion();
        especial.setId(30L);
        especial.setNombre("Oreo a 6.500");
        especial.setTipo(TipoPromocion.PRECIO_ESPECIAL);
        especial.setProducto(oreo);
        especial.setPrecio(6500);
        var c = servicio.calcular(List.of(new PrecioService.Linea(oreo, 2)), List.of(especial), 0, domingo);
        assertThat(c.lineas().getFirst().precioUnitario()).isEqualTo(6500);
        assertThat(c.ahorroPrecioEspecial()).isEqualTo(2000);
        assertThat(c.total()).isEqualTo(13000);
    }

    @Test
    void envioGratisDesdeElMinimo() {
        Promocion envio = new Promocion();
        envio.setId(40L);
        envio.setNombre("Domicilio gratis");
        envio.setTipo(TipoPromocion.ENVIO_GRATIS);
        envio.setMinimo(15000);
        var poco = servicio.calcular(List.of(new PrecioService.Linea(milo, 2)), List.of(envio), 3000, domingo);
        var mucho = servicio.calcular(List.of(new PrecioService.Linea(milo, 3)), List.of(envio), 3000, domingo);
        assertThat(poco.domicilio()).isEqualTo(3000);
        assertThat(mucho.envioGratis()).isTrue();
        assertThat(mucho.domicilio()).isZero();
    }

    @Test
    void promocionFueraDeFechaNoAplica() {
        Promocion combo = combo(3, 17000);
        combo.setHasta(domingo.minusDays(7));
        var c = servicio.calcular(List.of(new PrecioService.Linea(milo, 3)), List.of(combo), 0, domingo);
        assertThat(c.descuento()).isZero();
    }

    @Test
    void comboSoloParaPostresIncluidos() {
        Promocion combo = combo(3, 15000);
        combo.setProductos(Set.of(milo));
        var lineas = List.of(new PrecioService.Linea(milo, 2), new PrecioService.Linea(oreo, 1));
        var c = servicio.calcular(lineas, List.of(combo), 0, domingo);
        assertThat(c.descuento()).isZero(); // solo hay 2 de Milo
    }

    @Test
    void adicionesSubenElPrecioYElComboNoLasDescuenta() {
        Opcion grande = opcion(100L, "Grande", 3000);
        Opcion queso = opcion(101L, "Extra queso", 2000);
        var lineas = List.of(new PrecioService.Linea(milo, 3, List.of(grande, queso)));
        var c = servicio.calcular(lineas, List.of(combo(3, 17000)), 0, domingo);
        var l = c.lineas().getFirst();
        assertThat(l.precioUnitario()).isEqualTo(11000);
        assertThat(l.detalle()).isEqualTo("Grande · Extra queso");
        // 3 x 6.000 base = 18.000 → combo 17.000 ahorra 1.000; las adiciones (3 x 5.000) se cobran completas.
        assertThat(c.descuento()).isEqualTo(1000);
        assertThat(c.total()).isEqualTo(33000 - 1000);
    }

    private static Opcion opcion(Long id, String nombre, int extra) {
        Opcion o = new Opcion();
        o.setId(id);
        o.setNombre(nombre);
        o.setPrecioExtra(extra);
        return o;
    }

    private static Producto producto(Long id, String nombre, int precio, int costo) {
        Producto p = new Producto();
        p.setId(id);
        p.setNombre(nombre);
        p.setPrecio(precio);
        p.setCosto(costo);
        return p;
    }

    private static Promocion combo(int cantidad, int precio) {
        Promocion p = new Promocion();
        p.setId(10L);
        p.setNombre("Combo 3 postres");
        p.setTipo(TipoPromocion.COMBO);
        p.setCantidad(cantidad);
        p.setPrecio(precio);
        return p;
    }
}
