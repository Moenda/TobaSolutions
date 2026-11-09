/*
 * Toba Health · 🩻 Raio-X · 😤 Stress turbinado (v2.04)
 *
 * Mesmo estilo do 😴 e do 👟. A aba Dia da análise do 😰 Stress (relogio-analise.js chama
 * renderWatchStressDay) vira a tela do dia:
 *   herói (stress do dia, faixa, de onde veio: 📥 Samsung ou ≈ 😤 Tensão do Cloba pelo batimento,
 *   pico, horas no alto, 🌬️ Respirar 1 min) · vs ontem/7/30 · 14 dias · 🤡 O Cloba sobre o stress ·
 *   🕐 Hora a hora (+ mapa de 8 semanas) · 📅 Teu dia da semana · 🔗 Sono e treino x stress ·
 *   🚗 No trânsito (horas no carro pelo 🧭 Toba Drive x fora dele) · 🌬️ Respirações · 🔍 O que mexe.
 * Tensão, hora a hora, carro e respiração moram em relogio-horas.js. Só LÊ (fora o 🌬️).
 */

function wstVal(date) {
  const d = watchDay(date);
  const v = d ? Number(d.stress) : NaN;
  return d && d.stress !== undefined && d.stress !== null && Number.isFinite(v) ? v : null;
}

function wstIsHr(date) {
  const d = watchDay(date);
  return Boolean(d && d.stressSrc === "hr");
}

function wstAvg(date, n, min) {
  let s = 0, c = 0;
  for (let i = 1; i <= n; i++) { const v = wstVal(watchAddDays(date, -i)); if (v !== null) { s += v; c++; } }
  return c >= min ? s / c : null;
}

function wstZone(v) {
  return WATCH_METRICS.stress.zone(v);
}

function wstHero(date) {
  const v = wstVal(date);
  const d = watchDay(date) || {};
  const isToday = date === toIsoDate();
  const z = v !== null ? wstZone(v) : null;
  const src = v === null ? "" : wstIsHr(date) ? "≈ 😤 Tensão do Cloba (batimento)" : "📥 do Samsung";
  const bits = [];
  if (Number.isFinite(Number(d.stressPeak)) && d.stressMax !== undefined) bits.push(`💥 pico ${watchInt(d.stressMax)} às ${d.stressPeak}h`);
  if (d.stressHigh !== undefined) bits.push(`🔥 ${watchInt(d.stressHigh)} h no 70+`);
  const breaths = wxBreaths().filter((b) => toIsoDate(new Date(Number(b.at))) === date).length;
  const ring = v === null ? 0 : Math.max(0, Math.min(100, Math.round(v)));
  return `<div class="card wsl-hero wst-hero">
      <div class="wsl-hero-top">
        <div class="wsl-hero-main">
          <div class="wsl-hero-val" style="color:var(--coral)">${v !== null ? escapeHtml(watchInt(v)) : "--"}</div>
          <div class="wsl-hero-sub">${z ? `${z.icon} ${escapeHtml(z.label)}` : isToday ? "ainda sem medida hoje" : "sem medida nesse dia"}${src ? ` · ${escapeHtml(src)}` : ""}</div>
          ${bits.length ? `<div class="wsl-hero-clock">${escapeHtml(bits.join(" · "))}</div>` : ""}
        </div>
        <div class="wsl-hero-score">${wslRing(ring, v === null ? "is-ok" : v < 30 ? "is-good" : v < 50 ? "is-ok" : "is-bad")}<small>0 a 100 · menor é melhor</small></div>
      </div>
      <button type="button" class="btn btn-primary wst-breath-btn" data-click="wxBreathOpen">🌬️ Respirar 1 min${breaths ? ` <small>(${breaths}x ${isToday ? "hoje" : "nesse dia"})</small>` : ""}</button>
    </div>`;
}

function wstClobaLines(date) {
  const lines = [];
  const v = wstVal(date);
  const d = watchDay(date) || {};
  const n30 = wstAvg(date, 30, 5);
  if (v !== null && n30 !== null) {
    const diff = v - n30;
    if (diff >= 8) lines.push(`😬 ${Math.round(diff)} pontos acima do teu normal (${watchInt(n30)}). Dia pesado: hoje vale mais a caminhada leve do que treino pesado.`);
    else if (diff <= -8) lines.push(`😌 ${Math.round(-diff)} pontos abaixo do teu normal (${watchInt(n30)}). Cabeça leve, aproveita pra treinar forte.`);
    else lines.push(`➡️ No teu normal (${watchInt(n30)}).`);
  }
  if (Number.isFinite(Number(d.stressPeak)) && Number(d.stressMax) >= 60) lines.push(`⏰ O aperto foi lá pelas ${d.stressPeak}h. Se costuma ser nessa hora, uma 🌬️ antes já prepara o terreno.`);
  const s = typeof wslNight === "function" ? wslNight(date) : null;
  if (s && s.min < 360 && v !== null && n30 !== null && v > n30) lines.push(`😴 Dormiu ${watchHours(s.min)} e o stress subiu: noite curta deixa o corpo no modo alerta. Sono é o melhor calmante que existe.`);
  const drive = wxDriveHours(date);
  const t = wxTensionHours(date);
  if (t && drive.some((f) => f >= 0.4)) {
    const inCar = wxAvg(t.map((x, h) => (drive[h] >= 0.4 ? x : null)));
    const out = wxAvg(t.map((x, h) => (drive[h] === 0 ? x : null)));
    if (inCar !== null && out !== null && inCar - out >= 8) lines.push(`🚗 No carro tua tensão foi ${watchInt(inCar)}, fora dele ${watchInt(out)}. Trânsito de SP cobra pedágio no coração também.`);
  }
  let high = 0;
  for (let i = 0; i < 7; i++) { const x = wstVal(watchAddDays(date, -i)); if (x !== null && x >= 50) high++; else break; }
  if (high >= 3) lines.push(`🧯 ${high} dias seguidos puxados. Hoje: sol, 10 min sem celular e cama cedo. Sem negociação.`);
  if (v !== null && v >= 50 && !wxBreaths().some((b) => toIsoDate(new Date(Number(b.at))) === date)) lines.push("🌬️ Um minuto de respiração 4-6 abaixa o batimento na hora. Botão ali em cima.");
  return lines.slice(0, 4);
}

// 🕐 Hora a hora (só com o batimento por hora do APK 2.9)
function wstHoursCard(date) {
  const title = `<div class="section-title wsl-title">🕐 Hora a hora ${wslQ("stress-hours")}</div>`;
  if (!wxAnyHours()) return `${title}<div class="card"><p class="watch-muted">📲 Com o APK 2.9 o Cloba lê teu batimento hora a hora e calcula a 😤 Tensão de cada hora, sem import nenhum. Instala pelo KingInstaller e dá um 🔄.</p></div>`;
  const t = wxTensionHours(date);
  const isToday = date === toIsoDate();
  const normal = wxHourNormal(wxTensionHours, date, 28);
  const cls = (v) => (v === null ? "" : v >= 70 ? "is-high" : v >= 50 ? "is-mid" : "");
  const bars = t && t.some((x) => x !== null) ? wxHourBars(t, normal, { color: "var(--coral)", cls, label: "Tensão por hora", nowHour: isToday ? new Date().getHours() : undefined, emptyTip: "andando, dormindo ou treinando (não conta)", min: 50 }) : "";
  const heat = wxHeatmap(wxTensionHours, date, { color: "var(--coral)", label: "Mapa de tensão por hora", min: 40 });
  return `${title}<div class="card">
      ${bars || `<p class="watch-muted">Esse dia não teve hora parada acordado com batimento medido.</p>`}
      ${bars ? `<div class="watch-an-legend"><span><i class="wx-key-bar" style="background:var(--coral)"></i>tensão da hora</span><span><i class="wx-key-normal"></i>teu normal (28 dias)</span><span>vazio = andando/dormindo/treino</span></div>` : ""}
      ${heat ? `<div class="wx-sub">🗺️ Tuas 8 semanas, hora a hora</div>${heat.svg}${heat.best ? `<p class="watch-muted">😬 O aperto da semana costuma ser ${escapeHtml(WX_WEEKDAYS_LONG[heat.best.wd])} lá pelas ${heat.best.h}h. Hora boa pra marcar uma 🌬️ fixa.</p>` : ""}` : ""}
    </div>`;
}

// 📅 Teu dia da semana (12 semanas)
function wstWeekdays(date) {
  const avgs = wxWeekdayAvgs(wstVal, date, 84);
  const svg = wxWeekdayBars(avgs, new Date(`${date}T12:00:00`).getDay(), { color: "var(--coral)", label: "Stress médio por dia da semana" });
  if (!svg) return "";
  const order = [1, 2, 3, 4, 5, 6, 0].filter((i) => avgs[i] !== null);
  const worst = order.reduce((a, i) => (avgs[i] > avgs[a] ? i : a), order[0]);
  const best = order.reduce((a, i) => (avgs[i] < avgs[a] ? i : a), order[0]);
  return `<div class="section-title wsl-title">📅 Teu dia da semana ${wslQ("stress-weekday")}</div>
    <div class="card">${svg}
      <p class="watch-muted">😬 ${escapeHtml(WX_WEEKDAYS_LONG[worst])} é o teu dia mais tenso (${escapeHtml(watchInt(avgs[worst]))}); 😌 ${escapeHtml(WX_WEEKDAYS_LONG[best])} o mais leve (${escapeHtml(watchInt(avgs[best]))}). Últimas 12 semanas.</p>
    </div>`;
}

// 🔗 Sono e treino x stress (90 dias)
function wstLinks(date) {
  const both = (fn) => {
    const yes = [], no = [];
    for (let i = 0; i < 90; i++) {
      const d = watchAddDays(date, -i);
      if (d === toIsoDate()) continue;
      const r = fn(d);
      if (!r || r.v === null || r.flag === null) continue;
      (r.flag ? yes : no).push(r.v);
    }
    return yes.length >= 4 && no.length >= 4 ? { a: wxAvg(yes), b: wxAvg(no), na: yes.length, nb: no.length } : null;
  };
  const sleepFlag = (iso) => { const s = typeof wslNight === "function" ? wslNight(iso) : null; return s ? (s.min >= 420 ? true : s.min < 360 ? false : null) : null; };
  const sleep = both((d) => ({ v: wstVal(d), flag: sleepFlag(d) }));
  const train = both((d) => ({ v: wstVal(d), flag: wxMoved(d) }));
  const next = both((d) => ({ v: wstVal(watchAddDays(d, 1)), flag: wxMoved(d) }));
  const night = both((d) => { const s = typeof wslNight === "function" ? wslNight(watchAddDays(d, 1)) : null; const v = wstVal(d); return { v: s ? s.min : null, flag: v === null ? null : v >= 50 ? true : v < 30 ? false : null }; });
  if (!sleep && !train && !next && !night) return "";
  const tile = (label, r, sub, fmt = (x) => watchInt(x), down = true) => {
    if (!r) return watchAnTile(label, "--", "pouco dado ainda");
    const diff = r.a - r.b;
    const good = down ? diff < 0 : diff > 0;
    return watchAnTile(label, `${escapeHtml(fmt(r.a))} x ${escapeHtml(fmt(r.b))}`, sub, Math.abs(diff) < (down ? 3 : 15) ? "" : good ? "text-green" : "text-coral");
  };
  return `<div class="section-title wsl-title">🔗 Sono e treino x stress ${wslQ("stress-links")}</div>
    <div class="card"><div class="toba-stats">
      ${tile("😴 7h+ x < 6h", sleep, "stress no dia seguinte")}
      ${tile("🏃 Treino x sem", train, "stress do dia (fora a hora do treino)")}
      ${tile("🔁 Dia seguinte", next, "stress do dia seguinte x sem")}
      ${tile("🌙 Tenso x calmo", night, "sono na noite seguinte", (x) => watchHours(x), false)}
    </div></div>`;
}

// 🚗 No trânsito (últimos 35 dias com hora a hora)
function wstTraffic(date) {
  if (!wxAnyHours()) return "";
  const trips = wxTrips();
  const title = `<div class="section-title wsl-title">🚗 No trânsito ${wslQ("stress-traffic")}</div>`;
  if (!trips.length) return `${title}<div class="card"><p class="watch-muted">Quando tu dirige com o 🧭 Toba Drive (celular ou Android Auto), o Cloba cruza a viagem com teu batimento e mostra quanto o trânsito te tensiona.</p></div>`;
  let inS = 0, inW = 0, outS = 0, outN = 0;
  const per = [];
  for (let i = 0; i < 35; i++) {
    const d = watchAddDays(date, -i);
    const t = wxTensionHours(d);
    if (!t) continue;
    const dr = wxDriveHours(d);
    t.forEach((v, h) => {
      if (v === null || h < 6) return;
      if (dr[h] >= 0.25) { inS += v * dr[h]; inW += dr[h]; }
      else if (dr[h] === 0) { outS += v; outN++; }
    });
  }
  trips.forEach((tr) => {
    const d = toIsoDate(new Date(tr.a));
    if (d > date || d < watchAddDays(date, -34) || tr.b - tr.a < 10 * 60000) return;
    const t = wxTensionHours(d);
    if (!t) return;
    const dr = wxDriveHours(d);
    const v = wxAvg(t.map((x, h) => (dr[h] >= 0.25 && Math.min(wxHourStart(d, h) + 3600000, tr.b) > Math.max(wxHourStart(d, h), tr.a) ? x : null)));
    if (v !== null) per.push({ ...tr, d, v });
  });
  if (inW < 1 || outN < 10) return `${title}<div class="card"><p class="watch-muted">🕵️ Ainda pouca viagem com batimento medido nos últimos 35 dias. Mais umas corridas e o Cloba fala.</p></div>`;
  const a = inS / inW, b = outS / outN, diff = a - b;
  per.sort((x, y) => y.v - x.v);
  const top = per.slice(0, 3).map((x) => `<div class="kv-row"><span>🧭 ${escapeHtml(x.name)} <small class="watch-muted">${escapeHtml(watchAnDateShort(x.d))} ${watchClock(x.a)}</small></span><strong>${escapeHtml(watchInt(x.v))}</strong></div>`).join("");
  return `${title}<div class="card">
      <div class="toba-stats is-3">
        ${watchAnTile("🚗 Carro", escapeHtml(watchInt(a)), `${escapeHtml(wcaNum(inW, 0))} h medidas`)}
        ${watchAnTile("🏠 Fora", escapeHtml(watchInt(b)), "parado, acordado")}
        ${watchAnTile("⚖️ Dif.", `${diff >= 0 ? "+" : "−"}${escapeHtml(watchInt(Math.abs(diff)))}`, diff >= 8 ? "o trânsito pesa" : diff <= -3 ? "dirigir te acalma" : "quase igual", diff >= 8 ? "text-coral" : diff <= -3 ? "text-green" : "")}
      </div>
      ${top ? `<div class="wx-sub">😬 Viagens mais tensas (35 dias)</div><div class="kv-list">${top}</div>` : ""}
      <p class="watch-muted">${diff >= 8 ? "🎧 Podcast, saída 15 min antes e o Toba Auto quietinho ajudam. E uma 🌬️ quando estacionar." : "😎 O trânsito não tá te pegando. Zen até na Marginal."}</p>
    </div>`;
}

// 🌬️ Respirações feitas
function wstBreathCard(date) {
  const list = wxBreaths();
  const mon = watchAddDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
  const week = list.filter((b) => { const d = toIsoDate(new Date(Number(b.at))); return d >= mon && d <= date; }).length;
  // stress do dia em que respirou x dia tenso sem respirar (só dias 45+)
  const days = new Set(list.map((b) => toIsoDate(new Date(Number(b.at)))));
  const yes = [], no = [];
  for (let i = 1; i <= 60; i++) {
    const d = watchAddDays(date, -i);
    const prev = wstVal(watchAddDays(d, -1));
    const v = wstVal(watchAddDays(d, 1));
    if (prev === null || v === null || prev < 45) continue;
    (days.has(d) ? yes : no).push(v);
  }
  const eff = yes.length >= 3 && no.length >= 3 ? wxAvg(yes) - wxAvg(no) : null;
  return `<div class="section-title wsl-title">🌬️ Respirações ${wslQ("stress-breath")}</div>
    <div class="card">
      <div class="toba-stats is-3">
        ${watchAnTile("📅 Semana", `${week}`, "de 1 min")}
        ${watchAnTile("🫁 Total", `${list.length}`, list.length ? `última ${escapeHtml(watchAnDateShort(toIsoDate(new Date(Number(list[list.length - 1].at)))))}` : "bora a 1ª?")}
        ${watchAnTile("🧪 Ajuda?", eff === null ? "--" : `${eff <= 0 ? "−" : "+"}${escapeHtml(watchInt(Math.abs(eff)))}`, eff === null ? "precisa de mais dias" : "stress do dia seguinte", eff === null ? "" : eff < -2 ? "text-green" : eff > 2 ? "text-coral" : "")}
      </div>
      <button type="button" class="btn btn-secondary" data-click="wxBreathOpen">🌬️ Respirar agora</button>
    </div>`;
}

/* 🔍 O que mexe no teu stress (90 dias) */
function wstMovesHtml(date) {
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const d = watchAddDays(date, -i);
    if (d === toIsoDate()) continue;
    const v = wstVal(d);
    if (v === null) continue;
    const x = watchDay(d) || {};
    const s = typeof wslNight === "function" ? wslNight(d) : null;
    const wd = new Date(`${d}T12:00:00`).getDay();
    const drove = wxDriveHours(d).reduce((a, b) => a + b, 0);
    const prev = wstVal(watchAddDays(d, -1));
    rows.push({
      v,
      sleep: s ? (s.min >= 420 ? true : s.min < 360 ? false : null) : null,
      ex: wxMoved(d),
      steps: Number(x.steps) > 0 ? Number(x.steps) >= watchGoals().steps : null,
      wknd: wd === 0 || wd === 6,
      drive: drove >= 1 ? true : drove === 0 ? false : null,
      chain: prev === null ? null : prev >= 50 ? true : prev < 30 ? false : null,
    });
  }
  const list = wxMoves(rows, [
    { k: "sleep", yes: "😴 Depois de dormir 7h+", no: "depois de menos de 6h" },
    { k: "ex", yes: "🏃 Dia com treino/caminhada", no: "sem treino" },
    { k: "steps", yes: "👟 Dia na meta de passos", no: "dia parado" },
    { k: "wknd", yes: "🎉 Sábado e domingo", no: "dia de semana" },
    { k: "drive", yes: "🚗 Dia com 1 h+ de carro", no: "sem carro" },
    { k: "chain", yes: "🔁 Depois de dia tenso (50+)", no: "depois de dia tranquilo" },
  ], 3, 0.08);
  return wxMovesHtml("🔍 O que mexe no teu stress", "stress-moves", rows, list, {
    what: "se sono, treino, passos, carro e fim de semana mexem no teu stress", fmt: (v) => watchInt(v), better: "down",
    none: "Nada mexe muito por enquanto: o teu stress é bem constante. Constância de monge. 🧘",
  });
}

/* ---------------- A tela do dia (aba Dia do 😰) ---------------- */

function renderWatchStressDay(date) {
  const m = WATCH_METRICS.stress;
  const r = watchRefs("stress", date);
  const rows = watchAnRows("stress", watchAddDays(date, -13), date).map((x) => ({ ...x, label: x.date.slice(8, 10) }));
  const lines = wstClobaLines(date);
  const cloba = lines.length ? `<div class="section-title wsl-title">🤡 O Cloba sobre o stress ${wslQ("stress-talk")}</div>
    <div class="card wsl-papo"><div class="wsl-papo-lines is-first">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div></div>` : "";
  return `
    ${wstHero(date)}
    <div class="toba-stats is-3 watch-an-stats">${watchAnDayTiles("stress", m, date).join("")}</div>
    <div class="card">
      <div class="card-title">📈 Os 14 dias até ${escapeHtml(watchDayLabel(date).toLowerCase())}</div>
      ${watchAnChart(rows, m, 0, r.w, { hi: date, avgLabel: "média 7 dias", daily: true })}
    </div>
    ${cloba}
    ${wstHoursCard(date)}
    ${wstWeekdays(date)}
    ${wstLinks(date)}
    ${wstTraffic(date)}
    ${wstBreathCard(date)}
    ${wstMovesHtml(date)}
    ${watchAnAbout("stress", m)}
    ${watchHasData(watchDay(date)) ? `<button type="button" class="btn btn-secondary watch-an-dayall" data-click="watchAnDayAll" data-id="${date}">📋 Tudo desse dia</button>` : ""}`;
}

/* ---------------- ❔ do stress (mesmo modal do 😴) ---------------- */
if (typeof WSL_HELP === "object") {
  Object.assign(WSL_HELP, {
    "stress-talk": {
      title: "❔ 🤡 O Cloba sobre o stress",
      body: [
        ["📥 ou ≈", "Dia com o stress do Samsung (📥 import antigo) usa o número dele. Dia sem ele usa a 😤 Tensão do Cloba, calculada pelo teu batimento (o Samsung não manda o stress pro Health Connect, e tu não quer ficar importando)."],
        ["😤 Tensão do Cloba", "Em cada hora que tu tava PARADO (menos de 300 passos), acordado e longe de treino, o Cloba vê quanto o coração tava acima do teu repouso do dia. Coração acelerado sem estar se mexendo = corpo em alerta. Cada batida acima do repouso vale 4 pontos, de 0 a 100; nos dias que têm os dois, ele ajusta a régua pra bater com a média do Samsung."],
        ["⚠️ Papo reto", "Café, calor, digestão e doença também sobem o batimento. É uma estimativa boa pra comparar TU com TU, não um exame."],
      ],
    },
    "stress-hours": {
      title: "❔ 🕐 Hora a hora",
      body: [
        ["📊 As barras", "A tensão de cada hora do dia (6h às 23h). Hora vazia = tu tava andando, dormindo ou treinando: aí o coração sobe por motivo bom e não conta."],
        ["🗺️ O mapa", "Média de cada hora em cada dia da semana nas últimas 8 semanas. Mais forte = mais tenso. Bom pra descobrir a tua hora do aperto (reunião? trânsito? fim do expediente?)."],
      ],
    },
    "stress-weekday": {
      title: "❔ 📅 Teu dia da semana",
      body: [["📊 Como lê", "Stress médio de cada dia da semana nas últimas 12 semanas. O dia aceso é o dia da semana escolhido."]],
    },
    "stress-links": {
      title: "❔ 🔗 Sono e treino x stress",
      body: [
        ["😴 Noite", "Stress médio dos dias depois de dormir 7h+ x depois de menos de 6h."],
        ["🏃 Treino", "Dias com treino ou caminhada de 15 min+ x sem. A hora do treino (e a hora depois) não entra, então a comparação é justa."],
        ["🌙 Dia tenso", "Sono da noite depois de dia tenso (50+) x tranquilo (menos de 30)."],
        ["🎨 Cores", "Verde = o primeiro número é o melhor (stress mais baixo / sono mais longo)."],
      ],
    },
    "stress-traffic": {
      title: "❔ 🚗 No trânsito",
      body: [
        ["🧭 Como cruza", "Pega as viagens do 🧭 Toba Drive (celular e Android Auto, sem o Simular) e vê em que horas tu tava no carro. A tensão dessas horas (dirigindo, parado no volante) contra as horas paradas fora do carro, nos últimos 35 dias."],
        ["😬 Mais tensas", "As 3 viagens de 10 min+ com a maior tensão nas horas dela."],
      ],
    },
    "stress-breath": {
      title: "❔ 🌬️ Respirações",
      body: [
        ["🫁 Como faz", "6 respirações em 1 minuto: 4 segundos puxando pelo nariz (barriga sobe) e 6 soltando devagar. Soltar mais devagar que puxar liga o freio do corpo (nervo vago) e o batimento cai em minutos."],
        ["🧪 Funciona?", "Depois de dia tenso (45+): o stress do dia seguinte quando tu respirou x quando não. Menor = tá funcionando pra ti."],
        ["🏆 Troféus", "Respiração inteira conta pros troféus 🌬️ do Perfil (1, 10 e 50)."],
      ],
    },
    "stress-moves": {
      title: "❔ 🔍 O que mexe no teu stress",
      body: [
        ["🕵️ Como funciona", "Últimos 90 dias (fora hoje): stress médio dos dias com e sem cada coisa: sono bom, treino, meta de passos, fim de semana, 1 h+ de carro e dia seguinte a um dia tenso."],
        ["📏 O que aparece", "Só o que tem 4+ dias de cada lado e diferença de 3+ pontos ou 8%+. Verde = baixa o stress."],
      ],
    },
  });
}
