/* =====================================================================
 * Toba · Hall dos Heróis no Perfil do jogador (desde v1.47)
 * Antes morava no Treinos (Toba Health); o Hall de cada mês continua lá.
 * - Só LÊ o TOBA_HEALTH_DB (readPlayerSource, do toba-player.js). Nada gravado.
 * - Contas: hall-shared.js (totais, mapa de calor, escadas de marcos) e
 *   health-metrics.js (escalas de peso e distância = conquistas do perfil).
 * - "NOVO!": marco cuja conquista foi desbloqueada nos últimos 7 dias (data
 *   calculada pelo computePlayer, nada gravado).
 * Carregue depois de toba-player.js e hall-shared.js, antes de perfil.js.
 * ===================================================================== */
let hallData = null; // { health, workouts, stats, heat, today }
let hallPage = ""; // página aberta ("" = Perfil)
const HALL_NEW_DAYS = 7;

function readHallData(today) {
  const health = readPlayerSource("TOBA_HEALTH_DB").data;
  const workouts = (Array.isArray(health.workouts) ? health.workouts : [])
    .filter((w) => w && /^\d{4}-\d{2}-\d{2}$/.test(String(w.date || "")) && w.date <= today);
  return {
    health,
    workouts,
    stats: calcHallLifetimeStats(workouts, health),
    heat: calcMuscleHeat(workouts, health),
    today,
  };
}

function hallReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Conquista desbloqueada há poucos dias (marco "NOVO!")
function isHallNew(state, achievementId) {
  const a = state?.achievements.find((item) => item.id === achievementId);
  if (!a || !a.unlocked) return false;
  return playerDaysBetween(a.date, state.today) < HALL_NEW_DAYS;
}

/* ---------------------------------------------------------------------
 * Peças
 * ------------------------------------------------------------------- */
// Número que conta do zero ao abrir (data-count + data-fmt)
function hallCount(value, fmt, text) {
  return `<span class="pfh-count" data-count="${Number(value) || 0}" data-fmt="${fmt}">${text}</span>`;
}

function hallFormat(value, fmt) {
  if (fmt === "kg") return formatHallKg(value);
  if (fmt === "km") return `${formatWorkoutNumber(value, value < 100 ? 1 : 0)} km`;
  if (fmt === "kcal") return `${formatWorkoutNumber(value, 0)} kcal`;
  if (fmt === "pct") return `${formatWorkoutNumber(value, value < 1 ? 2 : 1)}%`;
  return formatWorkoutNumber(value, 0);
}

function hallBar(ratio, extra = "") {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 10;
  return `<span class="pfh-bar${extra}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="--w:${pct}%"></i></span>`;
}

// "8,7 elefantes" / "1 gato"
function hallTimes(total, item) {
  const times = total / item.size;
  const shown = times >= 10 ? Math.floor(times) : Math.floor(times * 10) / 10;
  return `${formatWorkoutNumber(shown, 1)} ${shown === 1 ? item.one : item.name}`;
}

// Comida do card de energia: a mais "pesada" que já dá pelo menos 2 porções
function hallFoodPick(kcal) {
  const fits = WORKOUT_FOOD_EQUIVALENTS.filter((food) => kcal / food.kcal >= 2);
  return fits[fits.length - 1] || WORKOUT_FOOD_EQUIVALENTS[0];
}

const HALL_SAITAMA_GOAL = 100 * 365 * 3; // 100 de cada por dia durante 3 anos

/* ---------------------------------------------------------------------
 * Vitrine + grade (dentro do Perfil)
 * ------------------------------------------------------------------- */
function renderProfileHall(state) {
  const box = document.getElementById("pfHall");
  if (!box || !state) return;
  hallData = readHallData(state.today);
  const { stats, heat } = hallData;

  const lift = calcHallLadder(stats.liftKg, WORKOUT_LIFT_EQUIVALENTS);
  const liftNew = lift.current && isHallNew(state, lift.current.id);
  const equal = lift.current
    ? `= ${hallTimes(stats.liftKg, lift.current)} ${lift.current.icon}`
    : "Nem um gato ainda 🐈. O primeiro sai rapidinho.";
  const liftNext = lift.next
    ? `Faltam <b>${formatHallKg(lift.remaining)}</b> pro ${lift.next.one} ${lift.next.icon}`
    : "Acabou a escala. Você virou a escala 👑";

  const km = calcHallLadder(stats.distance, WORKOUT_DISTANCE_DESTINATIONS);
  const food = hallFoodPick(stats.calories);
  const foodCount = stats.calories / food.kcal;
  const saitamaPct = ((stats.pushups + stats.situps + stats.squats) / (HALL_SAITAMA_GOAL * 3)) * 100;
  const shape = Object.keys(heat).length ? getBodyShape(heat) : null;

  box.innerHTML = `
    <div class="pfh-anim">
      <button type="button" class="pfh-vitrine${liftNew ? " is-new" : ""}" data-click="openHallPage" data-page="lifted" style="--i:0">
        ${liftNew ? '<span class="pfh-new">NOVO!</span>' : ""}
        <span class="pfh-kicker">🏋️ Peso levantado na vida</span>
        <span class="pfh-big">${hallCount(stats.liftKg, "kg", formatHallKg(stats.liftKg))}</span>
        <span class="pfh-equal">${equal}</span>
        <span class="pfh-track">
          <span class="pfh-track-icon">${lift.current ? lift.current.icon : "🪶"}</span>
          ${hallBar(lift.ratio, " is-gold")}
          <span class="pfh-track-icon is-next">${lift.next ? lift.next.icon : "👑"}</span>
        </span>
        <span class="pfh-sub">${liftNext}</span>
        <span class="pfh-cta">Ver a escada toda ›</span>
      </button>

      <div class="pfh-grid">
        <button type="button" class="pfh-tile is-km" data-click="openHallPage" data-page="distance" style="--i:1">
          <span class="pfh-tile-icon">🌍</span>
          <span class="pfh-tile-label">Distância</span>
          <span class="pfh-tile-value">${hallCount(stats.distance, "km", hallFormat(stats.distance, "km"))}</span>
          ${hallBar(km.ratio)}
          <span class="pfh-tile-sub">${km.next ? `${km.next.icon} faltam ${formatWorkoutNumber(km.remaining, 0)} km` : "🌍 Deu a volta ao mundo"}</span>
        </button>
        <button type="button" class="pfh-tile is-kcal" data-click="openHallPage" data-page="energy" style="--i:2">
          <span class="pfh-tile-icon">🔥</span>
          <span class="pfh-tile-label">Energia</span>
          <span class="pfh-tile-value">${hallCount(stats.calories, "kcal", hallFormat(stats.calories, "kcal"))}</span>
          <span class="pfh-tile-sub">= ${formatWorkoutNumber(foodCount, foodCount < 10 ? 1 : 0)} ${foodCount === 1 ? food.one : food.name} ${food.icon}</span>
        </button>
        <button type="button" class="pfh-tile is-saitama" data-click="openHallPage" data-page="saitama" style="--i:3">
          <span class="pfh-tile-icon">👊</span>
          <span class="pfh-tile-label">Saitama</span>
          <span class="pfh-tile-value">${hallCount(saitamaPct, "pct", hallFormat(saitamaPct, "pct"))}</span>
          ${hallBar(saitamaPct / 100, " is-coral")}
          <span class="pfh-tile-sub">do treino de 3 anos do careca</span>
        </button>
        <button type="button" class="pfh-tile is-heat" data-click="openHallPage" data-page="muscles" style="--i:4">
          <span class="pfh-tile-label">🔥 Mapa de calor</span>
          ${renderMuscleMap(heat)}
          <span class="pfh-tile-sub">${shape ? `${shape.icon} ${shape.name}` : "Boneco dormindo 😴"}</span>
        </button>
      </div>
    </div>`;
  animateHall(box);
}

/* ---------------------------------------------------------------------
 * Páginas (abrem no lugar do Perfil, com ‹ voltando)
 * ------------------------------------------------------------------- */
const HALL_PAGES = {
  lifted: { title: "🏋️ Peso levantado", render: renderHallLiftPage },
  distance: { title: "🌍 Distância", render: renderHallDistancePage },
  energy: { title: "🔥 Energia queimada", render: renderHallEnergyPage },
  saitama: { title: "👊 Você contra o careca", render: renderHallSaitamaPage },
  muscles: { title: "🔥 Mapa de calor da vida", render: renderHallMusclePage },
};

function openHallPage(page, { push = true } = {}) {
  const def = HALL_PAGES[page];
  if (!def || !tobaPlayerState) return;
  if (!hallData) hallData = readHallData(tobaPlayerState.today);
  hallPage = page;
  const view = document.getElementById("pfHallView");
  view.innerHTML = `<div class="pfh-anim pfh-page">${def.render(hallData, tobaPlayerState)}</div>`;
  document.getElementById("pfMainView").hidden = true;
  view.hidden = false;
  tobaSetHeader({ page: def.title, back: "closeHallPage" });
  if (push) history.pushState({ hall: page }, "");
  window.scrollTo(0, 0);
  animateHall(view);
}

function closeHallPage({ fromHistory = false } = {}) {
  if (!hallPage) return;
  if (!fromHistory && history.state?.hall) {
    history.back(); // o popstate chama de novo com fromHistory
    return;
  }
  hallPage = "";
  document.getElementById("pfHallView").hidden = true;
  document.getElementById("pfHallView").innerHTML = "";
  document.getElementById("pfMainView").hidden = false;
  tobaSetHeader({ page: "🎮 Perfil do jogador", back: "" });
  document.getElementById("pfHallTitle")?.scrollIntoView({ block: "start" });
}

// Recarregou com uma página do Hall no histórico: começa no Perfil
if (history.state?.hall) history.replaceState(null, "");

window.addEventListener("popstate", (event) => {
  if (event.state?.hall) openHallPage(event.state.hall, { push: false });
  else closeHallPage({ fromHistory: true });
});

// Cabeçalho da página: número grande + frase
function hallHero(icon, value, fmt, sub, tagline) {
  return `
    <section class="pfh-hero" style="--i:0">
      <span class="pfh-hero-icon">${icon}</span>
      <span class="pfh-big">${hallCount(value, fmt, hallFormat(value, fmt))}</span>
      ${sub ? `<span class="pfh-hero-sub">${sub}</span>` : ""}
      <p class="pfh-tagline">${tagline}</p>
    </section>`;
}

// Próximo marco em destaque
function hallSpotlight(ladder, label, remainingText) {
  if (!ladder.next) {
    return `<section class="pfh-spot is-done" style="--i:1"><span class="pfh-spot-icon">👑</span><span class="pfh-spot-body"><strong>Acabou a escala</strong><span>Não tem marco maior. Você virou o marco.</span></span></section>`;
  }
  return `
    <section class="pfh-spot" style="--i:1">
      <span class="pfh-spot-icon">${ladder.next.icon}</span>
      <span class="pfh-spot-body">
        <span class="pfh-spot-kicker">🎯 Próximo marco</span>
        <strong>${label(ladder.next)}</strong>
        ${hallBar(ladder.ratio, " is-gold")}
        <span>${remainingText} · ${formatWorkoutNumber(ladder.ratio * 100, 1)}% do caminho</span>
      </span>
    </section>`;
}

// Trilha de marcos: do maior (em cima) ao menor; acesos, o próximo pulsando, o resto apagado.
// Os bloqueados bem lá em cima (depois dos 3 próximos) ficam recolhidos.
const HALL_TRAIL_AHEAD = 3;

function hallTrail(total, items, { label, doneText, sizeText, state }) {
  const ladder = calcHallLadder(total, items);
  const row = (item) => {
    const done = total >= item.size;
    const isNext = ladder.next && ladder.next.id === item.id;
    const isNew = done && isHallNew(state, item.id);
    const cls = done ? " is-done" : isNext ? " is-next" : " is-locked";
    return `
      <li class="pfh-step${cls}${isNew ? " is-new" : ""}">
        <span class="pfh-step-dot">${item.icon}</span>
        <span class="pfh-step-body">
          <strong>${label(item)}</strong>
          <span>${done ? doneText(item, Math.floor(total / item.size)) : sizeText(item)}</span>
        </span>
        ${isNew ? '<span class="pfh-new">NOVO!</span>' : ""}
        ${done ? `<span class="pfh-step-times">${Math.floor(total / item.size) > 999 ? "999+" : Math.floor(total / item.size)}×</span>` : ""}
        ${isNext ? '<span class="pfh-step-here">você tá aqui ↓</span>' : ""}
      </li>`;
  };
  const ahead = items.filter((item) => total < item.size);
  const far = ahead.slice(HALL_TRAIL_AHEAD).reverse();
  const near = [...ahead.slice(0, HALL_TRAIL_AHEAD), ...ladder.done].sort((a, b) => b.size - a.size);
  const farHtml = far.length
    ? `<details class="pfh-far"><summary>🔒 Mais ${far.length} ${far.length === 1 ? "marco" : "marcos"} lá em cima</summary><ol class="pfh-trail">${far.map(row).join("")}</ol></details>`
    : "";
  return `
    <div class="pfh-section-title" style="--i:2">🪜 A escada toda <span>${ladder.done.length}/${items.length}</span></div>
    <div style="--i:3">${farHtml}<ol class="pfh-trail">${near.map(row).join("")}</ol></div>`;
}

function renderHallLiftPage(data, state) {
  const kg = data.stats.liftKg;
  const ladder = calcHallLadder(kg, WORKOUT_LIFT_EQUIVALENTS);
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const crowds = state.achievements.filter((a) => a.cat === "multidao");
  const crowdHtml = crowds.map((a) => {
    const hidden = isPlayerAchievementHidden(a, state);
    return `
      <button type="button" class="pfh-crowd${a.unlocked ? " is-done" : ""}" data-click="openAchievement" data-id="${a.id}">
        <span class="pfh-crowd-icon">${hidden ? "❓" : a.icon}</span>
        <span class="pfh-crowd-body">
          <strong>${hidden ? "???" : escapeHtml(a.name)}</strong>
          <span>${a.unlocked ? "✅ Conquistada" : escapeHtml(a.hint)}</span>
          ${a.unlocked ? "" : hallBar(a.progress, " is-mini")}
        </span>
      </button>`;
  }).join("");
  return `
    ${hallHero("🏋️", kg, "kg", `em ${formatWorkoutNumber(data.stats.liftReps, 0)} repetições`, pickTagline(kg, HALL_TAGLINES.lifted))}
    ${hallSpotlight(ladder, (item) => cap(item.one), `Faltam ${formatHallKg(ladder.remaining)}`)}
    ${hallTrail(kg, WORKOUT_LIFT_EQUIVALENTS, {
      state,
      label: (item) => cap(item.one),
      doneText: (item, times) => `Já levantou ${formatWorkoutNumber(times, 0)} ${times === 1 ? item.one : item.name}. ${item.note}`,
      sizeText: (item) => `~${formatHallKg(item.size)}`,
    })}
    <div class="pfh-section-title" style="--i:4">🐘 Manadas &amp; multidões <span>${crowds.filter((a) => a.unlocked).length}/${crowds.length}</span></div>
    <div class="pfh-crowds" style="--i:5">${crowdHtml}</div>
    <p class="pfh-footer">Conta de guardanapo com o peso real de cada coisa (aproximado). Sem academia também conta: cada flexão levanta ~64% do seu peso, cada agachamento ~70% e cada abdominal ~30% (pela sua última pesagem até o dia do treino).</p>`;
}

function renderHallDistancePage(data, state) {
  const { stats } = data;
  const ladder = calcHallLadder(stats.distance, WORKOUT_DISTANCE_DESTINATIONS);
  const earth = (stats.distance / 40075) * 100;
  const modes = [["🚶", "A pé", stats.walkDistance], ["🚴", "De bike", stats.bikeDistance], ["🏃", "Elíptico", stats.ellipticalDistance]];
  return `
    ${hallHero("🌍", stats.distance, "km", `${formatWorkoutNumber(earth, earth < 1 ? 2 : 1)}% de uma volta na Terra`, pickTagline(stats.distance, HALL_TAGLINES.distance))}
    <div class="pfh-modes" style="--i:1">${modes.map(([icon, label, value]) => `
      <span class="pfh-mode"><span>${icon} ${label}</span><strong>${formatWorkoutNumber(value, 1)} km</strong></span>`).join("")}
    </div>
    ${hallSpotlight(ladder, (item) => item.label, `Faltam ${formatWorkoutNumber(ladder.remaining, 0)} km`)}
    ${hallTrail(stats.distance, WORKOUT_DISTANCE_DESTINATIONS, {
      state,
      label: (item) => item.label,
      doneText: (item, times) => `Você já ${item.done} ${times}×. ${item.note}`,
      sizeText: (item) => `~${formatWorkoutNumber(item.size, 0)} km`,
    })}
    <p class="pfh-footer">Distâncias aproximadas em linha reta a partir de São Paulo. O importante é a barra crescer, não comprar passagem hoje.</p>`;
}

function renderHallEnergyPage(data) {
  const kcal = data.stats.calories;
  const cards = WORKOUT_FOOD_EQUIVALENTS.map((food, i) => {
    const count = kcal / food.kcal;
    return `
      <div class="pfh-food" style="--i:${2 + Math.min(i, 8)}">
        <span class="pfh-food-icon">${food.icon}</span>
        <strong>${hallCount(count, "int", formatWorkoutNumber(count, 0))}</strong>
        <span>${Math.round(count) === 1 ? food.one : food.name}</span>
      </div>`;
  }).join("");
  return `
    ${hallHero("🔥", kcal, "kcal", "queimadas na vida", pickTagline(kcal, HALL_TAGLINES.energy))}
    <div class="pfh-section-title" style="--i:1">🍽️ Isso dá, mais ou menos...</div>
    <div class="pfh-foods">${cards}</div>
    <p class="pfh-footer">Conta de guardanapo, chefia: não vira passe livre no rodízio, mas já dá pra comemorar sem inventar número.</p>`;
}

function renderHallSaitamaPage(data) {
  const { stats } = data;
  const totalReps = stats.pushups + stats.situps + stats.squats;
  const pct = (totalReps / (HALL_SAITAMA_GOAL * 3)) * 100;
  const kmGoal = 10 * 365 * 3;
  const row = (icon, label, value, goal, unit, digits, i) => `
    <div class="pfh-vs" style="--i:${i}">
      <span class="pfh-vs-icon">${icon}</span>
      <span class="pfh-vs-body">
        <span class="pfh-vs-head"><strong>${label}</strong><span>${formatWorkoutNumber((value / goal) * 100, 2)}%</span></span>
        ${hallBar(value / goal, " is-coral")}
        <span class="pfh-vs-sub">${formatWorkoutNumber(value, digits)} de ${formatWorkoutNumber(goal, 0)} ${unit}</span>
      </span>
    </div>`;
  return `
    ${hallHero("👊", pct, "pct", `${formatWorkoutNumber(totalReps, 0)} reps no total`, pickTagline(pct, HALL_TAGLINES.saitama))}
    <p class="pfh-intro" style="--i:1">O careca fez <b>100 flexões, 100 abdominais, 100 agachamentos e 10 km por dia durante 3 anos</b>. Bora ver quanto falta:</p>
    ${row("💪", "Flexões", stats.pushups, HALL_SAITAMA_GOAL, "reps", 0, 2)}
    ${row("🧎", "Abdominais", stats.situps, HALL_SAITAMA_GOAL, "reps", 0, 3)}
    ${row("🦵", "Agachamentos", stats.squats, HALL_SAITAMA_GOAL, "reps", 0, 4)}
    ${row("🏃", "Distância", stats.distance, kmGoal, "km", 1, 5)}
    <p class="pfh-footer">Não precisa virar o careca até sexta. Ele levou 3 anos; você já está na parte mais difícil: começar e voltar.</p>`;
}

function renderHallMusclePage(data) {
  const { heat } = data;
  if (!Object.keys(heat).length) {
    return tobaEmpty("🛋️", "Nenhum músculo acordado ainda", "Registra um treino no Toba Health que o boneco começa a pegar fogo.", { compact: true });
  }
  const shape = getBodyShape(heat);
  const { lazy } = describeMuscleHeat(heat);
  return `
    <section class="pfh-hero" style="--i:0">
      <span class="pfh-hero-icon">${shape.icon}</span>
      <span class="pfh-big is-text">${shape.name}</span>
      <p class="pfh-tagline">${shape.note}</p>
      <span class="pfh-split" aria-label="Tronco ${shape.upperPct}%, perna ${shape.lowerPct}%">
        <i style="--w:${shape.upperPct}%"></i>
      </span>
      <span class="pfh-split-legend"><span>💪 Tronco ${shape.upperPct}%</span><span>🦵 Perna ${shape.lowerPct}%</span></span>
    </section>
    <section class="pfh-heat" style="--i:1">
      ${renderMuscleMap(heat, { interactive: true, scope: "life" })}
      <div class="muscle-legend" aria-hidden="true"><span>pouco</span><i class="lv-1"></i><i class="lv-2"></i><i class="lv-3"></i><i class="lv-4"></i><i class="lv-5"></i><span>pegando fogo</span></div>
      <p class="pfh-footer">Toque num músculo pra ver os números. A conta completa tá no <b>?</b> do mapa lá no Treinos.</p>
    </section>
    <div class="pfh-section-title" style="--i:2">🏅 Ranking da vida toda</div>
    <section class="pfh-rank" style="--i:3">${renderMuscleRank(heat)}</section>
    ${lazy ? `<p class="pfh-lazy" style="--i:4">${lazy}</p>` : ""}`;
}

/* ---------------------------------------------------------------------
 * Animações: números contando, barras enchendo, entrada em cascata.
 * Com "reduzir movimento" do sistema, tudo aparece pronto.
 * ------------------------------------------------------------------- */
function animateHall(root) {
  const reduced = hallReducedMotion();
  root.classList.toggle("pfh-still", reduced);
  if (reduced) {
    root.querySelectorAll(".pfh-bar, .pfh-split").forEach((bar) => bar.classList.add("is-in"));
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll(".pfh-bar, .pfh-split").forEach((bar) => bar.classList.add("is-in"));
  }));
  root.querySelectorAll(".pfh-count").forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    const fmt = el.dataset.fmt;
    if (!target) return;
    const start = performance.now();
    const duration = 900;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = hallFormat(target * eased, fmt);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = hallFormat(target, fmt);
    };
    requestAnimationFrame(step);
  });
}

tobaActions({
  openHallPage: (el) => openHallPage(el.dataset.page),
  closeHallPage: () => closeHallPage(),
  showMuscleHeat: (el) => tobaToast(describeMuscleTap(hallData?.heat || {}, el.dataset.group)),
});
