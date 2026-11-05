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
    /** v1.80: faixas do TomTom (sectionType=lanes): trecho + [{d:[direções], f:"seguir"}] em JSON. */
    final List<Lanes> lanes = new ArrayList<>();

    static final class Lanes {
        final int a, b;
        final String json;

        Lanes(int a, int b, String json) {
            this.a = a;
            this.b = b;
            this.json = json;
        }
    }

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
            } else if ("LANES".equals(type)) {
                String js = lanesJson(s.optJSONArray("lanes"));
                if (js != null) lanes.add(new Lanes(a, b, js));
            } else if ("SPEED_LIMIT".equals(type)) {
                int kmh = (int) Math.round(s.optDouble("maxSpeedLimitInKmh", 0));
                if (kmh > 0 && kmh < 200) limits.add(new int[] {a, b, kmh});
            }
        }
    }

    /** [{directions:[..], follow}] do TomTom -> [{"d":[..],"f":".."}] curtinho pro mapa. */
    private static String lanesJson(JSONArray in) {
        if (in == null || in.length() == 0 || in.length() > 12) return null;
        JSONArray out = new JSONArray();
        boolean anyFollow = false;
        for (int i = 0; i < in.length(); i++) {
            JSONObject l = in.optJSONObject(i);
            if (l == null) return null;
            JSONArray d = l.optJSONArray("directions");
            JSONObject o = new JSONObject();
            try {
                o.put("d", d == null ? new JSONArray().put("STRAIGHT") : d);
                String f = l.optString("follow", "");
                if (!f.isEmpty()) {
                    o.put("f", f);
                    anyFollow = true;
                }
            } catch (org.json.JSONException e) {
                return null;
            }
            out.put(o);
        }
        // só vale mostrar se tem faixa pra seguir e mais de uma faixa
        return anyFollow && out.length() > 1 ? out.toString() : null;
    }

    /** v1.80: faixas pra mostrar agora: o trecho que começa até {@code ahead} m na frente. */
    String lanesAhead(int seg, double along, double ahead) {
        for (Lanes l : lanes) {
            if (seg > l.b) continue;
            double start = cum[Math.min(l.a, cum.length - 1)];
            if (start - along > ahead) break;
            return l.json;
        }
        return null;
    }

    static Route parse(JSONObject json, Place dest) throws IOException {
        return parseAll(json, dest).get(0);
    }

    /** v1.80: a principal + as alternativas do TomTom (maxAlternatives), na ordem da resposta. */
    static List<Route> parseAll(JSONObject json, Place dest) throws IOException {
        JSONArray routes = json.optJSONArray("routes");
        if (routes == null || routes.length() == 0) throw new IOException("o TomTom não achou caminho");
        List<Route> out = new ArrayList<>();
        IOException first = null;
        for (int i = 0; i < routes.length(); i++) {
            JSONObject r = routes.optJSONObject(i);
            if (r == null) continue;
            try {
                out.add(parseOne(r, dest));
            } catch (IOException e) {
                if (first == null) first = e;
            }
        }
        if (out.isEmpty()) throw first != null ? first : new IOException("o TomTom não achou caminho");
        return out;
    }

    /**
     * v1.80: ruas por onde a rota mais anda (metros somados entre uma manobra e a próxima),
     * da mais comprida pra mais curta. Serve pro "via Av. 23 de Maio" da prévia.
     */
    List<String> mainStreets() {
        java.util.Map<String, Double> m = new java.util.LinkedHashMap<>();
        for (int i = 0; i < instr.size(); i++) {
            Instr it = instr.get(i);
            String st = it.street == null ? "" : it.street.trim();
            if (st.isEmpty() || it.maneuver.startsWith("ARRIVE")) continue;
            double end = i + 1 < instr.size() ? instr.get(i + 1).offset : length;
            double d = Math.max(0, end - it.offset);
            m.put(st, m.getOrDefault(st, 0.0) + d);
        }
        List<String> names = new ArrayList<>(m.keySet());
        names.sort((a, b) -> Double.compare(m.get(b), m.get(a)));
        return names;
    }

    private static Route parseOne(JSONObject r, Place dest) throws IOException {
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
