/* =====================================================================
 * Toba Molde · núcleo do app (troque "Molde"/"MOLDE" pelo nome do app)
 * - Depende de ../assets/toba-common.js (datas, dinheiro, avisos, ⚙️).
 * - Banco único no localStorage: "TOBA_MOLDE_DB". Depois de publicado,
 *   NUNCA mude a chave nem renomeie campos (ver CLAUDE.md, seção 3).
 * - Cada página define onMoldeDataReplaced() para redesenhar a tela
 *   depois de importar backup ou apagar tudo.
 * ===================================================================== */
const MOLDE_KEY = "TOBA_MOLDE_DB";
const MOLDE_BACKUP_KEY = "TOBA_MOLDE_DB_AUTO_BACKUP";

// Trava: fica false se o banco salvo estiver ilegível, para não sobrescrever.
let isMoldeDbLoaded = false;

function createEmptyMoldeDb() {
  return {
    version: 1,
    items: [], // [{ id: string, name, date: "AAAA-MM-DD", done: bool }]
  };
}

// "Migração": todo campo novo ganha default AQUI (load e import passam por ela).
function normalizeMoldeDb(db) {
  const base = createEmptyMoldeDb();
  const out = { ...base, ...(db && typeof db === "object" ? db : {}) };
  out.items = Array.isArray(out.items) ? out.items : [];
  out.items.forEach((item) => {
    if (item.done === undefined) item.done = false;
  });
  return out;
}

function loadMoldeDb() {
  const raw = localStorage.getItem(MOLDE_KEY);
  if (!raw) {
    isMoldeDbLoaded = true;
    return createEmptyMoldeDb();
  }
  try {
    const db = normalizeMoldeDb(JSON.parse(raw));
    isMoldeDbLoaded = true;
    return db;
  } catch (err) {
    console.error("Banco do Molde ilegível; gravação travada.", err);
    return createEmptyMoldeDb();
  }
}

let moldeDb = loadMoldeDb();

function saveMoldeDb(options = {}) {
  if (!isMoldeDbLoaded) return false;
  try {
    const previous = localStorage.getItem(MOLDE_KEY);
    if (previous) localStorage.setItem(MOLDE_BACKUP_KEY, previous);
    localStorage.setItem(MOLDE_KEY, JSON.stringify(moldeDb));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (!options.silent) tobaSaved();
  return true;
}

function onMoldeDataReplaced() {}

/* Backup do app (objeto do banco puro; não confundir com o backup geral) */
function exportMoldeBackup() {
  tobaDownloadJson(moldeDb, `toba_molde_backup_${toIsoDate()}.json`);
}

async function importMoldeBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!data || !Array.isArray(data.items)) throw new Error("Não é backup do Molde");
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Toba Molde.", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  moldeDb = normalizeMoldeDb(data);
  isMoldeDbLoaded = true;
  saveMoldeDb({ silent: true });
  closeDataModal();
  onMoldeDataReplaced();
  showPageMessage("Backup restaurado!", { title: "Tudo de volta", icon: "✅" });
}

async function resetMoldeData() {
  const ok = await showPageMessage("Apaga TUDO do Toba Molde. Não dá para desfazer!", { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" });
  if (!ok) return;
  localStorage.removeItem(MOLDE_KEY); // só a chave deste app
  moldeDb = createEmptyMoldeDb();
  isMoldeDbLoaded = true;
  closeDataModal();
  onMoldeDataReplaced();
}

tobaSetupApp({
  name: "Toba Molde",
  exportBackup: exportMoldeBackup,
  importBackup: importMoldeBackup,
  resetData: resetMoldeData,
});

if (!isMoldeDbLoaded) {
  showPageMessage("Não consegui ler os dados salvos, então nada será gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
}
