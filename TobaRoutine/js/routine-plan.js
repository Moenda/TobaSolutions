/* =====================================================================
 * Toba Routine · Meu dia fixo + sessões de Task (desde v1.42)
 * Usado pelas três páginas do app (Hub, Rotina e Task), depois do
 * routine-core.js. Quem grava é o saveRoutineDb() do core.
 * - ⚙️ → "🕰️ Meu dia fixo": sono, trabalho, transporte e blocos extras.
 *   É com isso que o Toba mede o tempo livre de cada dia.
 * - Marcar/desmarcar uma sessão de task (Hoje da Rotina e página Task).
 * Cada página pode definir onRoutinePlanChanged() para redesenhar.
 * ===================================================================== */
const ROUTINE_BLOCK_HELP = {
  sleep: "De que horas a que horas você dorme.",
  work: "Horário do trampo (dias de folga ficam desmarcados).",
  commute: "Ida + volta somadas. Marque só os dias que você vai presencial.",
  custom: "Faculdade, curso, buscar alguém... o que tomar tempo fixo.",
};
const ROUTINE_BREATHING_OPTIONS = [0, 30, 60, 90, 120, 180];

let dayPlanDraft = null;

const ROUTINE_DAYPLAN_HTML = `
<div class="toba-modal" id="dayPlanSheet" role="dialog" aria-modal="true" aria-labelledby="dayPlanTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="dayPlanTitle">🕰️ Meu dia fixo</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <p class="toba-sheet-text">O que já tem dono no seu dia. Com isso o Toba calcula quanto sobra livre e sugere o melhor dia pra cada task.</p>
    <div id="dayPlanBlocks"></div>
    <button type="button" class="btn btn-secondary rt-wide-btn" data-click="dayPlanAddBlock">➕ Outro bloco fixo</button>
    <div class="form-group rt-breath-group">
      <label for="dayPlanBreathing">🚿 Respiro por dia</label>
      <select id="dayPlanBreathing" class="form-control" data-change="dayPlanPreview"></select>
      <span class="rt-help">Banho, comer, tretar no zap. Ninguém é robô.</span>
    </div>
    <div class="section-title">🆓 Livre por dia</div>
    <div class="rt-week-free" id="dayPlanPreview"></div>
    <div class="toba-sheet-footer">
      <button type="button" class="btn btn-primary" data-click="saveDayPlan">Salvar</button>
    </div>
  </div>
</div>`;

function ensureDayPlanSheet() {
  if (document.getElementById("dayPlanSheet")) return;
  document.body.insertAdjacentHTML("beforeend", ROUTINE_DAYPLAN_HTML);
}

function openDayPlan() {
  ensureDayPlanSheet();
  dayPlanDraft = JSON.parse(JSON.stringify(routineDb.dayPlan));
  document.getElementById("dayPlanBreathing").innerHTML = ROUTINE_BREATHING_OPTIONS
    .map((m) => `<option value="${m}"${m === dayPlanDraft.breathing ? " selected" : ""}>${m ? routineFormatMinutes(m) : "Nenhum (modo robô 🤖)"}</option>`).join("");
  if (!ROUTINE_BREATHING_OPTIONS.includes(dayPlanDraft.breathing)) {
    document.getElementById("dayPlanBreathing").insertAdjacentHTML("beforeend", `<option value="${dayPlanDraft.breathing}" selected>${routineFormatMinutes(dayPlanDraft.breathing)}</option>`);
  }
  renderDayPlanBlocks();
  closeDataModal();
  openTobaModal("dayPlanSheet");
}

function renderDayPlanBlocks() {
  document.getElementById("dayPlanBlocks").innerHTML = dayPlanDraft.blocks.map((block, i) => {
    const custom = block.kind === "custom";
    const days = TOBA_WEEK_DAYS.map(([code, label]) =>
      `<label class="toba-day"><input type="checkbox" value="${code}" data-change="dayPlanPreview"${block.days.includes(code) ? " checked" : ""} /><span>${label}</span></label>`).join("");
    const time = block.kind === "commute"
      ? `<div class="form-group"><label>Minutos por dia (ida + volta)</label>
           <input type="number" class="form-control" data-field="minutes" min="0" max="600" step="5" inputmode="numeric" value="${block.minutes}" data-change="dayPlanPreview" /></div>`
      : `<div class="rt-time-row">
           <div class="form-group"><label>Começa</label><input type="time" class="form-control" data-field="start" value="${escapeHtml(block.start)}" data-change="dayPlanPreview" /></div>
           <div class="form-group"><label>Termina</label><input type="time" class="form-control" data-field="end" value="${escapeHtml(block.end)}" data-change="dayPlanPreview" /></div>
         </div>`;
    return `
      <div class="card rt-block" data-index="${i}">
        <div class="rt-block-head">
          ${custom
            ? `<input type="text" class="form-control rt-emoji-input" data-field="emoji" maxlength="8" value="${escapeHtml(block.emoji)}" aria-label="Emoji" />
               <input type="text" class="form-control" data-field="name" maxlength="40" value="${escapeHtml(block.name)}" placeholder="Ex: Faculdade" aria-label="Nome do bloco" />
               <button type="button" class="rt-undo" data-click="dayPlanRemoveBlock" data-index="${i}" aria-label="Tirar bloco">🗑️</button>`
            : `<span class="rt-task-emoji is-big">${escapeHtml(block.emoji)}</span><strong>${escapeHtml(block.name)}</strong>`}
          <span class="rt-block-total" data-total></span>
        </div>
        <span class="rt-help">${ROUTINE_BLOCK_HELP[block.kind]}</span>
        <div class="toba-days">${days}</div>
        ${time}
      </div>`;
  }).join("");
  dayPlanPreview();
}

// Lê a tela para o rascunho (sem gravar)
function readDayPlanForm() {
  document.querySelectorAll("#dayPlanBlocks .rt-block").forEach((row) => {
    const block = dayPlanDraft.blocks[Number(row.dataset.index)];
    if (!block) return;
    block.days = [...row.querySelectorAll(".toba-days input:checked")].map((i) => i.value);
    row.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      block[field] = field === "minutes" ? Math.max(0, Math.round(Number(input.value) || 0)) : input.value.trim();
    });
  });
  dayPlanDraft.breathing = Number(document.getElementById("dayPlanBreathing").value) || 0;
}

function dayPlanPreview() {
  readDayPlanForm();
  document.querySelectorAll("#dayPlanBlocks .rt-block").forEach((row) => {
    const block = dayPlanDraft.blocks[Number(row.dataset.index)];
    row.querySelector("[data-total]").textContent = block && block.days.length ? routineFormatMinutes(routineBlockMinutes(block)) : "desligado";
  });
  // Livre só com o dia fixo + rotina (sem as tasks), de seg a dom
  const fake = { ...routineDb, dayPlan: dayPlanDraft, oneoffs: [] };
  const monday = routineAddDays(toIsoDate(), -((new Date().getDay() + 6) % 7));
  document.getElementById("dayPlanPreview").innerHTML = TOBA_WEEK_DAYS.map(([, label], i) => {
    const load = calcRoutineDayLoad(fake, routineAddDays(monday, i));
    return `<div class="rt-free-day"><span>${label}</span><strong>${routineFormatMinutes(load.free)}</strong></div>`;
  }).join("");
}

function dayPlanAddBlock() {
  readDayPlanForm();
  dayPlanDraft.blocks.push({ id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: "custom", name: "", emoji: "📌", days: ["MO", "WE"], start: "19:00", end: "21:00" });
  renderDayPlanBlocks();
}

function dayPlanRemoveBlock(el) {
  readDayPlanForm();
  dayPlanDraft.blocks.splice(Number(el.dataset.index), 1);
  renderDayPlanBlocks();
}

function saveDayPlan() {
  readDayPlanForm();
  dayPlanDraft.blocks.forEach((block) => {
    if (block.kind === "custom" && !block.name) block.name = "Bloco fixo";
  });
  const before = routineDb.dayPlan;
  routineDb.dayPlan = { ...dayPlanDraft, configured: true };
  normalizeRoutineDayPlan(routineDb);
  if (!saveRoutineDb()) {
    routineDb.dayPlan = before;
    return;
  }
  closeTobaModal("dayPlanSheet");
  if (typeof onRoutinePlanChanged === "function") onRoutinePlanChanged();
}

/* ---------------------------------------------------------------------
 * Sessões de task
 * ------------------------------------------------------------------- */
function findRoutineOneoff(id) {
  return (routineDb.oneoffs || []).find((o) => String(o.id) === String(id));
}

function newRoutineOneoffId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Linha de uma sessão (Hoje da Rotina e página Task)
function renderOneoffSessionRow(oneoff, session, { showDate = false, today = toIsoDate() } = {}) {
  const done = Boolean(session.doneAt);
  const missed = !done && session.date < today;
  const meta = [
    showDate ? `📅 ${describeOneoffDay(session.date, today)}` : "",
    `⏱️ ${routineFormatMinutes(session.minutes)}`,
    `+${routineOneoffXp(session.minutes)} XP`,
    oneoff.split && routineOneoffStatus(oneoff, today).doneMin ? `${routineFormatMinutes(routineOneoffStatus(oneoff, today).doneMin)} de ${routineFormatMinutes(oneoff.minutes)}` : "",
    missed ? "🙈 furou" : "",
  ].filter(Boolean).join(" · ");
  return `
    <div class="rt-task is-oneoff${done ? " is-done" : ""}${missed ? " is-overdue" : ""}">
      <button type="button" class="rt-check" data-click="toggleOneoffSession" data-id="${escapeHtml(oneoff.id)}" data-session="${escapeHtml(session.id)}" aria-pressed="${done}" aria-label="${done ? "Desmarcar" : "Marcar como feita"}: ${escapeHtml(oneoff.name)}">${done ? "✓" : ""}</button>
      <div class="rt-task-body" role="button" tabindex="0" data-click="openOneoffFromRow" data-id="${escapeHtml(oneoff.id)}">
        <span class="rt-task-name"><span class="rt-task-emoji">${escapeHtml(oneoff.emoji)}</span>${escapeHtml(oneoff.name)}</span>
        <span class="rt-task-meta">${meta}</span>
      </div>
    </div>`;
}

function describeOneoffDay(iso, today = toIsoDate()) {
  const diff = Math.round((new Date(`${iso}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const weekday = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// Marcar sessão: vale XP no dia em que marcou. Completou o tempo = task feita.
function toggleOneoffSession(el) {
  const oneoff = findRoutineOneoff(el.dataset.id);
  const session = oneoff && oneoff.sessions.find((s) => String(s.id) === String(el.dataset.session));
  if (!session) return;
  const before = JSON.stringify(oneoff);
  const today = toIsoDate();
  let finishedNow = false;
  if (session.doneAt) {
    delete session.doneAt;
    if (oneoff.doneAt && routineOneoffStatus(oneoff, today).doneMin < oneoff.minutes) delete oneoff.doneAt;
  } else {
    session.doneAt = Date.now();
    if (!oneoff.split || routineOneoffStatus({ ...oneoff, doneAt: undefined }, today).doneMin >= oneoff.minutes) {
      if (!oneoff.doneAt) finishedNow = true;
      oneoff.doneAt = oneoff.doneAt || Date.now();
      // Sessões que sobraram no futuro não fazem mais sentido
      oneoff.sessions = oneoff.sessions.filter((s) => s.doneAt || s.date < today);
    }
  }
  if (!saveRoutineDb({ silent: true })) {
    Object.assign(oneoff, JSON.parse(before));
    return;
  }
  if (session.doneAt) {
    floatOneoffXp(el, `+${routineOneoffXp(session.minutes)} XP`);
    tobaPlayerCheck({ reason: finishedNow ? `${oneoff.emoji} ${oneoff.name}: DONE! 🎉` : `${oneoff.emoji} Mais um pedaço de ${oneoff.name}` });
  } else {
    tobaToast("↩ Desmarcada (o XP saiu junto)");
    tobaPlayerCheck();
  }
  if (typeof onRoutinePlanChanged === "function") setTimeout(onRoutinePlanChanged, session.doneAt ? 350 : 0);
}

function floatOneoffXp(anchor, text) {
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

tobaActions({
  openDayPlan,
  dayPlanAddBlock,
  dayPlanRemoveBlock,
  dayPlanPreview,
  saveDayPlan,
  toggleOneoffSession,
});
