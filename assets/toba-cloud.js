/* Toba · Conta e nuvem (desde v1.59)
 *
 * LOCAL PRIMEIRO: o localStorage continua sendo a casa dos dados. A nuvem
 * (Firebase, projeto toba-solutions) guarda uma CÓPIA de cada banco por conta.
 * Sem login nada muda: o Firebase nem é baixado.
 *
 * Como funciona:
 * - Toda gravação numa chave sincronizada (TOBA_CLOUD_KEYS) é percebida aqui
 *   (embrulho do localStorage.setItem/removeItem) e, com conta, sobe uns
 *   segundos depois. Os cores não precisam saber da nuvem.
 * - Ao abrir qualquer página logado: lê o resumo da conta (1 leitura) e compara
 *   o hash de cada banco com o último sincronizado neste aparelho
 *   (toba_cloud_state). Mudou só aqui = sobe; mudou só na nuvem = desce (e a
 *   página recarrega); mudou nos dois = o mais novo ganha e o outro vira
 *   "versão guardada" na nuvem. No 1º login de um aparelho com dados dos dois
 *   lados, o Toba PERGUNTA com qual ficar.
 * - Nada é apagado sem cópia: antes do 1º sync baixa um backup geral e sobe
 *   uma cópia de tudo ("antes da nuvem"); ao descer da nuvem, o valor local
 *   vai para <CHAVE>_AUTO_BACKUP; 1 cópia por dia de cada banco fica em
 *   versões (7 dias); conflito e "Apagar tudo" também guardam cópia.
 *
 * Firestore (regras: só o dono lê/grava users/{uid}/**):
 *   users/{uid}                 { apps: { CHAVE: { hash, at, device, size, chunks, deleted } }, updatedAt }
 *   users/{uid}/apps/{CHAVE}    { key, value | null, chunks, hash, at, device, size }
 *   users/{uid}/chunks/{id}__i  { v }  pedaços de texto grande (doc tem limite de 1 MB)
 *   users/{uid}/versions/{id}   { key, kind: antes|dia|conflito|apagado, at, device, size, hash, chunks }
 */

const TOBA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBKo3noy_BjJ7KGzT3pKVH7_XEqnJJ1f5M",
  authDomain: "toba-solutions.firebaseapp.com",
  projectId: "toba-solutions",
  storageBucket: "toba-solutions.firebasestorage.app",
  messagingSenderId: "223082578665",
  appId: "1:223082578665:web:9490fbbfa5400b4c3ba678",
};
const TOBA_CLOUD_SDK = "https://cdn.jsdelivr.net/npm/firebase@10.14.1/";
const TOBA_CLOUD_STATE_KEY = "toba_cloud_state";
const TOBA_CLOUD_CHUNK = 300000; // caracteres por pedaço (até ~900 KB em UTF-8)
const TOBA_CLOUD_PUSH_DELAY = 2500;
const TOBA_CLOUD_DAILY_KEEP = 7;

// Ordem = ordem dos chips na folha. Nunca troque uma "key" (é o id na nuvem).
const TOBA_CLOUD_KEYS = [
  { key: "TOBA_BANK_DB", label: "Bank", emoji: "🏦" },
  { key: "TOBA_HEALTH_DB", label: "Health", emoji: "🥗" },
  { key: "TOBA_ROUTINE_DB", label: "Routine", emoji: "✅" },
  { key: "TOBA_KITCHEN_DB", label: "Kitchen", emoji: "🍳" },
  { key: "TOBA_RACING_DB", label: "Racing", emoji: "🏎️" },
  { key: "TOBA_TURISM_DB", label: "Tourism", emoji: "🌎" },
  { key: "TOBA_PLAYER_DB", label: "Perfil", emoji: "🎮" },
  { key: "toba_modules_config", label: "Cards", emoji: "🧩", group: "prefs" },
  { key: "toba_bank_card_config", group: "prefs" },
  { key: "toba_health_card_config", group: "prefs" },
  { key: "toba_routine_card_config", group: "prefs" },
  { key: "toba_player_prefs", group: "prefs" },
  { key: "toba_health_live_prefs", group: "prefs" },
  { key: "toba_kitchen_prefs", group: "prefs" },
];
const TOBA_CLOUD_KEY_SET = new Set(TOBA_CLOUD_KEYS.map((item) => item.key));

/* ---------------------------------------------------------------------
 * Estado deste aparelho (toba_cloud_state)
 * ------------------------------------------------------------------- */
const tobaCloudRaw = {
  get: Storage.prototype.getItem,
  set: Storage.prototype.setItem,
  remove: Storage.prototype.removeItem,
};
let tobaCloudApplying = false; // true enquanto a própria nuvem grava (não conta como mudança local)

function tobaCloudNewId() {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function tobaCloudReadState() {
  let state = null;
  try {
    state = JSON.parse(tobaCloudRaw.get.call(localStorage, TOBA_CLOUD_STATE_KEY) || "null");
  } catch (err) {
    state = null;
  }
  if (!state || typeof state !== "object") state = {};
  state.v = 1;
  state.deviceId = state.deviceId || tobaCloudNewId();
  state.uid = state.uid || null;
  state.syncedUid = state.syncedUid || null;
  state.keys = state.keys && typeof state.keys === "object" ? state.keys : {};
  state.localAt = state.localAt && typeof state.localAt === "object" ? state.localAt : {};
  state.deleted = state.deleted && typeof state.deleted === "object" ? state.deleted : {};
  state.off = state.off && typeof state.off === "object" ? state.off : {};
  state.daily = state.daily && typeof state.daily === "object" ? state.daily : {};
  state.presync = state.presync && typeof state.presync === "object" ? state.presync : {};
  return state;
}

function tobaCloudWriteState(state) {
  try {
    tobaCloudRaw.set.call(localStorage, TOBA_CLOUD_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[Toba nuvem] não gravou o estado:", err);
  }
}

/* ---------------------------------------------------------------------
 * Percebe gravações nas chaves sincronizadas (sem mexer nos cores)
 * ------------------------------------------------------------------- */
(function tobaCloudWatchStorage() {
  const proto = Storage.prototype;
  proto.setItem = function tobaCloudSetItem(key, value) {
    const isLocal = this === window.localStorage;
    // O estado da nuvem só é gravado por este arquivo. Um backup geral antigo
    // trazendo outro toba_cloud_state faria o Toba achar que o importado já
    // estava sincronizado (e a nuvem desfaria a importação).
    if (isLocal && key === TOBA_CLOUD_STATE_KEY) return;
    if (!isLocal || !TOBA_CLOUD_KEY_SET.has(key) || tobaCloudApplying) {
      return tobaCloudRaw.set.call(this, key, value);
    }
    const before = tobaCloudRaw.get.call(this, key);
    const result = tobaCloudRaw.set.call(this, key, value); // erro de cota sobe normal
    if (before !== String(value)) tobaCloudMarkLocal(key, false);
    return result;
  };
  proto.removeItem = function tobaCloudRemoveItem(key) {
    const isLocal = this === window.localStorage;
    if (!isLocal || !TOBA_CLOUD_KEY_SET.has(key) || tobaCloudApplying) {
      return tobaCloudRaw.remove.call(this, key);
    }
    const had = tobaCloudRaw.get.call(this, key) !== null;
    const result = tobaCloudRaw.remove.call(this, key);
    if (had) tobaCloudMarkLocal(key, true);
    return result;
  };
})();

function tobaCloudMarkLocal(key, deleted) {
  const state = tobaCloudReadState();
  state.localAt[key] = Date.now();
  if (deleted) state.deleted[key] = Date.now();
  else delete state.deleted[key];
  tobaCloudWriteState(state);
  if (state.uid) tobaCloudSchedulePush();
}

/* ---------------------------------------------------------------------
 * Utilidades
 * ------------------------------------------------------------------- */
// Hash rápido (cyrb53) só pra saber se o texto mudou.
function tobaCloudHash(text) {
  if (text === null || text === undefined) return null;
  const str = String(text);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${str.length.toString(36)}-${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
}

function tobaCloudDeviceLabel() {
  if (typeof tobaIsApp === "function" && tobaIsApp()) return "📱 App Android";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad/i.test(ua)) return "📱 iPhone";
  if (/Android/i.test(ua)) return "📱 Celular (Chrome)";
  return "💻 Computador";
}

function tobaCloudKb(size) {
  const kb = (Number(size) || 0) / 1024;
  return kb < 10 ? `${kb.toFixed(1).replace(".", ",")} KB` : `${Math.round(kb)} KB`;
}

function tobaCloudAgo(ms) {
  if (!ms) return "nunca";
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function tobaCloudKeyInfo(key) {
  return TOBA_CLOUD_KEYS.find((item) => item.key === key) || { key, label: key, emoji: "📦" };
}

function tobaCloudKeyName(key) {
  const info = tobaCloudKeyInfo(key);
  return info.label ? `${info.emoji} ${info.label}` : "🧩 Preferências";
}

function tobaCloudEsc(text) {
  return typeof escapeHtml === "function"
    ? escapeHtml(String(text ?? ""))
    : String(text ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/* ---------------------------------------------------------------------
 * Firebase (baixado só quando precisa)
 * ------------------------------------------------------------------- */
const TOBA_CLOUD = {
  ready: null,
  auth: null,
  db: null,
  user: null,
  status: "off", // off | loading | syncing | ok | offline | error
  error: "",
  lastSync: 0,
  view: "main",
  mode: "login",
  versions: null,
};

function tobaCloudLoadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`não baixou ${src}`));
    document.head.appendChild(el);
  });
}

function tobaCloudBoot() {
  if (TOBA_CLOUD.ready) return TOBA_CLOUD.ready;
  TOBA_CLOUD.ready = (async () => {
    if (!window.firebase || !window.firebase.firestore) {
      await tobaCloudLoadScript(`${TOBA_CLOUD_SDK}firebase-app-compat.js`);
      await tobaCloudLoadScript(`${TOBA_CLOUD_SDK}firebase-auth-compat.js`);
      await tobaCloudLoadScript(`${TOBA_CLOUD_SDK}firebase-firestore-compat.js`);
    }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(TOBA_FIREBASE_CONFIG);
    TOBA_CLOUD.auth = app.auth();
    TOBA_CLOUD.auth.languageCode = "pt-BR";
    TOBA_CLOUD.db = app.firestore();
    TOBA_CLOUD.auth.getRedirectResult().catch((err) => {
      TOBA_CLOUD.error = tobaCloudErrorText(err);
      tobaCloudRender();
    });
    await new Promise((resolve) => {
      let first = true;
      TOBA_CLOUD.auth.onAuthStateChanged((user) => {
        tobaCloudOnUser(user);
        if (first) {
          first = false;
          resolve();
        }
      });
    });
    return TOBA_CLOUD;
  })().catch((err) => {
    TOBA_CLOUD.ready = null;
    TOBA_CLOUD.status = "offline";
    TOBA_CLOUD.error = "Sem internet pra falar com a nuvem agora. Seus dados continuam aqui no aparelho.";
    tobaCloudRender();
    throw err;
  });
  return TOBA_CLOUD.ready;
}

function tobaCloudOnUser(user) {
  TOBA_CLOUD.user = user || null;
  const state = tobaCloudReadState();
  if (user) {
    state.uid = user.uid;
    state.email = user.email || "";
    tobaCloudWriteState(state);
    TOBA_CLOUD.status = "ok";
    tobaCloudRender();
    tobaCloudSync("login");
  } else {
    // Sessão acabou (ou saiu em outra aba): os dados ficam no aparelho.
    if (state.uid) {
      state.uid = null;
      tobaCloudWriteState(state);
    }
    TOBA_CLOUD.status = "off";
    tobaCloudRender();
  }
}

function tobaCloudErrorText(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/invalid-credential": "E-mail ou senha não batem. Confere aí, campeão. 🤡",
    "auth/wrong-password": "Senha errada. Confere aí, campeão. 🤡",
    "auth/user-not-found": "Não achei conta com esse e-mail. Bora criar uma?",
    "auth/invalid-login-credentials": "E-mail ou senha não batem. Confere aí, campeão. 🤡",
    "auth/email-already-in-use": "Esse e-mail já tem conta. Toca em Entrar.",
    "auth/credential-already-in-use": "Esse e-mail já está ligado a outra conta.",
    "auth/provider-already-linked": "Essa conta já tem senha.",
    "auth/weak-password": "Senha fraca: usa pelo menos 6 caracteres.",
    "auth/invalid-email": "Esse e-mail tá esquisito. Confere a digitação.",
    "auth/missing-password": "Faltou a senha.",
    "auth/too-many-requests": "Muitas tentativas. Respira, toma um café e tenta daqui a pouco. ☕",
    "auth/network-request-failed": "Sem internet agora. Tenta de novo quando voltar.",
    "auth/popup-closed-by-user": "A janela do Google fechou antes de terminar.",
    "auth/cancelled-popup-request": "A janela do Google fechou antes de terminar.",
    "auth/unauthorized-domain": "Este endereço não está liberado no Firebase (Domínios autorizados).",
    "auth/operation-not-allowed": "Esse jeito de entrar não está ligado no Firebase.",
    "auth/requires-recent-login": "Por segurança, sai e entra de novo antes disso.",
    "permission-denied": "A nuvem recusou (regras do Firestore). Sai e entra de novo.",
    unavailable: "Sem internet pra falar com a nuvem agora.",
  };
  return map[code] || `Deu ruim: ${(err && err.message) || err}`;
}

/* ---------------------------------------------------------------------
 * Leitura e gravação na nuvem
 * ------------------------------------------------------------------- */
function tobaCloudUserRef() {
  return TOBA_CLOUD.db.collection("users").doc(TOBA_CLOUD.user.uid);
}

function tobaCloudSplit(value) {
  const parts = [];
  for (let i = 0; i < value.length; i += TOBA_CLOUD_CHUNK) parts.push(value.slice(i, i + TOBA_CLOUD_CHUNK));
  return parts.length ? parts : [""];
}

async function tobaCloudReadChunks(ownerId, count) {
  const userRef = tobaCloudUserRef();
  const docs = await Promise.all(
    Array.from({ length: count }, (_, i) => userRef.collection("chunks").doc(`${ownerId}__${i}`).get()),
  );
  return docs.map((doc) => {
    if (!doc.exists) throw new Error(`pedaço ${doc.id} sumiu`);
    return String(doc.data().v || "");
  }).join("");
}

// Guarda uma versão (sempre em pedaços: a lista fica leve). Cada versão vai
// num envio próprio: um envio do Firestore aceita no máximo 10 MB.
async function tobaCloudSaveVersion(key, kind, value, extra = {}) {
  const userRef = tobaCloudUserRef();
  const state = tobaCloudReadState();
  const id = extra.id || `${key}_${kind}_${Date.now()}`;
  const parts = tobaCloudSplit(value);
  const batch = TOBA_CLOUD.db.batch();
  parts.forEach((part, i) => batch.set(userRef.collection("chunks").doc(`ver_${id}__${i}`), { v: part }));
  batch.set(userRef.collection("versions").doc(id), {
    key,
    kind,
    at: Date.now(),
    device: tobaCloudDeviceLabel(),
    deviceId: state.deviceId,
    size: value.length,
    hash: tobaCloudHash(value),
    chunks: parts.length,
  });
  await batch.commit();
  return id;
}

async function tobaCloudDeleteVersion(id) {
  const userRef = tobaCloudUserRef();
  const doc = await userRef.collection("versions").doc(id).get();
  if (!doc.exists) return;
  const batch = TOBA_CLOUD.db.batch();
  const count = Number(doc.data().chunks) || 0;
  for (let i = 0; i < count; i++) batch.delete(userRef.collection("chunks").doc(`ver_${id}__${i}`));
  batch.delete(doc.ref);
  await batch.commit();
}

async function tobaCloudPushKey(key, value, metaEntry, options = {}) {
  const userRef = tobaCloudUserRef();
  const state = tobaCloudReadState();
  const batch = TOBA_CLOUD.db.batch();
  const at = Date.now();
  const device = tobaCloudDeviceLabel();
  const oldChunks = Number(metaEntry && metaEntry.chunks) || 0;

  if (value === null) {
    // "Apagar tudo" de um app: a versão da nuvem vira cópia "apagado" antes.
    if (options.cloudValue) await tobaCloudSaveVersion(key, "apagado", options.cloudValue);
    batch.delete(userRef.collection("apps").doc(key));
    for (let i = 0; i < oldChunks; i++) batch.delete(userRef.collection("chunks").doc(`app_${key}__${i}`));
    batch.set(userRef, {
      apps: { [key]: { hash: null, at, device, size: 0, chunks: 0, deleted: true } },
      updatedAt: at,
    }, { merge: true });
    await batch.commit();
    return { hash: null, at };
  }

  // Cópias primeiro (se a internet cair no meio, nada se perde).
  if (options.conflictValue) await tobaCloudSaveVersion(key, "conflito", options.conflictValue);
  const today = typeof toIsoDate === "function" ? toIsoDate() : new Date().toISOString().slice(0, 10);
  let oldDaily = null;
  if (state.daily[key] !== today) {
    // Cópia do dia: a 1ª subida de cada dia guarda o banco (7 dias pra trás).
    await tobaCloudSaveVersion(key, "dia", value, { id: `${key}_dia_${today}` });
    const old = new Date();
    old.setDate(old.getDate() - TOBA_CLOUD_DAILY_KEEP);
    oldDaily = `${key}_dia_${typeof toIsoDate === "function" ? toIsoDate(old) : old.toISOString().slice(0, 10)}`;
  }

  const hash = tobaCloudHash(value);
  const big = value.length > TOBA_CLOUD_CHUNK;
  const parts = big ? tobaCloudSplit(value) : [];
  parts.forEach((part, i) => batch.set(userRef.collection("chunks").doc(`app_${key}__${i}`), { v: part }));
  for (let i = parts.length; i < oldChunks; i++) batch.delete(userRef.collection("chunks").doc(`app_${key}__${i}`));
  batch.set(userRef.collection("apps").doc(key), {
    key,
    value: big ? null : value,
    chunks: parts.length,
    hash,
    at,
    device,
    deviceId: state.deviceId,
    size: value.length,
  });
  batch.set(userRef, {
    apps: { [key]: { hash, at, device, size: value.length, chunks: parts.length, deleted: false } },
    updatedAt: at,
    email: (TOBA_CLOUD.user && TOBA_CLOUD.user.email) || "",
  }, { merge: true });

  await batch.commit();
  if (state.daily[key] !== today) {
    const fresh = tobaCloudReadState();
    fresh.daily[key] = today;
    tobaCloudWriteState(fresh);
    if (oldDaily) tobaCloudDeleteVersion(oldDaily).catch(() => {});
  }
  return { hash, at };
}

async function tobaCloudReadKey(key) {
  const doc = await tobaCloudUserRef().collection("apps").doc(key).get();
  if (!doc.exists) return null;
  const data = doc.data();
  const value = Number(data.chunks) > 0 ? await tobaCloudReadChunks(`app_${key}`, Number(data.chunks)) : String(data.value ?? "");
  if (data.hash && tobaCloudHash(value) !== data.hash) throw new Error(`cópia de ${key} veio incompleta`);
  return { value, at: data.at, device: data.device, size: value.length };
}

/* ---------------------------------------------------------------------
 * Sincronizar
 * ------------------------------------------------------------------- */
let tobaCloudPushTimer = null;
let tobaCloudSyncing = null;
let tobaCloudAgain = false;

function tobaCloudSchedulePush() {
  clearTimeout(tobaCloudPushTimer);
  tobaCloudPushTimer = setTimeout(() => tobaCloudSync("push"), TOBA_CLOUD_PUSH_DELAY);
}

function tobaCloudSync(reason = "manual") {
  if (!TOBA_CLOUD.user || !TOBA_CLOUD.db) return Promise.resolve(false);
  if (tobaCloudSyncing) {
    tobaCloudAgain = true;
    return tobaCloudSyncing;
  }
  tobaCloudSyncing = tobaCloudRunSync(reason)
    .then(() => true)
    .catch((err) => {
      console.warn("[Toba nuvem] sync falhou:", err);
      const offline = !navigator.onLine || (err && (err.code === "unavailable" || err.code === "auth/network-request-failed"));
      TOBA_CLOUD.status = offline ? "offline" : "error";
      TOBA_CLOUD.error = offline
        ? "Sem internet: tá tudo salvo aqui no aparelho e sobe quando a rede voltar."
        : tobaCloudErrorText(err);
      tobaCloudRender();
      return false;
    })
    .finally(() => {
      tobaCloudSyncing = null;
      if (tobaCloudAgain) {
        tobaCloudAgain = false;
        tobaCloudSchedulePush();
      }
    });
  return tobaCloudSyncing;
}

async function tobaCloudRunSync(reason) {
  const uid = TOBA_CLOUD.user.uid;
  TOBA_CLOUD.status = "syncing";
  TOBA_CLOUD.error = "";
  tobaCloudRender();

  const metaDoc = await tobaCloudUserRef().get();
  const meta = (metaDoc.exists && metaDoc.data().apps) || {};
  let state = tobaCloudReadState();
  const first = state.syncedUid !== uid;

  if (first && !state.presync[uid]) await tobaCloudPreSyncBackup(meta);
  state = tobaCloudReadState();

  const plan = { push: [], pull: [], ask: [], auto: [] };
  TOBA_CLOUD_KEYS.forEach(({ key }) => {
    if (state.off[key]) return;
    const local = localStorage.getItem(key);
    const localHash = tobaCloudHash(local);
    const cloud = meta[key] && !meta[key].deleted ? meta[key] : null;
    const cloudHash = cloud ? cloud.hash : null;
    const last = first ? undefined : state.keys[key];
    if (localHash === cloudHash) {
      if (local !== null || meta[key]) state.keys[key] = { hash: localHash, at: (meta[key] && meta[key].at) || 0 };
      return;
    }
    const lastHash = last ? last.hash : null;
    let localChanged = first ? local !== null : localHash !== lastHash;
    // Sumiu daqui sem ter sido "Apagar tudo" (ex.: dados do navegador limpos): a nuvem devolve.
    if (localChanged && local === null && !state.deleted[key]) localChanged = false;
    const cloudChanged = first ? Boolean(cloud) : (meta[key] ? meta[key].hash : null) !== lastHash && Boolean(meta[key]);
    if (localChanged && !cloudChanged) plan.push.push(key);
    else if (!localChanged && cloudChanged) plan.pull.push(key);
    else if (localChanged && cloudChanged) (first ? plan.ask : plan.auto).push(key);
  });
  tobaCloudWriteState(state);

  // 1º login com dados dos dois lados: pergunta (com tamanho e data de cada um).
  if (plan.ask.length) {
    const choices = await tobaCloudAskConflicts(plan.ask, meta);
    plan.ask.forEach((key) => (choices[key] === "local" ? plan.push : plan.pull).push(key));
    plan.conflictCopy = plan.ask;
  } else {
    plan.conflictCopy = [];
  }
  // Mudou nos dois depois do último sync: o mais novo ganha, o outro vira cópia.
  plan.auto.forEach((key) => {
    const localAt = Number(state.localAt[key]) || 0;
    const cloudAt = Number(meta[key] && meta[key].at) || 0;
    (localAt >= cloudAt ? plan.push : plan.pull).push(key);
    plan.conflictCopy.push(key);
  });

  let pulled = 0;
  for (const key of plan.push) {
    const local = localStorage.getItem(key);
    const needsCloudCopy = plan.conflictCopy.includes(key) || local === null;
    const cloudOld = needsCloudCopy && meta[key] && !meta[key].deleted ? await tobaCloudReadKey(key) : null;
    const res = await tobaCloudPushKey(key, local, meta[key], {
      conflictValue: local !== null && cloudOld ? cloudOld.value : null,
      cloudValue: local === null && cloudOld ? cloudOld.value : null,
    });
    const fresh = tobaCloudReadState();
    fresh.keys[key] = { hash: res.hash, at: res.at };
    if (local === null) delete fresh.deleted[key];
    tobaCloudWriteState(fresh);
  }
  for (const key of plan.pull) {
    const cloudDeleted = meta[key] && meta[key].deleted;
    const cloudData = cloudDeleted ? null : await tobaCloudReadKey(key);
    const local = localStorage.getItem(key);
    if (plan.conflictCopy.includes(key) && local !== null) {
      // Perdeu o conflito: a versão daqui também vai pra nuvem como cópia.
      await tobaCloudSaveVersion(key, "conflito", local);
    }
    tobaCloudApplyLocal(key, cloudData ? cloudData.value : null);
    const fresh = tobaCloudReadState();
    fresh.keys[key] = { hash: cloudData ? tobaCloudHash(cloudData.value) : null, at: (meta[key] && meta[key].at) || 0 };
    delete fresh.deleted[key];
    tobaCloudWriteState(fresh);
    pulled += 1;
  }

  const done = tobaCloudReadState();
  done.syncedUid = uid;
  done.lastSync = Date.now();
  tobaCloudWriteState(done);
  TOBA_CLOUD.lastSync = done.lastSync;
  TOBA_CLOUD.status = "ok";
  tobaCloudRender();

  if (pulled) tobaCloudReloadAfterPull(plan.conflictCopy.length > 0);
  else if (reason === "manual") tobaToast("☁️ Tudo em dia com a nuvem");
}

// Grava o que veio da nuvem; o valor daqui fica em <CHAVE>_AUTO_BACKUP.
function tobaCloudApplyLocal(key, value) {
  const current = localStorage.getItem(key);
  tobaCloudApplying = true;
  try {
    if (current !== null && current !== value && /^TOBA_/.test(key)) {
      try {
        localStorage.setItem(`${key}_AUTO_BACKUP`, current);
      } catch (err) {
        console.warn("[Toba nuvem] sem espaço pra cópia local de", key);
      }
    }
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } finally {
    tobaCloudApplying = false;
  }
}

// Os apps guardam o banco na memória: depois de descer da nuvem, recarrega
// (senão a próxima gravação da página passaria por cima do que chegou).
function tobaCloudReloadAfterPull(hadConflict) {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem("toba_cloud_reload")) || 0;
    sessionStorage.setItem("toba_cloud_reload", String(Date.now()));
    sessionStorage.setItem("toba_cloud_reload_msg", hadConflict ? "conflict" : "pull");
  } catch (err) {
    last = 0;
  }
  if (Date.now() - last < 8000) {
    showPageMessage("Chegaram dados da nuvem. Recarrega a página pra ver tudo atualizado.", { title: "☁️ Atualizado", icon: "☁️" });
    return;
  }
  location.reload();
}

/* ---------------------------------------------------------------------
 * Antes do 1º sync: backup geral baixado + cópia "antes" na nuvem
 * ------------------------------------------------------------------- */
async function tobaCloudPreSyncBackup(meta) {
  const uid = TOBA_CLOUD.user.uid;
  const hasLocal = TOBA_CLOUD_KEYS.some(({ key }) => localStorage.getItem(key) !== null);
  if (hasLocal) {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === TOBA_CLOUD_STATE_KEY) continue;
      all[key] = localStorage.getItem(key);
    }
    try {
      tobaDownloadJson(all, `toba_backup_antes_da_nuvem_${typeof toIsoDate === "function" ? toIsoDate() : "hoje"}.json`);
    } catch (err) {
      console.warn("[Toba nuvem] não baixou o backup:", err);
    }
    const state = tobaCloudReadState();
    for (const { key } of TOBA_CLOUD_KEYS) {
      const local = localStorage.getItem(key);
      if (local === null || (meta[key] && meta[key].hash === tobaCloudHash(local))) continue;
      await tobaCloudSaveVersion(key, "antes", local, { id: `${key}_antes_${state.deviceId}` });
    }
  }
  const state = tobaCloudReadState();
  state.presync[uid] = Date.now();
  tobaCloudWriteState(state);
}

/* ---------------------------------------------------------------------
 * Pergunta de conflito (1º login com dados aqui e na nuvem)
 * ------------------------------------------------------------------- */
const TOBA_CLOUD_ASK = { keys: [], meta: {}, choices: {}, resolve: null };

function tobaCloudAskConflicts(keys, meta) {
  ensureTobaCloudUi();
  return new Promise((resolve) => {
    TOBA_CLOUD_ASK.keys = keys;
    TOBA_CLOUD_ASK.meta = meta;
    TOBA_CLOUD_ASK.resolve = resolve;
    TOBA_CLOUD_ASK.choices = {};
    keys.forEach((key) => {
      const localSize = (localStorage.getItem(key) || "").length;
      const cloudSize = Number(meta[key] && meta[key].size) || 0;
      // Sugestão: o lado com mais dados (o outro vira cópia de qualquer jeito).
      TOBA_CLOUD_ASK.choices[key] = localSize >= cloudSize ? "local" : "cloud";
    });
    tobaCloudRenderConflicts();
    openTobaModal("tobaCloudConflictModal");
  });
}

function tobaCloudRenderConflicts() {
  const { keys, meta, choices } = TOBA_CLOUD_ASK;
  document.getElementById("tobaCloudConflictList").innerHTML = keys.map((key) => {
    const localSize = (localStorage.getItem(key) || "").length;
    const m = meta[key] || {};
    return `<div class="tc-conflict">
      <div class="tc-conflict-name">${tobaCloudEsc(tobaCloudKeyName(key))}</div>
      <div class="tc-chips">
        <button type="button" class="tc-chip${choices[key] === "local" ? " is-on" : ""}" data-click="tobaCloudPick" data-key="${key}" data-side="local">📱 Este aparelho<small>${tobaCloudKb(localSize)}</small></button>
        <button type="button" class="tc-chip${choices[key] === "cloud" ? " is-on" : ""}" data-click="tobaCloudPick" data-key="${key}" data-side="cloud">☁️ Nuvem<small>${tobaCloudKb(m.size)} · ${tobaCloudEsc(tobaCloudAgo(m.at))}</small></button>
      </div>
    </div>`;
  }).join("");
}

tobaActions({
  tobaCloudPick: (el) => {
    TOBA_CLOUD_ASK.choices[el.dataset.key] = el.dataset.side;
    tobaCloudRenderConflicts();
  },
  tobaCloudConflictDone: () => {
    closeTobaModal("tobaCloudConflictModal");
    const resolve = TOBA_CLOUD_ASK.resolve;
    TOBA_CLOUD_ASK.resolve = null;
    if (resolve) resolve({ ...TOBA_CLOUD_ASK.choices });
  },
});

/* ---------------------------------------------------------------------
 * Ações da conta
 * ------------------------------------------------------------------- */
async function tobaCloudOpen() {
  ensureTobaCloudUi();
  TOBA_CLOUD.view = "main";
  tobaCloudRender();
  openTobaModal("tobaCloudModal");
  if (!TOBA_CLOUD.auth) {
    TOBA_CLOUD.status = TOBA_CLOUD.status === "off" ? "loading" : TOBA_CLOUD.status;
    tobaCloudRender();
    try {
      await tobaCloudBoot();
    } catch (err) {
      return;
    }
    if (!TOBA_CLOUD.user) TOBA_CLOUD.status = "off";
    tobaCloudRender();
  }
}

function tobaCloudField(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

async function tobaCloudSubmit() {
  const email = tobaCloudField("tcEmail");
  const password = (document.getElementById("tcPassword") || {}).value || "";
  const name = tobaCloudField("tcName");
  const btn = document.getElementById("tcSubmit");
  TOBA_CLOUD.error = "";
  if (!email || !password) {
    TOBA_CLOUD.error = "Preenche o e-mail e a senha.";
    return tobaCloudRender();
  }
  if (btn) btn.disabled = true;
  try {
    await tobaCloudBoot();
    if (TOBA_CLOUD.mode === "signup") {
      const cred = await TOBA_CLOUD.auth.createUserWithEmailAndPassword(email, password);
      if (name) await cred.user.updateProfile({ displayName: name });
      cred.user.sendEmailVerification().catch(() => {});
      tobaToast("🎉 Conta criada! Confere teu e-mail.");
    } else {
      await TOBA_CLOUD.auth.signInWithEmailAndPassword(email, password);
      tobaToast("👊 Entrou!");
    }
  } catch (err) {
    TOBA_CLOUD.error = tobaCloudErrorText(err);
  } finally {
    if (btn) btn.disabled = false;
    tobaCloudRender();
  }
}

async function tobaCloudGoogle() {
  TOBA_CLOUD.error = "";
  try {
    await tobaCloudBoot();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await TOBA_CLOUD.auth.signInWithPopup(provider);
    } catch (err) {
      if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) {
        await TOBA_CLOUD.auth.signInWithRedirect(provider);
        return;
      }
      throw err;
    }
  } catch (err) {
    TOBA_CLOUD.error = tobaCloudErrorText(err);
  }
  tobaCloudRender();
}

async function tobaCloudForgot() {
  const email = tobaCloudField("tcEmail");
  if (!email) {
    TOBA_CLOUD.error = "Digita teu e-mail ali em cima que eu mando o link.";
    return tobaCloudRender();
  }
  try {
    await tobaCloudBoot();
    await TOBA_CLOUD.auth.sendPasswordResetEmail(email);
    TOBA_CLOUD.error = "";
    showPageMessage(`Se existir conta com ${email}, o link pra criar senha nova chegou lá. Olha o spam também.`, { title: "📨 Mandei!", icon: "📨" });
  } catch (err) {
    TOBA_CLOUD.error = tobaCloudErrorText(err);
  }
  tobaCloudRender();
}

async function tobaCloudAddPassword() {
  const password = (document.getElementById("tcNewPassword") || {}).value || "";
  if (password.length < 6) {
    TOBA_CLOUD.error = "Senha com pelo menos 6 caracteres.";
    return tobaCloudRender();
  }
  try {
    const user = TOBA_CLOUD.user;
    await user.linkWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, password));
    await user.reload();
    TOBA_CLOUD.user = TOBA_CLOUD.auth.currentUser;
    TOBA_CLOUD.error = "";
    TOBA_CLOUD.view = "main";
    showPageMessage(`Pronto! No app Android, entra com ${user.email} e essa senha.`, { title: "🔑 Senha criada", icon: "🔑" });
  } catch (err) {
    TOBA_CLOUD.error = tobaCloudErrorText(err);
  }
  tobaCloudRender();
}

async function tobaCloudSignOut() {
  const ok = await showPageMessage(
    "Seus dados continuam neste aparelho, só param de ir pra nuvem. Pra voltar, é só entrar de novo.",
    { title: "Sair da conta?", confirm: true, confirmLabel: "Sair", danger: false },
  );
  if (!ok) return;
  await tobaCloudSync("logout");
  await TOBA_CLOUD.auth.signOut();
  tobaToast("👋 Saiu da conta");
}

function tobaCloudToggleKey(el) {
  const state = tobaCloudReadState();
  const keys = el.dataset.group === "prefs"
    ? TOBA_CLOUD_KEYS.filter((item) => item.group === "prefs").map((item) => item.key)
    : [el.dataset.key];
  const turnOff = !state.off[keys[0]];
  keys.forEach((key) => {
    if (turnOff) state.off[key] = true;
    else delete state.off[key];
  });
  tobaCloudWriteState(state);
  tobaCloudRender();
  if (!turnOff) tobaCloudSync("toggle");
}

async function tobaCloudLoadVersions() {
  TOBA_CLOUD.view = "versions";
  TOBA_CLOUD.versions = null;
  tobaCloudRender();
  try {
    const snap = await tobaCloudUserRef().collection("versions").orderBy("at", "desc").limit(80).get();
    TOBA_CLOUD.versions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    TOBA_CLOUD.versions = [];
    TOBA_CLOUD.error = tobaCloudErrorText(err);
  }
  tobaCloudRender();
}

async function tobaCloudDownloadVersion(el) {
  const item = (TOBA_CLOUD.versions || []).find((v) => v.id === el.dataset.id);
  if (!item) return;
  try {
    const value = await tobaCloudReadChunks(`ver_${item.id}`, Number(item.chunks) || 1);
    const day = new Date(item.at);
    const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    tobaDownloadJson({ [item.key]: value }, `toba_nuvem_${item.key}_${item.kind}_${stamp}.json`);
    showPageMessage(
      "Baixei no formato do backup geral. Pra voltar essa versão: portal ⚙️ › Dados & Backup › Restaurar backup.",
      { title: "📥 Versão baixada", icon: "📥" },
    );
  } catch (err) {
    showPageMessage(tobaCloudErrorText(err), { title: "Não baixou", icon: "💥" });
  }
}

async function tobaCloudDownloadAll() {
  try {
    const all = {};
    for (const { key } of TOBA_CLOUD_KEYS) {
      const data = await tobaCloudReadKey(key);
      if (data) all[key] = data.value;
    }
    if (!Object.keys(all).length) {
      showPageMessage("A nuvem ainda está vazia.", { title: "Nada lá", icon: "🫥" });
      return;
    }
    tobaDownloadJson(all, `toba_backup_da_nuvem_${typeof toIsoDate === "function" ? toIsoDate() : "hoje"}.json`);
  } catch (err) {
    showPageMessage(tobaCloudErrorText(err), { title: "Não baixou", icon: "💥" });
  }
}

tobaActions({
  tobaCloudOpen,
  tobaCloudSubmit,
  tobaCloudGoogle,
  tobaCloudForgot,
  tobaCloudAddPassword,
  tobaCloudSignOut,
  tobaCloudToggleKey,
  tobaCloudLoadVersions,
  tobaCloudDownloadVersion,
  tobaCloudDownloadAll,
  tobaCloudSyncNow: () => tobaCloudSync("manual"),
  tobaCloudMode: (el) => {
    TOBA_CLOUD.mode = el.dataset.mode;
    TOBA_CLOUD.error = "";
    tobaCloudRender();
  },
  tobaCloudView: (el) => {
    TOBA_CLOUD.view = el.dataset.view;
    TOBA_CLOUD.error = "";
    tobaCloudRender();
  },
});

/* ---------------------------------------------------------------------
 * Tela
 * ------------------------------------------------------------------- */
const TOBA_CLOUD_HTML = `
<div class="toba-modal" id="tobaCloudModal" role="dialog" aria-modal="true" aria-labelledby="tobaCloudTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="tobaCloudTitle">☁️ Conta Toba</h3>
      <button type="button" class="close-btn" data-close aria-label="Fechar">✕</button>
    </div>
    <div id="tobaCloudBody"></div>
    <div class="toba-sheet-footer" id="tobaCloudFooter"></div>
  </div>
</div>
<div class="toba-modal" id="tobaCloudConflictModal" data-backdrop="static" role="dialog" aria-modal="true" aria-labelledby="tobaCloudConflictTitle">
  <div class="toba-sheet">
    <div class="toba-sheet-header">
      <h3 id="tobaCloudConflictTitle">🤔 Com qual eu fico?</h3>
    </div>
    <p class="toba-sheet-text">Esses apps têm dados aqui <b>e</b> na nuvem, e não batem. Escolhe qual vale. O outro não some: vira uma versão guardada na nuvem (☁️ Conta › 🕰️ Versões guardadas).</p>
    <div id="tobaCloudConflictList"></div>
    <div class="toba-sheet-footer">
      <button type="button" class="btn btn-primary" data-click="tobaCloudConflictDone">Pronto</button>
    </div>
  </div>
</div>`;

function ensureTobaCloudUi() {
  if (!document.getElementById("tobaCloudModal")) document.body.insertAdjacentHTML("beforeend", TOBA_CLOUD_HTML);
  // Item na ⚙️ de todas as páginas
  const settings = document.getElementById("settingsModal");
  if (settings && !document.getElementById("tobaCloudSettingsItem")) {
    const slot = settings.querySelector("#tobaSettingsSlot");
    const html = `<div class="toba-settings-section" id="tobaCloudSettingsItem">
      <div class="toba-settings-label">☁️ Conta</div>
      <button type="button" class="toba-menu-btn" data-click="tobaCloudOpen">
        <span class="toba-menu-icon">☁️</span>
        <span class="toba-menu-text">
          <span class="toba-menu-title">Conta Toba</span>
          <span class="toba-menu-desc" id="tobaCloudSettingsDesc">Entrar e salvar tudo na nuvem</span>
        </span>
        <span class="toba-hub-chevron">›</span>
      </button>
    </div>`;
    if (slot) slot.insertAdjacentHTML("beforebegin", html);
  }
}

function tobaCloudStatusLine() {
  const state = tobaCloudReadState();
  const pending = TOBA_CLOUD_KEYS.some(({ key }) => !state.off[key] && state.keys[key] &&
    tobaCloudHash(localStorage.getItem(key)) !== state.keys[key].hash);
  switch (TOBA_CLOUD.status) {
    case "loading": return { icon: "⏳", text: "Chamando a nuvem..." };
    case "syncing": return { icon: "🔄", text: "Sincronizando..." };
    case "offline": return { icon: "📴", text: "Sem internet: salvo aqui, sobe depois" };
    case "error": return { icon: "⚠️", text: "Deu ruim no último envio" };
    default:
      if (!TOBA_CLOUD.user) return { icon: "☁️", text: "Entrar e salvar tudo na nuvem" };
      if (pending) return { icon: "⏳", text: "Tem mudança esperando pra subir" };
      return { icon: "✅", text: `Tudo na nuvem · ${tobaCloudAgo(state.lastSync)}` };
  }
}

function tobaCloudRender() {
  // Botão do portal e item da ⚙️
  const line = tobaCloudStatusLine();
  const portalBtn = document.getElementById("tobaCloudBtn");
  if (portalBtn) {
    portalBtn.textContent = TOBA_CLOUD.user ? (line.icon === "✅" ? "☁️" : line.icon) : "☁️";
    portalBtn.classList.toggle("is-on", Boolean(TOBA_CLOUD.user));
    portalBtn.setAttribute("aria-label", `Conta Toba: ${line.text}`);
  }
  const desc = document.getElementById("tobaCloudSettingsDesc");
  if (desc) desc.textContent = TOBA_CLOUD.user ? `${TOBA_CLOUD.user.email} · ${line.text}` : line.text;

  const body = document.getElementById("tobaCloudBody");
  const footer = document.getElementById("tobaCloudFooter");
  if (!body || !footer) return;
  const err = TOBA_CLOUD.error ? `<div class="tc-error">${tobaCloudEsc(TOBA_CLOUD.error)}</div>` : "";

  if (TOBA_CLOUD.status === "loading" && !TOBA_CLOUD.auth) {
    body.innerHTML = `<p class="toba-sheet-text">⏳ Chamando a nuvem...</p>${err}`;
    footer.innerHTML = "";
    return;
  }

  if (!TOBA_CLOUD.user) {
    // Redesenhar (erro, troca Entrar/Criar) não pode apagar o que já foi digitado.
    const typed = {};
    ["tcName", "tcEmail", "tcPassword"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) typed[id] = el.value;
    });
    const signup = TOBA_CLOUD.mode === "signup";
    const google = typeof tobaIsApp === "function" && tobaIsApp()
      ? `<p class="tc-hint">No app Android, o Google não deixa entrar com ele aqui dentro. Entrou com Google no Chrome? Lá em ☁️ Conta tem "Criar senha pro app".</p>`
      : `<button type="button" class="btn btn-secondary tc-google" data-click="tobaCloudGoogle">Entrar com Google</button>`;
    body.innerHTML = `
      <p class="toba-sheet-text">Com conta, teu Toba fica salvo na nuvem e aparece em qualquer celular ou PC. Sem conta, continua tudo só neste aparelho, igual sempre. 😎</p>
      <div class="tc-chips tc-mode">
        <button type="button" class="tc-chip${signup ? "" : " is-on"}" data-click="tobaCloudMode" data-mode="login">Entrar</button>
        <button type="button" class="tc-chip${signup ? " is-on" : ""}" data-click="tobaCloudMode" data-mode="signup">Criar conta</button>
      </div>
      ${signup ? `<div class="form-group"><label for="tcName">Como te chamam?</label><input class="form-control" id="tcName" autocomplete="nickname" maxlength="40" placeholder="Rafa" /></div>` : ""}
      <div class="form-group"><label for="tcEmail">E-mail</label><input class="form-control" id="tcEmail" type="email" inputmode="email" autocomplete="email" placeholder="voce@gmail.com" /></div>
      <div class="form-group"><label for="tcPassword">Senha</label><input class="form-control" id="tcPassword" type="password" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? "pelo menos 6 caracteres" : "tua senha"}" /></div>
      ${err}
      ${signup ? "" : `<button type="button" class="chip-btn tc-forgot" data-click="tobaCloudForgot">🤡 Esqueci a senha</button>`}
      <div class="tc-or">ou</div>
      ${google}`;
    footer.innerHTML = `<button type="button" class="btn btn-primary" id="tcSubmit" data-click="tobaCloudSubmit">${signup ? "🎉 Criar conta" : "👊 Entrar"}</button>`;
    Object.keys(typed).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = typed[id];
    });
    return;
  }

  const user = TOBA_CLOUD.user;
  const state = tobaCloudReadState();

  if (TOBA_CLOUD.view === "password") {
    body.innerHTML = `
      <button type="button" class="back-nav-btn" data-click="tobaCloudView" data-view="main">‹ Conta</button>
      <p class="toba-sheet-text">Cria uma senha pra entrar com <b>${tobaCloudEsc(user.email)}</b> no app Android (lá dentro o Google não deixa). É a mesma conta, com os mesmos dados.</p>
      <div class="form-group"><label for="tcNewPassword">Senha nova</label><input class="form-control" id="tcNewPassword" type="password" autocomplete="new-password" placeholder="pelo menos 6 caracteres" /></div>
      ${err}`;
    footer.innerHTML = `<button type="button" class="btn btn-primary" data-click="tobaCloudAddPassword">🔑 Criar senha</button>`;
    return;
  }

  if (TOBA_CLOUD.view === "versions") {
    const kinds = { antes: "🧳 Antes da nuvem", dia: "📅 Cópia do dia", conflito: "⚔️ Conflito", apagado: "🗑️ Antes de apagar" };
    const list = TOBA_CLOUD.versions;
    body.innerHTML = `
      <button type="button" class="back-nav-btn" data-click="tobaCloudView" data-view="main">‹ Conta</button>
      <p class="toba-sheet-text">Cópias que a nuvem guardou. Toca pra baixar e restaurar pelo portal (⚙️ › Dados & Backup › Restaurar).</p>
      ${err}
      ${list === null ? `<p class="toba-sheet-text">⏳ Buscando...</p>` : list.length === 0 ? `<p class="toba-sheet-text">Nenhuma cópia ainda.</p>` : `<div class="toba-menu">${list.map((v) => `
        <button type="button" class="toba-menu-btn" data-click="tobaCloudDownloadVersion" data-id="${tobaCloudEsc(v.id)}">
          <span class="toba-menu-icon">${tobaCloudEsc(tobaCloudKeyInfo(v.key).emoji || "📦")}</span>
          <span class="toba-menu-text">
            <span class="toba-menu-title">${tobaCloudEsc(tobaCloudKeyName(v.key))} · ${tobaCloudEsc(kinds[v.kind] || v.kind)}</span>
            <span class="toba-menu-desc">${tobaCloudEsc(tobaCloudAgo(v.at))} · ${tobaCloudEsc(v.device || "")} · ${tobaCloudKb(v.size)}</span>
          </span>
          <span class="toba-hub-chevron">📥</span>
        </button>`).join("")}</div>`}`;
    footer.innerHTML = "";
    return;
  }

  const hasPassword = (user.providerData || []).some((p) => p && p.providerId === "password");
  const appChips = TOBA_CLOUD_KEYS.filter((item) => item.label).map((item) => {
    const on = !state.off[item.key];
    const groupAttr = item.group === "prefs" ? ` data-group="prefs"` : "";
    return `<button type="button" class="tc-chip${on ? " is-on" : ""}" data-click="tobaCloudToggleKey" data-key="${item.key}"${groupAttr}>${item.emoji} ${tobaCloudEsc(item.label)}</button>`;
  }).join("");
  body.innerHTML = `
    <div class="tc-user">
      <div class="tc-avatar">${tobaCloudEsc(((user.displayName || user.email || "?").trim()[0] || "?").toUpperCase())}</div>
      <div>
        <div class="tc-user-name">${tobaCloudEsc(user.displayName || "Jogador Toba")}</div>
        <div class="tc-user-mail">${tobaCloudEsc(user.email || "")}</div>
      </div>
    </div>
    <div class="tc-status">${line.icon} ${tobaCloudEsc(line.text)}</div>
    ${err}
    <div class="toba-settings-label">Vai pra nuvem</div>
    <div class="tc-chips">${appChips}</div>
    <p class="tc-hint">Desligado = esse app fica só neste aparelho.</p>
    <div class="toba-menu">
      <button type="button" class="toba-menu-btn" data-click="tobaCloudSyncNow">
        <span class="toba-menu-icon">🔄</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Sincronizar agora</span><span class="toba-menu-desc">Sobe o que mudou aqui e baixa o que mudou fora</span></span>
      </button>
      <button type="button" class="toba-menu-btn" data-click="tobaCloudLoadVersions">
        <span class="toba-menu-icon">🕰️</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Versões guardadas</span><span class="toba-menu-desc">Cópia de cada dia (7 dias), de conflito e de antes da nuvem</span></span>
        <span class="toba-hub-chevron">›</span>
      </button>
      <button type="button" class="toba-menu-btn" data-click="tobaCloudDownloadAll">
        <span class="toba-menu-icon">📥</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Baixar backup da nuvem</span><span class="toba-menu-desc">Um .json no formato do backup geral</span></span>
      </button>
      ${hasPassword ? "" : `<button type="button" class="toba-menu-btn" data-click="tobaCloudView" data-view="password">
        <span class="toba-menu-icon">🔑</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Criar senha pro app</span><span class="toba-menu-desc">Pra entrar com essa conta no app Android</span></span>
        <span class="toba-hub-chevron">›</span>
      </button>`}
      <button type="button" class="toba-menu-btn" data-click="tobaCloudSignOut">
        <span class="toba-menu-icon">🚪</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Sair da conta</span><span class="toba-menu-desc">Os dados ficam neste aparelho</span></span>
      </button>
    </div>`;
  footer.innerHTML = "";
}

/* ---------------------------------------------------------------------
 * Partida
 * ------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Depois do DOMContentLoaded do toba-common (a ⚙️ já existe).
  setTimeout(() => {
    ensureTobaCloudUi();
    tobaCloudRender();
    let msg = null;
    try {
      msg = sessionStorage.getItem("toba_cloud_reload_msg");
      sessionStorage.removeItem("toba_cloud_reload_msg");
    } catch (err) {
      msg = null;
    }
    if (msg === "pull") tobaToast("☁️ Atualizado com a nuvem");
    if (msg === "conflict") tobaToast("☁️ Atualizado · a outra versão ficou guardada");
    // Só baixa o Firebase se este aparelho já entrou numa conta.
    if (tobaCloudReadState().uid) tobaCloudBoot().catch(() => {});
  }, 0);
});

window.addEventListener("online", () => tobaCloudSync("online"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !TOBA_CLOUD.user) return;
  if (Date.now() - (TOBA_CLOUD.lastSync || 0) > 30000) tobaCloudSync("visible");
});
