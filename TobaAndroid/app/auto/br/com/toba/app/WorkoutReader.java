package br.com.toba.app;

import android.annotation.TargetApi;
import android.content.Context;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.DistanceRecord;
import android.health.connect.datatypes.ElevationGainedRecord;
import android.health.connect.datatypes.ExerciseLap;
import android.health.connect.datatypes.ExerciseRoute;
import android.health.connect.datatypes.ExerciseSegment;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.HeartRateRecord;
import android.health.connect.datatypes.SpeedRecord;
import android.health.connect.datatypes.StepsCadenceRecord;
import android.health.connect.datatypes.Vo2MaxRecord;
import android.health.connect.datatypes.units.Length;
import android.os.OutcomeReceiver;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * v2.10 (APK 3.3): 🔬 Raio-X do treino. Lê, sob demanda, o "por dentro" de UM exercício do
 * Health Connect (o site pede quando abre a página do treino, e vai completando os antigos
 * calado): batimento ao longo do treino + 5 min depois (recuperação), velocidade, cadência,
 * distância acumulada (pra montar o km a km), subida, voltas, segmentos, VO₂ máx do último ano
 * e o mapa (rota), quando o Samsung manda e o Android deixa.
 *
 * Só leitura, igual o HealthReader. Tudo que falhar só fica de fora (vai pro "errors").
 * Séries vão em blocos de BUCKET_S segundos ([segundos desde o início, valor]); o site afina
 * de novo antes de guardar.
 *
 * Mapa: no Android 15+ com READ_EXERCISE_ROUTES o getRoute() já vem. No 14 (ou sem essa
 * permissão) o Android só entrega com um "sim" da pessoa por treino: o site mostra o botão e
 * chama TobaNative.healthRoute(hcId) -> MainActivity.askExerciseRoute -> onTobaHealthRoute.
 */
@TargetApi(34)
final class WorkoutReader {
    private static final int BUCKET_S = 5;
    private static final int AFTER_S = 300;         // 5 min depois do fim: queda do batimento
    private static final int ROUTE_MAX = 1500;      // pontos do mapa mandados pro site
    private static final int VO2_DAYS = 400;
    private static final long WAIT_S = 25;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

    private WorkoutReader() {
    }

    // start/end em ms (do exercício que o healthRead mandou). Resposta: done.send(json)
    static void read(Context c, long start, long end, HealthReader.Done done) {
        WORKER.execute(() -> {
            JSONObject out;
            try {
                out = readNow(c.getApplicationContext(), start, end);
            } catch (Exception e) {
                out = new JSONObject();
                try {
                    out.put("ok", false);
                    out.put("error", HealthReader.msg(e));
                } catch (JSONException ignored) {
                    // chave fixa
                }
            }
            done.send(out.toString());
        });
    }

    private static TimeInstantRangeFilter range(Instant a, Instant b) {
        return new TimeInstantRangeFilter.Builder().setStartTime(a).setEndTime(b).build();
    }

    private static JSONObject readNow(Context c, long startMs, long endMs) throws Exception {
        HealthConnectManager hc = c.getSystemService(HealthConnectManager.class);
        JSONObject out = new JSONObject();
        JSONObject errors = new JSONObject();
        if (hc == null) {
            out.put("ok", false);
            out.put("error", "sem Health Connect");
            return out;
        }
        Instant s0 = Instant.ofEpochMilli(startMs);
        Instant e0 = Instant.ofEpochMilli(endMs);
        String[][] P = HealthReader.PERMS;

        // A sessão de verdade (pros laps/segmentos/mapa): a que começa mais perto do start pedido.
        ExerciseSessionRecord session = null;
        if (HealthReader.has(c, P, "exercise")) {
            try {
                long best = Long.MAX_VALUE;
                for (ExerciseSessionRecord r : HealthReader.readAll(hc, ExerciseSessionRecord.class,
                        range(s0.minusSeconds(120), e0.plusSeconds(120)))) {
                    long d = Math.abs(r.getStartTime().toEpochMilli() - startMs) + Math.abs(r.getEndTime().toEpochMilli() - endMs);
                    if (d < best) {
                        best = d;
                        session = r;
                    }
                }
            } catch (Exception e) {
                errors.put("session", HealthReader.msg(e));
            }
        }
        if (session != null) {
            s0 = session.getStartTime();
            e0 = session.getEndTime();
            startMs = s0.toEpochMilli();
            endMs = e0.toEpochMilli();
            out.put("hcId", session.getMetadata().getId());
            out.put("type", session.getExerciseType());
            out.put("rec", session.getMetadata().getRecordingMethod());
            out.put("origin", HealthReader.origin(session));
            laps(session, startMs, out, errors);
            segments(session, startMs, out, errors);
            route(c, session, out, errors);
        }
        out.put("start", startMs);
        out.put("end", endMs);
        int n = (int) Math.max(1, (endMs - startMs) / 1000 / BUCKET_S + 1);

        if (HealthReader.has(c, P, "heart")) {
            try {
                double[] sum = new double[n];
                int[] cnt = new int[n];
                List<long[]> after = new ArrayList<>();
                for (HeartRateRecord h : HealthReader.readAll(hc, HeartRateRecord.class, range(s0, e0.plusSeconds(AFTER_S)))) {
                    for (HeartRateRecord.HeartRateSample smp : h.getSamples()) {
                        long t = smp.getTime().toEpochMilli();
                        long bpm = smp.getBeatsPerMinute();
                        if (bpm < 30 || bpm > 230 || t < startMs) continue;
                        if (t > endMs) {
                            if (t - endMs <= AFTER_S * 1000L) after.add(new long[] {(t - endMs) / 1000, bpm});
                            continue;
                        }
                        int i = (int) ((t - startMs) / 1000 / BUCKET_S);
                        if (i >= n) continue;
                        sum[i] += bpm;
                        cnt[i]++;
                    }
                }
                JSONArray a = series(sum, cnt, 1);
                if (a != null) out.put("hr", a);
                if (!after.isEmpty()) {
                    Collections.sort(after, (x, y) -> Long.compare(x[0], y[0]));
                    JSONArray b = new JSONArray();
                    for (long[] p : after) b.put(new JSONArray().put(p[0]).put(p[1]));
                    out.put("hrAfter", b);
                }
            } catch (Exception e) {
                errors.put("hr", HealthReader.msg(e));
            }
        }

        if (HealthReader.has(c, P, "speed")) {
            try {
                double[] sum = new double[n];
                int[] cnt = new int[n];
                for (SpeedRecord r : HealthReader.readAll(hc, SpeedRecord.class, range(s0, e0))) {
                    for (SpeedRecord.SpeedRecordSample smp : r.getSamples()) {
                        long t = smp.getTime().toEpochMilli();
                        double kmh = smp.getSpeed().getInMetersPerSecond() * 3.6;
                        if (t < startMs || t > endMs || kmh < 0 || kmh > 80) continue;
                        int i = (int) ((t - startMs) / 1000 / BUCKET_S);
                        if (i >= n) continue;
                        sum[i] += kmh;
                        cnt[i]++;
                    }
                }
                JSONArray a = series(sum, cnt, 10);
                if (a != null) out.put("spd", a);
            } catch (Exception e) {
                errors.put("spd", HealthReader.msg(e));
            }
        }

        if (HealthReader.has(c, P, "steps")) {
            try {
                double[] sum = new double[n];
                int[] cnt = new int[n];
                for (StepsCadenceRecord r : HealthReader.readAll(hc, StepsCadenceRecord.class, range(s0, e0))) {
                    for (StepsCadenceRecord.StepsCadenceRecordSample smp : r.getSamples()) {
                        long t = smp.getTime().toEpochMilli();
                        double spm = smp.getRate();
                        if (t < startMs || t > endMs || spm <= 0 || spm > 260) continue;
                        int i = (int) ((t - startMs) / 1000 / BUCKET_S);
                        if (i >= n) continue;
                        sum[i] += spm;
                        cnt[i]++;
                    }
                }
                JSONArray a = series(sum, cnt, 1);
                if (a != null) out.put("cad", a);
            } catch (Exception e) {
                errors.put("cad", HealthReader.msg(e));
            }
        }

        // Distância em pedacinhos -> [segundo do fim do pedaço, metros acumulados] (pro km a km sem mapa).
        // Duas fontes (celular + relógio)? Fica com a que somou mais, igual o resto do Toba.
        if (HealthReader.has(c, P, "distance")) {
            try {
                java.util.Map<String, List<long[]>> byOrigin = new java.util.HashMap<>();
                for (DistanceRecord r : HealthReader.readAll(hc, DistanceRecord.class, range(s0, e0))) {
                    long t = Math.min(r.getEndTime().toEpochMilli(), endMs);
                    long m = Math.round(r.getDistance().getInMeters() * 10); // decímetros
                    if (m <= 0) continue;
                    byOrigin.computeIfAbsent(HealthReader.origin(r), k -> new ArrayList<>()).add(new long[] {t, m});
                }
                List<long[]> best = null;
                long bestSum = 0;
                for (List<long[]> l : byOrigin.values()) {
                    long sum = 0;
                    for (long[] p : l) sum += p[1];
                    if (sum > bestSum) {
                        bestSum = sum;
                        best = l;
                    }
                }
                if (best != null && best.size() >= 2) {
                    Collections.sort(best, (x, y) -> Long.compare(x[0], y[0]));
                    JSONArray a = new JSONArray();
                    long acc = 0;
                    for (long[] p : best) {
                        acc += p[1];
                        a.put(new JSONArray().put((p[0] - startMs) / 1000).put(Math.round(acc / 10.0)));
                    }
                    out.put("dist", a);
                }
            } catch (Exception e) {
                errors.put("dist", HealthReader.msg(e));
            }
        }

        if (HealthReader.has(c, P, "elevation")) {
            try {
                AggregateRecordsRequest<Length> req = new AggregateRecordsRequest.Builder<Length>(range(s0, e0))
                        .addAggregationType(ElevationGainedRecord.ELEVATION_GAINED_TOTAL).build();
                CompletableFuture<AggregateRecordsResponse<Length>> f = new CompletableFuture<>();
                hc.aggregate(req, Runnable::run, new OutcomeReceiver<AggregateRecordsResponse<Length>, HealthConnectException>() {
                    @Override
                    public void onResult(AggregateRecordsResponse<Length> result) {
                        f.complete(result);
                    }

                    @Override
                    public void onError(HealthConnectException error) {
                        f.completeExceptionally(error);
                    }
                });
                Length l = f.get(WAIT_S, TimeUnit.SECONDS).get(ElevationGainedRecord.ELEVATION_GAINED_TOTAL);
                if (l != null && l.getInMeters() > 0) out.put("elevGain", Math.round(l.getInMeters()));
            } catch (Exception e) {
                errors.put("elev", HealthReader.msg(e));
            }
        }

        // VO₂ máx do último ano (o Samsung mede em caminhada/corrida ao ar livre): [ms, valor]
        if (HealthReader.has(c, P, "vo2")) {
            try {
                JSONArray a = new JSONArray();
                for (Vo2MaxRecord r : HealthReader.readAll(hc, Vo2MaxRecord.class,
                        range(e0.minus(Duration.ofDays(VO2_DAYS)), e0.plus(Duration.ofHours(6))))) {
                    double v = r.getVo2MillilitersPerMinuteKilogram();
                    if (v < 10 || v > 95) continue;
                    a.put(new JSONArray().put(r.getTime().toEpochMilli()).put(Math.round(v * 10) / 10.0));
                }
                if (a.length() > 0) out.put("vo2", a);
            } catch (Exception e) {
                errors.put("vo2", HealthReader.msg(e));
            }
        }

        out.put("ok", true);
        out.put("errors", errors);
        return out;
    }

    private static JSONArray series(double[] sum, int[] cnt, int dec) throws JSONException {
        JSONArray a = new JSONArray();
        for (int i = 0; i < sum.length; i++) {
            if (cnt[i] == 0) continue;
            double v = sum[i] / cnt[i];
            a.put(new JSONArray().put(i * BUCKET_S).put(dec > 1 ? Math.round(v * dec) / (double) dec : Math.round(v)));
        }
        return a.length() > 0 ? a : null;
    }

    // [[s, e (segundos desde o início), metros]]
    private static void laps(ExerciseSessionRecord r, long startMs, JSONObject out, JSONObject errors) throws JSONException {
        try {
            List<ExerciseLap> list = r.getLaps();
            if (list == null || list.isEmpty()) return;
            JSONArray a = new JSONArray();
            for (ExerciseLap l : list) {
                Length len = l.getLength();
                a.put(new JSONArray()
                        .put((l.getStartTime().toEpochMilli() - startMs) / 1000)
                        .put((l.getEndTime().toEpochMilli() - startMs) / 1000)
                        .put(len == null ? 0 : Math.round(len.getInMeters())));
            }
            out.put("laps", a);
        } catch (Exception e) {
            errors.put("laps", HealthReader.msg(e));
        }
    }

    // [[s, e, tipo do segmento, repetições]]
    private static void segments(ExerciseSessionRecord r, long startMs, JSONObject out, JSONObject errors) throws JSONException {
        try {
            List<ExerciseSegment> list = r.getSegments();
            if (list == null || list.isEmpty()) return;
            JSONArray a = new JSONArray();
            for (ExerciseSegment g : list) {
                a.put(new JSONArray()
                        .put((g.getStartTime().toEpochMilli() - startMs) / 1000)
                        .put((g.getEndTime().toEpochMilli() - startMs) / 1000)
                        .put(g.getSegmentType())
                        .put(g.getRepetitionsCount()));
            }
            out.put("segs", a);
        } catch (Exception e) {
            errors.put("segs", HealthReader.msg(e));
        }
    }

    private static void route(Context c, ExerciseSessionRecord r, JSONObject out, JSONObject errors) throws JSONException {
        try {
            if (!r.hasRoute()) return;
            out.put("hasRoute", 1);
            ExerciseRoute route = r.getRoute();
            if (route == null) {
                out.put("routeAsk", 1); // tem, mas o Android quer o "sim" da pessoa pra esse treino
                return;
            }
            JSONArray a = routeJson(route, r.getStartTime().toEpochMilli());
            if (a != null) out.put("route", a);
        } catch (Exception e) {
            errors.put("route", HealthReader.msg(e));
        }
    }

    // [[segundos desde o início, lat, lng, altitude|null]], no máximo ROUTE_MAX pontos (pula igual)
    static JSONArray routeJson(ExerciseRoute route, long startMs) throws JSONException {
        List<ExerciseRoute.Location> pts = route.getRouteLocations();
        if (pts == null || pts.isEmpty()) return null;
        int step = Math.max(1, (pts.size() + ROUTE_MAX - 1) / ROUTE_MAX);
        JSONArray a = new JSONArray();
        for (int i = 0; i < pts.size(); i += step) {
            a.put(point(pts.get(i), startMs));
        }
        if ((pts.size() - 1) % step != 0) a.put(point(pts.get(pts.size() - 1), startMs));
        return a;
    }

    private static JSONArray point(ExerciseRoute.Location p, long startMs) throws JSONException {
        Length alt = p.getAltitude();
        return new JSONArray()
                .put((p.getTime().toEpochMilli() - startMs) / 1000)
                .put(Math.round(p.getLatitude() * 1e6) / 1e6)
                .put(Math.round(p.getLongitude() * 1e6) / 1e6)
                .put(alt == null ? JSONObject.NULL : Math.round(alt.getInMeters() * 10) / 10.0);
    }
}
