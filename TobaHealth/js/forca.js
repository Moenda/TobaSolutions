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
 * Carregado ANTES de treinos.js; só usa funções de treinos.js dentro de
 * funções (nunca na carga do arquivo).
 * ===================================================================== */

const STRENGTH_GROUPS = [
  { id: "peito", name: "Peito" },
  { id: "costas", name: "Costas" },
  { id: "ombros", name: "Ombros" },
  { id: "biceps", name: "Bíceps" },
  { id: "triceps", name: "Tríceps" },
  { id: "quadriceps", name: "Quadríceps" },
  { id: "posterior", name: "Posterior de coxa" },
  { id: "gluteos", name: "Glúteos" },
  { id: "panturrilha", name: "Panturrilha" },
  { id: "abdomen", name: "Abdômen" },
];

const STRENGTH_EXERCISES = [
  // Peito
  { id: "supino-reto-barra", name: "Supino reto (barra)", group: "peito" },
  { id: "supino-reto-halter", name: "Supino reto (halteres)", group: "peito" },
  { id: "supino-inclinado-barra", name: "Supino inclinado (barra)", group: "peito" },
  { id: "supino-inclinado-halter", name: "Supino inclinado (halteres)", group: "peito" },
  { id: "supino-declinado", name: "Supino declinado", group: "peito" },
  { id: "supino-maquina", name: "Supino na máquina", group: "peito" },
  { id: "crucifixo-halter", name: "Crucifixo (halteres)", group: "peito" },
  { id: "crossover", name: "Crossover (polia)", group: "peito" },
  { id: "peck-deck", name: "Peck deck (voador)", group: "peito" },
  { id: "flexao", name: "Flexão de braço", group: "peito" },
  // Costas
  { id: "puxada-frente", name: "Puxada frontal (pulley)", group: "costas" },
  { id: "puxada-triangulo", name: "Puxada com triângulo", group: "costas" },
  { id: "barra-fixa", name: "Barra fixa", group: "costas" },
  { id: "remada-curvada", name: "Remada curvada (barra)", group: "costas" },
  { id: "remada-baixa", name: "Remada baixa (polia)", group: "costas" },
  { id: "remada-unilateral", name: "Remada unilateral (halter)", group: "costas" },
  { id: "remada-maquina", name: "Remada na máquina", group: "costas" },
  { id: "pulldown", name: "Pulldown (braço reto)", group: "costas" },
  { id: "terra", name: "Levantamento terra", group: "costas" },
  // Ombros
  { id: "desenvolvimento-halter", name: "Desenvolvimento (halteres)", group: "ombros" },
  { id: "desenvolvimento-barra", name: "Desenvolvimento militar (barra)", group: "ombros" },
  { id: "desenvolvimento-maquina", name: "Desenvolvimento na máquina", group: "ombros" },
  { id: "elevacao-lateral", name: "Elevação lateral", group: "ombros" },
  { id: "elevacao-frontal", name: "Elevação frontal", group: "ombros" },
  { id: "crucifixo-inverso", name: "Crucifixo inverso", group: "ombros" },
  { id: "encolhimento", name: "Encolhimento (trapézio)", group: "ombros" },
  { id: "face-pull", name: "Face pull", group: "ombros" },
  // Bíceps
  { id: "rosca-direta", name: "Rosca direta (barra)", group: "biceps" },
  { id: "rosca-alternada", name: "Rosca alternada (halteres)", group: "biceps" },
  { id: "rosca-martelo", name: "Rosca martelo", group: "biceps" },
  { id: "rosca-scott", name: "Rosca Scott", group: "biceps" },
  { id: "rosca-concentrada", name: "Rosca concentrada", group: "biceps" },
  { id: "rosca-polia", name: "Rosca na polia", group: "biceps" },
  // Tríceps
  { id: "triceps-pulley-corda", name: "Tríceps pulley (corda)", group: "triceps" },
  { id: "triceps-pulley-barra", name: "Tríceps pulley (barra)", group: "triceps" },
  { id: "triceps-testa", name: "Tríceps testa", group: "triceps" },
  { id: "triceps-frances", name: "Tríceps francês", group: "triceps" },
  { id: "triceps-coice", name: "Tríceps coice", group: "triceps" },
  { id: "mergulho", name: "Mergulho (paralelas)", group: "triceps" },
  { id: "supino-fechado", name: "Supino fechado", group: "triceps" },
  // Quadríceps
  { id: "agachamento-livre", name: "Agachamento livre", group: "quadriceps" },
  { id: "agachamento-smith", name: "Agachamento no Smith", group: "quadriceps" },
  { id: "agachamento-hack", name: "Agachamento hack", group: "quadriceps" },
  { id: "agachamento-bulgaro", name: "Agachamento búlgaro", group: "quadriceps" },
  { id: "leg-press", name: "Leg press 45°", group: "quadriceps" },
  { id: "cadeira-extensora", name: "Cadeira extensora", group: "quadriceps" },
  { id: "afundo", name: "Afundo / passada", group: "quadriceps" },
  // Posterior de coxa
  { id: "mesa-flexora", name: "Mesa flexora", group: "posterior" },
  { id: "cadeira-flexora", name: "Cadeira flexora", group: "posterior" },
  { id: "stiff", name: "Stiff", group: "posterior" },
  // Glúteos
  { id: "elevacao-pelvica", name: "Elevação pélvica", group: "gluteos" },
  { id: "cadeira-abdutora", name: "Cadeira abdutora", group: "gluteos" },
  { id: "gluteo-polia", name: "Glúteo na polia", group: "gluteos" },
  { id: "gluteo-maquina", name: "Glúteo na máquina (coice)", group: "gluteos" },
  // Panturrilha
  { id: "panturrilha-pe", name: "Panturrilha em pé", group: "panturrilha" },
  { id: "panturrilha-sentado", name: "Panturrilha sentado", group: "panturrilha" },
  { id: "panturrilha-leg", name: "Panturrilha no leg press", group: "panturrilha" },
  // Abdômen
  { id: "abdominal-crunch", name: "Abdominal (crunch)", group: "abdomen" },
  { id: "abdominal-infra", name: "Abdominal infra (elevação de pernas)", group: "abdomen" },
  { id: "abdominal-polia", name: "Abdominal na polia", group: "abdomen" },
  { id: "abdominal-maquina", name: "Abdominal na máquina", group: "abdomen" },
];

function getStrengthExercise(exerciseId) {
  return STRENGTH_EXERCISES.find((exercise) => exercise.id === exerciseId);
}

function getStrengthGroupName(groupId) {
  return STRENGTH_GROUPS.find((group) => group.id === groupId)?.name || groupId;
}

/* ---------------------------------------------------------------------
 * Cálculos
 * ------------------------------------------------------------------- */

// Peso levantado de um treino de força: soma de repetições × carga das
// séries com carga informada.
function getStrengthLift(workout) {
  const totals = { kg: 0, reps: 0, sets: 0 };
  (workout.exercises || []).forEach((exercise) => {
    (exercise.sets || []).forEach((set) => {
      const reps = Number(set.reps) || 0;
      const kg = Number(set.kg) || 0;
      if (reps > 0) totals.sets += 1;
      if (reps > 0 && kg > 0) {
        totals.kg += reps * kg;
        totals.reps += reps;
      }
    });
  });
  return totals;
}

// "3×10 · 60 kg" (séries iguais agrupadas) ou "10×60 kg / 8×62,5 kg"
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
    <li><span>${escapeWorkoutHtml(exercise.name)}</span><span class="workout-record-exercise-sets">${describeStrengthSets(exercise.sets)}</span></li>`).join("")}</ul>`;
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
  if (panel) panel.style.display = "none";
  strengthState = null;
}

function openStrengthPanel(workout = null) {
  document.getElementById("workoutTypePicker").style.display = "none";
  document.getElementById("workoutForm").style.display = "none";
  document.getElementById("strengthPanel").style.display = "block";

  if (workout) {
    strengthState = {
      step: "builder",
      editing: true,
      routineId: workout.routineId || "",
      name: workout.title || "",
      date: workout.date || getLocalDateInputValue(),
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
      date: getLocalDateInputValue(),
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
          <div class="strength-routine" role="button" tabindex="0" data-action="start-routine" data-routine="${escapeWorkoutHtml(routine.id)}">
            <div class="strength-routine-main">
              <strong>${escapeWorkoutHtml(routine.name)}</strong>
              <span class="strength-routine-groups">${escapeWorkoutHtml(groups.join(" · ") || "Sem exercícios")}</span>
              <span class="strength-routine-meta">${routine.exercises.length} ${routine.exercises.length === 1 ? "exercício" : "exercícios"} · feito ${stats.count}× ${stats.lastDate ? `· última vez ${formatWorkoutDate(stats.lastDate)}` : ""}</span>
            </div>
            <button type="button" class="workout-icon-btn workout-icon-btn-danger" data-action="delete-routine" data-routine="${escapeWorkoutHtml(routine.id)}" title="Apagar treino salvo" aria-label="Apagar treino salvo">${WORKOUT_ICON_DELETE}</button>
          </div>`;
      }).join("")
    : '<p class="strength-empty">Você ainda não salvou nenhum treino. Monte um e toque em <strong>Salvar treino</strong> para virar o seu Treino A, B, C... e o app passa a contar quantas vezes você fez.</p>';

  return `
    <button type="button" class="back-nav-btn" data-action="back-types" style="margin-bottom: 0.8rem">‹ Tipos de treino</button>
    <div class="hub-title">Seus treinos</div>
    <div class="strength-routines">${cards}</div>
    <div class="section-divider"></div>
    <button type="button" class="btn" data-action="new-workout">➕ Montar treino do zero</button>
  `;
}

function renderStrengthBuilder() {
  const state = strengthState;
  const groupChips = STRENGTH_GROUPS.map((group) => `
    <button type="button" class="strength-chip${state.activeGroup === group.id ? " active" : ""}" data-action="group" data-group="${group.id}">${group.name}</button>
  `).join("");

  const added = new Set(state.exercises.map((exercise) => exercise.exerciseId));
  const options = state.activeGroup
    ? STRENGTH_EXERCISES.filter((exercise) => exercise.group === state.activeGroup).map((exercise) => `
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
                <div class="strength-exercise-name">${exercise ? exercise.name : escapeWorkoutHtml(entry.exerciseId)}</div>
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
    ${state.editing ? "" : '<button type="button" class="back-nav-btn" data-action="back-routines" style="margin-bottom: 0.8rem">‹ Seus treinos</button>'}
    <div class="grid-2">
      <div class="form-group">
        <label for="strength-name">Nome do treino</label>
        <input id="strength-name" class="form-control" type="text" maxlength="40" placeholder="Ex: Treino A" value="${escapeWorkoutHtml(state.name)}" data-field="name" />
      </div>
      <div class="form-group">
        <label for="strength-date">Data</label>
        <input id="strength-date" class="form-control" type="date" value="${escapeWorkoutHtml(state.date)}" data-field="date" />
      </div>
    </div>

    <div class="hub-title">1. Grupo muscular</div>
    <div class="strength-chips">${groupChips}</div>
    <div class="hub-title" style="margin-top: 0.9rem">2. Exercício</div>
    <div class="strength-options">${options}</div>

    <div class="section-divider"></div>
    <div class="hub-title">Seu treino</div>
    ${exerciseCards}

    <div class="grid-2" style="margin-top: 0.9rem">
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
      <input id="strength-notes" class="form-control" type="text" maxlength="160" placeholder="Como foi o treino?" value="${escapeWorkoutHtml(state.notes)}" data-field="notes" />
    </div>

    <button type="button" class="btn btn-secondary" data-action="save-routine" style="margin-bottom: 0.6rem">💾 Salvar treino (para repetir depois)</button>
    <button type="button" class="btn" data-action="register-workout">${state.editing ? "Salvar alterações 💪" : "Registrar treino de hoje 💪"}</button>
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
  renderWorkoutScreen();
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
