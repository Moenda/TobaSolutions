/* =====================================================================
 * Toba Health · Treinos & Cargas
 * Depende de health-core.js (healthDb, saveHealthDb, showPageMessage...)
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

function escapeWorkoutHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
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
    monthKey === getWorkoutMonthKey(getLocalDateInputValue(referenceDate));
  const elapsedDays = isCurrentMonth
    ? referenceDate.getDate()
    : daysInMonth;
  const monthWorkouts = workouts.filter(
    (workout) =>
      getWorkoutMonthKey(workout.date) === monthKey &&
      (!isCurrentMonth || workout.date <= getLocalDateInputValue(referenceDate)),
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
  if (lift.kg > 0 && (workout.sets || workout.reps)) {
    chips.push(`💪 ${formatWorkoutNumber(lift.kg, 0)} kg levantados`);
  }
  const weekday = new Date(`${workout.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const id = escapeWorkoutHtml(workout.id);

  return `
    <article class="workout-record">
      <div class="workout-record-icon" aria-hidden="true">${WORKOUT_TYPE_ICONS[workout.type] || "🏅"}</div>
      <div class="workout-record-body">
        <div class="workout-record-top">
          <div class="workout-record-heading">
            <div class="workout-record-title">${escapeWorkoutHtml(workout.title)}</div>
            <div class="workout-record-meta">${formatWorkoutDate(workout.date)} · ${weekday}</div>
          </div>
          <div class="workout-record-actions">
            <button type="button" class="workout-icon-btn" data-workout-edit="${id}" title="Editar treino" aria-label="Editar treino">${WORKOUT_ICON_EDIT}</button>
            <button type="button" class="workout-icon-btn workout-icon-btn-danger" data-workout-delete="${id}" title="Excluir registro" aria-label="Excluir registro">${WORKOUT_ICON_DELETE}</button>
          </div>
        </div>
        ${chips.length ? `<div class="workout-record-chips">${chips.map((chip) => `<span class="workout-chip">${chip}</span>`).join("")}</div>` : ""}
        ${renderStrengthExerciseList(workout)}
        ${workout.notes ? `<div class="workout-record-note">${escapeWorkoutHtml(workout.notes)}</div>` : ""}
      </div>
    </article>
  `;
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
 * PESO LEVANTADO (musculação): carga × séries × repetições
 * Séries/repetições ausentes contam como 1; sem carga não entra na conta.
 * ------------------------------------------------------------------- */
function getWorkoutLift(workout) {
  if (Array.isArray(workout.exercises)) {
    const strength = getStrengthLift(workout);
    return { kg: strength.kg, reps: strength.reps };
  }
  const weight = Number(workout.weightKg) || 0;
  if (weight <= 0) return { kg: 0, reps: 0 };
  const sets = Math.max(Number(workout.sets) || 1, 1);
  const reps = Math.max(Number(workout.reps) || 1, 1);
  return { kg: weight * sets * reps, reps: sets * reps };
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
        <span class="workout-legacy-label">⏱️ Tempo de treino</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.durationMinutes, 0)} minutos</strong>
        <span class="workout-legacy-detail">em ${formatWorkoutNumber(workoutCount, 0)} treinos registrados</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-action" role="button" tabindex="0" data-hero-detail="energy"${monthAttr} aria-label="Ver equivalências de energia queimada">
        <span class="workout-legacy-label">🔥 Energia queimada</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.calories, 0)} kcal</strong>
        <span class="workout-legacy-detail workout-legacy-detail-compact">Ver equivalências ↗</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-stat-wide workout-legacy-action" role="button" tabindex="0" data-hero-detail="distance"${monthAttr} aria-label="Ver distâncias percorridas e rotas">
        <span class="workout-legacy-label">🌍 Distância percorrida · ${formatWorkoutNumber(stats.distance, 2)} km</span>
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
      <div class="workout-legacy-stat workout-legacy-stat-wide workout-legacy-action" role="button" tabindex="0" data-hero-detail="lifted"${monthAttr} aria-label="Ver equivalências do peso levantado">
        <span class="workout-legacy-label">🏋️ Peso levantado</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.liftKg, 0)} kg em ${formatWorkoutNumber(stats.liftReps, 0)} repetições</strong>
        <span class="workout-legacy-detail">Toque para comparar com elefantes, Boeings e Titanics</span>
      </div>
      <div class="workout-legacy-stat workout-legacy-stat-wide workout-legacy-action" role="button" tabindex="0" data-hero-detail="saitama"${monthAttr} aria-label="Comparar repetições e distância com Saitama">
        <span class="workout-legacy-label">💪 Repetições do treino Saitama</span>
        <strong class="workout-legacy-value">${formatWorkoutNumber(stats.situps, 0)} abdominais · ${formatWorkoutNumber(stats.pushups, 0)} flexões · ${formatWorkoutNumber(stats.squats, 0)} agachamentos</strong>
        <span class="workout-legacy-detail">Toque para descobrir quanto falta para o careca fictício</span>
      </div>
    </div>
  `;
}

function bindWorkoutHeroDetails(container) {
  container.onclick = (event) => {
    const detailCard = event.target.closest("[data-hero-detail]");
    if (detailCard) openWorkoutHallDetail(detailCard.dataset.heroDetail, detailCard.dataset.heroMonth || "");
  };
  container.onkeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const detailCard = event.target.closest("[data-hero-detail]");
    if (!detailCard) return;
    event.preventDefault();
    openWorkoutHallDetail(detailCard.dataset.heroDetail, detailCard.dataset.heroMonth || "");
  };
}

function handleWorkoutRecordClick(event) {
  const editButton = event.target.closest("[data-workout-edit]");
  if (editButton) {
    editWorkout(editButton.dataset.workoutEdit);
    return;
  }
  const deleteButton = event.target.closest("[data-workout-delete]");
  if (deleteButton) deleteWorkout(deleteButton.dataset.workoutDelete);
}

/* ---------------------------------------------------------------------
 * HISTÓRICO MENSAL: lista de meses -> detalhe do mês (Hall + treinos)
 * ------------------------------------------------------------------- */
let selectedHistoryMonth = "";

function openWorkoutMonth(monthKey) {
  selectedHistoryMonth = monthKey;
  openModule("viewMonth");
  window.scrollTo({ top: 0 });
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
  bindWorkoutHeroDetails(content);
  const records = document.getElementById("workoutMonthRecords");
  records.innerHTML = month.workouts.length
    ? month.workouts.map(renderWorkoutRecord).join("")
    : '<span style="font-size: 0.8rem; color: #8b949e">Nenhum treino registrado neste mês ainda.</span>';
  records.onclick = handleWorkoutRecordClick;
}

function renderWorkoutScreen() {
  const workouts = [...healthDb.workouts].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  const today = new Date();
  const currentMonthKey = getWorkoutMonthKey(getLocalDateInputValue(today));
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
  document.getElementById("workoutMonthTitle").innerText =
    `🏋️ ${monthShortLabel.charAt(0).toUpperCase()}${monthShortLabel.slice(1)}/${monthYear.slice(-2)}`;

  const saitama = currentMonth.saitama;
  const saitamaTotal = saitama.pushups + saitama.situps + saitama.squats;
  const summary = document.getElementById("workoutSummary");
  summary.innerHTML = `
    <button type="button" class="workout-summary-item workout-summary-item-wide" data-workout-metric="workouts" aria-haspopup="dialog">
      <span class="workout-summary-label">Treinos neste mês</span>
      <span class="workout-summary-value">${currentMonth.count} TREINOS <span class="workout-summary-duration">(${formatWorkoutNumber(currentMonth.durationMinutes, 0)} MINUTOS TREINANDO!)</span></span>
      <span class="workout-summary-secondary">Treinou em ${currentMonth.activeDays} de ${currentMonth.elapsedDays} dias · eficiência de ${formatWorkoutNumber(currentMonth.efficiency)}%</span>
    </button>
    <button type="button" class="workout-summary-item" data-workout-metric="calories" aria-haspopup="dialog">
      <span class="workout-summary-label">Calorias no mês</span>
      <span class="workout-summary-value">${formatWorkoutNumber(currentMonth.calories, 0)} kcal</span>
      <span class="workout-summary-secondary">Média: ${formatWorkoutNumber(dailyAverage(currentMonth.calories), 0)} kcal/dia</span>
    </button>
    <button type="button" class="workout-summary-item" data-workout-metric="distance" aria-haspopup="dialog">
      <span class="workout-summary-label">Distância no mês</span>
      <span class="workout-summary-value">${formatWorkoutNumber(currentMonth.distance, 2)} km</span>
      <span class="workout-summary-secondary">Média: ${formatWorkoutNumber(dailyAverage(currentMonth.distance), 2)} km/dia</span>
    </button>
    <button type="button" class="workout-summary-item" data-workout-metric="saitamaReps" aria-haspopup="dialog">
      <span class="workout-summary-label">👊 Saitama</span>
      <span class="workout-summary-value">${formatWorkoutNumber(saitamaTotal, 0)} reps</span>
      <span class="workout-summary-secondary">Abd ${formatWorkoutNumber(saitama.situps, 0)} · Flex ${formatWorkoutNumber(saitama.pushups, 0)} · Agach ${formatWorkoutNumber(saitama.squats, 0)}</span>
    </button>
    <button type="button" class="workout-summary-item" data-workout-metric="lifted" aria-haspopup="dialog">
      <span class="workout-summary-label">🏋️ Peso levantado</span>
      <span class="workout-summary-value">${formatWorkoutNumber(currentMonth.lift.kg, 0)} kg</span>
      <span class="workout-summary-secondary">em ${formatWorkoutNumber(currentMonth.lift.reps, 0)} repetições</span>
    </button>
  `;
  summary.onclick = (event) => {
    const metricCard = event.target.closest("[data-workout-metric]");
    if (metricCard) openWorkoutChart(metricCard.dataset.workoutMetric);
  };

  const heroContent = document.getElementById("workoutHallContent");
  heroContent.innerHTML = renderWorkoutHeroCards(allTimeStats, workouts.length, {
    intro: "O shape não veio por carta registrada. Olha o que você já construiu:",
  });
  bindWorkoutHeroDetails(heroContent);

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
        <button type="button" class="workout-month-card" data-workout-month="${monthKey}" aria-label="Abrir ${formatWorkoutMonth(monthKey)}">
          <span class="workout-month-card-head">
            <span class="workout-month-title">${formatWorkoutMonth(monthKey)}</span>
            ${monthKey === currentMonthKey ? '<span class="workout-badge">Atual</span>' : ""}
            <span class="workout-chevron" aria-hidden="true">›</span>
          </span>
          <span class="workout-record-chips">${chips.map((chip) => `<span class="workout-chip">${chip}</span>`).join("")}</span>
        </button>
      `;
    })
    .join("");
  history.onclick = (event) => {
    const monthCard = event.target.closest("[data-workout-month]");
    if (monthCard) openWorkoutMonth(monthCard.dataset.workoutMonth);
  };

  renderWorkoutMonth(workouts, today);
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
      description: "Carga × séries × repetições somadas em cada dia.",
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
    const dateKey = getLocalDateInputValue(date);
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
    `Semana de ${formatWorkoutDate(getLocalDateInputValue(days[0].date))} a ${formatWorkoutDate(getLocalDateInputValue(days[6].date))} · unidade: ${selectedMetric.unit}`;
  document.getElementById("workoutChartModal").classList.add("active");
}

function closeWorkoutChart() {
  document.getElementById("workoutChartModal").classList.remove("active");
}

let selectedWorkoutType = "";

let editingWorkoutId = null;

function openWorkoutModal() {
  selectedWorkoutType = "";
  hideStrengthPanel();
  editingWorkoutId = null;
  document.getElementById("workoutModalTitle").innerText =
    "🏋️ Registrar treino";
  document.getElementById("workoutTypePicker").style.display = "block";
  document.getElementById("workoutForm").style.display = "none";
  document.getElementById("workoutModal").classList.add("active");
}

function closeWorkoutModal() {
  hideStrengthPanel();
  document.getElementById("workoutModal").classList.remove("active");
}

function backToWorkoutTypes() {
  selectedWorkoutType = "";
  hideStrengthPanel();
  document.getElementById("workoutTypePicker").style.display = "block";
  document.getElementById("workoutForm").style.display = "none";
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
      <input id="workout-date" class="form-control" type="date" required value="${getLocalDateInputValue()}" />
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
          <input id="workout-date" class="form-control" type="date" required value="${getLocalDateInputValue()}" />
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
          <input id="workout-date" class="form-control" type="date" required value="${getLocalDateInputValue()}" />
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
  document.getElementById("workoutTypePicker").style.display = "none";
  document.getElementById("workoutFormFields").innerHTML = form.fields;
  document.getElementById("workoutForm").style.display = "block";
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
    document.getElementById("workoutModal").classList.add("active");
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

  document.getElementById("workoutModal").classList.add("active");
}

function readWorkoutNumber(id) {
  const value = document.getElementById(`workout-${id}`)?.value;
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function saveWorkout(event) {
  event.preventDefault();
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
  editingWorkoutId = null;
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

/* NAVEGAÇÃO ENTRE AS TELAS DO MÓDULO (Treinos / Hall do Herói) */
function openModule(viewId) {
  document
    .querySelectorAll(".view-section")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  if (["viewTraining", "viewHero", "viewMonth"].includes(viewId)) renderWorkoutScreen();
}

function onHealthDataReplaced() {
  renderWorkoutScreen();
}

initTobaDecimalMasks();
openModule("viewTraining");
