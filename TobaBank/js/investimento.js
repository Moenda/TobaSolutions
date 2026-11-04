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

/* =====================================================================
 * v1.70 · utilidades de data, IR e rendimento mensal (só cálculo: nada
 * disso é gravado no banco, exceto o campo opcional fund.irExempt).
 * ===================================================================== */
const MONTH_DAYS = 30.4167;

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const FUND_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#ff7b72", "#bc8cff", "#7ee787", "#ffb6c1", "#00ced1", "#f0883e", "#a5d6ff"];

let currentChartTab = "past";

let currentMonthlyPeriod = "1y";

let projMonthlyAdd = 0;

let finishedListOpen = false;

let invActionTab = null;

let finishIrTouched = false;

let monthlyChartInstance = null;

let rankChartInstance = null;

function parseIsoLocal(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

// Dias corridos entre duas datas "AAAA-MM-DD" (b − a).
function daysBetween(a, b) {
  return Math.round((parseIsoLocal(b) - parseIsoLocal(a)) / DAY_MS);
}

// "05/08/26"
function shortBrDate(iso) {
  if (!iso) return "N/A";
  const d = parseIsoLocal(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function firstDepositDate(fund) {
  const dates = (fund.deposits || []).map((d) => d.date).filter(Boolean).sort();
  return dates[0] || null;
}

// Data em que um investimento resgatado terminou.
function finishedEndDate(fund) {
  if (fund.closeDate) return fund.closeDate;
  const dates = (fund.balanceLogs || []).map((b) => b.date).filter(Boolean).sort();
  return dates[dates.length - 1] || firstDepositDate(fund);
}

// "22,5%" / "20%"
function formatRate(rate) {
  const r = Number(rate) || 0;
  return `${Number.isInteger(r) ? r : r.toFixed(1).replace(".", ",")}%`;
}

function signed(value, text) {
  return `${value >= 0 ? "+" : "-"}${text}`;
}

function signedMoney(value) {
  return signed(value, formatCurrency(Math.abs(value)));
}

function signedPct(value) {
  return signed(value, formatPct(Math.abs(value)));
}

/* ---------- IR: tabela regressiva + IOF ---------- */
const IR_BRACKETS = [
  { max: 180, rate: 22.5, label: "Até 180 dias" },
  { max: 360, rate: 20, label: "181 a 360 dias" },
  { max: 720, rate: 17.5, label: "361 a 720 dias" },
  { max: Infinity, rate: 15, label: "Mais de 720 dias" },
];

// IOF regressivo sobre o rendimento: dia 1 = 96% ... dia 29 = 3%, 30+ = 0.
const IOF_TABLE = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];

function irRateForDays(days) {
  return IR_BRACKETS.find((b) => days <= b.max).rate;
}

function iofRateForDays(days) {
  if (days >= 30) return 0;
  return IOF_TABLE[Math.max(days, 1) - 1];
}

// Quantos dias faltam pra cair de faixa (null = já está em 15%).
function nextIrStep(days) {
  const i = IR_BRACKETS.findIndex((b) => days <= b.max);
  if (i < 0 || i === IR_BRACKETS.length - 1) return null;
  return { days: IR_BRACKETS[i].max + 1 - days, rate: IR_BRACKETS[i + 1].rate };
}

// Aportes que ainda estão lá na data (retirada sai do mais antigo).
function getFundLots(fund, atIso) {
  const lots = (fund.deposits || [])
    .filter((d) => d.date && d.date <= atIso)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((d) => ({ date: d.date, amount: Number(d.amount) || 0 }));
  let out = sumAmounts((fund.withdrawals || []).filter((w) => w.date <= atIso));
  for (const lot of lots) {
    if (out <= 0) break;
    const take = Math.min(lot.amount, out);
    lot.amount -= take;
    out -= take;
  }
  const left = lots.filter((l) => l.amount > 0.005);
  return left.length ? left : lots;
}

/* Prévia do IR de um investimento de longo prazo se sacar tudo na data.
 * Cada aporte conta o próprio prazo; o lucro é dividido entre eles pelo
 * quanto cada um rendeu (taxa pro-rata do fundo). Devolve também a faixa
 * do aporte "principal" e quanto falta pra ela cair. */
function estimateFundIr(fund, opts = {}) {
  const at = opts.at || toIsoDate();
  const stats = getFundStats(fund);
  const profit = opts.profit !== undefined ? opts.profit : stats.profit;
  const res = { exempt: !!fund.irExempt, profit, ir: 0, iof: 0, rate: 0, effRate: 0, days: 0, next: null, saving: 0 };

  const lots = getFundLots(fund, at);
  if (!lots.length) return res;
  const r = Math.max(stats.dailyRate, 0);
  const weighted = lots.map((l) => {
    const days = Math.max(daysBetween(l.date, at), 0);
    const w = r > 0 ? l.amount * (Math.pow(1 + r, days) - 1) : l.amount * days;
    return { ...l, days, w };
  });
  const totalW = weighted.reduce((a, l) => a + l.w, 0);
  const totalAmt = weighted.reduce((a, l) => a + l.amount, 0) || 1;
  weighted.forEach((l) => (l.share = totalW > 0 ? l.w / totalW : l.amount / totalAmt));
  const main = weighted.reduce((best, l) => (l.share > best.share ? l : best), weighted[0]);

  res.days = main.days;
  res.rate = irRateForDays(main.days);
  res.next = nextIrStep(main.days);
  if (res.exempt) {
    res.rate = 0;
    res.next = null;
    return res;
  }
  if (profit <= 0) return res;

  weighted.forEach((l) => {
    const gain = profit * l.share;
    const iof = (gain * iofRateForDays(l.days)) / 100;
    res.iof += iof;
    res.ir += ((gain - iof) * irRateForDays(l.days)) / 100;
  });
  if (res.next) {
    const gain = profit * main.share;
    const iof = (gain * iofRateForDays(main.days)) / 100;
    res.saving = ((gain - iof) * (res.rate - res.next.rate)) / 100;
  }
  res.effRate = (res.ir / profit) * 100;
  return res;
}

// Cofrinho: o lucro já sai nos saques, então aqui só a faixa do prazo.
function cofrinhoIrInfo(fund) {
  const start = firstDepositDate(fund);
  const days = start ? Math.max(daysBetween(start, toIsoDate()), 0) : 0;
  if (fund.irExempt) return { exempt: true, days, rate: 0, next: null };
  return { exempt: false, days, rate: irRateForDays(days), next: nextIrStep(days) };
}

/* ---------- Rendimento por mês ---------- */
function getCofrinhoNumbers(fund) {
  const totalDeposited = sumAmounts(fund.deposits);
  const totalWithdrawn = sumAmounts(fund.withdrawals);
  const yieldPct = totalDeposited > 0 ? (totalWithdrawn / totalDeposited) * 100 : 0;
  const start = firstDepositDate(fund);
  const days = start ? Math.max(daysBetween(start, toIsoDate()), 1) : 1;
  const monthsElapsed = Math.max(days / MONTH_DAYS, 1);
  let dailyRate = 0;
  if (totalDeposited > 0) {
    dailyRate = Math.pow((totalDeposited + totalWithdrawn) / totalDeposited, 1 / days) - 1;
  }
  return {
    totalDeposited,
    totalWithdrawn,
    yieldPct,
    start,
    days,
    dailyRate,
    monthlyPct: yieldPct / monthsElapsed,
    monthlyAmount: totalWithdrawn / monthsElapsed,
    projectedProfit: totalDeposited * Math.pow(1 + dailyRate, 365) - totalDeposited,
  };
}

// Ritmo do mês de um ativo: % ao mês e R$ por mês.
function getFundMonthlyPace(fund) {
  if (fund.isCofrinho) {
    const c = getCofrinhoNumbers(fund);
    return { pct: c.monthlyPct, amount: c.monthlyAmount };
  }
  const stats = getFundStats(fund);
  const pct = (Math.pow(1 + stats.dailyRate, MONTH_DAYS) - 1) * 100;
  return { pct, amount: Math.max(stats.balance, 0) * (pct / 100) };
}

/* Rendimento de cada mês, fatiado por dia entre um saldo lançado e outro
 * (mesma regra do antigo "📜 Rendimento por mês"). Inclui os resgatados. */
function calcMonthlyYields() {
  const funds = db.investmentFunds || [];
  const monthlyData = {};
  const ensure = (mKey) => {
    if (!monthlyData[mKey]) {
      monthlyData[mKey] = { investYield: 0, investBase: 0, cofrinhoYield: 0, cofrinhoBase: 0, details: [] };
    }
    return monthlyData[mKey];
  };

  funds.forEach((fund) => {
    if (fund.isCofrinho) {
      (fund.withdrawals || []).forEach((w) => {
        if (!w.date) return;
        const mKey = w.date.slice(0, 7);
        const depAtTime = sumAmounts((fund.deposits || []).filter((d) => d.date <= w.date));
        const m = ensure(mKey);
        m.cofrinhoYield += w.amount;
        m.cofrinhoBase = Math.max(m.cofrinhoBase, depAtTime);
        m.details.push({ fundId: String(fund.id), name: `🐷 ${fund.name}`, yieldAmount: w.amount, baseAmount: depAtTime, isCofrinho: true });
      });
      return;
    }

    const points = [];
    if (fund.deposits && fund.deposits.length > 0) {
      const firstDate = firstDepositDate(fund);
      points.push({
        date: firstDate,
        amount:
          sumAmounts(fund.deposits.filter((d) => d.date === firstDate)) -
          sumAmounts((fund.withdrawals || []).filter((w) => w.date === firstDate)),
        type: "init",
      });
    }
    (fund.balanceLogs || [])
      .filter((b) => !b.isSystem)
      .forEach((b) => points.push({ date: b.date, amount: b.amount, type: "bal" }));

    points.sort((a, b) => {
      const diff = String(a.date).localeCompare(String(b.date));
      if (diff !== 0) return diff;
      return a.type === "init" ? -1 : 1;
    });

    const filtered = [];
    points.forEach((p) => {
      if (!filtered.length || filtered[filtered.length - 1].date !== p.date) filtered.push(p);
      else filtered[filtered.length - 1] = p;
    });

    for (let k = 1; k < filtered.length; k++) {
      const prev = filtered[k - 1];
      const pt = filtered[k];
      const startD = parseIsoLocal(prev.date);
      const endD = parseIsoLocal(pt.date);
      const totalDays = Math.round((endD - startD) / DAY_MS);
      if (totalDays <= 0) continue;

      const deps = sumAmounts((fund.deposits || []).filter((d) => d.date > prev.date && d.date <= pt.date));
      const wds = sumAmounts((fund.withdrawals || []).filter((w) => w.date > prev.date && w.date <= pt.date));
      const yieldAmount = pt.amount - (prev.amount + deps - wds);
      const totalDepAtEnd =
        sumAmounts((fund.deposits || []).filter((d) => d.date <= pt.date)) -
        sumAmounts((fund.withdrawals || []).filter((w) => w.date <= pt.date));

      let tempDate = new Date(startD);
      while (tempDate < endD) {
        const year = tempDate.getFullYear();
        const month = tempDate.getMonth();
        const mKey = `${year}-${String(month + 1).padStart(2, "0")}`;
        const nextMonthStart = new Date(year, month + 1, 1);
        const segmentEnd = endD < nextMonthStart ? endD : nextMonthStart;
        const daysInSeg = Math.round((segmentEnd - tempDate) / DAY_MS);
        const portion = yieldAmount * (daysInSeg / totalDays);
        const m = ensure(mKey);
        m.investYield += portion;
        m.investBase = Math.max(m.investBase, totalDepAtEnd);
        m.details.push({ fundId: String(fund.id), name: `📈 ${fund.name}`, yieldAmount: portion, baseAmount: totalDepAtEnd, isCofrinho: false });
        tempDate = nextMonthStart;
      }
    }
  });
  return monthlyData;
}

/* ---------- Saldo de verdade em qualquer data (gráfico de evolução) ---------- */
function fundTimeline(fund) {
  const first = firstDepositDate(fund);
  if (!first) return [];
  const points = [{
    date: first,
    amount:
      sumAmounts(fund.deposits.filter((d) => d.date === first)) -
      sumAmounts((fund.withdrawals || []).filter((w) => w.date === first)),
  }];
  (fund.balanceLogs || [])
    .filter((b) => !b.isSystem && b.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((b) => {
      const last = points[points.length - 1];
      if (last.date === b.date) last.amount = b.amount;
      else if (b.date > last.date) points.push({ date: b.date, amount: b.amount });
    });
  return points;
}

// { value, invested, gain } na data, ou null se ainda não tinha começado.
function fundValueAt(fund, iso, timeline) {
  const tl = timeline || fundTimeline(fund);
  if (!tl.length || iso < tl[0].date) return null;
  const deps = (a, b) => sumAmounts((fund.deposits || []).filter((d) => d.date > a && d.date <= b));
  const wds = (a, b) => sumAmounts((fund.withdrawals || []).filter((w) => w.date > a && w.date <= b));

  if (fund.isCofrinho) {
    const base = sumAmounts((fund.deposits || []).filter((d) => d.date <= iso));
    const gain = sumAmounts((fund.withdrawals || []).filter((w) => w.date <= iso));
    return { value: base, invested: base, gain };
  }

  const invested =
    sumAmounts((fund.deposits || []).filter((d) => d.date <= iso)) -
    sumAmounts((fund.withdrawals || []).filter((w) => w.date <= iso));
  let k = 0;
  while (k + 1 < tl.length && tl[k + 1].date <= iso) k++;
  const p = tl[k];
  const q = tl[k + 1];
  let value = p.amount + deps(p.date, iso) - wds(p.date, iso);
  if (q) {
    const segYield = q.amount - (p.amount + deps(p.date, q.date) - wds(p.date, q.date));
    const total = daysBetween(p.date, q.date);
    if (total > 0) value += (segYield * daysBetween(p.date, iso)) / total;
  }
  return { value, invested, gain: value - invested };
}

function endOfMonthIso(year, monthIndex) {
  return toIsoDate(new Date(year, monthIndex + 1, 0));
}

function monthLabel(iso) {
  const d = parseIsoLocal(iso);
  return `${SHORT_MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
}

function addMonthsIso(iso, n) {
  const d = parseIsoLocal(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toIsoDate(target);
}

/* ---------- Gráficos: visual comum ---------- */
function compactMoney(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: abs >= 10000 ? 0 : 1 })} mil`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
}

function baseChartOptions({ yFormat, tooltipLabel, stacked = false, indexAxis = "x", legend = false }) {
  const grid = { color: "rgba(139, 148, 158, 0.12)", drawTicks: false };
  const ticks = { color: "#8b949e", font: { size: 11 }, padding: 6 };
  const valueAxis = { stacked, grid, border: { display: false }, ticks: { ...ticks, callback: yFormat } };
  const catAxis = { stacked, grid: { display: false }, border: { display: false }, ticks: { ...ticks, maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    interaction: { mode: "index", intersect: false },
    animation: { duration: 400 },
    scales: indexAxis === "y" ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    plugins: {
      legend: { display: legend, labels: { color: "#c9d1d9", boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
      tooltip: {
        backgroundColor: "rgba(13, 17, 23, 0.95)",
        borderColor: "#30363d",
        borderWidth: 1,
        padding: 10,
        titleColor: "#f0f6fc",
        bodyColor: "#c9d1d9",
        usePointStyle: true,
        callbacks: { label: tooltipLabel },
      },
    },
  };
}

function hexAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* =====================================================================
 * Gráficos: abas
 * ===================================================================== */
function switchChartTab(tab) {
  currentChartTab = tab;
  document.querySelectorAll(".inv-chart-tabs .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const panes = { past: "chartPastContainer", monthly: "chartMonthlyContainer", rank: "chartRankContainer", future: "chartFutureContainer" };
  Object.entries(panes).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = key !== tab;
  });
  if (tab === "past") renderPatrimonyChart(currentChartPeriod);
  else if (tab === "monthly") renderMonthlyView();
  else if (tab === "rank") renderRankChart();
  else renderProjectionChart(currentProjPeriod);
}

function setActiveIn(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => b.classList.toggle("active", b.getAttribute(attr) === String(value)));
}

function changeChartPeriod(period) {
  currentChartPeriod = period;
  setActiveIn("#chartPastContainer [data-period]", "data-period", period);
  renderPatrimonyChart(period);
}

function changeChartMode(mode) {
  chartMode = mode;
  document.getElementById("chartModeBrl")?.classList.toggle("active", mode === "brl");
  document.getElementById("chartModePct")?.classList.toggle("active", mode === "pct");
  renderPatrimonyChart(currentChartPeriod);
}

function toggleChartAsset(id) {
  id = String(id);
  if (chartVisibleAssets.has(id)) chartVisibleAssets.delete(id);
  else chartVisibleAssets.add(id);
  renderPatrimonyChart(currentChartPeriod);
}

function changeProjPeriod(period) {
  currentProjPeriod = period;
  setActiveIn("#chartFutureContainer [data-period]", "data-period", period);
  renderProjectionChart(period);
}

function changeProjMonthly(amount) {
  projMonthlyAdd = Number(amount) || 0;
  setActiveIn("#chartFutureContainer [data-amount]", "data-amount", amount);
  renderProjectionChart(currentProjPeriod);
}

function changeMonthlyPeriod(period) {
  currentMonthlyPeriod = period;
  setActiveIn("#chartMonthlyContainer [data-period]", "data-period", period);
  renderMonthlyView();
}

/* =====================================================================
 * Tela principal
 * ===================================================================== */
function openFinishedActionPopup(id) {
  const item = (db.investmentFunds || []).find((f) => String(f.id) === String(id));
  if (!item) return;
  const n = getFinishedNumbers(item);

  document.getElementById("popupFinishedIdInput").value = item.id;
  document.getElementById("popupFinishedTitle").innerText = item.name;
  document.getElementById("popupFinishedPeriod").innerText = `${n.startStr} a ${n.endStr}${n.days ? ` (${n.days} dias)` : ""}`;
  document.getElementById("popupFinishedDep").innerText = formatCurrency(n.totalDeposited);
  document.getElementById("popupFinishedWd").innerText = formatCurrency(n.allOut);

  const profitEl = document.getElementById("popupFinishedProfit");
  profitEl.innerText = `${signedMoney(n.profit)} (${signedPct(n.profitPct)})`;
  profitEl.className = n.profit >= 0 ? "text-green" : "text-red";

  const monthlyEl = document.getElementById("popupFinishedMonthly");
  monthlyEl.innerText = n.days > 0 ? `${signedPct(n.monthlyPct)} a.m.` : "--";
  monthlyEl.className = n.profit >= 0 ? "text-green" : "text-red";

  document.getElementById("popupFinishedIr").innerText =
    n.ir > 0 ? `-${formatCurrency(n.ir)} (${formatRate(Math.round(n.irEff * 10) / 10)} do lucro)` : `-${formatCurrency(n.ir)}`;
  document.getElementById("popupFinishedIrTable").innerText = item.irExempt ? "🛡️ Isento" : `${formatRate(irRateForDays(n.days))}`;

  document.getElementById("popupFinishedHero").innerHTML = `
    <div class="inv-hero-label">Lucro no bolso</div>
    <div class="inv-hero-value ${n.profit >= 0 ? "text-green" : "text-red"}">${signedMoney(n.profit)}</div>`;

  openTobaModal("finishedActionPopup");
}

// Números de um investimento resgatado (mesma conta de antes + prazo e IR).
function getFinishedNumbers(fund) {
  const totalDeposited = sumAmounts(fund.deposits);
  let finalGross = totalDeposited;
  if (fund.balanceLogs && fund.balanceLogs.length > 0) {
    const sortedLogs = [...fund.balanceLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    finalGross = fund.closeAmount !== undefined ? fund.closeAmount : sortedLogs[0].amount;
  }
  const start = firstDepositDate(fund);
  const end = fund.balanceLogs && fund.balanceLogs.length > 0 ? finishedEndDate(fund) : null;
  const ir = fund.irAmount || 0;
  const finalNet = Math.max(finalGross - ir, 0);
  const totalWithdrawn = sumAmounts(fund.withdrawals);
  const allOut = finalNet + totalWithdrawn;
  const profit = allOut - totalDeposited;
  const profitPct = totalDeposited > 0 ? (profit / totalDeposited) * 100 : 0;
  const days = start && end ? Math.max(daysBetween(start, end), 0) : 0;
  const months = days / MONTH_DAYS;
  const monthlyPct = months > 0 && profitPct > -100 ? (Math.pow(1 + profitPct / 100, 1 / months) - 1) * 100 : 0;
  const grossProfit = finalGross + totalWithdrawn - totalDeposited;
  return {
    totalDeposited,
    allOut,
    profit,
    profitPct,
    ir,
    irEff: grossProfit > 0 ? (ir / grossProfit) * 100 : 0,
    start,
    end,
    startStr: shortBrDate(start),
    endStr: end ? shortBrDate(end) : "N/A",
    days,
    monthlyPct,
    monthlyAmount: months >= 1 ? profit / months : profit,
  };
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

function toggleFinishedList() {
  finishedListOpen = !finishedListOpen;
  applyFinishedListState();
}

function applyFinishedListState() {
  const acc = document.getElementById("finishedAcc");
  const body = document.getElementById("finishedBody");
  if (!acc || !body) return;
  acc.classList.toggle("expanded", finishedListOpen);
  body.hidden = !finishedListOpen;
  acc.querySelector(".inv-done-head")?.setAttribute("aria-expanded", String(finishedListOpen));
}

function renderInvestmentsScreen() {
  const investContainer = document.getElementById("investmentsContainer");
  const cofrinhosContainer = document.getElementById("cofrinhosContainer");
  const finishedContainer = document.getElementById("finishedInvestmentsContainer");
  if (!investContainer || !cofrinhosContainer || !finishedContainer) return;

  investContainer.innerHTML = "";
  cofrinhosContainer.innerHTML = "";
  finishedContainer.innerHTML = "";

  const funds = db.investmentFunds || [];
  let globalTotalBalance = 0;
  let globalTotalDeposited = 0;
  let globalProjectedProfitSum = 0;
  let globalMonthlyPace = 0;
  let globalIrToday = 0;

  let cofrinhosTotalDeposited = 0;
  let cofrinhosWithdrawalsSum = 0;
  let cofrinhosYieldSum = 0;
  let cofrinhosCount = 0;
  let cofrinhosProjectedProfitSum = 0;

  const activeFunds = funds.filter((f) => !f.isFinished);
  const finishedFunds = funds.filter((f) => f.isFinished);
  const searchTerm = (document.getElementById("finishedSearchInput")?.value || "").toLowerCase();

  const emptyInvest = tobaEmpty("🌱", "Nenhum investimento ainda", "Toque em <b>+ Investimento</b> e deixe os juros trabalharem.");
  const emptyCofrinho = tobaEmpty("🐷", "Nenhum cofrinho ainda", "Toque no <b>+</b> ali em cima pra criar.", { compact: true });
  let hasInvestments = false;
  let hasCofrinhos = false;

  activeFunds.forEach((fund) => {
    if (fund.isCofrinho) {
      const c = getCofrinhoNumbers(fund);
      cofrinhosWithdrawalsSum += c.totalWithdrawn;
      cofrinhosYieldSum += c.yieldPct;
      cofrinhosCount++;
      cofrinhosTotalDeposited += c.totalDeposited;
      cofrinhosProjectedProfitSum += c.projectedProfit;
      globalMonthlyPace += c.monthlyAmount;
      globalTotalBalance += c.totalDeposited;
      globalTotalDeposited += c.totalDeposited;
      cofrinhosContainer.insertAdjacentHTML("beforeend", createCardHtml(fund));
      hasCofrinhos = true;
    } else {
      const stats = getFundStats(fund);
      globalProjectedProfitSum += stats.projection.profitAmount;
      globalTotalBalance += stats.balance;
      globalTotalDeposited += stats.netInvested;
      globalMonthlyPace += getFundMonthlyPace(fund).amount;
      const est = estimateFundIr(fund);
      globalIrToday += est.ir + est.iof;
      investContainer.insertAdjacentHTML("beforeend", createCardHtml(fund));
      hasInvestments = true;
    }
  });
  if (!hasInvestments) investContainer.innerHTML = emptyInvest;
  if (!hasCofrinhos) cofrinhosContainer.innerHTML = emptyCofrinho;

  globalProjectedProfitSum += cofrinhosProjectedProfitSum;

  const cofrinhosAvgYield = cofrinhosCount > 0 ? cofrinhosYieldSum / cofrinhosCount : 0;
  const cofrinhosProjectedYieldPct =
    cofrinhosTotalDeposited > 0 ? (cofrinhosProjectedProfitSum / cofrinhosTotalDeposited) * 100 : 0;
  const totalWEl = document.getElementById("cofrinhosTotalWithdrawalsVal");
  const avgYEl = document.getElementById("cofrinhosAvgYieldVal");
  const projElCof = document.getElementById("cofrinhosProjectionVal");
  if (totalWEl && avgYEl && projElCof) {
    totalWEl.innerText = formatCurrency(cofrinhosWithdrawalsSum);
    avgYEl.innerText = `+${formatPct(cofrinhosAvgYield)}`;
    projElCof.innerText = `${formatCurrency(cofrinhosProjectedProfitSum)} (+${formatPct(cofrinhosProjectedYieldPct)})`;
  }

  // Já resgatados: lista compacta por ano, mais recente primeiro.
  const finishedRows = finishedFunds
    .map((fund) => ({ fund, n: getFinishedNumbers(fund) }))
    .sort((a, b) => String(b.n.end || "").localeCompare(String(a.n.end || "")));
  const totalLiquidProfit = finishedRows.reduce((acc, r) => acc + r.n.profit, 0);

  if (!finishedRows.length) {
    finishedContainer.innerHTML = tobaEmpty("🏁", "Nada resgatado ainda", "Quando finalizar um investimento, o lucro dele aparece aqui.", { compact: true });
  } else {
    const visible = finishedRows.filter(({ fund }) => !searchTerm || `${fund.isCofrinho ? "🐷" : "🏁"} ${fund.name}`.toLowerCase().includes(searchTerm));
    const byYear = {};
    visible.forEach((row) => {
      const year = (row.n.end || "----").slice(0, 4);
      (byYear[year] = byYear[year] || []).push(row);
    });
    Object.keys(byYear)
      .sort((a, b) => b.localeCompare(a))
      .forEach((year) => {
        const rows = byYear[year];
        const yearProfit = rows.reduce((acc, r) => acc + r.n.profit, 0);
        finishedContainer.insertAdjacentHTML("beforeend", `
          <div class="inv-year-head">
            <span>${escapeHtml(year === "----" ? "Sem data" : year)}</span>
            <span>${rows.length} ${rows.length === 1 ? "resgate" : "resgates"} · <b class="${yearProfit >= 0 ? "text-green" : "text-red"}">${signedMoney(yearProfit)}</b></span>
          </div>`);
        rows.forEach(({ fund, n }) => finishedContainer.insertAdjacentHTML("beforeend", finishedRowHtml(fund, n)));
      });
    if (!visible.length) finishedContainer.innerHTML = tobaEmpty("🔍", "Nada com esse nome", "", { compact: true });
  }

  const countEl = document.getElementById("finishedCount");
  if (countEl) countEl.innerText = String(finishedRows.length);
  if (searchTerm) finishedListOpen = true;
  applyFinishedListState();

  const profitValEl = document.getElementById("finishedTotalProfitVal");
  if (profitValEl) {
    profitValEl.innerText = signedMoney(totalLiquidProfit);
    profitValEl.className = `inv-done-head-value ${totalLiquidProfit >= 0 ? "text-green" : "text-red"}`;
  }

  const globalRealProfit = globalTotalBalance - globalTotalDeposited;
  const globalProfitPct = globalTotalDeposited > 0 ? (globalRealProfit / globalTotalDeposited) * 100 : 0;
  const globalProjPct = globalTotalBalance > 0 ? (globalProjectedProfitSum / globalTotalBalance) * 100 : 0;

  document.getElementById("invTotalBalance").innerText = formatCurrency(globalTotalBalance);
  document.getElementById("invTotalDeposited").innerText = formatCurrency(globalTotalDeposited);

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

  const projEl = document.getElementById("invGlobalProjection");
  projEl.innerText = `${signedMoney(globalProjectedProfitSum)} (${signedPct(globalProjPct)})`;
  projEl.className = globalProjectedProfitSum >= 0 ? "text-green" : "text-red";

  const paceEl = document.getElementById("invMonthlyPace");
  if (paceEl) {
    const pacePct = globalTotalBalance > 0 ? (globalMonthlyPace / globalTotalBalance) * 100 : 0;
    paceEl.innerText = `${signedMoney(globalMonthlyPace)} (${formatPct(pacePct)} a.m.)`;
    paceEl.className = globalMonthlyPace >= 0 ? "text-green" : "text-red";
  }
  const irEl = document.getElementById("invIrToday");
  if (irEl) irEl.innerText = `-${formatCurrency(globalIrToday)}`;
}

function finishedRowHtml(fund, n) {
  const cls = n.profit >= 0 ? "text-green" : "text-red";
  const meta = [`${n.startStr.slice(0, 5)}→${n.endStr}`];
  if (n.days) meta.push(`${n.days}d`);
  if (fund.irExempt) meta.push("🛡️ isento");
  else if (n.ir > 0) meta.push(`IR ${formatRate(Math.round(n.irEff * 10) / 10)}`);
  return `
    <div class="inv-done-row" role="button" tabindex="0" data-click="openFinishedFund" data-id="${escapeHtml(fund.id)}">
      <span class="inv-done-main">
        <span class="inv-done-name">${fund.isCofrinho ? "🐷" : "🏁"} ${escapeHtml(fund.name)}</span>
        <span class="inv-done-meta">${meta.join(" · ")}</span>
      </span>
      <span class="inv-done-side">
        <b class="${cls}">${signedMoney(n.profit)}</b>
        <small class="${cls}">${signedPct(n.profitPct)}</small>
      </span>
    </div>`;
}

// "12,34%" (vírgula, 2 casas)
function formatPct(value) {
  return `${(Number(value) || 0).toFixed(2).replace(".", ",")}%`;
}

function irMiniHtml(est) {
  if (est.exempt) return `<span class="toba-stat-value text-green">🛡️</span><span class="toba-stat-sub">Isento</span>`;
  const sub = est.next ? `faixa ${formatRate(est.rate)}` : `${formatRate(est.rate)} (mínimo)`;
  return `<span class="toba-stat-value text-coral">-${formatCurrency(est.ir + est.iof)}</span><span class="toba-stat-sub">${sub}</span>`;
}

function createCardHtml(fund) {
  if (fund.isCofrinho) {
    const c = getCofrinhoNumbers(fund);
    const irInfo = cofrinhoIrInfo(fund);
    const irText = irInfo.exempt
      ? "🛡️ Isento de IR"
      : `🧾 IR ${formatRate(irInfo.rate)}${irInfo.next ? ` (${formatRate(irInfo.next.rate)} em ${irInfo.next.days}d)` : ""}`;
    return `
      <div class="bank-card" role="button" tabindex="0" data-click="openFund" data-id="${escapeHtml(fund.id)}">
        <div class="bank-card-top">
          <span class="bank-card-title">${escapeHtml(fund.name)}</span>
          <span class="bank-card-side">
            <span class="bank-card-side-label">Saldo base</span>
            <span class="bank-card-side-value">${formatCurrency(c.totalDeposited)}</span>
          </span>
        </div>
        <div class="toba-stats is-3 invest-card-stats inv-card-mini">
          <div class="toba-stat">
            <span class="toba-stat-label">Saques</span>
            <span class="toba-stat-value text-green">${formatCurrency(c.totalWithdrawn)}</span>
          </div>
          <div class="toba-stat">
            <span class="toba-stat-label">Lucro</span>
            <span class="toba-stat-value text-green">+${formatPct(c.yieldPct)}</span>
          </div>
          <div class="toba-stat">
            <span class="toba-stat-label">Por mês</span>
            <span class="toba-stat-value text-blue">+${formatPct(c.monthlyPct)}</span>
            <span class="toba-stat-sub">~${formatCurrency(c.monthlyAmount)}</span>
          </div>
        </div>
        <div class="bank-card-note"><span>Desde ${c.start ? isoToBrDate(c.start) : "N/A"}</span><span>${irText}</span></div>
      </div>`;
  }

  const stats = getFundStats(fund);
  const proj = stats.projection;
  const pace = getFundMonthlyPace(fund);
  const est = estimateFundIr(fund);
  const profitClass = stats.profit >= 0 ? "text-green" : "text-red";
  const paceClass = pace.amount >= 0 ? "text-green" : "text-red";
  const projClass = proj.profitAmount >= 0 ? "text-green" : "text-red";

  return `
    <div class="bank-card" role="button" tabindex="0" data-click="openFund" data-id="${escapeHtml(fund.id)}">
      <div class="bank-card-top">
        <span class="bank-card-title">${escapeHtml(fund.name)}${fund.irExempt ? ' <span class="inv-tag">🛡️ isento</span>' : ""}</span>
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
          <span class="toba-stat-value ${profitClass}">${signedMoney(stats.profit)}</span>
          <span class="toba-stat-sub ${profitClass}">${signedPct(stats.profitPct)}</span>
        </div>
      </div>
      <div class="toba-stats is-3 invest-card-stats inv-card-mini">
        <div class="toba-stat">
          <span class="toba-stat-label">📅 Por mês</span>
          <span class="toba-stat-value ${paceClass}">${signedMoney(pace.amount)}</span>
          <span class="toba-stat-sub">${formatPct(pace.pct)} a.m.</span>
        </div>
        <div class="toba-stat">
          <span class="toba-stat-label">🚀 12 meses</span>
          <span class="toba-stat-value ${projClass}">${signedMoney(proj.profitAmount)}</span>
          <span class="toba-stat-sub">${signedPct(proj.projectedPct)}</span>
        </div>
        <div class="toba-stat">
          <span class="toba-stat-label">🧾 IR hoje</span>
          ${irMiniHtml(est)}
        </div>
      </div>
    </div>`;
}

/* =====================================================================
 * Folha do investimento: Saldo / Aporte / Retirar / Extrato
 * ===================================================================== */
function getPopupFund() {
  const fundId = document.getElementById("popupFundIdInput").value;
  return (db.investmentFunds || []).find((f) => String(f.id) === String(fundId)) || null;
}

function heroCell(label, value, cls = "", sub = "") {
  return `<div class="inv-hero-cell"><span>${label}</span><span><b class="${cls}">${value}</b>${sub ? ` <small>${sub}</small>` : ""}</span></div>`;
}

function renderPopupHero(fund) {
  const hero = document.getElementById("popupHero");
  if (!hero) return;
  if (fund.isCofrinho) {
    const c = getCofrinhoNumbers(fund);
    const irInfo = cofrinhoIrInfo(fund);
    hero.innerHTML = `
      <div class="inv-hero-top">
        <div><div class="inv-hero-label">Saldo base</div><div class="inv-hero-value">${formatCurrency(c.totalDeposited)}</div></div>
        <div class="inv-hero-side"><div class="inv-hero-label">Desde</div><b>${shortBrDate(c.start)}</b></div>
      </div>
      <div class="inv-hero-grid">
        ${heroCell("Saques", formatCurrency(c.totalWithdrawn), "text-green", `+${formatPct(c.yieldPct)}`)}
        ${heroCell("Por mês", `~${formatCurrency(c.monthlyAmount)}`, "text-blue", `${formatPct(c.monthlyPct)} a.m.`)}
      </div>
      <div class="inv-hero-tip">${irInfo.exempt ? "🛡️ Isento de IR" : `🧾 Faixa do IR: <b>${formatRate(irInfo.rate)}</b>`}${irTipText(irInfo, 0)}</div>`;
    return;
  }
  const stats = getFundStats(fund);
  const pace = getFundMonthlyPace(fund);
  const est = estimateFundIr(fund);
  const cls = stats.profit >= 0 ? "text-green" : "text-red";
  const irTxt = est.exempt ? "🛡️ Isento de IR" : `🧾 IR hoje <b class="text-coral">-${formatCurrency(est.ir + est.iof)}</b> (${formatRate(est.rate)})`;
  hero.innerHTML = `
    <div class="inv-hero-top">
      <div><div class="inv-hero-label">Saldo atual</div><div class="inv-hero-value">${formatCurrency(stats.balance)}</div></div>
      <div class="inv-hero-side"><div class="inv-hero-label">Líquido hoje</div><b class="text-blue">${formatCurrency(stats.balance - est.ir - est.iof)}</b></div>
    </div>
    <div class="inv-hero-grid">
      ${heroCell("Investido", formatCurrency(stats.netInvested))}
      ${heroCell("Rendeu", signedMoney(stats.profit), cls, signedPct(stats.profitPct))}
      ${heroCell("Por mês", signedMoney(pace.amount), pace.amount >= 0 ? "text-green" : "text-red", `${formatPct(pace.pct)} a.m.`)}
    </div>
    <div class="inv-hero-tip">${irTxt}${irTipText(est, est.saving)}</div>`;
}

function irTipText(info, saving) {
  if (info.exempt) return ": o Leão passa fome aqui. 🦁";
  if (!info.next) return " · já tá na faixa mínima. 🦁";
  const save = saving > 0.5 ? ` (economiza ~${formatCurrency(saving)})` : "";
  return `<br>⏳ Segura mais <b>${info.next.days} dias</b> e cai pra <b>${formatRate(info.next.rate)}</b>${save}.`;
}

function openInvestActionPopup(fundId) {
  const fund = (db.investmentFunds || []).find((f) => String(f.id) === String(fundId));
  if (!fund) return;

  document.getElementById("popupFundIdInput").value = fund.id;
  const titleEl = document.getElementById("popupFundTitle");
  if (titleEl) titleEl.innerText = fund.name;

  const isCof = !!fund.isCofrinho;
  document.getElementById("invTabBal").hidden = isCof;
  document.getElementById("invTabDep").innerText = isCof ? "➕ Base" : "➕ Aporte";
  document.getElementById("invTabWd").innerText = isCof ? "🪙 Saque" : "🪙 Retirar";
  document.getElementById("invDepLabel").innerText = isCof ? "Quanto entrou na base?" : "Quanto você colocou?";
  document.getElementById("invWdLabel").innerText = isCof ? "Quanto de lucro você sacou?" : "Quanto saiu?";
  const withdrawBtn = document.getElementById("popupWithdrawBtn");
  withdrawBtn.innerText = isCof ? "💸 Efetuar saque" : "🪙 Efetuar retirada";
  withdrawBtn.className = isCof ? "btn btn-primary" : "btn btn-outline btn-gold";

  ["popupBalDate", "popupDepDate", "popupWithdrawDate"].forEach((id) => (document.getElementById(id).value = toIsoDate()));
  ["popupBalAmount", "popupDepAmount", "popupWithdrawAmount"].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("popupExemptCheck").checked = !!fund.irExempt;

  renderPopupHero(fund);
  renderPopupLogs(fund);
  switchInvAction(isCof ? "wd" : "bal");
  openTobaModal("investActionPopup");
}

function switchInvAction(tab) {
  invActionTab = tab;
  document.querySelectorAll("#popupActionTabs .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const panels = { bal: "invPanelBal", dep: "invPanelDep", wd: "invPanelWd", log: "invPanelLog" };
  Object.entries(panels).forEach(([key, id]) => (document.getElementById(id).hidden = key !== tab));
  updateInvPreview();
}

function renderPopupLogs(fund) {
  const historyList = document.getElementById("popupHistoryLogsList");
  historyList.innerHTML = "";
  const allLogs = [
    ...(fund.deposits || []).map((d) => ({ type: "aporte", id: d.id, date: d.date, amount: d.amount })),
    ...(fund.isCofrinho
      ? []
      : (fund.balanceLogs || []).filter((b) => !b.isSystem).map((b) => ({ type: "saldo", id: b.id, date: b.date, amount: b.amount }))),
    ...(fund.withdrawals || []).map((w) => ({ type: fund.isCofrinho ? "saque" : "resgate", id: w.id, date: w.date, amount: w.amount })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allLogs.length === 0) {
    historyList.innerHTML = tobaEmpty("📭", "Nenhum lançamento ainda", "", { compact: true });
    return;
  }
  allLogs.forEach((log) => {
    let logIcon = "🔄";
    let label = "Saldo";
    let color = "#d29922";
    let sign = "";
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

// Prévia ao vivo de cada aba (só texto, nada é gravado).
function updateInvPreview() {
  const fund = getPopupFund();
  if (!fund) return;
  const isCof = !!fund.isCofrinho;

  if (invActionTab === "bal" && !isCof) {
    const box = document.getElementById("invBalPreview");
    const tl = fundTimeline(fund);
    const last = tl[tl.length - 1];
    const typed = document.getElementById("popupBalAmount").value.trim();
    const date = document.getElementById("popupBalDate").value || toIsoDate();
    if (!last) {
      box.innerHTML = "Lance o saldo que o banco mostra hoje. 🏦";
      return;
    }
    const lastTxt = `Último saldo: <b>${formatCurrency(last.amount)}</b> em ${shortBrDate(last.date)}`;
    if (!typed || date <= last.date) {
      box.className = "hint-box";
      box.innerHTML = `${lastTxt}.${date < last.date ? "<br>⚠️ Essa data é antes do último saldo." : ""}`;
      return;
    }
    const amount = getMoney("popupBalAmount");
    const flows =
      sumAmounts((fund.deposits || []).filter((d) => d.date > last.date && d.date <= date)) -
      sumAmounts((fund.withdrawals || []).filter((w) => w.date > last.date && w.date <= date));
    const gain = amount - (last.amount + flows);
    const days = Math.max(daysBetween(last.date, date), 1);
    const perMonth = (gain / days) * MONTH_DAYS;
    const base = last.amount + flows;
    const pctMonth = base > 0 && amount > 0 ? (Math.pow(amount / base, MONTH_DAYS / days) - 1) * 100 : 0;
    box.className = `hint-box ${gain >= 0 ? "is-green" : ""}`;
    const pace = days >= 7 ? ` ≈ <b>${signedMoney(perMonth)}/mês</b> (${formatPct(pctMonth)} a.m.)` : "";
    box.innerHTML = `${lastTxt}<br>${gain >= 0 ? "🚀" : "📉"} Rendeu <b>${signedMoney(gain)}</b> em ${days} ${days === 1 ? "dia" : "dias"}${pace}`;
    return;
  }

  if (invActionTab === "dep") {
    const box = document.getElementById("invDepPreview");
    const amount = getMoney("popupDepAmount");
    const now = isCof ? sumAmounts(fund.deposits) : getFundStats(fund).netInvested;
    const label = isCof ? "Saldo base" : "Investido";
    let html = `${label}: <b>${formatCurrency(now)}</b>${amount > 0 ? ` → <b>${formatCurrency(now + amount)}</b>` : ""}`;
    if (!isCof && !fund.irExempt) html += `<br><small>🧾 Aporte novo começa o prazo do IR do zero (22,5% nos primeiros 180 dias).</small>`;
    box.innerHTML = html;
    return;
  }

  if (invActionTab === "wd") {
    const box = document.getElementById("invWdPreview");
    const amount = getMoney("popupWithdrawAmount");
    if (isCof) {
      const now = sumAmounts(fund.withdrawals);
      const irInfo = cofrinhoIrInfo(fund);
      box.className = "hint-box is-green";
      box.innerHTML = `Lucro sacado: <b>${formatCurrency(now)}</b>${amount > 0 ? ` → <b>${formatCurrency(now + amount)}</b>` : ""}${!irInfo.exempt ? `<br><small>🧾 Faixa do IR agora: ${formatRate(irInfo.rate)} (o banco já desconta no saque).</small>` : ""}`;
      return;
    }
    const stats = getFundStats(fund);
    box.className = "hint-box";
    if (amount > stats.balance + 0.005) {
      box.innerHTML = `⚠️ Isso é mais que o saldo (${formatCurrency(stats.balance)}).`;
    } else {
      box.innerHTML = `Saldo fica em <b>${formatCurrency(stats.balance - amount)}</b>.<br><small>Pra encerrar de vez, use 🏁 Finalizar.</small>`;
    }
  }
}

function toggleFundExempt(el) {
  const fund = getPopupFund();
  if (!fund) return;
  fund.irExempt = !!el.checked;
  saveDatabase();
  renderPopupHero(fund);
  updateInvPreview();
}

function openEditFundNameModalFromPopup() {
  const fund = getPopupFund();
  if (!fund) return;
  closeTobaModal("investActionPopup");
  openEditFundNameModal(fund.id, fund.name);
}

function submitPopupBalance() {
  const fund = getPopupFund();
  if (!fund) return;
  const date = document.getElementById("popupBalDate").value || toIsoDate();
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
  const fund = getPopupFund();
  if (!fund) return;
  const date = document.getElementById("popupDepDate").value || toIsoDate();
  const amount = getMoney("popupDepAmount");
  if (amount <= 0) {
    showPageMessage("Informe o valor do aporte.", { title: "Faltou o valor", icon: "✍️" });
    return;
  }
  if (!fund.deposits) fund.deposits = [];
  fund.deposits.push({ id: Date.now().toString(), date, amount });
  saveDatabase();
  closeTobaModal("investActionPopup");
  renderInvestmentsScreen();
}

function submitPopupWithdraw() {
  const fund = getPopupFund();
  if (!fund) return;
  const date = document.getElementById("popupWithdrawDate").value || toIsoDate();
  const amount = getMoney("popupWithdrawAmount");
  if (amount <= 0) {
    showPageMessage("Informe o valor da retirada.", { title: "Faltou o valor", icon: "✍️" });
    return;
  }
  // Nos investimentos, o saldo depois da retirada é derivado em getFundStats.
  if (!fund.withdrawals) fund.withdrawals = [];
  fund.withdrawals.push({ id: Date.now().toString(), date, amount });
  saveDatabase();
  closeTobaModal("investActionPopup");
  renderInvestmentsScreen();
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
    switchInvAction("log");
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
  document.getElementById("btnToggleCofrinhos").innerText = cofrinhosVisible ? "🐷 Esconder cofrinhos" : "🐷 Ver cofrinhos";
}

function openNewFundModal(isCofrinho = false) {
  document.getElementById("fundIsCofrinhoValue").value = isCofrinho ? "true" : "false";
  document.getElementById("newFundModalTitle").innerText = isCofrinho ? "🐷 Novo cofrinho" : "📈 Novo investimento";
  document.getElementById("fundNameInput").value = "";
  document.getElementById("fundInitialAmountInput").value = "";
  document.getElementById("fundInitialDateInput").value = toIsoDate();
  setNewFundExempt("false");
  openTobaModal("newFundModal");
  setTimeout(() => document.getElementById("fundNameInput").focus(), 100);
}

function setNewFundExempt(value) {
  document.getElementById("fundExemptValue").value = value === "true" ? "true" : "false";
  setActiveIn("#fundExemptGroup [data-exempt]", "data-exempt", value === "true" ? "true" : "false");
}

function openEditFundNameModal(fundId, currentName) {
  document.getElementById("editFundNameId").value = fundId;
  document.getElementById("editFundNameInput").value = currentName;
  openTobaModal("editFundNameModal");
  setTimeout(() => document.getElementById("editFundNameInput").focus(), 100);
}

function saveFundName() {
  const fundId = document.getElementById("editFundNameId").value;
  const newName = document.getElementById("editFundNameInput").value.trim();
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (fund && newName) {
    fund.name = newName;
    saveDatabase();
    closeTobaModal("editFundNameModal");
  }
}

/* ---------- Resgatar / finalizar, com prévia do IR ---------- */
function getFinishFund() {
  const fundId = document.getElementById("finishFundIdInput").value;
  return (db.investmentFunds || []).find((f) => String(f.id) === String(fundId)) || null;
}

function calcFinishIrPreview(fund) {
  if (!fund || fund.isCofrinho) return null;
  const stats = getFundStats(fund);
  const gross = getMoney("finishGrossAmount");
  const date = document.getElementById("finishDateInput").value || toIsoDate();
  return estimateFundIr(fund, { at: date, profit: gross - stats.netInvested });
}

function openFinishFundModal(fundId) {
  const fund = db.investmentFunds.find((f) => String(f.id) === String(fundId));
  if (!fund) return;

  const stats = getFundStats(fund);
  const realProfit = Math.max(stats.profit, 0);

  document.getElementById("finishFundIdInput").value = fund.id;
  const profitAlert = document.getElementById("availableProfitAlert");
  if (profitAlert) profitAlert.innerText = `Lucro disponível: ${formatCurrency(realProfit)}`;

  document.getElementById("finishDateInput").value = toIsoDate();
  document.getElementById("rescueAmountInput").value = "";
  document.getElementById("finishGrossAmount").value = formatMoneyInput(stats.balance);
  finishIrTouched = false;
  const est = calcFinishIrPreview(fund);
  document.getElementById("finishIrAmount").value = formatMoneyInput(est ? est.ir + est.iof : 0);

  document.getElementById("rescueTypeSelect").value = "partial";
  toggleRescueType();
  openTobaModal("finishFundModal");
}

function toggleRescueType() {
  const type = document.getElementById("rescueTypeSelect").value;
  const partialBox = document.getElementById("partialRescueSection");
  const totalBox = document.getElementById("totalRescueSection");
  if (partialBox && totalBox) {
    partialBox.hidden = type !== "partial";
    totalBox.hidden = type === "partial";
  }
  const btn = document.getElementById("confirmRescueBtn");
  if (btn) btn.innerText = type === "partial" ? "Confirmar retirada" : "💀 Encerrar investimento";
  updateFinishNetPreview();
}

function onFinishIrInput() {
  finishIrTouched = true;
  updateFinishNetPreview();
}

function useFinishIrPreview() {
  const est = calcFinishIrPreview(getFinishFund());
  if (!est) return;
  finishIrTouched = false;
  document.getElementById("finishIrAmount").value = formatMoneyInput(est.ir + est.iof);
  updateFinishNetPreview();
}

function updateFinishNetPreview() {
  const fund = getFinishFund();
  const est = calcFinishIrPreview(fund);
  const hint = document.getElementById("finishIrHint");
  if (est && !finishIrTouched) {
    document.getElementById("finishIrAmount").value = formatMoneyInput(est.ir + est.iof);
  }
  if (hint) {
    if (!est) {
      hint.hidden = true;
    } else {
      hint.hidden = false;
      if (est.exempt) hint.innerHTML = "🛡️ Investimento isento: IR zero.";
      else if (est.profit <= 0) hint.innerHTML = "🧾 Sem lucro, sem IR. 🤷";
      else {
        const iofTxt = est.iof > 0.005 ? ` + IOF ${formatCurrency(est.iof)}` : "";
        hint.innerHTML = `🧾 Prévia pela tabela: <b>${formatRate(est.rate)}</b> (${est.days} dias) sobre ${formatCurrency(est.profit)} de lucro = <b>${formatCurrency(est.ir)}</b>${iofTxt}.${finishIrTouched ? " <u>Toque pra usar a prévia.</u>" : " Confere com o extrato do banco!"}`;
      }
    }
  }
  const gross = getMoney("finishGrossAmount");
  const ir = getMoney("finishIrAmount");
  const net = Math.max(gross - ir, 0);
  document.getElementById("finishNetPreview").innerText = `Valor líquido no bolso: ${formatCurrency(net)}`;
}

function confirmFinishFund() {
  const fund = getFinishFund();
  const rescueType = document.getElementById("rescueTypeSelect").value;
  const rescueDate = document.getElementById("finishDateInput").value || toIsoDate();
  if (!fund) return;

  if (rescueType === "partial") {
    const withdrawAmount = getMoney("rescueAmountInput");
    if (withdrawAmount <= 0)
      return showPageMessage("Informe um valor de resgate válido!", { title: "Faltou o valor", icon: "✍️" });

    // O saldo depois da retirada é derivado em getFundStats.
    if (!fund.withdrawals) fund.withdrawals = [];
    fund.withdrawals.push({ id: Date.now().toString(), date: rescueDate, amount: withdrawAmount });
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
    fund.balanceLogs.push({ id: Date.now().toString(), date: rescueDate, amount: finalGrossAmount, isSystem: true });
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
  db.investmentFunds = db.investmentFunds.filter((f) => String(f.id) !== String(fundId));
  saveDatabase();
  renderInvestmentsScreen();
  return true;
}

/* =====================================================================
 * Gráficos
 * ===================================================================== */
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

// "📅 Mês a mês": abre direto na aba Por mês (a lista funciona até sem internet).
function openMonthlyChart() {
  chartVisibleAssets.clear();
  switchView("patrimonyChart");
  switchChartTab("monthly");
}

/* ⏪ Evolução: saldo de verdade no fim de cada mês (pelos saldos lançados). */
function renderPatrimonyChart(period) {
  if (typeof Chart === "undefined") return;
  const ctx = document.getElementById("patrimonyChartCanvas").getContext("2d");
  const activeFunds = (db.investmentFunds || []).filter((f) => !f.isFinished);
  const today = toIsoDate();
  const now = new Date();

  const starts = activeFunds.map(firstDepositDate).filter(Boolean).sort();
  const monthsSinceFirst = starts.length
    ? (now.getFullYear() - parseIsoLocal(starts[0]).getFullYear()) * 12 + now.getMonth() - parseIsoLocal(starts[0]).getMonth() + 1
    : 3;
  let countPoints = period === "6m" ? 6 : period === "1y" ? 12 : period === "all" ? Math.min(Math.max(monthsSinceFirst, 2), 60) : 3;

  // Datas do eixo: fim dos meses anteriores + hoje.
  const dates = [];
  for (let i = countPoints - 1; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    dates.push(endOfMonthIso(d.getFullYear(), d.getMonth()));
  }
  dates.push(today);

  const labels = chartAlignMode
    ? Array.from({ length: countPoints }, (_, i) => (i === 0 ? "Início" : `Mês ${i}`))
    : dates.map((d, i) => (i === dates.length - 1 ? "Hoje" : monthLabel(d)));

  const datasets = [];
  const assetListEl = document.getElementById("assetColorList");
  assetListEl.innerHTML = "";

  activeFunds.forEach((fund, index) => {
    const color = FUND_COLORS[index % FUND_COLORS.length];
    const isCofrinho = fund.isCofrinho;
    const isDisabledInMode = isCofrinho && chartMode === "brl";

    const li = document.createElement("li");
    if (isDisabledInMode) li.className = "is-disabled";
    li.innerHTML = `
      <label>
        <input type="checkbox" ${!chartVisibleAssets.has(String(fund.id)) && !isDisabledInMode ? "checked" : ""} ${isDisabledInMode ? "disabled" : ""} data-change="toggleChartAsset" data-id="${escapeHtml(fund.id)}">
        <span class="asset-dot" style="background-color: ${color}"></span>
        <span>${isCofrinho ? "🐷 " : "📈 "}${escapeHtml(fund.name)} ${isDisabledInMode ? "(só em %)" : ""}</span>
      </label>`;
    assetListEl.appendChild(li);

    if (chartVisibleAssets.has(String(fund.id)) || isDisabledInMode) return;

    const tl = fundTimeline(fund);
    if (!tl.length) return;
    // Alinhar: cada um a partir do próprio começo, de mês em mês.
    const sampleDates = chartAlignMode
      ? Array.from({ length: countPoints }, (_, i) => addMonthsIso(tl[0].date, i)).map((d) => (d > today ? null : d))
      : dates;

    const raw = sampleDates.map((d) => {
      if (!d) return null;
      const v = fundValueAt(fund, d, tl);
      if (!v) return null;
      if (chartMode === "pct") return v.invested > 0 ? (v.gain / v.invested) * 100 : 0;
      return v.value;
    });
    if (chartAlignMode) {
      // O último ponto alinhado é sempre "hoje" (se o mês ainda não fechou).
      const lastIdx = raw.findIndex((v) => v === null);
      if (lastIdx > 0 && lastIdx < countPoints) {
        const v = fundValueAt(fund, today, tl);
        if (v) raw[lastIdx] = chartMode === "pct" ? (v.invested > 0 ? (v.gain / v.invested) * 100 : 0) : v.value;
      }
      if (chartMode === "brl") {
        const base = raw[0] || 0;
        for (let i = 0; i < raw.length; i++) if (raw[i] !== null) raw[i] -= base;
      }
    }

    datasets.push({
      label: fund.name,
      data: raw.map((v) => (v === null ? null : Number(v.toFixed(2)))),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2.5,
      tension: 0.3,
      cubicInterpolationMode: "monotone",
      pointRadius: (c) => (c.dataIndex === c.dataset.data.length - 1 || countPoints <= 6 ? 3 : 0),
      pointHoverRadius: 5,
      spanGaps: false,
    });
  });

  const note = document.getElementById("pastChartNote");
  if (note) {
    note.innerText = chartAlignMode
      ? (chartMode === "brl" ? "🏁 Todo mundo largando junto: quanto cada um ganhou desde o próprio começo." : "🏁 Todo mundo largando junto: % que cada um rendeu desde o próprio começo.")
      : "Os pontos vêm dos saldos que você lançou. Entre um lançamento e outro o Toba divide o rendimento por dia.";
  }

  if (patrimonyChartInstance) patrimonyChartInstance.destroy();
  patrimonyChartInstance = null;
  const pastCard = document.getElementById("patrimonyChartCanvas").parentElement;
  pastCard.hidden = !activeFunds.length;
  if (!activeFunds.length) {
    assetListEl.innerHTML = tobaEmpty("🌱", "Nada rendendo ainda", "Crie um investimento e o gráfico aparece aqui.", { compact: true });
    return;
  }
  const isPct = chartMode === "pct";
  patrimonyChartInstance = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: baseChartOptions({
      yFormat: (v) => (isPct ? `${Number(v).toLocaleString("pt-BR")}%` : compactMoney(v)),
      tooltipLabel: (c) => ` ${c.dataset.label}: ${isPct ? formatPct(c.parsed.y) : formatCurrency(c.parsed.y)}`,
    }),
  });
}

/* 📅 Por mês: barras do rendimento de cada mês + lista com o detalhe. */
function renderMonthlyView() {
  const monthlyData = calcMonthlyYields();
  const now = new Date();
  const currentKey = getCurrentMonthKey();
  const allKeys = Object.keys(monthlyData).filter((k) => k <= currentKey).sort();

  let keys = allKeys;
  if (currentMonthlyPeriod !== "all") {
    const n = currentMonthlyPeriod === "6m" ? 6 : 12;
    keys = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    // Começa no 1º mês que tem rendimento (sem um monte de barra vazia antes).
    const firstWithData = keys.findIndex((k) => monthlyData[k]);
    keys = firstWithData >= 0 ? keys.slice(firstWithData) : [];
  }

  const totalOf = (k) => (monthlyData[k] ? monthlyData[k].investYield + monthlyData[k].cofrinhoYield : 0);
  const closedKeys = keys.filter((k) => k < currentKey && monthlyData[k]);
  const avg = closedKeys.length ? closedKeys.reduce((a, k) => a + totalOf(k), 0) / closedKeys.length : 0;
  const best = keys.reduce((b, k) => (totalOf(k) > (b ? totalOf(b) : -Infinity) ? k : b), null);
  const label = (k) => {
    const [y, m] = k.split("-");
    return `${SHORT_MONTHS[Number(m) - 1]}/${y.slice(-2)}`;
  };

  document.getElementById("monthlyStatsBox").innerHTML = `
    <div class="toba-stat"><span class="toba-stat-label">Este mês</span><span class="toba-stat-value ${totalOf(currentKey) >= 0 ? "text-green" : "text-red"}">${signedMoney(totalOf(currentKey))}</span><span class="toba-stat-sub">até o último saldo</span></div>
    <div class="toba-stat"><span class="toba-stat-label">Média/mês</span><span class="toba-stat-value text-blue">${signedMoney(avg)}</span><span class="toba-stat-sub">${closedKeys.length} ${closedKeys.length === 1 ? "mês fechado" : "meses fechados"}</span></div>
    <div class="toba-stat"><span class="toba-stat-label">Melhor mês</span><span class="toba-stat-value text-gold">${best ? signedMoney(totalOf(best)) : "--"}</span><span class="toba-stat-sub">${best ? label(best) : ""}</span></div>`;

  const chartCard = document.getElementById("monthlyChartCanvas").parentElement;
  chartCard.hidden = typeof Chart === "undefined" || !keys.length;
  if (!chartCard.hidden) {
    const ctx = document.getElementById("monthlyChartCanvas").getContext("2d");
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    const hasCof = keys.some((k) => monthlyData[k] && monthlyData[k].cofrinhoYield);
    const datasets = [{
      label: "📈 Longo prazo",
      data: keys.map((k) => Number(((monthlyData[k] && monthlyData[k].investYield) || 0).toFixed(2))),
      backgroundColor: keys.map((k) => (k === currentKey ? hexAlpha("#3fb950", 0.45) : "#3fb950")),
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 34,
    }];
    if (hasCof) {
      datasets.push({
        label: "🐷 Cofrinhos",
        data: keys.map((k) => Number(((monthlyData[k] && monthlyData[k].cofrinhoYield) || 0).toFixed(2))),
        backgroundColor: keys.map((k) => (k === currentKey ? hexAlpha("#ff7b72", 0.45) : "#ff7b72")),
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 34,
      });
    }
    if (closedKeys.length >= 2) {
      datasets.push({
        type: "line",
        label: "Média",
        data: keys.map(() => Number(avg.toFixed(2))),
        borderColor: "#58a6ff",
        borderDash: [5, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        stack: "media",
      });
    }
    monthlyChartInstance = new Chart(ctx, {
      type: "bar",
      data: { labels: keys.map((k) => (k === currentKey ? "Agora" : label(k))), datasets },
      options: baseChartOptions({
        stacked: true,
        legend: hasCof,
        yFormat: (v) => compactMoney(v),
        tooltipLabel: (c) => ` ${c.dataset.label}: ${formatCurrency(c.parsed.y)}`,
      }),
    });
  }

  // Lista mês a mês (mais recente primeiro), cada mês abre o detalhe por ativo.
  const content = document.getElementById("investmentsHistoryContent");
  const listKeys = keys.filter((k) => monthlyData[k]).reverse();
  if (!listKeys.length) {
    content.innerHTML = tobaEmpty("📭", "Nenhum rendimento ainda", "Atualize o saldo de um investimento e o mês aparece aqui.");
    return;
  }
  content.innerHTML = listKeys
    .map((mKey) => {
      const [y, m] = mKey.split("-");
      const data = monthlyData[mKey];
      const total = data.investYield + data.cofrinhoYield;
      const base = data.investBase + data.cofrinhoBase;
      const pct = base > 0 ? (total / base) * 100 : 0;
      const perFund = {};
      data.details.forEach((d) => {
        if (!perFund[d.fundId]) perFund[d.fundId] = { name: d.name, amount: 0 };
        perFund[d.fundId].amount += d.yieldAmount;
      });
      const rows = Object.values(perFund)
        .sort((a, b) => b.amount - a.amount)
        .map((f) => `<div class="kv-row"><span>${escapeHtml(f.name)}</span><span class="${f.amount >= 0 ? "text-green" : "text-red"}">${signedMoney(f.amount)}</span></div>`)
        .join("");
      return `
        <details class="inv-month">
          <summary>
            <span class="inv-month-name">${formatMonthYearLabel(y, parseInt(m, 10) - 1)}${mKey === currentKey ? ' <span class="inv-tag">em andamento</span>' : ""}</span>
            <span class="inv-month-val"><b class="${total >= 0 ? "text-green" : "text-red"}">${signedMoney(total)}</b>${base > 0 ? `<small>${signedPct(pct)}</small>` : ""}</span>
          </summary>
          <div class="kv-list">
            ${data.investBase > 0 ? `<div class="kv-row is-sub"><span>📈 Longo prazo</span><span>${signedMoney(data.investYield)}</span></div>` : ""}
            ${data.cofrinhoBase > 0 ? `<div class="kv-row is-sub"><span>🐷 Cofrinhos</span><span>${signedMoney(data.cofrinhoYield)}</span></div>` : ""}
            ${rows}
          </div>
        </details>`;
    })
    .join("");
}

/* 🏆 Ranking: % ao mês de cada ativo, bruto e depois do IR da faixa de hoje. */
function getRankRows() {
  const activeFunds = (db.investmentFunds || []).filter((f) => !f.isFinished);
  return activeFunds
    .map((fund, index) => {
      const pace = getFundMonthlyPace(fund);
      const irRate = fund.isCofrinho ? cofrinhoIrInfo(fund).rate : estimateFundIr(fund).rate;
      return {
        fund,
        color: FUND_COLORS[index % FUND_COLORS.length],
        gross: pace.pct,
        net: pace.pct > 0 ? pace.pct * (1 - irRate / 100) : pace.pct,
        amount: pace.amount,
        irRate,
      };
    })
    .sort((a, b) => b.net - a.net);
}

function renderRankChart() {
  const rows = getRankRows();
  const list = document.getElementById("rankList");
  const card = document.getElementById("rankChartCard");
  if (!rows.length) {
    card.hidden = true;
    list.innerHTML = tobaEmpty("🏆", "Ninguém na pista ainda", "Crie um investimento e volta aqui pro pódio.");
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  list.innerHTML = `<div class="card kv-list inv-rank-list">${rows
    .map((r, i) => `
      <div class="inv-rank-row">
        <span class="inv-rank-pos">${medals[i] || `${i + 1}º`}</span>
        <span class="inv-rank-main">
          <span class="inv-rank-name"><span class="asset-dot" style="background-color: ${r.color}"></span>${r.fund.isCofrinho ? "🐷" : "📈"} ${escapeHtml(r.fund.name)}</span>
          <span class="inv-rank-meta">${formatPct(r.gross)} a.m. bruto · ~${formatCurrency(r.amount)}/mês</span>
        </span>
        <span class="inv-rank-side"><b class="text-green">${formatPct(r.net)}</b><small>${r.irRate ? `líq. (IR ${formatRate(r.irRate)})` : "🛡️ isento"}</small></span>
      </div>`)
    .join("")}</div>`;

  card.hidden = typeof Chart === "undefined";
  if (card.hidden) return;
  card.style.height = `${Math.max(180, 70 + rows.length * 46)}px`;
  const ctx = document.getElementById("rankChartCanvas").getContext("2d");
  if (rankChartInstance) rankChartInstance.destroy();
  rankChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => (r.fund.name.length > 16 ? `${r.fund.name.slice(0, 15)}…` : r.fund.name)),
      datasets: [
        { label: "Bruto", data: rows.map((r) => Number(r.gross.toFixed(3))), backgroundColor: rows.map((r) => hexAlpha(r.color, 0.35)), borderRadius: 5, borderSkipped: false, barPercentage: 0.9, categoryPercentage: 0.75 },
        { label: "Depois do IR", data: rows.map((r) => Number(r.net.toFixed(3))), backgroundColor: rows.map((r) => r.color), borderRadius: 5, borderSkipped: false, barPercentage: 0.9, categoryPercentage: 0.75 },
      ],
    },
    options: baseChartOptions({
      indexAxis: "y",
      legend: true,
      yFormat: (v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
      tooltipLabel: (c) => ` ${c.dataset.label}: ${formatPct(c.parsed.x)} a.m.`,
    }),
  });
}

/* 🔮 Futuro: juros compostos + aporte mensal opcional, com IR estimado. */
function renderProjectionChart(period) {
  const activeFunds = (db.investmentFunds || []).filter((f) => !f.isFinished);

  let totalCurrentBal = 0;
  let weightedDailyRateSum = 0;
  let exemptBal = 0;
  activeFunds.forEach((fund) => {
    let latestBal;
    let dailyRate = 0;
    if (fund.isCofrinho) {
      const c = getCofrinhoNumbers(fund);
      latestBal = c.totalDeposited + c.totalWithdrawn;
      dailyRate = c.totalDeposited > 0 && latestBal > 0 ? c.dailyRate : 0;
    } else {
      const stats = getFundStats(fund);
      latestBal = stats.balance;
      dailyRate = stats.dailyRate;
    }
    totalCurrentBal += latestBal;
    weightedDailyRateSum += dailyRate * latestBal;
    if (fund.irExempt) exemptBal += latestBal;
  });
  const globalDailyRate = totalCurrentBal > 0 ? weightedDailyRateSum / totalCurrentBal : 0;
  const monthlyRate = Math.pow(1 + globalDailyRate, MONTH_DAYS) - 1;

  const months = period === "5y" ? 60 : period === "1y" ? 12 : 6;
  const labels = [];
  const dataPoints = [];
  const investedPoints = [];
  const currentDate = new Date();
  let value = totalCurrentBal;
  for (let i = 0; i <= months; i++) {
    const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    labels.push(i === 0 ? "Hoje" : `${SHORT_MONTHS[futureDate.getMonth()]}/${String(futureDate.getFullYear()).slice(-2)}`);
    dataPoints.push(Number(value.toFixed(2)));
    investedPoints.push(Number((totalCurrentBal + projMonthlyAdd * i).toFixed(2)));
    value = value * (1 + monthlyRate) + projMonthlyAdd;
  }

  if (typeof Chart !== "undefined") {
    const ctx = document.getElementById("projectionChartCanvas").getContext("2d");
    if (projectionChartInstance) projectionChartInstance.destroy();
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(63, 185, 80, 0.35)");
    gradient.addColorStop(1, "rgba(63, 185, 80, 0)");
    projectionChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Patrimônio", data: dataPoints, borderColor: "#3fb950", backgroundColor: gradient, borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 5, tension: 0.35 },
          { label: "O que você colocou", data: investedPoints, borderColor: "#8b949e", borderDash: [5, 4], borderWidth: 1.5, fill: false, pointRadius: 0, tension: 0 },
        ],
      },
      options: baseChartOptions({
        legend: true,
        yFormat: (v) => compactMoney(v),
        tooltipLabel: (c) => ` ${c.dataset.label}: ${formatCurrency(c.parsed.y)}`,
      }),
    });
  }

  const finalVal = dataPoints[dataPoints.length - 1];
  const putIn = projMonthlyAdd * months;
  const interest = finalVal - totalCurrentBal - putIn;
  const irRate = irRateForDays(Math.round(months * MONTH_DAYS));
  const taxedShare = totalCurrentBal > 0 ? 1 - exemptBal / totalCurrentBal : 1;
  const irEst = Math.max(interest, 0) * taxedShare * (irRate / 100);
  const yearsStr = months >= 12 ? `${months / 12} ${months === 12 ? "ano" : "anos"}` : `${months} meses`;

  document.getElementById("projectionSummaryBox").innerHTML = `
    <div class="card-title">Daqui a ${yearsStr}</div>
    <div class="finished-summary-value">${formatCurrency(finalVal)}</div>
    <div class="kv-row"><span>Hoje</span><span>${formatCurrency(totalCurrentBal)}</span></div>
    ${putIn > 0 ? `<div class="kv-row"><span>💸 Você coloca</span><span class="text-blue">+${formatCurrency(putIn)}</span></div>` : ""}
    <div class="kv-row"><span>🚀 Juros trabalhando</span><span class="text-green">${signedMoney(interest)}</span></div>
    <div class="kv-row"><span>🧾 IR estimado (${formatRate(irRate)})</span><span class="text-coral">-${formatCurrency(irEst)}</span></div>
    <div class="kv-row is-total"><span>Líquido no bolso</span><span class="text-green">${formatCurrency(finalVal - irEst)}</span></div>
    <div class="kv-row"><span>Taxa usada</span><span>${formatPct(monthlyRate * 100)} a.m.</span></div>`;
}

/* NAVEGAÇÃO ENTRE AS TELAS DO MÓDULO */
function switchView(viewName) {
  document.querySelectorAll(".app-view").forEach((view) => view.classList.remove("active"));
  const viewMap = { investments: "viewInvestments", patrimonyChart: "viewPatrimonyChart" };
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
  if (document.getElementById("viewInvestments")?.classList.contains("active")) renderInvestmentsScreen();
}

function createFund() {
  const name = document.getElementById("fundNameInput").value.trim();
  const initialAmount = getMoney("fundInitialAmountInput");
  const initialDate = document.getElementById("fundInitialDateInput").value;
  const isCofrinho = document.getElementById("fundIsCofrinhoValue").value === "true";
  const irExempt = document.getElementById("fundExemptValue").value === "true";

  if (!name || initialAmount <= 0 || !initialDate) {
    showPageMessage("Preencha o nome, o aporte inicial e a data.", { title: "Quase lá", icon: "✍️" });
    return;
  }

  const newFund = {
    id: Date.now().toString(),
    name: name,
    isCofrinho: isCofrinho,
    deposits: [{ id: Date.now().toString(), date: initialDate, amount: initialAmount }],
    balanceLogs: isCofrinho
      ? []
      : [{ id: (Date.now() + 1).toString(), date: initialDate, amount: initialAmount, isSystem: true }],
    withdrawals: [],
    isFinished: false,
    irExempt: irExempt,
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
  toggleFinishedList,
  openMonthlyChart,
  openPatrimonyChart,
  backToInvestments: () => switchView("investments"),
  renderInvestmentsScreen,
  switchChartTab: (el) => switchChartTab(el.dataset.tab),
  changeChartMode: (el) => changeChartMode(el.dataset.mode),
  toggleAlignMode,
  changeChartPeriod: (el) => changeChartPeriod(el.dataset.period),
  changeProjPeriod: (el) => changeProjPeriod(el.dataset.period),
  changeProjMonthly: (el) => changeProjMonthly(el.dataset.amount),
  changeMonthlyPeriod: (el) => changeMonthlyPeriod(el.dataset.period),
  toggleChartAsset: (el) => toggleChartAsset(el.dataset.id),
  switchInvAction: (el) => switchInvAction(el.dataset.tab),
  updateInvPreview,
  toggleFundExempt,
  setNewFundExempt: (el) => setNewFundExempt(el.dataset.exempt),
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
  onFinishIrInput,
  useFinishIrPreview,
  confirmFinishFund,
  saveFundName,
  createFund,
});

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  switchView("investments");
});
