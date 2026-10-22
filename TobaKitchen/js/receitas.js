/* =====================================================================
 * Toba Kitchen · Livro de Receitas (js/receitas.js)
 * Livro (categorias + busca), "O que tem aí?" (busca pelos ingredientes),
 * detalhe da receita e o Modo cozinha (passo a passo com a tela acesa).
 * Depende de ../assets/toba-common.js, kitchen-recipes.js e kitchen-core.js.
 * ===================================================================== */
const KITCHEN_LIVE_KEY = "toba_kitchen_live"; // receita aberta no modo cozinha (temporário)
const KITCHEN_PREFS_KEY = "toba_kitchen_prefs"; // { keepAwake }

let bookMeal = "all";
let bookQuery = "";
let pantryQuery = "";
let recipeId = null;
let recipeServings = 1;
let recipeFrom = "book"; // pra onde o "‹" da receita volta: book | pantry
let cookTicker = 0;
let cookWakeLock = null;

/* ---------------------------------------------------------------------
 * Navegação entre as telas da página
 * ------------------------------------------------------------------- */
function showKitchenView(id) {
  document.querySelectorAll(".container > .app-view").forEach((view) => view.classList.toggle("active", view.id === id));
  document.getElementById("viewCook").classList.remove("active");
  window.scrollTo(0, 0);
}

function openBook() {
  stopCookTicker();
  showKitchenView("viewBook");
  tobaSetHeader({ page: "📖 Receitas" });
  renderBook();
}

function kitchenNormalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/* ---------------------------------------------------------------------
 * Livro: chips de refeição + lista
 * ------------------------------------------------------------------- */
function renderBookMeals() {
  const chips = [{ key: "all", icon: "📚", short: "Todas" }, ...KITCHEN_MEALS];
  document.getElementById("bookMeals").innerHTML = chips.map((m) => `
    <button type="button" class="chip-btn kt-chip${bookMeal === m.key ? " is-on" : ""}" data-click="pickBookMeal" data-meal="${m.key}">${m.icon} ${m.short}</button>`).join("");
}

function recipeMetaLine(recipe) {
  const author = kitchenAuthor(recipe);
  return `⏱️ ${routineLikeMinutes(recipe.minutes)} · 🔥 ${recipe.kcal} kcal · 🍽️ ${recipe.servings} · ${author.emoji} ${author.name}`;
}

// 90 -> "1h30", 45 -> "45 min", 1.5 -> "1,5 min" (o Kitchen não carrega o routine-metrics)
function routineLikeMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${String(Math.round(m * 10) / 10).replace(".", ",")} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function recipeCard(recipe, extra = "") {
  const count = kitchenCookedCount(kitchenDb, recipe.id);
  return `
    <div class="toba-list-item kt-recipe" role="button" tabindex="0" data-click="openRecipe" data-id="${recipe.id}">
      <span class="kt-recipe-emoji">${recipe.emoji}</span>
      <span class="kt-recipe-text">
        <span class="kt-recipe-name">${escapeHtml(recipe.name)}</span>
        <span class="kt-recipe-meta">${extra || recipeMetaLine(recipe)}</span>
      </span>
      ${count ? `<span class="kt-count" title="Vezes que você fez">${count}×</span>` : '<span class="toba-hub-chevron">›</span>'}
    </div>`;
}

function renderBook() {
  renderBookMeals();
  renderCookResume();
  const pantry = kitchenDb.pantry.length;
  document.getElementById("pantryLaunchDetail").textContent = pantry
    ? `${pantry} ${pantry === 1 ? "ingrediente marcado" : "ingredientes marcados"} · ${countCanMake()} receitas dá pra fazer já`
    : "Marca os ingredientes e o Toba diz o que dá pra fazer.";
  const q = kitchenNormalize(bookQuery.trim());
  const list = KITCHEN_RECIPES.filter((r) => bookMeal === "all" || r.meals.includes(bookMeal)).filter((r) => {
    if (!q) return true;
    const words = [r.name, kitchenAuthor(r).name, ...r.ingredients.map((i) => kitchenIngredient(i.id).name)].map(kitchenNormalize).join(" ");
    return words.includes(q);
  });
  const box = document.getElementById("bookList");
  if (!list.length) {
    box.innerHTML = tobaEmpty("🤷", "Nenhuma receita aqui", q ? "Tenta outra palavra (ou outro ingrediente)." : "Essa categoria ainda tá vazia. Pede pro Cloba carregar umas!");
    return;
  }
  box.innerHTML = list.map((r) => recipeCard(r)).join("");
}

/* ---------------------------------------------------------------------
 * O que tem aí? (despensa)
 * ------------------------------------------------------------------- */
function countCanMake() {
  const have = new Set(kitchenDb.pantry);
  return KITCHEN_RECIPES.filter((r) => !kitchenMatchRecipe(r, have).missing.length).length;
}

function openPantry(tab = "have") {
  stopCookTicker();
  showKitchenView("viewPantry");
  tobaSetHeader({ page: "🧺 O que tem aí?", back: "backToBook" });
  setPantryTab(tab);
}

function setPantryTab(tab) {
  document.getElementById("pantryTabHave").classList.toggle("active", tab === "have");
  document.getElementById("pantryTabCan").classList.toggle("active", tab === "can");
  document.getElementById("pantryHave").hidden = tab !== "have";
  document.getElementById("pantryCan").hidden = tab !== "can";
  renderPantry();
  if (tab === "can") renderPantryResults();
  window.scrollTo(0, 0);
}

// Só os ingredientes que aparecem em alguma receita (menos os básicos)
function pantryIngredientIds() {
  const ids = new Set();
  KITCHEN_RECIPES.forEach((r) => r.ingredients.forEach((i) => {
    if (!kitchenIngredient(i.id).staple) ids.add(i.id);
  }));
  return [...ids];
}

function renderPantry() {
  const have = new Set(kitchenDb.pantry);
  const q = kitchenNormalize(pantryQuery.trim());
  const ids = pantryIngredientIds().filter((id) => !q || kitchenNormalize(kitchenIngredient(id).name).includes(q));
  const groups = KITCHEN_AISLES.map((aisle) => ({
    ...aisle,
    ids: ids.filter((id) => (kitchenIngredient(id).aisle || "mercearia") === aisle.key)
      .sort((a, b) => kitchenIngredient(a).name.localeCompare(kitchenIngredient(b).name, "pt-BR")),
  })).filter((g) => g.ids.length);
  document.getElementById("pantryGroups").innerHTML = groups.length
    ? groups.map((g) => `
      <div class="kt-aisle">${g.icon} ${g.name}</div>
      <div class="kt-chips is-wrap">
        ${g.ids.map((id) => {
          const info = kitchenIngredient(id);
          return `<button type="button" class="chip-btn kt-chip${have.has(id) ? " is-on" : ""}" data-click="togglePantry" data-id="${id}" aria-pressed="${have.has(id)}">${info.emoji} ${escapeHtml(info.name)}</button>`;
        }).join("")}
      </div>`).join("")
    : tobaEmpty("🔎", "Nenhum ingrediente com esse nome", "Por enquanto só aparecem os que estão em alguma receita.");
  const can = countCanMake();
  document.getElementById("pantryTabCan").textContent = `🍳 Dá pra fazer${have.size ? ` (${can})` : ""}`;
  document.getElementById("pantryGo").textContent = have.size
    ? `🍳 Ver o que dá pra fazer (${can} com tudo)`
    : "🍳 Ver o que dá pra fazer";
}

function togglePantry(id) {
  const set = new Set(kitchenDb.pantry);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  kitchenDb.pantry = [...set];
  saveKitchenDb({ silent: true });
  renderPantry();
}

async function clearPantry() {
  if (!kitchenDb.pantry.length) return;
  const ok = await showPageMessage("Desmarcar todos os ingredientes?", { title: "Limpar a despensa", confirm: true, confirmLabel: "Limpar" });
  if (!ok) return;
  kitchenDb.pantry = [];
  saveKitchenDb();
  renderPantry();
}

function renderPantryResults() {
  const box = document.getElementById("pantryCan");
  const have = new Set(kitchenDb.pantry);
  if (!have.size) {
    box.innerHTML = tobaEmpty("🧺", "Marca o que você tem primeiro", "Na aba 🧺 Tenho, toca nos ingredientes que estão aí na cozinha.");
    return;
  }
  const rows = KITCHEN_RECIPES.map((r) => ({ recipe: r, match: kitchenMatchRecipe(r, have) }))
    .filter((row) => row.match.have > 0 || !row.match.missing.length)
    .sort((a, b) => a.match.missing.length - b.match.missing.length || b.match.have - a.match.have);
  const all = rows.filter((row) => !row.match.missing.length);
  const close = rows.filter((row) => row.match.missing.length && row.match.missing.length <= 2);
  const far = rows.filter((row) => row.match.missing.length > 2);
  let html = "";
  if (all.length) {
    html += '<div class="section-title is-first">✅ Tem tudo!</div><div class="toba-list">'
      + all.map((row) => recipeCard(row.recipe, `<span class="text-green">Você tem tudo pra fazer ${escapeHtml(row.recipe.name)}!</span>`)).join("")
      + "</div>";
  }
  if (close.length) {
    html += `<div class="section-title${all.length ? "" : " is-first"}">🤏 Falta pouco</div><div class="toba-list">`
      + close.map((row) => recipeCard(row.recipe, `<span class="text-gold">Dá pra fazer, mas ${escapeHtml(kitchenMissingText(row.match.missing))}</span>`)).join("")
      + "</div>";
  }
  if (far.length) {
    html += `<div class="section-title${all.length || close.length ? "" : " is-first"}">🛒 Falta mais coisa</div><div class="toba-list">`
      + far.map((row) => recipeCard(row.recipe, `faltam ${row.match.missing.length} ingredientes (tem ${row.match.have} de ${row.match.total})`)).join("")
      + "</div>";
  }
  box.innerHTML = html || tobaEmpty("😅", "Com isso não sai nada ainda", "Marca mais uns ingredientes (ou bora pro mercado).");
}

/* ---------------------------------------------------------------------
 * Detalhe da receita
 * ------------------------------------------------------------------- */
function openRecipe(id, options = {}) {
  const recipe = kitchenRecipe(id);
  if (!recipe) {
    openBook();
    return;
  }
  stopCookTicker();
  if (recipeId !== recipe.id || options.servings) recipeServings = Number(options.servings) || recipe.servings;
  recipeId = recipe.id;
  if (options.from) recipeFrom = options.from;
  showKitchenView("viewRecipe");
  tobaSetHeader({ page: "📖 Receita", back: "backFromRecipe" });
  renderRecipe();
}

function renderRecipe() {
  const recipe = kitchenRecipe(recipeId);
  if (!recipe) return;
  const have = new Set(kitchenDb.pantry);
  const cooked = kitchenDb.cooked.filter((c) => c.recipeId === recipe.id).sort((a, b) => (Number(b.doneAt) || 0) - (Number(a.doneAt) || 0));
  const meals = recipe.meals.map((key) => kitchenMeal(key)).filter(Boolean).map((m) => `<span class="kt-tag">${m.icon} ${m.short}</span>`).join("");
  const ingredients = kitchenScaledIngredients(recipe, recipeServings).map((ing) => {
    const status = ing.info.staple ? '<span class="kt-ing-flag">🧂</span>' : have.has(ing.id) ? '<span class="kt-ing-flag">✅</span>' : "";
    return `
      <div class="kt-ing">
        <span class="kt-ing-name">${ing.info.emoji} ${escapeHtml(ing.info.name)}${ing.optional ? ' <span class="text-muted">(opcional)</span>' : ""}${ing.note ? ` <span class="text-muted">· ${escapeHtml(ing.note)}</span>` : ""}</span>
        <span class="kt-ing-qty">${kitchenFormatAmount(ing.amount, ing.unit)}</span>
        ${status}
      </div>`;
  }).join("");
  const steps = recipe.steps.map((step, i) => `
    <li class="kt-step-preview"><span class="kt-step-num">${i + 1}</span><span>${escapeHtml(step.text)}${step.timer ? ` <span class="kt-timer-tag">⏲️ ${routineLikeMinutes(step.timer)}</span>` : ""}</span></li>`).join("");
  const live = readCookLive();
  const resume = live && live.recipeId === recipe.id;
  document.getElementById("viewRecipe").innerHTML = `
    <div class="kt-hero">
      <span class="kt-hero-emoji">${recipe.emoji}</span>
      <div class="kt-hero-name">${escapeHtml(recipe.name)}</div>
      <div class="kt-hero-author">✍️ receita do ${kitchenAuthor(recipe).emoji} ${kitchenAuthor(recipe).name}</div>
      <div class="kt-tags">${meals}</div>
    </div>
    <div class="toba-stats">
      <div class="toba-stat"><span class="toba-stat-label">⏱️ Tempo</span><span class="toba-stat-value">${routineLikeMinutes(recipe.minutes)}</span><span class="toba-stat-sub">do começo ao prato</span></div>
      <div class="toba-stat"><span class="toba-stat-label">🔥 Calorias</span><span class="toba-stat-value text-gold">${recipe.kcal} kcal</span><span class="toba-stat-sub">por porção (aprox.)</span></div>
      <div class="toba-stat"><span class="toba-stat-label">👨‍🍳 Você fez</span><span class="toba-stat-value text-coral">${cooked.length}×</span><span class="toba-stat-sub">${cooked.length ? `última: ${isoToBrDate(cooked[0].date)}` : "ainda não"}</span></div>
      <div class="toba-stat kt-servings">
        <span class="toba-stat-label">🍽️ Porções</span>
        <span class="kt-stepper">
          <button type="button" class="round-btn" data-click="changeServings" data-dir="-1" aria-label="Menos porções"${recipeServings <= 1 ? " disabled" : ""}>−</button>
          <span class="toba-stat-value">${recipeServings}</span>
          <button type="button" class="round-btn" data-click="changeServings" data-dir="1" aria-label="Mais porções"${recipeServings >= 20 ? " disabled" : ""}>+</button>
        </span>
      </div>
    </div>
    <button type="button" class="btn kt-btn-fire kt-cook-btn" data-click="startCook">${resume ? `👨‍🍳 Continuar no passo ${live.step + 1}` : "👨‍🍳 Modo cozinha (passo a passo)"}</button>
    <div class="btn-row kt-recipe-actions">
      <button type="button" class="btn btn-secondary" data-click="cookedNow">✅ Já fiz (+1)</button>
      <button type="button" class="btn btn-secondary" data-click="openPlanSheet">📅 Pôr na semana</button>
    </div>
    <div class="section-title">🧺 Ingredientes <span class="text-muted kt-small">${recipeServings} ${recipeServings === 1 ? "porção" : "porções"}</span></div>
    <div class="card kt-ing-list">${ingredients}</div>
    <div class="kt-legend text-muted">✅ tem em casa (marcado no 🧺) · 🧂 básico</div>
    ${recipe.tip ? `<div class="hint-box kt-hint">💡 ${escapeHtml(recipe.tip)}</div>` : ""}
    <div class="section-title">👣 Passo a passo</div>
    <ol class="kt-steps">${steps}</ol>
    ${cooked.length ? `
      <div class="section-title">📜 Vezes que você fez</div>
      <div class="toba-list">${cooked.slice(0, 5).map((c, i) => `
        <div class="toba-list-item kt-history">
          <span>${i === 0 ? "🍽️" : "•"} ${isoToBrDate(c.date)} · ${c.servings || recipe.servings} ${(c.servings || recipe.servings) === 1 ? "porção" : "porções"}</span>
          ${i === 0 ? `<button type="button" class="chip-btn" data-click="undoCooked" data-id="${escapeHtml(c.id)}">↩ Desfazer</button>` : ""}
        </div>`).join("")}</div>` : ""}`;
}

async function cookedNow() {
  const improvised = await kitchenAskImprovised(kitchenRecipe(recipeId));
  const entry = kitchenMarkCooked(recipeId, { servings: recipeServings, improvised });
  if (!entry) return;
  renderRecipe();
  const count = kitchenCookedCount(kitchenDb, recipeId);
  tobaSaved(`👨‍🍳 +1! ${count}× feita`);
  kitchenPlayerCheck();
}

async function undoCooked(id) {
  const ok = await showPageMessage("Tirar essa vez do contador?", { title: "Desfazer", confirm: true, confirmLabel: "Tirar" });
  if (!ok) return;
  kitchenUndoCooked(id);
  renderRecipe();
}

/* Pôr na semana: refeição + um dos próximos 7 dias */
let planMeal = null;

function openPlanSheet() {
  const recipe = kitchenRecipe(recipeId);
  if (!recipe) return;
  planMeal = recipe.meals[0] || "almoco";
  document.getElementById("planSheetText").textContent = `${recipe.emoji} ${recipe.name} · ${recipeServings} ${recipeServings === 1 ? "porção" : "porções"}. Em qual refeição e qual dia?`;
  renderPlanSheet();
  openTobaModal("planSheet");
}

function renderPlanSheet() {
  document.getElementById("planMeals").innerHTML = KITCHEN_MEALS.map((m) => `
    <button type="button" class="chip-btn kt-chip${planMeal === m.key ? " is-on" : ""}" data-click="pickPlanMeal" data-meal="${m.key}">${m.icon} ${m.short}</button>`).join("");
  const today = toIsoDate();
  document.getElementById("planDays").innerHTML = Array.from({ length: 7 }, (_, i) => kitchenAddDays(today, i)).map((day, i) => {
    const count = kitchenDb.plan.filter((p) => p.date === day).length;
    const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : kitchenWeekdayShort(day);
    return `<button type="button" class="kt-day-btn" data-click="addToPlan" data-date="${day}">
      <strong>${label}</strong><span>${isoToBrDate(day).slice(0, 5)}</span><span class="text-muted">${count ? `${count} já` : "livre"}</span>
    </button>`;
  }).join("");
}

function kitchenWeekdayShort(iso) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(`${iso}T12:00:00`).getDay()];
}

function addToPlan(date) {
  const recipe = kitchenRecipe(recipeId);
  if (!recipe) return;
  kitchenDb.plan.push({ id: kitchenNewId("p"), date, recipeId: recipe.id, meal: planMeal, servings: recipeServings });
  if (!saveKitchenDb({ silent: true })) return;
  closeTobaModal("planSheet");
  tobaSaved(`📅 ${kitchenWeekdayShort(date)} ${isoToBrDate(date).slice(0, 5)}: ${recipe.name}`);
}

/* ---------------------------------------------------------------------
 * Modo cozinha: passo a passo com a tela acesa e timer por passo.
 * Fica guardado em toba_kitchen_live: minimizou ou recarregou, continua.
 * Timer = horário (Date.now), nunca contagem (o celular congela a aba).
 * ------------------------------------------------------------------- */
function readCookLive() {
  try {
    const live = JSON.parse(localStorage.getItem(KITCHEN_LIVE_KEY) || "null");
    if (!live || !kitchenRecipe(live.recipeId)) return null;
    live.step = Math.max(0, Math.min(Number(live.step) || 0, kitchenRecipe(live.recipeId).steps.length - 1));
    live.done = Array.isArray(live.done) ? live.done : [];
    return live;
  } catch (err) {
    return null;
  }
}

function storeCookLive(live) {
  try {
    if (live) localStorage.setItem(KITCHEN_LIVE_KEY, JSON.stringify(live));
    else localStorage.removeItem(KITCHEN_LIVE_KEY);
  } catch (err) {
    console.error("Não consegui guardar o modo cozinha", err);
  }
}

function readKitchenPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(KITCHEN_PREFS_KEY) || "{}");
    return { keepAwake: prefs.keepAwake !== false };
  } catch (err) {
    return { keepAwake: true };
  }
}

function renderCookResume() {
  const live = readCookLive();
  const box = document.getElementById("cookResume");
  if (!live) {
    box.innerHTML = "";
    return;
  }
  const recipe = kitchenRecipe(live.recipeId);
  box.innerHTML = `
    <div class="kt-resume">
      <div class="kt-resume-title">👨‍🍳 ${recipe.emoji} ${escapeHtml(recipe.name)} no fogo</div>
      <div class="kt-resume-sub">Parou no passo ${live.step + 1} de ${recipe.steps.length}${live.timer && live.timer.endsAt ? " · ⏲️ timer rodando" : ""}.</div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" data-click="discardCook">Largar</button>
        <button type="button" class="btn kt-btn-fire" data-click="resumeCook">Continuar</button>
      </div>
    </div>`;
}

async function startCook(options = {}) {
  const recipe = kitchenRecipe(options.recipeId || recipeId);
  if (!recipe) return;
  const live = readCookLive();
  if (live && live.recipeId !== recipe.id) {
    const other = kitchenRecipe(live.recipeId);
    const ok = await showPageMessage(`Você tava no meio de ${other.emoji} ${other.name}. Largar ela e começar esta?`, { title: "Uma panela por vez", confirm: true, confirmLabel: "Começar esta" });
    if (!ok) return;
  }
  if (!live || live.recipeId !== recipe.id) {
    storeCookLive({
      v: 1,
      recipeId: recipe.id,
      servings: Number(options.servings) || recipeServings || recipe.servings,
      planId: options.planId || null,
      step: 0,
      done: [],
      startedAt: Date.now(),
      timer: null,
    });
  }
  openCookView();
}

function openCookView() {
  const live = readCookLive();
  if (!live) {
    openBook();
    return;
  }
  recipeId = live.recipeId;
  recipeServings = live.servings;
  tobaAskNotify(); // só por toque: avisar o fim do timer com a tela apagada
  document.querySelectorAll(".container > .app-view").forEach((view) => view.classList.remove("active"));
  document.getElementById("viewCook").classList.add("active");
  window.scrollTo(0, 0);
  renderCook();
  startCookTicker();
  requestCookWakeLock();
}

function renderCook() {
  const live = readCookLive();
  if (!live) return;
  const recipe = kitchenRecipe(live.recipeId);
  const step = recipe.steps[live.step];
  const total = recipe.steps.length;
  const last = live.step === total - 1;
  const dots = recipe.steps.map((_, i) => `
    <button type="button" class="kt-dot${i === live.step ? " is-current" : ""}${live.done.includes(i) ? " is-done" : ""}" data-click="cookGoto" data-step="${i}" aria-label="Passo ${i + 1}">${live.done.includes(i) ? "✓" : i + 1}</button>`).join("");
  const timer = live.timer;
  const otherTimer = timer && timer.step !== live.step && (timer.endsAt || timer.left)
    ? `<button type="button" class="kt-timer-chip" data-click="cookGoto" data-step="${timer.step}">⏲️ Passo ${timer.step + 1}: <span id="cookOtherTimer">--:--</span></button>`
    : "";
  document.getElementById("cookBody").innerHTML = `
    <div class="kt-cook-top">
      <button type="button" class="back-nav-btn" data-click="leaveCook">‹ Sair</button>
      <span class="kt-cook-title">${recipe.emoji} ${escapeHtml(recipe.name)}</span>
      <button type="button" class="toba-icon-btn" data-click="openCookIngredients" aria-label="Ingredientes">🧺</button>
    </div>
    <div class="kt-cook-progress">
      <span>Passo ${live.step + 1} de ${total}</span>
      <span class="text-muted">${live.done.length}/${total} feitos</span>
    </div>
    <div class="progress-track"><div class="progress-fill kt-fill" style="width:${Math.round((live.done.length / total) * 100)}%"></div></div>
    <div class="kt-dots">${dots}</div>
    ${otherTimer}
    <div class="kt-step-card${live.done.includes(live.step) ? " is-done" : ""}">
      <span class="kt-step-big-num">${live.step + 1}</span>
      <p class="kt-step-text">${escapeHtml(step.text)}</p>
    </div>
    ${step.timer ? renderCookTimer(live, step) : ""}
    <div class="btn-row kt-cook-nav">
      <button type="button" class="btn btn-secondary" data-click="cookPrev"${live.step === 0 ? " disabled" : ""}>‹ Anterior</button>
      <button type="button" class="btn ${last ? "btn-primary" : "kt-btn-fire"}" data-click="cookNext">${last ? "🍽️ Terminei!" : "✅ Feito, próximo ›"}</button>
    </div>
    <label class="check-row kt-awake">
      <input type="checkbox" data-change="cookToggleAwake"${readKitchenPrefs().keepAwake ? " checked" : ""} />
      <span>🔆 Manter a tela acesa enquanto cozinha</span>
    </label>`;
  cookTick();
}

function renderCookTimer(live, step) {
  const timer = live.timer && live.timer.step === live.step ? live.timer : null;
  const running = timer && timer.endsAt;
  const paused = timer && !timer.endsAt && timer.left;
  return `
    <div class="kt-timer${running ? " is-running" : ""}">
      <span class="kt-timer-label">⏲️ Timer do passo · ${routineLikeMinutes(step.timer)}</span>
      <span class="kt-timer-value" id="cookTimerValue">${formatCookClock(timer ? cookTimerLeft(timer) : step.timer * 60000)}</span>
      <div class="btn-row">
        ${running
          ? '<button type="button" class="btn btn-secondary" data-click="cookTimerPause">⏸️ Pausar</button>'
          : `<button type="button" class="btn btn-outline btn-gold" data-click="cookTimerStart">▶️ ${paused ? "Continuar" : "Começar"}</button>`}
        ${timer ? '<button type="button" class="btn btn-secondary" data-click="cookTimerReset">↺ Zerar</button>' : ""}
      </div>
    </div>`;
}

function cookTimerLeft(timer) {
  if (!timer) return 0;
  if (timer.endsAt) return timer.endsAt - Date.now();
  return Number(timer.left) || 0;
}

function formatCookClock(ms) {
  const over = ms < 0;
  const total = Math.ceil(Math.abs(ms) / 1000);
  const text = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return over ? `+${text}` : text;
}

function cookUpdate(change) {
  const live = readCookLive();
  if (!live) return null;
  change(live);
  storeCookLive(live);
  return live;
}

function cookGoto(step) {
  cookUpdate((live) => {
    live.step = step;
  });
  renderCook();
  window.scrollTo(0, 0);
}

function cookPrev() {
  const live = readCookLive();
  if (live && live.step > 0) cookGoto(live.step - 1);
}

async function cookNext() {
  const live = cookUpdate((l) => {
    if (!l.done.includes(l.step)) l.done.push(l.step);
  });
  if (!live) return;
  const recipe = kitchenRecipe(live.recipeId);
  if (live.step < recipe.steps.length - 1) {
    cookGoto(live.step + 1);
    return;
  }
  await finishCook();
}

async function finishCook() {
  const live = readCookLive();
  if (!live) return;
  const recipe = kitchenRecipe(live.recipeId);
  const improvised = await kitchenAskImprovised(recipe);
  const entry = kitchenMarkCooked(recipe.id, { servings: live.servings, planId: live.planId, improvised });
  if (!entry) return; // não gravou: o modo cozinha continua guardado
  storeCookLive(null);
  stopCookTicker();
  const count = kitchenCookedCount(kitchenDb, recipe.id);
  openRecipe(recipe.id);
  await showPageMessage(`${recipe.emoji} ${recipe.name} saiu! ${kitchenCookedQuip(count)}`, { title: "Chef Toba 👨‍🍳", icon: "🍽️" });
  kitchenPlayerCheck();
}

function leaveCook() {
  stopCookTicker();
  openRecipe(readCookLive() ? readCookLive().recipeId : recipeId);
}

async function discardCook() {
  const ok = await showPageMessage("Largar o passo a passo? O contador não ganha +1.", { title: "Largar receita", confirm: true, confirmLabel: "Largar" });
  if (!ok) return;
  storeCookLive(null);
  stopCookTicker();
  renderBook();
}

function cookTimerStart() {
  cookUpdate((live) => {
    const step = kitchenRecipe(live.recipeId).steps[live.step];
    const left = live.timer && live.timer.step === live.step && live.timer.left ? live.timer.left : step.timer * 60000;
    live.timer = { step: live.step, endsAt: Date.now() + left, left: 0, alerted: false };
  });
  renderCook();
}

function cookTimerPause() {
  cookUpdate((live) => {
    if (!live.timer || !live.timer.endsAt) return;
    live.timer.left = Math.max(0, live.timer.endsAt - Date.now());
    live.timer.endsAt = null;
  });
  renderCook();
}

function cookTimerReset() {
  cookUpdate((live) => {
    live.timer = null;
  });
  renderCook();
}

function cookTick() {
  const live = readCookLive();
  if (!live || !live.timer) return;
  const left = cookTimerLeft(live.timer);
  const value = document.getElementById(live.timer.step === live.step ? "cookTimerValue" : "cookOtherTimer");
  if (value) {
    value.textContent = formatCookClock(left);
    value.classList.toggle("text-red", left < 0);
  }
  if (live.timer.endsAt && left <= 0 && !live.timer.alerted) {
    cookUpdate((l) => {
      l.timer.alerted = true;
    });
    const recipe = kitchenRecipe(live.recipeId);
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
    tobaToast(`⏰ Deu o tempo do passo ${live.timer.step + 1}!`);
    tobaNotify("⏰ Deu o tempo!", `${recipe.emoji} ${recipe.name}: passo ${live.timer.step + 1}. Corre pro fogão!`, { tag: "toba-kitchen-timer" });
  }
}

function startCookTicker() {
  clearInterval(cookTicker);
  cookTicker = setInterval(cookTick, 500);
}

function stopCookTicker() {
  clearInterval(cookTicker);
  cookTicker = 0;
  releaseCookWakeLock();
}

function openCookIngredients() {
  const live = readCookLive();
  if (!live) return;
  const recipe = kitchenRecipe(live.recipeId);
  document.getElementById("cookIngredientsList").innerHTML = kitchenScaledIngredients(recipe, live.servings).map((ing) => `
    <div class="kt-ing">
      <span class="kt-ing-name">${ing.info.emoji} ${escapeHtml(ing.info.name)}${ing.optional ? ' <span class="text-muted">(opcional)</span>' : ""}</span>
      <span class="kt-ing-qty">${kitchenFormatAmount(ing.amount, ing.unit)}</span>
    </div>`).join("");
  openTobaModal("cookIngredientsSheet");
}

function cookToggleAwake(el) {
  try {
    localStorage.setItem(KITCHEN_PREFS_KEY, JSON.stringify({ keepAwake: el.checked }));
  } catch (err) {
    console.error("Não consegui salvar a preferência", err);
  }
  if (el.checked) {
    requestCookWakeLock();
    tobaToast("🔆 Tela acesa até sair do modo cozinha");
  } else {
    releaseCookWakeLock();
    tobaToast("🌙 A tela pode apagar sozinha");
  }
}

async function requestCookWakeLock() {
  if (!readKitchenPrefs().keepAwake) return;
  if (TOBA_NATIVE && typeof TOBA_NATIVE.keepScreenOn === "function") {
    TOBA_NATIVE.keepScreenOn(true);
    return;
  }
  if (!("wakeLock" in navigator) || cookWakeLock || document.hidden) return;
  try {
    cookWakeLock = await navigator.wakeLock.request("screen");
    cookWakeLock.addEventListener("release", () => {
      cookWakeLock = null;
    });
  } catch (err) {
    cookWakeLock = null; // navegador não deixou: a receita segue igual
  }
}

function releaseCookWakeLock() {
  if (TOBA_NATIVE && typeof TOBA_NATIVE.keepScreenOn === "function") TOBA_NATIVE.keepScreenOn(false);
  if (!cookWakeLock) return;
  cookWakeLock.release().catch(() => {});
  cookWakeLock = null;
}

function isCookViewActive() {
  return document.getElementById("viewCook").classList.contains("active");
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !isCookViewActive()) return;
  requestCookWakeLock(); // a tela acesa é liberada sozinha quando o app sai da frente
  cookTick();
});

/* ---------------------------------------------------------------------
 * Ações e abertura da página
 * ------------------------------------------------------------------- */
function onKitchenDataReplaced() {
  openBook();
}

tobaActions({
  filterBook: (el) => {
    bookQuery = el.value;
    renderBook();
  },
  pickBookMeal: (el) => {
    bookMeal = el.dataset.meal;
    renderBook();
  },
  openPantry: () => openPantry(),
  backToBook: openBook,
  pantryTab: (el) => setPantryTab(el.dataset.tab),
  filterPantry: (el) => {
    pantryQuery = el.value;
    renderPantry();
  },
  togglePantry: (el) => togglePantry(el.dataset.id),
  clearPantry,
  openRecipe: (el) => openRecipe(el.dataset.id, { from: document.getElementById("viewPantry").classList.contains("active") ? "pantry" : "book" }),
  backFromRecipe: () => (recipeFrom === "pantry" ? openPantry("can") : openBook()),
  changeServings: (el) => {
    recipeServings = Math.max(1, Math.min(20, recipeServings + Number(el.dataset.dir)));
    renderRecipe();
  },
  cookedNow,
  undoCooked: (el) => undoCooked(el.dataset.id),
  openPlanSheet,
  pickPlanMeal: (el) => {
    planMeal = el.dataset.meal;
    renderPlanSheet();
  },
  addToPlan: (el) => addToPlan(el.dataset.date),
  startCook: () => startCook(),
  resumeCook: openCookView,
  discardCook,
  leaveCook,
  cookGoto: (el) => cookGoto(Number(el.dataset.step)),
  cookPrev,
  cookNext,
  cookTimerStart,
  cookTimerPause,
  cookTimerReset,
  openCookIngredients,
  cookToggleAwake,
});

// ?r=<id> abre a receita · ?cook=<id>&plan=<id>&s=<porções> abre o modo cozinha
// (vem da Programação da Semana) · ?pantry=1 abre o "O que tem aí?"
(function initReceitas() {
  const params = new URLSearchParams(location.search);
  if (params.get("cook") && kitchenRecipe(params.get("cook"))) {
    history.replaceState(null, "", location.pathname);
    recipeId = params.get("cook");
    recipeServings = Number(params.get("s")) || kitchenRecipe(recipeId).servings;
    openRecipe(recipeId, { servings: recipeServings });
    startCook({ recipeId, servings: recipeServings, planId: params.get("plan") });
    return;
  }
  if (params.get("r") && kitchenRecipe(params.get("r"))) {
    openRecipe(params.get("r"), { servings: Number(params.get("s")) || 0 });
    return;
  }
  if (params.get("pantry")) {
    openPantry();
    return;
  }
  openBook();
})();
