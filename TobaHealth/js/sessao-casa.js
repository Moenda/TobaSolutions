/* =====================================================================
 * Toba Health · 🏠 Treinos em casa ao vivo (desde v1.87)
 * Pedido do Rafa: uma seção "Treinos em casa" juntando o Saitama, o
 * alongamento e treinos novos sem equipamento (HIIT, Tabata, cardio sem
 * pulo, força e abdômen). Intervalos de trabalho/descanso com timer
 * redondo, voz, contagem 3-2-1 e bonequinho SVG que se mexe.
 *
 * Catálogo e planos moram em health-metrics.js (HOME_EXERCISES,
 * HOME_PLANS, buildHomeSteps): o mapa de calor das outras páginas usa.
 *
 * Usa a MESMA chave do treino ao vivo (TOBA_HEALTH_ACTIVE_SESSION) com
 * kind "home", exercises: [] e:
 *   liveSession.home = {
 *     plan: id do HOME_PLANS, step: índice em buildHomeSteps(plan),
 *     endsAt: ms (fim do passo atual; null = pausado), left: ms (pausado),
 *     pausedAt: ms|null, pausedMs: ms parados, done: { exerciseId: segundos },
 *     finished: bool, finishedAt: ms|null
 *   }
 * Tempos são horários (Date.now()): com a aba congelada o tique recupera
 * todos os passos que passaram. Ao salvar vira um treino "home" normal:
 *   { type: "home", title: "HIIT 10 min", durationMinutes, calories,
 *     home: { plan, done }, ... campos de número null }
 * Vale XP, sequência, conquistas e Hall como qualquer treino.
 *
 * Carregado DEPOIS de sessao.js / sessao-saitama.js / sessao-alongamento.js
 * e ANTES de treinos.js.
 * ===================================================================== */

const HOME_TYPE_TITLE = "Treino em casa";

const HOME_QUIPS = [
  "Sem academia, sem mensalidade, sem desculpa 😎",
  "Respira pela boca e solta a mandíbula: o dente agradece 🦷",
  "Cansou? Diminui o ritmo, mas não para.",
  "O tapete da sala nunca viu tanto suor.",
  "Killua e Gon tão te julgando do sofá 🐈",
  "Isso aqui é o que o Saitama fazia antes de ficar careca.",
  "Cada tiro conta. O XP tá vendo.",
  "Feio e feito é melhor que bonito e no sofá.",
];

/* ---------------------------------------------------------------------
 * Bonequinho de cada exercício (SVG à mão, 120 × 90, chão em y = 86).
 * Mesmo traço do alongamento (classes sf-*). Cada exercício tem 1 ou 2
 * poses (frames): no trabalho elas se alternam e o boneco "faz" o
 * movimento. hl = músculo que trabalha (laranja). key = pose das listas.
 * ------------------------------------------------------------------- */
const HOME_CHAIR = '<path d="M10 56 H36 M12 56 V86 M34 56 V86 M12 56 V28" class="sf-prop"/>';
const HOME_WALL = '<line x1="28" y1="2" x2="28" y2="86" class="sf-wall"/>';

const HOME_FIGURES = {
  polichinelo: { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 30, 52, 54], [60, 30, 68, 54]] },
    { head: [60, 10], base: [[60, 18, 60, 48], [60, 48, 44, 82], [60, 48, 76, 82]], hl: [[60, 26, 44, 6], [60, 26, 76, 6]] },
  ] },
  "polichinelo-passo": { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 30, 52, 54], [60, 30, 68, 54]] },
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 56, 86], [60, 52, 82, 84]], hl: [[60, 30, 44, 8], [60, 30, 76, 8]] },
  ] },
  agachamento: { key: 1, frames: [
    { head: [56, 14], base: [[56, 22, 56, 52], [56, 30, 78, 32], [56, 86, 66, 86]], hl: [[56, 52, 56, 86]] },
    { head: [58, 30], base: [[44, 62, 54, 38], [54, 40, 80, 42], [60, 86, 72, 86]], hl: [[44, 62, 66, 64, 60, 86]] },
  ] },
  "agachamento-salto": { key: 1, frames: [
    { head: [58, 30], base: [[44, 62, 54, 38], [54, 40, 80, 42], [60, 86, 72, 86]], hl: [[44, 62, 66, 64, 60, 86]] },
    { head: [56, 8], base: [[56, 16, 56, 44], [56, 22, 46, 2], [56, 22, 66, 2]], hl: [[56, 44, 58, 62, 56, 78, 64, 80]] },
  ] },
  flexao: { key: 0, frames: [
    { head: [94, 48], base: [[14, 84, 86, 52]], hl: [[86, 52, 86, 86]] },
    { head: [95, 70], base: [[14, 84, 86, 72]], hl: [[86, 72, 94, 78, 86, 86]] },
  ] },
  prancha: { key: 0, frames: [
    { head: [93, 61], base: [[14, 84, 84, 64], [84, 64, 84, 86, 102, 86]], hl: [[34, 78, 70, 68]] },
  ] },
  afundo: { key: 1, frames: [
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 30, 62, 52]], hl: [[58, 52, 58, 86]] },
    { head: [58, 18], base: [[58, 26, 58, 56], [58, 32, 62, 54]], hl: [[58, 56, 76, 66, 76, 86], [58, 56, 48, 82, 32, 84]] },
  ] },
  ponte: { key: 1, frames: [
    { head: [14, 80], base: [[22, 82, 56, 82], [26, 86, 48, 86]], hl: [[56, 82, 74, 64, 88, 84]] },
    { head: [14, 80], base: [[22, 82, 44, 71], [26, 86, 48, 86]], hl: [[44, 71, 58, 64, 78, 60, 88, 84]] },
  ] },
  abdominal: { key: 1, frames: [
    { head: [16, 78], base: [[23, 82, 58, 82], [58, 82, 74, 64, 88, 84], [30, 82, 40, 76]], hl: [[30, 82, 52, 82]] },
    { head: [30, 62], base: [[58, 82, 74, 64, 88, 84], [38, 68, 48, 74]], hl: [[58, 82, 36, 68]] },
  ] },
  bicicleta: { key: 0, frames: [
    { head: [28, 62], base: [[58, 80, 96, 78], [58, 80, 72, 62, 84, 66], [36, 68, 50, 62]], hl: [[58, 80, 36, 68]] },
    { head: [32, 63], base: [[58, 80, 98, 70], [58, 80, 74, 64, 90, 72], [38, 70, 54, 66]], hl: [[58, 80, 38, 70]] },
  ] },
  escalador: { key: 0, frames: [
    { head: [94, 48], base: [[46, 68, 86, 52], [46, 68, 14, 84], [86, 52, 86, 86]], hl: [[46, 68, 70, 66, 62, 82]] },
    { head: [94, 48], base: [[46, 68, 86, 52], [46, 68, 16, 86], [86, 52, 86, 86]], hl: [[46, 68, 60, 76, 50, 86]] },
  ] },
  skipping: { key: 0, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 58, 86], [60, 30, 70, 40, 74, 30], [60, 30, 52, 42, 48, 52]], hl: [[60, 52, 76, 52, 74, 72]] },
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 62, 86], [60, 30, 52, 40, 48, 30], [60, 30, 68, 42, 72, 52]], hl: [[60, 52, 74, 56, 70, 76]] },
  ] },
  burpee: { key: 1, frames: [
    { head: [94, 48], base: [[14, 84, 86, 52]], hl: [[86, 52, 86, 86]] },
    { head: [56, 8], base: [[56, 16, 56, 44], [56, 22, 46, 2], [56, 22, 66, 2]], hl: [[56, 44, 58, 62, 56, 78, 64, 80]] },
  ] },
  "mergulho-cadeira": { key: 1, frames: [
    { head: [36, 26], base: [[36, 34, 40, 60], [40, 60, 66, 62, 66, 86]], hl: [[36, 36, 32, 56]], extra: HOME_CHAIR },
    { head: [40, 42], base: [[40, 50, 42, 74], [42, 74, 66, 66, 66, 86]], hl: [[40, 52, 26, 48, 32, 56]], extra: HOME_CHAIR },
  ] },
  superman: { key: 1, frames: [
    { head: [92, 77], base: [[22, 84, 84, 84], [84, 84, 110, 84]], hl: [[46, 84, 80, 84]] },
    { head: [92, 64], base: [[18, 74, 52, 84], [84, 72, 108, 60]], hl: [[52, 84, 84, 72]] },
  ] },
  boxe: { key: 0, frames: [
    { head: [56, 14], base: [[56, 22, 56, 52], [56, 52, 46, 86], [56, 52, 68, 86], [56, 30, 64, 40, 62, 24]], hl: [[56, 30, 94, 28]] },
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 52, 48, 86], [58, 52, 70, 86], [58, 30, 50, 40, 56, 24]], hl: [[58, 30, 72, 38, 70, 22]] },
  ] },
  "panturrilha-pe": { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 60, 68], [60, 30, 64, 52], [60, 86, 72, 86]], hl: [[60, 68, 60, 86]] },
    { head: [60, 8], base: [[60, 16, 60, 46], [60, 46, 60, 62], [60, 24, 64, 46], [62, 80, 72, 86]], hl: [[60, 62, 62, 80]] },
  ] },
  "cadeira-parede": { key: 0, frames: [
    { head: [36, 22], base: [[36, 30, 36, 58], [64, 58, 64, 86, 74, 86], [36, 36, 50, 52]], hl: [[36, 58, 64, 58]], extra: HOME_WALL },
  ] },
};

function homeFrameSvg(frame, cls) {
  const lines = (list, kind) => (list || []).map((pts) => `<path d="${stretchPolyPath(pts)}" class="${kind}"/>`).join("");
  return `
        <g class="${cls}">
          ${frame.extra || ""}
          ${lines(frame.base, "sf-body")}
          ${lines(frame.hl, "sf-hl")}
          <circle cx="${frame.head[0]}" cy="${frame.head[1]}" r="7" class="sf-head"/>
        </g>`;
}

// size "lg": todas as poses (o CSS alterna no trabalho); "sm": só a pose key
function homeFigureSvg(exerciseId, { size = "lg" } = {}) {
  const fig = HOME_FIGURES[exerciseId] || HOME_FIGURES.agachamento;
  const name = getHomeExercise(exerciseId)?.name || HOME_TYPE_TITLE;
  const frames = size === "lg"
    ? fig.frames.map((frame, index) => homeFrameSvg(frame, `hf hf-${index}`)).join("")
    : homeFrameSvg(fig.frames[fig.key] || fig.frames[0], "hf");
  const moves = size === "lg" && fig.frames.length > 1 ? " is-moving" : "";
  return `
    <svg class="stretch-fig home-fig is-${size}${moves}" viewBox="0 0 120 90" role="img" aria-label="Bonequinho: ${escapeHtml(name)}">
      <line x1="2" y1="87" x2="118" y2="87" class="sf-floor"/>
      ${frames}
    </svg>`;
}

/* ---------------------------------------------------------------------
 * Estado
 * ------------------------------------------------------------------- */
function normalizeHomeLive(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const plan = getHomePlan(data.plan) ? data.plan : HOME_PLANS[0].id;
  const total = buildHomeSteps(plan).length;
  const done = {};
  if (data.done && typeof data.done === "object") {
    Object.entries(data.done).forEach(([id, secs]) => {
      if (getHomeExercise(id) && Number(secs) > 0) done[id] = Math.round(Number(secs));
    });
  }
  return {
    plan,
    step: Math.min(Math.max(0, Math.round(Number(data.step) || 0)), Math.max(0, total - 1)),
    endsAt: Number(data.endsAt) || null,
    left: Math.max(0, Number(data.left) || 0),
    pausedAt: Number(data.pausedAt) || null,
    pausedMs: Math.max(0, Number(data.pausedMs) || 0),
    done,
    finished: Boolean(data.finished),
    finishedAt: Number(data.finishedAt) || null,
  };
}

function homeSteps(session = liveSession) {
  return buildHomeSteps(session?.home?.plan || "");
}

function homeWorkSeconds(data) {
  return Object.values(data.done || {}).reduce((sum, secs) => sum + (Number(secs) || 0), 0);
}

function homeMovingMs(session, now = Date.now()) {
  const data = session.home;
  const paused = data.pausedAt ? now - data.pausedAt : 0;
  const end = data.finished && data.finishedAt ? data.finishedAt : now;
  return Math.max(0, end - session.startedAt - data.pausedMs - (data.finished ? 0 : paused));
}

function homeRemainingSeconds(session, now = Date.now()) {
  const data = session.home;
  if (data.finished) return 0;
  const steps = homeSteps(session);
  const current = data.endsAt ? Math.max(0, data.endsAt - now) : data.left;
  const after = steps.slice(data.step + 1).reduce((sum, step) => sum + step.secs, 0);
  return Math.round(current / 1000) + after;
}

// "5/10 tiros · rolando" (aviso de treino em andamento)
function describeHomeLive(session) {
  const data = session.home;
  const steps = homeSteps(session);
  const works = steps.filter((step) => step.kind === "work").length;
  const done = steps.slice(0, data.step).filter((step) => step.kind === "work").length;
  const plan = getHomePlan(data.plan);
  if (data.finished) return `${plan?.short || ""} completo, falta salvar`;
  return `${done}/${works} tiros · ${data.endsAt ? "rolando" : "⏸ pausado"}`;
}

function readHomePrefs() {
  const prefs = readLivePrefs();
  return { voice: prefs.homeVoice !== false };
}

/* ---------------------------------------------------------------------
 * Voz e vibração (no APK 1.6+ a voz é a nativa: fala com a tela apagada)
 * ------------------------------------------------------------------- */
function homeSpeak(text) {
  if (!readHomePrefs().voice || !text) return;
  try {
    if (TOBA_NATIVE && typeof TOBA_NATIVE.speak === "function") {
      TOBA_NATIVE.speak(String(text), true);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const say = new SpeechSynthesisUtterance(String(text));
    say.lang = "pt-BR";
    say.rate = 1.05;
    window.speechSynthesis.speak(say);
  } catch (err) {
    /* sem voz: segue só com a vibração */
  }
}

function homeAnnounce(step, steps) {
  if (!step) return;
  const exercise = getHomeExercise(step.exerciseId);
  const name = exercise?.name || "";
  if (step.kind === "prep") {
    liveBuzz(120);
    homeSpeak(`Prepara. Primeiro: ${name}`);
  } else if (step.kind === "rest") {
    liveBuzz([80, 60, 80]);
    const index = steps.indexOf(step);
    const prev = steps[index - 1];
    const newRound = prev && step.round > prev.round;
    homeSpeak(`${newRound ? `Fim da volta ${prev.round}. ` : ""}Descansa. Próximo: ${name}`);
  } else {
    liveBuzz([200]);
    homeSpeak(`Vai! ${name}`);
  }
}

// 3-2-1 falado no fim do Prepara e do descanso (uma vez por passo)
let homeCountdownKey = "";
function homeCountdown(session, step, leftMs) {
  if (!step || step.kind === "work" || !session.home.endsAt) return;
  if (leftMs > 3200 || leftMs < 600) return;
  const key = `${session.id}:${session.home.step}`;
  if (homeCountdownKey === key) return;
  homeCountdownKey = key;
  liveBuzz(60);
  homeSpeak("3, 2, 1");
}

/* ---------------------------------------------------------------------
 * 🏠 Seção "Treinos em casa" do ▶ Iniciar treino (Saitama + alongamento
 * + os planos novos). O Saitama e o alongamento continuam nos arquivos
 * deles: aqui só os botões.
 * ------------------------------------------------------------------- */
function homeMenuButton({ click, attrs = "", icon, title, desc }) {
  return `
      <button type="button" class="toba-menu-btn" data-click="${click}"${attrs}>
        <span class="toba-menu-icon">${icon}</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">${escapeHtml(title)}</span>
          <span class="toba-menu-desc">${escapeHtml(desc)}</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>`;
}

function homePlanButton(plan) {
  const count = (healthDb.workouts || []).filter((workout) => workout.type === "home" && workout.home?.plan === plan.id).length;
  const minutes = Math.round(getHomePlanSeconds(plan.id) / 60);
  return homeMenuButton({
    click: "startHomeLive",
    attrs: ` data-plan="${plan.id}"`,
    icon: plan.icon,
    title: plan.name,
    desc: `${plan.desc} ~${minutes} min${count ? ` · feito ${count}×` : ""}`,
  });
}

function renderHomeLiveStartSection() {
  const workouts = healthDb.workouts || [];
  const saitamaCount = workouts.filter((workout) => workout.type === "saitama").length;
  const count = (type) => workouts.filter((workout) => workout.type === type).length;
  const total = count("home") + count("stretch") + saitamaCount;
  const plans = (ids) => HOME_PLANS.filter((plan) => ids.includes(plan.cat || "")).map(homePlanButton).join("");
  const stretch = STRETCH_PLANS.map((plan) => homeMenuButton({
    click: "startStretchLive",
    attrs: ` data-plan="${plan.id}"`,
    icon: plan.icon,
    title: plan.name,
    desc: plan.desc,
  })).join("");
  return `
    <div class="home-section">
      <div class="home-section-head">
        <span class="home-section-title">🏠 Treinos em casa</span>
        <span class="home-section-sub">Sem equipamento, no tapete da sala${total ? ` · feito ${total}×` : ""}</span>
      </div>
      <div class="hub-title">🔥 HIIT e cardio</div>
      <div class="toba-menu">${plans(["cardio"])}</div>
      <div class="hub-title">💪 Força e abdômen</div>
      <div class="toba-menu">
        ${plans(["forca"])}
        ${homeMenuButton({ click: "startSaitamaLive", icon: "👊", title: "Treino do Saitama", desc: `Flexão, abdominal e agachamento no contador${saitamaCount ? ` · feito ${saitamaCount}×` : ""}` })}
      </div>
      <div class="hub-title">🧘 Alongamento${count("stretch") ? ` · feito ${count("stretch")}×` : ""}</div>
      <div class="toba-menu">${stretch}</div>
    </div>
    <div class="section-divider"></div>`;
}

// Atalho "🏠 Em casa" da tela de Treinos: folha só com a seção.
// Treino em andamento? Volta pra ele (igual o ▶ Iniciar treino).
function openHomeStart() {
  const { session } = readLiveSession();
  if (session) {
    liveSession = session;
    openLiveSessionView();
    return;
  }
  document.getElementById("homeStartList").innerHTML = renderHomeLiveStartSection();
  openTobaModal("homeStartModal");
}

/* ---------------------------------------------------------------------
 * Começar
 * ------------------------------------------------------------------- */
function startHomeLive(planId) {
  const plan = getHomePlan(planId) || HOME_PLANS[0];
  const steps = buildHomeSteps(plan.id);
  if (!steps.length) return;
  const now = Date.now();
  liveSession = {
    v: 1,
    id: `s-${now}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "home",
    startedAt: now,
    date: toIsoDate(),
    routineId: "",
    title: plan.name,
    current: 0,
    exercises: [],
    home: normalizeHomeLive({ plan: plan.id, step: 0, endsAt: now + steps[0].secs * 1000 }),
    rest: { duration: LIVE_REST_DEFAULT, startedAt: null, endsAt: null, alerted: false },
    restDefault: LIVE_REST_DEFAULT,
    updatedAt: now,
  };
  homeCountdownKey = "";
  storeLiveSession();
  closeTobaModal("liveStartModal");
  closeTobaModal("workoutModal");
  openLiveSessionView();
  homeAnnounce(steps[0], steps);
}

/* ---------------------------------------------------------------------
 * Tique: avança os passos que já passaram (mesmo com a aba congelada)
 * ------------------------------------------------------------------- */
function homeCredit(data, step, secs) {
  if (!step || step.kind !== "work" || !(secs > 0)) return;
  data.done[step.exerciseId] = Math.round((data.done[step.exerciseId] || 0) + secs);
}

function homeTick(now = Date.now()) {
  const data = liveSession?.home;
  if (!data || data.finished || !data.endsAt) {
    updateHomeClock(now);
    return;
  }
  const steps = homeSteps();
  let moved = false;
  while (data.endsAt && now >= data.endsAt && !data.finished) {
    const step = steps[data.step];
    homeCredit(data, step, step.secs);
    if (data.step >= steps.length - 1) {
      data.finished = true;
      data.finishedAt = data.endsAt;
      data.endsAt = null;
    } else {
      data.step += 1;
      data.endsAt += steps[data.step].secs * 1000;
    }
    moved = true;
  }
  if (moved) {
    storeLiveSession();
    if (data.finished) {
      liveBuzz([200, 100, 200, 100, 400]);
      homeSpeak("Acabou! Treino completo. Salva aí no Toba.");
    } else if (now - (data.endsAt - steps[data.step].secs * 1000) < 2500) {
      homeAnnounce(steps[data.step], steps); // só avisa o passo de agora, não os que passaram no bolso
    }
    renderLiveSession();
    return;
  }
  updateHomeClock(now);
}

// Só textos e anel (roda a cada 250 ms)
function updateHomeClock(now = Date.now()) {
  const session = liveSession;
  const data = session?.home;
  if (!data) return;
  const clock = document.getElementById("liveClock");
  if (clock) clock.textContent = formatLiveClock(homeMovingMs(session, now));
  if (data.finished) return;
  const step = homeSteps(session)[data.step];
  const leftMs = data.endsAt ? Math.max(0, data.endsAt - now) : data.left;
  const time = document.getElementById("homeTime");
  if (time) time.textContent = String(Math.ceil(leftMs / 1000));
  const ring = document.getElementById("homeRing");
  if (ring && step) {
    const fraction = Math.min(1, Math.max(0, leftMs / (step.secs * 1000)));
    ring.style.strokeDashoffset = (LIVE_RING * (1 - fraction)).toFixed(1);
  }
  const remaining = document.getElementById("homeRemaining");
  if (remaining) remaining.textContent = `faltam ${formatLiveClock(homeRemainingSeconds(session, now) * 1000)}`;
  homeCountdown(session, step, leftMs);
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderHomeLive(session) {
  const data = session.home;
  const plan = getHomePlan(data.plan);
  const steps = homeSteps(session);
  const works = steps.filter((step) => step.kind === "work");
  const doneWorks = steps.slice(0, data.step).filter((step) => step.kind === "work").length;
  const percent = data.finished ? 100 : Math.round((doneWorks / Math.max(1, works.length)) * 100);
  const top = `
    <div class="live-top">
      <div class="live-top-text">
        <span class="live-badge">● AO VIVO</span>
        <strong class="live-title">${plan?.icon || "🏠"} ${escapeHtml(session.title)}</strong>
      </div>
      <div class="live-clock" id="liveClock" role="timer" aria-label="Tempo de treino">${formatLiveClock(homeMovingMs(session))}</div>
    </div>
    <div class="live-progress">
      <div class="live-progress-bar"><span style="width: ${percent}%"></span></div>
      <span class="live-progress-text">${data.finished ? works.length : Math.min(doneWorks + 1, works.length)}/${works.length} tiros · <span id="homeRemaining">faltam ${formatLiveClock(homeRemainingSeconds(session) * 1000)}</span></span>
    </div>`;

  if (data.finished) return top + renderHomeDone(session);

  const step = steps[data.step];
  const exercise = getHomeExercise(step.exerciseId);
  const paused = !data.endsAt;
  const phase = step.kind === "work" ? "is-work" : step.kind === "rest" ? "is-rest" : "is-prep";
  const phaseText = paused ? "⏸ Pausado" : step.kind === "work" ? "🔥 Vai!" : step.kind === "rest" ? "😮‍💨 Descansa" : "Prepara...";
  const roundText = plan && plan.rounds > 1 ? `<span class="stretch-side">Volta ${step.round}/${plan.rounds}</span>` : "";
  const nextWork = steps.slice(data.step + 1).find((item) => item.kind === "work" && step.kind === "work");
  const nextExercise = nextWork ? getHomeExercise(nextWork.exerciseId) : null;
  const quip = HOME_QUIPS[(data.step + session.startedAt) % HOME_QUIPS.length];

  return `${top}
    <div class="stretch-stage home-stage ${phase}${paused ? " is-paused" : ""}">
      <div class="stretch-phase">${phaseText} ${roundText}</div>
      ${homeFigureSvg(step.exerciseId, { size: "lg" })}
      <div class="stretch-name">${step.kind === "work" ? "" : "<small>Próximo</small> "}${escapeHtml(exercise?.name || "")}</div>
      <div class="stretch-timer">
        <div class="stretch-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="live-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="live-ring-fg stretch-ring-fg" id="homeRing" cx="60" cy="60" r="52" stroke-dasharray="${LIVE_RING.toFixed(1)}"></circle>
          </svg>
          <strong class="stretch-time" id="homeTime" role="timer">${Math.ceil((data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left) / 1000)}</strong>
        </div>
        <p class="stretch-how">${escapeHtml(exercise?.how || "")}</p>
      </div>
      ${exercise?.tip ? `<p class="stretch-tip">💡 ${escapeHtml(exercise.tip)}</p>` : ""}
    </div>

    <div class="stretch-controls">
      <button type="button" class="btn btn-secondary" data-click="homeBack" aria-label="Voltar um exercício">‹ Voltar</button>
      <button type="button" class="btn ${paused ? "btn-primary" : "btn-secondary"}" data-click="homeTogglePause">${paused ? "▶ Continuar" : "⏸ Pausar"}</button>
      <button type="button" class="btn btn-secondary" data-click="homeSkip" aria-label="Pular">Pular ⏭</button>
    </div>

    ${nextExercise ? `
      <div class="stretch-next">
        ${homeFigureSvg(nextWork.exerciseId, { size: "sm" })}
        <span><small>Depois</small><strong>${escapeHtml(nextExercise.name)}</strong></span>
      </div>` : ""}

    <p class="live-hint stretch-quip">${escapeHtml(quip)}</p>

    <div class="live-footer">
      <label class="live-check">
        <input type="checkbox" data-change="homeToggleVoice"${readHomePrefs().voice ? " checked" : ""} />
        <span>🔊 Voz avisando a troca e o 3-2-1 (dá pra fazer sem olhar a tela)</span>
      </label>
      ${renderLiveAwakeToggle()}
      <button type="button" class="btn btn-primary live-finish" data-click="homeFinishNow">🏁 Terminar agora</button>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Cancelar treino</button>
    </div>`;
}

// Fim: resumo + salvar ali mesmo (sem folha por cima)
function renderHomeDone(session) {
  const data = session.home;
  const workSecs = homeWorkSeconds(data);
  const minutes = Math.max(1, Math.round(homeMovingMs(session) / 60000));
  const kcal = estimateHomeKcal(data.plan, minutes, session.date);
  const done = Object.keys(data.done);
  const figures = done.slice(0, 18).map((id) => `<span class="stretch-done-fig" title="${escapeHtml(getHomeExercise(id)?.name || id)}">${homeFigureSvg(id, { size: "sm" })}</span>`).join("");
  return `
    <div class="stretch-done home-done">
      <div class="stretch-done-title">🏆 Academia na sala: aprovada!</div>
      <p class="toba-sheet-text">${done.length} ${done.length === 1 ? "exercício" : "exercícios"} · ${formatLiveClock(workSecs * 1000)} no pau · ${minutes} min no total. Vale XP, sequência, troféu e pinta o mapa de calor 🔥</p>
      ${figures ? `<div class="stretch-done-figs">${figures}</div>` : ""}
      <form data-submit="saveHomeLive">
        <div class="grid-2">
          <div class="form-group">
            <label for="home-calories">Calorias (kcal)</label>
            <input id="home-calories" class="form-control" type="number" inputmode="numeric" min="0" step="1" value="${kcal || ""}" />
          </div>
          <div class="form-group">
            <label for="home-minutes">Tempo (min)</label>
            <input id="home-minutes" class="form-control" type="number" inputmode="numeric" min="1" step="1" value="${minutes}" />
          </div>
        </div>
        <div class="form-group">
          <label for="home-notes">Observações (opcional)</label>
          <input id="home-notes" class="form-control" type="text" maxlength="160" placeholder="Morreu ou sobreviveu?" />
        </div>
        <button type="submit" class="btn btn-primary live-finish">Salvar treino 🏠</button>
      </form>
      <p class="live-hint">Dica do Cloba: emenda um 🧘 alongamento de 10 min depois (▶ Iniciar treino › 🏠 › Alongamento).</p>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Jogar fora</button>
    </div>`;
}

function estimateHomeKcal(planId, minutes, date) {
  const plan = getHomePlan(planId);
  const met = plan?.met || 6;
  const kg = typeof getBodyWeightOn === "function" ? getBodyWeightOn(date) : 75;
  return Math.round(met * (Number(kg) || 75) * (minutes / 60));
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
function homeLeftMs(data) {
  return data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left;
}

function homeTogglePause() {
  const data = liveSession?.home;
  if (!data || data.finished) return;
  const now = Date.now();
  if (data.endsAt) {
    data.left = Math.max(0, data.endsAt - now);
    data.endsAt = null;
    data.pausedAt = now;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } else {
    data.endsAt = now + data.left;
    if (data.pausedAt) data.pausedMs += now - data.pausedAt;
    data.pausedAt = null;
  }
  storeLiveSession();
  renderLiveSession();
}

// Vai pro passo `index` mantendo pausado/rodando
function homeGoTo(index) {
  const data = liveSession.home;
  const steps = homeSteps();
  data.step = Math.min(Math.max(0, index), steps.length - 1);
  const ms = steps[data.step].secs * 1000;
  if (data.endsAt) data.endsAt = Date.now() + ms;
  else data.left = ms;
  homeCountdownKey = "";
  storeLiveSession();
  renderLiveSession();
  if (data.endsAt) homeAnnounce(steps[data.step], steps);
}

// Pular: o que já fez do tiro vale; vai pro próximo passo
function homeSkip() {
  const data = liveSession?.home;
  if (!data || data.finished) return;
  const steps = homeSteps();
  const step = steps[data.step];
  homeCredit(data, step, Math.floor((step.secs * 1000 - homeLeftMs(data)) / 1000));
  if (data.step >= steps.length - 1) {
    homeFinishNow();
    return;
  }
  homeGoTo(data.step + 1);
}

// Voltar: no tiro há mais de 3 s recomeça ele; senão volta pro tiro anterior
function homeBack() {
  const data = liveSession?.home;
  if (!data || data.finished) return;
  const steps = homeSteps();
  const step = steps[data.step];
  const into = step.secs * 1000 - homeLeftMs(data);
  if (step.kind === "work" && into > 3000) {
    homeGoTo(data.step);
    return;
  }
  let target = -1;
  for (let i = data.step - 1; i >= 0; i -= 1) {
    if (steps[i].kind === "work") {
      target = i;
      break;
    }
  }
  homeGoTo(target >= 0 ? target : 0);
}

function homeFinishNow() {
  const data = liveSession?.home;
  if (!data) return;
  if (!data.finished) {
    const steps = homeSteps();
    const step = steps[data.step];
    if (step) homeCredit(data, step, Math.floor((step.secs * 1000 - homeLeftMs(data)) / 1000));
    if (data.pausedAt) data.pausedMs += Date.now() - data.pausedAt;
    data.pausedAt = null;
    data.finished = true;
    data.finishedAt = Date.now();
    data.endsAt = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  storeLiveSession();
  renderLiveSession();
  window.scrollTo(0, 0);
}

function homeToggleVoice(el) {
  storeLivePrefs({ homeVoice: el.checked });
  tobaToast(el.checked ? "🔊 O Toba avisa cada troca" : "🔇 Só vibração");
}

function saveHomeLive() {
  if (!liveSession?.home) return;
  if (!isHealthDbLoaded) {
    showHealthDbLockedMessage();
    return;
  }
  const data = liveSession.home;
  if (!homeWorkSeconds(data)) {
    showPageMessage("Nenhum tiro feito ainda. Se quiser jogar fora, use Jogar fora.", { title: "Nada pra salvar" });
    return;
  }
  const plan = getHomePlan(data.plan);
  const minutes = Number(document.getElementById("home-minutes").value);
  const calories = Number(document.getElementById("home-calories").value);
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "home",
    title: plan ? plan.name : HOME_TYPE_TITLE,
    date: liveSession.date,
    durationMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : Math.max(1, Math.round(homeMovingMs(liveSession) / 60000)),
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    distanceKm: null,
    pushups: null,
    situps: null,
    squats: null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: document.getElementById("home-notes").value.trim(),
    home: { plan: data.plan, done: { ...data.done } },
  };
  healthDb.workouts.push(workout);
  saveHealthDb();
  let saved = false;
  try {
    saved = (localStorage.getItem(HEALTH_KEY) || "").includes(`"${workout.id}"`);
  } catch (err) {
    saved = false;
  }
  if (!saved) {
    healthDb.workouts = healthDb.workouts.filter((item) => item.id !== workout.id);
    return;
  }
  dropLiveSession();
  stopLiveTicker();
  tobaPlayerCheck({ reason: "Treino em casa no histórico 🏠" });
  openModule("viewTraining");
  openWorkoutView(workout.id);
  tobaToast("🏠 Treino em casa no histórico!");
}

/* ---------------------------------------------------------------------
 * Página do treino: os exercícios feitos, com o bonequinho
 * ------------------------------------------------------------------- */
function renderHomeWorkoutDetail(workout) {
  if (workout.type !== "home") return "";
  const done = getHomeDone(workout);
  const items = Object.entries(done)
    .filter(([id, secs]) => Number(secs) > 0 && getHomeExercise(id))
    .map(([id, secs]) => `
      <div class="stretch-row">
        ${homeFigureSvg(id, { size: "sm" })}
        <span class="stretch-row-text"><strong>${escapeHtml(getHomeExercise(id).name)}</strong><small>${formatLiveSeconds(secs)} no pau</small></span>
      </div>`).join("");
  if (!items) return "";
  const live = workout.home && workout.home.done ? "" : '<p class="live-hint">Anotado na mão: mostra o plano inteiro.</p>';
  return `<div class="section-title">🏠 Exercícios</div><div class="card stretch-list">${items}${live}</div>`;
}

/* ---------------------------------------------------------------------
 * Formulário "anotar treino em casa" (+ Treino › 🏠 Treino em casa)
 * ------------------------------------------------------------------- */
function renderHomeFormFields() {
  return `
    <div class="hub-title">Fazer agora, com timer e bonequinho</div>
    <div class="stretch-form-start home-form-start">
      ${HOME_PLANS.map((plan) => `<button type="button" class="btn btn-primary" data-click="startHomeLive" data-plan="${plan.id}">${plan.icon} ${escapeHtml(plan.short)}</button>`).join("")}
    </div>
    <div class="walk-or">ou anota um que já fez 👇</div>
    <div class="form-group">
      <label for="workout-home-plan">Qual</label>
      <select id="workout-home-plan" class="form-control">
        ${HOME_PLANS.map((plan) => `<option value="${plan.id}">${plan.icon} ${escapeHtml(plan.name)}</option>`).join("")}
        <option value="">Outro treino em casa</option>
      </select>
    </div>
    <div class="form-group">
      <label for="workout-date">Data</label>
      <input id="workout-date" class="form-control" type="date" required value="${toIsoDate()}" />
    </div>
    <div class="grid-2">
      ${workoutNumberField("durationMinutes", "Tempo (min)", "1")}
      ${workoutNumberField("calories", "Calorias (kcal)", "1")}
    </div>
    <div class="form-group">
      <label for="workout-notes">Observações (opcional)</label>
      <input id="workout-notes" class="form-control" type="text" maxlength="160" placeholder="Morreu ou sobreviveu?" />
    </div>`;
}

function fillHomeForm(workout) {
  const select = document.getElementById("workout-home-plan");
  if (select) select.value = getHomePlan(workout.home?.plan) ? workout.home.plan : "";
  const notes = document.getElementById("workout-notes");
  if (notes) notes.value = workout.notes || "";
  const start = document.querySelector(".home-form-start");
  if (start) start.hidden = true;
  start?.previousElementSibling?.setAttribute("hidden", "");
  const or = start?.nextElementSibling;
  if (or) or.hidden = true;
}

// title + home do salvar do formulário (mantém os segundos do ao vivo)
function readHomeFormExtras(original) {
  const planId = document.getElementById("workout-home-plan")?.value || "";
  const plan = getHomePlan(planId);
  const home = { ...(original && original.home && typeof original.home === "object" ? original.home : {}), plan: plan ? plan.id : "" };
  if (original?.home?.plan !== home.plan) delete home.done; // trocou o plano: os segundos de antes não valem
  return { title: plan ? plan.name : HOME_TYPE_TITLE, home };
}

tobaActions({
  startHomeLive: (el) => startHomeLive(el.dataset.plan),
  openHomeStart,
  homeTogglePause,
  homeSkip,
  homeBack,
  homeFinishNow,
  homeToggleVoice,
  saveHomeLive,
});
