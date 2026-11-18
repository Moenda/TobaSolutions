/*
 * Toba Health · 🩻 Raio-X · 🏅 Nota do Dia do Cloba (v2.04)
 *
 * Um número de 0 a 100 que junta o dia inteiro: 😴 sono 30 + 👟 passos 25 + 🔥 ativas 20 (meta
 * adaptativa) + 😤 stress 15 + 🏃 se mexer de propósito 10. A conta é calcWatchDayScore
 * (health-metrics.js), a mesma dos troféus 🏅 do Perfil (nd-*: dia 70+, 7 e 30 seguidos, 90+, 100).
 * Mora no topo do 🤡 Papo reto GERAL (renderWatchCloba em relogio-dia.js chama wndStripHtml);
 * tocar abre a folha #wndModal com o porquê da nota e o que subir. Só LÊ.
 *
 * v2.11 (pedido do Rafa: "no popup só dá pra ver detalhado o dia atual... TEM COMO FAZER
 * DETALHADINHO PAI?"): a 🏅 virou análise igual aos outros quadrados (WATCH_METRICS.nota, abas
 * Dia/Semana/Mês/Semestre/Ano). Aba Dia = o detalhe de QUALQUER dia (renderWatchNotaDay); tocar
 * numa barra/quadradinho abre aquele dia. 🗓️ Mapa do mês em quadradinhos (wndMapsHtml) e
 * 🔍 Por que a nota sobe ou desce (wndMovesHtml): fim de semana x semana, dias 70+ x fracos e onde
 * perde ponto, explicado parte por parte (sono, passos, ativas, stress, se mexer).
 */

const WND_PARTS = {
  sleep: { icon: "😴", name: "Sono", tip: (p) => `Dormiu ${watchHours(p.v)} de ${watchHours(p.goal)}. Abaixo da metade da meta zera.`, up: "Deitar 30 min mais cedo é o ponto mais barato da nota." },
  steps: { icon: "👟", name: "Passos", tip: (p) => `${watchInt(p.v)} de ${watchInt(p.goal)} passos.`, up: "Ir a pé até a padaria e voltar já são uns 1.500." },
  active: { icon: "🔥", name: "Ativas", tip: (p) => `${watchInt(p.v)} de ${watchInt(p.goal)} kcal (🎯 meta que anda contigo).`, up: "15 min de caminhada depois do almoço resolvem um terço disso." },
  stress: { icon: "😤", name: "Stress", tip: (p) => `Stress ${watchInt(p.v)}: até 25 vale tudo, 70+ zera.`, up: "🌬️ Respirar 1 min e sol no rosto baixam o número." },
  move: { icon: "🏃", name: "Se mexeu", tip: (p) => (p.v >= 1 ? "Treino ou exercício de 15 min+ no dia." : p.v > 0 ? "Descanso depois de 2 dias de treino (vale 60%)." : "Sem treino nem exercício de 15 min+."), up: "Qualquer caminhada de 15 min gravada no relógio conta." },
};

// v2.11: a análise pede a nota de centenas de dias por tela: guarda por 2 s (cada render é rápido)
const wndCache = { at: 0, map: {} };
function wndScore(date) {
  if (typeof calcWatchDayScore !== "function") return null;
  if (Date.now() - wndCache.at > 2000) {
    wndCache.map = {};
    wndCache.at = Date.now();
  }
  if (!(date in wndCache.map)) wndCache.map[date] = calcWatchDayScore(healthDb, date);
  return wndCache.map[date];
}

function wndPoints(r, k) {
  const tw = r.parts.reduce((a, p) => a + p.w, 0);
  const p = r.parts.find((x) => x.k === k);
  return p ? (p.f * p.w * 100) / tw : null;
}

function wndGrade(score) {
  return score >= 85 ? { icon: "🌟", label: "dia de capa de revista", cls: "is-good" }
    : score >= 70 ? { icon: "💪", label: "dia redondo", cls: "is-good" }
    : score >= 50 ? { icon: "🙂", label: "dá pro gasto", cls: "is-ok" }
    : { icon: "🛋️", label: "dia de sofá", cls: "is-bad" };
}

// Sequência de dias 70+ até o dia (hoje ainda sem 70 não quebra: conta até ontem) e o recorde
function wndStreak(date) {
  const ok = (iso) => { const r = wndScore(iso); return Boolean(r && r.score >= WATCH_NOTA_GOOD); };
  let d = date;
  if (date === toIsoDate() && !ok(date)) d = watchAddDays(date, -1);
  let cur = 0;
  while (cur < 400 && ok(d)) { cur++; d = watchAddDays(d, -1); }
  let best = 0, run = 0;
  for (let i = 179; i >= 0; i--) {
    if (ok(watchAddDays(date, -i))) { run++; best = Math.max(best, run); } else run = 0;
  }
  return { cur, best: Math.max(best, cur) };
}

function wndStripHtml(date) {
  const r = wndScore(date);
  if (!r) return "";
  const g = wndGrade(r.score);
  const isToday = date === toIsoDate();
  const st = wndStreak(date);
  const chips = r.parts.map((p) => `<span class="wnd-chip${p.f >= 0.999 ? " is-full" : p.f < 0.5 ? " is-low" : ""}">${WND_PARTS[p.k].icon} ${Math.round(p.f * 100)}%</span>`).join("");
  return `<div class="wnd-strip watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="nota">
      ${wslRing(r.score, g.cls)}
      <div class="wnd-strip-main">
        <b>🏅 Nota do Dia${isToday ? " (até agora)" : ""}</b>
        <span class="watch-muted">${g.icon} ${escapeHtml(g.label)}${st.cur >= 2 ? ` · 🔥 ${st.cur} dias 70+` : ""}</span>
        <div class="wnd-chips">${chips}</div>
      </div>
      <span class="toba-hub-chevron">›</span>
    </div>`;
}

/* ---------------- 🏅 como análise (v2.11) ---------------- */

const WND_ZONES = [["🌟 85+", "var(--gold-2)"], ["💪 70-84", "var(--green)"], ["🙂 50-69", "var(--blue)"], ["🛋️ < 50", "var(--coral)"]];

function wndZoneK(v) {
  return v >= 85 ? 0 : v >= 70 ? 1 : v >= 50 ? 2 : 3;
}

if (typeof WATCH_METRICS === "object") {
  WATCH_METRICS.nota = {
    icon: "🏅", name: "Nota do Dia", color: "var(--blue)", better: "up", zeroOk: true,
    get: (d, date) => {
      if (!date) return undefined;
      const r = wndScore(date);
      return r ? r.score : undefined;
    },
    fmt: (v) => watchInt(v), unit: "",
    goal: () => WATCH_NOTA_GOOD,
    zone: (v) => {
      const k = wndZoneK(v);
      const g = wndGrade(v);
      return { icon: g.icon, label: g.label, k };
    },
    zones: WND_ZONES,
    about: "O dia inteiro num número de 0 a 100: 😴 sono 30 + 👟 passos 25 + 🔥 ativas 20 + 😤 stress 15 + 🏃 se mexer 10. O que não tem dado sai da conta. 70+ = dia redondo (linha dourada): conta pra sequência 🔥 e pros troféus 🏅 do Perfil.",
  };
}

// Aba Dia da análise: o detalhe de QUALQUER dia (antes era só o popup do dia escolhido)
function renderWatchNotaDay(date) {
  const r = wndScore(date);
  const isToday = date === toIsoDate();
  const m = WATCH_METRICS.nota;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dd = watchAddDays(date, -i);
    const sc = wndScore(dd);
    days.push({ date: dd, v: sc ? sc.score : null, label: dd.slice(8, 10) });
  }
  const vals = days.filter((x) => x.v !== null).map((x) => x.v);
  const chart = `<div class="card">
      <div class="card-title">📈 Os 14 dias até ${escapeHtml(watchDayLabel(date).toLowerCase())}</div>
      ${watchAnChart(days, m, WATCH_NOTA_GOOD, vals.length ? wxAvg(vals) : 0, { hi: date, avgLabel: "média 14 dias", daily: true })}
    </div>`;
  if (!r) {
    return `<div class="card watch-an-day">
        <div class="watch-an-day-val" style="color:${m.color}">--</div>
        <div class="watch-an-day-sub">${isToday ? "Ainda sem nota hoje: precisa dos passos e de mais 2 partes (sono, ativas, stress...)." : "Sem nota nesse dia: faltou dado do relógio (precisa dos passos e de mais 2 partes)."}</div>
      </div>
      ${chart}
      ${wndMapsHtml(`${date.slice(0, 7)}-01`, date, date)}
      ${watchAnAbout("nota", m)}`;
  }
  const g = wndGrade(r.score);
  const tw = r.parts.reduce((a, p) => a + p.w, 0);
  const st = wndStreak(date);
  const lost = r.parts.map((p) => ({ p, lost: ((1 - p.f) * p.w * 100) / tw })).sort((a, b) => b.lost - a.lost)[0];
  // cada parte x a média dela nos 30 dias antes (pontos)
  const base = {};
  for (let i = 1; i <= 30; i++) {
    const sc = wndScore(watchAddDays(date, -i));
    if (!sc) continue;
    sc.parts.forEach((p) => {
      const b = (base[p.k] = base[p.k] || { sum: 0, n: 0 });
      b.sum += wndPoints(sc, p.k);
      b.n++;
    });
  }
  const rows = r.parts.map((p) => {
    const pts = (p.f * p.w * 100) / tw, max = Math.round((p.w * 100) / tw);
    const b = base[p.k] && base[p.k].n >= 5 ? base[p.k].sum / base[p.k].n : null;
    const diff = b === null ? null : pts - b;
    const vs = diff === null || Math.abs(diff) < 1 ? (diff === null ? "" : "no teu normal") : `${diff > 0 ? "+" : "−"}${Math.round(Math.abs(diff))} vs teu normal`;
    return `<div class="wnd-part">
        <div class="wnd-part-head"><span>${WND_PARTS[p.k].icon} ${escapeHtml(WND_PARTS[p.k].name)}</span><b>${Math.round(pts)}<small>/${max}</small>${vs ? ` <em class="${diff > 0 ? "text-green" : diff < 0 ? "text-coral" : "watch-muted"}">${escapeHtml(vs)}</em>` : ""}</b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.round(p.f * 100)}%;background:${p.f >= 0.999 ? "var(--gold-2)" : p.f < 0.5 ? "var(--coral)" : "var(--blue)"}"></div></div>
        <small class="watch-muted">${escapeHtml(WND_PARTS[p.k].tip(p))}</small>
      </div>`;
  }).join("");
  const ref = watchRefs("nota", date);
  return `
    <div class="card wsl-hero">
      <div class="wnd-top">${wslRing(r.score, g.cls)}<div><b>${g.icon} ${escapeHtml(g.label)}</b><p class="watch-muted">${escapeHtml(watchDayLabel(date))}${isToday ? " até agora (o dia ainda tá aberto)" : ""}${st.cur >= 2 ? ` · 🔥 ${st.cur} dias 70+ em fila` : ""}</p></div></div>
      <div class="wnd-parts">${rows}</div>
      ${lost && lost.lost >= 3 ? `<div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Onde tá o ponto mais fácil</b><p>${escapeHtml(`${WND_PARTS[lost.p.k].icon} ${WND_PARTS[lost.p.k].name}: tem ${Math.round(lost.lost)} pontos parados aí. ${WND_PARTS[lost.p.k].up}`)}</p></div></div>` : ""}
    </div>
    <div class="toba-stats is-3 watch-an-stats">${watchAnDayTiles("nota", m, date).join("")}</div>
    <div class="toba-stats is-3 watch-an-stats">
      ${watchAnTile("🔥 Em fila", `${st.cur}`, "dias 70+")}
      ${watchAnTile("🏆 Recorde", `${st.best}`, "dias 70+ seguidos")}
      ${watchAnTile("📊 7 dias", ref.w !== null ? escapeHtml(watchInt(ref.w)) : "--", "média")}
    </div>
    ${chart}
    ${wndMapsHtml(`${date.slice(0, 7)}-01`, date, date)}
    ${wndMovesHtml(date)}
    ${watchAnAbout("nota", m)}`;
}

/* 🗓️ Mapa do mês: um quadradinho por dia, cor pela faixa da nota, número dentro. Tocar abre o dia. */
function wndMonthMap(ym, sel, compact) {
  const [y, mo] = ym.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const n = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // segunda primeiro
  const today = toIsoDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<span class="wnd-cal-cell is-empty"></span>`);
  let sum = 0, cnt = 0, good = 0;
  for (let d = 1; d <= n; d++) {
    const iso = `${ym}-${String(d).padStart(2, "0")}`;
    const r = iso <= today ? wndScore(iso) : null;
    const cls = [iso === sel ? "is-sel" : "", iso === today ? "is-today" : "", iso > today ? "is-future" : ""].filter(Boolean).join(" ");
    if (!r) {
      cells.push(`<span class="wnd-cal-cell ${cls}"><small>${d}</small></span>`);
      continue;
    }
    sum += r.score;
    cnt++;
    if (r.score >= WATCH_NOTA_GOOD) good++;
    const k = wndZoneK(r.score);
    cells.push(`<button type="button" class="wnd-cal-cell is-z${k} ${cls}" data-click="watchMetricGoDay" data-id="${iso}" aria-label="${escapeHtml(watchDayLabel(iso))}: nota ${r.score}"><small>${d}</small><b>${r.score}</b></button>`);
  }
  return `<div class="wnd-cal${compact ? " is-compact" : ""}">
      <div class="wnd-cal-head"><b>${escapeHtml(WATCH_MONTHS_LONG[mo - 1])} ${y}</b><span class="watch-muted">${cnt ? `média ${watchInt(sum / cnt)} · ${good} dia${good === 1 ? "" : "s"} 70+` : "sem nota"}</span></div>
      <div class="wnd-cal-grid">${["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((w) => `<span class="wnd-cal-wd">${w}</span>`).join("")}${cells.join("")}</div>
    </div>`;
}

// Todos os meses de from até to (máx. 12, o mais novo primeiro)
function wndMapsHtml(from, to, sel) {
  const months = [];
  let ym = from.slice(0, 7);
  const last = to.slice(0, 7);
  while (ym <= last && months.length < 13) {
    months.push(ym);
    const [y, m] = ym.split("-").map(Number);
    ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const list = months.reverse().slice(0, 12).filter((x) => {
    const [y, m] = x.split("-").map(Number);
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) if (wndScore(`${x}-${String(d).padStart(2, "0")}`)) return true;
    return false;
  });
  if (!list.length) return "";
  const compact = list.length > 1;
  return `<div class="section-title">🗓️ Mapa do mês</div>
    <div class="card">
      <div class="wnd-cals${compact ? " is-many" : ""}">${list.map((x) => wndMonthMap(x, sel, compact)).join("")}</div>
      <div class="watch-an-zlegend wnd-cal-legend">${WND_ZONES.map(([l, c]) => `<span><i style="background:${c}"></i>${escapeHtml(l)}</span>`).join("")}</div>
      <p class="watch-muted">👆 Toca num dia pra abrir o detalhe dele.</p>
    </div>`;
}

/* 🔍 Por que a nota sobe ou desce: 90 dias fechados até `date`, parte por parte. */
function wndValOf(date, k) {
  const d = watchDay(date) || {};
  if (k === "sleep") return d.sleep && d.sleep.min > 0 ? Number(d.sleep.min) + (Number(d.sleep.napMin) || 0) : null;
  if (k === "steps") return Number(d.steps) > 0 ? Number(d.steps) : null;
  if (k === "active") return Number(d.activeKcal) > 0 ? Number(d.activeKcal) : null;
  if (k === "stress") return d.stress !== undefined && d.stress !== null ? Number(d.stress) : null;
  return null;
}

function wndFmtVal(k, v) {
  if (k === "sleep") return watchHours(v);
  if (k === "steps") return `${watchInt(v)} passos`;
  if (k === "active") return `${watchInt(v)} kcal`;
  if (k === "stress") return `stress ${watchInt(v)}`;
  if (k === "move") return `treinou ${Math.round(v * 100)}% dos dias`;
  return watchInt(v);
}

// Média de nota, pontos de cada parte e valor cru de cada parte num grupo de dias
function wndGroup(dates) {
  const out = { n: 0, score: 0, pts: {}, raw: {} };
  dates.forEach((date) => {
    const r = wndScore(date);
    if (!r) return;
    out.n++;
    out.score += r.score;
    Object.keys(WND_PARTS).forEach((k) => {
      const pt = wndPoints(r, k);
      const a = (out.pts[k] = out.pts[k] || { sum: 0, n: 0 });
      if (pt !== null) { a.sum += pt; a.n++; }
      const v = k === "move" ? (r.parts.find((p) => p.k === "move") || {}).f : wndValOf(date, k);
      const b = (out.raw[k] = out.raw[k] || { sum: 0, n: 0 });
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) { b.sum += Number(k === "move" ? (v >= 1 ? 1 : 0) : v); b.n++; }
    });
  });
  if (!out.n) return null;
  out.score /= out.n;
  Object.keys(out.pts).forEach((k) => { out.pts[k] = out.pts[k].n ? out.pts[k].sum / out.n : 0; });
  Object.keys(out.raw).forEach((k) => { out.raw[k] = out.raw[k].n ? out.raw[k].sum / out.raw[k].n : null; });
  return out;
}

// Compara dois grupos: quais partes mais explicam a diferença (em pontos da nota)
function wndCompare(a, b) {
  return Object.keys(WND_PARTS)
    .map((k) => ({ k, diff: (a.pts[k] || 0) - (b.pts[k] || 0), ra: a.raw[k], rb: b.raw[k] }))
    .filter((x) => Math.abs(x.diff) >= 1)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

function wndCompareHtml(icon, title, a, b, la, lb, intro) {
  const diff = a.score - b.score;
  const why = wndCompare(a, b);
  const max = Math.max(1, ...why.map((x) => Math.abs(x.diff)));
  const bars = why.slice(0, 5).map((x) => `<div class="wnd-why">
      <div class="wnd-why-head"><span>${WND_PARTS[x.k].icon} ${escapeHtml(WND_PARTS[x.k].name)}</span><b class="${x.diff > 0 ? "text-green" : "text-coral"}">${x.diff > 0 ? "+" : "−"}${Math.round(Math.abs(x.diff))} pts</b></div>
      <div class="wnd-why-bar"><i class="${x.diff > 0 ? "is-up" : "is-down"}" style="width:${Math.round((Math.abs(x.diff) / max) * 100)}%"></i></div>
      ${x.ra !== null && x.rb !== null && x.ra !== undefined && x.rb !== undefined ? `<small class="watch-muted">${escapeHtml(`${wndFmtVal(x.k, x.ra)} ${la} x ${wndFmtVal(x.k, x.rb)} ${lb}`)}</small>` : ""}
    </div>`).join("");
  return `<div class="wnd-move">
      <div class="wnd-move-title">${icon} ${escapeHtml(title)}</div>
      <p class="wnd-move-lead"><b>${watchInt(a.score)}</b> ${escapeHtml(la)} x <b>${watchInt(b.score)}</b> ${escapeHtml(lb)} <span class="${diff >= 0 ? "text-green" : "text-coral"}">(${diff >= 0 ? "+" : "−"}${Math.round(Math.abs(diff))})</span></p>
      ${intro ? `<p class="watch-muted">${escapeHtml(intro)}</p>` : ""}
      ${bars || `<p class="watch-muted">Nenhuma parte puxa mais que 1 ponto: é empate técnico.</p>`}
    </div>`;
}

// Frase do Cloba pra diferença do fim de semana
function wndWeekendLine(we, wk, why) {
  const diff = we.score - wk.score;
  if (Math.abs(diff) < 3) return "Fim de semana e dia útil dão quase a mesma nota. Constância de monge. 🧘";
  const top = why.filter((x) => (diff > 0 ? x.diff > 0 : x.diff < 0)).slice(0, 2);
  const talk = {
    sleep: diff > 0 ? "dorme mais" : "dorme menos",
    steps: diff > 0 ? "anda mais" : "anda menos",
    active: diff > 0 ? "se mexe mais" : "fica mais parado",
    stress: diff > 0 ? "o stress baixa" : "o stress sobe",
    move: diff > 0 ? "treina mais" : "treina menos",
  };
  const bits = top.map((x) => `${WND_PARTS[x.k].icon} ${talk[x.k]}`);
  if (diff > 0) return `🎉 Sáb e dom a nota vai pro alto: ${bits.length ? bits.join(" e ") : "um pouco de tudo"}. Na semana é o contrário: o desafio é trazer um pedaço do fim de semana pra segunda. 😎`;
  return `💼 Na semana a nota é maior: no fim de semana ${bits.length ? bits.join(" e ") : "um pouco de tudo cai"}. Sábado de sofá cobra a conta. 🛋️`;
}

function wndMovesHtml(date) {
  const end = date >= toIsoDate() ? watchAddDays(toIsoDate(), -1) : date;
  const all = [];
  for (let i = 0; i < 90; i++) {
    const d = watchAddDays(end, -i);
    if (wndScore(d)) all.push(d);
  }
  if (all.length < 10) return "";
  const wknd = (d) => [0, 6].includes(new Date(`${d}T12:00:00`).getDay());
  const blocks = [];
  // 1) fim de semana x semana
  const we = wndGroup(all.filter(wknd)), wk = wndGroup(all.filter((d) => !wknd(d)));
  if (we && wk && we.n >= 3 && wk.n >= 5) {
    const why = wndCompare(we, wk);
    blocks.push(wndCompareHtml("🎉", "Fim de semana x dia útil", we, wk, "no sáb/dom", "na semana", wndWeekendLine(we, wk, why)));
  }
  // 2) dias redondos x dias fracos
  const good = all.filter((d) => wndScore(d).score >= WATCH_NOTA_GOOD), bad = all.filter((d) => wndScore(d).score < 55);
  const g = wndGroup(good), b = wndGroup(bad);
  if (g && b && g.n >= 3 && b.n >= 3) {
    const top = wndCompare(g, b)[0];
    blocks.push(wndCompareHtml("⚖️", "Dia redondo (70+) x dia fraco (< 55)", g, b, "nos 70+", "nos fracos", top ? `O que mais separa um do outro é ${WND_PARTS[top.k].icon} ${WND_PARTS[top.k].name.toLowerCase()}: é ali que o dia ganha ou perde.` : ""));
  }
  // 3) onde perde ponto em média
  const lost = {};
  all.forEach((d) => {
    const r = wndScore(d);
    const tw = r.parts.reduce((a, p) => a + p.w, 0);
    r.parts.forEach((p) => { lost[p.k] = (lost[p.k] || 0) + ((1 - p.f) * p.w * 100) / tw; });
  });
  const lostList = Object.keys(lost).map((k) => ({ k, v: lost[k] / all.length })).filter((x) => x.v >= 1).sort((a, c) => c.v - a.v);
  if (lostList.length) {
    const max = lostList[0].v;
    blocks.push(`<div class="wnd-move">
        <div class="wnd-move-title">🕳️ Onde a nota vaza</div>
        <p class="watch-muted">Pontos que ficam pra trás por dia, em média. O de cima é o mais barato de buscar.</p>
        ${lostList.map((x) => `<div class="wnd-why">
          <div class="wnd-why-head"><span>${WND_PARTS[x.k].icon} ${escapeHtml(WND_PARTS[x.k].name)}</span><b class="text-coral">−${Math.round(x.v)} pts</b></div>
          <div class="wnd-why-bar"><i class="is-down" style="width:${Math.round((x.v / max) * 100)}%"></i></div>
        </div>`).join("")}
        <p class="watch-muted">💡 ${escapeHtml(WND_PARTS[lostList[0].k].up)}</p>
      </div>`);
  }
  if (!blocks.length) return "";
  return `<div class="section-title">🔍 Por que a nota sobe ou desce <span class="watch-muted">· 90 dias</span></div>
    <div class="card wnd-moves">${blocks.join("")}</div>`;
}

// Compat: quem ainda chamar o popup antigo cai na análise
function wndOpen(el) {
  const date = (el && el.dataset.id) || watchSelDate();
  openWatchMetric({ dataset: { metric: "nota" } });
  watchMetricGoDay({ dataset: { id: date } });
}

tobaActions({ wndOpen });

// ❔ do 🤡 Papo reto ganha a explicação da 🏅 (mesmo modal)
if (typeof WSL_HELP === "object" && WSL_HELP.papo && Array.isArray(WSL_HELP.papo.body)) {
  WSL_HELP.papo.body.unshift(["🏅 Nota do Dia", "O dia inteiro num número de 0 a 100: 😴 sono 30 + 👟 passos 25 + 🔥 calorias ativas 20 (🎯 meta que anda contigo) + 😤 stress 15 + 🏃 se mexer de propósito 10 (treino ou exercício de 15 min+; descanso depois de 2 dias de treino vale 60%). O que não tem dado sai da conta. 70+ = dia redondo: conta pra sequência 🔥 e pros troféus 🏅 do Perfil (só dia fechado). A Prontidão é como o corpo ACORDOU; a Nota é o que tu FEZ com o dia."]);
}
