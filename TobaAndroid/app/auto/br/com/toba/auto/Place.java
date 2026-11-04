package br.com.toba.auto;

import org.json.JSONException;
import org.json.JSONObject;

/** Um destino: nome, endereço e coordenada. */
final class Place {
    final String name;
    final String addr;
    final double lat;
    final double lon;
    /** Distância (m) até aqui na hora da busca; -1 = não sei. */
    double dist = -1;

    Place(String name, String addr, double lat, double lon) {
        this.name = name == null || name.trim().isEmpty() ? "Destino" : name.trim();
        this.addr = addr == null ? "" : addr.trim();
        this.lat = lat;
        this.lon = lon;
    }

    JSONObject toJson() throws JSONException {
        return new JSONObject().put("name", name).put("addr", addr).put("lat", lat).put("lon", lon);
    }

    static Place fromJson(JSONObject o) {
        if (o == null || !o.has("lat") || !o.has("lon")) return null;
        return new Place(o.optString("name"), o.optString("addr"), o.optDouble("lat"), o.optDouble("lon"));
    }

    /** Mesmo lugar (até ~30 m e mesmo nome)? Usado pra não repetir nos recentes. */
    boolean same(Place other) {
        return other != null && name.equalsIgnoreCase(other.name) && Geo.distance(lat, lon, other.lat, other.lon) < 30;
    }
}
