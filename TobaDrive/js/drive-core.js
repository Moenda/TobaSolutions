/* =====================================================================
 * Toba Drive · núcleo do app (desde v1.65)
 * - Depende de ../assets/toba-common.js (datas, avisos, ⚙️).
 * - Banco único no localStorage: "TOBA_DRIVE_DB". Depois de publicado,
 *   NUNCA mude a chave nem renomeie campos (ver CLAUDE.md, seção 3.14).
 * - Cada página define onDriveDataReplaced() para redesenhar a tela
 *   depois de importar backup ou apagar tudo.
 * ===================================================================== */
const DRIVE_KEY = "TOBA_DRIVE_DB";
const DRIVE_BACKUP_KEY = "TOBA_DRIVE_DB_AUTO_BACKUP";
const DRIVE_RECENT_MAX = 12;
const DRIVE_TRIPS_MAX = 500;

// Trava: fica false se o banco salvo estiver ilegível, para não sobrescrever.
let isDriveDbLoaded = false;

function createEmptyDriveDb() {
  return {
    version: 1,
    favorites: [], // [{ id: "fv-..", name, emoji, lat, lng, address, createdAt }]
    recent: [], // [{ name, address, lat, lng, at (ms), placeId? }] (mais novo primeiro)
    trips: [], // [{ id: "t-..", date, startedAt, endedAt, name, lat, lng, km, arrived }]
  };
}

function driveNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function driveValidPoint(p) {
  return p && driveNum(p.lat) !== null && driveNum(p.lng) !== null && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

// "Migração": todo campo novo ganha default AQUI (load e import passam por ela).
function normalizeDriveDb(db) {
  const base = createEmptyDriveDb();
  const out = { ...base, ...(db && typeof db === "object" ? db : {}) };
  out.favorites = (Array.isArray(out.favorites) ? out.favorites : []).filter(driveValidPoint).map((f) => ({
    id: String(f.id || `fv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    name: String(f.name || "Favorito"),
    emoji: String(f.emoji || "⭐"),
    lat: Number(f.lat),
    lng: Number(f.lng),
    address: String(f.address || ""),
    createdAt: Number(f.createdAt) || 0,
  }));
  out.recent = (Array.isArray(out.recent) ? out.recent : []).filter(driveValidPoint).map((r) => ({
    ...r,
    name: String(r.name || "Destino"),
    address: String(r.address || ""),
    lat: Number(r.lat),
    lng: Number(r.lng),
    at: Number(r.at) || 0,
  }));
  out.trips = (Array.isArray(out.trips) ? out.trips : []).filter((t) => t && typeof t.date === "string");
  out.trips.forEach((t) => {
    t.km = Number(t.km) || 0;
    t.arrived = Boolean(t.arrived);
  });
  return out;
}

function loadDriveDb() {
  const raw = localStorage.getItem(DRIVE_KEY);
  if (!raw) {
    isDriveDbLoaded = true;
    return createEmptyDriveDb();
  }
  try {
    const db = normalizeDriveDb(JSON.parse(raw));
    isDriveDbLoaded = true;
    return db;
  } catch (err) {
    console.error("Banco do Drive ilegível; gravação travada.", err);
    return createEmptyDriveDb();
  }
}

let driveDb = loadDriveDb();

function saveDriveDb(options = {}) {
  if (!isDriveDbLoaded) return false;
  try {
    const previous = localStorage.getItem(DRIVE_KEY);
    if (previous) localStorage.setItem(DRIVE_BACKUP_KEY, previous);
    localStorage.setItem(DRIVE_KEY, JSON.stringify(driveDb));
  } catch (err) {
    showPageMessage("A memória do navegador encheu e isso não foi salvo. Baixe um backup e libere espaço.", { title: "Não salvou", icon: "💾" });
    return false;
  }
  if (!options.silent) tobaSaved();
  return true;
}

function driveNewId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Destino escolhido vai pro topo dos recentes (mesmo ponto não repete)
function driveRememberRecent(dest) {
  if (!driveValidPoint(dest)) return;
  const same = (r) => driveDist([r.lat, r.lng], [dest.lat, dest.lng]) < 40;
  driveDb.recent = [
    { name: dest.name || "Destino", address: dest.address || "", lat: Number(dest.lat), lng: Number(dest.lng), at: Date.now(), ...(dest.placeId ? { placeId: String(dest.placeId) } : {}) },
    ...driveDb.recent.filter((r) => !same(r)),
  ].slice(0, DRIVE_RECENT_MAX);
  saveDriveDb({ silent: true });
}

function driveAddTrip(trip) {
  driveDb.trips.push({ id: driveNewId("t"), ...trip });
  if (driveDb.trips.length > DRIVE_TRIPS_MAX) driveDb.trips = driveDb.trips.slice(-DRIVE_TRIPS_MAX);
  saveDriveDb({ silent: true });
}

function onDriveDataReplaced() {}

/* Backup do app (objeto do banco puro; não confundir com o backup geral) */
function exportDriveBackup() {
  tobaDownloadJson(driveDb, `toba_drive_backup_${toIsoDate()}.json`);
}

async function importDriveBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!data || !Array.isArray(data.favorites) || !Array.isArray(data.trips)) throw new Error("Não é backup do Drive");
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Toba Drive.", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  driveDb = normalizeDriveDb(data);
  isDriveDbLoaded = true;
  saveDriveDb({ silent: true });
  closeDataModal();
  onDriveDataReplaced();
  showPageMessage("Backup restaurado!", { title: "Tudo de volta", icon: "✅" });
}

async function resetDriveData() {
  const ok = await showPageMessage("Apaga TUDO do Toba Drive (favoritos, recentes e viagens). Não dá para desfazer!", { title: "Apagar tudo?", icon: "🚨", confirm: true, confirmLabel: "Apagar tudo" });
  if (!ok) return;
  localStorage.removeItem(DRIVE_KEY); // só a chave deste app
  driveDb = createEmptyDriveDb();
  isDriveDbLoaded = true;
  closeDataModal();
  onDriveDataReplaced();
}

// Abre Maps/Waze: no APK vai pelo próprio WebView (ele manda pro app certo)
function driveOpenExternal(url) {
  if (!url) return;
  if (tobaIsApp()) {
    window.location.href = url;
    return;
  }
  const win = window.open(url, "_blank", "noopener");
  if (!win) window.location.href = url;
}

tobaSetupApp({
  name: "Toba Drive",
  exportBackup: exportDriveBackup,
  importBackup: importDriveBackup,
  resetData: resetDriveData,
});

if (!isDriveDbLoaded) {
  showPageMessage("Não consegui ler os dados salvos, então nada será gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
}
