/* =====================================================================
 * Toba Bank · contas do mês (Gastos)
 * - Fonte ÚNICA do cálculo do painel do Gastos: usado pela tela de Gastos
 *   (TobaBank-Gastos.html) e pelo card do Toba Bank no portal (index.html).
 *   Mudou uma regra? Mude aqui e as duas telas continuam batendo.
 * - Só lê o banco recebido; não grava nada e não depende de bank-core.js
 *   (o portal carrega este arquivo sozinho).
 * ===================================================================== */

// Bancos antigos guardavam o início como "dd/mm/aaaa"; o load do Bank
// converte, mas o portal pode ler o banco antes disso.
function normalizeBankStartDate(startDate) {
  if (!startDate || !String(startDate).includes("/")) return startDate || "";
  const [d, m, y] = String(startDate).split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function calcBankEffectiveDays(bankDb, year, monthIndex) {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const isoStart = normalizeBankStartDate(bankDb.config?.startDate);
  if (!isoStart || !isoStart.includes("-")) return totalDays;

  const [sYear, sMonth, sDay] = isoStart.split("-").map(Number);
  const currentMonth = monthIndex + 1;

  if (year < sYear || (year === sYear && currentMonth < sMonth)) return 0;
  if (year === sYear && currentMonth === sMonth) {
    const daysLeft = totalDays - sDay + 1;
    return daysLeft > 0 ? daysLeft : 0;
  }
  return totalDays;
}

function calcBankActiveInstallments(bankDb, monthKey) {
  const result = [];
  const [targetYear, targetMonth] = monthKey.split("-").map(Number);

  (bankDb.installments || []).forEach((inst) => {
    if (!inst.startDate) return;
    const [sYear, sMonth] = inst.startDate.split("-").map(Number);
    const totalInstallments = Number(inst.totalInstallments) || 1;
    // Trabalhamos em meses civis, não em dias: isso evita erros com
    // meses de durações diferentes e identifica a parcela do mês certo.
    const monthDiff = (targetYear - sYear) * 12 + (targetMonth - sMonth);

    if (monthDiff >= 0 && monthDiff < totalInstallments) {
      result.push({
        id: inst.id,
        description: inst.description,
        amount: (Number(inst.totalAmount) || 0) / totalInstallments,
        category: inst.category || "Outros",
        currentParcel: monthDiff + 1,
        totalInstallments: inst.totalInstallments,
        startDate: inst.startDate,
      });
    }
  });
  return result;
}

// Resumo do mês atual (o mesmo que aparece no topo do Gastos).
function calcBankMonthSummary(bankDb, now = new Date()) {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const todayIso = `${monthKey}-${String(now.getDate()).padStart(2, "0")}`;

  const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const effectiveDays = calcBankEffectiveDays(bankDb, year, monthIndex);

  const baseDailyBudget =
    Number((bankDb.months || {})[monthKey]?.dailyBudget) || 0;
  const grossMonthlyBudget = baseDailyBudget * effectiveDays;

  const activeInstallments = calcBankActiveInstallments(bankDb, monthKey);
  const monthInstallmentsTotal = activeInstallments.reduce(
    (acc, p) => acc + p.amount,
    0,
  );

  // No mês atual valem os gastos fixos da configuração (o snapshot do mês é
  // só a cópia congelada que o Gastos grava para o histórico).
  const fixedTotal = (bankDb.config?.fixedExpenses || []).reduce(
    (acc, item) => acc + (Number(item.amount) || 0),
    0,
  );
  const dailyFixedDeduction =
    totalDaysInMonth > 0 ? fixedTotal / totalDaysInMonth : 0;
  const dailyInstallmentDeduction =
    totalDaysInMonth > 0 ? monthInstallmentsTotal / totalDaysInMonth : 0;

  const netDailyBudget = Math.max(
    baseDailyBudget - dailyInstallmentDeduction - dailyFixedDeduction,
    0,
  );

  // Uma única passagem reúne os lançamentos do mês e o gasto de hoje.
  const monthTransactions = [];
  let monthlySpentVista = 0;
  let todaySpent = 0;
  (bankDb.transactions || []).forEach((transaction) => {
    if (!transaction.date) return;
    const amount = Number(transaction.amount) || 0;
    if (transaction.date.startsWith(monthKey)) {
      monthTransactions.push(transaction);
      monthlySpentVista += amount;
    }
    if (transaction.date === todayIso) todaySpent += amount;
  });

  const varSpent = monthlySpentVista + monthInstallmentsTotal;
  const totalMonthlySpent = varSpent + fixedTotal;

  let diasPassados;
  const startDateIso =
    normalizeBankStartDate(bankDb.config?.startDate) || todayIso;
  if (startDateIso.startsWith(monthKey)) {
    const sDay = parseInt(startDateIso.split("-")[2], 10);
    diasPassados = Math.max(now.getDate() - sDay + 1, 1);
  } else if (startDateIso < monthKey) {
    diasPassados = now.getDate();
  } else {
    diasPassados = 0;
  }
  const diasRestantes = Math.max(effectiveDays - diasPassados, 0);

  // A projeção variável usa apenas gastos à vista; parcelas e fixos já
  // são descontados separadamente do orçamento mensal.
  const mediaDiariaVista =
    diasPassados > 0 ? monthlySpentVista / diasPassados : 0;
  // A verdadeira facada diária (variável + fixo + parcelas).
  const mediaDiariaTotal =
    mediaDiariaVista + dailyInstallmentDeduction + dailyFixedDeduction;

  const projecaoRestanteVista = mediaDiariaVista * diasRestantes;
  const projecaoTotalMes =
    monthlySpentVista + projecaoRestanteVista + monthInstallmentsTotal + fixedTotal;
  const sobraPrevista = grossMonthlyBudget - projecaoTotalMes;

  // O cofre acumula o orçamento diário líquido desde o início do período,
  // descontando os gastos variáveis já lançados no mês.
  const vaultBalance = netDailyBudget * diasPassados - monthlySpentVista;
  const todayAvailable = netDailyBudget - todaySpent;

  return {
    monthKey, todayIso, totalDaysInMonth, effectiveDays,
    baseDailyBudget, grossMonthlyBudget, netDailyBudget,
    activeInstallments, monthInstallmentsTotal,
    fixedTotal, dailyFixedDeduction, dailyInstallmentDeduction,
    monthTransactions, monthlySpentVista, todaySpent,
    varSpent, totalMonthlySpent,
    diasPassados, diasRestantes, mediaDiariaVista, mediaDiariaTotal,
    projecaoRestanteVista, projecaoTotalMes, sobraPrevista,
    vaultBalance, todayAvailable,
  };
}
