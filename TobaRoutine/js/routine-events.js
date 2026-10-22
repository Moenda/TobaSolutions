/* =====================================================================
 * Toba Routine · folha de evento do Calendar (desde v1.49)
 * Criar / editar / apagar um evento (cirurgia, churrasco, viagem...).
 * Usado pelo Calendar e pela Agenda, depois do routine-core.js. Quem grava
 * é o saveRoutineDb() do core; formato em routine-core.js (events).
 * Cada página pode definir onRoutineEventsChanged() para redesenhar.
 * ===================================================================== */
const ROUTINE_EVENT_EMOJI_PICKS = ["🏥", "🩺", "🦷", "🍖", "🎂", "🎉", "🍻", "✈️", "💍", "💘", "💼", "🎸", "⚽", "🐱", "📝", "📦"];

let routineEventEmojiTouched = false; // escolheu o emoji: o chute pelo nome para de trocar
let routineEventBusyTouched = false;

const ROUTINE_EVENT_HTML = `
<div class="toba-modal" id="eventSheet" role="dialog" aria-modal="true" aria-labelledby="eventSheetTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="eventSheetTitle">📅 Novo evento</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <form data-submit="saveRoutineEvent">
      <input type="hidden" id="eventId" />
      <div class="rt-name-row">
        <div class="form-group rt-emoji-group">
          <label for="eventEmoji">Emoji</label>
          <input type="text" id="eventEmoji" class="form-control rt-emoji-input" maxlength="8" autocomplete="off" data-input="touchEventEmoji" />
        </div>
        <div class="form-group rt-name-group">
          <label for="eventName">Evento</label>
          <input type="text" id="eventName" class="form-control" maxlength="60" placeholder="Ex: Churrasco do Maracujeba" autocomplete="off" data-input="guessRoutineEvent" />
        </div>
      </div>
      <div class="rt-emoji-picks" id="eventEmojiPicks"></div>

      <div class="form-group">
        <label for="eventDate">📆 Dia</label>
        <input type="date" id="eventDate" class="form-control" data-change="updateEventForm" />
      </div>
      <label class="check-row"><span>🌞 Dia inteiro (sem hora)</span><input type="checkbox" id="eventAllDay" data-change="updateEventForm" /></label>

      <div id="eventTimeGroup" class="rt-event-group">
        <div class="rt-time-row">
          <div class="form-group"><label for="eventTime">Começa</label><input type="time" id="eventTime" class="form-control" data-change="eventStartChanged" /></div>
          <div class="form-group"><label for="eventEnd">Termina</label><input type="time" id="eventEnd" class="form-control" data-change="updateEventForm" /></div>
        </div>
        <span class="rt-help" id="eventTimeHelp"></span>
      </div>

      <div id="eventAllDayGroup" class="rt-event-group">
        <div class="form-group">
          <label for="eventEndDate">Até (se durar mais de um dia)</label>
          <input type="date" id="eventEndDate" class="form-control" data-change="updateEventForm" />
        </div>
        <label class="check-row"><span>🚫 Dia tomado (o Toba não põe task)</span><input type="checkbox" id="eventBusy" data-change="touchEventBusy" /></label>
      </div>

      <label class="check-row"><span id="eventRemindLabel">🔔 Avisar</span><input type="checkbox" id="eventRemind" /></label>

      <div class="form-group">
        <label for="eventNote">📝 Observação (opcional)</label>
        <textarea id="eventNote" class="form-control" rows="2" maxlength="300" placeholder="Ex: jejum de 8 h, levar os exames"></textarea>
      </div>

      <div class="toba-sheet-footer">
        <div class="btn-row">
          <button type="button" class="btn btn-danger btn-grow-1" id="deleteEventBtn" data-click="deleteRoutineEvent" hidden>🗑️ Apagar</button>
          <button type="submit" class="btn btn-primary btn-grow-2">Salvar</button>
        </div>
      </div>
    </form>
  </div>
</div>`;

function ensureEventSheet() {
  if (document.getElementById("eventSheet")) return;
  document.body.insertAdjacentHTML("beforeend", ROUTINE_EVENT_HTML);
}

function findRoutineEvent(id) {
  return (routineDb.events || []).find((e) => String(e.id) === String(id)) || null;
}

function newRoutineEventId() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// date = dia já escolhido (tocou num dia do calendário / da agenda)
function openEventSheet(event = null, date = "") {
  ensureEventSheet();
  const allDay = event ? routineEventIsAllDay(event) : false;
  document.getElementById("eventSheetTitle").textContent = event ? "✏️ Editar evento" : "📅 Novo evento";
  document.getElementById("eventId").value = event ? event.id : "";
  document.getElementById("eventName").value = event ? event.name : "";
  document.getElementById("eventEmoji").value = event ? event.emoji : "📅";
  document.getElementById("eventEmojiPicks").innerHTML = ROUTINE_EVENT_EMOJI_PICKS
    .map((emoji) => `<button type="button" class="rt-emoji-pick" data-click="pickEventEmoji" data-emoji="${emoji}">${emoji}</button>`).join("");
  document.getElementById("eventDate").value = event ? event.date : routineIsIso(date) ? date : toIsoDate();
  document.getElementById("eventAllDay").checked = allDay;
  document.getElementById("eventTime").value = event && !allDay ? event.time : "12:00";
  document.getElementById("eventEnd").value = event && !allDay ? event.end || routineAddMinutesToTime(event.time, ROUTINE_EVENT_DEFAULT_MINUTES) : "13:00";
  document.getElementById("eventTime").dataset.last = document.getElementById("eventTime").value;
  document.getElementById("eventEndDate").value = event && event.endDate ? event.endDate : "";
  document.getElementById("eventBusy").checked = Boolean(event && event.busy);
  document.getElementById("eventRemind").checked = event ? event.remind !== false : true;
  document.getElementById("eventNote").value = event ? event.note || "" : "";
  document.getElementById("deleteEventBtn").hidden = !event;
  routineEventEmojiTouched = Boolean(event);
  routineEventBusyTouched = Boolean(event);
  updateEventForm();
  openTobaModal("eventSheet");
}

// "23:30" + 60 -> "00:30"
function routineAddMinutesToTime(hhmm, minutes) {
  const start = routineTimeToMin(hhmm);
  if (start === null) return "";
  const total = (start + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function updateEventForm() {
  const allDay = document.getElementById("eventAllDay").checked;
  document.getElementById("eventTimeGroup").hidden = allDay;
  document.getElementById("eventAllDayGroup").hidden = !allDay;
  document.getElementById("eventEndDate").min = document.getElementById("eventDate").value || "";
  document.getElementById("eventRemindLabel").textContent = allDay
    ? "🔔 Avisar (véspera 20h + no dia 8h)"
    : "🔔 Avisar (véspera 20h + 1h antes)";
  const start = routineTimeToMin(document.getElementById("eventTime").value);
  const end = routineTimeToMin(document.getElementById("eventEnd").value);
  let help = "";
  if (!allDay && start !== null && end !== null && end !== start) {
    help = `⏱️ ${routineFormatMinutes(routineSpan(document.getElementById("eventTime").value, document.getElementById("eventEnd").value))}`;
    if (end < start) help += " · termina no dia seguinte 🌙";
  }
  document.getElementById("eventTimeHelp").textContent = help;
}

// Mudou o começo: o fim anda junto (mantém a duração de antes, ou 1 h)
function eventStartChanged() {
  const startInput = document.getElementById("eventTime");
  const endInput = document.getElementById("eventEnd");
  const prev = startInput.dataset.last || "";
  const keep = routineTimeToMin(prev) !== null && routineTimeToMin(endInput.value) !== null && endInput.value !== prev;
  const span = keep ? routineSpan(prev, endInput.value) : ROUTINE_EVENT_DEFAULT_MINUTES;
  if (routineTimeToMin(startInput.value) !== null) endInput.value = routineAddMinutesToTime(startInput.value, span);
  startInput.dataset.last = startInput.value;
  updateEventForm();
}

function pickEventEmoji(el) {
  document.getElementById("eventEmoji").value = el.dataset.emoji;
  routineEventEmojiTouched = true;
}

function touchEventEmoji() {
  routineEventEmojiTouched = true;
}

function touchEventBusy() {
  routineEventBusyTouched = true;
}

// Chute pelo nome: emoji e, pra cirurgia/viagem/mudança, dia inteiro tomado
function guessRoutineEvent() {
  const guess = routineGuessEvent(document.getElementById("eventName").value);
  if (!guess) return;
  if (!routineEventEmojiTouched) document.getElementById("eventEmoji").value = guess.emoji;
  if (!routineEventBusyTouched) document.getElementById("eventBusy").checked = Boolean(guess.busy);
}

function readEventForm() {
  const allDay = document.getElementById("eventAllDay").checked;
  const date = document.getElementById("eventDate").value;
  const time = allDay ? "" : document.getElementById("eventTime").value;
  let end = allDay ? "" : document.getElementById("eventEnd").value;
  if (end === time) end = "";
  const endDate = allDay ? document.getElementById("eventEndDate").value : "";
  return {
    name: document.getElementById("eventName").value.trim(),
    emoji: document.getElementById("eventEmoji").value.trim() || "📅",
    date,
    time,
    end: routineTimeToMin(end) === null ? "" : end,
    endDate: routineIsIso(endDate) && endDate > date ? endDate : "",
    busy: allDay && document.getElementById("eventBusy").checked,
    remind: document.getElementById("eventRemind").checked,
    note: document.getElementById("eventNote").value.trim().slice(0, 300),
  };
}

function saveRoutineEvent() {
  const data = readEventForm();
  if (!data.name) {
    showPageMessage("Dá um nome pro evento, chefia. Cirurgia? Churras? 🍖", { title: "Faltou o nome", icon: "✍️" });
    return;
  }
  if (!routineIsIso(data.date)) {
    showPageMessage("Escolhe o dia do evento.", { title: "Faltou o dia", icon: "📆" });
    return;
  }
  if (!document.getElementById("eventAllDay").checked && routineTimeToMin(data.time) === null) {
    showPageMessage("Coloca a hora que começa (ou marca 🌞 Dia inteiro).", { title: "Faltou a hora", icon: "🕐" });
    return;
  }
  const existing = findRoutineEvent(document.getElementById("eventId").value);
  if (existing) {
    const before = JSON.stringify(existing);
    Object.assign(existing, data);
    if (!saveRoutineDb()) {
      Object.keys(existing).forEach((key) => delete existing[key]);
      Object.assign(existing, JSON.parse(before));
      return;
    }
  } else {
    const event = { id: newRoutineEventId(), ...data, createdAt: toIsoDate() };
    routineDb.events.push(event);
    if (!saveRoutineDb()) {
      routineDb.events = routineDb.events.filter((e) => e !== event);
      return;
    }
  }
  closeTobaModal("eventSheet");
  routineEventsChanged(data.date);
}

async function deleteRoutineEvent() {
  const event = findRoutineEvent(document.getElementById("eventId").value);
  if (!event) return;
  const ok = await showPageMessage("Ele some do calendário, da agenda e dos avisos. Não dá pra desfazer.", { title: `Apagar "${event.name}"?`, icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  const index = routineDb.events.indexOf(event);
  routineDb.events = routineDb.events.filter((e) => e !== event);
  if (!saveRoutineDb()) {
    routineDb.events.splice(Math.max(0, index), 0, event);
    return;
  }
  closeTobaModal("eventSheet");
  routineEventsChanged(event.date);
}

function routineEventsChanged(date) {
  if (typeof onRoutineEventsChanged === "function") onRoutineEventsChanged(date);
}

tobaActions({
  newRoutineEvent: (el) => openEventSheet(null, el && el.dataset ? el.dataset.date : ""),
  openRoutineEvent: (el) => {
    const event = findRoutineEvent(el.dataset.id);
    if (event) openEventSheet(event);
  },
  saveRoutineEvent,
  deleteRoutineEvent,
  updateEventForm,
  eventStartChanged,
  pickEventEmoji,
  touchEventEmoji,
  touchEventBusy,
  guessRoutineEvent,
});
