package co.leinei.api.dominio;

import jakarta.persistence.*;

import java.time.Instant;

/** Una lámina del carrusel de la portada: título, texto, botón, foto de fondo y color. */
@Entity
@Table(schema = "producto", name = "tbl_banners")
public class Banner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private java.util.UUID uuid = java.util.UUID.randomUUID();
    private String titulo;
    private String subtitulo = "";
    private String boton = "";
    @Column(name = "archivo_id")
    private Long imagenId;
    /** Color de fondo (#RRGGBB). Vacío = el color de la marca. */
    private String color = "";
    @Column(name = "es_activo")
    private boolean activo = true;
    private int orden;
    @Column(name = "creado_en", updatable = false)
    private Instant creado = Instant.now();

    public Long getId() { return id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getSubtitulo() { return subtitulo; }
    public void setSubtitulo(String subtitulo) { this.subtitulo = subtitulo; }
    public String getBoton() { return boton; }
    public void setBoton(String boton) { this.boton = boton; }
    public Long getImagenId() { return imagenId; }
    public void setImagenId(Long imagenId) { this.imagenId = imagenId; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public int getOrden() { return orden; }
    public void setOrden(int orden) { this.orden = orden; }
}
