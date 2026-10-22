/* =====================================================================
 * Toba Routine · folha da tarefa da rotina + marcar/desmarcar (desde v1.49)
 * Saiu do routine.js/TobaRoutine-Rotina.html pra Agenda também editar e
 * concluir a tarefa sem trocar de módulo. Usado na Rotina e na Agenda,
 * depois do routine-core.js e do routine-alerts.js (e do toba-player.js,
 * pra comemorar o XP). A folha (#taskSheet) é posta na página pelo JS.
 * Cada página define onRoutineTaskSaved() para redesenhar.
 * ===================================================================== */
const ROUTINE_EMOJI_PICKS = ["🚽", "🪴", "🐕", "😴", "🗑️", "🍽️", "🧺", "🧹", "💧", "💊", "📚", "🛒", "💸", "🧘", "📞", "🐈"];
const ROUTINE_MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

const ROUTINE_TASK_SHEET_HTML = `
<div class="toba-modal" id="taskSheet" role="dialog" aria-modal="true" aria-labelledby="taskSheetTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="taskSheetTitle">➕ Nova tarefa</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <form data-submit="saveTask">
      <input type="hidden" id="taskId" />
      <div class="rt-name-row">
        <div class="form-group rt-emoji-group">
          <label for="taskEmoji">Emoji</label>
          <input type="text" id="taskEmoji" class="form-control rt-emoji-input" maxlength="8" autocomplete="off" />
        </div>
        <div class="form-group rt-name-group">
          <label for="taskName">Tarefa</label>
          <input type="text" id="taskName" class="form-control" maxlength="60" placeholder="Ex: Lavar o banheiro" autocomplete="off" />
        </div>
      </div>
      <div class="rt-emoji-picks" id="taskEmojiPicks"></div>

      <div class="form-group">
        <label>Quando</label>
        <div class="rt-segment" id="taskRecurrence">
          <label><input type="radio" name="taskRec" value="daily" data-change="updateTaskForm" /><span>Todo dia</span></label>
          <label><input type="radio" name="taskRec" value="weekly" data-change="updateTaskForm" /><span>Semana</span></label>
          <label><input type="radio" name="taskRec" value="monthly" data-change="updateTaskForm" /><span>Mês</span></label>
          <label><input type="radio" name="taskRec" value="situational" data-change="updateTaskForm" /><span>Quando der</span></label>
        </div>
      </div>
      <div class="form-group" id="taskDaysGroup">
        <label>Dias da semana</label>
        <div class="toba-days" id="taskDays"></div>
      </div>
      <div class="form-group" id="taskMonthGroup">
        <label for="taskMonthDay">Dia do mês</label>
        <input type="number" id="taskMonthDay" class="form-control" min="1" max="31" inputmode="numeric" />
        <span class="rt-help">Dia 31 em mês curto cai no último dia.</span>
      </div>
      <p class="rt-help" id="taskSituationalHelp">Sem agenda: aparece em "Quando acontecer" e você marca quando fizer (vale XP até 3× por dia).</p>

      <div class="form-group" id="taskTimeGroup">
        <label for="taskTime">Horário (opcional)</label>
        <input type="time" id="taskTime" class="form-control" />
      </div>
      <label class="check-row" id="taskNagRow"><span>😈 Cobrar se eu não fizer (+30 min e +2 h)</span><input type="checkbox" id="taskNag" /></label>
      <label class="check-row" id="taskCarryRow"><span>↪️ Se não fizer, passa pro dia seguinte</span><input type="checkbox" id="taskCarry" /></label>
      <span class="rt-help rt-carry-help">Desligado, ela expira à meia-noite (ex: dormir na hora). Ligado, vira atrasada e vale metade do XP.</span>

      <div class="form-group" id="taskMinutesGroup">
        <label for="taskMinutes">⏱️ Quanto tempo leva</label>
        <select id="taskMinutes" class="form-control"></select>
        <span class="rt-help">Serve pro Toba saber quanto do dia ela ocupa na hora de encaixar uma task. Tarefa de horário (tipo dormir às 23h) vai de 0 min.</span>
      </div>

      <div class="form-group">
        <label>Dificuldade</label>
        <div class="rt-diff" id="taskDifficulty"></div>
      </div>

      <button type="button" class="btn btn-secondary rt-wide-btn" id="taskCalendarBtn" data-click="addTaskToCalendar" hidden>📅 Pôr na agenda do celular</button>

      <div class="toba-sheet-footer">
        <div class="btn-row">
          <button type="button" class="btn btn-danger btn-grow-1" id="deleteTaskBtn" data-click="deleteTask" hidden>🗑️ Apagar</button>
          <button type="submit" class="btn btn-primary btn-grow-2">Salvar</button>
        </div>
      </div>
    </form>
  </div>
</div>
`;

function ensureTaskSheet() {
  if (document.getElementById("taskSheet")) return;
  document.body.insertAdjacentHTML("beforeend", ROUTINE_TASK_SHEET_HTML);
  document.getElementById("taskTime").addEventListener("input", updateTaskForm);
}

function findRoutineTask(id) {
  return routineDb.tasks.find((t) => String(t.id) === String(id));
}

function newRoutineLogId() {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/* Marca ou desmarca a tarefa num dia (mesma regra em toda tela; o card do
 * portal repete a do log, ver CLAUDE.md 3.6). Grava e devolve:
 * "undone" (desmarcou, o XP sai junto), "done" (marcou; entry = entrada do
 * log), "expired" (não passa pro dia seguinte e o dia já foi: não grava)
 * ou "" (não conseguiu gravar). Marcar uma ocorrência deixada pra lá
 * (Agenda) tira o descarte: o feito ganha. */
function routineToggleOccurrence(task, date) {
  const exists = routineDb.log.some((e) => e.taskId === String(task.id) && e.date === date);
  if (exists) {
    const before = routineDb.log;
    routineDb.log = routineDb.log.filter((e) => !(e.taskId === String(task.id) && e.date === date));
    if (!saveRoutineDb({ silent: true })) {
      routineDb.log = before;
      return { result: "" };
    }
    return { result: "undone" };
  }
  if (!routineCarriesOver(task) && date < toIsoDate()) return { result: "expired" };
  const entry = { id: newRoutineLogId(), taskId: String(task.id), date, doneAt: Date.now(), difficulty: task.difficulty };
  const skippedBefore = routineDb.skipped;
  routineDb.log.push(entry);
  routineDb.skipped = (routineDb.skipped || []).filter((k) => !(k.taskId === String(task.id) && k.date === date));
  if (!saveRoutineDb({ silent: true })) {
    routineDb.log = routineDb.log.filter((e) => e !== entry);
    routineDb.skipped = skippedBefore;
    return { result: "" };
  }
  return { result: "done", entry };
}

function routineExpiredMessage(task) {
  showPageMessage(`"${task.name}" não passa pro dia seguinte: o dia dela acabou e não dá mais pra marcar. Amanhã tem revanche 💪`, { title: "Essa expirou", icon: "⌛" });
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
  document.getElementById("taskCarry").checked = routineCarriesOver(task);
  // 0 = não ocupa tempo (ex: dormir às 23h); vazio = chute pela dificuldade
  const minutes = task && task.minutes !== undefined ? Number(task.minutes) : "";
  const minuteOptions = ROUTINE_MINUTE_OPTIONS.includes(minutes) || minutes === "" ? ROUTINE_MINUTE_OPTIONS : [...ROUTINE_MINUTE_OPTIONS, minutes].sort((a, b) => a - b);
  document.getElementById("taskMinutes").innerHTML = `<option value="">Chute pela dificuldade (15/30/60 min)</option>${minuteOptions
    .map((m) => `<option value="${m}"${m === minutes ? " selected" : ""}>${m === 0 ? "0 min (não ocupa tempo)" : routineFormatMinutes(m)}</option>`).join("")}`;
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
  document.getElementById("taskCarryRow").hidden = situational;
  document.getElementById("taskMinutesGroup").hidden = situational;
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
    carryOver: type === "situational" || document.getElementById("taskCarry").checked,
    difficulty: document.querySelector('input[name="taskDiff"]:checked')?.value || "medium",
    minutes: type === "situational" ? null : routineReadMinutesField(document.getElementById("taskMinutes").value),
  };
}

// "" = sem duração (chute pela dificuldade) -> null; "0" = não ocupa tempo -> 0
function routineReadMinutesField(value) {
  if (value === "") return null;
  return Math.max(0, Math.round(Number(value) || 0));
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
  const minutes = data.minutes;
  delete data.minutes; // sem duração escolhida = campo ausente (chute pela dificuldade)
  if (minutes !== null) data.minutes = minutes;
  if (existing) {
    Object.assign(existing, data);
    if (minutes === null) delete existing.minutes;
  } else routineDb.tasks.push({ id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data, createdAt: toIsoDate() });
  if (!saveRoutineDb()) return;
  closeTobaModal("taskSheet");
  if (data.time) tobaAskNotify(); // no toque do botão: o navegador deixa pedir
  routineTaskSheetDone();
}

async function deleteTask() {
  const task = findRoutineTask(document.getElementById("taskId").value);
  if (!task) return;
  const ok = await showPageMessage("A tarefa some da lista e para de cobrar. O histórico e o XP que ela já deu ficam.", { title: `Apagar "${task.name}"?`, icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  task.archivedAt = toIsoDate(); // não cai mais a partir de hoje; o que já foi feito continua valendo
  if (!saveRoutineDb()) return;
  closeTobaModal("taskSheet");
  routineTaskSheetDone();
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

function routineTaskSheetDone() {
  if (typeof onRoutineTaskSaved === "function") onRoutineTaskSaved();
}

tobaActions({
  saveTask,
  deleteTask,
  updateTaskForm,
  addTaskToCalendar,
  pickEmoji: (el) => {
    document.getElementById("taskEmoji").value = el.dataset.emoji;
  },
});

ensureTaskSheet();
