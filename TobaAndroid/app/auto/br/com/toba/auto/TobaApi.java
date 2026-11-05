package br.com.toba.auto;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.location.Location;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import br.com.toba.app.BuildConfig;

/**
 * Internet do Android Auto: chaves, busca (TomTom Search), rota (TomTom Routing,
 * a mesma do Toba Drive do site) e imagem do mapa (Mapbox Static Images).
 *
 * As chaves NÃO moram no APK: são lidas do próprio site (assets/toba-maps.js,
 * TOBA_TOMTOM_KEY e TOBA_MAPBOX_TOKEN) e guardadas no aparelho. Trocou a chave no
 * site? O carro pega sozinho em até 12 h (ou na hora, se a velha for recusada).
 * Todo pedido manda Referer/Origin do site, pra chave limitada ao domínio
 * moenda.github.io continuar aceitando.
 */
final class TobaApi {
    private TobaApi() {}

    static final String SITE = BuildConfig.START_URL; // https://moenda.github.io/TobaSolutions/
    static final String ORIGIN = "https://" + BuildConfig.SITE_HOST;
    private static final long KEYS_MAX_AGE = 12L * 3600 * 1000;
    private static final int ROUTES_PER_DAY = 300;

    /** Erro HTTP com o código (401/403 = chave recusada). */
    static final class HttpError extends IOException {
        final int code;

        HttpError(int code, String msg) {
            super("HTTP " + code + (msg == null || msg.isEmpty() ? "" : ": " + msg));
            this.code = code;
        }
    }

    static String friendly(Exception e) {
        if (e instanceof UnknownHostException) return "sem internet";
        if (e instanceof SocketTimeoutException) return "internet lenta demais";
        if (e instanceof HttpError) {
            int c = ((HttpError) e).code;
            if (c == 401 || c == 403) return "chave recusada (" + c + ")";
            if (c == 429) return "cota do dia acabou (429)";
            return "servidor respondeu " + c;
        }
        String m = e.getMessage();
        return m == null ? e.getClass().getSimpleName() : m;
    }

    /* ------------------------------------------------------------ HTTP */

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(10000);
        con.setReadTimeout(15000);
        con.setRequestProperty("Referer", SITE);
        con.setRequestProperty("Origin", ORIGIN);
        con.setRequestProperty("User-Agent", "TobaApp/" + BuildConfig.VERSION_NAME + " (Android Auto)");
        return con;
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static byte[] get(String url) throws IOException {
        HttpURLConnection con = open(url);
        try {
            int code = con.getResponseCode();
            if (code >= 400) {
                String body = "";
                try (InputStream err = con.getErrorStream()) {
                    if (err != null) body = new String(readAll(err), StandardCharsets.UTF_8);
                } catch (IOException ignored) {
                    // sem corpo
                }
                if (body.length() > 160) body = body.substring(0, 160);
                throw new HttpError(code, body);
            }
            try (InputStream in = con.getInputStream()) {
                return readAll(in);
            }
        } finally {
            con.disconnect();
        }
    }

    static String getText(String url) throws IOException {
        return new String(get(url), StandardCharsets.UTF_8);
    }

    static Bitmap getBitmap(String url) throws IOException {
        byte[] bytes = get(url);
        Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bmp == null) throw new IOException("imagem do mapa veio quebrada");
        return bmp;
    }

    static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return s;
        }
    }

    static String ll(double lat, double lon) {
        return String.format(Locale.US, "%.6f,%.6f", lat, lon);
    }

    /* ------------------------------------------------------------ chaves */

    private static final Pattern TOMTOM = Pattern.compile("TOBA_TOMTOM_KEY\\s*=\\s*[\"']([^\"']+)[\"']");
    private static final Pattern MAPBOX = Pattern.compile("TOBA_MAPBOX_TOKEN\\s*=\\s*[\"']([^\"']+)[\"']");

    /** Lê as chaves do site se não tiver ou se forem velhas. Chamar fora da main thread. */
    static synchronized void ensureKeys(Context c, boolean force) throws IOException {
        SharedPreferences p = AutoStore.prefs(c);
        long at = p.getLong("keys_at", 0);
        boolean have = !p.getString("tomtom", "").isEmpty() && !p.getString("mapbox", "").isEmpty();
        if (have && !force && System.currentTimeMillis() - at < KEYS_MAX_AGE) return;
        try {
            String js = getText(SITE + "assets/toba-maps.js?auto=" + (System.currentTimeMillis() / 3600000));
            Matcher t = TOMTOM.matcher(js);
            Matcher m = MAPBOX.matcher(js);
            SharedPreferences.Editor ed = p.edit().putLong("keys_at", System.currentTimeMillis());
            if (t.find()) ed.putString("tomtom", t.group(1));
            if (m.find()) ed.putString("mapbox", m.group(1));
            ed.apply();
        } catch (IOException e) {
            if (!have) throw e; // sem internet mas com chave guardada: segue com a guardada
        }
    }

    static String tomtomKey(Context c) throws IOException {
        ensureKeys(c, false);
        String k = AutoStore.prefs(c).getString("tomtom", "");
        if (k.isEmpty()) throw new IOException("não achei a chave do TomTom no site");
        return k;
    }

    static String mapboxToken(Context c) throws IOException {
        ensureKeys(c, false);
        String k = AutoStore.prefs(c).getString("mapbox", "");
        if (k.isEmpty()) throw new IOException("não achei o token do Mapbox no site");
        return k;
    }

    /** Chave recusada? Relê do site uma vez (o Rafa pode ter trocado). */
    static boolean refreshAfterRefusal(Context c, IOException e) {
        if (!(e instanceof HttpError)) return false;
        int code = ((HttpError) e).code;
        if (code != 401 && code != 403) return false;
        try {
            ensureKeys(c, true);
            return true;
        } catch (IOException ignored) {
            return false;
        }
    }

    /* ------------------------------------------------------------ busca */

    static List<Place> search(Context c, String query, Location near, boolean typeahead) throws IOException {
        try {
            return searchOnce(c, query, near, typeahead);
        } catch (IOException e) {
            if (refreshAfterRefusal(c, e)) return searchOnce(c, query, near, typeahead);
            throw e;
        }
    }

    private static List<Place> searchOnce(Context c, String query, Location near, boolean typeahead) throws IOException {
        StringBuilder url = new StringBuilder("https://api.tomtom.com/search/2/search/")
                .append(enc(query.trim())).append(".json?key=").append(tomtomKey(c))
                .append("&language=pt-BR&countrySet=BR&limit=6&typeahead=").append(typeahead);
        if (near != null) {
            url.append(String.format(Locale.US, "&lat=%.6f&lon=%.6f", near.getLatitude(), near.getLongitude()));
        }
        JSONObject json;
        try {
            json = new JSONObject(getText(url.toString()));
        } catch (org.json.JSONException e) {
            throw new IOException("resposta estranha da busca");
        }
        JSONArray results = json.optJSONArray("results");
        List<Place> out = new ArrayList<>();
        if (results == null) return out;
        for (int i = 0; i < results.length(); i++) {
            JSONObject r = results.optJSONObject(i);
            if (r == null) continue;
            JSONObject pos = r.optJSONObject("position");
            if (pos == null) continue;
            JSONObject addr = r.optJSONObject("address");
            JSONObject poi = r.optJSONObject("poi");
            String free = addr == null ? "" : addr.optString("freeformAddress");
            String name = poi != null ? poi.optString("name") : "";
            if (name.isEmpty() && addr != null) {
                String street = addr.optString("streetName");
                String num = addr.optString("streetNumber");
                name = street.isEmpty() ? free : street + (num.isEmpty() ? "" : ", " + num);
            }
            Place p = new Place(name, free, pos.optDouble("lat"), pos.optDouble("lon"));
            if (r.has("dist")) p.dist = r.optDouble("dist", -1);
            else if (near != null) p.dist = Geo.distance(near.getLatitude(), near.getLongitude(), p.lat, p.lon);
            out.add(p);
        }
        return out;
    }

    /* ------------------------------------------------------------ rota */

    static Route route(Context c, Location from, Place to) throws IOException {
        return routes(c, from, to, 0).get(0);
    }

    /** v1.80: rota + até {@code alternatives} caminhos diferentes (prévia). Conta 1 na trava do dia. */
    static List<Route> routes(Context c, Location from, Place to, int alternatives) throws IOException {
        SharedPreferences p = AutoStore.prefs(c);
        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new java.util.Date());
        int count = today.equals(p.getString("routes_day", "")) ? p.getInt("routes_n", 0) : 0;
        if (count >= ROUTES_PER_DAY) throw new IOException("já foram " + ROUTES_PER_DAY + " rotas hoje (trava da cota grátis)");
        p.edit().putString("routes_day", today).putInt("routes_n", count + 1).apply();
        try {
            return routeOnce(c, from, to, alternatives);
        } catch (IOException e) {
            if (refreshAfterRefusal(c, e)) return routeOnce(c, from, to, alternatives);
            throw e;
        }
    }

    private static List<Route> routeOnce(Context c, Location from, Place to, int alternatives) throws IOException {
        try {
            return routeOnce(c, from, to, alternatives, true);
        } catch (HttpError e) {
            // v1.78: TomTom não gostou do sectionType=speedLimit/lanes? vai sem limite e sem faixas
            if (e.code == 400) return routeOnce(c, from, to, alternatives, false);
            throw e;
        }
    }

    private static List<Route> routeOnce(Context c, Location from, Place to, int alternatives, boolean limits)
            throws IOException {
        StringBuilder url = new StringBuilder("https://api.tomtom.com/routing/1/calculateRoute/")
                .append(ll(from.getLatitude(), from.getLongitude())).append(':').append(ll(to.lat, to.lon))
                .append("/json?key=").append(tomtomKey(c))
                .append("&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all")
                .append("&instructionsType=text&language=pt-BR&sectionType=traffic");
        if (limits) url.append("&sectionType=speedLimit&sectionType=lanes"); // v1.80: + faixas
        if (alternatives > 0) url.append("&maxAlternatives=").append(Math.min(5, alternatives));
        if (from.hasBearing() && from.getSpeed() > 2) {
            url.append("&vehicleHeading=").append(Math.round(from.getBearing()) % 360);
        }
        try {
            return Route.parseAll(new JSONObject(getText(url.toString())), to);
        } catch (org.json.JSONException e) {
            throw new IOException("resposta estranha da rota");
        }
    }

    /* ------------------------------------------------------------ limite da rua */

    /** v1.80: trava diária das consultas de limite (sobra cota grátis pras rotas e buscas). */
    static final int LIMITS_PER_DAY = 1200;

    /** v1.80: rua onde o carro tá: limite (km/h, 0 = não sei) e nome. */
    static final class RoadInfo {
        final int kmh;
        final String street;

        RoadInfo(int kmh, String street) {
            this.kmh = kmh;
            this.street = street == null ? "" : street;
        }
    }

    /**
     * v1.80: velocidade máxima e nome da rua onde o carro tá (TomTom Reverse Geocode com
     * returnSpeedLimit). null = acabou a trava do dia.
     */
    static RoadInfo speedLimitAt(Context c, double lat, double lon, float heading) throws IOException {
        SharedPreferences p = AutoStore.prefs(c);
        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new java.util.Date());
        int count = today.equals(p.getString("limits_day", "")) ? p.getInt("limits_n", 0) : 0;
        if (count >= LIMITS_PER_DAY) return null;
        p.edit().putString("limits_day", today).putInt("limits_n", count + 1).apply();
        try {
            return speedLimitOnce(c, lat, lon, heading);
        } catch (IOException e) {
            if (refreshAfterRefusal(c, e)) return speedLimitOnce(c, lat, lon, heading);
            throw e;
        }
    }

    private static RoadInfo speedLimitOnce(Context c, double lat, double lon, float heading) throws IOException {
        StringBuilder url = new StringBuilder("https://api.tomtom.com/search/2/reverseGeocode/")
                .append(ll(lat, lon)).append(".json?key=").append(tomtomKey(c))
                .append("&returnSpeedLimit=true&radius=40&language=pt-BR");
        if (!Float.isNaN(heading)) url.append("&heading=").append(Math.round(heading) % 360);
        try {
            JSONObject json = new JSONObject(getText(url.toString()));
            org.json.JSONArray list = json.optJSONArray("addresses");
            JSONObject first = list == null || list.length() == 0 ? null : list.optJSONObject(0);
            JSONObject addr = first == null ? null : first.optJSONObject("address");
            String raw = addr == null ? "" : addr.optString("speedLimit", "");
            String street = addr == null ? "" : addr.optString("streetName", "");
            return new RoadInfo(parseLimit(raw), street);
        } catch (org.json.JSONException e) {
            throw new IOException("resposta estranha do limite da rua");
        }
    }

    /** "50.00KPH" -> 50; "30.00MPH" -> 48. Lixo -> 0. */
    static int parseLimit(String raw) {
        if (raw == null) return 0;
        String t = raw.trim().toUpperCase(Locale.US);
        Matcher m = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)").matcher(t);
        if (!m.find()) return 0;
        double v = Double.parseDouble(m.group(1));
        if (t.contains("MPH")) v *= 1.609344;
        int kmh = (int) Math.round(v);
        return kmh > 0 && kmh < 200 ? kmh : 0;
    }

    /* ------------------------------------------------------------ mapa */

    static String mapboxStatic(Context c, String style, String overlay, String position, int w, int h, String extra)
            throws IOException {
        return "https://api.mapbox.com/styles/v1/mapbox/" + style + "/static/"
                + (overlay == null || overlay.isEmpty() ? "" : overlay + "/")
                + position + "/" + w + "x" + h + "@2x?attribution=false&logo=false"
                + (extra == null ? "" : extra) + "&access_token=" + mapboxToken(c);
    }
}
