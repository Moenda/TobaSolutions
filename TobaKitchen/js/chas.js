/* =====================================================================
 * Toba Kitchen · 🍵 Chás (js/chas.js, desde v1.96)
 * Chip "🍵 Chás" no Livro de Receitas: blends do usuário por PARTES
 * (3 de mulungu, 1 de hibisco...), conta do pote em gramas ou colheres,
 * "☕ Tomei uma xícara" e ervas direto na lista de compras.
 * Os blends moram em kitchenDb.teas (o catálogo das ervas e as ideias do
 * Cloba ficam em kitchen-recipes.js). Carrega DEPOIS do receitas.js.
 * ===================================================================== */
const TEA_JAR_CHIPS = { g: [30, 50, 100, 200, 500], cs: [4, 8, 12, 20] };

let teaId = null;
let teaDraft = null; // blend sendo editado na folha (cópia; só grava no Salvar)
let teaJar = { qty: 100, unit: "g" }; // conta do pote aberta agora

function teaBar(tea, big = false) {
  const shares = kitchenTeaShares(tea);
  if (!shares.length) return "";
  return `<span class="kt-tea-bar${big ? " is-big" : ""}">${shares.map((p) => `<span style="flex:${p.share};background:${p.color}" title="${escapeHtml(p.info.name)}"></span>`).join("")}</span>`;
}

function teaCard(tea) {
  const count = kitchenTeaBrewsOf(kitchenDb, tea.id).length;
  return `
    <div class="toba-list-item kt-recipe" role="button" tabindex="0" data-click="openTea" data-id="${escapeHtml(tea.id)}">
      <span class="kt-recipe-emoji">${escapeHtml(tea.emoji || "🍵")}</span>
      <span class="kt-recipe-text">
        <span class="kt-recipe-name">${escapeHtml(tea.name || "Blend sem nome")}</span>
        <span class="kt-recipe-meta">${escapeHtml(kitchenTeaPartsText(tea)) || "sem ervas ainda"}</span>
        ${teaBar(tea)}
      </span>
      ${count ? `<span class="kt-count" title="Xícaras tomadas">${count}×</span>` : '<span class="toba-hub-chevron">›</span>'}
    </div>`;
}

function teaIdeaCard(idea) {
  const author = KITCHEN_AUTHORS[idea.author] || KITCHEN_AUTHORS.cloba;
  return `
    <div class="toba-list-item kt-recipe">
      <span class="kt-recipe-emoji">${idea.emoji}</span>
      <span class="kt-recipe-text">
        <span class="kt-recipe-name">${escapeHtml(idea.name)}</span>
        <span class="kt-recipe-meta">${escapeHtml(kitchenTeaPartsText(idea))} · ${author.emoji} ${author.name}</span>
        ${teaBar(idea)}
      </span>
      <button type="button" class="chip-btn" data-click="useTeaIdea" data-id="${idea.id}">Usar</button>
    </div>`;
}

/* Livro com o chip 🍵 Chás: botão de novo blend, meus blends e ideias */
function renderTeaBook(query) {
  const q = kitchenNormalize(String(query || "").trim());
  const match = (tea) => !q || kitchenNormalize([tea.name, ...kitchenTeaShares(tea).map((p) => p.info.name)].join(" ")).includes(q);
  const mine = kitchenTeasByName(kitchenDb).filter(match);
  const names = new Set(kitchenTeasOf(kitchenDb).map((t) => kitchenNormalize(t.name)));
  const ideas = KITCHEN_TEA_IDEAS.filter((idea) => !names.has(kitchenNormalize(idea.name))).filter(match);
  let html = `
    <button type="button" class="kt-launch kt-tea-launch" data-click="newTea">
      <span class="kt-launch-icon">🍵</span>
      <span class="kt-launch-copy">
        <span class="kt-launch-title">Novo blend</span>
        <span class="kt-launch-detail">Toca nas ervas, diz quantas partes de cada e o Toba faz a conta do pote.</span>
      </span>
    </button>`;
  html += `<div class="section-title is-first">🍵 Meus blends</div>`;
  html += mine.length
    ? `<div class="toba-list">${mine.map(teaCard).join("")}</div>`
    : tobaEmpty("🫖", q ? "Nenhum blend com isso" : "Nenhum blend ainda", q ? "Tenta outra erva ou outro nome." : "Cria o teu no ➕ ou pega uma ideia aqui embaixo.");
  if (ideas.length) {
    html += `<div class="section-title">🤖 Ideias pra começar</div><div class="toba-list">${ideas.map(teaIdeaCard).join("")}</div>`;
  }
  html += '<div class="hint-box kt-hint kt-tea-warn">🩺 O Cloba não é médico: mulungu, valeriana e passiflora dão sono de verdade. Grávida, remédio controlado ou pressão baixa, pergunta pro médico antes.</div>';
  document.getElementById("bookList").innerHTML = html;
}

/* ---------------------------------------------------------------------
 * Detalhe do blend
 * ------------------------------------------------------------------- */
function openTea(id) {
  const tea = kitchenTea(kitchenDb, id);
  if (!tea) {
    openBook();
    return;
  }
  stopCookTicker();
  if (teaId !== tea.id) teaJar = tea.jar && TEA_JAR_CHIPS[tea.jar.unit] && Number(tea.jar.qty) > 0 ? { qty: Number(tea.jar.qty), unit: tea.jar.unit } : { qty: 100, unit: "g" };
  teaId = tea.id;
  showKitchenView("viewTea");
  tobaSetHeader({ page: "🍵 Chá", back: "backFromTea" });
  renderTea();
}

function renderTea() {
  const tea = kitchenTea(kitchenDb, teaId);
  if (!tea) return;
  const shares = kitchenTeaShares(tea);
  const totalParts = shares.reduce((sum, p) => sum + p.parts, 0);
  const purpose = kitchenTeaPurpose(tea.purpose);
  const brews = kitchenTeaBrewsOf(kitchenDb, tea.id);
  const legend = shares.map((p) => `
    <div class="kt-ing">
      <span class="kt-ing-name"><span class="kt-tea-dot" style="background:${p.color}"></span>${p.info.emoji} ${escapeHtml(p.info.name)}</span>
      <span class="kt-ing-qty">${kitchenTeaPartsNumber(p.parts)} ${p.parts > 1 ? "partes" : "parte"} · ${Math.round(p.share * 100)}%</span>
    </div>`).join("");
  const jar = kitchenTeaAmounts(tea, teaJar.qty, teaJar.unit).map((p) => `
    <div class="kt-ing">
      <span class="kt-ing-name"><span class="kt-tea-dot" style="background:${p.color}"></span>${p.info.emoji} ${escapeHtml(p.info.name)}</span>
      <span class="kt-ing-qty">${kitchenTeaAmountText(p.amount, teaJar.unit)}</span>
    </div>`).join("");
  const unitChips = [["g", "⚖️ Gramas"], ["cs", "🥄 Colheres"]].map(([key, label]) => `
    <button type="button" class="chip-btn kt-chip${teaJar.unit === key ? " is-on" : ""}" data-click="pickTeaUnit" data-unit="${key}">${label}</button>`).join("");
  const qtyChips = TEA_JAR_CHIPS[teaJar.unit].map((n) => `
    <button type="button" class="chip-btn kt-chip${Number(teaJar.qty) === n ? " is-on" : ""}" data-click="pickTeaJar" data-qty="${n}">${teaJar.unit === "g" ? `${n} g` : `${n} col.`}</button>`).join("");
  const custom = !TEA_JAR_CHIPS[teaJar.unit].includes(Number(teaJar.qty));
  document.getElementById("viewTea").innerHTML = `
    <div class="kt-hero">
      <span class="kt-hero-emoji">${escapeHtml(tea.emoji || "🍵")}</span>
      <div class="kt-hero-name">${escapeHtml(tea.name || "Blend sem nome")}</div>
      <div class="kt-hero-author">🫖 blend da casa · ${kitchenTeaPartsNumber(totalParts)} ${totalParts > 1 ? "partes" : "parte"} no total</div>
      ${purpose ? `<div class="kt-tags"><span class="kt-tag">${purpose.icon} ${purpose.name}</span></div>` : ""}
    </div>
    ${teaBar(tea, true)}
    <div class="card kt-ing-list">${legend || '<div class="text-muted">Sem ervas. Toca em ✏️ Editar.</div>'}</div>
    <button type="button" class="btn kt-btn-fire kt-cook-btn" data-click="teaBrewNow">☕ Tomei uma xícara (+1)</button>
    <div class="btn-row kt-recipe-actions">
      <button type="button" class="btn btn-secondary" data-click="editTea">✏️ Editar</button>
      <button type="button" class="btn btn-secondary" data-click="teaToShopping">🛒 Ervas na lista</button>
    </div>
    <div class="section-title">🫙 Montar o pote</div>
    <div class="kt-chips">${unitChips}</div>
    <div class="kt-chips is-wrap">${qtyChips}
      <input type="number" class="form-control kt-tea-qty${custom ? " is-on" : ""}" inputmode="decimal" min="1" max="5000" step="1" placeholder="outro" value="${custom ? escapeHtml(String(teaJar.qty)) : ""}" data-change="typeTeaJar" aria-label="Outra quantidade" />
    </div>
    <div class="card kt-ing-list">${jar}</div>
    <div class="kt-legend text-muted">Pra ${teaJar.unit === "g" ? `${String(teaJar.qty).replace(".", ",")} g` : kitchenFormatAmount(Number(teaJar.qty), "cs")} da mistura seca. Mistura tudo e guarda no pote fechado.</div>
    <div class="section-title">☕ Na xícara</div>
    <div class="hint-box kt-hint">${tea.howTo ? escapeHtml(tea.howTo) : "Regra de bolso: 1 colher de sopa da mistura pra 250 ml de água quente, abafa 5 a 10 min e coa. Anota o teu jeito no ✏️ Editar."}</div>
    <div class="toba-stats">
      <div class="toba-stat"><span class="toba-stat-label">☕ Você tomou</span><span class="toba-stat-value text-coral">${brews.length}×</span><span class="toba-stat-sub">${brews.length ? `última: ${isoToBrDate(brews[0].date)}` : "ainda não"}</span></div>
      <div class="toba-stat"><span class="toba-stat-label">📅 Este mês</span><span class="toba-stat-value">${brews.filter((b) => String(b.date || "").startsWith(toIsoDate().slice(0, 7))).length}×</span><span class="toba-stat-sub">xícaras desse blend</span></div>
    </div>
    ${brews.length ? `
      <div class="section-title">📜 Últimas xícaras</div>
      <div class="toba-list">${brews.slice(0, 5).map((b, i) => `
        <div class="toba-list-item kt-history">
          <span>${i === 0 ? "☕" : "•"} ${isoToBrDate(b.date)}${Number(b.doneAt) ? ` · ${new Date(Number(b.doneAt)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
          ${i === 0 ? `<button type="button" class="chip-btn" data-click="undoTeaBrew" data-id="${escapeHtml(b.id)}">↩ Desfazer</button>` : ""}
        </div>`).join("")}</div>` : ""}`;
}

function teaQuip(count, tea) {
  if (count === 1) return "Primeira xícara! Começou a vida de bruxo das ervas. 🧙";
  if (count === 10) return "10 xícaras! Já pode abrir uma ervanaria. 🌿";
  if (tea.purpose === "dormir") return "Agora larga o celular e vai dormir, hein. 😴";
  return `${count}ª xícara desse. Nunca foi sorte. 🙏`;
}

function teaBrewNow() {
  const tea = kitchenTea(kitchenDb, teaId);
  if (!tea) return;
  const entry = { id: kitchenNewId("b"), teaId: tea.id, date: toIsoDate(), doneAt: Date.now() };
  kitchenDb.teaBrews.push(entry);
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.teaBrews = kitchenDb.teaBrews.filter((b) => b !== entry);
    return;
  }
  renderTea();
  tobaSaved(`☕ ${teaQuip(kitchenTeaBrewsOf(kitchenDb, tea.id).length, tea)}`);
}

async function undoTeaBrew(id) {
  const ok = await showPageMessage("Tirar essa xícara do contador?", { title: "Desfazer", confirm: true, confirmLabel: "Tirar" });
  if (!ok) return;
  const before = kitchenDb.teaBrews;
  kitchenDb.teaBrews = before.filter((b) => String(b.id) !== String(id));
  if (!saveKitchenDb()) kitchenDb.teaBrews = before;
  renderTea();
}

function setTeaJar(qty, unit = teaJar.unit) {
  const n = Number(qty);
  if (!(n > 0) || n > 5000) return;
  teaJar = { qty: Math.round(n * 4) / 4, unit };
  const tea = kitchenTea(kitchenDb, teaId);
  if (tea) {
    tea.jar = { ...teaJar }; // lembra o último pote desse blend
    saveKitchenDb({ silent: true });
  }
  renderTea();
}

/* 🛒 Põe as ervas do blend na lista (mesma regra do Escolher: item igual não duplica) */
function teaToShopping() {
  const tea = kitchenTea(kitchenDb, teaId);
  if (!tea) return;
  const catalog = kitchenShopCatalog();
  let added = 0;
  let already = 0;
  kitchenTeaShares(tea).forEach((p) => {
    const norm = kitchenNormalizeText(p.info.name);
    const item = catalog.find((i) => i.id === `cha-${p.herb}`) || catalog.find((i) => kitchenNormalizeText(i.name) === norm);
    const same = kitchenDb.extras.find((x) => (item && x.itemId === item.id) || kitchenNormalizeText(x.name) === norm);
    if (same) {
      if (same.checked) {
        same.checked = false;
        added += 1;
      } else already += 1;
      return;
    }
    const extra = { id: kitchenNewId("x"), name: item ? item.name : p.info.name, aisle: item ? item.aisle : "chas", qty: "", checked: false, addedAt: Date.now() };
    if (item) extra.itemId = item.id;
    kitchenDb.extras.push(extra);
    added += 1;
  });
  if (!added) {
    tobaToast("👀 Essas ervas já tão todas na lista");
    return;
  }
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb = loadKitchenDb(); // volta pro que estava gravado
    return;
  }
  tobaToast(`🛒 ${added} ${added === 1 ? "erva" : "ervas"} na lista${already ? ` (${already} já tava)` : ""}!`);
}

/* ---------------------------------------------------------------------
 * Folha de criar/editar blend (fast UI: chips + − / +)
 * ------------------------------------------------------------------- */
function openTeaSheet(draft) {
  teaDraft = draft;
  document.getElementById("teaSheetTitle").textContent = draft.id ? "✏️ Editar blend" : "🍵 Novo blend";
  document.getElementById("teaName").value = draft.name || "";
  document.getElementById("teaHowTo").value = draft.howTo || "";
  document.getElementById("teaOther").value = "";
  document.getElementById("teaDelete").hidden = !draft.id;
  renderTeaSheet();
  openTobaModal("teaSheet");
}

function newTea() {
  openTeaSheet({ id: null, name: "", emoji: "🍵", purpose: "", parts: [], howTo: "" });
}

function editTea() {
  const tea = kitchenTea(kitchenDb, teaId);
  if (!tea) return;
  openTeaSheet(JSON.parse(JSON.stringify({ id: tea.id, name: tea.name, emoji: tea.emoji, purpose: tea.purpose, parts: tea.parts, howTo: tea.howTo })));
}

function useTeaIdea(id) {
  const idea = KITCHEN_TEA_IDEAS.find((i) => i.id === id);
  if (!idea) return;
  openTeaSheet({ id: null, name: idea.name, emoji: idea.emoji, purpose: idea.purpose, parts: idea.parts.map((p) => ({ ...p })), howTo: idea.howTo });
}

function teaDraftIndex(key) {
  return teaDraft.parts.findIndex((p) => (p.herb ? p.herb === key : `n:${kitchenNormalizeText(p.name)}` === key));
}

function teaPartKey(part) {
  return part.herb ? part.herb : `n:${kitchenNormalizeText(part.name)}`;
}

function renderTeaSheet() {
  const d = teaDraft;
  document.getElementById("teaEmojis").innerHTML = KITCHEN_TEA_EMOJIS.map((e) => `
    <button type="button" class="chip-btn kt-chip kt-tea-emoji${d.emoji === e ? " is-on" : ""}" data-click="pickTeaEmoji" data-emoji="${e}">${e}</button>`).join("");
  document.getElementById("teaPurposes").innerHTML = KITCHEN_TEA_PURPOSES.map((p) => `
    <button type="button" class="chip-btn kt-chip${d.purpose === p.key ? " is-on" : ""}" data-click="pickTeaPurpose" data-key="${p.key}">${p.icon} ${p.name}</button>`).join("");
  const chosen = new Set(d.parts.map(teaPartKey));
  const chip = (key, emoji, name) => `<button type="button" class="chip-btn kt-chip${chosen.has(key) ? " is-on" : ""}" data-click="toggleTeaHerb" data-key="${escapeHtml(key)}" data-name="${escapeHtml(name)}" aria-pressed="${chosen.has(key)}">${emoji} ${escapeHtml(name)}</button>`;
  const groups = KITCHEN_TEA_KINDS.map((kind) => {
    const ids = Object.keys(KITCHEN_TEA_HERBS).filter((id) => KITCHEN_TEA_HERBS[id].kind === kind.key)
      .sort((a, b) => KITCHEN_TEA_HERBS[a].name.localeCompare(KITCHEN_TEA_HERBS[b].name, "pt-BR"));
    return `<div class="kt-aisle">${kind.icon} ${kind.name}</div>
      <div class="kt-chips is-wrap">${ids.map((id) => chip(id, KITCHEN_TEA_HERBS[id].emoji, KITCHEN_TEA_HERBS[id].name)).join("")}</div>`;
  });
  const customs = [...new Set([...kitchenTeaCustomNames(kitchenDb), ...d.parts.filter((p) => !p.herb).map((p) => p.name)])];
  if (customs.length) {
    groups.push(`<div class="kt-aisle">✍️ Suas</div>
      <div class="kt-chips is-wrap">${customs.map((name) => chip(`n:${kitchenNormalizeText(name)}`, "🌿", name)).join("")}</div>`);
  }
  document.getElementById("teaHerbs").innerHTML = groups.join("");
  const total = d.parts.reduce((sum, p) => sum + Number(p.parts), 0);
  document.getElementById("teaParts").innerHTML = d.parts.length
    ? `${teaBar(d, true)}
      <div class="card kt-ing-list">${kitchenTeaShares(d).map((p) => `
        <div class="kt-ing kt-tea-part">
          <span class="kt-ing-name"><span class="kt-tea-dot" style="background:${p.color}"></span>${p.info.emoji} ${escapeHtml(p.info.name)}</span>
          <span class="kt-stepper">
            <button type="button" class="round-btn" data-click="stepTeaPart" data-key="${escapeHtml(teaPartKey(p))}" data-dir="-1" aria-label="Menos uma parte"${p.parts <= 0.5 ? " disabled" : ""}>−</button>
            <span class="kt-tea-n">${kitchenTeaPartsNumber(p.parts)}</span>
            <button type="button" class="round-btn" data-click="stepTeaPart" data-key="${escapeHtml(teaPartKey(p))}" data-dir="1" aria-label="Mais uma parte"${p.parts >= 99 ? " disabled" : ""}>+</button>
          </span>
          <span class="kt-tea-pct text-muted">${Math.round(p.share * 100)}%</span>
        </div>`).join("")}</div>
      <div class="kt-legend text-muted">${kitchenTeaPartsNumber(total)} partes no total · parte = colher, punhado ou grama, tanto faz: o que vale é a proporção.</div>`
    : '<div class="hint-box kt-hint">Toca nas ervas aqui em cima. Cada uma entra com 1 parte e você ajusta no − / +.</div>';
  document.getElementById("teaPartsTitle").textContent = d.parts.length ? `⚖️ Partes (${d.parts.length} ${d.parts.length === 1 ? "erva" : "ervas"})` : "⚖️ Partes";
}

function toggleTeaHerb(key, name) {
  const i = teaDraftIndex(key);
  if (i >= 0) teaDraft.parts.splice(i, 1);
  else if (key.startsWith("n:")) teaDraft.parts.push({ name, parts: 1 });
  else teaDraft.parts.push({ herb: key, parts: 1 });
  renderTeaSheet();
}

function stepTeaPart(key, dir) {
  const part = teaDraft.parts[teaDraftIndex(key)];
  if (!part) return;
  const n = Number(part.parts) || 1;
  if (dir > 0) part.parts = n < 1 ? 1 : Math.min(99, n + 1);
  else part.parts = n > 1 ? n - 1 : 0.5; // de 1 desce pra meia parte
  renderTeaSheet();
}

function addTeaOther() {
  const input = document.getElementById("teaOther");
  const typed = String(input.value || "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (!typed) return;
  const name = typed.charAt(0).toUpperCase() + typed.slice(1);
  const norm = kitchenNormalizeText(name);
  const known = Object.keys(KITCHEN_TEA_HERBS).find((id) => kitchenNormalizeText(KITCHEN_TEA_HERBS[id].name) === norm);
  const key = known || `n:${norm}`;
  if (teaDraftIndex(key) < 0) teaDraft.parts.push(known ? { herb: known, parts: 1 } : { name, parts: 1 });
  input.value = "";
  renderTeaSheet();
}

function saveTea() {
  const d = teaDraft;
  d.name = String(document.getElementById("teaName").value || "").trim().slice(0, 40);
  d.howTo = String(document.getElementById("teaHowTo").value || "").trim().slice(0, 300);
  if (!d.parts.length) {
    showPageMessage("Escolhe pelo menos uma erva pro blend. 🌿", { title: "Chá de água quente?", icon: "🫖" });
    return;
  }
  if (!d.name) {
    const purpose = kitchenTeaPurpose(d.purpose);
    d.name = purpose ? `Chá pra ${purpose.name.toLowerCase()}` : `Blend de ${kitchenTeaPartInfo(d.parts[0]).name.toLowerCase()}`;
  }
  const parts = d.parts.map((p) => (p.herb ? { herb: p.herb, parts: Number(p.parts) } : { name: p.name, parts: Number(p.parts) }));
  const now = Date.now();
  const before = JSON.stringify(kitchenDb.teas);
  let tea = d.id ? kitchenTea(kitchenDb, d.id) : null;
  if (tea) {
    Object.assign(tea, { name: d.name, emoji: d.emoji || "🍵", purpose: d.purpose || "", parts, howTo: d.howTo, updatedAt: now });
  } else {
    tea = { id: kitchenNewId("t"), name: d.name, emoji: d.emoji || "🍵", purpose: d.purpose || "", parts, howTo: d.howTo, createdAt: now, updatedAt: now };
    kitchenDb.teas.push(tea);
  }
  if (!saveKitchenDb({ silent: true })) {
    kitchenDb.teas = JSON.parse(before);
    return;
  }
  closeTobaModal("teaSheet");
  tobaSaved(d.id ? "🍵 Blend atualizado" : `🍵 ${tea.name} no livro!`);
  if (d.id && teaId === tea.id && document.getElementById("viewTea").classList.contains("active")) renderTea();
  else openTea(tea.id);
}

async function deleteTea() {
  const tea = teaDraft && teaDraft.id ? kitchenTea(kitchenDb, teaDraft.id) : null;
  if (!tea) return;
  const ok = await showPageMessage(`Apagar o ${tea.emoji} ${tea.name} e o contador de xícaras dele? Não dá pra desfazer.`, { title: "Apagar blend", icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  const teas = kitchenDb.teas;
  const brews = kitchenDb.teaBrews;
  kitchenDb.teas = teas.filter((t) => t !== tea);
  kitchenDb.teaBrews = brews.filter((b) => String(b.teaId) !== String(tea.id));
  if (!saveKitchenDb()) {
    kitchenDb.teas = teas;
    kitchenDb.teaBrews = brews;
    return;
  }
  closeTobaModal("teaSheet");
  bookMeal = "chas";
  openBook();
}

tobaActions({
  newTea,
  editTea,
  openTea: (el) => openTea(el.dataset.id),
  backFromTea: () => {
    bookMeal = "chas";
    openBook();
  },
  useTeaIdea: (el) => useTeaIdea(el.dataset.id),
  teaBrewNow,
  undoTeaBrew: (el) => undoTeaBrew(el.dataset.id),
  teaToShopping,
  pickTeaUnit: (el) => {
    if (el.dataset.unit === teaJar.unit) return;
    setTeaJar(el.dataset.unit === "g" ? 100 : 8, el.dataset.unit);
  },
  pickTeaJar: (el) => setTeaJar(el.dataset.qty),
  typeTeaJar: (el) => setTeaJar(String(el.value).replace(",", ".")),
  pickTeaEmoji: (el) => {
    teaDraft.emoji = el.dataset.emoji;
    renderTeaSheet();
  },
  pickTeaPurpose: (el) => {
    teaDraft.purpose = teaDraft.purpose === el.dataset.key ? "" : el.dataset.key;
    renderTeaSheet();
  },
  toggleTeaHerb: (el) => toggleTeaHerb(el.dataset.key, el.dataset.name),
  stepTeaPart: (el) => stepTeaPart(el.dataset.key, Number(el.dataset.dir)),
  addTeaOther,
  saveTea,
  deleteTea,
});

// ?cha=<id> abre o blend · ?chas=1 abre o livro no chip 🍵 Chás
(function initChas() {
  const params = new URLSearchParams(location.search);
  if (params.get("cha") && kitchenTea(kitchenDb, params.get("cha"))) {
    openTea(params.get("cha"));
    return;
  }
  if (params.get("chas")) {
    bookMeal = "chas";
    openBook();
  }
})();
