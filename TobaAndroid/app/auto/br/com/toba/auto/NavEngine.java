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

    /* v2.13: grudar na rota com rumo e continuidade (RouteSnap) */
    private double snapAlong = Double.NaN; // metros da rota na última leitura aceita
    private long snapAt;
    private double jumpAlong = Double.NaN; // candidato a pulo (túnel, GPS que voltou longe)
    private int jumpCount;

    /* v2.13: limite firme + conta do 😇 Pé de anjo / 🧘 Motorista de comercial */
    private int limShown;                  // o que a placa mostra
    private int limPend = -1;              // limite novo esperando firmar
    private long limPendAt;
    private double limPendAlong;
    private long limChangedAt;
    private long lastTick;
    private double tripLimitS, tripOverS;
    private long overSince;
    private boolean overCounted;
    private long tripEta;                  // previsão da TomTom no começo (0 = viagem que continuou)
    static final double OVER_TOL = 1.07;   // mesma folga do celular (DRIVE_OVER_TOLERANCE)
    static final long OVER_RUN_MS = 4000;  // só estouro de 4 s+ seguidos conta
    static final long LIMIT_GRACE_MS = 8000; // trocou o limite: 8 s pra frear antes de contar

    /* v2.13: chegada mais certa (tempo de cada trecho da TomTom + trânsito a cada 5 min + 🧠 Fator Rafa) */
    private double liveAdj, liveBase;      // segundos a mais/menos que o trânsito de agora deu
    private long lastTrafficCheck;
    private boolean trafficBusy;
    static final long TRAFFIC_CHECK_MS = 5 * 60 * 1000L;
    static final long SWAP_SAVE_S = 180;   // caminho novo 3 min+ mais rápido = troca

    /* v2.13: limite do OpenStreetMap das vias da rota (LimitMatch) */
    private java.util.List<LimitMatch.Way> osmWays;
    private long osmAt;
    private boolean osmBusy;

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
        tickLimit(loc);
        checkTraffic();
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
        tripLimitS = 0;
        tripOverS = 0;
        tripEta = r.time;
        if (back != null) {
            startedAt = back.at;
            driven = back.meters;
            tripLimitS = back.limitS; // v2.13: o tempo no limite segue junto
            tripOverS = back.overS;
            tripEta = 0;
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
        remainingSec = Math.round(r.time * AutoStore.etaFactor(app));
        simAlong = 0;
        snapAlong = Double.NaN;
        jumpAlong = Double.NaN;
        jumpCount = 0;
        liveAdj = 0;
        liveBase = 0;
        lastTrafficCheck = System.currentTimeMillis();
        limPend = -1;
        mergeLimits(r);
        loadOsm(r);
        map.setRoute(r);
    }

    /* ------------------------------------------------------------ v2.13: limite */

    /** ✏ correção > TomTom > OpenStreetMap, por trecho da rota (LimitMatch.combine). */
    private void mergeLimits(Route r) {
        try {
            r.merged = LimitMatch.combine(r.lat, r.lon, r.cum, r.tomtomPerSeg(), r.osm,
                    LimitMatch.parseFixes(AutoStore.limitFixes(app)));
        } catch (RuntimeException e) {
            r.merged = null; // fica o do TomTom
        }
    }

    /**
     * Busca as vias do OpenStreetMap em volta da rota (1 pedido por rota; recálculo em
     * menos de 45 s reaproveita as vias que já vieram). Caiu = fica o do TomTom.
     */
    private void loadOsm(Route r) {
        final java.util.List<LimitMatch.Way> have = osmWays;
        if (have != null && System.currentTimeMillis() - osmAt < 45000) {
            io.execute(() -> {
                LimitMatch.Osm o = LimitMatch.match(r.lat, r.lon, have);
                main.post(() -> {
                    r.osm = o;
                    mergeLimits(r);
                });
            });
            return;
        }
        if (osmBusy) return;
        osmBusy = true;
        io.execute(() -> {
            java.util.List<LimitMatch.Way> ways = null;
            LimitMatch.Osm o = null;
            try {
                ways = TobaApi.osmWays(r);
                o = LimitMatch.match(r.lat, r.lon, ways);
            } catch (IOException | RuntimeException ignored) {
                // Overpass fora: segue só com o TomTom
            }
            final java.util.List<LimitMatch.Way> got = ways;
            final LimitMatch.Osm res = o;
            main.post(() -> {
                osmBusy = false;
                if (got == null) return;
                osmWays = got;
                osmAt = System.currentTimeMillis();
                r.osm = res;
                mergeLimits(r);
                if (route != null && route != r) loadOsm(route); // trocou de rota enquanto buscava
                pushHud();
            });
        });
    }

    /**
     * Limite firme: o novo só aparece depois de 30 m (ou 3 s) no trecho novo, pra um GPS
     * tremido na divisa não ficar piscando. E conta o tempo no limite / acima dele pra
     * conquista: estouro só vale depois de 4 s seguidos e nunca nos 8 s depois de trocar.
     */
    private void tickLimit(Location loc) {
        long now = System.currentTimeMillis();
        double dt = lastTick == 0 ? 0 : Math.min(3, (now - lastTick) / 1000.0);
        lastTick = now;
        int raw = rawLimit();
        if (raw == limShown) {
            limPend = -1;
        } else if (raw != limPend) {
            limPend = raw;
            limPendAt = now;
            limPendAlong = along;
        } else if (now - limPendAt >= 3000 || Math.abs(along - limPendAlong) >= 30 || state != State.NAVIGATING) {
            limShown = raw;
            limPend = -1;
            limChangedAt = now;
        }
        if (state != State.NAVIGATING || simulating || rerouting) {
            overSince = 0;
            return;
        }
        int lim = limShown;
        if (lim > 0) tripLimitS += dt;
        double kmh = loc.hasSpeed() ? loc.getSpeed() * 3.6 : 0;
        boolean goodGps = !loc.hasAccuracy() || loc.getAccuracy() <= 30;
        boolean over = lim > 0 && goodGps && kmh > lim * OVER_TOL && now - limChangedAt > LIMIT_GRACE_MS;
        if (!over) {
            overSince = 0;
            overCounted = false;
            return;
        }
        if (overSince == 0) overSince = now;
        if (now - overSince >= OVER_RUN_MS) {
            if (!overCounted) {
                tripOverS += (now - overSince) / 1000.0; // os 4 s que esperou entram de uma vez
                overCounted = true;
            } else {
                tripOverS += dt;
            }
        }
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
        voice.alert("Chegou! " + (dest == null ? "" : dest.name + ". ") + arriveJoke());
        main.postDelayed(backToIdle, 20000);
        changed();
    }

    /**
     * v2.09 (APK 3.2, pedido do Rafa): a chegada ganhou piadas variadas do Cloba
     * (antes era sempre "Nunca foi sorte"; o lema continua no sorteio). Mesma lista do
     * DRIVE_ARRIVE_JOKES do drive.js (celular). Nunca repete a última.
     */
    private static final String[] ARRIVE_JOKES = {
            "Tô aqui chocado com a habilidade do motora.",
            "Voou na rota, pai!",
            "Nunca foi sorte, Cloba. Nunca foi sorte.",
            "Missão cumprida. Pode pegar o loot: sofá, café e gato no colo.",
            "Chegou inteiro, sem multa e com estilo. Isso aí é MAX TOBASTEN.",
            "O GPS fez a parte dele, mas quem pilotou foi você. Respeita!",
            "Que pilotagem, hein! O Toretto mandou mensagem pedindo aula.",
            "Destino alcançado. XP da viagem depositado com sucesso.",
            "Chegamos! Se alguém perguntar, foi tudo planejado desde o começo.",
            "Aterrissagem perfeita. Os passageiros aplaudem de pé. Ou aplaudiriam, se tivessem passageiros.",
            "Cheguei, chegamos, chegaram. Conjuga do jeito que quiser, o importante é que chegou.",
            "Boss da viagem derrotado. Sem perder nenhuma vida.",
            "Pode desligar o motor. Hoje o Cloba dorme orgulhoso.",
            "Chegou! Agora a parte difícil: a baliza. Boa sorte. Ah não, pera, nunca foi sorte.",
            "Motora de respeito. Chegou que nem entrega de app: rapidinho e sem amassar nada.",
            "Viagem zerada. Achievement desbloqueado: chegar vivo.",
            "Ufa! O copiloto aqui suou frio, mas você mandou bem demais.",
            "Chegou chegando! Avisa a vizinhança que o piloto voltou.",
            "Fim da linha, piloto. Foi uma honra ser teu copiloto hoje.",
            "Nem o Waze faria melhor. Tá, faria igual. Mas com menos estilo."
    };
    private static int lastArriveJoke = -1;

    private static String arriveJoke() {
        int i = (int) (Math.random() * ARRIVE_JOKES.length);
        if (i == lastArriveJoke) i = (i + 1) % ARRIVE_JOKES.length;
        lastArriveJoke = i;
        return ARRIVE_JOKES[i];
    }

    private void finishTrip(boolean arrived) {
        stopSimulation();
        AutoStore.logTrip(app, dest, driven, startedAt, arrived, tripSimulated, tripLimitS, tripOverS, tripEta);
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
        // v2.13: rumo + continuidade (RouteSnap). Antes era só o ponto mais perto (procurando
        // pra frente): no trevo Imigrantes -> Bandeirantes a rota passa embaixo do viaduto e
        // volta por cima, e a seta pulava pra pista de cima (e o limite junto).
        long nowMs = System.currentTimeMillis();
        double gpsHead = loc.hasBearing() ? loc.getBearing() : Double.NaN;
        double spd = loc.hasSpeed() ? loc.getSpeed() : 0;
        RouteSnap.Result sr = RouteSnap.locate(r.lat, r.lon, r.cum, lat, lon, gpsHead, spd,
                snapAlong, Double.isNaN(snapAlong) ? 0 : (nowMs - snapAt) / 1000.0);
        RouteSnap.Hit hit = sr.best;
        if (sr.jump != null && (hit == null || hit.dist > 25) && sr.jump.dist <= 25) {
            // pulo só depois de 3 leituras seguidas concordando (o carro andando pra frente nele)
            boolean same = !Double.isNaN(jumpAlong) && Math.abs(sr.jump.along - jumpAlong) < 30 + spd * 3;
            jumpCount = same ? jumpCount + 1 : 1;
            jumpAlong = sr.jump.along;
            if (jumpCount >= 3) {
                hit = sr.jump;
                jumpCount = 0;
                jumpAlong = Double.NaN;
            }
        } else {
            jumpCount = 0;
            jumpAlong = Double.NaN;
        }
        int bestI = hit == null ? -1 : hit.seg;
        double best = hit == null ? Double.MAX_VALUE : hit.dist;
        double bestT = hit == null ? 0 : hit.t;
        if (bestI < 0) {
            // nenhum pedaço da rota no rumo do carro por perto: conta como descolado
            driftCount++;
            if (loc.hasBearing() && spd > 4f) heading = loc.getBearing();
            map.setCar(lat, lon, heading, speed());
            if (driftCount >= 4 && System.currentTimeMillis() - lastReroute > 8000) {
                offCount++;
                reroute();
            }
            return;
        }
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
        snapAlong = along;
        snapAt = nowMs;
        double sLat = r.lat[bestI] + (r.lat[bestI + 1] - r.lat[bestI]) * bestT;
        double sLon = r.lon[bestI] + (r.lon[bestI + 1] - r.lon[bestI]) * bestT;
        double segHead = Geo.bearing(r.lat[bestI], r.lon[bestI], r.lat[bestI + 1], r.lon[bestI + 1]);
        if (!(loc.hasBearing() && loc.getSpeed() > 3f) || segLen > 2) heading = segHead;
        map.setCar(sLat, sLon, heading, speed());
        map.setProgress(seg, along);

        remaining = Math.max(0, r.length - along);
        remainingSec = Math.round(timeLeftNow(r));

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
     * A chegada não tem pré-aviso: quem fala é o "Chegou!" + piada do Cloba (alerta, v2.09).
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

    /**
     * v2.13: segundos até chegar = tempo da TomTom de cada trecho que falta (Route.timeLeft)
     * + o acerto do trânsito de agora (checkTraffic, encolhendo junto com o que falta)
     * × 🧠 Fator Rafa (quanto tu costuma levar a mais que a TomTom, calculado no site).
     */
    private double timeLeftNow(Route r) {
        double plan = r.timeLeft(along);
        double adj = liveBase > 0 ? liveAdj * Math.min(1, plan / liveBase) : 0;
        return Math.max(0, plan + adj) * AutoStore.etaFactor(app);
    }

    /**
     * v2.13: igual ao celular, a cada 5 min pergunta pra TomTom de novo daqui: caminho 3 min+
     * mais rápido = troca; senão só acerta a chegada com o trânsito de agora.
     */
    private void checkTraffic() {
        if (state != State.NAVIGATING || route == null || rerouting || trafficBusy || simulating || last == null || dest == null) return;
        long now = System.currentTimeMillis();
        if (now - lastTrafficCheck < TRAFFIC_CHECK_MS) return;
        lastTrafficCheck = now;
        trafficBusy = true;
        final Route r = route;
        final Location from = last;
        final Place to = dest;
        io.execute(() -> {
            Route fresh = null;
            try {
                fresh = TobaApi.route(app, from, to);
            } catch (IOException | RuntimeException ignored) {
                // sem internet: fica a conta que tinha
            }
            final Route got = fresh;
            main.post(() -> {
                trafficBusy = false;
                if (got == null || route != r || state != State.NAVIGATING || rerouting) return;
                double plan = r.timeLeft(along);
                double nowLeft = plan + (liveBase > 0 ? liveAdj * Math.min(1, plan / liveBase) : 0);
                if (nowLeft - got.time >= SWAP_SAVE_S) {
                    long min = Math.round((nowLeft - got.time) / 60.0);
                    useRoute(got);
                    if (last != null) progress(last);
                    voice.say("Trânsito mudou. Achei um caminho " + min + " minutos mais rápido.");
                } else {
                    liveAdj = got.time - plan;
                    liveBase = Math.max(1, plan);
                    remainingSec = Math.round(timeLeftNow(r));
                }
                pushHud();
                changed();
            });
        });
    }

    private float speed() {
        return last != null && last.hasSpeed() ? last.getSpeed() : 0f;
    }

    /** Limite da rua agora (km/h, 0 = não sei). v2.13: o firme (tickLimit), sem piscar. */
    int speedLimit() {
        return limShown;
    }

    /** v2.13: o limite cru desta leitura (rota: ✏ > TomTom > OSM; sem rota: ✏ ou TomTom da rua). */
    private int rawLimit() {
        int fromRoute = state == State.NAVIGATING && route != null ? route.limitAt(seg) : 0;
        if (fromRoute > 0) return fromRoute;
        if (state != State.NAVIGATING && last != null && last.hasBearing() && last.getSpeed() > 2f) {
            LimitMatch.Fix f = LimitMatch.fixNear(fixesCache(), last.getLatitude(), last.getLongitude(), last.getBearing());
            if (f != null) return Math.max(0, f.kmh);
        }
        return limitHere;
    }

    private java.util.List<LimitMatch.Fix> fixes;
    private long fixesAt;

    private java.util.List<LimitMatch.Fix> fixesCache() {
        long now = System.currentTimeMillis();
        if (fixes == null || now - fixesAt > 60000) {
            fixes = LimitMatch.parseFixes(AutoStore.limitFixes(app));
            fixesAt = now;
        }
        return fixes;
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

    /**
     * v2.14 (APK 3.5): 📍 Marcar pra conferir. Foto do lugar AGORA (o carro segue andando
     * enquanto tu escolhe radar ou limite): posição, rumo, velocidade, o limite que a placa
     * do Toba mostrava e a rua. null = sem GPS ainda. Não fala nada (música segue).
     */
    org.json.JSONObject reportHere(String kind) {
        Location loc = last;
        if (loc == null) return null;
        try {
            double lat = loc.getLatitude(), lon = loc.getLongitude();
            double head = heading;
            boolean onRoute = state == State.NAVIGATING && route != null && !rerouting
                    && seg >= 0 && seg + 1 < route.lat.length;
            if (onRoute) {
                // com rota: a posição grudada na rota e o rumo do trecho (não balança no GPS)
                double len = route.cum[seg + 1] - route.cum[seg];
                double t = len > 0.5 ? Math.max(0, Math.min(1, (along - route.cum[seg]) / len)) : 0;
                lat = route.lat[seg] + t * (route.lat[seg + 1] - route.lat[seg]);
                lon = route.lon[seg] + t * (route.lon[seg + 1] - route.lon[seg]);
                head = Geo.bearing(route.lat[seg], route.lon[seg], route.lat[seg + 1], route.lon[seg + 1]);
            } else if (loc.hasBearing() && loc.getSpeed() > 1.5f) {
                head = loc.getBearing();
            }
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("at", System.currentTimeMillis());
            o.put("kind", kind == null ? "check" : kind);
            o.put("lat", Math.round(lat * 1e6) / 1e6);
            o.put("lng", Math.round(lon * 1e6) / 1e6);
            o.put("head", Math.round(((head % 360) + 360) % 360));
            o.put("kmh", Math.round(speed() * 3.6f));
            o.put("limit", speedLimit());
            o.put("street", currentStreet());
            o.put("nav", state == State.NAVIGATING);
            return o;
        } catch (org.json.JSONException e) {
            return null;
        }
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
