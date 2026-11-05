package br.com.toba.auto;

import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * v1.80: ⭐ favoritos do 🧭 Navegar do site (Casa, Trampo...). Quem manda a lista é o
 * site, pela ponte (TobaNative.autoFavorites), toda vez que abre uma página no app ou
 * mexe no Navegar. Tocar = prévia da rota.
 */
final class FavScreen extends Screen {
    private final NavEngine engine;

    FavScreen(CarContext car, NavEngine engine) {
        super(car);
        this.engine = engine;
    }

    @Override
    public Template onGetTemplate() {
        JSONArray favs = AutoStore.favorites(getCarContext());
        ItemList.Builder list = new ItemList.Builder()
                .setNoItemsMessage("Sem ⭐ ainda. Salva no 🧭 Navegar do celular e abre o Toba no celular uma vez.");
        android.location.Location here = engine.lastLocation();
        // o Android Auto mostra no máximo uns 6 itens com o carro andando (ele mesmo corta)
        for (int i = 0; i < favs.length(); i++) {
            JSONObject o = favs.optJSONObject(i);
            if (o == null) continue;
            Place p = new Place(o.optString("name", "Favorito"), o.optString("address", ""),
                    o.optDouble("lat"), o.optDouble("lng"));
            String emoji = o.optString("emoji", "⭐");
            Row.Builder row = new Row.Builder().setTitle(emoji + " " + p.name);
            String sub = p.addr;
            if (here != null) {
                double d = Geo.distance(here.getLatitude(), here.getLongitude(), p.lat, p.lon);
                sub = Geo.fmtDistance(d) + (sub.isEmpty() ? "" : " · " + sub);
            }
            if (!sub.isEmpty()) row.addText(sub);
            row.setOnClickListener(() -> getScreenManager().push(new PreviewScreen(getCarContext(), engine, p)));
            list.addItem(row.build());
        }
        return new ListTemplate.Builder()
                .setTitle("⭐ Favoritos")
                .setHeaderAction(Action.BACK)
                .setSingleList(list.build())
                .build();
    }
}
