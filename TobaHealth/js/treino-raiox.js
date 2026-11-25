/* =====================================================================
 * Toba Health · 🏋️ Treinos · 🔬 RAIO-X DO TREINO (v2.10, pedido do Rafa:
 * "se eu fosse humano, o que eu queria saber depois da malhação?")
 *
 * A página "Como foi o treino" (renderWorkoutView, treinos.js) ganha a análise
 * completa: batimento minuto a minuto pintado por zona, 5 zonas, recuperação,
 * deriva cardíaca, mapa, km a km, VO₂ máx com a faixa da idade, suor estimado,
 * carga do treino e da semana, tu x teus treinos do mesmo tipo, recordes e o
 * 🤡 Papo reto do Cloba. Treino sem relógio mostra o que tiver (comparativo,
 * carga estimada, recordes, papo).
 *
 * De onde vem: APK 3.3 (ponte 18) › TOBA_NATIVE.healthWorkout(start, end, reqId)
 * › WorkoutReader.java › window.onTobaHealthWorkout(reqId, json). Só pros treinos
 * ligados a um exercício do relógio (workout.watch.key ou externalId "início-fim-tipo").
 * Puxa sozinho ao abrir o treino e completa os antigos calado (trxBackfill), até onde
 * o Health Connect tiver guardado.
 *
 * Onde guarda (pra não pesar o banco):
 *  - TOBA_HEALTH_DB.workouts[].watch.det = RESUMO pequeno (vai pro backup e pra ☁️):
 *    { v, at, g /* permissões lidas *\/, hrMax /* FC máx usada nas zonas *\/, z: [s z1..z5], z0 /* s abaixo da z1 *\/,
 *      hrMin?, rec1?, rec2? /* bpm que caiu em 1/2 min *\/, drift? /* % *\/, spdAvg?, spdMax? /* km/h *\/,
 *      cadAvg?, cadMax?, elev?, km?: [s de cada km], kmHr?: [bpm de cada km], vo2?, load, route?, routeAsk?, hcId? }
 *  - localStorage toba_health_ex_detail = as SÉRIES (batimento, velocidade, cadência,
 *    mapa) dos últimos TRX_CACHE_MAX treinos abertos, só deste aparelho. Sumiu? Relê do
 *    Health Connect na hora (o dado de verdade mora lá).
 *  - workouts[].auto = 1 → 🤖 treino que o relógio gravou sozinho ("Caminhada (autom.)"
 *    do Samsung). autoSet = 1 quando a pessoa mexeu na mão (o Toba não muda mais).
 *
 * Carregado DEPOIS de relogio.js, sessao-caminhada.js e treinos.js.
 * ===================================================================== */

const TRX_V = 1;
const TRX_CACHE_KEY = "toba_health_ex_detail";
const TRX_CACHE_MAX = 15;
const TRX_SERIES_MAX = 360; // pontos de cada série guardados
const TRX_ROUTE_MAX = 500;
const TRX_BACKFILL_MAX = 12; // por abertura da página
const TRX_BACKFILL_DAYS = 400;
const TRX_HIDE_AUTO_KEY = "toba_health_hide_auto";

// Zonas pela FC máxima (220 − idade), mesmas faixas do Samsung Health
const TRX_ZONES = [
  { n: 1, from: 0.5, name: "Leve", sub: "aquece e recupera", color: "#58a6ff" },
  { n: 2, from: 0.6, name: "Queima gordura", sub: "controle de peso", color: "#3fb950" },
  { n: 3, from: 0.7, name: "Aeróbico", sub: "fôlego e coração", color: "#e3b341" },
  { n: 4, from: 0.8, name: "Anaeróbico", sub: "puxado, tiro", color: "#f0883e" },
  { n: 5, from: 0.9, name: "Máximo", sub: "no talo", color: "#f85149" },
];
const TRX_Z0_COLOR = "#8b949e";

// Família pra comparar (caminhada com caminhada, bike com bike...)
const TRX_FAMILY = { walking: "walk", bike: "bike", elliptical: "elliptical", strength: "strength", custom: "custom", saitama: "saitama", home: "home", stretch: "stretch" };
const TRX_FAMILY_NAME = { walk: "caminhadas", bike: "pedaladas", elliptical: "elípticos", strength: "treinos de força", custom: "treinos personalizados", saitama: "treinos do Saitama", home: "treinos em casa", stretch: "alongamentos" };
// Carga estimada sem relógio (pontos por minuto, régua da zona média)
const TRX_LOAD_GUESS = { walking: 1.8, bike: 2.2, elliptical: 2.2, strength: 2.2, custom: 2, saitama: 2.6, home: 3, stretch: 0.8 };
const TRX_SWEAT_ML_PER_KCAL = { walking: 0.8, bike: 0.9, elliptical: 0.9, strength: 0.55, custom: 0.7, saitama: 0.75, home: 0.8, stretch: 0.25 };

// VO₂ máx: começo de cada faixa (Ruim, Normal, Bom, Excelente, Superior) por idade.
// Faixas do Cloba em cima da tabela do ACSM (a de 30-39 anos é a mesma que o Samsung mostra).
const TRX_VO2_TABLE = {
  M: [[29, [32.0, 39.6, 45.8, 52.5, 61.0]], [39, [29.8, 37.0, 43.4, 50.0, 58.8]], [49, [27.6, 34.2, 40.0, 46.6, 55.6]], [59, [24.8, 30.9, 36.4, 42.6, 51.0]], [200, [21.9, 27.4, 32.5, 38.3, 46.8]]],
  F: [[29, [26.6, 33.2, 38.8, 44.6, 52.0]], [39, [24.6, 30.9, 36.1, 41.8, 49.6]], [49, [22.9, 28.4, 33.4, 38.8, 46.7]], [59, [20.2, 25.4, 30.0, 34.9, 42.4]], [200, [18.1, 22.8, 26.9, 31.4, 38.4]]],
};
const TRX_VO2_LEVELS = [
  { name: "Muito ruim", color: "#f85149" },
  { name: "Ruim", color: "#f0883e" },
  { name: "Normal", color: "#e3b341" },
  { name: "Bom", color: "#3fb950" },
  { name: "Excelente", color: "#58a6ff" },
  { name: "Superior", color: "#bc8cff" },
];

const trx = { req: 0, waiting: {}, busy: {}, series: "hr", cmp: "", map: null, backfilling: false, routeFor: "" };

/* ---------------------------------------------------------------------
 * Base: chave do exercício, cache local, ponte
 * ------------------------------------------------------------------- */
function trxKeyOf(w) {
  if (!w) return "";
  if (w.watch && w.watch.key) return String(w.watch.key);
  if (w.source === "health-connect" && /^\d+-\d+-\d+$/.test(String(w.externalId || ""))) return String(w.externalId);
  return "";
}

function trxWindowOf(w) {
  const key = trxKeyOf(w);
  if (!key) return null;
  const wa = w.watch || {};
  const [s, e] = key.split("-").map(Number);
  const start = Number(wa.start) > 0 ? Number(wa.start) : s;
  const end = Number(wa.end) > 0 ? Number(wa.end) : e;
  return start > 0 && end > start ? { key, start, end } : null;
}

function trxCanFetch() {
  return typeof TOBA_NATIVE !== "undefined" && !!TOBA_NATIVE && typeof TOBA_NATIVE.healthWorkout === "function" && watchNativeVersion() >= 18;
}

// v2.14: caminhada na rua sem mapa que ainda não perguntou pro Samsung Health (APK 3.5, ponte 20)
function trxNeedsSamsungRoute(w, det) {
  if (!det || det.route === 1 || det.rS || watchNativeVersion() < 20) return false;
  return trxFamilyOf(w) === "walk" && w.mode !== "treadmill" && !(Array.isArray(decodeWalkTrackSafe(w)) && decodeWalkTrackSafe(w).length);
}

function trxCacheAll() {
  try {
    const v = JSON.parse(localStorage.getItem(TRX_CACHE_KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) {
    return {};
  }
}

function trxCacheGet(key) {
  const all = trxCacheAll();
  const d = all[key];
  return d && typeof d === "object" ? d : null;
}

function trxCachePut(key, data) {
  const all = trxCacheAll();
  all[key] = { ...data, used: Date.now() };
  let keys = Object.keys(all).sort((a, b) => (all[b].used || 0) - (all[a].used || 0));
  keys.slice(TRX_CACHE_MAX).forEach((k) => delete all[k]);
  keys = keys.slice(0, TRX_CACHE_MAX);
  // Sem espaço: joga fora os mais velhos até caber (é só cache, o Health Connect tem tudo)
  for (let i = 0; i < 6; i++) {
    try {
      localStorage.setItem(TRX_CACHE_KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      const old = keys.pop();
      if (!old || old === key) break;
      delete all[old];
    }
  }
  try {
    localStorage.removeItem(TRX_CACHE_KEY);
  } catch (e) {
    /* nada */
  }
  return false;
}

// Afina a série em até max pontos (média de cada pedaço), mantendo [s, valor]
function trxThin(arr, max, dec = 1) {
  const a = Array.isArray(arr) ? arr.filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))) : [];
  if (a.length <= max) return a.map((p) => [Math.round(Number(p[0])), Math.round(Number(p[1]) * dec) / dec]);
  const out = [];
  const step = a.length / max;
  for (let i = 0; i < max; i++) {
    const part = a.slice(Math.floor(i * step), Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)));
    const t = part.reduce((s, p) => s + Number(p[0]), 0) / part.length;
    const v = part.reduce((s, p) => s + Number(p[1]), 0) / part.length;
    out.push([Math.round(t), Math.round(v * dec) / dec]);
  }
  return out;
}

function trxThinRoute(route) {
  const a = Array.isArray(route) ? route.filter((p) => Array.isArray(p) && Number.isFinite(Number(p[1])) && Number.isFinite(Number(p[2]))) : [];
  if (!a.length) return [];
  const step = Math.max(1, Math.ceil(a.length / TRX_ROUTE_MAX));
  const out = [];
  for (let i = 0; i < a.length; i += step) out.push(a[i]);
  if (out[out.length - 1] !== a[a.length - 1]) out.push(a[a.length - 1]);
  return out.map((p) => [Math.round(Number(p[0])), Number(p[1]), Number(p[2]), p[3] === null || p[3] === undefined || !Number.isFinite(Number(p[3])) ? null : Math.round(Number(p[3]))]);
}

function trxGrantedCount() {
  try {
    if (typeof watchReadStatus === "function") watchReadStatus();
  } catch (e) {
    /* sem status */
  }
  return typeof watchGranted === "function" ? watchGranted().length : 0;
}

window.onTobaHealthWorkout = function (reqId, data) {
  const cb = trx.waiting[reqId];
  if (!cb) return;
  delete trx.waiting[reqId];
  cb(data && typeof data === "object" ? data : null);
};

window.onTobaHealthRoute = function (hcId, data) {
  const w = (healthDb.workouts || []).find((x) => x && x.watch && x.watch.det && x.watch.det.hcId === hcId);
  trx.routeFor = "";
  if (!w || !data || !data.ok || !Array.isArray(data.route) || !data.route.length) {
    tobaToast(data && data.error ? `🗺️ Sem mapa: ${data.error}` : "🗺️ O Android não mandou o mapa");
    if (w) trxRerender(w);
    return;
  }
  const key = trxKeyOf(w);
  const cache = trxCacheGet(key) || {};
  cache.route = trxThinRoute(data.route);
  trxCachePut(key, cache);
  w.watch.det.route = 1;
  delete w.watch.det.routeAsk;
  trxApplyRouteSummary(w, cache);
  saveHealthDb({ silent: true });
  trxRerender(w);
  tobaToast("🗺️ Mapa do treino chegou");
};

function trxAskNative(win) {
  return new Promise((resolve) => {
    const reqId = `trx${Date.now()}-${++trx.req}`;
    const timer = setTimeout(() => {
      if (trx.waiting[reqId]) {
        delete trx.waiting[reqId];
        resolve(null);
      }
    }, 45000);
    trx.waiting[reqId] = (data) => {
      clearTimeout(timer);
      resolve(data);
    };
    let ok = false;
    try {
      ok = TOBA_NATIVE.healthWorkout(String(win.start), String(win.end), reqId);
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      clearTimeout(timer);
      delete trx.waiting[reqId];
      resolve(null);
    }
  });
}

// Puxa o "por dentro" de um treino, guarda séries no cache e o resumo no treino
async function trxFetch(w) {
  const win = trxWindowOf(w);
  if (!win || !trxCanFetch() || trx.busy[win.key]) return false;
  trx.busy[win.key] = true;
  try {
    const raw = await trxAskNative(win);
    if (!raw || !raw.ok) return false;
    trxAbsorb(w, raw);
    return true;
  } finally {
    delete trx.busy[win.key];
  }
}

function trxAbsorb(w, raw) {
  const key = trxKeyOf(w);
  const old = trxCacheGet(key) || {};
  const cache = {
    start: Number(raw.start) || 0,
    end: Number(raw.end) || 0,
    hr: trxThin(raw.hr, TRX_SERIES_MAX),
    spd: trxThin(raw.spd, TRX_SERIES_MAX, 10),
    cad: trxThin(raw.cad, TRX_SERIES_MAX),
    after: trxThin(raw.hrAfter, 120),
    dist: trxThin(raw.dist, 300),
    laps: Array.isArray(raw.laps) ? raw.laps.slice(0, 200) : [],
    route: Array.isArray(raw.route) ? trxThinRoute(raw.route) : old.route || [],
    vo2: Array.isArray(raw.vo2) ? raw.vo2.slice(-60) : [],
  };
  trxCachePut(key, cache);
  const det = trxSummary(w, raw, cache);
  if (!w.watch || typeof w.watch !== "object") return;
  w.watch.det = det;
  // 🤖 gravado sozinho pelo relógio (recordingMethod 2), se a pessoa não mexeu na mão
  if (Number(raw.rec) === 2 && !w.autoSet) w.auto = 1;
}

/* ---------------------------------------------------------------------
 * Contas (tudo puro em cima da série)
 * ------------------------------------------------------------------- */
function trxAge() {
  const a = Number(healthDb.age);
  return a >= 10 && a <= 100 ? a : null;
}

function trxHrMax() {
  return 220 - (trxAge() || 30);
}

function trxZoneOf(bpm, hrMax = trxHrMax()) {
  const r = bpm / hrMax;
  let z = 0;
  TRX_ZONES.forEach((zone) => {
    if (r >= zone.from) z = zone.n;
  });
  return z;
}

function trxZoneColor(z) {
  return z ? TRX_ZONES[z - 1].color : TRX_Z0_COLOR;
}

// Segundos em cada zona: cada ponto vale até o próximo (no máx. 30 s, buraco não conta)
function trxZoneSeconds(hr, hrMax) {
  const z = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < hr.length; i++) {
    const next = i + 1 < hr.length ? hr[i + 1][0] : hr[i][0] + 5;
    const dt = Math.max(0, Math.min(30, next - hr[i][0]));
    z[trxZoneOf(hr[i][1], hrMax)] += dt;
  }
  return z;
}

function trxAvg(list) {
  const a = list.filter((v) => Number.isFinite(v));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

function trxSeriesAvg(series, from, to) {
  return trxAvg(series.filter((p) => p[0] >= from && p[0] < to).map((p) => p[1]));
}

function trxHaversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[2] - a[2]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Linha do tempo da distância: [[s, m acumulados]] (voltas > distância > mapa > velocidade)
function trxDistLine(w, cache) {
  const totalM = Number(w.distanceKm) > 0 ? Number(w.distanceKm) * 1000 : Number(w.watch && w.watch.distanceM) || 0;
  let line = [];
  if (Array.isArray(cache.dist) && cache.dist.length >= 3) line = cache.dist.map((p) => [p[0], p[1]]);
  else if (Array.isArray(cache.route) && cache.route.length >= 3) {
    let acc = 0;
    line = cache.route.map((p, i) => {
      if (i) acc += trxHaversine(cache.route[i - 1], p);
      return [p[0], acc];
    });
  } else if (Array.isArray(cache.spd) && cache.spd.length >= 3) {
    let acc = 0;
    line = cache.spd.map((p, i) => {
      const dt = i ? Math.min(60, p[0] - cache.spd[i - 1][0]) : 0;
      acc += (p[1] / 3.6) * dt;
      return [p[0], acc];
    });
  }
  if (!line.length) return [];
  const last = line[line.length - 1][1];
  // Acerta a escala com o total do treino (o que vale é o km do treino)
  if (totalM > 100 && last > 100 && Math.abs(last - totalM) / totalM < 0.5) {
    const k = totalM / last;
    line = line.map((p) => [p[0], p[1] * k]);
  }
  return line;
}

// Segundos de cada km completo (+ o pedaço final se tiver 200 m+)
function trxKmSplits(w, cache) {
  const laps = Array.isArray(cache.laps) ? cache.laps.filter((l) => Number(l[2]) >= 900 && Number(l[2]) <= 1100) : [];
  if (laps.length >= 2) return { secs: laps.map((l) => Math.round(l[1] - l[0])), bounds: laps.map((l) => [l[0], l[1]]), rest: null };
  const line = trxDistLine(w, cache);
  if (line.length < 3) return null;
  const secs = [];
  const bounds = [];
  let prevT = line[0][0] - (line[0][1] > 0 ? 0 : 0);
  let target = 1000;
  for (let i = 1; i < line.length && secs.length < 200; i++) {
    while (line[i][1] >= target) {
      const [t0, m0] = line[i - 1];
      const [t1, m1] = line[i];
      const t = m1 > m0 ? t0 + ((target - m0) / (m1 - m0)) * (t1 - t0) : t1;
      secs.push(Math.round(t - prevT));
      bounds.push([prevT, t]);
      prevT = t;
      target += 1000;
    }
  }
  const last = line[line.length - 1];
  const restM = last[1] - (target - 1000);
  const rest = restM >= 200 ? { m: Math.round(restM), s: Math.round(last[0] - prevT), from: prevT, to: last[0] } : null;
  return secs.length ? { secs, bounds, rest } : null;
}

function trxSummary(w, raw, cache) {
  const hrMax = trxHrMax();
  const det = { v: TRX_V, at: Date.now(), g: trxGrantedCount(), hrMax };
  const dur = Math.max(60, (cache.end - cache.start) / 1000);
  if (raw.hcId) det.hcId = String(raw.hcId);
  const hr = cache.hr;
  if (hr.length >= 3) {
    const z = trxZoneSeconds(hr, hrMax);
    det.z0 = z[0];
    det.z = z.slice(1);
    det.hrMin = Math.min(...hr.map((p) => p[1]));
    // Recuperação: média dos últimos 30 s do treino − batimento 1 e 2 min depois
    const endHr = trxSeriesAvg(hr, dur - 30, dur + 1) || hr[hr.length - 1][1];
    const after = cache.after || [];
    const near = (s) => trxAvg(after.filter((p) => Math.abs(p[0] - s) <= 12).map((p) => p[1]));
    const a1 = near(60);
    const a2 = near(120);
    if (a1 && endHr) det.rec1 = Math.round(endHr - a1);
    if (a2 && endHr) det.rec2 = Math.round(endHr - a2);
    det.hrEnd = Math.round(endHr);
    // Deriva: 2ª metade x 1ª (sem os 10% do aquecimento), só treino de 20 min+
    if (dur >= 1200) {
      const a = dur * 0.1;
      const mid = a + (dur - a) / 2;
      const h1 = trxSeriesAvg(hr, a, mid);
      const h2 = trxSeriesAvg(hr, mid, dur + 1);
      const s1 = cache.spd.length ? trxSeriesAvg(cache.spd, a, mid) : null;
      const s2 = cache.spd.length ? trxSeriesAvg(cache.spd, mid, dur + 1) : null;
      if (h1 && h2) {
        const d = s1 && s2 && s1 > 1 && s2 > 1 ? (h2 / s2) / (h1 / s1) - 1 : h2 / h1 - 1;
        det.drift = Math.round(d * 1000) / 10;
      }
    }
  }
  const moving = cache.spd.filter((p) => p[1] >= 1);
  if (moving.length >= 3) {
    det.spdAvg = Math.round(trxAvg(moving.map((p) => p[1])) * 10) / 10;
    // máx. = melhor média de 30 s (pico de 1 leitura é tremido do GPS)
    let best = 0;
    for (let i = 0; i < cache.spd.length; i++) {
      const v = trxSeriesAvg(cache.spd, cache.spd[i][0], cache.spd[i][0] + 30);
      if (v > best) best = v;
    }
    det.spdMax = Math.round(best * 10) / 10;
  }
  const cad = cache.cad.filter((p) => p[1] >= 20);
  if (cad.length >= 3) {
    det.cadAvg = Math.round(trxAvg(cad.map((p) => p[1])));
    det.cadMax = Math.round(Math.max(...cad.map((p) => p[1])));
  }
  if (Number(raw.elevGain) > 0) det.elev = Math.round(Number(raw.elevGain));
  if (raw.hasRoute) det.route = cache.route.length ? 1 : 0;
  if (raw.routeAsk && !cache.route.length) det.routeAsk = 1;
  // v2.12: por que não tem mapa (a tela explica em vez de sumir calada)
  if (raw.errors && raw.errors.route) det.rErr = String(raw.errors.route).slice(0, 120);
  // v2.14 (APK 3.5): o mapa pode vir direto do Samsung Health (o Health Connect chega sem trajeto)
  if (raw.routeSrc === "samsung" && cache.route.length) det.rSrc = "samsung";
  if (raw.routeSamsung === "perm" || raw.routeSamsung === "none") det.rS = raw.routeSamsung;
  else if (raw.errors && raw.errors.routeSamsung) {
    det.rS = "err";
    det.rSErr = String(raw.errors.routeSamsung).slice(0, 120);
  } else if (det.rSrc) det.rS = "ok";
  if (Array.isArray(cache.vo2) && cache.vo2.length) {
    const before = cache.vo2.filter((p) => Number(p[0]) <= cache.end + 6 * 3600000);
    const last = before.length ? before[before.length - 1] : null;
    if (last) det.vo2 = Number(last[1]);
  }
  trxApplyRouteSummary(w, cache, det);
  const splits = trxKmSplits(w, cache);
  if (splits) {
    det.km = splits.secs;
    if (hr.length) det.kmHr = splits.bounds.map(([a, b]) => Math.round(trxSeriesAvg(hr, a, b) || 0));
  }
  det.load = trxLoadFrom(det, w);
  return det;
}

// Subida/descida pelo mapa (quando o Health Connect não mandou o ganho)
function trxApplyRouteSummary(w, cache, det = w.watch && w.watch.det) {
  if (!det || !Array.isArray(cache.route) || cache.route.length < 3) return;
  const alts = cache.route.map((p) => p[3]).filter((v) => v !== null && Number.isFinite(v));
  if (alts.length < 3) return;
  let up = 0;
  let down = 0;
  // suaviza (média de 5) pra o tremido do GPS não virar morro
  const sm = alts.map((_, i) => trxAvg(alts.slice(Math.max(0, i - 2), i + 3)));
  for (let i = 1; i < sm.length; i++) {
    const d = sm[i] - sm[i - 1];
    if (d > 0) up += d;
    else down -= d;
  }
  det.altMin = Math.round(Math.min(...alts));
  det.altMax = Math.round(Math.max(...alts));
  if (!det.elev && up >= 1) det.elev = Math.round(up);
  det.desc = Math.round(down);
}

// ⚡ Carga do treino: minutos em cada zona × número da zona (TRIMP de Edwards)
function trxLoadFrom(det, w) {
  if (det && Array.isArray(det.z) && det.z.some((s) => s > 0)) {
    return Math.round(det.z.reduce((sum, s, i) => sum + (s / 60) * (i + 1), 0) + (det.z0 || 0) / 60 * 0.5);
  }
  return trxLoadGuess(w);
}

function trxLoadGuess(w) {
  const min = Number(w.durationMinutes) || 0;
  if (!min) return 0;
  const hrAvg = Number(w.watch && w.watch.hrAvg) || 0;
  if (hrAvg > 0) return Math.round(min * Math.max(0.5, trxZoneOf(hrAvg)));
  return Math.round(min * (TRX_LOAD_GUESS[w.type] || 2));
}

function trxLoadOf(w) {
  const det = w && w.watch && w.watch.det;
  return det && Number(det.load) > 0 ? Number(det.load) : trxLoadGuess(w);
}

const TRX_LOAD_LEVELS = [
  { max: 40, name: "Leve", icon: "🍃", color: "#58a6ff" },
  { max: 90, name: "Moderada", icon: "💪", color: "#3fb950" },
  { max: 160, name: "Puxada", icon: "🔥", color: "#e3b341" },
  { max: 260, name: "Pesada", icon: "🌋", color: "#f0883e" },
  { max: Infinity, name: "MONSTRO", icon: "👹", color: "#f85149" },
];

function trxLoadLevel(load) {
  return TRX_LOAD_LEVELS.find((l) => load <= l.max);
}

/* ---------------------------------------------------------------------
 * Comparação com os treinos do mesmo tipo
 * ------------------------------------------------------------------- */
function trxFamilyOf(w) {
  return TRX_FAMILY[w.type] || w.type || "custom";
}

function trxPeers(w) {
  const fam = trxFamilyOf(w);
  return (healthDb.workouts || [])
    // 🤖 automático (o relógio gravou sozinho) só se compara com automático
    .filter((x) => x && trxFamilyOf(x) === fam && !x.auto === !w.auto && (Number(x.durationMinutes) > 0 || Number(x.distanceKm) > 0))
    .sort((a, b) => `${a.date} ${a.startTime || ""}`.localeCompare(`${b.date} ${b.startTime || ""}`));
}

const TRX_METRICS = {
  min: { label: "⏱️ Tempo", get: (w) => Number(w.durationMinutes) || null, fmt: (v) => `${formatWorkoutNumber(v, 0)} min`, better: "up", rec: "treino mais longo" },
  km: { label: "📍 Km", get: (w) => Number(w.distanceKm) || null, fmt: (v) => `${formatWorkoutNumber(v, 2)} km`, better: "up", rec: "maior distância" },
  pace: { label: "⚡ Ritmo", get: (w) => (Number(w.distanceKm) >= 0.5 && Number(w.durationMinutes) > 0 ? Number(w.durationMinutes) / Number(w.distanceKm) : null), fmt: (v) => `${formatWalkPace(v)}/km`, better: "down", rec: "ritmo mais rápido" },
  kcal: { label: "🔥 Kcal", get: (w) => Number(w.calories) || null, fmt: (v) => `${formatWorkoutNumber(v, 0)} kcal`, better: "up", rec: "mais calorias" },
  hr: { label: "❤️ FC média", get: (w) => Number(w.watch && w.watch.hrAvg) || null, fmt: (v) => `${formatWorkoutNumber(v, 0)} bpm`, better: "none" },
  load: { label: "⚡ Carga", get: (w) => trxLoadOf(w) || null, fmt: (v) => `${formatWorkoutNumber(v, 0)} pts`, better: "up", rec: "maior carga" },
  kmBest: { label: "🏁 Melhor km", get: (w) => { const k = w.watch && w.watch.det && w.watch.det.km; return Array.isArray(k) && k.length ? Math.min(...k) : null; }, fmt: (v) => trxClock(v), better: "down", rec: "km mais rápido" },
  elev: { label: "⛰️ Subida", get: (w) => Number(w.watch && w.watch.det && w.watch.det.elev) || null, fmt: (v) => `${formatWorkoutNumber(v, 0)} m`, better: "up", rec: "mais subida" },
  eff: { label: "🫀 Eficiência", get: trxEfficiency, fmt: (v) => `${formatWorkoutNumber(v, 2)} m/bat.`, better: "up", rec: "coração mais eficiente" },
  steps: { label: "👣 Passos", get: (w) => Number(w.watch && w.watch.steps) || null, fmt: (v) => formatWorkoutNumber(v, 0), better: "up", rec: "mais passos" },
};

// Metros por batida: anda mais com o mesmo coração = fôlego melhor
function trxEfficiency(w) {
  const km = Number(w.distanceKm) || 0;
  const min = Number(w.durationMinutes) || 0;
  const hr = Number(w.watch && w.watch.hrAvg) || 0;
  if (km < 1 || min < 10 || hr < 60) return null;
  return (km * 1000) / (hr * min);
}

function trxMetricsFor(w) {
  const fam = trxFamilyOf(w);
  if (fam === "walk") return ["km", "pace", "min", "kcal", "hr", "load", "kmBest", "eff", "elev", "steps"];
  if (fam === "bike" || fam === "elliptical") return ["min", "km", "kcal", "hr", "load"];
  return ["min", "kcal", "hr", "load"];
}

function trxRank(peers, w, key) {
  const m = TRX_METRICS[key];
  const mine = m.get(w);
  if (mine === null || m.better === "none") return null;
  const vals = peers.map((p) => m.get(p)).filter((v) => v !== null);
  if (vals.length < 3) return null;
  const better = vals.filter((v) => (m.better === "up" ? v > mine : v < mine)).length;
  return { pos: better + 1, of: vals.length };
}

function trxRecords(w, peers) {
  return trxMetricsFor(w)
    .map((key) => ({ key, r: trxRank(peers, w, key) }))
    .filter((x) => x.r && x.r.pos === 1 && TRX_METRICS[x.key].rec);
}

/* ---------------------------------------------------------------------
 * Formatos
 * ------------------------------------------------------------------- */
function trxClock(secs) {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}

function trxMinutes(secs) {
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

function trxPct(a, b) {
  return b ? Math.round((a / b - 1) * 100) : 0;
}

function trxTile(label, value, sub = "", cls = "") {
  return `<div class="toba-stat${cls ? ` ${cls}` : ""}"><span class="toba-stat-label">${label}</span><span class="toba-stat-value">${value}</span>${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}</div>`;
}

function trxQ(topic) {
  return `<button type="button" class="trx-q" data-click="trxHelp" data-topic="${topic}" aria-label="O que é isso?">❔</button>`;
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderWorkoutRaioX(w) {
  const win = trxWindowOf(w);
  const det = w.watch && w.watch.det;
  const cache = win ? trxCacheGet(win.key) : null;
  // Abriu o treino: tem relógio e (sem resumo, sem séries aqui ou permissão nova) = puxa agora
  if (win && trxCanFetch() && !trx.busy[win.key] && (!det || !cache || (det.g || 0) < trxGrantedCount() || det.v < TRX_V || trxNeedsSamsungRoute(w, det))) {
    trxFetch(w).then((ok) => {
      if (ok) {
        saveHealthDb({ silent: true });
        trxRerender(w);
      }
    });
  }
  const peers = trxPeers(w);
  const parts = [
    trxHeroHtml(w, det, peers),
    trxPapoHtml(w, det, cache, peers),
    trxNumbersHtml(w, det),
    trxHeartHtml(w, det, cache),
    trxMapHtml(w, det, cache),
    trxSplitsHtml(w, det, cache),
    trxVo2Html(w, det, cache),
    trxSweatHtml(w),
    trxCompareHtml(w, peers),
    trxWeekHtml(w),
    trxNoteHtml(w, win, det),
  ];
  if (cache && Array.isArray(cache.route) && cache.route.length >= 2) setTimeout(() => trxMountMap(w), 0);
  return `<section class="trx" aria-label="Raio-X do treino">${parts.join("")}</section>`;
}

function trxRerender(w) {
  if (typeof selectedWorkoutId === "undefined" || String(selectedWorkoutId) !== String(w.id)) return;
  const view = document.getElementById("viewWorkout");
  if (view && view.classList.contains("active") && typeof renderWorkoutView === "function") renderWorkoutView();
}

function trxHeroHtml(w, det, peers) {
  const load = trxLoadOf(w);
  const lvl = trxLoadLevel(load);
  const avgLoad = trxAvg(peers.filter((p) => p !== w).slice(-10).map(trxLoadOf).filter((v) => v > 0));
  const records = trxRecords(w, peers);
  const vs = avgLoad ? trxPct(load, avgLoad) : null;
  const vsTxt = vs === null ? "1º desse tipo: tá valendo de régua" : vs >= 8 ? `${vs}% acima do teu normal` : vs <= -8 ? `${-vs}% abaixo do teu normal` : "no teu normal";
  const estimated = !(det && Array.isArray(det.z));
  return `
    <div class="section-title">🔬 Raio-X do treino ${trxQ("load")}</div>
    <div class="card trx-hero" style="--trx-c:${lvl.color}">
      <div class="trx-hero-main">
        <span class="trx-hero-icon" aria-hidden="true">${lvl.icon}</span>
        <span class="trx-hero-text">
          <span class="trx-hero-label">⚡ Carga ${estimated ? "estimada" : "do treino"}</span>
          <strong class="trx-hero-value">${formatWorkoutNumber(load, 0)} pts · ${lvl.name}</strong>
          <span class="trx-hero-sub">${escapeHtml(vsTxt)}</span>
        </span>
      </div>
      <div class="trx-meter" aria-hidden="true">${TRX_LOAD_LEVELS.map((l) => `<span style="background:${l.color}"${l === lvl ? ' class="is-on"' : ""}></span>`).join("")}</div>
      ${records.length ? `<div class="trx-records">${records.map((r) => `<span class="trx-record">🏅 Recorde: ${escapeHtml(TRX_METRICS[r.key].rec)}</span>`).join("")}</div>` : ""}
    </div>`;
}

function trxNumbersHtml(w, det) {
  const tiles = [];
  const wa = w.watch || {};
  if (det && det.spdAvg) tiles.push(trxTile("🏃 Velocidade", `${formatWorkoutNumber(det.spdAvg, 1)} km/h`, det.spdMax ? `máx. ${formatWorkoutNumber(det.spdMax, 1)} km/h` : ""));
  if (det && det.spdMax && trxFamilyOf(w) === "walk") tiles.push(trxTile("⚡ Ritmo máx.", `${formatWalkPace(60 / det.spdMax)}/km`, "melhor 30 s"));
  if (Number(wa.steps) > 0) tiles.push(trxTile("👣 Passos", formatWorkoutNumber(wa.steps, 0), Number(w.durationMinutes) ? `${formatWorkoutNumber(wa.steps / w.durationMinutes, 0)} por min` : ""));
  if (det && det.cadAvg) tiles.push(trxTile("🦶 Cadência", `${det.cadAvg} ppm`, det.cadMax ? `máx. ${det.cadMax} ppm` : ""));
  if (det && det.elev) tiles.push(trxTile("⛰️ Subida", `${formatWorkoutNumber(det.elev, 0)} m`, det.altMin !== undefined ? `${det.altMin}–${det.altMax} m de altitude` : ""));
  const kcal = Number(w.calories) || 0;
  if (kcal && Number(w.durationMinutes) > 0) tiles.push(trxTile("🔥 Por minuto", `${formatWorkoutNumber(kcal / w.durationMinutes, 1)} kcal`, ""));
  const food = kcal ? trxFood(kcal) : "";
  if (food) tiles.push(trxTile("🍔 Queimou tipo", food, "", "is-wide"));
  return tiles.length ? `<div class="toba-stats wv-stats trx-numbers">${tiles.join("")}</div>` : "";
}

function trxFood(kcal) {
  const list = typeof WORKOUT_FOOD_EQUIVALENTS !== "undefined" ? WORKOUT_FOOD_EQUIVALENTS : [];
  const pick = [...list].reverse().find((f) => kcal / f.kcal >= 1) || list[0];
  if (!pick) return "";
  const n = kcal / pick.kcal;
  return `${pick.icon} ${formatWorkoutNumber(n, n < 10 ? 1 : 0)} ${n < 2 ? pick.one : pick.name}`;
}

/* ❤️ Coração: gráfico pintado por zona + zonas + recuperação + deriva */
function trxHeartHtml(w, det, cache) {
  if (!det || !Array.isArray(det.z)) return "";
  const hrMax = trxHrMax();
  const zTotal = det.z.reduce((s, v) => s + v, 0) + (det.z0 || 0);
  const tabs = [["hr", "❤️ Batimento"], ["spd", "🏃 Velocidade"], ["cad", "🦶 Cadência"], ["alt", "⛰️ Altitude"]].filter(([k]) => trxSeriesFor(cache, k).length >= 3);
  if (!tabs.some(([k]) => k === trx.series)) trx.series = "hr";
  const chart = cache && trxSeriesFor(cache, trx.series).length >= 3 ? trxChartSvg(cache, trx.series, hrMax) : "";
  const zones = [...TRX_ZONES].reverse().map((z) => {
    const s = det.z[z.n - 1] || 0;
    const pct = zTotal ? Math.round((s / zTotal) * 100) : 0;
    const lo = Math.round(hrMax * z.from);
    const hi = z.n === 5 ? hrMax : Math.round(hrMax * TRX_ZONES[z.n].from) - 1;
    return `<div class="trx-zone">
        <span class="trx-zone-name"><span><b style="color:${z.color}">${z.n}</b> ${z.name}</span><small>${lo}–${hi} bpm</small></span>
        <span class="trx-zone-bar"><span style="width:${pct}%;background:${z.color}"></span></span>
        <span class="trx-zone-val">${s >= 30 ? trxMinutes(s) : s > 0 ? `${Math.round(s)} s` : "—"}<small>${pct}%</small></span>
      </div>`;
  }).join("");
  const age = trxAge();
  const extra = [];
  if (det.rec1 !== undefined) {
    const r = det.rec1;
    const tag = r >= 30 ? ["🚀", "Coração de atleta"] : r >= 20 ? ["💚", "Boa"] : r >= 12 ? ["👍", "Normal"] : ["🐢", "Lenta"];
    extra.push(trxTile(`🫀 Recuperação ${trxQ("rec")}`, `−${r} bpm`, `${tag[0]} ${tag[1]} em 1 min${det.rec2 !== undefined ? ` · −${det.rec2} em 2 min` : ""}`));
  }
  if (det.drift !== undefined && ["walk", "bike", "elliptical"].includes(trxFamilyOf(w))) {
    const d = det.drift;
    const tag = d <= 3.5 ? "💚 Firme, base aeróbica boa" : d <= 7 ? "👍 Normal" : "🥵 Cansou no fim";
    extra.push(trxTile(`📈 Deriva ${trxQ("drift")}`, `${d > 0 ? "+" : ""}${formatWorkoutNumber(d, 1)}%`, tag));
  }
  if (det.hrMin) extra.push(trxTile("💤 FC mínima", `${det.hrMin} bpm`, Number(w.watch.hrMax) ? `faixa ${det.hrMin}–${w.watch.hrMax}` : ""));
  return `
    <div class="section-title">❤️ Coração no treino ${trxQ("zones")}</div>
    <div class="card trx-heart">
      ${tabs.length > 1 ? `<div class="trx-tabs">${tabs.map(([k, l]) => `<button type="button" class="chip-btn${k === trx.series ? " active" : ""}" data-click="trxSeries" data-series="${k}">${l}</button>`).join("")}</div>` : ""}
      ${chart ? `<div class="trx-chart" id="trxChart">${chart}<div class="trx-scrub-tip" id="trxTip" hidden></div></div><p class="trx-hint">Arrasta o dedo no gráfico pra ver minuto a minuto.</p>` : `<p class="trx-hint">O gráfico aparece no app (o batimento minuto a minuto mora no Health Connect do celular).</p>`}
      <div class="trx-zones">${zones}</div>
      <p class="trx-hint">FC máx. ${hrMax} bpm = 220 − ${age || 30} anos.${age ? "" : ` <button type="button" class="link-btn" data-click="trxAskAge">🎂 Põe tua idade</button> pras zonas ficarem certas.`}</p>
      ${extra.length ? `<div class="toba-stats wv-stats">${extra.join("")}</div>` : ""}
    </div>`;
}

function trxSeriesFor(cache, kind) {
  if (!cache) return [];
  if (kind === "alt") return (cache.route || []).filter((p) => p[3] !== null && Number.isFinite(p[3])).map((p) => [p[0], p[3]]);
  return Array.isArray(cache[kind]) ? cache[kind] : [];
}

// SVG: batimento em pedaços coloridos pela zona; velocidade/cadência/altitude numa cor só
function trxChartSvg(cache, kind, hrMax) {
  const s = trxSeriesFor(cache, kind);
  const W = 340;
  const H = 150;
  const P = { l: 30, r: 8, t: 10, b: 20 };
  const dur = Math.max(s[s.length - 1][0], (cache.end - cache.start) / 1000 || 0, 60);
  const vals = s.map((p) => p[1]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (kind === "hr") {
    lo = Math.min(lo, Math.round(hrMax * 0.45));
    hi = Math.max(hi, Math.round(hrMax * 0.75));
  }
  const pad = (hi - lo) * 0.08 || 5;
  lo = Math.max(0, lo - pad);
  hi += pad;
  const x = (t) => P.l + (t / dur) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  let body = "";
  if (kind === "hr") {
    // faixas de fundo das zonas
    TRX_ZONES.forEach((z) => {
      const a = hrMax * z.from;
      const b = z.n === 5 ? hi : hrMax * TRX_ZONES[z.n].from;
      if (b < lo || a > hi) return;
      const y1 = y(Math.min(b, hi));
      const y2 = y(Math.max(a, lo));
      body += `<rect x="${P.l}" y="${y1.toFixed(1)}" width="${W - P.l - P.r}" height="${Math.max(0, y2 - y1).toFixed(1)}" fill="${z.color}" opacity="0.07"/>`;
    });
    let seg = [];
    let segZ = -1;
    const flush = () => {
      if (seg.length > 1) body += `<polyline points="${seg.join(" ")}" fill="none" stroke="${trxZoneColor(segZ)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    };
    s.forEach((p, i) => {
      const z = trxZoneOf(p[1], hrMax);
      const pt = `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`;
      const gap = i && p[0] - s[i - 1][0] > 90;
      if (z !== segZ || gap) {
        flush();
        seg = gap ? [] : seg.length ? [seg[seg.length - 1]] : [];
        segZ = z;
      }
      seg.push(pt);
    });
    flush();
  } else {
    const color = kind === "spd" ? "#39c5cf" : kind === "cad" ? "#bc8cff" : "#d29922";
    const pts = s.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`);
    body += `<polygon points="${x(s[0][0]).toFixed(1)},${H - P.b} ${pts.join(" ")} ${x(s[s.length - 1][0]).toFixed(1)},${H - P.b}" fill="${color}" opacity="0.15"/>`;
    body += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  const unit = kind === "hr" ? "bpm" : kind === "spd" ? "km/h" : kind === "cad" ? "ppm" : "m";
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].map((v) => `<text x="${P.l - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="trx-axis">${formatWorkoutNumber(v, kind === "spd" ? 1 : 0)}</text>`).join("");
  const tx = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${x(dur * f).toFixed(1)}" y="${H - 5}" text-anchor="${f === 0 ? "start" : f === 1 ? "end" : "middle"}" class="trx-axis">${trxClock(dur * f)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="trx-svg" data-kind="${kind}" data-dur="${dur}" data-l="${P.l}" data-r="${P.r}" role="img" aria-label="Gráfico de ${unit} no treino">
      ${body}${ticks}${tx}<text x="${P.l}" y="8" class="trx-axis">${unit}</text>
      <line class="trx-scrub" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" visibility="hidden"/>
    </svg>`;
}

function trxScrubAt(clientX) {
  const box = document.getElementById("trxChart");
  const w = trxCurrent();
  if (!box || !w) return;
  const svg = box.querySelector("svg");
  const cache = trxCacheGet(trxKeyOf(w));
  if (!svg || !cache) return;
  const rect = svg.getBoundingClientRect();
  const W = 340;
  const l = Number(svg.dataset.l);
  const r = Number(svg.dataset.r);
  const dur = Number(svg.dataset.dur);
  const px = ((clientX - rect.left) / rect.width) * W;
  const t = Math.max(0, Math.min(dur, ((px - l) / (W - l - r)) * dur));
  const near = (series) => {
    if (!series.length) return null;
    let best = series[0];
    series.forEach((p) => {
      if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    });
    return Math.abs(best[0] - t) <= 60 ? best[1] : null;
  };
  const bits = [`⏱️ ${trxClock(t)}`];
  const hr = near(cache.hr || []);
  if (hr) bits.push(`<b style="color:${trxZoneColor(trxZoneOf(hr))}">❤️ ${Math.round(hr)} bpm</b>`);
  const spd = near(cache.spd || []);
  if (spd) bits.push(`🏃 ${formatWorkoutNumber(spd, 1)} km/h`);
  const cad = near(cache.cad || []);
  if (cad) bits.push(`🦶 ${Math.round(cad)} ppm`);
  const alt = near(trxSeriesFor(cache, "alt"));
  if (alt !== null && alt !== undefined) bits.push(`⛰️ ${Math.round(alt)} m`);
  const line = svg.querySelector(".trx-scrub");
  const lx = l + (t / dur) * (W - l - r);
  line.setAttribute("x1", lx);
  line.setAttribute("x2", lx);
  line.setAttribute("visibility", "visible");
  const tip = document.getElementById("trxTip");
  tip.innerHTML = bits.join(" · ");
  tip.hidden = false;
}

function trxCurrent() {
  return typeof selectedWorkoutId !== "undefined" ? (healthDb.workouts || []).find((x) => String(x.id) === String(selectedWorkoutId)) : null;
}

document.addEventListener("pointerdown", (e) => {
  const box = e.target instanceof Element ? e.target.closest("#trxChart") : null;
  if (!box) return;
  trx.scrubbing = true;
  trxScrubAt(e.clientX);
});
document.addEventListener("pointermove", (e) => {
  if (trx.scrubbing) trxScrubAt(e.clientX);
});
document.addEventListener("pointerup", () => {
  trx.scrubbing = false;
});
document.addEventListener("pointercancel", () => {
  trx.scrubbing = false;
});

/* 🗺️ Mapa (Leaflet + o mesmo mapa base do Places, sem gastar Mapbox) */
function trxMapHtml(w, det, cache) {
  if (Array.isArray(decodeWalkTrackSafe(w)) && decodeWalkTrackSafe(w).length) return ""; // GPS do Toba já mostra o mapa
  const has = cache && Array.isArray(cache.route) && cache.route.length >= 2;
  if (has) {
    return `<div class="section-title">🗺️ Por onde andou ${trxQ("map")}</div>
      <div class="card trx-map-card"><div class="trx-map" id="trxMap"><p class="trx-hint">🗺️ Carregando o mapa...</p></div>
      <div class="trx-map-legend"><span><i style="background:#f85149"></i>mais lento</span><span><i style="background:#e3b341"></i>no ritmo</span><span><i style="background:#3fb950"></i>mais rápido</span></div></div>`;
  }
  if (det && det.routeAsk && det.hcId && typeof TOBA_NATIVE !== "undefined" && TOBA_NATIVE && typeof TOBA_NATIVE.healthRoute === "function") {
    return `<div class="section-title">🗺️ Por onde andou</div>
      <div class="card trx-ask">
        <p>O relógio gravou o mapa desse treino. O Android pede um "sim" pra cada treino.${trxRouteForeverHint()}</p>
        <button type="button" class="btn btn-primary btn-sm" data-click="trxAskRoute" data-id="${escapeHtml(w.id)}"${trx.routeFor ? " disabled" : ""}>🗺️ Mostrar o mapa</button>
      </div>`;
  }
  if (det && det.rS === "perm" && trxFamilyOf(w) === "walk" && typeof watchSamsungCan === "function" && watchSamsungCan()) {
    return `<div class="section-title">🗺️ Por onde andou ${trxQ("nomap")}</div>
      <div class="card trx-ask">
        <p>🗺️ O Samsung Health manda a caminhada pro Health Connect <b>sem o trajeto</b>, mas o Toba consegue puxar o mapa direto do Samsung Health. Falta liberar uma vez: toca no botão e liga <b>Exercício</b> e <b>Localização do exercício</b> (junto das outras leituras).</p>
        <button type="button" class="btn btn-primary btn-sm" data-click="trxSamsungMap">🗺️ Liberar o mapa no Samsung Health</button>
      </div>`;
  }
  const why = trxNoMapWhy(w, det);
  return why ? `<div class="section-title">🗺️ Por onde andou ${trxQ("nomap")}</div><div class="card trx-nomap"><p>${why}</p></div>` : "";
}

// v2.12 (Rafa: "o relógio tá sincronizado mas não puxa o mapa da caminhada por nada"):
// caminhada na rua sem mapa diz o PORQUÊ. Lê só o que o treino já guardou (det), sem
// puxar de novo: sem hcId = o Health Connect nem achou o exercício; com hcId e sem
// route/routeAsk = o exercício chegou sem trajeto.
function trxNoMapWhy(w, det) {
  if (trxFamilyOf(w) !== "walk" || w.mode === "treadmill" || !det || !trxWindowOf(w) || !trxCanFetch()) return "";
  if (det.route === 1 || det.routeAsk) return "";
  if (det.rS === "err") {
    return `💥 O Toba pediu o mapa pro Samsung Health e deu erro${det.rSErr ? `: ${escapeHtml(det.rSErr)}` : ""}. Confere se o <b>Developer Mode for Data Read</b> continua ligado no Samsung Health e abre o treino de novo.`;
  }
  if (det.rS === "none") {
    return `🛰️ Nem o Samsung Health tem o trajeto desse treino: o GPS do relógio tava desligado (treino automático ou começado sem esperar o 📍 fixar). Mapa garantido: ▶ Caminhada com GPS do Toba.`;
  }
  if (!det.hcId) {
    return "📭 O Health Connect não tem esse treino por dentro: é de antes do Samsung começar a mandar os treinos pro celular (lá por 06/11) ou veio do 📥 import, que não traz trajeto. Por isso a carga é estimada e não tem batimento minuto a minuto nem mapa. Os treinos novos chegam completos.";
  }
  if (det.route === 0) {
    return `🫙 O relógio marcou que tinha mapa, mas o trajeto veio vazio.${det.rErr ? ` Android disse: ${escapeHtml(det.rErr)}.` : ""} Abre o treino de novo daqui a pouco que o Toba tenta outra vez.`;
  }
  // v2.14: confirmado com a caminhada do dog (25/11): o Samsung mostra o mapa no app dele, mas
  // manda pro Health Connect sem trajeto. O APK 3.5 puxa direto do Samsung Health.
  if (watchNativeVersion() < 20) {
    return `🛰️ O Samsung Health manda a caminhada pro Health Connect <b>sem o trajeto</b> (no app dele o mapa aparece, mas não repassa).${det.rErr ? ` Android disse: ${escapeHtml(det.rErr)}.` : ""} O <b>APK 3.5</b> puxa o mapa direto do Samsung Health: instala pelo KingInstaller e abre o treino de novo.`;
  }
  return `🛰️ O Samsung Health mandou esse treino pro Health Connect <b>sem o trajeto</b>.${det.rErr ? ` Android disse: ${escapeHtml(det.rErr)}.` : ""} Abre o treino de novo que o Toba pergunta direto pro Samsung Health. Mapa garantido: ▶ Caminhada com GPS do Toba.`;
}

// Android 15+: dá pra liberar o mapa de TODOS os treinos de uma vez (fica no "Acesso adicional")
function trxRouteForeverHint() {
  const st = typeof watchUi !== "undefined" ? watchUi.status : null;
  return st && Number(st.sdk) >= 35 ? " Pra não perguntar mais: Health Connect › Toba › Acesso adicional › Rotas de exercício › Permitir sempre." : "";
}

function decodeWalkTrackSafe(w) {
  try {
    return typeof decodeWalkTrack === "function" && w.track ? decodeWalkTrack(w.track) : [];
  } catch (e) {
    return [];
  }
}

function trxMountMap(w) {
  const box = document.getElementById("trxMap");
  const cache = trxCacheGet(trxKeyOf(w));
  if (!box || !cache || !Array.isArray(cache.route) || cache.route.length < 2 || typeof loadWalkLeaflet !== "function") return;
  if (navigator.onLine === false) {
    box.innerHTML = trxRouteSvg(cache.route);
    return;
  }
  loadWalkLeaflet().then(() => {
    const target = document.getElementById("trxMap");
    if (!target) return;
    if (trx.map) {
      try {
        trx.map.remove();
      } catch (e) {
        /* saiu da tela */
      }
    }
    target.innerHTML = "";
    const map = walkMakeMap(target);
    trx.map = map;
    const r = cache.route;
    // velocidade de cada trechinho x a média: vermelho mais lento, verde mais rápido
    const speeds = r.map((p, i) => (i ? trxHaversine(r[i - 1], p) / Math.max(1, p[0] - r[i - 1][0]) : 0));
    const avg = trxAvg(speeds.slice(1).filter((v) => v > 0.2)) || 1;
    const group = L.featureGroup().addTo(map);
    for (let i = 1; i < r.length; i++) {
      const v = speeds[i] / avg;
      const color = v < 0.85 ? "#f85149" : v > 1.12 ? "#3fb950" : "#e3b341";
      L.polyline([[r[i - 1][1], r[i - 1][2]], [r[i][1], r[i][2]]], { color, weight: 5, opacity: 0.9 }).addTo(group);
    }
    L.circleMarker([r[0][1], r[0][2]], { radius: 7, color: "#fff", weight: 2, fillColor: "#3fb950", fillOpacity: 1 }).addTo(group).bindTooltip("Saída");
    L.circleMarker([r[r.length - 1][1], r[r.length - 1][2]], { radius: 7, color: "#fff", weight: 2, fillColor: "#f85149", fillOpacity: 1 }).addTo(group).bindTooltip("Chegada");
    // plaquinha de cada km
    let acc = 0;
    let next = 1000;
    for (let i = 1; i < r.length; i++) {
      acc += trxHaversine(r[i - 1], r[i]);
      if (acc >= next) {
        L.marker([r[i][1], r[i][2]], { icon: L.divIcon({ className: "trx-km-pin", html: `${next / 1000}`, iconSize: [20, 20] }) }).addTo(group);
        next += 1000;
      }
    }
    map.fitBounds(group.getBounds(), { padding: [18, 18] });
  }).catch(() => {
    const target = document.getElementById("trxMap");
    if (target) target.innerHTML = trxRouteSvg(cache.route);
  });
}

// Sem internet: desenho simples do trajeto
function trxRouteSvg(r) {
  const lats = r.map((p) => p[1]);
  const lngs = r.map((p) => p[2]);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const k = Math.cos(((a + b) / 2) * Math.PI / 180);
  const sx = (d - c) * k || 1e-6;
  const sy = b - a || 1e-6;
  const s = Math.min(300 / sx, 180 / sy);
  const pts = r.map((p) => `${(10 + (p[2] - c) * k * s).toFixed(1)},${(190 - (p[1] - a) * s).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 320 200" class="trx-svg"><polyline points="${pts}" fill="none" stroke="#58a6ff" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

/* ⏱️ Km a km */
function trxSplitsHtml(w, det, cache) {
  if (Array.isArray(w.splits) && w.splits.length) return ""; // GPS do Toba já tem o Km por km
  const km = det && Array.isArray(det.km) ? det.km : [];
  if (!km.length) return "";
  const split = cache ? trxKmSplits(w, cache) : null;
  const rest = split && split.rest;
  const best = Math.min(...km);
  const worst = Math.max(...km, rest ? (rest.s * 1000) / rest.m : 0);
  const hrs = det.kmHr || [];
  const rows = km.map((s, i) => `
      <div class="trx-split${s === best && km.length > 1 ? " is-best" : ""}">
        <span class="trx-split-n">${i + 1}</span>
        <span class="trx-split-bar"><span style="width:${Math.round((best / s) * 100)}%"></span></span>
        <span class="trx-split-t">${trxClock(s)}</span>
        <span class="trx-split-hr">${hrs[i] ? `❤️ ${hrs[i]}` : ""}</span>
      </div>`);
  if (rest) {
    const per = (rest.s * 1000) / rest.m;
    rows.push(`<div class="trx-split is-rest"><span class="trx-split-n">+</span><span class="trx-split-bar"><span style="width:${Math.round((best / per) * 100)}%"></span></span><span class="trx-split-t">${trxClock(rest.s)}</span><span class="trx-split-hr">${formatWorkoutNumber(rest.m / 1000, 2)} km</span></div>`);
  }
  // 1ª metade x 2ª metade (negative split = terminou mais rápido)
  let halves = "";
  if (km.length >= 4) {
    const h = Math.floor(km.length / 2);
    const a = trxAvg(km.slice(0, h));
    const b = trxAvg(km.slice(km.length - h));
    const diff = Math.round(b - a);
    halves = `<p class="trx-hint">${diff < -5 ? `🚀 Terminou ${trxClock(-diff)}/km mais rápido que começou: negative split, coisa de profissa.` : diff > 15 ? `🐢 A 2ª metade foi ${trxClock(diff)}/km mais lenta. O gás acabou ou foi o morro?` : "⚖️ Ritmo constante do começo ao fim. Metrônomo humano."}</p>`;
  }
  return `
    <div class="section-title">⏱️ Km a km</div>
    <div class="card trx-splits">${rows.join("")}${halves}
      <p class="trx-hint">Melhor km: <b>${trxClock(best)}</b> · mais lento: ${trxClock(worst)}</p>
    </div>`;
}

/* 🫁 VO₂ máx */
function trxVo2Html(w, det, cache) {
  const v = det && Number(det.vo2);
  if (!v) return "";
  const age = trxAge() || 30;
  const sex = healthDb.gender === "Feminino" ? "F" : "M";
  const row = TRX_VO2_TABLE[sex].find((r) => age <= r[0])[1];
  let lvl = 0;
  row.forEach((cut, i) => {
    if (v >= cut) lvl = i + 1;
  });
  const L = TRX_VO2_LEVELS[lvl];
  const min = row[0] - 6;
  const max = row[4] + 6;
  const pos = Math.max(2, Math.min(98, ((v - min) / (max - min)) * 100));
  const bands = [min, ...row, max];
  const hist = cache && Array.isArray(cache.vo2) ? cache.vo2 : [];
  const first = hist.length >= 2 ? hist[0] : null;
  const delta = first ? Math.round((v - first[1]) * 10) / 10 : null;
  const fitAge = trxVo2Age(v, sex);
  return `
    <div class="section-title">🫁 VO₂ máx. ${trxQ("vo2")}</div>
    <div class="card trx-vo2">
      <div class="trx-vo2-top">
        <strong>${formatWorkoutNumber(v, 1)}</strong><span>ml/kg/min</span>
        <span class="trx-vo2-tag" style="color:${L.color}">${L.name}</span>
      </div>
      <div class="trx-vo2-bar">${bands.slice(0, -1).map((b, i) => `<span style="flex:${bands[i + 1] - b};background:${TRX_VO2_LEVELS[i].color}"></span>`).join("")}<i style="left:${pos}%"></i></div>
      <p class="trx-hint">Faixa de ${sex === "F" ? "mulheres" : "homens"} de ${trxAgeBand(age)}: normal a partir de ${formatWorkoutNumber(row[1], 1)}, bom a partir de ${formatWorkoutNumber(row[2], 1)}.</p>
      ${fitAge ? `<p class="trx-vo2-age">🎂 Teu fôlego tem cara de <b>${fitAge} anos</b>${trxAge() ? ` (tu tem ${trxAge()})` : ""}.</p>` : ""}
      ${hist.length >= 2 ? `${trxVo2Spark(hist)}<p class="trx-hint">${delta > 0 ? `📈 Subiu ${formatWorkoutNumber(delta, 1)} desde ${trxShortDate(first[0])}. O coração tá agradecendo.` : delta < 0 ? `📉 Caiu ${formatWorkoutNumber(-delta, 1)} desde ${trxShortDate(first[0])}. Bora botar uns tiros na caminhada.` : `➡️ Igualzinho desde ${trxShortDate(first[0])}.`}</p>` : ""}
    </div>`;
}

function trxAgeBand(age) {
  return age <= 29 ? "20-29 anos" : age <= 39 ? "30-39 anos" : age <= 49 ? "40-49 anos" : age <= 59 ? "50-59 anos" : "60+ anos";
}

// Idade em que esse VO₂ seria o "normal do meio" (interpola entre as faixas)
function trxVo2Age(v, sex) {
  const mids = TRX_VO2_TABLE[sex].map((r, i) => [[25, 35, 45, 55, 65][i], (r[1][1] + r[1][2]) / 2]);
  if (v >= mids[0][1]) return Math.max(18, Math.round(25 - ((v - mids[0][1]) / (mids[0][1] - mids[1][1])) * 10));
  for (let i = 1; i < mids.length; i++) {
    if (v >= mids[i][1]) {
      const [a0, v0] = mids[i - 1];
      const [a1, v1] = mids[i];
      return Math.round(a0 + ((v0 - v) / (v0 - v1)) * (a1 - a0));
    }
  }
  return Math.min(80, Math.round(65 + ((mids[4][1] - v) / (mids[3][1] - mids[4][1])) * 10));
}

function trxShortDate(ms) {
  return new Date(Number(ms)).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function trxVo2Spark(hist) {
  const W = 300;
  const H = 54;
  const vals = hist.map((p) => p[1]);
  const lo = Math.min(...vals) - 0.5;
  const hi = Math.max(...vals) + 0.5;
  const t0 = hist[0][0];
  const t1 = hist[hist.length - 1][0] || t0 + 1;
  const x = (t) => 8 + ((t - t0) / (t1 - t0 || 1)) * (W - 16);
  const y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);
  const pts = hist.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" class="trx-svg trx-spark"><polyline points="${pts}" fill="none" stroke="#e3b341" stroke-width="2"/>${hist.map((p) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2.5" fill="#e3b341"/>`).join("")}</svg>`;
}

/* 💧 Suor (estimativa do Cloba: kcal × fator do tipo) */
function trxSweatMl(w) {
  const kcal = Number(w.calories) || 0;
  if (!kcal || (Number(w.durationMinutes) || 0) < 15) return 0;
  return Math.round((kcal * (TRX_SWEAT_ML_PER_KCAL[w.type] || 0.7)) / 10) * 10;
}

function trxSweatHtml(w) {
  const ml = trxSweatMl(w);
  if (!ml) return "";
  const drink = Math.round((ml * 1.5) / 50) * 50;
  const cups = Math.max(1, Math.round(drink / 250));
  return `
    <div class="section-title">💧 Suor estimado ${trxQ("sweat")}</div>
    <div class="card trx-sweat">
      <strong>~${formatWorkoutNumber(ml, 0)} ml</strong>
      <span>Bebe uns <b>${formatWorkoutNumber(drink, 0)} ml</b> nas próximas 2 h (${cups} ${cups === 1 ? "copo" : "copos"} de 250 ml). Com comida o corpo segura melhor a água.</span>
    </div>`;
}

/* 📊 Esse treino x teu normal (v2.12: repaginado, pedido do Rafa: "tu x tuas treinos wtf Cloba")
 * Teu normal = média dos (até 10) treinos do mesmo tipo ANTES desse; o 1º do tipo usa os outros.
 * Cada linha diz em palavras se foi melhor ou pior ("26% mais longe"), com cor e medalha;
 * tocar na linha troca o gráfico (barra amarela = esse, cinzas = os anteriores, tracejado = normal). */
// [valor maior, valor menor]: no ritmo, número maior = mais lento
const TRX_CMP_WORDS = {
  km: ["mais longe", "mais curto"],
  pace: ["mais lento", "mais rápido"],
  min: ["mais longo", "mais curto"],
  kcal: ["mais calorias", "menos calorias"],
  hr: ["coração mais acelerado", "coração mais calmo"],
  load: ["mais pesado", "mais leve"],
  kmBest: ["mais lento no melhor km", "mais rápido no melhor km"],
  eff: ["de fôlego a mais", "de fôlego a menos"],
  elev: ["mais subida", "menos subida"],
  steps: ["mais passos", "menos passos"],
};

function trxCmpBase(w, peers) {
  const idx = peers.indexOf(w);
  const before = peers.slice(0, Math.max(0, idx)).slice(-10);
  if (before.length) return { list: before, first: false };
  return { list: peers.filter((p) => p !== w).slice(-10), first: true };
}

function trxCmpData(w, peers) {
  const base = trxCmpBase(w, peers);
  return trxMetricsFor(w)
    .map((k) => {
      const m = TRX_METRICS[k];
      const v = m.get(w);
      if (v === null) return null;
      const a = trxAvg(base.list.map(m.get).filter((x) => x !== null));
      if (a === null) return null;
      const p = trxPct(v, a);
      const good = m.better === "none" || Math.abs(p) < 3 ? 0 : (m.better === "up" ? p : -p);
      const words = TRX_CMP_WORDS[k] || ["mais", "menos"];
      const word = Math.abs(p) < 3 ? "igual ao normal" : p > 0 ? words[0] : words[1];
      return { k, m, v, a, p, good, word, rank: trxRank(peers, w, k) };
    })
    .filter(Boolean);
}

// caminhadas/pedaladas = "as tuas"; o resto = "os teus"
function trxFamFem(w) {
  return ["walk", "bike"].includes(trxFamilyOf(w));
}

function trxCmpLead(rows, base, fam, fem) {
  const pos = rows.filter((r) => r.good >= 5).sort((a, b) => b.good - a.good).slice(0, 2);
  const neg = rows.filter((r) => r.good <= -5).sort((a, b) => a.good - b.good).slice(0, 1);
  const say = (r) => `${Math.abs(r.p)}% ${r.word}`;
  const n = base.list.length;
  const who = base.first
    ? (n === 1 ? "o outro treino desse tipo" : `${fem ? "as outras" : "os outros"} ${n} ${fam}`)
    : (n === 1 ? "o treino anterior desse tipo" : `${fem ? "tuas" : "teus"} ${n} ${fam} anteriores`);
  if (!pos.length && !neg.length) return `Comparado com ${who}: tudo no teu padrão. Constância é isso. 👊`;
  let out = `Comparado com ${who}: `;
  out += pos.length ? `<b>${pos.map(say).join("</b> e <b>")}</b>.` : "nada acima do normal.";
  if (neg.length) out += ` Ponto fraco: <b>${say(neg[0])}</b>.`;
  return out;
}

function trxMedal(r) {
  if (!r) return "";
  const icon = ["🥇", "🥈", "🥉"][r.pos - 1];
  return `${icon ? `${icon} ` : ""}${r.pos}º de ${r.of}`;
}

function trxCompareHtml(w, peers) {
  const others = peers.filter((p) => p !== w);
  if (!others.length) return "";
  const base = trxCmpBase(w, peers);
  const rows = trxCmpData(w, peers);
  if (!rows.length) return "";
  const keys = rows.filter((r) => peers.filter((p) => r.m.get(p) !== null).length >= 2).map((r) => r.k);
  if (keys.length && !keys.includes(trx.cmp)) trx.cmp = keys[0];
  const fam = TRX_FAMILY_NAME[trxFamilyOf(w)] || "treinos";
  const rowsHtml = rows.map((r) => {
    const cls = r.good > 0 ? " is-good" : r.good < 0 ? " is-bad" : " is-same";
    const tag = Math.abs(r.p) < 3 ? "= igual ao normal" : `${r.p > 0 ? "▲" : "▼"} ${Math.abs(r.p)}% ${r.word}`;
    const clickable = keys.includes(r.k);
    return `<${clickable ? `button type="button" data-click="trxCmp" data-metric="${r.k}"` : "div"} class="trx-cmp-row${cls}${r.k === trx.cmp ? " is-on" : ""}">
        <span class="trx-cmp-name">${r.m.label}</span>
        <span class="trx-cmp-val"><b>${r.m.fmt(r.v)}</b><small>normal ${r.m.fmt(r.a)}</small></span>
        <span class="trx-cmp-tag">${tag}${r.rank ? `<small>${trxMedal(r.rank)}</small>` : ""}</span>
      </${clickable ? "button" : "div"}>`;
  }).join("");
  let chart = "";
  if (keys.length) {
    const m = TRX_METRICS[trx.cmp];
    const row = rows.find((r) => r.k === trx.cmp);
    const idx = peers.indexOf(w);
    const list = peers.slice(Math.max(0, idx - 9), idx + 1).filter((p) => m.get(p) !== null);
    const W = 320;
    const H = 130;
    const vals = list.map(m.get);
    const hi = Math.max(...vals, row.a || 0) * 1.12 || 1;
    const bw = (W - 10) / Math.max(list.length, 1);
    const y = (v) => H - 16 - (v / hi) * (H - 30);
    const short = (v) => (trx.cmp === "pace" || trx.cmp === "kmBest" ? m.fmt(v).replace("/km", "") : formatWorkoutNumber(v, v >= 100 || trx.cmp === "min" || trx.cmp === "kcal" || trx.cmp === "steps" ? 0 : 1));
    const bars = list.map((p, i) => {
      const v = m.get(p);
      const top = y(v);
      const x = 5 + i * bw;
      const me = p === w;
      return `<rect x="${(x + 2).toFixed(1)}" y="${top.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(H - 16 - top).toFixed(1)}" rx="3" fill="${me ? "#e3b341" : "#30363d"}"/>`
        + `<text x="${(x + bw / 2).toFixed(1)}" y="${(top - 3).toFixed(1)}" text-anchor="middle" class="trx-cmp-num${me ? " is-me" : ""}">${short(v)}</text>`
        + `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="trx-axis">${p.date.slice(8, 10)}/${p.date.slice(5, 7)}</text>`;
    }).join("");
    const avgY = row.a ? y(row.a) : null;
    const dir = m.better === "down" ? "Aqui, quanto <b>menor</b>, melhor." : m.better === "up" ? "Quanto maior, melhor." : "Esse não tem lado bom: é só pra acompanhar.";
    chart = `
      <div class="trx-cmp-chart">
        <div class="trx-cmp-chart-title">📈 ${m.label} ${trxFamFem(w) ? "nas últimas" : "nos últimos"} ${list.length} ${fam}</div>
        <svg viewBox="0 0 ${W} ${H}" class="trx-svg" role="img" aria-label="${m.label} nos últimos treinos">${bars}${avgY !== null ? `<line x1="5" x2="${W - 5}" y1="${avgY.toFixed(1)}" y2="${avgY.toFixed(1)}" class="trx-avg-line"/>` : ""}</svg>
        <div class="trx-cmp-legend"><span><i class="is-me"></i>esse treino</span><span><i></i>os anteriores</span><span><i class="is-avg"></i>teu normal (${m.fmt(row.a)})</span></div>
        <p class="trx-hint">${dir}</p>
      </div>`;
  }
  return `
    <div class="section-title">📊 Esse treino x teu normal ${trxQ("cmp")}</div>
    <div class="card trx-cmp">
      <p class="trx-cmp-lead">🤡 ${trxCmpLead(rows, base, fam, trxFamFem(w))}</p>
      <p class="trx-hint">Teu normal = média ${base.list.length === 1 ? "de 1 treino" : `${trxFamFem(w) ? "das" : "dos"} ${base.list.length} ${fam}`} ${base.first ? "(esse é o mais antigo, então vale os de depois)" : base.list.length === 1 ? "anterior" : "anteriores"}.${keys.length > 1 ? " Toca numa linha pra ver o gráfico dela." : ""}</p>
      <div class="trx-cmp-list">${rowsHtml}</div>
      ${chart}
    </div>`;
}

/* 🗓️ Carga da semana (7 dias até o treino x média semanal das 4 semanas antes) */
function trxWeekLoad(untilIso) {
  const sum = (from, to) => (healthDb.workouts || []).filter((x) => x && x.date > from && x.date <= to).reduce((s, x) => s + trxLoadOf(x), 0);
  const back = (n) => {
    const d = new Date(`${untilIso}T12:00:00`);
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
  };
  const week = sum(back(7), untilIso);
  const chronic = sum(back(35), back(7)) / 4;
  return { week, chronic, ratio: chronic > 0 ? week / chronic : null };
}

function trxWeekHtml(w) {
  const { week, chronic, ratio } = trxWeekLoad(w.date);
  if (!week) return "";
  let tag = "🆕 Ainda sem histórico pra comparar";
  if (ratio !== null) {
    tag = ratio > 1.5 ? "🚨 Subiu rápido demais: risco de lesão, segura a onda" : ratio > 1.25 ? "🔥 Semana puxada, acima do normal" : ratio >= 0.8 ? "✅ No ponto: evoluindo sem se quebrar" : "🛋️ Semana leve, dá pra apertar";
  }
  const pct = ratio !== null ? Math.min(100, (ratio / 2) * 100) : 0;
  // v2.12: o nome diz que é a semana DESSE treino (muda de treino pra treino); a do mês
  // inteiro, semana por semana, mora no ⚡ Carga do resumo do mês (treino-mes.js)
  const from = (() => {
    const d = new Date(`${w.date}T12:00:00`);
    d.setDate(d.getDate() - 6);
    return toIsoDate(d);
  })();
  const short = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `
    <div class="section-title">🗓️ Semana desse treino ${trxQ("week")}</div>
    <div class="card trx-week">
      <div class="trx-week-top"><strong>${formatWorkoutNumber(week, 0)} pts</strong><span>de ${short(from)} a ${short(w.date)}${chronic ? ` · normal ${formatWorkoutNumber(chronic, 0)} pts/semana` : ""}</span></div>
      ${ratio !== null ? `<div class="trx-week-bar"><span class="z1"></span><span class="z2"></span><span class="z3"></span><span class="z4"></span><i style="left:${pct}%"></i></div>` : ""}
      <p class="trx-hint">${tag}</p>
      ${typeof renderLoadMonthPage === "function" ? `<button type="button" class="btn btn-secondary btn-sm trx-week-more" data-click="openHallDetail" data-hero-detail="load" data-hero-month="${w.date.slice(0, 7)}" data-hero-from="viewWorkout">⚡ Ver a carga de cada semana do mês ›</button>` : ""}
    </div>`;
}

/* Rodapé: sem relógio / sem APK / falta permissão */
function trxNoteHtml(w, win, det) {
  if (!win) {
    return `<p class="trx-foot">⌚ Treino sem relógio: a carga é estimada pelo tempo e tipo. Mescla com o relógio (⌚ Treinos do relógio) pra ver o coração por dentro.</p>`;
  }
  if (!trxCanFetch()) {
    if (det) return "";
    return `<p class="trx-foot">📲 O batimento minuto a minuto, o mapa e o km a km vêm pelo app do Toba (APK 3.3 ou mais novo).</p>`;
  }
  const s = typeof watchUi !== "undefined" ? watchUi.status : null;
  const missing = s && Array.isArray(s.missing) ? s.missing.filter((p) => ["speed", "elevation", "vo2"].includes(p)) : [];
  if (missing.length) {
    // v2.10: o mapa NÃO entra aqui: é "sim" por treino (botão 🗺️ Mostrar o mapa) e treino sem GPS (bike, esteira) nem tem
    const names = { speed: "velocidade", elevation: "subida", vo2: "VO₂ máx." };
    return `<div class="card trx-ask"><p>🔓 Falta liberar ${missing.map((p) => names[p]).join(", ")} no Health Connect pra análise ficar completa.</p>
      <button type="button" class="btn btn-secondary btn-sm" data-click="trxAskPerms">🔓 Liberar</button></div>`;
  }
  if (trx.busy[win.key]) return `<p class="trx-foot">⏳ Puxando o treino do relógio...</p>`;
  return "";
}

/* 🤡 Papo reto do Cloba */
function trxPapoHtml(w, det, cache, peers) {
  const lines = trxPapoLines(w, det, cache, peers);
  if (!lines.length) return "";
  return `<div class="card trx-papo"><div class="trx-papo-title">🤡 Papo reto do Cloba</div>${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
}

function trxPapoLines(w, det, cache, peers) {
  const out = [];
  const fam = trxFamilyOf(w);
  const others = peers.filter((p) => p !== w).slice(-10);
  const load = trxLoadOf(w);
  const avgLoad = trxAvg(others.map(trxLoadOf).filter((v) => v > 0));
  // 1) o resumo
  if (avgLoad) {
    const p = trxPct(load, avgLoad);
    if (p >= 25) out.push(`🔥 Treino ${p}% mais pesado que teu normal de ${TRX_FAMILY_NAME[fam] || "treinos"}. Hoje tu foi pra guerra.`);
    else if (p <= -25) out.push(`🍃 Esse foi ${-p}% mais leve que o normal. Dia de manutenção também conta, nunca foi sorte.`);
    else out.push(`👊 Treino no teu padrão. Constância é o que separa o shape do sofá.`);
  } else out.push("🆕 Primeiro desse tipo no Toba: agora ele vira a régua dos próximos.");
  // 2) zonas
  if (det && Array.isArray(det.z)) {
    const tot = det.z.reduce((s, v) => s + v, 0) || 1;
    const top = det.z.indexOf(Math.max(...det.z));
    const z45 = (det.z[3] + det.z[4]) / tot;
    const z2 = det.z[1] / tot;
    if (z45 >= 0.25) out.push(`🌋 ${Math.round(z45 * 100)}% do tempo em zona 4-5. Isso treina o motor, mas pede descanso: amanhã pega leve.`);
    else if (z2 >= 0.5) out.push(`🟢 ${Math.round(z2 * 100)}% na zona 2 (queima gordura). Base aeróbica sendo construída. Quer melhorar o fôlego? Encaixa 4 tiros de 1 min mais forte no meio.`);
    else if (top === 0 && det.z[0] / tot > 0.4) out.push("💤 Coração quase todo na zona 1. Pra perna foi treino, pro coração foi passeio.");
    else if (top === 2) out.push("🟡 Maior parte no aeróbico (zona 3): é aí que o fôlego cresce.");
  }
  // 3) recuperação / deriva
  if (det && det.rec1 !== undefined) {
    if (det.rec1 >= 25) out.push(`🚀 Caiu ${det.rec1} bpm em 1 min depois do fim: recuperação de respeito.`);
    else if (det.rec1 < 12 && (det.hrEnd || 0) > trxHrMax() * 0.6) out.push(`🐢 O coração só caiu ${det.rec1} bpm no 1º minuto. Dormiu mal, desidratou ou foi muito forte?`);
  }
  if (det && det.drift !== undefined && det.drift > 7 && ["walk", "bike", "elliptical"].includes(fam)) out.push(`🥵 O batimento subiu ${formatWorkoutNumber(det.drift, 1)}% na 2ª metade pro mesmo esforço. Água e ritmo mais calmo no começo ajudam.`);
  // 4) recordes
  const recs = trxRecords(w, peers);
  if (recs.length) out.push(`🏅 Recorde de ${recs.map((r) => TRX_METRICS[r.key].rec).join(", ")}! Tô aqui chocado.`);
  // 5) ritmo / eficiência
  if (fam === "walk") {
    const eff = trxEfficiency(w);
    const effAvg = trxAvg(others.map(trxEfficiency).filter((v) => v !== null));
    if (eff && effAvg) {
      const p = trxPct(eff, effAvg);
      if (p >= 5) out.push(`🫀 Andou ${p}% mais por batida que o normal: o fôlego tá melhorando de verdade.`);
      else if (p <= -7) out.push(`🫀 ${-p}% menos metros por batida que o normal. Cansaço, calor ou morro? Normal oscilar.`);
    }
  }
  // 6) semana
  const wk = trxWeekLoad(w.date);
  if (wk.ratio !== null && wk.ratio > 1.5) out.push("🚨 A semana subiu muito mais rápido que tuas últimas 4. O Cloba sugere um dia de descanso antes do próximo pesado.");
  // 7) sem relógio
  if (!trxWindowOf(w) && ["walk", "bike", "elliptical", "home", "saitama"].includes(fam)) out.push("⌚ Bota o relógio no próximo: o Cloba quer ver o coração.");
  // 8) hidratação
  const ml = trxSweatMl(w);
  if (ml >= 500) out.push(`💧 Foram uns ${formatWorkoutNumber(ml, 0)} ml de suor. Bebe água antes do café, hein.`);
  return out.slice(0, 5).map((l) => escapeHtml(l));
}

/* ---------------------------------------------------------------------
 * ❔ Explicações (folha #trxHelpModal, posta pelo JS)
 * ------------------------------------------------------------------- */
const TRX_HELP = {
  load: ["⚡ Carga do treino", "É o tamanho do treino pro teu corpo: cada minuto vale o número da zona do coração em que tu tava (zona 1 = 1 ponto por minuto, zona 5 = 5). 30 min na zona 2 = 60 pts; 30 min na zona 4 = 120 pts. Sem relógio, o Cloba estima pelo tempo e o tipo do treino.<br><br>🍃 <b>Leve</b>: até 40 pts<br>💪 <b>Moderada</b>: até 90 pts<br>🔥 <b>Puxada</b>: até 160 pts<br>🌋 <b>Pesada</b>: até 260 pts<br>👹 <b>MONSTRO</b>: acima disso"],
  zones: ["❤️ Zonas do coração", "Calculadas pela tua FC máxima (220 − idade).<br><br><b>1 Leve</b> (50-60%): aquece e recupera.<br><b>2 Queima gordura</b> (60-70%): base aeróbica, dá pra conversar.<br><b>3 Aeróbico</b> (70-80%): fôlego crescendo, conversa fica curta.<br><b>4 Anaeróbico</b> (80-90%): puxado, tiro.<br><b>5 Máximo</b> (90%+): no talo, poucos minutos.<br><br>Pra emagrecer e ter saúde: muito tempo na 2. Pra fôlego: um pouco de 3-4 na semana. Põe tua idade na ⚙️ da Pesagem (ou no botão 🎂) que as faixas ficam certas."],
  rec: ["🫀 Recuperação", "Quanto o batimento cai no 1º minuto depois que tu para. Quanto mais cai, mais em forma tá o coração.<br><br>🚀 <b>30+ bpm</b>: coração de atleta<br>💚 <b>20-29</b>: boa<br>👍 <b>12-19</b>: normal<br>🐢 <b>menos de 12</b>: lenta (ou o treino foi leve e não tinha muito o que cair)<br><br>Dica: termina o treino e fica parado 2 min com o relógio no pulso."],
  drift: ["📈 Deriva cardíaca", "Compara a 2ª metade do treino com a 1ª (sem o aquecimento). Se o coração sobe pra manter o mesmo ritmo, é cansaço, calor ou falta de água.<br><br>💚 <b>até 3,5%</b>: base aeróbica firme<br>👍 <b>até 7%</b>: normal<br>🥵 <b>mais que 7%</b>: o motor cansou no fim<br><br>Com treino, esse número cai."],
  vo2: ["🫁 VO₂ máx.", "O máximo de oxigênio que teu corpo usa por minuto, por kg. É o melhor número de fôlego que existe e um dos que mais tem a ver com viver mais. O relógio estima pelo batimento nas caminhadas e corridas ao ar livre.<br><br>Faixas do Cloba em cima da tabela do ACSM (a de homens de 30-39 é igual à do Samsung). O 🎂 \"fôlego de X anos\" é a idade em que teu número seria o normal do meio.<br><br>Pra subir: tiros (zona 4) 1-2x por semana e caminhada longa na zona 2."],
  sweat: ["💧 Suor estimado", "Chute do Cloba pelas calorias e o tipo do treino (o relógio não manda o suor pro Health Connect). Calor, umidade e roupa mudam muito.<br><br>Regra de ouro: repor 150% do que perdeu em 1-2 h, de preferência junto com comida. Xixi claro = hidratado."],
  week: ["🗓️ Semana desse treino", "Soma a ⚡ carga dos treinos dos 7 dias até esse treino (o dia dele e os 6 antes) e compara com a média semanal das 4 semanas antes. Por isso muda de treino pra treino: cada um olha a semana dele.<br><br>As semanas do mês inteiro, uma por uma, ficam no ⚡ Carga do resumo do mês (ou no botão aqui embaixo).<br><br>✅ <b>0,8 a 1,25x</b>: evoluindo no ponto<br>🔥 <b>1,25 a 1,5x</b>: puxado<br>🚨 <b>mais de 1,5x</b>: subiu rápido demais, é aí que mora a lesão<br>🛋️ <b>abaixo de 0,8x</b>: semana leve"],
  nomap: ["🗺️ Cadê o mapa?", "O mapa vem do Health Connect, que recebe os treinos do Samsung Health.<br><br>📭 <b>Treino antigo ou do import</b>: o Samsung só manda pro Health Connect o que é novo (desde uns 06/11). O que veio antes, ou pelo 📥 import, não tem trajeto, nem batimento minuto a minuto.<br>🛰️ <b>Treino sem trajeto</b>: o Samsung Health manda a caminhada pro Health Connect sem o mapa. Desde o APK 3.5 o Toba puxa o trajeto direto do Samsung Health (precisa liberar <b>Exercício</b> e <b>Localização do exercício</b> uma vez). Se nem o Samsung tem, o GPS do relógio tava desligado.<br>🔓 <b>Falta o sim</b>: aí aparece o botão 🗺️ Mostrar o mapa.<br><br>Mapa garantido: ▶ Iniciar treino › 🚶 Caminhada com GPS do Toba."],
  map: ["🗺️ Mapa", "O trajeto que o relógio gravou, pintado pela velocidade de cada trecho comparada com a tua média:<br>🔴 <b>mais lento</b><br>🟡 <b>no ritmo</b><br>🟢 <b>mais rápido</b><br><br>Os números são os km. O mapa usa o mesmo do Toba Places (não gasta o Mapbox do Drive)."],
};

function trxEnsureHelp() {
  if (document.getElementById("trxHelpModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="toba-modal" id="trxHelpModal">
      <div class="toba-sheet">
        <div class="toba-sheet-header"><h3 id="trxHelpTitle">❔</h3><button type="button" class="close-btn" data-close aria-label="Fechar">✕</button></div>
        <div class="toba-sheet-text" id="trxHelpText"></div>
      </div>
    </div>`);
}

function trxAskAgeHtml() {
  return `<div class="toba-modal" id="trxAgeModal"><div class="toba-sheet">
      <div class="toba-sheet-header"><h3>🎂 Tua idade</h3><button type="button" class="close-btn" data-close aria-label="Fechar">✕</button></div>
      <p class="toba-sheet-text">Deixa as zonas do coração e o VO₂ certinhos. É a mesma da ⚙️ da Pesagem.</p>
      <div class="trx-age-chips">${[20, 25, 28, 30, 33, 35, 38, 40, 45, 50, 55, 60].map((a) => `<button type="button" class="chip-btn" data-click="trxSetAge" data-age="${a}">${a}</button>`).join("")}</div>
      <div class="form-group"><label for="trxAgeInput">Outra</label><input id="trxAgeInput" class="form-control" type="number" inputmode="numeric" min="10" max="100" placeholder="Ex: 31" /></div>
      <div class="toba-sheet-footer"><button type="button" class="btn btn-primary" data-click="trxSetAge">✅ Salvar</button></div>
    </div></div>`;
}

/* ---------------------------------------------------------------------
 * Completa os treinos antigos calado (até onde o Health Connect guarda)
 * ------------------------------------------------------------------- */
async function trxBackfill() {
  if (trx.backfilling || !trxCanFetch() || typeof isHealthDbLoaded !== "undefined" && !isHealthDbLoaded) return;
  trx.backfilling = true;
  const min = (() => {
    const d = new Date();
    d.setDate(d.getDate() - TRX_BACKFILL_DAYS);
    return toIsoDate(d);
  })();
  const g = trxGrantedCount();
  const tried = trxTried();
  const todo = (healthDb.workouts || [])
    .filter((w) => w && w.date >= min && trxWindowOf(w) && w.watch && (!w.watch.det || w.watch.det.v < TRX_V || (w.watch.det.g || 0) < g || trxNeedsSamsungRoute(w, w.watch.det)))
    .filter((w) => !tried[trxKeyOf(w)] || Date.now() - tried[trxKeyOf(w)] > 86400000)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, TRX_BACKFILL_MAX);
  let changed = 0;
  for (const w of todo) {
    trxMarkTried(trxKeyOf(w));
    if (await trxFetch(w)) changed++;
  }
  trx.backfilling = false;
  if (changed) {
    saveHealthDb({ silent: true });
    const active = document.querySelector(".app-view.active");
    if (active && active.id === "viewWorkout") renderWorkoutView();
    else if (active && (active.id === "viewTraining" || active.id === "viewMonth")) renderWorkoutScreen();
  }
}

// v2.14: liberou o 🗺️ mapa no Samsung Health = as caminhadas que ficaram sem mapa por falta disso puxam de novo
(function () {
  const prev = window.onTobaSamsungStatus;
  window.onTobaSamsungStatus = function (x) {
    if (typeof prev === "function") prev(x);
    const asked = trx.samMap;
    trx.samMap = false;
    if (!x || !x.ok || !Array.isArray(x.granted) || !x.granted.map(String).includes("map")) {
      if (asked && x && x.ok) tobaToast("🗺️ Faltou ligar Exercício e Localização do exercício no Samsung Health");
      return;
    }
    let n = 0;
    let tried = trxTried();
    (healthDb.workouts || []).forEach((w) => {
      const det = w && w.watch && w.watch.det;
      if (!det || det.rS !== "perm") return;
      delete det.rS;
      delete tried[trxKeyOf(w)];
      n++;
    });
    if (!n) return;
    try {
      sessionStorage.setItem("toba_trx_tried", JSON.stringify(tried));
    } catch (e) {
      /* nada */
    }
    saveHealthDb({ silent: true });
    const cur = trxCurrent();
    if (cur) trxRerender(cur);
    setTimeout(trxBackfill, 1500);
  };
})();

function trxTried() {
  try {
    const v = JSON.parse(sessionStorage.getItem("toba_trx_tried") || "{}");
    return v && typeof v === "object" ? v : {};
  } catch (e) {
    return {};
  }
}

function trxMarkTried(key) {
  try {
    const v = trxTried();
    v[key] = Date.now();
    sessionStorage.setItem("toba_trx_tried", JSON.stringify(v));
  } catch (e) {
    /* nada */
  }
}

/* ---------------------------------------------------------------------
 * 🤖 Treinos automáticos (caminhada que o relógio gravou sozinho)
 * ------------------------------------------------------------------- */
function trxExIsAuto(x) {
  return !!x && (Number(x.rec) === 2 || /\(autom/i.test(String(x.title || "")));
}

// Treino que nasceu de um exercício automático do relógio vira 🤖 (se a pessoa não mexeu)
function trxMarkAutoWorkouts() {
  const days = healthDb.watch && healthDb.watch.days ? healthDb.watch.days : {};
  const byKey = {};
  Object.values(days).forEach((d) => (Array.isArray(d && d.ex) ? d.ex : []).forEach((x) => {
    if (x) byKey[`${Math.round(Number(x.start))}-${Math.round(Number(x.end))}-${Number(x.type) || 0}`] = x;
  }));
  let changed = false;
  (healthDb.workouts || []).forEach((w) => {
    if (!w || w.autoSet || w.auto) return;
    const key = trxKeyOf(w);
    if (!key || !(w.watch && w.watch.created)) return;
    if (trxExIsAuto(byKey[key]) || trxExIsAuto(w.watch)) {
      w.auto = 1;
      changed = true;
    }
  });
  return changed;
}

function trxHideAuto() {
  try {
    return localStorage.getItem(TRX_HIDE_AUTO_KEY) !== "0";
  } catch (e) {
    return true;
  }
}

function trxAutoToggleHtml(all) {
  const n = all.filter((w) => w && w.auto).length;
  if (!n) return "";
  const hide = trxHideAuto();
  return `<button type="button" class="trx-auto-toggle${hide ? "" : " is-on"}" data-click="trxToggleAuto">🤖 ${n} ${n === 1 ? "automático" : "automáticos"} ${hide ? "escondido" + (n === 1 ? "" : "s") + " · Mostrar" : "na lista · Esconder"}</button>`;
}

function trxAutoChipHtml(w) {
  if (!trxWindowOf(w) && !w.auto) return "";
  return `<button type="button" class="trx-auto-chip${w.auto ? " is-on" : ""}" data-click="trxSetAuto" data-id="${escapeHtml(w.id)}">${w.auto ? "🤖 Automático: o relógio gravou sozinho · Não é" : "🤖 Foi automático?"}</button>`;
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
tobaActions({
  trxHelp: (el) => {
    const h = TRX_HELP[el.dataset.topic];
    if (!h) return;
    trxEnsureHelp();
    document.getElementById("trxHelpTitle").textContent = h[0];
    document.getElementById("trxHelpText").innerHTML = h[1];
    openTobaModal("trxHelpModal");
  },
  trxSeries: (el) => {
    trx.series = el.dataset.series;
    const w = trxCurrent();
    if (w) trxRerender(w);
  },
  trxCmp: (el) => {
    trx.cmp = el.dataset.metric;
    const w = trxCurrent();
    if (w) trxRerender(w);
  },
  trxAskRoute: (el) => {
    const w = (healthDb.workouts || []).find((x) => String(x.id) === String(el.dataset.id));
    const det = w && w.watch && w.watch.det;
    if (!det || !det.hcId) return;
    trx.routeFor = det.hcId;
    const win = trxWindowOf(w);
    try {
      TOBA_NATIVE.healthRoute(det.hcId, String(win ? win.start : 0));
    } catch (e) {
      trx.routeFor = "";
      tobaToast("🗺️ Não deu pra pedir o mapa");
    }
  },
  trxSamsungMap: () => {
    trx.samMap = true;
    if (typeof watchSamsungAsk === "function") watchSamsungAsk();
  },
  trxAskPerms: () => {
    if (typeof watchAsk === "function") watchAsk();
  },
  trxAskAge: () => {
    if (!document.getElementById("trxAgeModal")) document.body.insertAdjacentHTML("beforeend", trxAskAgeHtml());
    openTobaModal("trxAgeModal");
  },
  trxSetAge: (el) => {
    const input = document.getElementById("trxAgeInput");
    const age = Number(el.dataset.age || (input && input.value));
    if (!(age >= 10 && age <= 100)) {
      tobaToast("🎂 Idade entre 10 e 100");
      return;
    }
    healthDb.age = Math.round(age);
    // zonas novas: o resumo dos treinos com série guardada se refaz na próxima abertura
    (healthDb.workouts || []).forEach((w) => {
      if (w && w.watch && w.watch.det && w.watch.det.hrMax !== trxHrMax()) w.watch.det.v = 0;
    });
    saveHealthDb();
    closeTobaModal("trxAgeModal");
    const w = trxCurrent();
    if (w) trxRerender(w);
    trxBackfill();
  },
  trxToggleAuto: () => {
    try {
      localStorage.setItem(TRX_HIDE_AUTO_KEY, trxHideAuto() ? "0" : "1");
    } catch (e) {
      /* só nesta tela */
    }
    renderWorkoutScreen();
  },
  trxSetAuto: (el) => {
    const w = (healthDb.workouts || []).find((x) => String(x.id) === String(el.dataset.id));
    if (!w) return;
    if (w.auto) delete w.auto;
    else w.auto = 1;
    w.autoSet = 1;
    saveHealthDb();
    renderWorkoutView();
    tobaToast(w.auto ? "🤖 Marcado como automático" : "🙋 Esse foi treino de verdade");
  },
});

document.addEventListener("DOMContentLoaded", () => {
  if (typeof isHealthDbLoaded !== "undefined" && !isHealthDbLoaded) return;
  if (trxMarkAutoWorkouts()) saveHealthDb({ silent: true });
  setTimeout(trxBackfill, 2500);
});

// Voltou pro app (sincronizou o relógio em outra tela): completa o que faltar
(function trxWrapResume() {
  const prev = window.onTobaAppResume;
  window.onTobaAppResume = function (...args) {
    if (typeof prev === "function") prev.apply(this, args);
    setTimeout(trxBackfill, 4000);
  };
})();
