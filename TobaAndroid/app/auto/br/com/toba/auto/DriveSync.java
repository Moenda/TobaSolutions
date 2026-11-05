package br.com.toba.auto;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * v1.78 (APK 1.7): rota junta no celular e no Android Auto, estilo Waze.
 * Os dois lados moram no mesmo processo do app, então é só um quadro de avisos:
 * - o carro começou/terminou rota -> avisa o celular (MainActivity roda
 *   window.onTobaAutoRoute no 🧭 Toba Drive do site);
 * - o Toba Drive do site começou/parou rota (TobaNative.autoRoute) -> avisa o carro
 *   (TobaCarSession traça a mesma rota e sai navegando).
 * Com o carro conectado quem fala é o carro (o site fica mudo, TobaNative.autoOn).
 * Nada aqui é gravado: some quando o app fecha.
 */
public final class DriveSync {
    private DriveSync() {}

    /** Lado do celular (MainActivity). json = {name,lat,lng} ou {end:true,arrived}. */
    public interface Phone {
        void onCarRoute(String json);
    }

    /** Lado do carro (TobaCarSession). */
    interface Car {
        void onPhoneRoute(Place dest);

        void onPhoneStop();
    }

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static volatile Phone phone;
    private static volatile Car car;
    private static volatile String carRoute = "";

    public static void setPhone(Phone p) {
        phone = p;
    }

    /** Só tira se ainda for o mesmo (a janela nova pode ter entrado antes da velha sair). */
    public static void clearPhone(Phone p) {
        if (phone == p) phone = null;
    }

    static void setCar(Car c) {
        car = c;
    }

    static void clearCar(Car c) {
        if (car == c) {
            car = null;
            carRoute = "";
        }
    }

    /** Toba aberto na tela do carro agora. */
    public static boolean carOn() {
        return car != null;
    }

    /** Rota que o carro está fazendo ({name,lat,lng}) ou "" sem rota. */
    public static String carRoute() {
        return car == null ? "" : carRoute;
    }

    static void carStarted(Place d) {
        if (d == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("name", d.name);
            o.put("address", d.addr == null ? "" : d.addr);
            o.put("lat", d.lat);
            o.put("lng", d.lon);
            o.put("source", "auto");
            carRoute = o.toString();
        } catch (JSONException e) {
            carRoute = "";
        }
        tellPhone(carRoute);
    }

    /** Fim da rota do carro. Vai junto o destino: o site só encerra se for a MESMA rota. */
    static void carEnded(boolean arrived) {
        String was = carRoute;
        if (was.isEmpty()) return;
        carRoute = "";
        try {
            JSONObject o = new JSONObject(was);
            o.put("end", true);
            o.put("arrived", arrived);
            tellPhone(o.toString());
        } catch (JSONException ignored) {
            // sem destino não dá pra saber qual rota: deixa o celular seguir
        }
    }

    private static void tellPhone(String json) {
        Phone p = phone;
        if (p == null || json == null || json.isEmpty()) return;
        try {
            p.onCarRoute(json);
        } catch (RuntimeException ignored) {
            // janela do celular fechando: na próxima abertura o site pergunta (carRoute)
        }
    }

    /** v1.80: ⭐ favoritos do Toba Drive do site ([{name, emoji, address, lat, lng}]) pro carro. */
    public static boolean setFavorites(android.content.Context c, String json) {
        return AutoStore.setFavorites(c, json);
    }

    /** Do site: json {name,lat,lng} = rota nova; "" = parou. Roda no carro pela main thread. */
    public static void fromPhone(String json) {
        Car c = car;
        if (c == null) return;
        if (json == null || json.trim().isEmpty()) {
            MAIN.post(() -> {
                Car now = car;
                if (now != null) now.onPhoneStop();
            });
            return;
        }
        Place p;
        try {
            JSONObject o = new JSONObject(json);
            double lat = o.optDouble("lat", Double.NaN);
            double lng = o.optDouble("lng", o.optDouble("lon", Double.NaN));
            if (Double.isNaN(lat) || Double.isNaN(lng)) return;
            p = new Place(o.optString("name", "Destino"), o.optString("address", ""), lat, lng);
        } catch (JSONException e) {
            return;
        }
        MAIN.post(() -> {
            Car now = car;
            if (now != null) now.onPhoneRoute(p);
        });
    }
}
