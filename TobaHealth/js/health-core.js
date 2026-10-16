/* =====================================================================
 * Toba Health · núcleo compartilhado (Pesagem + Treinos)
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

function getLocalDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

/* MÁSCARAS TOBA BANK */
function initTobaDecimalMasks() {
  const inputsDec = document.querySelectorAll(
    ".toba-mask-dec1, .toba-mask-dec2",
  );
  inputsDec.forEach((input) => {
    input.setAttribute("inputmode", "decimal");

    input.addEventListener("input", (e) => {
      // A máscara trata os dígitos como centavos/décimos e só então
      // adiciona a vírgula, evitando depender do separador do teclado.
      let digits = e.target.value.replace(/\D/g, "");
      if (!digits) {
        e.target.value = "";
        return;
      }

      let isDec1 = e.target.classList.contains("toba-mask-dec1");
      let divisor = isDec1 ? 10 : 100;
      e.target.value = (parseInt(digits, 10) / divisor)
        .toFixed(isDec1 ? 1 : 2)
        .replace(".", ",");

      if (e.inputType === "insertText" && e.data && !isNaN(e.data)) {
        let limit = isDec1 ? 3 : 4;
        if (digits.length >= limit) {
          const formInputs = Array.from(
            e.target
              .closest("form")
              .querySelectorAll('input:not([type="hidden"])'),
          );
          const nextIndex = formInputs.indexOf(e.target) + 1;
          if (formInputs[nextIndex]) formInputs[nextIndex].focus();
        }
      }
    });
  });
}

function parseTobaDecimal(valStr) {
  if (!valStr) return null;
  let parsed = parseFloat(valStr.toString().replace(",", "."));
  return isNaN(parsed) ? null : parsed;
}

function formatDec1(num) {
  return num === null || num === undefined
    ? "--"
    : num.toFixed(1).replace(".", ",");
}

function formatDec2(num) {
  return num === null || num === undefined
    ? "--"
    : num.toFixed(2).replace(".", ",");
}

let pageMessageReturnId = null;

let pageMessageResolver = null;

function showPageMessage(message, options = {}) {
  const activePage = document.querySelector(".modal-overlay.active, .popup-overlay.active");
  pageMessageReturnId = activePage?.id || null;
  activePage?.classList.remove("active");
  document.getElementById("pageMessageTitle").innerText = options.title || "Toba Health";
  document.getElementById("pageMessageText").innerText = message;
  const isConfirm = Boolean(options.confirm);
  document.getElementById("pageMessageCancel").style.display = isConfirm ? "block" : "none";
  document.getElementById("pageMessageConfirm").style.display = isConfirm ? "block" : "none";
  document.getElementById("pageMessageOk").style.display = isConfirm ? "none" : "block";
  document.getElementById("pageMessageConfirm").innerText = options.confirmLabel || "Confirmar";
  document.getElementById("pageMessageModal").classList.add("active");
  window.scrollTo(0, 0);
  return new Promise((resolve) => { pageMessageResolver = resolve; });
}

function resolvePageMessage(confirmed) {
  document.getElementById("pageMessageModal").classList.remove("active");
  if (pageMessageReturnId) document.getElementById(pageMessageReturnId)?.classList.add("active");
  const resolve = pageMessageResolver;
  pageMessageResolver = null;
  pageMessageReturnId = null;
  resolve?.(confirmed);
}

function exportBackup() {
  // Exporta o objeto completo, incluindo perfil, pesagens e configuração
  // da balança, para que a restauração possa reconstruir o estado.
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(healthDb, null, 2));
  const anchor = document.createElement("a");
  anchor.setAttribute("href", dataStr);
  anchor.setAttribute(
    "download",
    `toba_health_backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

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
    showPageMessage("Não consegui salvar os dados neste aparelho. Exporte um backup e libere espaço no navegador.", { title: "Erro ao salvar" });
  }
}

function showHealthDbLockedMessage() {
  showPageMessage(
    "Não consegui ler os dados salvos do Toba Health, então nada novo será gravado para não apagar o original. Restaure um backup em ⚙️ → Dados & Backup → Importar (ou use Apagar Tudo para começar do zero).",
    { title: "Dados protegidos" },
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


function importBackup(e) {
  const fileReader = new FileReader();
  fileReader.onload = function (event) {
    try {
      // O parse só confirma que é JSON; normalizeHealthDb garante os campos
      // que o app espera encontrar.
      const imported = JSON.parse(event.target.result);
      if (!looksLikeHealthBackup(imported)) throw new Error("Não é backup do Toba Health");
      healthDb = normalizeHealthDb(imported);
      isHealthDbLoaded = true;
      saveHealthDb();
      closeDataModal();
      onHealthDataReplaced();
      showPageMessage("Backup restaurado com sucesso! (⁠⌐⁠■⁠-⁠■⁠)", { title: "Backup restaurado" });
    } catch (err) {
      showPageMessage("Não consegui ler esse arquivo JSON. Confira se ele é um backup válido do Toba Health.", { title: "Arquivo inválido" });
    }
  };
  if (e.target.files[0]) fileReader.readAsText(e.target.files[0]);
  e.target.value = "";
}

async function clearAllData() {
  const confirmed = await showPageMessage(
    "Tem certeza que deseja APAGAR TUDO do Toba Health? Essa ação não pode ser desfeita!",
    { title: "Apagar todos os dados", confirm: true, confirmLabel: "Apagar tudo" },
  );
  if (confirmed) {
    // Limpa somente a chave deste módulo, sem afetar os demais aplicativos.
    localStorage.removeItem(HEALTH_KEY);
    healthDb = createEmptyHealthDb();
    isHealthDbLoaded = true;
    closeDataModal();
    onHealthDataReplaced();
    showPageMessage("Tudo limpo e zerado! ( ͡° 开启 ͡°)", { title: "Banco zerado" });
  }
}

/* MODAIS COMPARTILHADOS (aviso/confirmação e Dados & Backup) */
const SHARED_MODALS_HTML = `
<div class="modal-overlay" id="pageMessageModal" aria-live="polite">
  <div class="modal-body">
    <div class="modal-header">
      <div class="modal-title" id="pageMessageTitle">Toba Health</div>
      <button class="close-btn" onclick="resolvePageMessage(false)" aria-label="Fechar aviso">✖</button>
    </div>
    <p id="pageMessageText" class="page-message-text"></p>
    <div id="pageMessageActions" class="page-message-actions" style="display: flex; gap: 8px; margin-top: 1rem">
      <button type="button" id="pageMessageCancel" class="btn btn-secondary" onclick="resolvePageMessage(false)">Cancelar</button>
      <button type="button" id="pageMessageConfirm" class="btn btn-danger" onclick="resolvePageMessage(true)">Confirmar</button>
      <button type="button" id="pageMessageOk" class="btn" onclick="resolvePageMessage(true)" style="display: none">Entendi</button>
    </div>
  </div>
</div>

<div class="popup-overlay" id="dataModal" onclick="if (event.target === this) closeDataModal()">
  <div class="popup-panel" role="dialog" aria-modal="true" aria-labelledby="dataModalTitle">
    <div class="modal-header">
      <div class="modal-title" id="dataModalTitle">💾 Dados & Backup</div>
      <button class="close-btn" onclick="closeDataModal()">✖</button>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 10px">
      <button class="btn btn-secondary" onclick="exportBackup()">Exportar Backup 📥</button>
      <button class="btn btn-secondary" onclick="document.getElementById('importFileInput').click()">Importar 📤</button>
      <input type="file" id="importFileInput" style="display: none" accept=".json" onchange="importBackup(event)" />
    </div>
    <button class="btn btn-danger" onclick="clearAllData()">⚠️ Apagar Tudo (Reset Total)</button>
  </div>
</div>`;

function openDataModal() {
  document.getElementById("dataModal").classList.add("active");
}

function closeDataModal() {
  document.getElementById("dataModal").classList.remove("active");
}

document.body.insertAdjacentHTML("beforeend", SHARED_MODALS_HTML);

if (!isHealthDbLoaded) showHealthDbLockedMessage();
