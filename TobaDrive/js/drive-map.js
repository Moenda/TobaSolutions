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
 *   cima): seta e carangos são modelos 3D de verdade (drive-models.js) que somem
 *   atrás dos prédios; emoji fica em pé no chão, com sombra. Anda deslizando
 *   entre uma leitura do GPS e outra.
 * - v1.70: 🚦 trânsito ao vivo da cidade inteira = tileset mapbox-traffic-v1
 *   (moderado/pesado/parado, atualiza a cada DRIVE_TRAFFIC_RELOAD_MS) por cima
 *   das ruas e da linha da rota. Os trechos parados do TomTom continuam na rota.
 * - v1.73: trânsito da rota casado pelo sentido e distância (driveRouteTrafficRuns)
 *   e pintado largo embaixo do risco; nas outras ruas fica fininho. 📸 radares em
 *   camada própria (setRadars), não somem quando a rota é redesenhada.
 * - navegar.js e drive-game.js só falam com o objeto de driveCreateMap (nav.map).
 *   Nada aqui grava no TOBA_DRIVE_DB.
 * ===================================================================== */
const DRIVE_MAPBOX_VERSION = "3.7.0";
const DRIVE_MAPBOX_JS = `https://cdn.jsdelivr.net/npm/mapbox-gl@${DRIVE_MAPBOX_VERSION}/dist/mapbox-gl.js`;
const DRIVE_MAPBOX_CSS = `https://cdn.jsdelivr.net/npm/mapbox-gl@${DRIVE_MAPBOX_VERSION}/dist/mapbox-gl.css`;
const DRIVE_MAPBOX_STYLE = "mapbox://styles/mapbox/standard";
const DRIVE_MAPBOX_TRAFFIC = "mapbox://mapbox.mapbox-traffic-v1";
// v1.81: rota e trânsito aparecem meio transparentes atrás dos prédios (igual o Android Auto)
const DRIVE_SEE_THROUGH = 0.55;
const DRIVE_MAPBOX_WAIT_MS = 15000;
const DRIVE_TRAFFIC_RELOAD_MS = 3 * 60 * 1000;
const DRIVE_CAR_GLIDE_MS = 850;
// v1.71: tamanho do carango 3D NA TELA (px de LARGURA: no modo jogo ele é visto de
// trás, então a largura é o que aparece), igual em qualquer zoom
// (v1.70 crescia no zoom pra fora: o "carro do Godzilla")
const DRIVE_CAR_PX = 34;
// largura de cada modelo: DRIVE_MODEL_SPECS (drive-models.js, v1.77)
// v1.71: farol no chão (cone amarelinho na frente do carango) de noite / pôr do sol / amanhecer
const DRIVE_BEAM_LOOKS = ["night", "dusk", "dawn"];

// Brilho próprio do modelo 3D (model-emissive-strength): seta é marcador (sempre acesa);
// o GT pega a luz do mapa de dia e acende de vez de noite (v1.71: antes ficava quase preto)
// v1.77: OVNI e fantasma também brilham sozinhos (DRIVE_MODEL_SPECS.lit)
function driveModelGlow(kind, look) {
  if (DRIVE_MODEL_SPECS[kind]?.lit) return 0.9;
  return { night: 1, dusk: 0.85, dawn: 0.6 }[look] ?? 0.3;
}
const DRIVE_GAME_PITCH = 60;
// v1.71: amarelo de verdade no lento (o âmbar da v1.70 se misturava com a rota laranja)
// v1.72: verde (low) saiu de novo, a cidade toda ficava verde
const DRIVE_TRAFFIC_COLORS = { moderate: "#facc15", heavy: "#ef4444", severe: "#b91c1c" };
// v1.71: faixa do trânsito larga, por baixo do risco fino da rota
const DRIVE_TRAFFIC_CITY_WIDTH = ["interpolate", ["linear"], ["zoom"], 10, 1.2, 13, 2, 15, 3, 16, 3.5, 18, 5.5, 19, 7];
const DRIVE_TRAFFIC_WIDTH = ["interpolate", ["linear"], ["zoom"], 10, 3, 13, 7, 15, 11, 16, 14, 18, 22, 19, 28];
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

/* v1.73: trânsito NA rota. O tileset do Mapbox desenha cada rua (e cada pista) do
 * jeito dele, então a faixa larga da rua do lado (ex.: expressa da 23 de Maio)
 * parecia a rota e a rota de verdade ficava sem cor. Agora: a cada ~8 m da rota,
 * acha o trecho do tileset MAIS PERTO (até 12 m) que vai no MESMO sentido (até 35°)
 * e pinta aquele pedaço da própria rota com a cor dele. Livre (low) também conta
 * como "mais perto", pra rua vizinha parada não pintar a rota que está livre. */
const DRIVE_RT_STEP_M = 8;
const DRIVE_RT_NEAR_M = 12;
const DRIVE_RT_ANGLE = 35;
const DRIVE_RT_TIE_M = 4;
const DRIVE_RT_CELL_M = 40;
const DRIVE_RT_LEVEL = { low: 0, moderate: 1, heavy: 2, severe: 3 };
const DRIVE_RT_NAME = ["", "moderate", "heavy", "severe"];

// route = [[lng,lat]...]; lines = [{ level 0..3, coords [[lng,lat]...] }] (no sentido do tráfego)
// devolve [{ c: "moderate"|"heavy"|"severe", coords: [[lng,lat]...] }]
function driveRouteTrafficRuns(route, lines) {
  if (!route || route.length < 2 || !lines?.length) return [];
  const lat0 = route[0][1];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  const P = route.map(([x, y]) => [x * kx, y * ky]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  P.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  const near = DRIVE_RT_NEAR_M;
  // grade com os trechos do trânsito perto da rota
  const grid = new Map();
  const segs = [];
  const key = (cx, cy) => `${cx}|${cy}`;
  lines.forEach((ln) => {
    const c = ln.coords || [];
    for (let i = 0; i + 1 < c.length; i++) {
      const ax = c[i][0] * kx;
      const ay = c[i][1] * ky;
      const bx = c[i + 1][0] * kx;
      const by = c[i + 1][1] * ky;
      if (Math.max(ax, bx) < minX - near || Math.min(ax, bx) > maxX + near || Math.max(ay, by) < minY - near || Math.min(ay, by) > maxY + near) continue;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.5) continue;
      const s = { ax, ay, bx, by, len, h: (Math.atan2(bx - ax, by - ay) * 180) / Math.PI, level: ln.level };
      const idx = segs.push(s) - 1;
      const x0 = Math.floor((Math.min(ax, bx) - near) / DRIVE_RT_CELL_M);
      const x1 = Math.floor((Math.max(ax, bx) + near) / DRIVE_RT_CELL_M);
      const y0 = Math.floor((Math.min(ay, by) - near) / DRIVE_RT_CELL_M);
      const y1 = Math.floor((Math.max(ay, by) + near) / DRIVE_RT_CELL_M);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const k = key(cx, cy);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(idx);
        }
      }
    }
  });
  if (!segs.length) return [];
  // anda pela rota de 8 em 8 m
  const bins = [];
  const binAt = []; // along (m) de cada amostra
  let along = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i];
    const [bx, by] = P[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const h = (Math.atan2(bx - ax, by - ay) * 180) / Math.PI;
    for (let d = bins.length * DRIVE_RT_STEP_M - along; d < len; d += DRIVE_RT_STEP_M) {
      const qx = ax + ((bx - ax) * d) / len;
      const qy = ay + ((by - ay) * d) / len;
      // candidatos no mesmo sentido; o mais perto manda, mas o que estiver até
      // DRIVE_RT_TIE_M mais longe também vale (GPS/desenho de mapas diferentes) e pega o pior
      const cands = [];
      let bestD = near;
      (grid.get(key(Math.floor(qx / DRIVE_RT_CELL_M), Math.floor(qy / DRIVE_RT_CELL_M))) || []).forEach((si) => {
        const s = segs[si];
        const dh = Math.abs(((s.h - h + 540) % 360) - 180);
        if (dh > DRIVE_RT_ANGLE) return;
        const t = Math.max(0, Math.min(1, ((qx - s.ax) * (s.bx - s.ax) + (qy - s.ay) * (s.by - s.ay)) / (s.len * s.len)));
        const dist = Math.hypot(qx - (s.ax + (s.bx - s.ax) * t), qy - (s.ay + (s.by - s.ay) * t));
        if (dist > near) return;
        cands.push([dist, s.level]);
        bestD = Math.min(bestD, dist);
      });
      let lv = -1;
      cands.forEach(([dist, level]) => {
        if (dist <= bestD + DRIVE_RT_TIE_M) lv = Math.max(lv, level);
      });
      bins.push(lv);
      binAt.push(along + d);
    }
    along += len;
  }
  // buraquinho de até 3 amostras (cruzamento, tile cortado) entre dois trechos lentos: emenda
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] > 0) continue;
    let j = i;
    while (j < bins.length && bins[j] <= 0) j++;
    if (i > 0 && j < bins.length && j - i <= 3 && bins[i - 1] > 0) {
      const lv = Math.min(bins[i - 1], bins[j]);
      for (let k = i; k < j; k++) bins[k] = lv;
    }
    i = j - 1;
  }
  // pedaços seguidos com a mesma cor (mínimo 2 amostras = ~16 m)
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const cut = (a, b) => {
    const out = [];
    const at = (m) => {
      let i = 0;
      while (i + 2 < cum.length && cum[i + 1] < m) i++;
      const seg = cum[i + 1] - cum[i] || 1;
      const t = Math.max(0, Math.min(1, (m - cum[i]) / seg));
      return { i, p: [route[i][0] + (route[i + 1][0] - route[i][0]) * t, route[i][1] + (route[i + 1][1] - route[i][1]) * t] };
    };
    const s = at(a);
    const e = at(b);
    out.push(s.p);
    for (let i = s.i + 1; i <= e.i; i++) out.push(route[i]);
    out.push(e.p);
    return out;
  };
  const runs = [];
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] <= 0) continue;
    let j = i;
    while (j + 1 < bins.length && bins[j + 1] === bins[i]) j++;
    if (j > i) {
      const a = Math.max(0, binAt[i] - DRIVE_RT_STEP_M / 2);
      const b = Math.min(cum[cum.length - 1], binAt[j] + DRIVE_RT_STEP_M / 2);
      runs.push({ c: DRIVE_RT_NAME[bins[i]], coords: cut(a, b) });
    }
    i = j;
  }
  return runs;
}

/* ---------- 📸 radar: plaquinha de limite (ou 📸 sem limite) ---------- */
function driveRadarImage(limit) {
  const size = 96;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  g.fillStyle = "#ffffff";
  g.fill();
  g.lineWidth = size * 0.11;
  g.strokeStyle = "#dc2626";
  g.stroke();
  if (limit) {
    g.fillStyle = "#111111";
    g.font = `900 ${Math.round(size * (String(limit).length > 2 ? 0.34 : 0.42))}px system-ui,"Segoe UI",Roboto,sans-serif`;
    g.fillText(String(limit), size / 2, size * 0.53);
  } else {
    g.font = `${Math.round(size * 0.46)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText("📸", size / 2, size * 0.54);
  }
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
  // v1.71: a rota é um risco fino por cima; o trânsito (Mapbox e trechos parados do TomTom)
  // vai POR BAIXO, mais largo, e aparece como faixa colorida em volta do risco.
  map.addSource("dv-route", { type: "geojson", data: empty });
  map.addLayer({
    id: "dv-route-jam",
    type: "line",
    source: "dv-route",
    slot: "top",
    filter: ["==", ["get", "k"], "jam"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": DRIVE_TRAFFIC_WIDTH, "line-opacity": 0.95, "line-emissive-strength": 1, "line-occlusion-opacity": DRIVE_SEE_THROUGH },
  });
  // v1.73: trânsito casado com a rota (driveRouteTrafficRuns), faixa larga embaixo do risco
  map.addSource("dv-route-traffic", { type: "geojson", data: empty });
  map.addLayer({
    id: "dv-route-traffic",
    type: "line",
    source: "dv-route-traffic",
    slot: "top",
    layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["match", ["get", "c"], "severe", 3, "heavy", 2, 1] },
    paint: {
      "line-color": ["match", ["get", "c"], "severe", DRIVE_TRAFFIC_COLORS.severe, "heavy", DRIVE_TRAFFIC_COLORS.heavy, DRIVE_TRAFFIC_COLORS.moderate],
      "line-width": DRIVE_TRAFFIC_WIDTH,
      "line-opacity": 0.95,
      "line-emissive-strength": 1,
      "line-occlusion-opacity": DRIVE_SEE_THROUGH,
    },
  }, "dv-route-jam");
  map.addLayer({
    id: "dv-route-casing",
    type: "line",
    source: "dv-route",
    slot: "top",
    filter: ["==", ["get", "k"], "base"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#0d1117", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 4.5, 16, 8, 19, 16], "line-emissive-strength": 1, "line-occlusion-opacity": DRIVE_SEE_THROUGH },
  });
  map.addLayer({
    id: "dv-route-line",
    type: "line",
    source: "dv-route",
    slot: "top",
    filter: ["==", ["get", "k"], "base"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 16, 5, 19, 11], "line-emissive-strength": 1, "line-occlusion-opacity": DRIVE_SEE_THROUGH },
  });

  // 🚦 Trânsito ao vivo (Mapbox Traffic): verde livre, amarelo lento, vermelho pesado, vinho parado.
  // Fica embaixo da rota (beforeId "dv-route-jam"), mais largo que ela.
  let trafficOk = true;
  let trafficTimer = null;
  try {
    map.addSource("dv-traffic", { type: "vector", url: DRIVE_MAPBOX_TRAFFIC });
    const trafficFilter = ["match", ["get", "congestion"], ["moderate", "heavy", "severe"], true, false];
    const trafficOffset = ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3, 19, 6];
    const vis = readDrivePrefs().traffic ? "visible" : "none";
    // v1.73: rua que NÃO é a rota = linha fininha e meio apagada (não confunde com a rota)
    map.addLayer({
      id: "dv-traffic",
      type: "line",
      source: "dv-traffic",
      "source-layer": "traffic",
      slot: "top",
      filter: trafficFilter,
      layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["match", ["get", "congestion"], "severe", 3, "heavy", 2, "moderate", 1, 0], visibility: vis },
      paint: {
        "line-color": ["match", ["get", "congestion"], "severe", DRIVE_TRAFFIC_COLORS.severe, "heavy", DRIVE_TRAFFIC_COLORS.heavy, DRIVE_TRAFFIC_COLORS.moderate],
        "line-width": DRIVE_TRAFFIC_CITY_WIDTH,
        // mão e contramão lado a lado (cada sentido vem numa linha)
        "line-offset": trafficOffset,
        "line-opacity": 0.7,
        "line-emissive-strength": 1,
        "line-occlusion-opacity": DRIVE_SEE_THROUGH,
      },
    }, "dv-route-traffic");
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

  // casa o trânsito com a rota (no máximo 1 vez a cada 1,5 s; tiles novos ou mapa mexeu)
  let rtTimer = null;
  let rtLast = 0;
  const routeTrafficNow = () => {
    rtTimer = null;
    rtLast = Date.now();
    let runs = [];
    if (trafficOk && lastRoute && readDrivePrefs().traffic) {
      const lines = [];
      try {
        map.querySourceFeatures("dv-traffic", { sourceLayer: "traffic" }).forEach((f) => {
          const lv = DRIVE_RT_LEVEL[f.properties?.congestion];
          if (lv === undefined) return;
          const g = f.geometry;
          if (g?.type === "LineString") lines.push({ level: lv, coords: g.coordinates });
          else if (g?.type === "MultiLineString") g.coordinates.forEach((c) => lines.push({ level: lv, coords: c }));
        });
        runs = driveRouteTrafficRuns(lastRoute.coords.map(toLngLat), lines);
      } catch (err) {
        runs = [];
      }
    }
    map.getSource("dv-route-traffic")?.setData({
      type: "FeatureCollection",
      features: runs.map((r) => ({ type: "Feature", properties: { c: r.c }, geometry: { type: "LineString", coordinates: r.coords } })),
    });
  };
  const routeTrafficSoon = () => {
    if (rtTimer) return;
    rtTimer = setTimeout(routeTrafficNow, Math.max(300, 1500 - (Date.now() - rtLast)));
  };
  if (trafficOk) {
    map.on("sourcedata", (ev) => {
      if (ev.sourceId === "dv-traffic" && ev.tile) routeTrafficSoon();
    });
    map.on("moveend", routeTrafficSoon);
  }

  // 📸 radares (drive-game.js manda a lista): plaquinha com o limite, em pé
  map.addSource("dv-radar", { type: "geojson", data: empty });
  map.addLayer({
    id: "dv-radar",
    type: "symbol",
    source: "dv-radar",
    slot: "top",
    layout: {
      "icon-image": ["get", "img"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.32, 15, 0.48, 17, 0.62, 19, 0.8],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
    },
    paint: { "icon-emissive-strength": 1 },
  });

  // 💡 farol: dois cones no chão (de fora mais fraco, de dentro mais forte)
  map.addSource("dv-car-beam", { type: "geojson", data: empty });
  map.addLayer({
    id: "dv-car-beam",
    type: "fill",
    source: "dv-car-beam",
    slot: "top",
    paint: { "fill-color": "#fff3b0", "fill-opacity": ["get", "a"], "fill-emissive-strength": 1, "fill-antialias": true },
  });

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
      // tamanho certo na tela vem do carScale() (muda a cada zoom)
      "model-scale": ["literal", [8, 8, 8]],
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

  // metros por pixel da tela no zoom de agora (mundo do Mapbox = 512 px no zoom 0)
  const metersPerPx = (lat) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
  // escala do modelo pra ele ter sempre DRIVE_CAR_PX na tela (v1.71)
  let lastScale = 0;
  const carScale = () => {
    if (!car.shown) return;
    const w = DRIVE_MODEL_SPECS[car.props?.mkind]?.w || 1.9;
    const s = Math.max(0.6, Math.min(900, (DRIVE_CAR_PX * metersPerPx(car.shown.lat)) / w));
    if (Math.abs(s - lastScale) / (lastScale || 1) < 0.02) return;
    lastScale = s;
    try {
      map.setPaintProperty("dv-car-model", "model-scale", ["literal", [s, s, s]]);
    } catch (err) {
      /* camada fora */
    }
  };
  // cone do farol: sai da frente do carango pro rumo (em px da tela convertidos pra metros)
  const offset = (lat, lng, h, m) => {
    const r = (h * Math.PI) / 180;
    return [lng + (Math.sin(r) * m) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (Math.cos(r) * m) / 110540];
  };
  const beamFeatures = () => {
    const p = car.props;
    if (!car.shown || !p?.beam || !DRIVE_BEAM_LOOKS.includes(api.look)) return [];
    const { lat, lng, h } = car.shown;
    const mpp = metersPerPx(lat);
    const cone = (len, spread, a) => {
      // sai de baixo do carango (o modelo cobre o começo do cone)
      const nose = offset(lat, lng, h, p.kind === "model" && lastScale ? (DRIVE_MODEL_SPECS[p.mkind]?.nose ?? 0.6) * lastScale : 8 * mpp);
      const tip = offset(nose[1], nose[0], h, len * mpp);
      const side = (base, w) => [offset(base[1], base[0], h + 90, w * mpp), offset(base[1], base[0], h - 90, w * mpp)];
      const [nl, nr] = side(nose, 9);
      const [tl, tr] = side(tip, spread);
      return { type: "Feature", properties: { a }, geometry: { type: "Polygon", coordinates: [[nl, tl, tr, nr, nl]] } };
    };
    const strong = api.look === "night" ? 1 : 0.7;
    return [cone(120, 46, 0.16 * strong), cone(85, 26, 0.26 * strong)];
  };
  const carRender = () => {
    if (!car.shown || !car.props) return;
    const p = car.props;
    const props = { ...p, rot: p.rot ?? 0 };
    map.getSource("dv-car")?.setData({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [car.shown.lng, car.shown.lat] } });
    if (p.kind === "model") {
      map.setPaintProperty("dv-car-model", "model-rotation", ["literal", [0, 0, (car.shown.h + 180) % 360]]);
      carScale();
    }
    map.getSource("dv-car-beam")?.setData({ type: "FeatureCollection", features: beamFeatures() });
  };
  // zoom mudou: carango no mesmo tamanho na tela e farol acompanhando
  map.on("zoom", () => {
    if (car.props?.kind === "model") carScale();
    if (car.props?.beam) map.getSource("dv-car-beam")?.setData({ type: "FeatureCollection", features: beamFeatures() });
  });
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
      routeTrafficNow();
    },
    // list = [{ lat, lng, limit }] (limit em km/h ou 0)
    setRadars(list) {
      const feats = (list || []).map((r) => {
        const img = `dv-radar-${r.limit || 0}`;
        if (!map.hasImage(img)) map.addImage(img, driveRadarImage(r.limit), { pixelRatio: 2 });
        return { type: "Feature", properties: { img }, geometry: { type: "Point", coordinates: [r.lng, r.lat] } };
      });
      map.getSource("dv-radar")?.setData({ type: "FeatureCollection", features: feats });
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
        // v1.77: cada carango tem o próprio modelo (DRIVE_MODELS); sem modelo = GT
        const kind = veh.face === "arrow" ? "arrow" : DRIVE_MODELS[veh.model] ? veh.model : "gt";
        const id = `dv-${kind}-${color.replace("#", "")}`;
        ensureModel(id, kind, color);
        props = { kind: "model", model: id, mkind: kind, em: driveModelGlow(kind, api.look), beam: Boolean(DRIVE_MODEL_SPECS[kind]?.beam), glow: color, glowA: isNav ? 0.55 : 0.4 };
      } else {
        const base = ensureEmoji(veh);
        // na tela: rumo menos o giro do mapa (o emoji de lado vira pro lado que anda)
        const screen = (((h - map.getBearing()) % 360) + 360) % 360;
        let img = base;
        let rot = 0;
        if (veh.face === "left" && screen > 0 && screen < 180) img = `${base}-r`;
        if (veh.face === "up") rot = Math.round(screen - 45); // 🚀 já nasce apontando pra 45°
        props = { kind: "emoji", img, rot, beam: veh.face === "left", glow: "#000000", glowA: 0.5 };
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
      // carango e farol na luz nova (brilho do GT, farol liga/desliga)
      if (car.props?.kind === "model") car.props.em = driveModelGlow(car.props.mkind, next);
      carRender();
    },
    setTraffic(on) {
      if (trafficOk) {
        try {
          ["dv-traffic"].forEach((id) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
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
      if (rtTimer) clearTimeout(rtTimer);
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
