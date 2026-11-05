/* =====================================================================
 * Toba Drive · mapa da tela do carro (Android Auto, desde v1.78 / APK 1.7)
 * - O WebMap.java (TobaAndroid/app/auto/) desenha ESTA página na tela do carro
 *   (tela virtual em cima da Surface da Car App Library). Mesmo Mapbox Standard
 *   do 🧭 Navegar do celular: prédios 3D, luz de dia/noite pelo farol do carro.
 * - O Java manda tudo por window.tobaAuto:
 *     config({ dark, mode3d, skin, pad:{t,r,b,l} })   pad = área livre (px CSS)
 *     car({ lat, lon, head, speed })                   ~1 por segundo
 *     route({ id, pts:[[lat,lon]...], jams:[[i0,i1,nível]], dest:[lat,lon] } | null)
 *     progress({ seg, along } | null)                  along = metros já rodados
 *     overview({ route, origin:[lat,lon] } | null)     prévia antes do "Bora!"
 *     hud({ nav, state, speed, limit, icon, dist, street, exit, eta, min, left, traffic, rerouting })
 * - A página avisa o Java: TobaAuto.ready() com o mapa pronto, TobaAuto.fail(motivo)
 *   se não der (aí o carro volta pro mapa de imagens, MapRenderer).
 * - Sem trânsito da cidade inteira (Rafa: "cidade toda verde"): só os trechos
 *   parados do TomTom em cima da própria rota (amarelo/vermelho/vinho, igual v1.72).
 * - Nada aqui grava no localStorage: 3D/2D e skin ficam no app (toba_auto).
 * ===================================================================== */
const AM_STYLE = "mapbox://styles/mapbox/standard";
// mesma ordem do CarMap.SKINS (Java): o botão 🎨 do carro passa de uma em uma
const AM_SKINS = [
  { id: "toba", route: "#22c55e", casing: "#0f5132", theme: "default" },
  { id: "ceu", route: "#38bdf8", casing: "#075985", theme: "default" },
  { id: "neon", route: "#ff2bd6", casing: "#581c87", theme: "monochrome" },
  { id: "clean", route: "#3b82f6", casing: "#1e3a8a", theme: "faded" },
  { id: "max", route: "#fbbf24", casing: "#7c2d12", theme: "default" },
];
const AM_JAM_COLORS = { 1: "#facc15", 2: "#ef4444", 3: "#b91c1c" };
const AM_PITCH_3D = 60;
const AM_FRAME_MS = 33; // ~30 quadros por segundo (o celular também está dirigindo o carro)
const AM_READY_WAIT_MS = 20000;

const am = {
  map: null,
  ready: false,
  styleOk: false,
  cfg: { dark: true, mode3d: true, skin: 0, pad: { t: 0, r: 0, b: 0, l: 0 } },
  appliedLook: "",
  car: null, // { from:{lat,lon,head}, to:{...}, t0, dur, speed }
  route: null, // { id, pts, cum, len, jams, dest }
  along: 0,
  overview: null,
  hud: null,
  zoom: 16.5,
  lastFrame: 0,
  lastPuck: "",
  lastJamAlong: -1,
};

/* ---------- avisar o Java ---------- */
function amNative() {
  return typeof window.TobaAuto === "object" && window.TobaAuto ? window.TobaAuto : null;
}

function amFail(why) {
  console.warn("Mapa do carro:", why);
  const n = amNative();
  if (n && typeof n.fail === "function") n.fail(String(why));
  else amNote(`🗺️ ${why}`);
}

/* ---------- contas ---------- */
function amDist(a, b) {
  const R = 6371008.8;
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function amAngleDiff(from, to) {
  let d = (((to - from) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

function amSkin() {
  return AM_SKINS[((am.cfg.skin % AM_SKINS.length) + AM_SKINS.length) % AM_SKINS.length];
}

function amLine(pts) {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => [p[1], p[0]]) } };
}

function amEmpty() {
  return { type: "FeatureCollection", features: [] };
}

/* ---------- seta do carro (desenhada aqui, deitada no chão) ---------- */
function amArrowImage(color) {
  const size = 96;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.translate(size / 2, size / 2);
  g.beginPath();
  g.moveTo(0, -38);
  g.lineTo(28, 30);
  g.lineTo(0, 16);
  g.lineTo(-28, 30);
  g.closePath();
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = 8;
  g.fillStyle = color;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 6;
  g.lineJoin = "round";
  g.strokeStyle = "#ffffff";
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

/* ---------- setas do painel ---------- */
function amIcon(key, exit) {
  if (key === "arrive") return '<span class="am-flag">🏁</span>';
  if (key === "roundabout") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="4.5"/><path d="M12 22v-7.5"/><path d="M15.2 6.8 19 3"/><path d="M15 3h4v4"/>${exit ? `<text x="12" y="12.6" font-size="6.5" fill="#fff" stroke="none" text-anchor="middle" font-weight="900">${exit}</text>` : ""}</svg>`;
  }
  if (key === "uturn") {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21V9a5 5 0 0 0-10 0v4"/><path d="M2 10l3 4 3-4"/></svg>';
  }
  const ang = { straight: 0, slight_right: 45, right: 90, sharp_right: 135, slight_left: -45, left: -90, sharp_left: -135 }[key] ?? 0;
  const r = (ang * Math.PI) / 180;
  const x0 = 12;
  const y0 = 11;
  const len = ang === 0 ? 8 : 7;
  const x1 = x0 + Math.sin(r) * len;
  const y1 = y0 - Math.cos(r) * len;
  const head = (a) => [x1 + Math.sin(r + a) * -4.5, y1 - Math.cos(r + a) * -4.5];
  const h1 = head(0.6);
  const h2 = head(-0.6);
  const stem = ang === 0 ? `M12 22V${y1 + 1}` : `M12 22V${y0}L${x1.toFixed(2)} ${y1.toFixed(2)}`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${stem}"/><path d="M${h1[0].toFixed(2)} ${h1[1].toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}L${h2[0].toFixed(2)} ${h2[1].toFixed(2)}"/></svg>`;
}

/* ---------- painel ---------- */
function amNote(text) {
  const el = document.getElementById("amNote");
  el.hidden = !text;
  el.textContent = text || "";
}

function amRenderHud() {
  const h = am.hud || {};
  const turn = document.getElementById("amTurn");
  const navOn = Boolean(h.nav) && !am.overview;
  turn.hidden = !navOn;
  if (navOn) {
    const wait = Boolean(h.rerouting) || !h.icon;
    turn.classList.toggle("is-wait", wait);
    document.getElementById("amTurnIcon").innerHTML = wait ? '<span class="am-flag">🔄</span>' : amIcon(h.icon, h.exit);
    document.getElementById("amTurnDist").textContent = wait ? "Recalculando…" : h.dist || "";
    document.getElementById("amTurnStreet").textContent = wait ? "Calma que o Cloba acha outro caminho" : h.street || "";
  }
  const speed = Math.max(0, Math.round(Number(h.speed) || 0));
  const limit = navOn ? Math.round(Number(h.limit) || 0) : 0;
  document.getElementById("amSpeedNum").textContent = String(speed);
  document.getElementById("amSpeed").classList.toggle("is-over", limit > 0 && speed > limit + 3);
  document.getElementById("amSpeed").parentElement.hidden = Boolean(am.overview);
  const lim = document.getElementById("amLimit");
  lim.hidden = !(limit > 0);
  document.getElementById("amLimitNum").textContent = limit > 0 ? String(limit) : "";
  const eta = document.getElementById("amEta");
  eta.hidden = !navOn || !h.eta;
  if (navOn && h.eta) {
    const clock = document.getElementById("amEtaClock");
    clock.textContent = h.eta;
    clock.className = `is-t${Number(h.traffic) || 1}`;
    document.getElementById("amEtaRest").textContent = `${h.min} min · ${h.left || ""}`;
  }
}

/* ---------- camadas ---------- */
function amAddLayers() {
  const map = am.map;
  const skin = amSkin();
  map.addSource("am-route", { type: "geojson", lineMetrics: true, data: amEmpty() });
  map.addSource("am-jams", { type: "geojson", data: amEmpty() });
  map.addSource("am-dest", { type: "geojson", data: amEmpty() });
  map.addSource("am-car", { type: "geojson", data: amEmpty() });
  map.addLayer({
    id: "am-route-casing",
    type: "line",
    source: "am-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": skin.casing,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 15, 13, 18, 26],
      "line-trim-offset": [0, 0],
    },
  });
  map.addLayer({
    id: "am-route-line",
    type: "line",
    source: "am-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": skin.route,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 15, 8.5, 18, 18],
      "line-trim-offset": [0, 0],
      "line-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: "am-jam-line",
    type: "line",
    source: "am-jams",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "lvl"], 3, AM_JAM_COLORS[3], 2, AM_JAM_COLORS[2], AM_JAM_COLORS[1]],
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 15, 8.5, 18, 18],
      "line-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: "am-dest-dot",
    type: "circle",
    source: "am-dest",
    paint: {
      "circle-radius": 9,
      "circle-color": "#e5534b",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
      "circle-pitch-alignment": "map",
      "circle-emissive-strength": 1,
    },
  });
  map.addImage("am-arrow", amArrowImage(skin.route), { pixelRatio: 2 });
  map.addLayer({
    id: "am-car-arrow",
    type: "symbol",
    source: "am-car",
    layout: {
      "icon-image": "am-arrow",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.7, 16, 1, 19, 1.25],
      "icon-rotate": ["get", "head"],
      "icon-rotation-alignment": "map",
      "icon-pitch-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "icon-emissive-strength": 1 },
  });
}

function amApplySkin() {
  const map = am.map;
  if (!map || !am.styleOk) return;
  const skin = amSkin();
  map.setPaintProperty("am-route-line", "line-color", skin.route);
  map.setPaintProperty("am-route-casing", "line-color", skin.casing);
  if (map.hasImage("am-arrow")) map.removeImage("am-arrow");
  map.addImage("am-arrow", amArrowImage(skin.route), { pixelRatio: 2 });
  document.documentElement.style.setProperty("--am-accent", skin.route);
  amApplyLook(true);
}

// Luz (dia/noite pelo farol do carro) + tema da skin + 3D: só mexe se mudou
function amApplyLook(force = false) {
  const map = am.map;
  if (!map || !am.styleOk) return;
  const skin = amSkin();
  const light = am.cfg.dark ? "night" : "day";
  const look = `${light}|${skin.theme}|${am.cfg.mode3d}`;
  if (!force && look === am.appliedLook) return;
  am.appliedLook = look;
  const set = (k, v) => {
    try {
      map.setConfigProperty("basemap", k, v);
    } catch (err) {
      /* propriedade que esta versão do Standard não conhece: ignora */
    }
  };
  set("lightPreset", light);
  set("theme", skin.theme);
  set("show3dObjects", Boolean(am.cfg.mode3d));
  document.body.classList.toggle("am-dark", am.cfg.dark);
  document.body.classList.toggle("am-light", !am.cfg.dark);
}

/* ---------- rota ---------- */
function amSetRouteData(r) {
  if (!am.map || !am.styleOk) return;
  am.map.getSource("am-route").setData(r ? amLine(r.pts) : amEmpty());
  am.map.getSource("am-dest").setData(r && r.dest
    ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [r.dest[1], r.dest[0]] } }
    : amEmpty());
  am.lastJamAlong = -1;
  amUpdateTrim();
}

function amPrepRoute(r) {
  if (!r || !Array.isArray(r.pts) || r.pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + amDist(r.pts[i - 1], r.pts[i]));
  const len = cum[cum.length - 1] || 1;
  const jams = (Array.isArray(r.jams) ? r.jams : []).map((j) => {
    const a = Math.max(0, Math.min(r.pts.length - 1, j[0] | 0));
    const b = Math.max(a, Math.min(r.pts.length - 1, j[1] | 0));
    return { a, b, lvl: j[2] | 0, endM: cum[b] };
  }).filter((j) => j.b > j.a);
  return { id: r.id, pts: r.pts, cum, len, jams, dest: Array.isArray(r.dest) ? r.dest : null };
}

// Rota já rodada some (trim) e trânsito que ficou pra trás também
function amUpdateTrim() {
  const map = am.map;
  if (!map || !am.styleOk) return;
  const r = am.overview ? null : am.route;
  const frac = r ? Math.max(0, Math.min(0.999, am.along / r.len)) : 0;
  map.setPaintProperty("am-route-line", "line-trim-offset", [0, frac]);
  map.setPaintProperty("am-route-casing", "line-trim-offset", [0, frac]);
  const src = am.overview ? am.overview.route : am.route;
  const alongNow = am.overview ? 0 : am.along;
  if (Math.abs(alongNow - am.lastJamAlong) < 25 && am.lastJamAlong >= 0) return;
  am.lastJamAlong = alongNow;
  const feats = !src ? [] : src.jams.filter((j) => j.endM > alongNow).map((j) => {
    // começa no ponto da rota mais perto de onde o carro está (não desenha atrás)
    let a = j.a;
    while (a < j.b - 1 && src.cum[a + 1] < alongNow) a++;
    return { type: "Feature", properties: { lvl: j.lvl }, geometry: { type: "LineString", coordinates: src.pts.slice(a, j.b + 1).map((p) => [p[1], p[0]]) } };
  });
  map.getSource("am-jams").setData({ type: "FeatureCollection", features: feats });
}

/* ---------- câmera e carro (a cada quadro) ---------- */
function amCarNow(now) {
  const c = am.car;
  if (!c) return null;
  const t = c.dur > 0 ? Math.min(1, (now - c.t0) / c.dur) : 1;
  return {
    lat: c.from.lat + (c.to.lat - c.from.lat) * t,
    lon: c.from.lon + (c.to.lon - c.from.lon) * t,
    head: (((c.from.head + amAngleDiff(c.from.head, c.to.head) * t) % 360) + 360) % 360,
  };
}

function amCamPad(mode3d) {
  const p = am.cfg.pad;
  const h = window.innerHeight || 480;
  const free = Math.max(80, h - p.t - p.b);
  // carro no terço de baixo da área livre (mais longe pra frente no 3D)
  const lower = mode3d ? 0.5 : 0.36;
  return { top: p.t + free * lower, bottom: p.b, left: p.l, right: p.r };
}

function amFrame(now) {
  requestAnimationFrame(amFrame);
  if (!am.styleOk || am.overview) return;
  if (now - am.lastFrame < AM_FRAME_MS) return;
  am.lastFrame = now;
  const p = amCarNow(now);
  if (!p) return;
  const key = `${p.lat.toFixed(7)},${p.lon.toFixed(7)},${p.head.toFixed(1)}`;
  if (key !== am.lastPuck) {
    am.lastPuck = key;
    am.map.getSource("am-car").setData({ type: "Feature", properties: { head: p.head }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });
  }
  const kmh = (am.car.speed || 0) * 3.6;
  const mode3d = Boolean(am.cfg.mode3d);
  // zoom abre um tico em velocidade de avenida/estrada
  const want = (mode3d ? 17.3 : 16.6) - Math.max(0, Math.min(1, (kmh - 40) / 60)) * 1.4 - (am.route ? 0 : 0.5);
  am.zoom += (want - am.zoom) * 0.05;
  am.map.jumpTo({
    center: [p.lon, p.lat],
    bearing: p.head,
    pitch: mode3d ? AM_PITCH_3D : 0,
    zoom: am.zoom,
    padding: amCamPad(mode3d),
  });
}

function amShowOverview() {
  const o = am.overview;
  if (!o || !am.styleOk) return;
  const r = o.route;
  amSetRouteData(r);
  const pts = r.pts.slice();
  if (Array.isArray(o.origin)) pts.push(o.origin);
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  pts.forEach((pt) => {
    s = Math.min(s, pt[0]);
    n = Math.max(n, pt[0]);
    w = Math.min(w, pt[1]);
    e = Math.max(e, pt[1]);
  });
  const p = am.cfg.pad;
  try {
    am.map.fitBounds([[w, s], [e, n]], {
      padding: { top: p.t + 40, bottom: p.b + 40, left: p.l + 40, right: p.r + 40 },
      bearing: 0,
      pitch: 0,
      duration: 0,
      maxZoom: 16,
    });
  } catch (err) {
    /* área livre pequena demais pro enquadramento: fica onde está */
  }
}

/* ---------- API do Java (window.tobaAuto) ---------- */
window.tobaAuto = {
  config(c) {
    if (!c) return;
    const skinBefore = am.cfg.skin;
    am.cfg = { ...am.cfg, ...c, pad: { ...am.cfg.pad, ...(c.pad || {}) } };
    const p = am.cfg.pad;
    const root = document.documentElement.style;
    root.setProperty("--am-t", `${p.t}px`);
    root.setProperty("--am-r", `${p.r}px`);
    root.setProperty("--am-b", `${p.b}px`);
    root.setProperty("--am-l", `${p.l}px`);
    if (skinBefore !== am.cfg.skin) amApplySkin();
    else amApplyLook();
    if (am.overview) amShowOverview();
  },
  car(c) {
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return;
    const now = performance.now();
    const to = { lat: c.lat, lon: c.lon, head: Number(c.head) || 0 };
    if (!am.car) {
      am.car = { from: to, to, t0: now, dur: 0, speed: c.speed || 0 };
      amNote("");
      return;
    }
    const cur = amCarNow(now) || to;
    // pulo grande (GPS voltou, simulação nova): não desliza pela cidade toda
    const jump = amDist([cur.lat, cur.lon], [to.lat, to.lon]) > 300;
    am.car = { from: jump ? to : cur, to, t0: now, dur: Math.max(250, Math.min(1500, now - (am.car.at || now - 1000))), speed: c.speed || 0, at: now };
  },
  route(r) {
    am.route = amPrepRoute(r);
    am.along = 0;
    if (!am.overview) amSetRouteData(am.route);
  },
  progress(p) {
    am.along = p && Number.isFinite(p.along) ? p.along : 0;
    if (!am.overview) amUpdateTrim();
  },
  overview(o) {
    const r = o ? amPrepRoute(o.route) : null;
    am.overview = r ? { route: r, origin: o.origin } : null;
    if (am.overview) amShowOverview();
    else amSetRouteData(am.route);
    amRenderHud();
  },
  hud(h) {
    am.hud = h || null;
    amRenderHud();
  },
};

/* ---------- abrir o mapa ---------- */
(function amStart() {
  amRenderHud();
  if (!window.mapboxgl) {
    amFail("não carregou o Mapbox (sem internet?)");
    return;
  }
  if (typeof TOBA_MAPBOX_TOKEN !== "string" || !TOBA_MAPBOX_TOKEN.startsWith("pk.")) {
    amFail("sem token do Mapbox");
    return;
  }
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) {
      amFail("sem WebGL na tela do carro");
      return;
    }
  } catch (err) {
    amFail("sem WebGL na tela do carro");
    return;
  }
  const skin = amSkin();
  let map;
  try {
    map = new mapboxgl.Map({
      container: "amMap",
      accessToken: TOBA_MAPBOX_TOKEN,
      style: AM_STYLE,
      config: {
        basemap: {
          lightPreset: am.cfg.dark ? "night" : "day",
          theme: skin.theme,
          showPointOfInterestLabels: false,
          showTransitLabels: false,
        },
      },
      center: [-46.6333, -23.5505],
      zoom: 15,
      pitch: 0,
      interactive: false,
      language: "pt",
      attributionControl: false,
      logoPosition: "bottom-right",
      fadeDuration: 0,
      preserveDrawingBuffer: false,
    });
  } catch (err) {
    amFail(`Mapbox: ${err.message || err}`);
    return;
  }
  am.map = map;
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
  const wait = setTimeout(() => {
    if (!am.styleOk) amFail("o Mapbox demorou demais");
  }, AM_READY_WAIT_MS);
  map.on("error", (ev) => {
    const st = Number(ev?.error?.status) || 0;
    if (!am.styleOk && st >= 400 && st < 500) {
      clearTimeout(wait);
      amFail(`Mapbox recusou (${st})`);
    }
  });
  map.once("style.load", () => {
    clearTimeout(wait);
    try {
      amAddLayers();
    } catch (err) {
      amFail(`camadas: ${err.message || err}`);
      return;
    }
    am.styleOk = true;
    amApplyLook(true);
    if (am.overview) amShowOverview();
    else amSetRouteData(am.route);
    if (!am.car) amNote(amNative() ? "📡 Procurando o GPS…" : "🚘 Mapa do Android Auto (abre no carro pelo app Toba)");
    const n = amNative();
    if (n && typeof n.ready === "function") n.ready();
    am.ready = true;
    requestAnimationFrame(amFrame);
  });
  window.addEventListener("resize", () => map.resize());
})();
