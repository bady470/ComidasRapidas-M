package co.leinei.api.dominio;

/** Cómo ven los clientes la tienda. El contenido es el mismo; cambia la presentación del menú. */
public enum PlantillaTienda {
    /** Portada con fotos y lista con la foto a la derecha. Sirve para casi todo. */
    CLASICA,
    /** Tarjetas grandes con la foto arriba: postres, panadería, productos que entran por los ojos. */
    VITRINA,
    /** Compacta y rápida, sin portada grande: comidas rápidas con menús largos. */
    EXPRESS,
    /** Oscura y sobria, con tipografía grande: restaurantes, cafés y bares. */
    ELEGANTE
}
