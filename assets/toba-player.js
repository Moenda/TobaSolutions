/* =====================================================================
 * Toba · Perfil do jogador (XP, nível, streak, conquistas)
 * Um perfil só para o Toba inteiro. Carregue depois do toba-common.js, do
 * TobaHealth/js/health-metrics.js (catálogo, escalas do Hall e kg levantado)
 * do TobaRoutine/js/routine-metrics.js (XP das tarefas, desde v1.41) e do
 * TobaKitchen/js/kitchen-recipes.js (conquistas da cozinha, desde v1.44):
 *   toba-common.js -> health-metrics.js -> routine-metrics.js -> kitchen-recipes.js -> toba-player.js
 * Sem routine-metrics.js ou kitchen-recipes.js o cálculo fica "incompleto" (state.ok = false) e
 * nada é comemorado nem gravado, para o XP não oscilar entre as telas.
 *
 * PRINCÍPIO: o XP é CALCULADO, nunca somado.
 * - computePlayer() relê os treinos do TOBA_HEALTH_DB e as tarefas do
 *   TOBA_ROUTINE_DB e devolve XP, nível,
 *   streak, recordes e conquistas. Apagou um treino? O XP dele some junto.
 *   Não existe XP duplicado e o histórico antigo já conta.
 * - O TOBA_PLAYER_DB só guarda o que não dá para calcular:
 *   { v: 1, createdAt: "AAAA-MM-DD",
 *     settings: { weeklyGoal: 1..7 },              // meta do streak (dias de treino por semana)
 *     seen: { xp, level, achievements: [ids] },    // o que já foi comemorado
 *     equipped: { title, avatar, frame, color } }  // recompensas escolhidas ("" = automático)
 *   Campo novo: default em createEmptyPlayerDb() E em normalizePlayerDb().
 * - toba_player_prefs: { sound, vibrate } (preferência de tela).
 * - Ids de conquista/recompensa são gravados em seen/equipped: nunca troque.
 *
 * Nas páginas: tobaPlayerCheck({ reason }) depois de gravar algo que vale XP.
 * Ele compara com o "seen", mostra +XP / medalhas / level up e avisa a tela
 * com o evento "toba:player" (detail = estado calculado).
 * ===================================================================== */
const PLAYER_KEY = "TOBA_PLAYER_DB";
const PLAYER_BACKUP_KEY = "TOBA_PLAYER_DB_AUTO_BACKUP";
const PLAYER_PREFS_KEY = "toba_player_prefs";

/* ---------------------------------------------------------------------
 * Regras de XP
 * ------------------------------------------------------------------- */
const PLAYER_XP = {
  workoutBase: 40, // qualquer treino registrado
  perMinute: 1, minutesCap: 90,
  perSet: 3, setsCap: 60, // séries feitas (força / personalizado)
  per10Reps: 1, repsCap: 60, // flexão + abdominal + agachamento
  perKm: 8, kmCap: 80,
  dayCap: 300, // teto de XP de treino por dia (recorde, conquista e streak ficam fora)
  record: 30, recordsPerWorkout: 3,
};
const PLAYER_TIERS = {
  bronze: { name: "Bronze", xp: 50 },
  prata: { name: "Prata", xp: 150 },
  ouro: { name: "Ouro", xp: 400 },
  lenda: { name: "Lendária", xp: 1000 },
};
// Bônus a cada vez que um streak alcança o marco (vale de novo depois de quebrar)
const PLAYER_STREAK_MILESTONES = [
  { days: 7, xp: 100 },
  { days: 30, xp: 300 },
  { days: 100, xp: 1000 },
  { days: 365, xp: 3000 },
];

// XP para ir do nível n para o n+1: 60·n + 3·n², arredondado para dezenas.
function playerXpToNext(level) {
  return Math.round((60 * level + 3 * level * level) / 10) * 10;
}

function playerLevelInfo(xp) {
  let level = 1;
  let start = 0;
  while (level < 999 && xp >= start + playerXpToNext(level)) {
    start += playerXpToNext(level);
    level += 1;
  }
  const need = playerXpToNext(level);
  return { level, start, need, into: xp - start, next: start + need, ratio: Math.min(1, (xp - start) / need) };
}

const PLAYER_LEVEL_TITLES = [
  { min: 1, icon: "🐣", name: "Frango de Academia" },
  { min: 5, icon: "🍗", name: "Frango com Pré-Treino" },
  { min: 10, icon: "🐀", name: "Rato de Academia" },
  { min: 15, icon: "🧱", name: "Shape em Obras" },
  { min: 20, icon: "🎖️", name: "Herói Classe C" },
  { min: 25, icon: "🥉", name: "Herói Classe B" },
  { min: 30, icon: "🥈", name: "Herói Classe A" },
  { min: 40, icon: "🥇", name: "Herói Classe S" },
  { min: 50, icon: "🤖", name: "Discípulo do Careca" },
  { min: 60, icon: "👊", name: "Saitama" },
];

function playerLevelTitle(level) {
  return [...PLAYER_LEVEL_TITLES].reverse().find((t) => level >= t.min) || PLAYER_LEVEL_TITLES[0];
}

const PLAYER_LEVEL_LINES = [
  { below: 5, lines: ["O frango bateu as asinhas! 🐣", "Saiu do ovo. Agora é só não voltar pro sofá.", "Pequeno passo pro frango, grande passo pro shape."] },
  { below: 10, lines: ["O pré-treino bateu. Segura o coração!", "Já dá pra postar foto no espelho da academia.", "A balança começou a te respeitar."] },
  { below: 20, lines: ["A recepção da academia já sabe seu nome.", "Shape em obras: a prefeitura liberou o alvará.", "O personal já anda com medo de você."] },
  { below: 30, lines: ["A Associação de Heróis quer seu currículo.", "Monstros da vizinhança já mudaram de bairro.", "Você virou referência no grupo da família."] },
  { below: 50, lines: ["Classe S. O careca já te segue no Insta.", "As barras dobram só de você olhar.", "Você não treina: você dá manutenção na lenda."] },
  { below: Infinity, lines: ["OK. 👊", "Um soco. Só um. E o shape veio.", "Você ficou careca de tanto treinar? Respeito."] },
];

const PLAYER_XP_LINES = [
  "O shape agradece.",
  "Mais um tijolo no castelo.",
  "O careca aprova.",
  "A barra de XP sentiu.",
  "Isso aí, monstro!",
  "Frango hoje, lenda amanhã.",
];

/* ---------------------------------------------------------------------
 * Conquistas
 * metric(stats) -> número; desbloqueia quando chega em goal.
 * ------------------------------------------------------------------- */
const PLAYER_ACHIEVEMENT_CATS = [
  { id: "treinos", name: "🏋️ Treinos" },
  { id: "peso", name: "💪 Peso levantado" },
  { id: "multidao", name: "🐘 Manadas & multidões" },
  { id: "distancia", name: "🌍 Distância" },
  { id: "energia", name: "🔥 Energia" },
  { id: "saitama", name: "👊 Saitama" },
  { id: "musculos", name: "🗺️ Mapa de calor" },
  { id: "recordes", name: "📈 Recordes" },
  { id: "streak", name: "🔥 Streak" },
  { id: "pesagem", name: "⚖️ Pesagem" },
  { id: "rotina", name: "✅ Rotina" },
  { id: "cozinha", name: "🍳 Cozinha" },
];

// Tamanho do livro de receitas pra conquista "Zerou o livro" (sem kitchen-recipes.js = inalcançável)
const KITCHEN_BOOK_SIZE = typeof KITCHEN_RECIPES !== "undefined" ? KITCHEN_RECIPES.length : Infinity;

const PLAYER_SAITAMA_GOAL = 100 * 365 * 3 * 3; // 100 de cada por dia durante 3 anos

// Nível das conquistas de peso, por id (ver buildPlayerAchievements).
const PLAYER_LIFT_TIERS = {
  "lift-gato": "bronze", "lift-caramelo": "bronze", "lift-pessoa": "bronze", "lift-moto": "bronze",
  "lift-leao": "prata", "lift-piano": "prata", "lift-fusca": "prata", "lift-hipopotamo": "prata", "lift-elefante": "prata",
  "lift-onibus": "ouro", "lift-boeing": "ouro", "lift-liberdade": "ouro", "lift-cristo": "ouro",
  "lift-eiffel": "lenda", "lift-titanic": "lenda",
  // v1.47
  "lift-tanque": "prata", "lift-rodotrem": "prata", "lift-baleia": "prata",
  "lift-a380": "ouro", "lift-747-lotado": "ouro", "lift-falcon9": "ouro", "lift-trem-bala": "ouro",
  "lift-belaz": "ouro", "lift-longa-marcha": "ouro", "lift-baalbek": "ouro",
};

/* Manadas & multidões (v1.47): coleções de coisa pesada. Mesmo número do
 * Hall (kg levantado da vida toda), com o peso de cada item tirado da escala
 * WORKOUT_LIFT_EQUIVALENTS (boi e torcedor têm peso próprio aqui).
 * XP = metade do nível (é o mesmo número que já dá os marcos sozinhos).
 * mystery: bloqueada aparece como ??? (com dica e barra). Ids gravados no
 * seen do perfil: nunca troque. */
const PLAYER_CROWD_XP = { bronze: 25, prata: 75, ouro: 200, lenda: 500 };
const PLAYER_BOI_KG = 500; // boi gordo vivo, ~500 kg
const PLAYER_TORCEDOR_KG = 75;
const PLAYER_MARACANA = 78838; // lugares do Maracanã

function buildPlayerCrowdAchievements() {
  const kg = (id) => WORKOUT_LIFT_EQUIVALENTS.find((item) => item.id === id)?.size || 0;
  const fmt = (value) => (value >= 1000 ? `${Number((value / 1000).toFixed(1)).toLocaleString("pt-BR")} t` : `${value.toLocaleString("pt-BR")} kg`);
  const arca = 2 * ["lift-gato", "lift-caramelo", "lift-leao", "lift-hipopotamo", "lift-elefante", "lift-baleia"].reduce((sum, id) => sum + kg(id), 0);
  const items = [
    { id: "gr-gatos", tier: "bronze", icon: "🐈", name: "Gateiro profissional", count: 50, each: kg("lift-gato"), unit: "gatos", desc: "Uma colônia inteira no colo, e nenhum pediu.", hint: "Miau em escala industrial." },
    { id: "gr-caramelos", tier: "bronze", icon: "🐕", name: "Abrigo de caramelos", count: 100, each: kg("lift-caramelo"), unit: "caramelos", desc: "Adotou todos de uma vez. No supino.", hint: "Patrimônio nacional, no atacado." },
    { id: "gr-leoes", tier: "bronze", icon: "🦁", name: "Bando do Rei Leão", count: 20, each: kg("lift-leao"), unit: "leões", desc: "Hakuna matata pra lombar.", hint: "Juba, rugido e uma savana inteira." },
    { id: "gr-metro", tier: "prata", icon: "🚇", name: "Vagão do metrô às 18h", count: 300, each: kg("lift-pessoa"), unit: "pessoas", desc: "Lotado, abafado e você ainda segurou a porta.", hint: "Hora do rush em São Paulo." },
    { id: "gr-fuscas", tier: "prata", icon: "🚗", name: "Estacionamento de Fuscas", count: 50, each: kg("lift-fusca"), unit: "Fuscas", desc: "Um encontro de antigos inteiro, sem manobrista.", hint: "Um pátio cheio de besouro." },
    { id: "gr-elefantes", tier: "prata", icon: "🐘", name: "Manada de elefantes", count: 10, each: kg("lift-elefante"), unit: "elefantes", desc: "A manada inteira, com tromba e tudo.", hint: "Um monte de bicho de tromba.", title: "🐘 Dono da Manada" },
    { id: "gr-boiada", tier: "ouro", icon: "🐂", name: "Passando a boiada", count: 300, each: PLAYER_BOI_KG, unit: "bois", desc: "Uma boiada inteira. O peão pediu demissão.", hint: "Muuuuita coisa passando." },
    { id: "gr-arca", tier: "ouro", icon: "🛶", name: "Arca de Noé", goalKg: arca, conta: `2 de cada bicho do Hall: gato, caramelo, leão, hipopótamo, elefante e baleia-azul = ${fmt(arca)}`, desc: "Dois de cada. O dilúvio que espere.", hint: "Dois de cada bicho, rumo ao barco.", title: "🛶 Capitão Noé" },
    { id: "gr-baleias", tier: "ouro", icon: "🐳", name: "Família de baleias", count: 5, each: kg("lift-baleia"), unit: "baleias-azuis", desc: "Pai, mãe e três filhotes. Natação nunca mais.", hint: "Uma família do maior bicho do mundo." },
    { id: "gr-onibus", tier: "ouro", icon: "🚌", name: "Garagem de ônibus", count: 50, each: kg("lift-onibus"), unit: "ônibus", desc: "A frota toda. O motorista ficou a pé.", hint: "Uma garagem inteira de busão." },
    { id: "gr-desfile", tier: "ouro", icon: "🪖", name: "Desfile de 7 de Setembro", count: 12, each: kg("lift-tanque"), unit: "tanques Leopard 2", desc: "Os blindados do desfile, em fila indiana, nas suas costas.", hint: "Feriado, Esplanada e esteira de blindado.", title: "🪖 General do Supino" },
    { id: "gr-maracana", tier: "lenda", icon: "🏟️", name: "Maracanã lotado", count: PLAYER_MARACANA, each: PLAYER_TORCEDOR_KG, unit: "torcedores", desc: "O estádio inteiro, com a torcida cantando.", hint: "Uma final inteira de arquibancada.", title: "🏟️ Levanta Arquibancada" },
    { id: "gr-aeroporto", tier: "lenda", icon: "✈️", name: "Pátio de aeroporto", count: 20, each: kg("lift-747-lotado"), unit: "Boeings 747 lotados", desc: "O pátio inteiro de jumbos prontos pra decolar.", hint: "Um pátio cheio de jumbo lotado.", title: "✈️ Controlador de Pátio" },
  ];
  return items.map((item) => {
    const goal = item.goalKg || item.count * item.each;
    const conta = item.conta || `${item.count.toLocaleString("pt-BR")} ${item.unit} × ${fmt(item.each)} = ${fmt(goal)}`;
    return {
      id: item.id, cat: "multidao", tier: item.tier, icon: item.icon, name: item.name, mystery: true,
      desc: `${item.desc} (${conta})`,
      hint: `${item.hint} Some ${fmt(goal)} levantados.`,
      metric: (s) => s.liftKg, goal, xp: PLAYER_CROWD_XP[item.tier], title: item.title,
    };
  });
}

// Bloqueada e escondida (lendária ou secreta): mostra ??? no lugar do nome.
function isPlayerAchievementHidden(a, state) {
  return (a.tier === "lenda" || a.mystery) && !state.unlockedIds.has(a.id);
}

function buildPlayerAchievements() {
  const list = [
    { id: "tr-1", cat: "treinos", tier: "bronze", icon: "🐣", name: "Primeiro passo", desc: "Registrou o primeiro treino. O sofá sentiu sua falta.", hint: "Registre 1 treino.", metric: (s) => s.workouts, goal: 1 },
    { id: "tr-10", cat: "treinos", tier: "bronze", icon: "🔟", name: "Pegou gosto", desc: "10 treinos. Já não é fogo de palha.", hint: "Registre 10 treinos.", metric: (s) => s.workouts, goal: 10 },
    { id: "tr-50", cat: "treinos", tier: "prata", icon: "🎟️", name: "Frequentador assíduo", desc: "50 treinos. A catraca te conhece.", hint: "Registre 50 treinos.", metric: (s) => s.workouts, goal: 50 },
    { id: "tr-100", cat: "treinos", tier: "ouro", icon: "💯", name: "Centenário", desc: "100 treinos. Isso já é estilo de vida.", hint: "Registre 100 treinos.", metric: (s) => s.workouts, goal: 100, title: "💯 Rato Centenário" },
    { id: "tr-250", cat: "treinos", tier: "ouro", icon: "🏛️", name: "Mobília da academia", desc: "250 treinos. Cobram IPTU de você lá.", hint: "Registre 250 treinos.", metric: (s) => s.workouts, goal: 250 },
    { id: "tr-500", cat: "treinos", tier: "lenda", icon: "🗿", name: "Patrimônio da academia", desc: "500 treinos. Tombado pelo patrimônio histórico.", hint: "Registre 500 treinos.", metric: (s) => s.workouts, goal: 500, title: "🗿 Patrimônio Tombado" },
    { id: "tr-tipos", cat: "treinos", tier: "prata", icon: "🎭", name: "Multiatleta", desc: "Fez 4 tipos diferentes de treino. Versátil igual canivete suíço.", hint: "Faça 4 tipos diferentes de treino.", metric: (s) => s.types, goal: 4 },
    { id: "tr-fds", cat: "treinos", tier: "bronze", icon: "📅", name: "Guerreiro de fim de semana", desc: "Treinou no sábado E no domingo. O churrasco esperou.", hint: "Treine no sábado e no domingo da mesma semana.", metric: (s) => s.weekend, goal: 1 },
  ];
  // Nível de cada marco fixado por id (desde v1.47): antes era pela posição na
  // lista, e marco novo no meio mudaria o nível (e o XP) das conquistas antigas.
  const liftTitles = { "lift-cristo": "🙌 Abraçador de Cristo", "lift-titanic": "🚢 Rebocador de Titanic" };
  const liftArticles = { "lift-pessoa": "uma", "lift-moto": "uma", "lift-liberdade": "a", "lift-cristo": "o", "lift-eiffel": "a", "lift-titanic": "o", "lift-baleia": "uma", "lift-baalbek": "a" };
  WORKOUT_LIFT_EQUIVALENTS.forEach((item) => list.push({
    id: item.id, cat: "peso", tier: PLAYER_LIFT_TIERS[item.id] || "ouro", icon: item.icon,
    name: `Levantou ${liftArticles[item.id] || "um"} ${item.one}`,
    desc: `${item.note} (${Number(item.size).toLocaleString("pt-BR")} kg no total)`,
    hint: `Some ${Number(item.size).toLocaleString("pt-BR")} kg levantados.`,
    metric: (s) => s.liftKg, goal: item.size, title: liftTitles[item.id],
  }));
  list.push(...buildPlayerCrowdAchievements());
  const kmTier = (i) => (i < 3 ? "bronze" : i < 6 ? "prata" : i < 9 ? "ouro" : "lenda");
  WORKOUT_DISTANCE_DESTINATIONS.forEach((item, i) => list.push({
    id: item.id, cat: "distancia", tier: kmTier(i), icon: item.icon, name: item.label,
    desc: `Você ${item.done}. ${item.note}`,
    hint: `Some ${Number(item.size).toLocaleString("pt-BR")} km.`,
    metric: (s) => s.km, goal: item.size, title: item.id === "km-mundo" ? "🌍 Magalhães de Tênis" : undefined,
  }));
  list.push(
    { id: "kcal-1k", cat: "energia", tier: "bronze", icon: "🕯️", name: "Fogareiro", desc: "1.000 kcal queimadas. Já dá pra uma pizza (fatia, hein).", hint: "Queime 1.000 kcal.", metric: (s) => s.kcal, goal: 1000 },
    { id: "kcal-10k", cat: "energia", tier: "prata", icon: "🍖", name: "Churrasqueira", desc: "10.000 kcal. A picanha pede licença.", hint: "Queime 10.000 kcal.", metric: (s) => s.kcal, goal: 10000 },
    { id: "kcal-50k", cat: "energia", tier: "ouro", icon: "🏭", name: "Alto-forno", desc: "50.000 kcal. A siderúrgica quer te contratar.", hint: "Queime 50.000 kcal.", metric: (s) => s.kcal, goal: 50000 },
    { id: "kcal-100k", cat: "energia", tier: "lenda", icon: "☢️", name: "Reator nuclear", desc: "100.000 kcal. A Eletrobras está de olho.", hint: "Queime 100.000 kcal.", metric: (s) => s.kcal, goal: 100000, title: "☢️ Reator Humano" },
    { id: "st-fa", cat: "saitama", tier: "bronze", icon: "🥚", name: "Fã do careca", desc: "10 treinos do Saitama. Já pode comprar a capa.", hint: "Faça 10 treinos do Saitama.", metric: (s) => s.saitamaWorkouts, goal: 10 },
    { id: "st-dia", cat: "saitama", tier: "prata", icon: "👊", name: "Dia do careca", desc: "100 flexões, 100 abdominais e 100 agachamentos no mesmo dia.", hint: "Faça 100 de cada no mesmo dia (Saitama).", metric: (s) => s.carecaDay, goal: 1 },
    { id: "st-completo", cat: "saitama", tier: "ouro", icon: "🦲", name: "Careca completo", desc: "100/100/100 e 10 km de caminhada/corrida no mesmo dia. Cadê o cabelo?", hint: "100 de cada + um treino de Caminhada / Corrida somando 10 km, no mesmo dia.", metric: (s) => s.carecaFull, goal: 1, title: "🦲 Careca Honorário" },
    { id: "st-1", cat: "saitama", tier: "bronze", icon: "🌱", name: "1% do careca", desc: "1% das repetições de 3 anos de Saitama.", hint: "Chegue a 1% da meta de 3 anos do Saitama.", metric: (s) => s.saitamaReps, goal: PLAYER_SAITAMA_GOAL * 0.01 },
    { id: "st-10", cat: "saitama", tier: "prata", icon: "🌿", name: "10% do careca", desc: "10% do treino lendário. O careca acenou.", hint: "Chegue a 10% da meta de 3 anos do Saitama.", metric: (s) => s.saitamaReps, goal: PLAYER_SAITAMA_GOAL * 0.1 },
    { id: "st-50", cat: "saitama", tier: "ouro", icon: "🌳", name: "Meio careca", desc: "Metade do treino lendário. Começou a cair o cabelo?", hint: "Chegue a 50% da meta de 3 anos do Saitama.", metric: (s) => s.saitamaReps, goal: PLAYER_SAITAMA_GOAL * 0.5 },
    { id: "st-100", cat: "saitama", tier: "lenda", icon: "🦸", name: "O próprio careca", desc: "Você fez os 3 anos do Saitama. Um soco resolve tudo agora.", hint: "Complete a meta de 3 anos do Saitama.", metric: (s) => s.saitamaReps, goal: PLAYER_SAITAMA_GOAL, title: "👊 O Próprio Careca" },
    { id: "mu-todos", cat: "musculos", tier: "prata", icon: "🗺️", name: "Corpo completo", desc: "Treinou todos os grupos musculares pelo menos uma vez.", hint: "Treine todos os músculos do mapa de calor.", metric: (s) => s.groups, goal: STRENGTH_GROUPS.length },
    { id: "mu-mes", cat: "musculos", tier: "ouro", icon: "🦵", name: "Não pula perna", desc: "Todos os grupos musculares no mesmo mês. Simetria é tudo.", hint: "Treine todos os músculos no mesmo mês.", metric: (s) => s.monthGroups, goal: STRENGTH_GROUPS.length, title: "🦵 Não Pula Perna" },
    { id: "pr-1", cat: "recordes", tier: "bronze", icon: "📈", name: "Superou a si mesmo", desc: "Primeiro recorde pessoal batido.", hint: "Bata um recorde pessoal.", metric: (s) => s.records, goal: 1 },
    { id: "pr-10", cat: "recordes", tier: "prata", icon: "🚀", name: "Viciado em recorde", desc: "10 recordes pessoais. O você de ontem chora.", hint: "Bata 10 recordes pessoais.", metric: (s) => s.records, goal: 10 },
    { id: "pr-50", cat: "recordes", tier: "ouro", icon: "🏆", name: "Máquina de recordes", desc: "50 recordes pessoais. Já pode cobrar ingresso.", hint: "Bata 50 recordes pessoais.", metric: (s) => s.records, goal: 50, title: "📈 Máquina de Recordes" },
    { id: "sk-7", cat: "streak", tier: "bronze", icon: "🔥", name: "Uma semana pegando fogo", desc: "Streak de 7 dias.", hint: "Chegue a um streak de 7 dias.", metric: (s) => s.streakBest, goal: 7 },
    { id: "sk-30", cat: "streak", tier: "prata", icon: "🌋", name: "Um mês de vulcão", desc: "Streak de 30 dias. Hábito criado.", hint: "Chegue a um streak de 30 dias.", metric: (s) => s.streakBest, goal: 30 },
    { id: "sk-100", cat: "streak", tier: "ouro", icon: "☄️", name: "Inquebrável", desc: "Streak de 100 dias. Nem feriado te para.", hint: "Chegue a um streak de 100 dias.", metric: (s) => s.streakBest, goal: 100, title: "🔥 Inquebrável" },
    { id: "sk-365", cat: "streak", tier: "lenda", icon: "🌞", name: "Um ano pegando fogo", desc: "Streak de 365 dias. Você é o sol agora.", hint: "Chegue a um streak de 365 dias.", metric: (s) => s.streakBest, goal: 365, title: "🌞 Um Ano Pegando Fogo" },
    { id: "wi-10", cat: "pesagem", tier: "bronze", icon: "⚖️", name: "Amigo da balança", desc: "10 pesagens registradas.", hint: "Registre 10 pesagens.", metric: (s) => s.weighIns, goal: 10 },
    { id: "wi-50", cat: "pesagem", tier: "prata", icon: "📏", name: "Íntimo da balança", desc: "50 pesagens. Ela já sabe seu signo.", hint: "Registre 50 pesagens.", metric: (s) => s.weighIns, goal: 50 },
    { id: "rt-1", cat: "rotina", tier: "bronze", icon: "🧹", name: "Adulto funcional", desc: "Primeira tarefa da rotina feita. Sua mãe sorriu.", hint: "Marque uma tarefa no Toba Routine.", metric: (s) => s.routineTasks, goal: 1 },
    { id: "rt-50", cat: "rotina", tier: "prata", icon: "🏠", name: "Dono de casa", desc: "50 tarefas feitas. A casa agradece.", hint: "Faça 50 tarefas da rotina.", metric: (s) => s.routineTasks, goal: 50 },
    { id: "rt-250", cat: "rotina", tier: "ouro", icon: "💼", name: "CEO da própria vida", desc: "250 tarefas. Já pode dar palestra de produtividade.", hint: "Faça 250 tarefas da rotina.", metric: (s) => s.routineTasks, goal: 250, title: "💼 CEO da Própria Vida" },
    { id: "rt-monge", cat: "rotina", tier: "prata", icon: "🧘", name: "Monge tibetano", desc: "10 tarefas difíceis feitas. Proatividade nível templo.", hint: "Faça 10 tarefas difíceis.", metric: (s) => s.routineHard, goal: 10 },
    { id: "rt-sono", cat: "rotina", tier: "bronze", icon: "😴", name: "Sono de bebê", desc: "7 dias seguidos dormindo na hora. O travesseiro te ama.", hint: "Faça 7 seguidas uma tarefa de dormir na hora.", metric: (s) => s.routineSleepSeq, goal: 7 },
    { id: "rt-seq7", cat: "rotina", tier: "bronze", icon: "⛓️", name: "Hábito de ferro", desc: "7 vezes seguidas a mesma tarefa.", hint: "Faça 7 vezes seguidas a mesma tarefa.", metric: (s) => s.routineBestSeq, goal: 7 },
    { id: "rt-seq30", cat: "rotina", tier: "ouro", icon: "🔩", name: "Hábito de titânio", desc: "30 vezes seguidas a mesma tarefa. Virou piloto automático.", hint: "Faça 30 vezes seguidas a mesma tarefa.", metric: (s) => s.routineBestSeq, goal: 30 },
    { id: "rt-seq100", cat: "rotina", tier: "lenda", icon: "🛡️", name: "Hábito de vibranium", desc: "100 vezes seguidas. Nem o Thanos te para.", hint: "Faça 100 vezes seguidas a mesma tarefa.", metric: (s) => s.routineBestSeq, goal: 100, title: "🛡️ Inabalável" },
    { id: "rt-perfeito", cat: "rotina", tier: "prata", icon: "✨", name: "Dia perfeito", desc: "Todas as tarefas do dia feitas no dia.", hint: "Faça todas as tarefas de um dia (mínimo 2) no próprio dia.", metric: (s) => s.routinePerfect, goal: 1 },
    { id: "rt-perfeito7", cat: "rotina", tier: "ouro", icon: "🌟", name: "7 dias perfeitos", desc: "Sete dias com tudo feito. Quem é você e o que fez com o preguiçoso?", hint: "Tenha 7 dias perfeitos.", metric: (s) => s.routinePerfect, goal: 7 },
    { id: "tk-1", cat: "rotina", tier: "bronze", icon: "🛠️", name: "Resolvedor", desc: "Primeira task terminada. Saiu do 'um dia eu faço'.", hint: "Termine uma task no Toba Routine.", metric: (s) => s.routineOneoffs, goal: 1 },
    { id: "tk-10", cat: "rotina", tier: "prata", icon: "🧰", name: "Faz-tudo", desc: "10 tasks terminadas. O marido de aluguel tá com medo da concorrência.", hint: "Termine 10 tasks.", metric: (s) => s.routineOneoffs, goal: 10 },
    { id: "tk-grande", cat: "rotina", tier: "prata", icon: "🧱", name: "Pedreiro de fim de semana", desc: "Terminou uma task de 4 horas ou mais. Merece uma cerveja.", hint: "Termine uma task de 4 h ou mais.", metric: (s) => s.routineBigOneoff, goal: 1 },
    { id: "tk-50", cat: "rotina", tier: "ouro", icon: "🏗️", name: "Empreiteiro", desc: "50 tasks terminadas. Já pode abrir CNPJ.", hint: "Termine 50 tasks.", metric: (s) => s.routineOneoffs, goal: 50, title: "🏗️ Empreiteiro" },
    // Toba Kitchen (desde v1.44; números de calcKitchenPlayer em kitchen-recipes.js)
    { id: "kt-1", cat: "cozinha", tier: "bronze", icon: "🍳", name: "Adeus, miojo", desc: "Primeira receita do livro feita. O miojo sentiu a traição.", hint: "Faça uma receita do Toba Kitchen.", metric: (s) => s.kitchenCooked, goal: 1 },
    { id: "kt-10", cat: "cozinha", tier: "prata", icon: "👨‍🍳", name: "Cozinheiro de respeito", desc: "10 receitas feitas. A vizinhança já sente o cheiro.", hint: "Faça 10 receitas.", metric: (s) => s.kitchenCooked, goal: 10 },
    { id: "kt-50", cat: "cozinha", tier: "ouro", icon: "🔪", name: "Chef de cozinha", desc: "50 receitas feitas. O Jacquin aprovaria (talvez).", hint: "Faça 50 receitas.", metric: (s) => s.kitchenCooked, goal: 50, title: "👨‍🍳 Chef Toba" },
    { id: "kt-100", cat: "cozinha", tier: "lenda", icon: "🏆", name: "MasterChef Toba", desc: "100 receitas feitas. É uma vergonha pra profissão... dos outros.", hint: "Faça 100 receitas.", metric: (s) => s.kitchenCooked, goal: 100, title: "🏆 MasterChef" },
    { id: "kt-livro", cat: "cozinha", tier: "ouro", icon: "📖", name: "Zerou o livro", desc: "Fez todas as receitas do livro. Receita nova chegou? Tranca de novo até fazer ela também (DLC de comida).", hint: "Faça todas as receitas do Livro de Receitas.", metric: (s) => s.kitchenDistinct, goal: KITCHEN_BOOK_SIZE },
    { id: "kt-tipos", cat: "cozinha", tier: "prata", icon: "🍽️", name: "Cardápio completo", desc: "Já fez café, almoço, lanche, janta e sobremesa.", hint: "Faça uma receita de cada refeição (café, almoço, lanche, janta e sobremesa).", metric: (s) => s.kitchenMeals, goal: 5 },
    { id: "kt-dia", cat: "cozinha", tier: "ouro", icon: "🌞", name: "Rango o dia inteiro", desc: "Café, almoço e janta feitos no mesmo dia. iFood chorou.", hint: "Faça café, almoço e janta no mesmo dia.", metric: (s) => s.kitchenFullDay, goal: 1 },
    { id: "kt-gambiarra", cat: "cozinha", tier: "bronze", icon: "🩹", name: "Gambiarra gourmet", desc: "Fez a receita faltando um ingrediente. Ninguém percebeu (mentira).", hint: "Faça uma receita faltando 1 ingrediente (marcado no 🧺 O que tem aí?).", metric: (s) => s.kitchenImprovised, goal: 1 },
    { id: "kt-gambiarra10", cat: "cozinha", tier: "ouro", icon: "🧪", name: "Cientista maluco", desc: "10 receitas com ingrediente faltando. Isso já é outra receita.", hint: "Faça 10 receitas faltando 1 ingrediente.", metric: (s) => s.kitchenImprovised, goal: 10, title: "🧪 Rei da Gambiarra" },
    { id: "kt-casa", cat: "cozinha", tier: "bronze", icon: "🏠", name: "Prato da casa", desc: "A mesma receita 5 vezes. Já é tradição de família.", hint: "Faça a mesma receita 5 vezes.", metric: (s) => s.kitchenRepeat, goal: 5 },
    { id: "kt-paciencia", cat: "cozinha", tier: "prata", icon: "🫘", name: "Paciência de feijoada", desc: "Fez uma receita de 2 horas ou mais. Mereceu a sesta.", hint: "Faça uma receita de 2 h ou mais.", metric: (s) => s.kitchenLong, goal: 1 },
    { id: "kt-formiga", cat: "cozinha", tier: "bronze", icon: "🐜", name: "Formiga", desc: "5 sobremesas feitas. O dentista mandou um abraço.", hint: "Faça 5 sobremesas.", metric: (s) => s.kitchenSweet, goal: 5 },
    { id: "kt-larica", cat: "cozinha", tier: "bronze", icon: "🌙", name: "Larica da madrugada", desc: "Cozinhou entre meia-noite e 5 da manhã. A geladeira tem câmera.", hint: "Termine uma receita entre 0h e 5h.", metric: (s) => s.kitchenNight, goal: 1 },
    { id: "kt-semana", cat: "cozinha", tier: "prata", icon: "📅", name: "Semana no controle", desc: "7 receitas da programação feitas na mesma semana. Planejou e cumpriu!", hint: "Marque 7 receitas da Programação da Semana como feitas na mesma semana.", metric: (s) => s.kitchenWeekPlan, goal: 7 },
  );
  return list;
}

const PLAYER_ACHIEVEMENTS = buildPlayerAchievements();

/* ---------------------------------------------------------------------
 * Recompensas (só visuais). Liberadas por nível ou por conquista.
 * ------------------------------------------------------------------- */
const PLAYER_AVATARS = [
  { id: "pintinho", icon: "🐣", level: 1 },
  { id: "frango", icon: "🐔", level: 5 },
  { id: "rato", icon: "🐀", level: 10 },
  { id: "gorila", icon: "🦍", level: 20 },
  { id: "heroi", icon: "🦸", level: 30 },
  { id: "robo", icon: "🤖", level: 50 },
  { id: "soco", icon: "👊", level: 60 },
  { id: "gato", icon: "🐈", achievement: "lift-gato" },
  { id: "caramelo", icon: "🐕", achievement: "lift-caramelo" },
  { id: "leao", icon: "🦁", achievement: "lift-leao" },
  { id: "elefante", icon: "🐘", achievement: "lift-elefante" },
  { id: "baleia", icon: "🐋", achievement: "lift-baleia" },
  { id: "boi", icon: "🐂", achievement: "gr-boiada" },
  { id: "planeta", icon: "🌍", achievement: "km-mundo" },
  { id: "vulcao", icon: "🌋", achievement: "sk-30" },
  { id: "careca", icon: "🦲", achievement: "st-completo" },
];
const PLAYER_FRAMES = [
  { id: "simples", name: "Simples", level: 1 },
  { id: "bronze", name: "Bronze", level: 5 },
  { id: "prata", name: "Prata", level: 15 },
  { id: "ouro", name: "Ouro", level: 25 },
  { id: "diamante", name: "Diamante", level: 40 },
  { id: "chamas", name: "Em chamas", level: 50 },
  { id: "brasa", name: "Brasa", achievement: "sk-100" },
  { id: "arquibancada", name: "Arquibancada", achievement: "gr-maracana" },
];
const PLAYER_COLORS = [
  { id: "azul", name: "Azul", color: "#58a6ff", level: 1 },
  { id: "verde", name: "Verde", color: "#3fb950", level: 3 },
  { id: "roxo", name: "Roxo", color: "#bc8cff", level: 10 },
  { id: "coral", name: "Coral", color: "#ff7b72", level: 15 },
  { id: "dourado", name: "Dourado", color: "#e3b341", level: 20 },
  { id: "rosa", name: "Rosa", color: "#f778ba", level: 30 },
  { id: "arcoiris", name: "Arco-íris", color: "linear-gradient(90deg,#f85149,#e3b341,#3fb950,#58a6ff,#bc8cff)", level: 45 },
];

function isPlayerRewardUnlocked(item, state) {
  if (item.achievement) return state.unlockedIds.has(item.achievement);
  return state.level >= (item.level || 1);
}

// O que aparece no perfil: escolhido (se ainda liberado) ou o melhor liberado.
function getPlayerLook(state) {
  const eq = playerDb.equipped;
  const pick = (list, id) => {
    const chosen = list.find((item) => item.id === id && isPlayerRewardUnlocked(item, state));
    if (chosen) return chosen;
    const byLevel = list.filter((item) => !item.achievement && isPlayerRewardUnlocked(item, state));
    return byLevel[byLevel.length - 1] || list[0];
  };
  const levelTitle = playerLevelTitle(state.level);
  const titles = getPlayerTitles(state).filter((t) => t.unlocked);
  const title = titles.find((t) => t.id === eq.title) || { id: "", icon: levelTitle.icon, name: levelTitle.name };
  return { avatar: pick(PLAYER_AVATARS, eq.avatar), frame: pick(PLAYER_FRAMES, eq.frame), color: pick(PLAYER_COLORS, eq.color), title };
}

// Títulos: os de nível já alcançados + os que vêm de conquistas.
function getPlayerTitles(state) {
  const fromLevels = PLAYER_LEVEL_TITLES.map((t) => ({ id: `nivel-${t.min}`, icon: t.icon, name: t.name, need: `Nível ${t.min}`, unlocked: state.level >= t.min }));
  const fromAchievements = PLAYER_ACHIEVEMENTS.filter((a) => a.title).map((a) => {
    const [icon, ...rest] = a.title.split(" ");
    return { id: `conq-${a.id}`, icon, name: rest.join(" "), need: isPlayerAchievementHidden(a, state) ? "Conquista ???" : `Conquista: ${a.name}`, unlocked: state.unlockedIds.has(a.id) };
  });
  return [...fromLevels, ...fromAchievements];
}

/* ---------------------------------------------------------------------
 * Banco do perfil (TOBA_PLAYER_DB)
 * ------------------------------------------------------------------- */
let isPlayerDbLoaded = false;
let playerIsNew = false;

function createEmptyPlayerDb() {
  return {
    v: 1,
    createdAt: toIsoDate(),
    settings: { weeklyGoal: 3 },
    seen: { xp: 0, level: 1, achievements: [] },
    equipped: { title: "", avatar: "", frame: "", color: "" },
  };
}

function normalizePlayerDb(db) {
  if (!db || typeof db !== "object" || Array.isArray(db)) throw new Error("Formato de perfil inválido");
  const isObj = (value) => value && typeof value === "object" && !Array.isArray(value);
  if (!db.v) db.v = 1;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(db.createdAt || ""))) db.createdAt = toIsoDate();
  if (!isObj(db.settings)) db.settings = {};
  const goal = Math.round(Number(db.settings.weeklyGoal));
  db.settings.weeklyGoal = goal >= 1 && goal <= 7 ? goal : 3;
  if (!isObj(db.seen)) db.seen = {};
  db.seen.xp = Math.max(0, Number(db.seen.xp) || 0);
  db.seen.level = Math.max(1, Math.round(Number(db.seen.level)) || 1);
  db.seen.achievements = Array.isArray(db.seen.achievements) ? db.seen.achievements.map(String) : [];
  if (!isObj(db.equipped)) db.equipped = {};
  ["title", "avatar", "frame", "color"].forEach((key) => {
    db.equipped[key] = typeof db.equipped[key] === "string" ? db.equipped[key] : "";
  });
  return db;
}

function loadPlayerDb() {
  let raw = null;
  try {
    raw = localStorage.getItem(PLAYER_KEY);
  } catch (err) {
    return createEmptyPlayerDb();
  }
  if (raw === null) {
    isPlayerDbLoaded = true;
    playerIsNew = true;
    return createEmptyPlayerDb();
  }
  try {
    const db = normalizePlayerDb(JSON.parse(raw));
    try {
      localStorage.setItem(PLAYER_BACKUP_KEY, raw);
    } catch (err) {
      console.warn("Aviso ao atualizar auto-backup do perfil:", err);
    }
    isPlayerDbLoaded = true;
    return db;
  } catch (err) {
    // Ilegível: guarda o texto original (uma cópia por conteúdo) e não grava nada.
    try {
      const prefix = PLAYER_KEY + "_CORRUPT_";
      let exists = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && localStorage.getItem(key) === raw) exists = true;
      }
      if (!exists) localStorage.setItem(prefix + Date.now(), raw);
    } catch (copyErr) {
      console.warn("Não consegui guardar a cópia do perfil ilegível:", copyErr);
    }
    console.error("Perfil do jogador ilegível:", err);
    return createEmptyPlayerDb();
  }
}

let playerDb = loadPlayerDb();

function savePlayerDb() {
  if (!isPlayerDbLoaded) return false;
  try {
    const current = localStorage.getItem(PLAYER_KEY);
    if (current) localStorage.setItem(PLAYER_BACKUP_KEY, current);
  } catch (err) {
    console.warn("Aviso ao atualizar auto-backup do perfil:", err);
  }
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(playerDb));
    playerIsNew = false;
    return true;
  } catch (err) {
    console.error("Erro ao gravar o perfil:", err);
    return false;
  }
}

function getPlayerPrefs() {
  const defaults = { sound: true, vibrate: true };
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_PREFS_KEY) || "{}");
    return { ...defaults, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch (err) {
    return defaults;
  }
}

function setPlayerPrefs(prefs) {
  try {
    localStorage.setItem(PLAYER_PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch (err) {
    return false;
  }
}

/* ---------------------------------------------------------------------
 * Cálculo (só leitura)
 * ------------------------------------------------------------------- */
const PLAYER_WORKOUT_ICONS = { saitama: "👊", walking: "🚶", bike: "🚴", elliptical: "🏃", strength: "💪", custom: "🏋️" };

function playerNum(value) {
  return Number(value) || 0;
}

function playerIsIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function playerAddDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function playerDaysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
}

function playerMonday(iso) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toIsoDate(date);
}

function readPlayerSource(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { ok: true, data: {} };
    const data = JSON.parse(raw);
    return { ok: Boolean(data && typeof data === "object" && !Array.isArray(data)), data: data || {} };
  } catch (err) {
    return { ok: false, data: {} };
  }
}

// XP de um treino (antes do teto do dia), com as partes para o extrato.
function calcPlayerWorkoutXp(workout) {
  const r = PLAYER_XP;
  let sets = 0;
  if (Array.isArray(workout.exercises)) {
    workout.exercises.forEach((exercise) => (exercise.sets || []).forEach((set) => {
      if (playerNum(set.reps) > 0) sets += 1;
    }));
  } else {
    sets = Math.max(0, Math.round(playerNum(workout.sets)));
  }
  const reps = playerNum(workout.pushups) + playerNum(workout.situps) + playerNum(workout.squats);
  const parts = {
    base: r.workoutBase,
    minutes: Math.min(Math.round(Math.max(0, playerNum(workout.durationMinutes)) * r.perMinute), r.minutesCap),
    sets: Math.min(sets * r.perSet, r.setsCap),
    reps: Math.min(Math.floor(Math.max(0, reps) / 10) * r.per10Reps, r.repsCap),
    km: Math.min(Math.round(Math.max(0, playerNum(workout.distanceKm)) * r.perKm), r.kmCap),
  };
  return { total: parts.base + parts.minutes + parts.sets + parts.reps + parts.km, parts };
}

function playerBestSet(sets) {
  let best = null;
  (sets || []).forEach((set) => {
    const reps = playerNum(set.reps);
    const kg = playerNum(set.kg);
    if (!reps) return;
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { reps, kg };
  });
  return best;
}

/* Streak "dias + meta semanal": conta DIAS desde o 1º treino da sequência.
 * Não quebra enquanto toda semana (seg–dom) fechada tiver pelo menos
 * `goal` dias com treino. A semana atual só quebra quando já não dá mais
 * para bater a meta nos dias que sobram. */
function calcPlayerStreak(trainingDays, goal, today) {
  const currentMonday = playerMonday(today);
  const week = {
    monday: currentMonday,
    days: [0, 1, 2, 3, 4, 5, 6].map((i) => playerAddDays(currentMonday, i)),
    count: 0, goal, met: false, possible: true,
  };
  const daySet = new Set(trainingDays);
  week.trained = week.days.map((day) => daySet.has(day));
  week.count = week.trained.filter(Boolean).length;
  week.met = week.count >= goal;
  const sunday = playerAddDays(currentMonday, 6);
  const daysLeft = playerDaysBetween(today, sunday) + (daySet.has(today) ? 0 : 1);
  week.daysLeft = daysLeft;
  week.possible = week.met || week.count + daysLeft >= goal;

  const result = { current: 0, best: 0, start: "", runs: [], week };
  if (!trainingDays.length) return result;

  const byWeek = {};
  trainingDays.forEach((day) => {
    const monday = playerMonday(day);
    (byWeek[monday] || (byWeek[monday] = [])).push(day);
  });

  let run = null;
  const closeRun = (endIso) => {
    if (!run) return;
    run.end = endIso;
    run.length = playerDaysBetween(run.start, endIso) + 1;
    result.runs.push(run);
    run = null;
  };
  for (let monday = playerMonday(trainingDays[0]); monday <= currentMonday; monday = playerAddDays(monday, 7)) {
    const days = (byWeek[monday] || []).sort();
    if (monday === currentMonday) {
      if (week.possible && (run || days.length)) {
        if (!run) run = { start: days[0] };
        run.alive = true;
        closeRun(today);
      } else {
        closeRun(playerAddDays(run ? run.lastWeek : monday, 6));
      }
    } else if (days.length >= goal) {
      if (!run) run = { start: days[0] };
      run.lastWeek = monday;
    } else {
      closeRun(playerAddDays(run ? run.lastWeek : monday, 6));
    }
  }
  const alive = result.runs.find((item) => item.alive);
  result.current = alive ? alive.length : 0;
  result.start = alive ? alive.start : "";
  result.best = result.runs.reduce((best, item) => Math.max(best, item.length), 0);
  return result;
}

function computePlayer(options = {}) {
  const today = toIsoDate(options.today || new Date());
  const goal = playerDb.settings.weeklyGoal;
  const healthSource = readPlayerSource("TOBA_HEALTH_DB");
  const health = healthSource.data;
  const events = []; // { date, kind, xp, icon, label }
  const unlockedAt = {}; // { achievementId: "AAAA-MM-DD" }

  const stats = {
    workouts: 0, kcal: 0, km: 0, liftKg: 0, saitamaReps: 0, saitamaWorkouts: 0,
    carecaDay: 0, carecaFull: 0, groups: 0, monthGroups: 0, records: 0,
    weekend: 0, types: 0, weighIns: 0, streakBest: 0,
    routineTasks: 0, routineHard: 0, routineBestSeq: 0, routineSleepSeq: 0, routinePerfect: 0,
    routineOneoffs: 0, routineBigOneoff: 0,
    kitchenCooked: 0, kitchenDistinct: 0, kitchenMeals: 0, kitchenFullDay: 0, kitchenImprovised: 0,
    kitchenRepeat: 0, kitchenLong: 0, kitchenSweet: 0, kitchenNight: 0, kitchenWeekPlan: 0,
  };
  const checkAchievements = (date) => {
    PLAYER_ACHIEVEMENTS.forEach((a) => {
      if (!unlockedAt[a.id] && a.metric(stats) >= a.goal) unlockedAt[a.id] = date;
    });
  };

  /* ---------- Treinos (em ordem de data) ---------- */
  const workouts = (Array.isArray(health.workouts) ? health.workouts : [])
    .map((workout, index) => ({ workout, index }))
    .filter(({ workout }) => workout && playerIsIso(workout.date) && workout.date <= today)
    .sort((a, b) => a.workout.date.localeCompare(b.workout.date) || a.index - b.index)
    .map(({ workout }) => workout);

  const dayXp = {};
  const bestSets = {};
  let bestKm = 0;
  let bestReps = 0;
  const types = new Set();
  const groups = new Set();
  const monthGroups = {};
  const weekendDays = {};
  // Careca (v1.50): 100/100/100 somando os Saitamas do DIA + 10 km de
  // Caminhada / Corrida no mesmo dia (km antigos gravados no Saitama contam).
  const carecaDays = {};
  workouts.forEach((workout) => {
    const date = workout.date;
    const icon = PLAYER_WORKOUT_ICONS[workout.type] || "🏅";
    const xp = calcPlayerWorkoutXp(workout).total;
    const used = dayXp[date] || 0;
    const granted = Math.max(0, Math.min(xp, PLAYER_XP.dayCap - used));
    dayXp[date] = used + granted;
    events.push({ date, kind: "workout", xp: granted, icon, label: String(workout.title || "Treino"), capped: granted < xp });

    // Recordes pessoais (a 1ª vez de um exercício não conta)
    const records = [];
    (Array.isArray(workout.exercises) ? workout.exercises : []).forEach((exercise) => {
      const best = playerBestSet(exercise.sets);
      if (!best || !exercise.exerciseId) return;
      const before = bestSets[exercise.exerciseId];
      if (before && (best.kg > before.kg || (best.kg === before.kg && best.reps > before.reps))) {
        records.push(`${exercise.name || exercise.exerciseId}: ${best.kg ? `${best.kg.toLocaleString("pt-BR")} kg × ${best.reps}` : `${best.reps} reps`}`);
      }
      if (!before || best.kg > before.kg || (best.kg === before.kg && best.reps > before.reps)) bestSets[exercise.exerciseId] = best;
    });
    const km = playerNum(workout.distanceKm);
    if (km > 0 && bestKm > 0 && km > bestKm) records.push(`Maior distância: ${km.toLocaleString("pt-BR")} km`);
    bestKm = Math.max(bestKm, km);
    const reps = playerNum(workout.pushups) + playerNum(workout.situps) + playerNum(workout.squats);
    if (reps > 0 && bestReps > 0 && reps > bestReps) records.push(`Mais reps do Saitama: ${reps.toLocaleString("pt-BR")}`);
    bestReps = Math.max(bestReps, reps);
    records.forEach((label, i) => {
      events.push({ date, kind: "record", xp: i < PLAYER_XP.recordsPerWorkout ? PLAYER_XP.record : 0, icon: "📈", label });
    });

    // Números acumulados para as conquistas
    stats.workouts += 1;
    stats.kcal += playerNum(workout.calories);
    stats.km += km;
    stats.liftKg += calcWorkoutLift(workout, health).kg;
    stats.records += records.length;
    if (workout.type === "saitama") {
      stats.saitamaWorkouts += 1;
      stats.saitamaReps += reps;
    }
    if (workout.type === "saitama" || workout.type === "walking") {
      const day = carecaDays[date] || (carecaDays[date] = { p: 0, s: 0, q: 0, km: 0 });
      day.km += km;
      if (workout.type === "saitama") {
        day.p += playerNum(workout.pushups);
        day.s += playerNum(workout.situps);
        day.q += playerNum(workout.squats);
      }
      if (day.p >= 100 && day.s >= 100 && day.q >= 100) {
        stats.carecaDay = 1;
        if (day.km >= 10) stats.carecaFull = 1;
      }
    }
    if (workout.type) types.add(workout.type);
    stats.types = types.size;
    const month = date.slice(0, 7);
    const monthSet = monthGroups[month] || (monthGroups[month] = new Set());
    const addGroup = (group) => {
      if (!group) return;
      groups.add(group);
      monthSet.add(group);
    };
    (Array.isArray(workout.exercises) ? workout.exercises : []).forEach((exercise) => {
      if ((exercise.sets || []).some((set) => playerNum(set.reps) > 0)) addGroup(exercise.group);
    });
    Object.keys(BODYWEIGHT_FIELDS).forEach((field) => {
      if (playerNum(workout[field]) > 0) addGroup(BODYWEIGHT_FIELDS[field].group);
    });
    stats.groups = groups.size;
    stats.monthGroups = Math.max(stats.monthGroups, monthSet.size);
    const weekDay = new Date(`${date}T12:00:00`).getDay();
    if (weekDay === 6 || weekDay === 0) {
      const monday = playerMonday(date);
      const flags = weekendDays[monday] || (weekendDays[monday] = {});
      flags[weekDay] = true;
      if (flags[6] && flags[0]) stats.weekend = 1;
    }
    checkAchievements(date);
  });

  /* ---------- Pesagens ---------- */
  // A pesagem grava data E hora ("AAAA-MM-DDTHH:MM", campo datetime-local):
  // conta pelo dia (até a v1.50 só "AAAA-MM-DD" passava e tudo dava 0).
  const weighDates = (Array.isArray(health.weighIns) ? health.weighIns : [])
    .map((w) => ({ w, day: String((w && w.date) || "").slice(0, 10) }))
    .filter(({ w, day }) => w && playerIsIso(day) && playerNum(w.weight) > 0 && day <= today)
    .map(({ day }) => day)
    .sort();
  weighDates.forEach((date) => {
    stats.weighIns += 1;
    checkAchievements(date);
  });

  /* ---------- Streak ---------- */
  const trainingDays = [...new Set(workouts.map((w) => w.date))].sort();
  const streak = calcPlayerStreak(trainingDays, goal, today);
  streak.runs.forEach((run) => {
    PLAYER_STREAK_MILESTONES.forEach((m) => {
      if (run.length < m.days) return;
      const date = playerAddDays(run.start, m.days - 1);
      events.push({ date, kind: "streak", xp: m.xp, icon: "🔥", label: `Streak de ${m.days} dias` });
      stats.streakBest = Math.max(stats.streakBest, m.days);
      checkAchievements(date);
    });
  });
  stats.streakBest = streak.best;

  /* ---------- Rotina (TOBA_ROUTINE_DB) ---------- */
  const routineSource = readPlayerSource("TOBA_ROUTINE_DB");
  const hasRoutineRules = typeof calcRoutinePlayer === "function";
  if (hasRoutineRules) {
    const routine = calcRoutinePlayer(routineSource.data, today);
    events.push(...routine.events);
    routine.timeline.forEach((step) => {
      Object.assign(stats, step.stats);
      checkAchievements(step.date);
    });
  } else {
    console.warn("toba-player: routine-metrics.js não carregado; XP da rotina fora da conta.");
  }

  /* ---------- Cozinha (TOBA_KITCHEN_DB, desde v1.44): só conquistas ---------- */
  const kitchenSource = readPlayerSource("TOBA_KITCHEN_DB");
  const hasKitchenRules = typeof calcKitchenPlayer === "function";
  if (hasKitchenRules) {
    calcKitchenPlayer(kitchenSource.data, today).timeline.forEach((step) => {
      Object.assign(stats, step.stats);
      checkAchievements(step.date);
    });
  } else {
    console.warn("toba-player: kitchen-recipes.js não carregado; conquistas da cozinha fora da conta.");
  }
  checkAchievements(today);

  /* ---------- Conquistas ---------- */
  const achievements = PLAYER_ACHIEVEMENTS.map((a) => {
    const value = a.metric(stats);
    const date = unlockedAt[a.id] || "";
    return { ...a, value, date, unlocked: Boolean(date), progress: Math.min(1, a.goal ? value / a.goal : 0), xp: a.xp ?? PLAYER_TIERS[a.tier].xp };
  });
  achievements.filter((a) => a.unlocked).forEach((a) => {
    events.push({ date: a.date, kind: "achievement", xp: a.xp, icon: a.icon, label: `Conquista: ${a.name}` });
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  const xp = events.reduce((sum, e) => sum + e.xp, 0);
  const info = playerLevelInfo(xp);
  const unlockedIds = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
  return {
    ok: healthSource.ok && routineSource.ok && hasRoutineRules && kitchenSource.ok && hasKitchenRules,
    today,
    xp,
    ...info,
    title: playerLevelTitle(info.level),
    streak,
    stats,
    achievements,
    unlockedIds,
    events,
  };
}

/* ---------------------------------------------------------------------
 * Som e vibração (opcionais; sons gerados pelo navegador, sem arquivo)
 * ------------------------------------------------------------------- */
let playerAudio = null;

function playPlayerSound(kind) {
  if (!getPlayerPrefs().sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    playerAudio = playerAudio || new Ctx();
    if (playerAudio.state === "suspended") playerAudio.resume();
    const notes = {
      xp: [[784, 0, 0.09], [1047, 0.08, 0.14]],
      achievement: [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.25]],
      levelup: [[392, 0, 0.12], [523, 0.12, 0.12], [659, 0.24, 0.12], [784, 0.36, 0.14], [1047, 0.5, 0.45], [1319, 0.5, 0.45]],
    }[kind] || [];
    const now = playerAudio.currentTime;
    notes.forEach(([freq, start, length]) => {
      const osc = playerAudio.createOscillator();
      const gain = playerAudio.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.12, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(gain).connect(playerAudio.destination);
      osc.start(now + start);
      osc.stop(now + start + length + 0.05);
    });
  } catch (err) {
    // Sem som, sem drama.
  }
}

function playerVibrate(pattern) {
  if (!getPlayerPrefs().vibrate || !navigator.vibrate) return;
  // Antes do 1º toque na página o navegador recusa (e reclama no console)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate(pattern);
  } catch (err) {
    // Aparelho sem vibração
  }
}

/* ---------------------------------------------------------------------
 * Pedaços de tela reaproveitados (portal, perfil, Treinos)
 * ------------------------------------------------------------------- */
function formatPlayerNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString("pt-BR");
}

function renderPlayerAvatar(state, size = "md") {
  const look = getPlayerLook(state);
  const isGradient = look.color.color.startsWith("linear");
  return `<span class="tp-avatar is-${size} tp-frame-${look.frame.id}" style="--tp-color:${isGradient ? "#bc8cff" : look.color.color};${isGradient ? `--tp-ring:${look.color.color}` : ""}" aria-hidden="true">
    <span class="tp-avatar-icon">${look.avatar.icon}</span>
    <span class="tp-avatar-level">${state.level}</span>
  </span>`;
}

function renderPlayerBar(ratio, extraClass = "") {
  return `<span class="tp-bar${extraClass}"><span class="tp-bar-fill" style="width:${Math.round(ratio * 1000) / 10}%"></span></span>`;
}

function describePlayerWeek(streak) {
  const w = streak.week;
  if (w.met) return `Meta da semana batida (${w.count}/${w.goal}) ✅`;
  if (!w.possible) return `Semana perdida (${w.count}/${w.goal}). Segunda recomeça.`;
  return `${w.count}/${w.goal} dias de treino nesta semana`;
}

// Card do portal (um <a> inteiro, leva ao perfil)
function renderPlayerCard(state) {
  const look = getPlayerLook(state);
  const streak = state.streak;
  return `
    ${renderPlayerAvatar(state, "md")}
    <span class="tp-card-body">
      <span class="tp-card-top">
        <span class="tp-card-title">${look.title.icon} ${escapeHtml(look.title.name)}</span>
        <span class="tp-streak-pill${streak.current ? " is-on" : ""}">🔥 ${streak.current} ${streak.current === 1 ? "dia" : "dias"}</span>
      </span>
      <span class="tp-card-level">Nível ${state.level} · ${formatPlayerNumber(state.into)}/${formatPlayerNumber(state.need)} XP</span>
      ${renderPlayerBar(state.ratio)}
      <span class="tp-card-sub">${describePlayerWeek(streak)}</span>
    </span>`;
}

// Faixa do Treinos: streak + nível, leva ao perfil
function renderPlayerStrip(state, href) {
  const streak = state.streak;
  return `
    <a class="tp-strip" href="${href}">
      <span class="tp-strip-fire${streak.current ? " is-on" : ""}">🔥</span>
      <span class="tp-strip-text">
        <strong>${streak.current} ${streak.current === 1 ? "dia" : "dias"} de streak</strong>
        <span>${describePlayerWeek(streak)}</span>
      </span>
      <span class="tp-strip-level">Nv. ${state.level}${renderPlayerBar(state.ratio, " is-mini")}</span>
      <span class="tp-strip-arrow" aria-hidden="true">›</span>
    </a>`;
}

/* ---------------------------------------------------------------------
 * Comemorações (fila: uma de cada vez)
 * ------------------------------------------------------------------- */
let playerCelebrations = Promise.resolve();

function queuePlayerCelebration(fn) {
  playerCelebrations = playerCelebrations.then(fn).catch((err) => console.error("Comemoração:", err));
  return playerCelebrations;
}

function playerRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function playerOverlayRoot() {
  let root = document.getElementById("tpLayer");
  if (!root) {
    root = document.createElement("div");
    root.id = "tpLayer";
    root.className = "tp-layer";
    document.body.appendChild(root);
  }
  return root;
}

// Aparece no topo, conta o número subindo e enche a barra.
function showPlayerXpGain(amount, before, after, reason) {
  return new Promise((resolve) => {
    const root = playerOverlayRoot();
    const el = document.createElement("div");
    el.className = "tp-xp-pop";
    el.setAttribute("role", "status");
    const leveled = after.level > before.level;
    el.innerHTML = `
      <span class="tp-xp-amount">+<span data-count>0</span> XP</span>
      <span class="tp-xp-reason">${escapeHtml(reason || playerRandom(PLAYER_XP_LINES))}</span>
      <span class="tp-xp-level">Nível ${before.level}${leveled ? ` → ${after.level} 🎉` : ""}</span>
      ${renderPlayerBar(before.ratio)}`;
    root.appendChild(el);
    playPlayerSound("xp");
    playerVibrate(40);
    const counter = el.querySelector("[data-count]");
    const fill = el.querySelector(".tp-bar-fill");
    const started = performance.now();
    const duration = Math.min(1400, 500 + amount * 3);
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      counter.textContent = formatPlayerNumber(amount * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    requestAnimationFrame(() => {
      el.classList.add("show");
      setTimeout(() => {
        fill.style.width = leveled ? "100%" : `${after.ratio * 100}%`;
      }, 150);
    });
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      el.classList.remove("show");
      setTimeout(() => {
        el.remove();
        resolve();
      }, 300);
    };
    el.addEventListener("click", close);
    setTimeout(close, 2600);
  });
}

function showPlayerAchievement(a) {
  return new Promise((resolve) => {
    const root = playerOverlayRoot();
    const el = document.createElement("div");
    el.className = `tp-ach-pop tp-tier-${a.tier}`;
    el.setAttribute("role", "status");
    el.innerHTML = `
      <span class="tp-medal tp-tier-${a.tier}">${a.icon}</span>
      <span class="tp-ach-text">
        <span class="tp-ach-kicker">🏅 Conquista ${PLAYER_TIERS[a.tier].name}!</span>
        <strong>${escapeHtml(a.name)}</strong>
        <span>+${formatPlayerNumber(a.xp)} XP${a.title ? ` · título ${escapeHtml(a.title)}` : ""}</span>
      </span>`;
    root.appendChild(el);
    playPlayerSound("achievement");
    playerVibrate([60, 40, 60]);
    requestAnimationFrame(() => el.classList.add("show"));
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      el.classList.remove("show");
      setTimeout(() => {
        el.remove();
        resolve();
      }, 300);
    };
    el.addEventListener("click", close);
    setTimeout(close, 3200);
  });
}

function playerConfetti(box) {
  const pieces = ["🎉", "✨", "💪", "🔥", "⭐", "🏆", "🍗", "💥"];
  let html = "";
  for (let i = 0; i < 26; i++) {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const time = 1.8 + Math.random() * 1.6;
    html += `<span class="tp-confetti" style="left:${left}%;animation-delay:${delay}s;animation-duration:${time}s">${playerRandom(pieces)}</span>`;
  }
  box.insertAdjacentHTML("beforeend", html);
}

// Tela cheia: level up ou boas-vindas. Fecha só no botão.
function showPlayerBigScreen({ kicker, big, title, line, extra = "", button = "Bora! 💪", sound = "levelup" }) {
  return new Promise((resolve) => {
    const root = playerOverlayRoot();
    const el = document.createElement("div");
    el.className = "tp-big";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <div class="tp-big-rays" aria-hidden="true"></div>
      <div class="tp-big-box">
        <div class="tp-big-kicker">${kicker}</div>
        <div class="tp-big-number">${big}</div>
        <div class="tp-big-title">${title}</div>
        <p class="tp-big-line">${line}</p>
        ${extra}
        <button type="button" class="btn btn-primary tp-big-btn">${button}</button>
      </div>`;
    root.appendChild(el);
    playerConfetti(el);
    playPlayerSound(sound);
    playerVibrate([80, 60, 80, 60, 200]);
    requestAnimationFrame(() => el.classList.add("show"));
    const btn = el.querySelector(".tp-big-btn");
    setTimeout(() => btn.focus({ preventScroll: true }), 300);
    btn.addEventListener("click", () => {
      el.classList.remove("show");
      setTimeout(() => {
        el.remove();
        resolve();
      }, 300);
    });
  });
}

function rewardsBetween(fromLevel, toLevel) {
  const inRange = (item) => !item.achievement && item.level > fromLevel && item.level <= toLevel;
  const parts = [];
  PLAYER_AVATARS.filter(inRange).forEach((item) => parts.push(`${item.icon} Avatar novo`));
  PLAYER_FRAMES.filter(inRange).forEach((item) => parts.push(`🖼️ Moldura ${item.name}`));
  PLAYER_COLORS.filter(inRange).forEach((item) => parts.push(`🎨 Cor ${item.name}`));
  PLAYER_LEVEL_TITLES.filter((t) => t.min > fromLevel && t.min <= toLevel).forEach((t) => parts.push(`${t.icon} Título ${t.name}`));
  return parts;
}

function showPlayerLevelUp(fromLevel, state) {
  const title = playerLevelTitle(state.level);
  const lines = (PLAYER_LEVEL_LINES.find((t) => state.level < t.below) || PLAYER_LEVEL_LINES[0]).lines;
  const rewards = rewardsBetween(fromLevel, state.level);
  const jumped = state.level - fromLevel;
  return showPlayerBigScreen({
    kicker: jumped > 1 ? `LEVEL UP ×${jumped}!` : "LEVEL UP!",
    big: `<span class="tp-big-small">Nível</span> ${state.level}`,
    title: `${title.icon} ${escapeHtml(title.name)}`,
    line: playerRandom(lines),
    extra: rewards.length
      ? `<div class="tp-big-rewards"><span>🎁 Desbloqueou:</span>${rewards.map((r) => `<span class="tp-chip">${r}</span>`).join("")}</div>`
      : "",
  });
}

function showPlayerWelcome(state) {
  const unlocked = state.achievements.filter((a) => a.unlocked).length;
  return showPlayerBigScreen({
    kicker: "🎮 PERFIL DE JOGADOR LIBERADO",
    big: `<span class="tp-big-small">Você já é nível</span> ${state.level}`,
    title: `${state.title.icon} ${escapeHtml(state.title.name)}`,
    line: `Contei seus treinos antigos: ${formatPlayerNumber(state.xp)} XP e ${unlocked} ${unlocked === 1 ? "conquista" : "conquistas"}${state.streak.current ? `, com streak de ${state.streak.current} ${state.streak.current === 1 ? "dia" : "dias"} 🔥` : ""}. Daqui pra frente, cada treino sobe a barra.`,
    button: "Bora subir de nível! 🚀",
  });
}

/* ---------------------------------------------------------------------
 * Conferência: calcula, compara com o "seen", comemora e avisa a tela
 * ------------------------------------------------------------------- */
let tobaPlayerState = null;
let playerCheckTimer = null;
let playerCheckReason = "";

function tobaPlayerCheck({ reason = "", silent = false } = {}) {
  if (reason) playerCheckReason = reason;
  clearTimeout(playerCheckTimer);
  playerCheckTimer = setTimeout(() => {
    const why = playerCheckReason;
    playerCheckReason = "";
    runPlayerCheck(why, silent);
  }, 200);
}

function runPlayerCheck(reason, silent) {
  let state;
  try {
    state = computePlayer();
  } catch (err) {
    console.error("Perfil do jogador: erro no cálculo", err);
    return null;
  }
  tobaPlayerState = state;
  document.dispatchEvent(new CustomEvent("toba:player", { detail: state }));
  // Algum banco ilegível ou perfil travado: só mostra, não comemora nem grava.
  if (!state.ok || !isPlayerDbLoaded) return state;

  const seen = playerDb.seen;
  const unlocked = state.achievements.filter((a) => a.unlocked);
  if (playerIsNew) {
    seen.xp = state.xp;
    seen.level = state.level;
    seen.achievements = unlocked.map((a) => a.id);
    savePlayerDb();
    if (state.xp > 0 && !silent) queuePlayerCelebration(() => showPlayerWelcome(state));
    return state;
  }

  const before = playerLevelInfo(seen.xp);
  const gained = state.xp - seen.xp;
  const fresh = unlocked.filter((a) => !seen.achievements.includes(a.id)).sort((a, b) => a.date.localeCompare(b.date));
  const leveled = state.level > seen.level;
  if (gained === 0 && !fresh.length && state.level === seen.level) return state;

  if (!silent) {
    if (gained > 0) queuePlayerCelebration(() => showPlayerXpGain(gained, before, state, reason));
    fresh.forEach((a) => queuePlayerCelebration(() => showPlayerAchievement(a)));
    if (leveled) {
      const fromLevel = seen.level;
      queuePlayerCelebration(() => showPlayerLevelUp(fromLevel, state));
    }
  }
  seen.xp = state.xp;
  seen.level = state.level; // perdeu XP (apagou treino): desce sem aviso
  seen.achievements = [...new Set([...seen.achievements, ...fresh.map((a) => a.id)])];
  savePlayerDb();
  return state;
}
