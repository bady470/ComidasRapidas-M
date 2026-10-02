package co.leinei.api.tiemporeal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Tiempo real con Server-Sent Events: el navegador abre una conexión y el servidor le avisa cuando algo cambia
 * (pedido nuevo, cambio de estado, pago, catálogo, empresa). El navegador vuelve a pedir los datos al recibir el aviso;
 * por los canales solo viajan avisos pequeños, nunca datos sensibles.
 *
 * Canales:
 *  - admin:{empresaId}              portal de la empresa (pedidos, pagos, avisos, catálogo)
 *  - tienda:{empresaId}             tienda pública (catálogo, precios, horario, marca)
 *  - pedido:{empresaId}:{codigo}    seguimiento de un pedido para el cliente
 *  - plataforma                     superadmin (empresas y su aprovisionamiento)
 *
 * Funciona en una sola instancia de la API. Con varias instancias se reenvían los avisos entre ellas
 * (por ejemplo con LISTEN/NOTIFY de PostgreSQL o Redis) sin cambiar los canales.
 */
@Component
public class TiempoReal {

    private static final Logger log = LoggerFactory.getLogger(TiempoReal.class);
    private static final long DURACION_MS = Duration.ofMinutes(30).toMillis(); // luego el navegador se reconecta solo
    private static final int MAXIMO_POR_CANAL = 1000;

    private final Map<String, List<SseEmitter>> canales = new ConcurrentHashMap<>();

    public static String admin(long empresaId) { return "admin:" + empresaId; }
    public static String tienda(long empresaId) { return "tienda:" + empresaId; }
    public static String pedido(long empresaId, String codigo) { return "pedido:" + empresaId + ":" + codigo; }
    public static final String PLATAFORMA = "plataforma";

    /** Abre una conexión en el canal. */
    public SseEmitter suscribir(String canal) {
        List<SseEmitter> lista = canales.computeIfAbsent(canal, k -> new CopyOnWriteArrayList<>());
        SseEmitter emitter = new SseEmitter(DURACION_MS);
        if (lista.size() >= MAXIMO_POR_CANAL) {
            emitter.complete();
            return emitter;
        }
        lista.add(emitter);
        Runnable quitar = () -> quitar(canal, emitter);
        emitter.onCompletion(quitar);
        emitter.onTimeout(quitar);
        emitter.onError(e -> quitar.run());
        try {
            // Reintento sugerido al navegador y un primer evento para confirmar la conexión.
            emitter.send(SseEmitter.event().reconnectTime(3000).name("listo").data("{}", MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            quitar.run();
        }
        return emitter;
    }

    /**
     * Publica un aviso en uno o varios canales. Si hay una transacción en curso, se envía cuando se confirma
     * (así el navegador nunca pide datos que todavía no están guardados).
     */
    public void publicar(String evento, Map<String, ?> datos, String... destinos) {
        Runnable enviar = () -> {
            for (String canal : destinos) enviarA(canal, evento, datos);
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { enviar.run(); }
            });
        } else {
            enviar.run();
        }
    }

    public int conexiones() {
        return canales.values().stream().mapToInt(List::size).sum();
    }

    /** Un comentario cada 20 s mantiene viva la conexión a través de proxies y balanceadores. */
    @Scheduled(fixedRate = 20_000)
    void latido() {
        for (Map.Entry<String, List<SseEmitter>> c : canales.entrySet()) {
            for (SseEmitter e : c.getValue()) {
                try {
                    e.send(SseEmitter.event().comment("latido"));
                } catch (Exception ex) {
                    quitar(c.getKey(), e);
                }
            }
        }
        canales.entrySet().removeIf(c -> c.getValue().isEmpty());
    }

    private void enviarA(String canal, String evento, Map<String, ?> datos) {
        List<SseEmitter> lista = canales.get(canal);
        if (lista == null || lista.isEmpty()) return;
        for (SseEmitter e : lista) {
            try {
                e.send(SseEmitter.event().name(evento).data(datos, MediaType.APPLICATION_JSON));
            } catch (Exception ex) {
                quitar(canal, e);
            }
        }
        log.debug("Evento {} enviado a {} ({} conexiones)", evento, canal, lista.size());
    }

    private void quitar(String canal, SseEmitter e) {
        List<SseEmitter> lista = canales.get(canal);
        if (lista != null) lista.remove(e);
        try { e.complete(); } catch (Exception ignorada) { /* ya estaba cerrada */ }
    }

    /** Para pruebas y diagnóstico. */
    Set<String> canalesAbiertos() { return canales.keySet(); }
}
