package br.com.toba.app;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Process;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * v2.08 (APK 3.1): 📱 Toba Screen do Toba Health. Lê o "Acesso ao uso" do Android
 * (UsageStatsManager.queryEvents, o mesmo dado do Bem-estar digital da Samsung) e devolve
 * o resumo de cada dia pro site (TobaBridge.screenRead -> window.onTobaScreenData).
 *
 * Só leitura. A pessoa libera uma vez em Configurações › Acesso ao uso › Toba.
 * O Android guarda pouco histórico detalhado (uns 7 a 10 dias), por isso o site grava o dele
 * (TOBA_HEALTH_DB.screen) e relê os últimos dias toda vez que abre.
 *
 * Por dia (data do celular), tudo em SEGUNDOS:
 *   t  = tempo nos apps (sem a tela inicial/launcher e sem a barra do sistema)
 *   on = tempo de tela ligada · u = desbloqueios · pk = vezes que a tela acendeu
 *   h  = [24] tempo nos apps por hora · hu = [24] desbloqueios por hora
 *   a  = { pacote: segundos } · ah = { pacote: [24] } dos 8 apps mais usados
 *   n  = { pacote: notificações que fizeram barulho/apareceram } (evento 12, se o Android mandar)
 *   fa = { pacote: vezes que foi o 1º app depois de desbloquear } ("porta de entrada")
 *   s  = [[início ms, fim ms, segundos em app, app mais usado, 1º app, desbloqueou 0/1]] (cada vez que a tela acendeu)
 *   cut = 1 quando o Android não tinha mais o começo do dia (o site não troca um dia inteiro por um cortado)
 */
final class ScreenReader {
    private static final int MAX_DAYS = 14;
    private static final int TOP_HOURLY = 8;
    private static final long LOOKBACK_MS = 3L * 3600_000L; // pega o app que já tava aberto antes do 1º dia
    private static final int EV_RESUMED = 1;
    private static final int EV_PAUSED = 2;
    private static final int EV_NOTIFICATION = 12; // NOTIFICATION_INTERRUPTION (escondido no SDK)
    private static final int EV_SCREEN_ON = 15;
    private static final int EV_SCREEN_OFF = 16;
    private static final int EV_UNLOCK = 18; // KEYGUARD_HIDDEN
    private static final int EV_STOPPED = 23;
    private static final int EV_SHUTDOWN = 26;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

    interface Done {
        void send(String json);
    }

    private ScreenReader() {
    }

    static boolean granted(Context c) {
        try {
            AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
            int mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
            if (mode == AppOpsManager.MODE_DEFAULT) {
                return c.checkCallingOrSelfPermission("android.permission.PACKAGE_USAGE_STATS") == PackageManager.PERMISSION_GRANTED;
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    // {ok: true, granted, sdk}
    static JSONObject status(Context c) {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", true);
            o.put("granted", granted(c));
            o.put("sdk", android.os.Build.VERSION.SDK_INT);
        } catch (JSONException ignored) {
            // chave fixa
        }
        return o;
    }

    /* ---------------- Por dia ---------------- */

    private static final class Day {
        long t, on;
        int u, pk;
        final long[] h = new long[24];
        final int[] hu = new int[24];
        final Map<String, Long> a = new HashMap<>();
        final Map<String, long[]> ah = new HashMap<>();
        final Map<String, Integer> n = new HashMap<>();
        final Map<String, Integer> fa = new HashMap<>();
        final JSONArray s = new JSONArray();
    }

    private static final class Session {
        long start;
        boolean unlocked;
        String first;
        final Map<String, Long> apps = new HashMap<>();
    }

    private static Day day(Map<String, Day> days, LocalDate d) {
        String k = d.toString();
        Day x = days.get(k);
        if (x == null) {
            x = new Day();
            days.put(k, x);
        }
        return x;
    }

    // Reparte [s, e) pelas horas/dias. app == null = tempo de tela ligada.
    private static void spread(Map<String, Day> days, ZoneId zone, long s, long e, long from, long to, String app, Session ses) {
        s = Math.max(s, from);
        e = Math.min(e, to);
        if (e <= s) return;
        if (app != null && ses != null) ses.apps.merge(app, e - s, Long::sum);
        long t = s;
        while (t < e) {
            ZonedDateTime z = Instant.ofEpochMilli(t).atZone(zone);
            long hourEnd = z.truncatedTo(ChronoUnit.HOURS).plusHours(1).toInstant().toEpochMilli();
            long seg = Math.min(e, hourEnd) - t;
            Day d = day(days, z.toLocalDate());
            int hour = z.getHour();
            if (app == null) {
                d.on += seg;
            } else {
                d.t += seg;
                d.h[hour] += seg;
                d.a.merge(app, seg, Long::sum);
                long[] arr = d.ah.get(app);
                if (arr == null) {
                    arr = new long[24];
                    d.ah.put(app, arr);
                }
                arr[hour] += seg;
            }
            t += seg;
        }
    }

    private static Set<String> ignored(Context c) {
        Set<String> out = new HashSet<>();
        out.add("android");
        out.add("com.android.systemui");
        out.add("com.samsung.android.app.aodservice");
        out.add("com.sec.android.app.launcher");
        out.add("com.samsung.android.honeyboard"); // teclado não é app
        try {
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            for (ResolveInfo r : c.getPackageManager().queryIntentActivities(home, 0)) {
                if (r.activityInfo != null) out.add(r.activityInfo.packageName);
            }
        } catch (Exception ignoredErr) {
            // fica a lista fixa
        }
        return out;
    }

    // from/to = "AAAA-MM-DD" (inclusive), no máximo MAX_DAYS dias. Roda fora da tela.
    static void read(Context c, String from, String to, Done done) {
        WORKER.execute(() -> {
            JSONObject out = new JSONObject();
            try {
                out = readNow(c, from, to);
            } catch (Exception e) {
                try {
                    out.put("ok", false);
                    out.put("error", String.valueOf(e.getMessage()));
                } catch (JSONException ignored) {
                    // chave fixa
                }
            }
            done.send(out.toString());
        });
    }

    private static void closeApp(Map<String, Day> days, ZoneId zone, String[] cur, long[] curAt, long t, long from, long to, Session ses) {
        if (cur[0] != null) spread(days, zone, curAt[0], t, from, to, cur[0], ses);
        cur[0] = null;
    }

    private static void closeSession(Map<String, Day> days, ZoneId zone, Session ses, long t, long from, long to) throws JSONException {
        if (ses == null) return;
        spread(days, zone, ses.start, t, from, to, null, null);
        if (ses.start < from || ses.start >= to) return;
        long appMs = 0;
        String top = "";
        long best = 0;
        for (Map.Entry<String, Long> en : ses.apps.entrySet()) {
            appMs += en.getValue();
            if (en.getValue() > best) {
                best = en.getValue();
                top = en.getKey();
            }
        }
        Day d = day(days, Instant.ofEpochMilli(ses.start).atZone(zone).toLocalDate());
        d.pk++;
        if (ses.unlocked && ses.first != null) d.fa.merge(ses.first, 1, Integer::sum);
        // tela acesa só pra olhar a hora (sem app e sem desbloquear) não vira sessão
        if (appMs < 1000 && !ses.unlocked) return;
        if (d.s.length() >= 400) return;
        JSONArray row = new JSONArray();
        row.put(ses.start);
        row.put(Math.max(ses.start, Math.min(t, to)));
        row.put(Math.round(appMs / 1000.0));
        row.put(top);
        row.put(ses.first == null ? "" : ses.first);
        row.put(ses.unlocked ? 1 : 0);
        d.s.put(row);
    }

    static JSONObject readNow(Context c, String fromIso, String toIso) throws JSONException {
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("granted", granted(c));
        if (!granted(c)) {
            out.put("ok", false);
            out.put("error", "sem acesso ao uso");
            return out;
        }
        ZoneId zone = ZoneId.systemDefault();
        LocalDate dFrom = LocalDate.parse(fromIso);
        LocalDate dTo = LocalDate.parse(toIso);
        if (dTo.isBefore(dFrom)) dTo = dFrom;
        if (ChronoUnit.DAYS.between(dFrom, dTo) >= MAX_DAYS) dFrom = dTo.minusDays(MAX_DAYS - 1);
        long now = System.currentTimeMillis();
        long from = dFrom.atStartOfDay(zone).toInstant().toEpochMilli();
        long to = Math.min(now, dTo.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli());
        out.put("from", dFrom.toString());
        out.put("to", dTo.toString());

        UsageStatsManager usm = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents evs = usm.queryEvents(from - LOOKBACK_MS, to);
        Set<String> skip = ignored(c);
        Map<String, Day> days = new TreeMap<>();
        String[] cur = new String[1];
        long[] curAt = new long[1];
        Session ses = null;
        boolean screenOn = false;
        long oldest = 0;
        int events = 0;
        UsageEvents.Event ev = new UsageEvents.Event();
        while (evs != null && evs.hasNextEvent()) {
            evs.getNextEvent(ev);
            long t = ev.getTimeStamp();
            String pkg = ev.getPackageName();
            int type = ev.getEventType();
            if (oldest == 0 || t < oldest) oldest = t;
            events++;
            switch (type) {
                case EV_RESUMED: {
                    if (pkg == null || skip.contains(pkg)) {
                        closeApp(days, zone, cur, curAt, t, from, to, ses);
                        break;
                    }
                    if (pkg.equals(cur[0])) break;
                    closeApp(days, zone, cur, curAt, t, from, to, ses);
                    // app abriu sem o aviso de tela ligada (acontece no 1º evento do período)
                    if (!screenOn) {
                        screenOn = true;
                        ses = new Session();
                        ses.start = t;
                    }
                    cur[0] = pkg;
                    curAt[0] = t;
                    if (ses != null && ses.first == null && ses.unlocked) ses.first = pkg;
                    break;
                }
                case EV_PAUSED:
                case EV_STOPPED:
                    if (pkg != null && pkg.equals(cur[0])) closeApp(days, zone, cur, curAt, t, from, to, ses);
                    break;
                case EV_SCREEN_ON:
                    if (screenOn) break;
                    screenOn = true;
                    ses = new Session();
                    ses.start = t;
                    break;
                case EV_SCREEN_OFF:
                case EV_SHUTDOWN:
                    closeApp(days, zone, cur, curAt, t, from, to, ses);
                    if (screenOn) closeSession(days, zone, ses, t, from, to);
                    screenOn = false;
                    ses = null;
                    break;
                case EV_UNLOCK: {
                    if (ses == null) {
                        screenOn = true;
                        ses = new Session();
                        ses.start = t;
                    }
                    ses.unlocked = true;
                    if (t >= from && t < to) {
                        ZonedDateTime z = Instant.ofEpochMilli(t).atZone(zone);
                        Day d = day(days, z.toLocalDate());
                        d.u++;
                        d.hu[z.getHour()]++;
                    }
                    break;
                }
                case EV_NOTIFICATION:
                    if (pkg != null && t >= from && t < to) {
                        day(days, Instant.ofEpochMilli(t).atZone(zone).toLocalDate()).n.merge(pkg, 1, Integer::sum);
                    }
                    break;
                default:
                    break;
            }
        }
        // o que ainda tá aberto agora
        long end = Math.min(now, to);
        closeApp(days, zone, cur, curAt, end, from, to, ses);
        if (screenOn && ses != null && end >= now - 1000) {
            closeSession(days, zone, ses, end, from, to);
        }

        out.put("events", events);
        out.put("oldest", oldest);
        JSONObject jd = new JSONObject();
        Set<String> pkgs = new HashSet<>();
        for (Map.Entry<String, Day> en : days.entrySet()) {
            Day d = en.getValue();
            if (d.t == 0 && d.on == 0 && d.u == 0) continue;
            JSONObject o = new JSONObject();
            o.put("t", Math.round(d.t / 1000.0));
            o.put("on", Math.round(d.on / 1000.0));
            o.put("u", d.u);
            o.put("pk", d.pk);
            JSONArray h = new JSONArray();
            JSONArray hu = new JSONArray();
            for (int i = 0; i < 24; i++) {
                h.put(Math.round(d.h[i] / 1000.0));
                hu.put(d.hu[i]);
            }
            o.put("h", h);
            o.put("hu", hu);
            JSONObject a = new JSONObject();
            List<Map.Entry<String, Long>> list = new ArrayList<>(d.a.entrySet());
            list.sort((x, y) -> Long.compare(y.getValue(), x.getValue()));
            JSONObject ah = new JSONObject();
            for (int i = 0; i < list.size(); i++) {
                long sec = Math.round(list.get(i).getValue() / 1000.0);
                if (sec <= 0) continue;
                String p = list.get(i).getKey();
                a.put(p, sec);
                pkgs.add(p);
                if (i < TOP_HOURLY) {
                    JSONArray arr = new JSONArray();
                    long[] src = d.ah.get(p);
                    for (int k = 0; k < 24; k++) arr.put(src == null ? 0 : Math.round(src[k] / 1000.0));
                    ah.put(p, arr);
                }
            }
            o.put("a", a);
            o.put("ah", ah);
            JSONObject n = new JSONObject();
            for (Map.Entry<String, Integer> x : d.n.entrySet()) {
                n.put(x.getKey(), x.getValue());
                pkgs.add(x.getKey());
            }
            o.put("n", n);
            JSONObject fa = new JSONObject();
            for (Map.Entry<String, Integer> x : d.fa.entrySet()) fa.put(x.getKey(), x.getValue());
            o.put("fa", fa);
            o.put("s", d.s);
            long dayStart = LocalDate.parse(en.getKey()).atStartOfDay(zone).toInstant().toEpochMilli();
            if (oldest > dayStart + 60_000L) o.put("cut", 1);
            jd.put(en.getKey(), o);
        }
        out.put("days", jd);
        out.put("apps", apps(c, pkgs));
        return out;
    }

    // { pacote: { n: nome, c: categoria do Android (-1 = sem), sys: 0/1 } }
    private static JSONObject apps(Context c, Set<String> pkgs) throws JSONException {
        JSONObject o = new JSONObject();
        PackageManager pm = c.getPackageManager();
        for (String p : pkgs) {
            JSONObject x = new JSONObject();
            try {
                ApplicationInfo ai = pm.getApplicationInfo(p, 0);
                x.put("n", String.valueOf(pm.getApplicationLabel(ai)));
                x.put("c", ai.category);
                x.put("sys", (ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0 ? 1 : 0);
            } catch (Exception e) {
                x.put("n", p);
                x.put("c", -1);
                x.put("gone", 1);
            }
            o.put(p, x);
        }
        return o;
    }

    // Ícones pequenos (PNG 48 px em base64) dos pacotes pedidos. { pacote: "data:image/png;base64,..." }
    static void icons(Context c, String json, Done done) {
        WORKER.execute(() -> {
            JSONObject out = new JSONObject();
            try {
                JSONArray list = new JSONArray(json == null ? "[]" : json);
                PackageManager pm = c.getPackageManager();
                for (int i = 0; i < list.length() && i < 80; i++) {
                    String p = list.optString(i, "");
                    if (p.isEmpty()) continue;
                    try {
                        Drawable d = pm.getApplicationIcon(p);
                        Bitmap b = Bitmap.createBitmap(48, 48, Bitmap.Config.ARGB_8888);
                        Canvas cv = new Canvas(b);
                        d.setBounds(0, 0, 48, 48);
                        d.draw(cv);
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        b.compress(Bitmap.CompressFormat.PNG, 100, bos);
                        out.put(p, "data:image/png;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
                    } catch (Exception ignored) {
                        // app desinstalado: fica sem ícone
                    }
                }
            } catch (Exception ignored) {
                // lista torta: volta vazio
            }
            done.send(out.toString());
        });
    }
}
