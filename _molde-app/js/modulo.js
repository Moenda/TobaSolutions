/* =====================================================================
 * Toba Molde · Módulo de exemplo (lista com folha de cadastro)
 * Depende de ../assets/toba-common.js e molde-core.js.
 * ===================================================================== */
function renderItems() {
  const list = document.getElementById("itemList");
  const done = moldeDb.items.filter((i) => i.done).length;
  document.getElementById("statTotal").textContent = moldeDb.items.length;
  document.getElementById("statDone").textContent = done;

  if (!moldeDb.items.length) {
    list.innerHTML = tobaEmpty("🫙", "Nada por aqui ainda", "Toque em + Item para começar.");
    return;
  }
  list.innerHTML = moldeDb.items
    .map((item) => `
      <div class="toba-list-item" role="button" tabindex="0" data-click="editItem" data-id="${escapeHtml(item.id)}">
        <div>
          <div class="molde-item-name${item.done ? " is-done" : ""}">${escapeHtml(item.name)}</div>
          <div class="text-muted molde-item-date">${isoToBrDate(item.date)}</div>
        </div>
        <span>${item.done ? "✅" : "⏳"}</span>
      </div>`)
    .join("");
}

function openItemSheet(item = null) {
  document.getElementById("itemSheetTitle").textContent = item ? "✏️ Editar item" : "➕ Novo item";
  document.getElementById("itemId").value = item ? item.id : "";
  document.getElementById("itemName").value = item ? item.name : "";
  document.getElementById("itemDate").value = item ? item.date : toIsoDate();
  document.getElementById("itemDone").checked = item ? item.done : false;
  document.getElementById("deleteItemBtn").hidden = !item;
  openTobaModal("itemSheet");
}

function saveItem() {
  const name = document.getElementById("itemName").value.trim();
  if (!name) {
    showPageMessage("Dá um nome pro item, chefia.", { title: "Faltou o nome", icon: "✍️" });
    return;
  }
  const id = document.getElementById("itemId").value;
  const data = {
    name,
    date: document.getElementById("itemDate").value || toIsoDate(),
    done: document.getElementById("itemDone").checked,
  };
  const existing = moldeDb.items.find((i) => String(i.id) === String(id));
  if (existing) Object.assign(existing, data);
  else moldeDb.items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data });
  saveMoldeDb();
  closeTobaModal("itemSheet");
  renderItems();
}

async function deleteItem() {
  const id = document.getElementById("itemId").value;
  if (!(await showPageMessage("Apagar este item?", { confirm: true, confirmLabel: "Apagar" }))) return;
  moldeDb.items = moldeDb.items.filter((i) => String(i.id) !== String(id));
  saveMoldeDb();
  closeTobaModal("itemSheet");
  renderItems();
}

function onMoldeDataReplaced() {
  renderItems();
}

tobaActions({
  newItem: () => openItemSheet(),
  editItem: (el) => openItemSheet(moldeDb.items.find((i) => String(i.id) === el.dataset.id)),
  saveItem,
  deleteItem,
});

renderItems();
