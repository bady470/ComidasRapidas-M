package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(schema = "cliente", name = "tbl_sesiones_admin")
public class AdminSesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Identificador para exponer hacia afuera (el id interno solo sirve para índices). */
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    @Column(name = "token_hash")
    private String tokenHash;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "administrador_id")
    private AdminUsuario admin;
    @Column(name = "creado_en")
    private Instant creado = Instant.now();
    @Column(name = "expira_en")
    private Instant expira;

    public java.util.UUID getUuid() { return uuid; }
    public Long getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String v) { tokenHash = v; }
    public AdminUsuario getAdmin() { return admin; }
    public void setAdmin(AdminUsuario v) { admin = v; }
    public Instant getCreado() { return creado; }
    public Instant getExpira() { return expira; }
    public void setExpira(Instant v) { expira = v; }
}
