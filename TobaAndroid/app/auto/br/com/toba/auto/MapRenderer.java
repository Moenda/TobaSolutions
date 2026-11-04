package br.com.toba.auto;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.view.Surface;

import androidx.car.app.CarContext;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Desenha o mapa na tela do carro. Sem SDK de mapa: pede ao Mapbox uma imagem
 * pronta (Static Images API, estilos navigation-day/night) já girada pro rumo do
 * carro e com a rota pintada, e aqui só desliza/gira essa imagem a cada quadro
 * com o carango no meio. Imagem nova só quando o carro anda bastante ou vira,
 * então gasta pouco da cota grátis do Mapbox.
 */
final class MapRenderer implements SurfaceCallback {
    private static final int BG_NIGHT = 0xFF0D1117;
    private static final int BG_DAY = 0xFFE8EAED;
    private static final int TOBA_GREEN = 0xFF3FB950;
    private static final double ZOOM_NAV = 16.4;
    private static final double ZOOM_IDLE = 15.4;

    private final CarContext car;
    private final HandlerThread thread = new HandlerThread("toba-mapa");
    private final Handler h;
    private final ExecutorService net = Executors.newSingleThreadExecutor();
    private final Object lock = new Object();

    // superfície (protegida por lock)
    private Surface surface;
    private int W, H;
    private float s = 1f;
    private Rect visible;

    // estado (só na thread do mapa)
    private boolean running;
    private boolean hasCar;
    private double fromLat, fromLon, fromHead, toLat, toLon, toHead;
    private long animStart, animDur = 1000, lastFix;
    private Route route;
    private int routeSeg;
    private int routeVersion;
    private Route overview;
    private double overviewLat, overviewLon;

    // imagem atual
    private Bitmap img;
    private double imgLat, imgLon, imgBearing, imgZoom;
    private boolean imgOverview, imgDark;
    private int imgRouteVersion = -1;
    private boolean fetching;
    private long lastFetch, backoffUntil;
    private boolean styleFallback;
    private String note;

    private final Paint bmpPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint carFill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint carLine = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint small = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Matrix matrix = new Matrix();
    private final Path arrow = new Path();
    private final Runnable frame = this::frame;

    MapRenderer(CarContext car) {
        this.car = car;
        thread.start();
        h = new Handler(thread.getLooper());
        carFill.setColor(TOBA_GREEN);
        carFill.setStyle(Paint.Style.FILL);
        carFill.setShadowLayer(6, 0, 3, 0x88000000);
        carLine.setColor(Color.WHITE);
        carLine.setStyle(Paint.Style.STROKE);
        carLine.setStrokeJoin(Paint.Join.ROUND);
        text.setTextAlign(Paint.Align.CENTER);
        small.setColor(0xCCFFFFFF);
        small.setShadowLayer(2, 0, 1, 0xFF000000);
    }

    /* ------------------------------------------------------------ SurfaceCallback (main thread) */

    @Override
    public void onSurfaceAvailable(SurfaceContainer c) {
        synchronized (lock) {
            surface = c.getSurface();
            W = c.getWidth();
            H = c.getHeight();
            s = Math.max(1f, c.getDpi() / 160f);
            if (visible == null) visible = new Rect(0, 0, W, H);
        }
        h.post(() -> {
            imgRouteVersion = -1; // tamanho mudou: imagem nova
            if (!running) {
                running = true;
                h.post(frame);
            }
        });
    }

    @Override
    public void onVisibleAreaChanged(Rect area) {
        synchronized (lock) {
            visible = new Rect(area);
        }
        h.post(() -> {
            if (imgOverview) imgRouteVersion = -1; // prévia: refaz o enquadramento
        });
    }

    @Override
    public void onStableAreaChanged(Rect area) {}

    @Override
    public void onSurfaceDestroyed(SurfaceContainer c) {
        synchronized (lock) {
            surface = null; // espera o quadro atual terminar antes de devolver
        }
        h.post(() -> {
            running = false;
            h.removeCallbacks(frame);
        });
    }

    /* ------------------------------------------------------------ comandos (qualquer thread) */

    void setCar(double lat, double lon, double heading) {
        h.post(() -> {
            long now = SystemClock.uptimeMillis();
            if (!hasCar) {
                fromLat = toLat = lat;
                fromLon = toLon = lon;
                fromHead = toHead = heading;
                hasCar = true;
            } else {
                double[] cur = shown(now);
                fromLat = cur[0];
                fromLon = cur[1];
                fromHead = cur[2];
                toLat = lat;
                toLon = lon;
                toHead = heading;
                // pulo grande (GPS voltou, simulação nova): não desliza pela cidade toda
                if (Geo.distance(fromLat, fromLon, lat, lon) > 300) {
                    fromLat = lat;
                    fromLon = lon;
                    fromHead = heading;
                }
            }
            animDur = Math.max(250, Math.min(1500, now - lastFix));
            animStart = now;
            lastFix = now;
        });
    }

    void setRoute(Route r) {
        h.post(() -> {
            route = r;
            routeSeg = 0;
            routeVersion++;
        });
    }

    void setProgress(int seg) {
        h.post(() -> routeSeg = seg);
    }

    void clearRoute() {
        h.post(() -> {
            route = null;
            routeSeg = 0;
            routeVersion++;
        });
    }

    void showOverview(Route r, double originLat, double originLon) {
        h.post(() -> {
            overview = r;
            overviewLat = originLat;
            overviewLon = originLon;
            routeVersion++;
        });
    }

    void hideOverview() {
        h.post(() -> {
            if (overview == null) return;
            overview = null;
            routeVersion++;
        });
    }

    void destroy() {
        h.post(() -> {
            running = false;
            h.removeCallbacksAndMessages(null);
            thread.quitSafely();
        });
        net.shutdownNow();
    }

    /* ------------------------------------------------------------ desenho (thread do mapa) */

    private double[] shown(long now) {
        double t = animDur <= 0 ? 1 : Math.min(1, (now - animStart) / (double) animDur);
        return new double[] {
            fromLat + (toLat - fromLat) * t,
            fromLon + (toLon - fromLon) * t,
            Geo.norm(fromHead + Geo.angleDiff(fromHead, toHead) * t)
        };
    }

    private void frame() {
        if (!running) return;
        try {
            synchronized (lock) {
                if (surface != null && surface.isValid()) {
                    Canvas c = null;
                    try {
                        c = surface.lockHardwareCanvas();
                        draw(c);
                    } finally {
                        if (c != null) surface.unlockCanvasAndPost(c);
                    }
                }
            }
        } catch (RuntimeException ignored) {
            // superfície sumiu no meio do quadro: o próximo resolve
        }
        h.postDelayed(frame, overview != null ? 400 : 66);
    }

    private double mpp(double lat, double zoom) {
        // metros por pixel da tela (imagem de 512 por tile, desenhada na densidade do carro)
        return 78271.517 * Math.cos(Math.toRadians(lat)) / Math.pow(2, zoom) / s;
    }

    private float[] target(Rect v) {
        boolean nav = route != null;
        return new float[] {v.exactCenterX(), v.top + v.height() * (nav ? 0.72f : 0.55f)};
    }

    private void draw(Canvas c) {
        boolean dark = isDark();
        Rect v = visible == null ? new Rect(0, 0, W, H) : visible;
        c.drawColor(dark ? BG_NIGHT : BG_DAY);
        long now = SystemClock.uptimeMillis();
        double[] pos = hasCar ? shown(now) : null;
        maybeFetch(dark, pos, v);

        if (overview != null) {
            if (img != null && imgOverview) {
                c.drawBitmap(img, null, new Rect(0, 0, W, H), bmpPaint);
            } else {
                drawNote(c, v, dark, "🗺️ Montando a prévia…");
            }
            drawCredits(c, v);
            return;
        }
        if (pos == null) {
            drawNote(c, v, dark, "📡 Esperando o GPS…");
            return;
        }
        float[] T = target(v);
        if (img != null && !imgOverview) {
            double mppI = mpp(imgLat, imgZoom);
            double[] en = Geo.enu(imgLat, imgLon, pos[0], pos[1]);
            double b = Math.toRadians(imgBearing);
            double right = en[0] * Math.cos(b) - en[1] * Math.sin(b);
            double up = en[0] * Math.sin(b) + en[1] * Math.cos(b);
            float k = s / 2f;
            float D = img.getWidth() * k;
            float px = (float) (D / 2 + right / mppI);
            float py = (float) (D / 2 - up / mppI);
            matrix.reset();
            matrix.setScale(k, k);
            matrix.postTranslate(-px, -py);
            matrix.postRotate((float) (imgBearing - pos[2]));
            matrix.postTranslate(T[0], T[1]);
            c.drawBitmap(img, matrix, bmpPaint);
        } else {
            drawNote(c, v, dark, note != null ? note : "🗺️ Carregando o mapa…");
        }
        drawCar(c, T[0], T[1]);
        drawCredits(c, v);
    }

    private void drawCar(Canvas c, float x, float y) {
        float u = s;
        arrow.reset();
        arrow.moveTo(x, y - 20 * u);
        arrow.lineTo(x + 13 * u, y + 15 * u);
        arrow.lineTo(x, y + 8 * u);
        arrow.lineTo(x - 13 * u, y + 15 * u);
        arrow.close();
        carLine.setStrokeWidth(3.5f * u);
        c.drawPath(arrow, carFill);
        c.drawPath(arrow, carLine);
    }

    private void drawNote(Canvas c, Rect v, boolean dark, String msg) {
        text.setColor(dark ? 0xFFE6EDF3 : 0xFF1F2328);
        text.setTextSize(22 * s);
        c.drawText(msg, v.exactCenterX(), v.exactCenterY(), text);
    }

    private void drawCredits(Canvas c, Rect v) {
        small.setTextSize(10 * s);
        c.drawText("© Mapbox © OpenStreetMap", v.left + 8 * s, v.bottom - 8 * s, small);
    }

    private boolean isDark() {
        try {
            return car.isDarkMode();
        } catch (RuntimeException e) {
            return true;
        }
    }

    /* ------------------------------------------------------------ busca da imagem */

    private void maybeFetch(boolean dark, double[] pos, Rect v) {
        long now = SystemClock.uptimeMillis();
        if (fetching || now < backoffUntil || now - lastFetch < 1200 || W <= 0 || H <= 0) return;
        if (overview != null) {
            if (img != null && imgOverview && imgRouteVersion == routeVersion && imgDark == dark) return;
            fetchOverview(dark, v);
            return;
        }
        if (pos == null) return;
        double zoom = route != null ? ZOOM_NAV : ZOOM_IDLE;
        double[] want = centerFor(pos, zoom, v);
        boolean need = img == null || imgOverview || imgDark != dark || imgZoom != zoom || imgRouteVersion != routeVersion;
        if (!need) {
            double mppI = mpp(imgLat, imgZoom);
            double shift = Geo.distance(imgLat, imgLon, want[0], want[1]) / mppI;
            double D = img.getWidth() * s / 2f;
            need = shift > D * 0.16 || Math.abs(Geo.angleDiff(imgBearing, pos[2])) > 28;
        }
        if (need) fetchFollow(dark, want, zoom, Math.round(pos[2]) % 360);
    }

    /** Centro da imagem = ponto do mundo que cai no centro da tela (o carro fica mais embaixo). */
    private double[] centerFor(double[] pos, double zoom, Rect v) {
        float[] T = target(v);
        double m = mpp(pos[0], zoom);
        double right = (W / 2.0 - T[0]) * m;
        double up = -(H / 2.0 - T[1]) * m;
        double hd = Math.toRadians(pos[2]);
        double east = right * Math.cos(hd) + up * Math.sin(hd);
        double north = -right * Math.sin(hd) + up * Math.cos(hd);
        return Geo.offset(pos[0], pos[1], east, north);
    }

    private String style(boolean dark) {
        if (styleFallback) return dark ? "dark-v11" : "streets-v12";
        return dark ? "navigation-night-v1" : "navigation-day-v1";
    }

    private void fetchFollow(boolean dark, double[] center, double zoom, long bearing) {
        int side = (int) Math.min(1280, Math.ceil(Math.hypot(W, H) / s * 1.15));
        String overlay = routeOverlay(route, routeSeg, false);
        String position = String.format(Locale.US, "%.6f,%.6f,%.2f,%d,0", center[1], center[0], zoom, bearing);
        int version = routeVersion;
        start(dark, overlay, position, side, side, null, bmp -> {
            img = bmp;
            imgLat = center[0];
            imgLon = center[1];
            imgZoom = zoom;
            imgBearing = bearing;
            imgOverview = false;
            imgDark = dark;
            imgRouteVersion = version;
        });
    }

    private void fetchOverview(boolean dark, Rect v) {
        int w = (int) Math.min(1280, Math.round(W / s));
        int hh = (int) Math.min(1280, Math.round(H / s));
        int pt = clampPad(v.top / s + 36, hh), pb = clampPad((H - v.bottom) / s + 36, hh);
        int pl = clampPad(v.left / s + 36, w), pr = clampPad((W - v.right) / s + 36, w);
        String overlay = routeOverlay(overview, 0, true)
                + String.format(Locale.US, ",pin-s+3fb950(%.6f,%.6f)", overviewLon, overviewLat);
        String extra = "&padding=" + pt + "," + pr + "," + pb + "," + pl;
        int version = routeVersion;
        start(dark, overlay, "auto", w, hh, extra, bmp -> {
            img = bmp;
            imgOverview = true;
            imgDark = dark;
            imgRouteVersion = version;
        });
    }

    private static int clampPad(float pad, int dim) {
        return (int) Math.max(0, Math.min(pad, dim / 2f - 24));
    }

    interface OnImage {
        void apply(Bitmap bmp);
    }

    private void start(boolean dark, String overlay, String position, int w, int hh, String extra, OnImage done) {
        fetching = true;
        lastFetch = SystemClock.uptimeMillis();
        String style = style(dark);
        net.execute(() -> {
            try {
                String url = TobaApi.mapboxStatic(car, style, overlay, position, w, hh, extra);
                Bitmap bmp = TobaApi.getBitmap(url);
                h.post(() -> {
                    done.apply(bmp);
                    note = null;
                    fetching = false;
                });
            } catch (IOException e) {
                boolean refused = TobaApi.refreshAfterRefusal(car, e);
                boolean badStyle = e instanceof TobaApi.HttpError
                        && (((TobaApi.HttpError) e).code == 404 || ((TobaApi.HttpError) e).code == 422);
                h.post(() -> {
                    if (badStyle && !styleFallback) styleFallback = true;
                    note = "🗺️ Mapa: " + TobaApi.friendly(e);
                    backoffUntil = SystemClock.uptimeMillis() + (refused || badStyle ? 1500 : 6000);
                    fetching = false;
                });
            } catch (RuntimeException e) {
                h.post(() -> {
                    note = "🗺️ Mapa: " + e.getMessage();
                    backoffUntil = SystemClock.uptimeMillis() + 6000;
                    fetching = false;
                });
            }
        });
    }

    /** Rota pintada pelo Mapbox: só o que falta (até ~6 km), simplificada pra caber na URL. */
    private static String routeOverlay(Route r, int fromSeg, boolean whole) {
        if (r == null || r.size() < 2) return "";
        int from = Math.max(0, Math.min(fromSeg, r.size() - 2));
        int to = r.size() - 1;
        if (!whole) {
            double limit = r.cum[from] + 6000;
            while (to > from + 1 && r.cum[to - 1] > limit) to--;
        }
        double tol = whole ? Math.max(6, r.length / 1500) : 3;
        String poly = "";
        for (int tries = 0; tries < 8; tries++) {
            List<double[]> pts = Geo.simplify(r.lat, r.lon, from, to, tol);
            if (pts.size() < 2) {
                pts = new ArrayList<>();
                pts.add(new double[] {r.lat[from], r.lon[from]});
                pts.add(new double[] {r.lat[to], r.lon[to]});
            }
            poly = TobaApi.enc(Geo.encodePolyline(pts));
            if (poly.length() < 6000) break;
            tol *= 2;
        }
        StringBuilder sb = new StringBuilder("path-8+3fb950-0.95(").append(poly).append(')');
        if (r.dest != null && (whole || to == r.size() - 1)) {
            sb.append(String.format(Locale.US, ",pin-l+e5534b(%.6f,%.6f)", r.dest.lon, r.dest.lat));
        }
        return sb.toString();
    }
}
