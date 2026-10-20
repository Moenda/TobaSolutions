package br.com.toba.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;

import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Locale;

/** Notificações que o próprio Toba mostra (compra lida, lembretes, descanso, treino em andamento). */
final class Notifier {
    static final String CH_PURCHASE = "compras";
    static final String CH_REMINDER = "lembretes";
    static final String CH_REST = "descanso";
    static final String CH_WORKOUT = "treino";
    static final String CH_ROUTINE = "rotina";
    static final int REST_ID = 3001;
    static final int WORKOUT_ID = 3002;
    static final String WORKOUT_URL = BuildConfig.START_URL + "TobaHealth/TobaHealth-Treinos.html?live=1";
    private static int purchaseSeq = 0;

    private Notifier() {}

    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel purchase = new NotificationChannel(CH_PURCHASE, "Gastos lidos", NotificationManager.IMPORTANCE_DEFAULT);
        purchase.setDescription("Avisa quando o Toba leu uma compra numa notificação");
        NotificationChannel reminder = new NotificationChannel(CH_REMINDER, "Lembretes", NotificationManager.IMPORTANCE_HIGH);
        reminder.setDescription("Lembretes de gastos, pesagem e treino");
        NotificationChannel rest = new NotificationChannel(CH_REST, "Fim do descanso", NotificationManager.IMPORTANCE_HIGH);
        rest.setDescription("Avisa quando o descanso do treino ao vivo acaba");
        rest.enableVibration(true);
        rest.setVibrationPattern(new long[] {0, 250, 120, 250, 120, 400});
        nm.createNotificationChannel(purchase);
        nm.createNotificationChannel(reminder);
        // Baixa: fica na barra sem som nem vibração.
        NotificationChannel workout = new NotificationChannel(CH_WORKOUT, "Treino em andamento", NotificationManager.IMPORTANCE_LOW);
        workout.setDescription("Fica na barra com o tempo do treino ao vivo enquanto ele estiver aberto");
        nm.createNotificationChannel(rest);
        nm.createNotificationChannel(workout);
        NotificationChannel routine = new NotificationChannel(CH_ROUTINE, "Cobranças da rotina", NotificationManager.IMPORTANCE_HIGH);
        routine.setDescription("Tarefas do Toba Routine no horário e as cobranças se você não fizer");
        nm.createNotificationChannel(routine);
    }

    static boolean canPost(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    // url: página do site que abre ao tocar (precisa ser do próprio site).
    static void show(Context c, String channel, int id, String title, String body, String url) {
        if (!canPost(c)) return;
        ensureChannels(c);
        PendingIntent pi = openIntent(c, id, url);
        Notification notification = new Notification.Builder(c, channel)
                .setSmallIcon(R.drawable.ic_stat_toba)
                .setColor(0xFF3FB950)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id, notification);
    }

    private static PendingIntent openIntent(Context c, int id, String url) {
        Intent open = new Intent(c, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null && !url.isEmpty()) open.putExtra(MainActivity.EXTRA_URL, url);
        return PendingIntent.getActivity(c, id, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // Treino ao vivo: o próprio Android conta o tempo a partir do início
    // (setUsesChronometer), então o relógio fica certo com o app fechado.
    static void showWorkout(Context c) {
        JSONObject w = TobaStore.getObject(c, TobaStore.KEY_WORKOUT);
        long startedAt = w.optLong("startedAt", 0);
        if (startedAt <= 0 || !canPost(c)) return;
        ensureChannels(c);
        // Android 14+ deixa arrastar até notificação fixa: se tirarem, ela volta.
        Intent again = new Intent(c, AlarmReceiver.class);
        again.putExtra(Alarms.EXTRA_TYPE, Alarms.TYPE_WORKOUT);
        PendingIntent onDelete = PendingIntent.getBroadcast(c, WORKOUT_ID, again,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(c, CH_WORKOUT)
                .setSmallIcon(R.drawable.ic_stat_toba)
                .setColor(0xFF3FB950)
                .setContentTitle("🏋️ " + w.optString("title", "Treino") + " em andamento")
                .setContentText("Toque para voltar ao treino")
                .setWhen(startedAt)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openIntent(c, WORKOUT_ID, WORKOUT_URL))
                .setDeleteIntent(onDelete)
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(WORKOUT_ID, notification);
    }

    // Uma notificação por tarefa e dia: a cobrança seguinte substitui a anterior.
    static int taskNotifId(String taskId, String date) {
        return 5000 + ((taskId + "|" + date).hashCode() & 0xfff);
    }

    // Aviso de tarefa com o botão "✅ Feito" (marca sem abrir o app).
    static void showTask(Context c, JSONObject alert) {
        if (!canPost(c)) return;
        ensureChannels(c);
        String taskId = alert.optString("taskId");
        String date = alert.optString("date");
        int id = taskNotifId(taskId, date);
        Intent done = new Intent(c, AlarmReceiver.class);
        done.putExtra(Alarms.EXTRA_TYPE, Alarms.TYPE_TASK_DONE);
        done.putExtra(Alarms.EXTRA_TASK, taskId);
        done.putExtra(Alarms.EXTRA_DATE, date);
        done.putExtra(Alarms.EXTRA_NOTIF, id);
        PendingIntent onDone = PendingIntent.getBroadcast(c, id, done,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String url = alert.optString("url", "");
        if (!MainActivity.isOwnSite(Uri.parse(url))) url = BuildConfig.START_URL + "TobaRoutine/TobaRoutine-Index.html";
        String body = alert.optString("body", "");
        Notification notification = new Notification.Builder(c, CH_ROUTINE)
                .setSmallIcon(R.drawable.ic_stat_toba)
                .setColor(0xFFE3B341)
                .setContentTitle(alert.optString("title", "Toba Routine"))
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(openIntent(c, id, url))
                .addAction(new Notification.Action.Builder(
                        Icon.createWithResource(c, R.drawable.ic_stat_toba), "✅ Feito", onDone).build())
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id, notification);
    }

    // Depois do "✅ Feito": troca a cobrança por um ok que some sozinho.
    static void showTaskDone(Context c, int id) {
        if (!canPost(c)) return;
        Notification notification = new Notification.Builder(c, CH_ROUTINE)
                .setSmallIcon(R.drawable.ic_stat_toba)
                .setColor(0xFF3FB950)
                .setContentTitle("✅ Anotado!")
                .setContentText("O XP cai na conta quando você abrir o Toba.")
                .setOnlyAlertOnce(true)
                .setAutoCancel(true)
                .setTimeoutAfter(4000)
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id, notification);
    }

    static void showPurchase(Context c, double amount, String desc) {
        String value = NumberFormat.getCurrencyInstance(new Locale("pt", "BR")).format(amount);
        purchaseSeq = (purchaseSeq + 1) % 100;
        show(c, CH_PURCHASE, 2000 + purchaseSeq, "💸 " + value + " · " + desc,
                "Toque para lançar no Toba Bank (ou abra o Gastos depois).",
                BuildConfig.START_URL + "TobaBank/TobaBank-Gastos.html");
    }

    static void cancel(Context c, int id) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(id);
    }
}
