/* =====================================================================
 * Toba Racing · núcleo do app (desde v1.51)
 * - Depende de ../assets/toba-common.js e de racing-metrics.js (regras).
 * - Banco único no localStorage: "TOBA_RACING_DB". Depois de publicado,
 *   NUNCA mude a chave nem renomeie campos (ver CLAUDE.md, seção 3.12).
 * - Cada página define onRacingDataReplaced() para redesenhar a tela
 *   depois de importar backup ou apagar tudo.
 * ===================================================================== */
const RACING_KEY = "TOBA_RACING_DB";
const RACING_BACKUP_KEY = "TOBA_RACING_DB_AUTO_BACKUP";

// Trava: fica false se o banco salvo estiver ilegível, para não sobrescrever.
let isRacingDbLoaded = false;

function createEmptyRacingDb() {
  return {
    version: 1,
    car: { name: "", tank: null }, // tank: litros do tanque (opcional, dá a autonomia)
    fuelings: [], // [{ id: "f-<ts>-<rand4>", date: "AAAA-MM-DD", odometer (km), liters, price (R$/l), total (R$),
    //               fuel: key de RACING_FUELS, full: bool, missed: bool, note, createdAt: ms }]
  };
}

// "Migração": todo campo novo ganha default AQUI (load e import passam por ela).
function normalizeRacingDb(db) {
  const base = createEmptyRacingDb();
  const out = { ...base, ...(db && typeof db === "object" && !Array.isArray(db) ? db : {}) };
  const car = out.car && typeof out.car === "object" && !Array.isArray(out.car) ? out.car : {};
  out.car = { ...car, name: String(car.name || ""), tank: Number(car.tank) > 0 ? Number(car.tank) : null };
  out.fuelings = Array.isArray(out.fuelings) ? out.fuelings.filter((f) => f && typeof f === "object") : [];
  out.fuelings.forEach((f) => {
    if (f.fuel === undefined) f.fuel = RACING_FUELS[0].key;
    if (f.full === undefined) f.full = true;
    if (f.missed === undefined) f.missed = false;
    if (f.note === undefined) f.note = "";
  });
  return out;
}

function loadRacingDb() {
  const raw = localStorage.getItem(RACING_KEY);
  if (!raw) {
    isRacingDbLoaded = true;
    return createEmptyRacingDb();
  }
  try {
    const db = normalizeRacingDb(JSON.parse(raw));
    isRacingDbLoaded = true;
    return db;
  } catch (err) {
    console.error("Banco do Racing ilegível; gravação travada.", err);
    return createEmptyRacingDb();
  }
}

let racingDb = loadRacingDb();

function saveRacingDb(options = {}) {
  if (!isRacingDbLoaded) {
    showPageMessage("Os dados salvos do Racing estão ilegíveis, então nada foi gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
    return false;
  }
  try {
    const previous = localStorage.getItem(RACING_KEY);
    if (previous) localStorage.setItem(RACING_BACKUP_KEY, previous);
    localStorage.setItem(RACING_KEY, JSON.stringify(racingDb));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (!options.silent) tobaSaved();
  return true;
}

function racingNewId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/* 🚗 Meu carro (⚙️): nome e tamanho do tanque */
const RACING_CAR_SHEET_HTML = `
  <div class="toba-modal" id="carSheet">
    <div class="toba-sheet">
      <div class="toba-sheet-header">
        <h3>🚗 Meu carro</h3>
        <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
      </div>
      <form data-submit="saveCar">
        <div class="form-group">
          <label for="carName">Apelido da nave</label>
          <input type="text" id="carName" class="form-control" maxlength="40" placeholder="Ex: Relâmpago Marquinhos" />
        </div>
        <div class="form-group">
          <label for="carTank">Tanque (litros)</label>
          <input type="text" inputmode="numeric" id="carTank" class="form-control toba-mask-int" placeholder="Ex: 50" />
        </div>
        <p class="toba-sheet-text">Com o tanque, o Toba calcula a autonomia: quantos km dá pra rodar com ele cheio na sua média.</p>
        <div class="toba-sheet-footer">
          <button type="submit" class="btn btn-primary">Salvar 🏁</button>
        </div>
      </form>
    </div>
  </div>`;

function racingSettingsExtraHtml() {
  return `
    <div class="toba-settings-section">
      <div class="toba-settings-label">🏁 Racing</div>
      <div class="toba-menu">
        <button type="button" class="toba-menu-btn" data-click="openCarSheet">
          <span class="toba-menu-icon">🚗</span>
          <span class="toba-menu-text">
            <span class="toba-menu-title">Meu carro</span>
            <span class="toba-menu-desc">Apelido e litros do tanque</span>
          </span>
          <span class="toba-hub-chevron">›</span>
        </button>
      </div>
    </div>`;
}

function openCarSheet() {
  if (!document.getElementById("carSheet")) {
    document.body.insertAdjacentHTML("beforeend", RACING_CAR_SHEET_HTML);
    initTobaDecimalMasks();
  }
  document.getElementById("carName").value = racingDb.car.name || "";
  document.getElementById("carTank").value = racingDb.car.tank ? String(racingDb.car.tank) : "";
  openTobaModal("carSheet");
}

function saveCar() {
  const tank = parseInt(document.getElementById("carTank").value, 10);
  racingDb.car = {
    ...racingDb.car,
    name: document.getElementById("carName").value.trim(),
    tank: tank > 0 ? tank : null,
  };
  if (!saveRacingDb()) return;
  closeTobaModal("carSheet");
  onRacingDataReplaced();
}

function onRacingDataReplaced() {}

/* Backup do app (objeto do banco puro; não confundir com o backup geral) */
function exportRacingBackup() {
  tobaDownloadJson(racingDb, `toba_racing_backup_${toIsoDate()}.json`);
}

async function importRacingBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!data || typeof data !== "object" || !Array.isArray(data.fuelings)) throw new Error("Não é backup do Racing");
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Toba Racing.", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  racingDb = normalizeRacingDb(data);
  isRacingDbLoaded = true;
  saveRacingDb({ silent: true });
  closeDataModal();
  onRacingDataReplaced();
  showPageMessage("Backup restaurado!", { title: "Tudo de volta", icon: "✅" });
}

async function resetRacingData() {
  const ok = await showPageMessage("Apaga TUDO do Toba Racing (abastecimentos e carro). Não dá para desfazer!", { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" });
  if (!ok) return;
  localStorage.removeItem(RACING_KEY); // só a chave deste app
  racingDb = createEmptyRacingDb();
  isRacingDbLoaded = true;
  closeDataModal();
  onRacingDataReplaced();
}

tobaSetupApp({
  name: "Toba Racing",
  exportBackup: exportRacingBackup,
  importBackup: importRacingBackup,
  resetData: resetRacingData,
});

tobaActions({
  openCarSheet,
  saveCar,
});

// Itens do app na ⚙️ (todas as páginas do Racing)
(function addRacingSettings() {
  let box = document.getElementById("tobaSettingsExtra");
  if (!box) {
    box = document.createElement("div");
    box.id = "tobaSettingsExtra";
    box.hidden = true;
    document.body.appendChild(box);
  }
  box.insertAdjacentHTML("beforeend", racingSettingsExtraHtml());
})();

if (!isRacingDbLoaded) {
  showPageMessage("Não consegui ler os dados salvos, então nada será gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
}
