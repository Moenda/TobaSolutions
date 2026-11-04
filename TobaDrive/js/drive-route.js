/* =====================================================================
 * Toba Drive · rota, busca, voz e tela acesa (desde v1.65)
 * - v1.66: TomTom primeiro (../../assets/toba-maps.js): rota com TRÂNSITO AO
 *   VIVO (Routing API v1, frases em pt-BR, trechos parados em traffic) e mapa
 *   TomTom. Recusou/cota/limite do dia? cai sozinho no plano B abaixo.
 * - Plano B da rota: Valhalla público do OpenStreetMap (valhalla1.openstreetmap.de, sem
 *   chave, já devolve as frases em pt-BR). Caiu? tenta o OSRM público
 *   (router.project-osrm.org) e monta as frases aqui (drive-metrics.js).
 *   Os dois são servidores de uso justo: 1 rota por vez, recálculo no máximo a
 *   cada DRIVE_REROUTE_GAP_MS. Nada disso vai pro cache do sw.js.
 * - Busca de endereço: Nominatim (mesma regra do Toba Places: 1 por segundo).
 * - Mapa: só Mapbox 3D desde v1.70 (drive-map.js). O Leaflet/CARTO/TomTom em
 *   imagem saiu do Navegar (o Toba Places continua com eles).
 * - v1.70: TomTom com computeTravelTimeFor=all: a lentidão do caminho é
 *   "tempo com trânsito agora − tempo de rua vazia" (antes só contava acidente
 *   e bloqueio, e quase sempre dava "caminho livre").
 * - Voz: speechSynthesis do navegador em pt-BR.
 * - Tela acesa: Wake Lock (navegador) ou TOBA_NATIVE.keepScreenOn (APK).
 * ===================================================================== */
const DRIVE_TOMTOM_ROUTE_URL = "https://api.tomtom.com/routing/1/calculateRoute/";
const DRIVE_NO_SPEED_KEY = "toba_tomtom_nospeed";
const DRIVE_OVERPASS_URL = "https://overpass-api.de/api/interpreter?data=";
const DRIVE_VALHALLA_URL = "https://valhalla1.openstreetmap.de/route?json=";
const DRIVE_OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";
const DRIVE_SEARCH_URL = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&accept-language=pt-BR&countrycodes=br&q=";
const DRIVE_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&accept-language=pt-BR";
const DRIVE_FETCH_TIMEOUT_MS = 12000;
const DRIVE_REROUTE_GAP_MS = 12000;
const DRIVE_PREFS_KEY = "toba_drive_prefs";

/* ---------- preferências (só deste aparelho) ---------- */
function readDrivePrefs() {
  let p = {};
  try {
    p = JSON.parse(localStorage.getItem(DRIVE_PREFS_KEY) || "{}") || {};
  } catch (err) {
    p = {};
  }
  return {
    voice: p.voice !== false,
    keepAwake: p.keepAwake !== false,
    avoidTolls: Boolean(p.avoidTolls),
    traffic: p.traffic !== false, // 🚦 trânsito ao vivo no mapa (v1.66; v1.70 = Mapbox Traffic)
    vehicle: typeof p.vehicle === "string" ? p.vehicle : "seta", // 🎨 carango no mapa (v1.67, DRIVE_VEHICLES)
    gameView: p.gameView !== false, // v1.68: mapa inclinado girando com o carro (visual de jogo)
    copilot: p.copilot !== false, // v1.68: 🤡 Cloba copiloto (piadinhas na voz)
    mapLight: ["auto", "dawn", "day", "dusk", "night"].includes(p.mapLight) ? p.mapLight : "auto", // v1.69: luz do mapa 3D
    routeColor: typeof p.routeColor === "string" ? p.routeColor : "laranja", // 🎨 cor da rota (v1.67, DRIVE_ROUTE_COLORS)
    speedo: typeof p.speedo === "string" ? p.speedo : "toba", // 🎨 velocímetro (v1.70, DRIVE_SPEEDOS)
  };
}

function storeDrivePrefs(patch) {
  try {
    localStorage.setItem(DRIVE_PREFS_KEY, JSON.stringify({ ...readDrivePrefs(), ...patch }));
  } catch (err) {
    /* sem storage: vale só agora */
  }
}

/* ---------- rede ---------- */
async function driveFetchJson(url) {
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), DRIVE_FETCH_TIMEOUT_MS) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// TomTom (v1.66): rota com trânsito ao vivo. Devolve null se o TomTom estiver
// desligado/sem cota do dia; 4xx de chave/cota desliga o TomTom por umas horas.
async function driveFetchTomTom(from, to, options = {}) {
  if (typeof tobaTomTomCanRoute !== "function" || !tobaTomTomCanRoute()) return null;
  const prefs = readDrivePrefs();
  const params = new URLSearchParams({
    key: TOBA_TOMTOM_KEY,
    travelMode: "car",
    routeType: "fastest",
    traffic: "true",
    departAt: "now",
    instructionsType: "text",
    language: "pt-BR",
    sectionType: "traffic",
    computeTravelTimeFor: "all", // v1.70: devolve o tempo de rua vazia (noTrafficTravelTimeInSeconds)
  });
  if (prefs.avoidTolls) params.set("avoid", "tollRoads");
  if (Number.isFinite(options.heading) && options.speed > 3) params.set("vehicleHeading", String(Math.round(options.heading) % 360));
  const locs = `${from.lat.toFixed(6)},${from.lng.toFixed(6)}:${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
  // v1.68: limite de velocidade da via (velocímetro). Se o TomTom recusar esse pedaço
  // (400), tenta de novo sem ele e lembra neste aparelho (toba_tomtom_nospeed).
  let withSpeed = true;
  try {
    withSpeed = localStorage.getItem(DRIVE_NO_SPEED_KEY) !== "1";
  } catch (err) {
    withSpeed = true;
  }
  if (withSpeed) params.append("sectionType", "speedLimit");
  tobaTomTomCountRoute();
  try {
    const route = driveRouteFromTomTom(await driveFetchJson(`${DRIVE_TOMTOM_ROUTE_URL}${locs}/json?${params}`));
    if (route) return route;
  } catch (err) {
    if (err.status === 400 && withSpeed) {
      try {
        localStorage.setItem(DRIVE_NO_SPEED_KEY, "1");
      } catch (e) {
        /* sem storage */
      }
      return driveFetchTomTom(from, to, options);
    }
    // 400 = TomTom não achou caminho (ex.: destino no meio do mato): não é culpa da chave
    if (err.status && err.status !== 400 && err.status < 500) tobaTomTomOff(`rota HTTP ${err.status}`);
    console.warn("TomTom falhou, tentando Valhalla", err);
  }
  return null;
}

// from/to = { lat, lng }; heading (graus) ajuda a não mandar fazer retorno à toa
async function driveFetchRoute(from, to, options = {}) {
  const tomtom = await driveFetchTomTom(from, to, options);
  if (tomtom) return tomtom;
  const prefs = readDrivePrefs();
  const start = { lat: from.lat, lon: from.lng };
  if (Number.isFinite(options.heading) && options.speed > 3) {
    start.heading = Math.round(options.heading);
    start.heading_tolerance = 60;
  }
  const body = {
    locations: [start, { lat: to.lat, lon: to.lng }],
    costing: "auto",
    costing_options: { auto: { use_tolls: prefs.avoidTolls ? 0 : 0.5 } },
    units: "kilometers",
    language: "pt-BR",
    directions_options: { units: "kilometers", language: "pt-BR" },
  };
  try {
    const json = await driveFetchJson(DRIVE_VALHALLA_URL + encodeURIComponent(JSON.stringify(body)));
    const route = driveRouteFromValhalla(json);
    if (route) return route;
    throw new Error("Valhalla sem rota");
  } catch (err) {
    console.warn("Valhalla falhou, tentando OSRM", err);
  }
  const json = await driveFetchJson(`${DRIVE_OSRM_URL}${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`);
  const route = driveRouteFromOsrm(json);
  if (!route) throw new Error("Sem rota");
  return route;
}

/* ---------- busca de endereço (Nominatim, 1 por segundo) ---------- */
let driveLastSearch = 0;

async function driveNominatim(url) {
  const wait = driveLastSearch + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  driveLastSearch = Date.now();
  return driveFetchJson(url);
}

function driveAddressLine(addr, fallback = "") {
  if (!addr) return fallback;
  const street = [addr.road || addr.pedestrian || addr.footway, addr.house_number].filter(Boolean).join(", ");
  const area = addr.suburb || addr.neighbourhood || addr.city_district || "";
  const city = addr.city || addr.town || addr.village || addr.municipality || "";
  return [street, area, city].filter(Boolean).join(" · ") || fallback;
}

// near = { lat, lng } (opcional): resultados perto de onde a pessoa está vêm primeiro
async function driveSearchPlaces(q, near) {
  let url = DRIVE_SEARCH_URL + encodeURIComponent(q);
  if (near) {
    const d = 0.5;
    url += `&viewbox=${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`;
  }
  const rows = await driveNominatim(url);
  const out = (Array.isArray(rows) ? rows : []).map((r) => ({
    name: r.name || String(r.display_name || "").split(",")[0] || "Lugar",
    address: driveAddressLine(r.address, String(r.display_name || "").split(",").slice(1, 3).join(",").trim()),
    lat: Number(r.lat),
    lng: Number(r.lon),
  })).filter(driveValidPoint);
  if (near) out.forEach((r) => (r.km = driveDist([near.lat, near.lng], [r.lat, r.lng]) / 1000));
  return out;
}

async function driveReverse(lat, lng) {
  const r = await driveNominatim(`${DRIVE_REVERSE_URL}&lat=${lat}&lon=${lng}`);
  return {
    name: r?.name || r?.address?.road || "Ponto no mapa",
    address: driveAddressLine(r?.address, ""),
  };
}

/* ---------- voz ---------- */
let driveVoice = null;

function drivePickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices() || [];
  driveVoice = voices.find((v) => /pt[-_]BR/i.test(v.lang) && /google/i.test(v.name))
    || voices.find((v) => /pt[-_]BR/i.test(v.lang))
    || voices.find((v) => /^pt/i.test(v.lang))
    || null;
  return driveVoice;
}

if ("speechSynthesis" in window) {
  drivePickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", drivePickVoice);
}

function driveSpeak(text, options = {}) {
  if (!text || !readDrivePrefs().voice || !("speechSynthesis" in window)) return;
  try {
    if (options.interrupt !== false) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    if (driveVoice || drivePickVoice()) u.voice = driveVoice;
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch (err) {
    /* sem voz neste aparelho: segue só na tela */
  }
}

function driveShutUp() {
  try {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  } catch (err) {
    /* nada */
  }
}

/* ---------- tela acesa ---------- */
let driveWakeLock = null;
let driveWantAwake = false;

async function driveKeepAwake(on) {
  driveWantAwake = on && readDrivePrefs().keepAwake;
  if (TOBA_NATIVE && typeof TOBA_NATIVE.keepScreenOn === "function") {
    TOBA_NATIVE.keepScreenOn(driveWantAwake);
    return;
  }
  if (!driveWantAwake) {
    if (driveWakeLock) driveWakeLock.release().catch(() => {});
    driveWakeLock = null;
    return;
  }
  if (!("wakeLock" in navigator) || driveWakeLock || document.hidden) return;
  try {
    driveWakeLock = await navigator.wakeLock.request("screen");
    driveWakeLock.addEventListener("release", () => {
      driveWakeLock = null;
    });
  } catch (err) {
    driveWakeLock = null; // navegador não deixou: navega igual
  }
}

// O navegador solta o Wake Lock quando a aba some; volta ao aparecer
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && driveWantAwake) driveKeepAwake(true);
});

/* ---------- OpenStreetMap: radares e postos (v1.68, Overpass, sem chave) ----------
 * Uma pergunta por rota (radares numa caixa em volta da rota) e uma por toque no
 * ⛽ Posto perto. Falhou = segue sem (nada trava a navegação).
 */
async function driveOverpass(query) {
  return driveFetchJson(DRIVE_OVERPASS_URL + encodeURIComponent(`[out:json][timeout:15];${query}`));
}

// Radares (highway=speed_camera) a até 35 m da linha da rota: [{ lat, lng, along }]
async function driveFetchRadars(route) {
  if (!route?.coords?.length || route.distance > 150000) return [];
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  route.coords.forEach(([lat, lng]) => {
    s = Math.min(s, lat);
    n = Math.max(n, lat);
    w = Math.min(w, lng);
    e = Math.max(e, lng);
  });
  const pad = 0.003;
  const json = await driveOverpass(`node[highway=speed_camera](${s - pad},${w - pad},${n + pad},${e + pad});out 200;`);
  const out = [];
  (json?.elements || []).forEach((el) => {
    const p = [Number(el.lat), Number(el.lon)];
    if (!Number.isFinite(p[0])) return;
    const loc = driveLocateOnRoute(route, p, 0);
    if (loc && loc.dist <= 35) out.push({ lat: p[0], lng: p[1], along: loc.along });
  });
  return out.sort((a, b) => a.along - b.along);
}

// ⛽ Postos (amenity=fuel) num raio de até 4 km, mais perto primeiro
async function driveFetchFuel(near) {
  const json = await driveOverpass(`(node[amenity=fuel](around:4000,${near.lat},${near.lng});way[amenity=fuel](around:4000,${near.lat},${near.lng}););out center 30;`);
  return (json?.elements || []).map((el) => {
    const lat = Number(el.lat ?? el.center?.lat);
    const lng = Number(el.lon ?? el.center?.lon);
    const t = el.tags || {};
    const brand = t.brand || t.name || "Posto";
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    return { name: t.name && t.brand && !t.name.includes(t.brand) ? `${t.brand} · ${t.name}` : `⛽ ${brand}`, address: street, lat, lng, kind: "fuel", km: driveDist([near.lat, near.lng], [lat, lng]) / 1000 };
  }).filter(driveValidPoint).sort((a, b) => a.km - b.km).slice(0, 12);
}

