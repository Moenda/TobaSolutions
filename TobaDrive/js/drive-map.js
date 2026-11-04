/* =====================================================================
 * Toba Drive · motor do mapa do Navegar (desde v1.69) — carregado antes do navegar.js
 * - 🏙️ Mapbox GL JS: estilo Mapbox Standard, prédios em 3D, nomes de rua em pé,
 *   inclina e gira de verdade. Luz do mapa (lightPreset): 🌅 dawn, ☀️ day,
 *   🌇 dusk, 🌙 night ou 🌗 automático pelo sol (driveLightPreset).
 *   Token público TOBA_MAPBOX_TOKEN (assets/toba-maps.js).
 * - v1.70: só Mapbox (o mapa clássico Leaflet/TomTom/CARTO saiu do Navegar).
 *   Sem WebGL ou Mapbox fora = aviso no lugar do mapa; a navegação (voz, faixa,
 *   velocímetro) segue sem mapa e o ↗️ abre no Maps/Waze.
 * - v1.70: 🚗 carango DENTRO do mapa (camadas do Mapbox, não mais um <div> por
 *   cima): seta e Toba GT são modelos 3D de verdade (drive-models.js) que somem
 *   atrás dos prédios; emoji fica em pé no chão, com sombra. Anda deslizando
 *   entre uma leitura do GPS e outra.
 * - v1.70: 🚦 trânsito ao vivo da cidade inteira = tileset mapbox-traffic-v1
 *   (moderado/pesado/parado, atualiza a cada DRIVE_TRAFFIC_RELOAD_MS) por cima
 *   das ruas e da linha da rota. Os trechos parados do TomTom continuam na rota.
 * - navegar.js e drive-game.js só falam com o objeto de driveCreateMap (nav.map).
 *   Nada aqui grava no TOBA_DRIVE_DB.
 * ===================================================================== */
const DRIVE_MAPBOX_VERSION = "3.7.0";
const DRIVE_MAPBOX_JS = `https://cdn.jsdelivr.net/npm/mapbox-gl@${DRIVE_MAPBOX_VERSION}/dist/mapbox-gl.js`;
const DRIVE_MAPBOX_CSS = `https://cdn.jsdelivr.net/npm/mapbox-gl@${DRIVE_MAPBOX_VERSION}/dist/mapbox-gl.css`;
const DRIVE_MAPBOX_STYLE = "mapbox://styles/mapbox/standard";
const DRIVE_MAPBOX_TRAFFIC = "mapbox://mapbox.mapbox-traffic-v1";
const DRIVE_MAPBOX_WAIT_MS = 15000;
const DRIVE_TRAFFIC_RELOAD_MS = 3 * 60 * 1000;
const DRIVE_CAR_GLIDE_MS = 850;
const DRIVE_GAME_PITCH = 60;
const DRIVE_TRAFFIC_COLORS = { moderate: "#f59e0b", heavy: "#ef4444", severe: "#991b1b" };
const DRIVE_LIGHTS = [
  { id: "auto", icon: "🌗", name: "Automático (pelo sol)" },
  { id: "dawn", icon: "🌅", name: "Amanhecer" },
  { id: "day", icon: "☀️", name: "Dia" },
  { id: "dusk", icon: "🌇", name: "Pôr do sol" },
  { id: "night", icon: "🌙", name: "Noite" },
];

function driveHasWebGl() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (err) {
    return false;
  }
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
      driveMapboxPromise = null; // tenta de novo na próxima
      throw err;
    });
  }
  return driveMapboxPromise;
}

/* ---------- luz ---------- */
// Luz que o mapa deveria ter agora (preset do Mapbox)
function driveMapLook(at) {
  const p = readDrivePrefs();
  if (p.mapLight !== "auto") return p.mapLight;
  return at ? driveLightPreset(at[0], at[1]) : "day";
}

function driveLightInfo(id) {
  return DRIVE_LIGHTS.find((l) => l.id === id) || DRIVE_LIGHTS[0];
}

/* ---------- emoji vira imagem do mapa ---------- */
// face "left": o emoji olha pra esquerda; a versão "-r" é espelhada (andando pra direita da tela)
function driveEmojiImage(icon, mirror) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `${Math.round(size * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  if (mirror) {
    g.translate(size, 0);
    g.scale(-1, 1);
  }
  g.fillText(icon, size / 2, size * 0.56);
  return g.getImageData(0, 0, size, size);
}

/* ---------- criar o mapa ---------- */
async function driveCreateMap(box, center, zoom) {
  if (typeof TOBA_MAPBOX_TOKEN !== "string" || !TOBA_MAPBOX_TOKEN.startsWith("pk.")) throw Object.assign(new Error("Sem token do Mapbox"), { why: "token" });
  if (!driveHasWebGl()) throw Object.assign(new Error("Sem WebGL"), { why: "webgl" });
  await loadDriveMapbox();
  return driveMapboxMap(box, center, zoom);
}

async function driveMapboxMap(box, center, zoom) {
  const look = driveMapLook(center);
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
        fail(Object.assign(new Error(`Mapbox HTTP ${st}`), { status: st, why: "http" }));
      }
    });
  });

  const empty = { type: "FeatureCollection", features: [] };
  // Rota: uma fonte, linha escura por baixo e a cor (trechos parados do TomTom por cima)
  map.addSource("dv-route", { type: "geojson", data: empty });
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

  // 🚦 Trânsito ao vivo (Mapbox Traffic): só o que tá lento/parado, mais fino que a rota
  let trafficOk = true;
  let trafficTimer = null;
  try {
    map.addSource("dv-traffic", { type: "vector", url: DRIVE_MAPBOX_TRAFFIC });
    map.addLayer({
      id: "dv-traffic",
      type: "line",
      source: "dv-traffic",
      "source-layer": "traffic",
      slot: "top",
      filter: ["match", ["get", "congestion"], ["moderate", "heavy", "severe"], true, false],
      layout: { "line-cap": "round", "line-join": "round", visibility: readDrivePrefs().traffic ? "visible" : "none" },
      paint: {
        "line-color": ["match", ["get", "congestion"], "severe", DRIVE_TRAFFIC_COLORS.severe, "heavy", DRIVE_TRAFFIC_COLORS.heavy, DRIVE_TRAFFIC_COLORS.moderate],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 14, 2.5, 17, 5, 19, 10],
        // mão e contramão lado a lado (cada sentido vem numa linha)
        "line-offset": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 16, 2.5, 19, 6],
        "line-opacity": 0.92,
        "line-emissive-strength": 1,
      },
    });
  } catch (err) {
    trafficOk = false;
    console.warn("Trânsito do Mapbox não entrou:", err?.message || err);
  }
  const trafficTick = () => {
    if (document.hidden || !readDrivePrefs().traffic) return;
    try {
      map.getSource("dv-traffic")?.reload();
    } catch (err) {
      /* fonte ainda carregando */
    }
  };
  if (trafficOk) trafficTimer = setInterval(trafficTick, DRIVE_TRAFFIC_RELOAD_MS);

  // 🚗 Carango: modelo 3D (seta / Toba GT) ou emoji em pé no chão com sombra
  map.addSource("dv-car", { type: "geojson", data: empty });
  map.addLayer({
    id: "dv-car-shadow",
    type: "circle",
    source: "dv-car",
    slot: "top",
    paint: {
      "circle-pitch-alignment": "map",
      "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 13, 5, 17, 15, 19, 34],
      "circle-color": ["get", "glow"],
      "circle-opacity": ["get", "glowA"],
      "circle-blur": 0.75,
      "circle-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: "dv-car-model",
    type: "model",
    source: "dv-car",
    slot: "top",
    filter: ["==", ["get", "kind"], "model"],
    layout: { "model-id": ["get", "model"] },
    paint: {
      "model-type": "common-3d",
      // exagerado de propósito (carro de 4 m some no zoom de rua): ~30-40 px na tela
      "model-scale": ["interpolate", ["exponential", 2], ["zoom"], 13, ["literal", [88, 88, 88]], 17, ["literal", [11, 11, 11]], 19, ["literal", [4, 4, 4]]],
      // modelo nasce olhando pro sul: +180 = olhando pro rumo
      "model-rotation": ["literal", [0, 0, 180]],
      "model-cast-shadows": true,
      "model-receive-shadows": false,
      // seta = brilho fixo (é marcador); GT pega a luz do mapa e brilha mais de noite (em, no car())
      "model-emissive-strength": ["get", "em"],
    },
  });
  map.addLayer({
    id: "dv-car-emoji",
    type: "symbol",
    source: "dv-car",
    slot: "top",
    filter: ["==", ["get", "kind"], "emoji"],
    layout: {
      "icon-image": ["get", "img"],
      "icon-anchor": "bottom",
      "icon-offset": [0, 8],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.55, 16, 0.85, 18, 1.15, 19, 1.4],
      "icon-rotate": ["get", "rot"],
      "icon-rotation-alignment": "viewport",
      "icon-pitch-alignment": "viewport",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "symbol-z-elevate": false,
    },
    paint: { "icon-occlusion-opacity": 0.35, "icon-emissive-strength": 1 },
  });

  let marks = [];
  let lastRoute = null;
  const car = { shown: null, target: null, from: null, t0: 0, raf: 0, props: null };
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

  const carRender = () => {
    if (!car.shown || !car.props) return;
    const p = car.props;
    const props = { ...p, rot: p.rot ?? 0 };
    map.getSource("dv-car")?.setData({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [car.shown.lng, car.shown.lat] } });
    if (p.kind === "model") map.setPaintProperty("dv-car-model", "model-rotation", ["literal", [0, 0, (car.shown.h + 180) % 360]]);
  };
  // desliza do ponto mostrado até o novo em DRIVE_CAR_GLIDE_MS (giro pelo lado mais curto)
  const carStep = () => {
    car.raf = 0;
    if (!car.target) return;
    const k = Math.min(1, (performance.now() - car.t0) / DRIVE_CAR_GLIDE_MS);
    const e = k * (2 - k);
    const f = car.from;
    const t = car.target;
    const dh = ((t.h - f.h + 540) % 360) - 180;
    car.shown = { lat: f.lat + (t.lat - f.lat) * e, lng: f.lng + (t.lng - f.lng) * e, h: (f.h + dh * e + 360) % 360 };
    carRender();
    if (k < 1) car.raf = requestAnimationFrame(carStep);
  };
  const ensureModel = (id, kind, color) => {
    if (map.hasModel && map.hasModel(id)) return;
    map.addModel(id, driveModelUrl(kind, color));
  };
  const ensureEmoji = (veh) => {
    const id = `dv-veh-${veh.id}`;
    if (!map.hasImage(id)) map.addImage(id, driveEmojiImage(veh.icon, false), { pixelRatio: 2 });
    if (veh.face === "left" && !map.hasImage(`${id}-r`)) map.addImage(`${id}-r`, driveEmojiImage(veh.icon, true), { pixelRatio: 2 });
    return id;
  };

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
        duration: o.animate ? DRIVE_CAR_GLIDE_MS : 0,
        easing: (k) => k * (2 - k),
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
      // âncora em px a partir do canto de cima -> offset do Mapbox (a partir do centro)
      marks.push(new mapboxgl.Marker({ element: d, anchor: "center", offset: [size[0] / 2 - anchor[0], size[1] / 2 - anchor[1]] }).setLngLat(toLngLat(ll)).addTo(map));
    },
    // carango: ll = [lat,lng] (já grudado na rota pelo navegar.js), heading = rumo em graus
    // veh = item de DRIVE_VEHICLES, color = cor da rota (pinta a seta/GT), isNav = navegando
    car(ll, heading, veh, color, isNav) {
      const h = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : car.target?.h ?? 0;
      const target = { lat: ll[0], lng: ll[1], h };
      let props;
      if (veh.face === "arrow" || veh.face === "model") {
        const kind = veh.face === "model" ? "gt" : "arrow";
        const id = `dv-${kind}-${color.replace("#", "")}`;
        ensureModel(id, kind, color);
        const dark = api.look === "night" || api.look === "dusk";
        props = { kind: "model", model: id, em: kind === "arrow" ? 0.85 : dark ? 0.7 : 0.3, glow: color, glowA: isNav ? 0.55 : 0.4 };
      } else {
        const base = ensureEmoji(veh);
        // na tela: rumo menos o giro do mapa (o emoji de lado vira pro lado que anda)
        const screen = (((h - map.getBearing()) % 360) + 360) % 360;
        let img = base;
        let rot = 0;
        if (veh.face === "left" && screen > 0 && screen < 180) img = `${base}-r`;
        if (veh.face === "up") rot = Math.round(screen - 45); // 🚀 já nasce apontando pra 45°
        props = { kind: "emoji", img, rot, glow: "#000000", glowA: 0.5 };
      }
      car.props = props;
      // pulo grande (1ª vez, GPS doido) = aparece direto; senão desliza
      const far = !car.shown || Math.abs(car.shown.lat - target.lat) + Math.abs(car.shown.lng - target.lng) > 0.003;
      if (far) {
        car.shown = target;
        car.target = target;
        carRender();
        return;
      }
      car.from = { ...car.shown };
      car.target = target;
      car.t0 = performance.now();
      if (!car.raf) car.raf = requestAnimationFrame(carStep);
    },
    dropCar() {
      car.shown = null;
      car.target = null;
      map.getSource("dv-car")?.setData(empty);
    },
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
    setTraffic(on) {
      if (trafficOk) {
        try {
          map.setLayoutProperty("dv-traffic", "visibility", on ? "visible" : "none");
          if (on) trafficTick();
        } catch (err) {
          /* camada fora */
        }
      }
      if (lastRoute) api.setRoute(lastRoute.coords, lastRoute.color, lastRoute.jams);
      return true;
    },
    trafficReady: () => true,
    destroy() {
      if (trafficTimer) clearInterval(trafficTimer);
      if (car.raf) cancelAnimationFrame(car.raf);
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
