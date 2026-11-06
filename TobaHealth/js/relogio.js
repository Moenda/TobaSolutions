/* =====================================================================
 * Toba Health · 🩻 Raio-X (v1.87 "⌚ Relógio"; nome novo na v1.89)
 * - Passos, sono, calorias, distância e coração do Galaxy Watch.
 *   Caminho: relógio -> Samsung Health -> Health Connect (Android 14+) ->
 *   APK 2.2 (TobaNative.healthRead) -> aqui.
 * - Tudo fica no TOBA_HEALTH_DB.watch (vai junto no backup do Health e na ☁️):
 *   { v: 1, days: { "AAAA-MM-DD": { steps, kcal, activeKcal, distanceM, hrAvg,
 *     hrMin, hrMax, restHr, sleep: { start, end, min, deep, light, rem, awake,
 *     napMin? }, ex: [{ start, end, type, title? }], at } }, goals: { steps, sleepMin } }
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
};
const WATCH_GROUP_LABELS = {
  steps: "👟 passos", sleep: "😴 sono", kcal: "🔥 calorias", activeKcal: "⚡ calorias ativas",
  distance: "📏 distância", heart: "❤️ batimentos", restHr: "💤 FC em repouso", exercise: "🏃 exercícios",
};
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

const watchUi = { chart: "steps", range: 7, listShown: 12, pulling: false, reqId: "", timer: null, status: null };

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
  };
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
  return Boolean(day) && Object.keys(WATCH_GROUPS).some((g) => WATCH_GROUPS[g].some((f) => day[f] !== undefined && day[f] !== null));
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

// Período a puxar: 1ª vez = 30 dias; depois, do último dia guardado (−2, o relógio
// sincroniza atrasado) até hoje.
function watchPullRange(full) {
  const today = toIsoDate();
  const dates = Object.keys(watchDays()).sort();
  let from = watchAddDays(today, -(WATCH_FIRST_DAYS - 1));
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
  watchSetState({ pulledAt: Date.now(), diag: watchBuildDiag(data) });
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
function watchGroupSleep(list) {
  const byDate = {};
  (Array.isArray(list) ? list : []).forEach((s) => {
    const start = Number(s && s.start);
    const end = Number(s && s.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const date = toIsoDate(new Date(end));
    (byDate[date] = byDate[date] || []).push({
      start, end,
      min: Math.max(0, Math.round(Number(s.min) || 0)),
      deep: Math.round(Number(s.deep) || 0),
      light: Math.round(Number(s.light) || 0),
      rem: Math.round(Number(s.rem) || 0),
      awake: Math.round(Number(s.awake) || 0),
    });
  });
  const out = {};
  Object.keys(byDate).forEach((date) => {
    const all = byDate[date].sort((a, b) => b.min - a.min);
    const main = { ...all[0] };
    let napMin = 0;
    all.slice(1).forEach((s) => {
      const overlaps = s.start < main.end && s.end > main.start;
      if (!overlaps) napMin += s.min;
    });
    if (napMin > 0) main.napMin = napMin;
    out[date] = main;
  });
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

  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const old = watchDay(date) || {};
    const next = { ...old };
    const src = incoming[date] && typeof incoming[date] === "object" ? incoming[date] : {};
    readable.forEach((g) => {
      WATCH_GROUPS[g].forEach((f) => {
        let v;
        if (f === "sleep") v = sleep[date];
        else if (f === "ex") v = watchSyncExercises(old.ex, ex[date], vanished); // v1.89: apagou no relógio, some aqui
        else v = Number.isFinite(Number(src[f])) && src[f] !== null ? Math.round(Number(src[f])) : undefined;
        // Sumiu do Health Connect? Fica o que já estava (dado nunca some calado).
        if (v !== undefined) next[f] = v;
      });
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

function watchNoteVanished(keys) {
  if (!keys.length) return false;
  const w = watchEnsureDb();
  if (!w.gone || typeof w.gone !== "object" || Array.isArray(w.gone)) w.gone = {};
  let changed = false;
  keys.forEach((key) => {
    const h = w.handled[key];
    if (!h) return;
    const workout = h.workoutId ? (healthDb.workouts || []).find((item) => String(item.id) === String(h.workoutId)) : null;
    if (h.action === "ignored" || !workout) {
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
  return Object.keys(gone).map((key) => {
    const g = gone[key];
    const workout = (healthDb.workouts || []).find((item) => String(item.id) === String(g.workoutId));
    return workout ? { key, g, workout } : null;
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
      (Array.isArray(wd.filled) ? wd.filled : []).forEach((field) => {
        if (["durationMinutes", "calories", "distanceKm"].includes(field)) workout[field] = null;
      });
      delete workout.watch;
      tobaToast("🔗 Desmesclado");
    }
  }
  delete w.handled[key];
  if (w.gone) delete w.gone[key];
  saveHealthDb();
  renderWatch();
}

function watchGoneKeep(el) {
  const w = watchEnsureDb();
  if (w.gone) delete w.gone[el.dataset.id];
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
      sleep: Array.isArray(data.sleep) ? data.sleep.length : 0,
      exercise: Array.isArray(data.exercises) ? data.exercises.length : 0,
    },
    origins: Object.keys(origins).slice(0, 6),
  };
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
    ${watchLooksStarved() ? `<div class="hint-box watch-diag-hint">🕵️ O Toba tá lendo certinho, mas o Health Connect não tem passos nem sono. As 🔥 calorias iguais todo dia são só o basal que o próprio Health Connect calcula. Quem precisa mandar é o <b>Samsung Health</b>: ${WATCH_SAMSUNG_STEPS}</div>` : ""}`;
  openTobaModal("watchDiagModal");
}

const WATCH_SAMSUNG_STEPS = "abre <b>Conexão Saúde › Seus apps › Samsung Health</b> e liga a permissão de <b>escrever</b> passos, distância, calorias ativas, sono e exercícios (ou dentro do Samsung Health › ☰ › Configurações › Health Connect). Depois abre o Samsung Health uma vez, espera sincronizar e toca no 🔄.";

/* ---------------- ⌚ Treinos do relógio (v1.89) ----------------
 * Cada exercício do relógio aparece uma vez na caixinha do Raio-X:
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

// O teu manda: só preenche o que estava vazio e anota o que preencheu (pra desmesclar)
function watchMergeInto(x, workout) {
  const filled = [];
  if (!(Number(workout.durationMinutes) > 0)) {
    workout.durationMinutes = watchExMinutes(x);
    filled.push("durationMinutes");
  }
  const kcal = watchExKcal(x);
  if (!(Number(workout.calories) > 0) && kcal) {
    workout.calories = kcal;
    filled.push("calories");
  }
  if (!(Number(workout.distanceKm) > 0) && Number(x.distanceM) >= 50) {
    workout.distanceKm = Math.round(Number(x.distanceM) / 10) / 100;
    filled.push("distanceKm");
  }
  workout.watch = watchExSnapshot(x, { filled, mergedAt: Date.now() });
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
    `${watchExName(x)} de ${watchDayLabel(toIsoDate(new Date(x.start)))} (${watchClock(x.start)}) sai da lista e não vira treino: não conta XP nem troféu. Os números dele continuam no dia do Raio-X.\n\nSe mudar de ideia: ⚙️ › 🙈 Treinos do relógio ignorados.`,
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

function renderWatch() {
  if (typeof watchMetricOpen === "function" && watchMetricOpen()) renderWatchMetric();
  renderWatchConnect();
  renderWatchToday();
  renderWatchSleep();
  renderWatchCloba();
  renderWatchGone();
  renderWatchInbox();
  renderWatchChart();
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
            <li>Libera o Samsung Health a <b>escrever</b> passos, sono, calorias, frequência cardíaca e exercícios.</li>
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

function renderWatchToday() {
  const el = document.getElementById("watchToday");
  const today = toIsoDate();
  const day = watchDay(today) || {};
  const goal = watchGoals().steps;
  const steps = Number(day.steps) || 0;
  const done = steps >= goal;
  const stat = (label, value, sub = "", metric = "") => `<div class="toba-stat is-center${metric ? " watch-tap" : ""}"${metric ? ` role="button" tabindex="0" data-click="openWatchMetric" data-metric="${metric}"` : ""}>
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      ${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}
    </div>`;
  el.innerHTML = `
    <div class="watch-hero">
      <div class="watch-ring-wrap watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="steps" aria-label="Análise dos passos">
        ${watchRing(steps, goal, done ? "var(--gold-2)" : "var(--green)")}
        <div class="watch-ring-text">
          <span class="watch-ring-num">${day.steps !== undefined ? watchInt(steps) : "--"}</span>
          <span class="watch-ring-label">👟 passos hoje</span>
          <span class="watch-ring-goal">${done ? "🏆 meta batida!" : `meta ${watchInt(goal)}`}</span>
        </div>
      </div>
    </div>
    <div class="toba-stats watch-stats">
      ${stat("🔥 Calorias", day.kcal !== undefined ? watchInt(day.kcal) : "--", "kcal no dia", "kcal")}
      ${stat("⚡ Ativas", day.activeKcal !== undefined ? watchInt(day.activeKcal) : "--", "kcal mexendo", "active")}
      ${stat("📏 Distância", day.distanceM !== undefined ? watchKm(day.distanceM) : "--", "", "distance")}
      ${stat("❤️ Coração", day.restHr !== undefined ? `${watchInt(day.restHr)}` : day.hrAvg !== undefined ? `${watchInt(day.hrAvg)}` : "--",
        day.restHr !== undefined ? "bpm em repouso" : "bpm médio", "heart")}
    </div>`;
}

// Última noite = a do dia mais recente com sono (hoje ou antes)
function watchLastSleep() {
  const dates = Object.keys(watchDays()).filter((d) => watchDay(d).sleep).sort();
  if (!dates.length) return null;
  const date = dates[dates.length - 1];
  return { date, sleep: watchDay(date).sleep };
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

function renderWatchSleep() {
  const el = document.getElementById("watchSleep");
  const last = watchLastSleep();
  if (!last) {
    el.innerHTML = `<div class="card-title">😴 Sono</div>
      <p class="watch-muted">Nenhuma noite ainda. Dorme com o relógio que amanhã aparece aqui.</p>`;
    return;
  }
  const s = last.sleep;
  const goal = watchGoals().sleepMin;
  const pct = Math.min(100, Math.round((s.min / goal) * 100));
  // v1.90: o card inteiro abre a 🔬 análise do sono
  el.dataset.click = "openWatchMetric";
  el.dataset.metric = "sleep";
  el.classList.add("watch-tap");
  el.innerHTML = `<div class="card-title watch-tap-title">😴 Sono · ${escapeHtml(watchDayLabel(last.date).toLowerCase())}<span class="watch-tap-more">Análise ›</span></div>
    <div class="watch-sleep-main">
      <span class="watch-sleep-num">${watchHours(s.min)}</span>
      <span class="watch-sleep-time">🛏️ ${watchClock(s.start)} › ⏰ ${watchClock(s.end)}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${s.min >= goal ? "var(--gold-2)" : "var(--blue)"}"></div></div>
    <div class="watch-muted watch-sleep-goal">${pct}% da meta de ${watchHours(goal)}${s.napMin ? ` · 💤 +${watchHours(s.napMin)} de cochilo` : ""}</div>
    ${watchSleepBar(s)}`;
}

// 🤡 Papo reto do Cloba: 1 ou 2 frases sobre hoje e a última noite
function renderWatchCloba() {
  const el = document.getElementById("watchCloba");
  const day = watchDay(toIsoDate());
  const last = watchLastSleep();
  const goals = watchGoals();
  const lines = [];
  if (last) {
    const m = last.sleep.min;
    if (m >= goals.sleepMin) lines.push(`😎 ${watchHours(m)} de sono. Dormiu igual o Killua depois do sachê.`);
    else if (m < 300) lines.push(`🧟 Só ${watchHours(m)} de sono? Hoje o café coado na V60 é dose dupla, e cama cedo.`);
    else if (m < 360) lines.push(`🥱 ${watchHours(m)} de sono, dá pro gasto. Mas o Saitama não treinou dormindo pouco.`);
    else lines.push(`🙂 ${watchHours(m)} de sono, quase lá. Mais ${watchHours(goals.sleepMin - m)} e era sono de rei.`);
    if (Number(last.sleep.deep) >= 90) lines.push("🌊 Sono profundo caprichado, o corpo agradece.");
  }
  if (day && day.steps !== undefined) {
    const s = Number(day.steps);
    const hour = new Date().getHours();
    if (s >= goals.steps * 1.5) lines.push(`🚀 ${watchInt(s)} passos! O Gon não consegue nem te acompanhar.`);
    else if (s >= goals.steps) lines.push(`🏆 Meta de passos batida. Nunca foi sorte, Cloba. Nunca foi sorte. 🙏`);
    else if (hour >= 18 && s < goals.steps * 0.4) lines.push(`🛋️ ${watchInt(s)} passos até agora... bora dar uma volta no quarteirão, parça.`);
    else lines.push(`👟 Faltam ${watchInt(goals.steps - s)} passos pra meta. Dá tempo!`);
  }
  el.innerHTML = lines.length ? `<div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Papo reto do Cloba</b><p>${lines.slice(0, 3).join("<br>")}</p></div></div>` : "";
}

function watchChartRows() {
  const today = toIsoDate();
  const rows = [];
  for (let i = watchUi.range - 1; i >= 0; i--) {
    const date = watchAddDays(today, -i);
    const d = watchDay(date) || {};
    let v = null;
    if (watchUi.chart === "steps") v = d.steps;
    else if (watchUi.chart === "sleep") v = d.sleep ? d.sleep.min : undefined;
    else v = d.kcal !== undefined ? d.kcal : d.activeKcal;
    rows.push({ date, v: v === undefined || v === null ? null : Number(v) });
  }
  return rows;
}

function watchMonthRows(dayRows) {
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const buckets = [];
  dayRows.forEach((r) => {
    const ym = r.date.slice(0, 7);
    let b = buckets[buckets.length - 1];
    if (!b || b.ym !== ym) buckets.push((b = { ym, sum: 0, n: 0 }));
    if (r.v !== null) { b.sum += r.v; b.n++; }
  });
  return buckets.slice(-12).map((b) => ({ date: `${b.ym}-01`, v: b.n ? b.sum / b.n : null, label: names[Number(b.ym.slice(5, 7)) - 1] }));
}

function renderWatchChart() {
  document.querySelectorAll("#watchChartTabs .period-btn").forEach((b) => b.classList.toggle("active", b.dataset.chart === watchUi.chart));
  document.querySelectorAll("#watchRangeTabs .period-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.range) === watchUi.range));
  const el = document.getElementById("watchChart");
  const dayRows = watchChartRows();
  const vals = dayRows.filter((r) => r.v !== null).map((r) => r.v);
  // v1.89: 1 ano = 12 barras com a média de cada mês (os números de baixo continuam por dia)
  const rows = watchUi.range > 31 ? watchMonthRows(dayRows) : dayRows;
  const goals = watchGoals();
  const goal = watchUi.chart === "steps" ? goals.steps : watchUi.chart === "sleep" ? goals.sleepMin : null;
  if (!vals.length) {
    el.innerHTML = tobaEmpty("📊", "Sem dados nesse período", "Puxa do relógio no 🔄 lá em cima.", { compact: true });
    document.getElementById("watchChartStats").innerHTML = "";
    return;
  }
  const W = 340, H = 150, padB = 18, padT = 8;
  const max = Math.max(...vals, goal || 0) * 1.08 || 1;
  const n = rows.length;
  const slot = W / n;
  const bw = Math.max(2, Math.min(28, slot * 0.66));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const color = watchUi.chart === "steps" ? "var(--green)" : watchUi.chart === "sleep" ? "var(--blue)" : "var(--coral)";
  const bars = rows.map((r, i) => {
    const x = i * slot + (slot - bw) / 2;
    const label = r.label !== undefined ? r.label : n <= 7 ? watchWeekday(r.date) : (i % 5 === 4 || i === n - 1 ? r.date.slice(8, 10) : "");
    const hit = goal && r.v !== null && r.v >= goal;
    const bar = r.v === null ? "" : `<rect x="${x.toFixed(1)}" y="${y(r.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, H - padB - y(r.v)).toFixed(1)}" rx="3" style="fill:${hit ? "var(--gold-2)" : color}" />`;
    return `${bar}${label ? `<text x="${(i * slot + slot / 2).toFixed(1)}" y="${H - 4}" class="watch-chart-label">${label}</text>` : ""}`;
  }).join("");
  const goalLine = goal ? `<line x1="0" x2="${W}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" class="watch-chart-goal" />` : "";
  el.innerHTML = `<svg class="watch-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico">${goalLine}${bars}</svg>`;

  const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
  const best = Math.max(...vals);
  const hits = goal ? vals.filter((v) => v >= goal).length : null;
  const fmt = (v) => (watchUi.chart === "sleep" ? watchHours(v) : watchInt(v));
  document.getElementById("watchChartStats").innerHTML = `
    <div class="toba-stat is-center"><span class="toba-stat-label">Média</span><span class="toba-stat-value">${fmt(avg)}</span></div>
    <div class="toba-stat is-center"><span class="toba-stat-label">Melhor</span><span class="toba-stat-value">${fmt(best)}</span></div>
    <div class="toba-stat is-center"><span class="toba-stat-label">${hits !== null ? "Na meta" : "Dias"}</span><span class="toba-stat-value">${hits !== null ? `${hits}/${vals.length}` : vals.length}</span></div>`;
}

// v1.90 (pedido do Rafa): 📜 Mês a mês. Cada mês mostra o total consolidado; tocar abre o dia a dia.
const WATCH_MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WATCH_MONTH_STEP = 12;

function watchDayRow(date, goals) {
  const d = watchDay(date);
  const bits = [];
  if (d.steps !== undefined) bits.push(`${d.steps >= goals.steps ? "🏆" : "👟"} ${watchInt(d.steps)}`);
  if (d.sleep) bits.push(`😴 ${watchHours(d.sleep.min)}`);
  if (d.kcal !== undefined) bits.push(`🔥 ${watchInt(d.kcal)}`);
  else if (d.activeKcal !== undefined) bits.push(`⚡ ${watchInt(d.activeKcal)}`);
  if (Array.isArray(d.ex) && d.ex.length) bits.push(`🏃 ${d.ex.length}`);
  return `<div class="toba-list-item watch-row" role="button" tabindex="0" data-click="openWatchDay" data-id="${date}">
      <span class="watch-row-date">${escapeHtml(watchDayLabel(date))}</span>
      <span class="watch-row-bits">${bits.join(" · ")}</span>
      <span class="toba-hub-chevron">›</span>
    </div>`;
}

function watchMonthSummary(dates, goals) {
  let steps = 0, stepDays = 0, hit = 0, sleep = 0, sleepDays = 0, kcal = 0, ex = 0;
  dates.forEach((date) => {
    const d = watchDay(date);
    if (d.steps !== undefined) { steps += d.steps; stepDays++; if (d.steps >= goals.steps) hit++; }
    if (d.sleep && d.sleep.min > 0) { sleep += d.sleep.min; sleepDays++; }
    if (d.kcal !== undefined) kcal += d.kcal;
    else if (d.activeKcal !== undefined) kcal += d.activeKcal;
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
  if (watchUi.openMonth === undefined) watchUi.openMonth = months[0].ym;
  const shown = months.slice(0, watchUi.listShown);
  el.innerHTML = shown.map(({ ym, dates: md }) => {
    const sum = watchMonthSummary(md, goals);
    const open = watchUi.openMonth === ym;
    const name = `${WATCH_MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
    const stats = [];
    if (sum.stepDays) stats.push(`<span class="watch-month-stat"><b>👟 ${watchInt(sum.steps)}</b><small>passos · ${watchInt(sum.steps / sum.stepDays)}/dia</small></span>`);
    if (sum.sleepAvg) stats.push(`<span class="watch-month-stat"><b>😴 ${watchHours(sum.sleepAvg)}</b><small>sono por noite</small></span>`);
    if (sum.kcal) stats.push(`<span class="watch-month-stat"><b>🔥 ${watchInt(sum.kcal)}</b><small>kcal no mês</small></span>`);
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
  }).join("") + (months.length > shown.length ? `<button type="button" class="btn btn-secondary" data-click="watchMore">Mostrar meses mais antigos (${months.length - shown.length})</button>` : "");
}

function renderWatchSync() {
  const btn = document.getElementById("watchSyncBtn");
  if (btn) {
    btn.classList.toggle("is-spinning", watchUi.pulling);
    btn.hidden = !TOBA_NATIVE;
  }
  const el = document.getElementById("watchSyncLine");
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
  watchChart(el) {
    watchUi.chart = el.dataset.chart;
    renderWatchChart();
  },
  watchRange(el) {
    watchUi.range = [7, 30, 365].includes(Number(el.dataset.range)) ? Number(el.dataset.range) : 7;
    renderWatchChart();
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
  openWatchDiag,
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
  renderWatch();
  watchAutoPull();
});
