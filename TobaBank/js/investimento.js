/* =====================================================================
 * Toba Bank · Investimentos (carteira, cofrinhos, gráficos)
 * Depende de bank-core.js e Chart.js
 * ===================================================================== */
let cofrinhosVisible = false;

let patrimonyChartInstance = null;

let projectionChartInstance = null;

let currentChartPeriod = "3m";

let currentProjPeriod = "6m";

let chartMode = "brl";

let chartAlignMode = false;

let chartVisibleAssets = new Set();

function toggleAlignMode() {
  chartAlignMode = !chartAlignMode;
  const btn = document.getElementById("chartModeAlign");
  if (btn) {
    if (chartAlignMode) {
      btn.style.borderColor = "#3fb950";
      btn.style.color = "#3fb950";
      btn.style.background = "rgba(63, 185, 80, 0.1)";
      btn.innerText = "🏁 Alinhado na Partida (On)";
    } else {
      btn.style.borderColor = "#30363d";
      btn.style.color = "#8b949e";
      btn.style.background = "#0d1117";
      btn.innerText = "🏁 Alinhado na Partida (Off)";
    }
  }
  renderPatrimonyChart(currentChartPeriod);
}

const DAY_MS = 1000 * 60 * 60 * 24;

const sumAmounts = (list) => (list || []).reduce((acc, x) => acc + x.amount, 0);

/* Números de um investimento de longo prazo (não cofrinho), levando em
 * conta aportes E retiradas.
 * - balance: último saldo informado pelo usuário + aportes − retiradas
 *   lançados depois dele (os logs automáticos "isSystem" de versões antigas
 *   são ignorados, pois eram calculados sem os aportes posteriores).
 * - dailyRate: taxa diária que faz os aportes/retiradas, com juros, chegarem
 *   ao último saldo informado (TIR). Não distorce quando entra ou sai
 *   dinheiro no meio do caminho.
 * - profit/profitPct: lucro sobre o valor investido (aportes − retiradas).
 * - projection: ganho estimado nos próximos 12 meses sobre o saldo atual. */
function getFundStats(fund) {
  const deposits = fund.deposits || [];
  const withdrawals = fund.withdrawals || [];
  const totalDeposited = sumAmounts(deposits);
  const totalWithdrawn = sumAmounts(withdrawals);
  const netInvested = totalDeposited - totalWithdrawn;

  const userLogs = (fund.balanceLogs || [])
    .filter((b) => !b.isSystem)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const lastLog = userLogs[userLogs.length - 1];

  let balance = Math.max(netInvested, 0);
  let dailyRate = 0;

  if (lastLog) {
    const T = lastLog.date;
    balance =
      lastLog.amount +
      sumAmounts(deposits.filter((d) => d.date > T)) -
      sumAmounts(withdrawals.filter((w) => w.date > T));

    const flows = [
      ...deposits.filter((d) => d.date <= T).map((d) => [d.date, d.amount]),
      ...withdrawals
        .filter((w) => w.date <= T)
        .map((w) => [w.date, -w.amount]),
    ];
    if (flows.length > 0) {
      const endMs = new Date(T).getTime();
      const flowDays = flows.map(([date, amount]) => [
        Math.max((endMs - new Date(date).getTime()) / DAY_MS, 0),
        amount,
      ]);
      // Valor que os lançamentos teriam hoje rendendo "rate" ao dia.
      const futureValue = (rate) =>
        flowDays.reduce(
          (acc, [days, amount]) => acc + amount * Math.pow(1 + rate, days),
          0,
        );

      if (Math.max(...flowDays.map(([days]) => days)) >= 1) {
        let lo = -0.01;
        let hi = 0.01;
        const fLo = futureValue(lo) - lastLog.amount;
        const fHi = futureValue(hi) - lastLog.amount;
        if (fLo * fHi < 0) {
          for (let i = 0; i < 100; i++) {
            const mid = (lo + hi) / 2;
            if ((futureValue(mid) - lastLog.amount) * fLo > 0) lo = mid;
            else hi = mid;
          }
          dailyRate = (lo + hi) / 2;
        }
      }
    }
  }

  const profit = balance - netInvested;
  const profitPct = netInvested > 0 ? (profit / netInvested) * 100 : 0;
  const projectedProfit =
    balance > 0 ? balance * (Math.pow(1 + dailyRate, 365) - 1) : 0;
  const projectedPct = (Math.pow(1 + dailyRate, 365) - 1) * 100;

  return {
    totalDeposited,
    totalWithdrawn,
    netInvested,
    balance,
    profit,
    profitPct,
    dailyRate,
    projection: { profitAmount: projectedProfit, projectedPct },
  };
}

function switchChartTab(tab) {
  document
    .getElementById("tabChartPastBtn")
    ?.classList.toggle("active", tab === "past");
  document
    .getElementById("tabChartFutureBtn")
    ?.classList.toggle("active", tab === "future");

  document.getElementById("chartPastContainer").style.display =
    tab === "past" ? "block" : "none";
  document.getElementById("chartFutureContainer").style.display =
    tab === "future" ? "block" : "none";

  if (tab === "past") {
    renderPatrimonyChart(currentChartPeriod);
  } else {
    renderProjectionChart(currentProjPeriod);
  }
}

function changeChartPeriod(period) {
  currentChartPeriod = period;
  document
    .querySelectorAll("#chartPastContainer .period-btn")
    .forEach((b) => {
      b.classList.toggle(
        "active",
        b.getAttribute("data-period") === period,
      );
    });
  renderPatrimonyChart(period);
}

function changeChartMode(mode) {
  chartMode = mode;
  document
    .getElementById("chartModeBrl")
    ?.classList.toggle("active", mode === "brl");
  document
    .getElementById("chartModePct")
    ?.classList.toggle("active", mode === "pct");
  renderPatrimonyChart(currentChartPeriod);
}

function toggleChartAsset(id) {
  id = String(id);
  if (chartVisibleAssets.has(id)) {
    chartVisibleAssets.delete(id);
  } else {
    chartVisibleAssets.add(id);
  }
  renderPatrimonyChart(currentChartPeriod);
}

function changeProjPeriod(period) {
  currentProjPeriod = period;
  document
    .querySelectorAll("#chartFutureContainer .period-btn")
    .forEach((b) => {
      b.classList.toggle(
        "active",
        b.getAttribute("data-period") === period,
      );
    });
  renderProjectionChart(period);
}

function openFinishedActionPopup(id) {
  const finishedList = db.investmentFunds || [];
  const item = finishedList.find((f) => String(f.id) === String(id));
  if (!item) return;

  const totalDeposited = (item.deposits || []).reduce(
    (acc, d) => acc + d.amount,
    0,
  );
  let finalGross = totalDeposited;
  let finalDateStr = "N/A";
  let startDateStr = "N/A";

  if (item.deposits && item.deposits.length > 0) {
    const sortedDeps = [...item.deposits].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    const sd = new Date(sortedDeps[0].date);
    sd.setMinutes(sd.getMinutes() + sd.getTimezoneOffset());
    startDateStr = `${String(sd.getDate()).padStart(2, "0")}/${String(sd.getMonth() + 1).padStart(2, "0")}/${String(sd.getFullYear()).slice(-2)}`;
  }

  if (item.balanceLogs && item.balanceLogs.length > 0) {
    const sortedLogs = [...item.balanceLogs].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    finalGross =
      item.closeAmount !== undefined
        ? item.closeAmount
        : sortedLogs[0].amount;
    const dateToUse = item.closeDate
      ? item.closeDate
      : sortedLogs[0].date;
    const d = new Date(dateToUse);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    finalDateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  }

  const ir = item.irAmount || 0;
  const finalNet = Math.max(finalGross - ir, 0);
  const totalWithdrawn = (item.withdrawals || []).reduce(
    (acc, w) => acc + w.amount,
    0,
  );
  const allOut = finalNet + totalWithdrawn;
  const realProfitNet = allOut - totalDeposited;
  const profitPercentageNet =
    totalDeposited > 0 ? (realProfitNet / totalDeposited) * 100 : 0;
  const profitSign = realProfitNet >= 0 ? "+" : "";

  document.getElementById("popupFinishedIdInput").value = item.id;
  document.getElementById("popupFinishedTitle").innerText = item.name;
  document.getElementById("popupFinishedPeriod").innerText =
    `${startDateStr} a ${finalDateStr}`;
  document.getElementById("popupFinishedDep").innerText =
    formatCurrency(totalDeposited);
  document.getElementById("popupFinishedWd").innerText =
    formatCurrency(allOut);

  const profitEl = document.getElementById("popupFinishedProfit");
  profitEl.innerText = `${profitSign}${formatCurrency(realProfitNet)} (${profitSign}${profitPercentageNet.toFixed(2)}%)`;
  profitEl.className = realProfitNet >= 0 ? "text-green" : "text-red";

  document.getElementById("popupFinishedIr").innerText =
    `-${formatCurrency(ir)}`;

  document.getElementById("finishedActionPopup").classList.add("active");
}

function reactivateFundFromPopup() {
  const id = document.getElementById("popupFinishedIdInput").value;
  document
    .getElementById("finishedActionPopup")
    .classList.remove("active");
  toggleFinishFund(id);
}

function deleteFinishedFundFromPopup() {
  const id = document.getElementById("popupFinishedIdInput").value;
  document
    .getElementById("finishedActionPopup")
    .classList.remove("active");
  deleteFund(id);
}

function renderInvestmentsScreen() {
  const investContainer = document.getElementById("investmentsContainer");
  const cofrinhosContainer =
    document.getElementById("cofrinhosContainer");
  const finishedContainer = document.getElementById(
    "finishedInvestmentsContainer",
  );
  if (!investContainer || !cofrinhosContainer || !finishedContainer)
    return;

  investContainer.innerHTML = "";
  cofrinhosContainer.innerHTML = "";
  finishedContainer.innerHTML = "";

  const funds = db.investmentFunds || [];
  let globalTotalBalance = 0;
  let globalTotalDeposited = 0;
  let globalProjectedProfitSum = 0;

  let cofrinhosTotalDeposited = 0;
  let cofrinhosWithdrawalsSum = 0;
  let cofrinhosYieldSum = 0;
  let cofrinhosCount = 0;
  let cofrinhosProjectedProfitSum = 0;

  const activeFunds = funds.filter((f) => !f.isFinished);
  const finishedFunds = funds.filter((f) => f.isFinished);
  const searchTerm = (
    document.getElementById("finishedSearchInput")?.value || ""
  ).toLowerCase();

  if (activeFunds.length === 0) {
    investContainer.innerHTML = `<div class="empty-state">Nenhum fundo de investimento ativo. Clique acima para criar!</div>`;
    cofrinhosContainer.innerHTML = `<div class="empty-state">Nenhum cofrinho criado.</div>`;
  } else {
    let hasInvestments = false;
    let hasCofrinhos = false;

    activeFunds.forEach((fund) => {
      const totalDeposited = (fund.deposits || []).reduce(
        (acc, d) => acc + d.amount,
        0,
      );
      if (fund.isCofrinho) {
        const totalWithdrawn = (fund.withdrawals || []).reduce(
          (acc, w) => acc + w.amount,
          0,
        );
        cofrinhosWithdrawalsSum += totalWithdrawn;
        const pct =
          totalDeposited > 0
            ? (totalWithdrawn / totalDeposited) * 100
            : 0;
        cofrinhosYieldSum += pct;
        cofrinhosCount++;
        cofrinhosTotalDeposited += totalDeposited;

        let cDays = 1;
        if (fund.deposits && fund.deposits.length > 0) {
          const sortedDeps = [...fund.deposits].sort(
            (a, b) => new Date(a.date) - new Date(b.date),
          );
          const firstDate = new Date(sortedDeps[0].date);
          const diffTime = new Date() - firstDate;
          cDays = Math.max(
            Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
            1,
          );
        }
        let dailyYieldRate = 0;
        if (totalDeposited > 0) {
          const currentTotal = totalDeposited + totalWithdrawn;
          dailyYieldRate =
            Math.pow(currentTotal / totalDeposited, 1 / cDays) - 1;
        }
        const projectedCofProfit =
          totalDeposited * Math.pow(1 + dailyYieldRate, 365) -
          totalDeposited;
        cofrinhosProjectedProfitSum += projectedCofProfit;

        globalTotalBalance += totalDeposited;
        globalTotalDeposited += totalDeposited;
      } else {
        const stats = getFundStats(fund);
        globalProjectedProfitSum += stats.projection.profitAmount;
        globalTotalBalance += stats.balance;
        globalTotalDeposited += stats.netInvested;
      }

      const card = document.createElement("div");
      card.className = "invest-card";
      card.id = `investCard-${fund.id}`;
      card.innerHTML = createCardHtml(fund);

      if (fund.isCofrinho) {
        cofrinhosContainer.appendChild(card);
        hasCofrinhos = true;
      } else {
        investContainer.appendChild(card);
        hasInvestments = true;
      }
    });

    if (!hasInvestments)
      investContainer.innerHTML = `<div class="empty-state">Nenhum investimento longo prazo.</div>`;
    if (!hasCofrinhos)
      cofrinhosContainer.innerHTML = `<div class="empty-state">Nenhum cofrinho ativo.</div>`;
  }

  globalProjectedProfitSum += cofrinhosProjectedProfitSum;

  const cofrinhosAvgYield =
    cofrinhosCount > 0 ? cofrinhosYieldSum / cofrinhosCount : 0;
  const cofrinhosProjectedYieldPct =
    cofrinhosTotalDeposited > 0
      ? (cofrinhosProjectedProfitSum / cofrinhosTotalDeposited) * 100
      : 0;

  const totalWEl = document.getElementById(
    "cofrinhosTotalWithdrawalsVal",
  );
  const avgYEl = document.getElementById("cofrinhosAvgYieldVal");
  const projElCof = document.getElementById("cofrinhosProjectionVal");

  if (totalWEl && avgYEl && projElCof) {
    totalWEl.innerText = formatCurrency(cofrinhosWithdrawalsSum);
    avgYEl.innerText = `+${cofrinhosAvgYield.toFixed(2)}%`;
    projElCof.innerText = `${formatCurrency(cofrinhosProjectedProfitSum)} (+${cofrinhosProjectedYieldPct.toFixed(2)}%)`;
  }

  finishedFunds.sort((a, b) => {
    const dateA = a.balanceLogs?.length
      ? new Date(
        [...a.balanceLogs].sort(
          (x, y) => new Date(y.date) - new Date(x.date),
        )[0].date,
      )
      : new Date(0);
    const dateB = b.balanceLogs?.length
      ? new Date(
        [...b.balanceLogs].sort(
          (x, y) => new Date(y.date) - new Date(x.date),
        )[0].date,
      )
      : new Date(0);
    return dateB - dateA;
  });

  let totalLiquidProfit = 0;

  if (finishedFunds.length === 0) {
    finishedContainer.innerHTML = `<div class="empty-state">Nenhum investimento resgatado no histórico.</div>`;
  } else {
    finishedFunds.forEach((fund) => {
      const totalDeposited = (fund.deposits || []).reduce(
        (acc, d) => acc + d.amount,
        0,
      );
      let finalGross = totalDeposited;
      let finalDateStr = "N/A";
      let startDateStr = "N/A";

      if (fund.deposits && fund.deposits.length > 0) {
        const sortedDeps = [...fund.deposits].sort(
          (a, b) => new Date(a.date) - new Date(b.date),
        );
        const sd = new Date(sortedDeps[0].date);
        sd.setMinutes(sd.getMinutes() + sd.getTimezoneOffset());
        startDateStr = `${String(sd.getDate()).padStart(2, "0")}/${String(sd.getMonth() + 1).padStart(2, "0")}/${String(sd.getFullYear()).slice(-2)}`;
      }

      if (fund.balanceLogs && fund.balanceLogs.length > 0) {
        const sortedLogs = [...fund.balanceLogs].sort(
          (a, b) => new Date(b.date) - new Date(a.date),
        );
        finalGross =
          fund.closeAmount !== undefined
            ? fund.closeAmount
            : sortedLogs[0].amount;
        const dateToUse = fund.closeDate
          ? fund.closeDate
          : sortedLogs[0].date;
        const d = new Date(dateToUse);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        finalDateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
      }

      const ir = fund.irAmount || 0;
      const finalNet = Math.max(finalGross - ir, 0);
      const totalWithdrawn = (fund.withdrawals || []).reduce(
        (acc, w) => acc + w.amount,
        0,
      );

      const allOut = finalNet + totalWithdrawn;
      const realProfitNet = allOut - totalDeposited;
      totalLiquidProfit += realProfitNet;

      const profitPercentageNet =
        totalDeposited > 0 ? (realProfitNet / totalDeposited) * 100 : 0;
      const profitClass = realProfitNet >= 0 ? "text-green" : "text-red";
      const icon = fund.isCofrinho ? "🐷" : "🏁";
      const titleText = `${icon} ${fund.name}`;

      if (searchTerm && !titleText.toLowerCase().includes(searchTerm))
        return;

      const card = document.createElement("div");
      card.className = "invest-card";
      card.style.opacity = "0.9";
      card.style.cursor = "pointer";
      card.onclick = () => openFinishedActionPopup(fund.id);
      card.innerHTML = `
                    <div class="invest-header" style="cursor: pointer;">
                        <div class="invest-header-top">
                            <span class="invest-title" style="color:#58a6ff;">${escapeBankHtml(titleText)}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: #8b949e; line-height: 1.6; margin-top: 4px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Período:</span> <b>${startDateStr} a ${finalDateStr}</b>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Aporte Total:</span> <b>${formatCurrency(totalDeposited)}</b>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Saque Total:</span> <b>${formatCurrency(allOut)}</b>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #30363d;">
                                <span>Lucro: <span class="${profitClass}" style="font-weight:700;">${realProfitNet >= 0 ? "+" : ""}${formatCurrency(realProfitNet)} (${realProfitNet >= 0 ? "+" : ""}${profitPercentageNet.toFixed(2)}%)</span></span>
                                <span style="color:#f85149; font-weight:700;">IR: -${formatCurrency(ir)}</span>
                            </div>
                        </div>
                    </div>
                `;
      finishedContainer.appendChild(card);
    });
  }

  const profitValEl = document.getElementById("finishedTotalProfitVal");
  if (profitValEl) {
    profitValEl.innerText = formatCurrency(totalLiquidProfit);
    profitValEl.style.color =
      totalLiquidProfit >= 0 ? "#3fb950" : "#f85149";
  }

  const globalRealProfit = globalTotalBalance - globalTotalDeposited;
  const globalProfitPct =
    globalTotalDeposited > 0
      ? (globalRealProfit / globalTotalDeposited) * 100
      : 0;
  const globalProjPct =
    globalTotalBalance > 0
      ? (globalProjectedProfitSum / globalTotalBalance) * 100
      : 0;

  document.getElementById("invTotalBalance").innerText =
    formatCurrency(globalTotalBalance);
  document.getElementById("invTotalDeposited").innerText =
    formatCurrency(globalTotalDeposited);

  const profitEl = document.getElementById("invRealProfit");
  profitEl.innerText = `${formatCurrency(globalRealProfit)} (${globalRealProfit >= 0 ? "+" : ""}${globalProfitPct.toFixed(2)}%)`;
  profitEl.className = `history-metric-val ${globalRealProfit >= 0 ? "text-green" : "text-red"}`;

  const histProfitEl = document.getElementById("invHistoryProfit");
  histProfitEl.innerText = formatCurrency(totalLiquidProfit);
  histProfitEl.className = `history-metric-val ${totalLiquidProfit >= 0 ? "text-green" : "text-red"}`;

  const totalLifeProfit = globalRealProfit + totalLiquidProfit;
  const totalLifeEl = document.getElementById("invTotalLifeProfit");
  totalLifeEl.innerText = formatCurrency(totalLifeProfit);
  totalLifeEl.className = `history-metric-val ${totalLifeProfit >= 0 ? "text-blue" : "text-red"}`;

  const globalProjSign = globalProjectedProfitSum >= 0 ? "+" : "";
  const projEl = document.getElementById("invGlobalProjection");
  projEl.innerText = `${globalProjSign}${formatCurrency(globalProjectedProfitSum)} (${globalProjSign}${globalProjPct.toFixed(2)}%)`;
  projEl.style.color =
    globalProjectedProfitSum >= 0 ? "#3fb950" : "#f85149";
}

function createCardHtml(fund) {
  if (fund.isCofrinho) {
    const totalDeposited = (fund.deposits || []).reduce(
      (acc, d) => acc + d.amount,
      0,
    );
    const totalWithdrawn = (fund.withdrawals || []).reduce(
      (acc, w) => acc + w.amount,
      0,
    );
    const yieldPct =
      totalDeposited > 0 ? (totalWithdrawn / totalDeposited) * 100 : 0;

    let startDateStr = "N/A";
    let monthsElapsed = 1;
    if (fund.deposits && fund.deposits.length > 0) {
      const sortedDeps = [...fund.deposits].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      startDateStr = isoToBrDate(sortedDeps[0].date);
      const diffTime = new Date() - new Date(sortedDeps[0].date);
      const days = Math.max(
        Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
        1,
      );
      monthsElapsed = Math.max(days / 30.416, 1);
    }
    const avgYieldMonthly = yieldPct / monthsElapsed;

    return `
                <div class="invest-header" onclick="openInvestActionPopup('${fund.id}')" style="cursor: pointer;">
                    <div class="invest-header-top">
                        <span class="invest-title" style="font-size: 1rem; font-weight: 700; color: #58a6ff;">
                            ${escapeBankHtml(fund.name)}
                        </span>
                    </div>
                    
                    <div style="margin: 10px 0; display: flex; justify-content: space-between; align-items: center; background: #161b22; padding: 8px 12px; border-radius: 8px; border: 1px solid #21262d;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.65rem; color: #8b949e; text-transform: uppercase;">Saldo Base (Imobilizado)</span>
                            <span style="font-size: 1rem; font-weight: 700; color: #f0f6fc;">${formatCurrency(totalDeposited)}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="font-size: 0.65rem; color: #8b949e; text-transform: uppercase;">Saques Realizados</span>
                            <span style="font-size: 1rem; font-weight: 700; color: #3fb950;">${formatCurrency(totalWithdrawn)}</span>
                        </div>
                    </div>

                    <div class="invest-metrics">
                        <div class="invest-metric-box">
                            <span class="invest-metric-label">Início</span>
                            <span class="invest-metric-val text-neutral" style="font-size: 0.75rem;">${startDateStr}</span>
                        </div>
                        <div class="invest-metric-box">
                            <span class="invest-metric-label">Lucro Total</span>
                            <span class="invest-metric-val text-green">+${yieldPct.toFixed(2)}%</span>
                        </div>
                        <div class="invest-metric-box">
                            <span class="invest-metric-label">Média Mensal</span>
                            <span class="invest-metric-val text-blue">+${avgYieldMonthly.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            `;
  }

  const stats = getFundStats(fund);
  const latestBalance = stats.balance;
  const proj = stats.projection;
  const profitClass = stats.profit >= 0 ? "text-green" : "text-red";
  const profitSign = stats.profit >= 0 ? "+" : "";
  const projClass = proj.profitAmount >= 0 ? "text-green" : "text-red";
  const projSign = proj.profitAmount >= 0 ? "+" : "";

  return `
            <div class="invest-header" onclick="openInvestActionPopup('${fund.id}')" style="cursor: pointer;">
                <div class="invest-header-top">
                    <span class="invest-title" style="font-size: 1rem; font-weight: 700; color: #58a6ff;">
                        ${escapeBankHtml(fund.name)}
                    </span>
                </div>
                <div class="invest-metrics" style="margin-top: 8px;">
                    <div class="invest-metric-box">
                        <span class="invest-metric-label">Saldo Atual</span>
                        <span class="invest-metric-val text-neutral">${formatCurrency(latestBalance)}</span>
                    </div>
                    <div class="invest-metric-box">
                        <span class="invest-metric-label">Investido</span>
                        <span class="invest-metric-val text-neutral" style="font-size:0.78rem; opacity:0.8;">${formatCurrency(stats.netInvested)}</span>
                    </div>
                    <div class="invest-metric-box">
                        <span class="invest-metric-label">Rendimento</span>
                        <span class="invest-metric-val ${profitClass}">${profitSign}${formatCurrency(stats.profit)}</span>
                        <span class="${profitClass}" style="font-size:0.7rem;">${profitSign}${stats.profitPct.toFixed(2)}%</span>
                    </div>
                </div>
                <div style="margin-top: 8px; font-size: 0.75rem; background: rgba(88, 166, 255, 0.08); padding: 5px 8px; border-radius: 6px;">
                    🚀 Projeção 12 meses <b class="${projClass}">${projSign}${formatCurrency(proj.profitAmount)} (${projSign}${proj.projectedPct.toFixed(2)}%)</b>
                </div>
            </div>
        `;
}

function openInvestActionPopup(fundId) {
  const fund = db.investmentFunds.find(
    (f) => String(f.id) === String(fundId),
  );
  if (!fund) return;

  document.getElementById("popupFundIdInput").value = fund.id;
  const titleEl = document.getElementById("popupFundTitle");
  if (titleEl) titleEl.innerText = fund.name;

  const headerInvest = document.getElementById("popupHeaderInvest");
  const headerCofrinho = document.getElementById("popupHeaderCofrinho");
  const normalActions = document.getElementById(
    "popupNormalInvestActions",
  );
  const withdrawAccordion = document.getElementById("accWithdraw");
  const historyAccHeader = document.querySelector(
    "#accHistory .invest-action-header span:first-child",
  );

  if (fund.isCofrinho) {
    if (headerInvest) headerInvest.style.display = "none";
    if (headerCofrinho) headerCofrinho.style.display = "flex";
    if (normalActions) normalActions.style.display = "none";
    if (historyAccHeader)
      historyAccHeader.innerText = "📜 Histórico de Saques";

    if (withdrawAccordion) {
      withdrawAccordion.style.display = "block";
      withdrawAccordion.className = "invest-action-accordion expanded";
      withdrawAccordion.style.border = "none";
      withdrawAccordion.style.background = "transparent";
      withdrawAccordion.style.marginBottom = "0";

      const accHeader = withdrawAccordion.querySelector(
        ".invest-action-header",
      );
      if (accHeader) accHeader.style.display = "none";

      const accBody = withdrawAccordion.querySelector(
        ".invest-action-body",
      );
      if (accBody) accBody.style.padding = "0";

      const btn = document.getElementById("popupWithdrawBtn");
      if (btn) {
        btn.innerText = "💸 Efetuar Saque";
        btn.style.background = "#238636";
        btn.style.color = "#fff";
        btn.style.borderColor = "#2ea043";
      }
    }

    const totalDeposited = (fund.deposits || []).reduce(
      (acc, d) => acc + d.amount,
      0,
    );
    const totalWithdrawn = (fund.withdrawals || []).reduce(
      (acc, w) => acc + w.amount,
      0,
    );
    document.getElementById("popupHeaderCofrinhoBase").innerText =
      formatCurrency(totalDeposited);
    document.getElementById("popupHeaderCofrinhoWithdrawn").innerText =
      formatCurrency(totalWithdrawn);
  } else {
    if (headerInvest) headerInvest.style.display = "flex";
    if (headerCofrinho) headerCofrinho.style.display = "none";
    if (normalActions) normalActions.style.display = "block";
    if (historyAccHeader)
      historyAccHeader.innerText = "📜 Histórico de Lançamentos";

    if (withdrawAccordion) {
      withdrawAccordion.style.display = "block";
      withdrawAccordion.className = "invest-action-accordion";
      withdrawAccordion.style.border = "1px solid #21262d";
      withdrawAccordion.style.background = "#0d1117";
      withdrawAccordion.style.marginBottom = "0.8rem";

      const accHeader = withdrawAccordion.querySelector(
        ".invest-action-header",
      );
      if (accHeader) {
        accHeader.style.display = "flex";
        accHeader.innerHTML =
          '<span style="color: #f0f6fc;">🪙 Retirar Saldo</span><span class="invest-action-arrow">▼</span>';
      }

      const accBody = withdrawAccordion.querySelector(
        ".invest-action-body",
      );
      if (accBody) accBody.style.padding = "0 1rem 1rem 1rem";

      const btn = document.getElementById("popupWithdrawBtn");
      if (btn) {
        btn.innerText = "Efetuar Retirada";
        btn.style.background = "#21262d";
        btn.style.borderColor = "#d29922";
        btn.style.color = "#d29922";
      }
    }

    const totalDeposited = (fund.deposits || []).reduce(
      (acc, d) => acc + d.amount,
      0,
    );
    let startDateStr = "N/A";
    if (fund.deposits && fund.deposits.length > 0) {
      const sortedDeps = [...fund.deposits].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      startDateStr = isoToBrDate(sortedDeps[0].date);
    }
    document.getElementById("popupHeaderDeposited").innerText =
      formatCurrency(totalDeposited);
    document.getElementById("popupHeaderStartDate").innerText =
      startDateStr;
  }

  document.getElementById("popupBalDate").value = getTodayIsoDateStr();
  document.getElementById("popupBalAmount").value = "";
  document.getElementById("popupDepDate").value = getTodayIsoDateStr();
  document.getElementById("popupDepAmount").value = "";
  document.getElementById("popupWithdrawDate").value =
    getTodayIsoDateStr();
  document.getElementById("popupWithdrawAmount").value = "";

  ["accUpdateBal", "accNewDep", "accHistory"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("expanded");
  });

  if (!fund.isCofrinho) {
    document.getElementById("accWithdraw")?.classList.remove("expanded");
  } else {
    document.getElementById("accHistory")?.classList.add("expanded");
  }

  const historyList = document.getElementById("popupHistoryLogsList");
  historyList.innerHTML = "";

  const allLogs = fund.isCofrinho
    ? [
      ...(fund.deposits || []).map((d) => ({
        type: "aporte",
        id: d.id,
        date: d.date,
        amount: d.amount,
      })),
      ...(fund.withdrawals || []).map((w) => ({
        type: "saque",
        id: w.id,
        date: w.date,
        amount: w.amount,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [
      ...(fund.deposits || []).map((d) => ({
        type: "aporte",
        id: d.id,
        date: d.date,
        amount: d.amount,
      })),
      ...(fund.balanceLogs || [])
        .filter((b) => !b.isSystem)
        .map((b) => ({
          type: "saldo",
          id: b.id,
          date: b.date,
          amount: b.amount,
        })),
      ...(fund.withdrawals || []).map((w) => ({
        type: "resgate",
        id: w.id,
        date: w.date,
        amount: w.amount,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allLogs.length === 0) {
    historyList.innerHTML =
      '<div style="font-size:0.75rem; color:#8b949e; text-align:center; padding:10px;">Nenhum lançamento registrado.</div>';
  } else {
    allLogs.forEach((log) => {
      let logIcon = "🔄",
        label = "Saldo",
        color = "#d29922",
        sign = "";
      if (log.type === "aporte") {
        logIcon = "➕";
        label = fund.isCofrinho ? "Base" : "Aporte";
        color = "#58a6ff";
        sign = "+";
      } else if (log.type === "saque") {
        logIcon = "🪙";
        label = "Saque";
        color = "#3fb950";
        sign = "+";
      } else if (log.type === "resgate") {
        logIcon = "🪙";
        label = "Retirada";
        color = "#ff7b72";
        sign = "-";
      }

      const item = document.createElement("div");
      item.className = "log-item";
      item.innerHTML = `
                    <span>${logIcon} ${label} • ${isoToBrDate(log.date)}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-weight:700; color: ${color};">${sign}${formatCurrency(log.amount)}</span>
                        <button class="action-icon-btn delete" onclick="deleteInvestLogFromPopup('${fund.id}', '${log.id}', '${log.type}')" title="Apagar">🗑️</button>
                    </div>
                `;
      historyList.appendChild(item);
    });
  }

  document.getElementById("investActionPopup").classList.add("active");
}

function openEditFundNameModalFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  document.getElementById("investActionPopup").classList.remove("active");
  openEditFundNameModal(fund.id, fund.name);
}

function toggleInvestActionAcc(accId) {
  const acc = document.getElementById(accId);
  if (acc) acc.classList.toggle("expanded");
}

function submitPopupBalance() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date =
    document.getElementById("popupBalDate").value || getTodayIsoDateStr();
  // Campo vazio não é "saldo zero": sem essa trava, tocar no botão com o
  // campo em branco zerava o saldo do investimento.
  if (!document.getElementById("popupBalAmount").value.trim())
    return alert("Informe o saldo atual do investimento.");
  const amount = getMoney("popupBalAmount");
  if (amount >= 0) {
    if (!fund.balanceLogs) fund.balanceLogs = [];
    fund.balanceLogs.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    document
      .getElementById("investActionPopup")
      .classList.remove("active");
    renderInvestmentsScreen();
  }
}

function submitPopupDeposit() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date =
    document.getElementById("popupDepDate").value || getTodayIsoDateStr();
  const amount = getMoney("popupDepAmount");
  if (amount > 0) {
    if (!fund.deposits) fund.deposits = [];
    fund.deposits.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    document
      .getElementById("investActionPopup")
      .classList.remove("active");
    renderInvestmentsScreen();
  }
}

function submitPopupWithdraw() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date =
    document.getElementById("popupWithdrawDate").value || getTodayIsoDateStr();
  const amount = getMoney("popupWithdrawAmount");
  if (amount > 0) {
    // Nos investimentos, o saldo depois da retirada é derivado em getFundStats.
    if (!fund.withdrawals) fund.withdrawals = [];
    fund.withdrawals.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    document
      .getElementById("investActionPopup")
      .classList.remove("active");
    renderInvestmentsScreen();
  }
}

function deleteInvestLogFromPopup(fundId, logId, type) {
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  if (confirm("Deseja apagar este registro?")) {
    if (type === "aporte")
      fund.deposits = fund.deposits.filter((d) => String(d.id) !== String(logId));
    else if (type === "resgate" || type === "saque")
      fund.withdrawals = fund.withdrawals.filter((w) => String(w.id) !== String(logId));
    else
      fund.balanceLogs = fund.balanceLogs.filter((b) => String(b.id) !== String(logId));
    saveDatabase();
    openInvestActionPopup(fundId);
    renderInvestmentsScreen();
  }
}

function openFinishFundModalFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  document.getElementById("investActionPopup").classList.remove("active");
  openFinishFundModal(fundId);
}

function openTotalFinishFundModalFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  document.getElementById("investActionPopup").classList.remove("active");
  openFinishFundModal(fundId);
  const rescueSelect = document.getElementById("rescueTypeSelect");
  if (rescueSelect) {
    rescueSelect.value = "total";
    toggleRescueType();
  }
}

function deleteFundFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  document.getElementById("investActionPopup").classList.remove("active");
  deleteFund(fundId);
}

function toggleInvestCard(fundId) {
  const card = document.getElementById(`investCard-${fundId}`);
  if (card) card.classList.toggle("expanded");
}

function toggleCofrinhosView() {
  cofrinhosVisible = !cofrinhosVisible;
  document.getElementById("cofrinhosWrapper").style.display =
    cofrinhosVisible ? "block" : "none";
  document.getElementById("btnToggleCofrinhos").innerText =
    cofrinhosVisible ? "🐷 Ocultar Cofrinhos" : "🐷 Ver Cofrinhos";
}

function openCofrinhoHelpModal() {
  document.getElementById("cofrinhoHelpModal")?.classList.add("active");
}

function openInvestmentsHistoryModal() {
  const content = document.getElementById("investmentsHistoryContent");
  content.innerHTML = "";

  const funds = db.investmentFunds || [];
  const monthlyData = {};

  const parseIso = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  funds.forEach((fund) => {
    if (fund.isCofrinho) {
      const fundMonthly = {};
      (fund.withdrawals || []).forEach((w) => {
        if (!w.date) return;
        const mKey = w.date.slice(0, 7);
        if (!fundMonthly[mKey]) fundMonthly[mKey] = 0;
        fundMonthly[mKey] += w.amount;

        const depAtTime = (fund.deposits || [])
          .filter((d) => d.date <= w.date)
          .reduce((a, b) => a + b.amount, 0);
        if (!monthlyData[mKey])
          monthlyData[mKey] = {
            investYield: 0,
            investBase: 0,
            cofrinhoYield: 0,
            cofrinhoBase: 0,
            details: [],
          };
        monthlyData[mKey].cofrinhoYield += w.amount;
        monthlyData[mKey].cofrinhoBase = Math.max(
          monthlyData[mKey].cofrinhoBase,
          depAtTime,
        );
        monthlyData[mKey].details.push({
          name: `🐷 ${fund.name}`,
          yieldAmount: w.amount,
          baseAmount: depAtTime,
          isCofrinho: true,
        });
      });
    } else {
      let points = [];
      if (fund.deposits && fund.deposits.length > 0) {
        const firstDep = [...fund.deposits].sort(
          (a, b) => new Date(a.date) - new Date(b.date),
        )[0];
        points.push({
          date: firstDep.date,
          amount:
            sumAmounts(fund.deposits.filter((d) => d.date === firstDep.date)) -
            sumAmounts(
              (fund.withdrawals || []).filter((w) => w.date === firstDep.date),
            ),
          type: "init",
        });
      }
      if (fund.balanceLogs && fund.balanceLogs.length > 0) {
        fund.balanceLogs
          .filter((b) => !b.isSystem)
          .forEach((b) => {
            points.push({ date: b.date, amount: b.amount, type: "bal" });
          });
      }

      points.sort((a, b) => {
        const diff = new Date(a.date) - new Date(b.date);
        if (diff !== 0) return diff;
        return a.type === "init" ? -1 : 1;
      });

      let filteredPoints = [];
      points.forEach((p) => {
        if (
          filteredPoints.length === 0 ||
          filteredPoints[filteredPoints.length - 1].date !== p.date
        )
          filteredPoints.push(p);
        else filteredPoints[filteredPoints.length - 1] = p;
      });

      let lastDateIso = null;
      let lastBalance = 0;

      filteredPoints.forEach((pt) => {
        if (!lastDateIso) {
          lastDateIso = pt.date;
          lastBalance = pt.amount;
          return;
        }

        if (pt.date > lastDateIso) {
          const startD = parseIso(lastDateIso);
          const endD = parseIso(pt.date);
          const diffMs = endD - startD;

          if (diffMs > 0) {
            const totalDays = Math.round(
              (endD - startD) / (1000 * 60 * 60 * 24),
            );

            const depsInBetween = (fund.deposits || [])
              .filter((d) => d.date > lastDateIso && d.date <= pt.date)
              .reduce((a, b) => a + b.amount, 0);
            const withsInBetween = (fund.withdrawals || [])
              .filter((w) => w.date > lastDateIso && w.date <= pt.date)
              .reduce((a, b) => a + b.amount, 0);

            const expectedBalance =
              lastBalance + depsInBetween - withsInBetween;
            const yieldAmount = pt.amount - expectedBalance;
            const totalDepAtEnd =
              sumAmounts((fund.deposits || []).filter((d) => d.date <= pt.date)) -
              sumAmounts(
                (fund.withdrawals || []).filter((w) => w.date <= pt.date),
              );

            let tempDate = parseIso(lastDateIso);
            while (tempDate < endD) {
              const year = tempDate.getFullYear();
              const month = tempDate.getMonth();
              const mKey = `${year}-${String(month + 1).padStart(2, "0")}`;

              const nextMonthStart = new Date(year, month + 1, 1);
              const segmentEnd =
                endD < nextMonthStart ? endD : nextMonthStart;

              const daysInMonth = Math.round(
                (segmentEnd - tempDate) / (1000 * 60 * 60 * 24),
              );
              const ratio = daysInMonth / totalDays;
              const monthPortion = yieldAmount * ratio;

              if (!monthlyData[mKey])
                monthlyData[mKey] = {
                  investYield: 0,
                  investBase: 0,
                  cofrinhoYield: 0,
                  cofrinhoBase: 0,
                  details: [],
                };
              monthlyData[mKey].investYield += monthPortion;
              monthlyData[mKey].investBase = Math.max(
                monthlyData[mKey].investBase,
                totalDepAtEnd,
              );
              monthlyData[mKey].details.push({
                name: `📈 ${fund.name}`,
                yieldAmount: monthPortion,
                baseAmount: totalDepAtEnd,
                isCofrinho: false,
              });

              tempDate = nextMonthStart;
            }
          }
          lastDateIso = pt.date;
          lastBalance = pt.amount;
        }
      });
    }
  });

  let totalInvestBase = 0;
  let totalCofrinhoBase = 0;
  funds.forEach((f) => {
    const dep = (f.deposits || []).reduce((a, b) => a + b.amount, 0);
    if (f.isCofrinho) totalCofrinhoBase += dep;
    else totalInvestBase += dep;
  });

  const sortedKeys = Object.keys(monthlyData).sort((a, b) =>
    b.localeCompare(a),
  );
  if (sortedKeys.length === 0) {
    content.innerHTML =
      '<div class="empty-state">Nenhum rendimento registrado até o momento.</div>';
  } else {
    sortedKeys.forEach((mKey) => {
      const [y, m] = mKey.split("-");
      const mName = formatMonthYearLabel(y, parseInt(m, 10) - 1);
      const data = monthlyData[mKey];

      const invPct =
        data.investBase > 0
          ? (data.investYield / data.investBase) * 100
          : 0;
      const cofPct =
        data.cofrinhoBase > 0
          ? (data.cofrinhoYield / data.cofrinhoBase) * 100
          : 0;

      const invPctStr =
        data.investBase > 0
          ? ` <span style="font-size: 0.75rem; opacity: 0.85;">(${data.investYield >= 0 ? "+" : ""}${invPct.toFixed(2).replace(".", ",")}%)</span>`
          : "";
      const cofPctStr =
        data.cofrinhoBase > 0
          ? ` <span style="font-size: 0.75rem; opacity: 0.85;">(${data.cofrinhoYield >= 0 ? "+" : ""}${cofPct.toFixed(2).replace(".", ",")}%)</span>`
          : "";

      const el = document.createElement("div");
      el.style.background = "#0d1117";
      el.style.border = "1px solid #21262d";
      el.style.borderRadius = "10px";
      el.style.padding = "10px";
      el.innerHTML = `
                    <div style="font-weight:700; color:#58a6ff; font-size:0.9rem; margin-bottom:6px; border-bottom:1px solid #21262d; padding-bottom:4px;">${mName}</div>
                    <div style="font-size:0.8rem; line-height:1.6;">
                        ${data.investBase > 0 ? `<div style="display:flex; justify-content:space-between;"><span>📈 Lucro Longo Prazo:</span> <b class="${data.investYield >= 0 ? "text-green" : "text-red"}">${data.investYield >= 0 ? "+" : ""}${formatCurrency(data.investYield)}${invPctStr}</b></div>` : ""}
                        ${data.cofrinhoBase > 0 ? `<div style="display:flex; justify-content:space-between;"><span>🐷 Saques Cofrinho:</span> <b class="text-green">+${formatCurrency(data.cofrinhoYield)}${cofPctStr}</b></div>` : ""}
                        <div style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed #30363d; font-weight:700;">
                            <span>Total do Mês:</span>
                            <span style="color:#58a6ff;">+${formatCurrency(data.investYield + data.cofrinhoYield)}</span>
                        </div>
                    </div>
                `;
      content.appendChild(el);
    });
  }

  document
    .getElementById("investmentsHistoryModal")
    .classList.add("active");
}

function openNewFundModal(isCofrinho = false) {
  document.getElementById("fundIsCofrinhoValue").value = isCofrinho
    ? "true"
    : "false";
  document.getElementById("newFundModalTitle").innerText = isCofrinho
    ? "🐷 Novo Cofrinho (Giro Rápido)"
    : "📈 Novo Card de Investimento";
  document.getElementById("fundNameInput").value = "";
  document.getElementById("fundInitialAmountInput").value = "";
  document.getElementById("fundInitialDateInput").value =
    getTodayIsoDateStr();
  document.getElementById("newFundModal").classList.add("active");
}

function openEditFundNameModal(fundId, currentName) {
  document.getElementById("editFundNameId").value = fundId;
  document.getElementById("editFundNameInput").value = currentName;
  document.getElementById("editFundNameModal").classList.add("active");
  setTimeout(
    () => document.getElementById("editFundNameInput").focus(),
    100,
  );
}

function saveFundName() {
  const fundId = document.getElementById("editFundNameId").value;
  const newName = document
    .getElementById("editFundNameInput")
    .value.trim();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (fund && newName) {
    fund.name = newName;
    saveDatabase();
    document
      .getElementById("editFundNameModal")
      .classList.remove("active");
  }
}

function addFundDeposit(fundId) {
  event?.stopPropagation();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date = document.getElementById(`depDate-${fundId}`).value;
  const amount = getMoney(`depAmount-${fundId}`);
  if (amount > 0) {
    if (!fund.deposits) fund.deposits = [];
    fund.deposits.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    renderInvestmentsScreen();
    setTimeout(() => toggleInvestCard(fundId), 50);
  }
}

function addFundBalanceLog(fundId) {
  event?.stopPropagation();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date = document.getElementById(`balDate-${fundId}`).value;
  const amount = getMoney(`balAmount-${fundId}`);
  if (amount >= 0) {
    if (!fund.balanceLogs) fund.balanceLogs = [];
    fund.balanceLogs.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    renderInvestmentsScreen();
    setTimeout(() => toggleInvestCard(fundId), 50);
  }
}

function deleteInvestLog(fundId, logId, type) {
  event?.stopPropagation();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  if (confirm("Deseja apagar este registro?")) {
    if (type === "aporte")
      fund.deposits = fund.deposits.filter((d) => String(d.id) !== String(logId));
    else if (type === "resgate" || type === "saque")
      fund.withdrawals = fund.withdrawals.filter((w) => String(w.id) !== String(logId));
    else
      fund.balanceLogs = fund.balanceLogs.filter((b) => String(b.id) !== String(logId));
    saveDatabase();
    renderInvestmentsScreen();
    setTimeout(() => toggleInvestCard(fundId), 50);
  }
}

function addCofrinhoWithdrawal(fundId) {
  event?.stopPropagation();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date = document.getElementById(`saqueDate-${fundId}`).value;
  const amount = getMoney(`saqueAmount-${fundId}`);
  if (amount > 0) {
    if (!fund.withdrawals) fund.withdrawals = [];
    fund.withdrawals.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    renderInvestmentsScreen();
    setTimeout(() => toggleInvestCard(fundId), 50);
  }
}

function deleteCofrinhoWithdrawal(fundId, withdrawalId) {
  event?.stopPropagation();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  if (confirm("Deseja apagar este saque?")) {
    fund.withdrawals = fund.withdrawals.filter(
      (w) => String(w.id) !== String(withdrawalId),
    );
    saveDatabase();
    renderInvestmentsScreen();
    setTimeout(() => toggleInvestCard(fundId), 50);
  }
}

function openFinishFundModal(fundId) {
  const fund = db.investmentFunds.find(
    (f) => String(f.id) === String(fundId),
  );
  if (!fund) return;

  const stats = getFundStats(fund);
  const latestBalance = stats.balance;
  const realProfit = Math.max(stats.profit, 0);
  const estimatedIr = realProfit * 0.15;

  document.getElementById("finishFundIdInput").value = fund.id;
  const nameDisplay = document.getElementById("finishFundNameDisplay");
  if (nameDisplay) nameDisplay.innerText = fund.name;
  const profitAlert = document.getElementById("availableProfitAlert");
  if (profitAlert)
    profitAlert.innerText = `Lucro disponível: ${formatCurrency(realProfit)}`;

  document.getElementById("rescueTypeSelect").value = "partial";
  toggleRescueType();

  document.getElementById("finishGrossAmount").value =
    formatMoneyInput(latestBalance);
  document.getElementById("finishIrAmount").value =
    formatMoneyInput(estimatedIr);
  document.getElementById("finishDateInput").value = getTodayIsoDateStr();
  document.getElementById("rescueAmountInput").value = "";

  updateFinishNetPreview();
  document.getElementById("finishFundModal").classList.add("active");
}

function toggleRescueType() {
  const type = document.getElementById("rescueTypeSelect").value;
  const partialBox =
    document.getElementById("partialRescueSection") ||
    document.getElementById("rescuePartialBox");
  const totalBox =
    document.getElementById("totalRescueSection") ||
    document.getElementById("rescueTotalBox");
  if (partialBox && totalBox) {
    if (type === "partial") {
      partialBox.style.display = "block";
      totalBox.style.display = "none";
    } else {
      partialBox.style.display = "none";
      totalBox.style.display = "block";
    }
  }
  updateFinishNetPreview();
}

function updateFinishNetPreview() {
  const gross = getMoney("finishGrossAmount");
  const ir = getMoney("finishIrAmount");
  const net = Math.max(gross - ir, 0);
  document.getElementById("finishNetPreview").innerText =
    `Valor Líquido no Bolso: ${formatCurrency(net)}`;
}

function confirmFinishFund() {
  const fundId = document.getElementById("finishFundIdInput").value;
  const rescueType = document.getElementById("rescueTypeSelect").value;
  const rescueDate =
    document.getElementById("finishDateInput").value ||
    getTodayIsoDateStr();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;

  if (rescueType === "partial") {
    const withdrawAmount = getMoney("rescueAmountInput");
    if (withdrawAmount <= 0)
      return alert("Informe um valor de resgate válido!");

    // O saldo depois da retirada é derivado em getFundStats.
    if (!fund.withdrawals) fund.withdrawals = [];
    fund.withdrawals.push({
      id: Date.now().toString(),
      date: rescueDate,
      amount: withdrawAmount,
    });

    saveDatabase();
    document.getElementById("finishFundModal").classList.remove("active");
  } else {
    const finalGrossAmount = getMoney("finishGrossAmount");
    const irAmount = getMoney("finishIrAmount");
    fund.isFinished = true;
    fund.closeAmount = finalGrossAmount;
    fund.closeDate = rescueDate;
    fund.irAmount = irAmount;

    if (!fund.balanceLogs) fund.balanceLogs = [];
    fund.balanceLogs.push({
      id: Date.now().toString(),
      date: rescueDate,
      amount: finalGrossAmount,
      isSystem: true,
    });

    saveDatabase();
    document.getElementById("finishFundModal").classList.remove("active");
  }
}

function toggleFinishFund(fundId) {
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  fund.isFinished = !fund.isFinished;
  saveDatabase();
  renderInvestmentsScreen();
}

function deleteFund(fundId) {
  if (confirm("Tem certeza que deseja apagar este investimento?")) {
    db.investmentFunds = db.investmentFunds.filter(
      (f) => String(f.id) !== String(fundId),
    );
    saveDatabase();
    renderInvestmentsScreen();
  }
}

function openPatrimonyChart() {
  chartVisibleAssets.clear();
  switchView("patrimonyChart");
  switchChartTab("past");
}

function renderPatrimonyChart(period) {
  const ctx = document
    .getElementById("patrimonyChartCanvas")
    .getContext("2d");
  const lineColors = [
    "#58a6ff",
    "#3fb950",
    "#d29922",
    "#ff7b72",
    "#bc8cff",
    "#7ee787",
    "#ffb6c1",
    "#00ced1",
  ];
  const activeFunds = (db.investmentFunds || []).filter(
    (f) => !f.isFinished,
  );

  let countPoints = 3;
  if (period === "6m") countPoints = 6;
  else if (period === "1y") countPoints = 12;

  let labels = [];
  const now = new Date();
  const shortMonths = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  if (chartAlignMode) {
    for (let i = 0; i < countPoints; i++) {
      labels.push(i === 0 ? "Mês 0 (Início)" : `Mês ${i}`);
    }
  } else {
    for (let i = countPoints - 1; i >= 0; i--) {
      let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (i === 0) {
        labels.push("Atual");
      } else {
        labels.push(
          `${shortMonths[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
        );
      }
    }
  }

  const datasets = [];
  const assetListEl = document.getElementById("assetColorList");
  assetListEl.innerHTML = "";

  activeFunds.forEach((fund, index) => {
    const color = lineColors[index % lineColors.length];
    const isCofrinho = fund.isCofrinho;
    const isDisabledInMode = isCofrinho && chartMode === "brl";
    const disabledAttr = isDisabledInMode ? "disabled" : "";
    const opacityStyle = isDisabledInMode ? "opacity: 0.5;" : "";

    const li = document.createElement("li");
    li.style.cssText = opacityStyle;
    li.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; cursor:${isDisabledInMode ? "not-allowed" : "pointer"};">
                    <input type="checkbox" ${!chartVisibleAssets.has(String(fund.id)) && !isDisabledInMode ? "checked" : ""} ${disabledAttr} onchange="toggleChartAsset('${fund.id}')">
                    <span style="display:inline-block; width:12px; height:12px; background-color:${color}; border-radius:50%;"></span>
                    <span>${isCofrinho ? "🐷 " : "📈 "}${escapeBankHtml(fund.name)} ${isDisabledInMode ? "(Apenas %)" : ""}</span>
                </label>
            `;
    assetListEl.appendChild(li);

    if (chartVisibleAssets.has(String(fund.id)) || isDisabledInMode) return;

    let totalDep = sumAmounts(fund.deposits);
    let latestBal = totalDep;
    let dailyRate = 0;
    let firstDate = new Date();
    const sortedDeposits = [...(fund.deposits || [])].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    if (sortedDeposits.length > 0)
      firstDate = new Date(sortedDeposits[0].date);

    if (isCofrinho) {
      latestBal = totalDep + sumAmounts(fund.withdrawals);
      const daysInvested = Math.max(
        Math.ceil((new Date() - firstDate) / DAY_MS),
        1,
      );
      if (totalDep > 0 && latestBal > 0) {
        dailyRate = Math.pow(latestBal / totalDep, 1 / daysInvested) - 1;
      }
    } else {
      const stats = getFundStats(fund);
      totalDep = stats.netInvested;
      latestBal = stats.balance;
      dailyRate = stats.dailyRate;
    }

    const startYearMonth =
      firstDate.getFullYear() * 12 + firstDate.getMonth();
    const currentNow = new Date();

    const rawPoints = [];
    for (let i = countPoints - 1; i >= 0; i--) {
      const pointDate = new Date(
        currentNow.getFullYear(),
        currentNow.getMonth() - i,
        1,
      );
      const pointYearMonth =
        pointDate.getFullYear() * 12 + pointDate.getMonth();

      if (pointYearMonth < startYearMonth) {
        rawPoints.push(null);
        continue;
      }

      const daysBack = i * 30.416;
      let val = totalDep;
      if (i === 0) {
        val = latestBal;
      } else {
        val = latestBal / Math.pow(1 + dailyRate, daysBack);
        if (latestBal >= totalDep && val < totalDep) {
          val = totalDep;
        }
      }

      if (chartMode === "pct") {
        const pctGrowth =
          totalDep > 0 ? ((val - totalDep) / totalDep) * 100 : 0;
        rawPoints.push(pctGrowth);
      } else {
        rawPoints.push(val);
      }
    }

    const dataPoints = [];
    if (chartAlignMode) {
      const filteredValidPoints = rawPoints.filter((val) => val !== null);
      const baseOffset =
        filteredValidPoints.length > 0 ? filteredValidPoints[0] : 0;

      filteredValidPoints.forEach((val) => {
        dataPoints.push((val - baseOffset).toFixed(2));
      });

      while (dataPoints.length < countPoints) {
        dataPoints.push(null);
      }
    } else {
      rawPoints.forEach((val) => {
        dataPoints.push(val === null ? null : val.toFixed(2));
      });
    }

    datasets.push({
      label: fund.name,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 3,
    });
  });

  if (patrimonyChartInstance) patrimonyChartInstance.destroy();

  patrimonyChartInstance = new Chart(ctx, {
    type: "line",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "#21262d" }, ticks: { color: "#8b949e" } },
        y: {
          grid: { color: "#21262d" },
          ticks: {
            color: "#8b949e",
            callback: function (value) {
              return chartMode === "pct" ? value + "%" : "R$ " + value;
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) label += ": ";
              if (chartMode === "pct") label += context.parsed.y + "%";
              else label += formatCurrency(context.parsed.y);
              return label;
            },
          },
        },
      },
    },
  });
}

function renderProjectionChart(period) {
  const ctx = document
    .getElementById("projectionChartCanvas")
    .getContext("2d");
  const activeFunds = (db.investmentFunds || []).filter(
    (f) => !f.isFinished,
  );

  let totalCurrentBal = 0;
  let weightedDailyRateSum = 0;

  activeFunds.forEach((fund) => {
    let latestBal;
    let dailyRate = 0;

    if (fund.isCofrinho) {
      const totalDeposited = sumAmounts(fund.deposits);
      latestBal = totalDeposited + sumAmounts(fund.withdrawals);
      const sortedDeposits = [...(fund.deposits || [])].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      if (sortedDeposits.length > 0) {
        const firstDate = new Date(sortedDeposits[0].date);
        const daysInvested = Math.max(
          Math.ceil((new Date() - firstDate) / DAY_MS),
          1,
        );
        if (totalDeposited > 0 && latestBal > 0) {
          dailyRate =
            Math.pow(latestBal / totalDeposited, 1 / daysInvested) - 1;
        }
      }
    } else {
      const stats = getFundStats(fund);
      latestBal = stats.balance;
      dailyRate = stats.dailyRate;
    }

    totalCurrentBal += latestBal;
    weightedDailyRateSum += dailyRate * latestBal;
  });

  const globalDailyRate =
    totalCurrentBal > 0 ? weightedDailyRateSum / totalCurrentBal : 0;

  let months = 12;
  if (period === "6m") months = 6;
  else if (period === "1y") months = 12;
  else if (period === "5y") months = 60;

  let labels = [];
  let dataPoints = [];
  const currentDate = new Date();
  const shortMonths = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  for (let i = 0; i <= months; i++) {
    let futureDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + i,
      1,
    );
    labels.push(
      `${shortMonths[futureDate.getMonth()]}/${String(futureDate.getFullYear()).slice(-2)}`,
    );

    let daysInFuture = i * 30.416;
    let projected =
      totalCurrentBal * Math.pow(1 + globalDailyRate, daysInFuture);
    dataPoints.push(projected.toFixed(2));
  }

  if (projectionChartInstance) projectionChartInstance.destroy();

  projectionChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Patrimônio Projetado",
          data: dataPoints,
          borderColor: "#3fb950",
          backgroundColor: "rgba(63, 185, 80, 0.1)",
          borderWidth: 3,
          fill: true,
          pointRadius: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "#21262d" }, ticks: { color: "#8b949e" } },
        y: {
          grid: { color: "#21262d" },
          ticks: {
            color: "#8b949e",
            callback: function (value) {
              return "R$ " + value;
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return "Projetado: " + formatCurrency(context.parsed.y);
            },
          },
        },
      },
    },
  });

  const finalVal = dataPoints[dataPoints.length - 1];
  const profit = finalVal - totalCurrentBal;
  const profitPct =
    totalCurrentBal > 0 ? (profit / totalCurrentBal) * 100 : 0;
  const yearsStr =
    months >= 12
      ? months / 12 + (months === 12 ? " ano" : " anos")
      : months + " meses";

  document.getElementById("projectionSummaryBox").innerHTML = `
            <div style="font-size: 0.8rem; color: #8b949e; text-transform: uppercase;">Projeção para ${yearsStr}</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #3fb950; margin: 4px 0;">${formatCurrency(parseFloat(finalVal))}</div>
            <div style="font-size: 0.85rem; color: #58a6ff;">Lucro estimado: +${formatCurrency(profit)} (+${profitPct.toFixed(2)}%)</div>
        `;
}

/* NAVEGAÇÃO ENTRE AS TELAS DO MÓDULO */
function switchView(viewName) {
  document
    .querySelectorAll(".app-view")
    .forEach((view) => view.classList.remove("active"));

  const viewMap = {
    investments: "viewInvestments",
    patrimonyChart: "viewPatrimonyChart",
  };
  document.getElementById(viewMap[viewName])?.classList.add("active");

  const actionsContainer = document.getElementById("headerActionsContainer");
  if (viewName === "investments") {
    actionsContainer.innerHTML = `
      <button class="config-btn" onclick="openDataModal()" title="Dados & Backup">⚙️</button>
      <a class="back-nav-btn" href="TobaBank-Index.html" style="text-decoration: none;">Hub ›</a>
    `;
    renderInvestmentsScreen();
  } else if (viewName === "patrimonyChart") {
    actionsContainer.innerHTML = `
      <button class="back-nav-btn" onclick="switchView('investments')"><span style="color: #8b949e; font-weight: 900; font-size: 1.1rem; line-height: 1; margin-right: 4px;">‹</span> Investimentos</button>
    `;
  }
}

// Redesenha a tela depois de cada gravação no banco.
function onBankDataSaved() {
  if (document.getElementById("viewInvestments")?.classList.contains("active"))
    renderInvestmentsScreen();
}

function setupInvestEvents() {
  document
    .getElementById("newFundForm")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("fundNameInput").value;
      const initialAmount = getMoney("fundInitialAmountInput");
      const initialDate = document.getElementById(
        "fundInitialDateInput",
      ).value;
      const isCofrinho =
        document.getElementById("fundIsCofrinhoValue").value === "true";

      const newFund = {
        id: Date.now().toString(),
        name: name,
        isCofrinho: isCofrinho,
        deposits: [
          {
            id: Date.now().toString(),
            date: initialDate,
            amount: initialAmount,
          },
        ],
        balanceLogs: isCofrinho
          ? []
          : [
            {
              id: (Date.now() + 1).toString(),
              date: initialDate,
              amount: initialAmount,
              isSystem: true,
            },
          ],
        withdrawals: [],
        isFinished: false,
      };

      if (!db.investmentFunds) db.investmentFunds = [];
      db.investmentFunds.push(newFund);
      saveDatabase();
      document.getElementById("newFundModal").classList.remove("active");
      renderInvestmentsScreen();
    });

  document
    .getElementById("editFundNameForm")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveFundName();
    });

  document
    .getElementById("finishFundForm")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      confirmFinishFund();
    });

  // No document (e depois do setupCoreEvents) para ler o valor já com a máscara.
  document.addEventListener("input", (e) => {
    if (e.target.id === "finishGrossAmount" || e.target.id === "finishIrAmount")
      updateFinishNetPreview();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  setupCoreEvents();
  setupInvestEvents();
  switchView("investments");
});
