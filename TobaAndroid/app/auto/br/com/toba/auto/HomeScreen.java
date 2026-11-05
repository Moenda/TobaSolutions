package br.com.toba.auto;

import android.Manifest;

import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.OnClickListener;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.MessageInfo;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.car.app.versioning.CarAppApiLevels;
import androidx.core.graphics.drawable.IconCompat;

import br.com.toba.app.R;

import java.util.Arrays;

/**
 * Tela principal do carro: mapa, botões Buscar/Recentes e, com rota, a manobra.
 * v1.78: com o mapa 3D (CarMap.drawsHud) a manobra, a chegada e as velocidades
 * são desenhadas no próprio mapa, sem os cartões pretos do Android Auto; os
 * botões 🧊 3D/2D e 🎨 skin ficam no canto do mapa.
 */
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

    private Action icon(int res, OnClickListener click) {
        return new Action.Builder()
                .setIcon(new CarIcon.Builder(IconCompat.createWithResource(getCarContext(), res)).build())
                .setOnClickListener(click)
                .build();
    }

    private void toggle3d() {
        boolean on = engine.map().toggle3d();
        CarToast.makeText(getCarContext(), on ? "🧊 Mapa 3D" : "🗺️ Mapa 2D", CarToast.LENGTH_SHORT).show();
        invalidate();
    }

    private void nextSkin() {
        CarToast.makeText(getCarContext(), "🎨 " + engine.map().nextSkin(), CarToast.LENGTH_SHORT).show();
    }

    @Override
    public Template onGetTemplate() {
        NavigationTemplate.Builder b = new NavigationTemplate.Builder();
        ActionStrip.Builder strip = new ActionStrip.Builder();
        boolean hud = engine.map().drawsHud();
        Action mute = icon(engine.muted() ? R.drawable.ic_car_mute : R.drawable.ic_car_sound, () -> {
            engine.toggleMute();
            CarToast.makeText(getCarContext(), engine.muted() ? "🔇 Mudo" : "🔊 Com voz", CarToast.LENGTH_SHORT).show();
            invalidate();
        });
        // v1.80: faixa de cima só com ícones (cabe até 4)
        if (engine.isNavigating()) {
            strip.addAction(icon(R.drawable.ic_car_stop, () -> engine.stop(true)));
            strip.addAction(mute);
            if (!hud) {
                // plano B (sem mapa 3D): cartões do Android Auto
                b.setNavigationInfo(routingInfo());
                TravelEstimate te = engine.estimate();
                if (te != null) b.setDestinationTravelEstimate(te);
            }
        } else {
            strip.addAction(icon(R.drawable.ic_car_search, () ->
                    getScreenManager().push(new SearchScreen(getCarContext(), engine))));
            strip.addAction(icon(R.drawable.ic_car_star, () ->
                    getScreenManager().push(new FavScreen(getCarContext(), engine))));
            strip.addAction(icon(R.drawable.ic_car_history, () ->
                    getScreenManager().push(new RecentScreen(getCarContext(), engine))));
            strip.addAction(mute);
            MessageInfo msg = idleMessage();
            if (msg != null) b.setNavigationInfo(msg);
        }
        if (hud) {
            // v1.82: o botão mostra o modo de agora ("3D" ou "2D" escrito); tocar troca
            Action view = icon(engine.map().is3d() ? R.drawable.ic_map_3d : R.drawable.ic_map_2d, this::toggle3d);
            Action center = icon(R.drawable.ic_car_center, this::recenter);
            Action skin = icon(R.drawable.ic_map_skin, this::nextSkin);
            if (getCarContext().getCarAppApiLevel() >= CarAppApiLevels.LEVEL_2) {
                // v1.80: lado direito = 2D/3D, centralizar e luz do mapa
                b.setMapActionStrip(new ActionStrip.Builder().addAction(view).addAction(center).addAction(skin).build());
            } else if (engine.isNavigating()) {
                strip.addAction(view); // host antigo: só 4 na faixa de cima
                strip.addAction(skin);
            }
        }
        b.setActionStrip(strip.build());
        return b.build();
    }

    private void recenter() {
        engine.map().recenter();
        CarToast.makeText(getCarContext(), "🎯 Centralizado", CarToast.LENGTH_SHORT).show();
    }

    private RoutingInfo routingInfo() {
        Route.Instr next = engine.nextInstr();
        if (engine.isRerouting() || next == null) {
            return new RoutingInfo.Builder().setLoading(true).build();
        }
        Place dest = engine.destination();
        RoutingInfo.Builder rb = new RoutingInfo.Builder()
                .setCurrentStep(Maneuvers.step(getCarContext(), next, dest), Maneuvers.distance(engine.distToNext()));
        // v1.78: sem a "manobra seguinte" embaixo (cartão menor)
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
