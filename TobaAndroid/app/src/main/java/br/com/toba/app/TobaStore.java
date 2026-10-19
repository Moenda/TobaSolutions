package br.com.toba.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Tudo o que a parte nativa guarda, em SharedPreferences. O banco do Toba
 * continua no site (localStorage); aqui só ficam:
 * - pending_purchases: compras lidas das notificações esperando o Gastos lançar
 * - purchase_log: últimas notificações com "R$" (para conferir o que foi lido)
 * - extra_apps: apps que o usuário mandou ler além da lista padrão
 * - reminders: lembretes { id: { title, message, times, days, url } }
 * - rest: fim do descanso agendado { endsAt, title, body }
 */
final class TobaStore {
    private static final String PREFS = "toba_native";
    static final String KEY_PENDING = "pending_purchases";
    static final String KEY_LOG = "purchase_log";
    static final String KEY_APPS = "extra_apps";
    static final String KEY_REMINDERS = "reminders";
    static final String KEY_REMINDER_CODES = "reminder_codes";
    static final String KEY_REST = "rest";
    private static final int LOG_MAX = 25;
    private static final Object LOCK = new Object();

    private TobaStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray getArray(Context c, String key) {
        try {
            return new JSONArray(prefs(c).getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static JSONObject getObject(Context c, String key) {
        try {
            return new JSONObject(prefs(c).getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static void put(Context c, String key, String value) {
        prefs(c).edit().putString(key, value).commit();
    }

    static void addPending(Context c, JSONObject purchase) {
        synchronized (LOCK) {
            JSONArray list = getArray(c, KEY_PENDING);
            list.put(purchase);
            put(c, KEY_PENDING, list.toString());
        }
    }

    // Só sai da fila o que o site confirmou que gravou no banco.
    static void ackPending(Context c, JSONArray ids) {
        synchronized (LOCK) {
            Set<String> done = new HashSet<>();
            for (int i = 0; i < ids.length(); i++) done.add(ids.optString(i));
            JSONArray list = getArray(c, KEY_PENDING);
            JSONArray keep = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.optJSONObject(i);
                if (item != null && !done.contains(item.optString("id"))) keep.put(item);
            }
            put(c, KEY_PENDING, keep.toString());
        }
    }

    static void addLog(Context c, JSONObject entry) {
        synchronized (LOCK) {
            JSONArray old = getArray(c, KEY_LOG);
            JSONArray out = new JSONArray();
            out.put(entry);
            for (int i = 0; i < old.length() && out.length() < LOG_MAX; i++) out.put(old.opt(i));
            put(c, KEY_LOG, out.toString());
        }
    }

    // A mesma notificação costuma ser postada de novo (atualização): não conta duas vezes.
    static boolean isRecentDuplicate(Context c, String pkg, String raw, long at) {
        JSONArray log = getArray(c, KEY_LOG);
        for (int i = 0; i < log.length(); i++) {
            JSONObject e = log.optJSONObject(i);
            if (e == null) continue;
            if (pkg.equals(e.optString("pkg")) && raw.equals(e.optString("raw"))
                    && Math.abs(at - e.optLong("at")) < 10 * 60 * 1000L) return true;
        }
        return false;
    }

    // Carteira + banco avisando a mesma compra: mesmo valor em poucos minutos.
    static boolean hasSameAmountRecently(Context c, double amount, long at, long windowMs) {
        JSONArray log = getArray(c, KEY_LOG);
        for (int i = 0; i < log.length(); i++) {
            JSONObject e = log.optJSONObject(i);
            if (e == null || !"detectada".equals(e.optString("status"))) continue;
            if (Math.abs(e.optDouble("amount", -1) - amount) < 0.005
                    && Math.abs(at - e.optLong("at")) < windowMs) return true;
        }
        return false;
    }

    static boolean isExtraApp(Context c, String pkg) {
        JSONArray apps = getArray(c, KEY_APPS);
        for (int i = 0; i < apps.length(); i++) if (pkg.equals(apps.optString(i))) return true;
        return false;
    }

    static void addExtraApp(Context c, String pkg) {
        synchronized (LOCK) {
            if (pkg == null || pkg.isEmpty() || isExtraApp(c, pkg)) return;
            JSONArray apps = getArray(c, KEY_APPS);
            apps.put(pkg);
            put(c, KEY_APPS, apps.toString());
        }
    }
}
