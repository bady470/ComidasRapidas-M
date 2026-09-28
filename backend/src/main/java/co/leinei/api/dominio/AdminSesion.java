package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "admin_sesion")
public class AdminSesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "token_hash")
    private String tokenHash;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "admin_id")
    private AdminUsuario admin;
    private Instant creado = Instant.now();
    private Instant expira;

    public Long getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String v) { tokenHash = v; }
    public AdminUsuario getAdmin() { return admin; }
    public void setAdmin(AdminUsuario v) { admin = v; }
    public Instant getCreado() { return creado; }
    public Instant getExpira() { return expira; }
    public void setExpira(Instant v) { expira = v; }
}
