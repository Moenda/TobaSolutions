/* =====================================================================
 * Toba Racing · regras puras do combustível (desde v1.51)
 * - Só lê o banco (recebe por parâmetro); não depende de racing-core.js,
 *   porque o portal carrega este arquivo sozinho pro card do app.
 * - km/l "de tanque cheio a tanque cheio": entre dois abastecimentos de
 *   tanque cheio, km rodados = diferença do odômetro e litros gastos = soma
 *   dos litros de TODOS os abastecimentos depois do primeiro cheio (parciais
 *   inclusos, o primeiro não). Se no meio tiver um "esqueci de anotar um"
 *   (missed), esse trecho não vale (os litros não batem).
 * ===================================================================== */

// A key é gravada em fuelings[].fuel: nunca renomeie; combustível novo = item novo.
const RACING_FUELS = [
  { key: "gasolina", icon: "⛽", name: "Gasolina" },
  { key: "etanol", icon: "🌽", name: "Etanol" },
  { key: "diesel", icon: "🛢️", name: "Diesel" },
];

// Etanol rende ~70% da gasolina (regra da bomba) quando ainda não dá pra medir no seu carro
const RACING_ETHANOL_DEFAULT_RATIO = 0.7;
// Diferença do último tanque pra média que já conta como "pé leve"/"pé de chumbo"
const RACING_TREND_MARGIN = 0.03;

function racingNum(value) {
  return Number(value) || 0;
}

function racingFuel(key) {
  return RACING_FUELS.find((f) => f.key === key) || RACING_FUELS[0];
}

function racingIsIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

// Abastecimentos válidos em ordem de odômetro (empate: data, depois quem foi criado antes)
function racingSortedFuelings(db) {
  const list = db && Array.isArray(db.fuelings) ? db.fuelings : [];
  return list
    .filter((f) => f && racingIsIso(f.date) && racingNum(f.odometer) > 0 && racingNum(f.liters) > 0)
    .slice()
    .sort((a, b) => racingNum(a.odometer) - racingNum(b.odometer)
      || String(a.date).localeCompare(String(b.date))
      || racingNum(a.createdAt) - racingNum(b.createdAt));
}

// Trechos medidos (tanque cheio → tanque cheio). Cada um termina num abastecimento (toId).
function calcRacingSegments(db) {
  const segments = [];
  let start = null;
  let liters = 0;
  let cost = 0;
  let broken = false;
  let fuels = new Set();
  racingSortedFuelings(db).forEach((f) => {
    if (start) {
      liters += racingNum(f.liters);
      cost += racingNum(f.total);
      fuels.add(f.fuel || RACING_FUELS[0].key);
      if (f.missed) broken = true;
    }
    if (!f.full) return;
    if (start && !broken) {
      const km = racingNum(f.odometer) - racingNum(start.odometer);
      if (km > 0 && liters > 0) {
        segments.push({
          fromId: String(start.id), toId: String(f.id), startDate: start.date, date: f.date,
          km, liters, cost, kml: km / liters, costPerKm: cost / km, fuels: [...fuels],
        });
      }
    }
    start = f;
    liters = 0;
    cost = 0;
    broken = false;
    fuels = new Set();
  });
  return segments;
}

function calcRacingAverage(segments) {
  const km = segments.reduce((sum, s) => sum + s.km, 0);
  const liters = segments.reduce((sum, s) => sum + s.liters, 0);
  const cost = segments.reduce((sum, s) => sum + s.cost, 0);
  return { km, liters, cost, kml: liters > 0 ? km / liters : null, costPerKm: km > 0 ? cost / km : null };
}

/* Tudo que as telas e o card do portal mostram. referenceDate = hoje. */
function calcRacingSummary(db, referenceDate = new Date()) {
  const data = db && typeof db === "object" ? db : {};
  const today = toIsoDate(referenceDate);
  const monthKey = today.slice(0, 7);
  const fuelings = racingSortedFuelings(data);
  const segments = calcRacingSegments(data);
  const all = calcRacingAverage(segments);
  const last = segments[segments.length - 1] || null;
  const before = calcRacingAverage(segments.slice(0, -1));

  // Último tanque contra a média dos anteriores (precisa de 2 trechos)
  let trend = null;
  if (last && before.kml) {
    const diff = last.kml / before.kml - 1;
    trend = { diff, status: diff >= RACING_TREND_MARGIN ? "eco" : diff <= -RACING_TREND_MARGIN ? "pesado" : "normal" };
  }

  // Mês: gasto e litros pela data; km pelo odômetro (último do mês − último antes do mês)
  const inMonth = fuelings.filter((f) => f.date.startsWith(monthKey));
  const beforeMonth = fuelings.filter((f) => f.date < `${monthKey}-01`);
  const lastOdo = fuelings.length ? racingNum(fuelings[fuelings.length - 1].odometer) : null;
  let monthKm = null;
  if (inMonth.length) {
    const base = beforeMonth.length ? racingNum(beforeMonth[beforeMonth.length - 1].odometer) : racingNum(inMonth[0].odometer);
    monthKm = Math.max(0, Math.max(...inMonth.map((f) => racingNum(f.odometer))) - base);
  }

  // Rendimento por combustível (só trechos de um combustível só)
  const byFuel = {};
  RACING_FUELS.forEach((fuel) => {
    const avg = calcRacingAverage(segments.filter((s) => s.fuels.length === 1 && s.fuels[0] === fuel.key));
    if (avg.kml) byFuel[fuel.key] = avg.kml;
  });
  const lastPrice = (key) => {
    const hit = [...fuelings].reverse().find((f) => (f.fuel || RACING_FUELS[0].key) === key && racingNum(f.price) > 0);
    return hit ? racingNum(hit.price) : null;
  };
  const gasPrice = lastPrice("gasolina");
  const ethanolPrice = lastPrice("etanol");
  const ownRatio = byFuel.gasolina && byFuel.etanol ? byFuel.etanol / byFuel.gasolina : null;
  const ratio = ownRatio || RACING_ETHANOL_DEFAULT_RATIO;

  const tank = racingNum(data.car && data.car.tank);
  const lastFill = fuelings[fuelings.length - 1] || null;
  return {
    count: fuelings.length,
    segments,
    avgKml: all.kml,
    costPerKm: all.costPerKm,
    totalKm: all.km,
    lastKml: last ? last.kml : null,
    lastSegment: last,
    bestKml: segments.length ? Math.max(...segments.map((s) => s.kml)) : null,
    trend,
    lastOdometer: lastOdo,
    lastFill,
    lastFillDaysAgo: lastFill
      ? Math.round((new Date(`${today}T12:00:00`) - new Date(`${lastFill.date}T12:00:00`)) / 86400000)
      : null,
    waitingFull: !segments.length && fuelings.some((f) => f.full),
    monthSpent: inMonth.reduce((sum, f) => sum + racingNum(f.total), 0),
    monthLiters: inMonth.reduce((sum, f) => sum + racingNum(f.liters), 0),
    monthCount: inMonth.length,
    monthKm,
    rangeKm: tank > 0 && all.kml ? tank * all.kml : null,
    tank: tank || null,
    byFuel,
    ethanol: gasPrice
      ? { ratio, own: !!ownRatio, gasPrice, ethanolPrice, breakEven: gasPrice * ratio, worth: ethanolPrice ? ethanolPrice <= gasPrice * ratio : null }
      : null,
  };
}

/* Formatos de tela */
function formatRacingKml(value) {
  return value === null || value === undefined ? "--" : value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatRacingKm(value) {
  return value === null || value === undefined ? "--" : Math.round(value).toLocaleString("pt-BR");
}

function formatRacingLiters(value) {
  return (racingNum(value)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRacingPrice(value) {
  return racingNum(value) > 0
    ? `R$ ${racingNum(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
    : "--";
}

// Selo do último tanque: o que o Toba acha do seu pé direito
function racingTrendBadge(trend) {
  if (!trend) return null;
  const pct = `${Math.abs(Math.round(trend.diff * 100))}%`;
  if (trend.status === "eco") return { icon: "🟢", label: "Pé leve", text: `${pct} melhor que a sua média. Economia raiz!`, cls: "is-eco" };
  if (trend.status === "pesado") return { icon: "🔴", label: "Pé de chumbo", text: `${pct} pior que a sua média. Achou que era Interlagos?`, cls: "is-heavy" };
  return { icon: "🟡", label: "Na média", text: "Igualzinho ao de sempre. Constância de piloto.", cls: "is-normal" };
}

/* ---------------------------------------------------------------------
 * Conquistas do Perfil (desde v1.56): números em ordem de data pro
 * computePlayer() (toba-player.js) conferir as conquistas "rc-*".
 * Cada abastecimento entra no dia dele; o trecho medido (km/l) entra no dia
 * do tanque cheio que fecha. "Pé leve" = trecho 3% melhor que a média dos
 * anteriores (mesma régua do selo da tela).
 * ------------------------------------------------------------------- */
function calcRacingPlayer(data, today) {
  const db = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const fuelings = racingSortedFuelings(db).filter((f) => f.date <= today);
  const segments = calcRacingSegments(db).filter((s) => s.date <= today);
  const steps = [
    ...fuelings.map((f) => ({ date: f.date, order: 0, f })),
    ...segments.map((s, i) => ({ date: s.date, order: 1, s, i })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const stats = { racingFuelings: 0, racingKm: 0, racingSegments: 0, racingEco: 0, racingEthanol: 0, racingBigFill: 0, racingFuelTypes: 0, racingRoad: 0 };
  const types = new Set();
  let firstOdo = null;
  let maxOdo = 0;
  const timeline = steps.map((step) => {
    if (step.f) {
      const f = step.f;
      stats.racingFuelings += 1;
      const odo = racingNum(f.odometer);
      if (firstOdo === null) firstOdo = odo;
      maxOdo = Math.max(maxOdo, odo);
      stats.racingKm = Math.max(0, maxOdo - firstOdo);
      if (f.fuel === "etanol") stats.racingEthanol += 1;
      types.add(f.fuel || RACING_FUELS[0].key);
      stats.racingFuelTypes = types.size;
      stats.racingBigFill = Math.max(stats.racingBigFill, racingNum(f.total));
    } else {
      const seg = step.s;
      stats.racingSegments += 1;
      stats.racingRoad = Math.max(stats.racingRoad, seg.km);
      const before = calcRacingAverage(segments.slice(0, step.i));
      if (before.kml && seg.kml >= before.kml * (1 + RACING_TREND_MARGIN)) stats.racingEco += 1;
    }
    return { date: step.date, stats: { ...stats } };
  });
  return { stats, timeline };
}
