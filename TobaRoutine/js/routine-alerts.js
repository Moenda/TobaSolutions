/* =====================================================================
 * Toba Routine · avisos e cobranças das tarefas com horário
 * Carregado pela página da rotina e pelo portal (depois de routine-metrics.js).
 * Só lê o banco recebido; nada é gravado no localStorage.
 *
 * - App Android (TOBA_NATIVE.setTaskAlerts, APK 1.2+): manda a lista dos
 *   próximos ROUTINE_ALERT_DAYS dias, já com as frases sorteadas. O Android
 *   avisa no horário, cobra de novo (+30 min, +2 h) e tem o botão "✅ Feito".
 *   A lista é refeita a cada abertura e a cada mudança (substitui a anterior).
 * - Navegador: não existe aviso agendado com o site fechado. Com o portal ou
 *   a rotina abertos (ou recém-minimizados) o Toba confere a cada 30 s.
 * ===================================================================== */
const ROUTINE_NAG_STEPS = [0, 30, 120]; // minutos depois do horário: aviso + 2 cobranças
const ROUTINE_ALERT_DAYS = 3;
const ROUTINE_ALERT_MAX = 300; // alguns Androids limitam ~500 alarmes por app

const ROUTINE_PAGE_URL = (() => {
  try {
    return new URL("../TobaRoutine-Index.html", document.currentScript.src).href;
  } catch (err) {
    return "TobaRoutine/TobaRoutine-Index.html";
  }
})();

const ROUTINE_NAG_TITLES = ["{emoji} {nome}", "😒 Ainda não: {nome}", "🚨 Última cobrança: {nome}"];

// [nível 0 = no horário, 1 = +30 min, 2 = +2 h]
const ROUTINE_NAG_LINES = {
  easy: [
    ["Coisa rápida: {nome}. É café com leite ☕", "{emoji} {nome}. Dois minutinhos e tá feito.", "Hora de {nome}. Nem precisa levantar o mindinho."],
    ["Meia hora e nada de {nome}? Era a tarefa fácil, hein 🫠", "{nome} continua esperando. Até o café esfriou ☕", "Ô campeão, era café com leite e você deixou esfriar."],
    ["Duas horas pra uma tarefa fácil. A preguiça tá de parabéns 👏", "{nome} ainda não? O sofá venceu essa rodada 🛋️", "Última cobrança: {nome}. Depois eu desisto (mentira, amanhã tem mais)."],
  ],
  medium: [
    ["{emoji} Hora de {nome}. Não faz mais que sua obrigação 😐", "Lembrete oficial: {nome}. Bora, adulto funcional.", "{nome} agora. Reclamar da vida pode depois."],
    ["Ainda não fez {nome}? A obrigação continua obrigando 😒", "30 minutos de enrolação registrados. {nome}, por favor.", "{nome} tá te olhando com decepção 👀"],
    ["2 horas e {nome} segue pendente. Sua mãe ficaria triste 😔", "Terceira vez que eu falo: {nome}. Tô virando sua consciência.", "Última chamada pra {nome}. Depois disso, só no grito 📢"],
  ],
  hard: [
    ["{emoji} Hora do desafio: {nome}. Monge tibetano não procrastina 🧘", "{nome}. Difícil? Sim. Impossível? Só pra frango 🐔", "Respira fundo e vai: {nome}. O XP gordo te espera."],
    ["O monge tibetano já teria feito {nome} há meia hora 🧘‍♂️", "{nome} pendente. A iluminação espiritual também.", "Meia hora meditando sobre fazer {nome} não conta como fazer."],
    ["2 horas e nada de {nome}. O Dalai Lama está decepcionado.", "{nome}: última cobrança. Os 60 XP estão indo embora acenando 👋", "O careca fez 100 flexões enquanto você não fez {nome} 👊"],
  ],
};

// Frases de tarefas conhecidas (casam pelo nome). Uma por nível.
const ROUTINE_TOPIC_LINES = [
  { match: /banheir|privada|vaso/i, lines: ["O banheiro não vai se lavar sozinho, campeão 🚽", "O vaso tá pedindo socorro. Ouviu? 🚽", "Sabe aquele cheiro? Pois é. Banheiro, AGORA 🚽"] },
  { match: /plant|regar|horta|jardim/i, lines: ["Suas plantas estão com sede, chefia 🪴", "A samambaia já tá escrevendo o testamento 🥀", "Parabéns, sua planta agora é um cacto por obrigação 🌵"] },
  { match: /cachorr|\bc[aã]o\b|dog|passear|pet/i, lines: ["O doguinho tá na porta te encarando 🐕", "Ele já trouxe a coleira. Duas vezes 🦮", "Se não passear, ele faz no tapete. E a culpa é sua 💩"] },
  { match: /dorm|sono|deitar|cama/i, lines: ["Hora de dormir. O celular vai estar aí amanhã 😴", "Seu eu de amanhã mandou um recado: DORME 🛌", "Músculo cresce dormindo. Você tá encolhendo acordado 💤"] },
  { match: /lixo/i, lines: ["O lixo não sai sozinho (a não ser que crie pernas) 🗑️", "Os mosquitos já marcaram festa no seu lixo 🪰", "Lixo pra fora antes que vire bicho de estimação 🗑️"] },
  { match: /lou[cç]a|prato|pia/i, lines: ["A louça não se lava com pensamento positivo 🍽️", "A pia virou a Torre de Pisa de pratos 🍽️", "A louça já tá criando ecossistema próprio 🧽"] },
  { match: /roupa|lavar roupa|varal/i, lines: ["O cesto de roupa tá virando montanha 🧺", "Sua última cueca limpa está ansiosa 🩲", "Vai sair pelado amanhã? Roupa, já 🧺"] },
  { match: /[áa]gua|beber/i, lines: ["Bebe água, planta humana 💧", "Seu rim mandou um ofício: ÁGUA 💧", "Você tá mais seco que o sertão em agosto 🏜️"] },
  { match: /rem[eé]dio|vitamina|suplement|creatina/i, lines: ["Hora do remédio/suplemento 💊", "Esqueceu? Seu corpo não esqueceu 💊", "Última chamada pro comprimido 💊"] },
];

const ROUTINE_DONE_LINES = {
  easy: ["Café com leite, mas conta ☕", "Fácil, mas feito. Respeito.", "Mais uma pra conta, sem suar."],
  medium: ["Não fez mais que sua obrigação 😐 (mas fez!)", "Adulto funcional desbloqueado.", "Obrigação cumprida. Toma seu XP."],
  hard: ["Monge tibetano da proatividade 🧘", "Isso sim é disciplina Toberson.", "Iluminação alcançada. XP gordo na conta."],
};

function routinePick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function routineFill(text, task) {
  return text.replace(/\{nome\}/g, task.name).replace(/\{emoji\}/g, task.emoji || "✅");
}

function routineNagText(task, level) {
  const topic = ROUTINE_TOPIC_LINES.find((t) => t.match.test(task.name || ""));
  const diff = ROUTINE_NAG_LINES[task.difficulty] || ROUTINE_NAG_LINES.easy;
  // Tarefa conhecida: na maioria das vezes a frase é do assunto dela
  const body = topic && Math.random() < 0.6 ? topic.lines[level] : routinePick(diff[level]);
  return { title: routineFill(ROUTINE_NAG_TITLES[level], task), body: routineFill(body, task) };
}

function routineDoneLine(difficulty, late) {
  if (late) return "Atrasado, mas feito. Vale metade 🐢";
  return routinePick(ROUTINE_DONE_LINES[difficulty] || ROUTINE_DONE_LINES.easy);
}

// "taskId|data" que o app Android marcou como feito e o site ainda não leu
function readNativeRoutineDone() {
  if (!TOBA_NATIVE || typeof TOBA_NATIVE.getDoneTasks !== "function") return [];
  try {
    const list = JSON.parse(TOBA_NATIVE.getDoneTasks() || "[]");
    return Array.isArray(list) ? list.filter((item) => item && item.taskId && routineIsIso(item.date)) : [];
  } catch (err) {
    return [];
  }
}

// Próximos avisos: [{ key, at, title, body, url, taskId, date }] em ordem de horário
function buildRoutineAlerts(data, now = Date.now()) {
  const db = data && typeof data === "object" ? data : {};
  const tasks = (Array.isArray(db.tasks) ? db.tasks : []).filter((t) => t && t.id && t.time && !t.archivedAt);
  const done = routineDoneKeys(db.log);
  readNativeRoutineDone().forEach((item) => done.add(`${item.taskId}|${item.date}`));
  const today = toIsoDate(new Date(now));
  const alerts = [];
  for (let i = 0; i < ROUTINE_ALERT_DAYS; i++) {
    const day = routineAddDays(today, i);
    tasks.forEach((task) => {
      if (!isRoutineTaskDue(task, day) || done.has(`${task.id}|${day}`)) return;
      const base = new Date(`${day}T${task.time}:00`).getTime();
      const steps = task.nag === false ? ROUTINE_NAG_STEPS.slice(0, 1) : ROUTINE_NAG_STEPS;
      steps.forEach((minutes, level) => {
        const at = base + minutes * 60000;
        if (at <= now) return;
        const text = routineNagText(task, level);
        alerts.push({
          key: `${task.id}|${day}|${level}`,
          at,
          title: text.title,
          body: text.body,
          url: `${ROUTINE_PAGE_URL}?task=${encodeURIComponent(task.id)}&date=${day}`,
          taskId: String(task.id),
          date: day,
        });
      });
    });
  }
  return alerts.sort((a, b) => a.at - b.at).slice(0, ROUTINE_ALERT_MAX);
}

// "app": entregue ao Android; "old-apk": APK sem suporte; "browser": só com a página aberta
function routineAlertMode() {
  if (!TOBA_NATIVE) return "browser";
  return typeof TOBA_NATIVE.setTaskAlerts === "function" ? "app" : "old-apk";
}

// Refaz a agenda de avisos no Android. data = banco da rotina (null = ilegível: não mexe).
function syncRoutineAlerts(data) {
  if (!data || routineAlertMode() !== "app") return false;
  try {
    return TOBA_NATIVE.setTaskAlerts(JSON.stringify(buildRoutineAlerts(data)));
  } catch (err) {
    console.warn("Não consegui agendar os avisos da rotina:", err);
    return false;
  }
}

// Navegador: confere a cada 30 s enquanto a página estiver viva.
let routineWatcherTimer = null;

function startRoutineWatcher(getData) {
  if (routineAlertMode() !== "browser" || routineWatcherTimer) return;
  let lastCheck = Date.now();
  routineWatcherTimer = setInterval(() => {
    const now = Date.now();
    const from = lastCheck;
    lastCheck = now;
    if (!tobaCanNotify()) return;
    const data = getData();
    if (!data) return;
    buildRoutineAlerts(data, from)
      .filter((alert) => alert.at <= now)
      .forEach((alert) => tobaNotify(alert.title, alert.body, { tag: `rotina-${alert.taskId}` }));
  }, 30000);
}

// Banco da rotina direto do localStorage (portal). null = ilegível.
function readRoutineDbRaw() {
  try {
    const raw = localStorage.getItem("TOBA_ROUTINE_DB");
    if (raw === null) return { tasks: [], log: [] };
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch (err) {
    return null;
  }
}
