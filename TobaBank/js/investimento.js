/* =====================================================================
 * Toba Bank · Investimentos (carteira, cofrinhos, gráficos)
 * Depende de ../assets/toba-common.js, bank-core.js e Chart.js
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
    // "Alinhar" põe todos os ativos começando juntos no mês 0
    btn.classList.toggle("active", chartAlignMode);
    btn.setAttribute("aria-pressed", String(chartAlignMode));
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

  document.getElementById("chartPastContainer").hidden = tab !== "past";
  document.getElementById("chartFutureContainer").hidden = tab !== "future";

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

  openTobaModal("finishedActionPopup");
}

function reactivateFundFromPopup() {
  const id = document.getElementById("popupFinishedIdInput").value;
  closeTobaModal("finishedActionPopup");
  toggleFinishFund(id);
}

async function deleteFinishedFundFromPopup() {
  const id = document.getElementById("popupFinishedIdInput").value;
  if (await deleteFund(id)) closeTobaModal("finishedActionPopup");
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

  const emptyInvest = tobaEmpty("🌱", "Nenhum investimento ainda", "Toque em <b>+ Investimento</b> e deixe os juros trabalharem.");
  const emptyCofrinho = tobaEmpty("🐷", "Nenhum cofrinho ainda", "Toque no <b>+</b> ali em cima pra criar.", { compact: true });
  if (activeFunds.length === 0) {
    investContainer.innerHTML = emptyInvest;
    cofrinhosContainer.innerHTML = emptyCofrinho;
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

      if (fund.isCofrinho) {
        cofrinhosContainer.insertAdjacentHTML("beforeend", createCardHtml(fund));
        hasCofrinhos = true;
      } else {
        investContainer.insertAdjacentHTML("beforeend", createCardHtml(fund));
        hasInvestments = true;
      }
    });

    if (!hasInvestments) investContainer.innerHTML = emptyInvest;
    if (!hasCofrinhos) cofrinhosContainer.innerHTML = emptyCofrinho;
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
    avgYEl.innerText = `+${formatPct(cofrinhosAvgYield)}`;
    projElCof.innerText = `${formatCurrency(cofrinhosProjectedProfitSum)} (+${formatPct(cofrinhosProjectedYieldPct)})`;
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
    finishedContainer.innerHTML = tobaEmpty("🏁", "Nada resgatado ainda", "Quando finalizar um investimento, o lucro dele aparece aqui.", { compact: true });
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

      const sign = realProfitNet >= 0 ? "+" : "";
      finishedContainer.insertAdjacentHTML("beforeend", `
        <div class="bank-card is-done" role="button" tabindex="0" data-click="openFinishedFund" data-id="${escapeHtml(fund.id)}">
          <div class="bank-card-top">
            <span class="bank-card-title">${escapeHtml(titleText)}</span>
            <span class="bank-card-side">
              <span class="bank-card-side-label">Lucro</span>
              <span class="bank-card-side-value ${profitClass}">${sign}${formatCurrency(realProfitNet)}</span>
            </span>
          </div>
          <div class="kv-list">
            <div class="kv-row"><span>Período</span><span>${startDateStr} a ${finalDateStr}</span></div>
            <div class="kv-row"><span>Aportou</span><span>${formatCurrency(totalDeposited)}</span></div>
            <div class="kv-row"><span>Sacou</span><span>${formatCurrency(allOut)}</span></div>
            <div class="kv-row"><span>Rendeu • IR</span><span><span class="${profitClass}">${sign}${formatPct(profitPercentageNet)}</span> • <span class="text-red">-${formatCurrency(ir)}</span></span></div>
          </div>
        </div>`);
    });
    if (!finishedContainer.children.length) {
      finishedContainer.innerHTML = tobaEmpty("🔍", "Nada com esse nome", "", { compact: true });
    }
  }

  const profitValEl = document.getElementById("finishedTotalProfitVal");
  if (profitValEl) {
    profitValEl.innerText = formatCurrency(totalLiquidProfit);
    profitValEl.className = `finished-summary-value ${totalLiquidProfit >= 0 ? "text-green" : "text-red"}`;
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

  const profitClass = globalRealProfit >= 0 ? "text-green" : "text-red";
  const profitEl = document.getElementById("invRealProfit");
  profitEl.innerText = formatCurrency(globalRealProfit);
  profitEl.className = `toba-stat-value ${profitClass}`;
  const profitPctEl = document.getElementById("invRealProfitPct");
  profitPctEl.innerText = `${globalRealProfit >= 0 ? "+" : ""}${formatPct(globalProfitPct)}`;
  profitPctEl.className = `toba-stat-sub ${profitClass}`;

  const histProfitEl = document.getElementById("invHistoryProfit");
  histProfitEl.innerText = formatCurrency(totalLiquidProfit);
  histProfitEl.className = `toba-stat-value ${totalLiquidProfit >= 0 ? "text-green" : "text-red"}`;

  const totalLifeProfit = globalRealProfit + totalLiquidProfit;
  const totalLifeEl = document.getElementById("invTotalLifeProfit");
  totalLifeEl.innerText = formatCurrency(totalLifeProfit);
  totalLifeEl.className = `toba-stat-value ${totalLifeProfit >= 0 ? "text-blue" : "text-red"}`;

  const globalProjSign = globalProjectedProfitSum >= 0 ? "+" : "";
  const projEl = document.getElementById("invGlobalProjection");
  projEl.innerText = `${globalProjSign}${formatCurrency(globalProjectedProfitSum)} (${globalProjSign}${formatPct(globalProjPct)})`;
  projEl.className = globalProjectedProfitSum >= 0 ? "text-green" : "text-red";
}

// "12,34%" (vírgula, 2 casas)
function formatPct(value) {
  return `${(Number(value) || 0).toFixed(2).replace(".", ",")}%`;
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
      <div class="bank-card" role="button" tabindex="0" data-click="openFund" data-id="${escapeHtml(fund.id)}">
        <div class="bank-card-top">
          <span class="bank-card-title">${escapeHtml(fund.name)}</span>
          <span class="bank-card-side">
            <span class="bank-card-side-label">Saldo base</span>
            <span class="bank-card-side-value">${formatCurrency(totalDeposited)}</span>
          </span>
        </div>
        <div class="toba-stats is-3 invest-card-stats">
          <div class="toba-stat">
            <span class="toba-stat-label">Saques</span>
            <span class="toba-stat-value text-green">${formatCurrency(totalWithdrawn)}</span>
          </div>
          <div class="toba-stat">
            <span class="toba-stat-label">Lucro</span>
            <span class="toba-stat-value text-green">+${formatPct(yieldPct)}</span>
          </div>
          <div class="toba-stat">
            <span class="toba-stat-label">Por mês</span>
            <span class="toba-stat-value text-blue">+${formatPct(avgYieldMonthly)}</span>
          </div>
        </div>
        <div class="bank-card-note"><span>Desde ${startDateStr}</span></div>
      </div>`;
  }

  const stats = getFundStats(fund);
  const proj = stats.projection;
  const profitClass = stats.profit >= 0 ? "text-green" : "text-red";
  const profitSign = stats.profit >= 0 ? "+" : "";
  const projClass = proj.profitAmount >= 0 ? "text-green" : "text-red";
  const projSign = proj.profitAmount >= 0 ? "+" : "";

  return `
    <div class="bank-card" role="button" tabindex="0" data-click="openFund" data-id="${escapeHtml(fund.id)}">
      <div class="bank-card-top">
        <span class="bank-card-title">${escapeHtml(fund.name)}</span>
        <span class="bank-card-side">
          <span class="bank-card-side-label">Saldo atual</span>
          <span class="bank-card-side-value">${formatCurrency(stats.balance)}</span>
        </span>
      </div>
      <div class="toba-stats invest-card-stats">
        <div class="toba-stat">
          <span class="toba-stat-label">Investido</span>
          <span class="toba-stat-value">${formatCurrency(stats.netInvested)}</span>
        </div>
        <div class="toba-stat">
          <span class="toba-stat-label">Rendimento</span>
          <span class="toba-stat-value ${profitClass}">${profitSign}${formatCurrency(stats.profit)}</span>
          <span class="toba-stat-sub ${profitClass}">${profitSign}${formatPct(stats.profitPct)}</span>
        </div>
      </div>
      <div class="invest-card-projection">
        <span>🚀 Em 12 meses</span>
        <b class="${projClass}">${projSign}${formatCurrency(proj.profitAmount)} (${projSign}${formatPct(proj.projectedPct)})</b>
      </div>
    </div>`;
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
  const historyAccHeader = document.getElementById("accHistoryLabel");

  const withdrawBtn = document.getElementById("popupWithdrawBtn");
  // Cofrinho: só tem saque (já aberto) e o histórico de saques.
  headerInvest.hidden = fund.isCofrinho;
  headerCofrinho.hidden = !fund.isCofrinho;
  normalActions.hidden = fund.isCofrinho;
  withdrawAccordion.classList.toggle("is-open-plain", fund.isCofrinho);
  historyAccHeader.innerText = fund.isCofrinho ? "📜 Histórico de saques" : "📜 Histórico de lançamentos";
  withdrawBtn.innerText = fund.isCofrinho ? "💸 Efetuar saque" : "Efetuar retirada";
  withdrawBtn.className = fund.isCofrinho ? "btn btn-primary" : "btn btn-outline btn-gold";

  const totalDeposited = sumAmounts(fund.deposits);
  if (fund.isCofrinho) {
    document.getElementById("popupHeaderCofrinhoBase").innerText =
      formatCurrency(totalDeposited);
    document.getElementById("popupHeaderCofrinhoWithdrawn").innerText =
      formatCurrency(sumAmounts(fund.withdrawals));
  } else {
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

  document.getElementById("popupBalDate").value = toIsoDate();
  document.getElementById("popupBalAmount").value = "";
  document.getElementById("popupDepDate").value = toIsoDate();
  document.getElementById("popupDepAmount").value = "";
  document.getElementById("popupWithdrawDate").value =
    toIsoDate();
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
    historyList.innerHTML = tobaEmpty("📭", "Nenhum lançamento ainda", "", { compact: true });
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
        <span class="log-item-right">
          <span style="color: ${color}">${sign}${formatCurrency(log.amount)}</span>
          <button type="button" class="action-icon-btn delete" data-click="deleteInvestLog" data-fund="${escapeHtml(fund.id)}" data-log="${escapeHtml(log.id)}" data-type="${log.type}" aria-label="Apagar">🗑️</button>
        </span>`;
      historyList.appendChild(item);
    });
  }

  openTobaModal("investActionPopup");
}

function openEditFundNameModalFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  closeTobaModal("investActionPopup");
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
    document.getElementById("popupBalDate").value || toIsoDate();
  // Campo vazio não é "saldo zero": sem essa trava, tocar no botão com o
  // campo em branco zerava o saldo do investimento.
  if (!document.getElementById("popupBalAmount").value.trim())
    return showPageMessage("Informe o saldo atual do investimento.", { title: "Faltou o saldo", icon: "✍️" });
  const amount = getMoney("popupBalAmount");
  if (amount >= 0) {
    if (!fund.balanceLogs) fund.balanceLogs = [];
    fund.balanceLogs.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    closeTobaModal("investActionPopup");
    renderInvestmentsScreen();
  }
}

function submitPopupDeposit() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date =
    document.getElementById("popupDepDate").value || toIsoDate();
  const amount = getMoney("popupDepAmount");
  if (amount <= 0) {
    showPageMessage("Informe o valor do aporte.", { title: "Faltou o valor", icon: "✍️" });
    return;
  }
  {
    if (!fund.deposits) fund.deposits = [];
    fund.deposits.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    closeTobaModal("investActionPopup");
    renderInvestmentsScreen();
  }
}

function submitPopupWithdraw() {
  const fundId = document.getElementById("popupFundIdInput").value;
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const date =
    document.getElementById("popupWithdrawDate").value || toIsoDate();
  const amount = getMoney("popupWithdrawAmount");
  if (amount <= 0) {
    showPageMessage("Informe o valor da retirada.", { title: "Faltou o valor", icon: "✍️" });
    return;
  }
  {
    // Nos investimentos, o saldo depois da retirada é derivado em getFundStats.
    if (!fund.withdrawals) fund.withdrawals = [];
    fund.withdrawals.push({ id: Date.now().toString(), date, amount });
    saveDatabase();
    closeTobaModal("investActionPopup");
    renderInvestmentsScreen();
  }
}

async function deleteInvestLogFromPopup(fundId, logId, type) {
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  const confirmed = await showPageMessage("Esse lançamento sai do histórico e das contas.", {
    title: "Apagar lançamento?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (confirmed) {
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

function openTotalFinishFundModalFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  closeTobaModal("investActionPopup");
  openFinishFundModal(fundId);
  const rescueSelect = document.getElementById("rescueTypeSelect");
  if (rescueSelect) {
    rescueSelect.value = "total";
    toggleRescueType();
  }
}

async function deleteFundFromPopup() {
  const fundId = document.getElementById("popupFundIdInput").value;
  if (await deleteFund(fundId)) closeTobaModal("investActionPopup");
}

function toggleCofrinhosView() {
  cofrinhosVisible = !cofrinhosVisible;
  document.getElementById("cofrinhosWrapper").hidden = !cofrinhosVisible;
  document.getElementById("btnToggleCofrinhos").innerText =
    cofrinhosVisible ? "🐷 Esconder cofrinhos" : "🐷 Ver cofrinhos";
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
    content.innerHTML = tobaEmpty("📭", "Nenhum rendimento ainda", "Atualize o saldo de um investimento e o mês aparece aqui.");
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
          ? ` <small>(${data.investYield >= 0 ? "+" : ""}${formatPct(invPct)})</small>`
          : "";
      const cofPctStr =
        data.cofrinhoBase > 0
          ? ` <small>(${data.cofrinhoYield >= 0 ? "+" : ""}${formatPct(cofPct)})</small>`
          : "";

      content.insertAdjacentHTML("beforeend", `
        <div class="card">
          <div class="card-header" style="margin-bottom: 0.5rem">
            <span class="bank-card-title">${mName}</span>
          </div>
          <div class="kv-list">
            ${data.investBase > 0 ? `<div class="kv-row"><span>📈 Longo prazo</span><span class="${data.investYield >= 0 ? "text-green" : "text-red"}">${data.investYield >= 0 ? "+" : ""}${formatCurrency(data.investYield)}${invPctStr}</span></div>` : ""}
            ${data.cofrinhoBase > 0 ? `<div class="kv-row"><span>🐷 Cofrinhos</span><span class="text-green">+${formatCurrency(data.cofrinhoYield)}${cofPctStr}</span></div>` : ""}
            <div class="kv-row is-total"><span>Total do mês</span><span class="text-blue">+${formatCurrency(data.investYield + data.cofrinhoYield)}</span></div>
          </div>
        </div>`);
    });
  }

  openTobaModal("investmentsHistoryModal");
}

function openNewFundModal(isCofrinho = false) {
  document.getElementById("fundIsCofrinhoValue").value = isCofrinho
    ? "true"
    : "false";
  document.getElementById("newFundModalTitle").innerText = isCofrinho
    ? "🐷 Novo cofrinho"
    : "📈 Novo investimento";
  document.getElementById("fundNameInput").value = "";
  document.getElementById("fundInitialAmountInput").value = "";
  document.getElementById("fundInitialDateInput").value =
    toIsoDate();
  openTobaModal("newFundModal");
  setTimeout(() => document.getElementById("fundNameInput").focus(), 100);
}

function openEditFundNameModal(fundId, currentName) {
  document.getElementById("editFundNameId").value = fundId;
  document.getElementById("editFundNameInput").value = currentName;
  openTobaModal("editFundNameModal");
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
    closeTobaModal("editFundNameModal");
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
  document.getElementById("finishDateInput").value = toIsoDate();
  document.getElementById("rescueAmountInput").value = "";

  updateFinishNetPreview();
  openTobaModal("finishFundModal");
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
    partialBox.hidden = type !== "partial";
    totalBox.hidden = type === "partial";
  }
  const btn = document.getElementById("confirmRescueBtn");
  if (btn) btn.innerText = type === "partial" ? "Confirmar retirada" : "💀 Encerrar investimento";
  updateFinishNetPreview();
}

function updateFinishNetPreview() {
  const gross = getMoney("finishGrossAmount");
  const ir = getMoney("finishIrAmount");
  const net = Math.max(gross - ir, 0);
  document.getElementById("finishNetPreview").innerText =
    `Valor líquido no bolso: ${formatCurrency(net)}`;
}

function confirmFinishFund() {
  const fundId = document.getElementById("finishFundIdInput").value;
  const rescueType = document.getElementById("rescueTypeSelect").value;
  const rescueDate =
    document.getElementById("finishDateInput").value ||
    toIsoDate();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;

  if (rescueType === "partial") {
    const withdrawAmount = getMoney("rescueAmountInput");
    if (withdrawAmount <= 0)
      return showPageMessage("Informe um valor de resgate válido!", { title: "Faltou o valor", icon: "✍️" });

    // O saldo depois da retirada é derivado em getFundStats.
    if (!fund.withdrawals) fund.withdrawals = [];
    fund.withdrawals.push({
      id: Date.now().toString(),
      date: rescueDate,
      amount: withdrawAmount,
    });

    saveDatabase();
    closeTobaModal("finishFundModal");
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
    closeTobaModal("finishFundModal");
  }
}

function toggleFinishFund(fundId) {
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;
  fund.isFinished = !fund.isFinished;
  saveDatabase();
  renderInvestmentsScreen();
}

// Devolve true se apagou (o popup só fecha depois da confirmação).
async function deleteFund(fundId) {
  const confirmed = await showPageMessage("O investimento e todo o histórico dele somem. Sem volta!", {
    title: "Apagar investimento?", icon: "🗑️", confirm: true, confirmLabel: "Apagar",
  });
  if (!confirmed) return false;
  db.investmentFunds = db.investmentFunds.filter(
    (f) => String(f.id) !== String(fundId),
  );
  saveDatabase();
  renderInvestmentsScreen();
  return true;
}

// Chart.js vem da internet: na primeira abertura sem sinal ele não existe.
function isChartAvailable() {
  if (typeof Chart !== "undefined") return true;
  showPageMessage("Os gráficos precisam de internet na primeira vez. Conecta e tenta de novo!", { title: "Sem sinal", icon: "📡" });
  return false;
}

function openPatrimonyChart() {
  if (!isChartAvailable()) return;
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

    const li = document.createElement("li");
    if (isDisabledInMode) li.className = "is-disabled";
    li.innerHTML = `
      <label>
        <input type="checkbox" ${!chartVisibleAssets.has(String(fund.id)) && !isDisabledInMode ? "checked" : ""} ${disabledAttr} data-change="toggleChartAsset" data-id="${escapeHtml(fund.id)}">
        <span class="asset-dot" style="background-color: ${color}"></span>
        <span>${isCofrinho ? "🐷 " : "📈 "}${escapeHtml(fund.name)} ${isDisabledInMode ? "(só em %)" : ""}</span>
      </label>`;
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
    <div class="card-title">Projeção para ${yearsStr}</div>
    <div class="finished-summary-value">${formatCurrency(parseFloat(finalVal))}</div>
    <div class="text-blue" style="font-size: 0.82rem">Lucro estimado: +${formatCurrency(profit)} (+${formatPct(profitPct)})</div>`;
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
  window.scrollTo(0, 0);

  if (viewName === "investments") {
    tobaSetHeader({ page: "📈 Investimentos" });
    renderInvestmentsScreen();
  } else if (viewName === "patrimonyChart") {
    tobaSetHeader({ page: "📊 Gráficos", back: "backToInvestments" });
  }
}

// Redesenha a tela depois de cada gravação no banco.
function onBankDataSaved() {
  if (document.getElementById("viewInvestments")?.classList.contains("active"))
    renderInvestmentsScreen();
}

function createFund() {
  const name = document.getElementById("fundNameInput").value.trim();
  const initialAmount = getMoney("fundInitialAmountInput");
  const initialDate = document.getElementById("fundInitialDateInput").value;
  const isCofrinho =
    document.getElementById("fundIsCofrinhoValue").value === "true";

  if (!name || initialAmount <= 0 || !initialDate) {
    showPageMessage("Preencha o nome, o aporte inicial e a data.", { title: "Quase lá", icon: "✍️" });
    return;
  }

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
  closeTobaModal("newFundModal");
  renderInvestmentsScreen();
}

tobaActions({
  openFund: (el) => openInvestActionPopup(el.dataset.id),
  openFinishedFund: (el) => openFinishedActionPopup(el.dataset.id),
  newFund: () => openNewFundModal(false),
  newCofrinho: () => openNewFundModal(true),
  toggleCofrinhosView,
  openInvestmentsHistoryModal,
  openPatrimonyChart,
  backToInvestments: () => switchView("investments"),
  renderInvestmentsScreen,
  switchChartTab: (el) => switchChartTab(el.dataset.tab),
  changeChartMode: (el) => changeChartMode(el.dataset.mode),
  toggleAlignMode,
  changeChartPeriod: (el) => changeChartPeriod(el.dataset.period),
  changeProjPeriod: (el) => changeProjPeriod(el.dataset.period),
  toggleChartAsset: (el) => toggleChartAsset(el.dataset.id),
  toggleInvestActionAcc: (el) => toggleInvestActionAcc(el.dataset.target),
  openEditFundNameModalFromPopup,
  submitPopupBalance,
  submitPopupDeposit,
  submitPopupWithdraw,
  deleteInvestLog: (el) => deleteInvestLogFromPopup(el.dataset.fund, el.dataset.log, el.dataset.type),
  openTotalFinishFundModalFromPopup,
  deleteFundFromPopup,
  reactivateFundFromPopup,
  deleteFinishedFundFromPopup,
  toggleRescueType,
  updateFinishNetPreview,
  confirmFinishFund,
  saveFundName,
  createFund,
});

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  switchView("investments");
});
