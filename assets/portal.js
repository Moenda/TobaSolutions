/* =====================================================================
 * Portal Toba Solutions (index.html)
 * - Depende de toba-common.js e de TobaBank/js/bank-metrics.js (o card do
 *   Bank usa o MESMO cálculo da tela de Gastos: calcBankMonthSummary).
 * - Preferências de UI: "toba_modules_config" (ordem/visibilidade dos
 *   cards) e "toba_bank_card_config" (o que o card do Bank mostra).
 * - Backup GERAL: { "<chave localStorage>": "<valor como TEXTO>" }.
 *   Não mude o formato: backups antigos precisam continuar restaurando.
 * ===================================================================== */
const MODULES_KEY = "toba_modules_config";
const BANK_CARD_KEY = "toba_bank_card_config";

const BANK_CARD_DEFAULTS = {
  type: "personalizado",
  orcamento: true,
  cofre: true,
  gastos: true,
  sobra: true,
  addGasto: true,
  privacy: false,
};

// Cada item guarda a referência do <a> original: reordenar só move o nó.
let portalCards = [];

/* ---------------------------------------------------------------------
 * Ordem e visibilidade dos cards
 * ------------------------------------------------------------------- */
function loadPortalCards() {
  const grid = document.getElementById("modulesGrid");
  portalCards = [...grid.querySelectorAll(".app-card")].map((card) => ({
    id: card.dataset.id,
    title: card.querySelector(".app-title").textContent,
    icon: card.querySelector(".app-icon").textContent,
    visible: true,
    element: card,
  }));

  const saved = localStorage.getItem(MODULES_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    const ordered = [];
    // Aplica a ordem salva aos apps que ainda existem; apps novos vão pro fim.
    parsed.forEach((item) => {
      const found = portalCards.find((c) => c.id === item.id);
      if (found) {
        found.visible = item.visible;
        ordered.push(found);
      }
    });
    portalCards.forEach((c) => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    portalCards = ordered;
  } catch (e) {
    console.error("Erro ao ler a ordem dos apps", e);
  }
}

function savePortalCards() {
  try {
    localStorage.setItem(
      MODULES_KEY,
      JSON.stringify(portalCards.map((c) => ({ id: c.id, visible: c.visible }))),
    );
    tobaSaved();
  } catch (e) {
    showPageMessage("A memória do navegador encheu e a ordem não foi salva.", { title: "Não salvou", icon: "💾" });
  }
}

function applyPortalCards() {
  const grid = document.getElementById("modulesGrid");
  portalCards.forEach((c) => {
    grid.appendChild(c.element);
    c.element.hidden = !c.visible;
  });
}

function renderOrderList() {
  const last = portalCards.length - 1;
  document.getElementById("configList").innerHTML = portalCards
    .map((c, index) => `
      <div class="order-item${c.visible ? "" : " is-hidden"}">
        <span class="order-item-left"><span>${c.icon}</span><span>${escapeHtml(c.title)}</span></span>
        <div class="order-btns">
          <button type="button" class="chip-btn order-toggle${c.visible ? " is-on" : ""}" data-click="toggleModule" data-index="${index}">${c.visible ? "👁️ Visível" : "🙈 Oculto"}</button>
          <button type="button" class="action-icon-btn" data-click="moveModule" data-index="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""} aria-label="Subir">⬆️</button>
          <button type="button" class="action-icon-btn" data-click="moveModule" data-index="${index}" data-dir="1" ${index === last ? "disabled" : ""} aria-label="Descer">⬇️</button>
        </div>
      </div>
    `)
    .join("");
}

function toggleModule(index) {
  portalCards[index].visible = !portalCards[index].visible;
  savePortalCards();
  applyPortalCards();
  renderOrderList();
}

function moveModule(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= portalCards.length) return;
  [portalCards[index], portalCards[target]] = [portalCards[target], portalCards[index]];
  savePortalCards();
  applyPortalCards();
  renderOrderList();
}

/* ---------------------------------------------------------------------
 * Card do Toba Bank
 * ------------------------------------------------------------------- */
function getBankCardConfig() {
  const saved = localStorage.getItem(BANK_CARD_KEY);
  if (saved) {
    try {
      return { ...BANK_CARD_DEFAULTS, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Erro ao ler a configuração do card Toba Bank", e);
    }
  }
  return { ...BANK_CARD_DEFAULTS };
}

function saveBankCardConfig(cfg) {
  try {
    localStorage.setItem(BANK_CARD_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error("Não consegui salvar a configuração do card", e);
  }
  renderBankCard(cfg);
}

// Mesmo cálculo da tela de Gastos, para o card nunca mostrar outro número.
function obterMetricasReaisTobaBank() {
  const vazio = { patrimonio: 0, disponivel: 0, saidas: 0, sobra: 0 };
  const rawData = localStorage.getItem("TOBA_BANK_DB");
  if (!rawData) return vazio;
  let db;
  try {
    db = JSON.parse(rawData);
  } catch (e) {
    console.error("Erro ao ler os dados do Toba Bank", e);
    return vazio;
  }
  if (!db || typeof db !== "object") return vazio;
  const resumo = calcBankMonthSummary(db);
  return {
    disponivel: resumo.todayAvailable,
    patrimonio: resumo.vaultBalance,
    saidas: resumo.totalMonthlySpent,
    sobra: resumo.sobraPrevista,
  };
}

function renderBankCard(cfg) {
  const topAction = document.getElementById("tobaBankCardTopAction");
  const desc = document.getElementById("tobaBankDesc");
  const body = document.getElementById("tobaBankCustomBody");

  if (cfg.type === "simples") {
    desc.hidden = false;
    body.hidden = true;
    topAction.innerHTML = '<span class="badge badge-active">✨ Ativo</span>';
    return;
  }

  desc.hidden = true;
  body.hidden = false;
  topAction.innerHTML = `<span class="eye-toggle-btn" role="button" tabindex="0" data-click="toggleBankPrivacy" aria-label="${cfg.privacy ? "Mostrar valores" : "Esconder valores"}">${cfg.privacy ? "👁️ Mostrar" : "🙈 Esconder"}</span>`;

  const m = obterMetricasReaisTobaBank();
  const money = (val) => (cfg.privacy ? "R$ ***" : formatCurrency(val));
  const color = (val, alwaysRed = false) => (cfg.privacy ? "" : alwaysRed || val < 0 ? "text-red" : "text-green");
  const tile = (label, val, alwaysRed) => `
    <div class="toba-stat">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value ${color(val, alwaysRed)}">${money(val)}</span>
    </div>`;

  let html = "";
  if (cfg.orcamento) html += tile("💵 Livre hoje", m.disponivel);
  if (cfg.cofre) html += tile("💎 Cofre", m.patrimonio);
  if (cfg.gastos) html += tile("🔥 Gastos mês", m.saidas, true);
  if (cfg.sobra) html += tile("🎯 Sobra", m.sobra);
  document.getElementById("tobaBankMetricsGrid").innerHTML = html;
  document.getElementById("tobaBankMetricsGrid").hidden = !html;
  document.getElementById("tobaBankQuickAddBtn").hidden = !cfg.addGasto;
}

function fillBankCardForm(cfg) {
  const isCustom = cfg.type !== "simples";
  document.getElementById("radioPersonalizado").checked = isCustom;
  document.getElementById("radioSimples").checked = !isCustom;
  document.getElementById("radioPersonalizadoLabel").classList.toggle("active", isCustom);
  document.getElementById("radioSimplesLabel").classList.toggle("active", !isCustom);
  document.getElementById("tbCustomDrawer").hidden = !isCustom;
  document.getElementById("chkOrcamento").checked = cfg.orcamento;
  document.getElementById("chkCofre").checked = cfg.cofre;
  document.getElementById("chkGastos").checked = cfg.gastos;
  document.getElementById("chkSobra").checked = cfg.sobra;
  document.getElementById("chkAddGasto").checked = cfg.addGasto;
  document.getElementById("chkPrivacy").checked = cfg.privacy;
}

function updateBankCardConfigFromUI() {
  const cfg = {
    type: document.getElementById("radioPersonalizado").checked ? "personalizado" : "simples",
    orcamento: document.getElementById("chkOrcamento").checked,
    cofre: document.getElementById("chkCofre").checked,
    gastos: document.getElementById("chkGastos").checked,
    sobra: document.getElementById("chkSobra").checked,
    addGasto: document.getElementById("chkAddGasto").checked,
    privacy: document.getElementById("chkPrivacy").checked,
  };
  fillBankCardForm(cfg);
  saveBankCardConfig(cfg);
  tobaSaved();
}

/* ---------------------------------------------------------------------
 * Backup GERAL (todas as chaves do navegador, valores como texto)
 * ------------------------------------------------------------------- */
function exportAllData() {
  const backupData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    backupData[key] = localStorage.getItem(key);
  }
  tobaDownloadJson(backupData, `toba_solutions_backup_completo_${toIsoDate()}.json`);
}

async function importAllData(text) {
  let importedData;
  try {
    importedData = JSON.parse(text);
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup válido (ou veio corrompido).", { title: "Arquivo inválido", icon: "😵" });
    return;
  }
  // Backup geral = { "<chave>": "<texto>" } com chaves do Toba. Barra o
  // backup de um app só (Bank/Health), que gravaria lixo no navegador.
  const entries =
    importedData && typeof importedData === "object" && !Array.isArray(importedData)
      ? Object.entries(importedData)
      : [];
  const isGeneralBackup =
    entries.length > 0 &&
    entries.every(([, value]) => typeof value === "string") &&
    entries.some(([key]) => /^toba_/i.test(key));
  if (!isGeneralBackup) {
    showPageMessage(
      "Este arquivo não é um backup geral do Toba. Backup do Bank ou do Health se restaura dentro do próprio app (⚙️ → Dados & Backup).",
      { title: "Backup errado", icon: "🙅" },
    );
    return;
  }
  const confirmed = await showPageMessage(
    "Os dados atuais de TODOS os apps Toba serão substituídos pelos do arquivo. Bora?",
    { title: "Restaurar tudo?", icon: "⚠️", confirm: true, confirmLabel: "Restaurar" },
  );
  if (!confirmed) return;
  try {
    entries.forEach(([key, value]) => localStorage.setItem(key, value));
  } catch (saveErr) {
    await showPageMessage(
      "A memória do navegador encheu no meio da restauração. Parte dos dados pode não ter sido gravada; libere espaço e restaure de novo.",
      { title: "Restauração incompleta", icon: "💾" },
    );
    location.reload();
    return;
  }
  await showPageMessage("Backup de todo o ecossistema restaurado!", { title: "Tudo de volta", icon: "✨" });
  location.reload();
}

tobaSetupApp({
  name: "Toba Solutions",
  exportBackup: exportAllData,
  importBackup: importAllData,
  dataHint: "Backup geral: um .json com TODOS os apps Toba (Bank, Health e preferências) de uma vez. Backup de um app só se restaura dentro dele.",
});

tobaActions({
  soonApp: (el) => showPageMessage(el.dataset.msg, { title: "Em breve", icon: "🚧" }),
  quickAddExpense: (el, event) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = "./TobaBank/TobaBank-Gastos.html?action=add_expense";
  },
  toggleBankPrivacy: (el, event) => {
    event.preventDefault();
    const cfg = getBankCardConfig();
    cfg.privacy = !cfg.privacy;
    fillBankCardForm(cfg);
    saveBankCardConfig(cfg);
  },
  openBankCardConfig: () => {
    fillBankCardForm(getBankCardConfig());
    openTobaModal("bankCardModal");
  },
  updateBankCardConfig: updateBankCardConfigFromUI,
  openOrderConfig: () => {
    renderOrderList();
    openTobaModal("orderModal");
  },
  toggleModule: (el) => toggleModule(Number(el.dataset.index)),
  moveModule: (el) => moveModule(Number(el.dataset.index), Number(el.dataset.dir)),
});

document.addEventListener("DOMContentLoaded", () => {
  loadPortalCards();
  applyPortalCards();
  const cfg = getBankCardConfig();
  fillBankCardForm(cfg);
  renderBankCard(cfg);
});
