/* =====================================================================
 * Toba Routine · núcleo do app
 * - Depende de ../assets/toba-common.js (datas, avisos, ⚙️).
 * - Banco único no localStorage: "TOBA_ROUTINE_DB". NUNCA mude a chave
 *   nem renomeie campos (ver CLAUDE.md, seção 3.10).
 *   {
 *     version: 1,
 *     seeded: bool,                 // já mostrou as sugestões da 1ª abertura
 *     tasks: [ { id: "t-<ts>-<rand4>", name, emoji,
 *                recurrence: { type: "daily"|"weekly"|"monthly"|"situational",
 *                              days?: ["MO","WE"], monthDay?: 1-31 },
 *                time: "HH:MM" | "", difficulty: "easy"|"medium"|"hard",
 *                nag: bool,                 // cobrar de novo (+30 min, +2 h)
 *                createdAt: "AAAA-MM-DD",
 *                archivedAt?: "AAAA-MM-DD" } ], // "apagada": some da tela, histórico fica
 *     log: [ { id, taskId, date: "AAAA-MM-DD" (dia da tarefa), doneAt: ms,
 *              difficulty (cópia na hora de marcar) } ]
 *   }
 * - O XP sai do log (routine-metrics.js); nada de XP gravado aqui.
 * - Carregue DEPOIS de routine-metrics.js (usa ROUTINE_DIFFICULTIES).
 * ===================================================================== */
const ROUTINE_KEY = "TOBA_ROUTINE_DB";
const ROUTINE_BACKUP_KEY = "TOBA_ROUTINE_DB_AUTO_BACKUP";

// Trava: fica false se o banco salvo estiver ilegível, para não sobrescrever.
let isRoutineDbLoaded = false;

function createEmptyRoutineDb() {
  return { version: 1, seeded: false, tasks: [], log: [] };
}

// "Migração": todo campo novo ganha default AQUI (load e import passam por ela).
function normalizeRoutineDb(db) {
  if (!db || typeof db !== "object" || Array.isArray(db)) throw new Error("Formato de banco inválido");
  if (!db.version) db.version = 1;
  db.seeded = db.seeded === true;
  db.tasks = Array.isArray(db.tasks) ? db.tasks.filter((t) => t && typeof t === "object" && t.id) : [];
  db.tasks.forEach((task) => {
    task.id = String(task.id);
    task.name = String(task.name || "Tarefa");
    task.emoji = String(task.emoji || "✅");
    if (!task.recurrence || typeof task.recurrence !== "object") task.recurrence = { type: "daily" };
    if (!["daily", "weekly", "monthly", "situational"].includes(task.recurrence.type)) task.recurrence.type = "daily";
    if (task.recurrence.type === "weekly" && !Array.isArray(task.recurrence.days)) task.recurrence.days = ["MO"];
    if (task.recurrence.type === "monthly") task.recurrence.monthDay = Math.min(31, Math.max(1, Number(task.recurrence.monthDay) || 1));
    task.time = /^\d{2}:\d{2}$/.test(String(task.time || "")) ? task.time : "";
    if (!ROUTINE_DIFFICULTIES[task.difficulty]) task.difficulty = "easy";
    if (task.nag === undefined) task.nag = true;
    if (!routineIsIso(task.createdAt)) task.createdAt = toIsoDate();
  });
  db.log = Array.isArray(db.log) ? db.log.filter((e) => e && typeof e === "object" && e.taskId && routineIsIso(e.date)) : [];
  db.log.forEach((entry) => {
    entry.taskId = String(entry.taskId);
    if (!entry.id) entry.id = `l-${entry.date}-${Math.random().toString(36).slice(2, 6)}`;
    entry.doneAt = Number(entry.doneAt) || new Date(`${entry.date}T12:00:00`).getTime();
    if (!ROUTINE_DIFFICULTIES[entry.difficulty]) entry.difficulty = "easy";
  });
  return db;
}

function loadRoutineDb() {
  const raw = localStorage.getItem(ROUTINE_KEY);
  if (raw === null) {
    isRoutineDbLoaded = true;
    return createEmptyRoutineDb();
  }
  try {
    const db = normalizeRoutineDb(JSON.parse(raw));
    try {
      localStorage.setItem(ROUTINE_BACKUP_KEY, raw);
    } catch (err) {
      console.warn("Aviso ao atualizar auto-backup da rotina:", err);
    }
    isRoutineDbLoaded = true;
    return db;
  } catch (err) {
    console.error("Banco do Toba Routine ilegível; gravação travada.", err);
    return createEmptyRoutineDb();
  }
}

let routineDb = loadRoutineDb();

function saveRoutineDb(options = {}) {
  if (!isRoutineDbLoaded) {
    showRoutineLockedMessage();
    return false;
  }
  try {
    const previous = localStorage.getItem(ROUTINE_KEY);
    if (previous) localStorage.setItem(ROUTINE_BACKUP_KEY, previous);
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(routineDb));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (!options.silent) tobaSaved();
  if (typeof onRoutineDataSaved === "function") onRoutineDataSaved();
  return true;
}

function showRoutineLockedMessage() {
  showPageMessage("Não consegui ler os dados salvos do Toba Routine, então nada será gravado por cima. Restaure um backup em ⚙️ → Dados & Backup (ou Apagar tudo para começar do zero).", { title: "Dados protegidos", icon: "🛡️" });
}

// As páginas sobrescrevem para redesenhar depois de importar/apagar.
function onRoutineDataReplaced() {}

function exportRoutineBackup() {
  tobaDownloadJson(routineDb, `toba_routine_backup_${toIsoDate()}.json`);
}

async function importRoutineBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!data || !Array.isArray(data.tasks)) throw new Error("Não é backup do Routine");
    data = normalizeRoutineDb(data);
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Toba Routine (não serve o do Bank, do Health nem o geral).", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  routineDb = data;
  isRoutineDbLoaded = true;
  saveRoutineDb({ silent: true });
  closeDataModal();
  onRoutineDataReplaced();
  showPageMessage("Backup restaurado!", { title: "Tudo de volta", icon: "✅" });
}

async function resetRoutineData() {
  const ok = await showPageMessage("Apaga TODAS as tarefas e o histórico do Toba Routine (e o XP que veio delas). Não dá para desfazer!", { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" });
  if (!ok) return;
  localStorage.removeItem(ROUTINE_KEY); // só a chave deste app
  routineDb = createEmptyRoutineDb();
  routineDb.seeded = true;
  isRoutineDbLoaded = true;
  closeDataModal();
  onRoutineDataReplaced();
}

tobaSetupApp({
  name: "Toba Routine",
  exportBackup: exportRoutineBackup,
  importBackup: importRoutineBackup,
  resetData: resetRoutineData,
});

if (!isRoutineDbLoaded) showRoutineLockedMessage();
