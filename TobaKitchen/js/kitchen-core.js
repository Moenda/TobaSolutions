/* =====================================================================
 * Toba Kitchen · núcleo do app (desde v1.43)
 * - Depende de ../assets/toba-common.js e de kitchen-recipes.js (catálogo).
 * - Banco único no localStorage: "TOBA_KITCHEN_DB". Depois de publicado,
 *   NUNCA mude a chave nem renomeie campos (ver CLAUDE.md, seção 3.11).
 * - As receitas NÃO ficam no banco (moram no catálogo); aqui só os ids.
 * - Cada página define onKitchenDataReplaced() para redesenhar a tela
 *   depois de importar backup ou apagar tudo.
 * ===================================================================== */
const KITCHEN_KEY = "TOBA_KITCHEN_DB";
const KITCHEN_BACKUP_KEY = "TOBA_KITCHEN_DB_AUTO_BACKUP";

const KITCHEN_RECENT_MAX = 24; // digitados no Outros lembrados como chip

// Trava: fica false se o banco salvo estiver ilegível, para não sobrescrever.
let isKitchenDbLoaded = false;

function createEmptyKitchenDb() {
  return {
    version: 1,
    cooked: [], // [{ id: "c-<ts>-<rand4>", recipeId, date: "AAAA-MM-DD", doneAt: ms, servings, planId?, improvised? }]
    //            improvised: [id do ingrediente] que faltou e você fez mesmo assim (conquista "Gambiarra gourmet")
    pantry: [], // [ids de ingrediente] marcados em "O que tem aí?"
    plan: [], // [{ id: "p-<ts>-<rand4>", date: "AAAA-MM-DD", recipeId, meal, servings }]
    shopping: {}, // { "<segunda AAAA-MM-DD>": { checked: [ids de ingrediente] } }
    extras: [], // v1.53: itens escolhidos da lista [{ id: "x-<ts>-<rand4>", itemId?, name, aisle, qty, checked, addedAt }] (sem itemId = digitado no Outros)
    extrasRecent: [], // v1.53: digitados no Outros que saíram da lista [{ name, aisle }] (seguem como chip; até 24)
  };
}

// "Migração": todo campo novo ganha default AQUI (load e import passam por ela).
function normalizeKitchenDb(db) {
  const base = createEmptyKitchenDb();
  const out = { ...base, ...(db && typeof db === "object" && !Array.isArray(db) ? db : {}) };
  out.cooked = Array.isArray(out.cooked) ? out.cooked.filter((c) => c && typeof c === "object") : [];
  out.pantry = Array.isArray(out.pantry) ? out.pantry.map(String) : [];
  out.plan = Array.isArray(out.plan) ? out.plan.filter((p) => p && typeof p === "object") : [];
  out.shopping = out.shopping && typeof out.shopping === "object" && !Array.isArray(out.shopping) ? out.shopping : {};
  out.plan.forEach((p) => {
    if (!(Number(p.servings) > 0)) p.servings = (kitchenRecipe(p.recipeId) || { servings: 1 }).servings;
  });
  // v1.53: bancos antigos não têm os avulsos (entrada sem nome não aparece, mas não é apagada)
  out.extras = Array.isArray(out.extras) ? out.extras.filter((x) => x && typeof x === "object") : [];
  out.extras.forEach((x) => {
    x.id = x.id ? String(x.id) : kitchenNewId("x");
    x.name = String(x.name || "");
    if (!x.aisle) x.aisle = "outros";
    x.qty = String(x.qty || "");
    x.checked = x.checked === true;
  });
  out.extrasRecent = Array.isArray(out.extrasRecent)
    ? out.extrasRecent.filter((r) => r && typeof r === "object" && String(r.name || "").trim()).slice(0, KITCHEN_RECENT_MAX)
    : [];
  Object.values(out.shopping).forEach((week) => {
    if (week && typeof week === "object" && !Array.isArray(week.checked)) week.checked = [];
  });
  return out;
}

function loadKitchenDb() {
  const raw = localStorage.getItem(KITCHEN_KEY);
  if (!raw) {
    isKitchenDbLoaded = true;
    return createEmptyKitchenDb();
  }
  try {
    const db = normalizeKitchenDb(JSON.parse(raw));
    isKitchenDbLoaded = true;
    return db;
  } catch (err) {
    console.error("Banco do Kitchen ilegível; gravação travada.", err);
    return createEmptyKitchenDb();
  }
}

let kitchenDb = loadKitchenDb();

function saveKitchenDb(options = {}) {
  if (!isKitchenDbLoaded) {
    showPageMessage("Os dados salvos do Kitchen estão ilegíveis, então nada foi gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
    return false;
  }
  try {
    const previous = localStorage.getItem(KITCHEN_KEY);
    if (previous) localStorage.setItem(KITCHEN_BACKUP_KEY, previous);
    localStorage.setItem(KITCHEN_KEY, JSON.stringify(kitchenDb));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (!options.silent) tobaSaved();
  return true;
}

function kitchenNewId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/* Contador: "fiz essa receita". Volta a entrada gravada (ou null). */
function kitchenMarkCooked(recipeId, options = {}) {
  const recipe = kitchenRecipe(recipeId);
  if (!recipe) return null;
  const entry = {
    id: kitchenNewId("c"),
    recipeId: recipe.id,
    date: toIsoDate(),
    doneAt: Date.now(),
    servings: Number(options.servings) || recipe.servings,
  };
  if (options.planId) entry.planId = String(options.planId);
  if (Array.isArray(options.improvised) && options.improvised.length) entry.improvised = options.improvised.map(String);
  kitchenDb.cooked.push(entry);
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.cooked.pop();
    return null;
  }
  return entry;
}

/* Antes de contar: pelo 🧺, faltou exatamente 1 ingrediente? Pergunta se fez
 * sem ele (vale a conquista "Gambiarra gourmet"). Devolve [id] ou []. */
async function kitchenAskImprovised(recipe) {
  const missing = kitchenOneMissing(kitchenDb, recipe);
  if (!missing) return [];
  const info = kitchenIngredient(missing);
  const yes = await showPageMessage(`Pelo seu 🧺 faltava ${info.art || "o"} ${info.name.toLowerCase()} ${info.emoji}. Fez sem mesmo? 😂`, {
    title: "Gambiarra detectada", icon: "🩹", confirm: true, danger: false, confirmLabel: "Fiz sem! 🩹", cancelLabel: "Não, eu tinha",
  });
  return yes ? [missing] : [];
}

// Depois de contar uma receita: o Perfil do jogador confere as conquistas da cozinha
function kitchenPlayerCheck() {
  if (typeof tobaPlayerCheck === "function") tobaPlayerCheck({ reason: "Rango no capricho 🍳" });
}

function kitchenUndoCooked(id) {
  const before = kitchenDb.cooked.length;
  kitchenDb.cooked = kitchenDb.cooked.filter((c) => String(c.id) !== String(id));
  if (kitchenDb.cooked.length === before) return false;
  return saveKitchenDb();
}

// Frase do contador depois de fazer uma receita
function kitchenCookedQuip(count) {
  if (count === 1) return "Primeira vez dessa! Já é chef de respeito. 👨‍🍳";
  if (count === 5) return "5 vezes! Essa já é receita da casa. 🏠";
  if (count === 10) return "10 vezes?! Abre um restaurante logo. 🍽️";
  return `Essa já saiu ${count} vezes. Nunca foi sorte. 🙏`;
}

function onKitchenDataReplaced() {}

/* Backup do app (objeto do banco puro; não confundir com o backup geral) */
function exportKitchenBackup() {
  tobaDownloadJson(kitchenDb, `toba_kitchen_backup_${toIsoDate()}.json`);
}

async function importKitchenBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!data || typeof data !== "object" || !Array.isArray(data.cooked) || !Array.isArray(data.plan)) throw new Error("Não é backup do Kitchen");
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Toba Kitchen.", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  kitchenDb = normalizeKitchenDb(data);
  isKitchenDbLoaded = true;
  saveKitchenDb({ silent: true });
  closeDataModal();
  onKitchenDataReplaced();
  showPageMessage("Backup restaurado!", { title: "Tudo de volta", icon: "✅" });
}

async function resetKitchenData() {
  const ok = await showPageMessage("Apaga TUDO do Toba Kitchen (contador, programação, despensa e lista de compras). As receitas continuam. Não dá para desfazer!", { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" });
  if (!ok) return;
  localStorage.removeItem(KITCHEN_KEY); // só a chave deste app
  kitchenDb = createEmptyKitchenDb();
  isKitchenDbLoaded = true;
  closeDataModal();
  onKitchenDataReplaced();
}

tobaSetupApp({
  name: "Toba Kitchen",
  exportBackup: exportKitchenBackup,
  importBackup: importKitchenBackup,
  resetData: resetKitchenData,
});

if (!isKitchenDbLoaded) {
  showPageMessage("Não consegui ler os dados salvos, então nada será gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
}
