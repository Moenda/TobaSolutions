package br.com.toba.auto;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Rota do TomTom já mastigada: pontos, distância acumulada e as manobras faladas. */
final class Route {
    static final class Instr {
        double offset;      // metros desde o começo da rota
        String maneuver;    // código do TomTom (TURN_RIGHT, ROUNDABOUT_RIGHT, ARRIVE...)
        String message;     // frase pronta em pt-BR ("Vire à direita na Rua Augusta")
        String street;
        int exit;           // saída da rotatória (0 = não sei)
        double lat, lon;
    }

    final double[] lat;
    final double[] lon;
    final double[] cum;     // metros acumulados até cada ponto
    final double length;
    final long time;        // segundos com trânsito
    final long delay;       // segundos a mais por causa do trânsito
    final List<Instr> instr;
    final Place dest;
    final long createdAt = System.currentTimeMillis();
    /** v1.78: trechos parados do TomTom {ponto inicial, ponto final, 1 lento / 2 pesado / 3 parado}. */
    final List<int[]> jams = new ArrayList<>();
    /** v1.78: velocidade máxima da rua {ponto inicial, ponto final, km/h} (sectionType=speedLimit). */
    final List<int[]> limits = new ArrayList<>();

    private Route(double[] lat, double[] lon, long time, long delay, List<Instr> instr, Place dest) {
        this.lat = lat;
        this.lon = lon;
        this.cum = new double[lat.length];
        for (int i = 1; i < lat.length; i++) {
            cum[i] = cum[i - 1] + Geo.distance(lat[i - 1], lon[i - 1], lat[i], lon[i]);
        }
        this.length = lat.length == 0 ? 0 : cum[lat.length - 1];
        this.time = time;
        this.delay = delay;
        this.instr = instr;
        this.dest = dest;
    }

    int size() {
        return lat.length;
    }

    /** v1.78: limite da rua no trecho seg (km/h), 0 = não sei. */
    int limitAt(int seg) {
        for (int[] l : limits) {
            if (seg >= l[0] && seg < Math.max(l[1], l[0] + 1)) return l[2];
        }
        return 0;
    }

    private void readSections(JSONArray sections) {
        if (sections == null) return;
        int last = lat.length - 1;
        for (int i = 0; i < sections.length(); i++) {
            JSONObject s = sections.optJSONObject(i);
            if (s == null) continue;
            int a = Math.max(0, Math.min(last, s.optInt("startPointIndex", 0)));
            int b = Math.max(a, Math.min(last, s.optInt("endPointIndex", a)));
            String type = s.optString("sectionType", "");
            if ("TRAFFIC".equals(type)) {
                int mag = s.optInt("magnitudeOfDelay", 0);
                String cat = s.optString("simpleCategory", "");
                int lvl = "ROAD_CLOSURE".equals(cat) || mag >= 3 ? 3 : mag == 2 ? 2 : 1;
                if (b > a) jams.add(new int[] {a, b, lvl});
            } else if ("SPEED_LIMIT".equals(type)) {
                int kmh = (int) Math.round(s.optDouble("maxSpeedLimitInKmh", 0));
                if (kmh > 0 && kmh < 200) limits.add(new int[] {a, b, kmh});
            }
        }
    }

    static Route parse(JSONObject json, Place dest) throws IOException {
        JSONArray routes = json.optJSONArray("routes");
        if (routes == null || routes.length() == 0) throw new IOException("o TomTom não achou caminho");
        JSONObject r = routes.optJSONObject(0);
        JSONObject sum = r.optJSONObject("summary");
        long time = sum == null ? 0 : sum.optLong("travelTimeInSeconds");
        long delay = sum == null ? 0 : sum.optLong("trafficDelayInSeconds");
        if (sum != null && sum.has("noTrafficTravelTimeInSeconds")) {
            // mesma conta do Navegar do site: lentidão = com trânsito − sem trânsito
            delay = Math.max(delay, time - sum.optLong("noTrafficTravelTimeInSeconds"));
        }

        List<double[]> pts = new ArrayList<>();
        JSONArray legs = r.optJSONArray("legs");
        if (legs != null) {
            for (int l = 0; l < legs.length(); l++) {
                JSONObject leg = legs.optJSONObject(l);
                JSONArray points = leg == null ? null : leg.optJSONArray("points");
                if (points == null) continue;
                for (int i = 0; i < points.length(); i++) {
                    JSONObject p = points.optJSONObject(i);
                    if (p == null) continue;
                    if (l > 0 && i == 0 && !pts.isEmpty()) continue; // ponto repetido entre trechos
                    pts.add(new double[] {p.optDouble("latitude"), p.optDouble("longitude")});
                }
            }
        }
        if (pts.size() < 2) throw new IOException("rota sem pontos");
        double[] la = new double[pts.size()];
        double[] lo = new double[pts.size()];
        for (int i = 0; i < pts.size(); i++) {
            la[i] = pts.get(i)[0];
            lo[i] = pts.get(i)[1];
        }

        List<Instr> list = new ArrayList<>();
        JSONObject guidance = r.optJSONObject("guidance");
        JSONArray ins = guidance == null ? null : guidance.optJSONArray("instructions");
        if (ins != null) {
            for (int i = 0; i < ins.length(); i++) {
                JSONObject o = ins.optJSONObject(i);
                if (o == null) continue;
                Instr it = new Instr();
                it.offset = o.optDouble("routeOffsetInMeters", 0);
                it.maneuver = o.optString("maneuver", "STRAIGHT");
                it.message = o.optString("message", "");
                it.street = o.optString("street", "");
                it.exit = o.optInt("roundaboutExitNumber", 0);
                JSONObject pt = o.optJSONObject("point");
                if (pt != null) {
                    it.lat = pt.optDouble("latitude");
                    it.lon = pt.optDouble("longitude");
                }
                list.add(it);
            }
        }
        Route route = new Route(la, lo, time, delay, list, dest);
        route.readSections(r.optJSONArray("sections"));
        if (list.isEmpty() || !list.get(list.size() - 1).maneuver.startsWith("ARRIVE")) {
            Instr end = new Instr();
            end.offset = route.length;
            end.maneuver = "ARRIVE";
            end.message = "Você chegou ao destino";
            end.street = dest == null ? "" : dest.name;
            end.lat = la[la.length - 1];
            end.lon = lo[lo.length - 1];
            list.add(end);
        }
        return route;
    }
}
