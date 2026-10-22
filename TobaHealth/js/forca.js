/* =====================================================================
 * Toba Health · Treino de Força
 * Catálogo de exercícios por grupo muscular, montagem do treino,
 * treinos salvos (A, B, C...) e contagem de quantas vezes cada um foi feito.
 *
 * Dados (dentro do mesmo healthDb):
 *   healthDb.strengthRoutines = [{ id, name, exercises: [{ exerciseId, sets: [{reps, kg}] }] }]
 *   healthDb.workouts[] com type "strength":
 *     { ..., routineId, exercises: [{ exerciseId, name, group, sets: [{reps, kg}] }] }
 *   O grupo muscular fica gravado em cada exercício feito: é o que vai alimentar
 *   o mapa de calor do corpo no Hall do Herói.
 *
 *   healthDb.exerciseSettings = { [exerciseId]: { load: "total"|"perHand", unilateral: bool } }
 *     Tipo de carga escolhido pela pessoa (ausente = Total / bilateral). Vale
 *     para o histórico inteiro: mudou, os treinos daquele exercício recalculam.
 *
 * bodyweight (opcional no catálogo): parte do peso do corpo que o exercício
 * levanta. Cada repetição soma (carga + peso do corpo × bodyweight) no
 * "Peso levantado"; o peso do corpo vem de getBodyWeightOn() (treinos.js).
 *
 * Carregado ANTES de treinos.js; só usa funções de treinos.js dentro de
 * funções (nunca na carga do arquivo).
 * ===================================================================== */

// STRENGTH_GROUPS e STRENGTH_EXERCISES (o catálogo) moram em health-metrics.js:
// o portal também usa (perfil do jogador). Os ids continuam os mesmos.

function getStrengthExercise(exerciseId) {
  return STRENGTH_EXERCISES.find((exercise) => exercise.id === exerciseId);
}

function getStrengthGroupName(groupId) {
  return STRENGTH_GROUPS.find((group) => group.id === groupId)?.name || groupId;
}

/* ---------------------------------------------------------------------
 * Cálculos
 * ------------------------------------------------------------------- */

function getExerciseLoad(exerciseId) {
  return calcExerciseLoad(healthDb, exerciseId);
}

function describeExerciseLoad(exerciseId) {
  const load = getExerciseLoad(exerciseId);
  return `${load.perHand ? "Por halter" : "Total"}${load.unilateral ? " · unilateral" : ""}`;
}

// Peso levantado de um treino de força: soma de repetições × carga das
// séries com carga informada. É a ÚNICA conta de volume do app (Hall, resumo,
// página do treino, gráficos e mapa de calor passam por aqui).
// Por halter: a carga anotada é de uma mão, então dobra. Unilateral: as reps
// são por lado, então dobram (halter + unilateral = um halter por vez: só as reps).
function getStrengthLift(workout) {
  return calcStrengthLift(workout, healthDb); // conta em health-metrics.js
}

// "3×10 · 60 kg" (séries iguais agrupadas) ou "10×60 kg / 8×62,5 kg"
// Chip que abre a folha "Tipo de carga" do exercício.
function renderExerciseLoadChip(exerciseId) {
  return `<button type="button" class="strength-chip load-chip" data-click="openExerciseLoad" data-exercise="${escapeHtml(exerciseId)}">⚖️ ${describeExerciseLoad(exerciseId)}</button>`;
}

function openExerciseLoad(el) {
  const exerciseId = el.dataset.exercise;
  const load = getExerciseLoad(exerciseId);
  document.getElementById("exerciseLoadForm").dataset.exercise = exerciseId;
  document.getElementById("exerciseLoadName").textContent = getStrengthExercise(exerciseId)?.name || exerciseId;
  document.getElementById("exercise-load-type").value = load.perHand ? "perHand" : "total";
  document.getElementById("exercise-load-unilateral").checked = load.unilateral;
  openTobaModal("exerciseLoadModal");
}

function saveExerciseLoad(form) {
  if (!isHealthDbLoaded) {
    showHealthDbLockedMessage();
    return;
  }
  healthDb.exerciseSettings[form.dataset.exercise] = {
    load: document.getElementById("exercise-load-type").value === "perHand" ? "perHand" : "total",
    unilateral: document.getElementById("exercise-load-unilateral").checked,
  };
  saveHealthDb();
  closeTobaModal("exerciseLoadModal");
  if (isLiveViewActive()) renderLiveSession();
  else renderWorkoutScreen();
}

function describeStrengthSets(sets) {
  const groups = [];
  (sets || []).forEach((set) => {
    const reps = Number(set.reps) || 0;
    const kg = Number(set.kg) || 0;
    if (!reps) return;
    const last = groups[groups.length - 1];
    if (last && last.reps === reps && last.kg === kg) last.count += 1;
    else groups.push({ reps, kg, count: 1 });
  });
  const kgText = (kg) => (kg ? `${formatWorkoutNumber(kg, 1)} kg` : "peso do corpo");
  if (groups.length === 1) {
    return `${groups[0].count}×${groups[0].reps} · ${kgText(groups[0].kg)}`;
  }
  return groups
    .map((group) => `${group.count > 1 ? group.count + "×" : ""}${group.reps}×${kgText(group.kg)}`)
    .join(" / ");
}

// Etiquetas do registro (grupos, exercícios, séries, carga)
function getStrengthChips(workout) {
  const exercises = workout.exercises || [];
  const lift = getStrengthLift(workout);
  const chips = [...new Set(exercises.map((exercise) => exercise.group).filter(Boolean))].map(getStrengthGroupName);
  chips.push(`${exercises.length} ${exercises.length === 1 ? "exercício" : "exercícios"} · ${lift.sets} séries`);
  if (lift.kg > 0) chips.push(`💪 ${formatWorkoutNumber(lift.kg, 0)} kg levantados`);
  return chips;
}

// Lista "Supino reto · 3×10 · 60 kg" dentro do registro
function renderStrengthExerciseList(workout) {
  if (workout.type !== "strength" || !Array.isArray(workout.exercises) || !workout.exercises.length) return "";
  return `<ul class="workout-record-exercises">${workout.exercises.map((exercise) => `
    <li><span>${escapeHtml(exercise.name)}</span><span class="workout-record-exercise-sets">${describeStrengthSets(exercise.sets)}</span></li>`).join("")}</ul>`;
}

function getStrengthRoutineStats(routineId) {
  const done = healthDb.workouts
    .filter((workout) => workout.type === "strength" && workout.routineId === routineId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { count: done.length, lastDate: done[0]?.date || "", lastWorkout: done[0] || null };
}

// Últimas séries feitas num exercício (para já vir preenchido na próxima vez)
function getLastStrengthSets(exerciseId) {
  const workouts = healthDb.workouts
    .filter((workout) => Array.isArray(workout.exercises))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const workout of workouts) {
    const found = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    if (found && found.sets && found.sets.length) return found.sets;
  }
  return null;
}

/* ---------------------------------------------------------------------
 * Estado do montador
 * ------------------------------------------------------------------- */
let strengthState = null;

function newStrengthExercise(exerciseId, sets) {
  const last = sets || getLastStrengthSets(exerciseId);
  return {
    exerciseId,
    sets: last && last.length
      ? last.map((set) => ({ reps: Number(set.reps) || 0, kg: Number(set.kg) || 0 }))
      : [{ reps: 10, kg: 0 }, { reps: 10, kg: 0 }, { reps: 10, kg: 0 }],
  };
}

function hideStrengthPanel() {
  const panel = document.getElementById("strengthPanel");
  if (panel) panel.hidden = true;
  strengthState = null;
}

function openStrengthPanel(workout = null) {
  document.getElementById("workoutTypePicker").hidden = true;
  document.getElementById("workoutForm").hidden = true;
  document.getElementById("strengthPanel").hidden = false;

  if (workout) {
    strengthState = {
      step: "builder",
      editing: true,
      routineId: workout.routineId || "",
      name: workout.title || "",
      date: workout.date || toIsoDate(),
      duration: workout.durationMinutes ?? "",
      calories: workout.calories ?? "",
      notes: workout.notes || "",
      activeGroup: "",
      exercises: (workout.exercises || []).map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: (exercise.sets || []).map((set) => ({ reps: Number(set.reps) || 0, kg: Number(set.kg) || 0 })),
      })),
    };
  } else {
    strengthState = {
      step: "routines",
      editing: false,
      routineId: "",
      name: "",
      date: toIsoDate(),
      duration: "",
      calories: "",
      notes: "",
      activeGroup: "",
      exercises: [],
    };
  }
  renderStrengthPanel();
}

function startStrengthRoutine(routineId) {
  const routine = healthDb.strengthRoutines.find((item) => item.id === routineId);
  if (!routine) return;
  // Se o treino já foi feito, começa com as cargas da última vez (progressão)
  const previous = getStrengthRoutineStats(routineId).lastWorkout;
  strengthState.step = "builder";
  strengthState.routineId = routine.id;
  strengthState.name = routine.name;
  strengthState.exercises = routine.exercises
    .filter((exercise) => getStrengthExercise(exercise.exerciseId))
    .map((exercise) => {
      const lastTime = previous?.exercises?.find((item) => item.exerciseId === exercise.exerciseId);
      return newStrengthExercise(exercise.exerciseId, lastTime?.sets?.length ? lastTime.sets : exercise.sets);
    });
  strengthState.activeGroup = "";
  renderStrengthPanel();
}

/* ---------------------------------------------------------------------
 * Telas
 * ------------------------------------------------------------------- */
function renderStrengthPanel() {
  const state = strengthState;
  if (!state) return;
  const panel = document.getElementById("strengthPanel");
  document.getElementById("workoutModalTitle").innerText = state.editing
    ? "✏️ Editar treino de força"
    : "💪 Treino de força";
  panel.innerHTML = state.step === "routines" ? renderStrengthRoutines() : renderStrengthBuilder();
}

function renderStrengthRoutines() {
  const routines = healthDb.strengthRoutines;
  const cards = routines.length
    ? routines.map((routine) => {
        const stats = getStrengthRoutineStats(routine.id);
        const groups = [...new Set(routine.exercises
          .map((exercise) => getStrengthExercise(exercise.exerciseId)?.group)
          .filter(Boolean))].map(getStrengthGroupName);
        return `
          <div class="strength-routine" role="button" tabindex="0" data-action="start-routine" data-routine="${escapeHtml(routine.id)}">
            <div class="strength-routine-main">
              <strong>${escapeHtml(routine.name)}</strong>
              <span class="strength-routine-groups">${escapeHtml(groups.join(" · ") || "Sem exercícios")}</span>
              <span class="strength-routine-meta">${routine.exercises.length} ${routine.exercises.length === 1 ? "exercício" : "exercícios"} · feito ${stats.count}× ${stats.lastDate ? `· última vez ${formatWorkoutDate(stats.lastDate)}` : ""}</span>
            </div>
            <button type="button" class="workout-icon-btn workout-icon-btn-danger" data-action="delete-routine" data-routine="${escapeHtml(routine.id)}" title="Apagar treino salvo" aria-label="Apagar treino salvo">${WORKOUT_ICON_DELETE}</button>
          </div>`;
      }).join("")
    : '<p class="strength-empty">Você ainda não salvou nenhum treino. Monte um e toque em <strong>Salvar treino</strong> para virar o seu Treino A, B, C... e o app passa a contar quantas vezes você fez.</p>';

  return `
    <button type="button" class="back-nav-btn workout-back-types" data-action="back-types">‹ Tipos de treino</button>
    <div class="hub-title">Seus treinos</div>
    <div class="strength-routines">${cards}</div>
    <div class="section-divider"></div>
    <button type="button" class="btn btn-primary" data-action="new-workout">➕ Montar treino do zero</button>
  `;
}

function renderStrengthBuilder() {
  const state = strengthState;
  const groupChips = STRENGTH_GROUPS.map((group) => `
    <button type="button" class="strength-chip${state.activeGroup === group.id ? " active" : ""}" data-action="group" data-group="${group.id}">${group.name}</button>
  `).join("");

  const added = new Set(state.exercises.map((exercise) => exercise.exerciseId));
  const options = state.activeGroup
    ? getStrengthExercisesInGroup(state.activeGroup).map((exercise) => `
        <button type="button" class="strength-option${added.has(exercise.id) ? " added" : ""}" data-action="add-exercise" data-exercise="${exercise.id}" ${added.has(exercise.id) ? "disabled" : ""}>
          <span>${exercise.name}</span><span class="strength-option-mark">${added.has(exercise.id) ? "✓" : "+"}</span>
        </button>`).join("")
    : '<p class="strength-hint">Escolha um grupo muscular acima para ver os exercícios.</p>';

  const exerciseCards = state.exercises.length
    ? state.exercises.map((entry, index) => {
        const exercise = getStrengthExercise(entry.exerciseId);
        const last = getLastStrengthSets(entry.exerciseId);
        const rows = entry.sets.map((set, setIndex) => `
          <div class="strength-set-row">
            <span class="strength-set-label">${setIndex + 1}ª</span>
            <input type="number" class="form-control" inputmode="numeric" min="0" step="1" placeholder="reps" value="${set.reps || ""}" data-ex="${index}" data-set="${setIndex}" data-field="reps" aria-label="Repetições da série ${setIndex + 1}" />
            <input type="number" class="form-control" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${set.kg || ""}" data-ex="${index}" data-set="${setIndex}" data-field="kg" aria-label="Carga da série ${setIndex + 1} em kg" />
            <button type="button" class="workout-icon-btn workout-icon-btn-danger" data-action="remove-set" data-ex="${index}" data-set="${setIndex}" title="Remover série" aria-label="Remover série">✕</button>
          </div>`).join("");
        return `
          <div class="strength-exercise-card">
            <div class="strength-exercise-head">
              <div>
                <div class="strength-exercise-name">${exercise ? exercise.name : escapeHtml(entry.exerciseId)}</div>
                <div class="strength-exercise-group">${exercise ? getStrengthGroupName(exercise.group) : ""}${last ? ` · última vez ${describeStrengthSets(last)}` : ""}</div>
              </div>
              <button type="button" class="workout-icon-btn workout-icon-btn-danger" data-action="remove-exercise" data-ex="${index}" title="Tirar exercício" aria-label="Tirar exercício">${WORKOUT_ICON_DELETE}</button>
            </div>
            ${rows}
            <button type="button" class="btn btn-secondary strength-add-set" data-action="add-set" data-ex="${index}">+ Série</button>
          </div>`;
      }).join("")
    : '<p class="strength-hint">Nenhum exercício ainda. Escolha um grupo e toque nos exercícios para montar o treino.</p>';

  return `
    ${state.editing ? "" : '<button type="button" class="back-nav-btn workout-back-types" data-action="back-routines">‹ Seus treinos</button>'}
    <div class="grid-2">
      <div class="form-group">
        <label for="strength-name">Nome do treino</label>
        <input id="strength-name" class="form-control" type="text" maxlength="40" placeholder="Ex: Treino A" value="${escapeHtml(state.name)}" data-field="name" />
      </div>
      <div class="form-group">
        <label for="strength-date">Data</label>
        <input id="strength-date" class="form-control" type="date" value="${escapeHtml(state.date)}" data-field="date" />
      </div>
    </div>

    <div class="hub-title">1. Grupo muscular</div>
    <div class="strength-chips">${groupChips}</div>
    <div class="hub-title strength-step-title">2. Exercício</div>
    <div class="strength-options">${options}</div>

    <div class="section-divider"></div>
    <div class="hub-title">Seu treino</div>
    ${exerciseCards}

    <div class="grid-2 strength-step-title">
      <div class="form-group">
        <label for="strength-duration">Duração (min)</label>
        <input id="strength-duration" class="form-control" type="number" inputmode="numeric" min="0" step="1" value="${state.duration}" data-field="duration" />
      </div>
      <div class="form-group">
        <label for="strength-calories">Calorias (kcal)</label>
        <input id="strength-calories" class="form-control" type="number" inputmode="numeric" min="0" step="1" value="${state.calories}" data-field="calories" />
      </div>
    </div>
    <div class="form-group">
      <label for="strength-notes">Observações (opcional)</label>
      <input id="strength-notes" class="form-control" type="text" maxlength="160" placeholder="Como foi o treino?" value="${escapeHtml(state.notes)}" data-field="notes" />
    </div>

    <div class="toba-sheet-footer">
      <div class="btn-row">
        <button type="button" class="btn btn-secondary btn-grow-1" data-action="save-routine">💾 Salvar modelo</button>
        <button type="button" class="btn btn-primary btn-grow-2" data-action="register-workout">${state.editing ? "Salvar 💪" : "Registrar treino 💪"}</button>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
function saveStrengthRoutine() {
  const state = strengthState;
  const name = state.name.trim();
  if (!name) {
    showPageMessage("Dê um nome ao treino (por exemplo: Treino A) para poder salvar.", { title: "Falta o nome" });
    return;
  }
  const exercises = state.exercises
    .filter((entry) => entry.sets.some((set) => Number(set.reps) > 0))
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: entry.sets.filter((set) => Number(set.reps) > 0).map((set) => ({ reps: Number(set.reps), kg: Number(set.kg) || 0 })),
    }));
  if (!exercises.length) {
    showPageMessage("Adicione pelo menos um exercício com repetições para salvar o treino.", { title: "Treino vazio" });
    return;
  }
  const existing = healthDb.strengthRoutines.find(
    (routine) => routine.id === state.routineId || routine.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    existing.name = name;
    existing.exercises = exercises;
    state.routineId = existing.id;
  } else {
    const routine = { id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, exercises };
    healthDb.strengthRoutines.push(routine);
    state.routineId = routine.id;
  }
  saveHealthDb();
  showPageMessage(`"${name}" salvo! Na próxima vez é só abrir Treino de força e tocar nele.`, { title: "Treino salvo" });
}

function registerStrengthWorkout() {
  const state = strengthState;
  const exercises = state.exercises
    .map((entry) => {
      const exercise = getStrengthExercise(entry.exerciseId);
      return {
        exerciseId: entry.exerciseId,
        name: exercise ? exercise.name : entry.exerciseId,
        group: exercise ? exercise.group : "",
        sets: entry.sets
          .filter((set) => Number(set.reps) > 0)
          .map((set) => ({ reps: Number(set.reps), kg: Number(set.kg) || 0 })),
      };
    })
    .filter((exercise) => exercise.sets.length);
  if (!state.date) {
    showPageMessage("Informe a data do treino.", { title: "Falta a data" });
    return;
  }
  if (!exercises.length) {
    showPageMessage("Adicione pelo menos um exercício com repetições para registrar o treino.", { title: "Treino vazio" });
    return;
  }
  const toNumber = (value) => {
    const number = Number(value);
    return value !== "" && Number.isFinite(number) && number > 0 ? number : null;
  };
  const workout = {
    id: editingWorkoutId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "strength",
    title: state.name.trim() || "Treino de força",
    date: state.date,
    durationMinutes: toNumber(state.duration),
    calories: toNumber(state.calories),
    distanceKm: null,
    pushups: null,
    situps: null,
    squats: null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: state.notes.trim(),
    routineId: state.routineId || "",
    exercises,
  };
  const isNew = !editingWorkoutId;
  if (editingWorkoutId) {
    const index = healthDb.workouts.findIndex((item) => String(item.id) === String(editingWorkoutId));
    if (index === -1) return;
    healthDb.workouts[index] = workout;
  } else {
    healthDb.workouts.push(workout);
  }
  editingWorkoutId = null;
  saveHealthDb();
  hideStrengthPanel();
  closeWorkoutModal();
  if (isNew) tobaPlayerCheck({ reason: "Treino de força registrado 💪" });
  renderWorkoutScreen();
  if (isNew) openStrengthSummary(workout.id, "viewTraining");
}

/* ---------------------------------------------------------------------
 * Resumo do treino (tela pensada para printar e compartilhar)
 * Recordes: compara com os treinos de força até a data deste (sem ele).
 * ------------------------------------------------------------------- */
let strengthSummaryReturnView = "viewTraining";

// Melhor série: maior carga; com a mesma carga, mais repetições.
function getBestStrengthSet(sets) {
  let best = null;
  (sets || []).forEach((set) => {
    const reps = Number(set.reps) || 0;
    const kg = Number(set.kg) || 0;
    if (!reps) return;
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { reps, kg };
  });
  return best;
}

function isBetterStrengthSet(a, b) {
  return a.kg > b.kg || (a.kg === b.kg && a.reps > b.reps);
}

function getStrengthRecords(workout) {
  const previous = healthDb.workouts.filter(
    (item) => Array.isArray(item.exercises) &&
      String(item.id) !== String(workout.id) &&
      String(item.date) <= String(workout.date),
  );
  const records = [];
  const firsts = [];
  (workout.exercises || []).forEach((exercise) => {
    const best = getBestStrengthSet(exercise.sets);
    if (!best) return;
    let before = null;
    previous.forEach((item) => {
      item.exercises
        .filter((done) => done.exerciseId === exercise.exerciseId)
        .forEach((done) => {
          const set = getBestStrengthSet(done.sets);
          if (set && (!before || isBetterStrengthSet(set, before))) before = set;
        });
    });
    if (!before) firsts.push(exercise.name);
    else if (isBetterStrengthSet(best, before)) records.push({ name: exercise.name, best, before });
  });
  return { records, firsts };
}

function describeBestSet(set) {
  return set.kg ? `${formatWorkoutNumber(set.kg, 1)} kg × ${set.reps}` : `${set.reps} reps`;
}

function renderStrengthSummary(workout) {
  const lift = getStrengthLift(workout);
  const exercises = workout.exercises || [];
  const totalReps = exercises.reduce(
    (sum, exercise) => sum + (exercise.sets || []).reduce((acc, set) => acc + (Number(set.reps) || 0), 0),
    0,
  );
  const { records, firsts } = getStrengthRecords(workout);
  const groups = [...new Set(exercises.map((exercise) => exercise.group).filter(Boolean))].map(getStrengthGroupName);
  const weekday = new Date(`${workout.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  const equivalent = [...WORKOUT_LIFT_EQUIVALENTS].reverse().find((item) => lift.kg >= item.size);

  const lastSame = workout.routineId
    ? healthDb.workouts
        .filter((item) => item.type === "strength" &&
          item.routineId === workout.routineId &&
          String(item.id) !== String(workout.id) &&
          String(item.date) <= String(workout.date))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    : null;
  let comparison = "";
  if (lastSame && lift.kg > 0) {
    const lastKg = getStrengthLift(lastSame).kg;
    const diff = lift.kg - lastKg;
    if (lastKg > 0 && Math.round(diff) !== 0) {
      const pct = (diff / lastKg) * 100;
      comparison = `<div class="ss-compare ${diff > 0 ? "is-up" : "is-down"}">${diff > 0 ? "📈" : "📉"} ${diff > 0 ? "+" : ""}${formatWorkoutNumber(diff, 0)} kg (${diff > 0 ? "+" : ""}${formatWorkoutNumber(pct, 1)}%) vs. a última vez em ${formatWorkoutDate(lastSame.date)}</div>`;
    }
  }

  const stat = (value, label) => `<div class="ss-stat"><strong>${value}</strong><span>${label}</span></div>`;
  const stats = [
    stat(exercises.length, exercises.length === 1 ? "exercício" : "exercícios"),
    stat(lift.sets, "séries"),
    stat(formatWorkoutNumber(totalReps, 0), "reps"),
  ];
  if (workout.durationMinutes) stats.push(stat(formatWorkoutNumber(workout.durationMinutes, 0), "min"));
  if (workout.calories) stats.push(stat(formatWorkoutNumber(workout.calories, 0), "kcal"));

  const recordsHtml = records.length
    ? `<ul class="ss-records">${records.map((record) => `
        <li>
          <span class="ss-record-name">🏅 ${escapeHtml(record.name)}</span>
          <span class="ss-record-value">${describeBestSet(record.best)}<small>antes: ${describeBestSet(record.before)}</small></span>
        </li>`).join("")}</ul>`
    : `<p class="ss-empty">${firsts.length === exercises.length ? "Primeiro registro desses exercícios: agora tem recorde pra bater." : "Sem recorde hoje. Constância também é vitória."}</p>`;

  return `
    <div class="strength-summary">
      <div class="ss-top">
        <span class="ss-badge">💪 Treino concluído</span>
        <h2 class="ss-title">${escapeHtml(workout.title)}</h2>
        <span class="ss-date">${formatWorkoutDate(workout.date)} · ${weekday}</span>
        ${groups.length ? `<div class="ss-groups">${groups.map((group) => `<span>${group}</span>`).join("")}</div>` : ""}
      </div>
      <div class="ss-hero">
        <span class="ss-hero-label">${lift.kg > 0 ? "Peso levantado" : "Repetições"}</span>
        <strong class="ss-hero-value">${lift.kg > 0 ? `${formatWorkoutNumber(lift.kg, 0)} kg` : formatWorkoutNumber(totalReps, 0)}</strong>
        ${equivalent ? `<span class="ss-hero-eq">${equivalent.icon} ≈ ${formatWorkoutNumber(lift.kg / equivalent.size, 1)} ${lift.kg / equivalent.size < 2 ? equivalent.one : equivalent.name}</span>` : ""}
      </div>
      ${comparison}
      <div class="ss-stats">${stats.join("")}</div>
      <div class="ss-section">🏆 Recordes pessoais${records.length ? ` · ${records.length}` : ""}</div>
      ${recordsHtml}
      ${firsts.length && firsts.length < exercises.length ?`<p class="ss-firsts">🆕 Primeira vez: ${firsts.map(escapeHtml).join(", ")}</p>` : ""}
      <div class="ss-section">📋 Exercícios</div>
      <ul class="ss-exercises">${exercises.map((exercise) => `
        <li><span>${escapeHtml(exercise.name)}</span><span>${describeStrengthSets(exercise.sets)}</span></li>`).join("")}</ul>
      ${workout.notes ? `<p class="ss-notes">📝 ${escapeHtml(workout.notes)}</p>` : ""}
      <div class="ss-brand">⚡ TOBA HEALTH</div>
    </div>
    <p class="ss-hint">📸 Tira um print e manda no GymRats!</p>
    <button type="button" class="btn btn-primary" data-click="closeStrengthSummary">Fechar</button>
  `;
}

function openStrengthSummary(workoutId, returnView) {
  const workout = healthDb.workouts.find((item) => String(item.id) === String(workoutId));
  if (!workout || workout.type !== "strength") return;
  strengthSummaryReturnView =
    returnView || document.querySelector(".app-view.active")?.id || "viewTraining";
  document.getElementById("strengthSummaryContent").innerHTML = renderStrengthSummary(workout);
  openModule("viewSummary");
}

function closeStrengthSummary() {
  openModule(strengthSummaryReturnView);
}

async function deleteStrengthRoutine(routineId) {
  const routine = healthDb.strengthRoutines.find((item) => item.id === routineId);
  if (!routine) return;
  const confirmed = await showPageMessage(
    `Apagar o treino salvo "${routine.name}"? Os treinos que você já registrou continuam no histórico.`,
    { title: "Apagar treino salvo", confirm: true, confirmLabel: "Apagar" },
  );
  if (!confirmed) return;
  healthDb.strengthRoutines = healthDb.strengthRoutines.filter((item) => item.id !== routineId);
  saveHealthDb();
  if (strengthState) renderStrengthPanel();
}

function handleStrengthClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !strengthState) return;
  const state = strengthState;
  const action = target.dataset.action;
  const exIndex = Number(target.dataset.ex);
  const setIndex = Number(target.dataset.set);

  if (action === "delete-routine") {
    event.stopPropagation();
    deleteStrengthRoutine(target.dataset.routine);
    return;
  }
  if (action === "start-routine") return startStrengthRoutine(target.dataset.routine);
  if (action === "new-workout") {
    state.step = "builder";
    return renderStrengthPanel();
  }
  if (action === "back-types") {
    hideStrengthPanel();
    return backToWorkoutTypes();
  }
  if (action === "back-routines") {
    state.step = "routines";
    state.routineId = "";
    state.exercises = [];
    state.name = "";
    return renderStrengthPanel();
  }
  if (action === "group") {
    state.activeGroup = state.activeGroup === target.dataset.group ? "" : target.dataset.group;
    return renderStrengthPanel();
  }
  if (action === "add-exercise") {
    state.exercises.push(newStrengthExercise(target.dataset.exercise));
    return renderStrengthPanel();
  }
  if (action === "remove-exercise") {
    state.exercises.splice(exIndex, 1);
    return renderStrengthPanel();
  }
  if (action === "add-set") {
    const sets = state.exercises[exIndex].sets;
    const last = sets[sets.length - 1] || { reps: 10, kg: 0 };
    sets.push({ reps: last.reps, kg: last.kg });
    return renderStrengthPanel();
  }
  if (action === "remove-set") {
    state.exercises[exIndex].sets.splice(setIndex, 1);
    return renderStrengthPanel();
  }
  if (action === "save-routine") return saveStrengthRoutine();
  if (action === "register-workout") return registerStrengthWorkout();
}

function handleStrengthInput(event) {
  const input = event.target;
  const state = strengthState;
  if (!state || !input.dataset.field) return;
  if (input.dataset.ex !== undefined) {
    state.exercises[Number(input.dataset.ex)].sets[Number(input.dataset.set)][input.dataset.field] =
      input.value === "" ? 0 : Number(input.value);
    return;
  }
  const map = { name: "name", date: "date", duration: "duration", calories: "calories", notes: "notes" };
  if (map[input.dataset.field]) state[map[input.dataset.field]] = input.value;
}

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("strengthPanel");
  if (!panel) return;
  panel.addEventListener("click", handleStrengthClick);
  panel.addEventListener("input", handleStrengthInput);
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest('[data-action="start-routine"]');
    if (card && event.target === card) {
      event.preventDefault();
      startStrengthRoutine(card.dataset.routine);
    }
  });
});
