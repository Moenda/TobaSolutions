/* =====================================================================
 * Toba Bank · Controle de Gastos
 * Depende de ../assets/toba-common.js e bank-core.js
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
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));

  if (tabName === "current") {
    document.getElementById("tabCurrent")?.classList.add("active");
    renderDashboard();
  } else if (tabName === "installments") {
    document.getElementById("tabInstallments")?.classList.add("active");
    renderInstallments();
  } else if (tabName === "fixed") {
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
  document.getElementById("dashSobraSubHero").innerText = `Gasto médio: ${formatCurrency(mediaDiariaTotal)}/dia`;
  document.getElementById("dashHeaderRestantes").innerText =
    diasRestantes === 1 ? "último dia do mês!" : `${diasRestantes} dias pela frente`;

  // 2. Barra de Progresso (Orçamento Total)
  document.getElementById("dashVarSpentHero").innerText = formatCurrency(totalMonthlySpent);
  document.getElementById("dashLimitHero").innerText = `de ${formatCurrency(grossMonthlyBudget)}`;

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
    availableHeroEl.className = `toba-stat-value ${todayAvailable >= 0 ? "text-neutral" : "text-red"}`;
  }

  // Facada Diária com números em vermelho e rótulos brancos em PT-BR
  const dailyInstEl = document.getElementById("dashDailyInstHero");
  if (dailyInstEl) {
    dailyInstEl.innerText = `-${formatCurrency(dailyInstallmentDeduction)}`;
  }

  const dailyFixedEl = document.getElementById("dashDailyFixedHero");
  if (dailyFixedEl) {
    dailyFixedEl.innerText = `-${formatCurrency(dailyFixedDeduction)}`;
  }

  const vaultHeroEl = document.getElementById("dashVaultHero");
  if (vaultHeroEl) {
    vaultHeroEl.innerText = formatCurrency(vaultBalance);
    vaultHeroEl.className = `toba-stat-value ${vaultBalance >= 0 ? "text-green" : "text-red"}`;
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
    container.innerHTML = tobaEmpty("📊", "Sem categorias por aqui", "Lance um gasto e o gráfico aparece.", { compact: true });
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
                    <span>${escapeHtml(category)}</span>
                    <span>${formatCurrency(amount)} (${percentage}%)</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${percentage}%;"></div>
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

  setText("homeTransCount", transactions.length);
  setText("homeInstCount", activeInstallments.length);

  if (transContainer) {
    if (transactions.length === 0) {
      transContainer.innerHTML = tobaEmpty(
        "🧾",
        "Nenhum gasto ainda",
        "Toque em <b>+ Gasto</b> para começar. Seu bolso agradece.",
      );
    } else {
      transContainer.innerHTML = [...transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(transactionItemHtml)
        .join("");
    }
  }

  if (instContainer) {
    instContainer.innerHTML =
      activeInstallments.length === 0
        ? tobaEmpty("💳", "Nenhuma parcela neste mês", "Cartão de férias. Aproveite!", { compact: true })
        : activeInstallments.map(installmentItemHtml).join("");
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Linha de um gasto à vista (abre a edição ao tocar)
function transactionItemHtml(t) {
  return `
    <div class="expense-item" role="button" tabindex="0" data-click="editExpense" data-id="${escapeHtml(t.id)}">
      <div class="expense-details">
        <span class="expense-desc">${escapeHtml(t.description)}</span>
        <span class="expense-meta">${escapeHtml(getCleanCategory(t.category))} • ${isoToBrDate(t.date)}</span>
      </div>
      <span class="expense-amount-value">-${formatCurrency(t.amount)}</span>
    </div>`;
}

// Linha da parcela do mês (abre a edição da compra parcelada)
function installmentItemHtml(p) {
  return `
    <div class="expense-item is-installment" role="button" tabindex="0" data-click="editInstallment" data-id="${escapeHtml(p.id)}">
      <div class="expense-details">
        <span class="expense-desc">${escapeHtml(p.description)}</span>
        <span class="expense-meta">${escapeHtml(getCleanCategory(p.category))} • Parcela ${p.currentParcel}/${p.totalInstallments}</span>
      </div>
      <span class="expense-amount-value">-${formatCurrency(p.amount)}</span>
    </div>`;
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
    `-${formatCurrency(dailyDeduction)}/dia`;
  document.getElementById("instTotalRemaining").innerText =
    formatCurrency(totalFutureRemaining);
  document.getElementById("instActiveCountSub").innerText =
    `${activeList.length} ${activeList.length === 1 ? "compra" : "compras"}` +
    (endingThisMonthCount > 0 ? ` • ${endingThisMonthCount} acaba${endingThisMonthCount === 1 ? "" : "m"} já` : "");

  if (activeList.length === 0) {
    activeContainer.innerHTML = tobaEmpty(
      "🎉",
      "Nenhuma compra parcelada",
      "Comprou parcelado? Em <b>+ Gasto</b>, marque “Foi parcelado?”.",
    );
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

      activeContainer.insertAdjacentHTML("beforeend", `
        <div class="bank-card" role="button" tabindex="0" data-click="editInstallment" data-id="${escapeHtml(inst.id)}">
          <div class="bank-card-top">
            <span class="bank-card-title">${escapeHtml(inst.description)}</span>
            <span class="bank-card-side">
              <span class="bank-card-side-label">Parcela</span>
              <span class="bank-card-side-value text-red">-${formatCurrency(inst.totalAmount / inst.totalInstallments)}</span>
            </span>
          </div>
          <div class="installment-progress">
            <span>Parcela ${currentParcelNum} de ${inst.totalInstallments} • total ${formatCurrency(inst.totalAmount)}</span>
            <b>${progressPct}%</b>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPct}%;"></div>
          </div>
        </div>`);
    });
  }

  if (finishedList.length === 0) {
    finishedContainer.innerHTML = tobaEmpty("⏳", "Nada quitado ainda", "Quando a última parcela passar, ela aparece aqui.", { compact: true });
  } else {
    finishedList.forEach((inst) => {
      finishedContainer.insertAdjacentHTML("beforeend", `
        <div class="bank-card is-done" role="button" tabindex="0" data-click="editInstallment" data-id="${escapeHtml(inst.id)}">
          <div class="bank-card-top" style="margin-bottom: 0">
            <span class="bank-card-title text-muted">✅ ${escapeHtml(inst.description)}</span>
            <span class="bank-card-side">
              <span class="bank-card-side-label">Pago em ${inst.totalInstallments}x</span>
              <span class="bank-card-side-value">${formatCurrency(inst.totalAmount)}</span>
            </span>
          </div>
        </div>`);
    });
  }
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
    title.innerText = "✏️ Editar gasto";
    idInput.value = item.id;
    descInput.value = item.description;
    amountInput.value = formatMoneyInput(item.amount);
    catSelect.value = item.category;
    dateInput.value = item.date;
    instGroupEl.hidden = true;
    isInstCheckbox.checked = false;
    if (deleteBtn) deleteBtn.hidden = false;
  } else {
    title.innerText = "➕ Novo gasto";
    idInput.value = "";
    descInput.value = "";
    amountInput.value = "";
    catSelect.value = "Alimentação";
    dateInput.value = presetDateIso || toIsoDate();
    instGroupEl.hidden = false;
    isInstCheckbox.checked = false;
    if (deleteBtn) deleteBtn.hidden = true;
  }

  toggleInstallmentFields();
  openTobaModal(modal.id);
  setTimeout(() => descInput.focus(), 100);
}

async function deleteExpenseFromModal() {
  const id = document.getElementById("expenseIdInput").value;
  if (!id) return;
  const confirmed = await showPageMessage("Esse gasto vai sumir do mês. Bora?", {
    title: "Apagar gasto?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (!confirmed) return;
  db.transactions = db.transactions.filter(
    (t) => String(t.id) !== String(id),
  );
  saveDatabase();
  closeTobaModal("expenseModal");
}

function toggleCard(cardId) {
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

  if (!desc || rawAmount <= 0 || !startDate) {
    showPageMessage("Faltou a descrição, o valor ou a data.", { title: "Quase lá", icon: "✍️" });
    return;
  }

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
  closeTobaModal("expenseModal");
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
  openTobaModal("editInstallmentModal");
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
    closeTobaModal("editInstallmentModal");
  }
}

async function deleteInstallmentFromEditModal() {
  const id = document.getElementById("editInstId").value;
  if (!id) return;
  const confirmed = await showPageMessage("Apaga a compra parcelada inteira (todas as parcelas, inclusive as que já passaram).", {
    title: "Apagar parcelamento?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (!confirmed) return;
  db.installments = db.installments.filter(
    (i) => String(i.id) !== String(id),
  );
  saveDatabase();
  closeTobaModal("editInstallmentModal");
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
    listContainer.innerHTML = tobaEmpty(
      "🔄",
      "Nenhum gasto fixo ainda",
      "Aluguel, Spotify, academia... cadastre acima e o app divide por dia.",
    );
    return;
  }

  const now = new Date();
  const totalDaysInMonth = getDaysInMonth(
    now.getFullYear(),
    now.getMonth(),
  );

  listContainer.innerHTML = expenses
    .map((item) => {
      const dailyItemRate =
        totalDaysInMonth > 0 ? item.amount / totalDaysInMonth : 0;
      return `
        <div class="expense-item" role="button" tabindex="0" data-click="editFixedExpense" data-id="${escapeHtml(item.id)}">
          <div class="expense-details">
            <span class="expense-desc">${escapeHtml(item.name)}</span>
            <span class="expense-meta">${escapeHtml(getCleanCategory(item.category))} • -${formatCurrency(dailyItemRate)}/dia</span>
          </div>
          <span class="expense-amount-value">-${formatCurrency(item.amount)}</span>
        </div>`;
    })
    .join("");
}

function editFixedExpense(id) {
  const item = (db.config.fixedExpenses || []).find((e) => String(e.id) === String(id));
  if (!item) return;
  document.getElementById("editFixedId").value = item.id;
  document.getElementById("editFixedName").value = item.name;
  document.getElementById("editFixedAmount").value = formatMoneyInput(item.amount);
  document.getElementById("editFixedCategory").value = item.category || "Outros";
  openTobaModal("editFixedModal");
}

function saveFixedExpense() {
  const id = document.getElementById("editFixedId").value;
  const item = (db.config.fixedExpenses || []).find((e) => String(e.id) === String(id));
  if (!item) return;
  const newName = document.getElementById("editFixedName").value.trim();
  const newAmount = getMoney("editFixedAmount");
  if (!newName || newAmount <= 0) {
    showPageMessage("Nome ou valor inválido!", { title: "Opa", icon: "🤨" });
    return;
  }
  item.name = newName;
  item.amount = newAmount;
  item.category = document.getElementById("editFixedCategory").value;
  saveDatabase();
  closeTobaModal("editFixedModal");
}

function addFixedExpense() {
  const name = document.getElementById("fixedNameInput").value.trim();
  const amount = getMoney("fixedAmountInput");
  const category = document.getElementById("fixedCategorySelect").value;

  if (!name || amount <= 0) {
    showPageMessage("Informe o nome e um valor válido!", { title: "Quase lá", icon: "✍️" });
    return;
  }

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

async function deleteFixedFromModal() {
  const id = document.getElementById("editFixedId").value;
  const confirmed = await showPageMessage("Os meses que já passaram continuam com ele no histórico.", {
    title: "Apagar gasto fixo?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (!confirmed) return;
  db.config.fixedExpenses = (db.config.fixedExpenses || []).filter(
    (item) => String(item.id) !== String(id),
  );
  saveDatabase();
  closeTobaModal("editFixedModal");
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
    container.innerHTML = tobaEmpty(
      "📂",
      "Nenhum mês fechado ainda",
      "Quando o mês virar, o resumo dele fica guardado aqui.",
    );
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
    card.className = "acc-card";
    card.id = `historyCard-${mKey}`;
    card.innerHTML = `
      <button type="button" class="acc-header" data-click="toggleCard" data-target="historyCard-${mKey}">
        <span class="acc-title">📂 ${monthFormatted}</span>
        <span class="bank-card-side">
          <span class="bank-card-side-label">Cofre</span>
          <span class="bank-card-side-value ${vaultBalance >= 0 ? "text-green" : "text-red"}">${formatCurrency(vaultBalance)}</span>
        </span>
      </button>
      <div class="toba-stats history-stats">
        <div class="toba-stat">
          <span class="toba-stat-label">Gasto total</span>
          <span class="toba-stat-value">${formatCurrency(totalSpent)}</span>
        </div>
        <div class="toba-stat">
          <span class="toba-stat-label">Orçamento</span>
          <span class="toba-stat-value">${formatCurrency(monthlyBudget)}</span>
        </div>
      </div>
      <div class="acc-body">
        <div class="section-title is-first">📊 Categorias</div>
        <div id="catBars-${mKey}"></div>
        <div class="section-title">💸 Lançamentos</div>
        <div class="expense-list" id="historyTransList-${mKey}"></div>
        <div class="section-title">💳 Parcelas</div>
        <div class="expense-list" id="historyInstList-${mKey}"></div>
      </div>
    `;
    container.appendChild(card);

    const combined = [...mTransactions];
    mActiveInstallments.forEach((p) =>
      combined.push({ category: p.category, amount: p.amount }),
    );
    renderCategoryBars(combined, totalSpent, `catBars-${mKey}`);

    document.getElementById(`historyTransList-${mKey}`).innerHTML =
      mTransactions.length === 0
        ? tobaEmpty("🧾", "Nenhum gasto à vista", "", { compact: true })
        : [...mTransactions]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(transactionItemHtml)
          .join("");

    document.getElementById(`historyInstList-${mKey}`).innerHTML =
      mActiveInstallments.length === 0
        ? tobaEmpty("💳", "Nenhuma parcela", "", { compact: true })
        : mActiveInstallments.map(installmentItemHtml).join("");
  });
}

function toggleInstallmentFields() {
  const isChecked = document.getElementById(
    "isInstallmentCheckbox",
  ).checked;
  const container = document.getElementById("installmentFieldsContainer");
  const amountLabel = document.getElementById("amountLabel");

  container.hidden = !isChecked;
  if (isChecked) {
    amountLabel.innerText = "Valor TOTAL da compra (R$)";
    updateInstallmentPreview();
  } else {
    amountLabel.innerText = "Valor do gasto (R$)";
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

// Preenche os campos do Gastos dentro da ⚙️ antes de abrir.
function openGastosSettings() {
  const dailyInput = document.getElementById("dailyBudgetInput");
  const startDateInput = document.getElementById("startDateInput");
  const currentMonthKey = getCurrentMonthKey();

  const dailyB = (db.months[currentMonthKey] || {}).dailyBudget || 0;
  dailyInput.value = dailyB > 0 ? formatMoneyInput(dailyB) : "";
  startDateInput.value = db.config.startDate || toIsoDate();

  updateMonthlyProjection();
  document.getElementById("startDateHiddenArea").hidden = true;
  document.getElementById("startDateArrow").innerText = "🔒";
  openDataModal();
}

function toggleStartDateArea() {
  const area = document.getElementById("startDateHiddenArea");
  area.hidden = !area.hidden;
  document.getElementById("startDateArrow").innerText = area.hidden ? "🔒" : "🔓";
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

function openSobraHelp() {
  // Usa os números que o painel acabou de calcular.
  if (!window.dadosSobra) return;
  const d = window.dadosSobra;

  document.getElementById("detalhesMathSobra").innerHTML = `
    <div class="sobra-block kv-list">
      <div class="kv-row"><span>💸 Gastos à vista</span><span>${formatCurrency(d.monthlySpentVista)}</span></div>
      <div class="kv-row"><span>📅 Dias que passaram</span><span>${d.diasPassados}</span></div>
      <div class="kv-row"><span>📊 Média à vista</span><span>${formatCurrency(d.mediaDiariaVista)}/dia</span></div>
    </div>

    <div class="sobra-block sobra-facada">
      <div class="sobra-facada-title">🔪 A verdadeira facada diária</div>
      <div class="text-muted" style="font-size: 0.78rem; margin-top: 4px">À vista ${formatCurrency(d.mediaDiariaVista)} + fixos ${formatCurrency(d.dailyFixedDeduction)} + parcelas ${formatCurrency(d.dailyInstallmentDeduction)}</div>
      <div class="sobra-facada-total">${formatCurrency(d.mediaDiariaTotal)}/dia</div>
    </div>

    <div class="sobra-block kv-list">
      <div class="kv-row"><span>⏳ Dias pela frente</span><span>${d.diasRestantes}</span></div>
      <div class="kv-row"><span>🔮 À vista até o fim do mês</span><span>${formatCurrency(d.projecaoRestanteVista)}</span></div>
    </div>

    <hr class="divider" />

    <div class="sobra-block kv-list">
      <div class="kv-row"><span class="text-blue">💰 Orçamento do mês</span><span class="text-blue">${formatCurrency(d.grossMonthlyBudget)}</span></div>
      <div class="kv-row"><span>📉 À vista (real + previsto)</span><span>-${formatCurrency(d.monthlySpentVista + d.projecaoRestanteVista)}</span></div>
      <div class="kv-row"><span>💳 Parcelas do mês</span><span>-${formatCurrency(d.monthInstallmentsTotal)}</span></div>
      <div class="kv-row"><span>🔒 Contas fixas</span><span>-${formatCurrency(d.fixedTotal)}</span></div>
      <div class="kv-row is-total sobra-final ${d.sobraPrevista >= 0 ? "text-green" : "text-red"}"><span>Sobra prevista</span><span>${formatCurrency(d.sobraPrevista)}</span></div>
    </div>
  `;
  openTobaModal("modalSobra");
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

function saveDailyBudget(input) {
  const val = parseFloat(input.value.replace(/\./g, "").replace(",", ".")) || 0;
  const currentMonthKey = getCurrentMonthKey();
  if (!db.months[currentMonthKey]) db.months[currentMonthKey] = {};
  db.months[currentMonthKey].dailyBudget = val;
  updateMonthlyProjection();
  saveDatabase();
}

function saveStartDate(input) {
  db.config.startDate = input.value;
  updateMonthlyProjection();
  saveDatabase();
}

tobaActions({
  openExpenseReminder: () =>
    tobaOpenReminder({
      id: "gastos",
      title: "💸 Toba Bank",
      message: "Gastou algo hoje? Põe no Toba!",
      times: ["08:00", "14:00", "22:00"],
      days: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
    }),
  newExpense: () => openExpenseModal(),
  editExpense: (el) => openExpenseModal(el.dataset.id),
  editInstallment: (el) => openEditInstallmentModal(el.dataset.id),
  editFixedExpense: (el) => editFixedExpense(el.dataset.id),
  switchTab: (el) => switchTab(el.dataset.tab),
  toggleCard: (el) => toggleCard(el.dataset.target),
  openSobraHelp,
  openSettings: openGastosSettings,
  toggleStartDateArea,
  saveDailyBudget,
  saveStartDate,
  saveExpense,
  deleteExpenseFromModal,
  saveEditedInstallment,
  deleteInstallmentFromEditModal,
  saveFixedExpense,
  deleteFixedFromModal,
  addFixedExpense,
  toggleInstallmentFields,
  updateInstallmentPreview,
});

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  renderDashboard();

  // Atalho do portal: TobaBank-Gastos.html?action=add_expense
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "add_expense") {
    openExpenseModal();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
