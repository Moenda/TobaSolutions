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
// Seções do mercado. A `key` nunca muda (item avulso da lista grava ela);
// a ordem aqui é só a ordem na tela. v1.53: padaria, bebidas e as de fora
// da cozinha (limpeza, higiene, pets, outros) pros itens avulsos.
const KITCHEN_AISLES = [
  { key: "horti", icon: "🥬", name: "Hortifruti" },
  { key: "acougue", icon: "🥩", name: "Açougue" },
  { key: "frios", icon: "🧀", name: "Frios e laticínios", short: "Frios" },
  { key: "padaria", icon: "🥖", name: "Padaria" },
  { key: "mercearia", icon: "🥫", name: "Mercearia" },
  { key: "bebidas", icon: "🥤", name: "Bebidas" },
  { key: "temperos", icon: "🧂", name: "Temperos" },
  { key: "chas", icon: "🍵", name: "Chás e ervas", short: "Chás" }, // v1.96
  { key: "limpeza", icon: "🧽", name: "Limpeza" },
  { key: "higiene", icon: "🧴", name: "Higiene" },
  { key: "pet", icon: "🐾", name: "Pets" },
  { key: "outros", icon: "📦", name: "Outros" },
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
  bertoba: { name: "Chef da Casa", emoji: "👨‍🍳" }, // v1.62: id antigo fica (só o nome na tela mudou)
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
    name: "Mousse de maracujá da tropa",
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
      { text: "Geladeira por pelo menos 2 horas. Missão maracujá concluída. 🫡" },
    ],
  },
];

/* ---------------------------------------------------------------------
 * Consultas e contas (puras)
 * ------------------------------------------------------------------- */
function kitchenRecipe(id) {
  return KITCHEN_RECIPES.find((r) => r.id === String(id)) || null;
}

// Livro e escolha da Semana em ordem alfabética (v1.51). Devolve uma cópia:
// o catálogo continua na ordem de sempre (receita nova entra no fim dele).
function kitchenRecipesByName(list = KITCHEN_RECIPES) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
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
// Catálogo de compras (v1.53): o básico do mercado pra marcar com um toque na
// lista de compras. O `id` nunca muda (o item avulso grava ele em `itemId`);
// nome/emoji/seção podem mudar. Os ingredientes das receitas entram sozinhos
// (kitchenShopCatalog), então aqui só o que não está em KITCHEN_INGREDIENTS.
const KITCHEN_SHOP_ITEMS = [
  // Hortifruti
  { id: "alface", name: "Alface", emoji: "🥬", aisle: "horti" },
  { id: "batata", name: "Batata", emoji: "🥔", aisle: "horti" },
  { id: "cenoura", name: "Cenoura", emoji: "🥕", aisle: "horti" },
  { id: "maca", name: "Maçã", emoji: "🍎", aisle: "horti" },
  { id: "mamao", name: "Mamão", emoji: "🍈", aisle: "horti" },
  { id: "brocolis", name: "Brócolis", emoji: "🥦", aisle: "horti" },
  { id: "pepino", name: "Pepino", emoji: "🥒", aisle: "horti" },
  { id: "uva", name: "Uva", emoji: "🍇", aisle: "horti" },
  { id: "morango", name: "Morango", emoji: "🍓", aisle: "horti" },
  { id: "melancia", name: "Melancia", emoji: "🍉", aisle: "horti" },
  { id: "abacaxi", name: "Abacaxi", emoji: "🍍", aisle: "horti" },
  { id: "pimentao", name: "Pimentão", emoji: "🫑", aisle: "horti" },
  // Açougue
  { id: "carne-moida", name: "Carne moída", emoji: "🥩", aisle: "acougue" },
  { id: "bife", name: "Bife", emoji: "🥩", aisle: "acougue" },
  { id: "coxa-frango", name: "Coxa de frango", emoji: "🍗", aisle: "acougue" },
  { id: "peixe", name: "Peixe", emoji: "🐟", aisle: "acougue" },
  { id: "salsicha", name: "Salsicha", emoji: "🌭", aisle: "acougue" },
  // Frios e laticínios
  { id: "leite", name: "Leite", emoji: "🥛", aisle: "frios" },
  { id: "iogurte", name: "Iogurte", emoji: "🥣", aisle: "frios" },
  { id: "presunto", name: "Presunto", emoji: "🍖", aisle: "frios" },
  { id: "requeijao", name: "Requeijão", emoji: "🫙", aisle: "frios" },
  { id: "peito-peru", name: "Peito de peru", emoji: "🦃", aisle: "frios" },
  { id: "margarina", name: "Margarina", emoji: "🧈", aisle: "frios" },
  // Padaria
  { id: "pao-frances", name: "Pão francês", emoji: "🥖", aisle: "padaria" },
  { id: "pao-forma", name: "Pão de forma", emoji: "🍞", aisle: "padaria" },
  { id: "bisnaguinha", name: "Bisnaguinha", emoji: "🥯", aisle: "padaria" },
  { id: "torrada", name: "Torrada", emoji: "🍞", aisle: "padaria" },
  { id: "bolo", name: "Bolo", emoji: "🍰", aisle: "padaria" },
  // Mercearia
  { id: "arroz", name: "Arroz", emoji: "🍚", aisle: "mercearia" },
  { id: "feijao", name: "Feijão carioca", emoji: "🫘", aisle: "mercearia" },
  { id: "macarrao", name: "Macarrão", emoji: "🍝", aisle: "mercearia" },
  { id: "cafe", name: "Café", emoji: "☕", aisle: "mercearia" },
  { id: "farinha-trigo", name: "Farinha de trigo", emoji: "🌾", aisle: "mercearia" },
  { id: "molho-tomate", name: "Molho de tomate", emoji: "🥫", aisle: "mercearia" },
  { id: "biscoito", name: "Biscoito", emoji: "🍪", aisle: "mercearia" },
  { id: "achocolatado", name: "Achocolatado", emoji: "🍫", aisle: "mercearia" },
  { id: "granola", name: "Granola", emoji: "🥣", aisle: "mercearia" },
  { id: "milho-lata", name: "Milho em lata", emoji: "🌽", aisle: "mercearia" },
  { id: "pipoca", name: "Pipoca", emoji: "🍿", aisle: "mercearia" },
  { id: "miojo", name: "Miojo", emoji: "🍜", aisle: "mercearia" },
  { id: "adocante", name: "Adoçante", emoji: "🍬", aisle: "mercearia" }, // v2.18 (sorvetes)
  { id: "pacoca", name: "Paçoca", emoji: "🥜", aisle: "mercearia" }, // v2.18
  { id: "chocolate-70", name: "Chocolate 70%", emoji: "🍫", aisle: "mercearia" }, // v2.18
  // Bebidas
  { id: "agua", name: "Água", emoji: "💧", aisle: "bebidas" },
  { id: "agua-gas", name: "Água com gás", emoji: "🫧", aisle: "bebidas" },
  { id: "refri", name: "Refrigerante", emoji: "🥤", aisle: "bebidas" },
  { id: "suco", name: "Suco", emoji: "🧃", aisle: "bebidas" },
  { id: "cerveja", name: "Cerveja", emoji: "🍺", aisle: "bebidas" },
  { id: "energetico", name: "Energético", emoji: "⚡", aisle: "bebidas" },
  // Temperos e molhos
  { id: "pimenta-reino", name: "Pimenta-do-reino", emoji: "🌶️", aisle: "temperos" },
  { id: "caldo", name: "Caldo de galinha", emoji: "🧊", aisle: "temperos" },
  { id: "ketchup", name: "Ketchup", emoji: "🍅", aisle: "temperos" },
  { id: "mostarda", name: "Mostarda", emoji: "🟨", aisle: "temperos" },
  { id: "shoyu", name: "Shoyu", emoji: "🍶", aisle: "temperos" },
  // Limpeza
  { id: "detergente", name: "Detergente", emoji: "🧴", aisle: "limpeza" },
  { id: "sabao-po", name: "Sabão em pó", emoji: "🧺", aisle: "limpeza" },
  { id: "amaciante", name: "Amaciante", emoji: "🌸", aisle: "limpeza" },
  { id: "agua-sanitaria", name: "Água sanitária", emoji: "🧪", aisle: "limpeza" },
  { id: "desinfetante", name: "Desinfetante", emoji: "🫧", aisle: "limpeza" },
  { id: "esponja", name: "Esponja", emoji: "🧽", aisle: "limpeza" },
  { id: "saco-lixo", name: "Saco de lixo", emoji: "🗑️", aisle: "limpeza" },
  { id: "papel-toalha", name: "Papel toalha", emoji: "🧻", aisle: "limpeza" },
  { id: "multiuso", name: "Multiuso", emoji: "✨", aisle: "limpeza" },
  { id: "alcool", name: "Álcool", emoji: "🧴", aisle: "limpeza" },
  // Higiene
  { id: "papel-higienico", name: "Papel higiênico", emoji: "🧻", aisle: "higiene" },
  { id: "sabonete", name: "Sabonete", emoji: "🧼", aisle: "higiene" },
  { id: "shampoo", name: "Shampoo", emoji: "🧴", aisle: "higiene" },
  { id: "condicionador", name: "Condicionador", emoji: "🧴", aisle: "higiene" },
  { id: "pasta-dente", name: "Pasta de dente", emoji: "🪥", aisle: "higiene" },
  { id: "escova-dente", name: "Escova de dente", emoji: "🪥", aisle: "higiene" },
  { id: "desodorante", name: "Desodorante", emoji: "💨", aisle: "higiene" },
  { id: "fio-dental", name: "Fio dental", emoji: "🦷", aisle: "higiene" },
  { id: "cotonete", name: "Cotonete", emoji: "☁️", aisle: "higiene" },
  // Pets (Killua e Gon 🐱)
  { id: "racao-gato", name: "Ração de gato", emoji: "🐱", aisle: "pet" },
  { id: "sache-gato", name: "Sachê de gato", emoji: "🐟", aisle: "pet" },
  { id: "areia-gato", name: "Areia de gato", emoji: "🏖️", aisle: "pet" },
  { id: "petisco", name: "Petisco", emoji: "🦴", aisle: "pet" },
];

// Tudo que dá pra marcar na lista: o catálogo de compras + todo ingrediente das
// receitas (id "i-<ingrediente>"), sem repetir nome. Ordem: A–Z.
function kitchenShopCatalog() {
  const seen = new Set();
  const out = [];
  const push = (item) => {
    const norm = kitchenNormalizeText(item.name);
    if (seen.has(norm)) return;
    seen.add(norm);
    out.push(item);
  };
  Object.keys(KITCHEN_INGREDIENTS).forEach((id) => {
    const info = KITCHEN_INGREDIENTS[id];
    push({ id: `i-${id}`, name: info.name, emoji: info.emoji, aisle: info.aisle || "mercearia" });
  });
  KITCHEN_SHOP_ITEMS.forEach(push);
  // v1.96: ervas dos chás (id "cha-<erva>", seção 🍵); nome repetido fica com o de cima
  Object.keys(KITCHEN_TEA_HERBS).forEach((id) => {
    const herb = KITCHEN_TEA_HERBS[id];
    push({ id: `cha-${id}`, name: herb.name, emoji: herb.emoji, aisle: "chas" });
  });
  // v2.18: ingredientes dos sorvetes (id "ice-<ingrediente>"); básico de casa e nome repetido ficam de fora
  Object.keys(KITCHEN_ICE_INGS).forEach((id) => {
    const ing = KITCHEN_ICE_INGS[id];
    if (ing.staple || ing.shop) return;
    push({ id: `ice-${id}`, name: ing.name, emoji: ing.emoji, aisle: ing.aisle || "mercearia" });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

function kitchenShopItem(itemId) {
  if (!itemId) return null;
  return kitchenShopCatalog().find((i) => i.id === String(itemId)) || null;
}

function kitchenAisle(key) {
  return KITCHEN_AISLES.find((a) => a.key === key) || null;
}

// Nome igual ao de um ingrediente do catálogo (sem ligar pra maiúscula/acento)
function kitchenFindIngredientByName(name) {
  const norm = kitchenNormalizeText(name);
  if (!norm) return null;
  const id = Object.keys(KITCHEN_INGREDIENTS).find((key) => kitchenNormalizeText(KITCHEN_INGREDIENTS[key].name) === norm);
  return id ? { id, ...KITCHEN_INGREDIENTS[id] } : null;
}

function kitchenNormalizeText(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

// Itens avulsos da lista (v1.53): moram em db.extras e valem pra toda semana
// até sair da lista. Seção desconhecida aparece em "Outros" (o valor gravado fica).
function kitchenExtrasOf(db) {
  return (db && Array.isArray(db.extras) ? db.extras : []).filter((x) => x && typeof x === "object" && String(x.name || "").trim());
}

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
  const byName = (a, b) => a.info.name.localeCompare(b.info.name, "pt-BR", { sensitivity: "base" });
  const list = Object.values(items).sort(byName);
  list.forEach((item) => {
    const units = Object.keys(item.amounts);
    const counted = units.filter((u) => u !== "gosto");
    item.amountText = (counted.length ? counted : units).map((u) => kitchenFormatAmount(item.amounts[u], u)).join(" + ");
  });
  const staples = list.filter((i) => i.info.staple);
  const home = list.filter((i) => !i.info.staple && pantry.has(i.id));
  const toBuy = list.filter((i) => !i.info.staple && !pantry.has(i.id));
  const extras = kitchenExtrasOf(db).map((x) => {
    const aisle = kitchenAisle(x.aisle) ? x.aisle : "outros";
    const known = kitchenShopItem(x.itemId) || kitchenFindIngredientByName(x.name);
    return {
      key: String(x.id),
      id: String(x.id),
      extra: true,
      checked: x.checked === true,
      info: { name: String(x.name).trim(), emoji: known ? known.emoji : kitchenAisle(aisle).icon, aisle },
      recipes: [],
      optional: false,
      amountText: String(x.qty || "").trim(),
    };
  });
  const buyAll = [...toBuy, ...extras].sort(byName);
  const buy = KITCHEN_AISLES.map((aisle) => ({ ...aisle, items: buyAll.filter((i) => (i.info.aisle || "mercearia") === aisle.key) }))
    .filter((group) => group.items.length);
  return { buy, home, staples, count: buyAll.length, extras: extras.length };
}

// Quantos itens da lista ainda faltam pegar (semana + avulsos), pro hub e pro botão da Semana
function kitchenShoppingPending(db, monday) {
  const shop = kitchenShoppingList(db, monday);
  const week = db && db.shopping && db.shopping[monday];
  const checked = new Set(week && Array.isArray(week.checked) ? week.checked : []);
  return shop.buy.flatMap((g) => g.items).filter((i) => (i.extra ? !i.checked : !checked.has(i.key))).length;
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
    kitchenIce: 0, kitchenIceFlavors: 0, kitchenIceFruit: 0, kitchenIceMonster: 0, kitchenIceWeek: 0, // v2.18 (🍦 sorvetes)
  };
  const distinct = new Set();
  const meals = new Set();
  const perRecipe = {};
  const dayMeals = {};
  const weekPlanned = {};
  // v2.18: potes de sorvete comidos entram na mesma linha do tempo (só conquistas, sem XP)
  const iceFlavors = new Set();
  const iceWeeks = {};
  const iceStep = (pint, date) => {
    const recipe = kitchenIceRecipe(db, pint.iceId);
    stats.kitchenIce += 1;
    iceFlavors.add(String(pint.iceId));
    stats.kitchenIceFlavors = iceFlavors.size;
    if (kitchenIceIsFruit(recipe)) stats.kitchenIceFruit += 1;
    const macros = recipe ? kitchenIcePintMacros(db, recipe, pint.size) : null;
    if (macros && macros.p >= 50) stats.kitchenIceMonster += 1;
    const monday = kitchenWeekMonday(date);
    iceWeeks[monday] = (iceWeeks[monday] || 0) + 1;
    stats.kitchenIceWeek = Math.max(stats.kitchenIceWeek, iceWeeks[monday]);
    return { date, stats: { ...stats } };
  };
  const steps = [
    ...cooked.map((entry) => ({ date: entry.date, doneAt: Number(entry.doneAt) || 0, entry })),
    ...kitchenIceEatenEvents(db, today),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.doneAt - b.doneAt);
  const timeline = steps.map((step) => {
    if (step.pint) return iceStep(step.pint, step.date);
    const entry = step.entry;
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

/* ---------------------------------------------------------------------
 * 🍵 Chás (desde v1.96): blends do usuário por PARTES (3 de mulungu, 1 de
 * hibisco...). Os blends moram no banco (db.teas), não no código; aqui só o
 * catálogo das ervas (chips), as ideias do Cloba e as contas puras.
 * O `id` de erva e a `key` de "pra quê" nunca mudam (o blend grava eles).
 * ------------------------------------------------------------------- */
const KITCHEN_TEA_KINDS = [
  { key: "folha", icon: "🌿", name: "Ervas, folhas e flores" },
  { key: "fruta", icon: "🍒", name: "Frutas secas" },
  { key: "raiz", icon: "🪵", name: "Raízes, cascas e especiarias" },
];

const KITCHEN_TEA_HERBS = {
  hibisco: { name: "Hibisco", emoji: "🌺", kind: "folha" },
  camomila: { name: "Camomila", emoji: "🌼", kind: "folha" },
  cavalinha: { name: "Cavalinha", emoji: "🎋", kind: "folha" },
  moringa: { name: "Moringa", emoji: "🍃", kind: "folha" },
  "erva-cidreira": { name: "Erva-cidreira", emoji: "🌿", kind: "folha" },
  "capim-santo": { name: "Capim-santo", emoji: "🌾", kind: "folha" },
  hortela: { name: "Hortelã", emoji: "🌱", kind: "folha" },
  melissa: { name: "Melissa", emoji: "🍀", kind: "folha" },
  passiflora: { name: "Passiflora", emoji: "🌸", kind: "folha" },
  lavanda: { name: "Lavanda", emoji: "🪻", kind: "folha" },
  "flor-laranjeira": { name: "Flor de laranjeira", emoji: "💮", kind: "folha" },
  "erva-doce": { name: "Erva-doce", emoji: "🌾", kind: "folha" },
  boldo: { name: "Boldo", emoji: "🌿", kind: "folha" },
  carqueja: { name: "Carqueja", emoji: "🌿", kind: "folha" },
  "espinheira-santa": { name: "Espinheira-santa", emoji: "🍃", kind: "folha" },
  alecrim: { name: "Alecrim", emoji: "🌿", kind: "folha" },
  "cha-verde": { name: "Chá verde", emoji: "🍵", kind: "folha" },
  "cha-preto": { name: "Chá preto", emoji: "🫖", kind: "folha" },
  mate: { name: "Erva-mate", emoji: "🧉", kind: "folha" },
  "uva-passa": { name: "Uva passa", emoji: "🍇", kind: "fruta" },
  cranberry: { name: "Cranberry", emoji: "🍒", kind: "fruta" },
  "maca-seca": { name: "Maçã desidratada", emoji: "🍎", kind: "fruta" },
  "abacaxi-seco": { name: "Abacaxi desidratado", emoji: "🍍", kind: "fruta" },
  "morango-seco": { name: "Morango desidratado", emoji: "🍓", kind: "fruta" },
  goji: { name: "Goji berry", emoji: "🔴", kind: "fruta" },
  "casca-laranja": { name: "Casca de laranja", emoji: "🍊", kind: "fruta" },
  "casca-limao": { name: "Casca de limão", emoji: "🍋", kind: "fruta" },
  mulungu: { name: "Mulungu", emoji: "🌳", kind: "raiz" },
  valeriana: { name: "Valeriana", emoji: "🪷", kind: "raiz" },
  gengibre: { name: "Gengibre", emoji: "🫚", kind: "raiz" },
  "canela-pau": { name: "Canela em pau", emoji: "🪵", kind: "raiz" },
  cravo: { name: "Cravo-da-índia", emoji: "🌰", kind: "raiz" },
  "anis-estrelado": { name: "Anis-estrelado", emoji: "⭐", kind: "raiz" },
  cardamomo: { name: "Cardamomo", emoji: "🟢", kind: "raiz" },
  curcuma: { name: "Cúrcuma", emoji: "🟠", kind: "raiz" },
};

const KITCHEN_TEA_PURPOSES = [
  { key: "dormir", icon: "🌙", name: "Dormir" },
  { key: "relaxar", icon: "😌", name: "Relaxar" },
  { key: "energia", icon: "⚡", name: "Energia" },
  { key: "desinchar", icon: "💧", name: "Desinchar" },
  { key: "digestao", icon: "🍽️", name: "Digestão" },
  { key: "gripe", icon: "🤧", name: "Gripe" },
  { key: "gelado", icon: "🧊", name: "Gelado" },
  { key: "sabor", icon: "😋", name: "Só o sabor" },
];

const KITCHEN_TEA_EMOJIS = ["🍵", "🫖", "🌙", "😌", "⚡", "💧", "🔥", "🧊", "🌺", "🍒", "🍃", "🧉"];

// Cores das fatias da barrinha de proporção (na ordem das ervas do blend)
const KITCHEN_TEA_COLORS = ["#ff7b72", "#d29922", "#3fb950", "#58a6ff", "#bc8cff", "#f778ba", "#56d4dd", "#e3b341"];

// Receitas de chá prontas (v1.96; fixas desde v1.97): abrem só pra ler (pra que
// serve, o papel de cada erva e as proporções), sem editar. O `id` nunca muda
// (as xícaras gravam teaId "i-<id>"). about = pra que serve; role = o que a erva faz ali.
const KITCHEN_TEA_IDEAS = [
  {
    id: "dormir", name: "Chá pra dormir", emoji: "🌙", purpose: "dormir", author: "bertoba",
    about: "O blend da casa pra desligar de noite. O mulungu é a base calmante (uso popular pra ansiedade e sono), o hibisco dá a cor e o azedinho, e a uva passa com o cranberry adoçam sem açúcar. Toma uns 30 min antes de deitar.",
    parts: [
      { herb: "mulungu", parts: 3, role: "base calmante, dá o sono" },
      { herb: "hibisco", parts: 1, role: "cor de groselha e azedinho" },
      { herb: "uva-passa", parts: 1, role: "doce natural" },
      { herb: "cranberry", parts: 1, role: "doce azedinho e frutado" },
    ],
    howTo: "1 colher de sopa da mistura pra 250 ml de água quente. Abafa 10 min e coa.",
  },
  {
    id: "zen", name: "Camomila zen", emoji: "😌", purpose: "relaxar",
    about: "Pra baixar a bola depois de um dia puxado, sem derrubar igual o mulungu. Camomila e erva-cidreira são as clássicas do \"calma aí\", e a lavanda entra pelo perfume.",
    parts: [
      { herb: "camomila", parts: 2, role: "calmante suave" },
      { herb: "erva-cidreira", parts: 2, role: "relaxa e ajuda a digestão" },
      { herb: "lavanda", parts: 1, role: "perfume (pouquinho, senão vira sabonete)" },
    ],
    howTo: "1 colher de sopa pra 250 ml de água quase fervendo. Abafa 5 min.",
  },
  {
    id: "desincha", name: "Desincha, Toba", emoji: "💧", purpose: "desinchar",
    about: "Pro dia seguinte da pizza. A cavalinha é diurética (faz ir mais ao banheiro e solta o inchaço), o hibisco ajuda nisso também e o gengibre esquenta e dá sabor. Bebe de dia, não de noite (senão é xixi às 3 da manhã).",
    parts: [
      { herb: "cavalinha", parts: 2, role: "diurética, desincha" },
      { herb: "hibisco", parts: 1, role: "diurético e azedinho" },
      { herb: "gengibre", parts: 1, role: "esquenta e dá sabor" },
    ],
    howTo: "1 colher de sopa pra 300 ml. Ferve o gengibre 3 min, desliga, joga o resto e abafa 7 min.",
  },
  {
    id: "gripe", name: "Mata-gripe", emoji: "🔥", purpose: "gripe",
    about: "Pra garganta arranhando e nariz entupido. Gengibre e cravo esquentam, a canela deixa cheiroso e a casca de limão dá frescor. Mel só depois de amornar.",
    parts: [
      { herb: "gengibre", parts: 2, role: "esquenta e alivia a garganta" },
      { herb: "canela-pau", parts: 1, role: "doce e quentinho" },
      { herb: "cravo", parts: 1, role: "picante, abre o nariz" },
      { herb: "casca-limao", parts: 1, role: "frescor" },
    ],
    howTo: "Ferve tudo 5 min em 300 ml de água. Mel depois de amornar.",
  },
  {
    id: "gelado", name: "Hibisco gelado da tropa", emoji: "🧊", purpose: "gelado",
    about: "Refresco pra dia de calor em SP: rende uma jarra de 1 litro pra geladeira. O hibisco dá a cor de groselha, a maçã e o cranberry adoçam e a canela dá o toque.",
    parts: [
      { herb: "hibisco", parts: 2, role: "cor e azedinho de refresco" },
      { herb: "maca-seca", parts: 2, role: "doce de fruta" },
      { herb: "canela-pau", parts: 1, role: "o toque" },
      { herb: "cranberry", parts: 1, role: "frutado" },
    ],
    howTo: "4 colheres de sopa pra 1 litro de água quente, abafa 10 min, coa e geladeira.",
  },
  {
    id: "bomdia", name: "Bom dia, Cloba", emoji: "⚡", purpose: "energia",
    about: "Pra acordar sem café (ou fazer companhia pra V60). A erva-mate tem cafeína, a hortelã refresca e a casca de limão acorda o paladar. Evita depois das 16h.",
    parts: [
      { herb: "mate", parts: 2, role: "cafeína, dá o gás" },
      { herb: "hortela", parts: 1, role: "refresca" },
      { herb: "casca-limao", parts: 1, role: "acorda o paladar" },
    ],
    howTo: "1 colher de sopa pra 250 ml de água a uns 80 °C (antes de ferver). Abafa 4 min.",
  },
  {
    id: "verde", name: "Moringa verdinha", emoji: "🍃", purpose: "digestao",
    about: "Leve, pra depois do almoço. A moringa é folha verde cheia de nutriente (gosto de mato, por isso vai pouca), o capim-santo dá perfume de limão e a hortelã ajuda a digestão.",
    parts: [
      { herb: "moringa", parts: 1, role: "nutriente (gosto forte, vai pouca)" },
      { herb: "capim-santo", parts: 2, role: "perfume de limão, acalma" },
      { herb: "hortela", parts: 1, role: "ajuda a digestão" },
    ],
    howTo: "1 colher de sopa pra 250 ml de água quente. Abafa 5 min.",
  },
];

// Receita pronta pelo id do blend ("i-dormir") ou pelo da ideia ("dormir")
function kitchenTeaIdea(id) {
  const key = String(id || "").replace(/^i-/, "");
  return KITCHEN_TEA_IDEAS.find((idea) => idea.id === key) || null;
}

function kitchenTeaHerb(id) {
  return KITCHEN_TEA_HERBS[id] || null;
}

function kitchenTeaPurpose(key) {
  return KITCHEN_TEA_PURPOSES.find((p) => p.key === key) || null;
}

// Uma parte do blend: erva do catálogo ({ herb }) ou digitada ({ name })
function kitchenTeaPartInfo(part) {
  const herb = part && kitchenTeaHerb(part.herb);
  if (herb) return { name: herb.name, emoji: herb.emoji, kind: herb.kind };
  return { name: String((part && part.name) || "Erva").trim() || "Erva", emoji: "🌿", kind: "outra" };
}

function kitchenTeasOf(db) {
  return (db && Array.isArray(db.teas) ? db.teas : []).filter((t) => t && typeof t === "object" && Array.isArray(t.parts));
}

function kitchenTea(db, id) {
  return kitchenTeasOf(db).find((t) => String(t.id) === String(id)) || null;
}

// Blends em ordem alfabética
function kitchenTeasByName(db) {
  return [...kitchenTeasOf(db)].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR", { sensitivity: "base" }));
}

// Partes válidas do blend com a porcentagem e a cor de cada uma
function kitchenTeaShares(tea) {
  const parts = (tea && Array.isArray(tea.parts) ? tea.parts : []).filter((p) => p && Number(p.parts) > 0);
  const total = parts.reduce((sum, p) => sum + Number(p.parts), 0);
  return parts.map((p, i) => ({
    ...p,
    parts: Number(p.parts),
    info: kitchenTeaPartInfo(p),
    share: total ? Number(p.parts) / total : 0,
    color: KITCHEN_TEA_COLORS[i % KITCHEN_TEA_COLORS.length],
  }));
}

// 3 -> "3", 0.5 -> "½", 1.5 -> "1 ½"
function kitchenTeaPartsNumber(parts) {
  return kitchenFormatNumber(Math.round(Number(parts) * 4) / 4);
}

// "3 mulungu · 1 hibisco · 1 uva passa"
function kitchenTeaPartsText(tea) {
  return kitchenTeaShares(tea).map((p) => `${kitchenTeaPartsNumber(p.parts)} ${p.info.name.toLowerCase()}`).join(" · ");
}

/* Conta do pote: quanto de cada erva pra um total.
 * unit "g": de 10 g pra cima em gramas inteiros, abaixo de meio em meio.
 * unit "cs" (colher de sopa): em ¼ de colher. */
function kitchenTeaAmounts(tea, total, unit = "g") {
  return kitchenTeaShares(tea).map((p) => {
    const raw = p.share * Number(total || 0);
    let amount;
    if (unit === "cs") amount = Math.round(raw * 4) / 4;
    else amount = raw >= 10 ? Math.round(raw) : Math.round(raw * 2) / 2;
    return { ...p, amount };
  });
}

function kitchenTeaAmountText(amount, unit = "g") {
  if (unit === "cs") return amount > 0 ? kitchenFormatAmount(amount, "cs") : "uma pitada";
  return `${String(amount).replace(".", ",")} g`;
}

function kitchenTeaBrewsOf(db, teaId) {
  return (db && Array.isArray(db.teaBrews) ? db.teaBrews : [])
    .filter((b) => b && String(b.teaId) === String(teaId))
    .sort((a, b) => (Number(b.doneAt) || 0) - (Number(a.doneAt) || 0));
}

// Ervas digitadas no "✍️ Outra" de qualquer blend (viram chip), sem repetir
function kitchenTeaCustomNames(db) {
  const seen = new Set();
  const out = [];
  kitchenTeasOf(db).forEach((t) => t.parts.forEach((p) => {
    if (!p || kitchenTeaHerb(p.herb)) return;
    const name = String(p.name || "").trim();
    const norm = kitchenNormalizeText(name);
    if (!name || seen.has(norm)) return;
    seen.add(norm);
    out.push(name);
  }));
  return out.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

/* ---------------------------------------------------------------------
 * 🍦 Sorvetes Ninja CREAMi (desde v2.18): catálogo + contas puras.
 * As receitas prontas moram AQUI (fixas, igual aos chás prontos); os potes
 * que o usuário monta moram no banco (db.ices), e o que ele congelou/comeu
 * em db.icePints. Macros (kcal, proteína, carbo, gordura) são SEMPRE
 * calculados dos ingredientes (nunca digitados na receita), já no tamanho
 * do pote escolhido (db.iceSize) e com o rótulo do usuário (db.iceLabels)
 * por cima do rótulo médio daqui.
 * O `id` de ingrediente, de receita, de programa e de tamanho NUNCA muda
 * (pote e potes comidos gravam eles). Coisa nova = item novo.
 * ------------------------------------------------------------------- */

// Tamanho do pote. factor multiplica a receita (as daqui são pro pote normal).
// fillMl = até onde a base cabe (a linha MAX do pote), uma régua aproximada.
const KITCHEN_ICE_SIZES = {
  std: { key: "std", icon: "🫙", name: "Pote normal", short: "470 ml", factor: 1, fillMl: 450, models: "CREAMi 7 em 1 (NC300 / NC301)" },
  xl: { key: "xl", icon: "🪣", name: "Pote Deluxe", short: "710 ml", factor: 1.5, fillMl: 680, models: "CREAMi Deluxe (NC501, pote XL)" },
};

// Programas da máquina (key gravada no pote do usuário)
const KITCHEN_ICE_PROGRAMS = [
  { key: "lite", short: "Lite", icon: "🪶", name: "Lite Ice Cream", about: "O programa do fit. Feito pra base com pouca gordura e pouco açúcar: a lâmina desce mais devagar e raspa mais tempo pra compensar a falta de gordura. É o primeiro da fila pra todo sorvete com whey e leite desnatado." },
  { key: "sorbet", short: "Sorbet", icon: "🍧", name: "Sorbet", about: "Pra base de fruta com água, suco ou água de coco (sem leite). Fruta bem madura = mais açúcar natural = mais cremoso. Fruta verde vira raspadinha." },
  { key: "smoothie", short: "Bowl", icon: "🥣", name: "Smoothie Bowl", about: "Pra fruta congelada com um pouco de leite ou iogurte: sai firme, tipo açaí de tigela, bom pra encher de granola por cima." },
  { key: "icecream", short: "Ice Cream", icon: "🍦", name: "Ice Cream", about: "Pra base tradicional, com gordura (leite integral, creme de leite). Com base fit costuma sair mais seco que o Lite. Usa se o teu Lite deixar o pote mole demais." },
  { key: "gelato", short: "Gelato", icon: "🍨", name: "Gelato", about: "Pra base cozida estilo creme (gema, creme). No fit quase não entra, mas fica aqui pra quando bater a vontade de sair da dieta." },
  { key: "milkshake", short: "Shake", icon: "🥤", name: "Milkshake", about: "Pega um pote JÁ batido, faz um buraco até o fundo, põe uns 120 ml de leite desnatado e roda o Milkshake: sai grosso de canudo." },
  { key: "froyo", short: "Froyo", icon: "🫐", name: "Frozen Yogurt", deluxe: true, about: "Só existe na Deluxe. Pra base de iogurte. Na 7 em 1 usa o Lite Ice Cream que fica igual." },
];

const KITCHEN_ICE_KINDS = [
  { key: "liquido", icon: "🥛", name: "Base líquida" },
  { key: "proteina", icon: "💪", name: "Proteína" },
  { key: "fruta", icon: "🍓", name: "Frutas (congela madura)" },
  { key: "textura", icon: "🧪", name: "Cremosidade sem gordura" },
  { key: "sabor", icon: "🍬", name: "Sabor e doce" },
  { key: "mixin", icon: "🍫", name: "Mix-ins (entram depois de bater)" },
];

/* Ingredientes. Os números (kcal, p = proteína, c = carbo, f = gordura) valem
 * pra `per` na `unit` (100 ml, 100 g, 1 scoop de 30 g, 1 colher...). Rótulo
 * médio de mercado brasileiro (TACO + rótulos comuns): é estimativa.
 * label: true = muda muito de marca, o ✏️ Rótulos deixa o usuário pôr o dele.
 * step = quanto o − / + anda. chips = quantidades de um toque.
 * shop = nome do item na lista de compras (igual = junta com o que já tem).
 * staple = básico de casa, não vai pra lista. gosto = sem número (a gosto). */
const KITCHEN_ICE_INGS = {
  "leite-desnatado": { name: "Leite desnatado", emoji: "🥛", kind: "liquido", unit: "ml", per: 100, kcal: 33, p: 3.2, c: 4.8, f: 0, step: 10, chips: [150, 200, 250, 300, 350], aisle: "frios", label: true, labelNote: "por 100 ml" },
  "agua-coco": { name: "Água de coco", emoji: "🥥", kind: "liquido", unit: "ml", per: 100, kcal: 22, p: 0, c: 5.3, f: 0, step: 10, chips: [50, 100, 150], aisle: "bebidas" },
  cafe: { name: "Café coado (frio)", emoji: "☕", kind: "liquido", unit: "ml", per: 100, kcal: 2, p: 0.1, c: 0.3, f: 0, step: 10, chips: [100, 150, 200], aisle: "mercearia", shop: "Café" },
  agua: { name: "Água", emoji: "💧", kind: "liquido", unit: "ml", per: 100, kcal: 0, p: 0, c: 0, f: 0, step: 10, chips: [30, 50, 100], staple: true },
  "whey-baunilha": { name: "Whey de baunilha", emoji: "🍦", kind: "proteina", unit: "scoop", per: 1, kcal: 120, p: 24, c: 3, f: 1.5, step: 0.5, chips: [0.5, 1, 1.5, 2], aisle: "mercearia", label: true, labelNote: "por 1 scoop (≈30 g)" },
  "whey-chocolate": { name: "Whey de chocolate", emoji: "🍫", kind: "proteina", unit: "scoop", per: 1, kcal: 118, p: 22, c: 4, f: 1.8, step: 0.5, chips: [0.5, 1, 1.5, 2], aisle: "mercearia", label: true, labelNote: "por 1 scoop (≈30 g)" },
  "whey-morango": { name: "Whey de morango", emoji: "🍓", kind: "proteina", unit: "scoop", per: 1, kcal: 118, p: 23, c: 3.5, f: 1.5, step: 0.5, chips: [0.5, 1, 1.5, 2], aisle: "mercearia", label: true, labelNote: "por 1 scoop (≈30 g)" },
  "iogurte-proteico": { name: "Iogurte proteico zero (tipo grego)", emoji: "🥣", kind: "proteina", unit: "g", per: 100, kcal: 60, p: 9.4, c: 5.6, f: 0.2, step: 10, chips: [100, 150, 200, 300], aisle: "frios", label: true, labelNote: "por 100 g" },
  "iogurte-desnatado": { name: "Iogurte natural desnatado", emoji: "🥛", kind: "proteina", unit: "g", per: 100, kcal: 41, p: 3.8, c: 5.7, f: 0.2, step: 10, chips: [100, 170, 200], aisle: "frios", label: true, labelNote: "por 100 g" },
  morango: { name: "Morango", emoji: "🍓", kind: "fruta", unit: "g", per: 100, kcal: 30, p: 0.9, c: 6.8, f: 0.3, step: 10, chips: [50, 100, 150, 200, 300], aisle: "horti" },
  banana: { name: "Banana bem madura", emoji: "🍌", kind: "fruta", unit: "g", per: 100, kcal: 98, p: 1.3, c: 26, f: 0.1, step: 10, chips: [50, 80, 100, 200, 300], aisle: "horti", shop: "Banana" },
  manga: { name: "Manga", emoji: "🥭", kind: "fruta", unit: "g", per: 100, kcal: 60, p: 0.5, c: 15.5, f: 0.3, step: 10, chips: [100, 200, 300, 350], aisle: "horti" },
  abacaxi: { name: "Abacaxi", emoji: "🍍", kind: "fruta", unit: "g", per: 100, kcal: 48, p: 0.9, c: 12.3, f: 0.1, step: 10, chips: [100, 150, 200, 380], aisle: "horti" },
  "frutas-vermelhas": { name: "Frutas vermelhas congeladas", emoji: "🫐", kind: "fruta", unit: "g", per: 100, kcal: 45, p: 0.9, c: 10, f: 0.3, step: 10, chips: [40, 100, 200, 320], aisle: "horti" },
  acai: { name: "Polpa de açaí sem açúcar", emoji: "🟣", kind: "fruta", unit: "g", per: 100, kcal: 58, p: 0.8, c: 6.2, f: 3.9, step: 10, chips: [100, 200], aisle: "horti", label: true, labelNote: "por 100 g" },
  maracuja: { name: "Polpa de maracujá", emoji: "🟡", kind: "fruta", unit: "g", per: 100, kcal: 39, p: 0.8, c: 9.6, f: 0.2, step: 10, chips: [50, 100, 150], aisle: "horti" },
  melancia: { name: "Melancia", emoji: "🍉", kind: "fruta", unit: "g", per: 100, kcal: 33, p: 0.9, c: 8.1, f: 0, step: 10, chips: [200, 300, 420], aisle: "horti" },
  "suco-limao": { name: "Suco de limão", emoji: "🍋", kind: "fruta", unit: "ml", per: 100, kcal: 25, p: 0.4, c: 8, f: 0, step: 5, chips: [15, 30, 40], aisle: "horti", shop: "Limão" },
  "leite-po-desnatado": { name: "Leite em pó desnatado", emoji: "🥛", kind: "textura", unit: "cs", per: 1, kcal: 29, p: 2.8, c: 4.2, f: 0.1, step: 0.5, chips: [1, 2], aisle: "mercearia", note: "1 colher de sopa ≈ 8 g" },
  "goma-xantana": { name: "Goma xantana", emoji: "🧪", kind: "textura", unit: "cc", per: 1, kcal: 9, p: 0, c: 2.4, f: 0, step: 0.25, chips: [0.25, 0.5], aisle: "mercearia", note: "¼ de colher de chá já basta (muito vira chiclete)" },
  "pudim-zero": { name: "Pó de pudim zero açúcar", emoji: "🍮", kind: "textura", unit: "cs", per: 1, kcal: 26, p: 0, c: 6.5, f: 0, step: 0.5, chips: [0.5, 1], aisle: "mercearia", label: true, labelNote: "por 1 colher de sopa (≈8 g)" },
  cacau: { name: "Cacau em pó 100%", emoji: "🟫", kind: "sabor", unit: "cs", per: 1, kcal: 14, p: 1.2, c: 3.5, f: 0.8, step: 0.5, chips: [0.5, 1, 2], aisle: "mercearia", note: "1 colher de sopa ≈ 6 g" },
  adocante: { name: "Adoçante (eritritol, xilitol ou sucralose)", emoji: "🍬", kind: "sabor", unit: "gosto", aisle: "mercearia", shop: "Adoçante" },
  baunilha: { name: "Essência de baunilha", emoji: "🌼", kind: "sabor", unit: "gosto", aisle: "mercearia" },
  canela: { name: "Canela em pó", emoji: "🟤", kind: "sabor", unit: "gosto", staple: true },
  hortela: { name: "Hortelã", emoji: "🌱", kind: "sabor", unit: "gosto", aisle: "horti" },
  "raspas-limao": { name: "Raspas de limão", emoji: "🍋", kind: "sabor", unit: "gosto", aisle: "horti", shop: "Limão" },
  sal: { name: "Pitada de sal", emoji: "🧂", kind: "sabor", unit: "gosto", staple: true },
  pacoca: { name: "Paçoca (rolha)", emoji: "🥜", kind: "mixin", unit: "un", per: 1, kcal: 107, p: 3.5, c: 11, f: 5.8, step: 1, chips: [1, 2], aisle: "mercearia", shop: "Paçoca", note: "1 rolha ≈ 20 g" },
  "chocolate-70": { name: "Chocolate 70% picado", emoji: "🍫", kind: "mixin", unit: "g", per: 10, kcal: 58, p: 0.9, c: 3.6, f: 4.3, step: 5, chips: [10, 15, 20], aisle: "mercearia", shop: "Chocolate 70%" },
  granola: { name: "Granola sem açúcar", emoji: "🥣", kind: "mixin", unit: "g", per: 10, kcal: 42, p: 1, c: 6.2, f: 1.3, step: 5, chips: [10, 20, 30], aisle: "mercearia", shop: "Granola" },
  "pasta-amendoim": { name: "Pasta de amendoim", emoji: "🥜", kind: "mixin", unit: "cs", per: 1, kcal: 88, p: 3.8, c: 3, f: 7.4, step: 0.5, chips: [0.5, 1], aisle: "mercearia", note: "1 colher de sopa ≈ 15 g" },
  nibs: { name: "Nibs de cacau", emoji: "🌰", kind: "mixin", unit: "g", per: 10, kcal: 57, p: 1.3, c: 3.4, f: 4.6, step: 5, chips: [5, 10, 15], aisle: "mercearia" },
};

// Mix-ins de um toque (na tela da receita): quantidade padrão de cada um
const KITCHEN_ICE_MIXINS = [
  { ing: "morango", qty: 50, label: "Morango picado" },
  { ing: "frutas-vermelhas", qty: 40, label: "Frutas vermelhas" },
  { ing: "banana", qty: 50, label: "Rodelas de banana" },
  { ing: "pacoca", qty: 1, label: "Paçoca esfarelada" },
  { ing: "chocolate-70", qty: 15, label: "Chocolate 70%" },
  { ing: "nibs", qty: 10, label: "Nibs de cacau" },
  { ing: "granola", qty: 20, label: "Granola" },
  { ing: "pasta-amendoim", qty: 1, label: "Fio de pasta de amendoim" },
];

const KITCHEN_ICE_EMOJIS = ["🍦", "🍨", "🍧", "🍫", "🍓", "🍌", "🥭", "🍍", "🫐", "🍋", "☕", "🥜", "💪", "🟣", "🍉", "🥥"];

/* Receitas prontas (pote normal, 470 ml). line: "proteico" ou "fruta".
 * items: [{ ing, qty (null = a gosto), optional? }] · mixins: ids sugeridos.
 * respin: com o que molhar no Re-spin. tip: o pulo do gato dela. */
const KITCHEN_ICE_RECIPES = [
  {
    id: "baunilha", name: "Baunilha proteica clássica", emoji: "🍦", program: "lite", line: "proteico",
    about: "A base de tudo: o sorvete de baunilha fit que vira qualquer outro com mix-in. Leite desnatado + whey dá a proteína, o leite em pó e a goma xantana seguram a cremosidade sem gordura.",
    items: [
      { ing: "leite-desnatado", qty: 320 },
      { ing: "whey-baunilha", qty: 1 },
      { ing: "leite-po-desnatado", qty: 1 },
      { ing: "goma-xantana", qty: 0.25 },
      { ing: "adocante", qty: null },
      { ing: "baunilha", qty: null, optional: true },
    ],
    mixins: ["pacoca", "morango", "chocolate-70"], respin: "leite",
    tip: "Põe adoçante a mais do que acha certo: o gelado tira o doce da boca.",
  },
  {
    id: "chocolate", name: "Chocolate trufado fit", emoji: "🍫", program: "lite", line: "proteico",
    about: "Chocolate de verdade sem gordura: whey de chocolate + cacau 100% pra dar o amargo de trufa. O cacau também ajuda a encorpar.",
    items: [
      { ing: "leite-desnatado", qty: 320 },
      { ing: "whey-chocolate", qty: 1 },
      { ing: "cacau", qty: 1 },
      { ing: "leite-po-desnatado", qty: 1 },
      { ing: "goma-xantana", qty: 0.25 },
      { ing: "adocante", qty: null },
      { ing: "sal", qty: null, optional: true },
    ],
    mixins: ["banana", "pasta-amendoim", "nibs"], respin: "leite",
    tip: "Uma pitada de sal deixa o chocolate mais chocolate. Sério.",
  },
  {
    id: "monstro", name: "Pote monstro 50 g", emoji: "💪", program: "lite", line: "proteico",
    about: "Pra dia de treino pesado: dois scoops no pote, passa dos 50 g de proteína. Com tanto whey a base fica mais seca, então quase sempre pede 2 Re-spins.",
    items: [
      { ing: "leite-desnatado", qty: 300 },
      { ing: "whey-baunilha", qty: 2 },
      { ing: "goma-xantana", qty: 0.25 },
      { ing: "adocante", qty: null },
    ],
    mixins: ["morango", "pacoca"], respin: "leite",
    tip: "Ficou borrachudo tipo chiclete? É whey demais pra pouca água: na próxima tira a goma ou põe +30 ml de leite.",
  },
  {
    id: "morango-baunilha", name: "Morango com baunilha", emoji: "🍓", program: "lite", line: "proteico",
    about: "O sorvete de morango de padaria versão fit: a fruta batida na base dá a cor e o sabor, e ainda ajuda a cremosidade.",
    items: [
      { ing: "leite-desnatado", qty: 230 },
      { ing: "whey-baunilha", qty: 1 },
      { ing: "morango", qty: 150 },
      { ing: "goma-xantana", qty: 0.25 },
      { ing: "adocante", qty: null },
    ],
    mixins: ["morango", "chocolate-70"], respin: "leite",
    tip: "Guarda uns morangos picados pro Mix-in: pedaço de fruta no sorvete é outro nível.",
  },
  {
    id: "banana-canela", name: "Banana com canela", emoji: "🍌", program: "lite", line: "proteico",
    about: "A banana bem madura faz o papel da gordura: deixa o pote cremoso sem goma nem pudim. Canela por cima e vira sobremesa de vó.",
    items: [
      { ing: "leite-desnatado", qty: 250 },
      { ing: "whey-baunilha", qty: 1 },
      { ing: "banana", qty: 100 },
      { ing: "canela", qty: null },
      { ing: "adocante", qty: null, optional: true },
    ],
    mixins: ["granola", "pasta-amendoim"], respin: "leite",
    tip: "Banana com pintinha preta: quanto mais madura, mais doce e mais cremoso.",
  },
  {
    id: "macaco", name: "Chocolate com banana (Macaco Fit)", emoji: "🐒", program: "lite", line: "proteico",
    about: "Chocolate + banana, a dupla que nunca erra. A banana encorpa e adoça, o cacau dá a cara de brigadeiro.",
    items: [
      { ing: "leite-desnatado", qty: 250 },
      { ing: "whey-chocolate", qty: 1 },
      { ing: "banana", qty: 80 },
      { ing: "cacau", qty: 1 },
      { ing: "adocante", qty: null, optional: true },
    ],
    mixins: ["pacoca", "nibs"], respin: "leite",
  },
  {
    id: "mocha-v60", name: "Mocha da V60", emoji: "☕", program: "lite", line: "proteico",
    about: "Pra quem ama café coado: passa um café na V60 mais forte, espera esfriar e vira sorvete de mocha. Cafeína + proteína, o pré-treino gelado.",
    items: [
      { ing: "cafe", qty: 150 },
      { ing: "leite-desnatado", qty: 180 },
      { ing: "whey-chocolate", qty: 1 },
      { ing: "cacau", qty: 1 },
      { ing: "goma-xantana", qty: 0.25 },
      { ing: "adocante", qty: null },
    ],
    mixins: ["nibs", "chocolate-70"], respin: "leite",
    tip: "Faz o café com o dobro de pó (tipo 20 g pra 150 ml). Café fraco some no gelado. E evita depois das 16h, hein.",
  },
  {
    id: "acai", name: "Açaí proteico de tigela", emoji: "🟣", program: "smoothie", line: "proteico",
    about: "Açaí de verdade, sem xarope de guaraná: polpa sem açúcar + banana + whey. No Smoothie Bowl sai firme igual de tigela. A gordura daqui é a do próprio açaí (gordura boa).",
    items: [
      { ing: "acai", qty: 200 },
      { ing: "banana", qty: 60 },
      { ing: "leite-desnatado", qty: 120 },
      { ing: "whey-baunilha", qty: 1 },
      { ing: "adocante", qty: null, optional: true },
    ],
    mixins: ["granola", "banana", "morango"], respin: "leite",
    tip: "Granola vai por cima na hora de comer (no Mix-in ela amolece).",
  },
  {
    id: "maracuja", name: "Mousse gelado de maracujá", emoji: "🟡", program: "lite", line: "proteico",
    about: "Gosto de mousse de maracujá, cara de sorvete e proteína de iogurte grego. O azedinho da fruta com o doce do adoçante é viciante.",
    items: [
      { ing: "maracuja", qty: 150 },
      { ing: "iogurte-proteico", qty: 200 },
      { ing: "whey-baunilha", qty: 1 },
      { ing: "adocante", qty: null },
    ],
    mixins: ["chocolate-70", "granola"], respin: "leite",
    tip: "Polpa de maracujá é bem ácida: capricha no adoçante e prova a base antes de congelar.",
  },
  {
    id: "torta-limao", name: "Torta de limão gelada", emoji: "🍋", program: "lite", line: "proteico",
    about: "Iogurte proteico + limão + raspas = recheio de torta de limão. Granola no Mix-in faz o papel da massinha.",
    items: [
      { ing: "iogurte-proteico", qty: 200 },
      { ing: "leite-desnatado", qty: 100 },
      { ing: "whey-baunilha", qty: 1 },
      { ing: "suco-limao", qty: 40 },
      { ing: "raspas-limao", qty: null },
      { ing: "adocante", qty: null },
    ],
    mixins: ["granola"], respin: "leite",
    tip: "Raspa só a parte verde do limão: o branco amarga.",
  },
  {
    id: "froyo-vermelhas", name: "Frozen yogurt de frutas vermelhas", emoji: "🫐", program: "lite", line: "proteico",
    about: "Froyo fit: iogurte proteico com frutas vermelhas, azedinho e cremoso. Na Deluxe dá pra usar o programa Frozen Yogurt.",
    items: [
      { ing: "iogurte-proteico", qty: 300 },
      { ing: "frutas-vermelhas", qty: 100 },
      { ing: "leite-desnatado", qty: 40 },
      { ing: "adocante", qty: null },
    ],
    mixins: ["frutas-vermelhas", "granola"], respin: "leite",
  },
  {
    id: "sorbet-manga", name: "Sorbet de manga com limão", emoji: "🥭", program: "sorbet", line: "fruta",
    about: "Só fruta: manga madura batida com limão. Sai liso, doce e com aquele azedinho que limpa a boca. Zero gordura.",
    items: [
      { ing: "manga", qty: 350 },
      { ing: "suco-limao", qty: 30 },
      { ing: "agua", qty: 50 },
      { ing: "adocante", qty: null, optional: true },
    ],
    mixins: [], respin: "agua",
    tip: "Manga palmer ou tommy bem madura. Manga verde = raspadinha.",
  },
  {
    id: "sorbet-abacaxi", name: "Sorbet de abacaxi com hortelã", emoji: "🍍", program: "sorbet", line: "fruta",
    about: "O suco de abacaxi com hortelã de padaria virou sorvete. Refrescância nível SP 35 °C.",
    items: [
      { ing: "abacaxi", qty: 380 },
      { ing: "hortela", qty: null },
      { ing: "agua", qty: 30 },
    ],
    mixins: [], respin: "agua",
    tip: "Bate as folhas de hortelã junto com o abacaxi (umas 8 folhas).",
  },
  {
    id: "sorbet-vermelhas", name: "Sorbet de frutas vermelhas", emoji: "🍒", program: "sorbet", line: "fruta",
    about: "Frutas vermelhas congeladas com água de coco: cor de picolé de groselha e gosto de fruta de verdade.",
    items: [
      { ing: "frutas-vermelhas", qty: 320 },
      { ing: "agua-coco", qty: 120 },
      { ing: "adocante", qty: null },
    ],
    mixins: [], respin: "agua",
    tip: "Frutas vermelhas são azedas: adoça bem. Quer sem sementinha? Passa a base na peneira.",
  },
  {
    id: "sorbet-morango", name: "Sorbet de morango", emoji: "🍓", program: "sorbet", line: "fruta",
    about: "Morango, um tiquinho de limão pra acordar o sabor e só. O sorvete mais leve do livro.",
    items: [
      { ing: "morango", qty: 380 },
      { ing: "suco-limao", qty: 15 },
      { ing: "adocante", qty: null },
    ],
    mixins: [], respin: "agua",
  },
  {
    id: "sorbet-melancia", name: "Sorbet de melancia", emoji: "🍉", program: "sorbet", line: "fruta",
    about: "Melancia batida e congelada. Quase não tem caloria e mata a sede. Fica mais pra raspadinha cremosa (é quase só água).",
    items: [
      { ing: "melancia", qty: 420 },
      { ing: "suco-limao", qty: 15 },
      { ing: "hortela", qty: null, optional: true },
    ],
    mixins: [], respin: "agua",
    tip: "Tira as sementes antes de bater. Se sair muito raspadinha, 1 Re-spin com 1 colher de água resolve.",
  },
  {
    id: "nice-cream", name: "Nice cream de banana", emoji: "🍌", program: "sorbet", line: "fruta",
    about: "Só banana madura com um pouco de água de coco: fica cremoso igual sorvete de massa, sem leite e sem nada.",
    items: [
      { ing: "banana", qty: 320 },
      { ing: "agua-coco", qty: 60 },
      { ing: "canela", qty: null, optional: true },
    ],
    mixins: ["pacoca", "nibs"], respin: "agua",
    tip: "Banana muito madura (casca quase preta) é o segredo.",
  },
  {
    id: "sorbet-tropical", name: "Tropical do Cloba", emoji: "🏝️", program: "sorbet", line: "fruta",
    about: "Manga + abacaxi + maracujá + água de coco: um suco de praia em forma de sorvete.",
    items: [
      { ing: "manga", qty: 200 },
      { ing: "abacaxi", qty: 150 },
      { ing: "maracuja", qty: 50 },
      { ing: "agua-coco", qty: 50 },
      { ing: "adocante", qty: null, optional: true },
    ],
    mixins: [], respin: "agua",
  },
];

function kitchenIceIng(id) {
  return KITCHEN_ICE_INGS[id] || null;
}

function kitchenIceProgram(key) {
  return KITCHEN_ICE_PROGRAMS.find((p) => p.key === key) || KITCHEN_ICE_PROGRAMS[0];
}

function kitchenIceSize(key) {
  return KITCHEN_ICE_SIZES[key] || KITCHEN_ICE_SIZES.std;
}

function kitchenIceSizeOf(db) {
  return kitchenIceSize(db && db.iceSize);
}

// Potes montados pelo usuário (db.ices)
function kitchenIcesOf(db) {
  return (db && Array.isArray(db.ices) ? db.ices : []).filter((r) => r && typeof r === "object" && Array.isArray(r.items));
}

// Receita pronta (pelo id) ou pote do usuário ("m-..."); pronta ganha fixed: true
function kitchenIceRecipe(db, id) {
  const key = String(id || "");
  const fixed = KITCHEN_ICE_RECIPES.find((r) => r.id === key);
  if (fixed) return { ...fixed, fixed: true };
  return kitchenIcesOf(db).find((r) => String(r.id) === key) || null;
}

// Números de um ingrediente: rótulo do usuário (db.iceLabels) por cima do médio
function kitchenIceIngMacros(db, id) {
  const ing = kitchenIceIng(id);
  if (!ing || ing.unit === "gosto") return null;
  const base = { kcal: ing.kcal, p: ing.p, c: ing.c, f: ing.f };
  const own = db && db.iceLabels && typeof db.iceLabels === "object" ? db.iceLabels[id] : null;
  if (own && typeof own === "object") {
    ["kcal", "p", "c", "f"].forEach((k) => {
      const n = Number(own[k]);
      if (own[k] !== "" && own[k] !== null && own[k] !== undefined && Number.isFinite(n) && n >= 0) base[k] = n;
    });
  }
  return base;
}

/* Soma os macros de uma lista [{ ing, qty }] vezes `factor` (tamanho do pote).
 * ml = volume aproximado da base (líquidos, frutas e iogurte; pó quase não
 * conta), pra régua da linha MAX. Opcional entra (é o "até onde vai"). */
function kitchenIceMacros(db, items, factor = 1) {
  const out = { kcal: 0, p: 0, c: 0, f: 0, ml: 0 };
  (Array.isArray(items) ? items : []).forEach((item) => {
    const ing = item && kitchenIceIng(item.ing);
    const qty = Number(item && item.qty);
    if (!ing || ing.unit === "gosto" || !(qty > 0)) return;
    const m = kitchenIceIngMacros(db, item.ing);
    const ratio = (qty * factor) / ing.per;
    out.kcal += m.kcal * ratio;
    out.p += m.p * ratio;
    out.c += m.c * ratio;
    out.f += m.f * ratio;
    if (ing.kind !== "mixin" && (ing.unit === "ml" || ing.unit === "g")) out.ml += qty * factor;
    else if (ing.unit === "scoop") out.ml += 15 * qty * factor; // pó de whey ocupa um tiquinho
  });
  return out;
}

// Macros do pote inteiro de uma receita no tamanho escolhido
function kitchenIcePintMacros(db, recipe, sizeKey) {
  const size = kitchenIceSize(sizeKey || (db && db.iceSize));
  return kitchenIceMacros(db, recipe && recipe.items, size.factor);
}

// Quantidade de um ingrediente no pote escolhido (g/ml de 5 em 5, resto em ¼)
function kitchenIceScaledQty(qty, unit, factor) {
  if (qty === null || qty === undefined) return null;
  const n = Number(qty) * factor;
  if (unit === "g" || unit === "ml") return Math.max(5, Math.round(n / 5) * 5);
  if (unit === "un") return Math.max(1, Math.round(n));
  return Math.max(0.25, Math.round(n * 4) / 4);
}

// "320 ml", "1 ½ scoop", "¼ colher de chá", "a gosto"
function kitchenIceQtyText(qty, unit) {
  if (qty === null || qty === undefined || unit === "gosto") return "a gosto";
  if (unit === "g" || unit === "ml") return `${Math.round(qty)} ${unit}`;
  return kitchenFormatAmount(qty, unit);
}

// Sorbet / só fruta (conquista "Só fruta, juro")
function kitchenIceIsFruit(recipe) {
  if (!recipe) return false;
  if (recipe.line) return recipe.line === "fruta";
  return recipe.program === "sorbet";
}

function kitchenIcePintsOf(db) {
  return (db && Array.isArray(db.icePints) ? db.icePints : []).filter((p) => p && typeof p === "object" && p.iceId);
}

// Comidos de uma receita, mais novo primeiro
function kitchenIceEatenOf(db, iceId) {
  return kitchenIcePintsOf(db)
    .filter((p) => Number(p.eatenAt) > 0 && (iceId === undefined || String(p.iceId) === String(iceId)))
    .sort((a, b) => Number(b.eatenAt) - Number(a.eatenAt));
}

// No freezer (congelado e ainda não comido), mais antigo primeiro
function kitchenIceFreezerOf(db) {
  return kitchenIcePintsOf(db)
    .filter((p) => !(Number(p.eatenAt) > 0) && Number(p.frozenAt) > 0)
    .sort((a, b) => Number(a.frozenAt) - Number(b.frozenAt));
}

const KITCHEN_ICE_FREEZE_MS = 24 * 60 * 60 * 1000; // 24 h no freezer

// Quanto falta pro pote ficar pronto (ms; 0 = pronto)
function kitchenIceLeftMs(pint, now = Date.now()) {
  const ready = Number(pint && pint.frozenAt) + KITCHEN_ICE_FREEZE_MS;
  return Math.max(0, ready - now);
}

// Números do pote comido (proteína pra conquista do pote monstro), no tamanho em que foi feito
function kitchenIcePintEatenMacros(db, pint) {
  const recipe = kitchenIceRecipe(db, pint && pint.iceId);
  return recipe ? kitchenIcePintMacros(db, recipe, pint.size) : null;
}

/* Conquistas dos sorvetes (entram no calcKitchenPlayer): cada pote comido
 * é um passo da timeline. Devolve a lista ordenada de { date, doneAt, pint }. */
function kitchenIceEatenEvents(db, today) {
  return kitchenIcePintsOf(db)
    .filter((p) => Number(p.eatenAt) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || "")) && p.date <= today)
    .map((p) => ({ date: p.date, doneAt: Number(p.eatenAt), pint: p }));
}
