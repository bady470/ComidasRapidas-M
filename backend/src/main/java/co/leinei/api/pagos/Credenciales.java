package co.leinei.api.pagos;

/**
 * Llaves de una cuenta de pasarela, ya descifradas (solo viven en memoria mientras se usan).
 *
 * Wompi: llavePublica (pub_…), llavePrivada (prv_…, opcional: sirve para buscar cobros por referencia),
 *        secretoIntegridad (firma del checkout) y secretoEventos (firma de los avisos).
 * Bold:  llavePublica = «llave de identidad» (crea los links de pago) y secretoEventos = «llave secreta»
 *        (firma de los avisos).
 */
public record Credenciales(Proveedor proveedor, String ambiente, String llavePublica, String llavePrivada,
                           String secretoIntegridad, String secretoEventos) {

    public static final String PRUEBAS = "PRUEBAS";
    public static final String PRODUCCION = "PRODUCCION";

    public boolean pruebas() { return PRUEBAS.equals(ambiente); }
}
