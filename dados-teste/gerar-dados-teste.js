/* =====================================================================
 * Gerador de dados de TESTE do Toba Solutions
 * Uso:  node dados-teste/gerar-dados-teste.js [YYYY-MM-DD]
 *   - A data opcional é o "hoje" da simulação (padrão: hoje). Os dados
 *     cobrem os 11 meses anteriores + o mês atual até esse dia.
 *   - Os números são sorteados com semente fixa: mesma data = mesmo arquivo.
 * Gera, nesta mesma pasta:
 *   - toba_backup_teste_completo.json  → Portal ⚙️ → Backup → Restaurar
 *   - toba_bank_backup_teste.json      → Toba Bank ⚙️ → Restaurar
 *   - toba_health_backup_teste.json    → Toba Health ⚙️ → Importar
 * O formato segue exatamente o que o app grava (ver CLAUDE.md).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");

// ---------- utilidades ----------
let seed = 20251101;
function rand() {
  // mulberry32: aleatório determinístico
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + rand() * (b - a);
const money = (a, b) => Math.round(between(a, b) * 100) / 100;
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();

// IDs no estilo do app (Date.now() do dia do lançamento, sempre únicos)
let idBump = 0;
const tsOf = (dateStr, hour = 12) => parse(dateStr).getTime() + (hour - 12) * 3600000 + (idBump++) * 1371;
const strId = (dateStr, hour) => String(tsOf(dateStr, hour));

// ---------- período ----------
const TODAY = process.argv[2] ? parse(process.argv[2]) : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12); })();
const START = new Date(TODAY.getFullYear(), TODAY.getMonth() - 11, 1, 12);
const TODAY_ISO = iso(TODAY);
const monthsList = [];
for (let i = 0; i < 12; i++) monthsList.push(new Date(START.getFullYear(), START.getMonth() + i, 1, 12));
const mIdx = (d) => (d.getFullYear() - START.getFullYear()) * 12 + d.getMonth() - START.getMonth(); // 0..11
const dateAtMonth = (i, day) => { const m = monthsList[i]; return iso(new Date(m.getFullYear(), m.getMonth(), Math.min(day, daysInMonth(m.getFullYear(), m.getMonth())), 12)); };
const notFuture = (s) => s <= TODAY_ISO;

/* =====================================================================
 * TOBA BANK
 * ===================================================================== */
function fixedFor(i) {
  // Reajuste do aluguel e das assinaturas no 5º mês; Game Pass entra no 6º.
  const newer = i >= 4;
  const list = [
    ["Aluguel + condomínio", newer ? 2180 : 2050, "Moradia - Aluguel/Condomínio"],
    ["Conta de luz (média)", 180, "Moradia - Contas Básicas (Luz/Água/Internet)"],
    ["Água e gás", 85, "Moradia - Contas Básicas (Luz/Água/Internet)"],
    ["Internet fibra 500mb", 109.9, "Moradia - Contas Básicas (Luz/Água/Internet)"],
    ["Plano do celular", 59.99, "Moradia - Contas Básicas (Luz/Água/Internet)"],
    ["Plano de saúde", 389, "Saúde & Bem-Estar"],
    ["Academia", newer ? 129.9 : 119.9, "Saúde & Bem-Estar"],
    ["Netflix", newer ? 44.9 : 39.9, "Assinaturas"],
    ["Spotify", 21.9, "Assinaturas"],
  ];
  if (i >= 5) list.push(["Xbox Game Pass", 59.99, "Games"]);
  return list.map(([name, amount, category], k) => ({ id: String(1762000000000 + k * 1000 + (i >= 4 && k === 0 ? 7 : 0)), name, amount, category }));
}

const transactions = [];
function tx(date, description, amount, category) {
  if (!notFuture(date)) return;
  transactions.push({ id: strId(date, int(8, 22)), description, amount: r2(amount), category, date });
}

const restaurantes = ["Almoço no PF da esquina", "iFood - Japa", "iFood - Hambúrguer", "Almoço no trabalho", "Padaria (café da manhã)", "iFood - Pizza", "Marmita fitness", "Açaí", "Lanche no shopping", "Café com pão de queijo"];
const mercados = ["Mercado da semana", "Mercado - reposição", "Feira de sábado", "Atacadão (compra do mês)", "Hortifruti"];
const roles = ["Bar com a galera", "Cinema", "Barzinho sexta", "Happy hour do trampo", "Show no Audio", "Boliche", "Rodízio com os amigos"];
const games = ["Skin no Valorant", "Jogo na promo da Steam", "Passe de batalha", "DLC do Elden Ring"];

for (let d = new Date(START); iso(d) <= TODAY_ISO; d = addDays(d, 1)) {
  const ds = iso(d), dow = d.getDay(), dom = d.getDate(), m = d.getMonth(), i = mIdx(d);
  const vacation = m === 6 && dom >= 10 && dom <= 19; // julho: viagem
  // Mercado: sábado (às vezes quarta também)
  if (dow === 6 && !vacation) tx(ds, dom <= 7 ? "Atacadão (compra do mês)" : pick(mercados), dom <= 7 ? money(320, 430) : money(110, 210), "Mercado");
  if (dow === 3 && chance(0.25)) tx(ds, "Hortifruti", money(30, 65), "Mercado");
  // Comida fora
  if (dow >= 1 && dow <= 5 && chance(0.35) && !vacation) tx(ds, pick(restaurantes), money(16, 48), "Alimentação");
  if ((dow === 0 || dow === 5) && chance(0.3)) tx(ds, pick(["iFood - Pizza", "iFood - Japa", "iFood - Hambúrguer"]), money(50, 95), "Alimentação");
  // Rolês
  if ((dow === 5 || dow === 6) && chance(0.3) && !vacation) tx(ds, pick(roles), money(50, 150), "Lazer");
  // Transporte
  if (chance(0.07)) tx(ds, "Uber", money(14, 42), "Transporte - Uber/App");
  if ((dom === 4 || dom === 19) && !vacation) tx(ds, "Gasolina - posto Shell", money(190, 260), "Transporte - Combustível");
  // Mensais
  if (dom === 6) tx(ds, "Ração Golden + areia (Mingau 🐱)", money(205, 235), "Pet");
  if (dom === 14) tx(ds, "Barbeiro", 55, "Cuidados Pessoais");
  if (chance(0.04)) tx(ds, "Farmácia", money(25, 140), "Saúde & Bem-Estar");
  if (chance(0.015)) tx(ds, pick(games), money(25, 90), "Games");
  if (chance(0.012)) tx(ds, pick(["Camiseta Hering", "Calça jeans", "Meias e cuecas", "Bermuda"]), money(60, 220), "Vestuário");
  if (chance(0.01)) tx(ds, pick(["Lâmpadas e pilhas", "Conserto do chuveiro", "Kit de ferramentas"]), money(30, 180), "Moradia - Manutenção/Eletro");
  if (chance(0.006)) tx(ds, "Livro na Amazon", money(39, 89), "Educação");
}

// Eventos do calendário (meses sazonais)
const yearOf = (m0) => monthsList.find((x) => x.getMonth() === m0)?.getFullYear();
const ev = (m0, day, desc, amount, cat) => { const y = yearOf(m0); if (y) tx(`${y}-${pad(m0 + 1)}-${pad(day)}`, desc, amount, cat); };
ev(11, 12, "Amigo secreto do trampo", 100, "Presentes");
ev(11, 18, "Presente da mãe (Natal)", 289.9, "Presentes");
ev(11, 18, "Presente do pai (Natal)", 219.9, "Presentes");
ev(11, 20, "Presente da namorada", 349, "Presentes");
ev(11, 23, "Ceia de Natal (rateio família)", 260, "Mercado");
ev(11, 30, "Roupa branca do Réveillon", 159.9, "Vestuário");
ev(0, 15, "IPVA 2026 (cota única)", 1384.6, "Transporte - Manutenção/IPVA");
ev(0, 22, "Material de escritório home office", 129.9, "Outros");
ev(1, 14, "Bloquinho de Carnaval", 180, "Lazer");
ev(1, 16, "Abadá + bebidas Carnaval", 240, "Lazer");
ev(2, 9, "Revisão do carro 30 mil km", 890, "Transporte - Manutenção/IPVA");
ev(4, 10, "Presente Dia das Mães", 239.9, "Presentes");
ev(5, 12, "Jantar Dia dos Namorados", 312, "Lazer");
ev(6, 10, "Gasolina ida Floripa (minha parte)", 260, "Viagens");
ev(6, 12, "Restaurante em Floripa", 186, "Viagens");
ev(6, 14, "Passeio de barco (minha parte)", 150, "Viagens");
ev(6, 17, "Lembrancinhas Floripa", 95, "Viagens");
ev(7, 9, "Presente Dia dos Pais", 199.9, "Presentes");
ev(7, 21, "Veterinário - vacina do Mingau", 285, "Pet");
ev(8, 13, "Presente aniversário da Marina", 150, "Presentes");
ev(9, 3, "Ingresso show (meia)", 240, "Lazer");
ev(9, 12, "Feriado - churrasco do Pedro (Raxador)", 85, "Lazer");
// Lançamentos de hoje (para o "gasto de hoje" no painel)
tx(TODAY_ISO, "Café com pão de queijo", 14.5, "Alimentação");
tx(TODAY_ISO, "Almoço no PF da esquina", 32.9, "Alimentação");

transactions.sort((a, b) => a.date.localeCompare(b.date));

const instDate = (offset, day) => { const x = new Date(START.getFullYear(), START.getMonth() + offset, day, 12); return iso(x); };
const installments = [
  { description: "Geladeira Brastemp Frost Free", totalAmount: 3890, totalInstallments: 10, startDate: instDate(-1, 5), category: "Moradia - Manutenção/Eletro" },
  { description: "Celular novo (troca do antigo)", totalAmount: 4799, totalInstallments: 12, startDate: instDate(2, 12), category: "Outros" },
  { description: "Pneus do carro (4 un.)", totalAmount: 1560, totalInstallments: 4, startDate: instDate(3, 15), category: "Transporte - Manutenção/IPVA" },
  { description: "Passagens aéreas (Floripa)", totalAmount: 1680, totalInstallments: 6, startDate: instDate(5, 18), category: "Viagens" },
  { description: "Curso de inglês (semestre)", totalAmount: 1470, totalInstallments: 6, startDate: instDate(9, 5), category: "Educação" },
  { description: "Tênis de corrida Asics", totalAmount: 699.9, totalInstallments: 3, startDate: instDate(10, 20), category: "Vestuário" },
  { description: "Air fryer Mondial", totalAmount: 449.9, totalInstallments: 5, startDate: instDate(11, 2), category: "Moradia - Manutenção/Eletro" },
]
  .filter((p) => notFuture(p.startDate))
  .map((p) => ({ id: strId(p.startDate, 19), ...p }));

const months = {};
monthsList.forEach((m, i) => {
  const key = monthKey(m);
  months[key] = { dailyBudget: i < 5 ? 245 : 265, fixedExpensesSnapshot: fixedFor(i) };
});

// ---------- Investimentos ----------
const investmentFunds = [];
function monthlyRate(kind) {
  if (kind === "selic") return between(0.0085, 0.0095);
  if (kind === "cdb") return between(0.0088, 0.0098);
  return between(-0.045, 0.055); // renda variável
}
function buildFund({ name, kind, start, initial, monthlyDeposit = 0, extraDeposits = [], partial, finish }) {
  const fund = { id: strId(start, 9), name, isCofrinho: false, deposits: [], balanceLogs: [], withdrawals: [], isFinished: false, irAmount: 0 };
  fund.deposits.push({ id: strId(start, 9), date: start, amount: initial });
  fund.balanceLogs.push({ id: strId(start, 9), date: start, amount: initial, isSystem: true });
  let balance = initial;
  const s = parse(start);
  for (let k = 0; ; k++) {
    const logDate = iso(new Date(s.getFullYear(), s.getMonth() + k, 28, 12));
    if (logDate <= start) continue;
    if (!notFuture(logDate)) break;
    if (finish && logDate >= finish.date) break;
    const depDate = iso(new Date(s.getFullYear(), s.getMonth() + k, 10, 12));
    if (monthlyDeposit && depDate > start && notFuture(depDate)) {
      fund.deposits.push({ id: strId(depDate, 10), date: depDate, amount: monthlyDeposit });
      balance += monthlyDeposit;
    }
    extraDeposits.filter((e) => e.date.slice(0, 7) === logDate.slice(0, 7) && notFuture(e.date)).forEach((e) => {
      fund.deposits.push({ id: strId(e.date, 10), date: e.date, amount: e.amount });
      balance += e.amount;
    });
    if (partial && partial.date.slice(0, 7) === logDate.slice(0, 7) && notFuture(partial.date)) {
      balance = r2(balance * (1 + monthlyRate(kind) / 2));
      fund.withdrawals.push({ id: strId(partial.date, 15), date: partial.date, amount: partial.amount });
      balance = r2(balance - partial.amount);
      fund.balanceLogs.push({ id: strId(partial.date, 15), date: partial.date, amount: balance, isSystem: true });
    }
    balance = r2(balance * (1 + monthlyRate(kind)));
    fund.balanceLogs.push({ id: strId(logDate, 20), date: logDate, amount: balance });
  }
  if (finish && notFuture(finish.date)) {
    const gross = r2(balance * 1.004);
    fund.isFinished = true;
    fund.closeAmount = gross;
    fund.closeDate = finish.date;
    const profit = gross - fund.deposits.reduce((a, d) => a + d.amount, 0);
    fund.irAmount = r2(Math.max(profit, 0) * finish.irPct);
    fund.balanceLogs.push({ id: strId(finish.date, 16), date: finish.date, amount: gross, isSystem: true });
  }
  investmentFunds.push(fund);
}
buildFund({ name: "Tesouro Selic 2029", kind: "selic", start: dateAtMonth(0, 10), initial: 3000, monthlyDeposit: 500 });
buildFund({ name: "CDB Inter 110% CDI", kind: "cdb", start: dateAtMonth(0, 12), initial: 10000, extraDeposits: [{ date: dateAtMonth(4, 10), amount: 2000 }] });
buildFund({ name: "Ações + FIIs (XP)", kind: "rv", start: dateAtMonth(0, 20), initial: 5000, monthlyDeposit: 300, partial: { date: dateAtMonth(7, 15), amount: 1200 } });
buildFund({ name: "CDB 102% CDI - Reserva viagem", kind: "cdb", start: dateAtMonth(1, 5), initial: 3000, extraDeposits: [{ date: dateAtMonth(3, 5), amount: 1000 }], finish: { date: dateAtMonth(7, 20), irPct: 0.2 } });
buildFund({ name: "LCI 90 dias Banco do Brasil", kind: "cdb", start: dateAtMonth(2, 8), initial: 5000, finish: { date: dateAtMonth(5, 8), irPct: 0 } });

function buildCofrinho({ name, start, bases, rate }) {
  const fund = { id: strId(start, 8), name, isCofrinho: true, deposits: [], balanceLogs: [], withdrawals: [], isFinished: false, irAmount: 0 };
  bases.filter((b) => notFuture(b.date)).forEach((b) => fund.deposits.push({ id: strId(b.date, 8), date: b.date, amount: b.amount }));
  const s = parse(start);
  for (let k = 1; ; k++) {
    const wDate = iso(new Date(s.getFullYear(), s.getMonth() + k, 2, 12));
    if (!notFuture(wDate)) break;
    const base = fund.deposits.filter((d) => d.date < wDate).reduce((a, d) => a + d.amount, 0);
    fund.withdrawals.push({ id: strId(wDate, 11), date: wDate, amount: r2(base * rate * between(0.95, 1.05)) });
  }
  investmentFunds.push(fund);
}
buildCofrinho({ name: "Caixinha Nubank - Reserva de emergência", start: dateAtMonth(0, 3), bases: [{ date: dateAtMonth(0, 3), amount: 15000 }, { date: dateAtMonth(4, 3), amount: 3000 }], rate: 0.0075 });
buildCofrinho({ name: "Cofrinho PicPay - Viagem fim de ano", start: dateAtMonth(2, 8), bases: [{ date: dateAtMonth(2, 8), amount: 4000 }], rate: 0.0078 });

// ---------- Raxador ----------
const equal = (members) => {
  const base = Math.floor((100 / members.length) * 100) / 100;
  const shares = {};
  members.forEach((m) => (shares[m] = base));
  shares[members[0]] = r2(100 - base * (members.length - 1));
  return shares;
};
const splitterGroups = [];
function group(name, category, date, members, expenses, isFinished) {
  if (!notFuture(date)) return;
  splitterGroups.push({
    id: strId(date, 18), name, category, date, members, isFinished,
    expenses: expenses.filter((e) => notFuture(e.date)).map((e) => ({ id: strId(e.date, 18), desc: e.desc, amount: e.amount, payer: e.payer, date: e.date, shares: e.shares || equal(members) })),
  });
}
const g1 = ["Eu", "Lucas", "Marina", "Pedro"];
group("Churras de fim de ano", "🥩 Churrasco", dateAtMonth(1, 13), g1, [
  { desc: "Carnes (picanha, linguiça, frango)", amount: 486.3, payer: "Eu", date: dateAtMonth(1, 13) },
  { desc: "Cerveja e refri", amount: 264.9, payer: "Lucas", date: dateAtMonth(1, 13) },
  { desc: "Carvão, gelo e pão de alho", amount: 92.5, payer: "Pedro", date: dateAtMonth(1, 13) },
  { desc: "Sobremesa (pavê)", amount: 48, payer: "Marina", date: dateAtMonth(1, 13) },
], true);
group("Carnaval em Paraty", "🎉 Festinha / Rolê", dateAtMonth(3, 13), ["Eu", "Lucas", "Ju"], [
  { desc: "Pousada (3 diárias)", amount: 1350, payer: "Lucas", date: dateAtMonth(3, 13) },
  { desc: "Pedágio + gasolina", amount: 310, payer: "Eu", date: dateAtMonth(3, 13) },
  { desc: "Mercado pra pousada", amount: 214.6, payer: "Ju", date: dateAtMonth(3, 14) },
  { desc: "Abadás do bloco", amount: 270, payer: "Eu", date: dateAtMonth(3, 15) },
], true);
const g3 = ["Eu", "Marina", "Ju"];
group("Viagem Floripa", "✈️ Viagem", dateAtMonth(8, 10), g3, [
  { desc: "Airbnb Lagoa da Conceição (7 noites)", amount: 2480, payer: "Eu", date: dateAtMonth(8, 10) },
  { desc: "Gasolina + pedágios", amount: 540, payer: "Marina", date: dateAtMonth(8, 10) },
  { desc: "Mercado da semana", amount: 386.4, payer: "Ju", date: dateAtMonth(8, 11) },
  { desc: "Passeio de barco", amount: 450, payer: "Eu", date: dateAtMonth(8, 14) },
  { desc: "Jantar de frutos do mar (Marina não comeu)", amount: 328, payer: "Ju", date: dateAtMonth(8, 15), shares: { Eu: 50, Marina: 0, Ju: 50 } },
  { desc: "Aluguel de prancha", amount: 120, payer: "Marina", date: dateAtMonth(8, 16), shares: { Eu: 0, Marina: 50, Ju: 50 } },
], true);
group("Presente de casamento da Ana", "🛒 Compras / Outros", dateAtMonth(10, 5), ["Eu", "Lucas", "Marina", "Pedro", "Ju"], [
  { desc: "Jogo de panelas Tramontina", amount: 899, payer: "Marina", date: dateAtMonth(10, 5) },
  { desc: "Cartão + embrulho", amount: 32, payer: "Eu", date: dateAtMonth(10, 6) },
], false);
group("Churrasco aniversário do Pedro", "🥩 Churrasco", dateAtMonth(11, Math.min(TODAY.getDate(), 10)), g1, [
  { desc: "Carnes", amount: 520.8, payer: "Pedro", date: dateAtMonth(11, Math.min(TODAY.getDate(), 10)) },
  { desc: "Bebidas", amount: 310, payer: "Eu", date: dateAtMonth(11, Math.min(TODAY.getDate(), 10)) },
  { desc: "Bolo", amount: 120, payer: "Marina", date: dateAtMonth(11, Math.min(TODAY.getDate(), 11)), shares: { Eu: 33.34, Lucas: 33.33, Marina: 33.33, Pedro: 0 } },
], false);

const bankDb = {
  version: 29,
  config: { startDate: iso(START), fixedExpenses: fixedFor(11) },
  months,
  transactions,
  installments,
  investmentFunds,
  splitterGroups,
};

/* =====================================================================
 * TOBA HEALTH
 * ===================================================================== */
const DEFAULT_METRICS_ORDER = [
  { key: "score", label: "Pontuação Corporal", type: "int", active: true, placeholder: "Ex: 85", unit: "" },
  { key: "fat", label: "Gordura Corporal (%)", type: "dec1", active: true, color: "#f85149", placeholder: "Ex: 18,5", unit: "%" },
  { key: "muscle", label: "Massa Muscular (kg)", type: "dec2", active: true, color: "#3fb950", placeholder: "Ex: 65,20", unit: "kg" },
  { key: "water", label: "Água (%)", type: "dec1", active: true, color: "#58a6ff", placeholder: "Ex: 58,0", unit: "%" },
  { key: "bmr", label: "Metabolismo Basal (kcal)", type: "int", active: true, color: "#d29922", placeholder: "Ex: 1750", unit: " kcal" },
  { key: "visceral", label: "Gordura Visceral", type: "int", active: true, placeholder: "Ex: 6", unit: "" },
  { key: "protein", label: "Proteína (%)", type: "dec1", active: true, placeholder: "Ex: 18,0", unit: "%" },
  { key: "bone", label: "Massa Óssea (kg)", type: "dec2", active: true, placeholder: "Ex: 3,20", unit: "kg" },
  { key: "bodyAge", label: "Idade Corporal (anos)", type: "int", active: true, placeholder: "Ex: 30", unit: "a" },
];

// Progresso ao longo do ano (0 = início, 1 = hoje), com "efeito festas" no 2º/3º mês.
const totalSpan = TODAY - START;
function progress(d) {
  const p = (d - START) / totalSpan;
  const festas = Math.exp(-Math.pow((p - 0.2) / 0.05, 2)); // pico perto do Natal/Ano-novo
  return { p, festas };
}
const lerp = (a, b, t) => a + (b - a) * t;

const weighIns = [];
for (let d = addDays(START, 1); iso(d) <= TODAY_ISO; d = addDays(d, int(5, 9))) {
  const { p, festas } = progress(d);
  const t = Math.pow(p, 0.85);
  const weight = r1(lerp(88.6, 81.4, t) + festas * 1.6 + between(-0.4, 0.4));
  const fat = r1(lerp(25.1, 20.2, t) + festas * 0.7 + between(-0.3, 0.3));
  const muscle = r2(lerp(61.8, 63.5, p) + between(-0.25, 0.25));
  const entry = { id: tsOf(iso(d), 7), date: iso(d), weight };
  if (chance(0.06)) {
    // Algumas pesagens só com o peso (balança da farmácia / sem bioimpedância)
    DEFAULT_METRICS_ORDER.forEach((m) => (entry[m.key] = null));
  } else {
    Object.assign(entry, {
      score: Math.round(lerp(71, 84, t) - festas * 2 + between(-1, 1)),
      fat,
      muscle,
      water: r1(lerp(52.3, 55.6, t) + between(-0.3, 0.3)),
      bmr: Math.round(1795 + (muscle - 61.8) * 22 + between(-6, 6)),
      visceral: Math.round(lerp(11, 8, t) + festas * 0.6),
      protein: r1(lerp(16.1, 17.7, t) + between(-0.2, 0.2)),
      bone: r2(lerp(3.18, 3.24, p) + between(-0.02, 0.02)),
      bodyAge: Math.round(lerp(35, 30, t) + festas),
    });
  }
  weighIns.push(entry);
}

// ---------- Treinos ----------
const CATALOG = {
  "supino-reto-barra": ["Supino reto (barra)", "peito"], "supino-inclinado-halter": ["Supino inclinado (halteres)", "peito"], crossover: ["Crossover (polia)", "peito"],
  "triceps-pulley-corda": ["Tríceps pulley (corda)", "triceps"], "triceps-frances": ["Tríceps francês", "triceps"],
  "puxada-frente": ["Puxada frontal (pulley)", "costas"], "remada-baixa": ["Remada baixa (polia)", "costas"], "remada-unilateral": ["Remada unilateral (halter)", "costas"],
  "rosca-direta": ["Rosca direta (barra)", "biceps"], "rosca-martelo": ["Rosca martelo", "biceps"],
  "agachamento-livre": ["Agachamento livre", "quadriceps"], "leg-press": ["Leg press 45°", "quadriceps"], "cadeira-extensora": ["Cadeira extensora", "quadriceps"],
  "mesa-flexora": ["Mesa flexora", "posterior"], "panturrilha-pe": ["Panturrilha em pé", "panturrilha"],
  "desenvolvimento-halter": ["Desenvolvimento (halteres)", "ombros"], "elevacao-lateral": ["Elevação lateral", "ombros"], "face-pull": ["Face pull", "ombros"],
  "abdominal-polia": ["Abdominal na polia", "abdomen"], "abdominal-infra": ["Abdominal infra (elevação de pernas)", "abdomen"],
};
// [exerciseId, séries, reps, carga inicial, carga final]
const ROUTINES = [
  { name: "Treino A - Peito e Tríceps", ex: [["supino-reto-barra", 4, 10, 50, 62], ["supino-inclinado-halter", 3, 10, 20, 26], ["crossover", 3, 12, 15, 22.5], ["triceps-pulley-corda", 3, 12, 25, 32.5], ["triceps-frances", 3, 10, 12, 16]] },
  { name: "Treino B - Costas e Bíceps", ex: [["puxada-frente", 4, 10, 55, 66], ["remada-baixa", 3, 10, 50, 62], ["remada-unilateral", 3, 10, 22, 28], ["rosca-direta", 3, 10, 24, 30], ["rosca-martelo", 3, 12, 12, 16]] },
  { name: "Treino C - Pernas", ex: [["agachamento-livre", 4, 8, 60, 82], ["leg-press", 4, 12, 160, 210], ["cadeira-extensora", 3, 12, 45, 57], ["mesa-flexora", 3, 12, 35, 45], ["panturrilha-pe", 4, 15, 60, 75]] },
  { name: "Treino D - Ombros e Abdômen", ex: [["desenvolvimento-halter", 4, 10, 16, 22], ["elevacao-lateral", 3, 12, 8, 11], ["face-pull", 3, 15, 20, 27.5], ["abdominal-polia", 3, 15, 30, 42.5], ["abdominal-infra", 3, 15, 0, 0]] },
];
const roundLoad = (kg) => (kg < 20 ? Math.round(kg) : Math.round(kg / 2.5) * 2.5);
const STRENGTH_FROM = iso(new Date(START.getFullYear(), START.getMonth() + 5, 1, 12)); // módulo de força entra no 6º mês
const strengthRoutines = ROUTINES.map((r, k) => ({ id: `r-${tsOf(STRENGTH_FROM, 8 + k)}-${"abcd"[k]}x${k}q`, name: r.name, exercises: [] }));

function strengthWorkout(ds, k) {
  const r = ROUTINES[k], routine = strengthRoutines[k];
  const t = Math.min(Math.max((parse(ds) - parse(STRENGTH_FROM)) / (TODAY - parse(STRENGTH_FROM)), 0), 1);
  const exercises = r.ex.map(([id, sets, reps, from, to]) => {
    const kg = roundLoad(lerp(from, to, t));
    const list = [];
    for (let s = 0; s < sets; s++) list.push({ reps: s === sets - 1 && chance(0.4) ? reps - int(1, 3) : reps, kg });
    return { exerciseId: id, name: CATALOG[id][0], group: CATALOG[id][1], sets: list };
  });
  routine.exercises = exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ ...s })) }));
  return {
    id: `${tsOf(ds, 19)}-${Math.floor(rand() * 2e9).toString(36).slice(0, 6)}`,
    type: "strength", title: r.name, date: ds,
    durationMinutes: int(52, 78), calories: int(290, 460),
    distanceKm: null, pushups: null, situps: null, squats: null, sets: null, reps: null, weightKg: null,
    notes: pick(["", "", "", "Treino pesado hoje 🔥", "Bati recorde no primeiro exercício", "Dormi mal, fui no leve", "Academia lotada, adaptei a ordem"]),
    routineId: routine.id, exercises,
  };
}
const base = (ds, type, title, extra) => ({
  id: `${tsOf(ds, 18)}-${Math.floor(rand() * 2e9).toString(36).slice(0, 6)}`,
  type, title, date: ds,
  durationMinutes: null, calories: null, distanceKm: null, pushups: null, situps: null, squats: null, sets: null, reps: null, weightKg: null,
  notes: "", ...extra,
});
const workouts = [];
let rot = 0;
for (let d = new Date(START); iso(d) <= TODAY_ISO; d = addDays(d, 1)) {
  const ds = iso(d), dow = d.getDay(), m = d.getMonth(), dom = d.getDate();
  const { p } = progress(d);
  const vacation = m === 6 && dom >= 10 && dom <= 19;
  const holidays = (m === 11 && dom >= 22) || (m === 0 && dom <= 4);
  if (holidays) continue;
  if (vacation) {
    if (chance(0.6)) { const km = r2(between(4, 9)); workouts.push(base(ds, "walking", "Caminhada / Corrida", { distanceKm: km, durationMinutes: Math.round(km * between(9, 12)), calories: Math.round(km * 68) })); }
    continue;
  }
  const skip = chance(0.15); // dias de preguiça
  if ([1, 2, 4, 5].includes(dow) && !skip) {
    if (ds >= STRENGTH_FROM) { workouts.push(strengthWorkout(ds, rot % 4)); rot++; }
    else {
      const kg = r1(lerp(30, 45, p * 2));
      workouts.push(base(ds, "custom", "Musculação", { durationMinutes: int(50, 70), calories: int(280, 420), sets: 4, reps: 10, weightKg: kg, notes: pick(["", "Superior", "Inferior", "Full body"]) }));
    }
  }
  if (dow === 3 && !skip) {
    const type = pick(["walking", "walking", "elliptical"]);
    if (type === "walking") { const km = r2(between(4, lerp(6, 9, p))); workouts.push(base(ds, "walking", "Caminhada / Corrida", { distanceKm: km, durationMinutes: Math.round(km * between(lerp(11, 7, p), lerp(12, 8.5, p))), calories: Math.round(km * between(62, 75)) })); }
    else { const min = int(25, 45); workouts.push(base(ds, "elliptical", "Elíptico", { durationMinutes: min, calories: Math.round(min * between(8.5, 10.5)), distanceKm: r2(min * 0.12) })); }
  }
  if (dow === 6 && chance(0.7)) { const km = r2(between(15, lerp(25, 42, p))); workouts.push(base(ds, "bike", "Bike", { distanceKm: km, durationMinutes: Math.round(km * between(2.6, 3.3)), calories: Math.round(km * between(26, 32)) })); }
  if (dow === 0 && dom <= 7) {
    // Desafio Saitama no 1º domingo do mês, cada vez mais completo
    const f = Math.min(lerp(0.35, 1, p) + between(-0.1, 0.1), 1);
    workouts.push(base(ds, "saitama", "Treino lendário do Mestre Saitama", { pushups: Math.round(100 * f), situps: Math.round(100 * f), squats: Math.round(100 * f), distanceKm: r2(10 * f), durationMinutes: Math.round(lerp(110, 85, p)), calories: Math.round(900 * f) }));
  } else if (dow === 0 && chance(0.35)) {
    workouts.push(base(ds, "custom", pick(["Futebol society", "Futebol society", "Natação", "Vôlei de praia"]), { durationMinutes: int(50, 90), calories: int(420, 700) }));
  }
}

const healthDb = { age: 31, height: 178, gender: "Masculino", weighIns, metricsOrder: DEFAULT_METRICS_ORDER, workouts, strengthRoutines };

// ---------- saída ----------
const out = __dirname;
const bankStr = JSON.stringify(bankDb);
const healthStr = JSON.stringify(healthDb);
fs.writeFileSync(path.join(out, "toba_bank_backup_teste.json"), JSON.stringify(bankDb, null, 2));
fs.writeFileSync(path.join(out, "toba_health_backup_teste.json"), JSON.stringify(healthDb, null, 2));
fs.writeFileSync(path.join(out, "toba_backup_teste_completo.json"), JSON.stringify({ TOBA_BANK_DB: bankStr, TOBA_HEALTH_DB: healthStr }, null, 2));

console.log(`Período: ${iso(START)} → ${TODAY_ISO}`);
console.log(`Bank: ${transactions.length} gastos, ${installments.length} parcelados, ${investmentFunds.length} investimentos/cofrinhos, ${splitterGroups.length} grupos no Raxador`);
console.log(`Health: ${weighIns.length} pesagens, ${workouts.length} treinos (${workouts.filter((w) => w.type === "strength").length} de força), ${strengthRoutines.length} rotinas`);
