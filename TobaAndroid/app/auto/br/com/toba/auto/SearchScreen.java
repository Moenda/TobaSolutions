package br.com.toba.auto;

import android.os.Handler;
import android.os.Looper;

import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.Row;
import androidx.car.app.model.SearchTemplate;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Busca de destino (TomTom). Teclado só com o carro parado: regra do Android Auto. */
final class SearchScreen extends Screen implements SearchTemplate.SearchCallback {
    private final NavEngine engine;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private List<Place> results;
    private boolean showingRecents = true;
    private boolean loading;
    private String query = "";
    private String error;
    private int ticket;
    private Runnable debounce;

    SearchScreen(CarContext car, NavEngine engine) {
        super(car);
        this.engine = engine;
        results = AutoStore.recents(car);
        if (results.size() > 6) results = new ArrayList<>(results.subList(0, 6));
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onDestroy(LifecycleOwner owner) {
                main.removeCallbacksAndMessages(null);
                io.shutdownNow();
            }
        });
    }

    @Override
    public void onSearchTextChanged(String text) {
        query = text == null ? "" : text;
        if (debounce != null) main.removeCallbacks(debounce);
        if (query.trim().length() < 3) return;
        debounce = () -> run(query, true);
        main.postDelayed(debounce, 650);
    }

    @Override
    public void onSearchSubmitted(String text) {
        query = text == null ? "" : text;
        if (debounce != null) main.removeCallbacks(debounce);
        run(query, false);
    }

    private void run(String text, boolean typeahead) {
        String q = text.trim();
        if (q.length() < 2) return;
        final int my = ++ticket;
        loading = true;
        error = null;
        invalidate();
        android.location.Location near = engine.lastLocation();
        io.execute(() -> {
            List<Place> found = null;
            String err = null;
            try {
                found = TobaApi.search(getCarContext(), q, near, typeahead);
            } catch (Exception e) {
                err = "Busca falhou: " + TobaApi.friendly(e);
            }
            final List<Place> f = found;
            final String er = err;
            main.post(() -> {
                if (my != ticket) return; // chegou resposta de uma busca velha
                loading = false;
                if (f != null) {
                    results = f;
                    showingRecents = false;
                }
                error = er;
                invalidate();
            });
        });
    }

    @Override
    public Template onGetTemplate() {
        SearchTemplate.Builder b = new SearchTemplate.Builder(this)
                .setHeaderAction(Action.BACK)
                .setSearchHint("Pra onde, parceiro?")
                .setShowKeyboardByDefault(results.isEmpty());
        if (!query.isEmpty()) b.setInitialSearchText(query);
        if (loading) return b.setLoading(true).build();
        ItemList.Builder list = new ItemList.Builder();
        if (error != null) list.setNoItemsMessage(error + " 💩");
        else list.setNoItemsMessage(showingRecents ? "Digita o destino aí em cima 👆" : "Não achei nada com esse nome 😢");
        if (error == null) {
            for (Place p : results) {
                Row.Builder row = new Row.Builder().setTitle((showingRecents ? "🕘 " : "") + p.name);
                String sub = p.addr;
                if (p.dist >= 0) sub = Geo.fmtDistance(p.dist) + (sub.isEmpty() ? "" : " · " + sub);
                if (!sub.isEmpty()) row.addText(sub);
                row.setOnClickListener(() -> getScreenManager().push(new PreviewScreen(getCarContext(), engine, p)));
                list.addItem(row.build());
            }
        }
        return b.setItemList(list.build()).build();
    }
}
