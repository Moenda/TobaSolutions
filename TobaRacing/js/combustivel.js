/* =====================================================================
 * Toba Racing · ⛽ Combustível (desde v1.51)
 * Abastecimentos (odômetro, litros, preço, total, tanque cheio) e o
 * histórico de km/l. Contas em racing-metrics.js; banco em racing-core.js.
 * ===================================================================== */
const RACING_CHART_MAX = 12; // últimos trechos no gráfico

function renderFuelScreen() {
  const s = calcRacingSummary(racingDb);
  renderFuelHero(s);
  renderFuelStats(s);
  renderFuelChart(s);
  renderFuelEthanol(s);
  renderFuelList(s);
}

function renderFuelHero(s) {
  const box = document.getElementById("fuelHero");
  if (!s.count) {
    box.innerHTML = `<div class="rc-hero is-empty">
      ${tobaEmpty("🏁", "Nenhum abastecimento ainda", "Na próxima vez que encher o tanque, toca em + Abastecer e anota o odômetro. É a largada!", { compact: true })}
      <button type="button" class="chip-btn rc-help-btn" data-open="fuelHelpSheet">🧮 Como funciona o km/l?</button>
    </div>`;
    return;
  }
  if (!s.lastSegment) {
    const text = s.waitingFull
      ? "Largada anotada! No próximo tanque cheio sai o seu primeiro km/l."
      : "Pra medir o km/l, o Toba precisa de um abastecimento com tanque cheio. Marca \"Encheu o tanque\" no próximo.";
    box.innerHTML = `<div class="rc-hero is-waiting">
      <div class="rc-hero-flag">🚦</div>
      <div class="rc-hero-text"><b>Aquecendo os pneus...</b><span>${text}</span></div>
      <button type="button" class="chip-btn rc-help-btn" data-open="fuelHelpSheet">🧮 Como funciona?</button>
    </div>`;
    return;
  }
  const badge = racingTrendBadge(s.trend);
  const seg = s.lastSegment;
  box.innerHTML = `<div class="rc-hero ${badge ? badge.cls : ""}">
    <div class="rc-hero-top">
      <span class="rc-hero-label">🏁 Último tanque</span>
      <button type="button" class="rc-hero-help" data-open="fuelHelpSheet" aria-label="Como o km/l é calculado">?</button>
    </div>
    <div class="rc-hero-main">
      <span class="rc-hero-value">${formatRacingKml(seg.kml)}</span><span class="rc-hero-unit">km/l</span>
    </div>
    <div class="rc-hero-sub">${formatRacingKm(seg.km)} km com ${formatRacingLiters(seg.liters)} L · ${isoToBrDate(seg.startDate).slice(0, 5)} → ${isoToBrDate(seg.date).slice(0, 5)}</div>
    ${badge
      ? `<div class="rc-badge"><span class="rc-badge-icon">${badge.icon}</span><span><b>${badge.label}</b> ${badge.text}</span></div>`
      : '<div class="rc-badge"><span class="rc-badge-icon">🏎️</span><span><b>Primeira volta!</b> Com mais um tanque cheio o Toba já compara com a sua média.</span></div>'}
  </div>`;
}

function renderFuelStats(s) {
  const box = document.getElementById("fuelStats");
  if (!s.count) {
    box.innerHTML = "";
    return;
  }
  const tile = (label, value, sub, cls = "") => `
    <div class="toba-stat${cls}">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </div>`;
  box.innerHTML =
    tile("📊 Média geral", s.avgKml ? `${formatRacingKml(s.avgKml)} <small>km/l</small>` : "--", s.segments.length ? `${s.segments.length} ${s.segments.length === 1 ? "tanque medido" : "tanques medidos"}` : "falta 1 tanque cheio")
    + tile("💸 Custo por km", s.costPerKm ? formatCurrency(s.costPerKm) : "--", s.totalKm ? `em ${formatRacingKm(s.totalKm)} km medidos` : "aparece com o km/l")
    + tile("📅 Gasto no mês", `<span class="text-red">${formatCurrency(s.monthSpent)}</span>`, s.monthCount ? `${formatRacingLiters(s.monthLiters)} L · ${s.monthCount} ${s.monthCount === 1 ? "parada" : "paradas"}` : "nenhuma parada no mês")
    + (s.rangeKm
      ? tile("🛣️ Autonomia", `~${formatRacingKm(s.rangeKm)} <small>km</small>`, `tanque de ${s.tank} L cheio`)
      : tile("🏆 Melhor tanque", s.bestKml ? `${formatRacingKml(s.bestKml)} <small>km/l</small>` : "--", s.lastOdometer ? `odômetro: ${formatRacingKm(s.lastOdometer)} km` : "o recorde do pé leve"));
}

// Barras de km/l por tanque (últimos 12) com a linha da média
function renderFuelChart(s) {
  const box = document.getElementById("fuelChartBox");
  const segs = s.segments.slice(-RACING_CHART_MAX);
  if (segs.length < 2) {
    box.innerHTML = "";
    return;
  }
  const w = 320;
  const h = 130;
  const padX = 10;
  const top = 18;
  const bottom = 20;
  const max = Math.max(...segs.map((x) => x.kml), s.avgKml || 0) * 1.12;
  const min = Math.max(0, Math.min(...segs.map((x) => x.kml)) * 0.75);
  const y = (v) => top + (1 - (v - min) / (max - min || 1)) * (h - top - bottom);
  const slot = (w - padX * 2) / segs.length;
  const bar = Math.min(26, slot * 0.62);
  const bars = segs.map((seg, i) => {
    const x = padX + slot * i + (slot - bar) / 2;
    const yy = y(seg.kml);
    const good = !s.avgKml || seg.kml >= s.avgKml;
    return `
      <rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bar.toFixed(1)}" height="${(h - bottom - yy).toFixed(1)}" rx="4" class="${good ? "rc-bar-good" : "rc-bar-bad"}"/>
      <text x="${(x + bar / 2).toFixed(1)}" y="${(yy - 4).toFixed(1)}" class="rc-bar-label" text-anchor="middle">${formatRacingKml(seg.kml)}</text>
      <text x="${(x + bar / 2).toFixed(1)}" y="${h - 6}" class="rc-bar-date" text-anchor="middle">${isoToBrDate(seg.date).slice(0, 5)}</text>`;
  }).join("");
  const avgY = s.avgKml ? y(s.avgKml) : null;
  box.innerHTML = `
    <div class="section-title">📈 Histórico de km/l <span class="text-muted rc-count">média ${formatRacingKml(s.avgKml)}</span></div>
    <div class="card rc-chart-card">
      <svg class="rc-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="km/l dos últimos tanques">
        ${bars}
        ${avgY !== null ? `<line x1="${padX}" x2="${w - padX}" y1="${avgY.toFixed(1)}" y2="${avgY.toFixed(1)}" class="rc-avg-line"/>` : ""}
      </svg>
      <div class="rc-chart-legend"><span><i class="rc-dot is-good"></i>na média ou melhor</span><span><i class="rc-dot is-bad"></i>abaixo da média</span><span><i class="rc-dash"></i>média</span></div>
    </div>`;
}

// Etanol x gasolina: até quanto o etanol compensa (com o rendimento do seu carro, se já deu pra medir)
function renderFuelEthanol(s) {
  const box = document.getElementById("fuelEthanol");
  const e = s.ethanol;
  if (!e) {
    box.innerHTML = "";
    return;
  }
  const verdict = e.worth === null
    ? ""
    : e.worth
      ? `<span class="text-green">Último etanol (${formatRacingPrice(e.ethanolPrice)}) compensou! 🌽</span>`
      : `<span class="text-gold">Último etanol (${formatRacingPrice(e.ethanolPrice)}) saiu mais caro que a gasolina.</span>`;
  box.innerHTML = `
    <div class="card rc-ethanol">
      <div class="rc-ethanol-title">🌽 Etanol ou ⛽ gasolina?</div>
      <div class="rc-ethanol-main">Com a gasolina a <b>${formatRacingPrice(e.gasPrice)}</b>, o etanol compensa até <b class="text-green">${formatRacingPrice(e.breakEven)}</b>.</div>
      <div class="rc-ethanol-sub text-muted">${e.own ? `No seu carro o etanol rende ${Math.round(e.ratio * 100)}% da gasolina (medido nos seus tanques).` : "Regra da bomba: etanol rende ~70% da gasolina. Com um tanque cheio de cada, o Toba usa o número do SEU carro."}</div>
      ${verdict ? `<div class="rc-ethanol-sub">${verdict}</div>` : ""}
    </div>`;
}

// "28/10" no ano atual, "28/10/25" nos outros (cabe no S24 junto com o odômetro)
function fuelShortDate(iso) {
  const br = isoToBrDate(iso);
  return iso.slice(0, 4) === toIsoDate().slice(0, 4) ? br.slice(0, 5) : `${br.slice(0, 6)}${br.slice(8)}`;
}

function renderFuelList(s) {
  const list = document.getElementById("fuelList");
  document.getElementById("fuelCount").textContent = s.count ? `${s.count}` : "";
  if (!s.count) {
    list.innerHTML = "";
    return;
  }
  const byEnd = new Map(s.segments.map((seg) => [seg.toId, seg]));
  const sorted = racingSortedFuelings(racingDb).reverse();
  list.innerHTML = sorted.map((f) => {
    const fuel = racingFuel(f.fuel);
    const seg = byEnd.get(String(f.id));
    const chips = [];
    if (seg) {
      const good = !s.avgKml || seg.kml >= s.avgKml;
      chips.push(`<span class="rc-chip ${good ? "is-good" : "is-bad"}">🏁 ${formatRacingKml(seg.kml)} km/l · ${formatRacingKm(seg.km)} km</span>`);
    }
    if (!f.full) chips.push('<span class="rc-chip">½ parcial</span>');
    if (f.missed) chips.push('<span class="rc-chip is-warn">🙈 pulou um</span>');
    return `
      <div class="toba-list-item rc-fuel" role="button" tabindex="0" data-click="editFueling" data-id="${escapeHtml(f.id)}">
        <span class="rc-fuel-icon" title="${fuel.name}">${fuel.icon}</span>
        <span class="rc-fuel-text">
          <span class="rc-fuel-title">${fuelShortDate(f.date)} <span class="text-muted">· ${formatRacingKm(f.odometer)} km</span></span>
          <span class="rc-fuel-meta">${formatRacingLiters(f.liters)} L · ${formatRacingPrice(f.price)}/L</span>
          ${chips.length ? `<span class="rc-fuel-chips">${chips.join("")}</span>` : ""}
          ${f.note ? `<span class="rc-fuel-note">📝 ${escapeHtml(f.note)}</span>` : ""}
        </span>
        <span class="rc-fuel-total">${f.total ? formatCurrency(f.total) : "--"}</span>
      </div>`;
  }).join("");
}

/* ---------------------------------------------------------------------
 * Folha do abastecimento
 * ------------------------------------------------------------------- */
function renderFuelTypeChips(selected) {
  document.getElementById("fuelType").value = selected;
  document.getElementById("fuelTypeChips").innerHTML = RACING_FUELS.map((f) => `
    <button type="button" class="chip-btn rc-fuel-chip${f.key === selected ? " is-on" : ""}" data-click="pickFuelType" data-fuel="${f.key}" aria-pressed="${f.key === selected}">${f.icon} ${f.name}</button>`).join("");
}

// Odômetro do abastecimento anterior/seguinte (pra avisar e validar)
function fuelNeighbors(odometer, ignoreId) {
  const others = racingSortedFuelings(racingDb).filter((f) => String(f.id) !== String(ignoreId));
  const prev = [...others].reverse().find((f) => racingNum(f.odometer) < odometer) || null;
  const next = others.find((f) => racingNum(f.odometer) > odometer) || null;
  const same = others.find((f) => racingNum(f.odometer) === odometer) || null;
  return { prev, next, same, last: others[others.length - 1] || null };
}

function updateOdoHint() {
  const id = document.getElementById("fuelId").value;
  const odo = parseInt(document.getElementById("fuelOdometer").value, 10) || 0;
  const { last, prev } = fuelNeighbors(odo || Infinity, id);
  const hint = document.getElementById("fuelOdoHint");
  const ref = odo ? prev : last;
  if (!ref) {
    hint.textContent = "";
    return;
  }
  const diff = odo ? odo - racingNum(ref.odometer) : null;
  hint.innerHTML = diff
    ? `Desde ${isoToBrDate(ref.date).slice(0, 5)}: <b>${formatRacingKm(diff)} km</b> rodados`
    : `Último anotado: <b>${formatRacingKm(ref.odometer)} km</b> em ${isoToBrDate(ref.date)}`;
}

function openFuelSheet(fueling = null) {
  const sorted = racingSortedFuelings(racingDb);
  const lastFuel = sorted.length ? sorted[sorted.length - 1].fuel : RACING_FUELS[0].key;
  document.getElementById("fuelSheetTitle").textContent = fueling ? "✏️ Editar abastecimento" : "⛽ Abastecimento";
  document.getElementById("fuelId").value = fueling ? fueling.id : "";
  document.getElementById("fuelDate").value = fueling ? fueling.date : toIsoDate();
  document.getElementById("fuelOdometer").value = fueling ? String(Math.round(racingNum(fueling.odometer))) : "";
  document.getElementById("fuelLiters").value = fueling ? formatDec2(racingNum(fueling.liters)) : "";
  document.getElementById("fuelPrice").value = fueling && racingNum(fueling.price) > 0 ? racingNum(fueling.price).toFixed(3).replace(".", ",") : "";
  document.getElementById("fuelTotal").value = fueling && racingNum(fueling.total) > 0 ? formatMoneyInput(fueling.total) : "";
  document.querySelectorAll(".rc-calc").forEach((el) => {
    if (el.value) el.dataset.user = "1";
    else delete el.dataset.user;
  });
  renderFuelTypeChips(fueling ? fueling.fuel || RACING_FUELS[0].key : lastFuel || RACING_FUELS[0].key);
  document.getElementById("fuelFull").checked = fueling ? fueling.full !== false : true;
  document.getElementById("fuelMissed").checked = fueling ? !!fueling.missed : false;
  document.getElementById("fuelNote").value = fueling ? fueling.note || "" : "";
  document.getElementById("deleteFuelBtn").hidden = !fueling;
  updateOdoHint();
  openTobaModal("fuelSheet");
}

function readFuelNumber(field) {
  if (field === "total") return getMoney("fuelTotal");
  const el = document.getElementById(field === "liters" ? "fuelLiters" : "fuelPrice");
  return parseTobaDecimal(el.value) || 0;
}

// Preencheu 2 dos 3 (litros, preço, total)? O Toba calcula o que falta.
function onFuelCalcInput(el) {
  if (el.value.trim()) el.dataset.user = "1";
  else delete el.dataset.user;
  const fields = Array.from(document.querySelectorAll(".rc-calc"));
  const typed = fields.filter((f) => f.dataset.user);
  if (typed.length !== 2) return;
  const target = fields.find((f) => !f.dataset.user);
  const liters = readFuelNumber("liters");
  const price = readFuelNumber("price");
  const total = readFuelNumber("total");
  if (target.dataset.calc === "total" && liters && price) target.value = formatMoneyInput(Math.round(liters * price * 100) / 100);
  if (target.dataset.calc === "price" && liters && total) target.value = (total / liters).toFixed(3).replace(".", ",");
  if (target.dataset.calc === "liters" && price && total) target.value = (total / price).toFixed(2).replace(".", ",");
}

function saveFueling() {
  const id = document.getElementById("fuelId").value;
  const odometer = parseInt(document.getElementById("fuelOdometer").value, 10) || 0;
  const liters = readFuelNumber("liters");
  let price = readFuelNumber("price");
  let total = readFuelNumber("total");
  if (!odometer) {
    showPageMessage("Anota o odômetro (os km do painel). É dele que sai o km/l!", { title: "Faltou o odômetro", icon: "📍" });
    return;
  }
  if (!liters) {
    showPageMessage("Quantos litros entraram? Tá na bomba ou no cupom.", { title: "Faltou os litros", icon: "⛽" });
    return;
  }
  if (!total && price) total = Math.round(liters * price * 100) / 100;
  if (!price && total) price = Math.round((total / liters) * 1000) / 1000;
  const date = document.getElementById("fuelDate").value || toIsoDate();
  const { prev, next, same } = fuelNeighbors(odometer, id);
  if (same) {
    showPageMessage(`Já tem um abastecimento com ${formatRacingKm(odometer)} km (${isoToBrDate(same.date)}). Confere o odômetro?`, { title: "Odômetro repetido", icon: "📍" });
    return;
  }
  if ((prev && prev.date > date) || (next && next.date < date)) {
    const ref = prev && prev.date > date ? prev : next;
    showPageMessage(`O odômetro não bate com a data: em ${isoToBrDate(ref.date)} o carro marcava ${formatRacingKm(ref.odometer)} km. Confere a data ou os km?`, { title: "Viagem no tempo?", icon: "🕰️" });
    return;
  }
  const data = {
    date,
    odometer,
    liters,
    price: price || null,
    total: total || null,
    fuel: document.getElementById("fuelType").value || RACING_FUELS[0].key,
    full: document.getElementById("fuelFull").checked,
    missed: document.getElementById("fuelMissed").checked,
    note: document.getElementById("fuelNote").value.trim(),
  };
  const existing = racingDb.fuelings.find((f) => String(f.id) === String(id));
  const before = calcRacingSummary(racingDb).segments.length;
  if (existing) Object.assign(existing, data);
  else racingDb.fuelings.push({ id: racingNewId("f"), ...data, createdAt: Date.now() });
  if (!saveRacingDb({ silent: true })) return;
  closeTobaModal("fuelSheet");
  renderFuelScreen();
  // Conquistas da pista no Perfil na hora (toba-player.js nesta página desde v1.56)
  if (typeof tobaPlayerCheck === "function") tobaPlayerCheck({ reason: "racing" });
  const after = calcRacingSummary(racingDb);
  if (!existing && after.segments.length > before && after.lastSegment) {
    const badge = racingTrendBadge(after.trend);
    tobaToast(`🏁 ${formatRacingKml(after.lastSegment.kml)} km/l${badge ? ` · ${badge.icon} ${badge.label}` : ""}`);
  } else {
    tobaSaved();
  }
}

async function deleteFueling() {
  const id = document.getElementById("fuelId").value;
  if (!(await showPageMessage("Apagar este abastecimento? O km/l dos tanques em volta é recalculado.", { title: "Apagar abastecimento", icon: "🗑️", confirm: true, confirmLabel: "Apagar" }))) return;
  racingDb.fuelings = racingDb.fuelings.filter((f) => String(f.id) !== String(id));
  if (!saveRacingDb()) return;
  closeTobaModal("fuelSheet");
  renderFuelScreen();
}

function onRacingDataReplaced() {
  renderFuelScreen();
}

tobaActions({
  newFueling: () => openFuelSheet(),
  editFueling: (el) => openFuelSheet(racingDb.fuelings.find((f) => String(f.id) === el.dataset.id)),
  saveFueling,
  deleteFueling,
  pickFuelType: (el) => renderFuelTypeChips(el.dataset.fuel),
});

// Depois das máscaras (elas formatam o campo no mesmo "input"), por isso o setTimeout
document.querySelectorAll(".rc-calc").forEach((el) => el.addEventListener("input", () => setTimeout(() => onFuelCalcInput(el), 0)));
document.getElementById("fuelOdometer").addEventListener("input", updateOdoHint);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) renderFuelScreen();
});

initTobaDecimalMasks();
renderFuelScreen();
// Atalho do hub/portal: ?add=1 já abre a folha
if (new URLSearchParams(location.search).get("add") === "1") openFuelSheet();
