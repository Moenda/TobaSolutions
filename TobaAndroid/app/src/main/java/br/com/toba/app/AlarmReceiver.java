package br.com.toba.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

/** Chegou a hora: mostra o lembrete, o fim do descanso, o aviso de tarefa (ou repõe a notificação do treino). */
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
                        Notifier.WORKOUT_URL);
            }
            return;
        }
        if (Alarms.TYPE_WORKOUT.equals(type)) {
            Notifier.showWorkout(c); // não faz nada se o treino já acabou
            return;
        }
        if (Alarms.TYPE_TASK.equals(type)) {
            // Aviso de tarefa: mostra uma vez e tira da lista
            String key = intent.getStringExtra(Alarms.EXTRA_ID);
            JSONArray alerts = TobaStore.getArray(c, TobaStore.KEY_TASK_ALERTS);
            for (int i = 0; i < alerts.length(); i++) {
                JSONObject a = alerts.optJSONObject(i);
                if (a != null && a.optString("key").equals(key)) {
                    Notifier.showTask(c, a);
                    break;
                }
            }
            TobaStore.removeTaskAlerts(c, null, null, key);
            return;
        }
        if (Alarms.TYPE_TASK_DONE.equals(type)) {
            // "✅ Feito" na notificação: guarda na fila e cancela as cobranças do dia
            String taskId = intent.getStringExtra(Alarms.EXTRA_TASK);
            String date = intent.getStringExtra(Alarms.EXTRA_DATE);
            if (taskId == null || date == null) return;
            TobaStore.addDoneTask(c, taskId, date, System.currentTimeMillis());
            TobaStore.removeTaskAlerts(c, taskId, date, null);
            Alarms.scheduleTaskAlerts(c);
            Notifier.showTaskDone(c, intent.getIntExtra(Alarms.EXTRA_NOTIF, Notifier.taskNotifId(taskId, date)));
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
