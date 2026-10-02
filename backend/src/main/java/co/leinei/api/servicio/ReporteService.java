package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.web.dto.AdminDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/** Ventas y producción de un día: cuántas unidades preparar, cuánto se vendió y cuánto se ganó. */
@Service
public class ReporteService {

    private final PedidoRepositorio pedidoRepo;
    private final ConfigService configService;

    private final SedeService sedes;

    public ReporteService(PedidoRepositorio pedidoRepo, ConfigService configService, SedeService sedes) {
        this.sedes = sedes;
        this.pedidoRepo = pedidoRepo;
        this.configService = configService;
    }

    @Transactional(readOnly = true)
    public List<LocalDate> fechas() {
        return pedidoRepo.fechasConPedidos(PageRequest.of(0, 60));
    }

    @Transactional(readOnly = true)
    public AdminDto.Produccion produccion(LocalDate fecha) {
        int costoOperativoUnidad = configService.tienda().getCostoOperativoUnidad();
        Long sede = sedes.filtro(); // con varias sedes, la escogida en la barra (null = todas)
        List<Pedido> pedidos = pedidoRepo.findByPublicadoTrueAndFechaEntregaOrderByCreadoDesc(fecha).stream()
                .filter(p -> p.getEstado() != EstadoPedido.CANCELADO)
                .filter(p -> sede == null || sede.equals(p.getSedeId())).toList();

        Map<String, int[]> porProducto = new LinkedHashMap<>(); // unidades, ventas, costo
        Map<String, Integer> porDetalle = new LinkedHashMap<>();  // "producto|detalle" → unidades
        Map<String, int[]> porCuenta = new LinkedHashMap<>();     // pedidos, total, recibido
        int unidades = 0, ventas = 0, domicilios = 0, costo = 0, cobrado = 0, aDomicilio = 0, aRecoger = 0;

        for (Pedido p : pedidos) {
            ventas += p.getTotal();
            domicilios += p.getDomicilio();
            costo += p.getCostoTotal();
            if (p.getTipoEntrega() == TipoEntrega.RECOGER) aRecoger++; else aDomicilio++;
            if (p.getEstadoPago() == EstadoPago.RECIBIDO) cobrado += p.getTotal();

            String cuenta = switch (p.getMetodoPago()) {
                case CUENTA -> p.getCuentaEntidad() + " · " + p.getCuentaTitular();
                case EN_LINEA -> "En línea · " + p.getCuentaTitular();
                case EFECTIVO -> "Efectivo";
            };
            int[] c = porCuenta.computeIfAbsent(cuenta, k -> new int[3]);
            c[0]++;
            c[1] += p.getTotal();
            if (p.getEstadoPago() == EstadoPago.RECIBIDO) c[2] += p.getTotal();

            // El descuento del pedido se reparte entre sus productos según lo que pesa cada uno.
            int bruto = Math.max(1, p.getItems().stream().mapToInt(i -> i.getPrecioUnitario() * i.getCantidad()).sum());
            for (PedidoItem i : p.getItems()) {
                unidades += i.getCantidad();
                int linea = i.getPrecioUnitario() * i.getCantidad();
                int ventaNeta = linea - Math.round((float) p.getDescuento() * linea / bruto);
                int[] a = porProducto.computeIfAbsent(i.getNombre(), k -> new int[3]);
                a[0] += i.getCantidad();
                a[1] += ventaNeta;
                a[2] += i.getCostoUnitario() * i.getCantidad();
                if (!i.getDetalle().isBlank()) porDetalle.merge(i.getNombre() + "|" + i.getDetalle(), i.getCantidad(), Integer::sum);
            }
        }

        int operativo = unidades * costoOperativoUnidad;
        int ventasProductos = ventas - domicilios;
        int ganancia = ventasProductos - costo - operativo;

        List<AdminDto.LineaProduccion> lineas = porProducto.entrySet().stream()
                .map(e -> new AdminDto.LineaProduccion(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2],
                        e.getValue()[1] - e.getValue()[2]))
                .sorted(Comparator.comparingInt(AdminDto.LineaProduccion::unidades).reversed())
                .toList();
        List<AdminDto.LineaDetalle> detalle = porDetalle.entrySet().stream()
                .map(e -> {
                    String[] partes = e.getKey().split("\\|", 2);
                    return new AdminDto.LineaDetalle(partes[0], partes[1], e.getValue());
                })
                .sorted(Comparator.comparing(AdminDto.LineaDetalle::nombre).thenComparing(AdminDto.LineaDetalle::unidades, Comparator.reverseOrder()))
                .toList();
        List<AdminDto.PagoPorCuenta> pagos = porCuenta.entrySet().stream()
                .map(e -> new AdminDto.PagoPorCuenta(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .toList();

        return new AdminDto.Produccion(fecha, pedidos.size(), unidades, ventasProductos, domicilios, costo, operativo,
                ganancia, cobrado, ventas - cobrado, aDomicilio, aRecoger, lineas, detalle, pagos);
    }
}
