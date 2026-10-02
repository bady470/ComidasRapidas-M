package co.leinei.api.servicio;

import co.leinei.api.dominio.*;
import co.leinei.api.repositorio.CierreCajaRepositorio;
import co.leinei.api.repositorio.PedidoRepositorio;
import co.leinei.api.web.dto.OperacionDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * Cierre de caja de un día de servicio: cuánto entró en efectivo, por cada cuenta de transferencia y en línea;
 * qué falta por cobrar; cuánto efectivo debe traer cada domiciliario; y el cuadre con lo que se contó.
 *
 * Efectivo «recibido»: pedidos en efectivo marcados como pagados o ya entregados (al entregar se cobra).
 * Efectivo esperado en caja = base inicial + efectivo recibido − gastos pagados en efectivo.
 */
@Service
public class CajaService {

    private final PedidoRepositorio pedidos;
    private final CierreCajaRepositorio cierres;

    public CajaService(PedidoRepositorio pedidos, CierreCajaRepositorio cierres) {
        this.pedidos = pedidos;
        this.cierres = cierres;
    }

    @Transactional(readOnly = true)
    public OperacionDto.Caja ver(LocalDate fecha) {
        return calcular(fecha, cierres.findByFecha(fecha).orElse(null));
    }

    @Transactional
    public OperacionDto.Caja cerrar(LocalDate fecha, OperacionDto.CierreRequest r, String quien) {
        OperacionDto.Caja caja = calcular(fecha, null);
        CierreCaja c = cierres.findByFecha(fecha).orElseGet(CierreCaja::new);
        int esperado = (int) (r.baseInicial() + caja.efectivoRecibido() - r.gastos());
        c.setFecha(fecha);
        c.setBaseInicial(r.baseInicial());
        c.setGastos(r.gastos());
        c.setNotaGastos(limpio(r.notaGastos()));
        c.setEfectivoRecibido((int) caja.efectivoRecibido());
        c.setEfectivoEsperado(esperado);
        c.setEfectivoContado(r.efectivoContado());
        c.setDiferencia(r.efectivoContado() - esperado);
        c.setTransferencias((int) caja.transferencias());
        c.setEnLinea((int) caja.enLinea());
        c.setPorCobrar((int) caja.porCobrar());
        c.setVentas((int) caja.ventas());
        c.setPedidos(caja.pedidos());
        c.setNota(limpio(r.nota()));
        c.setCerradoPor(quien);
        c.setCerradoEn(Instant.now());
        return calcular(fecha, cierres.save(c));
    }

    private OperacionDto.Caja calcular(LocalDate fecha, CierreCaja cierre) {
        List<Pedido> lista = pedidos.findByFechaEntregaOrderByCreadoDesc(fecha).stream()
                .filter(p -> p.getEstado() != EstadoPedido.CANCELADO).toList();

        // clave → [pedidos, recibido, pendiente]; LinkedHashMap para un orden estable: efectivo, cuentas, en línea.
        Map<String, long[]> medios = new LinkedHashMap<>();
        Map<String, String> nombres = new HashMap<>();
        Map<Long, long[]> porDomiciliario = new LinkedHashMap<>(); // pedidos, entregados, efectivoACobrar, cobrado, domicilios
        Map<Long, String> nombreDomiciliario = new HashMap<>();
        List<OperacionDto.Pendiente> pendientes = new ArrayList<>();
        long ventas = 0, efectivo = 0, transferencias = 0, enLinea = 0, porCobrar = 0;

        for (Pedido p : lista) {
            ventas += p.getTotal();
            boolean recibido = cobrado(p);
            String clave = switch (p.getMetodoPago()) {
                case EFECTIVO -> "EFECTIVO";
                case EN_LINEA -> "EN_LINEA:" + p.getCuentaTitular();
                case CUENTA -> "CUENTA:" + p.getCuentaEntidad() + " · " + p.getCuentaTitular();
            };
            nombres.putIfAbsent(clave, switch (p.getMetodoPago()) {
                case EFECTIVO -> "Efectivo";
                case EN_LINEA -> "En línea" + (p.getCuentaTitular().isBlank() ? "" : " · " + p.getCuentaTitular());
                case CUENTA -> p.getCuentaEntidad() + " · " + p.getCuentaTitular();
            });
            long[] m = medios.computeIfAbsent(clave, k -> new long[3]);
            m[0]++;
            if (recibido) {
                m[1] += p.getTotal();
                switch (p.getMetodoPago()) {
                    case EFECTIVO -> efectivo += p.getTotal();
                    case CUENTA -> transferencias += p.getTotal();
                    case EN_LINEA -> enLinea += p.getTotal();
                }
            } else {
                m[2] += p.getTotal();
                porCobrar += p.getTotal();
                pendientes.add(new OperacionDto.Pendiente(p.getId(), p.getCodigo(), p.getClienteNombre(), p.getTotal(),
                        nombres.get(clave), p.getEstadoPago().name(), p.getEstado().name()));
            }

            Domiciliario d = p.getDomiciliario();
            if (d != null && p.getTipoEntrega() == TipoEntrega.DOMICILIO) {
                nombreDomiciliario.putIfAbsent(d.getId(), d.getNombre());
                long[] a = porDomiciliario.computeIfAbsent(d.getId(), k -> new long[5]);
                boolean entregado = p.getEstado() == EstadoPedido.ENTREGADO;
                a[0]++;
                if (entregado) a[1]++;
                if (p.getMetodoPago() == MetodoPago.EFECTIVO) {
                    a[2] += p.getTotal();
                    if (entregado || p.getEstadoPago() == EstadoPago.RECIBIDO) a[3] += p.getTotal();
                }
                a[4] += p.getDomicilio();
            }
        }

        // Orden: efectivo primero, luego las cuentas, y en línea al final.
        List<OperacionDto.Medio> listaMedios = new ArrayList<>();
        medios.entrySet().stream()
                .sorted(Comparator.comparingInt(e -> e.getKey().equals("EFECTIVO") ? 0 : e.getKey().startsWith("EN_LINEA") ? 2 : 1))
                .forEach(e -> listaMedios.add(new OperacionDto.Medio(e.getKey(), nombres.get(e.getKey()),
                        (int) e.getValue()[0], e.getValue()[1], e.getValue()[2])));
        List<OperacionDto.DomiciliarioCaja> domiciliarios = porDomiciliario.entrySet().stream()
                .map(e -> new OperacionDto.DomiciliarioCaja(e.getKey(), nombreDomiciliario.get(e.getKey()), (int) e.getValue()[0],
                        (int) e.getValue()[1], e.getValue()[2], e.getValue()[3], e.getValue()[4]))
                .sorted(Comparator.comparing(OperacionDto.DomiciliarioCaja::nombre))
                .toList();
        OperacionDto.Cierre c = cierre == null ? null : new OperacionDto.Cierre(cierre.getBaseInicial(), cierre.getGastos(),
                cierre.getNotaGastos(), cierre.getEfectivoContado(), cierre.getEfectivoEsperado(), cierre.getDiferencia(),
                cierre.getNota(), cierre.getCerradoPor(), cierre.getCerradoEn());
        return new OperacionDto.Caja(fecha, lista.size(), ventas, efectivo, transferencias, enLinea, porCobrar, listaMedios,
                domiciliarios, pendientes, c, cierres.fechasCerradas(PageRequest.of(0, 31)));
    }

    /** El efectivo se cobra al entregar; lo demás cuenta cuando el pago está confirmado. */
    private static boolean cobrado(Pedido p) {
        if (p.getEstadoPago() == EstadoPago.RECIBIDO) return true;
        return p.getMetodoPago() == MetodoPago.EFECTIVO && p.getEstado() == EstadoPedido.ENTREGADO;
    }

    private static String limpio(String s) { return s == null ? "" : s.trim(); }
}
