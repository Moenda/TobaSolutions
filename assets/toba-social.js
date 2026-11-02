/* =====================================================================
 * Toba · Toba dos amigos (desde v1.61)
 * Vitrine pública resumida + amizade por @username, em cima da ☁️ Conta
 * (toba-cloud.js). Depende de toba-common.js, toba-cloud.js e, para
 * publicar a vitrine, de toba-player.js (tobaPlayerState).
 *
 * Firestore (regras em CLAUDE.md 4.3):
 *   usernames/{nome}               { uid, name }       @username (minúsculo) → conta
 *   profiles/{uid}                 vitrine (só o dono grava; amigo lê)
 *   profiles/{uid}/friends/{fid}   quem pode ler a minha vitrine
 *   profiles/{uid}/requests/{fid}  pedido de amizade que chegou
 * Nunca vai pra vitrine: Bank, valores crus dos bancos, nomes de tarefa,
 * listas/lugares, treinos um a um. Só números já somados e conquistas.
 * ===================================================================== */
const SOCIAL_STATE_KEY = "toba_social_state";
const SOCIAL_PUBLISH_DELAY = 3000;

// Pedaços que dá pra mostrar ou esconder. Bank não entra nunca (nem aparece como opção).
const SOCIAL_SECTIONS = [
  { id: "treinos", icon: "🏋️", name: "Treinos", def: true },
  { id: "rotina", icon: "✅", name: "Rotina", def: true },
  { id: "cozinha", icon: "🍳", name: "Cozinha", def: true },
  { id: "racing", icon: "🏁", name: "Racing", def: true },
  { id: "places", icon: "📍", name: "Places", def: true },
  { id: "peso", icon: "⚖️", name: "Meu peso", def: false },
];

// Categoria de conquista → pedaço que precisa estar ligado pra ela aparecer.
const SOCIAL_CAT_SECTION = {
  treinos: "treinos", peso: "treinos", multidao: "treinos", distancia: "treinos", energia: "treinos",
  saitama: "treinos", musculos: "treinos", recordes: "treinos", streak: "treinos", pesagem: "treinos",
  rotina: "rotina", cozinha: "cozinha", pista: "racing", roles: "places", amizade: "base",
};

// Números do duelo. section "base" = sempre (nível, XP, troféus).
const SOCIAL_STATS = [
  { key: "level", icon: "⭐", label: "Nível", section: "base" },
  { key: "xp", icon: "✨", label: "XP total", section: "base" },
  { key: "monthXp", icon: "📆", label: "XP no mês", section: "base" },
  { key: "trophies", icon: "🏆", label: "Troféus", section: "base" },
  { key: "workouts", icon: "🏋️", label: "Treinos", section: "treinos" },
  { key: "monthWorkouts", icon: "📅", label: "Treinos no mês", section: "treinos" },
  { key: "streak", icon: "🔥", label: "Streak agora", section: "treinos", unit: "dias" },
  { key: "streakBest", icon: "🔥", label: "Maior streak", section: "treinos", unit: "dias" },
  { key: "liftKg", icon: "💪", label: "Kg levantado", section: "treinos", unit: "kg" },
  { key: "km", icon: "🌍", label: "Km andados", section: "treinos", unit: "km", dec: 1 },
  { key: "kcal", icon: "🔥", label: "Kcal", section: "treinos" },
  { key: "saitamaReps", icon: "👊", label: "Reps do Saitama", section: "treinos" },
  { key: "records", icon: "📈", label: "Recordes", section: "treinos" },
  { key: "routineTasks", icon: "✅", label: "Tarefas feitas", section: "rotina" },
  { key: "routineBestSeq", icon: "🔁", label: "Maior sequência", section: "rotina", unit: "dias" },
  { key: "kitchenCooked", icon: "🍳", label: "Pratos feitos", section: "cozinha" },
  { key: "kitchenDistinct", icon: "📖", label: "Receitas diferentes", section: "cozinha" },
  { key: "racingFuelings", icon: "⛽", label: "Abastecidas", section: "racing" },
  { key: "racingKm", icon: "🏁", label: "Km rodados", section: "racing", unit: "km" },
  { key: "turismVisits", icon: "📍", label: "Lugares visitados", section: "places" },
  { key: "turismAdded", icon: "🗺️", label: "Lugares na lista", section: "places" },
  { key: "turismCities", icon: "🏙️", label: "Cidades", section: "places" },
  { key: "peso", icon: "⚖️", label: "Peso", section: "peso", unit: "kg", dec: 1, noCrown: true },
];

/* ---------------------------------------------------------------------
 * Estado local (cache do que está na nuvem, por conta)
 * ------------------------------------------------------------------- */
function socialDefaultShow() {
  const show = {};
  SOCIAL_SECTIONS.forEach((s) => { show[s.id] = s.def; });
  return show;
}

function socialReadState() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(SOCIAL_STATE_KEY) || "null");
  } catch (err) {
    data = null;
  }
  const base = { v: 1, uid: null, on: false, username: "", name: "", show: socialDefaultShow(), hash: "", at: 0, checked: 0 };
  if (!data || typeof data !== "object") return base;
  return {
    ...base,
    ...data,
    show: { ...socialDefaultShow(), ...(data.show && typeof data.show === "object" ? data.show : {}) },
  };
}

// Fatos que viram conquista 🤝 Amizade (calcSocialPlayer em toba-player.js).
// kind: "onAt" | "ghostAt" (uma data) ou "friends" | "duels" | "beat" (data por amigo).
// Só acrescenta: desfazer amizade não tira conquista.
function socialNoteFact(kind, uid) {
  const st = socialReadState();
  const facts = st.facts && typeof st.facts === "object" ? st.facts : {};
  const today = toIsoDate();
  if (kind === "onAt" || kind === "ghostAt") {
    if (facts[kind]) return false;
    facts[kind] = today;
  } else {
    if (!uid) return false;
    facts[kind] = facts[kind] && typeof facts[kind] === "object" ? facts[kind] : {};
    if (facts[kind][uid]) return false;
    facts[kind][uid] = today;
  }
  st.facts = facts;
  socialWriteState(st);
  if (typeof tobaPlayerCheck === "function") tobaPlayerCheck({ reason: "🤝 Amizade" });
  return true;
}

function socialWriteState(state) {
  try {
    localStorage.setItem(SOCIAL_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    // Sem espaço: a nuvem continua sendo a fonte.
  }
}

// Estado da conta logada agora (estado de outra conta no mesmo aparelho não vale).
function socialMyState() {
  const user = typeof TOBA_CLOUD !== "undefined" ? TOBA_CLOUD.user : null;
  const state = socialReadState();
  if (!user || state.uid !== user.uid) {
    return { ...socialReadState(), uid: user ? user.uid : null, on: false, username: "", name: "", hash: "", at: 0, checked: 0, show: socialDefaultShow() };
  }
  return state;
}

// @username: 3 a 20 letras sem acento, números, _ ou ponto. Guardado em minúsculo
// (o id na nuvem); o jeito que a pessoa escreveu (Bertoba) vira o nome na tela.
function socialCleanUsername(text) {
  return String(text || "").trim().replace(/^@+/, "").replace(/\s+/g, "");
}

function socialUsernameId(text) {
  return socialCleanUsername(text).toLowerCase();
}

function socialUsernameError(text) {
  const name = socialCleanUsername(text);
  if (name.length < 3) return "O username precisa de pelo menos 3 letras.";
  if (name.length > 20) return "No máximo 20 letras, Bertoba. 😂";
  if (!/^[A-Za-z0-9_.]+$/.test(name)) return "Só letras sem acento, números, _ e ponto.";
  if (/^[._]|[._]$/.test(name)) return "Não pode começar nem terminar com _ ou ponto.";
  return "";
}

function socialAt(name) {
  return name ? `@${name}` : "";
}

// Sugestão de username a partir do nome/e-mail da conta.
function socialDefaultName() {
  const user = TOBA_CLOUD.user;
  const raw = user ? (user.displayName || (user.email || "").split("@")[0] || "") : "";
  const clean = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_.]/g, "").replace(/^[._]+|[._]+$/g, "").slice(0, 20);
  return clean.length >= 3 ? clean : "";
}

/* ---------------------------------------------------------------------
 * Vitrine: monta o resumo a partir do estado do Perfil
 * ------------------------------------------------------------------- */
function socialLastWeight() {
  try {
    const db = JSON.parse(localStorage.getItem("TOBA_HEALTH_DB") || "null");
    const list = (db && Array.isArray(db.weighIns) ? db.weighIns : [])
      .filter((w) => w && typeof w.date === "string" && Number(w.weight) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    return last ? Math.round(Number(last.weight) * 10) / 10 : null;
  } catch (err) {
    return null;
  }
}

function socialBuildVitrine(state, prefs) {
  const show = prefs.show;
  const look = getPlayerLook(state);
  const month = state.today.slice(0, 7);
  const monthEvents = state.events.filter((e) => e.date && e.date.startsWith(month));
  const unlocked = state.achievements.filter((a) => a.unlocked);
  const ach = {};
  unlocked.forEach((a) => {
    const section = SOCIAL_CAT_SECTION[a.cat] || "base";
    if (section === "base" || show[section]) ach[a.id] = a.date;
  });
  const all = {
    level: state.level,
    xp: state.xp,
    monthXp: monthEvents.reduce((sum, e) => sum + (Number(e.xp) || 0), 0),
    trophies: unlocked.length,
    workouts: state.stats.workouts,
    monthWorkouts: monthEvents.filter((e) => e.kind === "workout").length,
    streak: state.streak.current,
    streakBest: state.streak.best,
    liftKg: Math.round(state.stats.liftKg || 0),
    km: Math.round((state.stats.km || 0) * 10) / 10,
    kcal: Math.round(state.stats.kcal || 0),
    saitamaReps: state.stats.saitamaReps || 0,
    records: state.stats.records || 0,
    routineTasks: state.stats.routineTasks || 0,
    routineBestSeq: state.stats.routineBestSeq || 0,
    kitchenCooked: state.stats.kitchenCooked || 0,
    kitchenDistinct: state.stats.kitchenDistinct || 0,
    racingFuelings: state.stats.racingFuelings || 0,
    racingKm: Math.round(state.stats.racingKm || 0),
    turismVisits: state.stats.turismVisits || 0,
    turismAdded: state.stats.turismAdded || 0,
    turismCities: state.stats.turismCities || 0,
    peso: show.peso ? socialLastWeight() : null,
  };
  const stats = {};
  SOCIAL_STATS.forEach((s) => {
    if (s.section === "base" || show[s.section]) stats[s.key] = all[s.key] ?? null;
  });
  const isGradient = look.color.color.startsWith("linear");
  return {
    v: 1,
    name: prefs.name,
    username: prefs.username,
    look: {
      avatar: look.avatar.icon,
      frame: look.frame.id,
      color: isGradient ? "#bc8cff" : look.color.color,
      ring: isGradient ? look.color.color : "",
      titleIcon: look.title.icon,
      title: look.title.name,
    },
    level: state.level,
    xp: state.xp,
    into: state.into,
    need: state.need,
    ratio: Math.round(state.ratio * 1000) / 1000,
    show: { ...show },
    stats,
    ach,
    achTotal: state.achievements.length,
  };
}

/* ---------------------------------------------------------------------
 * Nuvem
 * ------------------------------------------------------------------- */
function socialDb() {
  return TOBA_CLOUD.db;
}

function socialMe() {
  return TOBA_CLOUD.user ? TOBA_CLOUD.user.uid : null;
}

function socialProfileRef(uid) {
  return socialDb().collection("profiles").doc(uid);
}

function socialIsDenied(err) {
  const code = (err && err.code) || "";
  return code === "permission-denied" || code === "firestore/permission-denied";
}

// Entra na nuvem (baixa o SDK se precisar) e devolve o usuário ou null.
async function socialReady() {
  if (typeof tobaCloudBoot !== "function") return null;
  await tobaCloudBoot();
  return TOBA_CLOUD.user || null;
}

// Relê da nuvem se a vitrine desta conta existe (outro aparelho pode ter ligado).
async function socialLoadMine() {
  const uid = socialMe();
  if (!uid) return socialMyState();
  const local = socialMyState();
  const snap = await socialProfileRef(uid).get();
  const next = { ...local, uid };
  if (snap.exists) {
    const data = snap.data() || {};
    next.on = true;
    next.username = data.username || local.username;
    next.name = data.name || local.name;
    next.show = { ...socialDefaultShow(), ...(data.show || {}) };
  } else {
    next.on = false;
  }
  next.checked = Date.now();
  socialWriteState(next);
  return next;
}

// Pega o @username (ou troca). A regra só deixa criar se ninguém tem.
async function socialEnable({ username, show }) {
  const uid = socialMe();
  if (!uid) throw new Error("Entra na conta primeiro.");
  const err = socialUsernameError(username);
  if (err) return { ok: false, msg: err };
  const state = socialMyState();
  const name = socialCleanUsername(username);
  const id = name.toLowerCase();
  const ref = socialDb().collection("usernames").doc(id);
  const snap = await ref.get();
  const owner = snap.exists ? (snap.data() || {}).uid : null;
  if (owner && owner !== uid) return { ok: false, msg: `${socialAt(name)} já tem dono. Tenta outro! 😅` };
  if (!owner || (snap.data() || {}).name !== name) await ref.set({ uid, name });
  // Trocou de username: libera o antigo.
  const oldId = state.username ? state.username.toLowerCase() : "";
  if (oldId && oldId !== id) await socialDb().collection("usernames").doc(oldId).delete().catch(() => {});
  const next = { ...state, uid, on: true, username: name, name, show: { ...socialDefaultShow(), ...(show || state.show) }, hash: "" };
  socialWriteState(next);
  socialNoteFact("onAt");
  await socialPublish({ force: true });
  return { ok: true, state: socialReadState() };
}

async function socialDisable() {
  const uid = socialMe();
  const state = socialMyState();
  if (!uid) return;
  await socialProfileRef(uid).delete();
  if (state.username) await socialDb().collection("usernames").doc(state.username.toLowerCase()).delete().catch(() => {});
  socialWriteState({ ...state, on: false, username: "", hash: "", at: 0 });
}

function socialHash(obj) {
  const text = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return String(h);
}

let socialPublishTimer = null;

// Sobe a vitrine se mudou. Só com o Perfil calculado sem erro (state.ok).
async function socialPublish({ force = false } = {}) {
  const uid = socialMe();
  const state = socialMyState();
  const player = typeof tobaPlayerState !== "undefined" ? tobaPlayerState : null;
  if (!uid || !state.on || !player || !player.ok) return false;
  const vitrine = socialBuildVitrine(player, state);
  const hash = socialHash(vitrine);
  if (!force && hash === state.hash) return false;
  await socialProfileRef(uid).set({ ...vitrine, updatedAt: Date.now() });
  socialWriteState({ ...socialReadState(), hash, at: Date.now() });
  return true;
}

function socialSchedulePublish() {
  clearTimeout(socialPublishTimer);
  socialPublishTimer = setTimeout(() => {
    socialPublish().catch((err) => console.warn("toba-social: vitrine não subiu", err));
  }, SOCIAL_PUBLISH_DELAY);
}

// Amigo pelo @username: eu libero a minha vitrine pra ele e deixo o pedido na caixa dele.
async function socialAddByUsername(text) {
  const uid = socialMe();
  const state = socialMyState();
  const id = socialUsernameId(text);
  if (id.length < 3) return { ok: false, msg: "Digita o @ do amigo, tipo @maracujeba." };
  if (id === (state.username || "").toLowerCase()) return { ok: false, msg: "Esse é VOCÊ, campeão. 🤡 Manda o teu @ pro amigo." };
  if (socialUsernameError(text)) return { ok: false, msg: `Não achei ninguém com @${socialCleanUsername(text)}.` };
  const snap = await socialDb().collection("usernames").doc(id).get();
  if (!snap.exists) return { ok: false, msg: `Não achei ninguém com @${socialCleanUsername(text)}. Confere com o amigo.` };
  const target = snap.data() || {};
  if (!target.uid || target.uid === uid) return { ok: false, msg: "Esse é VOCÊ, campeão. 🤡" };
  const now = Date.now();
  const name = target.name || id;
  await socialProfileRef(uid).collection("friends").doc(target.uid).set({ name, at: now });
  await socialProfileRef(target.uid).collection("requests").doc(uid).set({ name: state.name || state.username, at: now });
  return { ok: true, uid: target.uid, name };
}

async function socialListRequests() {
  const uid = socialMe();
  const snap = await socialProfileRef(uid).collection("requests").get();
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) })).sort((a, b) => (b.at || 0) - (a.at || 0));
}

async function socialAccept(fromUid, info = {}) {
  const uid = socialMe();
  await socialProfileRef(uid).collection("friends").doc(fromUid).set({ name: info.name || "Amigo", at: Date.now() });
  await socialProfileRef(uid).collection("requests").doc(fromUid).delete();
}

async function socialReject(fromUid) {
  await socialProfileRef(socialMe()).collection("requests").doc(fromUid).delete();
}

// Desfaz dos dois lados (a regra deixa cada um apagar a própria linha na casa do outro).
async function socialRemove(friendUid) {
  const uid = socialMe();
  const tries = [
    socialProfileRef(uid).collection("friends").doc(friendUid).delete(),
    socialProfileRef(friendUid).collection("friends").doc(uid).delete(),
    socialProfileRef(friendUid).collection("requests").doc(uid).delete(),
    socialProfileRef(uid).collection("requests").doc(friendUid).delete(),
  ];
  await Promise.allSettled(tries);
}

// Lista de amigos com a vitrine de cada um (ou o motivo de não ter).
async function socialListFriends() {
  const uid = socialMe();
  const snap = await socialProfileRef(uid).collection("friends").get();
  const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
  return Promise.all(rows.map(async (row) => {
    try {
      const p = await socialProfileRef(row.uid).get();
      if (!p.exists) return { ...row, status: "off" };
      return { ...row, status: "ok", vitrine: p.data() };
    } catch (err) {
      if (!socialIsDenied(err)) return { ...row, status: "error" };
      // Sem acesso: ou ainda não aceitou, ou desfez/recusou.
      try {
        const req = await socialProfileRef(row.uid).collection("requests").doc(uid).get();
        return { ...row, status: req.exists ? "pending" : "gone" };
      } catch (err2) {
        return { ...row, status: "gone" };
      }
    }
  }));
}

/* ---------------------------------------------------------------------
 * Pedaços de tela usados no portal, Perfil e Toba dos amigos
 * ------------------------------------------------------------------- */
function socialAvatar(v, size = "md") {
  const look = (v && v.look) || {};
  const color = /^#[0-9a-fA-F]{3,8}$/.test(look.color || "") ? look.color : "#58a6ff";
  const ring = /^linear-gradient\([#0-9a-fA-F,\s%]+\)$/.test(look.ring || "") ? look.ring : "";
  const frame = /^[a-z0-9-]+$/.test(look.frame || "") ? look.frame : "simples";
  return `<span class="tp-avatar is-${size} tp-frame-${frame}" style="--tp-color:${color};${ring ? `--tp-ring:${ring}` : ""}" aria-hidden="true">
    <span class="tp-avatar-icon">${escapeHtml(look.avatar || "🐣")}</span>
    <span class="tp-avatar-level">${Number(v && v.level) || 1}</span>
  </span>`;
}

// Bolinha de pedidos no botão do portal e no Perfil.
async function socialRefreshBadge() {
  const badges = document.querySelectorAll("[data-social-badge]");
  if (!badges.length || !socialMe()) return;
  const state = socialMyState();
  if (!state.on) {
    badges.forEach((b) => { b.hidden = true; });
    return;
  }
  try {
    const list = await socialListRequests();
    badges.forEach((b) => {
      b.textContent = String(list.length);
      b.hidden = list.length === 0;
    });
  } catch (err) {
    // sem internet: a bolinha some até a próxima
  }
}

/* ---------------------------------------------------------------------
 * Partida: publica a vitrine quando o Perfil recalcula (portal, Perfil, Amigos)
 * ------------------------------------------------------------------- */
let socialAuthHooked = false;

function socialHookAuth() {
  if (socialAuthHooked || !TOBA_CLOUD.auth) return;
  socialAuthHooked = true;
  TOBA_CLOUD.auth.onAuthStateChanged((user) => {
    document.dispatchEvent(new CustomEvent("toba:social-user", { detail: user || null }));
    if (!user) return;
    const local = socialMyState();
    const stale = Date.now() - (local.checked || 0) > 6 * 3600 * 1000;
    const load = stale ? socialLoadMine() : Promise.resolve(local);
    load.then(() => {
      socialSchedulePublish();
      socialRefreshBadge();
    }).catch(() => {});
  });
}

document.addEventListener("toba:player", () => {
  if (TOBA_CLOUD.user && socialMyState().on) socialSchedulePublish();
});

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    // Só chama a nuvem se este aparelho já entrou numa conta (igual ao toba-cloud).
    const page = document.body && document.body.dataset.social === "page";
    if (!page && !(typeof tobaCloudReadState === "function" && tobaCloudReadState().uid)) return;
    if (page) return; // a página Toba dos amigos chama socialReady() ela mesma
    socialReady().then(() => socialHookAuth()).catch(() => {});
  }, 0);
});
