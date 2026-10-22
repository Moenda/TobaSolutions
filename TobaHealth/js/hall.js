/* =====================================================================
 * Toba Health · Hall do mês: telas de detalhe (energia, distância,
 * peso levantado, Saitama). São PÁGINAS (view "viewDetail"), não pop-ups.
 * O Hall dos Heróis da vida toda mora no Perfil (assets/perfil-hall.js).
 *
 * Padrão das telas de equivalência:
 *   resumo (número grande + frase) → 🏅 Conquistado (cards compactos)
 *   → 🎯 Próximos desafios (3 barras; o resto fica recolhido)
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

function renderDistancePage(stats) {
  const km = stats.distance;
  const tagline = pickTagline(km, HALL_TAGLINES.distance);
  const sections = renderProgressSections(km, WORKOUT_DISTANCE_DESTINATIONS, {
    emptyText: "Nenhuma cidade conquistada ainda. A primeira é o Rio, só 360 km. Bora?",
    allDoneText: "Você deu a volta ao mundo e ainda sobrou perna. Respeito.",
    doneTitle: (item, times) => `Você já ${item.done} ${formatWorkoutNumber(times, 0)} ${times === 1 ? "vez" : "vezes"}`,
    challengeLabel: (item) => item.label,
    remaining: (item, total) => `${formatWorkoutNumber(item.size - total, 1)} km (trecho de ~${formatWorkoutNumber(item.size, 0)} km)`,
  });
  return `
    ${eqSummary(`${formatWorkoutNumber(km, 2)} km`, "percorridos", tagline)}
    ${sections}
    <p class="eq-footer">Distâncias aproximadas em linha reta a partir de São Paulo; trajetos reais variam. O importante é a barra crescer, não comprar passagem hoje.</p>`;
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

function renderSaitamaPage(stats) {
  const days = 365 * 3;
  const benchmarkReps = 100 * days;
  const benchmarkDistance = 10 * days;
  const totalReps = stats.situps + stats.pushups + stats.squats;
  const progress = ((stats.situps + stats.pushups + stats.squats) / (benchmarkReps * 3)) * 100;
  const tagline = pickTagline(progress, HALL_TAGLINES.saitama);
  const row = (icon, label, value, goal, unit, digits) => {
    const ratio = goal ? value / goal : 0;
    const width = Math.min(100, ratio * 100);
    return `
      <div class="eq-card eq-challenge">
        <span class="eq-icon" aria-hidden="true">${icon}</span>
        <div class="eq-body">
          <div class="eq-challenge-head">
            <strong>${label}</strong>
            <span class="eq-percent">${formatWorkoutNumber(ratio * 100, 3)}%</span>
          </div>
          <div class="eq-bar" role="progressbar" aria-label="${label}: ${formatWorkoutNumber(ratio * 100, 3)}% do treino Saitama" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}">
            <div class="eq-bar-fill" style="width: ${width}%"></div>
          </div>
          <span class="eq-note">${formatWorkoutNumber(value, digits)} de ${formatWorkoutNumber(goal, 0)} ${unit}</span>
        </div>
      </div>`;
  };
  return `
    ${eqSummary(`${formatWorkoutNumber(totalReps, 0)} reps`, "no total", tagline)}
    <p class="eq-intro">Na referência, Saitama fez <strong>100 de cada exercício e correu 10 km por dia durante 3 anos</strong>: ${formatWorkoutNumber(benchmarkReps, 0)} repetições de cada e ${formatWorkoutNumber(benchmarkDistance, 0)} km.</p>
    <div class="eq-section-title">👊 Você contra o careca</div>
    <div class="eq-list">
      ${row("🧎", "Abdominais", stats.situps, benchmarkReps, "repetições", 0)}
      ${row("💪", "Flexões", stats.pushups, benchmarkReps, "repetições", 0)}
      ${row("🦵", "Agachamentos", stats.squats, benchmarkReps, "repetições", 0)}
      ${row("🏃", "Distância", stats.distance, benchmarkDistance, "km", 2)}
    </div>
    <p class="eq-footer">Não precisa virar o careca até sexta. Ele treinou por 3 anos; você já está fazendo a parte mais difícil: começar e voltar.</p>`;
}

/* --------------------------- navegação --------------------------- */
// Desde v1.47 só o Hall de cada mês abre daqui (o da vida toda mora no Perfil).
function openWorkoutHallDetail(detail, monthKey = "") {
  const pages = {
    energy: { title: "🔥 Energia queimada", render: renderEnergyPage },
    distance: { title: "🌍 Sua quilometragem pelo mapa", render: renderDistancePage },
    lifted: { title: "🏋️ Peso levantado", render: renderLiftPage },
    saitama: { title: "👊 Você contra o mestre careca", render: renderSaitamaPage },
  };
  const page = pages[detail];
  if (!page || !monthKey) return;

  const scopeWorkouts = getWorkoutMonthStats(healthDb.workouts, monthKey).workouts;
  const stats = getWorkoutLifetimeStats(scopeWorkouts);

  document.getElementById("workoutDetailTitle").innerText = page.title;
  document.getElementById("workoutDetailContent").innerHTML =
    `<div class="eq-scope">📅 ${formatWorkoutMonth(monthKey)}</div>` + page.render(stats, scopeWorkouts);
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
