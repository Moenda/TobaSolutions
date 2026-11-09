package br.com.toba.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

import br.com.toba.auto.DriveSync;
import br.com.toba.auto.NavService;

/**
 * O app é só uma janela para o site publicado (BuildConfig.START_URL).
 * Publicou um patch no GitHub Pages? O app já abre a versão nova.
 * Os dados ficam no armazenamento desta janela (separado do Chrome):
 * na 1ª vez, importe o backup geral do portal.
 *
 * v1.77 (APK 1.6): este arquivo mudou de casa, de src/main/java/br/com/toba/app/
 * pra app/auto/br/com/toba/app/ (mesmo pacote; o Cloba só alcança até 7 pastas).
 * Navegando no 🧭 Toba Drive (TobaNative.navKeepAlive), a rota não morre com o
 * celular bloqueado: serviço em primeiro plano (NavService), GPS nativo mandado
 * pra página (window.onTobaNativeFix), WebView sem pausar e voz do Android.
 * v1.78 (APK 1.7): rota junta com o Android Auto (DriveSync): rota do carro chega
 * no site por window.onTobaAutoRoute; a do site vai pro carro por TobaNative.autoRoute.
 * v1.85 (APK 2.1): Compartilhar › Toba (ACTION_SEND) abre o Toba Places com o texto
 * no ?title=&text= (mesmo formato do share_target do site instalado pelo Chrome).
 * v1.87 (APK 2.2): ⌚ Relógio do Toba Health. Pedido de permissão do Health Connect
 * (askHealthPermissions -> window.onTobaHealthPerms) e resposta das leituras (healthJs).
 * O "Política de privacidade" da tela do Health Connect abre o Relógio (activity-alias no manifest).
 */
public class MainActivity extends Activity {
    static final String EXTRA_URL = "url";
    static volatile boolean visible = false;
    private static final int REQ_FILE = 10;
    private static final int REQ_NOTIFY = 11;
    private static final int REQ_LOCATION = 12;
    private static final int REQ_HEALTH = 13;
    static final String RELOGIO_PAGE = "TobaHealth/TobaHealth-Relogio.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    // v1.76 (APK 1.5): pedido de GPS do site esperando o "Permitir" do Android
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;
    // v1.77 (APK 1.6): navegando com a tela apagada
    private volatile boolean navigating = false;
    private LocationListener navGps;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private int ttsSeq = 0;
    // v2.04 (APK 2.9): fala que chegou antes do motor de voz ficar pronto (falava só depois do Drive)
    private String ttsPending;
    private AudioManager ttsAudio;
    private AudioFocusRequest ttsFocus;
    // v1.78 (APK 1.7): rota do Android Auto -> 🧭 Toba Drive do site (window.onTobaAutoRoute)
    private final DriveSync.Phone carRoutes = json -> runOnUiThread(() -> {
        if (web != null) web.evaluateJavascript("window.onTobaAutoRoute&&window.onTobaAutoRoute(" + json + ")", null);
    });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notifier.ensureChannels(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0D1117);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // v1.76: GPS liberado pro site (Toba Drive, Places...). Sem isso o WebView nega calado.
        s.setGeolocationEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " TobaApp/" + BuildConfig.VERSION_NAME);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        // A ponte só existe dentro do app; no navegador o site funciona como sempre.
        web.addJavascriptInterface(new TobaBridge(this), "TobaNative");
        ensureTts(); // v2.04: voz pronta antes do 1º aviso do treino (antes só ligava no Partiu do Drive)

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isOwnSite(url)) return false;
                // Link de fora (docs, banco...) abre no navegador, nunca dentro do app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                    // nenhum app para abrir
                }
                return true;
            }

            // v1.77: processo do site morreu (falta de memória com a tela apagada): sem
            // isso o Android fecha o app inteiro. Recria a janela; a página volta pra
            // rota sozinha (viagem guardada no localStorage, ver navegar.js).
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view == web) {
                    web = null;
                    try {
                        view.destroy();
                    } catch (Exception ignored) {
                        // já era
                    }
                    recreate();
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // <input type="file"> (Restaurar backup)
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*"); // .json às vezes aparece como "arquivo genérico"
                // v1.89 (APK 2.3): <input multiple> (📥 histórico do Samsung Health = vários CSVs)
                if (params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(pick, REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            // v1.76: o site pediu o GPS (navigator.geolocation). Só o nosso site ganha.
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!isOwnSite(Uri.parse(origin))) {
                    callback.invoke(origin, false, false);
                    return;
                }
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                if (geoCallback != null) geoCallback.invoke(geoOrigin, false, false);
                geoOrigin = origin;
                geoCallback = callback;
                requestPermissions(new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            }

            @Override
            public void onGeolocationPermissionsHidePrompt() {
                geoOrigin = null;
                geoCallback = null;
            }
        });

        String shared = savedInstanceState == null ? sharedPlacesUrl(getIntent()) : null;
        if (shared != null) {
            web.loadUrl(shared);
        } else if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(startUrl(getIntent()));
        }
        askNotificationPermission();
        DriveSync.setPhone(carRoutes);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String shared = sharedPlacesUrl(intent);
        if (shared != null && web != null) {
            web.loadUrl(shared);
            return;
        }
        if (isHealthRationale(intent) && web != null) {
            web.loadUrl(BuildConfig.START_URL + RELOGIO_PAGE);
            return;
        }
        String url = intent.getStringExtra(EXTRA_URL);
        if (url != null && isOwnSite(Uri.parse(url))) web.loadUrl(url);
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        if (web == null) return;
        web.onResume();
        // O Gastos usa isso para lançar compras lidas enquanto o app estava fechado.
        web.evaluateJavascript("window.onTobaAppResume && window.onTobaAppResume()", null);
    }

    @Override
    protected void onPause() {
        visible = false;
        // v1.77: navegando, o WebView NÃO pausa (pausar = página para de rodar a rota)
        if (web != null && !navigating) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        DriveSync.clearPhone(carRoutes);
        stopNav();
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
        releaseTtsFocus();
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri[] picked = null;
            // v1.89: vários arquivos voltam no ClipData (o parseResult só pega um)
            if (resultCode == RESULT_OK && data != null && data.getClipData() != null) {
                android.content.ClipData clip = data.getClipData();
                picked = new Uri[clip.getItemCount()];
                for (int i = 0; i < picked.length; i++) picked[i] = clip.getItemAt(i).getUri();
            } else {
                picked = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
            fileCallback.onReceiveValue(picked);
            fileCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_HEALTH) {
            // v1.87: a resposta volta pro ⌚ Relógio com o que ficou liberado
            healthJs("window.onTobaHealthPerms&&window.onTobaHealthPerms(" + new TobaBridge(this).healthStatus() + ")");
            return;
        }
        if (requestCode == REQ_LOCATION && geoCallback != null) {
            geoCallback.invoke(geoOrigin, hasLocationPermission(), false);
            geoOrigin = null;
            geoCallback = null;
        }
    }

    boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
        }
    }

    /* ---------------- v1.87 (APK 2.2): ⌚ Relógio (Health Connect) ---------------- */

    // No Android 14+ as permissões do Health Connect são pedidas como qualquer outra:
    // o sistema abre a tela do Health Connect com as caixinhas.
    void askHealthPermissions(String[] perms) {
        runOnUiThread(() -> {
            if (perms == null || perms.length == 0) {
                healthJs("window.onTobaHealthPerms&&window.onTobaHealthPerms(" + new TobaBridge(this).healthStatus() + ")");
                return;
            }
            try {
                requestPermissions(perms, REQ_HEALTH);
            } catch (Exception e) {
                healthJs("window.onTobaHealthPerms&&window.onTobaHealthPerms(" + new TobaBridge(this).healthStatus() + ")");
            }
        });
    }

    void healthJs(String js) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    void keepScreenOn(boolean on) {
        runOnUiThread(() -> {
            if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    /* ---------------- v1.77: 🧭 Toba Drive com a tela apagada ---------------- */

    // Chamado pela ponte (TobaNative.navKeepAlive) no Partiu e no fim da rota.
    void setNavigating(boolean on, String text) {
        runOnUiThread(() -> {
            if (on) startNav(text);
            else stopNav();
        });
    }

    @android.annotation.SuppressLint("MissingPermission") // hasLocationPermission() logo abaixo
    private void startNav(String text) {
        navigating = true;
        // processo do site com prioridade alta mesmo escondido (senão o Android mata primeiro)
        if (web != null) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        NavService.start(this, "🧭 Navegando no Toba", text == null || text.isEmpty() ? "Rota ligada" : text);
        if (navGps == null && hasLocationPermission()) {
            LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            // classe com os 4 métodos (Android 10 ainda chama onStatusChanged)
            navGps = new LocationListener() {
                @Override
                public void onLocationChanged(Location l) {
                    sendFix(l);
                }

                @Override
                @SuppressWarnings("deprecation")
                public void onStatusChanged(String provider, int status, Bundle extras) {
                }

                @Override
                public void onProviderEnabled(String provider) {
                }

                @Override
                public void onProviderDisabled(String provider) {
                }
            };
            try {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, navGps, Looper.getMainLooper());
            } catch (Exception e) {
                navGps = null; // sem GPS no aparelho: segue com o do WebView
            }
        }
        ensureTts();
    }

    private void stopNav() {
        boolean was = navigating;
        navigating = false;
        if (navGps != null) {
            try {
                ((LocationManager) getSystemService(LOCATION_SERVICE)).removeUpdates(navGps);
            } catch (Exception ignored) {
                // já parado
            }
            navGps = null;
        }
        if (web != null) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        if (was) NavService.stop(this);
    }

    // GPS nativo -> página, só com o app fora da tela (na tela o WebView já tem GPS)
    private void sendFix(Location l) {
        if (visible || web == null || l == null) return;
        String js = String.format(Locale.US,
                "window.onTobaNativeFix&&window.onTobaNativeFix({lat:%.7f,lng:%.7f,acc:%.1f,speed:%s,heading:%s,at:%d})",
                l.getLatitude(), l.getLongitude(), l.hasAccuracy() ? l.getAccuracy() : 30f,
                l.hasSpeed() ? String.format(Locale.US, "%.2f", l.getSpeed()) : "null",
                l.hasBearing() ? String.format(Locale.US, "%.1f", l.getBearing()) : "null",
                l.getTime());
        web.evaluateJavascript(js, null);
    }

    /* v2.04 (APK 2.9): o motor de voz nasce junto com o app, não só no Partiu do 🧭 Drive.
     * Até a v2.03 o TTS só era criado no startNav: quem abria o 🧘 Alongamento / 🏠 Treinos
     * em casa sem ter navegado antes ficava mudo (o speak() saía calado com tts == null).
     * Agora: cria no onCreate, guarda a fala que chegar antes de ficar pronto, fala no
     * volume de MÍDIA e abaixa a música enquanto fala (foco de áudio "may duck"). */
    private void ensureTts() {
        if (tts != null) return;
        if (ttsAudio == null) {
            ttsAudio = (AudioManager) getSystemService(AUDIO_SERVICE);
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
            ttsFocus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(attrs)
                    .build();
        }
        tts = new TextToSpeech(getApplicationContext(), status -> runOnUiThread(() -> {
            if (tts == null) return;
            ttsReady = status == TextToSpeech.SUCCESS;
            if (!ttsReady) {
                // motor de voz falhou (sem app de voz?): solta e tenta de novo na próxima fala
                try {
                    tts.shutdown();
                } catch (Exception ignored) {
                    // já era
                }
                tts = null;
                return;
            }
            tts.setLanguage(new Locale("pt", "BR"));
            tts.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String id) {
                }

                @Override
                public void onDone(String id) {
                    releaseTtsFocus();
                }

                @Override
                @SuppressWarnings("deprecation")
                public void onError(String id) {
                    releaseTtsFocus();
                }
            });
            if (ttsPending != null) {
                String p = ttsPending;
                ttsPending = null;
                speakNow(p, true);
            }
        }));
    }

    private void releaseTtsFocus() {
        if (ttsAudio != null && ttsFocus != null) ttsAudio.abandonAudioFocusRequest(ttsFocus);
    }

    private void speakNow(String text, boolean interrupt) {
        if (tts == null || !ttsReady) return;
        if (ttsAudio != null && ttsFocus != null) ttsAudio.requestAudioFocus(ttsFocus);
        ttsSeq += 1;
        tts.speak(text, interrupt ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, "toba-" + ttsSeq);
    }

    // Voz do Android (a do site fica muda com a tela apagada)
    void speak(String text, boolean interrupt) {
        runOnUiThread(() -> {
            if (text == null || text.trim().isEmpty()) return;
            if (tts == null || !ttsReady) {
                ttsPending = text; // fala assim que o motor ficar pronto
                ensureTts();
                return;
            }
            speakNow(text, interrupt);
        });
    }

    // v2.04: a voz tá pronta? (o site mostra "carregando a voz" / avisa se o celular não tem voz)
    boolean ttsOk() {
        return ttsReady;
    }

    static boolean isOwnSite(Uri url) {
        return url != null && "https".equals(url.getScheme()) && BuildConfig.SITE_HOST.equalsIgnoreCase(url.getHost());
    }

    // v1.85: Compartilhar › Toba. Texto do Maps = "Nome\nEndereço\nhttps://maps.app.goo.gl/..."
    // (o assunto, quando vem, vira title). Reaberto pelos Recentes = não reabre o Lugar novo.
    static String sharedPlacesUrl(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return null;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        String t = text == null ? "" : text.toString().trim();
        String s = subject == null ? "" : subject.trim();
        if (t.isEmpty() && s.isEmpty()) return null;
        if (t.length() > 2000) t = t.substring(0, 2000);
        if (s.length() > 300) s = s.substring(0, 300);
        Uri.Builder b = Uri.parse(BuildConfig.START_URL + "TobaTurism/TobaTurism-Places.html").buildUpon();
        if (!s.isEmpty() && !t.startsWith(s)) b.appendQueryParameter("title", s);
        if (!t.isEmpty()) b.appendQueryParameter("text", t);
        return b.build().toString();
    }

    // v1.87: "Política de privacidade" do Toba na tela do Health Connect
    static boolean isHealthRationale(Intent intent) {
        return intent != null && Intent.ACTION_VIEW_PERMISSION_USAGE.equals(intent.getAction());
    }

    private static String startUrl(Intent intent) {
        if (isHealthRationale(intent)) return BuildConfig.START_URL + RELOGIO_PAGE;
        String url = intent == null ? null : intent.getStringExtra(EXTRA_URL);
        return url != null && isOwnSite(Uri.parse(url)) ? url : BuildConfig.START_URL;
    }
}
