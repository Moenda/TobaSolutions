package br.com.toba.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Celular reiniciou (ou o app foi atualizado): o Android apaga os alarmes, então agenda de novo. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Alarms.rescheduleAll(c);
        }
    }
}
