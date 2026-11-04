package br.com.toba.auto;

import android.Manifest;

import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.OnClickListener;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.MessageInfo;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.Arrays;

/** Tela principal do carro: mapa, botões Buscar/Recentes e, com rota, o cartão da manobra. */
final class HomeScreen extends Screen implements NavEngine.Listener {
    private final NavEngine engine;
    private boolean askedPermission;

    HomeScreen(CarContext car, NavEngine engine) {
        super(car);
        this.engine = engine;
        engine.setListener(this);
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(LifecycleOwner owner) {
                askPermission();
            }
        });
    }

    @Override
    public void onNavChanged() {
        invalidate();
    }

    private void askPermission() {
        if (engine.hasPermission()) {
            engine.startLocation();
            return;
        }
        if (askedPermission) return;
        askedPermission = true;
        try {
            getCarContext().requestPermissions(
                    Arrays.asList(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                    (granted, rejected) -> {
                        engine.startLocation();
                        invalidate();
                    });
        } catch (RuntimeException e) {
            CarToast.makeText(getCarContext(), "Abre o Toba no celular e libera a localização", CarToast.LENGTH_LONG).show();
        }
    }

    private static Action button(String title, OnClickListener click) {
        return new Action.Builder().setTitle(title).setOnClickListener(click).build();
    }

    @Override
    public Template onGetTemplate() {
        NavigationTemplate.Builder b = new NavigationTemplate.Builder();
        ActionStrip.Builder strip = new ActionStrip.Builder();
        if (engine.isNavigating()) {
            strip.addAction(button("Parar", () -> engine.stop(true)));
            strip.addAction(button(engine.muted() ? "Som" : "Mudo", engine::toggleMute));
            b.setNavigationInfo(routingInfo());
            TravelEstimate te = engine.estimate();
            if (te != null) b.setDestinationTravelEstimate(te);
        } else {
            strip.addAction(button("Buscar", () ->
                    getScreenManager().push(new SearchScreen(getCarContext(), engine))));
            strip.addAction(button("Recentes", () ->
                    getScreenManager().push(new RecentScreen(getCarContext(), engine))));
            MessageInfo msg = idleMessage();
            if (msg != null) b.setNavigationInfo(msg);
        }
        b.setActionStrip(strip.build());
        return b.build();
    }

    private RoutingInfo routingInfo() {
        Route.Instr next = engine.nextInstr();
        if (engine.isRerouting() || next == null) {
            return new RoutingInfo.Builder().setLoading(true).build();
        }
        Place dest = engine.destination();
        RoutingInfo.Builder rb = new RoutingInfo.Builder()
                .setCurrentStep(Maneuvers.step(getCarContext(), next, dest), Maneuvers.distance(engine.distToNext()));
        Route.Instr after = engine.afterInstr();
        if (after != null) rb.setNextStep(Maneuvers.step(getCarContext(), after, dest));
        return rb.build();
    }

    private MessageInfo idleMessage() {
        if (engine.state() == NavEngine.State.ARRIVED) {
            Place d = engine.destination();
            return new MessageInfo.Builder("🏁 Chegou" + (d == null ? "!" : " em " + d.name + "!"))
                    .setText("Nunca foi sorte, Cloba. Nunca foi sorte. 🙏")
                    .build();
        }
        if (!engine.hasPermission()) {
            return new MessageInfo.Builder("📍 Libera a localização")
                    .setText("No celular: Toba › Permissões › Localização › Permitir durante o uso")
                    .build();
        }
        if (engine.lastLocation() == null) {
            return new MessageInfo.Builder("📡 Procurando o GPS…").setText("Já já o carango aparece no mapa").build();
        }
        return null;
    }
}
