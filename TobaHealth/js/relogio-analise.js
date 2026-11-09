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
  /* v1.94 (🩻 RAIO ULTRA X): o corpo por dentro. zone(v, date) = faixa do dia (ícone + nome). */
  stress: {
    icon: "😰", name: "Stress", color: "var(--coral)", better: "down",
    get: (d) => d.stress, fmt: (v) => watchInt(v), unit: "",
    zone: (v) => (v < 30 ? { icon: "😌", label: "tranquilo", k: 0 } : v < 50 ? { icon: "🙂", label: "normal", k: 1 } : v < 70 ? { icon: "😬", label: "puxado", k: 2 } : { icon: "🔥", label: "alto", k: 3 }),
    zones: [["😌 tranquilo", "var(--green)"], ["🙂 normal", "var(--blue)"], ["😬 puxado", "var(--gold-2)"], ["🔥 alto", "var(--coral)"]],
    about: "Score de 0 a 100 que o relógio calcula pela variação do batimento, uma vez por hora. Aqui é a média do dia.",
  },
  energy: {
    icon: "🔋", name: "Energy Score", color: "var(--gold-2)", better: "up",
    get: (d) => d.energy, fmt: (v) => watchInt(v), unit: "",
    zone: (v) => (v >= 85 ? { icon: "⚡", label: "excelente", k: 0 } : v >= 70 ? { icon: "💪", label: "bom", k: 1 } : v >= 60 ? { icon: "😐", label: "regular", k: 2 } : { icon: "🪫", label: "baixo", k: 3 }),
    zones: [["⚡ excelente", "var(--green)"], ["💪 bom", "var(--blue)"], ["😐 regular", "var(--gold-2)"], ["🪫 baixo", "var(--coral)"]],
    about: "Nota de 0 a 100 que o Samsung dá todo dia de manhã juntando sono, batimento dormindo, HRV e atividade dos dias antes.",
  },
  hrv: {
    icon: "💓", name: "HRV", color: "var(--purple, #a371f7)", better: "up",
    get: (d) => d.hrv, fmt: (v) => `${watchInt(v)} ms`, unit: "", zoom: true,
    zone: (v, date) => {
      const base = watchAvgBefore("hrv", date, 60);
      if (!base) return null;
      return v >= base * 1.1 ? { icon: "🚀", label: "acima do teu normal", k: 0 } : v >= base * 0.85 ? { icon: "✅", label: "no teu normal", k: 1 } : { icon: "🪫", label: "abaixo do normal", k: 2 };
    },
    zones: [["🚀 acima", "var(--green)"], ["✅ normal", "var(--blue)"], ["🪫 abaixo", "var(--coral)"]],
    about: "Variação entre um batimento e outro, medida dormindo. Mais alto = corpo recuperado; caiu muito do teu normal = cansaço, doença, álcool ou stress.",
  },
  spo2: {
    icon: "🫁", name: "Oxigenação", color: "var(--blue)", better: "up",
    get: (d) => d.spo2, fmt: (v) => `${watchInt(v)}%`, unit: "", zoom: true, per: "por noite",
    zone: (v) => (v >= 95 ? { icon: "✅", label: "normal", k: 0 } : v >= 90 ? { icon: "⚠️", label: "atenção", k: 1 } : { icon: "🚨", label: "baixo", k: 2 }),
    zones: [["✅ 95%+", "var(--green)"], ["⚠️ 90-94%", "var(--gold-2)"], ["🚨 < 90%", "var(--coral)"]],
    about: "Oxigênio no sangue (SpO2) medido durante o sono. Normal é 95% pra cima.",
  },
  resp: {
    icon: "😮‍💨", name: "Respiração", color: "var(--teal, #39c5cf)", better: "down",
    get: (d) => d.resp, fmt: (v) => `${watchDec(v)}/min`, unit: "", zoom: true, per: "por noite",
    zone: (v) => (v >= 12 && v <= 20 ? { icon: "✅", label: "normal", k: 0 } : { icon: "⚠️", label: "fora do comum", k: 1 }),
    zones: [["✅ 12-20", "var(--green)"], ["⚠️ fora", "var(--gold-2)"]],
    about: "Respirações por minuto dormindo. Adulto em repouso fica entre 12 e 20; subir do teu normal pode ser começo de gripe.",
  },
  temp: {
    icon: "🌡️", name: "Temperatura da pele", color: "var(--coral)", better: "none", noBest: true,
    get: (d) => d.temp, fmt: (v) => `${watchDec(v)} °C`, unit: "", zoom: true, per: "por noite",
    zone: (v, date) => {
      const base = watchAvgBefore("temp", date, 60);
      if (!base) return null;
      return v - base > 0.5 ? { icon: "🔥", label: "mais quente", k: 0 } : base - v > 0.5 ? { icon: "🧊", label: "mais fria", k: 2 } : { icon: "✅", label: "normal", k: 1 };
    },
    zones: [["🔥 +0,5 °C", "var(--coral)"], ["✅ normal", "var(--green)"], ["🧊 -0,5 °C", "var(--blue)"]],
    about: "Temperatura da pele do pulso dormindo. Não é febre (pele é mais fria que o corpo): o que importa é fugir do TEU normal.",
  },
  snore: {
    icon: "😪", name: "Ronco", color: "var(--purple, #a371f7)", better: "down", zeroOk: true, per: "por noite",
    get: (d) => d.snoreMin, fmt: (v) => (v >= 1 ? watchHours(v) : "0 min"), unit: "",
    zone: (v) => (v < 1 ? { icon: "🤫", label: "nada", k: 0 } : v < 15 ? { icon: "😴", label: "pouco", k: 1 } : v < 45 ? { icon: "😪", label: "médio", k: 2 } : { icon: "🐻", label: "urso", k: 3 }),
    zones: [["🤫 nada", "var(--green)"], ["😴 < 15 min", "var(--blue)"], ["😪 15-45", "var(--gold-2)"], ["🐻 45+", "var(--coral)"]],
    about: "Minutos roncando que o celular ouviu na noite (detector de ronco do Samsung Health ligado).",
  },
  floors: {
    icon: "🪜", name: "Andares", color: "var(--green)", sum: true, better: "up",
    get: (d) => d.floors, fmt: (v) => watchInt(v), unit: "andares", zeroOk: true,
    about: "Andares subidos no dia (o barômetro do relógio conta cada ~3 m de subida).",
  },
};
// v1.93 (pedido do Rafa): períodos FECHADOS de calendário, escolhendo qual com ‹ ›
// (Agosto 2026, 2025 inteiro...) e comparando com o anterior do mesmo tamanho.
// v1.95 (pedido do Rafa): Dia também, comparando com ontem, 7 dias e 30 dias.
const WATCH_PERIODS = [
  { unit: "day", label: "Dia" },
  { unit: "week", label: "Semana" },
  { unit: "month", label: "Mês" },
  { unit: "half", label: "Semestre" },
  { unit: "year", label: "Ano" },
];
const WATCH_MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WATCH_MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WATCH_WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WATCH_WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const watchAn = { metric: "steps", unit: "day", offset: 0, listShown: 31 }; // day: offset = dias antes de hoje (= watchUi.date)

function watchAnIso(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Período fechado: offset 0 = o atual, -1 = o anterior... { from, to, label, short }
function watchAnPeriod(unit, offset) {
  const today = toIsoDate();
  const y = Number(today.slice(0, 4));
  const mo = Number(today.slice(5, 7));
  if (unit === "day") {
    const iso = watchAddDays(today, offset);
    return { from: iso, to: iso, label: watchDayLabel(iso), short: watchAnDate(iso) };
  }
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
  if (unit === "day") return Math.min(0, watchDaysBetween(toIsoDate(), first));
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

// opts.hi (v1.95) = data do dia escolhido: a barra dele fica acesa e as outras apagadinhas
// v1.98 (pedido do Rafa: "clico na barrinha e nem mostra o número"): tocar numa barra acende ela e
// mostra o número dela em cima do gráfico (+ "Ver esse dia ›" quando a barra é um dia só).
// opts.daily = cada barra é um dia (mostra "Ver esse dia ›"); sem opts.hi o letreiro começa com a dica.
function watchAnChart(buckets, m, goal, avg, opts = {}) {
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
  const every = n <= 14 ? 1 : 5;
  const better = (v) => (goal ? (m.better === "down" ? v <= goal : v >= goal) : false);
  const daily = opts.daily === true;
  const bars = buckets.map((b, i) => {
    const x = i * slot + (slot - bw) / 2;
    const label = every === 1 || (n - 1 - i) % every === 0 ? b.label : "";
    const dim = opts.hi && b.date !== opts.hi ? " is-dim" : "";
    const bar = b.v === null ? "" : `<rect class="watch-chart-bar${dim}" data-i="${i}" x="${x.toFixed(1)}" y="${y(b.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, H - padB - y(b.v)).toFixed(1)}" rx="3" style="fill:${better(b.v) ? "var(--gold-2)" : m.color}" />`;
    const hiCls = opts.hi && b.date === opts.hi ? " is-hi" : "";
    const tip = b.v === null ? `${watchAnBucketName(b, daily)} · sem dado` : `${watchAnBucketName(b, daily)} · ${daily ? "" : "média "}${m.fmt(b.v)}${goal && better(b.v) ? " 🏆" : ""}`;
    const hit = `<rect class="watch-chart-hit" x="${(i * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-click="watchAnBarTap" data-i="${i}" data-tip="${escapeHtml(tip)}"${daily && b.v !== null ? ` data-id="${b.date}"` : ""} />`;
    return `${bar}${label ? `<text x="${(i === n - 1 && n > 14 ? W - 1 : i * slot + slot / 2).toFixed(1)}" y="${H - 4}" class="watch-chart-label${hiCls}"${i === n - 1 && n > 14 ? ' style="text-anchor:end"' : ""}>${escapeHtml(label)}</text>` : ""}${hit}`;
  }).join("");
  const line = (v, cls) => `<line x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="${cls}" />`;
  const hiB = opts.hi ? buckets.find((b) => b.date === opts.hi && b.v !== null) : null;
  const first = hiB ? `${watchAnBucketName(hiB, daily)} · ${m.fmt(hiB.v)}` : "";
  return `<div class="watch-chart-wrap">
    <div class="watch-chart-tip${first ? "" : " is-hint"}" aria-live="polite">${first ? escapeHtml(first) : "👆 Toca numa barra pra ver o número"}</div>
    <svg class="watch-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de ${escapeHtml(m.name)}">
    ${goal ? line(goal, "watch-chart-goal") : ""}${avg ? line(avg, "watch-chart-avg") : ""}${bars}</svg></div>
    <div class="watch-an-legend">${goal ? `<span><i class="is-goal"></i>meta ${escapeHtml(m.fmt(goal))}</span>` : ""}${avg ? `<span><i class="is-avg"></i>${escapeHtml(opts.avgLabel || "média")} ${escapeHtml(m.fmt(avg))}</span>` : ""}</div>`;
}

// v1.98: nome da barra no letreiro (dia, semana ou mês)
function watchAnBucketName(b, daily) {
  if (daily) return watchDayLabel(b.date);
  if (/^[a-zç]{3}$/.test(b.label || "")) return `${b.label}/${b.date.slice(2, 4)}`;
  return `semana de ${watchAnDate(b.date)}`;
}

// v1.98: tocou numa barra: acende ela, apaga as outras e escreve o número em cima
function watchAnBarTap(el) {
  const wrap = el.closest(".watch-chart-wrap");
  if (!wrap) return;
  const i = el.dataset.i;
  wrap.querySelectorAll(".watch-chart-bar").forEach((b) => b.classList.toggle("is-dim", b.dataset.i !== i));
  wrap.querySelectorAll(".watch-chart-hit").forEach((b) => b.classList.toggle("is-sel", b === el));
  const tip = wrap.querySelector(".watch-chart-tip");
  if (!tip) return;
  tip.classList.remove("is-hint");
  const go = el.dataset.id && !(watchAn.unit === "day" && el.dataset.id === watchAddDays(toIsoDate(), watchAn.offset));
  tip.innerHTML = `<span>${escapeHtml(el.dataset.tip || "")}</span>${go ? `<button type="button" class="chip-btn watch-chart-go" data-click="watchMetricGoDay" data-id="${escapeHtml(el.dataset.id)}">Ver esse dia ›</button>` : ""}`;
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
  const bestMonth = m.noBest ? null : ranked[0];
  const bestDay = m.noBest ? null : m.better === "down" ? s.worst : s.best;
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
    if (v === undefined || v === null || !(Number(v) > 0 || (m.zeroOk && Number(v) === 0))) continue;
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
  // v1.94 (🩻 RAIO ULTRA X)
  const fieldOf = (field) => (date) => { const d = watchDay(date); return d && d[field] !== undefined && d[field] !== null ? Number(d[field]) : null; };
  const stressOf = fieldOf("stress");
  const trainedBefore = (date) => { const d = watchDay(watchAddDays(date, -1)); return d ? watchAnTrained(d) : null; };
  const stressedBefore = (date) => { const v = stressOf(watchAddDays(date, -1)); return v === null ? null : v >= 50 ? true : v < 30 ? false : null; };
  const weekend = (date) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
  const fridayNight = (date) => [6, 0].includes(new Date(`${date}T12:00:00`).getDay()); // noite que acaba sáb/dom
  if (key === "sleep") {
    add("😰", "Stress x sono", watchAnSplit("sleep", (date) => stressedBefore(date)), "depois de dia estressado", "depois de dia tranquilo", m.fmt);
  }
  if (key === "steps") {
    add("🔋", "Energy x passos", watchAnSplit("steps", (date) => { const e = fieldOf("energy")(date); return e === null ? null : e >= 70 ? true : e < 60 ? false : null; }), "com energy 70+", "com energy < 60", m.fmt);
  }
  if (key === "stress") {
    add("😴", "Sono x stress", watchAnSplit("stress", (date) => goodSleep(date)), "depois de dormir 7h+", "depois de menos de 6h", m.fmt, "down");
    add("👟", "Andar x stress", watchAnSplit("stress", (date, d) => (d.steps === undefined ? null : d.steps >= goals.steps)), "em dia na meta de passos", "em dia parado", m.fmt, "down");
    add("🏋️", "Treino x stress", watchAnSplit("stress", (date, d) => watchAnTrained(d)), "em dia de treino", "em dia sem treino", m.fmt, "none"); // treino sobe o batimento: o score sobe junto
    add("📅", "Fim de semana", watchAnSplit("stress", (date) => weekend(date)), "no sáb/dom", "na semana", m.fmt, "down");
  }
  if (key === "hrv") {
    add("😴", "Sono x HRV", watchAnSplit("hrv", (date) => goodSleep(date)), "em noite de 7h+", "em noite de menos de 6h", m.fmt);
    add("🏋️", "Treino ontem x HRV", watchAnSplit("hrv", (date) => trainedBefore(date)), "depois de dia com treino", "depois de dia sem treino", m.fmt);
    add("😰", "Stress x HRV", watchAnSplit("hrv", (date) => stressedBefore(date)), "depois de dia estressado", "depois de dia tranquilo", m.fmt);
    add("🍻", "Sexta e sábado", watchAnSplit("hrv", (date) => fridayNight(date)), "nas noites de sex/sáb", "nas outras noites", m.fmt);
  }
  if (key === "energy") {
    add("😴", "Sono x energy", watchAnSplit("energy", (date) => goodSleep(date)), "depois de dormir 7h+", "depois de menos de 6h", m.fmt);
    add("🏋️", "Treino ontem x energy", watchAnSplit("energy", (date) => trainedBefore(date)), "depois de dia com treino", "depois de dia sem treino", m.fmt);
    add("👟", "Andar ontem x energy", watchAnSplit("energy", (date) => { const v = stepsOf(watchAddDays(date, -1)); return v === null ? null : v >= goals.steps; }), "depois de dia na meta de passos", "depois de dia parado", m.fmt);
    add("😰", "Stress x energy", watchAnSplit("energy", (date) => stressedBefore(date)), "depois de dia estressado", "depois de dia tranquilo", m.fmt);
  }
  if (key === "spo2") {
    add("😪", "Ronco x oxigênio", watchAnSplit("spo2", (date, d) => (d.snoreMin === undefined ? null : d.snoreMin >= 15 ? true : d.snoreMin < 3 ? false : null)), "em noite com ronco", "em noite sem ronco", m.fmt);
    add("😴", "Sono x oxigênio", watchAnSplit("spo2", (date) => goodSleep(date)), "em noite de 7h+", "em noite curta", m.fmt);
  }
  if (key === "resp") {
    add("🏋️", "Treino ontem x respiração", watchAnSplit("resp", (date) => trainedBefore(date)), "depois de dia com treino", "depois de dia sem treino", m.fmt, "down");
    add("😰", "Stress x respiração", watchAnSplit("resp", (date) => stressedBefore(date)), "depois de dia estressado", "depois de dia tranquilo", m.fmt, "down");
  }
  if (key === "temp") {
    add("🏋️", "Treino ontem x temperatura", watchAnSplit("temp", (date) => trainedBefore(date)), "depois de dia com treino", "depois de dia sem treino", m.fmt, "none");
    add("🍻", "Sexta e sábado", watchAnSplit("temp", (date) => fridayNight(date)), "nas noites de sex/sáb", "nas outras noites", m.fmt, "none");
  }
  if (key === "snore") {
    add("🍻", "Sexta e sábado", watchAnSplit("snore", (date) => fridayNight(date)), "nas noites de sex/sáb", "nas outras noites", m.fmt, "down");
    add("😰", "Stress x ronco", watchAnSplit("snore", (date) => stressedBefore(date)), "depois de dia estressado", "depois de dia tranquilo", m.fmt, "down");
    add("🏋️", "Treino x ronco", watchAnSplit("snore", (date) => trainedBefore(date)), "depois de dia com treino", "depois de dia sem treino", m.fmt, "down");
  }
  if (key === "floors") {
    add("📅", "Fim de semana", watchAnSplit("floors", (date) => weekend(date)), "no sáb/dom", "na semana", m.fmt);
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
  // v1.94 (🩻 RAIO ULTRA X)
  const valid = rows.filter((r) => r.v !== null);
  const share = (fn) => (valid.length ? valid.filter(fn).length / valid.length : 0);
  if (key === "stress" && s.avg !== null) {
    if (s.avg >= 50) lines.push("🧯 Média de stress puxada. Caminhada leve, sol e 10 min sem celular abaixam isso mais que qualquer chá.");
    else if (s.avg < 30) lines.push("🧘 Stress lá embaixo. Monge budista mandou perguntar o segredo.");
  }
  if (key === "energy" && s.avg !== null) {
    if (s.avg >= 80) lines.push("🔋 Bateria média acima de 80. Esse corpo tá em modo Super Saiyajin.");
    else if (s.avg < 65) lines.push("🪫 Energy médio baixo. O Samsung tá dizendo: dorme mais e vai com calma nos treinos pesados.");
  }
  if (key === "hrv" && s.avg !== null && prev.avg !== null && s.avg < prev.avg * 0.9) lines.push("🫠 HRV caindo: o corpo tá acumulando cansaço. Semana com treino mais leve e sono caprichado resolve.");
  if (key === "hrv" && s.avg !== null && prev.avg !== null && s.avg > prev.avg * 1.1) lines.push("🧬 HRV subindo: recuperação nível Wolverine.");
  if (key === "spo2" && share((r) => r.v < 93) > 0.2) lines.push("🫁 Muitas noites abaixo de 93%. Se roncar alto ou acordar cansado, vale falar com um médico do sono.");
  if (key === "resp" && pct !== null && pct > 7) lines.push("🤧 Respiração subindo do teu normal. Às vezes é o corpo brigando com um resfriado antes de aparecer.");
  if (key === "temp" && valid.length && Math.abs(valid[valid.length - 1].v - s.avg) > 0.5) lines.push("🌡️ A última noite fugiu do teu normal em mais de meio grau. Calor, cobertor, álcool ou começo de gripe?");
  if (key === "snore" && share((r) => r.v >= 15) > 0.4) lines.push("🐻 Ronco em boa parte das noites. Dormir de lado, menos álcool à noite e nariz desentupido ajudam.");
  if (key === "snore" && valid.length && share((r) => r.v < 1) > 0.7) lines.push("🤫 Quase toda noite sem ronco. Quem dorme do lado agradece.");
  if (key === "floors" && s.avg !== null && s.avg >= 10) lines.push("🪜 Mais de 10 andares por dia em média. Elevador tá com saudade.");
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
  if (watchAn.unit === "day") {
    const day = watchAddDays(today, watchAn.offset);
    // v1.98: 😴 Sono tem a tela própria da noite (relogio-sono.js)
    const sleepDay = key === "sleep" && typeof renderWatchSleepDay === "function" ? renderWatchSleepDay(day)
      : key === "steps" && typeof renderWatchStepsDay === "function" ? renderWatchStepsDay(day) : ""; // v2.01: 👟 também (relogio-passos.js)
    el.innerHTML = watchAnNav(minOffset) + (sleepDay || renderWatchMetricDay(key, m, day));
    if (sleepDay && typeof watchSleepAfterRender === "function") watchSleepAfterRender();
    return;
  }
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
      : m.noBest
      ? watchAnTile("Variou", s.n ? `${escapeHtml(watchDec(s.best.v - s.worst.v))}` : "--", s.n ? `${escapeHtml(m.fmt(s.worst.v))} a ${escapeHtml(m.fmt(s.best.v))}` : "")
      : watchAnTile(m.better === "down" ? "Menor" : "Melhor", bestDay ? escapeHtml(m.fmt(bestDay.v)) : "--", bestDay ? watchAnDate(bestDay.date) : ""),
  ];
  const buckets = watchAnBuckets(rows, watchAn.unit);
  const grain = watchAn.unit === "week" || watchAn.unit === "month" ? "por dia" : watchAn.unit === "half" ? "média por semana" : "média por mês";
  const list = rows.filter((r) => r.v !== null).reverse();
  const shown = list.slice(0, watchAn.listShown);
  el.innerHTML = `
    ${watchAnNav(minOffset)}
    ${key === "kcal" ? watchAnBasalToggle() : ""}
    <div class="toba-stats is-3 watch-an-stats">${tiles.join("")}</div>
    <div class="card">
      <div class="card-title">📈 Evolução <span class="watch-muted">· ${grain}</span></div>
      ${key === "sleep" && typeof watchSleepStackChart === "function" && (watchAn.unit === "week" || watchAn.unit === "month")
        ? watchSleepStackChart(rows.map((r) => r.date), { goal, avg: s.avg, labels: buckets.map((b) => b.label) })
        : watchAnChart(buckets, m, goal, s.avg, { daily: watchAn.unit === "week" || watchAn.unit === "month" })}
    </div>
    ${watchAnCloba(key, m, s, prev, rows)}
    ${key === "steps" || key === "sleep" ? watchAnGoalExtras(rows, m) : ""}
    ${key === "sleep" ? watchAnSleepExtras(from, to) : ""}
    ${key === "sleep" && typeof watchSleepPeriodExtras === "function" ? watchSleepPeriodExtras(from, to) : ""}
    ${key === "heart" ? watchAnHeartExtras(from, to) : ""}
    ${m.zones ? watchAnZones(rows, m) : ""}
    ${key === "stress" ? watchAnStressExtras(from, to) : ""}
    ${key === "hrv" || key === "temp" || key === "resp" ? watchAnBaseline(key, m, rows) : ""}
    ${key === "spo2" ? watchAnSpo2Extras(from, to) : ""}
    ${watchAnAbout(key, m)}
    ${key === "sleep" && typeof wslMovesHtml === "function" ? wslMovesHtml(to < toIsoDate() ? to : toIsoDate())
      : key === "steps" && typeof wpsMovesHtml === "function" ? wpsMovesHtml(to < toIsoDate() ? to : toIsoDate()) : watchAnInsights(key)}
    ${watchAnWeekdays(rows, m)}
    ${watchAnRecords(key, m)}
    <div class="section-title">🗓️ Dias do período</div>
    <div class="toba-list">${shown.length ? shown.map((r) => `
      <div class="toba-list-item watch-row" role="button" tabindex="0" data-click="watchMetricGoDay" data-id="${r.date}">
        <span class="watch-row-date">${escapeHtml(watchDayLabel(r.date))}</span>
        <span class="watch-row-bits">${goal && r.v >= goal ? "🏆 " : ""}${escapeHtml(m.fmt(r.v))}</span>
        <span class="toba-hub-chevron">›</span>
      </div>`).join("") : tobaEmpty(m.icon, "Nenhum dia com dado", "", { compact: true })}
    </div>
    ${list.length > shown.length ? `<button type="button" class="btn btn-secondary" data-click="watchMetricMore">Mostrar mais (${list.length - shown.length})</button>` : ""}`;
}

/* ---------- v1.94 (🩻 RAIO ULTRA X): seções do corpo por dentro ---------- */

// Faixas: quantos dias do período em cada uma (barra empilhada + legenda)
function watchAnZones(rows, m) {
  const counts = m.zones.map(() => 0);
  let n = 0;
  rows.forEach((r) => {
    if (r.v === null) return;
    const z = m.zone(r.v, r.date);
    if (!z) return;
    counts[z.k]++;
    n++;
  });
  if (!n) return "";
  return `<div class="section-title">🎚️ Faixas</div>
    <div class="card">
      <div class="watch-an-zbar">${counts.map((c, i) => (c ? `<span style="flex:${c};background:${m.zones[i][1]}"></span>` : "")).join("")}</div>
      <div class="watch-an-zlegend">${counts.map((c, i) => `<span><i style="background:${m.zones[i][1]}"></i>${escapeHtml(m.zones[i][0])} <b>${c}</b> <small>(${Math.round((c / n) * 100)}%)</small></span>`).join("")}</div>
    </div>`;
}

// Stress: a hora que mais aperta (hora do pico de cada dia) e horas de stress alto por dia
function watchAnStressExtras(from, to) {
  const hours = Array(24).fill(0);
  let days = 0, high = 0, maxDay = null;
  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const d = watchDay(date);
    if (!d || d.stress === undefined) continue;
    days++;
    if (Number.isFinite(Number(d.stressPeak))) hours[Number(d.stressPeak)]++;
    high += Number(d.stressHigh) || 0;
    if (d.stressMax !== undefined && (!maxDay || d.stressMax > maxDay.v)) maxDay = { date, v: d.stressMax, h: d.stressPeak };
  }
  if (!days) return "";
  const top = hours.indexOf(Math.max(...hours));
  const max = Math.max(...hours) || 1;
  const period = top < 12 ? "de manhã" : top < 18 ? "de tarde" : "de noite";
  return `<div class="section-title">⏰ Hora do aperto</div>
    <div class="card">
      <div class="watch-an-hours">${hours.map((c, h) => `<span class="${h === top ? "is-top" : ""}" style="height:${Math.max(3, Math.round((c / max) * 100))}%" title="${h}h: ${c}"></span>`).join("")}</div>
      <div class="watch-an-hours-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
      <div class="toba-stats is-3">
        ${watchAnTile("⏰ Pico", `${top}h`, period)}
        ${watchAnTile("🔥 Alto", `${watchDec(high / days)} h`, "por dia (70+)")}
        ${watchAnTile("💥 Maior", maxDay ? watchInt(maxDay.v) : "--", maxDay ? `${watchAnDate(maxDay.date)} às ${maxDay.h}h` : "")}
      </div>
      <p class="watch-muted">O stress do dia costuma estourar lá pelas <b>${top}h</b>. Se dá pra prever, dá pra se preparar: água, respirar fundo e levantar da cadeira antes disso.</p>
    </div>`;
}

// HRV / temperatura / respiração: o TEU normal (60 dias antes do período) e quantos dias fugiram dele
function watchAnBaseline(key, m, rows) {
  const first = rows.find((r) => r.v !== null);
  if (!first) return "";
  const vals = [];
  for (let i = 1; i <= 60; i++) {
    const d = watchDay(watchAddDays(rows[0].date, -i));
    const v = d ? m.get(d) : undefined;
    if (v !== undefined && v !== null) vals.push(Number(v));
  }
  if (vals.length < 10) return "";
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length);
  const band = key === "temp" ? 0.5 : Math.max(sd, avg * 0.05);
  const lo = avg - band, hi = avg + band;
  const inside = rows.filter((r) => r.v !== null && r.v >= lo && r.v <= hi).length;
  const above = rows.filter((r) => r.v !== null && r.v > hi).length;
  const below = rows.filter((r) => r.v !== null && r.v < lo).length;
  const total = inside + above + below;
  const words = {
    hrv: ["🚀 acima (recuperado)", "🪫 abaixo (cansado)"],
    temp: ["🔥 mais quente", "🧊 mais fria"],
    resp: ["⚠️ mais rápida", "😌 mais lenta"],
  }[key];
  return `<div class="section-title">📏 O teu normal</div>
    <div class="card">
      <p class="watch-an-norm">${escapeHtml(m.fmt(lo))} <span class="watch-muted">até</span> ${escapeHtml(m.fmt(hi))}</p>
      <p class="watch-muted">Faixa dos 60 dias antes do período (média ${escapeHtml(m.fmt(avg))}). Comparar com você mesmo vale mais que qualquer tabela.</p>
      <div class="kv-list">
        <div class="kv-row"><span>✅ dentro do normal</span><strong>${inside} de ${total}</strong></div>
        <div class="kv-row"><span>${words[0]}</span><strong>${above}</strong></div>
        <div class="kv-row"><span>${words[1]}</span><strong>${below}</strong></div>
      </div>
    </div>`;
}

function watchAnSpo2Extras(from, to) {
  let low = null, n = 0, under = 0;
  for (let date = from; date <= to; date = watchAddDays(date, 1)) {
    const d = watchDay(date);
    if (!d || d.spo2Min === undefined) continue;
    n++;
    if (d.spo2Min < 88) under++;
    if (!low || d.spo2Min < low.v) low = { date, v: d.spo2Min };
  }
  if (!n) return "";
  return `<div class="card">
      <div class="toba-stats">
        ${watchAnTile("📉 Menor da noite", low ? `${low.v}%` : "--", low ? watchAnDate(low.date) : "")}
        ${watchAnTile("🌙 Noites com mín. < 88%", `${under}`, `de ${n}`)}
      </div>
      <p class="watch-muted">Cair um pouco de madrugada é normal; cair abaixo de 88% em muitas noites junto com ronco alto é coisa pra ver com médico.</p>
    </div>`;
}

// v1.91: botão do basal (só na análise das calorias)
function watchAnBasalToggle() {
  const on = watchKcalBasal();
  return `<div class="watch-an-basal">
      <button type="button" class="chip-btn${on ? " is-on" : ""}" data-click="watchToggleBasal" aria-pressed="${on}">${on ? "✅ Somando o basal" : "➕ Somar o basal"}</button>
      <span class="watch-muted">${on ? "Total do dia: ativas + o que o corpo gasta parado." : "Só ⚡ ativas, o que você queimou se mexendo. O basal (corpo parado) é quase igual todo dia."}</span>
    </div>${typeof watchScaleBasalPicker === "function" ? watchScaleBasalPicker() : ""}`;
}

function openWatchMetric(el) {
  const key = el.dataset.metric;
  if (!WATCH_METRICS[key]) return;
  watchAn.metric = key;
  watchAn.listShown = 31;
  // v1.95: abre no período que contém o dia escolhido na tela (Dia = o próprio dia)
  watchAn.offset = watchAnOffsetFor(watchAn.unit, watchSelDate());
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
  renderWatch(); // v1.95: volta no dia que ficou escolhido na análise
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
    watchAn.unit = WATCH_PERIODS.some((p) => p.unit === el.dataset.unit) ? el.dataset.unit : "day";
    watchAn.offset = watchAnOffsetFor(watchAn.unit, watchSelDate());
    watchAn.listShown = 31;
    renderWatchMetric();
  },
  watchMetricStep(el) {
    watchAn.offset = Math.min(0, watchAn.offset + (Number(el.dataset.step) || 0));
    watchAn.listShown = 31;
    watchAnSyncDate();
    renderWatchMetric();
  },
  watchMetricPick(el) {
    if (watchAn.unit === "day") {
      if (!el.value) return;
      watchAn.offset = Math.min(0, watchDaysBetween(toIsoDate(), el.value));
    } else watchAn.offset = Math.min(0, Number(el.value) || 0);
    watchAn.listShown = 31;
    watchAnSyncDate();
    renderWatchMetric();
  },
  // v1.95: tocar num dia da lista abre o Dia dele (na análise)
  watchMetricGoDay(el) {
    watchAn.unit = "day";
    watchAn.offset = Math.min(0, watchDaysBetween(toIsoDate(), el.dataset.id));
    watchAnSyncDate();
    renderWatchMetric();
    window.scrollTo(0, 0);
  },
  watchAnOpenPicker() {
    const input = document.getElementById("watchAnDateInput");
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch (err) {
      input.focus();
      input.click();
    }
  },
  watchAnDayAll(el) {
    openWatchDay(el);
  },
  watchAnBarTap,
  watchMetricMore() {
    watchAn.listShown += 31;
    renderWatchMetric();
  },
  watchToggleBasal() {
    watchSetKcalBasal(!watchKcalBasal());
    renderWatch(); // já refaz a análise aberta
  },
});

/* ---------- v1.95: 📆 Dia na análise ---------- */

// Período (da unidade) que contém o dia `iso`
function watchAnOffsetFor(unit, iso) {
  if (unit === "day") return Math.min(0, watchDaysBetween(toIsoDate(), iso));
  let o = 0;
  while (o > -600 && watchAnPeriod(unit, o).from > iso) o--;
  return o;
}

// Mexeu no dia dentro da análise: a tela principal acompanha
function watchAnSyncDate() {
  if (watchAn.unit === "day") watchUi.date = watchAddDays(toIsoDate(), watchAn.offset);
}

function watchAnNav(minOffset) {
  const tabs = `<div class="period-selector watch-an-periods" role="group" aria-label="Período">
      ${WATCH_PERIODS.map((p) => `<button type="button" class="period-btn${p.unit === watchAn.unit ? " active" : ""}" data-click="watchMetricPeriod" data-unit="${p.unit}">${p.label}</button>`).join("")}
    </div>`;
  let middle;
  if (watchAn.unit === "day") {
    const iso = watchAddDays(toIsoDate(), watchAn.offset);
    middle = `<div class="watch-daynav-pick watch-an-pick" role="button" tabindex="0" data-click="watchAnOpenPicker" aria-label="Escolher o dia">
        <span class="watch-daynav-main">${escapeHtml(watchDayLabel(iso))} <span class="watch-daynav-caret">▾</span></span>
        <span class="watch-daynav-sub">${escapeHtml(watchDateLong(iso))}</span>
        <input type="date" id="watchAnDateInput" class="watch-daynav-input" value="${iso}" max="${toIsoDate()}" min="${watchFirstDate()}" data-change="watchMetricPick" tabindex="-1" aria-hidden="true" />
      </div>`;
  } else {
    const options = [];
    for (let o = 0; o >= minOffset; o--) options.push(`<option value="${o}"${o === watchAn.offset ? " selected" : ""}>${escapeHtml(watchAnPeriod(watchAn.unit, o).label)}</option>`);
    middle = `<select class="watch-an-pick" data-change="watchMetricPick" aria-label="Escolher o período">${options.join("")}</select>`;
  }
  return `${tabs}
    <div class="watch-an-nav">
      <button type="button" class="toba-icon-btn" data-click="watchMetricStep" data-step="-1" aria-label="Anterior"${watchAn.offset <= minOffset ? " disabled" : ""}>‹</button>
      ${middle}
      <button type="button" class="toba-icon-btn" data-click="watchMetricStep" data-step="1" aria-label="Próximo"${watchAn.offset >= 0 ? " disabled" : ""}>›</button>
    </div>`;
}

// ℹ️ + ❔ Entenda (o que é, subir ou descer, como melhorar)
function watchAnAbout(key, m) {
  const help = typeof WATCH_HELP === "object" && WATCH_HELP[key];
  if (!m.about && !help) return "";
  return `<div class="watch-an-about">
      ${m.about ? `<p class="watch-muted">ℹ️ ${escapeHtml(m.about)}</p>` : ""}
      ${help ? `<button type="button" class="chip-btn watch-an-help" data-click="openWatchHelp" data-metric="${key}">❔ Entenda: subir ou descer é bom? Como melhorar?</button>` : ""}
    </div>`;
}

// Extras do dia por assunto (sono da noite, batimento, stress, oxigênio)
function watchAnDayExtras(key, date) {
  const d = watchDay(date);
  if (!d) return "";
  if (key === "sleep" && d.sleep && d.sleep.min > 0) {
    const s = d.sleep;
    const bedU = watchUsualClock(date, "start", 15 * 60);
    const wakeU = watchUsualClock(date, "end", 0);
    const diffTxt = (now, usual) => {
      if (usual === null) return "";
      const diff = now - usual;
      const t = watchClockDiff(diff);
      return t ? `${t} ${diff > 0 ? "mais tarde" : "mais cedo"}` : "no horário de sempre";
    };
    const staged = s.deep + s.light + s.rem;
    return `<div class="section-title">🛏️ A noite</div>
      <div class="card">
        <div class="toba-stats is-3">
          ${watchAnTile("🛏️ Deitou", watchClock(s.start), escapeHtml(diffTxt(watchAnClockMin(s.start, 15 * 60), bedU)))}
          ${watchAnTile("⏰ Acordou", watchClock(s.end), escapeHtml(diffTxt(watchAnClockMin(s.end, 0), wakeU)))}
          ${watchAnTile("Profundo", staged ? `${Math.round((s.deep / (staged + (s.awake || 0))) * 100)}%` : "--", staged ? watchHours(s.deep) : "sem fases")}
        </div>
        ${watchSleepBar(s)}
        ${s.napMin ? `<p class="watch-muted">💤 +${watchHours(s.napMin)} de cochilo nesse dia.</p>` : ""}
      </div>`;
  }
  if (key === "heart" && (d.restHr || d.hrMin || d.hrMax)) {
    return `<div class="card">
        <div class="toba-stats is-3">
          ${watchAnTile("💤 Repouso", d.restHr ? watchInt(d.restHr) : "--", "bpm")}
          ${watchAnTile("📉 Menor", d.hrMin ? watchInt(d.hrMin) : "--", "bpm")}
          ${watchAnTile("📈 Maior", d.hrMax ? watchInt(d.hrMax) : "--", "bpm")}
        </div>
      </div>`;
  }
  if (key === "stress" && d.stress !== undefined) {
    return `<div class="card">
        <div class="toba-stats is-3">
          ${watchAnTile("💥 Pico", d.stressMax !== undefined ? watchInt(d.stressMax) : "--", Number.isFinite(Number(d.stressPeak)) ? `às ${d.stressPeak}h` : "")}
          ${watchAnTile("🔥 Alto", d.stressHigh !== undefined ? `${watchInt(d.stressHigh)} h` : "--", "no 70+")}
          ${watchAnTile("📊 Média", watchInt(d.stress), "do dia")}
        </div>
      </div>`;
  }
  if (key === "spo2" && d.spo2Min !== undefined) {
    return `<div class="card">
        <div class="toba-stats">
          ${watchAnTile("📉 Menor da noite", `${d.spo2Min}%`, d.spo2Min < 88 ? "⚠️ caiu bastante" : "ok")}
          ${watchAnTile("📊 Média", `${d.spo2}%`, "da noite")}
        </div>
      </div>`;
  }
  return "";
}

function renderWatchMetricDay(key, m, date) {
  const isToday = date === toIsoDate();
  const r = watchRefs(key, date);
  const partial = watchIsPartial(key, date);
  const goal = m.goal ? m.goal() : 0;
  const zone = r.v !== null && m.zone ? m.zone(r.v, date) : null;
  const subBits = [zone ? `${zone.icon} ${zone.label}` : "", partial ? "até agora" : "", m.per && r.v !== null ? m.per : ""].filter(Boolean);
  const gpct = goal && r.v !== null ? Math.min(100, Math.round((r.v / goal) * 100)) : null;
  const hero = `<div class="card watch-an-day">
      <div class="watch-an-day-val" style="color:${m.color}">${r.v !== null ? escapeHtml(m.fmt(r.v)) : "--"}</div>
      <div class="watch-an-day-sub">${r.v !== null ? escapeHtml(subBits.join(" · ")) : `Sem ${escapeHtml(m.name.toLowerCase())} nesse dia`}</div>
      ${gpct !== null ? `<div class="progress-track"><div class="progress-fill" style="width:${gpct}%;background:${r.v >= goal ? "var(--gold-2)" : m.color}"></div></div>
        <p class="watch-muted">${r.v >= goal ? "🏆 Meta batida" : `${gpct}% da meta de ${escapeHtml(m.fmt(goal))}`}</p>` : ""}
    </div>`;
  const tiles = watchAnDayTiles(key, m, date);
  // 🤡 do dia
  const lines = watchAnDayCloba(key, m, date);
  const cloba = lines.length ? `<div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Papo reto do Cloba</b>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>` : "";
  const rows = watchAnRows(key, watchAddDays(date, -13), date).map((x) => ({ ...x, label: x.date.slice(8, 10) }));
  return `
    ${key === "kcal" ? watchAnBasalToggle() : ""}
    ${hero}
    <div class="toba-stats is-3 watch-an-stats">${tiles.join("")}</div>
    <div class="card">
      <div class="card-title">📈 Os 14 dias até ${escapeHtml(watchDayLabel(date).toLowerCase())}</div>
      ${watchAnChart(rows, m, goal, r.w, { hi: date, avgLabel: "média 7 dias", daily: true })}
    </div>
    ${cloba}
    ${watchAnDayExtras(key, date)}
    ${watchAnAbout(key, m)}
    ${watchHasData(watchDay(date)) ? `<button type="button" class="btn btn-secondary watch-an-dayall" data-click="watchAnDayAll" data-id="${date}">📋 Tudo desse dia</button>` : ""}`;
}

// v1.98: os 3 quadrados vs ontem / 7 dias / 30 dias (também na tela do 😴 Sono)
function watchAnDayTiles(key, m, date) {
  const r = watchRefs(key, date);
  const partial = watchIsPartial(key, date);
  const tile = (label, ref, refLabel) => {
    if (ref === null) return watchAnTile(label, "--", "sem dado");
    const info = watchDeltaInfo(key, r.v, ref, partial);
    if (partial) return watchAnTile(label, escapeHtml(m.fmt(ref)), info ? escapeHtml(info.txt) : "");
    const cls = info && info.cls === "is-good" ? "text-green" : info && info.cls === "is-bad" ? "text-coral" : "";
    return watchAnTile(label, info ? escapeHtml(info.txt) : "--", `${refLabel}: ${escapeHtml(m.fmt(ref))}`, cls);
  };
  return partial
    ? [tile("Ontem", r.y), tile("Média 7d", r.w), tile("Média 30d", r.n30)]
    : [tile("vs Ontem", r.y, "ontem"), tile("vs 7 dias", r.w, "média"), tile("vs 30 dias", r.n30, "média")];
}

// v1.98: frases do 🤡 do dia (lista de texto puro)
function watchAnDayCloba(key, m, date) {
  const isToday = date === toIsoDate();
  const r = watchRefs(key, date);
  const partial = watchIsPartial(key, date);
  const goal = m.goal ? m.goal() : 0;
  const lines = [];
  if (isToday && key === "steps") {
    const pace = watchPaceText(r.v || 0, goal);
    if (pace) lines.push(pace);
  } else if (!partial) {
    const rank = watchRankText(key, date);
    if (rank) lines.push(rank);
  }
  if (!partial && r.v !== null && r.n30 !== null && m.better !== "none") {
    const pct = ((r.v - r.n30) / r.n30) * 100;
    const good = m.better === "up" ? pct > 0 : pct < 0;
    if (Math.abs(pct) >= (m.zoom ? 5 : 10)) lines.push(good ? `😎 ${Math.abs(Math.round(pct))}% ${pct > 0 ? "acima" : "abaixo"} do teu normal dos últimos 30 dias. Dia bom!` : `🫠 ${Math.abs(Math.round(pct))}% ${pct > 0 ? "acima" : "abaixo"} do teu normal dos últimos 30 dias. Acontece, amanhã tem revanche.`);
    else lines.push("➡️ Bem no teu normal dos últimos 30 dias.");
  }
  if (!partial && key === "temp" && r.v !== null && r.n30 !== null && Math.abs(r.v - r.n30) > 0.5) lines.push(`🌡️ ${r.v > r.n30 ? "Mais quente" : "Mais fria"} que o teu normal em mais de meio grau. Calor, cobertor, álcool ou começo de gripe?`);
  return lines;
}
