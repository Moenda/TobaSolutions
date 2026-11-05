/* =====================================================================
 * Toba Drive · modo dirigir ULTRA (desde v1.68) — carregado depois do drive.js
 * - 🎮 Visual de jogo: navegando, o mapa inclina e gira com o carro (câmera do
 *   Mapbox, nav.map.cam; o truque de CSS do mapa clássico saiu na v1.70). Zoom
 *   pela velocidade já vinha do navTick. Arrastou o mapa = volta pro plano até
 *   o 🎯. Luz do mapa: 🌗 auto = pelo sol.
 * - 🏎️ Velocímetro: velocidade do GPS + placa do limite da via (TomTom,
 *   route.limits). Passou do limite = borda vermelha + Cloba reclama.
 *   v1.70: skins estilo Need for Speed (DRIVE_SPEEDOS), ponteiro/arco pela
 *   escala da skin, troca no 🎨 até no meio da rota.
 * - 🤡 Cloba copiloto: piadinhas (DRIVE_COPILOT_LINES) em momentos de calma,
 *   nunca em cima de manobra, no máximo uma a cada DRIVE_JOKE_GAP_MS.
 * - 📸 Radar: radares do OpenStreetMap na rota (driveFetchRadars) avisados a 400 m.
 * - 👻 Ghost race: corre contra a viagem mais rápida do mesmo trajeto.
 * - 📤 Resumo da viagem: imagem (canvas) com a rota, números e conquistas.
 * - ⛽ Posto perto (OpenStreetMap) e aviso de tanque baixo pelo Toba Racing;
 *   📍 chegou num lugar do Places = botão pra marcar "✅ Fui" lá (o Places grava).
 * Grava só o TOBA_DRIVE_DB (campos novos da viagem, ver CLAUDE.md 3.14).
 * ===================================================================== */
const DRIVE_JOKE_GAP_MS = 4 * 60 * 1000;
const DRIVE_IDLE_JOKE_MS = 7 * 60 * 1000;
const DRIVE_RADAR_WARN_M = 400;
const DRIVE_OVER_TOLERANCE = 1.07; // 7% de folga (velocímetro de carro mente pra cima, GPS não)

const game = {
  on: false,
  radars: [],
  radarIdx: 0,
  ghost: null,
  ghostSaid: "",
  lastJoke: 0,
  lastIdle: 0,
  overSince: 0,
  overSaid: 0,
  aheadSaid: false,
  before: null, // conquistas já destravadas antes da viagem
  heading: 0,
  dark: null,
};

/* ---------- 🎮 visual de jogo ---------- */
function gameViewWanted() {
  return nav.mode === "nav" && nav.follow && readDrivePrefs().gameView;
}

// gira pelo caminho mais curto (359° -> 1° não dá a volta inteira)
// v1.70: rumo do carango grudado na rota (nav.carView), senão o do GPS
function gameFollowHeading() {
  const raw = Number.isFinite(nav.carView?.heading) ? nav.carView.heading : nav.pos?.heading;
  const h = Number.isFinite(raw) ? raw : game.heading;
  let diff = ((h - game.heading + 540) % 360) - 180;
  if (Math.abs(diff) > 120 && (nav.pos?.speed || 0) < 2) diff = 0; // parado, a bússola pula: ignora
  game.heading += diff;
}

// v1.73: botão 3D/2D no mapa. 3D = câmera de jogo (inclina 60° e gira com o rumo,
// carango a 70% da tela); 2D = vista de cima, girando com o rumo, carango a 62%.
function gameApplyView() {
  const box = document.getElementById("driveMap");
  if (!box || !nav.map) return;
  const follow = nav.mode === "nav" && nav.follow;
  const want = gameViewWanted();
  const was = nav.map.cam ? nav.map.cam.pitch : null;
  if (follow) gameFollowHeading();
  nav.map.cam = follow ? { bearing: ((game.heading % 360) + 360) % 360, pitch: want ? DRIVE_GAME_PITCH : 0, padTop: want ? 0.4 : 0.25 } : null;
  document.body.classList.toggle("is-game3d", want);
  render3dBtn();
  if (follow && was !== nav.map.cam.pitch && nav.pos) nav.map.setView(nav.carView ? [nav.carView.lat, nav.carView.lng] : [nav.pos.lat, nav.pos.lng], nav.map.getZoom(), { animate: true });
}

function render3dBtn() {
  const btn = document.getElementById("view3dBtn");
  if (!btn) return;
  const on = readDrivePrefs().gameView;
  btn.textContent = on ? "2D" : "3D"; // mostra pra onde vai
  btn.setAttribute("aria-label", on ? "Ver de cima (2D)" : "Ver inclinado (3D)");
}

function toggle3d() {
  storeDrivePrefs({ gameView: !readDrivePrefs().gameView });
  const box = document.getElementById("prefGame");
  if (box) box.checked = readDrivePrefs().gameView;
  if (!nav.follow && typeof recenter === "function") recenter();
  else gameApplyView();
  render3dBtn();
}

/* ---------- 🌗 luz do mapa ---------- */
// luz do 🌗 (auto = pelo sol)
function gameEffectiveStyle() {
  return driveMapLook(nav.pos ? [nav.pos.lat, nav.pos.lng] : null);
}

function gameSyncStyle() {
  if (!nav.map) return;
  const style = gameEffectiveStyle();
  if (style === game.dark) return;
  game.dark = style;
  nav.map.setLook(style);
}

/* ---------- 🤡 copiloto ---------- */
function gameJoke(kind, vars, { force = false } = {}) {
  if (!readDrivePrefs().copilot) return false;
  if (!force && Date.now() - game.lastJoke < DRIVE_JOKE_GAP_MS) return false;
  const line = driveCopilotLine(kind, vars);
  if (!line) return false;
  game.lastJoke = Date.now();
  driveSpeak(line, { interrupt: false });
  gameBubble(line);
  return true;
}

function gameBubble(text) {
  const el = document.getElementById("clobaBubble");
  if (!el) return;
  el.textContent = `🤡 ${text}`;
  el.hidden = false;
  clearTimeout(game.bubbleTimer);
  game.bubbleTimer = setTimeout(() => {
    el.hidden = true;
  }, 7000);
}

/* ---------- começo / fim ---------- */
function gameStart() {
  game.on = true;
  game.radarToast = false;
  game.radars = [];
  game.radarIdx = 0;
  game.ghostSaid = "";
  game.lastJoke = 0;
  game.lastIdle = Date.now();
  game.overSince = 0;
  game.overSaid = 0;
  game.aheadSaid = false;
  game.dark = null;
  game.speedoArgs = null;
  game.heading = Number.isFinite(nav.pos?.heading) ? nav.pos.heading : 0;
  game.ghost = nav.pos && nav.dest ? driveFindGhost(driveDb, nav.pos, nav.dest) : null;
  try {
    const p = typeof computePlayer === "function" ? computePlayer() : null;
    game.before = p ? new Set(p.achievements.filter((a) => a.unlocked).map((a) => a.id)) : null;
  } catch (err) {
    game.before = null;
  }
  // v1.77: viagem que voltou depois do celular bloquear: mantém começo, máxima e caminho
  if (!nav.trip.resumed || !Array.isArray(nav.trip.path)) {
    nav.trip.startLat = nav.pos.lat;
    nav.trip.startLng = nav.pos.lng;
    nav.trip.maxKmh = 0;
    nav.trip.radars = 0;
    nav.trip.limitS = 0;
    nav.trip.overS = 0;
    nav.trip.path = [[nav.pos.lat, nav.pos.lng]];
  }
  nav.trip.fuelStop = nav.dest?.kind === "fuel";
  nav.trip.placeId = nav.dest?.placeId ? String(nav.dest.placeId) : "";
  gameLoadRadars(nav.route);
  gameSyncStyle();
  gameApplyView();
  renderSpeedo();
  // abertura do copiloto (depois do "Partiu" de sempre)
  if (nav.trip.resumed) return; // voltou do bloqueio: sem a abertura do copiloto de novo
  setTimeout(() => {
    if (nav.mode !== "nav") return;
    const late = Math.round((nav.route?.trafficDelay || 0) / 60);
    if (late >= 5) gameJoke("traffic", { min: late }, { force: true });
    else if (game.ghost) {
      driveSpeak(`Teu fantasma fez esse caminho em ${driveFormatDuration(game.ghost.s).replace("min", "minutos").replace(" h ", " hora e ")}. Bora bater?`, { interrupt: false });
      gameBubble(`👻 Fantasma: ${driveFormatDuration(game.ghost.s)}. Bora bater?`);
      game.lastJoke = Date.now();
    } else gameJoke("start", {}, { force: true });
  }, 9000);
}

function gameStop() {
  game.on = false;
  document.body.classList.remove("is-over");
  gameApplyView();
  game.dark = null;
  gameSyncStyle(); // fora do modo nav: volta pro estilo escolhido
  nav.map?.setRadars?.([]);
  ["clobaBubble", "speedo", "ghostChip"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

// v1.73: radares numa camada própria do mapa (nav.map.setRadars), com a plaquinha do
// limite; não somem mais quando a rota é redesenhada (🎨 cor, trânsito, desvio)
async function gameLoadRadars(route) {
  game.radars = [];
  game.radarIdx = 0;
  nav.map?.setRadars?.([]);
  if (!route) return;
  try {
    const list = await driveFetchRadars(route);
    if (nav.route === route && game.on) {
      game.radars = list;
      nav.map?.setRadars?.(list);
      if (list.length && !game.radarToast) {
        game.radarToast = true;
        tobaToast(`📸 ${list.length} ${list.length === 1 ? "radar" : "radares"} no caminho`);
      }
    }
  } catch (err) {
    /* Overpass fora: segue sem radar */
  }
}

/* ---------- a cada leitura do GPS (chamado pelo navTick) ---------- */
function gameTick(next, left, total) {
  if (!game.on || !nav.trip) return;
  const pos = nav.pos;
  const kmh = Math.round((pos.speed || 0) * 3.6);
  const trip = nav.trip;
  const now = Date.now();
  const dt = trip.lastTick ? Math.min(5, (now - trip.lastTick) / 1000) : 0;
  trip.lastTick = now;
  if (pos.acc <= 40) trip.maxKmh = Math.max(trip.maxKmh, Math.min(kmh, 250));
  const lastP = trip.path[trip.path.length - 1];
  if (!lastP || driveDist(lastP, [pos.lat, pos.lng]) > 25) trip.path.push([pos.lat, pos.lng]);

  // 🏎️ limite e velocímetro
  const limit = driveLimitAt(nav.route, nav.seg);
  const over = Boolean(limit && kmh > limit * DRIVE_OVER_TOLERANCE && pos.acc <= 30);
  if (limit) trip.limitS += dt;
  if (over) trip.overS += dt;
  if (over && !game.overSince) game.overSince = now;
  if (!over) game.overSince = 0;
  document.body.classList.toggle("is-over", over);
  game.speedoArgs = [kmh, limit, over];
  renderSpeedo(kmh, limit, over);
  const calm = !next || next.dist > 600;
  // passou do limite por 4 s seguidos: Cloba reclama (no máximo 1 a cada 90 s)
  if (over && now - game.overSince > 4000 && now - game.overSaid > 90000 && calm && readDrivePrefs().copilot) {
    game.overSaid = now;
    game.lastJoke = now;
    const line = driveCopilotLine("speeding", { limit });
    driveSpeak(line, { interrupt: false });
    gameBubble(line);
  }

  // 📸 radar na frente (avisa a 400 m; passou dentro do limite = conta)
  while (game.radarIdx < game.radars.length && game.radars[game.radarIdx].along < nav.along - 30) {
    const r = game.radars[game.radarIdx];
    if (!r.over) trip.radars += 1;
    game.radarIdx += 1;
  }
  const radar = game.radars[game.radarIdx];
  if (radar) {
    const dist = radar.along - nav.along;
    if (dist < 60 && over) radar.over = true;
    if (dist <= DRIVE_RADAR_WARN_M && !radar.warned) {
      radar.warned = true;
      const lim = radar.limit ? ` Limite de ${radar.limit}.` : "";
      const line = driveCopilotLine("radar", { dist: driveSpokenDist(dist) }) + lim;
      if (readDrivePrefs().copilot) {
        driveSpeak(line, { interrupt: false });
        gameBubble(`📸 ${line}`);
      } else {
        driveSpeak(`Radar em ${driveSpokenDist(dist)}.${lim}`, { interrupt: false });
      }
    }
  }

  // 👻 fantasma e ritmo de MAX TOBASTEN
  const elapsed = (now - trip.startedAt) / 1000;
  const frac = total ? Math.min(1, nav.along / total) : 0;
  renderGhost(elapsed, frac);
  if (game.ghost && frac > 0.15 && calm) {
    const delta = elapsed - game.ghost.s * frac;
    const state = delta < -20 ? "ahead" : delta > 30 ? "behind" : "";
    if (state && state !== game.ghostSaid) {
      game.ghostSaid = state;
      gameJoke(state === "ahead" ? "ghostAhead" : "ghostBehind");
    }
  }
  if (!game.aheadSaid && trip.etaS >= DRIVE_TOBASTEN_MIN_ETA_S && frac > 0.5 && calm) {
    const ahead = 1 - elapsed / (trip.etaS * frac);
    if (ahead >= 1 - DRIVE_TOBASTEN_RATIO) {
      game.aheadSaid = true;
      gameJoke("ahead", { pct: Math.round(ahead * 100) }, { force: true });
    }
  }
  // silêncio grande numa reta: piadinha
  if (calm && next && next.dist > 1500 && now - game.lastIdle > DRIVE_IDLE_JOKE_MS) {
    game.lastIdle = now;
    gameJoke("idle");
  }

  gameSyncStyle();
  gameApplyView();
}

function renderSpeedo(kmh = 0, limit = null, over = false) {
  const box = document.getElementById("speedo");
  if (!box) return;
  box.hidden = nav.mode !== "nav";
  const skin = currentSpeedo();
  if (box.dataset.skin !== skin.id) {
    box.className = box.className.replace(/\bdv-sp-\S+/g, "").trim();
    box.classList.add(`dv-sp-${skin.id}`);
    box.dataset.skin = skin.id;
  }
  box.classList.toggle("is-over", over);
  // arco/ponteiro: 0 a 1 na escala da skin
  box.style.setProperty("--p", String(Math.max(0, Math.min(1, kmh / (skin.max || 160)))));
  document.getElementById("speedoValue").textContent = String(kmh);
  const sign = document.getElementById("speedoLimit");
  sign.hidden = !limit;
  if (limit) sign.textContent = String(limit);
}

function renderGhost(elapsed, frac) {
  const el = document.getElementById("ghostChip");
  if (!el) return;
  if (!game.ghost || nav.mode !== "nav") {
    el.hidden = true;
    return;
  }
  const delta = Math.round(elapsed - game.ghost.s * frac);
  const abs = Math.abs(delta);
  const txt = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  el.hidden = false;
  el.classList.toggle("is-ahead", delta <= 0);
  el.innerHTML = `👻 ${delta <= 0 ? "−" : "+"}${txt}<small>${delta <= 0 ? "na frente" : "atrás"}</small>`;
}

// Junta os números da viagem que vão pro TOBA_DRIVE_DB (finishTrip)
function gameTripExtras(arrived, seconds) {
  const t = nav.trip;
  if (!t || !game.on) return {};
  const extras = {
    startLat: Math.round(t.startLat * 1e6) / 1e6,
    startLng: Math.round(t.startLng * 1e6) / 1e6,
    maxKmh: Math.round(t.maxKmh || 0),
    radars: t.radars || 0,
    cleanSpeed: t.limitS >= seconds * 0.5 && t.overS < 3,
  };
  if (t.fuelStop) extras.fuelStop = true;
  if (t.placeId) extras.placeId = t.placeId;
  if (arrived && game.ghost) extras.ghostWin = seconds < game.ghost.s;
  return extras;
}

// Depois de gravar a viagem: o que destravou nessa viagem (pro resumo)
function gameNewAchievements() {
  try {
    if (!game.before || typeof computePlayer !== "function") return [];
    return computePlayer().achievements.filter((a) => a.unlocked && !game.before.has(a.id));
  } catch (err) {
    return [];
  }
}

/* ---------- fim da viagem: linhas extras do card ---------- */
function gameDoneExtra(r) {
  const bits = [];
  if (r.avgKmh) bits.push(`<div class="toba-stat"><span class="toba-stat-label">⚡ Média</span><span class="toba-stat-value">${r.avgKmh} <small>km/h</small></span></div>`);
  if (r.maxKmh) bits.push(`<div class="toba-stat"><span class="toba-stat-label">🏎️ Máxima</span><span class="toba-stat-value">${r.maxKmh} <small>km/h</small></span></div>`);
  let html = bits.length ? `<div class="toba-stats dv-stats">${bits.join("")}</div>` : "";
  if (r.ghost) {
    const diff = Math.round(Math.abs(r.s - r.ghost.s));
    html += r.s < r.ghost.s
      ? `<div class="dv-ghost-line is-win">👻 Fantasma derrotado por ${driveFormatDuration(diff)}! Novo recorde.</div>`
      : `<div class="dv-ghost-line">👻 O fantasma ganhou por ${driveFormatDuration(diff)}. Revanche amanhã?</div>`;
  }
  if (r.unlocked?.length) {
    html += `<div class="dv-unlocked">${r.unlocked.map((a) => `<span class="dv-unlocked-chip">${a.icon} ${escapeHtml(a.name)}</span>`).join("")}</div>`;
  }
  if (r.arrived && r.placeWant) {
    html += `<button type="button" class="btn btn-outline dv-full dv-places-btn" data-click="markPlaceVisited">✅ Marcar "Fui" no Toba Places</button>`;
  }
  return html;
}

function markPlaceVisited() {
  const id = nav.result?.placeId;
  if (!id) return;
  window.location.href = `../../TobaTurism/TobaTurism-Places.html?fui=${encodeURIComponent(id)}`;
}

function readPlaceStatus(id) {
  const t = readTurismForDrive();
  const p = t.places.find((x) => String(x.id) === String(id));
  return p ? p.status : "";
}

/* ---------- 📤 resumo da viagem (imagem pra mandar pra tropa) ---------- */
function drawTripCard(r) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d1117");
  bg.addColorStop(1, "#1f1208");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fb923c";
  g.font = "900 56px system-ui, sans-serif";
  g.fillText("🏁 TOBA RACING · NAVEGAR", 60, 110);
  g.fillStyle = "#e6edf3";
  g.font = "800 64px system-ui, sans-serif";
  const name = String(nav.dest?.name || "Destino").slice(0, 26);
  g.fillText(name, 60, 200);
  g.fillStyle = "#8b949e";
  g.font = "500 34px system-ui, sans-serif";
  g.fillText(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }), 60, 252);

  // rota (o caminho feito pelo GPS; sem ele, a linha da rota)
  const pts = (r.path && r.path.length > 1 ? r.path : nav.route?.coords) || [];
  const box = { x: 60, y: 300, w: W - 120, h: 560 };
  g.fillStyle = "rgba(255,255,255,0.04)";
  g.fillRect(box.x, box.y, box.w, box.h);
  if (pts.length > 1) {
    let s = 90;
    let n = -90;
    let w = 180;
    let e = -180;
    pts.forEach(([la, ln]) => {
      s = Math.min(s, la);
      n = Math.max(n, la);
      w = Math.min(w, ln);
      e = Math.max(e, ln);
    });
    const kx = Math.cos(((s + n) / 2) * Math.PI / 180);
    const spanX = Math.max(1e-6, (e - w) * kx);
    const spanY = Math.max(1e-6, n - s);
    const scale = Math.min((box.w - 80) / spanX, (box.h - 80) / spanY);
    const ox = box.x + (box.w - spanX * scale) / 2;
    const oy = box.y + (box.h - spanY * scale) / 2;
    const xy = ([la, ln]) => [ox + (ln - w) * kx * scale, oy + (n - la) * scale];
    g.lineCap = "round";
    g.lineJoin = "round";
    [["rgba(251,146,60,0.25)", 26], [currentRouteColor(), 12]].forEach(([color, width]) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(...xy(p)) : g.moveTo(...xy(p))));
      g.stroke();
    });
    g.font = "60px system-ui, sans-serif";
    const [sx, sy] = xy(pts[0]);
    const [ex, ey] = xy(pts[pts.length - 1]);
    g.fillText(currentVehicle().icon === "➤" ? "🚗" : currentVehicle().icon, sx - 30, sy + 20);
    g.fillText("🏁", ex - 10, ey + 10);
  }

  // números
  const tiles = [
    ["🛣️ Distância", `${driveFormatKm(r.m || 0)} km`],
    ["⏱️ Tempo", driveFormatDuration(r.s || 0)],
    ["⚡ Média", r.avgKmh ? `${r.avgKmh} km/h` : "--"],
    ["🏎️ Máxima", r.maxKmh ? `${r.maxKmh} km/h` : "--"],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 60 + (i % 2) * 490;
    const y = 900 + Math.floor(i / 2) * 150;
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fillRect(x, y, 470, 130);
    g.fillStyle = "#8b949e";
    g.font = "600 30px system-ui, sans-serif";
    g.fillText(label, x + 24, y + 46);
    g.fillStyle = "#e6edf3";
    g.font = "900 52px system-ui, sans-serif";
    g.fillText(value, x + 24, y + 108);
  });
  let y = 1238;
  g.font = "900 40px system-ui, sans-serif";
  if (r.ahead !== null && r.ahead !== undefined && r.ahead >= 1 - DRIVE_TOBASTEN_RATIO) {
    g.fillStyle = "#facc15";
    g.fillText(`⚡ DANDANDAN MAX TOBASTEN! ${Math.round(r.ahead * 100)}% antes`, 60, y);
    y += 56;
  } else if (r.ghost && r.s < r.ghost.s) {
    g.fillStyle = "#22c55e";
    g.fillText("👻 Fantasma derrotado!", 60, y);
    y += 56;
  } else if (r.unlocked?.length) {
    g.fillStyle = "#facc15";
    g.fillText(`🏆 ${r.unlocked[0].name}`, 60, y);
    y += 56;
  }
  g.fillStyle = "#8b949e";
  g.font = "italic 500 32px system-ui, sans-serif";
  g.fillText("Nunca foi sorte, Cloba. Nunca foi sorte. 🙏", 60, Math.max(y, 1300));
  return c;
}

async function shareTrip() {
  const r = nav.result;
  if (!r) return;
  const canvas = drawTripCard(r);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const text = `🏁 ${nav.dest?.name || "Destino"}: ${driveFormatKm(r.m || 0)} km em ${driveFormatDuration(r.s || 0)}${r.avgKmh ? ` (${r.avgKmh} km/h de média)` : ""}. Toba Racing 🧭`;
  let sent = false;
  try {
    const file = blob ? new File([blob], "toba-viagem.png", { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      sent = true;
    } else if (blob) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "toba-viagem.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      tobaToast("📥 Imagem baixada: manda no grupo da tropa!");
      sent = true;
    }
  } catch (err) {
    sent = false; // cancelou o compartilhar
  }
  if (sent && r.tripId) {
    const trip = driveDb.trips.find((t) => t.id === r.tripId);
    if (trip && !trip.shared) {
      trip.shared = true;
      saveDriveDb({ silent: true });
      if (typeof tobaPlayerCheck === "function") tobaPlayerCheck({ reason: "drive" });
    }
  }
}

/* ---------- ⛽ posto perto + aviso de tanque baixo ---------- */
function readFuelEstimate() {
  try {
    const racing = JSON.parse(localStorage.getItem("TOBA_RACING_DB") || "null");
    return driveFuelEstimate(racing, driveDb, typeof calcRacingSummary === "function" ? calcRacingSummary : null);
  } catch (err) {
    return null;
  }
}

function renderFuelBanner() {
  const box = document.getElementById("fuelBanner");
  if (!box) return;
  const est = readFuelEstimate();
  box.hidden = !(est && est.low);
  if (est && est.low) {
    box.innerHTML = `<span class="dv-fuel-icon">⛽</span><span class="dv-fuel-text"><b>Tanque na reserva?</b><small>Pelo Combustível sobram uns ${Math.round(est.left)} km (chute: só conta o que tu navegou).</small></span><button type="button" class="btn btn-primary btn-sm" data-click="findFuel">Posto</button>`;
  }
}

async function findFuel() {
  const box = document.getElementById("searchResults");
  startGps();
  box.innerHTML = `<div class="dv-hint">⛽ Procurando posto perto...</div>`;
  const pos = await waitForFix();
  if (!pos) {
    box.innerHTML = tobaEmpty("📡", "Sem GPS", "Preciso saber onde tu tá pra achar posto.", { compact: true });
    return;
  }
  try {
    const rows = await driveFetchFuel(pos);
    nav.results = rows;
    box.innerHTML = rows.length
      ? `<div class="section-title">⛽ Postos perto</div><div class="toba-list dv-results">${rows.map((r, i) => `
        <div class="toba-list-item" role="button" tabindex="0" data-click="goResult" data-index="${i}">
          <span class="dv-item-text"><b>${escapeHtml(r.name)}</b>${r.address ? `<small>${escapeHtml(r.address)}</small>` : ""}</span>
          <span class="dv-item-km">${kmFromHere(r)}</span>
        </div>`).join("")}</div>`
      : tobaEmpty("🏜️", "Nenhum posto a 4 km", "Tenta buscar pelo nome do posto.", { compact: true });
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    box.innerHTML = tobaEmpty("😵", "A busca de posto não respondeu", "Tenta de novo em uns segundos.", { compact: true });
  }
}

tobaActions({ shareTrip, findFuel, markPlaceVisited, toggle3d });

// drive.js abre antes deste arquivo: a primeira tela não viu o banner, mostra agora
if (typeof nav !== "undefined" && nav.mode === "pick") renderFuelBanner();
