/* =====================================================================
 * Toba Turism · 📍 Toba Places (desde v1.55)
 * Listas de lugares pra visitar ("☕ Cafés por SP"): cada lugar com link do
 * Google Maps, anotação, "por que entrou" (chips) e nota de quem já foi.
 * Regras puras em turism-metrics.js; banco em turism-core.js.
 * Fast UI: quase tudo é tocar em chip; digitar só o nome (ou colar do Maps).
 * ===================================================================== */
const TURISM_DEFAULT_CITY = "São Paulo";

// Ideias de lista (tocar preenche emoji + nome)
const TURISM_LIST_IDEAS = [
  { emoji: "☕", name: "Cafés" },
  { emoji: "🍔", name: "Hambúrguer" },
  { emoji: "🍕", name: "Pizzarias" },
  { emoji: "🍣", name: "Japa" },
  { emoji: "🍺", name: "Bares" },
  { emoji: "🍦", name: "Docerias" },
  { emoji: "🥐", name: "Padarias" },
  { emoji: "🌮", name: "Comida de rua" },
  { emoji: "🌳", name: "Parques" },
  { emoji: "🏛️", name: "Museus" },
  { emoji: "🌄", name: "Mirantes" },
  { emoji: "🛍️", name: "Comprinhas" },
  { emoji: "🎶", name: "Rolê à noite" },
  { emoji: "💑", name: "Dates" },
];

const TURISM_EMOJIS = ["📍", "☕", "🍔", "🍕", "🍣", "🍜", "🍺", "🍷", "🍦", "🥐", "🌮", "🥩", "🌳", "🏛️", "🎨", "🌄", "🏖️", "🛍️", "🎶", "🎢", "📚", "💑", "🐱", "⭐"];

const TURISM_MAPS_URL_RE = /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

const placesState = {
  listId: null, // lista aberta (null = tela das listas)
  filter: "want", // want | been | all
  tag: null, // filtro por "por que entrou"
  city: null, // filtro de cidade na tela das listas
  listForm: { emoji: "📍", city: TURISM_DEFAULT_CITY, ideaName: "" },
  placeForm: { tags: [], status: "want", rating: null, listId: null, autoName: "" },
  rateId: null,
  route: [],
};

/* ---------------------------------------------------------------------
 * Ajudantes
 * ------------------------------------------------------------------- */
function turismFindList(id) {
  return turismDb.lists.find((l) => l.id === String(id)) || null;
}

function turismFindPlace(id) {
  return turismDb.places.find((p) => p.id === String(id)) || null;
}

function placesOfList(listId) {
  return turismDb.places.filter((p) => p.listId === String(listId));
}

function turismCities() {
  const set = new Set([TURISM_DEFAULT_CITY]);
  turismDb.lists.forEach((l) => {
    const c = String(l.city || "").trim();
    if (c) set.add(c);
  });
  return [...set];
}

function turismNorm(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Última mexida da lista (lista criada ou lugar novo/visitado): as mais mexidas sobem.
function listActivity(list) {
  return placesOfList(list.id).reduce((max, p) => Math.max(max, Number(p.addedAt) || 0), Number(list.createdAt) || 0);
}

function chipHtml({ label, on = false, action, data = {}, extra = "" }) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${escapeHtml(String(v))}"`).join("");
  return `<button type="button" class="chip-btn tr-chip${on ? " is-on" : ""}${extra}" data-click="${action}"${attrs}>${label}</button>`;
}

/* Lê o que o Google Maps manda no "Compartilhar":
 *   "Café do Japa\nRua X, 123 - Pinheiros, São Paulo - SP\nhttps://maps.app.goo.gl/abc"
 * ou só o link (com /maps/place/<nome>/ quando é o link comprido). */
function turismParseShared(text) {
  const raw = String(text || "");
  const urls = raw.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const url = urls.find((u) => TURISM_MAPS_URL_RE.test(u)) || urls[0] || "";
  const lines = [];
  raw.replace(/https?:\/\/[^\s<>"']+/gi, "").split(/\r?\n/).forEach((line) => {
    const clean = line.trim().replace(/^["“”']+|["“”']+$/g, "").trim();
    if (!clean || /^(google maps|ver no google maps|check out)/i.test(clean)) return;
    if (lines.length && turismNorm(lines[lines.length - 1]) === turismNorm(clean)) return; // título repetido no texto
    lines.push(clean);
  });
  let name = lines[0] || "";
  if (!name && url) {
    const m = url.match(/\/maps\/place\/([^/@?]+)/);
    if (m) {
      try {
        name = decodeURIComponent(m[1].replace(/\+/g, " "));
      } catch (err) {
        name = m[1].replace(/\+/g, " ");
      }
    }
  }
  return { name: name.slice(0, 80), address: (lines[1] || "").slice(0, 160), url: url.slice(0, 500) };
}

/* ---------------------------------------------------------------------
 * Tela das listas
 * ------------------------------------------------------------------- */
function renderAll() {
  if (placesState.listId && !turismFindList(placesState.listId)) placesState.listId = null;
  const inList = Boolean(placesState.listId);
  document.getElementById("viewLists").hidden = inList;
  document.getElementById("viewList").hidden = !inList;
  document.getElementById("headerAddBtn").textContent = inList ? "+ Lugar" : "+ Lista";
  if (inList) {
    const list = turismFindList(placesState.listId);
    tobaSetHeader({ page: `${list.emoji} ${list.name}`, back: "backToLists" });
    renderListView(list);
  } else {
    tobaSetHeader({ page: "📍 Toba Places" });
    renderListsView();
  }
}

function renderListsView() {
  const cities = [...new Set(turismDb.lists.map((l) => String(l.city || "").trim()).filter(Boolean))];
  if (placesState.city && !cities.includes(placesState.city)) placesState.city = null;
  document.getElementById("cityChips").innerHTML = cities.length > 1
    ? chipHtml({ label: "🌎 Todas", on: !placesState.city, action: "filterCity", data: { city: "" } })
      + cities.map((c) => chipHtml({ label: `🏙️ ${escapeHtml(c)}`, on: placesState.city === c, action: "filterCity", data: { city: c } })).join("")
    : "";

  const grid = document.getElementById("listsGrid");
  if (!turismDb.lists.length) {
    grid.innerHTML = `${tobaEmpty("🗺️", "Nenhuma lista ainda", "Monta sua primeira lista de lugares, tipo ☕ Cafés por SP. Começa tocando numa ideia:")}
      <div class="tr-chips is-wrap tr-empty-ideas">${TURISM_LIST_IDEAS.slice(0, 8).map((idea, i) => chipHtml({ label: `${idea.emoji} ${idea.name}`, action: "quickList", data: { index: i } })).join("")}</div>`;
    return;
  }
  const lists = turismDb.lists
    .filter((l) => !placesState.city || String(l.city || "").trim() === placesState.city)
    .sort((a, b) => listActivity(b) - listActivity(a));
  grid.innerHTML = lists.map((list) => {
    const s = turismListStats(turismDb, list.id);
    const pct = s.total ? Math.round((s.been / s.total) * 100) : 0;
    const counts = s.total
      ? `<b>${s.want}</b> pra ir · ${s.been} já ${s.been === 1 ? "foi" : "foram"}`
      : "vazia, bora encher";
    return `<div class="tr-list-card" role="button" tabindex="0" data-click="openList" data-id="${escapeHtml(list.id)}">
      <span class="tr-list-emoji">${escapeHtml(list.emoji)}</span>
      <span class="tr-list-text">
        <span class="tr-list-name">${escapeHtml(list.name)}</span>
        <span class="tr-list-meta">${list.city ? `🏙️ ${escapeHtml(list.city)} · ` : ""}${counts}</span>
        ${s.total ? `<span class="progress-track tr-track"><span class="progress-fill tr-fill" style="width:${pct}%"></span></span>` : ""}
      </span>
      <span class="toba-hub-chevron">›</span>
    </div>`;
  }).join("");
}

function filterCity(el) {
  placesState.city = el.dataset.city || null;
  renderListsView();
}

function openList(el) {
  placesState.listId = String(el.dataset.id);
  placesState.tag = null;
  placesState.filter = "want";
  const s = turismListStats(turismDb, placesState.listId);
  if (!s.want && s.been) placesState.filter = "all";
  setListUrl(placesState.listId);
  renderAll();
  window.scrollTo({ top: 0 });
}

function backToLists() {
  placesState.listId = null;
  setListUrl(null);
  renderAll();
}

function setListUrl(listId) {
  try {
    const url = new URL(window.location.href);
    if (listId) url.searchParams.set("lista", listId);
    else url.searchParams.delete("lista");
    history.replaceState(null, "", url.pathname + url.search);
  } catch (err) {
    /* sem history (arquivo local): segue sem */
  }
}

function headerAdd() {
  if (placesState.listId) openPlaceSheet(null);
  else openListSheet(null);
}

/* ---------------------------------------------------------------------
 * Uma lista
 * ------------------------------------------------------------------- */
function renderListView(list) {
  const s = turismListStats(turismDb, list.id);
  const top = placesOfList(list.id).filter((p) => p.status === "been" && p.rating === "top").length;
  document.getElementById("listHero").innerHTML = `
    <span class="tr-hero-emoji">${escapeHtml(list.emoji)}</span>
    <span class="tr-hero-text">
      <span class="tr-hero-name">${escapeHtml(list.name)}</span>
      <span class="tr-hero-meta">${list.city ? `🏙️ ${escapeHtml(list.city)} · ` : ""}📌 ${s.want} pra ir · ✅ ${s.been} já foi${top ? ` · 🔥 ${top}` : ""}</span>
    </span>`;

  ["want", "been", "all"].forEach((f) => {
    const id = { want: "filterWant", been: "filterBeen", all: "filterAll" }[f];
    const btn = document.getElementById(id);
    btn.classList.toggle("active", placesState.filter === f);
    const n = f === "want" ? s.want : f === "been" ? s.been : s.total;
    btn.textContent = `${{ want: "📌 Quero ir", been: "✅ Já fui", all: "Todos" }[f]} ${n}`;
  });

  // Filtro por "por que entrou": só as tags que aparecem nesta lista
  const used = new Set();
  placesOfList(list.id).forEach((p) => p.tags.forEach((t) => used.add(t)));
  if (placesState.tag && !used.has(placesState.tag)) placesState.tag = null;
  const tags = TURISM_TAGS.filter((t) => used.has(t.key));
  document.getElementById("tagFilterChips").innerHTML = tags.length > 1
    ? tags.map((t) => chipHtml({ label: `${t.icon} ${t.label}`, on: placesState.tag === t.key, action: "filterTag", data: { key: t.key } })).join("")
    : "";

  let places = placesOfList(list.id);
  if (placesState.filter !== "all") places = places.filter((p) => p.status === placesState.filter);
  if (placesState.tag) places = places.filter((p) => p.tags.includes(placesState.tag));
  places.sort((a, b) => {
    if (a.status !== b.status) return a.status === "want" ? -1 : 1;
    if (a.status === "been") return String(b.visitedAt || "").localeCompare(String(a.visitedAt || "")) || (b.addedAt || 0) - (a.addedAt || 0);
    return (b.addedAt || 0) - (a.addedAt || 0);
  });

  const box = document.getElementById("placesList");
  if (!places.length) {
    box.innerHTML = !s.total
      ? `${tobaEmpty("📍", "Lista vazia", "Toca em + Lugar. Dica: no Google Maps, abre o lugar › Compartilhar › Copiar e cola no Toba.")}
         <button type="button" class="btn tr-btn-go tr-empty-add" data-click="headerAdd">+ Primeiro lugar</button>`
      : placesState.filter === "want"
        ? tobaEmpty("🏆", "Zerou a lista!", "Já foi em todos. Hora de caçar lugar novo 😎")
        : placesState.filter === "been"
          ? tobaEmpty("🧭", "Nenhum visitado ainda", "Foi num lugar? Toca no ✅ dele na aba Quero ir.")
          : tobaEmpty("🔎", "Nada com esse filtro", "Tira o filtro de cima pra ver tudo.");
    return;
  }
  box.innerHTML = places.map((p) => placeCardHtml(p)).join("");
}

function placeCardHtml(p) {
  const been = p.status === "been";
  const rating = turismRating(p.rating);
  const tags = p.tags.map((k) => turismTag(k)).filter(Boolean);
  return `<div class="tr-place${been ? " is-been" : ""}">
    <div class="tr-place-main" role="button" tabindex="0" data-click="editPlace" data-id="${escapeHtml(p.id)}">
      <span class="tr-place-name">${been ? "✅" : "📌"} ${escapeHtml(p.name)}</span>
      ${p.address ? `<span class="tr-place-address">📍 ${escapeHtml(p.address)}</span>` : ""}
      ${p.note ? `<span class="tr-place-note">📝 ${escapeHtml(p.note)}</span>` : ""}
      ${tags.length ? `<span class="tr-place-tags">${tags.map((t) => `<span class="tr-mini-tag">${t.icon} ${t.label}</span>`).join("")}</span>` : ""}
      ${been ? `<span class="tr-place-rating">${rating ? `${rating.icon} ${rating.label}` : "Já foi"}${p.visitedAt ? ` · ${isoToBrDate(p.visitedAt)}` : ""}</span>` : ""}
    </div>
    <div class="tr-place-side">
      <button type="button" class="tr-side-btn" data-click="openPlaceMaps" data-id="${escapeHtml(p.id)}" aria-label="Abrir no Google Maps">🗺️</button>
      ${been ? "" : `<button type="button" class="tr-side-btn is-go" data-click="openRate" data-id="${escapeHtml(p.id)}" aria-label="Fui!">✅</button>`}
    </div>
  </div>`;
}

function setPlaceFilter(el) {
  placesState.filter = el.dataset.filter;
  renderAll();
}

function filterTag(el) {
  placesState.tag = placesState.tag === el.dataset.key ? null : el.dataset.key;
  renderAll();
}

function openPlaceMaps(el) {
  const p = turismFindPlace(el.dataset.id);
  if (p) turismOpenExternal(turismMapsUrl(p, turismFindList(p.listId)));
}

/* ---------------------------------------------------------------------
 * Folha da lista (nova / editar)
 * ------------------------------------------------------------------- */
function openListSheet(list, idea = null) {
  document.getElementById("listSheetTitle").textContent = list ? "✏️ Editar lista" : "🗂️ Lista nova";
  document.getElementById("listId").value = list ? list.id : "";
  document.getElementById("listName").value = list ? list.name : idea ? idea.name : "";
  document.getElementById("deleteListBtn").hidden = !list;
  placesState.listForm = {
    emoji: list ? list.emoji : idea ? idea.emoji : "📍",
    city: list ? String(list.city || "") : placesState.city || TURISM_DEFAULT_CITY,
    ideaName: idea ? idea.name : "",
  };
  document.getElementById("listCity").value = turismCities().includes(placesState.listForm.city) ? "" : placesState.listForm.city;
  renderListForm();
  openTobaModal("listSheet");
}

function renderListForm() {
  const f = placesState.listForm;
  document.getElementById("listEmojiBtn").textContent = f.emoji;
  document.getElementById("listIdeaChips").innerHTML = TURISM_LIST_IDEAS
    .map((idea, i) => chipHtml({ label: `${idea.emoji} ${idea.name}`, on: f.ideaName === idea.name, action: "pickListIdea", data: { index: i } }))
    .join("");
  document.getElementById("listEmojiChips").innerHTML = TURISM_EMOJIS
    .map((e) => chipHtml({ label: e, on: f.emoji === e, action: "pickListEmoji", data: { emoji: e }, extra: " tr-emoji-chip" }))
    .join("");
  document.getElementById("listCityChips").innerHTML = turismCities()
    .map((c) => chipHtml({ label: `🏙️ ${escapeHtml(c)}`, on: f.city === c, action: "pickListCity", data: { city: c } }))
    .join("")
    + chipHtml({ label: "🌎 Sem cidade", on: !f.city, action: "pickListCity", data: { city: "" } });
}

function pickListIdea(el) {
  const idea = TURISM_LIST_IDEAS[Number(el.dataset.index)];
  if (!idea) return;
  const input = document.getElementById("listName");
  const current = input.value.trim();
  // Só troca o nome se estiver vazio ou ainda for o de outra ideia
  if (!current || TURISM_LIST_IDEAS.some((i) => i.name === current)) input.value = idea.name;
  placesState.listForm.emoji = idea.emoji;
  placesState.listForm.ideaName = idea.name;
  renderListForm();
}

function pickListEmoji(el) {
  placesState.listForm.emoji = el.dataset.emoji;
  renderListForm();
}

function cycleListEmoji() {
  const i = TURISM_EMOJIS.indexOf(placesState.listForm.emoji);
  placesState.listForm.emoji = TURISM_EMOJIS[(i + 1) % TURISM_EMOJIS.length];
  renderListForm();
}

function pickListCity(el) {
  placesState.listForm.city = el.dataset.city;
  document.getElementById("listCity").value = "";
  renderListForm();
}

function quickList(el) {
  openListSheet(null, TURISM_LIST_IDEAS[Number(el.dataset.index)] || null);
}

function editCurrentList() {
  const list = turismFindList(placesState.listId);
  if (list) openListSheet(list);
}

function saveList() {
  const name = document.getElementById("listName").value.trim();
  if (!name) {
    showPageMessage("Dá um nome pra lista (ou toca numa ideia rápida).", { title: "Faltou o nome", icon: "✍️" });
    return;
  }
  const typedCity = document.getElementById("listCity").value.trim();
  const city = typedCity || placesState.listForm.city || "";
  const id = document.getElementById("listId").value;
  if (id) {
    const list = turismFindList(id);
    if (!list) return;
    Object.assign(list, { name, emoji: placesState.listForm.emoji, city });
  } else {
    const list = { id: turismNewId("l"), name, emoji: placesState.listForm.emoji, city, createdAt: Date.now() };
    turismDb.lists.push(list);
    placesState.listId = list.id;
    placesState.filter = "want";
    placesState.tag = null;
    setListUrl(list.id);
  }
  if (!saveTurismDb()) return;
  closeTobaModal("listSheet");
  renderAll();
}

async function deleteList() {
  const list = turismFindList(document.getElementById("listId").value);
  if (!list) return;
  const n = placesOfList(list.id).length;
  const ok = await showPageMessage(`Apaga a lista "${list.name}"${n ? ` e os ${n} ${n === 1 ? "lugar" : "lugares"} dela` : ""}. Não dá pra desfazer!`, { title: "Apagar lista?", icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  turismDb.lists = turismDb.lists.filter((l) => l.id !== list.id);
  turismDb.places = turismDb.places.filter((p) => p.listId !== list.id);
  if (!saveTurismDb()) return;
  closeTobaModal("listSheet");
  placesState.listId = null;
  setListUrl(null);
  renderAll();
}

/* ---------------------------------------------------------------------
 * Folha do lugar (novo / editar)
 * ------------------------------------------------------------------- */
function openPlaceSheet(place, prefill = null) {
  document.getElementById("placeSheetTitle").textContent = place ? "✏️ Editar lugar" : "📍 Lugar novo";
  document.getElementById("placeId").value = place ? place.id : "";
  document.getElementById("placePaste").value = "";
  document.getElementById("pasteBox").hidden = Boolean(place);
  document.getElementById("placeName").value = place ? place.name : prefill?.name || "";
  document.getElementById("placeUrl").value = place ? place.url : prefill?.url || "";
  document.getElementById("placeAddress").value = place ? place.address : prefill?.address || "";
  document.getElementById("placeNote").value = place ? place.note : "";
  document.getElementById("deletePlaceBtn").hidden = !place;
  const fallbackList = placesState.listId || (turismDb.lists[0] ? [...turismDb.lists].sort((a, b) => listActivity(b) - listActivity(a))[0].id : null);
  placesState.placeForm = {
    tags: place ? [...place.tags] : [],
    status: place ? place.status : "want",
    rating: place ? place.rating : null,
    listId: place ? place.listId : fallbackList,
    autoName: place ? "" : prefill?.name || "",
    fromShare: Boolean(prefill),
  };
  renderPlaceForm();
  openTobaModal("placeSheet");
}

function renderPlaceForm() {
  const f = placesState.placeForm;
  document.getElementById("placeTagChips").innerHTML = TURISM_TAGS
    .map((t) => chipHtml({ label: `${t.icon} ${t.label}`, on: f.tags.includes(t.key), action: "togglePlaceTag", data: { key: t.key } }))
    .join("");
  document.getElementById("placeStatusChips").innerHTML =
    chipHtml({ label: "📌 Quero ir", on: f.status === "want", action: "pickPlaceStatus", data: { status: "want" } })
    + chipHtml({ label: "✅ Já fui", on: f.status === "been", action: "pickPlaceStatus", data: { status: "been" } });
  document.getElementById("placeRatingBox").hidden = f.status !== "been";
  document.getElementById("placeRatingChips").innerHTML = TURISM_RATINGS
    .map((r) => chipHtml({ label: `${r.icon} ${r.label}`, on: f.rating === r.key, action: "pickPlaceRating", data: { key: r.key } }))
    .join("");
  // Escolher a lista: quando há mais de uma, ou quando veio do Compartilhar do Maps
  const lists = [...turismDb.lists].sort((a, b) => listActivity(b) - listActivity(a));
  document.getElementById("placeListBox").hidden = !(lists.length > 1 || f.fromShare || !lists.length);
  document.getElementById("placeListChips").innerHTML = lists.length
    ? lists.map((l) => chipHtml({ label: `${escapeHtml(l.emoji)} ${escapeHtml(l.name)}`, on: f.listId === l.id, action: "pickPlaceList", data: { id: l.id } })).join("")
    : `<span class="tr-hint">Vai entrar numa lista nova: 📍 Quero conhecer</span>`;
  document.getElementById("placeAddressBox").hidden = !document.getElementById("placeAddress").value.trim();
}

function togglePlaceTag(el) {
  const f = placesState.placeForm;
  const key = el.dataset.key;
  f.tags = f.tags.includes(key) ? f.tags.filter((k) => k !== key) : [...f.tags, key];
  renderPlaceForm();
}

function pickPlaceStatus(el) {
  placesState.placeForm.status = el.dataset.status;
  if (el.dataset.status === "want") placesState.placeForm.rating = null;
  renderPlaceForm();
}

function pickPlaceRating(el) {
  const f = placesState.placeForm;
  f.rating = f.rating === el.dataset.key ? null : el.dataset.key;
  renderPlaceForm();
}

function pickPlaceList(el) {
  placesState.placeForm.listId = el.dataset.id;
  renderPlaceForm();
}

// Campo "cola aqui": a cada mudança tenta tirar nome, endereço e link
function parsePasteField() {
  applyParsed(turismParseShared(document.getElementById("placePaste").value));
}

function applyParsed(parsed) {
  const f = placesState.placeForm;
  const nameEl = document.getElementById("placeName");
  // Não apaga um nome que a pessoa digitou na mão
  if (parsed.name && (!nameEl.value.trim() || nameEl.value.trim() === f.autoName)) {
    nameEl.value = parsed.name;
    f.autoName = parsed.name;
  }
  if (parsed.url) document.getElementById("placeUrl").value = parsed.url;
  if (parsed.address) document.getElementById("placeAddress").value = parsed.address;
  renderPlaceForm();
}

async function pasteFromMaps() {
  const area = document.getElementById("placePaste");
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error("sem clipboard");
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error("vazio");
    area.value = text;
    parsePasteField();
    tobaToast(document.getElementById("placeName").value ? "🪄 Peguei do Maps!" : "Colei! Confere o nome 👀");
  } catch (err) {
    area.focus();
    tobaToast("Segura o dedo no campo › Colar 👆");
  }
}

async function savePlace() {
  const f = placesState.placeForm;
  const name = document.getElementById("placeName").value.trim();
  if (!name) {
    showPageMessage("Coloca o nome do lugar (ou cola o que o Maps mandou no campo de cima).", { title: "Faltou o nome", icon: "✍️" });
    return;
  }
  let url = document.getElementById("placeUrl").value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  const id = document.getElementById("placeId").value;

  let listId = f.listId && turismFindList(f.listId) ? f.listId : null;
  if (!listId) {
    const list = { id: turismNewId("l"), name: "Quero conhecer", emoji: "📍", city: TURISM_DEFAULT_CITY, createdAt: Date.now() };
    turismDb.lists.push(list);
    listId = list.id;
  }

  const twin = turismDb.places.find((p) => p.listId === listId && p.id !== id && turismNorm(p.name) === turismNorm(name));
  if (twin) {
    const ok = await showPageMessage(`"${twin.name}" já está nessa lista. Salvar outro mesmo assim?`, { title: "Repetido?", icon: "👯", confirm: true, confirmLabel: "Salvar outro", danger: false });
    if (!ok) return;
  }

  const fields = {
    listId,
    name,
    url,
    address: document.getElementById("placeAddress").value.trim(),
    note: document.getElementById("placeNote").value.trim(),
    tags: [...TURISM_TAGS.map((t) => t.key).filter((k) => f.tags.includes(k)), ...f.tags.filter((k) => !turismTag(k))], // key desconhecida fica
    status: f.status === "been" ? "been" : "want",
    rating: f.status === "been" ? f.rating : null,
  };
  if (id) {
    const place = turismFindPlace(id);
    if (!place) return;
    const wasBeen = place.status === "been";
    Object.assign(place, fields);
    place.visitedAt = fields.status === "been" ? (wasBeen && place.visitedAt ? place.visitedAt : toIsoDate()) : null;
  } else {
    turismDb.places.push({
      id: turismNewId("p"),
      ...fields,
      visitedAt: fields.status === "been" ? toIsoDate() : null,
      addedAt: Date.now(),
    });
  }
  if (!saveTurismDb()) return;
  closeTobaModal("placeSheet");
  if (placesState.listId !== listId) {
    placesState.listId = listId;
    placesState.tag = null;
    setListUrl(listId);
  }
  if (!id) placesState.filter = fields.status === "been" ? "been" : "want";
  renderAll();
}

function editPlace(el) {
  const p = turismFindPlace(el.dataset.id);
  if (p) openPlaceSheet(p);
}

async function deletePlace() {
  const p = turismFindPlace(document.getElementById("placeId").value);
  if (!p) return;
  const ok = await showPageMessage(`Tira "${p.name}" da lista?`, { title: "Apagar lugar?", icon: "🗑️", confirm: true, confirmLabel: "Apagar" });
  if (!ok) return;
  turismDb.places = turismDb.places.filter((x) => x.id !== p.id);
  if (!saveTurismDb()) return;
  closeTobaModal("placeSheet");
  renderAll();
}

/* ---------------------------------------------------------------------
 * ✅ Fui! (nota num toque)
 * ------------------------------------------------------------------- */
function openRate(el) {
  const p = turismFindPlace(el.dataset.id);
  if (!p) return;
  placesState.rateId = p.id;
  document.getElementById("rateSheetTitle").textContent = `✅ Fui no ${p.name}`.slice(0, 60);
  document.getElementById("rateGrid").innerHTML = TURISM_RATINGS
    .map((r) => `<button type="button" class="tr-rate-btn is-${r.key}" data-click="ratePlace" data-key="${r.key}"><span class="tr-rate-icon">${r.icon}</span><span>${r.label}</span></button>`)
    .join("");
  openTobaModal("rateSheet");
}

function ratePlace(el) {
  const p = turismFindPlace(placesState.rateId);
  if (!p) return;
  p.status = "been";
  p.rating = el.dataset.key;
  p.visitedAt = toIsoDate();
  if (!saveTurismDb({ silent: true })) return;
  closeTobaModal("rateSheet");
  const r = turismRating(p.rating);
  tobaToast(p.rating === "nem" ? "💩 Anotado, nunca mais!" : `${r ? r.icon : "✅"} Riscado da lista!`);
  renderAll();
}

/* ---------------------------------------------------------------------
 * 🧭 Roteiro, 🎲 Sorteia, 📤 Mandar
 * ------------------------------------------------------------------- */
function routeCandidates() {
  const all = placesOfList(placesState.listId);
  const want = all.filter((p) => p.status === "want");
  return (want.length ? want : all).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

function openRoute() {
  const places = routeCandidates();
  if (!places.length) {
    showPageMessage("Coloca uns lugares na lista primeiro 😅", { title: "Lista vazia", icon: "🧭" });
    return;
  }
  placesState.route = places.slice(0, TURISM_ROUTE_MAX).map((p) => p.id);
  renderRoute();
  openTobaModal("routeSheet");
}

function renderRoute() {
  const sel = placesState.route;
  document.getElementById("routeList").innerHTML = routeCandidates().map((p) => {
    const i = sel.indexOf(p.id);
    return `<button type="button" class="tr-route-item${i >= 0 ? " is-on" : ""}" data-click="toggleRoute" data-id="${escapeHtml(p.id)}">
      <span class="tr-route-num">${i >= 0 ? i + 1 : ""}</span>
      <span class="tr-route-name">${escapeHtml(p.name)}</span>
    </button>`;
  }).join("");
  const btn = document.getElementById("routeGoBtn");
  btn.disabled = !sel.length;
  btn.textContent = sel.length ? `🗺️ Abrir no Maps (${sel.length} ${sel.length === 1 ? "parada" : "paradas"})` : "Escolhe pelo menos 1";
}

function toggleRoute(el) {
  const id = el.dataset.id;
  const sel = placesState.route;
  if (sel.includes(id)) placesState.route = sel.filter((x) => x !== id);
  else if (sel.length >= TURISM_ROUTE_MAX) {
    tobaToast(`O Maps aceita até ${TURISM_ROUTE_MAX} paradas 🚦`);
    return;
  } else sel.push(id);
  renderRoute();
}

function goRoute() {
  const list = turismFindList(placesState.listId);
  const places = placesState.route.map((id) => turismFindPlace(id)).filter(Boolean);
  if (!places.length) return;
  closeTobaModal("routeSheet");
  turismOpenExternal(places.length === 1 ? turismMapsUrl(places[0], list) : turismRouteUrl(places, list));
}

const TURISM_DRAW_LINES = [
  "O universo escolheu:",
  "Nunca foi sorte, foi o Toba:",
  "O rolê de hoje é:",
  "Bora, sem desculpa:",
];

async function drawPlace() {
  const want = placesOfList(placesState.listId).filter((p) => p.status === "want");
  if (!want.length) {
    showPageMessage("Não tem nenhum lugar no 📌 Quero ir pra sortear.", { title: "Nada pra sortear", icon: "🎲" });
    return;
  }
  const p = want[Math.floor(Math.random() * want.length)];
  const line = TURISM_DRAW_LINES[Math.floor(Math.random() * TURISM_DRAW_LINES.length)];
  const ok = await showPageMessage(`${line}\n\n📌 ${p.name}${p.note ? `\n📝 ${p.note}` : ""}`, { title: "🎲 Sorteio", icon: "🎲", confirm: true, confirmLabel: "🗺️ Abrir no Maps", cancelLabel: "Valeu", danger: false });
  if (ok) turismOpenExternal(turismMapsUrl(p, turismFindList(p.listId)));
}

/* Texto da lista pra mandar no WhatsApp. O "📥 Colar lista" lê de volta. */
function turismListText(list) {
  const places = placesOfList(list.id).sort((a, b) => {
    if (a.status !== b.status) return a.status === "want" ? -1 : 1;
    return (b.addedAt || 0) - (a.addedAt || 0);
  });
  const lines = [`${list.emoji} ${list.name}${list.city ? ` · ${list.city}` : ""}`, "(lista do Toba Places 📍)"];
  places.forEach((p) => {
    const r = turismRating(p.rating);
    lines.push("");
    lines.push(`${p.status === "been" ? "✅" : "📌"} ${p.name}${p.status === "been" && r ? ` (${r.icon} ${r.label})` : ""}`);
    if (p.address) lines.push(`📍 ${p.address}`);
    lines.push(`🗺️ ${turismMapsUrl(p, list)}`);
    if (p.note) lines.push(`📝 ${p.note.replace(/\s*\n\s*/g, " ")}`);
    const tags = p.tags.map((k) => turismTag(k)).filter(Boolean);
    if (tags.length) lines.push(`🏷️ ${tags.map((t) => `${t.icon} ${t.label}`).join(", ")}`);
  });
  return lines.join("\n");
}

async function shareList() {
  const list = turismFindList(placesState.listId);
  if (!list) return;
  const text = turismListText(list);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${list.emoji} ${list.name}`, text });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // desistiu de mandar
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    tobaToast("📋 Lista copiada! Cola no WhatsApp.");
  } catch (err) {
    showPageMessage(text, { title: "Copia daqui", icon: "📋" });
  }
}

/* ---------------------------------------------------------------------
 * 📥 Colar lista que mandaram (formato do 📤 Mandar)
 * ------------------------------------------------------------------- */
function openImport() {
  document.getElementById("importText").value = "";
  openTobaModal("importSheet");
}

function turismParseListText(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim());
  const headerLine = lines.find((l) => l && !/^(📌|✅)/u.test(l)) || "";
  const head = headerLine.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u);
  const headText = head ? head[2] : headerLine;
  const [name, city] = headText.split(" · ");
  const out = { emoji: head ? head[1] : "📍", name: (name || "").trim().slice(0, 40), city: (city || "").trim().slice(0, 40), places: [] };
  let cur = null;
  lines.forEach((line) => {
    if (/^(📌|✅)/u.test(line)) {
      const been = line.startsWith("✅");
      let body = line.replace(/^(📌|✅)\s*/u, "");
      let rating = null;
      const m = body.match(/\s*\(([^()]+)\)\s*$/);
      if (m) {
        const r = TURISM_RATINGS.find((x) => m[1].includes(x.label));
        if (r) {
          rating = r.key;
          body = body.slice(0, m.index);
        }
      }
      cur = { name: body.trim().slice(0, 80), status: been ? "been" : "want", rating, url: "", address: "", note: "", tags: [] };
      if (cur.name) out.places.push(cur);
      return;
    }
    if (!cur) return;
    // Alguns apps tiram o "\uFE0F" do emoji: compara só o desenho base
    const rest = (base) => (line.startsWith(base) ? line.slice(base.length).replace(/^\uFE0F/, "").trim() : null);
    const url = rest("\u{1F5FA}"); // 🗺️
    const address = rest("📍");
    const note = rest("📝");
    const tags = rest("\u{1F3F7}"); // 🏷️
    if (url !== null) {
      // Link de busca gerado pelo Toba não precisa ser guardado: o nome já basta
      cur.url = /google\.com\/maps\/search\/\?api=1/.test(url) ? "" : url.slice(0, 500);
    } else if (address !== null) cur.address = address.slice(0, 160);
    else if (note !== null) cur.note = note.slice(0, 300);
    else if (tags !== null) cur.tags = TURISM_TAGS.filter((t) => tags.includes(t.label)).map((t) => t.key);
  });
  return out;
}

function importList() {
  const parsed = turismParseListText(document.getElementById("importText").value);
  if (!parsed.places.length) {
    showPageMessage("Não achei nenhum lugar nesse texto. Ele precisa vir do 📤 Mandar do Toba Places (com as linhas 📌 e ✅).", { title: "Hmm 🤔", icon: "📥" });
    return;
  }
  const name = parsed.name || "Lista recebida";
  let list = turismDb.lists.find((l) => turismNorm(l.name) === turismNorm(name) && turismNorm(l.city) === turismNorm(parsed.city));
  const isNew = !list;
  if (!list) {
    list = { id: turismNewId("l"), name, emoji: parsed.emoji, city: parsed.city, createdAt: Date.now() };
    turismDb.lists.push(list);
  }
  const have = new Set(placesOfList(list.id).map((p) => turismNorm(p.name)));
  let added = 0;
  const now = Date.now();
  parsed.places.forEach((p, i) => {
    if (have.has(turismNorm(p.name))) return;
    have.add(turismNorm(p.name));
    turismDb.places.push({
      id: turismNewId("p"),
      listId: list.id,
      name: p.name,
      url: p.url,
      address: p.address,
      note: p.note,
      tags: p.tags,
      status: "want", // o "já fui" é de quem mandou; aqui começa tudo pra ir
      rating: null,
      visitedAt: null,
      addedAt: now - i, // mantém a ordem de quem mandou
    });
    added += 1;
  });
  if (!saveTurismDb({ silent: true })) return;
  closeTobaModal("importSheet");
  placesState.listId = list.id;
  placesState.filter = "want";
  placesState.tag = null;
  setListUrl(list.id);
  renderAll();
  tobaToast(isNew ? `📥 Lista nova com ${added} ${added === 1 ? "lugar" : "lugares"}!` : added ? `📥 +${added} na ${list.name}` : "Já tinha tudo 😎");
}

/* ---------------------------------------------------------------------
 * Ações e abertura da página
 * ------------------------------------------------------------------- */
function onTurismDataReplaced() {
  renderAll();
}

tobaActions({
  headerAdd,
  backToLists,
  filterCity,
  openList,
  quickList,
  setPlaceFilter,
  filterTag,
  openPlaceMaps,
  editCurrentList,
  pickListIdea,
  pickListEmoji,
  cycleListEmoji,
  pickListCity,
  saveList,
  deleteList,
  togglePlaceTag,
  pickPlaceStatus,
  pickPlaceRating,
  pickPlaceList,
  parsePasteField,
  pasteFromMaps,
  savePlace,
  editPlace,
  deletePlace,
  openRate,
  ratePlace,
  openRoute,
  toggleRoute,
  goRoute,
  drawPlace,
  shareList,
  openImport,
  importList,
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    turismDb = loadTurismDb();
    renderAll();
  }
});

(function initPlaces() {
  const params = new URLSearchParams(window.location.search);
  const listParam = params.get("lista");
  if (listParam && turismFindList(listParam)) placesState.listId = listParam;
  renderAll();
  // Compartilhar do Google Maps direto pro Toba (app instalado pelo Chrome: share_target do manifest)
  const shared = [params.get("title"), params.get("text"), params.get("url")].filter(Boolean).join("\n");
  if (shared.trim()) {
    try {
      const url = new URL(window.location.href);
      ["title", "text", "url"].forEach((k) => url.searchParams.delete(k));
      history.replaceState(null, "", url.pathname + url.search);
    } catch (err) {
      /* segue */
    }
    openPlaceSheet(null, turismParseShared(shared));
  }
})();
