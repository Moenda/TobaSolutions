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

/** Prévia da rota no mapa: tempo, km, trânsito e o botão "Bora!". */
final class PreviewScreen extends Screen {
    private final NavEngine engine;
    private final Place dest;
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
                if (route != null) engine.map().showOverview(route, originLat, originLon);
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
        engine.computeRoute(dest, new NavEngine.RouteCallback() {
            @Override
            public void ok(Route r) {
                route = r;
                loading = false;
                engine.map().showOverview(r, originLat, originLon);
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
        SpannableString title = new SpannableString("  · " + (dest.addr.isEmpty() ? "pelo TomTom" : dest.addr));
        title.setSpan(DurationSpan.create(route.time), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE);
        String transito = route.delay > 60
                ? "🚦 +" + Math.round(route.delay / 60.0) + " min de trânsito"
                : "✅ caminho livre";
        SpannableString text = new SpannableString("  · " + transito);
        text.setSpan(DistanceSpan.create(Maneuvers.distance(route.length)), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE);
        Row row = new Row.Builder().setTitle(title).addText(text).build();
        ItemList list = new ItemList.Builder()
                .addItem(row)
                .setOnSelectedListener(index -> {})
                .setSelectedIndex(0)
                .build();
        return b.setItemList(list)
                .setNavigateAction(new Action.Builder().setTitle("Bora!").setOnClickListener(() -> go(false)).build())
                .setActionStrip(new ActionStrip.Builder()
                        .addAction(new Action.Builder().setTitle("Simular").setOnClickListener(() -> go(true)).build())
                        .build())
                .build();
    }
}
