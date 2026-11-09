/* =====================================================================
 * Toba Health · 🚶 Caminhada / Corrida repaginada (desde v1.84)
 * Três jeitos de registrar (todos viram treino "walking", o mesmo de sempre):
 *   📡 Ao vivo com GPS: trajeto no mapa, tempo, km e ritmo na hora.
 *   ✍️ Na rua (manual): o formulário de antes (km, tempo, kcal).
 *   🏃 Esteira: manual, com inclinação opcional.
 * + 📜 Histórico de caminhadas (viewWalks) com mapinha de cada trajeto.
 *
 * Mapa = o mesmo do Toba Places (Leaflet 1.9.4 + tobaBaseTiles de
 * assets/toba-maps.js: TomTom com plano B CARTO). Não usa o Mapbox do Drive
 * (pedido do Rafa: segura a cota). O mapinha do histórico é SVG desenhado
 * aqui, sem internet e sem gastar tile.
 *
 * Treino em andamento: MESMA chave TOBA_HEALTH_ACTIVE_SESSION, kind "walk",
 * exercises: [] e
 *   liveSession.walk = {
 *     activity: "walk"|"run", segs: [[[lat, lng, t], ...], ...] (t = s desde
 *     startedAt; pausa abre segmento novo), meters, kmAt: [s em movimento a
 *     cada km], pausedAt: ms|null, pausedMs: ms, acc: precisão do último fix
 *   }
 * Tempos são horários (Date.now()). No APK 1.6+ o TobaNative.navKeepAlive
 * (o mesmo do Toba Drive) segura o GPS com a tela apagada e manda os fixes
 * pro window.onTobaNativeFix.
 *
 * Campos NOVOS (todos opcionais) no treino "walking" (ver CLAUDE.md 3.5):
 *   mode: "gps"|"manual"|"treadmill" (ausente = "manual")
 *   source: "toba"|"manual"|"watch" (ausente = "manual"). "watch" = dados do
 *     ⌚ relógio. Pronto pro futuro Health Connect (Galaxy Watch): o import
 *     grava source "health-connect" + externalId (id do registro, evita
 *     duplicar). Nada disso é lido em cálculo: km/tempo/kcal continuam nos
 *     campos de sempre, então XP, Hall e conquistas não mudam.
 *   track: trajeto em "encoded polyline" (precisão 5), segmentos separados
 *     por espaço, no máximo WALK_TRACK_MAX pontos (~2 KB)
 *   splits: [segundos de cada km completo], startTime: "HH:MM", incline: %
 *
 * Carregado DEPOIS de sessao.js e ANTES de treinos.js.
 * ===================================================================== */

const WALK_LEAFLET_CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
const WALK_LEAFLET_JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
const WALK_MAX_ACC_M = 35; // fix pior que isso não soma distância
const WALK_MIN_STEP_M = 6; // anda pelo menos isso pra virar ponto (tira o tremido parado)
const WALK_MAX_SPEED_MS = 8; // 28,8 km/h: mais rápido que isso é pulo do GPS
const WALK_TRACK_MAX = 400; // pontos gravados no treino
const WALK_PACE_WINDOW_M = 250; // "ritmo agora" = últimos 250 m
const WALK_RUN_PACE = 7.5; // min/km: mais rápido que isso sugere "Corrida"
const WALK_KCAL_PER_KG_KM = { walk: 0.75, run: 1.0 };
const WALK_ACTIVITIES = {
  walk: { title: "Caminhada", icon: "🚶" },
  run: { title: "Corrida", icon: "🏃" },
};
const WALK_MODES = {
  gps: { label: "GPS", icon: "📡" },
  manual: { label: "Na rua", icon: "✍️" },
  treadmill: { label: "Esteira", icon: "🏃" },
};
const WALK_SOURCES = {
  toba: "📡 Toba GPS",
  manual: "✍️ Anotei na mão",
  watch: "⌚ Relógio",
  "health-connect": "⌚ Health Connect",
};

const walkMap = { promise: null, map: null, line: null, dot: null, follow: true };
let walkWatchId = null;
let walkGpsError = "";
let walkLastFixAt = 0;
let walkPendingFinish = null;

/* ---------------------------------------------------------------------
 * Contas
 * ------------------------------------------------------------------- */
function walkDistanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "9:42" (min/km); 0 ou absurdo = "--"
function formatWalkPace(minPerKm) {
  if (!(minPerKm > 0) || minPerKm > 60) return "--";
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function getWalkPace(workout) {
  const km = Number(workout.distanceKm) || 0;
  const min = Number(workout.durationMinutes) || 0;
  return km > 0 && min > 0 ? min / km : 0;
}

// Encoded polyline (formato do Google, precisão 5): ~6 caracteres por ponto
function encodeWalkPolyline(points) {
  let out = "";
  let lastLat = 0;
  let lastLng = 0;
  const enc = (value) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let s = "";
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  points.forEach(([lat, lng]) => {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += enc(la - lastLat) + enc(ln - lastLng);
    lastLat = la;
    lastLng = ln;
  });
  return out;
}

function decodeWalkPolyline(text) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const str = String(text || "");
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      if (index >= str.length) return null;
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < str.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// "seg1 seg2" -> [[[lat,lng],...], ...] (texto estranho = sem trajeto)
function decodeWalkTrack(track) {
  if (typeof track !== "string" || !track) return [];
  return track.split(" ").map(decodeWalkPolyline).filter((seg) => seg.length > 1);
}

// Afina o trajeto até caber em WALK_TRACK_MAX pontos (mantém começo e fim de cada trecho)
function encodeWalkTrack(segs) {
  const clean = segs.map((seg) => seg.map((p) => [p[0], p[1]])).filter((seg) => seg.length > 1);
  const total = clean.reduce((sum, seg) => sum + seg.length, 0);
  if (!total) return "";
  const keepEvery = Math.max(1, Math.ceil(total / WALK_TRACK_MAX));
  return clean.map((seg) => {
    const kept = seg.filter((p, i) => i % keepEvery === 0 || i === seg.length - 1);
    return encodeWalkPolyline(kept);
  }).join(" ");
}

/* ---------------------------------------------------------------------
 * Mapinha SVG (histórico, card do treino): sem internet, sem tile
 * ------------------------------------------------------------------- */
function walkMiniMapSvg(segs, { width = 120, height = 72, cls = "walk-mini" } = {}) {
  const all = segs.flat();
  if (all.length < 2) return "";
  const midLat = all.reduce((sum, p) => sum + p[0], 0) / all.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = all.map((p) => p[1] * kx);
  const ys = all.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 8;
  const span = Math.max(maxX - minX, maxY - minY, 1e-5);
  const scale = Math.min((width - pad * 2) / Math.max(maxX - minX, span * 0.2), (height - pad * 2) / Math.max(maxY - minY, span * 0.2));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const pt = (p) => `${((p[1] * kx - minX) * scale + offX).toFixed(1)},${((-p[0] - minY) * scale + offY).toFixed(1)}`;
  const lines = segs.map((seg) => `<polyline points="${seg.map(pt).join(" ")}" class="walk-mini-line"/>`).join("");
  const [sx, sy] = pt(all[0]).split(",");
  const [ex, ey] = pt(all[all.length - 1]).split(",");
  return `
    <svg class="${cls}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${lines}
      <circle cx="${sx}" cy="${sy}" r="3.2" class="walk-mini-start"/>
      <circle cx="${ex}" cy="${ey}" r="3.2" class="walk-mini-end"/>
    </svg>`;
}

/* ---------------------------------------------------------------------
 * Mapa de verdade (Leaflet, o mesmo do Places)
 * ------------------------------------------------------------------- */
function loadWalkLeaflet() {
  if (window.L) return Promise.resolve();
  if (!walkMap.promise) {
    walkMap.promise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = WALK_LEAFLET_CSS;
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = WALK_LEAFLET_JS;
      js.onload = () => (window.L ? resolve() : reject(new Error("Leaflet sem L")));
      js.onerror = () => reject(new Error("Leaflet não carregou"));
      document.head.appendChild(js);
    }).catch((err) => {
      walkMap.promise = null;
      throw err;
    });
  }
  return walkMap.promise;
}

// Claro/escuro: a mesma escolha do 🗺️ Mapa do Places (padrão claro, mais legível)
function walkMapStyle() {
  try {
    return localStorage.getItem("toba_turism_map_style") === "dark" ? "dark" : "light";
  } catch (err) {
    return "light";
  }
}

function walkMakeMap(box) {
  const map = L.map(box, { zoomControl: false, attributionControl: true });
  if (typeof tobaBaseTiles === "function") {
    tobaBaseTiles(map, walkMapStyle(), { cartoKey: typeof TURISM_CARTO_KEY !== "undefined" ? TURISM_CARTO_KEY : "" });
  }
  return map;
}

function walkDestroyMap() {
  if (walkMap.map) {
    try {
      walkMap.map.remove();
    } catch (err) {
      /* já saiu da tela */
    }
  }
  walkMap.map = null;
  walkMap.line = null;
  walkMap.dot = null;
}

function walkMountLiveMap() {
  const box = document.getElementById("walkLiveMap");
  if (!box) return;
  loadWalkLeaflet().then(() => {
    const target = document.getElementById("walkLiveMap");
    if (!target || !liveSession?.walk) return;
    walkDestroyMap();
    target.innerHTML = "";
    walkMap.map = walkMakeMap(target);
    walkMap.line = L.layerGroup().addTo(walkMap.map);
    walkMap.map.on("dragstart", () => {
      walkMap.follow = false;
      const btn = document.getElementById("walkFollowBtn");
      if (btn) btn.hidden = false;
    });
    const last = walkLastPoint(liveSession.walk);
    walkMap.map.setView(last ? [last[0], last[1]] : [-23.55, -46.63], last ? 17 : 12);
    walkUpdateLiveMap();
  }).catch(() => {
    const target = document.getElementById("walkLiveMap");
    if (target) target.innerHTML = '<div class="walk-map-off">📡 Mapa sem internet. O GPS continua contando os km normalmente.</div>';
  });
}

function walkUpdateLiveMap() {
  const data = liveSession?.walk;
  if (!walkMap.map || !data) return;
  walkMap.line.clearLayers();
  data.segs.forEach((seg) => {
    if (seg.length > 1) L.polyline(seg.map((p) => [p[0], p[1]]), { color: "#3fb950", weight: 5, opacity: 0.9 }).addTo(walkMap.line);
  });
  const last = walkLastPoint(data);
  if (!last) return;
  if (walkMap.dot) walkMap.dot.setLatLng([last[0], last[1]]);
  else walkMap.dot = L.circleMarker([last[0], last[1]], { radius: 8, color: "#fff", weight: 3, fillColor: "#58a6ff", fillOpacity: 1 }).addTo(walkMap.map);
  if (walkMap.follow) walkMap.map.panTo([last[0], last[1]], { animate: true });
}

// Página do treino: mapa por cima do SVG quando tem internet
function walkMountDetailMap(workout) {
  const box = document.getElementById("walkDetailMap");
  const segs = decodeWalkTrack(workout.track);
  if (!box || !segs.length || navigator.onLine === false) return;
  loadWalkLeaflet().then(() => {
    const target = document.getElementById("walkDetailMap");
    if (!target) return;
    walkDestroyMap();
    target.innerHTML = "";
    target.classList.add("has-map");
    walkMap.map = walkMakeMap(target);
    const group = L.featureGroup().addTo(walkMap.map);
    segs.forEach((seg) => L.polyline(seg, { color: "#3fb950", weight: 5 }).addTo(group));
    const all = segs.flat();
    L.circleMarker(all[0], { radius: 6, color: "#fff", weight: 2, fillColor: "#3fb950", fillOpacity: 1 }).addTo(group);
    L.circleMarker(all[all.length - 1], { radius: 6, color: "#fff", weight: 2, fillColor: "#f85149", fillOpacity: 1 }).addTo(group);
    walkMap.map.fitBounds(group.getBounds(), { padding: [18, 18] });
  }).catch(() => {
    /* fica o mapinha SVG */
  });
}

/* ---------------------------------------------------------------------
 * Estado do treino ao vivo
 * ------------------------------------------------------------------- */
function normalizeWalkLive(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const point = (p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
    ? [Number(p[0]), Number(p[1]), Math.max(0, Math.round(Number(p[2]) || 0))]
    : null;
  const segs = (Array.isArray(data.segs) ? data.segs : [])
    .map((seg) => (Array.isArray(seg) ? seg.map(point).filter(Boolean) : []))
    .filter((seg, i, list) => seg.length || i === list.length - 1);
  return {
    activity: data.activity === "run" ? "run" : "walk",
    segs: segs.length ? segs : [[]],
    meters: Math.max(0, Number(data.meters) || 0),
    kmAt: (Array.isArray(data.kmAt) ? data.kmAt : []).map((s) => Math.max(0, Math.round(Number(s) || 0))),
    pausedAt: Number(data.pausedAt) || null,
    pausedMs: Math.max(0, Number(data.pausedMs) || 0),
    acc: Number(data.acc) || null,
  };
}

function walkLastPoint(data) {
  for (let i = data.segs.length - 1; i >= 0; i -= 1) {
    const seg = data.segs[i];
    if (seg.length) return seg[seg.length - 1];
  }
  return null;
}

function walkMovingMs(session, now = Date.now()) {
  const data = session.walk;
  const paused = data.pausedAt ? now - data.pausedAt : 0;
  return Math.max(0, now - session.startedAt - data.pausedMs - paused);
}

// min/km dos últimos WALK_PACE_WINDOW_M (só o trecho atual, sem pausa no meio)
function walkCurrentPace(data) {
  const seg = data.segs[data.segs.length - 1] || [];
  if (seg.length < 2) return 0;
  let dist = 0;
  for (let i = seg.length - 1; i > 0; i -= 1) {
    dist += walkDistanceM(seg[i - 1], seg[i]);
    if (dist >= WALK_PACE_WINDOW_M) {
      const secs = seg[seg.length - 1][2] - seg[i - 1][2];
      return secs > 0 ? secs / 60 / (dist / 1000) : 0;
    }
  }
  return 0;
}

function describeWalkLive(session) {
  const data = session.walk;
  return `${formatWorkoutNumber(data.meters / 1000, 2)} km${data.pausedAt ? " · ⏸ pausado" : ""}`;
}

/* ---------------------------------------------------------------------
 * GPS
 * ------------------------------------------------------------------- */
function walkStartGps() {
  if (walkWatchId !== null) return;
  if (!("geolocation" in navigator)) {
    walkGpsError = "Esse navegador não tem GPS.";
    walkRenderStatus();
    return;
  }
  walkWatchId = navigator.geolocation.watchPosition(walkOnFix, walkOnGpsError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 20000,
  });
}

function walkStopGps() {
  if (walkWatchId !== null) {
    try {
      navigator.geolocation.clearWatch(walkWatchId);
    } catch (err) {
      /* já parado */
    }
  }
  walkWatchId = null;
}

function walkOnGpsError(err) {
  if (err && err.code === 1) {
    walkGpsError = tobaIsApp()
      ? "Sem permissão de localização. Configurações › Apps › Toba › Permissões › Localização › Permitir."
      : "Sem permissão de localização. Libera no cadeado da barra de endereço.";
    walkStopGps();
  } else {
    walkGpsError = "Procurando o GPS... céu aberto ajuda 🛰️";
  }
  walkRenderStatus();
}

// APK 1.6+: GPS nativo com a tela apagada (mesma ponte do Toba Drive)
function walkNativeKeepAlive(on) {
  if (!TOBA_NATIVE || typeof TOBA_NATIVE.navKeepAlive !== "function") return;
  try {
    TOBA_NATIVE.navKeepAlive(Boolean(on), on ? "🚶 Caminhada em andamento no Toba" : "");
  } catch (err) {
    /* APK sem a ponte: segue com a tela acesa */
  }
}

window.onTobaNativeFix = function onTobaNativeFix(f) {
  if (!f || !Number.isFinite(Number(f.lat)) || !Number.isFinite(Number(f.lng))) return;
  // com a página na tela o GPS do WebView já chega: o nativo cobre a tela apagada
  if (!document.hidden && Date.now() - walkLastFixAt < 6000) return;
  walkOnFix({
    coords: { latitude: Number(f.lat), longitude: Number(f.lng), accuracy: Number(f.acc) || 30 },
    timestamp: Number(f.at) || Date.now(),
    native: true,
  });
};

function walkOnFix(pos) {
  const data = liveSession?.walk;
  if (!data || liveSession.kind !== "walk") return;
  if (!pos.native) walkLastFixAt = Date.now();
  walkGpsError = "";
  const acc = Number(pos.coords.accuracy) || 99;
  data.acc = Math.round(acc);
  if (data.pausedAt || acc > WALK_MAX_ACC_M) {
    walkRenderStatus();
    return;
  }
  // Hora da CHEGADA do fix (o timestamp do GPS pode vir de outro relógio ou atrasado)
  const now = Date.now();
  if (Number(pos.timestamp) && now - Number(pos.timestamp) > 30000) return; // fix velho guardado
  const at = Math.max(0, Math.round((now - liveSession.startedAt) / 1000));
  const point = [Math.round(pos.coords.latitude * 1e5) / 1e5, Math.round(pos.coords.longitude * 1e5) / 1e5, at];
  const seg = data.segs[data.segs.length - 1];
  const last = seg[seg.length - 1];
  if (last) {
    const d = walkDistanceM(last, point);
    const dt = Math.max(1, at - last[2]);
    if (d < Math.max(WALK_MIN_STEP_M, acc * 0.5) || d / dt > WALK_MAX_SPEED_MS) {
      walkRenderStatus();
      return;
    }
    const before = Math.floor(data.meters / 1000);
    data.meters += d;
    const after = Math.floor(data.meters / 1000);
    if (after > before) data.kmAt.push(Math.round(walkMovingMs(liveSession) / 1000));
    if (after > before) {
      liveBuzz([80, 60, 80]);
      tobaToast(`📍 ${after} km! Ritmo ${formatWalkPace(walkCurrentPace(data) || (walkMovingMs(liveSession) / 60000) / (data.meters / 1000))} /km`);
    }
  }
  seg.push(point);
  storeLiveSessionSoon();
  walkUpdateNumbers();
  walkUpdateLiveMap();
}

/* ---------------------------------------------------------------------
 * Começar
 * ------------------------------------------------------------------- */
function renderWalkLiveStartCard() {
  const gps = (healthDb.workouts || []).filter((w) => w.type === "walking" && w.mode === "gps").length;
  return `
    <div class="hub-title">Caminhada / Corrida com GPS${gps ? ` · ${gps}× gravadas` : ""}</div>
    <div class="toba-menu walk-start-menu">
      <button type="button" class="toba-menu-btn" data-click="startWalkLive" data-activity="walk">
        <span class="toba-menu-icon">🚶</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Caminhada ao vivo</span>
          <span class="toba-menu-desc">Trajeto no mapa, tempo, km e ritmo na hora.</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
      <button type="button" class="toba-menu-btn" data-click="startWalkLive" data-activity="run">
        <span class="toba-menu-icon">🏃</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Corrida ao vivo</span>
          <span class="toba-menu-desc">Mesmo esquema, pra quando o ônibus tá saindo.</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
    </div>
    <div class="section-divider"></div>`;
}

function startWalkLive(activity) {
  const now = Date.now();
  const act = activity === "run" ? "run" : "walk";
  liveSession = {
    v: 1,
    id: `s-${now}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "walk",
    startedAt: now,
    date: toIsoDate(),
    routineId: "",
    title: `${WALK_ACTIVITIES[act].title} ao vivo`,
    current: 0,
    exercises: [],
    walk: normalizeWalkLive({ activity: act }),
    rest: { duration: LIVE_REST_DEFAULT, startedAt: null, endsAt: null, alerted: false },
    restDefault: LIVE_REST_DEFAULT,
    updatedAt: now,
  };
  walkMap.follow = true;
  storeLiveSession();
  closeTobaModal("liveStartModal");
  closeTobaModal("workoutModal");
  openLiveSessionView();
}

// Chamado pelo openLiveSessionView (também quando volta pra um treino guardado)
function resumeWalkGps() {
  if (liveSession?.kind !== "walk") return;
  walkStartGps();
  walkNativeKeepAlive(true);
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderWalkLive(session) {
  const data = session.walk;
  const act = WALK_ACTIVITIES[data.activity];
  const paused = Boolean(data.pausedAt);
  setTimeout(walkMountLiveMap, 0);
  return `
    <div class="live-top">
      <div class="live-top-text">
        <span class="live-badge">● AO VIVO</span>
        <strong class="live-title">${act.icon} ${escapeHtml(act.title)}</strong>
      </div>
      <div class="live-clock" id="liveClock" role="timer" aria-label="Tempo em movimento">${formatLiveClock(walkMovingMs(session))}</div>
    </div>

    <div class="walk-map-wrap">
      <div class="walk-map" id="walkLiveMap"><div class="walk-map-off">🗺️ Carregando o mapa...</div></div>
      <button type="button" class="walk-follow" id="walkFollowBtn" data-click="walkFollow" hidden>🎯 Me seguir</button>
    </div>
    <div class="walk-status" id="walkStatus"></div>

    <div class="walk-numbers${paused ? " is-paused" : ""}">
      <div class="walk-big"><strong id="walkKm">0,00</strong><span>km</span></div>
      <div class="toba-stats walk-stats">
        <div class="toba-stat"><span class="toba-stat-label">⚡ Ritmo agora</span><span class="toba-stat-value" id="walkPaceNow">--</span><span class="toba-stat-sub">min/km</span></div>
        <div class="toba-stat"><span class="toba-stat-label">📊 Ritmo médio</span><span class="toba-stat-value" id="walkPaceAvg">--</span><span class="toba-stat-sub">min/km</span></div>
        <div class="toba-stat"><span class="toba-stat-label">🔥 Energia</span><span class="toba-stat-value" id="walkKcal">0</span><span class="toba-stat-sub">kcal (estimado)</span></div>
        <div class="toba-stat"><span class="toba-stat-label">🏁 Último km</span><span class="toba-stat-value" id="walkLastKm">--</span><span class="toba-stat-sub" id="walkLastKmSub">min/km</span></div>
      </div>
    </div>

    <div class="btn-row walk-actions">
      <button type="button" class="btn ${paused ? "btn-primary" : "btn-secondary"}" data-click="walkTogglePause">${paused ? "▶ Continuar" : "⏸ Pausar"}</button>
      <button type="button" class="btn btn-primary" data-click="openLiveFinish">🏁 Finalizar</button>
    </div>
    <p class="live-hint">${TOBA_NATIVE && typeof TOBA_NATIVE.navKeepAlive === "function"
      ? "📱 No app do Toba dá pra apagar a tela e guardar o celular: o GPS continua."
      : "📱 No navegador o GPS só conta com o Toba aberto na tela. No app do Toba (APK 1.6+) dá pra apagar a tela."}</p>

    <div class="live-footer">
      ${renderLiveAwakeToggle()}
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Cancelar treino</button>
    </div>`;
}

function walkUpdateNumbers(now = Date.now()) {
  const session = liveSession;
  const data = session?.walk;
  if (!data) return;
  const km = data.meters / 1000;
  const movingMin = walkMovingMs(session, now) / 60000;
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  set("liveClock", formatLiveClock(walkMovingMs(session, now)));
  set("walkKm", formatWorkoutNumber(km, 2));
  set("walkPaceNow", data.pausedAt ? "⏸" : formatWalkPace(walkCurrentPace(data)));
  set("walkPaceAvg", km > 0.05 ? formatWalkPace(movingMin / km) : "--");
  set("walkKcal", formatWorkoutNumber(estimateWalkKcal(km, data.activity, session.date), 0));
  if (data.kmAt.length) {
    const lastKm = data.kmAt.length;
    const secs = data.kmAt[lastKm - 1] - (data.kmAt[lastKm - 2] || 0);
    set("walkLastKm", formatWalkPace(secs / 60));
    set("walkLastKmSub", `min no km ${lastKm}`);
  }
}

function walkRenderStatus() {
  const box = document.getElementById("walkStatus");
  const data = liveSession?.walk;
  if (!box || !data) return;
  let text;
  let cls = "";
  if (walkGpsError) {
    text = walkGpsError;
    cls = "is-bad";
  } else if (data.pausedAt) {
    text = "⏸ Pausado: o GPS não soma km até continuar.";
    cls = "is-warn";
  } else if (!data.acc) {
    text = "🛰️ Procurando o GPS...";
    cls = "is-warn";
  } else if (data.acc > WALK_MAX_ACC_M) {
    text = `🛰️ GPS fraco (±${data.acc} m): espera melhorar pra contar.`;
    cls = "is-warn";
  } else {
    text = `🛰️ GPS ok · ±${data.acc} m`;
  }
  box.className = `walk-status ${cls}`;
  if (box.textContent !== text) box.textContent = text;
}

// Roda no tique do treino ao vivo (250 ms)
function walkTick(now = Date.now()) {
  walkUpdateNumbers(now);
  walkRenderStatus();
}

function estimateWalkKcal(km, activity, date) {
  const kg = typeof getBodyWeightOn === "function" ? getBodyWeightOn(date) : 75;
  return Math.round((Number(kg) || 75) * km * (WALK_KCAL_PER_KG_KM[activity] || WALK_KCAL_PER_KG_KM.walk));
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
function walkTogglePause() {
  const data = liveSession?.walk;
  if (!data) return;
  const now = Date.now();
  if (data.pausedAt) {
    data.pausedMs += now - data.pausedAt;
    data.pausedAt = null;
    if (data.segs[data.segs.length - 1].length) data.segs.push([]); // trecho novo: não liga o risco por cima da pausa
    tobaToast("▶ Bora! Contando de novo");
  } else {
    data.pausedAt = now;
    tobaToast("⏸ Pausado. O café da padaria pode.");
  }
  storeLiveSession();
  renderLiveSession();
}

function walkFollow() {
  walkMap.follow = true;
  const btn = document.getElementById("walkFollowBtn");
  if (btn) btn.hidden = true;
  walkUpdateLiveMap();
}

function openWalkLiveFinish() {
  const session = liveSession;
  const data = session.walk;
  const km = data.meters / 1000;
  const minutes = Math.max(1, Math.round(walkMovingMs(session) / 60000));
  const pace = km > 0 ? minutes / km : 0;
  const suggested = data.activity === "run" || (pace > 0 && pace < WALK_RUN_PACE) ? "run" : "walk";
  document.getElementById("walkFinishSummary").textContent = km > 0
    ? `${formatWorkoutNumber(km, 2)} km em ${minutes} min · ritmo ${formatWalkPace(pace)} min/km.`
    : `${minutes} min e o GPS não contou distância (tava parado ou sem sinal). Dá pra salvar mesmo assim.`;
  document.getElementById("walk-finish-km").value = km > 0 ? km.toFixed(2) : "";
  document.getElementById("walk-finish-minutes").value = String(minutes);
  document.getElementById("walk-finish-calories").value = km > 0 ? String(estimateWalkKcal(km, suggested, session.date)) : "";
  document.getElementById("walk-finish-notes").value = "";
  setWalkFinishActivity(suggested);
  if (typeof workoutWatchRowSetup === "function") workoutWatchRowSetup(null, "walkWatchRow", "walk-watch-pending"); // v2.04
  walkPendingFinish = { moved: km };
  openTobaModal("walkFinishModal");
}

function setWalkFinishActivity(activity) {
  const act = activity === "run" ? "run" : "walk";
  document.getElementById("walk-finish-activity").value = act;
  document.querySelectorAll("#walkFinishModal [data-walk-activity]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.walkActivity === act);
  });
}

function saveWalkLive() {
  if (!liveSession?.walk) return;
  if (!isHealthDbLoaded) {
    showHealthDbLockedMessage();
    return;
  }
  const data = liveSession.walk;
  const activity = document.getElementById("walk-finish-activity").value === "run" ? "run" : "walk";
  const kmTyped = parseTobaDecimal(document.getElementById("walk-finish-km").value);
  const minutes = Number(document.getElementById("walk-finish-minutes").value);
  const calories = Number(document.getElementById("walk-finish-calories").value);
  const durationMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : Math.max(1, Math.round(walkMovingMs(liveSession) / 60000));
  const splits = data.kmAt.map((secs, i) => secs - (data.kmAt[i - 1] || 0)).filter((secs) => secs > 0);
  const start = new Date(liveSession.startedAt);
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "walking",
    title: WALK_ACTIVITIES[activity].title,
    date: liveSession.date,
    durationMinutes,
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    distanceKm: kmTyped && kmTyped > 0 ? Math.round(kmTyped * 100) / 100 : null,
    pushups: null,
    situps: null,
    squats: null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: document.getElementById("walk-finish-notes").value.trim(),
    mode: "gps",
    source: "toba",
    track: encodeWalkTrack(data.segs),
    splits,
    startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
  };
  if (!workout.track) delete workout.track;
  liveApplyWatchPending(workout, "walk-watch-pending"); // v2.04: ⌚ mesclar com o relógio
  healthDb.workouts.push(workout);
  saveHealthDb();
  let saved = false;
  try {
    saved = (localStorage.getItem(HEALTH_KEY) || "").includes(`"${workout.id}"`);
  } catch (err) {
    saved = false;
  }
  if (!saved) {
    healthDb.workouts = healthDb.workouts.filter((item) => item.id !== workout.id);
    return;
  }
  closeTobaModal("walkFinishModal");
  stopWalkLive();
  dropLiveSession();
  stopLiveTicker();
  tobaPlayerCheck({ reason: `${WALK_ACTIVITIES[activity].title} no histórico ${WALK_ACTIVITIES[activity].icon}` });
  openModule("viewTraining");
  openWorkoutView(workout.id);
  tobaToast(`${WALK_ACTIVITIES[activity].icon} ${WALK_ACTIVITIES[activity].title} no histórico!`);
}

// Saiu do treino (salvou ou descartou): desliga GPS, serviço do APK e mapa
function stopWalkLive() {
  walkStopGps();
  walkNativeKeepAlive(false);
  walkDestroyMap();
  walkGpsError = "";
}

/* ---------------------------------------------------------------------
 * Formulário manual (Na rua / Esteira) e página do treino
 * ------------------------------------------------------------------- */
function renderWalkFormExtras() {
  return `
    <button type="button" class="walk-gps-cta" data-click="startWalkLiveFromForm">
      <span class="walk-gps-cta-icon" aria-hidden="true">📡</span>
      <span><strong>Gravar agora com GPS</strong><small>Trajeto no mapa, tempo e ritmo ao vivo</small></span>
      <span aria-hidden="true">›</span>
    </button>
    <div class="walk-or">ou anota uma que já fez 👇</div>
    <input type="hidden" id="workout-walk-mode" value="manual" />
    <input type="hidden" id="workout-walk-activity" value="walk" />
    <div class="form-group">
      <span class="form-label">Onde foi</span>
      <div class="walk-chips">
        <button type="button" class="live-chip active" data-click="pickWalkFormMode" data-mode="manual">✍️ Na rua</button>
        <button type="button" class="live-chip" data-click="pickWalkFormMode" data-mode="treadmill">🏃 Esteira</button>
      </div>
    </div>
    <div class="form-group">
      <span class="form-label">O que foi</span>
      <div class="walk-chips">
        <button type="button" class="live-chip active" data-click="pickWalkFormActivity" data-activity="walk">🚶 Caminhada</button>
        <button type="button" class="live-chip" data-click="pickWalkFormActivity" data-activity="run">🏃 Corrida</button>
      </div>
    </div>`;
}

function renderWalkFormTail() {
  return `
    <div class="form-group" id="walkInclineGroup" hidden>
      <label for="workout-incline">Inclinação da esteira (%, opcional)</label>
      <input id="workout-incline" class="form-control" type="number" inputmode="decimal" min="0" max="40" step="0.5" />
    </div>
    <div class="form-group">
      <label for="workout-source">Origem dos dados</label>
      <select id="workout-source" class="form-control">
        <option value="manual">✍️ Anotei na mão</option>
        <option value="watch">⌚ Relógio (Galaxy Watch, Samsung Health)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="workout-notes">Observações (opcional)</label>
      <input id="workout-notes" class="form-control" type="text" maxlength="160" placeholder="Por onde andou?" />
    </div>`;
}

function pickWalkFormMode(el) {
  const mode = el.dataset.mode === "treadmill" ? "treadmill" : "manual";
  document.getElementById("workout-walk-mode").value = mode;
  el.parentElement.querySelectorAll(".live-chip").forEach((btn) => btn.classList.toggle("active", btn === el));
  const incline = document.getElementById("walkInclineGroup");
  if (incline) incline.hidden = mode !== "treadmill";
}

function pickWalkFormActivity(el) {
  const act = el.dataset.activity === "run" ? "run" : "walk";
  document.getElementById("workout-walk-activity").value = act;
  document.getElementById("workout-walk-activity").dataset.touched = "1";
  el.parentElement.querySelectorAll(".live-chip").forEach((btn) => btn.classList.toggle("active", btn === el));
}

// Editar: o formulário volta com o que estava gravado (GPS edita só os números)
function fillWalkForm(workout) {
  const mode = workout.mode === "treadmill" ? "treadmill" : workout.mode === "gps" ? "gps" : "manual";
  const modeBtn = document.querySelector(`[data-click="pickWalkFormMode"][data-mode="${mode === "gps" ? "manual" : mode}"]`);
  if (modeBtn) pickWalkFormMode(modeBtn);
  document.getElementById("workout-walk-mode").value = mode;
  const actBtn = document.querySelector(`[data-click="pickWalkFormActivity"][data-activity="${/corrida/i.test(workout.title || "") && !/caminhada/i.test(workout.title || "") ? "run" : "walk"}"]`);
  if (actBtn) pickWalkFormActivity(actBtn);
  document.getElementById("workout-walk-activity").dataset.touched = "";
  const cta = document.querySelector(".walk-gps-cta");
  if (cta) cta.hidden = true;
  const or = document.querySelector(".walk-or");
  if (or) or.hidden = true;
  if (mode === "gps") {
    document.querySelectorAll('[data-click="pickWalkFormMode"]').forEach((btn) => {
      btn.disabled = true;
    });
  }
  const source = document.getElementById("workout-source");
  if (source) {
    if (workout.source && !source.querySelector(`option[value="${workout.source}"]`)) {
      source.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(workout.source)}">${escapeHtml(WALK_SOURCES[workout.source] || workout.source)}</option>`);
    }
    source.value = workout.source || "manual";
  }
  const incline = document.getElementById("workout-incline");
  if (incline && workout.incline !== null && workout.incline !== undefined) incline.value = workout.incline;
  const notes = document.getElementById("workout-notes");
  if (notes) notes.value = workout.notes || "";
}

// Campos da caminhada no salvar do formulário (title, mode, source, incline)
function readWalkFormExtras(original) {
  const mode = document.getElementById("workout-walk-mode")?.value || "manual";
  const actEl = document.getElementById("workout-walk-activity");
  const act = actEl?.value === "run" ? "run" : "walk";
  // Treino antigo "Caminhada / Corrida" mantém o nome se ninguém tocou no chip
  const title = original && !actEl?.dataset.touched && original.title ? original.title : WALK_ACTIVITIES[act].title;
  const inclineRaw = document.getElementById("workout-incline")?.value;
  const incline = inclineRaw === undefined || inclineRaw === "" ? null : Math.max(0, Number(inclineRaw) || 0);
  const extras = {
    title,
    mode: ["gps", "treadmill"].includes(mode) ? mode : "manual",
    source: document.getElementById("workout-source")?.value || "manual",
  };
  if (extras.mode === "treadmill") extras.incline = incline;
  return extras;
}

// Chips do card no histórico
function getWalkChips(workout) {
  if (workout.type !== "walking") return [];
  const chips = [];
  const pace = getWalkPace(workout);
  if (pace) chips.push(`⚡ ${formatWalkPace(pace)} /km`);
  if (workout.mode === "gps") chips.push("📡 GPS");
  if (workout.mode === "treadmill") chips.push(`🏃 Esteira${Number(workout.incline) ? ` ${formatWorkoutNumber(workout.incline, 1)}%` : ""}`);
  if (workout.source === "watch" || workout.source === "health-connect") chips.push("⌚ Relógio");
  return chips;
}

function renderWalkRecordMap(workout) {
  if (workout.type !== "walking") return "";
  const segs = decodeWalkTrack(workout.track);
  return segs.length ? `<div class="walk-record-map">${walkMiniMapSvg(segs)}</div>` : "";
}

// Página do treino: mapa + parciais por km + origem
function renderWalkWorkoutDetail(workout) {
  if (workout.type !== "walking") return "";
  const segs = decodeWalkTrack(workout.track);
  const parts = [];
  if (segs.length) {
    parts.push(`
      <div class="section-title">🗺️ Trajeto</div>
      <div class="walk-detail-map" id="walkDetailMap">${walkMiniMapSvg(segs, { width: 320, height: 200, cls: "walk-mini is-big" })}</div>`);
    setTimeout(() => walkMountDetailMap(workout), 0);
  }
  const splits = Array.isArray(workout.splits) ? workout.splits.filter((s) => Number(s) > 0) : [];
  if (splits.length) {
    const best = Math.min(...splits);
    parts.push(`
      <div class="section-title">⏱️ Km por km</div>
      <div class="card walk-splits">${splits.map((secs, i) => `
        <div class="walk-split${secs === best && splits.length > 1 ? " is-best" : ""}">
          <span>Km ${i + 1}</span>
          <span class="walk-split-bar"><span style="width: ${Math.round((best / secs) * 100)}%"></span></span>
          <strong>${formatWalkPace(secs / 60)}</strong>
        </div>`).join("")}
      </div>`);
  }
  const info = [];
  if (workout.mode !== "gps") info.push(`${(WALK_MODES[workout.mode] || WALK_MODES.manual).icon} ${(WALK_MODES[workout.mode] || WALK_MODES.manual).label}`);
  info.push(WALK_SOURCES[workout.source] || WALK_SOURCES.manual);
  if (workout.startTime) info.push(`🕐 saiu às ${escapeHtml(workout.startTime)}`);
  if (workout.mode === "treadmill" && Number(workout.incline)) info.push(`⛰️ ${formatWorkoutNumber(workout.incline, 1)}% de inclinação`);
  parts.push(`<div class="workout-record-chips walk-detail-info">${info.map((chip) => `<span class="workout-chip">${chip}</span>`).join("")}</div>`);
  return parts.join("");
}

/* ---------------------------------------------------------------------
 * 📜 Histórico de caminhadas (viewWalks)
 * ------------------------------------------------------------------- */
function renderWalkHistory() {
  const box = document.getElementById("walkHistoryContent");
  if (!box) return;
  const walks = (healthDb.workouts || [])
    .filter((w) => w.type === "walking")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.startTime || "").localeCompare(String(a.startTime || "")));
  const monthKey = toIsoDate().slice(0, 7);
  const km = (list) => list.reduce((sum, w) => sum + (Number(w.distanceKm) || 0), 0);
  const longest = walks.reduce((best, w) => ((Number(w.distanceKm) || 0) > (Number(best?.distanceKm) || 0) ? w : best), null);
  const paced = walks.filter((w) => (Number(w.distanceKm) || 0) >= 1 && getWalkPace(w) > 0);
  const fastest = paced.reduce((best, w) => (!best || getWalkPace(w) < getWalkPace(best) ? w : best), null);
  const tile = (label, value, sub) => `
    <div class="toba-stat">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </div>`;
  const cards = walks.map((w) => {
    const segs = decodeWalkTrack(w.track);
    const icon = /corrida/i.test(w.title || "") && !/caminhada/i.test(w.title || "") ? "🏃" : w.mode === "treadmill" ? "🏃" : "🚶";
    const chips = [];
    if (w.distanceKm) chips.push(`📍 ${formatWorkoutNumber(w.distanceKm, 2)} km`);
    if (w.durationMinutes) chips.push(`⏱️ ${formatWorkoutNumber(w.durationMinutes, 0)} min`);
    chips.push(...getWalkChips(w));
    return `
      <button type="button" class="walk-card" data-click="openWorkoutView" data-id="${escapeHtml(w.id)}">
        <span class="walk-card-map">${segs.length ? walkMiniMapSvg(segs, { width: 96, height: 72 }) : `<span class="walk-card-icon">${icon}</span>`}</span>
        <span class="walk-card-body">
          <span class="walk-card-title">${escapeHtml(w.title || "Caminhada")}</span>
          <span class="walk-card-date">${formatWorkoutDate(w.date)}${w.startTime ? ` · ${escapeHtml(w.startTime)}` : ""}</span>
          <span class="workout-record-chips">${chips.map((chip) => `<span class="workout-chip">${chip}</span>`).join("")}</span>
        </span>
      </button>`;
  }).join("");
  box.innerHTML = `
    <button type="button" class="walk-gps-cta" data-click="startWalkLive" data-activity="walk">
      <span class="walk-gps-cta-icon" aria-hidden="true">📡</span>
      <span><strong>Bora caminhar com GPS</strong><small>Mapa, tempo e ritmo ao vivo</small></span>
      <span aria-hidden="true">›</span>
    </button>
    <div class="toba-stats">
      ${tile("🌍 No total", `<span class="text-blue">${formatWorkoutNumber(km(walks), 1)} km</span>`, `em ${walks.length} ${walks.length === 1 ? "saída" : "saídas"}`)}
      ${tile("📅 Este mês", `<span class="text-green">${formatWorkoutNumber(km(walks.filter((w) => String(w.date).startsWith(monthKey))), 1)} km</span>`, `${walks.filter((w) => String(w.date).startsWith(monthKey)).length} saídas`)}
      ${tile("🏔️ Mais longa", longest && Number(longest.distanceKm) ? `${formatWorkoutNumber(longest.distanceKm, 2)} km` : "--", longest && Number(longest.distanceKm) ? formatWorkoutDate(longest.date) : "ainda não")}
      ${tile("⚡ Melhor ritmo", fastest ? `${formatWalkPace(getWalkPace(fastest))}` : "--", fastest ? "min/km (1 km+)" : "1 km+ com tempo")}
    </div>
    <div class="section-title">📜 Todas</div>
    <div class="walk-list">${cards || tobaEmpty("🚶", "Nenhuma caminhada ainda", "Toca em Bora caminhar com GPS ou registra uma na mão no + Treino.", { compact: true })}</div>`;
}

tobaActions({
  startWalkLive: (el) => startWalkLive(el.dataset.activity),
  startWalkLiveFromForm: () => {
    const act = document.getElementById("workout-walk-activity")?.value === "run" ? "run" : "walk";
    startWalkLive(act);
  },
  walkTogglePause,
  walkFollow,
  saveWalkLive,
  pickWalkFinishActivity: (el) => setWalkFinishActivity(el.dataset.walkActivity),
  pickWalkFormMode,
  pickWalkFormActivity,
  openWalkHistory: () => openModule("viewWalks"),
});
