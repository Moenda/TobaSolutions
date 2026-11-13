/* =====================================================================
 * Toba Drive · mapa da tela do carro (Android Auto, desde v1.78 / APK 1.7)
 * - O WebMap.java (TobaAndroid/app/auto/) desenha ESTA página na tela do carro
 *   (tela virtual em cima da Surface da Car App Library). Mesmo Mapbox Standard
 *   do 🧭 Toba Drive do celular: prédios 3D, luz do mapa pelo horário (v2.02;
 *   antes era pelo farol do carro).
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
 * - v2.02 (UI FOXA CLOBA DRIVER): painel bem maior (régua = cartão "🏁 Chegou" do
 *   Android Auto), chegada em 2 linhas no canto de baixo à direita, rua atual sempre
 *   centralizada debaixo da seta e a câmera sobe o carro pra cima do painel de baixo.
 * ===================================================================== */
const AM_STYLE = "mapbox://styles/mapbox/standard";
// mesma ordem do CarMap.SKINS (Java): o botão 🎨 do carro troca a LUZ do mapa
// (igual a 🌗 do Toba Drive do celular). light null = Auto, pelo horário (v2.02, amLightByClock).
// A rota fica sempre no mesmo azul.
const AM_ROUTE = { route: "#3b82f6", casing: "#1e3a8a", theme: "default" };
const AM_SKINS = [
  { id: "auto", light: null, ...AM_ROUTE },
  // v2.05: Amanhecer saiu (Rafa: "ninguém usa, é feioso"). Fica o lugar (índice do Java/prefs);
  // o APK 3.0 pula ele no 🎨 e o APK antigo que cair aqui ganha o Dia.
  { id: "dawn", light: "day", ...AM_ROUTE },
  { id: "day", light: "day", ...AM_ROUTE },
  { id: "dusk", light: "dusk", ...AM_ROUTE },
  { id: "night", light: "night", ...AM_ROUTE },
];
const AM_JAM_COLORS = { 1: "#facc15", 2: "#ef4444", 3: "#b91c1c" };
const AM_PITCH_3D = 60;
// v2.05: rota GROSSONA na tela do carro (Rafa: "ainda tá pequeno as linhas"), aparecendo por trás dos prédios.
// O carro anda em zoom ~16.5, então é ali que a linha tem que encorpar.
const AM_W_CASING = ["interpolate", ["linear"], ["zoom"], 11, 7, 15, 14, 16.5, 19, 18, 28, 19, 34];
const AM_W_LINE = ["interpolate", ["linear"], ["zoom"], 11, 4.5, 15, 9.5, 16.5, 13, 18, 20, 19, 25];
const AM_SEE_THROUGH = 0.55;
// v2.06 (ideia do Rafa): nada de faixa de trânsito separada. A PRÓPRIA linha azul da rota vira
// amarelo / vermelho / vinho nos trechos lentos (line-gradient por line-progress, estilo Google Maps).
// Na v2.03 a faixa ia por baixo (o azul tampava) e na v2.05 era uma 2ª linha por cima: o Rafa
// seguia vendo só azul. Uma linha só, sem camada pra sumir.
const AM_W_CITY_TRAFFIC = ["interpolate", ["linear"], ["zoom"], 10, 2, 13, 3.4, 15, 5, 16, 6.5, 18, 10, 19, 12];
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
  // v2.05: metros já rodados nas rotas anteriores da MESMA viagem (troca de rota no Y / recálculo).
  // A barrinha soma isso e não volta pro 0. Desligar o carro recarrega a página e zera (ok pro Rafa).
  tripDone: 0,
  overview: null,
  hud: null,
  zoom: 16.5,
  free: false, // v1.80: câmera solta (arrastou o mapa) até o 🎯 centralizar
  lastFrame: 0,
  lastPuck: "",
  floor: 0, // v2.02: px do painel de baixo debaixo da seta (a câmera sobe o carro pra cima dele)
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
  document.getElementById("amBottom").hidden = Boolean(am.overview);
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
    // v2.02: 2 linhas grandes: minutos (cor do trânsito) em cima, 🏁 hora de chegada · km embaixo
    const clock = document.getElementById("amEtaClock");
    clock.textContent = `${h.min} min`;
    clock.className = `is-t${Number(h.traffic) || 1}`;
    document.getElementById("amEtaAt").textContent = `🏁 ${h.eta}`;
    document.getElementById("amEtaLeft").textContent = h.left || "";
  }
  amPlaceRoad();
  amRenderBar();
  amJokeCheck(h);
}

// v2.02: rua atual SEMPRE no meio, debaixo da seta (antes deslizava pra direita e saía do centro).
// Cabe entre a velocidade (esquerda) e a chegada (direita)? fica embaixo, com a largura que sobra.
// Tela dividida apertada? sobe pra cima delas, ainda no meio. No fim mede quanto do painel de
// baixo fica debaixo da seta (am.floor) pra câmera subir o carro pra cima dele.
function amPlaceRoad() {
  const hudEl = document.getElementById("amHud");
  const road = document.getElementById("amRoad");
  const bottomEl = document.getElementById("amBottom");
  const etaEl = document.getElementById("amEta");
  if (!hudEl || !road) return;
  const hud = hudEl.getBoundingClientRect();
  if (!(hud.width > 0)) return;
  // tela dividida (Spotify do lado): chegada em 3 linhas estreitas pra rua caber no meio
  document.body.classList.toggle("am-narrow", hud.width < 620);
  const gap = 12;
  const mid = hud.left + hud.width / 2;
  const shown = (el) => el && !el.hidden;
  if (shown(road)) {
    road.style.bottom = "";
    road.style.maxWidth = "";
    const leftEdge = shown(bottomEl) ? bottomEl.getBoundingClientRect().right : hud.left;
    const rightEdge = shown(etaEl) ? etaEl.getBoundingClientRect().left : hud.right;
    const room = 2 * Math.min(mid - leftEdge, rightEdge - mid) - 2 * gap;
    road.classList.remove("is-tight");
    if (room >= 150) {
      road.style.maxWidth = `${Math.floor(room)}px`;
      // nome comprido não coube? fonte um tico menor antes das reticências
      if (road.scrollWidth > road.clientWidth + 1) road.classList.add("is-tight");
    } else {
      const rowH = Math.max(
        shown(bottomEl) ? bottomEl.getBoundingClientRect().height : 0,
        shown(etaEl) ? etaEl.getBoundingClientRect().height : 0,
      );
      road.style.bottom = `${Math.round(10 + rowH + 8)}px`;
      road.style.maxWidth = `${Math.floor(hud.width * 0.8)}px`;
    }
  }
  // quanto do painel de baixo tá na coluna do meio (onde a seta anda)
  let floor = 0;
  [bottomEl, etaEl, road].forEach((el) => {
    if (!shown(el)) return;
    const r = el.getBoundingClientRect();
    if (r.left < mid + 45 && r.right > mid - 45) floor = Math.max(floor, hud.bottom - r.top);
  });
  am.floor = floor > 0 ? Math.round(floor + 10) : 0;
}

// v1.81: barrinha de progresso até o destino (rodado ÷ tamanho da rota)
function amRenderBar() {
  const bar = document.getElementById("amEtaBar");
  if (!bar) return;
  const r = am.route;
  const done = (am.tripDone || 0) + am.along;
  const f = r && r.len > 0 ? Math.max(0, Math.min(1, done / (am.tripDone + r.len))) : 0;
  bar.style.width = `${(f * 100).toFixed(1)}%`;
}

/* ---------- camadas ---------- */
function amAddLayers() {
  const map = am.map;
  const skin = amSkin();
  map.addSource("am-route", { type: "geojson", lineMetrics: true, data: amEmpty() });
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
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 10, 16.5, 13, 18, 20],
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
      // v2.06: a PRÓPRIA linha muda de cor no trânsito (ideia do Rafa): degradê por trecho (amRouteGradient)
      "line-gradient": amRouteGradient(null),
      "line-width": AM_W_LINE,
      "line-trim-offset": [0, 0],
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
// por baixo da rota (v2.05: mais grosso ainda; o da PRÓPRIA rota é a cor da linha azul, v2.06).
// Rua livre (verde) não aparece.
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
        "line-width": AM_W_CITY_TRAFFIC,
        "line-offset": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 3, 19, 6],
        "line-opacity": 0.9,
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

// v2.02: Auto = pelo horário do celular (pedido do Rafa, no lugar do farol do carro):
// v2.05 (sem amanhecer): 6h–17h dia · 17h–19h30 entardecer · 19h30–6h noite
function amLightByClock(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes();
  if (m >= 6 * 60 && m < 17 * 60) return "day";
  if (m >= 17 * 60 && m < 19 * 60 + 30) return "dusk";
  return "night";
}

// Luz do mapa: a da skin escolhida, ou Auto pelo horário
function amLight() {
  return amSkin().light || amLightByClock();
}

function amApplySkin() {
  const map = am.map;
  if (!map || !am.styleOk) return;
  const skin = amSkin();
  map.setPaintProperty("am-route-line", "line-color", skin.route);
  map.setPaintProperty("am-route-casing", "line-color", skin.casing);
  amPaintRouteTraffic(am.overview ? am.overview.route : am.route); // v2.06: degradê usa o azul da skin
  if (map.hasImage("am-arrow")) map.removeImage("am-arrow");
  map.addImage("am-arrow", amArrowImage(skin.route), { pixelRatio: 2 });
  document.documentElement.style.setProperty("--am-accent", skin.route);
  amApplyLook(true);
}

// Luz (Auto = pelo horário) + tema da skin + 3D: só mexe se mudou
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
// v2.05: rota nova é da mesma viagem se o destino é o mesmo (até 250 m, igual à continuação da v2.03)
function amSameDest(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return amDist(a, b) <= 250;
}

function amSetRouteData(r) {
  if (!am.map || !am.styleOk) return;
  am.map.getSource("am-route").setData(r ? amLine(r.pts) : amEmpty());
  am.map.getSource("am-dest").setData(r && r.dest
    ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [r.dest[1], r.dest[0]] } }
    : amEmpty());
  amPaintRouteTraffic(r);
  amUpdateTrim();
}

// v2.06: cor da linha ao longo da rota. Azul onde tá livre, amarelo/vermelho/vinho nos trechos
// de trânsito da TomTom (jams = índices dos pontos -> fração do caminho, 0 a 1).
function amRouteGradient(r) {
  const blue = amSkin().route;
  const jams = r && Array.isArray(r.jams) && r.len > 0 ? r.jams.slice().sort((x, y) => x.a - y.a) : [];
  const stops = []; // [entrada, cor, entrada, cor...] sempre subindo (exigência do step)
  const lastIn = () => (stops.length ? stops[stops.length - 2] : 0);
  jams.forEach((j) => {
    const color = AM_JAM_COLORS[j.lvl] || AM_JAM_COLORS[1];
    let f0 = Math.max(1e-7, Math.min(1, r.cum[j.a] / r.len));
    const f1 = Math.min(1, r.cum[j.b] / r.len);
    // trecho grudado no anterior: troca o "volta pro azul" pela cor deste
    if (stops.length && stops[stops.length - 1] === blue && f0 <= lastIn() + 1e-6) {
      f0 = lastIn();
      stops.length -= 2;
    }
    if (stops.length && f0 <= lastIn()) f0 = lastIn() + 1e-7;
    if (f1 - f0 < 1e-6) return;
    stops.push(f0, color);
    if (f1 < 1) stops.push(f1, blue);
  });
  if (!stops.length) return ["interpolate", ["linear"], ["line-progress"], 0, blue, 1, blue];
  return ["step", ["line-progress"], blue, ...stops];
}

function amPaintRouteTraffic(r) {
  const map = am.map;
  if (!map || !am.styleOk) return;
  try {
    map.setPaintProperty("am-route-line", "line-gradient", amRouteGradient(r));
  } catch (err) {
    console.warn("Cor do trânsito na rota não entrou:", err?.message || err);
  }
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

// Rota já rodada some (trim); o trânsito vai junto porque é a cor da própria linha (v2.06)
function amUpdateTrim() {
  const map = am.map;
  if (!map || !am.styleOk) return;
  const r = am.overview ? null : am.route;
  const frac = r ? Math.max(0, Math.min(0.999, am.along / r.len)) : 0;
  map.setPaintProperty("am-route-line", "line-trim-offset", [0, frac]);
  map.setPaintProperty("am-route-casing", "line-trim-offset", [0, frac]);
  // v2.06: o trânsito agora é a cor da própria linha (amRouteGradient): o trim já esconde o que passou
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
  // v2.02: o painel de baixo (rua/chegada) não cobre a seta: ela fica logo acima dele
  const floor = Math.min(am.floor || 0, Math.max(0, (h - p.t - p.b) * 0.4));
  const free = Math.max(80, h - p.t - p.b - floor);
  // carro no terço de baixo da área livre (mais longe pra frente no 3D)
  const lower = mode3d ? 0.5 : 0.36;
  return { top: p.t + free * lower, bottom: p.b + floor, left: p.l, right: p.r };
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


/* ---------- 📸 radares (v1.80): OpenStreetMap pelo Overpass ----------
 * Caixas de ~4 km em volta do carro. Falhou = segue sem radar.
 * v2.03 (pedidos do Rafa):
 * - VOZ UMA VEZ SÓ por radar, número redondo e por extenso ("Radar a trezentos metros"),
 *   na distância pela velocidade: até 60 km/h a 200 m, 60–120 km/h a 400 m, mais de 120 a 500 m.
 *   Depois disso só a plaquinha 📸 na tela (aparece a até 500 m).
 * - RADAR DA PONTE: além de estar a até 18 m da rota, o radar tem que estar na MESMA via e no
 *   MESMO sentido. O Overpass agora traz junto as ruas do radar (a via em que ele tá ou, se ele
 *   tá do lado da pista, a via mais perto a até 15 m) e o "direction" dele; rua que cruza a rota (ponte/viaduto por cima ou
 *   túnel por baixo) fica com rumo virado e não avisa. Radar sem rua conhecida = regra antiga.
 *   Cache novo (toba_auto_radar_cache), porque o do Toba Drive do celular não tem as ruas.
 */
const AM_RADAR_TILE = 0.04;
const AM_RADAR_WARN_M = 500; // plaquinha na tela a partir daqui
const AM_RADAR_CACHE_KEY = "toba_auto_radar_cache"; // v2.03: só do carro (linhas com rumo das ruas)
const AM_RADAR_CACHE_DAYS = 7;
const AM_RADAR_ROAD_TOL = 35; // rumo da rota x rumo da rua do radar (graus, mão ou contramão)
const AM_RADAR_DIR_TOL = 50; // rumo da rota x "direction" do radar (graus)
const AM_RADAR_WAY_SKIP = /^(footway|cycleway|path|steps|pedestrian|track|bridleway|corridor|platform|proposed|construction|elevator|via_ferrata)$/;
const AM_OVERPASS = [
  "https://overpass-api.de/api/interpreter?data=",
  "https://overpass.private.coffee/api/interpreter?data=",
  "https://overpass.kumi.systems/api/interpreter?data=",
];
const amRadar = { tiles: new Set(), list: new Map(), warned: new Set(), busy: false, near: null };

// v2.03: distância da voz pela velocidade (m/s)
function amRadarSayAt(speed) {
  const kmh = (speed || 0) * 3.6;
  return kmh > 120 ? 500 : kmh >= 60 ? 400 : 200;
}

// v2.03: "trezentos metros" (de 100 em 100, por extenso: o TTS não inventa "trezentos e cinquenta")
const AM_HUNDREDS = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function amSpokenRound(m) {
  const h = Math.max(1, Math.min(9, Math.round(m / 100)));
  return `${AM_HUNDREDS[h]} metros`;
}

function amBearing(a, b) {
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function amAngle(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function amRadarLimit(v) {
  const n = parseInt(String(v || ""), 10);
  return Number.isFinite(n) && n >= 10 && n <= 150 ? n : 0;
}

// "direction" do OSM: 90 / "90;270" / "NE" / "forward" / "backward" (forward = sentido da via)
const AM_CARDINAL = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
function amRadarDirs(tag, wayHead) {
  if (!tag) return [];
  const out = [];
  String(tag).split(";").forEach((raw) => {
    const v = raw.trim().toUpperCase();
    if (!v) return;
    if (v === "FORWARD" && Number.isFinite(wayHead)) out.push(wayHead);
    else if (v === "BACKWARD" && Number.isFinite(wayHead)) out.push((wayHead + 180) % 360);
    else if (v in AM_CARDINAL) out.push(AM_CARDINAL[v]);
    else {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 360) out.push(n % 360);
    }
  });
  return out;
}

function amRadarCache() {
  try {
    return JSON.parse(localStorage.getItem(AM_RADAR_CACHE_KEY) || "{}") || {};
  } catch (err) {
    return {};
  }
}

// rumo da via no ponto mais perto do radar (e a distância até ela)
function amWayNear(way, lat, lon) {
  const g = way.geometry || [];
  const k = Math.cos((lat * Math.PI) / 180) * 111320;
  let best = null;
  for (let i = 0; i < g.length - 1; i++) {
    const a = [(g[i].lon - lon) * k, (g[i].lat - lat) * 110540];
    const b = [(g[i + 1].lon - lon) * k, (g[i + 1].lat - lat) * 110540];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, (-a[0] * dx - a[1] * dy) / len2));
    const off = Math.hypot(a[0] + t * dx, a[1] + t * dy);
    if (!best || off < best.off) best = { off, head: amBearing([g[i].lat, g[i].lon], [g[i + 1].lat, g[i + 1].lon]) };
  }
  return best;
}

// linha do cache: [lat, lng, limite, [rumos das vias], [sentidos do radar]]
async function amRadarBox(s, w, n, e) {
  const key = [s, w, n, e].map((v) => v.toFixed(2)).join(",");
  const hit = amRadarCache()[key];
  if (hit && Date.now() - hit.t < AM_RADAR_CACHE_DAYS * 86400000 && Array.isArray(hit.r)) return hit.r;
  const b = `(${s},${w},${n},${e})`;
  const q = encodeURIComponent(`[out:json][timeout:25];(node[highway=speed_camera]${b};node[enforcement=maxspeed]${b};)->.a;relation[enforcement=maxspeed]${b}->.r;node(r.r:"device")->.d;(.a;.d;)->.c;.c out body 500;.r out body;(way(bn.c)[highway];way(around.c:15)[highway];)->.w;.w out geom 1500;`);
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
  const relDir = new Map();
  const nodes = [];
  const ways = [];
  (json.elements || []).forEach((el) => {
    if (el.type === "relation") {
      const lim = amRadarLimit(el.tags?.maxspeed);
      (el.members || []).forEach((m) => {
        if (m.type !== "node" || m.role !== "device") return;
        if (lim) relLimit.set(m.ref, lim);
        if (el.tags?.direction) relDir.set(m.ref, el.tags.direction);
      });
    } else if (el.type === "node") nodes.push(el);
    else if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length > 1 && !AM_RADAR_WAY_SKIP.test(el.tags?.highway || "")) ways.push(el);
  });
  const seen = new Set();
  const rows = [];
  nodes.forEach((el) => {
    const lat = Number(el.lat);
    const lng = Number(el.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || seen.has(el.id)) return;
    seen.add(el.id);
    // a via em que o radar tá (nó dela); se ele tá do lado da pista, as vias a até 15 m
    const own = ways.filter((wy) => Array.isArray(wy.nodes) && wy.nodes.includes(el.id));
    const pool = own.length ? own : ways;
    let ownHead = NaN;
    const near = pool.map((wy) => amWayNear(wy, lat, lng)).filter((x) => x && (own.length || x.off <= 15));
    if (own.length && near.length) ownHead = near[0].head;
    // do lado da pista: vale a via mais perto (e as que estão quase tão perto, até +4 m)
    const closest = near.reduce((m, x) => Math.min(m, x.off), Infinity);
    const heads = near.filter((x) => own.length || x.off <= closest + 4).map((x) => Math.round(x.head));
    const dirs = amRadarDirs(el.tags?.direction || el.tags?.["camera:direction"] || relDir.get(el.id), ownHead).map(Math.round);
    rows.push([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, amRadarLimit(el.tags?.maxspeed) || relLimit.get(el.id) || 0, heads, dirs]);
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
      rows.forEach(([la, lo, lim, heads, dirs]) => {
        const id = `${la},${lo}`;
        const old = amRadar.list.get(id);
        amRadar.list.set(id, {
          lat: la,
          lon: lo,
          lim: lim || (old && old.lim) || 0,
          heads: Array.isArray(heads) ? heads : (old && old.heads) || [],
          dirs: Array.isArray(dirs) ? dirs : (old && old.dirs) || [],
        });
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

// v2.03: o radar vale pra quem anda nesse rumo? (mesma via e mesmo sentido)
function amRadarFits(r, head) {
  if (!Number.isFinite(head)) return true;
  if (r.dirs && r.dirs.length) return r.dirs.some((d) => amAngle(d, head) <= AM_RADAR_DIR_TOL);
  if (r.heads && r.heads.length) return r.heads.some((h) => amAngle(h, head) <= AM_RADAR_ROAD_TOL || amAngle(h, head) >= 180 - AM_RADAR_ROAD_TOL);
  return true; // radar sem rua conhecida: regra antiga (só a distância)
}

// v1.82: radar está NA ROTA, na frente? (até 18 m da linha; pista do outro sentido fica fora)
// v2.03: e na mesma via/sentido da rota naquele trecho (ponte por cima não conta)
const AM_RADAR_ROUTE_M = 18;
const AM_RADAR_SIDE_M = 12; // sem rota: até 12 m pro lado da linha reta do rumo

function amRadarOnRoute(r, lat, lon) {
  const rt = am.route;
  if (!rt || rt.pts.length < 2) return null;
  const k = Math.cos((lat * Math.PI) / 180) * 111320;
  const toXY = (pt) => [(pt[1] - lon) * k, (pt[0] - lat) * 110540];
  const p = toXY([r.lat, r.lon]);
  let best = null;
  for (let i = 0; i < rt.pts.length - 1; i++) {
    if (rt.cum[i + 1] < am.along - 30) continue;
    if (rt.cum[i] > am.along + AM_RADAR_WARN_M + 50) break;
    const a = toXY(rt.pts[i]);
    const b = toXY(rt.pts[i + 1]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    const off = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    if (off > AM_RADAR_ROUTE_M || (best && off >= best.off) || len2 < 1) continue;
    if (!amRadarFits(r, amBearing(rt.pts[i], rt.pts[i + 1]))) continue;
    best = { off, along: rt.cum[i] + t * Math.sqrt(len2) };
  }
  return best;
}

// radar na frente do carro: plaquinha (até 500 m) + voz UMA vez (distância pela velocidade)
function amRadarCheck(lat, lon, head, speed) {
  amRadarLoad(lat, lon);
  let best = null;
  const routed = Boolean(am.route) && !am.overview;
  amRadar.list.forEach((r, id) => {
    const d = amDist([lat, lon], [r.lat, r.lon]);
    if (d > AM_RADAR_WARN_M + 60) return;
    let ahead;
    if (routed) {
      // com rota: só radar em cima da rota, na frente e na mesma via/sentido
      const on = amRadarOnRoute(r, lat, lon);
      if (!on) return;
      ahead = on.along - am.along;
      if (ahead < -5 || ahead > AM_RADAR_WARN_M) return;
    } else {
      // sem rota: na frente (até 30°), no máximo 12 m pro lado do rumo e na via/sentido do carro
      const diff = Math.abs(((amBearing([lat, lon], [r.lat, r.lon]) - head + 540) % 360) - 180);
      const side = d * Math.sin((Math.min(diff, 90) * Math.PI) / 180);
      if ((diff > 30 || side > AM_RADAR_SIDE_M) && d > 25) return;
      if (d > AM_RADAR_WARN_M) return;
      if (!amRadarFits(r, head)) return;
      ahead = d;
    }
    if (!best || ahead < best.d) best = { id, d: Math.max(0, ahead), lim: r.lim };
  });
  const moving = (speed || 0) > 3;
  amRadar.near = best && moving ? best : null;
  if (best && moving && !amRadar.warned.has(best.id) && best.d <= amRadarSayAt(speed) + 20) {
    amRadar.warned.add(best.id);
    const n = amNative();
    // v2.05: no ⚠️ Só alertas a fala é curtinha, sem o limite ("Radar em trezentos metros").
    // No 🔊 Tudo continua com o limite. audioMode() só existe no APK 3.0+.
    let mode = 0;
    try {
      mode = n && typeof n.audioMode === "function" ? Number(n.audioMode()) || 0 : 0;
    } catch (err) {
      mode = 0;
    }
    const line = mode === 1
      ? `Radar em ${amSpokenRound(best.d)}.`
      : `Radar a ${amSpokenRound(best.d)}.${best.lim ? ` Limite ${best.lim}.` : ""}`;
    if (n && typeof n.say === "function") n.say(line);
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


/* ---------- 🤡 Cloba no carro (v1.81): piadinha nos marcos da viagem ----------
 * Uma vez por viagem cada marco. Aparece numa pílula e fala (respeita o 🔇 do carro).
 * Nunca fala em cima de manobra: espera a próxima ficar a mais de 400 m.
 * {min}, {km}, {limit} trocados na hora.
 */
const AM_JOKES = {
  start: [
    "Partiu! Cinto no peito e fé no Cloba.",
    "{min} minutos de viagem. Playlist no talo e bora!",
    "Bora que bora, piloto. O copiloto aqui nem tem carta, mas tem opinião.",
    "Motor ligado. Já foi no banheiro? Depois não adianta chorar.",
    "Rota traçada. Se der ruim, a culpa é do GPS. Se der bom, nunca foi sorte.",
    "Partiu! Hoje o copiloto tá de bom humor, aproveita.",
    "Bora, piloto. Missão do dia: chegar inteiro e sem multa. XP garantido.",
    "Saindo! Se esqueceu alguma coisa, finge que foi de propósito.",
    "Viagem iniciada. Loot no final: chegar em casa e tirar o tênis.",
  ],
  half: [
    "Metade do caminho! Daqui pra frente é ladeira abaixo. Modo de dizer, não solta o freio.",
    "Cinquenta por cento concluído. Barra de loading do Toba tá orgulhosa.",
    "Metade já foi. A outra metade tá te esperando com um café.",
    "Meio caminho andado. Literalmente. O Cloba não perde uma.",
    "Metade! Se fosse dungeon do Diablo, agora vinha o chefão.",
    "Cinquenta por cento. Já pode ir esquentando a água da V60.",
    "Metade do caminho. Os gatos já tão te esperando na porta. Ou dormindo, mais provável.",
    "Chegou na metade. Checkpoint salvo, pode morrer tranquilo. Brincadeira, não morre não.",
  ],
  ten: [
    "Faltam 10 minutos. Segura o xixi que tá chegando!",
    "Dez minutinhos. Já pode ir pensando onde vai estacionar.",
    "10 minutos pra chegar. Se tá com fome, segura que é logo ali.",
    "Faltam dez. Hora de ensaiar a cara de quem não se atrasou.",
    "Dez minutos. Tempo exato de uma música e meia de pagode.",
    "Faltam 10. Se tiver atrasado, já começa a inventar a desculpa.",
    "Dez minutinhos. Barra de XP da viagem quase cheia.",
  ],
  five: [
    "Cinco minutos! Avisa o povo que tá chegando. Por áudio não, tá dirigindo!",
    "Faltam 5. Arruma o cabelo no retrovisor no próximo sinal vermelho.",
    "Cinco minutos. O xixi agradece a paciência.",
    "Cinco minutos! Reta final, não vacila agora.",
    "Faltam 5. Desliga o modo Velozes e Furiosos e liga o modo baliza.",
    "Cinco minutos. Já dá pra sentir o cheiro de casa. Ou do vizinho fritando alguma coisa.",
  ],
  last: [
    "Último quilômetro! Nunca foi sorte, Cloba.",
    "Tá logo ali. Olho na vaga, piloto!",
    "Chegando! Pode tirar o pé que o Cloba assume. Mentira, não assume.",
    "Último quilômetro. Se tiver vaga na porta, foi o Cloba que guardou.",
    "Tá chegando! Agora só falta a baliza, a parte que separa os homens dos meninos.",
    "Reta final! Missão quase cumprida, piloto.",
  ],
  jam: [
    "Trânsito parado na frente. Respira e coloca um pagodinho.",
    "Vai ter fila. Mais parado que fila de banco no quinto dia útil.",
    "Lentidão pesada. Dá tempo de pensar na vida. Ou não.",
    "Trânsito na frente. Isso aqui é mais lento que respawn de boss raro.",
    "Lentidão à vista. Bom momento pra cantar alto, ninguém tá ouvindo. Só eu.",
    "Vem fila aí. Paciência é atributo, e tu tá upando agora.",
    "Trânsito pesado. Mais travado que servidor em dia de lançamento.",
  ],
  speeding: [
    "Ô Max Tobasten, aqui é {limit}! Multa não dá XP.",
    "Calma, Velozes e Furiosos 47. O limite é {limit}.",
    "Pé no freio, piloto! {limit} aqui, não é Interlagos.",
    "Opa, aqui é {limit}! Radar não aceita desculpa, piloto.",
    "Devagar, Toretto! O limite é {limit} e o boleto da multa é real.",
    "Tá voando, hein! {limit} aqui. O Cloba quer chegar vivo.",
  ],
  long: [
    "Mais de uma hora de estrada. Se bater o sono, para num posto. O Cloba espera.",
    "Viagem longa, hein. Água do lado e pausa a cada duas horas, combinado?",
    "Estrada comprida! Se o olho pesar, para. Cochilo no volante não tem respawn.",
    "Viagem de mais de uma hora. Hidrata, piloto. O Cloba não sabe fazer massagem cardíaca.",
  ],
};
const amJoke = { id: null, done: new Set(), pending: null, shownAt: 0, lastSpeed: 0, timer: null, startMin: 0 };

function amJokeLine(kind, vars) {
  const list = AM_JOKES[kind] || [];
  if (!list.length) return "";
  const line = list[Math.floor(Math.random() * list.length)];
  return line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

// manobra perto? (h.dist = "170 m" / "1,2 km")
function amTurnNear(h) {
  const d = String(h.dist || "");
  const m = d.match(/^([0-9]+)\s*m$/);
  return Boolean(m) && Number(m[1]) < 400;
}

function amJokeCheck(h) {
  if (!h || !h.nav || am.overview || !am.route) return;
  // v2.05: piada segue a VIAGEM (troca de rota / recálculo pro mesmo destino não reinicia os marcos)
  if (amJoke.id !== am.route.id && !(am.tripDone > 0 && amJoke.id !== null)) {
    amJoke.id = am.route.id;
    amJoke.done = new Set();
    amJoke.pending = null;
    amJoke.startMin = Number(h.min) || 0;
  }
  const min = Number(h.min) || 0;
  amJoke.id = am.route.id;
  const total = (am.tripDone || 0) + am.route.len;
  const frac = total > 0 ? ((am.tripDone || 0) + am.along) / total : 0;
  const left = Math.max(0, am.route.len - am.along);
  const want = (kind, vars = {}) => {
    if (amJoke.done.has(kind) || amJoke.pending) return;
    amJoke.done.add(kind);
    amJoke.pending = amJokeLine(kind, { min, ...vars });
  };
  // um marco por vez, do mais urgente pro menos
  if (frac < 0.05 && amJoke.startMin >= 8) want("start");
  if (amJoke.startMin >= 60 && frac > 0.08) want("long");
  if (Number(h.traffic) === 3 && frac < 0.9) want("jam");
  if (frac >= 0.5 && frac < 0.7 && amJoke.startMin >= 12) want("half");
  if (min <= 10 && min > 5 && amJoke.startMin >= 16) want("ten");
  if (min <= 5 && min > 2 && amJoke.startMin >= 9) want("five");
  if (left <= 1000 && left > 250 && am.route.len > 4000) want("last");
  const kmh = Number(h.speed) || 0;
  const lim = Number(h.limit) || 0;
  if (lim > 0 && kmh > lim + 12 && !amJoke.pending && Date.now() - amJoke.lastSpeed > 300000) {
    amJoke.lastSpeed = Date.now();
    amJoke.done.delete("speeding");
    want("speeding", { limit: lim });
  }
  if (amJoke.pending && !amTurnNear(h) && !h.rerouting) {
    const text = amJoke.pending;
    amJoke.pending = null;
    amJokeShow(text);
  }
}

function amJokeShow(text) {
  const el = document.getElementById("amCloba");
  if (el) {
    el.textContent = `🤡 ${text}`;
    el.hidden = false;
    clearTimeout(amJoke.timer);
    amJoke.timer = setTimeout(() => {
      el.hidden = true;
    }, 7000);
  }
  const n = amNative();
  if (n && typeof n.say === "function") n.say(text);
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
    amPlaceRoad();
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
    const old = am.route;
    const nr = amPrepRoute(r);
    if (nr && old && nr.id === old.id) {
      // mesma rota mandada de novo: não mexe no que já rodou
    } else if (nr && old && amSameDest(old.dest, nr.dest)) {
      am.tripDone += am.along; // v2.05: trocou de rota / recalculou pro mesmo destino = mesma viagem
    } else {
      am.tripDone = 0;
    }
    am.route = nr;
    am.along = 0;
    if (!am.overview) amSetRouteData(am.route);
  },
  progress(p) {
    am.along = p && Number.isFinite(p.along) ? p.along : 0;
    if (!am.overview) amUpdateTrim();
    amRenderBar();
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
      logoPosition: "top-right", // v2.02: embaixo à direita agora é a chegada
      fadeDuration: 0,
      preserveDrawingBuffer: false,
    });
  } catch (err) {
    amFail(`Mapbox: ${err.message || err}`);
    return;
  }
  am.map = map;
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "top-right");
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
    // v2.02: luz pelo horário: confere a cada minuto (só troca quando vira a faixa)
    setInterval(() => amApplyLook(), 60000);
  });
  window.addEventListener("resize", () => {
    map.resize();
    amPlaceRoad();
  });
})();
