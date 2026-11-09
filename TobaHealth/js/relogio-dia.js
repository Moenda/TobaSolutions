/*
 * Toba Health · 🩻 Raio-X · 📆 Visão do dia (v1.95)
 *
 * Pedido do Rafa: "deveria ter o dia tbm, pra eu comparar com ontem... semana... como tá
 * teu andamento, mas não pode ser poluído". A tela principal virou o DIA escolhido:
 *   ‹ Hoje › (ou qualquer dia, pelo calendário ou arrastando pro lado)
 *   👟 anel dos passos + andamento (ritmo de hoje / posição no mês)
 *   📊 Hoje x ontem x 7 dias: cada número com a barrinha e as duas comparações
 *   😴 a noite daquele dia comparada com a anterior e com a semana
 *   🧬 Corpo por dentro daquele dia, cada quadrado com ❔ (o que é, subir ou descer, como melhorar)
 *   🗓️ Tua semana: os 7 dias + semana até agora x semana passada até o mesmo dia
 * Só LÊ o TOBA_HEALTH_DB.watch.days. O dia escolhido fica em watchUi.date (só na tela).
 */

/* ---------------- Dia escolhido ---------------- */

function watchSelDate() {
  const today = toIsoDate();
  if (!watchUi.date || watchUi.date > today) watchUi.date = today;
  return watchUi.date;
}

function watchDaysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
}

function watchFirstDate() {
  const dates = Object.keys(watchDays()).sort();
  return dates.length ? dates[0] : toIsoDate();
}

function watchSetDate(iso) {
  const today = toIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return;
  watchUi.date = iso > today ? today : iso;
  renderWatch();
}

function watchDateLong(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${WATCH_WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${WATCH_MONTHS_LONG[d.getMonth()].toLowerCase()}${iso.slice(0, 4) !== toIsoDate().slice(0, 4) ? ` de ${iso.slice(0, 4)}` : ""}`;
}

function renderWatchDayNav() {
  const el = document.getElementById("watchDayNav");
  if (!el) return;
  const sel = watchSelDate();
  const today = toIsoDate();
  const isToday = sel === today;
  el.innerHTML = `
    <button type="button" class="toba-icon-btn" data-click="watchDayStep" data-step="-1" aria-label="Dia anterior">‹</button>
    <div class="watch-daynav-pick" role="button" tabindex="0" data-click="watchOpenPicker" aria-label="Escolher o dia">
      <span class="watch-daynav-main">${escapeHtml(watchDayLabel(sel))} <span class="watch-daynav-caret">▾</span></span>
      <span class="watch-daynav-sub">${escapeHtml(watchDateLong(sel))}</span>
      <input type="date" id="watchDateInput" class="watch-daynav-input" value="${sel}" max="${today}" min="${watchFirstDate()}" data-change="watchPickDate" tabindex="-1" aria-hidden="true" />
    </div>
    ${isToday
      ? `<button type="button" class="toba-icon-btn" disabled aria-label="Próximo dia">›</button>`
      : `<button type="button" class="toba-icon-btn" data-click="watchDayStep" data-step="1" aria-label="Próximo dia">›</button>`}
    ${isToday ? "" : `<button type="button" class="chip-btn watch-daynav-today" data-click="watchGoToday">↩️ Voltar pra hoje</button>`}`;
}

/* ---------------- Comparações ---------------- */

function watchMetricVal(key, date) {
  const m = WATCH_METRICS[key];
  const d = watchDay(date);
  if (!m || !d) return null;
  const v = m.get(d);
  if (v === undefined || v === null || !Number.isFinite(Number(v))) return null;
  if (Number(v) > 0 || (m.zeroOk && Number(v) === 0)) return Number(v);
  return null;
}

// Média dos `days` dias ANTES de `date` (precisa de `min` dias com dado)
function watchMetricAvg(key, date, days, min) {
  let sum = 0, n = 0;
  for (let i = 1; i <= days; i++) {
    const v = watchMetricVal(key, watchAddDays(date, -i));
    if (v !== null) { sum += v; n++; }
  }
  return n >= min ? sum / n : null;
}

// { v, y (ontem), w (média dos 7 dias antes), n30 (média dos 30 dias antes) }
function watchRefs(key, date) {
  return {
    v: watchMetricVal(key, date),
    y: watchMetricVal(key, watchAddDays(date, -1)),
    w: watchMetricAvg(key, date, 7, 3),
    n30: watchMetricAvg(key, date, 30, 7),
  };
}

// Hoje ainda tá rolando: passos/km/kcal/andares de hoje não dá pra comparar em % com o dia
// inteiro de ontem. Aí mostra quanto falta pra empatar.
function watchIsPartial(key, date) {
  const m = WATCH_METRICS[key];
  return Boolean(m && m.sum && date === toIsoDate());
}

function watchDeltaInfo(key, v, ref, partial) {
  const m = WATCH_METRICS[key];
  if (v === null || ref === null || !(ref > 0 || (m.zeroOk && ref === 0))) return null;
  if (partial) {
    return v >= ref ? { cls: "is-good", txt: "✅ já passou", pct: null } : { cls: "", txt: `faltam ${m.fmt(ref - v)}`, pct: null };
  }
  if (ref === 0) return v === 0 ? { cls: "", txt: "= igual", pct: 0 } : { cls: m.better === "down" ? "is-bad" : "is-good", txt: `▲ ${m.fmt(v)}`, pct: null };
  const pct = ((v - ref) / ref) * 100;
  const lim = m.zoom ? 1 : 2;
  if (Math.abs(pct) < lim) return { cls: "", txt: "= igual", pct };
  const good = m.better === "none" ? null : m.better === "up" ? pct > 0 : pct < 0;
  return { cls: good === null ? "" : good ? "is-good" : "is-bad", txt: `${pct > 0 ? "▲" : "▼"} ${Math.abs(Math.round(pct)) || "<1"}%`, pct };
}

function watchDeltaChip(key, v, ref, label, partial) {
  const info = watchDeltaInfo(key, v, ref, partial);
  if (!info) return `<span class="watch-delta is-none">${label} --</span>`;
  return `<span class="watch-delta ${info.cls}">${escapeHtml(info.txt)} <small>${label}</small></span>`;
}

// Barrinha: o valor do dia + risquinho de ontem e da média dos 7 dias
function watchCmpBar(key, r) {
  const m = WATCH_METRICS[key];
  const vals = [r.v, r.y, r.w].filter((x) => x !== null);
  if (!vals.length) return "";
  let lo = 0;
  let hi = Math.max(...vals) * 1.12 || 1;
  if (m.zoom) { // coração/HRV/oxigênio: escala perto dos valores, senão fica tudo igual
    lo = Math.min(...vals) * 0.9;
    hi = Math.max(...vals) * 1.04;
  }
  const pos = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo || 1)) * 100));
  return `<div class="watch-cmp-bar">
      ${r.v !== null ? `<span class="watch-cmp-fill" style="width:${pos(r.v).toFixed(1)}%;background:${m.color}"></span>` : ""}
      ${r.y !== null ? `<i class="watch-cmp-mark is-y" style="left:${pos(r.y).toFixed(1)}%"></i>` : ""}
      ${r.w !== null ? `<i class="watch-cmp-mark is-w" style="left:${pos(r.w).toFixed(1)}%"></i>` : ""}
    </div>`;
}

const WATCH_CMP_ROWS = [
  { key: "steps", label: "👟 Passos" },
  { key: "kcal", label: "🔥 Calorias" },
  { key: "distance", label: "📏 Distância" },
  { key: "heart", label: "❤️ Coração" },
  { key: "floors", label: "🪜 Andares" },
];

function watchCmpRow(row, date) {
  const r = watchRefs(row.key, date);
  if (r.v === null && r.y === null && r.w === null) return "";
  const m = WATCH_METRICS[row.key];
  const partial = watchIsPartial(row.key, date);
  const label = row.key === "kcal" ? (watchKcalBasal() ? "🔥 Calorias" : "🔥 Ativas") : row.key === "heart" ? "❤️ Batimento" : row.label;
  return `<div class="watch-cmp-row watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="${row.key}">
      <div class="watch-cmp-top">
        <span class="watch-cmp-name">${label}</span>
        <b class="watch-cmp-val">${r.v !== null ? escapeHtml(m.fmt(r.v)) : "--"}${row.key === "heart" && r.v !== null ? ` <small>média</small>` : ""}</b>
      </div>
      ${watchCmpBar(row.key, r)}
      <div class="watch-cmp-deltas">
        ${watchDeltaChip(row.key, r.v, r.y, partial ? "pra ontem" : "vs ontem", partial)}
        ${watchDeltaChip(row.key, r.v, r.w, partial ? "pra tua média" : "vs 7 dias", partial)}
      </div>
    </div>`;
}

/* ---------------- 👟 Herói do dia ---------------- */

// Hoje: no ritmo de agora, fecha em quanto? (conta simples: dia acordado das 7h às 23h)
function watchPaceText(steps, goal) {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const f = (h - 7) / 16;
  if (!(steps > 0) || f < 0.2 || f >= 0.97) return "";
  // v2.01: o resto do dia no TEU ritmo normal (30 dias), não o ritmo de agora esticado
  // (às 10h com 5.700 dava "fecha em 27.600"). Sem histórico, cai na conta antiga.
  const n30 = watchMetricAvg("steps", watchAddDays(toIsoDate(), -1), 30, 5);
  const proj = Math.round((n30 !== null ? steps + (1 - f) * n30 : steps / f) / 100) * 100;
  if (steps >= goal) return `🏆 Meta batida e o dia nem acabou. No ritmo, fecha em ~${watchInt(proj)}.`;
  if (proj >= goal) return `🚶 No ritmo de agora, fecha em ~${watchInt(proj)}: dá pra bater a meta.`;
  return `🐢 No ritmo de agora, fecha em ~${watchInt(proj)}. Faltam ${watchInt(goal - steps)} pra meta.`;
}

// Dia que já passou: posição entre os últimos 30 dias
function watchRankText(key, date) {
  const m = WATCH_METRICS[key];
  const v = watchMetricVal(key, date);
  if (v === null) return "";
  const vals = [];
  for (let i = 0; i < 30; i++) {
    const x = watchMetricVal(key, watchAddDays(date, -i));
    if (x !== null) vals.push(x);
  }
  if (vals.length < 7) return "";
  const better = m.better === "down" ? vals.filter((x) => x < v).length : vals.filter((x) => x > v).length;
  const pos = better + 1;
  if (pos === 1) return `🥇 Melhor dia de ${m.name.toLowerCase()} dos últimos 30.`;
  if (pos <= 3) return `🏅 ${pos}º melhor dia de ${m.name.toLowerCase()} dos últimos 30.`;
  if (pos > vals.length - 3) return `🪫 Um dos dias mais fracos de ${m.name.toLowerCase()} dos últimos 30.`;
  return `📊 ${pos}º de ${vals.length} dias de ${m.name.toLowerCase()} nos últimos 30.`;
}

function renderWatchToday() {
  const el = document.getElementById("watchToday");
  if (!el) return;
  const sel = watchSelDate();
  const isToday = sel === toIsoDate();
  const day = watchDay(sel) || {};
  const goal = watchGoals().steps;
  const steps = Number(day.steps) || 0;
  const done = steps >= goal;
  const r = watchRefs("steps", sel);
  const headline = isToday ? watchPaceText(steps, goal) : watchRankText("steps", sel);
  const yInfo = watchDeltaInfo("steps", r.v, r.y, isToday);
  const rows = WATCH_CMP_ROWS.map((row) => watchCmpRow(row, sel)).filter(Boolean);
  el.innerHTML = `
    <div class="watch-hero">
      ${typeof watchRecordsBadge === "function" ? watchRecordsBadge(sel) : ""}
      <div class="watch-ring-wrap watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="steps" aria-label="Análise dos passos">
        ${watchRing(steps, goal, done ? "var(--gold-2)" : "var(--green)")}
        <div class="watch-ring-text">
          <span class="watch-ring-num">${day.steps !== undefined ? watchInt(steps) : "--"}</span>
          <span class="watch-ring-label">👟 passos ${isToday ? "hoje" : "no dia"}</span>
          <span class="watch-ring-goal">${done ? "🏆 meta batida!" : `meta ${watchInt(goal)}`}</span>
          ${yInfo && day.steps !== undefined ? `<span class="watch-ring-vs ${yInfo.cls}">${isToday ? (yInfo.cls ? "✅ já passou ontem" : `ontem fechou ${watchInt(r.y)}`) : `${escapeHtml(yInfo.txt)} vs ontem`}</span>` : ""}
        </div>
      </div>
    </div>
    ${headline ? `<p class="watch-headline">${escapeHtml(headline)}</p>` : ""}
    ${rows.length > 1 ? `<div class="watch-cmp">
      <div class="watch-cmp-head"><span>📊 ${isToday ? "Hoje" : "O dia"} x ontem x 7 dias</span>
        <span class="watch-cmp-legend"><i class="is-y"></i>ontem <i class="is-w"></i>média</span></div>
      ${rows.slice(1).join("")}
    </div>` : ""}
    ${watchHasData(watchDay(sel)) ? `<button type="button" class="watch-allday" data-click="openWatchDay" data-id="${sel}">📋 Tudo desse dia ›</button>` : ""}`;
}

/* ---------------- 😴 A noite do dia ---------------- */

function watchNightFor(sel) {
  const d = watchDay(sel);
  if (d && d.sleep && d.sleep.min > 0) return { date: sel, sleep: d.sleep, exact: true };
  if (sel !== toIsoDate()) return null;
  // Hoje sem a noite ainda (relógio não sincronizou): mostra a última que tem, avisando
  const dates = Object.keys(watchDays()).filter((x) => x <= sel && watchDay(x).sleep && watchDay(x).sleep.min > 0).sort();
  if (!dates.length) return null;
  const date = dates[dates.length - 1];
  return { date, sleep: watchDay(date).sleep, exact: false };
}

// Média do horário de deitar/acordar dos 7 dias antes (pra dizer "mais tarde que o normal")
function watchUsualClock(date, field, pivot) {
  const vals = [];
  for (let i = 1; i <= 7; i++) {
    const d = watchDay(watchAddDays(date, -i));
    if (d && d.sleep && d.sleep.min > 0 && Number.isFinite(Number(d.sleep[field]))) vals.push(watchAnClockMin(Number(d.sleep[field]), pivot)); // v2.01: noite sem horário fica fora
  }
  return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function watchClockDiff(min) {
  const m = Math.round(Math.abs(min));
  if (m < 15) return "";
  return watchHours(m);
}

function renderWatchSleep() {
  const el = document.getElementById("watchSleep");
  if (!el) return;
  const sel = watchSelDate();
  const night = watchNightFor(sel);
  el.dataset.click = "openWatchMetric";
  el.dataset.metric = "sleep";
  el.classList.add("watch-tap");
  if (!night) {
    el.innerHTML = `<div class="card-title watch-tap-title">😴 Sono<span class="watch-tap-more">Análise ›</span></div>
      <p class="watch-muted">${sel === toIsoDate() ? "Nenhuma noite ainda. Dorme com o relógio que amanhã aparece aqui." : "Sem noite registrada nesse dia."}</p>`;
    return;
  }
  const s = night.sleep;
  const goal = watchGoals().sleepMin;
  const pct = Math.min(100, Math.round((s.min / goal) * 100));
  const r = watchRefs("sleep", night.date);
  const bits = [];
  const bedUsual = watchUsualClock(night.date, "start", 15 * 60);
  const wakeUsual = watchUsualClock(night.date, "end", 0);
  if (bedUsual !== null) {
    const diff = watchAnClockMin(s.start, 15 * 60) - bedUsual;
    const t = watchClockDiff(diff);
    if (t) bits.push(`deitou ${t} ${diff > 0 ? "mais tarde" : "mais cedo"}`);
  }
  if (wakeUsual !== null) {
    const diff = watchAnClockMin(s.end, 0) - wakeUsual;
    const t = watchClockDiff(diff);
    if (t) bits.push(`acordou ${t} ${diff > 0 ? "mais tarde" : "mais cedo"}`);
  }
  const when = night.exact ? (night.date === toIsoDate() ? "a noite de hoje" : `noite que acabou ${watchDayLabel(night.date).toLowerCase()}`) : `última noite: ${watchDayLabel(night.date).toLowerCase()}`;
  el.innerHTML = `<div class="card-title watch-tap-title">😴 Sono · ${escapeHtml(when)}<span class="watch-tap-more">Análise ›</span></div>
    <div class="watch-sleep-main">
      <span class="watch-sleep-num">${watchHours(s.min)}</span>
      <span class="watch-sleep-time">🛏️ ${watchClock(s.start)} › ⏰ ${watchClock(s.end)}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${s.min >= goal ? "var(--gold-2)" : "var(--blue)"}"></div></div>
    <div class="watch-muted watch-sleep-goal">${pct}% da meta de ${watchHours(goal)}${s.napMin ? ` · 💤 +${watchHours(s.napMin)} de cochilo` : ""}${typeof wslScoreOf === "function" ? ` · 🤡 nota ${wslScoreOf(night.date)}` : ""}</div>
    <div class="watch-cmp-deltas watch-sleep-deltas">
      ${watchDeltaChip("sleep", r.v, r.y, "vs noite antes", false)}
      ${watchDeltaChip("sleep", r.v, r.w, "vs 7 noites", false)}
    </div>
    ${bits.length ? `<p class="watch-muted">🕐 Comparando com a semana: ${escapeHtml(bits.join(" e "))}.</p>` : ""}
    ${typeof watchSleepMini === "function" ? watchSleepMini(s) : watchSleepBar(s)}`; // v1.98: mini hipnograma quando a noite tem as fases no tempo
}

/* ---------------- 🧬 Corpo por dentro ---------------- */
// Cada quadrado = valor do dia escolhido. Em HOJE, se ainda não veio, usa o mais recente
// (até 3 dias; ronco/oxigênio/temp/respiração, que nem toda noite tem, mais). Seta = contra
// a média dos 30 dias antes (o teu normal). ❔ = explicação do Cloba (v1.95).
const WATCH_BODY_TILES = [
  { metric: "stress", label: "😰 Stress", field: "stress" },
  { metric: "energy", label: "🔋 Energy", field: "energy" },
  { metric: "hrv", label: "💓 HRV", field: "hrv" },
  { metric: "spo2", label: "🫁 Oxigênio", field: "spo2", back: 14 },
  { metric: "resp", label: "😮‍💨 Respiração", field: "resp", back: 14 },
  { metric: "temp", label: "🌡️ Temp. pele", field: "temp", back: 14 },
  { metric: "snore", label: "😪 Ronco", field: "snoreMin", back: 60 },
  { metric: "floors", label: "🪜 Andares", field: "floors" },
];

function watchLatest(field, maxBack = 3, from = toIsoDate()) {
  for (let i = 0; i <= maxBack; i++) {
    const date = watchAddDays(from, -i);
    const d = watchDay(date);
    if (d && d[field] !== undefined && d[field] !== null) return { date, v: Number(d[field]) };
  }
  return null;
}

function watchBodyTileValue(t, sel) {
  return watchLatest(t.field, sel === toIsoDate() ? t.back || 3 : 0, sel);
}

function renderWatchBody() {
  const el = document.getElementById("watchBody");
  if (!el) return;
  const any = (field) => Object.values(watchDays()).some((d) => d && d[field] !== undefined && d[field] !== null);
  const tiles = WATCH_BODY_TILES.filter((t) => any(t.field));
  el.hidden = !tiles.length;
  if (!tiles.length) {
    el.innerHTML = "";
    return;
  }
  const sel = watchSelDate();
  const isToday = sel === toIsoDate();
  el.innerHTML = `<div class="section-title">🧬 Corpo por dentro</div>
    <div class="watch-body-grid">${tiles.map((t) => {
      const m = WATCH_METRICS[t.metric];
      const last = watchBodyTileValue(t, sel);
      const base = last ? watchAvgBefore(t.field, last.date) : null;
      let arrow = "";
      if (last && base) {
        const pct = ((last.v - base) / base) * 100;
        const lim = t.metric === "temp" || t.metric === "spo2" ? 1 : 8;
        if (Math.abs(pct) >= lim) {
          const good = !m || m.better === "none" ? null : m.better === "up" ? pct > 0 : pct < 0;
          arrow = `<span class="watch-body-arrow ${good === null ? "" : good ? "text-green" : "text-coral"}">${pct > 0 ? "▲" : "▼"}</span>`;
        }
      }
      let when = "";
      if (!last) when = isToday ? "sem dado recente" : "sem medida";
      else if (last.date !== sel) when = last.date === watchAddDays(toIsoDate(), -1) ? "ontem" : watchAnDateShort(last.date);
      const zone = last && m && m.zone ? m.zone(last.v, last.date) : null;
      const sub = [zone ? `${zone.icon} ${escapeHtml(zone.label)}` : "", when].filter(Boolean).join(" · ");
      return `<div class="watch-body-tile watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="${t.metric}">
        <button type="button" class="watch-help-btn" data-click="openWatchHelp" data-metric="${t.metric}" aria-label="O que é ${escapeHtml(m.name)}?">❔</button>
        <span class="watch-body-label">${t.label}</span>
        <span class="watch-body-value">${last && m ? escapeHtml(m.fmt(last.v)) : "--"}${arrow}</span>
        <span class="watch-body-sub">${sub || "&nbsp;"}</span>
      </div>`;
    }).join("")}</div>
    <p class="watch-muted watch-body-foot">▲▼ = comparado com o teu normal (30 dias antes) · ❔ = o que é e como melhorar</p>`;
}

/* ---------------- 🤡 Papo reto do Cloba (do dia escolhido) ---------------- */

function renderWatchCloba() {
  const el = document.getElementById("watchCloba");
  if (!el) return;
  const sel = watchSelDate();
  const isToday = sel === toIsoDate();
  const day = watchDay(sel);
  const night = watchNightFor(sel);
  const goals = watchGoals();
  const lines = [];
  if (night && night.exact) {
    const m = night.sleep.min;
    if (m >= goals.sleepMin) lines.push(`😎 ${watchHours(m)} de sono. Dormiu igual o Killua depois do sachê.`);
    else if (m < 300) lines.push(`🧟 Só ${watchHours(m)} de sono? ${isToday ? "Hoje o café coado na V60 é dose dupla, e cama cedo." : "Esse dia foi na base do café, né?"}`);
    else if (m < 360) lines.push(`🥱 ${watchHours(m)} de sono, dá pro gasto. Mas o Saitama não treinou dormindo pouco.`);
    else lines.push(`🙂 ${watchHours(m)} de sono, quase lá. Mais ${watchHours(goals.sleepMin - m)} e era sono de rei.`);
    if (Number(night.sleep.deep) >= 90) lines.push("🌊 Sono profundo caprichado, o corpo agradece.");
  }
  if (day && day.steps !== undefined) {
    const s = Number(day.steps);
    if (isToday) {
      const hour = new Date().getHours();
      if (s >= goals.steps * 1.5) lines.push(`🚀 ${watchInt(s)} passos! O Gon não consegue nem te acompanhar.`);
      else if (s >= goals.steps) lines.push("🏆 Meta de passos batida. Nunca foi sorte, Cloba. Nunca foi sorte. 🙏");
      else if (hour >= 18 && s < goals.steps * 0.4) lines.push(`🛋️ ${watchInt(s)} passos até agora... bora dar uma volta no quarteirão, parça.`);
    } else if (s >= goals.steps * 1.5) lines.push(`🚀 Fechou com ${watchInt(s)} passos. Dia de lenda.`);
    else if (s >= goals.steps) lines.push(`🏆 Meta de passos batida nesse dia (${watchInt(s)}).`);
    else lines.push(`👟 Fechou com ${watchInt(s)} passos: faltaram ${watchInt(goals.steps - s)} pra meta.`);
  }
  // v2.01 (pedido do Rafa): o 🤡 daqui é o GERAL: 🔋 Prontidão (corpo todo, relogio-sono.js) + as falas
  // de cada assunto + a hora de deitar de hoje. Energy do Samsung saiu (quem manda é o Cloba); o HRV
  // só vira fala quando não tem prontidão (ela já mostra o HRV x o teu normal).
  const ready = typeof wslReadyHtml === "function" ? wslReadyHtml(sel) : "";
  const hrv = watchLatest("hrv", isToday ? 1 : 0, sel);
  const hrvBase = hrv ? watchAvgBefore("hrv", hrv.date, 60) : null;
  if (!ready && hrv && hrvBase && hrv.v < hrvBase * 0.8) lines.push(`💓 HRV ${watchInt(hrv.v)} ms, bem abaixo do teu normal (${watchInt(hrvBase)}). Recuperação tá devendo.`);
  if (!ready && hrv && hrvBase && hrv.v > hrvBase * 1.15) lines.push(`💓 HRV ${watchInt(hrv.v)} ms, acima do teu normal (${watchInt(hrvBase)}). Corpo recuperado, pode apertar.`);
  const stress = watchLatest("stress", isToday ? 1 : 0, sel);
  if (stress && stress.v >= 50) lines.push(`😰 Stress médio ${watchInt(stress.v)}${stress.date === sel ? "" : " ontem"}. Respira, Cloba: 4 segundos puxa, 4 segura, 6 solta.`);
  const shown = lines.slice(0, 4);
  if (isToday && typeof wslTonightLine === "function") {
    const t = wslTonightLine(sel);
    if (t) shown.push(t);
  }
  if (!ready && !shown.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="section-title wsl-title">🤡 Papo reto do Cloba ${typeof wslQ === "function" ? wslQ("papo") : ""}</div>
    <div class="card wsl-papo">${ready}${shown.length ? `<div class="wsl-papo-lines${ready ? "" : " is-first"}">${shown.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>` : ""}</div>`;
}

/* ---------------- 🗓️ Tua semana ---------------- */

function watchWeekStats(from, n) {
  const goals = watchGoals();
  let steps = 0, sd = 0, hit = 0, sleep = 0, sn = 0;
  for (let i = 0; i < n; i++) {
    const d = watchDay(watchAddDays(from, i));
    if (!d) continue;
    if (Number(d.steps) > 0) { steps += d.steps; sd++; if (d.steps >= goals.steps) hit++; }
    if (d.sleep && d.sleep.min > 0) { sleep += d.sleep.min; sn++; }
  }
  return { steps: sd ? steps / sd : null, sd, hit, sleep: sn ? sleep / sn : null, sn };
}

function watchWeekTile(label, now, before, fmt, sub) {
  const pct = now !== null && before ? ((now - before) / before) * 100 : null;
  const chip = pct === null ? `<span class="watch-delta is-none">sem semana passada</span>`
    : Math.abs(pct) < 2 ? `<span class="watch-delta">= igual</span>`
    : `<span class="watch-delta ${pct > 0 ? "is-good" : "is-bad"}">${pct > 0 ? "▲" : "▼"} ${Math.abs(Math.round(pct))}%</span>`;
  return `<div class="toba-stat is-center">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${now !== null ? escapeHtml(fmt(now)) : "--"}</span>
      <span class="toba-stat-sub">${sub || chip}</span>
    </div>`;
}

function renderWatchWeek() {
  const el = document.getElementById("watchWeek");
  if (!el) return;
  const sel = watchSelDate();
  const today = toIsoDate();
  const monday = watchAddDays(sel, -((new Date(`${sel}T12:00:00`).getDay() + 6) % 7));
  const goals = watchGoals();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = watchAddDays(monday, i);
    const d = watchDay(date) || {};
    days.push({ date, steps: Number(d.steps) > 0 ? Number(d.steps) : null, sleep: d.sleep && d.sleep.min > 0 ? d.sleep.min : null, future: date > today });
  }
  if (!days.some((d) => d.steps !== null || d.sleep !== null) && !Object.keys(watchDays()).length) {
    el.innerHTML = "";
    return;
  }
  const max = Math.max(goals.steps, ...days.map((d) => d.steps || 0)) || 1;
  const goalPct = (goals.steps / max) * 100;
  // Semana até agora x semana passada até o mesmo dia da semana
  const n = Math.min(7, watchDaysBetween(monday, today < watchAddDays(monday, 6) ? today : watchAddDays(monday, 6)) + 1);
  const now = watchWeekStats(monday, n);
  const prev = watchWeekStats(watchAddDays(monday, -7), n);
  const thisWeek = monday === watchAddDays(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const span = n >= 7 ? "a semana inteira" : n === 1 ? "só segunda" : `seg a ${WATCH_WEEKDAYS[new Date(`${watchAddDays(monday, n - 1)}T12:00:00`).getDay()]}`;
  const f = (iso) => `${Number(iso.slice(8, 10))} ${WATCH_MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
  el.innerHTML = `<div class="section-title">🗓️ ${thisWeek ? "Tua semana" : "A semana"} <span class="watch-muted">· ${f(monday)} a ${f(watchAddDays(monday, 6))}</span></div>
    <div class="card watch-week">
      <div class="watch-week-cols">
        ${days.map((d) => {
          const h = d.steps !== null ? Math.max(4, (d.steps / max) * 100) : 0;
          const hit = d.steps !== null && d.steps >= goals.steps;
          return `<button type="button" class="watch-week-col${d.date === sel ? " is-sel" : ""}${d.future ? " is-future" : ""}" data-click="watchPickWeekDay" data-id="${d.date}"${d.future ? " disabled" : ""} aria-label="${escapeHtml(watchDateLong(d.date))}">
            <span class="watch-week-val">${d.steps !== null ? (d.steps >= 1000 ? `${(d.steps / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : watchInt(d.steps)) : ""}</span>
            <span class="watch-week-bar"><i class="watch-week-tick" style="bottom:${goalPct.toFixed(1)}%"></i><span style="height:${h.toFixed(1)}%;background:${hit ? "var(--gold-2)" : "var(--green)"}"></span></span>
            <span class="watch-week-name">${WATCH_WEEKDAYS[new Date(`${d.date}T12:00:00`).getDay()]}</span>
            <span class="watch-week-sleep">${d.sleep !== null ? watchHours(d.sleep) : d.future ? "" : "·"}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="toba-stats is-3 watch-week-stats">
        ${watchWeekTile("👟 Passos", now.steps, prev.steps, (v) => watchInt(v))}
        ${watchWeekTile("😴 Sono", now.sleep, prev.sleep, (v) => watchHours(v))}
        ${watchWeekTile("🏆 Meta", now.sd ? now.hit : null, null, (v) => `${v}/${now.sd}`, `dias · antes ${prev.hit}`)}
      </div>
      <p class="watch-muted">👟 média por dia · 😴 por noite · ┄ meta de passos. ${thisWeek && n < 7 ? `Andamento: ${span} desta semana x ${span} da semana passada.` : `Comparando com ${span} da semana anterior.`} Toca num dia pra abrir ele.</p>
    </div>`;
}

/* ---------------- 📈 Tá melhorando ou piorando? (v1.95) ----------------
 * Cada assunto: média dos últimos 7 dias (até o dia escolhido) x os 7 antes, e a
 * linhazinha das últimas 8 semanas. Veredito pelo sentido bom de cada um. */
const WATCH_TREND_KEYS = ["steps", "sleep", "kcal", "heart", "hrv", "stress", "energy", "resp"];

function watchTrendWeeks(key, end, weeks) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let sum = 0, n = 0;
    for (let i = 0; i < 7; i++) {
      const v = watchMetricVal(key, watchAddDays(end, -(w * 7 + i)));
      if (v !== null) { sum += v; n++; }
    }
    out.push(n >= 3 ? sum / n : null);
  }
  return out;
}

function watchSpark(vals, color) {
  const pts = vals.map((v, i) => ({ v, i })).filter((p) => p.v !== null);
  if (pts.length < 2) return `<svg class="watch-spark" viewBox="0 0 80 24" aria-hidden="true"></svg>`;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const x = (i) => 3 + (i / (vals.length - 1)) * 74;
  const y = (v) => (max === min ? 12 : 21 - ((v - min) / (max - min)) * 18);
  const line = pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return `<svg class="watch-spark" viewBox="0 0 80 24" aria-hidden="true">
      <polyline points="${line}" style="stroke:${color}" />
      <circle cx="${x(last.i).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="2.6" style="fill:${color}" />
    </svg>`;
}

function renderWatchTrend() {
  const el = document.getElementById("watchTrend");
  if (!el) return;
  const sel = watchSelDate();
  // Hoje ainda tá rolando: as somas (passos/kcal) usam até ontem pra não puxar pra baixo
  const rows = WATCH_TREND_KEYS.map((key) => {
    const m = WATCH_METRICS[key];
    const end = watchIsPartial(key, sel) ? watchAddDays(sel, -1) : sel;
    const weeks = watchTrendWeeks(key, end, 8);
    const now = weeks[7];
    const before = weeks[6];
    if (now === null || before === null) return null;
    const pct = ((now - before) / before) * 100;
    const lim = m.zoom ? 3 : 5;
    let verdict = { cls: "", icon: "➡️", txt: "estável" };
    if (Math.abs(pct) >= lim && m.better !== "none") {
      const good = m.better === "up" ? pct > 0 : pct < 0;
      verdict = good ? { cls: "is-good", icon: "📈", txt: "melhorando" } : { cls: "is-bad", icon: "📉", txt: "piorando" };
    }
    // 4 semanas seguidas no mesmo sentido bom/ruim = tendência firme
    const last4 = weeks.slice(4).filter((v) => v !== null);
    let streak = "";
    if (last4.length === 4 && m.better !== "none") {
      const ups = last4.every((v, i) => i === 0 || v > last4[i - 1]);
      const downs = last4.every((v, i) => i === 0 || v < last4[i - 1]);
      if (ups || downs) streak = (m.better === "up") === ups ? "3 semanas seguidas melhorando" : "3 semanas seguidas piorando";
    }
    return { key, m, now, before, pct, verdict, weeks, streak };
  }).filter(Boolean);
  if (!rows.length) {
    el.innerHTML = "";
    return;
  }
  const good = rows.filter((r) => r.verdict.cls === "is-good").length;
  const bad = rows.filter((r) => r.verdict.cls === "is-bad").length;
  const head = good > bad ? `😎 ${good} de ${rows.length} melhorando` : bad > good ? `🫠 ${bad} de ${rows.length} piorando` : `➡️ Tudo mais ou menos igual`;
  el.innerHTML = `<div class="section-title">📈 Tá melhorando? <span class="watch-muted">· 7 dias x 7 antes</span></div>
    <div class="card watch-trend">
      <div class="watch-trend-head">${escapeHtml(head)}</div>
      ${rows.map((r) => `<div class="watch-trend-row watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="${r.key}">
          <span class="watch-trend-name">${r.m.icon} ${escapeHtml(r.key === "kcal" ? (watchKcalBasal() ? "Calorias" : "Ativas") : r.key === "heart" ? "Batimento" : r.m.name)}</span>
          ${watchSpark(r.weeks, r.verdict.cls === "is-good" ? "var(--green)" : r.verdict.cls === "is-bad" ? "var(--coral)" : "var(--muted)")}
          <span class="watch-trend-val"><b>${escapeHtml(r.m.fmt(r.now))}</b><small>era ${escapeHtml(r.m.fmt(r.before))}</small></span>
          <span class="watch-trend-verdict ${r.verdict.cls}">${r.verdict.icon} ${r.verdict.txt}${Math.abs(r.pct) >= 1 ? `<small>${r.pct > 0 ? "+" : "−"}${Math.abs(Math.round(r.pct))}%</small>` : ""}</span>
          ${r.streak ? `<span class="watch-trend-streak ${r.verdict.cls}">🔥 ${escapeHtml(r.streak)}</span>` : ""}
        </div>`).join("")}
      <p class="watch-muted">Linhazinha = média de cada semana nas últimas 8. Cada um tem o seu sentido bom (batimento e stress, descer é melhor).</p>
    </div>`;
}

/* ---------------- ❔ Entenda (v1.95, pedido do Rafa) ---------------- */
// what = o que é · dir = subir ou descer é bom? · tips = como melhorar
const WATCH_HELP = {
  stress: {
    what: "Placar de 0 a 100 que o relógio calcula pelo teu batimento (a variação entre uma batida e outra). Ele mede várias vezes por dia; aqui é a média do dia.",
    dir: "Quanto MAIS BAIXO, melhor. Até 30 é tranquilo, 30-50 normal, 50-70 puxado e 70+ alto. Detalhe: treino sobe o stress na hora (o relógio não sabe que é academia), então dia de treino pesado pode subir sem drama.",
    tips: [
      "Respiração 4-4-6 (puxa 4 s, segura 4 s, solta 6 s) por 2 minutos derruba na hora.",
      "Caminhada leve de 10-20 min, de preferência no sol.",
      "Noite curta = stress alto no dia seguinte. Sono é o melhor calmante.",
      "Café depois das 14h e celular na cama deixam o corpo ligado no 220.",
      "A cada 1-2 h de trabalho, 5 min longe da tela.",
    ],
  },
  energy: {
    what: "Nota de 0 a 100 que o Samsung dá todo dia de manhã juntando sono, batimento dormindo, HRV e quanto você se mexeu nos dias antes. É a bateria do teu dia.",
    dir: "Quanto MAIS ALTO, melhor. 85+ excelente, 70-84 bom, 60-69 regular, abaixo de 60 é o corpo pedindo arrego.",
    tips: [
      "Dormir 7h+ e no mesmo horário (inclusive fim de semana) é o que mais sobe.",
      "Treino pesado vários dias seguidos derruba: intercala com dia leve.",
      "Álcool à noite derruba a nota do dia seguinte. Toda vez.",
      "Ficar parado demais também baixa: uma caminhada por dia segura a nota.",
    ],
  },
  hrv: {
    what: "Variabilidade do batimento: a diferença de tempo (em milissegundos) entre uma batida e outra, medida dormindo. Coração 'flexível' = sistema nervoso relaxado e corpo recuperado.",
    dir: "MAIS ALTO é melhor, mas só compara com VOCÊ MESMO: cada pessoa tem o seu número (idade e genética mudam muito). Cair bem abaixo do teu normal = cansaço, treino pesado, álcool, stress ou começo de doença.",
    tips: [
      "Álcool é o maior vilão do HRV: derruba na mesma noite.",
      "Sono regular, mesmo horário pra deitar.",
      "Cardio leve e constante (caminhada!) sobe o HRV com as semanas.",
      "Respiração lenta 5 min antes de dormir e janta mais cedo.",
      "HRV caiu muito? Dia de treino leve, não de recorde.",
    ],
  },
  spo2: {
    what: "Quanto do teu sangue tá carregando oxigênio, medido no pulso enquanto você dorme.",
    dir: "MAIS ALTO é melhor. Normal é 95% pra cima. Entre 90 e 94% fica de olho; abaixo de 90% em várias noites, ainda mais com ronco forte e acordando cansado, é coisa pra médico do sono ver. Uma queda isolada pode ser só o relógio frouxo no pulso.",
    tips: [
      "Relógio firme, dois dedos acima do ossinho do pulso, pra medir certo.",
      "Se você ronca, dormir de lado ajuda.",
      "Nariz desentupido (soro, lavagem) e nada de álcool antes de deitar.",
    ],
  },
  resp: {
    what: "Quantas vezes você respira por minuto enquanto dorme.",
    dir: "Adulto em repouso fica entre 12 e 20. Dentro disso, mais BAIXO e estável é sinal de corpo relaxado. O alerta é SUBIR do teu normal: 1-2 a mais por vários dias pode ser o corpo brigando com uma gripe antes dela aparecer.",
    tips: [
      "Respirar pelo nariz, de dia e de noite.",
      "Cardio regular baixa a respiração em repouso com o tempo.",
      "Quarto fresco e ventilado.",
      "Subiu junto com a temperatura e o HRV caiu? É o corpo avisando: descanso.",
    ],
  },
  temp: {
    what: "Temperatura da pele do pulso enquanto você dorme. Não é febre: a pele fica uns 2-3 °C abaixo do corpo.",
    dir: "Nem subir nem descer é bom por si só: o que importa é fugir do TEU normal. Mais de +0,5 °C pode ser começo de gripe, álcool, treino pesado à noite, quarto quente ou cobertor demais.",
    tips: [
      "Quarto fresco (uns 18-22 °C) melhora o sono e estabiliza a temperatura.",
      "Álcool e comida pesada à noite esquentam o corpo.",
      "Subiu com respiração mais rápida e HRV caindo? Pega leve, pode ser gripe chegando.",
    ],
  },
  snore: {
    what: "Minutos roncando que o celular ouviu de noite (precisa do detector de ronco do Samsung Health ligado e o celular perto da cama).",
    dir: "MENOS é melhor. Um pouco é comum; muito, toda noite, atrapalha o teu sono (e o de quem dorme do lado). Ronco alto + oxigênio caindo + acordar cansado = vale investigar apneia com médico.",
    tips: [
      "Dormir de lado (de barriga pra cima piora).",
      "Álcool à noite relaxa a garganta e libera o urso.",
      "Nariz desentupido e travesseiro um pouco mais alto.",
      "Perder uns quilinhos costuma diminuir bastante.",
    ],
  },
  floors: {
    what: "Andares subidos no dia. O relógio tem um barômetro: cada ~3 metros de subida conta 1 andar.",
    dir: "MAIS é melhor. Escada é um dos exercícios mais eficientes pro coração e pras pernas no dia a dia. 10 andares por dia já é ótimo.",
    tips: [
      "Escada em vez de elevador, nem que seja os últimos 3 andares.",
      "Caminhada com subida (ladeira de SP conta, aproveita).",
    ],
  },
  steps: {
    what: "Passos do dia contados pelo relógio (e pelo celular quando tá sem relógio, uma fonte só por dia).",
    dir: "MAIS é melhor. Abaixo de 5 mil é zona de sofá; 7-8 mil já cortam bem o risco de doença; a partir de 10 mil é bônus.",
    tips: [
      "Caminhada de 20 min dá uns 2.500 passos.",
      "Andar no telefone, descer um ponto antes, estacionar longe.",
      "Uma volta depois do almoço ou da janta (ajuda até a glicose).",
    ],
  },
  sleep: {
    what: "Quanto você dormiu na noite que acabou nesse dia (a noite é do dia em que você acorda).",
    dir: "Adulto precisa de 7 a 9 h. MAIS (até aí) é melhor, e horário REGULAR vale quase tanto quanto a quantidade.",
    tips: [
      "Mesmo horário pra deitar e acordar, inclusive no fim de semana.",
      "Quarto escuro, fresco e sem celular na cama.",
      "Café até umas 14h.",
      "Sol de manhã ajusta o relógio do corpo.",
    ],
  },
  kcal: {
    what: "Calorias que você gastou se mexendo (⚡ ativas). Com o ➕ Somar o basal ligado, é o total do dia: ativas + o que o corpo gasta parado.",
    dir: "MAIS ativa é melhor: é você se mexendo. O basal quase não muda de um dia pro outro.",
    tips: ["Caminhada e escada são as ativas mais fáceis de somar.", "Treino de força aumenta o músculo, e músculo gasta mais até parado."],
  },
  distance: {
    what: "Distância que você andou/correu no dia, somando tudo.",
    dir: "MAIS é melhor. Uns 5-6 km por dia já dão a meta de passos.",
    tips: ["Trocar trajetos curtos de carro/app por caminhada.", "Caminhada de 30 min ≈ 2,5-3 km."],
  },
  heart: {
    what: "Batimento médio do dia (bpm). O de repouso (corpo parado) é o melhor termômetro de condicionamento.",
    dir: "Em repouso, MAIS BAIXO é melhor: coração treinado bate menos pra fazer o mesmo trabalho. Subir uns dias seguidos = cansaço, pouco sono, álcool ou começo de gripe.",
    tips: ["Cardio leve constante (caminhada) baixa o repouso com as semanas.", "Sono bom e menos álcool baixam já no dia seguinte.", "Hidratação: corpo desidratado bate mais rápido."],
  },
};

function openWatchHelp(el) {
  const key = el.dataset.metric;
  const m = WATCH_METRICS[key];
  const h = WATCH_HELP[key];
  if (!m || !h) return;
  const sel = watchSelDate();
  const tile = WATCH_BODY_TILES.find((t) => t.metric === key);
  const last = tile ? watchBodyTileValue(tile, sel) : (() => { const v = watchMetricVal(key, sel); return v === null ? null : { date: sel, v }; })();
  const normal = last ? watchMetricAvg(key, last.date, 30, 5) : watchMetricAvg(key, sel, 30, 5);
  const zone = last && m.zone ? m.zone(last.v, last.date) : null;
  const dirBadge = m.better === "up" ? `<span class="watch-help-dir is-up">📈 Subir é bom</span>`
    : m.better === "down" ? `<span class="watch-help-dir is-down">📉 Descer é bom</span>`
    : `<span class="watch-help-dir">🎯 Ficar no teu normal</span>`;
  const mine = [];
  if (last) mine.push(`<div class="kv-row"><span>${escapeHtml(last.date === sel ? watchDayLabel(sel) : `Último (${watchAnDateShort(last.date)})`)}</span><b>${escapeHtml(m.fmt(last.v))}${zone ? ` · ${zone.icon} ${escapeHtml(zone.label)}` : ""}</b></div>`);
  if (normal !== null) mine.push(`<div class="kv-row"><span>Teu normal (30 dias)</span><b>${escapeHtml(m.fmt(normal))}</b></div>`);
  document.getElementById("watchHelpTitle").textContent = `❔ ${m.icon} ${m.name}`;
  document.getElementById("watchHelpBody").innerHTML = `
    <div class="watch-help-sec"><div class="watch-help-h">🤔 O que é</div><p>${escapeHtml(h.what)}</p></div>
    <div class="watch-help-sec"><div class="watch-help-h">↕️ Subir ou descer? ${dirBadge}</div><p>${escapeHtml(h.dir)}</p></div>
    ${m.zones ? `<div class="watch-help-zones">${m.zones.map((z) => `<span><i style="background:${z[1]}"></i>${escapeHtml(z[0])}</span>`).join("")}</div>` : ""}
    <div class="watch-help-sec"><div class="watch-help-h">🛠️ Como melhorar</div><ul>${h.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>
    ${mine.length ? `<div class="watch-help-sec"><div class="watch-help-h">📍 O teu</div><div class="kv-list">${mine.join("")}</div></div>` : ""}
    <p class="watch-muted">🤡 O Cloba não é médico: é pra entender o relógio, não pra diagnosticar. Coisa estranha por vários dias, procura um.</p>`;
  const go = document.getElementById("watchHelpGo");
  go.dataset.metric = key;
  // v1.96 (pedido do Rafa): aberto de dentro da análise, o 🔬 Ver análise não faz sentido
  go.style.display = typeof watchMetricOpen === "function" && watchMetricOpen() ? "none" : "";
  openTobaModal("watchHelpModal");
}

/* ---------------- Ações ---------------- */

// Arrastar o herói pro lado troca de dia (igual app de saúde)
function watchSetupSwipe() {
  const el = document.getElementById("watchToday");
  if (!el || el.dataset.swipe) return;
  el.dataset.swipe = "1";
  let x0 = null, y0 = null;
  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    x0 = t.clientX;
    y0 = t.clientY;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const sel = watchSelDate();
    if (dx > 0) watchSetDate(watchAddDays(sel, -1));
    else if (sel < toIsoDate()) watchSetDate(watchAddDays(sel, 1));
  }, { passive: true });
}
document.addEventListener("DOMContentLoaded", watchSetupSwipe);

tobaActions({
  watchDayStep(el) {
    watchSetDate(watchAddDays(watchSelDate(), Number(el.dataset.step) || 0));
  },
  watchGoToday() {
    watchSetDate(toIsoDate());
  },
  watchOpenPicker() {
    const input = document.getElementById("watchDateInput");
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch (err) {
      input.focus();
      input.click();
    }
  },
  watchPickDate(el) {
    if (el.value) watchSetDate(el.value);
  },
  watchPickWeekDay(el) {
    watchSetDate(el.dataset.id);
  },
  openWatchHelp,
  watchHelpAnalyse(el) {
    closeTobaModal("watchHelpModal");
    openWatchMetric(el);
  },
  // 📜 Mês a mês / 🗓️ Dias do período: abre o dia na tela principal
  watchGoDay(el) {
    if (typeof watchMetricOpen === "function" && watchMetricOpen()) closeWatchMetric();
    if (typeof watchRecordsOpen === "function" && watchRecordsOpen()) closeWatchRecords(); // v1.96: 🏆 Recordes
    watchSetDate(el.dataset.id);
    window.scrollTo(0, 0);
  },
});
