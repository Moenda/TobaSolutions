/* =====================================================================
 * Toba Bank · Controle de Gastos
 * Depende de bank-core.js
 * ===================================================================== */
/* As contas do mês ficam em bank-metrics.js (mesmo cálculo do card do portal). */
function getEffectiveDaysInMonth(year, monthIndex) {
  return calcBankEffectiveDays(db, year, monthIndex);
}

function getFixedExpensesForMonth(mKey) {
  const currentMonthKey = getCurrentMonthKey();
  if (!db.months[mKey]) db.months[mKey] = {};

  if (mKey === currentMonthKey) {
    db.months[mKey].fixedExpensesSnapshot = JSON.parse(
      JSON.stringify(db.config.fixedExpenses || []),
    );
    return db.config.fixedExpenses || [];
  } else {
    if (db.months[mKey].fixedExpensesSnapshot) {
      return db.months[mKey].fixedExpensesSnapshot;
    } else {
      const fallback = JSON.parse(
        JSON.stringify(db.config.fixedExpenses || []),
      );
      db.months[mKey].fixedExpensesSnapshot = fallback;
      return fallback;
    }
  }
}

function getFixedTotalForMonth(mKey) {
  return getFixedExpensesForMonth(mKey).reduce(
    (acc, item) => acc + item.amount,
    0,
  );
}

function getActiveInstallmentsForMonth(monthKey) {
  return calcBankActiveInstallments(db, monthKey);
}

function switchTab(tabName) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));

  if (tabName === "current") {
    document.getElementById("tabBtnCurrent")?.classList.add("active");
    document.getElementById("tabCurrent")?.classList.add("active");
    renderDashboard();
  } else if (tabName === "installments") {
    document
      .getElementById("tabBtnInstallments")
      ?.classList.add("active");
    document.getElementById("tabInstallments")?.classList.add("active");
    renderInstallments();
  } else if (tabName === "fixed") {
    document.getElementById("tabBtnFixed")?.classList.add("active");
    document.getElementById("tabFixed")?.classList.add("active");
    renderFixedExpenses();
  } else if (tabName === "history") {
    document.getElementById("tabHistory")?.classList.add("active");
    renderHistory();
  }
}

function renderDashboard() {
  const now = new Date();
  const currentMonthKey = getCurrentMonthKey();
  const monthFormatted = formatMonthYearLabel(
    now.getFullYear(),
    now.getMonth(),
  );

  // Mantém o snapshot dos gastos fixos do mês (usado pelo histórico).
  getFixedExpensesForMonth(currentMonthKey);

  // Mesmo cálculo do card do Toba Bank no portal (bank-metrics.js).
  const summary = calcBankMonthSummary(db, now);
  const {
    monthlySpentVista, monthInstallmentsTotal, fixedTotal, grossMonthlyBudget,
    diasPassados, diasRestantes, mediaDiariaVista, mediaDiariaTotal,
    dailyFixedDeduction, dailyInstallmentDeduction,
    projecaoRestanteVista, projecaoTotalMes, sobraPrevista,
    totalMonthlySpent, vaultBalance, todayAvailable,
  } = summary;
  const currentMonthTransactions = summary.monthTransactions;
  const activeInstallmentsMonth = summary.activeInstallments;

  window.dadosSobra = {
    monthlySpentVista, monthInstallmentsTotal, fixedTotal, grossMonthlyBudget,
    diasPassados, diasRestantes, mediaDiariaVista, mediaDiariaTotal,
    dailyFixedDeduction, dailyInstallmentDeduction,
    projecaoRestanteVista, projecaoTotalMes, sobraPrevista
  };

  document.getElementById("dashMonthBadge").innerText = monthFormatted;

  // ==============================================
  // INJEÇÃO DE DADOS NO CARD REI (HERO CARD)
  // ==============================================

  // 1. Sobra Prevista Hero (Topo)
  const sobraHeroEl = document.getElementById("dashSobraHero");
  sobraHeroEl.innerText = formatCurrency(sobraPrevista);
  sobraHeroEl.style.color = sobraPrevista >= 0 ? '#3fb950' : '#f85149';

  // Efeito Glow Neon no fundo
  document.getElementById("heroGlow").style.background = sobraPrevista >= 0 ? 'rgba(63, 185, 80, 0.12)' : 'rgba(248, 81, 73, 0.12)';

  // Subtexto da Sobra e Dias Restantes no Topo
  document.getElementById("dashSobraSubHero").innerText = `Média Gasto Diário: ${formatCurrency(mediaDiariaTotal)}`;
  document.getElementById("dashHeaderRestantes").innerText = `Restam: ${diasRestantes} dias`;

  // 2. Barra de Progresso (Orçamento Total)
  document.getElementById("dashVarSpentHero").innerText = formatCurrency(totalMonthlySpent);
  document.getElementById("dashLimitHero").innerText = `Orçamento: ${formatCurrency(grossMonthlyBudget)}`;

  const percentGasto = grossMonthlyBudget > 0 ? (totalMonthlySpent / grossMonthlyBudget) * 100 : 0;
  const barraEl = document.getElementById("heroProgressBar");
  barraEl.style.width = `${Math.min(percentGasto, 100)}%`;

  // Semáforo da Barra (Verde < 65% < Laranja < 85% < Vermelho)
  if (percentGasto < 65) {
    barraEl.style.background = '#3fb950';
  } else if (percentGasto < 85) {
    barraEl.style.background = '#d29922'; // Laranja alerta
  } else {
    barraEl.style.background = '#f85149'; // Sangrando
  }

  // 3. Pílulas Inferiores
  const availableHeroEl = document.getElementById("dashAvailableHero");
  if (availableHeroEl) {
    availableHeroEl.innerText = formatCurrency(todayAvailable);
    availableHeroEl.style.color = todayAvailable >= 0 ? '#f0f6fc' : '#f85149';
  }

  // Facada Diária com números em vermelho e rótulos brancos em PT-BR
  const dailyInstEl = document.getElementById("dashDailyInstHero");
  if (dailyInstEl) {
    dailyInstEl.innerText = `-${formatCurrency(dailyInstallmentDeduction)}/dia`;
  }

  const dailyFixedEl = document.getElementById("dashDailyFixedHero");
  if (dailyFixedEl) {
    dailyFixedEl.innerText = `-${formatCurrency(dailyFixedDeduction)}/dia`;
  }

  const vaultHeroEl = document.getElementById("dashVaultHero");
  if (vaultHeroEl) {
    vaultHeroEl.innerText = formatCurrency(vaultBalance);
    vaultHeroEl.style.color = vaultBalance >= 0 ? '#3fb950' : '#f85149';
  }

  // RENDERIZAÇÃO OBRIGATÓRIA DAS SANFONAS E HISTÓRICOS ABAIXO
  renderCategoryBars(currentMonthTransactions, monthlySpentVista, "categoryBarsContainer");
  renderExpenseListWithInstallments(currentMonthTransactions, activeInstallmentsMonth);
}

function renderCategoryBars(
  transactions,
  totalSpent,
  containerId = "categoryBarsContainer",
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  if (!transactions || transactions.length === 0 || totalSpent <= 0) {
    container.innerHTML =
      '<div class="empty-state">Nenhum gasto lançado para exibir categorias.</div>';
    return;
  }

  const catMap = {};
  transactions.forEach((t) => {
    let cleanCat = getCleanCategory(t.category);
    catMap[cleanCat] = (catMap[cleanCat] || 0) + t.amount;
  });

  Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, amount]) => {
      const percentage = Math.min(
        Math.round((amount / totalSpent) * 100),
        100,
      );
      const itemEl = document.createElement("div");
      itemEl.className = "category-item";
      itemEl.innerHTML = `
                <div class="category-info">
                    <span>${escapeBankHtml(category)}</span>
                    <span>${formatCurrency(amount)} (${percentage}%)</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
                </div>
            `;
      container.appendChild(itemEl);
    });
}

function renderExpenseListWithInstallments(
  transactions,
  activeInstallments,
) {
  const transContainer = document.getElementById("expenseListContainer");
  const instContainer = document.getElementById(
    "homeInstallmentsListContainer",
  );

  if (transContainer) {
    transContainer.innerHTML = "";
    if (transactions.length === 0) {
      transContainer.innerHTML =
        '<div class="empty-state">Nenhum lançamento à vista neste mês.</div>';
    } else {
      const sortedTransactions = [...transactions].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );
      sortedTransactions.forEach((t) => {
        let cleanCat = getCleanCategory(t.category);
        const itemEl = document.createElement("div");
        itemEl.className = "expense-item";
        itemEl.onclick = () => openExpenseModal(t.id);
        itemEl.innerHTML = `
                        <div class="expense-details">
                            <span class="expense-desc">${escapeBankHtml(t.description)}</span>
                            <span class="expense-meta">${escapeBankHtml(cleanCat)} • ${isoToBrDate(t.date)}</span>
                        </div>
                        <div class="expense-right">
                            <div class="expense-amount">
                                <span class="expense-amount-value">-${formatCurrency(t.amount)}</span>
                            </div>
                        </div>
                    `;
        transContainer.appendChild(itemEl);
      });
    }
  }

  if (instContainer) {
    instContainer.innerHTML = "";
    if (activeInstallments.length === 0) {
      instContainer.innerHTML =
        '<div class="empty-state">Nenhuma parcela ativa neste mês.</div>';
    } else {
      activeInstallments.forEach((p) => {
        let cleanCat = getCleanCategory(p.category);
        const itemEl = document.createElement("div");
        itemEl.className = "expense-item";
        itemEl.style.borderLeft = "3px solid #d29922";
        itemEl.onclick = () => openEditInstallmentModal(p.id);
        itemEl.innerHTML = `
                        <div class="expense-details">
                            <span class="expense-desc">${escapeBankHtml(p.description)}</span>
                            <span class="expense-meta">${escapeBankHtml(cleanCat)} • Parcela ${p.currentParcel}/${p.totalInstallments}</span>
                        </div>
                        <div class="expense-right">
                            <div class="expense-amount">
                                <span class="expense-amount-value" style="color: #d29922;">-${formatCurrency(p.amount)}</span>
                            </div>
                        </div>
                    `;
        instContainer.appendChild(itemEl);
      });
    }
  }
}

function renderInstallments() {
  const activeContainer = document.getElementById(
    "installmentsContainer",
  );
  const finishedContainer = document.getElementById(
    "finishedInstallmentsContainer",
  );
  if (!activeContainer || !finishedContainer) return;

  activeContainer.innerHTML = "";
  finishedContainer.innerHTML = "";

  const currentMonthKey = getCurrentMonthKey();
  const activeInstallmentsMonth =
    getActiveInstallmentsForMonth(currentMonthKey);
  const instMonthlyTotal = activeInstallmentsMonth.reduce(
    (acc, p) => acc + p.amount,
    0,
  );
  const totalDaysInMonth = getDaysInMonth(
    new Date().getFullYear(),
    new Date().getMonth(),
  );
  const dailyDeduction =
    totalDaysInMonth > 0 ? instMonthlyTotal / totalDaysInMonth : 0;

  let totalFutureRemaining = 0;
  let endingThisMonthCount = 0;
  const activeList = [],
    finishedList = [];

  (db.installments || []).forEach((inst) => {
    const [sYear, sMonth] = inst.startDate.split("-").map(Number);
    const [cYear, cMonth] = currentMonthKey.split("-").map(Number);
    const monthDiff = (cYear - sYear) * 12 + (cMonth - sMonth);

    if (monthDiff < inst.totalInstallments) {
      activeList.push(inst);
      const remainingParcels = Math.max(
        inst.totalInstallments - Math.max(monthDiff, 0),
        0,
      );
      const parcelAmount = inst.totalAmount / inst.totalInstallments;
      totalFutureRemaining += remainingParcels * parcelAmount;

      if (monthDiff === inst.totalInstallments - 1)
        endingThisMonthCount++;
    } else {
      finishedList.push(inst);
    }
  });

  document.getElementById("instMonthlyTotal").innerText =
    formatCurrency(instMonthlyTotal);
  document.getElementById("instDailyDeductionSub").innerText =
    `Impacto diário:\n-${formatCurrency(dailyDeduction)}/dia`;
  document.getElementById("instTotalRemaining").innerText =
    formatCurrency(totalFutureRemaining);
  document.getElementById("instActiveCountSub").innerText =
    `${activeList.length} compras no total\n${endingThisMonthCount} terminam este mês`;

  if (activeList.length === 0) {
    activeContainer.innerHTML =
      '<div class="empty-state">Nenhuma compra parcelada ativa no momento!</div>';
  } else {
    activeList.forEach((inst) => {
      const [sYear, sMonth] = inst.startDate.split("-").map(Number);
      const [cYear, cMonth] = currentMonthKey.split("-").map(Number);
      const monthDiff = (cYear - sYear) * 12 + (cMonth - sMonth);
      const currentParcelNum = Math.min(
        Math.max(monthDiff + 1, 1),
        inst.totalInstallments,
      );
      const progressPct = Math.min(
        Math.round((currentParcelNum / inst.totalInstallments) * 100),
        100,
      );

      const card = document.createElement("div");
      card.className = "installment-card";
      card.id = `instCard-${inst.id}`;
      card.onclick = () => openEditInstallmentModal(inst.id);
      card.innerHTML = `
                    <div class="installment-header">
                        <div class="installment-header-top">
                            <span class="installment-title">${escapeBankHtml(inst.description)}</span>
                        </div>
                        <div class="category-info" style="margin-top: 6px;">
                            <span>Progresso: Parcela ${currentParcelNum} de ${inst.totalInstallments}</span>
                            <span style="font-weight:700; color:#58a6ff;">${progressPct}%</span>
                        </div>
                        <div class="progress-bar-bg" style="margin-top: 4px;">
                            <div class="progress-bar-fill" style="width: ${progressPct}%; background: #3fb950;"></div>
                        </div>
                        <div class="installment-metrics">
                            <div class="installment-metric-box">
                                <span class="installment-metric-label">Parcela do Mês</span>
                                <span class="installment-metric-val text-red">-${formatCurrency(inst.totalAmount / inst.totalInstallments)}</span>
                            </div>
                            <div class="installment-metric-box">
                                <span class="installment-metric-label">Valor Total</span>
                                <span class="installment-metric-val text-neutral">${formatCurrency(inst.totalAmount)}</span>
                            </div>
                        </div>
                    </div>
                `;
      activeContainer.appendChild(card);
    });
  }

  if (finishedList.length === 0) {
    finishedContainer.innerHTML =
      '<div class="empty-state">Nenhum parcelamento quitado ainda.</div>';
  } else {
    finishedList.forEach((inst) => {
      const card = document.createElement("div");
      card.className = "installment-card";
      card.id = `instCard-${inst.id}`;
      card.onclick = () => openEditInstallmentModal(inst.id);
      card.style.opacity = "0.75";
      card.innerHTML = `
                    <div class="installment-header">
                        <div class="installment-header-top">
                            <span class="installment-title" style="color: #8b949e;">✅ ${escapeBankHtml(inst.description)} (Quitado)</span>
                        </div>
                        <div style="font-size: 0.78rem; color: #8b949e; margin-top: 4px;">
                            Total pago: <b style="color: #f0f6fc;">${formatCurrency(inst.totalAmount)}</b> em <b>${inst.totalInstallments}x</b>
                        </div>
                    </div>
                `;
      finishedContainer.appendChild(card);
    });
  }
}

function toggleInstallmentCard(instId) {
  const card = document.getElementById(`instCard-${instId}`);
  if (card) card.classList.toggle("expanded");
}

function openExpenseModal(id = null, presetDateIso = null) {
  const modal = document.getElementById("expenseModal");
  const title = document.getElementById("expenseModalTitle");
  const idInput = document.getElementById("expenseIdInput");
  const descInput = document.getElementById("expenseDescInput");
  const amountInput = document.getElementById("expenseAmountInput");
  const catSelect = document.getElementById("expenseCategorySelect");
  const dateInput = document.getElementById("expenseDateInput");
  const isInstCheckbox = document.getElementById("isInstallmentCheckbox");
  const instGroupEl = document.getElementById("installmentCheckboxGroup");
  const deleteBtn = document.getElementById("deleteExpenseModalBtn");

  if (id) {
    const item = db.transactions.find((t) => String(t.id) === String(id));
    if (!item) return;
    title.innerText = "✏️ Editar Gasto";
    idInput.value = item.id;
    descInput.value = item.description;
    amountInput.value = formatMoneyInput(item.amount);
    catSelect.value = item.category;
    dateInput.value = item.date;
    instGroupEl.style.display = "none";
    isInstCheckbox.checked = false;
    if (deleteBtn) deleteBtn.style.display = "block";
  } else {
    title.innerText = "➕ Novo Gasto";
    idInput.value = "";
    descInput.value = "";
    amountInput.value = "";
    catSelect.value = "Alimentação";
    dateInput.value = presetDateIso || getTodayIsoDateStr();
    instGroupEl.style.display = "block";
    isInstCheckbox.checked = false;
    if (deleteBtn) deleteBtn.style.display = "none";
  }

  toggleInstallmentFields();
  modal.classList.add("active");
  setTimeout(() => descInput.focus(), 100);
}

function deleteExpenseFromModal() {
  const id = document.getElementById("expenseIdInput").value;
  if (id && confirm("Deseja realmente apagar esta despesa?")) {
    db.transactions = db.transactions.filter(
      (t) => String(t.id) !== String(id),
    );
    saveDatabase();
    document.getElementById("expenseModal").classList.remove("active");
  }
}

function toggleHomeAcc(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle("expanded");
}

function saveExpense() {
  const id = document.getElementById("expenseIdInput").value;
  const desc = document.getElementById("expenseDescInput").value;
  const rawAmount = getMoney("expenseAmountInput");
  const category = document.getElementById("expenseCategorySelect").value;
  const startDate = document.getElementById("expenseDateInput").value;
  const isInstallment = document.getElementById(
    "isInstallmentCheckbox",
  ).checked;

  if (!desc || rawAmount <= 0 || !startDate) return;

  if (isInstallment && !id) {
    const totalInstallments =
      parseInt(
        document.getElementById("installmentCountInput").value,
        10,
      ) || 2;
    db.installments.push({
      id: Date.now().toString(),
      description: desc,
      totalAmount: rawAmount,
      totalInstallments: totalInstallments,
      startDate: startDate,
      category: category,
    });
  } else {
    if (id) {
      const index = db.transactions.findIndex(
        (t) => String(t.id) === String(id),
      );
      if (index !== -1) {
        db.transactions[index] = {
          id,
          description: desc,
          amount: rawAmount,
          category,
          date: startDate,
        };
      }
    } else {
      db.transactions.push({
        id: Date.now().toString(),
        description: desc,
        amount: rawAmount,
        category,
        date: startDate,
      });
    }
  }

  saveDatabase();
  document.getElementById("expenseModal").classList.remove("active");
}

function deleteExpense(id) {
  if (confirm("Deseja realmente apagar este gasto?")) {
    db.transactions = db.transactions.filter(
      (t) => String(t.id) !== String(id),
    );
    saveDatabase();
  }
}

function openEditInstallmentModal(instId) {
  const inst = db.installments.find(
    (i) => String(i.id) === String(instId),
  );
  if (!inst) return;
  document.getElementById("editInstId").value = inst.id;
  document.getElementById("editInstDesc").value = inst.description;
  document.getElementById("editInstTotalAmount").value = formatMoneyInput(
    inst.totalAmount,
  );
  document.getElementById("editInstCount").value = inst.totalInstallments;
  document.getElementById("editInstStartDate").value = inst.startDate;
  document.getElementById("editInstallmentModal").classList.add("active");
}

function saveEditedInstallment() {
  const id = document.getElementById("editInstId").value;
  const inst = db.installments.find((i) => String(i.id) === String(id));
  if (inst) {
    const totalAmount = getMoney("editInstTotalAmount");
    const totalCount =
      parseInt(document.getElementById("editInstCount").value, 10) || 1;
    inst.description = document.getElementById("editInstDesc").value;
    inst.totalAmount = totalAmount;
    inst.totalInstallments = totalCount;
    inst.startDate = document.getElementById("editInstStartDate").value;
    saveDatabase();
    document
      .getElementById("editInstallmentModal")
      .classList.remove("active");
  }
}

function deleteInstallmentGroup(instId) {
  if (confirm("Deseja realmente apagar esta compra parcelada inteira?")) {
    db.installments = db.installments.filter(
      (i) => String(i.id) !== String(instId),
    );
    saveDatabase();
  }
}

function deleteInstallmentFromEditModal() {
  const id = document.getElementById("editInstId").value;
  if (
    id &&
    confirm("Deseja realmente apagar esta compra parcelada inteira?")
  ) {
    db.installments = db.installments.filter(
      (i) => String(i.id) !== String(id),
    );
    saveDatabase();
    document
      .getElementById("editInstallmentModal")
      .classList.remove("active");
  }
}

function renderFixedExpenses() {
  const listContainer = document.getElementById("fixedExpensesList");
  const totalDisplay = document.getElementById("fixedTotalDisplay");
  if (!listContainer || !totalDisplay) return;

  listContainer.innerHTML = "";
  const expenses = db.config.fixedExpenses || [];
  const total = expenses.reduce((acc, item) => acc + item.amount, 0);
  totalDisplay.innerText = formatCurrency(total);

  if (expenses.length === 0) {
    listContainer.innerHTML =
      '<div class="empty-state">Nenhum gasto fixo cadastrado ainda.</div>';
    return;
  }

  const now = new Date();
  const totalDaysInMonth = getDaysInMonth(
    now.getFullYear(),
    now.getMonth(),
  );

  expenses.forEach((item) => {
    let cleanCat = getCleanCategory(item.category);
    const dailyItemRate =
      totalDaysInMonth > 0 ? item.amount / totalDaysInMonth : 0;

    const el = document.createElement("div");
    el.className = "fixed-card";
    el.id = `fixedCard-${item.id}`;
    el.innerHTML = `
                <div class="fixed-header" onclick="toggleFixedCard('${item.id}')">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; font-size: 0.88rem; color: #f0f6fc;">🔄 ${escapeBankHtml(item.name)}</span>
                        <span style="font-size: 0.73rem; color: #8b949e; margin-top: 2px;">${escapeBankHtml(cleanCat)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="font-weight: 700; color: #f85149; font-size: 0.88rem;">-${formatCurrency(item.amount)}</span>
                            <span style="font-size: 0.68rem; color: #58a6ff; margin-top: 2px;">-${formatCurrency(dailyItemRate)}/dia</span>
                        </div>
                        <span class="fixed-arrow">▼</span>
                    </div>
                </div>
                <div class="fixed-body">
                    <div style="display: flex; gap: 8px; margin-top: 4px;">
                        <button class="btn" style="flex: 1; background: #d29922; color: #fff; font-size: 0.78rem; padding: 0.5rem;" onclick="editFixedExpense('${item.id}')">✏️ Editar</button>
                        <button class="btn btn-danger" style="flex: 1; font-size: 0.78rem; padding: 0.5rem;" onclick="deleteFixedExpense('${item.id}')">🗑️ Apagar</button>
                    </div>
                </div>
            `;
    listContainer.appendChild(el);
  });
}

function editFixedExpense(id) {
  event?.stopPropagation();
  const expenses = db.config.fixedExpenses || [];
  const item = expenses.find((e) => String(e.id) === String(id));
  if (!item) return;

  const newName = prompt("Editar nome do gasto fixo:", item.name);
  if (newName === null) return;
  const newAmountStr = prompt(
    "Editar valor (R$):",
    formatMoneyInput(item.amount),
  );
  if (newAmountStr === null) return;

  const parsedAmount =
    parseFloat(newAmountStr.replace(/\./g, "").replace(",", ".")) || 0;
  if (newName.trim() && parsedAmount > 0) {
    item.name = newName.trim();
    item.amount = parsedAmount;
    saveDatabase();
    renderFixedExpenses();
  } else {
    alert("Nome ou valor inválido!");
  }
}

function toggleFixedCard(id) {
  const card = document.getElementById(`fixedCard-${id}`);
  if (card) card.classList.toggle("expanded");
}

function addFixedExpense() {
  const name = document.getElementById("fixedNameInput").value;
  const amount = getMoney("fixedAmountInput");
  const category = document.getElementById("fixedCategorySelect").value;

  if (!name || amount <= 0)
    return alert("Informe o nome e um valor válido!");

  if (!db.config.fixedExpenses) db.config.fixedExpenses = [];
  db.config.fixedExpenses.push({
    id: Date.now().toString(),
    name,
    amount,
    category,
  });

  document.getElementById("fixedNameInput").value = "";
  document.getElementById("fixedAmountInput").value = "";
  saveDatabase();
}

function deleteFixedExpense(id) {
  if (confirm("Deseja excluir este gasto fixo?")) {
    db.config.fixedExpenses = (db.config.fixedExpenses || []).filter(
      (item) => String(item.id) !== String(id),
    );
    saveDatabase();
  }
}

function renderHistory() {
  const container = document.getElementById("historyContainer");
  if (!container) return;
  container.innerHTML = "";
  const currentMonthKey = getCurrentMonthKey();
  const monthKeysSet = new Set();

  db.transactions.forEach((t) => {
    if (t.date) monthKeysSet.add(t.date.slice(0, 7));
  });
  Object.keys(db.months).forEach((mKey) => monthKeysSet.add(mKey));

  const pastMonthKeys = Array.from(monthKeysSet)
    .filter((mKey) => mKey !== currentMonthKey)
    .sort((a, b) => b.localeCompare(a));

  if (pastMonthKeys.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Nenhum mês anterior fechado para exibir no histórico.</div>';
    return;
  }

  pastMonthKeys.forEach((mKey) => {
    const [yearStr, monthStr] = mKey.split("-");
    const yearNum = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const monthFormatted = formatMonthYearLabel(yearNum, monthIndex);
    const mTransactions = db.transactions.filter(
      (t) => t.date && t.date.startsWith(mKey),
    );
    const mActiveInstallments = getActiveInstallmentsForMonth(mKey);
    const mFixedTotal = getFixedTotalForMonth(mKey);

    const totalSpent =
      mTransactions.reduce((acc, t) => acc + t.amount, 0) +
      mActiveInstallments.reduce((acc, p) => acc + p.amount, 0) +
      mFixedTotal;

    const monthConfig = db.months[mKey] || {};
    const dailyBudget =
      monthConfig.dailyBudget ||
      (db.months[currentMonthKey] || {}).dailyBudget ||
      0;
    const monthlyBudget =
      dailyBudget * getDaysInMonth(yearNum, monthIndex);
    const vaultBalance = monthlyBudget - totalSpent;

    const card = document.createElement("div");
    card.className = "history-card";
    card.id = `historyCard-${mKey}`;
    card.innerHTML = `
                <div class="history-header" onclick="toggleHistoryCard('${mKey}')">
                    <div class="history-header-top">
                        <span class="history-title">📂 ${monthFormatted}</span>
                        <span class="history-arrow">▼</span>
                    </div>
                    <div class="history-metrics">
                        <div class="history-metric-box">
                            <span class="history-metric-label">Gasto Total</span>
                            <span class="history-metric-val text-neutral">${formatCurrency(totalSpent)}</span>
                        </div>
                        <div class="history-metric-box">
                            <span class="history-metric-label">Orçamento</span>
                            <span class="history-metric-val text-neutral">${formatCurrency(monthlyBudget)}</span>
                        </div>
                        <div class="history-metric-box">
                            <span class="history-metric-label">Saldo Cofre</span>
                            <span class="history-metric-val ${vaultBalance >= 0 ? "text-green" : "text-red"}">${formatCurrency(vaultBalance)}</span>
                        </div>
                    </div>
                </div>
                <div class="history-body">
                    <div class="section-title" style="margin: 0.5rem 0 0.5rem 0; font-size: 0.8rem;">📊 Categorias (${monthFormatted})</div>
                    <div id="catBars-${mKey}"></div>

                    <div class="section-title" style="margin: 1rem 0 0.5rem 0; font-size: 0.8rem; color: #58a6ff;">💸 Lançamentos do Mês</div>
                    <div class="expense-list" id="historyTransList-${mKey}"></div>

                    <div class="section-title" style="margin: 1rem 0 0.5rem 0; font-size: 0.8rem; color: #d29922;">💳 Parcelas do Mês</div>
                    <div class="expense-list" id="historyInstList-${mKey}"></div>
                </div>
            `;
    container.appendChild(card);

    const combined = [...mTransactions];
    mActiveInstallments.forEach((p) =>
      combined.push({ category: p.category, amount: p.amount }),
    );
    renderCategoryBars(combined, totalSpent, `catBars-${mKey}`);

    const transListEl = document.getElementById(
      `historyTransList-${mKey}`,
    );
    if (mTransactions.length === 0) {
      transListEl.innerHTML =
        '<div class="empty-state" style="font-size:0.75rem;">Nenhum gasto à vista.</div>';
    } else {
      [...mTransactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((t) => {
          let cleanCat = getCleanCategory(t.category);
          const itemEl = document.createElement("div");
          itemEl.className = "expense-item";
          itemEl.onclick = () => openExpenseModal(t.id);
          itemEl.innerHTML = `
                        <div class="expense-details">
                            <span class="expense-desc">${escapeBankHtml(t.description)}</span>
                            <span class="expense-meta">${escapeBankHtml(cleanCat)} • ${isoToBrDate(t.date)}</span>
                        </div>
                        <div class="expense-right">
                            <span class="expense-amount-value">-${formatCurrency(t.amount)}</span>
                        </div>
                    `;
          transListEl.appendChild(itemEl);
        });
    }

    const instListEl = document.getElementById(`historyInstList-${mKey}`);
    if (mActiveInstallments.length === 0) {
      instListEl.innerHTML =
        '<div class="empty-state" style="font-size:0.75rem;">Nenhuma parcela ativa.</div>';
    } else {
      mActiveInstallments.forEach((p) => {
        let cleanCat = getCleanCategory(p.category);
        const itemEl = document.createElement("div");
        itemEl.className = "expense-item";
        itemEl.style.borderLeft = "3px solid #d29922";
        itemEl.onclick = () => openEditInstallmentModal(p.id);
        itemEl.innerHTML = `
                        <div class="expense-details">
                            <span class="expense-desc">${escapeBankHtml(p.description)}</span>
                            <span class="expense-meta">${escapeBankHtml(cleanCat)} • Parcela ${p.currentParcel}/${p.totalInstallments}</span>
                        </div>
                        <div class="expense-right">
                            <span class="expense-amount-value" style="color: #d29922;">-${formatCurrency(p.amount)}</span>
                        </div>
                    `;
        instListEl.appendChild(itemEl);
      });
    }
  });
}

function toggleHistoryCard(mKey) {
  const card = document.getElementById(`historyCard-${mKey}`);
  if (card) card.classList.toggle("expanded");
}

function toggleInstallmentFields() {
  const isChecked = document.getElementById(
    "isInstallmentCheckbox",
  ).checked;
  const container = document.getElementById("installmentFieldsContainer");
  const amountLabel = document.getElementById("amountLabel");

  if (isChecked) {
    container.style.display = "block";
    amountLabel.innerText = "Valor TOTAL da Compra (R$)";
    updateInstallmentPreview();
  } else {
    container.style.display = "none";
    amountLabel.innerText = "Valor do Gasto (R$)";
  }
}

function updateInstallmentPreview() {
  const isChecked = document.getElementById(
    "isInstallmentCheckbox",
  ).checked;
  if (!isChecked) return;
  const totalAmount = getMoney("expenseAmountInput");
  const count =
    parseInt(
      document.getElementById("installmentCountInput").value,
      10,
    ) || 1;
  const parcelVal =
    totalAmount > 0 && count > 0 ? totalAmount / count : 0;
  document.getElementById("installmentCalcPreview").innerText =
    `Valor de cada parcela: ${formatCurrency(parcelVal)}`;
}

function openConfigModalHandler() {
  const configModal = document.getElementById("configModal");
  const dailyInput = document.getElementById("dailyBudgetInput");
  const startDateInput = document.getElementById("startDateInput");
  const currentMonthKey = getCurrentMonthKey();

  const dailyB = (db.months[currentMonthKey] || {}).dailyBudget || 0;
  dailyInput.value = dailyB > 0 ? formatMoneyInput(dailyB) : "";
  startDateInput.value = db.config.startDate || getTodayIsoDateStr();

  updateMonthlyProjection();
  if (document.getElementById("startDateHiddenArea")) {
    document.getElementById("startDateHiddenArea").style.display = "none";
    document.getElementById("startDateArrow").innerText = "🔒";
  }
  configModal.classList.add("active");
}

function toggleStartDateArea() {
  const area = document.getElementById("startDateHiddenArea");
  const arrow = document.getElementById("startDateArrow");
  if (area.style.display === "none" || !area.style.display) {
    area.style.display = "block";
    arrow.innerText = "🔓";
  } else {
    area.style.display = "none";
    arrow.innerText = "🔒";
  }
}

function updateMonthlyProjection() {
  const dailyVal = getMoney("dailyBudgetInput");
  const now = new Date();
  const effectiveDays = getEffectiveDaysInMonth(
    now.getFullYear(),
    now.getMonth(),
  );
  const monthlyTotal = dailyVal * effectiveDays;
  const monthFormatted = formatMonthYearLabel(
    now.getFullYear(),
    now.getMonth(),
  );
  document.getElementById("monthlyProjection").innerText =
    `Orçamento previsto de ${monthFormatted} (${effectiveDays} dias): ${formatCurrency(monthlyTotal)}`;
}

function abrirModalSobra() {
  // Puxa os dados que o dashboard calculou!
  if (!window.dadosSobra) return;
  const d = window.dadosSobra;

  const htmlConta = `
    <div style="margin-bottom: 12px;">
      <p style="margin: 4px 0;"><strong>💸 Gastos à Vista (Var.):</strong> ${formatCurrency(d.monthlySpentVista)}</p>
      <p style="margin: 4px 0;"><strong>📅 Dias Passados:</strong> ${d.diasPassados} dias</p>
      <p style="margin: 4px 0;"><strong>📊 Média Var. Pura:</strong> ${formatCurrency(d.mediaDiariaVista)}/dia</p>
    </div>

    <div style="margin-bottom: 12px; padding: 10px; background: rgba(248, 81, 73, 0.1); border-radius: 8px; border: 1px solid rgba(248, 81, 73, 0.3);">
      <p style="margin: 4px 0; color: #ff7b72; font-size: 0.8rem; text-transform: uppercase; font-weight: 700;">A Verdadeira Facada Diária</p>
      <p style="margin: 4px 0; font-size: 0.8rem; color: #c9d1d9;">Var: ${formatCurrency(d.mediaDiariaVista)} + Fixo: ${formatCurrency(d.dailyFixedDeduction)} + Parc: ${formatCurrency(d.dailyInstallmentDeduction)}</p>
      <p style="margin: 6px 0 0 0; font-size: 1.1rem; color: #f85149; font-weight: 700;">Gasto Total: ${formatCurrency(d.mediaDiariaTotal)} / dia</p>
    </div>
    
    <div style="margin-bottom: 12px;">
      <p style="margin: 4px 0;"><strong>⏳ Dias Restantes:</strong> ${d.diasRestantes} dias</p>
      <p style="margin: 4px 0;"><strong>🔮 Projeção Var. Restante:</strong> ${formatCurrency(d.projecaoRestanteVista)}</p>
    </div>
    
    <hr style="border-color: #30363d; margin: 15px 0;">
    
    <div>
      <p style="margin: 4px 0; color: #58a6ff;"><strong>💰 Orçamento Base:</strong> ${formatCurrency(d.grossMonthlyBudget)}</p>
      <p style="margin: 4px 0;"><strong>📉 Variável (Real + Proj.):</strong> -${formatCurrency(d.monthlySpentVista + d.projecaoRestanteVista)}</p>
      <p style="margin: 4px 0;"><strong>💳 Parcelas do Mês:</strong> -${formatCurrency(d.monthInstallmentsTotal)}</p>
      <p style="margin: 4px 0;"><strong>🔒 Contas Fixas:</strong> -${formatCurrency(d.fixedTotal)}</p>
      
      <h4 style="margin: 10px 0 0 0; color: ${d.sobraPrevista >= 0 ? '#3fb950' : '#f85149'}; font-size: 1.2rem; border-top: 1px dashed #30363d; padding-top: 10px;">
        Sobra Final Estimada: ${formatCurrency(d.sobraPrevista)}
      </h4>
    </div>
  `;

  document.getElementById('detalhesMathSobra').innerHTML = htmlConta;
  const modal = document.getElementById('modalSobra');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
}

function fecharModalSobra() {
  const modal = document.getElementById('modalSobra');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  setTimeout(() => { modal.style.display = 'none'; }, 300);
}

// Redesenha a tela depois de cada gravação no banco.
function onBankDataSaved() {
  renderDashboard();
  if (document.getElementById("tabHistory")?.classList.contains("active"))
    renderHistory();
  if (document.getElementById("tabInstallments")?.classList.contains("active"))
    renderInstallments();
  if (document.getElementById("tabFixed")?.classList.contains("active"))
    renderFixedExpenses();
}

function openDataModalFromConfig() {
  document.getElementById("configModal").classList.remove("active");
  openDataModal();
}

function setupGastosEvents() {
  const configModal = document.getElementById("configModal");
  const closeConfigBtn = document.getElementById("closeConfigBtn");
  const bottomCloseConfigBtn = document.getElementById(
    "bottomCloseConfigBtn",
  );
  const dailyInput = document.getElementById("dailyBudgetInput");
  const startDateInput = document.getElementById("startDateInput");

  const closeConfig = () => configModal?.classList.remove("active");
  closeConfigBtn?.addEventListener("click", closeConfig);
  bottomCloseConfigBtn?.addEventListener("click", closeConfig);

  dailyInput?.addEventListener("input", () => {
    let rawVal = dailyInput.value.replace(/\./g, "").replace(",", ".");
    const val = parseFloat(rawVal) || 0;

    const currentMonthKey = getCurrentMonthKey();
    if (!db.months[currentMonthKey]) db.months[currentMonthKey] = {};
    db.months[currentMonthKey].dailyBudget = val;

    updateMonthlyProjection();
    saveDatabase();
  });

  startDateInput?.addEventListener("change", () => {
    db.config.startDate = startDateInput.value;
    updateMonthlyProjection();
    saveDatabase();
  });

  const expenseModal = document.getElementById("expenseModal");
  const closeExpenseBtn = document.getElementById("closeExpenseBtn");
  const expenseForm = document.getElementById("expenseForm");

  const closeExpense = () => expenseModal?.classList.remove("active");
  closeExpenseBtn?.addEventListener("click", closeExpense);

  expenseForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveExpense();
  });

  document
    .getElementById("editInstallmentForm")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveEditedInstallment();
    });
}

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  setupCoreEvents();
  setupGastosEvents();
  renderDashboard();

  // Atalho do portal: TobaBank-Gastos.html?action=add_expense
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "add_expense") {
    openExpenseModal();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
