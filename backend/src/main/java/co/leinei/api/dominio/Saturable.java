package co.leinei.api.dominio;

import java.time.Instant;

/** Lo que cambia el modo «estamos llenos»: la tienda (una sola sede) o cada sede. */
public interface Saturable {
    void setMinutosExtra(int v);
    void setDemoraHasta(Instant v);
    void setDomiciliosPausadosHasta(Instant v);
    void setPedidosPausadosHasta(Instant v);
}
