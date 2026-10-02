package co.leinei.api.servicio;

import co.leinei.api.dominio.ConfigTienda;
import co.leinei.api.dominio.ContactoCliente;
import co.leinei.api.repositorio.ContactoClienteRepositorio;
import co.leinei.api.web.dto.OperacionDto;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Clientes de la tienda, agrupados por celular: cuánto piden, cuánto gastan, qué es lo que más piden y hace cuánto
 * no piden. Sirve para escribirle por WhatsApp a quien dejó de pedir y medir cuántos vuelven.
 * Los pedidos sin celular (algunos de WhatsApp) no se pueden agrupar y no aparecen.
 */
@Service
public class ClientesService {

    /** Cliente frecuente: 3 pedidos o más. Dormido: 30 días o más sin pedir. */
    static final int FRECUENTE = 3;
    static final int DORMIDO_DIAS = 30;
    private static final int MAXIMO = 3000;

    @PersistenceContext
    private EntityManager em;

    private final ContactoClienteRepositorio contactos;
    private final ConfigService config;

    public ClientesService(ContactoClienteRepositorio contactos, ConfigService config) {
        this.contactos = contactos;
        this.config = config;
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public OperacionDto.Clientes listar() {
        List<Object[]> filas = em.createNativeQuery("""
                        SELECT p.cliente_celular,
                               (array_agg(p.cliente_nombre ORDER BY p.creado_en DESC))[1],
                               count(*), sum(p.total), min(p.creado_en), max(p.creado_en)
                          FROM producto.tbl_pedidos p
                         WHERE p.publicado AND p.estado <> 'CANCELADO' AND p.cliente_celular <> ''
                         GROUP BY p.cliente_celular
                         ORDER BY max(p.creado_en) DESC
                         LIMIT :maximo""")
                .setParameter("maximo", MAXIMO)
                .getResultList();

        // Lo que más pide cada cliente (por unidades).
        Map<String, String> favorito = new HashMap<>();
        Map<String, Long> unidadesFavorito = new HashMap<>();
        List<Object[]> productos = em.createNativeQuery("""
                        SELECT p.cliente_celular, i.nombre, sum(i.cantidad)
                          FROM producto.tbl_pedidos p JOIN producto.tbl_pedidos_items i ON i.pedido_id = p.id
                         WHERE p.publicado AND p.estado <> 'CANCELADO' AND p.cliente_celular <> ''
                         GROUP BY p.cliente_celular, i.nombre""")
                .getResultList();
        for (Object[] f : productos) {
            String cel = (String) f[0];
            long unidades = ((Number) f[2]).longValue();
            if (unidades > unidadesFavorito.getOrDefault(cel, 0L)) {
                unidadesFavorito.put(cel, unidades);
                favorito.put(cel, (String) f[1]);
            }
        }

        Map<String, Instant> contactado = new HashMap<>();
        for (Object[] f : contactos.ultimosContactos()) contactado.put((String) f[0], instante(f[1]));

        Instant ahora = Instant.now();
        Instant haceUnMes = ahora.minus(Duration.ofDays(30));
        List<OperacionDto.Cliente> lista = new ArrayList<>();
        int frecuentes = 0, nuevosMes = 0, dormidos = 0, contactados = 0, recuperados = 0;
        for (Object[] f : filas) {
            String cel = (String) f[0];
            int pedidos = ((Number) f[2]).intValue();
            long total = ((Number) f[3]).longValue();
            Instant primero = instante(f[4]);
            Instant ultimo = instante(f[5]);
            int dias = (int) ChronoUnit.DAYS.between(ultimo, ahora);
            Instant contacto = contactado.get(cel);
            boolean volvio = contacto != null && ultimo.isAfter(contacto);
            if (pedidos >= FRECUENTE) frecuentes++;
            if (primero.isAfter(haceUnMes)) nuevosMes++;
            if (dias >= DORMIDO_DIAS) dormidos++;
            if (contacto != null) contactados++;
            if (volvio) recuperados++;
            lista.add(new OperacionDto.Cliente(cel, (String) f[1], pedidos, total, pedidos == 0 ? 0 : Math.round((double) total / pedidos),
                    primero, ultimo, dias, favorito.getOrDefault(cel, ""), contacto, volvio));
        }
        return new OperacionDto.Clientes(new OperacionDto.ResumenClientes(lista.size(), frecuentes, nuevosMes, dormidos,
                contactados, recuperados), lista, config.tienda().getMensajeRecuperar());
    }

    /** Se registra cuando el negocio abre WhatsApp para escribirle al cliente (así se mide quién vuelve). */
    @Transactional
    public void registrarContacto(OperacionDto.ContactoRequest r, String quien) {
        contactos.save(ContactoCliente.de(r.celular(), r.nombre(), r.mensaje(), quien));
    }

    @Transactional
    public void guardarMensaje(String mensaje) {
        ConfigTienda c = config.tienda();
        c.setMensajeRecuperar(mensaje == null ? "" : mensaje.trim());
    }

    /** Las fechas de una consulta nativa llegan como Instant, OffsetDateTime o Timestamp según el driver. */
    static Instant instante(Object o) {
        if (o == null) return null;
        if (o instanceof Instant i) return i;
        if (o instanceof OffsetDateTime odt) return odt.toInstant();
        if (o instanceof ZonedDateTime zdt) return zdt.toInstant();
        if (o instanceof Timestamp t) return t.toInstant();
        if (o instanceof LocalDateTime ldt) return ldt.toInstant(ZoneOffset.UTC);
        throw new IllegalArgumentException("Fecha con tipo inesperado: " + o.getClass());
    }
}
