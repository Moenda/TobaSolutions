/*
 * Toba Health · 🩻 Raio-X · 🕐 Hora a hora + 😤 Tensão do Cloba + 🌬️ Respirar 1 min (v2.04)
 *
 * Pedido do Rafa (2026-11-09): "se vc fosse um humano tentando melhorar, não querendo tomar a
 * canetada do ozempic, querendo uma vida melhor, O QUE VC ADICIONARIA? O MELHOR DE TODA ANÁLISE".
 *
 * O APK 2.9 manda o dia em 24 horas (HealthReader.hourly, últimos 35 dias):
 *   watch.days[dia].hk = [24 kcal ativas] · hs = [24 passos] · hh = [24 FC média, 0 = sem medida]
 * Guardado só dos últimos WX_HOURLY_KEEP_DAYS dias (o resto é podado, pra não pesar no localStorage).
 *
 * 😤 Tensão do Cloba: o Samsung NÃO manda o stress pro Health Connect (nem pelo SDK do Samsung),
 * e o Rafa não quer ficar importando. Então o Cloba estima pelo batimento: hora PARADO (menos de
 * WX_STILL_STEPS passos), acordado e longe de treino, com o coração acima do teu repouso = tensão.
 *   tensão da hora = (FC da hora − FC de repouso do dia) × 4, de 0 a 100, × o ajuste com o Samsung
 *   (dias que têm os dois: a média da tensão vira a média do stress do Samsung).
 * Vira o stress do dia (stress/stressMax/stressPeak/stressHigh + stressSrc: "hr") só em dia SEM o
 * stress do Samsung; o 📥 import do Samsung passa por cima (relogio-samsung.js).
 *
 * 🌬️ Respirar 1 min: 6 respirações de 10 s (4 puxa, 6 solta). Inteira (50 s+) grava em
 * watch.breaths = [{ at: ms, s: segundos }] (até 1.000) e conta pros troféus rs-* do perfil.
 */

const WX_HOURLY_KEEP_DAYS = 60;
const WX_STILL_STEPS = 300;  // passos na hora: acima disso tava andando (o coração sobe por movimento)
const WX_HOURS_FROM = 6;     // mapa de horas: das 6h às 23h (madrugada só tem sono)
const WX_BREATH_CYCLES = 6;
const WX_BREATH_IN = 4000;
const WX_BREATH_OUT = 6000;
const WX_WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WX_WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function wxArr(a) {
  return Array.isArray(a) && a.length === 24 ? a.map((v) => Math.max(0, Math.round(Number(v) || 0))) : null;
}

function wxHasHours(d) {
  return Boolean(d && (Array.isArray(d.hk) || Array.isArray(d.hh)));
}

function wxAnyHours() {
  return Object.values(watchDays()).some((d) => wxHasHours(d));
}

// O que veio do APK -> watch.days (só dia que já existe). Devolve true se mudou algo.
function wxStoreHourly(hourly) {
  const w = watchDb();
  let changed = false;
  Object.keys(hourly || {}).forEach((date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const d = w.days[date];
    const src = hourly[date];
    if (!d || typeof d !== "object" || !src || typeof src !== "object") return;
    [["k", "hk"], ["s", "hs"], ["h", "hh"]].forEach(([a, b]) => {
      const arr = wxArr(src[a]);
      if (arr && JSON.stringify(arr) !== JSON.stringify(d[b])) {
        d[b] = arr;
        changed = true;
      }
    });
  });
  const min = watchAddDays(toIsoDate(), -WX_HOURLY_KEEP_DAYS);
  Object.keys(w.days).forEach((date) => {
    const d = w.days[date];
    if (date >= min || !d || typeof d !== "object") return;
    ["hk", "hs", "hh"].forEach((f) => {
      if (d[f] !== undefined) {
        delete d[f];
        changed = true;
      }
    });
  });
  if (wxDeriveStress()) changed = true;
  return changed;
}

/* ---------------- 😤 Tensão do Cloba ---------------- */

function wxHourStart(date, h) {
  return new Date(`${date}T${String(h).padStart(2, "0")}:00:00`).getTime();
}

// Janelas em que não dá pra medir tensão: dormindo (a noite que acaba no dia, os cochilos e a
// noite que começa no fim do dia, que é do dia seguinte) e treino (até 1 h depois de acabar).
function wxBlocked(date) {
  const out = [];
  const add = (a, b) => {
    a = Number(a);
    b = Number(b);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) out.push([a, b]);
  };
  const d = watchDay(date) || {};
  const next = watchDay(watchAddDays(date, 1)) || {};
  [d.sleep, next.sleep].forEach((s) => {
    if (!s) return;
    add(s.start, s.end);
    (Array.isArray(s.naps) ? s.naps : []).forEach((n) => add(n && n.start, n && n.end));
  });
  (Array.isArray(d.ex) ? d.ex : []).forEach((x) => x && add(x.start, Number(x.end) + 3600000));
  return out;
}

// FC de repouso do dia: a do relógio; sem ela, a menor do dia + 6; sem nada, a média dos 30 dias antes.
function wxRest(date) {
  const d = watchDay(date) || {};
  if (Number(d.restHr) > 30) return Number(d.restHr);
  if (Number(d.hrMin) > 30) return Number(d.hrMin) + 6;
  const base = watchAvgBefore("restHr", date, 30);
  return base && base > 30 ? base : null;
}

// Tensão "crua" de cada hora (antes do ajuste com o Samsung): null = não deu pra medir
function wxRawHours(date) {
  const d = watchDay(date);
  if (!d || !Array.isArray(d.hh)) return null;
  const rest = wxRest(date);
  if (!rest) return null;
  const blocked = wxBlocked(date);
  return d.hh.map((hr, h) => {
    if (!(hr > 30)) return null;
    if (Array.isArray(d.hs) && Number(d.hs[h]) > WX_STILL_STEPS) return null;
    const a = wxHourStart(date, h), b = a + 3600000;
    if (blocked.some(([x, y]) => Math.min(b, y) - Math.max(a, x) > 20 * 60000)) return null;
    return Math.max(0, Math.min(100, (hr - rest) * 4));
  });
}

function wxAvg(a) {
  const v = a.filter((x) => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

// Ajuste com o Samsung: dias com o stress do Samsung (import) E batimento por hora
let wxCalibCache = null;
function wxCalib() {
  if (wxCalibCache !== null) return wxCalibCache;
  const pairs = [];
  Object.keys(watchDays()).forEach((date) => {
    const d = watchDay(date);
    if (!d || d.stressSrc === "hr" || !(Number(d.stress) > 0) || !Array.isArray(d.hh)) return;
    const raw = wxRawHours(date);
    const vals = raw ? raw.filter((x) => x !== null) : [];
    if (vals.length >= 4) pairs.push([Number(d.stress), wxAvg(vals)]);
  });
  let f = 1;
  if (pairs.length >= 5) {
    const ms = wxAvg(pairs.map((p) => p[0])), mr = wxAvg(pairs.map((p) => p[1]));
    if (mr > 0) f = Math.max(0.5, Math.min(2, ms / mr));
  }
  wxCalibCache = { f, n: pairs.length };
  return wxCalibCache;
}

// Tensão de cada hora (0-100, já ajustada) ou null
function wxTensionHours(date) {
  const raw = wxRawHours(date);
  if (!raw) return null;
  const f = wxCalib().f;
  return raw.map((v) => (v === null ? null : Math.round(Math.min(100, v * f))));
}

// Escreve o stress do dia pela tensão (só onde não tem o do Samsung). true = mudou algo.
function wxDeriveStress() {
  wxCalibCache = null;
  const w = watchDb();
  let changed = false;
  Object.keys(w.days).forEach((date) => {
    const d = w.days[date];
    if (!d || typeof d !== "object" || !Array.isArray(d.hh)) return;
    if (d.stress !== undefined && d.stress !== null && d.stressSrc !== "hr") return; // Samsung manda
    const t = wxTensionHours(date);
    const vals = t ? t.map((v, h) => ({ v, h })).filter((x) => x.v !== null) : [];
    const before = JSON.stringify([d.stress, d.stressMax, d.stressPeak, d.stressHigh, d.stressSrc]);
    if (vals.length >= 4) {
      const top = vals.reduce((a, x) => (x.v > a.v ? x : a), vals[0]);
      Object.assign(d, {
        stress: Math.round(wxAvg(vals.map((x) => x.v))), stressMax: top.v, stressPeak: top.h,
        stressHigh: vals.filter((x) => x.v >= 70).length, stressSrc: "hr",
      });
    } else if (d.stressSrc === "hr") {
      ["stress", "stressMax", "stressPeak", "stressHigh", "stressSrc"].forEach((f) => delete d[f]);
    }
    if (JSON.stringify([d.stress, d.stressMax, d.stressPeak, d.stressHigh, d.stressSrc]) !== before) changed = true;
  });
  return changed;
}

/* ---------------- 🚗 Toba Drive: horas no carro ---------------- */

let wxTripsCache = null;
function wxTrips() {
  if (wxTripsCache) return wxTripsCache;
  let list = [];
  try {
    const db = JSON.parse(localStorage.getItem("TOBA_DRIVE_DB") || "null");
    list = db && Array.isArray(db.trips) ? db.trips : [];
  } catch (e) {
    list = [];
  }
  wxTripsCache = list
    .filter((t) => t && Number(t.endedAt) > Number(t.startedAt) && !t.sim)
    .map((t) => ({ a: Number(t.startedAt), b: Number(t.endedAt), name: String(t.name || "Viagem"), km: Number(t.km) || 0, date: t.date }));
  return wxTripsCache;
}

// Fração de cada hora do dia dirigindo (0 a 1)
function wxDriveHours(date) {
  const out = Array(24).fill(0);
  const d0 = wxHourStart(date, 0);
  wxTrips().forEach((t) => {
    if (t.b < d0 || t.a > d0 + 86400000) return;
    for (let h = 0; h < 24; h++) {
      const a = d0 + h * 3600000, b = a + 3600000;
      const o = Math.min(b, t.b) - Math.max(a, t.a);
      if (o > 0) out[h] = Math.min(1, out[h] + o / 3600000);
    }
  });
  return out;
}

/* ---------------- 📊 Desenhos ---------------- */

// Normal de cada hora: média das mesmas horas nos `days` dias antes (só hora com valor)
function wxHourNormal(valuesOf, date, days = 28) {
  const sum = Array(24).fill(0), cnt = Array(24).fill(0);
  for (let i = 1; i <= days; i++) {
    const vals = valuesOf(watchAddDays(date, -i));
    if (!vals) continue;
    vals.forEach((v, h) => {
      if (v === null || v === undefined || !Number.isFinite(Number(v))) return;
      sum[h] += Number(v);
      cnt[h]++;
    });
  }
  return sum.map((s, h) => (cnt[h] >= 3 ? s / cnt[h] : null));
}

// Barras das horas do dia + linha tracejada do teu normal. Toque = número da hora no letreiro.
function wxHourBars(vals, normal, opts = {}) {
  const from = opts.from ?? WX_HOURS_FROM, to = 23;
  const n = to - from + 1;
  const W = 340, H = 130, top = 14, bot = 18;
  const all = [...vals.slice(from), ...(normal || []).slice(from)].filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  if (!all.length) return "";
  const max = Math.max(...all, opts.min || 1) * 1.1;
  const slot = W / n, bw = slot * 0.66;
  const y = (v) => top + (H - top - bot) * (1 - v / max);
  const fmt = opts.fmt || ((v) => watchInt(v));
  const nowH = opts.nowHour;
  let bars = "", pts = [];
  for (let h = from; h <= to; h++) {
    const i = h - from;
    const x = i * slot;
    const v = vals[h];
    const nv = normal ? normal[h] : null;
    const future = nowH !== undefined && h > nowH;
    const cls = typeof opts.cls === "function" ? opts.cls(v, h) : "";
    if (v !== null && v !== undefined && !future) {
      bars += `<rect class="wx-bar ${cls}" x="${(x + (slot - bw) / 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, H - bot - y(v)).toFixed(1)}" rx="2" style="fill:${opts.color || "var(--coral)"}" />`;
    }
    if (nv !== null && nv !== undefined) pts.push(`${(x + slot / 2).toFixed(1)},${y(nv).toFixed(1)}`);
    if (h % 3 === 0) bars += `<text x="${(x + slot / 2).toFixed(1)}" y="${H - 4}" class="wsl-axis${h === nowH ? " is-hi" : ""}" text-anchor="middle">${h}h</text>`;
    const tip = `${h}h às ${h + 1}h · ${future ? "ainda não chegou" : v === null || v === undefined ? (opts.emptyTip || "sem medida") : fmt(v)}${nv !== null && nv !== undefined ? ` · teu normal ${fmt(nv)}` : ""}`;
    bars += `<rect class="watch-chart-hit" x="${x.toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-click="wxTipTap" data-tip="${escapeHtml(tip)}" />`;
  }
  const line = pts.length > 1 ? `<polyline points="${pts.join(" ")}" class="wx-normal" />` : "";
  return `<div class="wx-tipwrap">
    <div class="watch-chart-tip is-hint" aria-live="polite">👆 Toca numa hora pra ver o número</div>
    <svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.label || "Hora a hora")}">${bars}${line}</svg>
  </div>`;
}

// Mapa de calor: dia da semana (seg-dom) x hora, média das últimas `weeks` semanas.
function wxHeatmap(valuesOf, date, opts = {}) {
  const weeks = opts.weeks || 8;
  const from = opts.from ?? WX_HOURS_FROM;
  const sum = Array.from({ length: 7 }, () => Array(24).fill(0));
  const cnt = Array.from({ length: 7 }, () => Array(24).fill(0));
  let days = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const dd = watchAddDays(date, -i);
    if (dd === toIsoDate() && !opts.today) continue;
    const vals = valuesOf(dd);
    if (!vals) continue;
    days++;
    const wd = new Date(`${dd}T12:00:00`).getDay();
    vals.forEach((v, h) => {
      if (v === null || v === undefined || !Number.isFinite(Number(v))) return;
      sum[wd][h] += Number(v);
      cnt[wd][h]++;
    });
  }
  if (days < 7) return "";
  const avg = sum.map((row, wd) => row.map((s, h) => (cnt[wd][h] ? s / cnt[wd][h] : null)));
  const flat = avg.flat().filter((v) => v !== null);
  if (!flat.length) return "";
  const max = Math.max(...flat, opts.min || 1);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const cols = 24 - from;
  const W = 340, lw = 28, top = 4, ch = 17, cw = (W - lw) / cols;
  const H = top + ch * 7 + 16;
  const fmt = opts.fmt || ((v) => watchInt(v));
  let cells = "";
  order.forEach((wd, r) => {
    cells += `<text x="0" y="${(top + r * ch + ch * 0.7).toFixed(1)}" class="wsl-axis">${WX_WEEKDAYS[wd]}</text>`;
    for (let h = from; h < 24; h++) {
      const v = avg[wd][h];
      const x = lw + (h - from) * cw;
      const a = v === null ? 0 : Math.max(0.07, Math.min(1, v / max));
      const tip = `${WX_WEEKDAYS_LONG[wd]} ${h}h · ${v === null ? "sem medida" : `${opts.prefix || ""}${fmt(v)}`}`;
      cells += `<rect x="${(x + 0.6).toFixed(1)}" y="${(top + r * ch + 0.6).toFixed(1)}" width="${(cw - 1.2).toFixed(1)}" height="${(ch - 1.2).toFixed(1)}" rx="2" class="wx-cell${v === null ? " is-empty" : ""}" style="${v === null ? "" : `fill:${opts.color || "var(--coral)"};fill-opacity:${a.toFixed(2)}`}" data-click="wxTipTap" data-tip="${escapeHtml(tip)}" />`;
    }
  });
  for (let h = from; h < 24; h += 3) cells += `<text x="${(lw + (h - from) * cw + cw / 2).toFixed(1)}" y="${H - 3}" class="wsl-axis" text-anchor="middle">${h}h</text>`;
  // a hora mais forte de cada dia da semana
  let best = null;
  order.forEach((wd) => avg[wd].forEach((v, h) => { if (h >= from && v !== null && (!best || v > best.v)) best = { v, wd, h }; }));
  return { svg: `<div class="wx-tipwrap">
    <div class="watch-chart-tip is-hint" aria-live="polite">👆 Toca num quadradinho</div>
    <svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.label || "Mapa de horas")}">${cells}</svg>
  </div>`, best, days, avg };
}

function wxTipTap(el) {
  const wrap = el.closest(".wx-tipwrap");
  if (!wrap) return;
  wrap.querySelectorAll(".is-sel").forEach((x) => x.classList.remove("is-sel"));
  el.classList.add("is-sel");
  const tip = wrap.querySelector(".watch-chart-tip");
  if (!tip) return;
  tip.classList.remove("is-hint");
  tip.textContent = el.dataset.tip || "";
}

// Barras simples por dia da semana (seg-dom), com o dia escolhido aceso
function wxWeekdayBars(avgs, selWd, opts = {}) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const vals = avgs.filter((v) => v !== null);
  if (vals.length < 5) return "";
  const W = 340, H = 130, top = 16, bot = 18, padX = 4;
  const max = Math.max(...vals, opts.goal || 0) * 1.1;
  const bw = (W - padX * 2) / 7;
  const y = (v) => top + (H - top - bot) * (1 - v / max);
  const fmt = opts.fmt || ((v) => watchInt(v));
  const bars = order.map((i, k) => {
    const v = avgs[i];
    const x = padX + k * bw;
    const lbl = `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" class="wsl-axis${i === selWd ? " is-hi" : ""}" text-anchor="middle">${WX_WEEKDAYS[i]}</text>`;
    if (v === null) return lbl;
    return `<rect x="${(x + bw * 0.18).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(H - bot - y(v)).toFixed(1)}" rx="4" class="wx-wd-bar${i === selWd ? " is-sel" : ""}" style="fill:${opts.color || "var(--coral)"}" />
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" class="wsl-lvl" text-anchor="middle">${escapeHtml(fmt(v))}</text>${lbl}`;
  }).join("");
  const goal = opts.goal ? `<line x1="${padX}" x2="${W - padX}" y1="${y(opts.goal).toFixed(1)}" y2="${y(opts.goal).toFixed(1)}" class="wps-goal-line" />` : "";
  return `<svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.label || "Por dia da semana")}">${goal}${bars}</svg>`;
}

// Média por dia da semana de `get(date)` nos últimos `days` dias (dia de hoje fora)
function wxWeekdayAvgs(get, date, days = 84) {
  const sums = Array(7).fill(0), cnt = Array(7).fill(0);
  for (let i = 0; i < days; i++) {
    const dd = watchAddDays(date, -i);
    if (dd === toIsoDate()) continue;
    const v = get(dd);
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const wd = new Date(`${dd}T12:00:00`).getDay();
    sums[wd] += v;
    cnt[wd]++;
  }
  return sums.map((s, i) => (cnt[i] >= 2 ? s / cnt[i] : null));
}

// "Com x sem" (O que mexe): rows = [{ v, ...flags }], tests = [{ k, yes, no }]
function wxMoves(rows, tests, minDiff, minPct) {
  const list = [];
  tests.forEach((t) => {
    const a = rows.filter((r) => r[t.k] === true), b = rows.filter((r) => r[t.k] === false);
    if (a.length < 4 || b.length < 4) return;
    const va = wxAvg(a.map((r) => r.v)), vb = wxAvg(b.map((r) => r.v));
    const diff = va - vb;
    if (Math.abs(diff) < minDiff && (!vb || Math.abs(diff / vb) < minPct)) return;
    list.push({ ...t, diff, pct: vb ? (diff / vb) * 100 : 0, va, vb, na: a.length, nb: b.length });
  });
  list.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
  return list;
}

function wxMovesHtml(title, help, rows, list, opts) {
  const head = `<div class="section-title wsl-title">${title} ${wslQ(help)}${rows.length >= 14 ? `<span class="watch-muted wsl-title-sub">· ${rows.length} dias</span>` : ""}</div>`;
  if (rows.length < 14) return `${head}<div class="card"><p class="watch-muted">🕵️ O Cloba tá juntando pista: com 14 dias ou mais ele começa a contar ${escapeHtml(opts.what)}.</p></div>`;
  const body = list.length ? list.map((x) => {
    const good = opts.better === "down" ? x.diff <= 0 : x.diff >= 0;
    return `<div class="wsl-move ${good ? "is-good" : "is-bad"}">
      <div class="wsl-move-head"><span>${escapeHtml(x.yes)}</span><b>${x.diff >= 0 ? "+" : "−"}${escapeHtml(opts.fmt(Math.abs(x.diff)))}</b></div>
      <small>${escapeHtml(opts.fmt(x.va))} (${x.na} dias) x ${escapeHtml(opts.fmt(x.vb))} ${escapeHtml(x.no)} (${x.nb})${x.vb ? ` · ${x.diff >= 0 ? "+" : "−"}${Math.abs(Math.round(x.pct))}%` : ""}</small>
    </div>`;
  }).join("") : `<p class="watch-muted">${escapeHtml(opts.none)}</p>`;
  return `${head}<div class="card">${body}</div>`;
}

function wxMoved(date) {
  const d = watchDay(date) || {};
  const ex = Array.isArray(d.ex) ? d.ex : [];
  if (ex.some((x) => x && Number(x.end) - Number(x.start) >= 15 * 60000)) return true;
  return (Array.isArray(healthDb.workouts) ? healthDb.workouts : []).some((x) => x && x.date === date);
}

/* ---------------- 🌬️ Respirar 1 min ---------------- */

const wxBreath = { timer: null, t0: 0, raf: 0 };

function wxBreaths() {
  const w = watchDb();
  return Array.isArray(w.breaths) ? w.breaths.filter((b) => b && Number(b.s) >= 50) : [];
}

function wxBreathOpen() {
  const body = document.getElementById("wxBreathBody");
  if (!body) return;
  wxBreathStop(true);
  body.innerHTML = `<div class="wx-breath">
      <div class="wx-breath-ring" id="wxBreathRing"><span id="wxBreathWord">Bora?</span></div>
      <p class="wx-breath-sub" id="wxBreathSub">6 respirações: 4 segundos puxando pelo nariz, 6 soltando devagar pela boca. Ombro solto, celular na mão, mais nada.</p>
      <div class="wx-breath-bar"><i id="wxBreathFill"></i></div>
    </div>`;
  const go = document.getElementById("wxBreathGo");
  if (go) {
    go.hidden = false;
    go.textContent = "▶ Começar";
  }
  openTobaModal("wxBreathModal");
}

function wxBreathStart() {
  const ring = document.getElementById("wxBreathRing");
  if (!ring) return;
  const go = document.getElementById("wxBreathGo");
  if (go) go.hidden = true;
  wxBreath.t0 = Date.now();
  const cycle = WX_BREATH_IN + WX_BREATH_OUT;
  const total = cycle * WX_BREATH_CYCLES;
  let lastPhase = "";
  const tick = () => {
    const t = Date.now() - wxBreath.t0;
    const fill = document.getElementById("wxBreathFill");
    if (fill) fill.style.width = `${Math.min(100, (t / total) * 100).toFixed(1)}%`;
    if (t >= total) {
      wxBreathDone(Math.round(t / 1000));
      return;
    }
    const inCycle = t % cycle;
    const n = Math.floor(t / cycle) + 1;
    const phase = inCycle < WX_BREATH_IN ? "in" : "out";
    if (phase !== lastPhase) {
      lastPhase = phase;
      ring.classList.toggle("is-in", phase === "in");
      ring.classList.toggle("is-out", phase === "out");
      ring.style.transitionDuration = `${phase === "in" ? WX_BREATH_IN : WX_BREATH_OUT}ms`;
      const word = document.getElementById("wxBreathWord");
      if (word) word.textContent = phase === "in" ? "Puxa…" : "Solta…";
      const sub = document.getElementById("wxBreathSub");
      if (sub) sub.textContent = `${n} de ${WX_BREATH_CYCLES} · ${phase === "in" ? "enche a barriga, não o peito" : "devagarinho, igual vela que não pode apagar"}`;
      try { if (navigator.vibrate) navigator.vibrate(phase === "in" ? 25 : [15, 60, 15]); } catch (e) { /* sem vibrar */ }
    }
    wxBreath.raf = requestAnimationFrame(tick);
  };
  wxBreath.raf = requestAnimationFrame(tick);
}

function wxBreathStop(silent) {
  if (wxBreath.raf) cancelAnimationFrame(wxBreath.raf);
  wxBreath.raf = 0;
  if (!silent && wxBreath.t0) {
    const s = Math.round((Date.now() - wxBreath.t0) / 1000);
    if (s >= 50) wxBreathDone(s);
  }
  wxBreath.t0 = 0;
}

function wxBreathDone(s) {
  if (wxBreath.raf) cancelAnimationFrame(wxBreath.raf);
  wxBreath.raf = 0;
  wxBreath.t0 = 0;
  const w = healthDb.watch && typeof healthDb.watch === "object" ? healthDb.watch : null;
  if (w) {
    if (!Array.isArray(w.breaths)) w.breaths = [];
    w.breaths.push({ at: Date.now(), s });
    if (w.breaths.length > 1000) w.breaths = w.breaths.slice(-1000);
    saveHealthDb();
  }
  const n = wxBreaths().length;
  const ring = document.getElementById("wxBreathRing");
  if (ring) ring.classList.remove("is-in", "is-out");
  const word = document.getElementById("wxBreathWord");
  if (word) word.textContent = "😌";
  const sub = document.getElementById("wxBreathSub");
  if (sub) sub.textContent = `Pronto. ${n === 1 ? "Primeira respiração guiada no Toba" : `${n}ª respiração guiada`}. Um minuto que o teu nervo vago agradece. Nunca foi sorte. 🙏`;
  const go = document.getElementById("wxBreathGo");
  if (go) {
    go.hidden = false;
    go.textContent = "🔁 De novo";
  }
  if (typeof renderWatchMetric === "function" && typeof watchAn === "object" && watchAn.metric === "stress") renderWatchMetric();
}

/* ---------------- Ponte: guarda o hora a hora que o APK manda ---------------- */

(function wxHookHealthData() {
  const prev = window.onTobaHealthData;
  if (typeof prev !== "function") return;
  window.onTobaHealthData = function (reqId, data) {
    const mine = typeof watchUi === "object" && reqId === watchUi.reqId;
    prev.apply(this, arguments);
    if (!mine || !data || !data.ok || !data.hourly || typeof data.hourly !== "object") return;
    if (wxStoreHourly(data.hourly)) {
      saveHealthDb();
      renderWatch();
    }
    // 1ª leitura com o APK 2.9: relê o mês inteiro pra já ter o mapa de horas
    if (!watchState().hourRead) {
      watchSetState({ hourRead: 1 });
      setTimeout(() => watchPull({ full: true, quiet: true }), 800);
    }
  };
})();

tobaActions({
  wxTipTap,
  wxBreathOpen,
  wxBreathStart,
  wxBreathClose() {
    wxBreathStop(false);
    closeTobaModal("wxBreathModal");
  },
});

document.addEventListener("DOMContentLoaded", () => {
  const m = document.getElementById("wxBreathModal");
  if (m) m.addEventListener("toba:close", () => wxBreathStop(false));
});
