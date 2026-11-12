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
    trips: [], // [{ id: "t-..", date, startedAt, endedAt, name, lat, lng, km, arrived, etaS?, source?: "auto", autoAt?, autoAts? (v2.03), joined? (v2.03: quantos pedaços), stops?/stopMs?/stopNames? (v2.05: paradas no caminho), parts? (v2.05: pedaços originais de um 🔗 Juntar, pro ✂️ Separar) }]
    autoSkip: [], // v2.02: "at" das viagens do Android Auto que foram apagadas (não voltam no import)
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
  out.autoSkip = (Array.isArray(out.autoSkip) ? out.autoSkip : []).map(Number).filter((n) => n > 0).slice(-400);
  out.trips.forEach((t) => {
    t.km = Number(t.km) || 0;
    t.arrived = Boolean(t.arrived);
    if (t.etaS !== undefined) t.etaS = Math.max(0, Math.round(Number(t.etaS) || 0)); // v1.67: previsão no Partiu
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

// v2.02 (APK 2.7): rota feita só no Android Auto entra no histórico (tobaMergeAutoTrips do toba-common).
// Com esta página aberta o import é aqui, no driveDb da memória (o toba-common não grava por cima).
window.TOBA_DRIVE_LIVE = true;
function driveImportAutoTrips() {
  if (!isDriveDbLoaded || typeof tobaMergeAutoTrips !== "function") return 0;
  const n = tobaMergeAutoTrips(driveDb);
  if (n) saveDriveDb({ silent: true });
  return n;
}

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
  if (typeof tobaShareDriveFavs === "function") tobaShareDriveFavs(driveDb); // v1.80: ⭐ no Android Auto
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

// v2.03: a viagem caiu no meio e tu seguiu pro MESMO destino em até 15 min sem ter chegado
// (tobaTripToContinue do toba-common)? gruda na anterior: uma viagem só, km somados.
// Devolve a viagem gravada (a nova ou a anterior que cresceu).
function driveAddTrip(trip) {
  const prev = typeof tobaTripToContinue === "function" ? tobaTripToContinue(driveDb.trips, trip) : null;
  if (prev) {
    tobaJoinTrip(prev, trip);
    if (trip.autoAt && typeof tobaTripAddAutoAt === "function") tobaTripAddAutoAt(prev, Number(trip.autoAt));
    saveDriveDb({ silent: true });
    return prev;
  }
  driveDb.trips.push({ id: driveNewId("t"), ...trip });
  if (driveDb.trips.length > DRIVE_TRIPS_MAX) driveDb.trips = driveDb.trips.slice(-DRIVE_TRIPS_MAX);
  saveDriveDb({ silent: true });
  return driveDb.trips[driveDb.trips.length - 1];
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

driveImportAutoTrips();

tobaSetupApp({
  name: "Toba Drive",
  exportBackup: exportDriveBackup,
  importBackup: importDriveBackup,
  resetData: resetDriveData,
});

if (!isDriveDbLoaded) {
  showPageMessage("Não consegui ler os dados salvos, então nada será gravado por cima. Restaure um backup em ⚙️.", { title: "Dados protegidos", icon: "🛡️" });
}
