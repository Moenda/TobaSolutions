/* =====================================================================
 * Toba Bank · Raxador (divisão de contas)
 * Depende de ../assets/toba-common.js e bank-core.js
 * ===================================================================== */
let currentShares = {};
// Ordem dos participantes nas linhas de divisão: os botões usam o índice,
// porque um nome com aspas ("D'Ávila") não serve de identificador seguro.
let currentShareMembers = [];

// Lista de participantes digitada ("Ana, Beto, Ana") sem vazios nem repetidos:
// o nome é a chave das fatias, então dois "Ana" virariam um só.
function parseSplitterMembers(rawMembers) {
  return [...new Set(
    rawMembers
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m.length > 0),
  )];
}

function openNewSplitterGroupModal() {
  document.getElementById("newSplitterName").value = "";
  document.getElementById("newSplitterDate").value = toIsoDate();
  document.getElementById("newSplitterMembers").value = "";
  openTobaModal("newSplitterModal");
  setTimeout(() => document.getElementById("newSplitterName").focus(), 100);
}

function renderSplitterScreen() {
  const activeContainer = document.getElementById(
    "splitterActiveContainer",
  );
  const finishedContainer = document.getElementById(
    "splitterFinishedContainer",
  );
  if (!activeContainer || !finishedContainer) return;

  activeContainer.innerHTML = "";
  finishedContainer.innerHTML = "";

  const groups = db.splitterGroups || [];
  const emptyActive = tobaEmpty("🍕", "Nenhum rolê rolando", "Toque em <b>+ Rolê</b> e pare de fazer conta no guardanapo.");
  const emptyFinished = tobaEmpty("🏁", "Nenhum rolê finalizado", "", { compact: true });
  if (groups.length === 0) {
    activeContainer.innerHTML = emptyActive;
    finishedContainer.innerHTML = emptyFinished;
    return;
  }

  let hasActive = false;
  let hasFinished = false;

  groups.forEach((g) => {
    const totalSpent = (g.expenses || []).reduce(
      (acc, e) => acc + e.amount,
      0,
    );
    const membersCount = (g.members || []).length;
    const catEmoji = g.category ? g.category.trim().split(" ")[0] : "🍕";

    const cardHtml = `
      <div class="bank-card${g.isFinished ? " is-done" : ""}" role="button" tabindex="0" data-click="openGroup" data-id="${escapeHtml(g.id)}">
        <div class="bank-card-top" style="margin-bottom: 0">
          <span class="bank-card-title">${escapeHtml(catEmoji)} ${escapeHtml(g.name)}</span>
          <span class="bank-card-side">
            <span class="bank-card-side-label">${isoToBrDate(g.date)}</span>
            <span class="bank-card-side-value text-blue">${formatCurrency(totalSpent)}</span>
          </span>
        </div>
        <div class="bank-card-note"><span>👥 ${membersCount} ${membersCount === 1 ? "participante" : "participantes"}</span></div>
      </div>`;

    if (g.isFinished) {
      finishedContainer.insertAdjacentHTML("beforeend", cardHtml);
      hasFinished = true;
    } else {
      activeContainer.insertAdjacentHTML("beforeend", cardHtml);
      hasActive = true;
    }
  });

  if (!hasActive) activeContainer.innerHTML = emptyActive;
  if (!hasFinished) finishedContainer.innerHTML = emptyFinished;
}

function openSplitterGroupView(groupId) {
  const g = db.splitterGroups.find((item) => String(item.id) === String(groupId));
  if (!g) return;

  document.getElementById("splitterGroupIdInput").value = g.id;
  document.getElementById("detailSplitterTitle").innerText =
    `${g.category ? g.category.split(" ")[0] : "🍕"} ${g.name}`;

  document.getElementById("editSplitterName").value = g.name;
  document.getElementById("editSplitterCategory").value = g.category;
  document.getElementById("editSplitterDate").value = g.date;
  document.getElementById("splitterMembersInput").value = (
    g.members || []
  ).join(", ");

  const metaCard = document.getElementById("splitterMetaCard");
  if (metaCard) metaCard.hidden = true;

  const finishBtn = document.getElementById(
    "splitterToggleFinishBtnView",
  );
  const editingFields = document.querySelectorAll(".splitter-edit-field");
  const openExpenseBtn = document.getElementById(
    "openAddSplitterExpenseBtn",
  );

  finishBtn.innerText = g.isFinished ? "🔄 Reabrir" : "🏁 Finalizar";
  finishBtn.className = `btn btn-outline ${g.isFinished ? "btn-blue" : "btn-green"}`;
  openExpenseBtn.hidden = g.isFinished;
  editingFields.forEach((f) => (f.hidden = g.isFinished));

  renderSplitterExpensesAndSettlement(g);
  switchView("splitterDetail");
}

function toggleSplitterMetaCard() {
  const card = document.getElementById("splitterMetaCard");
  if (card) {
    card.hidden = !card.hidden;
  }
}

function updateSplitterGroupMeta() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => String(item.id) === String(id));
  if (!g) return;
  g.name = document.getElementById("editSplitterName").value;
  g.category = document.getElementById("editSplitterCategory").value;
  g.date = document.getElementById("editSplitterDate").value;
  document.getElementById("detailSplitterTitle").innerText =
    `${g.category ? g.category.split(" ")[0] : "🍕"} ${g.name}`;
  saveDatabase();
}

async function saveSplitterMembers() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => String(item.id) === String(id));
  if (!g) return;
  const rawMembers = document.getElementById(
    "splitterMembersInput",
  ).value;
  const newMembers = parseSplitterMembers(rawMembers);
  // Tirar alguém que já pagou ou consumiu deixa a conta torta (o nome some
  // da divisão, mas o gasto continua). Avisa antes.
  const removedWithExpenses = (g.members || []).filter(
    (m) =>
      !newMembers.includes(m) &&
      (g.expenses || []).some(
        (e) =>
          e.payer === m ||
          (e.shares && e.shares[m] > 0) ||
          (e.involved && e.involved.includes(m)),
      ),
  );
  if (
    removedWithExpenses.length > 0 &&
    !(await showPageMessage(
      `${removedWithExpenses.join(", ")} já tem gastos neste rolê. Se tirar da lista, a divisão deixa de contar essa pessoa.`,
      { title: "Tirar do rolê?", icon: "👀", confirm: true, confirmLabel: "Tirar mesmo" },
    ))
  ) {
    document.getElementById("splitterMembersInput").value = (
      g.members || []
    ).join(", ");
    return;
  }
  g.members = newMembers;
  saveDatabase();
  renderSplitterExpensesAndSettlement(g);
}

function openSplitterExpenseModal(expenseId = null) {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => String(item.id) === String(id));
  if (!g) return;

  const payerSelect = document.getElementById("splitterExpensePayer");
  payerSelect.innerHTML = "";
  const addPayerOption = (m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m;
    payerSelect.appendChild(opt);
  };
  (g.members || []).forEach(addPayerOption);

  const title = document.getElementById("splitterExpenseModalTitle");
  const idInput = document.getElementById("splitterExpenseIdInput");
  const descInput = document.getElementById("splitterExpenseDesc");
  const amountInput = document.getElementById("splitterExpenseAmount");
  const dateInput = document.getElementById("splitterExpenseDate");
  const deleteBtn = document.getElementById("deleteSplitterExpenseBtn");

  currentShares = {};

  if (expenseId) {
    const exp = g.expenses.find((e) => String(e.id) === String(expenseId));
    if (!exp) return;
    title.innerText = "✏️ Editar gasto";
    idInput.value = exp.id;
    descInput.value = exp.desc;
    amountInput.value = formatMoneyInput(exp.amount);
    // Quem pagou pode ter saído da lista de participantes: mantém o nome
    // para a edição não trocar o pagador sem você ver.
    if (exp.payer && !(g.members || []).includes(exp.payer))
      addPayerOption(exp.payer);
    payerSelect.value = exp.payer;
    dateInput.value = exp.date || g.date || toIsoDate();
    deleteBtn.hidden = false;

    if (exp.shares) {
      (g.members || []).forEach((m) => {
        currentShares[m] =
          exp.shares[m] !== undefined ? exp.shares[m] : 0;
      });
    } else if (exp.involved) {
      const equalPct = 100 / exp.involved.length;
      (g.members || []).forEach((m) => {
        currentShares[m] = exp.involved.includes(m) ? equalPct : 0;
      });
    } else {
      const equalPct = g.members.length > 0 ? 100 / g.members.length : 0;
      (g.members || []).forEach((m) => {
        currentShares[m] = equalPct;
      });
    }
  } else {
    title.innerText = "💸 Novo gasto no rolê";
    idInput.value = "";
    descInput.value = "";
    amountInput.value = "";
    dateInput.value = g.date || toIsoDate();
    deleteBtn.hidden = true;

    const equalPct = g.members.length > 0 ? 100 / g.members.length : 0;
    (g.members || []).forEach((m) => {
      currentShares[m] = equalPct;
    });
  }

  renderShareRows(g.members || []);
  openTobaModal("newSplitterExpenseModal");
  setTimeout(() => descInput.focus(), 100);
}

function renderShareRows(allMembers) {
  const container = document.getElementById(
    "splitterExpenseSharesContainer",
  );
  container.innerHTML = "";

  let totalPct = 0;
  allMembers.forEach((m) => {
    if (currentShares[m] !== undefined) {
      totalPct += currentShares[m];
    }
  });

  const titleEl = document.getElementById("splitterSharesTitleLabel");
  if (titleEl) {
    const isExact = Math.abs(totalPct - 100) < 0.1;
    titleEl.innerHTML = `⚖️ Divisão por participante (<b class="${isExact ? "text-green" : "text-red"}">${totalPct.toFixed(1)}%</b>)`;
  }

  currentShareMembers = [...allMembers];
  allMembers.forEach((m, index) => {
    const pct = currentShares[m] !== undefined ? currentShares[m] : 0;
    const isChecked = pct > 0;

    container.insertAdjacentHTML("beforeend", `
      <div class="share-row${isChecked ? "" : " is-off"}">
        <label>
          <input type="checkbox" id="chk-member-${index}" ${isChecked ? "checked" : ""} data-change="toggleMemberShare" data-index="${index}">
          <span>${escapeHtml(m)}</span>
        </label>
        <div class="share-pct">
          <input type="number" step="0.1" min="0" max="100" inputmode="decimal" class="form-control" value="${pct.toFixed(1)}" data-change="updateShareValue" data-index="${index}">
          <span>%</span>
        </div>
      </div>`);
  });
}

function updateShareValue(memberIndex, val) {
  const member = currentShareMembers[memberIndex];
  if (member === undefined) return;
  const num = parseFloat(val) || 0;
  currentShares[member] = Math.max(0, Math.min(100, num));
  const allMembers = Object.keys(currentShares);
  renderShareRows(allMembers);
}

function saveSplitterExpense() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => String(item.id) === String(id));
  if (!g) return;

  const expenseId = document.getElementById(
    "splitterExpenseIdInput",
  ).value;
  const desc = document.getElementById("splitterExpenseDesc").value;
  const amount = getMoney("splitterExpenseAmount");
  const payer = document.getElementById("splitterExpensePayer").value;
  const date = document.getElementById("splitterExpenseDate").value;

  if (!desc || amount <= 0 || !payer) {
    return showPageMessage("Preencha a descrição, o valor e quem pagou!", { title: "Quase lá", icon: "✍️" });
  }

  const totalPct = Object.values(currentShares).reduce(
    (a, b) => a + b,
    0,
  );
  if (Math.abs(totalPct - 100) > 0.5) {
    return showPageMessage(
      `A soma das fatias tem que dar 100%. Agora está em ${totalPct.toFixed(1)}%.`,
      { title: "A conta não fecha", icon: "🧮" },
    );
  }

  if (expenseId) {
    const index = g.expenses.findIndex((e) => String(e.id) === String(expenseId));
    if (index !== -1) {
      g.expenses[index] = {
        id: expenseId,
        desc,
        amount,
        payer,
        date,
        shares: { ...currentShares },
      };
    }
  } else {
    if (!g.expenses) g.expenses = [];
    g.expenses.push({
      id: Date.now().toString(),
      desc,
      amount,
      payer,
      date,
      shares: { ...currentShares },
    });
  }

  saveDatabase();
  closeTobaModal("newSplitterExpenseModal");
  renderSplitterExpensesAndSettlement(g);
}

function toggleMemberShare(memberIndex) {
  const member = currentShareMembers[memberIndex];
  if (member === undefined) return;
  const allMembers = Object.keys(currentShares);
  const isCheckedNow = document.getElementById(
    `chk-member-${memberIndex}`,
  ).checked;

  if (!isCheckedNow) {
    currentShares[member] = 0;
  }
  let activeMembers = allMembers.filter((m) =>
    m === member ? isCheckedNow : currentShares[m] > 0,
  );
  if (activeMembers.length > 0) {
    const equalShare = 100 / activeMembers.length;
    allMembers.forEach((m) => {
      currentShares[m] = activeMembers.includes(m) ? equalShare : 0;
    });
  }
  renderShareRows(allMembers);
}

async function deleteSplitterExpenseFromModal() {
  const groupId = document.getElementById("splitterGroupIdInput").value;
  const expenseId = document.getElementById(
    "splitterExpenseIdInput",
  ).value;
  const g = db.splitterGroups.find((item) => String(item.id) === String(groupId));
  if (!g) return;

  const confirmed = await showPageMessage("Esse gasto sai da divisão do rolê.", {
    title: "Apagar gasto?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (confirmed) {
    g.expenses = (g.expenses || []).filter((e) => String(e.id) !== String(expenseId));
    saveDatabase();
    closeTobaModal("newSplitterExpenseModal");
    renderSplitterExpensesAndSettlement(g);
  }
}

function renderSplitterExpensesAndSettlement(g) {
  const listEl = document.getElementById("splitterExpensesList");
  listEl.innerHTML = "";
  const expenses = g.expenses || [];
  const members = g.members || [];

  if (expenses.length === 0) {
    listEl.innerHTML = tobaEmpty("🧾", "Nenhum gasto no rolê", g.isFinished ? "" : "Toque em <b>💸 + Gasto</b> quando alguém pagar algo.", { compact: true });
  } else {
    [...expenses]
      .sort((a, b) => {
        const dateA = new Date(a.date || g.date || "1970-01-01");
        const dateB = new Date(b.date || g.date || "1970-01-01");
        if (dateB - dateA !== 0) return dateB - dateA;
        return parseInt(b.id || 0) - parseInt(a.id || 0);
      })
      .forEach((e) => {
        listEl.insertAdjacentHTML("beforeend", `
          <div class="expense-item" role="button" tabindex="0" data-click="editSplitterExpense" data-id="${escapeHtml(e.id)}">
            <div class="expense-details">
              <span class="expense-desc">${escapeHtml(e.desc)}</span>
              <span class="expense-meta">Pago por <i>${escapeHtml(e.payer)}</i> • ${isoToBrDate(e.date || g.date)}</span>
            </div>
            <span class="expense-amount-value text-neutral">${formatCurrency(e.amount)}</span>
          </div>`);
      });
  }

  const settlementBox = document.getElementById("splitterSettlementBox");
  if (members.length === 0) {
    settlementBox.innerHTML = tobaEmpty("👥", "Rolê sem ninguém?", "Toque no ✏️ e adicione os participantes.", { compact: true });
    return;
  }

  const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);

  // Compara quanto cada pessoa pagou com a parte que consumiu; saldo
  // positivo é crédito e saldo negativo é dívida.
  const paidMap = {};
  const consumedMap = {};
  members.forEach((m) => {
    paidMap[m] = 0;
    consumedMap[m] = 0;
  });

  expenses.forEach((e) => {
    if (paidMap[e.payer] !== undefined) paidMap[e.payer] += e.amount;

    if (e.shares) {
      Object.entries(e.shares).forEach(([m, pct]) => {
        if (consumedMap[m] !== undefined) {
          consumedMap[m] += e.amount * (pct / 100);
        }
      });
    } else if (e.involved) {
      const splitAmount = e.amount / e.involved.length;
      e.involved.forEach((m) => {
        if (consumedMap[m] !== undefined) consumedMap[m] += splitAmount;
      });
    } else {
      const splitAmount = e.amount / members.length;
      members.forEach((m) => {
        if (consumedMap[m] !== undefined) consumedMap[m] += splitAmount;
      });
    }
  });

  const balances = {};
  members.forEach((m) => (balances[m] = paidMap[m] - consumedMap[m]));

  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([m, bal]) => {
    if (bal < -0.01) debtors.push({ name: m, amount: Math.abs(bal) });
    else if (bal > 0.01) creditors.push({ name: m, amount: bal });
  });

  let htmlTxt = `
    <div class="settlement-summary">
      <div class="settlement-title">📊 Quem pagou × quem consumiu</div>
      <div class="kv-list">`;

  members.forEach((m) => {
    if (paidMap[m] > 0 || consumedMap[m] > 0) {
      htmlTxt += `
        <div class="kv-row"><span><b class="text-neutral">${escapeHtml(m)}</b> pagou ${formatCurrency(paidMap[m])}</span><span class="text-muted" style="font-weight: 600">usou ${formatCurrency(consumedMap[m])}</span></div>`;
    }
  });

  htmlTxt += `
        <div class="kv-row is-total"><span>Total do rolê</span><span class="text-blue">${formatCurrency(totalSpent)}</span></div>
      </div>
    </div>`;

  if (debtors.length === 0 && creditors.length === 0) {
    htmlTxt +=
      '<span class="text-green" style="font-weight: 700">Tudo quitado (ou ninguém gastou nada)! 🍻</span>';
  } else {
    htmlTxt += '<div class="settlement-title">🤑 Faz o Pix</div>';
    debtors.forEach((d) => {
      creditors.forEach((c) => {
        if (d.amount > 0.01 && c.amount > 0.01) {
          const transfer = Math.min(d.amount, c.amount);
          htmlTxt += `<div class="pix-row">👉 <b>${escapeHtml(d.name)}</b> paga <b class="text-blue">${formatCurrency(transfer)}</b> para <b>${escapeHtml(c.name)}</b></div>`;
          d.amount -= transfer;
          c.amount -= transfer;
        }
      });
    });
  }
  settlementBox.innerHTML = htmlTxt;
}

function toggleSplitterFinished() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => String(item.id) === String(id));
  if (!g) return;
  g.isFinished = !g.isFinished;
  saveDatabase();
  openSplitterGroupView(g.id);
}

async function deleteSplitterGroup() {
  const confirmed = await showPageMessage("O rolê e todos os gastos dele somem. Sem volta!", {
    title: "Apagar rolê?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (confirmed) {
    const id = document.getElementById("splitterGroupIdInput").value;
    db.splitterGroups = db.splitterGroups.filter(
      (item) => String(item.id) !== String(id),
    );
    saveDatabase();
    switchView("splitter");
  }
}

/* NAVEGAÇÃO ENTRE AS TELAS DO MÓDULO */
function switchView(viewName) {
  document
    .querySelectorAll(".app-view")
    .forEach((view) => view.classList.remove("active"));

  const viewMap = {
    splitter: "viewSplitter",
    splitterDetail: "viewSplitterDetail",
  };
  document.getElementById(viewMap[viewName])?.classList.add("active");
  window.scrollTo(0, 0);

  // "+ Rolê" só faz sentido na lista; no detalhe o "‹" volta para ela.
  document.getElementById("headerAddBtn").hidden = viewName !== "splitter";
  if (viewName === "splitter") {
    tobaSetHeader({ page: "🍕 Raxador" });
    renderSplitterScreen();
  } else if (viewName === "splitterDetail") {
    tobaSetHeader({ page: "🍕 Raxador › Rolê", back: "backToSplitter" });
  }
}

// Redesenha a tela depois de cada gravação no banco.
function onBankDataSaved() {
  if (document.getElementById("viewSplitter")?.classList.contains("active"))
    renderSplitterScreen();
}

function createSplitterGroup() {
  const name = document.getElementById("newSplitterName").value.trim();
  const category = document.getElementById("newSplitterCategory").value;
  const date = document.getElementById("newSplitterDate").value;
  const members = parseSplitterMembers(
    document.getElementById("newSplitterMembers").value,
  );

  if (!name) {
    showPageMessage("Dá um nome pro rolê!", { title: "Quase lá", icon: "✍️" });
    return;
  }
  if (members.length === 0) {
    showPageMessage("Adicione pelo menos 1 participante!", { title: "Rolê de um só?", icon: "🥲" });
    return;
  }

  const newGroup = {
    id: Date.now().toString(),
    name: name,
    category: category,
    date: date,
    members: members,
    expenses: [],
    isFinished: false,
  };

  if (!db.splitterGroups) db.splitterGroups = [];
  db.splitterGroups.push(newGroup);
  saveDatabase();
  closeTobaModal("newSplitterModal");
  openSplitterGroupView(newGroup.id);
}

tobaActions({
  newSplitterGroup: openNewSplitterGroupModal,
  createSplitterGroup,
  openGroup: (el) => openSplitterGroupView(el.dataset.id),
  backToSplitter: () => switchView("splitter"),
  toggleSplitterMetaCard,
  updateSplitterGroupMeta,
  saveSplitterMembers,
  toggleSplitterFinished,
  deleteSplitterGroup,
  newSplitterExpense: () => openSplitterExpenseModal(),
  editSplitterExpense: (el) => openSplitterExpenseModal(el.dataset.id),
  toggleMemberShare: (el) => toggleMemberShare(Number(el.dataset.index)),
  updateShareValue: (el) => updateShareValue(Number(el.dataset.index), el.value),
  saveSplitterExpense,
  deleteSplitterExpenseFromModal,
});

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  switchView("splitter");
});
