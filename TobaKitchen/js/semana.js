/* =====================================================================
 * Toba Kitchen · Programação da Semana (js/semana.js)
 * Receitas por dia (seg a dom) e a lista de compras que sai delas.
 * Depende de ../assets/toba-common.js, kitchen-recipes.js e kitchen-core.js.
 * ===================================================================== */
const KITCHEN_WEEK_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

let weekMonday = kitchenWeekMonday();
let pickerDate = null;
let pickerMeal = null;
let pickerQuery = "";
let entryId = null;

function weekRangeLabel(monday) {
  return `${isoToBrDate(monday).slice(0, 5)} – ${isoToBrDate(kitchenAddDays(monday, 6)).slice(0, 5)}`;
}

function planEntryDone(entry) {
  return kitchenDb.cooked.some((c) => String(c.planId || "") === String(entry.id));
}

function mealOrder(key) {
  const index = KITCHEN_MEALS.findIndex((m) => m.key === key);
  return index < 0 ? 99 : index;
}

function showWeekView(id) {
  document.querySelectorAll(".container > .app-view").forEach((view) => view.classList.toggle("active", view.id === id));
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------------
 * Semana
 * ------------------------------------------------------------------- */
function openWeek() {
  showWeekView("viewWeek");
  tobaSetHeader({ page: "📅 Semana" });
  renderWeek();
}

function renderWeek() {
  const today = toIsoDate();
  const thisWeek = kitchenWeekMonday(today);
  document.getElementById("weekLabel").textContent = `${weekRangeLabel(weekMonday)}${weekMonday === thisWeek ? " · esta semana" : ""}`;
  const plan = kitchenPlanOfWeek(kitchenDb, weekMonday);
  const shop = kitchenShoppingList(kitchenDb, weekMonday);
  const daysWithFood = new Set(plan.map((p) => p.date));
  const kcal = [...daysWithFood].reduce((sum, day) => sum + kitchenDayKcal(kitchenDb, day), 0);
  const done = plan.filter(planEntryDone).length;
  const tile = (label, value, sub) => `
    <div class="toba-stat">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </div>`;
  document.getElementById("weekStats").innerHTML =
    tile("🍽️ Receitas", `<span class="text-coral">${plan.length}</span>`, plan.length ? `${done} já feitas` : "nada programado")
    + tile("🔥 Por dia", daysWithFood.size ? `${Math.round(kcal / daysWithFood.size)} kcal` : "--", "1 porção de cada");
  const shopBtn = document.getElementById("shopBtn");
  shopBtn.hidden = !plan.length;
  shopBtn.textContent = `🛒 Lista de compras (${shop.count} ${shop.count === 1 ? "item" : "itens"})`;

  document.getElementById("weekDays").innerHTML = KITCHEN_WEEK_NAMES.map((name, i) => {
    const day = kitchenAddDays(weekMonday, i);
    const entries = plan.filter((p) => p.date === day).sort((a, b) => mealOrder(a.meal) - mealOrder(b.meal));
    const dayKcal = kitchenDayKcal(kitchenDb, day);
    const items = entries.map((entry) => {
      const recipe = kitchenRecipe(entry.recipeId);
      const meal = kitchenMeal(entry.meal);
      const isDone = planEntryDone(entry);
      return `
        <div class="kt-plan-item${isDone ? " is-done" : ""}" role="button" tabindex="0" data-click="openEntry" data-id="${escapeHtml(entry.id)}">
          <span class="kt-plan-emoji">${recipe.emoji}</span>
          <span class="kt-plan-text">
            <span class="kt-plan-name">${escapeHtml(recipe.name)}</span>
            <span class="kt-plan-meta">${meal ? `${meal.icon} ${meal.short} · ` : ""}${entry.servings} ${Number(entry.servings) === 1 ? "porção" : "porções"}</span>
          </span>
          <span>${isDone ? "✅" : "›"}</span>
        </div>`;
    }).join("");
    return `
      <div class="card kt-day${day === today ? " is-today" : ""}${day < today ? " is-past" : ""}">
        <div class="kt-day-head">
          <span class="kt-day-name">${name} · ${isoToBrDate(day).slice(0, 5)}${day === today ? ' <span class="kt-tag">hoje</span>' : ""}</span>
          ${dayKcal ? `<span class="kt-day-kcal">🔥 ~${dayKcal} kcal</span>` : ""}
        </div>
        <div class="kt-plan-list">${items}</div>
        <button type="button" class="chip-btn kt-add-day" data-click="openPicker" data-date="${day}">➕ Receita</button>
      </div>`;
  }).join("");
}

/* ---------------------------------------------------------------------
 * Escolher receita pro dia
 * ------------------------------------------------------------------- */
function openPicker(date) {
  pickerDate = date;
  pickerMeal = null;
  pickerQuery = "";
  document.getElementById("pickerSearch").value = "";
  const i = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
  document.getElementById("pickerTitle").textContent = `➕ ${KITCHEN_WEEK_NAMES[i]} ${isoToBrDate(date).slice(0, 5)}`;
  renderPicker();
  openTobaModal("pickerSheet");
}

function renderPicker() {
  const chips = [{ key: null, icon: "📚", short: "Todas" }, ...KITCHEN_MEALS];
  document.getElementById("pickerMeals").innerHTML = chips.map((m) => `
    <button type="button" class="chip-btn kt-chip${pickerMeal === m.key ? " is-on" : ""}" data-click="pickPickerMeal" data-meal="${m.key || ""}">${m.icon} ${m.short}</button>`).join("");
  const q = String(pickerQuery || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const list = KITCHEN_RECIPES
    .filter((r) => !pickerMeal || r.meals.includes(pickerMeal))
    .filter((r) => !q || r.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q));
  document.getElementById("pickerList").innerHTML = list.length
    ? list.map((r) => `
      <div class="toba-list-item kt-recipe" role="button" tabindex="0" data-click="addEntry" data-id="${r.id}">
        <span class="kt-recipe-emoji">${r.emoji}</span>
        <span class="kt-recipe-text">
          <span class="kt-recipe-name">${escapeHtml(r.name)}</span>
          <span class="kt-recipe-meta">⏱️ ${r.minutes} min · 🔥 ${r.kcal} kcal · 🍽️ ${r.servings}</span>
        </span>
        <span class="toba-hub-chevron">＋</span>
      </div>`).join("")
    : tobaEmpty("🤷", "Nada com esse nome", "Tenta outra palavra.");
}

function addEntry(recipeId) {
  const recipe = kitchenRecipe(recipeId);
  if (!recipe || !pickerDate) return;
  const meal = pickerMeal && recipe.meals.includes(pickerMeal) ? pickerMeal : pickerMeal || recipe.meals[0];
  kitchenDb.plan.push({ id: kitchenNewId("p"), date: pickerDate, recipeId: recipe.id, meal, servings: recipe.servings });
  if (!saveKitchenDb()) return;
  closeTobaModal("pickerSheet");
  renderWeek();
}

/* ---------------------------------------------------------------------
 * Uma receita do dia: porções, refeição, cozinhar, fiz/comi, tirar
 * ------------------------------------------------------------------- */
function findEntry(id = entryId) {
  return kitchenDb.plan.find((p) => String(p.id) === String(id)) || null;
}

function openEntry(id) {
  entryId = id;
  if (!findEntry()) return;
  renderEntry();
  openTobaModal("entrySheet");
}

function renderEntry() {
  const entry = findEntry();
  if (!entry) return;
  const recipe = kitchenRecipe(entry.recipeId);
  const isDone = planEntryDone(entry);
  const servings = Number(entry.servings) || recipe.servings;
  document.getElementById("entryTitle").textContent = `${recipe.emoji} ${recipe.name}`;
  document.getElementById("entryBody").innerHTML = `
    <p class="toba-sheet-text">${isoToBrDate(entry.date)} · ⏱️ ${recipe.minutes} min · 🔥 ${recipe.kcal} kcal por porção${isDone ? " · ✅ já feita" : ""}</p>
    <div class="kt-chips is-wrap">${KITCHEN_MEALS.map((m) => `
      <button type="button" class="chip-btn kt-chip${entry.meal === m.key ? " is-on" : ""}" data-click="setEntryMeal" data-meal="${m.key}">${m.icon} ${m.short}</button>`).join("")}
    </div>
    <div class="kt-ing kt-entry-servings">
      <span class="kt-ing-name">🍽️ Porções (pra lista de compras)</span>
      <span class="kt-stepper">
        <button type="button" class="round-btn" data-click="setEntryServings" data-dir="-1" aria-label="Menos porções"${servings <= 1 ? " disabled" : ""}>−</button>
        <strong>${servings}</strong>
        <button type="button" class="round-btn" data-click="setEntryServings" data-dir="1" aria-label="Mais porções"${servings >= 20 ? " disabled" : ""}>+</button>
      </span>
    </div>
    <div class="toba-sheet-footer">
      <button type="button" class="btn kt-btn-fire" data-click="cookEntry">👨‍🍳 Cozinhar agora (passo a passo)</button>
      <div class="btn-row" style="margin-top: 8px">
        ${isDone
          ? '<button type="button" class="btn btn-secondary" data-click="undoEntryDone">↩ Ainda não fiz</button>'
          : '<button type="button" class="btn btn-primary" data-click="entryDone">✅ Fiz / comi</button>'}
        <button type="button" class="btn btn-secondary" data-click="viewEntryRecipe">📖 Receita</button>
      </div>
      <button type="button" class="btn btn-secondary text-red" style="margin-top: 8px" data-click="removeEntry">🗑️ Tirar do dia</button>
    </div>`;
}

function setEntryMeal(meal) {
  const entry = findEntry();
  if (!entry) return;
  entry.meal = meal;
  saveKitchenDb({ silent: true });
  renderEntry();
  renderWeek();
}

function setEntryServings(dir) {
  const entry = findEntry();
  if (!entry) return;
  entry.servings = Math.max(1, Math.min(20, (Number(entry.servings) || 1) + dir));
  saveKitchenDb({ silent: true });
  renderEntry();
  renderWeek();
}

function entryDone() {
  const entry = findEntry();
  if (!entry) return;
  const saved = kitchenMarkCooked(entry.recipeId, { servings: entry.servings, planId: entry.id });
  if (!saved) return;
  const count = kitchenCookedCount(kitchenDb, entry.recipeId);
  closeTobaModal("entrySheet");
  renderWeek();
  tobaSaved(`👨‍🍳 +1! ${count}× feita`);
}

async function undoEntryDone() {
  const entry = findEntry();
  if (!entry) return;
  const cooked = kitchenDb.cooked.filter((c) => String(c.planId || "") === String(entry.id));
  if (!cooked.length) return;
  kitchenDb.cooked = kitchenDb.cooked.filter((c) => String(c.planId || "") !== String(entry.id));
  saveKitchenDb();
  renderEntry();
  renderWeek();
}

async function removeEntry() {
  const entry = findEntry();
  if (!entry) return;
  const recipe = kitchenRecipe(entry.recipeId);
  const ok = await showPageMessage(`Tirar ${recipe.name} de ${isoToBrDate(entry.date).slice(0, 5)}? (Se já fez, o contador continua.)`, { title: "Tirar do dia", confirm: true, confirmLabel: "Tirar" });
  if (!ok) return;
  kitchenDb.plan = kitchenDb.plan.filter((p) => String(p.id) !== String(entry.id));
  saveKitchenDb();
  closeTobaModal("entrySheet");
  renderWeek();
}

function goToRecipePage(params) {
  window.location.href = `TobaKitchen-Receitas.html?${new URLSearchParams(params).toString()}`;
}

/* ---------------------------------------------------------------------
 * Lista de compras (marcados ficam guardados por semana, pelo id do ingrediente)
 * ------------------------------------------------------------------- */
function shoppingChecked() {
  const week = kitchenDb.shopping[weekMonday];
  return new Set(week && Array.isArray(week.checked) ? week.checked : []);
}

function openShopping() {
  showWeekView("viewShopping");
  tobaSetHeader({ page: "🛒 Lista de compras", back: "backToWeek" });
  renderShopping();
}

function shopRow(item, checked, countable) {
  const isChecked = checked.has(item.key);
  return `
    <label class="kt-shop-item${isChecked ? " is-checked" : ""}">
      <input type="checkbox" data-change="toggleShopItem" data-key="${escapeHtml(item.key)}"${isChecked ? " checked" : ""}${countable ? "" : ' data-extra="1"'} />
      <span class="kt-shop-text">
        <span class="kt-shop-name">${item.info.emoji} ${escapeHtml(item.info.name)}${item.optional ? ' <span class="text-muted">(opcional)</span>' : ""}</span>
        <span class="kt-shop-for">${escapeHtml(item.recipes.join(", "))}</span>
      </span>
      <span class="kt-shop-qty">${item.amountText}</span>
    </label>`;
}

function renderShopping() {
  const shop = kitchenShoppingList(kitchenDb, weekMonday);
  const checked = shoppingChecked();
  const buyItems = shop.buy.flatMap((g) => g.items);
  const got = buyItems.filter((i) => checked.has(i.key)).length;
  document.getElementById("shopWeekLabel").textContent = `Semana ${weekRangeLabel(weekMonday)}`;
  document.getElementById("shopProgress").textContent = buyItems.length ? `🛒 ${got}/${buyItems.length} no carrinho` : "";
  document.getElementById("shopFill").style.width = buyItems.length ? `${Math.round((got / buyItems.length) * 100)}%` : "0%";
  let html = "";
  if (!buyItems.length && !shop.home.length && !shop.staples.length) {
    html = tobaEmpty("🛒", "Lista vazia", "Programa umas receitas na semana que a lista aparece aqui.");
  }
  if (!buyItems.length && (shop.home.length || shop.staples.length)) {
    html += '<div class="hint-box kt-hint">🎉 Pelo que você marcou no 🧺, não precisa comprar nada!</div>';
  }
  shop.buy.forEach((group) => {
    html += `<div class="section-title">${group.icon} ${group.name}</div><div class="card kt-shop-group">${group.items.map((i) => shopRow(i, checked, true)).join("")}</div>`;
  });
  if (shop.home.length) {
    html += `<div class="section-title">🏠 Já tem em casa <span class="text-muted kt-small">marcado no 🧺</span></div><div class="card kt-shop-group">${shop.home.map((i) => shopRow(i, checked, false)).join("")}</div>`;
  }
  if (shop.staples.length) {
    html += `<div class="section-title">🧂 Básicos <span class="text-muted kt-small">confere se tem</span></div><div class="card kt-shop-group">${shop.staples.map((i) => shopRow(i, checked, false)).join("")}</div>`;
  }
  document.getElementById("shopList").innerHTML = html;
}

function toggleShopItem(el) {
  const checked = shoppingChecked();
  if (el.checked) checked.add(el.dataset.key);
  else checked.delete(el.dataset.key);
  kitchenDb.shopping[weekMonday] = { checked: [...checked] };
  saveKitchenDb({ silent: true });
  renderShopping();
}

async function uncheckAll() {
  if (!shoppingChecked().size) return;
  const ok = await showPageMessage("Desmarcar todos os itens da lista?", { title: "Desmarcar tudo", confirm: true, confirmLabel: "Desmarcar" });
  if (!ok) return;
  delete kitchenDb.shopping[weekMonday];
  saveKitchenDb();
  renderShopping();
}

// Texto da lista: só o que falta pegar + os básicos pra conferir
function shoppingText() {
  const shop = kitchenShoppingList(kitchenDb, weekMonday);
  const checked = shoppingChecked();
  const lines = [`🛒 Lista do Toba · ${weekRangeLabel(weekMonday)}`];
  shop.buy.forEach((group) => {
    const items = group.items.filter((i) => !checked.has(i.key));
    if (!items.length) return;
    lines.push("", `${group.icon} ${group.name}`);
    items.forEach((i) => lines.push(`• ${i.info.name}: ${i.amountText}`));
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
  openWeek();
}

tobaActions({
  moveWeek: (el) => {
    weekMonday = kitchenAddDays(weekMonday, 7 * Number(el.dataset.dir));
    renderWeek();
  },
  openPicker: (el) => openPicker(el.dataset.date),
  filterPicker: (el) => {
    pickerQuery = el.value;
    renderPicker();
  },
  pickPickerMeal: (el) => {
    pickerMeal = el.dataset.meal || null;
    renderPicker();
  },
  addEntry: (el) => addEntry(el.dataset.id),
  openEntry: (el) => openEntry(el.dataset.id),
  setEntryMeal: (el) => setEntryMeal(el.dataset.meal),
  setEntryServings: (el) => setEntryServings(Number(el.dataset.dir)),
  entryDone,
  undoEntryDone,
  removeEntry,
  cookEntry: () => {
    const entry = findEntry();
    if (entry) goToRecipePage({ cook: entry.recipeId, plan: entry.id, s: entry.servings });
  },
  viewEntryRecipe: () => {
    const entry = findEntry();
    if (entry) goToRecipePage({ r: entry.recipeId, s: entry.servings });
  },
  openShopping,
  backToWeek: openWeek,
  toggleShopItem,
  uncheckAll,
  copyShopping,
});

// Voltou do modo cozinha pelo "‹": redesenha (pode ter virado ✅)
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    kitchenDb = loadKitchenDb();
    renderWeek();
  }
});

openWeek();
