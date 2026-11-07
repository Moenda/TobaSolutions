/* =====================================================================
 * Toba Health · Hall do mês: telas de detalhe (energia, distância,
 * peso levantado, Saitama). São PÁGINAS (view "viewDetail"), não pop-ups.
 * O Hall dos Heróis da vida toda mora no Perfil (assets/perfil-hall.js).
 *
 * Padrão das telas de equivalência:
 *   resumo (número grande + frase) → 🏅 Conquistado (cards compactos)
 *   → 🎯 Próximos desafios (3 barras; o resto fica recolhido)
 * Distância e Saitama do mês (desde v1.95) comparam com o MÊS ANTERIOR
 * (cidades e a meta de 3 anos do careca não cabem num mês só); as metas da
 * vida toda seguem no Hall dos Heróis do Perfil (assets/perfil-hall.js).
 *
 * Carregado ANTES de treinos.js; usa funções dele só dentro de funções.
 * ===================================================================== */

// WORKOUT_DISTANCE_DESTINATIONS e WORKOUT_LIFT_EQUIVALENTS moram em health-metrics.js
// (as conquistas do perfil do jogador usam as mesmas escalas). Comidas, mapa de
// calor (boneco, cálculo) e formato do corpo moram em hall-shared.js (desde v1.47,
// o Hall dos Heróis da vida toda mora no Perfil do jogador).


function eqCard(icon, title, note) {
  return `
    <div class="eq-card">
      <span class="eq-icon" aria-hidden="true">${icon}</span>
      <div class="eq-body">
        <strong>${title}</strong>
        ${note ? `<span class="eq-note">${note}</span>` : ""}
      </div>
    </div>`;
}

function eqChallenge({ icon, label, ratio, remaining }) {
  const percentage = Math.max(0, ratio * 100);
  const width = Math.min(100, percentage);
  return `
    <div class="eq-card eq-challenge">
      <span class="eq-icon" aria-hidden="true">${icon}</span>
      <div class="eq-body">
        <div class="eq-challenge-head">
          <strong>${label}</strong>
          <span class="eq-percent">${formatWorkoutNumber(percentage, 1)}%</span>
        </div>
        <div class="eq-bar" role="progressbar" aria-label="${label}: ${formatWorkoutNumber(percentage, 1)}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}">
          <div class="eq-bar-fill" style="width: ${width}%"></div>
        </div>
        <span class="eq-note">Faltam ${remaining}</span>
      </div>
    </div>`;
}

// items: [{ icon, size, ... }] em ordem crescente de tamanho.
// cfg.doneTitle(item, vezes) e cfg.remaining(item, total) devolvem textos.
function renderProgressSections(total, items, cfg) {
  const done = [];
  const todo = [];
  items.forEach((item) => {
    const ratio = total / item.size;
    (ratio >= 1 ? done : todo).push({ ...item, ratio });
  });

  const challenge = (item) =>
    eqChallenge({
      icon: item.icon,
      label: cfg.challengeLabel(item),
      ratio: item.ratio,
      remaining: cfg.remaining(item, total),
    });

  const doneHtml = done.length
    ? `<div class="eq-section-title">🏅 Conquistado</div>
       <div class="eq-list">${done.map((item) => eqCard(item.icon, cfg.doneTitle(item, Math.floor(item.ratio)), item.note)).join("")}</div>`
    : `<div class="eq-empty">${cfg.emptyText}</div>`;

  const visible = todo.slice(0, 3);
  const rest = todo.slice(3);
  const todoHtml = todo.length
    ? `<div class="eq-section-title">🎯 Próximos desafios</div>
       <div class="eq-list">${visible.map(challenge).join("")}</div>
       ${rest.length ? `<details class="eq-more"><summary>Ver os outros ${rest.length} desafios</summary><div class="eq-list">${rest.map(challenge).join("")}</div></details>` : ""}`
    : `<div class="eq-section-title">👑 Todos os desafios concluídos</div>
       <div class="eq-empty">${cfg.allDoneText}</div>`;

  return doneHtml + todoHtml;
}

function eqSummary(big, sub, tagline) {
  return `
    <div class="eq-summary">
      <div class="eq-summary-big">${big}</div>
      ${sub ? `<div class="eq-summary-sub">${sub}</div>` : ""}
      <p class="eq-tagline">${tagline}</p>
    </div>`;
}

/* --------------------------- páginas --------------------------- */
function renderEnergyPage(stats) {
  const kcal = stats.calories;
  const tagline = pickTagline(kcal, HALL_TAGLINES.energy);
  const cards = WORKOUT_FOOD_EQUIVALENTS.map((food) => {
    const count = kcal / food.kcal;
    const label = count === 1 ? food.one : food.name;
    return eqCard(food.icon, `${formatWorkoutNumber(count, 1)} ${label}`, food.note);
  }).join("");
  return `
    ${eqSummary(`${formatWorkoutNumber(kcal, 0)} kcal`, "queimadas", tagline)}
    <div class="eq-section-title">🍽️ Isso dá, mais ou menos...</div>
    <div class="eq-list">${cards}</div>
    <p class="eq-footer">Conta de guardanapo, chefia: não vira passe livre no rodízio, mas já dá pra comemorar sem inventar número.</p>`;
}

/* ------------- comparação com o mês anterior (desde v1.95) ------------- */
function getPrevMonthKey(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthName(monthKey) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "mês passado"
    : date.toLocaleDateString("pt-BR", { month: "long" });
}

// Totais do mês anterior (inteiro) e, se o mês escolhido é o atual, do mês
// anterior só até o mesmo dia (comparar mês pela metade com mês fechado engana).
function getMonthCompare(monthKey, today = new Date()) {
  const prevKey = getPrevMonthKey(monthKey);
  const prevWorkouts = getWorkoutMonthStats(healthDb.workouts || [], prevKey, today).workouts;
  const isCurrent = monthKey === getWorkoutMonthKey(toIsoDate(today));
  const day = today.getDate();
  const samePoint = isCurrent
    ? prevWorkouts.filter((workout) => Number(String(workout.date).slice(8, 10)) <= day)
    : null;
  return {
    prevKey,
    prevName: formatMonthName(prevKey),
    isCurrent,
    day,
    prev: getWorkoutLifetimeStats(prevWorkouts),
    prevSamePoint: samePoint ? getWorkoutLifetimeStats(samePoint) : null,
  };
}

function compareRatio(current, previous) {
  if (previous > 0) return current / previous;
  return current > 0 ? 1 : 0;
}

function compareBadge(current, previous) {
  if (previous > 0) return `${formatWorkoutNumber((current / previous) * 100, 0)}%`;
  return current > 0 ? "estreia" : "—";
}

function pickCompareTagline(current, previous, cmp) {
  const name = cmp.prevName;
  if (previous <= 0) {
    return current > 0
      ? `Em ${name} foi zero, então tudo aqui é recorde. Estreia de respeito.`
      : `Zero aqui e zero em ${name}. O sofá tá invicto.`;
  }
  const ratio = current / previous;
  if (ratio >= 1.5) return `Atropelou ${name}. O você do mês passado tá pedindo revanche.`;
  if (ratio >= 1) return `Bateu ${name}. Evolução é isso aí.`;
  if (ratio >= 0.75) return `Encostando em ${name}. Mais um gás e passa.`;
  return cmp.isCurrent
    ? `Ainda atrás de ${name}, mas o mês tá rolando. Dá tempo de virar.`
    : `Mês mais leve que ${name}. Acontece, o próximo cobra.`;
}

function eqCompareRow(icon, label, current, previous, { unit, digits, prevName }) {
  const ratio = compareRatio(current, previous);
  const width = Math.min(100, ratio * 100);
  const beat = previous > 0 && current >= previous;
  const badge = compareBadge(current, previous);
  const fmt = (value) => formatWorkoutNumber(value, digits);
  let note;
  if (previous <= 0) {
    note = current > 0 ? `${fmt(current)} ${unit} · em ${prevName} foi zero` : `Zero aqui e em ${prevName}`;
  } else if (beat) {
    note = `${fmt(current)} ${unit} · ${prevName}: ${fmt(previous)} ${current > previous ? `(+${fmt(current - previous)})` : "(empate)"}`;
  } else {
    note = `${fmt(current)} de ${fmt(previous)} ${unit} · faltam ${fmt(previous - current)} pra bater ${prevName}`;
  }
  return `
    <div class="eq-card eq-challenge${beat ? " eq-beat" : ""}">
      <span class="eq-icon" aria-hidden="true">${icon}</span>
      <div class="eq-body">
        <div class="eq-challenge-head">
          <strong>${label}</strong>
          <span class="eq-percent">${beat ? "🏆 " : ""}${badge}</span>
        </div>
        <div class="eq-bar" role="progressbar" aria-label="${label}: ${badge} de ${prevName}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}">
          <div class="eq-bar-fill" style="width: ${width}%"></div>
        </div>
        <span class="eq-note">${note}</span>
      </div>
    </div>`;
}

// Só no mês atual: "no mesmo ponto do mês passado você tinha X".
function eqSamePointNote(current, then, cmp, unit, digits) {
  if (!cmp.isCurrent || then == null) return "";
  const fmt = (value) => formatWorkoutNumber(value, digits);
  const verdict = current > then
    ? `Tá <strong>${fmt(current - then)} ${unit} na frente</strong> 🔥`
    : current < then
      ? `Tá ${fmt(then - current)} ${unit} atrás, bora correr atrás.`
      : "Empatado, cabeça a cabeça.";
  return `<p class="eq-intro">📆 No mesmo ponto de ${cmp.prevName} (até o dia ${cmp.day}) você tinha ${fmt(then)} ${unit}. ${verdict}</p>`;
}

function renderDistancePage(stats, scopeWorkouts, cmp) {
  const km = stats.distance;
  const prev = cmp.prev;
  const opts = { unit: "km", digits: 2, prevName: cmp.prevName };
  const modes = [
    ["🚶", "A pé", "walkDistance"],
    ["🚴", "De bike", "bikeDistance"],
    ["🔁", "Elíptico", "ellipticalDistance"],
    ["🏃", "Outros", "otherDistance"],
  ].filter(([, , field]) => stats[field] > 0 || prev[field] > 0);
  return `
    ${eqSummary(`${formatWorkoutNumber(km, 2)} km`, `percorridos · ${cmp.prevName}: ${formatWorkoutNumber(prev.distance, 2)} km`, pickCompareTagline(km, prev.distance, cmp))}
    ${eqSamePointNote(km, cmp.prevSamePoint ? cmp.prevSamePoint.distance : null, cmp, "km", 2)}
    <div class="eq-section-title">🆚 Contra ${cmp.prevName}</div>
    <div class="eq-list">
      ${eqCompareRow("🌍", "Distância total", km, prev.distance, opts)}
      ${modes.length > 1 ? modes.map(([icon, label, field]) => eqCompareRow(icon, label, stats[field], prev[field], opts)).join("") : ""}
    </div>
    <p class="eq-footer">Aqui é você contra você do mês passado. As cidades (Rio, Buenos Aires, Manaus...) e a volta na Terra somam a vida toda e seguem no Hall dos Heróis do Perfil.</p>`;
}

function renderLiftPage(stats) {
  const kg = stats.liftKg;
  const tagline = pickTagline(kg, HALL_TAGLINES.lifted);
  const sections = renderProgressSections(kg, WORKOUT_LIFT_EQUIVALENTS, {
    emptyText: "Nada conquistado ainda. Umas <strong>flexões</strong> no treino Saitama ou um <strong>treino de força</strong> e o primeiro gato cai rapidinho.",
    allDoneText: "Você levantou um Titanic inteiro. Não tem mais escala: você virou a escala.",
    doneTitle: (item, times) => `Você já levantou ${formatWorkoutNumber(times, 0)} ${times === 1 ? item.one : item.name}`,
    challengeLabel: (item) => item.one.charAt(0).toUpperCase() + item.one.slice(1),
    remaining: (item, total) => `${formatWorkoutNumber(item.size - total, 0)} kg (peso de ~${formatWorkoutNumber(item.size, 0)} kg)`,
  });
  return `
    ${eqSummary(`${formatWorkoutNumber(kg, 0)} kg`, `em ${formatWorkoutNumber(stats.liftReps, 0)} repetições`, tagline)}
    ${sections}
    <p class="eq-footer">Conta de guardanapo com pesos aproximados. Sem academia também conta: cada flexão levanta ~64% do seu peso, cada agachamento ~70% e cada abdominal ~30% (pelo peso da sua última pesagem até o dia do treino). Levantar o Titanic é por série, pelo menos em espírito.</p>`;
}

function renderSaitamaPage(stats, scopeWorkouts, cmp) {
  const prev = cmp.prev;
  const name = cmp.prevName;
  const reps = (item) => item.situps + item.pushups + item.squats;
  const totalReps = reps(stats);
  const prevReps = reps(prev);
  const repOpts = { unit: "reps", digits: 0, prevName: name };
  return `
    ${eqSummary(`${formatWorkoutNumber(totalReps, 0)} reps`, `no mês · ${name}: ${formatWorkoutNumber(prevReps, 0)}`, pickCompareTagline(totalReps, prevReps, cmp))}
    ${eqSamePointNote(totalReps, cmp.prevSamePoint ? reps(cmp.prevSamePoint) : null, cmp, "reps", 0)}
    <p class="eq-intro">Aqui é <strong>você contra você de ${name}</strong>. A meta do careca (100 de cada e 10 km por dia durante 3 anos) continua no Hall dos Heróis do Perfil, somando a vida toda.</p>
    <div class="eq-section-title">👊 Você contra você de ${name}</div>
    <div class="eq-list">
      ${eqCompareRow("🧎", "Abdominais", stats.situps, prev.situps, repOpts)}
      ${eqCompareRow("💪", "Flexões", stats.pushups, prev.pushups, repOpts)}
      ${eqCompareRow("🦵", "Agachamentos", stats.squats, prev.squats, repOpts)}
      ${eqCompareRow("🏃", "Distância", stats.distance, prev.distance, { unit: "km", digits: 2, prevName: name })}
    </div>
    <p class="eq-footer">O careca treinou 3 anos; aqui você só precisa ganhar do você do mês passado. Um mês de cada vez.</p>`;
}

/* --------------------------- navegação --------------------------- */
// Desde v1.47 só o Hall de cada mês abre daqui (o da vida toda mora no Perfil).
function openWorkoutHallDetail(detail, monthKey = "") {
  const pages = {
    energy: { title: "🔥 Energia queimada", render: renderEnergyPage },
    distance: { title: "🌍 Quilometragem x mês passado", render: renderDistancePage },
    lifted: { title: "🏋️ Peso levantado", render: renderLiftPage },
    saitama: { title: "👊 Saitama x mês passado", render: renderSaitamaPage },
  };
  const page = pages[detail];
  if (!page || !monthKey) return;

  const scopeWorkouts = getWorkoutMonthStats(healthDb.workouts, monthKey).workouts;
  const stats = getWorkoutLifetimeStats(scopeWorkouts);

  document.getElementById("workoutDetailTitle").innerText = page.title;
  document.getElementById("workoutDetailContent").innerHTML =
    `<div class="eq-scope">📅 ${formatWorkoutMonth(monthKey)}</div>` + page.render(stats, scopeWorkouts, getMonthCompare(monthKey));
  openModule("viewDetail");
  window.scrollTo({ top: 0 });
}

function closeWorkoutDetail() {
  openModule("viewMonth");
  window.scrollTo({ top: 0 });
}

/* ---------------------------------------------------------------------
 * MAPA DE CALOR DOS MÚSCULOS: cálculo e boneco em hall-shared.js.
 * Aqui só as peças da tela do Treinos (mini do card do mês e seção tocável).
 * ------------------------------------------------------------------- */
function getMuscleHeat(workouts) {
  return calcMuscleHeat(workouts, healthDb);
}

// Mini mapa do card do mês (o card inteiro já é um botão)
function renderMuscleMini(workouts) {
  const heat = getMuscleHeat(workouts);
  if (!Object.keys(heat).length) return "";
  const { top, lazy } = describeMuscleHeat(heat);
  return `
    <span class="muscle-mini">
      ${renderMuscleMap(heat)}
      <span class="muscle-mini-text">
        <span class="muscle-mini-label">🔥 Top 3 do mês</span>
        <span class="muscle-mini-top">${top.join(" · ")}</span>
        ${lazy ? `<span class="muscle-mini-lazy">${lazy}</span>` : '<span class="muscle-mini-lazy">Corpo inteiro na conta. Monstro 👹</span>'}
      </span>
    </span>`;
}

// Seção completa (página do mês e página do treino): mapa tocável + ranking
let muscleHeatScopes = {};

function renderMuscleSection(workouts, scope, title = "🔥 Mapa de calor", { teaseLazy = true } = {}) {
  const heat = getMuscleHeat(workouts);
  muscleHeatScopes[scope] = heat;
  if (!Object.keys(heat).length) return "";
  const { lazy } = describeMuscleHeat(heat);
  return `
    <div class="section-title">
      <span>${title}</span>
      <button type="button" class="muscle-help-btn" data-click="openMuscleHelp" aria-label="Como funciona o mapa de calor">?</button>
    </div>
    <div class="card muscle-card">
      ${renderMuscleMap(heat, { interactive: true, scope })}
      <div class="muscle-legend" aria-hidden="true"><span>pouco</span><i class="lv-1"></i><i class="lv-2"></i><i class="lv-3"></i><i class="lv-4"></i><i class="lv-5"></i><span>pegando fogo</span></div>
      <p class="muscle-hint">Toque num músculo pra ver os números. Ficou boiando? Toca no <b>?</b> lá em cima.</p>
      ${renderMuscleRank(heat)}
      ${lazy && teaseLazy ? `<p class="muscle-lazy">${lazy}</p>` : ""}
    </div>`;
}

function showMuscleHeat(group, scope) {
  tobaToast(describeMuscleTap(muscleHeatScopes[scope] || {}, group));
}
