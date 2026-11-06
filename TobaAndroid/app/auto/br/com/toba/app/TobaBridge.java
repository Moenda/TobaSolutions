package br.com.toba.app;

import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import br.com.toba.auto.DriveSync;

/**
 * window.TobaNative no site. Tudo entra e sai como texto/JSON.
 * Mudou algum método? Atualize também o lado do site (toba-common.js,
 * gastos.js, sessao.js) e o TobaAndroid/README.md.
 * v1.77 (APK 1.6): mudou pra app/auto/br/com/toba/app/ junto do MainActivity.
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
        return 10; // 10 = APK 2.2 (healthStatus/healthAsk/healthRead: ⌚ Relógio do Toba Health); 9 = APK 2.1 (clipboardText: 📋 Colar do Maps no Places); 8 = APK 1.8 (autoFavorites: ⭐ no Android Auto); 7 = APK 1.7 (autoOn/autoRoute: rota junta com o Android Auto); 6 = APK 1.6 (navKeepAlive/speak); 3 = APK 1.3 (clearTaskNotice); 2 = APK 1.2 (avisos do Toba Routine)
    }

    /* ---------------- v1.87 (APK 2.2): ⌚ Relógio (Health Connect) ---------------- */

    // {ok, sdk, granted: ["steps", "sleep", ...], missing: [...]}. ok false = Android sem
    // Health Connect embutido (só Android 14+; o Toba não usa o app antigo do Health Connect).
    @JavascriptInterface
    public String healthStatus() {
        if (Build.VERSION.SDK_INT < 34) return "{\"ok\":false,\"sdk\":" + Build.VERSION.SDK_INT + ",\"granted\":[],\"missing\":[]}";
        return HealthReader.status(app).toString();
    }

    // Abre a tela do Health Connect pedindo o que falta. Resposta: window.onTobaHealthPerms(status)
    @JavascriptInterface
    public void healthAsk() {
        if (Build.VERSION.SDK_INT < 34) {
            activity.healthJs("window.onTobaHealthPerms&&window.onTobaHealthPerms(" + healthStatus() + ")");
            return;
        }
        activity.askHealthPermissions(HealthReader.missingPerms(app));
    }

    // Lê do dia from ao dia to ("AAAA-MM-DD", inclusive) em segundo plano. Resposta:
    // window.onTobaHealthData(reqId, { ok, days: { "AAAA-MM-DD": { steps, kcal, ... } }, sleep: [], exercises: [], errors: {} })
    @JavascriptInterface
    public boolean healthRead(String from, String to, String reqId) {
        if (Build.VERSION.SDK_INT < 34 || from == null || to == null) return false;
        final String id = JSONObject.quote(reqId == null ? "" : reqId);
        HealthReader.read(app, from, to, json -> activity.healthJs(
                "window.onTobaHealthData&&window.onTobaHealthData(" + id + "," + json + ")"));
        return true;
    }

    // Permissões do Toba dentro do Health Connect (quando o Android já não mostra mais o pedido)
    @JavascriptInterface
    public void healthOpenSettings() {
        activity.runOnUiThread(() -> {
            Intent i = new Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS");
            i.putExtra(Intent.EXTRA_PACKAGE_NAME, app.getPackageName());
            try {
                activity.startActivity(i);
            } catch (Exception e) {
                try {
                    activity.startActivity(new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS"));
                } catch (Exception e2) {
                    activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + app.getPackageName())));
                }
            }
        });
    }

    /* ---------------- v1.85 (APK 2.1): área de transferência ---------------- */

    // 📋 Colar do Maps (Toba Places): a janela do app não deixa o site ler a área de
    // transferência (navigator.clipboard.readText falha calado), então lê pelo Android.
    // Android 12+ mostra o aviso "Toba colou da área de transferência". Vazio = nada copiado.
    @JavascriptInterface
    public String clipboardText() {
        final String[] out = {""};
        final CountDownLatch done = new CountDownLatch(1);
        activity.runOnUiThread(() -> {
            try {
                ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData clip = cm == null ? null : cm.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence t = clip.getItemAt(0).coerceToText(activity);
                    if (t != null) out[0] = t.toString();
                }
            } catch (Exception ignored) {
                // sem permissão (app fora da tela) ou nada copiado
            }
            done.countDown();
        });
        try {
            done.await(2, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return out[0];
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

    // v1.77 (APK 1.6): 🧭 Toba Drive com a tela apagada. on = rota ligada (serviço em
    // primeiro plano + GPS nativo pra window.onTobaNativeFix); text = linha da notificação.
    @JavascriptInterface
    public void navKeepAlive(boolean on, String text) {
        activity.setNavigating(on, text);
    }

    // v1.77: fala com a voz do Android (o site usa com a tela apagada)
    @JavascriptInterface
    public void speak(String text, boolean interrupt) {
        activity.speak(text, interrupt);
    }

    /* ---------------- v1.78 (APK 1.7): rota junta com o Android Auto ---------------- */

    // Toba aberto na tela do carro agora (aí quem fala é o carro, o site fica mudo)
    @JavascriptInterface
    public boolean autoOn() {
        return DriveSync.carOn();
    }

    // Rota que o carro está fazendo: {name, address, lat, lng} ou "" (sem rota)
    @JavascriptInterface
    public String autoRouteNow() {
        return DriveSync.carRoute();
    }

    // O 🧭 Toba Drive do site começou ({name, lat, lng}) ou parou ("") a rota: o carro acompanha
    @JavascriptInterface
    public void autoRoute(String json) {
        DriveSync.fromPhone(json);
    }

    // v1.80: ⭐ favoritos do 🧭 Toba Drive ([{name, emoji, address, lat, lng}]) pro botão Favoritos do carro
    @JavascriptInterface
    public boolean autoFavorites(String json) {
        return DriveSync.setFavorites(activity, json);
    }

    /* ---------------- Toba Routine ---------------- */

    // json: [{ key, at, title, body, url, taskId, date }]. Substitui a lista inteira.
    @JavascriptInterface
    public boolean setTaskAlerts(String json) {
        try {
            JSONArray list = new JSONArray(json);
            TobaStore.put(app, TobaStore.KEY_TASK_ALERTS, list.toString());
            Alarms.scheduleTaskAlerts(app);
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    // "✅ Feito" tocados na notificação: [{ taskId, date, at }]
    @JavascriptInterface
    public String getDoneTasks() {
        return TobaStore.getArray(app, TobaStore.KEY_TASK_DONE).toString();
    }

    // keys: ["taskId|AAAA-MM-DD"] que o site já gravou no banco
    @JavascriptInterface
    public void ackDoneTasks(String keysJson) {
        try {
            TobaStore.ackDoneTasks(app, new JSONArray(keysJson));
        } catch (JSONException ignored) {
            // nada a tirar
        }
    }

    // Atrasada "deixada pra lá" no site (v1.47 / APK 1.3): tira da barra a
    // notificação já mostrada dessa ocorrência. As cobranças futuras já saem
    // pelo setTaskAlerts (o site manda a lista sem ela).
    @JavascriptInterface
    public void clearTaskNotice(String taskId, String date) {
        if (taskId == null || date == null) return;
        Notifier.cancel(app, Notifier.taskNotifId(taskId, date));
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
