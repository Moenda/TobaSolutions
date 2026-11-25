/* ---------- v2.13: 📸 radares certos (celular E Android Auto) ----------
 * Pedido do Rafa: "tinha lugar que tem radar mas não tem, e lugar que não tinha radar mas tem".
 * Até aqui o radar vinha só do OpenStreetMap (Overpass), que é mapa colaborativo: radar
 * tirado fica lá anos e radar novo da CET demora pra alguém marcar.
 *
 * 1) PARDAL (github.com/murkiriel/pardal, dados abertos ODbL): base dos radares do estado de
 *    SP juntando CET-SP, DER-SP (rodovias, Imigrantes/Bandeirantes inclusive), Inmetro, ANTT,
 *    PRF e o próprio OSM, gerada todo dia, com "ativo" (radar desligado vem marcado) e o
 *    sentido que o radar fiscaliza. Um CSV só (~230 KB, CORS liberado no raw do GitHub),
 *    guardado aqui por 3 dias (a mesma cópia serve o celular e o carro: mesma origem).
 *    Falhou = fica a última cópia; sem cópia = só o Overpass, como era.
 * 2) ✏ MARCAÇÃO DO RAFA (TOBA_DRIVE_DB.radarFixes, pelo celular: toque no velocímetro):
 *    📸 "Tem radar aqui" põe um radar; 🚫 "Esse radar não existe" tira os radares a até 40 m
 *    naquele sentido. Vale no celular e no 🚘 Android Auto (o carro lê o mesmo banco).
 * Ordem: OSM (Overpass) + Pardal (o desligado some, o oficial entra) + marcação do Rafa.
 * Sem dependência: este arquivo roda no TobaDrive.html e no TobaDrive-Auto.html.
 * Fonte: "Pardal · © colaboradores do OpenStreetMap" (ODbL 1.0), citada na folha ✏ do celular.
 */
const TOBA_RADAR_PARDAL_URL = "https://raw.githubusercontent.com/murkiriel/pardal/main/estados/SP/radares.csv";
const TOBA_RADAR_PARDAL_KEY = "toba_radar_pardal_sp";
const TOBA_RADAR_PARDAL_MS = 3 * 86400000;
const TOBA_RADAR_SP_BOX = [-25.4, -53.2, -19.7, -44.1]; // s, w, n, e (estado de SP, com folga)
const TOBA_RADAR_SAME_M = 30; // mesmo radar (OSM x Pardal)
const TOBA_RADAR_FIX_M = 40; // 🚫 tira o que estiver a até 40 m
const TOBA_RADAR_DIR_TOL = 60; // sentido do radar x rumo (graus)
const TOBA_RADAR_FIX_MAX = 300;

let tobaRadarPardalMem = null; // { t, r }
let tobaRadarPardalBusy = null;

function tobaRadarDist(a, b) {
  const k = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180) * 111320;
  return Math.hypot((b[1] - a[1]) * k, (b[0] - a[0]) * 110540);
}

function tobaRadarAngle(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// radar sem sentido conhecido vale pros dois lados
function tobaRadarDirOk(dirs, head) {
  if (!Array.isArray(dirs) || !dirs.length || !Number.isFinite(head)) return true;
  return dirs.some((d) => tobaRadarAngle(d, head) <= TOBA_RADAR_DIR_TOL);
}

// CSV do Pardal -> [[lat, lng, limite, sentido (-1 = os dois), ativo (1/0)]]
function tobaRadarParseCsv(text) {
  const lines = String(text || "").split(/\r?\n/);
  const head = (lines.shift() || "").split(",").map((s) => s.trim());
  const col = (name) => head.indexOf(name);
  const iLat = col("lat");
  const iLng = col("lng");
  const iKind = col("kind");
  const iLim = col("limit_kmh");
  const iOn = col("active");
  const iDir = col("direction_deg");
  if (iLat < 0 || iLng < 0) return [];
  const rows = [];
  lines.forEach((ln) => {
    if (!ln) return;
    const c = ln.split(",");
    const lat = Number(c[iLat]);
    const lng = Number(c[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return;
    const kind = iKind >= 0 ? c[iKind] : "FIXED";
    let lim = parseInt(iLim >= 0 ? c[iLim] : "", 10);
    lim = Number.isFinite(lim) && lim >= 10 && lim <= 150 ? lim : 0;
    if (kind === "RED_LIGHT" && !lim) return; // só avanço de sinal, sem velocidade: não é o nosso radar
    const dirN = iDir >= 0 && c[iDir] !== "" ? Number(c[iDir]) : NaN;
    const dir = Number.isFinite(dirN) && dirN >= 0 && dirN <= 360 ? Math.round(dirN) % 360 : -1;
    const on = iOn >= 0 && String(c[iOn]).trim() === "0" ? 0 : 1;
    rows.push([Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, lim, dir, on]);
  });
  return rows;
}

function tobaRadarPardalStored() {
  if (tobaRadarPardalMem) return tobaRadarPardalMem;
  try {
    const hit = JSON.parse(localStorage.getItem(TOBA_RADAR_PARDAL_KEY) || "null");
    if (hit && Array.isArray(hit.r) && hit.r.length) tobaRadarPardalMem = hit;
  } catch (err) {
    /* sem storage */
  }
  return tobaRadarPardalMem;
}

// linhas do Pardal (cópia de até 3 dias; senão baixa). null = não tem.
async function tobaRadarPardal() {
  const old = tobaRadarPardalStored();
  if (old && Date.now() - old.t < TOBA_RADAR_PARDAL_MS) return old.r;
  if (!tobaRadarPardalBusy) {
    tobaRadarPardalBusy = (async () => {
      try {
        const ctl = typeof AbortController === "function" ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), 20000) : 0;
        const res = await fetch(TOBA_RADAR_PARDAL_URL, ctl ? { signal: ctl.signal } : {});
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = tobaRadarParseCsv(await res.text());
        if (rows.length < 300) throw new Error("Pardal veio vazio");
        tobaRadarPardalMem = { t: Date.now(), r: rows };
        try {
          localStorage.setItem(TOBA_RADAR_PARDAL_KEY, JSON.stringify(tobaRadarPardalMem));
        } catch (err) {
          /* storage cheio: fica só na memória */
        }
      } catch (err) {
        /* fora do ar: segue com a cópia velha (ou sem) */
      } finally {
        tobaRadarPardalBusy = null;
      }
    })();
  }
  await tobaRadarPardalBusy;
  const now = tobaRadarPardalStored();
  return now ? now.r : null;
}

// a caixa tá inteira dentro de SP? (fora disso o Pardal SP não sabe: só o OSM)
function tobaRadarInSp(s, w, n, e) {
  const [S, W, N, E] = TOBA_RADAR_SP_BOX;
  return s >= S && w >= W && n <= N && e <= E;
}

// ✏ marcações do Rafa (TOBA_DRIVE_DB.radarFixes). No carro não tem driveDb: lê o banco direto.
function tobaRadarFixes() {
  try {
    if (typeof driveDb === "object" && driveDb && Array.isArray(driveDb.radarFixes)) return driveDb.radarFixes;
    const db = JSON.parse(localStorage.getItem("TOBA_DRIVE_DB") || "null");
    return db && Array.isArray(db.radarFixes) ? db.radarFixes : [];
  } catch (err) {
    return [];
  }
}

/* Junta tudo numa caixa (s, w, n, e).
 * base: radares do Overpass [{ lat, lng, lim, dirs: [], heads?: [] }] (pode ser []).
 * Devolve a mesma forma; o que veio da marcação do Rafa sai com mine: "rf-..". */
function tobaRadarMerge(base, box, pardal, fixes) {
  const [s, w, n, e] = box;
  const pad = 0.0006; // ~60 m: radar na beirada da caixa
  const inBox = (lat, lng) => lat >= s - pad && lat <= n + pad && lng >= w - pad && lng <= e + pad;
  let out = (base || []).map((r) => ({ ...r, dirs: Array.isArray(r.dirs) ? r.dirs.slice() : [] }));
  const near = (lat, lng, m, head) =>
    out.filter((r) => tobaRadarDist([r.lat, r.lng], [lat, lng]) <= m && (!Number.isFinite(head) || tobaRadarDirOk(r.dirs, head)));
  const rows = Array.isArray(pardal) ? pardal.filter((r) => inBox(r[0], r[1])) : [];
  // 1) desligado no Pardal: o do OSM no mesmo lugar sai
  rows.forEach(([lat, lng, , dir, on]) => {
    if (on) return;
    const gone = near(lat, lng, TOBA_RADAR_SAME_M, dir >= 0 ? dir : NaN);
    if (gone.length) out = out.filter((r) => !gone.includes(r));
  });
  // 2) ligado: completa o que já tem (limite, sentido) ou entra novo
  rows.forEach(([lat, lng, lim, dir, on]) => {
    if (!on) return;
    const same = near(lat, lng, TOBA_RADAR_SAME_M, dir >= 0 ? dir : NaN);
    if (same.length) {
      same.forEach((r) => {
        if (!r.lim && lim) r.lim = lim;
        if (!r.dirs.length && dir >= 0) r.dirs = [dir];
      });
    } else {
      out.push({ lat, lng, lim, dirs: dir >= 0 ? [dir] : [] });
    }
  });
  // 3) marcação do Rafa (mais nova por último: ganha)
  (Array.isArray(fixes) ? fixes : [])
    .filter((f) => f && inBox(Number(f.lat), Number(f.lng)))
    .sort((a, b) => (a.at || 0) - (b.at || 0))
    .forEach((f) => {
      const head = Number(f.head);
      if (f.kind === "del") {
        const gone = near(f.lat, f.lng, TOBA_RADAR_FIX_M, head);
        out = out.filter((r) => !gone.includes(r));
        return;
      }
      const same = near(f.lat, f.lng, TOBA_RADAR_SAME_M, head);
      if (same.length) {
        same.forEach((r) => {
          r.mine = f.id;
          if (f.limit) r.lim = f.limit;
        });
      } else {
        out.push({ lat: f.lat, lng: f.lng, lim: Number(f.limit) || 0, dirs: Number.isFinite(head) ? [Math.round(head)] : [], mine: f.id });
      }
    });
  return out;
}
