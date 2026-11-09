/*
 * Toba Health · 🩻 Raio-X · 🏅 Nota do Dia do Cloba (v2.04)
 *
 * Um número de 0 a 100 que junta o dia inteiro: 😴 sono 30 + 👟 passos 25 + 🔥 ativas 20 (meta
 * adaptativa) + 😤 stress 15 + 🏃 se mexer de propósito 10. A conta é calcWatchDayScore
 * (health-metrics.js), a mesma dos troféus 🏅 do Perfil (nd-*: dia 70+, 7 e 30 seguidos, 90+, 100).
 * Mora no topo do 🤡 Papo reto GERAL (renderWatchCloba em relogio-dia.js chama wndStripHtml);
 * tocar abre a folha #wndModal com o porquê da nota e o que subir. Só LÊ.
 */

const WND_PARTS = {
  sleep: { icon: "😴", name: "Sono", tip: (p) => `Dormiu ${watchHours(p.v)} de ${watchHours(p.goal)}. Abaixo da metade da meta zera.`, up: "Deitar 30 min mais cedo é o ponto mais barato da nota." },
  steps: { icon: "👟", name: "Passos", tip: (p) => `${watchInt(p.v)} de ${watchInt(p.goal)} passos.`, up: "Ir a pé até a padaria e voltar já são uns 1.500." },
  active: { icon: "🔥", name: "Ativas", tip: (p) => `${watchInt(p.v)} de ${watchInt(p.goal)} kcal (🎯 meta que anda contigo).`, up: "15 min de caminhada depois do almoço resolvem um terço disso." },
  stress: { icon: "😤", name: "Stress", tip: (p) => `Stress ${watchInt(p.v)}: até 25 vale tudo, 70+ zera.`, up: "🌬️ Respirar 1 min e sol no rosto baixam o número." },
  move: { icon: "🏃", name: "Se mexeu", tip: (p) => (p.v >= 1 ? "Treino ou exercício de 15 min+ no dia." : p.v > 0 ? "Descanso depois de 2 dias de treino (vale 60%)." : "Sem treino nem exercício de 15 min+."), up: "Qualquer caminhada de 15 min gravada no relógio conta." },
};

function wndScore(date) {
  return typeof calcWatchDayScore === "function" ? calcWatchDayScore(healthDb, date) : null;
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
  return `<div class="wnd-strip watch-tap" role="button" tabindex="0" data-click="wndOpen" data-id="${date}">
      ${wslRing(r.score, g.cls)}
      <div class="wnd-strip-main">
        <b>🏅 Nota do Dia${isToday ? " (até agora)" : ""}</b>
        <span class="watch-muted">${g.icon} ${escapeHtml(g.label)}${st.cur >= 2 ? ` · 🔥 ${st.cur} dias 70+` : ""}</span>
        <div class="wnd-chips">${chips}</div>
      </div>
      <span class="toba-hub-chevron">›</span>
    </div>`;
}

function wndOpen(el) {
  const date = (el && el.dataset.id) || watchSelDate();
  const body = document.getElementById("wndBody");
  if (!body) return;
  const r = wndScore(date);
  if (!r) return;
  const g = wndGrade(r.score);
  const tw = r.parts.reduce((a, p) => a + p.w, 0);
  const st = wndStreak(date);
  // o que mais dá ponto pra subir: a parte com mais pontos perdidos
  const lost = r.parts.map((p) => ({ p, lost: ((1 - p.f) * p.w * 100) / tw })).sort((a, b) => b.lost - a.lost)[0];
  const rows = r.parts.map((p) => {
    const pts = Math.round((p.f * p.w * 100) / tw), max = Math.round((p.w * 100) / tw);
    return `<div class="wnd-part">
        <div class="wnd-part-head"><span>${WND_PARTS[p.k].icon} ${escapeHtml(WND_PARTS[p.k].name)}</span><b>${pts}<small>/${max}</small></b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.round(p.f * 100)}%;background:${p.f >= 0.999 ? "var(--gold-2)" : p.f < 0.5 ? "var(--coral)" : "var(--blue)"}"></div></div>
        <small class="watch-muted">${escapeHtml(WND_PARTS[p.k].tip(p))}</small>
      </div>`;
  }).join("");
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dd = watchAddDays(date, -i);
    const s = wndScore(dd);
    days.push({ date: dd, v: s ? s.score : null, label: dd.slice(8, 10) });
  }
  const m = { icon: "🏅", name: "Nota do Dia", color: "var(--blue)", better: "up", fmt: (v) => watchInt(v) };
  const vals = days.filter((x) => x.v !== null).map((x) => x.v);
  body.innerHTML = `
    <div class="wnd-top">${wslRing(r.score, g.cls)}<div><b>${g.icon} ${escapeHtml(g.label)}</b><p class="watch-muted">${escapeHtml(watchDayLabel(date))}${date === toIsoDate() ? " até agora (o dia ainda tá aberto)" : ""}</p></div></div>
    <div class="toba-stats is-3">
      ${watchAnTile("🔥 Em fila", `${st.cur}`, "dias 70+")}
      ${watchAnTile("🏆 Recorde", `${st.best}`, "dias 70+ seguidos")}
      ${watchAnTile("📊 14 dias", vals.length ? escapeHtml(watchInt(wxAvg(vals))) : "--", "média")}
    </div>
    <div class="wnd-parts">${rows}</div>
    ${lost && lost.lost >= 3 ? `<div class="watch-cloba"><span class="watch-cloba-face">🤡</span><div><b>Onde tá o ponto mais fácil</b><p>${escapeHtml(`${WND_PARTS[lost.p.k].icon} ${WND_PARTS[lost.p.k].name}: tem ${Math.round(lost.lost)} pontos parados aí. ${WND_PARTS[lost.p.k].up}`)}</p></div></div>` : ""}
    <div class="card-title">📈 Os 14 dias</div>
    ${watchAnChart(days, m, WATCH_NOTA_GOOD, 0, { hi: date, daily: true }).replace(/ data-id="\d{4}-\d{2}-\d{2}"/g, "")}
    <p class="watch-muted">Pesos: 😴 sono 30 · 👟 passos 25 · 🔥 ativas 20 · 😤 stress 15 · 🏃 se mexer 10. O que não tem dado sai da conta. 70+ = dia redondo e conta pra sequência e pros troféus 🏅 do Perfil.</p>`;
  openTobaModal("wndModal");
}

tobaActions({ wndOpen });

// ❔ do 🤡 Papo reto ganha a explicação da 🏅 (mesmo modal)
if (typeof WSL_HELP === "object" && WSL_HELP.papo && Array.isArray(WSL_HELP.papo.body)) {
  WSL_HELP.papo.body.unshift(["🏅 Nota do Dia", "O dia inteiro num número de 0 a 100: 😴 sono 30 + 👟 passos 25 + 🔥 calorias ativas 20 (🎯 meta que anda contigo) + 😤 stress 15 + 🏃 se mexer de propósito 10 (treino ou exercício de 15 min+; descanso depois de 2 dias de treino vale 60%). O que não tem dado sai da conta. 70+ = dia redondo: conta pra sequência 🔥 e pros troféus 🏅 do Perfil (só dia fechado). A Prontidão é como o corpo ACORDOU; a Nota é o que tu FEZ com o dia."]);
}
