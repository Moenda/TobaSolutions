/* =====================================================================
 * Toba Turism · 🗺️ Mapa do Toba Places (desde v1.56)
 * - Mapa de verdade dentro do app: Leaflet (fixado em 1.9.4, jsdelivr) com
 *   o mapa do OpenStreetMap no estilo escuro da CARTO (Dark Matter).
 *   Desde v1.57 a CARTO exige chave: TURISM_CARTO_KEY é a chave grátis do Rafa
 *   (5 mi de tiles/mês). Ela fica pública no site (é chave de navegador); pra
 *   trocar/limitar ao domínio, painel da CARTO (Basemaps). Nunca pôr em memória.
 *   Só carrega quando a pessoa abre o 🗺️ Mapa (offline = aviso, o resto segue).
 * - Pino de cada lugar = place.lat / place.lng. De onde vem:
 *   1. link comprido do Maps (tem a coordenada dentro; turismCoordsFromUrl em places.js);
 *   2. busca automática no Nominatim (OpenStreetMap) pelo endereço ou nome + cidade,
 *      uma por vez com 1,1 s de intervalo (regra de uso do Nominatim);
 *   3. a pessoa toca no mapa onde fica ("📍 Pôr pino").
 * - Busca presa na cidade (v1.58): a cidade da lista vira uma caixa de busca e
 *   pino a mais de 80 km dela aparece como "🌍 longe" (🔎 Achar procura de novo).
 * - Bairro/região (v1.57): se o lugar não tem, vem junto da busca automática
 *   (addressdetails) ou de uma busca reversa quando a pessoa põe o pino na mão.
 * - Usa funções de places.js só dentro de funções (places.js carrega depois).
 * ===================================================================== */
const TURISM_LEAFLET_CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
const TURISM_LEAFLET_JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
const TURISM_CARTO_KEY = "cb1_4zv2_1_2e88aba5239e1a6ac05ddc60";
const TURISM_TILES = `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${TURISM_CARTO_KEY}`;
const TURISM_TILES_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
const TURISM_GEOCODE_URL = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=pt-BR&q=";
const TURISM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=pt-BR";
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
  lastCall: 0, // última chamada ao Nominatim (ms)
  cities: {}, // centro de cada cidade já buscada (v1.58)
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
  const missing = turismMissingPins(list);
  const anchor = turismListAnchor(list);
  // Centro da cidade ainda não buscado: busca (1 vez) e redesenha pra marcar pino longe
  if (list.city && !(turismNorm(list.city) in placesMap.cities) && navigator.onLine !== false && !placesMap.cityBusy) {
    placesMap.cityBusy = true;
    turismCityCenter(list.city).then((c) => {
      placesMap.cityBusy = false;
      if (c && placesState.mode === "map" && placesState.listId === list.id) renderAll();
    });
  }
  const placing = placesMap.placingId ? turismFindPlace(placesMap.placingId) : null;
  if (!placing) placesMap.placingId = null;

  document.getElementById("mapBar").innerHTML = placing
    ? `<div class="tr-map-placing"><span>👆 Toca no mapa onde fica <b>${escapeHtml(placing.name)}</b></span><button type="button" class="chip-btn" data-click="cancelPinPlacing">Cancelar</button></div>`
    : `<button type="button" class="chip-btn tr-chip" data-click="mapLocate">📍 Perto de mim</button>
       ${missing.length ? `<button type="button" class="chip-btn tr-chip" data-click="mapFindAll">🔎 Achar ${missing.length} ${missing.length === 1 ? "pino" : "pinos"}</button>` : ""}
       <button type="button" class="chip-btn tr-chip tr-map-help" data-click="mapHelp" aria-label="Como o mapa acha os lugares">❔</button>`;

  document.getElementById("mapMissing").innerHTML = missing.length && !placing
    ? `<div class="tr-label">❔ Sem pino ou 🌍 longe da cidade (toca pra pôr no mapa)</div>
       <div class="tr-chips is-wrap">${missing.map((p) => chipHtml({ label: `${turismKind(p.kind)?.icon || (p.status === "been" ? "✅" : "📌")} ${escapeHtml(p.name)}${turismFarPin(p, anchor) ? " 🌍 longe" : p.geoMiss ? " ❓" : ""}`, action: "mapPinPlace", data: { id: p.id } })).join("")}</div>`
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
    L.tileLayer(TURISM_TILES, { maxZoom: 19, attribution: TURISM_TILES_ATTR }).addTo(placesMap.map);
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
  const anchor = turismListAnchor(list);
  const near = pins.filter((p) => !turismFarPin(p, anchor)); // enquadra sem o pino perdido
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
      ${p.region ? `<span>🏘️ ${escapeHtml(p.region)}</span>` : ""}
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
  const fitKey = `${list.id}:${pins.length}:${near.length}`;
  if (placesMap.fitFor !== fitKey && !placesMap.placingId) {
    placesMap.fitFor = fitKey;
    if (near.length === 1) placesMap.map.setView([near[0].lat, near[0].lng], 15);
    else if (near.length > 1) placesMap.map.fitBounds(L.latLngBounds(near.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15 });
    else if (anchor) placesMap.map.setView([anchor.lat, anchor.lng], 12);
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
  if (!p.region) turismRegionFromPin(p.id);
}

// Pino posto na mão e lugar sem bairro: pergunta pro OpenStreetMap qual é
async function turismRegionFromPin(id) {
  const p = turismFindPlace(id);
  if (!p || !turismHasPin(p) || navigator.onLine === false) return;
  try {
    const region = turismRegionFromOsm((await turismNominatim(`${TURISM_REVERSE_URL}&lat=${p.lat}&lon=${p.lng}`))?.address);
    const fresh = turismFindPlace(id);
    if (!region || !fresh || fresh.region) return;
    fresh.region = region;
    if (saveTurismDb({ silent: true })) {
      tobaToast(`🏘️ ${fresh.name}: ${region}`.slice(0, 60));
      renderAll();
    }
  } catch (err) {
    /* sem internet: fica sem bairro, a pessoa põe na mão */
  }
}

// Endereço do Nominatim → bairro (no Brasil o bairro vem em "suburb")
function turismRegionFromOsm(addr) {
  if (!addr || typeof addr !== "object") return "";
  return String(addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.borough || "").trim().slice(0, 40);
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
 * v1.58: a busca fica presa perto da cidade da lista (ou dos outros pinos).
 * Antes "Café X, São Paulo" achava a freguesia "São Paulo" de Lisboa 🇵🇹.
 * ------------------------------------------------------------------- */
const TURISM_NEAR_KM = 80; // pino a mais disso da cidade da lista = suspeito
const TURISM_BOX_DEG = 0.6; // caixa de busca em volta da cidade (~65 km)

function turismGeocodeQueries(p) {
  const list = turismFindList(p.listId);
  const city = String(list?.city || "").trim();
  const out = [];
  if (p.address) out.push(p.address);
  if (p.region) out.push([p.name, p.region, city].filter(Boolean).join(", "));
  out.push(city ? `${p.name}, ${city}` : p.name);
  if (p.address) out.push(`${p.name}, ${p.address}`);
  return [...new Set(out.filter(Boolean))];
}

const turismSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Toda chamada ao Nominatim passa aqui: no máximo 1 por 1,1 s (regra de uso)
async function turismNominatim(url) {
  const wait = placesMap.lastCall + TURISM_GEOCODE_GAP_MS - Date.now();
  placesMap.lastCall = Date.now() + Math.max(0, wait);
  if (wait > 0) await turismSleep(wait);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function turismGeocodeQuery(q, box, extra = "") {
  const area = box ? `&bounded=1&viewbox=${[box.west, box.north, box.east, box.south].map((x) => x.toFixed(4)).join(",")}` : "";
  const data = await turismNominatim(TURISM_GEOCODE_URL + encodeURIComponent(q) + area + extra);
  const hit = Array.isArray(data) ? data[0] : null;
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && hit ? { lat, lng, region: turismRegionFromOsm(hit.address) } : null;
}

function turismKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function turismMedian(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Centro da cidade da lista (busca 1 vez por cidade e guarda na memória)
async function turismCityCenter(city) {
  const key = turismNorm(city);
  if (!key) return null;
  if (!(key in placesMap.cities)) {
    try {
      // featureType=city: "São Paulo" = a cidade (não o estado nem a freguesia de Lisboa)
      placesMap.cities[key] = (await turismGeocodeQuery(city, null, "&featureType=city")) || (await turismGeocodeQuery(city, null));
    } catch (err) {
      return null; // sem internet: tenta de novo depois
    }
  }
  return placesMap.cities[key];
}

// Onde a lista "mora": centro da cidade; sem cidade, o meio dos pinos (3+)
function turismListAnchor(list) {
  const key = turismNorm(list?.city);
  if (key && placesMap.cities[key]) return placesMap.cities[key];
  const pins = placesOfList(list?.id).filter((p) => turismHasPin(p));
  if (pins.length < 3) return null;
  return { lat: turismMedian(pins.map((p) => p.lat)), lng: turismMedian(pins.map((p) => p.lng)) };
}

// Pino que foi parar longe da cidade da lista (ex.: Portugal numa lista de SP)
function turismFarPin(p, anchor) {
  return Boolean(anchor && turismHasPin(p) && turismKm(anchor, p) > TURISM_NEAR_KM);
}

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
    const list = turismFindList(p.listId);
    if (list?.city) await turismCityCenter(list.city);
    const anchor = turismListAnchor(list);
    const box = anchor ? { west: anchor.lng - TURISM_BOX_DEG, east: anchor.lng + TURISM_BOX_DEG, north: anchor.lat + TURISM_BOX_DEG, south: anchor.lat - TURISM_BOX_DEG } : null;
    let coords = null;
    for (const q of turismGeocodeQueries(p)) {
      try {
        coords = await turismGeocodeQuery(q, box);
      } catch (err) {
        coords = null;
      }
      if (coords && anchor && turismKm(anchor, coords) > TURISM_NEAR_KM) coords = null;
      if (coords) break;
    }
    const fresh = turismFindPlace(id); // o banco pode ter sido trocado no meio
    if (!fresh || turismHasPin(fresh)) continue;
    placesMap.tried += 1;
    if (coords) {
      fresh.lat = coords.lat;
      fresh.lng = coords.lng;
      fresh.geoMiss = false;
      if (!fresh.region && coords.region) fresh.region = coords.region;
      placesMap.found += 1;
    } else {
      fresh.geoMiss = true;
    }
    saveTurismDb({ silent: true });
    if (placesState.listId === fresh.listId) renderAll();
  }
  placesMap.busy = false;
  if (placesMap.tried > 1) {
    const { found, tried } = placesMap;
    tobaToast(found === tried ? `🔎 Achei os ${tried} pinos!` : `🔎 Achei ${found} de ${tried}. O resto: toca e põe no mapa 👆`);
  }
  placesMap.found = 0;
  placesMap.tried = 0;
}

// Sem pino ou com pino longe da cidade (esses voltam pra busca no 🔎 Achar)
function turismMissingPins(list) {
  const anchor = turismListAnchor(list);
  return placesOfList(list.id).filter((p) => !turismHasPin(p) || turismFarPin(p, anchor));
}

function mapFindAll() {
  if (navigator.onLine === false) {
    showPageMessage("Precisa de internet pra procurar os lugares no mapa.", { title: "Sem internet", icon: "📡" });
    return;
  }
  const missing = turismMissingPins(turismFindList(placesState.listId));
  if (!missing.length) return;
  missing.forEach((p) => {
    if (turismHasPin(p)) {
      // pino longe: apaga e procura de novo, agora presa na cidade
      p.lat = null;
      p.lng = null;
    }
    p.geoMiss = false;
    if (!placesMap.queue.includes(p.id)) placesMap.queue.push(p.id);
  });
  saveTurismDb({ silent: true });
  placesMap.fitFor = "";
  renderAll();
  tobaToast(`🔎 Procurando ${missing.length} ${missing.length === 1 ? "lugar" : "lugares"}... (1 por segundo)`);
  runTurismGeocodeQueue();
}

// ❔ da barra do mapa (v1.58): de onde vem cada pino e o que fazer quando erra
function mapHelp() {
  const list = turismFindList(placesState.listId);
  const city = list?.city ? `"${list.city}"` : "da lista";
  showPageMessage([
    "📌 Link comprido do Maps (o do PC, com @-23,5... no meio): o pino já vem certinho.",
    `🔗 Link curto (maps.app.goo.gl, do "Copiar link"): não tem endereço dentro, e o Google não deixa site nenhum abrir pra ler. Aí o Toba procura o nome perto da cidade ${city} (uns 65 km em volta).`,
    "📤 No Maps, Compartilhar › Toba: vem nome + endereço, a busca acerta muito mais.",
    "🏘️ Anotar o bairro também ajuda a busca.",
    "❔ Sem pino: a busca não achou. Toca no nome embaixo do mapa e depois no lugar certo.",
    "🌍 Longe: pino a mais de 80 km da cidade da lista. Toca em 🔎 Achar que ele procura de novo.",
    "✏️ Pino no lugar errado? Abre o lugar › 📍 Ajustar no mapa.",
  ].join("\n\n"), { title: "Como o mapa acha os lugares", icon: "🗺️" });
}

tobaActions({
  mapHelp,
  mapLocate,
  mapFindAll,
  mapPinPlace,
  cancelPinPlacing,
});
