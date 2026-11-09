/* =====================================================================
 * Toba Health · 🩻 Raio-X (v1.87 "⌚ Relógio"; nome novo na v1.89)
 * - Passos, sono, calorias, distância e coração do Galaxy Watch.
 *   Caminho: relógio -> Samsung Health -> Health Connect (Android 14+) ->
 *   APK 2.2 (TobaNative.healthRead) -> aqui.
 * - Tudo fica no TOBA_HEALTH_DB.watch (vai junto no backup do Health e na ☁️):
 *   { v: 1, days: { "AAAA-MM-DD": { steps, kcal, activeKcal, distanceM, hrAvg,
 *     hrMin, hrMax, restHr, sleep: { start, end, min, deep, light, rem, awake,
 *     napMin?, naps?, st?, bk?, hr?, ox?, rr?, ... (v1.98, ver watchGroupSleep) }, ex: [{ start, end, type, title? }], at } }, goals: { steps, sleepMin, wakeWk?, wakeWe? (v2.00: hora de acordar em min, seg-sex / sáb-dom) } }
 *   O Health Connect é a fonte: puxar de novo regrava os números do dia. Campo
 *   sem permissão, com erro ou que não veio mantém o valor antigo.
 * - No navegador (PC) só mostra o que já veio pela ☁️ Conta.
 * - toba_health_watch_state (só deste aparelho): { pulledAt, diag } = quando puxou
 *   e o resumo da última leitura (v1.88, 🩺 Diagnóstico: o que veio de cada tipo).
 * ===================================================================== */
const WATCH_STATE_KEY = "toba_health_watch_state";
const WATCH_DEFAULT_GOALS = { steps: 8000, sleepMin: 450 };
const WATCH_STEP_GOALS = [5000, 6000, 8000, 10000, 12000, 15000];
const WATCH_SLEEP_GOALS = [360, 390, 420, 450, 480, 510];
// v2.00 (pedido do Rafa: "preciso acordar 6h pra trabalhar, isso tem que entrar na conta"): despertador
const WATCH_WAKE_WK = [300, 330, 360, 390, 420, 450, 480, 540];
const WATCH_WAKE_WE = [360, 420, 480, 540, 600, 660];
const WATCH_FIRST_DAYS = 30;  // 1ª vez: o Health Connect só deixa ler ~30 dias antes da 1ª permissão
const WATCH_MAX_DAYS = 120;
const WATCH_AUTO_MIN = 10;    // puxa sozinho ao abrir/voltar se faz mais que isso

// Grupos do Health Connect (nome da permissão no APK -> campos do dia)
const WATCH_GROUPS = {
  steps: ["steps"],
  kcal: ["kcal"],
  activeKcal: ["activeKcal"],
  distance: ["distanceM"],
  heart: ["hrAvg", "hrMin", "hrMax"],
  restHr: ["restHr"],
  sleep: ["sleep"],
  exercise: ["ex"],
  // v1.94 (APK 2.5): da noite (vai pro dia em que acorda) e andares
  hrv: ["hrv"],
  spo2: ["spo2", "spo2Min"],
  resp: ["resp"],
  floors: ["floors"],
};
const WATCH_GROUP_LABELS = {
  steps: "👟 passos", sleep: "😴 sono", kcal: "🔥 calorias", activeKcal: "⚡ calorias ativas",
  distance: "📏 distância", heart: "❤️ batimentos", restHr: "💤 FC em repouso", exercise: "🏃 exercícios",
  hrv: "💓 HRV", spo2: "🫁 oxigenação", resp: "😮‍💨 respiração", floors: "🪜 andares",
};
// v1.94: só vêm do 📥 histórico do Samsung (o Health Connect não tem): stress, energy, temperatura, ronco
const WATCH_IMPORT_FIELDS = ["stress", "stressMax", "stressPeak", "stressHigh", "energy", "temp", "snoreMin"];
const WATCH_DECIMAL_FIELDS = ["resp", "temp"];
// Tipos de exercício do Health Connect do Android (ExerciseSessionType)
const WATCH_EXERCISE_NAMES = {
  0: "🏅 Treino", 3: "🏀 Basquete", 4: "🚴 Bike", 5: "🚴 Bike ergométrica", 7: "🥊 Boxe",
  8: "🤸 Calistenia", 10: "💃 Dança", 16: "⛳ Golfe", 20: "🔥 HIIT", 21: "🥾 Trilha",
  24: "🥋 Artes marciais", 27: "🧘 Pilates", 31: "🚣 Remo", 33: "🏃 Corrida", 34: "🏃 Esteira",
  41: "⚽ Futebol", 44: "🪜 Escada", 45: "🏋️ Musculação", 46: "🧘 Alongamento",
  48: "🏊 Natação (mar)", 49: "🏊 Natação", 51: "🎾 Tênis", 52: "🏐 Vôlei", 53: "🚶 Caminhada",
  55: "🏋️ Levantamento de peso", 57: "🧘 Yoga", 58: "🏅 Outro treino", 59: "🪜 Escada (máquina)",
  60: "🌀 Elíptico", 61: "🚣 Remo ergométrico",
};

const watchUi = { date: "", listShown: 6, pulling: false, reqId: "", timer: null, status: null }; // date (v1.95) = dia escolhido na tela
// v2.04: este arquivo também roda no 🏋️ Treinos (motor de puxar/mesclar + ⌚ Treinos do relógio).
// Fora do Raio-X o renderWatch() só chama watchPageRefresh() da página (treinos-relogio.js).
const WATCH_ON_RAIOX = Boolean(document.getElementById("watchConnect"));

/* ---------------- Dados ---------------- */

function watchDb() {
  const w = healthDb.watch;
  if (!w || typeof w !== "object" || Array.isArray(w)) return { v: 1, days: {}, goals: {} };
  if (!w.days || typeof w.days !== "object" || Array.isArray(w.days)) w.days = {};
  return w;
}

function watchGoals() {
  const g = watchDb().goals || {};
  return {
    steps: Number(g.steps) > 0 ? Number(g.steps) : WATCH_DEFAULT_GOALS.steps,
    sleepMin: Number(g.sleepMin) > 0 ? Number(g.sleepMin) : WATCH_DEFAULT_GOALS.sleepMin,
    wakeWk: Number(g.wakeWk) > 0 && Number(g.wakeWk) < 720 ? Number(g.wakeWk) : null,
    wakeWe: Number(g.wakeWe) > 0 && Number(g.wakeWe) < 720 ? Number(g.wakeWe) : null,
  };
}

// v2.00: despertador da manhã do dia `iso` (sáb/dom = fim de semana). null = livre (sem horário)
function watchWakeFor(iso) {
  const wd = new Date(`${iso}T12:00:00`).getDay();
  const we = wd === 0 || wd === 6;
  const g = watchGoals();
  const min = we ? g.wakeWe : g.wakeWk;
  return min ? { min, we, label: we ? "de fim de semana" : "de dia de semana" } : null;
}

function watchDays() {
  return watchDb().days;
}

function watchDay(date) {
  const d = watchDays()[date];
  return d && typeof d === "object" ? d : null;
}

function watchState() {
  try {
    const s = JSON.parse(localStorage.getItem(WATCH_STATE_KEY) || "null");
    return s && typeof s === "object" ? s : {};
  } catch (e) {
    return {};
  }
}

function watchSetState(patch) {
  try {
    localStorage.setItem(WATCH_STATE_KEY, JSON.stringify({ ...watchState(), ...patch }));
  } catch (e) { /* conveniência */ }
}

function watchAddDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function watchHasData(day) {
  return Boolean(day) && (Object.keys(WATCH_GROUPS).some((g) => WATCH_GROUPS[g].some((f) => day[f] !== undefined && day[f] !== null))
    || WATCH_IMPORT_FIELDS.some((f) => day[f] !== undefined && day[f] !== null));
}

/* ---------------- Ponte com o APK ---------------- */

function watchCanNative() {
  return Boolean(TOBA_NATIVE && typeof TOBA_NATIVE.healthStatus === "function" && typeof TOBA_NATIVE.healthRead === "function");
}

function watchReadStatus() {
  if (!watchCanNative()) return null;
  try {
    const s = JSON.parse(TOBA_NATIVE.healthStatus() || "null");
    watchUi.status = s && typeof s === "object" ? s : null;
  } catch (e) {
    watchUi.status = null;
  }
  return watchUi.status;
}

function watchGranted() {
  const s = watchUi.status;
  return s && s.ok && Array.isArray(s.granted) ? s.granted : [];
}

function watchNativeVersion() {
  try {
    return typeof TOBA_NATIVE !== "undefined" && TOBA_NATIVE && typeof TOBA_NATIVE.version === "function" ? Number(TOBA_NATIVE.version()) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

// v1.94: alguma das permissões do 🩻 RAIO ULTRA X liberada?
function watchGrantedBody(granted) {
  const g = Array.isArray(granted) ? granted : [...(granted || [])];
  return ["hrv", "spo2", "resp", "floors"].some((k) => g.includes(k));
}

// Período a puxar: 1ª vez = 30 dias; depois, do último dia guardado (−2, o relógio
// sincroniza atrasado) até hoje.
function watchPullRange(full) {
  const today = toIsoDate();
  const dates = Object.keys(watchDays()).sort();
  let from = watchAddDays(today, -(WATCH_FIRST_DAYS - 1));
  // v1.93 (APK 2.4): 1ª leitura com o APK novo relê 30 dias, pra consertar os dias em
  // que celular + Samsung Health foram somados (passos/km/kcal a mais).
  if (!watchState().oneSource && typeof TOBA_NATIVE !== "undefined" && TOBA_NATIVE
    && typeof TOBA_NATIVE.version === "function" && Number(TOBA_NATIVE.version()) >= 12) full = true;
  // v1.94 (APK 2.5): liberou HRV/oxigenação/respiração/andares? A 1ª leitura relê 30 dias.
  if (!watchState().bodyRead && watchNativeVersion() >= 13 && watchGrantedBody(watchGranted())) full = true;
  if (!full && dates.length) {
    const last = dates[dates.length - 1] < today ? dates[dates.length - 1] : today;
    from = watchAddDays(last, -2);
    // v1.90: sempre relê a última semana (sem o "Puxar 30 dias" na ⚙️, é assim que o
    // treino apagado no relógio nos últimos dias some daqui também)
    const week = watchAddDays(today, -6);
    if (week < from) from = week;
  }
  const min = watchAddDays(today, -(WATCH_MAX_DAYS - 1));
  if (from < min) from = min;
  return { from, to: today };
}

function watchPull({ full = false, quiet = false } = {}) {
  if (!watchCanNative()) {
    if (!quiet) watchExplainBrowser();
    return;
  }
  const status = watchReadStatus();
  if (!status || !status.ok) {
    if (!quiet) renderWatch();
    return;
  }
  if (!watchGranted().length) {
    if (!quiet) watchAsk();
    return;
  }
  if (watchUi.pulling) return;
  const { from, to } = watchPullRange(full);
  watchUi.pulling = true;
  watchUi.reqId = `w${Date.now()}`;
  renderWatchSync();
  clearTimeout(watchUi.timer);
  watchUi.timer = setTimeout(() => {
    if (!watchUi.pulling) return;
    watchUi.pulling = false;
    renderWatchSync();
    if (!quiet) showPageMessage("O Health Connect não respondeu. Tenta de novo daqui a pouco.", { title: "Demorou demais", icon: "🐢" });
  }, 45000);
  let started = false;
  try {
    started = TOBA_NATIVE.healthRead(from, to, watchUi.reqId);
  } catch (e) {
    started = false;
  }
  if (!started) {
    clearTimeout(watchUi.timer);
    watchUi.pulling = false;
    renderWatchSync();
  }
}

// Resposta do APK (TobaBridge.healthRead)
window.onTobaHealthData = function (reqId, data) {
  if (reqId !== watchUi.reqId) return;
  clearTimeout(watchUi.timer);
  watchUi.pulling = false;
  if (data && data.status) watchUi.status = data.status;
  if (!data || !data.ok) {
    renderWatch();
    showPageMessage(`Não consegui ler o Health Connect agora.${data && data.error ? `\n\n(${data.error})` : ""}`, { title: "Deu ruim", icon: "💩" });
    return;
  }
  const changed = watchMerge(data);
  const auto = watchAutoMerge();
  watchSetState({
    pulledAt: Date.now(), diag: watchBuildDiag(data), ...(data.sources ? { oneSource: 1 } : {}),
    ...(data.samsung && typeof data.samsung === "object" ? { samsung: { ok: Boolean(data.samsung.ok), granted: Array.isArray(data.samsung.granted) ? data.samsung.granted.map(String) : [], at: Date.now() } } : {}),
    ...(watchNativeVersion() >= 13 && data.status && watchGrantedBody(data.status.granted) ? { bodyRead: 1 } : {}),
  });
  if (changed || auto) saveHealthDb();
  renderWatch();
  if (auto) tobaToast(`⌚ ${auto === 1 ? "1 treino completado" : `${auto} treinos completados`} com o relógio`);
};

// Resposta do pedido de permissão (TobaBridge.healthAsk)
window.onTobaHealthPerms = function (status) {
  if (status && typeof status === "object") watchUi.status = status;
  renderWatch();
  if (watchGranted().length) {
    watchPull({ full: true, quiet: true });
    return;
  }
  showPageMessage(
    "Nada foi liberado. Se a tela do Health Connect nem abriu, vai na ⚙️ › 🔐 Permissões do Health Connect e liga as chavinhas do Toba na mão.",
    { title: "Sem permissão", icon: "🔒" },
  );
};

function watchAsk() {
  if (!watchCanNative() || typeof TOBA_NATIVE.healthAsk !== "function") return watchExplainBrowser();
  TOBA_NATIVE.healthAsk();
}

function watchExplainBrowser() {
  const msg = TOBA_NATIVE
    ? "Teu APK ainda não sabe falar com o relógio. Instala o APK 2.2 (pelo KingInstaller, igual sempre) e volta aqui."
    : "Quem puxa do relógio é o app do Toba no celular (APK 2.2). Aqui no navegador aparece o que já veio de lá pela ☁️ Conta.";
  showPageMessage(msg, { title: "⌚ Relógio", icon: "📱" });
}

/* ---------------- Juntar o que veio ---------------- */

// Sono: a noite é do dia em que acordou. A maior sessão é a noite; as outras que
// não encostam nela viram cochilo (napMin). Sessão em cima da outra (duas fontes) é ignorada.
// v1.98 (😴 Sono turbinado): também guarda (tudo opcional, noite antiga não tem):
//   st = linha do tempo das fases, "l0.12 a12.3 d15.40" (fase + minuto desde o início . duração);
//   naps = [{ start, end, min, deep, light, rem, awake, st? }] (horário de cada cochilo);
//   bk + hr/ox/rr = FC média / menor oxigênio / respiração de dentro da noite em blocos de bk min (APK 2.6);
//   hrLow, oxLowSec (segundos abaixo de 90%), hrvAvg; e do 📥 Samsung: score, eff, lat, cyc, ment, phys, mov.
const WATCH_SLEEP_EXTRA = ["hrLow", "oxLowSec", "hrvAvg", "score", "eff", "lat", "cyc", "ment", "phys", "mov"];

// Fase do Health Connect -> letra. 1/3/7 acordado, 4 leve, 5 profundo, 6 REM, resto "dormindo" (sem fase)
function watchStageLetter(type) {
  const t = Number(type);
  return t === 1 || t === 3 || t === 7 ? "a" : t === 4 ? "l" : t === 5 ? "d" : t === 6 ? "r" : "s";
}

// [[início, fim, tipo], ...] (ms) -> "l0.12 a12.3" (junta pedaço colado da mesma fase)
function watchStEncode(stages, start) {
  if (!Array.isArray(stages) || !stages.length) return "";
  const segs = stages
    .map((x) => (Array.isArray(x) ? { s: Number(x[0]), e: Number(x[1]), t: watchStageLetter(x[2]) } : null))
    .filter((x) => x && Number.isFinite(x.s) && Number.isFinite(x.e) && x.e > x.s)
    .sort((a, b) => a.s - b.s);
  const out = [];
  segs.forEach((x) => {
    const off = Math.max(0, Math.round((x.s - start) / 60000));
    const dur = Math.max(1, Math.round((x.e - x.s) / 60000));
    const last = out[out.length - 1];
    if (last && last.t === x.t && Math.abs(last.off + last.dur - off) <= 1) last.dur = off + dur - last.off;
    else out.push({ t: x.t, off, dur });
  });
  return out.slice(0, 400).map((x) => `${x.t}${x.off}.${x.dur}`).join(" ");
}

// "l0.12 a12.3" -> [{ t, off, dur }] (texto torto = lista vazia)
function watchStDecode(st) {
  const out = [];
  String(st || "").replace(/([adlrs])(\d+)\.(\d+)/g, (_, t, off, dur) => {
    out.push({ t, off: Number(off), dur: Number(dur) });
    return "";
  });
  return out;
}

// Série da noite: só número ou null, no máximo 200 blocos
function watchSeriesClean(a, dec) {
  if (!Array.isArray(a) || !a.length) return undefined;
  const out = a.slice(0, 200).map((v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * dec) / dec));
  return out.some((v) => v !== null) ? out : undefined;
}

function watchSleepSession(s) {
  const start = Number(s && s.start);
  const end = Number(s && s.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const out = {
    start, end,
    min: Math.max(0, Math.round(Number(s.min) || 0)),
    deep: Math.round(Number(s.deep) || 0),
    light: Math.round(Number(s.light) || 0),
    rem: Math.round(Number(s.rem) || 0),
    awake: Math.round(Number(s.awake) || 0),
  };
  const st = typeof s.st === "string" ? s.st : watchStEncode(s.stages, start);
  if (st) out.st = st;
  const bk = Number(s.bk);
  if (bk > 0 && bk <= 60) {
    const hr = watchSeriesClean(s.hr, 1), ox = watchSeriesClean(s.ox, 1), rr = watchSeriesClean(s.rr, 10);
    const tp = watchSeriesClean(s.tp, 100); // v1.98: temperatura da pele (SDK do Samsung), 2 casas
    if (hr || ox || rr || tp) {
      out.bk = Math.round(bk);
      if (hr) out.hr = hr;
      if (ox) out.ox = ox;
      if (rr) out.rr = rr;
      if (tp) out.tp = tp;
    }
  }
  WATCH_SLEEP_EXTRA.forEach((k) => {
    const v = Number(s[k]);
    if (s[k] !== null && s[k] !== undefined && s[k] !== "" && Number.isFinite(v) && v >= 0) out[k] = Math.round(v * 10) / 10;
  });
  return out;
}

function watchGroupSleep(list) {
  const byDate = {};
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const s = watchSleepSession(raw);
    if (!s) return;
    const date = toIsoDate(new Date(s.end));
    (byDate[date] = byDate[date] || []).push(s);
  });
  const out = {};
  Object.keys(byDate).forEach((date) => {
    const all = byDate[date].sort((a, b) => b.min - a.min);
    const main = { ...all[0] };
    let napMin = 0;
    const naps = [];
    all.slice(1).forEach((s) => {
      const overlaps = s.start < main.end && s.end > main.start;
      if (overlaps) return;
      // cochilo em cima de outro cochilo (duas fontes): fica só o primeiro (o maior)
      if (naps.some((n) => s.start < n.end && s.end > n.start)) return;
      napMin += s.min;
      const nap = { start: s.start, end: s.end, min: s.min, deep: s.deep, light: s.light, rem: s.rem, awake: s.awake };
      if (s.st) nap.st = s.st;
      naps.push(nap);
    });
    if (napMin > 0) {
      main.napMin = napMin;
      main.naps = naps.sort((a, b) => a.start - b.start);
    }
    out[date] = main;
  });
  return out;
}

// v1.98: a noite nova do Health Connect substitui a antiga, mas o que ela não trouxe e a antiga
// tinha (nota do Samsung, fases do import, séries de uma leitura anterior) continua, se for a MESMA noite.
function watchSleepKeep(old, next) {
  if (!next || !old || typeof old !== "object") return next;
  if (Math.abs(Number(old.start) - next.start) > 20 * 60000 || Math.abs(Number(old.end) - next.end) > 20 * 60000) return next;
  const out = { ...next };
  ["st", ...WATCH_SLEEP_EXTRA].forEach((k) => {
    if (out[k] === undefined && old[k] !== undefined) out[k] = old[k];
  });
  if (!out.bk && old.bk) ["bk", "hr", "ox", "rr", "tp"].forEach((k) => { if (old[k] !== undefined) out[k] = old[k]; });
  else if (out.bk === old.bk && !out.tp && old.tp) out.tp = old.tp; // leitura sem o Samsung: a temperatura antiga fica
  if (!out.naps && Array.isArray(old.naps) && out.napMin === old.napMin) out.naps = old.naps;
  return out;
}

function watchGroupExercises(list) {
  const out = {};
  (Array.isArray(list) ? list : []).forEach((x) => {
    const start = Number(x && x.start);
    const end = Number(x && x.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const item = { start, end, type: Number(x.type) || 0 };
    if (x.title) item.title = String(x.title).slice(0, 80);
    // v1.89 (APK 2.3): números da sessão (o APK 2.2 não manda, aí fica só o tempo)
    WATCH_EX_FIELDS.forEach((f) => {
      if (Number(x[f]) > 0) item[f] = Math.round(Number(x[f]));
    });
    const date = toIsoDate(new Date(start));
    (out[date] = out[date] || []).push(item);
  });
  Object.values(out).forEach((arr) => arr.sort((a, b) => a.start - b.start));
  return out;
}

function watchMerge(data) {
  const granted = new Set(data.status && Array.isArray(data.status.granted) ? data.status.granted : watchGranted());
  const errors = data.errors && typeof data.errors === "object" ? data.errors : {};
  const incoming = data.days && typeof data.days === "object" ? data.days : {};
  const sleep = watchGroupSleep(data.sleep);
  const ex = watchGroupExercises(data.exercises);
  const from = String(data.from || "");
  const to = String(data.to || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;

  if (!healthDb.watch || typeof healthDb.watch !== "object" || Array.isArray(healthDb.watch)) {
    healthDb.watch = { v: 1, days: {}, goals: {} };
  }
  const w = watchDb();
  const before = JSON.stringify(w.days);
  const vanished = [];
  // Grupo que deu pra ler (permissão + sem erro): o número que veio substitui o antigo.
  const readable = Object.keys(WATCH_GROUPS).filter((g) => granted.has(g) && !WATCH_GROUPS[g].some((f) => errors[f]) && !errors[g]);
  // v1.98 (APK 2.6): 🌡️ temperatura e 🔋 Energy Score direto do Samsung Health (SamsungReader).
  // Só regrava quando veio número; não veio = fica o que tinha (até o do 📥 import antigo).
  const sam = data.samsung && typeof data.samsung === "object" && data.samsung.ok ? data.samsung : null;
  const samErr = sam && sam.errors && typeof sam.errors === "object" ? sam.errors : {};
  const samFields = sam && Array.isArray(sam.granted) ? ["temp", "energy"].filter((f) => sam.granted.includes(f) && !samErr[f]) : [];

  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const old = watchDay(date) || {};
    const next = { ...old };
    const src = incoming[date] && typeof incoming[date] === "object" ? incoming[date] : {};
    readable.forEach((g) => {
      WATCH_GROUPS[g].forEach((f) => {
        let v;
        if (f === "sleep") v = watchSleepKeep(old.sleep, sleep[date]); // v1.98: não perde o que só o 📥 Samsung tem
        else if (f === "ex") v = watchSyncExercises(old.ex, ex[date], vanished); // v1.89: apagou no relógio, some aqui
        else if (Number.isFinite(Number(src[f])) && src[f] !== null) {
          const dec = WATCH_DECIMAL_FIELDS.includes(f) ? 10 : 1; // v1.94: respiração com 1 casa
          v = Math.round(Number(src[f]) * dec) / dec;
        } else v = undefined;
        // Sumiu do Health Connect? Fica o que já estava (dado nunca some calado).
        if (v !== undefined) next[f] = v;
      });
    });
    samFields.forEach((f) => {
      const v = Number(src[f]);
      if (src[f] === null || src[f] === undefined || !Number.isFinite(v)) return;
      if (f === "temp" && v >= 25 && v <= 42) next.temp = Math.round(v * 10) / 10;
      if (f === "energy" && v > 0 && v <= 100) next.energy = Math.round(v);
    });
    delete next.at;
    if (!watchHasData(next)) continue;
    const sameAsOld = JSON.stringify({ ...old, at: undefined }) === JSON.stringify(next);
    next.at = sameAsOld && old.at ? old.at : Date.now();
    w.days[date] = next;
  }
  const goneChanged = watchNoteVanished(vanished);
  return JSON.stringify(w.days) !== before || goneChanged;
}

/* v1.89: exercício que SUMIU do Health Connect (apagado no relógio/Samsung Health).
 * No dia lido, a lista do Health Connect manda: o que não veio sai do dia. O que veio do
 * 📥 import do Samsung (imp: 1) fica, a não ser que o Health Connect tenha um no mesmo horário.
 * Treino do Toba que nasceu dele (➕ Virar treino ou 🔗 Mesclar) NÃO é apagado calado:
 * vai pra watch.gone e o Raio-X pergunta (🗑️ Apagar / 🔗 Desmesclar / Manter). */
function watchSyncExercises(oldList, incoming, vanished) {
  const fresh = Array.isArray(incoming) ? incoming : [];
  const prev = Array.isArray(oldList) ? oldList : [];
  const freshKeys = new Set(fresh.map(watchExKey));
  const near = (x) => fresh.some((y) => Math.abs(Number(y.start) - Number(x.start)) < 3 * 60000);
  const keep = [];
  prev.forEach((x) => {
    if (!x || freshKeys.has(watchExKey(x))) return;
    if (x.imp) {
      if (!near(x)) keep.push(x);
      return;
    }
    vanished.push(watchExKey(x));
  });
  const list = [...fresh, ...keep].sort((a, b) => a.start - b.start);
  return list.length ? list : undefined;
}

// v1.93: o treino ainda tá ligado a esse exercício do relógio? (mesclado: workout.watch.key;
// virou treino: externalId). Já desmesclou/apagou/editou = não pergunta de novo.
function watchGoneLinked(key, action, workout) {
  if (!workout) return false;
  if (action === "created") return !workout.externalId || String(workout.externalId) === key;
  return Boolean(workout.watch && workout.watch.key === key);
}

// v1.93: respondeu (🔗 Desmesclar / 🗑️ Apagar / 👍 Manter) = nunca mais pergunta desse exercício
function watchGoneDone() {
  const w = watchEnsureDb();
  if (!w.goneDone || typeof w.goneDone !== "object" || Array.isArray(w.goneDone)) w.goneDone = {};
  return w.goneDone;
}

function watchNoteVanished(keys) {
  if (!keys.length) return false;
  const w = watchEnsureDb();
  if (!w.gone || typeof w.gone !== "object" || Array.isArray(w.gone)) w.gone = {};
  const done = watchGoneDone();
  let changed = false;
  keys.forEach((key) => {
    const h = w.handled[key];
    if (!h || done[key] || w.gone[key]) return;
    const workout = h.workoutId ? (healthDb.workouts || []).find((item) => String(item.id) === String(h.workoutId)) : null;
    if (h.action === "ignored" || !watchGoneLinked(key, h.action, workout)) {
      delete w.handled[key];
    } else {
      w.gone[key] = { action: h.action, workoutId: String(h.workoutId), at: Date.now() };
    }
    changed = true;
  });
  return changed;
}

function watchGoneList() {
  const w = healthDb.watch;
  const gone = w && w.gone && typeof w.gone === "object" && !Array.isArray(w.gone) ? w.gone : {};
  const done = w && w.goneDone && typeof w.goneDone === "object" ? w.goneDone : {};
  return Object.keys(gone).map((key) => {
    const g = gone[key];
    if (done[key]) return null;
    const workout = (healthDb.workouts || []).find((item) => String(item.id) === String(g.workoutId));
    return watchGoneLinked(key, g.action, workout) ? { key, g, workout } : null;
  }).filter(Boolean);
}

function renderWatchGone() {
  const el = document.getElementById("watchGone");
  if (!el) return;
  const list = watchGoneList();
  el.hidden = !list.length;
  if (!list.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="section-title">🗑️ Sumiu do relógio</div>
    <div class="watch-inbox-list">${list.map(({ key, g, workout }) => {
      const id = escapeHtml(key);
      const created = g.action === "created";
      return `<div class="watch-ex is-gone">
        <div class="watch-ex-name">${escapeHtml(workout.title || "Treino")}</div>
        <div class="watch-ex-when">${escapeHtml(watchDayLabel(workout.date))}${workout.startTime ? ` · ${escapeHtml(workout.startTime)}` : ""} · ${created ? "virou treino daqui" : "tava mesclado com um treino teu"}</div>
        <p class="watch-muted">Apagaram esse exercício no relógio. ${created ? "Apaga o treino do Toba também?" : "Tira os dados do relógio desse treino? Tuas séries e kg ficam."}</p>
        <div class="watch-ex-actions">
          <button type="button" class="btn ${created ? "btn-danger" : "btn-primary"} btn-sm" data-click="watchGoneApply" data-id="${id}">${created ? "🗑️ Apagar do Toba" : "🔗 Desmesclar"}</button>
          <button type="button" class="btn btn-secondary btn-sm" data-click="watchGoneKeep" data-id="${id}">👍 Manter</button>
        </div>
      </div>`;
    }).join("")}</div>`;
}

function watchGoneApply(el) {
  const w = watchEnsureDb();
  const key = el.dataset.id;
  const item = watchGoneList().find((x) => x.key === key);
  if (item) {
    const { g, workout } = item;
    if (g.action === "created") {
      healthDb.workouts = healthDb.workouts.filter((x) => String(x.id) !== String(workout.id));
      tobaToast("🗑️ Treino apagado");
    } else {
      const wd = workout.watch || {};
      const prev = wd.prev && typeof wd.prev === "object" ? wd.prev : {}; // v2.04: volta o que tava antes
      (Array.isArray(wd.filled) ? wd.filled : []).forEach((field) => {
        if (["durationMinutes", "calories", "distanceKm"].includes(field)) workout[field] = Object.prototype.hasOwnProperty.call(prev, field) ? prev[field] : null;
      });
      delete workout.watch;
      tobaToast("🔗 Desmesclado");
    }
  }
  delete w.handled[key];
  if (w.gone) delete w.gone[key];
  watchGoneDone()[key] = Date.now();
  saveHealthDb();
  renderWatch();
}

function watchGoneKeep(el) {
  const w = watchEnsureDb();
  if (w.gone) delete w.gone[el.dataset.id];
  watchGoneDone()[el.dataset.id] = Date.now();
  saveHealthDb();
  renderWatch();
}

/* ---------------- 🩺 Diagnóstico (v1.88) ---------------- */

// Resumo da última leitura: quantos dias vieram de cada tipo, erros e de que app veio o sono/exercício
function watchBuildDiag(data) {
  const days = data.days && typeof data.days === "object" ? data.days : {};
  const count = (f) => Object.values(days).filter((d) => d && d[f] !== undefined && d[f] !== null).length;
  const origins = {};
  [...(Array.isArray(data.sleep) ? data.sleep : []), ...(Array.isArray(data.exercises) ? data.exercises : [])].forEach((x) => {
    if (x && x.origin) origins[String(x.origin).slice(0, 80)] = true;
  });
  const errors = {};
  Object.entries(data.errors && typeof data.errors === "object" ? data.errors : {}).forEach(([k, v]) => {
    errors[k] = String(v).slice(0, 160);
  });
  return {
    at: Date.now(),
    from: String(data.from || ""),
    to: String(data.to || ""),
    granted: data.status && Array.isArray(data.status.granted) ? data.status.granted : watchGranted(),
    errors,
    counts: {
      steps: count("steps"), kcal: count("kcal"), activeKcal: count("activeKcal"), distance: count("distanceM"),
      heart: count("hrAvg"), restHr: count("restHr"),
      hrv: count("hrv"), spo2: count("spo2"), resp: count("resp"), floors: count("floors"), // v1.94 (APK 2.5)
      sleep: Array.isArray(data.sleep) ? data.sleep.length : 0,
      exercise: Array.isArray(data.exercises) ? data.exercises.length : 0,
    },
    origins: Object.keys(origins).slice(0, 6),
    sources: watchDiagSources(data.sources), // v1.93 (APK 2.4)
    samsung: watchDiagSamsung(data.samsung), // v1.98 (APK 2.6)
  };
}

// v1.98 (APK 2.6): o que veio direto do Samsung Health (temperatura, Energy Score, nota de sono)
function watchDiagSamsung(x) {
  if (!x || typeof x !== "object") return null;
  const errs = {};
  Object.entries(x.errors && typeof x.errors === "object" ? x.errors : {}).forEach(([k, v]) => { errs[k] = String(v).slice(0, 160); });
  return {
    ok: Boolean(x.ok), error: x.error ? String(x.error).slice(0, 200) : "",
    granted: Array.isArray(x.granted) ? x.granted.map(String).slice(0, 6) : [],
    counts: { temp: Number(x.temp) || 0, energy: Number(x.energy) || 0, score: Number(x.score) || 0 },
    errors: errs,
  };
}

// v1.93 (APK 2.4): de que apps vieram passos/km/kcal. Com 2+, o APK usa um só por dia (o maior).
function watchDiagSources(src) {
  if (!src || typeof src !== "object") return null;
  const out = {};
  ["steps", "distance", "activeKcal", "kcal", "floors"].forEach((k) => {
    if (Array.isArray(src[k])) out[k] = src[k].map((x) => String(x).slice(0, 80)).slice(0, 6);
  });
  return out;
}

function watchAppName(pkg) {
  const names = {
    "com.sec.android.app.shealth": "Samsung Health",
    "com.google.android.apps.fitness": "Google Fit",
    "com.google.android.healthconnect.controller": "o próprio celular",
    "com.android.healthconnect.controller": "o próprio celular",
    android: "o próprio celular",
  };
  return names[pkg] || pkg;
}

function watchDiag() {
  const d = watchState().diag;
  return d && typeof d === "object" && d.counts ? d : null;
}

// Liberou tudo mas o Samsung Health não entregou passos nem sono (só a conta do basal e o coração)
function watchLooksStarved() {
  const d = watchDiag();
  return Boolean(d && !d.counts.steps && !d.counts.sleep && !d.counts.activeKcal);
}

function openWatchDiag() {
  closeTobaModal("settingsModal");
  const d = watchDiag();
  const el = document.getElementById("watchDiagBody");
  if (!d) {
    el.innerHTML = tobaEmpty("🩺", "Ainda não puxou nada", TOBA_NATIVE ? "Toca no 🔄 lá em cima e volta aqui." : "Só no app do Toba no celular.", { compact: true });
    openTobaModal("watchDiagModal");
    return;
  }
  const granted = new Set(Array.isArray(d.granted) ? d.granted : []);
  const unit = { sleep: "noite(s)", exercise: "treino(s)" };
  const rows = Object.keys(WATCH_GROUP_LABELS).map((g) => {
    const err = d.errors[g] || WATCH_GROUPS[g].map((f) => d.errors[f]).find(Boolean);
    const n = Number(d.counts[g]) || 0;
    let state;
    if (!granted.has(g)) state = `<span class="text-red">🔒 sem permissão</span>`;
    else if (err) state = `<span class="text-red">💥 ${escapeHtml(err)}</span>`;
    else if (!n) state = `<span class="text-gold">🤷 nada no Health Connect</span>`;
    else state = `<span class="text-green">✅ ${n} ${unit[g] || "dia(s)"}</span>`;
    return `<div class="kv-row watch-diag-row"><span>${WATCH_GROUP_LABELS[g]}</span>${state}</div>`;
  }).join("");
  const at = new Date(d.at);
  el.innerHTML = `<p class="toba-sheet-text">Última leitura: ${escapeHtml(watchDayLabel(toIsoDate(at)).toLowerCase())} às ${watchClock(d.at)}, de ${escapeHtml(d.from.slice(8, 10))}/${escapeHtml(d.from.slice(5, 7))} até ${escapeHtml(d.to.slice(8, 10))}/${escapeHtml(d.to.slice(5, 7))}.</p>
    <div class="kv-list">${rows}</div>
    ${d.origins.length ? `<p class="watch-muted">Sono/treino vieram de: ${d.origins.map(escapeHtml).join(", ")}</p>` : ""}
    ${d.sources ? `<p class="watch-muted">${[["steps", "👟 Passos"], ["distance", "📏 Distância"], ["activeKcal", "⚡ Ativas"], ["kcal", "🔥 Calorias"], ["floors", "🪜 Andares"]]
      .filter(([k]) => d.sources[k] && d.sources[k].length)
      .map(([k, label]) => `${label}: ${d.sources[k].map((x) => escapeHtml(watchAppName(x))).join(" + ")}`).join("<br>")}</p>
      ${Object.values(d.sources).some((l) => l.length > 1) ? `<p class="watch-muted">Mais de um app gravando o mesmo? O Toba usa um só por dia (o que mediu mais, normalmente o Samsung Health, que já junta relógio + celular), pra não contar duas vezes.</p>` : ""}` : ""}
    ${watchDiagSamsungHtml(d.samsung)}
    ${watchLooksStarved() ? `<div class="hint-box watch-diag-hint">🕵️ O Toba tá lendo certinho, mas o Health Connect não tem passos nem sono. As 🔥 calorias iguais todo dia são só o basal que o próprio Health Connect calcula. Quem precisa mandar é o <b>Samsung Health</b>: ${WATCH_SAMSUNG_STEPS}</div>` : ""}`;
  openTobaModal("watchDiagModal");
}

function watchDiagSamsungHtml(x) {
  if (!x) return watchSamsungCan() ? `<div class="card-title">📱 Direto do Samsung Health</div><p class="watch-muted">Puxa de novo (🔄) pra ver.</p>` : "";
  const labels = { temp: ["🌡️ temperatura da pele", "dia(s)"], energy: ["🔋 Energy Score", "dia(s)"], score: ["🤡 nota de sono", "noite(s)"] };
  const rows = Object.keys(labels).map((k) => {
    let state;
    if (!x.ok) state = `<span class="text-red">🔌 ${escapeHtml(x.error || "não conectou")}</span>`;
    else if (!x.granted.includes(k)) state = `<span class="text-red">🔒 sem permissão</span>`;
    else if (x.errors[k]) state = `<span class="text-red">💥 ${escapeHtml(x.errors[k])}</span>`;
    else if (!x.counts[k]) state = `<span class="text-gold">🤷 nada no período</span>`;
    else state = `<span class="text-green">✅ ${x.counts[k]} ${labels[k][1]}</span>`;
    return `<div class="kv-row watch-diag-row"><span>${labels[k][0]}</span>${state}</div>`;
  }).join("");
  const fix = !x.ok || x.granted.length < 3
    ? `<div class="hint-box watch-diag-hint">${WATCH_SAMSUNG_DEV}</div><button type="button" class="btn btn-secondary" data-click="watchSamsungAsk">📱 Ligar o Samsung Health</button>` : "";
  return `<div class="card-title">📱 Direto do Samsung Health</div><div class="kv-list">${rows}</div>${fix}`;
}

/* ---------------- v1.98 (APK 2.6): 📱 Samsung Health direto (sem import) ----------------
 * O que o Samsung não manda pro Health Connect (🌡️ temperatura da pele, 🔋 Energy Score e a
 * nota de sono dele) o APK lê direto pelo SDK do Samsung, junto de cada 🔄. Precisa do
 * "Developer Mode for Data Read" ligado no Samsung Health (só leitura, sem parceria). */
const WATCH_SAMSUNG_DEV = "No celular: <b>Samsung Health › ⋮ › Configurações › Sobre o Samsung Health</b>, toca <b>10 vezes</b> na versão, entra em <b>Developer mode</b> e liga <b>Developer Mode for Data Read</b>. Os campos de package name e access code ficam em branco (são só pra parceria). Depois toca no botão aqui embaixo e libera as 3 leituras.";

function watchSamsungCan() {
  return Boolean(TOBA_NATIVE && typeof TOBA_NATIVE.samsungAsk === "function");
}

function watchSamsungOn() {
  const x = watchState().samsung;
  return Boolean(x && x.ok && Array.isArray(x.granted) && x.granted.length >= 3);
}

function watchSamsungAsk() {
  if (!watchSamsungCan()) {
    showPageMessage(TOBA_NATIVE ? "Isso precisa do APK 2.6 (instala pelo KingInstaller, igual sempre)." : "Só no app do Toba no celular.", { title: "📱 Samsung Health", icon: "📱" });
    return;
  }
  closeTobaModal("watchDiagModal");
  watchUi.samsungAsked = true;
  TOBA_NATIVE.samsungAsk();
}

// Resposta do TobaBridge.samsungAsk / samsungStatus
window.onTobaSamsungStatus = function (x) {
  if (!x || typeof x !== "object") return;
  const asked = watchUi.samsungAsked;
  watchUi.samsungAsked = false;
  watchSetState({ samsung: { ok: Boolean(x.ok), granted: Array.isArray(x.granted) ? x.granted.map(String) : [], at: Date.now() } });
  if (!asked) return renderWatch();
  if (x.ok && Array.isArray(x.granted) && x.granted.length) {
    watchPull({ full: true, quiet: true });
    return;
  }
  renderWatch();
  {
    showPageMessage(`${x.ok ? "O Samsung Health não liberou nada." : `O Samsung Health não deixou conectar${x.error ? ` (${x.error})` : ""}.`}\n\nConfere o modo desenvolvedor: Samsung Health › ⋮ › Configurações › Sobre › 10 toques na versão › Developer mode › Developer Mode for Data Read ligado. Depois tenta de novo.`, { title: "📱 Samsung Health", icon: "🔒" });
  }
};

const WATCH_SAMSUNG_STEPS = "abre <b>Conexão Saúde › Seus apps › Samsung Health</b> e liga a permissão de <b>escrever</b> passos, distância, calorias ativas, sono e exercícios (ou dentro do Samsung Health › ☰ › Configurações › Health Connect). Depois abre o Samsung Health uma vez, espera sincronizar e toca no 🔄.";

/* ---------------- ⌚ Treinos do relógio (v1.89) ----------------
 * Cada exercício do relógio aparece uma vez na caixinha (v2.04: no 🏋️ Treinos, não mais no Raio-X):
 *   🔗 Mesclar  = junta com um treino já anotado no Toba (o teu manda; o relógio
 *                 só completa o que estava vazio e guarda os números dele em workout.watch)
 *   ➕ Virar treino = cria um treino novo (source "health-connect", externalId = chave)
 *   🙈 Ignorar
 * TOBA_HEALTH_DB.watch.handled[chave] = { action, workoutId?, at } impede de voltar,
 * mesmo puxando os 30 dias de novo. Chave = "início-fim-tipo" (ms do Health Connect).
 * Desmesclar (página do treino, treinos.js) apaga o handled e o treino volta pra caixinha.
 * ------------------------------------------------------------------- */
const WATCH_EX_FIELDS = ["kcal", "activeKcal", "distanceM", "steps", "hrAvg", "hrMax"];
const WATCH_INBOX_DAYS = 30;
// Tipo do relógio (ExerciseSessionType do Android) -> treino do Toba
const WATCH_TO_TOBA = {
  53: { type: "walking", title: "Caminhada / Corrida", mode: "manual" },
  33: { type: "walking", title: "Caminhada / Corrida", mode: "manual" },
  34: { type: "walking", title: "Caminhada / Corrida", mode: "treadmill" },
  21: { type: "walking", title: "Caminhada / Corrida", mode: "manual" },
  4: { type: "bike", title: "Bike" },
  5: { type: "bike", title: "Bike" },
  60: { type: "elliptical", title: "Elíptico" },
};
// Família pra achar o par certo (caminhada com caminhada, academia com força...)
const WATCH_FAMILY = { walking: "walk", bike: "bike", elliptical: "cardio", strength: "gym", custom: "gym", saitama: "home", home: "home", stretch: "stretch" };
const WATCH_EX_FAMILY = { 53: "walk", 33: "walk", 34: "walk", 21: "walk", 4: "bike", 5: "bike", 60: "cardio", 45: "gym", 55: "gym", 8: "home", 20: "home", 46: "stretch", 57: "stretch", 27: "stretch" };

function watchHandled() {
  const w = healthDb.watch;
  if (!w || typeof w !== "object" || Array.isArray(w)) return {};
  return w.handled && typeof w.handled === "object" && !Array.isArray(w.handled) ? w.handled : {};
}

function watchExKey(x) {
  return `${Math.round(Number(x.start))}-${Math.round(Number(x.end))}-${Number(x.type) || 0}`;
}

function watchExName(x) {
  return WATCH_EXERCISE_NAMES[x.type] || WATCH_EXERCISE_NAMES[0];
}

function watchExMinutes(x) {
  return Math.max(1, Math.round((Number(x.end) - Number(x.start)) / 60000));
}

// Exercícios ainda sem destino, mais novo primeiro (só dos últimos 30 dias)
function watchInbox() {
  const handled = watchHandled();
  const min = watchAddDays(toIsoDate(), -(WATCH_INBOX_DAYS - 1));
  const out = [];
  Object.keys(watchDays()).forEach((date) => {
    if (date < min) return;
    const d = watchDay(date);
    (Array.isArray(d && d.ex) ? d.ex : []).forEach((x) => {
      if (!x || !Number.isFinite(Number(x.start)) || !Number.isFinite(Number(x.end))) return;
      if (watchExMinutes(x) < 3) return; // sessão de 1-2 min é ruído do relógio
      if (x.auto) return; // caminhada que o relógio detectou sozinho (import do Samsung)
      if (!handled[watchExKey(x)]) out.push(x);
    });
  });
  return out.sort((a, b) => b.start - a.start);
}

function watchHhmmToMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Treinos do Toba do mesmo dia, ainda sem relógio, o mais provável primeiro
function watchCandidates(x) {
  const date = toIsoDate(new Date(x.start));
  const startD = new Date(x.start);
  const exStart = startD.getHours() * 60 + startD.getMinutes();
  const exEnd = exStart + watchExMinutes(x);
  const fam = WATCH_EX_FAMILY[x.type] || "";
  const sameDay = (Array.isArray(healthDb.workouts) ? healthDb.workouts : []).filter((w) => w && w.date === date && !w.watch);
  // Só um treino no dia = é ele (se o horário não brigar). Com vários, precisa bater horário ou tipo.
  const minScore = sameDay.length > 1 ? 5 : 1;
  return sameDay
    .map((w) => {
      let score = 1;
      const t = watchHhmmToMin(w.startTime);
      if (t !== null) {
        if (t >= exStart - 40 && t <= exEnd + 10) score += 10;
        else score -= 3;
      }
      if (fam && WATCH_FAMILY[w.type] === fam) score += 5;
      return { w, score };
    })
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.w);
}

function watchExSnapshot(x, extra) {
  const snap = { key: watchExKey(x), start: Math.round(x.start), end: Math.round(x.end), type: Number(x.type) || 0, minutes: watchExMinutes(x) };
  if (x.title) snap.title = String(x.title).slice(0, 80);
  WATCH_EX_FIELDS.forEach((f) => {
    if (Number(x[f]) > 0) snap[f] = Math.round(Number(x[f]));
  });
  return Object.assign(snap, extra);
}

function watchExKcal(x) {
  return Number(x.kcal) > 0 ? Math.round(x.kcal) : Number(x.activeKcal) > 0 ? Math.round(x.activeKcal) : null;
}

function watchEnsureDb() {
  if (!healthDb.watch || typeof healthDb.watch !== "object" || Array.isArray(healthDb.watch)) healthDb.watch = { v: 1, days: {}, goals: {} };
  if (!healthDb.watch.handled || typeof healthDb.watch.handled !== "object" || Array.isArray(healthDb.watch.handled)) healthDb.watch.handled = {};
  return healthDb.watch;
}

function watchFindEx(key) {
  return watchInbox().find((x) => watchExKey(x) === key) || null;
}

// v2.04 (pedido do Rafa): mesclou = vale o número do RELÓGIO (tempo, kcal, km), não o que o
// formulário chutou. O que tava antes fica em watch.prev (desmesclar devolve) e dá pra ✏️ Editar depois.
// (até a v2.03 o teu mandava: o relógio só preenchia o que tava vazio)
function watchMergeInto(x, workout) {
  const filled = [];
  const prev = {};
  const put = (field, value) => {
    if (!(Number(value) > 0) || Number(workout[field]) === Number(value)) return;
    prev[field] = workout[field] === undefined ? null : workout[field];
    workout[field] = value;
    filled.push(field);
  };
  put("durationMinutes", watchExMinutes(x));
  put("calories", watchExKcal(x));
  if (Number(x.distanceM) >= 50) put("distanceKm", Math.round(Number(x.distanceM) / 10) / 100);
  workout.watch = watchExSnapshot(x, { filled, prev, mergedAt: Date.now() });
  watchEnsureDb().handled[watchExKey(x)] = { action: "merged", workoutId: String(workout.id), at: Date.now() };
}

function watchCreateWorkout(x) {
  const map = WATCH_TO_TOBA[x.type];
  const start = new Date(x.start);
  const name = watchExName(x).replace(/^\S+\s/, "");
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: map ? map.type : "custom",
    title: map ? map.title : (x.title ? String(x.title).slice(0, 60) : name),
    date: toIsoDate(start),
    durationMinutes: watchExMinutes(x),
    calories: watchExKcal(x),
    distanceKm: Number(x.distanceM) >= 50 ? Math.round(Number(x.distanceM) / 10) / 100 : null,
    pushups: null, situps: null, squats: null, sets: null, reps: null, weightKg: null,
    notes: "",
    source: "health-connect",
    externalId: watchExKey(x),
    startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
  };
  if (map && map.mode) workout.mode = map.mode;
  workout.watch = watchExSnapshot(x, { filled: [], created: true, mergedAt: Date.now() });
  if (!Array.isArray(healthDb.workouts)) healthDb.workouts = [];
  healthDb.workouts.push(workout);
  watchEnsureDb().handled[watchExKey(x)] = { action: "created", workoutId: workout.id, at: Date.now() };
  return workout;
}

function watchExStats(x) {
  const bits = [`⏱️ ${watchHours(watchExMinutes(x))}`];
  const kcal = watchExKcal(x);
  if (kcal) bits.push(`🔥 ${watchInt(kcal)} kcal`);
  if (Number(x.distanceM) >= 50) bits.push(`📏 ${watchKm(x.distanceM)}`);
  if (Number(x.hrAvg) > 0) bits.push(`❤️ ${watchInt(x.hrAvg)}${Number(x.hrMax) > 0 ? `/${watchInt(x.hrMax)}` : ""} bpm`);
  return bits.join(" · ");
}

function watchWorkoutLabel(w) {
  return `${escapeHtml(w.title || "Treino")}${w.startTime ? ` · ${escapeHtml(w.startTime)}` : ""}`;
}

function renderWatchInbox() {
  const el = document.getElementById("watchInbox");
  if (!el) return;
  const list = watchInbox();
  // v1.89: logo depois de ignorar, dá pra desfazer (o Rafa tocou sem querer e sumiu direto)
  const undo = watchUi.lastIgnored && watchHandled()[watchUi.lastIgnored.key]
    ? `<div class="watch-undo"><span>🙈 ${escapeHtml(watchUi.lastIgnored.name)} ignorado</span><button type="button" class="chip-btn" data-click="watchUndoIgnore">↩️ Desfazer</button></div>`
    : "";
  if (!list.length && !undo) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (!list.length) {
    el.innerHTML = `<div class="section-title">⌚ Treinos do relógio</div>${undo}`;
    return;
  }
  el.innerHTML = `<div class="section-title">⌚ Treinos do relógio <span class="watch-inbox-count">${list.length}</span></div>
    <p class="watch-muted watch-inbox-hint">O relógio gravou e o Toba ainda não sabe o que fazer: junta com um treino teu, vira treino novo, ou ignora (não conta em nada).</p>
    ${undo}
    <div class="watch-inbox-list">${list.slice(0, 10).map((x) => {
      const key = escapeHtml(watchExKey(x));
      const cands = watchCandidates(x);
      const when = `${escapeHtml(watchDayLabel(toIsoDate(new Date(x.start))))} · ${watchClock(x.start)}–${watchClock(x.end)}`;
      const merge = cands.length
        ? `<button type="button" class="btn btn-primary btn-sm" data-click="watchMergeAsk" data-id="${key}">🔗 Mesclar com ${watchWorkoutLabel(cands[0])}${cands.length > 1 ? " ▾" : ""}</button>`
        : "";
      return `<div class="watch-ex">
        <div class="watch-ex-top">
          <span class="watch-ex-name">${escapeHtml(watchExName(x))}${x.title ? ` · ${escapeHtml(x.title)}` : ""}</span>
        </div>
        <div class="watch-ex-when">${when}</div>
        <div class="watch-ex-stats">${watchExStats(x)}</div>
        <div class="watch-ex-actions">
          ${merge}
          <button type="button" class="btn ${cands.length ? "btn-secondary" : "btn-primary"} btn-sm" data-click="watchCreateEx" data-id="${key}">➕ Virar treino</button>
          <button type="button" class="btn btn-secondary btn-sm" data-click="watchIgnoreEx" data-id="${key}">🙈 Ignorar</button>
        </div>
      </div>`;
    }).join("")}</div>
    ${list.length > 10 ? `<p class="watch-muted">+ ${list.length - 10} mais antigos</p>` : ""}`;
}

/* v1.90: treino salvo com "⌚ Completar com o relógio" (workout.watchPending) mescla sozinho.
 * Acha o exercício do relógio do mesmo dia: horário batendo (startTime do treino) ou o único
 * do dia / o único do mesmo tipo. Empate sem horário = deixa pra caixinha (o 🔗 Mesclar pergunta). */
function watchAutoMerge() {
  const pending = (Array.isArray(healthDb.workouts) ? healthDb.workouts : []).filter((w) => w && w.watchPending && !w.watch);
  if (!pending.length) return 0;
  let merged = 0;
  pending.forEach((workout) => {
    const exs = watchInbox().filter((x) => toIsoDate(new Date(x.start)) === workout.date);
    if (!exs.length) return;
    const t = watchHhmmToMin(workout.startTime);
    const fam = WATCH_FAMILY[workout.type] || "";
    const scored = exs.map((x) => {
      const d = new Date(x.start);
      const s0 = d.getHours() * 60 + d.getMinutes();
      const s1 = s0 + watchExMinutes(x);
      let score = 0;
      if (t !== null) score += t >= s0 - 40 && t <= s1 + 10 ? 10 : -100;
      if (fam && WATCH_EX_FAMILY[x.type] === fam) score += 5;
      return { x, score };
    }).filter((c) => c.score > -50).sort((a, b) => b.score - a.score);
    if (!scored.length) return;
    const tie = scored.length > 1 && scored[0].score === scored[1].score;
    if (tie && t === null) return;
    watchMergeInto(scored[0].x, workout);
    delete workout.watchPending;
    merged++;
  });
  return merged;
}

let watchMergeKey = "";

function watchDoMerge(x, workout) {
  watchMergeInto(x, workout);
  delete workout.watchPending;
  saveHealthDb();
  renderWatch();
  tobaToast(`🔗 Mesclado com ${workout.title || "o treino"}`);
}

function watchMergeAsk(el) {
  const x = watchFindEx(el.dataset.id);
  if (!x) return renderWatch();
  const cands = watchCandidates(x);
  if (!cands.length) return renderWatch();
  if (cands.length === 1) return watchDoMerge(x, cands[0]);
  watchMergeKey = watchExKey(x);
  document.getElementById("watchMergeBody").innerHTML = `
    <p class="toba-sheet-text">${escapeHtml(watchExName(x))} · ${watchClock(x.start)}–${watchClock(x.end)}<br>${watchExStats(x)}</p>
    <div class="toba-list">${cands.map((w) => `
      <button type="button" class="toba-list-item watch-merge-pick" data-click="watchMergePick" data-id="${escapeHtml(String(w.id))}">
        <span>${watchWorkoutLabel(w)}</span><span class="toba-hub-chevron">›</span>
      </button>`).join("")}</div>`;
  openTobaModal("watchMergeModal");
}

function watchMergePick(el) {
  const x = watchFindEx(watchMergeKey);
  const w = (healthDb.workouts || []).find((item) => String(item.id) === el.dataset.id && !item.watch);
  closeTobaModal("watchMergeModal");
  if (!x || !w) return renderWatch();
  watchDoMerge(x, w);
}

function watchCreateEx(el) {
  const x = watchFindEx(el.dataset.id);
  if (!x) return renderWatch();
  const w = watchCreateWorkout(x);
  saveHealthDb();
  renderWatch();
  tobaToast(`➕ ${w.title} no Treinos (vale XP e troféu)`);
}

async function watchIgnoreEx(el) {
  const x = watchFindEx(el.dataset.id);
  if (!x) return renderWatch();
  const ok = await showPageMessage(
    `${watchExName(x)} de ${watchDayLabel(toIsoDate(new Date(x.start)))} (${watchClock(x.start)}) sai da lista e não vira treino: não conta XP nem troféu. Os números dele continuam no dia do Raio-X.\n\nSe mudar de ideia: ⚙️ do Treinos › 🙈 Treinos do relógio ignorados.`,
    { title: "Ignorar esse treino?", confirm: true, confirmLabel: "🙈 Ignorar" },
  );
  if (!ok) return;
  watchEnsureDb().handled[watchExKey(x)] = { action: "ignored", at: Date.now() };
  watchUi.lastIgnored = { key: watchExKey(x), name: watchExName(x).replace(/^\S+\s/, "") };
  saveHealthDb();
  renderWatch();
}

function watchUndoIgnore() {
  const last = watchUi.lastIgnored;
  watchUi.lastIgnored = null;
  const h = watchHandled();
  if (last && h[last.key] && h[last.key].action === "ignored") {
    delete h[last.key];
    saveHealthDb();
  }
  renderWatch();
}

// ⚙️ › 🙈 Treinos ignorados: volta qualquer um pra caixinha
function watchIgnoredList() {
  const h = watchHandled();
  const out = [];
  Object.values(watchDays()).forEach((d) => {
    (Array.isArray(d && d.ex) ? d.ex : []).forEach((x) => {
      const k = watchExKey(x);
      if (h[k] && h[k].action === "ignored") out.push(x);
    });
  });
  return out.sort((a, b) => b.start - a.start);
}

function openWatchIgnored() {
  const list = watchIgnoredList();
  document.getElementById("watchIgnoredBody").innerHTML = list.length
    ? `<div class="toba-list">${list.slice(0, 60).map((x) => `
      <div class="toba-list-item watch-ignored-row">
        <span class="watch-ignored-text"><b>${escapeHtml(watchExName(x))}</b><br><span class="watch-muted">${escapeHtml(watchDayLabel(toIsoDate(new Date(x.start))))} · ${watchClock(x.start)} · ${watchExStats(x)}</span></span>
        <button type="button" class="chip-btn" data-click="watchUnignore" data-id="${escapeHtml(watchExKey(x))}">↩️ Voltar</button>
      </div>`).join("")}</div>`
    : tobaEmpty("🙈", "Nenhum ignorado", "O que você ignorar aparece aqui pra poder voltar.", { compact: true });
  openTobaModal("watchIgnoredModal");
}

function watchUnignore(el) {
  const h = watchHandled();
  if (h[el.dataset.id] && h[el.dataset.id].action === "ignored") {
    delete h[el.dataset.id];
    saveHealthDb();
  }
  renderWatch();
  openWatchIgnored();
}

/* ---------------- Formatos ---------------- */

function watchInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("pt-BR");
}

function watchHours(min) {
  const m = Math.round(Number(min) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}min`;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

function watchKm(m) {
  const km = (Number(m) || 0) / 1000;
  return `${km.toLocaleString("pt-BR", { minimumFractionDigits: km < 10 ? 1 : 0, maximumFractionDigits: km < 10 ? 2 : 1 })} km`;
}

function watchClock(ms) {
  const d = new Date(Number(ms));
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function watchWeekday(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
}

function watchDayLabel(iso) {
  const today = toIsoDate();
  if (iso === today) return "Hoje";
  if (iso === watchAddDays(today, -1)) return "Ontem";
  return `${watchWeekday(iso)}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function watchAgo(ms) {
  const s = Math.max(0, Math.round((Date.now() - Number(ms)) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dia(s)`;
}

/* ---------------- Tela ---------------- */

// v1.95: a tela é o DIA escolhido (relogio-dia.js): ‹ dia ›, herói + comparações, sono,
// 🧬 corpo, ⚖️ balança (relogio-balanca.js, se existir), 🤡, caixinhas, 🗓️ semana, 📈 tendência, 📜 meses.
function renderWatch() {
  if (!WATCH_ON_RAIOX) {
    if (typeof watchPageRefresh === "function") watchPageRefresh(); // v2.04: 🏋️ Treinos
    return;
  }
  if (typeof watchMetricOpen === "function" && watchMetricOpen()) renderWatchMetric();
  if (typeof watchRecordsOpen === "function" && watchRecordsOpen()) renderWatchRecords(); // v1.96
  renderWatchConnect();
  renderWatchDayNav();
  renderWatchToday();
  renderWatchSleep();
  renderWatchBody();
  if (typeof renderWatchScale === "function") renderWatchScale();
  renderWatchCloba();
  // v2.04: 🗑️ Sumiu do relógio e ⌚ Treinos do relógio saíram daqui: moram no 🏋️ Treinos
  renderWatchWeek();
  renderWatchTrend();
  renderWatchList();
  renderWatchSync();
}

function renderWatchConnect() {
  const el = document.getElementById("watchConnect");
  const hasAny = Object.keys(watchDays()).length > 0;
  let html = "";
  if (!TOBA_NATIVE) {
    html = hasAny ? "" : `<div class="hint-box">📱 Quem puxa do relógio é o <b>app do Toba no celular</b> (APK 2.2). Aqui no navegador aparece o que já veio de lá pela ☁️ Conta.</div>`;
  } else if (!watchCanNative()) {
    html = `<div class="card watch-connect">
      <div class="watch-connect-icon">📦</div>
      <div class="watch-connect-title">Atualiza o APK pro 2.2</div>
      <p class="watch-connect-text">O teu APK (${escapeHtml(tobaApkVersion() || "antigo")}) ainda não fala com o Health Connect. Gera o 2.2 e instala pelo KingInstaller, igual sempre.</p>
    </div>`;
  } else {
    const s = watchUi.status || watchReadStatus();
    if (!s || !s.ok) {
      html = `<div class="card watch-connect">
        <div class="watch-connect-icon">🤖</div>
        <div class="watch-connect-title">Precisa do Android 14 ou mais novo</div>
        <p class="watch-connect-text">O Health Connect que o Toba usa vem dentro do Android 14+${s && s.sdk ? ` (o teu é API ${escapeHtml(String(s.sdk))})` : ""}.</p>
      </div>`;
    } else if (!watchGranted().length) {
      html = `<div class="card watch-connect">
        <div class="watch-connect-icon">⌚</div>
        <div class="watch-connect-title">Bora ligar o relógio?</div>
        <p class="watch-connect-text">O Galaxy Watch manda pro <b>Samsung Health</b>, que manda pro <b>Health Connect</b>, que o Toba lê. Só leitura: o Toba nunca escreve nada lá.</p>
        <button type="button" class="btn btn-primary" data-click="watchAsk">⌚ Ligar o Health Connect</button>
        <details class="watch-howto">
          <summary>Samsung Health não manda nada?</summary>
          <ol>
            <li>Abre o <b>Samsung Health</b> › ☰/⋮ › <b>Configurações</b> › <b>Health Connect</b> (ou Conexão Saúde).</li>
            <li>Libera o Samsung Health a <b>escrever</b> passos, sono, calorias, frequência cardíaca e exercícios (e, pro 🧬 Corpo por dentro, HRV, oxigenação, respiração e andares).</li>
            <li>Volta aqui e toca no 🔄.</li>
          </ol>
        </details>
      </div>`;
    } else {
      const missing = (Array.isArray(s.missing) ? s.missing : []).filter((m) => WATCH_GROUP_LABELS[m]);
      if (missing.length) {
        html = `<div class="hint-box watch-missing">🔒 Faltou liberar: ${missing.map((m) => WATCH_GROUP_LABELS[m]).join(", ")}.
          <button type="button" class="chip-btn" data-click="watchAsk">Liberar</button></div>`;
      }
      if (hasAny && !watchUi.pulling && watchLooksStarved()) {
        html += `<div class="hint-box watch-starved">🕵️ Chegou só o ❤️ e a 🔥 do basal: o Samsung Health não tá mandando passos nem sono pro Health Connect. ${WATCH_SAMSUNG_STEPS}
          <button type="button" class="chip-btn" data-click="openWatchDiag">🩺 Ver o que veio</button></div>`;
      }
      if (!hasAny && !watchUi.pulling && watchState().pulledAt) {
        html += `<div class="hint-box">🤷 O Health Connect não tem nada ainda. No <b>Samsung Health</b> › Configurações › <b>Health Connect</b>, libera ele escrever os dados, depois toca no 🔄.</div>`;
      }
    }
  }
  el.innerHTML = html;
  el.hidden = !html;
}

function watchRing(value, goal, color) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return `<svg class="watch-ring" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="watch-ring-bg" />
    ${pct > 0 ? `<circle cx="60" cy="60" r="${r}" class="watch-ring-fg" style="stroke:${color};stroke-dasharray:${(c * pct).toFixed(1)} ${c.toFixed(1)}" />` : ""}
  </svg>`;
}

function watchSleepBar(s) {
  const parts = [["deep", s.deep], ["light", s.light], ["rem", s.rem], ["awake", s.awake]].filter((p) => Number(p[1]) > 0);
  const total = parts.reduce((a, p) => a + Number(p[1]), 0);
  if (!total) return "";
  return `<div class="watch-sleep-bar">${parts.map(([k, v]) => `<span class="is-${k}" style="flex:${v}"></span>`).join("")}</div>
    <div class="watch-sleep-legend">
      ${s.deep ? `<span><i class="is-deep"></i>Profundo ${watchHours(s.deep)}</span>` : ""}
      ${s.light ? `<span><i class="is-light"></i>Leve ${watchHours(s.light)}</span>` : ""}
      ${s.rem ? `<span><i class="is-rem"></i>REM ${watchHours(s.rem)}</span>` : ""}
      ${s.awake ? `<span><i class="is-awake"></i>Acordado ${watchHours(s.awake)}</span>` : ""}
    </div>`;
}

/* ---------------- 🧬 Corpo por dentro (v1.94, 🩻 RAIO ULTRA X) ----------------
 * v1.95: os quadrados, o 😴 da noite, o herói do dia e o 🤡 moram no relogio-dia.js. */
function watchDec(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function watchAvgBefore(field, date, days = 30) {
  let sum = 0, n = 0;
  for (let i = 1; i <= days; i++) {
    const d = watchDay(watchAddDays(date, -i));
    if (d && d[field] !== undefined && d[field] !== null) { sum += Number(d[field]); n++; }
  }
  return n >= 5 ? sum / n : null;
}

function watchAnDateShort(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// v1.90 (pedido do Rafa): 📜 Mês a mês. Cada mês mostra o total consolidado; tocar abre o dia a dia.
const WATCH_MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WATCH_MONTH_STEP = 6; // v1.96 (pedido do Rafa): 6 meses por vez, todos fechados

function watchDayRow(date, goals) {
  const d = watchDay(date);
  const bits = [];
  if (d.steps !== undefined) bits.push(`${d.steps >= goals.steps ? "🏆" : "👟"} ${watchInt(d.steps)}`);
  if (d.sleep) bits.push(`😴 ${watchHours(d.sleep.min)}`);
  if (watchKcalOf(d) !== undefined) bits.push(`🔥 ${watchInt(watchKcalOf(d))}`);
  if (Array.isArray(d.ex) && d.ex.length) bits.push(`🏃 ${d.ex.length}`);
  return `<div class="toba-list-item watch-row${date === watchUi.date ? " is-sel" : ""}" role="button" tabindex="0" data-click="watchGoDay" data-id="${date}">
      <span class="watch-row-date">${escapeHtml(watchDayLabel(date))}</span>
      <span class="watch-row-bits">${bits.join(" · ")}</span>
      <span class="toba-hub-chevron">›</span>
    </div>`;
}

/* v1.91: 🔥 Calorias = ⚡ ativas (o que muda de um dia pro outro). O basal
 * (o corpo gastando parado, quase igual todo dia) deixava tudo reto: só entra
 * se ligar o "➕ Somar o basal" na análise das calorias (lembra no aparelho). */
const WATCH_BASAL_KEY = "toba_health_watch_kcal_basal";
function watchKcalBasal() {
  try { return localStorage.getItem(WATCH_BASAL_KEY) === "1"; } catch (err) { return false; }
}
function watchSetKcalBasal(on) {
  try { localStorage.setItem(WATCH_BASAL_KEY, on ? "1" : "0"); } catch (err) { /* sem storage: fica só nesta tela */ }
}
function watchKcalOf(d) {
  if (!d) return undefined;
  if (watchKcalBasal()) return d.kcal !== undefined ? d.kcal : d.activeKcal;
  return d.activeKcal;
}
function watchKcalSub(d) {
  if (watchKcalBasal()) return d && d.activeKcal !== undefined ? `com basal · ⚡ ${watchInt(d.activeKcal)} ativas` : "kcal com basal";
  return d && d.kcal !== undefined ? `⚡ ativas · total ${watchInt(d.kcal)}` : "⚡ kcal ativas";
}

function watchMonthSummary(dates, goals) {
  let steps = 0, stepDays = 0, hit = 0, sleep = 0, sleepDays = 0, kcal = 0, ex = 0;
  dates.forEach((date) => {
    const d = watchDay(date);
    if (d.steps !== undefined) { steps += d.steps; stepDays++; if (d.steps >= goals.steps) hit++; }
    if (d.sleep && d.sleep.min > 0) { sleep += d.sleep.min; sleepDays++; }
    if (watchKcalOf(d) !== undefined) kcal += watchKcalOf(d);
    if (Array.isArray(d.ex)) ex += d.ex.filter((x) => !x.auto && watchExMinutes(x) >= 3).length;
  });
  return { steps, stepDays, hit, sleepAvg: sleepDays ? sleep / sleepDays : 0, kcal, ex, days: dates.length };
}

function renderWatchList() {
  const el = document.getElementById("watchList");
  const dates = Object.keys(watchDays()).filter((d) => watchHasData(watchDay(d))).sort().reverse();
  if (!dates.length) {
    el.innerHTML = tobaEmpty("⌚", "Nada do relógio ainda", TOBA_NATIVE ? "Liga o Health Connect e toca no 🔄." : "Abre no app do Toba no celular.");
    return;
  }
  const goals = watchGoals();
  const months = [];
  dates.forEach((date) => {
    const ym = date.slice(0, 7);
    if (!months.length || months[months.length - 1].ym !== ym) months.push({ ym, dates: [] });
    months[months.length - 1].dates.push(date);
  });
  if (watchUi.openMonth === undefined) watchUi.openMonth = ""; // v1.96: começa tudo fechado, só o resumo
  const shown = months.slice(0, watchUi.listShown);
  el.innerHTML = shown.map(({ ym, dates: md }) => {
    const sum = watchMonthSummary(md, goals);
    const open = watchUi.openMonth === ym;
    const name = `${WATCH_MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
    const stats = [];
    if (sum.stepDays) stats.push(`<span class="watch-month-stat"><b>👟 ${watchInt(sum.steps)}</b><small>passos · ${watchInt(sum.steps / sum.stepDays)}/dia</small></span>`);
    if (sum.sleepAvg) stats.push(`<span class="watch-month-stat"><b>😴 ${watchHours(sum.sleepAvg)}</b><small>sono por noite</small></span>`);
    if (sum.kcal) stats.push(`<span class="watch-month-stat"><b>🔥 ${watchInt(sum.kcal)}</b><small>${watchKcalBasal() ? "kcal no mês (com basal)" : "kcal ativas no mês"}</small></span>`);
    stats.push(`<span class="watch-month-stat"><b>🏃 ${sum.ex}</b><small>treinos do relógio</small></span>`);
    return `<div class="watch-month${open ? " is-open" : ""}">
      <button type="button" class="watch-month-head" data-click="watchToggleMonth" data-id="${ym}" aria-expanded="${open}">
        <span class="watch-month-title">${escapeHtml(name)}</span>
        <span class="watch-month-meta">${sum.hit ? `🏆 ${sum.hit} na meta · ` : ""}${sum.days} dias</span>
        <span class="toba-hub-chevron">›</span>
      </button>
      <div class="watch-month-stats">${stats.join("")}</div>
      ${open ? `<div class="toba-list watch-month-days">${md.map((date) => watchDayRow(date, goals)).join("")}</div>` : ""}
    </div>`;
  }).join("") + (months.length > shown.length ? `<button type="button" class="btn btn-secondary" data-click="watchMore">⬇️ Mostrar próximos ${Math.min(WATCH_MONTH_STEP, months.length - shown.length)} meses</button>` : "");
}

function renderWatchSync() {
  const btn = document.getElementById("watchSyncBtn");
  if (btn) {
    btn.classList.toggle("is-spinning", watchUi.pulling);
    btn.hidden = !TOBA_NATIVE;
  }
  const el = document.getElementById("watchSyncLine");
  if (!el) return; // v2.04: no 🏋️ Treinos a linha é outra (treinos-relogio.js)
  const at = watchState().pulledAt;
  el.textContent = watchUi.pulling ? "⏳ Puxando do Health Connect..." : at ? `🔄 Puxado do relógio ${watchAgo(at)}` : "";
}

/* ---------------- Detalhe do dia ---------------- */

function openWatchDay(el) {
  const date = el.dataset.id;
  const d = watchDay(date);
  if (!d) return;
  const row = (k, v) => `<div class="kv-row"><span>${k}</span><b>${v}</b></div>`;
  const rows = [];
  if (d.steps !== undefined) rows.push(row("👟 Passos", watchInt(d.steps)));
  if (d.distanceM !== undefined) rows.push(row("📏 Distância", watchKm(d.distanceM)));
  if (d.kcal !== undefined) rows.push(row("🔥 Calorias no dia", `${watchInt(d.kcal)} kcal`));
  if (d.activeKcal !== undefined) rows.push(row("⚡ Calorias ativas", `${watchInt(d.activeKcal)} kcal`));
  if (d.restHr !== undefined) rows.push(row("💤 FC em repouso", `${watchInt(d.restHr)} bpm`));
  if (d.hrAvg !== undefined) rows.push(row("❤️ FC média", `${watchInt(d.hrAvg)} bpm`));
  if (d.hrMin !== undefined && d.hrMax !== undefined) rows.push(row("📉📈 Mín / máx", `${watchInt(d.hrMin)} / ${watchInt(d.hrMax)} bpm`));
  // v1.94 (🩻 RAIO ULTRA X)
  if (d.stress !== undefined) rows.push(row("😰 Stress", `${watchInt(d.stress)} média · pico ${watchInt(d.stressMax)} às ${d.stressPeak}h`));
  if (d.energy !== undefined) rows.push(row("🔋 Energy Score", `${watchInt(d.energy)}`));
  if (d.hrv !== undefined) rows.push(row("💓 HRV dormindo", `${watchInt(d.hrv)} ms`));
  if (d.spo2 !== undefined) rows.push(row("🫁 Oxigenação", `${d.spo2}%${d.spo2Min !== undefined ? ` · mín. ${d.spo2Min}%` : ""}`));
  if (d.resp !== undefined) rows.push(row("😮‍💨 Respiração", `${watchDec(d.resp)} por min`));
  if (d.temp !== undefined) rows.push(row("🌡️ Temp. da pele", `${watchDec(d.temp)} °C`));
  if (d.snoreMin !== undefined) rows.push(row("😪 Ronco", d.snoreMin ? watchHours(d.snoreMin) : "nada"));
  if (d.floors !== undefined) rows.push(row("🪜 Andares", watchInt(d.floors)));
  let sleep = "";
  if (d.sleep) {
    sleep = `<div class="section-title">😴 Sono</div>
      <div class="kv-list">
        ${row("Dormiu", watchHours(d.sleep.min))}
        ${row("Deitou › acordou", `${watchClock(d.sleep.start)} › ${watchClock(d.sleep.end)}`)}
        ${d.sleep.napMin ? row("💤 Cochilos", watchHours(d.sleep.napMin)) : ""}
      </div>${watchSleepBar(d.sleep)}`;
  }
  let ex = "";
  if (Array.isArray(d.ex) && d.ex.length) {
    ex = `<div class="section-title">🏃 Exercícios do relógio</div><div class="kv-list">${d.ex.map((x) =>
      row(`${WATCH_EXERCISE_NAMES[x.type] || WATCH_EXERCISE_NAMES[0]}${x.title ? ` · ${escapeHtml(x.title)}` : ""}`,
        `${watchClock(x.start)} · ${watchHours(Math.round((x.end - x.start) / 60000))}`)).join("")}</div>`;
  }
  document.getElementById("watchDayTitle").textContent = `⌚ ${watchDayLabel(date)}`;
  document.getElementById("watchDayBody").innerHTML = `<div class="kv-list">${rows.join("") || row("Nada", "--")}</div>${sleep}${ex}`;
  openTobaModal("watchDayModal");
}

/* ---------------- Metas ---------------- */

function openWatchGoals() {
  renderWatchGoals();
  openTobaModal("watchGoalsModal");
}

function renderWatchGoals() {
  const g = watchGoals();
  document.getElementById("watchGoalSteps").innerHTML = WATCH_STEP_GOALS.map((v) =>
    `<button type="button" class="chip-btn${v === g.steps ? " is-on" : ""}" data-click="setWatchGoal" data-kind="steps" data-value="${v}">${watchInt(v)}</button>`).join("");
  document.getElementById("watchGoalSleep").innerHTML = WATCH_SLEEP_GOALS.map((v) =>
    `<button type="button" class="chip-btn${v === g.sleepMin ? " is-on" : ""}" data-click="setWatchGoal" data-kind="sleepMin" data-value="${v}">${watchHours(v)}</button>`).join("");
  const clock = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  const wake = (id, kind, list, cur) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = list.map((v) => `<button type="button" class="chip-btn${v === cur ? " is-on" : ""}" data-click="setWatchWake" data-kind="${kind}" data-value="${v}">${clock(v)}</button>`).join("")
      + `<button type="button" class="chip-btn${!cur ? " is-on" : ""}" data-click="setWatchWake" data-kind="${kind}" data-value="0">🆓 Livre</button>`;
  };
  wake("watchWakeWk", "wakeWk", WATCH_WAKE_WK, g.wakeWk);
  wake("watchWakeWe", "wakeWe", WATCH_WAKE_WE, g.wakeWe);
}

// v2.00: ⏰ hora de acordar. 0 = livre (o Cloba usa a tua média de acordar)
function setWatchWake(el) {
  const kind = el.dataset.kind === "wakeWe" ? "wakeWe" : "wakeWk";
  const value = Number(el.dataset.value);
  if (!(value >= 0 && value < 720)) return;
  if (!healthDb.watch || typeof healthDb.watch !== "object" || Array.isArray(healthDb.watch)) {
    healthDb.watch = { v: 1, days: {}, goals: {} };
  }
  const w = watchDb();
  if (!w.goals || typeof w.goals !== "object" || Array.isArray(w.goals)) w.goals = {};
  if (value > 0) w.goals[kind] = value;
  else delete w.goals[kind];
  saveHealthDb();
  renderWatchGoals();
  renderWatch();
  if (typeof watchMetricOpen === "function" && watchMetricOpen() && typeof renderWatchMetric === "function") renderWatchMetric();
}

function setWatchGoal(el) {
  const kind = el.dataset.kind === "sleepMin" ? "sleepMin" : "steps";
  const value = Number(el.dataset.value);
  if (!(value > 0)) return;
  if (!healthDb.watch || typeof healthDb.watch !== "object" || Array.isArray(healthDb.watch)) {
    healthDb.watch = { v: 1, days: {}, goals: {} };
  }
  const w = watchDb();
  if (!w.goals || typeof w.goals !== "object" || Array.isArray(w.goals)) w.goals = {};
  w.goals[kind] = value;
  saveHealthDb();
  renderWatchGoals();
  renderWatch();
}

/* ---------------- Ações ---------------- */


// v1.90 (pedido do Rafa), ordem da ⚙️ do Raio-X:
//   ☁️ Conta: Conta Toba, 🎯 Metas  ·  ⌚ Relógio: ignorados, diagnóstico, permissões, puxar 30 dias
//   💾 Dados: 📥 Importar histórico do Samsung, Dados & Backup
// A Conta Toba entra depois do DOMContentLoaded (toba-cloud.js); sem ela, fica tudo no ⌚ Relógio.
function watchArrangeSettings() {
  const goals = document.getElementById("watchGoalsMenuBtn");
  const conta = document.getElementById("tobaCloudSettingsItem");
  if (goals && conta && goals.parentElement !== conta) conta.appendChild(goals);
  const imp = document.getElementById("samsungMenuBtn");
  const backup = document.querySelector('#settingsModal [data-open="tobaDataModal"]');
  if (imp && backup && imp.nextElementSibling !== backup) backup.parentElement.insertBefore(imp, backup);
}
document.addEventListener("DOMContentLoaded", () => setTimeout(watchArrangeSettings, 60));

tobaActions({
  watchAsk,
  watchPull() {
    watchPull({ full: false });
  },
  watchPullFull() {
    closeTobaModal("settingsModal");
    if (!watchCanNative()) return watchExplainBrowser();
    watchPull({ full: true });
  },
  watchOpenSettings() {
    if (!watchCanNative() || typeof TOBA_NATIVE.healthOpenSettings !== "function") return watchExplainBrowser();
    TOBA_NATIVE.healthOpenSettings();
  },
  watchToggleMonth(el) {
    watchUi.openMonth = watchUi.openMonth === el.dataset.id ? "" : el.dataset.id;
    renderWatchList();
  },
  watchMore() {
    watchUi.listShown += WATCH_MONTH_STEP;
    renderWatchList();
  },
  openWatchDay,
  openWatchGoals,
  setWatchGoal,
  setWatchWake,
  openWatchDiag,
  watchSamsungAsk,
  watchMergeAsk,
  watchMergePick,
  watchCreateEx,
  watchIgnoreEx,
  watchGoneApply,
  watchUndoIgnore,
  openWatchIgnored,
  watchUnignore,
  watchGoneKeep,
});

function onHealthDataReplaced() {
  renderWatch();
}

// Puxa sozinho ao abrir e ao voltar pro app (se já tem permissão e faz um tempinho)
function watchAutoPull() {
  if (!watchCanNative()) return;
  watchReadStatus();
  const at = Number(watchState().pulledAt) || 0;
  if (watchGranted().length && Date.now() - at > WATCH_AUTO_MIN * 60000) watchPull({ quiet: true });
  else renderWatch();
}

window.onTobaAppResume = function () {
  watchAutoPull();
};

document.addEventListener("DOMContentLoaded", () => {
  if (!WATCH_ON_RAIOX) return; // v2.04: o 🏋️ Treinos cuida do dele (treinos-relogio.js)
  renderWatch();
  watchAutoPull();
});
