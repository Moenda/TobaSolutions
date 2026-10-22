/* =====================================================================
 * Toba Routine · Agenda (desde v1.46)
 * Calendário estilo Outlook, 24 h, em Dia ou Semana: dormir/acordar, dia
 * fixo, rotinas com horário e, no topo, a faixa "sem horário" (rotina sem
 * hora e sessões de task). Abre tocando no "Seu tempo livre" do Hub.
 * Só leitura: quem grava é a ⚙️ (Meu dia fixo) e as telas Rotina/Task.
 * O que cai em cada hora sai de calcRoutineDayAgenda (routine-metrics.js).
 * URL: ?view=day|week&date=AAAA-MM-DD (o ‹ › e o Hoje atualizam a URL).
 * ===================================================================== */
const AGENDA_HOUR_PX = { day: 46, week: 24 };
const AGENDA_MIN_EVENT = { day: 22, week: 14 }; // altura mínima (px) pra dar pra ver
const AGENDA_MIN_GAP = 30; // brecha livre mostrada a partir de 30 min
const AGENDA_KIND_LABEL = { sleep: "Sono", work: "Trabalho", commute: "Transporte", custom: "Fixo", routine: "Rotina", oneoff: "Task" };

const agendaState = readAgendaUrl();
let agendaScrolled = false;
let agendaClockTimer = null;
let agendaTouch = null;

function readAgendaUrl() {
  const params = new URLSearchParams(location.search);
  const date = params.get("date");
  return {
    view: params.get("view") === "day" ? "day" : "week",
    date: routineIsIso(date) ? date : toIsoDate(),
  };
}

function writeAgendaUrl() {
  const url = `${location.pathname}?view=${agendaState.view}&date=${agendaState.date}`;
  try {
    history.replaceState(null, "", url);
  } catch (err) {
    // file:// ou navegador chato: só não lembra a posição
  }
}

function agendaMonday(iso) {
  const weekday = (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
  return routineAddDays(iso, -weekday);
}

// 420 -> "07h", 1410 -> "23h30"
function agendaClock(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = total % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function agendaDayName(iso) {
  return TOBA_WEEK_DAYS[(new Date(`${iso}T12:00:00`).getDay() + 6) % 7][1];
}

function agendaShortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/* ---------------------------------------------------------------------
 * Navegação
 * ------------------------------------------------------------------- */
function setAgendaView(el) {
  const view = el.dataset.view === "day" ? "day" : "week";
  if (view === agendaState.view) return;
  agendaState.view = view;
  agendaScrolled = false;
  renderAgenda();
}

function agendaStep(direction) {
  agendaState.date = routineAddDays(agendaState.date, direction * (agendaState.view === "day" ? 1 : 7));
  renderAgenda();
}

function agendaPrev() {
  agendaStep(-1);
}

function agendaNext() {
  agendaStep(1);
}

function agendaToday() {
  agendaState.date = toIsoDate();
  agendaScrolled = false;
  renderAgenda();
}

function openAgendaDay(el) {
  if (!routineIsIso(el.dataset.date)) return;
  agendaState.view = "day";
  agendaState.date = el.dataset.date;
  agendaScrolled = false;
  renderAgenda();
}

/* ---------------------------------------------------------------------
 * Desenho
 * ------------------------------------------------------------------- */
function renderAgenda() {
  writeAgendaUrl();
  const today = toIsoDate();
  const { view, date } = agendaState;
  const days = view === "day" ? [date] : TOBA_WEEK_DAYS.map((_, i) => routineAddDays(agendaMonday(date), i));
  const agendas = days.map((iso) => calcRoutineDayAgenda(routineDb, iso, today));

  document.querySelectorAll("#agendaTabs .tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  document.getElementById("agendaLabel").textContent = view === "day"
    ? `${agendaDayName(date)}, ${agendaShortDate(date)}${date === today ? " · hoje" : ""}`
    : `${agendaShortDate(days[0])} – ${agendaShortDate(days[6])}${days.includes(today) ? " · esta semana" : ""}`;
  document.getElementById("agendaTodayBtn").hidden = days.includes(today);

  document.getElementById("agendaSummary").innerHTML = view === "day" ? renderAgendaDaySummary(agendas[0], today) : renderAgendaLegend();
  document.getElementById("agendaUntimed").innerHTML = view === "day" ? renderAgendaUntimedList(agendas[0]) : "";
  document.getElementById("agendaNotice").innerHTML = routineDb.dayPlan.configured
    ? ""
    : `<button type="button" class="hint-box rt-notice-btn ag-notice" data-click="openDayPlan">⚠️ Seu dia fixo tá no chute (9h–18h, dorme 23h30). Toque e conta como é o seu dia.</button>`;
  document.getElementById("agendaGrid").innerHTML = renderAgendaGrid(agendas, view, today);

  if (!agendaScrolled) {
    agendaScrolled = true;
    scrollAgendaToStart(agendas, today);
  }
}

function renderAgendaDaySummary(agenda, today) {
  const chips = [];
  if (agenda.wakeAt !== null) chips.push(`⏰ Acorda ${agendaClock(agenda.wakeAt)}`);
  if (agenda.sleepAt !== null) chips.push(`😴 Dorme ${agendaClock(agenda.sleepAt)}`);
  if (agenda.date >= today) {
    const load = calcRoutineDayLoad(routineDb, agenda.date, { now: new Date() });
    chips.push(`🆓 Livre ${routineFormatMinutes(load.free)}`);
  }
  const all = [...agenda.timed, ...agenda.untimed].filter((i) => i.kind === "routine" || i.kind === "oneoff");
  if (all.length) chips.push(`✅ ${all.filter((i) => i.done).length}/${all.length} feitas`);
  return `<div class="ag-chips">${chips.map((c) => `<span class="ag-chip">${c}</span>`).join("")}</div>`;
}

function renderAgendaLegend() {
  return `<div class="ag-legend">
    <span><i class="ag-dot is-sleep"></i>Sono</span>
    <span><i class="ag-dot is-work"></i>Trampo</span>
    <span><i class="ag-dot is-custom"></i>Fixo</span>
    <span><i class="ag-dot is-routine"></i>Rotina</span>
    <span><i class="ag-dot is-free"></i>Livre</span>
  </div>`;
}

function renderAgendaUntimedList(agenda) {
  if (!agenda.untimed.length) return "";
  const rows = agenda.untimed.map((item) => {
    const status = item.done ? "✅" : item.skipped ? "🗑️" : item.missed ? "🙈" : "";
    const what = item.kind === "oneoff" ? "Task" : item.kind === "commute" ? "Transporte" : "Rotina";
    return `<div class="ag-untimed-item is-${item.kind}${item.done ? " is-done" : ""}${item.missed ? " is-missed" : ""}">
      <span class="ag-untimed-emoji">${escapeHtml(item.emoji)}</span>
      <span class="ag-untimed-name">${escapeHtml(item.name)}</span>
      <span class="ag-untimed-meta">${what} · ${item.minutes ? routineFormatMinutes(item.minutes) : "0 min"} ${status}</span>
    </div>`;
  }).join("");
  return `<div class="card ag-untimed">
    <div class="ag-untimed-title">📌 Sem horário <span class="rt-help">entra onde der no dia</span></div>
    ${rows}
  </div>`;
}

function renderAgendaGrid(agendas, view, today) {
  const hour = AGENDA_HOUR_PX[view];
  const week = view === "week";
  const head = week
    ? `<div class="ag-head">
        <span class="ag-gutter-cell"></span>
        ${agendas.map((a) => `<button type="button" class="ag-day-head${a.date === today ? " is-today" : ""}${a.date < today ? " is-past" : ""}" data-click="openAgendaDay" data-date="${a.date}">
            <span>${agendaDayName(a.date)}</span><strong>${a.date.slice(8)}</strong>
          </button>`).join("")}
      </div>
      <div class="ag-allday">
        <span class="ag-gutter-cell ag-allday-label">sem<br>hora</span>
        ${agendas.map((a) => renderAgendaWeekUntimed(a)).join("")}
      </div>`
    : "";
  const gutter = Array.from({ length: 23 }, (_, i) => `<span class="ag-hour" style="top:${(i + 1) * hour}px">${String(i + 1).padStart(2, "0")}h</span>`).join("");
  const cols = agendas.map((a) => renderAgendaColumn(a, view, today)).join("");
  return `<div class="ag-grid is-${view}" style="--hour:${hour}px;--cols:${agendas.length}">
    ${head}
    <div class="ag-body">
      <div class="ag-gutter">${gutter}</div>
      ${cols}
    </div>
  </div>`;
}

function renderAgendaWeekUntimed(agenda) {
  const items = agenda.untimed;
  if (!items.length) return `<button type="button" class="ag-allday-cell" data-click="openAgendaDay" data-date="${agenda.date}" aria-label="Abrir o dia"></button>`;
  const shown = items.slice(0, 3).map((i) => `<span class="${i.done ? "is-done" : ""}">${escapeHtml(i.emoji)}</span>`).join("");
  const more = items.length > 3 ? `<em>+${items.length - 3}</em>` : "";
  return `<button type="button" class="ag-allday-cell has-items" data-click="openAgendaDay" data-date="${agenda.date}" aria-label="${items.length} sem horário">${shown}${more}</button>`;
}

function agendaPx(minutes, view) {
  return (minutes / 60) * AGENDA_HOUR_PX[view];
}

function renderAgendaColumn(agenda, view, today) {
  const week = view === "week";
  const isToday = agenda.date === today;
  const nowDate = new Date();
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const parts = [];

  // Brechas livres (fora do dia fixo e das rotinas com horário)
  if (agenda.date >= today) {
    agendaFreeGaps(agenda, isToday ? nowMin : 0).forEach(([start, end]) => {
      const label = !week && end - start >= 45 ? `<span>🆓 brecha de ${routineFormatMinutes(end - start)}</span>` : "";
      parts.push(`<div class="ag-gap" style="top:${agendaPx(start, view)}px;height:${agendaPx(end - start, view)}px">${label}</div>`);
    });
  }

  // Dia fixo (faixas de fundo)
  agenda.blocks.forEach((block) => {
    const height = agendaPx(block.end - block.start, view);
    let label = "";
    if (!week) {
      let text = `${escapeHtml(block.emoji)} ${escapeHtml(block.name)}`;
      if (block.kind === "commute") text += ` (${block.leg})`;
      if (block.kind === "sleep") text = block.fromYesterday ? `😴 Sono · ⏰ acorda ${agendaClock(block.end)}` : `😴 Dorme ${agendaClock(block.start)}`;
      else text += ` · ${agendaClock(block.start)}–${agendaClock(block.end)}`;
      label = height >= 16 ? `<span class="ag-band-label">${text}</span>` : "";
    } else if (height >= 18) {
      label = `<span class="ag-band-label">${escapeHtml(block.emoji)}</span>`;
    }
    const edge = block.kind === "sleep" && block.fromYesterday ? " is-wake" : "";
    parts.push(`<div class="ag-band is-${block.kind}${edge}" style="top:${agendaPx(block.start, view)}px;height:${height}px" title="${escapeHtml(block.name)}">${label}</div>`);
  });

  // Rotinas com horário (por cima, lado a lado quando batem)
  agendaLayoutEvents(agenda.timed, view).forEach(({ item, col, cols, top, height }) => {
    const overBand = !week && agenda.blocks.some((b) => b.kind !== "commute" && b.start < Math.max(item.end, item.start + 1) && b.end > item.start);
    const left = overBand ? 36 : 0;
    const width = (100 - left) / cols;
    const status = item.done ? " ✅" : item.skipped ? " 🗑️" : item.missed ? " 🙈" : "";
    const zero = item.minutes === 0;
    const short = height < 34; // não cabem duas linhas: hora vai do lado do nome
    const when = `${agendaClock(item.start)}${zero ? "" : ` · ${routineFormatMinutes(item.minutes)}`}`;
    let text = escapeHtml(item.emoji);
    if (!week) {
      text = short
        ? `<strong>${escapeHtml(item.emoji)} ${escapeHtml(item.name)}${status} <span>${agendaClock(item.start)}</span></strong>`
        : `<strong>${escapeHtml(item.emoji)} ${escapeHtml(item.name)}${status}</strong><span>${when}</span>`;
    }
    parts.push(`<div class="ag-event is-${item.kind}${item.done ? " is-done" : ""}${item.missed ? " is-missed" : ""}${zero ? " is-zero" : ""}${short ? " is-short" : ""}"
      style="top:${top}px;height:${height}px;left:calc(${left + col * width}% + 2px);width:calc(${width}% - 4px)" title="${escapeHtml(item.name)} · ${agendaClock(item.start)}">${text}</div>`);
  });

  if (isToday) parts.push(`<div class="ag-now" style="top:${agendaPx(nowMin, view)}px"></div>`);

  const tag = week ? "button" : "div";
  const attrs = week ? ` type="button" data-click="openAgendaDay" data-date="${agenda.date}" aria-label="Abrir ${agendaDayName(agenda.date)}"` : "";
  return `<${tag} class="ag-col${isToday ? " is-today" : ""}${agenda.date < today ? " is-past" : ""}"${attrs}>${parts.join("")}</${tag}>`;
}

// Intervalos [início, fim] sem nada do dia fixo nem rotina com horário
function agendaFreeGaps(agenda, from) {
  const busy = [...agenda.blocks, ...agenda.timed].map((i) => [i.start, Math.max(i.end, i.start)]).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cursor = from;
  busy.forEach(([start, end]) => {
    if (start - cursor >= AGENDA_MIN_GAP) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  });
  if (1440 - cursor >= AGENDA_MIN_GAP) gaps.push([cursor, 1440]);
  return gaps;
}

// Lado a lado quando dois eventos se encostam (com a altura mínima contando)
function agendaLayoutEvents(items, view) {
  const minPx = AGENDA_MIN_EVENT[view];
  const placed = items.map((item) => {
    const top = agendaPx(item.start, view);
    const height = Math.max(minPx, agendaPx(item.end - item.start, view));
    return { item, top, height, bottom: top + height, col: 0, cols: 1 };
  });
  let group = [];
  let groupEnd = -1;
  const closeGroup = () => {
    const cols = group.reduce((max, p) => Math.max(max, p.col + 1), 1);
    group.forEach((p) => {
      p.cols = cols;
    });
    group = [];
  };
  placed.forEach((p) => {
    if (group.length && p.top >= groupEnd) closeGroup();
    const used = group.filter((g) => g.bottom > p.top).map((g) => g.col);
    let col = 0;
    while (used.includes(col)) col += 1;
    p.col = col;
    group.push(p);
    groupEnd = Math.max(groupEnd, p.bottom);
  });
  if (group.length) closeGroup();
  return placed;
}

// Abre já na hora que interessa: agora (hoje) ou a hora de acordar
function scrollAgendaToStart(agendas, today) {
  const grid = document.querySelector(".ag-body");
  if (!grid) return;
  const now = new Date();
  const todayAgenda = agendas.find((a) => a.date === today);
  let minute;
  if (todayAgenda) minute = now.getHours() * 60 + now.getMinutes() - 90;
  else {
    const wakes = agendas.map((a) => a.wakeAt).filter((w) => w !== null);
    minute = (wakes.length ? Math.min(...wakes) : 7 * 60) - 30;
  }
  const offset = agendaPx(Math.max(0, minute), agendaState.view);
  const top = grid.getBoundingClientRect().top + window.scrollY + offset - 70;
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}

/* ---------------------------------------------------------------------
 * Arrastar pro lado troca de dia/semana
 * ------------------------------------------------------------------- */
function bindAgendaSwipe() {
  const grid = document.getElementById("agendaGrid");
  grid.addEventListener("touchstart", (event) => {
    const t = event.touches[0];
    agendaTouch = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  grid.addEventListener("touchend", (event) => {
    const t = event.changedTouches[0];
    if (!agendaTouch || !t) return;
    const dx = t.clientX - agendaTouch.x;
    const dy = t.clientY - agendaTouch.y;
    agendaTouch = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    agendaStep(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function startAgendaClock() {
  clearInterval(agendaClockTimer);
  agendaClockTimer = setInterval(() => {
    if (document.visibilityState === "visible") renderAgenda();
  }, 60 * 1000);
}

function onRoutinePlanChanged() {
  renderAgenda();
}

function onRoutineDataReplaced() {
  renderAgenda();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderAgenda();
});

tobaActions({
  setAgendaView,
  agendaPrev,
  agendaNext,
  agendaToday,
  openAgendaDay,
});

bindAgendaSwipe();
renderAgenda();
startAgendaClock();
