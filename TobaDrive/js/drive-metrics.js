/* =====================================================================
 * Toba Drive · regras puras (desde v1.65)
 * - Só LÊ (recebe o banco por parâmetro); nunca grava. Usado no hub, no
 *   Navegar e no card do portal (que carrega este arquivo sozinho).
 * - Conta de mapa: distância (haversine), rumo, projeção do GPS na rota,
 *   polyline do roteador e o texto/voz das manobras em pt-BR.
 * ===================================================================== */

const DRIVE_EARTH_M = 6371008.8;

function driveSafeDb(db) {
  const d = db && typeof db === "object" ? db : {};
  return {
    favorites: Array.isArray(d.favorites) ? d.favorites : [],
    recent: Array.isArray(d.recent) ? d.recent : [],
    trips: Array.isArray(d.trips) ? d.trips : [],
  };
}

// Resumo pro hub e pro portal: viagens/km do mês e da vida toda
function calcDriveSummary(db, today = new Date()) {
  const d = driveSafeDb(db);
  const month = toIsoDate(today).slice(0, 7);
  const trips = d.trips.filter((t) => t && typeof t.date === "string");
  const monthTrips = trips.filter((t) => t.date.startsWith(month));
  const sumKm = (list) => list.reduce((acc, t) => acc + (Number(t.km) || 0), 0);
  const last = [...trips].sort((a, b) => (Number(b.endedAt) || 0) - (Number(a.endedAt) || 0))[0] || null;
  return {
    trips: trips.length,
    km: sumKm(trips),
    monthTrips: monthTrips.length,
    monthKm: sumKm(monthTrips),
    arrived: trips.filter((t) => t.arrived).length,
    favorites: d.favorites.length,
    last,
  };
}

/* ---------- geometria ---------- */
function driveRad(deg) {
  return (deg * Math.PI) / 180;
}

function driveDist(a, b) {
  // a, b = [lat, lng] (metros)
  const dLat = driveRad(b[0] - a[0]);
  const dLng = driveRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(driveRad(a[0])) * Math.cos(driveRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * DRIVE_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function driveBearing(a, b) {
  const y = Math.sin(driveRad(b[1] - a[1])) * Math.cos(driveRad(b[0]));
  const x = Math.cos(driveRad(a[0])) * Math.sin(driveRad(b[0])) - Math.sin(driveRad(a[0])) * Math.cos(driveRad(b[0])) * Math.cos(driveRad(b[1] - a[1]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Polyline do Google/Valhalla (precision 6 no Valhalla, 5 no OSRM)
function driveDecodePolyline(str, precision = 6) {
  const factor = 10 ** precision;
  const out = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < str.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

// Metros acumulados em cada ponto da rota
function driveCumulative(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) cum.push(cum[i - 1] + driveDist(coords[i - 1], coords[i]));
  return cum;
}

// Projeta o ponto p no segmento a-b (plano local, serve pra poucos km)
function driveProjectOnSegment(p, a, b) {
  const kx = Math.cos(driveRad(p[0])) * 111320;
  const ky = 110540;
  const ax = (a[1] - p[1]) * kx;
  const ay = (a[0] - p[0]) * ky;
  const bx = (b[1] - p[1]) * kx;
  const by = (b[0] - p[0]) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return { t, dist: Math.sqrt(px * px + py * py) };
}

// Onde o carro está na rota: segmento, metros andados na rota e distância da linha.
// Procura primeiro perto do último segmento (rápido e não "pula" pra outra perna
// que passa perto); se lá estiver longe, procura na rota toda.
function driveLocateOnRoute(route, p, hintSeg = 0) {
  const { coords, cum } = route;
  if (!coords || coords.length < 2) return null;
  const scan = (from, to) => {
    let best = null;
    for (let i = Math.max(0, from); i < Math.min(coords.length - 1, to); i += 1) {
      const pr = driveProjectOnSegment(p, coords[i], coords[i + 1]);
      if (!best || pr.dist < best.dist) {
        const segLen = cum[i + 1] - cum[i];
        best = { seg: i, dist: pr.dist, along: cum[i] + pr.t * segLen };
      }
    }
    return best;
  };
  let best = scan(hintSeg - 3, hintSeg + 80);
  if (!best || best.dist > 60) {
    const all = scan(0, coords.length);
    if (all && (!best || all.dist < best.dist)) best = all;
  }
  return best;
}

/* ---------- textos ---------- */
function driveFormatKm(m) {
  const km = (Number(m) || 0) / 1000;
  if (km < 10) return km.toFixed(1).replace(".", ",");
  return String(Math.round(km));
}

// Distância curta pra tela: "350 m", "1,2 km"
function driveFormatDist(m) {
  const v = Math.max(0, Number(m) || 0);
  if (v < 1000) return `${v < 100 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50} m`;
  return `${driveFormatKm(v)} km`;
}

// Distância falada: "300 metros", "1,5 quilômetro"
function driveSpokenDist(m) {
  const v = Math.max(0, Number(m) || 0);
  if (v < 1000) return `${v < 100 ? Math.max(10, Math.round(v / 10) * 10) : Math.round(v / 50) * 50} metros`;
  const km = Math.round(v / 100) / 10;
  const txt = String(km).replace(".", ",");
  return `${txt} ${km < 2 ? "quilômetro" : "quilômetros"}`;
}

function driveFormatDuration(s) {
  const min = Math.max(1, Math.round((Number(s) || 0) / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

function driveFormatClock(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------- manobras ----------
 * Cada passo da rota vira { idx, type, icon, text, alert, pre, street }:
 *   idx   = ponto da rota onde a manobra acontece
 *   type  = "depart" | "arrive" | "left" | "right" | "slight-left" | ... (pra seta)
 *   text  = o que aparece na faixa de cima
 *   alert = frase falada de longe ("Em 300 metros, " + alert)
 *   pre   = frase falada na hora ("Vire à direita na Rua X")
 */
const DRIVE_ARROWS = {
  depart: "⬆️",
  straight: "⬆️",
  "slight-right": "↗️",
  right: "➡️",
  "sharp-right": "↘️",
  "slight-left": "↖️",
  left: "⬅️",
  "sharp-left": "↙️",
  uturn: "↩️",
  roundabout: "🔄",
  merge: "⤴️",
  ramp: "↗️",
  ferry: "⛴️",
  arrive: "🏁",
};

// Tipos do Valhalla (https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/)
const DRIVE_VALHALLA_TYPES = {
  1: "depart", 2: "depart", 3: "depart",
  4: "arrive", 5: "arrive", 6: "arrive",
  7: "straight", 8: "straight",
  9: "slight-right", 10: "right", 11: "sharp-right",
  12: "uturn", 13: "uturn",
  14: "sharp-left", 15: "left", 16: "slight-left",
  17: "straight", 18: "ramp", 19: "ramp", 20: "ramp", 21: "ramp",
  22: "straight", 23: "slight-right", 24: "slight-left",
  25: "merge", 26: "roundabout", 27: "roundabout",
  28: "ferry", 29: "ferry",
  37: "merge", 38: "merge",
};

function driveArrow(type) {
  return DRIVE_ARROWS[type] || "⬆️";
}

// OSRM só manda tipo + direção + nome da rua: o texto em pt-BR sai daqui
const DRIVE_OSRM_SIDE = {
  left: { type: "left", verb: "Vire à esquerda" },
  right: { type: "right", verb: "Vire à direita" },
  "slight left": { type: "slight-left", verb: "Mantenha-se à esquerda" },
  "slight right": { type: "slight-right", verb: "Mantenha-se à direita" },
  "sharp left": { type: "sharp-left", verb: "Vire bem à esquerda" },
  "sharp right": { type: "sharp-right", verb: "Vire bem à direita" },
  uturn: { type: "uturn", verb: "Faça o retorno" },
  straight: { type: "straight", verb: "Siga em frente" },
};

function driveOsrmStepText(step) {
  const m = step.maneuver || {};
  const name = step.name || step.ref || "";
  const on = name ? ` na ${name}` : "";
  const side = DRIVE_OSRM_SIDE[m.modifier] || DRIVE_OSRM_SIDE.straight;
  if (m.type === "depart") return { type: "depart", pre: `Siga${name ? ` pela ${name}` : " em frente"}` };
  if (m.type === "arrive") return { type: "arrive", pre: "Você chegou ao destino" };
  if (m.type === "roundabout" || m.type === "rotary" || m.type === "roundabout turn") {
    const exit = Number(m.exit) || 0;
    return { type: "roundabout", pre: `Na rotatória, pegue a ${exit ? `${exit}ª saída` : "saída"}${on}` };
  }
  if (m.type === "exit roundabout" || m.type === "exit rotary") return { type: "roundabout", pre: `Saia da rotatória${on}` };
  if (m.type === "merge") return { type: "merge", pre: `Entre${on || " na via"}` };
  if (m.type === "on ramp") return { type: "ramp", pre: `Pegue o acesso${on}` };
  if (m.type === "off ramp") return { type: "ramp", pre: `Pegue a saída${on}` };
  if (m.type === "fork") return { type: side.type, pre: `Na bifurcação, ${side.verb.toLowerCase()}${on}` };
  if (m.type === "continue" || m.type === "new name") {
    if (!m.modifier || m.modifier === "straight") return { type: "straight", pre: `Continue${name ? ` pela ${name}` : " em frente"}` };
  }
  return { type: side.type, pre: `${side.verb}${on}` };
}

function driveLowerFirst(text) {
  const t = String(text || "").trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : "";
}

function driveStripDot(text) {
  return String(text || "").trim().replace(/[.!]+$/, "");
}

/* ---------- rota normalizada ----------
 * { provider, coords: [[lat,lng]], cum: [m], distance: m, duration: s, steps: [...] }
 */
function driveRouteFromValhalla(json) {
  const leg = json?.trip?.legs?.[0];
  if (!leg || !leg.shape) return null;
  const coords = driveDecodePolyline(leg.shape, 6);
  const cum = driveCumulative(coords);
  const steps = (leg.maneuvers || []).map((m) => {
    const type = DRIVE_VALHALLA_TYPES[m.type] || "straight";
    const pre = driveStripDot(m.verbal_pre_transition_instruction || m.instruction);
    const alert = driveStripDot(m.verbal_transition_alert_instruction || m.verbal_succinct_transition_instruction || pre);
    return {
      idx: Math.min(coords.length - 1, Number(m.begin_shape_index) || 0),
      type,
      icon: driveArrow(type),
      text: driveStripDot(m.instruction || pre),
      alert,
      pre,
      street: (m.street_names || m.begin_street_names || [])[0] || "",
      time: Number(m.time) || 0,
    };
  });
  const summary = json.trip.summary || leg.summary || {};
  return {
    provider: "valhalla",
    coords,
    cum,
    distance: (Number(summary.length) || 0) * 1000 || cum[cum.length - 1],
    duration: Number(summary.time) || 0,
    steps,
  };
}

// TomTom Routing v1 (v1.66): maneuver -> nosso tipo de seta
const DRIVE_TOMTOM_TYPES = {
  DEPART: "depart",
  ARRIVE: "arrive", ARRIVE_LEFT: "arrive", ARRIVE_RIGHT: "arrive",
  STRAIGHT: "straight", FOLLOW: "straight", SWITCH_PARALLEL_ROAD: "straight", SWITCH_MAIN_ROAD: "straight",
  KEEP_RIGHT: "slight-right", BEAR_RIGHT: "slight-right", TURN_RIGHT: "right", SHARP_RIGHT: "sharp-right",
  KEEP_LEFT: "slight-left", BEAR_LEFT: "slight-left", TURN_LEFT: "left", SHARP_LEFT: "sharp-left",
  MAKE_UTURN: "uturn", TRY_MAKE_UTURN: "uturn",
  ROUNDABOUT_CROSS: "roundabout", ROUNDABOUT_RIGHT: "roundabout", ROUNDABOUT_LEFT: "roundabout", ROUNDABOUT_BACK: "roundabout",
  ENTER_MOTORWAY: "merge", ENTER_FREEWAY: "merge", ENTER_HIGHWAY: "merge", ENTRANCE_RAMP: "ramp",
  TAKE_EXIT: "ramp", MOTORWAY_EXIT_LEFT: "ramp", MOTORWAY_EXIT_RIGHT: "ramp",
  TAKE_FERRY: "ferry",
};

// Trechos de trânsito da rota: { from, to (índices em coords), level 1-4 }
function driveTomTomJams(route) {
  return (route?.sections || [])
    .filter((s) => s && s.sectionType === "TRAFFIC" && Number.isFinite(s.startPointIndex) && Number.isFinite(s.endPointIndex))
    .map((s) => ({
      from: s.startPointIndex,
      to: s.endPointIndex,
      level: s.simpleCategory === "ROAD_CLOSURE" ? 4 : Math.max(1, Math.min(4, Number(s.magnitudeOfDelay) || 1)),
      delay: Number(s.delayInSeconds) || 0,
    }));
}

function driveRouteFromTomTom(json) {
  const r = json?.routes?.[0];
  const points = (r?.legs || []).flatMap((leg) => leg?.points || []);
  if (!r || points.length < 2) return null;
  const coords = points.map((p) => [Number(p.latitude), Number(p.longitude)]);
  const cum = driveCumulative(coords);
  const steps = (r.guidance?.instructions || []).map((ins) => {
    const type = DRIVE_TOMTOM_TYPES[ins.maneuver] || "straight";
    let pre = driveStripDot(String(ins.message || "").replace(/<[^>]*>/g, ""));
    if (!pre) pre = type === "arrive" ? "Você chegou ao destino" : `Siga${ins.street ? ` pela ${ins.street}` : " em frente"}`;
    return {
      idx: Math.max(0, Math.min(coords.length - 1, Number(ins.pointIndex) || 0)),
      type,
      icon: driveArrow(type),
      text: pre,
      alert: pre,
      pre,
      street: ins.street || "",
      time: Number(ins.travelTimeInSeconds) || 0,
    };
  });
  const sum = r.summary || {};
  return {
    provider: "tomtom",
    coords,
    cum,
    distance: Number(sum.lengthInMeters) || cum[cum.length - 1],
    duration: Number(sum.travelTimeInSeconds) || 0,
    trafficDelay: Number(sum.trafficDelayInSeconds) || 0,
    jams: driveTomTomJams(r),
    steps,
  };
}

function driveRouteFromOsrm(json) {
  const r = json?.routes?.[0];
  const line = r?.geometry?.coordinates;
  if (!r || !Array.isArray(line) || line.length < 2) return null;
  const coords = line.map(([lng, lat]) => [lat, lng]);
  const cum = driveCumulative(coords);
  const raw = (r.legs?.[0]?.steps || []);
  let cursor = 0;
  const steps = raw.map((s) => {
    const loc = s.maneuver?.location;
    // ponto da rota mais perto da manobra, andando sempre pra frente
    if (Array.isArray(loc)) {
      const p = [loc[1], loc[0]];
      let best = cursor;
      let bestD = Infinity;
      for (let i = cursor; i < Math.min(coords.length, cursor + 400); i += 1) {
        const d = driveDist(p, coords[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
        if (bestD < 2) break;
      }
      cursor = best;
    }
    const t = driveOsrmStepText(s);
    return {
      idx: cursor,
      type: t.type,
      icon: driveArrow(t.type),
      text: t.pre,
      alert: t.pre,
      pre: t.pre,
      street: s.name || "",
      time: Number(s.duration) || 0,
    };
  });
  return { provider: "osrm", coords, cum, distance: Number(r.distance) || cum[cum.length - 1], duration: Number(r.duration) || 0, steps };
}

// Próxima manobra a partir de "along" (metros andados na rota)
function driveNextStep(route, along) {
  const steps = route.steps || [];
  for (let i = 0; i < steps.length; i += 1) {
    const at = route.cum[steps[i].idx] ?? 0;
    if (steps[i].type === "depart") continue;
    if (at > along + 8) return { index: i, step: steps[i], dist: at - along };
  }
  const last = steps[steps.length - 1] || null;
  return last ? { index: steps.length - 1, step: last, dist: Math.max(0, route.distance - along) } : null;
}

/* ---------- conquistas do Perfil (v1.67) ----------
 * Números em ordem de data pro computePlayer() (toba-player.js) conferir as
 * conquistas "dv-*". Só viagem que CHEGOU conta (encerrar no meio não vale).
 * etaS = previsão da rota na hora do 🚀 Partiu (viagem antiga não tem: não
 * entra nas de tempo). "Max Tobasten" = rota de 10 min+ feita em 90% do
 * previsto ou menos; "Relógio suíço" = dentro de 3% do previsto.
 */
const DRIVE_TOBASTEN_MIN_ETA_S = 600;
const DRIVE_TOBASTEN_RATIO = 0.9;
const DRIVE_SWISS_MARGIN = 0.03;

// Quanto a viagem foi mais rápida que o previsto (0.12 = 12% antes). null = sem previsão.
function driveTripAhead(trip) {
  const eta = Number(trip?.etaS) || 0;
  const took = ((Number(trip?.endedAt) || 0) - (Number(trip?.startedAt) || 0)) / 1000;
  if (eta < DRIVE_TOBASTEN_MIN_ETA_S || took <= 0) return null;
  return 1 - took / eta;
}

function driveTripIsNight(trip) {
  const h = new Date(Number(trip?.startedAt) || 0).getHours();
  return h >= 22 || h < 5;
}

function calcDrivePlayer(data, today) {
  const d = driveSafeDb(data);
  const trips = d.trips
    .filter((t) => t && t.arrived && typeof t.date === "string" && t.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.endedAt) || 0) - (Number(b.endedAt) || 0));
  const stats = { driveArrived: 0, driveKm: 0, driveNight: 0, driveLongest: 0, driveTobasten: 0, driveSwiss: 0 };
  const timeline = trips.map((t) => {
    const km = Number(t.km) || 0;
    stats.driveArrived += 1;
    stats.driveKm = Math.round((stats.driveKm + km) * 10) / 10;
    stats.driveLongest = Math.max(stats.driveLongest, km);
    if (driveTripIsNight(t)) stats.driveNight += 1;
    const ahead = driveTripAhead(t);
    if (ahead !== null && ahead >= 1 - DRIVE_TOBASTEN_RATIO) stats.driveTobasten += 1;
    if (ahead !== null && Math.abs(ahead) <= DRIVE_SWISS_MARGIN) stats.driveSwiss += 1;
    return { date: t.date, stats: { ...stats } };
  });
  return { stats, timeline };
}

/* ---------- carango no mapa (v1.67) ----------
 * O que aparece no lugar da bolinha com seta. "need" usa os mesmos números do
 * calcDrivePlayer (e a mesma meta da conquista "achievement" do Perfil), então
 * destrava junto. face: "left" = emoji de lado olhando pra esquerda (vira pro
 * lado que o carro anda); "up" = gira com o rumo; "none" = não gira.
 */
const DRIVE_VEHICLES = [
  { id: "seta", icon: "➤", name: "Seta clássica", face: "arrow" },
  { id: "carro", icon: "🚗", name: "Carrinho", face: "left" },
  { id: "tartaruga", icon: "🐢", name: "Modo Marginal", face: "left" },
  { id: "moto", icon: "🏍️", name: "Motoca", face: "left", achievement: "dv-1", need: (s) => s.driveArrived >= 1 },
  { id: "taxi", icon: "🚕", name: "Táxi", face: "left", achievement: "dv-10", need: (s) => s.driveArrived >= 10 },
  { id: "corujao", icon: "🚓", name: "Viatura", face: "left", achievement: "dv-noite", need: (s) => s.driveNight >= 1 },
  { id: "busao", icon: "🚌", name: "Busão", face: "left", achievement: "dv-km100", need: (s) => s.driveKm >= 100 },
  { id: "picape", icon: "🛻", name: "Picape", face: "left", achievement: "dv-longa", need: (s) => s.driveLongest >= 80 },
  { id: "f1", icon: "🏎️", name: "Max Tobasten", face: "left", achievement: "dv-tobasten", need: (s) => s.driveTobasten >= 1 },
  { id: "foguete", icon: "🚀", name: "Foguete", face: "up", achievement: "dv-km1000", need: (s) => s.driveKm >= 1000 },
  { id: "ovni", icon: "🛸", name: "OVNI", face: "none", achievement: "dv-50", need: (s) => s.driveArrived >= 50 },
];

// Cores da linha da rota (v1.67)
const DRIVE_ROUTE_COLORS = [
  { id: "laranja", color: "#fb923c", name: "Cone" },
  { id: "azul", color: "#3b82f6", name: "Azul" },
  { id: "verde", color: "#22c55e", name: "Verde" },
  { id: "rosa", color: "#ec4899", name: "Rosa" },
  { id: "roxo", color: "#a855f7", name: "Roxo" },
  { id: "ciano", color: "#22d3ee", name: "Neon" },
];

function driveVehicle(id) {
  return DRIVE_VEHICLES.find((v) => v.id === id) || DRIVE_VEHICLES[0];
}

function driveVehicleUnlocked(vehicle, stats) {
  return !vehicle.need || Boolean(stats && vehicle.need(stats));
}

// transform CSS do carango pro rumo (graus, 0 = norte)
function driveVehicleTransform(vehicle, heading) {
  const h = Number.isFinite(heading) ? heading : 0;
  if (vehicle.face === "arrow") return `rotate(${Math.round(h)}deg)`;
  if (vehicle.face === "up") return `rotate(${Math.round(h - 45)}deg)`; // 🚀 já nasce apontando pra 45°
  if (vehicle.face === "left") return h > 0 && h < 180 ? "scaleX(-1)" : "none";
  return "none";
}

// Links de fuga: Google Maps e Waze já navegando até o ponto
function driveGoogleMapsUrl(dest) {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving&dir_action=navigate`;
}

function driveWazeUrl(dest) {
  return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;
}
