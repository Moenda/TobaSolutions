/* =====================================================================
 * Toba Turism · 🗺️ Mapa do Toba Places (desde v1.56)
 * - Mapa de verdade dentro do app: Leaflet (fixado em 1.9.4, jsdelivr) com
 *   o mapa do OpenStreetMap no estilo escuro da CARTO. Grátis e sem chave.
 *   Só carrega quando a pessoa abre o 🗺️ Mapa (offline = aviso, o resto segue).
 * - Pino de cada lugar = place.lat / place.lng. De onde vem:
 *   1. link comprido do Maps (tem a coordenada dentro; turismCoordsFromUrl em places.js);
 *   2. busca automática no Nominatim (OpenStreetMap) pelo endereço ou nome + cidade,
 *      uma por vez com 1,1 s de intervalo (regra de uso do Nominatim);
 *   3. a pessoa toca no mapa onde fica ("📍 Pôr pino").
 * - Usa funções de places.js só dentro de funções (places.js carrega depois).
 * ===================================================================== */
const TURISM_LEAFLET_CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
const TURISM_LEAFLET_JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
const TURISM_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TURISM_TILES_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
const TURISM_GEOCODE_URL = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=";
const TURISM_GEOCODE_GAP_MS = 1100;
const TURISM_MAP_DEFAULT = { lat: -23.5505, lng: -46.6333, zoom: 12 }; // Praça da Sé

const placesMap = {
  promise: null,
  map: null,
  layer: null,
  me: null,
  fitFor: "", // lista + pinos do último "enquadrar"
  placingId: null,
  queue: [],
  busy: false,
  found: 0,
  tried: 0,
};

function loadTurismLeaflet() {
  if (window.L) return Promise.resolve();
  if (!placesMap.promise) {
    placesMap.promise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = TURISM_LEAFLET_CSS;
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = TURISM_LEAFLET_JS;
      js.onload = () => (window.L ? resolve() : reject(new Error("Leaflet sem L")));
      js.onerror = () => reject(new Error("Leaflet não carregou"));
      document.head.appendChild(js);
    }).catch((err) => {
      placesMap.promise = null; // tenta de novo na próxima
      throw err;
    });
  }
  return placesMap.promise;
}

function renderPlacesMap(list) {
  const places = placesOfList(list.id);
  const missing = places.filter((p) => !turismHasPin(p));
  const placing = placesMap.placingId ? turismFindPlace(placesMap.placingId) : null;
  if (!placing) placesMap.placingId = null;

  document.getElementById("mapBar").innerHTML = placing
    ? `<div class="tr-map-placing"><span>👆 Toca no mapa onde fica <b>${escapeHtml(placing.name)}</b></span><button type="button" class="chip-btn" data-click="cancelPinPlacing">Cancelar</button></div>`
    : `<button type="button" class="chip-btn tr-chip" data-click="mapLocate">📍 Perto de mim</button>
       ${missing.length ? `<button type="button" class="chip-btn tr-chip" data-click="mapFindAll">🔎 Achar ${missing.length} ${missing.length === 1 ? "pino" : "pinos"}</button>` : ""}`;

  document.getElementById("mapMissing").innerHTML = missing.length && !placing
    ? `<div class="tr-label">❔ Sem pino ainda (toca pra pôr no mapa)</div>
       <div class="tr-chips is-wrap">${missing.map((p) => chipHtml({ label: `${turismKind(p.kind)?.icon || (p.status === "been" ? "✅" : "📌")} ${escapeHtml(p.name)}${p.geoMiss ? " ❓" : ""}`, action: "mapPinPlace", data: { id: p.id } })).join("")}</div>`
    : "";

  loadTurismLeaflet()
    .then(() => drawPlacesMap(list))
    .catch(() => {
      document.getElementById("placesMap").innerHTML = tobaEmpty("📡", "Mapa sem internet", "O mapa precisa de internet pra carregar. As listas funcionam normal offline.", { compact: true });
    });
}

function drawPlacesMap(list) {
  const box = document.getElementById("placesMap");
  if (document.getElementById("mapPane").hidden) return;
  if (!placesMap.map) {
    box.innerHTML = "";
    placesMap.map = L.map(box, { zoomControl: true, attributionControl: true }).setView([TURISM_MAP_DEFAULT.lat, TURISM_MAP_DEFAULT.lng], TURISM_MAP_DEFAULT.zoom);
    L.tileLayer(TURISM_TILES, { maxZoom: 19, subdomains: "abcd", attribution: TURISM_TILES_ATTR }).addTo(placesMap.map);
    placesMap.layer = L.layerGroup().addTo(placesMap.map);
    placesMap.map.on("click", onPlacesMapClick);
    // Botões dentro do balão do pino (o Leaflet segura o clique; liga na mão)
    placesMap.map.on("popupopen", (ev) => {
      ev.popup.getElement().querySelectorAll("[data-pop]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          placesMap.map.closePopup();
          runTobaAction(btn.dataset.pop, btn, e);
        });
      });
    });
  }
  setTimeout(() => placesMap.map && placesMap.map.invalidateSize(), 60);
  box.classList.toggle("is-placing", Boolean(placesMap.placingId));

  placesMap.layer.clearLayers();
  const pins = placesOfList(list.id).filter((p) => turismHasPin(p));
  pins.forEach((p) => {
    const kind = turismKind(p.kind);
    const been = p.status === "been";
    const icon = L.divIcon({
      className: "tr-pin-wrap",
      html: `<span class="tr-pin${been ? " is-been" : ""}"><i>${kind ? kind.icon : been ? "✅" : "📌"}</i></span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30],
    });
    const verdict = been ? placeVerdict(p) : [];
    const html = `<div class="tr-pop">
      <b>${escapeHtml(p.name)}</b>
      ${kind ? `<span>${kind.icon} ${kind.label}</span>` : ""}
      ${p.note ? `<span>📝 ${escapeHtml(p.note)}</span>` : ""}
      ${verdict.length ? `<span>${verdict.join(" · ")}</span>` : ""}
      <div class="tr-pop-btns">
        <button type="button" class="chip-btn" data-pop="openPlaceMaps" data-id="${escapeHtml(p.id)}">🗺️ Maps</button>
        ${been ? "" : `<button type="button" class="chip-btn" data-pop="openRate" data-id="${escapeHtml(p.id)}">✅ Fui</button>`}
        <button type="button" class="chip-btn" data-pop="editPlace" data-id="${escapeHtml(p.id)}">✏️</button>
      </div>
    </div>`;
    L.marker([p.lat, p.lng], { icon, title: p.name }).bindPopup(html, { maxWidth: 240 }).addTo(placesMap.layer);
  });

  // Enquadra os pinos quando muda a lista ou a quantidade de pinos
  const fitKey = `${list.id}:${pins.length}`;
  if (placesMap.fitFor !== fitKey && !placesMap.placingId) {
    placesMap.fitFor = fitKey;
    if (pins.length === 1) placesMap.map.setView([pins[0].lat, pins[0].lng], 15);
    else if (pins.length > 1) placesMap.map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15 });
  }
}

function onPlacesMapClick(ev) {
  const p = placesMap.placingId ? turismFindPlace(placesMap.placingId) : null;
  if (!p) return;
  p.lat = Math.round(ev.latlng.lat * 1e6) / 1e6;
  p.lng = Math.round(ev.latlng.lng * 1e6) / 1e6;
  p.geoMiss = false;
  placesMap.placingId = null;
  if (!saveTurismDb({ silent: true })) return;
  tobaToast(`📍 Pino do ${p.name} no lugar!`.slice(0, 60));
  placesMap.fitFor = ""; // reenquadra
  renderAll();
}

function startPinPlacing(id) {
  placesMap.placingId = String(id);
  tobaToast("👆 Toca no mapa onde fica");
  renderAll();
}

function mapPinPlace(el) {
  startPinPlacing(el.dataset.id);
}

function cancelPinPlacing() {
  placesMap.placingId = null;
  renderAll();
}

function mapLocate() {
  if (!navigator.geolocation) {
    showPageMessage("Esse navegador não deixa pegar a localização.", { title: "Sem GPS", icon: "📡" });
    return;
  }
  tobaToast("📡 Procurando você...");
  navigator.geolocation.getCurrentPosition((pos) => {
    if (!placesMap.map || !window.L) return;
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if (placesMap.me) placesMap.me.setLatLng(ll);
    else placesMap.me = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 2, fillColor: "#58a6ff", fillOpacity: 1 }).addTo(placesMap.map);
    placesMap.map.setView(ll, 15);
  }, () => {
    showPageMessage("Não deu pra pegar sua localização. Confere se o GPS tá ligado e se o Toba tem permissão.", { title: "Cadê você?", icon: "📍" });
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

/* ---------------------------------------------------------------------
 * Busca automática do pino (Nominatim / OpenStreetMap)
 * ------------------------------------------------------------------- */
function turismGeocodeQueries(p) {
  const list = turismFindList(p.listId);
  const city = String(list?.city || "").trim();
  const out = [];
  if (p.address) out.push(p.address);
  out.push(city ? `${p.name}, ${city}` : p.name);
  if (p.address) out.push(`${p.name}, ${p.address}`);
  return [...new Set(out.filter(Boolean))];
}

async function turismGeocodeQuery(q) {
  const res = await fetch(TURISM_GEOCODE_URL + encodeURIComponent(q), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && hit ? { lat, lng } : null;
}

const turismSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Põe na fila (sem repetir) e roda uma de cada vez
function turismGeocodeOne(place) {
  if (!place || turismHasPin(place) || navigator.onLine === false) return;
  if (!placesMap.queue.includes(place.id)) placesMap.queue.push(place.id);
  runTurismGeocodeQueue();
}

async function runTurismGeocodeQueue() {
  if (placesMap.busy) return;
  placesMap.busy = true;
  while (placesMap.queue.length) {
    const id = placesMap.queue.shift();
    const p = turismFindPlace(id);
    if (!p || turismHasPin(p)) continue;
    let coords = null;
    for (const q of turismGeocodeQueries(p)) {
      try {
        coords = await turismGeocodeQuery(q);
      } catch (err) {
        coords = null;
      }
      await turismSleep(TURISM_GEOCODE_GAP_MS);
      if (coords) break;
    }
    const fresh = turismFindPlace(id); // o banco pode ter sido trocado no meio
    if (!fresh || turismHasPin(fresh)) continue;
    placesMap.tried += 1;
    if (coords) {
      fresh.lat = coords.lat;
      fresh.lng = coords.lng;
      fresh.geoMiss = false;
      placesMap.found += 1;
    } else {
      fresh.geoMiss = true;
    }
    saveTurismDb({ silent: true });
    if (placesState.mode === "map" && placesState.listId === fresh.listId) renderAll();
  }
  placesMap.busy = false;
  if (placesMap.tried > 1) {
    const { found, tried } = placesMap;
    tobaToast(found === tried ? `🔎 Achei os ${tried} pinos!` : `🔎 Achei ${found} de ${tried}. O resto: toca e põe no mapa 👆`);
  }
  placesMap.found = 0;
  placesMap.tried = 0;
}

function mapFindAll() {
  if (navigator.onLine === false) {
    showPageMessage("Precisa de internet pra procurar os lugares no mapa.", { title: "Sem internet", icon: "📡" });
    return;
  }
  const missing = placesOfList(placesState.listId).filter((p) => !turismHasPin(p));
  if (!missing.length) return;
  missing.forEach((p) => {
    if (!placesMap.queue.includes(p.id)) placesMap.queue.push(p.id);
  });
  tobaToast(`🔎 Procurando ${missing.length} ${missing.length === 1 ? "lugar" : "lugares"}... (1 por segundo)`);
  runTurismGeocodeQueue();
}

tobaActions({
  mapLocate,
  mapFindAll,
  mapPinPlace,
  cancelPinPlacing,
});
