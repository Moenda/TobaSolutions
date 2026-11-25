package br.com.toba.auto;

import android.os.Handler;
import android.os.Looper;

import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import org.json.JSONObject;

/**
 * v2.14 (APK 3.5): 📍 Marcar pra conferir, o botão estilo Waze do Rafa.
 * O lugar é gravado NO TOQUE do botão (HomeScreen.openReport), já como "check"; aqui só
 * escolhe o que tem de errado: 📸 radar ou 🚦 limite da via. Sem escolher em 8 s a tela
 * fecha sozinha e a marcação fica como "📍 conferir" (o celular mostra as duas opções).
 * Nada de voz: a música segue. A correção é no celular (🧭 Toba Drive › 📍 Marcados no carro).
 */
final class ReportScreen extends Screen {
    static final long AUTO_CLOSE_MS = 8000;

    private final long at;
    private final int limit;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean done;

    ReportScreen(CarContext car, JSONObject report) {
        super(car);
        this.at = report.optLong("at");
        this.limit = report.optInt("limit", 0);
        Runnable timeout = () -> finish(null);
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(LifecycleOwner owner) {
                main.postDelayed(timeout, AUTO_CLOSE_MS);
            }

            @Override
            public void onStop(LifecycleOwner owner) {
                main.removeCallbacks(timeout);
            }
        });
    }

    /** kind null = só fecha (ficou "check"). */
    private void finish(String kind) {
        if (done) return;
        done = true;
        if (kind != null) AutoStore.setReportKind(getCarContext(), at, kind);
        String what = "radar".equals(kind) ? "📸 Radar marcado!"
                : "limit".equals(kind) ? "🚦 Limite marcado!" : "📍 Marcado!";
        CarToast.makeText(getCarContext(), what + " Confere no celular depois 👊", CarToast.LENGTH_SHORT).show();
        try {
            if (getScreenManager().getTop() == this) getScreenManager().pop();
            else getScreenManager().remove(this);
        } catch (RuntimeException ignored) {
            // tela já saiu
        }
    }

    @Override
    public Template onGetTemplate() {
        ItemList.Builder list = new ItemList.Builder();
        list.addItem(new Row.Builder()
                .setTitle("📸 Radar")
                .addText("Tem radar e não avisou, ou avisou e não tem")
                .setOnClickListener(() -> finish("radar"))
                .build());
        list.addItem(new Row.Builder()
                .setTitle("🚦 Limite da via")
                .addText(limit > 0 ? "O Toba mostrava " + limit + " km/h aqui" : "O Toba não sabia o limite daqui")
                .setOnClickListener(() -> finish("limit"))
                .build());
        list.addItem(new Row.Builder()
                .setTitle("📍 Só marcar")
                .addText("Decido no celular")
                .setOnClickListener(() -> finish(null))
                .build());
        return new ListTemplate.Builder()
                .setTitle("📍 Marcado! O que tá errado?")
                .setHeaderAction(Action.BACK)
                .setSingleList(list.build())
                .build();
    }
}
