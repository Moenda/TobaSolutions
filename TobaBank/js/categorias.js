/* =====================================================================
 * Toba Bank · gaveta de categorias do Gastos (desde v1.35)
 * - Depende de bank-core.js (BANK_CATEGORY_GROUPS, getBankCategory).
 * - Cada campo de categoria é um <input type="hidden"> (o id de sempre,
 *   o JS lê .value) + um botão .category-field com data-target apontando
 *   para ele. Para mudar o valor pelo JS use setCategoryField(id, valor),
 *   que também atualiza o botão.
 * ===================================================================== */
let categoryPickerTarget = null;

function setCategoryField(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const cat = getBankCategory(value);
  input.value = cat.id;
  document.querySelectorAll(`.category-field[data-target="${inputId}"]`).forEach((btn) => {
    btn.innerHTML = `
      <span class="category-field-emoji">${cat.emoji}</span>
      <span class="category-field-name">${escapeHtml(cat.name)}</span>
      <span class="category-field-arrow">›</span>`;
  });
}

function buildCategoryPicker() {
  if (document.getElementById("categoryPickerModal")) return;
  const groupsHtml = BANK_CATEGORY_GROUPS.map((g) => `
    <div class="category-group-label">${escapeHtml(g.label)}</div>
    <div class="category-grid">
      ${g.items.map((c) => `
        <button type="button" class="category-tile" data-click="pickCategory" data-id="${c.id}">
          <span class="category-tile-emoji">${c.emoji}</span>
          <span class="category-tile-name">${escapeHtml(c.short || c.name)}</span>
        </button>`).join("")}
    </div>`).join("");
  const modal = document.createElement("div");
  modal.className = "toba-modal";
  modal.id = "categoryPickerModal";
  modal.innerHTML = `
    <div class="toba-sheet">
      <div class="toba-sheet-header">
        <h3>🏷️ Onde foi parar o dinheiro?</h3>
        <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
      </div>
      <div class="category-picker">${groupsHtml}</div>
    </div>`;
  document.body.appendChild(modal);
}

tobaActions({
  openCategoryPicker(el) {
    buildCategoryPicker();
    categoryPickerTarget = el.dataset.target;
    const current = document.getElementById(categoryPickerTarget)?.value;
    document.querySelectorAll("#categoryPickerModal .category-tile").forEach((tile) => {
      tile.classList.toggle("is-selected", tile.dataset.id === current);
    });
    openTobaModal("categoryPickerModal");
  },
  pickCategory(el) {
    if (categoryPickerTarget) setCategoryField(categoryPickerTarget, el.dataset.id);
    closeTobaModal("categoryPickerModal");
  },
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".category-field[data-target]").forEach((btn) => {
    const input = document.getElementById(btn.dataset.target);
    setCategoryField(btn.dataset.target, input ? input.value : "outros");
  });
});
