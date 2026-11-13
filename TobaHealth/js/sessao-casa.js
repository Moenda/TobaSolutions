/* =====================================================================
 * Toba Health · 🏠 Treinos em casa ao vivo (desde v1.87)
 * Pedido do Rafa: uma seção "Treinos em casa" juntando o Saitama, o
 * alongamento e treinos novos sem equipamento (HIIT, Tabata, cardio sem
 * pulo, força e abdômen). Intervalos de trabalho/descanso com timer
 * redondo, voz, contagem 3-2-1 e bonequinho SVG que se mexe.
 *
 * Catálogo e planos moram em health-metrics.js (HOME_EXERCISES,
 * HOME_PLANS, buildHomeSteps): o mapa de calor das outras páginas usa.
 *
 * Usa a MESMA chave do treino ao vivo (TOBA_HEALTH_ACTIVE_SESSION) com
 * kind "home", exercises: [] e:
 *   liveSession.home = {
 *     plan: id do HOME_PLANS, step: índice em buildHomeSteps(plan),
 *     endsAt: ms (fim do passo atual; null = pausado), left: ms (pausado),
 *     pausedAt: ms|null, pausedMs: ms parados, done: { exerciseId: segundos },
 *     finished: bool, finishedAt: ms|null
 *   }
 * Tempos são horários (Date.now()): com a aba congelada o tique recupera
 * todos os passos que passaram. Ao salvar vira um treino "home" normal:
 *   { type: "home", title: "HIIT 10 min", durationMinutes, calories,
 *     home: { plan, done }, ... campos de número null }
 * Vale XP, sequência, conquistas e Hall como qualquer treino.
 *
 * 🟣 Elástico (v2.06, pedido do Rafa: kit de super band, treinar o que o
 * Saitama não treina = puxar). Planos "el-*" na seção 💪 Força, mesmo motor.
 * Cada exercício com elástico tem um chip de cor (toca = troca) que vale na
 * abertura e ao vivo. Extras no liveSession.home: bands { exerciseId: cor },
 * feel "leve"|"certo"|"pesado". O treino salvo ganha home.bands, home.levels
 * (1 = mais leve) e home.kg (kg de cada exercício na hora) + home.feel.
 * Prefs (TOBA_HEALTH_LIVE_PREFS): elasticOrder [cores do leve pro forte],
 * elasticKg { cor: kg }, elasticPick { exerciseId: cor } (o último usado).
 *
 * Carregado DEPOIS de sessao.js / sessao-saitama.js / sessao-alongamento.js
 * e ANTES de treinos.js.
 * ===================================================================== */

const HOME_TYPE_TITLE = "Treino em casa";

const HOME_QUIPS = [
  "Sem academia, sem mensalidade, sem desculpa 😎",
  "Respira pela boca e solta a mandíbula: o dente agradece 🦷",
  "Cansou? Diminui o ritmo, mas não para.",
  "O tapete da sala nunca viu tanto suor.",
  "Killua e Gon tão te julgando do sofá 🐈",
  "Isso aqui é o que o Saitama fazia antes de ficar careca.",
  "Cada tiro conta. O XP tá vendo.",
  "Feio e feito é melhor que bonito e no sofá.",
];

/* ---------------------------------------------------------------------
 * Bonequinho de cada exercício (SVG à mão, 120 × 90, chão em y = 86).
 * Mesmo traço do alongamento (classes sf-*). Cada exercício tem 1 ou 2
 * poses (frames): no trabalho elas se alternam e o boneco "faz" o
 * movimento. hl = músculo que trabalha (laranja). key = pose das listas.
 * ------------------------------------------------------------------- */
const HOME_CHAIR = '<path d="M10 56 H36 M12 56 V86 M34 56 V86 M12 56 V28" class="sf-prop"/>';
const HOME_WALL = '<line x1="28" y1="2" x2="28" y2="86" class="sf-wall"/>';

const HOME_FIGURES = {
  polichinelo: { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 30, 52, 54], [60, 30, 68, 54]] },
    { head: [60, 10], base: [[60, 18, 60, 48], [60, 48, 44, 82], [60, 48, 76, 82]], hl: [[60, 26, 44, 6], [60, 26, 76, 6]] },
  ] },
  "polichinelo-passo": { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 30, 52, 54], [60, 30, 68, 54]] },
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 56, 86], [60, 52, 82, 84]], hl: [[60, 30, 44, 8], [60, 30, 76, 8]] },
  ] },
  agachamento: { key: 1, frames: [
    { head: [56, 14], base: [[56, 22, 56, 52], [56, 30, 78, 32], [56, 86, 66, 86]], hl: [[56, 52, 56, 86]] },
    { head: [58, 30], base: [[44, 62, 54, 38], [54, 40, 80, 42], [60, 86, 72, 86]], hl: [[44, 62, 66, 64, 60, 86]] },
  ] },
  "agachamento-salto": { key: 1, frames: [
    { head: [58, 30], base: [[44, 62, 54, 38], [54, 40, 80, 42], [60, 86, 72, 86]], hl: [[44, 62, 66, 64, 60, 86]] },
    { head: [56, 8], base: [[56, 16, 56, 44], [56, 22, 46, 2], [56, 22, 66, 2]], hl: [[56, 44, 58, 62, 56, 78, 64, 80]] },
  ] },
  flexao: { key: 0, frames: [
    { head: [94, 48], base: [[14, 84, 86, 52]], hl: [[86, 52, 86, 86]] },
    { head: [95, 70], base: [[14, 84, 86, 72]], hl: [[86, 72, 94, 78, 86, 86]] },
  ] },
  prancha: { key: 0, frames: [
    { head: [93, 61], base: [[14, 84, 84, 64], [84, 64, 84, 86, 102, 86]], hl: [[34, 78, 70, 68]] },
  ] },
  afundo: { key: 1, frames: [
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 30, 62, 52]], hl: [[58, 52, 58, 86]] },
    { head: [58, 18], base: [[58, 26, 58, 56], [58, 32, 62, 54]], hl: [[58, 56, 76, 66, 76, 86], [58, 56, 48, 82, 32, 84]] },
  ] },
  ponte: { key: 1, frames: [
    { head: [14, 80], base: [[22, 82, 56, 82], [26, 86, 48, 86]], hl: [[56, 82, 74, 64, 88, 84]] },
    { head: [14, 80], base: [[22, 82, 44, 71], [26, 86, 48, 86]], hl: [[44, 71, 58, 64, 78, 60, 88, 84]] },
  ] },
  abdominal: { key: 1, frames: [
    { head: [16, 78], base: [[23, 82, 58, 82], [58, 82, 74, 64, 88, 84], [30, 82, 40, 76]], hl: [[30, 82, 52, 82]] },
    { head: [30, 62], base: [[58, 82, 74, 64, 88, 84], [38, 68, 48, 74]], hl: [[58, 82, 36, 68]] },
  ] },
  bicicleta: { key: 0, frames: [
    { head: [28, 62], base: [[58, 80, 96, 78], [58, 80, 72, 62, 84, 66], [36, 68, 50, 62]], hl: [[58, 80, 36, 68]] },
    { head: [32, 63], base: [[58, 80, 98, 70], [58, 80, 74, 64, 90, 72], [38, 70, 54, 66]], hl: [[58, 80, 38, 70]] },
  ] },
  escalador: { key: 0, frames: [
    { head: [94, 48], base: [[46, 68, 86, 52], [46, 68, 14, 84], [86, 52, 86, 86]], hl: [[46, 68, 70, 66, 62, 82]] },
    { head: [94, 48], base: [[46, 68, 86, 52], [46, 68, 16, 86], [86, 52, 86, 86]], hl: [[46, 68, 60, 76, 50, 86]] },
  ] },
  skipping: { key: 0, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 58, 86], [60, 30, 70, 40, 74, 30], [60, 30, 52, 42, 48, 52]], hl: [[60, 52, 76, 52, 74, 72]] },
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 62, 86], [60, 30, 52, 40, 48, 30], [60, 30, 68, 42, 72, 52]], hl: [[60, 52, 74, 56, 70, 76]] },
  ] },
  burpee: { key: 1, frames: [
    { head: [94, 48], base: [[14, 84, 86, 52]], hl: [[86, 52, 86, 86]] },
    { head: [56, 8], base: [[56, 16, 56, 44], [56, 22, 46, 2], [56, 22, 66, 2]], hl: [[56, 44, 58, 62, 56, 78, 64, 80]] },
  ] },
  "mergulho-cadeira": { key: 1, frames: [
    { head: [36, 26], base: [[36, 34, 40, 60], [40, 60, 66, 62, 66, 86]], hl: [[36, 36, 32, 56]], extra: HOME_CHAIR },
    { head: [40, 42], base: [[40, 50, 42, 74], [42, 74, 66, 66, 66, 86]], hl: [[40, 52, 26, 48, 32, 56]], extra: HOME_CHAIR },
  ] },
  superman: { key: 1, frames: [
    { head: [92, 77], base: [[22, 84, 84, 84], [84, 84, 110, 84]], hl: [[46, 84, 80, 84]] },
    { head: [92, 64], base: [[18, 74, 52, 84], [84, 72, 108, 60]], hl: [[52, 84, 84, 72]] },
  ] },
  boxe: { key: 0, frames: [
    { head: [56, 14], base: [[56, 22, 56, 52], [56, 52, 46, 86], [56, 52, 68, 86], [56, 30, 64, 40, 62, 24]], hl: [[56, 30, 94, 28]] },
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 52, 48, 86], [58, 52, 70, 86], [58, 30, 50, 40, 56, 24]], hl: [[58, 30, 72, 38, 70, 22]] },
  ] },
  "panturrilha-pe": { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 60, 68], [60, 30, 64, 52], [60, 86, 72, 86]], hl: [[60, 68, 60, 86]] },
    { head: [60, 8], base: [[60, 16, 60, 46], [60, 46, 60, 62], [60, 24, 64, 46], [62, 80, 72, 86]], hl: [[60, 62, 62, 80]] },
  ] },
  "cadeira-parede": { key: 0, frames: [
    { head: [36, 22], base: [[36, 30, 36, 58], [64, 58, 64, 86, 74, 86], [36, 36, 50, 52]], hl: [[36, 58, 64, 58]], extra: HOME_WALL },
  ] },
  // v2.06: 🟣 elástico. band = traço do elástico (pinta na cor escolhida)
  "remada-curvada": { key: 1, frames: [
    { head: [86, 32], base: [[50, 54, 54, 70, 50, 86], [78, 38, 78, 62]], hl: [[50, 54, 78, 38]], band: [[52, 86, 78, 62]] },
    { head: [86, 32], base: [[50, 54, 54, 70, 50, 86], [78, 38, 66, 46, 72, 56]], hl: [[50, 54, 78, 38]], band: [[52, 86, 72, 56]] },
  ] },
  "remada-sentada": { key: 1, frames: [
    { head: [46, 46], base: [[40, 82, 96, 84], [44, 58, 80, 70]], hl: [[40, 82, 44, 54]], band: [[80, 70, 98, 80]] },
    { head: [46, 46], base: [[40, 82, 96, 84], [44, 58, 30, 66, 46, 70]], hl: [[40, 82, 44, 54]], band: [[46, 70, 98, 80]] },
  ] },
  encolhimento: { key: 1, frames: [
    { head: [60, 16], base: [[60, 24, 60, 54], [60, 54, 54, 86], [60, 54, 66, 86]], hl: [[60, 30, 50, 34, 50, 58], [60, 30, 70, 34, 70, 58]], band: [[54, 86, 50, 58], [66, 86, 70, 58]] },
    { head: [60, 16], base: [[60, 24, 60, 54], [60, 54, 54, 86], [60, 54, 66, 86]], hl: [[60, 26, 50, 28, 50, 52], [60, 26, 70, 28, 70, 52]], band: [[54, 86, 50, 52], [66, 86, 70, 52]] },
  ] },
  "thruster-elastico": { key: 1, frames: [
    { head: [58, 30], base: [[44, 62, 54, 38]], hl: [[44, 62, 66, 64, 60, 86], [54, 40, 66, 50, 64, 38]], band: [[62, 86, 64, 38]] },
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 28, 52, 4], [60, 28, 68, 4]], band: [[54, 86, 52, 4], [66, 86, 68, 4]] },
  ] },
  "abdominal-crunch-elastico": { key: 1, frames: [
    { head: [16, 78], base: [[23, 82, 58, 82], [58, 82, 74, 64, 88, 84], [30, 82, 60, 74]], hl: [[30, 82, 52, 82]], band: [[28, 84, 60, 74]] },
    { head: [30, 62], base: [[58, 82, 74, 64, 88, 84], [38, 68, 66, 68]], hl: [[58, 82, 36, 68]], band: [[40, 74, 66, 68]] },
  ] },
  "coice-gluteo": { key: 1, frames: [
    { head: [92, 52], base: [[44, 62, 84, 58], [84, 58, 86, 86], [44, 62, 44, 86, 30, 86]], hl: [[44, 62, 60, 74, 50, 86]], band: [[86, 86, 50, 86]] },
    { head: [92, 52], base: [[44, 62, 84, 58], [84, 58, 86, 86], [44, 62, 44, 86, 30, 86]], hl: [[44, 62, 22, 52, 6, 46]], band: [[86, 86, 6, 46]] },
  ] },
  "face-pull": { key: 1, frames: [
    { head: [46, 46], base: [[40, 82, 96, 84]], hl: [[44, 58, 80, 66]], band: [[80, 66, 98, 80]] },
    { head: [46, 46], base: [[40, 82, 96, 84]], hl: [[44, 58, 34, 46, 52, 44]], band: [[52, 44, 98, 80]] },
  ] },
  "crucifixo-invertido": { key: 1, frames: [
    { head: [86, 32], base: [[50, 54, 54, 70, 50, 86], [50, 54, 78, 38]], hl: [[78, 38, 80, 62]], band: [[52, 86, 80, 62]] },
    { head: [86, 32], base: [[50, 54, 54, 70, 50, 86], [50, 54, 78, 38]], hl: [[78, 38, 84, 16]], band: [[52, 86, 84, 16]] },
  ] },
  "terra-elastico": { key: 1, frames: [
    { head: [84, 34], base: [[50, 52, 76, 40], [76, 40, 72, 70], [56, 70, 52, 86]], hl: [[50, 52, 56, 70]], band: [[54, 86, 72, 70]] },
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 28, 60, 56], [58, 70, 58, 86]], hl: [[58, 52, 58, 70]], band: [[58, 86, 60, 56]] },
  ] },
  "remada-unilateral": { key: 1, frames: [
    { head: [80, 28], base: [[54, 52, 72, 70, 72, 86], [54, 52, 36, 86], [70, 38, 72, 66]], hl: [[54, 52, 74, 34]], band: [[72, 86, 64, 64]], extra: '<path d="M70 38 L64 64" class="sf-body"/>' },
    { head: [80, 28], base: [[54, 52, 72, 70, 72, 86], [54, 52, 36, 86], [70, 38, 72, 66], [70, 38, 56, 44, 60, 54]], hl: [[54, 52, 74, 34]], band: [[72, 86, 60, 54]] },
  ] },
  "rosca-direta": { key: 1, frames: [
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 52, 56, 86], [58, 52, 64, 86], [60, 48, 62, 64]], hl: [[58, 28, 60, 48]], band: [[60, 86, 62, 64]] },
    { head: [58, 14], base: [[58, 22, 58, 52], [58, 52, 56, 86], [58, 52, 64, 86], [60, 48, 70, 32]], hl: [[58, 28, 60, 48]], band: [[60, 86, 70, 32]] },
  ] },
  "agachamento-elastico": { key: 1, frames: [
    { head: [56, 14], base: [[56, 22, 56, 52], [56, 30, 66, 40, 62, 28]], hl: [[56, 52, 56, 86]], band: [[58, 86, 62, 28]] },
    { head: [58, 30], base: [[44, 62, 54, 38], [54, 40, 66, 50, 64, 38]], hl: [[44, 62, 66, 64, 60, 86]], band: [[62, 86, 64, 38]] },
  ] },
  "supino-chao": { key: 1, frames: [
    { head: [16, 78], base: [[23, 82, 58, 82], [58, 82, 74, 64, 88, 84]], hl: [[30, 80, 40, 70, 34, 62]], band: [[34, 62, 26, 84]] },
    { head: [16, 78], base: [[23, 82, 58, 82], [58, 82, 74, 64, 88, 84]], hl: [[30, 80, 32, 46]], band: [[32, 46, 26, 84]] },
  ] },
  "triceps-cabeca": { key: 1, frames: [
    { head: [58, 18], base: [[58, 26, 58, 54], [58, 54, 56, 86], [58, 54, 64, 86], [64, 12, 52, 22]], hl: [[58, 30, 64, 12]], band: [[56, 86, 52, 22]] },
    { head: [58, 18], base: [[58, 26, 58, 54], [58, 54, 56, 86], [58, 54, 64, 86], [64, 12, 66, 2]], hl: [[58, 30, 64, 12]], band: [[56, 86, 66, 2]] },
  ] },
  "abdominal-elastico": { key: 1, frames: [
    { head: [48, 46], base: [[40, 82, 96, 82], [44, 60, 30, 80]], hl: [[40, 82, 46, 54]], band: [[46, 56, 98, 80]] },
    { head: [18, 54], base: [[40, 82, 96, 82], [28, 64, 40, 78]], hl: [[40, 82, 24, 62]], band: [[26, 62, 98, 80]] },
  ] },
  "desenvolvimento-elastico": { key: 1, frames: [
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 28, 46, 30, 46, 18], [60, 28, 74, 30, 74, 18]], band: [[54, 86, 46, 18], [66, 86, 74, 18]] },
    { head: [60, 14], base: [[60, 22, 60, 52], [60, 52, 54, 86], [60, 52, 66, 86]], hl: [[60, 28, 50, 4], [60, 28, 70, 4]], band: [[54, 86, 50, 4], [66, 86, 70, 4]] },
  ] },
};

HOME_FIGURES["rosca-martelo"] = HOME_FIGURES["rosca-direta"];
HOME_FIGURES["rosca-inversa"] = HOME_FIGURES["rosca-direta"];

function homeFrameSvg(frame, cls) {
  const lines = (list, kind) => (list || []).map((pts) => `<path d="${stretchPolyPath(pts)}" class="${kind}"/>`).join("");
  return `
        <g class="${cls}">
          ${frame.extra || ""}
          ${lines(frame.band, "sf-band-edge")}${lines(frame.band, "sf-band")}
          ${lines(frame.base, "sf-body")}
          ${lines(frame.hl, "sf-hl")}
          <circle cx="${frame.head[0]}" cy="${frame.head[1]}" r="7" class="sf-head"/>
        </g>`;
}

// size "lg": todas as poses (o CSS alterna no trabalho); "sm": só a pose key
// band (v2.06): id da cor do elástico (pinta o traço do elástico)
function homeFigureSvg(exerciseId, { size = "lg", band = "" } = {}) {
  const fig = HOME_FIGURES[exerciseId] || HOME_FIGURES.agachamento;
  const name = getHomeExercise(exerciseId)?.name || HOME_TYPE_TITLE;
  const frames = size === "lg"
    ? fig.frames.map((frame, index) => homeFrameSvg(frame, `hf hf-${index}`)).join("")
    : homeFrameSvg(fig.frames[fig.key] || fig.frames[0], "hf");
  const moves = size === "lg" && fig.frames.length > 1 ? " is-moving" : "";
  return `
    <svg class="stretch-fig home-fig is-${size}${moves}" viewBox="0 0 120 90" role="img" aria-label="Bonequinho: ${escapeHtml(name)}"${homeBandStyle(exerciseId, band)}>
      <line x1="2" y1="87" x2="118" y2="87" class="sf-floor"/>
      ${frames}
    </svg>`;
}

function homeBandStyle(exerciseId, band) {
  if (!getHomeExercise(exerciseId)?.band) return "";
  const color = getElasticBand(band || elasticPick(exerciseId))?.color;
  return color ? ` style="--band: ${color}"` : "";
}

/* ---------------------------------------------------------------------
 * Estado
 * ------------------------------------------------------------------- */
function normalizeHomeLive(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const plan = getHomePlan(data.plan) ? data.plan : HOME_PLANS[0].id;
  const total = buildHomeSteps(plan).length;
  const done = {};
  if (data.done && typeof data.done === "object") {
    Object.entries(data.done).forEach(([id, secs]) => {
      if (getHomeExercise(id) && Number(secs) > 0) done[id] = Math.round(Number(secs));
    });
  }
  const bands = {};
  if (data.bands && typeof data.bands === "object") {
    Object.entries(data.bands).forEach(([id, band]) => {
      if (getHomeExercise(id)?.band && getElasticBand(band)) bands[id] = band;
    });
  }
  return {
    plan,
    bands,
    feel: ["leve", "certo", "pesado"].includes(data.feel) ? data.feel : "",
    step: Math.min(Math.max(0, Math.round(Number(data.step) || 0)), Math.max(0, total - 1)),
    endsAt: Number(data.endsAt) || null,
    left: Math.max(0, Number(data.left) || 0),
    pausedAt: Number(data.pausedAt) || null,
    pausedMs: Math.max(0, Number(data.pausedMs) || 0),
    done,
    finished: Boolean(data.finished),
    finishedAt: Number(data.finishedAt) || null,
  };
}

function homeSteps(session = liveSession) {
  return buildHomeSteps(session?.home?.plan || "");
}

function homeWorkSeconds(data) {
  return Object.values(data.done || {}).reduce((sum, secs) => sum + (Number(secs) || 0), 0);
}

function homeMovingMs(session, now = Date.now()) {
  const data = session.home;
  const paused = data.pausedAt ? now - data.pausedAt : 0;
  const end = data.finished && data.finishedAt ? data.finishedAt : now;
  return Math.max(0, end - session.startedAt - data.pausedMs - (data.finished ? 0 : paused));
}

function homeRemainingSeconds(session, now = Date.now()) {
  const data = session.home;
  if (data.finished) return 0;
  const steps = homeSteps(session);
  const current = data.endsAt ? Math.max(0, data.endsAt - now) : data.left;
  const after = steps.slice(data.step + 1).reduce((sum, step) => sum + step.secs, 0);
  return Math.round(current / 1000) + after;
}

// "5/10 tiros · rolando" (aviso de treino em andamento)
function describeHomeLive(session) {
  const data = session.home;
  const steps = homeSteps(session);
  const works = steps.filter((step) => step.kind === "work").length;
  const done = steps.slice(0, data.step).filter((step) => step.kind === "work").length;
  const plan = getHomePlan(data.plan);
  if (data.finished) return `${plan?.short || ""} completo, falta salvar`;
  return `${done}/${works} tiros · ${data.endsAt ? "rolando" : "⏸ pausado"}`;
}

function readHomePrefs() {
  const prefs = readLivePrefs();
  return { voice: prefs.homeVoice !== false };
}

/* ---------------------------------------------------------------------
 * Voz e vibração (no APK 1.6+ a voz é a nativa: fala com a tela apagada)
 * ------------------------------------------------------------------- */
function homeSpeak(text) {
  if (!readHomePrefs().voice || !text) return;
  try {
    if (TOBA_NATIVE && typeof TOBA_NATIVE.speak === "function") {
      TOBA_NATIVE.speak(String(text), true);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const say = new SpeechSynthesisUtterance(String(text));
    say.lang = "pt-BR";
    say.rate = 1.05;
    window.speechSynthesis.speak(say);
  } catch (err) {
    /* sem voz: segue só com a vibração */
  }
}

function homeAnnounce(step, steps) {
  if (!step) return;
  const exercise = getHomeExercise(step.exerciseId);
  const bandName = exercise?.band ? getElasticBand(liveSession?.home?.bands?.[step.exerciseId] || elasticPick(step.exerciseId))?.name : "";
  const name = `${exercise?.name || ""}${bandName ? `, elástico ${bandName.toLowerCase()}` : ""}`;
  if (step.kind === "prep") {
    liveBuzz(120);
    homeSpeak(`Prepara. Primeiro: ${name}`);
  } else if (step.kind === "rest") {
    liveBuzz([80, 60, 80]);
    const index = steps.indexOf(step);
    const prev = steps[index - 1];
    const newRound = prev && step.round > prev.round;
    homeSpeak(`${newRound ? `Fim da volta ${prev.round}. ` : ""}Descansa. Próximo: ${name}`);
  } else {
    liveBuzz([200]);
    homeSpeak(`Vai! ${name}`);
  }
}

// 3-2-1 falado no fim do Prepara e do descanso (uma vez por passo)
let homeCountdownKey = "";
function homeCountdown(session, step, leftMs) {
  if (!step || step.kind === "work" || !session.home.endsAt) return;
  if (leftMs > 3200 || leftMs < 600) return;
  const key = `${session.id}:${session.home.step}`;
  if (homeCountdownKey === key) return;
  homeCountdownKey = key;
  liveBuzz(60);
  homeSpeak("3, 2, 1");
}

// v2.06: exercício de um lado só (remada com um braço): avisa na metade
let homeHalfKey = "";
function homeHalfway(session, step, leftMs) {
  if (!step || step.kind !== "work" || !session.home.endsAt) return;
  if (!getHomeExercise(step.exerciseId)?.sides) return;
  const half = (step.secs * 1000) / 2;
  if (leftMs > half || leftMs < half - 2000) return;
  const key = `${session.id}:${session.home.step}`;
  if (homeHalfKey === key) return;
  homeHalfKey = key;
  liveBuzz([120, 80, 120]);
  homeSpeak("Troca de lado");
}

/* ---------------------------------------------------------------------
 * 🟣 Elástico (v2.06): ordem das cores, kg, cor de cada exercício
 * ------------------------------------------------------------------- */
// Ordem do kit do Rafa pelo anúncio (azul < roxo < preto < verde). Outro
// kit? A pessoa acerta a ordem e o kg uma vez no 🎨 Meus elásticos.
const ELASTIC_DEFAULT_ORDER = ["azul", "roxo", "preto", "verde"];

function elasticOrder() {
  const saved = readLivePrefs().elasticOrder;
  const ids = ELASTIC_BANDS.map((band) => band.id);
  if (Array.isArray(saved) && saved.length === ids.length && ids.every((id) => saved.includes(id))) return saved.slice();
  return ELASTIC_DEFAULT_ORDER.slice();
}

function elasticLevel(bandId) {
  const index = elasticOrder().indexOf(bandId);
  return index >= 0 ? index + 1 : 2;
}

function elasticAtLevel(level) {
  const order = elasticOrder();
  return order[Math.min(order.length, Math.max(1, Math.round(level) || 2)) - 1];
}

function elasticKg(bandId) {
  const kg = Number((readLivePrefs().elasticKg || {})[bandId]);
  return kg > 0 ? kg : getElasticBand(bandId)?.kg || ELASTIC_LEVEL_KG[elasticLevel(bandId)];
}

// Cor do exercício: a última que a pessoa usou; nunca usou = nível sugerido
function elasticPick(exerciseId) {
  const pick = (readLivePrefs().elasticPick || {})[exerciseId];
  if (getElasticBand(pick)) return pick;
  return elasticAtLevel(getHomeExercise(exerciseId)?.lvl || 2);
}

function elasticStorePicks(patch) {
  storeLivePrefs({ elasticPick: { ...(readLivePrefs().elasticPick || {}), ...patch } });
}

function elasticNext(bandId) {
  const order = elasticOrder();
  return order[(order.indexOf(bandId) + 1) % order.length];
}

function elasticBandLabel(bandId) {
  const band = getElasticBand(bandId);
  const kg = elasticKg(bandId);
  return band ? `${band.dot} ${band.name} · ${formatWorkoutNumber(kg, Number.isInteger(kg) ? 0 : 1)} kg` : "";
}

// Chip da cor (toca = próxima cor, do leve pro forte, e dá a volta)
function elasticChip(exerciseId, bandId, click, attrs = "") {
  const band = getElasticBand(bandId);
  if (!band) return "";
  return `<button type="button" class="elastic-chip" style="--band: ${band.color}" data-click="${click}" data-ex="${exerciseId}"${attrs} aria-label="Elástico ${escapeHtml(band.name)}: toca pra trocar">${escapeHtml(elasticBandLabel(bandId))}</button>`;
}

function elasticOrderLine() {
  return elasticOrder().map((id) => getElasticBand(id)?.dot || "").join(" → ");
}

// Último treino de elástico desse plano com "como tava" respondido
function elasticLastFeel(planId) {
  const list = (healthDb.workouts || [])
    .filter((workout) => workout.type === "home" && workout.home?.plan === planId && workout.home?.feel)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  return list[0]?.home?.feel || "";
}

// 📅 Ideia do Rafa: dia de 👊 Saitama, dia de 🟣 elástico (só a dica, não
// mexe em sequência nem conquista de ninguém)
function elasticDayHint() {
  const last = (healthDb.workouts || [])
    .filter((workout) => workout.type === "saitama" || (workout.type === "home" && isElasticPlan(workout.home?.plan || "")))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)))[0];
  if (!last) return "📅 Dica do Cloba: alterna um dia 👊 Saitama (empurrar) e um dia 🟣 elástico (puxar).";
  const wasSaitama = last.type === "saitama";
  const other = wasSaitama ? "🟣 elástico" : "👊 Saitama";
  if (last.date === toIsoDate()) return `📅 Hoje já foi ${wasSaitama ? "👊 Saitama" : "🟣 elástico"} ✅ Amanhã é dia de ${other}.`;
  return `📅 Último foi ${wasSaitama ? "👊 Saitama" : "🟣 elástico"}: hoje é dia de ${other}.`;
}

/* 🎨 Meus elásticos: toca do mais leve pro mais forte + kg de cada um.
 * Salva sozinho (a ordem quando tocar as 4; o kg ao mudar o número). */
let elasticSetupTaps = [];
let elasticSetupPlan = "";

function openElasticSetup(planId) {
  elasticSetupTaps = [];
  if (planId) elasticSetupPlan = planId;
  renderElasticSetup();
  openTobaModal("homeHelpModal");
}

function renderElasticSetup() {
  const order = elasticOrder();
  const chips = ELASTIC_BANDS.map((band) => {
    const tapped = elasticSetupTaps.indexOf(band.id);
    const badge = tapped >= 0 ? tapped + 1 : elasticSetupTaps.length ? "" : order.indexOf(band.id) + 1;
    return `<button type="button" class="elastic-chip elastic-order-chip${tapped >= 0 ? " is-tapped" : ""}" style="--band: ${band.color}" data-click="elasticSetupTap" data-band="${band.id}">${band.dot} ${escapeHtml(band.name)}${badge ? ` <b>${badge}º</b>` : ""}</button>`;
  }).join("");
  const kgRows = order.map((id) => {
    const band = getElasticBand(id);
    return `
      <label class="elastic-kg-row" style="--band: ${band.color}">
        <span>${band.dot} ${escapeHtml(band.name)} <small>${elasticLevel(id)}º</small></span>
        <input type="number" class="form-control" inputmode="decimal" min="1" max="150" step="0.5" value="${elasticKg(id)}" data-change="elasticSetupKg" data-band="${id}" aria-label="Kg do elástico ${escapeHtml(band.name)}" />
        <small>kg</small>
      </label>`;
  }).join("");
  document.getElementById("homeHelpTitle").textContent = "🎨 Meus elásticos";
  document.getElementById("homeHelpBody").innerHTML = `
    <p class="toba-sheet-text">Toca nos 4 elásticos na ordem, do <b>mais leve</b> pro <b>mais forte</b>${elasticSetupTaps.length ? ` (${elasticSetupTaps.length}/4)` : ""}.</p>
    <div class="elastic-order">${chips}</div>
    ${elasticSetupTaps.length ? '<button type="button" class="btn btn-secondary btn-sm" data-click="elasticSetupReset">↺ Recomeçar</button>' : `<p class="live-hint">Agora: ${elasticOrderLine()} (leve → forte)</p>`}
    <div class="hub-title">Kg de cada um (escrito no elástico)</div>
    <div class="elastic-kg">${kgRows}</div>
    <p class="live-hint">Já vem com o meio da faixa do teu kit (azul 4,5–16, roxo 14–27, preto 18–36, verde 23–57 kg). Outro elástico? Bota o número do meio da faixa dele. É o que soma no 💪 Kg levantado dos troféus: repetições × kg. Treino já salvo não muda.</p>`;
}

function elasticSetupTap(el) {
  const id = el.dataset.band;
  if (!getElasticBand(id) || elasticSetupTaps.includes(id)) return;
  elasticSetupTaps.push(id);
  if (elasticSetupTaps.length === ELASTIC_BANDS.length) {
    storeLivePrefs({ elasticOrder: elasticSetupTaps.slice() });
    elasticSetupTaps = [];
    tobaToast(`🎨 Ordem salva: ${elasticOrderLine()}`);
    elasticRefreshIntro();
  }
  renderElasticSetup();
}

function elasticSetupReset() {
  elasticSetupTaps = [];
  renderElasticSetup();
}

function elasticSetupKg(el) {
  const kg = Number(String(el.value).replace(",", "."));
  if (!(kg > 0)) return;
  storeLivePrefs({ elasticKg: { ...(readLivePrefs().elasticKg || {}), [el.dataset.band]: Math.round(kg * 2) / 2 } });
  tobaToast(`${getElasticBand(el.dataset.band)?.dot || ""} ${formatWorkoutNumber(kg, 1)} kg salvo`);
  elasticRefreshIntro();
}

// Abertura aberta atrás? Redesenha sem pular pro topo
function elasticRefreshIntro() {
  if (!elasticSetupPlan || !document.getElementById("liveStartModal")?.classList.contains("is-open")) return;
  if (!document.querySelector("#liveStartList .home-intro")) return;
  openHomeIntro(elasticSetupPlan, { keepScroll: true });
}

function elasticCycleIntro(el) {
  const id = el.dataset.ex;
  elasticStorePicks({ [id]: elasticNext(elasticPick(id)) });
  openHomeIntro(el.dataset.plan, { keepScroll: true });
}

/* ---------------------------------------------------------------------
 * 🏠 Seção "Treinos em casa" do ▶ Iniciar treino (Saitama + alongamento
 * + os planos novos). O Saitama e o alongamento continuam nos arquivos
 * deles: aqui só os botões.
 * ------------------------------------------------------------------- */
function homeMenuButton({ click, attrs = "", icon, title, desc }) {
  return `
      <button type="button" class="toba-menu-btn" data-click="${click}"${attrs}>
        <span class="toba-menu-icon">${icon}</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">${escapeHtml(title)}</span>
          <span class="toba-menu-desc">${escapeHtml(desc)}</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>`;
}

function homePlanButton(plan) {
  const count = (healthDb.workouts || []).filter((workout) => workout.type === "home" && workout.home?.plan === plan.id).length;
  const minutes = Math.round(getHomePlanSeconds(plan.id) / 60);
  return homeMenuButton({
    click: "startHomeLive",
    attrs: ` data-plan="${plan.id}"`,
    icon: plan.icon,
    title: plan.name,
    desc: `${plan.desc} ~${minutes} min${count ? ` · feito ${count}×` : ""}`,
  });
}

function renderHomeLiveStartSection() {
  const workouts = healthDb.workouts || [];
  const saitamaCount = workouts.filter((workout) => workout.type === "saitama").length;
  const count = (type) => workouts.filter((workout) => workout.type === type).length;
  const total = count("home") + count("stretch") + saitamaCount;
  const plans = (ids) => HOME_PLANS.filter((plan) => ids.includes(plan.cat || "")).map(homePlanButton).join("");
  const stretch = STRETCH_PLANS.map((plan) => homeMenuButton({
    click: "openStretchIntro", // v1.97: abre a abertura antes
    attrs: ` data-plan="${plan.id}"`,
    icon: plan.icon,
    title: plan.name,
    desc: plan.desc,
  })).join("");
  return `
    <div class="home-section">
      <p class="toba-sheet-text home-section-sub">No tapete da sala, no máximo um elástico${total ? ` · feito ${total}×` : ""}</p>
      <div class="hub-title">🔥 HIIT e cardio</div>
      <div class="toba-menu">${plans(["cardio"])}</div>
      <div class="hub-title">💪 Força e abdômen</div>
      <p class="live-hint home-day-hint">${escapeHtml(elasticDayHint())}</p>
      <div class="toba-menu">
        ${plans(["elastico"])}
        ${homeMenuButton({ click: "openSaitamaIntro", icon: "👊", title: "Treino do Saitama", desc: `Flexão, abdominal e agachamento no contador${saitamaCount ? ` · feito ${saitamaCount}×` : ""}` })}
        ${plans(["forca"])}
      </div>
      <div class="hub-title">🧘 Alongamento${count("stretch") ? ` · feito ${count("stretch")}×` : ""}</div>
      <div class="toba-menu">${stretch}</div>
    </div>`;
}

// Atalho "🏠 Em casa" da tela de Treinos: abre o ▶ Iniciar treino já na
// porta 🏠 (treino em andamento? volta pra ele, igual o ▶).
function openHomeStart() {
  openLiveStart("home");
}

/* ---------------------------------------------------------------------
 * Abertura do treino (v1.96, pedido do Rafa): tocar num plano não começa
 * mais direto. Mostra o resumo, a lista dos exercícios com o bonequinho,
 * o ❔ "Papo do Cloba" e o botão ▶ Iniciar. Mora na mesma folha do
 * ▶ Iniciar treino (#liveStartModal), com ‹ pra voltar pra porta 🏠.
 * ------------------------------------------------------------------- */
const HOME_PLAN_CLOBA = {
  hiit10: "HIIT é tiro curto e forte com descanso curto: o coração sobe, desce e sobe de novo, e o corpo segue queimando depois que acaba. São 10 minutos que parecem 30. Não precisa ser o mais rápido do prédio: é dar o máximo que dá NAQUELES 40 segundos e respirar de verdade nos 20.",
  tabata4: "Tabata é o japonês mais cruel da academia: 20 s no talo, 10 s de folga, 8 vezes. São só 4 minutos, então o combinado é ir com tudo do começo ao fim. Se no 6º tiro tu achar que vai morrer, tá fazendo certo 💀",
  silencioso15: "Cardio sem nenhum pulo: dá pra fazer de madrugada, de meia, com o Gon dormindo do lado. Não é treino fraco não: mantém o ritmo constante que o coração sobe igual, só não acorda o vizinho de baixo.",
  forca20: "Circuito de força só com o peso do corpo: perna, peito, tríceps, glúteo e core. São 45 s em cada, sem pressa: movimento bem feito vale mais que número de repetição. No fim de cada volta tem 1min30 de descanso pra beber água e xingar o Cloba.",
  "el-corpo": "O treino do vídeo do Roman, na mesma ordem: supino deitado, remada sentada, desenvolvimento, rosca, tríceps, agachamento e abdominal, tudo com o elástico. O tríceps dele é preso na porta e o teu elástico não prende, então troquei pelo tríceps acima da cabeça (pisa numa ponta, sem porta). Cada exercício tem a cor dele: toca no chip pra trocar, e o Toba lembra da próxima vez.",
  "el-um": "O vídeo \"What can you do with just one band?\" que tu mandou, na ordem dele: remada curvada, supino deitado, rosca martelo, tríceps acima da cabeça, encolhimento (trapézio, que nenhum outro treino pega), agachamento com desenvolvimento, abdominal e coice de glúteo. Corpo inteiro com UM elástico. São 2 voltas: na 2ª, se tiver sobrando, toca no chip e sobe a cor.",
  "el-costas": "O Saitama é só empurrar (flexão, abdominal, agachamento) e as costas ficam de fora. Aqui é só PUXAR, igual o vídeo que tu mandou: remada sentada, face pull, remada curvada, crucifixo invertido e terra. É isso que segura o ombro no lugar e tira a corcunda da cadeira gamer. No vídeo ele pesa mais a cada série: aqui é só tocar no chip e subir a cor na volta 2 e 3. Puxa com as costas, cotovelo indo pra trás, e volta o elástico DEVAGAR.",
  "el-biceps": "Braço de Popeye 🥬: rosca direta, rosca martelo, rosca inversa e uma remada de um braço pra dar respiro. Cotovelo colado no corpo o tempo todo. Se o ombro começa a ajudar, o elástico tá pesado: desce uma cor sem vergonha.",
  core10: "Tanquinho se faz na cozinha, mas se fortalece aqui. Abdômen, lombar e a cadeirinha na parede pra fechar. Barriga encolhida o tempo todo e solta o ar na hora da força.",
};

function homeFormatSecs(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m}min${s ? String(s).padStart(2, "0") : ""}` : `${s} s`;
}

function homeIntroChips(plan) {
  const minutes = Math.round(getHomePlanSeconds(plan.id) / 60);
  const kcal = estimateHomeKcal(plan.id, minutes, toIsoDate());
  return [
    `⏱️ ~${minutes} min`,
    `🔁 ${plan.rounds} ${plan.rounds === 1 ? "volta" : "voltas"}`,
    `🔥 ${plan.work} s / 😮‍💨 ${plan.rest} s`,
    isElasticPlan(plan) ? "🟣 com elástico" : "",
    kcal ? `⚡ ~${kcal} kcal` : "",
  ].filter(Boolean).map((chip) => `<span class="workout-chip">${chip}</span>`).join("");
}

function openHomeIntro(planId, { keepScroll = false } = {}) {
  const plan = getHomePlan(planId);
  if (!plan) return;
  const sheet = document.querySelector("#liveStartModal .toba-sheet");
  const scroll = keepScroll && sheet ? sheet.scrollTop : 0;
  const { session } = readLiveSession();
  if (session) { // já tem treino rolando: volta pra ele
    liveSession = session;
    closeTobaModal("workoutModal");
    openLiveSessionView();
    return;
  }
  const rows = plan.list.filter((id) => getHomeExercise(id)).map((id, index) => {
    const exercise = getHomeExercise(id);
    const chip = exercise.band ? elasticChip(id, elasticPick(id), "elasticCycleIntro", ` data-plan="${plan.id}"`) : "";
    return `
      <div class="stretch-row home-intro-row${chip ? " has-band" : ""}">
        ${homeFigureSvg(id, { size: "sm" })}
        <span class="stretch-row-text"><strong>${index + 1}. ${escapeHtml(exercise.name)}</strong><small>${plan.work} s${exercise.jump ? " · tem pulo" : ""}${exercise.sides ? " · troca de lado na metade" : ""}</small>${chip}</span>
      </div>`;
  }).join("");
  const elastic = isElasticPlan(plan);
  if (elastic) elasticSetupPlan = plan.id;
  const feel = elastic ? elasticLastFeel(plan.id) : "";
  const feelTip = feel === "leve"
    ? "Da última vez tu disse que tava leve: já subi uma cor em cada exercício 🔥"
    : feel === "pesado"
      ? "Da última vez tava pesadão: desci uma cor. Forma bonita primeiro 👌"
      : "";
  const elasticBox = elastic ? `
      <div class="card elastic-box">
        <div class="elastic-box-row">
          <span><strong>🎨 Meus elásticos</strong><small>${elasticOrderLine()} (leve → forte)</small></span>
          <button type="button" class="btn btn-secondary btn-sm" data-click="openElasticSetup" data-plan="${plan.id}">✏️ Ajustar</button>
        </div>
        <p class="live-hint">Toca na cor de cada exercício pra trocar (leve → forte). O Toba lembra da próxima vez e soma repetições × kg no 💪 Kg levantado.</p>
        ${feelTip ? `<p class="live-hint elastic-feel-tip">🤖 ${escapeHtml(feelTip)}</p>` : ""}
      </div>` : "";
  const title = document.getElementById("liveStartTitle");
  if (title) title.textContent = `${plan.icon} ${plan.name}`;
  document.getElementById("liveStartList").innerHTML = `
    <button type="button" class="back-nav-btn" data-click="openLiveStartPage" data-page="home">‹ Treinos em casa</button>
    <div class="home-intro">
      <div class="home-intro-top">
        <p class="toba-sheet-text">${escapeHtml(plan.desc)}</p>
        <button type="button" class="toba-icon-btn home-help-btn" data-click="openHomeHelp" data-plan="${plan.id}" aria-label="Papo do Cloba: como é esse treino">❔</button>
      </div>
      <div class="workout-record-chips">${homeIntroChips(plan)}</div>
      ${elasticBox}
      <div class="hub-title">Os exercícios (cada volta)</div>
      <div class="card stretch-list">${rows}</div>
      <p class="live-hint">Toca no ❔ que o Cloba explica o treino e cada exercício. Quando tiver pronto no tapete, ▶ Iniciar: tem 10 s de "Prepara" antes do 1º tiro.</p>
    </div>
    <div class="toba-sheet-footer">
      <button type="button" class="btn btn-primary home-go" data-click="startHomeNow" data-plan="${plan.id}">▶ Iniciar ${escapeHtml(plan.short)}</button>
    </div>`;
  closeTobaModal("workoutModal");
  openTobaModal("liveStartModal");
  document.querySelector("#liveStartModal .toba-sheet")?.scrollTo?.(0, scroll);
}

// ❔ Papo do Cloba: o porquê do treino, como funciona o timer e cada exercício
function openHomeHelp(planId) {
  const plan = getHomePlan(planId);
  if (!plan) return;
  const list = plan.list.filter((id) => getHomeExercise(id)).map((id) => {
    const exercise = getHomeExercise(id);
    return `
      <div class="home-help-ex">
        ${homeFigureSvg(id, { size: "sm" })}
        <div>
          <strong>${escapeHtml(exercise.name)}</strong>
          <p>${escapeHtml(exercise.how)}</p>
          ${exercise.tip ? `<p class="home-help-tip">💡 ${escapeHtml(exercise.tip)}</p>` : ""}
        </div>
      </div>`;
  }).join("");
  const rounds = plan.rounds > 1
    ? `Faz a lista inteira ${plan.rounds} vezes (${plan.rounds} voltas), com ${homeFormatSecs(plan.roundRest)} de descanso entre uma volta e outra.`
    : "É uma volta só.";
  elasticSetupTaps = [];
  document.getElementById("homeHelpTitle").textContent = `❔ ${plan.name}`;
  document.getElementById("homeHelpBody").innerHTML = `
    <div class="home-help-cloba">
      <span class="home-help-avatar" aria-hidden="true">🤖</span>
      <div><strong>Papo do Cloba</strong><p>${escapeHtml(HOME_PLAN_CLOBA[plan.id] || plan.desc)}</p></div>
    </div>
    <div class="hub-title">Como funciona</div>
    <ul class="home-help-how">
      <li>⏳ 10 s de <b>Prepara</b> antes do 1º exercício.</li>
      <li>🔥 <b>Vai!</b> ${plan.work} s fazendo o exercício no teu ritmo (o bonequinho mostra o movimento).</li>
      <li>😮‍💨 <b>Descansa</b> ${plan.rest} s e a tela já mostra o próximo.</li>
      <li>🔁 ${escapeHtml(rounds)}</li>
      <li>🔊 A voz avisa cada troca e conta o 3-2-1: dá pra deixar o celular no chão.</li>
      <li>⏸ Pausa, pula ou volta quando quiser. 🏁 Terminar agora salva o que já fez.</li>
    </ul>
    ${isElasticPlan(plan) ? `
    <div class="hub-title">🟣 Escolhendo o elástico</div>
    <ul class="home-help-how">
      <li>🎯 Cor certa = faz o tempo todo com a forma bonita e as últimas 3 ou 4 repetições ficam difíceis.</li>
      <li>🐢 Ritmo: 2 s puxando, 1 s segurando lá no fim, 2 a 3 s voltando. Voltar devagar é metade do treino.</li>
      <li>⬆️ Ficou fácil? Sobe uma cor. Ombro ou lombar ajudando? Desce uma.</li>
      <li>😮‍💨 No descanso a voz já fala a cor do próximo: dá tempo de trocar o elástico.</li>
      <li>💪 Conta no Kg levantado dos troféus: repetições (pelo tempo) × kg do elástico.</li>
      <li>⚠️ Confere se o elástico não tem rasgo e nunca solta ele esticado (chicotada no Killua não 🐈).</li>
    </ul>` : ""}
    <div class="hub-title">Os exercícios</div>
    ${list}
    <p class="live-hint">Dói articulação (joelho, ombro, lombar)? Para e pula o exercício. Mandíbula solta, sem trincar o dente 🦷</p>`;
  openTobaModal("homeHelpModal");
}

/* ---------------------------------------------------------------------
 * Abertura também no 🧘 Alongamento e no 👊 Saitama (v1.97, pedido do Rafa:
 * "muito foda, quero em todos"). Mesmas peças: resumo, lista com o
 * bonequinho, ❔ Papo do Cloba (#homeHelpModal) e ▶ Iniciar embaixo.
 * O início de verdade continua nos arquivos deles (startStretchLive /
 * startSaitamaLive); aqui só a tela de antes.
 * ------------------------------------------------------------------- */
function introResumeLive() {
  const { session } = readLiveSession();
  if (!session) return false;
  liveSession = session; // já tem treino rolando: volta pra ele
  closeTobaModal("workoutModal");
  openLiveSessionView();
  return true;
}

function introChips(list) {
  return list.filter(Boolean).map((chip) => `<span class="workout-chip">${chip}</span>`).join("");
}

function introRow(figure, title, sub) {
  return `
      <div class="stretch-row home-intro-row">
        ${figure}
        <span class="stretch-row-text"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span>
      </div>`;
}

function renderTrainingIntro({ title, desc, chips, listTitle, rows, helpClick, helpAttrs = "", startClick, startAttrs = "", startLabel, hint }) {
  const head = document.getElementById("liveStartTitle");
  if (head) head.textContent = title;
  document.getElementById("liveStartList").innerHTML = `
    <button type="button" class="back-nav-btn" data-click="openLiveStartPage" data-page="home">‹ Treinos em casa</button>
    <div class="home-intro">
      <div class="home-intro-top">
        <p class="toba-sheet-text">${escapeHtml(desc)}</p>
        <button type="button" class="toba-icon-btn home-help-btn" data-click="${helpClick}"${helpAttrs} aria-label="Papo do Cloba: como é esse treino">❔</button>
      </div>
      <div class="workout-record-chips">${introChips(chips)}</div>
      <div class="hub-title">${escapeHtml(listTitle)}</div>
      <div class="card stretch-list">${rows}</div>
      <p class="live-hint">${escapeHtml(hint)}</p>
    </div>
    <div class="toba-sheet-footer">
      <button type="button" class="btn btn-primary home-go" data-click="${startClick}"${startAttrs}>▶ ${escapeHtml(startLabel)}</button>
    </div>`;
  closeTobaModal("workoutModal");
  openTobaModal("liveStartModal");
  document.querySelector("#liveStartModal .toba-sheet")?.scrollTo?.(0, 0);
}

function renderTrainingHelp({ title, cloba, how, exercises, note }) {
  document.getElementById("homeHelpTitle").textContent = `❔ ${title}`;
  document.getElementById("homeHelpBody").innerHTML = `
    <div class="home-help-cloba">
      <span class="home-help-avatar" aria-hidden="true">🤖</span>
      <div><strong>Papo do Cloba</strong><p>${escapeHtml(cloba)}</p></div>
    </div>
    <div class="hub-title">Como funciona</div>
    <ul class="home-help-how">${how.map((line) => `<li>${line}</li>`).join("")}</ul>
    <div class="hub-title">${exercises.title}</div>
    ${exercises.items.map((item) => `
      <div class="home-help-ex">
        ${item.figure}
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.how || "")}</p>
          ${item.tip ? `<p class="home-help-tip">💡 ${escapeHtml(item.tip)}</p>` : ""}
        </div>
      </div>`).join("")}
    <p class="live-hint">${escapeHtml(note)}</p>`;
  openTobaModal("homeHelpModal");
}

/* ---------- 🧘 Alongamento ---------- */
const STRETCH_PLAN_CLOBA = {
  s10: "Rapidinho de 10 minutos pra desenferrujar: pescoço, ombro, peito, costas e perna. Bom pra depois de um dia inteiro na cadeira gamer ou de manhã antes do café na V60. Alongar é segurar parado sentindo puxar, não é competição de quem encosta a mão no pé.",
  s20: "O completão de 20 minutos: aquece o ombro, solta o pescoço, abre o peito, cuida das costas e termina no quadril e na perna, que é onde quem passa o dia sentado mais trava. Faz sem pressa, respirando fundo, que o corpo agradece no dia seguinte.",
};

// Posições do plano na ordem, uma linha por exercício (lado R e L viram "cada lado")
function stretchIntroItems(plan) {
  return plan.steps.map(([id, secs]) => {
    const exercise = getStretchExercise(id);
    if (!exercise) return null;
    const time = id === "relax" ? "até fechar o tempo" : `${secs} s${exercise.sides ? " cada lado" : ""}`;
    return { id, exercise, time };
  }).filter(Boolean);
}

function openStretchIntro(planId) {
  const plan = getStretchPlan(planId);
  if (!plan || introResumeLive()) return;
  const items = stretchIntroItems(plan);
  const holds = items.filter((item) => item.id !== "relax").length;
  renderTrainingIntro({
    title: `${plan.icon} ${plan.name}`,
    desc: plan.desc,
    chips: [`⏱️ ${plan.minutes} min`, `🧘 ${holds} posições`, items.some((item) => item.exercise.sides) ? "👉👈 troca de lado sozinho" : "", `⚡ ~${estimateStretchKcal(plan.minutes, toIsoDate())} kcal`],
    listTitle: "As posições",
    rows: items.map((item, index) => introRow(stretchFigureSvg(item.id, { size: "sm" }), `${index + 1}. ${item.exercise.name}`, item.time)).join(""),
    helpClick: "openStretchHelp",
    helpAttrs: ` data-plan="${plan.id}"`,
    startClick: "startStretchLive",
    startAttrs: ` data-plan="${plan.id}"`,
    startLabel: `Iniciar ${plan.name}`,
    hint: "Toca no ❔ que o Cloba explica cada posição. Deixa o celular no chão, de frente pra ti: tem 5 s de Prepara antes de cada uma.",
  });
}

function openStretchHelp(planId) {
  const plan = getStretchPlan(planId);
  if (!plan) return;
  renderTrainingHelp({
    title: plan.name,
    cloba: STRETCH_PLAN_CLOBA[plan.id] || plan.desc,
    how: [
      "⏳ 5 s de <b>Prepara</b> antes de cada posição (a voz fala qual é a próxima).",
      "🧘 <b>Segura</b> parado até o timer zerar. A parte verde do bonequinho é o que tem que puxar.",
      "👉👈 Posição de um lado só? Faz o direito, a voz avisa \"troca de lado\" e o bonequinho espelha.",
      "🌬️ Termina com Respira e relaxa até fechar o tempo do plano.",
      "⏸ Pausa, pula ou volta quando quiser. 🏁 Terminar agora salva o que já segurou.",
    ],
    exercises: {
      title: "As posições",
      items: stretchIntroItems(plan).map((item) => ({ figure: stretchFigureSvg(item.id, { size: "sm" }), name: item.exercise.name, how: item.exercise.how, tip: item.exercise.tip })),
    },
    note: "Puxou gostoso, fica. Doeu de verdade, afrouxa: alongamento não é tortura. Sem quicar e com a mandíbula solta 🦷",
  });
}

/* ---------- 👊 Saitama ---------- */
const SAITAMA_INTRO_FIGS = { pushups: "flexao", situps: "abdominal", squats: "agachamento" };

function openSaitamaIntro() {
  if (introResumeLive()) return;
  const done = (healthDb.workouts || []).filter((workout) => workout.type === "saitama").length;
  const rows = SAITAMA_LIVE_FIELDS.map((item) => introRow(homeFigureSvg(SAITAMA_INTRO_FIGS[item.field], { size: "sm" }), `${item.icon} ${item.name}`, `meta: ${SAITAMA_LIVE_GOAL} por dia`)).join("")
    + introRow('<span class="home-intro-emoji" aria-hidden="true">🚶</span>', "🚶 10 km de corrida", "treino à parte, na porta 🚶");
  renderTrainingIntro({
    title: "👊 Treino do Saitama",
    desc: "Contador de bolso: flexão, abdominal e agachamento no teu ritmo, sem ordem fixa.",
    chips: [`🎯 ${SAITAMA_LIVE_GOAL} de cada`, "🔢 +1 · +5 · +10 · +20", `⏱️ descanso de ${SAITAMA_LIVE_REST} s`, done ? `👊 feito ${done}×` : ""],
    listTitle: "O treino do careca",
    rows,
    helpClick: "openSaitamaHelp",
    startClick: "startSaitamaLive",
    startLabel: "Iniciar treino do Saitama",
    hint: "Toca no ❔ que o Cloba explica o contador. Não precisa fechar os 100 hoje: o que der, vale XP e sequência.",
  });
}

function openSaitamaHelp() {
  renderTrainingHelp({
    title: "Treino do Saitama",
    cloba: "O treino que deixou o careca mais forte do universo: 100 flexões, 100 abdominais, 100 agachamentos e 10 km de corrida, todo santo dia. Aqui é contador de bolso: faz no teu ritmo, em quantas levas quiser, e vai tocando no quadrado pra somar. Ficar careca é opcional 🦲",
    how: [
      "🔢 Escolhe o passo lá em cima (+1, +5, +10 ou +20).",
      "👆 Fez uma leva? Toca no quadrado do exercício e soma o passo. Errou? ↩ desfaz o último.",
      `⏱️ Com o <b>Descanso automático</b> ligado, cada toque já solta o timer de ${SAITAMA_LIVE_REST} s (dá pra mudar o tempo).`,
      "🎯 A barrinha mostra quanto falta pros 100 de cada. Fechou os 3 no mesmo dia = troféu Dia do careca.",
      "🚶 Os 10 km são um treino de Caminhada / Corrida à parte: no mesmo dia vale o Careca completo.",
      "🏁 Finalizar salva o que fez, mesmo que não tenha chegado nos 100.",
    ],
    exercises: {
      title: "Os exercícios",
      items: SAITAMA_LIVE_FIELDS.map((item) => {
        const exercise = getHomeExercise(SAITAMA_INTRO_FIGS[item.field]);
        return { figure: homeFigureSvg(SAITAMA_INTRO_FIGS[item.field], { size: "sm" }), name: `${item.icon} ${item.name}`, how: exercise?.how, tip: exercise?.tip };
      }),
    },
    note: "Começou a doer articulação, para. Barra de proteína não conta como agachamento. Mandíbula solta, sem trincar o dente 🦷",
  });
}

/* ---------------------------------------------------------------------
 * Começar
 * ------------------------------------------------------------------- */
// v2.06: cor de cada exercício com elástico (a última usada)
function homeStartBands(plan) {
  const bands = {};
  plan.list.forEach((id) => {
    if (getHomeExercise(id)?.band) bands[id] = elasticPick(id);
  });
  return bands;
}

function startHomeLive(planId) {
  const plan = getHomePlan(planId) || HOME_PLANS[0];
  const steps = buildHomeSteps(plan.id);
  if (!steps.length) return;
  const now = Date.now();
  liveSession = {
    v: 1,
    id: `s-${now}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "home",
    startedAt: now,
    date: toIsoDate(),
    routineId: "",
    title: plan.name,
    current: 0,
    exercises: [],
    home: normalizeHomeLive({ plan: plan.id, step: 0, endsAt: now + steps[0].secs * 1000, bands: homeStartBands(plan) }),
    rest: { duration: LIVE_REST_DEFAULT, startedAt: null, endsAt: null, alerted: false },
    restDefault: LIVE_REST_DEFAULT,
    updatedAt: now,
  };
  homeCountdownKey = "";
  storeLiveSession();
  closeTobaModal("liveStartModal");
  closeTobaModal("workoutModal");
  openLiveSessionView();
  homeAnnounce(steps[0], steps);
}

/* ---------------------------------------------------------------------
 * Tique: avança os passos que já passaram (mesmo com a aba congelada)
 * ------------------------------------------------------------------- */
function homeCredit(data, step, secs) {
  if (!step || step.kind !== "work" || !(secs > 0)) return;
  data.done[step.exerciseId] = Math.round((data.done[step.exerciseId] || 0) + secs);
}

function homeTick(now = Date.now()) {
  const data = liveSession?.home;
  if (!data || data.finished || !data.endsAt) {
    updateHomeClock(now);
    return;
  }
  const steps = homeSteps();
  let moved = false;
  while (data.endsAt && now >= data.endsAt && !data.finished) {
    const step = steps[data.step];
    homeCredit(data, step, step.secs);
    if (data.step >= steps.length - 1) {
      data.finished = true;
      data.finishedAt = data.endsAt;
      data.endsAt = null;
    } else {
      data.step += 1;
      data.endsAt += steps[data.step].secs * 1000;
    }
    moved = true;
  }
  if (moved) {
    storeLiveSession();
    if (data.finished) {
      liveBuzz([200, 100, 200, 100, 400]);
      homeSpeak("Acabou! Treino completo. Salva aí no Toba.");
    } else if (now - (data.endsAt - steps[data.step].secs * 1000) < 2500) {
      homeAnnounce(steps[data.step], steps); // só avisa o passo de agora, não os que passaram no bolso
    }
    renderLiveSession();
    return;
  }
  updateHomeClock(now);
}

// Só textos e anel (roda a cada 250 ms)
function updateHomeClock(now = Date.now()) {
  const session = liveSession;
  const data = session?.home;
  if (!data) return;
  const clock = document.getElementById("liveClock");
  if (clock) clock.textContent = formatLiveClock(homeMovingMs(session, now));
  if (data.finished) return;
  const step = homeSteps(session)[data.step];
  const leftMs = data.endsAt ? Math.max(0, data.endsAt - now) : data.left;
  const time = document.getElementById("homeTime");
  if (time) time.textContent = String(Math.ceil(leftMs / 1000));
  const ring = document.getElementById("homeRing");
  if (ring && step) {
    const fraction = Math.min(1, Math.max(0, leftMs / (step.secs * 1000)));
    ring.style.strokeDashoffset = (LIVE_RING * (1 - fraction)).toFixed(1);
  }
  const remaining = document.getElementById("homeRemaining");
  if (remaining) remaining.textContent = `faltam ${formatLiveClock(homeRemainingSeconds(session, now) * 1000)}`;
  homeCountdown(session, step, leftMs);
  homeHalfway(session, step, leftMs);
}

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
function renderHomeLive(session) {
  const data = session.home;
  const plan = getHomePlan(data.plan);
  const steps = homeSteps(session);
  const works = steps.filter((step) => step.kind === "work");
  const doneWorks = steps.slice(0, data.step).filter((step) => step.kind === "work").length;
  const percent = data.finished ? 100 : Math.round((doneWorks / Math.max(1, works.length)) * 100);
  const top = `
    <div class="live-top">
      <div class="live-top-text">
        <span class="live-badge">● AO VIVO</span>
        <strong class="live-title">${plan?.icon || "🏠"} ${escapeHtml(session.title)}</strong>
      </div>
      <div class="live-clock" id="liveClock" role="timer" aria-label="Tempo de treino">${formatLiveClock(homeMovingMs(session))}</div>
    </div>
    <div class="live-progress">
      <div class="live-progress-bar"><span style="width: ${percent}%"></span></div>
      <span class="live-progress-text">${data.finished ? works.length : Math.min(doneWorks + 1, works.length)}/${works.length} tiros · <span id="homeRemaining">faltam ${formatLiveClock(homeRemainingSeconds(session) * 1000)}</span></span>
    </div>`;

  if (data.finished) return top + renderHomeDone(session);

  const step = steps[data.step];
  const exercise = getHomeExercise(step.exerciseId);
  const paused = !data.endsAt;
  const phase = step.kind === "work" ? "is-work" : step.kind === "rest" ? "is-rest" : "is-prep";
  const phaseText = paused ? "⏸ Pausado" : step.kind === "work" ? "🔥 Vai!" : step.kind === "rest" ? "😮‍💨 Descansa" : "Prepara...";
  const roundText = plan && plan.rounds > 1 ? `<span class="stretch-side">Volta ${step.round}/${plan.rounds}</span>` : "";
  const nextWork = steps.slice(data.step + 1).find((item) => item.kind === "work" && step.kind === "work");
  const nextExercise = nextWork ? getHomeExercise(nextWork.exerciseId) : null;
  const quip = HOME_QUIPS[(data.step + session.startedAt) % HOME_QUIPS.length];

  return `${top}
    <div class="stretch-stage home-stage ${phase}${paused ? " is-paused" : ""}">
      <div class="stretch-phase">${phaseText} ${roundText}</div>
      ${homeFigureSvg(step.exerciseId, { size: "lg", band: data.bands[step.exerciseId] })}
      <div class="stretch-name">${step.kind === "work" ? "" : "<small>Próximo</small> "}${escapeHtml(exercise?.name || "")}</div>
      ${exercise?.band ? `<div class="elastic-live">${elasticChip(step.exerciseId, data.bands[step.exerciseId] || elasticPick(step.exerciseId), "homeCycleBand")}<small>toca pra trocar a cor</small></div>` : ""}
      <div class="stretch-timer">
        <div class="stretch-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="live-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="live-ring-fg stretch-ring-fg" id="homeRing" cx="60" cy="60" r="52" stroke-dasharray="${LIVE_RING.toFixed(1)}"></circle>
          </svg>
          <strong class="stretch-time" id="homeTime" role="timer">${Math.ceil((data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left) / 1000)}</strong>
        </div>
        <p class="stretch-how">${escapeHtml(exercise?.how || "")}</p>
      </div>
      ${exercise?.tip ? `<p class="stretch-tip">💡 ${escapeHtml(exercise.tip)}</p>` : ""}
    </div>

    <div class="stretch-controls">
      <button type="button" class="btn btn-secondary" data-click="homeBack" aria-label="Voltar um exercício">‹ Voltar</button>
      <button type="button" class="btn ${paused ? "btn-primary" : "btn-secondary"}" data-click="homeTogglePause">${paused ? "▶ Continuar" : "⏸ Pausar"}</button>
      <button type="button" class="btn btn-secondary" data-click="homeSkip" aria-label="Pular">Pular ⏭</button>
    </div>

    ${nextExercise ? `
      <div class="stretch-next">
        ${homeFigureSvg(nextWork.exerciseId, { size: "sm", band: data.bands[nextWork.exerciseId] })}
        <span><small>Depois</small><strong>${escapeHtml(nextExercise.name)}</strong>${nextExercise.band ? `<small>${escapeHtml(elasticBandLabel(data.bands[nextWork.exerciseId] || elasticPick(nextWork.exerciseId)))}</small>` : ""}</span>
      </div>` : ""}

    <p class="live-hint stretch-quip">${escapeHtml(quip)}</p>

    <div class="live-footer">
      <label class="live-check">
        <input type="checkbox" data-change="homeToggleVoice"${readHomePrefs().voice ? " checked" : ""} />
        <span>🔊 Voz avisando a troca e o 3-2-1 (dá pra fazer sem olhar a tela)</span>
      </label>
      ${renderLiveVoiceExtra("homeTestVoice")}
      ${renderLiveAwakeToggle()}
      <button type="button" class="btn btn-primary live-finish" data-click="homeFinishNow">🏁 Terminar agora</button>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Cancelar treino</button>
    </div>`;
}

// Fim: resumo + salvar ali mesmo (sem folha por cima)
function renderHomeDone(session) {
  const data = session.home;
  const workSecs = homeWorkSeconds(data);
  const minutes = Math.max(1, Math.round(homeMovingMs(session) / 60000));
  const kcal = estimateHomeKcal(data.plan, minutes, session.date);
  const done = Object.keys(data.done);
  const figures = done.slice(0, 18).map((id) => `<span class="stretch-done-fig" title="${escapeHtml(getHomeExercise(id)?.name || id)}">${homeFigureSvg(id, { size: "sm", band: data.bands[id] })}</span>`).join("");
  const elastic = isElasticPlan(data.plan);
  const lift = elastic ? calcElasticLift({ date: session.date, home: { plan: data.plan, done: data.done, kg: homeBandKg(data) } }, healthDb) : null;
  const feelChip = (id, label) => `<button type="button" class="elastic-feel${data.feel === id ? " is-on" : ""}" data-click="homePickFeel" data-feel="${id}">${label}</button>`;
  const elasticBlock = elastic ? `
      <div class="card elastic-done">
        <strong>💪 ~${formatWorkoutNumber(lift.kg, 0)} kg levantados</strong>
        <small>${formatWorkoutNumber(lift.reps, 0)} repetições (pelo tempo) × kg de cada elástico (+ o peso do corpo no agachamento, terra, abdominal e coice). Vai pros troféus do Kg levantado 🌕</small>
        <div class="hub-title">Como tava o peso?</div>
        <div class="elastic-feels">
          ${feelChip("leve", "😴 Leve demais")}${feelChip("certo", "👌 No ponto")}${feelChip("pesado", "💀 Pesadão")}
        </div>
        <p class="live-hint">Leve demais = próxima vez já começa uma cor acima. Pesadão = uma abaixo.</p>
      </div>` : "";
  return `
    <div class="stretch-done home-done">
      <div class="stretch-done-title">🏆 Academia na sala: aprovada!</div>
      <p class="toba-sheet-text">${done.length} ${done.length === 1 ? "exercício" : "exercícios"} · ${formatLiveClock(workSecs * 1000)} no pau · ${minutes} min no total. Vale XP, sequência, troféu e pinta o mapa de calor 🔥</p>
      ${figures ? `<div class="stretch-done-figs">${figures}</div>` : ""}
      ${elasticBlock}
      <form data-submit="saveHomeLive">
        <div class="grid-2">
          <div class="form-group">
            <label for="home-calories">Calorias (kcal)</label>
            <input id="home-calories" class="form-control" type="number" inputmode="numeric" min="0" step="1" value="${kcal || ""}" />
          </div>
          <div class="form-group">
            <label for="home-minutes">Tempo (min)</label>
            <input id="home-minutes" class="form-control" type="number" inputmode="numeric" min="1" step="1" value="${minutes}" />
          </div>
        </div>
        <div class="form-group">
          <label for="home-notes">Observações (opcional)</label>
          <input id="home-notes" class="form-control" type="text" maxlength="160" placeholder="Morreu ou sobreviveu?" />
        </div>
        ${renderLiveWatchCheck("home-watch-pending")}
        <button type="submit" class="btn btn-primary live-finish">Salvar treino 🏠</button>
      </form>
      <p class="live-hint">Dica do Cloba: emenda um 🧘 alongamento de 10 min depois (▶ Iniciar treino › 🏠 › Alongamento).</p>
      <button type="button" class="btn btn-secondary" data-click="discardLiveSession">Jogar fora</button>
    </div>`;
}

function estimateHomeKcal(planId, minutes, date) {
  const plan = getHomePlan(planId);
  const met = plan?.met || 6;
  const kg = typeof getBodyWeightOn === "function" ? getBodyWeightOn(date) : 75;
  return Math.round(met * (Number(kg) || 75) * (minutes / 60));
}

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
function homeLeftMs(data) {
  return data.endsAt ? Math.max(0, data.endsAt - Date.now()) : data.left;
}

function homeTogglePause() {
  const data = liveSession?.home;
  if (!data || data.finished) return;
  const now = Date.now();
  if (data.endsAt) {
    data.left = Math.max(0, data.endsAt - now);
    data.endsAt = null;
    data.pausedAt = now;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } else {
    data.endsAt = now + data.left;
    if (data.pausedAt) data.pausedMs += now - data.pausedAt;
    data.pausedAt = null;
  }
  storeLiveSession();
  renderLiveSession();
}

// Vai pro passo `index` mantendo pausado/rodando
function homeGoTo(index) {
  const data = liveSession.home;
  const steps = homeSteps();
  data.step = Math.min(Math.max(0, index), steps.length - 1);
  const ms = steps[data.step].secs * 1000;
  if (data.endsAt) data.endsAt = Date.now() + ms;
  else data.left = ms;
  homeCountdownKey = "";
  storeLiveSession();
  renderLiveSession();
  if (data.endsAt) homeAnnounce(steps[data.step], steps);
}

// Pular: o que já fez do tiro vale; vai pro próximo passo
function homeSkip() {
  const data = liveSession?.home;
  if (!data || data.finished) return;
  const steps = homeSteps();
  const step = steps[data.step];
  homeCredit(data, step, Math.floor((step.secs * 1000 - homeLeftMs(data)) / 1000));
  if (data.step >= steps.length - 1) {
    homeFinishNow();
    return;
  }
  homeGoTo(data.step + 1);
}

// Voltar: no tiro há mais de 3 s recomeça ele; senão volta pro tiro anterior
function homeBack() {
  const data = liveSession?.home;
  if (!data || data.finished) return;
  const steps = homeSteps();
  const step = steps[data.step];
  const into = step.secs * 1000 - homeLeftMs(data);
  if (step.kind === "work" && into > 3000) {
    homeGoTo(data.step);
    return;
  }
  let target = -1;
  for (let i = data.step - 1; i >= 0; i -= 1) {
    if (steps[i].kind === "work") {
      target = i;
      break;
    }
  }
  homeGoTo(target >= 0 ? target : 0);
}

function homeFinishNow() {
  const data = liveSession?.home;
  if (!data) return;
  if (!data.finished) {
    const steps = homeSteps();
    const step = steps[data.step];
    if (step) homeCredit(data, step, Math.floor((step.secs * 1000 - homeLeftMs(data)) / 1000));
    if (data.pausedAt) data.pausedMs += Date.now() - data.pausedAt;
    data.pausedAt = null;
    data.finished = true;
    data.finishedAt = Date.now();
    data.endsAt = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  storeLiveSession();
  renderLiveSession();
  window.scrollTo(0, 0);
}

// v2.06: kg / nível de cada exercício com elástico (o que vale hoje)
function homeBandKg(data) {
  const kg = {};
  Object.entries(data.bands || {}).forEach(([id, band]) => {
    kg[id] = elasticKg(band);
  });
  return kg;
}

function homeCycleBand(el) {
  const data = liveSession?.home;
  const id = el.dataset.ex;
  if (!data || !getHomeExercise(id)?.band) return;
  data.bands[id] = elasticNext(data.bands[id] || elasticPick(id));
  elasticStorePicks({ [id]: data.bands[id] });
  storeLiveSession();
  renderLiveSession();
}

// Troca a marcação no lugar (não redesenha: não apaga o que já digitou)
function homePickFeel(el) {
  const data = liveSession?.home;
  if (!data) return;
  data.feel = data.feel === el.dataset.feel ? "" : el.dataset.feel;
  storeLiveSession();
  el.parentElement?.querySelectorAll(".elastic-feel").forEach((chip) => chip.classList.toggle("is-on", chip.dataset.feel === data.feel));
}

function homeToggleVoice(el) {
  storeLivePrefs({ homeVoice: el.checked });
  tobaToast(el.checked ? "🔊 O Toba avisa cada troca" : "🔇 Só vibração");
}

// v2.04: 🔊 Testar a voz (fala mesmo com a chavinha desligada)
function homeTestVoice() {
  storeLivePrefs({ homeVoice: true });
  homeSpeak("Teste de voz do Cloba. Nunca foi sorte.");
  renderLiveSession();
}

function saveHomeLive() {
  if (!liveSession?.home) return;
  if (!isHealthDbLoaded) {
    showHealthDbLockedMessage();
    return;
  }
  const data = liveSession.home;
  if (!homeWorkSeconds(data)) {
    showPageMessage("Nenhum tiro feito ainda. Se quiser jogar fora, use Jogar fora.", { title: "Nada pra salvar" });
    return;
  }
  const plan = getHomePlan(data.plan);
  const minutes = Number(document.getElementById("home-minutes").value);
  const calories = Number(document.getElementById("home-calories").value);
  const workout = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "home",
    title: plan ? plan.name : HOME_TYPE_TITLE,
    date: liveSession.date,
    durationMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : Math.max(1, Math.round(homeMovingMs(liveSession) / 60000)),
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    distanceKm: null,
    pushups: null,
    situps: null,
    squats: null,
    sets: null,
    reps: null,
    weightKg: null,
    notes: document.getElementById("home-notes").value.trim(),
    home: { plan: data.plan, done: { ...data.done } },
  };
  // v2.06: 🟣 elástico: cor, nível e kg de cada exercício + como tava
  const bandIds = Object.keys(data.bands || {}).filter((id) => data.done[id] > 0);
  if (isElasticPlan(data.plan) && bandIds.length) {
    workout.home.bands = {};
    workout.home.levels = {};
    workout.home.kg = {};
    bandIds.forEach((id) => {
      workout.home.bands[id] = data.bands[id];
      workout.home.levels[id] = elasticLevel(data.bands[id]);
      workout.home.kg[id] = elasticKg(data.bands[id]);
    });
    if (data.feel) workout.home.feel = data.feel;
  }
  // v2.04: horário + ⌚ mesclar com o relógio
  const startTime = liveStartClock(liveSession.startedAt);
  if (startTime) workout.startTime = startTime;
  liveApplyWatchPending(workout, "home-watch-pending");
  healthDb.workouts.push(workout);
  saveHealthDb();
  let saved = false;
  try {
    saved = (localStorage.getItem(HEALTH_KEY) || "").includes(`"${workout.id}"`);
  } catch (err) {
    saved = false;
  }
  if (!saved) {
    healthDb.workouts = healthDb.workouts.filter((item) => item.id !== workout.id);
    return;
  }
  // Leve demais / pesadão: a próxima já começa uma cor acima / abaixo
  if (workout.home.feel === "leve" || workout.home.feel === "pesado") {
    const step = workout.home.feel === "leve" ? 1 : -1;
    const picks = {};
    bandIds.forEach((id) => {
      picks[id] = elasticAtLevel(elasticLevel(data.bands[id]) + step);
    });
    elasticStorePicks(picks);
  }
  dropLiveSession();
  stopLiveTicker();
  tobaPlayerCheck({ reason: "Treino em casa no histórico 🏠" });
  openModule("viewTraining");
  openWorkoutView(workout.id);
  tobaToast("🏠 Treino em casa no histórico!");
}

/* ---------------------------------------------------------------------
 * Página do treino: os exercícios feitos, com o bonequinho
 * ------------------------------------------------------------------- */
function renderHomeWorkoutDetail(workout) {
  if (workout.type !== "home") return "";
  const done = getHomeDone(workout);
  const items = Object.entries(done)
    .filter(([id, secs]) => Number(secs) > 0 && getHomeExercise(id))
    .map(([id, secs]) => {
      const band = getElasticBand(workout.home?.bands?.[id]);
      const kg = Number(workout.home?.kg?.[id]) || 0;
      const bandText = band ? ` · ${band.dot} ${escapeHtml(band.name)}${kg ? ` ${formatWorkoutNumber(kg, 1)} kg` : ""}` : "";
      return `
      <div class="stretch-row">
        ${homeFigureSvg(id, { size: "sm", band: band?.id || "" })}
        <span class="stretch-row-text"><strong>${escapeHtml(getHomeExercise(id).name)}</strong><small>${formatLiveSeconds(secs)} no pau${bandText}</small></span>
      </div>`;
    }).join("");
  if (!items) return "";
  const live = workout.home && workout.home.done ? "" : '<p class="live-hint">Anotado na mão: mostra o plano inteiro.</p>';
  const lift = isElasticPlan(workout.home?.plan || "") ? calcElasticLift(workout, healthDb) : null;
  const feels = { leve: "😴 Leve demais", certo: "👌 No ponto", pesado: "💀 Pesadão" };
  const liftLine = lift && lift.kg > 0
    ? `<p class="live-hint">💪 ~${formatWorkoutNumber(lift.kg, 0)} kg levantados (${formatWorkoutNumber(lift.reps, 0)} repetições pelo tempo)${feels[workout.home.feel] ? ` · ${feels[workout.home.feel]}` : ""}</p>`
    : "";
  return `<div class="section-title">🏠 Exercícios</div><div class="card stretch-list">${items}${live}${liftLine}</div>`;
}

/* ---------------------------------------------------------------------
 * Formulário "anotar treino em casa" (+ Treino › 🏠 Treino em casa)
 * ------------------------------------------------------------------- */
function renderHomeFormFields() {
  return `
    <div class="hub-title">Fazer agora, com timer e bonequinho</div>
    <div class="stretch-form-start home-form-start">
      ${HOME_PLANS.map((plan) => `<button type="button" class="btn btn-primary" data-click="startHomeLive" data-plan="${plan.id}">${plan.icon} ${escapeHtml(plan.short)}</button>`).join("")}
    </div>
    <div class="walk-or">ou anota um que já fez 👇</div>
    <div class="form-group">
      <label for="workout-home-plan">Qual</label>
      <select id="workout-home-plan" class="form-control">
        ${HOME_PLANS.map((plan) => `<option value="${plan.id}">${plan.icon} ${escapeHtml(plan.name)}</option>`).join("")}
        <option value="">Outro treino em casa</option>
      </select>
    </div>
    <div class="form-group">
      <label for="workout-date">Data</label>
      <input id="workout-date" class="form-control" type="date" required value="${toIsoDate()}" />
    </div>
    <div class="grid-2">
      ${workoutNumberField("durationMinutes", "Tempo (min)", "1")}
      ${workoutNumberField("calories", "Calorias (kcal)", "1")}
    </div>
    <div class="form-group">
      <label for="workout-notes">Observações (opcional)</label>
      <input id="workout-notes" class="form-control" type="text" maxlength="160" placeholder="Morreu ou sobreviveu?" />
    </div>`;
}

function fillHomeForm(workout) {
  const select = document.getElementById("workout-home-plan");
  if (select) select.value = getHomePlan(workout.home?.plan) ? workout.home.plan : "";
  const notes = document.getElementById("workout-notes");
  if (notes) notes.value = workout.notes || "";
  const start = document.querySelector(".home-form-start");
  if (start) start.hidden = true;
  start?.previousElementSibling?.setAttribute("hidden", "");
  const or = start?.nextElementSibling;
  if (or) or.hidden = true;
}

// title + home do salvar do formulário (mantém os segundos do ao vivo)
function readHomeFormExtras(original) {
  const planId = document.getElementById("workout-home-plan")?.value || "";
  const plan = getHomePlan(planId);
  const home = { ...(original && original.home && typeof original.home === "object" ? original.home : {}), plan: plan ? plan.id : "" };
  if (original?.home?.plan !== home.plan) delete home.done; // trocou o plano: os segundos de antes não valem
  return { title: plan ? plan.name : HOME_TYPE_TITLE, home };
}

tobaActions({
  startHomeLive: (el) => openHomeIntro(el.dataset.plan), // v1.96: abre a abertura, não começa direto
  startHomeNow: (el) => startHomeLive(el.dataset.plan),
  openHomeHelp: (el) => openHomeHelp(el.dataset.plan),
  openStretchIntro: (el) => openStretchIntro(el.dataset.plan), // v1.97
  openStretchHelp: (el) => openStretchHelp(el.dataset.plan),
  openSaitamaIntro,
  openSaitamaHelp,
  openHomeStart,
  homeTogglePause,
  homeSkip,
  homeBack,
  homeFinishNow,
  homeToggleVoice,
  homeTestVoice,
  saveHomeLive,
  // v2.06: 🟣 elástico
  openElasticSetup: (el) => openElasticSetup(el.dataset.plan),
  elasticSetupTap,
  elasticSetupReset,
  elasticSetupKg,
  elasticCycleIntro,
  homeCycleBand,
  homePickFeel,
});
