/* =====================================================================
 * Toba Health · 📱 Toba Screen (v2.08) · motor (dados + ponte com o APK)
 *
 * Pedido do Rafa (2026-11-15): "um analisador ULTRA fucking foda de tempo de tela / uso de app
 * do celular", com o mapa do mês (quadradinho por dia, igual o das calorias) e o mapa das horas
 * pra achar os horários e dias de mais uso e tentar arrumar.
 *
 * Caminho: Android ("Acesso ao uso", o mesmo dado do Bem-estar digital) -> APK 3.1
 * (ScreenReader.java, TOBA_NATIVE.screenRead) -> aqui -> TOBA_HEALTH_DB.screen (vai no backup
 * do Health e na ☁️). O Android só guarda uns 7 a 10 dias de detalhe, então o Toba grava o dele:
 * toda vez que abre o 📱 Toba Screen, o hub do Health ou o 🩻 Raio-X, relê os últimos dias sozinho.
 *
 * TOBA_HEALTH_DB.screen = {
 *   v: 1, goal?: minutos (ausente = 🧠 automática), limits?: { pacote: minutos },
 *   apps: { pacote: { n: nome, c: categoria do Android, sys?: 1, cat?: categoria escolhida (SCREEN_CATS) } },
 *   days: { "AAAA-MM-DD": {
 *     t (s nos apps), on (s de tela ligada), u (desbloqueios), pk (vezes que a tela acendeu),
 *     h: [24 s], hu: [24 desbloqueios], a: { pacote: s } (top 30),
 *     ah: { pacote: [24 s] } (top 8), n: { pacote: notificações } (top 15), fa: { pacote: 1º app depois de desbloquear } (top 10),
 *     s: "seg.dur.app.u.k ..." (sessões, ver screenDaySessions em health-metrics.js), sk: [pacotes das sessões],
 *     f?/l? (min da 1ª pegada / fim da última; só nos dias podados), cut?: 1 (Android não tinha o começo do dia), at } }
 * }
 * Dias com mais de SCREEN_DETAIL_DAYS perdem o detalhe (ah, s, sk, n, fa, hu) e ficam com o resumo.
 * toba_screen_state (só deste aparelho): { pulledAt, diag }. toba_screen_icons: { pacote: png base64 } (só deste aparelho, não é dado).
 * ===================================================================== */
const SCREEN_STATE_KEY = "toba_screen_state";
const SCREEN_ICONS_KEY = "toba_screen_icons";
const SCREEN_FIRST_DAYS = 14;
const SCREEN_DETAIL_DAYS = 90;
const SCREEN_AUTO_MIN = 5;
const SCREEN_GOALS = [60, 90, 120, 180, 240, 300, 360, 480];
const SCREEN_LIMITS = [15, 30, 45, 60, 90, 120, 180];

// Categorias (key gravada no apps[].cat: nunca renomear). kind: fun = 🍿 diversão, use = 🛠️ útil, mid = 😐 neutro
const SCREEN_CATS = [
  { key: "video", icon: "🍿", name: "Vídeo", kind: "fun", color: "#f85149" },
  { key: "social", icon: "💬", name: "Social & papo", kind: "fun", color: "#d2a8ff" },
  { key: "games", icon: "🎮", name: "Jogos", kind: "fun", color: "#ff7b72" },
  { key: "news", icon: "📰", name: "Notícias & leitura", kind: "fun", color: "#ffa657" },
  { key: "music", icon: "🎧", name: "Música & áudio", kind: "mid", color: "#3fb950" },
  { key: "browser", icon: "🌐", name: "Navegador", kind: "mid", color: "#79c0ff" },
  { key: "photo", icon: "📸", name: "Fotos & câmera", kind: "mid", color: "#56d4dd" },
  { key: "maps", icon: "🧭", name: "Mapas & carro", kind: "use", color: "#58a6ff" },
  { key: "work", icon: "🛠️", name: "Trampo & estudo", kind: "use", color: "#a5d6ff" },
  { key: "money", icon: "💰", name: "Grana & compras", kind: "use", color: "#e3b341" },
  { key: "toba", icon: "🤡", name: "Toba", kind: "use", color: "#f0c000" },
  { key: "system", icon: "⚙️", name: "Sistema", kind: "mid", color: "#8b949e" },
  { key: "other", icon: "📦", name: "Outros", kind: "mid", color: "#6e7681" },
];
const SCREEN_KINDS = { fun: "🍿 Diversão", mid: "😐 Neutro", use: "🛠️ Útil" };
// Android ApplicationInfo.category -> nossa
const SCREEN_ANDROID_CATS = { 0: "games", 1: "music", 2: "video", 3: "photo", 4: "social", 5: "news", 6: "maps", 7: "work" };
// Palpite pelo nome do pacote (pedaço do nome -> categoria), na ordem
const SCREEN_PKG_HINTS = [
  ["br.com.toba", "toba"],
  ["youtube.music", "music"], ["spotify", "music"], ["deezer", "music"], ["soundcloud", "music"], ["podcast", "music"], ["audible", "music"],
  ["youtube", "video"], ["netflix", "video"], ["primevideo", "video"], ["amazon.avod", "video"], ["disney", "video"], ["globo", "video"],
  ["twitch", "video"], ["kick", "video"], ["crunchyroll", "video"], ["hbo", "video"], ["max", "video"], ["stremio", "video"], ["pluto", "video"],
  ["whatsapp", "social"], ["telegram", "social"], ["instagram", "social"], ["musically", "social"], ["tiktok", "social"], ["discord", "social"],
  ["reddit", "social"], ["twitter", "social"], ["facebook", "social"], ["orca", "social"], ["threads", "social"], ["linkedin", "social"],
  ["messaging", "social"], ["dialer", "social"], ["contacts", "social"], ["mms", "social"], ["bluesky", "social"], ["snapchat", "social"],
  ["jagex", "games"], ["blizzard", "games"], ["supercell", "games"], ["riot", "games"], ["mojang", "games"], ["game", "games"], ["garena", "games"], ["playgames", "games"],
  ["waze", "maps"], ["maps", "maps"], ["ubercab", "maps"], ["uber", "maps"], ["taxis99", "maps"], ["android.projection.gearhead", "maps"], ["moovit", "maps"],
  ["gm", "work"], ["outlook", "work"], ["docs", "work"], ["sheets", "work"], ["drive", "work"], ["notion", "work"], ["teams", "work"], ["slack", "work"],
  ["calendar", "work"], ["keep", "work"], ["chatgpt", "work"], ["anthropic", "work"], ["claude", "work"], ["gemini", "work"], ["office", "work"], ["duolingo", "work"],
  ["nu.production", "money"], ["itau", "money"], ["bradesco", "money"], ["intermedium", "money"], ["picpay", "money"], ["mercadopago", "money"], ["mercadolibre", "money"],
  ["ifood", "money"], ["shopee", "money"], ["amazon.mShop", "money"], ["santander", "money"], ["caixa", "money"], ["bb.android", "money"], ["c6bank", "money"], ["xp", "money"],
  ["chrome", "browser"], ["sbrowser", "browser"], ["firefox", "browser"], ["opera", "browser"], ["brave", "browser"], ["duckduckgo", "browser"],
  ["gallery", "photo"], ["photos", "photo"], ["camera", "photo"],
  ["kindle", "news"], ["news", "news"], ["g1", "news"], ["uol", "news"], ["medium", "news"],
  ["settings", "system"], ["packageinstaller", "system"], ["vending", "system"], ["permissioncontroller", "system"], ["samsung.android.app.smartcapture", "system"],
];

const screenUi = { pulling: false, reqId: "", timer: null, status: null, iconReq: "", onData: null };

/* ---------------- Dados ---------------- */

function screenDb() {
  const s = healthDb.screen;
  if (!s || typeof s !== "object" || Array.isArray(s)) return { v: 1, days: {}, apps: {} };
  if (!s.days || typeof s.days !== "object" || Array.isArray(s.days)) s.days = {};
  if (!s.apps || typeof s.apps !== "object" || Array.isArray(s.apps)) s.apps = {};
  return s;
}

function screenEnsureDb() {
  if (!healthDb.screen || typeof healthDb.screen !== "object" || Array.isArray(healthDb.screen)) healthDb.screen = { v: 1, days: {}, apps: {} };
  return screenDb();
}

function screenDays() {
  return screenDb().days;
}

function screenDay(date) {
  const d = screenDays()[date];
  return d && typeof d === "object" ? d : null;
}

function screenState() {
  try {
    const s = JSON.parse(localStorage.getItem(SCREEN_STATE_KEY) || "null");
    return s && typeof s === "object" ? s : {};
  } catch (e) {
    return {};
  }
}

function screenSetState(patch) {
  try {
    localStorage.setItem(SCREEN_STATE_KEY, JSON.stringify({ ...screenState(), ...patch }));
  } catch (e) { /* conveniência */ }
}

function screenIcons() {
  try {
    const s = JSON.parse(localStorage.getItem(SCREEN_ICONS_KEY) || "null");
    return s && typeof s === "object" ? s : {};
  } catch (e) {
    return {};
  }
}

function screenAddDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/* ---------------- Apps e categorias ---------------- */

function screenAppInfo(pkg) {
  const a = screenDb().apps[pkg];
  return a && typeof a === "object" ? a : {};
}

function screenAppName(pkg) {
  const a = screenAppInfo(pkg);
  if (a.n && a.n !== pkg) return String(a.n);
  const last = String(pkg || "").split(".").filter((x) => !["com", "br", "android", "app", "org"].includes(x)).pop();
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : String(pkg || "?");
}

function screenCatOf(pkg) {
  const a = screenAppInfo(pkg);
  if (a.cat && SCREEN_CATS.some((c) => c.key === a.cat)) return a.cat;
  const p = String(pkg || "").toLowerCase();
  const hint = SCREEN_PKG_HINTS.find(([k]) => p.includes(k.toLowerCase()));
  if (hint) return hint[1];
  if (SCREEN_ANDROID_CATS[a.c] !== undefined) return SCREEN_ANDROID_CATS[a.c];
  if (a.sys) return "system";
  return "other";
}

function screenCat(key) {
  return SCREEN_CATS.find((c) => c.key === key) || SCREEN_CATS[SCREEN_CATS.length - 1];
}

/* ---------------- Ponte com o APK ---------------- */

function screenCanNative() {
  return Boolean(typeof TOBA_NATIVE !== "undefined" && TOBA_NATIVE && typeof TOBA_NATIVE.screenRead === "function" && typeof TOBA_NATIVE.screenStatus === "function");
}

function screenReadStatus() {
  if (!screenCanNative()) return null;
  try {
    const s = JSON.parse(TOBA_NATIVE.screenStatus() || "null");
    screenUi.status = s && typeof s === "object" ? s : null;
  } catch (e) {
    screenUi.status = null;
  }
  return screenUi.status;
}

function screenGranted() {
  return Boolean(screenUi.status && screenUi.status.granted);
}

// 1ª vez = 14 dias (o que o Android ainda tiver); depois do último dia guardado −1 até hoje (mín. 3 dias)
function screenPullRange() {
  const today = toIsoDate();
  const dates = Object.keys(screenDays()).sort();
  let from = screenAddDays(today, -(SCREEN_FIRST_DAYS - 1));
  if (dates.length) {
    const last = dates[dates.length - 1] < today ? dates[dates.length - 1] : today;
    from = screenAddDays(last, -1);
    const min3 = screenAddDays(today, -2);
    if (min3 < from) from = min3;
    const max = screenAddDays(today, -(SCREEN_FIRST_DAYS - 1));
    if (from < max) from = max;
  }
  return { from, to: today };
}

function screenPull({ quiet = false } = {}) {
  if (!screenCanNative()) return false;
  if (!screenReadStatus() || !screenGranted()) return false;
  if (screenUi.pulling) return true;
  const { from, to } = screenPullRange();
  screenUi.pulling = true;
  screenUi.quiet = quiet;
  screenUi.reqId = `s${Date.now()}`;
  if (typeof screenOnPullState === "function") screenOnPullState();
  clearTimeout(screenUi.timer);
  screenUi.timer = setTimeout(() => {
    if (!screenUi.pulling) return;
    screenUi.pulling = false;
    if (typeof screenOnPullState === "function") screenOnPullState();
    if (!quiet) showPageMessage("O Android não respondeu. Tenta de novo daqui a pouco.", { title: "Demorou demais", icon: "🐢" });
  }, 40000);
  let ok = false;
  try {
    ok = TOBA_NATIVE.screenRead(from, to, screenUi.reqId);
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    clearTimeout(screenUi.timer);
    screenUi.pulling = false;
    if (typeof screenOnPullState === "function") screenOnPullState();
  }
  return ok;
}

window.onTobaScreenData = function (reqId, data) {
  if (reqId !== screenUi.reqId) return;
  clearTimeout(screenUi.timer);
  screenUi.pulling = false;
  if (!data || !data.ok) {
    if (typeof screenOnPullState === "function") screenOnPullState();
    if (!screenUi.quiet) showPageMessage(`Não consegui ler o tempo de tela agora.${data && data.error ? `\n\n(${data.error})` : ""}`, { title: "Deu ruim", icon: "💩" });
    return;
  }
  const changed = screenMerge(data);
  screenSetState({
    pulledAt: Date.now(),
    diag: { at: Date.now(), from: data.from, to: data.to, events: Number(data.events) || 0, oldest: Number(data.oldest) || 0, days: Object.keys(data.days || {}).length },
  });
  if (changed) saveHealthDb({ silent: Boolean(screenUi.quiet) });
  screenFetchIcons();
  if (typeof screenOnPullState === "function") screenOnPullState();
  if (typeof screenOnData === "function") screenOnData(changed);
};

// Ícones que ainda não tem (só deste aparelho)
function screenFetchIcons() {
  if (!screenCanNative() || typeof TOBA_NATIVE.screenIcons !== "function") return;
  const have = screenIcons();
  const used = {};
  const days = screenDays();
  Object.keys(days).sort().slice(-30).forEach((d) => Object.entries(days[d].a || {}).forEach(([p, s]) => { used[p] = (used[p] || 0) + Number(s || 0); }));
  const want = Object.keys(used).filter((p) => !have[p]).sort((a, b) => used[b] - used[a]).slice(0, 40);
  if (!want.length) return;
  screenUi.iconReq = `i${Date.now()}`;
  try {
    TOBA_NATIVE.screenIcons(JSON.stringify(want), screenUi.iconReq);
  } catch (e) { /* sem ícone */ }
}

window.onTobaScreenIcons = function (reqId, map) {
  if (reqId !== screenUi.iconReq || !map || typeof map !== "object") return;
  const cur = screenIcons();
  Object.entries(map).forEach(([p, v]) => { if (typeof v === "string" && v.startsWith("data:image/png;base64,") && v.length < 20000) cur[p] = v; });
  const keys = Object.keys(cur);
  if (keys.length > 150) keys.slice(0, keys.length - 150).forEach((k) => delete cur[k]);
  try {
    localStorage.setItem(SCREEN_ICONS_KEY, JSON.stringify(cur));
  } catch (e) { /* sem espaço: fica sem ícone */ }
  if (typeof screenOnData === "function") screenOnData(false);
};

/* ---------------- Juntar o que veio ---------------- */

function screenTop(obj, n) {
  const out = {};
  Object.entries(obj && typeof obj === "object" ? obj : {})
    .map(([k, v]) => [String(k), Math.max(0, Math.round(Number(v) || 0))])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .forEach(([k, v]) => { out[k] = v; });
  return out;
}

function screenArr24(a) {
  return Array.isArray(a) && a.length === 24 ? a.map((v) => Math.max(0, Math.round(Number(v) || 0))) : null;
}

function screenCleanDay(date, src) {
  const day = {
    t: Math.max(0, Math.round(Number(src.t) || 0)),
    on: Math.max(0, Math.round(Number(src.on) || 0)),
    u: Math.max(0, Math.round(Number(src.u) || 0)),
    pk: Math.max(0, Math.round(Number(src.pk) || 0)),
  };
  const h = screenArr24(src.h);
  if (h) day.h = h;
  const hu = screenArr24(src.hu);
  if (hu) day.hu = hu;
  day.a = screenTop(src.a, 30);
  const ah = {};
  Object.keys(screenTop(src.a, 8)).forEach((p) => { const arr = screenArr24(src.ah && src.ah[p]); if (arr) ah[p] = arr; });
  day.ah = ah;
  day.n = screenTop(src.n, 15);
  day.fa = screenTop(src.fa, 10);
  // sessões -> "seg.dur.app.u.k"
  const base = new Date(`${date}T00:00:00`).getTime();
  const sk = [];
  const rows = (Array.isArray(src.s) ? src.s : []).filter((r) => Array.isArray(r) && Number.isFinite(Number(r[0])) && Number.isFinite(Number(r[1])));
  day.s = rows.slice(0, 400).map((r) => {
    const sec = Math.max(0, Math.round((Number(r[0]) - base) / 1000));
    const dur = Math.max(0, Math.round((Number(r[1]) - Number(r[0])) / 1000));
    const app = Math.max(0, Math.round(Number(r[2]) || 0));
    const pkg = String(r[3] || "");
    let k = -1;
    if (pkg) {
      k = sk.indexOf(pkg);
      if (k < 0) { sk.push(pkg); k = sk.length - 1; }
    }
    return `${sec}.${dur}.${app}.${Number(r[5]) ? 1 : 0}${k >= 0 ? `.${k}` : ""}`;
  }).join(" ");
  day.sk = sk;
  if (src.cut) day.cut = 1;
  day.at = Date.now();
  return day;
}

// Devolve true se mudou algo
function screenMerge(data) {
  const s = screenEnsureDb();
  let changed = false;
  Object.entries(data.apps && typeof data.apps === "object" ? data.apps : {}).forEach(([pkg, info]) => {
    if (!info || typeof info !== "object") return;
    const cur = s.apps[pkg] && typeof s.apps[pkg] === "object" ? s.apps[pkg] : {};
    const next = { ...cur };
    if (info.n && !info.gone) next.n = String(info.n).slice(0, 60);
    if (Number.isFinite(Number(info.c))) next.c = Number(info.c);
    if (info.sys) next.sys = 1; else delete next.sys;
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      s.apps[pkg] = next;
      changed = true;
    }
  });
  Object.entries(data.days && typeof data.days === "object" ? data.days : {}).forEach(([date, src]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !src || typeof src !== "object") return;
    const old = s.days[date];
    // dia cortado (o Android já tinha apagado o começo) não troca um dia inteiro que já tava guardado
    if (src.cut && old && !old.cut) return;
    const day = screenCleanDay(date, src);
    const cmp = (x) => JSON.stringify({ ...x, at: 0 });
    if (!old || cmp(old) !== cmp(day)) {
      s.days[date] = day;
      changed = true;
    }
  });
  if (screenPrune()) changed = true;
  return changed;
}

// 1ª pegada (min do dia, a partir das 4h) e fim da última (passa de 1440 se foi depois da meia-noite, até 4h)
function screenFirstLast(date) {
  const d = screenDay(date);
  if (!d) return null;
  if (!d.s && (d.f !== undefined || d.l !== undefined)) return { first: d.f ?? null, last: d.l ?? null };
  const base = new Date(`${date}T00:00:00`).getTime();
  const sess = screenDaySessions(d, date).filter((x) => x.app > 0);
  const next = screenDaySessions(screenDay(screenAddDays(date, 1)), screenAddDays(date, 1)).filter((x) => x.app > 0);
  const firstS = sess.find((x) => x.start - base >= 4 * 3600000);
  const late = next.filter((x) => x.start - (base + 86400000) < 4 * 3600000);
  const dayEnd = sess.filter((x) => x.start - base >= 4 * 3600000);
  const lastS = late.length ? late[late.length - 1] : dayEnd[dayEnd.length - 1];
  return {
    first: firstS ? Math.round((firstS.start - base) / 60000) : null,
    last: lastS ? Math.round((lastS.end - base) / 60000) : null,
  };
}

function screenPrune() {
  const s = screenDb();
  const cut = screenAddDays(toIsoDate(), -SCREEN_DETAIL_DAYS);
  let changed = false;
  Object.keys(s.days).sort().forEach((date) => {
    if (date >= cut) return;
    const d = s.days[date];
    if (!d || typeof d !== "object" || (d.s === undefined && d.ah === undefined)) return;
    const fl = screenFirstLast(date);
    if (fl && fl.first !== null) d.f = fl.first;
    if (fl && fl.last !== null) d.l = fl.last;
    ["ah", "s", "sk", "n", "fa", "hu"].forEach((k) => delete d[k]);
    d.a = screenTop(d.a, 15);
    changed = true;
  });
  return changed;
}

/* ---------------- Puxa calado no hub do Health e no 🩻 Raio-X ---------------- */

function screenAutoPull() {
  if (!screenCanNative()) return;
  screenReadStatus();
  if (!screenGranted()) return;
  const at = Number(screenState().pulledAt) || 0;
  if (Date.now() - at > SCREEN_AUTO_MIN * 60000) screenPull({ quiet: true });
}

if (!document.getElementById("screenPage")) {
  const prevResume = window.onTobaAppResume;
  window.onTobaAppResume = function () {
    if (typeof prevResume === "function") prevResume();
    screenAutoPull();
  };
  document.addEventListener("DOMContentLoaded", () => setTimeout(screenAutoPull, 1500));
}
