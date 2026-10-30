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

// Faixa vermelha em cima do card: Livre hoje negativo = quantos dias sem
// gastar até voltar pro verde (recoveryDays em bank-metrics.js).
function renderJacaBanner(summary) {
  const banner = document.getElementById("adviceBanner");
  const text = document.getElementById("adviceText");
  if (!banner || !text) return;
  const { todayAvailable, recoveryDays, recoveryInMonth, diasRestantes } = summary;
  banner.classList.toggle("active", todayAvailable < 0);
  if (todayAvailable >= 0) return;
  const debt = formatCurrency(-todayAvailable);
  if (!recoveryDays) {
    text.innerHTML = `<b>Eita pai, pisou na jaca.</b> Tá ${debt} no vermelho hoje. Segura a carteira 🫣`;
  } else if (recoveryInMonth) {
    const days = recoveryDays === 1 ? "1 dia" : `${recoveryDays} dias`;
    text.innerHTML = `<b>Eita pai, pisou na jaca.</b> Economize por ${days} pra voltar pro verdin 🤑`;
  } else {
    const left = diasRestantes === 1 ? "1 dia" : `${diasRestantes} dias`;
    text.innerHTML = `<b>Eita pai, pisou na jaca.</b> Nem zerando os gastos dá pra voltar pro verdin esse mês. Só a virada te salva (faltam ${left}) 🙏`;
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

  // Faixa "pisou na jaca" em cima do card (Livre hoje negativo)
  renderJacaBanner(summary);

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

// v1.48: categoria tocada no "Gastos por categoria" da tela inicial filtra
// os "Lançamentos do mês" (null = todos). Só tela, nada é gravado.
let expenseCategoryFilter = null;

function renderCategoryBars(
  transactions,
  totalSpent,
  containerId = "categoryBarsContainer",
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const canFilter = containerId === "categoryBarsContainer";

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
      if (canFilter) {
        itemEl.classList.add("is-filter");
        itemEl.classList.toggle("is-selected", expenseCategoryFilter === category);
        itemEl.classList.toggle("is-dim", expenseCategoryFilter !== null && expenseCategoryFilter !== category);
        itemEl.setAttribute("role", "button");
        itemEl.tabIndex = 0;
        itemEl.dataset.click = "filterExpenseCategory";
        itemEl.dataset.category = category;
        itemEl.setAttribute("aria-pressed", String(expenseCategoryFilter === category));
      }
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

  // Filtro de categoria: some sozinho se a categoria não tem mais gasto no mês
  if (expenseCategoryFilter !== null && !transactions.some((t) => getCleanCategory(t.category) === expenseCategoryFilter)) {
    expenseCategoryFilter = null;
    document.querySelectorAll("#categoryBarsContainer .category-item").forEach((item) => item.classList.remove("is-selected", "is-dim"));
  }
  const filtered = expenseCategoryFilter === null
    ? transactions
    : transactions.filter((t) => getCleanCategory(t.category) === expenseCategoryFilter);
  setText("homeTransCount", expenseCategoryFilter === null ? transactions.length : `${filtered.length}/${transactions.length}`);
  setText("homeInstCount", activeInstallments.length);
  renderExpenseFilterBar(filtered);

  if (transContainer) {
    if (transactions.length === 0) {
      transContainer.innerHTML = tobaEmpty(
        "🧾",
        "Nenhum gasto ainda",
        "Toque em <b>+ Gasto</b> para começar. Seu bolso agradece.",
      );
    } else {
      transContainer.innerHTML = [...filtered]
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

function renderExpenseFilterBar(filtered) {
  const bar = document.getElementById("expenseFilterBar");
  if (!bar) return;
  bar.hidden = expenseCategoryFilter === null;
  if (expenseCategoryFilter === null) return;
  const total = filtered.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const count = filtered.length;
  // v1.51: total e média por compra em 2 quadradinhos
  const tile = (label, value, note, extra = "") => `
      <span class="expense-filter-stat${extra}">
        <span class="expense-filter-stat-label">${label}</span>
        <span class="expense-filter-stat-value">${value}</span>
        <span class="expense-filter-stat-note">${note}</span>
      </span>`;
  bar.innerHTML = `
    <span class="expense-filter-text">
      <b>${escapeHtml(expenseCategoryFilter)}</b>
    </span>
    <button type="button" class="chip-btn" data-click="clearExpenseFilter">✕ Limpar filtro</button>
    <span class="expense-filter-stats">
      ${tile("💸 Total no mês", formatCurrency(total), `em ${count} ${count === 1 ? "compra" : "compras"}`)}
      ${tile("📊 Média", count ? formatCurrency(total / count) : "--", "por compra", " is-avg")}
    </span>`;
}

function filterExpenseCategory(el) {
  const category = el.dataset.category;
  expenseCategoryFilter = expenseCategoryFilter === category ? null : category;
  renderDashboard();
  if (expenseCategoryFilter === null) return;
  const card = document.getElementById("homeTransCard");
  if (card) {
    card.classList.add("expanded");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const dateInput = document.getElementById("expenseDateInput");
  const isInstCheckbox = document.getElementById("isInstallmentCheckbox");
  const instGroupEl = document.getElementById("installmentCheckboxGroup");
  const deleteBtn = document.getElementById("deleteExpenseModalBtn");
  document.getElementById("expensePendingId").value = "";
  document.getElementById("expensePendingHint").hidden = true;

  if (id) {
    const item = db.transactions.find((t) => String(t.id) === String(id));
    if (!item) return;
    title.innerText = "✏️ Editar gasto";
    idInput.value = item.id;
    descInput.value = item.description;
    amountInput.value = formatMoneyInput(item.amount);
    setCategoryField("expenseCategorySelect", item.category);
    dateInput.value = item.date;
    instGroupEl.hidden = true;
    isInstCheckbox.checked = false;
    if (deleteBtn) deleteBtn.hidden = false;
  } else {
    title.innerText = "➕ Novo gasto";
    idInput.value = "";
    descInput.value = "";
    amountInput.value = "";
    setCategoryField("expenseCategorySelect", "comida");
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
  const pendingId = document.getElementById("expensePendingId").value;

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
        // Mantém campos extras do gasto (notifId, oldCategory)
        db.transactions[index] = {
          ...db.transactions[index],
          id,
          description: desc,
          amount: rawAmount,
          category,
          date: startDate,
        };
      }
    } else {
      const transaction = {
        id: Date.now().toString(),
        description: desc,
        amount: rawAmount,
        category,
        date: startDate,
      };
      if (pendingId) transaction.notifId = pendingId; // veio da notificação (não entra duas vezes)
      db.transactions.push(transaction);
    }
  }

  const saved = saveDatabase();
  closeTobaModal("expenseModal");
  if (saved && pendingId && !id) finishPendingLaunch(pendingId); // só tira da fila depois de gravar
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
  setCategoryField("editInstCategory", inst.category);
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
    inst.category = document.getElementById("editInstCategory").value;
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
  setCategoryField("editFixedCategory", item.category);
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
  refreshNativeAutoSection();
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

/* ---------------------------------------------------------------------
 * Gastos automáticos (só no app Android, TobaAndroid/): o app lê as
 * notificações de compra do banco/carteira e guarda numa fila. Desde v1.47
 * a fila vira "pendentes" pra você aprovar (até a v1.46 entrava sozinha).
 * O gasto lançado leva `notifId` (opcional) para nunca entrar duas vezes;
 * só sai da fila depois de gravar no banco ou de você descartar.
 * ------------------------------------------------------------------- */
const AUTO_CATEGORY_HINTS = [
  [/uber|99 ?app|99pop|cabify|taxi|estacion|estapar|zona azul|sem parar|conectcar|veloe|pedagio/, "uber"],
  [/posto|shell|ipiranga|petrobras|br mania|combust/, "combustivel"],
  [/ifood|ifd\*|rappi|restaurante|lanchonete|padaria|burger|pizza|cafe|mc ?donald|subway|outback/, "comida"],
  [/mercado|supermerc|atacad|assai|carrefour|pao de acucar|hortifruti|sacolao/, "mercado"],
  [/farmacia|drogaria|droga raia|drogasil|pague menos|panvel|clinica|laborat/, "saude"],
  [/netflix|spotify|prime video|amazon prime|disney|hbo|youtube|globoplay|deezer|icloud|google one/, "assinaturas"],
  [/steam|playstation|psn|xbox|nintendo|epic games|riot|blizzard|battle\.?net|jagex/, "games"],
  [/petz|cobasi|petshop|pet shop|veterin/, "pets"],
  [/renner|riachuelo|c&a|zara|shein|centauro|netshoes|hering/, "roupas"],
  [/tarifa|anuidade|juros|multa|iof/, "taxas"],
];

function plainText(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Mesma loja de antes → mesma categoria. Senão, palpite pelo nome; senão "outros".
function guessExpenseCategory(description) {
  const key = plainText(description);
  for (let i = db.transactions.length - 1; i >= 0; i--) {
    const t = db.transactions[i];
    if (BANK_CATEGORIES[t.category] && plainText(t.description) === key) return t.category;
  }
  const hint = AUTO_CATEGORY_HINTS.find(([pattern]) => pattern.test(key));
  return hint ? hint[1] : "outros";
}

/* ---------------------------------------------------------------------
 * Compras pendentes (desde v1.47): a fila do app Android NÃO entra mais
 * sozinha no mês. Fica num card "🤖 N compras esperando você" e você lança
 * (editando antes, se quiser) ou descarta. A fila do app é o único lugar
 * onde a pendente mora (nada novo no TOBA_BANK_DB): só sai de lá com
 * ackPurchases DEPOIS de gravar o gasto (com notifId) ou de você descartar.
 * Funciona com o APK antigo (sem raw/old nos itens). O que já tem gasto com
 * o mesmo notifId é tirado da fila sozinho (lançado antes, não repete).
 * ------------------------------------------------------------------- */
let nativePending = [];

// Lê a fila do app, tira o lixo e o que já foi lançado; devolve as pendentes.
function readNativePending() {
  if (!TOBA_NATIVE || !isDbLoaded) return [];
  let raw;
  try {
    raw = JSON.parse(TOBA_NATIVE.getPendingPurchases() || "[]");
  } catch (err) {
    console.error("Fila de compras do app ilegível:", err);
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const drop = [];
  const list = [];
  raw.forEach((p) => {
    const id = String(p?.id || "");
    const amount = Math.round((Number(p?.amount) || 0) * 100) / 100;
    if (!id) return;
    if (amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) {
      drop.push(id); // lixo
      return;
    }
    if (db.transactions.some((t) => String(t.notifId) === id)) {
      drop.push(id); // já lançado numa abertura anterior
      return;
    }
    const desc = String(p.desc || "Compra no cartão").slice(0, 60);
    list.push({
      id, amount, desc, date: p.date,
      app: String(p.app || ""),
      raw: String(p.raw || ""),
      old: p.old === true,
      category: guessExpenseCategory(desc),
    });
  });
  if (drop.length) TOBA_NATIVE.ackPurchases(JSON.stringify(drop));
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

// Mesmo valor + mesma loja + mesmo dia já lançado (ou em outra pendente): avisa, não bloqueia.
function findPendingTwin(p) {
  const same = (amount, desc, date) => Math.abs(amount - p.amount) < 0.005 && date === p.date && plainText(desc) === plainText(p.desc);
  if (db.transactions.some((t) => same(Number(t.amount) || 0, t.description, t.date))) return "já tem um gasto igual nesse dia";
  if (nativePending.some((o) => o.id !== p.id && same(o.amount, o.desc, o.date))) return "tem outra pendente igual";
  return "";
}

function refreshPendingPurchases() {
  nativePending = readNativePending();
  renderPendingCard();
  if (document.getElementById("pendingModal")?.classList.contains("active")) renderPendingList();
}

function renderPendingCard() {
  const box = document.getElementById("pendingPurchases");
  if (!box) return;
  const n = nativePending.length;
  if (!n) {
    box.innerHTML = "";
    return;
  }
  const total = nativePending.reduce((sum, p) => sum + p.amount, 0);
  box.innerHTML = `
    <button type="button" class="pending-card" data-click="openPendingPurchases">
      <span class="pending-card-icon">🤖<span class="pending-badge">${n}</span></span>
      <span class="pending-card-text">
        <strong>${n === 1 ? "1 compra do cartão esperando você" : `${n} compras do cartão esperando você`}</strong>
        <span>${formatCurrency(total)} no total · toque pra lançar ou descartar</span>
      </span>
      <span class="toba-hub-chevron">›</span>
    </button>`;
}

function renderPendingList() {
  const list = document.getElementById("pendingList");
  const n = nativePending.length;
  document.getElementById("pendingModalTitle").textContent = n ? `🤖 ${n} ${n === 1 ? "compra" : "compras"} pra aprovar` : "🤖 Compras pra aprovar";
  document.getElementById("pendingFooter").hidden = n < 2;
  document.getElementById("pendingAllBtn").textContent = `✅ Lançar todas (${formatCurrency(nativePending.reduce((s, p) => s + p.amount, 0))})`;
  if (!n) {
    list.innerHTML = tobaEmpty("🧘", "Nada esperando", "Todas as compras lidas já foram lançadas ou descartadas.", { compact: true });
    return;
  }
  list.innerHTML = nativePending.map((p) => {
    const twin = findPendingTwin(p);
    return `
      <div class="pending-item">
        <div class="pending-head">
          <strong>${formatCurrency(p.amount)}</strong>
          <span>${isoToBrDate(p.date)}${p.app ? ` · ${escapeHtml(p.app)}` : ""}</span>
        </div>
        <div class="pending-desc">${escapeHtml(p.desc)} · <span class="pending-cat">${escapeHtml(getCleanCategory(p.category))}</span></div>
        ${p.old ? '<div class="pending-flag">⏳ Notificação antiga reenviada pelo app. Confere se não é repetida.</div>' : ""}
        ${twin ? `<div class="pending-flag">⚠️ Parece repetida: ${twin}.</div>` : ""}
        ${p.raw ? `<details class="pending-raw"><summary>Texto da notificação</summary><p>${escapeHtml(p.raw)}</p></details>` : ""}
        <div class="pending-actions">
          <button type="button" class="btn btn-secondary" data-click="discardPending" data-id="${escapeHtml(p.id)}">❌ Descartar</button>
          <button type="button" class="btn btn-primary" data-click="launchPending" data-id="${escapeHtml(p.id)}">✅ Lançar</button>
        </div>
      </div>`;
  }).join("");
}

function openPendingPurchases() {
  refreshPendingPurchases();
  renderPendingList();
  openTobaModal("pendingModal");
}

// Abre o formulário de gasto já preenchido; o salvar (saveExpense) grava com notifId e tira da fila.
function launchPending(el) {
  const p = nativePending.find((item) => item.id === el.dataset.id);
  if (!p) return;
  closeTobaModal("pendingModal");
  openExpenseModal(null, p.date);
  document.getElementById("expenseModalTitle").innerText = "🤖 Lançar compra do cartão";
  document.getElementById("expenseDescInput").value = p.desc;
  document.getElementById("expenseAmountInput").value = formatMoneyInput(p.amount);
  setCategoryField("expenseCategorySelect", p.category);
  document.getElementById("expensePendingId").value = p.id;
  document.getElementById("installmentCheckboxGroup").hidden = true;
  const hint = document.getElementById("expensePendingHint");
  hint.textContent = `Lida da notificação${p.app ? ` do ${p.app}` : ""}. Confere e salva; dá pra mudar tudo.`;
  hint.hidden = false;
}

// Chamado pelo saveExpense quando o gasto veio de uma pendente.
function finishPendingLaunch(pendingId) {
  TOBA_NATIVE?.ackPurchases(JSON.stringify([pendingId]));
  refreshPendingPurchases();
  if (nativePending.length) setTimeout(() => openPendingPurchases(), 300);
}

async function discardPending(el) {
  const p = nativePending.find((item) => item.id === el.dataset.id);
  if (!p || !TOBA_NATIVE) return;
  const ok = await showPageMessage(`${formatCurrency(p.amount)} · ${p.desc} (${isoToBrDate(p.date)}) sai da lista e não volta mais.`, {
    title: "Descartar essa?", icon: "❌", confirm: true, confirmLabel: "Descartar",
  });
  if (!ok) return;
  TOBA_NATIVE.ackPurchases(JSON.stringify([p.id]));
  refreshPendingPurchases();
  tobaToast("❌ Descartada");
  if (nativePending.length) openPendingPurchases();
}

async function launchAllPending() {
  if (!nativePending.length) return;
  const items = [...nativePending];
  const total = items.reduce((s, p) => s + p.amount, 0);
  const ok = await showPageMessage(`${items.length} compras (${formatCurrency(total)}) entram no mês com a categoria sugerida. Dá pra editar cada uma depois no histórico.`, {
    title: "Lançar todas?", icon: "✅", confirm: true, confirmLabel: "Lançar todas",
  });
  if (!ok) return;
  const baseId = Date.now();
  const added = items.map((p, i) => ({ id: (baseId + i).toString(), description: p.desc, amount: p.amount, category: p.category, date: p.date, notifId: p.id }));
  db.transactions.push(...added);
  if (!saveDatabase({ silent: true })) {
    db.transactions = db.transactions.filter((t) => !added.includes(t));
    return; // fica tudo na fila
  }
  TOBA_NATIVE.ackPurchases(JSON.stringify(items.map((p) => p.id)));
  closeTobaModal("pendingModal");
  refreshPendingPurchases();
  tobaToast(`✅ ${items.length} gastos lançados`);
}

const PURCHASE_LOG_STATUS = {
  detectada: "📥 Foi pras pendentes",
  ignorada: "🙈 Ignorada",
  repetida: "♻️ Repetida",
  fora: "🚫 App fora da lista",
};

function refreshNativeAutoSection() {
  const section = document.getElementById("nativeAutoSection");
  if (!section || !TOBA_NATIVE) return;
  section.hidden = false;
  const ok = TOBA_NATIVE.hasNotificationAccess();
  document.getElementById("nativeAccessDesc").textContent = ok
    ? "✅ Ligado: compras no cartão entram sozinhas"
    : "Desligado: toque para dar acesso";
  document.getElementById("nativeRestrictedBtn").hidden = ok;
}

async function openNativeAccess() {
  if (!TOBA_NATIVE) return;
  const go = await showPageMessage(
    "Na próxima tela, ligue o Toba em \"Acesso a notificações\". Ele só guarda notificações com R$ dos apps de banco e carteira, e nada sai do celular.\n\nSe a opção estiver cinza (\"configuração restrita\"), volte aqui e toque em ⚠️ Liberar configuração restrita.",
    { title: "Ler notificações de compra", icon: "🤖", confirm: true, confirmLabel: "Abrir", danger: false },
  );
  if (go) TOBA_NATIVE.openNotificationAccess();
}

function openPurchaseLog() {
  if (!TOBA_NATIVE) return;
  let log = [];
  try {
    log = JSON.parse(TOBA_NATIVE.getPurchaseLog() || "[]");
  } catch (err) {
    log = [];
  }
  const list = document.getElementById("purchaseLogList");
  if (!log.length) {
    list.innerHTML = tobaEmpty("🧾", "Nada lido ainda", "Faça uma compra no cartão e volte aqui.");
  } else {
    list.innerHTML = log
      .map((e) => {
        const when = new Date(Number(e.at) || 0);
        const time = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
        const status = PURCHASE_LOG_STATUS[e.status] || escapeHtml(e.status);
        const reason = e.reason ? ` · ${escapeHtml(e.reason)}` : "";
        const allow = e.status === "fora"
          ? `<button type="button" class="chip-btn" data-click="allowNativeApp" data-pkg="${escapeHtml(e.pkg)}">Ler este app</button>`
          : "";
        return `
          <div class="purchase-log-item">
            <div class="purchase-log-head"><b>${escapeHtml(e.app || e.pkg)}</b><span>${isoToBrDate(toIsoDate(when))} ${time}</span></div>
            <div class="purchase-log-raw">${escapeHtml(e.raw)}</div>
            <div class="purchase-log-foot"><span>${status}${reason}</span>${allow}</div>
          </div>`;
      })
      .join("");
  }
  openTobaModal("purchaseLogModal");
}

// Texto puro do log, pra colar no WhatsApp / mandar pro suporte
async function copyPurchaseLog() {
  let log = [];
  try {
    log = JSON.parse(TOBA_NATIVE?.getPurchaseLog() || "[]");
  } catch (err) {
    log = [];
  }
  const fmt = (ms) => {
    const d = new Date(Number(ms) || 0);
    return `${isoToBrDate(toIsoDate(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const text = log.map((e) => [
    `[${fmt(e.at)}]${e.when && Math.abs(Number(e.when) - Number(e.at)) > 60000 ? ` (compra: ${fmt(e.when)})` : ""} ${e.app || e.pkg} (${e.pkg})`,
    `  ${e.raw}`,
    `  → ${e.status}${e.reason ? ` · ${e.reason}` : ""}${e.amount ? ` · R$ ${e.amount} · ${e.desc || ""}` : ""}`,
  ].join("\n")).join("\n\n") || "(log vazio)";
  try {
    await navigator.clipboard.writeText(text);
    tobaToast("📋 Copiado! Cola onde quiser");
  } catch (err) {
    showPageMessage(text, { title: "Copie o texto abaixo", icon: "📋" });
  }
}

function allowNativeApp(el) {
  if (!TOBA_NATIVE) return;
  TOBA_NATIVE.allowApp(el.dataset.pkg);
  el.replaceWith(document.createTextNode("✓ Liberado: as próximas entram"));
}

// O app chama ao voltar para a frente (compras feitas com o app fechado).
window.onTobaAppResume = () => {
  refreshPendingPurchases();
  refreshNativeAutoSection();
};

tobaActions({
  openNativeAccess,
  openNativeRestricted: () => TOBA_NATIVE && TOBA_NATIVE.openAppInfo(),
  openPurchaseLog,
  copyPurchaseLog,
  allowNativeApp,
  openPendingPurchases,
  launchPending,
  discardPending,
  launchAllPending,
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
  filterExpenseCategory,
  clearExpenseFilter: () => {
    expenseCategoryFilter = null;
    renderDashboard();
  },
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
  refreshPendingPurchases();
  // Tocou na notificação "💸 R$ X" do app: abre direto as pendentes
  if (urlParams.get("pending") === "1") {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (nativePending.length) openPendingPurchases();
  }
});
