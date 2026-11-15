/* =====================================================================
 * Toba Health · 📱 Toba Screen (v2.08) · a tela
 * Só lê o TOBA_HEALTH_DB.screen (motor em screen-core.js, regras puras em health-metrics.js).
 * Grava só o que a pessoa escolhe: 🎯 meta (screen.goal), limite por app (screen.limits) e a
 * categoria de um app (screen.apps[pacote].cat).
 *
 * Tela = DIA escolhido (‹ Hoje ›): herói com o anel da meta, 🤡 Papo reto do Cloba, 🏆 ranking dos
 * apps, 🧩 pra onde foi o tempo, 🕐 hora a hora, 🗺️ mapa de calor hora x dia da semana (8 semanas),
 * 🗓️ mapa do mês (quadradinho por dia), 😴 celular x sono (cruza com o 🩻 Raio-X), 🧠 Raio-X do vício
 * (porta de entrada, checadas x mergulhos, quem mais te cutuca), 📈 tá melhorando?, 🧮 tua vida em tela.
 * ===================================================================== */
const SCR_WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SCR_WD_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SCR_MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SCR_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SCR_DIVE_MIN = 20;   // mergulho = sessão com 20 min+ dentro de app
const SCR_CHECK_SEC = 60;  // checada = desbloqueou e saiu em menos de 1 min
const SCR_AWAKE_MIN = 16 * 60;

const scrUi = { date: "", hourMode: "t", heatMode: "t", month: "", showAll: false, app: "" };

/* ---------------- Números ---------------- */

function scrToday() {
  return toIsoDate();
}

function scrSel() {
  if (!scrUi.date || scrUi.date > scrToday()) scrUi.date = scrToday();
  return scrUi.date;
}

function scrMin(date) {
  return screenDayMinutes(screenDay(date));
}

function scrInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("pt-BR");
}

function scrDur(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}min`;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

function scrClock(minOfDay) {
  if (minOfDay === null || minOfDay === undefined) return "--";
  const m = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function scrClockMs(ms) {
  const d = new Date(Number(ms));
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function scrGoal(date) {
  return calcScreenGoal(healthDb, date);
}

function scrWeekday(iso) {
  return SCR_WD_LONG[new Date(`${iso}T12:00:00`).getDay()];
}

function scrDayLabel(iso) {
  const t = scrToday();
  if (iso === t) return "Hoje";
  if (iso === screenAddDays(t, -1)) return "Ontem";
  return `${scrWeekday(iso)}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function scrFirstDate() {
  const d = Object.keys(screenDays()).sort();
  return d[0] || scrToday();
}

// Média dos `n` dias antes de `date` (só dias com dado)
function scrAvg(date, n, get = scrMin) {
  let s = 0, c = 0;
  for (let i = 1; i <= n; i++) {
    const v = get(screenAddDays(date, -i));
    if (v !== null && v !== undefined && Number.isFinite(v)) { s += v; c++; }
  }
  return c >= Math.min(3, n) ? s / c : null;
}

// Minutos de tela do dia até `minOfDay` (pela conta de hora a hora)
function scrUpTo(date, minOfDay) {
  const d = screenDay(date);
  if (!d || !Array.isArray(d.h)) return null;
  const H = Math.floor(minOfDay / 60);
  let s = 0;
  for (let h = 0; h < H && h < 24; h++) s += d.h[h];
  if (H < 24) s += d.h[H] * ((minOfDay % 60) / 60);
  return s / 60;
}

function scrNowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

// Normal de cada hora (minutos) nos `days` dias antes
function scrHourNormal(date, key = "h", days = 28) {
  const sum = Array(24).fill(0);
  let cnt = 0;
  for (let i = 1; i <= days; i++) {
    const d = screenDay(screenAddDays(date, -i));
    if (!d || !Array.isArray(d[key]) || d.cut) continue;
    cnt++;
    d[key].forEach((v, h) => { sum[h] += Number(v) || 0; });
  }
  if (cnt < 3) return null;
  return sum.map((s) => (key === "h" ? s / cnt / 60 : s / cnt));
}

// 🔮 Hoje: o que já foi + o normal do resto do dia
function scrProjection(date) {
  if (date !== scrToday()) return null;
  const normal = scrHourNormal(date);
  const v = scrMin(date);
  if (!normal || v === null) return null;
  const now = scrNowMin();
  const H = Math.floor(now / 60);
  let rest = normal[H] * (1 - (now % 60) / 60);
  for (let h = H + 1; h < 24; h++) rest += normal[h];
  return v + rest;
}

function scrSessions(date) {
  return screenDaySessions(screenDay(date), date);
}

function scrAppsOf(date) {
  const d = screenDay(date);
  return Object.entries((d && d.a) || {}).map(([pkg, s]) => ({ pkg, min: Number(s) / 60 })).sort((a, b) => b.min - a.min);
}

function scrSumApps(dates) {
  const acc = {};
  dates.forEach((dd) => scrAppsOf(dd).forEach((x) => { acc[x.pkg] = (acc[x.pkg] || 0) + x.min; }));
  return acc;
}

function scrLastDays(date, n, includeSelf = true) {
  const out = [];
  for (let i = includeSelf ? 0 : 1; out.length < n && i < n + 1; i++) {
    const dd = screenAddDays(date, -i);
    if (screenDay(dd)) out.push(dd);
  }
  return out;
}

function scrLimit(pkg) {
  const l = screenDb().limits;
  return l && Number(l[pkg]) > 0 ? Number(l[pkg]) : 0;
}

/* ---------------- Pedacinhos de tela ---------------- */

function scrIcon(pkg, size = "") {
  const src = screenIcons()[pkg];
  if (src) return `<img class="scr-ico${size ? ` is-${size}` : ""}" src="${escapeHtml(src)}" alt="" loading="lazy" />`;
  return `<span class="scr-ico is-emoji${size ? ` is-${size}` : ""}" aria-hidden="true">${screenCat(screenCatOf(pkg)).icon}</span>`;
}

function scrTile(label, value, sub = "", cls = "") {
  return `<div class="toba-stat is-center">
    <span class="toba-stat-label">${label}</span>
    <span class="toba-stat-value${cls ? ` ${cls}` : ""}">${value}</span>
    ${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}
  </div>`;
}

function scrQ(key) {
  return `<button type="button" class="wsl-q" data-click="scrHelp" data-help="${key}" aria-label="Entenda">❔</button>`;
}

function scrTitle(text, help) {
  return `<div class="section-title wsl-title">${text} ${help ? scrQ(help) : ""}</div>`;
}

function scrRing(pct, cls) {
  const r = 30, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return `<div class="wsl-ring ${cls}" role="img" aria-label="${Math.round(pct)}% da meta">
    <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${r}" class="wsl-ring-bg" />
      <circle cx="36" cy="36" r="${r}" class="wsl-ring-fg" style="stroke-dasharray:${((c * p) / 100).toFixed(1)} ${c.toFixed(1)}" /></svg>
    <span class="wsl-ring-num">${Math.round(pct)}%</span>
  </div>`;
}

// Delta onde DESCER é bom (menos tela = verde)
function scrDelta(v, ref) {
  if (v === null || ref === null || !ref) return { txt: "--", cls: "" };
  const pct = ((v - ref) / ref) * 100;
  if (Math.abs(pct) < 1) return { txt: "= 0%", cls: "" };
  return { txt: `${pct > 0 ? "▲" : "▼"} ${Math.abs(Math.round(pct))}%`, cls: pct > 0 ? "text-coral" : "text-green" };
}

function scrTipWrap(svg, hint = "👆 Toca pra ver o número") {
  return `<div class="wx-tipwrap"><div class="watch-chart-tip is-hint" aria-live="polite">${hint}</div>${svg}</div>`;
}

/* ---------------- Gráficos (SVG à mão, toque = letreiro) ---------------- */

function scrHourBars(vals, normal, opts = {}) {
  const W = 340, H = 130, top = 14, bot = 18;
  const all = [...vals, ...(normal || [])].filter((v) => v !== null && Number.isFinite(v));
  if (!all.length || Math.max(...all) <= 0) return "";
  const max = Math.max(...all, opts.min || 1) * 1.1;
  const slot = W / 24, bw = slot * 0.66;
  const y = (v) => top + (H - top - bot) * (1 - v / max);
  const fmt = opts.fmt || ((v) => scrDur(v));
  const nowH = opts.nowHour;
  let out = "", pts = [];
  for (let h = 0; h < 24; h++) {
    const x = h * slot;
    const v = vals[h];
    const nv = normal ? normal[h] : null;
    const future = nowH !== undefined && h > nowH;
    if (!future && v > 0) {
      const hot = opts.hot && opts.hot(h);
      out += `<rect class="wx-bar" x="${(x + (slot - bw) / 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, H - bot - y(v)).toFixed(1)}" rx="2" style="fill:${hot ? "var(--coral)" : opts.color || "var(--scr)"}" />`;
    }
    if (nv !== null && nv !== undefined) pts.push(`${(x + slot / 2).toFixed(1)},${y(nv).toFixed(1)}`);
    if (h % 3 === 0) out += `<text x="${(x + slot / 2).toFixed(1)}" y="${H - 4}" class="wsl-axis${h === nowH ? " is-hi" : ""}" text-anchor="middle">${h}h</text>`;
    const tip = `${h}h às ${h + 1}h · ${future ? "ainda não chegou" : fmt(v || 0)}${nv !== null && nv !== undefined ? ` · teu normal ${fmt(nv)}` : ""}`;
    out += `<rect class="watch-chart-hit" x="${x.toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-click="scrTip" data-tip="${escapeHtml(tip)}" />`;
  }
  const line = pts.length > 1 ? `<polyline points="${pts.join(" ")}" class="wx-normal" />` : "";
  return scrTipWrap(`<svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.label || "Hora a hora")}">${out}${line}</svg>`, "👆 Toca numa hora pra ver o número");
}

// Barras simples de dias [{ label, v, hi, tip, good }]
function scrDayBars(rows, opts = {}) {
  const vals = rows.map((r) => r.v).filter((v) => v !== null);
  if (!vals.length) return "";
  const W = 340, H = 120, top = 16, bot = 18;
  const max = Math.max(...vals, opts.line || 0, 1) * 1.12;
  const slot = W / rows.length, bw = slot * 0.62;
  const y = (v) => top + (H - top - bot) * (1 - v / max);
  let out = "";
  rows.forEach((r, i) => {
    const x = i * slot;
    if (r.v !== null) {
      const fill = r.hi ? "var(--gold-2)" : r.good === false ? "var(--coral)" : opts.color || "var(--scr)";
      out += `<rect x="${(x + (slot - bw) / 2).toFixed(1)}" y="${y(r.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, H - bot - y(r.v)).toFixed(1)}" rx="3" style="fill:${fill};opacity:${r.hi ? 1 : 0.8}" />`;
    }
    if (rows.length <= 16 || i % 2 === 0) out += `<text x="${(x + slot / 2).toFixed(1)}" y="${H - 4}" class="wsl-axis${r.hi ? " is-hi" : ""}" text-anchor="middle">${escapeHtml(r.label)}</text>`;
    out += `<rect class="watch-chart-hit" x="${x.toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-click="scrTip" data-tip="${escapeHtml(r.tip || "")}" ${r.go ? `data-go="${r.go}"` : ""} />`;
  });
  if (opts.line) out += `<line x1="0" x2="${W}" y1="${y(opts.line).toFixed(1)}" y2="${y(opts.line).toFixed(1)}" class="wps-goal-line" />`;
  return scrTipWrap(`<svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.label || "Dias")}">${out}</svg>`, opts.hint || "👆 Toca numa barra");
}

// 🗺️ Mapa de calor: dia da semana x hora (média das últimas `weeks` semanas, hoje fora)
function scrHeat(date, mode, weeks = 8, onlyPkg = "") {
  const sum = Array.from({ length: 7 }, () => Array(24).fill(0));
  const cnt = Array(7).fill(0);
  let days = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const dd = screenAddDays(date, -i);
    if (dd === scrToday()) continue;
    const d = screenDay(dd);
    if (!d || d.cut) continue;
    let arr = onlyPkg ? d.ah && d.ah[onlyPkg] : mode === "u" ? d.hu : d.h;
    if (onlyPkg && !arr && d.ah) arr = Array(24).fill(0); // dia sem esse app = zero
    if (!Array.isArray(arr)) continue;
    days++;
    const wd = new Date(`${dd}T12:00:00`).getDay();
    cnt[wd]++;
    arr.forEach((v, h) => { sum[wd][h] += Number(v) || 0; });
  }
  if (days < 7) return null;
  const toUnit = (v) => (mode === "u" ? v : v / 60);
  const avg = sum.map((row, wd) => row.map((s) => (cnt[wd] ? toUnit(s / cnt[wd]) : null)));
  const flat = avg.flat().filter((v) => v !== null);
  const max = Math.max(...flat, mode === "u" ? 1 : 3);
  const W = 340, lw = 26, top = 4, ch = 17, cw = (W - lw) / 24;
  const H = top + ch * 7 + 16;
  const fmt = (v) => (mode === "u" ? `${scrInt(v)} desbloqueio${Math.round(v) === 1 ? "" : "s"}` : `${scrDur(v)} de tela`);
  const color = mode === "u" ? "var(--gold-2)" : "var(--scr)";
  let cells = "";
  const selWd = new Date(`${date}T12:00:00`).getDay();
  SCR_ORDER.forEach((wd, r) => {
    cells += `<text x="0" y="${(top + r * ch + ch * 0.7).toFixed(1)}" class="wsl-axis${wd === selWd ? " is-hi" : ""}">${SCR_WD[wd]}</text>`;
    for (let h = 0; h < 24; h++) {
      const v = avg[wd][h];
      const x = lw + h * cw;
      const a = v === null || v <= 0 ? 0 : Math.max(0.08, Math.min(1, v / max));
      const tip = `${SCR_WD_LONG[wd]} ${h}h · ${v === null ? "sem dado" : `${fmt(v)} em média`}`;
      cells += `<rect x="${(x + 0.5).toFixed(1)}" y="${(top + r * ch + 0.6).toFixed(1)}" width="${(cw - 1).toFixed(1)}" height="${(ch - 1.2).toFixed(1)}" rx="2" class="wx-cell${!a ? " is-empty" : ""}" style="${a ? `fill:${color};fill-opacity:${a.toFixed(2)}` : ""}" data-click="scrTip" data-tip="${escapeHtml(tip)}" />`;
    }
  });
  for (let h = 0; h < 24; h += 3) cells += `<text x="${(lw + h * cw + cw / 2).toFixed(1)}" y="${H - 3}" class="wsl-axis" text-anchor="middle">${h}h</text>`;
  const ranked = [];
  SCR_ORDER.forEach((wd) => avg[wd].forEach((v, h) => { if (v !== null && v > 0) ranked.push({ wd, h, v }); }));
  ranked.sort((a, b) => b.v - a.v);
  const byWd = SCR_ORDER.map((wd) => ({ wd, v: avg[wd].reduce((s, x) => s + (x || 0), 0) })).filter((x) => cnt[x.wd]);
  byWd.sort((a, b) => b.v - a.v);
  return {
    svg: scrTipWrap(`<svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de calor das horas">${cells}</svg>`, "👆 Toca num quadradinho"),
    top: ranked.slice(0, 3), worstDay: byWd[0], bestDay: byWd[byWd.length - 1], days, fmt, avg,
  };
}

function scrTip(el) {
  const wrap = el.closest(".wx-tipwrap");
  if (!wrap) return;
  wrap.querySelectorAll(".is-sel").forEach((x) => x.classList.remove("is-sel"));
  el.classList.add("is-sel");
  const tip = wrap.querySelector(".watch-chart-tip");
  if (tip) {
    tip.classList.remove("is-hint");
    tip.textContent = el.dataset.tip || "";
  }
}

/* ---------------- Conectar ---------------- */

function renderScreenConnect() {
  const el = document.getElementById("screenConnect");
  if (!el) return;
  const has = Object.keys(screenDays()).length > 0;
  let html = "";
  if (!screenCanNative()) {
    const apk = typeof TOBA_NATIVE !== "undefined" && TOBA_NATIVE;
    html = apk
      ? `<div class="card scr-connect"><div class="card-title">📲 Falta o APK 3.1</div><p class="watch-muted">Quem lê o teu tempo de tela é o app do Toba. Instala o APK 3.1 pelo KingInstaller (igual sempre) e volta aqui que o Cloba começa a vigiar teu dedão. 👀</p></div>`
      : has ? "" : `<div class="card scr-connect"><div class="card-title">📱 Toba Screen</div><p class="watch-muted">Quem lê o tempo de tela é o app do Toba no celular (APK 3.1). Aqui no navegador aparece o que já veio de lá pela ☁️ Conta.</p></div>`;
  } else {
    screenReadStatus();
    if (!screenGranted()) {
      html = `<div class="card scr-connect">
        <div class="card-title">🔓 Libera o Acesso ao uso</div>
        <p class="watch-muted">É uma chavinha só, nas Configurações do Android: <b>Acesso ao uso › Toba › Permitir</b>. É o mesmo dado do Bem-estar digital da Samsung (tempo por app, desbloqueios, notificações). O Toba só LÊ e guarda aqui no teu banco.</p>
        <button type="button" class="btn btn-primary" data-click="screenAskAccess">🔓 Abrir as Configurações</button>
        <p class="watch-muted scr-small">O Android só guarda uns 7 a 10 dias de detalhe. Por isso o Toba começa o histórico dele no dia que tu ligar.</p>
      </div>`;
    } else if (!has) {
      html = `<div class="card scr-connect"><p class="watch-muted">${screenUi.pulling ? "🔄 Lendo o teu celular..." : "Liberado! Toca no 🔄 lá em cima pra puxar os últimos dias."}</p></div>`;
    }
  }
  el.innerHTML = html;
  el.hidden = !html;
}

function screenOnPullState() {
  const btn = document.getElementById("screenSyncBtn");
  if (btn) {
    btn.hidden = !screenCanNative();
    btn.classList.toggle("is-spinning", screenUi.pulling);
  }
  renderScreenConnect();
  renderScreenSyncLine();
}

function screenOnData() {
  renderScreen();
}

function renderScreenSyncLine() {
  const el = document.getElementById("screenSyncLine");
  if (!el) return;
  const st = screenState();
  el.textContent = st.pulledAt ? `🔄 Lido do celular ${scrAgo(st.pulledAt)}${screenUi.pulling ? " · lendo de novo..." : ""}` : "";
}

function scrAgo(ms) {
  const s = Math.max(0, Math.round((Date.now() - Number(ms)) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dia(s)`;
}

/* ---------------- Dia: navegação ---------------- */

function renderScreenDayNav() {
  const el = document.getElementById("screenDayNav");
  if (!el) return;
  const sel = scrSel();
  const today = scrToday();
  const isToday = sel === today;
  el.innerHTML = `
    <button type="button" class="toba-icon-btn" data-click="scrDayStep" data-step="-1" aria-label="Dia anterior">‹</button>
    <div class="watch-daynav-pick" role="button" tabindex="0" data-click="scrOpenPicker" aria-label="Escolher o dia">
      <span class="watch-daynav-main">${escapeHtml(scrDayLabel(sel))} <span class="watch-daynav-caret">▾</span></span>
      <span class="watch-daynav-sub">${escapeHtml(`${scrWeekday(sel)}, ${Number(sel.slice(8, 10))} de ${SCR_MONTHS[Number(sel.slice(5, 7)) - 1]}`)}</span>
      <input type="date" id="scrDateInput" class="watch-daynav-input" value="${sel}" max="${today}" min="${scrFirstDate()}" data-change="scrPickDate" tabindex="-1" aria-hidden="true" />
    </div>
    ${isToday ? `<button type="button" class="toba-icon-btn" disabled aria-label="Próximo dia">›</button>` : `<button type="button" class="toba-icon-btn" data-click="scrDayStep" data-step="1" aria-label="Próximo dia">›</button>`}
    ${isToday ? "" : `<button type="button" class="chip-btn watch-daynav-today" data-click="scrGoToday">↩️ Voltar pra hoje</button>`}`;
}

function scrSetDate(iso) {
  const t = scrToday();
  scrUi.date = iso > t ? t : iso;
  scrUi.month = scrUi.date.slice(0, 7);
  scrUi.showAll = false;
  renderScreen();
}

/* ---------------- Herói ---------------- */

function scrHero(date) {
  const v = scrMin(date);
  const d = screenDay(date) || {};
  const g = scrGoal(date);
  const isToday = date === scrToday();
  const pct = v !== null ? (v / g.goal) * 100 : 0;
  const cls = pct <= 80 ? "is-good" : pct <= 100 ? "is-ok" : "is-bad";
  const proj = scrProjection(date);
  const notif = Object.values(d.n || {}).reduce((a, x) => a + Number(x || 0), 0);
  const bits = [d.u ? `🔓 ${scrInt(d.u)} desbloqueios` : "", notif ? `🔔 ${scrInt(notif)} notificações` : ""].filter(Boolean).join(" · ");
  let line;
  if (v === null) line = isToday ? "Ainda nada lido hoje. Toca no 🔄 lá em cima." : "Sem dado desse dia (o Toba ainda não tava lendo).";
  else if (v <= g.goal) line = `😎 ${isToday ? "Sobrando" : "Sobrou"} ${scrDur(g.goal - v)} da 🎯 de ${scrDur(g.goal)}${g.auto ? " (automática)" : ""}.`;
  else line = `🚨 Passou ${scrDur(v - g.goal)} da 🎯 de ${scrDur(g.goal)}. O dedão venceu essa.`;
  return `<div class="card wsl-hero scr-hero">
      <div class="wsl-hero-top">
        <div class="wsl-hero-main">
          <div class="wsl-hero-val scr-hero-val">${v !== null ? escapeHtml(scrDur(v)) : "--"}</div>
          <div class="wsl-hero-sub">de tela${isToday ? " até agora" : ""}${bits ? ` · ${escapeHtml(bits)}` : ""}</div>
          ${proj && proj > (v || 0) + 5 ? `<div class="wsl-hero-clock">🔮 No teu ritmo fecha em ~${escapeHtml(scrDur(proj))}${proj > g.goal && (v || 0) <= g.goal ? " (estoura a meta!)" : ""}</div>` : ""}
        </div>
        <div class="wsl-hero-score">${scrRing(pct, cls)}<small>da 🎯 ${escapeHtml(scrDur(g.goal))}</small></div>
      </div>
      <p class="watch-muted">${escapeHtml(line)}</p>
    </div>`;
}

function scrCompareTiles(date) {
  const v = scrMin(date);
  const isToday = date === scrToday();
  if (isToday) {
    const now = scrNowMin();
    const y = scrUpTo(screenAddDays(date, -1), now);
    const refs7 = [];
    for (let i = 1; i <= 7; i++) { const x = scrUpTo(screenAddDays(date, -i), now); if (x !== null) refs7.push(x); }
    const a7 = refs7.length >= 3 ? refs7.reduce((a, b) => a + b, 0) / refs7.length : null;
    const a30 = scrAvg(date, 30);
    const d1 = scrDelta(v, y), d7 = scrDelta(v, a7);
    return [
      scrTile("Ontem", y === null ? "--" : escapeHtml(scrDur(y)), y === null ? "sem dado" : `${d1.txt} · até essa hora`, d1.cls),
      scrTile("7 dias", a7 === null ? "--" : escapeHtml(scrDur(a7)), a7 === null ? "sem dado" : `${d7.txt} · até essa hora`, d7.cls),
      scrTile("30 dias", a30 === null ? "--" : escapeHtml(scrDur(a30)), "média do dia inteiro"),
    ];
  }
  return [["vs Ontem", scrMin(screenAddDays(date, -1)), "ontem"], ["vs 7 dias", scrAvg(date, 7), "média"], ["vs 30 dias", scrAvg(date, 30), "média"]]
    .map(([label, ref, refLabel]) => {
      const dd = scrDelta(v, ref);
      return scrTile(label, dd.txt, ref === null ? "sem dado" : `${refLabel}: ${escapeHtml(scrDur(ref))}`, dd.cls);
    });
}

function scrDayFacts(date) {
  const d = screenDay(date) || {};
  const fl = screenFirstLast(date) || {};
  const ses = scrSessions(date);
  const longest = ses.reduce((b, x) => (x.app > (b ? b.app : 0) ? x : b), null);
  const awake = fl.first !== null && fl.first !== undefined ? Math.max(60, (date === scrToday() ? scrNowMin() : (fl.last || 1380)) - fl.first) : SCR_AWAKE_MIN;
  const every = d.u ? awake / d.u : null;
  return [
    scrTile("🌅 1ª pegada", escapeHtml(scrClock(fl.first)), "a partir das 4h"),
    scrTile("🌙 Última", escapeHtml(scrClock(fl.last)), fl.last >= 1440 ? "já de madrugada 🦉" : date === scrToday() ? "até agora" : "fim do uso"),
    scrTile("⏱️ Maior", longest ? escapeHtml(scrDur(longest.app / 60)) : "--", longest ? escapeHtml(`${longest.pkg ? screenAppName(longest.pkg) : ""} ${scrClockMs(longest.start)}`.trim()) : "sem sessão"),
    scrTile("🔁 Pega a cada", every ? escapeHtml(scrDur(every)) : "--", every ? "acordado" : "sem desbloqueio"),
  ];
}

/* ---------------- 🤡 Papo reto do Cloba ---------------- */

function scrClobaLines(date) {
  const lines = [];
  const v = scrMin(date);
  if (v === null) return lines;
  const g = scrGoal(date);
  const isToday = date === scrToday();
  const apps = scrAppsOf(date);
  const d = screenDay(date) || {};
  if (apps.length && v > 20) {
    const top = apps[0];
    const share = top.min / v;
    if (share >= 0.3) lines.push(`${screenCat(screenCatOf(top.pkg)).icon} ${screenAppName(top.pkg)} comeu ${Math.round(share * 100)}% do teu dia (${scrDur(top.min)}). É o chefão da fase.`);
  }
  const proj = scrProjection(date);
  if (isToday && proj && proj > g.goal && v < g.goal) {
    const left = g.goal - v;
    lines.push(`🔮 No ritmo de sempre tu fecha em ~${scrDur(proj)} e estoura a 🎯. Ainda dá ${scrDur(left)} de tela hoje: gasta com sabedoria.`);
  }
  const fun = apps.filter((x) => screenCat(screenCatOf(x.pkg)).kind === "fun").reduce((a, x) => a + x.min, 0);
  if (v > 30 && fun / v >= 0.6) lines.push(`🍿 ${Math.round((fun / v) * 100)}% foi diversão (vídeo, social, jogo). Não é crime, mas o Cloba anotou. 📝`);
  if (d.u >= 60) lines.push(`🔓 ${scrInt(d.u)} desbloqueios. É tipo checar a geladeira sabendo que não tem nada novo. 🧊`);
  const ses = scrSessions(date);
  const dive = ses.filter((x) => x.app >= SCR_DIVE_MIN * 60).sort((a, b) => b.app - a.app)[0];
  if (dive) lines.push(`🕳️ Maior mergulho: ${scrDur(dive.app / 60)}${dive.pkg ? ` no ${screenAppName(dive.pkg)}` : ""} às ${scrClockMs(dive.start)}. Quando viu, já era.`);
  const night = calcScreenNight(healthDb, date);
  if (night) {
    if (night.bed !== null && night.bed < 10) lines.push(`📵 Ontem largou o celular ${night.bed ? `só ${night.bed} min` : "na hora"} antes de dormir. Tela na cara segura o sono: tenta 30 min sem.`);
    else if (night.bed !== null && night.bed >= 30) lines.push(`🛏️ Largou o celular ${scrDur(night.bed)} antes de dormir. Isso é coisa de monge. 🧘`);
    if (night.morning !== null && night.morning <= 5) lines.push(`🌅 Pegou o celular ${night.morning <= 0 ? "no segundo" : `${night.morning} min`} depois de acordar. Nem o café coado na V60 primeiro? ☕`);
    if (night.wake >= 2) lines.push(`🌙 Acendeu a tela ${night.wake} vezes no meio da noite (${scrDur(night.wakeMin)}). O Killua e o Gon que deviam ser os insones. 🐈`);
  }
  if (!isToday) {
    const a30 = scrAvg(date, 30);
    if (a30) {
      const pct = ((v - a30) / a30) * 100;
      if (pct <= -15) lines.push(`😎 ${Math.round(-pct)}% abaixo do teu normal de 30 dias. Nunca foi sorte. 🙏`);
      else if (pct >= 15) lines.push(`🫠 ${Math.round(pct)}% acima do teu normal de 30 dias. Amanhã tem revanche.`);
    }
  }
  if (!lines.length) lines.push(v <= g.goal ? "👍 Dia no controle. Sem BO pra reportar." : "📱 Dia pesado de tela. Bora ver no mapa de calor onde dá pra cortar.");
  return lines.slice(0, 5);
}

function scrCloba(date) {
  const lines = scrClobaLines(date);
  if (!lines.length) return "";
  return `${scrTitle("🤡 Papo reto do Cloba", "cloba")}
    <div class="card wsl-papo"><div class="wsl-papo-lines is-first">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>`;
}

/* ---------------- 🏆 Ranking dos apps ---------------- */

function scrRanking(date) {
  const apps = scrAppsOf(date);
  if (!apps.length) return "";
  const v = scrMin(date) || 1;
  const d = screenDay(date) || {};
  const shown = scrUi.showAll ? apps : apps.slice(0, 8);
  const max = apps[0].min || 1;
  const rows = shown.map((x, i) => {
    const cat = screenCat(screenCatOf(x.pkg));
    const lim = scrLimit(x.pkg);
    const over = lim && x.min > lim;
    const n = d.n && d.n[x.pkg] ? Number(d.n[x.pkg]) : 0;
    const sub = [`${Math.round((x.min / v) * 100)}%`, cat.name, n ? `🔔 ${scrInt(n)}` : "", lim ? (over ? `⛔ passou ${scrDur(x.min - lim)} do limite` : `🎯 limite ${scrDur(lim)}`) : ""].filter(Boolean).join(" · ");
    return `<button type="button" class="scr-app-row${over ? " is-over" : ""}" data-click="scrOpenApp" data-id="${escapeHtml(x.pkg)}">
      <span class="scr-rank">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
      ${scrIcon(x.pkg)}
      <span class="scr-app-main">
        <span class="scr-app-top"><span class="scr-app-name">${escapeHtml(screenAppName(x.pkg))}</span><span class="scr-app-time">${escapeHtml(scrDur(x.min))}</span></span>
        <span class="scr-app-bar"><i style="width:${Math.max(2, (x.min / max) * 100).toFixed(1)}%;background:${over ? "var(--coral)" : cat.color}"></i>${lim ? `<b style="left:${Math.min(100, (lim / max) * 100).toFixed(1)}%"></b>` : ""}</span>
        <span class="scr-app-sub">${escapeHtml(sub)}</span>
      </span>
    </button>`;
  }).join("");
  return `${scrTitle("🏆 Ranking dos apps", "rank")}
    <div class="card scr-rank-card">${rows}
      ${apps.length > 8 ? `<button type="button" class="btn btn-secondary btn-sm scr-more" data-click="scrToggleAll">${scrUi.showAll ? "⬆️ Só os 8 primeiros" : `⬇️ Ver todos (${apps.length})`}</button>` : ""}
    </div>`;
}

/* ---------------- 🧩 Pra onde foi o tempo ---------------- */

function scrCats(date) {
  const apps = scrAppsOf(date);
  const total = apps.reduce((a, x) => a + x.min, 0);
  if (total < 1) return "";
  const acc = {};
  apps.forEach((x) => { const c = screenCatOf(x.pkg); acc[c] = (acc[c] || 0) + x.min; });
  const list = Object.entries(acc).filter(([, m]) => m >= 0.5).sort((a, b) => b[1] - a[1]);
  const kinds = { fun: 0, mid: 0, use: 0 };
  list.forEach(([k, m]) => { kinds[screenCat(k).kind] += m; });
  // 7 dias antes, pra comparar a diversão
  const prev = scrSumApps(scrLastDays(date, 7, false));
  let pf = 0, pt = 0;
  Object.entries(prev).forEach(([p, m]) => { pt += m; if (screenCat(screenCatOf(p)).kind === "fun") pf += m; });
  const funPct = (kinds.fun / total) * 100;
  const prevPct = pt ? (pf / pt) * 100 : null;
  const bar = list.map(([k, m]) => `<i style="width:${((m / total) * 100).toFixed(2)}%;background:${screenCat(k).color}" title="${escapeHtml(screenCat(k).name)}"></i>`).join("");
  const rows = list.map(([k, m]) => {
    const c = screenCat(k);
    return `<div class="scr-cat-row"><span class="scr-dot" style="background:${c.color}"></span><span>${c.icon} ${escapeHtml(c.name)}</span><b>${escapeHtml(scrDur(m))}</b><small>${Math.round((m / total) * 100)}%</small></div>`;
  }).join("");
  return `${scrTitle("🧩 Pra onde foi o tempo", "cats")}
    <div class="card">
      <div class="scr-stack">${bar}</div>
      <div class="toba-stats is-3 scr-kinds">
        ${scrTile(SCREEN_KINDS.fun, `${Math.round(funPct)}%`, escapeHtml(scrDur(kinds.fun)), funPct >= 60 ? "text-coral" : "")}
        ${scrTile(SCREEN_KINDS.use, `${Math.round((kinds.use / total) * 100)}%`, escapeHtml(scrDur(kinds.use)), "text-green")}
        ${scrTile(SCREEN_KINDS.mid, `${Math.round((kinds.mid / total) * 100)}%`, escapeHtml(scrDur(kinds.mid)))}
      </div>
      ${rows}
      ${prevPct !== null ? `<p class="watch-muted">🍿 Diversão: ${Math.round(funPct)}% hoje x ${Math.round(prevPct)}% nos 7 dias antes. Categoria errada? Toca no app no 🏆 ranking e troca.</p>` : ""}
    </div>`;
}

/* ---------------- 🕐 Hora a hora ---------------- */

function scrHours(date) {
  const d = screenDay(date);
  if (!d || !Array.isArray(d.h)) return "";
  const isToday = date === scrToday();
  const mode = scrUi.hourMode === "u" && Array.isArray(d.hu) ? "u" : "t";
  const vals = mode === "u" ? d.hu.map(Number) : d.h.map((s) => Number(s) / 60);
  const normal = scrHourNormal(date, mode === "u" ? "hu" : "h");
  const fmt = mode === "u" ? (v) => `${scrInt(v)} desbloq.` : (v) => scrDur(v);
  const bars = scrHourBars(vals, normal, {
    fmt, color: mode === "u" ? "var(--gold-2)" : "var(--scr)", label: "Tela por hora",
    nowHour: isToday ? new Date().getHours() : undefined,
    hot: (h) => normal && normal[h] !== null && vals[h] > Math.max(normal[h] * 1.5, mode === "u" ? 3 : 10),
  });
  const peak = vals.reduce((b, x, h) => (x > vals[b] ? h : b), 0);
  const night = mode === "t" ? vals.slice(0, 5).reduce((a, x) => a + x, 0) : 0;
  const msg = [vals[peak] > 0 ? `⏰ Pico${isToday ? " até agora" : ""}: ${peak}h às ${peak + 1}h (${fmt(vals[peak])}).` : "", night >= 15 ? `🦉 ${scrDur(night)} de madrugada (0h às 5h).` : ""].filter(Boolean).join(" ");
  return `${scrTitle("🕐 Hora a hora", "hours")}
    <div class="card">
      <div class="watch-chips scr-toggle">
        <button type="button" class="chip-btn${mode === "t" ? " is-on" : ""}" data-click="scrHourMode" data-mode="t">⏱️ Tempo</button>
        ${Array.isArray(d.hu) ? `<button type="button" class="chip-btn${mode === "u" ? " is-on" : ""}" data-click="scrHourMode" data-mode="u">🔓 Desbloqueios</button>` : ""}
      </div>
      ${bars || `<p class="watch-muted">Nada nesse dia.</p>`}
      ${bars ? `<div class="watch-an-legend"><span><i class="wx-key-bar" style="background:${mode === "u" ? "var(--gold-2)" : "var(--scr)"}"></i>${isToday ? "hoje" : "o dia"}</span><span><i class="wx-key-bar" style="background:var(--coral)"></i>bem acima do normal</span><span><i class="wx-key-normal"></i>teu normal (28 dias)</span></div>` : ""}
      ${msg ? `<p class="watch-muted">${escapeHtml(msg)}</p>` : ""}
    </div>`;
}

/* ---------------- 🗺️ Mapa de calor das horas ---------------- */

function scrHeatCard(date) {
  const mode = scrUi.heatMode;
  const heat = scrHeat(date, mode);
  const title = scrTitle("🗺️ Mapa de calor: tuas horas", "heat");
  if (!heat) return `${title}<div class="card"><p class="watch-muted">🗺️ Com 7 dias de dado o Cloba monta o mapa: cada quadradinho é uma hora de um dia da semana, e quanto mais forte, mais celular. É o teu mapa da mina pra cortar. Faltam ${Math.max(1, 7 - Object.keys(screenDays()).length)} dia(s).</p></div>`;
  const zones = heat.top.map((x, i) => `<div class="scr-zone"><span class="scr-zone-n">${i + 1}</span><span>${escapeHtml(`${SCR_WD_LONG[x.wd]}, ${x.h}h às ${x.h + 1}h`)}</span><b>${escapeHtml(heat.fmt(x.v))}</b></div>`).join("");
  const worst = heat.worstDay, best = heat.bestDay;
  const dayLine = worst && best && worst.wd !== best.wd
    ? `📅 Dia mais pesado: ${SCR_WD_LONG[worst.wd]} (${mode === "u" ? `${scrInt(worst.v)} desbloqueios` : scrDur(worst.v)} em média). Mais leve: ${SCR_WD_LONG[best.wd]} (${mode === "u" ? scrInt(best.v) : scrDur(best.v)}).`
    : "";
  const tip = heat.top[0] ? `🎯 Missão do Cloba: deixa o celular em outro cômodo ${SCR_WD_LONG[heat.top[0].wd]} às ${heat.top[0].h}h. É a tua hora mais viciada.` : "";
  return `${title}
    <div class="card">
      <div class="watch-chips scr-toggle">
        <button type="button" class="chip-btn${mode === "t" ? " is-on" : ""}" data-click="scrHeatMode" data-mode="t">⏱️ Tempo</button>
        <button type="button" class="chip-btn${mode === "u" ? " is-on" : ""}" data-click="scrHeatMode" data-mode="u">🔓 Desbloqueios</button>
      </div>
      ${heat.svg}
      <div class="wx-sub">🚨 Zona vermelha (as 3 horas mais pesadas)</div>
      ${zones}
      ${dayLine ? `<p class="watch-muted">${escapeHtml(dayLine)}</p>` : ""}
      ${tip ? `<p class="watch-muted">${escapeHtml(tip)}</p>` : ""}
      <p class="watch-muted scr-small">Média das últimas 8 semanas (${heat.days} dias), hoje fora.</p>
    </div>`;
}

/* ---------------- 🗓️ Mapa do mês ---------------- */

function scrMonthCard(date) {
  const ym = scrUi.month || date.slice(0, 7);
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const first = `${ym}-01`;
  const nDays = new Date(y, m, 0).getDate();
  const today = scrToday();
  const vals = [];
  for (let i = 1; i <= nDays; i++) {
    const dd = `${ym}-${String(i).padStart(2, "0")}`;
    vals.push({ date: dd, v: dd <= today ? scrMin(dd) : null });
  }
  const got = vals.filter((x) => x.v !== null && x.date < today);
  const max = Math.max(60, ...vals.filter((x) => x.v !== null).map((x) => x.v));
  const lead = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  let cells = SCR_ORDER.map((wd) => `<span class="scr-cal-head">${SCR_WD[wd].slice(0, 1).toUpperCase()}</span>`).join("");
  for (let i = 0; i < lead; i++) cells += `<span class="scr-cal-cell is-blank"></span>`;
  vals.forEach((x) => {
    const g = scrGoal(x.date).goal;
    const a = x.v === null ? 0 : Math.max(0.12, Math.min(1, x.v / max));
    const hit = x.v !== null && x.date < today && x.v <= g;
    const cls = ["scr-cal-cell", x.v === null ? "is-empty" : "", hit ? "is-hit" : "", x.date === date ? "is-sel" : "", x.date === today ? "is-today" : "", x.date > today ? "is-future" : ""].filter(Boolean).join(" ");
    const tip = `${scrWeekday(x.date)}, ${x.date.slice(8, 10)}/${x.date.slice(5, 7)} · ${x.v === null ? "sem dado" : `${scrDur(x.v)}${hit ? " · ✅ na meta" : x.date < today ? ` · passou ${scrDur(x.v - g)}` : " · até agora"}`}`;
    cells += `<button type="button" class="${cls}" style="${x.v === null ? "" : `--a:${a.toFixed(2)}`}" data-click="scrCalTap" data-id="${x.date}" data-tip="${escapeHtml(tip)}" ${x.v === null ? "disabled" : ""}><span>${Number(x.date.slice(8, 10))}</span>${x.v !== null ? `<small>${x.v >= 60 ? `${Math.round(x.v / 60)}h` : `${Math.round(x.v)}m`}</small>` : ""}</button>`;
  });
  const avg = got.length ? got.reduce((a, x) => a + x.v, 0) / got.length : null;
  const hits = got.filter((x) => x.v <= scrGoal(x.date).goal).length;
  const best = got.length ? got.reduce((b, x) => (x.v < b.v ? x : b)) : null;
  const worst = got.length ? got.reduce((b, x) => (x.v > b.v ? x : b)) : null;
  // x mês passado até o mesmo dia
  const isCur = ym === today.slice(0, 7);
  const lastDay = isCur ? Number(today.slice(8, 10)) - 1 : nDays;
  const pm = new Date(y, m - 2, 1);
  const pym = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, "0")}`;
  const pvals = [];
  for (let i = 1; i <= Math.min(lastDay, new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate()); i++) {
    const v = scrMin(`${pym}-${String(i).padStart(2, "0")}`);
    if (v !== null) pvals.push(v);
  }
  const pavg = pvals.length >= 3 ? pvals.reduce((a, b) => a + b, 0) / pvals.length : null;
  const dd = avg !== null && pavg !== null ? scrDelta(avg, pavg) : null;
  const firstYm = scrFirstDate().slice(0, 7);
  const canPrev = ym > firstYm;
  const canNext = ym < today.slice(0, 7);
  return `${scrTitle("🗓️ Mapa do mês", "month")}
    <div class="card">
      <div class="scr-cal-nav">
        <button type="button" class="toba-icon-btn" data-click="scrMonthStep" data-step="-1" ${canPrev ? "" : "disabled"} aria-label="Mês anterior">‹</button>
        <b>${escapeHtml(`${SCR_MONTHS[m - 1]} ${y}`)}</b>
        <button type="button" class="toba-icon-btn" data-click="scrMonthStep" data-step="1" ${canNext ? "" : "disabled"} aria-label="Próximo mês">›</button>
      </div>
      <div class="wx-tipwrap">
        <div class="watch-chart-tip is-hint" aria-live="polite">👆 Toca num dia (toque duplo abre ele)</div>
        <div class="scr-cal">${cells}</div>
      </div>
      <div class="scr-cal-legend"><span>menos</span><i style="--a:.15"></i><i style="--a:.4"></i><i style="--a:.7"></i><i style="--a:1"></i><span>mais</span><span class="scr-cal-key-hit">✓ na meta</span></div>
      <div class="toba-stats is-3">
        ${scrTile("📊 Média/dia", avg !== null ? escapeHtml(scrDur(avg)) : "--", dd ? `${dd.txt} x mês passado` : "dias fechados", dd ? dd.cls : "")}
        ${scrTile("✅ Na meta", got.length ? `${hits}/${got.length}` : "--", "dias")}
        ${scrTile("🌳 Mais leve", best ? escapeHtml(scrDur(best.v)) : "--", best ? escapeHtml(`dia ${Number(best.date.slice(8, 10))}`) : "")}
      </div>
      ${worst && got.length >= 3 ? `<p class="watch-muted">🔥 Pior dia: ${escapeHtml(`${scrWeekday(worst.date)}, ${Number(worst.date.slice(8, 10))}`)} com ${escapeHtml(scrDur(worst.v))}.${isCur && pavg !== null ? ` Mês passado até o dia ${lastDay}: ${escapeHtml(scrDur(pavg))}/dia.` : ""}</p>` : ""}
    </div>`;
}

/* ---------------- 😴 Celular x sono ---------------- */

function scrSleepCard(date) {
  const hasWatch = healthDb.watch && healthDb.watch.days && Object.values(healthDb.watch.days).some((d) => d && d.sleep);
  const title = scrTitle("😴 Celular x sono", "sleep");
  if (!hasWatch) return `${title}<div class="card"><p class="watch-muted">😴 Com o sono do relógio no 🩻 Raio-X o Cloba cruza: quanto tempo antes de dormir tu largou o celular, quanto depois de acordar tu pegou e se acendeu a tela de madrugada.</p></div>`;
  const night = calcScreenNight(healthDb, date);
  const strip = [];
  for (let i = 13; i >= 0; i--) {
    const dd = screenAddDays(date, -i);
    const n = calcScreenNight(healthDb, dd);
    strip.push({ label: dd.slice(8, 10), v: n && n.bed !== null ? n.bed : null, hi: dd === date, good: n && n.bed !== null ? n.bed >= SCREEN_BED_GOOD_MIN : undefined, tip: n && n.bed !== null ? `Noite que acabou ${dd.slice(8, 10)}/${dd.slice(5, 7)}: largou ${n.bed ? `${scrDur(n.bed)} antes` : "na hora de dormir"} · pegou ${n.morning !== null ? `${scrDur(Math.max(0, n.morning))} depois de acordar` : "--"}` : "sem dado" });
  }
  // com x sem: noites com 30 min+ de folga x noites com celular até a hora (60 dias)
  const yes = [], no = [];
  for (let i = 0; i < 60; i++) {
    const dd = screenAddDays(date, -i);
    const n = calcScreenNight(healthDb, dd);
    const sl = healthDb.watch.days[dd] && healthDb.watch.days[dd].sleep;
    if (!n || n.bed === null || !sl || !Number(sl.min)) continue;
    (n.bed >= SCREEN_BED_GOOD_MIN ? yes : no).push(Number(sl.min));
  }
  let cmp = "";
  if (yes.length >= 4 && no.length >= 4) {
    const ay = yes.reduce((a, b) => a + b, 0) / yes.length, an = no.reduce((a, b) => a + b, 0) / no.length;
    const diff = ay - an;
    cmp = Math.abs(diff) >= 10
      ? `🔍 Nas noites que tu largou o celular 30 min+ antes, dormiu ${scrDur(ay)}; nas que foi até a hora, ${scrDur(an)}. ${diff > 0 ? `+${scrDur(diff)} de sono só de largar o dedão.` : "Curioso: aqui não fez diferença no tempo."}`
      : "🔍 Nas tuas noites, largar o celular mais cedo ainda não mudou muito o tempo de sono.";
  }
  const tiles = night ? [
    scrTile("📵 Largou", night.bed === null ? "--" : night.bed ? escapeHtml(scrDur(night.bed)) : "0 min", night.bed === null ? "sem dado da noite" : night.lastEnd ? `antes de dormir · ${escapeHtml(scrClockMs(night.lastEnd))}` : "", night.bed === null ? "" : night.bed >= SCREEN_BED_GOOD_MIN ? "text-green" : night.bed < 10 ? "text-coral" : ""),
    scrTile("🌅 Pegou", night.morning === null ? "--" : escapeHtml(scrDur(Math.max(0, night.morning))), night.firstAfter ? `depois de acordar · ${escapeHtml(scrClockMs(night.firstAfter))}` : "", night.morning === null ? "" : night.morning >= SCREEN_MORNING_GOOD_MIN ? "text-green" : night.morning <= 5 ? "text-coral" : ""),
    scrTile("🌙 Madruga", `${night.wake}x`, night.wake ? escapeHtml(scrDur(night.wakeMin)) : "dormiu em paz", night.wake >= 2 ? "text-coral" : "text-green"),
  ].join("") : "";
  return `${title}
    <div class="card">
      ${night ? `<div class="toba-stats is-3">${tiles}</div>` : `<p class="watch-muted">Essa noite ficou sem o sono do relógio ou sem o tempo de tela.</p>`}
      ${strip.some((x) => x.v !== null) ? `<div class="wx-sub">📵 Quanto antes de dormir largou o celular (14 noites)</div>${scrDayBars(strip, { line: SCREEN_BED_GOOD_MIN, label: "Folga antes de dormir", hint: "👆 Toca numa noite" })}<div class="watch-an-legend"><span><i class="wx-key-bar" style="background:var(--scr)"></i>30 min+ (bom)</span><span><i class="wx-key-bar" style="background:var(--coral)"></i>menos que 30 min</span></div>` : ""}
      ${cmp ? `<p class="watch-muted">${escapeHtml(cmp)}</p>` : ""}
    </div>`;
}

/* ---------------- 🧠 Raio-X do vício ---------------- */

function scrHabits(date) {
  const days7 = scrLastDays(date, 7, true);
  if (!days7.length) return "";
  const fa = {}, nn = {};
  let faTot = 0, nTot = 0, unl = 0, checks = 0, dives = 0, sessN = 0, sessApp = 0;
  const diveBy = {};
  days7.forEach((dd) => {
    const d = screenDay(dd) || {};
    Object.entries(d.fa || {}).forEach(([p, c]) => { fa[p] = (fa[p] || 0) + Number(c); faTot += Number(c); });
    Object.entries(d.n || {}).forEach(([p, c]) => { nn[p] = (nn[p] || 0) + Number(c); nTot += Number(c); });
    unl += Number(d.u) || 0;
    scrSessions(dd).forEach((x) => {
      if (x.app <= 0) return;
      sessN++;
      sessApp += x.app;
      if (x.u && x.app < SCR_CHECK_SEC) checks++;
      if (x.app >= SCR_DIVE_MIN * 60) { dives++; if (x.pkg) diveBy[x.pkg] = (diveBy[x.pkg] || 0) + x.app / 60; }
    });
  });
  const n = days7.length;
  const door = Object.entries(fa).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const pokes = Object.entries(nn).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const hole = Object.entries(diveBy).sort((a, b) => b[1] - a[1])[0];
  const doorHtml = door.length && faTot ? door.map(([p, c]) => `<div class="scr-mini-row">${scrIcon(p, "sm")}<span>${escapeHtml(screenAppName(p))}</span><b>${Math.round((c / faTot) * 100)}%</b></div>`).join("") : "";
  const pokeHtml = pokes.length ? pokes.map(([p, c]) => `<div class="scr-mini-row">${scrIcon(p, "sm")}<span>${escapeHtml(screenAppName(p))}</span><b>${scrInt(c / n)}/dia</b></div>`).join("") : "";
  return `${scrTitle("🧠 Raio-X do vício", "habits")}
    <div class="card">
      <div class="toba-stats is-3">
        ${scrTile("⚡ Checadas", scrInt(checks / n), "por dia (menos de 1 min)")}
        ${scrTile("🕳️ Mergulho", scrInt(dives / n), `por dia (${SCR_DIVE_MIN} min+)`, dives / n >= 3 ? "text-coral" : "")}
        ${scrTile("🧲 Sessão", sessN ? escapeHtml(scrDur(sessApp / sessN / 60)) : "--", `${scrInt(sessN / n)} por dia`)}
      </div>
      ${hole ? `<p class="watch-muted">🕳️ Buraco negro da semana: ${escapeHtml(screenAppName(hole[0]))}, ${escapeHtml(scrDur(hole[1]))} só em mergulhos de ${SCR_DIVE_MIN} min+.</p>` : ""}
      ${doorHtml ? `<div class="wx-sub">🚪 Porta de entrada: o 1º app depois de desbloquear</div>${doorHtml}<p class="watch-muted scr-small">É o app que tu abre no automático. Tira ele da tela inicial e vê o que acontece. 😏</p>` : ""}
      ${pokeHtml ? `<div class="wx-sub">🔔 Quem mais te cutuca (${scrInt(nTot / n)} notificações/dia${unl ? ` · ${(nTot / Math.max(1, unl)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por desbloqueio` : ""})</div>${pokeHtml}<p class="watch-muted scr-small">Notificação que fez barulho ou apareceu na tela. Silenciar as 2 primeiras já corta um monte de pegada.</p>` : ""}
      <p class="watch-muted scr-small">Últimos ${n} dias com dado.</p>
    </div>`;
}

/* ---------------- 📈 Tá melhorando? ---------------- */

function scrTrend(date) {
  const wd = new Date(`${date}T12:00:00`).getDay();
  const mon = screenAddDays(date, -((wd + 6) % 7));
  const sumRange = (from, to) => {
    let s = 0, c = 0;
    for (let dd = from; dd <= to; dd = screenAddDays(dd, 1)) { const v = scrMin(dd); if (v !== null) { s += v; c++; } }
    return c ? { avg: s / c, n: c } : null;
  };
  const cur = sumRange(mon, date);
  const prev = sumRange(screenAddDays(mon, -7), screenAddDays(date, -7));
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const m = screenAddDays(mon, -7 * i);
    const end = i === 0 ? date : screenAddDays(m, 6);
    const r = sumRange(m, end);
    weeks.push({ label: `${m.slice(8, 10)}/${m.slice(5, 7)}`, v: r ? r.avg : null, hi: i === 0, tip: r ? `Semana de ${m.slice(8, 10)}/${m.slice(5, 7)}: ${scrDur(r.avg)}/dia (${r.n} dias)` : "sem dado" });
  }
  const wdAvg = SCR_ORDER.map((w) => {
    let s = 0, c = 0;
    for (let i = 1; i <= 84; i++) {
      const dd = screenAddDays(date, -i);
      if (new Date(`${dd}T12:00:00`).getDay() !== w) continue;
      const v = scrMin(dd);
      if (v !== null) { s += v; c++; }
    }
    return { label: SCR_WD[w], v: c >= 2 ? s / c : null, hi: w === wd, tip: c >= 2 ? `${SCR_WD_LONG[w]}: ${scrDur(s / c)} em média (${c} dias)` : "sem dado" };
  });
  const a7 = scrAvg(screenAddDays(date, 1), 7), b7 = scrAvg(screenAddDays(date, -6), 7);
  let verdict = "";
  if (a7 !== null && b7 !== null) {
    const pct = ((a7 - b7) / b7) * 100;
    verdict = pct <= -5 ? `📉 Melhorando: ${Math.round(-pct)}% menos tela nos últimos 7 dias que nos 7 antes. Bora manter. 👊` : pct >= 5 ? `📈 Piorando: ${Math.round(pct)}% mais tela que nos 7 dias antes. O dedão tá ganhando a guerra.` : "➡️ Estável: os últimos 7 dias tão iguaizinhos aos 7 antes.";
  }
  if (!weeks.some((w) => w.v !== null)) return "";
  const dd = cur && prev ? scrDelta(cur.avg, prev.avg) : null;
  return `${scrTitle("📈 Tá melhorando?", "trend")}
    <div class="card">
      ${verdict ? `<p class="scr-verdict">${escapeHtml(verdict)}</p>` : ""}
      <div class="toba-stats is-3">
        ${scrTile("🗓️ Semana", cur ? escapeHtml(scrDur(cur.avg)) : "--", "por dia")}
        ${scrTile("Passada", prev ? escapeHtml(scrDur(prev.avg)) : "--", "até o mesmo dia")}
        ${scrTile("Diferença", dd ? dd.txt : "--", "", dd ? dd.cls : "")}
      </div>
      <div class="wx-sub">📊 Média por dia, semana a semana</div>
      ${scrDayBars(weeks, { label: "Semanas", hint: "👆 Toca numa semana" })}
      ${wdAvg.filter((x) => x.v !== null).length >= 4 ? `<div class="wx-sub">📅 Dia da semana (12 semanas)</div>${scrDayBars(wdAvg, { label: "Dia da semana", hint: "👆 Toca num dia" })}` : ""}
    </div>`;
}

/* ---------------- 🧮 Tua vida em tela ---------------- */

function scrLife(date) {
  const a = scrAvg(screenAddDays(date, 1), 30);
  if (a === null) return "";
  const yearH = (a * 365) / 60;
  const days = yearH / 24;
  const awakePct = (a / SCR_AWAKE_MIN) * 100;
  const apps = scrSumApps(scrLastDays(date, 30, true));
  const funTop = Object.entries(apps).filter(([p]) => screenCat(screenCatOf(p)).kind === "fun").sort((x, y) => y[1] - x[1])[0];
  const eq = [
    `📚 ${scrInt(yearH / 6)} livros`,
    `🎬 ${scrInt(yearH / 2)} filmes`,
    `🚶 ${scrInt(yearH * 5)} km andando`,
    `☕ ${scrInt((yearH * 60) / 4)} cafés na V60`,
  ];
  return `${scrTitle("🧮 Tua vida em tela", "life")}
    <div class="card scr-life">
      <p class="scr-life-big">Nesse ritmo são <b>${scrInt(days)} dias inteiros</b> por ano no celular.</p>
      <p class="watch-muted">${escapeHtml(`É ${Math.round(awakePct)}% do teu tempo acordado (média de ${scrDur(a)}/dia nos últimos 30 dias). Dava pra: ${eq.join(" · ")}.`)}</p>
      ${funTop ? `<p class="watch-muted">${escapeHtml(`✂️ Cortando 30 min por dia do ${screenAppName(funTop[0])} tu ganha ${scrInt((30 * 365) / 60)} horas por ano. Tipo ${scrInt((30 * 365) / 60 / 24)} dias de férias. 🏖️`)}</p>` : ""}
    </div>`;
}

/* ---------------- Tela ---------------- */

function renderScreen() {
  renderScreenConnect();
  renderScreenDayNav();
  renderScreenSyncLine();
  const body = document.getElementById("screenBody");
  if (!body) return;
  const date = scrSel();
  if (!scrUi.month) scrUi.month = date.slice(0, 7);
  const has = Object.keys(screenDays()).length > 0;
  if (!has) {
    body.innerHTML = "";
    return;
  }
  const facts = screenDay(date) ? `<div class="toba-stats is-3 watch-an-stats">${scrCompareTiles(date).join("")}</div><div class="toba-stats scr-facts">${scrDayFacts(date).join("")}</div>` : "";
  body.innerHTML = [
    scrHero(date),
    facts,
    scrCloba(date),
    scrRanking(date),
    scrCats(date),
    scrHours(date),
    scrHeatCard(date),
    scrMonthCard(date),
    scrSleepCard(date),
    scrHabits(date),
    scrTrend(date),
    scrLife(date),
  ].join("");
}

/* ---------------- 📱 Folha do app ---------------- */

function scrOpenApp(el) {
  const pkg = el && el.dataset ? el.dataset.id : scrUi.app;
  if (!pkg) return;
  scrUi.app = pkg;
  renderScrApp();
  openTobaModal("screenAppModal");
}

function renderScrApp() {
  const pkg = scrUi.app;
  const date = scrSel();
  const body = document.getElementById("screenAppBody");
  document.getElementById("screenAppTitle").innerHTML = `${scrIcon(pkg)} ${escapeHtml(screenAppName(pkg))}`;
  const get = (dd) => { const d = screenDay(dd); return d && d.a ? Number(d.a[pkg] || 0) / 60 : d ? 0 : null; };
  const v = get(date) || 0;
  const a7 = scrAvg(date, 7, get), a30 = scrAvg(date, 30, get);
  const rows = [];
  for (let i = 13; i >= 0; i--) {
    const dd = screenAddDays(date, -i);
    const x = get(dd);
    rows.push({ label: dd.slice(8, 10), v: x, hi: dd === date, tip: `${scrWeekday(dd)}, ${dd.slice(8, 10)}/${dd.slice(5, 7)} · ${x === null ? "sem dado" : scrDur(x)}` });
  }
  const lim = scrLimit(pkg);
  // hora a hora desse app (28 dias, só os dias com o detalhe)
  const hs = Array(24).fill(0);
  let hn = 0;
  for (let i = 0; i < 28; i++) {
    const d = screenDay(screenAddDays(date, -i));
    if (!d || !d.ah) continue;
    hn++;
    const arr = d.ah[pkg];
    if (Array.isArray(arr)) arr.forEach((s, h) => { hs[h] += Number(s) / 60; });
  }
  const havg = hs.map((s) => (hn ? s / hn : 0));
  const hbars = hn >= 3 && havg.some((x) => x > 0) ? scrHourBars(havg, null, { label: "Hora a hora do app", fmt: (x) => `${scrDur(x)} em média` }) : "";
  const peak = havg.reduce((b, x, h) => (x > havg[b] ? h : b), 0);
  let door = 0, doorTot = 0, pokes = 0, nd = 0, longest = null;
  scrLastDays(date, 7, true).forEach((dd) => {
    const d = screenDay(dd) || {};
    Object.entries(d.fa || {}).forEach(([p, c]) => { doorTot += Number(c); if (p === pkg) door += Number(c); });
    pokes += Number((d.n || {})[pkg] || 0);
    nd++;
    scrSessions(dd).forEach((x) => { if (x.pkg === pkg && (!longest || x.app > longest.app)) longest = x; });
  });
  const cur = screenCatOf(pkg);
  const dd7 = scrDelta(v, a7);
  body.innerHTML = `
    <div class="toba-stats is-3">
      ${scrTile(date === scrToday() ? "Hoje" : "No dia", escapeHtml(scrDur(v)), lim ? (v > lim ? `⛔ passou ${escapeHtml(scrDur(v - lim))}` : `🎯 sobra ${escapeHtml(scrDur(lim - v))}`) : "", lim && v > lim ? "text-coral" : "")}
      ${scrTile("7 dias", a7 !== null ? escapeHtml(scrDur(a7)) : "--", a7 !== null ? `${dd7.txt} · média` : "", dd7.cls)}
      ${scrTile("30 dias", a30 !== null ? escapeHtml(scrDur(a30)) : "--", a30 !== null ? `≈ ${scrInt((a30 * 365) / 60)} h/ano` : "")}
    </div>
    <div class="wx-sub">📈 14 dias</div>
    ${scrDayBars(rows, { line: lim || 0, label: "14 dias do app" })}
    ${hbars ? `<div class="wx-sub">🕐 Quando tu usa (média de ${hn} dias)</div>${hbars}<p class="watch-muted">⏰ Hora preferida: ${peak}h às ${peak + 1}h.</p>` : ""}
    <div class="toba-stats is-3">
      ${scrTile("🚪 Porta", doorTot ? `${Math.round((door / doorTot) * 100)}%` : "--", "dos desbloqueios (7 dias)")}
      ${scrTile("🔔 Cutuca", nd ? scrInt(pokes / nd) : "--", "por dia")}
      ${scrTile("🕳️ Maior", longest ? escapeHtml(scrDur(longest.app / 60)) : "--", longest ? escapeHtml(`${scrDayLabel(toIsoDate(new Date(longest.start)))} ${scrClockMs(longest.start)}`) : "7 dias")}
    </div>
    <div class="card-title">🎯 Limite por dia</div>
    <div class="watch-chips">
      <button type="button" class="chip-btn${!lim ? " is-on" : ""}" data-click="scrSetLimit" data-value="0">🆓 Sem limite</button>
      ${SCREEN_LIMITS.map((m) => `<button type="button" class="chip-btn${m === lim ? " is-on" : ""}" data-click="scrSetLimit" data-value="${m}">${scrDur(m)}</button>`).join("")}
    </div>
    <div class="card-title">🏷️ Categoria</div>
    <div class="watch-chips">
      ${SCREEN_CATS.map((c) => `<button type="button" class="chip-btn${c.key === cur ? " is-on" : ""}" data-click="scrSetCat" data-value="${c.key}">${c.icon} ${escapeHtml(c.name)}</button>`).join("")}
    </div>
    <p class="watch-muted scr-small">${escapeHtml(pkg)}</p>`;
}

/* ---------------- 🎯 Meta ---------------- */

function openScreenGoal() {
  closeTobaModal("settingsModal");
  renderScreenGoal();
  openTobaModal("screenGoalModal");
}

function renderScreenGoal() {
  const el = document.getElementById("screenGoalChips");
  if (!el) return;
  const cur = Number(screenDb().goal) || 0;
  const auto = calcScreenGoal({ screen: { ...screenDb(), goal: 0 } }, scrToday());
  el.innerHTML = `<button type="button" class="chip-btn${!cur ? " is-on" : ""}" data-click="scrSetGoal" data-value="0">🧠 Automática (${scrDur(auto.goal)})</button>`
    + SCREEN_GOALS.map((m) => `<button type="button" class="chip-btn${m === cur ? " is-on" : ""}" data-click="scrSetGoal" data-value="${m}">${scrDur(m)}</button>`).join("");
}

/* ---------------- ❔ ---------------- */

const SCR_HELP = {
  cloba: ["❔ 🤡 Papo reto do Cloba", [
    ["🧠 De onde vem", "O Cloba olha o dia escolhido: quem comeu teu tempo, se tu vai estourar a meta no ritmo de sempre, quanta diversão, desbloqueios, o maior mergulho e a noite (do 🩻 Raio-X)."],
    ["🎯 Meta", "A 🎯 automática é a mediana dos teus 28 dias antes −10%: sempre um passinho abaixo do teu normal. Na ⚙️ › 🎯 Meta de tela dá pra fixar uma."],
  ]],
  rank: ["❔ 🏆 Ranking dos apps", [
    ["⏱️ O tempo", "Tempo com o app aberto NA TELA (igual o Bem-estar digital). A tela inicial e a barra do sistema não contam."],
    ["🎯 Limite", "Toca no app pra pôr um limite por dia. O risquinho na barra é o limite; passou, a barra fica vermelha."],
    ["🏷️ Categoria", "O Toba chuta pela loja do Android e pelo nome. Errou? Toca no app e escolhe."],
  ]],
  cats: ["❔ 🧩 Pra onde foi o tempo", [
    ["🍿 Diversão", "Vídeo, social, jogos e notícias: o que é feito pra te prender."],
    ["🛠️ Útil", "Mapas, trampo, banco, compras e o Toba. 😏"],
    ["😐 Neutro", "Música, navegador, fotos, sistema e o resto."],
  ]],
  hours: ["❔ 🕐 Hora a hora", [
    ["📊 As barras", "Tempo de tela (ou desbloqueios) em cada hora do dia. A linha tracejada é o teu normal de cada hora nos 28 dias antes."],
    ["🔴 Vermelho", "Hora bem acima do teu normal (50% a mais)."],
    ["🦉 Madrugada", "Uso de 0h às 5h fica no dia em que aconteceu."],
  ]],
  heat: ["❔ 🗺️ Mapa de calor", [
    ["🗺️ Como ler", "Cada linha é um dia da semana, cada coluna uma hora. A cor é a média das últimas 8 semanas: quanto mais forte, mais celular naquela hora."],
    ["🚨 Zona vermelha", "As 3 horas mais pesadas da tua semana. É ali que dá pra cortar com o menor esforço: celular em outro cômodo, modo foco, app fora da tela inicial."],
    ["🔓 Desbloqueios", "Troca pra ver quantas vezes tu pega o celular em vez de quanto tempo fica."],
  ]],
  month: ["❔ 🗓️ Mapa do mês", [
    ["🟪 Quadradinhos", "Um por dia. Mais forte = mais tempo de tela (comparado com o dia mais pesado do mês)."],
    ["✓ Na meta", "Dia fechado dentro da 🎯 ganha o contorno verde."],
    ["👆 Tocar", "Um toque mostra o número; tocar de novo no mesmo dia abre ele na tela."],
  ]],
  sleep: ["❔ 😴 Celular x sono", [
    ["📵 Antes de dormir", "Quanto tempo entre a última vez no celular e a hora que o relógio viu tu pegando no sono. 30 min+ é o que os médicos do sono pedem."],
    ["🌅 Depois de acordar", "Quanto tempo depois de acordar tu desbloqueou e abriu um app."],
    ["🌙 Madrugada", "Vezes que desbloqueou no meio da noite (entre dormir e acordar)."],
    ["🔍 Com x sem", "Compara o sono das noites com 30 min+ sem celular contra as que foram até a hora (60 dias, 4+ noites de cada lado)."],
  ]],
  habits: ["❔ 🧠 Raio-X do vício", [
    ["⚡ Checadas", "Desbloqueou e saiu em menos de 1 min: aquela olhadinha no automático."],
    ["🕳️ Mergulhos", `Ficou ${SCR_DIVE_MIN} min+ seguidos em app. O buraco negro é o app com mais tempo em mergulho.`],
    ["🚪 Porta de entrada", "O primeiro app que tu abre depois de desbloquear. É o hábito mais forte do teu dedão."],
    ["🔔 Cutucadas", "Notificações que fizeram barulho, vibraram ou apareceram na tela (o Android só conta essas)."],
  ]],
  trend: ["❔ 📈 Tá melhorando?", [
    ["📉 O veredito", "Média dos últimos 7 dias contra os 7 de antes. Menos tela = melhorando."],
    ["🗓️ Semana", "Essa semana (seg até o dia escolhido) contra a passada até o mesmo dia."],
    ["📅 Dia da semana", "Média de cada dia da semana nas últimas 12 semanas."],
  ]],
  life: ["❔ 🧮 Tua vida em tela", [
    ["🧮 A conta", "Média dos últimos 30 dias × 365. Acordado = 16 h por dia. Livro = 6 h, filme = 2 h, caminhada a 5 km/h, café na V60 = 4 min."],
  ]],
};

function scrHelp(el) {
  const h = SCR_HELP[el && el.dataset.help];
  if (!h) return;
  document.getElementById("screenHelpTitle").textContent = h[0];
  document.getElementById("screenHelpBody").innerHTML = h[1].map(([t, p]) => `<div class="watch-help-sec"><div class="watch-help-h">${escapeHtml(t)}</div><p>${escapeHtml(p)}</p></div>`).join("");
  openTobaModal("screenHelpModal");
}

function scrDiag() {
  closeTobaModal("settingsModal");
  const st = screenState();
  const dg = st.diag || {};
  const days = Object.keys(screenDays()).sort();
  const status = screenCanNative() ? (screenReadStatus(), screenGranted() ? "✅ Acesso ao uso liberado" : "🔒 Acesso ao uso desligado") : "📵 Sem o APK 3.1 (navegador ou APK antigo)";
  const msg = [
    status,
    dg.at ? `Última leitura: ${scrAgo(dg.at)} (${dg.from} até ${dg.to}, ${dg.days} dias, ${scrInt(dg.events)} eventos)` : "Ainda não leu nada.",
    dg.oldest ? `O Android guardava desde: ${new Date(dg.oldest).toLocaleString("pt-BR")}` : "",
    days.length ? `Guardado no Toba: ${days.length} dias (${days[0]} até ${days[days.length - 1]})` : "",
  ].filter(Boolean).join("\n\n");
  showPageMessage(msg, { title: "🩺 Diagnóstico do Screen", icon: "📱" });
}

/* ---------------- Ações ---------------- */

tobaActions({
  screenPull() {
    if (!screenCanNative()) {
      showPageMessage("Quem lê o tempo de tela é o app do Toba (APK 3.1). Instala pelo KingInstaller e volta aqui.", { title: "📱 Toba Screen", icon: "📲" });
      return;
    }
    screenReadStatus();
    if (!screenGranted()) return TOBA_NATIVE.screenAsk && TOBA_NATIVE.screenAsk();
    screenPull({ quiet: false });
  },
  screenAskAccess() {
    if (screenCanNative() && typeof TOBA_NATIVE.screenAsk === "function") TOBA_NATIVE.screenAsk();
  },
  screenAskFromSettings() {
    closeTobaModal("settingsModal");
    if (screenCanNative() && typeof TOBA_NATIVE.screenAsk === "function") TOBA_NATIVE.screenAsk();
    else showPageMessage("Só no app do Toba (APK 3.1).", { title: "🔐 Acesso ao uso", icon: "📱" });
  },
  scrDayStep(el) {
    scrSetDate(screenAddDays(scrSel(), Number(el.dataset.step) || 0));
  },
  scrGoToday() {
    scrSetDate(scrToday());
  },
  scrOpenPicker() {
    const input = document.getElementById("scrDateInput");
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch (err) {
      input.focus();
      input.click();
    }
  },
  scrPickDate(el) {
    if (el.value) scrSetDate(el.value);
  },
  scrTip,
  scrHelp,
  scrOpenApp,
  scrToggleAll() {
    scrUi.showAll = !scrUi.showAll;
    renderScreen();
  },
  scrHourMode(el) {
    scrUi.hourMode = el.dataset.mode;
    renderScreen();
  },
  scrHeatMode(el) {
    scrUi.heatMode = el.dataset.mode;
    renderScreen();
  },
  scrMonthStep(el) {
    const ym = scrUi.month || scrSel().slice(0, 7);
    const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + (Number(el.dataset.step) || 0), 1);
    scrUi.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    renderScreen();
  },
  scrCalTap(el) {
    if (el.classList.contains("is-sel") || el.classList.contains("is-picked")) {
      scrUi.date = el.dataset.id;
      renderScreen();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const wrap = el.closest(".wx-tipwrap");
    if (wrap) wrap.querySelectorAll(".is-picked").forEach((x) => x.classList.remove("is-picked"));
    el.classList.add("is-picked");
    const tip = wrap && wrap.querySelector(".watch-chart-tip");
    if (tip) {
      tip.classList.remove("is-hint");
      tip.textContent = `${el.dataset.tip} · toca de novo pra abrir`;
    }
  },
  scrSetLimit(el) {
    const s = screenEnsureDb();
    const v = Number(el.dataset.value) || 0;
    if (!s.limits || typeof s.limits !== "object") s.limits = {};
    if (v) s.limits[scrUi.app] = v;
    else delete s.limits[scrUi.app];
    saveHealthDb();
    renderScrApp();
    renderScreen();
  },
  scrSetCat(el) {
    const s = screenEnsureDb();
    const pkg = scrUi.app;
    s.apps[pkg] = { ...(s.apps[pkg] || {}), cat: el.dataset.value };
    saveHealthDb();
    renderScrApp();
    renderScreen();
  },
  openScreenGoal,
  scrSetGoal(el) {
    const s = screenEnsureDb();
    const v = Number(el.dataset.value) || 0;
    if (v) s.goal = v;
    else delete s.goal;
    saveHealthDb();
    renderScreenGoal();
    renderScreen();
  },
  scrDiag,
});

function onHealthDataReplaced() {
  renderScreen();
}

window.onTobaAppResume = function () {
  screenReadStatus();
  const at = Number(screenState().pulledAt) || 0;
  if (screenGranted() && Date.now() - at > SCREEN_AUTO_MIN * 60000) screenPull({ quiet: true });
  screenOnPullState();
  renderScreen();
};

document.addEventListener("DOMContentLoaded", () => {
  scrUi.date = scrToday();
  scrUi.month = scrUi.date.slice(0, 7);
  screenOnPullState();
  renderScreen();
  window.onTobaAppResume();
  screenFetchIcons();
});
