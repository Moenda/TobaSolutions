package br.com.toba.auto;

/**
 * v2.13 (APK 3.4): onde o carro está na rota, olhando RUMO e CONTINUIDADE.
 *
 * Caso do Rafa (Imigrantes pra Bandeirantes): no trevo a rota passa por baixo do viaduto,
 * dá a volta na alça e sobe passando POR CIMA do mesmo lugar. A linha da rota cruza ela
 * mesma e o "ponto mais perto" pulava pra pista de cima (e trocava o limite junto).
 * Agora um pedaço da rota só vale se:
 *  - o rumo dele bate com o do GPS (até 60°; andando a 15 km/h+ com rumo do GPS);
 *  - ele fica perto de onde o carro estava na rota: no máximo uns 40 m pra trás e, pra
 *    frente, o que dá pra andar no tempo desde a última leitura (velocidade × 1,8 + 60 m).
 * O que fica fora dessa janela é só "candidato a pulo": o motor só aceita depois de várias
 * leituras seguidas concordando (túnel, GPS que voltou longe).
 * Sem nada de Android: dá pra testar no PC.
 */
final class RouteSnap {
    static final double MAX_TURN = 60;     // graus entre o rumo do pedaço e o do GPS
    static final double BEHIND_M = 40;
    static final double AHEAD_M = 60;
    static final double NEAR_M = 80;       // mais longe que isso nem entra na conta
    static final double MIN_HEAD_MS = 4;   // m/s: abaixo disso o rumo do GPS não presta

    static final class Hit {
        final int seg;
        final double t, dist, along;

        Hit(int seg, double t, double dist, double along) {
            this.seg = seg;
            this.t = t;
            this.dist = dist;
            this.along = along;
        }
    }

    /** best = melhor pedaço dentro da janela; jump = melhor pedaço fora dela (pulo). */
    static final class Result {
        Hit best, jump;
    }

    /**
     * @param heading  rumo do GPS em graus (NaN = não sei)
     * @param speed    m/s
     * @param prevAlong metros da rota onde o carro estava (NaN = sem leitura anterior)
     * @param dtSec    segundos desde a leitura aceita anterior
     */
    static Result locate(double[] lat, double[] lon, double[] cum, double pLat, double pLon,
                         double heading, double speed, double prevAlong, double dtSec) {
        Result out = new Result();
        int n = lat.length;
        if (n < 2) return out;
        boolean useHead = !Double.isNaN(heading) && speed > MIN_HEAD_MS;
        boolean hasPrev = !Double.isNaN(prevAlong);
        double dt = Math.max(0, Math.min(600, dtSec));
        double ahead = hasPrev ? prevAlong + AHEAD_M + dt * Math.max(speed * 1.8, 20) : Double.MAX_VALUE;
        double behind = hasPrev ? prevAlong - BEHIND_M : -Double.MAX_VALUE;
        for (int i = 0; i < n - 1; i++) {
            double[] b = Geo.enu(lat[i], lon[i], lat[i + 1], lon[i + 1]);
            double[] p = Geo.enu(lat[i], lon[i], pLat, pLon);
            double len2 = b[0] * b[0] + b[1] * b[1];
            // descarte rápido: longe demais das duas pontas e do meio
            double t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (p[0] * b[0] + p[1] * b[1]) / len2));
            double d = Math.hypot(p[0] - t * b[0], p[1] - t * b[1]);
            if (d > NEAR_M) continue;
            double segLen = cum[i + 1] - cum[i];
            if (useHead && segLen > 3) {
                double sh = Geo.bearing(lat[i], lon[i], lat[i + 1], lon[i + 1]);
                if (Math.abs(Geo.angleDiff(sh, heading)) > MAX_TURN) continue;
            }
            double al = cum[i] + t * segLen;
            Hit h = new Hit(i, t, d, al);
            if (al >= behind && al <= ahead) {
                if (out.best == null || d < out.best.dist) out.best = h;
            } else if (out.jump == null || d < out.jump.dist) {
                out.jump = h;
            }
        }
        return out;
    }
}
