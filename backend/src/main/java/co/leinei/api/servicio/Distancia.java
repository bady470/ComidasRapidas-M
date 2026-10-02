package co.leinei.api.servicio;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Distancia en línea recta y valor del domicilio por tramos («2:3000;4:5000;7:8000»). */
public final class Distancia {

    private Distancia() {}

    /** Hasta {@code hastaKm} (incluido) se cobra {@code valor}. */
    public record Tramo(double hastaKm, int valor) {}

    private static final double RADIO_TIERRA_KM = 6371.0;

    /** Fórmula del haversine: km en línea recta entre dos puntos. */
    public static double km(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public static List<Tramo> tramos(String texto) {
        List<Tramo> lista = new ArrayList<>();
        if (texto == null || texto.isBlank()) return lista;
        for (String parte : texto.split(";")) {
            String[] kv = parte.trim().split(":");
            if (kv.length != 2) continue;
            try {
                lista.add(new Tramo(Double.parseDouble(kv[0].trim()), Integer.parseInt(kv[1].trim())));
            } catch (NumberFormatException ignorado) { /* tramo mal escrito: se omite */ }
        }
        lista.sort((x, y) -> Double.compare(x.hastaKm(), y.hastaKm()));
        return lista;
    }

    public static String texto(List<Tramo> tramos) {
        return String.join(";", tramos.stream()
                .map(t -> String.format(Locale.ROOT, "%s:%d", limpio(t.hastaKm()), t.valor())).toList());
    }

    /** Valor del domicilio para esa distancia, o null si queda por fuera del último tramo. */
    public static Integer valor(List<Tramo> tramos, double km) {
        for (Tramo t : tramos) if (km <= t.hastaKm() + 1e-9) return t.valor();
        return null;
    }

    /** 3.0 → «3», 2.5 → «2.5». */
    private static String limpio(double d) {
        return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
    }
}
