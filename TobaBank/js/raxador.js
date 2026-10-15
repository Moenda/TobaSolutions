/* =====================================================================
 * Toba Bank · Raxador (divisão de contas)
 * Depende de bank-core.js
 * ===================================================================== */
let currentShares = {};

function openNewSplitterGroupModal() {
  document.getElementById("newSplitterName").value = "";
  document.getElementById("newSplitterDate").value = getTodayIsoDateStr();
  document.getElementById("newSplitterMembers").value = "";
  document.getElementById("newSplitterModal").classList.add("active");
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
  if (groups.length === 0) {
    activeContainer.innerHTML =
      '<div class="empty-state">Nenhum rolê ou viagem em andamento. Crie um novo grupo acima!</div>';
    finishedContainer.innerHTML =
      '<div class="empty-state">Nenhum rolê finalizado no histórico.</div>';
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

    const card = document.createElement("div");
    card.className = "splitter-card";
    card.onclick = () => openSplitterGroupView(g.id);
    card.innerHTML = `
        <div class="splitter-header" style="padding: 0.8rem;">
            <div class="splitter-header-top" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <span class="splitter-title" style="font-size: 0.9rem; word-break: break-word; max-width: 70%;">${catEmoji} ${g.name}</span>
                <span style="font-size: 0.7rem; color: #8b949e; white-space: nowrap;">${isoToBrDate(g.date)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:0.78rem; flex-wrap: wrap; gap: 4px;">
                <span style="color:#8b949e;">👥 ${membersCount} participantes</span>
                <span>Total: <b style="color:#58a6ff;">${formatCurrency(totalSpent)}</b></span>
            </div>
        </div>
    `;

    if (g.isFinished) {
      finishedContainer.appendChild(card);
      hasFinished = true;
    } else {
      activeContainer.appendChild(card);
      hasActive = true;
    }
  });

  if (!hasActive)
    activeContainer.innerHTML =
      '<div class="empty-state">Nenhum rolê ativo no momento.</div>';
  if (!hasFinished)
    finishedContainer.innerHTML =
      '<div class="empty-state">Nenhum rolê finalizado.</div>';
}

function openSplitterGroupView(groupId) {
  const g = db.splitterGroups.find((item) => item.id === groupId);
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
  if (metaCard) metaCard.style.display = "none";

  const finishBtn = document.getElementById(
    "splitterToggleFinishBtnView",
  );
  const editingFields = document.querySelectorAll(".splitter-edit-field");
  const openExpenseBtn = document.getElementById(
    "openAddSplitterExpenseBtn",
  );

  if (g.isFinished) {
    finishBtn.innerText = "🔄 Reabrir";
    finishBtn.style.borderColor = "#58a6ff";
    finishBtn.style.color = "#58a6ff";
    openExpenseBtn.style.display = "none";
    editingFields.forEach((f) => (f.style.display = "none"));
  } else {
    finishBtn.innerText = "🏁 Finalizar";
    finishBtn.style.borderColor = "#3fb950";
    finishBtn.style.color = "#3fb950";
    openExpenseBtn.style.display = "inline-block";
    editingFields.forEach((f) => (f.style.display = "block"));
  }

  renderSplitterExpensesAndSettlement(g);
  switchView("splitterDetail");
}

function toggleSplitterMetaCard() {
  const card = document.getElementById("splitterMetaCard");
  if (card) {
    const isHidden = card.style.display === "none" || !card.style.display;
    card.style.display = isHidden ? "block" : "none";
  }
}

function updateSplitterGroupMeta() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => item.id === id);
  if (!g) return;
  g.name = document.getElementById("editSplitterName").value;
  g.category = document.getElementById("editSplitterCategory").value;
  g.date = document.getElementById("editSplitterDate").value;
  document.getElementById("detailSplitterTitle").innerText =
    `${g.category ? g.category.split(" ")[0] : "🍕"} ${g.name}`;
  saveDatabase();
}

function saveSplitterMembers() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => item.id === id);
  if (!g) return;
  const rawMembers = document.getElementById(
    "splitterMembersInput",
  ).value;
  g.members = rawMembers
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  saveDatabase();
  renderSplitterExpensesAndSettlement(g);
}

function openSplitterExpenseModal(expenseId = null) {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => item.id === id);
  if (!g) return;

  const payerSelect = document.getElementById("splitterExpensePayer");
  payerSelect.innerHTML = "";
  (g.members || []).forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m;
    payerSelect.appendChild(opt);
  });

  const title = document.getElementById("splitterExpenseModalTitle");
  const idInput = document.getElementById("splitterExpenseIdInput");
  const descInput = document.getElementById("splitterExpenseDesc");
  const amountInput = document.getElementById("splitterExpenseAmount");
  const dateInput = document.getElementById("splitterExpenseDate");
  const deleteBtn = document.getElementById("deleteSplitterExpenseBtn");

  currentShares = {};

  if (expenseId) {
    const exp = g.expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    title.innerText = "✏️ Editar Gasto no Rolê";
    idInput.value = exp.id;
    descInput.value = exp.desc;
    amountInput.value = formatMoneyInput(exp.amount);
    payerSelect.value = exp.payer;
    dateInput.value = exp.date || g.date || getTodayIsoDateStr();
    deleteBtn.style.display = "inline-block";

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
      const equalPct = 100 / g.members.length;
      (g.members || []).forEach((m) => {
        currentShares[m] = equalPct;
      });
    }
  } else {
    title.innerText = "💸 Adicionar Gasto no Rolê";
    idInput.value = "";
    descInput.value = "";
    amountInput.value = "";
    dateInput.value = g.date || getTodayIsoDateStr();
    deleteBtn.style.display = "none";

    const equalPct = g.members.length > 0 ? 100 / g.members.length : 0;
    (g.members || []).forEach((m) => {
      currentShares[m] = equalPct;
    });
  }

  renderShareRows(g.members || []);
  document
    .getElementById("newSplitterExpenseModal")
    .classList.add("active");
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
    titleEl.innerHTML = `⚖️ Divisão por Participante (<b style="color:${isExact ? "#3fb950" : "#f85149"}">${totalPct.toFixed(1)}%</b>)`;
  }

  allMembers.forEach((m) => {
    const pct = currentShares[m] !== undefined ? currentShares[m] : 0;
    const isChecked = pct > 0;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.background = "#0d1117";
    row.style.padding = "6px 10px";
    row.style.borderRadius = "8px";
    row.style.border = "1px solid #21262d";

    row.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; flex:1;">
                    <input type="checkbox" id="chk-member-${m}" ${isChecked ? "checked" : ""} onchange="toggleMemberShare('${m}')">
                    <span style="color:${isChecked ? "#f0f6fc" : "#8b949e"}">${m}</span>
                </label>
                <div style="display:flex; align-items:center; gap:4px; width:90px;">
                    <input type="number" step="0.1" min="0" max="100" class="form-control" style="padding:4px; font-size:0.8rem; text-align:right;" value="${pct.toFixed(1)}" onchange="updateShareValue('${m}', this.value)">
                    <span style="font-size:0.75rem; color:#8b949e;">%</span>
                </div>
            `;
    container.appendChild(row);
  });
}

function updateShareValue(member, val) {
  const num = parseFloat(val) || 0;
  currentShares[member] = Math.max(0, Math.min(100, num));
  const allMembers = Object.keys(currentShares);
  renderShareRows(allMembers);
}

function saveSplitterExpense() {
  const id = document.getElementById("splitterGroupIdInput").value;
  const g = db.splitterGroups.find((item) => item.id === id);
  if (!g) return;

  const expenseId = document.getElementById(
    "splitterExpenseIdInput",
  ).value;
  const desc = document.getElementById("splitterExpenseDesc").value;
  const amount = getMoney("splitterExpenseAmount");
  const payer = document.getElementById("splitterExpensePayer").value;
  const date = document.getElementById("splitterExpenseDate").value;

  if (!desc || amount <= 0 || !payer) {
    return alert("Preencha a descrição, valor e quem pagou!");
  }

  const totalPct = Object.values(currentShares).reduce(
    (a, b) => a + b,
    0,
  );
  if (Math.abs(totalPct - 100) > 0.5) {
    return alert(
      `A soma das fatias percentuais deve ser exatamente 100%! Atualmente está em ${totalPct.toFixed(1)}%`,
    );
  }

  if (expenseId) {
    const index = g.expenses.findIndex((e) => e.id === expenseId);
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
  document
    .getElementById("newSplitterExpenseModal")
    .classList.remove("active");
  renderSplitterExpensesAndSettlement(g);
}

function toggleMemberShare(member) {
  const allMembers = Object.keys(currentShares);
  const isCheckedNow = document.getElementById(
    `chk-member-${member}`,
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

function deleteSplitterExpenseFromModal() {
  const groupId = document.getElementById("splitterGroupIdInput").value;
  const expenseId = document.getElementById(
    "splitterExpenseIdInput",
  ).value;
  const g = db.splitterGroups.find((item) => item.id === groupId);
  if (!g) return;

  if (confirm("Deseja mesmo apagar esse gasto do rolê?")) {
    g.expenses = (g.expenses || []).filter((e) => e.id !== expenseId);
    saveDatabase();
    document
      .getElementById("newSplitterExpenseModal")
      .classList.remove("active");
    renderSplitterExpensesAndSettlement(g);
  }
}

function renderSplitterExpensesAndSettlement(g) {
  const listEl = document.getElementById("splitterExpensesList");
  listEl.innerHTML = "";
  const expenses = g.expenses || [];
  const members = g.members || [];

  if (expenses.length === 0) {
    listEl.innerHTML =
      '<div class="empty-state" style="font-size:0.75rem;">Nenhum gasto lançado ainda.</div>';
  } else {
    [...expenses]
      .sort((a, b) => {
        const dateA = new Date(a.date || g.date || "1970-01-01");
        const dateB = new Date(b.date || g.date || "1970-01-01");
        if (dateB - dateA !== 0) return dateB - dateA;
        return parseInt(b.id || 0) - parseInt(a.id || 0);
      })
      .forEach((e) => {
        const item = document.createElement("div");
        item.className = "expense-item";
        item.style.cursor = "pointer";
        item.onclick = () => openSplitterExpenseModal(e.id);
        item.innerHTML = `
                    <div class="expense-details">
                        <span class="expense-desc">${e.desc}</span>
                        <span class="expense-meta">Pago por: <i>${e.payer}</i> • ${isoToBrDate(e.date || g.date)}</span>
                    </div>
                    <div class="expense-right">
                        <span class="expense-amount-value" style="font-size: 0.85rem;">${formatCurrency(e.amount)}</span>
                    </div>
                `;
        listEl.appendChild(item);
      });
  }

  const settlementBox = document.getElementById("splitterSettlementBox");
  if (members.length === 0) {
    settlementBox.innerHTML =
      "Adicione participantes para calcular a divisão.";
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
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #30363d;">
                <div style="font-size: 0.9rem; color: #58a6ff; font-weight: 700; margin-bottom: 8px;">📊 Resumo Individual</div>`;

  members.forEach((m) => {
    if (paidMap[m] > 0 || consumedMap[m] > 0) {
      htmlTxt += `
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:4px;">
                    <span><b>${m}</b> pagou ${formatCurrency(paidMap[m])}</span>
                    <span style="color:#8b949e;">Consumiu: ${formatCurrency(consumedMap[m])}</span>
                </div>`;
    }
  });

  htmlTxt += `
                <div style="margin-top: 10px; font-size: 0.9rem;"><b>Total do Rolê:</b> <span style="color:#58a6ff;">${formatCurrency(totalSpent)}</span></div>
            </div>`;

  if (debtors.length === 0 && creditors.length === 0) {
    htmlTxt +=
      '<span style="color:#3fb950; font-weight:600;">Tudo quitado ou sem gastos! 🍻</span>';
  } else {
    htmlTxt += "<b>🤑 Faz o Pix:</b><br>";
    debtors.forEach((d) => {
      creditors.forEach((c) => {
        if (d.amount > 0.01 && c.amount > 0.01) {
          const transfer = Math.min(d.amount, c.amount);
          htmlTxt += `<div style="margin-top: 4px; padding: 6px; background: rgba(88, 166, 255, 0.1); border-radius: 6px;">👉 <b>${d.name}</b> paga <span style="color:#58a6ff; font-weight:700;">${formatCurrency(transfer)}</span> para <b>${c.name}</b></div>`;
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
  const g = db.splitterGroups.find((item) => item.id === id);
  if (!g) return;
  g.isFinished = !g.isFinished;
  saveDatabase();
  openSplitterGroupView(g.id);
}

function deleteSplitterGroup() {
  if (
    confirm(
      "Tem certeza que deseja apagar este grupo de gastos por completo?",
    )
  ) {
    const id = document.getElementById("splitterGroupIdInput").value;
    db.splitterGroups = db.splitterGroups.filter(
      (item) => item.id !== id,
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

  const actionsContainer = document.getElementById("headerActionsContainer");
  if (viewName === "splitter") {
    actionsContainer.innerHTML = `
      <button class="config-btn" onclick="openDataModal()" title="Dados & Backup">⚙️</button>
      <a class="back-nav-btn" href="TobaBank-Index.html" style="text-decoration: none;">Hub ›</a>
    `;
    renderSplitterScreen();
  } else if (viewName === "splitterDetail") {
    actionsContainer.innerHTML = `
      <button class="back-nav-btn" onclick="switchView('splitter')"><span style="color: #8b949e; font-weight: 900; font-size: 1.1rem; line-height: 1; margin-right: 4px;">‹</span> Raxador</button>
    `;
  }
}

// Redesenha a tela depois de cada gravação no banco.
function onBankDataSaved() {
  if (document.getElementById("viewSplitter")?.classList.contains("active"))
    renderSplitterScreen();
}

function setupRaxadorEvents() {
  const newSplitterForm = document.getElementById("newSplitterForm");
  if (newSplitterForm) {
    newSplitterForm.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById("newSplitterName").value;
      const category = document.getElementById(
        "newSplitterCategory",
      ).value;
      const date = document.getElementById("newSplitterDate").value;
      const rawMembers =
        document.getElementById("newSplitterMembers").value;
      const members = rawMembers
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      if (members.length === 0)
        return alert("Adicione pelo menos 1 participante!");

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
      document
        .getElementById("newSplitterModal")
        .classList.remove("active");
      openSplitterGroupView(newGroup.id);
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  setupCoreEvents();
  setupRaxadorEvents();
  switchView("splitter");
});
