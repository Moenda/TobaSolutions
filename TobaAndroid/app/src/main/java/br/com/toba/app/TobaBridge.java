package br.com.toba.app;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * window.TobaNative no site. Tudo entra e sai como texto/JSON.
 * Mudou algum método? Atualize também o lado do site (toba-common.js,
 * gastos.js, sessao.js) e o TobaAndroid/README.md.
 */
final class TobaBridge {
    private final MainActivity activity;
    private final Context app;

    TobaBridge(MainActivity activity) {
        this.activity = activity;
        this.app = activity.getApplicationContext();
    }

    @JavascriptInterface
    public int version() {
        return 1;
    }

    /* ---------------- Notificações do Toba ---------------- */

    @JavascriptInterface
    public boolean canPostNotifications() {
        return Notifier.canPost(app);
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        activity.runOnUiThread(activity::askNotificationPermission);
    }

    /* ---------------- Gastos lidos das notificações ---------------- */

    @JavascriptInterface
    public boolean hasNotificationAccess() {
        NotificationManager nm = app.getSystemService(NotificationManager.class);
        return nm != null && nm.isNotificationListenerAccessGranted(new ComponentName(app, PurchaseListener.class));
    }

    @JavascriptInterface
    public void openNotificationAccess() {
        activity.runOnUiThread(() -> {
            Intent i;
            if (Build.VERSION.SDK_INT >= 30) {
                i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
                i.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                        new ComponentName(app, PurchaseListener.class).flattenToString());
            } else {
                i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            }
            try {
                activity.startActivity(i);
            } catch (Exception e) {
                activity.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            }
        });
    }

    // "Permitir configurações restritas" fica nas informações do app (APK fora da loja).
    @JavascriptInterface
    public void openAppInfo() {
        activity.runOnUiThread(() -> activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + app.getPackageName()))));
    }

    @JavascriptInterface
    public String getPendingPurchases() {
        return TobaStore.getArray(app, TobaStore.KEY_PENDING).toString();
    }

    @JavascriptInterface
    public void ackPurchases(String idsJson) {
        try {
            TobaStore.ackPending(app, new JSONArray(idsJson));
        } catch (JSONException ignored) {
            // nada sai da fila
        }
    }

    @JavascriptInterface
    public String getPurchaseLog() {
        return TobaStore.getArray(app, TobaStore.KEY_LOG).toString();
    }

    @JavascriptInterface
    public void allowApp(String pkg) {
        TobaStore.addExtraApp(app, pkg);
    }

    /* ---------------- Lembretes e descanso ---------------- */

    @JavascriptInterface
    public String getReminder(String id) {
        JSONObject r = TobaStore.getObject(app, TobaStore.KEY_REMINDERS).optJSONObject(id);
        return r == null ? "" : r.toString();
    }

    // json: { title, message, times: ["08:00"], days: ["MO"], url }
    @JavascriptInterface
    public boolean setReminder(String id, String json) {
        try {
            JSONObject r = new JSONObject(json);
            JSONArray times = r.optJSONArray("times");
            JSONArray days = r.optJSONArray("days");
            if (id == null || id.isEmpty() || times == null || days == null || times.length() == 0 || days.length() == 0) {
                return false;
            }
            JSONObject all = TobaStore.getObject(app, TobaStore.KEY_REMINDERS);
            all.put(id, r);
            TobaStore.put(app, TobaStore.KEY_REMINDERS, all.toString());
            Alarms.scheduleReminders(app);
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    @JavascriptInterface
    public void clearReminder(String id) {
        JSONObject all = TobaStore.getObject(app, TobaStore.KEY_REMINDERS);
        all.remove(id);
        TobaStore.put(app, TobaStore.KEY_REMINDERS, all.toString());
        Alarms.scheduleReminders(app);
    }

    @JavascriptInterface
    public boolean canExactAlarms() {
        return Alarms.canExact(app);
    }

    @JavascriptInterface
    public void scheduleRest(double endsAt, String title, String body) {
        Alarms.scheduleRest(app, (long) endsAt, title, body);
    }

    @JavascriptInterface
    public void cancelRest() {
        Alarms.cancelRest(app);
    }

    // Notificação fixa com o tempo do treino ao vivo (some no hideWorkout).
    @JavascriptInterface
    public void showWorkout(double startedAt, String title) {
        try {
            JSONObject w = new JSONObject();
            w.put("startedAt", (long) startedAt);
            w.put("title", title == null ? "" : title);
            TobaStore.put(app, TobaStore.KEY_WORKOUT, w.toString());
        } catch (JSONException ignored) {
            return;
        }
        Notifier.showWorkout(app);
    }

    @JavascriptInterface
    public void hideWorkout() {
        TobaStore.put(app, TobaStore.KEY_WORKOUT, "{}");
        Notifier.cancel(app, Notifier.WORKOUT_ID);
    }

    @JavascriptInterface
    public void keepScreenOn(boolean on) {
        activity.keepScreenOn(on);
    }

    /* ---------------- Arquivos (backup) ---------------- */

    // O WebView não baixa arquivos gerados pelo site: grava direto em Downloads/Toba.
    @JavascriptInterface
    public boolean saveFile(String name, String mime, String text) {
        String safe = name == null ? "toba.txt" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        ContentResolver resolver = app.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime == null ? "application/octet-stream" : mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Toba");
        try {
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return false;
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) return false;
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
            activity.runOnUiThread(() -> Toast.makeText(app, "Salvo em Downloads/Toba/" + safe, Toast.LENGTH_LONG).show());
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
