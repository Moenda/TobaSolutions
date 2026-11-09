/*
 * Toba Health · 🩻 Raio-X · 👟 Passos turbinados (v2.01)
 *
 * Pedido do Rafa (2026-11-08): "faz o REVAMP DOS PASSOS: análises fodas, comparativos, se baseia
 * no do sono; queremos sempre o ULTRA RAIO LASER DE DADOS E ESTATÍSTICAS".
 *
 * A aba Dia da análise do 👟 (relogio-analise.js chama renderWatchStepsDay) vira a tela do dia:
 *   herói (passos, km, ativas, andares, anel da meta, 🔮 quanto fecha hoje) · vs ontem/7/30 ·
 *   14 dias com toque · 🤡 O Cloba sobre os passos · 🔥 Sequência e a semana (bolinhas seg-dom) ·
 *   🧩 De onde vieram (treino x dia a dia) · 📏 Passada · 📅 Teu dia da semana · 🗓️ O mês
 *   (projeção) · 🔍 O que mexe nos teus passos (também na Semana/Mês, no lugar do 🔬 Raio laser).
 * Explicações só no ❔ (WSL_HELP de relogio-sono.js, mesmo modal). Só LÊ watch.days.
 */

const WPS_DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WPS_DAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function wpsSteps(date) {
  const d = watchDay(date);
  const v = d ? Number(d.steps) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function wpsAvg(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}

// 🔮 Quanto fecha hoje: o que já andou + o resto do dia no TEU ritmo normal (média de 30 dias).
// (A conta antiga só esticava o ritmo de agora: às 10h com 5.700 dava "fecha em 27.600".)
function wpsProjection(date) {
  if (date !== toIsoDate()) return null;
  const steps = wpsSteps(date) || 0;
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const f = Math.max(0, Math.min(1, (h - 7) / 16)); // dia "ativo" das 7h às 23h
  if (f >= 0.97) return null;
  const n30 = watchMetricAvg("steps", watchAddDays(date, -1), 30, 5);
  if (n30 === null) return null;
  return Math.round((steps + (1 - f) * n30) / 100) * 100;
}

function wpsStreak(date, goal) {
  let cur = 0;
  // hoje ainda aberto e sem meta: conta a sequência até ontem
  let d = date;
  if (date === toIsoDate() && !((wpsSteps(date) || 0) >= goal)) d = watchAddDays(date, -1);
  while ((wpsSteps(d) || 0) >= goal) {
    cur++;
    d = watchAddDays(d, -1);
  }
  let best = 0, run = 0;
  for (let i = 364; i >= 0; i--) {
    if ((wpsSteps(watchAddDays(date, -i)) || 0) >= goal) { run++; best = Math.max(best, run); } else run = 0;
  }
  return { cur, best };
}

// Segunda-feira da semana de `date`
function wpsMonday(date) {
  const wd = new Date(`${date}T12:00:00`).getDay();
  return watchAddDays(date, -((wd + 6) % 7));
}

function wpsHero(date) {
  const d = watchDay(date) || {};
  const goal = watchGoals().steps;
  const v = wpsSteps(date);
  const pct = v ? Math.round((v / goal) * 100) : 0;
  const isToday = date === toIsoDate();
  const proj = wpsProjection(date);
  const bits = [d.distanceM ? watchKm(d.distanceM) : "", d.activeKcal ? `${watchInt(d.activeKcal)} kcal ativas` : "", d.floors ? `${watchInt(d.floors)} andares` : ""].filter(Boolean);
  let line;
  if (!v) line = isToday ? "Ainda sem passos hoje. Bora? 👟" : "Sem passos nesse dia.";
  else if (v >= goal) line = `🏆 Meta batida${v >= goal * 1.5 ? " com folga" : ""}: +${watchInt(v - goal)} além dos ${watchInt(goal)}.`;
  else line = `Faltam ${watchInt(goal - v)} pra meta de ${watchInt(goal)}${isToday ? "" : " (ficou devendo)"}.`;
  return `<div class="card wsl-hero wps-hero">
      <div class="wsl-hero-top">
        <div class="wsl-hero-main">
          <div class="wsl-hero-val" style="color:var(--green)">${v ? escapeHtml(watchInt(v)) : "--"}</div>
          <div class="wsl-hero-sub">passos${isToday ? " até agora" : ""}${bits.length ? ` · ${escapeHtml(bits.join(" · "))}` : ""}</div>
          ${proj && proj > (v || 0) ? `<div class="wsl-hero-clock">🔮 No teu ritmo, fecha em ~${escapeHtml(watchInt(proj))}${proj >= goal && (v || 0) < goal ? " (dá meta!)" : ""}</div>` : ""}
        </div>
        <div class="wsl-hero-score">${wslRing(Math.min(100, pct), v >= goal ? "is-good" : pct >= 60 ? "is-ok" : "is-bad")}<small>${pct}% da meta</small></div>
      </div>
      <p class="watch-muted">${escapeHtml(line)}</p>
    </div>`;
}

function wpsClobaLines(date) {
  const lines = [];
  const m = WATCH_METRICS.steps;
  lines.push(...watchAnDayCloba("steps", m, date).filter((l) => !/No ritmo de agora/.test(l)));
  const goal = watchGoals().steps;
  const st = wpsStreak(date, goal);
  if (st.cur >= 3) lines.push(`🔥 ${st.cur} dias seguidos na meta${st.cur >= st.best ? ": é o teu recorde de sequência!" : ` (o recorde é ${st.best})`}. Não deixa apagar.`);
  const d = watchDay(date) || {};
  const v = wpsSteps(date);
  // sono x passos do dia
  const s = typeof wslNight === "function" ? wslNight(date) : null;
  if (s && v && s.min < 360 && v < goal) lines.push(`😴 Dormiu ${watchHours(s.min)} na noite: dia de pouco sono costuma ser dia de pouco passo. Cama cedo hoje ajuda amanhã.`);
  // treino
  const exSteps = (Array.isArray(d.ex) ? d.ex : []).reduce((a, x) => a + (Number(x.steps) || 0), 0);
  if (v && exSteps >= v * 0.5) lines.push(`🏃 ${Math.round((exSteps / v) * 100)}% dos passos vieram do treino. O dia a dia ficou parado: subir escada e ir a pé até a padaria contam.`);
  return lines.slice(0, 4);
}

// 🔥 Sequência + a semana em bolinhas (seg a dom)
function wpsWeek(date) {
  const goal = watchGoals().steps;
  const mon = wpsMonday(date);
  const dots = [];
  let tot = 0, prevTot = 0;
  for (let i = 0; i < 7; i++) {
    const dd = watchAddDays(mon, i);
    const v = wpsSteps(dd);
    const future = dd > date;
    if (!future) {
      tot += v || 0;
      prevTot += wpsSteps(watchAddDays(dd, -7)) || 0;
    }
    const cls = future ? "is-future" : v && v >= goal ? "is-hit" : v ? "is-miss" : "is-empty";
    dots.push(`<div class="wps-dot ${cls}${dd === date ? " is-sel" : ""}"><i>${future ? "" : v && v >= goal ? "✓" : ""}</i><span>${WPS_DAYS[(i + 1) % 7]}</span><small>${!future && v ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : ""}</small></div>`);
  }
  const st = wpsStreak(date, goal);
  const diff = prevTot ? ((tot - prevTot) / prevTot) * 100 : null;
  const hits = Array.from({ length: 7 }, (_, i) => watchAddDays(mon, i)).filter((dd) => dd <= date && (wpsSteps(dd) || 0) >= goal).length;
  return `<div class="section-title wsl-title">🔥 Sequência e semana ${wslQ("steps-week")}</div>
    <div class="card">
      <div class="wps-dots">${dots.join("")}</div>
      <div class="toba-stats is-3">
        ${watchAnTile("🔥 Seguidos", `${st.cur} ${st.cur === 1 ? "dia" : "dias"}`, `recorde ${st.best}`)}
        ${watchAnTile("✅ Na meta", `${hits} de ${Math.min(7, Math.round((new Date(`${date}T12:00:00`) - new Date(`${mon}T12:00:00`)) / 86400000) + 1)}`, "nessa semana")}
        ${watchAnTile("📊 Semana", escapeHtml(watchInt(tot)), diff === null ? "" : `${diff >= 0 ? "+" : "−"}${Math.abs(Math.round(diff))}% x semana passada`, diff === null ? "" : diff >= 0 ? "text-green" : "text-coral")}
      </div>
    </div>`;
}

// 🧩 De onde vieram: treino (Health Connect manda os passos de cada exercício) x dia a dia
function wpsOrigin(date) {
  const d = watchDay(date) || {};
  const v = wpsSteps(date);
  if (!v) return "";
  const ex = (Array.isArray(d.ex) ? d.ex : []).filter((x) => Number(x.steps) > 0);
  const exSteps = Math.min(v, ex.reduce((a, x) => a + Number(x.steps), 0));
  const life = v - exSteps;
  const pe = Math.round((exSteps / v) * 100);
  const list = ex.map((x) => `<div class="kv-row"><span>${escapeHtml(typeof watchExName === "function" ? watchExName(x) : "🏅 Treino")} <small class="watch-muted">${watchClock(x.start)}</small></span><strong>${escapeHtml(watchInt(x.steps))}${x.distanceM ? ` <small>${escapeHtml(watchKm(x.distanceM))}</small>` : ""}</strong></div>`).join("");
  return `<div class="section-title wsl-title">🧩 De onde vieram ${wslQ("steps-origin")}</div>
    <div class="card">
      ${exSteps ? `<div class="wps-split" role="img" aria-label="Treino ${pe}%, dia a dia ${100 - pe}%">
        ${exSteps ? `<span class="wps-split-ex" style="width:${pe}%"></span>` : ""}<span class="wps-split-life" style="width:${100 - pe}%"></span>
      </div>
      <div class="watch-an-legend"><span><i class="wps-key-ex"></i>🏃 treino ${escapeHtml(watchInt(exSteps))} (${pe}%)</span><span><i class="wps-key-life"></i>🚶 dia a dia ${escapeHtml(watchInt(life))}</span></div>` : ""}
      ${list ? `<div class="kv-list">${list}</div>` : `<p class="watch-muted">Nenhum treino com passos nesse dia: foi tudo no dia a dia.</p>`}
    </div>`;
}

// 📏 Passada e ritmo: cm por passo (km ÷ passos) x o teu normal, kcal por 1.000 passos
function wpsStride(date) {
  const d = watchDay(date) || {};
  const v = wpsSteps(date);
  if (!v || !(Number(d.distanceM) > 0)) return "";
  const cm = (d.distanceM / v) * 100;
  const hist = [];
  for (let i = 1; i <= 30; i++) {
    const x = watchDay(watchAddDays(date, -i));
    if (x && Number(x.steps) > 1000 && Number(x.distanceM) > 0) hist.push((x.distanceM / x.steps) * 100);
  }
  const base = hist.length >= 5 ? wpsAvg(hist) : null;
  const kcalK = Number(d.activeKcal) > 0 ? (d.activeKcal / v) * 1000 : null;
  const kmMonth = (() => {
    let sum = 0;
    for (let dd = `${date.slice(0, 8)}01`; dd <= date; dd = watchAddDays(dd, 1)) sum += Number((watchDay(dd) || {}).distanceM) || 0;
    return sum;
  })();
  return `<div class="section-title wsl-title">📏 Passada ${wslQ("steps-stride")}</div>
    <div class="card"><div class="toba-stats is-3">
      ${watchAnTile("👣 Passada", `${Math.round(cm)} cm`, base === null ? "por passo" : Math.abs(cm - base) < 2 ? "no teu normal" : `${cm > base ? "+" : "−"}${Math.round(Math.abs(cm - base))} cm x normal`)}
      ${watchAnTile("🔥 Gasto", kcalK === null ? "--" : `${Math.round(kcalK)} kcal`, "a cada 1.000 passos")}
      ${watchAnTile("🌍 No mês", escapeHtml(watchKm(kmMonth)), "andados até esse dia")}
    </div></div>`;
}

// 📅 Teu dia da semana (últimas 12 semanas) com o dia escolhido aceso
function wpsWeekdays(date) {
  const sums = Array(7).fill(0), cnt = Array(7).fill(0);
  for (let i = 0; i < 84; i++) {
    const dd = watchAddDays(date, -i);
    const v = wpsSteps(dd);
    if (!v || (dd === toIsoDate())) continue;
    const wd = new Date(`${dd}T12:00:00`).getDay();
    sums[wd] += v;
    cnt[wd]++;
  }
  const avgs = sums.map((s, i) => (cnt[i] >= 2 ? s / cnt[i] : null));
  if (avgs.filter((x) => x !== null).length < 5) return "";
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(...avgs.filter((x) => x !== null));
  const goal = watchGoals().steps;
  const selWd = new Date(`${date}T12:00:00`).getDay();
  const valid = order.filter((i) => avgs[i] !== null);
  const best = valid.reduce((a, i) => (avgs[i] > avgs[a] ? i : a), valid[0]);
  const worst = valid.reduce((a, i) => (avgs[i] < avgs[a] ? i : a), valid[0]);
  // SVG na mesma régua dos outros gráficos: barra = média, linha tracejada = meta
  const W = 340, H = 140, top = 16, bot = 18, padX = 4;
  const scale = Math.max(max, goal) * 1.05;
  const bw = (W - padX * 2) / 7;
  const y = (v) => top + (H - top - bot) * (1 - v / scale);
  const bars = order.map((i, k) => {
    const v = avgs[i];
    const x = padX + k * bw;
    const lbl = `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" class="wsl-axis${i === selWd ? " is-hi" : ""}" text-anchor="middle">${WPS_DAYS[i]}</text>`;
    if (v === null) return lbl;
    const cls = i === selWd ? "wps-wd-bar is-sel" : v >= goal ? "wps-wd-bar is-hit" : "wps-wd-bar";
    return `<rect x="${(x + bw * 0.18).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(H - bot - y(v)).toFixed(1)}" rx="4" class="${cls}" />
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" class="wsl-lvl" text-anchor="middle">${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k</text>${lbl}`;
  }).join("");
  const goalLine = `<line x1="${padX}" x2="${W - padX}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" class="wps-goal-line" />`;
  return `<div class="section-title wsl-title">📅 Teu dia da semana ${wslQ("steps-weekday")}</div>
    <div class="card">
      <svg class="wsl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Média de passos por dia da semana">${goalLine}${bars}</svg>
      <div class="watch-an-legend"><span><i class="wps-key-sel"></i>${escapeHtml(WPS_DAYS_LONG[selWd])}</span><span><i class="wps-key-hit"></i>na meta</span><span><i class="wps-key-goal"></i>meta ${escapeHtml(watchInt(goal))}</span></div>
      <p class="watch-muted">💪 ${escapeHtml(WPS_DAYS_LONG[best])} é teu dia mais ativo (${escapeHtml(watchInt(Math.round(avgs[best])))}); 🛋️ ${escapeHtml(WPS_DAYS_LONG[worst])} o mais parado (${escapeHtml(watchInt(Math.round(avgs[worst])))}). Últimas 12 semanas.</p>
    </div>`;
}

// 🗓️ O mês até esse dia x o mês passado até o mesmo dia + projeção do fechamento
function wpsMonth(date) {
  const first = `${date.slice(0, 8)}01`;
  const dim = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
  const dayN = Number(date.slice(8, 10));
  let tot = 0, days = 0, hit = 0;
  const goal = watchGoals().steps;
  for (let dd = first; dd <= date; dd = watchAddDays(dd, 1)) {
    const v = wpsSteps(dd);
    if (v) { tot += v; days++; if (v >= goal) hit++; }
  }
  if (!days) return "";
  const pm = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 2, 1);
  const pFirst = toIsoDate(pm);
  const pDim = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
  let pTot = 0;
  for (let i = 0; i < Math.min(dayN, pDim); i++) pTot += wpsSteps(watchAddDays(pFirst, i)) || 0;
  let pFull = 0;
  for (let i = 0; i < pDim; i++) pFull += wpsSteps(watchAddDays(pFirst, i)) || 0;
  const perDay = tot / dayN;
  const proj = Math.round((perDay * dim) / 1000) * 1000;
  const diff = pTot ? ((tot - pTot) / pTot) * 100 : null;
  const name = WATCH_MONTH_NAMES ? WATCH_MONTH_NAMES[Number(date.slice(5, 7)) - 1] : "";
  return `<div class="section-title wsl-title">🗓️ ${escapeHtml(name)} até aqui ${wslQ("steps-month")}</div>
    <div class="card">
      <div class="toba-stats is-3">
        ${watchAnTile("👟 No mês", escapeHtml(watchInt(tot)), `${hit} de ${dayN} dias na meta`)}
        ${watchAnTile(`⚖️ x ${escapeHtml((WATCH_MONTH_NAMES[pm.getMonth()] || "").slice(0, 3).toLowerCase())}`, diff === null ? "--" : `${diff >= 0 ? "+" : "−"}${Math.abs(Math.round(diff))}%`, pTot ? `até o dia ${dayN}: ${escapeHtml(watchInt(pTot))}` : "sem dado", diff === null ? "" : diff >= 0 ? "text-green" : "text-coral")}
        ${watchAnTile("🔮 Fecha em", dayN < dim ? `~${escapeHtml(watchInt(proj))}` : escapeHtml(watchInt(tot)), dayN < dim ? (pFull ? `${proj >= pFull ? "passa" : "não passa"} ${escapeHtml(watchInt(pFull))} do mês passado` : "no ritmo do mês") : "mês fechado")}
      </div>
    </div>`;
}

/* 🔍 O que mexe nos teus passos (últimos 90 dias): o dia com x sem cada coisa */
function wpsMoves(date) {
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const d = watchAddDays(date, -i);
    if (d === toIsoDate()) continue; // dia aberto não entra
    const v = wpsSteps(d);
    if (!v) continue;
    const x = watchDay(d) || {};
    const s = typeof wslNight === "function" ? wslNight(d) : null;
    const wd = new Date(`${d}T12:00:00`).getDay();
    const prevV = wpsSteps(watchAddDays(d, -1));
    const ready = typeof wslReadyParts === "function" && s ? wslReadyParts(d) : null;
    rows.push({
      v,
      sleep: s ? (s.min >= 420 ? true : s.min < 360 ? false : null) : null,
      wknd: wd === 0 || wd === 6,
      ex: Array.isArray(x.ex) && x.ex.length > 0,
      stress: Number.isFinite(Number(x.stress)) ? Number(x.stress) >= 50 : null,
      ready: ready && ready.parts.length >= 2 ? ready.total >= 70 : null,
      momentum: prevV ? prevV >= watchGoals().steps : null,
    });
  }
  if (rows.length < 14) return { rows, list: [] };
  const tests = [
    { k: "sleep", yes: "😴 Depois de dormir 7h+", no: "depois de menos de 6h" },
    { k: "ready", yes: "🔋 Prontidão 70+", no: "prontidão baixa" },
    { k: "ex", yes: "🏃 Dia com treino/caminhada", no: "sem treino" },
    { k: "momentum", yes: "🔥 Dia depois de bater a meta", no: "depois de dia fraco" },
    { k: "wknd", yes: "🎉 Sábado e domingo", no: "dia de semana" },
    { k: "stress", yes: "😰 Dia estressado (50+)", no: "dia tranquilo" },
  ];
  const list = [];
  tests.forEach((t) => {
    const a = rows.filter((r) => r[t.k] === true), b = rows.filter((r) => r[t.k] === false);
    if (a.length < 4 || b.length < 4) return;
    const va = wpsAvg(a.map((r) => r.v)), vb = wpsAvg(b.map((r) => r.v));
    const diff = va - vb;
    if (Math.abs(diff) < 800 && Math.abs(diff / vb) < 0.1) return;
    list.push({ ...t, diff, pct: (diff / vb) * 100, va, vb, na: a.length, nb: b.length });
  });
  list.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
  return { rows, list };
}

function wpsMovesHtml(date) {
  const m = wpsMoves(date);
  const title = `<div class="section-title wsl-title">🔍 O que mexe nos teus passos ${wslQ("steps-moves")}${m.rows.length >= 14 ? `<span class="watch-muted wsl-title-sub">· ${m.rows.length} dias</span>` : ""}</div>`;
  if (m.rows.length < 14) return `${title}<div class="card"><p class="watch-muted">🕵️ O Cloba tá juntando pista: com 14 dias ou mais ele começa a contar se sono, treino, stress e fim de semana mexem nos teus passos.</p></div>`;
  const body = m.list.length ? m.list.map((x) => {
    const good = x.diff >= 0;
    return `<div class="wsl-move ${good ? "is-good" : "is-bad"}">
      <div class="wsl-move-head"><span>${escapeHtml(x.yes)}</span><b>${good ? "+" : "−"}${escapeHtml(watchInt(Math.abs(Math.round(x.diff / 100) * 100)))} passos</b></div>
      <small>${escapeHtml(watchInt(Math.round(x.va)))} (${x.na} dias) x ${escapeHtml(watchInt(Math.round(x.vb)))} ${escapeHtml(x.no)} (${x.nb}) · ${good ? "+" : "−"}${Math.abs(Math.round(x.pct))}%</small>
    </div>`;
  }).join("") : `<p class="watch-muted">Nada mexe muito por enquanto: sono, treino, stress e fim de semana dão quase os mesmos passos. Constância de monge. 🧘</p>`;
  return `${title}<div class="card">${body}</div>`;
}

/* ---------------- A tela do dia (aba Dia do 👟) ---------------- */

function renderWatchStepsDay(date) {
  const m = WATCH_METRICS.steps;
  const goal = watchGoals().steps;
  const r = watchRefs("steps", date);
  const rows = watchAnRows("steps", watchAddDays(date, -13), date).map((x) => ({ ...x, label: x.date.slice(8, 10) }));
  const lines = wpsClobaLines(date);
  const cloba = lines.length ? `<div class="section-title wsl-title">🤡 O Cloba sobre os passos ${wslQ("steps-talk")}</div>
    <div class="card wsl-papo"><div class="wsl-papo-lines is-first">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>` : "";
  return `
    ${wpsHero(date)}
    <div class="toba-stats is-3 watch-an-stats">${watchAnDayTiles("steps", m, date).join("")}</div>
    <div class="card">
      <div class="card-title">📈 Os 14 dias até ${escapeHtml(watchDayLabel(date).toLowerCase())}</div>
      ${watchAnChart(rows, m, goal, r.w, { hi: date, avgLabel: "média 7 dias", daily: true })}
    </div>
    ${cloba}
    ${wpsWeek(date)}
    ${wpsOrigin(date)}
    ${wpsStride(date)}
    ${wpsWeekdays(date)}
    ${wpsMonth(date)}
    ${wpsMovesHtml(date)}
    ${watchAnAbout("steps", m)}
    ${watchHasData(watchDay(date)) ? `<button type="button" class="btn btn-secondary watch-an-dayall" data-click="watchAnDayAll" data-id="${date}">📋 Tudo desse dia</button>` : ""}`;
}

/* ---------------- ❔ dos passos (mesmo modal do 😴) ---------------- */
if (typeof WSL_HELP === "object") {
  Object.assign(WSL_HELP, {
    "steps-talk": {
      title: "❔ 🤡 O Cloba sobre os passos",
      body: [
        ["🔮 Quanto fecha hoje", "O que tu já andou + o resto do dia no teu ritmo normal (média dos últimos 30 dias), contando o dia ativo das 7h às 23h. Não estica o ritmo de agora: às 10h da manhã isso dava números malucos."],
        ["🤡 As falas", "Posição do dia nos últimos 30, comparação com o teu normal, sequência na meta, noite mal dormida e quanto veio do treino."],
      ],
    },
    "steps-week": {
      title: "❔ 🔥 Sequência e semana",
      body: [
        ["🟢 As bolinhas", "Segunda a domingo da semana do dia escolhido: ✓ verde = bateu a meta, apagada = andou mas não bateu, vazia = sem dado."],
        ["🔥 Sequência", "Dias seguidos na meta até o dia escolhido. Hoje ainda sem meta não quebra: conta até ontem. O recorde é a maior sequência do último ano."],
        ["📊 Semana", "Passos da semana até o dia escolhido x a semana passada até o mesmo dia da semana (comparação justa)."],
      ],
    },
    "steps-origin": {
      title: "❔ 🧩 De onde vieram",
      body: [
        ["🏃 Treino x 🚶 dia a dia", "O relógio manda os passos de cada exercício gravado (caminhada, corrida...). O resto é o dia a dia: ir e voltar, escada, mercado. Um dia a dia ativo vale tanto quanto treino pra saúde."],
      ],
    },
    "steps-stride": {
      title: "❔ 📏 Passada",
      body: [
        ["👣 Passada", "Distância do dia ÷ passos = quantos cm cada passo andou. Caminhada rápida alonga a passada; dia de casa encurta. Comparada com a tua média de 30 dias."],
        ["🔥 Gasto", "Calorias ativas a cada 1.000 passos. Subida, ritmo e peso mexem nisso."],
      ],
    },
    "steps-weekday": {
      title: "❔ 📅 Teu dia da semana",
      body: [
        ["📊 Como lê", "Média de passos de cada dia da semana nas últimas 12 semanas. O dia aceso é o dia da semana escolhido; a linha amarela é a meta."],
        ["💡 Pra que serve", "Descobrir o dia que sempre afunda e plantar uma caminhada fixa nele."],
      ],
    },
    "steps-month": {
      title: "❔ 🗓️ O mês",
      body: [
        ["⚖️ x mês passado", "Passos do mês até o dia escolhido x o mês passado até o mesmo dia (comparação justa)."],
        ["🔮 Fecha em", "A média por dia do mês até agora vezes os dias do mês. Compara com o total do mês passado inteiro."],
      ],
    },
    "steps-moves": {
      title: "❔ 🔍 O que mexe nos teus passos",
      body: [
        ["🕵️ Como funciona", "O Cloba pega os últimos 90 dias (fora o de hoje, que ainda tá aberto) e compara a média de passos dos dias com e sem cada coisa: dormir bem, prontidão alta, treino, dia depois de bater a meta, fim de semana e stress."],
        ["📏 O que aparece", "Só entra o que tem pelo menos 4 dias de cada lado e diferença que importa (800+ passos ou 10%+)."],
        ["⚠️ Correlação", "Não é prova. Mas se \"depois de dormir 7h+\" dá +2.000 passos, é uma pista forte de onde mexer."],
      ],
    },
  });
}
