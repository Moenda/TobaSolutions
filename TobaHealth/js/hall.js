/* =====================================================================
 * Toba Health · Hall do Herói: telas de detalhe (energia, distância,
 * peso levantado, Saitama). São PÁGINAS (view "viewDetail"), não pop-ups.
 *
 * Padrão das telas de equivalência:
 *   resumo (número grande + frase) → 🏅 Conquistado (cards compactos)
 *   → 🎯 Próximos desafios (3 barras; o resto fica recolhido)
 *
 * Carregado ANTES de treinos.js; usa funções dele só dentro de funções.
 * ===================================================================== */

const WORKOUT_DISTANCE_DESTINATIONS = [
  { icon: "🏖️", size: 360, label: "São Paulo → Rio de Janeiro", done: "foi de São Paulo ao Rio de Janeiro", note: "Com direito a biscoito Globo e farofa na areia." },
  { icon: "🧉", size: 1680, label: "São Paulo → Buenos Aires", done: "foi de São Paulo a Buenos Aires", note: "Alfajor, empanada e nenhuma conversa sobre o placar." },
  { icon: "🌴", size: 2690, label: "São Paulo → Manaus", done: "foi de São Paulo a Manaus", note: "Repelente não é opcional." },
  { icon: "🗽", size: 7690, label: "São Paulo → Nova York", done: "foi de São Paulo a Nova York", note: "Pizza de rua e crise de identidade." },
  { icon: "🥐", size: 7940, label: "São Paulo → Lisboa", done: "foi de São Paulo a Lisboa", note: "Pastel de nata na chegada. Pode pedir o segundo." },
  { icon: "💃", size: 8390, label: "São Paulo → Madri", done: "foi de São Paulo a Madri", note: "Jantar só começa às 22h, vai se acostumando." },
  { icon: "🏜️", size: 12220, label: "São Paulo → Dubai", done: "foi de São Paulo a Dubai", note: "O calor de lá faz o treino parecer sauna." },
  { icon: "🥢", size: 17750, label: "São Paulo → Pequim", done: "foi de São Paulo a Pequim", note: "Com pato laqueado de recompensa." },
  { icon: "🍣", size: 18550, label: "São Paulo → Tóquio", done: "foi de São Paulo a Tóquio", note: "Lá o temaki é de verdade, sem mini." },
  { icon: "🌍", size: 40075, label: "Uma volta ao mundo", done: "deu a volta ao mundo", note: "Magalhães ficaria com inveja." },
];

const WORKOUT_LIFT_EQUIVALENTS = [
  { icon: "🐈", one: "gato", name: "gatos", size: 4, note: "Levantado sem ele aprovar." },
  { icon: "🐕", one: "cachorro caramelo", name: "cachorros caramelo", size: 12, note: "O patrimônio nacional, no supino." },
  { icon: "🧍", one: "pessoa adulta", name: "pessoas adultas", size: 75, note: "Sem reclamar de ninguém." },
  { icon: "🏍️", one: "moto CG", name: "motos CG", size: 115, note: "Entrega por aplicativo, só que no ar." },
  { icon: "🦁", one: "leão", name: "leões", size: 190, note: "E ele nem rugiu." },
  { icon: "🎹", one: "piano de cauda", name: "pianos de cauda", size: 500, note: "Música para os ouvidos, dor para a coluna." },
  { icon: "🚗", one: "Fusca", name: "Fuscas", size: 830, note: "Sem a mudança de casa dentro." },
  { icon: "🦛", one: "hipopótamo", name: "hipopótamos", size: 1500, note: "Parece fofo, pesa uma tonelada e meia." },
  { icon: "🐘", one: "elefante", name: "elefantes", size: 5500, note: "A tromba não ajuda." },
  { icon: "🚌", one: "ônibus urbano", name: "ônibus urbanos", size: 12000, note: "Vazio, mas a lotação já saiu na foto." },
  { icon: "✈️", one: "Boeing 747 (vazio)", name: "Boeings 747 (vazios)", size: 180000, note: "Decolagem por sua conta e risco." },
  { icon: "🗽", one: "Estátua da Liberdade", name: "Estátuas da Liberdade", size: 204000, note: "Tocha inclusa." },
  { icon: "🙌", one: "Cristo Redentor", name: "Cristos Redentores", size: 635000, note: "De braços abertos, mas agora quem abraça é você." },
  { icon: "🗼", one: "Torre Eiffel", name: "Torres Eiffel", size: 10100000, note: "Paris que me perdoe, mas a torre veio junto." },
  { icon: "🚢", one: "Titanic", name: "Titanics", size: 52000000, note: "Sem iceberg, sem drama e sem Celine Dion." },
];

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

function pickTagline(value, tiers) {
  const tier = tiers.find((item) => value < item.below);
  return (tier || tiers[tiers.length - 1]).text;
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
  const tagline = pickTagline(kcal, [
    { below: 1, text: "Ainda não queimou nada. O brigadeiro agradece o descanso." },
    { below: 500, text: "Já dá pra justificar uma coxinha. Só uma." },
    { below: 3000, text: "Pode comer sem culpa. Com moderação, né, campeão." },
    { below: 20000, text: "O rodízio já te chama pelo nome." },
    { below: Infinity, text: "Você é um forno. Cuidado pra não derreter a academia." },
  ]);
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
  const tagline = pickTagline(km, [
    { below: 1, text: "Ainda no ponto de partida. A estrada espera, sem pressa." },
    { below: 100, text: "Aquecendo as canelas. O GPS já sabe seu nome." },
    { below: 360, text: "Quase no Rio. Já pode separar a canga." },
    { below: 2690, text: "Passou do Rio! Falta pouco pra Manaus, leva repelente." },
    { below: 12220, text: "Já tá fora do país, e sem fila na imigração." },
    { below: Infinity, text: "Lenda do cardio. A Terra está ficando pequena pra você." },
  ]);
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
  const tagline = pickTagline(kg, [
    { below: 1, text: "Nada levantado ainda. A barra está te esperando, ela é paciente." },
    { below: 500, text: "Fase de aquecimento. O ferro já sabe seu nome." },
    { below: 5000, text: "Agora sim! A galera da academia já te cumprimenta." },
    { below: 50000, text: "Respeitado no supino. O personal já te chama de lenda." },
    { below: 500000, text: "Isso não é treino, é mudança de apartamento." },
    { below: Infinity, text: "A prefeitura quer saber como você levanta isso. Você virou obra pública." },
  ]);
  const sections = renderProgressSections(kg, WORKOUT_LIFT_EQUIVALENTS, {
    emptyText: "Nada conquistado ainda. Registre um <strong>treino de força</strong> com carga e o primeiro gato cai rapidinho.",
    allDoneText: "Você levantou um Titanic inteiro. Não tem mais escala: você virou a escala.",
    doneTitle: (item, times) => `Você já levantou ${formatWorkoutNumber(times, 0)} ${times === 1 ? item.one : item.name}`,
    challengeLabel: (item) => item.one.charAt(0).toUpperCase() + item.one.slice(1),
    remaining: (item, total) => `${formatWorkoutNumber(item.size - total, 0)} kg (peso de ~${formatWorkoutNumber(item.size, 0)} kg)`,
  });
  return `
    ${eqSummary(`${formatWorkoutNumber(kg, 0)} kg`, `em ${formatWorkoutNumber(stats.liftReps, 0)} repetições`, tagline)}
    ${sections}
    <p class="eq-footer">Conta de guardanapo com pesos aproximados. Levantar o Titanic é por série, pelo menos em espírito.</p>`;
}

function renderSaitamaPage(stats) {
  const days = 365 * 3;
  const benchmarkReps = 100 * days;
  const benchmarkDistance = 10 * days;
  const totalReps = stats.situps + stats.pushups + stats.squats;
  const progress = ((stats.situps + stats.pushups + stats.squats) / (benchmarkReps * 3)) * 100;
  const tagline = pickTagline(progress, [
    { below: 0.0001, text: "O careca ainda nem sabe que você existe. Bora apresentar." },
    { below: 1, text: "O careca viu você de longe e acenou com a cabeça." },
    { below: 10, text: "O careca já comentou com o gato que você tem potencial." },
    { below: 50, text: "O careca está orgulhoso. Quase pediu seu autógrafo." },
    { below: Infinity, text: "Você já é o careca. Só falta a capa." },
  ]);
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
let detailReturnView = "viewHero";

function openWorkoutHallDetail(detail, monthKey = "") {
  const pages = {
    energy: { title: "🔥 Energia queimada", render: renderEnergyPage },
    distance: { title: "🌍 Sua quilometragem pelo mapa", render: renderDistancePage },
    lifted: { title: "🏋️ Peso levantado", render: renderLiftPage },
    saitama: { title: "👊 Você contra o mestre careca", render: renderSaitamaPage },
  };
  const page = pages[detail];
  if (!page) return;

  // monthKey vazio = Hall do Herói geral; com valor = só aquele mês
  const scopeWorkouts = monthKey
    ? getWorkoutMonthStats(healthDb.workouts, monthKey).workouts
    : healthDb.workouts;
  const stats = getWorkoutLifetimeStats(scopeWorkouts);

  detailReturnView = monthKey ? "viewMonth" : "viewHero";
  document.getElementById("workoutDetailTitle").innerText = page.title;
  document.getElementById("workoutDetailContent").innerHTML =
    (monthKey ? `<div class="eq-scope">📅 ${formatWorkoutMonth(monthKey)}</div>` : "") +
    page.render(stats);
  openModule("viewDetail");
  window.scrollTo({ top: 0 });
}

function closeWorkoutDetail() {
  openModule(detailReturnView);
  window.scrollTo({ top: 0 });
}
