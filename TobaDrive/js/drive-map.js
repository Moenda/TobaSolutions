/* =====================================================================
 * Toba Drive · motor do mapa do Navegar (desde v1.69) — carregado antes do navegar.js
 * - 🏙️ Mapbox GL JS (padrão): estilo Mapbox Standard, prédios em 3D, nomes de
 *   rua em pé, inclina e gira de verdade. Luz do mapa (lightPreset):
 *   🌅 dawn, ☀️ day, 🌇 dusk, 🌙 night ou 🌗 automático pelo sol (driveLightPreset).
 *   Token público TOBA_MAPBOX_TOKEN (assets/toba-maps.js).
 * - 🗺️ Plano B = o mapa da v1.66-v1.68 (Leaflet + TomTom/CARTO em imagem):
 *   sem WebGL, ⚙️ "Mapa 3D" desligado, Mapbox recusou (4xx = desliga o Mapbox
 *   por DRIVE_MAPBOX_OFF_HOURS neste aparelho) ou não abriu em DRIVE_MAPBOX_WAIT_MS.
 * - navegar.js e drive-game.js só falam com o objeto de driveCreateMap (nav.map).
 *   Nada aqui grava no TOBA_DRIVE_DB.
 * - Rota, trânsito da rota e limite da via continuam vindo do TomTom (drive-route.js).
 * ===================================================================== */
const DRIVE_MAPBOX_VERSION = "3.7.0";
const DRIVE_MAPBOX_JS = `https://cdn.jsdelivr.net/npm/mapbox-gl@${DRIVE_MAPBOX_VERSION}/dist/mapbox-gl.js`;
const DRIVE_MAPBOX_CSS = `https://cdn.jsdelivr.net/npm/mapbox-gl@${DRIVE_MAPBOX_VERSION}/dist/mapbox-gl.css`;
const DRIVE_MAPBOX_STYLE = "mapbox://styles/mapbox/standard";
const DRIVE_MAPBOX_STATE_KEY = "toba_mapbox_state"; // { offUntil: ms, offWhy } só deste aparelho
const DRIVE_MAPBOX_OFF_HOURS = 6;
const DRIVE_MAPBOX_WAIT_MS = 12000;
const DRIVE_GAME_PITCH = 60;
const DRIVE_LIGHTS = [
  { id: "auto", icon: "🌗", name: "Automático (pelo sol)" },
  { id: "dawn", icon: "🌅", name: "Amanhecer" },
  { id: "day", icon: "☀️", name: "Dia" },
  { id: "dusk", icon: "🌇", name: "Pôr do sol" },
  { id: "night", icon: "🌙", name: "Noite" },
];

/* ---------- liga/desliga do Mapbox neste aparelho ---------- */
function driveMapboxState() {
  try {
    const s = JSON.parse(localStorage.getItem(DRIVE_MAPBOX_STATE_KEY) || "{}") || {};
    return { offUntil: Number(s.offUntil) || 0, offWhy: String(s.offWhy || "") };
  } catch (err) {
    return { offUntil: 0, offWhy: "" };
  }
}

function driveMapboxOff(why) {
  try {
    localStorage.setItem(DRIVE_MAPBOX_STATE_KEY, JSON.stringify({ offUntil: Date.now() + DRIVE_MAPBOX_OFF_HOURS * 3600 * 1000, offWhy: why }));
  } catch (err) {
    /* sem storage: vale só agora */
  }
  console.warn(`Mapbox desligado por ${DRIVE_MAPBOX_OFF_HOURS} h: ${why}`);
}

function driveHasWebGl() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (err) {
    return false;
  }
}

// Mapbox vale agora? (token + ⚙️ ligado + não recusou há pouco + celular com WebGL)
function driveMapboxWanted() {
  return typeof TOBA_MAPBOX_TOKEN === "string" && TOBA_MAPBOX_TOKEN.startsWith("pk.")
    && readDrivePrefs().map3d
    && driveMapboxState().offUntil <= Date.now()
    && driveHasWebGl();
}

let driveMapboxPromise = null;
function loadDriveMapbox() {
  if (window.mapboxgl) return Promise.resolve();
  if (!driveMapboxPromise) {
    driveMapboxPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = DRIVE_MAPBOX_CSS;
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = DRIVE_MAPBOX_JS;
      js.onload = () => (window.mapboxgl ? resolve() : reject(new Error("Mapbox sem mapboxgl")));
      js.onerror = () => reject(new Error("Mapbox não carregou"));
      document.head.appendChild(js);
    }).catch((err) => {
      driveMapboxPromise = null;
      throw err;
    });
  }
  return driveMapboxPromise;
}

/* ---------- luz / estilo ---------- */
// Luz que o mapa deveria ter agora. Mapbox: preset; Leaflet: "light" | "dark".
function driveMapLook(kind, at) {
  const p = readDrivePrefs();
  if (kind === "mapbox") {
    if (p.mapLight !== "auto") return p.mapLight;
    return at ? driveLightPreset(at[0], at[1]) : "day";
  }
  // Leaflet: noite automática só navegando (igual v1.68)
  if (nav.mode === "nav" && p.autoNight && at) return driveIsDark(at[0], at[1]) ? "dark" : "light";
  return p.mapStyle;
}

function driveLightInfo(id) {
  return DRIVE_LIGHTS.find((l) => l.id === id) || DRIVE_LIGHTS[0];
}

/* ---------- criar o mapa (Mapbox, senão Leaflet) ---------- */
async function driveCreateMap(box, center, zoom) {
  if (driveMapboxWanted()) {
    try {
      return await driveMapboxMap(box, center, zoom);
    } catch (err) {
      if (err && err.status >= 400 && err.status < 500) driveMapboxOff(`HTTP ${err.status}`);
      console.warn("Mapbox fora, indo de mapa clássico:", err?.message || err);
      box.innerHTML = "";
      box.className = "dv-map";
    }
  }
  await loadDriveLeaflet();
  return driveLeafletMap(box, center, zoom);
}

/* ---------- Leaflet (plano B: o mapa de antes) ---------- */
function driveLeafletMap(box, center, zoom) {
  const map = L.map(box, { zoomControl: false, attributionControl: true }).setView(center, zoom);
  const style = driveMapLook("leaflet", center);
  const tiles = tobaBaseTiles(map, style, { cartoKey: DRIVE_CARTO_KEY, onFallback: () => typeof renderTrafficBtn === "function" && renderTrafficBtn() });
  const traffic = tobaTrafficTiles(map, style);
  traffic.tobaSetOn(readDrivePrefs().traffic);
  const routeLayer = L.layerGroup().addTo(map);
  const marks = L.layerGroup().addTo(map);
  let car = null;
  let carKey = "";
  box.classList.toggle("is-dark", style === "dark");
  return {
    kind: "leaflet",
    look: style,
    cam: null,
    setView(ll, z, o = {}) {
      map.setView(ll, z, { animate: Boolean(o.animate) });
    },
    fit(points, pad) {
      map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [pad.left, pad.top], paddingBottomRight: [pad.right, pad.bottom] });
    },
    getZoom: () => map.getZoom(),
    resize: () => map.invalidateSize(),
    onClick: (fn) => map.on("click", (ev) => fn({ lat: ev.latlng.lat, lng: ev.latlng.lng })),
    onDragStart: (fn) => map.on("dragstart", fn),
    setRoute(coords, color, jams) {
      routeLayer.clearLayers();
      if (!coords || coords.length < 2) return;
      L.polyline(coords, { color: "#0d1117", weight: 10, opacity: 0.55 }).addTo(routeLayer);
      L.polyline(coords, { color, weight: 6, opacity: 0.95 }).addTo(routeLayer);
      (jams || []).forEach((j) => L.polyline(j.coords, { color: j.color, weight: 6, opacity: 0.95 }).addTo(routeLayer));
    },
    clearMarks: () => marks.clearLayers(),
    addMark(ll, html, o = {}) {
      L.marker(ll, { icon: L.divIcon({ className: o.className || "dv-flag-wrap", html, iconSize: o.size || [32, 32], iconAnchor: o.anchor || [16, 16] }), interactive: false }).addTo(marks);
    },
    // carango: cria (ou recria se trocou) e devolve o elemento pra mexer no giro
    car(ll, html, key) {
      if (car && carKey !== key) {
        car.remove();
        car = null;
      }
      if (!car) {
        car = L.marker(ll, { icon: L.divIcon({ className: "dv-car-wrap", html, iconSize: [40, 40], iconAnchor: [20, 20] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
        carKey = key;
      } else {
        car.setLatLng(ll);
      }
      return car.getElement();
    },
    dropCar() {
      if (car) car.remove();
      car = null;
    },
    screenHeading: (h) => h, // o giro do modo jogo no Leaflet é CSS (drive-game.js)
    setLook(next) {
      this.look = next;
      tiles.tobaSetStyle(next);
      traffic.tobaSetStyle(next);
      box.classList.toggle("is-dark", next === "dark");
    },
    setTraffic: (on) => traffic.tobaSetOn(on),
    trafficReady: () => tobaTomTomOn(),
    destroy() {
      traffic.tobaSetOn(false);
      map.remove();
    },
  };
}

/* ---------- Mapbox (3D) ---------- */
async function driveMapboxMap(box, center, zoom) {
  await loadDriveMapbox();
  const look = driveMapLook("mapbox", center);
  const map = new mapboxgl.Map({
    container: box,
    accessToken: TOBA_MAPBOX_TOKEN,
    style: DRIVE_MAPBOX_STYLE,
    config: { basemap: { lightPreset: look, showPointOfInterestLabels: true, showTransitLabels: false } },
    center: [center[1], center[0]],
    zoom,
    language: "pt",
    attributionControl: true,
    logoPosition: "bottom-right",
    preserveDrawingBuffer: false,
  });
  await new Promise((resolve, reject) => {
    let done = false;
    const fail = (err) => {
      if (done) return;
      done = true;
      try {
        map.remove();
      } catch (e) {
        /* já era */
      }
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error("Mapbox demorou")), DRIVE_MAPBOX_WAIT_MS);
    map.once("style.load", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    });
    map.on("error", (ev) => {
      const st = Number(ev?.error?.status) || 0;
      if (!done && st >= 400 && st < 500) {
        clearTimeout(timer);
        fail(Object.assign(new Error(`Mapbox HTTP ${st}`), { status: st }));
      }
    });
  });

  // Rota: uma fonte, linha escura por baixo e a cor (trechos com trânsito por cima)
  map.addSource("dv-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "dv-route-casing",
    type: "line",
    source: "dv-route",
    slot: "top",
    filter: ["==", ["get", "k"], "base"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#0d1117", "line-opacity": 0.6, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 16, 12, 19, 30], "line-emissive-strength": 1 },
  });
  map.addLayer({
    id: "dv-route-line",
    type: "line",
    source: "dv-route",
    slot: "top",
    layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "z"] },
    paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3.5, 16, 8, 19, 20], "line-emissive-strength": 1 },
  });

  let marks = [];
  let car = null;
  let carKey = "";
  let lastRoute = null;
  const toLngLat = (ll) => [ll[1], ll[0]];
  const pad0 = { top: 0, bottom: 0, left: 0, right: 0 };
  const el = (html, className) => {
    const d = document.createElement("div");
    d.className = className;
    d.innerHTML = html;
    return d;
  };
  box.classList.add("is-3d");
  box.classList.toggle("is-dark", look === "night" || look === "dusk");

  const api = {
    kind: "mapbox",
    look,
    cam: null, // modo jogo: { bearing, pitch, padTop } (drive-game.js)
    raw: map,
    setView(ll, z, o = {}) {
      const cam = api.cam;
      map.easeTo({
        center: toLngLat(ll),
        zoom: z,
        bearing: o.bearing ?? (cam ? cam.bearing : 0),
        pitch: o.pitch ?? (cam ? cam.pitch : 0),
        padding: cam ? { ...pad0, top: Math.round(box.clientHeight * cam.padTop) } : pad0,
        duration: o.animate ? 900 : 0,
        essential: true,
      });
    },
    fit(points, pad) {
      let w = Infinity;
      let s = Infinity;
      let e = -Infinity;
      let n = -Infinity;
      points.forEach(([lat, lng]) => {
        w = Math.min(w, lng);
        e = Math.max(e, lng);
        s = Math.min(s, lat);
        n = Math.max(n, lat);
      });
      map.jumpTo({ bearing: 0, pitch: 0, padding: pad0 });
      map.fitBounds([[w, s], [e, n]], { padding: pad, duration: 0, maxZoom: 17 });
    },
    getZoom: () => map.getZoom(),
    resize: () => map.resize(),
    onClick: (fn) => map.on("click", (ev) => fn({ lat: ev.lngLat.lat, lng: ev.lngLat.lng })),
    // só gesto do dedo (easeTo do Toba não dispara)
    onDragStart: (fn) => ["dragstart", "rotatestart", "pitchstart"].forEach((t) => map.on(t, (ev) => ev.originalEvent && fn())),
    setRoute(coords, color, jams) {
      lastRoute = coords && coords.length > 1 ? { coords, color, jams } : null;
      const feats = [];
      if (lastRoute) {
        const line = (c, props) => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: c.map(toLngLat) } });
        feats.push(line(coords, { k: "base", color, z: 0 }));
        if (readDrivePrefs().traffic) (jams || []).forEach((j) => feats.push(line(j.coords, { k: "jam", color: j.color, z: 1 })));
      }
      map.getSource("dv-route")?.setData({ type: "FeatureCollection", features: feats });
    },
    clearMarks() {
      marks.forEach((m) => m.remove());
      marks = [];
    },
    addMark(ll, html, o = {}) {
      const size = o.size || [32, 32];
      const anchor = o.anchor || [size[0] / 2, size[1] / 2];
      const d = el(html, o.className || "dv-flag-wrap");
      d.style.width = `${size[0]}px`;
      d.style.height = `${size[1]}px`;
      // âncora do Leaflet (px a partir do canto de cima) -> offset do Mapbox (a partir do centro)
      marks.push(new mapboxgl.Marker({ element: d, anchor: "center", offset: [size[0] / 2 - anchor[0], size[1] / 2 - anchor[1]] }).setLngLat(toLngLat(ll)).addTo(map));
    },
    car(ll, html, key) {
      if (car && carKey !== key) {
        car.remove();
        car = null;
      }
      if (!car) {
        const d = el(html, "dv-car-wrap");
        d.style.width = "40px";
        d.style.height = "40px";
        car = new mapboxgl.Marker({ element: d, anchor: "center" }).setLngLat(toLngLat(ll)).addTo(map);
        carKey = key;
      } else {
        car.setLngLat(toLngLat(ll));
      }
      return car.getElement();
    },
    dropCar() {
      if (car) car.remove();
      car = null;
    },
    // carango fica de pé na tela: o rumo dele menos o giro do mapa
    screenHeading: (h) => (Number.isFinite(h) ? h - map.getBearing() : h),
    setLook(next) {
      if (next === api.look) return;
      api.look = next;
      try {
        map.setConfigProperty("basemap", "lightPreset", next);
      } catch (err) {
        /* estilo sem luz: ignora */
      }
      box.classList.toggle("is-dark", next === "night" || next === "dusk");
    },
    // 🚦 no 3D: trânsito só na linha da rota (trechos lentos/parados do TomTom)
    setTraffic() {
      if (lastRoute) api.setRoute(lastRoute.coords, lastRoute.color, lastRoute.jams);
      return true;
    },
    trafficReady: () => true,
    destroy() {
      map.remove();
    },
  };
  return api;
}

/* ---------- logo e créditos do mapa sempre à vista (regra do Mapbox) ----------
 * Sobe os controles de baixo do mapa até acima do card/painel que cobre o pé da tela. */
function driveMapLiftControls() {
  const box = document.getElementById("driveMap");
  if (!box) return;
  const bottom = box.parentElement ? box.parentElement.getBoundingClientRect().bottom : window.innerHeight;
  let lift = 0;
  ["navPanel", "previewCard"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.hidden) lift = Math.max(lift, bottom - el.getBoundingClientRect().top + 6);
  });
  box.style.setProperty("--dv-map-lift", `${Math.max(0, Math.round(lift))}px`);
}

window.addEventListener("resize", () => driveMapLiftControls());
