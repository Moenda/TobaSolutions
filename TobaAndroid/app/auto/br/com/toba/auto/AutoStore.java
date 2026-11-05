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

    static boolean muted(Context c) {
        return prefs(c).getBoolean("muted", false);
    }

    static void setMuted(Context c, boolean on) {
        prefs(c).edit().putBoolean("muted", on).apply();
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
     * v1.80: ⭐ favoritos do 🧭 Navegar do site (cópia que o site manda pela ponte,
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

    /** Diário das viagens do carro ({at, km, min, dest}); um dia o site importa pro TOBA_DRIVE_DB. */
    static void logTrip(Context c, Place dest, double meters, long startedAt, boolean arrived) {
        if (meters < 200) return;
        synchronized (LOCK) {
            try {
                JSONArray arr = new JSONArray(prefs(c).getString(KEY_TRIPS, "[]"));
                arr.put(new JSONObject()
                        .put("at", startedAt)
                        .put("end", System.currentTimeMillis())
                        .put("km", Math.round(meters / 100.0) / 10.0)
                        .put("dest", dest == null ? "" : dest.name)
                        .put("lat", dest == null ? 0 : dest.lat)
                        .put("lon", dest == null ? 0 : dest.lon)
                        .put("arrived", arrived)
                        .put("source", "auto"));
                while (arr.length() > TRIPS_MAX) arr.remove(0);
                prefs(c).edit().putString(KEY_TRIPS, arr.toString()).apply();
            } catch (Exception ignored) {
                // diário é extra: se der ruim, a navegação segue
            }
        }
    }
}
