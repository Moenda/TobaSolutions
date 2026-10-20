package br.com.toba.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Iterator;

/**
 * Alarmes do sistema: lembretes com horário (08:00, 14:00, 22:00...) e o fim
 * do descanso do treino ao vivo. Funcionam com o app fechado; depois de
 * reiniciar o celular o BootReceiver agenda tudo de novo.
 */
final class Alarms {
    static final String EXTRA_TYPE = "type";
    static final String EXTRA_ID = "id";
    static final String TYPE_REST = "rest";
    static final String TYPE_REMINDER = "reminder";
    static final String TYPE_WORKOUT = "workout";
    private static final int REST_CODE = 9001;
    private static final String[] DAY_CODES = {"SU", "MO", "TU", "WE", "TH", "FR", "SA"}; // Calendar.SUNDAY = 1

    private Alarms() {}

    static void rescheduleAll(Context c) {
        scheduleReminders(c);
        Notifier.showWorkout(c); // reiniciou no meio do treino: a notificação volta
        JSONObject rest = TobaStore.getObject(c, TobaStore.KEY_REST);
        long endsAt = rest.optLong("endsAt", 0);
        if (endsAt > System.currentTimeMillis()) setExact(c, endsAt, restIntent(c, PendingIntent.FLAG_UPDATE_CURRENT));
    }

    /* ---------------- Descanso ---------------- */

    static void scheduleRest(Context c, long endsAt, String title, String body) {
        if (endsAt <= System.currentTimeMillis()) {
            cancelRest(c);
            return;
        }
        try {
            JSONObject rest = new JSONObject();
            rest.put("endsAt", endsAt);
            rest.put("title", title);
            rest.put("body", body);
            TobaStore.put(c, TobaStore.KEY_REST, rest.toString());
        } catch (JSONException ignored) {
            return;
        }
        setExact(c, endsAt, restIntent(c, PendingIntent.FLAG_UPDATE_CURRENT));
    }

    static void cancelRest(Context c) {
        PendingIntent pi = restIntent(c, PendingIntent.FLAG_NO_CREATE);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (pi != null && am != null) am.cancel(pi);
        TobaStore.put(c, TobaStore.KEY_REST, "{}");
        Notifier.cancel(c, Notifier.REST_ID);
    }

    private static PendingIntent restIntent(Context c, int flag) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.putExtra(EXTRA_TYPE, TYPE_REST);
        return PendingIntent.getBroadcast(c, REST_CODE, i, flag | PendingIntent.FLAG_IMMUTABLE);
    }

    /* ---------------- Lembretes ---------------- */

    // Cancela os alarmes antigos e agenda o próximo horário de cada lembrete.
    static void scheduleReminders(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        JSONArray oldCodes = TobaStore.getArray(c, TobaStore.KEY_REMINDER_CODES);
        for (int i = 0; i < oldCodes.length(); i++) {
            Intent probe = new Intent(c, AlarmReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(c, oldCodes.optInt(i), probe,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pi != null) am.cancel(pi);
        }

        JSONArray codes = new JSONArray();
        JSONObject all = TobaStore.getObject(c, TobaStore.KEY_REMINDERS);
        long now = System.currentTimeMillis();
        Iterator<String> ids = all.keys();
        while (ids.hasNext()) {
            String id = ids.next();
            JSONObject r = all.optJSONObject(id);
            if (r == null) continue;
            JSONArray times = r.optJSONArray("times");
            JSONArray days = r.optJSONArray("days");
            if (times == null || days == null) continue;
            for (int t = 0; t < times.length(); t++) {
                String time = times.optString(t);
                long at = nextTrigger(time, days, now);
                if (at <= 0) continue;
                int code = ("r:" + id + ":" + time).hashCode() & 0x3fffffff;
                Intent i = new Intent(c, AlarmReceiver.class);
                i.putExtra(EXTRA_TYPE, TYPE_REMINDER);
                i.putExtra(EXTRA_ID, id);
                PendingIntent pi = PendingIntent.getBroadcast(c, code, i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                setExact(c, at, pi);
                codes.put(code);
            }
        }
        TobaStore.put(c, TobaStore.KEY_REMINDER_CODES, codes.toString());
    }

    // Próximo "HH:MM" (depois de agora) que cai num dos dias ("MO", "TU"...).
    static long nextTrigger(String time, JSONArray days, long now) {
        if (time == null || !time.matches("\\d{2}:\\d{2}")) return -1;
        int h = Integer.parseInt(time.substring(0, 2));
        int m = Integer.parseInt(time.substring(3, 5));
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        cal.set(Calendar.HOUR_OF_DAY, h);
        cal.set(Calendar.MINUTE, m);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        for (int i = 0; i < 8; i++) {
            String code = DAY_CODES[cal.get(Calendar.DAY_OF_WEEK) - 1];
            if (cal.getTimeInMillis() > now && contains(days, code)) return cal.getTimeInMillis();
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        return -1;
    }

    private static boolean contains(JSONArray list, String value) {
        for (int i = 0; i < list.length(); i++) if (value.equals(list.optString(i))) return true;
        return false;
    }

    private static void setExact(Context c, long at, PendingIntent pi) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null || pi == null) return;
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); // pode atrasar alguns minutos
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static boolean canExact(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        return am != null && (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms());
    }
}
