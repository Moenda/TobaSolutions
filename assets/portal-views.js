/* =====================================================================
 * Portal · Visões da página inicial (v2.13, ⭐ Meu painel montável na v2.14)
 * ---------------------------------------------------------------------
 * Escolha na ⚙️ › Painel › 🖼️ Visão do painel:
 *   cards  = os cards completos de sempre (#modulesGrid, Configurador)
 *   linha  = uma linha enxuta por app, números em chips
 *   quad   = quadradinhos, 3 por linha, 1 número cada
 *   painel = ⭐ Meu painel: molde com quadradinhos ＋ que tu monta (v2.14)
 *
 * Os apps vêm dos próprios <a class="app-card"> do index.html (portalCards
 * do portal.js: mesma ordem e mesmo 👁️/🙈 da "Ordem dos apps"). App novo:
 *   1. copie um card no index.html (ver _molde-app/README.md): já aparece
 *      nas 4 visões, com ícone, nome, link e badge;
 *   2. quer número? acrescente uma entrada em PORTAL_APP_STATS abaixo,
 *      com a mesma data-id do card (items = o que dá pra escolher,
 *      read = os valores, só leitura do banco do app).
 *
 * Preferência: "toba_portal_view" = { view, pins, layout, slots }.
 *   v2.14: o ⭐ Meu painel virou mostrador de relógio: um molde (layout)
 *   com quadradinhos e cada um guarda o que vai nele (slots[i]):
 *     "<data-id>:<key>" = número de um app (PORTAL_APP_STATS)
 *     "app:<data-id>"   = atalho de um app
 *     "x:<key>"         = extra (PORTAL_EXTRAS: relógio, compras pra aprovar)
 *     ""                = vazio (mostra o ＋)
 *   pins (v2.13) continua gravado só com os números, pra não quebrar nada.
 * Só UI: nenhum banco de app é gravado aqui.
 * ===================================================================== */

const PORTAL_VIEW_KEY = "toba_portal_view";
const PORTAL_VIEWS = [
  { id: "quad", icon: "▦", label: "Quadradinho", desc: "3 por linha" },
  { id: "linha", icon: "☰", label: "Linha", desc: "enxuta" },
  { id: "painel", icon: "⭐", label: "Meu painel", desc: "tu monta" },
  { id: "cards", icon: "🃏", label: "Completo", desc: "cards de antes" },
];
const PORTAL_PINS_MAX = 8;
const PORTAL_VIEW_DEFAULTS = {
  view: "quad",
  pins: ["toba-bank:livre", "toba-health:peso", "toba-routine:hoje", "toba-racing:kml"],
  layout: "classico",
};

/* Moldes do ⭐ Meu painel (grade de 6 colunas no celular).
 * Tamanhos: s = pequeno (3 por linha), m = médio (2 por linha),
 *           w = comprido (linha inteira), b = grandão (linha inteira, alto) */
const PORTAL_SLOTS_MAX = 9;
const PORTAL_SIZE_NAMES = { s: "pequeno", m: "médio", w: "comprido", b: "grandão" };
const PORTAL_LAYOUTS = [
  { id: "classico", icon: "▦", label: "Clássico", sizes: "mmmmmmmm" },
  { id: "destaque", icon: "🌟", label: "Destaque", sizes: "bmmssssss" },
  { id: "mostrador", icon: "⌚", label: "Mostrador", sizes: "wsssmmsss" },
  { id: "mini", icon: "🔳", label: "Mini", sizes: "sssssssss" },
  { id: "faixas", icon: "☰", label: "Faixas", sizes: "wwwww" },
];

const portalSlotOk = (v) => typeof v === "string" && /^[a-z]+(-[a-z]+)*:[A-Za-z]+$|^app:[a-z-]+$|^x:[a-z]+$/.test(v);

function getPortalViewConfig() {
  const cfg = readPortalJson(PORTAL_VIEW_KEY, PORTAL_VIEW_DEFAULTS);
  if (!PORTAL_VIEWS.some((v) => v.id === cfg.view)) cfg.view = PORTAL_VIEW_DEFAULTS.view;
  cfg.pins = Array.isArray(cfg.pins) ? cfg.pins.filter((p) => typeof p === "string").slice(0, PORTAL_PINS_MAX) : [...PORTAL_VIEW_DEFAULTS.pins];
  if (!PORTAL_LAYOUTS.some((l) => l.id === cfg.layout)) cfg.layout = PORTAL_VIEW_DEFAULTS.layout;
  // v2.14: quem vem da v2.13 só tem pins -> viram os primeiros quadradinhos
  const src = Array.isArray(cfg.slots) ? cfg.slots : cfg.pins;
  const seen = new Set();
  cfg.slots = Array.from({ length: PORTAL_SLOTS_MAX }, (_, i) => {
    const v = src[i];
    if (!portalSlotOk(v) || seen.has(v)) return "";
    seen.add(v);
    return v;
  });
  return cfg;
}

function savePortalViewConfig(cfg) {
  const pins = cfg.slots.filter((v) => v && !/^(app|x):/.test(v)).slice(0, PORTAL_PINS_MAX);
  if (!writePortalJson(PORTAL_VIEW_KEY, { view: cfg.view, pins, layout: cfg.layout, slots: cfg.slots })) {
    showPageMessage("A memória do navegador encheu e a visão não foi salva.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  return true;
}

const portalLayout = (cfg) => PORTAL_LAYOUTS.find((l) => l.id === cfg.layout) || PORTAL_LAYOUTS[0];

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

/* ---------------------------------------------------------------------
 * ⭐ Meu painel (v2.14): mostrador de relógio
 * Molde com quadradinhos; o vazio mostra ＋ e um toque abre a escolha.
 * ✏️ Montar (ou segurar um quadradinho) entra no modo de montar: troca o
 * molde, troca/esvazia cada quadradinho. Escolher algo que já tá em outro
 * quadradinho troca os dois de lugar. Molde menor só esconde os que
 * sobraram (voltando pro maior eles reaparecem).
 * ------------------------------------------------------------------- */
const PORTAL_EXTRAS = [
  {
    key: "hora",
    label: "🕐 Relógio",
    short: "agora",
    read: () => {
      const d = new Date();
      const week = d.toLocaleDateString("pt-BR", { weekday: "long" });
      return {
        value: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        sub: `${week} · ${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "")}`,
        clock: true,
      };
    },
  },
  {
    key: "aprovar",
    label: "🤖 Pra aprovar",
    short: "pra aprovar",
    href: "./TobaBank/TobaBank-Gastos.html?pending=1",
    read: (ctx) => {
      if (!(TOBA_NATIVE && typeof TOBA_NATIVE.getPendingPurchases === "function")) return { value: "--", sub: "só no app Android" };
      const { count, total } = ctx.pending;
      return count
        ? { value: `${count}`, tone: "red", sub: `${formatCurrency(total)} esperando` }
        : { value: "0", tone: "green", sub: "nada esperando 😎" };
    },
  },
];

let painelEditing = false;
let painelPickIndex = -1;

// O que um quadradinho mostra (ou null = vazio / item que não existe mais)
function portalSlotParts(slot, ctx) {
  if (!slot) return null;
  const cut = slot.indexOf(":");
  const kind = slot.slice(0, cut);
  const key = slot.slice(cut + 1);
  if (kind === "app") {
    const app = ctx.byId[key];
    if (!app) return null;
    return { app, isApp: true, emoji: app.icon, label: app.title, short: app.short, value: app.short, sub: app.soon ? "em breve" : app.desc };
  }
  if (kind === "x") {
    const ex = PORTAL_EXTRAS.find((e) => e.key === key);
    if (!ex) return null;
    return { ...ex.read(ctx), emoji: ex.label.split(" ")[0], label: ex.label, short: ex.short, href: ex.href, extra: key };
  }
  const def = PORTAL_APP_STATS[kind];
  const item = def && def.items.find((i) => i.key === key);
  const app = ctx.byId[kind];
  if (!item || !app) return null;
  const v = (ctx.stats[kind] && ctx.stats[kind][key]) || { value: "--" };
  return { app, emoji: item.label.split(" ")[0], label: item.label, short: item.short, value: v.value, tone: v.tone, sub: v.sub };
}

// Nome curto de um item pra toast e folha ("💵 Livre hoje", "📱 Bank")
function portalSlotName(slot, ctx) {
  const p = portalSlotParts(slot, ctx);
  if (!p) return "";
  return p.isApp ? `${p.emoji} Atalho do ${p.short}` : p.label;
}

function portalPainelCtx() {
  return {
    byId: Object.fromEntries(portalCards.map((c) => [c.id, portalAppInfo(c)])),
    stats: portalReadAllStats(),
    pending: portalPendingInfo(),
  };
}

function renderPainelTileInner(p, size, ctx) {
  const tone = portalTone(p.tone);
  const clock = p.clock ? " pv-clock" : "";
  const alert = p.isApp && p.app.id === "toba-bank" && ctx.pending.count ? `<span class="pv-alert is-corner">🤖${ctx.pending.count}</span>` : "";
  if (p.isApp) {
    return size === "s"
      ? `${alert}<span class="pv-slot-big">${p.emoji}</span><span class="pv-slot-tag is-name">${escapeHtml(p.short)}</span>`
      : `${alert}<span class="pv-slot-app"><span class="pv-slot-big">${p.emoji}</span><span class="pv-slot-app-text"><span class="pv-slot-value">${escapeHtml(p.label)}</span><span class="pv-slot-sub">${escapeHtml(p.sub)}</span></span></span>`;
  }
  if (size === "s") {
    return `<span class="pv-slot-emoji">${p.emoji}</span>
      <span class="pv-slot-value${tone}${clock}" data-clock="value">${escapeHtml(p.value)}</span>
      <span class="pv-slot-tag">${escapeHtml(p.short)}</span>`;
  }
  const appIcon = p.app ? `<span aria-hidden="true">${p.app.icon}</span>` : "";
  return `<span class="pv-slot-label"><span>${escapeHtml(p.label)}</span>${appIcon}</span>
    <span class="pv-slot-value${tone}${clock}" data-clock="value">${escapeHtml(p.value)}</span>
    ${p.sub ? `<span class="pv-slot-sub${clock}" data-clock="sub">${escapeHtml(p.sub)}</span>` : ""}`;
}

function renderPainelTile(i, size, slot, ctx) {
  const p = portalSlotParts(slot, ctx);
  const cls = `pv-slot is-${size}`;
  if (!p) {
    const tag = size === "s" ? "" : `<span class="pv-plus-tag">${painelEditing ? `quadradinho ${PORTAL_SIZE_NAMES[size]}` : "toca e escolhe"}</span>`;
    return `<button type="button" class="${cls} is-empty" data-click="pickPainelSlot" data-slot="${i}" aria-label="Escolher o que vai no quadradinho ${i + 1}"><span class="pv-plus">＋</span>${tag}</button>`;
  }
  const inner = renderPainelTileInner(p, size, ctx);
  if (painelEditing) {
    return `<button type="button" class="${cls} is-editing" data-click="pickPainelSlot" data-slot="${i}" aria-label="Trocar o quadradinho ${i + 1}">${inner}<span class="pv-slot-pen" aria-hidden="true">✏️</span></button>`;
  }
  if (p.app) return `<a ${portalLinkAttrs(p.app, cls)} data-slot="${i}">${inner}</a>`;
  if (p.href) return `<a href="${escapeHtml(p.href)}" class="${cls}" data-slot="${i}">${inner}</a>`;
  return `<div class="${cls}" data-slot="${i}">${inner}</div>`;
}

// Miniatura do molde (as caixinhas no tamanho certo)
function renderLayoutMini(layout) {
  return `<span class="pv-mini">${[...layout.sizes].map((sz) => `<i class="is-${sz}"></i>`).join("")}</span>`;
}

function renderPortalPainel(apps, cfg) {
  const ctx = portalPainelCtx();
  const layout = portalLayout(cfg);
  const sizes = [...layout.sizes];
  const tiles = sizes.map((sz, i) => renderPainelTile(i, sz, cfg.slots[i], ctx)).join("");
  const filled = sizes.filter((_, i) => portalSlotParts(cfg.slots[i], ctx)).length;
  const hidden = cfg.slots.slice(sizes.length).filter(Boolean).length;
  const dock = apps.map((app) => `<a ${portalLinkAttrs(app, "pv-dock-btn")} aria-label="${escapeHtml(app.title)}">${app.icon}</a>`).join("");

  if (painelEditing) {
    const layouts = PORTAL_LAYOUTS.map((l) => `
      <button type="button" class="pv-layout" data-click="setPainelLayout" data-layout="${l.id}" aria-pressed="${l.id === layout.id}">
        ${renderLayoutMini(l)}<span class="pv-layout-name">${l.icon} ${l.label}</span>
      </button>`).join("");
    return `<div class="pv-edit-bar">
        <div class="pv-edit-head"><b>✏️ Montando o painel</b><button type="button" class="pv-done" data-click="painelEditDone">✔ Pronto</button></div>
        <div class="pv-layouts" role="group" aria-label="Molde do painel">${layouts}</div>
        <p class="pv-edit-hint">Toca num quadradinho pra escolher, trocar ou esvaziar. Escolher um que já tá em outro lugar troca os dois de lugar.${hidden ? ` <b>${hidden} guardado${hidden === 1 ? "" : "s"}</b> fora desse molde: volta pra um maior que eles reaparecem.` : ""}</p>
      </div>
      <div class="pv-slots is-editing">${tiles}</div>`;
  }
  const first = !filled ? '<p class="pv-edit-hint is-center">Painel vazio: toca num ＋ e escolhe o que vai em cada quadradinho 😎</p>' : "";
  return `${first}<div class="pv-slots">${tiles}</div>
    <nav class="pv-dock" aria-label="Atalhos dos apps">${dock}</nav>
    <button type="button" class="pv-edit" data-click="painelEdit">✏️ Montar o painel <span>(ou segura um quadradinho)</span></button>`;
}

/* Folha "O que vai aqui?" (o ＋ ou o ✏️ de um quadradinho) */
function renderPainelPickSheet() {
  const box = document.getElementById("portalPinsList");
  if (!box || painelPickIndex < 0) return;
  const cfg = getPortalViewConfig();
  const layout = portalLayout(cfg);
  const i = painelPickIndex;
  const size = layout.sizes[i] || "m";
  const ctx = portalPainelCtx();
  const current = cfg.slots[i];
  const visibleSlots = layout.sizes.length;
  document.getElementById("painelPickTitle").textContent = current ? `✏️ Quadradinho ${i + 1}` : `＋ O que vai no quadradinho ${i + 1}?`;
  document.getElementById("painelPickText").innerHTML = current && portalSlotParts(current, ctx)
    ? `Agora: <b>${escapeHtml(portalSlotName(current, ctx))}</b> · quadradinho ${PORTAL_SIZE_NAMES[size]}. Toca em outro pra trocar.`
    : `Quadradinho ${PORTAL_SIZE_NAMES[size]}. Toca no que tu quer ver aqui.`;

  const chip = (value, label) => {
    const at = cfg.slots.indexOf(value);
    const on = at === i;
    const elsewhere = at >= 0 && !on;
    const where = elsewhere ? `<span class="pv-pin-where">${at < visibleSlots ? `#${at + 1}` : "guardado"}</span>` : "";
    return `<button type="button" class="chip-btn pv-pin${on ? " is-on" : ""}${elsewhere ? " is-used" : ""}" data-click="setPainelSlot" data-value="${escapeHtml(value)}" aria-pressed="${on}">${escapeHtml(label)}${where}</button>`;
  };
  const group = (title, chips) => `<div class="pv-pin-group"><div class="pv-pin-app">${title}</div><div class="pv-pin-chips">${chips}</div></div>`;

  const extras = group("✨ Extras", PORTAL_EXTRAS.map((e) => chip(`x:${e.key}`, e.label)).join(""));
  const shortcuts = group("📱 Atalho de app", portalCards.filter((c) => c.visible).map((c) => chip(`app:${c.id}`, `${c.icon} ${c.title.replace(/^Toba\s+/i, "")}`)).join(""));
  const numbers = portalCards
    .filter((c) => PORTAL_APP_STATS[c.id])
    .map((c) => group(`${c.icon} ${escapeHtml(c.title)}`, PORTAL_APP_STATS[c.id].items.map((item) => chip(`${c.id}:${item.key}`, item.label)).join("")))
    .join("");
  const clear = current ? '<button type="button" class="btn btn-secondary pv-clear" data-click="setPainelSlot" data-value="">🗑️ Deixar vazio (volta o ＋)</button>' : "";
  box.innerHTML = extras + shortcuts + numbers + clear;
}

function openPainelPick(index) {
  const cfg = getPortalViewConfig();
  if (!(index >= 0 && index < portalLayout(cfg).sizes.length)) return;
  painelPickIndex = index;
  renderPainelPickSheet();
  openTobaModal("pinsModal");
}

function setPainelSlot(value) {
  const i = painelPickIndex;
  const cfg = getPortalViewConfig();
  if (i < 0 || (value && !portalSlotOk(value))) return;
  const ctx = portalPainelCtx();
  const old = cfg.slots[i];
  const at = value ? cfg.slots.indexOf(value) : -1;
  if (at === i) {
    closeTobaModal("pinsModal");
    return;
  }
  if (at >= 0) cfg.slots[at] = old; // já tava em outro: troca os dois de lugar
  cfg.slots[i] = value;
  if (!savePortalViewConfig(cfg)) return;
  painelPickIndex = -1;
  closeTobaModal("pinsModal");
  renderPortalViewPicker();
  renderPortalViews();
  if (!value) tobaToast(`🗑️ Quadradinho ${i + 1} vazio`);
  else if (at >= 0) tobaToast(`🔄 ${portalSlotName(value, ctx)} trocou de lugar`);
  else tobaToast(`✅ ${portalSlotName(value, ctx)} no quadradinho ${i + 1}`);
}

function setPainelLayout(id) {
  const cfg = getPortalViewConfig();
  const layout = PORTAL_LAYOUTS.find((l) => l.id === id);
  if (!layout || cfg.layout === id) return;
  cfg.layout = id;
  if (!savePortalViewConfig(cfg)) return;
  renderPortalViewPicker();
  renderPortalViews();
  tobaToast(`${layout.icon} Molde ${layout.label}`);
}

function setPainelEditing(on) {
  painelEditing = !!on;
  renderPortalViews();
}

// Relógio do quadradinho 🕐: acerta o número sem redesenhar a página
setInterval(() => {
  const ex = PORTAL_EXTRAS.find((e) => e.key === "hora").read();
  document.querySelectorAll("#portalViews .pv-clock").forEach((el) => {
    el.textContent = el.dataset.clock === "sub" ? ex.sub : ex.value;
  });
}, 15000);

// Segurar um quadradinho (~0,5 s) entra no modo de montar, igual no relógio
let painelPress = null;
let painelSkipClick = false;
document.addEventListener("pointerdown", (event) => {
  painelSkipClick = false; // toque novo = gesto novo
  const tile = event.target instanceof Element ? event.target.closest("#portalViews .pv-slot") : null;
  if (!tile || painelEditing) return;
  clearTimeout(painelPress?.timer);
  painelPress = {
    x: event.clientX,
    y: event.clientY,
    timer: setTimeout(() => {
      painelPress = null;
      painelSkipClick = true;
      try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { /* sem vibrar, tudo bem */ }
      setPainelEditing(true);
    }, 550),
  };
});
document.addEventListener("pointermove", (event) => {
  if (painelPress && Math.hypot(event.clientX - painelPress.x, event.clientY - painelPress.y) > 10) {
    clearTimeout(painelPress.timer);
    painelPress = null;
  }
});
["pointerup", "pointercancel"].forEach((type) => document.addEventListener(type, () => {
  if (painelPress) clearTimeout(painelPress.timer);
  painelPress = null;
}));
// O toque que segurou não pode abrir o app nem a folha logo em seguida
document.addEventListener("click", (event) => {
  if (!painelSkipClick) return;
  painelSkipClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);
document.addEventListener("contextmenu", (event) => {
  if (event.target instanceof Element && event.target.closest("#portalViews .pv-slot")) event.preventDefault();
});

function renderPortalViews() {
  const box = document.getElementById("portalViews");
  const grid = document.getElementById("modulesGrid");
  if (!box || !grid || !portalCards.length) return;
  const cfg = getPortalViewConfig();
  const isCards = cfg.view === "cards";
  grid.hidden = !isCards;
  box.hidden = isCards;
  box.dataset.view = cfg.view;
  if (cfg.view !== "painel") painelEditing = false;
  if (isCards) {
    box.innerHTML = "";
    return;
  }
  const apps = portalCards.filter((c) => c.visible).map(portalAppInfo);
  if (cfg.view === "painel") {
    box.innerHTML = renderPortalPainel(apps, cfg);
    return;
  }
  const stats = portalReadAllStats();
  const pending = portalPendingInfo();
  if (cfg.view === "linha") box.innerHTML = renderPortalLine(apps, stats, pending);
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
  if (pinsBtn) {
    const layout = portalLayout(cfg);
    const filled = cfg.slots.slice(0, layout.sizes.length).filter(Boolean).length;
    pinsBtn.textContent = `${layout.icon} Molde ${layout.label} · ${filled} de ${layout.sizes.length} quadradinhos montados`;
  }
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

tobaActions({
  setPortalView: (el) => setPortalView(el.dataset.view),
  pickPainelSlot: (el) => openPainelPick(Number(el.dataset.slot)),
  setPainelSlot: (el) => setPainelSlot(el.dataset.value || ""),
  setPainelLayout: (el) => setPainelLayout(el.dataset.layout),
  painelEdit: () => setPainelEditing(true),
  painelEditDone: () => {
    setPainelEditing(false);
    tobaToast("✔ Painel montado 😎");
  },
  // ⚙️ › Painel › ⭐ Montar o Meu painel: vai pra visão do painel já montando
  openPinsConfig: () => {
    const cfg = getPortalViewConfig();
    if (cfg.view !== "painel") {
      cfg.view = "painel";
      if (!savePortalViewConfig(cfg)) return;
    }
    closeTobaModal("settingsModal");
    painelEditing = true;
    renderPortalViewPicker();
    renderPortalViews();
    const box = document.getElementById("portalViews");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
  },
});

// Mexeu no Configurador de cards ou na Ordem dos apps: redesenha a visão
// quando a folha fecha (toba:close não borbulha, então escuta na captura).
document.addEventListener("toba:close", () => {
  renderPortalViewPicker();
  renderPortalViews();
}, true);

document.addEventListener("DOMContentLoaded", renderPortalViewPicker);
