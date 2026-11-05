package br.com.toba.auto;

import android.graphics.Rect;

import androidx.car.app.CarContext;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

/**
 * v1.78 (APK 1.7): o mapa do carro. Primeiro tenta o mapa 3D do site (WebMap,
 * com o painel enxuto desenhado nele: manobra, velocidade, limite da rua e
 * chegada). Se não der, cai no plano B de imagens estáticas (MapRenderer) com os
 * cartões do próprio Android Auto. O NavEngine só fala com esta classe.
 */
final class CarMap implements SurfaceCallback, WebMap.Host {
    /** Luz do mapa no botão 🎨 (mesma ordem do AM_SKINS em TobaDrive/js/auto-map.js). */
    static final String[] SKINS = {"Auto (farol do carro)", "Amanhecer", "Dia", "Entardecer", "Noite"};

    private final CarContext car;
    private final MapRenderer still;
    private final WebMap web;
    private Runnable onModeChanged;

    private boolean useWeb = true;
    private SurfaceContainer container;
    private Rect visible;
    private Boolean sentDark;
    private boolean map3d;
    private int skin;

    CarMap(CarContext car) {
        this.car = car;
        this.still = new MapRenderer(car);
        this.web = new WebMap(car, this);
        this.map3d = AutoStore.map3d(car);
        this.skin = Math.floorMod(AutoStore.skin(car), SKINS.length);
        sendConfig();
    }

    void setOnModeChanged(Runnable r) {
        onModeChanged = r;
    }

    /** true = o painel (manobra, chegada, velocidade) é desenhado no mapa 3D; false = cartões do Auto. */
    boolean drawsHud() {
        return useWeb && web.isReady();
    }

    boolean is3d() {
        return map3d;
    }

    /* ------------------------------------------------------------ SurfaceCallback */

    @Override
    public void onSurfaceAvailable(SurfaceContainer c) {
        container = c;
        if (useWeb) {
            if (web.attach(c)) sendConfig();
            // não deu: o attach já chamou onWebFailed, que entregou a Surface pro plano B
            return;
        }
        still.onSurfaceAvailable(c);
    }

    @Override
    public void onVisibleAreaChanged(Rect area) {
        visible = area == null ? null : new Rect(area);
        still.onVisibleAreaChanged(area);
        sendConfig();
    }

    @Override
    public void onStableAreaChanged(Rect area) {
        still.onStableAreaChanged(area);
    }

    @Override
    public void onSurfaceDestroyed(SurfaceContainer c) {
        if (useWeb) web.detach();
        else still.onSurfaceDestroyed(c);
        container = null;
    }

    /* ------------------------------------------------------------ WebMap.Host */

    @Override
    public void onWebReady() {
        sendConfig();
        if (onModeChanged != null) onModeChanged.run();
    }

    @Override
    public void onWebFailed(String why) {
        if (!useWeb) return;
        useWeb = false;
        android.util.Log.w("TobaAuto", "mapa 3D -> plano B: " + why);
        if (container != null) {
            still.onSurfaceAvailable(container);
            if (visible != null) still.onVisibleAreaChanged(visible);
        }
        if (onModeChanged != null) onModeChanged.run();
    }

    /* ------------------------------------------------------------ botões */

    boolean toggle3d() {
        map3d = !map3d;
        AutoStore.setMap3d(car, map3d);
        sendConfig();
        return map3d;
    }

    String nextSkin() {
        skin = (skin + 1) % SKINS.length;
        AutoStore.setSkin(car, skin);
        sendConfig();
        return SKINS[skin];
    }

    /* ------------------------------------------------------------ dados (main thread) */

    void setCar(double lat, double lon, double heading, float speed) {
        still.setCar(lat, lon, heading);
        if (sentDark == null || sentDark != isDark()) sendConfig();
        web.call("car", String.format(Locale.US, "tobaAuto.car({lat:%.7f,lon:%.7f,head:%.1f,speed:%.2f})",
                lat, lon, heading, Math.max(0f, speed)));
    }

    void setRoute(Route r) {
        still.setRoute(r);
        web.call("route", "tobaAuto.route(" + routeJson(r) + ")");
    }

    void setProgress(int seg, double along) {
        still.setProgress(seg);
        web.call("progress", String.format(Locale.US, "tobaAuto.progress({seg:%d,along:%.1f})", seg, along));
    }

    void clearRoute() {
        still.clearRoute();
        web.call("route", "tobaAuto.route(null)");
        web.call("progress", "tobaAuto.progress(null)");
    }

    void showOverview(Route r, double originLat, double originLon) {
        still.showOverview(r, originLat, originLon);
        String js = "tobaAuto.overview({route:" + routeJson(r) + ",origin:["
                + String.format(Locale.US, "%.6f,%.6f", originLat, originLon) + "]})";
        web.call("overview", js);
    }

    void hideOverview() {
        still.hideOverview();
        web.call("overview", "tobaAuto.overview(null)");
    }

    /** Painel do mapa 3D (manobra, chegada, velocidade, limite). json pronto do NavEngine. */
    void hud(String json) {
        web.call("hud", "tobaAuto.hud(" + (json == null ? "null" : json) + ")");
    }

    void destroy() {
        web.destroy();
        still.destroy();
    }

    /* ------------------------------------------------------------ miúdos */

    private boolean isDark() {
        try {
            return car.isDarkMode();
        } catch (RuntimeException e) {
            return true;
        }
    }

    private void sendConfig() {
        boolean dark = isDark();
        sentDark = dark;
        float d = 160f / Math.max(120, container == null ? 160 : container.getDpi());
        int t = 0, l = 0, b = 0, r = 0;
        if (visible != null && container != null) {
            t = Math.round(visible.top * d);
            l = Math.round(visible.left * d);
            b = Math.round(Math.max(0, container.getHeight() - visible.bottom) * d);
            r = Math.round(Math.max(0, container.getWidth() - visible.right) * d);
        }
        web.call("config", String.format(Locale.US,
                "tobaAuto.config({dark:%b,mode3d:%b,skin:%d,pad:{t:%d,r:%d,b:%d,l:%d}})",
                dark, map3d, skin, t, r, b, l));
    }

    /** Rota pro mapa 3D: pontos (6 casas), trechos de trânsito e destino. */
    private static String routeJson(Route r) {
        if (r == null || r.size() < 2) return "null";
        try {
            JSONObject o = new JSONObject();
            o.put("id", r.createdAt);
            StringBuilder pts = new StringBuilder("[");
            for (int i = 0; i < r.size(); i++) {
                if (i > 0) pts.append(',');
                pts.append(String.format(Locale.US, "[%.6f,%.6f]", r.lat[i], r.lon[i]));
            }
            pts.append(']');
            JSONArray jams = new JSONArray();
            for (int[] j : r.jams) jams.put(new JSONArray().put(j[0]).put(j[1]).put(j[2]));
            o.put("jams", jams);
            if (r.dest != null) o.put("dest", new JSONArray().put(r.dest.lat).put(r.dest.lon));
            String base = o.toString();
            // pts entra cru (JSONArray de double vira texto enorme e lento)
            return base.substring(0, base.length() - 1) + ",\"pts\":" + pts + "}";
        } catch (JSONException e) {
            return "null";
        }
    }
}
