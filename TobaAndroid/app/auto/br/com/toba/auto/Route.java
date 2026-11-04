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
