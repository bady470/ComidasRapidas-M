package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/** Mensaje que el negocio le mandó a un cliente para que volviera a pedir. */
@Entity
@Table(schema = "cliente", name = "tbl_contactos_clientes")
public class ContactoCliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String celular;
    private String nombre = "";
    private String mensaje = "";
    @Column(name = "contactado_por")
    private String contactadoPor = "";
    @Column(name = "creado_en", updatable = false)
    private Instant creado = Instant.now();

    public static ContactoCliente de(String celular, String nombre, String mensaje, String quien) {
        ContactoCliente c = new ContactoCliente();
        c.celular = celular;
        c.nombre = nombre == null ? "" : nombre.trim();
        c.mensaje = mensaje == null ? "" : mensaje.trim();
        c.contactadoPor = quien == null ? "" : quien;
        return c;
    }

    public Long getId() { return id; }
    public String getCelular() { return celular; }
    public Instant getCreado() { return creado; }
}
