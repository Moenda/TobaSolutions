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
 * - tobaNotify (notificação com o app aberto) e tobaOpenReminder (lembrete
 *   com horário pela agenda do celular, arquivo .ics).
 * - TOBA_NATIVE / tobaIsApp(): ponte com o app Android (TobaAndroid/); no
 *   navegador é null e tudo funciona como site.
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

// Máscara dos campos ".toba-mask-dec1/.toba-mask-dec2" (e ".toba-mask-int" e
// ".toba-mask-dec3", preço da bomba, desde v1.51): os dígitos viram décimos/centésimos e a vírgula entra
// sozinha (não depende do teclado). Ao completar o número, pula para o
// próximo campo de digitar do formulário (data/hora e caixinhas ficam de fora).
// Completar = data-digits (dígitos antes da vírgula, desde v1.51) + casas
// decimais; sem data-digits vale 2 antes da vírgula (3 no dec1, 4 no dec2) e
// o int não pula.
function tobaMaskDecimals(input) {
  if (input.classList.contains("toba-mask-dec1")) return 1;
  if (input.classList.contains("toba-mask-dec2")) return 2;
  if (input.classList.contains("toba-mask-dec3")) return 3;
  return 0;
}

function initTobaDecimalMasks() {
  document.querySelectorAll(".toba-mask-dec1, .toba-mask-dec2, .toba-mask-dec3, .toba-mask-int").forEach((input) => {
    if (input.dataset.maskReady) return;
    input.dataset.maskReady = "1";
    input.setAttribute("inputmode", tobaMaskDecimals(input) ? "decimal" : "numeric");

    input.addEventListener("input", (e) => {
      const el = e.target;
      // A classe é lida a cada tecla: a Pesagem troca as casas do peso na ⚙️.
      const decimals = tobaMaskDecimals(el);
      // Sem os zeros da frente: "0,91" + 9 são 3 dígitos (919), não 4. Contar o
      // zero fazia o peso pular de campo no 3º número (bug até a v1.50).
      const raw = el.value.replace(/\D/g, "");
      if (!raw) {
        el.value = "";
        return;
      }
      const digits = String(parseInt(raw, 10));

      el.value = decimals
        ? (parseInt(digits, 10) / 10 ** decimals).toFixed(decimals).replace(".", ",")
        : digits;

      if (!(e.inputType === "insertText" && e.data && !isNaN(e.data))) return;
      const intDigits = Number(el.dataset.digits) || (decimals ? 2 : 0);
      if (!intDigits || digits.length < intDigits + decimals) return;
      const form = el.closest("form");
      if (!form) return;
      const formInputs = Array.from(form.querySelectorAll(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="datetime-local"]):not([type="time"])',
      ));
      const next = formInputs[formInputs.indexOf(el) + 1];
      if (next) next.focus();
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
 * Só os valores perto do centro existem na tela (espaçadores fazem o resto da
 * largura): a régua pode ter milhares de valores sem pesar.
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

  container.innerHTML = `
    <div class="toba-wheel" role="slider" tabindex="0" aria-label="${escapeHtml(options.label || "")}" aria-valuemin="${valueAt(0)}" aria-valuemax="${valueAt(count - 1)}">
      <button type="button" class="toba-wheel-arrow" data-dir="-1" tabindex="-1" aria-hidden="true">‹</button>
      <div class="toba-wheel-track">
        <span class="toba-wheel-pad"></span><span class="toba-wheel-gap"></span><span class="toba-wheel-gap"></span><span class="toba-wheel-pad"></span>
      </div>
      <button type="button" class="toba-wheel-arrow" data-dir="1" tabindex="-1" aria-hidden="true">›</button>
      <span class="toba-wheel-marker" aria-hidden="true"></span>
      ${options.unit ? `<span class="toba-wheel-unit" aria-hidden="true">${escapeHtml(options.unit)}</span>` : ""}
    </div>`;
  const root = container.querySelector(".toba-wheel");
  const track = root.querySelector(".toba-wheel-track");
  const pads = track.querySelectorAll(".toba-wheel-pad");
  const [gapBefore, gapAfter] = track.querySelectorAll(".toba-wheel-gap");
  const itemEls = new Map(); // índice -> elemento, só a janela visível
  let shown = { from: 0, to: -1 };

  function makeItem(i) {
    const v = valueAt(i);
    const major = majorEvery ? v % (majorEvery * step) === 0 : true;
    const el = document.createElement("span");
    el.className = `toba-wheel-item${major ? " is-major" : ""}`;
    el.dataset.i = i;
    el.innerHTML = `<span class="toba-wheel-num">${escapeHtml(format(v))}</span><span class="toba-wheel-tick"></span>`;
    return el;
  }

  // Mantém no DOM só os valores visíveis + folga. O snap só "enxerga" o que
  // existe: a folga (~2000px de cada lado) cobre um peteleco forte no dedo.
  function renderWindow(pos) {
    const reach = Math.ceil(track.clientWidth / TOBA_WHEEL_ITEM / 2) + 40;
    const from = Math.max(0, Math.floor(pos) - reach);
    const to = Math.min(count - 1, Math.ceil(pos) + reach);
    if (from === shown.from && to === shown.to) return;
    itemEls.forEach((el, i) => {
      if (i < from || i > to) {
        el.remove();
        itemEls.delete(i);
      }
    });
    let anchor = gapBefore;
    for (let i = from; i <= to; i++) {
      let el = itemEls.get(i);
      if (!el) {
        el = makeItem(i);
        itemEls.set(i, el);
        anchor.after(el);
      }
      anchor = el;
    }
    gapBefore.style.width = `${from * TOBA_WHEEL_ITEM}px`;
    gapAfter.style.width = `${(count - 1 - to) * TOBA_WHEEL_ITEM}px`;
    shown = { from, to };
  }

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
    renderWindow(pos);
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
      const el = itemEls.get(i);
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
    renderWindow(index);
    silent = true;
    track.scrollLeft = index * TOBA_WHEEL_ITEM;
    paint();
    silent = false;
  }

  function goTo(i, smooth = true) {
    const target = Math.min(count - 1, Math.max(0, i));
    if (Math.abs(target - index) > 30) {
      // Pulo longo (Home/End): desenha o destino antes, senão o snap volta
      renderWindow(target);
      smooth = false;
    }
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
      renderWindow(target);
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
  const text = JSON.stringify(data, null, 2);
  // No app Android o WebView não baixa arquivo gerado pelo site: grava em Downloads/Toba.
  if (TOBA_NATIVE) {
    if (!TOBA_NATIVE.saveFile(fileName, "application/json", text)) {
      showPageMessage("Não consegui salvar o arquivo em Downloads.", { title: "Não salvou", icon: "💥" });
    }
    return;
  }
  const blob = new Blob([text], { type: "application/json" });
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
 * Notificações do aparelho (sem servidor)
 *   tobaAskNotify()                 pede permissão (chame num toque do usuário)
 *   tobaNotify(title, body, { tag }) mostra, se já tiver permissão
 * Só funciona com o app aberto ou recém-minimizado: sem servidor não dá para
 * agendar. Lembrete com horário vai pela agenda (tobaOpenReminder).
 * ------------------------------------------------------------------- */
// App Android (TobaAndroid/): window.TobaNative existe; no navegador é null.
const TOBA_NATIVE = window.TobaNative || null;

function tobaIsApp() {
  return Boolean(TOBA_NATIVE);
}

const TOBA_ICON_URL = (() => {
  try {
    return new URL("../icons/icon-192.png", document.currentScript.src).href;
  } catch (err) {
    return "";
  }
})();

function tobaCanNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

async function tobaAskNotify() {
  if (TOBA_NATIVE) {
    if (!TOBA_NATIVE.canPostNotifications()) TOBA_NATIVE.requestNotificationPermission();
    return TOBA_NATIVE.canPostNotifications();
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "default") return Notification.permission === "granted";
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch (err) {
    return false;
  }
}

async function tobaNotify(title, body, options = {}) {
  if (!tobaCanNotify()) return false;
  const config = {
    body,
    icon: TOBA_ICON_URL,
    badge: TOBA_ICON_URL,
    tag: options.tag || "toba",
    renotify: true,
    vibrate: options.vibrate || [250, 120, 250],
    data: { url: location.href },
  };
  try {
    // No Android só o service worker pode mostrar notificação.
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(title, config);
    else new Notification(title, config);
    return true;
  } catch (err) {
    console.warn("Notificação não mostrada:", err);
    return false;
  }
}

/* ---------------------------------------------------------------------
 * Lembrete na agenda (.ics): o calendário do celular é quem avisa no
 * horário, mesmo com o app fechado e offline. Nada é gravado no banco.
 *   tobaOpenReminder({
 *     id: "pesagem",                  // fixo: importar de novo atualiza em vez de duplicar
 *     title: "⚖️ Hora da pesagem",    // título do evento
 *     message: "texto do aviso",
 *     times: ["07:30"],               // um evento por horário (dá para editar na folha)
 *     days: ["MO"],                   // MO TU WE TH FR SA SU
 *   });
 * ------------------------------------------------------------------- */
const TOBA_WEEK_DAYS = [
  ["MO", "Seg"], ["TU", "Ter"], ["WE", "Qua"], ["TH", "Qui"], ["FR", "Sex"], ["SA", "Sáb"], ["SU", "Dom"],
];

let tobaReminderConfig = null;

function tobaIcsEscape(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function tobaIcsDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

// Primeiro dia (de hoje em diante) que cai num dos dias escolhidos: a
// agenda exige que o início bata com a repetição.
function tobaIcsFirstDate(time, days) {
  const [h, m] = time.split(":").map(Number);
  const jsDays = days.map((code) => (TOBA_WEEK_DAYS.findIndex(([c]) => c === code) + 1) % 7);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  for (let i = 0; i < 7 && !jsDays.includes(date.getDay()); i++) date.setDate(date.getDate() + 1);
  return date;
}

function tobaBuildIcs({ id, title, message, times, days }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const url = location.href.split(/[?#]/)[0];
  const rule = days.length === 7 ? "FREQ=DAILY" : `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Toba Solutions//Lembretes//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  times.forEach((time) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:toba-${id}-${time.replace(":", "")}@toba-solutions`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${tobaIcsDate(tobaIcsFirstDate(time, days))}`,
      "DURATION:PT5M",
      `RRULE:${rule}`,
      `SUMMARY:${tobaIcsEscape(title)}`,
      `DESCRIPTION:${tobaIcsEscape(`${message}\n${url}`)}`,
      `URL:${url}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${tobaIcsEscape(message)}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function tobaDownloadIcs(config, fileName) {
  const blob = new Blob([tobaBuildIcs(config)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TOBA_REMINDER_HTML = `
<div class="toba-modal" id="tobaReminderModal" role="dialog" aria-modal="true" aria-labelledby="tobaReminderTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="tobaReminderTitle">🔔 Lembrete</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <form data-submit="tobaSaveReminder">
      <p class="toba-sheet-text toba-reminder-msg" id="tobaReminderText"></p>
      <div class="form-group">
        <label>Horário</label>
        <div class="toba-reminder-times" id="tobaReminderTimes"></div>
      </div>
      <div class="form-group">
        <label>Dias</label>
        <div class="toba-days" id="tobaReminderDays"></div>
      </div>
      <p class="toba-reminder-help" id="tobaReminderHelp"></p>
      <div class="toba-sheet-footer">
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" id="tobaReminderOff" data-click="tobaClearReminder" hidden>Desligar</button>
          <button type="submit" class="btn btn-primary" id="tobaReminderSave">📅 Criar na agenda</button>
        </div>
      </div>
    </form>
  </div>
</div>`;

function tobaOpenReminder(config) {
  if (!document.getElementById("tobaReminderModal")) document.body.insertAdjacentHTML("beforeend", TOBA_REMINDER_HTML);
  tobaReminderConfig = config;
  // No app o próprio Toba avisa (alarme do Android); no navegador vai pela agenda.
  let saved = null;
  if (TOBA_NATIVE) {
    try {
      saved = JSON.parse(TOBA_NATIVE.getReminder(config.id) || "null");
    } catch (err) {
      saved = null;
    }
  }
  const times = saved?.times?.length ? saved.times : config.times;
  const days = saved?.days?.length ? saved.days : config.days;
  document.getElementById("tobaReminderHelp").innerHTML = TOBA_NATIVE
    ? `O Toba avisa nesses horários, mesmo com o app fechado.${saved ? " <b>Ligado.</b>" : ""}`
    : "Baixa um arquivo de agenda. Abra ele e toque em <b>Adicionar</b>: o calendário do celular avisa no horário, mesmo com o app fechado. Para mudar depois, crie de novo (substitui) ou apague na agenda.";
  document.getElementById("tobaReminderSave").textContent = TOBA_NATIVE ? (saved ? "🔔 Salvar" : "🔔 Ligar lembrete") : "📅 Criar na agenda";
  document.getElementById("tobaReminderOff").hidden = !saved;
  document.getElementById("tobaReminderTitle").textContent = config.title;
  document.getElementById("tobaReminderText").textContent = `Aviso: "${config.message}"`;
  document.getElementById("tobaReminderTimes").innerHTML = times
    .map((time, i) => `<input type="time" class="form-control" value="${escapeHtml(time)}" required aria-label="Horário ${i + 1}" />`)
    .join("");
  document.getElementById("tobaReminderDays").innerHTML = TOBA_WEEK_DAYS
    .map(([code, label]) => `<label class="toba-day"><input type="checkbox" value="${code}"${days.includes(code) ? " checked" : ""} /><span>${label}</span></label>`)
    .join("");
  openTobaModal("tobaReminderModal");
}

tobaActions({
  tobaSaveReminder: async (form) => {
    if (!tobaReminderConfig) return;
    const times = [...new Set([...form.querySelectorAll("#tobaReminderTimes input")].map((input) => input.value).filter(Boolean))].sort();
    const days = [...form.querySelectorAll("#tobaReminderDays input:checked")].map((input) => input.value);
    if (!times.length || !days.length) {
      showPageMessage("Escolha pelo menos um horário e um dia.", { title: "Faltou escolher", icon: "🗓️" });
      return;
    }
    if (TOBA_NATIVE) {
      const { id, title, message } = tobaReminderConfig;
      const url = location.href.split(/[?#]/)[0];
      if (!TOBA_NATIVE.setReminder(id, JSON.stringify({ title, message, times, days, url }))) {
        showPageMessage("Não consegui ligar o lembrete.", { title: "Ops", icon: "😵" });
        return;
      }
      tobaAskNotify();
      closeTobaModal("tobaReminderModal");
      tobaToast(`🔔 Lembrete ligado: ${times.join(", ")}`);
      return;
    }
    tobaDownloadIcs({ ...tobaReminderConfig, times, days }, `toba-lembrete-${tobaReminderConfig.id}.ics`);
    closeTobaModal("tobaReminderModal");
    tobaToast("📅 Arquivo baixado: abra para pôr na agenda");
  },
  tobaClearReminder: () => {
    if (!TOBA_NATIVE || !tobaReminderConfig) return;
    TOBA_NATIVE.clearReminder(tobaReminderConfig.id);
    closeTobaModal("tobaReminderModal");
    tobaToast("🔕 Lembrete desligado");
  },
});

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
