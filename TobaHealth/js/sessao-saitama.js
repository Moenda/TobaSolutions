/* =====================================================================
 * Toba Health · Treino do Saitama ao vivo (desde v1.36)
 * Contador de bolso: sem ordem fixa, cada toque no quadrado soma o passo
 * escolhido (+1, +5, +10, +20) e, se o "Descanso automático" estiver
 * ligado, já dispara o mesmo timer de descanso do treino de força.
 *
 * Usa a MESMA chave e as mesmas peças do sessao.js (cronômetro, descanso,
 * tela acesa, retomada se o app fechar), com kind "saitama":
 *   liveSession.saitama = {
 *     pushups, situps, squats: total do dia (n >= 0),
 *     step: passo atual, autoRest: bool,
 *     log: [{ field: "pushups"|"situps"|"squats", n, at: ms }]  (para o ↩)
 *   }
 * Ao finalizar vira um treino "saitama" normal em healthDb.workouts (mesmo
 * formato do formulário: pushups/situps/squats/distanceKm/durationMinutes/
 * calories/notes) e a chave é apagada. Nada novo no banco.
 *
 * Carregado DEPOIS de sessao.js e ANTES de treinos.js.
 * ===================================================================== */

const SAITAMA_LIVE_FIELDS = [
  { field: "pushups", name: "Flexão", plural: "flexões", icon: "💪" },
  { field: "situps", name: "Abdominal", plural: "abdominais", icon: "🔥" },
  { field: "squats", name: "Agachamento", plural: "agachamentos", icon: "🦵" },
];
const SAITAMA_LIVE_STEPS = [1, 5, 10, 20];
const SAITAMA_LIVE_GOAL = 100; // por exercício, por dia (o careca fazia isso)
const SAITAMA_LIVE_REST = 60;
const SAITAMA_LIVE_TITLE = "Treino lendário do Mestre Saitama";

const SAITAMA_LIVE_QUIPS = {
  resting: [
    "Respira. O Saitama ficou careca, você só vai ficar cansado.",
    "100 flexões não se fazem rolando o feed.",
    "Descanso de herói é curto. Herói de reels descansa pra sempre.",
    "Hidrata aí. O careca não treinava com dopamina.",
    "O chão tá te esperando. Ele é paciente, o feed não.",
    "Celular no bolso, mão no chão daqui a pouco.",
    "Nenhum monstro foi derrotado no Instagram.",
    "Esse descanso é pro braço, não pro polegar.",
    "Rolar a tela não conta como abdominal.",
    "O careca não tinha TikTok. Coincidência? Acho que não.",
  ],
  done: [
    "Acabou o descanso! Bora pra próxima leva 👊",
    "Tempo! O chão não vai se empurrar sozinho.",
    "Fim do recreio, herói. Próxima leva!",
    "Bora! Os 100 não vão se fazer sozinhos.",
    "Levanta daí. O sofá não é base de herói.",
  ],
  late: [
    "O descanso acabou. O feed, pelo visto, não.",
    "Assim o cabelo não cai nunca. Bora!",
    "Cada segundo aqui é um monstro que escapa.",
    "Isso já virou intervalo comercial.",
  ],
  back: [
    "Te peguei no reels, né? 👀",
    "Foi só uma olhadinha no Instagram, né? Sei…",
    "Voltou! O algoritmo quase te levou, herói.",
  ],
  backLate: [
    "O descanso acabou faz {s}. O careca tá decepcionado.",
    "Te peguei no reels, né? 👀 Acabou faz {s}.",
    "{s} de descanso extra, patrocinados pelo feed.",
  ],
};

function clampSaitamaCount(value) {
  return Math.min(100000, Math.max(0, Math.round(Number(value) || 0)));
}

function normalizeSaitamaLive(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const fields = SAITAMA_LIVE_FIELDS.map((item) => item.field);
  const step = Number(data.step);
  return {
    pushups: clampSaitamaCount(data.pushups),
    situps: clampSaitamaCount(data.situps),
    squats: clampSaitamaCount(data.squats),
    step: SAITAMA_LIVE_STEPS.includes(step) ? step : 10,
    autoRest: data.autoRest !== false,
    log: (Array.isArray(data.log) ? data.log : [])
      .filter((entry) => entry && fields.includes(entry.field) && Number(entry.n) > 0)
      .map((entry) => ({ field: entry.field, n: Math.round(Number(entry.n)), at: Number(entry.at) || 0 })),
  };
}

function getSaitamaLiveTotal(data) {
  return SAITAMA_LIVE_FIELDS.reduce((sum, item) => sum + data[item.field], 0);
}

// "40 flex · 20 abd · 60 agach" (aviso de treino em andamento)
function describeSaitamaLive(data) {
  const total = getSaitamaLiveTotal(data);
  if (!total) return "nenhuma rep ainda";
  return `${formatWorkoutNumber(data.pushups, 0)} flex · ${formatWorkoutNumber(data.situps, 0)} abd · ${formatWorkoutNumber(data.squats, 0)} agach`;
}

/* ---------------------------------------------------------------------
 * Começar
 * ------------------------------------------------------------------- */
function renderSaitamaLiveStartCard() {
  const count = (healthDb.workouts || []).filter((workout) => workout.type === "saitama").length;
  return `
    <div class="hub-title">Peso do corpo</div>
    <div class="toba-menu">
      <button type="button" class="toba-menu-btn live-saitama-btn" data-click="startSaitamaLive">
        <span class="toba-menu-icon">👊</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Treino do Saitama</span>
          <span class="toba-menu-desc">Flexão, abdominal e agachamento no contador · feito ${count}×</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
    </div>
    <div class="section-divider"></div>`;
}

function startSaitamaLive() {
  const prefs = readLivePrefs();
  const now = Date.now();
  const rest = Number(prefs.saitamaRest) > 0 ? Number(prefs.saitamaRest) : SAITAMA_LIVE_REST;
  liveSession = {
    v: 1,
    id: `s-${now}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "saitama",
    startedAt: now,
    date: toIsoDate(),
    routineId: "",
    title: "Treino do Saitama",
    current: 0,
    exercises: [],
    saitama: normalizeSaitamaLive({ step: Number(prefs.saitamaStep), autoRest: prefs.saitamaAutoRest !== false }),
    rest: { duration: rest, startedAt: null, endsAt: null, alerted: false },
    restDefault: rest,
    updatedAt: now,
  };
  liveFocus = null;
  liveQuip = "";
  storeLiveSession();
  closeTobaModal("liveStartModal");
  openLiveSessionView();
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function formatSaitamaLiveTime(ms) {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function renderSaitamaLive(session) {
  const data = session.saitama;
  const total = getSaitamaLiveTotal(data);
  const goal = SAITAMA_LIVE_GOAL * SAITAMA_LIVE_FIELDS.length;
  const percent = Math.min(100, Math.round((total / goal) * 100));

  const tiles = SAITAMA_LIVE_FIELDS.map((item) => {
    const value = data[item.field];
    const width = Math.min(100, Math.round((value / SAITAMA_LIVE_GOAL) * 100));
    const done = value >= SAITAMA_LIVE_GOAL;
    return `
      <button type="button" class="saitama-tile${done ? " is-done" : ""}" data-click="saitamaLiveAdd" data-field="${item.field}" aria-label="${item.name}: ${value} feitas. Tocar soma ${data.step}">
        <span class="saitama-tile-name">${item.icon} ${item.name}</span>
        <strong class="saitama-tile-value">${formatWorkoutNumber(value, 0)}</strong>
        <span class="saitama-tile-goal">${done ? "💯 careca aprova" : `de ${SAITAMA_LIVE_GOAL}`}</span>
        <span class="saitama-tile-bar"><span style="width: ${width}%"></span></span>
        <span class="saitama-tile-add">+${data.step}</span>
      </button>`;
  }).join("");

  const steps = SAITAMA_LIVE_STEPS.map((step) => `
    <button type="button" class="live-chip${data.step === step ? " active" : ""}" data-click="saitamaLiveStep" data-step="${step}" aria-label="Somar ${step} por toque">+${step}</button>`).join("");

  const recent = data.log.slice(-6).reverse().map((entry) => {
    const item = SAITAMA_LIVE_FIELDS.find((field) => field.field === entry.field);
    return `
      <li class="saitama-log-item">
        <span>${item.icon} ${item.name} <strong>+${entry.n}</strong></span>
        <span class="saitama-log-time">${entry.at ? formatSaitamaLiveTime(entry.at) : ""}</span>
      </li>`;
  }).join("");
  const older = data.log.length - 6;

  return `
    <div class="live-top">
      <div class="live-top-text">
        <span class="live-badge">● AO VIVO</span>
        <strong class="live-title">👊 ${escapeHtml(session.title)}</strong>
      </div>
      <div class="live-clock" id="liveClock" role="timer" aria-label="Tempo de treino">${formatLiveClock(Date.now() - session.startedAt)}</div>
    </div>
    <div class="live-progress">
      <div class="live-progress-bar"><span style="width: ${percent}%"></span></div>
      <span class="live-progress-text">${formatWorkoutNumber(total, 0)}/${goal} reps do careca hoje</span>
    </div>

    <div class="saitama-tiles">${tiles}</div>

    <div class="saitama-steps">
      <span class="saitama-steps-label">Cada toque soma</span>
      <div class="saitama-steps-row">${steps}</div>
    </div>

    <div class="btn-row saitama-actions">
      <button type="button" class="btn btn-secondary" data-click="saitamaLiveUndo"${data.log.length ? "" : " disabled"}>↩ Desfazer</button>
      <button type="button" class="btn btn-secondary" data-click="saitamaLiveRestNow">⏱ Descansar</button>
    </div>

    <label class="live-check saitama-autorest">
      <input type="checkbox" data-change="saitamaLiveAutoRest"${data.autoRest ? " checked" : ""} />
      <span>⏱ Descanso automático a cada toque</span>
    </label>

    <div class="saitama-log">
      <div class="hub-title">Hoje no treino</div>
      ${recent
        ? `<ul class="saitama-log-list">${recent}</ul>${older > 0 ? `<p class="live-hint">e mais ${older} ${older === 1 ? "leva" : "levas"} antes</p>` : ""}`
        : '<p class="live-hint">Nada ainda. Faz umas flexões e toca no quadrado 👊</p>'}
    </div>

    <div class="live-footer">
      ${renderLiveAwakeToggle()}
      <button type="button" class="btn btn-primary live-finish" data-click="openLiveFinish">🏁 Finalizar treino</button>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Cancelar treino</button>
    </div>
  `;
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
function saitamaLiveAdd(el) {
  const data = liveSession?.saitama;
  const item = SAITAMA_LIVE_FIELDS.find((field) => field.field === el.dataset.field);
  if (!data || !item) return;
  const before = data[item.field];
  data[item.field] = clampSaitamaCount(before + data.step);
  data.log.push({ field: item.field, n: data.step, at: Date.now() });
  liveBuzz(30);
  if (before < SAITAMA_LIVE_GOAL && data[item.field] >= SAITAMA_LIVE_GOAL) {
    tobaToast(`💯 ${SAITAMA_LIVE_GOAL} ${item.plural}! O careca aprova 👊`);
  }
  if (data.autoRest) startLiveRest();
  storeLiveSession();
  renderLiveSession();
}

function saitamaLiveUndo() {
  const data = liveSession?.saitama;
  const last = data?.log.pop();
  if (!last) return;
  data[last.field] = clampSaitamaCount(data[last.field] - last.n);
  const item = SAITAMA_LIVE_FIELDS.find((field) => field.field === last.field);
  tobaToast(`↩ Tirei ${last.n} de ${item.name.toLowerCase()}`);
  storeLiveSession();
  renderLiveSession();
}

function saitamaLiveStep(el) {
  const step = Number(el.dataset.step);
  if (!liveSession?.saitama || !SAITAMA_LIVE_STEPS.includes(step)) return;
  liveSession.saitama.step = step;
  storeLivePrefs({ saitamaStep: step });
  storeLiveSession();
  renderLiveSession();
}

function saitamaLiveAutoRest(el) {
  if (!liveSession?.saitama) return;
  liveSession.saitama.autoRest = el.checked;
  storeLivePrefs({ saitamaAutoRest: el.checked });
  if (!el.checked) endLiveRest();
  tobaToast(el.checked ? "⏱ Cada toque já começa o descanso" : "🔢 Modo contador: sem descanso automático");
  storeLiveSession();
  renderLiveSession();
}

function saitamaLiveRestNow() {
  if (!liveSession) return;
  startLiveRest();
  storeLiveSession();
  renderLiveRest();
}

/* ---------------------------------------------------------------------
 * Finalizar: vira um treino "saitama" normal
 * ------------------------------------------------------------------- */
function openSaitamaLiveFinish() {
  const data = liveSession.saitama;
  const minutes = Math.max(1, Math.round((Date.now() - liveSession.startedAt) / 60000));
  const parts = SAITAMA_LIVE_FIELDS
    .filter((item) => data[item.field] > 0)
    .map((item) => `${formatWorkoutNumber(data[item.field], 0)} ${item.plural}`);
  document.getElementById("liveFinishSummary").textContent = parts.length
    ? `${parts.join(" · ")} · ${minutes} min. Correu também? Põe os km aí.`
    : `Nenhuma rep contada em ${minutes} min. Se foi só corrida, põe os km aí.`;
  setLiveFinishMode(true);
  document.getElementById("live-km").value = "";
  document.getElementById("live-calories").value = "";
  document.getElementById("live-notes").value = "";
  openTobaModal("liveFinishModal");
}

function finishSaitamaLiveSession() {
  const data = liveSession.saitama;
  const km = parseTobaDecimal(document.getElementById("live-km").value);
  const calories = Number(document.getElementById("live-calories").value);
  const distanceKm = Number.isFinite(km) && km > 0 ? Math.round(km * 100) / 100 : null;
  if (!getSaitamaLiveTotal(data) && !distanceKm) {
    showPageMessage("Conte pelo menos uma leva (toque num quadrado) ou informe os km. Se quiser jogar o treino fora, use Cancelar treino.", { title: "Nada pra salvar" });
    return;
  }
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "saitama",
    title: SAITAMA_LIVE_TITLE,
    date: liveSession.date,
    durationMinutes: Math.max(1, Math.round((Date.now() - liveSession.startedAt) / 60000)),
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    distanceKm,
    pushups: data.pushups || null,
    situps: data.situps || null,
    squats: data.squats || null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: document.getElementById("live-notes").value.trim(),
  };
  healthDb.workouts.push(workout);
  saveHealthDb();

  // Só descarta o treino em andamento se o histórico gravou de verdade.
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
  closeTobaModal("liveFinishModal");
  dropLiveSession();
  stopLiveTicker();
  openModule("viewTraining"); // o ‹ da página do treino volta pra Treinos
  openWorkoutView(workout.id);
  tobaToast("👊 Treino do Saitama no histórico!");
}

tobaActions({
  startSaitamaLive,
  saitamaLiveAdd,
  saitamaLiveUndo,
  saitamaLiveStep,
  saitamaLiveAutoRest,
  saitamaLiveRestNow,
});
