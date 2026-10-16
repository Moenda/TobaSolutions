/* =====================================================================
 * Toba Health · núcleo compartilhado (Pesagem + Treinos)
 * - Depende de ../assets/toba-common.js (datas, decimais, avisos, ⚙️).
 * - Banco único no localStorage ("TOBA_HEALTH_DB"): NÃO mude a chave nem o
 *   formato sem manter importação/exportação compatíveis.
 * - Cada página define onHealthDataReplaced() para redesenhar sua tela
 *   depois de importar backup ou apagar tudo.
 * ===================================================================== */
const HEALTH_KEY = "TOBA_HEALTH_DB";

// Cópia do valor ANTERIOR do banco, atualizada a cada gravação e no load
// (mesma ideia do TOBA_BANK_DB_AUTO_BACKUP).
const HEALTH_BACKUP_KEY = "TOBA_HEALTH_DB_AUTO_BACKUP";

// Trava de gravação: fica false quando o banco salvo não pôde ser lido, para
// a próxima gravação não apagar o original. Importar um backup ou "Apagar
// Tudo" liberam de novo.
let isHealthDbLoaded = false;

const DEFAULT_METRICS_ORDER = [
  {
    key: "score",
    label: "Pontuação Corporal",
    type: "int",
    active: true,
    placeholder: "Ex: 85",
    unit: "",
  },
  {
    key: "fat",
    label: "Gordura Corporal (%)",
    type: "dec1",
    active: true,
    color: "#f85149",
    placeholder: "Ex: 18,5",
    unit: "%",
  },
  {
    key: "muscle",
    label: "Massa Muscular (kg)",
    type: "dec2",
    active: true,
    color: "#3fb950",
    placeholder: "Ex: 65,20",
    unit: "kg",
  },
  {
    key: "water",
    label: "Água (%)",
    type: "dec1",
    active: true,
    color: "#58a6ff",
    placeholder: "Ex: 58,0",
    unit: "%",
  },
  {
    key: "bmr",
    label: "Metabolismo Basal (kcal)",
    type: "int",
    active: true,
    color: "#d29922",
    placeholder: "Ex: 1750",
    unit: " kcal",
  },
  {
    key: "visceral",
    label: "Gordura Visceral",
    type: "int",
    active: true,
    placeholder: "Ex: 6",
    unit: "",
  },
  {
    key: "protein",
    label: "Proteína (%)",
    type: "dec1",
    active: true,
    placeholder: "Ex: 18,0",
    unit: "%",
  },
  {
    key: "bone",
    label: "Massa Óssea (kg)",
    type: "dec2",
    active: true,
    placeholder: "Ex: 3,20",
    unit: "kg",
  },
  {
    key: "bodyAge",
    label: "Idade Corporal (anos)",
    type: "int",
    active: true,
    placeholder: "Ex: 30",
    unit: "a",
  },
];

function createEmptyHealthDb() {
  return {
    age: null,
    height: null,
    gender: null,
    weighIns: [],
    metricsOrder: JSON.parse(JSON.stringify(DEFAULT_METRICS_ORDER)),
    workouts: [],
    strengthRoutines: [],
  };
}

// Garante o formato esperado (aceita bancos antigos sem workouts/metricsOrder).
function normalizeHealthDb(db) {
  if (!db || typeof db !== "object" || Array.isArray(db)) {
    throw new Error("Formato de banco inválido");
  }
  if (!Array.isArray(db.weighIns)) db.weighIns = [];
  if (!Array.isArray(db.workouts)) db.workouts = [];
  if (!Array.isArray(db.strengthRoutines)) db.strengthRoutines = [];
  if (!Array.isArray(db.metricsOrder)) {
    db.metricsOrder = JSON.parse(JSON.stringify(DEFAULT_METRICS_ORDER));
  }
  // O IMC deixou de ser uma métrica da balança.
  db.metricsOrder = db.metricsOrder.filter((m) => m.key !== "bmi");
  return db;
}

function loadHealthDb() {
  const raw = localStorage.getItem(HEALTH_KEY);
  if (raw === null) {
    isHealthDbLoaded = true;
    return createEmptyHealthDb();
  }
  // Cópia de segurança única, feita antes da primeira gravação da versão
  // reorganizada (não é tocada depois disso).
  if (localStorage.getItem(HEALTH_KEY + "_PRE_REFACTOR_BACKUP") === null) {
    try {
      localStorage.setItem(HEALTH_KEY + "_PRE_REFACTOR_BACKUP", raw);
    } catch (err) {
      console.warn("Não foi possível criar a cópia de segurança:", err);
    }
  }
  try {
    const parsed = normalizeHealthDb(JSON.parse(raw));
    // Só vira auto-backup depois de confirmar que o dado é legível.
    try {
      localStorage.setItem(HEALTH_BACKUP_KEY, raw);
    } catch (backupErr) {
      console.warn("Aviso ao salvar auto-backup inicial:", backupErr);
    }
    isHealthDbLoaded = true;
    return parsed;
  } catch (err) {
    // Dado ilegível: guarda o texto original para recuperação manual e NÃO
    // libera gravação (isHealthDbLoaded fica false), senão a próxima pesagem
    // sobrescreveria o original com um banco vazio.
    console.error("Banco do Toba Health ilegível:", err);
    saveCorruptHealthCopy(raw);
    return createEmptyHealthDb();
  }
}

// Uma cópia por conteúdo: como a gravação fica travada, o mesmo texto ruim
// seria copiado de novo a cada abertura e encheria a memória do navegador.
function saveCorruptHealthCopy(raw) {
  const prefix = HEALTH_KEY + "_CORRUPT_";
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && localStorage.getItem(key) === raw)
      return;
  }
  try {
    localStorage.setItem(prefix + Date.now(), raw);
  } catch (e) { /* sem espaço: segue sem a cópia */ }
}

let healthDb = loadHealthDb();

function saveHealthDb() {
  if (!isHealthDbLoaded) {
    console.warn("Gravação bloqueada: o banco do Toba Health não foi lido com segurança.");
    showHealthDbLockedMessage();
    return;
  }

  // O backup é melhor esforço: se ele falhar (por exemplo, por quota),
  // ainda tentamos gravar o banco atual na chave principal.
  try {
    const currentStored = localStorage.getItem(HEALTH_KEY);
    if (currentStored) localStorage.setItem(HEALTH_BACKUP_KEY, currentStored);
  } catch (backupErr) {
    console.warn("Aviso ao atualizar auto-backup:", backupErr);
  }

  try {
    localStorage.setItem(HEALTH_KEY, JSON.stringify(healthDb));
  } catch (err) {
    console.error("Erro ao gravar no localStorage:", err);
    showPageMessage("Não consegui salvar os dados neste aparelho. Exporte um backup e libere espaço no navegador.", { title: "Não salvou", icon: "💥" });
    return;
  }
  tobaSaved();
}

function showHealthDbLockedMessage() {
  showPageMessage(
    "Não consegui ler os dados salvos do Toba Health, então nada novo será gravado para não apagar o original. Restaure um backup em ⚙️ → Dados & Backup → Restaurar (ou use Apagar tudo para começar do zero).",
    { title: "Dados protegidos", icon: "🛡️" },
  );
}

// As páginas sobrescrevem esta função para redesenhar a própria tela.
function onHealthDataReplaced() {}

// Backup do Toba Health tem pelo menos uma das listas do banco. Barra o
// backup do Bank e o backup geral do portal, que seriam aceitos como um
// banco "vazio" e apagariam todas as pesagens e treinos.
function looksLikeHealthBackup(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (Array.isArray(data.weighIns) ||
      Array.isArray(data.workouts) ||
      Array.isArray(data.metricsOrder)),
  );
}


function exportHealthBackup() {
  // Exporta o objeto completo, incluindo perfil, pesagens e configuração
  // da balança, para que a restauração possa reconstruir o estado.
  tobaDownloadJson(healthDb, `toba_health_backup_${toIsoDate()}.json`);
}

async function importHealthBackup(text) {
  try {
    // O parse só confirma que é JSON; normalizeHealthDb garante os campos
    // que o app espera encontrar.
    const imported = JSON.parse(text);
    if (!looksLikeHealthBackup(imported)) throw new Error("Não é backup do Toba Health");
    healthDb = normalizeHealthDb(imported);
  } catch (err) {
    showPageMessage("Não consegui ler esse arquivo. Confira se ele é um backup do Toba Health (não do Bank nem o backup geral).", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  isHealthDbLoaded = true;
  saveHealthDb();
  closeDataModal();
  onHealthDataReplaced();
  showPageMessage("Backup restaurado com sucesso! (⌐■_■)", { title: "Tudo de volta", icon: "✅" });
}

async function clearHealthData() {
  const confirmed = await showPageMessage(
    "Isso apaga TUDO do Toba Health (pesagens, treinos e perfil). Não dá para desfazer!",
    { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" },
  );
  if (!confirmed) return;
  // Limpa somente a chave deste módulo, sem afetar os demais aplicativos.
  localStorage.removeItem(HEALTH_KEY);
  healthDb = createEmptyHealthDb();
  isHealthDbLoaded = true;
  closeDataModal();
  onHealthDataReplaced();
  showPageMessage("Tudo limpo e zerado! ( ͡° ͜ʖ ͡°)", { title: "Banco zerado", icon: "🧹" });
}

tobaSetupApp({
  name: "Toba Health",
  exportBackup: exportHealthBackup,
  importBackup: importHealthBackup,
  resetData: clearHealthData,
});

if (!isHealthDbLoaded) showHealthDbLockedMessage();
