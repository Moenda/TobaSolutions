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
 * - purchase_seen: notificações de compra já lidas [{ k, at }] (APK 1.3): a
 *   mesma notificação reenviada não vira compra de novo (300 / 60 dias)
 * - extra_apps: apps que o usuário mandou ler além da lista padrão
 * - reminders: lembretes { id: { title, message, times, days, url } }
 * - rest: fim do descanso agendado { endsAt, title, body }
 * - workout: treino ao vivo em andamento { startedAt, title } (notificação fixa)
 * - task_alerts: avisos de tarefas do Toba Routine, de uma vez só
 *   [{ key, at, title, body, url, taskId, date }] (a lista inteira vem do site)
 * - task_done: "✅ Feito" tocados na notificação esperando o site gravar
 *   [{ taskId, date, at }]
 */
final class TobaStore {
    private static final String PREFS = "toba_native";
    static final String KEY_PENDING = "pending_purchases";
    static final String KEY_LOG = "purchase_log";
    static final String KEY_APPS = "extra_apps";
    static final String KEY_REMINDERS = "reminders";
    static final String KEY_REMINDER_CODES = "reminder_codes";
    static final String KEY_REST = "rest";
    static final String KEY_WORKOUT = "workout";
    static final String KEY_TASK_ALERTS = "task_alerts";
    static final String KEY_TASK_CODES = "task_alert_codes";
    static final String KEY_TASK_DONE = "task_done";
    static final String KEY_SEEN = "purchase_seen";
    private static final int LOG_MAX = 25;
    private static final int SEEN_MAX = 300;
    private static final long SEEN_MS = 60L * 24 * 60 * 60 * 1000;
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

    // Notificação de compra já lida antes (mesmo pacote + texto + hora original)?
    static boolean isSeen(Context c, String key) {
        String k = seenHash(key);
        JSONArray list = getArray(c, KEY_SEEN);
        for (int i = 0; i < list.length(); i++) {
            JSONObject e = list.optJSONObject(i);
            if (e != null && k.equals(e.optString("k"))) return true;
        }
        return false;
    }

    static void markSeen(Context c, String key, long at) {
        synchronized (LOCK) {
            JSONArray old = getArray(c, KEY_SEEN);
            JSONArray out = new JSONArray();
            try {
                JSONObject e = new JSONObject();
                e.put("k", seenHash(key));
                e.put("at", at);
                out.put(e);
            } catch (JSONException ignored) {
                return;
            }
            long now = System.currentTimeMillis();
            for (int i = 0; i < old.length() && out.length() < SEEN_MAX; i++) {
                JSONObject e = old.optJSONObject(i);
                if (e != null && now - e.optLong("at") < SEEN_MS) out.put(e);
            }
            put(c, KEY_SEEN, out.toString());
        }
    }

    // Hash curto do texto (não guarda o texto inteiro de novo)
    private static String seenHash(String key) {
        return Integer.toHexString(key.hashCode()) + ":" + key.length();
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

    /* ---------------- Toba Routine ---------------- */

    // Tira da lista os avisos de uma tarefa num dia (taskId + date) ou um só (key).
    static void removeTaskAlerts(Context c, String taskId, String date, String key) {
        synchronized (LOCK) {
            JSONArray list = getArray(c, KEY_TASK_ALERTS);
            JSONArray keep = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject a = list.optJSONObject(i);
                if (a == null) continue;
                boolean sameTask = taskId != null && date != null
                        && taskId.equals(a.optString("taskId")) && date.equals(a.optString("date"));
                boolean sameKey = key != null && key.equals(a.optString("key"));
                if (!sameTask && !sameKey) keep.put(a);
            }
            put(c, KEY_TASK_ALERTS, keep.toString());
        }
    }

    static void addDoneTask(Context c, String taskId, String date, long at) {
        synchronized (LOCK) {
            JSONArray list = getArray(c, KEY_TASK_DONE);
            for (int i = 0; i < list.length(); i++) {
                JSONObject d = list.optJSONObject(i);
                if (d != null && taskId.equals(d.optString("taskId")) && date.equals(d.optString("date"))) return;
            }
            try {
                JSONObject d = new JSONObject();
                d.put("taskId", taskId);
                d.put("date", date);
                d.put("at", at);
                list.put(d);
            } catch (JSONException ignored) {
                return;
            }
            put(c, KEY_TASK_DONE, list.toString());
        }
    }

    // keys: ["taskId|AAAA-MM-DD"] que o site confirmou que gravou no banco.
    static void ackDoneTasks(Context c, JSONArray keys) {
        synchronized (LOCK) {
            Set<String> done = new HashSet<>();
            for (int i = 0; i < keys.length(); i++) done.add(keys.optString(i));
            JSONArray list = getArray(c, KEY_TASK_DONE);
            JSONArray keep = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject d = list.optJSONObject(i);
                if (d != null && !done.contains(d.optString("taskId") + "|" + d.optString("date"))) keep.put(d);
            }
            put(c, KEY_TASK_DONE, keep.toString());
        }
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
