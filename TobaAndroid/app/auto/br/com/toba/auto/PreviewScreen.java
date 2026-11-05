package br.com.toba.auto;

import android.text.SpannableString;
import android.text.Spanned;

import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.DistanceSpan;
import androidx.car.app.model.DurationSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.RoutePreviewNavigationTemplate;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.ArrayList;
import java.util.List;

/**
 * Prévia da rota no mapa: tempo, km, trânsito e o botão "Bora!".
 * v1.80: até 3 caminhos ("via Av. 23 de Maio"); tocar num troca a rota azul do mapa
 * (os outros ficam cinza). Texto curto: o cartão é do Android Auto e a fonte é dele.
 */
final class PreviewScreen extends Screen {
    /** Quantos caminhos além do mais rápido o TomTom manda (custa a mesma 1 rota da cota). */
    private static final int ALTERNATIVES = 2;

    private final NavEngine engine;
    private final Place dest;
    private final List<Route> routes = new ArrayList<>();
    private final List<String> vias = new ArrayList<>();
    private int selected;
    private Route route;
    private String error;
    private boolean loading = true;
    private double originLat, originLon;

    PreviewScreen(CarContext car, NavEngine engine, Place dest) {
        super(car);
        this.engine = engine;
        this.dest = dest;
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(LifecycleOwner owner) {
                if (route != null) showOnMap();
            }

            @Override
            public void onStop(LifecycleOwner owner) {
                engine.map().hideOverview();
            }
        });
        load();
    }

    private void load() {
        loading = true;
        error = null;
        android.location.Location from = engine.lastLocation();
        if (from != null) {
            originLat = from.getLatitude();
            originLon = from.getLongitude();
        }
        engine.computeRoutes(dest, ALTERNATIVES, new NavEngine.RoutesCallback() {
            @Override
            public void ok(List<Route> list) {
                routes.clear();
                routes.addAll(list);
                vias.clear();
                vias.addAll(viaNames(routes));
                selected = 0;
                route = routes.get(0);
                loading = false;
                showOnMap();
                invalidate();
            }

            @Override
            public void fail(String why) {
                error = why;
                loading = false;
                invalidate();
            }
        });
    }

    private void showOnMap() {
        List<Route> others = new ArrayList<>(routes);
        others.remove(route);
        engine.map().showOverview(route, others, originLat, originLon);
    }

    /** "via X" de cada caminho: a rua mais rodada que os outros caminhos não usam como principal. */
    private static List<String> viaNames(List<Route> all) {
        List<String> out = new ArrayList<>();
        List<String> used = new ArrayList<>();
        for (Route r : all) {
            List<String> streets = r.mainStreets();
            String pick = "";
            for (String st : streets) {
                if (!used.contains(st)) {
                    pick = st;
                    break;
                }
            }
            if (pick.isEmpty() && !streets.isEmpty()) pick = streets.get(0);
            if (!pick.isEmpty()) used.add(pick);
            out.add(shortStreet(pick));
        }
        return out;
    }

    /** Avenida -> Av., Rua -> R. ... pra caber no cartão. */
    static String shortStreet(String s) {
        if (s == null) return "";
        String t = s.trim();
        String[][] abbr = {
                {"Avenida ", "Av. "}, {"Rua ", "R. "}, {"Rodovia ", "Rod. "}, {"Estrada ", "Estr. "},
                {"Viaduto ", "Vd. "}, {"Alameda ", "Al. "}, {"Praça ", "Pç. "}, {"Travessa ", "Tv. "},
                {"Marginal ", "Marg. "}, {"Ponte ", "Pte. "}, {"Túnel ", "Tún. "},
        };
        for (String[] a : abbr) {
            if (t.startsWith(a[0])) {
                t = a[1] + t.substring(a[0].length());
                break;
            }
        }
        return t.length() > 28 ? t.substring(0, 27).trim() + "…" : t;
    }

    private void go(boolean simulate) {
        if (route == null) return;
        engine.start(dest, route, simulate);
        getScreenManager().popToRoot();
    }

    @Override
    public Template onGetTemplate() {
        if (error != null) {
            return new MessageTemplate.Builder(error)
                    .setTitle(dest.name)
                    .setHeaderAction(Action.BACK)
                    .addAction(new Action.Builder().setTitle("Tentar de novo").setOnClickListener(() -> {
                        load();
                        invalidate();
                    }).build())
                    .build();
        }
        RoutePreviewNavigationTemplate.Builder b = new RoutePreviewNavigationTemplate.Builder()
                .setTitle(dest.name)
                .setHeaderAction(Action.BACK);
        if (loading || route == null) return b.setLoading(true).build();

        // o Android Auto troca o 1º caractere pelo tempo / pela distância (DurationSpan / DistanceSpan)
        long best = routes.get(0).time;
        ItemList.Builder items = new ItemList.Builder();
        for (int i = 0; i < routes.size(); i++) {
            Route r = routes.get(i);
            String via = i < vias.size() ? vias.get(i) : "";
            SpannableString title = new SpannableString(via.isEmpty() ? " " : "  · via " + via);
            title.setSpan(DurationSpan.create(r.time), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE);
            String transito = r.delay > 600 ? "🔴 +" + Math.round(r.delay / 60.0) + " min"
                    : r.delay > 90 ? "🟡 +" + Math.round(r.delay / 60.0) + " min"
                    : "🟢 livre";
            long slower = Math.round((r.time - best) / 60.0);
            String extra = i == 0 ? " · ⚡ mais rápida" : slower >= 1 ? " · " + slower + " min a mais" : "";
            SpannableString text = new SpannableString("  · " + transito + extra);
            text.setSpan(DistanceSpan.create(Maneuvers.distance(r.length)), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE);
            items.addItem(new Row.Builder().setTitle(title).addText(text).build());
        }
        ItemList list = items
                .setOnSelectedListener(index -> {
                    if (index < 0 || index >= routes.size() || index == selected) return;
                    selected = index;
                    route = routes.get(index);
                    showOnMap();
                })
                .setSelectedIndex(Math.min(selected, routes.size() - 1))
                .build();
        return b.setItemList(list)
                .setNavigateAction(new Action.Builder().setTitle("Bora!").setOnClickListener(() -> go(false)).build())
                .setActionStrip(new ActionStrip.Builder()
                        .addAction(new Action.Builder().setTitle("Simular").setOnClickListener(() -> go(true)).build())
                        .build())
                .build();
    }
}
