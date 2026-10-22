/* =====================================================================
 * Toba Routine · módulo Rotina (Hoje / Tarefas / Histórico)
 * Página TobaRoutine-Rotina.html (desde v1.42; antes era o Index, que virou hub).
 * Depende de toba-common.js, routine-metrics.js, routine-core.js,
 * health-metrics.js + toba-player.js (XP), routine-alerts.js (avisos) e
 * routine-plan.js (Meu dia fixo e as sessões de task que caem hoje) e
 * routine-task-sheet.js (folha da tarefa e a regra de marcar, desde v1.49).
 * ===================================================================== */
const ROUTINE_SUGGESTIONS = [
  { emoji: "🚽", name: "Lavar o banheiro", recurrence: { type: "weekly", days: ["SA"] }, time: "10:00", difficulty: "medium", on: true },
  { emoji: "🪴", name: "Regar as plantas", recurrence: { type: "weekly", days: ["MO", "TH"] }, time: "08:00", difficulty: "easy", on: true },
  { emoji: "🐕", name: "Passear com o cachorro", recurrence: { type: "daily" }, time: "19:00", difficulty: "medium", on: true },
  { emoji: "😴", name: "Dormir na hora certa", recurrence: { type: "daily" }, time: "23:00", difficulty: "hard", carryOver: false, on: true },
  { emoji: "🗑️", name: "Tirar o lixo", recurrence: { type: "weekly", days: ["MO", "WE", "FR"] }, time: "20:00", difficulty: "easy", on: false },
  { emoji: "💧", name: "Beber 2 litros de água", recurrence: { type: "daily" }, time: "", difficulty: "easy", on: false },
  { emoji: "🧺", name: "Lavar roupa", recurrence: { type: "situational" }, time: "", difficulty: "medium", on: false },
  { emoji: "💸", name: "Pagar as contas", recurrence: { type: "monthly", monthDay: 5 }, time: "09:00", difficulty: "medium", on: false },
];

const ROUTINE_VIEW_TITLES = { viewToday: "✅ Hoje", viewTasks: "📋 Tarefas", viewHistory: "📜 Histórico" };
let routineView = "viewToday";
let routineHighlight = null; // { taskId, date } vindo da notificação

/* ---------------------------------------------------------------------
 * Ajudantes
 * ------------------------------------------------------------------- */
function activeRoutineTasks() {
  return routineDb.tasks.filter((t) => !t.archivedAt);
}

function sortRoutineTasks(list) {
  return [...list].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.name.localeCompare(b.name));
}

function describeRoutineWhen(task) {
  const rec = task.recurrence;
  let when = "Quando acontecer";
  if (rec.type === "daily") when = "Todo dia";
  if (rec.type === "weekly") {
    const days = TOBA_WEEK_DAYS.filter(([code]) => (rec.days || []).includes(code)).map(([, label]) => label);
    when = days.length === 7 ? "Todo dia" : days.join(", ");
  }
  if (rec.type === "monthly") when = `Todo dia ${rec.monthDay}`;
  return task.time ? `${when} · ⏰ ${task.time}` : when;
}

function describeRoutineDay(iso, today) {
  const diff = Math.round((new Date(`${today}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  const weekday = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function routineTodayXp(today) {
  return calcRoutinePlayer(routineDb, today).events.filter((e) => e.date === today).reduce((sum, e) => sum + e.xp, 0);
}

function renderRoutineTask(task, date, { done = false, overdue = false, streak = 0, swipe = false } = {}) {
  const diff = routineDifficulty(task.difficulty);
  const xp = overdue ? Math.round(diff.xp / 2) : diff.xp;
  const highlight = routineHighlight && routineHighlight.taskId === String(task.id) && routineHighlight.date === date;
  const meta = [
    task.time ? `⏰ ${task.time}` : "",
    `${diff.icon} ${diff.name}`,
    `+${xp} XP`,
    streak >= 2 ? `🔥 ${streak}` : "",
    !done && !routineCarriesOver(task) ? "⌛ só hoje" : "",
  ].filter(Boolean).join(" · ");
  const card = `
    <div class="rt-task${done ? " is-done" : ""}${overdue ? " is-overdue" : ""}${highlight ? " is-highlight" : ""}" id="rt-${escapeHtml(task.id)}-${date}">
      <button type="button" class="rt-check" data-click="toggleTask" data-id="${escapeHtml(task.id)}" data-date="${date}" aria-pressed="${done}" aria-label="${done ? "Desmarcar" : "Marcar como feita"}: ${escapeHtml(task.name)}">${done ? "✓" : ""}</button>
      <div class="rt-task-body" role="button" tabindex="0" data-click="editTask" data-id="${escapeHtml(task.id)}">
        <span class="rt-task-name"><span class="rt-task-emoji">${escapeHtml(task.emoji)}</span>${escapeHtml(task.name)}</span>
        <span class="rt-task-meta">${meta}</span>
      </div>
    </div>`;
  if (!swipe) return card;
  // Atrasada: deslizar pro lado = deixar pra lá (v1.47)
  return `
    <div class="rt-swipe" data-id="${escapeHtml(task.id)}" data-date="${date}">
      <div class="rt-swipe-bg" aria-hidden="true"><span>🗑️ Deixar pra lá</span><span>Deixar pra lá 🗑️</span></div>
      ${card}
    </div>`;
}

/* ---------------------------------------------------------------------
 * Hoje
 * ------------------------------------------------------------------- */
function renderRoutineHero(today) {
  const summary = calcRoutineToday(routineDb, today);
  const ratio = summary.total ? summary.done / summary.total : 0;
  const xp = routineTodayXp(today);
  let line = "Nada agendado pra hoje. Folga merecida (ou falta cadastrar? 👀)";
  if (summary.total && summary.done === summary.total) line = "Tudo feito! Pode deitar no sofá com a consciência limpa 🛋️";
  else if (summary.total && summary.done) line = `Faltam ${summary.total - summary.done}. Tá quase, campeão!`;
  else if (summary.total) line = `${summary.total} ${summary.total === 1 ? "tarefa" : "tarefas"} pra hoje. A rotina não vai se mandar sozinha.`;
  const state = typeof tobaPlayerState === "object" && tobaPlayerState ? tobaPlayerState : null;
  document.getElementById("rtHero").innerHTML = `
    <div class="rt-hero-top">
      <div class="rt-ring" style="--p:${Math.round(ratio * 100)}">
        <span>${summary.done}/${summary.total}</span>
      </div>
      <div class="rt-hero-text">
        <strong>${line}</strong>
        <span>✨ +${formatPlayerNumber(xp)} XP de rotina hoje${summary.overdue ? ` · ⏰ ${summary.overdue} ${summary.overdue === 1 ? "atrasada" : "atrasadas"}` : ""}</span>
      </div>
    </div>
    ${state ? `<a class="rt-hero-level" href="../Toba-Perfil.html">${renderPlayerAvatar(state, "sm")}<span><strong>Nível ${state.level} · ${escapeHtml(getPlayerLook(state).title.name)}</strong><span>${formatPlayerNumber(state.into)}/${formatPlayerNumber(state.need)} XP para o nível ${state.level + 1}</span>${renderPlayerBar(state.ratio)}</span><span class="rt-chevron">›</span></a>` : ""}`;
}

function renderRoutineNotice() {
  const box = document.getElementById("rtNotice");
  const hasTimed = activeRoutineTasks().some((t) => t.time && t.recurrence.type !== "situational");
  const mode = routineAlertMode();
  let html = "";
  if (hasTimed && mode === "old-apk") {
    html = `<div class="hint-box">📲 Atualize o app Android (versão 1.2) para o Toba avisar e cobrar as tarefas com o app fechado.</div>`;
  } else if (hasTimed && mode === "app" && !TOBA_NATIVE.canPostNotifications()) {
    html = `<button type="button" class="hint-box rt-notice-btn" data-click="enableRoutineNotify">🔕 As notificações do Toba estão desligadas. Toque para ligar as cobranças.</button>`;
  } else if (hasTimed && mode === "browser" && !tobaCanNotify()) {
    html = `<button type="button" class="hint-box rt-notice-btn" data-click="enableRoutineNotify">🔔 Toque para permitir os avisos. No navegador eles só chegam com o Toba aberto (veja ⚙️).</button>`;
  }
  box.innerHTML = html;
}

function renderRoutineToday() {
  const today = toIsoDate();
  const tasks = activeRoutineTasks();
  const doneKeys = routineDoneKeys(routineDb.log);
  renderRoutineHero(today);
  renderRoutineNotice();

  // Atrasadas: últimos 7 dias, vale metade do XP (a que não passa pro dia
  // seguinte expira; a deixada pra lá, desde v1.47, sai da lista)
  const skippedKeys = routineSkippedKeys(routineDb);
  const overdue = [];
  for (let i = 1; i <= ROUTINE_OVERDUE_DAYS; i++) {
    const day = routineAddDays(today, -i);
    sortRoutineTasks(tasks).forEach((task) => {
      if (isRoutineTaskDue(task, day) && routineOccurrenceStatus(task, day, doneKeys, skippedKeys, today) === "overdue") overdue.push({ task, day });
    });
  }
  // Dia escrito uma vez só; passou de 5, o resto fica recolhido
  const overdueHtml = (items) => items.map(({ task, day }, i) =>
    `${i === 0 || items[i - 1].day !== day ? `<div class="rt-day-label">${describeRoutineDay(day, today)}</div>` : ""}${renderRoutineTask(task, day, { overdue: true, swipe: true })}`).join("");
  const firstOverdue = overdue.slice(0, 5);
  const moreOverdue = overdue.slice(5);
  document.getElementById("rtOverdue").innerHTML = overdue.length
    ? `<div class="section-title rt-overdue-title">⏰ Atrasadas <span>vale metade do XP</span></div>
       <div class="rt-list">${overdueHtml(firstOverdue)}</div>
       ${moreOverdue.length ? `<details class="rt-more"><summary>Ver mais ${moreOverdue.length} atrasadas</summary><div class="rt-list">${overdueHtml(moreOverdue)}</div></details>` : ""}
       <p class="rt-swipe-hint">👈 Não vai fazer? Deslize pro lado pra deixar pra lá 👉</p>`
    : "";

  const due = sortRoutineTasks(tasks.filter((t) => isRoutineTaskDue(t, today)));
  const list = document.getElementById("rtTodayList");
  document.getElementById("rtTodayTitle").hidden = !due.length && !tasks.length;
  if (!tasks.length) {
    list.innerHTML = tobaEmpty("🫙", "Nenhuma tarefa ainda", "Toque em + Tarefa ou veja as sugestões na aba Tarefas.");
  } else if (!due.length) {
    list.innerHTML = tobaEmpty("🏖️", "Nada agendado pra hoje", "Dia livre. Ou faça algo da lista \"Quando acontecer\".", { compact: true });
  } else {
    // Feitas vão pro fim da lista
    const ordered = [...due.filter((t) => !doneKeys.has(`${t.id}|${today}`)), ...due.filter((t) => doneKeys.has(`${t.id}|${today}`))];
    list.innerHTML = ordered.map((task) => renderRoutineTask(task, today, {
      done: doneKeys.has(`${task.id}|${today}`),
      streak: calcRoutineTaskStreak(task, doneKeys, today).current,
    })).join("");
  }

  renderRoutineOneoffsToday(today);

  // Amanhã: só pra ver o que vem (não dá pra marcar antes do dia)
  const tomorrow = routineAddDays(today, 1);
  const next = sortRoutineTasks(tasks.filter((t) => isRoutineTaskDue(t, tomorrow)));
  const tomorrowName = new Date(`${tomorrow}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  const nextOneoffs = routineOneoffSessionsOn(tomorrow);
  document.getElementById("rtTomorrow").innerHTML = tasks.some(isRoutineScheduled) || nextOneoffs.length
    ? `<div class="section-title rt-overdue-title">🌅 Amanhã <span>${tomorrowName}</span></div>
       ${nextOneoffs.length ? `<div class="rt-list">${nextOneoffs.map(({ oneoff, session }) => `
          <div class="rt-task is-list is-tomorrow" role="button" tabindex="0" data-click="openOneoffFromRow" data-id="${escapeHtml(oneoff.id)}">
            <span class="rt-task-emoji is-big">${escapeHtml(oneoff.emoji)}</span>
            <div class="rt-task-body">
              <span class="rt-task-name">${escapeHtml(oneoff.name)}</span>
              <span class="rt-task-meta">🛠️ Task · ⏱️ ${routineFormatMinutes(session.minutes)} · +${routineOneoffXp(session.minutes)} XP</span>
            </div>
          </div>`).join("")}</div>` : ""}
       ${next.length ? `<div class="rt-list">${next.map((task) => {
         const diff = routineDifficulty(task.difficulty);
         const meta = [task.time ? `⏰ ${task.time}` : "", `${diff.icon} ${diff.name}`, `+${diff.xp} XP`, routineCarriesOver(task) ? "" : "⌛ só no dia"].filter(Boolean).join(" · ");
         return `
          <div class="rt-task is-list is-tomorrow" role="button" tabindex="0" data-click="editTask" data-id="${escapeHtml(task.id)}">
            <span class="rt-task-emoji is-big">${escapeHtml(task.emoji)}</span>
            <div class="rt-task-body">
              <span class="rt-task-name">${escapeHtml(task.name)}</span>
              <span class="rt-task-meta">${meta}</span>
            </div>
          </div>`;
       }).join("")}</div>` : nextOneoffs.length ? "" : tobaEmpty("😎", "Nada agendado pra amanhã", "", { compact: true })}`
    : "";

  const situational = sortRoutineTasks(tasks.filter((t) => t.recurrence.type === "situational"));
  document.getElementById("rtSituational").innerHTML = situational.length
    ? `<div class="section-title">🌀 Quando acontecer</div>
       <div class="rt-list">${situational.map((task) => {
         const count = routineDb.log.filter((e) => e.taskId === String(task.id) && e.date === today).length;
         const diff = routineDifficulty(task.difficulty);
         return `
          <div class="rt-task is-situational">
            <div class="rt-task-body" role="button" tabindex="0" data-click="editTask" data-id="${escapeHtml(task.id)}">
              <span class="rt-task-name"><span class="rt-task-emoji">${escapeHtml(task.emoji)}</span>${escapeHtml(task.name)}</span>
              <span class="rt-task-meta">${diff.icon} ${diff.name} · +${diff.xp} XP${count ? ` · ✅ ${count}× hoje` : ""}</span>
            </div>
            ${count ? `<button type="button" class="rt-undo" data-click="undoSituational" data-id="${escapeHtml(task.id)}" aria-label="Desfazer a última">↩</button>` : ""}
            <button type="button" class="btn btn-sm btn-green" data-click="doSituational" data-id="${escapeHtml(task.id)}">Fiz agora</button>
          </div>`;
       }).join("")}</div>`
    : "";
}

/* ---------------------------------------------------------------------
 * Deixar pra lá uma atrasada (v1.47): deslizar o card pro lado.
 * Grava em routineDb.skipped (só a ocorrência; a tarefa continua). Não dá XP
 * e quebra o streak igual a não fazer. "Desfazer" por 5 s; depois, tocando
 * no 🗑️ do Histórico. O gesto só pega movimento claramente horizontal
 * (touch-action: pan-y deixa a rolagem com o navegador) e o toque que vem
 * logo depois de deslizar é engolido, pra não marcar como feita sem querer.
 * ------------------------------------------------------------------- */
const ROUTINE_OCCURRENCE_LABELS = {
  done: { mark: "✅", name: "feita" },
  overdue: { mark: "⏰", name: "atrasada" },
  expired: { mark: "⌛", name: "expirou" },
  skipped: { mark: "🗑️", name: "deixou pra lá" },
  missed: { mark: "💤", name: "perdida (7+ dias)" },
  today: { mark: "", name: "pra hoje" },
};
const ROUTINE_SWIPE_RATIO = 0.35; // passou de 35% da largura = descarta
const ROUTINE_UNDO_MS = 5000;

function skipOverdue(taskId, date) {
  const task = findRoutineTask(taskId);
  if (!task || !routineIsIso(date)) return;
  if (routineDb.skipped.some((k) => k.taskId === String(task.id) && k.date === date)) return;
  const entry = { id: `k-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, taskId: String(task.id), date, at: Date.now() };
  routineDb.skipped.push(entry);
  if (!saveRoutineDb({ silent: true })) {
    routineDb.skipped = routineDb.skipped.filter((k) => k !== entry);
    renderRoutine();
    return;
  }
  clearNativeTaskNotice(task.id, date); // a notificação que já está na barra (APK novo)
  renderRoutine();
  showRoutineUndo(`🗑️ Deixou pra lá: ${task.emoji} ${task.name}`, () => unskipOverdue(entry.taskId, entry.date));
}

// Tira o descarte (Desfazer ou Histórico). Devolve true se gravou.
function unskipOverdue(taskId, date, { toast = "↩ Voltou pras atrasadas" } = {}) {
  const before = routineDb.skipped;
  routineDb.skipped = routineDb.skipped.filter((k) => !(k.taskId === String(taskId) && k.date === date));
  if (routineDb.skipped.length === before.length) return false;
  if (!saveRoutineDb({ silent: true })) {
    routineDb.skipped = before;
    return false;
  }
  renderRoutine();
  if (toast) tobaToast(toast);
  return true;
}

async function restoreSkipped(el) {
  const task = findRoutineTask(el.dataset.id);
  const date = el.dataset.date;
  if (!task || !routineIsIso(date)) return;
  const today = toIsoDate();
  const stillOverdue = routineCarriesOver(task) && date >= routineAddDays(today, -ROUTINE_OVERDUE_DAYS);
  const ok = await showPageMessage(
    stillOverdue
      ? `"${task.name}" de ${describeRoutineDay(date, today).toLowerCase()} volta pras atrasadas (ainda vale metade do XP).`
      : `"${task.name}" de ${describeRoutineDay(date, today).toLowerCase()} já passou dos ${ROUTINE_OVERDUE_DAYS} dias: volta só como perdida no histórico.`,
    { title: "Trazer de volta?", icon: "↩", confirm: true, confirmLabel: "Trazer de volta" },
  );
  if (ok) unskipOverdue(task.id, date, { toast: stillOverdue ? "↩ Voltou pras atrasadas" : "↩ Trazida de volta" });
}

/* Barrinha de desfazer (fica por ROUTINE_UNDO_MS) */
let routineUndoAction = null;
let routineUndoTimer = null;

function showRoutineUndo(text, action) {
  let bar = document.getElementById("rtUndo");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "rtUndo";
    bar.className = "rt-undo-bar";
    bar.setAttribute("role", "status");
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span class="rt-undo-text"></span><button type="button" class="rt-undo-btn" data-click="routineUndo">Desfazer</button>`;
  bar.querySelector(".rt-undo-text").textContent = text;
  routineUndoAction = action;
  requestAnimationFrame(() => bar.classList.add("show"));
  clearTimeout(routineUndoTimer);
  routineUndoTimer = setTimeout(hideRoutineUndo, ROUTINE_UNDO_MS);
}

function hideRoutineUndo() {
  clearTimeout(routineUndoTimer);
  routineUndoAction = null;
  document.getElementById("rtUndo")?.classList.remove("show");
}

/* Gesto (dedo e mouse, pelos pointer events) */
let routineSwipe = null;
let routineSwipeEatClick = false;

document.addEventListener("pointerdown", (event) => {
  const card = event.target.closest(".rt-swipe > .rt-task");
  if (!card || (event.pointerType === "mouse" && event.button !== 0)) return;
  routineSwipe = { card, wrap: card.parentElement, pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, active: false };
});

document.addEventListener("pointermove", (event) => {
  const s = routineSwipe;
  if (!s || event.pointerId !== s.pointer) return;
  const dx = event.clientX - s.x;
  const dy = event.clientY - s.y;
  if (!s.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
      routineSwipe = null; // é rolagem
      return;
    }
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    s.active = true;
    s.width = s.wrap.getBoundingClientRect().width || 300;
    try {
      s.card.setPointerCapture(event.pointerId);
    } catch (err) {
      // sem captura: segue assim mesmo
    }
    s.wrap.classList.add("is-swiping");
  }
  event.preventDefault();
  s.dx = dx;
  s.card.style.transform = `translateX(${dx}px)`;
  s.wrap.dataset.dir = dx < 0 ? "left" : "right";
  s.wrap.style.setProperty("--swipe", Math.min(1, Math.abs(dx) / (s.width * ROUTINE_SWIPE_RATIO)).toFixed(2));
});

function endRoutineSwipe(event, cancelled) {
  const s = routineSwipe;
  if (!s || event.pointerId !== s.pointer) return;
  routineSwipe = null;
  if (!s.active) return;
  routineSwipeEatClick = true;
  setTimeout(() => {
    routineSwipeEatClick = false;
  }, 400);
  const out = !cancelled && Math.abs(s.dx) >= s.width * ROUTINE_SWIPE_RATIO;
  s.card.classList.add("is-settling");
  if (!out) {
    s.card.style.transform = "";
    s.wrap.style.setProperty("--swipe", "0");
    setTimeout(() => s.wrap.classList.remove("is-swiping"), 250);
    return;
  }
  // Sai voando pro lado, a linha fecha e só então grava
  s.card.style.transform = `translateX(${s.dx < 0 ? -120 : 120}%)`;
  s.wrap.style.height = `${s.wrap.offsetHeight}px`;
  setTimeout(() => s.wrap.classList.add("is-leaving"), 180);
  setTimeout(() => skipOverdue(s.wrap.dataset.id, s.wrap.dataset.date), 420);
}

document.addEventListener("pointerup", (event) => endRoutineSwipe(event, false));
document.addEventListener("pointercancel", (event) => endRoutineSwipe(event, true));
// O clique que o navegador dispara no fim do arraste não pode marcar a tarefa
document.addEventListener("click", (event) => {
  if (!routineSwipeEatClick) return;
  routineSwipeEatClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

/* ---------------------------------------------------------------------
 * Tasks (módulo Task) que caem hoje: marcar aqui vale igual à página Task
 * ------------------------------------------------------------------- */
function routineOneoffSessionsOn(iso) {
  const list = [];
  (routineDb.oneoffs || []).forEach((oneoff) => {
    if (oneoff.archivedAt) return;
    oneoff.sessions.forEach((session) => {
      if (session.date === iso && (!oneoff.doneAt || session.doneAt)) list.push({ oneoff, session });
    });
  });
  return list;
}

function renderRoutineOneoffsToday(today) {
  const box = document.getElementById("rtOneoffs");
  const items = routineOneoffSessionsOn(today).sort((a, b) => Boolean(a.session.doneAt) - Boolean(b.session.doneAt));
  const missed = (routineDb.oneoffs || []).filter((o) => !o.archivedAt && !o.doneAt && routineOneoffStatus(o, today).missed.length).length;
  box.innerHTML = items.length || missed
    ? `<div class="section-title rt-overdue-title">🛠️ Tasks de hoje <span>fora do teto de XP</span></div>
       ${items.length ? `<div class="rt-list">${items.map(({ oneoff, session }) => renderOneoffSessionRow(oneoff, session, { today })).join("")}</div>` : ""}
       ${missed ? `<a class="hint-box rt-notice-btn" href="TobaRoutine-Task.html">🙈 ${missed === 1 ? "1 task furou o dia marcado" : `${missed} tasks furaram o dia marcado`}. Toque pra reagendar.</a>` : ""}`
    : "";
}

/* ---------------------------------------------------------------------
 * Tarefas
 * ------------------------------------------------------------------- */
function renderRoutineTasks() {
  const today = toIsoDate();
  const tasks = activeRoutineTasks();
  const doneKeys = routineDoneKeys(routineDb.log);
  const box = document.getElementById("rtTaskList");
  if (!tasks.length) {
    box.innerHTML = tobaEmpty("📋", "Nenhuma tarefa", "Toque em + Tarefa ou nas sugestões aqui embaixo.");
    return;
  }
  const groups = [
    ["daily", "☀️ Todo dia"],
    ["weekly", "📅 Na semana"],
    ["monthly", "🗓️ No mês"],
    ["situational", "🌀 Quando acontecer"],
  ];
  box.innerHTML = groups.map(([type, title]) => {
    const items = sortRoutineTasks(tasks.filter((t) => t.recurrence.type === type));
    if (!items.length) return "";
    return `<div class="section-title">${title}</div><div class="rt-list">${items.map((task) => {
      const diff = routineDifficulty(task.difficulty);
      const streak = calcRoutineTaskStreak(task, doneKeys, today);
      return `
        <div class="rt-task is-list" role="button" tabindex="0" data-click="editTask" data-id="${escapeHtml(task.id)}">
          <span class="rt-task-emoji is-big">${escapeHtml(task.emoji)}</span>
          <div class="rt-task-body">
            <span class="rt-task-name">${escapeHtml(task.name)}</span>
            <span class="rt-task-meta">${describeRoutineWhen(task)} · ${diff.icon} ${diff.name}${task.time && task.nag && type !== "situational" ? " · 😈" : ""}${type !== "situational" && !routineCarriesOver(task) ? " · ⌛" : ""}</span>
          </div>
          ${type !== "situational" ? `<span class="rt-streak${streak.current ? " is-on" : ""}">🔥 ${streak.current}</span>` : ""}
        </div>`;
    }).join("")}</div>`;
  }).join("");
}

/* ---------------------------------------------------------------------
 * Histórico
 * ------------------------------------------------------------------- */
function renderRoutineHistory() {
  const today = toIsoDate();
  const tasks = activeRoutineTasks();
  const doneKeys = routineDoneKeys(routineDb.log);
  const box = document.getElementById("rtHistory");
  if (!routineDb.log.length && !tasks.length) {
    box.innerHTML = tobaEmpty("📜", "Histórico vazio", "Marque sua primeira tarefa e ela aparece aqui.");
    return;
  }
  const stats = sortRoutineTasks(tasks).map((task) => {
    const streak = calcRoutineTaskStreak(task, doneKeys, today);
    const entries = routineDb.log.filter((e) => e.taskId === String(task.id));
    const last = entries.map((e) => e.date).sort().pop();
    const scheduled = task.recurrence.type !== "situational";
    return `
      <div class="rt-stat-row">
        <span class="rt-task-emoji is-big">${escapeHtml(task.emoji)}</span>
        <span class="rt-task-body">
          <span class="rt-task-name">${escapeHtml(task.name)}</span>
          <span class="rt-task-meta">${entries.length} ${entries.length === 1 ? "vez" : "vezes"}${last ? ` · última: ${describeRoutineDay(last, today).toLowerCase()}` : " · nunca feita"}</span>
        </span>
        ${scheduled ? `<span class="rt-stat-streak"><strong>🔥 ${streak.current}</strong><small>recorde ${streak.best}</small></span>` : ""}
      </div>`;
  }).join("");

  // Cada ocorrência com a situação dela (desde v1.47): feita, atrasada,
  // expirada, deixada pra lá ou perdida. Deixada pra lá: toque traz de volta.
  const skippedKeys = routineSkippedKeys(routineDb);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const day = routineAddDays(today, -i);
    const due = sortRoutineTasks(routineDb.tasks.filter((t) => isRoutineTaskDue(t, day)));
    const loose = routineDb.log.filter((e) => e.date === day && !due.some((t) => String(t.id) === e.taskId));
    if (!due.length && !loose.length) continue;
    const doneDue = due.filter((t) => doneKeys.has(`${t.id}|${day}`)).length;
    const chips = due.map((task) => {
      const status = routineOccurrenceStatus(task, day, doneKeys, skippedKeys, today);
      const info = ROUTINE_OCCURRENCE_LABELS[status];
      const label = `${task.name}: ${info.name}`;
      if (status === "skipped") {
        return `<button type="button" class="rt-occ is-${status}" data-click="restoreSkipped" data-id="${escapeHtml(task.id)}" data-date="${day}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}. Toque pra trazer de volta">${escapeHtml(task.emoji)}<i>${info.mark}</i></button>`;
      }
      return `<span class="rt-occ is-${status}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(task.emoji)}${info.mark ? `<i>${info.mark}</i>` : ""}</span>`;
    }).concat(loose.map((e) => `<span class="rt-occ is-done" title="Feita">${escapeHtml(findRoutineTask(e.taskId)?.emoji || "✅")}<i>✅</i></span>`)).join("");
    const perfect = due.length >= 2 && doneDue === due.length;
    days.push(`
      <div class="rt-day-row${perfect ? " is-perfect" : ""}">
        <span class="rt-day-name">${describeRoutineDay(day, today)}</span>
        <span class="rt-day-icons rt-occs">${chips}</span>
        <span class="rt-day-count">${due.length ? `${doneDue}/${due.length}` : ""}${perfect ? " ✨" : ""}</span>
      </div>`);
  }
  const legend = Object.values(ROUTINE_OCCURRENCE_LABELS).filter((item) => item.mark).map((item) => `${item.mark} ${item.name}`).join(" · ");
  box.innerHTML = `
    <div class="section-title is-first">🔥 Por tarefa</div>
    <div class="card rt-stats">${stats || tobaEmpty("📋", "Sem tarefas ativas", "", { compact: true })}</div>
    <div class="section-title">📅 Últimos 14 dias</div>
    <p class="rt-occ-legend">${legend}. Toque num 🗑️ pra trazer de volta.</p>
    <div class="card rt-days">${days.join("") || tobaEmpty("🦗", "Nada nos últimos 14 dias", "", { compact: true })}</div>`;
}

/* ---------------------------------------------------------------------
 * Telas
 * ------------------------------------------------------------------- */
function showRoutineView(viewId) {
  routineView = viewId;
  document.querySelectorAll(".app-view").forEach((v) => v.classList.toggle("active", v.id === viewId));
  document.querySelectorAll(".rt-tabs .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
  tobaSetHeader({ page: ROUTINE_VIEW_TITLES[viewId] });
  renderRoutine();
}

function renderRoutine() {
  if (routineView === "viewToday") renderRoutineToday();
  if (routineView === "viewTasks") renderRoutineTasks();
  if (routineView === "viewHistory") renderRoutineHistory();
  fillRoutineSettings();
}

// Meu dia fixo salvo ou sessão de task marcada (routine-plan.js)
function onRoutinePlanChanged() {
  renderRoutine();
}

// Folha da tarefa (routine-task-sheet.js) salvou/apagou
function onRoutineTaskSaved() {
  renderRoutine();
}

// Chamado pelo core depois de cada gravação: refaz os avisos e o XP.
function onRoutineDataSaved() {
  syncRoutineAlerts(routineDb);
}

function onRoutineDataReplaced() {
  syncRoutineAlerts(routineDb);
  renderRoutine();
  tobaPlayerCheck({ silent: true });
}

/* ---------------------------------------------------------------------
 * Marcar / desmarcar
 * ------------------------------------------------------------------- */
function floatRoutineXp(anchor, text) {
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement("span");
  el.className = "rt-float";
  el.textContent = text;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function toggleTask(el) {
  const task = findRoutineTask(el.dataset.id);
  const date = el.dataset.date;
  if (!task || !routineIsIso(date)) return;
  // A regra de gravar mora no routine-task-sheet.js (a Agenda usa a mesma, v1.49)
  const { result, entry } = routineToggleOccurrence(task, date);
  if (!result) return;
  if (result === "undone") {
    tobaToast("↩ Desmarcada (o XP saiu junto)");
    renderRoutine();
    tobaPlayerCheck();
    return;
  }
  if (result === "expired") {
    routineExpiredMessage(task);
    renderRoutine();
    return;
  }
  const late = routineIsLate(entry);
  const diff = routineDifficulty(task.difficulty);
  floatRoutineXp(el, `+${late ? Math.round(diff.xp / 2) : diff.xp} XP`);
  el.closest(".rt-task")?.classList.add("is-popping");
  setTimeout(() => {
    renderRoutine();
  }, 350);
  tobaPlayerCheck({ reason: `${task.emoji} ${routineDoneLine(task.difficulty, late)}` });
}

function doSituational(el) {
  const task = findRoutineTask(el.dataset.id);
  if (!task) return;
  const entry = { id: newRoutineLogId(), taskId: String(task.id), date: toIsoDate(), doneAt: Date.now(), difficulty: task.difficulty };
  routineDb.log.push(entry);
  if (!saveRoutineDb({ silent: true })) {
    routineDb.log = routineDb.log.filter((e) => e !== entry);
    return;
  }
  const count = routineDb.log.filter((e) => e.taskId === entry.taskId && e.date === entry.date).length;
  floatRoutineXp(el, count > ROUTINE_SITUATIONAL_PER_DAY ? "✅ (sem XP)" : `+${routineDifficulty(task.difficulty).xp} XP`);
  renderRoutine();
  tobaPlayerCheck({ reason: `${task.emoji} ${routineDoneLine(task.difficulty, false)}` });
}

function undoSituational(el) {
  const today = toIsoDate();
  const entries = routineDb.log.filter((e) => e.taskId === String(el.dataset.id) && e.date === today);
  const last = entries.sort((a, b) => a.doneAt - b.doneAt).pop();
  if (!last) return;
  routineDb.log = routineDb.log.filter((e) => e !== last);
  if (saveRoutineDb({ silent: true })) tobaToast("↩ Desfeita");
  renderRoutine();
  tobaPlayerCheck();
}

/* ---------------------------------------------------------------------
 * Sugestões
 * ------------------------------------------------------------------- */
function openSuggestions() {
  const names = new Set(activeRoutineTasks().map((t) => t.name.toLowerCase()));
  document.getElementById("suggestList").innerHTML = ROUTINE_SUGGESTIONS.map((s, i) => {
    const have = names.has(s.name.toLowerCase());
    const diff = routineDifficulty(s.difficulty);
    return `
      <label class="rt-suggest${have ? " is-have" : ""}">
        <input type="checkbox" value="${i}"${s.on && !have ? " checked" : ""}${have ? " disabled" : ""} />
        <span class="rt-task-emoji is-big">${s.emoji}</span>
        <span class="rt-task-body">
          <span class="rt-task-name">${s.name}</span>
          <span class="rt-task-meta">${have ? "Você já tem" : `${describeRoutineWhen(s)} · ${diff.icon} ${diff.name}`}</span>
        </span>
      </label>`;
  }).join("");
  openTobaModal("suggestSheet");
}

function addSuggestions() {
  const picked = [...document.querySelectorAll("#suggestList input:checked")].map((i) => ROUTINE_SUGGESTIONS[Number(i.value)]);
  const today = toIsoDate();
  picked.forEach((s, i) => {
    routineDb.tasks.push({
      id: `t-${Date.now()}-${i}${Math.random().toString(36).slice(2, 5)}`,
      name: s.name,
      emoji: s.emoji,
      recurrence: JSON.parse(JSON.stringify(s.recurrence)),
      time: s.time,
      difficulty: s.difficulty,
      nag: true,
      carryOver: s.carryOver !== false,
      createdAt: today,
    });
  });
  routineDb.seeded = true;
  if (!saveRoutineDb()) return;
  closeTobaModal("suggestSheet");
  if (picked.some((s) => s.time)) tobaAskNotify();
  if (picked.length) tobaToast(`✨ ${picked.length} ${picked.length === 1 ? "tarefa adicionada" : "tarefas adicionadas"}`);
  renderRoutine();
}

/* ---------------------------------------------------------------------
 * Avisos
 * ------------------------------------------------------------------- */
function fillRoutineSettings() {
  const help = document.getElementById("rtNotifyHelp");
  if (!help) return;
  const mode = routineAlertMode();
  help.innerHTML = {
    app: "No app Android o Toba avisa no horário de cada tarefa e, se ela continuar sem fazer, cobra de novo depois de 30 min e de 2 h (no máximo 3 avisos por dia). A notificação tem o botão <b>✅ Feito</b>; marcar a tarefa cancela as cobranças. Funciona com o app fechado.",
    "old-apk": "Seu app Android é de uma versão antiga: gere e instale o APK 1.2 para receber as cobranças com o app fechado.",
    browser: "No navegador não existe aviso agendado com o site fechado (o Toba não tem servidor). Com o portal ou o Routine abertos, ou recém-minimizados, o Toba avisa no horário e cobra de novo (+30 min, +2 h). Para não perder, use o app Android ou o botão <b>📅 Pôr na agenda</b> da tarefa (a agenda avisa, mas não sabe quando você fez, então não para de cobrar).",
  }[mode];
}

async function enableRoutineNotify() {
  const ok = await tobaAskNotify();
  if (!ok && routineAlertMode() === "browser") {
    showPageMessage("O navegador bloqueou as notificações. Libere nas configurações do site (cadeado ao lado do endereço).", { title: "Notificações bloqueadas", icon: "🔕" });
  }
  renderRoutine();
}

// O app Android guarda os "✅ Feito" tocados na notificação; aqui viram log.
function importNativeRoutineDone() {
  const list = readNativeRoutineDone();
  if (!list.length || !isRoutineDbLoaded) return;
  let added = 0;
  list.forEach((item) => {
    const task = findRoutineTask(item.taskId);
    if (!task) return;
    if (routineDb.log.some((e) => e.taskId === String(task.id) && e.date === item.date)) return;
    const doneAt = Number(item.at) || Date.now();
    // "✅ Feito" tocado depois da meia-noite numa tarefa que não passa pro dia seguinte: expirou
    if (!routineCarriesOver(task) && toIsoDate(new Date(doneAt)) > item.date) return;
    routineDb.log.push({ id: newRoutineLogId(), taskId: String(task.id), date: item.date, doneAt, difficulty: task.difficulty });
    // Tinha deixado pra lá e tocou "✅ Feito" na notificação: o feito ganha
    routineDb.skipped = routineDb.skipped.filter((k) => !(k.taskId === String(task.id) && k.date === item.date));
    added += 1;
  });
  // Só tira da fila do app o que ficou gravado no banco
  if (added && !saveRoutineDb({ silent: true })) return;
  TOBA_NATIVE.ackDoneTasks(JSON.stringify(list.map((item) => `${item.taskId}|${item.date}`)));
  if (added) {
    renderRoutine();
    tobaPlayerCheck({ reason: `✅ ${added === 1 ? "Tarefa marcada" : `${added} tarefas marcadas`} pela notificação` });
  }
}

/* ---------------------------------------------------------------------
 * Início
 * ------------------------------------------------------------------- */
tobaActions({
  newTask: () => openTaskSheet(),
  editTask: (el) => openTaskSheet(findRoutineTask(el.dataset.id)),
  toggleTask,
  restoreSkipped,
  routineUndo: () => {
    const undo = routineUndoAction;
    hideRoutineUndo();
    if (undo) undo();
  },
  doSituational,
  undoSituational,
  showRoutineView: (el) => showRoutineView(el.dataset.view),
  openSuggestions,
  addSuggestions,
  enableRoutineNotify,
  openOneoffFromRow: (el) => {
    location.href = `TobaRoutine-Task.html?open=${encodeURIComponent(el.dataset.id)}`;
  },
});

document.addEventListener("toba:player", () => {
  if (routineView === "viewToday") renderRoutineHero(toIsoDate());
});
// Fechou as sugestões da 1ª vez sem adicionar: não mostra de novo sozinho
document.getElementById("suggestSheet").addEventListener("toba:close", () => {
  if (!routineDb.seeded && isRoutineDbLoaded) {
    routineDb.seeded = true;
    saveRoutineDb({ silent: true });
  }
});

window.onTobaAppResume = () => {
  importNativeRoutineDone();
  syncRoutineAlerts(isRoutineDbLoaded ? routineDb : null);
  renderRoutine();
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderRoutine();
});

// Veio da notificação: ?task=<id>&date=AAAA-MM-DD
(() => {
  const params = new URLSearchParams(location.search);
  if (params.has("task")) {
    routineHighlight = { taskId: params.get("task"), date: params.get("date") || toIsoDate() };
    history.replaceState(null, "", location.pathname);
  }
})();

importNativeRoutineDone();
showRoutineView("viewToday");
syncRoutineAlerts(isRoutineDbLoaded ? routineDb : null);
startRoutineWatcher(() => (isRoutineDbLoaded ? routineDb : null));
tobaPlayerCheck();
if (routineHighlight) {
  const row = document.getElementById(`rt-${routineHighlight.taskId}-${routineHighlight.date}`);
  if (row) setTimeout(() => row.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
}
if (isRoutineDbLoaded && !routineDb.seeded && !routineDb.tasks.length) openSuggestions();
