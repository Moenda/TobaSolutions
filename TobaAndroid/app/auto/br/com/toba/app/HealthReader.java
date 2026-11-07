package br.com.toba.app;

import android.annotation.TargetApi;
import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.AggregateRecordsGroupedByPeriodResponse;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.LocalTimeRangeFilter;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ActiveCaloriesBurnedRecord;
import android.health.connect.datatypes.AggregationType;
import android.health.connect.datatypes.DataOrigin;
import android.health.connect.datatypes.DistanceRecord;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.FloorsClimbedRecord;
import android.health.connect.datatypes.HeartRateRecord;
import android.health.connect.datatypes.HeartRateVariabilityRmssdRecord;
import android.health.connect.datatypes.OxygenSaturationRecord;
import android.health.connect.datatypes.Record;
import android.health.connect.datatypes.RespiratoryRateRecord;
import android.health.connect.datatypes.RestingHeartRateRecord;
import android.health.connect.datatypes.SleepSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.health.connect.datatypes.TotalCaloriesBurnedRecord;
import android.health.connect.datatypes.units.Energy;
import android.health.connect.datatypes.units.Length;
import android.os.OutcomeReceiver;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.LocalTime;
import java.time.Period;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;

/**
 * v1.87 (APK 2.2): ⌚ Relógio do Toba Health. Lê do Health Connect do Android 14+
 * (o Galaxy Watch manda pro Samsung Health, que manda pro Health Connect) e
 * devolve resumos por dia pro site (TobaBridge.healthRead -> window.onTobaHealthData).
 *
 * Usa o Health Connect que já vem DENTRO do Android 14 (android.health.connect),
 * sem biblioteca nova no Gradle. Só leitura: o Toba nunca grava nada lá.
 * Quem chama checa Build.VERSION.SDK_INT >= 34 antes (essa classe nem carrega antes disso).
 *
 * Números por dia vêm da soma do próprio Health Connect (aggregateGroupByPeriod).
 * v1.93 (APK 2.4): ele NÃO tira a duplicata quando o Samsung Health grava o dia inteiro
 * num registro só e o próprio celular ("S24+ de ...") grava os passos em pedacinhos:
 * somava os dois (6.500 + 2.200). Agora passos, distância e calorias vêm de UMA fonte
 * por dia: soma por app (filtro de origem) e fica com a MAIOR. Quem tem relógio fica com
 * o Samsung Health (que já junta relógio + celular); quem não tem, com o celular.
 * v1.89 (APK 2.3): cada exercício vem com kcal/km/passos/FC do horário dele (sessionStats).
 * v1.94 (APK 2.5, 🩻 RAIO ULTRA X): HRV, oxigenação (SpO2) e respiração da NOITE (medida
 * das 18h em diante conta pro dia seguinte, o dia em que acorda) + andares do dia (uma fonte só).
 * Stress, Energy Score, temperatura da pele e ronco o Samsung não manda pro Health Connect:
 * esses só pelo 📥 histórico do Samsung.
 */
@TargetApi(34)
final class HealthReader {
    // {nome que o site usa, permissão}. Mudou aqui? Mude também o AndroidManifest.xml.
    static final String[][] PERMS = {
            {"steps", "android.permission.health.READ_STEPS"},
            {"sleep", "android.permission.health.READ_SLEEP"},
            {"kcal", "android.permission.health.READ_TOTAL_CALORIES_BURNED"},
            {"activeKcal", "android.permission.health.READ_ACTIVE_CALORIES_BURNED"},
            {"distance", "android.permission.health.READ_DISTANCE"},
            {"heart", "android.permission.health.READ_HEART_RATE"},
            {"restHr", "android.permission.health.READ_RESTING_HEART_RATE"},
            {"exercise", "android.permission.health.READ_EXERCISE"},
            // v1.94 (APK 2.5)
            {"hrv", "android.permission.health.READ_HEART_RATE_VARIABILITY"},
            {"spo2", "android.permission.health.READ_OXYGEN_SATURATION"},
            {"resp", "android.permission.health.READ_RESPIRATORY_RATE"},
            {"floors", "android.permission.health.READ_FLOORS_CLIMBED"},
    };
    private static final int MAX_DAYS = 120;
    private static final int NIGHT_FROM_HOUR = 18; // v1.94: medida das 18h em diante = noite do dia seguinte
    private static final long WAIT_S = 25;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

    interface Done {
        void send(String json);
    }

    private HealthReader() {
    }

    static boolean available(Context c) {
        try {
            return c.getSystemService(HealthConnectManager.class) != null;
        } catch (Exception e) {
            return false;
        }
    }

    static boolean has(Context c, String perm) {
        return c.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    // {ok, sdk, granted: ["steps", ...], missing: [...]}
    static JSONObject status(Context c) {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", available(c));
            o.put("sdk", android.os.Build.VERSION.SDK_INT);
            JSONArray granted = new JSONArray();
            JSONArray missing = new JSONArray();
            for (String[] p : PERMS) {
                if (has(c, p[1])) granted.put(p[0]);
                else missing.put(p[0]);
            }
            o.put("granted", granted);
            o.put("missing", missing);
        } catch (JSONException ignored) {
            // JSON de chave fixa não falha
        }
        return o;
    }

    static String[] missingPerms(Context c) {
        List<String> out = new ArrayList<>();
        for (String[] p : PERMS) {
            if (!has(c, p[1])) out.add(p[1]);
        }
        return out.toArray(new String[0]);
    }

    private static boolean has(Context c, String[][] perms, String name) {
        for (String[] p : perms) {
            if (p[0].equals(name)) return has(c, p[1]);
        }
        return false;
    }

    // from/to = "AAAA-MM-DD" (dias do celular, inclusive). Roda fora da tela (thread própria).
    static void read(Context c, String from, String to, Done done) {
        WORKER.execute(() -> {
            JSONObject out;
            try {
                out = readNow(c.getApplicationContext(), LocalDate.parse(from), LocalDate.parse(to));
            } catch (Exception e) {
                out = new JSONObject();
                try {
                    out.put("ok", false);
                    out.put("error", msg(e));
                } catch (JSONException ignored) {
                    // chave fixa
                }
            }
            done.send(out.toString());
        });
    }

    private static JSONObject readNow(Context c, LocalDate from, LocalDate to) throws JSONException {
        JSONObject out = new JSONObject();
        HealthConnectManager hc = c.getSystemService(HealthConnectManager.class);
        if (hc == null) {
            out.put("ok", false);
            out.put("error", "sem Health Connect");
            return out;
        }
        if (to.isBefore(from)) {
            LocalDate t = from;
            from = to;
            to = t;
        }
        if (from.isBefore(to.minusDays(MAX_DAYS))) from = to.minusDays(MAX_DAYS);

        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        LocalTimeRangeFilter range = new LocalTimeRangeFilter.Builder().setStartTime(start).setEndTime(end).build();
        JSONObject days = new JSONObject();
        JSONObject errors = new JSONObject();

        // v1.93: quem gravou cada tipo no período (pra não somar celular + Samsung Health)
        ZoneId zone = ZoneId.systemDefault();
        TimeInstantRangeFilter whole = new TimeInstantRangeFilter.Builder()
                .setStartTime(start.atZone(zone).toInstant())
                .setEndTime(end.atZone(zone).toInstant())
                .build();
        List<String> stepOrigins = new ArrayList<>();
        List<String> kcalOrigins = new ArrayList<>();
        List<String> activeOrigins = new ArrayList<>();
        List<String> distOrigins = new ArrayList<>();
        JSONObject sources = new JSONObject();
        if (has(c, PERMS, "steps")) {
            stepOrigins = origins(hc, StepsRecord.class, whole);
            byDayOneSource(hc, range, StepsRecord.STEPS_COUNT_TOTAL, "steps", v -> v, stepOrigins, days, errors);
        }
        if (has(c, PERMS, "kcal")) {
            kcalOrigins = origins(hc, TotalCaloriesBurnedRecord.class, whole);
            byDayOneSource(hc, range, TotalCaloriesBurnedRecord.ENERGY_TOTAL, "kcal", HealthReader::kcal, kcalOrigins, days, errors);
        }
        if (has(c, PERMS, "activeKcal")) {
            activeOrigins = origins(hc, ActiveCaloriesBurnedRecord.class, whole);
            byDayOneSource(hc, range, ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, "activeKcal", HealthReader::kcal, activeOrigins, days, errors);
        }
        if (has(c, PERMS, "distance")) {
            distOrigins = origins(hc, DistanceRecord.class, whole);
            byDayOneSource(hc, range, DistanceRecord.DISTANCE_TOTAL, "distanceM", HealthReader::meters, distOrigins, days, errors);
        }
        sources.put("steps", new JSONArray(stepOrigins));
        sources.put("kcal", new JSONArray(kcalOrigins));
        sources.put("activeKcal", new JSONArray(activeOrigins));
        sources.put("distance", new JSONArray(distOrigins));
        if (has(c, PERMS, "heart")) {
            byDay(hc, range, HeartRateRecord.BPM_AVG, "hrAvg", v -> v, days, errors);
            byDay(hc, range, HeartRateRecord.BPM_MIN, "hrMin", v -> v, days, errors);
            byDay(hc, range, HeartRateRecord.BPM_MAX, "hrMax", v -> v, days, errors);
        }
        if (has(c, PERMS, "restHr")) {
            byDay(hc, range, RestingHeartRateRecord.BPM_AVG, "restHr", v -> v, days, errors);
        }
        // v1.94 (APK 2.5): andares do dia, de uma fonte só (igual passos)
        if (has(c, PERMS, "floors")) {
            List<String> floorOrigins = origins(hc, FloorsClimbedRecord.class, whole);
            byDayOneSource(hc, range, FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL, "floors",
                    v -> v != null && v > 0 ? (Object) Math.round(v) : null, floorOrigins, days, errors);
            sources.put("floors", new JSONArray(floorOrigins));
        }
        // v1.94 (APK 2.5): medidas da noite. Começa às 18h da véspera do 1º dia.
        TimeInstantRangeFilter nights = new TimeInstantRangeFilter.Builder()
                .setStartTime(from.minusDays(1).atTime(NIGHT_FROM_HOUR, 0).atZone(zone).toInstant())
                .setEndTime(end.atZone(zone).toInstant())
                .build();
        if (has(c, PERMS, "hrv")) {
            nightly(hc, HeartRateVariabilityRmssdRecord.class, nights, r -> r.getHeartRateVariabilityMillis(), r -> r.getTime(),
                    1, 300, "hrv", null, 1, from, to, zone, days, errors);
        }
        if (has(c, PERMS, "spo2")) {
            nightly(hc, OxygenSaturationRecord.class, nights, r -> r.getPercentage().getValue(), r -> r.getTime(),
                    50, 100, "spo2", "spo2Min", 1, from, to, zone, days, errors);
        }
        if (has(c, PERMS, "resp")) {
            nightly(hc, RespiratoryRateRecord.class, nights, r -> r.getRate(), r -> r.getTime(),
                    4, 60, "resp", null, 10, from, to, zone, days, errors);
        }

        // Sono: começa ao meio-dia da véspera (a noite que acorda no 1º dia entra).
        TimeInstantRangeFilter instants = new TimeInstantRangeFilter.Builder()
                .setStartTime(from.minusDays(1).atTime(12, 0).atZone(zone).toInstant())
                .setEndTime(end.atZone(zone).toInstant())
                .build();
        JSONArray sleep = new JSONArray();
        if (has(c, PERMS, "sleep")) {
            try {
                for (SleepSessionRecord r : readAll(hc, SleepSessionRecord.class, instants)) {
                    sleep.put(sleepJson(r));
                }
            } catch (Exception e) {
                errors.put("sleep", msg(e));
            }
        }
        JSONArray exercises = new JSONArray();
        if (has(c, PERMS, "exercise")) {
            try {
                for (ExerciseSessionRecord r : readAll(hc, ExerciseSessionRecord.class, instants)) {
                    JSONObject x = new JSONObject();
                    x.put("start", r.getStartTime().toEpochMilli());
                    x.put("end", r.getEndTime().toEpochMilli());
                    x.put("type", r.getExerciseType());
                    CharSequence title = r.getTitle();
                    if (title != null && title.length() > 0) x.put("title", title.toString());
                    x.put("origin", origin(r));
                    // v1.89 (APK 2.3): números da sessão pro mesclar com o treino do Toba
                    sessionStats(c, hc, r, x, stepOrigins, kcalOrigins, activeOrigins, distOrigins);
                    exercises.put(x);
                }
            } catch (Exception e) {
                errors.put("exercise", msg(e));
            }
        }

        out.put("ok", true);
        out.put("from", from.toString());
        out.put("to", to.toString());
        out.put("days", days);
        out.put("sleep", sleep);
        out.put("exercises", exercises);
        out.put("errors", errors);
        out.put("sources", sources); // v1.93: apps que gravaram cada tipo (pro 🩺 Diagnóstico)
        out.put("status", status(c));
        return out;
    }

    /* v1.94 (APK 2.5): medida pontual da noite (HRV, SpO2, respiração) -> média por dia.
     * O dia é o da manhã em que acorda: das 18h em diante conta pro dia seguinte.
     * min/max = faixa que faz sentido (fora disso é leitura torta e fica de fora).
     * minField != null: também manda o menor valor da noite (o SpO2 mais baixo).
     * dec = 1 (inteiro) ou 10 (uma casa). Falhou? Vai pro errors e segue. */
    private static <T extends Record> void nightly(HealthConnectManager hc, Class<T> cls, TimeInstantRangeFilter filter,
            ToDoubleFunction<T> value, Function<T, Instant> time, double min, double max, String field, String minField, int dec,
            LocalDate from, LocalDate to, ZoneId zone, JSONObject days, JSONObject errors) throws JSONException {
        try {
            Map<String, double[]> acc = new HashMap<>(); // {soma, n, menor}
            for (T r : readAll(hc, cls, filter)) {
                double v = value.applyAsDouble(r);
                if (!(v >= min && v <= max)) continue;
                LocalDateTime at = LocalDateTime.ofInstant(time.apply(r), zone);
                LocalDate day = at.toLocalTime().isBefore(LocalTime.of(NIGHT_FROM_HOUR, 0)) ? at.toLocalDate() : at.toLocalDate().plusDays(1);
                if (day.isBefore(from) || day.isAfter(to)) continue;
                double[] a = acc.get(day.toString());
                if (a == null) {
                    a = new double[]{0, 0, v};
                    acc.put(day.toString(), a);
                }
                a[0] += v;
                a[1] += 1;
                if (v < a[2]) a[2] = v;
            }
            for (Map.Entry<String, double[]> e : acc.entrySet()) {
                double[] a = e.getValue();
                JSONObject d = days.optJSONObject(e.getKey());
                if (d == null) {
                    d = new JSONObject();
                    days.put(e.getKey(), d);
                }
                double avg = a[0] / a[1];
                if (dec > 1) d.put(field, Math.round(avg * dec) / (double) dec);
                else d.put(field, Math.round(avg));
                if (minField != null) d.put(minField, Math.round(a[2]));
            }
        } catch (Exception e) {
            errors.put(field, msg(e));
        }
    }

    // v1.93: apps (pacotes) que gravaram esse tipo no período. Lê os registros (até
    // 20 páginas de 500; deu erro? Lista vazia = conta como antes (soma do Health Connect).
    private static <T extends Record> List<String> origins(HealthConnectManager hc, Class<T> cls, TimeInstantRangeFilter filter) {
        Set<String> out = new LinkedHashSet<>();
        try {
            for (T r : readAll(hc, cls, filter)) {
                String o = origin(r);
                if (!o.isEmpty()) out.add(o);
            }
        } catch (Exception ignored) {
            // sem a lista: cai na soma normal
        }
        return new ArrayList<>(out);
    }

    // v1.93: um número por dia vindo de UMA fonte só: soma de cada app separado e fica a
    // maior do dia. Com 0 ou 1 app, é a soma normal do Health Connect (igual antes).
    private static <T> void byDayOneSource(HealthConnectManager hc, LocalTimeRangeFilter range, AggregationType<T> type,
            String field, Function<T, Object> conv, List<String> sources, JSONObject days, JSONObject errors) throws JSONException {
        if (sources.size() <= 1) {
            byDay(hc, range, type, field, conv, days, errors);
            return;
        }
        JSONObject best = new JSONObject();
        for (String pkg : sources) {
            JSONObject one = new JSONObject();
            JSONObject err = new JSONObject();
            byDay(hc, range, type, field, conv, one, err, pkg);
            if (err.length() > 0 && !errors.has(field)) errors.put(field, err.optString(field));
            Iterator<String> keys = one.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object val = one.getJSONObject(key).opt(field);
                if (!(val instanceof Number)) continue;
                Object had = best.opt(key);
                if (!(had instanceof Number) || ((Number) val).doubleValue() > ((Number) had).doubleValue()) best.put(key, val);
            }
        }
        Iterator<String> keys = best.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject d = days.optJSONObject(key);
            if (d == null) {
                d = new JSONObject();
                days.put(key, d);
            }
            d.put(field, best.get(key));
        }
    }

    private static <T> void byDay(HealthConnectManager hc, LocalTimeRangeFilter range, AggregationType<T> type, String field,
            Function<T, Object> conv, JSONObject days, JSONObject errors) throws JSONException {
        byDay(hc, range, type, field, conv, days, errors, null);
    }

    // Um número por dia. Falhou (permissão tirada no meio, Health Connect ocupado)? Vai pro errors e segue.
    private static <T> void byDay(HealthConnectManager hc, LocalTimeRangeFilter range, AggregationType<T> type, String field,
            Function<T, Object> conv, JSONObject days, JSONObject errors, String pkg) throws JSONException {
        try {
            AggregateRecordsRequest.Builder<T> rb = new AggregateRecordsRequest.Builder<T>(range).addAggregationType(type);
            if (pkg != null) rb.addDataOriginsFilter(new DataOrigin.Builder().setPackageName(pkg).build());
            AggregateRecordsRequest<T> req = rb.build();
            CompletableFuture<List<AggregateRecordsGroupedByPeriodResponse<T>>> f = new CompletableFuture<>();
            hc.aggregateGroupByPeriod(req, Period.ofDays(1), Runnable::run,
                    new OutcomeReceiver<List<AggregateRecordsGroupedByPeriodResponse<T>>, HealthConnectException>() {
                        @Override
                        public void onResult(List<AggregateRecordsGroupedByPeriodResponse<T>> result) {
                            f.complete(result);
                        }

                        @Override
                        public void onError(HealthConnectException error) {
                            f.completeExceptionally(error);
                        }
                    });
            for (AggregateRecordsGroupedByPeriodResponse<T> r : f.get(WAIT_S, TimeUnit.SECONDS)) {
                T v = r.get(type);
                if (v == null) continue;
                Object val = conv.apply(v);
                if (val == null) continue;
                String key = r.getStartTime().toLocalDate().toString();
                JSONObject d = days.optJSONObject(key);
                if (d == null) {
                    d = new JSONObject();
                    days.put(key, d);
                }
                d.put(field, val);
            }
        } catch (Exception e) {
            errors.put(field, msg(e));
        }
    }

    private static <T extends Record> List<T> readAll(HealthConnectManager hc, Class<T> cls, TimeInstantRangeFilter filter)
            throws InterruptedException, ExecutionException, java.util.concurrent.TimeoutException {
        List<T> all = new ArrayList<>();
        long token = -1;
        for (int page = 0; page < 20; page++) {
            ReadRecordsRequestUsingFilters.Builder<T> b = new ReadRecordsRequestUsingFilters.Builder<>(cls)
                    .setTimeRangeFilter(filter)
                    .setPageSize(500);
            if (token != -1) b.setPageToken(token);
            CompletableFuture<ReadRecordsResponse<T>> f = new CompletableFuture<>();
            hc.readRecords(b.build(), Runnable::run, new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
                @Override
                public void onResult(ReadRecordsResponse<T> result) {
                    f.complete(result);
                }

                @Override
                public void onError(HealthConnectException error) {
                    f.completeExceptionally(error);
                }
            });
            ReadRecordsResponse<T> res = f.get(WAIT_S, TimeUnit.SECONDS);
            all.addAll(res.getRecords());
            token = res.getNextPageToken();
            if (token == -1) break;
        }
        return all;
    }

    // v1.89 (APK 2.3): soma do Health Connect só dentro do horário do treino
    // (kcal, kcal ativas, km, passos, FC média/máx). Falhou um? Fica sem aquele número.
    // v1.93: kcal/km/passos também de uma fonte só (a maior), igual o dia.
    private static void sessionStats(Context c, HealthConnectManager hc, ExerciseSessionRecord r, JSONObject x,
            List<String> stepO, List<String> kcalO, List<String> activeO, List<String> distO) {
        TimeInstantRangeFilter t = new TimeInstantRangeFilter.Builder()
                .setStartTime(r.getStartTime()).setEndTime(r.getEndTime()).build();
        if (has(c, PERMS, "kcal")) putOneSource(hc, t, TotalCaloriesBurnedRecord.ENERGY_TOTAL, x, "kcal", HealthReader::kcal, kcalO);
        if (has(c, PERMS, "activeKcal")) putOneSource(hc, t, ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, x, "activeKcal", HealthReader::kcal, activeO);
        if (has(c, PERMS, "distance")) putOneSource(hc, t, DistanceRecord.DISTANCE_TOTAL, x, "distanceM", HealthReader::meters, distO);
        if (has(c, PERMS, "steps")) putOneSource(hc, t, StepsRecord.STEPS_COUNT_TOTAL, x, "steps", v -> v > 0 ? v : null, stepO);
        if (has(c, PERMS, "heart")) {
            putOne(hc, t, HeartRateRecord.BPM_AVG, x, "hrAvg", v -> v > 0 ? v : null);
            putOne(hc, t, HeartRateRecord.BPM_MAX, x, "hrMax", v -> v > 0 ? v : null);
        }
    }

    private static <T> void putOneSource(HealthConnectManager hc, TimeInstantRangeFilter t, AggregationType<T> type, JSONObject x,
            String field, Function<T, Object> conv, List<String> sources) {
        if (sources == null || sources.size() <= 1) {
            putOne(hc, t, type, x, field, conv, null);
            return;
        }
        double best = -1;
        Object bestVal = null;
        for (String pkg : sources) {
            JSONObject one = new JSONObject();
            putOne(hc, t, type, one, field, conv, pkg);
            Object val = one.opt(field);
            if (val instanceof Number && ((Number) val).doubleValue() > best) {
                best = ((Number) val).doubleValue();
                bestVal = val;
            }
        }
        try {
            if (bestVal != null) x.put(field, bestVal);
        } catch (JSONException ignored) {
            // chave fixa
        }
    }

    private static <T> void putOne(HealthConnectManager hc, TimeInstantRangeFilter t, AggregationType<T> type, JSONObject x,
            String field, Function<T, Object> conv) {
        putOne(hc, t, type, x, field, conv, null);
    }

    private static <T> void putOne(HealthConnectManager hc, TimeInstantRangeFilter t, AggregationType<T> type, JSONObject x,
            String field, Function<T, Object> conv, String pkg) {
        try {
            AggregateRecordsRequest.Builder<T> rb = new AggregateRecordsRequest.Builder<T>(t).addAggregationType(type);
            if (pkg != null) rb.addDataOriginsFilter(new DataOrigin.Builder().setPackageName(pkg).build());
            AggregateRecordsRequest<T> req = rb.build();
            CompletableFuture<AggregateRecordsResponse<T>> f = new CompletableFuture<>();
            hc.aggregate(req, Runnable::run, new OutcomeReceiver<AggregateRecordsResponse<T>, HealthConnectException>() {
                @Override
                public void onResult(AggregateRecordsResponse<T> result) {
                    f.complete(result);
                }

                @Override
                public void onError(HealthConnectException error) {
                    f.completeExceptionally(error);
                }
            });
            T v = f.get(WAIT_S, TimeUnit.SECONDS).get(type);
            Object val = v == null ? null : conv.apply(v);
            if (val != null) x.put(field, val);
        } catch (Exception ignored) {
            // sem esse número
        }
    }

    // {start, end (ms), min (dormindo), deep, light, rem, awake, origin}. Sem fases = tudo "dormindo".
    private static JSONObject sleepJson(SleepSessionRecord r) throws JSONException {
        long start = r.getStartTime().toEpochMilli();
        long end = r.getEndTime().toEpochMilli();
        long deep = 0, light = 0, rem = 0, awake = 0, asleep = 0;
        List<SleepSessionRecord.Stage> stages = r.getStages();
        if (stages != null) {
            for (SleepSessionRecord.Stage s : stages) {
                long ms = Math.max(0, s.getEndTime().toEpochMilli() - s.getStartTime().toEpochMilli());
                switch (s.getType()) {
                    case 5: // STAGE_TYPE_SLEEPING_DEEP
                        deep += ms;
                        break;
                    case 4: // STAGE_TYPE_SLEEPING_LIGHT
                        light += ms;
                        break;
                    case 6: // STAGE_TYPE_SLEEPING_REM
                        rem += ms;
                        break;
                    case 1: // AWAKE
                    case 3: // AWAKE_OUT_OF_BED
                    case 7: // AWAKE_IN_BED
                        awake += ms;
                        break;
                    default: // SLEEPING / UNKNOWN
                        asleep += ms;
                        break;
                }
            }
        }
        long sleptMs = deep + light + rem + asleep;
        if (sleptMs <= 0) sleptMs = Math.max(0, end - start - awake);
        JSONObject o = new JSONObject();
        o.put("start", start);
        o.put("end", end);
        o.put("min", Math.round(sleptMs / 60000.0));
        o.put("deep", Math.round(deep / 60000.0));
        o.put("light", Math.round(light / 60000.0));
        o.put("rem", Math.round(rem / 60000.0));
        o.put("awake", Math.round(awake / 60000.0));
        o.put("origin", origin(r));
        return o;
    }

    private static String origin(Record r) {
        try {
            return r.getMetadata().getDataOrigin().getPackageName();
        } catch (Exception e) {
            return "";
        }
    }

    // O Energy do Android guarda em calorias "pequenas": 1 kcal = 1000.
    private static Object kcal(Energy e) {
        double v = e.getInCalories() / 1000.0;
        return v > 0 ? Math.round(v) : null;
    }

    private static Object meters(Length l) {
        double v = l.getInMeters();
        return v > 0 ? Math.round(v) : null;
    }

    private static String msg(Exception e) {
        Throwable t = e instanceof ExecutionException && e.getCause() != null ? e.getCause() : e;
        String m = t.getClass().getSimpleName();
        if (t instanceof HealthConnectException) m += " " + ((HealthConnectException) t).getErrorCode();
        if (t.getMessage() != null) m += ": " + t.getMessage();
        return m.length() > 200 ? m.substring(0, 200) : m;
    }
}
