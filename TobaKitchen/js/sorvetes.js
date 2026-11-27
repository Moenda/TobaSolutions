/* =====================================================================
 * Toba Kitchen · 🍦 Sorvetes Ninja CREAMi (js/sorvetes.js, desde v2.18)
 * Chip "🍦 Sorvetes" no Livro de Receitas: sorvetes fit pra Ninja CREAMi
 * com kcal / proteína / carbo / gordura POR POTE (calculados dos
 * ingredientes, no tamanho do pote escolhido e com o rótulo do usuário),
 * o passo a passo de bater (Lite Ice Cream → Re-spin com splash de leite
 * → Mix-in), mix-ins de um toque, "🧊 Congelei" com contagem das 24 h,
 * "🍦 Comi um pote", 🧑‍🍳 Montar meu pote, ✏️ Rótulos e o 🌀 Guia da Ninja.
 * O catálogo e as contas puras moram em kitchen-recipes.js
 * (KITCHEN_ICE_*); aqui só a tela. Carrega DEPOIS do receitas.js.
 * Banco: db.ices, db.icePints, db.iceLabels, db.iceSize (kitchen-core.js).
 * ===================================================================== */
let iceId = null; // receita/pote aberto
let iceFilter = "all"; // all | proteico | fruta | meus
let iceSort = "prot"; // prot | kcal | az
let iceServings = 1; // dividir o pote em N porções (só a tela)
let iceMix = new Set(); // mix-ins marcados na receita aberta (só a tela)
let iceStepsDone = new Set(); // passos riscados (só a tela)
let iceDraft = null; // pote sendo montado na folha (cópia; só grava no Salvar)
let iceProblem = ""; // chip aberto no "🆘 Deu ruim?" do guia
let iceTickTimer = 0;

/* ---------------------------------------------------------------------
 * Números
 * ------------------------------------------------------------------- */
// 248.4 -> "248" · 33.36 -> "33" · 1.52 -> "1,5"
function iceG(n) {
  const v = Number(n) || 0;
  if (v >= 10) return String(Math.round(v));
  return String(Math.round(v * 10) / 10).replace(".", ",");
}

function iceKcal(n) {
  return String(Math.round(Number(n) || 0));
}

// Proteína a cada 100 kcal (densidade: quanto mais, mais "fit")
function iceDensity(m) {
  return m && m.kcal > 0 ? (m.p / m.kcal) * 100 : 0;
}

function iceDensityQuip(m) {
  const d = iceDensity(m);
  if (!m || !m.kcal) return "";
  if (d >= 10) return "💪 Monstro: mais proteína que muito frango por aí.";
  if (d >= 7) return "🔥 Fit raiz: cabe na dieta sem culpa.";
  if (d >= 3) return "👍 Equilibrado: proteína e fruta juntas.";
  return "🍓 Leve: quase só fruta. Proteína vem de outro lugar hoje.";
}

function iceSizeNow() {
  return kitchenIceSizeOf(kitchenDb);
}

function iceMacrosOf(recipe) {
  return kitchenIcePintMacros(kitchenDb, recipe, kitchenDb.iceSize);
}

function iceMetaLine(recipe) {
  const m = iceMacrosOf(recipe);
  const prog = kitchenIceProgram(recipe.program);
  return `🔥 ${iceKcal(m.kcal)} kcal · 💪 ${iceG(m.p)} g prot · ${prog.icon} ${prog.short || prog.name}`;
}

/* ---------------------------------------------------------------------
 * Livro com o chip 🍦 Sorvetes
 * ------------------------------------------------------------------- */
function iceCard(recipe) {
  const count = kitchenIceEatenOf(kitchenDb, recipe.id).length;
  const frozen = kitchenIceFreezerOf(kitchenDb).filter((p) => String(p.iceId) === String(recipe.id)).length;
  const badge = count ? `<span class="kt-count" title="Potes comidos">${count}×</span>` : '<span class="toba-hub-chevron">›</span>';
  return `
    <div class="toba-list-item kt-recipe" role="button" tabindex="0" data-click="openIce" data-id="${escapeHtml(recipe.id)}">
      <span class="kt-recipe-emoji">${escapeHtml(recipe.emoji || "🍦")}</span>
      <span class="kt-recipe-text">
        <span class="kt-recipe-name">${escapeHtml(recipe.name || "Pote sem nome")}${frozen ? ' <span class="kt-ice-frozen-dot" title="No freezer">🧊</span>' : ""}</span>
        <span class="kt-recipe-meta">${iceMetaLine(recipe)}</span>
      </span>
      ${badge}
    </div>`;
}

function iceSortList(list) {
  const withM = list.map((r) => ({ r, m: iceMacrosOf(r) }));
  if (iceSort === "kcal") withM.sort((a, b) => a.m.kcal - b.m.kcal);
  else if (iceSort === "az") withM.sort((a, b) => String(a.r.name).localeCompare(String(b.r.name), "pt-BR", { sensitivity: "base" }));
  else withM.sort((a, b) => b.m.p - a.m.p || a.m.kcal - b.m.kcal);
  return withM.map((x) => x.r);
}

function iceMatches(recipe, q) {
  if (!q) return true;
  const words = [recipe.name, ...(recipe.items || []).map((i) => (kitchenIceIng(i.ing) || { name: "" }).name)];
  return kitchenNormalize(words.join(" ")).includes(q);
}

function iceLeftText(ms) {
  if (ms <= 0) return "✅ pronto pra bater!";
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  if (!h) return `⏳ pronto em ${m} min`;
  return `⏳ pronto em ${h}h${m === 60 ? "" : String(m).padStart(2, "0")}`;
}

function iceFreezerHtml() {
  const freezer = kitchenIceFreezerOf(kitchenDb);
  if (!freezer.length) return "";
  const now = Date.now();
  return `<div class="section-title is-first">🧊 No freezer (${freezer.length})</div>
    <div class="toba-list">${freezer.map((pint) => {
      const recipe = kitchenIceRecipe(kitchenDb, pint.iceId);
      const left = kitchenIceLeftMs(pint, now);
      const ready = new Date(Number(pint.frozenAt) + KITCHEN_ICE_FREEZE_MS);
      const size = kitchenIceSize(pint.size);
      return `
      <div class="toba-list-item kt-ice-pint${left ? "" : " is-ready"}">
        <span class="kt-recipe-emoji">${escapeHtml(recipe ? recipe.emoji : "🍦")}</span>
        <span class="kt-recipe-text" role="button" tabindex="0" data-click="openIce" data-id="${escapeHtml(pint.iceId)}">
          <span class="kt-recipe-name">${escapeHtml(recipe ? recipe.name : "Pote apagado")}</span>
          <span class="kt-recipe-meta">${iceLeftText(left)} · ${left ? `${ready.toLocaleDateString("pt-BR", { weekday: "short" })} ${ready.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ` : ""}${size.icon} ${size.short}</span>
        </span>
        <span class="kt-ice-pint-actions">
          <button type="button" class="chip-btn kt-chip${left ? "" : " is-on"}" data-click="iceEatPint" data-id="${escapeHtml(pint.id)}">🍦 Comi</button>
          <button type="button" class="chip-btn kt-ice-x" data-click="iceDropPint" data-id="${escapeHtml(pint.id)}" aria-label="Tirar do freezer">✕</button>
        </span>
      </div>`;
    }).join("")}</div>`;
}

function renderIceBook(query) {
  const q = kitchenNormalize(String(query || "").trim());
  const size = iceSizeNow();
  const mine = kitchenIcesOf(kitchenDb).filter((r) => iceMatches(r, q));
  const fixed = KITCHEN_ICE_RECIPES.map((r) => ({ ...r, fixed: true })).filter((r) => iceMatches(r, q));
  const protein = fixed.filter((r) => r.line !== "fruta");
  const fruit = fixed.filter((r) => r.line === "fruta");
  const show = (key) => iceFilter === "all" || iceFilter === key;
  const filterChips = [["all", "📚 Todos"], ["proteico", "💪 Proteicos"], ["fruta", "🍓 Só fruta"], ["meus", "🧑‍🍳 Meus"]].map(([key, label]) => `
    <button type="button" class="chip-btn kt-chip${iceFilter === key ? " is-on" : ""}" data-click="iceFilterPick" data-key="${key}">${label}</button>`).join("");
  const sortChips = [["prot", "💪 Mais proteína"], ["kcal", "🔥 Menos kcal"], ["az", "🔤 A–Z"]].map(([key, label]) => `
    <button type="button" class="chip-btn kt-chip${iceSort === key ? " is-on" : ""}" data-click="iceSortPick" data-key="${key}">${label}</button>`).join("");
  const sizeChips = Object.values(KITCHEN_ICE_SIZES).map((s) => `
    <button type="button" class="chip-btn kt-chip${size.key === s.key ? " is-on" : ""}" data-click="iceSizePick" data-key="${s.key}">${s.icon} ${s.name} ${s.short}</button>`).join("");
  let html = `
    <button type="button" class="kt-launch kt-ice-launch" data-click="newIce">
      <span class="kt-launch-icon">🍦</span>
      <span class="kt-launch-copy">
        <span class="kt-launch-title">Montar meu pote</span>
        <span class="kt-launch-detail">Toca nos ingredientes e o Toba faz a conta de kcal e proteína do pote na hora.</span>
      </span>
    </button>
    <button type="button" class="kt-launch kt-ice-guide-launch" data-click="openIceGuide">
      <span class="kt-launch-icon">🌀</span>
      <span class="kt-launch-copy">
        <span class="kt-launch-title">Guia da Ninja</span>
        <span class="kt-launch-detail">Como bater sem dar ruim: Lite → Re-spin → Mix-in, e o 🆘 pra quando sair farelento.</span>
      </span>
    </button>`;
  html += iceFreezerHtml();
  html += `<div class="kt-aisle">🫙 Meu pote</div><div class="kt-chips">${sizeChips}</div>`;
  html += `<div class="kt-chips">${filterChips}</div><div class="kt-chips">${sortChips}</div>`;
  let any = false;
  if (show("meus")) {
    html += '<div class="section-title">🧑‍🍳 Meus potes</div>';
    if (mine.length) {
      any = true;
      html += `<div class="toba-list">${iceSortList(mine).map(iceCard).join("")}</div>`;
    } else {
      html += tobaEmpty("🫙", q ? "Nenhum pote teu com isso" : "Nenhum pote teu ainda", q ? "Tenta outra fruta ou outro nome." : "Monta o teu no 🍦 lá em cima, ou abre uma receita e toca em ✏️ Fazer minha versão.");
    }
  }
  if (show("proteico") && protein.length) {
    any = true;
    html += `<div class="section-title">💪 Proteicos (whey e iogurte)</div><div class="toba-list">${iceSortList(protein).map(iceCard).join("")}</div>`;
  }
  if (show("fruta") && fruit.length) {
    any = true;
    html += `<div class="section-title">🍓 Só fruta (sorbet)</div><div class="toba-list">${iceSortList(fruit).map(iceCard).join("")}</div>`;
  }
  if (!any && iceFilter !== "meus") html += tobaEmpty("🤷", "Nenhum sorvete com isso", "Tenta outra palavra (ou outra fruta).");
  html += `<div class="hint-box kt-hint kt-ice-note">📏 Números por <b>pote inteiro</b> (${size.short}), já no tamanho escolhido. É estimativa com rótulo médio: teu whey é outro? <button type="button" class="kt-ice-link" data-click="openIceLabels">✏️ Ajustar rótulos</button></div>`;
  document.getElementById("bookList").innerHTML = html;
}

// Re-desenha a contagem do freezer a cada minuto enquanto o chip tá aberto
function iceBookTicker(on) {
  clearInterval(iceTickTimer);
  iceTickTimer = 0;
  if (!on) return;
  iceTickTimer = setInterval(() => {
    const bookOn = document.getElementById("viewBook").classList.contains("active");
    if (!bookOn || bookMeal !== "sorvetes") {
      iceBookTicker(false);
      return;
    }
    if (kitchenIceFreezerOf(kitchenDb).length) renderIceBook(bookQuery);
  }, 60000);
}

/* ---------------------------------------------------------------------
 * Detalhe do sorvete
 * ------------------------------------------------------------------- */
function openIce(id) {
  const recipe = kitchenIceRecipe(kitchenDb, id);
  if (!recipe) {
    openBook();
    return;
  }
  stopCookTicker();
  iceBookTicker(false);
  if (iceId !== recipe.id) {
    iceServings = 1;
    iceMix = new Set();
    iceStepsDone = new Set();
  }
  iceId = recipe.id;
  showKitchenView("viewIce");
  tobaSetHeader({ page: "🍦 Sorvete", back: "backFromIce" });
  renderIce();
}

function iceStatTile(label, value, sub, cls = "") {
  return `<div class="toba-stat"><span class="toba-stat-label">${label}</span><span class="toba-stat-value${cls ? ` ${cls}` : ""}">${value}</span><span class="toba-stat-sub">${sub}</span></div>`;
}

function iceRespinText(recipe) {
  if (recipe.respin === "agua" || (!recipe.respin && recipe.program === "sorbet")) return "1 a 2 colheres de sopa de água, suco da própria fruta ou água de coco";
  return "1 a 2 colheres de sopa de leite desnatado";
}

/* Passo a passo de bater (o mesmo pra toda receita, ajustado pelo programa) */
function iceSteps(recipe) {
  const prog = kitchenIceProgram(recipe.program);
  const items = recipe.items || [];
  const has = (kind) => items.some((i) => (kitchenIceIng(i.ing) || {}).kind === kind);
  const thick = items.some((i) => ["goma-xantana", "pudim-zero", "leite-po-desnatado"].includes(i.ing));
  const onlyFruit = !has("proteina") && has("fruta");
  const size = iceSizeNow();
  const steps = [
    {
      icon: "🥤", title: "Bate a base",
      text: onlyFruit
        ? "Pica a fruta (bem madura!) e bate com o líquido no liquidificador até virar um purê liso. Prova o doce agora: gelado tira o doce da boca, então deixa um pouco mais doce do que acha certo."
        : `Bate tudo no liquidificador (ou mixer) uns 30 s, até sumir o pó do whey.${thick ? " Deixa descansar 5 min: a goma e o leite em pó engrossam a base." : ""} Prova o doce: no gelado ele some, então capricha um pouco mais.`,
    },
    {
      icon: "🫙", title: "Pote e freezer por 24 h",
      text: `Despeja no ${size.name.toLowerCase()} até a linha MAX (nunca passa dela). Dá umas batidinhas na bancada pra nivelar, tampa e põe no freezer bem reto. 24 h: com menos o meio fica mole e sai sopa.`,
      freeze: true,
    },
    {
      icon: "⏳", title: "Tira e espera uns minutos",
      text: "Tirou do freezer: deixa 5 a 10 min na pia (ou passa água morna por fora do pote uns 30 s). Formou uma corcova no meio? Raspa com uma colher até ficar reto: corcova força a lâmina.",
    },
    {
      icon: prog.icon, title: `Programa ${prog.name}`,
      text: `Tira a tampa, encaixa o pote no copo com a tampa da lâmina e roda o ${prog.name}. ${prog.key === "lite" ? "É o programa feito pra base fit (pouca gordura e açúcar)." : prog.key === "sorbet" ? "É o programa feito pra fruta." : prog.key === "smoothie" ? "Sai firme, tipo açaí de tigela." : ""}`.trim(),
    },
    {
      icon: "🥛", title: "Re-spin (o pulo do gato)",
      text: `Saiu farelento, tipo neve ou pó? NORMAL no fit, relaxa! Faz um buraco no meio com a colher, põe ${iceRespinText(recipe)} e roda o Re-spin. Ainda seco? Mais 1 colher e outro Re-spin. Máximo 2: depois disso vira milkshake.`,
    },
  ];
  if ((recipe.mixins || []).length || iceMix.size) {
    steps.push({
      icon: "🍫", title: "Mix-in (opcional)",
      text: "Com o sorvete já cremoso: faz um buraco até o fundo, põe o mix-in (até uns 40 g, ¼ de xícara) e roda o programa Mix-in. Coisa dura (chocolate, paçoca) vai picada. Granola é melhor por cima na hora (no Mix-in ela amolece).",
    });
  }
  steps.push({
    icon: "🧊", title: "Sobrou?",
    text: "Alisa a superfície (sem corcova), tampa e volta pro freezer. Na próxima: espera 10 min fora, roda o programa de novo e um Re-spin com splash.",
  });
  return steps;
}

function renderIce() {
  const recipe = kitchenIceRecipe(kitchenDb, iceId);
  if (!recipe) return;
  const size = iceSizeNow();
  const prog = kitchenIceProgram(recipe.program);
  const pint = iceMacrosOf(recipe);
  const mixItems = KITCHEN_ICE_MIXINS.filter((x) => iceMix.has(x.ing));
  const mixM = kitchenIceMacros(kitchenDb, mixItems, 1);
  const total = { kcal: pint.kcal + mixM.kcal, p: pint.p + mixM.p, c: pint.c + mixM.c, f: pint.f + mixM.f };
  const per = (n) => n / iceServings;
  const eaten = kitchenIceEatenOf(kitchenDb, recipe.id);
  const frozen = kitchenIceFreezerOf(kitchenDb).filter((p) => String(p.iceId) === String(recipe.id));
  const month = toIsoDate().slice(0, 7);
  const author = KITCHEN_AUTHORS[recipe.author] || KITCHEN_AUTHORS.cloba;
  const items = (recipe.items || []).map((item) => {
    const ing = kitchenIceIng(item.ing) || { name: item.ing, emoji: "•", unit: "gosto" };
    const qty = kitchenIceScaledQty(item.qty, ing.unit, size.factor);
    const m = kitchenIceMacros(kitchenDb, [item], size.factor);
    return `
      <div class="kt-ing">
        <span class="kt-ing-name">${ing.emoji} ${escapeHtml(ing.name)}${item.optional ? ' <span class="text-muted">(opcional)</span>' : ""}${ing.note ? `<span class="kt-tea-role">${escapeHtml(ing.note)}</span>` : ""}</span>
        <span class="kt-ing-qty">${kitchenIceQtyText(qty, ing.unit)}${m.kcal >= 1 ? `<span class="kt-ice-ing-m">${iceKcal(m.kcal)} kcal · ${iceG(m.p)} g P</span>` : ""}</span>
      </div>`;
  }).join("");
  const suggested = new Set(recipe.mixins || []);
  const mixChips = [...KITCHEN_ICE_MIXINS].sort((a, b) => Number(suggested.has(b.ing)) - Number(suggested.has(a.ing))).map((x) => {
    const ing = kitchenIceIng(x.ing);
    const m = kitchenIceMacros(kitchenDb, [x], 1);
    return `<button type="button" class="chip-btn kt-chip${iceMix.has(x.ing) ? " is-on" : ""}${suggested.has(x.ing) ? " is-suggested" : ""}" data-click="iceMixToggle" data-ing="${x.ing}" aria-pressed="${iceMix.has(x.ing)}">${ing.emoji} ${escapeHtml(x.label)} <span class="kt-ice-chip-sub">+${iceKcal(m.kcal)}</span></button>`;
  }).join("");
  const servingChips = [1, 2, 3, 4].map((n) => `
    <button type="button" class="chip-btn kt-chip${iceServings === n ? " is-on" : ""}" data-click="iceServingsPick" data-n="${n}">${n === 1 ? "🫙 Pote inteiro" : `÷ ${n} porções`}</button>`).join("");
  const steps = iceSteps(recipe).map((step, i) => `
    <div class="kt-ice-step${iceStepsDone.has(i) ? " is-done" : ""}" role="button" tabindex="0" data-click="iceStepToggle" data-i="${i}">
      <span class="kt-ice-step-n">${iceStepsDone.has(i) ? "✓" : i + 1}</span>
      <span class="kt-ice-step-body">
        <span class="kt-ice-step-title">${step.icon} ${escapeHtml(step.title)}</span>
        <span class="kt-ice-step-text">${escapeHtml(step.text)}</span>
      </span>
    </div>`).join("");
  const fill = pint.ml ? Math.round((pint.ml / size.fillMl) * 100) : 0;
  document.getElementById("viewIce").innerHTML = `
    <div class="kt-hero">
      <span class="kt-hero-emoji">${escapeHtml(recipe.emoji || "🍦")}</span>
      <div class="kt-hero-name">${escapeHtml(recipe.name || "Pote sem nome")}</div>
      <div class="kt-hero-author">${recipe.fixed ? `📗 receita do ${author.emoji} ${author.name}` : "🧑‍🍳 teu pote"} · ${size.icon} ${size.name} ${size.short}</div>
      <div class="kt-tags">
        <span class="kt-tag">${prog.icon} ${prog.name}</span>
        <span class="kt-tag">${kitchenIceIsFruit(recipe) ? "🍓 Só fruta" : "💪 Proteico"}</span>
        ${frozen.length ? `<span class="kt-tag kt-ice-tag-frozen">🧊 ${frozen.length} no freezer</span>` : ""}
      </div>
    </div>
    <div class="card kt-ice-macros">
      <div class="kt-ice-macro-head">${iceServings === 1 ? "🫙 No pote inteiro" : `🥄 Por porção (pote ÷ ${iceServings})`}${mixItems.length ? " · com mix-in" : ""}</div>
      <div class="kt-ice-macro-row">
        <div class="kt-ice-macro is-kcal"><span class="kt-ice-macro-v">${iceKcal(per(total.kcal))}</span><span class="kt-ice-macro-l">🔥 kcal</span></div>
        <div class="kt-ice-macro is-p"><span class="kt-ice-macro-v">${iceG(per(total.p))}<small>g</small></span><span class="kt-ice-macro-l">💪 proteína</span></div>
        <div class="kt-ice-macro is-c"><span class="kt-ice-macro-v">${iceG(per(total.c))}<small>g</small></span><span class="kt-ice-macro-l">🍞 carbo</span></div>
        <div class="kt-ice-macro is-f"><span class="kt-ice-macro-v">${iceG(per(total.f))}<small>g</small></span><span class="kt-ice-macro-l">🧈 gordura</span></div>
      </div>
      <div class="kt-ice-macro-foot">${iceG(iceDensity(total))} g de proteína a cada 100 kcal · ${iceDensityQuip(total)}</div>
      ${mixItems.length ? `<div class="kt-ice-macro-foot text-muted">Sem mix-in: ${iceKcal(per(pint.kcal))} kcal · ${iceG(per(pint.p))} g prot. Mix-in soma +${iceKcal(per(mixM.kcal))} kcal.</div>` : ""}
    </div>
    <div class="kt-chips">${servingChips}</div>
    ${recipe.about ? `<div class="section-title">🎯 Por que funciona</div><div class="hint-box kt-hint kt-tea-about">${escapeHtml(recipe.about)}</div>` : ""}
    <div class="btn-row kt-ice-actions">
      <button type="button" class="btn kt-btn-fire" data-click="iceFreezeNow">🧊 Congelei um pote</button>
      <button type="button" class="btn btn-secondary" data-click="iceEatNow">🍦 Comi um pote</button>
    </div>
    <div class="btn-row kt-recipe-actions">
      <button type="button" class="btn btn-secondary" data-click="iceToShopping">🛒 Ingredientes na lista</button>
      ${recipe.fixed
        ? '<button type="button" class="btn btn-secondary" data-click="iceRemix">✏️ Fazer minha versão</button>'
        : '<button type="button" class="btn btn-secondary" data-click="editIce">✏️ Editar</button>'}
    </div>
    <div class="section-title">🧺 Ingredientes (${size.short})</div>
    <div class="card kt-ing-list">${items || '<div class="text-muted">Sem ingredientes. Toca em ✏️ Editar.</div>'}</div>
    ${pint.ml ? `<div class="kt-legend text-muted">≈ ${Math.round(pint.ml)} ml de base · ${fill > 100 ? "⚠️ pode passar da linha MAX: tira um pouco do líquido" : `ocupa uns ${fill}% até a linha MAX`}</div>` : ""}
    ${recipe.tip ? `<div class="hint-box kt-hint kt-ice-tip">💡 ${escapeHtml(recipe.tip)}</div>` : ""}
    <div class="section-title">🍫 Mix-in? (toca pra somar)</div>
    <div class="kt-chips is-wrap">${mixChips}</div>
    <div class="section-title">🌀 Como bater <span class="kt-ice-sub">toca no passo pra riscar</span></div>
    <div class="kt-ice-steps">${steps}</div>
    <div class="toba-stats">
      ${iceStatTile("🍦 Você comeu", `${eaten.length}×`, eaten.length ? `último: ${isoToBrDate(eaten[0].date)}` : "ainda não", "text-coral")}
      ${iceStatTile("📅 Este mês", `${eaten.filter((p) => String(p.date || "").startsWith(month)).length}×`, "potes desse sabor")}
    </div>
    ${eaten.length ? `
      <div class="section-title">📜 Últimos potes</div>
      <div class="toba-list">${eaten.slice(0, 5).map((p, i) => `
        <div class="toba-list-item kt-history">
          <span>${i === 0 ? "🍦" : "•"} ${isoToBrDate(p.date)} · ${new Date(Number(p.eatenAt)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${kitchenIceSize(p.size).short}</span>
          ${i === 0 ? `<button type="button" class="chip-btn" data-click="iceUndoEat" data-id="${escapeHtml(p.id)}">↩ Desfazer</button>` : ""}
        </div>`).join("")}</div>` : ""}
    <div class="hint-box kt-hint kt-tea-warn">📏 kcal e macros calculados dos ingredientes com rótulo médio (TACO e marcas comuns). Pra bater com o teu pote, põe o rótulo do teu whey e leite em <button type="button" class="kt-ice-link" data-click="openIceLabels">✏️ Rótulos</button>.</div>`;
}

/* ---------------------------------------------------------------------
 * Freezer e "comi"
 * ------------------------------------------------------------------- */
function iceEatQuip(count, recipe) {
  if (count === 1) return "Primeiro pote! Brain freeze desbloqueado. 🥶";
  if (count === 10) return "10 potes! Já pode abrir uma sorveteria na quebrada. 🍨";
  const m = iceMacrosOf(recipe);
  if (m.p >= 50) return "Pote monstro mandado pra dentro. Os músculos agradecem. 💪";
  if (kitchenIceIsFruit(recipe)) return "Só fruta, zero culpa. Nunca foi sorte. 🙏";
  return `${count}º pote desse. Nunca foi sorte. 🙏`;
}

function iceSaveOr(rollback) {
  if (saveKitchenDb({ silent: true })) return true;
  rollback();
  return false;
}

function iceFreezeNow() {
  const recipe = kitchenIceRecipe(kitchenDb, iceId);
  if (!recipe) return;
  const now = Date.now();
  const entry = { id: kitchenNewId("s"), iceId: recipe.id, size: iceSizeNow().key, frozenAt: now, eatenAt: 0, date: "" };
  kitchenDb.icePints.push(entry);
  if (!iceSaveOr(() => { kitchenDb.icePints = kitchenDb.icePints.filter((p) => p !== entry); })) return;
  renderIce();
  const ready = new Date(now + KITCHEN_ICE_FREEZE_MS);
  tobaSaved(`🧊 No freezer! Pronto ${ready.toLocaleDateString("pt-BR", { weekday: "long" })} às ${ready.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
}

// Comeu: usa o pote mais antigo desse sabor no freezer; sem nenhum, conta um novo
function iceMarkEaten(pint) {
  const now = Date.now();
  const before = { ...pint };
  pint.eatenAt = now;
  pint.date = toIsoDate();
  if (!iceSaveOr(() => Object.assign(pint, before))) return false;
  if (typeof kitchenPlayerCheck === "function") kitchenPlayerCheck();
  const recipe = kitchenIceRecipe(kitchenDb, pint.iceId);
  tobaSaved(`🍦 ${recipe ? iceEatQuip(kitchenIceEatenOf(kitchenDb, recipe.id).length, recipe) : "Pote comido!"}`);
  return true;
}

function iceEatNow() {
  const recipe = kitchenIceRecipe(kitchenDb, iceId);
  if (!recipe) return;
  let pint = kitchenIceFreezerOf(kitchenDb).find((p) => String(p.iceId) === String(recipe.id));
  if (!pint) {
    pint = { id: kitchenNewId("s"), iceId: recipe.id, size: iceSizeNow().key, frozenAt: 0, eatenAt: 0, date: "" };
    kitchenDb.icePints.push(pint);
  }
  const added = !Number(pint.frozenAt);
  if (!iceMarkEaten(pint) && added) kitchenDb.icePints = kitchenDb.icePints.filter((p) => p !== pint);
  renderIce();
}

async function iceEatPint(id) {
  const pint = kitchenIcePintsOf(kitchenDb).find((p) => String(p.id) === String(id));
  if (!pint) return;
  const left = kitchenIceLeftMs(pint);
  if (left > 0) {
    const ok = await showPageMessage(`Esse pote ainda tá ${iceLeftText(left).replace("⏳ ", "")}. Batido antes das 24 h o meio sai mole. Comeu mesmo assim?`, {
      title: "Apressadinho, hein", icon: "⏳", confirm: true, danger: false, confirmLabel: "Comi! 🍦", cancelLabel: "Espero",
    });
    if (!ok) return;
  }
  iceMarkEaten(pint);
  renderBook();
}

async function iceDropPint(id) {
  const pint = kitchenIcePintsOf(kitchenDb).find((p) => String(p.id) === String(id));
  if (!pint) return;
  const ok = await showPageMessage("Tirar esse pote do freezer do Toba? (Não conta como comido.)", { title: "Tirar do freezer", icon: "🧊", confirm: true, confirmLabel: "Tirar" });
  if (!ok) return;
  const before = kitchenDb.icePints;
  kitchenDb.icePints = before.filter((p) => p !== pint);
  if (!saveKitchenDb()) kitchenDb.icePints = before;
  renderBook();
}

async function iceUndoEat(id) {
  const pint = kitchenIcePintsOf(kitchenDb).find((p) => String(p.id) === String(id));
  if (!pint) return;
  const back = Number(pint.frozenAt) > 0;
  const ok = await showPageMessage(back ? "Desfazer? O pote volta pro 🧊 freezer." : "Tirar esse pote do contador?", { title: "Desfazer", confirm: true, confirmLabel: "Desfazer" });
  if (!ok) return;
  const before = kitchenDb.icePints.map((p) => ({ ...p }));
  if (back) {
    pint.eatenAt = 0;
    pint.date = "";
  } else {
    kitchenDb.icePints = kitchenDb.icePints.filter((p) => p !== pint);
  }
  if (!saveKitchenDb()) kitchenDb.icePints = before;
  renderIce();
}

/* 🛒 Ingredientes na lista (mesma regra dos chás: item igual não duplica) */
function iceToShopping() {
  const recipe = kitchenIceRecipe(kitchenDb, iceId);
  if (!recipe) return;
  const catalog = kitchenShopCatalog();
  const ids = [...new Set([...(recipe.items || []).filter((i) => !i.optional).map((i) => i.ing), ...iceMix])];
  let added = 0;
  let already = 0;
  ids.forEach((ingId) => {
    const ing = kitchenIceIng(ingId);
    if (!ing || ing.staple) return;
    const name = ing.shop || ing.name;
    const norm = kitchenNormalizeText(name);
    const item = catalog.find((i) => i.id === `ice-${ingId}`) || catalog.find((i) => kitchenNormalizeText(i.name) === norm);
    const same = kitchenDb.extras.find((x) => (item && x.itemId === item.id) || kitchenNormalizeText(x.name) === norm || (item && kitchenNormalizeText(x.name) === kitchenNormalizeText(item.name)));
    if (same) {
      if (same.checked) {
        same.checked = false;
        added += 1;
      } else already += 1;
      return;
    }
    const extra = { id: kitchenNewId("x"), name: item ? item.name : name, aisle: item ? item.aisle : ing.aisle || "mercearia", qty: "", checked: false, addedAt: Date.now() };
    if (item) extra.itemId = item.id;
    kitchenDb.extras.push(extra);
    added += 1;
  });
  if (!added) {
    tobaToast("👀 Tudo isso já tá na lista");
    return;
  }
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb = loadKitchenDb();
    return;
  }
  tobaToast(`🛒 ${added} ${added === 1 ? "item" : "itens"} na lista${already ? ` (${already} já tava)` : ""}!`);
}

/* ---------------------------------------------------------------------
 * 🧑‍🍳 Montar meu pote (fast UI: chips + − / +)
 * ------------------------------------------------------------------- */
const ICE_PRESETS = {
  proteico: { program: "lite", items: [{ ing: "leite-desnatado", qty: 320 }, { ing: "whey-baunilha", qty: 1 }, { ing: "leite-po-desnatado", qty: 1 }, { ing: "goma-xantana", qty: 0.25 }, { ing: "adocante", qty: null }] },
  chocolate: { program: "lite", items: [{ ing: "leite-desnatado", qty: 320 }, { ing: "whey-chocolate", qty: 1 }, { ing: "cacau", qty: 1 }, { ing: "goma-xantana", qty: 0.25 }, { ing: "adocante", qty: null }] },
  sorbet: { program: "sorbet", items: [{ ing: "manga", qty: 350 }, { ing: "suco-limao", qty: 30 }, { ing: "agua", qty: 50 }] },
};

function openIceSheet(draft) {
  iceDraft = draft;
  document.getElementById("iceSheetTitle").textContent = draft.id ? "✏️ Editar pote" : "🍦 Montar meu pote";
  document.getElementById("iceName").value = draft.name || "";
  document.getElementById("iceDelete").hidden = !draft.id;
  renderIceSheet();
  openTobaModal("iceSheet");
}

function newIce() {
  openIceSheet({ id: null, name: "", emoji: "🍦", program: "lite", items: [] });
}

function editIce() {
  const recipe = kitchenIceRecipe(kitchenDb, iceId);
  if (!recipe || recipe.fixed) return;
  openIceSheet(JSON.parse(JSON.stringify({ id: recipe.id, name: recipe.name, emoji: recipe.emoji, program: recipe.program, items: recipe.items })));
}

// "✏️ Fazer minha versão": copia a receita pronta (mais os mix-ins marcados) pra folha
function iceRemix() {
  const recipe = kitchenIceRecipe(kitchenDb, iceId);
  if (!recipe) return;
  const items = recipe.items.map((i) => ({ ing: i.ing, qty: i.qty }));
  KITCHEN_ICE_MIXINS.filter((x) => iceMix.has(x.ing) && !items.some((i) => i.ing === x.ing)).forEach((x) => items.push({ ing: x.ing, qty: x.qty }));
  openIceSheet({ id: null, name: `${recipe.name} (minha)`.slice(0, 40), emoji: recipe.emoji, program: recipe.program, items });
}

function iceDraftIndex(ing) {
  return iceDraft.items.findIndex((i) => i.ing === ing);
}

function renderIceSheet() {
  const d = iceDraft;
  const size = iceSizeNow();
  document.getElementById("iceEmojis").innerHTML = KITCHEN_ICE_EMOJIS.map((e) => `
    <button type="button" class="chip-btn kt-chip kt-tea-emoji${d.emoji === e ? " is-on" : ""}" data-click="icePickEmoji" data-emoji="${e}">${e}</button>`).join("");
  document.getElementById("icePrograms").innerHTML = KITCHEN_ICE_PROGRAMS.filter((p) => p.key !== "milkshake").map((p) => `
    <button type="button" class="chip-btn kt-chip${d.program === p.key ? " is-on" : ""}" data-click="icePickProgram" data-key="${p.key}">${p.icon} ${p.name}${p.deluxe ? " (Deluxe)" : ""}</button>`).join("");
  document.getElementById("icePresets").hidden = d.items.length > 0;
  const chosen = new Set(d.items.map((i) => i.ing));
  document.getElementById("iceIngs").innerHTML = KITCHEN_ICE_KINDS.map((kind) => {
    const ids = Object.keys(KITCHEN_ICE_INGS).filter((id) => KITCHEN_ICE_INGS[id].kind === kind.key);
    return `<div class="kt-aisle">${kind.icon} ${kind.name}</div>
      <div class="kt-chips is-wrap">${ids.map((id) => {
        const ing = KITCHEN_ICE_INGS[id];
        return `<button type="button" class="chip-btn kt-chip${chosen.has(id) ? " is-on" : ""}" data-click="iceToggleIng" data-ing="${id}" aria-pressed="${chosen.has(id)}">${ing.emoji} ${escapeHtml(ing.name)}</button>`;
      }).join("")}</div>`;
  }).join("");
  const m = kitchenIceMacros(kitchenDb, d.items, 1);
  const fill = m.ml ? Math.round((m.ml / KITCHEN_ICE_SIZES.std.fillMl) * 100) : 0;
  document.getElementById("iceParts").innerHTML = d.items.length
    ? `<div class="card kt-ing-list">${d.items.map((item) => {
        const ing = kitchenIceIng(item.ing) || { name: item.ing, emoji: "•", unit: "gosto" };
        if (ing.unit === "gosto") {
          return `<div class="kt-ing kt-tea-part"><span class="kt-ing-name">${ing.emoji} ${escapeHtml(ing.name)}</span><span class="kt-ing-qty text-muted">a gosto</span>
            <button type="button" class="chip-btn kt-ice-x" data-click="iceToggleIng" data-ing="${item.ing}" aria-label="Tirar">✕</button></div>`;
        }
        const qm = kitchenIceMacros(kitchenDb, [item], 1);
        const quick = (ing.chips || []).map((n) => `<button type="button" class="chip-btn kt-chip kt-ice-qchip${Number(item.qty) === n ? " is-on" : ""}" data-click="iceSetQty" data-ing="${item.ing}" data-qty="${n}">${kitchenIceQtyText(n, ing.unit)}</button>`).join("");
        return `
          <div class="kt-ice-part">
            <div class="kt-ing kt-tea-part">
              <span class="kt-ing-name">${ing.emoji} ${escapeHtml(ing.name)}<span class="kt-tea-role">${iceKcal(qm.kcal)} kcal · ${iceG(qm.p)} g prot</span></span>
              <span class="kt-stepper">
                <button type="button" class="round-btn" data-click="iceStepQty" data-ing="${item.ing}" data-dir="-1" aria-label="Menos">−</button>
                <span class="kt-ice-n">${kitchenIceQtyText(item.qty, ing.unit)}</span>
                <button type="button" class="round-btn" data-click="iceStepQty" data-ing="${item.ing}" data-dir="1" aria-label="Mais">+</button>
              </span>
            </div>
            ${quick ? `<div class="kt-chips kt-ice-quick">${quick}</div>` : ""}
          </div>`;
      }).join("")}</div>
      <div class="card kt-ice-macros is-mini">
        <div class="kt-ice-macro-row">
          <div class="kt-ice-macro is-kcal"><span class="kt-ice-macro-v">${iceKcal(m.kcal)}</span><span class="kt-ice-macro-l">🔥 kcal</span></div>
          <div class="kt-ice-macro is-p"><span class="kt-ice-macro-v">${iceG(m.p)}<small>g</small></span><span class="kt-ice-macro-l">💪 prot</span></div>
          <div class="kt-ice-macro is-c"><span class="kt-ice-macro-v">${iceG(m.c)}<small>g</small></span><span class="kt-ice-macro-l">🍞 carbo</span></div>
          <div class="kt-ice-macro is-f"><span class="kt-ice-macro-v">${iceG(m.f)}<small>g</small></span><span class="kt-ice-macro-l">🧈 gord</span></div>
        </div>
        <div class="kt-ice-macro-foot">${m.ml ? `≈ ${Math.round(m.ml)} ml de base no pote normal · ${fill > 100 ? "⚠️ passa da linha MAX" : `${fill}% até a MAX`}` : "Põe um líquido ou fruta pra virar sorvete."}${size.key === "xl" ? " · no Deluxe o Toba multiplica por 1,5 sozinho" : ""}</div>
      </div>
      <div class="kt-legend text-muted">Monta pro pote normal (470 ml). Os números são do pote inteiro.</div>`
    : '<div class="hint-box kt-hint">Começa por uma base pronta aqui em cima ou toca nos ingredientes. Cada um entra numa quantidade boa e tu ajusta no − / + ou nos chips.</div>';
  document.getElementById("icePartsTitle").textContent = d.items.length ? `⚖️ No pote (${d.items.length})` : "⚖️ No pote";
}

function iceDefaultQty(ing) {
  if (ing.unit === "gosto") return null;
  const chips = ing.chips || [];
  if (!chips.length) return ing.step || 1;
  return chips[Math.min(chips.length - 1, Math.floor((chips.length - 1) / 2))];
}

function iceToggleIng(id) {
  const i = iceDraftIndex(id);
  if (i >= 0) iceDraft.items.splice(i, 1);
  else {
    const ing = kitchenIceIng(id);
    if (!ing) return;
    iceDraft.items.push({ ing: id, qty: iceDefaultQty(ing) });
  }
  renderIceSheet();
}

function iceStepQty(id, dir) {
  const item = iceDraft.items[iceDraftIndex(id)];
  const ing = item && kitchenIceIng(id);
  if (!ing || ing.unit === "gosto") return;
  const step = ing.step || 1;
  const next = Math.round((Number(item.qty || 0) + dir * step) * 100) / 100;
  if (next <= 0) {
    iceDraft.items.splice(iceDraftIndex(id), 1);
  } else {
    item.qty = Math.min(next, ing.unit === "ml" || ing.unit === "g" ? 900 : 10);
  }
  renderIceSheet();
}

function iceSetQty(id, qty) {
  const item = iceDraft.items[iceDraftIndex(id)];
  if (!item) return;
  item.qty = Number(qty);
  renderIceSheet();
}

function icePreset(key) {
  const preset = ICE_PRESETS[key];
  if (!preset) return;
  iceDraft.program = preset.program;
  iceDraft.items = preset.items.map((i) => ({ ...i }));
  if (key === "sorbet" && iceDraft.emoji === "🍦") iceDraft.emoji = "🍧";
  if (key === "chocolate" && iceDraft.emoji === "🍦") iceDraft.emoji = "🍫";
  renderIceSheet();
}

function saveIce() {
  const d = iceDraft;
  d.name = String(document.getElementById("iceName").value || "").trim().slice(0, 40);
  const real = d.items.filter((i) => kitchenIceIng(i.ing));
  if (!real.some((i) => i.qty > 0)) {
    showPageMessage("Põe pelo menos um líquido, fruta ou proteína com quantidade. 🥛", { title: "Pote de vento?", icon: "🫙" });
    return;
  }
  if (!d.name) {
    const main = real.find((i) => ["fruta", "proteina"].includes(kitchenIceIng(i.ing).kind)) || real[0];
    d.name = `Meu pote de ${kitchenIceIng(main.ing).name.toLowerCase()}`.slice(0, 40);
  }
  const items = real.map((i) => ({ ing: i.ing, qty: i.qty === null || i.qty === undefined ? null : Number(i.qty) }));
  const now = Date.now();
  const before = JSON.stringify(kitchenDb.ices);
  let recipe = d.id ? kitchenIcesOf(kitchenDb).find((r) => String(r.id) === String(d.id)) : null;
  if (recipe) {
    Object.assign(recipe, { name: d.name, emoji: d.emoji || "🍦", program: d.program || "lite", items, updatedAt: now });
  } else {
    recipe = { id: kitchenNewId("m"), name: d.name, emoji: d.emoji || "🍦", program: d.program || "lite", items, createdAt: now, updatedAt: now };
    kitchenDb.ices.push(recipe);
  }
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.ices = JSON.parse(before);
    return;
  }
  closeTobaModal("iceSheet");
  tobaSaved(d.id ? "🍦 Pote atualizado" : `🍦 ${recipe.name} no livro!`);
  openIce(recipe.id);
}

async function deleteIce() {
  const recipe = iceDraft && iceDraft.id ? kitchenIcesOf(kitchenDb).find((r) => String(r.id) === String(iceDraft.id)) : null;
  if (!recipe) return;
  const ok = await showPageMessage(`Apagar o ${recipe.emoji} ${recipe.name} e os potes dele (freezer e contador)? Não dá pra desfazer.`, { title: "Apagar pote", icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  const ices = kitchenDb.ices;
  const pints = kitchenDb.icePints;
  kitchenDb.ices = ices.filter((r) => r !== recipe);
  kitchenDb.icePints = pints.filter((p) => String(p.iceId) !== String(recipe.id));
  if (!saveKitchenDb()) {
    kitchenDb.ices = ices;
    kitchenDb.icePints = pints;
    return;
  }
  closeTobaModal("iceSheet");
  bookMeal = "sorvetes";
  openBook();
}

/* ---------------------------------------------------------------------
 * ✏️ Rótulos (whey, leite, iogurte... da marca do usuário)
 * ------------------------------------------------------------------- */
function openIceLabels() {
  const own = kitchenDb.iceLabels || {};
  const field = (id, key, label, base) => {
    const v = own[id] && own[id][key] !== undefined && own[id][key] !== null && own[id][key] !== "" ? own[id][key] : "";
    return `<label class="kt-ice-lab-f"><span>${label}</span><input type="number" class="form-control" inputmode="decimal" min="0" max="2000" step="0.1" data-ing="${id}" data-key="${key}" placeholder="${String(base).replace(".", ",")}" value="${escapeHtml(String(v))}" /></label>`;
  };
  document.getElementById("iceLabelsList").innerHTML = Object.keys(KITCHEN_ICE_INGS).filter((id) => KITCHEN_ICE_INGS[id].label).map((id) => {
    const ing = KITCHEN_ICE_INGS[id];
    const mine = own[id] && Object.values(own[id]).some((v) => v !== "" && v !== null && v !== undefined);
    return `
      <div class="kt-ice-lab${mine ? " is-mine" : ""}">
        <div class="kt-ice-lab-name">${ing.emoji} ${escapeHtml(ing.name)} <span class="text-muted">${escapeHtml(ing.labelNote || "")}</span>${mine ? ' <span class="kt-ice-lab-badge">teu rótulo</span>' : ""}</div>
        <div class="kt-ice-lab-row">
          ${field(id, "kcal", "🔥 kcal", ing.kcal)}${field(id, "p", "💪 prot", ing.p)}${field(id, "c", "🍞 carbo", ing.c)}${field(id, "f", "🧈 gord", ing.f)}
        </div>
      </div>`;
  }).join("");
  openTobaModal("iceLabelsSheet");
}

function saveIceLabels() {
  const out = {};
  document.querySelectorAll("#iceLabelsList input[data-ing]").forEach((input) => {
    const raw = String(input.value || "").replace(",", ".").trim();
    if (raw === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 2000) return;
    const id = input.dataset.ing;
    out[id] = out[id] || {};
    out[id][input.dataset.key] = Math.round(n * 10) / 10;
  });
  const before = kitchenDb.iceLabels;
  // Mantém rótulo gravado de ingrediente que não aparece mais aqui (nada se perde)
  Object.keys(before || {}).forEach((id) => {
    if (!(KITCHEN_ICE_INGS[id] && KITCHEN_ICE_INGS[id].label)) out[id] = before[id];
  });
  kitchenDb.iceLabels = out;
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.iceLabels = before;
    return;
  }
  closeTobaModal("iceLabelsSheet");
  tobaSaved("📋 Rótulos salvos: as contas já usam os teus");
  iceRefresh();
}

async function resetIceLabels() {
  const ok = await showPageMessage("Voltar todos os ingredientes pro rótulo médio do Toba?", { title: "Rótulo padrão", icon: "📋", confirm: true, confirmLabel: "Voltar" });
  if (!ok) return;
  const before = kitchenDb.iceLabels;
  kitchenDb.iceLabels = {};
  if (!saveKitchenDb()) {
    kitchenDb.iceLabels = before;
    return;
  }
  closeTobaModal("iceLabelsSheet");
  iceRefresh();
}

function iceRefresh() {
  if (document.getElementById("viewIce").classList.contains("active")) renderIce();
  else if (document.getElementById("viewIceGuide").classList.contains("active")) renderIceGuide();
  else renderBook();
}

/* ---------------------------------------------------------------------
 * 🌀 Guia da Ninja
 * ------------------------------------------------------------------- */
const ICE_PROBLEMS = [
  { key: "po", icon: "❄️", name: "Saiu farelento / pó", fix: "Normalíssimo no fit (pouca gordura = sai tipo neve). Faz um buraco no meio, põe 1 a 2 colheres de sopa de leite desnatado e roda o Re-spin. Ainda seco? Mais uma colher e outro Re-spin. Sempre assim? Na próxima põe ¼ de colher de chá de goma xantana ou 1 colher de leite em pó na base." },
  { key: "gelo", icon: "🧊", name: "Ficou com cristal de gelo", fix: "É água sobrando sem nada pra segurar. Troca água por leite ou fruta, põe goma xantana (¼ cc) ou leite em pó, e usa fruta bem madura (mais açúcar natural). Freezer bem frio ajuda: o ideal é -18 °C ou menos." },
  { key: "sopa", icon: "🥣", name: "Ficou mole / sopa", fix: "Congelou pouco: tem que ser 24 h, reto. Se já tá mole, volta o pote pro freezer 1 a 2 h e roda de novo SEM splash. Re-spin demais também derrete: máximo 2." },
  { key: "corcova", icon: "⛰️", name: "Corcova no meio do pote", fix: "Água congelando sobe pelo meio. Antes de bater raspa a corcova com uma colher até ficar reto (corcova força a lâmina e pode travar). Pra evitar: bate o pote na bancada antes de congelar e põe no freezer bem nivelado." },
  { key: "chiclete", icon: "🫧", name: "Borrachudo / chiclete", fix: "Goma ou whey demais. Goma xantana é só ¼ de colher de chá (mais que isso vira chiclete). Com 2 scoops de whey, tira a goma e põe uns 30 ml a mais de leite." },
  { key: "doce", icon: "🍬", name: "Ficou sem doce / sem gosto", fix: "O gelado anestesia a língua: a base precisa ser mais doce do que parece certo. Prova antes de congelar e capricha no adoçante. Uma pitada de sal deixa chocolate e baunilha mais vivos." },
  { key: "giz", icon: "🧱", name: "Gosto de giz / arenoso", fix: "Whey concentrado demais ou proteína vegetal. Passa pro whey isolado ou blend, ou mistura meio a meio com iogurte proteico. Bate bem a base (30 s) e deixa descansar 5 min antes de congelar." },
  { key: "duro", icon: "🔨", name: "Não desce / faz barulhão", fix: "Barulho alto no começo é normal: a lâmina tá raspando um bloco de gelo. Se travar, deixa o pote 10 min fora antes. Nunca bate pote acima da linha MAX." },
];

function openIceGuide() {
  stopCookTicker();
  iceBookTicker(false);
  showKitchenView("viewIceGuide");
  tobaSetHeader({ page: "🌀 Guia da Ninja", back: "backFromIce" });
  renderIceGuide();
}

function renderIceGuide() {
  const problem = ICE_PROBLEMS.find((p) => p.key === iceProblem);
  const path = [
    ["🥤", "Bate a base", "Liquidificador 30 s. Base com goma descansa 5 min."],
    ["🫙", "Até a linha MAX", "Nivela, tampa, freezer reto 24 h."],
    ["⏳", "5–10 min fora", "Raspa a corcova se tiver."],
    ["🪶", "Lite Ice Cream", "Fruta pura: Sorbet. Açaí: Smoothie Bowl."],
    ["🥛", "Re-spin com splash", "1–2 colheres de leite. Até 2×."],
    ["🍫", "Mix-in", "Buraco até o fundo, até 40 g, programa Mix-in."],
  ];
  document.getElementById("viewIceGuide").innerHTML = `
    <div class="kt-hero">
      <span class="kt-hero-emoji">🌀</span>
      <div class="kt-hero-name">Guia da Ninja CREAMi</div>
      <div class="kt-hero-author">o caminho do pote fit, do Cloba pra tua CREAMi</div>
    </div>
    <div class="section-title is-first">🧭 O caminho do pote fit</div>
    <div class="kt-ice-path">${path.map(([icon, title, text], i) => `
      <div class="kt-ice-path-step"><span class="kt-ice-step-n">${i + 1}</span><span class="kt-ice-step-body"><span class="kt-ice-step-title">${icon} ${title}</span><span class="kt-ice-step-text">${text}</span></span></div>`).join("")}</div>
    <div class="section-title">🆘 Deu ruim? Toca no problema</div>
    <div class="kt-chips is-wrap">${ICE_PROBLEMS.map((p) => `
      <button type="button" class="chip-btn kt-chip${iceProblem === p.key ? " is-on" : ""}" data-click="iceProblemPick" data-key="${p.key}">${p.icon} ${p.name}</button>`).join("")}</div>
    ${problem ? `<div class="hint-box kt-hint kt-ice-fix"><b>${problem.icon} ${problem.name}:</b> ${problem.fix}</div>` : ""}
    <div class="section-title">🎛️ Programas da máquina</div>
    <div class="card kt-ing-list">${KITCHEN_ICE_PROGRAMS.map((p) => `
      <div class="kt-ing kt-ice-prog"><span class="kt-ing-name"><b>${p.icon} ${p.name}</b>${p.deluxe ? ' <span class="text-muted">(só Deluxe)</span>' : ""}<span class="kt-tea-role">${p.about}</span></span></div>`).join("")}
      <div class="kt-ing kt-ice-prog"><span class="kt-ing-name"><b>🔁 Re-spin</b><span class="kt-tea-role">Não é programa de base: roda de novo o que já foi batido pra deixar mais cremoso. É ele que salva o pote farelento (com 1 a 2 colheres de leite).</span></span></div>
      <div class="kt-ing kt-ice-prog"><span class="kt-ing-name"><b>🍫 Mix-in</b><span class="kt-tea-role">Só mistura, sem triturar tudo: pedaço de fruta, paçoca, chocolate picado. Sempre por último.</span></span></div>
    </div>
    <div class="section-title">💪 Whey, caseína ou iogurte?</div>
    <div class="hint-box kt-hint kt-tea-about"><b>Whey (isolado ou concentrado):</b> o que tu tem em casa, funciona bem com o Re-spin. Isolado sai mais liso; concentrado pode deixar um fundinho arenoso.<br><b>Caseína ou blend:</b> sai mais grosso e cremoso, quase de massa (se um dia comprar, troca meio scoop).<br><b>Iogurte proteico:</b> cremosidade de graça e proteína extra, ótimo pra froyo e mousse.<br>Mais de ~50 g de proteína no pote tende a ficar seco ou borrachudo: aí 2 Re-spins.</div>
    <div class="section-title">🧪 Cremoso sem gordura</div>
    <div class="hint-box kt-hint kt-tea-about">• <b>Goma xantana:</b> ¼ de colher de chá por pote. É o segredo do fit.<br>• <b>Leite em pó desnatado:</b> 1 colher de sopa encorpa e ainda dá proteína.<br>• <b>Banana bem madura:</b> faz papel de gordura.<br>• <b>Pó de pudim zero:</b> 1 colher, se achar o instantâneo.<br>• <b>Fruta madura</b> no sorbet: açúcar da fruta = menos gelo.<br>• <b>Adoçante a mais</b> que o normal: o frio tira o doce.</div>
    <div class="section-title">📏 Tamanho do pote</div>
    <div class="card kt-ing-list">${Object.values(KITCHEN_ICE_SIZES).map((s) => `
      <div class="kt-ing"><span class="kt-ing-name">${s.icon} <b>${s.name}</b> ${s.short}<span class="kt-tea-role">${s.models}${s.factor !== 1 ? ` · receita × ${String(s.factor).replace(".", ",")}` : ""}</span></span>
      <button type="button" class="chip-btn kt-chip${iceSizeNow().key === s.key ? " is-on" : ""}" data-click="iceSizePick" data-key="${s.key}">${iceSizeNow().key === s.key ? "✓ o meu" : "é o meu"}</button></div>`).join("")}
    </div>
    <div class="hint-box kt-hint kt-tea-warn">⚠️ Nunca bate sem congelar 24 h, nunca passa da linha MAX, nunca coloca a mão perto da lâmina e sempre raspa a corcova. A lâmina é afiada de verdade.</div>`;
}

/* ---------------------------------------------------------------------
 * Ações e abertura
 * ------------------------------------------------------------------- */
function iceSetSize(key) {
  if (!KITCHEN_ICE_SIZES[key] || kitchenDb.iceSize === key) return;
  const before = kitchenDb.iceSize;
  kitchenDb.iceSize = key;
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.iceSize = before;
    return;
  }
  tobaToast(`${KITCHEN_ICE_SIZES[key].icon} ${KITCHEN_ICE_SIZES[key].name} (${KITCHEN_ICE_SIZES[key].short}): contas refeitas`);
  iceRefresh();
}

tobaActions({
  openIce: (el) => openIce(el.dataset.id),
  backFromIce: () => {
    bookMeal = "sorvetes";
    openBook();
  },
  openIceGuide,
  iceFilterPick: (el) => {
    iceFilter = el.dataset.key;
    renderBook();
  },
  iceSortPick: (el) => {
    iceSort = el.dataset.key;
    renderBook();
  },
  iceSizePick: (el) => iceSetSize(el.dataset.key),
  iceServingsPick: (el) => {
    iceServings = Number(el.dataset.n) || 1;
    renderIce();
  },
  iceMixToggle: (el) => {
    const id = el.dataset.ing;
    if (iceMix.has(id)) iceMix.delete(id);
    else iceMix.add(id);
    renderIce();
  },
  iceStepToggle: (el) => {
    const i = Number(el.dataset.i);
    if (iceStepsDone.has(i)) iceStepsDone.delete(i);
    else iceStepsDone.add(i);
    renderIce();
  },
  iceFreezeNow,
  iceEatNow,
  iceEatPint: (el) => iceEatPint(el.dataset.id),
  iceDropPint: (el) => iceDropPint(el.dataset.id),
  iceUndoEat: (el) => iceUndoEat(el.dataset.id),
  iceToShopping,
  iceRemix,
  newIce,
  editIce,
  icePickEmoji: (el) => {
    iceDraft.emoji = el.dataset.emoji;
    renderIceSheet();
  },
  icePickProgram: (el) => {
    iceDraft.program = el.dataset.key;
    renderIceSheet();
  },
  icePreset: (el) => icePreset(el.dataset.key),
  iceToggleIng: (el) => iceToggleIng(el.dataset.ing),
  iceStepQty: (el) => iceStepQty(el.dataset.ing, Number(el.dataset.dir)),
  iceSetQty: (el) => iceSetQty(el.dataset.ing, el.dataset.qty),
  saveIce,
  deleteIce,
  openIceLabels,
  saveIceLabels,
  resetIceLabels,
  iceProblemPick: (el) => {
    iceProblem = iceProblem === el.dataset.key ? "" : el.dataset.key;
    renderIceGuide();
  },
});

// ?sorvete=<id> abre o sorvete · ?sorvetes=1 abre o livro no chip 🍦 · ?ninja=1 abre o guia
(function initSorvetes() {
  const params = new URLSearchParams(location.search);
  if (params.get("sorvete") && kitchenIceRecipe(kitchenDb, params.get("sorvete"))) {
    openIce(params.get("sorvete"));
    return;
  }
  if (params.get("ninja")) {
    bookMeal = "sorvetes";
    openIceGuide();
    return;
  }
  if (params.get("sorvetes")) {
    bookMeal = "sorvetes";
    openBook();
  }
})();
