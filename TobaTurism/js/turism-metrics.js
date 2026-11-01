/* =====================================================================
 * Toba Turism · regras puras (desde v1.55)
 * - Só LÊ o banco (recebe por parâmetro); nunca grava. Usado no hub, no
 *   Toba Places e no card do portal (que carrega este arquivo sozinho).
 * - As keys de TURISM_TAGS e TURISM_RATINGS ficam gravadas nos lugares:
 *   nunca renomeie; item novo = linha nova (ver CLAUDE.md, seção 3.13).
 * ===================================================================== */

// "Por que entrou na lista?" (vários por lugar)
const TURISM_TAGS = [
  { key: "insta", icon: "📸", label: "Vi no insta" },
  { key: "tiktok", icon: "🎵", label: "Vi no TikTok" },
  { key: "indicacao", icon: "🗣️", label: "Indicação" },
  { key: "passei", icon: "👀", label: "Passei na frente" },
  { key: "nota", icon: "⭐", label: "Nota alta" },
  { key: "date", icon: "💑", label: "Date" },
  { key: "tropa", icon: "👥", label: "Com a tropa" },
  { key: "barato", icon: "💸", label: "Barato" },
  { key: "especial", icon: "💎", label: "Ocasião especial" },
  { key: "trampo", icon: "💻", label: "Dá pra trampar" },
  { key: "pet", icon: "🐾", label: "Aceita pet" },
  { key: "noite", icon: "🌙", label: "Abre tarde" },
];

// Nota de quem já foi (uma por lugar)
const TURISM_RATINGS = [
  { key: "top", icon: "🔥", label: "Top demais" },
  { key: "bom", icon: "👍", label: "Bom" },
  { key: "ok", icon: "😐", label: "Ok" },
  { key: "nem", icon: "💩", label: "Nem vale" },
];

function turismTag(key) {
  return TURISM_TAGS.find((t) => t.key === key) || null;
}

function turismRating(key) {
  return TURISM_RATINGS.find((r) => r.key === key) || null;
}

// Aceita o banco cru (portal) ou já normalizado (páginas).
function turismSafeDb(db) {
  const ok = db && typeof db === "object" && !Array.isArray(db);
  return {
    lists: ok && Array.isArray(db.lists) ? db.lists.filter((l) => l && typeof l === "object") : [],
    places: ok && Array.isArray(db.places) ? db.places.filter((p) => p && typeof p === "object") : [],
  };
}

function turismListStats(db, listId) {
  const { places } = turismSafeDb(db);
  const mine = places.filter((p) => String(p.listId) === String(listId));
  const been = mine.filter((p) => p.status === "been").length;
  return { total: mine.length, been, want: mine.length - been };
}

function calcTurismSummary(db) {
  const { lists, places } = turismSafeDb(db);
  const listIds = new Set(lists.map((l) => String(l.id)));
  const live = places.filter((p) => listIds.has(String(p.listId)));
  const been = live.filter((p) => p.status === "been");
  const cities = [...new Set(lists.map((l) => String(l.city || "").trim()).filter(Boolean))];
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    lists: lists.length,
    places: live.length,
    want: live.length - been.length,
    been: been.length,
    top: been.filter((p) => p.rating === "top").length,
    cities,
    beenThisMonth: been.filter((p) => String(p.visitedAt || "").slice(0, 7) === monthKey).length,
  };
}

// Link pra abrir o lugar: o do Maps que a pessoa colou, senão uma busca
// pelo nome (+ endereço ou cidade) no Google Maps.
function turismSearchText(place, list) {
  const name = String(place?.name || "").trim();
  const where = String(place?.address || "").trim() || String(list?.city || "").trim();
  return where ? `${name}, ${where}` : name;
}

function turismMapsUrl(place, list) {
  const url = String(place?.url || "").trim();
  if (/^https?:\/\//i.test(url)) return url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(turismSearchText(place, list))}`;
}

// Roteiro com vários lugares (Google Maps aceita até 9 paradas + destino;
// a origem fica sendo onde a pessoa está).
const TURISM_ROUTE_MAX = 10;

function turismRouteUrl(places, list) {
  const stops = places.slice(0, TURISM_ROUTE_MAX).map((p) => turismSearchText(p, list));
  if (!stops.length) return "";
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`;
  if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
  return url;
}
