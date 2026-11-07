/* =====================================================================
 * Toba Health · 🩻 Raio-X · ⚖️ Balança (v1.95)
 * Carregado DEPOIS do relogio.js e do relogio-analise.js.
 * - renderWatchScale(): bloco ⚖️ Balança no Raio-X (#watchScale), com a última
 *   pesagem (peso, gordura, músculo, basal...) e a seta em relação à anterior.
 * - watchScaleBasalPicker(): na análise das 🔥 Calorias, escolhe de onde vem o
 *   basal quando "Somar o basal" tá ligado: ⚖️ da balança ou ⌚ do relógio/Health.
 * Só LÊ healthDb.weighIns: nunca grava nem muda pesagem.
 * ===================================================================== */

const WATCH_SCALE_SRC_KEY = "toba_health_basal_source"; // "scale" | "watch"

// Pra que lado cada número da balança é bom (igual ao METRIC_GOOD_DIRECTION da Pesagem)
const WATCH_SCALE_TILES = [
  { key: "weight", label: "⚖️ Peso", unit: " kg", dec: 2, good: "down", lim: 0.2 },
  { key: "fat", label: "🧈 Gordura", unit: "%", dec: 1, good: "down", lim: 0.3 },
  { key: "muscle", label: "💪 Músculo", unit: " kg", dec: 1, good: "up", lim: 0.2 },
  { key: "bmr", label: "🔥 Basal", unit: " kcal", dec: 0, good: "up", lim: 10 },
  { key: "water", label: "💧 Água", unit: "%", dec: 1, good: "up", lim: 0.3 },
  { key: "visceral", label: "🫀 Visceral", unit: "", dec: 0, good: "down", lim: 1 },
];

function watchScaleNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Pesagens com data válida, da mais velha pra mais nova (cópia: não mexe na ordem do banco)
function watchScaleList() {
  const list = (typeof healthDb === "object" && healthDb && Array.isArray(healthDb.weighIns)) ? healthDb.weighIns : [];
  return list
    .filter((w) => w && typeof w.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(w.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (Number(a.id) || 0) - (Number(b.id) || 0)));
}

// Basal da balança valendo num dia: a última pesagem com basal até aquele dia.
// Dia antes da 1ª pesagem usa a 1ª (é o melhor chute que existe).
function watchScaleBmrAt(iso) {
  const list = watchScaleList().filter((w) => watchScaleNum(w.bmr));
  if (!list.length) return null;
  let pick = list[0];
  for (const w of list) {
    if (w.date.slice(0, 10) <= iso) pick = w;
    else break;
  }
  return { v: watchScaleNum(pick.bmr), date: pick.date.slice(0, 10) };
}

function watchScaleHasBmr() {
  return watchScaleList().some((w) => watchScaleNum(w.bmr));
}

// Padrão: balança (o Rafa confia mais nela) se tiver alguma pesagem com basal
function watchBasalSource() {
  let v = null;
  try { v = localStorage.getItem(WATCH_SCALE_SRC_KEY); } catch (err) { /* sem storage */ }
  if (v === "watch") return "watch";
  return watchScaleHasBmr() ? "scale" : "watch";
}

function watchSetBasalSource(v) {
  try { localStorage.setItem(WATCH_SCALE_SRC_KEY, v === "watch" ? "watch" : "scale"); } catch (err) { /* sem storage: fica só nesta tela */ }
}

// Basal que o Health Connect calculou num dia (total - ativas)
function watchHealthBmrOf(d) {
  if (!d || d.kcal === undefined || d.activeKcal === undefined) return null;
  const b = Number(d.kcal) - Number(d.activeKcal);
  return Number.isFinite(b) && b > 0 ? b : null;
}

// Dia do relógio pra uma data (o objeto não traz a data dentro): mapa objeto -> data
let watchScaleDayIndex = new WeakMap();
function watchScaleDateOf(d) {
  if (!d || typeof d !== "object") return null;
  if (typeof d.date === "string") return d.date.slice(0, 10);
  if (!watchScaleDayIndex.has(d)) {
    watchScaleDayIndex = new WeakMap();
    try {
      const days = typeof watchDays === "function" ? watchDays() : {};
      Object.keys(days).forEach((iso) => {
        if (days[iso] && typeof days[iso] === "object") watchScaleDayIndex.set(days[iso], iso);
      });
    } catch (err) { /* sem dias */ }
  }
  return watchScaleDayIndex.get(d) || null;
}

/* Troca o basal das 🔥 Calorias pelo da balança quando o "Somar o basal" tá
 * ligado e a fonte é ⚖️. Embrulha as funções do relogio.js sem mexer nelas. */
(function watchScaleWrapKcal() {
  if (typeof watchKcalOf !== "function" || typeof watchKcalBasal !== "function") return;
  const origKcalOf = watchKcalOf;
  const origKcalSub = typeof watchKcalSub === "function" ? watchKcalSub : null;

  function scaleTotal(d) {
    if (!d || d.activeKcal === undefined || !watchKcalBasal() || watchBasalSource() !== "scale") return null;
    const iso = watchScaleDateOf(d);
    const b = iso ? watchScaleBmrAt(iso) : null;
    if (!b) return null;
    return { total: Number(d.activeKcal) + b.v, bmr: b };
  }

  window.watchKcalOf = function (d) {
    const s = scaleTotal(d);
    return s ? s.total : origKcalOf(d);
  };
  if (origKcalSub) {
    window.watchKcalSub = function (d) {
      const s = scaleTotal(d);
      if (!s) return origKcalSub(d);
      return `⚡ ${watchInt(d.activeKcal)} + ⚖️ basal ${watchInt(s.bmr.v)}`;
    };
  }
  window.watchScaleTotalOf = scaleTotal;
})();

/* Seletor na análise das calorias (o relogio-analise chama logo abaixo do ➕) */
function watchScaleBasalPicker() {
  if (typeof watchKcalBasal === "function" && !watchKcalBasal()) return "";
  const today = typeof toIsoDate === "function" ? toIsoDate() : new Date().toISOString().slice(0, 10);
  const scale = watchScaleBmrAt(today);
  // basal do Health: o dia mais recente que tiver total e ativas
  let health = null;
  try {
    const days = typeof watchDays === "function" ? watchDays() : {};
    Object.keys(days).sort().reverse().some((iso) => {
      const b = watchHealthBmrOf(days[iso]);
      if (b) health = { v: b, date: iso };
      return !!b;
    });
  } catch (err) { /* sem dias */ }
  const src = watchBasalSource();
  const short = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const chip = (val, on, label) =>
    `<button type="button" class="chip-btn${on ? " is-on" : ""}" data-click="watchPickBasalSource" data-src="${val}" aria-pressed="${on}">${label}</button>`;
  let diff = "";
  if (scale && health) {
    const d = Math.round(health.v - scale.v);
    if (Math.abs(d) >= 20) diff = ` O do relógio dá ${watchInt(Math.abs(d))} kcal ${d > 0 ? "a mais" : "a menos"} por dia.`;
  }
  return `<div class="watch-an-basal watch-scale-basal" style="flex-wrap:wrap;gap:8px">
      <span class="watch-muted" style="flex-basis:100%">🔥 Basal de onde?</span>
      ${chip("scale", src === "scale", `⚖️ Balança${scale ? ` · ${watchInt(scale.v)}` : ""}`)}
      ${chip("watch", src === "watch", `⌚ Relógio${health ? ` · ${watchInt(health.v)}` : ""}`)}
      <span class="watch-muted" style="flex-basis:100%">${scale
        ? `${src === "scale" ? "Cada dia usa o basal da pesagem mais recente até ele" : "Usando a conta do Health Connect (genérica, por peso e idade)"}. Última da balança: ${short(scale.date)}.${diff}`
        : "Nenhuma pesagem com basal ainda: anota o 🔥 Basal na ⚖️ Pesagem que ele aparece aqui."}</span>
    </div>`;
}

/* Bloco ⚖️ Balança do Raio-X (#watchScale) */
function renderWatchScale() {
  const el = document.getElementById("watchScale");
  if (!el) return;
  const list = watchScaleList();
  if (!list.length) {
    el.hidden = false;
    el.innerHTML = `<div class="section-title">⚖️ Balança</div>
      <a class="card watch-scale-empty" href="TobaHealth-Pesagem.html" style="display:block;color:inherit;text-decoration:none">Nenhuma pesagem ainda. Sobe na balança e anota na ⚖️ Pesagem ›</a>`;
    return;
  }
  const today = typeof toIsoDate === "function" ? toIsoDate() : new Date().toISOString().slice(0, 10);
  const last = list[list.length - 1];
  const lastIso = last.date.slice(0, 10);
  const ago = Math.round((Date.parse(today) - Date.parse(lastIso)) / 86400000);
  const when = ago <= 0 ? "hoje" : ago === 1 ? "ontem" : `há ${ago} dias`;

  const tiles = WATCH_SCALE_TILES.map((t) => {
    // último valor que existir desse número (ex.: pesou sem bioimpedância)
    let i = list.length - 1;
    while (i >= 0 && watchScaleNum(list[i][t.key]) === null) i--;
    if (i < 0) return "";
    const v = watchScaleNum(list[i][t.key]);
    let j = i - 1;
    while (j >= 0 && watchScaleNum(list[j][t.key]) === null) j--;
    let arrow = "";
    let sub = list[i].date.slice(0, 10) === lastIso ? "última pesagem" : `em ${list[i].date.slice(8, 10)}/${list[i].date.slice(5, 7)}`;
    if (j >= 0) {
      const delta = v - watchScaleNum(list[j][t.key]);
      if (Math.abs(delta) >= t.lim) {
        const good = t.good === "up" ? delta > 0 : delta < 0;
        arrow = `<span class="watch-body-arrow ${good ? "text-green" : "text-coral"}">${delta > 0 ? "▲" : "▼"}</span>`;
        sub = `${delta > 0 ? "+" : "−"}${watchScaleFmt(Math.abs(delta), t)} vs anterior`;
      } else {
        sub = "igual à anterior";
      }
    }
    return `<a class="watch-body-tile watch-tap" href="TobaHealth-Pesagem.html" style="color:inherit;text-decoration:none">
        <span class="watch-body-label">${t.label}</span>
        <span class="watch-body-value">${watchScaleFmt(v, t)}${arrow}</span>
        <span class="watch-body-sub">${escapeHtml(sub)}</span>
      </a>`;
  }).filter(Boolean);

  // Papo reto: basal da balança x do relógio, e lembrete de pesar
  const notes = [];
  if (ago >= 14) notes.push(`🤡 Última pesagem ${when}. A balança tá pegando poeira, sobe nela!`);
  const scaleBmr = watchScaleBmrAt(today);
  let health = null;
  try {
    const days = typeof watchDays === "function" ? watchDays() : {};
    const vals = Object.keys(days).sort().slice(-7).map((iso) => watchHealthBmrOf(days[iso])).filter(Boolean);
    if (vals.length) health = vals.reduce((a, b) => a + b, 0) / vals.length;
  } catch (err) { /* sem dias */ }
  if (scaleBmr && health) {
    const d = Math.round(health - scaleBmr.v);
    notes.push(Math.abs(d) < 20
      ? `🔥 Basal da balança e do relógio batem (${watchInt(scaleBmr.v)} kcal). Raro, hein 😎`
      : `🔥 O relógio acha que teu basal é ${watchInt(health)} kcal, a balança diz ${watchInt(scaleBmr.v)} (${d > 0 ? "+" : "−"}${watchInt(Math.abs(d))}). Escolhe quem manda na análise das 🔥 Calorias.`);
  }

  el.hidden = false;
  el.innerHTML = `<div class="section-title">⚖️ Balança <span class="watch-muted">· ${escapeHtml(when)}</span></div>
    <div class="watch-body-grid">${tiles.join("")}</div>
    ${notes.length ? `<p class="watch-muted watch-scale-note">${notes.map(escapeHtml).join("<br>")}</p>` : ""}`;
}

function watchScaleFmt(v, t) {
  const s = t.dec === 0
    ? (typeof watchInt === "function" ? watchInt(v) : String(Math.round(v)))
    : v.toFixed(t.dec).replace(".", ",");
  return `${s}${t.unit}`;
}

tobaActions({
  watchPickBasalSource(el) {
    watchSetBasalSource(el.dataset.src);
    renderWatch(); // refaz o Raio-X e a análise aberta
  },
});
