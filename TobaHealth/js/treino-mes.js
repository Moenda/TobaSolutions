/* =====================================================================
 * Toba Health · 🏋️ Treinos · ⚡ CARGA DO MÊS + 🔁 REPETIÇÕES (v2.12)
 *
 * Pedidos do Rafa (2026-11-18):
 *  - "Gostei bastante da carga da semana, mas ela muda toda hora que muda o
 *    treino": quadradinho ⚡ Carga no resumo do mês e no Hall do mês, que
 *    abre as semanas do mês com a carga de cada uma + análises do Cloba
 *    (faixa ideal, melhor dia da semana, semanas seguidas no ponto, mistura
 *    de treinos, 80/20, folga, recomendação pra semana que vem).
 *  - "Elíptico não vai ter. Coloca repetições... clica e mostra xx Saitama
 *    yy elástico": 🔁 Repetições no lugar do card do Saitama.
 *
 * Só leitura: nada novo no banco. A ⚡ carga de cada treino é a mesma do
 * 🔬 Raio-X do treino (trxLoadOf em treino-raiox.js: zonas do coração; sem
 * relógio, estimada pelo tempo e tipo). Semana = segunda a domingo.
 * "Teu ponto" de uma semana = 0,8 a 1,25x a média das 4 semanas antes dela
 * (a mesma régua da 🗓️ Semana do treino).
 *
 * Páginas na view "viewDetail" (hall.js › openWorkoutHallDetail: "load" e
 * "reps"). Carregado ANTES de treinos.js (o 1º desenho do resumo do mês já usa
 * tmesSummaryTiles) e de treino-raiox.js: trxLoadOf/trxQ/trxTile só dentro de
 * funções, e os ❔ novos entram no TRX_HELP no DOMContentLoaded.
 * ===================================================================== */

const TMES_DAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const TMES_STATUS = {
  low: { icon: "🛋️", name: "Leve", color: "#58a6ff" },
  ok: { icon: "✅", name: "No ponto", color: "#3fb950" },
  high: { icon: "🔥", name: "Puxada", color: "#e3b341" },
  risk: { icon: "🚨", name: "Rápido demais", color: "#f85149" },
  live: { icon: "⏳", name: "Rolando", color: "#8b949e" },
  new: { icon: "🆕", name: "Sem régua", color: "#8b949e" },
};

const TMES_CATS = {
  walk: { icon: "🚶", name: "Caminhada", color: "#58a6ff" },
  bike: { icon: "🚴", name: "Bike", color: "#39c5cf" },
  elliptical: { icon: "🔁", name: "Elíptico", color: "#79c0ff" },
  saitama: { icon: "👊", name: "Saitama", color: "#f0883e" },
  elastic: { icon: "🟣", name: "Elástico", color: "#a371f7" },
  home: { icon: "🏠", name: "Em casa", color: "#e3b341" },
  strength: { icon: "💪", name: "Força", color: "#3fb950" },
  stretch: { icon: "🧘", name: "Alongamento", color: "#8b949e" },
};

/* ---------------------------------------------------------------------
 * Datas
 * ------------------------------------------------------------------- */
function tmesAddDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function tmesMonday(iso) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIsoDate(d);
}

function tmesShort(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function tmesDaysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
}

function tmesMonthEnd(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------
 * Carga por dia (uma passada só no banco por tela)
 * ------------------------------------------------------------------- */
function tmesLoadOf(w) {
  return typeof trxLoadOf === "function" ? trxLoadOf(w) || 0 : 0;
}

function tmesCtx(today = toIsoDate(new Date())) {
  const byDay = {};
  let first = "";
  (healthDb.workouts || []).forEach((w) => {
    if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(String(w.date)) || w.date > today) return;
    const d = (byDay[w.date] = byDay[w.date] || { load: 0, list: [] });
    d.load += tmesLoadOf(w);
    d.list.push(w);
    if (!first || w.date < first) first = w.date;
  });
  return { byDay, first, today };
}

function tmesSum(ctx, from, to) {
  let load = 0;
  const list = [];
  for (let d = from; d <= to; d = tmesAddDays(d, 1)) {
    const x = ctx.byDay[d];
    if (x) {
      load += x.load;
      list.push(...x.list);
    }
  }
  return { load, list };
}

function tmesStatusOf(ratio) {
  if (ratio === null) return "new";
  return ratio > 1.5 ? "risk" : ratio > 1.25 ? "high" : ratio >= 0.8 ? "ok" : "low";
}

// Uma semana (segunda a domingo) x a média das 4 semanas antes dela
function tmesWeek(ctx, mon) {
  const sun = tmesAddDays(mon, 6);
  const live = mon <= ctx.today && sun >= ctx.today;
  const cur = tmesSum(ctx, mon, live ? ctx.today : sun);
  let sum = 0;
  let weeks = 0;
  for (let i = 1; i <= 4; i++) {
    const m = tmesAddDays(mon, -7 * i);
    // antes do 1º treino não é semana "zerada": é antes do Toba
    if (!ctx.first || tmesAddDays(m, 6) < ctx.first) break;
    sum += tmesSum(ctx, m, tmesAddDays(m, 6)).load;
    weeks++;
  }
  const chronic = weeks ? sum / weeks : 0;
  const ratio = chronic > 0 ? cur.load / chronic : null;
  let status = tmesStatusOf(ratio);
  if (live && (status === "low" || status === "new") && cur.load < chronic * 0.8) status = chronic ? "live" : status;
  return {
    mon, sun, live,
    daysLeft: live ? tmesDaysBetween(ctx.today, sun) : 0,
    load: cur.load,
    list: cur.list,
    chronic,
    lo: chronic * 0.8,
    hi: chronic * 1.25,
    ratio,
    status,
  };
}

function tmesMonthWeeks(ctx, monthKey) {
  const last = tmesMonthEnd(monthKey);
  const end = last < ctx.today ? last : ctx.today;
  const out = [];
  for (let mon = tmesMonday(`${monthKey}-01`); mon <= end; mon = tmesAddDays(mon, 7)) out.push(tmesWeek(ctx, mon));
  return out;
}

function tmesMonthLoad(ctx, monthKey, untilDay = 31) {
  const last = tmesMonthEnd(monthKey);
  const capDay = `${monthKey}-${String(Math.min(untilDay, Number(last.slice(8)))).padStart(2, "0")}`;
  const end = [last, ctx.today, capDay].sort()[0];
  return tmesSum(ctx, `${monthKey}-01`, end);
}

// Resumo pros quadradinhos (resumo do mês e Hall do mês)
function tmesTileData(monthKey) {
  const ctx = tmesCtx();
  const isCurrent = monthKey === ctx.today.slice(0, 7);
  const weeks = tmesMonthWeeks(ctx, monthKey);
  const month = tmesMonthLoad(ctx, monthKey);
  const week = isCurrent ? tmesWeek(ctx, tmesMonday(ctx.today)) : null;
  const okWeeks = weeks.filter((w) => !w.live && w.status === "ok").length;
  return { ctx, isCurrent, weeks, month, week, okWeeks };
}

/* ---------------------------------------------------------------------
 * 🔁 Repetições: Saitama x elástico x força
 * ------------------------------------------------------------------- */
function tmesRepsOf(w) {
  const lift = typeof calcWorkoutLift === "function" ? calcWorkoutLift(w, healthDb) : { reps: 0 };
  const saitama = w.type === "saitama" ? (Number(w.pushups) || 0) + (Number(w.situps) || 0) + (Number(w.squats) || 0) : 0;
  const elastic = w.type === "home" && typeof calcElasticLift === "function" ? calcElasticLift(w, healthDb).reps : 0;
  const other = Math.max(0, (Number(lift.reps) || 0) - saitama - elastic);
  return { saitama, elastic, other, total: saitama + elastic + other };
}

function tmesReps(workouts) {
  const out = { saitama: 0, elastic: 0, other: 0, total: 0, situps: 0, pushups: 0, squats: 0, byEx: {}, saitamaDays: new Set(), elasticDays: new Set() };
  (workouts || []).forEach((w) => {
    if (!w) return;
    const r = tmesRepsOf(w);
    out.saitama += r.saitama;
    out.elastic += r.elastic;
    out.other += r.other;
    out.total += r.total;
    if (w.type === "saitama") {
      out.situps += Number(w.situps) || 0;
      out.pushups += Number(w.pushups) || 0;
      out.squats += Number(w.squats) || 0;
      if (r.saitama) out.saitamaDays.add(w.date);
    }
    if (r.elastic) {
      out.elasticDays.add(w.date);
      // mesma conta do calcElasticLift: segundos × ritmo do exercício
      Object.entries(typeof getHomeDone === "function" ? getHomeDone(w) : {}).forEach(([id, secs]) => {
        const ex = typeof getHomeExercise === "function" ? getHomeExercise(id) : null;
        if (!ex || !ex.band) return;
        const reps = Math.round(((Number(secs) || 0) / 60) * (ex.rpm || 14));
        if (reps > 0) out.byEx[ex.name] = (out.byEx[ex.name] || 0) + reps;
      });
    }
  });
  return out;
}

function tmesMonthWorkouts(monthKey) {
  return getWorkoutMonthStats(healthDb.workouts || [], monthKey).workouts;
}

/* ---------------------------------------------------------------------
 * Quadradinhos
 * ------------------------------------------------------------------- */
// Fileirinha colorida com as semanas do mês (cor = status)
function tmesMiniWeeks(weeks) {
  if (!weeks.length) return "";
  const hi = Math.max(...weeks.map((w) => w.load), 1);
  return `<span class="tmes-mini" aria-hidden="true">${weeks.map((w) => `<i style="height:${Math.max(12, Math.round((w.load / hi) * 100))}%;background:${TMES_STATUS[w.status].color}${w.live ? ";opacity:.55" : ""}"></i>`).join("")}</span>`;
}

// Resumo do mês (tela principal do Treinos): { reps, load } = HTML dos dois quadradinhos
function tmesSummaryTiles(monthKey) {
  const reps = tmesReps(tmesMonthWorkouts(monthKey));
  const t = tmesTileData(monthKey);
  const wk = t.week;
  const st = wk ? TMES_STATUS[wk.status] : null;
  const repsSub = reps.total
    ? [reps.saitama ? `👊 ${formatWorkoutNumber(reps.saitama, 0)}` : "", reps.elastic ? `🟣 ${formatWorkoutNumber(reps.elastic, 0)}` : "", reps.other ? `💪 ${formatWorkoutNumber(reps.other, 0)}` : ""].filter(Boolean).join(" · ")
    : "Saitama, elástico e força";
  const loadSub = wk && wk.chronic
    ? `Teu ponto: ${formatWorkoutNumber(wk.lo, 0)}–${formatWorkoutNumber(wk.hi, 0)} pts · mês ${formatWorkoutNumber(t.month.load, 0)} pts`
    : `Mês: ${formatWorkoutNumber(t.month.load, 0)} pts · toca pra ver as semanas`;
  return {
    reps: `
    <button type="button" class="toba-stat" data-click="openHallDetail" data-hero-detail="reps" data-hero-month="${monthKey}" data-hero-from="viewTraining">
      <span class="toba-stat-label">🔁 Repetições</span>
      <span class="toba-stat-value"><span class="text-coral">${formatWorkoutNumber(reps.total, 0)} reps</span></span>
      <span class="toba-stat-sub">${repsSub}</span>
    </button>`,
    load: `
    <button type="button" class="toba-stat is-wide tmes-tile" data-click="openHallDetail" data-hero-detail="load" data-hero-month="${monthKey}" data-hero-from="viewTraining">
      <span class="tmes-tile-text">
        <span class="toba-stat-label">⚡ Carga da semana</span>
        <span class="toba-stat-value">${wk ? `${formatWorkoutNumber(wk.load, 0)} pts <span class="tmes-pill" style="--c:${st.color}">${st.icon} ${st.name}</span>` : "—"}</span>
        <span class="toba-stat-sub">${loadSub}</span>
      </span>
      ${tmesMiniWeeks(t.weeks)}
    </button>`,
  };
}

// Hall do mês: dois quadradinhos lado a lado
function tmesHallTiles(monthKey, monthAttr) {
  const reps = tmesReps(tmesMonthWorkouts(monthKey));
  const t = tmesTileData(monthKey);
  const done = t.weeks.filter((w) => !w.live);
  const repsDetail = reps.total
    ? [reps.saitama ? `👊 ${formatWorkoutNumber(reps.saitama, 0)}` : "", reps.elastic ? `🟣 ${formatWorkoutNumber(reps.elastic, 0)}` : "", reps.other ? `💪 ${formatWorkoutNumber(reps.other, 0)}` : ""].filter(Boolean).join(" · ")
    : "Nenhuma ainda";
  return `
      <div class="workout-legacy-stat workout-legacy-action" role="button" tabindex="0" data-click="openHallDetail" data-hero-detail="reps"${monthAttr} aria-label="Ver repetições do Saitama e do elástico">
        <span class="workout-legacy-label">🔁 Repetições</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(reps.total, 0)}</strong>
        <span class="workout-legacy-detail">${repsDetail}</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-action" role="button" tabindex="0" data-click="openHallDetail" data-hero-detail="load"${monthAttr} aria-label="Ver a carga de cada semana do mês">
        <span class="workout-legacy-label">⚡ Carga</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(t.month.load, 0)} pts</strong>
        <span class="workout-legacy-detail">${done.length ? `${t.okWeeks} de ${done.length} ${done.length === 1 ? "semana" : "semanas"} no ponto` : "Ver as semanas"} ${tmesMiniWeeks(t.weeks)}</span>
      </div>`;
}

/* ---------------------------------------------------------------------
 * ⚡ Página da carga do mês
 * ------------------------------------------------------------------- */
function renderLoadMonthPage(stats, scopeWorkouts, cmp, monthKey) {
  const ctx = tmesCtx();
  const weeks = tmesMonthWeeks(ctx, monthKey);
  if (!weeks.length) return tobaEmpty("⚡", "Mês ainda não começou", "Volta aqui depois do primeiro treino.", { compact: true });
  const isCurrent = monthKey === ctx.today.slice(0, 7);
  const month = tmesMonthLoad(ctx, monthKey);
  const prev = tmesMonthLoad(ctx, cmp.prevKey);
  const prevSame = isCurrent ? tmesMonthLoad(ctx, cmp.prevKey, Number(ctx.today.slice(8, 10))) : null;
  const before = [];
  for (let i = 4; i >= 1; i--) {
    const mon = tmesAddDays(weeks[0].mon, -7 * i);
    if (ctx.first && tmesAddDays(mon, 6) >= ctx.first) before.push(tmesWeek(ctx, mon));
  }
  const parts = [
    eqSummary(`${formatWorkoutNumber(month.load, 0)} pts`, `de ⚡ carga no mês · ${cmp.prevName}: ${formatWorkoutNumber(prev.load, 0)} pts`, pickCompareTagline(month.load, prev.load, cmp)),
    prevSame ? eqSamePointNote(month.load, prevSame.load, cmp, "pts", 0) : "",
    tmesPapoHtml(ctx, weeks, isCurrent),
    `<div class="eq-section-title tmes-title">📊 Semana a semana ${trxQ("monthLoad")}</div>`,
    tmesChartHtml(before, weeks),
    `<div class="tmes-weeks">${weeks.slice().reverse().map((w) => tmesWeekRow(w)).join("")}</div>`,
    tmesStreakHtml(ctx, weeks, isCurrent),
    tmesWeekdayHtml(ctx, monthKey),
    tmesMixHtml(month.list),
    tmesIntensityHtml(month.list),
    tmesRestHtml(ctx, monthKey),
    tmesTopHtml(month.list),
    `<p class="eq-footer">⚡ Carga = tamanho do treino pro teu corpo: cada minuto vale a zona do coração (zona 1 = 1 pt, zona 5 = 5 pts). Treino sem relógio é estimado pelo tempo e tipo. Semana = segunda a domingo.</p>`,
  ];
  return parts.join("");
}

function tmesRange(w) {
  return `${tmesShort(w.mon)} – ${tmesShort(w.sun)}`;
}

// Gráfico: barras das semanas (cor = status) em cima da faixa verde do "teu ponto"
function tmesChartHtml(before, weeks) {
  const all = [...before.map((w) => ({ ...w, ctxWeek: true })), ...weeks];
  const W = 320;
  const H = 150;
  const top = 18;
  const base = H - 18;
  const hi = Math.max(...all.map((w) => Math.max(w.load, w.hi)), 1) * 1.08;
  const bw = (W - 8) / all.length;
  const y = (v) => base - (v / hi) * (base - top);
  const body = all.map((w, i) => {
    const x = 4 + i * bw;
    const pad = Math.min(8, bw * 0.18);
    const st = TMES_STATUS[w.status];
    const band = w.chronic ? `<rect x="${(x + 1).toFixed(1)}" y="${y(w.hi).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, y(w.lo) - y(w.hi)).toFixed(1)}" class="tmes-band"/>` : "";
    const h = Math.max(w.load ? 2 : 0, base - y(w.load));
    const bar = `<rect x="${(x + pad).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - pad * 2).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${st.color}"${w.ctxWeek ? ' opacity="0.35"' : ""}${w.live ? ' class="tmes-live"' : ""}/>`;
    const val = w.load ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(base - h - 4).toFixed(1)}" text-anchor="middle" class="tmes-val${w.ctxWeek ? " is-ctx" : ""}">${formatWorkoutNumber(w.load, 0)}</text>` : "";
    const lab = `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="trx-axis">${tmesShort(w.mon)}</text>`;
    return band + bar + val + lab;
  }).join("");
  const sep = before.length ? `<line x1="${(4 + before.length * bw).toFixed(1)}" x2="${(4 + before.length * bw).toFixed(1)}" y1="${top - 8}" y2="${base}" class="tmes-sep"/>` : "";
  return `
    <div class="tmes-chart">
      <svg viewBox="0 0 ${W} ${H}" class="trx-svg" role="img" aria-label="Carga de cada semana">${body}${sep}</svg>
      <div class="tmes-legend">
        <span><i class="tmes-legend-band"></i>teu ponto (faixa ideal)</span>
        ${Object.entries(TMES_STATUS).filter(([k]) => ["low", "ok", "high", "risk"].includes(k)).map(([, s]) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join("")}
      </div>
      ${before.length ? `<p class="trx-hint">As apagadas à esquerda são as 4 semanas antes do mês, só pra dar contexto. Data = a segunda-feira da semana.</p>` : ""}
    </div>`;
}

function tmesWeekRow(w) {
  const st = TMES_STATUS[w.status];
  const meta = [`${w.list.length} ${w.list.length === 1 ? "treino" : "treinos"}`];
  if (w.chronic) meta.push(`teu ponto ${formatWorkoutNumber(w.lo, 0)}–${formatWorkoutNumber(w.hi, 0)}`);
  if (w.ratio !== null) meta.push(`${formatWorkoutNumber(w.ratio, 2)}x o normal`);
  if (w.live) meta.push(w.daysLeft ? `faltam ${w.daysLeft} ${w.daysLeft === 1 ? "dia" : "dias"}` : "último dia");
  const items = w.list
    .slice()
    .sort((a, b) => tmesLoadOf(b) - tmesLoadOf(a))
    .map((x) => `<button type="button" class="tmes-wk-item" data-click="openWorkoutView" data-id="${escapeHtml(x.id)}"><span>${WORKOUT_TYPE_ICONS[x.type] || "🏅"} ${escapeHtml(x.title || "Treino")}</span><small>${tmesShort(x.date)}</small><b>${formatWorkoutNumber(tmesLoadOf(x), 0)} pts</b></button>`)
    .join("");
  const fill = w.chronic ? Math.min(100, (w.load / (w.chronic * 2)) * 100) : 0;
  return `
    <details class="tmes-week${w.live ? " is-live" : ""}" style="--c:${st.color}">
      <summary>
        <span class="tmes-wk-head"><b>${tmesRange(w)}</b><span class="tmes-pill" style="--c:${st.color}">${st.icon} ${st.name}</span><strong>${formatWorkoutNumber(w.load, 0)} pts</strong></span>
        ${w.chronic ? `<span class="trx-week-bar tmes-wk-bar"><span class="z1"></span><span class="z2"></span><span class="z3"></span><span class="z4"></span><i style="left:${fill}%"></i></span>` : ""}
        <span class="tmes-wk-meta">${meta.join(" · ")}</span>
      </summary>
      <div class="tmes-wk-list">${items || '<p class="trx-hint">Semana sem treino. O sofá agradece.</p>'}</div>
    </details>`;
}

/* 🔥 Semanas seguidas no ponto / sem zerar */
function tmesStreakHtml(ctx, weeks, isCurrent) {
  // conta da última semana FECHADA pra trás (a que tá rolando ainda não fechou)
  const lastMon = isCurrent ? tmesAddDays(tmesMonday(ctx.today), -7) : weeks[weeks.length - 1].mon;
  let ok = 0;
  let okDone = false;
  let active = 0;
  let activeDone = false;
  let best = 0;
  let bestMon = "";
  let run = 0;
  for (let i = 0; i < 104; i++) {
    const mon = tmesAddDays(lastMon, -7 * i);
    if (!ctx.first || tmesAddDays(mon, 6) < ctx.first) break;
    const w = tmesWeek(ctx, mon);
    if (!okDone) {
      if (w.status === "ok") ok++;
      else okDone = true;
    }
    if (!activeDone) {
      if (w.load > 0) active++;
      else activeDone = true;
    }
    run = w.status === "ok" ? run + 1 : 0;
    if (w.load > best) {
      best = w.load;
      bestMon = mon;
    }
  }
  const curWeek = isCurrent ? tmesWeek(ctx, tmesMonday(ctx.today)) : null;
  if (curWeek && curWeek.load > best) {
    best = curWeek.load;
    bestMon = curWeek.mon;
  }
  const okLine = ok >= 3
    ? `Constância de monstro. É assim que o shape vem.`
    : ok >= 1
      ? `Mais ${3 - ok} no ponto e vira hábito.`
      : `A próxima semana no ponto começa a contagem.`;
  return `
    <div class="eq-section-title">🔥 Sequências</div>
    <div class="toba-stats tmes-stats">
      ${trxTile("✅ No ponto", `${ok} ${ok === 1 ? "semana" : "semanas"}`, `seguidas · ${okLine}`)}
      ${trxTile("🗓️ Sem zerar", `${active} ${active === 1 ? "semana" : "semanas"}`, "seguidas com pelo menos 1 treino")}
      ${best ? trxTile("🏆 Semana recorde", `${formatWorkoutNumber(best, 0)} pts`, `de ${tmesShort(bestMon)} a ${tmesShort(tmesAddDays(bestMon, 6))}${curWeek && bestMon === curWeek.mon ? " · é ESSA! 🔥" : ""}`, "is-wide") : ""}
    </div>`;
}

/* 📅 Melhor dia da semana (8 semanas até o fim do mês) */
function tmesWeekdayHtml(ctx, monthKey) {
  const last = tmesMonthEnd(monthKey);
  const end = last < ctx.today ? last : ctx.today;
  const start = tmesAddDays(end, -55);
  const sum = [0, 0, 0, 0, 0, 0, 0];
  const days = [0, 0, 0, 0, 0, 0, 0];
  const seen = [0, 0, 0, 0, 0, 0, 0];
  for (let d = start; d <= end; d = tmesAddDays(d, 1)) {
    if (ctx.first && d < ctx.first) continue;
    const wd = new Date(`${d}T12:00:00`).getDay();
    seen[wd]++;
    const x = ctx.byDay[d];
    if (x && x.load > 0) {
      sum[wd] += x.load;
      days[wd]++;
    }
  }
  const avg = sum.map((s, i) => (seen[i] ? s / seen[i] : 0));
  if (!avg.some((v) => v > 0)) return "";
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(...avg);
  const best = avg.indexOf(max);
  const min = Math.min(...order.map((i) => avg[i]));
  const worst = order.find((i) => avg[i] === min);
  const wkday = [1, 2, 3, 4, 5].reduce((s, i) => s + avg[i], 0) / 5;
  const wkend = (avg[6] + avg[0]) / 2;
  const rows = order.map((i) => `
    <div class="tmes-wd${i === best ? " is-best" : ""}">
      <span>${TMES_DAY_LONG[i].slice(0, 3)}</span>
      <span class="tmes-wd-bar"><span style="width:${max ? Math.round((avg[i] / max) * 100) : 0}%"></span></span>
      <b>${formatWorkoutNumber(avg[i], 0)}</b>
      <small>${days[i]}/${seen[i]}</small>
    </div>`).join("");
  const fds = wkend > wkday * 1.15
    ? "🎉 Fim de semana rende mais que dia útil: é quando sobra tempo."
    : wkday > wkend * 1.15
      ? "💼 Dia útil rende mais que o fim de semana: o sábado/domingo é teu dia de folga natural."
      : "⚖️ Semana e fim de semana bem equilibrados.";
  return `
    <div class="eq-section-title">📅 Melhor dia da semana</div>
    <div class="tmes-card">
      <p class="tmes-lead">💪 Teu dia mais forte é <b>${TMES_DAY_LONG[best]}</b> (média de ${formatWorkoutNumber(max, 0)} pts).${min < max ? ` 🛋️ Dia do sofá: <b>${TMES_DAY_LONG[worst]}</b>.` : ""}</p>
      ${rows}
      <p class="trx-hint">Média de ⚡ carga de cada dia nas últimas 8 semanas · "3/8" = treinou em 3 das 8 vezes que esse dia apareceu. ${fds}</p>
    </div>`;
}

/* 🧩 De onde vem a carga */
function tmesCatOf(w) {
  if (w.type === "walking") return "walk";
  if (w.type === "bike") return "bike";
  if (w.type === "elliptical") return "elliptical";
  if (w.type === "saitama") return "saitama";
  if (w.type === "stretch") return "stretch";
  if (w.type === "home") return w.home && typeof isElasticPlan === "function" && isElasticPlan(w.home.plan || "") ? "elastic" : "home";
  return "strength";
}

function tmesMixHtml(list) {
  const by = {};
  let total = 0;
  list.forEach((w) => {
    const c = tmesCatOf(w);
    const l = tmesLoadOf(w);
    by[c] = (by[c] || 0) + l;
    total += l;
  });
  if (!total) return "";
  const cats = Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const [topCat, topVal] = cats[0];
  const topPct = Math.round((topVal / total) * 100);
  const cardio = ["walk", "bike", "elliptical"].reduce((s, k) => s + (by[k] || 0), 0) / total;
  const strength = ["saitama", "elastic", "strength", "home"].reduce((s, k) => s + (by[k] || 0), 0) / total;
  let tip;
  if (cardio >= 0.8) tip = "🦵 A perna tá carregando o time. Pro braço e costas acompanharem, encaixa 2 dias de 🟣 elástico ou 👊 Saitama na semana.";
  else if (strength >= 0.8) tip = "💪 Muito braço, pouco fôlego. Uma caminhada longa na zona 2 equilibra o motor.";
  else tip = "⚖️ Mistura boa de fôlego e força. Time completo.";
  return `
    <div class="eq-section-title">🧩 De onde vem a carga</div>
    <div class="tmes-card">
      <div class="tmes-stack" aria-hidden="true">${cats.map(([k, v]) => `<span style="flex:${v};background:${TMES_CATS[k].color}"></span>`).join("")}</div>
      <div class="tmes-mix">${cats.map(([k, v]) => `<span><i style="background:${TMES_CATS[k].color}"></i>${TMES_CATS[k].icon} ${TMES_CATS[k].name} <b>${Math.round((v / total) * 100)}%</b></span>`).join("")}</div>
      <p class="tmes-lead">${TMES_CATS[topCat].icon} ${TMES_CATS[topCat].name} é ${topPct}% da carga do mês. ${tip}</p>
    </div>`;
}

/* 🫀 80/20 (só treinos com o coração do relógio) */
function tmesIntensityHtml(list) {
  let easy = 0;
  let mid = 0;
  let hard = 0;
  let n = 0;
  list.forEach((w) => {
    const z = w.watch && w.watch.det && w.watch.det.z;
    if (!Array.isArray(z) || z.length < 5) return;
    n++;
    easy += (Number(w.watch.det.z0) || 0) + (z[0] || 0) + (z[1] || 0);
    mid += z[2] || 0;
    hard += (z[3] || 0) + (z[4] || 0);
  });
  const tot = easy + mid + hard;
  if (!n || tot < 600) return "";
  const pe = Math.round((easy / tot) * 100);
  const pm = Math.round((mid / tot) * 100);
  const ph = Math.max(0, 100 - pe - pm);
  let tip;
  if (ph < 5) tip = "🐢 Quase nada forte. Pro fôlego crescer, 1-2x por semana encaixa uns tiros: 4 × 1 min puxado no meio da caminhada.";
  else if (pe < 65) tip = "🌋 Muita coisa forte e pouca leve. O corpo evolui no descanso: deixa mais treino na zona 2 (dá pra conversar).";
  else if (pe >= 75 && ph >= 8) tip = "🎯 Divisão de atleta! O povo do endurance treina assim: muito leve, um pouco forte.";
  else tip = "👍 Divisão boa. O alvo dos atletas é uns 80% leve e 20% moderado/forte.";
  return `
    <div class="eq-section-title">🫀 Leve x forte (80/20) ${trxQ("polar")}</div>
    <div class="tmes-card">
      <div class="tmes-stack" aria-hidden="true"><span style="flex:${easy};background:#3fb950"></span><span style="flex:${mid};background:#e3b341"></span><span style="flex:${hard};background:#f85149"></span></div>
      <div class="tmes-mix"><span><i style="background:#3fb950"></i>Leve (zona 1-2) <b>${pe}%</b></span><span><i style="background:#e3b341"></i>Moderado (3) <b>${pm}%</b></span><span><i style="background:#f85149"></i>Forte (4-5) <b>${ph}%</b></span></div>
      <p class="tmes-lead">${tip}</p>
      <p class="trx-hint">Tempo de coração de ${n} ${n === 1 ? "treino" : "treinos"} com relógio no mês.</p>
    </div>`;
}

/* 🛌 Folga */
function tmesRestHtml(ctx, monthKey) {
  const last = tmesMonthEnd(monthKey);
  const end = last < ctx.today ? last : ctx.today;
  let days = 0;
  let train = 0;
  let run = 0;
  let best = 0;
  for (let d = `${monthKey}-01`; d <= end; d = tmesAddDays(d, 1)) {
    days++;
    const on = ctx.byDay[d] && ctx.byDay[d].load > 0;
    if (on) {
      train++;
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  if (!days) return "";
  const rest = days - train;
  const line = best >= 7
    ? `😤 ${best} dias seguidos sem folga. Monstro, mas folga também é treino: o músculo cresce no descanso.`
    : rest === 0
      ? "😤 Nenhum dia de folga no mês. Respeito, mas reserva 1 por semana."
      : train / days >= 0.5
        ? `👊 Treinou em ${train} de ${days} dias e ainda folgou ${rest}. Equilíbrio de quem sabe o que tá fazendo.`
        : `🛋️ ${rest} dias de folga em ${days}. Dá pra encaixar mais 1-2 treinos por semana, nem que seja alongamento.`;
  return `
    <div class="eq-section-title">🛌 Treino x folga</div>
    <div class="toba-stats tmes-stats">
      ${trxTile("🏋️ Dias treinando", `${train} de ${days}`, `${Math.round((train / days) * 100)}% do mês`)}
      ${trxTile("🔗 Maior sequência", `${best} ${best === 1 ? "dia" : "dias"}`, "seguidos treinando")}
    </div>
    <p class="tmes-lead tmes-lead-out">${line}</p>`;
}

/* 🏋️ Treinos mais pesados do mês */
function tmesTopHtml(list) {
  const top = list.filter((w) => tmesLoadOf(w) > 0).sort((a, b) => tmesLoadOf(b) - tmesLoadOf(a)).slice(0, 3);
  if (!top.length) return "";
  const medal = ["🥇", "🥈", "🥉"];
  return `
    <div class="eq-section-title">🏋️ Os mais pesados do mês</div>
    <div class="tmes-wk-list tmes-top">${top.map((x, i) => `<button type="button" class="tmes-wk-item" data-click="openWorkoutView" data-id="${escapeHtml(x.id)}"><span>${medal[i]} ${WORKOUT_TYPE_ICONS[x.type] || "🏅"} ${escapeHtml(x.title || "Treino")}</span><small>${tmesShort(x.date)}</small><b>${formatWorkoutNumber(tmesLoadOf(x), 0)} pts</b></button>`).join("")}</div>`;
}

/* 🤡 Papo reto: como tá a semana e o que fazer na próxima */
function tmesRates(ctx) {
  const since = tmesAddDays(ctx.today, -60);
  const rate = { walkMin: 0, walkLoad: 0, saitamaN: 0, saitamaLoad: 0, elasticN: 0, elasticLoad: 0 };
  Object.entries(ctx.byDay).forEach(([d, x]) => {
    if (d < since) return;
    x.list.forEach((w) => {
      const c = tmesCatOf(w);
      const l = tmesLoadOf(w);
      if (c === "walk" && Number(w.durationMinutes) > 0) {
        rate.walkMin += Number(w.durationMinutes);
        rate.walkLoad += l;
      } else if (c === "saitama" && l > 0) {
        rate.saitamaN++;
        rate.saitamaLoad += l;
      } else if (c === "elastic" && l > 0) {
        rate.elasticN++;
        rate.elasticLoad += l;
      }
    });
  });
  return {
    perWalkMin: rate.walkMin >= 30 ? rate.walkLoad / rate.walkMin : (typeof TRX_LOAD_GUESS !== "undefined" ? TRX_LOAD_GUESS.walking : 1.8),
    perSaitama: rate.saitamaN ? rate.saitamaLoad / rate.saitamaN : 0,
    perElastic: rate.elasticN ? rate.elasticLoad / rate.elasticN : 0,
  };
}

// "≈ 35 min de caminhada ou 1 Saitama"
function tmesTranslate(pts, rates) {
  const out = [];
  const min = Math.max(10, Math.round(pts / rates.perWalkMin / 5) * 5);
  out.push(`${min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`} de caminhada`);
  if (rates.perElastic) out.push(`${Math.max(1, Math.round(pts / rates.perElastic))} 🟣 elástico`);
  else if (rates.perSaitama) out.push(`${Math.max(1, Math.round(pts / rates.perSaitama))} 👊 Saitama`);
  return out.join(" ou ");
}

function tmesPapoHtml(ctx, weeks, isCurrent) {
  const lines = [];
  const fmt = (v) => formatWorkoutNumber(v, 0);
  const done = weeks.filter((w) => !w.live);
  const count = (s) => done.filter((w) => w.status === s).length;
  if (isCurrent) {
    const cur = tmesWeek(ctx, tmesMonday(ctx.today));
    const rates = tmesRates(ctx);
    if (!cur.chronic) {
      lines.push("🆕 Ainda tô montando tua régua: com umas semanas de treino eu já sei teu normal e te digo o ponto certo.");
    } else {
      const left = cur.daysLeft ? ` e ${cur.daysLeft === 1 ? "falta 1 dia" : `faltam ${cur.daysLeft} dias`}` : ", hoje é o último dia";
      if (cur.load < cur.lo) {
        const need = cur.lo - cur.load;
        lines.push(`⏳ Essa semana tá em <b>${fmt(cur.load)} pts</b>${left}. Pro ponto (${fmt(cur.lo)}–${fmt(cur.hi)}) faltam uns <b>${fmt(need)} pts</b> ≈ ${tmesTranslate(need, rates)}.`);
      } else if (cur.load <= cur.hi) {
        lines.push(`✅ Essa semana já tá no ponto: <b>${fmt(cur.load)}</b> de ${fmt(cur.lo)}–${fmt(cur.hi)} pts. Ainda cabem uns ${fmt(cur.hi - cur.load)} pts sem exagerar.`);
      } else if (cur.ratio <= 1.5) {
        lines.push(`🔥 Já passou do ponto: <b>${fmt(cur.load)} pts</b> (o teto era ${fmt(cur.hi)}). Resto da semana: leve. Alongamento e caminhada tranquila contam.`);
      } else {
        lines.push(`🚨 Semana em <b>${formatWorkoutNumber(cur.ratio, 1)}x</b> teu normal. É aí que mora a lesão: 1-2 dias de folga antes do próximo pesado.`);
      }
      // semana que vem: régua nova = média das 4 últimas (incluindo essa)
      const last3 = [1, 2, 3].map((i) => tmesWeek(ctx, tmesAddDays(cur.mon, -7 * i)).load);
      const nextBase = (cur.load + last3.reduce((s, v) => s + v, 0)) / 4;
      if (nextBase > 0) {
        const lo = nextBase * 0.8;
        const hi = nextBase * 1.25;
        let goal;
        if (cur.status === "risk" || cur.status === "high") goal = `🧊 <b>Semana que vem pega leve</b>: mira uns ${fmt(nextBase)} pts (faixa ${fmt(lo)}–${fmt(hi)}). Recuperar também é treino.`;
        else if (cur.status === "ok") goal = `📈 <b>Semana que vem dá pra apertar um pouco</b>: ${fmt(Math.min(hi, cur.load * 1.1))} pts (+10%). Subir até 10% por semana é o jeito seguro de evoluir.`;
        else goal = `🎯 <b>Semana que vem</b>: mira ${fmt(lo)}–${fmt(hi)} pts. Tipo ${tmesTranslate(nextBase / 3, rates)}, 3 vezes.`;
        lines.push(goal);
      }
    }
  }
  if (done.length) {
    const best = done.reduce((a, b) => (b.load > a.load ? b : a));
    const parts = [`${count("ok")} no ponto`];
    if (count("high")) parts.push(`${count("high")} puxada${count("high") > 1 ? "s" : ""}`);
    if (count("risk")) parts.push(`${count("risk")} rápido demais`);
    if (count("low")) parts.push(`${count("low")} leve${count("low") > 1 ? "s" : ""}`);
    lines.push(`🗓️ ${isCurrent ? "Até aqui" : "Mês fechado"}: ${done.length} ${done.length === 1 ? "semana" : "semanas"} (${parts.join(", ")}). A mais forte foi a de ${tmesShort(best.mon)}, com ${fmt(best.load)} pts.`);
    if (!isCurrent) {
      if (count("ok") === done.length) lines.push("👑 Todas no ponto. Nunca foi sorte, Cloba.");
      else if (count("risk")) lines.push("🚨 Teve semana que subiu rápido demais. Crescer devagar evita lesão.");
      else if (count("low") > done.length / 2) lines.push("🛋️ Mês mais leve que teu normal. O próximo cobra.");
    }
  }
  if (!lines.length) return "";
  return `<div class="card trx-papo tmes-papo"><div class="trx-papo-title">🤡 Papo reto do Cloba</div>${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
}

/* ---------------------------------------------------------------------
 * 🔁 Página das repetições
 * ------------------------------------------------------------------- */
function renderRepsMonthPage(stats, scopeWorkouts, cmp, monthKey) {
  const now = tmesReps(scopeWorkouts);
  const prevList = tmesMonthWorkouts(cmp.prevKey);
  const prev = tmesReps(prevList);
  const same = cmp.isCurrent ? tmesReps(prevList.filter((w) => Number(String(w.date).slice(8, 10)) <= cmp.day)) : null;
  const name = cmp.prevName;
  const opts = { unit: "reps", digits: 0, prevName: name };
  const kinds = [
    ["👊", "Saitama", "saitama"],
    ["🟣", "Elástico", "elastic"],
    ["💪", "Força e outros", "other"],
  ].filter(([, , k]) => now[k] > 0 || prev[k] > 0);
  const total = now.total || 1;
  const split = now.total
    ? `<div class="tmes-stack tmes-stack-big" aria-hidden="true">${kinds.map(([, , k]) => `<span style="flex:${now[k]};background:${k === "saitama" ? TMES_CATS.saitama.color : k === "elastic" ? TMES_CATS.elastic.color : TMES_CATS.strength.color}"></span>`).join("")}</div>
       <div class="tmes-mix">${kinds.filter(([, , k]) => now[k] > 0).map(([icon, label, k]) => `<span>${icon} ${label} <b>${formatWorkoutNumber(now[k], 0)}</b> (${Math.round((now[k] / total) * 100)}%)</span>`).join("")}</div>`
    : "";
  const sai = now.saitama || prev.saitama
    ? `<div class="eq-section-title">👊 Saitama por exercício</div>
       <div class="eq-list">
         ${eqCompareRow("🧎", "Abdominais", now.situps, prev.situps, opts)}
         ${eqCompareRow("💪", "Flexões", now.pushups, prev.pushups, opts)}
         ${eqCompareRow("🦵", "Agachamentos", now.squats, prev.squats, opts)}
       </div>`
    : "";
  const exs = Object.entries(now.byEx).sort((a, b) => b[1] - a[1]);
  const exMax = exs.length ? exs[0][1] : 1;
  const el = exs.length
    ? `<div class="eq-section-title">🟣 Elástico por exercício</div>
       <div class="tmes-card">${exs.slice(0, 8).map(([n, r]) => `<div class="tmes-wd tmes-ex"><span>${escapeHtml(n)}</span><span class="tmes-wd-bar"><span style="width:${Math.round((r / exMax) * 100)}%;background:${TMES_CATS.elastic.color}"></span></span><b>${formatWorkoutNumber(r, 0)}</b></div>`).join("")}
       <p class="trx-hint">Repetições do elástico são estimadas pelo tempo de cada exercício × o ritmo dele (o mesmo cálculo do kg levantado).</p></div>`
    : "";
  const sd = now.saitamaDays.size;
  const ed = now.elasticDays.size;
  let mixLine = "";
  if (sd && ed) mixLine = `🔀 ${sd} ${sd === 1 ? "dia" : "dias"} de Saitama e ${ed} de elástico. Saitama empurra, elástico puxa: alternando, o corpo todo trabalha.`;
  else if (sd) mixLine = "👊 Só Saitama até aqui. Ele só empurra (peito, perna, abdômen): um dia de 🟣 elástico puxa as costas e o bíceps.";
  else if (ed) mixLine = "🟣 Só elástico até aqui. Um dia de 👊 Saitama completa com flexão e agachamento.";
  return `
    ${eqSummary(`${formatWorkoutNumber(now.total, 0)} reps`, `no mês · ${name}: ${formatWorkoutNumber(prev.total, 0)}`, pickCompareTagline(now.total, prev.total, cmp))}
    ${same ? eqSamePointNote(now.total, same.total, cmp, "reps", 0) : ""}
    ${split}
    ${mixLine ? `<p class="eq-intro">${mixLine}</p>` : ""}
    <div class="eq-section-title">🆚 Contra ${name}</div>
    <div class="eq-list">
      ${eqCompareRow("🔁", "Total", now.total, prev.total, opts)}
      ${kinds.length > 1 ? kinds.map(([icon, label, k]) => eqCompareRow(icon, label, now[k], prev[k], opts)).join("") : ""}
    </div>
    ${sai}
    ${el}
    <p class="eq-footer">A meta do careca (100 de cada por dia durante 3 anos) continua no Hall dos Heróis do Perfil, somando a vida toda.</p>`;
}

/* ---------------------------------------------------------------------
 * ❔ novos
 * ------------------------------------------------------------------- */
// treino-raiox.js carrega DEPOIS deste arquivo: registra os ❔ quando a página terminar
document.addEventListener("DOMContentLoaded", () => {
  // o 1º desenho do Treinos saiu antes do treino-raiox.js (sem a ⚡ carga): redesenha
  const view = document.getElementById("viewTraining");
  if (view && view.classList.contains("active") && typeof renderWorkoutScreen === "function" && (typeof isHealthDbLoaded === "undefined" || isHealthDbLoaded)) renderWorkoutScreen();
  if (typeof TRX_HELP === "undefined") return;
  Object.assign(TRX_HELP, {
    monthLoad: ["⚡ Carga semana a semana", "Cada barra é a ⚡ carga somada de uma semana (segunda a domingo).<br><br>A <b>faixa verde clarinha</b> atrás da barra é <b>teu ponto</b>: de 0,8 a 1,25x a média das 4 semanas antes dela. Dentro dela tu evolui sem se quebrar.<br><br>🛋️ <b>Leve</b>: abaixo da faixa<br>✅ <b>No ponto</b>: dentro da faixa<br>🔥 <b>Puxada</b>: até 1,5x<br>🚨 <b>Rápido demais</b>: acima de 1,5x (é aí que mora a lesão)<br>⏳ <b>Rolando</b>: semana que ainda não acabou<br><br>Toca numa semana pra ver os treinos dela."],
    polar: ["🫀 Leve x forte (80/20)", "Quanto do tempo de coração do mês foi leve e quanto foi forte.<br><br><b>Leve</b>: zonas 1-2 (dá pra conversar)<br><b>Moderado</b>: zona 3<br><b>Forte</b>: zonas 4-5 (tiro, puxado)<br><br>Corredores e ciclistas de ponta treinam uns 80% leve e 20% forte. Muito forte cansa sem evoluir; nada forte não puxa o fôlego pra cima."],
    cmp: ["📊 Esse treino x teu normal", "Compara esse treino com a <b>média dos teus treinos do mesmo tipo</b> (até os 10 anteriores).<br><br><b>Verde</b>: melhor que o normal<br><b>Vermelho</b>: pior que o normal<br><b>Cinza</b>: igual, ou o número não tem lado bom (o batimento)<br><br>🥇🥈🥉 = a posição desse treino entre todos do mesmo tipo.<br><br>Toca numa linha pra ver o gráfico dela: a barra <b>amarela</b> é esse treino, as cinzas são os anteriores e o <b>tracejado</b> é teu normal."],
  });
});
