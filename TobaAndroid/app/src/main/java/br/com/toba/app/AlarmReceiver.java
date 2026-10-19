package br.com.toba.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Chegou a hora: mostra o lembrete ou o fim do descanso. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String type = intent.getStringExtra(Alarms.EXTRA_TYPE);
        if (Alarms.TYPE_REST.equals(type)) {
            JSONObject rest = TobaStore.getObject(c, TobaStore.KEY_REST);
            TobaStore.put(c, TobaStore.KEY_REST, "{}");
            // Com o app na frente, o próprio treino ao vivo já vibra e avisa.
            if (rest.length() > 0 && !MainActivity.visible) {
                Notifier.show(c, Notifier.CH_REST, Notifier.REST_ID,
                        rest.optString("title", "⏱ Descanso acabou!"),
                        rest.optString("body", "Bora pra próxima série 💪"),
                        BuildConfig.START_URL + "TobaHealth/TobaHealth-Treinos.html");
            }
            return;
        }
        if (Alarms.TYPE_REMINDER.equals(type)) {
            String id = intent.getStringExtra(Alarms.EXTRA_ID);
            JSONObject r = id == null ? null : TobaStore.getObject(c, TobaStore.KEY_REMINDERS).optJSONObject(id);
            if (r != null) {
                Notifier.show(c, Notifier.CH_REMINDER, 4000 + (id.hashCode() & 0xfff),
                        r.optString("title", "Toba"), r.optString("message", ""), r.optString("url", BuildConfig.START_URL));
            }
            Alarms.scheduleReminders(c); // agenda o próximo
        }
    }
}
