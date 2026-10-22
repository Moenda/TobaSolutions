/* =====================================================================
 * Toba Routine · regras puras (só leitura do banco recebido)
 * - Quando uma tarefa "cai" num dia, streak por tarefa e o XP da rotina.
 * - Desde v1.42: Task (não rotineira), Meu dia fixo, dia livre e a sugestão
 *   de qual dia encaixar a task (fim do arquivo).
 * - Não depende de routine-core.js: o portal, o Perfil e o Treinos carregam
 *   este arquivo sozinho para o XP do jogador bater em todas as telas.
 *   (toba-player.js chama calcRoutinePlayer.) Nunca grava nada.
 * ===================================================================== */

// A key é gravada em tasks[].difficulty e log[].difficulty: não renomeie.
const ROUTINE_DIFFICULTIES = {
  easy: { icon: "☕", name: "Fácil", tag: "Café com leite", xp: 10 },
  medium: { icon: "😐", name: "Médio", tag: "Não fez mais que sua obrigação", xp: 25 },
  hard: { icon: "🧘", name: "Difícil", tag: "Monge tibetano da proatividade", xp: 60 },
};
const ROUTINE_XP_DAY_CAP = 250; // teto de XP de rotina por dia
const ROUTINE_SITUATIONAL_PER_DAY = 3; // "quando acontecer": no máximo 3 por dia valem XP
const ROUTINE_WEEK_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]; // Date.getDay()

function routineIsIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function routineAddDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// 90 -> "1h30", 60 -> "1h", 45 -> "45 min"
function routineFormatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function routineDifficulty(key) {
  return ROUTINE_DIFFICULTIES[key] || ROUTINE_DIFFICULTIES.easy;
}

// A tarefa cai neste dia? Situacional nunca "cai" (é quando acontecer).
function isRoutineTaskDue(task, iso) {
  if (!task || !routineIsIso(iso)) return false;
  if (routineIsIso(task.createdAt) && iso < task.createdAt) return false;
  if (routineIsIso(task.archivedAt) && iso >= task.archivedAt) return false;
  const rec = task.recurrence || {};
  const date = new Date(`${iso}T12:00:00`);
  if (rec.type === "daily") return true;
  if (rec.type === "weekly") return Array.isArray(rec.days) && rec.days.includes(ROUTINE_WEEK_CODES[date.getDay()]);
  if (rec.type === "monthly") {
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === Math.min(Number(rec.monthDay) || 1, last); // dia 31 em mês curto = último dia
  }
  return false;
}

function isRoutineScheduled(task) {
  return task && task.recurrence && task.recurrence.type !== "situational";
}

// Não fez no dia: vira atrasada (padrão) ou expira (ex: dormir na hora).
// Expirada só some das atrasadas; o XP e o streak seguem a mesma regra.
function routineCarriesOver(task) {
  return !task || task.carryOver !== false;
}

// "taskId|AAAA-MM-DD" das ocorrências feitas
function routineDoneKeys(log) {
  return new Set((log || []).map((entry) => `${entry.taskId}|${entry.date}`));
}

// "taskId|AAAA-MM-DD" das atrasadas descartadas (desde v1.47)
function routineSkippedKeys(db) {
  return new Set((Array.isArray(db?.skipped) ? db.skipped : []).map((k) => `${k.taskId}|${k.date}`));
}

const ROUTINE_OVERDUE_DAYS = 7; // atrasada fica na lista por 7 dias

/* Situação de uma ocorrência (tarefa com agenda, num dia em que ela cai):
 * "done" feita · "skipped" deixada pra lá · "today" hoje, aberta
 * "overdue" atrasada (ainda dá pra fazer) · "expired" não passa pro dia
 * seguinte e o dia acabou · "missed" ficou atrasada mais de 7 dias. */
function routineOccurrenceStatus(task, day, doneKeys, skippedKeys, today) {
  const key = `${task.id}|${day}`;
  if (doneKeys.has(key)) return "done";
  if (skippedKeys.has(key)) return "skipped";
  if (day >= today) return "today";
  if (!routineCarriesOver(task)) return "expired";
  return day >= routineAddDays(today, -ROUTINE_OVERDUE_DAYS) ? "overdue" : "missed";
}

// Streak de uma tarefa com agenda: ocorrências seguidas feitas (atrasada
// também conta). A de hoje ainda aberta não quebra.
function calcRoutineTaskStreak(task, doneKeys, today) {
  const result = { current: 0, best: 0, done: 0, runs: [] };
  if (!isRoutineScheduled(task) || !routineIsIso(task.createdAt)) return result;
  let run = 0;
  for (let day = task.createdAt; day <= today; day = routineAddDays(day, 1)) {
    if (!isRoutineTaskDue(task, day)) continue;
    if (doneKeys.has(`${task.id}|${day}`)) {
      run += 1;
      result.done += 1;
      result.runs.push({ date: day, length: run });
      result.best = Math.max(result.best, run);
    } else if (day !== today) {
      run = 0;
    }
  }
  result.current = run;
  return result;
}

function routineIsLate(entry) {
  const doneDay = toIsoDate(new Date(Number(entry.doneAt) || 0));
  return Number(entry.doneAt) > 0 && doneDay > entry.date;
}

/* Tudo que o perfil do jogador precisa, em ordem de data:
 * events: XP de cada tarefa feita; facts: números acumulados para as
 * conquistas da rotina (o toba-player confere a cada data). */
function calcRoutinePlayer(data, today) {
  const db = data && typeof data === "object" ? data : {};
  const tasks = Array.isArray(db.tasks) ? db.tasks.filter((t) => t && t.id) : [];
  const byId = Object.fromEntries(tasks.map((t) => [String(t.id), t]));
  const log = (Array.isArray(db.log) ? db.log : [])
    .filter((e) => e && byId[String(e.taskId)] && routineIsIso(e.date) && e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.doneAt) || 0) - (Number(b.doneAt) || 0));
  const events = [];
  const facts = []; // { date, add: { tasks?, hard?, perfect? }, seq?: { len, sleep } }
  const dayXp = {};
  const situationalCount = {};

  log.forEach((entry) => {
    const task = byId[String(entry.taskId)];
    const diff = routineDifficulty(entry.difficulty || task.difficulty);
    const late = routineIsLate(entry);
    let xp = late ? Math.round(diff.xp / 2) : diff.xp;
    if (!isRoutineScheduled(task)) {
      const key = `${task.id}|${entry.date}`;
      situationalCount[key] = (situationalCount[key] || 0) + 1;
      if (situationalCount[key] > ROUTINE_SITUATIONAL_PER_DAY) xp = 0;
    }
    const used = dayXp[entry.date] || 0;
    const granted = Math.max(0, Math.min(xp, ROUTINE_XP_DAY_CAP - used));
    dayXp[entry.date] = used + granted;
    events.push({ date: entry.date, kind: "task", xp: granted, icon: task.emoji || "✅", label: `${task.name || "Tarefa"}${late ? " (atrasada)" : ""}`, capped: granted < xp });
    facts.push({ date: entry.date, add: { tasks: 1, hard: entry.difficulty === "hard" ? 1 : 0 } });
  });

  // Task (não rotineira, desde v1.42): cada sessão feita vale pela duração,
  // fora do teto diário da rotina. Conta no dia em que foi marcada.
  (Array.isArray(db.oneoffs) ? db.oneoffs : []).forEach((oneoff) => {
    if (!oneoff || !oneoff.id) return;
    (Array.isArray(oneoff.sessions) ? oneoff.sessions : []).forEach((session) => {
      if (!session || !Number(session.doneAt)) return;
      const date = toIsoDate(new Date(Number(session.doneAt)));
      if (date > today) return;
      events.push({ date, kind: "oneoff", xp: routineOneoffXp(session.minutes), icon: oneoff.emoji || "🛠️", label: `${oneoff.name || "Task"} (${routineFormatMinutes(session.minutes)})` });
    });
    if (Number(oneoff.doneAt)) {
      const date = toIsoDate(new Date(Number(oneoff.doneAt)));
      if (date <= today) facts.push({ date, add: { oneoffs: 1, bigOneoff: (Number(oneoff.minutes) || 0) >= ROUTINE_ONEOFF_BIG ? 1 : 0 } });
    }
  });

  // Sequências por tarefa (7, 30, 100 seguidas) e "sono" (tarefa de dormir)
  const doneKeys = routineDoneKeys(log);
  const sleepy = /dorm|sono|deitar|😴|🛌|🛏/i;
  tasks.forEach((task) => {
    const streak = calcRoutineTaskStreak(task, doneKeys, today);
    const isSleep = sleepy.test(`${task.name || ""} ${task.emoji || ""}`);
    streak.runs.forEach((r) => facts.push({ date: r.date, seq: { len: r.length, sleep: isSleep } }));
  });

  // Dia perfeito: pelo menos 2 tarefas com agenda no dia, todas feitas NO dia
  const onTime = new Set(log.filter((e) => !routineIsLate(e)).map((e) => `${e.taskId}|${e.date}`));
  const firstDay = tasks.filter((t) => routineIsIso(t.createdAt)).map((t) => t.createdAt).sort()[0];
  if (firstDay) {
    for (let day = firstDay; day <= today; day = routineAddDays(day, 1)) {
      const due = tasks.filter((t) => isRoutineTaskDue(t, day));
      if (due.length >= 2 && due.every((t) => onTime.has(`${t.id}|${day}`))) facts.push({ date: day, add: { perfect: 1 } });
    }
  }

  facts.sort((a, b) => a.date.localeCompare(b.date));
  const stats = { routineTasks: 0, routineHard: 0, routineBestSeq: 0, routineSleepSeq: 0, routinePerfect: 0, routineOneoffs: 0, routineBigOneoff: 0 };
  const timeline = facts.map((fact) => {
    if (fact.add) {
      stats.routineTasks += fact.add.tasks || 0;
      stats.routineHard += fact.add.hard || 0;
      stats.routinePerfect += fact.add.perfect || 0;
      stats.routineOneoffs += fact.add.oneoffs || 0;
      stats.routineBigOneoff += fact.add.bigOneoff || 0;
    }
    if (fact.seq) {
      stats.routineBestSeq = Math.max(stats.routineBestSeq, fact.seq.len);
      if (fact.seq.sleep) stats.routineSleepSeq = Math.max(stats.routineSleepSeq, fact.seq.len);
    }
    return { date: fact.date, stats: { ...stats } };
  });
  return { events, timeline, stats };
}

// Resumo do dia para o portal e para a tela da rotina.
function calcRoutineToday(data, today = toIsoDate()) {
  const db = data && typeof data === "object" ? data : {};
  const tasks = (Array.isArray(db.tasks) ? db.tasks : []).filter((t) => t && t.id && !t.archivedAt);
  const doneKeys = routineDoneKeys(db.log);
  const skippedKeys = routineSkippedKeys(db);
  const due = tasks.filter((t) => isRoutineTaskDue(t, today));
  const done = due.filter((t) => doneKeys.has(`${t.id}|${today}`));
  let overdue = 0;
  for (let i = 1; i <= ROUTINE_OVERDUE_DAYS; i++) {
    const day = routineAddDays(today, -i);
    overdue += tasks.filter((t) => isRoutineTaskDue(t, day)
      && routineOccurrenceStatus(t, day, doneKeys, skippedKeys, today) === "overdue").length;
  }
  return { total: due.length, done: done.length, overdue, tasks: tasks.length };
}

// Tarefas que caem hoje, na ordem da tela da Rotina (horário, depois nome),
// com feita ou não. Lista do card do portal (desde v1.48).
function calcRoutineTodayList(data, today = toIsoDate()) {
  const db = data && typeof data === "object" ? data : {};
  const doneKeys = routineDoneKeys(db.log);
  return (Array.isArray(db.tasks) ? db.tasks : [])
    .filter((t) => t && t.id && !t.archivedAt && isRoutineTaskDue(t, today))
    .sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")) || String(a.name || "").localeCompare(String(b.name || "")))
    .map((t) => ({ id: String(t.id), name: String(t.name || "Tarefa"), emoji: String(t.emoji || "✅"), time: t.time || "", difficulty: t.difficulty, done: doneKeys.has(`${t.id}|${today}`) }));
}

/* Números do card do Routine no portal (desde v1.43): mesma regra das telas
 * (calcRoutineToday, calcRoutineDayLoad, routineOneoffStatus, calcRoutinePlayer). */
function calcRoutineSummary(data, now = new Date()) {
  const db = data && typeof data === "object" ? data : {};
  const today = toIsoDate(now);
  const month = today.slice(0, 7);
  const monday = routineAddDays(today, -((now.getDay() + 6) % 7));
  const sunday = routineAddDays(monday, 6);
  const tomorrow = routineAddDays(today, 1);
  const tasks = (Array.isArray(db.tasks) ? db.tasks : []).filter((t) => t && t.id && !t.archivedAt);
  const log = (Array.isArray(db.log) ? db.log : []).filter((e) => e && routineIsIso(e.date) && e.date <= today);
  const oneoffs = routineOneoffsOf(db).filter((o) => !o.archivedAt);

  let freeWeek = 0;
  for (let day = today; day <= sunday; day = routineAddDays(day, 1)) freeWeek += calcRoutineDayLoad(db, day, { now }).free;

  let monthSessions = 0;
  oneoffs.forEach((o) => (o.sessions || []).forEach((s) => {
    if (s && Number(s.doneAt) && toIsoDate(new Date(Number(s.doneAt))).startsWith(month)) monthSessions += 1;
  }));
  const open = oneoffs.filter((o) => !o.doneAt);

  const doneKeys = routineDoneKeys(log);
  let streak = { len: 0, name: "", emoji: "" };
  tasks.forEach((task) => {
    const run = calcRoutineTaskStreak(task, doneKeys, today).current;
    if (run > streak.len) streak = { len: run, name: task.name || "Tarefa", emoji: task.emoji || "✅" };
  });

  const monthXp = calcRoutinePlayer(db, today).events
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + (Number(e.xp) || 0), 0);

  return {
    today: calcRoutineToday(db, today),
    freeToday: calcRoutineDayLoad(db, today, { now }).free,
    freeWeek,
    weekDaysLeft: Math.round((new Date(`${sunday}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000) + 1,
    weekDone: log.filter((e) => e.date >= monday).length,
    monthDone: log.filter((e) => e.date.startsWith(month)).length,
    monthSessions,
    monthXp,
    tomorrow: tasks.filter((t) => isRoutineTaskDue(t, tomorrow)).length
      + open.filter((o) => (o.sessions || []).some((s) => s.date === tomorrow && !s.doneAt)).length,
    oneoffsOpen: open.length,
    oneoffsToday: open.filter((o) => (o.sessions || []).some((s) => s.date === today && !s.doneAt)).length,
    oneoffsQueue: open.filter((o) => routineOneoffStatus(o, today).toPlan > 0).length,
    streak,
    isEmpty: !tasks.length && !oneoffs.length,
  };
}

/* =====================================================================
 * Task (tarefas não rotineiras) e Meu dia fixo (desde v1.42)
 * Tudo puro: recebe o banco e devolve números. Nada é gravado aqui.
 * ===================================================================== */

// XP de uma sessão de task feita: 20 XP por hora, mínimo 15, teto 150.
// Fora do teto diário da rotina (pintar o quarto tem que valer a pena).
const ROUTINE_ONEOFF_XP = { perHour: 20, min: 15, max: 150 };
const ROUTINE_ONEOFF_BIG = 240; // task de 4 h ou mais = "Pedreiro de fim de semana"
const ROUTINE_PLAN_DAYS = 14; // a sugestão olha os próximos 14 dias
// Sem "duração" a tarefa da rotina ocupa isso do dia (pela dificuldade)
const ROUTINE_DEFAULT_MINUTES = { easy: 15, medium: 30, hard: 60 };

// Palpites do Toba pela palavra do nome (minutos). O 1º que casar vale.
const ROUTINE_ONEOFF_GUESSES = [
  { match: /pint/i, minutes: 360, heavy: true },
  { match: /marmit|congel/i, minutes: 180, heavy: true },
  { match: /privada|vaso|descarga|torneira|chuveiro|consert|arrum.*(porta|gaveta)/i, minutes: 90 },
  { match: /mudan[cç]a|faxina|organiz.*(guarda|arm[aá]rio|quarto)|limp.*geral/i, minutes: 240, heavy: true },
  { match: /livro|ler\b|leitura/i, minutes: 480, split: true },
  { match: /desenh|pintura|quadro|arte/i, minutes: 120, split: true },
  { match: /m[oó]vel|montar|estante|prateleira/i, minutes: 120, heavy: true },
  { match: /curso|estudar|aula/i, minutes: 300, split: true },
  { match: /mercado|compras|feira/i, minutes: 90 },
  { match: /m[eé]dico|dentista|exame|consulta/i, minutes: 120 },
  { match: /lavar o carro|carro/i, minutes: 90 },
  { match: /jardim|grama|horta/i, minutes: 120, heavy: true },
];

function routineGuessOneoff(name) {
  const hit = ROUTINE_ONEOFF_GUESSES.find((g) => g.match.test(String(name || "")));
  return hit ? { minutes: hit.minutes, heavy: Boolean(hit.heavy), split: Boolean(hit.split) } : null;
}

function routineOneoffXp(minutes) {
  const raw = Math.round(((Number(minutes) || 0) / 60) * ROUTINE_ONEOFF_XP.perHour);
  return Math.min(ROUTINE_ONEOFF_XP.max, Math.max(ROUTINE_ONEOFF_XP.min, raw));
}

function routineTimeToMin(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Duração de um bloco "HH:MM → HH:MM" (passa da meia-noite = soma 24 h)
function routineSpan(start, end) {
  const a = routineTimeToMin(start);
  const b = routineTimeToMin(end);
  if (a === null || b === null) return 0;
  return b > a ? b - a : b + 1440 - a;
}

function routineBlockMinutes(block) {
  if (!block) return 0;
  if (block.kind === "commute") return Math.max(0, Number(block.minutes) || 0);
  return routineSpan(block.start, block.end);
}

function routineWeekCode(iso) {
  return ROUTINE_WEEK_CODES[new Date(`${iso}T12:00:00`).getDay()];
}

// Dia fixo com padrão (bancos sem dayPlan usam isso só para a conta)
function routineDayPlan(db) {
  const plan = db && db.dayPlan && typeof db.dayPlan === "object" ? db.dayPlan : {};
  const blocks = Array.isArray(plan.blocks) ? plan.blocks.filter((b) => b && typeof b === "object") : routineDefaultBlocks();
  const breathing = Number.isFinite(Number(plan.breathing)) ? Math.max(0, Number(plan.breathing)) : 90;
  return { blocks, breathing, configured: plan.configured === true };
}

function routineDefaultBlocks() {
  return [
    { id: "sleep", kind: "sleep", name: "Sono", emoji: "😴", days: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"], start: "23:30", end: "07:00" },
    { id: "work", kind: "work", name: "Trabalho", emoji: "💼", days: ["MO", "TU", "WE", "TH", "FR"], start: "09:00", end: "18:00" },
    { id: "commute", kind: "commute", name: "Transporte", emoji: "🚌", days: ["MO", "TU", "WE", "TH", "FR"], minutes: 60 },
  ];
}

function routineTaskMinutes(task) {
  if (task && task.minutes === 0) return 0; // desde v1.45: tarefa que não ocupa tempo (dormir às 23h)
  const own = Number(task && task.minutes);
  if (own > 0) return own;
  return ROUTINE_DEFAULT_MINUTES[task && task.difficulty] || 15;
}

function routineOneoffsOf(db) {
  return (db && Array.isArray(db.oneoffs) ? db.oneoffs : []).filter((o) => o && o.id);
}

/* Situação de uma task: quanto já foi feito, o que está agendado (hoje em
 * diante), o que furou (dia passou sem marcar) e quanto falta agendar. */
function routineOneoffStatus(oneoff, today) {
  const sessions = Array.isArray(oneoff.sessions) ? oneoff.sessions : [];
  const total = Math.max(0, Number(oneoff.minutes) || 0);
  const doneMin = sessions.filter((s) => s.doneAt).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const planned = sessions.filter((s) => !s.doneAt && routineIsIso(s.date) && s.date >= today);
  const missed = sessions.filter((s) => !s.doneAt && routineIsIso(s.date) && s.date < today);
  const plannedMin = planned.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const finished = Boolean(oneoff.doneAt);
  const toPlan = finished ? 0 : Math.max(0, total - doneMin - plannedMin);
  let state = "queue";
  if (finished) state = "done";
  else if (!toPlan && planned.length) state = "planned";
  return { total, doneMin, planned, missed, plannedMin, toPlan, state, ratio: total ? Math.min(1, doneMin / total) : 0 };
}

/* Quanto o dia está ocupado e quanto sobra livre (minutos).
 * options.skipOneoff: id da task que está sendo agendada (não conta ela).
 * options.now: Date (só para hoje: o que já passou do dia não está livre). */
function calcRoutineDayLoad(db, iso, options = {}) {
  const plan = routineDayPlan(db);
  const code = routineWeekCode(iso);
  const items = [];
  plan.blocks.forEach((block) => {
    if (!Array.isArray(block.days) || !block.days.includes(code)) return;
    const minutes = routineBlockMinutes(block);
    if (minutes > 0) items.push({ kind: block.kind, emoji: block.emoji || "📌", name: block.name || "Bloco", minutes });
  });
  const fixed = items.reduce((sum, i) => sum + i.minutes, 0);

  const tasks = (db && Array.isArray(db.tasks) ? db.tasks : []).filter((t) => t && t.id && !t.archivedAt);
  const routine = tasks.filter((t) => isRoutineTaskDue(t, iso)).reduce((sum, t) => sum + routineTaskMinutes(t), 0);

  const oneoffList = [];
  routineOneoffsOf(db).forEach((o) => {
    if (o.archivedAt || String(o.id) === String(options.skipOneoff || "")) return;
    (o.sessions || []).forEach((s) => {
      if (s.date === iso) oneoffList.push({ id: o.id, emoji: o.emoji, name: o.name, minutes: Number(s.minutes) || 0, done: Boolean(s.doneAt) });
    });
  });
  const oneoffs = oneoffList.reduce((sum, s) => sum + s.minutes, 0);

  let free = 1440 - fixed - routine - oneoffs - plan.breathing;
  // Hoje: o que já passou não volta. Livre = até a hora de dormir (ou meia-noite),
  // tirando o trabalho/transporte que ainda falta.
  const now = options.now instanceof Date ? options.now : null;
  if (now && iso === toIsoDate(now)) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const sleep = plan.blocks.find((b) => b.kind === "sleep" && Array.isArray(b.days) && b.days.includes(code));
    let end = 1440;
    const sleepStart = sleep ? routineTimeToMin(sleep.start) : null;
    if (sleepStart !== null && sleepStart > 12 * 60) end = sleepStart;
    let left = Math.max(0, end - nowMin);
    plan.blocks.forEach((block) => {
      if (block.kind === "sleep" || block.kind === "commute" || !Array.isArray(block.days) || !block.days.includes(code)) return;
      const a = routineTimeToMin(block.start);
      const b = routineTimeToMin(block.end);
      if (a === null || b === null || b <= a) return;
      left -= Math.max(0, Math.min(b, end) - Math.max(a, nowMin));
    });
    const work = plan.blocks.find((b) => b.kind === "work" && Array.isArray(b.days) && b.days.includes(code));
    const workEnd = work ? routineTimeToMin(work.end) : null;
    if (workEnd !== null && nowMin < workEnd) {
      left -= plan.blocks.filter((b) => b.kind === "commute" && Array.isArray(b.days) && b.days.includes(code)).reduce((sum, b) => sum + routineBlockMinutes(b), 0);
    }
    const doneKeys = routineDoneKeys(db && db.log);
    left -= tasks.filter((t) => isRoutineTaskDue(t, iso) && !doneKeys.has(`${t.id}|${iso}`)).reduce((sum, t) => sum + routineTaskMinutes(t), 0);
    left -= oneoffList.filter((s) => !s.done).reduce((sum, s) => sum + s.minutes, 0);
    free = Math.min(free, left - Math.min(plan.breathing, Math.max(0, left) / 3));
  }
  const hasWork = items.some((i) => i.kind === "work");
  const weekend = code === "SA" || code === "SU";
  return { date: iso, items, fixed, routine, oneoffs, oneoffList, breathing: plan.breathing, free: Math.max(0, Math.round(free)), hasWork, weekend };
}

/* Sugestão do Toba: os melhores dias para encaixar o que falta da task.
 * Inteira (não quebra): devolve até 3 dias onde cabe, do melhor pro pior;
 * se não cabe em nenhum, devolve os dias mais livres com fits = false.
 * Quebrável: devolve um plano de sessões (1 h nos dias de trabalho, até 3 h
 * nos de folga) até completar. */
/* Dia preferido da task (desde v1.45): "any" tanto faz, "weekend" fim de
 * semana/folga, "weekday" durante a semana. Task antiga sem `when` usa o
 * heavy (pesada = melhor na folga). */
const ROUTINE_ONEOFF_WHEN = {
  any: { icon: "🎲", name: "Tanto faz" },
  weekend: { icon: "🛋️", name: "Fim de semana / folga" },
  weekday: { icon: "💼", name: "Durante a semana" },
};

function routineOneoffWhen(oneoff) {
  const when = oneoff && oneoff.when;
  if (ROUTINE_ONEOFF_WHEN[when]) return when;
  return oneoff && oneoff.heavy ? "weekend" : "any";
}

function suggestRoutineOneoff(db, oneoff, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const today = toIsoDate(now);
  const status = routineOneoffStatus(oneoff, today);
  const need = Math.max(0, options.minutes || status.toPlan);
  const lastDay = routineIsIso(oneoff.deadline) && oneoff.deadline >= today
    ? [routineAddDays(today, ROUTINE_PLAN_DAYS - 1), oneoff.deadline].sort()[0]
    : routineAddDays(today, ROUTINE_PLAN_DAYS - 1);
  const when = routineOneoffWhen(oneoff);
  const days = [];
  for (let day = today; day <= lastDay; day = routineAddDays(day, 1)) {
    const load = calcRoutineDayLoad(db, day, { skipOneoff: oneoff.id, now });
    const ownToday = (oneoff.sessions || []).some((s) => s.date === day && !s.doneAt);
    const ahead = days.length;
    let score = load.free / 60 - ahead * 0.15;
    const easyDay = load.weekend || !load.hasWork;
    // Dia preferido (v1.45) vem antes de tudo; os outros só completam a lista
    const preferred = when === "weekend" ? easyDay : when === "weekday" ? !load.weekend : true;
    if (load.oneoffList.some((s) => !s.done)) score -= 3; // não empilhar task
    if (day === today) score -= 1; // hoje só se for o melhor mesmo
    days.push({ date: day, free: load.free, load, score, ownToday, easyDay, preferred });
  }
  if (!need) return { need, mode: "none", options: [], days };

  if (!oneoff.split) {
    // Cabe no dia preferido? Esses primeiro (por nota); o resto completa.
    const fit = days.filter((d) => d.free >= need)
      .sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.score - a.score);
    const picks = (fit.length ? fit : [...days].sort((a, b) => b.free - a.free)).slice(0, 3);
    return {
      need,
      mode: "whole",
      fits: fit.length > 0,
      options: picks.map((d) => ({ date: d.date, minutes: need, free: d.free, fits: d.free >= need, tight: d.free - need < 60, easyDay: d.easyDay, load: d.load })),
      days,
    };
  }

  // Quebrável: 1 sessão por dia, em ordem de data, nos dias que têm espaço.
  // 1ª passada pula dia que já tem outra task; só usa eles se faltar.
  // Com dia preferido, as passadas nos dias preferidos vêm antes.
  const chunk = Math.max(30, Number(oneoff.chunk) || 60);
  const picked = {};
  let left = need;
  const passes = when === "any"
    ? [[false, false], [true, false]]
    : [[false, true], [true, true], [false, false], [true, false]];
  passes.forEach(([allowBusy, onlyPreferred]) => {
    days.forEach((d) => {
      if (left <= 0 || picked[d.date]) return;
      if (onlyPreferred && !d.preferred) return;
      if (!allowBusy && d.load.oneoffList.some((s) => !s.done)) return;
      const cap = d.easyDay ? chunk * 3 : chunk;
      const room = Math.floor(Math.min(cap, d.free) / 15) * 15;
      if (room < 30) return;
      const minutes = Math.min(left, room);
      picked[d.date] = { date: d.date, minutes, free: d.free, easyDay: d.easyDay };
      left -= minutes;
    });
  });
  const sessions = Object.values(picked).sort((a, b) => a.date.localeCompare(b.date));
  return { need, mode: "split", fits: left <= 0, missing: Math.max(0, left), options: sessions, days };
}

/* Agenda do dia (desde v1.46): o que acontece em cada hora, pra visão de
 * calendário (TobaRoutine-Agenda.html). Minutos contados do 00:00 do dia.
 * - Dia fixo no horário. Bloco que passa da meia-noite aparece nos dois dias
 *   (o sono de seg 23h30–07h pinta seg 23h30–24h e ter 00h–07h).
 * - Transporte só tem minutos: metade antes do trabalho (ida), metade depois
 *   (volta). Dia sem trabalho = vai pra faixa "sem horário".
 * - Rotina com horário entra na hora, ocupando routineTaskMinutes (0 = só um
 *   risquinho). Rotina sem horário e sessão de task (que só tem dia) vão pra
 *   faixa "sem horário" do topo: o Toba não inventa hora que você não marcou.
 * Só cálculo, nada gravado. */
function calcRoutineDayAgenda(db, iso, today = toIsoDate()) {
  const plan = routineDayPlan(db);
  const code = routineWeekCode(iso);
  const prevCode = routineWeekCode(routineAddDays(iso, -1));
  const onDay = (block, c) => Array.isArray(block.days) && block.days.includes(c);
  const blocks = [];
  const timed = [];
  const untimed = [];

  plan.blocks.forEach((block) => {
    if (block.kind === "commute") return;
    const a = routineTimeToMin(block.start);
    const b = routineTimeToMin(block.end);
    if (a === null || b === null || a === b) return;
    const base = { kind: block.kind, emoji: block.emoji || "📌", name: block.name || "Bloco", startAt: a, endAt: b };
    if (b > a) {
      if (onDay(block, code)) blocks.push({ ...base, start: a, end: b });
      return;
    }
    if (onDay(block, code)) blocks.push({ ...base, start: a, end: 1440, toTomorrow: true });
    if (onDay(block, prevCode)) blocks.push({ ...base, start: 0, end: b, fromYesterday: true });
  });

  const work = blocks.filter((b) => b.kind === "work" && !b.fromYesterday).sort((x, y) => x.start - y.start)[0];
  plan.blocks.filter((b) => b.kind === "commute" && onDay(b, code)).forEach((block) => {
    const minutes = routineBlockMinutes(block);
    if (!minutes) return;
    const base = { kind: "commute", emoji: block.emoji || "🚌", name: block.name || "Transporte" };
    if (!work) {
      untimed.push({ ...base, minutes });
      return;
    }
    const half = Math.round(minutes / 2);
    blocks.push({ ...base, leg: "ida", start: Math.max(0, work.start - half), end: work.start });
    if (work.end < 1440) blocks.push({ ...base, leg: "volta", start: work.end, end: Math.min(1440, work.end + minutes - half) });
  });
  blocks.sort((x, y) => x.start - y.start);

  const sleeps = blocks.filter((b) => b.kind === "sleep");
  const wake = sleeps.filter((b) => b.end < 1440 && b.end <= 14 * 60).sort((x, y) => x.end - y.end)[0];
  const sleep = sleeps.filter((b) => b.start > 0 && b.start >= 12 * 60).sort((x, y) => y.start - x.start)[0];

  const doneKeys = routineDoneKeys(db && db.log);
  const skippedKeys = routineSkippedKeys(db);
  const tasks = (db && Array.isArray(db.tasks) ? db.tasks : []).filter((t) => t && t.id && isRoutineTaskDue(t, iso));
  tasks.forEach((task) => {
    const minutes = routineTaskMinutes(task);
    const done = doneKeys.has(`${task.id}|${iso}`);
    const skipped = !done && skippedKeys.has(`${task.id}|${iso}`); // deixada pra lá (v1.47)
    const item = { kind: "routine", id: task.id, emoji: task.emoji || "✅", name: task.name || "Tarefa", minutes, done, skipped, missed: !done && !skipped && iso < today };
    const at = routineTimeToMin(task.time);
    if (at === null) untimed.push(item);
    else timed.push({ ...item, start: at, end: Math.min(1440, at + minutes) });
  });
  timed.sort((x, y) => x.start - y.start || x.name.localeCompare(y.name));

  routineOneoffsOf(db).forEach((o) => {
    if (o.archivedAt) return;
    (o.sessions || []).forEach((s) => {
      if (s.date !== iso) return;
      untimed.push({ kind: "oneoff", id: o.id, emoji: o.emoji || "🛠️", name: o.name || "Task", minutes: Number(s.minutes) || 0, done: Boolean(s.doneAt), missed: !s.doneAt && iso < today });
    });
  });

  return { date: iso, blocks, timed, untimed, wakeAt: wake ? wake.end : null, sleepAt: sleep ? sleep.start : null };
}
