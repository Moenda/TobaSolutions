package br.com.toba.auto;

import android.content.Context;

import androidx.car.app.model.CarIcon;
import androidx.car.app.model.Distance;
import androidx.car.app.navigation.model.Maneuver;
import androidx.car.app.navigation.model.Step;
import androidx.core.graphics.drawable.IconCompat;

import br.com.toba.app.R;

/** Traduz as manobras do TomTom pro Android Auto (tipo + ícone + texto). */
final class Maneuvers {
    private Maneuvers() {}

    static int type(Route.Instr it) {
        String m = it.maneuver == null ? "" : it.maneuver;
        switch (m) {
            case "DEPART": return Maneuver.TYPE_DEPART;
            case "ARRIVE":
            case "WAYPOINT_REACHED": return Maneuver.TYPE_DESTINATION;
            case "ARRIVE_LEFT":
            case "WAYPOINT_LEFT": return Maneuver.TYPE_DESTINATION_LEFT;
            case "ARRIVE_RIGHT":
            case "WAYPOINT_RIGHT": return Maneuver.TYPE_DESTINATION_RIGHT;
            case "KEEP_RIGHT": return Maneuver.TYPE_KEEP_RIGHT;
            case "KEEP_LEFT": return Maneuver.TYPE_KEEP_LEFT;
            case "BEAR_RIGHT": return Maneuver.TYPE_TURN_SLIGHT_RIGHT;
            case "BEAR_LEFT": return Maneuver.TYPE_TURN_SLIGHT_LEFT;
            case "TURN_RIGHT": return Maneuver.TYPE_TURN_NORMAL_RIGHT;
            case "TURN_LEFT": return Maneuver.TYPE_TURN_NORMAL_LEFT;
            case "SHARP_RIGHT": return Maneuver.TYPE_TURN_SHARP_RIGHT;
            case "SHARP_LEFT": return Maneuver.TYPE_TURN_SHARP_LEFT;
            case "MAKE_UTURN":
            case "TRY_MAKE_UTURN": return Maneuver.TYPE_U_TURN_LEFT;
            case "MOTORWAY_EXIT_LEFT": return Maneuver.TYPE_OFF_RAMP_SLIGHT_LEFT;
            case "MOTORWAY_EXIT_RIGHT":
            case "TAKE_EXIT": return Maneuver.TYPE_OFF_RAMP_SLIGHT_RIGHT;
            case "TAKE_FERRY": return Maneuver.TYPE_FERRY_BOAT;
            case "ROUNDABOUT_CROSS":
            case "ROUNDABOUT_RIGHT":
            case "ROUNDABOUT_LEFT":
            case "ROUNDABOUT_BACK":
                // mão inglesa não: no Brasil a rotatória gira no anti-horário
                return it.exit > 0 ? Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW : Maneuver.TYPE_ROUNDABOUT_ENTER_CCW;
            case "STRAIGHT":
            case "FOLLOW":
            case "SWITCH_PARALLEL_ROAD":
            case "SWITCH_MAIN_ROAD":
            case "ENTRANCE_RAMP":
            case "ENTER_MOTORWAY":
            case "ENTER_FREEWAY":
            case "ENTER_HIGHWAY": return Maneuver.TYPE_STRAIGHT;
            default: return Maneuver.TYPE_UNKNOWN;
        }
    }

    static int icon(int type) {
        switch (type) {
            case Maneuver.TYPE_TURN_NORMAL_RIGHT: return R.drawable.ic_turn_right;
            case Maneuver.TYPE_TURN_NORMAL_LEFT: return R.drawable.ic_turn_left;
            case Maneuver.TYPE_TURN_SLIGHT_RIGHT:
            case Maneuver.TYPE_KEEP_RIGHT:
            case Maneuver.TYPE_OFF_RAMP_SLIGHT_RIGHT: return R.drawable.ic_turn_slight_right;
            case Maneuver.TYPE_TURN_SLIGHT_LEFT:
            case Maneuver.TYPE_KEEP_LEFT:
            case Maneuver.TYPE_OFF_RAMP_SLIGHT_LEFT: return R.drawable.ic_turn_slight_left;
            case Maneuver.TYPE_TURN_SHARP_RIGHT: return R.drawable.ic_turn_sharp_right;
            case Maneuver.TYPE_TURN_SHARP_LEFT: return R.drawable.ic_turn_sharp_left;
            case Maneuver.TYPE_U_TURN_LEFT: return R.drawable.ic_turn_uturn;
            case Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW:
            case Maneuver.TYPE_ROUNDABOUT_ENTER_CCW: return R.drawable.ic_turn_roundabout;
            case Maneuver.TYPE_DESTINATION:
            case Maneuver.TYPE_DESTINATION_LEFT:
            case Maneuver.TYPE_DESTINATION_RIGHT: return R.drawable.ic_turn_arrive;
            default: return R.drawable.ic_turn_straight;
        }
    }

    static Maneuver maneuver(Context c, Route.Instr it) {
        int type = type(it);
        Maneuver.Builder b = new Maneuver.Builder(type)
                .setIcon(new CarIcon.Builder(IconCompat.createWithResource(c, icon(type))).build());
        if (type == Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW) b.setRoundaboutExitNumber(it.exit);
        return b.build();
    }

    /** Texto grande do cartão: nome da rua (ou a frase toda se não tiver rua). */
    static String cue(Route.Instr it, Place dest) {
        String m = it.maneuver == null ? "" : it.maneuver;
        if (m.startsWith("ARRIVE")) return dest == null ? "Destino" : dest.name;
        if (m.startsWith("ROUNDABOUT") && it.exit > 0) {
            return it.exit + "ª saída" + (it.street == null || it.street.isEmpty() ? "" : " · " + it.street);
        }
        if (it.street != null && !it.street.isEmpty()) return it.street;
        if (it.message != null && !it.message.isEmpty()) return it.message;
        return "Siga em frente";
    }

    static Step step(Context c, Route.Instr it, Place dest) {
        Step.Builder b = new Step.Builder(cue(it, dest)).setManeuver(maneuver(c, it));
        if (it.street != null && !it.street.isEmpty()) b.setRoad(it.street);
        return b.build();
    }

    static Distance distance(double meters) {
        double m = Math.max(0, meters);
        if (m >= 10000) return Distance.create(Math.round(m / 1000.0), Distance.UNIT_KILOMETERS);
        if (m >= 1000) return Distance.create(Math.round(m / 100.0) / 10.0, Distance.UNIT_KILOMETERS_P1);
        if (m >= 300) return Distance.create(Math.round(m / 50.0) * 50, Distance.UNIT_METERS);
        return Distance.create(Math.round(m / 10.0) * 10, Distance.UNIT_METERS);
    }

    /** Frase falada (o TomTom já manda pronta em pt-BR; isto é só o plano B). */
    static String phrase(Route.Instr it) {
        if (it.message != null && !it.message.isEmpty()) return it.message;
        String rua = it.street == null || it.street.isEmpty() ? "" : " na " + it.street;
        switch (type(it)) {
            case Maneuver.TYPE_TURN_NORMAL_RIGHT: return "Vire à direita" + rua;
            case Maneuver.TYPE_TURN_NORMAL_LEFT: return "Vire à esquerda" + rua;
            case Maneuver.TYPE_TURN_SLIGHT_RIGHT:
            case Maneuver.TYPE_KEEP_RIGHT: return "Mantenha a direita" + rua;
            case Maneuver.TYPE_TURN_SLIGHT_LEFT:
            case Maneuver.TYPE_KEEP_LEFT: return "Mantenha a esquerda" + rua;
            case Maneuver.TYPE_U_TURN_LEFT: return "Faça o retorno";
            case Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW: return "Na rotatória, pegue a " + it.exit + "ª saída";
            case Maneuver.TYPE_DESTINATION: return "Você chegou ao destino";
            default: return "Siga em frente" + rua;
        }
    }
}
