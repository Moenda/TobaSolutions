/* =====================================================================
 * Portal Toba Solutions (index.html)
 * - Depende de toba-common.js, de TobaBank/js/bank-metrics.js (o card do
 *   Bank usa o MESMO cálculo da tela de Gastos: calcBankMonthSummary) e de
 *   TobaHealth/js/health-metrics.js (card do Health).
 * - Preferências de UI: "toba_modules_config" (ordem/visibilidade dos
 *   cards), "toba_bank_card_config" (o que o card do Bank mostra),
 *   "toba_health_card_config" (o que o card do Health mostra).
 * - Backup GERAL: { "<chave localStorage>": "<valor como TEXTO>" }.
 *   Não mude o formato: backups antigos precisam continuar restaurando.
 * ===================================================================== */
const MODULES_KEY = "toba_modules_config";
const BANK_CARD_KEY = "toba_bank_card_config";
const HEALTH_CARD_KEY = "toba_health_card_config";

const BANK_CARD_DEFAULTS = {
  type: "personalizado",
  orcamento: true,
  cofre: true,
  gastos: true,
  sobra: true,
  addGasto: true,
  privacy: false,
};

// Números que dá pra ligar no card do Health. A key é o que fica salvo em
// toba_health_card_config.metrics: não renomeie; número novo = item novo.
const HEALTH_CARD_METRICS = [
  { key: "peso", label: "⚖️ Peso atual", on: true },
  { key: "pesoMes", label: "📉 Peso no mês", on: true },
  { key: "treinos", label: "🏋️ Treinos no mês", on: true },
  { key: "km", label: "📍 Km no mês", on: true },
  { key: "semana", label: "📅 Treinos na semana", on: false },
  { key: "kcal", label: "🔥 Calorias no mês", on: false },
  { key: "minutos", label: "⏱️ Tempo treinado no mês", on: false },
  { key: "saitama", label: "👊 Reps do Saitama no mês", on: false },
  { key: "gordura", label: "🧈 Gordura (última pesagem)", on: false },
];

const HEALTH_CARD_DEFAULTS = {
  type: "personalizado",
  metrics: Object.fromEntries(HEALTH_CARD_METRICS.map((m) => [m.key, m.on])),
  links: true,
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
 * Card do Toba Health (só leitura do TOBA_HEALTH_DB)
 * ------------------------------------------------------------------- */
function readPortalJson(key, defaults) {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return { ...defaults, ...parsed };
    } catch (e) {
      console.error(`Erro ao ler ${key}`, e);
    }
  }
  return { ...defaults };
}

function writePortalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Não consegui salvar ${key}`, e);
    return false;
  }
}

function getHealthCardConfig() {
  const cfg = readPortalJson(HEALTH_CARD_KEY, HEALTH_CARD_DEFAULTS);
  // Número novo na lista entra com o padrão dele, sem mexer nas escolhas.
  cfg.metrics = { ...HEALTH_CARD_DEFAULTS.metrics, ...(cfg.metrics || {}) };
  return cfg;
}

// Banco do Health ilegível ou ausente = resumo vazio (o portal nunca grava nele).
function obterResumoTobaHealth() {
  let data = null;
  const raw = localStorage.getItem("TOBA_HEALTH_DB");
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Erro ao ler os dados do Toba Health", e);
    }
  }
  return calcHealthSummary(data);
}

function formatPortalNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function formatKg(value) {
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}

function formatDaysAgo(days) {
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

// Peso: descer é verde, subir é vermelho (igual à tela da Pesagem).
function weightDiffHtml(diff, privacy) {
  if (diff === null || Math.abs(diff) < 0.005) return privacy ? "** kg" : "0 kg";
  if (privacy) return "** kg";
  const cls = diff < 0 ? "text-green" : "text-red";
  return `<span class="${cls}">${diff < 0 ? "▼" : "▲"} ${formatKg(Math.abs(diff))}</span>`;
}

function buildHealthTile(key, h, privacy) {
  const tile = (label, value, sub = "") => `
    <div class="toba-stat">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      ${sub ? `<span class="toba-stat-sub">${sub}</span>` : ""}
    </div>`;
  const plural = (n, one, many) => `${formatPortalNumber(n, 0)} ${n === 1 ? one : many}`;
  const perDay = (value) => (h.elapsedDays ? value / h.elapsedDays : 0);

  switch (key) {
    case "peso":
      if (h.weight === null) return tile("⚖️ Peso", "--", "sem pesagem ainda");
      return tile(
        "⚖️ Peso",
        privacy ? "** kg" : formatKg(h.weight),
        h.weightDiff !== null && Math.abs(h.weightDiff) >= 0.005
          ? `${weightDiffHtml(h.weightDiff, privacy)} vs anterior`
          : formatDaysAgo(h.weightDaysAgo),
      );
    case "pesoMes":
      if (h.weightMonthDiff === null) return tile("📉 Peso no mês", "--", h.weight === null ? "sem pesagem ainda" : "pese de novo pra comparar");
      return tile("📉 Peso no mês", weightDiffHtml(h.weightMonthDiff, privacy), plural(h.weighInsMonth, "pesagem", "pesagens"));
    case "treinos":
      return tile("🏋️ Treinos mês", `<span class="text-green">${plural(h.monthCount, "treino", "treinos")}</span>`, `em ${h.monthActiveDays} de ${h.elapsedDays} dias`);
    case "km":
      return tile("📍 Km no mês", `<span class="text-blue">${formatPortalNumber(h.monthKm, 2)} km</span>`, `${formatPortalNumber(perDay(h.monthKm), 2)} km/dia`);
    case "semana":
      return tile("📅 Semana", `<span class="text-green">${plural(h.weekCount, "treino", "treinos")}</span>`, "desde segunda");
    case "kcal":
      return tile("🔥 Calorias", `<span class="text-gold">${formatPortalNumber(h.monthCalories, 0)} kcal</span>`, `${formatPortalNumber(perDay(h.monthCalories), 0)} kcal/dia`);
    case "minutos": {
      const hours = Math.floor(h.monthMinutes / 60);
      const mins = Math.round(h.monthMinutes % 60);
      return tile("⏱️ Tempo mês", `${formatPortalNumber(h.monthMinutes, 0)} min`, hours ? `${hours}h${String(mins).padStart(2, "0")} no mês` : "no mês");
    }
    case "saitama":
      return tile("👊 Saitama", `<span class="text-coral">${formatPortalNumber(h.monthSaitamaReps, 0)} reps</span>`, "flex + abd + agach");
    case "gordura":
      if (h.fat === null) return tile("🧈 Gordura", "--", "sem dado na pesagem");
      return tile("🧈 Gordura", privacy ? "**%" : `${formatPortalNumber(h.fat, 1)}%`, formatDaysAgo(h.weightDaysAgo));
    default:
      return "";
  }
}

function renderHealthCard(cfg) {
  const topAction = document.getElementById("tobaHealthCardTopAction");
  const desc = document.getElementById("tobaHealthDesc");
  const body = document.getElementById("tobaHealthCustomBody");

  if (cfg.type === "simples") {
    desc.hidden = false;
    body.hidden = true;
    topAction.innerHTML = '<span class="badge badge-beta">🔥 Beta</span>';
    return;
  }

  // Sem nenhuma pesagem nem treino (ex.: amigo que só usa o Bank): fica a
  // frase do card e só os atalhos, em vez de um monte de "--".
  const h = obterResumoTobaHealth();
  const isEmpty = h.weight === null && h.lastWorkoutDaysAgo === null;
  desc.hidden = !isEmpty;
  body.hidden = isEmpty && !cfg.links;
  const hasWeight = cfg.metrics.peso || cfg.metrics.pesoMes || cfg.metrics.gordura;
  topAction.innerHTML = hasWeight
    ? `<span class="eye-toggle-btn is-health" role="button" tabindex="0" data-click="toggleHealthPrivacy" aria-label="${cfg.privacy ? "Mostrar o peso" : "Esconder o peso"}">${cfg.privacy ? "👁️ Mostrar" : "🙈 Esconder"}</span>`
    : '<span class="badge badge-beta">🔥 Beta</span>';

  const html = isEmpty ? "" : HEALTH_CARD_METRICS.filter((m) => cfg.metrics[m.key])
    .map((m) => buildHealthTile(m.key, h, cfg.privacy))
    .join("");
  const grid = document.getElementById("tobaHealthMetricsGrid");
  grid.innerHTML = html;
  grid.hidden = !html;
  document.getElementById("tobaHealthQuickRow").hidden = !cfg.links;
}

function fillHealthCardForm(cfg) {
  const isCustom = cfg.type !== "simples";
  document.getElementById("radioHealthPersonalizado").checked = isCustom;
  document.getElementById("radioHealthSimples").checked = !isCustom;
  document.getElementById("radioHealthPersonalizadoLabel").classList.toggle("active", isCustom);
  document.getElementById("radioHealthSimplesLabel").classList.toggle("active", !isCustom);
  document.getElementById("thCustomDrawer").hidden = !isCustom;
  document.getElementById("healthCardChecks").innerHTML = HEALTH_CARD_METRICS.map((m) => `
    <label class="check-row"><span>${m.label}</span><input type="checkbox" data-metric="${m.key}" data-change="updateHealthCardConfig"${cfg.metrics[m.key] ? " checked" : ""} /></label>`).join("");
  document.getElementById("chkHealthLinks").checked = cfg.links;
  document.getElementById("chkHealthPrivacy").checked = cfg.privacy;
}

function updateHealthCardConfigFromUI() {
  const metrics = {};
  document.querySelectorAll("#healthCardChecks [data-metric]").forEach((input) => {
    metrics[input.dataset.metric] = input.checked;
  });
  const cfg = {
    type: document.getElementById("radioHealthPersonalizado").checked ? "personalizado" : "simples",
    metrics,
    links: document.getElementById("chkHealthLinks").checked,
    privacy: document.getElementById("chkHealthPrivacy").checked,
  };
  fillHealthCardForm(cfg);
  writePortalJson(HEALTH_CARD_KEY, cfg);
  renderHealthCard(cfg);
  tobaSaved();
}

function renderPortalPanels() {
  renderBankCard(getBankCardConfig());
  renderHealthCard(getHealthCardConfig());
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
  toggleHealthPrivacy: (el, event) => {
    event.preventDefault();
    const cfg = getHealthCardConfig();
    cfg.privacy = !cfg.privacy;
    writePortalJson(HEALTH_CARD_KEY, cfg);
    renderHealthCard(cfg);
  },
  goHealthPage: (el, event) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = `./TobaHealth/${el.dataset.page}`;
  },
  openHealthCardConfig: () => {
    fillHealthCardForm(getHealthCardConfig());
    openTobaModal("healthCardModal");
  },
  updateHealthCardConfig: updateHealthCardConfigFromUI,
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
  fillBankCardForm(getBankCardConfig());
  renderPortalPanels();
});

// Voltou de um app pelo "‹" (ou reabriu o PWA): o navegador pode
// reaproveitar a página antiga; redesenha os números dos cards.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) renderPortalPanels();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderPortalPanels();
});
