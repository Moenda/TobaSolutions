/* =====================================================================
 * Toba Routine · regras puras (só leitura do banco recebido)
 * - Quando uma tarefa "cai" num dia, streak por tarefa e o XP da rotina.
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

// "taskId|AAAA-MM-DD" das ocorrências feitas
function routineDoneKeys(log) {
  return new Set((log || []).map((entry) => `${entry.taskId}|${entry.date}`));
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
  const stats = { routineTasks: 0, routineHard: 0, routineBestSeq: 0, routineSleepSeq: 0, routinePerfect: 0 };
  const timeline = facts.map((fact) => {
    if (fact.add) {
      stats.routineTasks += fact.add.tasks || 0;
      stats.routineHard += fact.add.hard || 0;
      stats.routinePerfect += fact.add.perfect || 0;
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
  const due = tasks.filter((t) => isRoutineTaskDue(t, today));
  const done = due.filter((t) => doneKeys.has(`${t.id}|${today}`));
  let overdue = 0;
  for (let i = 1; i <= 7; i++) {
    const day = routineAddDays(today, -i);
    overdue += tasks.filter((t) => isRoutineTaskDue(t, day) && !doneKeys.has(`${t.id}|${day}`)).length;
  }
  return { total: due.length, done: done.length, overdue, tasks: tasks.length };
}
