/* =====================================================================
 * Toba Bank · núcleo compartilhado (Gastos + Investimentos + Raxador)
 * - Depende de ../assets/toba-common.js (datas, dinheiro, avisos, ⚙️).
 * - Banco único no localStorage ("TOBA_BANK_DB"). NÃO mude a chave nem o
 *   formato sem manter importação/exportação compatíveis.
 * - Cada página define onBankDataSaved() para redesenhar a própria tela
 *   depois de cada gravação.
 * ===================================================================== */
const STORAGE_KEY = "TOBA_BANK_DB";

const BACKUP_KEY = "TOBA_BANK_DB_AUTO_BACKUP";

let isDbLoaded = false;

let db = {
  version: 29,
  config: {
    startDate: toIsoDate(),
    fixedExpenses: [],
  },
  months: {},
  transactions: [],
  installments: [],
  investmentFunds: [],
  splitterGroups: [],
};

function loadDatabase() {
  const data = localStorage.getItem(STORAGE_KEY);
  // Cópia de segurança única, feita antes da primeira gravação da versão
  // reorganizada do app (nunca é sobrescrita depois).
  if (data && localStorage.getItem(STORAGE_KEY + "_PRE_REFACTOR_BACKUP") === null) {
    try {
      localStorage.setItem(STORAGE_KEY + "_PRE_REFACTOR_BACKUP", data);
    } catch (err) {
      console.warn("Não foi possível criar a cópia de segurança:", err);
    }
  }
  if (data) {
    try {
      // Só atualiza o auto-backup depois de confirmar que o dado principal
      // é JSON válido e que a migração conseguiu preparar sua estrutura.
      const parsed = JSON.parse(data);

      if (!parsed.transactions) parsed.transactions = [];
      if (!parsed.installments) parsed.installments = [];
      if (!parsed.config)
        parsed.config = {
          startDate: toIsoDate(),
          fixedExpenses: [],
        };
      if (!parsed.months) parsed.months = {};
      if (!parsed.investmentFunds) parsed.investmentFunds = [];
      if (!parsed.splitterGroups) parsed.splitterGroups = [];

      if (parsed.config.fixedTotal && !parsed.config.fixedExpenses) {
        parsed.config.fixedExpenses = [];
        if (parsed.config.fixedTotal > 0) {
          parsed.config.fixedExpenses.push({
            id: Date.now().toString(),
            name: "Gastos Legado (Atualize)",
            amount: parsed.config.fixedTotal,
            category: "outros",
          });
        }
      }
      if (!parsed.config.fixedExpenses) parsed.config.fixedExpenses = [];

      // v1.35: categorias antigas -> códigos novos (ver BANK_CATEGORY_MIGRATION).
      // Antes da 1ª troca guarda uma cópia única do banco como estava.
      if (migrateBankCategories(parsed) > 0 && localStorage.getItem(STORAGE_KEY + "_PRE_CATEGORIES_BACKUP") === null) {
        try {
          localStorage.setItem(STORAGE_KEY + "_PRE_CATEGORIES_BACKUP", data);
        } catch (err) {
          console.warn("Não foi possível criar a cópia antes das categorias novas:", err);
        }
      }

      parsed.investmentFunds.forEach((f) => {
        if (f.isFinished === undefined) f.isFinished = false;
        if (f.irAmount === undefined) f.irAmount = 0;
        if (!f.withdrawals) f.withdrawals = [];
        if (!f.deposits) f.deposits = [];
        if (!f.balanceLogs) f.balanceLogs = [];
        if (f.isCofrinho === undefined) f.isCofrinho = false;
      });

      parsed.splitterGroups.forEach((g) => {
        if (g.isFinished === undefined) g.isFinished = false;
        if (!g.expenses) g.expenses = [];
        if (!g.members) g.members = [];
      });

      if (
        parsed.config.startDate &&
        parsed.config.startDate.includes("/")
      ) {
        const [d, m, y] = parsed.config.startDate.split("/");
        parsed.config.startDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      parsed.version = 29;

      try {
        localStorage.setItem(BACKUP_KEY, data);
      } catch (backupErr) {
        console.warn("Aviso ao salvar auto-backup inicial:", backupErr);
      }

      db = parsed;
      isDbLoaded = true;
    } catch (e) {
      console.error("Erro crítico ao carregar banco de dados:", e);
      showPageMessage(
        "Houve um erro ao ler seus dados salvos. Nada foi sobrescrito, para proteger suas informações. Restaure um backup em ⚙️ → Dados & Backup.",
        { title: "Dados protegidos", icon: "🛡️" },
      );
    }
  } else {
    isDbLoaded = true;
    saveDatabase({ silent: true });
  }
}

// options.silent: grava sem mostrar o "Salvo ✓" (gravações automáticas).
// Devolve true se gravou (os gastos lidos do app Android só saem da fila assim).
function saveDatabase(options = {}) {
  if (!isDbLoaded) {
    console.warn(
      "Gravação bloqueada: O banco de dados ainda não foi carregado com segurança.",
    );
    return false;
  }

  // O backup é melhor esforço: se ele falhar (por exemplo, por quota),
  // ainda tentamos persistir o banco atual em sua chave principal.
  try {
    const currentStored = localStorage.getItem(STORAGE_KEY);
    if (currentStored) {
      localStorage.setItem(BACKUP_KEY, currentStored);
    }
  } catch (backupErr) {
    console.warn("Aviso ao atualizar auto-backup:", backupErr);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    // Sem esse aviso o app parecia ter salvo, e a mudança sumia ao recarregar.
    console.error("Erro ao gravar dados no localStorage:", err);
    showPageMessage(
      "Não consegui salvar neste aparelho (memória do navegador cheia?). Baixe um backup em ⚙️ → Dados & Backup antes de continuar.",
      { title: "Não salvou", icon: "💥" },
    );
    onBankDataSaved();
    return false;
  }

  if (!options.silent) tobaSaved();
  onBankDataSaved();
  return true;
}

function exportBankBackup() {
  tobaDownloadJson(db, `toba_bank_backup_${toIsoDate()}.json`);
}

// Backup do Bank tem "version" ou a lista de gastos. Grava direto e
// recarrega: o loadDatabase() da próxima abertura completa os campos que
// faltarem (toda migração mora lá).
async function importBankBackup(text) {
  let importedDb;
  try {
    importedDb = JSON.parse(text);
  } catch (err) {
    await showPageMessage("Esse arquivo não é um JSON válido.", { title: "Arquivo ilegível", icon: "😵" });
    return;
  }
  if (
    !importedDb ||
    typeof importedDb !== "object" ||
    Array.isArray(importedDb) ||
    !(importedDb.version || Array.isArray(importedDb.transactions))
  ) {
    await showPageMessage("Esse arquivo não é um backup do Toba Bank.", { title: "Backup inválido", icon: "🤨" });
    return;
  }
  try {
    const currentStored = localStorage.getItem(STORAGE_KEY);
    // Banco ilegível não substitui o último auto-backup bom.
    if (currentStored) {
      JSON.parse(currentStored);
      localStorage.setItem(BACKUP_KEY, currentStored);
    }
  } catch (backupErr) {
    console.warn("Aviso ao atualizar auto-backup:", backupErr);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(importedDb));
  } catch (saveErr) {
    await showPageMessage("Não consegui gravar o backup neste aparelho (memória cheia?).", { title: "Não salvou", icon: "💥" });
    return;
  }
  await showPageMessage("Backup restaurado! A página vai recarregar.", { title: "Tudo de volta", icon: "✅" });
  location.reload();
}

async function resetBankData() {
  const confirmed = await showPageMessage(
    "Isso apaga TODOS os dados do Toba Bank (gastos, investimentos e rachas). Não dá para desfazer!",
    { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" },
  );
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* ---------------------------------------------------------------------
 * Categorias do Gastos (desde v1.35). O banco grava só o `id`; nome e
 * emoji vêm daqui. Nunca troque nem remova um `id` (vira gasto órfão):
 * para renomear, mude só `name`/`short`. `short` é o nome do botão da
 * gaveta (cabe em 360px); `name` aparece no gráfico e nas listas.
 * ------------------------------------------------------------------- */
const BANK_CATEGORY_GROUPS = [
  { label: "🏡 Casa", items: [
    { id: "moradia", emoji: "🏠", name: "Moradia" },
    { id: "contas", emoji: "💡", name: "Contas da casa", short: "Contas" },
    { id: "casa", emoji: "🛋️", name: "Casa & reparos", short: "Casa" },
  ] },
  { label: "🍔 Comida & rolê", items: [
    { id: "mercado", emoji: "🛒", name: "Mercado / Feira", short: "Mercado" },
    { id: "comida", emoji: "🍔", name: "Comida fora" },
    { id: "role", emoji: "🎉", name: "Rolês & bares" },
  ] },
  { label: "🎮 Lazer", items: [
    { id: "viagens", emoji: "✈️", name: "Viagens" },
    { id: "assinaturas", emoji: "📺", name: "Assinaturas" },
    { id: "games", emoji: "🎮", name: "Games" },
  ] },
  { label: "🚗 Transporte", items: [
    { id: "combustivel", emoji: "⛽", name: "Combustível" },
    { id: "uber", emoji: "🚕", name: "Uber / Estacionamento", short: "Uber / Estac." },
    { id: "carro", emoji: "🔧", name: "Carro" },
  ] },
  { label: "🧍 Você", items: [
    { id: "saude", emoji: "💊", name: "Saúde" },
    { id: "pets", emoji: "🐱", name: "Pets" },
    { id: "cuidados", emoji: "🧴", name: "Cuidados" },
    { id: "roupas", emoji: "👕", name: "Roupas" },
    { id: "estudos", emoji: "📚", name: "Estudos" },
    { id: "presentes", emoji: "🎁", name: "Presentes" },
  ] },
  { label: "📦 Resto", items: [
    { id: "taxas", emoji: "💸", name: "Taxas & juros" },
    { id: "investimentos", emoji: "📈", name: "Investimentos" },
    { id: "outros", emoji: "📦", name: "Outros" },
  ] },
];

const BANK_CATEGORIES = {};
BANK_CATEGORY_GROUPS.forEach((g) => g.items.forEach((c) => (BANK_CATEGORIES[c.id] = c)));

// Texto gravado até a v1.34 (value do antigo <select>) -> id novo.
// Fica aqui de vez: backup antigo importado passa pelo load e é convertido.
const BANK_CATEGORY_MIGRATION = {
  "Moradia - Aluguel/Condomínio": "moradia",
  "Moradia - Contas Básicas (Luz/Água/Internet)": "contas",
  "Moradia - Manutenção/Eletro": "casa",
  "Mercado": "mercado",
  "Alimentação": "comida",
  "Lazer": "role",
  "Viagens": "viagens",
  "Presentes": "presentes",
  "Assinaturas": "assinaturas",
  "Games": "games",
  "Transporte - Combustível": "combustivel",
  "Transporte - Uber/App": "uber",
  "Transporte - Manutenção/IPVA": "carro",
  "Saúde & Bem-Estar": "saude",
  "Pet": "pets",
  "Cuidados Pessoais": "cuidados",
  "Vestuário": "roupas",
  "Educação": "estudos",
  "Investimentos & Pessoal": "investimentos",
  "Outros": "outros",
};

// Troca a categoria antiga pelo id novo em gastos, parcelados, fixos e nas
// cópias de fixos dos meses. Texto desconhecido vira "outros" mas fica
// guardado em `oldCategory`. Idempotente: id novo não é tocado.
// Devolve quantos itens mudaram.
function migrateBankCategories(parsed) {
  let changed = 0;
  const fix = (item) => {
    if (!item || typeof item !== "object" || BANK_CATEGORIES[item.category]) return;
    const old = item.category;
    const mapped = BANK_CATEGORY_MIGRATION[typeof old === "string" ? old.trim() : ""];
    item.category = mapped || "outros";
    if (old && typeof old === "string" && item.oldCategory === undefined) item.oldCategory = old;
    changed++;
  };
  (parsed.transactions || []).forEach(fix);
  (parsed.installments || []).forEach(fix);
  ((parsed.config && parsed.config.fixedExpenses) || []).forEach(fix);
  Object.values(parsed.months || {}).forEach((m) => {
    if (m && Array.isArray(m.fixedExpensesSnapshot)) m.fixedExpensesSnapshot.forEach(fix);
  });
  return changed;
}

function getBankCategory(id) {
  return BANK_CATEGORIES[id] || BANK_CATEGORIES.outros;
}

// "🛒 Mercado / Feira" (gráfico, listas). Texto que não é id (banco ainda
// não migrado) aparece como antes: sem o grupo ("Moradia - Aluguel" -> "Aluguel").
function getCleanCategory(category) {
  if (!category) return "📦 Outros";
  const cat = BANK_CATEGORIES[category];
  if (cat) return `${cat.emoji} ${cat.name}`;
  return category.includes(" - ") ? category.split(" - ")[1] : category;
}

// As páginas sobrescrevem esta função para redesenhar a própria tela.
function onBankDataSaved() {}

tobaSetupApp({
  name: "Toba Bank",
  exportBackup: exportBankBackup,
  importBackup: importBankBackup,
  resetData: resetBankData,
});
