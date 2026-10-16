/* =====================================================================
 * Toba Bank · núcleo compartilhado (Gastos + Investimentos + Raxador)
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
    startDate: getTodayIsoDateStr(),
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
          startDate: getTodayIsoDateStr(),
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
            category: "Outros",
          });
        }
      }
      if (!parsed.config.fixedExpenses) parsed.config.fixedExpenses = [];

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
      alert(
        "⚠️ Atenção: Houve um erro ao ler seus dados salvos. O banco não foi sobrescrito para proteger suas informações.",
      );
    }
  } else {
    isDbLoaded = true;
    saveDatabase();
  }
}

function saveDatabase() {
  if (!isDbLoaded) {
    console.warn(
      "Gravação bloqueada: O banco de dados ainda não foi carregado com segurança.",
    );
    return;
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
    alert(
      "⚠️ Não consegui salvar neste aparelho (memória do navegador cheia?). Baixe um backup em ⚙️ → Dados & Backup antes de continuar.",
    );
  }

  onBankDataSaved();
}

function exportBackup() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(db, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `toba_bank_backup_${getTodayIsoDateStr()}.json`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedDb = JSON.parse(e.target.result);
      if (
        importedDb &&
        typeof importedDb === "object" &&
        !Array.isArray(importedDb) &&
        (importedDb.version || Array.isArray(importedDb.transactions))
      ) {
        // Grava direto e recarrega: o loadDatabase() da próxima abertura
        // completa os campos que faltarem. Redesenhar a tela aqui, com o
        // backup ainda sem normalizar, podia travar antes do reload.
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
          alert("❌ Não consegui gravar o backup neste aparelho (memória cheia?).");
          return;
        }
        alert("✅ Backup restaurado com sucesso!");
        location.reload();
      } else {
        alert("❌ Arquivo de backup inválido.");
      }
    } catch (err) {
      alert("❌ Erro ao ler o arquivo JSON.");
    }
  };
  reader.readAsText(file);
  // Permite escolher o mesmo arquivo de novo depois de um erro.
  event.target.value = "";
}

function resetAllData() {
  if (
    confirm(
      "🚨 Tem certeza que deseja apagar TODOS os dados do Toba Bank? Esta ação não pode ser desfeita!",
    )
  ) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

function getMoney(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  let val = el.value;
  if (!val) return 0;

  if (el.classList.contains("smart-money")) {
    val = val.replace(/\./g, "").replace(",", ".");
    return parseFloat(val) || 0;
  }

  val = val.toString().trim();
  if (val.includes(",") && val.includes(".")) {
    if (val.indexOf(",") > val.indexOf(".")) {
      val = val.replace(/\./g, "").replace(",", ".");
    } else {
      val = val.replace(/,/g, "");
    }
  } else {
    val = val.replace(",", ".");
  }
  return parseFloat(val) || 0;
}

function formatMoneyInput(value) {
  if (value === null || value === undefined || isNaN(value)) return "";
  return parseFloat(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(val) {
  return (val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Todo texto digitado pelo usuário (descrição, nome, participante) passa por
// aqui antes de entrar num innerHTML: "Pizza <b>" aparece como texto.
function escapeBankHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

// Categoria sem o grupo ("Moradia - Aluguel" -> "Aluguel"); tolera gasto
// antigo sem categoria.
function getCleanCategory(category) {
  if (!category) return "Outros";
  return category.includes(" - ") ? category.split(" - ")[1] : category;
}

function isoToBrDate(isoStr) {
  if (!isoStr || !isoStr.includes("-")) return isoStr || "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatMonthYearLabel(yearStr, monthIndex) {
  const date = new Date(yearStr, monthIndex, 1);
  const rawMonthName = date.toLocaleDateString("pt-BR", {
    month: "long",
  });
  const capitalizedMonth =
    rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
  const shortYear = String(yearStr).slice(-2);
  return `${capitalizedMonth}/${shortYear}`;
}

function getCurrentMonthKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getTodayIsoDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// As páginas sobrescrevem esta função para redesenhar a própria tela.
function onBankDataSaved() {}

/* MODAL COMPARTILHADO: Dados & Backup */
const DATA_MODAL_HTML = `
<div class="modal-overlay" id="dataModal">
  <div class="modal">
    <div class="modal-header">
      <h3>💾 Dados & Backup</h3>
      <button class="close-btn" onclick="closeDataModal()">&times;</button>
    </div>

    <div class="form-group">
      <label>Backups</label>
      <div style="display: flex; gap: 10px">
        <button class="btn btn-secondary" onclick="exportBackup()">📥 Baixar Backup</button>
        <button class="btn btn-secondary" onclick="document.getElementById('importFileInput').click()">📤 Restaurar</button>
      </div>
      <input type="file" id="importFileInput" accept=".json" style="display: none" onchange="importBackup(event)" />
    </div>

    <div class="form-group" style="margin-top: 1.5rem">
      <label style="color: #f85149">Zona de Perigo</label>
      <button class="btn btn-danger" onclick="resetAllData()">🗑️ Zerar Todos os Dados</button>
    </div>

    <div style="margin-top: 1.5rem; border-top: 1px solid #30363d; padding-top: 1rem">
      <button class="btn btn-secondary" onclick="closeDataModal()">Fechar</button>
    </div>
  </div>
</div>`;

function openDataModal() {
  document.getElementById("dataModal").classList.add("active");
}

function closeDataModal() {
  document.getElementById("dataModal").classList.remove("active");
}

// Máscara dos campos de dinheiro (classe "smart-money")
function setupCoreEvents() {
  document.body.insertAdjacentHTML("beforeend", DATA_MODAL_HTML);
  document.addEventListener("input", function (e) {
    if (e.target.classList.contains("smart-money")) {
      let val = e.target.value.replace(/\D/g, "");
      if (val === "") {
        e.target.value = "";
        return;
      }
      let num = parseInt(val, 10) / 100;
      e.target.value = num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  });
}
