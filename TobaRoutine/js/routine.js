/* =====================================================================
 * Toba Routine · tela (Hoje / Tarefas / Histórico)
 * Depende de toba-common.js, routine-metrics.js, routine-core.js,
 * health-metrics.js + toba-player.js (XP) e routine-alerts.js (avisos).
 * ===================================================================== */
const ROUTINE_EMOJI_PICKS = ["🚽", "🪴", "🐕", "😴", "🗑️", "🍽️", "🧺", "🧹", "💧", "💊", "📚", "🛒", "💸", "🧘", "📞", "🐈"];

const ROUTINE_SUGGESTIONS = [
  { emoji: "🚽", name: "Lavar o banheiro", recurrence: { type: "weekly", days: ["SA"] }, time: "10:00", difficulty: "medium", on: true },
  { emoji: "🪴", name: "Regar as plantas", recurrence: { type: "weekly", days: ["MO", "TH"] }, time: "08:00", difficulty: "easy", on: true },
  { emoji: "🐕", name: "Passear com o cachorro", recurrence: { type: "daily" }, time: "19:00", difficulty: "medium", on: true },
  { emoji: "😴", name: "Dormir na hora certa", recurrence: { type: "daily" }, time: "23:00", difficulty: "hard", on: true },
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

function findRoutineTask(id) {
  return routineDb.tasks.find((t) => String(t.id) === String(id));
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

function renderRoutineTask(task, date, { done = false, overdue = false, streak = 0 } = {}) {
  const diff = routineDifficulty(task.difficulty);
  const xp = overdue ? Math.round(diff.xp / 2) : diff.xp;
  const highlight = routineHighlight && routineHighlight.taskId === String(task.id) && routineHighlight.date === date;
  const meta = [
    task.time ? `⏰ ${task.time}` : "",
    `${diff.icon} ${diff.name}`,
    `+${xp} XP`,
    streak >= 2 ? `🔥 ${streak}` : "",
  ].filter(Boolean).join(" · ");
  return `
    <div class="rt-task${done ? " is-done" : ""}${overdue ? " is-overdue" : ""}${highlight ? " is-highlight" : ""}" id="rt-${escapeHtml(task.id)}-${date}">
      <button type="button" class="rt-check" data-click="toggleTask" data-id="${escapeHtml(task.id)}" data-date="${date}" aria-pressed="${done}" aria-label="${done ? "Desmarcar" : "Marcar como feita"}: ${escapeHtml(task.name)}">${done ? "✓" : ""}</button>
      <div class="rt-task-body" role="button" tabindex="0" data-click="editTask" data-id="${escapeHtml(task.id)}">
        <span class="rt-task-name"><span class="rt-task-emoji">${escapeHtml(task.emoji)}</span>${escapeHtml(task.name)}</span>
        <span class="rt-task-meta">${meta}</span>
      </div>
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

  // Atrasadas: últimos 7 dias, vale metade do XP
  const overdue = [];
  for (let i = 1; i <= 7; i++) {
    const day = routineAddDays(today, -i);
    sortRoutineTasks(tasks).forEach((task) => {
      if (isRoutineTaskDue(task, day) && !doneKeys.has(`${task.id}|${day}`)) overdue.push({ task, day });
    });
  }
  // Dia escrito uma vez só; passou de 5, o resto fica recolhido
  const overdueHtml = (items) => items.map(({ task, day }, i) =>
    `${i === 0 || items[i - 1].day !== day ? `<div class="rt-day-label">${describeRoutineDay(day, today)}</div>` : ""}${renderRoutineTask(task, day, { overdue: true })}`).join("");
  const firstOverdue = overdue.slice(0, 5);
  const moreOverdue = overdue.slice(5);
  document.getElementById("rtOverdue").innerHTML = overdue.length
    ? `<div class="section-title rt-overdue-title">⏰ Atrasadas <span>vale metade do XP</span></div>
       <div class="rt-list">${overdueHtml(firstOverdue)}</div>
       ${moreOverdue.length ? `<details class="rt-more"><summary>Ver mais ${moreOverdue.length} atrasadas</summary><div class="rt-list">${overdueHtml(moreOverdue)}</div></details>` : ""}`
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
            <span class="rt-task-meta">${describeRoutineWhen(task)} · ${diff.icon} ${diff.name}${task.time && task.nag && type !== "situational" ? " · 😈" : ""}</span>
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

  const days = [];
  for (let i = 0; i < 14; i++) {
    const day = routineAddDays(today, -i);
    const due = routineDb.tasks.filter((t) => isRoutineTaskDue(t, day));
    const doneEntries = routineDb.log.filter((e) => e.date === day);
    if (!due.length && !doneEntries.length) continue;
    const doneDue = due.filter((t) => doneKeys.has(`${t.id}|${day}`)).length;
    const icons = doneEntries.map((e) => escapeHtml(findRoutineTask(e.taskId)?.emoji || "✅")).join(" ");
    const perfect = due.length >= 2 && doneDue === due.length;
    days.push(`
      <div class="rt-day-row${perfect ? " is-perfect" : ""}">
        <span class="rt-day-name">${describeRoutineDay(day, today)}</span>
        <span class="rt-day-icons">${icons || "<span class=\"text-muted\">nada feito</span>"}</span>
        <span class="rt-day-count">${due.length ? `${doneDue}/${due.length}` : ""}${perfect ? " ✨" : ""}</span>
      </div>`);
  }
  box.innerHTML = `
    <div class="section-title is-first">🔥 Por tarefa</div>
    <div class="card rt-stats">${stats || tobaEmpty("📋", "Sem tarefas ativas", "", { compact: true })}</div>
    <div class="section-title">📅 Últimos 14 dias</div>
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

function newRoutineLogId() {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function toggleTask(el) {
  const task = findRoutineTask(el.dataset.id);
  const date = el.dataset.date;
  if (!task || !routineIsIso(date)) return;
  const exists = routineDb.log.some((e) => e.taskId === String(task.id) && e.date === date);
  if (exists) {
    const before = routineDb.log;
    routineDb.log = routineDb.log.filter((e) => !(e.taskId === String(task.id) && e.date === date));
    if (!saveRoutineDb({ silent: true })) {
      routineDb.log = before;
      return;
    }
    tobaToast("↩ Desmarcada (o XP saiu junto)");
    renderRoutine();
    tobaPlayerCheck();
    return;
  }
  const entry = { id: newRoutineLogId(), taskId: String(task.id), date, doneAt: Date.now(), difficulty: task.difficulty };
  routineDb.log.push(entry);
  if (!saveRoutineDb({ silent: true })) {
    routineDb.log = routineDb.log.filter((e) => e !== entry);
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
 * Folha da tarefa
 * ------------------------------------------------------------------- */
function openTaskSheet(task = null) {
  document.getElementById("taskSheetTitle").textContent = task ? "✏️ Editar tarefa" : "➕ Nova tarefa";
  document.getElementById("taskId").value = task ? task.id : "";
  document.getElementById("taskName").value = task ? task.name : "";
  document.getElementById("taskEmoji").value = task ? task.emoji : "✅";
  document.getElementById("taskEmojiPicks").innerHTML = ROUTINE_EMOJI_PICKS
    .map((emoji) => `<button type="button" class="rt-emoji-pick" data-click="pickEmoji" data-emoji="${emoji}">${emoji}</button>`).join("");
  const rec = task ? task.recurrence : { type: "daily" };
  document.querySelectorAll('input[name="taskRec"]').forEach((input) => {
    input.checked = input.value === rec.type;
  });
  const days = rec.type === "weekly" ? rec.days || [] : ["MO", "WE", "FR"];
  document.getElementById("taskDays").innerHTML = TOBA_WEEK_DAYS
    .map(([code, label]) => `<label class="toba-day"><input type="checkbox" value="${code}"${days.includes(code) ? " checked" : ""} /><span>${label}</span></label>`)
    .join("");
  document.getElementById("taskMonthDay").value = rec.type === "monthly" ? rec.monthDay : new Date().getDate();
  document.getElementById("taskTime").value = task ? task.time : "";
  document.getElementById("taskNag").checked = task ? task.nag !== false : true;
  const difficulty = task ? task.difficulty : "medium";
  document.getElementById("taskDifficulty").innerHTML = Object.entries(ROUTINE_DIFFICULTIES).map(([key, d]) => `
    <label class="rt-diff-card">
      <input type="radio" name="taskDiff" value="${key}"${key === difficulty ? " checked" : ""} />
      <span class="rt-diff-icon">${d.icon}</span>
      <span class="rt-diff-text"><strong>${d.name} · +${d.xp} XP</strong><small>${d.tag}</small></span>
    </label>`).join("");
  document.getElementById("deleteTaskBtn").hidden = !task;
  updateTaskForm();
  openTobaModal("taskSheet");
}

function updateTaskForm() {
  const type = document.querySelector('input[name="taskRec"]:checked')?.value || "daily";
  const situational = type === "situational";
  const hasTime = Boolean(document.getElementById("taskTime").value);
  document.getElementById("taskDaysGroup").hidden = type !== "weekly";
  document.getElementById("taskMonthGroup").hidden = type !== "monthly";
  document.getElementById("taskSituationalHelp").hidden = !situational;
  document.getElementById("taskTimeGroup").hidden = situational;
  document.getElementById("taskNagRow").hidden = situational || !hasTime;
  const editing = Boolean(document.getElementById("taskId").value);
  document.getElementById("taskCalendarBtn").hidden = !(editing && routineAlertMode() === "browser" && hasTime && (type === "daily" || type === "weekly"));
}

function readTaskForm() {
  const type = document.querySelector('input[name="taskRec"]:checked')?.value || "daily";
  const recurrence = { type };
  if (type === "weekly") recurrence.days = [...document.querySelectorAll("#taskDays input:checked")].map((i) => i.value);
  if (type === "monthly") recurrence.monthDay = Math.min(31, Math.max(1, Math.round(Number(document.getElementById("taskMonthDay").value) || 1)));
  return {
    name: document.getElementById("taskName").value.trim(),
    emoji: document.getElementById("taskEmoji").value.trim() || "✅",
    recurrence,
    time: type === "situational" ? "" : document.getElementById("taskTime").value,
    nag: document.getElementById("taskNag").checked,
    difficulty: document.querySelector('input[name="taskDiff"]:checked')?.value || "medium",
  };
}

function saveTask() {
  const data = readTaskForm();
  if (!data.name) {
    showPageMessage("Dá um nome pra tarefa, chefia.", { title: "Faltou o nome", icon: "✍️" });
    return;
  }
  if (data.recurrence.type === "weekly" && !data.recurrence.days.length) {
    showPageMessage("Escolha pelo menos um dia da semana.", { title: "Faltou o dia", icon: "🗓️" });
    return;
  }
  const existing = findRoutineTask(document.getElementById("taskId").value);
  if (existing) Object.assign(existing, data);
  else routineDb.tasks.push({ id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data, createdAt: toIsoDate() });
  if (!saveRoutineDb()) return;
  closeTobaModal("taskSheet");
  if (data.time) tobaAskNotify(); // no toque do botão: o navegador deixa pedir
  renderRoutine();
}

async function deleteTask() {
  const task = findRoutineTask(document.getElementById("taskId").value);
  if (!task) return;
  const ok = await showPageMessage("A tarefa some da lista e para de cobrar. O histórico e o XP que ela já deu ficam.", { title: `Apagar "${task.name}"?`, icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  task.archivedAt = toIsoDate(); // não cai mais a partir de hoje; o que já foi feito continua valendo
  if (!saveRoutineDb()) return;
  closeTobaModal("taskSheet");
  renderRoutine();
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

function addTaskToCalendar() {
  const task = findRoutineTask(document.getElementById("taskId").value);
  if (!task || !task.time) return;
  const days = task.recurrence.type === "weekly" ? task.recurrence.days : TOBA_WEEK_DAYS.map(([code]) => code);
  closeTobaModal("taskSheet");
  tobaOpenReminder({
    id: `rotina-${task.id}`,
    title: `${task.emoji} ${task.name}`,
    message: routineNagText(task, 0).body,
    times: [task.time],
    days,
  });
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
    routineDb.log.push({ id: newRoutineLogId(), taskId: String(task.id), date: item.date, doneAt: Number(item.at) || Date.now(), difficulty: task.difficulty });
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
  saveTask,
  deleteTask,
  toggleTask,
  doSituational,
  undoSituational,
  updateTaskForm,
  pickEmoji: (el) => {
    document.getElementById("taskEmoji").value = el.dataset.emoji;
  },
  showRoutineView: (el) => showRoutineView(el.dataset.view),
  openSuggestions,
  addSuggestions,
  enableRoutineNotify,
  addTaskToCalendar,
});

document.getElementById("taskTime").addEventListener("input", updateTaskForm);
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
