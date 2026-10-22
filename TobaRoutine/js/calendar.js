/* =====================================================================
 * Toba Routine · módulo Calendar (desde v1.49)
 * Eventos com dia marcado: cirurgia dia 04/11, churrasco no sábado,
 * viagem de 3 dias. Não é rotina (não repete) nem task (não precisa
 * achar dia). Mês em grade + "Próximos" + "Já foi". Criar/editar é na
 * folha de routine-events.js (a mesma da Agenda).
 * Os eventos também aparecem na Agenda, descontam do tempo livre e o
 * "dia tomado" não recebe task (regras em routine-metrics.js).
 * Banco: TOBA_ROUTINE_DB.events (formato no topo do routine-core.js).
 * URL: ?date=AAAA-MM-DD abre com esse dia escolhido.
 * ===================================================================== */
const CALENDAR_PAST_MAX = 30; // "Já foi" mostra no máximo 30

const calendarState = (() => {
  const date = new URLSearchParams(location.search).get("date");
  const selected = routineIsIso(date) ? date : toIsoDate();
  return { month: selected.slice(0, 7), selected };
})();

function calendarShortDate(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function calendarWeekday(iso) {
  return TOBA_WEEK_DAYS[(new Date(`${iso}T12:00:00`).getDay() + 6) % 7][1];
}

function calendarMonthLabel(month) {
  const label = new Date(`${month}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function calendarAddMonths(month, delta) {
  const date = new Date(`${month}-15T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  return toIsoDate(date).slice(0, 7);
}

// "Ter 04/11 · 07h–09h"
function calendarEventMeta(event, today) {
  const parts = [`${calendarWeekday(event.date)} ${calendarShortDate(event.date)}`, routineEventWhen(event)];
  const countdown = routineEventCountdown(event, today);
  if (event.date >= today || routineEventLastDay(event) >= today) parts.push(countdown);
  if (event.busy) parts.push("🚫 dia tomado");
  if (event.remind === false) parts.push("🔕");
  return parts.join(" · ");
}

function renderCalendarEventRow(event, today, options = {}) {
  const past = routineEventLastDay(event) < today;
  const soon = !past && routineDayDiff(today, event.date) <= 1;
  return `
    <div class="rt-task is-list cal-event${past ? " is-done" : ""}${soon ? " is-soon" : ""}${event.busy ? " is-busy" : ""}" role="button" tabindex="0" data-click="openRoutineEvent" data-id="${escapeHtml(event.id)}">
      <span class="rt-task-emoji is-big">${escapeHtml(event.emoji)}</span>
      <div class="rt-task-body">
        <span class="rt-task-name">${escapeHtml(event.name)}</span>
        <span class="rt-task-meta">${options.short ? escapeHtml(routineEventWhen(event)) : calendarEventMeta(event, today)}</span>
        ${event.note ? `<span class="rt-task-meta cal-note">📝 ${escapeHtml(event.note)}</span>` : ""}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderCalendar() {
  const now = new Date();
  const today = toIsoDate(now);
  const all = routineEventsOf(routineDb);
  const upcoming = routineUpcomingEvents(routineDb, now);
  const thisMonth = all.filter((e) => e.date.startsWith(today.slice(0, 7))).length;
  const in30 = routineAddDays(today, 30);
  const busySoon = new Set();
  upcoming.filter((e) => e.busy).forEach((e) => {
    for (let d = e.date < today ? today : e.date; d <= routineEventLastDay(e) && d <= in30; d = routineAddDays(d, 1)) busySoon.add(d);
  });

  const next = upcoming[0];
  let line = "Agenda limpa. Bora marcar um churras? 🍖";
  if (next) {
    const countdown = routineEventCountdown(next, today);
    line = countdown === "hoje" || countdown === "rolando agora"
      ? `Hoje tem ${escapeHtml(next.emoji)} ${escapeHtml(next.name)}! Nunca foi sorte 🙏`
      : `Próximo: ${escapeHtml(next.emoji)} ${escapeHtml(next.name)} ${countdown} (${calendarShortDate(next.date)})`;
  }
  const nextDays = next ? Math.max(0, routineDayDiff(today, next.date)) : null;
  document.getElementById("calHero").innerHTML = `
    <strong class="rt-hero-line">${line}</strong>
    <div class="toba-stats is-3">
      <div class="toba-stat is-center"><span class="toba-stat-label">⏳ Falta</span><span class="toba-stat-value">${nextDays === null ? "—" : nextDays === 0 ? "Hoje" : `${nextDays} d`}</span></div>
      <div class="toba-stat is-center"><span class="toba-stat-label">🔜 Fila</span><span class="toba-stat-value">${upcoming.length}</span></div>
      <div class="toba-stat is-center"><span class="toba-stat-label">🚫 Dias</span><span class="toba-stat-value">${busySoon.size}</span></div>
    </div>
    <span class="rt-help">⏳ até o próximo · 🔜 eventos que vêm aí · 🚫 dias tomados nos próximos 30 (o Toba não marca task).</span>`;

  renderCalendarMonth(today);
  renderCalendarDay(today);

  document.getElementById("calUpcoming").innerHTML = upcoming.length
    ? `<div class="section-title">🔜 Próximos</div><div class="rt-list">${upcoming.map((e) => renderCalendarEventRow(e, today)).join("")}</div>`
    : all.length ? "" : tobaEmpty("📅", "Nenhum evento ainda", "Toque em + Evento: a cirurgia do dia 04/11, o churrasco do fim de semana, a viagem...");

  const past = all.filter((e) => !upcoming.includes(e))
    .sort((a, b) => routineEventSortKey(b).localeCompare(routineEventSortKey(a)));
  document.getElementById("calPast").innerHTML = past.length
    ? `<details class="rt-more"><summary>📜 Já foi (${past.length})</summary><div class="rt-list">${past.slice(0, CALENDAR_PAST_MAX).map((e) => renderCalendarEventRow(e, today)).join("")}</div>
       ${past.length > CALENDAR_PAST_MAX ? `<p class="rt-help">Mostrando os ${CALENDAR_PAST_MAX} mais recentes.</p>` : ""}</details>`
    : "";
}

function renderCalendarMonth(today) {
  const { month, selected } = calendarState;
  document.getElementById("calMonthLabel").textContent = calendarMonthLabel(month);
  document.getElementById("calTodayBtn").hidden = month === today.slice(0, 7) && selected === today;

  const first = `${month}-01`;
  const start = routineAddDays(first, -((new Date(`${first}T12:00:00`).getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = routineAddDays(start, i);
    if (i >= 35 && day.slice(0, 7) !== month) break; // 5 semanas quando dá
    const slots = routineEventsOn(routineDb, day).filter((s) => !s.fromYesterday);
    const busy = slots.some((s) => s.allDay && s.event.busy);
    const emojis = slots.slice(0, 2).map((s) => `<span>${escapeHtml(s.event.emoji || "📅")}</span>`).join("");
    const more = slots.length > 2 ? `<em>+${slots.length - 2}</em>` : "";
    const classes = [
      "cal-day",
      day.slice(0, 7) !== month ? "is-out" : "",
      day === today ? "is-today" : "",
      day === selected ? "is-selected" : "",
      day < today ? "is-past" : "",
      busy ? "is-busy" : "",
      slots.length ? "has-events" : "",
    ].filter(Boolean).join(" ");
    cells.push(`<button type="button" class="${classes}" data-click="selectCalendarDay" data-date="${day}" aria-label="${calendarShortDate(day)}${slots.length ? `, ${slots.length} evento(s)` : ""}">
      <strong>${Number(day.slice(8))}</strong><span class="cal-day-emojis">${emojis}${more}</span>
    </button>`);
  }
  document.getElementById("calGrid").innerHTML = `
    <div class="cal-weekdays">${TOBA_WEEK_DAYS.map(([, label]) => `<span>${label}</span>`).join("")}</div>
    <div class="cal-days">${cells.join("")}</div>`;
}

function renderCalendarDay(today) {
  const day = calendarState.selected;
  const slots = routineEventsOn(routineDb, day).filter((s) => !s.fromYesterday);
  const title = day === today ? "Hoje" : day === routineAddDays(today, 1) ? "Amanhã" : `${calendarWeekday(day)} ${calendarShortDate(day)}`;
  const list = slots.length
    ? `<div class="rt-list">${slots.map((s) => renderCalendarEventRow(s.event, today, { short: true })).join("")}</div>`
    : `<p class="rt-help">Nada marcado. Dia livre pro que der na telha 😎</p>`;
  document.getElementById("calDay").innerHTML = `
    <div class="cal-day-head">
      <div class="section-title">📌 ${title}</div>
      <a class="cal-agenda-link" href="TobaRoutine-Agenda.html?view=day&date=${day}">Ver na agenda ›</a>
    </div>
    ${list}
    <button type="button" class="btn btn-secondary rt-wide-btn" data-click="newRoutineEvent" data-date="${day}">➕ Evento em ${calendarShortDate(day)}</button>`;
}

/* ---------------------------------------------------------------------
 * Navegação
 * ------------------------------------------------------------------- */
function selectCalendarDay(el) {
  if (!routineIsIso(el.dataset.date)) return;
  calendarState.selected = el.dataset.date;
  calendarState.month = el.dataset.date.slice(0, 7);
  writeCalendarUrl();
  renderCalendar();
}

function calendarMonthStep(delta) {
  calendarState.month = calendarAddMonths(calendarState.month, delta);
  const today = toIsoDate();
  // Escolhe o dia 1 (ou hoje, se voltou pro mês de hoje)
  calendarState.selected = calendarState.month === today.slice(0, 7) ? today : `${calendarState.month}-01`;
  writeCalendarUrl();
  renderCalendar();
}

function calendarToday() {
  calendarState.selected = toIsoDate();
  calendarState.month = calendarState.selected.slice(0, 7);
  writeCalendarUrl();
  renderCalendar();
}

function writeCalendarUrl() {
  try {
    history.replaceState(null, "", `${location.pathname}?date=${calendarState.selected}`);
  } catch (err) {
    // file:// ou navegador chato: só não lembra o dia
  }
}

function bindCalendarSwipe() {
  const grid = document.getElementById("calGrid");
  let touch = null;
  grid.addEventListener("touchstart", (event) => {
    const t = event.touches[0];
    touch = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  grid.addEventListener("touchend", (event) => {
    const t = event.changedTouches[0];
    if (!touch || !t) return;
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    calendarMonthStep(dx < 0 ? 1 : -1);
  }, { passive: true });
}

/* ---------------------------------------------------------------------
 * Ganchos
 * ------------------------------------------------------------------- */
function onRoutineEventsChanged(date) {
  if (routineIsIso(date)) {
    calendarState.selected = date;
    calendarState.month = date.slice(0, 7);
    writeCalendarUrl();
  }
  renderCalendar();
}

function onRoutineDataSaved() {
  syncRoutineAlerts(routineDb);
}

function onRoutineDataReplaced() {
  syncRoutineAlerts(routineDb);
  renderCalendar();
}

function onRoutinePlanChanged() {
  renderCalendar();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderCalendar();
});

tobaActions({
  selectCalendarDay,
  calendarPrev: () => calendarMonthStep(-1),
  calendarNext: () => calendarMonthStep(1),
  calendarToday,
});

bindCalendarSwipe();
renderCalendar();
syncRoutineAlerts(isRoutineDbLoaded ? routineDb : null);
