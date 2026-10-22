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
 * - Escalas do Hall dos Heróis (cidades e pesos): o id de cada item é a
 *   conquista do perfil; nunca troque um id. Item novo entra na ordem de
 *   size; o nível da conquista (bronze...lenda) é fixado por id em
 *   PLAYER_LIFT_TIERS (toba-player.js), não pela posição na lista.
 * - Conta do peso levantado (calcStrengthLift / calcWorkoutLift): forca.js e
 *   treinos.js só chamam estas funções passando o healthDb.
 * Carregue ANTES de hall.js / forca.js / treinos.js.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * Catálogo de força
 * bodyweight (opcional): parte do peso do corpo que o exercício levanta.
 * alsoIn (opcional, desde v1.47): outros grupos onde o exercício também
 *   aparece na hora de escolher (só a lista; o grupo gravado é o `group`).
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
  { id: "leg-press-90", name: "Leg press 90°", group: "quadriceps" },
  { id: "leg-press-180", name: "Leg press 180° (horizontal)", group: "quadriceps" },
  { id: "cadeira-extensora", name: "Cadeira extensora", group: "quadriceps" },
  { id: "afundo", name: "Afundo / passada", group: "quadriceps" },
  // Posterior de coxa
  { id: "mesa-flexora", name: "Mesa flexora", group: "posterior" },
  { id: "cadeira-flexora", name: "Cadeira flexora", group: "posterior" },
  { id: "stiff", name: "Stiff", group: "posterior" },
  // Glúteos
  { id: "elevacao-pelvica", name: "Elevação pélvica", group: "gluteos" },
  { id: "cadeira-abdutora", name: "Cadeira abdutora", group: "gluteos" },
  { id: "cadeira-adutora", name: "Cadeira adutora", group: "gluteos", alsoIn: ["quadriceps"] },
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

// Exercícios que aparecem na lista de um grupo (o dele + os do alsoIn).
function getStrengthExercisesInGroup(groupId) {
  return STRENGTH_EXERCISES.filter((exercise) => exercise.group === groupId || (exercise.alsoIn || []).includes(groupId));
}

/* ---------------------------------------------------------------------
 * DIVISÃO DO ESFORÇO ENTRE OS MÚSCULOS (mapa de calor, desde v1.45)
 * Nenhum exercício trabalha um músculo só: cada um reparte o esforço entre
 * os grupos do STRENGTH_GROUPS (fatias somam 1). O grupo do catálogo continua
 * sendo o "principal" (filtros e chips); isto aqui só pesa o mapa de calor.
 * Exercício fora da lista = 100% no grupo dele. Exercício novo no catálogo =
 * linha nova aqui (chave = id do exercício).
 * ------------------------------------------------------------------- */
const MUSCLE_SPLITS = {
  // Peito: empurrar leva tríceps e ombro junto
  "supino-reto-barra": { peito: 0.6, triceps: 0.25, ombros: 0.15 },
  "supino-reto-halter": { peito: 0.65, triceps: 0.2, ombros: 0.15 },
  "supino-inclinado-barra": { peito: 0.5, ombros: 0.3, triceps: 0.2 },
  "supino-inclinado-halter": { peito: 0.55, ombros: 0.3, triceps: 0.15 },
  "supino-declinado": { peito: 0.65, triceps: 0.25, ombros: 0.1 },
  "supino-maquina": { peito: 0.6, triceps: 0.25, ombros: 0.15 },
  "crucifixo-halter": { peito: 0.8, ombros: 0.15, biceps: 0.05 },
  "crossover": { peito: 0.8, ombros: 0.15, biceps: 0.05 },
  "peck-deck": { peito: 0.85, ombros: 0.15 },
  // Flexão: costas (escápula/serrátil) e abdômen (prancha) seguram o corpo
  "flexao": { peito: 0.55, triceps: 0.15, ombros: 0.1, costas: 0.1, abdomen: 0.1 },
  // Costas: puxar leva bíceps e antebraço (pegada)
  "puxada-frente": { costas: 0.65, biceps: 0.2, antebraco: 0.1, ombros: 0.05 },
  "puxada-triangulo": { costas: 0.6, biceps: 0.25, antebraco: 0.1, ombros: 0.05 },
  "barra-fixa": { costas: 0.55, biceps: 0.2, antebraco: 0.1, abdomen: 0.1, ombros: 0.05 },
  "remada-curvada": { costas: 0.55, biceps: 0.15, ombros: 0.1, posterior: 0.1, antebraco: 0.05, abdomen: 0.05 },
  "remada-baixa": { costas: 0.65, biceps: 0.2, ombros: 0.1, antebraco: 0.05 },
  "remada-baixa-unilateral": { costas: 0.65, biceps: 0.2, ombros: 0.1, antebraco: 0.05 },
  "remada-unilateral": { costas: 0.65, biceps: 0.2, ombros: 0.1, antebraco: 0.05 },
  "remada-maquina": { costas: 0.65, biceps: 0.2, ombros: 0.1, antebraco: 0.05 },
  "pulldown": { costas: 0.75, triceps: 0.1, ombros: 0.1, abdomen: 0.05 },
  "terra": { costas: 0.3, posterior: 0.25, gluteos: 0.25, quadriceps: 0.1, antebraco: 0.1 },
  // Ombros
  "desenvolvimento-halter": { ombros: 0.65, triceps: 0.25, peito: 0.1 },
  "desenvolvimento-barra": { ombros: 0.6, triceps: 0.25, abdomen: 0.1, peito: 0.05 },
  "desenvolvimento-maquina": { ombros: 0.65, triceps: 0.25, peito: 0.1 },
  "elevacao-lateral": { ombros: 0.9, costas: 0.1 },
  "elevacao-frontal": { ombros: 0.85, peito: 0.15 },
  "crucifixo-inverso": { ombros: 0.6, costas: 0.4 },
  "encolhimento": { costas: 0.5, ombros: 0.4, antebraco: 0.1 }, // trapézio fica nas costas do boneco
  "face-pull": { ombros: 0.6, costas: 0.3, biceps: 0.1 },
  // Bíceps: antebraço segura junto (martelo pega mais)
  "rosca-direta": { biceps: 0.8, antebraco: 0.2 },
  "rosca-alternada": { biceps: 0.8, antebraco: 0.2 },
  "rosca-martelo": { biceps: 0.6, antebraco: 0.4 },
  "rosca-scott": { biceps: 0.85, antebraco: 0.15 },
  "rosca-concentrada": { biceps: 0.9, antebraco: 0.1 },
  "rosca-polia": { biceps: 0.8, antebraco: 0.2 },
  // Tríceps
  "triceps-pulley-corda": { triceps: 0.95, antebraco: 0.05 },
  "triceps-pulley-barra": { triceps: 0.95, antebraco: 0.05 },
  "triceps-testa": { triceps: 0.95, antebraco: 0.05 },
  "triceps-frances": { triceps: 0.9, ombros: 0.1 },
  "triceps-coice": { triceps: 0.9, ombros: 0.1 },
  "mergulho": { triceps: 0.5, peito: 0.3, ombros: 0.2 },
  "supino-fechado": { triceps: 0.55, peito: 0.35, ombros: 0.1 },
  // Antebraço
  "rosca-punho": { antebraco: 1 },
  "rosca-punho-inversa": { antebraco: 1 },
  "rosca-inversa": { antebraco: 0.6, biceps: 0.4 },
  "rosca-zottman": { antebraco: 0.5, biceps: 0.5 },
  "rolo-punho": { antebraco: 0.9, ombros: 0.1 },
  // Quadríceps: agachar leva glúteo, posterior e o core segurando
  "agachamento-livre": { quadriceps: 0.45, gluteos: 0.25, posterior: 0.1, costas: 0.1, abdomen: 0.05, panturrilha: 0.05 },
  "agachamento-corpo": { quadriceps: 0.5, gluteos: 0.25, posterior: 0.1, panturrilha: 0.05, abdomen: 0.05, costas: 0.05 },
  "agachamento-smith": { quadriceps: 0.55, gluteos: 0.25, posterior: 0.1, panturrilha: 0.05, abdomen: 0.05 },
  "agachamento-hack": { quadriceps: 0.65, gluteos: 0.2, posterior: 0.1, panturrilha: 0.05 },
  "agachamento-bulgaro": { quadriceps: 0.45, gluteos: 0.35, posterior: 0.1, panturrilha: 0.05, abdomen: 0.05 },
  "leg-press": { quadriceps: 0.6, gluteos: 0.25, posterior: 0.1, panturrilha: 0.05 },
  "leg-press-90": { quadriceps: 0.6, gluteos: 0.25, posterior: 0.1, panturrilha: 0.05 },
  "leg-press-180": { quadriceps: 0.6, gluteos: 0.25, posterior: 0.1, panturrilha: 0.05 },
  "cadeira-extensora": { quadriceps: 1 },
  "afundo": { quadriceps: 0.45, gluteos: 0.3, posterior: 0.15, panturrilha: 0.05, abdomen: 0.05 },
  // Posterior de coxa
  "mesa-flexora": { posterior: 0.9, panturrilha: 0.1 },
  "cadeira-flexora": { posterior: 0.9, panturrilha: 0.1 },
  "stiff": { posterior: 0.55, gluteos: 0.25, costas: 0.15, antebraco: 0.05 },
  // Glúteos
  "elevacao-pelvica": { gluteos: 0.65, posterior: 0.2, quadriceps: 0.1, abdomen: 0.05 },
  "cadeira-abdutora": { gluteos: 1 },
  // Adutor fica na parte interna da coxa: o boneco não tem peça própria, então
  // vai pra coxa (frente e trás) e um pouco pro glúteo.
  "cadeira-adutora": { quadriceps: 0.55, posterior: 0.25, gluteos: 0.2 },
  "gluteo-polia": { gluteos: 0.8, posterior: 0.2 },
  "gluteo-maquina": { gluteos: 0.8, posterior: 0.2 },
  // Panturrilha
  "panturrilha-pe": { panturrilha: 1 },
  "panturrilha-sentado": { panturrilha: 1 },
  "panturrilha-leg": { panturrilha: 1 },
  // Abdômen: subir o tronco/pernas puxa o flexor do quadril (frente da coxa)
  "abdominal-crunch": { abdomen: 0.9, quadriceps: 0.1 },
  "abdominal-infra": { abdomen: 0.8, quadriceps: 0.2 },
  "abdominal-polia": { abdomen: 1 },
  "abdominal-maquina": { abdomen: 1 },
};

/* Régua de força: carga "normal" de cada exercício pra um cara comum de
 * 30 anos, ~80 kg, que treina faz um tempo (peso que ele faz 10 reps bem
 * feitas). Mesma unidade do calcStrengthLift: halteres = soma dos dois
 * (com "por halter" ligado); unilateral = carga de um lado; peso do corpo
 * já entra na conta (flexão ~48 kg, barra ~72 kg).
 * Intensidade da série = carga ÷ régua (presa entre 0,25 e 2): perna com
 * 200 kg no leg press e bíceps com 25 kg na rosca valem o MESMO esforço,
 * porque os dois estão na carga normal de cada um. Isso substitui o
 * "perna vale metade" (que errava pra perna leve e pra braço pesado).
 * Exercício novo no catálogo = régua nova aqui. */
const MUSCLE_REF_KG = {
  // Peito
  "supino-reto-barra": 60, "supino-reto-halter": 44, "supino-inclinado-barra": 50,
  "supino-inclinado-halter": 36, "supino-declinado": 60, "supino-maquina": 55,
  "crucifixo-halter": 24, "crossover": 30, "peck-deck": 45, "flexao": 48,
  // Costas
  "puxada-frente": 55, "puxada-triangulo": 55, "barra-fixa": 72, "remada-curvada": 50,
  "remada-baixa": 55, "remada-baixa-unilateral": 27, "remada-unilateral": 26,
  "remada-maquina": 55, "pulldown": 30, "terra": 90,
  // Ombros
  "desenvolvimento-halter": 28, "desenvolvimento-barra": 40, "desenvolvimento-maquina": 40,
  "elevacao-lateral": 14, "elevacao-frontal": 16, "crucifixo-inverso": 14,
  "encolhimento": 60, "face-pull": 25,
  // Bíceps
  "rosca-direta": 25, "rosca-alternada": 24, "rosca-martelo": 24, "rosca-scott": 22,
  "rosca-concentrada": 12, "rosca-polia": 25,
  // Tríceps
  "triceps-pulley-corda": 25, "triceps-pulley-barra": 30, "triceps-testa": 25,
  "triceps-frances": 20, "triceps-coice": 10, "mergulho": 68, "supino-fechado": 45,
  // Antebraço
  "rosca-punho": 20, "rosca-punho-inversa": 12, "rosca-inversa": 20, "rosca-zottman": 20, "rolo-punho": 8,
  // Quadríceps (agachamento sem peso é leve pra perna: régua acima do peso do corpo)
  "agachamento-livre": 60, "agachamento-corpo": 110, "agachamento-smith": 60, "agachamento-hack": 80,
  "agachamento-bulgaro": 20, "leg-press": 150,
  "leg-press-90": 100, // no 90° o peso sobe inteiro (no 45° só ~70% dele)
  "leg-press-180": 100, // horizontal de placas/cabo: o peso da pilha vai inteiro
  "cadeira-extensora": 45, "afundo": 20,
  // Posterior de coxa
  "mesa-flexora": 35, "cadeira-flexora": 35, "stiff": 50,
  // Glúteos
  "elevacao-pelvica": 70, "cadeira-abdutora": 50, "cadeira-adutora": 50, "gluteo-polia": 15, "gluteo-maquina": 30,
  // Panturrilha
  "panturrilha-pe": 60, "panturrilha-sentado": 40, "panturrilha-leg": 100,
  // Abdômen (abdominal é leve: 120 do Saitama ≈ 72 reps "normais")
  "abdominal-crunch": 40, "abdominal-infra": 40, "abdominal-polia": 35, "abdominal-maquina": 35,
};
const MUSCLE_INTENSITY_MIN = 0.25;
const MUSCLE_INTENSITY_MAX = 2;
// Série sem carga anotada (exercício que não é de peso do corpo): meio esforço.
const MUSCLE_NO_LOAD_INTENSITY = 0.5;
// Cardio e personalizado sem músculo: cada "rep equivalente" vale isto.
const MUSCLE_CARDIO_INTENSITY = 0.4;

// [[grupo, fatia], ...] do exercício; sem divisão = tudo no grupo dele.
function calcMuscleShares(exerciseId, fallbackGroup) {
  const split = MUSCLE_SPLITS[exerciseId];
  if (split) return Object.entries(split);
  return fallbackGroup ? [[fallbackGroup, 1]] : [];
}

// Intensidade de 1 rep com kgPerRep no exercício (1 = carga normal).
function calcMuscleIntensity(exerciseId, kgPerRep) {
  const ref = MUSCLE_REF_KG[exerciseId];
  if (!(kgPerRep > 0)) return MUSCLE_NO_LOAD_INTENSITY;
  if (!ref) return 1;
  return Math.min(MUSCLE_INTENSITY_MAX, Math.max(MUSCLE_INTENSITY_MIN, kgPerRep / ref));
}

// Esforço de um exercício do treino de força, série por série (mesma conta
// de carga do calcStrengthLift): { reps, kg, pts }. pts = reps × intensidade
// ("reps na carga normal"); quem divide entre os músculos é o mapa de calor.
function calcExerciseEffort(exercise, workoutDate, healthData) {
  const fraction = STRENGTH_EXERCISES.find((item) => item.id === exercise.exerciseId)?.bodyweight || 0;
  const bodyPart = fraction ? calcBodyWeightOn(healthData, workoutDate) * fraction : 0;
  const load = calcExerciseLoad(healthData, exercise.exerciseId);
  const loadFactor = load.perHand && !load.unilateral ? 2 : 1;
  const repsFactor = load.unilateral ? 2 : 1;
  const total = { reps: 0, kg: 0, pts: 0 };
  (exercise.sets || []).forEach((set) => {
    const reps = (Number(set.reps) || 0) * repsFactor;
    if (!(reps > 0)) return;
    const kg = (Number(set.kg) || 0) * loadFactor + bodyPart;
    total.reps += reps;
    total.kg += reps * kg;
    total.pts += reps * calcMuscleIntensity(exercise.exerciseId, kg);
  });
  return total;
}

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
  // v1.47: marcos novos com o peso real de cada coisa (fonte no PATCH-NOTES)
  { id: "lift-tanque", icon: "🪖", one: "tanque Leopard 2", name: "tanques Leopard 2", size: 62300, note: "62 t de blindado. A esteira da academia nunca mais vai te assustar." },
  { id: "lift-rodotrem", icon: "🚛", one: "rodotrem carregado", name: "rodotrens carregados", size: 74000, note: "O bitrenzão de 9 eixos da BR, com 74 t de soja. Sem parar no posto pro pastel." },
  { id: "lift-baleia", icon: "🐋", one: "baleia-azul", name: "baleias-azuis", size: 110000, note: "O maior bicho que já existiu (~110 t). E você nem molhou o cabelo." },
  { id: "lift-boeing", icon: "✈️", one: "Boeing 747 (vazio)", name: "Boeings 747 (vazios)", size: 180000, note: "Decolagem por sua conta e risco." },
  { id: "lift-liberdade", icon: "🗽", one: "Estátua da Liberdade", name: "Estátuas da Liberdade", size: 204000, note: "Tocha inclusa." },
  { id: "lift-a380", icon: "🛬", one: "Airbus A380 (vazio)", name: "Airbus A380 (vazios)", size: 277000, note: "O avião de dois andares. A escada fica por sua conta." },
  { id: "lift-747-lotado", icon: "🛫", one: "Boeing 747 lotado", name: "Boeings 747 lotados", size: 397000, note: "Agora com passageiro, mala e o carrinho do lanche. Peso máximo de decolagem." },
  { id: "lift-falcon9", icon: "🚀", one: "foguete Falcon 9", name: "foguetes Falcon 9", size: 549000, note: "Na plataforma, de tanque cheio. Não acende o isqueiro." },
  { id: "lift-cristo", icon: "🙌", one: "Cristo Redentor", name: "Cristos Redentores", size: 635000, note: "De braços abertos, mas agora quem abraça é você." },
  { id: "lift-trem-bala", icon: "🚄", one: "trem-bala japonês", name: "trens-bala japoneses", size: 715000, note: "16 vagões de Shinkansen. Pontual até no supino." },
  { id: "lift-belaz", icon: "⛏️", one: "BelAZ 75710 carregado", name: "BelAZ 75710 carregados", size: 810000, note: "O maior caminhão do mundo, com 450 t de pedra na caçamba. Quebra-molas nem sente." },
  { id: "lift-longa-marcha", icon: "🐉", one: "foguete Longa Marcha 5", name: "foguetes Longa Marcha 5", size: 870000, note: "O foguetão da China. Até o dragão ficou com dor na lombar." },
  { id: "lift-baalbek", icon: "🗿", one: "Pedra da Grávida de Baalbek", name: "Pedras da Grávida de Baalbek", size: 1000000, note: "Monólito romano de ~1.000 t no Líbano. Os romanos largaram na pedreira. Você não." },
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
