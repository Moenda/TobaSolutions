package br.com.toba.auto;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Preferências do Android Auto (SharedPreferences "toba_auto"). Nada aqui é dado do
 * site: o TOBA_DRIVE_DB continua só no WebView. Guarda recentes, mudo, as chaves
 * públicas lidas do site e um diário das viagens feitas no carro.
 */
final class AutoStore {
    private AutoStore() {}

    private static final String PREFS = "toba_auto";
    private static final String KEY_RECENT = "recent";
    private static final String KEY_TRIPS = "trips";
    private static final int RECENT_MAX = 12;
    private static final int TRIPS_MAX = 200;
    private static final Object LOCK = new Object();

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static List<Place> recents(Context c) {
        List<Place> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(KEY_RECENT, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                Place p = Place.fromJson(arr.optJSONObject(i));
                if (p != null) out.add(p);
            }
        } catch (Exception ignored) {
            // lista quebrada: começa vazia (é só conveniência)
        }
        return out;
    }

    static void addRecent(Context c, Place place) {
        synchronized (LOCK) {
            List<Place> list = recents(c);
            JSONArray arr = new JSONArray();
            try {
                arr.put(place.toJson());
                for (Place p : list) {
                    if (arr.length() >= RECENT_MAX) break;
                    if (!p.same(place)) arr.put(p.toJson());
                }
            } catch (Exception ignored) {
                return;
            }
            prefs(c).edit().putString(KEY_RECENT, arr.toString()).apply();
        }
    }

    /**
     * v2.02: modos de áudio do carro (pedido do Rafa). 0 = 🔊 Tudo, 1 = ⚠️ Só alertas
     * (radar, piadas do Cloba e a chegada; sem as manobras), 2 = 🔇 Silêncio total.
     * Quem tinha o 🔇 antigo ligado começa no Silêncio.
     */
    static final int AUDIO_ALL = 0, AUDIO_ALERTS = 1, AUDIO_OFF = 2;

    static int audioMode(Context c) {
        SharedPreferences p = prefs(c);
        if (p.contains("audio")) return Math.floorMod(p.getInt("audio", AUDIO_ALL), 3);
        return p.getBoolean("muted", false) ? AUDIO_OFF : AUDIO_ALL;
    }

    static void setAudioMode(Context c, int mode) {
        int m = Math.floorMod(mode, 3);
        prefs(c).edit().putInt("audio", m).putBoolean("muted", m == AUDIO_OFF).apply();
    }

    static boolean muted(Context c) {
        return audioMode(c) == AUDIO_OFF;
    }

    /** v1.78: mapa do carro em 3D (padrão) ou 2D. */
    static boolean map3d(Context c) {
        return prefs(c).getBoolean("map3d", true);
    }

    static void setMap3d(Context c, boolean on) {
        prefs(c).edit().putBoolean("map3d", on).apply();
    }

    /** v1.78: skin do mapa do carro (índice em WebMap.SKINS; o site sabe o nome). */
    static int skin(Context c) {
        return prefs(c).getInt("skin", 0);
    }

    static void setSkin(Context c, int skin) {
        prefs(c).edit().putInt("skin", skin).apply();
    }

    /**
     * v1.80: ⭐ favoritos do 🧭 Toba Drive do site (cópia que o site manda pela ponte,
     * TobaNative.autoFavorites). Quem manda é o site: aqui só lê. Formato do site:
     * [{name, emoji, address, lat, lng}].
     */
    static JSONArray favorites(Context c) {
        try {
            return new JSONArray(prefs(c).getString("favs", "[]"));
        } catch (org.json.JSONException e) {
            return new JSONArray();
        }
    }

    static boolean setFavorites(Context c, String json) {
        try {
            JSONArray in = new JSONArray(json == null ? "[]" : json);
            JSONArray out = new JSONArray();
            for (int i = 0; i < in.length() && out.length() < 100; i++) {
                JSONObject o = in.optJSONObject(i);
                if (o == null) continue;
                double lat = o.optDouble("lat", Double.NaN);
                double lng = o.optDouble("lng", Double.NaN);
                if (Double.isNaN(lat) || Double.isNaN(lng)) continue;
                out.put(new JSONObject()
                        .put("name", o.optString("name", "Favorito"))
                        .put("emoji", o.optString("emoji", "⭐"))
                        .put("address", o.optString("address", ""))
                        .put("lat", lat)
                        .put("lng", lng));
            }
            prefs(c).edit().putString("favs", out.toString()).apply();
            return true;
        } catch (org.json.JSONException e) {
            return false;
        }
    }

    /**
     * Diário das viagens do carro ({at, end, km, dest, ...}); o site importa pro TOBA_DRIVE_DB.
     * v2.02: sim = true quando foi o botão Simular (teste no DHU): o site não conta.
     */
    /** v2.03: viagem do diário que pode continuar (mesmo começo e os km que já rodou). */
    static final class Resume {
        final long at;
        final double meters;

        Resume(long at, double meters) {
            this.at = at;
            this.meters = meters;
        }
    }

    static final long RESUME_MS = 15 * 60 * 1000L;
    static final double RESUME_M = 250;

    /**
     * v2.03: começou rota pro MESMO destino (até 250 m) em até 15 min depois da última viagem
     * terminar SEM chegar? Devolve o começo e os km dela: o motor segue a mesma viagem e, no
     * fim, o logTrip grava POR CIMA dela (mesmo "at"; o site atualiza a que já importou em vez
     * de criar outra). Viagem do Simular ou que chegou não volta.
     */
    static Resume takeResume(Context c, Place dest) {
        if (dest == null) return null;
        synchronized (LOCK) {
            try {
                JSONArray arr = new JSONArray(prefs(c).getString(KEY_TRIPS, "[]"));
                if (arr.length() == 0) return null;
                int i = arr.length() - 1;
                JSONObject t = arr.optJSONObject(i);
                if (t == null || t.optBoolean("arrived") || t.optBoolean("sim")) return null;
                long end = t.optLong("end", 0);
                long now = System.currentTimeMillis();
                if (end <= 0 || now - end > RESUME_MS || now < end) return null;
                double lat = t.optDouble("lat", 0), lon = t.optDouble("lon", 0);
                if ((lat == 0 && lon == 0) || Geo.distance(lat, lon, dest.lat, dest.lon) > RESUME_M) return null;
                long at = t.optLong("at", 0);
                if (at <= 0) return null;
                // não apaga nada agora: se o app cair no meio, o pedaço que já tinha fica no diário
                return new Resume(at, t.optDouble("km", 0) * 1000.0);
            } catch (Exception e) {
                return null;
            }
        }
    }

    static void logTrip(Context c, Place dest, double meters, long startedAt, boolean arrived, boolean sim) {
        if (meters < 200) return;
        synchronized (LOCK) {
            try {
                JSONArray arr = new JSONArray(prefs(c).getString(KEY_TRIPS, "[]"));
                // v2.03: viagem que continuou (takeResume) grava por cima da mesma (mesmo "at")
                for (int i = arr.length() - 1; i >= 0; i--) {
                    JSONObject o = arr.optJSONObject(i);
                    if (o != null && o.optLong("at", -1) == startedAt) arr.remove(i);
                }
                arr.put(new JSONObject()
                        .put("at", startedAt)
                        .put("end", System.currentTimeMillis())
                        .put("km", Math.round(meters / 100.0) / 10.0)
                        .put("dest", dest == null ? "" : dest.name)
                        .put("lat", dest == null ? 0 : dest.lat)
                        .put("lon", dest == null ? 0 : dest.lon)
                        .put("arrived", arrived)
                        .put("sim", sim)
                        .put("source", "auto"));
                while (arr.length() > TRIPS_MAX) arr.remove(0);
                prefs(c).edit().putString(KEY_TRIPS, arr.toString()).apply();
            } catch (Exception ignored) {
                // diário é extra: se der ruim, a navegação segue
            }
        }
    }
}
