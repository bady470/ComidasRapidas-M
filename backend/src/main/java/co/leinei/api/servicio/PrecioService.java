package co.leinei.api.servicio;

import co.leinei.api.dominio.Opcion;
import co.leinei.api.dominio.Producto;
import co.leinei.api.dominio.Promocion;
import co.leinei.api.dominio.TipoPromocion;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calcula el valor de un pedido. Es la única fuente de verdad de los precios:
 * el frontend muestra lo que devuelve este cálculo y nunca envía totales propios.
 *
 * Reglas:
 * 1. Precio unitario = precio del producto (o su PRECIO_ESPECIAL) + valor de las opciones escogidas.
 * 2. Entre COMBO y PORCENTAJE se aplica solo la que más descuenta.
 *    El combo cobra el precio del combo por los productos base; las adiciones se pagan aparte.
 * 3. ENVIO_GRATIS se suma aparte si el valor después del descuento llega al mínimo.
 */
@Service
public class PrecioService {

    public record Linea(Producto producto, int cantidad, List<Opcion> opciones) {
        public Linea(Producto producto, int cantidad) {
            this(producto, cantidad, List.of());
        }
    }

    public record LineaCotizada(Long productoId, List<Long> opcionIds, String nombre, String detalle,
                                int precioLista, int precioBase, int extras, int precioUnitario,
                                int costoUnitario, int cantidad, int subtotal) {}

    public record Cotizacion(List<LineaCotizada> lineas, int cantidadTotal, int subtotalLista,
                             int ahorroPrecioEspecial, int subtotal, int descuento, String promocion,
                             boolean envioGratis, int domicilio, int total, int costoTotal) {}

    public Cotizacion calcular(List<Linea> lineas, List<Promocion> promociones, int valorDomicilio, LocalDate fecha) {
        List<Promocion> vigentes = promociones.stream().filter(p -> p.vigentePara(fecha)).toList();

        List<LineaCotizada> cotizadas = new ArrayList<>();
        int cantidad = 0, subtotalLista = 0, subtotal = 0, costo = 0;
        for (Linea l : lineas) {
            if (l.cantidad() <= 0) continue;
            Producto p = l.producto();
            int base = precioUnitario(p, vigentes);
            int extras = l.opciones().stream().mapToInt(Opcion::getPrecioExtra).sum();
            int unitario = base + extras;
            String detalle = l.opciones().stream().map(Opcion::getNombre).collect(Collectors.joining(" · "));
            List<Long> ids = l.opciones().stream().map(Opcion::getId).filter(Objects::nonNull).sorted().toList();
            cotizadas.add(new LineaCotizada(p.getId(), ids, p.getNombre(), detalle, p.getPrecio(), base, extras,
                    unitario, p.getCosto(), l.cantidad(), unitario * l.cantidad()));
            cantidad += l.cantidad();
            subtotalLista += (p.getPrecio() + extras) * l.cantidad();
            subtotal += unitario * l.cantidad();
            costo += p.getCosto() * l.cantidad();
        }

        int mejorDescuento = 0;
        String mejorNombre = "";
        for (Promocion promo : vigentes) {
            int d = switch (promo.getTipo()) {
                case COMBO -> descuentoCombo(promo, cotizadas);
                case PORCENTAJE -> descuentoPorcentaje(promo, cotizadas, subtotal);
                default -> 0;
            };
            if (d > mejorDescuento) {
                mejorDescuento = d;
                mejorNombre = promo.getNombre();
            }
        }

        int despuesDescuento = subtotal - mejorDescuento;
        boolean envioGratis = cantidad > 0 && valorDomicilio > 0 && vigentes.stream()
                .anyMatch(p -> p.getTipo() == TipoPromocion.ENVIO_GRATIS && despuesDescuento >= p.getMinimo());
        int domicilio = cantidad == 0 || envioGratis ? 0 : valorDomicilio;

        return new Cotizacion(cotizadas, cantidad, subtotalLista, subtotalLista - subtotal, subtotal,
                mejorDescuento, mejorNombre, envioGratis, domicilio, despuesDescuento + domicilio, costo);
    }

    /** Precio base que ve el cliente hoy, con precio especial si lo hay. */
    public int precioUnitario(Producto p, List<Promocion> vigentes) {
        int precio = p.getPrecio();
        for (Promocion promo : vigentes) {
            if (promo.getTipo() == TipoPromocion.PRECIO_ESPECIAL && promo.getProducto() != null
                    && promo.getProducto().getId().equals(p.getId())
                    && promo.getPrecio() != null && promo.getPrecio() > 0) {
                precio = Math.min(precio, promo.getPrecio());
            }
        }
        return precio;
    }

    /** Arma combos con los productos más caros primero, que es lo que más le conviene al cliente. */
    private int descuentoCombo(Promocion promo, List<LineaCotizada> lineas) {
        int n = promo.getCantidad() == null ? 0 : promo.getCantidad();
        int precioCombo = promo.getPrecio() == null ? 0 : promo.getPrecio();
        if (n < 2 || precioCombo <= 0) return 0;
        List<Integer> unidades = new ArrayList<>();
        for (LineaCotizada l : lineas) {
            if (!promo.incluye(l.productoId())) continue;
            for (int i = 0; i < l.cantidad(); i++) unidades.add(l.precioBase());
        }
        unidades.sort(Comparator.reverseOrder());
        int descuento = 0;
        for (int g = 0; g + n <= unidades.size(); g += n) {
            int suma = 0;
            for (int i = g; i < g + n; i++) suma += unidades.get(i);
            descuento += Math.max(0, suma - precioCombo);
        }
        return descuento;
    }

    private int descuentoPorcentaje(Promocion promo, List<LineaCotizada> lineas, int subtotal) {
        if (promo.getPorcentaje() == null || subtotal < promo.getMinimo()) return 0;
        int base = lineas.stream().filter(l -> promo.incluye(l.productoId())).mapToInt(LineaCotizada::subtotal).sum();
        return Math.round(base * promo.getPorcentaje() / 100f);
    }
}
