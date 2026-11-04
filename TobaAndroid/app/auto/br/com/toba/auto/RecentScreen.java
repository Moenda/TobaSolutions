package br.com.toba.auto;

import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import java.util.List;

/** Últimos destinos navegados pelo carro (guardados só neste celular). */
final class RecentScreen extends Screen {
    private final NavEngine engine;

    RecentScreen(CarContext car, NavEngine engine) {
        super(car);
        this.engine = engine;
    }

    @Override
    public Template onGetTemplate() {
        List<Place> recents = AutoStore.recents(getCarContext());
        ItemList.Builder list = new ItemList.Builder().setNoItemsMessage("Nenhuma viagem ainda. Bora usar o Buscar! 🚗");
        android.location.Location here = engine.lastLocation();
        for (Place p : recents) {
            Row.Builder row = new Row.Builder().setTitle(p.name);
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
                .setTitle("🕘 Recentes")
                .setHeaderAction(Action.BACK)
                .setSingleList(list.build())
                .build();
    }
}
