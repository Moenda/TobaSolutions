/* =====================================================================
 * Portal · ⭐ Meus widgets (v2.17, PIMP MY HOME)
 * ---------------------------------------------------------------------
 * A visão ⭐ do portal virou tela de widgets estilo celular:
 *   - cada widget é de um app e tem a COR dele (mesma luz/saturação pra
 *     todo mundo combinar, só o tom muda: WG_APPS[].hue);
 *   - ＋ Widget -> escolhe o APP -> galeria com os widgets prontos daquele
 *     app (dado real, tamanhos P/M/G) -> "＋ Botar na home";
 *   - cada widget tem "Ao tocar, abre..." (WG_OPENS): Gastos, Raio-X,
 *     Treinos... Os ícones do dock continuam indo pro menu do app;
 *   - dá pra marcar task e item da lista de compras ali mesmo;
 *   - segurar um widget (ou ✏️ Montar) = modo montar: ⠿ arrasta pra mudar
 *     de lugar, ✕ tira, tocar abre a config (tamanho, abre o quê, o que
 *     mostrar, cor do app ou escuro com borda).
 *
 * Preferência: toba_portal_view.widgets = [{ id, kind, size, open, look, opts }]
 *   kind = chave de WG_KINDS (nunca renomear uma publicada)
 *   size = "P" (meia linha) | "M" (linha inteira) | "G" (linha inteira, alto)
 *   open = chave de WG_OPENS (ou "nada")
 *   look = "cor" | "escuro"
 *   opts = escolhas do widget (ex.: { bar: false }, { app, key } no 🔢 Número)
 * Quem vem da v2.14 (quadradinhos) ganha os widgets equivalentes na 1ª vez
 * (wgFromSlots); os slots continuam gravados.
 *
 * App novo / app que mudou de lugar: WG_APPS (data-id do card no index.html)
 * + WG_OPENS (páginas) + WG_KINDS (widgets). Só o kt_compras grava num banco
 * (o marcado da lista, igual a Compras) e o rt_tasks usa o
 * toggleRoutineFromCard do portal.js (igual ao card do Routine).
 * ===================================================================== */

const WG_MAX = 24;

/* Apps: hue = tom da cor (combina tudo: mesma luz e saturação) */
const WG_APPS = {
  bank: { card: "toba-bank", name: "Bank", icon: "🏦", hue: 152 },
  routine: { card: "toba-routine", name: "Routine", icon: "⚡", hue: 40 },
  health: { card: "toba-health", name: "Health", icon: "🫀", hue: 96 },
  fit: { card: "toba-fit", name: "Fit", icon: "🏋️", hue: 280 },
  kitchen: { card: "toba-kitchen", name: "Kitchen", icon: "🍳", hue: 18 },
  racing: { card: "toba-racing", name: "Racing", icon: "🏁", hue: 344 },
  tourism: { card: "toba-turism", name: "Tourism", icon: "🌎", hue: 212 },
  extras: { card: "", name: "Extras", icon: "✨", hue: 250, soft: true },
};
const WG_APP_ORDER = ["bank", "routine", "health", "fit", "kitchen", "racing", "tourism", "extras"];

/* Destinos do "Ao tocar, abre..." */
const WG_OPENS = {
  gastos: { app: "bank", label: "💸 Gastos", href: "./TobaBank/TobaBank-Gastos.html" },
  addgasto: { app: "bank", label: "➕ Lançar gasto", href: "./TobaBank/TobaBank-Gastos.html?action=add_expense" },
  aprovar: { app: "bank", label: "🤖 Compras pra aprovar", href: "./TobaBank/TobaBank-Gastos.html?pending=1" },
  invest: { app: "bank", label: "📈 Investimentos", href: "./TobaBank/TobaBank-Investimento.html" },
  rax: { app: "bank", label: "🧾 Raxador", href: "./TobaBank/TobaBank-Raxador.html" },
  bankmenu: { app: "bank", label: "🏦 Menu do Bank", href: "./TobaBank/TobaBank-Index.html" },
  tasks: { app: "routine", label: "🛠️ Tasks", href: "./TobaRoutine/TobaRoutine-Task.html" },
  rotina: { app: "routine", label: "🔁 Rotina", href: "./TobaRoutine/TobaRoutine-Rotina.html" },
  agenda: { app: "routine", label: "📅 Agenda", href: "./TobaRoutine/TobaRoutine-Agenda.html" },
  screen: { app: "routine", label: "📱 Toba Screen", href: "./TobaRoutine/TobaRoutine-Screen.html" },
  routinemenu: { app: "routine", label: "⚡ Menu do Routine", href: "./TobaRoutine/TobaRoutine-Index.html" },
  raiox: { app: "health", label: "🩻 Raio-X", href: "./TobaHealth/TobaHealth-Relogio.html" },
  pesagem: { app: "health", label: "⚖️ Pesagem", href: "./TobaHealth/TobaHealth-Pesagem.html" },
  healthmenu: { app: "health", label: "🫀 Menu do Health", href: "./TobaHealth/TobaHealth-Index.html" },
  treinos: { app: "fit", label: "🏋️ Treinos", href: "./TobaFit/TobaFit-Treinos.html" },
  fitmenu: { app: "fit", label: "🏋️ Menu do Fit", href: "./TobaFit/TobaFit-Index.html" },
  compras: { app: "kitchen", label: "🛒 Lista de compras", href: "./TobaKitchen/TobaKitchen-Compras.html" },
  semana: { app: "kitchen", label: "📆 Semana", href: "./TobaKitchen/TobaKitchen-Semana.html" },
  receitas: { app: "kitchen", label: "📖 Receitas", href: "./TobaKitchen/TobaKitchen-Receitas.html" },
  kitchenmenu: { app: "kitchen", label: "🍳 Menu do Kitchen", href: "./TobaKitchen/TobaKitchen-Index.html" },
  drive: { app: "racing", label: "🧭 Toba Drive", href: "./TobaRacing/TobaDrive/TobaDrive.html" },
  combustivel: { app: "racing", label: "⛽ Combustível", href: "./TobaRacing/TobaRacing-Combustivel.html" },
  racingmenu: { app: "racing", label: "🏁 Menu do Racing", href: "./TobaRacing/TobaRacing-Index.html" },
  places: { app: "tourism", label: "📍 Places", href: "./TobaTurism/TobaTurism-Places.html" },
  tourmenu: { app: "tourism", label: "🌎 Menu do Tourism", href: "./TobaTurism/TobaTurism-Index.html" },
  perfil: { app: "extras", label: "🎮 Perfil", href: "./Toba-Perfil.html" },
  amigos: { app: "extras", label: "🤝 Toba dos amigos", href: "./Toba-Amigos.html" },
  nada: { app: "", label: "🙈 Nada, só olhar", href: "" },
};

/* Widgets: sizes na ordem P/M/G, def = tamanho da galeria, open = destino padrão,
 * opts = chavinhas do "Mostrar" ({ k, l, d }) */
const WG_KINDS = {
  bank_livre: { app: "bank", title: "Livre hoje", desc: "Quanto dá pra gastar hoje + a barra do mês com o risquinho do ritmo", sizes: ["P", "M"], def: "M", open: "gastos",
    opts: [{ k: "bar", l: "Barra do mês", d: true }, { k: "sobra", l: "Sobra prevista", d: true }] },
  bank_gastos: { app: "bank", title: "Gasto do mês", desc: "Tudo que saiu no mês e quanto foi hoje", sizes: ["P", "M"], def: "P", open: "gastos" },
  bank_cofre: { app: "bank", title: "Cofre", desc: "O que tá guardado no cofre do mês", sizes: ["P"], def: "P", open: "gastos" },
  bank_aprovar: { app: "bank", title: "Pra aprovar", desc: "Compras do cartão esperando (app Android)", sizes: ["P", "M"], def: "P", open: "aprovar" },
  bank_add: { app: "bank", title: "Gasto rápido", desc: "Um toque e já abre o lançar gasto", sizes: ["P"], def: "P", open: "addgasto" },
  rt_tasks: { app: "routine", title: "Tarefas de hoje", desc: "Lista enxuta: toca no círculo e marca ali mesmo", sizes: ["M", "G"], def: "M", open: "rotina",
    opts: [{ k: "hide", l: "Esconder as feitas", d: false }] },
  rt_hoje: { app: "routine", title: "Hoje", desc: "Anel das tarefas feitas hoje", sizes: ["P"], def: "P", open: "rotina" },
  rt_seq: { app: "routine", title: "Sequência", desc: "A maior sequência que tá rolando", sizes: ["P"], def: "P", open: "rotina" },
  rt_resumo: { app: "routine", title: "Rotina da semana", desc: "Feitas na semana, atrasadas e XP do mês", sizes: ["M"], def: "M", open: "routinemenu" },
  rt_screen: { app: "routine", title: "Tempo de tela", desc: "Celular hoje x ontem (e os apps campeões no médio)", sizes: ["P", "M"], def: "P", open: "raiox", more: ["raiox"],
    opts: [{ k: "top", l: "Top apps (no médio)", d: true }] },
  ft_kcal: { app: "fit", title: "Calorias", desc: "Ativas de hoje no anel + dias de treino da semana", sizes: ["P", "M"], def: "P", open: "treinos", more: ["raiox"] },
  ft_semana: { app: "fit", title: "Treinos", desc: "Treinos da semana e do mês", sizes: ["P", "M"], def: "P", open: "treinos", more: ["raiox"] },
  hl_passos: { app: "health", title: "Passos", desc: "Anel dos passos do relógio", sizes: ["P"], def: "P", open: "raiox" },
  hl_sono: { app: "health", title: "Sono", desc: "Quanto dormiu essa noite", sizes: ["P"], def: "P", open: "raiox" },
  hl_peso: { app: "health", title: "Peso", desc: "Última pesagem + como foi no mês + tendência", sizes: ["P", "M"], def: "M", open: "pesagem" },
  kt_compras: { app: "kitchen", title: "Lista de compras", desc: "Marca o que pegou no mercado ali mesmo", sizes: ["M", "G"], def: "M", open: "compras",
    opts: [{ k: "hide", l: "Esconder os pegos", d: true }] },
  kt_hoje: { app: "kitchen", title: "Cozinha hoje", desc: "O que tá programado pra hoje", sizes: ["P", "M"], def: "M", open: "semana" },
  rc_km: { app: "racing", title: "Km no mês", desc: "Quanto rodou no Toba Drive no mês", sizes: ["P"], def: "P", open: "drive" },
  rc_kml: { app: "racing", title: "Consumo", desc: "km/l do último tanque e a média", sizes: ["P"], def: "P", open: "combustivel" },
  rc_ult: { app: "racing", title: "Última viagem", desc: "Pra onde foi, tempo, km e se chegou antes do previsto", sizes: ["M"], def: "M", open: "drive" },
  tr_prox: { app: "tourism", title: "Próximo rolê", desc: "Um lugar da tua lista (muda todo dia)", sizes: ["M"], def: "M", open: "places" },
  tr_conta: { app: "tourism", title: "Lugares", desc: "Pra ir x já visitados", sizes: ["P"], def: "P", open: "places" },
  x_relogio: { app: "extras", title: "Relógio", desc: "Hora grandona e a data", sizes: ["P", "M"], def: "P", open: "nada" },
  x_atalho: { app: "extras", title: "Atalho de app", desc: "Ícone grandão que abre o app que tu escolher", sizes: ["P"], def: "P", open: "app" },
  x_num: { app: "extras", title: "🔢 Número", desc: "Qualquer número de qualquer app (os do painel antigo)", sizes: ["P"], def: "P", open: "app" },
};

const wgUid = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const WG_SIZE_NAMES = { P: "Pequeno", M: "Médio", G: "Grandão" };

let wgSheet = { step: "", app: "", id: "" };
const wgGalSize = {};
let wgLastRemoved = null;

/* ---------------------------------------------------------------------
 * Configuração (dentro do toba_portal_view)
 * ------------------------------------------------------------------- */
// O app do 🔢 Número / ⚡ Atalho é o escolhido em opts.app (data-id do card)
function wgAppKeyOfCard(cardId) {
  return Object.keys(WG_APPS).find((k) => WG_APPS[k].card === cardId) || "";
}

function wgWidgetApp(w) {
  const kind = WG_KINDS[w.kind];
  if ((w.kind === "x_atalho" || w.kind === "x_num") && w.opts && w.opts.app) return wgAppKeyOfCard(w.opts.app) || "extras";
  return kind ? kind.app : "extras";
}

// Destinos possíveis de um widget (o padrão do app + "nada")
function wgOpensFor(w) {
  const app = wgWidgetApp(w);
  const list = Object.keys(WG_OPENS).filter((k) => WG_OPENS[k].app === app);
  if (app === "extras") list.push(...Object.keys(WG_OPENS).filter((k) => WG_OPENS[k].app === "extras" && !list.includes(k)));
  ((WG_KINDS[w.kind] || {}).more || []).forEach((k) => { if (WG_OPENS[k] && !list.includes(k)) list.push(k); });
  if (w.kind === "x_atalho" || w.kind === "x_num") list.unshift("app");
  list.push("nada");
  return [...new Set(list)];
}

function wgNormalize(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  return list
    .filter((w) => w && typeof w === "object" && WG_KINDS[w.kind])
    .slice(0, WG_MAX)
    .map((w) => {
      const kind = WG_KINDS[w.kind];
      let id = typeof w.id === "string" && /^[a-z0-9]{2,24}$/i.test(w.id) ? w.id : wgUid();
      if (seen.has(id)) id = wgUid();
      seen.add(id);
      const opts = w.opts && typeof w.opts === "object" && !Array.isArray(w.opts) ? { ...w.opts } : {};
      const out = { id, kind: w.kind, size: kind.sizes.includes(w.size) ? w.size : kind.def, look: w.look === "escuro" ? "escuro" : "cor", opts };
      const opens = wgOpensFor(out);
      out.open = opens.includes(w.open) ? w.open : (opens.includes(kind.open) ? kind.open : opens[0]);
      return out;
    });
}

// v2.14 -> v2.17: cada quadradinho vira o widget mais parecido
function wgFromSlots(slots, visible) {
  const map = {
    "toba-bank:livre": ["bank_livre", "M"], "toba-bank:cofre": ["bank_cofre", "P"], "toba-bank:gastos": ["bank_gastos", "P"],
    "toba-routine:hoje": ["rt_tasks", "M"], "toba-health:semana": ["ft_semana", "P"], "toba-routine:streak": ["rt_seq", "P"],
    "toba-health:peso": ["hl_peso", "P"], "x:hora": ["x_relogio", "P"], "x:aprovar": ["bank_aprovar", "P"],
    "toba-racing:drive": ["rc_km", "P"], "toba-racing:kml": ["rc_kml", "P"],
  };
  const out = [];
  (Array.isArray(slots) ? slots : []).slice(0, visible).forEach((slot) => {
    if (!slot) return;
    if (map[slot]) {
      out.push({ kind: map[slot][0], size: map[slot][1] });
    } else if (slot.startsWith("app:")) {
      out.push({ kind: "x_atalho", size: "P", opts: { app: slot.slice(4) }, open: "app" });
    } else if (/^[a-z-]+:[A-Za-z]+$/.test(slot)) {
      const cut = slot.indexOf(":");
      let app = slot.slice(0, cut);
      const key = slot.slice(cut + 1);
      // v2.17: número de treino do Health agora mora no 🏋️ Toba Fit
      if (app === "toba-health" && PORTAL_FIT_KEYS.includes(key)) app = "toba-fit";
      out.push({ kind: "x_num", size: "P", opts: { app, key }, open: "app" });
    }
  });
  return out;
}

const WG_DEFAULT = [
  { kind: "bank_livre", size: "M" },
  { kind: "rt_tasks", size: "M" },
  { kind: "ft_kcal", size: "P" },
  { kind: "rt_screen", size: "P" },
  { kind: "hl_peso", size: "M" },
  { kind: "rc_km", size: "P" },
  { kind: "x_relogio", size: "P", look: "escuro" },
];

// Chamado pelo getPortalViewConfig (portal-views.js)
function wgConfigWidgets(cfg) {
  const saved = wgNormalize(cfg.widgets);
  if (saved) return saved;
  const layout = PORTAL_LAYOUTS.find((l) => l.id === cfg.layout) || PORTAL_LAYOUTS[0];
  const migrated = wgFromSlots(cfg.slots, layout.sizes.length);
  // id fixo (m0, m1...) enquanto não grava: cada leitura devolve os mesmos widgets
  return wgNormalize((migrated.length ? migrated : WG_DEFAULT).map((w, i) => ({ ...w, id: `m${i}` })));
}

function wgSave(mutator) {
  const cfg = getPortalViewConfig();
  mutator(cfg.widgets, cfg);
  cfg.widgets = wgNormalize(cfg.widgets);
  return savePortalViewConfig(cfg) ? cfg : null;
}

/* ---------------------------------------------------------------------
 * Dados (só leitura, uma vez por desenho)
 * ------------------------------------------------------------------- */
function wgReadDb(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch (e) {
    console.error(`Erro ao ler ${key}`, e);
    return null;
  }
}

function wgCtx() {
  const today = toIsoDate();
  const ctx = { today, now: new Date(), byId: {}, stats: null, pending: portalPendingInfo() };
  portalCards.forEach((c) => { ctx.byId[c.id] = portalAppInfo(c); });
  const safe = (fn) => { try { return fn(); } catch (e) { console.error("Widget sem dado", e); return null; } };
  ctx.bankDb = wgReadDb("TOBA_BANK_DB");
  ctx.bank = ctx.bankDb ? safe(() => calcBankMonthSummary(ctx.bankDb)) : null;
  ctx.bankPrivacy = safe(() => getBankCardConfig().privacy) || false;
  ctx.health = wgReadDb("TOBA_HEALTH_DB");
  ctx.hs = safe(() => calcHealthSummary(ctx.health));
  ctx.healthPrivacy = safe(() => getHealthCardConfig().privacy) || false;
  ctx.routineDb = safe(() => readRoutineDbRaw());
  ctx.routine = ctx.routineDb ? safe(() => calcRoutineSummary(ctx.routineDb)) : null;
  ctx.kitchenDb = wgReadDb("TOBA_KITCHEN_DB");
  ctx.racing = typeof calcRacingSummary === "function" ? safe(() => calcRacingSummary(wgReadDb("TOBA_RACING_DB"))) : null;
  ctx.drive = typeof calcDriveSummary === "function" ? safe(() => calcDriveSummary(wgReadDb("TOBA_DRIVE_DB"))) : null;
  ctx.turismDb = wgReadDb("TOBA_TURISM_DB");
  ctx.statsLazy = () => (ctx.stats || (ctx.stats = portalReadAllStats()));
  return ctx;
}

const wgEsc = (v) => escapeHtml(String(v === null || v === undefined ? "" : v));
const wgMoney = (v, privacy) => (privacy ? "R$ ***" : formatCurrency(v));
function wgMin(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  return h ? `${h}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}
const wgPct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/* Pecinhas de desenho */
const wgBig = (v, tone = "", extra = "") => `<span class="wg-big${tone ? ` is-${tone}` : ""}${extra}">${wgEsc(v)}</span>`;
const wgSub = (t, cls = "") => (t ? `<span class="wg-sub${cls}">${wgEsc(t)}</span>` : "");
function wgBar(pct, mark) {
  const m = mark === null || mark === undefined ? "" : `<i class="wg-bar-mark" style="left:${wgPct(mark)}%"></i>`;
  return `<span class="wg-bar"><b style="width:${wgPct(pct)}%"></b>${m}</span>`;
}
function wgRing(pct, center) {
  const c = 163.36;
  const dash = ((wgPct(pct) / 100) * c).toFixed(1);
  return `<span class="wg-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="wg-ring-bg"></circle><circle cx="32" cy="32" r="26" class="wg-ring-fg" stroke-dasharray="${dash} ${c}"></circle></svg><span class="wg-ring-in">${wgEsc(center)}</span></span>`;
}
const wgEmpty = (t) => `<span class="wg-empty">${wgEsc(t)}</span>`;

/* ---------------------------------------------------------------------
 * O corpo de cada widget
 * ------------------------------------------------------------------- */
const WG_BODY = {
  bank_livre(w, ctx, o) {
    const b = ctx.bank;
    if (!b) return wgEmpty("Abre o Bank e monta o mês 🏦");
    const p = ctx.bankPrivacy;
    const gross = b.grossMonthlyBudget;
    let html = wgBig(wgMoney(b.todayAvailable, p), p ? "" : b.todayAvailable < 0 ? "red" : "") + wgSub("livre hoje");
    if (o.bar && gross > 0) {
      html += wgBar((b.totalMonthlySpent / gross) * 100, (b.ritmoHoje / gross) * 100);
      if (w.size !== "P") html += `<span class="wg-row wg-sub"><span>${wgEsc(p ? "R$ ***" : `${formatCurrency(b.totalMonthlySpent)} de ${formatCurrency(gross)}`)}</span><span>dia ${ctx.now.getDate()}/${b.totalDaysInMonth}</span></span>`;
    }
    if (o.sobra && w.size !== "P") html += `<span class="wg-accent">🎯 Sobra prevista: ${wgEsc(wgMoney(b.sobraPrevista, p))}</span>`;
    return html;
  },
  bank_gastos(w, ctx) {
    const b = ctx.bank;
    if (!b) return wgEmpty("Sem gastos ainda");
    const p = ctx.bankPrivacy;
    return `<span class="wg-push"></span>${wgBig(wgMoney(b.totalMonthlySpent, p))}${wgSub(`no mês · hoje ${wgMoney(b.todaySpent, p)}`)}${w.size === "M" ? `<span class="wg-sub">média ${wgEsc(wgMoney(b.mediaDiariaTotal, p))} por dia</span>` : ""}`;
  },
  bank_cofre(w, ctx) {
    const b = ctx.bank;
    if (!b) return wgEmpty("Sem cofre ainda");
    const p = ctx.bankPrivacy;
    return `<span class="wg-push"></span>${wgBig(wgMoney(b.vaultBalance, p), p ? "" : b.vaultBalance < 0 ? "red" : "")}${wgSub("💎 no cofre do mês")}`;
  },
  bank_aprovar(w, ctx) {
    if (!(TOBA_NATIVE && typeof TOBA_NATIVE.getPendingPurchases === "function")) return `<span class="wg-push"></span>${wgBig("--")}${wgSub("só no app Android")}`;
    const { count, total } = ctx.pending;
    if (!count) return `<span class="wg-push"></span>${wgBig("0")}${wgSub("nada esperando 😎")}`;
    return `<span class="wg-push"></span>${wgBig(String(count), "", " is-alert")}${wgSub(`${count === 1 ? "compra" : "compras"} · ${formatCurrency(total)}`)}${w.size === "M" ? '<span class="wg-accent">toca pra lançar ou descartar</span>' : ""}`;
  },
  bank_add() {
    return '<span class="wg-push"></span><span class="wg-emoji">➕</span><span class="wg-big is-sm">Gasto rápido</span>';
  },

  rt_tasks(w, ctx, o) {
    if (!ctx.routineDb) return wgEmpty("Cria tuas tarefas no Routine ⚡");
    const all = calcRoutineTodayList(ctx.routineDb, ctx.today);
    if (!all.length) return wgEmpty("🏖️ Nada agendado hoje");
    const done = all.filter((t) => t.done).length;
    const list = o.hide ? all.filter((t) => !t.done) : [...all.filter((t) => !t.done), ...all.filter((t) => t.done)];
    const max = w.size === "G" ? 7 : 3;
    const shown = list.slice(0, max);
    const rows = shown.map((t) => `<button type="button" class="wg-check${t.done ? " is-done" : ""}" data-click="toggleRoutineFromCard" data-id="${wgEsc(t.id)}" aria-pressed="${t.done}" aria-label="${t.done ? "Desmarcar" : "Marcar como feita"}: ${wgEsc(t.name)}"><span class="wg-check-box" aria-hidden="true">${t.done ? "✓" : ""}</span><span class="wg-check-name">${wgEsc(t.emoji)} ${wgEsc(t.name)}</span>${t.time ? `<span class="wg-check-time">${wgEsc(t.time)}</span>` : ""}</button>`).join("");
    const rest = list.length - shown.length;
    w.badge = `${done}/${all.length}${done === all.length ? " 🔥" : ""}`;
    return `<span class="wg-list">${rows || '<span class="wg-sub">Tudo feito, monstro 🔥</span>'}</span>${rest > 0 && w.size === "G" ? `<span class="wg-sub wg-foot">+${rest} na Rotina</span>` : ""}`;
  },
  rt_hoje(w, ctx) {
    const r = ctx.routine;
    if (!r || !r.today.total) return `<span class="wg-push"></span>${wgBig("🏖️")}${wgSub("nada agendado hoje")}`;
    const t = r.today;
    return `<span class="wg-ringrow">${wgRing((t.done / t.total) * 100, `${t.done}/${t.total}`)}<span class="wg-col">${wgSub(t.done === t.total ? "tudo feito 🔥" : `faltam ${t.total - t.done}`)}${t.overdue ? `<span class="wg-sub is-hot">⏰ ${t.overdue} atrasada${t.overdue === 1 ? "" : "s"}</span>` : ""}</span></span>`;
  },
  rt_seq(w, ctx) {
    const r = ctx.routine;
    const s = r && r.streak;
    if (!s || !s.len) return `<span class="wg-push"></span>${wgBig("🔥 0")}${wgSub("bora começar uma")}`;
    return `<span class="wg-push"></span>${wgBig(`🔥 ${s.len}`)}${wgSub(`${s.emoji || ""} ${s.name || "seguidas"}`.trim())}`;
  },
  rt_resumo(w, ctx) {
    const r = ctx.routine;
    if (!r) return wgEmpty("Cria tuas tarefas no Routine ⚡");
    return `<span class="wg-tiles"><span><b>${wgEsc(r.weekDone)}</b><i>na semana</i></span><span><b class="${r.today.overdue ? "is-red" : ""}">${wgEsc(r.today.overdue)}</b><i>atrasadas</i></span><span><b>${wgEsc(r.monthXp)}</b><i>XP no mês</i></span><span><b>${wgEsc(r.tomorrow)}</b><i>amanhã</i></span></span>`;
  },

  rt_screen(w, ctx, o) {
    const days = ctx.health && ctx.health.screen && ctx.health.screen.days;
    const d = days && days[ctx.today];
    const min = screenDayMinutes(d);
    if (min === null) return `<span class="wg-push"></span>${wgBig("--")}${wgSub("sem leitura hoje (app Android)")}`;
    const y = screenDayMinutes(days[watchMetricAddDays(ctx.today, -1)]);
    const diff = y === null ? "" : `${min <= y ? "▼" : "▲"} ${wgMin(Math.abs(min - y))} vs ontem`;
    const left = `<span class="wg-col wg-end">${wgBig(wgMin(min))}${wgSub("📱 tela hoje")}${diff ? `<span class="wg-sub ${min <= y ? "is-good" : "is-hot"}">${wgEsc(diff)}</span>` : ""}</span>`;
    if (w.size === "P" || !o.top || !d.a) return left;
    const apps = (ctx.health.screen.apps) || {};
    const top = Object.entries(d.a).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = top.length ? top[0][1] : 1;
    const rows = top.map(([pkg, s]) => `<span class="wg-mini"><span class="wg-row"><span>${wgEsc((apps[pkg] && apps[pkg].n) || pkg.split(".").pop())}</span><span>${wgEsc(wgMin(s / 60))}</span></span>${wgBar((s / max) * 100)}</span>`).join("");
    return `<span class="wg-split">${left}<span class="wg-col wg-grow">${rows}</span></span>`;
  },
  ft_semana(w, ctx) {
    const h = ctx.hs;
    if (!h) return wgEmpty("Sem treino ainda 🏋️");
    const big = `${h.weekCount} ${h.weekCount === 1 ? "treino" : "treinos"}`;
    let html = `<span class="wg-push"></span>${wgBig(big)}${wgSub(`na semana · ${h.monthCount} no mês`)}`;
    if (w.size === "M") html += `<span class="wg-tiles is-3"><span><b>${wgEsc(formatPortalNumber(h.monthKm, 1))}</b><i>km no mês</i></span><span><b>${wgEsc(wgMin(h.monthMinutes))}</b><i>treinado</i></span><span><b>${wgEsc(formatPortalNumber(h.monthSaitamaReps, 0))}</b><i>reps Saitama</i></span></span>`;
    return html;
  },
  ft_kcal(w, ctx) {
    const days = ctx.health && ctx.health.watch && ctx.health.watch.days;
    const d = days && days[ctx.today];
    const kcal = d ? Number(d.activeKcal) || 0 : 0;
    const goal = days ? calcWatchKcalGoal(days, ctx.today).goal : WATCH_KCAL_GOAL_DEFAULT;
    let html = `<span class="wg-ringrow">${wgRing((kcal / goal) * 100, `${wgPct((kcal / goal) * 100)}%`)}<span class="wg-col">${wgBig(formatPortalNumber(kcal, 0), "", " is-sm")}${wgSub(`kcal · meta ${formatPortalNumber(goal, 0)}`)}</span>`;
    if (w.size === "M") {
      const monday = watchMetricAddDays(ctx.today, -((ctx.now.getDay() + 6) % 7));
      const workouts = ctx.health && Array.isArray(ctx.health.workouts) ? ctx.health.workouts : [];
      let n = 0;
      const dots = ["S", "T", "Q", "Q", "S", "S", "D"].map((l, i) => {
        const iso = watchMetricAddDays(monday, i);
        const ex = days && days[iso] && Array.isArray(days[iso].ex) ? days[iso].ex : [];
        const on = workouts.some((x) => x && x.date === iso) || ex.some((x) => x && Number(x.end) - Number(x.start) >= 15 * 60000);
        if (on) n += 1;
        return `<i class="${on ? "is-on" : ""}${iso === ctx.today ? " is-today" : ""}">${l}</i>`;
      }).join("");
      html += `<span class="wg-col wg-end wg-right"><span class="wg-week">${dots}</span>${wgSub(`${n} ${n === 1 ? "dia" : "dias"} de treino`)}</span>`;
    }
    return `${html}</span>`;
  },
  hl_passos(w, ctx) {
    const watch = ctx.health && ctx.health.watch;
    const d = watch && watch.days && watch.days[ctx.today];
    const steps = d ? Number(d.steps) || 0 : 0;
    const goal = (watch && watch.goals && Number(watch.goals.steps)) || WATCH_NOTA_DEFAULT_GOALS.steps;
    return `<span class="wg-ringrow">${wgRing((steps / goal) * 100, "👟")}<span class="wg-col">${wgBig(formatPortalNumber(steps, 0), "", " is-sm")}${wgSub(`meta ${formatPortalNumber(goal, 0)}`)}</span></span>`;
  },
  hl_sono(w, ctx) {
    const d = ctx.health && ctx.health.watch && ctx.health.watch.days && ctx.health.watch.days[ctx.today];
    const s = d && d.sleep;
    if (!s || !(Number(s.min) > 0)) return `<span class="wg-push"></span>${wgBig("--")}${wgSub("sem sono hoje")}`;
    const total = Number(s.min) + (Number(s.napMin) || 0);
    return `<span class="wg-push"></span>${wgBig(`😴 ${wgMin(total)}`)}${wgSub(s.score ? `nota ${s.score} do Samsung` : "dormiu essa noite")}`;
  },
  hl_peso(w, ctx) {
    const h = ctx.hs;
    if (!h || h.weight === null) return wgEmpty("Sem pesagem ainda ⚖️");
    const p = ctx.healthPrivacy;
    const md = h.weightMonthDiff;
    const diff = md === null || p ? "" : Math.abs(md) < 0.005 ? "= no mês" : `${md < 0 ? "▼" : "▲"} ${formatKg(Math.abs(md))} no mês`;
    const diffHtml = diff ? `<span class="wg-sub ${md < 0 ? "is-good" : md > 0 ? "is-hot" : ""}">${wgEsc(diff)}</span>` : "";
    if (w.size === "P") return `<span class="wg-push"></span>${wgBig(p ? "** kg" : formatKg(h.weight))}${diffHtml}${wgSub(formatDaysAgo(h.weightDaysAgo))}`;
    let html = `<span class="wg-row wg-base">${wgBig(p ? "** kg" : formatKg(h.weight))}${diffHtml}</span>${wgSub(formatDaysAgo(h.weightDaysAgo))}`;
    if (w.size === "M" && !p) {
      const ws = (Array.isArray(ctx.health.weighIns) ? ctx.health.weighIns : [])
        .filter((x) => x && Number(x.weight) > 0 && x.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(-12)
        .map((x) => Number(x.weight));
      if (ws.length > 1) {
        const mn = Math.min(...ws);
        const mx = Math.max(...ws);
        const span = mx - mn || 1;
        const pts = ws.map((v, i) => `${((i * 300) / (ws.length - 1)).toFixed(0)},${(4 + ((mx - v) / span) * 36).toFixed(1)}`).join(" ");
        html += `<svg class="wg-spark" viewBox="0 0 300 44" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"></polyline></svg>`;
      }
    }
    return html;
  },

  kt_compras(w, ctx, o) {
    if (typeof kitchenShoppingList !== "function") return wgEmpty("Kitchen não carregou");
    const db = ctx.kitchenDb || {};
    const monday = kitchenWeekMonday(ctx.today);
    const week = db.shopping && db.shopping[monday];
    const checked = new Set(week && Array.isArray(week.checked) ? week.checked : []);
    const items = kitchenShoppingList(db, monday).buy.flatMap((g) => g.items).map((i) => ({
      key: i.key, extra: !!i.extra, name: `${i.info.emoji || ""} ${i.info.name}`.trim(), done: i.extra ? i.checked : checked.has(i.key),
    }));
    if (!items.length) return wgEmpty("🛒 Lista vazia: toca pra escolher");
    const left = items.filter((i) => !i.done).length;
    const list = o.hide ? items.filter((i) => !i.done) : [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
    const max = w.size === "G" ? 7 : 3;
    const shown = list.slice(0, max);
    const rows = shown.map((i) => `<button type="button" class="wg-check is-square${i.done ? " is-done" : ""}" data-click="wgShopToggle" data-key="${wgEsc(i.key)}" data-extra="${i.extra ? 1 : 0}" aria-pressed="${i.done}" aria-label="${i.done ? "Desmarcar" : "Peguei"}: ${wgEsc(i.name)}"><span class="wg-check-box" aria-hidden="true">${i.done ? "✓" : ""}</span><span class="wg-check-name">${wgEsc(i.name)}</span></button>`).join("");
    const rest = list.length - shown.length;
    w.badge = left ? `${left} faltando` : "tudo pego 🎉";
    return `<span class="wg-list">${rows}</span>${rest > 0 && w.size === "G" ? `<span class="wg-sub wg-foot">+${rest} na lista</span>` : ""}`;
  },
  kt_hoje(w, ctx) {
    if (typeof calcKitchenSummary !== "function") return wgEmpty("Kitchen não carregou");
    const k = calcKitchenSummary(ctx.kitchenDb);
    if (!k.todayPlan.length) return `<span class="wg-push"></span>${wgBig("🍽️", "", " is-sm")}${wgSub("nada programado hoje")}`;
    if (w.size === "P") return `<span class="wg-push"></span>${wgBig(k.todayPlan.map((r) => r.emoji).join(" "))}${wgSub(`${k.todayPlan.length} ${k.todayPlan.length === 1 ? "receita" : "receitas"} hoje`)}`;
    return `<span class="wg-list">${k.todayPlan.slice(0, 3).map((r) => `<span class="wg-line">${wgEsc(r.emoji)} ${wgEsc(r.name)}</span>`).join("")}</span>`;
  },

  rc_km(w, ctx) {
    const d = ctx.drive;
    if (!d || !d.monthKm) return `<span class="wg-push"></span>${wgBig("0 km")}${wgSub("no mês · bora rodar")}<span class="wg-flag"></span>`;
    return `<span class="wg-push"></span>${wgBig(`${driveFormatKm(d.monthKm * 1000)} km`)}${wgSub(`🧭 no mês · ${d.monthTrips} ${d.monthTrips === 1 ? "viagem" : "viagens"}`)}<span class="wg-flag"></span>`;
  },
  rc_kml(w, ctx) {
    const s = ctx.racing;
    if (!s || !s.lastKml) return `<span class="wg-push"></span>${wgBig("--")}${wgSub("sem tanque ainda")}`;
    const badge = typeof racingTrendBadge === "function" ? racingTrendBadge(s.trend) : null;
    return `<span class="wg-push"></span>${wgBig(`${formatRacingKml(s.lastKml)} km/l${badge ? ` ${badge.icon}` : ""}`)}${wgSub(s.avgKml ? `⛽ média ${formatRacingKml(s.avgKml)}` : "último tanque")}`;
  },
  rc_ult(w, ctx) {
    const t = ctx.drive && ctx.drive.last;
    if (!t) return wgEmpty("Nenhuma viagem ainda 🧭");
    const min = Number(t.endedAt) && Number(t.startedAt) ? (Number(t.endedAt) - Number(t.startedAt)) / 60000 : 0;
    let tag = t.arrived ? "🏁 Chegou" : "";
    if (t.arrived && Number(t.etaS) > 0 && min > 0) {
      const gain = Math.round(Number(t.etaS) / 60 - min);
      if (gain > 0) tag = `🏁 ${gain} min antes do previsto`;
    }
    return `<span class="wg-push"></span>${wgBig(t.name || "Viagem", "", " is-sm")}${wgSub(`${min ? `${wgMin(min)} · ` : ""}${formatPortalNumber(Number(t.km) || 0, 1)} km · ${t.date ? t.date.split("-").reverse().slice(0, 2).join("/") : ""}`)}${tag ? `<span class="wg-accent">${wgEsc(tag)}</span>` : ""}`;
  },

  tr_prox(w, ctx) {
    if (typeof turismSafeDb !== "function") return wgEmpty("Tourism não carregou");
    const { lists, places } = turismSafeDb(ctx.turismDb);
    const listById = Object.fromEntries(lists.map((l) => [String(l.id), l]));
    const want = places.filter((p) => p.status !== "been" && listById[String(p.listId)]);
    if (!want.length) return wgEmpty("📌 Lista vazia: bora garimpar rolê");
    const dayNum = Math.floor(ctx.now.getTime() / 86400000);
    const p = want[dayNum % want.length];
    const l = listById[String(p.listId)];
    const where = [l && l.city, l && l.name].filter(Boolean)[0] || "";
    return `<span class="wg-push"></span>${wgBig(p.name, "", " is-sm")}${wgSub(`📍 ${where ? `${where} · ` : ""}${want.length} na lista`)}`;
  },
  tr_conta(w, ctx) {
    if (typeof calcTurismSummary !== "function") return wgEmpty("Tourism não carregou");
    const s = calcTurismSummary(ctx.turismDb);
    return `<span class="wg-push"></span>${wgBig(`${s.want}`)}${wgSub(`📌 pra ir · ✅ ${s.been} visitados`)}`;
  },

  x_relogio(w, ctx) {
    const ex = PORTAL_EXTRAS.find((e) => e.key === "hora").read();
    return `<span class="wg-push"></span><span class="wg-big is-clock pv-clock" data-clock="value">${wgEsc(ex.value)}</span><span class="wg-sub pv-clock" data-clock="sub">${wgEsc(ex.sub)}</span>`;
  },
  x_atalho(w, ctx, o) {
    const app = ctx.byId[o.app];
    if (!app) return wgEmpty("App escondido ou que não existe mais");
    return `<span class="wg-push"></span><span class="wg-emoji">${app.icon}</span><span class="wg-big is-sm">${wgEsc(app.short)}</span>`;
  },
  x_num(w, ctx, o) {
    const def = PORTAL_APP_STATS[o.app];
    const item = def && def.items.find((i) => i.key === o.key);
    if (!item) return wgEmpty("Toca em ✏️ e escolhe o número");
    const stats = ctx.statsLazy();
    const v = (stats[o.app] && stats[o.app][o.key]) || { value: "--" };
    return `<span class="wg-push"></span>${wgBig(v.value, v.tone === "red" ? "red" : "")}${wgSub(v.sub || item.short)}`;
  },
};

// Título do widget (o 🔢 Número usa o nome do número escolhido)
function wgTitle(w) {
  const kind = WG_KINDS[w.kind];
  if (w.kind === "x_num") {
    const def = PORTAL_APP_STATS[w.opts.app];
    const item = def && def.items.find((i) => i.key === w.opts.key);
    return item ? item.label.replace(/^\S+\s/, "") : kind.title;
  }
  if (w.kind === "x_atalho") return "Atalho";
  return kind.title;
}

function wgHref(w, ctx) {
  if (w.open === "app") {
    const app = ctx.byId[w.opts.app];
    return app && !app.soon ? app.href : "";
  }
  return (WG_OPENS[w.open] && WG_OPENS[w.open].href) || "";
}

function wgOpenLabel(w, ctx) {
  if (w.open === "app") {
    const app = ctx.byId[w.opts.app];
    return app ? `${app.icon} ${app.short}` : "";
  }
  return w.open === "nada" ? "" : (WG_OPENS[w.open] || {}).label || "";
}

/* mode: "home" | "edit" | "preview" */
function wgRender(w, ctx, mode = "home") {
  const kind = WG_KINDS[w.kind];
  const appKey = wgWidgetApp(w);
  const app = WG_APPS[appKey] || WG_APPS.extras;
  const opts = {};
  (kind.opts || []).forEach((o) => { opts[o.k] = w.opts[o.k] !== undefined ? !!w.opts[o.k] : o.d; });
  Object.assign(opts, w.opts);
  (kind.opts || []).forEach((o) => { opts[o.k] = w.opts[o.k] !== undefined ? !!w.opts[o.k] : o.d; });
  let body;
  try {
    body = WG_BODY[w.kind](w, ctx, opts);
  } catch (e) {
    console.error(`Erro no widget ${w.kind}`, e);
    body = wgEmpty("Deu ruim nesse aqui 💩");
  }
  const openLabel = wgOpenLabel(w, ctx);
  const badge = w.badge ? `<span class="wg-badge">${wgEsc(w.badge)}</span>` : "";
  delete w.badge;
  const icon = w.kind === "x_num" || w.kind === "x_atalho" ? (ctx.byId[w.opts.app] || {}).icon || app.icon : app.icon;
  const head = `<span class="wg-head"><span class="wg-head-icon">${icon}</span><span class="wg-head-title">${wgEsc(wgTitle(w))}</span>${badge}${openLabel && mode !== "preview" ? `<span class="wg-head-go">↗ ${wgEsc(openLabel.replace(/^\S+\s/, ""))}</span>` : ""}</span>`;
  const cls = `wg is-${w.size} is-${w.look}${app.soft ? " is-soft" : ""}${mode === "edit" ? " is-editing" : ""}`;
  const style = `--h:${app.hue}`;
  const href = wgHref(w, ctx);
  let cover = "";
  if (mode === "edit") {
    cover = `<button type="button" class="wg-cover" data-click="wgConfig" data-wid="${w.id}" aria-label="Configurar ${wgEsc(wgTitle(w))}"></button>`;
  } else if (mode === "home") {
    cover = href
      ? `<a class="wg-cover" href="${wgEsc(href)}" aria-label="${wgEsc(`${wgTitle(w)}: abrir ${openLabel}`)}"></a>`
      : `<span class="wg-cover is-still" aria-hidden="true"></span>`;
  }
  const edit = mode === "edit"
    ? `<button type="button" class="wg-x" data-click="wgRemove" data-wid="${w.id}" aria-label="Tirar ${wgEsc(wgTitle(w))} da home">✕</button><span class="wg-grip" data-wid="${w.id}" aria-label="Arrastar pra mudar de lugar" role="img">⠿</span>`
    : "";
  return `<div class="${cls}" style="${style}" data-wid="${w.id}">${cover}<div class="wg-body">${head}${body}</div>${edit}</div>`;
}

/* ---------------------------------------------------------------------
 * A tela (chamada pelo renderPortalViews na visão ⭐)
 * ------------------------------------------------------------------- */
function renderPortalWidgets(apps, cfg) {
  const ctx = wgCtx();
  const editing = typeof painelEditing !== "undefined" && painelEditing;
  const tiles = cfg.widgets.map((w) => wgRender(w, ctx, editing ? "edit" : "home")).join("");
  const dock = apps.map((app) => `<a ${portalLinkAttrs(app, "pv-dock-btn")} aria-label="Menu do ${escapeHtml(app.title)}">${app.icon}</a>`).join("");
  const undo = wgLastRemoved ? '<button type="button" class="wg-undo" data-click="wgUndo">↩ Desfazer</button>' : "";
  if (editing) {
    return `<div class="wg-editbar">
        <div class="wg-editbar-head"><b>🛠️ Montando a home</b><span>${undo}<button type="button" class="wg-btn is-add" data-click="wgAddOpen">＋ Widget</button><button type="button" class="wg-btn is-done" data-click="painelEditDone">✔ Pronto</button></span></div>
        <p class="wg-hint">Toca num widget pra configurar · ⠿ arrasta pra mudar de lugar · ✕ tira da home</p>
      </div>
      <div class="wg-grid is-editing">${tiles}</div>
      <button type="button" class="wg-addbig" data-click="wgAddOpen">＋ Adicionar widget</button>`;
  }
  const empty = cfg.widgets.length ? "" : '<button type="button" class="wg-addbig" data-click="wgAddOpen">＋ Bota teu primeiro widget aqui 😎</button>';
  return `${empty}<div class="wg-grid">${tiles}</div>
    <nav class="pv-dock" aria-label="Menu dos apps">${dock}</nav>
    <button type="button" class="pv-edit" data-click="painelEdit">✏️ Montar a home <span>(ou segura um widget)</span></button>`;
}

/* ---------------------------------------------------------------------
 * Folha: ＋ (escolhe o app) -> galeria -> ⚙ config
 * ------------------------------------------------------------------- */
function wgOpenSheet(step, extra = {}) {
  wgSheet = { step, app: extra.app || wgSheet.app, id: extra.id || "" };
  wgRenderSheet();
  openTobaModal("widgetModal");
}

function wgVisibleApps() {
  return WG_APP_ORDER.filter((k) => {
    const card = WG_APPS[k].card;
    if (!card) return true;
    const c = portalCards.find((x) => x.id === card);
    return c && c.visible;
  });
}

function wgRenderSheet() {
  const title = document.getElementById("wgSheetTitle");
  const box = document.getElementById("wgSheetBody");
  if (!title || !box) return;
  const ctx = wgCtx();
  const pill = (on) => (on ? " is-on" : "");

  if (wgSheet.step === "apps") {
    title.textContent = "＋ Novo widget";
    box.innerHTML = `<p class="toba-sheet-text">De qual app?</p><div class="wg-apps">${wgVisibleApps().map((k) => {
      const a = WG_APPS[k];
      const n = Object.keys(WG_KINDS).filter((x) => WG_KINDS[x].app === k).length;
      return `<button type="button" class="wg-app-tile${a.soft ? " is-soft" : ""}" style="--h:${a.hue}" data-click="wgGallery" data-app="${k}"><span class="wg-app-icon">${a.icon}</span><span><b>${a.name}</b><i>${n} ${n === 1 ? "widget" : "widgets"}</i></span></button>`;
    }).join("")}</div>`;
    return;
  }

  if (wgSheet.step === "gal") {
    const a = WG_APPS[wgSheet.app] || WG_APPS.bank;
    title.textContent = `${a.icon} Widgets do ${a.name}`;
    const cards = Object.keys(WG_KINDS).filter((k) => WG_KINDS[k].app === wgSheet.app).map((k) => {
      const kind = WG_KINDS[k];
      const size = kind.sizes.includes(wgGalSize[k]) ? wgGalSize[k] : kind.def;
      const w = wgNormalize([{ kind: k, size, opts: k === "x_atalho" ? { app: "toba-bank" } : k === "x_num" ? { app: "toba-bank", key: "livre" } : {} }])[0];
      const sizes = kind.sizes.length > 1
        ? `<span class="wg-pills"><span class="wg-pills-label">Tamanho</span>${kind.sizes.map((s) => `<button type="button" class="wg-pill${pill(s === size)}" data-click="wgGalSize" data-kind="${k}" data-size="${s}">${WG_SIZE_NAMES[s]}</button>`).join("")}</span>`
        : "";
      return `<div class="wg-gal-card">
          <div class="wg-gal-text"><b>${wgEsc(kind.title)}</b><span>${wgEsc(kind.desc)}</span></div>
          ${sizes}
          <div class="wg-gal-preview is-${size}">${wgRender(w, ctx, "preview")}</div>
          <button type="button" class="wg-btn is-wide" style="--h:${a.hue}" data-click="wgAdd" data-kind="${k}" data-size="${size}">＋ Botar na home</button>
        </div>`;
    }).join("");
    box.innerHTML = `<button type="button" class="wg-back" data-click="wgAddOpen">‹ Outros apps</button>${cards}`;
    return;
  }

  if (wgSheet.step === "cfg") {
    const cfg = getPortalViewConfig();
    const w = cfg.widgets.find((x) => x.id === wgSheet.id);
    if (!w) {
      closeTobaModal("widgetModal");
      return;
    }
    const kind = WG_KINDS[w.kind];
    const app = WG_APPS[wgWidgetApp(w)] || WG_APPS.extras;
    title.textContent = `⚙️ ${wgTitle(w)}`;
    const idx = cfg.widgets.indexOf(w);
    const sec = (label, inner) => `<div class="wg-sec"><div class="wg-sec-label">${label}</div>${inner}</div>`;
    let html = `<div class="wg-gal-preview is-${w.size}">${wgRender(w, ctx, "preview")}</div>`;
    if (w.kind === "x_atalho" || w.kind === "x_num") {
      const cards = portalCards.filter((c) => c.visible && (w.kind === "x_atalho" || PORTAL_APP_STATS[c.id]));
      html += sec("📱 De qual app", `<span class="wg-pills is-wrap">${cards.map((c) => `<button type="button" class="wg-pill${pill(c.id === w.opts.app)}" data-click="wgSetOpt" data-k="app" data-v="${c.id}">${c.icon} ${wgEsc(c.title.replace(/^Toba\s+/i, ""))}</button>`).join("")}</span>`);
      if (w.kind === "x_num" && PORTAL_APP_STATS[w.opts.app]) {
        html += sec("🔢 Qual número", `<span class="wg-pills is-wrap">${PORTAL_APP_STATS[w.opts.app].items.map((i) => `<button type="button" class="wg-pill${pill(i.key === w.opts.key)}" data-click="wgSetOpt" data-k="key" data-v="${i.key}">${wgEsc(i.label)}</button>`).join("")}</span>`);
      }
    }
    if (kind.sizes.length > 1) {
      html += sec("📐 Tamanho", `<span class="wg-pills">${kind.sizes.map((s) => `<button type="button" class="wg-pill${pill(s === w.size)}" data-click="wgSetSize" data-size="${s}">${WG_SIZE_NAMES[s]}</button>`).join("")}</span>`);
    }
    html += sec("👆 Ao tocar, abre…", `<span class="wg-opens">${wgOpensFor(w).map((o) => {
      const label = o === "app" ? `${(ctx.byId[w.opts.app] || {}).icon || "📱"} O app (menu dele)` : WG_OPENS[o].label;
      return `<button type="button" class="wg-open${pill(o === w.open)}" data-click="wgSetOpen" data-open="${o}"><span>${wgEsc(label)}</span><span>${o === w.open ? "✓" : ""}</span></button>`;
    }).join("")}</span>`);
    if (kind.opts && kind.opts.length) {
      html += sec("👀 Mostrar", `<span class="wg-pills is-wrap">${kind.opts.map((o) => {
        const on = w.opts[o.k] !== undefined ? !!w.opts[o.k] : o.d;
        return `<button type="button" class="wg-pill${pill(on)}" data-click="wgToggleOpt" data-k="${o.k}">${on ? "☑" : "☐"} ${wgEsc(o.l)}</button>`;
      }).join("")}</span>`);
    }
    html += sec("🎨 Visual", `<span class="wg-pills"><button type="button" class="wg-pill${pill(w.look === "cor")}" data-click="wgSetLook" data-look="cor">🎨 Cor do ${wgEsc(app.name)}</button><button type="button" class="wg-pill${pill(w.look === "escuro")}" data-click="wgSetLook" data-look="escuro">🌑 Escuro com borda</button></span>`);
    html += sec("↕️ Lugar na home", `<span class="wg-pills"><button type="button" class="wg-pill" data-click="wgMove" data-dir="-1" ${idx === 0 ? "disabled" : ""}>⬆️ Mais pra cima</button><button type="button" class="wg-pill" data-click="wgMove" data-dir="1" ${idx === cfg.widgets.length - 1 ? "disabled" : ""}>⬇️ Mais pra baixo</button></span>`);
    html += `<div class="wg-actions"><button type="button" class="btn btn-secondary wg-del" data-click="wgRemove" data-wid="${w.id}">🗑️ Tirar</button><button type="button" class="btn btn-primary" data-close>✔ Pronto</button></div>`;
    box.innerHTML = html;
  }
}

function wgRedraw() {
  if (typeof renderPortalViewPicker === "function") renderPortalViewPicker();
  renderPortalViews();
  const modal = document.getElementById("widgetModal");
  if (modal && wgSheet.step && document.body.contains(modal)) wgRenderSheet();
}

function wgUpdate(id, fn) {
  const ok = wgSave((list) => {
    const w = list.find((x) => x.id === id);
    if (w) fn(w);
  });
  if (ok) wgRedraw();
  return ok;
}

/* ---------------------------------------------------------------------
 * 🛒 Marcar item da lista de compras ali mesmo (mesmo formato da Compras:
 * extras[].checked ou shopping[segunda].checked). Ilegível = não grava.
 * ------------------------------------------------------------------- */
function wgShopToggle(el, event) {
  event.preventDefault();
  event.stopPropagation();
  const raw = localStorage.getItem("TOBA_KITCHEN_DB");
  let db = null;
  try {
    db = raw === null ? {} : JSON.parse(raw);
  } catch (e) {
    db = null;
  }
  if (!db || typeof db !== "object" || Array.isArray(db)) {
    showPageMessage("Não consegui ler os dados do Toba Kitchen, então nada foi gravado. Abre a Lista de compras pra conferir.", { title: "Dados protegidos", icon: "🛡️" });
    return;
  }
  const key = String(el.dataset.key || "");
  let nowDone = false;
  if (el.dataset.extra === "1") {
    const x = (Array.isArray(db.extras) ? db.extras : []).find((e) => e && String(e.id) === key);
    if (!x) return wgRedraw();
    x.checked = !(x.checked === true);
    nowDone = x.checked;
  } else {
    const monday = kitchenWeekMonday(toIsoDate());
    if (!db.shopping || typeof db.shopping !== "object" || Array.isArray(db.shopping)) db.shopping = {};
    const week = db.shopping[monday] && typeof db.shopping[monday] === "object" ? db.shopping[monday] : {};
    const list = Array.isArray(week.checked) ? week.checked : [];
    nowDone = !list.includes(key);
    week.checked = nowDone ? [...list, key] : list.filter((k) => k !== key);
    db.shopping[monday] = week;
  }
  if (!db.version) db.version = 1;
  try {
    if (raw) localStorage.setItem("TOBA_KITCHEN_DB_AUTO_BACKUP", raw);
    localStorage.setItem("TOBA_KITCHEN_DB", JSON.stringify(db));
  } catch (e) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return;
  }
  renderKitchenCard();
  renderPortalViews();
  tobaToast(nowDone ? "🛒 Peguei!" : "↩ Voltou pra lista");
}

/* ---------------------------------------------------------------------
 * ⠿ Arrastar pra mudar de lugar (modo montar)
 * ------------------------------------------------------------------- */
let wgDrag = null;
document.addEventListener("pointerdown", (event) => {
  const grip = event.target instanceof Element ? event.target.closest("#portalViews .wg-grip") : null;
  if (!grip) return;
  const tile = grip.closest(".wg");
  if (!tile) return;
  event.preventDefault();
  const r = tile.getBoundingClientRect();
  wgDrag = { id: tile.dataset.wid, tile, x: event.clientX, y: event.clientY, w: r.width, over: null };
  tile.classList.add("is-dragging");
  try { grip.setPointerCapture(event.pointerId); } catch (e) { /* tudo bem */ }
  try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* sem vibrar */ }
});
document.addEventListener("pointermove", (event) => {
  if (!wgDrag) return;
  event.preventDefault();
  wgDrag.tile.style.transform = `translate(${event.clientX - wgDrag.x}px, ${event.clientY - wgDrag.y}px) scale(1.04)`;
  wgDrag.tile.style.pointerEvents = "none";
  const under = document.elementFromPoint(event.clientX, event.clientY);
  const over = under && under.closest ? under.closest("#portalViews .wg") : null;
  if (wgDrag.over && wgDrag.over !== over) wgDrag.over.classList.remove("is-drop");
  wgDrag.over = over && over !== wgDrag.tile ? over : null;
  if (wgDrag.over) wgDrag.over.classList.add("is-drop");
}, { passive: false });
function wgDragEnd() {
  if (!wgDrag) return;
  const { id, over, tile } = wgDrag;
  wgDrag = null;
  tile.classList.remove("is-dragging");
  tile.style.transform = "";
  tile.style.pointerEvents = "";
  if (!over) return;
  over.classList.remove("is-drop");
  const to = over.dataset.wid;
  const ok = wgSave((list) => {
    const from = list.findIndex((w) => w.id === id);
    const target = list.findIndex((w) => w.id === to);
    if (from < 0 || target < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(target, 0, item);
  });
  if (ok) wgRedraw();
}
document.addEventListener("pointerup", wgDragEnd);
document.addEventListener("pointercancel", wgDragEnd);

/* ---------------------------------------------------------------------
 * Ações
 * ------------------------------------------------------------------- */
tobaActions({
  wgAddOpen: () => wgOpenSheet("apps"),
  wgGallery: (el) => {
    wgSheet.app = el.dataset.app;
    wgOpenSheet("gal", { app: el.dataset.app });
    const body = document.getElementById("wgSheetBody");
    if (body && body.scrollIntoView) body.scrollTop = 0;
  },
  wgGalSize: (el) => {
    wgGalSize[el.dataset.kind] = el.dataset.size;
    wgRenderSheet();
  },
  wgAdd: (el) => {
    const kind = WG_KINDS[el.dataset.kind];
    if (!kind) return;
    const cfg = getPortalViewConfig();
    if (cfg.widgets.length >= WG_MAX) {
      showPageMessage(`Já tem ${WG_MAX} widgets na home: tira um antes de botar outro.`, { title: "Home lotada", icon: "📦" });
      return;
    }
    const id = wgUid();
    const opts = el.dataset.kind === "x_atalho" ? { app: "toba-bank" } : el.dataset.kind === "x_num" ? { app: "toba-bank", key: "livre" } : {};
    const ok = wgSave((list) => list.push({ id, kind: el.dataset.kind, size: el.dataset.size, open: kind.open, look: "cor", opts }));
    if (!ok) return;
    painelEditing = true;
    wgLastRemoved = null;
    closeTobaModal("widgetModal");
    wgSheet = { step: "", app: wgSheet.app, id: "" };
    wgRedraw();
    tobaToast(`✨ ${kind.title} na home!`);
    const tile = document.querySelector(`#portalViews .wg[data-wid="${id}"]`);
    if (tile && tile.scrollIntoView) tile.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el.dataset.kind === "x_atalho" || el.dataset.kind === "x_num") wgOpenSheet("cfg", { id });
  },
  wgConfig: (el) => wgOpenSheet("cfg", { id: el.dataset.wid }),
  wgSetSize: (el) => wgUpdate(wgSheet.id, (w) => { w.size = el.dataset.size; }),
  wgSetOpen: (el) => wgUpdate(wgSheet.id, (w) => { w.open = el.dataset.open; }),
  wgSetLook: (el) => wgUpdate(wgSheet.id, (w) => { w.look = el.dataset.look; }),
  wgToggleOpt: (el) => wgUpdate(wgSheet.id, (w) => {
    const o = (WG_KINDS[w.kind].opts || []).find((x) => x.k === el.dataset.k);
    if (!o) return;
    const on = w.opts[o.k] !== undefined ? !!w.opts[o.k] : o.d;
    w.opts[o.k] = !on;
  }),
  wgSetOpt: (el) => wgUpdate(wgSheet.id, (w) => {
    w.opts[el.dataset.k] = el.dataset.v;
    if (el.dataset.k === "app" && w.kind === "x_num") {
      const def = PORTAL_APP_STATS[el.dataset.v];
      if (def && !def.items.some((i) => i.key === w.opts.key)) w.opts.key = def.items[0].key;
    }
    if (el.dataset.k === "app") w.open = "app";
  }),
  wgMove: (el) => {
    const dir = Number(el.dataset.dir);
    const ok = wgSave((list) => {
      const i = list.findIndex((w) => w.id === wgSheet.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });
    if (ok) wgRedraw();
  },
  wgRemove: (el) => {
    const id = el.dataset.wid;
    const cfg = getPortalViewConfig();
    const at = cfg.widgets.findIndex((w) => w.id === id);
    if (at < 0) return;
    const removed = cfg.widgets[at];
    const ok = wgSave((list) => list.splice(at, 1));
    if (!ok) return;
    wgLastRemoved = { w: removed, at };
    if (wgSheet.step === "cfg") {
      wgSheet.step = "";
      closeTobaModal("widgetModal");
    }
    wgRedraw();
    tobaToast(`🗑️ ${wgTitle(removed)} saiu (↩ Desfazer lá em cima)`);
  },
  wgUndo: () => {
    if (!wgLastRemoved) return;
    const { w, at } = wgLastRemoved;
    wgLastRemoved = null;
    const ok = wgSave((list) => list.splice(Math.min(at, list.length), 0, w));
    if (ok) wgRedraw();
  },
  wgShopToggle,
});
