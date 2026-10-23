/* =====================================================================
 * Toba Kitchen · catálogo de receitas + regras puras (desde v1.43)
 * - As receitas moram AQUI, no código (não no banco). O banco só guarda o
 *   id delas (contador, programação, despensa). Por isso:
 *   o "id" de receita e de ingrediente NUNCA muda depois de publicado.
 *   Receita nova = item novo no fim de KITCHEN_RECIPES.
 * - Não depende de kitchen-core.js: o portal carrega este arquivo sozinho
 *   (calcKitchenSummary). Nunca grava nada.
 * - kcal = estimativa por porção (base pra futura sincronia com o Health).
 * ===================================================================== */

// A key é gravada em plan[].meal: não renomeie.
const KITCHEN_MEALS = [
  { key: "cafe", icon: "☕", name: "Café da manhã", short: "Café" },
  { key: "almoco", icon: "🍛", name: "Almoço", short: "Almoço" },
  { key: "lanche", icon: "🥪", name: "Lanche da tarde", short: "Lanche" },
  { key: "janta", icon: "🌙", name: "Janta", short: "Janta" },
  { key: "sobremesa", icon: "🍰", name: "Sobremesa", short: "Doce" },
];

// Seções do mercado (ordem da lista de compras)
const KITCHEN_AISLES = [
  { key: "horti", icon: "🥬", name: "Hortifruti" },
  { key: "acougue", icon: "🥩", name: "Açougue" },
  { key: "frios", icon: "🧀", name: "Frios e laticínios" },
  { key: "mercearia", icon: "🥫", name: "Mercearia" },
  { key: "temperos", icon: "🧂", name: "Temperos" },
];

// staple: básico de casa (sal, óleo...). Não conta como "falta" na busca e
// vai pra "confere se tem" na lista de compras. art: artigo do "falta o/a".
const KITCHEN_INGREDIENTS = {
  ovo: { name: "Ovo", emoji: "🥚", aisle: "frios", art: "o" },
  manteiga: { name: "Manteiga", emoji: "🧈", aisle: "frios", art: "a" },
  queijo: { name: "Queijo muçarela", emoji: "🧀", aisle: "frios", art: "o" },
  "creme-leite": { name: "Creme de leite", emoji: "🥛", aisle: "frios", art: "o" },
  "leite-condensado": { name: "Leite condensado", emoji: "🥫", aisle: "mercearia", art: "o" },
  tapioca: { name: "Goma de tapioca", emoji: "🫓", aisle: "mercearia", art: "a" },
  aveia: { name: "Aveia em flocos", emoji: "🌾", aisle: "mercearia", art: "a" },
  "arroz-japones": { name: "Arroz japonês", emoji: "🍚", aisle: "mercearia", art: "o" },
  "vinagre-arroz": { name: "Vinagre de arroz", emoji: "🍶", aisle: "mercearia", art: "o" },
  nori: { name: "Alga nori", emoji: "🟩", aisle: "mercearia", art: "a" },
  atum: { name: "Atum em lata", emoji: "🐟", aisle: "mercearia", art: "o" },
  maionese: { name: "Maionese", emoji: "🫙", aisle: "mercearia", art: "a" },
  espaguete: { name: "Espaguete", emoji: "🍝", aisle: "mercearia", art: "o" },
  "feijao-preto": { name: "Feijão preto", emoji: "🫘", aisle: "mercearia", art: "o" },
  chocolate: { name: "Chocolate em pó", emoji: "🍫", aisle: "mercearia", art: "o" },
  "whey-chocolate": { name: "Whey de chocolate", emoji: "💪", aisle: "mercearia", art: "o" }, // v1.48
  banana: { name: "Banana", emoji: "🍌", aisle: "horti", art: "a" },
  abacate: { name: "Abacate", emoji: "🥑", aisle: "horti", art: "o" },
  avocado: { name: "Avocado", emoji: "🥑", aisle: "horti", art: "o" }, // v1.50
  tomate: { name: "Tomate", emoji: "🍅", aisle: "horti", art: "o" },
  cebola: { name: "Cebola", emoji: "🧅", aisle: "horti", art: "a" },
  alho: { name: "Alho", emoji: "🧄", aisle: "horti", art: "o" },
  limao: { name: "Limão", emoji: "🍋", aisle: "horti", art: "o" },
  laranja: { name: "Laranja", emoji: "🍊", aisle: "horti", art: "a" },
  "batata-doce": { name: "Batata-doce", emoji: "🍠", aisle: "horti", art: "a" },
  couve: { name: "Couve", emoji: "🥬", aisle: "horti", art: "a" },
  cebolinha: { name: "Cebolinha", emoji: "🌱", aisle: "horti", art: "a" },
  salsinha: { name: "Salsinha", emoji: "🌿", aisle: "horti", art: "a" },
  maracuja: { name: "Maracujá", emoji: "🟡", aisle: "horti", art: "o" },
  frango: { name: "Peito de frango", emoji: "🍗", aisle: "acougue", art: "o" },
  "carne-seca": { name: "Carne seca", emoji: "🥩", aisle: "acougue", art: "a" },
  calabresa: { name: "Linguiça calabresa", emoji: "🌭", aisle: "acougue", art: "a" },
  bacon: { name: "Bacon", emoji: "🥓", aisle: "acougue", art: "o" },
  sal: { name: "Sal", emoji: "🧂", aisle: "temperos", art: "o", staple: true },
  acucar: { name: "Açúcar", emoji: "🍬", aisle: "temperos", art: "o", staple: true },
  azeite: { name: "Azeite", emoji: "🫒", aisle: "temperos", art: "o", staple: true },
  oleo: { name: "Óleo", emoji: "🛢️", aisle: "temperos", art: "o", staple: true },
  oregano: { name: "Orégano", emoji: "🌿", aisle: "temperos", art: "o", staple: true },
  canela: { name: "Canela em pó", emoji: "🟤", aisle: "temperos", art: "a", staple: true },
  paprica: { name: "Páprica", emoji: "🌶️", aisle: "temperos", art: "a", staple: true },
  "pimenta-calabresa": { name: "Pimenta calabresa", emoji: "🌶️", aisle: "temperos", art: "a", staple: true },
  louro: { name: "Folha de louro", emoji: "🍃", aisle: "temperos", art: "a", staple: true },
};

// Unidades: [singular, plural]. "gosto" não tem número.
const KITCHEN_UNITS = {
  un: ["un", "un"],
  g: ["g", "g"],
  ml: ["ml", "ml"],
  cs: ["colher de sopa", "colheres de sopa"],
  cc: ["colher de chá", "colheres de chá"],
  xic: ["xícara", "xícaras"],
  lata: ["lata", "latas"],
  cx: ["caixinha", "caixinhas"],
  dente: ["dente", "dentes"],
  folha: ["folha", "folhas"],
  maco: ["maço", "maços"],
  pitada: ["pitada", "pitadas"],
  scoop: ["scoop", "scoops"], // v1.48 (whey)
  gosto: ["a gosto", "a gosto"],
};

// Quem escreveu a receita (desde v1.48). Sem "author" = Cloba.
const KITCHEN_AUTHORS = {
  cloba: { name: "Cloba", emoji: "🤖" },
  bertoba: { name: "Bertoba", emoji: "👨‍🍳" },
};

/* Receitas. Campos:
 *   id (nunca muda), name, emoji, author? (key de KITCHEN_AUTHORS), meals: [keys de KITCHEN_MEALS],
 *   minutes (total), servings (porções da receita), kcal (por porção, estimativa),
 *   ingredients: [{ id, qty, unit, note?, optional? }],
 *   steps: [{ text, timer? (minutos) }], tip? */
const KITCHEN_RECIPES = [
  {
    id: "ovos-mexidos",
    name: "Ovos mexidos cremosos",
    emoji: "🍳",
    meals: ["cafe"],
    minutes: 10,
    servings: 1,
    kcal: 290,
    ingredients: [
      { id: "ovo", qty: 3, unit: "un" },
      { id: "manteiga", qty: 1, unit: "cs" },
      { id: "sal", qty: null, unit: "gosto" },
      { id: "cebolinha", qty: null, unit: "gosto", optional: true },
    ],
    steps: [
      { text: "Quebra os ovos numa tigela, põe uma pitada de sal e bate com o garfo só até misturar." },
      { text: "Panela antiaderente em fogo BAIXO com a manteiga. Fogo alto aqui é crime." },
      { text: "Joga os ovos e vai mexendo devagar com a espátula, puxando das bordas pro meio.", timer: 3 },
      { text: "Tira do fogo quando ainda estiver meio molhadinho (ele termina de cozinhar no prato). Cebolinha por cima e corre pro abraço." },
    ],
    tip: "O segredo é fogo baixo e paciência. Ovo borrachudo é ovo apressado.",
  },
  {
    // v1.48: versão proteica do Bertoba (o id continua o mesmo)
    id: "tapioca-queijo",
    name: "Tapioca proteica de queijo",
    emoji: "🫓",
    author: "bertoba",
    meals: ["cafe", "lanche"],
    minutes: 10,
    servings: 1,
    kcal: 520,
    ingredients: [
      { id: "tapioca", qty: 100, unit: "g" },
      { id: "ovo", qty: 1, unit: "un" },
      { id: "oleo", qty: 1, unit: "cc", note: "um fio pra untar" },
      { id: "queijo", qty: 30, unit: "g", note: "na hora de virar" },
      { id: "sal", qty: null, unit: "gosto" },
    ],
    steps: [
      { text: "Numa tigela, mistura os 100 g de goma de tapioca com o ovo (e uma pitada de sal) até virar a massaroca." },
      { text: "Unta a frigideira com um fio de óleo, em fogo médio." },
      { text: "Põe a massaroca lá e espalha por igual. Deu os 2 min, timer pai!", timer: 2 },
      { text: "Vira, joga o QUEIJO e mais 1,5 min.", timer: 1.5 },
      { text: "RANGO. 🫓" },
    ],
    tip: "Com o ovo na massa ela fica bem mais proteica que a tapioca só de goma.",
  },
  {
    id: "tapioca-abacate",
    name: "Tapioca com abacate (guaca de pobre)",
    emoji: "🥑",
    meals: ["cafe", "lanche"],
    minutes: 15,
    servings: 1,
    kcal: 380,
    ingredients: [
      { id: "tapioca", qty: 4, unit: "cs" },
      { id: "abacate", qty: 0.5, unit: "un" },
      { id: "tomate", qty: 0.5, unit: "un" },
      { id: "cebola", qty: 0.25, unit: "un" },
      { id: "limao", qty: 0.5, unit: "un" },
      { id: "sal", qty: null, unit: "gosto" },
      { id: "azeite", qty: 1, unit: "cc" },
    ],
    steps: [
      { text: "Amassa o abacate com o garfo, espreme o limão e tempera com sal e azeite." },
      { text: "Pica o tomate e a cebola bem miudinho e mistura no abacate. Guaca pronto." },
      { text: "Frigideira em fogo médio, peneira a goma de tapioca e espera virar um disco.", timer: 2 },
      { text: "Vira a tapioca, espera mais um pouquinho e tira do fogo.", timer: 1 },
      { text: "Recheia com o guaca, dobra e come antes do abacate escurecer." },
    ],
  },
  {
    // v1.48: versão do Bertoba com whey; v1.50: avocado por cima (o id continua o mesmo)
    id: "panqueca-banana",
    name: "Panqueca de banana com aveia e whey",
    emoji: "🥞",
    author: "bertoba",
    meals: ["cafe", "lanche"],
    minutes: 15,
    servings: 1,
    kcal: 570,
    ingredients: [
      { id: "banana", qty: 1, unit: "un" },
      { id: "ovo", qty: 2, unit: "un" },
      { id: "aveia", qty: 3, unit: "cs" },
      { id: "whey-chocolate", qty: 1, unit: "scoop" },
      { id: "canela", qty: null, unit: "gosto" },
      { id: "oleo", qty: 1, unit: "cc" },
      { id: "avocado", qty: 0.5, unit: "un", note: "amassado no garfo" },
      { id: "sal", qty: 1, unit: "pitada" },
    ],
    steps: [
      { text: "Amassa a banana bem amassada numa tigela." },
      { text: "Junta os ovos, a aveia, a canela e o scoop de whey de chocolate e mistura até virar uma massa." },
      { text: "Ficou muito viscosa? Põe um pouquinho de água e mexe de novo." },
      { text: "Frigideira em fogo baixo com um fio de óleo (espalha com papel toalha)." },
      { text: "Põe metade da massa. Pra não queimar embaixo: ou usa uma panela boa, ou tira do fogo e volta por alguns segundos, e repete até conseguir virar.", timer: 3 },
      { text: "Vira com coragem e doura o outro lado. Repete com o resto da massa.", timer: 2 },
      { text: "Panqueca pronta: amassa meio avocado no garfo com uma pitadinha de sal e espalha por cima." },
    ],
    tip: "Com o whey de chocolate fica supimpa. Quanto mais madura a banana, mais doce fica (sem precisar de açúcar).",
  },
  {
    id: "frango-batata-doce",
    name: "Frango com batata-doce",
    emoji: "🍗",
    meals: ["almoco", "janta"],
    minutes: 45,
    servings: 2,
    kcal: 480,
    ingredients: [
      { id: "frango", qty: 300, unit: "g" },
      { id: "batata-doce", qty: 300, unit: "g" },
      { id: "alho", qty: 2, unit: "dente" },
      { id: "limao", qty: 0.5, unit: "un" },
      { id: "azeite", qty: 2, unit: "cs" },
      { id: "paprica", qty: 1, unit: "cc" },
      { id: "sal", qty: null, unit: "gosto" },
    ],
    steps: [
      { text: "Liga o forno a 200 °C pra ir esquentando." },
      { text: "Corta a batata-doce em cubos (com casca mesmo) e espalha numa assadeira com 1 colher de azeite e sal." },
      { text: "Leva a batata pro forno.", timer: 30 },
      { text: "Enquanto isso: corta o frango em tiras e tempera com alho amassado, limão, páprica e sal." },
      { text: "Frigideira bem quente com o resto do azeite. Põe o frango sem mexer pra dourar.", timer: 4 },
      { text: "Vira as tiras e doura o outro lado até não ficar rosado por dentro.", timer: 4 },
      { text: "Batata dourada e furando fácil com o garfo? Monta o prato. Shape agradece. 💪" },
    ],
    tip: "Na air fryer: batata a 200 °C por uns 20 min, chacoalhando na metade.",
  },
  {
    id: "feijoada",
    name: "Feijoada de panela de pressão",
    emoji: "🫘",
    meals: ["almoco"],
    minutes: 150,
    servings: 6,
    kcal: 650,
    ingredients: [
      { id: "feijao-preto", qty: 500, unit: "g" },
      { id: "carne-seca", qty: 300, unit: "g" },
      { id: "calabresa", qty: 250, unit: "g" },
      { id: "bacon", qty: 150, unit: "g" },
      { id: "cebola", qty: 1, unit: "un" },
      { id: "alho", qty: 4, unit: "dente" },
      { id: "louro", qty: 2, unit: "folha" },
      { id: "laranja", qty: 2, unit: "un", note: "pra servir" },
      { id: "couve", qty: 1, unit: "maco", note: "pra servir", optional: true },
      { id: "sal", qty: null, unit: "gosto" },
    ],
    steps: [
      { text: "Na véspera: deixa a carne seca de molho na água (troca a água umas 3 vezes) e o feijão de molho em outra tigela." },
      { text: "Corta a carne seca, a calabresa e o bacon em pedaços." },
      { text: "Na panela de pressão, frita o bacon até soltar a gordura. Junta a cebola e o alho picados e refoga." },
      { text: "Põe a carne seca e a calabresa e dá uma dourada.", timer: 5 },
      { text: "Escorre o feijão, joga na panela com o louro e água até uns 3 dedos acima de tudo." },
      { text: "Fecha a panela. Quando começar a chiar, abaixa o fogo e conta o tempo.", timer: 40 },
      { text: "Desliga e espera a pressão sair sozinha antes de abrir. Sem pressa, sem acidente." },
      { text: "Prova o sal, amassa uns grãos pra engrossar o caldo e deixa apurar destampado.", timer: 15 },
      { text: "Serve com laranja, couve e arroz. Depois é sesta obrigatória. 😴" },
    ],
  },
  {
    id: "onigiri-atum",
    name: "Onigiri de atum",
    emoji: "🍙",
    meals: ["lanche", "janta"],
    minutes: 45,
    servings: 4,
    kcal: 280,
    ingredients: [
      { id: "arroz-japones", qty: 2, unit: "xic" },
      { id: "vinagre-arroz", qty: 2, unit: "cs" },
      { id: "acucar", qty: 1, unit: "cs" },
      { id: "sal", qty: 1, unit: "cc" },
      { id: "atum", qty: 1, unit: "lata" },
      { id: "maionese", qty: 2, unit: "cs" },
      { id: "nori", qty: 2, unit: "folha" },
    ],
    steps: [
      { text: "Lava o arroz na peneira até a água sair quase limpa." },
      { text: "Panela com o arroz e 2 xícaras e meia de água. Ferveu, abaixa o fogo bem baixo e tampa.", timer: 15 },
      { text: "Desliga e deixa descansar tampado (não abre!).", timer: 10 },
      { text: "Mistura o vinagre, o açúcar e o sal e espalha no arroz ainda quente, misturando sem amassar." },
      { text: "Escorre o atum e mistura com a maionese." },
      { text: "Mão molhada com um pouco de sal, pega uma porção de arroz, faz um buraco no meio e põe o recheio." },
      { text: "Fecha e aperta em formato de triângulo. Enrola uma tira de nori na base." },
      { text: "Repete até acabar. Vc é praticamente um sensei agora. 🍙" },
    ],
    tip: "Mão molhada é tudo: o arroz não gruda e o onigiri fica firme.",
  },
  {
    id: "macarrao-alho-oleo",
    name: "Espaguete alho e óleo",
    emoji: "🍝",
    meals: ["almoco", "janta"],
    minutes: 20,
    servings: 2,
    kcal: 520,
    ingredients: [
      { id: "espaguete", qty: 250, unit: "g" },
      { id: "alho", qty: 6, unit: "dente" },
      { id: "azeite", qty: 4, unit: "cs" },
      { id: "salsinha", qty: null, unit: "gosto" },
      { id: "pimenta-calabresa", qty: null, unit: "gosto", optional: true },
      { id: "sal", qty: null, unit: "gosto" },
    ],
    steps: [
      { text: "Ferve bastante água com sal (tem que ficar salgada tipo água do mar)." },
      { text: "Põe o espaguete e cozinha (confere o tempo no pacote, geralmente uns 9 min).", timer: 9 },
      { text: "Enquanto isso, fatia o alho bem fininho." },
      { text: "Frigideira em fogo baixo com o azeite e o alho. Deixa dourar clarinho, sem queimar (alho queimado amarga).", timer: 3 },
      { text: "Guarda meia xícara da água do macarrão, escorre o resto e joga o macarrão na frigideira." },
      { text: "Mistura com um pouco da água guardada, salsinha e pimenta. Serve na hora." },
    ],
  },
  {
    id: "omelete-queijo-tomate",
    name: "Omelete de queijo e tomate",
    emoji: "🥚",
    meals: ["cafe", "janta"],
    minutes: 10,
    servings: 1,
    kcal: 380,
    ingredients: [
      { id: "ovo", qty: 3, unit: "un" },
      { id: "queijo", qty: 40, unit: "g" },
      { id: "tomate", qty: 0.5, unit: "un" },
      { id: "cebolinha", qty: null, unit: "gosto", optional: true },
      { id: "sal", qty: null, unit: "gosto" },
      { id: "oleo", qty: 1, unit: "cc" },
    ],
    steps: [
      { text: "Bate os ovos com sal e pica o tomate em cubinhos." },
      { text: "Frigideira em fogo médio-baixo com um fio de óleo. Joga os ovos." },
      { text: "Quando a borda firmar, espalha o queijo, o tomate e a cebolinha.", timer: 2 },
      { text: "Dobra no meio, tampa e deixa o queijo derreter.", timer: 2 },
    ],
  },
  {
    id: "brigadeiro-panela",
    name: "Brigadeiro de panela",
    emoji: "🍫",
    meals: ["sobremesa"],
    minutes: 15,
    servings: 4,
    kcal: 300,
    ingredients: [
      { id: "leite-condensado", qty: 1, unit: "lata" },
      { id: "chocolate", qty: 2, unit: "cs" },
      { id: "manteiga", qty: 1, unit: "cs" },
    ],
    steps: [
      { text: "Tudo na panela, fogo baixo, e não para de mexer." },
      { text: "Mexe até desgrudar do fundo da panela (passa a colher e o fundo aparece).", timer: 10 },
      { text: "Desliga, espera amornar um tiquinho e ataca de colher. Sem julgamentos. 🥄" },
    ],
  },
  {
    id: "mousse-maracuja",
    name: "Mousse de maracujá do Maracujeba",
    emoji: "🍮",
    meals: ["sobremesa"],
    minutes: 15,
    servings: 6,
    kcal: 280,
    ingredients: [
      { id: "leite-condensado", qty: 1, unit: "lata" },
      { id: "creme-leite", qty: 1, unit: "cx" },
      { id: "maracuja", qty: 3, unit: "un" },
    ],
    steps: [
      { text: "Tira a polpa dos maracujás. Bate no liquidificador rapidinho (só pulsar) e coa pra tirar as sementes. Guarda umas sementes pra decorar." },
      { text: "No liquidificador: leite condensado, creme de leite e o suco do maracujá. Bate até engrossar.", timer: 3 },
      { text: "Despeja numa travessa, joga umas sementes por cima." },
      { text: "Geladeira por pelo menos 2 horas. Homenagem ao Maracujeba concluída. 🫡" },
    ],
  },
];

/* ---------------------------------------------------------------------
 * Consultas e contas (puras)
 * ------------------------------------------------------------------- */
function kitchenRecipe(id) {
  return KITCHEN_RECIPES.find((r) => r.id === String(id)) || null;
}

function kitchenAuthor(recipe) {
  return KITCHEN_AUTHORS[recipe && recipe.author] || KITCHEN_AUTHORS.cloba;
}

function kitchenIngredient(id) {
  return KITCHEN_INGREDIENTS[id] || { name: String(id), emoji: "•", aisle: "mercearia", art: "o" };
}

function kitchenMeal(key) {
  return KITCHEN_MEALS.find((m) => m.key === key) || null;
}

// Arredonda pra algo que dá pra medir: g/ml de 10 em 10, resto em ¼.
function kitchenRoundQty(qty, unit) {
  if (qty === null || qty === undefined) return null;
  if (unit === "g" || unit === "ml") return Math.max(10, Math.round(qty / 10) * 10);
  return Math.max(0.25, Math.round(qty * 4) / 4);
}

function kitchenFormatNumber(qty) {
  const whole = Math.floor(qty);
  const frac = Math.round((qty - whole) * 4);
  const fracText = ["", "¼", "½", "¾"][frac] || "";
  if (!whole) return fracText || "0";
  return fracText ? `${whole} ${fracText}` : String(whole);
}

// "3 un", "2 colheres de sopa", "½ lata", "a gosto"
function kitchenFormatAmount(qty, unit) {
  const names = KITCHEN_UNITS[unit] || [unit || "", unit || ""];
  if (qty === null || qty === undefined || unit === "gosto") return names[0];
  return `${kitchenFormatNumber(qty)} ${qty > 1 ? names[1] : names[0]}`;
}

// Ingredientes da receita na quantidade de porções pedida
function kitchenScaledIngredients(recipe, servings) {
  const factor = (Number(servings) || recipe.servings) / recipe.servings;
  return recipe.ingredients.map((item) => ({
    ...item,
    info: kitchenIngredient(item.id),
    amount: item.qty === null ? null : kitchenRoundQty(item.qty * factor, item.unit),
  }));
}

/* Busca pelo que tem em casa: o que falta pra cada receita.
 * Básico (sal, óleo...) e opcional não contam como falta. */
function kitchenMatchRecipe(recipe, haveSet) {
  const needed = recipe.ingredients.filter((i) => !i.optional && !kitchenIngredient(i.id).staple);
  const missing = needed.filter((i) => !haveSet.has(i.id)).map((i) => i.id);
  return { missing, have: needed.length - missing.length, total: needed.length };
}

// ["tomate", "cebola"] -> "falta o tomate e a cebola"
function kitchenMissingText(missing) {
  const words = missing.map((id) => {
    const info = kitchenIngredient(id);
    return `${info.art || "o"} ${info.name.toLowerCase()}`;
  });
  if (!words.length) return "";
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} e ${words[words.length - 1]}`;
  return `${words.length > 1 ? "faltam" : "falta"} ${list}`;
}

function kitchenAddDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// Segunda-feira da semana do dia (a programação vai de seg a dom)
function kitchenWeekMonday(iso = toIsoDate()) {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return kitchenAddDays(iso, -((day + 6) % 7));
}

function kitchenPlanOfWeek(db, monday) {
  const sunday = kitchenAddDays(monday, 6);
  return (db && Array.isArray(db.plan) ? db.plan : [])
    .filter((p) => p && p.date >= monday && p.date <= sunday && kitchenRecipe(p.recipeId));
}

/* Lista de compras da semana: soma por ingrediente (cada unidade à parte:
 * "2 colheres de sopa + 1 colher de chá"). key = id do ingrediente.
 * Devolve { buy: [por seção], home: [...], staples: [...], count }.
 * home = está na despensa marcada na busca; staples = básicos (confere se tem). */
function kitchenShoppingList(db, monday) {
  const pantry = new Set(db && Array.isArray(db.pantry) ? db.pantry : []);
  const items = {};
  kitchenPlanOfWeek(db, monday).forEach((entry) => {
    const recipe = kitchenRecipe(entry.recipeId);
    kitchenScaledIngredients(recipe, entry.servings).forEach((ing) => {
      if (!items[ing.id]) items[ing.id] = { key: ing.id, id: ing.id, info: ing.info, amounts: {}, recipes: [], optional: true };
      const item = items[ing.id];
      const unit = ing.amount === null ? "gosto" : ing.unit;
      item.amounts[unit] = unit === "gosto" ? null : (item.amounts[unit] || 0) + ing.amount;
      if (!item.recipes.includes(recipe.name)) item.recipes.push(recipe.name);
      if (!ing.optional) item.optional = false;
    });
  });
  const list = Object.values(items).sort((a, b) => a.info.name.localeCompare(b.info.name, "pt-BR"));
  list.forEach((item) => {
    const units = Object.keys(item.amounts);
    const counted = units.filter((u) => u !== "gosto");
    item.amountText = (counted.length ? counted : units).map((u) => kitchenFormatAmount(item.amounts[u], u)).join(" + ");
  });
  const staples = list.filter((i) => i.info.staple);
  const home = list.filter((i) => !i.info.staple && pantry.has(i.id));
  const toBuy = list.filter((i) => !i.info.staple && !pantry.has(i.id));
  const buy = KITCHEN_AISLES.map((aisle) => ({ ...aisle, items: toBuy.filter((i) => (i.info.aisle || "mercearia") === aisle.key) }))
    .filter((group) => group.items.length);
  return { buy, home, staples, count: toBuy.length };
}

function kitchenCookedOf(db) {
  return (db && Array.isArray(db.cooked) ? db.cooked : []).filter((c) => c && c.recipeId);
}

function kitchenCookedCount(db, recipeId) {
  return kitchenCookedOf(db).filter((c) => String(c.recipeId) === String(recipeId)).length;
}

// kcal planejadas do dia (1 porção de cada receita), pra sincronia futura
function kitchenDayKcal(db, iso) {
  return (db && Array.isArray(db.plan) ? db.plan : [])
    .filter((p) => p && p.date === iso)
    .reduce((sum, p) => sum + ((kitchenRecipe(p.recipeId) || {}).kcal || 0), 0);
}

// Resumo pro portal e pro hub (banco ausente ou ilegível = tudo zero)
function calcKitchenSummary(data, today = toIsoDate()) {
  const db = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const cooked = kitchenCookedOf(db);
  const month = today.slice(0, 7);
  const counts = {};
  cooked.forEach((c) => {
    counts[c.recipeId] = (counts[c.recipeId] || 0) + 1;
  });
  const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const todayPlan = (Array.isArray(db.plan) ? db.plan : [])
    .filter((p) => p && p.date === today)
    .map((p) => kitchenRecipe(p.recipeId))
    .filter(Boolean);
  return {
    cookedTotal: cooked.length,
    cookedMonth: cooked.filter((c) => String(c.date || "").startsWith(month)).length,
    distinct: Object.keys(counts).length,
    top: topId ? { recipe: kitchenRecipe(topId), count: counts[topId] } : null,
    todayPlan,
    weekPlanned: kitchenPlanOfWeek(db, kitchenWeekMonday(today)).length,
  };
}

/* ---------------------------------------------------------------------
 * Conquistas do Kitchen no Perfil do jogador (desde v1.44)
 * toba-player.js chama calcKitchenPlayer e confere as conquistas "kt-*" a
 * cada data. Receita feita não dá XP sozinha: só as conquistas dão.
 * timeline: [{ date, stats }] com os números acumulados até aquela vez.
 * ------------------------------------------------------------------- */
const KITCHEN_LONG_MINUTES = 120; // "Paciência de feijoada": receita de 2 h ou mais

function calcKitchenPlayer(data, today) {
  const db = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const plans = Object.fromEntries((Array.isArray(db.plan) ? db.plan : []).filter((p) => p && p.id).map((p) => [String(p.id), p]));
  const cooked = kitchenCookedOf(db)
    .filter((c) => kitchenRecipe(c.recipeId) && /^\d{4}-\d{2}-\d{2}$/.test(String(c.date || "")) && c.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.doneAt) || 0) - (Number(b.doneAt) || 0));
  const stats = {
    kitchenCooked: 0, kitchenDistinct: 0, kitchenMeals: 0, kitchenFullDay: 0, kitchenImprovised: 0,
    kitchenRepeat: 0, kitchenLong: 0, kitchenSweet: 0, kitchenNight: 0, kitchenWeekPlan: 0,
  };
  const distinct = new Set();
  const meals = new Set();
  const perRecipe = {};
  const dayMeals = {};
  const weekPlanned = {};
  const timeline = cooked.map((entry) => {
    const recipe = kitchenRecipe(entry.recipeId);
    const plan = entry.planId ? plans[String(entry.planId)] : null;
    // Refeição: a da programação; feita fora dela, vale toda refeição da receita
    const entryMeals = plan && kitchenMeal(plan.meal) ? [plan.meal] : recipe.meals;
    stats.kitchenCooked += 1;
    distinct.add(recipe.id);
    stats.kitchenDistinct = distinct.size;
    entryMeals.forEach((m) => meals.add(m));
    stats.kitchenMeals = meals.size;
    const day = dayMeals[entry.date] || (dayMeals[entry.date] = new Set());
    entryMeals.forEach((m) => day.add(m));
    if (day.has("cafe") && day.has("almoco") && day.has("janta")) stats.kitchenFullDay = 1;
    if (Array.isArray(entry.improvised) && entry.improvised.length) stats.kitchenImprovised += 1;
    perRecipe[recipe.id] = (perRecipe[recipe.id] || 0) + 1;
    stats.kitchenRepeat = Math.max(stats.kitchenRepeat, perRecipe[recipe.id]);
    if (recipe.minutes >= KITCHEN_LONG_MINUTES) stats.kitchenLong += 1;
    if (entryMeals.includes("sobremesa")) stats.kitchenSweet += 1;
    const hour = Number(entry.doneAt) ? new Date(Number(entry.doneAt)).getHours() : 12;
    if (hour < 5) stats.kitchenNight += 1;
    if (plan) {
      const monday = kitchenWeekMonday(plan.date);
      weekPlanned[monday] = (weekPlanned[monday] || 0) + 1;
      stats.kitchenWeekPlan = Math.max(stats.kitchenWeekPlan, weekPlanned[monday]);
    }
    return { date: entry.date, stats: { ...stats } };
  });
  return { events: [], timeline, stats };
}

// Faltou exatamente 1 ingrediente (pelo que está marcado no 🧺)? Devolve o id.
// Despensa vazia = não sabemos, então não pergunta.
function kitchenOneMissing(db, recipe) {
  const pantry = db && Array.isArray(db.pantry) ? db.pantry : [];
  if (!pantry.length || !recipe) return null;
  const match = kitchenMatchRecipe(recipe, new Set(pantry));
  return match.missing.length === 1 ? match.missing[0] : null;
}
