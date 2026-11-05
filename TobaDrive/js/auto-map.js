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
 *     pan(dx,dy) / scale(dz,fx,fy) / recenter()       v1.80: arrastar, pinçar e 🎯 centralizar
 *     overview({ route, origin:[lat,lon], alts:[[[lat,lon]...]] } | null)  prévia antes do "Bora!"
 *                                                     (v1.80: alts = outros caminhos, em cinza)
 *     hud({ nav, state, speed, limit, icon, dist, street, exit, eta, min, left, traffic, rerouting })
 * - A página avisa o Java: TobaAuto.ready() com o mapa pronto, TobaAuto.fail(motivo)
 *   se não der (aí o carro volta pro mapa de imagens, MapRenderer).
 * - Sem trânsito da cidade inteira (Rafa: "cidade toda verde"): só os trechos
 *   parados do TomTom em cima da própria rota (amarelo/vermelho/vinho, igual v1.72).
 * - Nada aqui grava no localStorage: 3D/2D e skin ficam no app (toba_auto).
 * ===================================================================== */
const AM_STYLE = "mapbox://styles/mapbox/standard";
// mesma ordem do CarMap.SKINS (Java): o botão 🎨 do carro troca a LUZ do mapa
// (igual a 🌗 do Navegar do celular). light null = Auto, segue o farol do carro.
// A rota fica sempre no mesmo azul.
const AM_ROUTE = { route: "#3b82f6", casing: "#1e3a8a", theme: "default" };
const AM_SKINS = [
  { id: "auto", light: null, ...AM_ROUTE },
  { id: "dawn", light: "dawn", ...AM_ROUTE },
  { id: "day", light: "day", ...AM_ROUTE },
  { id: "dusk", light: "dusk", ...AM_ROUTE },
  { id: "night", light: "night", ...AM_ROUTE },
];
const AM_JAM_COLORS = { 1: "#facc15", 2: "#ef4444", 3: "#b91c1c" };
const AM_PITCH_3D = 60;
// v1.80: rota mais fininha (dá pra ver o trânsito) e aparecendo por trás dos prédios
const AM_W_CASING = ["interpolate", ["linear"], ["zoom"], 11, 4.5, 15, 9, 18, 18];
const AM_W_LINE = ["interpolate", ["linear"], ["zoom"], 11, 2.5, 15, 6, 18, 12.5];
const AM_SEE_THROUGH = 0.55;
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
  free: false, // v1.80: câmera solta (arrastou o mapa) até o 🎯 centralizar
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

// v1.80: uma faixa: setinha de cada direção que ela permite; acesa = a que é pra seguir
const AM_LANE_ANG = { STRAIGHT: 0, SLIGHT_RIGHT: 40, RIGHT: 90, SHARP_RIGHT: 130, SLIGHT_LEFT: -40, LEFT: -90, SHARP_LEFT: -130 };
function amLaneHtml(l) {
  const dirs = Array.isArray(l.d) && l.d.length ? l.d : ["STRAIGHT"];
  const go = Boolean(l.f);
  const paths = dirs.map((d) => {
    if (d === "LEFT_U_TURN" || d === "RIGHT_U_TURN") {
      const m = d === "LEFT_U_TURN" ? 1 : -1;
      return `<path d="M${12 + 2 * m} 21V10a${4} ${4} 0 0 ${m > 0 ? 0 : 1} ${-8 * m} 0v3"/>`;
    }
    const ang = AM_LANE_ANG[d] ?? 0;
    const r = (ang * Math.PI) / 180;
    const x1 = 12 + Math.sin(r) * 7;
    const y1 = 11 - Math.cos(r) * 7;
    const hd = (a) => [x1 - Math.sin(r + a) * 4, y1 + Math.cos(r + a) * 4];
    const h1 = hd(0.6);
    const h2 = hd(-0.6);
    const stem = ang === 0 ? "M12 21V5" : `M12 21V11L${x1.toFixed(1)} ${y1.toFixed(1)}`;
    return `<path d="${stem}"/><path d="M${h1[0].toFixed(1)} ${h1[1].toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${h2[0].toFixed(1)} ${h2[1].toFixed(1)}"/>`;
  }).join("");
  return `<div class="am-lane${go ? " is-go" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></div>`;
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
  // v1.80: limite da rua também sem rota (o app pega no TomTom pela rua onde o carro tá)
  const limit = am.overview ? 0 : Math.round(Number(h.limit) || 0);
  document.getElementById("amSpeedNum").textContent = String(speed);
  document.getElementById("amSpeed").classList.toggle("is-over", limit > 0 && speed > limit + 3);
  document.getElementById("amSpeed").parentElement.hidden = Boolean(am.overview);
  const lim = document.getElementById("amLimit");
  lim.hidden = !(limit > 0);
  document.getElementById("amLimitNum").textContent = limit > 0 ? String(limit) : "";
  // v1.80: faixas (do TomTom) embaixo da manobra
  const lanesEl = document.getElementById("amLanes");
  const lanes = navOn && !h.rerouting && Array.isArray(h.lanes) ? h.lanes : null;
  lanesEl.hidden = !lanes;
  if (lanes) lanesEl.innerHTML = lanes.map(amLaneHtml).join("");
  // v1.80: rua atual embaixo no meio
  const road = document.getElementById("amRoad");
  road.hidden = Boolean(am.overview) || !h.road;
  road.textContent = h.road || "";
  amRenderRadar();
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
  map.addSource("am-alts", { type: "geojson", data: amEmpty() });
  // v1.80: outros caminhos da prévia, cinza por baixo da rota escolhida
  map.addLayer({
    id: "am-alts",
    type: "line",
    source: "am-alts",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#94a3b8",
      "line-opacity": 0.85,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6, 18, 12],
      "line-emissive-strength": 1,
      "line-occlusion-opacity": AM_SEE_THROUGH,
    },
  });
  map.addLayer({
    id: "am-route-casing",
    type: "line",
    source: "am-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": skin.casing,
      "line-width": AM_W_CASING,
      "line-trim-offset": [0, 0],
      "line-occlusion-opacity": AM_SEE_THROUGH, // v1.80: rota aparece "atrás" dos prédios
    },
  });
  map.addLayer({
    id: "am-route-line",
    type: "line",
    source: "am-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": skin.route,
      "line-width": AM_W_LINE,
      "line-trim-offset": [0, 0],
      "line-emissive-strength": 1,
      "line-occlusion-opacity": AM_SEE_THROUGH,
    },
  });
  map.addLayer({
    id: "am-jam-line",
    type: "line",
    source: "am-jams",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "lvl"], 3, AM_JAM_COLORS[3], 2, AM_JAM_COLORS[2], AM_JAM_COLORS[1]],
      "line-width": AM_W_LINE,
      "line-emissive-strength": 1,
      "line-occlusion-opacity": AM_SEE_THROUGH,
    },
  });
  // v1.80: 🏁 bandeirinha em pé no destino
  map.addImage("am-flag", amEmojiImage("🏁", 64), { pixelRatio: 2 });
  map.addLayer({
    id: "am-dest-flag",
    type: "symbol",
    source: "am-dest",
    layout: {
      "icon-image": "am-flag",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.7, 16, 1, 19, 1.3],
      "icon-anchor": "bottom-left",
      "icon-offset": [-6, 0],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "icon-emissive-strength": 1, "icon-occlusion-opacity": 0.7 },
  });
  // v1.80: 📸 radares (OpenStreetMap) com a plaquinha do limite
  map.addSource("am-radars", { type: "geojson", data: amEmpty() });
  map.addImage("am-radar", amEmojiImage("📸", 44), { pixelRatio: 2 });
  map.addLayer({
    id: "am-radar",
    type: "symbol",
    source: "am-radars",
    minzoom: 12,
    layout: {
      "icon-image": "am-radar",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 16, 0.9, 19, 1.1],
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "text-field": ["case", [">", ["get", "lim"], 0], ["to-string", ["get", "lim"]], ""],
      "text-size": 12,
      "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
      "text-anchor": "top",
      "text-offset": [0, 0.15],
      "text-allow-overlap": true,
    },
    paint: {
      "icon-emissive-strength": 1,
      "icon-occlusion-opacity": 0.7,
      "text-color": "#111111",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2.5,
      "text-emissive-strength": 1,
    },
  });
  map.addImage("am-arrow", amArrowImage(skin.route), { pixelRatio: 2 });
  map.addLayer({
    id: "am-car-arrow",
    type: "symbol",
    source: "am-car",
    layout: {
      "icon-image": "am-arrow",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.55, 16, 0.78, 19, 1],
      "icon-rotate": ["get", "head"],
      "icon-rotation-alignment": "map",
      "icon-pitch-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "icon-emissive-strength": 1, "icon-occlusion-opacity": 1 },
  });
  amAddTraffic();
}

// v1.80: 🚦 trânsito das ruas em volta (Mapbox Traffic), SÓ amarelo / vermelho / vinho,
// fininho e por baixo da rota. Rua livre (verde) não aparece.
function amAddTraffic() {
  const map = am.map;
  try {
    map.addSource("am-traffic", { type: "vector", url: "mapbox://mapbox.mapbox-traffic-v1" });
    map.addLayer({
      id: "am-traffic",
      type: "line",
      source: "am-traffic",
      "source-layer": "traffic",
      filter: ["match", ["get", "congestion"], ["moderate", "heavy", "severe"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["match", ["get", "congestion"], "severe", AM_JAM_COLORS[3], "heavy", AM_JAM_COLORS[2], AM_JAM_COLORS[1]],
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 16, 3, 19, 6],
        "line-offset": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 2.5, 19, 5],
        "line-opacity": 0.85,
        "line-emissive-strength": 1,
        "line-occlusion-opacity": AM_SEE_THROUGH,
      },
    }, "am-alts");
    setInterval(() => {
      try {
        map.getSource("am-traffic")?.reload();
      } catch (err) {
        /* carregando */
      }
    }, 120000);
  } catch (err) {
    console.warn("Trânsito do Mapbox não entrou:", err?.message || err);
  }
}

// emoji desenhado num quadradinho (bandeira, radar)
function amEmojiImage(emoji, size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `${Math.round(size * 0.8)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  g.shadowColor = "rgba(0,0,0,0.4)";
  g.shadowBlur = 4;
  g.fillText(emoji, size / 2, size / 2 + size * 0.04);
  return g.getImageData(0, 0, size, size);
}

// Luz do mapa: a da skin escolhida, ou dia/noite pelo farol do carro (Auto)
function amLight() {
  return amSkin().light || (am.cfg.dark ? "night" : "day");
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
  const light = amLight();
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
  const dark = light === "night" || light === "dusk";
  document.body.classList.toggle("am-dark", dark);
  document.body.classList.toggle("am-light", !dark);
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
  if (am.free) return; // v1.80: arrastou o mapa: a seta anda, a câmera fica
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

function amSetAlts(alts) {
  if (!am.map || !am.styleOk) return;
  const src = am.map.getSource("am-alts");
  if (!src) return;
  src.setData(alts && alts.length
    ? { type: "FeatureCollection", features: alts.map((a) => amLine(a)) }
    : amEmpty());
}

function amShowOverview() {
  const o = am.overview;
  if (!o || !am.styleOk) return;
  const r = o.route;
  amSetRouteData(r);
  const alts = Array.isArray(o.alts) ? o.alts.filter((a) => Array.isArray(a) && a.length > 1) : [];
  amSetAlts(alts);
  const pts = r.pts.slice();
  alts.forEach((a) => a.forEach((pt) => pts.push(pt)));
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


/* ---------- 📸 radares (v1.80): OpenStreetMap pelo Overpass, mesmo cache do Navegar ----------
 * Caixas de ~4 km em volta do carro; o aviso vale pro radar na frente (até 30° do rumo)
 * a menos de 450 m. Falhou = segue sem radar.
 */
const AM_RADAR_TILE = 0.04;
const AM_RADAR_WARN_M = 450;
const AM_RADAR_CACHE_KEY = "toba_drive_radar_cache"; // o mesmo do Navegar (drive-route.js)
const AM_RADAR_CACHE_DAYS = 7;
const AM_OVERPASS = [
  "https://overpass-api.de/api/interpreter?data=",
  "https://overpass.private.coffee/api/interpreter?data=",
  "https://overpass.kumi.systems/api/interpreter?data=",
];
const amRadar = { tiles: new Set(), list: new Map(), warned: new Set(), busy: false, near: null };

function amBearing(a, b) {
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function amRadarLimit(v) {
  const n = parseInt(String(v || ""), 10);
  return Number.isFinite(n) && n >= 10 && n <= 150 ? n : 0;
}

function amRadarCache() {
  try {
    return JSON.parse(localStorage.getItem(AM_RADAR_CACHE_KEY) || "{}") || {};
  } catch (err) {
    return {};
  }
}

async function amRadarBox(s, w, n, e) {
  const key = [s, w, n, e].map((v) => v.toFixed(2)).join(",");
  const hit = amRadarCache()[key];
  if (hit && Date.now() - hit.t < AM_RADAR_CACHE_DAYS * 86400000 && Array.isArray(hit.r)) return hit.r;
  const b = `(${s},${w},${n},${e})`;
  const q = encodeURIComponent(`[out:json][timeout:20];(node[highway=speed_camera]${b};node[enforcement=maxspeed]${b};)->.a;relation[enforcement=maxspeed]${b}->.r;node(r.r:"device")->.d;(.a;.d;);out body 500;.r out body;`);
  let json = null;
  for (const base of AM_OVERPASS) {
    try {
      const res = await fetch(base + q);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
      break;
    } catch (err) {
      /* próximo espelho */
    }
  }
  if (!json) throw new Error("Overpass fora");
  const relLimit = new Map();
  const nodes = [];
  (json.elements || []).forEach((el) => {
    if (el.type === "relation") {
      const lim = amRadarLimit(el.tags?.maxspeed);
      (el.members || []).forEach((m) => {
        if (m.type === "node" && m.role === "device" && lim) relLimit.set(m.ref, lim);
      });
    } else if (el.type === "node") nodes.push(el);
  });
  const seen = new Set();
  const rows = [];
  nodes.forEach((el) => {
    const lat = Number(el.lat);
    const lng = Number(el.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || seen.has(el.id)) return;
    seen.add(el.id);
    rows.push([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, amRadarLimit(el.tags?.maxspeed) || relLimit.get(el.id) || 0]);
  });
  try {
    const all = amRadarCache();
    all[key] = { t: Date.now(), r: rows };
    Object.keys(all).sort((a, b2) => all[b2].t - all[a].t).slice(15).forEach((k) => delete all[k]);
    localStorage.setItem(AM_RADAR_CACHE_KEY, JSON.stringify(all));
  } catch (err) {
    /* sem storage: só não guarda */
  }
  return rows;
}

function amRadarLoad(lat, lon) {
  const ty = Math.floor(lat / AM_RADAR_TILE);
  const tx = Math.floor(lon / AM_RADAR_TILE);
  const key = `${ty},${tx}`;
  if (amRadar.busy || amRadar.tiles.has(key)) return;
  amRadar.busy = true;
  const r2 = (v) => Math.round(v * 100) / 100;
  const s = r2(ty * AM_RADAR_TILE - 0.02);
  const w = r2(tx * AM_RADAR_TILE - 0.02);
  amRadarBox(s, w, r2(s + AM_RADAR_TILE + 0.04), r2(w + AM_RADAR_TILE + 0.04))
    .then((rows) => {
      amRadar.tiles.add(key);
      rows.forEach(([la, lo, lim]) => {
        const id = `${la},${lo}`;
        const old = amRadar.list.get(id);
        amRadar.list.set(id, { lat: la, lon: lo, lim: lim || (old && old.lim) || 0 });
      });
      if (amRadar.list.size > 600) {
        // guarda só os mais perto
        const keep = [...amRadar.list.entries()].sort((a, b) => amDist([lat, lon], [a[1].lat, a[1].lon]) - amDist([lat, lon], [b[1].lat, b[1].lon])).slice(0, 400);
        amRadar.list = new Map(keep);
      }
      amRadarDraw();
    })
    .catch(() => {
      amRadar.tiles.add(key); // não insiste nessa caixa agora
      setTimeout(() => amRadar.tiles.delete(key), 300000);
    })
    .finally(() => {
      amRadar.busy = false;
    });
}

function amRadarDraw() {
  const src = am.map && am.styleOk && am.map.getSource("am-radars");
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: [...amRadar.list.values()].map((r) => ({ type: "Feature", properties: { lim: r.lim }, geometry: { type: "Point", coordinates: [r.lon, r.lat] } })),
  });
}

// radar na frente do carro: pílula + voz (uma vez por radar)
function amRadarCheck(lat, lon, head, speed) {
  amRadarLoad(lat, lon);
  let best = null;
  amRadar.list.forEach((r, id) => {
    const d = amDist([lat, lon], [r.lat, r.lon]);
    if (d > AM_RADAR_WARN_M) return;
    const diff = Math.abs(((amBearing([lat, lon], [r.lat, r.lon]) - head + 540) % 360) - 180);
    if (diff > 30 && d > 40) return;
    if (!best || d < best.d) best = { id, d, lim: r.lim };
  });
  const moving = (speed || 0) > 3;
  amRadar.near = best && moving ? best : null;
  if (best && moving && !amRadar.warned.has(best.id)) {
    amRadar.warned.add(best.id);
    const n = amNative();
    const m = Math.max(50, Math.round(best.d / 50) * 50);
    if (n && typeof n.say === "function") n.say(`Radar a ${m} metros.${best.lim ? ` Limite de ${best.lim}.` : ""}`);
  }
  amRenderRadar();
}

function amRenderRadar() {
  const el = document.getElementById("amRadar");
  if (!el) return;
  const r = am.overview ? null : amRadar.near;
  el.hidden = !r;
  if (!r) return;
  const m = r.d < 1000 ? `${Math.max(10, Math.round(r.d / 10) * 10)} m` : `${(r.d / 1000).toFixed(1).replace(".", ",")} km`;
  el.innerHTML = `<span class="am-radar-ic">📸</span>${r.lim ? `<b>${r.lim}</b>` : "<b>Radar</b>"}<span>${m}</span>`;
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
    amRadarCheck(to.lat, to.lon, to.head, c.speed || 0);
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
    am.overview = r ? { route: r, origin: o.origin, alts: o.alts } : null;
    if (am.overview) amShowOverview();
    else {
      amSetAlts(null);
      amSetRouteData(am.route);
    }
    amRenderHud();
  },
  // v1.80: arrastar / pinçar na tela do carro solta a câmera; 🎯 centralizar volta atrás do carro
  pan(dx, dy) {
    if (!am.map || !am.styleOk) return;
    am.free = true;
    am.map.panBy([Number(dx) || 0, Number(dy) || 0], { duration: 0 });
  },
  scale(dz, fx, fy) {
    if (!am.map || !am.styleOk) return;
    am.free = true;
    const z = Math.max(3, Math.min(20, am.map.getZoom() + (Number(dz) || 0)));
    am.map.zoomTo(z, { duration: 200, around: am.map.unproject([Number(fx) || 0, Number(fy) || 0]) });
  },
  recenter() {
    am.free = false;
    if (am.overview) amShowOverview();
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
          lightPreset: amLight(),
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
    amRadarDraw();
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
