package br.com.toba.auto;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;
import androidx.car.app.navigation.model.TravelEstimate;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Cérebro do Toba Drive no carro: GPS, onde estou na rota, próxima manobra, voz,
 * recálculo quando sai da rota e chegada. Tudo na main thread (a internet vai no io).
 */
final class NavEngine implements LocationListener {
    interface Listener {
        void onNavChanged();
    }

    interface RouteCallback {
        void ok(Route route);

        void fail(String why);
    }

    /** v1.80: várias rotas de uma vez (a 1ª é a mais rápida do TomTom). */
    interface RoutesCallback {
        void ok(List<Route> routes);

        void fail(String why);
    }

    enum State { IDLE, NAVIGATING, ARRIVED }

    private static final String SIM = "toba-sim";
    private static final double SIM_SPEED = 13.9; // 50 km/h

    private final CarContext car;
    private final Context app;
    private final CarMap map;
    private final Voice voice;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final NavigationManager nav;
    private Listener listener;

    private State state = State.IDLE;
    private Route route;
    private Place dest;
    private boolean rerouting;
    private boolean locationOn;
    private Location last;
    private double heading;

    private int seg;
    private double along;
    private int offCount;
    private int driftCount; // v2.02: leituras seguidas com o carro descolado da rota
    private long lastReroute;
    private int nextIdx = -1;
    private double distToNext;
    private double remaining;
    private long remainingSec;
    private final Set<String> spoken = new HashSet<>();
    /** v2.03: manobras já faladas (lat, lon, quando): rota recalculada não repete a mesma curva. */
    private final java.util.ArrayList<double[]> spokenAt = new java.util.ArrayList<>();
    private long reroutingSince;

    private long startedAt;
    private double driven;
    private Location odo;

    private boolean simulating;
    private boolean tripSimulated; // v2.02: a viagem usou o Simular (o diário marca sim:true)
    private double simAlong;
    private final Runnable simTick = this::simStep;
    private final Runnable backToIdle = () -> {
        if (state == State.ARRIVED) {
            state = State.IDLE;
            pushHud();
            changed();
        }
    };

    NavEngine(CarContext car, CarMap map) {
        this.car = car;
        this.app = car.getApplicationContext();
        this.map = map;
        this.voice = new Voice(car);
        map.setOnSay(voice::alert); // v1.80: aviso de radar e piada do Cloba da página (v2.02: contam como alerta)
        this.nav = car.getCarService(NavigationManager.class);
        nav.setNavigationManagerCallback(new NavigationManagerCallback() {
            @Override
            public void onStopNavigation() {
                // o carro mandou parar (outro app de navegação começou, por exemplo)
                stop(false);
            }

            @Override
            public void onAutoDriveEnabled() {
                // comando "auto drive" do DHU: dirige sozinho pela rota
                if (state == State.NAVIGATING) startSimulation();
            }
        });
        startLocation();
    }

    void setListener(Listener l) {
        listener = l;
    }

    private void changed() {
        if (listener != null) listener.onNavChanged();
    }

    /* ------------------------------------------------------------ GPS */

    boolean hasPermission() {
        return app.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || app.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    void startLocation() {
        if (locationOn || !hasPermission()) return;
        LocationManager lm = (LocationManager) app.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        try {
            Location best = null;
            for (String p : new String[] {LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                try {
                    lm.requestLocationUpdates(p, LocationManager.GPS_PROVIDER.equals(p) ? 1000 : 4000, 0, this, Looper.getMainLooper());
                    Location k = lm.getLastKnownLocation(p);
                    if (k != null && (best == null || k.getTime() > best.getTime())) best = k;
                } catch (IllegalArgumentException ignored) {
                    // aparelho sem esse provedor
                }
            }
            locationOn = true;
            if (best != null) onLocationChanged(best);
        } catch (SecurityException e) {
            locationOn = false;
        }
    }

    private void stopLocation() {
        if (!locationOn) return;
        LocationManager lm = (LocationManager) app.getSystemService(Context.LOCATION_SERVICE);
        if (lm != null) lm.removeUpdates(this);
        locationOn = false;
    }

    Location lastLocation() {
        return last;
    }

    @Override
    public void onLocationChanged(Location loc) {
        if (loc == null) return;
        boolean sim = SIM.equals(loc.getProvider());
        if (simulating && !sim) return;
        if (!sim && LocationManager.NETWORK_PROVIDER.equals(loc.getProvider()) && last != null
                && LocationManager.GPS_PROVIDER.equals(last.getProvider())
                && loc.getTime() - last.getTime() < 15000) {
            return; // GPS fresquinho manda mais que a antena
        }
        if (state == State.NAVIGATING && odo != null) {
            float d = odo.distanceTo(loc);
            if (d < 300) driven += d;
        }
        odo = loc;
        last = loc;
        if (loc.hasBearing() && loc.getSpeed() > 1.5f) heading = loc.getBearing();

        if (rerouting && System.currentTimeMillis() - reroutingSince > 25000) {
            rerouting = false; // v2.03: recálculo sem resposta há 25 s: segue na rota velha e tenta de novo
            offCount = 0;
        }
        if (state == State.NAVIGATING && route != null && !rerouting) {
            progress(loc);
        } else {
            map.setCar(loc.getLatitude(), loc.getLongitude(), heading, speed());
        }
        refreshLimit(loc);
        pushHud();
        changed();
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    /* ------------------------------------------------------------ rota */

    void computeRoute(Place to, RouteCallback cb) {
        computeRoutes(to, 0, new RoutesCallback() {
            @Override
            public void ok(List<Route> routes) {
                cb.ok(routes.get(0));
            }

            @Override
            public void fail(String why) {
                cb.fail(why);
            }
        });
    }

    /** v1.80: a rota e até {@code alternatives} caminhos diferentes (prévia com 2-3 opções). */
    void computeRoutes(Place to, int alternatives, RoutesCallback cb) {
        // v1.76: liberou a localização no celular depois de abrir o carro? liga o GPS agora
        if (!locationOn) startLocation();
        Location from = last;
        if (from == null) {
            main.post(() -> cb.fail(hasPermission()
                    ? "Ainda sem GPS 📡. Espera um tiquinho e tenta de novo."
                    : "Libera a localização do Toba no celular primeiro."));
            return;
        }
        io.execute(() -> {
            try {
                List<Route> r = TobaApi.routes(app, from, to, alternatives);
                main.post(() -> cb.ok(r));
            } catch (IOException e) {
                main.post(() -> cb.fail("Não deu pra traçar a rota: " + TobaApi.friendly(e)));
            } catch (RuntimeException e) {
                main.post(() -> cb.fail("Deu ruim na rota 💩 " + e.getMessage()));
            }
        });
    }

    void start(Place to, Route r, boolean simulate) {
        main.removeCallbacks(backToIdle);
        stopSimulation();
        dest = to;
        state = State.NAVIGATING;
        startedAt = System.currentTimeMillis();
        driven = 0;
        tripSimulated = false;
        odo = null;
        spokenAt.clear();
        // v2.03: a viagem caiu (Android Auto reiniciou, recálculo travou e tu parou) e tu
        // voltou pro MESMO destino em até 15 min? segue a MESMA viagem do diário: mesmo
        // começo, km somados. Viagem que chegou ou foi pra outro lugar começa do zero.
        AutoStore.Resume back = simulate ? null : AutoStore.takeResume(app, to);
        if (back != null) {
            startedAt = back.at;
            driven = back.meters;
        }
        useRoute(r);
        AutoStore.addRecent(app, to);
        try {
            nav.navigationStarted();
        } catch (RuntimeException ignored) {
            // host antigo sem navegação: a tela funciona igual
        }
        NavService.start(app, "Indo pra " + to.name);
        String transito = r.delay > 120 ? ", com uns " + Math.round(r.delay / 60.0) + " minutos de trânsito" : ", caminho livre";
        if (back != null) {
            voice.say("Voltei! Mesma viagem, uns " + Math.max(1, Math.round(r.time / 60.0)) + " minutos daqui.");
        } else {
            voice.say("Bora! " + Geo.spokenDistance(r.length) + ", uns " + Math.max(1, Math.round(r.time / 60.0))
                    + " minutos" + transito + ".");
        }
        DriveSync.carStarted(to);
        if (simulate) startSimulation();
        else if (last != null) progress(last);
        pushHud();
        changed();
    }

    private void useRoute(Route r) {
        route = r;
        seg = 0;
        along = 0;
        offCount = 0;
        driftCount = 0;
        nextIdx = -1;
        spoken.clear();
        remaining = r.length;
        remainingSec = r.time;
        simAlong = 0;
        map.setRoute(r);
    }

    void stop(boolean byUser) {
        if (state != State.NAVIGATING) return;
        finishTrip(false);
        state = State.IDLE;
        DriveSync.carEnded(false);
        if (byUser) voice.say("Navegação encerrada. Valeu, parceiro!");
        pushHud();
        changed();
    }

    private void arrive() {
        finishTrip(true);
        state = State.ARRIVED;
        DriveSync.carEnded(true);
        pushHud();
        voice.alert("Chegou! " + (dest == null ? "" : dest.name + ". ") + "Nunca foi sorte, Cloba. Nunca foi sorte.");
        main.postDelayed(backToIdle, 20000);
        changed();
    }

    private void finishTrip(boolean arrived) {
        stopSimulation();
        AutoStore.logTrip(app, dest, driven, startedAt, arrived, tripSimulated);
        try {
            nav.navigationEnded();
        } catch (RuntimeException ignored) {
            // já tinha terminado
        }
        NavService.stop(app);
        map.clearRoute();
        route = null;
        rerouting = false;
        nextIdx = -1;
    }

    private void reroute() {
        if (dest == null || last == null) return;
        rerouting = true;
        lastReroute = System.currentTimeMillis();
        reroutingSince = lastReroute;
        // v2.03: recalcular é só trocar o desenho da rota (mesma viagem: começo, km e piadas
        // seguem). Sem fala: o painel mostra "Recalculando" e a música não para.
        pushHud();
        changed();
        Location from = last;
        Place to = dest;
        io.execute(() -> {
            try {
                Route r = TobaApi.route(app, from, to);
                main.post(() -> {
                    if (state != State.NAVIGATING) return;
                    rerouting = false;
                    useRoute(r);
                    if (last != null) progress(last);
                    pushHud();
                    changed();
                });
            } catch (IOException e) {
                main.post(() -> {
                    rerouting = false;
                    offCount = 0;
                    CarToast.makeText(car, "Não deu pra recalcular: " + TobaApi.friendly(e), CarToast.LENGTH_LONG).show();
                    changed();
                });
            } catch (RuntimeException e) {
                // v2.03: antes um erro estranho aqui deixava o "Recalculando" preso pra sempre
                // (a seta parava, a voz sumia e o jeito era encerrar e começar outra viagem)
                main.post(() -> {
                    rerouting = false;
                    offCount = 0;
                    changed();
                });
            }
        });
    }

    /** Onde estou na rota: ponto mais perto, distância até a manobra, voz e chegada. */
    private void progress(Location loc) {
        Route r = route;
        int n = r.size();
        double lat = loc.getLatitude(), lon = loc.getLongitude();
        int bestI = -1;
        double best = Double.MAX_VALUE, bestT = 0;
        for (int pass = 0; pass < 2 && (bestI < 0 || best > 60); pass++) {
            int from = pass == 0 ? Math.max(0, seg - 3) : 0;
            int to = pass == 0 ? Math.min(n - 2, seg + 400) : n - 2;
            for (int i = from; i <= to; i++) {
                double[] b = Geo.enu(r.lat[i], r.lon[i], r.lat[i + 1], r.lon[i + 1]);
                double[] p = Geo.enu(r.lat[i], r.lon[i], lat, lon);
                double len2 = b[0] * b[0] + b[1] * b[1];
                double t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (p[0] * b[0] + p[1] * b[1]) / len2));
                double d = Math.hypot(p[0] - t * b[0], p[1] - t * b[1]);
                if (d < best) {
                    best = d;
                    bestI = i;
                    bestT = t;
                }
            }
        }
        if (bestI < 0) return;
        // v2.02 (23 de Maio): a seta grudava na via lateral da rota mesmo com o carro seguindo
        // na pista principal (correm lado a lado a uns 20-40 m e o limite era 45 m). Agora:
        //  - descolou mais que "soft" (18 m, ou a precisão do GPS se for pior): a seta SOLTA e
        //    mostra onde o GPS tá, com o rumo do GPS;
        //  - 4 leituras seguidas descoladas (~4 s), ou rumo virado 35°+ andando (2 leituras),
        //    ou longe demais de uma vez: recalcula (pode repetir depois de 8 s; era 12 s);
        //  - o recálculo manda o rumo do carro pro TomTom (vehicleHeading): segue pela principal.
        double acc = loc.hasAccuracy() ? Math.max(5, Math.min(50, loc.getAccuracy())) : 20;
        double soft = Math.max(18, acc);
        double hard = Math.max(35, Math.min(60, acc * 1.6));
        double bHead = Geo.bearing(r.lat[bestI], r.lon[bestI], r.lat[bestI + 1], r.lon[bestI + 1]);
        boolean moving = loc.hasSpeed() && loc.getSpeed() > 4f;
        boolean turnedAway = moving && loc.hasBearing() && best > 10
                && Math.abs(Geo.angleDiff(bHead, loc.getBearing())) > 35;
        if (best > soft || turnedAway) driftCount++;
        else driftCount = 0;
        boolean off = best > hard || driftCount >= 4 || (turnedAway && driftCount >= 2);
        if (off || best > soft) {
            if (loc.hasBearing() && moving) heading = loc.getBearing();
            map.setCar(lat, lon, heading, speed());
            if (off) {
                offCount++;
                if (System.currentTimeMillis() - lastReroute > 8000) reroute();
            }
            return;
        }
        offCount = 0;
        seg = bestI;
        double segLen = r.cum[bestI + 1] - r.cum[bestI];
        along = r.cum[bestI] + bestT * segLen;
        double sLat = r.lat[bestI] + (r.lat[bestI + 1] - r.lat[bestI]) * bestT;
        double sLon = r.lon[bestI] + (r.lon[bestI + 1] - r.lon[bestI]) * bestT;
        double segHead = Geo.bearing(r.lat[bestI], r.lon[bestI], r.lat[bestI + 1], r.lon[bestI + 1]);
        if (!(loc.hasBearing() && loc.getSpeed() > 3f) || segLen > 2) heading = segHead;
        map.setCar(sLat, sLon, heading, speed());
        map.setProgress(seg, along);

        remaining = Math.max(0, r.length - along);
        remainingSec = r.length > 0 ? Math.round(r.time * remaining / r.length) : 0;

        nextIdx = -1;
        for (int i = 0; i < r.instr.size(); i++) {
            Route.Instr it = r.instr.get(i);
            if ("DEPART".equals(it.maneuver)) continue;
            if (it.offset > along + 3) {
                nextIdx = i;
                break;
            }
        }
        if (nextIdx < 0) nextIdx = r.instr.size() - 1;
        distToNext = Math.max(0, r.instr.get(nextIdx).offset - along);

        speak(r, loc);
        if (remaining < 30 || (r.instr.get(nextIdx).maneuver.startsWith("ARRIVE") && distToNext < 20)) arrive();
    }

    /**
     * v2.03 (pedido do Rafa: "interromper a música o mínimo possível"): UMA fala por manobra,
     * na distância certa pra velocidade, sempre com número redondo:
     *  - até 60 km/h: a uns 100 m ("Em cem metros, vire à direita na Rua X");
     *  - 60 a 120 km/h: a 400 m;  - mais de 120 km/h: a 500 m.
     * Só saída de rodovia/via expressa e rotatória ganham um "Agora" curtinho na hora.
     * Manobra colada na seguinte (menos de 150 m) vai junto: "..., e logo depois, ...".
     * A chegada não tem pré-aviso: quem fala é o "Chegou! Nunca foi sorte" (alerta).
     */
    static double announceAt(double speedMs) {
        double kmh = speedMs * 3.6;
        return kmh > 120 ? 500 : kmh >= 60 ? 400 : 100;
    }

    private void speak(Route r, Location loc) {
        Route.Instr it = r.instr.get(nextIdx);
        if (it.maneuver.startsWith("ARRIVE")) return;
        double v = loc.hasSpeed() ? loc.getSpeed() : 0;
        double d = distToNext;
        String key = r.createdAt + ":" + nextIdx;
        if (!spoken.contains(key) && d <= announceAt(v) + 20) {
            spoken.add(key);
            if (saidRecently(it)) return; // a rota recalculou e essa curva já foi falada
            markSaid(it);
            String msg = Maneuvers.phrase(it);
            String text = d < 60 ? msg : "Em " + Geo.roundSpoken(d) + ", " + lowerFirst(msg);
            if (nextIdx + 1 < r.instr.size()) {
                Route.Instr after = r.instr.get(nextIdx + 1);
                if (!after.maneuver.startsWith("ARRIVE") && after.offset - it.offset < 150) {
                    spoken.add(r.createdAt + ":" + (nextIdx + 1));
                    markSaid(after);
                    text += ", e logo depois, " + lowerFirst(Maneuvers.phrase(after));
                }
            }
            if (d >= 150 && wantsNow(it)) spoken.add(key + ":now?");
            voice.say(text + ".");
            return;
        }
        // "Agora" só pra saída/rotatória que foi avisada de longe
        if (spoken.contains(key + ":now?") && d <= Math.max(25, v * 2.5) && spoken.add(key + ":now")) {
            voice.say(it.maneuver.startsWith("ROUNDABOUT") && it.exit > 0 ? "Agora, " + it.exit + "ª saída." : "Agora.");
        }
    }

    private static boolean wantsNow(Route.Instr it) {
        String m = it.maneuver == null ? "" : it.maneuver;
        return m.startsWith("ROUNDABOUT") || m.startsWith("MOTORWAY_EXIT") || "TAKE_EXIT".equals(m);
    }

    private boolean saidRecently(Route.Instr it) {
        long now = System.currentTimeMillis();
        for (double[] p : spokenAt) {
            if (now - p[2] < 180000 && Geo.distance(p[0], p[1], it.lat, it.lon) < 40) return true;
        }
        return false;
    }

    private void markSaid(Route.Instr it) {
        if (it.lat == 0 && it.lon == 0) return;
        spokenAt.add(new double[] {it.lat, it.lon, System.currentTimeMillis()});
        if (spokenAt.size() > 40) spokenAt.remove(0);
    }

    private static String lowerFirst(String s) {
        if (s == null || s.isEmpty()) return "";
        return Character.toLowerCase(s.charAt(0)) + s.substring(1);
    }

    /* ------------------------------------------------------------ simulação (DHU) */

    void startSimulation() {
        if (route == null) return;
        simulating = true;
        tripSimulated = true;
        simAlong = along;
        main.removeCallbacks(simTick);
        main.post(simTick);
        CarToast.makeText(car, "🧪 Simulando a viagem a 50 km/h", CarToast.LENGTH_SHORT).show();
    }

    private void stopSimulation() {
        simulating = false;
        main.removeCallbacks(simTick);
    }

    private void simStep() {
        Route r = route;
        if (!simulating || r == null || state != State.NAVIGATING) return;
        simAlong = Math.min(r.length, simAlong + SIM_SPEED * 0.5);
        int i = 0;
        int lo = 0, hi = r.size() - 1;
        while (lo < hi) { // último ponto com cum <= simAlong
            int mid = (lo + hi + 1) >>> 1;
            if (r.cum[mid] <= simAlong) lo = mid;
            else hi = mid - 1;
        }
        i = Math.min(lo, r.size() - 2);
        double segLen = r.cum[i + 1] - r.cum[i];
        double t = segLen <= 0 ? 0 : Math.min(1, (simAlong - r.cum[i]) / segLen);
        Location fake = new Location(SIM);
        fake.setLatitude(r.lat[i] + (r.lat[i + 1] - r.lat[i]) * t);
        fake.setLongitude(r.lon[i] + (r.lon[i + 1] - r.lon[i]) * t);
        fake.setBearing((float) Geo.bearing(r.lat[i], r.lon[i], r.lat[i + 1], r.lon[i + 1]));
        fake.setSpeed((float) SIM_SPEED);
        fake.setAccuracy(4);
        fake.setTime(System.currentTimeMillis());
        onLocationChanged(fake);
        if (simulating) main.postDelayed(simTick, 500);
    }

    /* ------------------------------------------------------------ v1.78: painel do mapa 3D */

    private float speed() {
        return last != null && last.hasSpeed() ? last.getSpeed() : 0f;
    }

    /** Limite da rua agora (km/h, 0 = não sei). Só com rota (vem do TomTom). */
    int speedLimit() {
        int fromRoute = state == State.NAVIGATING && route != null ? route.limitAt(seg) : 0;
        return fromRoute > 0 ? fromRoute : limitHere;
    }

    /** v1.80: rua onde o carro tá (da manobra que já passou; sem rota, do TomTom). */
    private String currentStreet() {
        if (state == State.NAVIGATING && route != null && nextIdx > 0 && nextIdx - 1 < route.instr.size()) {
            String st = route.instr.get(nextIdx - 1).street;
            if (st != null && !st.trim().isEmpty()) return PreviewScreen.shortStreet(st);
        }
        return PreviewScreen.shortStreet(streetHere);
    }

    /* v1.80: limite da rua sem rota (ou trecho sem limite na rota): TomTom pela posição */
    private int limitHere;
    private String streetHere = "";
    private double limitLat = Double.NaN, limitLon = Double.NaN;
    private long limitAt;
    private boolean limitBusy, limitOff;

    private void refreshLimit(Location loc) {
        if (limitBusy || limitOff || loc == null) return;
        // a rota já sabe o limite (a rua atual vem da manobra)
        if (state == State.NAVIGATING && route != null && route.limitAt(seg) > 0) return;
        long now = System.currentTimeMillis();
        double moved = Double.isNaN(limitLat) ? 1e9 : Geo.distance(limitLat, limitLon, loc.getLatitude(), loc.getLongitude());
        boolean moving = loc.getSpeed() > 2f;
        // andando: a cada 15 s e 120 m; parado: só se nunca pegou ou mudou de lugar
        if (moving ? (now - limitAt < 15000 || moved < 120) : moved < 60) return;
        limitBusy = true;
        limitAt = now;
        limitLat = loc.getLatitude();
        limitLon = loc.getLongitude();
        final double la = limitLat, lo = limitLon;
        final float hd = loc.hasBearing() && moving ? loc.getBearing() : Float.NaN;
        io.execute(() -> {
            TobaApi.RoadInfo info;
            boolean ok = true;
            try {
                info = TobaApi.speedLimitAt(app, la, lo, hd);
            } catch (IOException | RuntimeException e) {
                info = null;
                ok = false; // sem internet: mantém o último por um tempo
            }
            final TobaApi.RoadInfo got = info;
            final boolean fine = ok;
            main.post(() -> {
                limitBusy = false;
                if (fine && got == null) {
                    limitOff = true; // trava do dia
                    limitHere = 0;
                } else if (got != null) {
                    limitHere = got.kmh;
                    if (!got.street.isEmpty()) streetHere = got.street;
                }
                pushHud();
            });
        });
    }

    /**
     * Manda pro mapa 3D o painel enxuto (no lugar dos cartões pretos do Auto):
     * manobra, chegada, velocidade do carro e da rua. Plano B ignora.
     */
    private void pushHud() {
        try {
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("speed", Math.round(speed() * 3.6f));
            o.put("nav", state == State.NAVIGATING);
            o.put("state", state.name().toLowerCase(java.util.Locale.US));
            if (dest != null) o.put("dest", dest.name);
            o.put("limit", speedLimit());
            String road = currentStreet();
            if (!road.isEmpty()) o.put("road", road);
            if (state == State.NAVIGATING) {
                o.put("rerouting", rerouting);
                if (route != null && !rerouting) {
                    String ln = route.lanesAhead(seg, along, 700);
                    if (ln != null) o.put("lanes", new org.json.JSONArray(ln));
                }
                Route.Instr next = nextInstr();
                if (next != null && !rerouting) {
                    o.put("icon", Maneuvers.key(next));
                    o.put("dist", Maneuvers.distanceText(distToNext));
                    o.put("street", Maneuvers.cue(next, dest));
                    if (next.exit > 0) o.put("exit", next.exit);
                }
                long sec = Math.max(0, remainingSec);
                java.text.SimpleDateFormat hm = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US);
                o.put("eta", hm.format(new java.util.Date(System.currentTimeMillis() + sec * 1000)));
                o.put("min", Math.max(1, Math.round(sec / 60.0)));
                o.put("left", Maneuvers.distanceText(remaining));
                long delay = route == null ? 0 : route.delay;
                o.put("traffic", delay > 300 ? 3 : delay > 90 ? 2 : 1);
            }
            map.hud(o.toString());
        } catch (org.json.JSONException ignored) {
            // painel é enfeite: a navegação segue
        }
    }

    /* ------------------------------------------------------------ pra tela */

    State state() {
        return state;
    }

    boolean isNavigating() {
        return state == State.NAVIGATING;
    }

    boolean isRerouting() {
        return rerouting;
    }

    Place destination() {
        return dest;
    }

    Route route() {
        return route;
    }

    Route.Instr nextInstr() {
        return route != null && nextIdx >= 0 && nextIdx < route.instr.size() ? route.instr.get(nextIdx) : null;
    }

    Route.Instr afterInstr() {
        return route != null && nextIdx >= 0 && nextIdx + 1 < route.instr.size() ? route.instr.get(nextIdx + 1) : null;
    }

    double distToNext() {
        return distToNext;
    }

    TravelEstimate estimate() {
        if (route == null) return null;
        long sec = Math.max(0, remainingSec);
        TravelEstimate.Builder b = new TravelEstimate.Builder(
                Maneuvers.distance(remaining),
                DateTimeWithZone.create(System.currentTimeMillis() + sec * 1000, TimeZone.getDefault()))
                .setRemainingTimeSeconds(sec);
        long delay = route.delay;
        b.setRemainingTimeColor(delay > 300 ? CarColor.RED : delay > 90 ? CarColor.YELLOW : CarColor.GREEN);
        return b.build();
    }

    CarMap map() {
        return map;
    }

    /** v2.02: modo de áudio (AutoStore.AUDIO_*). */
    int audioMode() {
        return AutoStore.audioMode(app);
    }

    /** v2.02: botão do som: 🔊 Tudo → ⚠️ Só alertas → 🔇 Silêncio → 🔊 Tudo. */
    int nextAudioMode() {
        int m = (AutoStore.audioMode(app) + 1) % 3;
        AutoStore.setAudioMode(app, m);
        voice.stop();
        if (m == AutoStore.AUDIO_ALL) voice.say("Voz ligada. Falo tudo!");
        else if (m == AutoStore.AUDIO_ALERTS) voice.alert("Só alertas: radar e as piadas do Cloba.");
        changed();
        return m;
    }

    /**
     * v2.02: botão Y (outros caminhos) no meio da viagem: troca pro caminho escolhido sem
     * encerrar a viagem (km, tempo e piadas seguem).
     */
    void switchRoute(Route r) {
        if (state != State.NAVIGATING || r == null || r.size() < 2) return;
        rerouting = false;
        lastReroute = System.currentTimeMillis();
        useRoute(r);
        if (last != null) progress(last);
        voice.say("Fechou, caminho trocado. Uns " + Math.max(1, Math.round(r.time / 60.0)) + " minutos daqui.");
        pushHud();
        changed();
    }

    void destroy() {
        if (state == State.NAVIGATING) finishTrip(false);
        main.removeCallbacksAndMessages(null);
        stopLocation();
        voice.destroy();
        io.shutdownNow();
        try {
            nav.clearNavigationManagerCallback();
        } catch (RuntimeException ignored) {
            // nada
        }
    }
}
