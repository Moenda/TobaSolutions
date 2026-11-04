package br.com.toba.auto;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Contas de mapa (metros, rumo, projeção e polyline). Tudo puro, sem Android. */
final class Geo {
    private Geo() {}

    static final double EARTH = 6371008.8;
    static final Locale BR = new Locale("pt", "BR");

    static double distance(double lat1, double lon1, double lat2, double lon2) {
        double p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2);
        double dp = p2 - p1, dl = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /** Rumo de 1 pra 2, em graus (0 = norte, sentido horário). */
    static double bearing(double lat1, double lon1, double lat2, double lon2) {
        double p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2), dl = Math.toRadians(lon2 - lon1);
        double y = Math.sin(dl) * Math.cos(p2);
        double x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
        return norm(Math.toDegrees(Math.atan2(y, x)));
    }

    static double norm(double deg) {
        double d = deg % 360;
        return d < 0 ? d + 360 : d;
    }

    /** Diferença de ângulo com sinal, de -180 a 180. */
    static double angleDiff(double from, double to) {
        double d = norm(to - from);
        return d > 180 ? d - 360 : d;
    }

    /** Leste/norte em metros de (lat0, lon0) até (lat, lon). Bom pra distâncias de cidade. */
    static double[] enu(double lat0, double lon0, double lat, double lon) {
        double e = Math.toRadians(lon - lon0) * EARTH * Math.cos(Math.toRadians(lat0));
        double n = Math.toRadians(lat - lat0) * EARTH;
        return new double[] {e, n};
    }

    /** Anda de (lat, lon) east/north metros. */
    static double[] offset(double lat, double lon, double east, double north) {
        double dLat = Math.toDegrees(north / EARTH);
        double dLon = Math.toDegrees(east / (EARTH * Math.cos(Math.toRadians(lat))));
        return new double[] {lat + dLat, lon + dLon};
    }

    /** "lat,lon" -> {lat, lon}; null se não for número. */
    static double[] parseLatLon(String s) {
        if (s == null) return null;
        String[] p = s.trim().split(",");
        if (p.length < 2) return null;
        try {
            double lat = Double.parseDouble(p[0].trim());
            double lon = Double.parseDouble(p[1].trim());
            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
            return new double[] {lat, lon};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Douglas-Peucker: índices dos pontos que ficam (tolerância em metros). */
    static List<double[]> simplify(double[] lat, double[] lon, int from, int to, double tol) {
        List<double[]> out = new ArrayList<>();
        if (to - from < 1) {
            if (to >= from) out.add(new double[] {lat[from], lon[from]});
            return out;
        }
        boolean[] keep = new boolean[to - from + 1];
        keep[0] = true;
        keep[keep.length - 1] = true;
        dp(lat, lon, from, to, tol, keep, from);
        for (int i = from; i <= to; i++) if (keep[i - from]) out.add(new double[] {lat[i], lon[i]});
        return out;
    }

    private static void dp(double[] lat, double[] lon, int a, int b, double tol, boolean[] keep, int base) {
        // pilha em vez de recursão (rota de 5 mil pontos não estoura)
        int[] stack = new int[2 * (b - a + 2)];
        int sp = 0;
        stack[sp++] = a;
        stack[sp++] = b;
        while (sp > 0) {
            int j = stack[--sp];
            int i = stack[--sp];
            if (j - i < 2) continue;
            double[] B = enu(lat[i], lon[i], lat[j], lon[j]);
            double len2 = B[0] * B[0] + B[1] * B[1];
            double best = -1;
            int bestK = -1;
            for (int k = i + 1; k < j; k++) {
                double[] P = enu(lat[i], lon[i], lat[k], lon[k]);
                double d;
                if (len2 < 1e-6) {
                    d = Math.hypot(P[0], P[1]);
                } else {
                    double t = Math.max(0, Math.min(1, (P[0] * B[0] + P[1] * B[1]) / len2));
                    d = Math.hypot(P[0] - t * B[0], P[1] - t * B[1]);
                }
                if (d > best) {
                    best = d;
                    bestK = k;
                }
            }
            if (best > tol && bestK > 0) {
                keep[bestK - base] = true;
                stack[sp++] = i;
                stack[sp++] = bestK;
                stack[sp++] = bestK;
                stack[sp++] = j;
            }
        }
    }

    /** Polyline do Google (precisão 5), formato aceito pelo Mapbox Static. */
    static String encodePolyline(List<double[]> pts) {
        StringBuilder sb = new StringBuilder();
        long pLat = 0, pLon = 0;
        for (double[] p : pts) {
            long la = Math.round(p[0] * 1e5), lo = Math.round(p[1] * 1e5);
            enc(la - pLat, sb);
            enc(lo - pLon, sb);
            pLat = la;
            pLon = lo;
        }
        return sb.toString();
    }

    private static void enc(long v, StringBuilder sb) {
        v = v < 0 ? ~(v << 1) : v << 1;
        while (v >= 0x20) {
            sb.append((char) ((0x20 | (v & 0x1f)) + 63));
            v >>= 5;
        }
        sb.append((char) (v + 63));
    }

    /** "350 m", "1,2 km", "12 km" pra tela. */
    static String fmtDistance(double m) {
        if (m < 0) return "";
        if (m < 1000) return Math.round(m / 10.0) * 10 + " m";
        if (m < 10000) return String.format(BR, "%.1f km", m / 1000);
        return Math.round(m / 1000) + " km";
    }

    /** "400 metros", "1 quilômetro", "1,5 quilômetro" pra voz. */
    static String spokenDistance(double m) {
        if (m < 1000) {
            long r = m < 200 ? Math.round(m / 10.0) * 10 : Math.round(m / 50.0) * 50;
            return r + " metros";
        }
        double km = Math.round(m / 100.0) / 10.0;
        if (km == Math.floor(km)) return ((long) km) + (km == 1 ? " quilômetro" : " quilômetros");
        return String.format(BR, km < 2 ? "%.1f quilômetro" : "%.1f quilômetros", km);
    }

    /** "12 min", "1 h 05". */
    static String fmtDuration(long sec) {
        long min = Math.max(0, Math.round(sec / 60.0));
        if (min < 60) return min + " min";
        return String.format(BR, "%d h %02d", min / 60, min % 60);
    }
}
