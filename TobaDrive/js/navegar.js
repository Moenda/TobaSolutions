/* =====================================================================
 * Toba Drive · 🧭 Navegar (desde v1.65)
 * Telas (mesmo HTML):
 *   "pick"    escolher o destino (busca, ⭐ favoritos, 📌 Toba Places, recentes)
 *   "choose"  mapa: toca onde quer ir
 *   "preview" rota desenhada + resumo + 🚀 Partiu
 *   "nav"     navegando: faixa da manobra, voz, GPS seguindo, recálculo
 *   "done"    chegou (ou encerrou): resumo da viagem
 * GPS: navigator.geolocation.watchPosition (só com a página aberta: navegador
 * não deixa site usar GPS com a tela apagada, por isso a tela acesa).
 * Abrir já com destino: TobaDrive-Navegar.html?lat=-23.5&lng=-46.6&name=Café
 * Só LÊ o TOBA_TURISM_DB (destinos do Toba Places); grava só o TOBA_DRIVE_DB.
 * v1.66: mora dentro do Toba Racing (‹ volta pro hub do Racing). Mapa e rota
 * do TomTom (assets/toba-maps.js + drive-route.js), 🚦 camada de trânsito e,
 * navegando com rota TomTom, confere o trânsito a cada DRIVE_TRAFFIC_CHECK_MS:
 * atualiza a chegada e troca de caminho se o novo poupar DRIVE_SWAP_SAVE_S+.
 * ===================================================================== */
const DRIVE_FAV_EMOJIS = ["🏠", "💼", "❤️", "☕", "🏋️", "🛒", "🍻", "🐾", "⭐"];
const DRIVE_GPS_TIMEOUT_MS = 20000;
const DRIVE_ARRIVE_M = 35;
const DRIVE_TRAFFIC_CHECK_MS = 5 * 60 * 1000;
const DRIVE_SWAP_SAVE_S = 180;

const nav = {
  mode: "pick",
  dest: null, // { name, address, lat, lng, placeId? }
  route: null,
  routeId: 0,
  pos: null, // { lat, lng, acc, speed (m/s), heading, at }
  watchId: null,
  gpsError: "",
  seg: 0,
  along: 0,
  offCount: 0,
  lastReroute: 0,
  rerouting: false,
  spoken: {},
  follow: true,
  map: null,
  tiles: null,
  traffic: null, // camada 🚦 (tobaTrafficTiles)
  lastTrafficCheck: 0,
  layers: {},
  trip: null, // { startedAt, km, last: [lat, lng] }
  result: null, // resumo do "done"
  placesListId: "",
  searchSeq: 0,
  waiters: [],
  favEmoji: "⭐",
};

/* ---------------------------------------------------------------------
 * GPS
 * ------------------------------------------------------------------- */
function startGps() {
  if (nav.watchId !== null) return;
  if (!("geolocation" in navigator)) {
    nav.gpsError = "Esse navegador não tem GPS.";
    renderGpsStatus();
    return;
  }
  nav.watchId = navigator.geolocation.watchPosition(onFix, onGpsError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: DRIVE_GPS_TIMEOUT_MS,
  });
  renderGpsStatus();
}

function onGpsError(err) {
  if (err && err.code === 1) {
    nav.gpsError = "Sem permissão de localização. Libera no cadeado da barra de endereço (Chrome › Permissões › Local).";
    if (nav.watchId !== null) navigator.geolocation.clearWatch(nav.watchId);
    nav.watchId = null;
  } else if (!nav.pos) {
    nav.gpsError = "Procurando o GPS... (céu aberto ajuda)";
  }
  nav.waiters.splice(0).forEach((w) => w(null));
  renderGpsStatus();
}

function onFix(p) {
  const c = p.coords;
  const prev = nav.pos;
  const here = [c.latitude, c.longitude];
  let speed = Number.isFinite(c.speed) && c.speed !== null ? c.speed : null;
  let heading = Number.isFinite(c.heading) && c.heading !== null ? c.heading : null;
  if (prev) {
    const moved = driveDist([prev.lat, prev.lng], here);
    const dt = (p.timestamp - prev.at) / 1000;
    // Alguns aparelhos mandam speed 0 andando: confia na conta quando andou de verdade
    if (dt > 0.5 && (speed === null || (speed === 0 && moved / dt > 2 && Number(c.accuracy) <= 40))) speed = moved / dt;
    if (heading === null && moved > 6) heading = driveBearing([prev.lat, prev.lng], here);
    if (heading === null) heading = prev.heading;
  }
  nav.pos = { lat: here[0], lng: here[1], acc: Number(c.accuracy) || 999, speed: Math.max(0, speed || 0), heading, at: p.timestamp || Date.now() };
  nav.gpsError = "";
  nav.waiters.splice(0).forEach((w) => w(nav.pos));
  renderGpsStatus();
  drawCar();
  if (nav.mode === "nav") navTick();
}

// Espera a 1ª posição (ou desiste em ms)
function waitForFix(ms = 15000) {
  if (nav.pos) return Promise.resolve(nav.pos);
  startGps();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(nav.pos), ms);
    nav.waiters.push((pos) => {
      clearTimeout(timer);
      resolve(pos);
    });
  });
}

function renderGpsStatus() {
  const box = document.getElementById("gpsStatus");
  if (!box) return;
  if (nav.gpsError) box.innerHTML = `<span class="dv-gps-dot is-bad"></span>${escapeHtml(nav.gpsError)}`;
  else if (nav.pos) box.innerHTML = `<span class="dv-gps-dot is-ok"></span>GPS na mão (±${Math.round(nav.pos.acc)} m)`;
  else if (nav.watchId !== null) box.innerHTML = `<span class="dv-gps-dot"></span>Procurando o GPS...`;
  else box.innerHTML = `<span class="dv-gps-dot"></span>O GPS liga quando tu escolher o destino`;
}

/* ---------------------------------------------------------------------
 * Tela 1: escolher destino
 * ------------------------------------------------------------------- */
function readTurismForDrive() {
  try {
    const db = JSON.parse(localStorage.getItem("TOBA_TURISM_DB") || "null");
    return {
      lists: Array.isArray(db?.lists) ? db.lists : [],
      places: Array.isArray(db?.places) ? db.places : [],
    };
  } catch (err) {
    return { lists: [], places: [] };
  }
}

function drivePlacePin(p) {
  if (Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && p.lat !== null && p.lng !== null) return { lat: Number(p.lat), lng: Number(p.lng) };
  const fromUrl = typeof turismCoordsFromUrl === "function" ? turismCoordsFromUrl(p.url) : null;
  return fromUrl && driveValidPoint(fromUrl) ? fromUrl : null;
}

function chip(label, action, data = {}, extra = "") {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${escapeHtml(String(v))}"`).join("");
  return `<button type="button" class="chip-btn dv-chip${extra}" data-click="${action}"${attrs}>${label}</button>`;
}

function kmFromHere(p) {
  if (!nav.pos) return "";
  const km = driveDist([nav.pos.lat, nav.pos.lng], [p.lat, p.lng]);
  return driveFormatDist(km);
}

function renderPick() {
  // ⭐ Favoritos
  const favs = driveDb.favorites;
  document.getElementById("favChips").innerHTML = favs.length
    ? favs.map((f) => chip(`${escapeHtml(f.emoji)} ${escapeHtml(f.name)}`, "goFav", { id: f.id })).join("")
    : `<span class="dv-hint">Escolhe um destino e toca em ⭐ pra deixar aqui (🏠 Casa, 💼 Trampo...).</span>`;

  // 📌 Toba Places
  const t = readTurismForDrive();
  const lists = t.lists.filter((l) => t.places.some((p) => String(p.listId) === String(l.id)));
  document.getElementById("placesTitle").hidden = !lists.length;
  if (lists.length && !lists.some((l) => String(l.id) === nav.placesListId)) nav.placesListId = String(lists[0].id);
  document.getElementById("placesLists").innerHTML = lists.length > 1
    ? lists.map((l) => chip(`${escapeHtml(l.emoji || "📍")} ${escapeHtml(l.name)}`, "pickPlacesList", { id: l.id }, String(l.id) === nav.placesListId ? " is-on" : "")).join("")
    : "";
  const list = lists.find((l) => String(l.id) === nav.placesListId);
  const places = list ? t.places.filter((p) => String(p.listId) === String(list.id)) : [];
  // Primeiro os que ainda quer ir, depois os já visitados
  places.sort((a, b) => (a.status === "been") - (b.status === "been") || String(a.name).localeCompare(String(b.name)));
  document.getElementById("placesChips").innerHTML = places.map((p) => {
    const pin = drivePlacePin(p);
    const icon = (typeof turismKind === "function" && turismKind(p.kind)?.icon) || (p.status === "been" ? "✅" : "📌");
    return chip(`${icon} ${escapeHtml(p.name)}${pin ? "" : " 🔎"}`, "goPlace", { id: p.id });
  }).join("");

  // 🕘 Recentes
  const recent = driveDb.recent;
  document.getElementById("clearRecentBtn").hidden = !recent.length;
  document.getElementById("recentList").innerHTML = recent.length
    ? recent.map((r, i) => `
      <div class="toba-list-item" role="button" tabindex="0" data-click="goRecent" data-index="${i}">
        <span class="dv-item-text"><b>${escapeHtml(r.name)}</b>${r.address ? `<small>${escapeHtml(r.address)}</small>` : ""}</span>
        <span class="dv-item-km">${kmFromHere(r)}</span>
      </div>`).join("")
    : tobaEmpty("🛣️", "Nenhum destino ainda", "Busca um endereço aí em cima ou escolhe no mapa.", { compact: true });
}

async function searchSubmit() {
  const q = document.getElementById("driveQuery").value.trim();
  const box = document.getElementById("searchResults");
  if (q.length < 3) {
    box.innerHTML = "";
    return;
  }
  if (navigator.onLine === false) {
    box.innerHTML = tobaEmpty("📡", "Sem internet", "A busca de endereço precisa de rede.", { compact: true });
    return;
  }
  document.getElementById("driveQuery").blur();
  startGps();
  const seq = ++nav.searchSeq;
  box.innerHTML = `<div class="dv-hint">🔎 Procurando...</div>`;
  try {
    const rows = await driveSearchPlaces(q, nav.pos);
    if (seq !== nav.searchSeq) return;
    if (nav.pos) rows.sort((a, b) => a.km - b.km);
    nav.results = rows;
    box.innerHTML = rows.length
      ? `<div class="toba-list dv-results">${rows.map((r, i) => `
        <div class="toba-list-item" role="button" tabindex="0" data-click="goResult" data-index="${i}">
          <span class="dv-item-text"><b>${escapeHtml(r.name)}</b>${r.address ? `<small>${escapeHtml(r.address)}</small>` : ""}</span>
          <span class="dv-item-km">${kmFromHere(r)}</span>
        </div>`).join("")}</div>`
      : tobaEmpty("🤷", "Não achei", "Tenta com número e bairro (Rua X, 123, Pinheiros) ou escolhe no mapa.", { compact: true });
  } catch (err) {
    if (seq !== nav.searchSeq) return;
    box.innerHTML = tobaEmpty("😵", "A busca não respondeu", "Tenta de novo em uns segundos.", { compact: true });
  }
}

function goResult(el) {
  const r = nav.results?.[Number(el.dataset.index)];
  if (r) setDestination(r);
}

function goRecent(el) {
  const r = driveDb.recent[Number(el.dataset.index)];
  if (r) setDestination(r);
}

function goFav(el) {
  const f = driveDb.favorites.find((x) => x.id === el.dataset.id);
  if (f) setDestination({ name: f.name, address: f.address, lat: f.lat, lng: f.lng });
}

function pickPlacesList(el) {
  nav.placesListId = String(el.dataset.id);
  renderPick();
}

function goPlace(el) {
  const t = readTurismForDrive();
  const p = t.places.find((x) => String(x.id) === String(el.dataset.id));
  if (!p) return;
  const pin = drivePlacePin(p);
  if (pin) {
    setDestination({ name: p.name, address: p.address || p.region || "", lat: pin.lat, lng: pin.lng, placeId: p.id });
    return;
  }
  // Sem pino: joga na busca (nome + cidade da lista)
  const list = t.lists.find((l) => String(l.id) === String(p.listId));
  document.getElementById("driveQuery").value = [p.name, p.address || p.region, list?.city].filter(Boolean).join(", ");
  tobaToast("🔎 Sem pino no Places, procurando pelo nome");
  searchSubmit();
}

async function clearRecent() {
  const ok = await showPageMessage("Limpa a lista de destinos recentes? Favoritos e viagens ficam.", { title: "Limpar recentes?", icon: "🧹", confirm: true, confirmLabel: "Limpar" });
  if (!ok) return;
  driveDb.recent = [];
  saveDriveDb();
  renderPick();
}

/* ---------------------------------------------------------------------
 * Mapa (uma instância só, que mora no #routeView)
 * ------------------------------------------------------------------- */
async function ensureMap() {
  await loadDriveLeaflet();
  if (nav.map) return nav.map;
  const box = document.getElementById("driveMap");
  box.innerHTML = "";
  const start = nav.pos ? [nav.pos.lat, nav.pos.lng] : [-23.5505, -46.6333];
  nav.map = L.map(box, { zoomControl: false, attributionControl: true }).setView(start, nav.pos ? 15 : 12);
  const style = readDrivePrefs().mapStyle;
  nav.tiles = tobaBaseTiles(nav.map, style, { cartoKey: DRIVE_CARTO_KEY, onFallback: renderTrafficBtn });
  nav.traffic = tobaTrafficTiles(nav.map, style);
  nav.traffic.tobaSetOn(readDrivePrefs().traffic);
  nav.layers.route = L.layerGroup().addTo(nav.map);
  nav.layers.marks = L.layerGroup().addTo(nav.map);
  nav.map.on("click", onMapClick);
  nav.map.on("dragstart", () => {
    if (nav.mode !== "nav") return;
    nav.follow = false;
    document.getElementById("recenterBtn").hidden = false;
  });
  box.classList.toggle("is-dark", readDrivePrefs().mapStyle === "dark");
  return nav.map;
}

function drawCar() {
  if (!nav.map || !nav.pos) return;
  const ll = [nav.pos.lat, nav.pos.lng];
  const rot = Number.isFinite(nav.pos.heading) ? nav.pos.heading : 0;
  const html = `<span class="dv-car${nav.mode === "nav" ? " is-nav" : ""}" style="transform: rotate(${Math.round(rot)}deg)"></span>`;
  if (!nav.layers.car) {
    nav.layers.car = L.marker(ll, { icon: L.divIcon({ className: "dv-car-wrap", html, iconSize: [34, 34], iconAnchor: [17, 17] }), interactive: false, zIndexOffset: 1000 }).addTo(nav.map);
  } else {
    nav.layers.car.setLatLng(ll);
    const el = nav.layers.car.getElement()?.querySelector(".dv-car");
    if (el) {
      el.style.transform = `rotate(${Math.round(rot)}deg)`;
      el.classList.toggle("is-nav", nav.mode === "nav");
    }
  }
}

function drawRoute() {
  if (!nav.map) return;
  nav.layers.route.clearLayers();
  nav.layers.marks.clearLayers();
  if (nav.route) {
    L.polyline(nav.route.coords, { color: "#0d1117", weight: 10, opacity: 0.55 }).addTo(nav.layers.route);
    L.polyline(nav.route.coords, { color: "#fb923c", weight: 6, opacity: 0.95 }).addTo(nav.layers.route);
    // Trechos parados da rota TomTom por cima (amarelo = lento, vermelho = parado)
    (nav.route.jams || []).forEach((j) => {
      const part = nav.route.coords.slice(j.from, j.to + 1);
      if (part.length < 2) return;
      const color = j.level >= 4 ? "#7f1d1d" : j.level >= 3 ? "#ef4444" : j.level >= 2 ? "#f97316" : "#facc15";
      L.polyline(part, { color, weight: 6, opacity: 0.95 }).addTo(nav.layers.route);
    });
  }
  if (nav.dest) {
    L.marker([nav.dest.lat, nav.dest.lng], { icon: L.divIcon({ className: "dv-flag-wrap", html: `<span class="dv-flag">🏁</span>`, iconSize: [32, 32], iconAnchor: [8, 30] }) }).addTo(nav.layers.marks);
  }
}

function fitRoute() {
  if (!nav.map) return;
  const pts = nav.route ? nav.route.coords : [];
  if (pts.length > 1) {
    nav.map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [30, 80], paddingBottomRight: [30, 230] });
  } else if (nav.dest) {
    nav.map.setView([nav.dest.lat, nav.dest.lng], 16);
  }
}

function toggleMapStyle() {
  const next = readDrivePrefs().mapStyle === "dark" ? "light" : "dark";
  storeDrivePrefs({ mapStyle: next });
  if (nav.tiles) nav.tiles.tobaSetStyle(next);
  if (nav.traffic) nav.traffic.tobaSetStyle(next);
  document.getElementById("driveMap").classList.toggle("is-dark", next === "dark");
  document.getElementById("styleBtn").textContent = next === "dark" ? "☀️" : "🌙";
}

// 🚦 camada de trânsito do TomTom (some sozinha se o TomTom estiver fora)
function toggleTraffic() {
  if (!tobaTomTomOn()) {
    const s = tobaTomTomState();
    tobaToast(`🚦 TomTom fora agora (${s.offWhy || "sem resposta"}). Volta sozinho em algumas horas.`);
    return;
  }
  const on = !readDrivePrefs().traffic;
  storeDrivePrefs({ traffic: on });
  if (nav.traffic) nav.traffic.tobaSetOn(on);
  renderTrafficBtn();
  tobaToast(on ? "🚦 Trânsito ligado" : "🚦 Trânsito desligado");
}

function renderTrafficBtn() {
  const on = readDrivePrefs().traffic && tobaTomTomOn();
  document.querySelectorAll("[data-click='toggleTraffic']").forEach((btn) => {
    btn.classList.toggle("is-off", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

// "TomTom · trânsito ao vivo" ou o plano B
function routeSourceLine(r) {
  if (r.provider === "tomtom") {
    const late = Math.round((r.trafficDelay || 0) / 60);
    return late >= 1 ? `🚦 Trânsito ao vivo: +${late} min de lentidão no caminho` : "🚦 Trânsito ao vivo: caminho livre";
  }
  return "🗺️ Rota do OpenStreetMap (sem trânsito ao vivo)";
}

async function onMapClick(ev) {
  if (nav.mode !== "choose") return;
  const { lat, lng } = ev.latlng;
  const dest = { name: "Ponto no mapa", address: "", lat, lng };
  setDestination(dest);
  // nome da rua chega depois, sem segurar a rota
  try {
    const r = await driveReverse(lat, lng);
    const cur = nav.dest;
    if (cur && cur.lat === lat && cur.lng === lng && cur.name === "Ponto no mapa") {
      cur.name = r.name;
      cur.address = r.address;
      driveRememberRecent(cur);
      renderRoute();
    }
  } catch (err) {
    /* fica "Ponto no mapa" */
  }
}

/* ---------------------------------------------------------------------
 * Troca de tela
 * ------------------------------------------------------------------- */
async function setMode(mode) {
  nav.mode = mode;
  const inRoute = mode !== "pick";
  document.getElementById("pickView").hidden = inRoute;
  document.getElementById("routeView").hidden = !inRoute;
  document.body.classList.toggle("is-driving", inRoute);
  document.body.classList.toggle("is-nav", mode === "nav");
  if (mode === "pick") {
    renderPick();
    return;
  }
  try {
    await ensureMap();
  } catch (err) {
    document.getElementById("driveMap").innerHTML = tobaEmpty("📡", "Mapa sem internet", "O mapa precisa de internet. Dá pra ir pelo Google Maps/Waze no ↗️.", { compact: true });
  }
  setTimeout(() => nav.map && nav.map.invalidateSize(), 60);
  renderRoute();
}

function chooseOnMap() {
  startGps();
  nav.dest = null;
  nav.route = null;
  setMode("choose").then(() => {
    if (nav.map && nav.pos) nav.map.setView([nav.pos.lat, nav.pos.lng], 15);
    drawRoute();
  });
}

function routeBack() {
  if (nav.mode === "nav") {
    endNav();
    return;
  }
  nav.route = null;
  nav.dest = null;
  if (nav.map) drawRoute();
  setMode("pick");
}

/* ---------------------------------------------------------------------
 * Destino → rota (prévia)
 * ------------------------------------------------------------------- */
async function setDestination(dest) {
  nav.dest = { ...dest, lat: Number(dest.lat), lng: Number(dest.lng) };
  nav.route = null;
  nav.routeError = "";
  nav.loading = true;
  driveRememberRecent(nav.dest);
  await setMode("preview");
  drawRoute();
  if (nav.map) nav.map.setView([nav.dest.lat, nav.dest.lng], 15);
  const target = nav.dest;
  const pos = await waitForFix();
  if (nav.dest !== target) return;
  if (!pos) {
    nav.loading = false;
    nav.routeError = nav.gpsError || "Não achei tua posição no GPS.";
    renderRoute();
    return;
  }
  try {
    const route = await driveFetchRoute(pos, target, { heading: pos.heading, speed: pos.speed });
    if (nav.dest !== target) return;
    nav.route = route;
    nav.routeId += 1;
  } catch (err) {
    nav.routeError = navigator.onLine === false ? "Sem internet pra montar a rota." : "O servidor de rotas não respondeu. Tenta de novo ou vai pelo Maps/Waze.";
  }
  nav.loading = false;
  drawRoute();
  fitRoute();
  renderRoute();
}

function retryRoute() {
  if (nav.dest) setDestination(nav.dest);
}

function isFavorite(dest) {
  return dest ? driveDb.favorites.find((f) => driveDist([f.lat, f.lng], [dest.lat, dest.lng]) < 40) || null : null;
}

function renderRoute() {
  const top = document.getElementById("routeTopText");
  const card = document.getElementById("previewCard");
  const banner = document.getElementById("navBanner");
  const panel = document.getElementById("navPanel");
  const then = document.getElementById("navThen");
  document.getElementById("styleBtn").textContent = readDrivePrefs().mapStyle === "dark" ? "☀️" : "🌙";
  document.getElementById("voiceBtn").textContent = readDrivePrefs().voice ? "🔊" : "🔇";
  renderTrafficBtn();
  const isNav = nav.mode === "nav";
  banner.hidden = !isNav;
  panel.hidden = !isNav;
  if (!isNav) then.hidden = true;
  document.getElementById("routeTop").hidden = isNav;
  document.getElementById("recenterBtn").hidden = !isNav || nav.follow;

  if (nav.mode === "choose") {
    top.innerHTML = "👆 Toca no mapa onde tu quer ir";
    card.hidden = true;
    return;
  }
  if (nav.mode === "done") {
    top.textContent = "🏁 Fim da viagem";
    card.hidden = false;
    const r = nav.result || {};
    card.innerHTML = `
      <div class="dv-card-title">${r.arrived ? "🏁 Chegou, piloto!" : "🛑 Navegação encerrada"}</div>
      <div class="dv-card-sub">${escapeHtml(nav.dest?.name || "")}</div>
      <div class="toba-stats dv-stats">
        <div class="toba-stat"><span class="toba-stat-label">🛣️ Rodou</span><span class="toba-stat-value">${driveFormatKm(r.m || 0)} km</span></div>
        <div class="toba-stat"><span class="toba-stat-label">⏱️ Tempo</span><span class="toba-stat-value">${driveFormatDuration(r.s || 0)}</span></div>
      </div>
      ${r.arrived ? `<div class="dv-quote">Nunca foi sorte, Cloba. Nunca foi sorte. 🙏</div>` : ""}
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-grow-1" data-click="favOpen">${isFavorite(nav.dest) ? "⭐ Favorito" : "☆ Favoritar"}</button>
        <button type="button" class="btn btn-primary btn-grow-2" data-click="routeBack">Novo destino</button>
      </div>`;
    return;
  }
  if (isNav) {
    card.hidden = true;
    return;
  }
  // preview
  const d = nav.dest;
  top.innerHTML = d ? `<b>${escapeHtml(d.name)}</b>` : "";
  card.hidden = !d;
  if (!d) return;
  const fav = isFavorite(d);
  let body;
  if (nav.loading) {
    body = `<div class="dv-hint">🧭 ${nav.pos ? "Montando a rota..." : "Esperando o GPS achar tu..."}</div>`;
  } else if (nav.route) {
    const r = nav.route;
    body = `
      <div class="toba-stats dv-stats">
        <div class="toba-stat"><span class="toba-stat-label">🛣️ Distância</span><span class="toba-stat-value">${driveFormatKm(r.distance)} km</span></div>
        <div class="toba-stat"><span class="toba-stat-label">⏱️ Tempo</span><span class="toba-stat-value">${driveFormatDuration(r.duration)}</span></div>
        <div class="toba-stat"><span class="toba-stat-label">🏁 Chega</span><span class="toba-stat-value">${driveFormatClock(Date.now() + r.duration * 1000)}</span></div>
      </div>
      <div class="dv-source${r.provider === "tomtom" && r.trafficDelay >= 300 ? " is-late" : ""}">${routeSourceLine(r)}</div>`;
  } else {
    body = `<div class="dv-error">😵 ${escapeHtml(nav.routeError || "Sem rota.")}</div>`;
  }
  card.innerHTML = `
    <div class="dv-card-head">
      <span class="dv-card-text">
        <span class="dv-card-title">${escapeHtml(d.name)}</span>
        ${d.address ? `<span class="dv-card-sub">${escapeHtml(d.address)}</span>` : ""}
      </span>
      <button type="button" class="dv-round dv-fav${fav ? " is-on" : ""}" data-click="favOpen" aria-label="Favoritar">${fav ? "⭐" : "☆"}</button>
    </div>
    ${body}
    <div class="btn-row">
      <button type="button" class="btn btn-outline btn-grow-1" data-click="openOut">↗️ Maps</button>
      ${nav.route
        ? `<button type="button" class="btn btn-primary btn-grow-2 dv-go" data-click="startNav">🚀 Partiu</button>`
        : nav.loading ? "" : `<button type="button" class="btn btn-primary btn-grow-2" data-click="retryRoute">🔄 Tentar de novo</button>`}
    </div>`;
}

/* ---------------------------------------------------------------------
 * Navegando
 * ------------------------------------------------------------------- */
function startNav() {
  if (!nav.route || !nav.pos) return;
  nav.seg = 0;
  nav.along = 0;
  nav.offCount = 0;
  nav.spoken = {};
  nav.follow = true;
  nav.trip = { startedAt: Date.now(), m: 0, last: [nav.pos.lat, nav.pos.lng] };
  nav.lastTrafficCheck = Date.now();
  driveKeepAwake(true);
  setMode("nav").then(() => {
    if (nav.map) nav.map.setView([nav.pos.lat, nav.pos.lng], 17);
    const first = nav.route.steps.find((s) => s.type === "depart");
    const eta = driveFormatClock(Date.now() + nav.route.duration * 1000);
    // A 1ª manobra longe já entra no "Partiu" (senão a fala de longe cortava ele)
    const next = driveNextStep(nav.route, 0);
    let then = "";
    if (next && next.step.type !== "arrive" && next.dist > 400) {
      nav.spoken[`${nav.routeId}:${next.index}:far`] = true;
      then = ` Em ${driveSpokenDist(next.dist)}, ${driveLowerFirst(next.step.alert)}.`;
    }
    driveSpeak(`Partiu! ${first?.pre ? `${first.pre}.` : ""}${then} Chegada prevista às ${eta.replace(":", " e ")}.`);
    navTick();
  });
}

function navTick() {
  const r = nav.route;
  const pos = nav.pos;
  if (!r || !pos) return;
  const here = [pos.lat, pos.lng];

  // Quilômetros rodados de verdade (só com GPS bom e sem pulo maluco)
  if (nav.trip && pos.acc <= 40) {
    const d = driveDist(nav.trip.last, here);
    if (d > 4 && d < 400) {
      nav.trip.m += d;
      nav.trip.last = here;
    } else if (d >= 400) {
      nav.trip.last = here;
    }
  }

  const loc = driveLocateOnRoute(r, here, nav.seg);
  if (loc) {
    nav.seg = loc.seg;
    nav.along = loc.along;
    const limit = Math.max(40, Math.min(pos.acc, 60) * 1.3);
    nav.offCount = loc.dist > limit && pos.acc <= 60 ? nav.offCount + 1 : 0;
  }
  const total = r.cum[r.cum.length - 1] || r.distance;
  const left = Math.max(0, total - nav.along);
  const toDest = driveDist(here, [nav.dest.lat, nav.dest.lng]);

  if (toDest <= DRIVE_ARRIVE_M || (left <= 20 && toDest < 120)) {
    arrive();
    return;
  }
  if (nav.offCount >= 3) reroute();
  else if (r.provider === "tomtom" && Date.now() - nav.lastTrafficCheck > DRIVE_TRAFFIC_CHECK_MS) checkTraffic(total);

  const next = driveNextStep(r, nav.along);
  renderNav(next, left, total);
  speakNext(next);

  if (nav.follow && nav.map) {
    const z = pos.speed > 22 ? 15 : pos.speed > 12 ? 16 : 17;
    nav.map.setView(here, Math.max(z, Math.min(nav.map.getZoom(), 18)), { animate: true });
  }
}

function renderNav(next, left, total) {
  const r = nav.route;
  const step = next?.step;
  document.getElementById("navIcon").textContent = nav.rerouting ? "🔄" : step?.icon || "⬆️";
  document.getElementById("navDist").textContent = nav.rerouting ? "Recalculando..." : next ? driveFormatDist(next.dist) : "--";
  document.getElementById("navText").textContent = nav.rerouting ? "Segura que o Cloba tá refazendo a rota" : step?.text || "Siga em frente";
  if (nav.rerouting) {
    document.getElementById("navThen").hidden = true;
    return;
  }
  // "Depois:" quando a próxima manobra vem colada
  const after = next ? r.steps[next.index + 1] : null;
  const gap = after ? (r.cum[after.idx] || 0) - (r.cum[step.idx] || 0) : Infinity;
  const then = document.getElementById("navThen");
  then.hidden = !(after && gap < 250);
  if (!then.hidden) then.innerHTML = `Depois: <b>${after.icon}</b> ${escapeHtml(after.text)}`;
  const secs = r.duration * (left / (total || 1));
  document.getElementById("navEta").textContent = driveFormatClock(Date.now() + secs * 1000);
  document.getElementById("navLeft").textContent = left >= 1000 ? `${driveFormatKm(left)} km` : driveFormatDist(left);
  document.getElementById("navLeftSub").textContent = `faltam · ${driveFormatDuration(secs)}`;
  document.getElementById("navSpeed").textContent = String(Math.round((nav.pos?.speed || 0) * 3.6));
}

// Fala de longe ("Em 300 metros, vire à direita...") e na hora ("Vire à direita...")
function speakNext(next) {
  if (!next || nav.rerouting) return;
  const step = next.step;
  if (step.type === "arrive") {
    const key = `${nav.routeId}:${next.index}:pre`;
    if (next.dist <= 400 && !nav.spoken[key]) {
      nav.spoken[key] = true;
      driveSpeak(`Em ${driveSpokenDist(next.dist)}, você chega ao destino.`);
    }
    return;
  }
  const v = Math.max(nav.pos?.speed || 0, 8);
  const preAt = Math.min(500, Math.max(150, v * 14));
  const nowAt = Math.min(90, Math.max(40, v * 5));
  const base = `${nav.routeId}:${next.index}`;
  if (!nav.spoken[`${base}:far`] && !nav.spoken[`${base}:pre`] && next.dist > preAt + 300) {
    nav.spoken[`${base}:far`] = true;
    if (next.dist > 900) driveSpeak(`Siga por ${driveSpokenDist(next.dist)}. Depois, ${driveLowerFirst(step.alert)}.`);
    return;
  }
  if (!nav.spoken[`${base}:pre`] && next.dist <= preAt && next.dist > nowAt) {
    nav.spoken[`${base}:pre`] = true;
    driveSpeak(`Em ${driveSpokenDist(next.dist)}, ${driveLowerFirst(step.alert)}.`);
    return;
  }
  if (!nav.spoken[`${base}:now`] && next.dist <= nowAt) {
    nav.spoken[`${base}:now`] = true;
    nav.spoken[`${base}:pre`] = true;
    driveSpeak(`${step.pre}.`);
  }
}

async function reroute() {
  if (nav.rerouting || Date.now() - nav.lastReroute < DRIVE_REROUTE_GAP_MS || !nav.pos || !nav.dest) return;
  nav.rerouting = true;
  nav.lastReroute = Date.now();
  driveSpeak("Recalculando.");
  renderNav(null, 0, 1);
  const target = nav.dest;
  try {
    const route = await driveFetchRoute(nav.pos, target, { heading: nav.pos.heading, speed: nav.pos.speed });
    if (nav.mode !== "nav" || nav.dest !== target) return;
    nav.route = route;
    nav.routeId += 1;
    nav.seg = 0;
    nav.along = 0;
    nav.offCount = 0;
    nav.spoken = {};
    drawRoute();
  } catch (err) {
    tobaToast(navigator.onLine === false ? "📡 Sem internet pra recalcular" : "😵 Rota não respondeu, tento de novo já já");
  } finally {
    nav.rerouting = false;
    nav.lastReroute = Date.now();
    if (nav.mode === "nav") navTick();
  }
}

// Navegando com TomTom: pergunta de novo como tá o trânsito daqui pra frente.
// Achou caminho bem mais rápido = troca e avisa; senão só acerta a chegada.
async function checkTraffic(total) {
  nav.lastTrafficCheck = Date.now();
  if (nav.rerouting || !nav.pos || !nav.dest || document.hidden) return;
  const target = nav.dest;
  const routeId = nav.routeId;
  let fresh = null;
  try {
    fresh = await driveFetchTomTom(nav.pos, target, { heading: nav.pos.heading, speed: nav.pos.speed });
  } catch (err) {
    fresh = null;
  }
  if (!fresh || nav.mode !== "nav" || nav.dest !== target || nav.routeId !== routeId || nav.rerouting) return;
  const r = nav.route;
  const nowLeft = r.duration * (Math.max(0, (r.cum[r.cum.length - 1] || r.distance) - nav.along) / (total || 1));
  const save = nowLeft - fresh.duration;
  if (save >= DRIVE_SWAP_SAVE_S) {
    nav.route = fresh;
    nav.routeId += 1;
    nav.seg = 0;
    nav.along = 0;
    nav.offCount = 0;
    nav.spoken = {};
    drawRoute();
    const min = Math.round(save / 60);
    tobaToast(`🚦 Caminho ${min} min mais rápido!`);
    driveSpeak(`Trânsito mudou. Achei um caminho ${min} minutos mais rápido.`);
    navTick();
    return;
  }
  // Mesmo caminho: só acerta a chegada com o trânsito de agora
  const leftNow = Math.max(1, (r.cum[r.cum.length - 1] || r.distance) - nav.along);
  r.duration = fresh.duration * ((r.cum[r.cum.length - 1] || r.distance) / leftNow);
  r.trafficDelay = fresh.trafficDelay;
}

function finishTrip(arrived) {
  const trip = nav.trip;
  nav.trip = null;
  driveKeepAwake(false);
  if (!trip) return { arrived, m: 0, s: 0 };
  const s = (Date.now() - trip.startedAt) / 1000;
  // Viagem de mentirinha (abriu e fechou parado) não entra no histórico
  if (arrived || trip.m >= 300) {
    driveAddTrip({
      date: toIsoDate(new Date(trip.startedAt)),
      startedAt: trip.startedAt,
      endedAt: Date.now(),
      name: nav.dest?.name || "Destino",
      lat: nav.dest?.lat ?? null,
      lng: nav.dest?.lng ?? null,
      km: Math.round(trip.m / 100) / 10,
      arrived: Boolean(arrived),
    });
  }
  return { arrived, m: trip.m, s };
}

function arrive() {
  if (nav.mode !== "nav") return;
  nav.result = finishTrip(true);
  const name = nav.dest?.name && nav.dest.name !== "Ponto no mapa" ? ` em ${nav.dest.name}` : "";
  driveSpeak(`Você chegou${name}. Nunca foi sorte!`);
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  setMode("done").then(() => fitRoute());
}

async function endNav() {
  const ok = await showPageMessage("Encerrar a navegação?", { title: "Parar por aqui?", icon: "🛑", confirm: true, confirmLabel: "Encerrar", cancelLabel: "Seguir" });
  if (!ok || nav.mode !== "nav") return;
  driveShutUp();
  nav.result = finishTrip(false);
  setMode("done").then(() => fitRoute());
}

function recenter() {
  nav.follow = true;
  document.getElementById("recenterBtn").hidden = true;
  if (nav.map && nav.pos) nav.map.setView([nav.pos.lat, nav.pos.lng], 17);
}

function toggleVoice() {
  const on = !readDrivePrefs().voice;
  storeDrivePrefs({ voice: on });
  if (!on) driveShutUp();
  document.getElementById("voiceBtn").textContent = on ? "🔊" : "🔇";
  document.getElementById("prefVoice").checked = on;
  tobaToast(on ? "🔊 Voz ligada" : "🔇 Voz desligada");
}

/* ---------------------------------------------------------------------
 * Maps / Waze
 * ------------------------------------------------------------------- */
function openOut() {
  if (!nav.dest) return;
  openTobaModal("outSheet");
}

function openGoogleMaps() {
  closeTobaModal("outSheet");
  if (nav.dest) driveOpenExternal(driveGoogleMapsUrl(nav.dest));
}

function openWaze() {
  closeTobaModal("outSheet");
  if (nav.dest) driveOpenExternal(driveWazeUrl(nav.dest));
}

/* ---------------------------------------------------------------------
 * ⭐ Favoritos
 * ------------------------------------------------------------------- */
function renderFavEmojis() {
  document.getElementById("favEmojiChips").innerHTML = DRIVE_FAV_EMOJIS.map((e) => chip(e, "favEmojiPick", { e }, ` dv-emoji${e === nav.favEmoji ? " is-on" : ""}`)).join("");
}

function favOpen() {
  if (!nav.dest) return;
  const fav = isFavorite(nav.dest);
  nav.favEmoji = fav ? fav.emoji : "⭐";
  document.getElementById("favSheetTitle").textContent = fav ? "⭐ Editar favorito" : "⭐ Favoritar";
  document.getElementById("favName").value = fav ? fav.name : nav.dest.name === "Ponto no mapa" ? "" : nav.dest.name;
  document.getElementById("favDeleteBtn").hidden = !fav;
  renderFavEmojis();
  openTobaModal("favSheet");
}

function favEmojiPick(el) {
  nav.favEmoji = el.dataset.e;
  const name = document.getElementById("favName");
  const auto = { "🏠": "Casa", "💼": "Trampo" };
  if (!name.value.trim() && auto[nav.favEmoji]) name.value = auto[nav.favEmoji];
  renderFavEmojis();
}

function saveFav() {
  if (!nav.dest) return;
  const name = document.getElementById("favName").value.trim() || nav.dest.name || "Favorito";
  const fav = isFavorite(nav.dest);
  if (fav) {
    fav.name = name;
    fav.emoji = nav.favEmoji;
  } else {
    driveDb.favorites.push({ id: driveNewId("fv"), name, emoji: nav.favEmoji, lat: nav.dest.lat, lng: nav.dest.lng, address: nav.dest.address || "", createdAt: Date.now() });
  }
  saveDriveDb();
  closeTobaModal("favSheet");
  renderRoute();
}

async function deleteFav() {
  const fav = isFavorite(nav.dest);
  if (!fav) return;
  closeTobaModal("favSheet");
  const ok = await showPageMessage(`Tirar "${fav.name}" dos favoritos?`, { title: "Tirar favorito?", icon: "⭐", confirm: true, confirmLabel: "Tirar" });
  if (!ok) return;
  driveDb.favorites = driveDb.favorites.filter((f) => f.id !== fav.id);
  saveDriveDb();
  renderRoute();
}

/* ---------------------------------------------------------------------
 * ⚙️ preferências
 * ------------------------------------------------------------------- */
function syncPrefInputs() {
  const p = readDrivePrefs();
  document.getElementById("prefVoice").checked = p.voice;
  document.getElementById("prefAwake").checked = p.keepAwake;
  document.getElementById("prefTolls").checked = p.avoidTolls;
}

function prefChange() {
  storeDrivePrefs({
    voice: document.getElementById("prefVoice").checked,
    keepAwake: document.getElementById("prefAwake").checked,
    avoidTolls: document.getElementById("prefTolls").checked,
  });
  if (nav.mode === "nav") driveKeepAwake(true);
  if (!readDrivePrefs().voice) driveShutUp();
  tobaSaved();
}

function testVoice() {
  if (!("speechSynthesis" in window)) {
    showPageMessage("Esse navegador não tem voz. No Chrome do Android tem.", { title: "Sem voz", icon: "🔇" });
    return;
  }
  if (!readDrivePrefs().voice) storeDrivePrefs({ voice: true });
  syncPrefInputs();
  driveSpeak("Em 300 metros, vire à direita. Nunca foi sorte, Cloba!");
}

/* ---------------------------------------------------------------------
 * Abertura
 * ------------------------------------------------------------------- */
function onDriveDataReplaced() {
  if (nav.mode === "pick") renderPick();
  else renderRoute();
}

tobaActions({
  searchSubmit,
  goResult,
  goRecent,
  goFav,
  goPlace,
  pickPlacesList,
  clearRecent,
  chooseOnMap,
  routeBack,
  retryRoute,
  startNav,
  endNav,
  recenter,
  toggleVoice,
  toggleMapStyle,
  toggleTraffic,
  openOut,
  openGoogleMaps,
  openWaze,
  favOpen,
  favEmojiPick,
  saveFav,
  deleteFav,
  prefChange,
  testVoice,
});

// Saiu da página no meio da viagem: guarda o que rodou
window.addEventListener("pagehide", () => {
  if (nav.mode === "nav") finishTrip(false);
});

(function initNavegar() {
  syncPrefInputs();
  if (tobaIsApp()) {
    const notice = document.getElementById("apkNotice");
    notice.hidden = false;
    notice.innerHTML = "📱 No app Toba (APK) o GPS ainda não tá liberado. Abre o Navegar pelo <b>Chrome</b> (ou pelo Toba instalado pelo Chrome) que funciona. O Maps/Waze do ↗️ funciona daqui mesmo.";
  }
  renderGpsStatus();
  // Já deu permissão antes? liga o GPS de cara pra ordenar por distância
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: "geolocation" }).then((st) => {
      if (st.state === "granted") startGps();
    }).catch(() => {});
  }
  const qs = new URLSearchParams(location.search);
  const lat = Number(qs.get("lat"));
  const lng = Number(qs.get("lng"));
  if (qs.get("lat") && qs.get("lng") && driveValidPoint({ lat, lng })) {
    setDestination({ name: qs.get("name") || "Destino", address: qs.get("address") || "", lat, lng, ...(qs.get("place") ? { placeId: qs.get("place") } : {}) });
  } else {
    setMode("pick");
  }
})();
