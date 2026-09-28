package co.leinei.api.servicio;

import co.leinei.api.config.LeineiProperties;
import co.leinei.api.dominio.ConfigTienda;
import co.leinei.api.dominio.Horario;
import co.leinei.api.dominio.ModoPedido;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Decide si la tienda recibe pedidos en este momento y para qué día.
 *
 * INMEDIATO: recibe pedidos dentro del horario de atención. Un turno puede pasar la medianoche
 * (ej. 6:00 p. m. a 2:00 a. m.); el pedido cuenta para el día en que empezó el turno.
 *
 * PROGRAMADO: la entrega es un día fijo de la semana y los pedidos cierran N días antes a una hora
 * (ej. entrega el domingo, cierre el sábado a las 9:00 p. m.). Pasado el cierre, queda para la otra semana.
 */
@Service
public class DisponibilidadService {

    /**
     * @param recibePedidos  si el cliente puede pedir ya (tienda abierta y, en modo inmediato, dentro del horario)
     * @param enHorario      solo modo inmediato: si el local está en su horario de atención
     * @param fechaServicio  día de entrega (programado) o día del turno actual (inmediato)
     * @param cierre         programado: hasta cuándo se reciben pedidos; inmediato: a qué hora cierra el turno actual
     * @param proximaApertura inmediato y cerrado: cuándo vuelve a abrir
     */
    public record Disponibilidad(ModoPedido modo, boolean recibePedidos, boolean enHorario, LocalDate fechaServicio,
                                 Instant cierre, Instant proximaApertura) {}

    private final Clock reloj;
    private final ZoneId zona;

    public DisponibilidadService(Clock reloj, LeineiProperties props) {
        this.reloj = reloj;
        this.zona = ZoneId.of(props.zonaHoraria());
    }

    public Disponibilidad calcular(ConfigTienda c, List<Horario> horarios) {
        ZonedDateTime ahora = ZonedDateTime.now(reloj).withZoneSameInstant(zona);
        return c.getModoPedido() == ModoPedido.PROGRAMADO
                ? programado(c, ahora)
                : inmediato(c, horarios, ahora);
    }

    private Disponibilidad programado(ConfigTienda c, ZonedDateTime ahora) {
        DayOfWeek dia = DayOfWeek.of(c.getDiaEntrega());
        LocalDate fecha = ahora.toLocalDate();
        for (int i = 0; i < 15; i++, fecha = fecha.plusDays(1)) {
            if (fecha.getDayOfWeek() != dia) continue;
            ZonedDateTime cierre = fecha.minusDays(c.getCierreDiasAntes()).atTime(c.getCierreHora(), 0).atZone(zona);
            if (!ahora.isAfter(cierre)) {
                return new Disponibilidad(ModoPedido.PROGRAMADO, c.isAbierto(), true, fecha, cierre.toInstant(), null);
            }
        }
        throw new IllegalStateException("No se encontró fecha de entrega");
    }

    private Disponibilidad inmediato(ConfigTienda c, List<Horario> horarios, ZonedDateTime ahora) {
        Map<Integer, Horario> porDia = horarios.stream().collect(Collectors.toMap(Horario::getDia, Function.identity()));
        LocalDate hoy = ahora.toLocalDate();
        LocalTime hora = ahora.toLocalTime();

        // ¿Seguimos en el turno de ayer que pasó la medianoche?
        Horario ayer = porDia.get(hoy.minusDays(1).getDayOfWeek().getValue());
        if (ayer != null && ayer.isActivo() && ayer.cruzaMedianoche() && hora.isBefore(ayer.getCierra())) {
            return abierto(c, hoy.minusDays(1), hoy.atTime(ayer.getCierra()));
        }
        Horario h = porDia.get(hoy.getDayOfWeek().getValue());
        if (h != null && h.isActivo() && !hora.isBefore(h.getAbre())) {
            if (h.cruzaMedianoche()) {
                return abierto(c, hoy, hoy.plusDays(1).atTime(h.getCierra()));
            }
            if (hora.isBefore(h.getCierra())) {
                return abierto(c, hoy, hoy.atTime(h.getCierra()));
            }
        }
        Instant proxima = proximaApertura(porDia, ahora).map(ZonedDateTime::toInstant).orElse(null);
        return new Disponibilidad(ModoPedido.INMEDIATO, false, false, hoy, null, proxima);
    }

    private Disponibilidad abierto(ConfigTienda c, LocalDate turno, LocalDateTime cierra) {
        return new Disponibilidad(ModoPedido.INMEDIATO, c.isAbierto(), true, turno, cierra.atZone(zona).toInstant(), null);
    }

    private Optional<ZonedDateTime> proximaApertura(Map<Integer, Horario> porDia, ZonedDateTime ahora) {
        for (int i = 0; i <= 7; i++) {
            LocalDate d = ahora.toLocalDate().plusDays(i);
            Horario h = porDia.get(d.getDayOfWeek().getValue());
            if (h == null || !h.isActivo()) continue;
            ZonedDateTime abre = d.atTime(h.getAbre()).atZone(zona);
            if (abre.isAfter(ahora)) return Optional.of(abre);
        }
        return Optional.empty();
    }

    public LocalDate hoy() {
        return LocalDate.now(reloj.withZone(zona));
    }
}
