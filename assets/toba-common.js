/* =====================================================================
 * Toba Solutions · funções comuns de TODOS os apps (Bank, Health, ...)
 * Carregue ANTES do core do app:
 *   <script src="../assets/toba-common.js"></script>
 *   <script src="js/<app>-core.js"></script>
 *
 * O que tem aqui (uma cópia só, para todos os apps):
 * - Datas, dinheiro e decimais: toIsoDate, isoToBrDate, formatCurrency,
 *   formatMoneyInput, getMoney, parseTobaDecimal, formatDec1/formatDec2...
 * - escapeHtml: TODO texto digitado pelo usuário passa por aqui antes de
 *   entrar num innerHTML.
 * - Ações sem onclick no HTML: data-click / data-change / data-input /
 *   data-submit apontam para funções registradas com tobaActions({...}).
 * - Modais (.toba-modal), aviso/confirmação (showPageMessage), "Salvo ✓"
 *   (tobaSaved), estado vazio (tobaEmpty) e a engrenagem ⚙️ padrão com
 *   "Dados & Backup" (tobaSetupApp).
 * - tobaWheelPicker: régua de arrastar para escolher número sem teclado.
 *
 * Este arquivo NÃO grava nada no localStorage: cada core continua dono do
 * próprio banco.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * Datas
 * ------------------------------------------------------------------- */

// Data local no formato gravado no banco ("AAAA-MM-DD"). Nunca use
// toISOString().slice(0, 10) para dado gravado: é UTC e erra o dia à noite.
function toIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoToBrDate(isoStr) {
  if (!isoStr || !isoStr.includes("-")) return isoStr || "";
  const [y, m, d] = isoStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function getCurrentMonthKey() {
  return toIsoDate().slice(0, 7);
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// "Outubro/26"
function formatMonthYearLabel(yearStr, monthIndex) {
  const date = new Date(yearStr, monthIndex, 1);
  const rawMonthName = date.toLocaleDateString("pt-BR", { month: "long" });
  const capitalizedMonth = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
  return `${capitalizedMonth}/${String(yearStr).slice(-2)}`;
}

/* ---------------------------------------------------------------------
 * Dinheiro (number em reais) e decimais
 * ------------------------------------------------------------------- */

function formatCurrency(val) {
  return (Number(val) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// "1.234,50" (sem R$), para preencher campos de dinheiro
function formatMoneyInput(value) {
  if (value === null || value === undefined || isNaN(value)) return "";
  return parseFloat(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Lê um campo de dinheiro pelo id. Campos "smart-money" vêm mascarados
// ("1.234,50"); os outros aceitam vírgula ou ponto.
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

function parseTobaDecimal(valStr) {
  if (!valStr) return null;
  const parsed = parseFloat(valStr.toString().replace(",", "."));
  return isNaN(parsed) ? null : parsed;
}

function formatDec1(num) {
  return num === null || num === undefined ? "--" : num.toFixed(1).replace(".", ",");
}

function formatDec2(num) {
  return num === null || num === undefined ? "--" : num.toFixed(2).replace(".", ",");
}

// Máscara dos campos ".toba-mask-dec1/.toba-mask-dec2": os dígitos viram
// décimos/centésimos e a vírgula entra sozinha (não depende do teclado).
// Ao completar o número, pula para o próximo campo do formulário.
function initTobaDecimalMasks() {
  document.querySelectorAll(".toba-mask-dec1, .toba-mask-dec2").forEach((input) => {
    if (input.dataset.maskReady) return;
    input.dataset.maskReady = "1";
    input.setAttribute("inputmode", "decimal");

    input.addEventListener("input", (e) => {
      const digits = e.target.value.replace(/\D/g, "");
      if (!digits) {
        e.target.value = "";
        return;
      }

      const isDec1 = e.target.classList.contains("toba-mask-dec1");
      e.target.value = (parseInt(digits, 10) / (isDec1 ? 10 : 100))
        .toFixed(isDec1 ? 1 : 2)
        .replace(".", ",");

      if (e.inputType === "insertText" && e.data && !isNaN(e.data)) {
        if (digits.length >= (isDec1 ? 3 : 4)) {
          const form = e.target.closest("form");
          if (!form) return;
          const formInputs = Array.from(form.querySelectorAll('input:not([type="hidden"])'));
          const next = formInputs[formInputs.indexOf(e.target) + 1];
          if (next) next.focus();
        }
      }
    });
  });
}

// Máscara dos campos de dinheiro (classe "smart-money"): "123" -> "1,23"
document.addEventListener("input", (e) => {
  if (!e.target.classList || !e.target.classList.contains("smart-money")) return;
  const digits = e.target.value.replace(/\D/g, "");
  if (digits === "") {
    e.target.value = "";
    return;
  }
  e.target.value = (parseInt(digits, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

/* ---------------------------------------------------------------------
 * Texto seguro
 * ------------------------------------------------------------------- */

// "Pizza <b>" aparece como texto, não vira HTML.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

/* ---------------------------------------------------------------------
 * Ações: nada de onclick="..." no HTML.
 *   <button data-click="saveExpense">        -> tobaActions({ saveExpense(el, event) {...} })
 *   <select data-change="renderChart">
 *   <input  data-input="updatePreview">
 *   <form   data-submit="saveWeighIn">       (o envio padrão já é cancelado)
 *   <button data-close>                      fecha o modal onde está
 *   <button data-open="idDoModal">           abre um modal
 * Use data-id / data-index etc. para passar o item clicado.
 * Ação com nome errado aparece no console (e o teste acusa).
 * ------------------------------------------------------------------- */
const TOBA_ACTIONS = {};

function tobaActions(map) {
  Object.keys(map).forEach((name) => {
    if (TOBA_ACTIONS[name] && TOBA_ACTIONS[name] !== map[name]) {
      console.warn(`Ação "${name}" registrada duas vezes; vale a última.`);
    }
    TOBA_ACTIONS[name] = map[name];
  });
}

function runTobaAction(name, el, event) {
  const fn = TOBA_ACTIONS[name];
  if (typeof fn !== "function") {
    console.error(`Ação "${name}" não registrada (tobaActions).`);
    return;
  }
  try {
    const result = fn(el, event);
    if (result && typeof result.catch === "function") {
      result.catch((err) => console.error(`Erro na ação "${name}":`, err));
    }
  } catch (err) {
    console.error(`Erro na ação "${name}":`, err);
  }
}

// Lista ações do HTML atual sem função registrada (usado nos testes).
function tobaMissingActions(root = document) {
  const missing = new Set();
  ["click", "change", "input", "submit"].forEach((type) => {
    root.querySelectorAll(`[data-${type}]`).forEach((el) => {
      const name = el.dataset[type];
      if (name && typeof TOBA_ACTIONS[name] !== "function") missing.add(`${type}:${name}`);
    });
  });
  return [...missing];
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const closer = target.closest("[data-close]");
  if (closer) {
    const modal = closer.closest(".toba-modal");
    if (modal) closeTobaModal(modal.id);
    return;
  }

  const opener = target.closest("[data-open]");
  if (opener) {
    openTobaModal(opener.dataset.open);
    return;
  }

  // Toque no fundo escuro fecha (menos aviso e modal "static")
  if (target.classList.contains("toba-modal") && target.dataset.backdrop !== "static") {
    closeTobaModal(target.id);
    return;
  }

  const actionEl = target.closest("[data-click]");
  if (!actionEl || actionEl.disabled) return;
  if (actionEl.tagName === "A") event.preventDefault();
  runTobaAction(actionEl.dataset.click, actionEl, event);
});

document.addEventListener("change", (event) => {
  const el = event.target instanceof Element ? event.target.closest("[data-change]") : null;
  if (el) runTobaAction(el.dataset.change, el, event);
});

document.addEventListener("input", (event) => {
  const el = event.target instanceof Element ? event.target.closest("[data-input]") : null;
  if (el) runTobaAction(el.dataset.input, el, event);
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof Element) || !form.dataset.submit) return;
  event.preventDefault();
  runTobaAction(form.dataset.submit, form, event);
});

// Elementos clicáveis que não são <button>/<a> (cards, linhas) também
// respondem ao Enter/Espaço do teclado.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const open = [...document.querySelectorAll(".toba-modal.active")];
    const top = open[open.length - 1];
    if (top && top.dataset.backdrop !== "static") {
      if (top.id === "tobaDialog") resolveTobaDialog(false);
      else closeTobaModal(top.id);
    }
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const el = event.target;
  if (!(el instanceof Element) || !el.matches("[data-click][role='button']")) return;
  event.preventDefault();
  runTobaAction(el.dataset.click, el, event);
});

/* ---------------------------------------------------------------------
 * Cabeçalho padrão (.toba-header): o "‹" sobe um nível.
 *   tobaSetHeader({ page: "📈 Gráficos", back: "backToInvestments" });
 *   tobaSetHeader({ page: "📈 Investimentos" });   // volta ao href do HTML (Hub)
 * ------------------------------------------------------------------- */
function tobaSetHeader({ page, back } = {}) {
  const pageEl = document.querySelector(".toba-header .toba-page");
  if (pageEl && page !== undefined) pageEl.textContent = page;
  document.querySelectorAll(".toba-header .toba-back, .toba-header .toba-titles").forEach((el) => {
    if (back) el.dataset.click = back;
    else delete el.dataset.click;
  });
  const backEl = document.querySelector(".toba-header .toba-back");
  if (backEl) {
    backEl.setAttribute("aria-label", back ? "Voltar" : backEl.dataset.label || "Voltar");
  }
}

/* ---------------------------------------------------------------------
 * Modais
 * ------------------------------------------------------------------- */
function openTobaModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return console.error(`Modal "${id}" não existe.`);
  // Modal que estava "atrás" fica acima de quem abriu depois dele
  document.body.appendChild(modal);
  modal.classList.add("active");
  const sheet = modal.querySelector(".toba-sheet");
  if (sheet) sheet.scrollTop = 0;
}

function closeTobaModal(id) {
  const modal = document.getElementById(id);
  if (!modal || !modal.classList.contains("active")) return;
  modal.classList.remove("active");
  modal.dispatchEvent(new CustomEvent("toba:close"));
}

// Quando o teclado abre, rola o campo para o meio da folha (o botão
// principal já fica preso no rodapé).
document.addEventListener("focusin", (event) => {
  const el = event.target;
  if (!(el instanceof Element) || !el.matches("input, select, textarea")) return;
  if (!el.closest(".toba-sheet")) return;
  setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 280);
});

/* ---------------------------------------------------------------------
 * Aviso e confirmação (substitui alert/confirm/prompt)
 *   await showPageMessage("Texto", { title: "Título" });
 *   if (await showPageMessage("Apagar?", { confirm: true, confirmLabel: "Apagar" })) {...}
 * Opções: title, icon, confirm, confirmLabel, cancelLabel, danger (padrão
 * true quando confirm), okLabel.
 * ------------------------------------------------------------------- */
let tobaDialogQueue = Promise.resolve();

let tobaDialogResolver = null;

function showPageMessage(message, options = {}) {
  const run = () => new Promise((resolve) => {
    ensureTobaShell();
    const isConfirm = Boolean(options.confirm);
    const icon = options.icon ?? (isConfirm ? "🤔" : "");
    document.getElementById("tobaDialogIcon").textContent = icon;
    document.getElementById("tobaDialogIcon").style.display = icon ? "" : "none";
    document.getElementById("tobaDialogTitle").textContent = options.title || (isConfirm ? "Tem certeza?" : "Aviso");
    const text = document.getElementById("tobaDialogText");
    text.textContent = message;
    text.classList.toggle("is-short", String(message).length < 70);

    const cancelBtn = document.getElementById("tobaDialogCancel");
    const okBtn = document.getElementById("tobaDialogOk");
    cancelBtn.style.display = isConfirm ? "" : "none";
    cancelBtn.textContent = options.cancelLabel || "Cancelar";
    okBtn.textContent = isConfirm ? options.confirmLabel || "Confirmar" : options.okLabel || "Beleza 👍";
    okBtn.className = `btn ${isConfirm && options.danger !== false ? "btn-danger" : "btn-primary"}`;

    tobaDialogResolver = resolve;
    openTobaModal("tobaDialog");
    setTimeout(() => okBtn.focus({ preventScroll: true }), 50);
  });
  const next = tobaDialogQueue.then(run);
  tobaDialogQueue = next.catch(() => {});
  return next;
}

function resolveTobaDialog(confirmed) {
  closeTobaModal("tobaDialog");
  const resolve = tobaDialogResolver;
  tobaDialogResolver = null;
  // Espera a animação para o próximo aviso da fila não "piscar"
  setTimeout(() => resolve?.(confirmed), 120);
}

/* ---------------------------------------------------------------------
 * "Salvo ✓" (os cores chamam depois de gravar com sucesso)
 * ------------------------------------------------------------------- */
let tobaToastTimer = null;

let tobaSavedTimer = null;

function tobaToast(text) {
  ensureTobaShell();
  const toast = document.getElementById("tobaToast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(tobaToastTimer);
  tobaToastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

// Várias gravações seguidas (digitando o orçamento) viram um aviso só.
function tobaSaved(text = "Salvo ✓") {
  clearTimeout(tobaSavedTimer);
  tobaSavedTimer = setTimeout(() => tobaToast(text), 250);
}

/* ---------------------------------------------------------------------
 * Estado vazio
 *   el.innerHTML = tobaEmpty("🧾", "Nenhum gasto ainda", "Toque em + Gasto para começar.");
 * ------------------------------------------------------------------- */
function tobaEmpty(icon, title, hint = "", options = {}) {
  return `<div class="toba-empty${options.compact ? " is-compact" : ""}">
    <span class="toba-empty-icon">${icon}</span>
    <span class="toba-empty-title">${title}</span>
    ${hint ? `<span class="toba-empty-hint">${hint}</span>` : ""}
  </div>`;
}

/* ---------------------------------------------------------------------
 * Seletor de arrastar (régua horizontal), sem teclado
 *   const picker = tobaWheelPicker(el, {
 *     min: 0, max: 300, step: 1, value: 60,
 *     majorEvery: 5,               // traço maior a cada 5 valores (0 = todos iguais)
 *     unit: "kg",                  // aparece embaixo do valor do centro
 *     label: "Carga em kg",        // leitor de tela
 *     format: (v) => String(v),    // texto de cada valor
 *     onChange: (v) => {...},      // chamado a cada valor que passa pelo centro
 *   });
 *   picker.getValue(); picker.setValue(70); picker.destroy();
 * Dedo: rolagem nativa com scroll-snap (a página não rola junto).
 * Mouse: arrastar, rodinha e as setas ‹ ›. Teclado: ← → Home End.
 * Vibra de leve (se o aparelho deixar) a cada valor.
 * ------------------------------------------------------------------- */
const TOBA_WHEEL_ITEM = 52; // largura de cada valor, igual ao --wheel-item do CSS

function tobaWheelPicker(container, options = {}) {
  const min = Number(options.min) || 0;
  const step = Number(options.step) || 1;
  const count = Math.max(1, Math.floor(((Number(options.max) || 0) - min) / step) + 1);
  const majorEvery = Number(options.majorEvery) || 0;
  const format = options.format || ((v) => String(v));
  const valueAt = (i) => Math.round((min + i * step) * 1000) / 1000;
  const indexOf = (v) => Math.min(count - 1, Math.max(0, Math.round(((Number(v) || 0) - min) / step)));

  let index = indexOf(options.value ?? min);
  let silent = false; // mudança feita pelo código: não vibra nem avisa
  let styled = [];
  let frame = 0;

  const items = [];
  for (let i = 0; i < count; i++) {
    const v = valueAt(i);
    const major = majorEvery ? v % (majorEvery * step) === 0 : true;
    items.push(`<span class="toba-wheel-item${major ? " is-major" : ""}" data-i="${i}"><span class="toba-wheel-num">${escapeHtml(format(v))}</span><span class="toba-wheel-tick"></span></span>`);
  }
  container.innerHTML = `
    <div class="toba-wheel" role="slider" tabindex="0" aria-label="${escapeHtml(options.label || "")}" aria-valuemin="${valueAt(0)}" aria-valuemax="${valueAt(count - 1)}">
      <button type="button" class="toba-wheel-arrow" data-dir="-1" tabindex="-1" aria-hidden="true">‹</button>
      <div class="toba-wheel-track">
        <span class="toba-wheel-pad"></span>${items.join("")}<span class="toba-wheel-pad"></span>
      </div>
      <button type="button" class="toba-wheel-arrow" data-dir="1" tabindex="-1" aria-hidden="true">›</button>
      <span class="toba-wheel-marker" aria-hidden="true"></span>
      ${options.unit ? `<span class="toba-wheel-unit" aria-hidden="true">${escapeHtml(options.unit)}</span>` : ""}
    </div>`;
  const root = container.querySelector(".toba-wheel");
  const track = root.querySelector(".toba-wheel-track");
  const itemEls = track.querySelectorAll(".toba-wheel-item");
  const pads = track.querySelectorAll(".toba-wheel-pad");

  function buzz() {
    try {
      if (navigator.vibrate) navigator.vibrate(6);
    } catch (err) {
      /* sem vibração neste aparelho */
    }
  }

  // Destaca o centro e vai apagando/diminuindo os vizinhos (só os visíveis)
  function paint() {
    frame = 0;
    if (!track.clientWidth) return; // escondido: não dá para medir, mantém o valor
    const pos = track.scrollLeft / TOBA_WHEEL_ITEM;
    styled.forEach((el) => {
      el.style.transform = "";
      el.style.opacity = "";
      el.classList.remove("is-center");
    });
    styled = [];
    const from = Math.max(0, Math.floor(pos) - 5);
    const to = Math.min(count - 1, Math.ceil(pos) + 5);
    for (let i = from; i <= to; i++) {
      const dist = Math.abs(i - pos);
      const el = itemEls[i];
      el.style.transform = `scale(${Math.max(0.62, 1.35 - dist * 0.24).toFixed(3)})`;
      el.style.opacity = Math.max(0.12, 1 - dist * 0.27).toFixed(3);
      if (dist < 0.5) el.classList.add("is-center");
      styled.push(el);
    }
    const next = Math.min(count - 1, Math.max(0, Math.round(pos)));
    if (next !== index) {
      index = next;
      root.setAttribute("aria-valuenow", valueAt(index));
      root.setAttribute("aria-valuetext", `${format(valueAt(index))}${options.unit ? " " + options.unit : ""}`);
      if (!silent) {
        buzz();
        if (options.onChange) options.onChange(valueAt(index));
      }
    }
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  // Espaços nas pontas para o primeiro e o último valor poderem ficar no centro
  let lastWidth = 0;
  function layout() {
    // O ResizeObserver avisa logo depois de montar: sem mudança de largura,
    // não recentraliza (senão cancela uma rolagem que já começou).
    if (!track.clientWidth || track.clientWidth === lastWidth) return;
    lastWidth = track.clientWidth;
    const pad = Math.max(0, (track.clientWidth - TOBA_WHEEL_ITEM) / 2);
    pads.forEach((el) => (el.style.width = `${pad}px`));
    silent = true;
    track.scrollLeft = index * TOBA_WHEEL_ITEM;
    paint();
    silent = false;
  }

  function goTo(i, smooth = true) {
    const target = Math.min(count - 1, Math.max(0, i));
    track.scrollTo({ left: target * TOBA_WHEEL_ITEM, behavior: smooth ? "smooth" : "auto" });
  }

  // Mouse: arrastar como no dedo (o dedo usa a rolagem nativa)
  let drag = null;
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { x: event.clientX, left: track.scrollLeft, moved: false };
    track.classList.add("is-dragging");
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    track.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    if (!drag) return;
    track.classList.remove("is-dragging");
    const moved = drag.moved;
    drag = null;
    if (moved) {
      track.dataset.justDragged = "1";
      setTimeout(() => delete track.dataset.justDragged, 0);
    }
    goTo(Math.round(track.scrollLeft / TOBA_WHEEL_ITEM));
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // Tocar num valor leva ele para o centro
  track.addEventListener("click", (event) => {
    if (track.dataset.justDragged) return;
    const item = event.target.closest(".toba-wheel-item");
    if (item) goTo(Number(item.dataset.i));
  });

  // Rodinha do mouse (vertical) anda de 1 em 1; a horizontal do trackpad é nativa
  let wheelAcc = 0;
  track.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    wheelAcc += event.deltaY;
    if (Math.abs(wheelAcc) < 40) return;
    const dir = Math.sign(wheelAcc);
    wheelAcc = 0;
    goTo(index + dir);
  }, { passive: false });

  root.querySelectorAll(".toba-wheel-arrow").forEach((btn) => {
    btn.addEventListener("click", () => goTo(index + Number(btn.dataset.dir)));
  });

  root.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
    if (moves[event.key]) goTo(index + moves[event.key]);
    else if (event.key === "Home") goTo(0);
    else if (event.key === "End") goTo(count - 1);
    else return;
    event.preventDefault();
  });

  track.addEventListener("scroll", onScroll, { passive: true });
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(layout) : null;
  if (observer) observer.observe(track);
  root.setAttribute("aria-valuenow", valueAt(index));
  root.setAttribute("aria-valuetext", `${format(valueAt(index))}${options.unit ? " " + options.unit : ""}`);
  layout();

  return {
    getValue: () => valueAt(index),
    setValue(v, smooth = false) {
      const target = indexOf(v);
      if (target === index && !smooth) return;
      silent = true;
      index = target;
      track.scrollLeft = target * TOBA_WHEEL_ITEM;
      paint();
      silent = false;
    },
    destroy() {
      if (observer) observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      container.innerHTML = "";
    },
  };
}

/* ---------------------------------------------------------------------
 * Backup: download e leitura de .json
 * ------------------------------------------------------------------- */
function tobaDownloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Lê o arquivo escolhido num <input type="file"> e devolve o texto.
// Limpa o input para dar para escolher o mesmo arquivo de novo.
function tobaReadFile(input) {
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ---------------------------------------------------------------------
 * Engrenagem ⚙️ padrão: "Configurações" = itens da página + Dados & Backup
 *   tobaSetupApp({
 *     name: "Toba Bank",
 *     exportBackup: () => {...},            // baixa o .json do app
 *     importBackup: async (text) => {...},  // recebe o texto do arquivo
 *     resetData: async () => {...},         // apaga só os dados do app (opcional)
 *     dataHint: "texto",                    // opcional: explica o backup
 *   });
 * O que for só da página fica num <div id="tobaSettingsExtra" hidden> no
 * HTML; ele é movido para dentro da folha de configurações.
 * Qualquer botão com data-click="openSettings" abre a folha.
 * ------------------------------------------------------------------- */
const TOBA_APP = { name: "Toba", exportBackup: null, importBackup: null, resetData: null, dataHint: "" };

function tobaSetupApp(config) {
  Object.assign(TOBA_APP, config);
}

const TOBA_SHELL_HTML = `
<div class="toba-modal toba-dialog" id="tobaDialog" data-backdrop="static" role="alertdialog" aria-modal="true" aria-labelledby="tobaDialogTitle">
  <div class="toba-dialog-box">
    <div class="toba-dialog-icon" id="tobaDialogIcon"></div>
    <div class="toba-dialog-title" id="tobaDialogTitle"></div>
    <div class="toba-dialog-text" id="tobaDialogText"></div>
    <div class="toba-dialog-actions">
      <button type="button" class="btn btn-secondary" id="tobaDialogCancel" data-click="tobaDialogCancel">Cancelar</button>
      <button type="button" class="btn btn-primary" id="tobaDialogOk" data-click="tobaDialogOk">OK</button>
    </div>
  </div>
</div>
<div class="toba-toast" id="tobaToast" role="status" aria-live="polite"></div>`;

const TOBA_SETTINGS_HTML = `
<div class="toba-modal" id="settingsModal" role="dialog" aria-modal="true" aria-labelledby="settingsModalTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="settingsModalTitle">⚙️ Configurações</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <div id="tobaSettingsSlot"></div>
    <div class="toba-settings-section">
      <div class="toba-settings-label">💾 Dados</div>
      <button type="button" class="toba-menu-btn" data-open="tobaDataModal">
        <span class="toba-menu-icon">💾</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Dados &amp; Backup</span>
          <span class="toba-menu-desc" id="tobaDataMenuDesc">Baixar, restaurar ou apagar os dados</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
    </div>
  </div>
</div>
<div class="toba-modal" id="tobaDataModal" role="dialog" aria-modal="true" aria-labelledby="tobaDataModalTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="tobaDataModalTitle">💾 Dados &amp; Backup</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <p class="toba-sheet-text" id="tobaDataHint"></p>
    <div class="toba-menu">
      <button type="button" class="toba-menu-btn" data-click="tobaExportBackup">
        <span class="toba-menu-icon">📥</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Baixar backup</span>
          <span class="toba-menu-desc">Salva um arquivo .json no aparelho</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
      <button type="button" class="toba-menu-btn" data-click="tobaPickBackup">
        <span class="toba-menu-icon">📤</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Restaurar backup</span>
          <span class="toba-menu-desc">Escolhe um .json e troca os dados atuais</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
    </div>
    <input type="file" id="tobaImportInput" accept=".json,application/json" hidden data-change="tobaImportBackup" />
    <div class="toba-settings-section" id="tobaDangerSection">
      <div class="toba-settings-label is-danger">☢️ Zona de perigo</div>
      <button type="button" class="toba-menu-btn is-danger" data-click="tobaResetData" id="tobaResetBtn">
        <span class="toba-menu-icon">🗑️</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title" id="tobaResetTitle">Apagar tudo</span>
          <span class="toba-menu-desc">Não dá para desfazer. Baixe um backup antes!</span>
        </span>
      </button>
    </div>
  </div>
</div>`;

function ensureTobaShell() {
  if (document.getElementById("tobaDialog")) return;
  document.body.insertAdjacentHTML("beforeend", TOBA_SHELL_HTML);
}

function ensureTobaSettings() {
  if (document.getElementById("settingsModal")) return;
  document.body.insertAdjacentHTML("beforeend", TOBA_SETTINGS_HTML);
  const extra = document.getElementById("tobaSettingsExtra");
  if (extra) {
    extra.hidden = false;
    document.getElementById("tobaSettingsSlot").appendChild(extra);
  }
  document.getElementById("tobaDataHint").textContent = TOBA_APP.dataHint ||
    `O backup é um arquivo .json só com os dados do ${TOBA_APP.name}. Guarde no Drive de vez em quando, vai que...`;
  document.getElementById("tobaResetTitle").textContent = `Apagar tudo do ${TOBA_APP.name}`;
  // Sem resetData (ex.: portal), a zona de perigo nem aparece.
  if (!TOBA_APP.resetData) {
    document.getElementById("tobaDangerSection").hidden = true;
    document.getElementById("tobaDataMenuDesc").textContent = "Baixar ou restaurar o backup";
  }
}

function openDataModal() {
  ensureTobaSettings();
  openTobaModal("settingsModal");
}

function closeDataModal() {
  closeTobaModal("tobaDataModal");
  closeTobaModal("settingsModal");
}

tobaActions({
  tobaDialogOk: () => resolveTobaDialog(true),
  tobaDialogCancel: () => resolveTobaDialog(false),
  openSettings: openDataModal,
  tobaExportBackup: () => {
    if (TOBA_APP.exportBackup) TOBA_APP.exportBackup();
  },
  tobaPickBackup: () => document.getElementById("tobaImportInput").click(),
  tobaImportBackup: async (input) => {
    let text;
    try {
      text = await tobaReadFile(input);
    } catch (err) {
      showPageMessage("Não consegui abrir esse arquivo.", { title: "Arquivo ilegível", icon: "😵" });
      return;
    }
    if (text !== null && TOBA_APP.importBackup) await TOBA_APP.importBackup(text);
  },
  tobaResetData: () => {
    if (TOBA_APP.resetData) return TOBA_APP.resetData();
  },
});

document.addEventListener("DOMContentLoaded", () => {
  ensureTobaShell();
  ensureTobaSettings();
});
