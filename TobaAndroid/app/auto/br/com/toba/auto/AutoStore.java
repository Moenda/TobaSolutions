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

    /**
     * v2.13: ajustes que o 🧭 Toba Drive do site manda pela ponte autoTuning:
     * limitFixes = ✏ correções de limite [{lat, lng, head, kmh (-1 = sem limite), way?}];
     * etaFactor = 🧠 Fator Rafa (quanto tu costuma levar a mais/menos que a TomTom, 1 = igual).
     * Quem calcula é o site: aqui só guarda e lê.
     */
    static String limitFixes(Context c) {
        return prefs(c).getString("limit_fixes", "[]");
    }

    static double etaFactor(Context c) {
        double f = prefs(c).getFloat("eta_factor", 1f);
        return f >= 0.8 && f <= 1.5 ? f : 1.0;
    }

    static boolean setTuning(Context c, String json) {
        try {
            JSONObject in = new JSONObject(json == null || json.isEmpty() ? "{}" : json);
            SharedPreferences.Editor ed = prefs(c).edit();
            JSONArray fixes = in.optJSONArray("limitFixes");
            if (fixes != null && fixes.length() <= 500) ed.putString("limit_fixes", fixes.toString());
            double f = in.optDouble("etaFactor", 1);
            ed.putFloat("eta_factor", (float) (f >= 0.8 && f <= 1.5 ? f : 1.0));
            ed.apply();
            return true;
        } catch (org.json.JSONException e) {
            return false;
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
        /** v2.13: segundos com limite conhecido e acima do limite que a viagem já tinha. */
        double limitS, overS;

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
                Resume r = new Resume(at, t.optDouble("km", 0) * 1000.0);
                r.limitS = t.optDouble("limitS", 0);
                r.overS = t.optDouble("overS", 0);
                return r;
            } catch (Exception e) {
                return null;
            }
        }
    }

    /**
     * v2.13: limitS = segundos navegando com o limite da via conhecido; overS = segundos acima
     * do limite (só estouro de 4 s+ seguidos conta). O site vira isso no cleanSpeed das
     * conquistas 😇 Pé de anjo / 🧘 Motorista de comercial (antes o carro não mandava nada).
     * eta = previsão da TomTom no começo (segundos; 0 = viagem que continuou), pro 🧠 Fator Rafa.
     */
    static void logTrip(Context c, Place dest, double meters, long startedAt, boolean arrived, boolean sim,
                        double limitS, double overS, long etaS) {
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
                        .put("limitS", Math.round(limitS))
                        .put("overS", Math.round(overS))
                        .put("eta", etaS)
                        .put("source", "auto"));
                while (arr.length() > TRIPS_MAX) arr.remove(0);
                prefs(c).edit().putString(KEY_TRIPS, arr.toString()).apply();
            } catch (Exception ignored) {
                // diário é extra: se der ruim, a navegação segue
            }
        }
    }

    /* ---------------------------------------------------------------------
     * v2.14 (APK 3.5): 📍 Marcar pra conferir (botão estilo Waze no carro).
     * No carro só anota o lugar: {at, kind: "radar"|"limit"|"check", lat, lng, head, kmh
     * (velocidade do carro), limit (o que a placa do Toba mostrava, 0 = não sabia), street,
     * nav (tava com rota)}. A correção mesmo é no celular (🧭 Toba Drive › 📍 Marcados no
     * carro): o site lê pela ponte autoReports e tira os que já entraram (autoReportsDone).
     * ------------------------------------------------------------------- */
    private static final String KEY_REPORTS = "reports";
    private static final int REPORTS_MAX = 60;

    static void addReport(Context c, JSONObject report) {
        if (report == null) return;
        synchronized (LOCK) {
            try {
                JSONArray arr = new JSONArray(prefs(c).getString(KEY_REPORTS, "[]"));
                arr.put(report);
                while (arr.length() > REPORTS_MAX) arr.remove(0);
                prefs(c).edit().putString(KEY_REPORTS, arr.toString()).apply();
            } catch (Exception ignored) {
                // marcação é extra: se der ruim, a navegação segue
            }
        }
    }

    /** Troca o tipo de uma marcação que já foi gravada (mesmo "at"). */
    static void setReportKind(Context c, long at, String kind) {
        synchronized (LOCK) {
            try {
                JSONArray arr = new JSONArray(prefs(c).getString(KEY_REPORTS, "[]"));
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.optJSONObject(i);
                    if (o != null && o.optLong("at", -1) == at) o.put("kind", kind);
                }
                prefs(c).edit().putString(KEY_REPORTS, arr.toString()).apply();
            } catch (Exception ignored) {
                // fica o tipo de antes ("check"): o celular mostra as duas opções
            }
        }
    }

    static String reports(Context c) {
        synchronized (LOCK) {
            try {
                return new JSONArray(prefs(c).getString(KEY_REPORTS, "[]")).toString();
            } catch (org.json.JSONException e) {
                return "[]";
            }
        }
    }

    /** O site já guardou essas (lista de "at"): saem daqui. */
    static boolean reportsDone(Context c, String atsJson) {
        synchronized (LOCK) {
            try {
                JSONArray ats = new JSONArray(atsJson == null || atsJson.isEmpty() ? "[]" : atsJson);
                java.util.HashSet<Long> gone = new java.util.HashSet<>();
                for (int i = 0; i < ats.length(); i++) gone.add(ats.optLong(i, -1));
                JSONArray arr = new JSONArray(prefs(c).getString(KEY_REPORTS, "[]"));
                JSONArray keep = new JSONArray();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.optJSONObject(i);
                    if (o != null && !gone.contains(o.optLong("at", -1))) keep.put(o);
                }
                prefs(c).edit().putString(KEY_REPORTS, keep.toString()).apply();
                return true;
            } catch (org.json.JSONException e) {
                return false;
            }
        }
    }
}
