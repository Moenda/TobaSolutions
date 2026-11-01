/* =====================================================================
 * Toba Kitchen · Lista de compras (js/compras.js, desde v1.53)
 * Junta os ingredientes das receitas da semana com os itens avulsos
 * (papel higiênico, ração, café...), separados por seção do mercado e em
 * ordem alfabética dentro de cada seção (kitchenShoppingList).
 * - Ingrediente de receita: marcado fica em db.shopping[segunda].checked
 *   (vale só pra aquela semana, como sempre foi).
 * - Avulso: mora em db.extras com o próprio "checked" e vale pra qualquer
 *   semana até sair da lista (✕ ou "🧹 Tirar avulsos comprados").
 * Depende de ../assets/toba-common.js, kitchen-recipes.js e kitchen-core.js.
 * ===================================================================== */
let shopMonday = initialShopWeek();
let extraAisle = "mercearia";
let extraAisleTouched = false; // escolheu na mão: o palpite pelo nome não mexe mais

function initialShopWeek() {
  const param = new URLSearchParams(window.location.search).get("semana");
  return param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? kitchenWeekMonday(param) : kitchenWeekMonday();
}

function shopWeekLabel(monday) {
  return `${isoToBrDate(monday).slice(0, 5)} – ${isoToBrDate(kitchenAddDays(monday, 6)).slice(0, 5)}`;
}

function shoppingChecked() {
  const week = kitchenDb.shopping[shopMonday];
  return new Set(week && Array.isArray(week.checked) ? week.checked : []);
}

function findExtra(id) {
  return kitchenDb.extras.find((x) => String(x.id) === String(id)) || null;
}

function isItemChecked(item, checked) {
  return item.extra ? item.checked : checked.has(item.key);
}

/* ---------------------------------------------------------------------
 * Lista
 * ------------------------------------------------------------------- */
function shopRow(item, checked, countable) {
  const isChecked = isItemChecked(item, checked);
  const sub = item.extra ? "➕ avulso" : item.recipes.join(", ");
  return `
    <label class="kt-shop-item${isChecked ? " is-checked" : ""}${item.extra ? " is-extra" : ""}">
      <input type="checkbox" data-change="toggleShopItem" data-key="${escapeHtml(item.key)}"${item.extra ? ' data-extra="1"' : ""}${isChecked ? " checked" : ""}${countable ? "" : ' data-home="1"'} />
      <span class="kt-shop-text">
        <span class="kt-shop-name">${item.info.emoji} ${escapeHtml(item.info.name)}${item.optional ? ' <span class="text-muted">(opcional)</span>' : ""}</span>
        <span class="kt-shop-for">${escapeHtml(sub)}</span>
      </span>
      ${item.amountText ? `<span class="kt-shop-qty">${escapeHtml(item.amountText)}</span>` : ""}
      ${item.extra ? `<button type="button" class="kt-shop-del" data-click="removeExtra" data-id="${escapeHtml(item.key)}" aria-label="Tirar ${escapeHtml(item.info.name)} da lista">✕</button>` : ""}
    </label>`;
}

function renderShopping() {
  const thisWeek = kitchenWeekMonday();
  const shop = kitchenShoppingList(kitchenDb, shopMonday);
  const checked = shoppingChecked();
  const buyItems = shop.buy.flatMap((g) => g.items);
  const got = buyItems.filter((i) => isItemChecked(i, checked)).length;
  const fromRecipes = buyItems.length - shop.extras;
  document.getElementById("shopWeekLabel").textContent = `${shopWeekLabel(shopMonday)}${shopMonday === thisWeek ? " · esta semana" : ""}`;
  document.getElementById("shopSummary").textContent = buyItems.length
    ? `🍳 ${fromRecipes} das receitas · ➕ ${shop.extras} ${shop.extras === 1 ? "avulso" : "avulsos"}`
    : "";
  document.getElementById("shopProgress").textContent = buyItems.length ? `🛒 ${got}/${buyItems.length}` : "";
  document.getElementById("shopFill").style.width = buyItems.length ? `${Math.round((got / buyItems.length) * 100)}%` : "0%";

  let html = "";
  if (!buyItems.length && !shop.home.length && !shop.staples.length) {
    html = tobaEmpty("🛒", "Lista vazia", "Programa umas receitas na Semana ou toca no + Item pra pôr qualquer coisa.");
  }
  if (!buyItems.length && (shop.home.length || shop.staples.length)) {
    html += '<div class="hint-box kt-hint">🎉 Pelo que você marcou no 🧺, não precisa comprar nada das receitas!</div>';
  }
  shop.buy.forEach((group) => {
    const left = group.items.filter((i) => !isItemChecked(i, checked)).length;
    html += `<div class="section-title">${group.icon} ${group.name} <span class="text-muted kt-small">${left ? `${left} pra pegar` : "tudo no carrinho ✅"}</span></div>`
      + `<div class="card kt-shop-group">${group.items.map((i) => shopRow(i, checked, true)).join("")}</div>`;
  });
  if (shop.home.length) {
    html += `<div class="section-title">🏠 Já tem em casa <span class="text-muted kt-small">marcado no 🧺</span></div><div class="card kt-shop-group">${shop.home.map((i) => shopRow(i, checked, false)).join("")}</div>`;
  }
  if (shop.staples.length) {
    html += `<div class="section-title">🧂 Básicos <span class="text-muted kt-small">confere se tem</span></div><div class="card kt-shop-group">${shop.staples.map((i) => shopRow(i, checked, false)).join("")}</div>`;
  }
  document.getElementById("shopList").innerHTML = html;

  const bought = kitchenDb.extras.filter((x) => x.checked === true && String(x.name || "").trim()).length;
  const clearBtn = document.getElementById("clearExtrasBtn");
  clearBtn.hidden = !bought;
  clearBtn.textContent = `🧹 Tirar avulsos comprados (${bought})`;
}

function toggleShopItem(el) {
  if (el.dataset.extra) {
    const extra = findExtra(el.dataset.key);
    if (!extra) return renderShopping();
    const before = extra.checked;
    extra.checked = el.checked;
    if (!saveKitchenDb({ silent: true })) extra.checked = before;
  } else {
    const checked = shoppingChecked();
    const before = kitchenDb.shopping[shopMonday];
    if (el.checked) checked.add(el.dataset.key);
    else checked.delete(el.dataset.key);
    kitchenDb.shopping[shopMonday] = { ...(before || {}), checked: [...checked] };
    if (!saveKitchenDb({ silent: true })) {
      if (before) kitchenDb.shopping[shopMonday] = before;
      else delete kitchenDb.shopping[shopMonday];
    }
  }
  renderShopping();
}

async function uncheckAll() {
  const extrasOn = kitchenDb.extras.filter((x) => x.checked === true);
  if (!shoppingChecked().size && !extrasOn.length) return;
  const ok = await showPageMessage("Desmarcar todos os itens da lista? Os avulsos continuam nela, só desmarcados.", { title: "Desmarcar tudo", confirm: true, confirmLabel: "Desmarcar" });
  if (!ok) return;
  const beforeWeek = kitchenDb.shopping[shopMonday];
  delete kitchenDb.shopping[shopMonday];
  extrasOn.forEach((x) => { x.checked = false; });
  if (!saveKitchenDb()) {
    if (beforeWeek) kitchenDb.shopping[shopMonday] = beforeWeek;
    extrasOn.forEach((x) => { x.checked = true; });
  }
  renderShopping();
}

/* ---------------------------------------------------------------------
 * Itens avulsos
 * ------------------------------------------------------------------- */
// Guarda em "Já comprou antes" (mais novo primeiro, sem repetir nome)
function rememberExtra(name, aisle) {
  const norm = kitchenNormalizeText(name);
  kitchenDb.extrasRecent = [{ name: String(name).trim(), aisle }]
    .concat(kitchenDb.extrasRecent.filter((r) => kitchenNormalizeText(r.name) !== norm))
    .slice(0, KITCHEN_RECENT_MAX);
}

function openExtraSheet() {
  document.getElementById("extraName").value = "";
  document.getElementById("extraQty").value = "";
  extraAisle = "mercearia";
  extraAisleTouched = false;
  renderExtraSheet();
  openTobaModal("extraSheet");
  setTimeout(() => document.getElementById("extraName").focus(), 60);
}

function renderExtraSheet() {
  document.getElementById("extraAisles").innerHTML = KITCHEN_AISLES.map((a) => `
    <button type="button" class="kt-aisle-tile${a.key === extraAisle ? " is-selected" : ""}" data-click="pickExtraAisle" data-aisle="${a.key}">
      <span class="kt-aisle-emoji">${a.icon}</span>
      <span class="kt-aisle-name">${escapeHtml(a.short || a.name)}</span>
    </button>`).join("");
  const inList = new Set(kitchenExtrasOf(kitchenDb).map((x) => kitchenNormalizeText(x.name)));
  const recent = kitchenDb.extrasRecent.filter((r) => !inList.has(kitchenNormalizeText(r.name)));
  document.getElementById("extraRecent").innerHTML = recent.length
    ? `<div class="kt-field-label">↺ Já comprou antes <span class="text-muted kt-small">toca e volta pra lista</span></div>
       <div class="kt-chips is-wrap">${recent.map((r) => {
         const aisle = kitchenAisle(r.aisle) || kitchenAisle("outros");
         const known = kitchenFindIngredientByName(r.name);
         return `<button type="button" class="chip-btn kt-chip" data-click="readdExtra" data-name="${escapeHtml(r.name)}" data-aisle="${escapeHtml(aisle.key)}">${known ? known.emoji : aisle.icon} ${escapeHtml(r.name)}</button>`;
       }).join("")}</div>`
    : "";
}

// Palpite de seção pelo nome (só sugere; o quadradinho tocado sempre vale)
const KITCHEN_AISLE_HINTS = [
  ["pet", ["racao", "areia", "sache", "petisco", "gato", "cachorro", "killua", "gon"]],
  ["higiene", ["papel higienico", "sabonete", "shampoo", "xampu", "condicionador", "pasta de dente", "creme dental", "escova de dente", "desodorante", "fio dental", "absorvente", "barbeador", "lamina", "cotonete", "hidratante", "protetor solar"]],
  ["limpeza", ["detergente", "sabao", "amaciante", "agua sanitaria", "desinfetante", "esponja", "saco de lixo", "papel toalha", "alcool", "multiuso", "lustra", "vassoura", "pano"]],
  ["bebidas", ["agua", "refri", "suco", "cerveja", "breja", "vinho", "energetico", "isotonico", "coca", "guarana", "cha gelado"]],
  ["padaria", ["pao", "bisnaguinha", "torrada", "bolo", "croissant", "sonho"]],
  ["acougue", ["carne", "frango", "linguica", "bacon", "picanha", "patinho", "costela", "file", "peixe", "salmao", "tilapia"]],
  ["frios", ["leite", "iogurte", "queijo", "presunto", "requeijao", "manteiga", "margarina", "peito de peru", "creme de leite"]],
  ["horti", ["fruta", "alface", "tomate", "cebola", "batata", "cenoura", "maca", "laranja", "mamao", "uva", "morango", "limao", "abacaxi", "melancia", "pepino", "brocolis", "couve", "rucula"]],
  ["temperos", ["tempero", "pimenta", "oregano", "cominho", "paprica", "colorau", "louro", "canela"]],
  ["mercearia", ["cafe", "arroz", "feijao", "macarrao", "acucar", "farinha", "oleo", "azeite", "biscoito", "bolacha", "molho", "aveia", "granola", "chocolate", "atum", "sardinha", "milho", "ervilha"]],
];

function kitchenGuessAisle(name) {
  const known = kitchenFindIngredientByName(name);
  if (known) return known.aisle || "mercearia";
  const norm = ` ${kitchenNormalizeText(name)} `;
  const hit = KITCHEN_AISLE_HINTS.find(([, words]) => words.some((w) => norm.includes(` ${w}`)));
  return hit ? hit[0] : null;
}

// Digitou "ração", "detergente", "pão"...? Já sugere a seção.
function guessExtraAisle(el) {
  if (extraAisleTouched) return;
  const guess = kitchenGuessAisle(el.value);
  if (guess && guess !== extraAisle) {
    extraAisle = guess;
    renderExtraSheet();
  }
}

// Põe na lista. Já tem com esse nome? Desmarca (se tava marcado) em vez de duplicar.
function addExtra(name, aisle, qty = "") {
  const typed = String(name || "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!typed) return false;
  const clean = typed.charAt(0).toUpperCase() + typed.slice(1); // "banana" -> "Banana"
  const norm = kitchenNormalizeText(clean);
  const same = kitchenDb.extras.find((x) => kitchenNormalizeText(x.name) === norm);
  if (same) {
    if (same.checked) {
      same.checked = false;
      if (!saveKitchenDb({ silent: true })) same.checked = true;
      tobaToast(`↺ ${clean} voltou pra lista`);
    } else {
      tobaToast(`👀 ${clean} já tá na lista`);
    }
    return true;
  }
  const extra = { id: kitchenNewId("x"), name: clean, aisle: kitchenAisle(aisle) ? aisle : "outros", qty: String(qty || "").trim().slice(0, 20), checked: false, addedAt: Date.now() };
  kitchenDb.extras.push(extra);
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.extras = kitchenDb.extras.filter((x) => x !== extra);
    return false;
  }
  tobaToast(`🛒 ${clean} na lista!`);
  return true;
}

function saveExtra() {
  const nameEl = document.getElementById("extraName");
  if (!nameEl.value.trim()) {
    nameEl.focus();
    tobaToast("✍️ Escreve o que comprar");
    return;
  }
  if (!addExtra(nameEl.value, extraAisle, document.getElementById("extraQty").value)) return;
  // Folha continua aberta pra pôr o próximo
  nameEl.value = "";
  document.getElementById("extraQty").value = "";
  extraAisleTouched = false;
  renderExtraSheet();
  renderShopping();
  nameEl.focus();
}

function removeExtra(el, event) {
  if (event) event.preventDefault(); // o ✕ fica dentro do <label>: não marca o item
  const extra = findExtra(el.dataset.id);
  if (!extra) return;
  const index = kitchenDb.extras.indexOf(extra);
  const beforeRecent = kitchenDb.extrasRecent;
  kitchenDb.extras.splice(index, 1);
  rememberExtra(extra.name, extra.aisle);
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.extras.splice(index, 0, extra);
    kitchenDb.extrasRecent = beforeRecent;
  } else {
    tobaToast(`🗑️ ${extra.name} saiu da lista`);
  }
  renderShopping();
}

async function clearBoughtExtras() {
  const bought = kitchenDb.extras.filter((x) => x.checked === true && String(x.name || "").trim());
  if (!bought.length) return;
  const ok = await showPageMessage(`Tira ${bought.length} ${bought.length === 1 ? "avulso comprado" : "avulsos comprados"} da lista. Eles ficam em "↺ Já comprou antes" no + Item, pra voltar com um toque.`, { title: "Tirar comprados", icon: "🧹", confirm: true, danger: false, confirmLabel: "Tirar" });
  if (!ok) return;
  const beforeExtras = kitchenDb.extras.slice();
  const beforeRecent = kitchenDb.extrasRecent;
  kitchenDb.extras = kitchenDb.extras.filter((x) => !bought.includes(x));
  bought.slice().reverse().forEach((x) => rememberExtra(x.name, x.aisle));
  if (!saveKitchenDb()) {
    kitchenDb.extras = beforeExtras;
    kitchenDb.extrasRecent = beforeRecent;
  }
  renderShopping();
}

/* ---------------------------------------------------------------------
 * Mandar lista: só o que falta pegar + os básicos pra conferir
 * ------------------------------------------------------------------- */
function shoppingText() {
  const shop = kitchenShoppingList(kitchenDb, shopMonday);
  const checked = shoppingChecked();
  const lines = [`🛒 Lista do Toba · ${shopWeekLabel(shopMonday)}`];
  shop.buy.forEach((group) => {
    const items = group.items.filter((i) => !isItemChecked(i, checked));
    if (!items.length) return;
    lines.push("", `${group.icon} ${group.name}`);
    items.forEach((i) => lines.push(`• ${i.info.name}${i.amountText ? `: ${i.amountText}` : ""}`));
  });
  const staples = shop.staples.filter((i) => !checked.has(i.key));
  if (staples.length) lines.push("", `🧂 Confere se tem: ${staples.map((i) => i.info.name.toLowerCase()).join(", ")}`);
  return lines.join("\n");
}

async function copyShopping() {
  const text = shoppingText();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Lista de compras", text });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // desistiu de mandar
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    tobaToast("📋 Lista copiada! Cola no WhatsApp.");
  } catch (err) {
    showPageMessage(text, { title: "Copia daqui", icon: "📋" });
  }
}

/* ---------------------------------------------------------------------
 * Ações e abertura da página
 * ------------------------------------------------------------------- */
function onKitchenDataReplaced() {
  renderShopping();
}

tobaActions({
  moveShopWeek: (el) => {
    shopMonday = kitchenAddDays(shopMonday, 7 * Number(el.dataset.dir));
    renderShopping();
  },
  toggleShopItem,
  uncheckAll,
  copyShopping,
  openExtraSheet,
  pickExtraAisle: (el) => {
    extraAisle = el.dataset.aisle;
    extraAisleTouched = true;
    renderExtraSheet();
  },
  guessExtraAisle,
  saveExtra,
  readdExtra: (el) => {
    if (addExtra(el.dataset.name, el.dataset.aisle)) {
      renderExtraSheet();
      renderShopping();
    }
  },
  removeExtra,
  clearBoughtExtras,
});

// Voltou de outra página pelo "‹" do navegador: relê o banco
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    kitchenDb = loadKitchenDb();
    renderShopping();
  }
});

renderShopping();
