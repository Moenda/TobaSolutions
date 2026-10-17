/* =====================================================================
 * Toba Health · Treino ao vivo ("▶ Iniciar treino")
 * Preenchido DURANTE o treino: cronômetro, um exercício por vez, séries
 * já vindas da última vez, régua de arrastar (tobaWheelPicker) para reps e
 * carga, timer de descanso com frases anti-reels e retomada se o app fechar.
 *
 * Treino em andamento: chave própria no localStorage (NÃO é o healthDb).
 *   TOBA_HEALTH_ACTIVE_SESSION = {
 *     v: 1, id: "s-<ts>-<rand4>",
 *     startedAt: ms, date: "AAAA-MM-DD", routineId: "" | "r-...", title,
 *     current: índice do exercício na tela,
 *     exercises: [{ exerciseId, skipped: bool, sets: [{ reps, kg, done: bool }] }],
 *     rest: { duration: s, startedAt: ms|null, endsAt: ms|null, alerted: bool },
 *     restDefault: s, updatedAt: ms
 *   }
 * Tempos são horários (Date.now()), nunca contagem de setInterval: o
 * celular congela a aba em segundo plano e o tempo tem que continuar certo.
 * Ao finalizar vira um treino "strength" normal em healthDb.workouts (mesmo
 * formato do registerStrengthWorkout, só as séries marcadas como feitas) e
 * a chave é apagada. Frases e avisos são só de tela: nada disso é gravado.
 *
 * Carregado ANTES de treinos.js; só usa funções de forca.js/treinos.js
 * dentro de funções.
 * ===================================================================== */

const LIVE_SESSION_KEY = "TOBA_HEALTH_ACTIVE_SESSION";
const LIVE_REST_PRESETS = [60, 90, 120, 180];
const LIVE_REST_DEFAULT = 90;
const LIVE_LATE_SECONDS = 30; // passou disso: "tempo perdido no feed"
const LIVE_RING = 2 * Math.PI * 52; // circunferência do anel (r = 52)

const LIVE_QUIPS = {
  // durante o descanso (vão girando)
  resting: [
    "Respira. O reels não vai fugir… mas a hipertrofia vai.",
    "Esse descanso é pro músculo, não pro polegar.",
    "Rolar o feed não conta como cardio.",
    "O algoritmo quer esses seus segundos. Não dá pra ele.",
    "Hidrata aí. Água, não dopamina.",
    "Nenhum reels de \"treino perfeito\" vai treinar por você.",
    "Se abrir o Instagram agora, o supino chora.",
    "Descanso é recuperação, não maratona de stories.",
    "Seu shape não vem de vídeo de 15 segundos.",
    "Celular no bolso, cabeça na próxima série.",
    "Tá descansando ou procrastinando com estilo?",
    "O feed é infinito. Seu descanso, não.",
    "Respira fundo. 3, 2, 1… nada de TikTok.",
    "Olha pro espelho, não pra tela. O progresso tá ali.",
  ],
  // acabou o descanso
  done: [
    "Acabou o descanso! Larga esse reels e volta pra barra 🏋️",
    "Bora! A barra não vai se levantar sozinha.",
    "Tempo! O ferro tá te chamando.",
    "Descanso concluído. Agora é você contra a gravidade.",
    "Fim do recreio! Próxima série 💪",
    "Levanta daí. O banco não é sofá.",
  ],
  // passou muito do tempo, com o app aberto
  late: [
    "Cada segundo aqui é um segundo a mais pro Zuckerberg.",
    "O descanso acabou. O feed, pelo visto, não.",
    "Isso já virou intervalo comercial.",
    "Seu músculo esfriou, o algoritmo esquentou.",
    "Bora, antes que o descanso vire cochilo.",
  ],
  // voltou pro app no meio do descanso
  back: [
    "Te peguei no reels, né? 👀",
    "Foi só uma olhadinha no Instagram, né? Sei…",
    "Voltou! O algoritmo quase te levou.",
    "Saiu do app no meio do descanso? O músculo viu.",
  ],
  // voltou pro app depois que o descanso acabou ({s} = quanto passou)
  backLate: [
    "O descanso acabou faz {s}. O algoritmo agradece.",
    "Te peguei no reels, né? 👀 Acabou faz {s}.",
    "{s} de descanso extra, patrocinados pelo feed.",
    "O descanso acabou faz {s}. A barra tá esperando, ofendida.",
  ],
};

let liveSession = null;
let liveFocus = null; // série em foco (só tela; null = primeira não feita)
let liveWheels = [];
let liveTicker = 0;
let liveSaveTimer = 0;
let liveSaveWarned = false;
let liveWakeLock = null;
let liveHiddenAt = 0;
let liveQuip = ""; // frase da volta pro app (fica até o próximo descanso)
let liveQuipSeed = 0;
let liveRestState = "";
let liveRestMinimized = false;
let livePickerGroup = "";

/* ---------------------------------------------------------------------
 * Ler / gravar o treino em andamento
 * ------------------------------------------------------------------- */
function clampLiveReps(value) {
  return Math.min(50, Math.max(1, Math.round(Number(value) || 10)));
}

function clampLiveKg(value) {
  return Math.min(300, Math.max(0, Math.round(Number(value) || 0)));
}

// Campos ausentes ganham padrão: sessão de outra versão não quebra a tela.
function normalizeLiveSession(raw) {
  const session = { ...raw };
  session.v = 1;
  session.id = String(session.id || `s-${Date.now()}`);
  session.title = String(session.title || "Treino livre");
  session.routineId = String(session.routineId || "");
  session.date = /^\d{4}-\d{2}-\d{2}$/.test(session.date) ? session.date : toIsoDate(new Date(session.startedAt));
  session.restDefault = Number(session.restDefault) || LIVE_REST_DEFAULT;
  session.exercises = session.exercises
    .filter((entry) => entry && entry.exerciseId)
    .map((entry) => ({
      exerciseId: String(entry.exerciseId),
      skipped: Boolean(entry.skipped),
      sets: (Array.isArray(entry.sets) ? entry.sets : []).map((set) => ({
        reps: clampLiveReps(set && set.reps),
        kg: clampLiveKg(set && set.kg),
        done: Boolean(set && set.done),
      })),
    }));
  session.current = Math.min(Math.max(0, Number(session.current) || 0), Math.max(0, session.exercises.length - 1));
  const rest = session.rest || {};
  session.rest = {
    duration: Number(rest.duration) || session.restDefault,
    startedAt: Number(rest.startedAt) || null,
    endsAt: Number(rest.endsAt) || null,
    alerted: Boolean(rest.alerted),
  };
  return session;
}

// { session } se tem treino guardado; { broken: true } se não deu pra ler.
function readLiveSession() {
  let raw = null;
  try {
    raw = localStorage.getItem(LIVE_SESSION_KEY);
  } catch (err) {
    return { session: null, broken: false };
  }
  if (!raw) return { session: null, broken: false };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Number(parsed.startedAt) > 0 && Array.isArray(parsed.exercises)) {
      return { session: normalizeLiveSession(parsed), broken: false };
    }
  } catch (err) {
    /* cai no "broken" */
  }
  return { session: null, broken: true };
}

function storeLiveSession() {
  clearTimeout(liveSaveTimer);
  liveSaveTimer = 0;
  if (!liveSession) return;
  liveSession.updatedAt = Date.now();
  try {
    localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(liveSession));
  } catch (err) {
    console.error("Erro ao guardar o treino em andamento:", err);
    if (!liveSaveWarned) {
      liveSaveWarned = true;
      showPageMessage(
        "Não consegui guardar o treino em andamento neste aparelho (memória cheia?). Ele continua aberto, mas se o app fechar pode se perder.",
        { title: "Atenção", icon: "⚠️" },
      );
    }
  }
}

// Arrastar a régua grava várias vezes por segundo: junta numa gravação só.
function storeLiveSessionSoon() {
  clearTimeout(liveSaveTimer);
  liveSaveTimer = setTimeout(storeLiveSession, 300);
}

function dropLiveSession() {
  clearTimeout(liveSaveTimer);
  liveSaveTimer = 0;
  liveSession = null;
  liveFocus = null;
  try {
    localStorage.removeItem(LIVE_SESSION_KEY);
  } catch (err) {
    console.error("Erro ao apagar o treino em andamento:", err);
  }
}

/* ---------------------------------------------------------------------
 * Ajudantes
 * ------------------------------------------------------------------- */
function liveBuzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (err) {
    /* sem vibração */
  }
}

function formatLiveClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function formatLiveSeconds(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (!m) return `${s}s`;
  return s ? `${m}min${String(s).padStart(2, "0")}s` : `${m}min`;
}

function pickLiveQuip(list, step = 0) {
  return list[(liveQuipSeed + step) % list.length];
}

function liveSetText(set) {
  return `${set.reps} × ${set.kg ? `${set.kg} kg` : "corpo"}`;
}

function getLiveExerciseName(exerciseId) {
  return getStrengthExercise(exerciseId)?.name || exerciseId;
}

function isLiveExerciseComplete(entry) {
  return entry.sets.length > 0 && entry.sets.every((set) => set.done);
}

function getLiveCounts(session) {
  let sets = 0;
  let done = 0;
  session.exercises.forEach((entry) => {
    sets += entry.sets.length;
    done += entry.sets.filter((set) => set.done).length;
  });
  return {
    exercises: session.exercises.length,
    completed: session.exercises.filter(isLiveExerciseComplete).length,
    sets,
    done,
  };
}

// Próximo exercício que ainda falta (nem completo nem pulado), dando a volta.
function getNextLiveExercise(from) {
  const list = liveSession.exercises;
  for (let step = 1; step <= list.length; step++) {
    const index = (from + step) % list.length;
    if (index !== from && !isLiveExerciseComplete(list[index]) && !list[index].skipped) return index;
  }
  return -1;
}

function getLiveFocusIndex(entry) {
  if (!entry) return -1;
  if (liveFocus !== null && entry.sets[liveFocus] && !entry.sets[liveFocus].done) return liveFocus;
  return entry.sets.findIndex((set) => !set.done);
}

function isLiveViewActive() {
  return Boolean(document.getElementById("viewSession")?.classList.contains("active"));
}

/* ---------------------------------------------------------------------
 * Começar / continuar / sair
 * ------------------------------------------------------------------- */
// Séries da última vez nesse exercício; sem histórico, as do treino salvo.
function newLiveExercise(exerciseId, fallbackSets) {
  const last = getLastStrengthSets(exerciseId);
  const source = last && last.length
    ? last
    : fallbackSets && fallbackSets.length
      ? fallbackSets
      : [{ reps: 10, kg: 0 }, { reps: 10, kg: 0 }, { reps: 10, kg: 0 }];
  return {
    exerciseId,
    skipped: false,
    sets: source.map((set) => ({ reps: clampLiveReps(set.reps), kg: clampLiveKg(set.kg), done: false })),
  };
}

function openLiveStart() {
  const { session } = readLiveSession();
  if (session) {
    liveSession = session;
    openLiveSessionView();
    return;
  }
  const routines = healthDb.strengthRoutines || [];
  const cards = routines.map((routine) => {
    const stats = getStrengthRoutineStats(routine.id);
    const groups = [...new Set((routine.exercises || [])
      .map((exercise) => getStrengthExercise(exercise.exerciseId)?.group)
      .filter(Boolean))].map(getStrengthGroupName);
    const count = (routine.exercises || []).length;
    return `
      <button type="button" class="toba-menu-btn live-routine-btn" data-click="startLiveRoutine" data-routine="${escapeHtml(routine.id)}">
        <span class="toba-menu-icon">💪</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">${escapeHtml(routine.name)}</span>
          <span class="toba-menu-desc">${escapeHtml(groups.join(" · ") || "Sem exercícios")} · ${count} ${count === 1 ? "exercício" : "exercícios"} · feito ${stats.count}×</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>`;
  }).join("");
  document.getElementById("liveStartList").innerHTML = cards
    ? `<div class="hub-title">Seus treinos</div><div class="toba-menu">${cards}</div><div class="section-divider"></div>`
    : '<p class="toba-sheet-text">Você ainda não tem treino salvo. Comece um livre e, no fim, salve como modelo (Treino A, B, C...).</p>';
  openTobaModal("liveStartModal");
}

function startLiveSession(routineId) {
  const routine = routineId ? (healthDb.strengthRoutines || []).find((item) => item.id === routineId) : null;
  const now = Date.now();
  liveSession = {
    v: 1,
    id: `s-${now}-${Math.random().toString(36).slice(2, 6)}`,
    startedAt: now,
    date: toIsoDate(),
    routineId: routine ? routine.id : "",
    title: routine ? routine.name : "Treino livre",
    current: 0,
    exercises: routine
      ? (routine.exercises || [])
          .filter((exercise) => getStrengthExercise(exercise.exerciseId))
          .map((exercise) => newLiveExercise(exercise.exerciseId, exercise.sets))
      : [],
    rest: { duration: LIVE_REST_DEFAULT, startedAt: null, endsAt: null, alerted: false },
    restDefault: LIVE_REST_DEFAULT,
    updatedAt: now,
  };
  liveFocus = null;
  liveQuip = "";
  storeLiveSession();
  closeTobaModal("liveStartModal");
  openLiveSessionView();
  if (!liveSession.exercises.length) openLiveExercisePicker();
}

function openLiveSessionView() {
  tobaAskNotify(); // só abre por toque: na 1ª vez pede para avisar o fim do descanso fora do app
  if (!liveSession) liveSession = readLiveSession().session;
  if (!liveSession) {
    openModule("viewTraining");
    return;
  }
  openModule("viewSession");
  renderLiveSession();
  startLiveTicker();
  requestLiveWakeLock();
}

// "‹" do cabeçalho: volta para Treinos, o treino continua guardado.
function leaveLiveSession() {
  storeLiveSession();
  openModule("viewTraining");
}

async function discardLiveSession() {
  const confirmed = await showPageMessage(
    "Descartar o treino em andamento? As séries marcadas nele não vão para o histórico.",
    { title: "Descartar treino", confirm: true, confirmLabel: "Descartar" },
  );
  if (!confirmed) return;
  dropLiveSession();
  stopLiveTicker();
  openModule("viewTraining");
}

/* ---------------------------------------------------------------------
 * Aviso na tela de Treinos: botão "Iniciar" ou "treino em andamento"
 * ------------------------------------------------------------------- */
function renderLiveSessionLaunch() {
  const box = document.getElementById("liveSessionLaunch");
  if (!box) return;
  const { session, broken } = readLiveSession();
  if (broken) {
    box.innerHTML = `
      <div class="live-resume is-broken">
        <div class="live-resume-title">⚠️ Treino em andamento ilegível</div>
        <div class="live-resume-sub">Não consegui ler o treino que estava aberto. Dá para descartar e começar outro.</div>
        <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Descartar</button>
      </div>`;
    return;
  }
  if (session) {
    const counts = getLiveCounts(session);
    const minutes = Math.max(0, Math.round((Date.now() - session.startedAt) / 60000));
    box.innerHTML = `
      <div class="live-resume">
        <div class="live-resume-title">⏸ ${escapeHtml(session.title)} em andamento</div>
        <div class="live-resume-sub">Começou há ${minutes} min · ${counts.done} ${counts.done === 1 ? "série feita" : "séries feitas"} · ${counts.completed}/${counts.exercises} exercícios</div>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary btn-grow-1" data-click="discardLiveSession">Descartar</button>
          <button type="button" class="btn btn-primary btn-grow-2" data-click="resumeLiveSession">▶ Continuar</button>
        </div>
      </div>`;
    return;
  }
  box.innerHTML = `
    <button type="button" class="live-launch" data-click="openLiveStart">
      <span class="live-launch-icon" aria-hidden="true">▶</span>
      <span class="live-launch-copy">
        <span class="live-launch-title">Iniciar treino</span>
        <span class="live-launch-detail">Preencha ao vivo, série por série, com timer de descanso</span>
      </span>
    </button>`;
}

/* ---------------------------------------------------------------------
 * Tela do treino em andamento
 * ------------------------------------------------------------------- */
function destroyLiveWheels() {
  liveWheels.forEach((wheel) => wheel.destroy());
  liveWheels = [];
}

function renderLiveExercise(entry) {
  const exercise = getStrengthExercise(entry.exerciseId);
  const last = getLastStrengthSets(entry.exerciseId);
  const focus = getLiveFocusIndex(entry);
  const rows = entry.sets.map((set, index) => {
    if (index === focus) {
      return `
        <div class="live-set is-focus">
          <div class="live-set-head">
            <span class="live-set-label">${index + 1}ª série</span>
            <span class="live-set-preview" id="liveFocusPreview">${liveSetText(set)}</span>
          </div>
          <div class="live-wheel" data-wheel="reps" data-set="${index}"></div>
          <div class="live-wheel" data-wheel="kg" data-set="${index}"></div>
          ${exercise?.bodyweight ? '<p class="live-hint">0 kg = só o peso do corpo (ele já entra na conta).</p>' : ""}
          <button type="button" class="btn btn-primary live-done-btn" data-click="liveToggleSet" data-set="${index}">✓ Série feita</button>
        </div>`;
    }
    return `
      <div class="live-set${set.done ? " is-done" : ""}">
        <button type="button" class="live-set-main" data-click="liveFocusSet" data-set="${index}"${set.done ? " disabled" : ""}>
          <span class="live-set-label">${index + 1}ª</span>
          <span class="live-set-value" data-row="${index}">${liveSetText(set)}</span>
        </button>
        <button type="button" class="live-set-check" data-click="liveToggleSet" data-set="${index}" aria-label="${set.done ? "Desmarcar" : "Marcar"} a ${index + 1}ª série como feita">${set.done ? "✓" : ""}</button>
      </div>`;
  }).join("");

  let complete = "";
  if (focus === -1) {
    const next = getNextLiveExercise(liveSession.current);
    complete = entry.sets.length
      ? `<div class="live-complete">
          <strong>✅ Exercício completo!</strong>
          ${next !== -1
            ? `<button type="button" class="btn btn-primary" data-click="liveGoTo" data-index="${next}">Próximo: ${escapeHtml(getLiveExerciseName(liveSession.exercises[next].exerciseId))} ›</button>`
            : '<button type="button" class="btn btn-primary" data-click="openLiveFinish">🏁 Tudo feito! Finalizar treino</button>'}
        </div>`
      : '<p class="live-hint">Sem séries. Toque em + Série.</p>';
  }

  return `
    <div class="live-exercise">
      <div class="live-exercise-head">
        <div>
          <div class="live-exercise-name">${escapeHtml(exercise ? exercise.name : entry.exerciseId)}</div>
          <div class="live-exercise-meta">${exercise ? getStrengthGroupName(exercise.group) : ""}${last ? ` · última vez ${describeStrengthSets(last)}` : " · primeira vez 🆕"}</div>
        </div>
        ${entry.skipped ? '<span class="live-skip-badge">⏭ Pulado</span>' : ""}
      </div>
      <div class="live-sets">${rows}</div>
      ${complete}
      <div class="btn-row live-set-actions">
        <button type="button" class="btn btn-secondary" data-click="liveRemoveSet"${entry.sets.length ? "" : " disabled"}>− Série</button>
        <button type="button" class="btn btn-secondary" data-click="liveAddSet">+ Série</button>
      </div>
    </div>`;
}

function renderLiveSession() {
  destroyLiveWheels();
  const box = document.getElementById("liveSessionContent");
  const session = liveSession;
  if (!box || !session) return;
  const counts = getLiveCounts(session);
  const entry = session.exercises[session.current] || null;
  const percent = counts.sets ? Math.round((counts.done / counts.sets) * 100) : 0;
  const dots = session.exercises.map((item, index) => {
    const cls = [
      index === session.current ? "is-current" : "",
      isLiveExerciseComplete(item) ? "is-done" : "",
      item.skipped ? "is-skipped" : "",
    ].filter(Boolean).join(" ");
    return `<button type="button" class="live-dot ${cls}" data-click="liveGoTo" data-index="${index}" aria-label="${index + 1}: ${escapeHtml(getLiveExerciseName(item.exerciseId))}">${isLiveExerciseComplete(item) ? "✓" : index + 1}</button>`;
  }).join("");

  box.innerHTML = `
    <div class="live-top">
      <div class="live-top-text">
        <span class="live-badge">● AO VIVO</span>
        <strong class="live-title">${escapeHtml(session.title)}</strong>
      </div>
      <div class="live-clock" id="liveClock" role="timer" aria-label="Tempo de treino">${formatLiveClock(Date.now() - session.startedAt)}</div>
    </div>
    <div class="live-progress">
      <div class="live-progress-bar"><span style="width: ${percent}%"></span></div>
      <span class="live-progress-text">${counts.completed}/${counts.exercises} exercícios · ${counts.done}/${counts.sets} séries</span>
    </div>
    ${session.exercises.length ? `<div class="live-dots">${dots}</div>` : ""}
    ${entry ? renderLiveExercise(entry) : tobaEmpty("🏋️", "Nenhum exercício ainda", "Toque em ➕ Exercício para escolher no catálogo.", { compact: true })}
    ${entry ? `
      <div class="live-nav">
        <button type="button" class="btn btn-secondary" data-click="liveGoTo" data-index="${session.current - 1}"${session.current > 0 ? "" : " disabled"}>‹ Anterior</button>
        <button type="button" class="btn btn-secondary" data-click="liveToggleSkip">${entry.skipped ? "↩ Desfazer" : "Pular ⏭"}</button>
        <button type="button" class="btn btn-secondary" data-click="liveGoTo" data-index="${session.current + 1}"${session.current < session.exercises.length - 1 ? "" : " disabled"}>Próximo ›</button>
      </div>` : ""}
    <button type="button" class="btn btn-outline btn-blue live-add-ex" data-click="openLiveExercisePicker">➕ ${entry ? "Exercício extra" : "Exercício"}</button>
    <div class="live-footer">
      <button type="button" class="btn btn-primary live-finish" data-click="openLiveFinish">🏁 Finalizar treino</button>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Cancelar treino</button>
    </div>
  `;

  if (entry) {
    box.querySelectorAll(".live-wheel").forEach((el) => {
      const setIndex = Number(el.dataset.set);
      const field = el.dataset.wheel;
      const isKg = field === "kg";
      liveWheels.push(tobaWheelPicker(el, {
        min: isKg ? 0 : 1,
        max: isKg ? 300 : 50,
        step: 1,
        value: entry.sets[setIndex][field],
        majorEvery: 5,
        unit: isKg ? "kg" : "reps",
        label: isKg ? "Carga em kg" : "Repetições",
        onChange: (value) => setLiveSetValue(setIndex, field, value),
      }));
    });
  }
  renderLiveRest();
}

// A régua mexe só no dado e nos textos (sem redesenhar a tela, senão o dedo
// perde a régua). Séries seguintes ainda não feitas com o mesmo valor
// acompanham: subir a carga da 1ª já ajusta as outras.
function setLiveSetValue(setIndex, field, value) {
  const entry = liveSession?.exercises[liveSession.current];
  if (!entry || !entry.sets[setIndex]) return;
  const old = entry.sets[setIndex][field];
  entry.sets[setIndex][field] = value;
  entry.sets.forEach((set, index) => {
    if (index <= setIndex || set.done || set[field] !== old) return;
    set[field] = value;
    const row = document.querySelector(`#liveSessionContent [data-row="${index}"]`);
    if (row) row.textContent = liveSetText(set);
  });
  const preview = document.getElementById("liveFocusPreview");
  if (preview) preview.textContent = liveSetText(entry.sets[setIndex]);
  storeLiveSessionSoon();
}

/* ---------------------------------------------------------------------
 * Ações das séries e exercícios
 * ------------------------------------------------------------------- */
function liveToggleSet(el) {
  const entry = liveSession?.exercises[liveSession.current];
  const set = entry?.sets[Number(el.dataset.set)];
  if (!set) return;
  set.done = !set.done;
  liveFocus = null;
  if (set.done) {
    entry.skipped = false;
    const counts = getLiveCounts(liveSession);
    if (counts.done === counts.sets) {
      endLiveRest();
      tobaToast("Última série! Bora finalizar 🏁");
    } else {
      startLiveRest();
    }
  }
  storeLiveSession();
  renderLiveSession();
}

function liveFocusSet(el) {
  liveFocus = Number(el.dataset.set);
  renderLiveSession();
}

function liveAddSet() {
  const entry = liveSession?.exercises[liveSession.current];
  if (!entry) return;
  const last = entry.sets[entry.sets.length - 1] || { reps: 10, kg: 0 };
  entry.sets.push({ reps: last.reps, kg: last.kg, done: false });
  liveFocus = entry.sets.length - 1;
  storeLiveSession();
  renderLiveSession();
}

function liveRemoveSet() {
  const entry = liveSession?.exercises[liveSession.current];
  if (!entry || !entry.sets.length) return;
  entry.sets.pop();
  liveFocus = null;
  storeLiveSession();
  renderLiveSession();
}

function liveGoTo(el) {
  const index = Number(el.dataset.index);
  if (!liveSession || !liveSession.exercises[index]) return;
  liveSession.current = index;
  liveFocus = null;
  storeLiveSession();
  renderLiveSession();
  document.getElementById("liveSessionContent")?.scrollIntoView({ block: "start" });
}

function liveToggleSkip() {
  const entry = liveSession?.exercises[liveSession.current];
  if (!entry) return;
  entry.skipped = !entry.skipped;
  if (entry.skipped) {
    const next = getNextLiveExercise(liveSession.current);
    if (next !== -1) liveSession.current = next;
    tobaToast("Pulado ⏭ (dá pra voltar nele)");
  }
  liveFocus = null;
  storeLiveSession();
  renderLiveSession();
}

/* Catálogo para treino livre e exercício extra */
function openLiveExercisePicker() {
  renderLiveExercisePicker();
  openTobaModal("liveExerciseModal");
}

function renderLiveExercisePicker() {
  const added = new Set((liveSession?.exercises || []).map((entry) => entry.exerciseId));
  const chips = STRENGTH_GROUPS.map((group) => `
    <button type="button" class="strength-chip${livePickerGroup === group.id ? " active" : ""}" data-click="livePickGroup" data-group="${group.id}">${group.name}</button>`).join("");
  const options = livePickerGroup
    ? STRENGTH_EXERCISES.filter((exercise) => exercise.group === livePickerGroup).map((exercise) => `
        <button type="button" class="strength-option${added.has(exercise.id) ? " added" : ""}" data-click="liveAddExercise" data-exercise="${exercise.id}"${added.has(exercise.id) ? " disabled" : ""}>
          <span>${exercise.name}</span><span class="strength-option-mark">${added.has(exercise.id) ? "✓" : "+"}</span>
        </button>`).join("")
    : '<p class="strength-hint">Escolha um grupo muscular para ver os exercícios.</p>';
  document.getElementById("liveExerciseList").innerHTML = `
    <div class="hub-title">Grupo muscular</div>
    <div class="strength-chips">${chips}</div>
    <div class="hub-title strength-step-title">Exercício</div>
    <div class="strength-options">${options}</div>`;
}

function livePickGroup(el) {
  livePickerGroup = livePickerGroup === el.dataset.group ? "" : el.dataset.group;
  renderLiveExercisePicker();
}

function liveAddExercise(el) {
  if (!liveSession || !getStrengthExercise(el.dataset.exercise)) return;
  liveSession.exercises.push(newLiveExercise(el.dataset.exercise));
  liveSession.current = liveSession.exercises.length - 1;
  liveFocus = null;
  storeLiveSession();
  closeTobaModal("liveExerciseModal");
  renderLiveSession();
  tobaToast("Exercício adicionado ✓");
}

/* ---------------------------------------------------------------------
 * Descanso (baseado em horário)
 * ------------------------------------------------------------------- */
function startLiveRest(seconds = liveSession.restDefault) {
  const now = Date.now();
  liveSession.rest = { duration: seconds, startedAt: now, endsAt: now + seconds * 1000, alerted: false };
  liveQuip = "";
  liveQuipSeed = Math.floor(Math.random() * 1000);
  liveRestMinimized = false;
  liveRestState = "";
}

function endLiveRest() {
  if (!liveSession) return;
  liveSession.rest = { duration: liveSession.restDefault, startedAt: null, endsAt: null, alerted: false };
  liveQuip = "";
  liveRestState = "";
}

function liveRestPreset(el) {
  const rest = liveSession?.rest;
  if (!rest || !rest.startedAt) return;
  const seconds = Number(el.dataset.seconds);
  rest.duration = seconds;
  rest.endsAt = rest.startedAt + seconds * 1000;
  if (rest.endsAt > Date.now()) rest.alerted = false;
  liveSession.restDefault = seconds; // próximas séries usam esse tempo
  storeLiveSession();
  renderLiveRest();
}

function liveRestNudge(el) {
  const rest = liveSession?.rest;
  if (!rest || !rest.startedAt) return;
  const now = Date.now();
  const delta = Number(el.dataset.delta) * 1000;
  if (delta > 0) {
    rest.endsAt = Math.max(rest.endsAt, now) + delta;
    rest.alerted = false;
  } else {
    rest.endsAt = rest.endsAt > now ? Math.max(now, rest.endsAt + delta) : rest.endsAt;
  }
  rest.duration = Math.max(1, Math.round((rest.endsAt - rest.startedAt) / 1000));
  storeLiveSession();
  renderLiveRest();
}

function liveEndRest() {
  endLiveRest();
  storeLiveSession();
  renderLiveRest();
}

function liveToggleRestMin() {
  liveRestMinimized = !liveRestMinimized;
  renderLiveRest();
}

function getLiveRestState(now = Date.now()) {
  const rest = liveSession?.rest;
  if (!rest || !rest.startedAt) return "";
  const left = rest.endsAt - now;
  if (left > 0) return "running";
  return -left / 1000 > LIVE_LATE_SECONDS ? "late" : "done";
}

function renderLiveRest() {
  const panel = document.getElementById("liveRest");
  const view = document.getElementById("viewSession");
  if (!panel) return;
  const state = getLiveRestState();
  liveRestState = state;
  view?.classList.toggle("has-rest", Boolean(state) && !liveRestMinimized);
  view?.classList.toggle("has-rest-min", Boolean(state) && liveRestMinimized);
  if (!state) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  panel.className = `live-rest is-${state}${liveRestMinimized ? " is-min" : ""}`;
  if (liveRestMinimized) {
    panel.innerHTML = `
      <button type="button" class="live-rest-bar" data-click="liveToggleRestMin" aria-label="Abrir o timer de descanso">
        <span>⏱ Descanso</span><strong id="liveRestTime"></strong><span class="live-rest-late-mini" id="liveRestLate"></span><span aria-hidden="true">▴</span>
      </button>`;
  } else {
    const duration = liveSession.rest.duration;
    panel.innerHTML = `
      <button type="button" class="live-rest-min" data-click="liveToggleRestMin" aria-label="Diminuir o timer">▾</button>
      <div class="live-rest-main">
        <div class="live-rest-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="live-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="live-ring-fg" id="liveRestRing" cx="60" cy="60" r="52" stroke-dasharray="${LIVE_RING.toFixed(1)}"></circle>
          </svg>
          <div class="live-rest-center">
            <strong class="live-rest-time" id="liveRestTime" role="timer"></strong>
            <span class="live-rest-label">${state === "running" ? "descanso" : "bora!"}</span>
          </div>
        </div>
        <div class="live-rest-side">
          <p class="live-rest-quip" id="liveRestQuip" aria-live="polite"></p>
          <div class="live-rest-late" id="liveRestLate"></div>
        </div>
      </div>
      <div class="live-rest-presets">
        ${LIVE_REST_PRESETS.map((seconds) => `<button type="button" class="live-chip${duration === seconds ? " active" : ""}" data-click="liveRestPreset" data-seconds="${seconds}">${seconds}s</button>`).join("")}
        <button type="button" class="live-chip" data-click="liveRestNudge" data-delta="-15">−15s</button>
        <button type="button" class="live-chip" data-click="liveRestNudge" data-delta="15">+15s</button>
      </div>
      <button type="button" class="btn ${state === "running" ? "btn-secondary" : "btn-primary"} live-rest-end" data-click="liveEndRest">${state === "running" ? "Pular descanso" : "Bora pra próxima série 💪"}</button>`;
  }
  updateLiveRest();
}

// Só textos e anel (roda no tique): nada de redesenhar a folha inteira.
function updateLiveRest(now = Date.now()) {
  const rest = liveSession?.rest;
  if (!rest || !rest.startedAt) return;
  const left = rest.endsAt - now;
  const time = document.getElementById("liveRestTime");
  if (time) time.textContent = left > 0 ? formatLiveClock(left + 999) : "0:00";
  const ring = document.getElementById("liveRestRing");
  if (ring) {
    const total = Math.max(1, rest.endsAt - rest.startedAt);
    const fraction = Math.min(1, Math.max(0, left / total));
    ring.style.strokeDashoffset = (LIVE_RING * (1 - fraction)).toFixed(1);
  }
  const late = document.getElementById("liveRestLate");
  if (late) {
    const over = -left / 1000;
    late.textContent = over > LIVE_LATE_SECONDS ? `📱 +${formatLiveClock(-left)} perdidos no feed` : "";
  }
  const quip = document.getElementById("liveRestQuip");
  if (quip) {
    let text = liveQuip;
    if (!text) {
      const state = getLiveRestState(now);
      if (state === "running") text = pickLiveQuip(LIVE_QUIPS.resting, Math.floor((now - rest.startedAt) / 9000));
      else if (state === "done") text = pickLiveQuip(LIVE_QUIPS.done);
      else text = pickLiveQuip(LIVE_QUIPS.late, Math.floor(-left / 12000));
    }
    if (quip.textContent !== text) quip.textContent = text;
  }
}

/* ---------------------------------------------------------------------
 * Tique (cronômetro + descanso), tela acesa e volta pro app
 * ------------------------------------------------------------------- */
function liveTick() {
  if (!liveSession || !isLiveViewActive()) {
    stopLiveTicker();
    return;
  }
  const now = Date.now();
  const clock = document.getElementById("liveClock");
  if (clock) clock.textContent = formatLiveClock(now - liveSession.startedAt);
  const rest = liveSession.rest;
  if (!rest.startedAt) return;
  if (rest.endsAt <= now && !rest.alerted) {
    rest.alerted = true;
    liveBuzz([250, 120, 250, 120, 400]);
    // Fora do app (reels...), avisa na barra do celular. Com a tela apagada
    // por muito tempo o celular pode congelar a aba e o aviso atrasar.
    if (document.hidden) tobaNotify("⏱ Descanso acabou!", "Larga o celular e bora pra próxima série 💪", { tag: "toba-live-rest" });
    storeLiveSession();
  }
  if (getLiveRestState(now) !== liveRestState) renderLiveRest();
  else updateLiveRest(now);
}

function startLiveTicker() {
  clearInterval(liveTicker);
  liveTicker = setInterval(liveTick, 250);
  liveTick();
}

function stopLiveTicker() {
  clearInterval(liveTicker);
  liveTicker = 0;
  destroyLiveWheels();
  releaseLiveWakeLock();
}

async function requestLiveWakeLock() {
  if (!("wakeLock" in navigator) || liveWakeLock || document.hidden) return;
  try {
    liveWakeLock = await navigator.wakeLock.request("screen");
    liveWakeLock.addEventListener("release", () => {
      liveWakeLock = null;
    });
  } catch (err) {
    liveWakeLock = null; // navegador não deixou: o treino segue igual
  }
}

function releaseLiveWakeLock() {
  if (!liveWakeLock) return;
  liveWakeLock.release().catch(() => {});
  liveWakeLock = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    liveHiddenAt = Date.now();
    if (liveSaveTimer) storeLiveSession();
    return;
  }
  if (!liveSession || !isLiveViewActive()) {
    liveHiddenAt = 0;
    return;
  }
  const now = Date.now();
  const away = liveHiddenAt ? now - liveHiddenAt : 0;
  liveHiddenAt = 0;
  const rest = liveSession.rest;
  if (rest.startedAt && away > 5000) {
    const over = (now - rest.endsAt) / 1000;
    liveQuip = over > 1
      ? pickLiveQuip(LIVE_QUIPS.backLate).replace("{s}", formatLiveSeconds(over))
      : pickLiveQuip(LIVE_QUIPS.back);
    liveRestMinimized = false;
    renderLiveRest();
  }
  requestLiveWakeLock(); // a tela acesa é liberada sozinha quando o app sai da frente
  liveTick();
});

window.addEventListener("pagehide", () => {
  if (liveSaveTimer) storeLiveSession();
});

/* ---------------------------------------------------------------------
 * Finalizar: vira um treino de força normal
 * ------------------------------------------------------------------- */
function buildLiveWorkoutExercises() {
  return liveSession.exercises
    .map((entry) => {
      const exercise = getStrengthExercise(entry.exerciseId);
      return {
        exerciseId: entry.exerciseId,
        name: exercise ? exercise.name : entry.exerciseId,
        group: exercise ? exercise.group : "",
        sets: entry.sets
          .filter((set) => set.done && Number(set.reps) > 0)
          .map((set) => ({ reps: Number(set.reps), kg: Number(set.kg) || 0 })),
      };
    })
    .filter((exercise) => exercise.sets.length);
}

function openLiveFinish() {
  if (!liveSession) return;
  const exercises = buildLiveWorkoutExercises();
  if (!exercises.length) {
    showPageMessage("Marque pelo menos uma série como feita (✓) para finalizar. Se quiser jogar o treino fora, use Cancelar treino.", { title: "Nenhuma série feita" });
    return;
  }
  const sets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const minutes = Math.max(1, Math.round((Date.now() - liveSession.startedAt) / 60000));
  document.getElementById("liveFinishSummary").textContent =
    `${exercises.length} ${exercises.length === 1 ? "exercício" : "exercícios"} · ${sets} ${sets === 1 ? "série" : "séries"} · ${minutes} min. Só entram as séries marcadas com ✓.`;
  document.getElementById("live-title").value = liveSession.title === "Treino livre" ? "" : liveSession.title;
  document.getElementById("live-calories").value = "";
  document.getElementById("live-notes").value = "";
  const routine = liveSession.routineId
    ? (healthDb.strengthRoutines || []).find((item) => item.id === liveSession.routineId)
    : null;
  document.getElementById("live-save-routine").checked = false;
  document.getElementById("liveSaveRoutineText").textContent = routine
    ? `💾 Atualizar o modelo "${routine.name}" com o que fiz hoje`
    : "💾 Salvar como modelo (vira seu Treino A, B, C...)";
  openTobaModal("liveFinishModal");
}

function saveLiveRoutine(name, exercises) {
  const model = exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, sets: exercise.sets.map((set) => ({ ...set })) }));
  const existing = healthDb.strengthRoutines.find(
    (routine) => (liveSession.routineId && routine.id === liveSession.routineId) ||
      routine.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    existing.name = name;
    existing.exercises = model;
    return existing.id;
  }
  const routine = { id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, exercises: model };
  healthDb.strengthRoutines.push(routine);
  return routine.id;
}

function finishLiveSession() {
  if (!liveSession) return;
  if (!isHealthDbLoaded) {
    showHealthDbLockedMessage(); // o treino em andamento continua guardado
    return;
  }
  const exercises = buildLiveWorkoutExercises();
  if (!exercises.length) return;
  const typedTitle = document.getElementById("live-title").value.trim();
  const saveRoutine = document.getElementById("live-save-routine").checked;
  if (saveRoutine && !typedTitle) {
    showPageMessage("Dê um nome ao treino (por exemplo: Treino A) para salvar como modelo.", { title: "Falta o nome" });
    return;
  }
  const calories = Number(document.getElementById("live-calories").value);
  const routinesBefore = JSON.parse(JSON.stringify(healthDb.strengthRoutines));
  const routineId = saveRoutine ? saveLiveRoutine(typedTitle, exercises) : liveSession.routineId;
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "strength",
    title: typedTitle || (liveSession.title === "Treino livre" ? "Treino de força" : liveSession.title),
    date: liveSession.date,
    durationMinutes: Math.max(1, Math.round((Date.now() - liveSession.startedAt) / 60000)),
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    distanceKm: null,
    pushups: null,
    situps: null,
    squats: null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: document.getElementById("live-notes").value.trim(),
    routineId: routineId || "",
    exercises,
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
    healthDb.strengthRoutines = routinesBefore;
    return;
  }
  closeTobaModal("liveFinishModal");
  dropLiveSession();
  stopLiveTicker();
  openStrengthSummary(workout.id, "viewTraining");
}

tobaActions({
  openLiveStart,
  startLiveRoutine: (el) => startLiveSession(el.dataset.routine),
  startLiveFree: () => startLiveSession(""),
  resumeLiveSession: () => {
    liveSession = readLiveSession().session;
    openLiveSessionView();
  },
  discardLiveSession,
  leaveLiveSession,
  liveToggleSet,
  liveFocusSet,
  liveAddSet,
  liveRemoveSet,
  liveGoTo,
  liveToggleSkip,
  openLiveExercisePicker,
  livePickGroup,
  liveAddExercise,
  liveRestPreset,
  liveRestNudge,
  liveEndRest,
  liveToggleRestMin,
  openLiveFinish,
  finishLiveSession,
});
