/*
 * Toba Health · 🩻 Raio-X · 😴 Sono turbinado (v1.98)
 *
 * Pedido do Rafa (2026-11-08, comparando com o Samsung Health): "quero analisar detalhado o
 * meu sono de hoje; detalhes, análises técnicas, mas não poluído; clicar na barrinha mostrar o
 * número; cochilo; temperatura; não podemos perder nenhum detalhe".
 *
 * A aba Dia da análise do 😴 (relogio-analise.js chama renderWatchSleepDay) vira a tela da noite:
 *   herói (dormindo, na cama, eficiência, 🤡 Nota do Cloba) · vs ontem/7/30 · 14 noites empilhadas
 *   por fase (toca = números da noite) · 🤡 · 🧾 Fatores da nota · 🧭 A noite minuto a minuto
 *   (hipnograma + FC/oxigênio/respiração na mesma régua; arrasta o dedo = o que rolava naquela
 *   hora) · fases x o teu normal · 🫀 Corpo dormindo · 💤 Cochilos · 🪟 Regularidade (janela das
 *   14 noites + hora de deitar sugerida) · 🔬 Detalhes técnicos (sanfona).
 * Semana/Mês do 😴 ganham as barras empilhadas e watchSleepPeriodExtras.
 *
 * Só LÊ TOBA_HEALTH_DB.watch.days[].sleep (formato em relogio.js: st, naps, bk/hr/ox/rr, ...).
 * Noite sem st (antiga / APK < 2.6) mostra o que tem e um aviso de como ganhar o hipnograma.
 * A Nota do Cloba é do Toba (conta aberta nos fatores), não é a do Samsung: a do Samsung
 * aparece do lado quando veio (sleep.score: SDK do Samsung no APK 2.6 ou 📥 import antigo).
 * Ideias do Cloba (mesma v1.98): 🔋 Prontidão (noite + HRV + FC + temperatura + banco + esforço
 * de ontem x o TEU normal), 🔍 O que mexe no teu sono (noites depois de treino, passos, cochilo,
 * horário, fim de semana), 🌍 Jet lag social e 🌡️ temperatura da pele na noite minuto a minuto.
 */

const WSL_STAGE = {
  a: { name: "Acordado", short: "Acord.", lvl: 0, color: "#f0883e" },
  r: { name: "REM", short: "REM", lvl: 1, color: "#b197fc" },
  l: { name: "Leve", short: "Leve", lvl: 2, color: "#74c0fc" },
  d: { name: "Profundo", short: "Prof.", lvl: 3, color: "#3b5bdb" },
  s: { name: "Dormindo", short: "Dorm.", lvl: 2, color: "#8b949e" },
};
const WSL_W = 340;      // largura de todos os gráficos da noite (mesma régua)
const WSL_PAD_L = 42;   // espaço dos nomes das fases à esquerda
const WSL_PAD_R = 6;

/* ---------------- Contas da noite ---------------- */

function wslNight(date) {
  const d = watchDay(date);
  return d && d.sleep && d.sleep.min > 0 ? d.sleep : null;
}

function wslInBed(s) {
  return Math.max(1, Math.round((Number(s.end) - Number(s.start)) / 60000));
}

// Tudo que dá pra tirar da linha do tempo (ou do que o Samsung mandou, sem ela)
function wslAnalyze(s) {
  const segs = watchStDecode(s.st);
  const inBed = wslInBed(s);
  const out = { segs, inBed, has: segs.length > 0, eff: Math.min(100, Math.round((s.min / inBed) * 100)) };
  if (!segs.length) {
    if (Number.isFinite(Number(s.lat))) out.lat = Number(s.lat);
    return out;
  }
  const sleeping = segs.filter((x) => x.t !== "a");
  if (!sleeping.length) return out;
  const onset = sleeping[0].off;
  const lastEnd = sleeping[sleeping.length - 1].off + sleeping[sleeping.length - 1].dur;
  out.lat = onset;
  out.onset = onset;
  const mid = segs.filter((x) => x.t === "a" && x.off >= onset && x.off + x.dur <= lastEnd);
  out.wakes = mid.filter((x) => x.dur >= 2).length;
  out.waso = mid.reduce((a, x) => a + x.dur, 0);
  out.longAwake = mid.reduce((b, x) => (!b || x.dur > b.dur ? x : b), null);
  out.longDeep = segs.filter((x) => x.t === "d").reduce((b, x) => (!b || x.dur > b.dur ? x : b), null);
  const firstOf = (t) => segs.find((x) => x.t === t);
  if (firstOf("d")) out.toDeep = firstOf("d").off - onset;
  if (firstOf("r")) out.toRem = firstOf("r").off - onset;
  // Ciclos ~ episódios de REM (REM separado por mais de 30 min = episódio novo)
  let cyc = 0, lastRemEnd = -999;
  segs.forEach((x) => {
    if (x.t !== "r") return;
    if (x.off - lastRemEnd > 30) cyc++;
    lastRemEnd = x.off + x.dur;
  });
  out.cycles = cyc;
  out.endAwake = Math.max(0, s.end ? inBed - lastEnd : 0);
  return out;
}

// Nota de 0 a 100: média ponderada dos fatores que deu pra medir
function wslFactors(s, date, an) {
  const goal = watchGoals().sleepMin;
  const lin = (v, bad, good) => Math.max(0, Math.min(100, Math.round(((v - bad) / (good - bad)) * 100)));
  const staged = s.deep + s.light + s.rem;
  const list = [];
  list.push({ key: "time", label: "⏱️ Tempo dormindo", value: watchHours(s.min), score: lin(s.min, 240, goal), w: 30,
    tip: s.min >= goal ? "bateu a meta" : `faltou ${watchHours(goal - s.min)} pra meta` });
  if (staged > 0) {
    const dp = (s.deep / staged) * 100;
    const rp = (s.rem / staged) * 100;
    list.push({ key: "deep", label: "🌊 Profundo", value: watchHours(s.deep), score: dp >= 13 ? 100 : lin(dp, 3, 13), w: 10, tip: `${Math.round(dp)}% do sono (bom: 13-23%)` });
    list.push({ key: "rem", label: "🌀 REM", value: watchHours(s.rem), score: rp >= 18 ? 100 : lin(rp, 5, 18), w: 10, tip: `${Math.round(rp)}% do sono (bom: 18-25%)` });
  }
  const awake = an.has ? an.waso : s.awake;
  if (an.has || s.awake > 0) list.push({ key: "awake", label: "👀 Acordado", value: watchHours(an.has ? an.waso : s.awake), score: awake <= 30 ? 100 : lin(awake, 120, 30), w: 10,
    tip: an.has ? `${an.wakes} ${an.wakes === 1 ? "despertar" : "despertares"} no meio da noite` : "na cama sem dormir" });
  // v1.98 (igual o Oura): eficiência = dormindo / na cama, boa a partir de 85%
  list.push({ key: "eff", label: "📐 Eficiência", value: `${an.eff}%`, score: an.eff >= 85 ? 100 : lin(an.eff, 60, 85), w: 10, tip: "dormindo / na cama (bom: 85%+)" });
  // Pegar no sono: 5-20 min é o ideal; menos de 5 = apagou de cansaço (o Oura também desconta)
  if (an.lat !== undefined) list.push({ key: "lat", label: "⏳ Pegou no sono", value: an.lat < 1 ? "na hora" : `${Math.round(an.lat)} min`, score: an.lat < 5 ? 70 : an.lat <= 20 ? 100 : lin(an.lat, 75, 20), w: 10,
    tip: an.lat < 5 ? "rápido demais: cansaço acumulado?" : "bom: 5 a 20 min" });
  // Horário: deitar perto da tua média da semana + meio do sono entre 0h e 4h
  const usual = watchUsualClock(date, "start", 15 * 60);
  const mid = watchAnClockMin(Number(s.start) + (Number(s.end) - Number(s.start)) / 2, 12 * 60); // 12h..36h
  const midScore = mid >= 24 * 60 && mid <= 28 * 60 ? 100 : lin(Math.abs(mid < 24 * 60 ? 24 * 60 - mid : mid - 28 * 60), 180, 0);
  if (usual !== null) {
    const diff = Math.abs(watchAnClockMin(s.start, 15 * 60) - usual);
    list.push({ key: "reg", label: "🎯 Horário", value: diff < 15 ? "de sempre" : `${watchHours(diff)} ${watchAnClockMin(s.start, 15 * 60) > usual ? "+tarde" : "+cedo"}`, score: Math.round((lin(diff, 120, 30) + midScore) / 2), w: 10,
      tip: `perto da tua média; meio do sono às ${watchAnClockText(mid)} (bom: 0h-4h)` });
  }
  const wsum = list.reduce((a, f) => a + f.w, 0);
  const total = Math.round(list.reduce((a, f) => a + f.score * f.w, 0) / (wsum || 1));
  return { list, total };
}

function wslGrade(score) {
  return score >= 80 ? { label: "Boa", cls: "is-good" } : score >= 55 ? { label: "Razoável", cls: "is-ok" } : { label: "Atenção", cls: "is-bad" };
}

function wslScoreOf(date) {
  const s = wslNight(date);
  return s ? wslFactors(s, date, wslAnalyze(s)).total : null;
}

/* ---------------- Pedaços de tela ---------------- */

function wslRing(score) {
  const r = 30, c = 2 * Math.PI * r;
  const g = wslGrade(score);
  return `<div class="wsl-ring ${g.cls}" role="img" aria-label="Nota ${score}">
    <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${r}" class="wsl-ring-bg" />
      <circle cx="36" cy="36" r="${r}" class="wsl-ring-fg" style="stroke-dasharray:${((c * score) / 100).toFixed(1)} ${c.toFixed(1)}" /></svg>
    <span class="wsl-ring-num">${score}</span>
  </div>`;
}

// Mini hipnograma (sem eixo) pro card do sono na tela principal
function watchSleepMini(s) {
  const segs = watchStDecode(s.st);
  if (!segs.length) return watchSleepBar(s);
  const inBed = wslInBed(s);
  const W = 340, H = 34, rowH = H / 4;
  const rects = segs.map((x) => {
    const st = WSL_STAGE[x.t];
    return `<rect x="${((x.off / inBed) * W).toFixed(1)}" y="${(st.lvl * rowH + 1).toFixed(1)}" width="${Math.max(0.8, (x.dur / inBed) * W).toFixed(1)}" height="${(rowH - 2).toFixed(1)}" rx="1.5" fill="${st.color}" />`;
  }).join("");
  return `<svg class="wsl-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>${watchSleepBar(s).replace(/^<div class="watch-sleep-bar">.*?<\/div>/s, "")}`;
}

// Barras empilhadas por fase (14 noites do Dia, ou os dias da Semana/Mês). opts: { hi, goal, avg, labels }
function watchSleepStackChart(dates, opts = {}) {
  const nights = dates.map((date) => ({ date, s: wslNight(date) }));
  if (!nights.some((x) => x.s)) return tobaEmpty("😴", "Sem noites nesse período", "Dorme com o relógio e puxa no 🔄.", { compact: true });
  const goal = opts.goal || 0;
  const W = 340, H = 170, padB = 18, padT = 10;
  const max = Math.max(goal, ...nights.map((x) => (x.s ? x.s.min : 0))) * 1.1 || 1;
  const n = nights.length;
  const slot = W / n;
  const bw = Math.max(3, Math.min(24, slot * 0.66));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const every = n <= 14 ? 1 : 5;
  const bars = nights.map((x, i) => {
    const bx = i * slot + (slot - bw) / 2;
    const label = opts.labels ? opts.labels[i] : x.date.slice(8, 10);
    const showLabel = every === 1 || (n - 1 - i) % every === 0;
    const dim = opts.hi && x.date !== opts.hi ? " is-dim" : "";
    let g = "";
    if (x.s) {
      const s = x.s;
      const staged = s.deep + s.light + s.rem;
      const parts = staged > 0 ? [["d", s.deep * (s.min / staged)], ["l", s.light * (s.min / staged)], ["r", s.rem * (s.min / staged)]] : [["s", s.min]];
      let acc = 0;
      const rects = parts.filter((p) => p[1] > 0).map(([t, v]) => {
        const y1 = y(acc + v), y0 = y(acc);
        acc += v;
        return `<rect x="${bx.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.6, y0 - y1).toFixed(1)}" fill="${t === "s" ? "var(--blue)" : WSL_STAGE[t].color}" />`;
      }).join("");
      const hitGoal = goal && s.min >= goal ? `<circle cx="${(bx + bw / 2).toFixed(1)}" cy="${(y(s.min) - 5).toFixed(1)}" r="2.6" class="wsl-goal-dot" />` : "";
      const nap = s.napMin ? `<rect x="${(bx + bw * 0.25).toFixed(1)}" y="${(y(s.min) - 3 - Math.min(16, s.napMin / 6)).toFixed(1)}" width="${(bw * 0.5).toFixed(1)}" height="${Math.min(16, s.napMin / 6).toFixed(1)}" rx="1" class="wsl-nap-cap" />` : "";
      g = `<g class="watch-chart-bar wsl-stack${dim}" data-i="${i}" clip-path="url(#wslClip${i})">${rects}</g><clipPath id="wslClip${i}"><rect x="${bx.toFixed(1)}" y="${y(s.min).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - padB - y(s.min)).toFixed(1)}" rx="3" /></clipPath>${hitGoal}${nap}`;
    }
    const hiCls = opts.hi && x.date === opts.hi ? " is-hi" : "";
    const lbl = showLabel ? `<text x="${(i === n - 1 && n > 14 ? W - 1 : i * slot + slot / 2).toFixed(1)}" y="${H - 4}" class="watch-chart-label${hiCls}"${i === n - 1 && n > 14 ? ' style="text-anchor:end"' : ""}>${escapeHtml(label)}</text>` : "";
    const hit = `<rect class="watch-chart-hit" x="${(i * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" data-click="watchSleepBarTap" data-i="${i}" data-id="${x.date}" />`;
    return g + lbl + hit;
  }).join("");
  const line = (v, cls) => `<line x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="${cls}" />`;
  const first = opts.hi && wslNight(opts.hi) ? wslTipHtml(opts.hi, false) : "";
  return `<div class="watch-chart-wrap">
    <div class="watch-chart-tip wsl-tip${first ? "" : " is-hint"}" aria-live="polite">${first || "👆 Toca numa barra pra ver a noite"}</div>
    <svg class="watch-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sono por noite, dividido nas fases">
      ${goal ? line(goal, "watch-chart-goal") : ""}${opts.avg ? line(opts.avg, "watch-chart-avg") : ""}${bars}</svg></div>
    <div class="watch-an-legend wsl-legend">
      <span><i style="background:${WSL_STAGE.d.color}"></i>Prof.</span><span><i style="background:${WSL_STAGE.l.color}"></i>Leve</span><span><i style="background:${WSL_STAGE.r.color}"></i>REM</span>
      ${goal ? `<span><i class="is-goal"></i>meta ${escapeHtml(watchHours(goal))}</span>` : ""}${opts.avg ? `<span><i class="is-avg"></i>${escapeHtml(opts.avgLabel || "média")} ${escapeHtml(watchHours(opts.avg))}</span>` : ""}
    </div>`;
}

// Letreiro da barra tocada: os números da noite
function wslTipHtml(date, go) {
  const s = wslNight(date);
  if (!s) return `<span>${escapeHtml(watchDayLabel(date))} · sem noite</span>`;
  const staged = s.deep + s.light + s.rem;
  const score = wslScoreOf(date);
  const bits = [
    `🛏️ ${watchClock(s.start)} › ⏰ ${watchClock(s.end)}`,
    staged ? `Prof. ${watchHours(s.deep)} · Leve ${watchHours(s.light)} · REM ${watchHours(s.rem)}${s.awake ? ` · Acord. ${watchHours(s.awake)}` : ""}` : "",
    s.napMin ? `💤 +${watchHours(s.napMin)} de cochilo` : "",
  ].filter(Boolean);
  return `<div class="wsl-tip-main"><b>${escapeHtml(watchDayLabel(date))} · 😴 ${escapeHtml(watchHours(s.min))}</b>${score !== null ? `<span class="wsl-badge ${wslGrade(score).cls}">nota ${score}</span>` : ""}</div>
    <div class="wsl-tip-sub">${bits.map(escapeHtml).join("<br>")}</div>
    ${go ? `<button type="button" class="chip-btn watch-chart-go" data-click="watchMetricGoDay" data-id="${date}">Ver essa noite ›</button>` : ""}`;
}

function watchSleepBarTap(el) {
  const wrap = el.closest(".watch-chart-wrap");
  if (!wrap) return;
  const i = el.dataset.i;
  wrap.querySelectorAll(".watch-chart-bar").forEach((b) => b.classList.toggle("is-dim", b.dataset.i !== i));
  wrap.querySelectorAll(".watch-chart-hit").forEach((b) => b.classList.toggle("is-sel", b === el));
  const tip = wrap.querySelector(".watch-chart-tip");
  if (!tip) return;
  tip.classList.remove("is-hint");
  const cur = watchAn.unit === "day" ? watchAddDays(toIsoDate(), watchAn.offset) : "";
  tip.innerHTML = wslTipHtml(el.dataset.id, el.dataset.id !== cur && !!wslNight(el.dataset.id));
}

/* ---------------- 🧭 A noite minuto a minuto ---------------- */

function wslX(min, inBed) {
  return WSL_PAD_L + (Math.max(0, Math.min(inBed, min)) / inBed) * (WSL_W - WSL_PAD_L - WSL_PAD_R);
}

// Horas cheias na régua (de 1 em 1 h até 7 h na cama, depois de 2 em 2)
function wslTicks(s, inBed) {
  const step = inBed > 420 ? 120 : 60;
  const first = new Date(Number(s.start));
  first.setMinutes(0, 0, 0);
  const out = [];
  for (let t = first.getTime() + 3600000; t < Number(s.end) - 15 * 60000; t += 3600000) {
    const off = (t - Number(s.start)) / 60000;
    if (off < 40 || off > inBed - 40) continue;
    const h = new Date(t).getHours();
    if (step === 120 && h % 2) continue;
    out.push({ off, label: `${String(h).padStart(2, "0")}h` });
  }
  return out;
}

function wslAxis(s, inBed, H) {
  return `<text x="${WSL_PAD_L}" y="${H - 2}" class="wsl-axis" style="text-anchor:start">${watchClock(s.start)}</text>
    ${wslTicks(s, inBed).map((t) => `<line x1="${wslX(t.off, inBed).toFixed(1)}" x2="${wslX(t.off, inBed).toFixed(1)}" y1="0" y2="${H - 12}" class="wsl-grid" /><text x="${wslX(t.off, inBed).toFixed(1)}" y="${H - 2}" class="wsl-axis">${t.label}</text>`).join("")}
    <text x="${WSL_W - WSL_PAD_R}" y="${H - 2}" class="wsl-axis" style="text-anchor:end">${watchClock(s.end)}</text>`;
}

function wslHypnogram(s, an, { small = false } = {}) {
  const inBed = an.inBed;
  const H = small ? 64 : 116;
  const axisH = small ? 0 : 14;
  const rowH = (H - axisH) / 4;
  const segs = an.segs;
  let path = "";
  const rects = segs.map((x, i) => {
    const st = WSL_STAGE[x.t];
    const x0 = wslX(x.off, inBed), x1 = wslX(x.off + x.dur, inBed);
    const yy = st.lvl * rowH + rowH * 0.18;
    const prev = segs[i - 1];
    if (prev && WSL_STAGE[prev.t].lvl !== st.lvl) {
      const py = WSL_STAGE[prev.t].lvl * rowH + rowH / 2;
      path += `M${x0.toFixed(1)} ${py.toFixed(1)}V${(yy + rowH * 0.32).toFixed(1)}`;
    }
    return `<rect x="${x0.toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(0.9, x1 - x0).toFixed(1)}" height="${(rowH * 0.64).toFixed(1)}" rx="2" fill="${st.color}" />`;
  }).join("");
  const names = ["a", "r", "l", "d"].map((t) => `<text x="0" y="${(WSL_STAGE[t].lvl * rowH + rowH / 2 + 3.5).toFixed(1)}" class="wsl-lvl">${WSL_STAGE[t].short}</text>`).join("");
  return `<svg class="wsl-svg wsl-hyp" viewBox="0 0 ${WSL_W} ${H}" data-h="${H}" role="img" aria-label="Fases do sono pelo horário">
    ${names}${small ? "" : wslAxis(s, inBed, H)}<path d="${path}" class="wsl-step" />${rects}
    <line class="wsl-cursor" x1="0" x2="0" y1="0" y2="${H - axisH}" hidden /></svg>`;
}

// Série da noite (FC, oxigênio, respiração): linha com buraco onde não teve medida
function wslSeries(s, an, key) {
  const def = {
    hr: { icon: "❤️", name: "Batimento", unit: "bpm", color: "var(--coral)", dec: 0 },
    ox: { icon: "🫁", name: "Oxigênio", unit: "%", color: "var(--blue)", dec: 0, ref: 90 },
    rr: { icon: "😮‍💨", name: "Respiração", unit: "/min", color: "var(--teal, #39c5cf)", dec: 1 },
    tp: { icon: "🌡️", name: "Temp. da pele", unit: "°C", color: "var(--gold-2)", dec: 1, minPad: 0.2 }, // v1.98: SDK do Samsung
  }[key];
  const vals = Array.isArray(s[key]) ? s[key] : null;
  const bk = Number(s.bk) || 5;
  if (!vals || !vals.some((v) => v !== null)) return "";
  const nums = vals.filter((v) => v !== null);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  let lo = Math.min(...nums), hi = Math.max(...nums);
  if (def.ref) lo = Math.min(lo, def.ref - 1);
  const pad = Math.max(def.minPad || 1, (hi - lo) * 0.15);
  lo -= pad; hi += pad;
  const H = 54, top = 4, bot = 4;
  const y = (v) => top + (H - top - bot) * (1 - (v - lo) / (hi - lo || 1));
  let d = "", pen = false;
  vals.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    const x = wslX(i * bk + bk / 2, an.inBed);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  const fmt = (v) => (def.dec ? watchDec(v) : watchInt(v));
  const minTxt = key === "hr" ? `menor ${watchInt(s.hrLow || Math.min(...nums))}` : key === "ox" ? `menor ${watchInt(Math.min(...nums))}%` : `${fmt(Math.min(...nums))} a ${fmt(Math.max(...nums))}`;
  const metric = { hr: "heart", ox: "spo2", rr: "resp", tp: "temp" }[key];
  return `<div class="wsl-series" data-key="${key}">
    <div class="wsl-series-head" role="button" tabindex="0" data-click="openWatchMetric" data-metric="${metric}">
      <span>${def.icon} ${escapeHtml(def.name)}</span><b>${escapeHtml(fmt(avg))}${def.unit === "%" ? "%" : ` ${def.unit}`}</b><small>${escapeHtml(minTxt)} ›</small>
    </div>
    <svg class="wsl-svg" viewBox="0 0 ${WSL_W} ${H}" data-h="${H}" role="img" aria-label="${escapeHtml(def.name)} durante a noite">
      ${def.ref ? `<line x1="${WSL_PAD_L}" x2="${WSL_W - WSL_PAD_R}" y1="${y(def.ref).toFixed(1)}" y2="${y(def.ref).toFixed(1)}" class="wsl-ref" /><text x="0" y="${(y(def.ref) + 3).toFixed(1)}" class="wsl-lvl">${def.ref}%</text>` : ""}
      <line x1="${WSL_PAD_L}" x2="${WSL_W - WSL_PAD_R}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}" class="wsl-avg" />
      <text x="0" y="${(top + 8).toFixed(1)}" class="wsl-lvl">${escapeHtml(fmt(hi - pad))}</text>${def.ref && Math.abs(y(def.ref) - (H - 2)) < 12 ? "" : `<text x="0" y="${(H - 2).toFixed(1)}" class="wsl-lvl">${escapeHtml(fmt(lo + pad))}</text>`}
      <path d="${d}" class="wsl-line" style="stroke:${def.color}" />
      <line class="wsl-cursor" x1="0" x2="0" y1="0" y2="${H}" hidden />
    </svg>
  </div>`;
}

// Fase/FC/oxigênio/respiração no minuto `off` da noite (pro letreiro do arrastar)
function wslAt(s, an, off) {
  const out = { clock: watchClock(Number(s.start) + off * 60000) };
  const seg = an.segs.find((x) => off >= x.off && off < x.off + x.dur);
  if (seg) out.seg = seg;
  const bk = Number(s.bk) || 5;
  const i = Math.floor(off / bk);
  ["hr", "ox", "rr", "tp"].forEach((k) => {
    if (!Array.isArray(s[k])) return;
    let v = s[k][i];
    if (v === null || v === undefined) v = s[k][i - 1] ?? s[k][i + 1] ?? null; // bloco vazio: o vizinho
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

function wslAtText(s, at) {
  const bits = [`🕐 ${at.clock}`];
  if (at.seg) {
    const st = WSL_STAGE[at.seg.t];
    bits.push(`${st.name} (${watchClock(Number(s.start) + at.seg.off * 60000)}–${watchClock(Number(s.start) + (at.seg.off + at.seg.dur) * 60000)}, ${watchHours(at.seg.dur)})`);
  }
  if (at.hr !== undefined) bits.push(`❤️ ${watchInt(at.hr)} bpm`);
  if (at.ox !== undefined) bits.push(`🫁 ${watchInt(at.ox)}%`);
  if (at.rr !== undefined) bits.push(`😮‍💨 ${watchDec(at.rr)}/min`);
  if (at.tp !== undefined) bits.push(`🌡️ ${watchDec(at.tp)} °C`);
  return bits;
}

// Fases x o teu normal (faixa do meio dos 30 dias antes: 25% a 75%), % do tempo na cama
function wslStageRows(s, date) {
  const total = s.deep + s.light + s.rem + s.awake;
  if (!(s.deep + s.light + s.rem > 0) || !total) return "";
  const hist = { a: [], r: [], l: [], d: [] };
  for (let i = 1; i <= 30; i++) {
    const x = wslNight(watchAddDays(date, -i));
    if (!x) continue;
    const t = x.deep + x.light + x.rem + x.awake;
    if (!(x.deep + x.light + x.rem > 0) || !t) continue;
    hist.a.push((x.awake / t) * 100); hist.r.push((x.rem / t) * 100); hist.l.push((x.light / t) * 100); hist.d.push((x.deep / t) * 100);
  }
  const q = (arr, p) => {
    const a = arr.slice().sort((x, y) => x - y);
    const k = (a.length - 1) * p;
    return a[Math.floor(k)] + (a[Math.ceil(k)] - a[Math.floor(k)]) * (k - Math.floor(k));
  };
  const val = { a: s.awake, r: s.rem, l: s.light, d: s.deep };
  return `<div class="wsl-stages">${["a", "r", "l", "d"].map((t) => {
    const pct = (val[t] / total) * 100;
    const st = WSL_STAGE[t];
    const band = hist[t].length >= 7 ? [q(hist[t], 0.25), q(hist[t], 0.75)] : null;
    const off = band ? (pct < band[0] - 1 ? "abaixo do teu normal" : pct > band[1] + 1 ? "acima do teu normal" : "no teu normal") : "";
    return `<div class="wsl-stage">
      <div class="wsl-stage-head"><span><b style="color:${st.color}">${st.name}</b> ${Math.round(pct)}%</span><span>${watchHours(val[t])}</span></div>
      <div class="wsl-stage-track"><span class="wsl-stage-fill" style="width:${Math.min(100, pct).toFixed(1)}%;background:${st.color}"></span>
        ${band ? `<span class="wsl-stage-band" style="left:${band[0].toFixed(1)}%;width:${Math.max(1.5, band[1] - band[0]).toFixed(1)}%"></span>` : ""}</div>
      ${off ? `<div class="wsl-stage-note">${escapeHtml(off)}${band ? ` (${Math.round(band[0])}-${Math.round(band[1])}%)` : ""}</div>` : ""}
    </div>`;
  }).join("")}
    <p class="watch-muted"><span class="wsl-band-key"></span> o teu normal (metade das tuas noites dos últimos 30 dias cai nessa faixa). % do tempo na cama, igual o Samsung.</p>
  </div>`;
}

function wslNightCard(date, s, an) {
  const series = ["hr", "ox", "rr", "tp"].map((k) => wslSeries(s, an, k)).join("");
  const hasHyp = an.has;
  const top = hasHyp ? wslHypnogram(s, an) : `${watchSleepBar(s)}<p class="watch-muted wsl-nohyp">🧭 Essa noite chegou só com o total de cada fase. O gráfico das fases pelo horário vem nas noites puxadas com o <b>APK 2.6</b> (🔄), sozinho.</p>`;
  if (!hasHyp && !series) return `<div class="section-title">🧭 A noite</div><div class="card">${top}${wslStageRows(s, date)}</div>`;
  return `<div class="section-title">🧭 A noite, minuto a minuto</div>
    <div class="card wsl-night" data-id="${date}">
      <div class="wsl-scrub-tip" aria-live="polite">👆 Toca ou arrasta no gráfico pra ver o que rolava em cada hora</div>
      <div class="wsl-scrub" data-click="watchSleepScrub" data-id="${date}">${top}${series}</div>
      ${!series && watchNativeVersion() > 0 && watchNativeVersion() < 14 ? `<p class="watch-muted">❤️ Batimento, oxigênio e respiração da noite aparecem aqui com o APK 2.6.</p>` : ""}
      ${wslStageRows(s, date)}
    </div>`;
}

// Tocou/arrastou: mexe a linha em todos os gráficos da noite e escreve o letreiro
function watchSleepScrub(el, event) {
  const card = el.closest(".wsl-night");
  const s = card && wslNight(card.dataset.id);
  if (!s || !event) return;
  const svg = card.querySelector(".wsl-svg");
  if (!svg) return;
  const box = svg.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * WSL_W;
  wslScrubTo(card, s, x);
}

function wslScrubTo(card, s, x) {
  const an = wslAnalyze(s);
  const cx = Math.max(WSL_PAD_L, Math.min(WSL_W - WSL_PAD_R, x));
  const off = ((cx - WSL_PAD_L) / (WSL_W - WSL_PAD_L - WSL_PAD_R)) * an.inBed;
  card.querySelectorAll(".wsl-cursor").forEach((c) => {
    c.setAttribute("x1", cx.toFixed(1));
    c.setAttribute("x2", cx.toFixed(1));
    c.removeAttribute("hidden");
  });
  const tip = card.querySelector(".wsl-scrub-tip");
  if (tip) {
    tip.classList.add("is-on");
    tip.innerHTML = wslAtText(s, wslAt(s, an, off)).map((b) => `<span>${escapeHtml(b)}</span>`).join("");
  }
}

// Arrastar o dedo (pointer events): ligado depois de desenhar, sem on* no HTML
function watchSleepAfterRender() {
  document.querySelectorAll(".wsl-night .wsl-scrub").forEach((area) => {
    if (area.dataset.bound) return;
    area.dataset.bound = "1";
    let down = false;
    const move = (e) => {
      const card = area.closest(".wsl-night");
      const s = card && wslNight(card.dataset.id);
      const svg = area.querySelector(".wsl-svg");
      if (!s || !svg) return;
      const box = svg.getBoundingClientRect();
      wslScrubTo(card, s, ((e.clientX - box.left) / box.width) * WSL_W);
    };
    area.addEventListener("pointerdown", (e) => { down = true; move(e); });
    area.addEventListener("pointermove", (e) => { if (down || e.pointerType === "mouse") move(e); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => area.addEventListener(t, () => { down = false; }));
  });
}

/* ---------------- 🫀 Corpo dormindo, 💤 cochilos, 🪟 regularidade, 🔬 detalhes ---------------- */

function wslBodyRows(date, s, an) {
  const d = watchDay(date) || {};
  const rows = [];
  const vsNormal = (field, v, fmt, dec) => {
    const base = watchAvgBefore(field, date, 30);
    if (base === null || v === undefined || v === null) return "";
    const diff = Number(v) - base;
    if (Math.abs(diff) < (dec ? 0.15 : 1)) return "no teu normal";
    return `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))} vs teu normal`;
  };
  const row = (metric, icon, label, value, sub) => `<div class="kv-row watch-tap" role="button" tabindex="0" data-click="openWatchMetric" data-metric="${metric}">
      <span>${icon} ${escapeHtml(label)}</span><strong>${escapeHtml(value)}${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</strong></div>`;
  const hrLow = s.hrLow || null;
  const dip = wslHrDip(d, s);
  if (dip) rows.push(row("heart", "📉", "Queda do batimento", `${dip.pct > 0 ? "−" : "+"}${Math.abs(Math.round(dip.pct))}%`, `${watchInt(dip.night)} dormindo x ${watchInt(dip.day)} no dia · ${dip.pct >= 10 ? "saudável (10%+)" : "pouca: corpo ligado"}`));
  if (d.restHr || hrLow) rows.push(row("heart", "❤️", "FC dormindo", `${watchInt(hrLow || d.restHr)} bpm`, hrLow ? `menor da noite${d.restHr ? ` · repouso ${watchInt(d.restHr)}` : ""}` : "repouso do dia"));
  if (d.hrv) rows.push(row("hrv", "💓", "HRV", `${watchInt(d.hrv)} ms`, vsNormal("hrv", d.hrv, (v) => `${watchInt(v)} ms`)));
  if (d.spo2) rows.push(row("spo2", "🫁", "Oxigênio", `${watchInt(d.spo2)}%`, [d.spo2Min ? `menor ${watchInt(d.spo2Min)}%` : "", s.oxLowSec !== undefined ? (s.oxLowSec >= 30 ? `< 90% por ${wslSecs(s.oxLowSec)}` : "nunca < 90%") : ""].filter(Boolean).join(" · ")));
  if (d.resp) rows.push(row("resp", "😮‍💨", "Respiração", `${watchDec(d.resp)}/min`, vsNormal("resp", d.resp, (v) => watchDec(v), true)));
  if (d.temp) rows.push(row("temp", "🌡️", "Temp. da pele", `${watchDec(d.temp)} °C`, vsNormal("temp", d.temp, (v) => `${watchDec(v)} °C`, true)));
  if (d.snoreMin !== undefined) rows.push(row("snore", "😪", "Ronco", d.snoreMin >= 1 ? watchHours(d.snoreMin) : "nada", ""));
  if (!rows.length) return "";
  return `<div class="section-title">🫀 Corpo dormindo</div>
    <div class="card"><div class="kv-list wsl-body">${rows.join("")}</div>
    </div>`;
}

// v1.98 (igual o AutoSleep): quanto o batimento CAI dormindo comparado com a média do dia (bom: 10%+)
function wslHrDip(d, s) {
  const day = Number(d.hrAvg);
  let night = null;
  if (Array.isArray(s.hr)) {
    const v = s.hr.filter((x) => x !== null);
    if (v.length >= 6) night = v.reduce((a, b) => a + b, 0) / v.length;
  }
  if (night === null && Number(d.restHr) > 0) night = Number(d.restHr);
  if (!(day > 30) || !(night > 25) || night >= day * 1.2) return null;
  return { day, night, pct: ((day - night) / day) * 100 };
}

function wslSecs(sec) {
  const m = Math.floor(sec / 60), r = Math.round(sec % 60);
  return m ? `${m} min${r ? ` ${r} s` : ""}` : `${r} s`;
}

function wslNaps(date, s) {
  if (!s.napMin) return "";
  const naps = Array.isArray(s.naps) ? s.naps : [];
  const list = naps.length ? naps.map((n) => {
    const inBed = Math.round((n.end - n.start) / 60000);
    const an = { segs: watchStDecode(n.st), inBed: Math.max(1, inBed) };
    const staged = n.deep + n.light + n.rem;
    return `<div class="wsl-nap">
      <div class="wsl-nap-head"><b>💤 ${watchClock(n.start)} › ${watchClock(n.end)}</b><span>${watchHours(n.min)} dormindo${inBed - n.min >= 5 ? ` · ${watchHours(inBed)} deitado` : ""}</span></div>
      ${an.segs.length ? wslHypnogram(n, an, { small: true }) : staged ? watchSleepBar(n) : ""}
    </div>`;
  }).join("") : `<p class="watch-muted">💤 ${watchHours(s.napMin)} de cochilo (noite antiga: sem o horário).</p>`;
  const tip = s.napMin > 90 ? "Cochilo de mais de 1h30 costuma roubar sono da noite seguinte. O ideal é 20-30 min, antes das 15h." : naps.some((n) => new Date(n.start).getHours() >= 16) ? "Cochilo depois das 16h empurra a hora de dormir. Se der, cochila mais cedo." : "Cochilo curto e cedo recarrega sem bagunçar a noite. 👊";
  return `<div class="section-title">💤 Cochilos <span class="watch-muted">· +${watchHours(s.napMin)} (fora da nota)</span></div>
    <div class="card">${list}<p class="watch-muted">${escapeHtml(tip)}</p></div>`;
}

// 🪟 Janela das 14 noites (deitou -> acordou num eixo de 20h às 14h) + hora de deitar sugerida
function wslWindow(dates, hiDate) {
  const nights = dates.map((date) => ({ date, s: wslNight(date) })).filter((x) => x.s);
  if (nights.length < 3) return "";
  const goal = watchGoals().sleepMin;
  const AX0 = 20 * 60, AX1 = 38 * 60; // 20:00 até 14:00 do dia seguinte
  const W = 340, padL = 44, rowH = 13, H = dates.length * rowH + 16;
  const xm = (m) => padL + ((Math.max(AX0, Math.min(AX1, m)) - AX0) / (AX1 - AX0)) * (W - padL - 4);
  const clk = (ms) => { const d = new Date(ms); let m = d.getHours() * 60 + d.getMinutes(); if (m < 12 * 60) m += 1440; return m; };
  const bedAvg = nights.reduce((a, x) => a + clk(x.s.start), 0) / nights.length;
  const wakeAvg = nights.reduce((a, x) => a + clk(x.s.end), 0) / nights.length;
  const rows = dates.map((date, i) => {
    const s = wslNight(date);
    const yy = i * rowH + 2;
    const lbl = `<text x="0" y="${yy + 9}" class="wsl-lvl${date === hiDate ? " is-hi" : ""}">${escapeHtml(watchWeekday(date))} ${date.slice(8, 10)}</text>`;
    if (!s) return lbl;
    const bar = `<rect x="${xm(clk(s.start)).toFixed(1)}" y="${yy + 2}" width="${Math.max(2, xm(clk(s.end)) - xm(clk(s.start))).toFixed(1)}" height="${rowH - 5}" rx="3" class="${s.min >= goal ? "wsl-win-gold" : "wsl-win-bar"}${date === hiDate ? " is-hi" : ""}" />`;
    const naps = (Array.isArray(s.naps) ? s.naps : []).map((n) => `<rect x="${xm(clk(n.start)).toFixed(1)}" y="${yy + 4}" width="${Math.max(2, xm(clk(n.end)) - xm(clk(n.start))).toFixed(1)}" height="${rowH - 9}" rx="2" class="wsl-win-nap" />`).join("");
    return lbl + bar + naps;
  }).join("");
  const ticks = [22, 24, 26, 28, 30, 32, 34, 36].map((h) => `<line x1="${xm(h * 60).toFixed(1)}" x2="${xm(h * 60).toFixed(1)}" y1="0" y2="${H - 14}" class="wsl-grid" /><text x="${xm(h * 60).toFixed(1)}" y="${H - 2}" class="wsl-axis">${String(h % 24).padStart(2, "0")}h</text>`).join("");
  const avgLines = `<line x1="${xm(bedAvg).toFixed(1)}" x2="${xm(bedAvg).toFixed(1)}" y1="0" y2="${H - 14}" class="wsl-avg" /><line x1="${xm(wakeAvg).toFixed(1)}" x2="${xm(wakeAvg).toFixed(1)}" y1="0" y2="${H - 14}" class="wsl-avg" />`;
  const sd = Math.sqrt(nights.reduce((a, x) => a + (clk(x.s.start) - bedAvg) ** 2, 0) / nights.length);
  const reg = sd <= 30 ? { t: "Boa", c: "is-good" } : sd <= 60 ? { t: "Razoável", c: "is-ok" } : { t: "Bagunçada", c: "is-bad" };
  return { svg: `<svg class="wsl-svg wsl-window" viewBox="0 0 ${W} ${H}" role="img" aria-label="Horário de deitar e acordar de cada noite">${ticks}${avgLines}${rows}</svg>`, sd, reg, bedAvg, wakeAvg, nights };
}

function wslRegularity(date) {
  const dates = [];
  for (let i = 13; i >= 0; i--) dates.push(watchAddDays(date, -i));
  const w = wslWindow(dates, date);
  if (!w) return "";
  const goal = watchGoals().sleepMin;
  // 🏦 Banco de sono (igual AutoSleep/Rise): 14 noites até o dia, sobra e falta contra a meta,
  // cochilo conta (igual o Whoop). Noite sem dado não entra.
  let bank = 0, nb = 0;
  for (let i = 0; i < 14; i++) {
    const s = wslNight(watchAddDays(date, -i));
    if (!s) continue;
    nb++;
    bank += s.min + (Number(s.napMin) || 0) - goal;
  }
  // Sono que precisa hoje (igual o Whoop): a meta + um pedaço da dívida (paga em ~7 noites, até +1h)
  const need = goal + (bank < 0 ? Math.min(60, Math.round(-bank / 7 / 5) * 5) : 0);
  // hora de deitar sugerida: acordar médio − meta − tempo médio pra pegar no sono
  const lats = w.nights.map((x) => wslAnalyze(x.s).lat).filter((v) => Number.isFinite(v));
  const lat = lats.length ? Math.min(45, lats.reduce((a, b) => a + b, 0) / lats.length) : 15;
  const awakeAvg = w.nights.reduce((a, x) => a + (x.s.awake || 0), 0) / w.nights.length;
  const bed = Math.round((w.wakeAvg - need - lat - Math.min(30, awakeAvg / 2)) / 15) * 15;
  const isToday = date === toIsoDate();
  const jl = wslSocialJetlag(date);
  const jlTxt = jl === null ? "" : Math.abs(jl) < 30
    ? `🌍 Jet lag social: ${watchHours(Math.round(Math.abs(jl)))}. Fim de semana no mesmo fuso dos dias úteis, relógio do corpo agradece.`
    : `🌍 Jet lag social: ${watchHours(Math.round(Math.abs(jl)))}. No fim de semana teu sono ${jl > 0 ? "vai pra mais tarde" : "vem mais cedo"}: é tipo viajar de fuso toda sexta e voltar na segunda. ${Math.abs(jl) >= 60 ? "Acima de 1h já pesa na segunda-feira." : ""}`;
  return `<div class="section-title">🪟 Regularidade</div>
    <div class="card">
      ${w.svg}
      <div class="watch-an-legend"><span><i class="wsl-key-bar"></i>noite</span><span><i class="wsl-key-gold"></i>bateu a meta</span><span><i class="wsl-key-nap"></i>cochilo</span><span><i class="is-avg"></i>tua média</span></div>
      <div class="toba-stats is-3">
        ${watchAnTile("🎯 Horário", `<span class="wsl-badge ${w.reg.c}">${w.reg.t}</span>`, `deita ±${Math.round(w.sd)} min`)}
        ${watchAnTile("🛏️ / ⏰", `${watchAnClockText(w.bedAvg)}`, `acorda ${watchAnClockText(w.wakeAvg)}`)}
        ${watchAnTile("🏦 Banco", nb ? `${bank < 0 ? "−" : "+"}${watchHours(Math.abs(bank))}` : "--", nb ? `${nb} noites x meta` : "", bank < 0 ? "text-coral" : "text-green")}
      </div>
      ${jlTxt ? `<p class="watch-muted wsl-jetlag">${escapeHtml(jlTxt.trim())}</p>` : ""}
      <div class="wsl-suggest">🌙 ${isToday ? "Hoje à noite" : "Pra essa noite"}: deita entre <b>${watchAnClockText(bed - 15)}</b> e <b>${watchAnClockText(bed + 15)}</b> pra acordar no teu horário (${watchAnClockText(w.wakeAvg)}) com ${watchHours(need)} de sono${need > goal ? ` (a meta + ${watchHours(need - goal)} pra ir pagando o banco)` : ""}.</div>
    </div>`;
}

function wslDetails(date, s, an) {
  const rows = [];
  const r = (k, v) => rows.push(`<div class="kv-row"><span>${k}</span><strong>${v}</strong></div>`);
  r("🛏️ Na cama", `${watchHours(an.inBed)} <small>(${watchClock(s.start)} › ${watchClock(s.end)})</small>`);
  r("📐 Eficiência", `${an.eff}% <small>dormindo / na cama (bom: 85%+)</small>`);
  if (an.lat !== undefined) r("⏳ Pegou no sono em", an.lat < 1 ? "na hora" : `${Math.round(an.lat)} min`);
  if (an.has) {
    r("👀 Acordado no meio", `${watchHours(an.waso)} <small>${an.wakes} ${an.wakes === 1 ? "despertar" : "despertares"}</small>`);
    if (an.longAwake) r("🌀 Maior acordada", `${watchHours(an.longAwake.dur)} <small>às ${watchClock(Number(s.start) + an.longAwake.off * 60000)}</small>`);
    if (an.toDeep !== undefined) r("🌊 1º profundo", `${watchHours(Math.max(0, an.toDeep))} <small>depois de dormir</small>`);
    if (an.longDeep) r("🌊 Maior bloco profundo", `${watchHours(an.longDeep.dur)} <small>às ${watchClock(Number(s.start) + an.longDeep.off * 60000)}</small>`);
    if (an.toRem !== undefined) r("🌀 1º REM", `${watchHours(Math.max(0, an.toRem))} <small>depois de dormir (normal: 60-120 min)</small>`);
    r("🔁 Ciclos", `~${an.cycles} <small>noite boa tem 4-6</small>`);
    if (an.endAwake >= 5) r("🌅 Enrolou na cama", `${watchHours(an.endAwake)} <small>acordado antes de levantar</small>`);
  }
  const dip = wslHrDip(watchDay(date) || {}, s);
  if (dip) r("📉 Queda do batimento", `${Math.round(dip.pct)}% <small>dormindo x média do dia (bom: 10%+)</small>`);
  r("🕰️ Meio do sono", `${watchClock(Number(s.start) + (Number(s.end) - Number(s.start)) / 2)} <small>bom: entre 0h e 4h</small>`);
  if (s.hrvAvg) r("💓 HRV da noite", `${watchInt(s.hrvAvg)} ms`);
  if (s.oxLowSec !== undefined) r("🫁 Abaixo de 90%", s.oxLowSec >= 1 ? wslSecs(s.oxLowSec) : "nunca");
  if (s.score !== undefined) r("📱 Nota do Samsung", `${watchInt(s.score)}`);
  if (s.eff !== undefined) r("📱 Eficiência (Samsung)", `${watchInt(s.eff)}%`);
  if (s.ment !== undefined) r("🧠 Recuperação mental", `${watchInt(s.ment)}`);
  if (s.phys !== undefined) r("💪 Recuperação física", `${watchInt(s.phys)}`);
  if (s.mov !== undefined) r("🤸 Movimento/despertar", `${watchDec(s.mov)}`);
  return `<details class="wsl-details"><summary>🔬 Detalhes técnicos</summary><div class="kv-list">${rows.join("")}</div></details>`;
}

// v1.98 (APK 2.6): falta o Samsung direto? Um cartão só, com o passo a passo (some quando liga)
function wslSamsungHint(date) {
  if (typeof watchSamsungCan !== "function" || !watchSamsungCan() || watchSamsungOn()) return "";
  const d = watchDay(date) || {};
  if (d.temp && d.energy && (wslNight(date) || {}).score !== undefined) return "";
  return `<div class="hint-box wsl-samsung">📱 <b>Falta pouco pro sono completo:</b> 🌡️ temperatura da pele, 🔋 Energy Score e a nota do Samsung vêm direto do Samsung Health, sozinhos, a cada 🔄.<br>${WATCH_SAMSUNG_DEV}
    <button type="button" class="btn btn-secondary" data-click="watchSamsungAsk">📱 Ligar o Samsung Health</button></div>`;
}

function wslCloba(date, s, an) {
  const lines = watchAnDayCloba("sleep", WATCH_METRICS.sleep, date);
  const extra = [];
  if (an.lat !== undefined && an.lat > 30) extra.push(`⏳ Levou ${Math.round(an.lat)} min pra apagar. Tela, café depois das 14h ou cabeça a mil? Chá de mulungu tá na Kitchen. 🍵`);
  if (an.has && an.waso >= 60) extra.push(`🌀 Ficou ${watchHours(an.waso)} acordado no meio da noite (${an.wakes} ${an.wakes === 1 ? "vez" : "vezes"}). Calor, xixi, Killua e Gon pulando na cama?`);
  const staged = s.deep + s.light + s.rem;
  if (staged && (s.rem / staged) * 100 < 15) extra.push("🌀 Pouco REM. Ele vem mais no fim da noite: acordar cedo demais ou álcool cortam ele.");
  if (staged && (s.deep / staged) * 100 < 10) extra.push("🌊 Pouco profundo. Treino de dia e quarto fresco e escuro ajudam.");
  if (an.lat !== undefined && an.lat < 5 && s.min < watchGoals().sleepMin) extra.push("😵 Apagou em menos de 5 min: sinal de cansaço acumulado, não de sono bom.");
  const dip = wslHrDip(watchDay(date) || {}, s);
  if (dip && dip.pct < 10) extra.push(`📉 O batimento caiu só ${Math.max(0, Math.round(dip.pct))}% dormindo (bom é 10%+). Janta pesada, álcool ou treino tarde deixam o corpo ligado.`);
  if (s.oxLowSec >= 300) extra.push(`🫁 Oxigênio abaixo de 90% por ${wslSecs(s.oxLowSec)}. Uma noite não diz nada; muitas assim, vale ver com médico.`);
  // v1.98: termômetro do corpo (igual o Oura): pele mais quente que o TEU normal = alerta cedo
  const dd = watchDay(date) || {};
  const tBase = dd.temp ? watchAvgBefore("temp", date, 30) : null;
  if (tBase !== null && dd.temp - tBase >= 0.5) extra.push(`🌡️ Pele ${watchDec(dd.temp - tBase)} °C mais quente que o teu normal. Quarto quente, álcool, treino tarde... ou o corpo brigando com alguma coisa. Se o HRV também caiu, pega leve hoje.`);
  if (s.napMin >= 90) extra.push(`💤 Cochilo de ${watchHours(s.napMin)}: compensa a noite curta, mas pode roubar o sono de hoje.`);
  const all = [...lines, ...extra].slice(0, 5);
  if (!all.length) return "";
  return `<div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Papo reto do Cloba</b>${all.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>`;
}

/* ---------------- v1.98: 🔋 Prontidão do Cloba ----------------
 * "Ideia do Cloba" (Rafa: o que o Cloba acha daora pra ir acompanhando). Estilo Readiness do
 * Oura / Recovery do Whoop: junta a noite com o corpo (HRV, FC dormindo, temperatura x o TEU
 * normal), o banco de sono e o esforço de ontem, e diz o que fazer com o dia.
 * Só usa o que chega sozinho (Health Connect + SDK do Samsung). O que falta fica fora da conta. */
function wslBank(date, nights = 14) {
  const goal = watchGoals().sleepMin;
  let bank = 0, n = 0;
  for (let i = 0; i < nights; i++) {
    const s = wslNight(watchAddDays(date, -i));
    if (!s) continue;
    n++;
    bank += s.min + (Number(s.napMin) || 0) - goal;
  }
  return { bank, n };
}

function wslReadyParts(date) {
  const s = wslNight(date);
  if (!s) return null;
  const d = watchDay(date) || {};
  const lin = (v, bad, good) => Math.max(0, Math.min(100, Math.round(((v - bad) / (good - bad)) * 100)));
  const parts = [];
  const sleepScore = wslFactors(s, date, wslAnalyze(s)).total;
  parts.push({ key: "sleep", label: "😴 Noite", value: `nota ${sleepScore}`, score: sleepScore, w: 35 });
  const b = wslBank(date);
  if (b.n >= 5) parts.push({ key: "bank", label: "🏦 Banco", value: `${b.bank < 0 ? "−" : "+"}${watchHours(Math.abs(b.bank))}`, score: b.bank >= 0 ? 100 : lin(b.bank, -600, 0), w: 15 });
  const hrvBase = d.hrv ? watchAvgBefore("hrv", date, 60) : null;
  if (hrvBase) {
    const r = d.hrv / hrvBase;
    parts.push({ key: "hrv", label: "💓 HRV", value: `${watchInt(d.hrv)} ms`, sub: `normal ${watchInt(hrvBase)}`, score: r >= 1.05 ? 100 : lin(r, 0.7, 1.05), w: 20 });
  }
  // FC em repouso do dia x a média dela (não mistura com o menor batimento da noite)
  const rest = Number(d.restHr) || 0;
  const restBase = rest ? watchAvgBefore("restHr", date, 30) : null;
  if (rest && restBase) {
    const diff = rest - restBase;
    parts.push({ key: "rest", label: "❤️ FC em repouso", value: `${watchInt(rest)} bpm`, sub: `normal ${watchInt(restBase)}`, score: diff <= -1 ? 100 : lin(diff, 7, -1), w: 15 });
  }
  const tBase = d.temp ? watchAvgBefore("temp", date, 30) : null;
  if (tBase !== null) {
    const dev = d.temp - tBase;
    parts.push({ key: "temp", label: "🌡️ Temperatura", value: `${dev >= 0 ? "+" : "−"}${watchDec(Math.abs(dev))} °C`, sub: "x teu normal", score: Math.abs(dev) <= 0.3 ? 100 : lin(Math.abs(dev), 1.2, 0.3), w: 10 });
  }
  const y = watchDay(watchAddDays(date, -1)) || {};
  const loadBase = watchAvgBefore("activeKcal", watchAddDays(date, -1), 30);
  if (y.activeKcal && loadBase) {
    const r = y.activeKcal / loadBase;
    parts.push({ key: "load", label: "🔥 Esforço de ontem", value: `${watchInt(y.activeKcal)} kcal`, sub: `${r >= 1 ? "+" : "−"}${Math.abs(Math.round((r - 1) * 100))}% x normal`, score: r <= 1.3 ? 100 : lin(r, 2.2, 1.3), w: 5 });
  }
  const wsum = parts.reduce((a, x) => a + x.w, 0);
  const total = Math.round(parts.reduce((a, x) => a + x.score * x.w, 0) / (wsum || 1));
  return { parts, total, energy: Number(d.energy) || null };
}

function wslReadyVerdict(total) {
  if (total >= 85) return { icon: "🚀", label: "Pronto pra guerra", cls: "is-good", tip: "Dia bom pra caminhada longa, Saitama completo ou bater recorde. Aproveita!" };
  if (total >= 70) return { icon: "💪", label: "Dia bom", cls: "is-good", tip: "Treino normal liberado. Só não inventa moda." };
  if (total >= 55) return { icon: "😐", label: "Vai no teu ritmo", cls: "is-ok", tip: "Caminhada leve e alongamento. Hoje não é dia de recorde." };
  return { icon: "🪫", label: "Dia de recuperar", cls: "is-bad", tip: "Corpo pediu arrego: alongamento de 10 min, água e dormir cedo hoje." };
}

function wslReady(date) {
  const r = wslReadyParts(date);
  if (!r || r.parts.length < 2) return "";
  const v = wslReadyVerdict(r.total);
  const worst = r.parts.filter((x) => x.score < 60).sort((a, b) => a.score - b.score)[0];
  const isToday = date === toIsoDate();
  return `<div class="section-title">🔋 Prontidão do Cloba${isToday ? "" : ` <span class="watch-muted">· ${escapeHtml(watchAnDate(date))}</span>`}</div>
    <div class="card wsl-ready">
      <div class="wsl-ready-top">
        ${wslRing(r.total)}
        <div class="wsl-ready-main">
          <b>${v.icon} ${escapeHtml(v.label)}</b>
          <p>${escapeHtml(v.tip)}</p>
          ${worst ? `<small>O que mais puxou pra baixo: ${escapeHtml(worst.label)} (${escapeHtml(worst.value)})</small>` : ""}
          ${r.energy ? `<small>🔋 Energy Score do Samsung: ${watchInt(r.energy)}</small>` : ""}
        </div>
      </div>
      <div class="wsl-ready-parts">${r.parts.map((x) => {
        const g = wslGrade(x.score);
        return `<div class="wsl-ready-part"><span>${x.label}</span><b>${escapeHtml(x.value)}</b><i class="wsl-ready-bar ${g.cls}"><em style="width:${x.score}%"></em></i>${x.sub ? `<small>${escapeHtml(x.sub)}</small>` : ""}</div>`;
      }).join("")}</div>
      <p class="watch-muted">Noite (35%) + HRV (20%) + banco de sono e FC em repouso (15% cada) + temperatura (10%) + esforço de ontem (5%), sempre comparando com o <b>teu</b> normal. Igual Readiness do Oura e Recovery do Whoop.</p>
    </div>`;
}

/* ---------------- v1.98: 🔍 O que mexe no teu sono ----------------
 * Ideia do Cloba: o diferencial que nenhum app do relógio tem, porque o Toba sabe do teu dia.
 * Compara as noites (últimos 90 dias) depois de dias com e sem cada coisa. Só mostra o que tem
 * 4+ noites de cada lado e diferença que vale a pena (3+ pontos na nota ou 15+ min). */
function wslMoves(date) {
  const goal = watchGoals();
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const d = watchAddDays(date, -i);
    const s = wslNight(d);
    if (!s) continue;
    const y = watchDay(watchAddDays(d, -1)) || {};
    const ys = wslNight(watchAddDays(d, -1));
    const bedH = new Date(Number(s.start)).getHours();
    const wd = new Date(`${d}T12:00:00`).getDay(); // acordou sáb/dom = noite de sex/sáb
    rows.push({
      score: wslFactors(s, d, wslAnalyze(s)).total, min: s.min,
      ex: Array.isArray(y.ex) && y.ex.length > 0,
      steps: Number(y.steps) > 0 ? Number(y.steps) >= goal.steps : null,
      nap: ys ? Array.isArray(ys.naps) && ys.naps.some((n) => new Date(n.start).getHours() >= 11) : null,
      late: bedH < 12,
      wknd: wd === 0 || wd === 6,
    });
  }
  if (rows.length < 14) return { rows, list: [] };
  const tests = [
    { k: "ex", yes: "🏃 Dia com treino/caminhada", no: "dia sem" },
    { k: "steps", yes: `👟 Dia com ${watchInt(goal.steps)}+ passos`, no: "dia com menos" },
    { k: "nap", yes: "💤 Cochilou de tarde", no: "sem cochilo" },
    { k: "late", yes: "🌙 Deitou depois da meia-noite", no: "antes" },
    { k: "wknd", yes: "🎉 Noite de sexta/sábado", no: "dia de semana" },
  ];
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const list = [];
  tests.forEach((t) => {
    const a = rows.filter((r) => r[t.k] === true), b = rows.filter((r) => r[t.k] === false);
    if (a.length < 4 || b.length < 4) return;
    const ds = avg(a.map((r) => r.score)) - avg(b.map((r) => r.score));
    const dm = avg(a.map((r) => r.min)) - avg(b.map((r) => r.min));
    if (Math.abs(ds) < 3 && Math.abs(dm) < 15) return;
    list.push({ ...t, ds, dm, na: a.length, nb: b.length, sa: Math.round(avg(a.map((r) => r.score))), sb: Math.round(avg(b.map((r) => r.score))) });
  });
  list.sort((x, y) => Math.abs(y.ds) + Math.abs(y.dm) / 5 - (Math.abs(x.ds) + Math.abs(x.dm) / 5));
  return { rows, list };
}

function wslMovesHtml(date) {
  const m = wslMoves(date);
  if (m.rows.length < 14) {
    return `<div class="section-title">🔍 O que mexe no teu sono</div>
      <div class="card"><p class="watch-muted">🕵️ O Cloba tá juntando pista: com ${m.rows.length ? `${m.rows.length} noites` : "as noites"} ainda não dá pra cravar nada. A partir de 14 ele começa a contar se treino, passos, cochilo e horário mexem no teu sono.</p></div>`;
  }
  const body = m.list.length ? m.list.map((x) => {
    const good = x.ds >= 0;
    const minTxt = Math.abs(x.dm) >= 10 ? ` · ${x.dm >= 0 ? "+" : "−"}${watchHours(Math.abs(Math.round(x.dm)))} de sono` : "";
    return `<div class="wsl-move ${good ? "is-good" : "is-bad"}">
      <div class="wsl-move-head"><span>${escapeHtml(x.yes)}</span><b>${good ? "+" : "−"}${Math.abs(Math.round(x.ds))} na nota</b></div>
      <small>nota ${x.sa} (${x.na} noites) x ${x.sb} ${escapeHtml(x.no)} (${x.nb})${escapeHtml(minTxt)}</small>
    </div>`;
  }).join("") : `<p class="watch-muted">Por enquanto nada mexe muito: treino, passos, cochilo e horário dão quase a mesma nota. Sono estável! 👊</p>`;
  return `<div class="section-title">🔍 O que mexe no teu sono <span class="watch-muted">· ${m.rows.length} noites</span></div>
    <div class="card">${body}
      <p class="watch-muted">A noite depois de cada coisa, nos últimos 90 dias. É correlação, não prova: quanto mais noite, mais certeiro.</p>
    </div>`;
}

// v1.98: 🌍 Jet lag social: meio do sono no fim de semana x dia de semana (Rise/Oura chamam assim)
function wslSocialJetlag(date) {
  const mids = { wk: [], we: [] };
  for (let i = 0; i < 28; i++) {
    const d = watchAddDays(date, -i);
    const s = wslNight(d);
    if (!s) continue;
    const wd = new Date(`${d}T12:00:00`).getDay();
    const mid = watchAnClockMin(Number(s.start) + (Number(s.end) - Number(s.start)) / 2, 12 * 60);
    (wd === 0 || wd === 6 ? mids.we : mids.wk).push(mid);
  }
  if (mids.we.length < 2 || mids.wk.length < 4) return null;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return avg(mids.we) - avg(mids.wk);
}

/* ---------------- A tela da noite (aba Dia do 😴) ---------------- */

function renderWatchSleepDay(date) {
  const s = wslNight(date);
  if (!s) return ""; // sem noite: a análise mostra a tela genérica ("Sem sono nesse dia")
  const m = WATCH_METRICS.sleep;
  const an = wslAnalyze(s);
  const f = wslFactors(s, date, an);
  const goal = watchGoals().sleepMin;
  const gpct = Math.min(100, Math.round((s.min / goal) * 100));
  const g = wslGrade(f.total);
  const r = watchRefs("sleep", date);
  const dates = [];
  for (let i = 13; i >= 0; i--) dates.push(watchAddDays(date, -i));
  const hero = `<div class="card wsl-hero">
      <div class="wsl-hero-top">
        <div class="wsl-hero-main">
          <div class="wsl-hero-val">${escapeHtml(watchHours(s.min))}</div>
          <div class="wsl-hero-sub">dormindo · ${escapeHtml(watchHours(an.inBed))} na cama · ${an.eff}% eficiência</div>
          <div class="wsl-hero-clock">🛏️ ${watchClock(s.start)} › ⏰ ${watchClock(s.end)}</div>
        </div>
        <div class="wsl-hero-score">${wslRing(f.total)}<span class="wsl-badge ${g.cls}">${g.label}</span><small>Nota do Cloba${s.score !== undefined ? ` · Samsung ${watchInt(s.score)}` : ""}</small></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${gpct}%;background:${s.min >= goal ? "var(--gold-2)" : m.color}"></div></div>
      <p class="watch-muted">${s.min >= goal ? "🏆 Meta batida" : `${gpct}% da meta de ${escapeHtml(watchHours(goal))}`}${s.napMin ? ` · 💤 +${escapeHtml(watchHours(s.napMin))} de cochilo` : ""}</p>
    </div>`;
  const factors = `<div class="section-title">🧾 Fatores da nota</div>
    <div class="wsl-factors">${f.list.map((x) => {
      const gg = wslGrade(x.score);
      return `<div class="wsl-factor"><span class="wsl-factor-label">${x.label}</span><b>${escapeHtml(x.value)}</b><span class="wsl-badge ${gg.cls}">${gg.label}</span><small>${escapeHtml(x.tip)}</small></div>`;
    }).join("")}</div>
    <p class="watch-muted wsl-factor-note">Nota do Cloba = tempo dormindo (30%) + profundo, REM, acordado, eficiência, pegar no sono e horário (10% cada), no estilo dos fatores do Oura. O que não foi medido fica de fora da conta.</p>`;
  return `
    ${hero}
    <div class="toba-stats is-3 watch-an-stats">${watchAnDayTiles("sleep", m, date).join("")}</div>
    <div class="card">
      <div class="card-title">📈 As 14 noites até ${escapeHtml(watchDayLabel(date).toLowerCase())}</div>
      ${watchSleepStackChart(dates, { hi: date, goal, avg: r.w, avgLabel: "média 7 dias" })}
    </div>
    ${wslReady(date)}
    ${wslCloba(date, s, an)}
    ${factors}
    ${wslNightCard(date, s, an)}
    ${wslBodyRows(date, s, an)}
    ${wslNaps(date, s)}
    ${wslRegularity(date)}
    ${wslMovesHtml(date)}
    ${wslSamsungHint(date)}
    ${wslDetails(date, s, an)}
    ${watchAnAbout("sleep", m)}
    <button type="button" class="btn btn-secondary watch-an-dayall" data-click="watchAnDayAll" data-id="${date}">📋 Tudo desse dia</button>`;
}

/* ---------------- Semana / Mês / ... do 😴 ---------------- */

function watchSleepPeriodExtras(from, to) {
  const end = to < toIsoDate() ? to : toIsoDate();
  const dates = [];
  for (let d = from; d <= end; d = watchAddDays(d, 1)) dates.push(d);
  const nights = dates.map((date) => ({ date, s: wslNight(date) })).filter((x) => x.s);
  if (!nights.length) return "";
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const scores = nights.map((x) => wslFactors(x.s, x.date, wslAnalyze(x.s)).total);
  const ans = nights.map((x) => wslAnalyze(x.s));
  const eff = avg(ans.map((a) => a.eff));
  const lat = avg(ans.map((a) => a.lat).filter((v) => Number.isFinite(v)));
  const wakes = avg(ans.filter((a) => a.has).map((a) => a.wakes));
  const scoreAvg = Math.round(avg(scores));
  const best = nights[scores.indexOf(Math.max(...scores))];
  const napNights = nights.filter((x) => x.s.napMin > 0);
  const napTimes = napNights.flatMap((x) => (Array.isArray(x.s.naps) ? x.s.naps.map((n) => new Date(n.start).getHours()) : []));
  const napTxt = napNights.length
    ? `💤 ${napNights.length} ${napNights.length === 1 ? "dia com cochilo" : "dias com cochilo"}, média de ${watchHours(avg(napNights.map((x) => x.s.napMin)))}${napTimes.length ? `, quase sempre lá pelas ${Math.round(avg(napTimes))}h` : ""}.`
    : "💤 Nenhum cochilo no período.";
  const win = dates.length <= 31 ? wslWindow(dates, "") : null;
  return `<div class="section-title">🧾 Qualidade das noites</div>
    <div class="card">
      <div class="toba-stats">
        ${watchAnTile("🤡 Nota média", `<span class="wsl-badge ${wslGrade(scoreAvg).cls}">${scoreAvg}</span>`, `melhor: ${escapeHtml(watchAnDate(best.date))} (${Math.max(...scores)})`)}
        ${watchAnTile("📐 Eficiência", eff !== null ? `${Math.round(eff)}%` : "--", "dormindo / na cama")}
        ${watchAnTile("⏳ Pega no sono", lat !== null ? `${Math.round(lat)} min` : "--", "em média")}
        ${watchAnTile("👀 Despertares", wakes !== null ? watchDec(wakes) : "--", "por noite")}
      </div>
      <p class="watch-muted">${escapeHtml(napTxt)}</p>
      ${win ? `<div class="card-title">🪟 Deitou › acordou</div>${win.svg}<div class="watch-an-legend"><span><i class="wsl-key-bar"></i>noite</span><span><i class="wsl-key-gold"></i>bateu a meta</span><span><i class="wsl-key-nap"></i>cochilo</span><span><i class="is-avg"></i>média</span></div>` : ""}
    </div>`;
}

tobaActions({ watchSleepBarTap, watchSleepScrub });
