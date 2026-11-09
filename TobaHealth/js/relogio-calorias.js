/*
 * Toba Health · 🩻 Raio-X · 🔥 Caloria ativa turbinada (v2.04)
 *
 * Pedido do Rafa (2026-11-09, mesmo estilo do 😴 e do 👟): o melhor de toda análise pra quem quer
 * mudar de vida sem canetada. SÓ AS ATIVAS (o basal deixa o gráfico reto, pedido dele desde a v1.91).
 *
 * A aba Dia da análise do 🔥 (relogio-analise.js chama renderWatchKcalDay) vira a tela do dia:
 *   herói (ativas, anel da 🎯 meta adaptativa, 🔮 quanto fecha) · vs ontem/7/30 · 14 dias com toque ·
 *   🤡 O Cloba sobre as calorias (🛋️ dia sofá) · 🎯 Meta que anda contigo · 🕐 Tuas horas de fogo
 *   (APK 2.9: hora a hora + mapa de calor de 8 semanas) · 🧩 De onde vieram · 🍔 Em comida de verdade ·
 *   📈 4 semanas · 🔍 O que mexe nas tuas calorias (também na Semana/Mês).
 * A conta da meta é calcWatchKcalGoal (health-metrics.js): a mesma da 🏅 Nota do Dia. Só LÊ watch.days.
 */

const WCA_M = {
  icon: "🔥", name: "Calorias ativas", color: "var(--coral)", sum: true, better: "up",
  get: (d) => d.activeKcal, fmt: (v) => `${watchInt(v)} kcal`, unit: "kcal",
};

// Comida de verdade (kcal aproximadas, porção comum de padaria/lanchonete)
const WCA_FOODS = [
  { icon: "🍛", one: "PF", many: "PFs", kcal: 800 },
  { icon: "🍧", one: "açaí de 500 ml", many: "açaís de 500 ml", kcal: 550 },
  { icon: "🍔", one: "x-salada", many: "x-saladas", kcal: 500 },
  { icon: "🥟", one: "pastel de feira", many: "pastéis de feira", kcal: 300 },
  { icon: "🍗", one: "coxinha", many: "coxinhas", kcal: 290 },
  { icon: "🍕", one: "fatia de pizza", many: "fatias de pizza", kcal: 280 },
  { icon: "🍺", one: "latinha de cerveja", many: "latinhas de cerveja", kcal: 150 },
  { icon: "🥖", one: "pão francês", many: "pães franceses", kcal: 135 },
  { icon: "🍫", one: "brigadeiro", many: "brigadeiros", kcal: 100 },
  { icon: "🧀", one: "pão de queijo", many: "pães de queijo", kcal: 80 },
];

function wcaVal(date) {
  const d = watchDay(date);
  const v = d ? Number(d.activeKcal) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function wcaGoal(date) {
  return typeof calcWatchKcalGoal === "function" ? calcWatchKcalGoal(watchDays(), date) : { goal: 300, base: null, n: 0 };
}

function wcaHours(date) {
  const d = watchDay(date);
  return d && Array.isArray(d.hk) ? d.hk : null;
}

function wcaNum(v, dec = 1) {
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec });
}

// Quanto da tua média do dia costuma já ter saído até a hora h (pelo hora a hora; sem ele, linear 7h-23h)
function wcaShareBy(date, h) {
  let sum = 0, part = 0, n = 0;
  for (let i = 1; i <= 28; i++) {
    const hk = wcaHours(watchAddDays(date, -i));
    if (!hk) continue;
    const tot = hk.reduce((a, b) => a + b, 0);
    if (tot < 50) continue;
    sum += tot;
    part += hk.slice(0, h).reduce((a, b) => a + b, 0) + hk[h] * (new Date().getMinutes() / 60);
    n++;
  }
  if (n >= 5 && sum > 0) return { f: part / sum, hourly: true };
  return { f: Math.max(0, Math.min(1, (h + new Date().getMinutes() / 60 - 7) / 16)), hourly: false };
}

// 🔮 Quanto fecha hoje + 🛋️ dia sofá (tá abaixo de metade do normal pra essa hora)
function wcaPace(date) {
  if (date !== toIsoDate()) return null;
  const v = wcaVal(date) || 0;
  let s = 0, n = 0;
  for (let i = 1; i <= 30; i++) { const x = wcaVal(watchAddDays(date, -i)); if (x) { s += x; n++; } }
  const base = n >= 5 ? s / n : null;
  if (!base) return null;
  const h = new Date().getHours();
  const sh = wcaShareBy(date, h);
  const expected = base * sh.f;
  const proj = Math.round((v + Math.max(0, base - expected)) / 10) * 10;
  const ratio = expected > 20 ? v / expected : null;
  return { v, base, expected, proj, ratio, sofa: h >= 11 && ratio !== null && ratio < 0.5, hourly: sh.hourly, f: sh.f };
}

// Kcal por 1.000 passos (teu, dos últimos 30 dias) pra traduzir kcal em passo
function wcaPerKSteps(date) {
  let k = 0, s = 0;
  for (let i = 0; i <= 30; i++) {
    const d = watchDay(watchAddDays(date, -i));
    if (d && Number(d.activeKcal) > 0 && Number(d.steps) > 2000) { k += Number(d.activeKcal); s += Number(d.steps); }
  }
  return s > 10000 ? (k / s) * 1000 : 40;
}

function wcaStreak(date) {
  const ok = (iso) => (wcaVal(iso) || 0) >= wcaGoal(iso).goal;
  let d = date;
  if (date === toIsoDate() && !ok(date)) d = watchAddDays(date, -1);
  let cur = 0;
  while (ok(d) && cur < 400) { cur++; d = watchAddDays(d, -1); }
  let best = 0, run = 0;
  for (let i = 364; i >= 0; i--) {
    if (ok(watchAddDays(date, -i))) { run++; best = Math.max(best, run); } else run = 0;
  }
  return { cur, best };
}

function wcaHero(date) {
  const v = wcaVal(date);
  const g = wcaGoal(date);
  const isToday = date === toIsoDate();
  const pct = v ? Math.round((v / g.goal) * 100) : 0;
  const pace = wcaPace(date);
  const d = watchDay(date) || {};
  const bits = [d.steps ? `${watchInt(d.steps)} passos` : "", d.distanceM ? watchKm(d.distanceM) : ""].filter(Boolean);
  let line;
  if (!v) line = isToday ? "Ainda sem caloria ativa hoje. O sofá tá ganhando de 1 a 0. 🛋️" : "Sem caloria ativa nesse dia.";
  else if (v >= g.goal) line = `🔥 Meta batida${v >= g.goal * 1.5 ? " com sobra" : ""}: +${watchInt(v - g.goal)} além das ${watchInt(g.goal)}.`;
  else line = `Faltam ${watchInt(g.goal - v)} kcal pra meta de ${watchInt(g.goal)}${isToday ? ` (≈ ${watchInt(Math.round(((g.goal - v) / wcaPerKSteps(date)) * 10) * 100)} passos)` : " (ficou devendo)"}.`;
  return `<div class="card wsl-hero wca-hero">
      <div class="wsl-hero-top">
        <div class="wsl-hero-main">
          <div class="wsl-hero-val" style="color:var(--coral)">${v ? escapeHtml(watchInt(v)) : "--"}</div>
          <div class="wsl-hero-sub">kcal ativas${isToday ? " até agora" : ""}${bits.length ? ` · ${escapeHtml(bits.join(" · "))}` : ""}</div>
          ${pace && pace.proj > (v || 0) ? `<div class="wsl-hero-clock">🔮 No teu ritmo, fecha em ~${escapeHtml(watchInt(pace.proj))}${pace.proj >= g.goal && (v || 0) < g.goal ? " (dá meta!)" : ""}</div>` : ""}
        </div>
        <div class="wsl-hero-score">${wslRing(Math.min(100, pct), v >= g.goal ? "is-good" : pct >= 60 ? "is-ok" : "is-bad")}<small>${pct}% da 🎯 ${escapeHtml(watchInt(g.goal))}</small></div>
      </div>
      <p class="watch-muted">${escapeHtml(line)}</p>
    </div>`;
}

function wcaFoodLine(kcal) {
  const pick = WCA_FOODS.filter((f) => kcal / f.kcal >= 1);
  const list = (pick.length ? [pick[0], pick[Math.floor(pick.length / 2)], pick[pick.length - 1]] : [WCA_FOODS[WCA_FOODS.length - 1]])
    .filter((f, i, a) => a.indexOf(f) === i);
  return list.map((f) => {
    const n = kcal / f.kcal;
    return `${f.icon} ${wcaNum(n, n < 10 ? 1 : 0)} ${n >= 1.95 ? f.many : f.one}`;
  });
}

function wcaClobaLines(date) {
  const lines = [];
  const v = wcaVal(date);
  const g = wcaGoal(date);
  const pace = wcaPace(date);
  if (pace && pace.sofa) {
    const k = wcaPerKSteps(date);
    lines.push(`🛋️ Dia sofá detectado: tu tá em ${Math.round(pace.ratio * 100)}% do teu normal pra essa hora. Uma volta de 15 min (~1.500 passos) dá uns ${watchInt(Math.round((1.5 * k) / 5) * 5)} kcal e já vira o jogo.`);
  } else if (pace && pace.ratio !== null && pace.ratio >= 1.3) {
    lines.push(`🚀 ${Math.round(pace.ratio * 100)}% do teu normal pra essa hora. Hoje o forno tá ligado.`);
  }
  if (date !== toIsoDate() && v) {
    let s = 0, n = 0;
    for (let i = 1; i <= 30; i++) { const x = wcaVal(watchAddDays(date, -i)); if (x) { s += x; n++; } }
    if (n >= 7) {
      const pct = ((v - s / n) / (s / n)) * 100;
      if (Math.abs(pct) >= 10) lines.push(pct > 0 ? `😎 ${Math.round(pct)}% acima do teu normal dos últimos 30 dias.` : `🫠 ${Math.round(-pct)}% abaixo do teu normal dos últimos 30 dias. Amanhã tem revanche.`);
      else lines.push("➡️ Bem no teu normal dos últimos 30 dias.");
    }
  }
  if (v) lines.push(`🍔 ${wcaFoodLine(v).join(" · ")}. Só de se mexer, fora o que o corpo gasta parado.`);
  const st = wcaStreak(date);
  if (st.cur >= 3) lines.push(`🔥 ${st.cur} dias seguidos na 🎯 meta${st.cur >= st.best ? ": recorde de sequência!" : ` (o recorde é ${st.best})`}.`);
  const s = typeof wslNight === "function" ? wslNight(date) : null;
  if (s && s.min < 360 && v && v < g.goal) lines.push(`😴 Dormiu ${watchHours(s.min)}: corpo cansado se mexe menos sem tu perceber. Cama cedo hoje é treino de amanhã.`);
  return lines.slice(0, 4);
}

// 🎯 Meta que anda contigo
function wcaGoalCard(date) {
  const g = wcaGoal(date);
  const mon = watchAddDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
  const dots = [];
  let hits = 0, past = 0;
  for (let i = 0; i < 7; i++) {
    const dd = watchAddDays(mon, i);
    const future = dd > date;
    const v = wcaVal(dd);
    const gg = wcaGoal(dd).goal;
    if (!future) { past++; if (v && v >= gg) hits++; }
    const cls = future ? "is-future" : v && v >= gg ? "is-hit" : v ? "is-miss" : "is-empty";
    dots.push(`<div class="wps-dot ${cls}${dd === date ? " is-sel" : ""}"><i>${future ? "" : v && v >= gg ? "✓" : ""}</i><span>${WX_WEEKDAYS[(i + 1) % 7]}</span><small>${!future && v ? watchInt(v) : ""}</small></div>`);
  }
  const st = wcaStreak(date);
  // dias sofá do mês (fechados, abaixo de metade da base da meta)
  let sofa = 0, mdays = 0;
  for (let dd = `${date.slice(0, 8)}01`; dd <= date; dd = watchAddDays(dd, 1)) {
    if (dd === toIsoDate()) continue;
    const v = wcaVal(dd), b = wcaGoal(dd).base;
    if (!v || !b) continue;
    mdays++;
    if (v < b * 0.5) sofa++;
  }
  const old = wcaGoal(watchAddDays(date, -28)).goal;
  const move = g.base && old && Math.abs(g.goal - old) >= 10 ? `${g.goal > old ? "▲" : "▼"} ${watchInt(Math.abs(g.goal - old))} x 4 semanas atrás` : "";
  return `<div class="section-title wsl-title">🎯 Meta que anda contigo ${wslQ("kcal-goal")}</div>
    <div class="card">
      <div class="wps-dots">${dots.join("")}</div>
      <div class="toba-stats is-3">
        ${watchAnTile("🎯 Meta", `${escapeHtml(watchInt(g.goal))}`, g.base ? `teu normal ${escapeHtml(watchInt(g.base))} + 10%` : "padrão até ter 7 dias")}
        ${watchAnTile("🔥 Seguidos", `${st.cur} ${st.cur === 1 ? "dia" : "dias"}`, `recorde ${st.best}`)}
        ${watchAnTile("🛋️ Sofá", mdays ? `${sofa}` : "--", mdays ? `de ${mdays} no mês` : "no mês")}
      </div>
      <p class="watch-muted">✅ ${hits} de ${past} dias na meta nessa semana${move ? ` · 🎯 ${escapeHtml(move)}` : ""}.</p>
    </div>`;
}

// 🕐 Tuas horas de fogo (APK 2.9)
function wcaHoursCard(date) {
  const title = `<div class="section-title wsl-title">🕐 Tuas horas de fogo ${wslQ("kcal-hours")}</div>`;
  const hk = wcaHours(date);
  if (!wxAnyHours()) return `${title}<div class="card"><p class="watch-muted">📲 Com o APK 2.9 o Cloba recebe as calorias hora a hora e mostra em que hora do dia tu queima e em qual tu some. Instala pelo KingInstaller e dá um 🔄.</p></div>`;
  const isToday = date === toIsoDate();
  const normal = wxHourNormal(wcaHours, date, 28);
  const bars = hk ? wxHourBars(hk, normal, { color: "var(--coral)", fmt: (v) => `${watchInt(v)} kcal`, label: "Calorias ativas por hora", nowHour: isToday ? new Date().getHours() : undefined }) : "";
  const heat = wxHeatmap(wcaHours, date, { color: "var(--coral)", fmt: (v) => `${watchInt(v)} kcal`, label: "Mapa de calor das calorias por hora" });
  let peak = "";
  if (hk) {
    const top = hk.reduce((a, v, h) => (v > hk[a] ? h : a), 0);
    if (hk[top] > 20) peak = `⏰ A hora mais quente${isToday ? " até agora" : ""}: ${top}h (${watchInt(hk[top])} kcal).`;
  }
  // a janela parada: 3 h seguidas de 9h a 20h com menos de 15 kcal por hora
  let still = "";
  if (hk) {
    for (let h = 9; h <= 18; h++) {
      if (isToday && h + 2 >= new Date().getHours()) break;
      if (hk[h] < 15 && hk[h + 1] < 15 && hk[h + 2] < 15) { still = `🪑 De ${h}h às ${h + 3}h ficou quase parado. Um alarme pra levantar a cada hora resolve.`; break; }
    }
  }
  return `${title}<div class="card">
      ${bars || `<p class="watch-muted">Esse dia ficou sem o hora a hora (o Health Connect guarda ~35 dias).</p>`}
      ${bars ? `<div class="watch-an-legend"><span><i class="wx-key-bar" style="background:var(--coral)"></i>${isToday ? "hoje" : "o dia"}</span><span><i class="wx-key-normal"></i>teu normal (28 dias)</span></div>` : ""}
      ${peak || still ? `<p class="watch-muted">${escapeHtml([peak, still].filter(Boolean).join(" "))}</p>` : ""}
      ${heat ? `<div class="wx-sub">🗺️ Tuas 8 semanas, hora a hora</div>${heat.svg}${heat.best ? `<p class="watch-muted">🔥 O teu horário de ouro é ${escapeHtml(WX_WEEKDAYS_LONG[heat.best.wd])} lá pelas ${heat.best.h}h. Os quadrados apagados são onde dá pra ganhar.</p>` : ""}` : ""}
    </div>`;
}

// 🧩 De onde vieram: treino (o relógio manda as kcal de cada exercício) x dia a dia
function wcaOrigin(date) {
  const d = watchDay(date) || {};
  const v = wcaVal(date);
  if (!v) return "";
  const ex = (Array.isArray(d.ex) ? d.ex : []).map((x) => ({ x, k: Number(x.activeKcal) > 0 ? Number(x.activeKcal) : Number(x.kcal) || 0 })).filter((e) => e.k > 0);
  const exK = Math.min(v, ex.reduce((a, e) => a + e.k, 0));
  const pe = Math.round((exK / v) * 100);
  const list = ex.map((e) => `<div class="kv-row"><span>${escapeHtml(typeof watchExName === "function" ? watchExName(e.x) : "🏅 Treino")} <small class="watch-muted">${watchClock(e.x.start)}</small></span><strong>${escapeHtml(watchInt(e.k))} kcal</strong></div>`).join("");
  return `<div class="section-title wsl-title">🧩 De onde vieram ${wslQ("kcal-origin")}</div>
    <div class="card">
      ${exK ? `<div class="wps-split" role="img" aria-label="Treino ${pe}%, dia a dia ${100 - pe}%">
        <span class="wps-split-ex" style="width:${pe}%"></span><span class="wps-split-life" style="width:${100 - pe}%"></span>
      </div>
      <div class="watch-an-legend"><span><i class="wps-key-ex"></i>🏃 treino ${escapeHtml(watchInt(exK))} (${pe}%)</span><span><i class="wps-key-life"></i>🚶 dia a dia ${escapeHtml(watchInt(v - exK))}</span></div>` : ""}
      ${list ? `<div class="kv-list">${list}</div>` : `<p class="watch-muted">Nenhum treino com caloria nesse dia: foi tudo no dia a dia (o tal do NEAT, que é o que mais queima no mês).</p>`}
    </div>`;
}

// 🍔 Em comida de verdade
function wcaFoodCard(date) {
  const v = wcaVal(date);
  if (!v) return "";
  let week = 0;
  const mon = watchAddDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
  for (let dd = mon; dd <= date; dd = watchAddDays(dd, 1)) week += wcaVal(dd) || 0;
  const k = wcaPerKSteps(date);
  const rows = WCA_FOODS.slice(0, 8).map((f) => {
    const n = v / f.kcal;
    const steps = Math.round(((f.kcal / k) * 1000) / 100) * 100;
    return `<div class="kv-row"><span>${f.icon} ${escapeHtml(f.one)} <small class="watch-muted">${watchInt(f.kcal)} kcal ≈ ${escapeHtml(watchInt(steps))} passos</small></span><strong>${escapeHtml(wcaNum(n, n < 10 ? 1 : 0))}</strong></div>`;
  }).join("");
  return `<div class="section-title wsl-title">🍔 Em comida de verdade ${wslQ("kcal-food")}</div>
    <div class="card">
      <div class="kv-list">${rows}</div>
      <p class="watch-muted">📅 Na semana até aqui: ${escapeHtml(watchInt(week))} kcal = ${escapeHtml(wcaFoodLine(week).join(" · "))}. ☕ Café coado na V60 sem açúcar: 2 kcal, pode à vontade.</p>
    </div>`;
}

// 📈 4 semanas: média por dia de cada semana (seg-dom), as 4 fechadas + a atual
function wcaTrend(date) {
  const mon = watchAddDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
  const weeks = [];
  for (let w = 8; w >= 0; w--) {
    const start = watchAddDays(mon, -7 * w);
    let s = 0, n = 0;
    for (let i = 0; i < 7; i++) {
      const dd = watchAddDays(start, i);
      if (dd > date || dd === toIsoDate()) continue;
      const v = wcaVal(dd);
      if (v) { s += v; n++; }
    }
    weeks.push({ date: start, v: n >= 3 ? s / n : null, label: `${start.slice(8, 10)}/${start.slice(5, 7)}`, n });
  }
  const last4 = weeks.slice(4, 8).filter((w) => w.v !== null), prev4 = weeks.slice(0, 4).filter((w) => w.v !== null);
  if (last4.length < 2) return "";
  // inclinação (kcal/dia por semana) das 4 fechadas
  const xs = weeks.slice(4, 8).map((w, i) => ({ i, v: w.v })).filter((p) => p.v !== null);
  const mx = wxAvg(xs.map((p) => p.i)), my = wxAvg(xs.map((p) => p.v));
  const den = xs.reduce((a, p) => a + (p.i - mx) ** 2, 0);
  const slope = den ? xs.reduce((a, p) => a + (p.i - mx) * (p.v - my), 0) / den : 0;
  const a4 = wxAvg(last4.map((w) => w.v)), p4 = prev4.length >= 2 ? wxAvg(prev4.map((w) => w.v)) : null;
  const diff = p4 ? ((a4 - p4) / p4) * 100 : null;
  const verdict = Math.abs(slope) < 8 ? "➡️ Estável: o corpo tá no automático. Pra subir, muda UMA coisa (escada, ir a pé, volta depois do almoço)."
    : slope > 0 ? `📈 Subindo ~${watchInt(Math.round(slope))} kcal/dia por semana. É assim que se muda de vida: devagar e sem volta.`
    : `📉 Caindo ~${watchInt(Math.round(-slope))} kcal/dia por semana. Sem drama: olha no 🔍 o que mudou (sono? trabalho?).`;
  const chartRows = weeks.slice(4).map((w) => ({ ...w, label: w.date === mon ? "agora" : w.label }));
  return `<div class="section-title wsl-title">📈 As últimas 4 semanas ${wslQ("kcal-trend")}</div>
    <div class="card">
      ${watchAnChart(chartRows, { ...WCA_M, name: "média por semana" }, 0, a4, { avgLabel: "média 4 semanas" })}
      <div class="toba-stats is-3">
        ${watchAnTile("📊 Média", `${escapeHtml(watchInt(a4))}`, "kcal por dia")}
        ${watchAnTile("⚖️ Antes", diff === null ? "--" : `${diff >= 0 ? "+" : "−"}${Math.abs(Math.round(diff))}%`, p4 ? `era ${escapeHtml(watchInt(p4))}` : "sem dado", diff === null ? "" : diff >= 0 ? "text-green" : "text-coral")}
        ${watchAnTile("📐 Ritmo", `${slope >= 0 ? "+" : "−"}${escapeHtml(watchInt(Math.abs(Math.round(slope))))}`, "kcal/dia por semana", slope >= 8 ? "text-green" : slope <= -8 ? "text-coral" : "")}
      </div>
      <p class="watch-muted">${escapeHtml(verdict)}</p>
    </div>`;
}

/* 🔍 O que mexe nas tuas calorias (últimos 90 dias) */
function wcaMovesHtml(date) {
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const d = watchAddDays(date, -i);
    if (d === toIsoDate()) continue;
    const v = wcaVal(d);
    if (!v) continue;
    const x = watchDay(d) || {};
    const s = typeof wslNight === "function" ? wslNight(d) : null;
    const wd = new Date(`${d}T12:00:00`).getDay();
    const drove = wxDriveHours(d).reduce((a, b) => a + b, 0);
    rows.push({
      v,
      sleep: s ? (s.min >= 420 ? true : s.min < 360 ? false : null) : null,
      wknd: wd === 0 || wd === 6,
      ex: wxMoved(d),
      stress: Number.isFinite(Number(x.stress)) ? (Number(x.stress) >= 50 ? true : Number(x.stress) < 30 ? false : null) : null,
      drive: drove >= 1 ? true : drove === 0 ? false : null,
      after: wxMoved(watchAddDays(d, -1)),
    });
  }
  const list = wxMoves(rows, [
    { k: "sleep", yes: "😴 Depois de dormir 7h+", no: "depois de menos de 6h" },
    { k: "ex", yes: "🏃 Dia com treino/caminhada", no: "sem treino" },
    { k: "after", yes: "🔁 Dia depois de treino", no: "depois de dia sem" },
    { k: "wknd", yes: "🎉 Sábado e domingo", no: "dia de semana" },
    { k: "stress", yes: "😤 Dia estressado (50+)", no: "dia tranquilo" },
    { k: "drive", yes: "🚗 Dia com 1 h+ de carro", no: "sem carro" },
  ], 40, 0.1);
  return wxMovesHtml("🔍 O que mexe nas tuas calorias", "kcal-moves", rows, list, {
    what: "se sono, treino, stress, carro e fim de semana mexem no teu fogo", fmt: (v) => `${watchInt(v)} kcal`, better: "up",
    none: "Nada mexe muito por enquanto: o teu fogo é constante. Pra subir, o caminho é criar hábito novo, não esperar o dia perfeito.",
  });
}

/* ---------------- A tela do dia (aba Dia do 🔥) ---------------- */

function renderWatchKcalDay(date) {
  const g = wcaGoal(date);
  const rows = [];
  for (let i = 13; i >= 0; i--) {
    const dd = watchAddDays(date, -i);
    rows.push({ date: dd, v: wcaVal(dd), label: dd.slice(8, 10) });
  }
  let s7 = 0, n7 = 0;
  for (let i = 1; i <= 7; i++) { const v = wcaVal(watchAddDays(date, -i)); if (v) { s7 += v; n7++; } }
  const lines = wcaClobaLines(date);
  const cloba = lines.length ? `<div class="section-title wsl-title">🤡 O Cloba sobre as calorias ${wslQ("kcal-talk")}</div>
    <div class="card wsl-papo"><div class="wsl-papo-lines is-first">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>` : "";
  return `
    ${wcaHero(date)}
    <div class="toba-stats is-3 watch-an-stats">${wcaDayTiles(date).join("")}</div>
    <div class="card">
      <div class="card-title">📈 Os 14 dias até ${escapeHtml(watchDayLabel(date).toLowerCase())}</div>
      ${watchAnChart(rows, WCA_M, g.goal, n7 >= 3 ? s7 / n7 : 0, { hi: date, avgLabel: "média 7 dias", daily: true })}
    </div>
    ${cloba}
    ${wcaGoalCard(date)}
    ${wcaHoursCard(date)}
    ${wcaOrigin(date)}
    ${wcaFoodCard(date)}
    ${wcaTrend(date)}
    ${wcaMovesHtml(date)}
    ${watchHasData(watchDay(date)) ? `<button type="button" class="btn btn-secondary watch-an-dayall" data-click="watchAnDayAll" data-id="${date}">📋 Tudo desse dia</button>` : ""}`;
}

// vs ontem / 7 / 30 dias, só das ativas (hoje aberto = quanto falta pra empatar)
function wcaDayTiles(date) {
  const v = wcaVal(date);
  const avg = (n) => {
    let s = 0, c = 0;
    for (let i = 1; i <= n; i++) { const x = wcaVal(watchAddDays(date, -i)); if (x) { s += x; c++; } }
    return c >= Math.min(3, n) ? s / c : null;
  };
  const refs = [["Ontem", wcaVal(watchAddDays(date, -1)), "ontem"], ["7 dias", avg(7), "média"], ["30 dias", avg(30), "média"]];
  const partial = date === toIsoDate();
  return refs.map(([label, ref, refLabel]) => {
    if (ref === null) return watchAnTile(partial ? label : `vs ${label}`, "--", "sem dado");
    if (partial) return watchAnTile(label, escapeHtml(watchInt(ref)), (v || 0) >= ref ? "✅ já passou" : `faltam ${escapeHtml(watchInt(ref - (v || 0)))}`);
    const pct = v ? ((v - ref) / ref) * 100 : null;
    return watchAnTile(`vs ${label}`, pct === null ? "--" : Math.abs(pct) < 1 ? "= 0%" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(Math.round(pct))}%`, `${refLabel}: ${escapeHtml(watchInt(ref))}`, pct === null || Math.abs(pct) < 1 ? "" : pct > 0 ? "text-green" : "text-coral");
  });
}

// Linha pro 🤡 Papo reto GERAL da tela principal (relogio-dia.js)
function wcaPapoLine(date) {
  const p = wcaPace(date);
  if (p && p.sofa) return `🛋️ Dia sofá: ${Math.round(p.ratio * 100)}% das tuas calorias normais pra essa hora. 15 min de volta no quarteirão já viram o jogo.`;
  return "";
}

/* ---------------- ❔ das calorias (mesmo modal do 😴) ---------------- */
if (typeof WSL_HELP === "object") {
  Object.assign(WSL_HELP, {
    "kcal-talk": {
      title: "❔ 🤡 O Cloba sobre as calorias",
      body: [
        ["🔥 Só as ativas", "Tudo aqui é caloria ATIVA: o que tu gasta se mexendo. O basal (o que o corpo gasta parado) é quase igual todo dia e só deixava o gráfico reto."],
        ["🛋️ Dia sofá", "Hoje, a partir das 11h: se tu tá abaixo da METADE do que costuma ter queimado até essa hora (pelo teu hora a hora dos últimos 28 dias; sem o APK 2.9, uma conta das 7h às 23h), o Cloba cutuca."],
        ["🔮 Quanto fecha", "O que já queimou + o que costuma queimar no resto do dia (média dos 30 dias)."],
      ],
    },
    "kcal-goal": {
      title: "❔ 🎯 Meta que anda contigo",
      body: [
        ["🎯 Como nasce", "A mediana das tuas ativas nos 28 dias antes + 10%, arredondada (entre 150 e 1.500). Sem 7 dias de histórico, 300 kcal."],
        ["🧠 Por que muda", "Meta fixa ou é fácil demais ou impossível. Essa sobe sozinha quando tu anda mais e desce devagar quando a vida aperta: sempre um passinho à frente de ti. É o que faz hábito grudar."],
        ["🛋️ Dias sofá", "Dias fechados do mês abaixo da metade do teu normal."],
      ],
    },
    "kcal-hours": {
      title: "❔ 🕐 Tuas horas de fogo",
      body: [
        ["📊 As barras", "Calorias ativas de cada hora do dia (das 6h às 23h). A linha tracejada é o teu normal de cada hora nos 28 dias antes."],
        ["🗺️ O mapa", "Cada quadradinho é a média daquela hora naquele dia da semana nas últimas 8 semanas. Mais forte = mais fogo. Os apagados são as janelas pra plantar uma caminhada."],
        ["📲 De onde vem", "O APK 2.9 lê o hora a hora do Health Connect dos últimos ~35 dias. Mais antigo que isso não tem."],
      ],
    },
    "kcal-origin": {
      title: "❔ 🧩 De onde vieram",
      body: [
        ["🏃 Treino x 🚶 dia a dia", "O relógio manda as calorias de cada exercício gravado. O resto é o dia a dia: escada, mercado, ir a pé. Esse dia a dia (NEAT) é o que mais pesa no mês pra quem não vive na academia."],
      ],
    },
    "kcal-food": {
      title: "❔ 🍔 Em comida de verdade",
      body: [
        ["🍗 As contas", "Calorias aproximadas de porção comum de padaria e lanchonete (coxinha ~290, pão francês ~135, latinha ~150...). É pra ter noção, não pra contar no grama."],
        ["👣 Os passos", "Quantos passos TEUS (pelo teu gasto por 1.000 passos dos últimos 30 dias) pagam cada comida."],
        ["⚠️ Papo reto", "Não dá pra fugir de prato ruim só andando: é muito mais fácil não comer a coxinha do que queimar ela. Mas mexer o corpo muda o resto (sono, cabeça, fome)."],
      ],
    },
    "kcal-trend": {
      title: "❔ 📈 As últimas 4 semanas",
      body: [
        ["📊 As barras", "Média de ativas por dia de cada semana (seg a dom). A da semana atual vai até ontem."],
        ["📐 Ritmo", "Quanto a média sobe (ou desce) por semana nas 4 últimas semanas fechadas. Menos de 8 kcal/dia é estável."],
        ["⚖️ x 4 antes", "As 4 semanas mais recentes contra as 4 de antes delas."],
      ],
    },
    "kcal-moves": {
      title: "❔ 🔍 O que mexe nas tuas calorias",
      body: [
        ["🕵️ Como funciona", "Últimos 90 dias (fora hoje): a média das ativas dos dias com e sem cada coisa: sono bom, treino, dia depois de treino, fim de semana, stress e 1 h+ de carro (pelo 🧭 Toba Drive)."],
        ["📏 O que aparece", "Só o que tem 4+ dias de cada lado e diferença de 40+ kcal ou 10%+."],
        ["⚠️ Correlação", "Não é prova, é pista. Mas pista boa: se dia de carro dá −150 kcal, uma volta a pé depois de chegar paga a conta."],
      ],
    },
  });
}
