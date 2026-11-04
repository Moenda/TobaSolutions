package br.com.toba.auto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import br.com.toba.app.MainActivity;
import br.com.toba.app.R;

/**
 * Serviço em primeiro plano (tipo "location") enquanto tem rota no carro:
 * sem ele o Android corta o GPS quando a tela do celular apaga.
 */
public final class NavService extends Service {
    private static final String CHANNEL = "navegar";
    private static final int ID = 3101;
    private static final String EXTRA_TEXT = "text";

    static void start(Context c, String text) {
        Intent i = new Intent(c, NavService.class).putExtra(EXTRA_TEXT, text);
        try {
            c.startForegroundService(i);
        } catch (Exception ignored) {
            // Android não deixou (app em segundo plano): o GPS segue enquanto o Auto estiver na frente
        }
    }

    static void stop(Context c) {
        try {
            c.stopService(new Intent(c, NavService.class));
        } catch (Exception ignored) {
            // já parado
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String text = intent == null ? null : intent.getStringExtra(EXTRA_TEXT);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Navegar (Android Auto)", NotificationManager.IMPORTANCE_LOW));
        }
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_toba)
                .setContentTitle("🧭 Navegar no Android Auto")
                .setContentText(text == null ? "Rota ligada" : text)
                .setCategory(Notification.CATEGORY_NAVIGATION)
                .setOngoing(true)
                .setContentIntent(open)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(ID, n);
        } catch (Exception e) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
