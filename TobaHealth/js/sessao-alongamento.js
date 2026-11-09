/* =====================================================================
 * Toba Health · 🧘 Alongamento ao vivo (desde v1.84)
 * Pedido do Rafa (pino no dente, ~15 dias sem Saitama): treino de casa de
 * 10 ou 20 min, um exercício por vez, timer igual ao do Saitama e um
 * bonequinho desenhado (SVG) de cada posição no lugar de foto.
 *
 * Catálogo e planos moram em health-metrics.js (STRETCH_EXERCISES,
 * STRETCH_PLANS, buildStretchSteps): o mapa de calor das outras páginas usa.
 *
 * Usa a MESMA chave do treino ao vivo (TOBA_HEALTH_ACTIVE_SESSION) com
 * kind "stretch", exercises: [] e:
 *   liveSession.stretch = {
 *     plan: "s10"|"s20", step: índice em buildStretchSteps(plan),
 *     endsAt: ms (fim do passo atual; null = pausado), left: ms (pausado),
 *     pausedAt: ms|null, pausedMs: ms parados, held: { exerciseId: segundos },
 *     finished: bool, finishedAt: ms|null
 *   }
 * Tempos são horários (Date.now()): com a aba congelada o tique recupera
 * todos os passos que passaram. Ao salvar vira um treino "stretch" normal:
 *   { type: "stretch", title: "Alongamento 10 min", durationMinutes, calories,
 *     stretch: { plan, held }, ... campos de número null }
 * Vale XP, sequência, conquistas e Hall como qualquer treino.
 *
 * Carregado DEPOIS de sessao.js e ANTES de treinos.js.
 * ===================================================================== */

const STRETCH_TYPE_TITLE = "Alongamento";
const STRETCH_KCAL_MET = 2.3; // MET de alongamento leve (kcal = MET × kg × horas)

const STRETCH_QUIPS = [
  "Respira. Alongar com pressa é só se esticar nervoso.",
  "Sem trincar os dentes: o pino agradece 🦷",
  "Dói bom? Fica. Dói ruim? Afrouxa.",
  "O Saitama também alongava. Provavelmente.",
  "Elástico velho estoura. Elástico treinado vira lenda.",
  "Solta o ombro da orelha. Isso, aí mesmo.",
  "Killua e Gon se alongam 40 vezes por dia. Copia os mestres 🐈",
  "Celular no chão, olho no teto. Respira.",
];

/* ---------------------------------------------------------------------
 * Bonequinho de cada posição (SVG à mão, 120 × 90, chão em y = 86)
 * base = traços normais; hl = parte que estica (cor de destaque);
 * extra = parede, batente, círculo de movimento...
 * ------------------------------------------------------------------- */
const STRETCH_FIGURES = {
  "bracos-circulo": { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 52, 86], [60, 52, 68, 86]], hl: [[60, 30, 34, 30], [60, 30, 86, 30]], extra: '<circle cx="34" cy="30" r="7" class="sf-dash"/><circle cx="86" cy="30" r="7" class="sf-dash"/>' },
  pescoco: { head: [52, 16], base: [[60, 30, 60, 54], [60, 54, 53, 86], [60, 54, 67, 86], [60, 30, 70, 52]], hl: [[56, 22, 60, 30]], arms: [[60, 30, 42, 24, 40, 10, 50, 6]] },
  "ombro-cruzado": { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 53, 86], [60, 52, 67, 86], [60, 30, 70, 38, 50, 33]], hl: [[60, 30, 36, 32]] },
  "triceps-nuca": { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 53, 86], [60, 52, 67, 86], [60, 28, 47, 18, 64, 6]], hl: [[60, 28, 66, 4, 58, 20]] },
  "peito-porta": { head: [64, 14], base: [[64, 22, 62, 52], [62, 52, 56, 86], [62, 52, 70, 86], [64, 30, 76, 46]], hl: [[64, 30, 40, 30, 40, 14]], extra: '<line x1="36" y1="2" x2="36" y2="86" class="sf-wall"/>' },
  antebraco: { head: [52, 14], base: [[52, 22, 52, 52], [52, 52, 45, 86], [52, 52, 59, 86], [52, 32, 72, 38, 88, 22]], hl: [[52, 30, 86, 30, 90, 22]] },
  "gato-vaca": { head: [22, 64], base: [[32, 56, 32, 86], [80, 58, 80, 86, 102, 86]], hl: [], path: ["M32 56 Q56 34 80 58"], hlPath: ["M32 56 Q56 34 80 58"], extra: '<path d="M44 32 q12 -8 24 0" class="sf-dash sf-arrow"/>' },
  crianca: { head: [30, 80], base: [[72, 86, 96, 86], [82, 74, 72, 86], [42, 78, 14, 84]], hl: [], hlPath: ["M82 74 Q64 58 42 78"] },
  esfinge: { head: [28, 52], base: [[60, 84, 104, 84], [38, 64, 38, 84, 20, 84]], hl: [[60, 84, 36, 62]] },
  torcao: { head: [56, 40], base: [[56, 84, 100, 84], [56, 84, 78, 64, 84, 84], [56, 56, 40, 80]], hl: [[56, 84, 56, 48]], arms: [[56, 56, 78, 64]] },
  quadriceps: { head: [62, 14], base: [[62, 22, 62, 52], [62, 52, 62, 86], [62, 30, 40, 34], [62, 30, 74, 46, 78, 54]], hl: [[62, 52, 66, 72, 78, 54]], extra: '<line x1="36" y1="2" x2="36" y2="86" class="sf-wall"/>' },
  posterior: { head: [80, 26], base: [[56, 56, 76, 32], [56, 56, 48, 72, 52, 86], [72, 38, 68, 56]], hl: [[56, 56, 84, 84, 86, 76]] },
  "afundo-quadril": { head: [56, 22], base: [[56, 30, 56, 60], [56, 60, 80, 62, 80, 86], [56, 38, 66, 52]], hl: [[56, 60, 42, 84, 18, 86]] },
  figura4: { head: [12, 80], base: [[20, 82, 54, 82], [32, 80, 60, 66]], hl: [[54, 82, 66, 58, 84, 62], [54, 82, 74, 72, 64, 58]] },
  panturrilha: { head: [70, 22], base: [[58, 54, 66, 30], [58, 54, 74, 66, 76, 86], [66, 34, 94, 34]], hl: [[58, 54, 30, 86]], extra: '<line x1="98" y1="2" x2="98" y2="86" class="sf-wall"/>' },
  borboleta: { head: [60, 40], base: [[60, 48, 60, 78], [60, 58, 54, 82], [60, 58, 66, 82]], hl: [[60, 80, 36, 72, 56, 85], [60, 80, 84, 72, 64, 85]] },
  relax: { head: [14, 78], base: [[22, 80, 72, 80], [72, 80, 106, 82], [72, 80, 104, 76], [36, 80, 48, 74, 56, 78]], hl: [], extra: '<text x="74" y="60" class="sf-z">z</text><text x="84" y="50" class="sf-z sf-z2">z</text>' },
};

function stretchPolyPath(points) {
  let d = "";
  for (let i = 0; i < points.length; i += 2) d += `${i ? " L" : "M"}${points[i]} ${points[i + 1]}`;
  return d;
}

// tamanho: "lg" (tela do treino) ou "sm" (listas)
function stretchFigureSvg(exerciseId, { size = "lg", side = "" } = {}) {
  const fig = STRETCH_FIGURES[exerciseId] || STRETCH_FIGURES.relax;
  const lines = (list, cls) => (list || []).map((pts) => `<path d="${stretchPolyPath(pts)}" class="${cls}"/>`).join("");
  const paths = (list, cls) => (list || []).map((d) => `<path d="${d}" class="${cls}"/>`).join("");
  // Lado esquerdo = espelha o desenho (o bonequinho troca de lado junto com você)
  const flip = side === "L" ? ' transform="translate(120 0) scale(-1 1)"' : "";
  const name = getStretchExercise(exerciseId)?.name || "Alongamento";
  return `
    <svg class="stretch-fig is-${size}" viewBox="0 0 120 90" role="img" aria-label="Bonequinho: ${escapeHtml(name)}">
      <line x1="2" y1="87" x2="118" y2="87" class="sf-floor"/>
      <g${flip}>
        ${fig.extra || ""}
        ${lines(fig.base, "sf-body")}${paths(fig.path, "sf-body")}
        ${lines(fig.arms, "sf-body")}
        ${lines(fig.hl, "sf-hl")}${paths(fig.hlPath, "sf-hl")}
        <circle cx="${fig.head[0]}" cy="${fig.head[1]}" r="7" class="sf-head"/>
      </g>
    </svg>`;
}

/* ---------------------------------------------------------------------
 * Estado
 * ------------------------------------------------------------------- */
function normalizeStretchLive(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const plan = getStretchPlan(data.plan) ? data.plan : "s10";
  const total = buildStretchSteps(plan).length;
  const held = {};
  if (data.held && typeof data.held === "object") {
    Object.entries(data.held).forEach(([id, secs]) => {
      if (getStretchExercise(id) && Number(secs) > 0) held[id] = Math.round(Number(secs));
    });
  }
  return {
    plan,
    step: Math.min(Math.max(0, Math.round(Number(data.step) || 0)), Math.max(0, total - 1)),
    endsAt: Number(data.endsAt) || null,
    left: Math.max(0, Number(data.left) || 0),
    pausedAt: Number(data.pausedAt) || null,
    pausedMs: Math.max(0, Number(data.pausedMs) || 0),
    held,
    finished: Boolean(data.finished),
    finishedAt: Number(data.finishedAt) || null,
  };
}

function stretchSteps(session = liveSession) {
  return buildStretchSteps(session?.stretch?.plan || "s10");
}

function stretchHeldSeconds(data) {
  return Object.values(data.held || {}).reduce((sum, secs) => sum + (Number(secs) || 0), 0);
}

function stretchMovingMs(session, now = Date.now()) {
  const data = session.stretch;
  const paused = data.pausedAt ? now - data.pausedAt : 0;
  const end = data.finished && data.finishedAt ? data.finishedAt : now;
  return Math.max(0, end - session.startedAt - data.pausedMs - (data.finished ? 0 : paused));
}

function stretchRemainingSeconds(session, now = Date.now()) {
  const data = session.stretch;
  const steps = stretchSteps(session);
  if (data.finished) return 0;
  const current = data.endsAt ? Math.max(0, data.endsAt - now) : data.left;
  const after = steps.slice(data.step + 1).reduce((sum, step) => sum + step.secs, 0);
  return Math.round(current / 1000) + after;
}

// "3 de 16 · Ombro cruzado" (aviso de treino em andamento)
function describeStretchLive(session) {
  const data = session.stretch;
  const steps = stretchSteps(session);
  const holds = steps.filter((step) => step.kind === "hold");
  const done = steps.slice(0, data.step).filter((step) => step.kind === "hold").length;
  const plan = getStretchPlan(data.plan);
  if (data.finished) return `${plan?.short || ""} completo, falta salvar`;
  return `${done}/${holds.length} posições · ${data.endsAt ? "rolando" : "⏸ pausado"}`;
}

function readStretchPrefs() {
  const prefs = readLivePrefs();
  return { voice: prefs.stretchVoice !== false };
}

/* ---------------------------------------------------------------------
 * Voz e vibração (no APK 1.6+ a voz é a nativa: fala com a tela apagada)
 * ------------------------------------------------------------------- */
function stretchSpeak(text) {
  if (!readStretchPrefs().voice || !text) return;
  try {
    if (TOBA_NATIVE && typeof TOBA_NATIVE.speak === "function") {
      TOBA_NATIVE.speak(String(text), true);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const say = new SpeechSynthesisUtterance(String(text));
    say.lang = "pt-BR";
    say.rate = 1;
    window.speechSynthesis.speak(say);
  } catch (err) {
    /* sem voz: segue só com a vibração */
  }
}

function stretchAnnounce(step, steps) {
  if (!step) return;
  const exercise = getStretchExercise(step.exerciseId);
  const sideText = step.side === "R" ? "lado direito" : step.side === "L" ? "lado esquerdo" : "";
  if (step.kind === "prep") {
    const prev = steps[steps.indexOf(step) - 1];
    const switching = prev && prev.exerciseId === step.exerciseId;
    liveBuzz(120);
    stretchSpeak(switching ? `Troca de lado. ${sideText}` : `Próximo: ${exercise?.name || ""}${sideText ? `, ${sideText}` : ""}`);
  } else {
    liveBuzz([60, 60, 60]);
    stretchSpeak(step.exerciseId === "relax" ? "Agora respira e relaxa" : "Segura");
  }
}

/* ---------------------------------------------------------------------
 * Começar
 * ------------------------------------------------------------------- */
function renderStretchLiveStartCard() {
  const count = (healthDb.workouts || []).filter((workout) => workout.type === "stretch").length;
  const cards = STRETCH_PLANS.map((plan) => {
    const holds = buildStretchSteps(plan.id).filter((step) => step.kind === "hold");
    const distinct = new Set(holds.map((step) => step.exerciseId).filter((id) => id !== "relax")).size;
    return `
      <button type="button" class="toba-menu-btn live-stretch-btn" data-click="startStretchLive" data-plan="${plan.id}">
        <span class="toba-menu-icon">${plan.icon}</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">${escapeHtml(plan.name)}</span>
          <span class="toba-menu-desc">${escapeHtml(plan.desc)} ${distinct} posições</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>`;
  }).join("");
  return `
    <div class="hub-title">Alongamento em casa${count ? ` · feito ${count}×` : ""}</div>
    <div class="toba-menu">${cards}</div>
    <div class="section-divider"></div>`;
}

function startStretchLive(planId) {
  const plan = getStretchPlan(planId) || STRETCH_PLANS[0];
  const steps = buildStretchSteps(plan.id);
  const now = Date.now();
  liveSession = {
    v: 1,
    id: `s-${now}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "stretch",
    startedAt: now,
    date: toIsoDate(),
    routineId: "",
    title: plan.name,
    current: 0,
    exercises: [],
    stretch: normalizeStretchLive({ plan: plan.id, step: 0, endsAt: now + steps[0].secs * 1000 }),
    rest: { duration: LIVE_REST_DEFAULT, startedAt: null, endsAt: null, alerted: false },
    restDefault: LIVE_REST_DEFAULT,
    updatedAt: now,
  };
  storeLiveSession();
  closeTobaModal("liveStartModal");
  closeTobaModal("workoutModal");
  openLiveSessionView();
  stretchAnnounce(steps[0], steps);
}

/* ---------------------------------------------------------------------
 * Tique: avança os passos que já passaram (mesmo com a aba congelada)
 * ------------------------------------------------------------------- */
function stretchCredit(data, step, secs) {
  if (step.kind !== "hold" || !(secs > 0)) return;
  data.held[step.exerciseId] = Math.round((data.held[step.exerciseId] || 0) + secs);
}

function stretchTick(now = Date.now()) {
  const data = liveSession?.stretch;
  if (!data || data.finished || !data.endsAt) {
    updateStretchClock(now);
    return;
  }
  const steps = stretchSteps();
  let moved = false;
  while (data.endsAt && now >= data.endsAt && !data.finished) {
    const step = steps[data.step];
    stretchCredit(data, step, step.secs);
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
      stretchSpeak("Acabou! Alongamento completo. Salva aí no Toba.");
    } else if (now - (data.endsAt - steps[data.step].secs * 1000) < 2500) {
      stretchAnnounce(steps[data.step], steps); // só avisa o passo de agora, não os que passaram no bolso
    }
    renderLiveSession();
    return;
  }
  updateStretchClock(now);
}

// Só textos e anel (roda a cada 250 ms)
function updateStretchClock(now = Date.now()) {
  const session = liveSession;
  const data = session?.stretch;
  if (!data) return;
  const clock = document.getElementById("liveClock");
  if (clock) clock.textContent = formatLiveClock(stretchMovingMs(session, now));
  if (data.finished) return;
  const step = stretchSteps(session)[data.step];
  const leftMs = data.endsAt ? Math.max(0, data.endsAt - now) : data.left;
  const time = document.getElementById("stretchTime");
  if (time) time.textContent = String(Math.ceil(leftMs / 1000));
  const ring = document.getElementById("stretchRing");
  if (ring && step) {
    const fraction = Math.min(1, Math.max(0, leftMs / (step.secs * 1000)));
    ring.style.strokeDashoffset = (LIVE_RING * (1 - fraction)).toFixed(1);
  }
  const remaining = document.getElementById("stretchRemaining");
  if (remaining) remaining.textContent = `faltam ${formatLiveClock(stretchRemainingSeconds(session, now) * 1000)}`;
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderStretchLive(session) {
  const data = session.stretch;
  const plan = getStretchPlan(data.plan);
  const steps = stretchSteps(session);
  const holds = steps.filter((step) => step.kind === "hold");
  const doneHolds = steps.slice(0, data.step).filter((step) => step.kind === "hold").length;
  const percent = data.finished ? 100 : Math.round((doneHolds / Math.max(1, holds.length)) * 100);
  const top = `
    <div class="live-top">
      <div class="live-top-text">
        <span class="live-badge">● AO VIVO</span>
        <strong class="live-title">🧘 ${escapeHtml(session.title)}</strong>
      </div>
      <div class="live-clock" id="liveClock" role="timer" aria-label="Tempo de alongamento">${formatLiveClock(stretchMovingMs(session))}</div>
    </div>
    <div class="live-progress">
      <div class="live-progress-bar"><span style="width: ${percent}%"></span></div>
      <span class="live-progress-text">${data.finished ? holds.length : Math.min(doneHolds + 1, holds.length)}/${holds.length} posições · <span id="stretchRemaining">faltam ${formatLiveClock(stretchRemainingSeconds(session) * 1000)}</span></span>
    </div>`;

  if (data.finished) return top + renderStretchDone(session);

  const step = steps[data.step];
  const exercise = getStretchExercise(step.exerciseId);
  const isPrep = step.kind === "prep";
  const paused = !data.endsAt;
  const nextHold = steps.slice(data.step + 1).find((item) => item.kind === "hold" && (item.exerciseId !== step.exerciseId || item.side !== step.side));
  const nextExercise = nextHold ? getStretchExercise(nextHold.exerciseId) : null;
  const sideLabel = step.side === "R" ? "👉 Lado direito" : step.side === "L" ? "👈 Lado esquerdo" : "";
  const quip = STRETCH_QUIPS[(data.step + session.startedAt) % STRETCH_QUIPS.length];

  return `${top}
    <div class="stretch-stage${isPrep ? " is-prep" : ""}${paused ? " is-paused" : ""}">
      <div class="stretch-phase">${paused ? "⏸ Pausado" : isPrep ? "Prepara..." : "Segura!"}${sideLabel ? ` <span class="stretch-side">${sideLabel}</span>` : ""}</div>
      ${stretchFigureSvg(step.exerciseId, { size: "lg", side: step.side })}
      <div class="stretch-name">${escapeHtml(exercise?.name || "")}</div>
      <div class="stretch-timer">
        <div class="stretch-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="live-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="live-ring-fg stretch-ring-fg" id="stretchRing" cx="60" cy="60" r="52" stroke-dasharray="${LIVE_RING.toFixed(1)}"></circle>
          </svg>
          <strong class="stretch-time" id="stretchTime" role="timer">${Math.ceil((data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left) / 1000)}</strong>
        </div>
        <p class="stretch-how">${escapeHtml(exercise?.how || "")}</p>
      </div>
      ${exercise?.tip ? `<p class="stretch-tip">💡 ${escapeHtml(exercise.tip)}</p>` : ""}
    </div>

    <div class="stretch-controls">
      <button type="button" class="btn btn-secondary" data-click="stretchBack" aria-label="Voltar uma posição">‹ Voltar</button>
      <button type="button" class="btn ${paused ? "btn-primary" : "btn-secondary"}" data-click="stretchTogglePause">${paused ? "▶ Continuar" : "⏸ Pausar"}</button>
      <button type="button" class="btn btn-secondary" data-click="stretchSkip" aria-label="Pular esta posição">Pular ⏭</button>
    </div>

    ${nextExercise ? `
      <div class="stretch-next">
        ${stretchFigureSvg(nextHold.exerciseId, { size: "sm", side: nextHold.side })}
        <span><small>Depois</small><strong>${escapeHtml(nextExercise.name)}${nextHold.side ? ` · ${nextHold.side === "R" ? "direito" : "esquerdo"}` : ""}</strong></span>
      </div>` : ""}

    <p class="live-hint stretch-quip">${escapeHtml(quip)}</p>

    <div class="live-footer">
      <label class="live-check">
        <input type="checkbox" data-change="stretchToggleVoice"${readStretchPrefs().voice ? " checked" : ""} />
        <span>🔊 Voz avisando a troca (dá pra fazer sem olhar a tela)</span>
      </label>
      ${renderLiveVoiceExtra("stretchTestVoice")}
      ${renderLiveAwakeToggle()}
      <button type="button" class="btn btn-primary live-finish" data-click="stretchFinishNow">🏁 Terminar agora</button>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Cancelar treino</button>
    </div>`;
}

// Fim: resumo + salvar ali mesmo (sem folha por cima)
function renderStretchDone(session) {
  const data = session.stretch;
  const heldSecs = stretchHeldSeconds(data);
  const minutes = Math.max(1, Math.round(stretchMovingMs(session) / 60000));
  const kcal = estimateStretchKcal(minutes, session.date);
  const done = Object.keys(data.held).filter((id) => id !== "relax");
  const figures = done.slice(0, 18).map((id) => `<span class="stretch-done-fig" title="${escapeHtml(getStretchExercise(id)?.name || id)}">${stretchFigureSvg(id, { size: "sm" })}</span>`).join("");
  return `
    <div class="stretch-done">
      <div class="stretch-done-title">🎉 Esticado e aprovado!</div>
      <p class="toba-sheet-text">${done.length} ${done.length === 1 ? "posição" : "posições"} · ${formatLiveClock(heldSecs * 1000)} segurando · ${minutes} min no total. Vale XP, sequência e troféu igual treino. O careca respeita 🦲</p>
      ${figures ? `<div class="stretch-done-figs">${figures}</div>` : ""}
      <form data-submit="saveStretchLive">
        <div class="grid-2">
          <div class="form-group">
            <label for="stretch-calories">Calorias (kcal)</label>
            <input id="stretch-calories" class="form-control" type="number" inputmode="numeric" min="0" step="1" value="${kcal || ""}" />
          </div>
          <div class="form-group">
            <label for="stretch-minutes">Tempo (min)</label>
            <input id="stretch-minutes" class="form-control" type="number" inputmode="numeric" min="1" step="1" value="${minutes}" />
          </div>
        </div>
        <div class="form-group">
          <label for="stretch-notes">Observações (opcional)</label>
          <input id="stretch-notes" class="form-control" type="text" maxlength="160" placeholder="Como o corpo tá?" />
        </div>
        ${renderLiveWatchCheck("stretch-watch-pending")}
        <button type="submit" class="btn btn-primary live-finish">Salvar alongamento 🧘</button>
      </form>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Jogar fora</button>
    </div>`;
}

function estimateStretchKcal(minutes, date) {
  const kg = typeof getBodyWeightOn === "function" ? getBodyWeightOn(date) : 75;
  return Math.round(STRETCH_KCAL_MET * (Number(kg) || 75) * (minutes / 60));
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
function stretchTogglePause() {
  const data = liveSession?.stretch;
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

// Vai pro passo `index` (começa no "Prepara" dele) mantendo pausado/rodando
function stretchGoTo(index) {
  const data = liveSession.stretch;
  const steps = stretchSteps();
  data.step = Math.min(Math.max(0, index), steps.length - 1);
  const ms = steps[data.step].secs * 1000;
  if (data.endsAt) data.endsAt = Date.now() + ms;
  else data.left = ms;
  storeLiveSession();
  renderLiveSession();
  if (data.endsAt) stretchAnnounce(steps[data.step], steps);
}

function stretchSkip() {
  const data = liveSession?.stretch;
  if (!data || data.finished) return;
  const steps = stretchSteps();
  const step = steps[data.step];
  const leftMs = data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left;
  stretchCredit(data, step, Math.floor((step.secs * 1000 - leftMs) / 1000)); // o que segurou vale
  if (data.step >= steps.length - 1) {
    stretchFinishNow();
    return;
  }
  // No "Prepara" pula a posição inteira; segurando, vai pro próximo
  stretchGoTo(step.kind === "prep" ? data.step + 2 : data.step + 1);
}

function stretchBack() {
  const data = liveSession?.stretch;
  if (!data || data.finished) return;
  const steps = stretchSteps();
  const step = steps[data.step];
  const leftMs = data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left;
  const into = step.secs * 1000 - leftMs;
  // Já segurando há mais de 3 s: recomeça esta; senão volta pra anterior
  const startOfThis = step.kind === "hold" ? data.step - 1 : data.step;
  stretchGoTo(into > 3000 && step.kind === "hold" ? startOfThis : startOfThis - 2);
}

function stretchFinishNow() {
  const data = liveSession?.stretch;
  if (!data) return;
  if (!data.finished) {
    const steps = stretchSteps();
    const step = steps[data.step];
    const leftMs = data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left;
    if (step) stretchCredit(data, step, Math.floor((step.secs * 1000 - leftMs) / 1000));
    if (data.pausedAt) data.pausedMs += Date.now() - data.pausedAt;
    data.pausedAt = null;
    data.finished = true;
    data.finishedAt = Date.now();
    data.endsAt = null;
  }
  storeLiveSession();
  renderLiveSession();
  window.scrollTo(0, 0);
}

function stretchToggleVoice(el) {
  storeLivePrefs({ stretchVoice: el.checked });
  tobaToast(el.checked ? "🔊 O Toba avisa cada troca" : "🔇 Só vibração");
}

// v2.04: 🔊 Testar a voz (fala mesmo com a chavinha desligada)
function stretchTestVoice() {
  storeLivePrefs({ stretchVoice: true });
  stretchSpeak("Teste de voz do Cloba. Nunca foi sorte.");
  renderLiveSession();
}

function saveStretchLive() {
  if (!liveSession?.stretch) return;
  if (!isHealthDbLoaded) {
    showHealthDbLockedMessage();
    return;
  }
  const data = liveSession.stretch;
  if (!stretchHeldSeconds(data)) {
    showPageMessage("Nenhuma posição segurada ainda. Se quiser jogar fora, use Jogar fora.", { title: "Nada pra salvar" });
    return;
  }
  const plan = getStretchPlan(data.plan);
  const minutes = Number(document.getElementById("stretch-minutes").value);
  const calories = Number(document.getElementById("stretch-calories").value);
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "stretch",
    title: plan ? plan.name : STRETCH_TYPE_TITLE,
    date: liveSession.date,
    durationMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : Math.max(1, Math.round(stretchMovingMs(liveSession) / 60000)),
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    distanceKm: null,
    pushups: null,
    situps: null,
    squats: null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: document.getElementById("stretch-notes").value.trim(),
    stretch: { plan: data.plan, held: { ...data.held } },
  };
  // v2.04: horário + ⌚ mesclar com o relógio
  const startTime = liveStartClock(liveSession.startedAt);
  if (startTime) workout.startTime = startTime;
  liveApplyWatchPending(workout, "stretch-watch-pending");
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
  tobaPlayerCheck({ reason: "Alongamento no histórico 🧘" });
  openModule("viewTraining");
  openWorkoutView(workout.id);
  tobaToast("🧘 Alongamento no histórico!");
}

/* ---------------------------------------------------------------------
 * Página do treino: as posições feitas, com o bonequinho
 * ------------------------------------------------------------------- */
function renderStretchWorkoutDetail(workout) {
  if (workout.type !== "stretch") return "";
  const held = getStretchHeld(workout);
  const items = Object.entries(held)
    .filter(([id, secs]) => id !== "relax" && Number(secs) > 0 && getStretchExercise(id))
    .map(([id, secs]) => `
      <div class="stretch-row">
        ${stretchFigureSvg(id, { size: "sm" })}
        <span class="stretch-row-text"><strong>${escapeHtml(getStretchExercise(id).name)}</strong><small>${formatLiveSeconds(secs)} segurando</small></span>
      </div>`).join("");
  if (!items) return "";
  const live = workout.stretch && workout.stretch.held ? "" : '<p class="live-hint">Anotado na mão: mostra o plano inteiro.</p>';
  return `<div class="section-title">🧘 Posições</div><div class="card stretch-list">${items}${live}</div>`;
}

/* ---------------------------------------------------------------------
 * Formulário "anotar alongamento" (+ Treino › 🧘 Alongamento)
 * ------------------------------------------------------------------- */
function renderStretchFormFields() {
  return `
    <div class="hub-title">Fazer agora, com timer e bonequinho</div>
    <div class="stretch-form-start">
      ${STRETCH_PLANS.map((plan) => `<button type="button" class="btn btn-primary" data-click="openStretchIntro" data-plan="${plan.id}">▶ ${escapeHtml(plan.short)}</button>`).join("")}
    </div>
    <div class="walk-or">ou anota um que já fez 👇</div>
    <div class="form-group">
      <label for="workout-stretch-plan">Qual</label>
      <select id="workout-stretch-plan" class="form-control">
        ${STRETCH_PLANS.map((plan) => `<option value="${plan.id}">${escapeHtml(plan.name)}</option>`).join("")}
        <option value="">Outro alongamento</option>
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
      <input id="workout-notes" class="form-control" type="text" maxlength="160" placeholder="Como o corpo tá?" />
    </div>`;
}

function fillStretchForm(workout) {
  const select = document.getElementById("workout-stretch-plan");
  if (select) select.value = getStretchPlan(workout.stretch?.plan) ? workout.stretch.plan : "";
  const notes = document.getElementById("workout-notes");
  if (notes) notes.value = workout.notes || "";
  const start = document.querySelector(".stretch-form-start");
  if (start) start.hidden = true;
  start?.previousElementSibling?.setAttribute("hidden", "");
  const or = start?.nextElementSibling;
  if (or) or.hidden = true;
}

// title + stretch do salvar do formulário (mantém os segundos do ao vivo)
function readStretchFormExtras(original) {
  const planId = document.getElementById("workout-stretch-plan")?.value || "";
  const plan = getStretchPlan(planId);
  const stretch = { ...(original && original.stretch && typeof original.stretch === "object" ? original.stretch : {}), plan: plan ? plan.id : "" };
  if (original?.stretch?.plan !== stretch.plan) delete stretch.held; // trocou o plano: os segundos de antes não valem
  return { title: plan ? plan.name : STRETCH_TYPE_TITLE, stretch };
}

tobaActions({
  startStretchLive: (el) => startStretchLive(el.dataset.plan),
  stretchTogglePause,
  stretchSkip,
  stretchBack,
  stretchFinishNow,
  stretchToggleVoice,
  stretchTestVoice,
  saveStretchLive,
});
