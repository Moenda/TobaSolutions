package br.com.toba.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import java.text.NumberFormat;
import java.util.Locale;

/** Notificações que o próprio Toba mostra (compra lida, lembretes, descanso). */
final class Notifier {
    static final String CH_PURCHASE = "compras";
    static final String CH_REMINDER = "lembretes";
    static final String CH_REST = "descanso";
    static final int REST_ID = 3001;
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
        nm.createNotificationChannel(rest);
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
        Intent open = new Intent(c, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null && !url.isEmpty()) open.putExtra(MainActivity.EXTRA_URL, url);
        PendingIntent pi = PendingIntent.getActivity(c, id, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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
