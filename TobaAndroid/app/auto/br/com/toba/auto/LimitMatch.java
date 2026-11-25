package br.com.toba.auto;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * v2.13 (APK 3.4): limite de velocidade com 3 fontes, na ordem de quem manda:
 *  1. ✏ correção do Rafa (feita no 🧭 Toba Drive do celular, chega pela ponte autoTuning);
 *  2. TomTom (sectionType=speedLimit da rota), como era antes;
 *  3. OpenStreetMap (maxspeed das vias da rota, pelo Overpass): só onde a TomTom não sabe.
 * Mesma regra do driveBuildLimits do site (drive-metrics.js). Sem nada de Android: dá pra
 * testar no PC.
 */
final class LimitMatch {
    private LimitMatch() {}

    static final double OSM_NEAR_M = 15;   // rota do TomTom x via do OSM
    static final double OSM_SAME_DIR = 35; // graus
    static final double FIX_NEAR_M = 25;
    static final double FIX_SAME_DIR = 35;
    static final double FIX_SPREAD_M = 400;

    /** Uma via do OSM já mastigada. kmh = limite no sentido dos nós; back = no contrário. */
    static final class Way {
        long id;
        int kmh, back;
        int oneway; // 1 = só no sentido dos nós, -1 = só no contrário, 0 = mão dupla
        double[] lat, lon;
    }

    /** "60" -> 60; "60 km/h" -> 60; "40 mph" -> 64; "BR:urban", "none", "50;60" -> 0. */
    static int parseMaxspeed(String raw) {
        if (raw == null) return 0;
        String s = raw.trim().toLowerCase(Locale.US);
        if (!s.matches("^[0-9]+(\\.[0-9]+)?\\s*(km/h|kmh|kph|mph)?$")) return 0;
        double v = Double.parseDouble(s.replaceAll("[^0-9.]", ""));
        if (s.endsWith("mph")) v *= 1.609344;
        int k = (int) Math.round(v);
        return k >= 5 && k < 200 ? k : 0;
    }

    /** Resposta do Overpass (out tags geom) -> vias com geometria. */
    static List<Way> parseOverpass(String json) {
        List<Way> out = new ArrayList<>();
        JSONArray els;
        try {
            els = new JSONObject(json).optJSONArray("elements");
        } catch (org.json.JSONException e) {
            return out;
        }
        if (els == null) return out;
        for (int i = 0; i < els.length(); i++) {
            JSONObject el = els.optJSONObject(i);
            if (el == null || !"way".equals(el.optString("type"))) continue;
            JSONArray g = el.optJSONArray("geometry");
            if (g == null || g.length() < 2) continue;
            JSONObject tags = el.optJSONObject("tags");
            if (tags == null) tags = new JSONObject();
            Way w = new Way();
            w.id = el.optLong("id");
            int all = parseMaxspeed(tags.optString("maxspeed", null));
            int fwd = parseMaxspeed(tags.optString("maxspeed:forward", null));
            int bwd = parseMaxspeed(tags.optString("maxspeed:backward", null));
            w.kmh = fwd > 0 ? fwd : all;
            w.back = bwd > 0 ? bwd : all;
            String ow = tags.optString("oneway", "");
            String hw = tags.optString("highway", "");
            boolean round = "roundabout".equals(tags.optString("junction", ""));
            w.oneway = "-1".equals(ow) ? -1
                    : "yes".equals(ow) || "true".equals(ow) || "1".equals(ow) || round || ("motorway".equals(hw) && !"no".equals(ow)) ? 1 : 0;
            w.lat = new double[g.length()];
            w.lon = new double[g.length()];
            for (int k = 0; k < g.length(); k++) {
                JSONObject p = g.optJSONObject(k);
                w.lat[k] = p == null ? 0 : p.optDouble("lat", 0);
                w.lon[k] = p == null ? 0 : p.optDouble("lon", 0);
            }
            out.add(w);
        }
        return out;
    }

    /** Resultado do casamento: limite do OSM (0 = OSM não sabe) e id da via por trecho da rota. */
    static final class Osm {
        final int[] kmh;
        final long[] way;

        Osm(int n) {
            kmh = new int[n];
            way = new long[n];
        }
    }

    private static long cell(double lat, double lon) {
        long a = (long) Math.floor(lat / 0.002), b = (long) Math.floor(lon / 0.002);
        return a * 1000003L + b;
    }

    /**
     * Pra cada trecho da rota: o meio dele, a via do OSM mais perto (até 15 m) que corre no
     * MESMO sentido (até 35°; mão dupla vale no contrário também). Via sem maxspeed também
     * conta: se a mais perto não tem limite, o OSM "não sabe" e fica o do TomTom (assim a
     * marginal do lado com placa não rouba o limite da pista em que tu tá).
     */
    static Osm match(double[] lat, double[] lon, List<Way> ways) {
        int n = Math.max(0, lat.length - 1);
        Osm out = new Osm(n);
        if (n == 0 || ways == null || ways.isEmpty()) return out;
        Map<Long, List<int[]>> grid = new HashMap<>();
        for (int w = 0; w < ways.size(); w++) {
            Way way = ways.get(w);
            for (int k = 0; k < way.lat.length - 1; k++) {
                double la0 = Math.min(way.lat[k], way.lat[k + 1]), la1 = Math.max(way.lat[k], way.lat[k + 1]);
                double lo0 = Math.min(way.lon[k], way.lon[k + 1]), lo1 = Math.max(way.lon[k], way.lon[k + 1]);
                for (double a = Math.floor(la0 / 0.002) * 0.002; a <= la1 + 1e-9; a += 0.002) {
                    for (double b = Math.floor(lo0 / 0.002) * 0.002; b <= lo1 + 1e-9; b += 0.002) {
                        grid.computeIfAbsent(cell(a + 0.001, b + 0.001), x -> new ArrayList<>()).add(new int[] {w, k});
                    }
                }
            }
        }
        for (int i = 0; i < n; i++) {
            double mLat = (lat[i] + lat[i + 1]) / 2, mLon = (lon[i] + lon[i + 1]) / 2;
            if (Geo.distance(lat[i], lon[i], lat[i + 1], lon[i + 1]) < 0.5) continue;
            double head = Geo.bearing(lat[i], lon[i], lat[i + 1], lon[i + 1]);
            double bestD = OSM_NEAR_M;
            int bestKmh = 0;
            long bestWay = 0;
            boolean found = false;
            java.util.HashSet<Long> seen = new java.util.HashSet<>();
            for (int da = -1; da <= 1; da++) {
                for (int db = -1; db <= 1; db++) {
                    List<int[]> list = grid.get(cell(mLat + da * 0.002, mLon + db * 0.002));
                    if (list == null) continue;
                    for (int[] ref : list) {
                        long key = ((long) ref[0] << 20) | ref[1];
                        if (!seen.add(key)) continue;
                        Way w = ways.get(ref[0]);
                        int k = ref[1];
                        double[] b = Geo.enu(w.lat[k], w.lon[k], w.lat[k + 1], w.lon[k + 1]);
                        double[] p = Geo.enu(w.lat[k], w.lon[k], mLat, mLon);
                        double len2 = b[0] * b[0] + b[1] * b[1];
                        double t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (p[0] * b[0] + p[1] * b[1]) / len2));
                        double d = Math.hypot(p[0] - t * b[0], p[1] - t * b[1]);
                        if (d > bestD) continue;
                        double wh = Geo.bearing(w.lat[k], w.lon[k], w.lat[k + 1], w.lon[k + 1]);
                        double diff = Math.abs(Geo.angleDiff(wh, head));
                        int v;
                        if (diff <= OSM_SAME_DIR && w.oneway != -1) v = w.kmh;
                        else if (diff >= 180 - OSM_SAME_DIR && w.oneway != 1) v = w.back;
                        else continue;
                        bestD = d;
                        bestKmh = v;
                        bestWay = w.id;
                        found = true;
                    }
                }
            }
            if (found) {
                out.kmh[i] = bestKmh;
                out.way[i] = bestWay;
            }
        }
        return out;
    }

    /** ✏ correção: {lat, lng, head, kmh (-1 = "não sei", sem limite), way? (id do OSM)}. */
    static final class Fix {
        double lat, lng, head;
        int kmh;
        long way;
    }

    static List<Fix> parseFixes(String json) {
        List<Fix> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(json == null || json.isEmpty() ? "[]" : json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                Fix f = new Fix();
                f.lat = o.optDouble("lat", Double.NaN);
                f.lng = o.optDouble("lng", Double.NaN);
                f.head = o.optDouble("head", Double.NaN);
                f.kmh = o.optInt("kmh", 0);
                f.way = o.optLong("way", 0);
                if (Double.isNaN(f.lat) || Double.isNaN(f.lng) || Double.isNaN(f.head) || f.kmh == 0) continue;
                out.add(f);
            }
        } catch (org.json.JSONException ignored) {
            // sem correções
        }
        return out;
    }

    /**
     * Junta tudo num número por trecho da rota (0 = não sei).
     * @param tt  limite do TomTom por trecho (0 = TomTom não mandou)
     */
    static int[] combine(double[] lat, double[] lon, double[] cum, int[] tt, Osm osm, List<Fix> fixes) {
        int n = tt.length;
        int[] out = new int[n];
        for (int i = 0; i < n; i++) {
            int o = osm == null ? 0 : osm.kmh[i];
            out[i] = tt[i] > 0 ? tt[i] : o;
        }
        if (fixes == null || fixes.isEmpty() || n == 0) return out;
        double[] heads = new double[n];
        for (int i = 0; i < n; i++) heads[i] = Geo.bearing(lat[i], lon[i], lat[i + 1], lon[i + 1]);
        for (Fix f : fixes) {
            int val = f.kmh < 0 ? 0 : f.kmh;
            // 1) a via do OSM inteira, no mesmo sentido da correção
            boolean byWay = false;
            if (f.way != 0 && osm != null) {
                for (int i = 0; i < n; i++) {
                    if (osm.way[i] == f.way && Math.abs(Geo.angleDiff(heads[i], f.head)) <= 45) {
                        out[i] = val;
                        byWay = true;
                    }
                }
            }
            if (byWay) continue;
            // 2) sem via: o trecho da rota mais perto da correção (mesmo sentido) e o pedaço com
            // o mesmo limite do TomTom em volta dele (até 400 m pra cada lado)
            int seed = -1;
            double bestD = FIX_NEAR_M;
            for (int i = 0; i < n; i++) {
                if (Math.abs(Geo.angleDiff(heads[i], f.head)) > FIX_SAME_DIR) continue;
                double d = distToSeg(lat[i], lon[i], lat[i + 1], lon[i + 1], f.lat, f.lng);
                if (d < bestD) {
                    bestD = d;
                    seed = i;
                }
            }
            if (seed < 0) continue;
            int base = tt[seed];
            double at = cum[seed];
            out[seed] = val;
            for (int i = seed + 1; i < n && tt[i] == base && cum[i] - at <= FIX_SPREAD_M; i++) out[i] = val;
            for (int i = seed - 1; i >= 0 && tt[i] == base && at - cum[i + 1] <= FIX_SPREAD_M; i--) out[i] = val;
        }
        return out;
    }

    /** Correção mais perto de um ponto solto (sem rota), no mesmo sentido; null = nenhuma. */
    static Fix fixNear(List<Fix> fixes, double lat, double lon, double head) {
        if (fixes == null || Double.isNaN(head)) return null;
        Fix best = null;
        double bestD = 30;
        for (Fix f : fixes) {
            if (Math.abs(Geo.angleDiff(f.head, head)) > FIX_SAME_DIR) continue;
            double d = Geo.distance(lat, lon, f.lat, f.lng);
            if (d < bestD) {
                bestD = d;
                best = f;
            }
        }
        return best;
    }

    static double distToSeg(double aLat, double aLon, double bLat, double bLon, double pLat, double pLon) {
        double[] b = Geo.enu(aLat, aLon, bLat, bLon);
        double[] p = Geo.enu(aLat, aLon, pLat, pLon);
        double len2 = b[0] * b[0] + b[1] * b[1];
        double t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (p[0] * b[0] + p[1] * b[1]) / len2));
        return Math.hypot(p[0] - t * b[0], p[1] - t * b[1]);
    }

    /** Pontos da rota a cada ~120 m (máx. 500) pro "around" do Overpass. */
    static String overpassQuery(double[] lat, double[] lon, double[] cum) {
        int n = lat.length;
        double len = n == 0 ? 0 : cum[n - 1];
        double step = Math.max(120, len / 500);
        StringBuilder pts = new StringBuilder();
        double next = 0;
        for (int i = 0; i < n; i++) {
            if (cum[i] >= next || i == n - 1) {
                if (pts.length() > 0) pts.append(',');
                pts.append(String.format(Locale.US, "%.5f,%.5f", lat[i], lon[i]));
                next = cum[i] + step;
            }
        }
        return "[out:json][timeout:25];way[highway~\"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$\"](around:30,"
                + pts + ");out tags geom;";
    }
}
