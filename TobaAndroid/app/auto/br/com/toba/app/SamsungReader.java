package br.com.toba.app;

import android.app.Activity;
import android.content.Context;

import com.samsung.android.sdk.health.data.HealthDataService;
import com.samsung.android.sdk.health.data.HealthDataStore;
import com.samsung.android.sdk.health.data.data.HealthDataPoint;
import com.samsung.android.sdk.health.data.data.entries.SkinTemperature;
import com.samsung.android.sdk.health.data.error.HealthDataException;
import com.samsung.android.sdk.health.data.error.ResolvablePlatformException;
import com.samsung.android.sdk.health.data.permission.AccessType;
import com.samsung.android.sdk.health.data.permission.Permission;
import com.samsung.android.sdk.health.data.request.DataType;
import com.samsung.android.sdk.health.data.request.DataTypes;
import com.samsung.android.sdk.health.data.request.InstantTimeFilter;
import com.samsung.android.sdk.health.data.request.LocalDateFilter;
import com.samsung.android.sdk.health.data.response.DataResponse;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

/**
 * v1.98 (APK 2.6, 😴 Sono turbinado): o que o Samsung NÃO manda pro Health Connect, lido direto
 * do Samsung Health pelo Samsung Health Data SDK (libs/…/samsung-health-data-api-1.1.0.aar,
 * fora do git). Só LEITURA: basta o "Developer Mode for Data Read" ligado no Samsung Health
 * (⋮ › Configurações › Sobre › tocar 10x na versão). Sem parceria, sem import manual.
 *
 *   🌡️ temperatura da pele da noite -> days[dia].temp (°C, 1 casa) + sleep[].tp (série de 5 min)
 *   🔋 Energy Score do dia           -> days[dia].energy
 *   🤡 nota de sono do Samsung        -> sleep[].score (na sessão do Health Connect da mesma noite)
 *
 * Tudo protegido: sem Samsung Health, sem o modo dev ou sem permissão = volta {ok:false, error}
 * e o Health Connect segue igual. NUNCA quebra a leitura principal.
 */
final class SamsungReader {
    private static final long WAIT_S = 20;
    private static final int NIGHT_FROM_HOUR = 18; // igual o HealthReader: das 18h em diante = noite do dia seguinte
    private static final int PAGE = 500;
    private static final int MAX_PAGES = 20;

    private SamsungReader() {
    }

    static Set<Permission> perms() {
        Set<Permission> s = new HashSet<>();
        s.add(Permission.of(DataTypes.SKIN_TEMPERATURE, AccessType.READ));
        s.add(Permission.of(DataTypes.ENERGY_SCORE, AccessType.READ));
        s.add(Permission.of(DataTypes.SLEEP, AccessType.READ));
        return s;
    }

    private static String nameOf(DataType t) {
        if (t == DataTypes.SKIN_TEMPERATURE) return "temp";
        if (t == DataTypes.ENERGY_SCORE) return "energy";
        if (t == DataTypes.SLEEP) return "score";
        return t.getName();
    }

    // {ok, granted: ["temp","energy","score"], missing: [...], error?}. Roda fora da tela (bloqueia).
    static JSONObject status(Context c) {
        JSONObject o = new JSONObject();
        try {
            try {
                HealthDataStore store = HealthDataService.getStore(c);
                Set<Permission> got = store.getGrantedPermissionsAsync(perms()).get(WAIT_S, TimeUnit.SECONDS);
                fillStatus(o, got);
                o.put("ok", true);
            } catch (Throwable e) {
                o.put("ok", false);
                o.put("error", msg(e));
                o.put("granted", new JSONArray());
                o.put("missing", new JSONArray());
            }
        } catch (JSONException ignored) {
            // chave fixa
        }
        return o;
    }

    private static void fillStatus(JSONObject o, Set<Permission> got) throws JSONException {
        JSONArray granted = new JSONArray();
        JSONArray missing = new JSONArray();
        for (Permission p : perms()) {
            if (got != null && got.contains(p)) granted.put(nameOf(p.getDataType()));
            else missing.put(nameOf(p.getDataType()));
        }
        o.put("granted", granted);
        o.put("missing", missing);
    }

    interface Done {
        void send(String json);
    }

    // Abre a tela do Samsung Health pedindo as 3 leituras. Resposta = status (JSON).
    static void ask(Activity a, Done done) {
        a.runOnUiThread(() -> {
            try {
                HealthDataStore store = HealthDataService.getStore(a.getApplicationContext());
                store.requestPermissionsAsync(perms(), a).setCallback(a.getMainLooper(),
                        got -> {
                            JSONObject o = new JSONObject();
                            try {
                                o.put("ok", true);
                                fillStatus(o, got);
                            } catch (JSONException ignored) {
                                // chave fixa
                            }
                            done.send(o.toString());
                        },
                        err -> {
                            // Samsung Health desatualizado/sem conta: o SDK sabe abrir a tela que resolve
                            if (err instanceof ResolvablePlatformException && ((ResolvablePlatformException) err).getHasResolution()) {
                                try {
                                    ((ResolvablePlatformException) err).resolve(a);
                                } catch (Throwable ignored) {
                                    // segue pro erro
                                }
                            }
                            done.send(fail(err));
                        });
            } catch (Throwable e) {
                done.send(fail(e));
            }
        });
    }

    private static String fail(Throwable e) {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", false);
            o.put("error", msg(e));
            o.put("granted", new JSONArray());
            o.put("missing", new JSONArray());
        } catch (JSONException ignored) {
            // chave fixa
        }
        return o.toString();
    }

    /* Completa a leitura do Health Connect (days e sleep já montados). seriesFrom = só as noites
     * a partir daqui levam a série de temperatura (igual as outras séries). Volta o resumo pro
     * 🩺 Diagnóstico: {ok, granted, temp: n dias, energy: n dias, score: n noites, errors?}. */
    static JSONObject enrich(Context c, LocalDate from, LocalDate to, ZoneId zone, JSONObject days, JSONArray sleep,
            long seriesFrom, int bucketMin) {
        JSONObject info = new JSONObject();
        try {
            HealthDataStore store;
            Set<Permission> got;
            try {
                store = HealthDataService.getStore(c);
                got = store.getGrantedPermissionsAsync(perms()).get(WAIT_S, TimeUnit.SECONDS);
            } catch (Throwable e) {
                info.put("ok", false);
                info.put("error", msg(e));
                return info;
            }
            info.put("ok", true);
            fillStatus(info, got);
            JSONObject errors = new JSONObject();
            Instant t0 = from.minusDays(1).atTime(12, 0).atZone(zone).toInstant();
            Instant t1 = to.plusDays(1).atStartOfDay(zone).toInstant();

            if (got.contains(Permission.of(DataTypes.SKIN_TEMPERATURE, AccessType.READ))) {
                try {
                    info.put("temp", skinTemp(store, t0, t1, from, to, zone, days, sleep, seriesFrom, bucketMin));
                } catch (Throwable e) {
                    errors.put("temp", msg(e));
                }
            }
            if (got.contains(Permission.of(DataTypes.ENERGY_SCORE, AccessType.READ))) {
                try {
                    info.put("energy", energy(store, from, to, days));
                } catch (Throwable e) {
                    errors.put("energy", msg(e));
                }
            }
            if (got.contains(Permission.of(DataTypes.SLEEP, AccessType.READ))) {
                try {
                    info.put("score", sleepScore(store, t0, t1, sleep));
                } catch (Throwable e) {
                    errors.put("score", msg(e));
                }
            }
            if (errors.length() > 0) info.put("errors", errors);
        } catch (JSONException ignored) {
            // chave fixa
        }
        return info;
    }

    private static List<HealthDataPoint> readTime(HealthDataStore store, DataType.SkinTemperatureType type, Instant t0, Instant t1)
            throws Exception {
        List<HealthDataPoint> all = new ArrayList<>();
        String token = null;
        for (int page = 0; page < MAX_PAGES; page++) {
            com.samsung.android.sdk.health.data.request.ReadDataRequest.DualTimeBuilder<HealthDataPoint> b =
                    type.getReadDataRequestBuilder().setInstantTimeFilter(InstantTimeFilter.of(t0, t1)).setPageSize(PAGE);
            if (token != null) b.setPageToken(token);
            DataResponse<HealthDataPoint> r = store.readDataAsync(b.build()).get(WAIT_S, TimeUnit.SECONDS);
            all.addAll(r.getDataList());
            token = r.getPageToken();
            if (token == null || token.isEmpty()) break;
        }
        return all;
    }

    // 🌡️ Temperatura da pele: média da noite por dia (o dia em que acorda) + série nas sessões recentes
    private static int skinTemp(HealthDataStore store, Instant t0, Instant t1, LocalDate from, LocalDate to, ZoneId zone,
            JSONObject days, JSONArray sleep, long seriesFrom, int bucketMin) throws Exception {
        List<long[]> pts = new ArrayList<>(); // {ms, valor*100}
        for (HealthDataPoint p : readTime(store, DataTypes.SKIN_TEMPERATURE, t0, t1)) {
            List<SkinTemperature> series = null;
            try {
                series = p.getValue(DataType.SkinTemperatureType.SERIES_DATA);
            } catch (Throwable ignored) {
                // ponto sem série
            }
            if (series != null && !series.isEmpty()) {
                for (SkinTemperature s : series) add(pts, s.getStartTime(), s.getSkinTemperature());
            } else {
                Float v = p.getValue(DataType.SkinTemperatureType.SKIN_TEMPERATURE);
                if (v != null) add(pts, p.getStartTime(), v);
            }
        }
        Map<String, double[]> acc = new HashMap<>();
        for (long[] q : pts) {
            LocalDateTime at = LocalDateTime.ofInstant(Instant.ofEpochMilli(q[0]), zone);
            LocalDate day = at.toLocalTime().isBefore(LocalTime.of(NIGHT_FROM_HOUR, 0)) ? at.toLocalDate() : at.toLocalDate().plusDays(1);
            if (day.isBefore(from) || day.isAfter(to)) continue;
            double[] a = acc.get(day.toString());
            if (a == null) acc.put(day.toString(), a = new double[2]);
            a[0] += q[1] / 100.0;
            a[1] += 1;
        }
        for (Map.Entry<String, double[]> e : acc.entrySet()) {
            JSONObject d = days.optJSONObject(e.getKey());
            if (d == null) {
                d = new JSONObject();
                days.put(e.getKey(), d);
            }
            d.put("temp", Math.round(e.getValue()[0] / e.getValue()[1] * 10) / 10.0);
        }
        // série dentro de cada sessão (blocos iguais aos de FC/oxigênio), 2 casas
        for (int i = 0; i < sleep.length(); i++) {
            JSONObject o = sleep.optJSONObject(i);
            if (o == null) continue;
            long start = o.optLong("start"), end = o.optLong("end");
            if (end < seriesFrom || end <= start) continue;
            long bucketMs = bucketMin * 60000L;
            int n = (int) Math.min(200, (end - start + bucketMs - 1) / bucketMs);
            double[] sum = new double[n];
            int[] cnt = new int[n];
            boolean found = false;
            for (long[] q : pts) {
                if (q[0] < start || q[0] >= end) continue;
                int k = (int) ((q[0] - start) / bucketMs);
                if (k < 0 || k >= n) continue;
                sum[k] += q[1] / 100.0;
                cnt[k]++;
                found = true;
            }
            if (!found) continue;
            JSONArray tp = new JSONArray();
            for (int k = 0; k < n; k++) {
                if (cnt[k] > 0) tp.put(Math.round(sum[k] / cnt[k] * 100) / 100.0);
                else tp.put(JSONObject.NULL);
            }
            if (!o.has("bk")) o.put("bk", bucketMin);
            o.put("tp", tp);
        }
        return acc.size();
    }

    private static void add(List<long[]> pts, Instant at, float v) {
        if (at == null || !(v >= 25 && v <= 42)) return; // fora disso é leitura torta
        pts.add(new long[]{at.toEpochMilli(), Math.round(v * 100)});
    }

    // 🔋 Energy Score (0–100) por dia
    private static int energy(HealthDataStore store, LocalDate from, LocalDate to, JSONObject days) throws Exception {
        int n = 0;
        String token = null;
        for (int page = 0; page < MAX_PAGES; page++) {
            com.samsung.android.sdk.health.data.request.ReadDataRequest.LocalDateBuilder<HealthDataPoint> b =
                    DataTypes.ENERGY_SCORE.getReadDataRequestBuilder()
                            .setLocalDateFilter(LocalDateFilter.of(from, to.plusDays(1))).setPageSize(PAGE);
            if (token != null) b.setPageToken(token);
            DataResponse<HealthDataPoint> r = store.readDataAsync(b.build()).get(WAIT_S, TimeUnit.SECONDS);
            for (HealthDataPoint p : r.getDataList()) {
                Float v = p.getValue(DataType.EnergyScoreType.ENERGY_SCORE);
                LocalDateTime at = p.getStartLocalDateTime();
                if (v == null || at == null || !(v > 0 && v <= 100)) continue;
                LocalDate day = at.toLocalDate();
                if (day.isBefore(from) || day.isAfter(to)) continue;
                JSONObject d = days.optJSONObject(day.toString());
                if (d == null) {
                    d = new JSONObject();
                    days.put(day.toString(), d);
                }
                d.put("energy", Math.round(v));
                n++;
            }
            token = r.getPageToken();
            if (token == null || token.isEmpty()) break;
        }
        return n;
    }

    // 🤡 Nota de sono do Samsung: vai pra sessão do Health Connect com o mesmo horário (±20 min)
    private static int sleepScore(HealthDataStore store, Instant t0, Instant t1, JSONArray sleep) throws Exception {
        int n = 0;
        String token = null;
        for (int page = 0; page < MAX_PAGES; page++) {
            com.samsung.android.sdk.health.data.request.ReadDataRequest.DualTimeBuilder<HealthDataPoint> b =
                    DataTypes.SLEEP.getReadDataRequestBuilder().setInstantTimeFilter(InstantTimeFilter.of(t0, t1)).setPageSize(PAGE);
            if (token != null) b.setPageToken(token);
            DataResponse<HealthDataPoint> r = store.readDataAsync(b.build()).get(WAIT_S, TimeUnit.SECONDS);
            for (HealthDataPoint p : r.getDataList()) {
                Integer score = p.getValue(DataType.SleepType.SLEEP_SCORE);
                if (score == null || score <= 0 || score > 100 || p.getStartTime() == null || p.getEndTime() == null) continue;
                long s = p.getStartTime().toEpochMilli(), e = p.getEndTime().toEpochMilli();
                for (int i = 0; i < sleep.length(); i++) {
                    JSONObject o = sleep.optJSONObject(i);
                    if (o == null) continue;
                    if (Math.abs(o.optLong("start") - s) <= 20 * 60000L && Math.abs(o.optLong("end") - e) <= 20 * 60000L) {
                        o.put("score", score);
                        n++;
                        break;
                    }
                }
            }
            token = r.getPageToken();
            if (token == null || token.isEmpty()) break;
        }
        return n;
    }

    private static String msg(Throwable e) {
        Throwable t = e instanceof ExecutionException && e.getCause() != null ? e.getCause() : e;
        String m = t.getClass().getSimpleName();
        if (t instanceof HealthDataException && ((HealthDataException) t).getErrorCode() != null) {
            m += " " + ((HealthDataException) t).getErrorCode();
        }
        if (t.getMessage() != null) m += ": " + t.getMessage();
        return m.length() > 200 ? m.substring(0, 200) : m;
    }
}
