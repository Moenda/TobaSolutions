/* =====================================================================
 * Toba Health · Treinos & Cargas
 * Depende de ../assets/toba-common.js e health-core.js (healthDb, saveHealthDb).
 * ===================================================================== */
function getMonday(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function formatWorkoutDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Data inválida"
    : date.toLocaleDateString("pt-BR");
}

function formatWorkoutNumber(value, maximumFractionDigits = 1) {
  return Number(value || 0).toLocaleString("pt-BR", {
    maximumFractionDigits,
  });
}

function getWorkoutMonthKey(dateValue) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(dateValue || ""));
  return match ? `${match[1]}-${match[2]}` : "";
}

function formatWorkoutMonth(monthKey) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Mês inválido";
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getWorkoutMonthStats(workouts, monthKey, referenceDate = new Date()) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth =
    monthKey === getWorkoutMonthKey(toIsoDate(referenceDate));
  const elapsedDays = isCurrentMonth
    ? referenceDate.getDate()
    : daysInMonth;
  const monthWorkouts = workouts.filter(
    (workout) =>
      getWorkoutMonthKey(workout.date) === monthKey &&
      (!isCurrentMonth || workout.date <= toIsoDate(referenceDate)),
  );
  const saitamaWorkouts = monthWorkouts.filter(
    (workout) => workout.type === "saitama",
  );
  const activeDays = new Set(monthWorkouts.map((workout) => workout.date));
  const total = (field, items = monthWorkouts) =>
    items.reduce(
      (sum, workout) => sum + (Number(workout[field]) || 0),
      0,
    );

  return {
    workouts: monthWorkouts,
    count: monthWorkouts.length,
    activeDays: activeDays.size,
    elapsedDays,
    efficiency: elapsedDays ? (activeDays.size / elapsedDays) * 100 : 0,
    durationMinutes: total("durationMinutes"),
    calories: total("calories"),
    distance: total("distanceKm"),
    lift: sumWorkoutLift(monthWorkouts),
    saitama: {
      pushups: total("pushups", saitamaWorkouts),
      situps: total("situps", saitamaWorkouts),
      squats: total("squats", saitamaWorkouts),
    },
  };
}

const WORKOUT_TYPE_ICONS = {
  saitama: "👊",
  walking: "🚶",
  bike: "🚴",
  elliptical: "🏃",
  strength: "💪",
  custom: "🏋️",
};

const WORKOUT_ICON_EDIT =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const WORKOUT_ICON_DELETE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

function renderWorkoutRecord(workout) {
  const chips = workout.type === "strength" ? getStrengthChips(workout) : [];
  if (workout.pushups) chips.push(`${formatWorkoutNumber(workout.pushups, 0)} flexões`);
  if (workout.situps) chips.push(`${formatWorkoutNumber(workout.situps, 0)} abdominais`);
  if (workout.squats) chips.push(`${formatWorkoutNumber(workout.squats, 0)} agachamentos`);
  if (workout.distanceKm) chips.push(`📍 ${formatWorkoutNumber(workout.distanceKm, 2)} km`);
  if (workout.durationMinutes) chips.push(`⏱️ ${formatWorkoutNumber(workout.durationMinutes, 0)} min`);
  if (workout.calories) chips.push(`🔥 ${formatWorkoutNumber(workout.calories, 0)} kcal`);
  if (workout.sets) chips.push(`${formatWorkoutNumber(workout.sets, 0)} séries`);
  if (workout.reps) chips.push(`${formatWorkoutNumber(workout.reps, 0)} repetições`);
  if (workout.weightKg) chips.push(`🏋️ ${formatWorkoutNumber(workout.weightKg, 1)} kg`);
  const lift = getWorkoutLift(workout);
  if (lift.kg > 0 && (workout.sets || workout.reps || workout.pushups || workout.situps || workout.squats)) {
    chips.push(`💪 ${formatWorkoutNumber(lift.kg, 0)} kg levantados`);
  }
  const weekday = new Date(`${workout.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const id = escapeHtml(workout.id);

  // O card inteiro abre a página do treino; os botões de dentro têm ação própria.
  return `
    <article class="workout-record is-clickable" role="button" tabindex="0" data-click="openWorkoutView" data-id="${id}" aria-label="Ver detalhes: ${escapeHtml(workout.title)}">
      <div class="workout-record-icon" aria-hidden="true">${WORKOUT_TYPE_ICONS[workout.type] || "🏅"}</div>
      <div class="workout-record-body">
        <div class="workout-record-top">
          <div class="workout-record-heading">
            <div class="workout-record-title">${escapeHtml(workout.title)}</div>
            <div class="workout-record-meta">${formatWorkoutDate(workout.date)} · ${weekday}</div>
          </div>
          <div class="workout-record-actions">
            ${workout.type === "strength" ? `<button type="button" class="workout-icon-btn" data-click="openStrengthSummary" data-id="${id}" title="Ver resumo do treino" aria-label="Ver resumo do treino">🏆</button>` : ""}
            <button type="button" class="workout-icon-btn" data-click="editWorkout" data-id="${id}" title="Editar treino" aria-label="Editar treino">${WORKOUT_ICON_EDIT}</button>
            <button type="button" class="workout-icon-btn workout-icon-btn-danger" data-click="deleteWorkout" data-id="${id}" title="Excluir registro" aria-label="Excluir registro">${WORKOUT_ICON_DELETE}</button>
          </div>
        </div>
        ${chips.length ? `<div class="workout-record-chips">${chips.map((chip) => `<span class="workout-chip">${chip}</span>`).join("")}</div>` : ""}
        ${renderStrengthExerciseList(workout)}
        ${workout.notes ? `<div class="workout-record-note">📝 ${escapeHtml(workout.notes)}</div>` : ""}
        <span class="workout-record-more">Ver o treino ›</span>
      </div>
    </article>
  `;
}

/* ---------------------------------------------------------------------
 * PÁGINA DE UM TREINO: toque no card do histórico -> como foi o treino
 * (números, cada exercício série por série, recordes, observação).
 * ------------------------------------------------------------------- */
const WORKOUT_TYPE_NAMES = {
  saitama: "Treino do Mestre Saitama",
  walking: "Caminhada / Corrida",
  bike: "Bike",
  elliptical: "Elíptico",
  strength: "Treino de força",
  custom: "Treino personalizado",
};

let selectedWorkoutId = "";
let workoutViewReturn = "viewTraining";

function openWorkoutView(workoutId) {
  const active = document.querySelector(".app-view.active")?.id;
  if (active && active !== "viewWorkout") workoutViewReturn = active;
  selectedWorkoutId = String(workoutId);
  if (renderWorkoutView()) openModule("viewWorkout");
}

function closeWorkoutView() {
  selectedWorkoutId = "";
  openModule(workoutViewReturn);
}

function renderWorkoutView() {
  const workout = healthDb.workouts.find((item) => String(item.id) === selectedWorkoutId);
  if (!workout) return false;
  const lift = getWorkoutLift(workout);
  const isStrength = workout.type === "strength" && Array.isArray(workout.exercises);
  const weekday = new Date(`${workout.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  const groups = [...new Set(getWorkoutMuscleWork(workout).map((item) => item.group))].map(getStrengthGroupName);
  const id = escapeHtml(workout.id);

  const tile = (label, value, sub = "", color = "") => `
    <div class="toba-stat">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value${color ? ` ${color}` : ""}">${value}</span>
      ${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}
    </div>`;
  const tiles = [];
  if (workout.durationMinutes) tiles.push(tile("⏱️ Tempo", `${formatWorkoutNumber(workout.durationMinutes, 0)} min`, "", "text-blue"));
  if (workout.calories) tiles.push(tile("🔥 Energia", `${formatWorkoutNumber(workout.calories, 0)} kcal`, "", "text-gold"));
  if (workout.distanceKm) {
    const pace = workout.durationMinutes ? workout.durationMinutes / workout.distanceKm : 0;
    tiles.push(tile("📍 Distância", `${formatWorkoutNumber(workout.distanceKm, 2)} km`, pace ? `${formatWorkoutNumber(pace, 1)} min/km` : "", "text-blue"));
  }
  if (isStrength) {
    tiles.push(tile("🏋️ Exercícios", `${workout.exercises.length}`, `${getStrengthLift(workout).sets} séries`));
  } else if (workout.sets || workout.reps) {
    tiles.push(tile("🏋️ Séries", `${formatWorkoutNumber(workout.sets || 0, 0)} × ${formatWorkoutNumber(workout.reps || 0, 0)}`, workout.weightKg ? `${formatWorkoutNumber(workout.weightKg, 1)} kg` : ""));
  }
  [["pushups", "🫸 Flexões"], ["situps", "🔥 Abdominais"], ["squats", "🦵 Agachamentos"]].forEach(([field, label]) => {
    if (workout[field]) tiles.push(tile(label, `${formatWorkoutNumber(workout[field], 0)} reps`, "", "text-gold"));
  });

  const equivalent = [...WORKOUT_LIFT_EQUIVALENTS].reverse().find((item) => lift.kg >= item.size);
  const hero = lift.kg > 0
    ? `<div class="wv-hero">
        <span class="wv-hero-label">💪 Peso levantado</span>
        <strong class="wv-hero-value">${formatWorkoutNumber(lift.kg, 0)} kg</strong>
        <span class="wv-hero-sub">em ${formatWorkoutNumber(lift.reps, 0)} repetições${equivalent ? ` · ${equivalent.icon} ≈ ${formatWorkoutNumber(lift.kg / equivalent.size, 1)} ${lift.kg / equivalent.size < 2 ? equivalent.one : equivalent.name}` : ""}</span>
      </div>`
    : "";

  let exercisesHtml = "";
  if (isStrength && workout.exercises.length) {
    const prs = new Set(getStrengthRecords(workout).records.map((record) => record.name));
    exercisesHtml = `
      <div class="section-title">📋 Exercício por exercício</div>
      <div class="wv-exercises">${workout.exercises.map((exercise) => {
        const exLift = getStrengthLift({ date: workout.date, exercises: [exercise] });
        const fraction = getStrengthExercise(exercise.exerciseId)?.bodyweight || 0;
        const sets = (exercise.sets || []).filter((set) => Number(set.reps) > 0);
        return `
          <div class="wv-exercise">
            <div class="wv-exercise-head">
              <span class="wv-exercise-name">${prs.has(exercise.name) ? "🏅 " : ""}${escapeHtml(exercise.name)}</span>
              ${exLift.kg > 0 ? `<span class="wv-exercise-kg">${formatWorkoutNumber(exLift.kg, 0)} kg</span>` : ""}
            </div>
            <div class="wv-exercise-group">${escapeHtml(getStrengthGroupName(exercise.group))}${fraction ? ` · conta ${formatWorkoutNumber(fraction * 100, 0)}% do seu peso` : ""}</div>
            <ol class="wv-sets">${sets.map((set) => `
              <li><span>${formatWorkoutNumber(set.reps, 0)} reps</span><span>${Number(set.kg) ? `${formatWorkoutNumber(set.kg, 1)} kg` : (fraction ? "peso do corpo" : "sem carga")}</span></li>`).join("")}
            </ol>
          </div>`;
      }).join("")}</div>`;
  }

  document.getElementById("workoutViewContent").innerHTML = `
    <div class="card wv-top">
      <div class="wv-top-row">
        <span class="workout-record-icon" aria-hidden="true">${WORKOUT_TYPE_ICONS[workout.type] || "🏅"}</span>
        <span class="wv-top-text">
          <span class="wv-title">${escapeHtml(workout.title)}</span>
          <span class="wv-date">${formatWorkoutDate(workout.date)} · ${weekday}</span>
        </span>
      </div>
      <div class="workout-record-chips">
        <span class="workout-chip">${WORKOUT_TYPE_NAMES[workout.type] || "Treino"}</span>
        ${groups.map((group) => `<span class="workout-chip">${escapeHtml(group)}</span>`).join("")}
      </div>
      ${hero}
    </div>
    ${tiles.length ? `<div class="toba-stats wv-stats">${tiles.join("")}</div>` : ""}
    ${exercisesHtml}
    ${renderMuscleSection([workout], "workout", "🔥 Músculos do treino", { teaseLazy: false })}
    ${workout.notes ? `<div class="workout-record-note wv-note">📝 ${escapeHtml(workout.notes)}</div>` : ""}
    <div class="wv-actions">
      ${isStrength ? `<button type="button" class="btn btn-primary" data-click="openStrengthSummary" data-id="${id}">🏆 Ver resumo com recordes</button>` : ""}
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" data-click="editWorkout" data-id="${id}">✏️ Editar</button>
        <button type="button" class="btn btn-danger" data-click="deleteWorkout" data-id="${id}">🗑️ Excluir</button>
      </div>
    </div>
  `;
  return true;
}

function getWorkoutLifetimeStats(workouts = healthDb.workouts) {
  return workouts.reduce(
    (totals, workout) => {
      totals.durationMinutes += Number(workout.durationMinutes) || 0;
      totals.calories += Number(workout.calories) || 0;
      const distance = Number(workout.distanceKm) || 0;
      totals.distance += distance;
      if (workout.type === "walking" || workout.type === "saitama") {
        totals.walkDistance += distance;
      } else if (workout.type === "bike") {
        totals.bikeDistance += distance;
      } else if (workout.type === "elliptical") {
        totals.ellipticalDistance += distance;
      } else {
        totals.otherDistance += distance;
      }
      const lift = getWorkoutLift(workout);
      totals.liftKg += lift.kg;
      totals.liftReps += lift.reps;
      if (workout.type === "saitama") {
        totals.pushups += Number(workout.pushups) || 0;
        totals.situps += Number(workout.situps) || 0;
        totals.squats += Number(workout.squats) || 0;
      }
      return totals;
    },
    { durationMinutes: 0, calories: 0, distance: 0, walkDistance: 0, bikeDistance: 0, ellipticalDistance: 0, otherDistance: 0, pushups: 0, situps: 0, squats: 0, liftKg: 0, liftReps: 0 },
  );
}

/* ---------------------------------------------------------------------
 * PESO LEVANTADO
 * - Musculação: carga × séries × repetições (séries/repetições ausentes
 *   contam como 1; sem carga não entra na conta).
 * - Peso do corpo (flexão, agachamento, abdominal do Saitama e exercícios
 *   do catálogo com "bodyweight"): cada repetição conta a parte do corpo que
 *   o exercício levanta × o peso da pesagem mais recente até a data do
 *   treino (sem pesagem: BODYWEIGHT_DEFAULT_KG). Só cálculo: nada disso é
 *   gravado, então vale também para os treinos antigos.
 * ------------------------------------------------------------------- */
const BODYWEIGHT_DEFAULT_KG = 75;
// Campos soltos do treino Saitama -> exercício do catálogo (grupo muscular
// para o futuro mapa de calor) e parte do corpo levantada.
const BODYWEIGHT_FIELDS = {
  pushups: { exerciseId: "flexao", group: "peito", fraction: 0.64 }, // ~64% do corpo
  squats: { exerciseId: "agachamento-corpo", group: "quadriceps", fraction: 0.7 }, // ~70%
  situps: { exerciseId: "abdominal-crunch", group: "abdomen", fraction: 0.3 }, // ~30% (tronco)
};

function getBodyWeightOn(dateStr) {
  const weighIns = (healthDb.weighIns || [])
    .filter((w) => Number(w.weight) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!weighIns.length) return BODYWEIGHT_DEFAULT_KG;
  const day = String(dateStr || "");
  const before = weighIns.filter((w) => String(w.date).slice(0, 10) <= day);
  // Treino antes da 1ª pesagem usa a 1ª pesagem
  return Number((before.length ? before[before.length - 1] : weighIns[0]).weight);
}

function getBodyweightLift(workout) {
  return getWorkoutMuscleWork(workout, { bodyweightOnly: true }).reduce(
    (totals, item) => ({ kg: totals.kg + item.kg, reps: totals.reps + item.reps }),
    { kg: 0, reps: 0 },
  );
}

/* Trabalho por grupo muscular de um treino: base do futuro mapa de calor.
 * Devolve [{ group, exerciseId, reps, kg }] juntando os exercícios do treino
 * de força (grupo gravado no próprio treino) e os campos de peso do corpo
 * (flexão/agachamento/abdominal), que ganham grupo por BODYWEIGHT_FIELDS. */
function getWorkoutMuscleWork(workout, { bodyweightOnly = false } = {}) {
  const items = [];
  const counts = Object.keys(BODYWEIGHT_FIELDS)
    .map((field) => [field, Number(workout[field]) || 0])
    .filter(([, count]) => count > 0);
  if (counts.length) {
    const bodyKg = getBodyWeightOn(workout.date);
    counts.forEach(([field, count]) => {
      const info = BODYWEIGHT_FIELDS[field];
      items.push({ group: info.group, exerciseId: info.exerciseId, reps: count, kg: count * bodyKg * info.fraction });
    });
  }
  if (bodyweightOnly || !Array.isArray(workout.exercises)) return items;
  workout.exercises.forEach((exercise) => {
    const single = getStrengthLift({ date: workout.date, exercises: [exercise] });
    items.push({ group: exercise.group || "", exerciseId: exercise.exerciseId, reps: single.reps, kg: single.kg });
  });
  return items;
}

function getWorkoutLift(workout) {
  const body = getBodyweightLift(workout);
  if (Array.isArray(workout.exercises)) {
    const strength = getStrengthLift(workout);
    return { kg: strength.kg + body.kg, reps: strength.reps + body.reps };
  }
  const weight = Number(workout.weightKg) || 0;
  if (weight <= 0) return body;
  const sets = Math.max(Number(workout.sets) || 1, 1);
  const reps = Math.max(Number(workout.reps) || 1, 1);
  return { kg: weight * sets * reps + body.kg, reps: sets * reps + body.reps };
}

function sumWorkoutLift(workouts) {
  return workouts.reduce(
    (total, workout) => {
      const lift = getWorkoutLift(workout);
      total.kg += lift.kg;
      total.reps += lift.reps;
      return total;
    },
    { kg: 0, reps: 0 },
  );
}

// Escala de comparações (pesos aproximados), do mais leve ao mais absurdo.
/* ---------------------------------------------------------------------
 * CARDS DO "HALL DO HERÓI" (geral e de cada mês)
 * ------------------------------------------------------------------- */
function renderWorkoutHeroCards(stats, workoutCount, { monthKey = "", intro = "" } = {}) {
  const monthAttr = monthKey ? ` data-hero-month="${monthKey}"` : "";
  const earthPercentage = (stats.distance / 40075) * 100;
  const earthBar = Math.min(100, Math.max(0, earthPercentage));
  return `
    ${intro ? `<p class="workout-legacy-intro">${intro}</p>` : ""}
    <div class="workout-legacy-grid">
      <div class="workout-legacy-stat">
        <span class="workout-legacy-label">⏱️ Tempo</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.durationMinutes, 0)} minutos</strong>
        <span class="workout-legacy-detail">em ${formatWorkoutNumber(workoutCount, 0)} treinos</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-action" role="button" tabindex="0" data-click="openHallDetail" data-hero-detail="energy"${monthAttr} aria-label="Ver equivalências de energia queimada">
        <span class="workout-legacy-label">🔥 Energia</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.calories, 0)} kcal</strong>
        <span class="workout-legacy-detail workout-legacy-detail-compact">Ver equivalências ↗</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-stat-wide workout-legacy-action" role="button" tabindex="0" data-click="openHallDetail" data-hero-detail="distance"${monthAttr} aria-label="Ver distâncias percorridas e rotas">
        <span class="workout-legacy-label">🌍 Distância · ${formatWorkoutNumber(stats.distance, 2)} km</span>
        <div class="workout-distance-breakdown">
          <div class="workout-distance-mode"><span class="workout-distance-mode-label">A pé</span><strong class="workout-distance-mode-value">${formatWorkoutNumber(stats.walkDistance, 2)} km</strong></div>
          <div class="workout-distance-mode"><span class="workout-distance-mode-label">De bike</span><strong class="workout-distance-mode-value">${formatWorkoutNumber(stats.bikeDistance, 2)} km</strong></div>
          <div class="workout-distance-mode"><span class="workout-distance-mode-label">Elíptico</span><strong class="workout-distance-mode-value">${formatWorkoutNumber(stats.ellipticalDistance, 2)} km</strong></div>
        </div>
        <div class="workout-earth-progress-label"><span>Volta na Terra</span><span>${formatWorkoutNumber(earthPercentage, 2)}%</span></div>
        <div class="workout-earth-progress-track" role="progressbar" aria-label="${formatWorkoutNumber(earthPercentage, 2)}% de uma volta ao redor da Terra" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${earthBar}">
          <div class="workout-earth-progress-fill" style="width: ${earthBar}%"></div>
        </div>
        <span class="workout-legacy-detail">Toque para ver as cidades que essa distância alcança</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-stat-wide workout-legacy-action" role="button" tabindex="0" data-click="openHallDetail" data-hero-detail="lifted"${monthAttr} aria-label="Ver equivalências do peso levantado">
        <span class="workout-legacy-label">🏋️ Peso levantado</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.liftKg, 0)} kg em ${formatWorkoutNumber(stats.liftReps, 0)} repetições</strong>
        <span class="workout-legacy-detail">Toque para comparar com elefantes, Boeings e Titanics</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-stat-wide workout-legacy-action" role="button" tabindex="0" data-click="openHallDetail" data-hero-detail="saitama"${monthAttr} aria-label="Comparar repetições e distância com Saitama">
        <span class="workout-legacy-label">👊 Treino Saitama</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.situps, 0)} abd · ${formatWorkoutNumber(stats.pushups, 0)} flex · ${formatWorkoutNumber(stats.squats, 0)} agach</strong>
        <span class="workout-legacy-detail">Toque para descobrir quanto falta para o careca fictício</span>
      </div>
      ${monthKey ? "" : renderMuscleHallTile(healthDb.workouts)}
    </div>
  `;
}

/* ---------------------------------------------------------------------
 * HISTÓRICO MENSAL: lista de meses -> detalhe do mês (Hall + treinos)
 * ------------------------------------------------------------------- */
let selectedHistoryMonth = "";

function openWorkoutMonth(monthKey) {
  selectedHistoryMonth = monthKey;
  openModule("viewMonth");
}

function renderWorkoutMonth(workouts, today) {
  if (!selectedHistoryMonth) return;
  const month = getWorkoutMonthStats(workouts, selectedHistoryMonth, today);
  document.getElementById("workoutMonthDetailTitle").innerText =
    `🏆 ${formatWorkoutMonth(selectedHistoryMonth)}`;
  const content = document.getElementById("workoutMonthContent");
  content.innerHTML = renderWorkoutHeroCards(
    getWorkoutLifetimeStats(month.workouts),
    month.count,
    {
      monthKey: selectedHistoryMonth,
      intro: `Seu Hall do Herói só de ${formatWorkoutMonth(selectedHistoryMonth)}:`,
    },
  );
  document.getElementById("workoutMonthHeat").innerHTML =
    renderMuscleSection(month.workouts, "month");
  const records = document.getElementById("workoutMonthRecords");
  records.innerHTML = month.workouts.length
    ? month.workouts.map(renderWorkoutRecord).join("")
    : tobaEmpty("🛋️", "Nenhum treino neste mês", "O sofá agradece, o shape nem tanto.", { compact: true });
}

function renderWorkoutScreen() {
  const workouts = [...healthDb.workouts].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  const today = new Date();
  const currentMonthKey = getWorkoutMonthKey(toIsoDate(today));
  const currentMonth = getWorkoutMonthStats(workouts, currentMonthKey, today);
  const allTimeStats = getWorkoutLifetimeStats(workouts);
  const dailyAverage = (value) =>
    currentMonth.elapsedDays ? value / currentMonth.elapsedDays : 0;

  const [monthYear, monthNumber] = currentMonthKey.split("-");
  const monthShortLabel = new Date(
    Number(monthYear),
    Number(monthNumber) - 1,
    1,
  ).toLocaleDateString("pt-BR", { month: "long" });
  document.getElementById("workoutMonthTitle").textContent =
    `🏋️ ${monthShortLabel.charAt(0).toUpperCase()}${monthShortLabel.slice(1)}/${monthYear.slice(-2)}`;

  const saitama = currentMonth.saitama;
  const saitamaTotal = saitama.pushups + saitama.situps + saitama.squats;
  const summary = document.getElementById("workoutSummary");
  const tile = (metric, label, value, sub, extraClass = "") => `
    <button type="button" class="toba-stat${extraClass}" data-click="openWorkoutChart" data-metric="${metric}" aria-haspopup="dialog">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </button>
  `;
  summary.innerHTML = [
    tile(
      "workouts",
      "🏋️ Treinos no mês",
      `<span class="text-green">${currentMonth.count} ${currentMonth.count === 1 ? "treino" : "treinos"}</span> · ${formatWorkoutNumber(currentMonth.durationMinutes, 0)} min`,
      `Treinou em ${currentMonth.activeDays} de ${currentMonth.elapsedDays} dias · ${formatWorkoutNumber(currentMonth.efficiency)}% de constância`,
      " is-wide is-highlight",
    ),
    tile("calories", "🔥 Calorias", `<span class="text-gold">${formatWorkoutNumber(currentMonth.calories, 0)} kcal</span>`, `${formatWorkoutNumber(dailyAverage(currentMonth.calories), 0)} kcal/dia`),
    tile("distance", "📍 Distância", `<span class="text-blue">${formatWorkoutNumber(currentMonth.distance, 2)} km</span>`, `${formatWorkoutNumber(dailyAverage(currentMonth.distance), 2)} km/dia`),
    tile("saitamaReps", "👊 Saitama", `<span class="text-coral">${formatWorkoutNumber(saitamaTotal, 0)} reps</span>`, `${formatWorkoutNumber(saitama.situps, 0)} abd · ${formatWorkoutNumber(saitama.pushups, 0)} flex · ${formatWorkoutNumber(saitama.squats, 0)} agach`),
    tile("lifted", "🏋️ Levantado", `<span class="text-green">${formatWorkoutNumber(currentMonth.lift.kg, 0)} kg</span>`, `em ${formatWorkoutNumber(currentMonth.lift.reps, 0)} repetições`),
  ].join("");

  const heroContent = document.getElementById("workoutHallContent");
  heroContent.innerHTML = renderWorkoutHeroCards(allTimeStats, workouts.length, {
    intro: "O shape não veio por carta registrada. Olha o que você já construiu:",
  });

  const historyMonths = [...new Set([
    currentMonthKey,
    ...workouts
      .map((workout) => getWorkoutMonthKey(workout.date))
      .filter((monthKey) => monthKey && monthKey < currentMonthKey),
  ])].sort((a, b) => b.localeCompare(a));
  document.getElementById("workoutHistoryCount").innerText =
    `${historyMonths.length} ${historyMonths.length === 1 ? "mês" : "meses"}`;
  const history = document.getElementById("workoutHistory");
  history.innerHTML = historyMonths
    .map((monthKey) => {
      const month = getWorkoutMonthStats(workouts, monthKey, today);
      const chips = [
        `🏋️ ${month.count} ${month.count === 1 ? "treino" : "treinos"}`,
        `⏱️ ${formatWorkoutNumber(month.durationMinutes, 0)} min`,
        `🔥 ${formatWorkoutNumber(month.calories, 0)} kcal`,
        `📍 ${formatWorkoutNumber(month.distance, 2)} km`,
      ];
      if (month.lift.kg > 0) chips.push(`💪 ${formatWorkoutNumber(month.lift.kg, 0)} kg`);
      return `
        <button type="button" class="workout-month-card" data-click="openWorkoutMonth" data-month="${monthKey}" aria-label="Abrir ${formatWorkoutMonth(monthKey)}">
          <span class="workout-month-card-head">
            <span class="workout-month-title">${formatWorkoutMonth(monthKey)}</span>
            ${monthKey === currentMonthKey ? '<span class="workout-badge">Atual</span>' : ""}
            <span class="workout-chevron" aria-hidden="true">›</span>
          </span>
          <span class="workout-record-chips">${chips.map((chip) => `<span class="workout-chip">${chip}</span>`).join("")}</span>
          ${renderMuscleMini(month.workouts)}
        </button>
      `;
    })
    .join("");

  renderWorkoutMonth(workouts, today);

  // Página de um treino aberta: redesenha (editou) ou volta (excluiu)
  if (selectedWorkoutId && document.getElementById("viewWorkout").classList.contains("active")) {
    if (!renderWorkoutView()) closeWorkoutView();
  }
}

function openWorkoutChart(metric) {
  const chartOptions = {
    workouts: {
      title: "⏱️ Minutos treinados por dia",
      description: "Soma dos minutos de treino registrados em cada dia.",
      unit: "min",
      value: (workouts) =>
        workouts.reduce(
          (total, workout) => total + (Number(workout.durationMinutes) || 0),
          0,
        ),
    },
    calories: {
      title: "🔥 Calorias por dia",
      description: "Soma das calorias registradas em cada dia.",
      unit: "kcal",
      value: (workouts) =>
        workouts.reduce(
          (total, workout) => total + (Number(workout.calories) || 0),
          0,
        ),
    },
    distance: {
      title: "📍 Distância por dia",
      description: "Soma da distância registrada em cada dia.",
      unit: "km",
      value: (workouts) =>
        workouts.reduce(
          (total, workout) => total + (Number(workout.distanceKm) || 0),
          0,
        ),
    },
    lifted: {
      title: "🏋️ Peso levantado por dia",
      description: "Carga × séries × repetições, mais flexão, agachamento e abdominal pelo seu peso.",
      unit: "kg",
      value: (workouts) =>
        workouts.reduce((total, workout) => total + getWorkoutLift(workout).kg, 0),
    },
    saitamaReps: {
      title: "👊 Repetições do Saitama por dia",
      description: "Flexões, abdominais e agachamentos somados por dia.",
      unit: "reps",
      value: (workouts) =>
        workouts.reduce(
          (total, workout) =>
            total +
            (workout.type === "saitama"
              ? (Number(workout.pushups) || 0) +
              (Number(workout.situps) || 0) +
              (Number(workout.squats) || 0)
              : 0),
          0,
        ),
    },
  };
  const selectedMetric = chartOptions[metric];
  if (!selectedMetric) return;

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const monday = getMonday(todayStart);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = toIsoDate(date);
    const dayWorkouts = healthDb.workouts.filter(
      (workout) => workout.date === dateKey,
    );
    return {
      label: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
        date.getDay()
      ],
      date,
      value: selectedMetric.value(dayWorkouts),
    };
  });
  const maximum = Math.max(...days.map((day) => day.value), 0);

  document.getElementById("workoutChartTitle").innerText =
    selectedMetric.title;
  document.getElementById("workoutChartDescription").innerText =
    selectedMetric.description;
  document.getElementById("workoutChart").innerHTML = days
    .map((day) => {
      const isFuture = day.date > todayStart;
      const height =
        day.value > 0 && maximum > 0
          ? Math.max((day.value / maximum) * 100, 5)
          : 0;
      const valueLabel =
        metric === "distance"
          ? formatWorkoutNumber(day.value, 2)
          : formatWorkoutNumber(day.value, 0);
      return `
        <div class="workout-chart-day" aria-label="${day.label}: ${valueLabel} ${selectedMetric.unit}${isFuture ? ", dia futuro" : ""}">
          <span class="workout-chart-value">${isFuture ? "·" : valueLabel}</span>
          <div class="workout-chart-bar-area">
            <div class="workout-chart-bar${day.value > 0 ? " has-value" : ""}" style="height: ${day.value > 0 ? height : 4}%"></div>
          </div>
          <span class="workout-chart-day-label">${day.label}</span>
        </div>
      `;
    })
    .join("");
  document.getElementById("workoutChartWeek").innerText =
    `Semana de ${formatWorkoutDate(toIsoDate(days[0].date))} a ${formatWorkoutDate(toIsoDate(days[6].date))} · unidade: ${selectedMetric.unit}`;
  openTobaModal("workoutChartModal");
}

let selectedWorkoutType = "";

let editingWorkoutId = null;

function openWorkoutModal() {
  selectedWorkoutType = "";
  hideStrengthPanel();
  editingWorkoutId = null;
  document.getElementById("workoutModalTitle").innerText =
    "🏋️ Registrar treino";
  document.getElementById("workoutTypePicker").hidden = false;
  document.getElementById("workoutForm").hidden = true;
  openTobaModal("workoutModal");
}

function closeWorkoutModal() {
  closeTobaModal("workoutModal");
}

// Fechar pelo ✕ ou depois de salvar limpa o treino de força em andamento.
document.getElementById("workoutModal").addEventListener("toba:close", () => {
  hideStrengthPanel();
  editingWorkoutId = null;
});

function backToWorkoutTypes() {
  selectedWorkoutType = "";
  hideStrengthPanel();
  document.getElementById("workoutTypePicker").hidden = false;
  document.getElementById("workoutForm").hidden = true;
  document.getElementById("workoutModalTitle").textContent = "🏋️ Registrar treino";
}

function workoutNumberField(id, label, step = "1", placeholder = "") {
  return `
    <div class="form-group">
      <label for="workout-${id}">${label}</label>
      <input id="workout-${id}" class="form-control" type="number" min="0" step="${step}" placeholder="${placeholder}" />
    </div>
  `;
}

function selectWorkoutType(type) {
  if (type === "strength") {
    selectedWorkoutType = "strength";
    openStrengthPanel();
    return;
  }
  const cardioFields = (dateLabel) => `
    <div class="form-group">
      <label for="workout-date">${dateLabel}</label>
      <input id="workout-date" class="form-control" type="date" required value="${toIsoDate()}" />
    </div>
    <div class="grid-2">
      ${workoutNumberField("distanceKm", "Distância (km)", "0.01")}
      ${workoutNumberField("durationMinutes", "Tempo (min)", "1")}
      ${workoutNumberField("calories", "Calorias (kcal)", "1")}
    </div>
  `;
  const forms = {
    saitama: {
      title: "👊 Treino lendário do Mestre Saitama",
      fields: `
        <div class="form-group">
          <label for="workout-date">Data do treino</label>
          <input id="workout-date" class="form-control" type="date" required value="${toIsoDate()}" />
        </div>
        <div class="grid-2">
          ${workoutNumberField("pushups", "Flexões feitas", "1")}
          ${workoutNumberField("situps", "Abdominais feitos", "1")}
          ${workoutNumberField("squats", "Agachamentos feitos", "1")}
          ${workoutNumberField("distanceKm", "Caminhada / corrida (km)", "0.01")}
          ${workoutNumberField("durationMinutes", "Duração (min)", "1")}
          ${workoutNumberField("calories", "Calorias (kcal)", "1")}
        </div>
        <p style="font-size: 0.75rem; color: #8b949e; margin-bottom: 0.8rem">
          Registre só o que deu para fazer hoje. Não precisa completar o treino inteiro.
        </p>
      `,
    },
    walking: {
      title: "🚶 Caminhada / Corrida",
      fields: cardioFields("Data da caminhada / corrida"),
    },
    bike: {
      title: "🚴 Bike",
      fields: cardioFields("Data do pedal"),
    },
    elliptical: {
      title: "🏃 Elíptico",
      fields: cardioFields("Data do treino no elíptico"),
    },
    custom: {
      title: "➕ Treino personalizado",
      fields: `
        <div class="form-group">
          <label for="workout-title">Nome da atividade</label>
          <input id="workout-title" class="form-control" type="text" maxlength="60" placeholder="Ex: Musculação, bicicleta..." required />
        </div>
        <div class="form-group">
          <label for="workout-date">Data do treino</label>
          <input id="workout-date" class="form-control" type="date" required value="${toIsoDate()}" />
        </div>
        <div class="grid-2">
          ${workoutNumberField("durationMinutes", "Duração (min)", "1")}
          ${workoutNumberField("calories", "Calorias (kcal)", "1")}
          ${workoutNumberField("distanceKm", "Distância (km)", "0.01")}
          ${workoutNumberField("sets", "Séries", "1")}
          ${workoutNumberField("reps", "Repetições", "1")}
          ${workoutNumberField("weightKg", "Carga (kg)", "0.5")}
        </div>
        <div class="form-group">
          <label for="workout-notes">Observações (opcional)</label>
          <input id="workout-notes" class="form-control" type="text" maxlength="160" placeholder="Como foi o treino?" />
        </div>
      `,
    },
  };
  const form = forms[type];
  if (!form) return;

  selectedWorkoutType = type;
  document.getElementById("workoutModalTitle").innerText = form.title;
  document.getElementById("workoutTypePicker").hidden = true;
  document.getElementById("workoutFormFields").innerHTML = form.fields;
  document.getElementById("workoutForm").hidden = false;
}

function editWorkout(workoutId) {
  const workout = healthDb.workouts.find(
    (item) => String(item.id) === String(workoutId),
  );
  if (!workout) return;

  openWorkoutModal();
  editingWorkoutId = String(workout.id);
  if (workout.type === "strength") {
    selectedWorkoutType = "strength";
    openStrengthPanel(workout);
    return;
  }
  selectWorkoutType(workout.type);
  document.getElementById("workoutModalTitle").innerText = "✏️ Editar treino";
  document.getElementById("workout-date").value = workout.date || "";

  if (workout.type === "custom") {
    document.getElementById("workout-title").value = workout.title || "";
    document.getElementById("workout-notes").value = workout.notes || "";
  }

  [
    "durationMinutes",
    "calories",
    "distanceKm",
    "pushups",
    "situps",
    "squats",
    "sets",
    "reps",
    "weightKg",
  ].forEach((field) => {
    const input = document.getElementById(`workout-${field}`);
    if (input && workout[field] !== null && workout[field] !== undefined) {
      input.value = workout[field];
    }
  });
}

function readWorkoutNumber(id) {
  const value = document.getElementById(`workout-${id}`)?.value;
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function saveWorkout() {
  if (!selectedWorkoutType) return;

  const workout = {
    id: editingWorkoutId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: selectedWorkoutType,
    title:
      selectedWorkoutType === "saitama"
        ? "Treino lendário do Mestre Saitama"
        : selectedWorkoutType === "walking"
          ? "Caminhada / Corrida"
          : selectedWorkoutType === "bike"
            ? "Bike"
            : selectedWorkoutType === "elliptical"
              ? "Elíptico"
              : document.getElementById("workout-title").value.trim(),
    date: document.getElementById("workout-date").value,
    durationMinutes: readWorkoutNumber("durationMinutes"),
    calories: readWorkoutNumber("calories"),
    distanceKm: readWorkoutNumber("distanceKm"),
    pushups: readWorkoutNumber("pushups"),
    situps: readWorkoutNumber("situps"),
    squats: readWorkoutNumber("squats"),
    sets: readWorkoutNumber("sets"),
    reps: readWorkoutNumber("reps"),
    weightKg: readWorkoutNumber("weightKg"),
    notes: document.getElementById("workout-notes")?.value.trim() || "",
  };
  const measurements = [
    workout.durationMinutes,
    workout.calories,
    workout.distanceKm,
    workout.pushups,
    workout.situps,
    workout.squats,
    workout.sets,
    workout.reps,
    workout.weightKg,
  ];

  if (!workout.date || (selectedWorkoutType === "custom" && !workout.title)) {
    showPageMessage("Preencha o nome da atividade e a data do treino.", { title: "Falta um detalhe" });
    return;
  }
  if (!measurements.some((value) => value !== null && value > 0)) {
    showPageMessage("Informe pelo menos uma quantidade maior que zero para registrar o treino.", { title: "Falta um número" });
    return;
  }

  if (editingWorkoutId) {
    const workoutIndex = healthDb.workouts.findIndex(
      (item) => String(item.id) === editingWorkoutId,
    );
    if (workoutIndex === -1) return;
    healthDb.workouts[workoutIndex] = workout;
  } else {
    healthDb.workouts.push(workout);
  }
  saveHealthDb();
  closeWorkoutModal();
  renderWorkoutScreen();
}

async function deleteWorkout(workoutId) {
  const confirmed = await showPageMessage("Deseja excluir este registro de treino?", { title: "Excluir treino", confirm: true, confirmLabel: "Excluir" });
  if (!confirmed) return;
  healthDb.workouts = healthDb.workouts.filter(
    (workout) => String(workout.id) !== String(workoutId),
  );
  saveHealthDb();
  renderWorkoutScreen();
}

/* NAVEGAÇÃO ENTRE AS TELAS DO MÓDULO (Treinos / Hall do Herói / mês / detalhe / ao vivo)
 * O "‹" do cabeçalho sobe um nível: detalhe -> Hall/mês -> Treinos -> Hub. */
const WORKOUT_VIEW_BACK = {
  viewHero: "backToTraining",
  viewMonth: "backToTraining",
  viewDetail: "closeWorkoutDetail",
  viewSummary: "closeStrengthSummary",
  viewWorkout: "closeWorkoutView",
  viewSession: "leaveLiveSession",
};

function openModule(viewId) {
  document
    .querySelectorAll(".app-view")
    .forEach((v) => v.classList.toggle("active", v.id === viewId));
  if (["viewTraining", "viewHero", "viewMonth"].includes(viewId)) renderWorkoutScreen();
  if (viewId === "viewTraining") renderLiveSessionLaunch();

  const titles = {
    viewTraining: "🏋️ Treinos",
    viewHero: "🏆 Hall do Herói",
    viewMonth: document.getElementById("workoutMonthDetailTitle").textContent,
    viewDetail: document.getElementById("workoutDetailTitle").textContent,
    viewSummary: "💪 Resumo do treino",
    viewWorkout: "📋 Como foi o treino",
    viewSession: "▶ Treino ao vivo",
  };
  tobaSetHeader({ page: titles[viewId], back: WORKOUT_VIEW_BACK[viewId] });
  document.getElementById("headerAddBtn").hidden = viewId !== "viewTraining";
  window.scrollTo(0, 0);
}

function onHealthDataReplaced() {
  openModule("viewTraining");
}

tobaActions({
  openWorkoutReminder: () =>
    tobaOpenReminder({
      id: "treino",
      title: "🏋️ Hora do treino",
      message: "Bora treinar? Registra no Toba Health!",
      times: ["18:00"],
      days: ["MO", "WE", "FR"],
    }),
  newWorkout: openWorkoutModal,
  openModule: (el) => openModule(el.dataset.view),
  backToTraining: () => openModule("viewTraining"),
  closeWorkoutDetail,
  closeStrengthSummary,
  closeWorkoutView,
  openWorkoutView: (el) => openWorkoutView(el.dataset.id),
  showMuscleHeat: (el) => showMuscleHeat(el.dataset.group, el.dataset.scope),
  openMuscleHelp: () => openTobaModal("muscleHelpModal"),
  openStrengthSummary: (el) => openStrengthSummary(el.dataset.id),
  openWorkoutMonth: (el) => openWorkoutMonth(el.dataset.month),
  openHallDetail: (el) => openWorkoutHallDetail(el.dataset.heroDetail, el.dataset.heroMonth || ""),
  openWorkoutChart: (el) => openWorkoutChart(el.dataset.metric),
  editWorkout: (el) => editWorkout(el.dataset.id),
  deleteWorkout: (el) => deleteWorkout(el.dataset.id),
  selectWorkoutType: (el) => selectWorkoutType(el.dataset.type),
  backToWorkoutTypes,
  saveWorkout,
});

initTobaDecimalMasks();
openModule("viewTraining");
