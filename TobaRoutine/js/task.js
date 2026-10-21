/* =====================================================================
 * Toba Routine · módulo Task (desde v1.42)
 * Tarefas que não são rotina (pintar o quarto, consertar a privada, ler um
 * livro): você diz quanto tempo leva e o Toba sugere o dia com mais folga,
 * olhando o Meu dia fixo, a rotina e as outras tasks (suggestRoutineOneoff).
 * Depende de toba-common.js, routine-metrics.js, routine-core.js,
 * health-metrics.js + toba-player.js (XP), routine-alerts.js e routine-plan.js.
 * Banco: TOBA_ROUTINE_DB.oneoffs (formato no topo do routine-core.js).
 * ===================================================================== */
const ONEOFF_EMOJI_PICKS = ["🎨", "🍱", "🚽", "🔧", "📚", "✏️", "🧹", "📦", "🪴", "🛒", "🚗", "🧺", "🪑", "🩺"];
const ONEOFF_CHUNKS = [30, 45, 60, 90, 120, 180];

let oneoffOpenId = null; // task aberta no detalhe
let oneoffTimeTouched = false; // mexeu na duração: o chute do Toba para de trocar
let oneoffSuggestion = null; // { id, result } da última sugestão aberta

/* ---------------------------------------------------------------------
 * Ajudantes
 * ------------------------------------------------------------------- */
function activeOneoffs() {
  return (routineDb.oneoffs || []).filter((o) => !o.archivedAt);
}

function oneoffDateLabel(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function oneoffWeekday(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
}

// "Hoje · terça-feira", "Amanhã · quarta-feira", "Dom 25/10"
function oneoffDayName(iso, today) {
  const label = describeOneoffDay(iso, today);
  return label === "Hoje" || label === "Amanhã" ? `${label} · ${oneoffWeekday(iso)}` : label;
}

function oneoffMeta(oneoff, status) {
  return [
    status.doneMin && !oneoff.doneAt ? `⏱️ falta ${routineFormatMinutes(oneoff.minutes - status.doneMin)} de ${routineFormatMinutes(oneoff.minutes)}` : `⏱️ ${routineFormatMinutes(oneoff.minutes)}`,
    oneoff.split ? "🍕 em pedaços" : "",
    routineOneoffWhen(oneoff) === "weekend" ? "🛋️ fim de semana" : routineOneoffWhen(oneoff) === "weekday" ? "💼 dia de semana" : "",
    oneoff.deadline && !oneoff.doneAt ? `📌 até ${oneoffDateLabel(oneoff.deadline)}` : "",
  ].filter(Boolean).join(" · ");
}

function oneoffTotalXp(oneoff) {
  if (!oneoff.split) return routineOneoffXp(oneoff.minutes);
  const chunk = oneoff.chunk || 60;
  const full = Math.floor(oneoff.minutes / chunk);
  const rest = oneoff.minutes % chunk;
  return full * routineOneoffXp(chunk) + (rest ? routineOneoffXp(rest) : 0);
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderTaskPage() {
  const today = toIsoDate();
  const list = activeOneoffs();
  const statuses = new Map(list.map((o) => [o.id, routineOneoffStatus(o, today)]));
  const open = list.filter((o) => !o.doneAt);
  const queue = open.filter((o) => statuses.get(o.id).toPlan > 0);
  const month = today.slice(0, 7);
  const doneMonth = list.filter((o) => o.doneAt && toIsoDate(new Date(o.doneAt)).startsWith(month)).length;
  const plannedSessions = [];
  open.forEach((o) => statuses.get(o.id).planned.forEach((s) => plannedSessions.push({ oneoff: o, session: s })));
  // Feitas hoje continuam na lista do dia (dá pra desmarcar)
  list.forEach((o) => o.sessions.forEach((s) => {
    if (s.doneAt && s.date === today) plannedSessions.push({ oneoff: o, session: s });
  }));
  plannedSessions.sort((a, b) => a.session.date.localeCompare(b.session.date) || Boolean(a.session.doneAt) - Boolean(b.session.doneAt));

  let line = "Nenhuma task. Aquela prateleira torta agradece o esquecimento 🪑";
  if (open.length && !queue.length) line = "Tudo agendado. Agora é só aparecer no dia 😎";
  else if (queue.length === 1) line = "1 task esperando dia. Bora perguntar pro Toba? 🔮";
  else if (queue.length) line = `${queue.length} tasks esperando dia. A fila não anda sozinha 🐌`;
  document.getElementById("tkHero").innerHTML = `
    <strong class="rt-hero-line">${line}</strong>
    <div class="toba-stats is-3">
      <div class="toba-stat is-center"><span class="toba-stat-label">📥 Fila</span><span class="toba-stat-value">${queue.length}</span></div>
      <div class="toba-stat is-center"><span class="toba-stat-label">📅 Com dia</span><span class="toba-stat-value">${open.length - queue.length}</span></div>
      <div class="toba-stat is-center"><span class="toba-stat-label">✅ No mês</span><span class="toba-stat-value">${doneMonth}</span></div>
    </div>`;

  document.getElementById("tkNotice").innerHTML = routineDb.dayPlan.configured
    ? ""
    : `<button type="button" class="hint-box rt-notice-btn" data-click="openDayPlan">🕰️ O Toba tá chutando seu dia (trampo 9h–18h, dorme 23h30). Toque pra contar como é de verdade e a sugestão fica certeira.</button>`;

  document.getElementById("tkPlanned").innerHTML = plannedSessions.length
    ? `<div class="section-title">📅 Agendadas</div>${plannedSessions.map(({ oneoff, session }, i) => {
        const label = i === 0 || plannedSessions[i - 1].session.date !== session.date
          ? `<div class="rt-day-label">${oneoffDayName(session.date, today)}</div>` : "";
        return `${label}<div class="rt-list">${renderOneoffSessionRow(oneoff, session, { today })}</div>`;
      }).join("")}`
    : "";

  document.getElementById("tkQueue").innerHTML = queue.length
    ? `<div class="section-title">📥 Na fila <span class="rt-title-hint">esperando dia</span></div>
       <div class="rt-list">${queue.map((o) => {
         const st = statuses.get(o.id);
         const missed = st.missed.length ? `🙈 furou ${st.missed.map((s) => oneoffDateLabel(s.date)).join(", ")}` : "";
         return `
          <div class="rt-task is-list${missed ? " is-overdue" : ""}" role="button" tabindex="0" data-click="openOneoff" data-id="${escapeHtml(o.id)}">
            <span class="rt-task-emoji is-big">${escapeHtml(o.emoji)}</span>
            <div class="rt-task-body">
              <span class="rt-task-name">${escapeHtml(o.name)}</span>
              <span class="rt-task-meta">${[oneoffMeta(o, st), missed].filter(Boolean).join(" · ")}</span>
            </div>
            <button type="button" class="btn btn-sm btn-primary" data-click="suggestOneoff" data-id="${escapeHtml(o.id)}">🔮 Dia?</button>
          </div>`;
       }).join("")}</div>`
    : list.length ? "" : tobaEmpty("🛠️", "Nenhuma task ainda", "Toque em + Task: pintar o quarto, fazer as marmitas, ler aquele livro...");

  const done = list.filter((o) => o.doneAt).sort((a, b) => b.doneAt - a.doneAt);
  document.getElementById("tkDone").innerHTML = done.length
    ? `<details class="rt-more"><summary>✅ Feitas (${done.length})</summary><div class="rt-list">${done.map((o) => `
        <div class="rt-task is-list is-done" role="button" tabindex="0" data-click="openOneoff" data-id="${escapeHtml(o.id)}">
          <span class="rt-task-emoji is-big">${escapeHtml(o.emoji)}</span>
          <div class="rt-task-body">
            <span class="rt-task-name">${escapeHtml(o.name)}</span>
            <span class="rt-task-meta">✅ ${oneoffDateLabel(toIsoDate(new Date(o.doneAt)))} · ⏱️ ${routineFormatMinutes(o.minutes)}</span>
          </div>
        </div>`).join("")}</div></details>`
    : "";
}

/* ---------------------------------------------------------------------
 * Criar / editar
 * ------------------------------------------------------------------- */
function fillOneoffTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = document.getElementById("oneoffHours");
  hours.innerHTML = Array.from({ length: 41 }, (_, i) => `<option value="${i}"${i === h ? " selected" : ""}>${i} h</option>`).join("");
  const mins = [0, 15, 30, 45];
  if (!mins.includes(m)) mins.push(m);
  document.getElementById("oneoffMins").innerHTML = mins.sort((a, b) => a - b).map((v) => `<option value="${v}"${v === m ? " selected" : ""}>${v} min</option>`).join("");
}

function readOneoffMinutes() {
  return (Number(document.getElementById("oneoffHours").value) || 0) * 60 + (Number(document.getElementById("oneoffMins").value) || 0);
}

function openOneoffSheet(oneoff = null) {
  document.getElementById("oneoffSheetTitle").textContent = oneoff ? "✏️ Editar task" : "➕ Nova task";
  document.getElementById("oneoffId").value = oneoff ? oneoff.id : "";
  document.getElementById("oneoffName").value = oneoff ? oneoff.name : "";
  document.getElementById("oneoffEmoji").value = oneoff ? oneoff.emoji : "🛠️";
  document.getElementById("oneoffEmojiPicks").innerHTML = ONEOFF_EMOJI_PICKS
    .map((emoji) => `<button type="button" class="rt-emoji-pick" data-click="pickOneoffEmoji" data-emoji="${emoji}">${emoji}</button>`).join("");
  fillOneoffTime(oneoff ? oneoff.minutes : 120);
  document.getElementById("oneoffSplit").checked = oneoff ? oneoff.split : false;
  const chunk = oneoff ? oneoff.chunk : 60;
  const chunks = ONEOFF_CHUNKS.includes(chunk) ? ONEOFF_CHUNKS : [...ONEOFF_CHUNKS, chunk].sort((a, b) => a - b);
  document.getElementById("oneoffChunk").innerHTML = chunks.map((c) => `<option value="${c}"${c === chunk ? " selected" : ""}>${routineFormatMinutes(c)}</option>`).join("");
  setOneoffWhen(oneoff ? routineOneoffWhen(oneoff) : "any");
  document.getElementById("oneoffDeadline").value = oneoff ? oneoff.deadline : "";
  document.getElementById("oneoffDeadline").min = toIsoDate();
  document.getElementById("deleteOneoffBtn").hidden = !oneoff;
  document.getElementById("saveOneoffBtn").textContent = oneoff ? "Salvar" : "Salvar e achar o dia 🔮";
  document.getElementById("oneoffGuess").textContent = oneoff ? "" : "Escreve o nome que o Toba chuta o tempo. Depois é só ajustar.";
  oneoffTimeTouched = Boolean(oneoff);
  updateOneoffForm();
  closeTobaModal("oneoffDetail");
  openTobaModal("oneoffSheet");
}

function setOneoffWhen(when) {
  const input = document.querySelector(`input[name="oneoffWhen"][value="${when}"]`);
  if (input) input.checked = true;
}

function readOneoffWhen() {
  return document.querySelector('input[name="oneoffWhen"]:checked')?.value || "any";
}

function updateOneoffForm() {
  document.getElementById("oneoffChunkGroup").hidden = !document.getElementById("oneoffSplit").checked;
}

// Chute do Toba pelo nome (só enquanto você não mexeu na duração)
function guessOneoff() {
  if (oneoffTimeTouched) return;
  const guess = routineGuessOneoff(document.getElementById("oneoffName").value);
  const help = document.getElementById("oneoffGuess");
  if (!guess) {
    help.textContent = "Escreve o nome que o Toba chuta o tempo. Depois é só ajustar.";
    return;
  }
  fillOneoffTime(guess.minutes);
  setOneoffWhen(guess.heavy ? "weekend" : "any");
  document.getElementById("oneoffSplit").checked = guess.split;
  updateOneoffForm();
  help.textContent = `🤖 Chute do Toba: ${routineFormatMinutes(guess.minutes)}${guess.heavy ? ", pesada (melhor no fim de semana)" : ""}${guess.split ? ", dá pra fatiar" : ""}. Ajusta se ele viajou.`;
}

function saveOneoff() {
  const name = document.getElementById("oneoffName").value.trim();
  const minutes = readOneoffMinutes();
  if (!name) {
    showPageMessage("Dá um nome pra task, chefia.", { title: "Faltou o nome", icon: "✍️" });
    return;
  }
  if (minutes < 15) {
    showPageMessage("Coloca pelo menos 15 minutos. Menos que isso é só fazer agora 😂", { title: "Tempo curto demais", icon: "⏱️" });
    return;
  }
  const data = {
    name,
    emoji: document.getElementById("oneoffEmoji").value.trim() || "🛠️",
    minutes,
    split: document.getElementById("oneoffSplit").checked,
    chunk: Number(document.getElementById("oneoffChunk").value) || 60,
    when: readOneoffWhen(),
    heavy: readOneoffWhen() === "weekend", // leitores antigos
    deadline: document.getElementById("oneoffDeadline").value || "",
  };
  const existing = findRoutineOneoff(document.getElementById("oneoffId").value);
  let target = existing;
  if (existing) {
    const before = JSON.stringify(existing);
    Object.assign(existing, data);
    // Diminuiu o tempo e o que já foi feito cobre tudo: terminou
    const st = routineOneoffStatus({ ...existing, doneAt: undefined }, toIsoDate());
    if (!existing.doneAt && existing.sessions.some((s) => s.doneAt) && st.doneMin >= existing.minutes) existing.doneAt = Date.now();
    if (existing.doneAt && st.doneMin < existing.minutes && !existing.split && !existing.sessions.some((s) => s.doneAt)) delete existing.doneAt;
    if (!saveRoutineDb()) {
      Object.assign(existing, JSON.parse(before));
      return;
    }
  } else {
    target = { id: newRoutineOneoffId("o"), ...data, createdAt: toIsoDate(), sessions: [] };
    routineDb.oneoffs.push(target);
    if (!saveRoutineDb({ silent: true })) {
      routineDb.oneoffs = routineDb.oneoffs.filter((o) => o !== target);
      return;
    }
  }
  closeTobaModal("oneoffSheet");
  renderTaskPage();
  if (!existing) openSuggestion(target);
}

async function deleteOneoff() {
  const oneoff = findRoutineOneoff(document.getElementById("oneoffId").value);
  if (!oneoff) return;
  const ok = await showPageMessage("Ela some da lista e das agendas. O XP dos pedaços que você já fez fica.", { title: `Apagar "${oneoff.name}"?`, icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  const before = JSON.stringify(oneoff);
  if (oneoff.sessions.some((s) => s.doneAt)) {
    oneoff.archivedAt = toIsoDate(); // tem XP: fica guardada, só some da tela
    oneoff.sessions = oneoff.sessions.filter((s) => s.doneAt);
  } else {
    routineDb.oneoffs = routineDb.oneoffs.filter((o) => o !== oneoff);
  }
  if (!saveRoutineDb()) {
    if (!routineDb.oneoffs.includes(oneoff)) routineDb.oneoffs.push(oneoff);
    Object.assign(oneoff, JSON.parse(before));
    delete oneoff.archivedAt;
    return;
  }
  closeTobaModal("oneoffSheet");
  renderTaskPage();
}

/* ---------------------------------------------------------------------
 * Detalhe
 * ------------------------------------------------------------------- */
function openOneoff(id) {
  const oneoff = findRoutineOneoff(id);
  if (!oneoff) return;
  oneoffOpenId = oneoff.id;
  renderOneoffDetail();
  openTobaModal("oneoffDetail");
}

function renderOneoffDetail() {
  const oneoff = findRoutineOneoff(oneoffOpenId);
  if (!oneoff) return;
  const today = toIsoDate();
  const st = routineOneoffStatus(oneoff, today);
  document.getElementById("oneoffDetailTitle").textContent = `${oneoff.emoji} ${oneoff.name}`;
  const sessions = [...oneoff.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const xpLine = oneoff.doneAt
    ? `✅ Terminada em ${oneoffDateLabel(toIsoDate(new Date(oneoff.doneAt)))}. Bonito de ver 👏`
    : `Vale ~${oneoffTotalXp(oneoff)} XP no total (20 por hora, fora do teto da rotina).`;
  document.getElementById("oneoffDetailBody").innerHTML = `
    <p class="toba-sheet-text">${oneoffMeta(oneoff, st)}</p>
    <div class="rt-progress"><span style="width:${Math.round(st.ratio * 100)}%"></span></div>
    <p class="rt-help">${routineFormatMinutes(st.doneMin)} feitos de ${routineFormatMinutes(oneoff.minutes)}${st.plannedMin ? ` · ${routineFormatMinutes(st.plannedMin)} agendados` : ""}${st.toPlan ? ` · ${routineFormatMinutes(st.toPlan)} sem dia` : ""}. ${xpLine}</p>
    ${sessions.length ? `<div class="section-title">📅 Dias</div><div class="rt-list">${sessions.map((s) => `
      <div class="rt-session-row">
        ${renderOneoffSessionRow(oneoff, s, { showDate: true, today })}
        ${s.doneAt ? "" : `<button type="button" class="rt-undo" data-click="removeOneoffSession" data-session="${escapeHtml(s.id)}" aria-label="Tirar esse dia">✕</button>`}
      </div>`).join("")}</div>` : ""}
    ${oneoff.doneAt ? "" : `
      <div class="section-title">✋ Escolher o dia na mão</div>
      <div class="rt-time-row">
        <input type="date" id="manualDate" class="form-control" min="${today}" value="${today}" aria-label="Dia" />
        <select id="manualMinutes" class="form-control" aria-label="Quanto tempo">${oneoffManualOptions(oneoff, st)}</select>
      </div>
      <button type="button" class="btn btn-secondary rt-wide-btn" data-click="addManualSession">📅 Agendar nesse dia</button>
      <button type="button" class="btn btn-green rt-wide-btn" data-click="finishOneoff">✅ Já terminei</button>`}
    ${oneoff.doneAt ? `<button type="button" class="btn btn-secondary rt-wide-btn" data-click="reopenOneoff">↩ Ainda não acabou</button>` : ""}`;
  const suggestBtn = document.getElementById("detailSuggestBtn");
  suggestBtn.hidden = Boolean(oneoff.doneAt);
  suggestBtn.textContent = st.toPlan ? "🔮 Toba, qual dia?" : "🔮 Remarcar";
}

function oneoffManualOptions(oneoff, st) {
  const left = Math.max(15, st.toPlan || oneoff.minutes - st.doneMin);
  const values = new Set([left]);
  if (oneoff.split) [30, 60, 90, 120, 180, oneoff.chunk].forEach((v) => v < left && values.add(v));
  return [...values].sort((a, b) => a - b).map((v) => `<option value="${v}"${v === (oneoff.split ? Math.min(left, oneoff.chunk) : left) ? " selected" : ""}>${routineFormatMinutes(v)}</option>`).join("");
}

function addManualSession() {
  const oneoff = findRoutineOneoff(oneoffOpenId);
  const date = document.getElementById("manualDate").value;
  const minutes = Number(document.getElementById("manualMinutes").value) || 0;
  if (!oneoff || !routineIsIso(date) || !minutes) return;
  if (date < toIsoDate()) {
    showPageMessage("Esse dia já foi. Se já fez, toca em ✅ Já terminei.", { title: "Dia que passou", icon: "📅" });
    return;
  }
  // Inteira: escolher outro dia = mudar o dia (não duplica). Em pedaços: soma mais um dia.
  scheduleOneoffSessions(oneoff, [{ date, minutes }], { replace: !oneoff.split });
}

function removeOneoffSession(el) {
  const oneoff = findRoutineOneoff(oneoffOpenId);
  if (!oneoff) return;
  const before = oneoff.sessions;
  oneoff.sessions = oneoff.sessions.filter((s) => String(s.id) !== String(el.dataset.session) || s.doneAt);
  if (!saveRoutineDb({ silent: true })) {
    oneoff.sessions = before;
    return;
  }
  tobaToast("🗓️ Dia tirado");
  renderOneoffDetail();
  renderTaskPage();
}

// "Já terminei": marca o que falta como uma sessão feita hoje (vale o XP dela)
function finishOneoff(el) {
  const oneoff = findRoutineOneoff(oneoffOpenId);
  if (!oneoff || oneoff.doneAt) return;
  const today = toIsoDate();
  const st = routineOneoffStatus(oneoff, today);
  const before = JSON.stringify(oneoff);
  const left = Math.max(0, oneoff.minutes - st.doneMin);
  oneoff.sessions = oneoff.sessions.filter((s) => s.doneAt || s.date < today);
  if (left) oneoff.sessions.push({ id: newRoutineOneoffId("s"), date: today, minutes: left, doneAt: Date.now() });
  oneoff.doneAt = Date.now();
  if (!saveRoutineDb({ silent: true })) {
    Object.assign(oneoff, JSON.parse(before));
    return;
  }
  if (left) floatOneoffXp(el, `+${routineOneoffXp(left)} XP`);
  closeTobaModal("oneoffDetail");
  renderTaskPage();
  tobaPlayerCheck({ reason: `${oneoff.emoji} ${oneoff.name}: DONE! 🎉` });
}

// "Ainda não acabou": desmarca o último pedaço feito (o XP dele sai junto)
function reopenOneoff() {
  const oneoff = findRoutineOneoff(oneoffOpenId);
  if (!oneoff) return;
  const before = JSON.stringify(oneoff);
  delete oneoff.doneAt;
  const last = oneoff.sessions.filter((s) => s.doneAt).sort((a, b) => b.doneAt - a.doneAt)[0];
  if (last) {
    delete last.doneAt;
    if (last.date < toIsoDate()) last.date = toIsoDate(); // volta pra hoje, não pro dia que passou
  }
  if (!saveRoutineDb({ silent: true })) {
    Object.assign(oneoff, JSON.parse(before));
    return;
  }
  renderOneoffDetail();
  renderTaskPage();
  tobaPlayerCheck();
}

/* ---------------------------------------------------------------------
 * Sugestão do Toba
 * ------------------------------------------------------------------- */
function openSuggestion(oneoff) {
  const today = toIsoDate();
  const st = routineOneoffStatus(oneoff, today);
  // Tudo agendado = "remarcar": a conta ignora os dias futuros dela
  const replan = !st.toPlan && st.planned.length;
  const subject = replan ? { ...oneoff, sessions: oneoff.sessions.filter((s) => s.doneAt || s.date < today) } : oneoff;
  const result = suggestRoutineOneoff(routineDb, subject, { now: new Date() });
  oneoffSuggestion = { id: oneoff.id, result, replan };
  const body = document.getElementById("oneoffSuggestBody");
  const footer = document.getElementById("oneoffSuggestFooter");
  document.getElementById("oneoffSuggestTitle").textContent = `🔮 ${oneoff.emoji} ${oneoff.name}`;
  const fixedHint = routineDb.dayPlan.configured ? "" : `<button type="button" class="hint-box rt-notice-btn" data-click="openDayPlan">🕰️ Conta como é seu dia (sono, trampo, busão) que o chute fica certeiro.</button>`;

  if (result.mode === "whole") {
    const best = result.options[0];
    const headline = !best
      ? "Não achei nenhum dia até o prazo 😬"
      : result.fits
        ? `OLHA PAI, MELHOR ${describeOneoffDay(best.date, today) === "Hoje" ? "HOJE" : `${oneoffWeekday(best.date).toUpperCase()} ${oneoffDateLabel(best.date)}`}, TU TÁ COM ${routineFormatMinutes(best.free).toUpperCase()} LIVRE`
        : `Ixi, ${routineFormatMinutes(result.need)} de uma vez não cabe em nenhum dia dos próximos ${ROUTINE_PLAN_DAYS} 😬`;
    const why = best && result.fits
      ? [best.easyDay ? (best.load.weekend ? "é fim de semana" : "é dia de folga") : routineOneoffWhen(subject) === "weekday" ? "é dia de semana, como tu pediu" : "", best.tight ? "vai ficar justo, hein" : `ainda sobra ${routineFormatMinutes(best.free - result.need)}`].filter(Boolean).join(", ")
      : "Dá pra fatiar em pedaços ou escolher um dia na mão";
    body.innerHTML = `
      <div class="rt-oracle"><strong>${headline}</strong><span>${why ? `${why.charAt(0).toUpperCase()}${why.slice(1)}.` : ""}</span></div>
      ${fixedHint}
      <div class="section-title">${result.fits ? "Opções" : "Dias mais livres"}</div>
      <div class="rt-list">${result.options.map((opt, i) => renderSuggestOption(opt, i, today, result.need)).join("")}</div>`;
    footer.innerHTML = result.fits
      ? `<button type="button" class="btn btn-primary" data-click="pickSuggestion" data-index="0">📅 Agendar ${describeOneoffDay(best.date, today).toLowerCase() === "hoje" ? "hoje" : oneoffWeekday(best.date)}</button>`
      : `<button type="button" class="btn btn-primary" data-click="splitAndSuggest">🍕 Fatiar em pedaços</button>`;
  } else if (result.mode === "split") {
    const sessions = result.options;
    const last = sessions[sessions.length - 1];
    body.innerHTML = `
      <div class="rt-oracle"><strong>${sessions.length ? `BORA FATIAR: ${sessions.length} ${sessions.length === 1 ? "DIA" : "DIAS"}${last ? ` ATÉ ${oneoffWeekday(last.date).toUpperCase()} ${oneoffDateLabel(last.date)}` : ""}` : "Não sobrou espaço nem pra um pedaço 😵"}</strong>
        <span>${result.fits ? "Pedaço pequeno em dia de trampo, pedaço grande na folga." : `Faltou encaixar ${routineFormatMinutes(result.missing)}. Aumenta o prazo, o pedaço ou alivia o dia fixo.`}</span></div>
      ${fixedHint}
      <div class="rt-list">${sessions.map((s) => `
        <div class="rt-task is-list">
          <span class="rt-task-emoji is-big">${s.easyDay ? "🛋️" : "💼"}</span>
          <div class="rt-task-body">
            <span class="rt-task-name">${oneoffDayName(s.date, today)}</span>
            <span class="rt-task-meta">⏱️ ${routineFormatMinutes(s.minutes)} · livre ${routineFormatMinutes(s.free)} · +${routineOneoffXp(s.minutes)} XP</span>
          </div>
        </div>`).join("")}</div>`;
    footer.innerHTML = sessions.length ? `<button type="button" class="btn btn-primary" data-click="pickSplitPlan">📅 Agendar ${sessions.length === 1 ? "esse dia" : "tudo"}</button>` : "";
  } else {
    body.innerHTML = `<div class="rt-oracle"><strong>Já tá tudo agendado 👌</strong><span>Nada sobrando pra encaixar.</span></div>`;
    footer.innerHTML = "";
  }
  closeTobaModal("oneoffDetail");
  openTobaModal("oneoffSuggest");
}

function renderSuggestOption(opt, index, today, need) {
  const load = opt.load;
  const parts = [
    ...load.items.map((i) => `${i.emoji} ${routineFormatMinutes(i.minutes)}`),
    load.routine ? `🔁 ${routineFormatMinutes(load.routine)}` : "",
    load.oneoffs ? `🛠️ ${routineFormatMinutes(load.oneoffs)}` : "",
  ].filter(Boolean).join(" · ");
  const tag = !opt.fits ? `<span class="rt-tag is-red">não cabe</span>` : opt.tight ? `<span class="rt-tag is-gold">apertado</span>` : index === 0 ? `<span class="rt-tag is-green">melhor</span>` : "";
  return `
    <div class="rt-task is-list rt-suggest-opt">
      <span class="rt-task-emoji is-big">${opt.easyDay ? "🛋️" : "💼"}</span>
      <div class="rt-task-body">
        <span class="rt-task-name">${oneoffDayName(opt.date, today)} ${tag}</span>
        <span class="rt-task-meta">🆓 ${routineFormatMinutes(opt.free)} livre${opt.fits ? ` · sobra ${routineFormatMinutes(opt.free - need)}` : ""}</span>
        ${parts ? `<span class="rt-task-meta">${parts}</span>` : ""}
      </div>
      <button type="button" class="btn btn-sm ${index === 0 && opt.fits ? "btn-primary" : "btn-secondary"}" data-click="pickSuggestion" data-index="${index}">Esse</button>
    </div>`;
}

// replace: tira os dias futuros ainda não feitos antes de agendar (remarcar)
function scheduleOneoffSessions(oneoff, sessions, { replace }) {
  const today = toIsoDate();
  const before = oneoff.sessions;
  const kept = replace ? oneoff.sessions.filter((s) => s.doneAt || s.date < today) : [...oneoff.sessions];
  oneoff.sessions = [...kept, ...sessions.map((s) => ({ id: newRoutineOneoffId("s"), date: s.date, minutes: s.minutes }))];
  if (!saveRoutineDb()) {
    oneoff.sessions = before;
    return false;
  }
  closeTobaModal("oneoffSuggest");
  closeTobaModal("oneoffDetail");
  const first = sessions.map((s) => s.date).sort()[0];
  tobaToast(`📅 ${oneoff.emoji} agendada${sessions.length > 1 ? ` em ${sessions.length} dias` : ""} · ${describeOneoffDay(first, today)}`);
  renderTaskPage();
  return true;
}

function pickSuggestion(el) {
  const oneoff = oneoffSuggestion && findRoutineOneoff(oneoffSuggestion.id);
  const opt = oneoff && oneoffSuggestion.result.options[Number(el.dataset.index)];
  if (!opt) return;
  scheduleOneoffSessions(oneoff, [{ date: opt.date, minutes: opt.minutes }], { replace: oneoffSuggestion.replan });
}

function pickSplitPlan() {
  const oneoff = oneoffSuggestion && findRoutineOneoff(oneoffSuggestion.id);
  if (!oneoff) return;
  scheduleOneoffSessions(oneoff, oneoffSuggestion.result.options, { replace: oneoffSuggestion.replan });
}

function splitAndSuggest() {
  const oneoff = oneoffSuggestion && findRoutineOneoff(oneoffSuggestion.id);
  if (!oneoff) return;
  oneoff.split = true;
  if (!saveRoutineDb({ silent: true })) {
    oneoff.split = false;
    return;
  }
  openSuggestion(oneoff);
}

/* ---------------------------------------------------------------------
 * Início
 * ------------------------------------------------------------------- */
function onRoutinePlanChanged() {
  renderTaskPage();
  if (document.getElementById("oneoffDetail").classList.contains("active")) renderOneoffDetail();
}

function onRoutineDataSaved() {
  syncRoutineAlerts(routineDb);
}

function onRoutineDataReplaced() {
  syncRoutineAlerts(routineDb);
  renderTaskPage();
  tobaPlayerCheck({ silent: true });
}

tobaActions({
  newOneoff: () => openOneoffSheet(),
  openOneoff: (el) => openOneoff(el.dataset.id),
  openOneoffFromRow: (el) => openOneoff(el.dataset.id),
  editOneoffFromDetail: () => openOneoffSheet(findRoutineOneoff(oneoffOpenId)),
  suggestFromDetail: () => {
    const oneoff = findRoutineOneoff(oneoffOpenId);
    if (oneoff) openSuggestion(oneoff);
  },
  suggestOneoff: (el) => {
    const oneoff = findRoutineOneoff(el.dataset.id);
    if (oneoff) openSuggestion(oneoff);
  },
  saveOneoff,
  deleteOneoff,
  guessOneoff,
  updateOneoffForm,
  touchOneoffTime: () => {
    oneoffTimeTouched = true;
    document.getElementById("oneoffGuess").textContent = "";
  },
  pickOneoffEmoji: (el) => {
    document.getElementById("oneoffEmoji").value = el.dataset.emoji;
  },
  addManualSession,
  removeOneoffSession,
  finishOneoff,
  reopenOneoff,
  pickSuggestion,
  pickSplitPlan,
  splitAndSuggest,
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderTaskPage();
});
document.addEventListener("toba:player", () => renderTaskPage());

renderTaskPage();
tobaPlayerCheck();
// Veio da Rotina: ?open=<id da task>
(() => {
  const params = new URLSearchParams(location.search);
  if (params.has("open")) {
    history.replaceState(null, "", location.pathname);
    openOneoff(params.get("open"));
  }
})();
