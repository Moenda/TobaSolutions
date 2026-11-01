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

// Custo-benefício e "iria de novo" (de quem já foi, desde v1.56)
const TURISM_VALUES = [
  { key: "vale", icon: "🤑", label: "Valeu cada real" },
  { key: "justo", icon: "👌", label: "Preço justo" },
  { key: "caro", icon: "💸", label: "Caro pelo que é" },
];

const TURISM_AGAIN = [
  { key: "sim", icon: "🔁", label: "Iria de novo" },
  { key: "nao", icon: "🚫", label: "Não volto" },
];

// Tipo do lugar (um por lugar, desde v1.56). group só organiza a tela.
const TURISM_KIND_GROUPS = [
  { key: "comer", label: "🍽️ Comer & beber" },
  { key: "passeio", label: "🎡 Passeios" },
];

const TURISM_KINDS = [
  { key: "brasileira", group: "comer", icon: "🍛", label: "Brasileira" },
  { key: "italiana", group: "comer", icon: "🍝", label: "Italiana" },
  { key: "pizza", group: "comer", icon: "🍕", label: "Pizza" },
  { key: "japonesa", group: "comer", icon: "🍣", label: "Japonesa" },
  { key: "chinesa", group: "comer", icon: "🥡", label: "Chinesa" },
  { key: "coreana", group: "comer", icon: "🍜", label: "Coreana" },
  { key: "arabe", group: "comer", icon: "🧆", label: "Árabe" },
  { key: "mexicana", group: "comer", icon: "🌮", label: "Mexicana" },
  { key: "peruana", group: "comer", icon: "🐟", label: "Peruana" },
  { key: "indiana", group: "comer", icon: "🫓", label: "Indiana" },
  { key: "nordestina", group: "comer", icon: "🌵", label: "Nordestina" },
  { key: "churrasco", group: "comer", icon: "🥩", label: "Churrasco" },
  { key: "hamburguer", group: "comer", icon: "🍔", label: "Hambúrguer" },
  { key: "mar", group: "comer", icon: "🦐", label: "Frutos do mar" },
  { key: "vegana", group: "comer", icon: "🥗", label: "Vegana" },
  { key: "rua", group: "comer", icon: "🌭", label: "Comida de rua" },
  { key: "cafe", group: "comer", icon: "☕", label: "Café" },
  { key: "padaria", group: "comer", icon: "🥐", label: "Padaria" },
  { key: "doceria", group: "comer", icon: "🍰", label: "Doceria" },
  { key: "sorvete", group: "comer", icon: "🍦", label: "Sorvete" },
  { key: "boteco", group: "comer", icon: "🍺", label: "Boteco" },
  { key: "drinks", group: "comer", icon: "🍸", label: "Drinks" },
  { key: "parque", group: "passeio", icon: "🌳", label: "Parque" },
  { key: "museu", group: "passeio", icon: "🏛️", label: "Museu" },
  { key: "exposicao", group: "passeio", icon: "🎨", label: "Exposição" },
  { key: "mirante", group: "passeio", icon: "🌄", label: "Mirante" },
  { key: "show", group: "passeio", icon: "🎶", label: "Show" },
  { key: "teatro", group: "passeio", icon: "🎭", label: "Teatro" },
  { key: "cinema", group: "passeio", icon: "🎬", label: "Cinema" },
  { key: "balada", group: "passeio", icon: "🪩", label: "Balada" },
  { key: "feira", group: "passeio", icon: "🛍️", label: "Feira" },
  { key: "loja", group: "passeio", icon: "🏬", label: "Loja" },
  { key: "livraria", group: "passeio", icon: "📚", label: "Livraria" },
  { key: "games", group: "passeio", icon: "🎮", label: "Games" },
  { key: "trilha", group: "passeio", icon: "🥾", label: "Trilha" },
  { key: "praia", group: "passeio", icon: "🏖️", label: "Praia" },
  { key: "esporte", group: "passeio", icon: "⚽", label: "Esporte" },
  { key: "hotel", group: "passeio", icon: "🏨", label: "Hospedagem" },
];

function turismValue(key) {
  return TURISM_VALUES.find((v) => v.key === key) || null;
}

function turismAgain(key) {
  return TURISM_AGAIN.find((v) => v.key === key) || null;
}

function turismKind(key) {
  return TURISM_KINDS.find((k) => k.key === key) || null;
}

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

// Coordenada que já vem no link comprido do Maps (!3d..!4d.. é o lugar; @lat,lng é o centro da tela)
function turismCoordsFromUrl(url) {
  const u = String(url || "");
  const m = u.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || u.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
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

// Roteiro com vários lugares: formato de caminho /maps/dir//A/B/C (origem vazia =
// onde a pessoa está). O app do Maps no celular ignora o "waypoints" do
// formato api=1 e abria só o destino (bug da v1.55). Máximo de 10 paradas.
const TURISM_ROUTE_MAX = 10;

function turismRouteUrl(places, list) {
  const stops = places.slice(0, TURISM_ROUTE_MAX).map((p) => {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    // Sem endereço mas com pino no mapa: a coordenada é mais certeira que o nome
    if (!String(p?.address || "").trim() && Number.isFinite(lat) && Number.isFinite(lng) && p?.lat !== null && p?.lng !== null) return `${lat},${lng}`;
    return turismSearchText(p, list);
  });
  if (!stops.length) return "";
  return `https://www.google.com/maps/dir//${stops.map((s) => encodeURIComponent(s).replace(/%20/g, "+")).join("/")}`;
}

/* ---------------------------------------------------------------------
 * Conquistas do Perfil (desde v1.56): números em ordem de data pro
 * computePlayer() (toba-player.js) conferir as conquistas "tu-*".
 * Lugar entra no dia em que foi posto na lista (addedAt); visita conta no
 * visitedAt (até hoje). Lugar de lista apagada não conta.
 * ------------------------------------------------------------------- */
function turismDayOf(ms) {
  const n = Number(ms) || 0;
  if (!n) return "";
  const d = new Date(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calcTurismPlayer(data, today) {
  const { lists, places } = turismSafeDb(data);
  const listById = Object.fromEntries(lists.map((l) => [String(l.id), l]));
  const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const steps = [];
  lists.forEach((l) => steps.push({ date: turismDayOf(l.createdAt) || "2000-01-01", order: 0, type: "list", list: l }));
  places.forEach((p) => {
    const list = listById[String(p.listId)];
    if (!list) return;
    const visited = p.status === "been" && isIso(p.visitedAt) && p.visitedAt <= today;
    // Visita marcada com data antes de entrar na lista (backup, edição): o lugar "entra" no dia da visita
    let addDay = turismDayOf(p.addedAt) || "2000-01-01";
    if (visited && p.visitedAt < addDay) addDay = p.visitedAt;
    steps.push({ date: addDay, order: 1, type: "add", place: p, list });
    if (visited) steps.push({ date: p.visitedAt, order: 2, type: "visit", place: p, list });
  });
  steps.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || (Number(a.place?.addedAt) || 0) - (Number(b.place?.addedAt) || 0));

  const stats = {
    turismLists: 0, turismAdded: 0, turismVisits: 0, turismTop: 0, turismNem: 0, turismCities: 0,
    turismKinds: 0, turismSameDay: 0, turismAgain: 0, turismValue: 0, turismZerou: 0,
  };
  const cities = new Set();
  const kinds = new Set();
  const perDay = {};
  const perList = {}; // listId -> { added, visited }
  const timeline = [];
  steps.filter((s) => s.date <= today).forEach((step) => {
    if (step.type === "list") stats.turismLists += 1;
    if (step.type === "add") {
      stats.turismAdded += 1;
      const c = perList[step.list.id] || (perList[step.list.id] = { added: 0, visited: 0 });
      c.added += 1;
    }
    if (step.type === "visit") {
      const p = step.place;
      stats.turismVisits += 1;
      if (p.rating === "top") stats.turismTop += 1;
      if (p.rating === "nem") stats.turismNem += 1;
      if (p.again === "sim") stats.turismAgain += 1;
      if (p.value === "vale") stats.turismValue += 1;
      const city = String(step.list.city || "").trim().toLowerCase();
      if (city) cities.add(city);
      stats.turismCities = cities.size;
      if (turismKind(p.kind)) kinds.add(p.kind);
      stats.turismKinds = kinds.size;
      perDay[step.date] = (perDay[step.date] || 0) + 1;
      stats.turismSameDay = Math.max(stats.turismSameDay, perDay[step.date]);
      const c = perList[step.list.id] || (perList[step.list.id] = { added: 0, visited: 0 });
      c.visited += 1;
      if (c.added >= 5 && c.visited >= c.added) stats.turismZerou = 1;
    }
    timeline.push({ date: step.date, stats: { ...stats } });
  });
  return { stats, timeline };
}
