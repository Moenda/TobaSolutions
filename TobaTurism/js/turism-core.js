/* =====================================================================
 * Toba Turism · núcleo do app (desde v1.55)
 * - Depende de ../assets/toba-common.js e de turism-metrics.js (regras).
 * - Banco único no localStorage: "TOBA_TURISM_DB". Depois de publicado,
 *   NUNCA mude a chave nem renomeie campos (ver CLAUDE.md, seção 3.13).
 * - Cada página define onTurismDataReplaced() para redesenhar a tela
 *   depois de importar backup ou apagar tudo.
 * ===================================================================== */
const TURISM_KEY = "TOBA_TURISM_DB";
const TURISM_BACKUP_KEY = "TOBA_TURISM_DB_AUTO_BACKUP";

// Trava: fica false se o banco salvo estiver ilegível, para não sobrescrever.
let isTurismDbLoaded = false;

function createEmptyTurismDb() {
  return {
    version: 1,
    lists: [], // [{ id: "l-<ts>-<rand4>", name, emoji, city, createdAt: ms }]
    places: [], // [{ id: "p-<ts>-<rand4>", listId, name, url, address, note, tags: [keys de TURISM_TAGS],
    //             status: "want"|"been", rating: key de TURISM_RATINGS|null, visitedAt: "AAAA-MM-DD"|null, addedAt: ms,
    //             v1.56: kind: key de TURISM_KINDS|null, value: key de TURISM_VALUES|null, again: "sim"|"nao"|null,
    //                    lat/lng: number|null (pino do 🗺️ Mapa), geoMiss: bool (busca automática não achou) }]
  };
}

// "Migração": todo campo novo ganha default AQUI (load e import passam por ela).
function normalizeTurismDb(db) {
  const base = createEmptyTurismDb();
  const out = { ...base, ...(db && typeof db === "object" && !Array.isArray(db) ? db : {}) };
  out.lists = Array.isArray(out.lists) ? out.lists.filter((l) => l && typeof l === "object" && l.id !== undefined) : [];
  out.lists.forEach((l) => {
    l.id = String(l.id);
    if (l.name === undefined) l.name = "Lista sem nome";
    if (l.emoji === undefined) l.emoji = "📍";
    if (l.city === undefined) l.city = "";
    if (l.createdAt === undefined) l.createdAt = 0;
  });
  out.places = Array.isArray(out.places) ? out.places.filter((p) => p && typeof p === "object" && p.id !== undefined) : [];
  out.places.forEach((p) => {
    p.id = String(p.id);
    p.listId = String(p.listId ?? "");
    if (p.name === undefined) p.name = "";
    if (p.url === undefined) p.url = "";
    if (p.address === undefined) p.address = "";
    if (p.note === undefined) p.note = "";
    if (!Array.isArray(p.tags)) p.tags = [];
    if (p.status !== "been") p.status = "want";
    if (p.rating === undefined) p.rating = null;
    if (p.visitedAt === undefined) p.visitedAt = null;
    if (p.addedAt === undefined) p.addedAt = 0;
    // v1.56
    if (p.kind === undefined) p.kind = null;
    if (p.value === undefined) p.value = null;
    if (p.again === undefined) p.again = null;
    if (p.lat === undefined || p.lng === undefined || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)) || p.lat === null || p.lng === null) {
      p.lat = null;
      p.lng = null;
    } else {
      p.lat = Number(p.lat);
      p.lng = Number(p.lng);
    }
    if (p.geoMiss === undefined) p.geoMiss = false;
    // Sem pino mas o link comprido do Maps tem a coordenada: usa ela (só em memória até a próxima gravação)
    if (p.lat === null) {
      const coords = turismCoordsFromUrl(p.url);
      if (coords) Object.assign(p, coords);
    }
  });
  return out;
}

function loadTurismDb() {
  const raw = localStorage.getItem(TURISM_KEY);
  if (!raw) {
    isTurismDbLoaded = true;
    return createEmptyTurismDb();
  }
  try {
    const db = normalizeTurismDb(JSON.parse(raw));
    isTurismDbLoaded = true;
    return db;
  } catch (err) {
    console.error("Banco do Turism ilegível; gravação travada.", err);
    return createEmptyTurismDb();
  }
}

let turismDb = loadTurismDb();

function saveTurismDb(options = {}) {
  if (!isTurismDbLoaded) {
    showPageMessage("Os dados salvos do Tourism estão ilegíveis, então nada foi gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
    return false;
  }
  try {
    const previous = localStorage.getItem(TURISM_KEY);
    if (previous) localStorage.setItem(TURISM_BACKUP_KEY, previous);
    localStorage.setItem(TURISM_KEY, JSON.stringify(turismDb));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (!options.silent) tobaSaved();
  return true;
}

function turismNewId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Abre link de fora (Google Maps). No app Android o WebView manda pro app do Maps.
function turismOpenExternal(url) {
  if (!url) return;
  if (tobaIsApp()) {
    window.location.href = url;
    return;
  }
  const win = window.open(url, "_blank", "noopener");
  if (!win) window.location.href = url;
}

function onTurismDataReplaced() {}

/* Backup do app (objeto do banco puro; não confundir com o backup geral) */
function exportTurismBackup() {
  tobaDownloadJson(turismDb, `toba_turism_backup_${toIsoDate()}.json`);
}

async function importTurismBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!data || typeof data !== "object" || !Array.isArray(data.lists) || !Array.isArray(data.places)) throw new Error("Não é backup do Turism");
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Toba Tourism.", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  turismDb = normalizeTurismDb(data);
  isTurismDbLoaded = true;
  saveTurismDb({ silent: true });
  closeDataModal();
  onTurismDataReplaced();
  showPageMessage("Backup restaurado!", { title: "Tudo de volta", icon: "✅" });
}

async function resetTurismData() {
  const ok = await showPageMessage("Apaga TUDO do Toba Tourism (todas as listas e lugares). Não dá para desfazer!", { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" });
  if (!ok) return;
  localStorage.removeItem(TURISM_KEY); // só a chave deste app
  turismDb = createEmptyTurismDb();
  isTurismDbLoaded = true;
  closeDataModal();
  onTurismDataReplaced();
}

tobaSetupApp({
  name: "Toba Tourism",
  exportBackup: exportTurismBackup,
  importBackup: importTurismBackup,
  resetData: resetTurismData,
});

if (!isTurismDbLoaded) {
  showPageMessage("Não consegui ler os dados salvos, então nada será gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
}
