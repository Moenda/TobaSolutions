/*
 * Toba Health · 🩻 Raio-X · 🔬 Análise de cada quadrado (v1.90)
 *
 * Pedido do Rafa: "igual o da balança". A tela inicial continua com os quadrados de hoje;
 * tocar num quadrado (passos, sono, calorias, ativas, distância, coração) abre a análise:
 * período (7 / 30 / 90 dias / 1 ano), média x período anterior, melhor dia, total,
 * gráfico (dia, semana ou mês), dia da semana, recordes, extras de cada assunto
 * (sono: horário de dormir/acordar, fases, regularidade; passos: dias na meta e sequência;
 * coração: menor e maior do dia), 🤡 Papo reto do Cloba e os dias do período.
 * Só LÊ o TOBA_HEALTH_DB.watch.days (mesmo formato do relogio.js). Nada é gravado.
 */

const WATCH_METRICS = {
  steps: {
    icon: "👟", name: "Passos", color: "var(--green)", sum: true, better: "up",
    get: (d) => d.steps, fmt: (v) => watchInt(v), unit: "passos",
    goal: () => watchGoals().steps,
  },
  sleep: {
    icon: "😴", name: "Sono", color: "var(--blue)", better: "up",
    get: (d) => (d.sleep && d.sleep.min > 0 ? d.sleep.min : undefined), fmt: (v) => watchHours(v), unit: "", per: "por noite",
    goal: () => watchGoals().sleepMin,
  },
  // v1.91: ⚡ ativas por padrão; com "➕ Somar o basal" ligado, o total (watchKcalOf em relogio.js)
  kcal: {
    icon: "🔥", name: "Calorias", color: "var(--coral)", sum: true, better: "up",
    get: (d) => watchKcalOf(d), fmt: (v) => watchInt(v), unit: "kcal",
  },
  distance: {
    icon: "📏", name: "Distância", color: "var(--blue)", sum: true, better: "up",
    get: (d) => d.distanceM, fmt: (v) => watchKm(v), unit: "",
  },
  heart: {
    icon: "❤️", name: "Coração", color: "var(--red, #f85149)", better: "down",
    get: (d) => d.hrAvg, fmt: (v) => `${watchInt(v)} bpm`, unit: "", zoom: true,
  },
};
// v1.93 (pedido do Rafa): períodos FECHADOS de calendário, escolhendo qual com ‹ ›
// (Agosto 2026, 2025 inteiro...) e comparando com o anterior do mesmo tamanho.
const WATCH_PERIODS = [
  { unit: "week", label: "Semana" },
  { unit: "month", label: "Mês" },
  { unit: "half", label: "Semestre" },
  { unit: "year", label: "Ano" },
];
const WATCH_MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WATCH_MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WATCH_WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WATCH_WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const watchAn = { metric: "steps", unit: "month", offset: 0, listShown: 31 };

function watchAnIso(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Período fechado: offset 0 = o atual, -1 = o anterior... { from, to, label, short }
function watchAnPeriod(unit, offset) {
  const today = toIsoDate();
  const y = Number(today.slice(0, 4));
  const mo = Number(today.slice(5, 7));
  if (unit === "week") {
    const wd = (new Date(`${today}T12:00:00`).getDay() + 6) % 7; // segunda = 0
    const from = watchAddDays(today, -wd + offset * 7);
    const to = watchAddDays(from, 6);
    const f = (iso) => `${Number(iso.slice(8, 10))} ${WATCH_MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
    const label = offset === 0 ? "Esta semana" : offset === -1 ? "Semana passada" : `${f(from)} a ${f(to)}${from.slice(0, 4) !== today.slice(0, 4) ? ` ${from.slice(0, 4)}` : ""}`;
    return { from, to, label, short: `${f(from)} a ${f(to)}` };
  }
  if (unit === "month") {
    const idx = y * 12 + (mo - 1) + offset;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    const last = new Date(yy, mm, 0).getDate();
    return { from: watchAnIso(yy, mm, 1), to: watchAnIso(yy, mm, last), label: `${WATCH_MONTHS_LONG[mm - 1]} ${yy}`, short: `${WATCH_MONTHS_SHORT[mm - 1]}/${String(yy).slice(2)}` };
  }
  if (unit === "half") {
    const idx = y * 2 + (mo > 6 ? 1 : 0) + offset;
    const yy = Math.floor(idx / 2);
    const h = idx % 2;
    return { from: watchAnIso(yy, h ? 7 : 1, 1), to: watchAnIso(yy, h ? 12 : 6, h ? 31 : 30), label: `${h + 1}º semestre ${yy}`, short: `${h + 1}º sem/${String(yy).slice(2)}` };
  }
  const yy = y + offset;
  return { from: watchAnIso(yy, 1, 1), to: watchAnIso(yy, 12, 31), label: String(yy), short: String(yy) };
}

// Até onde dá pra voltar: o período do 1º dia com dado
function watchAnMinOffset(unit) {
  const dates = Object.keys(watchDays()).sort();
  if (!dates.length) return 0;
  const first = dates[0];
  let o = 0;
  while (o > -600 && watchAnPeriod(unit, o).from > first) o--;
  return o;
}

function watchAnRows(key, from, to) {
  const m = WATCH_METRICS[key];
  const rows = [];
  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const d = watchDay(date);
    const v = d ? m.get(d) : undefined;
    rows.push({ date, v: v === undefined || v === null || !Number.isFinite(Number(v)) ? null : Number(v) });
  }
  return rows;
}

function watchAnStats(rows) {
  const vals = rows.filter((r) => r.v !== null);
  const sum = vals.reduce((a, r) => a + r.v, 0);
  const best = vals.reduce((b, r) => (!b || r.v > b.v ? r : b), null);
  const worst = vals.reduce((b, r) => (!b || r.v < b.v ? r : b), null);
  return { n: vals.length, sum, avg: vals.length ? sum / vals.length : null, best, worst };
}

// Agrupa pra caber no gráfico: semana e mês = dia; semestre = semana (de segunda); ano = mês (média dos dias com dado)
function watchAnBuckets(rows, unit) {
  if (unit === "week" || unit === "month") return rows.map((r) => ({ ...r, label: unit === "week" ? watchWeekday(r.date) : r.date.slice(8, 10) }));
  const out = [];
  if (unit === "half") {
    rows.forEach((r) => {
      const monday = new Date(`${r.date}T12:00:00`).getDay() === 1;
      let b = out[out.length - 1];
      if (!b || monday) out.push((b = { date: r.date, list: [], label: `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}` }));
      b.list.push(r);
    });
    return out.map((b) => ({ date: b.date, label: b.label, v: watchAnStats(b.list).avg }));
  }
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  rows.forEach((r) => {
    const ym = r.date.slice(0, 7);
    let b = out[out.length - 1];
    if (!b || b.ym !== ym) out.push((b = { ym, date: `${ym}-01`, list: [], label: names[Number(ym.slice(5, 7)) - 1] }));
    b.list.push(r);
  });
  return out.map((b) => ({ date: b.date, label: b.label, v: watchAnStats(b.list).avg }));
}

function watchAnChart(buckets, m, goal, avg) {
  const vals = buckets.filter((b) => b.v !== null).map((b) => b.v);
  if (!vals.length) return tobaEmpty("📊", "Sem dados nesse período", "Puxa do relógio no 🔄 ou importa o histórico na ⚙️.", { compact: true });
  const W = 340, H = 170, padB = 18, padT = 10;
  const max = Math.max(...vals, goal || 0) * (m.zoom ? 1.03 : 1.1) || 1;
  // Coração: eixo começa perto do menor valor, senão as barras ficam todas iguais
  const base = m.zoom ? Math.max(0, Math.min(...vals) * 0.85) : 0;
  const n = buckets.length;
  const slot = W / n;
  const bw = Math.max(2, Math.min(26, slot * 0.66));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - base) / (max - base || 1));
  const every = n <= 12 ? 1 : n <= 14 ? 3 : 5;
  const better = (v) => (goal ? (m.better === "down" ? v <= goal : v >= goal) : false);
  const bars = buckets.map((b, i) => {
    const x = i * slot + (slot - bw) / 2;
    const label = every === 1 || (n - 1 - i) % every === 0 ? b.label : "";
    const bar = b.v === null ? "" : `<rect x="${x.toFixed(1)}" y="${y(b.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, H - padB - y(b.v)).toFixed(1)}" rx="3" style="fill:${better(b.v) ? "var(--gold-2)" : m.color}" />`;
    return `${bar}${label ? `<text x="${(i === n - 1 && n > 12 ? W - 1 : i * slot + slot / 2).toFixed(1)}" y="${H - 4}" class="watch-chart-label"${i === n - 1 && n > 12 ? ' style="text-anchor:end"' : ""}>${escapeHtml(label)}</text>` : ""}`;
  }).join("");
  const line = (v, cls) => `<line x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="${cls}" />`;
  return `<svg class="watch-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de ${escapeHtml(m.name)}">
    ${goal ? line(goal, "watch-chart-goal") : ""}${avg ? line(avg, "watch-chart-avg") : ""}${bars}</svg>
    <div class="watch-an-legend">${goal ? `<span><i class="is-goal"></i>meta ${escapeHtml(m.fmt(goal))}</span>` : ""}${avg ? `<span><i class="is-avg"></i>média ${escapeHtml(m.fmt(avg))}</span>` : ""}</div>`;
}

function watchAnPct(now, before) {
  if (!(now > 0) || !(before > 0)) return null;
  return ((now - before) / before) * 100;
}

function watchAnTile(label, value, sub = "", cls = "") {
  return `<div class="toba-stat is-center">
    <span class="toba-stat-label">${label}</span>
    <span class="toba-stat-value${cls ? ` ${cls}` : ""}">${value}</span>
    ${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}
  </div>`;
}

function watchAnDate(iso) {
  return iso ? iso.split("-").reverse().slice(0, 2).join("/") : "";
}

// Dia da semana: média de cada um no período
function watchAnWeekdays(rows, m) {
  const acc = WATCH_WEEKDAYS.map(() => ({ sum: 0, n: 0 }));
  rows.forEach((r) => {
    if (r.v === null) return;
    const wd = new Date(`${r.date}T12:00:00`).getDay();
    acc[wd].sum += r.v;
    acc[wd].n++;
  });
  const order = [1, 2, 3, 4, 5, 6, 0];
  const avgs = order.map((i) => (acc[i].n ? acc[i].sum / acc[i].n : null));
  const vals = avgs.filter((v) => v !== null);
  if (vals.length < 3) return "";
  const max = Math.max(...vals) || 1;
  const pick = (fn) => order[avgs.indexOf(fn(...vals))];
  const top = m.better === "down" ? pick(Math.min) : pick(Math.max);
  const low = m.better === "down" ? pick(Math.max) : pick(Math.min);
  return `<div class="section-title">📅 Dia da semana</div>
    <div class="card">
      <div class="watch-an-week">${order.map((i, k) => {
        const v = avgs[k];
        const h = v === null ? 0 : Math.max(4, Math.round((v / max) * 100));
        return `<div class="watch-an-wd${i === top ? " is-top" : ""}">
          <span class="watch-an-wd-val">${v === null ? "" : escapeHtml(m.fmt(v))}</span>
          <span class="watch-an-wd-bar"><span style="height:${h}%;background:${i === top ? "var(--gold-2)" : m.color}"></span></span>
          <span class="watch-an-wd-name">${WATCH_WEEKDAYS[i]}</span>
        </div>`;
      }).join("")}</div>
      <p class="watch-muted">Teu melhor dia é <b>${WATCH_WEEKDAYS_LONG[top]}</b>; o mais fraco é <b>${WATCH_WEEKDAYS_LONG[low]}</b>.</p>
    </div>`;
}

// Recordes da vida toda (tudo que está guardado)
function watchAnRecords(key, m) {
  const dates = Object.keys(watchDays()).sort();
  if (!dates.length) return "";
  const all = watchAnRows(key, dates[0], toIsoDate());
  const s = watchAnStats(all);
  if (!s.n) return "";
  const months = {};
  all.forEach((r) => {
    if (r.v === null) return;
    const ym = r.date.slice(0, 7);
    const b = (months[ym] = months[ym] || { sum: 0, n: 0 });
    b.sum += r.v;
    b.n++;
  });
  const ranked = Object.keys(months).filter((ym) => months[ym].n >= 7).map((ym) => ({ ym, avg: months[ym].sum / months[ym].n }));
  ranked.sort((a, b) => (m.better === "down" ? a.avg - b.avg : b.avg - a.avg));
  const bestMonth = ranked[0];
  const bestDay = m.better === "down" ? s.worst : s.best;
  const goal = m.goal ? m.goal() : 0;
  let streak = 0, cur = 0;
  if (goal) {
    all.forEach((r) => {
      if (r.v !== null && r.v >= goal) {
        cur++;
        streak = Math.max(streak, cur);
      } else cur = 0;
    });
  }
  const mName = (ym) => `${WATCH_MONTH_NAMES[Number(ym.slice(5, 7)) - 1].toLowerCase()}/${ym.slice(2, 4)}`;
  const items = [
    bestDay ? `<div class="watch-an-rec"><span>🏅 ${m.better === "down" ? "Menor dia" : "Melhor dia"}</span><b>${escapeHtml(m.fmt(bestDay.v))}</b><small>${watchAnDate(bestDay.date)}/${bestDay.date.slice(2, 4)}</small></div>` : "",
    bestMonth ? `<div class="watch-an-rec"><span>🗓️ Melhor mês</span><b>${escapeHtml(m.fmt(bestMonth.avg))}</b><small>média de ${mName(bestMonth.ym)}</small></div>` : "",
    goal && streak ? `<div class="watch-an-rec"><span>🔥 Maior sequência</span><b>${streak} ${streak === 1 ? "dia" : "dias"}</b><small>seguidos na meta</small></div>` : "",
    `<div class="watch-an-rec"><span>📚 Desde</span><b>${watchAnDate(dates[0])}/${dates[0].slice(2, 4)}</b><small>${watchInt(s.n)} dias com dado</small></div>`,
  ].filter(Boolean);
  return `<div class="section-title">🏆 Recordes</div><div class="watch-an-recs">${items.join("")}</div>`;
}

// Hora em minutos com a virada da meia-noite no meio (dormir 23h e 1h dá média 0h, não 12h)
function watchAnClockMin(ms, pivot) {
  const d = new Date(ms);
  let min = d.getHours() * 60 + d.getMinutes();
  if (min < pivot) min += 1440;
  return min;
}

function watchAnClockText(min) {
  const m = Math.round(min) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function watchAnSleepExtras(from, to) {
  const nights = [];
  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const d = watchDay(date);
    if (d && d.sleep && d.sleep.min > 0) nights.push(d.sleep);
  }
  if (!nights.length) return "";
  const bed = nights.map((s) => watchAnClockMin(s.start, 15 * 60));
  const wake = nights.map((s) => watchAnClockMin(s.end, 0));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => Math.sqrt(avg(a.map((v) => (v - avg(a)) ** 2)));
  const bedSd = sd(bed);
  const staged = nights.filter((s) => s.deep + s.light + s.rem > 0);
  const ph = { deep: 0, light: 0, rem: 0, awake: 0 };
  staged.forEach((s) => Object.keys(ph).forEach((k) => (ph[k] += Number(s[k]) || 0)));
  const tot = ph.deep + ph.light + ph.rem + ph.awake;
  const pct = (k) => (tot ? Math.round((ph[k] / tot) * 100) : 0);
  const naps = nights.filter((s) => s.napMin > 0).length;
  const regular = bedSd <= 30 ? "🎯 Bem regular" : bedSd <= 60 ? "🙂 Mais ou menos regular" : "🌀 Bagunçado";
  const phases = tot ? `
    <div class="card-title">Fases (média das noites)</div>
    ${watchSleepBar({ deep: ph.deep / staged.length, light: ph.light / staged.length, rem: ph.rem / staged.length, awake: ph.awake / staged.length })}
    <p class="watch-muted">Profundo ${pct("deep")}% · Leve ${pct("light")}% · REM ${pct("rem")}% · Acordado ${pct("awake")}%. Adulto costuma ter uns 15-25% de profundo e 20-25% de REM.</p>` : "";
  return `<div class="section-title">🛏️ Como você dorme</div>
    <div class="card">
      <div class="toba-stats is-3">
        ${watchAnTile("🛏️ Deita", watchAnClockText(avg(bed)), "média")}
        ${watchAnTile("⏰ Acorda", watchAnClockText(avg(wake)), "média")}
        ${watchAnTile("📐 Horário", bedSd <= 30 ? "Regular" : bedSd <= 60 ? "Médio" : "Solto", `±${Math.round(bedSd)} min`)}
      </div>
      <p class="watch-muted">${regular}: a hora de deitar varia uns ${Math.round(bedSd)} min de uma noite pra outra.${naps ? ` 💤 ${naps} ${naps === 1 ? "dia teve" : "dias tiveram"} cochilo.` : ""}</p>
      ${phases}
    </div>`;
}

function watchAnHeartExtras(from, to) {
  const mins = [], maxs = [], rests = [];
  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const d = watchDay(date);
    if (!d) continue;
    if (d.hrMin > 0) mins.push(d.hrMin);
    if (d.hrMax > 0) maxs.push(d.hrMax);
    if (d.restHr > 0) rests.push(d.restHr);
  }
  if (!mins.length && !maxs.length && !rests.length) return "";
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return `<div class="section-title">💓 Batimento</div>
    <div class="card">
      <div class="toba-stats is-3">
        ${watchAnTile("💤 Base", rests.length ? `${watchInt(avg(rests))}` : mins.length ? `${watchInt(avg(mins))}` : "--", rests.length ? "bpm (relógio)" : "bpm (menor do dia)")}
        ${watchAnTile("📈 Pico", maxs.length ? `${watchInt(Math.max(...maxs))}` : "--", "bpm no período")}
        ${watchAnTile("⚖️ Pico/dia", maxs.length ? `${watchInt(avg(maxs))}` : "--", "bpm por dia")}
      </div>
      <p class="watch-muted">Coração em repouso mais baixo com o tempo costuma ser sinal de condicionamento melhorando. Doente, cansado ou com álcool ele sobe uns dias.</p>
    </div>`;
}

function watchAnGoalExtras(rows, m) {
  const goal = m.goal ? m.goal() : 0;
  if (!goal) return "";
  const vals = rows.filter((r) => r.v !== null);
  if (!vals.length) return "";
  const hit = vals.filter((r) => r.v >= goal).length;
  let cur = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].v !== null && rows[i].v >= goal) cur++;
    else if (i === rows.length - 1 && rows[i].v === null) continue;
    else break;
  }
  const pct = Math.round((hit / vals.length) * 100);
  return `<div class="card watch-an-goal">
      <div class="card-title">🎯 Meta de ${escapeHtml(m.fmt(goal))}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:var(--gold-2)"></div></div>
      <p class="watch-muted">${hit} de ${vals.length} dias na meta (${pct}%).${cur ? ` 🔥 Sequência atual: ${cur} ${cur === 1 ? "dia" : "dias"}.` : ""}</p>
    </div>`;
}

/* 🔬 Raio laser: cruza um assunto com o outro (último ano, precisa de 5+ dias em cada lado).
 * "dia depois de dormir bem" = a noite que ACABOU naquele dia (a noite é do dia em que acordou). */
function watchAnSplit(key, test, minEach = 5) {
  const m = WATCH_METRICS[key];
  const to = toIsoDate();
  const from = watchAddDays(to, -364);
  const yes = [], no = [];
  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const d = watchDay(date);
    if (!d) continue;
    const v = m.get(d);
    if (v === undefined || v === null || !(Number(v) > 0)) continue;
    const t = test(date, d);
    if (t === true) yes.push(Number(v));
    else if (t === false) no.push(Number(v));
  }
  if (yes.length < minEach || no.length < minEach) return null;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return { yes: avg(yes), no: avg(no), ny: yes.length, nn: no.length };
}

function watchAnTrained(d) {
  return Array.isArray(d.ex) && d.ex.some((x) => !x.auto && watchExMinutes(x) >= 15);
}

function watchAnInsights(key) {
  const goals = watchGoals();
  const sleepOf = (date) => { const d = watchDay(date); return d && d.sleep && d.sleep.min > 0 ? d.sleep.min : null; };
  const stepsOf = (date) => { const d = watchDay(date); return d && d.steps !== undefined ? d.steps : null; };
  const goodSleep = (date) => { const s = sleepOf(date); return s === null ? null : s >= 420 ? true : s < 360 ? false : null; };
  const out = [];
  const add = (icon, title, r, yesLabel, noLabel, fmt, better = "up") => {
    if (!r) return;
    const diff = r.yes - r.no;
    const pct = r.no ? (diff / r.no) * 100 : 0;
    if (Math.abs(pct) < 3) {
      out.push({ icon, title, text: `Quase não muda: ${fmt(r.yes)} ${yesLabel} x ${fmt(r.no)} ${noLabel}.`, r, fmt, yesLabel, noLabel, good: null });
      return;
    }
    const good = better === "none" ? null : better === "up" ? diff > 0 : diff < 0;
    out.push({ icon, title, text: `${fmt(r.yes)} ${yesLabel} x ${fmt(r.no)} ${noLabel}: ${Math.abs(Math.round(pct))}% ${diff > 0 ? "a mais" : "a menos"}.`, r, fmt, yesLabel, noLabel, good });
  };
  const m = WATCH_METRICS[key];
  if (key === "steps") {
    add("😴", "Sono x passos", watchAnSplit("steps", (date) => goodSleep(date)), "depois de dormir 7h+", "depois de menos de 6h", m.fmt);
    add("📅", "Fim de semana", watchAnSplit("steps", (date) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay())), "no fim de semana", "nos dias úteis", m.fmt);
  }
  if (key === "sleep") {
    add("👟", "Passos x sono", watchAnSplit("sleep", (date) => { const s = stepsOf(watchAddDays(date, -1)); return s === null ? null : s >= goals.steps; }), "depois de dia na meta de passos", "depois de dia parado", m.fmt);
    add("🏋️", "Treino x sono", watchAnSplit("sleep", (date) => { const d = watchDay(watchAddDays(date, -1)); return d ? watchAnTrained(d) : null; }), "depois de dia com treino", "depois de dia sem treino", m.fmt);
    add("📅", "Fim de semana", watchAnSplit("sleep", (date) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay())), "no sáb/dom", "na semana", m.fmt);
  }
  if (key === "heart") {
    add("😴", "Sono x coração", watchAnSplit("heart", (date) => goodSleep(date)), "depois de dormir 7h+", "depois de menos de 6h", m.fmt, "down");
    add("🏋️", "Treino x coração", watchAnSplit("heart", (date, d) => watchAnTrained(d)), "em dia de treino", "em dia sem treino", m.fmt, "none"); // treinar sobe o batimento do dia: não é ruim
  }
  if (key === "kcal" || key === "distance") {
    add("🏋️", "Treino faz diferença?", watchAnSplit(key, (date, d) => watchAnTrained(d)), "em dia de treino", "em dia sem treino", m.fmt);
    add("😴", "Sono x energia", watchAnSplit(key, (date) => goodSleep(date)), "depois de dormir 7h+", "depois de menos de 6h", m.fmt);
  }
  if (!out.length) return "";
  return `<div class="section-title">🔬 Raio laser <span class="watch-muted">· último ano</span></div>
    <div class="watch-an-insights">${out.map((i) => {
      const max = Math.max(i.r.yes, i.r.no) || 1;
      const bar = (v, label, n, cls) => `<div class="watch-an-ibar"><span class="watch-an-ilabel">${escapeHtml(label)} <small>(${n} dias)</small></span>
        <span class="watch-an-itrack"><span class="${cls}" style="width:${Math.round((v / max) * 100)}%"></span></span>
        <b>${escapeHtml(i.fmt(v))}</b></div>`;
      return `<div class="watch-an-insight${i.good === true ? " is-good" : i.good === false ? " is-bad" : ""}">
        <div class="watch-an-ititle">${i.icon} ${escapeHtml(i.title)}</div>
        ${bar(i.r.yes, i.yesLabel, i.r.ny, "is-yes")}
        ${bar(i.r.no, i.noLabel, i.r.nn, "is-no")}
        <p class="watch-muted">${escapeHtml(i.text)}</p>
      </div>`;
    }).join("")}</div>`;
}

// 🤡 Papo reto do Cloba sobre o assunto
function watchAnCloba(key, m, s, prev, rows) {
  const lines = [];
  const pct = watchAnPct(s.avg, prev.avg);
  const goal = m.goal ? m.goal() : 0;
  if (pct !== null && Math.abs(pct) >= 3) {
    const good = m.better === "down" ? pct < 0 : pct > 0;
    const big = Math.abs(pct) >= 10;
    const verb = pct > 0 ? (big ? "subiu" : "subiu um pouco") : big ? "caiu" : "deu uma leve caída";
    const tail = good ? (big ? "Tá voando, Cloba! 🚀" : "No caminho certo.") : big ? "Bora reagir, Cloba." : "Nada grave, só fica de olho.";
    lines.push(`${good ? "📈" : "📉"} ${m.name}: ${verb} (${Math.abs(Math.round(pct))}%) em relação a ${watchAnPeriod(watchAn.unit, watchAn.offset - 1).label.toLowerCase()}. ${tail}`);
  } else if (pct !== null) {
    lines.push("➡️ Tudo parecido com o período anterior. Constância também é treino.");
  }
  if (goal && s.avg !== null) {
    if (s.avg >= goal) lines.push(`🏆 A média tá acima da meta de ${m.fmt(goal)}. Nunca foi sorte.`);
    else lines.push(`🎯 Faltam ${m.fmt(goal - s.avg)} por dia, em média, pra bater a meta.`);
  }
  if (key === "sleep" && s.avg !== null && s.avg < 360) lines.push("🥱 Menos de 6h por noite em média. O Saitama não treinou dormindo pouco.");
  if (key === "steps" && s.avg !== null && s.avg < 5000) lines.push("🛋️ Abaixo de 5 mil por dia é zona de sofá. Uma caminhada de 20 min já dá uns 2.500.");
  if (key === "heart" && pct !== null && pct > 8) lines.push("🤒 Batimento subindo assim pode ser cansaço, pouco sono ou começo de gripe. Pega leve uns dias.");
  const empty = rows.filter((r) => r.v === null).length;
  if (empty > rows.length / 2) lines.push("⌚ Mais da metade dos dias sem dado: dorme e anda com o relógio pra análise ficar certa.");
  if (!lines.length) return "";
  return `<div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Papo reto do Cloba</b>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>`;
}

function renderWatchMetric() {
  const key = watchAn.metric;
  const m = WATCH_METRICS[key];
  const el = document.getElementById("watchMetricBody");
  if (!m || !el) return;
  const today = toIsoDate();
  const minOffset = watchAnMinOffset(watchAn.unit);
  if (watchAn.offset < minOffset) watchAn.offset = minOffset;
  const period = watchAnPeriod(watchAn.unit, watchAn.offset);
  const before = watchAnPeriod(watchAn.unit, watchAn.offset - 1);
  const from = period.from;
  const to = period.to < today ? period.to : today; // período atual: até hoje
  const rows = watchAnRows(key, from, period.to).map((r) => (r.date > today ? { ...r, v: null } : r));
  const prevRows = watchAnRows(key, before.from, before.to);
  const s = watchAnStats(rows);
  const prev = watchAnStats(prevRows);
  const goal = m.goal ? m.goal() : 0;
  const pct = watchAnPct(s.avg, prev.avg);
  const good = pct === null || Math.abs(pct) < 0.5 ? null : m.better === "down" ? pct < 0 : pct > 0;
  const bestDay = m.better === "down" ? s.worst : s.best;
  const tiles = [
    watchAnTile("Média", s.avg !== null ? escapeHtml(m.fmt(s.avg)) : "--", m.per || "por dia", "text-blue"),
    watchAnTile("vs Anterior", pct === null ? "--" : Math.abs(pct) < 0.5 ? "= 0%" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(Math.round(pct)) || "<1"}%`, prev.avg !== null ? `${escapeHtml(before.short)}: ${escapeHtml(m.fmt(prev.avg))}` : `sem dado em ${escapeHtml(before.short)}`, good === null ? "" : good ? "text-green" : "text-coral"),
    m.sum
      ? watchAnTile("Total", s.n ? escapeHtml(m.fmt(s.sum)) : "--", `${s.n} dias`)
      : watchAnTile(m.better === "down" ? "Menor" : "Melhor", bestDay ? escapeHtml(m.fmt(bestDay.v)) : "--", bestDay ? watchAnDate(bestDay.date) : ""),
  ];
  const buckets = watchAnBuckets(rows, watchAn.unit);
  const grain = watchAn.unit === "week" || watchAn.unit === "month" ? "por dia" : watchAn.unit === "half" ? "média por semana" : "média por mês";
  const options = [];
  for (let o = 0; o >= minOffset; o--) options.push(`<option value="${o}"${o === watchAn.offset ? " selected" : ""}>${escapeHtml(watchAnPeriod(watchAn.unit, o).label)}</option>`);
  const list = rows.filter((r) => r.v !== null).reverse();
  const shown = list.slice(0, watchAn.listShown);
  el.innerHTML = `
    <div class="period-selector watch-an-periods" role="group" aria-label="Período">
      ${WATCH_PERIODS.map((p) => `<button type="button" class="period-btn${p.unit === watchAn.unit ? " active" : ""}" data-click="watchMetricPeriod" data-unit="${p.unit}">${p.label}</button>`).join("")}
    </div>
    <div class="watch-an-nav">
      <button type="button" class="toba-icon-btn" data-click="watchMetricStep" data-step="-1" aria-label="Período anterior"${watchAn.offset <= minOffset ? " disabled" : ""}>‹</button>
      <select class="watch-an-pick" data-change="watchMetricPick" aria-label="Escolher o período">${options.join("")}</select>
      <button type="button" class="toba-icon-btn" data-click="watchMetricStep" data-step="1" aria-label="Próximo período"${watchAn.offset >= 0 ? " disabled" : ""}>›</button>
    </div>
    ${key === "kcal" ? watchAnBasalToggle() : ""}
    <div class="toba-stats is-3 watch-an-stats">${tiles.join("")}</div>
    <div class="card">
      <div class="card-title">📈 Evolução <span class="watch-muted">· ${grain}</span></div>
      ${watchAnChart(buckets, m, goal, s.avg)}
    </div>
    ${watchAnCloba(key, m, s, prev, rows)}
    ${key === "steps" || key === "sleep" ? watchAnGoalExtras(rows, m) : ""}
    ${key === "sleep" ? watchAnSleepExtras(from, to) : ""}
    ${key === "heart" ? watchAnHeartExtras(from, to) : ""}
    ${watchAnInsights(key)}
    ${watchAnWeekdays(rows, m)}
    ${watchAnRecords(key, m)}
    <div class="section-title">🗓️ Dias do período</div>
    <div class="toba-list">${shown.length ? shown.map((r) => `
      <div class="toba-list-item watch-row" role="button" tabindex="0" data-click="openWatchDay" data-id="${r.date}">
        <span class="watch-row-date">${escapeHtml(watchDayLabel(r.date))}</span>
        <span class="watch-row-bits">${goal && r.v >= goal ? "🏆 " : ""}${escapeHtml(m.fmt(r.v))}</span>
        <span class="toba-hub-chevron">›</span>
      </div>`).join("") : tobaEmpty(m.icon, "Nenhum dia com dado", "", { compact: true })}
    </div>
    ${list.length > shown.length ? `<button type="button" class="btn btn-secondary" data-click="watchMetricMore">Mostrar mais (${list.length - shown.length})</button>` : ""}`;
}

// v1.91: botão do basal (só na análise das calorias)
function watchAnBasalToggle() {
  const on = watchKcalBasal();
  return `<div class="watch-an-basal">
      <button type="button" class="chip-btn${on ? " is-on" : ""}" data-click="watchToggleBasal" aria-pressed="${on}">${on ? "✅ Somando o basal" : "➕ Somar o basal"}</button>
      <span class="watch-muted">${on ? "Total do dia: ativas + o que o corpo gasta parado." : "Só ⚡ ativas, o que você queimou se mexendo. O basal (corpo parado) é quase igual todo dia."}</span>
    </div>`;
}

function openWatchMetric(el) {
  const key = el.dataset.metric;
  if (!WATCH_METRICS[key]) return;
  watchAn.metric = key;
  watchAn.listShown = 31;
  document.getElementById("viewWatchMain").classList.remove("active");
  document.getElementById("viewWatchMetric").classList.add("active");
  const m = WATCH_METRICS[key];
  tobaSetHeader({ page: `${m.icon} ${m.name}`, back: "closeWatchMetric" });
  renderWatchMetric();
  window.scrollTo(0, 0);
}

function closeWatchMetric() {
  document.getElementById("viewWatchMetric").classList.remove("active");
  document.getElementById("viewWatchMain").classList.add("active");
  tobaSetHeader({ page: "🩻 Raio-X" });
  window.scrollTo(0, 0);
}

function watchMetricOpen() {
  const v = document.getElementById("viewWatchMetric");
  return !!(v && v.classList.contains("active"));
}

tobaActions({
  openWatchMetric,
  closeWatchMetric,
  watchMetricPeriod(el) {
    watchAn.unit = el.dataset.unit || "month";
    watchAn.offset = 0;
    watchAn.listShown = 31;
    renderWatchMetric();
  },
  watchMetricStep(el) {
    watchAn.offset = Math.min(0, watchAn.offset + (Number(el.dataset.step) || 0));
    watchAn.listShown = 31;
    renderWatchMetric();
  },
  watchMetricPick(el) {
    watchAn.offset = Math.min(0, Number(el.value) || 0);
    watchAn.listShown = 31;
    renderWatchMetric();
  },
  watchMetricMore() {
    watchAn.listShown += 31;
    renderWatchMetric();
  },
  watchToggleBasal() {
    watchSetKcalBasal(!watchKcalBasal());
    renderWatch(); // já refaz a análise aberta
  },
});
