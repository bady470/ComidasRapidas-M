package co.leinei.api.servicio;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.web.dto.OperacionDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Cómo va el negocio en un rango de días: ventas, pedidos, ticket promedio, productos más vendidos, horas y días
 * con más pedidos, cómo pagan y cómo reciben, y la comparación con el periodo anterior del mismo largo.
 *
 * Los pedidos cuentan para su día de entrega (igual que el reporte del día y el cierre de caja); los cancelados
 * solo se cuentan aparte. Las horas salen de cuándo se hizo el pedido.
 */
@Service
public class EstadisticasService {

    /** Rango máximo (un año y un día): el periodo anterior también se carga, así que son hasta ~2 años de pedidos. */
    private static final int MAXIMO_DIAS = 366;
    private static final int TOP_PRODUCTOS = 10;

    private final PedidoRepositorio pedidos;
    private final ConfigService configService;
    private final ZoneId zona;

    public EstadisticasService(PedidoRepositorio pedidos, ConfigService configService, LeineiProperties props) {
        this.pedidos = pedidos;
        this.configService = configService;
        this.zona = ZoneId.of(props.zonaHoraria());
    }

    @Transactional(readOnly = true)
    public OperacionDto.Estadisticas calcular(LocalDate desde, LocalDate hasta) {
        if (desde == null || hasta == null || hasta.isBefore(desde)) {
            throw ReglaNegocioException.invalido("Escoge un rango de fechas válido.");
        }
        long dias = ChronoUnit.DAYS.between(desde, hasta) + 1;
        if (dias > MAXIMO_DIAS) throw ReglaNegocioException.invalido("El rango puede ser de máximo un año.");
        LocalDate antesHasta = desde.minusDays(1);
        LocalDate antesDesde = antesHasta.minusDays(dias - 1);

        List<Pedido> todos = pedidos.findByFechaEntregaBetween(antesDesde, hasta);
        List<Pedido> actuales = todos.stream().filter(p -> !p.getFechaEntrega().isBefore(desde)).toList();
        List<Pedido> anteriores = todos.stream().filter(p -> p.getFechaEntrega().isBefore(desde)).toList();
        int costoOperativo = configService.tienda().getCostoOperativoUnidad();

        List<Pedido> validos = actuales.stream().filter(p -> p.getEstado() != EstadoPedido.CANCELADO).toList();
        return new OperacionDto.Estadisticas(desde, hasta, antesDesde, antesHasta,
                resumen(actuales, desde, costoOperativo), resumen(anteriores, antesDesde, costoOperativo),
                porDia(validos, desde, hasta), topProductos(validos), porHora(validos), porDiaSemana(validos),
                partes(validos, p -> p.getMetodoPago().name(), Map.of("EFECTIVO", "Efectivo", "CUENTA", "Transferencia", "EN_LINEA", "En línea"),
                        List.of("EFECTIVO", "CUENTA", "EN_LINEA")),
                partes(validos, p -> p.getTipoEntrega().name(), Map.of("DOMICILIO", "A domicilio", "RECOGER", "Recogen en el local"),
                        List.of("DOMICILIO", "RECOGER")),
                partes(validos, p -> p.getOrigen().name(), Map.of("WEB", "Tienda en línea", "WHATSAPP", "WhatsApp o teléfono"),
                        List.of("WEB", "WHATSAPP")));
    }

    private OperacionDto.Resumen resumen(List<Pedido> lista, LocalDate desde, int costoOperativo) {
        int cancelados = (int) lista.stream().filter(p -> p.getEstado() == EstadoPedido.CANCELADO).count();
        List<Pedido> validos = lista.stream().filter(p -> p.getEstado() != EstadoPedido.CANCELADO).toList();
        long ventas = 0, cobrado = 0, domicilios = 0, costo = 0;
        int unidades = 0;
        for (Pedido p : validos) {
            ventas += p.getTotal();
            domicilios += p.getDomicilio();
            costo += p.getCostoTotal();
            unidades += p.cantidadUnidades();
            if (p.getEstadoPago() == EstadoPago.RECIBIDO) cobrado += p.getTotal();
        }
        long ganancia = ventas - domicilios - costo - (long) unidades * costoOperativo;

        // Clientes por celular (los pedidos por WhatsApp sin celular no se pueden contar).
        Set<String> celulares = validos.stream().map(Pedido::getClienteCelular)
                .filter(c -> c != null && !c.isBlank()).collect(Collectors.toSet());
        int nuevos = 0;
        if (!celulares.isEmpty()) {
            for (Object[] fila : pedidos.primerPedido(celulares)) {
                if (!((LocalDate) fila[1]).isBefore(desde)) nuevos++;
            }
        }
        int n = validos.size();
        return new OperacionDto.Resumen(ventas, n, n == 0 ? 0 : Math.round((double) ventas / n), unidades, ganancia,
                cobrado, ventas - cobrado, cancelados, celulares.size(), nuevos, domicilios);
    }

    /** Un punto por día del rango, también los días sin pedidos (en cero), para que la línea no mienta. */
    private static List<OperacionDto.Dia> porDia(List<Pedido> validos, LocalDate desde, LocalDate hasta) {
        Map<LocalDate, long[]> mapa = new HashMap<>();
        for (Pedido p : validos) {
            long[] a = mapa.computeIfAbsent(p.getFechaEntrega(), k -> new long[2]);
            a[0] += p.getTotal();
            a[1]++;
        }
        List<OperacionDto.Dia> lista = new ArrayList<>();
        for (LocalDate d = desde; !d.isAfter(hasta); d = d.plusDays(1)) {
            long[] a = mapa.getOrDefault(d, new long[2]);
            lista.add(new OperacionDto.Dia(d, a[0], (int) a[1]));
        }
        return lista;
    }

    /** Los más vendidos por unidades. Las ventas de cada producto ya descuentan su parte de la promoción del pedido. */
    private static List<OperacionDto.Producto> topProductos(List<Pedido> validos) {
        Map<String, long[]> mapa = new HashMap<>();
        for (Pedido p : validos) {
            int bruto = Math.max(1, p.getItems().stream().mapToInt(i -> i.getPrecioUnitario() * i.getCantidad()).sum());
            for (PedidoItem i : p.getItems()) {
                int linea = i.getPrecioUnitario() * i.getCantidad();
                long[] a = mapa.computeIfAbsent(i.getNombre(), k -> new long[2]);
                a[0] += i.getCantidad();
                a[1] += linea - Math.round((float) p.getDescuento() * linea / bruto);
            }
        }
        return mapa.entrySet().stream()
                .map(e -> new OperacionDto.Producto(e.getKey(), (int) e.getValue()[0], e.getValue()[1]))
                .sorted(Comparator.comparingInt(OperacionDto.Producto::unidades).reversed()
                        .thenComparing(OperacionDto.Producto::ventas, Comparator.reverseOrder()))
                .limit(TOP_PRODUCTOS)
                .toList();
    }

    private List<OperacionDto.Hora> porHora(List<Pedido> validos) {
        long[][] h = new long[24][2];
        for (Pedido p : validos) {
            int hora = p.getCreado().atZone(zona).getHour();
            h[hora][0]++;
            h[hora][1] += p.getTotal();
        }
        List<OperacionDto.Hora> lista = new ArrayList<>();
        for (int i = 0; i < 24; i++) lista.add(new OperacionDto.Hora(i, (int) h[i][0], h[i][1]));
        return lista;
    }

    private static List<OperacionDto.DiaSemana> porDiaSemana(List<Pedido> validos) {
        long[][] d = new long[8][2];
        for (Pedido p : validos) {
            int dia = p.getFechaEntrega().getDayOfWeek().getValue();
            d[dia][0]++;
            d[dia][1] += p.getTotal();
        }
        List<OperacionDto.DiaSemana> lista = new ArrayList<>();
        for (int i = 1; i <= 7; i++) lista.add(new OperacionDto.DiaSemana(i, (int) d[i][0], d[i][1]));
        return lista;
    }

    /** Reparto del total en partes con orden fijo (las que no tienen pedidos se omiten). */
    private static List<OperacionDto.Parte> partes(List<Pedido> validos, Function<Pedido, String> clave,
                                                   Map<String, String> nombres, List<String> orden) {
        Map<String, long[]> mapa = new HashMap<>();
        for (Pedido p : validos) {
            long[] a = mapa.computeIfAbsent(clave.apply(p), k -> new long[2]);
            a[0]++;
            a[1] += p.getTotal();
        }
        return orden.stream().filter(mapa::containsKey)
                .map(k -> new OperacionDto.Parte(k, nombres.get(k), (int) mapa.get(k)[0], mapa.get(k)[1]))
                .toList();
    }
}
