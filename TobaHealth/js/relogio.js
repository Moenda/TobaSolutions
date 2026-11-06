/* =====================================================================
 * Toba Health · ⌚ Relógio (v1.87)
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
 * - toba_health_watch_state (só deste aparelho): { pulledAt } = quando puxou.
 * ===================================================================== */
const WATCH_STATE_KEY = "toba_health_watch_state";
const WATCH_DEFAULT_GOALS = { steps: 8000, sleepMin: 450 };
const WATCH_STEP_GOALS = [5000, 6000, 8000, 10000, 12000, 15000];
const WATCH_SLEEP_GOALS = [360, 390, 420, 450, 480, 510];
const WATCH_FIRST_DAYS = 30;  // 1ª vez: o Health Connect só deixa ler ~30 dias antes da 1ª permissão
const WATCH_MAX_DAYS = 120;
const WATCH_AUTO_MIN = 10;    // puxa sozinho ao abrir/voltar se faz mais que isso
const WATCH_LIST_STEP = 14;

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

const watchUi = { chart: "steps", range: 7, listShown: WATCH_LIST_STEP, pulling: false, reqId: "", timer: null, status: null };

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
  watchSetState({ pulledAt: Date.now() });
  if (changed) saveHealthDb();
  renderWatch();
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
        else if (f === "ex") v = ex[date];
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
  return JSON.stringify(w.days) !== before;
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
  renderWatchConnect();
  renderWatchToday();
  renderWatchSleep();
  renderWatchCloba();
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
  const stat = (label, value, sub = "") => `<div class="toba-stat is-center">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      ${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}
    </div>`;
  el.innerHTML = `
    <div class="watch-hero">
      <div class="watch-ring-wrap">
        ${watchRing(steps, goal, done ? "var(--gold-2)" : "var(--green)")}
        <div class="watch-ring-text">
          <span class="watch-ring-num">${day.steps !== undefined ? watchInt(steps) : "--"}</span>
          <span class="watch-ring-label">👟 passos hoje</span>
          <span class="watch-ring-goal">${done ? "🏆 meta batida!" : `meta ${watchInt(goal)}`}</span>
        </div>
      </div>
    </div>
    <div class="toba-stats watch-stats">
      ${stat("🔥 Calorias", day.kcal !== undefined ? watchInt(day.kcal) : "--", "kcal no dia")}
      ${stat("⚡ Ativas", day.activeKcal !== undefined ? watchInt(day.activeKcal) : "--", "kcal mexendo")}
      ${stat("📏 Distância", day.distanceM !== undefined ? watchKm(day.distanceM) : "--")}
      ${stat("❤️ Coração", day.restHr !== undefined ? `${watchInt(day.restHr)}` : day.hrAvg !== undefined ? `${watchInt(day.hrAvg)}` : "--",
        day.restHr !== undefined ? "bpm em repouso" : "bpm médio")}
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
  el.innerHTML = `<div class="card-title">😴 Sono · ${escapeHtml(watchDayLabel(last.date).toLowerCase())}</div>
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

function renderWatchChart() {
  document.querySelectorAll("#watchChartTabs .period-btn").forEach((b) => b.classList.toggle("active", b.dataset.chart === watchUi.chart));
  document.querySelectorAll("#watchRangeTabs .period-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.range) === watchUi.range));
  const el = document.getElementById("watchChart");
  const rows = watchChartRows();
  const vals = rows.filter((r) => r.v !== null).map((r) => r.v);
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
    const label = n <= 7 ? watchWeekday(r.date) : (i % 5 === 4 || i === n - 1 ? r.date.slice(8, 10) : "");
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

function renderWatchList() {
  const el = document.getElementById("watchList");
  const dates = Object.keys(watchDays()).filter((d) => watchHasData(watchDay(d))).sort().reverse();
  if (!dates.length) {
    el.innerHTML = tobaEmpty("⌚", "Nada do relógio ainda", TOBA_NATIVE ? "Liga o Health Connect e toca no 🔄." : "Abre no app do Toba no celular.");
    return;
  }
  const goals = watchGoals();
  const shown = dates.slice(0, watchUi.listShown);
  el.innerHTML = shown.map((date) => {
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
  }).join("") + (dates.length > shown.length ? `<button type="button" class="btn btn-secondary" data-click="watchMore">Mostrar mais (${dates.length - shown.length})</button>` : "");
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
    watchUi.range = Number(el.dataset.range) === 30 ? 30 : 7;
    renderWatchChart();
  },
  watchMore() {
    watchUi.listShown += WATCH_LIST_STEP;
    renderWatchList();
  },
  openWatchDay,
  openWatchGoals,
  setWatchGoal,
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
