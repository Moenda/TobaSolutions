package br.com.toba.auto;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/**
 * Voz do Toba Drive no carro: TTS em pt-BR que abaixa a música enquanto fala.
 * v2.02: dois tipos de fala pros modos de áudio (AutoStore.audioMode):
 * say = guia (manobras, partida, recálculo), alert = radar, piadas do Cloba e chegada.
 */
final class Voice implements TextToSpeech.OnInitListener {
    private final Context ctx;
    private final TextToSpeech tts;
    private final AudioManager audio;
    private final AudioAttributes attrs;
    private final AudioFocusRequest focus;
    private volatile boolean ready;
    private String pending;
    private boolean pendingAlert;

    Voice(Context ctx) {
        this.ctx = ctx.getApplicationContext();
        audio = (AudioManager) this.ctx.getSystemService(Context.AUDIO_SERVICE);
        attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attrs)
                .build();
        tts = new TextToSpeech(this.ctx, this);
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS) return;
        tts.setLanguage(new Locale("pt", "BR"));
        tts.setAudioAttributes(attrs);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String id) {}

            @Override
            public void onDone(String id) {
                release();
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onError(String id) {
                release();
            }
        });
        ready = true;
        if (pending != null) {
            String p = pending;
            pending = null;
            speak(p, pendingAlert);
        }
    }

    /** Fala de guia (manobra, "Bora!", recálculo): só no modo 🔊 Tudo. */
    void say(String text) {
        speak(text, false);
    }

    /** Alerta (radar, piada do Cloba, chegada): no 🔊 Tudo e no ⚠️ Só alertas. */
    void alert(String text) {
        speak(text, true);
    }

    private void speak(String text, boolean isAlert) {
        if (text == null || text.trim().isEmpty()) return;
        int mode = AutoStore.audioMode(ctx);
        if (mode == AutoStore.AUDIO_OFF || (mode == AutoStore.AUDIO_ALERTS && !isAlert)) return;
        if (!ready) {
            pending = text;
            pendingAlert = isAlert;
            return;
        }
        if (audio != null) audio.requestAudioFocus(focus);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "toba-" + System.nanoTime());
    }

    void stop() {
        if (ready) tts.stop();
        release();
    }

    private void release() {
        if (audio != null) audio.abandonAudioFocusRequest(focus);
    }

    void destroy() {
        stop();
        tts.shutdown();
    }
}
