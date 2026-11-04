package br.com.toba.auto;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.net.URLDecoder;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Uma sessão = o Toba aberto na tela do carro. Dona do mapa e do motor de navegação. */
public final class TobaCarSession extends Session {
    private MapRenderer renderer;
    private NavEngine engine;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @Override
    public Screen onCreateScreen(Intent intent) {
        CarContext car = getCarContext();
        renderer = new MapRenderer(car);
        car.getCarService(AppManager.class).setSurfaceCallback(renderer);
        engine = new NavEngine(car, renderer);
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onDestroy(LifecycleOwner owner) {
                engine.destroy();
                renderer.destroy();
                io.shutdownNow();
            }
        });
        HomeScreen home = new HomeScreen(car, engine);
        main.post(() -> handleNavigateIntent(intent));
        return home;
    }

    @Override
    public void onNewIntent(Intent intent) {
        handleNavigateIntent(intent);
    }

    /**
     * "Ok Google, navegar até a padaria com o Toba": o Assistente manda
     * geo:lat,lon?q=texto. Com coordenada vai direto pra prévia; com texto, busca
     * e pega o primeiro resultado.
     */
    private void handleNavigateIntent(Intent intent) {
        if (intent == null || engine == null) return;
        if (!CarContext.ACTION_NAVIGATE.equals(intent.getAction())) return;
        Uri data = intent.getData();
        if (data == null) return;
        String ssp = data.getSchemeSpecificPart();
        if (ssp == null) return;
        String coords = ssp;
        String query = null;
        int q = ssp.indexOf('?');
        if (q >= 0) {
            coords = ssp.substring(0, q);
            for (String part : ssp.substring(q + 1).split("&")) {
                if (part.startsWith("q=")) {
                    try {
                        query = URLDecoder.decode(part.substring(2), "UTF-8");
                    } catch (Exception e) {
                        query = part.substring(2);
                    }
                }
            }
        }
        double[] ll = Geo.parseLatLon(coords);
        if ((ll == null || (ll[0] == 0 && ll[1] == 0)) && query != null) {
            // q pode ser "lat,lon(nome)"
            double[] fromQ = Geo.parseLatLon(query.replaceAll("\\(.*\\)", ""));
            if (fromQ != null) {
                ll = fromQ;
                int p = query.indexOf('(');
                query = p >= 0 && query.endsWith(")") ? query.substring(p + 1, query.length() - 1) : null;
            }
        }
        CarContext car = getCarContext();
        if (ll != null && !(ll[0] == 0 && ll[1] == 0)) {
            Place place = new Place(query != null ? query : "Destino", "", ll[0], ll[1]);
            openPreview(place);
            return;
        }
        if (query == null || query.trim().isEmpty()) return;
        final String text = query.trim();
        CarToast.makeText(car, "Procurando " + text + "…", CarToast.LENGTH_SHORT).show();
        android.location.Location here = engine.lastLocation();
        io.execute(() -> {
            try {
                List<Place> found = TobaApi.search(car, text, here, false);
                main.post(() -> {
                    if (found.isEmpty()) {
                        CarToast.makeText(car, "Não achei " + text + " 😢", CarToast.LENGTH_LONG).show();
                    } else {
                        openPreview(found.get(0));
                    }
                });
            } catch (Exception e) {
                main.post(() -> CarToast.makeText(car, "Busca falhou: " + TobaApi.friendly(e), CarToast.LENGTH_LONG).show());
            }
        });
    }

    private void openPreview(Place place) {
        CarContext car = getCarContext();
        androidx.car.app.ScreenManager sm = car.getCarService(androidx.car.app.ScreenManager.class);
        sm.popToRoot();
        sm.push(new PreviewScreen(car, engine, place));
    }
}
