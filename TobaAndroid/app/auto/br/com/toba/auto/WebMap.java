package br.com.toba.auto;

import android.app.Presentation;
import android.content.Context;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.os.Handler;
import android.os.Looper;
import android.view.Surface;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.car.app.CarContext;
import androidx.car.app.SurfaceContainer;

import java.util.LinkedHashMap;
import java.util.Map;

import br.com.toba.app.BuildConfig;

/**
 * v1.78 (APK 1.7): o mapa do carro é o MESMO mapa 3D do 🧭 Navegar do site
 * (Mapbox GL, estilo Standard, prédios em 3D, luz de noite). Como a Car App
 * Library só entrega uma Surface pra desenhar, o Toba cria uma tela virtual
 * (VirtualDisplay) em cima dessa Surface e mostra nela um WebView com a página
 * TobaDrive/TobaDrive-Auto.html. O Java manda carro, rota e painel pra página
 * (window.tobaAuto.*); a página avisa quando o mapa ficou pronto (TobaAuto.ready).
 *
 * Deu ruim (sem internet na 1ª vez, WebGL, Mapbox recusou, demorou demais)?
 * Host.onWebFailed e o CarMap volta pro plano B (MapRenderer, imagens estáticas).
 */
final class WebMap {
    interface Host {
        void onWebReady();

        void onWebFailed(String why);

        /** v1.80: a página quer falar (aviso de radar). Main thread. */
        default void onWebSay(String text) {}
    }

    static final String URL = TobaApi.SITE + "TobaDrive/TobaDrive-Auto.html?apk=" + BuildConfig.VERSION_NAME;
    private static final long READY_TIMEOUT_MS = 25000;

    private final CarContext car;
    private final Host host;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, String> pending = new LinkedHashMap<>();

    private VirtualDisplay vd;
    private Presentation pres;
    private WebView web;
    private int vw, vh, vdpi;
    private boolean ready;
    private boolean failed;

    private final Runnable timeout = () -> fail("o mapa 3D demorou demais pra abrir");

    WebMap(CarContext car, Host host) {
        this.car = car;
        this.host = host;
    }

    boolean isReady() {
        return ready && !failed;
    }

    boolean hasFailed() {
        return failed;
    }

    /** Surface nova do carro. false = não deu (o CarMap usa o plano B). Main thread. */
    boolean attach(SurfaceContainer c) {
        if (failed) return false;
        Surface s = c.getSurface();
        int w = c.getWidth(), h = c.getHeight(), dpi = Math.max(120, c.getDpi());
        if (s == null || w <= 0 || h <= 0) return false;
        try {
            if (vd != null && w == vw && h == vh && dpi == vdpi) {
                vd.setSurface(s); // voltou pra tela do Toba: mesmo mapa, sem recarregar
                return true;
            }
            teardown(); // primeira vez ou mudou o tamanho (a Presentation não aguenta mudar)
            DisplayManager dm = (DisplayManager) car.getSystemService(Context.DISPLAY_SERVICE);
            if (dm == null) throw new IllegalStateException("sem DisplayManager");
            vd = dm.createVirtualDisplay("toba-auto-mapa", w, h, dpi, s, 0);
            if (vd == null) throw new IllegalStateException("sem tela virtual");
            vw = w;
            vh = h;
            vdpi = dpi;
            pres = new Presentation(car, vd.getDisplay(), android.R.style.Theme_DeviceDefault_NoActionBar);
            web = build(pres.getContext());
            pres.setContentView(web, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            pres.setCancelable(false);
            pres.show();
            ready = false;
            web.loadUrl(URL);
            main.removeCallbacks(timeout);
            main.postDelayed(timeout, READY_TIMEOUT_MS);
            return true;
        } catch (RuntimeException e) {
            fail("tela virtual: " + e.getClass().getSimpleName());
            return false;
        }
    }

    /** O carro tirou a Surface (foi pra outra tela): pausa sem perder o mapa. */
    void detach() {
        try {
            if (vd != null) vd.setSurface(null);
        } catch (RuntimeException ignored) {
            // já era
        }
    }

    void destroy() {
        main.removeCallbacksAndMessages(null);
        teardown();
        pending.clear();
    }

    private void teardown() {
        ready = false;
        if (web != null) {
            try {
                web.stopLoading();
                web.destroy();
            } catch (RuntimeException ignored) {
                // já era
            }
            web = null;
        }
        if (pres != null) {
            try {
                pres.dismiss();
            } catch (RuntimeException ignored) {
                // já era
            }
            pres = null;
        }
        if (vd != null) {
            try {
                vd.release();
            } catch (RuntimeException ignored) {
                // já era
            }
            vd = null;
        }
    }

    private void fail(String why) {
        if (failed) return;
        failed = true;
        main.removeCallbacks(timeout);
        teardown();
        pending.clear();
        host.onWebFailed(why);
    }

    /**
     * Roda tobaAuto.<call> na página. Antes do mapa ficar pronto guarda só o
     * último de cada tipo (key) e manda tudo no ready.
     */
    void call(String key, String js) {
        if (failed) return;
        String full = "window.tobaAuto&&" + js;
        if (!ready || web == null) {
            pending.remove(key);
            pending.put(key, full);
            return;
        }
        try {
            web.evaluateJavascript(full, null);
        } catch (RuntimeException ignored) {
            // página trocando
        }
    }

    /** v1.80: toque de botão (zoom, centralizar): só vale com o mapa pronto, não guarda pra depois. */
    void callNow(String js) {
        if (failed || !ready || web == null) return;
        try {
            web.evaluateJavascript("try{window.tobaAuto&&" + js + "}catch(e){}", null);
        } catch (RuntimeException ignored) {
            // página trocando
        }
    }

    private WebView build(Context ctx) {
        WebView w = new WebView(ctx);
        w.setBackgroundColor(0xFF0D1117);
        WebSettings st = w.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setUserAgentString(st.getUserAgentString() + " TobaApp/" + BuildConfig.VERSION_NAME + " TobaAuto");
        w.setVerticalScrollBarEnabled(false);
        w.setHorizontalScrollBarEnabled(false);
        w.addJavascriptInterface(new Bridge(), "TobaAuto");
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // o carro não navega pra lugar nenhum
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    main.post(() -> fail("sem a página do mapa (" + error.getDescription() + ")"));
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view == web) {
                    web = null; // o Android já matou: não chamar destroy de novo no teardown
                    try {
                        view.destroy();
                    } catch (RuntimeException ignored) {
                        // já era
                    }
                    main.post(() -> fail("o mapa 3D caiu"));
                }
                return true;
            }
        });
        return w;
    }

    /** window.TobaAuto na página do carro (chamado fora da main thread). */
    private final class Bridge {
        @JavascriptInterface
        public void ready() {
            main.post(() -> {
                if (failed || web == null || ready) return;
                ready = true;
                main.removeCallbacks(timeout);
                for (String js : pending.values()) {
                    try {
                        web.evaluateJavascript(js, null);
                    } catch (RuntimeException ignored) {
                        // segue
                    }
                }
                pending.clear();
                host.onWebReady();
            });
        }

        @JavascriptInterface
        public void fail(String why) {
            main.post(() -> WebMap.this.fail(why == null || why.isEmpty() ? "o mapa 3D não abriu" : why));
        }

        @JavascriptInterface
        public int version() {
            return 2; // 2 = v1.80 (say)
        }

        /** v1.80: aviso falado da página (radar). Respeita o mudo do carro. */
        @JavascriptInterface
        public void say(String text) {
            if (text == null || text.trim().isEmpty() || text.length() > 200) return;
            main.post(() -> {
                if (!failed) host.onWebSay(text);
            });
        }
    }
}
