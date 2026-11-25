/* =====================================================================
 * Portal · Visões da página inicial (v2.13)
 * ---------------------------------------------------------------------
 * Escolha na ⚙️ › Painel › 🖼️ Visão do painel:
 *   cards  = os cards completos de sempre (#modulesGrid, Configurador)
 *   linha  = uma linha enxuta por app, números em chips
 *   quad   = quadradinhos, 3 por linha, 1 número cada
 *   painel = ⭐ Meu painel: números escolhidos de qualquer app + atalhos
 *
 * Os apps vêm dos próprios <a class="app-card"> do index.html (portalCards
 * do portal.js: mesma ordem e mesmo 👁️/🙈 da "Ordem dos apps"). App novo:
 *   1. copie um card no index.html (ver _molde-app/README.md): já aparece
 *      nas 4 visões, com ícone, nome, link e badge;
 *   2. quer número? acrescente uma entrada em PORTAL_APP_STATS abaixo,
 *      com a mesma data-id do card (items = o que dá pra escolher,
 *      read = os valores, só leitura do banco do app).
 *
 * Preferência: "toba_portal_view" = { view, pins: ["<data-id>:<key>"] }.
 * Só UI: nenhum banco de app é gravado aqui.
 * ===================================================================== */

const PORTAL_VIEW_KEY = "toba_portal_view";
const PORTAL_VIEWS = [
  { id: "quad", icon: "▦", label: "Quadradinho", desc: "3 por linha" },
  { id: "linha", icon: "☰", label: "Linha", desc: "enxuta" },
  { id: "painel", icon: "⭐", label: "Meu painel", desc: "tu escolhe" },
  { id: "cards", icon: "🃏", label: "Completo", desc: "cards de antes" },
];
const PORTAL_PINS_MAX = 8;
const PORTAL_VIEW_DEFAULTS = {
  view: "quad",
  pins: ["toba-bank:livre", "toba-health:peso", "toba-routine:hoje", "toba-racing:kml"],
};

function getPortalViewConfig() {
  const cfg = readPortalJson(PORTAL_VIEW_KEY, PORTAL_VIEW_DEFAULTS);
  if (!PORTAL_VIEWS.some((v) => v.id === cfg.view)) cfg.view = PORTAL_VIEW_DEFAULTS.view;
  cfg.pins = Array.isArray(cfg.pins) ? cfg.pins.filter((p) => typeof p === "string").slice(0, PORTAL_PINS_MAX) : [...PORTAL_VIEW_DEFAULTS.pins];
  return cfg;
}

function savePortalViewConfig(cfg) {
  if (!writePortalJson(PORTAL_VIEW_KEY, { view: cfg.view, pins: cfg.pins })) {
    showPageMessage("A memória do navegador encheu e a visão não foi salva.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  return true;
}

/* ---------------------------------------------------------------------
 * Números de cada app (só leitura, mesmas contas dos cards completos)
 * Cada read() devolve { <key>: { value, tone?, sub? } } ou null (sem dados).
 * tone: "green" | "red" | "blue" | "gold" | "coral" | ""
 * ------------------------------------------------------------------- */
function portalReadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch (e) {
    console.error(`Erro ao ler ${key}`, e);
    return null;
  }
}

const PORTAL_APP_STATS = {
  "toba-bank": {
    items: [
      { key: "livre", label: "💵 Livre hoje", short: "livre hoje" },
      { key: "cofre", label: "💎 Cofre", short: "no cofre" },
      { key: "gastos", label: "🔥 Gastos mês", short: "gasto no mês" },
      { key: "sobra", label: "🎯 Sobra", short: "sobra prevista" },
    ],
    // Linha/quadradinho seguem o Configurador do card (Simples = sem número)
    lineKeys: () => {
      const cfg = getBankCardConfig();
      if (cfg.type === "simples") return [];
      return [cfg.orcamento && "livre", cfg.cofre && "cofre", cfg.gastos && "gastos", cfg.sobra && "sobra"].filter(Boolean);
    },
    read: () => {
      if (!localStorage.getItem("TOBA_BANK_DB")) return null;
      const m = obterMetricasReaisTobaBank();
      const privacy = getBankCardConfig().privacy;
      const money = (v) => (privacy ? "R$ ***" : formatCurrency(v));
      const tone = (v) => (privacy ? "" : v < 0 ? "red" : "green");
      return {
        livre: { value: money(m.disponivel), tone: tone(m.disponivel) },
        cofre: { value: money(m.patrimonio), tone: tone(m.patrimonio) },
        gastos: { value: money(m.saidas), tone: privacy ? "" : "red" },
        sobra: { value: money(m.sobra), tone: tone(m.sobra) },
      };
    },
  },

  "toba-health": {
    items: [
      { key: "peso", label: "⚖️ Peso", short: "peso" },
      { key: "pesoMes", label: "📉 Peso no mês", short: "no mês" },
      { key: "treinos", label: "🏋️ Treinos mês", short: "no mês" },
      { key: "km", label: "📍 Km no mês", short: "no mês" },
      { key: "semana", label: "📅 Treinos semana", short: "na semana" },
      { key: "kcal", label: "🔥 Calorias mês", short: "no mês" },
      { key: "minutos", label: "⏱️ Tempo mês", short: "treinado" },
      { key: "saitama", label: "👊 Saitama mês", short: "reps" },
      { key: "gordura", label: "🧈 Gordura", short: "gordura" },
    ],
    lineKeys: () => {
      const cfg = getHealthCardConfig();
      if (cfg.type === "simples") return [];
      return HEALTH_CARD_METRICS.filter((m) => cfg.metrics[m.key]).map((m) => m.key);
    },
    read: () => {
      const h = obterResumoTobaHealth();
      if (h.weight === null && h.lastWorkoutDaysAgo === null) return null;
      const privacy = getHealthCardConfig().privacy;
      const n = (v, d = 1) => formatPortalNumber(v, d);
      const plural = (v, one, many) => `${n(v, 0)} ${v === 1 ? one : many}`;
      const diff = (d) => {
        if (d === null) return { value: "--" };
        if (privacy) return { value: "** kg" };
        if (Math.abs(d) < 0.005) return { value: "0 kg" };
        return { value: `${d < 0 ? "▼" : "▲"} ${formatKg(Math.abs(d))}`, tone: d < 0 ? "green" : "red" };
      };
      const hours = Math.floor(h.monthMinutes / 60);
      return {
        peso: h.weight === null
          ? { value: "--", sub: "sem pesagem" }
          : { value: privacy ? "** kg" : formatKg(h.weight), sub: formatDaysAgo(h.weightDaysAgo) },
        pesoMes: diff(h.weightMonthDiff),
        treinos: { value: plural(h.monthCount, "treino", "treinos"), tone: "green" },
        km: { value: `${n(h.monthKm, 1)} km`, tone: "blue" },
        semana: { value: plural(h.weekCount, "treino", "treinos"), tone: "green" },
        kcal: { value: `${n(h.monthCalories, 0)} kcal`, tone: "gold" },
        minutos: { value: hours ? `${hours}h${String(Math.round(h.monthMinutes % 60)).padStart(2, "0")}` : `${n(h.monthMinutes, 0)} min` },
        saitama: { value: `${n(h.monthSaitamaReps, 0)} reps`, tone: "coral" },
        gordura: h.fat === null ? { value: "--" } : { value: privacy ? "**%" : `${n(h.fat, 1)}%` },
      };
    },
  },

  "toba-kitchen": {
    items: [
      { key: "hoje", label: "🍽️ Cozinha hoje", short: "hoje", wide: true },
      { key: "feitas", label: "👨‍🍳 Receitas feitas", short: "feitas" },
    ],
    read: () => {
      if (typeof calcKitchenSummary !== "function") return null;
      const k = calcKitchenSummary(portalReadJson("TOBA_KITCHEN_DB"));
      if (!k.todayPlan.length && !k.cookedTotal) return null;
      const out = { feitas: { value: `${k.cookedTotal}`, tone: "gold" } };
      if (k.todayPlan.length === 1) out.hoje = { value: `${k.todayPlan[0].emoji} ${k.todayPlan[0].name}` };
      else if (k.todayPlan.length) out.hoje = { value: `${k.todayPlan.map((r) => r.emoji).join(" ")} ${k.todayPlan.length} receitas` };
      return out;
    },
  },

  "toba-routine": {
    items: [
      { key: "hoje", label: "✅ Tarefas hoje", short: "hoje" },
      { key: "livreSemana", label: "🆓 Livre semana", short: "livre" },
      { key: "mes", label: "📆 Feitas mês", short: "no mês" },
      { key: "tasks", label: "🛠️ Tasks", short: "tasks" },
      { key: "livreHoje", label: "⏳ Livre hoje", short: "livre hoje" },
      { key: "semana", label: "📅 Feitas semana", short: "na semana" },
      { key: "amanha", label: "🌅 Amanhã", short: "amanhã" },
      { key: "atrasadas", label: "⏰ Atrasadas", short: "atrasadas" },
      { key: "streak", label: "🔥 Sequência", short: "seguidas" },
      { key: "xp", label: "⭐ XP rotina mês", short: "XP" },
    ],
    lineKeys: () => {
      const cfg = getRoutineCardConfig();
      if (cfg.type === "simples") return ["hoje", "atrasadas"];
      return ROUTINE_CARD_METRICS.filter((m) => cfg.metrics[m.key]).map((m) => m.key);
    },
    read: () => {
      const data = readRoutineDbRaw();
      const r = data ? calcRoutineSummary(data) : null;
      if (!r || r.isEmpty) return null;
      const t = r.today;
      return {
        hoje: t.total
          ? { value: `${t.done}/${t.total}`, tone: t.done === t.total ? "green" : "", sub: t.done === t.total ? "tudo feito 🔥" : `faltam ${t.total - t.done}` }
          : { value: "🏖️ livre", sub: "nada agendado" },
        livreSemana: { value: routineFormatMinutes(r.freeWeek), tone: "blue" },
        mes: { value: `${r.monthDone}`, tone: "green" },
        tasks: { value: `${r.oneoffsOpen}` },
        livreHoje: { value: routineFormatMinutes(r.freeToday), tone: "blue" },
        semana: { value: `${r.weekDone}`, tone: "green" },
        amanha: { value: `${r.tomorrow}` },
        atrasadas: { value: `${t.overdue}`, tone: t.overdue ? "red" : "green" },
        streak: { value: `${r.streak.len}`, tone: "gold" },
        xp: { value: `${r.monthXp}`, tone: "gold" },
      };
    },
  },

  "toba-racing": {
    items: [
      { key: "kml", label: "🏁 Último tanque", short: "km/l" },
      { key: "media", label: "📊 Média km/l", short: "média" },
      { key: "gasto", label: "⛽ Combustível mês", short: "no mês" },
      { key: "drive", label: "🧭 Km navegados", short: "navegados" },
    ],
    read: () => {
      if (typeof calcRacingSummary !== "function") return null;
      const s = calcRacingSummary(portalReadJson("TOBA_RACING_DB"));
      const out = {};
      if (s.lastKml) {
        const badge = racingTrendBadge(s.trend);
        out.kml = { value: `${formatRacingKml(s.lastKml)} km/l${badge ? ` ${badge.icon}` : ""}` };
        if (s.avgKml) out.media = { value: `${formatRacingKml(s.avgKml)}` };
      }
      if (s.monthSpent) out.gasto = { value: formatCurrency(s.monthSpent), tone: "red" };
      if (typeof calcDriveSummary === "function") {
        const d = calcDriveSummary(portalReadJson("TOBA_DRIVE_DB"));
        if (d.monthKm) out.drive = { value: `${driveFormatKm(d.monthKm * 1000)} km`, tone: "blue" };
      }
      return Object.keys(out).length ? out : null;
    },
  },

  "toba-turism": {
    items: [
      { key: "want", label: "📌 Lugares pra ir", short: "pra ir" },
      { key: "been", label: "✅ Visitados", short: "visitados" },
    ],
    read: () => {
      if (typeof calcTurismSummary !== "function") return null;
      const s = calcTurismSummary(portalReadJson("TOBA_TURISM_DB"));
      if (!s.want && !s.been) return null;
      return { want: { value: `${s.want}`, tone: "blue" }, been: { value: `${s.been}`, tone: "green" } };
    },
  },
};

// Cada render lê os bancos uma vez só por app.
function portalReadAllStats() {
  const out = {};
  Object.entries(PORTAL_APP_STATS).forEach(([id, def]) => {
    try {
      out[id] = def.read() || null;
    } catch (e) {
      console.error(`Erro ao montar os números do ${id}`, e);
      out[id] = null;
    }
  });
  return out;
}

// Chaves que aparecem na linha/quadradinho (Configurador manda; sem ele, todas)
function portalLineStats(appId, values) {
  const def = PORTAL_APP_STATS[appId];
  if (!def || !values) return [];
  const keys = def.lineKeys ? def.lineKeys() : def.items.map((i) => i.key);
  return keys
    .map((key) => {
      const item = def.items.find((i) => i.key === key);
      return item && values[key] ? { ...item, ...values[key] } : null;
    })
    .filter(Boolean);
}

/* ---------------------------------------------------------------------
 * Desenho
 * ------------------------------------------------------------------- */
function portalAppInfo(c) {
  const el = c.element;
  const badge = el.querySelector(".badge-beta, .badge-dev");
  const desc = el.querySelector(".app-desc");
  return {
    id: c.id,
    icon: c.icon,
    title: c.title,
    short: c.title.replace(/^Toba\s+/i, ""),
    href: el.getAttribute("href") || "#",
    soon: el.classList.contains("is-soon"),
    soonMsg: el.dataset.msg || "",
    badge: badge ? (badge.classList.contains("badge-dev") ? "soon" : "beta") : "",
    desc: desc ? desc.textContent.replace(/\s+/g, " ").trim() : "",
  };
}

// Atributos do link: app em breve abre o aviso em vez de navegar.
function portalLinkAttrs(app, cls) {
  return app.soon
    ? `href="#" class="${cls} is-soon" data-click="soonApp" data-msg="${escapeHtml(app.soonMsg)}"`
    : `href="${escapeHtml(app.href)}" class="${cls}"`;
}

const portalTone = (tone) => (tone ? ` is-${tone}` : "");

function renderPortalLine(apps, stats, pending) {
  return `<div class="pv-rows">${apps.map((app) => {
    const chips = portalLineStats(app.id, stats[app.id]).slice(0, 3);
    const alert = app.id === "toba-bank" && pending.count ? `<span class="pv-alert">🤖${pending.count}</span>` : "";
    const badge = app.badge ? `<span class="badge ${app.badge === "soon" ? "badge-dev" : "badge-beta"}">${app.badge === "soon" ? "Em breve" : "Beta"}</span>` : "";
    const body = chips.length
      ? `<span class="pv-chips">${chips.map((s) => `<span class="pv-chip">${escapeHtml(s.label.split(" ")[0])} <b class="${portalTone(s.tone).trim()}">${escapeHtml(s.value)}</b></span>`).join("")}</span>`
      : `<span class="pv-desc">${escapeHtml(app.desc)}</span>`;
    return `<a ${portalLinkAttrs(app, "pv-row")}>
      <span class="pv-icon">${app.icon}</span>
      <span class="pv-main"><span class="pv-title">${escapeHtml(app.title)}${badge}${alert}</span>${body}</span>
      ${app.soon ? "" : '<span class="toba-hub-chevron">›</span>'}
    </a>`;
  }).join("")}</div>`;
}

function renderPortalQuad(apps, stats, pending) {
  return `<div class="pv-grid">${apps.map((app) => {
    const s = portalLineStats(app.id, stats[app.id])[0];
    const alert = app.id === "toba-bank" && pending.count ? `<span class="pv-alert is-corner">🤖${pending.count}</span>` : "";
    const dot = app.badge === "beta" ? '<span class="pv-dot" aria-label="Beta"></span>' : "";
    const num = app.soon
      ? '<span class="pv-sq-tag">em breve</span>'
      : s
        ? `<span class="pv-sq-num${portalTone(s.tone)}">${escapeHtml(s.value)}</span><span class="pv-sq-tag">${escapeHtml(s.short)}</span>`
        : "";
    return `<a ${portalLinkAttrs(app, "pv-sq")} aria-label="${escapeHtml(app.title)}">
      ${alert}${dot}
      <span class="pv-sq-icon">${app.icon}</span>
      <span class="pv-sq-name">${escapeHtml(app.short)}</span>
      ${num}
    </a>`;
  }).join("")}</div>`;
}

function renderPortalPainel(apps, stats, cfg) {
  const byId = Object.fromEntries(portalCards.map((c) => [c.id, portalAppInfo(c)]));
  const tiles = cfg.pins.map((pin) => {
    const [appId, key] = pin.split(":");
    const def = PORTAL_APP_STATS[appId];
    const item = def && def.items.find((i) => i.key === key);
    const app = byId[appId];
    if (!item || !app) return "";
    const v = (stats[appId] && stats[appId][key]) || { value: "--" };
    return `<a ${portalLinkAttrs(app, `pv-tile${item.wide ? " is-wide" : ""}`)}>
      <span class="pv-tile-label"><span>${escapeHtml(item.label)}</span><span aria-hidden="true">${app.icon}</span></span>
      <span class="pv-tile-value${portalTone(v.tone)}">${escapeHtml(v.value)}</span>
      ${v.sub ? `<span class="pv-tile-sub">${escapeHtml(v.sub)}</span>` : ""}
    </a>`;
  }).join("");
  const empty = '<div class="pv-empty">Nenhum número escolhido ainda. Toca no ✏️ aí embaixo e escolhe os teus 😎</div>';
  const dock = apps.map((app) => `<a ${portalLinkAttrs(app, "pv-dock-btn")} aria-label="${escapeHtml(app.title)}">${app.icon}</a>`).join("");
  return `<div class="pv-tiles">${tiles || empty}</div>
    <nav class="pv-dock" aria-label="Atalhos dos apps">${dock}</nav>
    <button type="button" class="pv-edit" data-click="openPinsConfig">✏️ Escolher os números</button>`;
}

function renderPortalViews() {
  const box = document.getElementById("portalViews");
  const grid = document.getElementById("modulesGrid");
  if (!box || !grid || !portalCards.length) return;
  const cfg = getPortalViewConfig();
  const isCards = cfg.view === "cards";
  grid.hidden = !isCards;
  box.hidden = isCards;
  box.dataset.view = cfg.view;
  if (isCards) {
    box.innerHTML = "";
    return;
  }
  const apps = portalCards.filter((c) => c.visible).map(portalAppInfo);
  const stats = portalReadAllStats();
  const pending = portalPendingInfo();
  if (cfg.view === "linha") box.innerHTML = renderPortalLine(apps, stats, pending);
  else if (cfg.view === "painel") box.innerHTML = renderPortalPainel(apps, stats, cfg);
  else box.innerHTML = renderPortalQuad(apps, stats, pending);
}

/* ---------------------------------------------------------------------
 * ⚙️ › Painel: escolha da visão e dos números do Meu painel
 * ------------------------------------------------------------------- */
function renderPortalViewPicker() {
  const box = document.getElementById("portalViewPicker");
  if (!box) return;
  const cfg = getPortalViewConfig();
  box.innerHTML = PORTAL_VIEWS.map((v) => `
    <button type="button" class="pv-pick" data-click="setPortalView" data-view="${v.id}" aria-pressed="${cfg.view === v.id}">
      <span class="pv-pick-icon">${v.icon}</span>
      <span class="pv-pick-text"><b>${v.label}</b><span>${v.desc}</span></span>
    </button>`).join("");
  const pinsBtn = document.getElementById("portalPinsMenuDesc");
  if (pinsBtn) pinsBtn.textContent = `${cfg.pins.length} de ${PORTAL_PINS_MAX} escolhidos`;
}

function renderPortalPinsSheet() {
  const box = document.getElementById("portalPinsList");
  if (!box) return;
  const cfg = getPortalViewConfig();
  const full = cfg.pins.length >= PORTAL_PINS_MAX;
  document.getElementById("portalPinsCount").textContent = `${cfg.pins.length} de ${PORTAL_PINS_MAX}${full ? " · tá cheio, tira um pra pôr outro" : ""}`;
  box.innerHTML = portalCards
    .filter((c) => PORTAL_APP_STATS[c.id])
    .map((c) => `
      <div class="pv-pin-group">
        <div class="pv-pin-app">${c.icon} ${escapeHtml(c.title)}</div>
        <div class="pv-pin-chips">${PORTAL_APP_STATS[c.id].items.map((item) => {
          const pin = `${c.id}:${item.key}`;
          const on = cfg.pins.includes(pin);
          return `<button type="button" class="chip-btn pv-pin${on ? " is-on" : ""}" data-click="togglePortalPin" data-pin="${escapeHtml(pin)}" aria-pressed="${on}"${!on && full ? " disabled" : ""}>${escapeHtml(item.label)}</button>`;
        }).join("")}</div>
      </div>`)
    .join("");
}

function setPortalView(view) {
  const cfg = getPortalViewConfig();
  if (!PORTAL_VIEWS.some((v) => v.id === view) || cfg.view === view) return;
  cfg.view = view;
  if (!savePortalViewConfig(cfg)) return;
  renderPortalViewPicker();
  renderPortalViews();
  tobaToast(`${PORTAL_VIEWS.find((v) => v.id === view).icon} Visão ${PORTAL_VIEWS.find((v) => v.id === view).label}`);
}

function togglePortalPin(pin) {
  const cfg = getPortalViewConfig();
  if (cfg.pins.includes(pin)) cfg.pins = cfg.pins.filter((p) => p !== pin);
  else if (cfg.pins.length < PORTAL_PINS_MAX) cfg.pins = [...cfg.pins, pin];
  else return;
  if (!savePortalViewConfig(cfg)) return;
  renderPortalPinsSheet();
  renderPortalViewPicker();
  renderPortalViews();
}

tobaActions({
  setPortalView: (el) => setPortalView(el.dataset.view),
  openPinsConfig: () => {
    renderPortalPinsSheet();
    openTobaModal("pinsModal");
  },
  togglePortalPin: (el) => togglePortalPin(el.dataset.pin),
});

// Mexeu no Configurador de cards ou na Ordem dos apps: redesenha a visão
// quando a folha fecha (toba:close não borbulha, então escuta na captura).
document.addEventListener("toba:close", () => {
  renderPortalViewPicker();
  renderPortalViews();
}, true);

document.addEventListener("DOMContentLoaded", renderPortalViewPicker);
