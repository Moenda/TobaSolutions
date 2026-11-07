/*
 * Toba Health · 🩻 Raio-X · 🏆 Hall dos Recordes (v1.96)
 *
 * Pedido do Rafa: "um troféu tipo highscore perto do anel que abre o top 3 de tudo
 * (top 3 passos, top 3 sono...), UI mega foda Cloba edition".
 * Botão 🏆 no canto do herói (brilha com 🆕 quando o dia escolhido entrou num top 3) ›
 * subtela viewWatchRecords: pódio dos passos, top 3 de cada assunto, semana/mês/sequência.
 * Filtro: Sempre / Este ano / 30 dias. Tocar num dia abre ele na tela do Raio-X.
 * Só LÊ o TOBA_HEALTH_DB.watch.days.
 */

// get(d) = número do dia; better: "up" (maior ganha) ou "down" (menor ganha)
const WATCH_RECORDS = [
  { key: "steps", icon: "👟", name: "Passos", better: "up", get: (d) => d.steps, fmt: (v) => watchInt(v), metric: "steps", color: "var(--green)" },
  { key: "distance", icon: "📏", name: "Distância", better: "up", get: (d) => d.distanceM, fmt: (v) => watchKm(v), metric: "distance", color: "var(--blue)" },
  { key: "active", icon: "🔥", name: "Calorias ativas", better: "up", get: (d) => d.activeKcal, fmt: (v) => `${watchInt(v)} kcal`, metric: "kcal", color: "var(--coral)" },
  { key: "floors", icon: "🪜", name: "Andares", better: "up", get: (d) => d.floors, fmt: (v) => watchInt(v), metric: "floors", color: "var(--green)" },
  { key: "sleep", icon: "😴", name: "Maior noite", better: "up", get: (d) => (d.sleep ? d.sleep.min : undefined), fmt: (v) => watchHours(v), metric: "sleep", color: "var(--blue)" },
  { key: "deep", icon: "🌊", name: "Sono profundo", better: "up", get: (d) => (d.sleep && d.sleep.deep > 0 ? d.sleep.deep : undefined), fmt: (v) => watchHours(v), metric: "sleep", color: "#3b5bdb" },
  { key: "hrv", icon: "💓", name: "HRV", better: "up", get: (d) => d.hrv, fmt: (v) => `${watchInt(v)} ms`, metric: "hrv", color: "var(--purple, #a371f7)" },
  { key: "energy", icon: "🔋", name: "Energy Score", better: "up", get: (d) => d.energy, fmt: (v) => watchInt(v), metric: "energy", color: "var(--gold-2)" },
  { key: "rest", icon: "❤️", name: "Coração mais calmo", better: "down", get: (d) => d.restHr, fmt: (v) => `${watchInt(v)} bpm`, metric: "heart", color: "var(--red, #f85149)", note: "repouso mais baixo" },
  { key: "zen", icon: "😌", name: "Dia mais zen", better: "down", get: (d) => d.stress, fmt: (v) => watchInt(v), metric: "stress", color: "var(--teal, #39c5cf)", note: "menor stress médio" },
];
const WATCH_REC_SCOPES = [
  { id: "all", label: "🏛️ Sempre" },
  { id: "year", label: "📅 Este ano" },
  { id: "30", label: "🗓️ 30 dias" },
];
const WATCH_MEDALS = ["🥇", "🥈", "🥉"];
const watchRec = { scope: "all" };

function watchRecFrom(scope) {
  const today = toIsoDate();
  if (scope === "year") return `${today.slice(0, 4)}-01-01`;
  if (scope === "30") return watchAddDays(today, -29);
  return "0000-00-00";
}

// Top 3 de um recorde (dias diferentes; empate = o mais antigo fica na frente, chegou primeiro)
function watchRecTop(rec, from, n = 3) {
  const list = [];
  Object.keys(watchDays()).forEach((date) => {
    if (date < from) return;
    const d = watchDay(date);
    const v = d ? rec.get(d) : undefined;
    if (v === undefined || v === null || !(Number(v) > 0)) return;
    list.push({ date, v: Number(v) });
  });
  list.sort((a, b) => (rec.better === "down" ? a.v - b.v : b.v - a.v) || (a.date < b.date ? -1 : 1));
  return list.slice(0, n);
}

// Semana (seg-dom) e mês com mais passos, e as maiores sequências na meta
function watchRecBlocks(from) {
  const goals = watchGoals();
  const weeks = {}, months = {};
  const dates = Object.keys(watchDays()).filter((x) => x >= from).sort();
  dates.forEach((date) => {
    const d = watchDay(date);
    const s = Number(d && d.steps) || 0;
    if (!s) return;
    const monday = watchAddDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
    weeks[monday] = (weeks[monday] || 0) + s;
    const ym = date.slice(0, 7);
    months[ym] = (months[ym] || 0) + s;
  });
  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const streak = (test) => {
    let best = null, cur = 0, start = "";
    let prev = "";
    dates.forEach((date) => {
      const ok = test(watchDay(date));
      if (ok && prev && watchAddDays(prev, 1) === date && cur) cur++;
      else if (ok) { cur = 1; start = date; }
      else cur = 0;
      if (cur && (!best || cur > best.n)) best = { n: cur, from: start, to: date };
      prev = date;
    });
    return best;
  };
  return {
    weeks: top(weeks),
    months: top(months),
    stepStreak: streak((d) => d && Number(d.steps) >= goals.steps),
    sleepStreak: streak((d) => d && d.sleep && d.sleep.min >= goals.sleepMin),
  };
}

function watchRecDate(iso) {
  return `${watchWeekday(iso)}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

function watchRecAgo(iso) {
  const n = watchDaysBetween(iso, toIsoDate());
  if (n === 0) return "hoje";
  if (n === 1) return "ontem";
  if (n < 31) return `há ${n} dias`;
  if (n < 365) return `há ${Math.round(n / 30)} ${Math.round(n / 30) === 1 ? "mês" : "meses"}`;
  return `há ${(n / 365).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ano(s)`;
}

// Quantos top 3 (sempre) o dia `date` tem: o 🏆 do herói brilha
function watchRecordsOn(date) {
  const out = [];
  WATCH_RECORDS.forEach((rec) => {
    const pos = watchRecTop(rec, "0000-00-00").findIndex((r) => r.date === date);
    if (pos >= 0) out.push({ rec, pos });
  });
  return out;
}

function watchRecordsBadge(sel) {
  if (!Object.keys(watchDays()).length) return "";
  const hits = watchRecordsOn(sel);
  const gold = hits.some((h) => h.pos === 0);
  return `<button type="button" class="watch-rec-badge${hits.length ? " is-hot" : ""}${gold ? " is-gold" : ""}" data-click="openWatchRecords" aria-label="Hall dos Recordes">
      <span class="watch-rec-badge-icon">🏆</span>
      <span class="watch-rec-badge-text">${hits.length ? `🆕 ${hits.length} top 3` : "Recordes"}</span>
    </button>`;
}

function watchRecRow(rec, r, i, sel) {
  const isNew = watchDaysBetween(r.date, toIsoDate()) <= 6;
  return `<div class="watch-rec-row is-p${i + 1}${r.date === sel ? " is-sel" : ""}" role="button" tabindex="0" data-click="watchGoDay" data-id="${r.date}">
      <span class="watch-rec-medal">${WATCH_MEDALS[i]}</span>
      <span class="watch-rec-when"><b>${escapeHtml(watchRecDate(r.date))}</b><small>${escapeHtml(watchRecAgo(r.date))}${isNew ? ` · <em>🆕 fresquinho</em>` : ""}</small></span>
      <span class="watch-rec-val">${escapeHtml(rec.fmt(r.v))}</span>
    </div>`;
}

function watchRecPodium(rec, top) {
  if (top.length < 1) return "";
  const order = [1, 0, 2].filter((i) => top[i]); // 🥈 🥇 🥉
  return `<div class="watch-podium">
      <div class="watch-podium-title">${rec.icon} Pódio dos ${escapeHtml(rec.name.toLowerCase())}</div>
      <div class="watch-podium-steps">${order.map((i) => `
        <button type="button" class="watch-podium-col is-p${i + 1}" data-click="watchGoDay" data-id="${top[i].date}">
          <span class="watch-podium-medal">${WATCH_MEDALS[i]}</span>
          <span class="watch-podium-val">${escapeHtml(rec.fmt(top[i].v))}</span>
          <span class="watch-podium-date">${escapeHtml(top[i].date.slice(8, 10))}/${escapeHtml(top[i].date.slice(5, 7))}/${escapeHtml(top[i].date.slice(2, 4))}</span>
          <span class="watch-podium-block"><b>${i + 1}</b></span>
        </button>`).join("")}</div>
    </div>`;
}

function renderWatchRecords() {
  const el = document.getElementById("watchRecordsBody");
  if (!el) return;
  const from = watchRecFrom(watchRec.scope);
  const sel = watchSelDate();
  const dates = Object.keys(watchDays()).sort();
  const scopes = `<div class="period-selector watch-rec-scopes" role="group" aria-label="Período">
      ${WATCH_REC_SCOPES.map((s) => `<button type="button" class="period-btn${s.id === watchRec.scope ? " active" : ""}" data-click="watchRecScope" data-id="${s.id}">${s.label}</button>`).join("")}
    </div>`;
  if (!dates.length) {
    el.innerHTML = scopes + tobaEmpty("🏆", "Nenhum recorde ainda", "Puxa do relógio no 🔄 ou importa o histórico do Samsung na ⚙️.");
    return;
  }
  const stepsTop = watchRecTop(WATCH_RECORDS[0], from);
  const cards = WATCH_RECORDS.slice(1).map((rec) => {
    const top = watchRecTop(rec, from);
    if (!top.length) return "";
    return `<div class="watch-rec-card" style="--rec:${rec.color}">
        <div class="watch-rec-head" role="button" tabindex="0" data-click="watchRecAnalyse" data-metric="${rec.metric}">
          <span class="watch-rec-icon">${rec.icon}</span>
          <span class="watch-rec-title">${escapeHtml(rec.name)}${rec.note ? `<small>${escapeHtml(rec.note)}</small>` : ""}</span>
          <span class="watch-rec-more">🔬 ›</span>
        </div>
        ${top.map((r, i) => watchRecRow(rec, r, i, sel)).join("")}
      </div>`;
  }).filter(Boolean);
  const b = watchRecBlocks(from);
  const f = (iso) => `${Number(iso.slice(8, 10))} ${WATCH_MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
  const blockRows = [];
  if (b.weeks.length) {
    blockRows.push(`<div class="watch-rec-card" style="--rec:var(--green)">
        <div class="watch-rec-head"><span class="watch-rec-icon">🗓️</span><span class="watch-rec-title">Semana mais andada<small>passos de seg a dom</small></span></div>
        ${b.weeks.map(([monday, v], i) => `<div class="watch-rec-row is-p${i + 1}" role="button" tabindex="0" data-click="watchGoDay" data-id="${watchAddDays(monday, 6) > toIsoDate() ? toIsoDate() : watchAddDays(monday, 6)}">
          <span class="watch-rec-medal">${WATCH_MEDALS[i]}</span>
          <span class="watch-rec-when"><b>${escapeHtml(f(monday))} a ${escapeHtml(f(watchAddDays(monday, 6)))}${monday.slice(0, 4) !== toIsoDate().slice(0, 4) ? ` ${monday.slice(0, 4)}` : ""}</b><small>${escapeHtml(watchRecAgo(monday))}</small></span>
          <span class="watch-rec-val">${watchInt(v)}</span>
        </div>`).join("")}
      </div>`);
  }
  if (b.months.length) {
    blockRows.push(`<div class="watch-rec-card" style="--rec:var(--gold-2)">
        <div class="watch-rec-head"><span class="watch-rec-icon">📆</span><span class="watch-rec-title">Mês mais andado<small>passos no mês</small></span></div>
        ${b.months.map(([ym, v], i) => `<div class="watch-rec-row is-p${i + 1}">
          <span class="watch-rec-medal">${WATCH_MEDALS[i]}</span>
          <span class="watch-rec-when"><b>${escapeHtml(WATCH_MONTHS_LONG[Number(ym.slice(5, 7)) - 1])} ${ym.slice(0, 4)}</b></span>
          <span class="watch-rec-val">${watchInt(v)}</span>
        </div>`).join("")}
      </div>`);
  }
  const streakTile = (icon, label, s) => `<div class="watch-rec-streak">
      <span class="watch-rec-streak-icon">${icon}</span>
      <b>${s ? `${s.n} ${s.n === 1 ? "dia" : "dias"}` : "--"}</b>
      <span>${escapeHtml(label)}</span>
      <small>${s ? `${escapeHtml(f(s.from))} a ${escapeHtml(f(s.to))}` : "ainda não rolou"}</small>
    </div>`;
  const total = dates.filter((x) => x >= from).length;
  el.innerHTML = `
    ${scopes}
    <div class="watch-rec-hero">
      <div class="watch-rec-hero-glow"></div>
      <div class="watch-rec-hero-trophy">🏆</div>
      <div class="watch-rec-hero-title">Hall dos Recordes</div>
      <div class="watch-rec-hero-sub">${watchRec.scope === "all" ? `desde ${escapeHtml(watchRecDate(dates[0]))}` : watchRec.scope === "year" ? `em ${toIsoDate().slice(0, 4)}` : "nos últimos 30 dias"} · ${watchInt(total)} dias de relógio</div>
    </div>
    ${watchRecPodium(WATCH_RECORDS[0], stepsTop)}
    <div class="watch-rec-streaks">
      ${streakTile("🔥", "seguidos na meta de passos", b.stepStreak)}
      ${streakTile("😴", "seguidos na meta de sono", b.sleepStreak)}
    </div>
    <div class="section-title">🥇 Top 3 de cada</div>
    <div class="watch-rec-grid">${cards.join("")}</div>
    ${blockRows.length ? `<div class="section-title">🗓️ Semana e mês</div><div class="watch-rec-grid">${blockRows.join("")}</div>` : ""}
    <div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Papo reto do Cloba</b><p>${escapeHtml(watchRecCloba(from))}</p></div></div>
    <p class="watch-muted watch-rec-foot">Toca num dia pra abrir ele no Raio-X. Empate = quem chegou primeiro fica na frente.</p>`;
}

function watchRecCloba(from) {
  const recent = [];
  WATCH_RECORDS.forEach((rec) => {
    const top = watchRecTop(rec, from);
    top.forEach((r, i) => {
      if (watchDaysBetween(r.date, toIsoDate()) <= 6) recent.push({ rec, i });
    });
  });
  const golds = recent.filter((x) => x.i === 0);
  if (golds.length) return `${golds.map((x) => x.rec.icon).join("")} Recorde quebrado essa semana! Nunca foi sorte, Cloba. Nunca foi sorte. 🙏`;
  if (recent.length) return `${recent.length} ${recent.length === 1 ? "lugar no pódio conquistado" : "lugares no pódio conquistados"} nos últimos 7 dias. Tá subindo de rank igual no RuneScape. 📈`;
  return "Nenhum pódio novo essa semana. O 🥇 dos passos tá ali em cima te encarando... bora buscar? 👊";
}

function openWatchRecords() {
  document.getElementById("viewWatchMain").classList.remove("active");
  document.getElementById("viewWatchMetric").classList.remove("active");
  document.getElementById("viewWatchRecords").classList.add("active");
  tobaSetHeader({ page: "🏆 Recordes", back: "closeWatchRecords" });
  renderWatchRecords();
  window.scrollTo(0, 0);
}

function closeWatchRecords() {
  document.getElementById("viewWatchRecords").classList.remove("active");
  document.getElementById("viewWatchMain").classList.add("active");
  tobaSetHeader({ page: "🩻 Raio-X" });
  renderWatch();
  window.scrollTo(0, 0);
}

function watchRecordsOpen() {
  const v = document.getElementById("viewWatchRecords");
  return !!(v && v.classList.contains("active"));
}

tobaActions({
  openWatchRecords,
  closeWatchRecords,
  watchRecScope(el) {
    watchRec.scope = WATCH_REC_SCOPES.some((s) => s.id === el.dataset.id) ? el.dataset.id : "all";
    renderWatchRecords();
  },
  watchRecAnalyse(el) {
    document.getElementById("viewWatchRecords").classList.remove("active");
    openWatchMetric(el);
  },
});
