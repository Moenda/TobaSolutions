/* =====================================================================
 * Toba Drive · 🧭 tela do Toba Drive (desde v1.65; era navegar.js até a v1.82)
 * Telas (mesmo HTML):
 *   "pick"    escolher o destino (busca, ⭐ favoritos, 📌 Toba Places, recentes)
 *   "choose"  mapa: toca onde quer ir
 *   "preview" rota desenhada + resumo + 🚀 Partiu
 *   "nav"     navegando: faixa da manobra, voz, GPS seguindo, recálculo
 *   "done"    chegou (ou encerrou): resumo da viagem
 * GPS: navigator.geolocation.watchPosition (só com a página aberta: navegador
 * não deixa site usar GPS com a tela apagada, por isso a tela acesa).
 * Abrir já com destino: TobaDrive.html?lat=-23.5&lng=-46.6&name=Café
 * Só LÊ o TOBA_TURISM_DB (destinos do Toba Places); grava só o TOBA_DRIVE_DB.
 * v1.66: mora dentro do Toba Racing (‹ volta pro hub do Racing). Mapa e rota
 * do TomTom (assets/toba-maps.js + drive-route.js), 🚦 camada de trânsito e,
 * navegando com rota TomTom, confere o trânsito a cada DRIVE_TRAFFIC_CHECK_MS:
 * atualiza a chegada e troca de caminho se o novo poupar DRIVE_SWAP_SAVE_S+.
 * v1.67: 🎨 Personalizar (carango no lugar da seta + cor da rota; carangos
 * especiais destravam com as conquistas dv-* do Perfil) e viagem guarda etaS
 * (previsão no Partiu) pras conquistas de tempo. toba-player.js carregado aqui:
 * chegou, o Perfil confere as conquistas na hora.
 * v1.68: modo dirigir ULTRA em js/drive-game.js (visual de jogo, velocímetro,
 * copiloto, radar, fantasma, resumo, posto, Places). Aqui só os ganchos:
 * gameStart (Partiu), gameTick (navTick), gameTripExtras (finishTrip), gameStop.
 * v1.70: só Mapbox 3D; carango 3D/no chão grudado na linha da rota (nav.carView);
 * 🎨 abre até navegando (troca carango, cor e velocímetro no meio da rota);
 * 🚦 trânsito ao vivo da cidade (Mapbox Traffic) + lentidão real do TomTom.
 * v1.77 (pedidos da Milena): rota sobrevive ao celular bloqueado. A viagem em
 * andamento fica guardada em DRIVE_ACTIVE_KEY (localStorage, a cada ~5 s); se a
 * página reabrir (Android matou o app, tela bloqueou e recarregou) ela volta
 * sozinha com rota nova daqui até o destino, sem perder km nem o começo da
 * viagem. No APK 1.6+ o TobaNative.navKeepAlive liga um serviço em primeiro
 * plano + GPS nativo (onTobaNativeFix) e a voz nativa enquanto a tela está
 * apagada. 🏁 Cheguei só nos últimos DRIVE_ARRIVE_BTN_M. Bolinha de skin
 * (nextVehicle) ao lado do 3D/2D.
 * v1.78 (APK 1.7): rota junta com o Android Auto, estilo Waze. Começou rota no
 * carro? window.onTobaAutoRoute chega aqui e o celular segue a mesma rota (e o
 * inverso: o Partiu daqui manda pro carro por TobaNative.autoRoute). Com o carro
 * navegando, quem fala é o carro (driveSpeak fica mudo, driveAutoNavigating).
 * ===================================================================== */
const DRIVE_FAV_EMOJIS = ["🏠", "💼", "❤️", "☕", "🏋️", "🛒", "🍻", "🐾", "⭐"];
const DRIVE_GPS_TIMEOUT_MS = 20000;
const DRIVE_ARRIVE_M = 35;
// v1.73: 🏁 Cheguei aparecia faltando 1,5 km; v1.77: só no finalzinho (Milena: "aparece muito antes")
const DRIVE_ARRIVE_BTN_M = 250;
// v1.77: viagem em andamento (pra voltar depois que o celular bloqueia / o app recarrega)
const DRIVE_ACTIVE_KEY = "toba_drive_active";
const DRIVE_ACTIVE_SAVE_MS = 5000;
const DRIVE_RESUME_MAX_MS = 3 * 60 * 60 * 1000; // mais velha que 3 h = viagem encerrada (guarda o que rodou)
const DRIVE_GPS_STALE_MS = 12000;
const DRIVE_TRAFFIC_CHECK_MS = 5 * 60 * 1000;
const DRIVE_SWAP_SAVE_S = 180;

const nav = {
  mode: "pick",
  dest: null, // { name, address, lat, lng, placeId? }
  route: null,
  routeId: 0,
  pos: null, // { lat, lng, acc, speed (m/s), heading, at }
  posAt: 0, // v1.77: relógio do aparelho na última leitura (pra saber se o GPS travou)
  activeSavedAt: 0, // v1.77: última vez que a viagem foi pro DRIVE_ACTIVE_KEY
  watchId: null,
  gpsError: "",
  seg: 0,
  along: 0,
  offCount: 0,
  lastReroute: 0,
  rerouting: false,
  spoken: {},
  follow: true,
  map: null, // v1.69: objeto do drive-map.js (Mapbox 3D), nunca mapboxgl.* direto
  carView: null, // v1.70: onde o carango aparece { lat, lng, heading } (grudado na rota navegando)
  mapPromise: null,
  lastTrafficCheck: 0,
  trip: null, // { startedAt, km, last: [lat, lng] }
  result: null, // resumo do "done"
  placesListId: "",
  resuming: null, // v1.77: viagem guardada esperando rota nova (DRIVE_ACTIVE_KEY)
  searchSeq: 0,
  waiters: [],
  favEmoji: "⭐",
  autoQuiet: false, // v1.78: mudança que veio do Android Auto (não manda de volta pro carro)
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
    nav.gpsError = tobaIsApp()
      ? "Sem permissão de localização. No celular: Configurações › Apps › Toba › Permissões › Localização › Permitir durante o uso."
      : "Sem permissão de localização. Libera no cadeado da barra de endereço (Chrome › Permissões › Local).";
    if (nav.watchId !== null) navigator.geolocation.clearWatch(nav.watchId);
    nav.watchId = null;
  } else if (!nav.pos) {
    nav.gpsError = "Procurando o GPS... (céu aberto ajuda)";
  }
  nav.waiters.splice(0).forEach((w) => w(null));
  renderGpsStatus();
}

// v1.77: GPS nativo do APK (tela apagada: o WebView não entrega GPS pra página escondida)
window.onTobaNativeFix = function onTobaNativeFix(f) {
  if (!f || !Number.isFinite(Number(f.lat)) || !Number.isFinite(Number(f.lng))) return;
  // com a página na tela o GPS do próprio WebView já chega: o nativo só cobre a tela apagada
  if (!document.hidden && nav.pos && Date.now() - nav.posAt < DRIVE_GPS_STALE_MS) return;
  const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  onFix({
    coords: { latitude: Number(f.lat), longitude: Number(f.lng), accuracy: num(f.acc) ?? 30, speed: num(f.speed), heading: num(f.heading) },
    timestamp: num(f.at) || Date.now(),
  });
};

// v1.77: voltou pra tela (desbloqueou o celular): GPS parado há tempo = liga de novo
function wakeGps() {
  if (!nav.watchId && nav.watchId !== 0) {
    startGps();
    return;
  }
  if (nav.posAt && Date.now() - nav.posAt > DRIVE_GPS_STALE_MS) {
    try {
      navigator.geolocation.clearWatch(nav.watchId);
    } catch (err) {
      /* já parado */
    }
    nav.watchId = null;
    startGps();
  }
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
  nav.posAt = Date.now();
  nav.gpsError = "";
  nav.waiters.splice(0).forEach((w) => w(nav.pos));
  renderGpsStatus();
  drawCar();
  if (nav.mode === "nav") navTick();
  // v1.83: popup do Places aberto e chegou o 1º GPS -> mostra as distâncias
  if (!prev && document.getElementById("placesSheet")?.classList.contains("active")) renderPlacesSheet();
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
  if (typeof renderFuelBanner === "function") renderFuelBanner();
  // ⭐ Favoritos
  const favs = driveDb.favorites;
  document.getElementById("favChips").innerHTML = favs.length
    ? favs.map((f) => chip(`${escapeHtml(f.emoji)} ${escapeHtml(f.name)}`, "goFav", { id: f.id })).join("")
    : `<span class="dv-hint">Escolhe um destino e toca em ⭐ pra deixar aqui (🏠 Casa, 💼 Trampo...).</span>`;

  // 📌 Toba Places (v1.83): um card por lista; tocar abre o popup com os lugares
  const t = readTurismForDrive();
  const lists = t.lists.filter((l) => t.places.some((p) => String(p.listId) === String(l.id)));
  document.getElementById("placesTitle").hidden = !lists.length;
  document.getElementById("placesLists").innerHTML = lists.map((l) => {
    const mine = t.places.filter((p) => String(p.listId) === String(l.id));
    const been = mine.filter((p) => p.status === "been").length;
    const want = mine.length - been;
    const sub = [want ? `📌 ${want} pra ir` : "", been ? `✅ ${been}` : "", l.city ? escapeHtml(l.city) : ""].filter(Boolean).join(" · ");
    return `<button type="button" class="dv-pl-card" data-click="openPlacesList" data-id="${escapeHtml(String(l.id))}">
      <span class="dv-pl-emoji">${escapeHtml(l.emoji || "📍")}</span>
      <span class="dv-pl-text"><b>${escapeHtml(l.name)}</b><small>${sub}</small></span>
      <span class="dv-pl-count">${mine.length}</span>
    </button>`;
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

// 📌 Popup de uma lista do Toba Places (v1.83): quero ir primeiro (mais perto em cima
// quando tem GPS), depois os que já foi. Tocar no lugar = rota.
function drivePlaceRow(p) {
  const pin = drivePlacePin(p);
  const icon = (typeof turismKind === "function" && turismKind(p.kind)?.icon) || "📍";
  const where = p.region || p.address || "";
  const rating = p.status === "been" && typeof turismRating === "function" ? turismRating(p.rating) : null;
  const note = rating ? `${rating.icon} ${escapeHtml(rating.label)}` : "";
  const right = !pin ? "🔎" : nav.pos ? driveFormatDist(driveDist([nav.pos.lat, nav.pos.lng], [pin.lat, pin.lng])) : "›";
  return `<div class="toba-list-item dv-pl-place${p.status === "been" ? " is-been" : ""}" role="button" tabindex="0" data-click="goPlace" data-id="${escapeHtml(String(p.id))}">
      <span class="dv-pl-kind">${icon}</span>
      <span class="dv-item-text"><b>${escapeHtml(p.name)}</b>${where || note ? `<small>${[escapeHtml(where), note].filter(Boolean).join(" · ")}</small>` : ""}</span>
      <span class="dv-item-km">${right}</span>
    </div>`;
}

function renderPlacesSheet() {
  const t = readTurismForDrive();
  const list = t.lists.find((l) => String(l.id) === nav.placesListId);
  if (!list) return false;
  const mine = t.places.filter((p) => String(p.listId) === String(list.id));
  const distOf = (p) => {
    const pin = drivePlacePin(p);
    return pin && nav.pos ? driveDist([nav.pos.lat, nav.pos.lng], [pin.lat, pin.lng]) : Infinity;
  };
  const byNear = (a, b) => distOf(a) - distOf(b) || String(a.name).localeCompare(String(b.name));
  const want = mine.filter((p) => p.status !== "been").sort(byNear);
  const been = mine.filter((p) => p.status === "been").sort(byNear);
  document.getElementById("placesSheetTitle").textContent = `${list.emoji || "📍"} ${list.name}`;
  document.getElementById("placesSheetSub").textContent = [list.city, `${mine.length} ${mine.length === 1 ? "lugar" : "lugares"}`].filter(Boolean).join(" · ");
  document.getElementById("placesSheetBody").innerHTML =
    (want.length ? `<div class="section-title">📌 Quero ir</div><div class="toba-list">${want.map(drivePlaceRow).join("")}</div>` : "")
    + (been.length ? `<div class="section-title">✅ Já fui</div><div class="toba-list">${been.map(drivePlaceRow).join("")}</div>` : "")
    + `<p class="dv-hint">Toca no lugar e o Toba Drive já traça a rota 🏁. 🔎 = sem pino no Places, aí eu procuro pelo nome.</p>`;
  return true;
}

function openPlacesList(el) {
  nav.placesListId = String(el.dataset.id);
  startGps(); // pra mostrar a distância de cada lugar
  if (renderPlacesSheet()) openTobaModal("placesSheet");
}

function goPlace(el) {
  const t = readTurismForDrive();
  const p = t.places.find((x) => String(x.id) === String(el.dataset.id));
  if (!p) return;
  closeTobaModal("placesSheet");
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
  if (nav.map) return nav.map;
  if (!nav.mapPromise) {
    nav.mapPromise = (async () => {
      const box = document.getElementById("driveMap");
      box.innerHTML = "";
      const start = nav.pos ? [nav.pos.lat, nav.pos.lng] : [-23.5505, -46.6333];
      const map = await driveCreateMap(box, start, nav.pos ? 15 : 12);
      map.onClick(onMapClick);
      map.onDragStart(() => {
        if (nav.mode !== "nav") return;
        nav.follow = false;
        document.getElementById("recenterBtn").hidden = false;
        if (typeof gameApplyView === "function") gameApplyView();
      });
      nav.map = map;
      renderStyleBtn();
      renderTrafficBtn();
      return map;
    })().catch((err) => {
      nav.mapPromise = null;
      throw err;
    });
  }
  return nav.mapPromise;
}

// v1.70: o carango mora dentro do mapa (modelo 3D ou emoji no chão). Navegando e
// perto da linha (até 25 m ou a precisão do GPS), ele anda EM CIMA da rota, virado
// pro sentido dela: some aquele carango flutuando no meio do quarteirão.
function drawCar() {
  if (!nav.pos) return;
  let ll = [nav.pos.lat, nav.pos.lng];
  let heading = nav.pos.heading;
  const r = nav.route;
  if (nav.mode === "nav" && r && !nav.rerouting) {
    const loc = driveLocateOnRoute(r, ll, nav.seg);
    if (loc && loc.dist <= Math.max(25, Math.min(nav.pos.acc, 45))) {
      const p = drivePointAlong(r, loc.seg, loc.along);
      if (p) {
        ll = p;
        // parado a bússola pula: usa o sentido da rota; andando também (é o que o motorista vê)
        heading = driveBearing(r.coords[loc.seg], r.coords[loc.seg + 1]);
      }
    }
  }
  nav.carView = { lat: ll[0], lng: ll[1], heading };
  if (nav.map) nav.map.car(ll, heading, currentVehicle(), currentRouteColor(), nav.mode === "nav");
}

// Trechos lentos/parados da rota TomTom (amarelo = lento, vermelho = parado)
function routeJamParts(route) {
  return (route.jams || []).map((j) => ({
    coords: route.coords.slice(j.from, j.to + 1),
    color: j.level >= 4 ? "#7f1d1d" : j.level >= 3 ? "#ef4444" : j.level >= 2 ? "#f97316" : "#facc15",
  })).filter((j) => j.coords.length > 1);
}

function drawRoute() {
  if (!nav.map) return;
  nav.map.clearMarks();
  nav.map.setRoute(nav.route ? nav.route.coords : null, currentRouteColor(), nav.route ? routeJamParts(nav.route) : []);
  if (nav.dest) {
    nav.map.addMark([nav.dest.lat, nav.dest.lng], `<span class="dv-flag">🏁</span>`, { className: "dv-flag-wrap", size: [32, 32], anchor: [8, 30] });
  }
}

function fitRoute() {
  if (!nav.map) return;
  const pts = nav.route ? nav.route.coords : [];
  if (pts.length > 1) {
    nav.map.fit(pts, { top: 80, left: 30, right: 30, bottom: 230 });
  } else if (nav.dest) {
    nav.map.setView([nav.dest.lat, nav.dest.lng], 16);
  }
}

// 🌗 roda as luzes do mapa (auto, amanhecer, dia, pôr do sol, noite)
function toggleMapStyle() {
  const ids = DRIVE_LIGHTS.map((l) => l.id);
  setMapLight(ids[(ids.indexOf(readDrivePrefs().mapLight) + 1) % ids.length]);
}

// v1.71: também escolhida direto no 🎨 (dá pra trocar navegando)
function pickLight(el) {
  setMapLight(el.dataset.id);
  renderStyleSheet();
}

function setMapLight(next) {
  storeDrivePrefs({ mapLight: next });
  const at = nav.pos ? [nav.pos.lat, nav.pos.lng] : null;
  if (nav.map) nav.map.setLook(driveMapLook(at));
  const info = driveLightInfo(next);
  tobaToast(`${info.icon} ${info.name}`);
  if (typeof game !== "undefined") game.dark = null; // o modo jogo recalcula a luz
  renderStyleBtn();
}

function renderStyleBtn() {
  const btn = document.getElementById("styleBtn");
  if (!btn) return;
  const info = driveLightInfo(readDrivePrefs().mapLight);
  btn.textContent = info.icon;
  btn.setAttribute("aria-label", `Luz do mapa: ${info.name}`);
}

/* ---------------------------------------------------------------------
 * 🎨 Personalizar (v1.67): carango e cor da rota
 * ------------------------------------------------------------------- */
function driveStatsNow() {
  return calcDrivePlayer(driveDb, toIsoDate(new Date())).stats;
}

function currentVehicle() {
  const v = driveVehicle(readDrivePrefs().vehicle);
  return driveVehicleUnlocked(v, driveStatsNow()) ? v : DRIVE_VEHICLES[0];
}

function currentSpeedo() {
  const v = driveSpeedo(readDrivePrefs().speedo);
  return driveVehicleUnlocked(v, driveStatsNow()) ? v : DRIVE_SPEEDOS[0];
}

function currentRouteColor() {
  const id = readDrivePrefs().routeColor;
  return (DRIVE_ROUTE_COLORS.find((c) => c.id === id) || DRIVE_ROUTE_COLORS[0]).color;
}

function driveAchievementInfo(id) {
  const a = typeof PLAYER_ACHIEVEMENTS !== "undefined" ? PLAYER_ACHIEVEMENTS.find((x) => x.id === id) : null;
  return a ? `${a.icon} ${a.name}: ${a.hint}` : "uma conquista do Toba Drive";
}

function renderStyleSheet() {
  const stats = driveStatsNow();
  const cur = currentVehicle().id;
  document.getElementById("vehicleChips").innerHTML = DRIVE_VEHICLES.map((v) => {
    const open = driveVehicleUnlocked(v, stats);
    return `<button type="button" class="dv-veh-pick${v.id === cur ? " is-on" : ""}${open ? "" : " is-locked"}" data-click="pickVehicle" data-id="${v.id}" aria-label="${escapeHtml(v.name)}">
      <span class="dv-veh-pick-icon">${open ? v.icon : "🔒"}</span>
      <span class="dv-veh-pick-name">${escapeHtml(v.name)}</span>
    </button>`;
  }).join("");
  const curLight = readDrivePrefs().mapLight;
  document.getElementById("lightChips").innerHTML = DRIVE_LIGHTS.map((l) =>
    chip(`${l.icon} ${escapeHtml(l.id === "auto" ? "Auto" : l.name)}`, "pickLight", { id: l.id }, l.id === curLight ? " is-on" : "")).join("");
  const curColor = readDrivePrefs().routeColor;
  document.getElementById("routeColorChips").innerHTML = DRIVE_ROUTE_COLORS.map((c) =>
    `<button type="button" class="dv-color${c.id === curColor ? " is-on" : ""}" data-click="pickRouteColor" data-id="${c.id}" style="--c: ${c.color}" aria-label="${escapeHtml(c.name)}"></button>`).join("");
  const got = DRIVE_VEHICLES.filter((v) => driveVehicleUnlocked(v, stats)).length;
  document.getElementById("vehicleCount").textContent = `${got}/${DRIVE_VEHICLES.length}`;
  // 🏁 velocímetros (v1.70): miniatura com a própria skin
  const curSp = currentSpeedo().id;
  document.getElementById("speedoChips").innerHTML = DRIVE_SPEEDOS.map((v) => {
    const open = driveVehicleUnlocked(v, stats);
    return `<button type="button" class="dv-sp-pick${v.id === curSp ? " is-on" : ""}${open ? "" : " is-locked"}" data-click="pickSpeedo" data-id="${v.id}" aria-label="${escapeHtml(v.name)}">
      <span class="dv-speedo dv-sp-mini dv-sp-${v.id}" style="--p: 0.62"><span class="dv-speedo-dial"><b>${open ? "88" : "🔒"}</b><small>km/h</small></span></span>
      <span class="dv-veh-pick-name">${escapeHtml(v.name)}</span>
    </button>`;
  }).join("");
  const gotSp = DRIVE_SPEEDOS.filter((v) => driveVehicleUnlocked(v, stats)).length;
  document.getElementById("speedoCount").textContent = `${gotSp}/${DRIVE_SPEEDOS.length}`;
}

function openStyleSheet() {
  renderStyleSheet();
  openTobaModal("styleSheet");
}

function pickVehicle(el) {
  const v = driveVehicle(el.dataset.id);
  if (!driveVehicleUnlocked(v, driveStatsNow())) {
    showPageMessage(`O ${v.icon} ${v.name} destrava com a conquista ${driveAchievementInfo(v.achievement)}`, { title: "Ainda trancado", icon: "🔒" });
    return;
  }
  storeDrivePrefs({ vehicle: v.id });
  renderStyleSheet();
  drawCar();
  renderPickVehicle();
  tobaToast(`${v.icon} ${v.name} na pista!`);
}

function pickRouteColor(el) {
  storeDrivePrefs({ routeColor: el.dataset.id });
  renderStyleSheet();
  drawRoute();
  drawCar(); // a seta é pintada na cor da rota
}

function pickSpeedo(el) {
  const v = driveSpeedo(el.dataset.id);
  if (!driveVehicleUnlocked(v, driveStatsNow())) {
    showPageMessage(`O velocímetro ${v.icon} ${v.name} destrava com a conquista ${driveAchievementInfo(v.achievement)}`, { title: "Ainda trancado", icon: "🔒" });
    return;
  }
  storeDrivePrefs({ speedo: v.id });
  renderStyleSheet();
  if (typeof renderSpeedo === "function" && nav.mode === "nav") renderSpeedo(...(game.speedoArgs || []));
  tobaToast(`${v.icon} Velocímetro ${v.name}!`);
}

function renderPickVehicle() {
  const btn = document.getElementById("styleOpenBtn");
  if (btn) btn.textContent = `🎨 Personalizar · ${currentVehicle().icon}`;
  const skin = document.getElementById("skinBtn");
  if (skin) {
    const v = currentVehicle();
    skin.textContent = v.icon;
    skin.setAttribute("aria-label", `Carango: ${v.name}. Toca pra trocar`);
  }
}

// v1.77: bolinha da skin (igual o 3D/2D): pula pro próximo carango destravado
function nextVehicle() {
  const stats = driveStatsNow();
  const open = DRIVE_VEHICLES.filter((v) => driveVehicleUnlocked(v, stats));
  const at = open.findIndex((v) => v.id === currentVehicle().id);
  const v = open[(at + 1) % open.length] || DRIVE_VEHICLES[0];
  storeDrivePrefs({ vehicle: v.id });
  drawCar();
  renderPickVehicle();
  tobaToast(`${v.icon} ${v.name}`);
}

// 🚦 trânsito ao vivo: ruas lentas/paradas da cidade (Mapbox Traffic) + trechos parados da rota (TomTom)
function toggleTraffic() {
  const on = !readDrivePrefs().traffic;
  storeDrivePrefs({ traffic: on });
  if (nav.map) nav.map.setTraffic(on);
  renderTrafficBtn();
  tobaToast(on ? "🚦 Trânsito ao vivo ligado" : "🚦 Trânsito desligado");
}

function renderTrafficBtn() {
  const on = readDrivePrefs().traffic;
  document.querySelectorAll("[data-click='toggleTraffic']").forEach((btn) => {
    btn.classList.toggle("is-off", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

// "TomTom · trânsito ao vivo" ou o plano B
function routeSourceLine(r) {
  if (r.provider === "tomtom") {
    const late = Math.round((r.trafficDelay || 0) / 60);
    if (late >= 2) return `🚦 Trânsito ao vivo: +${late} min de lentidão no caminho`;
    return late >= 1 ? "🚦 Trânsito ao vivo: quase livre (+1 min)" : "🚦 Trânsito ao vivo: caminho livre";
  }
  return "🗺️ Rota do OpenStreetMap (sem trânsito ao vivo)";
}

async function onMapClick(ev) {
  if (nav.mode !== "choose") return;
  const { lat, lng } = ev;
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
  const wasNav = nav.mode === "nav";
  nav.mode = mode;
  if (wasNav && mode !== "nav" && typeof gameStop === "function") gameStop();
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
    const why = err?.why === "webgl"
      ? ["🧱", "Esse navegador não abre mapa 3D", "Atualiza o Chrome (ou liga a aceleração de hardware). A voz e a faixa da manobra funcionam igual; o ↗️ abre no Maps/Waze."]
      : navigator.onLine === false
        ? ["📡", "Mapa sem internet", "O mapa precisa de internet. A voz segue funcionando; dá pra ir pelo Google Maps/Waze no ↗️."]
        : ["😵", "O mapa não abriu", "O Mapbox não respondeu agora. Volta e tenta de novo; a voz segue funcionando e o ↗️ abre no Maps/Waze."];
    document.getElementById("driveMap").innerHTML = tobaEmpty(why[0], why[1], why[2], { compact: true });
  }
  setTimeout(() => nav.map && nav.map.resize(), 60);
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
  // v1.77: desistiu da viagem que tinha voltado: guarda o que rodou e esquece
  if (nav.resuming) {
    closeActiveTrip(nav.resuming);
    nav.resuming = null;
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
  if (nav.favMode) favOpen(); // v2.02: veio pra favoritar
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

// Linha do "fim da viagem": previsto x feito (DANDANDAN MAX TOBASTEN = 10%+ antes)
function doneTimeLine(r) {
  if (!r.arrived || r.ahead === null || r.ahead === undefined) return "";
  const pct = Math.round(Math.abs(r.ahead) * 100);
  const plan = `previsto ${driveFormatDuration(r.etaS)}, fez em ${driveFormatDuration(r.s)}`;
  if (r.ahead >= 1 - DRIVE_TOBASTEN_RATIO) return `<div class="dv-tobasten"><b>⚡ DANDANDAN MAX TOBASTEN!</b><span>${pct}% antes do previsto · ${plan}</span></div>`;
  if (Math.abs(r.ahead) <= DRIVE_SWISS_MARGIN) return `<div class="dv-timeline">⏱️ Relógio suíço: ${plan}</div>`;
  return `<div class="dv-timeline">${r.ahead > 0 ? `🏁 ${pct}% antes` : `🐢 ${pct}% depois`} do previsto · ${plan}</div>`;
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
  renderStyleBtn();
  document.getElementById("voiceBtn").textContent = readDrivePrefs().voice ? "🔊" : "🔇";
  renderTrafficBtn();
  requestAnimationFrame(driveMapLiftControls); // logo do Mapbox sempre à vista, acima do card
  const isNav = nav.mode === "nav";
  banner.hidden = !isNav;
  panel.hidden = !isNav;
  if (!isNav) renderArriveBtn(Infinity);
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
      ${doneTimeLine(r)}
      ${gameDoneExtra(r)}
      ${r.arrived ? `<div class="dv-quote">Nunca foi sorte, Cloba. Nunca foi sorte. 🙏</div>` : ""}
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-grow-1" data-click="favOpen">${isFavorite(nav.dest) ? "⭐ Favorito" : "☆ Favoritar"}</button>
        <button type="button" class="btn btn-outline btn-grow-1" data-click="shareTrip">📤 Tropa</button>
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
// resumed (v1.77) = viagem que voltou depois do celular bloquear: segue a mesma
// viagem (começo, km, caminho), só com rota nova daqui
function startNav(resumed = null) {
  if (!nav.route || !nav.pos) return;
  nav.seg = 0;
  nav.along = 0;
  nav.offCount = 0;
  nav.spoken = {};
  nav.follow = true;
  // (o data-click passa o botão aqui: Partiu numa viagem que voltou sem rota usa nav.resuming)
  const back = resumed && resumed.trip ? resumed : nav.resuming;
  nav.resuming = null;
  const trip = back && back.trip ? back.trip : null;
  nav.trip = trip
    ? { ...trip, last: [nav.pos.lat, nav.pos.lng], resumed: true, lastTick: 0 }
    : { startedAt: Date.now(), m: 0, last: [nav.pos.lat, nav.pos.lng] };
  nav.lastTrafficCheck = Date.now();
  if (!trip) nav.trip.etaS = Math.round(nav.route.duration || 0); // previsão no Partiu (conquistas de tempo)
  driveKeepAwake(true);
  driveNativeKeepAlive(true);
  if (!nav.autoQuiet) driveAutoShare(nav.dest); // v1.78: o carro acompanha
  saveActiveTrip(true);
  setMode("nav").then(() => {
    gameStart();
    if (nav.map) nav.map.setView([nav.pos.lat, nav.pos.lng], 17);
    drawCar(); // v1.77: carango já na pista (sem esperar a próxima leitura do GPS)
    if (trip) {
      const eta = driveFormatClock(Date.now() + nav.route.duration * 1000);
      driveSpeak(`Voltei! Seguindo pra ${nav.dest?.name || "o destino"}. Chegada às ${eta.replace(":", " e ")}.`);
      tobaToast("🔄 Rota de volta, piloto!");
      navTick();
      return;
    }
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
  gameTick(next, left, total);
  saveActiveTrip();

  if (nav.follow && nav.map) {
    const z = pos.speed > 22 ? 15 : pos.speed > 12 ? 16 : 17;
    const at = nav.carView ? [nav.carView.lat, nav.carView.lng] : here;
    nav.map.setView(at, Math.max(z, Math.min(nav.map.getZoom(), 18)), { animate: true });
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
  renderArriveBtn(left);
}

// v1.73: 🏁 Cheguei (estacionou na rua do lado) aparece faltando até DRIVE_ARRIVE_BTN_M;
// aí o Encerrar encolhe pra "✕"
function renderArriveBtn(left) {
  const near = nav.mode === "nav" && Number.isFinite(left) && left <= DRIVE_ARRIVE_BTN_M;
  const btn = document.getElementById("arriveBtn");
  const end = document.getElementById("endBtn");
  if (!btn || !end || btn.hidden === !near) return;
  btn.hidden = !near;
  end.classList.toggle("is-compact", near);
  end.textContent = near ? "✕" : "✕ Encerrar";
  end.setAttribute("aria-label", "Encerrar sem chegar");
}

// conta igual a chegada de verdade (histórico, conquistas, "Já fui" do Places)
function arriveHere() {
  if (nav.mode !== "nav") return;
  driveShutUp();
  arrive();
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
    gameLoadRadars(route);
    setTimeout(() => gameJoke("reroute"), 2500);
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
    gameLoadRadars(fresh);
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
  clearActiveTrip();
  driveKeepAwake(false);
  driveNativeKeepAlive(false);
  // v1.78: parou aqui (✕ Encerrar)? o carro para junto. Chegou: o carro chega sozinho.
  if (!arrived && !nav.autoQuiet) driveAutoShare(null);
  if (!trip) return { arrived, m: 0, s: 0 };
  const s = (Date.now() - trip.startedAt) / 1000;
  nav.trip = trip; // gameTripExtras lê daqui
  const extras = gameTripExtras(arrived, s);
  nav.trip = null;
  let tripId = "";
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
      etaS: trip.etaS || 0,
      ...extras,
    });
    tripId = driveDb.trips[driveDb.trips.length - 1]?.id || "";
    // Perfil confere as conquistas dv-* na hora (toba-player.js nesta página)
    if (typeof tobaPlayerCheck === "function") tobaPlayerCheck({ reason: "drive" });
  }
  const ahead = arrived ? driveTripAhead({ etaS: trip.etaS, startedAt: trip.startedAt, endedAt: Date.now() }) : null;
  const placeId = extras.placeId || "";
  return {
    arrived, m: trip.m, s, etaS: trip.etaS || 0, ahead, tripId,
    avgKmh: s > 60 ? Math.round((trip.m / 1000) / (s / 3600)) : 0,
    maxKmh: extras.maxKmh || 0,
    path: trip.path || [],
    ghost: arrived ? game.ghost : null,
    placeId,
    placeWant: Boolean(placeId) && readPlaceStatus(placeId) !== "been",
    unlocked: tripId ? gameNewAchievements() : [],
  };
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
  if (typeof gameApplyView === "function") gameApplyView();
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

// v2.02: modo favoritar (veio do ➕ do hub): faixa em cima e, com o destino escolhido, abre o ⭐ sozinho
function renderFavMode() {
  const el = document.getElementById("favModeBanner");
  if (el) el.hidden = !nav.favMode;
}

function cancelFavMode() {
  nav.favMode = false;
  renderFavMode();
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
  if (nav.favMode) {
    // voltou pro ⭐ Favoritos do hub, já com o novo na lista
    nav.favMode = false;
    window.location.href = "../TobaRacing-Index.html#favs";
    return;
  }
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
  document.getElementById("prefCopilot").checked = p.copilot;
  document.getElementById("prefGame").checked = p.gameView;
}

function prefChange() {
  storeDrivePrefs({
    voice: document.getElementById("prefVoice").checked,
    keepAwake: document.getElementById("prefAwake").checked,
    avoidTolls: document.getElementById("prefTolls").checked,
    copilot: document.getElementById("prefCopilot").checked,
    gameView: document.getElementById("prefGame").checked,
  });
  if (typeof gameApplyView === "function" && nav.mode === "nav") gameApplyView();
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
  cancelFavMode,
  searchSubmit,
  goResult,
  goRecent,
  goFav,
  goPlace,
  openPlacesList,
  clearRecent,
  chooseOnMap,
  routeBack,
  retryRoute,
  startNav,
  endNav,
  arriveHere,
  nextVehicle,
  recenter,
  toggleVoice,
  toggleMapStyle,
  toggleTraffic,
  openStyleSheet,
  pickVehicle,
  pickRouteColor,
  pickSpeedo,
  pickLight,
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

// Saiu da página no meio da viagem: até a v1.76 encerrava a viagem aqui (e a rota
// sumia quando o Android recarregava o app com a tela bloqueada). v1.77: só guarda
// onde parou; abrindo de novo, a rota volta (resumeActiveTrip).
window.addEventListener("pagehide", () => {
  if (nav.mode === "nav") saveActiveTrip(true);
});

// v1.77: tela de volta (desbloqueou): GPS de novo, guarda a viagem e redesenha
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (nav.mode === "nav") saveActiveTrip(true);
    return;
  }
  if (nav.mode !== "nav") return;
  wakeGps();
  driveKeepAwake(true);
  setTimeout(() => {
    if (nav.mode !== "nav") return;
    nav.map?.resize();
    drawCar();
    navTick();
  }, 300);
});

/* ---------------------------------------------------------------------
 * v1.77: viagem em andamento guardada (sobrevive ao app recarregar)
 * Só o necessário: destino, começo, km, caminho e os números do modo jogo.
 * Nunca entra no TOBA_DRIVE_DB (lá só vai a viagem terminada, pelo finishTrip).
 * ------------------------------------------------------------------- */
function saveActiveTrip(force = false) {
  if (nav.mode !== "nav" && !force) return;
  if (!nav.trip || !nav.dest) return;
  if (!force && Date.now() - nav.activeSavedAt < DRIVE_ACTIVE_SAVE_MS) return;
  nav.activeSavedAt = Date.now();
  const t = nav.trip;
  const keep = { ...t };
  delete keep.lastTick;
  delete keep.resumed;
  if (Array.isArray(keep.path) && keep.path.length > 4000) keep.path = keep.path.slice(-4000);
  try {
    localStorage.setItem(DRIVE_ACTIVE_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), dest: nav.dest, trip: keep }));
  } catch (err) {
    /* storage cheio: segue sem salvar */
  }
}

function readActiveTrip() {
  try {
    const a = JSON.parse(localStorage.getItem(DRIVE_ACTIVE_KEY) || "null");
    if (!a || !a.dest || !a.trip || !driveValidPoint({ lat: Number(a.dest.lat), lng: Number(a.dest.lng) })) return null;
    if (!Number.isFinite(Number(a.trip.startedAt))) return null;
    return a;
  } catch (err) {
    return null;
  }
}

function clearActiveTrip() {
  try {
    localStorage.removeItem(DRIVE_ACTIVE_KEY);
  } catch (err) {
    /* nada */
  }
}

// Viagem guardada que não vai voltar (velha ou trocou de destino): entra no
// histórico como "encerrada" com os km que rodou, igual o ✕ Encerrar
function closeActiveTrip(a) {
  clearActiveTrip();
  const t = a.trip;
  if (!t || !(Number(t.m) >= 300)) return;
  const endedAt = Math.min(Date.now(), Number(a.savedAt) || Date.now());
  driveAddTrip({
    date: toIsoDate(new Date(Number(t.startedAt))),
    startedAt: Number(t.startedAt),
    endedAt,
    name: a.dest.name || "Destino",
    lat: Number(a.dest.lat),
    lng: Number(a.dest.lng),
    km: Math.round(Number(t.m) / 100) / 10,
    arrived: false,
    etaS: Number(t.etaS) || 0,
    ...(Number.isFinite(Number(t.startLat)) ? { startLat: Math.round(t.startLat * 1e6) / 1e6, startLng: Math.round(t.startLng * 1e6) / 1e6 } : {}),
    maxKmh: Math.round(Number(t.maxKmh) || 0),
    radars: Number(t.radars) || 0,
    ...(t.placeId ? { placeId: String(t.placeId) } : {}),
  });
  if (typeof tobaPlayerCheck === "function") tobaPlayerCheck({ reason: "drive" });
}

// Abriu a página com viagem guardada: volta pra rota (rota nova daqui até o destino)
async function resumeActiveTrip(a) {
  nav.dest = { ...a.dest, lat: Number(a.dest.lat), lng: Number(a.dest.lng) };
  nav.route = null;
  nav.routeError = "";
  nav.loading = true;
  nav.resuming = a;
  await setMode("preview");
  drawRoute();
  const target = nav.dest;
  const pos = await waitForFix(20000);
  if (nav.dest !== target) return;
  try {
    if (!pos) throw new Error("sem gps");
    const route = await driveFetchRoute(pos, target, { heading: pos.heading, speed: pos.speed });
    if (nav.dest !== target) return;
    nav.route = route;
    nav.routeId += 1;
    nav.loading = false;
    nav.resuming = null;
    drawRoute();
    startNav(a);
  } catch (err) {
    // sem GPS ou sem rota: fica na prévia (🚀 Partiu continua a MESMA viagem)
    nav.loading = false;
    nav.routeError = !pos ? nav.gpsError || "Não achei tua posição no GPS." : navigator.onLine === false ? "Sem internet pra montar a rota." : "O servidor de rotas não respondeu. Tenta de novo ou vai pelo Maps/Waze.";
    renderRoute();
  }
}

// v1.77: APK 1.6+ segura o GPS e a voz com a tela apagada (serviço em primeiro plano)
function driveNativeKeepAlive(on) {
  if (!TOBA_NATIVE || typeof TOBA_NATIVE.navKeepAlive !== "function") return;
  try {
    TOBA_NATIVE.navKeepAlive(Boolean(on), on ? `Indo pra ${nav.dest?.name || "o destino"}` : "");
  } catch (err) {
    /* APK sem a ponte: segue só com a tela acesa */
  }
}

/* ---------------------------------------------------------------------
 * v1.78 (APK 1.7): rota junta com o Android Auto (DriveSync.java)
 * Nada novo no localStorage: o carro guarda a rota dele no app.
 * ------------------------------------------------------------------- */
function driveAutoShare(dest) {
  if (!TOBA_NATIVE || typeof TOBA_NATIVE.autoRoute !== "function") return;
  try {
    TOBA_NATIVE.autoRoute(dest ? JSON.stringify({ name: dest.name || "Destino", address: dest.address || "", lat: Number(dest.lat), lng: Number(dest.lng) }) : "");
  } catch (err) {
    /* APK sem a ponte nova: cada um na sua */
  }
}

// Rota que o carro está fazendo agora ({ name, address, lat, lng }) ou null
function driveAutoRouteNow() {
  if (!TOBA_NATIVE || typeof TOBA_NATIVE.autoRouteNow !== "function") return null;
  try {
    const d = JSON.parse(TOBA_NATIVE.autoRouteNow() || "null");
    return d && driveValidPoint({ lat: Number(d.lat), lng: Number(d.lng) }) ? d : null;
  } catch (err) {
    return null;
  }
}

// Carro navegando = a voz sai no carro (driveSpeak do celular fica mudo)
function driveAutoNavigating() {
  return Boolean(driveAutoRouteNow());
}

function driveSameDest(a, b) {
  return Boolean(a && b) && driveDist([Number(a.lat), Number(a.lng)], [Number(b.lat), Number(b.lng)]) < 80;
}

// O carro começou rota: o celular segue a mesma (prévia rapidinha e Partiu sozinho)
async function driveFollowAuto(d) {
  const dest = { name: d.name || "Destino", address: d.address || "", lat: Number(d.lat), lng: Number(d.lng) };
  if (!driveValidPoint(dest)) return;
  if ((nav.mode === "nav" || nav.loading) && driveSameDest(nav.dest, dest)) return;
  nav.autoQuiet = true;
  if (nav.mode === "nav") nav.result = finishTrip(false);
  nav.autoQuiet = false;
  tobaToast(`🚘 Rota do Android Auto: ${dest.name}`);
  await setDestination(dest);
  if (nav.mode === "preview" && nav.route && driveSameDest(nav.dest, dest)) {
    nav.autoQuiet = true; // não precisa mandar de volta pro carro
    startNav();
    nav.autoQuiet = false;
  }
}

window.onTobaAutoRoute = function onTobaAutoRoute(d) {
  if (!d) return;
  if (d.end) {
    // v2.02: o carro já anotou a viagem no diário dele: puxa pro histórico (sem duplicar a do celular)
    setTimeout(() => {
      if (driveImportAutoTrips() && nav.mode === "pick") renderPick();
    }, 1500);
    // só encerra se for a MESMA rota (o carro pode estar trocando de destino)
    if (nav.mode !== "nav" || !driveSameDest(nav.dest, d)) return;
    nav.autoQuiet = true;
    if (d.arrived) {
      arrive();
    } else {
      driveShutUp();
      nav.result = finishTrip(false);
      setMode("done").then(() => fitRoute());
      tobaToast("🚘 Rota encerrada no carro");
    }
    nav.autoQuiet = false;
    return;
  }
  driveFollowAuto(d);
};

(function initDrive() {
  syncPrefInputs();
  renderPickVehicle();
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
  const hasQs = Boolean(qs.get("lat") && qs.get("lng") && driveValidPoint({ lat, lng }));
  // v1.77: viagem que ficou no meio (celular bloqueou, app recarregou)
  const active = readActiveTrip();
  if (active) {
    const fresh = Date.now() - Number(active.savedAt || 0) <= DRIVE_RESUME_MAX_MS;
    const same = !hasQs || driveDist([lat, lng], [Number(active.dest.lat), Number(active.dest.lng)]) < 60;
    if (fresh && same) {
      startGps();
      resumeActiveTrip(active);
      return;
    }
    closeActiveTrip(active);
  }
  // v1.78: o carro já está navegando? o celular entra na mesma rota
  const carRoute = hasQs ? null : driveAutoRouteNow();
  if (carRoute) {
    startGps();
    driveFollowAuto(carRoute);
    return;
  }
  // v2.02: ➕ do ⭐ Favoritos do hub do Racing (?fav=1): escolhe o lugar e já abre o Favoritar
  if (qs.get("fav") === "1") {
    nav.favMode = true;
    setMode("pick");
    renderFavMode();
    setTimeout(() => document.getElementById("driveQuery")?.focus(), 200);
    return;
  }
  if (hasQs) {
    setDestination({ name: qs.get("name") || "Destino", address: qs.get("address") || "", lat, lng, ...(qs.get("place") ? { placeId: qs.get("place") } : {}) });
  } else {
    setMode("pick");
  }
})();
