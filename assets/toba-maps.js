/* =====================================================================
 * Toba · mapas TomTom (desde v1.66) — usado pelo Toba Drive e pelo Toba Places
 * - Chave: TOBA_TOMTOM_KEY é a chave grátis do Rafa (developer.tomtom.com).
 *   Fica pública no site (é chave de navegador): pra limitar ao domínio
 *   moenda.github.io, painel do TomTom › Keys › a chave › domínios.
 *   Nunca pôr a chave em memória/IA.
 * - Plano grátis (nov/2026, por mês, sem cartão): 200 mil tiles de mapa,
 *   200 mil tiles de trânsito, 20 mil rotas. Pra não gastar à toa:
 *   · tiles do mapa ficam no cache do sw.js (TOBA_TILE_CACHE, cache primeiro);
 *   · trânsito só atualiza a cada TOBA_TRAFFIC_REFRESH_MS e só no Drive;
 *   · rotas TomTom no máximo TOBA_TOMTOM_ROUTES_PER_DAY por dia neste aparelho.
 * - Plano B automático: se o TomTom recusar (chave errada, cota acabou = 4xx)
 *   o Toba desliga o TomTom por TOBA_TOMTOM_OFF_HOURS neste aparelho e usa
 *   CARTO (mapa) + Valhalla/OSRM (rota). Sem internet NÃO desliga nada.
 * - Estado (conveniência deste aparelho, não é dado): toba_tomtom_state
 *   { offUntil: ms, offWhy: "texto", day: "AAAA-MM-DD", routes: n }.
 * ===================================================================== */
const TOBA_TOMTOM_KEY = "mnpRs1e2YdS0T2slli7OvjuscJGpoc38";
const TOBA_TOMTOM_STATE_KEY = "toba_tomtom_state";
const TOBA_TOMTOM_OFF_HOURS = 6;
const TOBA_TOMTOM_ROUTES_PER_DAY = 400;
const TOBA_TRAFFIC_REFRESH_MS = 3 * 60 * 1000;
const TOBA_TOMTOM_STYLES = { light: "street-light", dark: "street-dark" };
const TOBA_CARTO_STYLES = { light: "voyager", dark: "dark_all" };
const TOBA_TOMTOM_ATTR = '&copy; <a href="https://www.tomtom.com/">TomTom</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TOBA_CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

/* ---------- estado (liga/desliga + contador de rotas do dia) ---------- */
function tobaTomTomState() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem(TOBA_TOMTOM_STATE_KEY) || "{}") || {};
  } catch (err) {
    s = {};
  }
  const today = typeof toIsoDate === "function" ? toIsoDate(new Date()) : new Date().toISOString().slice(0, 10);
  return {
    offUntil: Number(s.offUntil) || 0,
    offWhy: String(s.offWhy || ""),
    day: today,
    routes: s.day === today ? Number(s.routes) || 0 : 0,
  };
}

function tobaTomTomSave(patch) {
  try {
    localStorage.setItem(TOBA_TOMTOM_STATE_KEY, JSON.stringify({ ...tobaTomTomState(), ...patch }));
  } catch (err) {
    /* sem storage: vale só agora */
  }
}

function tobaTomTomOn() {
  return Boolean(TOBA_TOMTOM_KEY) && tobaTomTomState().offUntil <= Date.now();
}

// O TomTom recusou de verdade (status 4xx): desliga por umas horas
function tobaTomTomOff(why) {
  tobaTomTomSave({ offUntil: Date.now() + TOBA_TOMTOM_OFF_HOURS * 3600 * 1000, offWhy: why || "recusou" });
  console.warn(`TomTom desligado por ${TOBA_TOMTOM_OFF_HOURS} h: ${why}`);
}

function tobaTomTomCanRoute() {
  const s = tobaTomTomState();
  return tobaTomTomOn() && s.routes < TOBA_TOMTOM_ROUTES_PER_DAY;
}

function tobaTomTomCountRoute() {
  tobaTomTomSave({ routes: tobaTomTomState().routes + 1 });
}

/* ---------- URLs ---------- */
function tobaTomTomTilesUrl(style) {
  const s = TOBA_TOMTOM_STYLES[style] || TOBA_TOMTOM_STYLES.light;
  return `https://api.tomtom.com/maps/orbis/display/raster/tile/{z}/{x}/{y}?apiVersion=2&style=${s}&tileSize=256&key=${TOBA_TOMTOM_KEY}`;
}

function tobaCartoTilesUrl(style, cartoKey) {
  const s = TOBA_CARTO_STYLES[style] || TOBA_CARTO_STYLES.light;
  return `https://basemaps.cartocdn.com/rastertiles/${s}/{z}/{x}/{y}.png?key=${cartoKey}`;
}

// "v" muda a cada TOBA_TRAFFIC_REFRESH_MS: força o navegador a buscar o trânsito novo
function tobaTrafficTilesUrl(style) {
  const v = Math.floor(Date.now() / TOBA_TRAFFIC_REFRESH_MS);
  return `https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}?apiVersion=2&style=${style === "dark" ? "dark" : "light"}&tileSize=256&v=${v}&key=${TOBA_TOMTOM_KEY}`;
}

// Pergunta pro TomTom por que o tile falhou. Só desliga se ele respondeu 4xx
// (sem internet o fetch dá erro e nada muda).
async function tobaTomTomProbe(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status >= 400 && res.status < 500) return `HTTP ${res.status}`;
  } catch (err) {
    /* rede ou CORS: não dá pra saber, não desliga */
  }
  return "";
}

/* ---------- camada do mapa base (TomTom com plano B CARTO) ----------
 * const layer = tobaBaseTiles(map, "dark", { cartoKey });
 * layer.tobaSetStyle("light"); layer.tobaProvider -> "tomtom" | "carto"
 */
function tobaBaseTiles(map, style, options = {}) {
  const cartoKey = options.cartoKey || "";
  const useTomTom = tobaTomTomOn();
  const layer = L.tileLayer(useTomTom ? tobaTomTomTilesUrl(style) : tobaCartoTilesUrl(style, cartoKey), {
    maxZoom: 19,
    attribution: useTomTom ? TOBA_TOMTOM_ATTR : TOBA_CARTO_ATTR,
    crossOrigin: true, // resposta CORS (não "opaca"): o sw.js consegue guardar o tile sem estourar o espaço
  });
  layer.tobaProvider = useTomTom ? "tomtom" : "carto";
  layer.tobaStyle = style;
  let ok = 0;
  let bad = 0;
  let probing = false;
  const toCarto = () => {
    if (layer.tobaProvider === "carto") return;
    layer.tobaProvider = "carto";
    if (map.attributionControl) {
      map.attributionControl.removeAttribution(TOBA_TOMTOM_ATTR);
      map.attributionControl.addAttribution(TOBA_CARTO_ATTR);
    }
    layer.setUrl(tobaCartoTilesUrl(layer.tobaStyle, cartoKey));
    if (typeof options.onFallback === "function") options.onFallback();
  };
  layer.on("tileload", () => {
    ok += 1;
  });
  layer.on("tileerror", async (ev) => {
    if (layer.tobaProvider !== "tomtom") return;
    bad += 1;
    if (probing || bad < 3 || bad <= ok) return;
    probing = true;
    const why = await tobaTomTomProbe(ev.tile?.src || "");
    probing = false;
    if (why) {
      tobaTomTomOff(`mapa ${why}`);
      toCarto();
    } else if (ok === 0 && navigator.onLine !== false) {
      toCarto(); // TomTom mudo mas a internet existe: vai de CARTO só agora
    }
  });
  layer.tobaSetStyle = (next) => {
    layer.tobaStyle = next;
    layer.setUrl(layer.tobaProvider === "tomtom" ? tobaTomTomTilesUrl(next) : tobaCartoTilesUrl(next, cartoKey));
  };
  return layer.addTo(map);
}

/* ---------- camada de trânsito (só TomTom; sem TomTom, some) ----------
 * const t = tobaTrafficTiles(map, "dark"); t.tobaSetOn(true/false); t.tobaSetStyle("light")
 */
function tobaTrafficTiles(map, style) {
  const layer = L.tileLayer(tobaTrafficTilesUrl(style), { maxZoom: 19, opacity: 0.85, zIndex: 5, crossOrigin: true });
  layer.tobaStyle = style;
  let timer = null;
  let bad = 0;
  let ok = 0;
  layer.on("tileload", () => {
    ok += 1;
  });
  layer.on("tileerror", async (ev) => {
    bad += 1;
    if (bad !== 4 || ok > bad) return;
    const why = await tobaTomTomProbe(ev.tile?.src || "");
    if (why) {
      tobaTomTomOff(`trânsito ${why}`);
      layer.tobaSetOn(false);
    }
  });
  layer.tobaSetStyle = (next) => {
    layer.tobaStyle = next;
    layer.setUrl(tobaTrafficTilesUrl(next));
  };
  layer.tobaSetOn = (on) => {
    const want = Boolean(on) && tobaTomTomOn();
    if (timer) clearInterval(timer);
    timer = null;
    if (!want) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      return false;
    }
    layer.setUrl(tobaTrafficTilesUrl(layer.tobaStyle));
    if (!map.hasLayer(layer)) layer.addTo(map);
    // Atualiza o trânsito só com a tela à vista (aba escondida não gasta tile)
    timer = setInterval(() => {
      if (!document.hidden) layer.setUrl(tobaTrafficTilesUrl(layer.tobaStyle));
    }, TOBA_TRAFFIC_REFRESH_MS);
    return true;
  };
  return layer;
}
