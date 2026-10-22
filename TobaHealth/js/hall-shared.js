/* =====================================================================
 * Toba Health · Hall dos Heróis: cálculo puro + boneco do mapa de calor
 * (desde v1.47). Usado no Treinos (Hall de cada mês, página do treino) e no
 * Perfil do jogador (Hall dos Heróis da vida toda).
 * - Só lê: tudo recebe o banco do Health (healthData) por parâmetro e nada
 *   é gravado. Não depende de health-core.js nem de treinos.js.
 * - Carregue depois do toba-common.js e do health-metrics.js (catálogo,
 *   MUSCLE_SPLITS/MUSCLE_REF_KG, calcStrengthLift/calcWorkoutLift).
 * ===================================================================== */

function formatWorkoutNumber(value, maximumFractionDigits = 1) {
  return Number(value || 0).toLocaleString("pt-BR", {
    maximumFractionDigits,
  });
}

function getHallGroupName(groupId) {
  return STRENGTH_GROUPS.find((group) => group.id === groupId)?.name || groupId;
}

// Calorias aproximadas por porção, da mais leve para a mais pesada.
const WORKOUT_FOOD_EQUIVALENTS = [
  { icon: "🍬", one: "brigadeiro", name: "brigadeiros", kcal: 80, note: "80 kcal por unidade. Se foi de colher, a matemática descansa." },
  { icon: "🧀", one: "pão de queijo", name: "pães de queijo", kcal: 90, note: "90 kcal cada. Ninguém come só um, a gente sabe." },
  { icon: "🍺", one: "latinha de cerveja", name: "latinhas de cerveja", kcal: 150, note: "150 kcal por lata. Hidratação, tecnicamente." },
  { icon: "🍣", one: "temaki completo", name: "temakis completos", kcal: 230, note: "230 kcal. Não aquele mini que some em duas mordidas." },
  { icon: "🥟", one: "coxinha", name: "coxinhas", kcal: 250, note: "250 kcal de pura felicidade de padaria." },
  { icon: "🍕", one: "fatia de pizza", name: "fatias de pizza", kcal: 275, note: "275 kcal, com queijo puxando fio e calabresa em hora extra." },
  { icon: "🥮", one: "pastel de feira", name: "pastéis de feira", kcal: 300, note: "300 kcal. Com caldo de cana, vira outra conversa." },
  { icon: "🥣", one: "açaí de 500 ml", name: "açaís de 500 ml", kcal: 450, note: "450 kcal com granola e leite condensado, claro." },
  { icon: "🍔", one: "Big Mac", name: "Big Macs", kcal: 550, note: "550 kcal. O molho especial não conta como salada." },
  { icon: "🍲", one: "prato de feijoada", name: "pratos de feijoada", kcal: 700, note: "700 kcal e uma soneca garantida." },
  { icon: "🥪", one: "X-tudo", name: "X-tudos", kcal: 900, note: "900 kcal. O \"tudo\" não está de brincadeira." },
  { icon: "🍱", one: "rodízio de japonês completo", name: "rodízios de japonês completos", kcal: 2000, note: "2.000 kcal. Aqui a meta é sair rolando." },
];

/* ---------------------------------------------------------------------
 * Frases do resumo de cada página (Hall do mês no Treinos e Hall do Perfil)
 * ------------------------------------------------------------------- */
function pickTagline(value, tiers) {
  const tier = tiers.find((item) => value < item.below);
  return (tier || tiers[tiers.length - 1]).text;
}

const HALL_TAGLINES = {
  energy: [
    { below: 1, text: "Ainda não queimou nada. O brigadeiro agradece o descanso." },
    { below: 500, text: "Já dá pra justificar uma coxinha. Só uma." },
    { below: 3000, text: "Pode comer sem culpa. Com moderação, né, campeão." },
    { below: 20000, text: "O rodízio já te chama pelo nome." },
    { below: Infinity, text: "Você é um forno. Cuidado pra não derreter a academia." },
  ],
  distance: [
    { below: 1, text: "Ainda no ponto de partida. A estrada espera, sem pressa." },
    { below: 100, text: "Aquecendo as canelas. O GPS já sabe seu nome." },
    { below: 360, text: "Quase no Rio. Já pode separar a canga." },
    { below: 2690, text: "Passou do Rio! Falta pouco pra Manaus, leva repelente." },
    { below: 12220, text: "Já tá fora do país, e sem fila na imigração." },
    { below: Infinity, text: "Lenda do cardio. A Terra está ficando pequena pra você." },
  ],
  lifted: [
    { below: 1, text: "Nada levantado ainda. O chão tá te esperando pra umas flexões, ele é paciente." },
    { below: 500, text: "Fase de aquecimento. O ferro já sabe seu nome." },
    { below: 5000, text: "Agora sim! A galera da academia já te cumprimenta." },
    { below: 50000, text: "Respeitado no supino. O personal já te chama de lenda." },
    { below: 500000, text: "Isso não é treino, é mudança de apartamento." },
    { below: Infinity, text: "A prefeitura quer saber como você levanta isso. Você virou obra pública." },
  ],
  // saitama: % da meta de 3 anos do careca
  saitama: [
    { below: 0.0001, text: "O careca ainda nem sabe que você existe. Bora apresentar." },
    { below: 1, text: "O careca viu você de longe e acenou com a cabeça." },
    { below: 10, text: "O careca já comentou com o gato que você tem potencial." },
    { below: 50, text: "O careca está orgulhoso. Quase pediu seu autógrafo." },
    { below: Infinity, text: "Você já é o careca. Só falta a capa." },
  ],
};

/* ---------------------------------------------------------------------
 * Totais da vida toda (ou de um mês, passando só os treinos dele)
 * ------------------------------------------------------------------- */
function calcHallLifetimeStats(workouts, healthData) {
  return (workouts || []).reduce(
    (totals, workout) => {
      totals.count += 1;
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
      const lift = calcWorkoutLift(workout, healthData);
      totals.liftKg += lift.kg;
      totals.liftReps += lift.reps;
      if (workout.type === "saitama") {
        totals.pushups += Number(workout.pushups) || 0;
        totals.situps += Number(workout.situps) || 0;
        totals.squats += Number(workout.squats) || 0;
      }
      return totals;
    },
    { count: 0, durationMinutes: 0, calories: 0, distance: 0, walkDistance: 0, bikeDistance: 0, ellipticalDistance: 0, otherDistance: 0, pushups: 0, situps: 0, squats: 0, liftKg: 0, liftReps: 0 },
  );
}

/* Trabalho por grupo muscular de um treino (base do mapa de calor).
 * Devolve [{ group, exerciseId, reps, kg }] juntando os exercícios do treino
 * de força (grupo gravado no próprio treino) e os campos de peso do corpo
 * (flexão/agachamento/abdominal), que ganham grupo por BODYWEIGHT_FIELDS. */
function calcWorkoutMuscleWork(workout, healthData, { bodyweightOnly = false } = {}) {
  const items = [];
  const counts = Object.keys(BODYWEIGHT_FIELDS)
    .map((field) => [field, Number(workout[field]) || 0])
    .filter(([, count]) => count > 0);
  if (counts.length) {
    const bodyKg = calcBodyWeightOn(healthData, workout.date);
    counts.forEach(([field, count]) => {
      const info = BODYWEIGHT_FIELDS[field];
      items.push({ group: info.group, exerciseId: info.exerciseId, reps: count, kg: count * bodyKg * info.fraction });
    });
  }
  if (bodyweightOnly || !Array.isArray(workout.exercises)) return items;
  workout.exercises.forEach((exercise) => {
    const single = calcStrengthLift({ date: workout.date, exercises: [exercise] }, healthData);
    items.push({ group: exercise.group || "", exerciseId: exercise.exerciseId, reps: single.reps, kg: single.kg });
  });
  return items;
}

/* ---------------------------------------------------------------------
 * MAPA DE CALOR DOS MÚSCULOS (v1.30; esforço por peso desde v1.45)
 * Boneco em SVG (frente e costas), uma peça por grupo do STRENGTH_GROUPS.
 * Mede ESFORÇO (pts) por grupo: cada rep vale carga ÷ carga normal daquele
 * exercício pra um cara de 30 anos (MUSCLE_REF_KG; 1 pt = 1 rep na carga
 * normal), repartido entre os músculos do exercício (MUSCLE_SPLITS).
 * Pinta em 5 níveis comparando com o grupo mais treinado do período, do verde
 * (pouco) ao vermelho (o que mais treinou); cinza = nada.
 * Cardio (e km do Saitama/personalizado) entra como "reps equivalentes" por
 * km (CARDIO_MUSCLES, getMuscleExtras). Todo tipo de treino pinta.
 * ------------------------------------------------------------------- */
const MUSCLE_LAZY_LINES = {
  peito: "Peito em modo avião ✈️",
  costas: "Costas pedindo socorro 🆘",
  ombros: "Ombro de enfeite 🎀",
  biceps: "Bíceps só no story 📸",
  triceps: "Tríceps esquecido no armário 🧥",
  antebraco: "Antebraço só abrindo pote de pepino 🥒",
  quadriceps: "Perna? Que perna? 🦩",
  posterior: "Posterior tirando um cochilo 😴",
  gluteos: "Glúteo de licença 🍑",
  panturrilha: "Panturrilha de férias 🏖️",
  abdomen: "Tanquinho virou tanque de lavar 🫧",
};

// Peças do boneco: [grupo, forma]. Frente em x 0-70, costas em x 70-140.
const MUSCLE_SHAPES = {
  front: [
    ["ombros", '<ellipse cx="22" cy="26" rx="6" ry="5"/><ellipse cx="48" cy="26" rx="6" ry="5"/>'],
    ["peito", '<rect x="25" y="22" width="9.5" height="12" rx="3"/><rect x="35.5" y="22" width="9.5" height="12" rx="3"/>'],
    ["biceps", '<rect x="13" y="31" width="7" height="14" rx="3"/><rect x="50" y="31" width="7" height="14" rx="3"/>'],
    ["antebraco", '<rect x="11" y="47" width="7" height="15" rx="3"/><rect x="52" y="47" width="7" height="15" rx="3"/>'],
    ["abdomen", '<rect x="28" y="36" width="14" height="20" rx="3"/>'],
    ["quadriceps", '<rect x="25" y="63" width="9" height="25" rx="4"/><rect x="36" y="63" width="9" height="25" rx="4"/>'],
    ["panturrilha", '<rect x="26" y="91" width="7" height="22" rx="3"/><rect x="37" y="91" width="7" height="22" rx="3"/>'],
  ],
  back: [
    ["ombros", '<ellipse cx="92" cy="26" rx="6" ry="5"/><ellipse cx="118" cy="26" rx="6" ry="5"/>'],
    ["costas", '<path d="M95 22h20l-2 24h-16z"/>'],
    ["triceps", '<rect x="83" y="31" width="7" height="14" rx="3"/><rect x="120" y="31" width="7" height="14" rx="3"/>'],
    ["antebraco", '<rect x="81" y="47" width="7" height="15" rx="3"/><rect x="122" y="47" width="7" height="15" rx="3"/>'],
    ["gluteos", '<ellipse cx="100" cy="55" rx="5" ry="6"/><ellipse cx="110" cy="55" rx="5" ry="6"/>'],
    ["posterior", '<rect x="95" y="63" width="9" height="25" rx="4"/><rect x="106" y="63" width="9" height="25" rx="4"/>'],
    ["panturrilha", '<rect x="96" y="91" width="7" height="22" rx="3"/><rect x="107" y="91" width="7" height="22" rx="3"/>'],
  ],
};

// Cardio também pinta, mas leve: cada km vira "reps equivalentes" por grupo.
// Sem distância, estima pelo tempo (km por minuto de cada atividade).
const CARDIO_MUSCLES = {
  walking: { kmPerMin: 0.1, perKm: { panturrilha: 12, quadriceps: 6, gluteos: 4, posterior: 3 } },
  bike: { kmPerMin: 0.3, perKm: { quadriceps: 5, panturrilha: 2, gluteos: 2 } },
  elliptical: { kmPerMin: 0.13, perKm: { quadriceps: 6, gluteos: 4, panturrilha: 4, posterior: 2 } },
};

function getCardioKm(workout) {
  const cardio = CARDIO_MUSCLES[workout.type];
  if (!cardio) return 0;
  return Number(workout.distanceKm) || (Number(workout.durationMinutes) || 0) * cardio.kmPerMin;
}

// "Todo exercício conta": além do cardio puro, os km do Saitama e do treino
// personalizado entram como caminhada/corrida. O personalizado sem distância
// (só séries×reps ou só minutos) não diz o músculo, então espalha leve no corpo todo.
// Devolve [[grupo, reps, pts]]: cada rep equivalente vale MUSCLE_CARDIO_INTENSITY.
function getMuscleExtras(workout) {
  const items = [];
  const addMap = (perKm, km) => Object.entries(perKm).forEach(([group, value]) => {
    const reps = Math.round(km * value);
    items.push([group, reps, reps * MUSCLE_CARDIO_INTENSITY]);
  });
  const km = getCardioKm(workout);
  if (km > 0) addMap(CARDIO_MUSCLES[workout.type].perKm, km);
  const loose = Number(workout.distanceKm) || 0;
  if ((workout.type === "saitama" || workout.type === "custom") && loose > 0) {
    addMap(CARDIO_MUSCLES.walking.perKm, loose);
  } else if (workout.type === "custom") {
    const reps = (Number(workout.sets) || 0) * (Number(workout.reps) || 0) || Number(workout.durationMinutes) || 0;
    const each = Math.max(1, Math.round(reps / STRENGTH_GROUPS.length));
    if (reps > 0) STRENGTH_GROUPS.forEach((group) => items.push([group.id, each, each * MUSCLE_CARDIO_INTENSITY]));
  }
  return items;
}

// Soma por grupo: { peito: { effort, reps, kg, lastDate }, ... }
// effort (pts) = reps × intensidade × fatia do músculo; reps e kg também vêm
// repartidos pela fatia (só pra mostrar no toque).
function calcMuscleHeat(workouts, healthData) {
  const heat = {};
  const add = (group, reps, kg, pts, date) => {
    if (!group || !(reps > 0) || !(pts > 0)) return;
    const item = heat[group] || (heat[group] = { effort: 0, reps: 0, kg: 0, lastDate: "" });
    item.effort += pts;
    item.reps += reps;
    item.kg += kg;
    if (String(date) > item.lastDate) item.lastDate = String(date);
  };
  const addSplit = (exerciseId, group, work, date) => calcMuscleShares(exerciseId, group)
    .forEach(([target, share]) => add(target, work.reps * share, work.kg * share, work.pts * share, date));
  (workouts || []).forEach((workout) => {
    calcWorkoutMuscleWork(workout, healthData, { bodyweightOnly: true }).forEach((item) => {
      const pts = item.reps * calcMuscleIntensity(item.exerciseId, item.kg / item.reps);
      addSplit(item.exerciseId, item.group, { reps: item.reps, kg: item.kg, pts }, workout.date);
    });
    getMuscleExtras(workout).forEach(([group, reps, pts]) => add(group, reps, 0, pts, workout.date));
    if (!Array.isArray(workout.exercises)) return;
    workout.exercises.forEach((exercise) => {
      addSplit(exercise.exerciseId, exercise.group, calcExerciseEffort(exercise, workout.date, healthData), workout.date);
    });
  });
  return heat;
}

function getMuscleLevel(heat, group) {
  const max = Math.max(0, ...Object.values(heat).map((item) => item.effort));
  const effort = heat[group]?.effort || 0;
  return max && effort ? Math.max(1, Math.ceil((effort / max) * 5)) : 0;
}

// interactive: cada músculo vira botão (data-click="showMuscleHeat"; cada
// página registra a sua ação)
function renderMuscleMap(heat, { interactive = false, scope = "" } = {}) {
  const part = ([group, shape]) => {
    const level = getMuscleLevel(heat, group);
    const name = getHallGroupName(group);
    const attrs = interactive
      ? ` role="button" tabindex="0" data-click="showMuscleHeat" data-group="${group}" data-scope="${escapeHtml(scope)}" aria-label="${name}"`
      : "";
    return `<g class="muscle lv-${level}"${attrs}><title>${name}</title>${shape}</g>`;
  };
  const body = (x) => `
    <g class="muscle-base">
      <circle cx="${x + 35}" cy="10" r="7"/><rect x="${x + 32}" y="16" width="6" height="5" rx="2"/>
      <rect x="${x + 26}" y="56" width="18" height="6" rx="3"/>
    </g>`;
  return `
    <svg class="muscle-map${interactive ? " is-interactive" : ""}" viewBox="0 0 140 124" role="${interactive ? "group" : "img"}" aria-label="Mapa de calor dos músculos, frente e costas">
      ${body(0)}${body(70)}
      ${MUSCLE_SHAPES.front.map(part).join("")}
      ${MUSCLE_SHAPES.back.map(part).join("")}
      <text x="35" y="122" class="muscle-side">frente</text>
      <text x="105" y="122" class="muscle-side">costas</text>
    </svg>`;
}

// Linha curta: top 3 + a zoeira com quem ficou de fora
function describeMuscleHeat(heat) {
  const ranked = Object.entries(heat).sort((a, b) => b[1].effort - a[1].effort);
  const lazy = STRENGTH_GROUPS.find((group) => !heat[group.id]);
  return {
    top: ranked.slice(0, 3).map(([group]) => getHallGroupName(group)),
    lazy: lazy ? MUSCLE_LAZY_LINES[lazy.id] : "",
  };
}

// Ranking com barras (mês, página do treino e Perfil)
function renderMuscleRank(heat) {
  const ranked = Object.entries(heat).sort((a, b) => b[1].effort - a[1].effort);
  if (!ranked.length) return "";
  const max = ranked[0][1].effort;
  return `<ul class="muscle-rank">${ranked.map(([group, item]) => `
    <li>
      <span class="muscle-rank-name">${getHallGroupName(group).replace(" de coxa", "")}</span>
      <span class="muscle-rank-bar"><span class="lv-${getMuscleLevel(heat, group)}" style="width:${Math.max(6, (item.effort / max) * 100)}%"></span></span>
      <span class="muscle-rank-value">${formatWorkoutNumber(item.effort, 0)} pts</span>
    </li>`).join("")}
  </ul>`;
}

// Texto do toque num músculo (Treinos e Perfil)
function describeMuscleTap(heat, group) {
  const item = heat[group];
  const name = getHallGroupName(group);
  if (!item) return MUSCLE_LAZY_LINES[group] || `${name}: nada por aqui`;
  const days = Math.round((new Date(`${toIsoDate(new Date())}T12:00:00`) - new Date(`${item.lastDate}T12:00:00`)) / 86400000);
  const when = days <= 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
  return `${name}: ${formatWorkoutNumber(item.effort, 0)} pts · ~${formatWorkoutNumber(item.reps, 0)} reps · último ${when}`;
}

/* ---------------------------------------------------------------------
 * FORMATO DO CORPO (vida toda): tronco x perna em esforço (pts).
 * ------------------------------------------------------------------- */
const MUSCLE_UPPER = ["peito", "costas", "ombros", "biceps", "triceps", "antebraco", "abdomen"];

function getBodyShape(heat) {
  let upper = 0;
  let lower = 0;
  Object.entries(heat).forEach(([group, item]) => {
    if (MUSCLE_UPPER.includes(group)) upper += item.effort;
    else lower += item.effort;
  });
  const total = upper + lower;
  const upperPct = total ? Math.round((upper / total) * 100) : 0;
  let shape = { icon: "▭", name: "Retângulo", note: "Tronco e perna no mesmo ritmo. Equilíbrio de monge shaolin 🧘" };
  if (upper > lower * 1.3) shape = { icon: "🔻", name: "Triângulo invertido", note: "Shape V chegando... mas cuidado com a perna de sabiá 🐦" };
  else if (lower > upper * 1.3) shape = { icon: "🔺", name: "Triângulo", note: "Perna de jogador, peito de goleiro reserva 🦵" };
  return { ...shape, upperPct, lowerPct: total ? 100 - upperPct : 0 };
}

/* ---------------------------------------------------------------------
 * Escadas de marcos (peso, distância): onde você está e o próximo
 * items em ordem crescente de size.
 * ------------------------------------------------------------------- */
function calcHallLadder(total, items) {
  const done = items.filter((item) => total >= item.size);
  const current = done[done.length - 1] || null;
  const next = items.find((item) => total < item.size) || null;
  const from = current ? current.size : 0;
  const ratio = next ? Math.max(0, Math.min(1, (total - from) / (next.size - from))) : 1;
  return { done, current, next, from, ratio, remaining: next ? next.size - total : 0 };
}

// Kg com unidade amigável: 850 kg, 12,4 t, 1.000 t, 10,1 mil t
function formatHallKg(kg, digits = 1) {
  const value = Number(kg) || 0;
  if (value < 1000) return `${formatWorkoutNumber(value, 0)} kg`;
  if (value < 10000000) return `${formatWorkoutNumber(value / 1000, value < 100000 ? digits : 0)} t`;
  return `${formatWorkoutNumber(value / 1000000, digits)} mil t`;
}
