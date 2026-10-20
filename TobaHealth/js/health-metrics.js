/* =====================================================================
 * Toba Health · resumo do mês para o portal (card do Toba Health)
 * - Só lê o banco recebido; não grava nada e não depende de health-core.js
 *   (o portal carrega este arquivo sozinho, depois do toba-common.js).
 * - Treinos do mês seguem a MESMA regra de getWorkoutMonthStats (treinos.js):
 *   treinos do mês até hoje; flexão/abdominal/agachamento só do Saitama.
 *   Mudou a regra lá? Mude aqui também, senão o card e a tela não batem.
 * - Peso levantado fica de fora do card (o perfil do jogador usa).
 *
 * Também mora aqui (desde v1.40) o que precisa dar o MESMO número no portal
 * (perfil do jogador, toba-player.js) e na tela de Treinos:
 * - Catálogo de força (STRENGTH_GROUPS / STRENGTH_EXERCISES): os ids são
 *   referência gravada nos treinos; nunca renomeie nem remova um id.
 * - Escalas do Hall do Herói (cidades e pesos): o id de cada item é a
 *   conquista do perfil; nunca troque um id.
 * - Conta do peso levantado (calcStrengthLift / calcWorkoutLift): forca.js e
 *   treinos.js só chamam estas funções passando o healthDb.
 * Carregue ANTES de hall.js / forca.js / treinos.js.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * Catálogo de força
 * bodyweight (opcional): parte do peso do corpo que o exercício levanta.
 * ------------------------------------------------------------------- */
const STRENGTH_GROUPS = [
  { id: "peito", name: "Peito" },
  { id: "costas", name: "Costas" },
  { id: "ombros", name: "Ombros" },
  { id: "biceps", name: "Bíceps" },
  { id: "triceps", name: "Tríceps" },
  { id: "antebraco", name: "Antebraço" },
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
  { id: "flexao", name: "Flexão de braço", group: "peito", bodyweight: 0.64 },
  // Costas
  { id: "puxada-frente", name: "Puxada frontal (pulley)", group: "costas" },
  { id: "puxada-triangulo", name: "Puxada com triângulo", group: "costas" },
  { id: "barra-fixa", name: "Barra fixa", group: "costas", bodyweight: 0.95 },
  { id: "remada-curvada", name: "Remada curvada (barra)", group: "costas" },
  { id: "remada-baixa", name: "Remada baixa normal (polia)", group: "costas" },
  { id: "remada-baixa-unilateral", name: "Remada baixa unilateral (polia)", group: "costas" },
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
  { id: "mergulho", name: "Mergulho (paralelas)", group: "triceps", bodyweight: 0.9 },
  { id: "supino-fechado", name: "Supino fechado", group: "triceps" },
  // Antebraço
  { id: "rosca-punho", name: "Rosca de punho (flexão)", group: "antebraco" },
  { id: "rosca-punho-inversa", name: "Rosca de punho inversa (extensão)", group: "antebraco" },
  { id: "rosca-inversa", name: "Rosca inversa (pegada pronada)", group: "antebraco" },
  { id: "rosca-zottman", name: "Rosca Zottman", group: "antebraco" },
  { id: "rolo-punho", name: "Rolo de punho", group: "antebraco" },
  // Quadríceps
  { id: "agachamento-livre", name: "Agachamento livre", group: "quadriceps" },
  { id: "agachamento-corpo", name: "Agachamento (peso do corpo)", group: "quadriceps", bodyweight: 0.7 },
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
  { id: "abdominal-crunch", name: "Abdominal (crunch)", group: "abdomen", bodyweight: 0.3 },
  { id: "abdominal-infra", name: "Abdominal infra (elevação de pernas)", group: "abdomen", bodyweight: 0.3 },
  { id: "abdominal-polia", name: "Abdominal na polia", group: "abdomen" },
  { id: "abdominal-maquina", name: "Abdominal na máquina", group: "abdomen" },
];

const WORKOUT_DISTANCE_DESTINATIONS = [
  { id: "km-rio", icon: "🏖️", size: 360, label: "São Paulo → Rio de Janeiro", done: "foi de São Paulo ao Rio de Janeiro", note: "Com direito a biscoito Globo e farofa na areia." },
  { id: "km-buenos-aires", icon: "🧉", size: 1680, label: "São Paulo → Buenos Aires", done: "foi de São Paulo a Buenos Aires", note: "Alfajor, empanada e nenhuma conversa sobre o placar." },
  { id: "km-manaus", icon: "🌴", size: 2690, label: "São Paulo → Manaus", done: "foi de São Paulo a Manaus", note: "Repelente não é opcional." },
  { id: "km-nova-york", icon: "🗽", size: 7690, label: "São Paulo → Nova York", done: "foi de São Paulo a Nova York", note: "Pizza de rua e crise de identidade." },
  { id: "km-lisboa", icon: "🥐", size: 7940, label: "São Paulo → Lisboa", done: "foi de São Paulo a Lisboa", note: "Pastel de nata na chegada. Pode pedir o segundo." },
  { id: "km-madri", icon: "💃", size: 8390, label: "São Paulo → Madri", done: "foi de São Paulo a Madri", note: "Jantar só começa às 22h, vai se acostumando." },
  { id: "km-dubai", icon: "🏜️", size: 12220, label: "São Paulo → Dubai", done: "foi de São Paulo a Dubai", note: "O calor de lá faz o treino parecer sauna." },
  { id: "km-pequim", icon: "🥢", size: 17750, label: "São Paulo → Pequim", done: "foi de São Paulo a Pequim", note: "Com pato laqueado de recompensa." },
  { id: "km-toquio", icon: "🍣", size: 18550, label: "São Paulo → Tóquio", done: "foi de São Paulo a Tóquio", note: "Lá o temaki é de verdade, sem mini." },
  { id: "km-mundo", icon: "🌍", size: 40075, label: "Uma volta ao mundo", done: "deu a volta ao mundo", note: "Magalhães ficaria com inveja." },
];

const WORKOUT_LIFT_EQUIVALENTS = [
  { id: "lift-gato", icon: "🐈", one: "gato", name: "gatos", size: 4, note: "Levantado sem ele aprovar." },
  { id: "lift-caramelo", icon: "🐕", one: "cachorro caramelo", name: "cachorros caramelo", size: 12, note: "O patrimônio nacional, no supino." },
  { id: "lift-pessoa", icon: "🧍", one: "pessoa adulta", name: "pessoas adultas", size: 75, note: "Sem reclamar de ninguém." },
  { id: "lift-moto", icon: "🏍️", one: "moto CG", name: "motos CG", size: 115, note: "Entrega por aplicativo, só que no ar." },
  { id: "lift-leao", icon: "🦁", one: "leão", name: "leões", size: 190, note: "E ele nem rugiu." },
  { id: "lift-piano", icon: "🎹", one: "piano de cauda", name: "pianos de cauda", size: 500, note: "Música para os ouvidos, dor para a coluna." },
  { id: "lift-fusca", icon: "🚗", one: "Fusca", name: "Fuscas", size: 830, note: "Sem a mudança de casa dentro." },
  { id: "lift-hipopotamo", icon: "🦛", one: "hipopótamo", name: "hipopótamos", size: 1500, note: "Parece fofo, pesa uma tonelada e meia." },
  { id: "lift-elefante", icon: "🐘", one: "elefante", name: "elefantes", size: 5500, note: "A tromba não ajuda." },
  { id: "lift-onibus", icon: "🚌", one: "ônibus urbano", name: "ônibus urbanos", size: 12000, note: "Vazio, mas a lotação já saiu na foto." },
  { id: "lift-boeing", icon: "✈️", one: "Boeing 747 (vazio)", name: "Boeings 747 (vazios)", size: 180000, note: "Decolagem por sua conta e risco." },
  { id: "lift-liberdade", icon: "🗽", one: "Estátua da Liberdade", name: "Estátuas da Liberdade", size: 204000, note: "Tocha inclusa." },
  { id: "lift-cristo", icon: "🙌", one: "Cristo Redentor", name: "Cristos Redentores", size: 635000, note: "De braços abertos, mas agora quem abraça é você." },
  { id: "lift-eiffel", icon: "🗼", one: "Torre Eiffel", name: "Torres Eiffel", size: 10100000, note: "Paris que me perdoe, mas a torre veio junto." },
  { id: "lift-titanic", icon: "🚢", one: "Titanic", name: "Titanics", size: 52000000, note: "Sem iceberg, sem drama e sem Celine Dion." },
];

/* ---------------------------------------------------------------------
 * PESO LEVANTADO (só cálculo; nada é gravado, vale para treinos antigos)
 * - Musculação: carga × repetições das séries com carga; tipo de carga de
 *   exerciseSettings (por halter dobra a carga, unilateral dobra as reps).
 * - Peso do corpo: flexão/agachamento/abdominal (Saitama) e exercícios do
 *   catálogo com bodyweight somam reps × peso do corpo × fração. Peso do
 *   corpo = pesagem mais recente até a data do treino (padrão 75 kg).
 * ------------------------------------------------------------------- */
const BODYWEIGHT_DEFAULT_KG = 75;
// Campos soltos do treino Saitama -> exercício do catálogo (grupo muscular
// do mapa de calor) e parte do corpo levantada.
const BODYWEIGHT_FIELDS = {
  pushups: { exerciseId: "flexao", group: "peito", fraction: 0.64 }, // ~64% do corpo
  squats: { exerciseId: "agachamento-corpo", group: "quadriceps", fraction: 0.7 }, // ~70%
  situps: { exerciseId: "abdominal-crunch", group: "abdomen", fraction: 0.3 }, // ~30% (tronco)
};

function calcBodyWeightOn(healthData, dateStr) {
  const weighIns = (healthData?.weighIns || [])
    .filter((w) => w && Number(w.weight) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!weighIns.length) return BODYWEIGHT_DEFAULT_KG;
  const day = String(dateStr || "");
  const before = weighIns.filter((w) => String(w.date).slice(0, 10) <= day);
  // Treino antes da 1ª pesagem usa a 1ª pesagem
  return Number((before.length ? before[before.length - 1] : weighIns[0]).weight);
}

function calcExerciseLoad(healthData, exerciseId) {
  const saved = healthData?.exerciseSettings?.[exerciseId] || {};
  return { perHand: saved.load === "perHand", unilateral: saved.unilateral === true };
}

// Treino de força: { kg, reps, sets }. Por halter: a carga anotada é de uma
// mão, então dobra. Unilateral: as reps são por lado, então dobram (halter +
// unilateral = um halter por vez: só as reps).
function calcStrengthLift(workout, healthData) {
  const totals = { kg: 0, reps: 0, sets: 0 };
  let bodyKg = null;
  (workout.exercises || []).forEach((exercise) => {
    const fraction = STRENGTH_EXERCISES.find((item) => item.id === exercise.exerciseId)?.bodyweight || 0;
    if (fraction && bodyKg === null) bodyKg = calcBodyWeightOn(healthData, workout.date);
    const bodyPart = fraction ? bodyKg * fraction : 0;
    const load = calcExerciseLoad(healthData, exercise.exerciseId);
    const loadFactor = load.perHand && !load.unilateral ? 2 : 1;
    const repsFactor = load.unilateral ? 2 : 1;
    (exercise.sets || []).forEach((set) => {
      const reps = (Number(set.reps) || 0) * repsFactor;
      const kg = (Number(set.kg) || 0) * loadFactor + bodyPart;
      if (reps > 0) totals.sets += 1;
      if (reps > 0 && kg > 0) {
        totals.kg += reps * kg;
        totals.reps += reps;
      }
    });
  });
  return totals;
}

// Qualquer treino: { kg, reps } (força, personalizado antigo e peso do corpo).
function calcWorkoutLift(workout, healthData) {
  const body = { kg: 0, reps: 0 };
  const counts = Object.keys(BODYWEIGHT_FIELDS)
    .map((field) => [field, Number(workout[field]) || 0])
    .filter(([, count]) => count > 0);
  if (counts.length) {
    const bodyKg = calcBodyWeightOn(healthData, workout.date);
    counts.forEach(([field, count]) => {
      body.kg += count * bodyKg * BODYWEIGHT_FIELDS[field].fraction;
      body.reps += count;
    });
  }
  if (Array.isArray(workout.exercises)) {
    const strength = calcStrengthLift(workout, healthData);
    return { kg: strength.kg + body.kg, reps: strength.reps + body.reps };
  }
  const weight = Number(workout.weightKg) || 0;
  if (weight <= 0) return body;
  const sets = Math.max(Number(workout.sets) || 1, 1);
  const reps = Math.max(Number(workout.reps) || 1, 1);
  return { kg: weight * sets * reps + body.kg, reps: sets * reps + body.reps };
}

function calcHealthSummary(healthData, referenceDate = new Date()) {
  const data = healthData && typeof healthData === "object" ? healthData : {};
  const today = toIsoDate(referenceDate);
  const monthKey = today.slice(0, 7);
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  const num = (value) => Number(value) || 0;

  /* ---------- Pesagens ---------- */
  // Mais recente primeiro (mesma ordem da tela de Pesagem). Data igual: o
  // id maior (Date.now()) é o registro mais novo.
  const weighIns = (Array.isArray(data.weighIns) ? data.weighIns : [])
    .filter((w) => w && isIso(w.date) && num(w.weight) > 0 && w.date <= today)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || num(b.id) - num(a.id));
  const latest = weighIns[0] || null;
  const previous = weighIns[1] || null;
  // Base do mês: última pesagem antes do mês; sem ela, a primeira do mês.
  const beforeMonth = weighIns.find((w) => w.date < `${monthKey}-01`);
  const inMonth = weighIns.filter((w) => w.date.startsWith(monthKey));
  const monthBase = beforeMonth || inMonth[inMonth.length - 1] || null;
  const daysSince = (iso) =>
    Math.round((new Date(`${today}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);

  /* ---------- Treinos ---------- */
  const workouts = (Array.isArray(data.workouts) ? data.workouts : []).filter(
    (w) => w && isIso(w.date) && w.date <= today,
  );
  const monthWorkouts = workouts.filter((w) => w.date.startsWith(monthKey));
  const saitama = monthWorkouts.filter((w) => w.type === "saitama");
  const sum = (field, items = monthWorkouts) => items.reduce((total, w) => total + num(w[field]), 0);

  const monday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStart = toIsoDate(monday);
  const lastWorkout = workouts.reduce((best, w) => (!best || w.date > best.date ? w : best), null);

  return {
    weight: latest ? num(latest.weight) : null,
    weightDate: latest ? latest.date : "",
    weightDaysAgo: latest ? daysSince(latest.date) : null,
    weightDiff: latest && previous ? num(latest.weight) - num(previous.weight) : null,
    weightMonthDiff: latest && monthBase && monthBase !== latest ? num(latest.weight) - num(monthBase.weight) : null,
    weighInsMonth: inMonth.length,
    fat: latest && latest.fat !== null && latest.fat !== undefined && latest.fat !== "" ? num(latest.fat) : null,
    monthCount: monthWorkouts.length,
    monthActiveDays: new Set(monthWorkouts.map((w) => w.date)).size,
    elapsedDays: referenceDate.getDate(),
    monthMinutes: sum("durationMinutes"),
    monthCalories: sum("calories"),
    monthKm: sum("distanceKm"),
    monthSaitamaReps: sum("pushups", saitama) + sum("situps", saitama) + sum("squats", saitama),
    weekCount: workouts.filter((w) => w.date >= weekStart).length,
    todayWorkouts: workouts.filter((w) => w.date === today),
    lastWorkoutDaysAgo: lastWorkout ? daysSince(lastWorkout.date) : null,
  };
}
