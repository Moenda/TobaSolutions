/* =====================================================================
 * Toba Racing · 🧭 Na estrada no hub (desde v2.02)
 * Os quadradinhos do Toba Drive no hub viram botões:
 *   🛣️ Km no mês  -> #driveKmSheet    histórico mês a mês (toca no mês = viagens dele)
 *   🧭 Viagens    -> #driveTripsSheet lista das corridas (filtros, Ir de novo, Apagar)
 *   🏁 Chegou     -> #driveTripsSheet já no filtro 🏁
 *   ⭐ Favoritos   -> #driveFavSheet   lista, ✏️ editar, 📍 aqui onde eu tô, 🔍 buscar (Toba Drive ?fav=1)
 * O banco é o TOBA_DRIVE_DB (dono: TobaDrive/js/drive-core.js). O hub não carrega o
 * drive-core (ele tem ⚙️ própria), então grava pouco e com cuidado (driveHubWrite):
 * lê na hora, banco ilegível = não grava, guarda o anterior no _AUTO_BACKUP e manda os ⭐ pro carro.
 * Viagem do Android Auto apagada vai pro autoSkip (o import do toba-common não traz de volta).
 * Abrir com #km / #trips / #favs abre a folha direto (o Toba Drive volta pra #favs depois do ➕).
 * ===================================================================== */
const DRIVE_HUB_KEY = "TOBA_DRIVE_DB";
const DRIVE_HUB_FAV_EMOJIS = ["🏠", "💼", "❤️", "☕", "🏋️", "🛒", "🍻", "🐾", "⭐"];
const DRIVE_HUB_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DRIVE_HUB_WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const driveHub = {
  filter: "all", // all | month | arrived | auto | YYYY-MM
  openTrip: "",
  favEdit: null, // { id?, name, emoji, lat, lng, address }
};

function driveHubRead() {
  try {
    const raw = localStorage.getItem(DRIVE_HUB_KEY);
    if (!raw) return { raw: null, db: { version: 1, favorites: [], recent: [], trips: [] } };
    const db = JSON.parse(raw);
    if (!db || typeof db !== "object" || Array.isArray(db)) return null;
    ["favorites", "recent", "trips"].forEach((k) => {
      if (!Array.isArray(db[k])) db[k] = [];
    });
    return { raw, db };
  } catch (err) {
    console.error("Erro ao ler os dados do Toba Drive", err);
    return null;
  }
}

// mutator(db) mexe no banco; false = não grava
function driveHubWrite(mutator) {
  const got = driveHubRead();
  if (!got) {
    showPageMessage("Os dados do Toba Drive estão ilegíveis, então nada foi gravado por cima. Restaura um backup na ⚙️ do Toba Drive.", { title: "Dados protegidos", icon: "🛡️" });
    return false;
  }
  if (mutator(got.db) === false) return false;
  try {
    if (got.raw) localStorage.setItem(`${DRIVE_HUB_KEY}_AUTO_BACKUP`, got.raw);
    localStorage.setItem(DRIVE_HUB_KEY, JSON.stringify(got.db));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (typeof tobaShareDriveFavs === "function") tobaShareDriveFavs(got.db);
  return true;
}

function driveHubTrips() {
  const got = driveHubRead();
  return (got ? got.db.trips : []).filter((t) => t && typeof t.date === "string");
}

function driveHubKmText(km) {
  return driveFormatKm((Number(km) || 0) * 1000);
}

function driveHubMonthLabel(key, long = false) {
  const [y, m] = key.split("-").map(Number);
  const name = DRIVE_HUB_MONTHS[m - 1] || "?";
  return long ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}` : `${name} ${String(y).slice(-2)}`;
}

function driveHubAddMonths(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function driveHubTripSecs(t) {
  const s = ((Number(t.endedAt) || 0) - (Number(t.startedAt) || 0)) / 1000;
  return s > 0 && s < 24 * 3600 ? s : 0;
}

function driveHubSum(list) {
  return {
    km: list.reduce((a, t) => a + (Number(t.km) || 0), 0),
    trips: list.length,
    arrived: list.filter((t) => t.arrived).length,
    secs: list.reduce((a, t) => a + driveHubTripSecs(t), 0),
  };
}

function driveHubTile(action, label, value, sub) {
  return `
    <button type="button" class="toba-stat rc-drive-tile" data-click="${action}">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub} <b class="rc-drive-more">›</b></span>
    </button>`;
}

/* ---------------------------------------------------------------------
 * 🛣️ Km mês a mês
 * ------------------------------------------------------------------- */
function renderDriveKmSheet() {
  const trips = driveHubTrips();
  const today = toIsoDate();
  const cur = today.slice(0, 7);
  const day = today.slice(8, 10);
  const prev = driveHubAddMonths(cur, -1);
  const byMonth = {};
  trips.forEach((t) => {
    const k = t.date.slice(0, 7);
    (byMonth[k] = byMonth[k] || []).push(t);
  });
  const sumOf = (k) => driveHubSum(byMonth[k] || []);
  const now = sumOf(cur);
  const last = sumOf(prev);
  const lastToDay = driveHubSum((byMonth[prev] || []).filter((t) => t.date.slice(8, 10) <= day));
  const diff = now.km - lastToDay.km;
  const keys = Object.keys(byMonth).sort();
  const first = keys[0] || cur;
  const months = [];
  for (let k = cur; k >= first && months.length < 36; k = driveHubAddMonths(k, -1)) months.push(k);
  const best = keys.reduce((b, k) => (sumOf(k).km > (b ? sumOf(b).km : 0) ? k : b), "");
  const fullMonths = keys.filter((k) => k < cur);
  const avg = fullMonths.length ? fullMonths.reduce((a, k) => a + sumOf(k).km, 0) / fullMonths.length : 0;
  const life = driveHubSum(trips);
  const max = Math.max(1, ...months.map((k) => sumOf(k).km));

  const vs = !lastToDay.km && !now.km
    ? "nada ainda"
    : diff >= 0
      ? `▲ ${driveHubKmText(diff)} km x ${DRIVE_HUB_MONTHS[Number(prev.slice(5)) - 1]} até dia ${Number(day)}`
      : `▼ ${driveHubKmText(-diff)} km x ${DRIVE_HUB_MONTHS[Number(prev.slice(5)) - 1]} até dia ${Number(day)}`;
  const tile = (label, value, sub, extra = "") => `
    <div class="toba-stat${extra}">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </div>`;
  const head = `<div class="toba-stats rc-drive-km-head">
    ${tile("📅 Este mês", `<span class="text-racing">${driveHubKmText(now.km)}</span> <small>km</small>`, `<span class="${diff >= 0 ? "text-green" : "text-red"}">${vs}</span>`)}
    ${tile("⏪ Mês passado", `${driveHubKmText(last.km)} <small>km</small>`, `${last.trips} ${last.trips === 1 ? "viagem" : "viagens"}`)}
    ${tile("📊 Média por mês", fullMonths.length ? `${driveHubKmText(avg)} <small>km</small>` : "--", fullMonths.length ? `em ${fullMonths.length} ${fullMonths.length === 1 ? "mês fechado" : "meses fechados"}` : "fecha o 1º mês")}
    ${tile("🏆 Melhor mês", best ? `${driveHubKmText(sumOf(best).km)} <small>km</small>` : "--", best ? driveHubMonthLabel(best, true) : "bora rodar")}
  </div>`;

  const rows = months.map((k) => {
    const s = sumOf(k);
    const pct = Math.round((s.km / max) * 100);
    const subParts = s.trips
      ? [`${s.trips} ${s.trips === 1 ? "viagem" : "viagens"}`, s.arrived ? `🏁 ${s.arrived}` : "", s.secs >= 60 ? `⏱️ ${driveFormatDuration(s.secs)} ao volante` : ""]
      : ["parado na garagem 💤"];
    return `
      <div class="toba-list-item rc-drive-month${k === cur ? " is-now" : ""}${k === best ? " is-best" : ""}" role="button" tabindex="0" data-click="openDriveMonth" data-month="${k}">
        <span class="rc-drive-month-text">
          <b>${driveHubMonthLabel(k, true)}${k === cur ? " <small>(agora)</small>" : ""}${k === best && s.km ? " 🏆" : ""}</b>
          <small>${subParts.filter(Boolean).join(" · ")}</small>
          <span class="rc-drive-bar"><i style="width:${pct}%"></i></span>
        </span>
        <span class="rc-drive-month-km">${driveHubKmText(s.km)}<small> km</small></span>
      </div>`;
  }).join("");

  document.getElementById("driveKmBody").innerHTML = trips.length
    ? `${head}<div class="section-title">🗓️ Mês a mês</div><div class="toba-list">${rows}</div>
       <p class="rc-hint">Na vida: <b>${driveHubKmText(life.km)} km</b> em ${life.trips} ${life.trips === 1 ? "viagem" : "viagens"}${life.secs >= 60 ? `, ${driveFormatDuration(life.secs)} ao volante` : ""}. Toca no mês pra ver as viagens dele.</p>`
    : tobaEmpty("🛣️", "Nenhum km ainda", "Abre o Toba Drive (ou o Toba no Android Auto 🚘) e partiu. O km aparece aqui mês a mês.", { compact: true });
}

function openDriveKm() {
  renderDriveKmSheet();
  openTobaModal("driveKmSheet");
}

function openDriveMonth(el) {
  driveHub.filter = el.dataset.month;
  closeTobaModal("driveKmSheet");
  openDriveTripsWith(driveHub.filter);
}

/* ---------------------------------------------------------------------
 * 🧭 Viagens
 * ------------------------------------------------------------------- */
function driveHubDayLabel(iso) {
  const today = toIsoDate();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === today) return "Hoje";
  if (iso === toIsoDate(y)) return "Ontem";
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  const label = `${DRIVE_HUB_WEEK[d.getDay()]}, ${dd} ${DRIVE_HUB_MONTHS[mm - 1]}`;
  return yy === new Date().getFullYear() ? label : `${label} ${yy}`;
}

function driveHubFilterTrips(trips) {
  const f = driveHub.filter;
  const cur = toIsoDate().slice(0, 7);
  if (f === "month") return trips.filter((t) => t.date.startsWith(cur));
  if (f === "arrived") return trips.filter((t) => t.arrived);
  if (f === "auto") return trips.filter((t) => t.source === "auto" || t.autoAt);
  if (/^\d{4}-\d{2}$/.test(f)) return trips.filter((t) => t.date.startsWith(f));
  return trips;
}

function renderDriveTripsSheet() {
  const all = driveHubTrips();
  const f = driveHub.filter;
  const chips = [
    ["all", "Todas"],
    ["month", "📅 Este mês"],
    ["arrived", "🏁 Chegou"],
    ["auto", "🚘 Do carro"],
  ];
  if (/^\d{4}-\d{2}$/.test(f)) chips.push([f, `🗓️ ${driveHubMonthLabel(f, true)}`]);
  document.getElementById("driveTripsFilter").innerHTML = chips.map(([id, label]) =>
    `<button type="button" class="chip-btn rc-pick${f === id ? " is-on" : ""}" data-click="pickDriveFilter" data-f="${id}">${escapeHtml(label)}</button>`).join("");

  const list = driveHubFilterTrips(all).sort((a, b) => (Number(b.startedAt) || 0) - (Number(a.startedAt) || 0));
  const s = driveHubSum(list);
  document.getElementById("driveTripsSub").textContent = list.length
    ? `${list.length} ${list.length === 1 ? "viagem" : "viagens"} · ${driveHubKmText(s.km)} km${s.secs >= 60 ? ` · ${driveFormatDuration(s.secs)}` : ""}`
    : "";

  let lastDay = "";
  const rows = list.map((t) => {
    const header = t.date !== lastDay ? `<div class="rc-drive-day">${escapeHtml(driveHubDayLabel(t.date))}</div>` : "";
    lastDay = t.date;
    const secs = driveHubTripSecs(t);
    const start = Number(t.startedAt) || 0;
    const end = Number(t.endedAt) || 0;
    const fromCar = t.source === "auto" ? "🚘 carro" : t.autoAt ? "📱🚘 celular + carro" : "📱 celular";
    const avg = secs >= 120 ? Math.round((Number(t.km) || 0) / (secs / 3600)) : 0;
    const sub = [
      start ? `${driveFormatClock(start)}${end > start ? ` → ${driveFormatClock(end)}` : ""}` : "",
      secs >= 60 ? driveFormatDuration(secs) : "",
      fromCar,
    ].filter(Boolean).join(" · ");
    const open = driveHub.openTrip === String(t.id);
    const canGo = Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lng)) && t.lat !== null && t.lng !== null;
    const more = open ? `
      <div class="rc-drive-trip-more">
        <div class="rc-drive-trip-facts">
          ${t.arrived ? "🏁 Chegou no destino" : "🛑 Encerrou antes de chegar"}${avg ? ` · média ${avg} km/h` : ""}${Number(t.maxKmh) ? ` · máx ${Math.round(Number(t.maxKmh))} km/h` : ""}${Number(t.radars) ? ` · 📸 ${Number(t.radars)} radares` : ""}
        </div>
        <div class="btn-row">
          ${canGo ? `<button type="button" class="btn btn-primary btn-sm btn-grow-2" data-click="goDriveTrip" data-id="${escapeHtml(String(t.id))}">🧭 Ir de novo</button>` : ""}
          <button type="button" class="btn btn-outline btn-sm btn-grow-1" data-click="deleteDriveTrip" data-id="${escapeHtml(String(t.id))}">🗑️ Apagar</button>
        </div>
      </div>` : "";
    return `${header}
      <div class="toba-list-item rc-drive-trip${open ? " is-open" : ""}" role="button" tabindex="0" data-click="toggleDriveTrip" data-id="${escapeHtml(String(t.id))}">
        <span class="rc-drive-trip-row">
          <span class="rc-drive-trip-icon">${t.arrived ? "🏁" : "🛑"}</span>
          <span class="rc-drive-trip-text"><b>${escapeHtml(t.name || "Destino")}</b><small>${sub}</small></span>
          <span class="rc-drive-trip-km">${driveHubKmText(t.km)}<small> km</small></span>
        </span>
        ${more}
      </div>`;
  }).join("");

  document.getElementById("driveTripsBody").innerHTML = list.length
    ? `<div class="toba-list rc-drive-trips">${rows}</div>`
    : all.length
      ? tobaEmpty("🔍", "Nada nesse filtro", "Troca o filtro aí em cima.", { compact: true })
      : tobaEmpty("🧭", "Nenhuma viagem ainda", "Toda rota do Toba Drive (no celular ou no Android Auto 🚘) aparece aqui.", { compact: true });
}

function openDriveTripsWith(filter) {
  driveHub.filter = filter;
  driveHub.openTrip = "";
  renderDriveTripsSheet();
  openTobaModal("driveTripsSheet");
}

function openDriveTrips() {
  openDriveTripsWith("all");
}

function openDriveArrived() {
  openDriveTripsWith("arrived");
}

function pickDriveFilter(el) {
  driveHub.filter = el.dataset.f;
  driveHub.openTrip = "";
  renderDriveTripsSheet();
}

function toggleDriveTrip(el, event) {
  if (event && event.target instanceof Element && event.target.closest(".rc-drive-trip-more")) return;
  const id = el.dataset.id;
  driveHub.openTrip = driveHub.openTrip === id ? "" : id;
  renderDriveTripsSheet();
}

function driveHubGo(p) {
  const qs = new URLSearchParams({ lat: String(p.lat), lng: String(p.lng), name: p.name || "Destino" });
  if (p.address) qs.set("address", p.address);
  window.location.href = `TobaDrive/TobaDrive.html?${qs.toString()}`;
}

function goDriveTrip(el) {
  const t = driveHubTrips().find((x) => String(x.id) === el.dataset.id);
  if (t) driveHubGo({ lat: t.lat, lng: t.lng, name: t.name });
}

async function deleteDriveTrip(el) {
  const id = el.dataset.id;
  const t = driveHubTrips().find((x) => String(x.id) === id);
  if (!t) return;
  const ok = await showPageMessage(`Apagar a viagem pra "${t.name || "Destino"}" (${driveHubKmText(t.km)} km)? Sai do km do mês e das contas.`, { title: "Apagar viagem?", icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  const done = driveHubWrite((db) => {
    const gone = db.trips.find((x) => x && String(x.id) === id);
    if (!gone) return false;
    db.trips = db.trips.filter((x) => x !== gone);
    // o carro também anotou essa viagem? não deixa o import trazer de volta
    const skip = Array.isArray(db.autoSkip) ? db.autoSkip : [];
    if (gone.autoAt) skip.push(Number(gone.autoAt));
    if (Array.isArray(gone.autoAts)) gone.autoAts.forEach((n) => skip.push(Number(n))); // v2.03: pedaços que grudaram
    if (typeof tobaReadAutoTrips === "function") {
      const a = Number(gone.startedAt) || 0;
      const b = Number(gone.endedAt) || a;
      tobaReadAutoTrips().forEach((c) => {
        const at = Number(c && c.at);
        const end = Number(c && c.end) || at;
        if (at && at <= b + TOBA_AUTO_TRIP_GAP_MS && end >= a - TOBA_AUTO_TRIP_GAP_MS) skip.push(at);
      });
    }
    db.autoSkip = [...new Set(skip.filter((n) => n > 0))].slice(-400);
    return true;
  });
  if (!done) return;
  driveHub.openTrip = "";
  tobaToast("🗑️ Viagem apagada");
  renderDriveTripsSheet();
  renderDriveHub();
}

/* ---------------------------------------------------------------------
 * ⭐ Favoritos
 * ------------------------------------------------------------------- */
function driveHubFavs() {
  const got = driveHubRead();
  return (got ? got.db.favorites : []).filter((f) => f && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng)));
}

function renderDriveFavSheet() {
  const favs = driveHubFavs();
  const trips = driveHubTrips();
  // quantas vezes foi pra cada favorito (destino a menos de 150 m)
  const visits = (f) => trips.filter((t) => t.lat !== null && t.lng !== null && Number.isFinite(Number(t.lat))
    && driveDist([Number(t.lat), Number(t.lng)], [Number(f.lat), Number(f.lng)]) < 150).length;
  document.getElementById("driveFavBody").innerHTML = favs.length
    ? `<div class="toba-list">${favs.map((f) => {
      const n = visits(f);
      const sub = [f.address || "", n ? `🧭 ${n}x` : ""].filter(Boolean).join(" · ");
      return `
        <div class="toba-list-item rc-drive-fav" role="button" tabindex="0" data-click="goDriveFav" data-id="${escapeHtml(String(f.id))}">
          <span class="rc-drive-fav-emoji">${escapeHtml(f.emoji || "⭐")}</span>
          <span class="rc-drive-trip-text"><b>${escapeHtml(f.name || "Favorito")}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span>
          <button type="button" class="chip-btn rc-drive-fav-edit" data-click="editDriveFav" data-id="${escapeHtml(String(f.id))}" aria-label="Editar ${escapeHtml(f.name || "favorito")}">✏️</button>
        </div>`;
    }).join("")}</div>
    <p class="rc-hint">Toca pra ir. Os ⭐ aparecem também no botão Favoritos do Android Auto 🚘.</p>`
    : tobaEmpty("⭐", "Nenhum favorito ainda", "Adiciona aí embaixo: 🏠 Casa, 💼 Trampo, ☕ a padoca...", { compact: true });
}

function openDriveFavs() {
  renderDriveFavSheet();
  openTobaModal("driveFavSheet");
}

function goDriveFav(el, event) {
  if (event && event.target instanceof Element && event.target.closest(".rc-drive-fav-edit")) return;
  const f = driveHubFavs().find((x) => String(x.id) === el.dataset.id);
  if (f) driveHubGo(f);
}

function renderDriveFavEdit() {
  const e = driveHub.favEdit;
  if (!e) return;
  document.getElementById("driveFavEditTitle").textContent = e.id ? "✏️ Editar favorito" : "⭐ Favorito novo";
  document.getElementById("driveFavEditWhere").textContent = e.address || `📍 ${Number(e.lat).toFixed(5)}, ${Number(e.lng).toFixed(5)}`;
  document.getElementById("driveFavDelete").hidden = !e.id;
  document.getElementById("driveFavEmojis").innerHTML = DRIVE_HUB_FAV_EMOJIS.map((em) =>
    `<button type="button" class="chip-btn rc-pick rc-emoji${em === e.emoji ? " is-on" : ""}" data-click="pickDriveFavEmoji" data-e="${em}">${em}</button>`).join("");
}

function openDriveFavEdit(data) {
  driveHub.favEdit = data;
  document.getElementById("driveFavName").value = data.name || "";
  renderDriveFavEdit();
  openTobaModal("driveFavEdit");
}

function editDriveFav(el) {
  const f = driveHubFavs().find((x) => String(x.id) === el.dataset.id);
  if (f) openDriveFavEdit({ id: String(f.id), name: f.name, emoji: f.emoji || "⭐", lat: Number(f.lat), lng: Number(f.lng), address: f.address || "" });
}

function pickDriveFavEmoji(el) {
  if (!driveHub.favEdit) return;
  driveHub.favEdit.emoji = el.dataset.e;
  const name = document.getElementById("driveFavName");
  const auto = { "🏠": "Casa", "💼": "Trampo" };
  if (!name.value.trim() && auto[el.dataset.e]) name.value = auto[el.dataset.e];
  renderDriveFavEdit();
}

function saveDriveFav() {
  const e = driveHub.favEdit;
  if (!e) return;
  const name = document.getElementById("driveFavName").value.trim().slice(0, 30) || e.name || "Favorito";
  const done = driveHubWrite((db) => {
    if (e.id) {
      const f = db.favorites.find((x) => x && String(x.id) === e.id);
      if (!f) return false;
      f.name = name;
      f.emoji = e.emoji || "⭐";
      return true;
    }
    if (db.favorites.some((x) => x && driveDist([Number(x.lat), Number(x.lng)], [e.lat, e.lng]) < 40)) {
      showPageMessage("Já tem um favorito nesse lugar (menos de 40 m). Edita ele no ✏️.", { title: "Já é favorito", icon: "⭐" });
      return false;
    }
    db.favorites.push({ id: `fv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, emoji: e.emoji || "⭐", lat: e.lat, lng: e.lng, address: e.address || "", createdAt: Date.now() });
    return true;
  });
  if (!done) return;
  driveHub.favEdit = null;
  closeTobaModal("driveFavEdit");
  tobaSaved();
  renderDriveFavSheet();
  renderDriveHub();
}

async function deleteDriveFav() {
  const e = driveHub.favEdit;
  if (!e || !e.id) return;
  closeTobaModal("driveFavEdit");
  const ok = await showPageMessage(`Tirar "${e.name || "Favorito"}" dos favoritos?`, { title: "Tirar favorito?", icon: "⭐", confirm: true, confirmLabel: "Tirar" });
  if (!ok) return;
  const done = driveHubWrite((db) => {
    const before = db.favorites.length;
    db.favorites = db.favorites.filter((x) => !x || String(x.id) !== e.id);
    return db.favorites.length !== before;
  });
  driveHub.favEdit = null;
  if (done) tobaToast("⭐ Tirado");
  renderDriveFavSheet();
  renderDriveHub();
}

// 📍 Favoritar onde eu tô agora (GPS do aparelho; só nome e emoji, sem digitar endereço)
function addDriveFavHere(el) {
  if (!navigator.geolocation) {
    showPageMessage("Esse aparelho não deu o GPS pro Toba. Usa o 🔍 Buscar lugar.", { title: "Sem GPS", icon: "📡" });
    return;
  }
  if (el) el.disabled = true;
  const label = el ? el.textContent : "";
  if (el) el.textContent = "📡 Achando...";
  const back = () => {
    if (!el) return;
    el.disabled = false;
    el.textContent = label;
  };
  navigator.geolocation.getCurrentPosition((p) => {
    back();
    openDriveFavEdit({ name: "", emoji: "⭐", lat: p.coords.latitude, lng: p.coords.longitude, address: "" });
  }, (err) => {
    back();
    showPageMessage(err && err.code === 1
      ? "O Toba não tem permissão de localização. Libera nas configurações do celular ou usa o 🔍 Buscar lugar."
      : "O GPS não respondeu agora. Tenta de novo no céu aberto ou usa o 🔍 Buscar lugar.", { title: "Não achei onde tu tá", icon: "📡" });
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
}

// 🔍 Buscar lugar: abre o Toba Drive no modo favoritar (busca/mapa e já cai no ⭐)
function addDriveFavSearch() {
  window.location.href = "TobaDrive/TobaDrive.html?fav=1";
}

/* ---------------------------------------------------------------------
 * Quadradinhos do hub
 * ------------------------------------------------------------------- */
function renderDriveHub() {
  const got = driveHubRead();
  const s = calcDriveSummary(got ? got.db : null);
  document.getElementById("hubNavDesc").textContent = s.last
    ? `Última: ${s.last.name} · ${driveHubKmText(s.last.km)} km${s.last.arrived ? " 🏁" : ""}${s.last.source === "auto" ? " 🚘" : ""}`
    : "GPS com voz e trânsito ao vivo. Destino da busca, dos favoritos ou do Toba Places.";
  document.getElementById("hubDriveStats").innerHTML =
    driveHubTile("openDriveKm", "🛣️ Km no mês", `<span class="text-racing">${driveHubKmText(s.monthKm)}</span>`, s.km ? `${driveHubKmText(s.km)} km na vida` : "bora rodar")
    + driveHubTile("openDriveTrips", "🧭 Viagens", String(s.monthTrips), s.trips ? `${s.trips} no total` : "nenhuma ainda")
    + driveHubTile("openDriveArrived", "🏁 Chegou", String(s.arrived), s.arrived ? "sem se perder" : "o destino te espera")
    + driveHubTile("openDriveFavs", "⭐ Favoritos", String(s.favorites), s.favorites ? "a um toque" : "🏠 Casa, 💼 Trampo...");
}

function driveHubOpenFromHash() {
  const h = (location.hash || "").replace("#", "");
  const open = { km: openDriveKm, trips: openDriveTrips, favs: openDriveFavs }[h];
  if (!open) return;
  history.replaceState(null, "", location.pathname + location.search);
  open();
}

tobaActions({
  openDriveKm,
  openDriveMonth,
  openDriveTrips,
  openDriveArrived,
  pickDriveFilter,
  toggleDriveTrip,
  goDriveTrip,
  deleteDriveTrip,
  openDriveFavs,
  goDriveFav,
  editDriveFav,
  pickDriveFavEmoji,
  saveDriveFav,
  deleteDriveFav,
  addDriveFavHere,
  addDriveFavSearch,
});
