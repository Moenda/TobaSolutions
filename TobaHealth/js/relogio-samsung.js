/*
 * Toba Health · 🩻 Raio-X · 📥 Histórico do Samsung Health (v1.89)
 *
 * O Samsung Health não reenvia o passado pro Health Connect, mas o "Baixar dados
 * pessoais" dele gera uma pasta de CSVs com tudo desde o 1º dia. Aqui o Rafa escolhe
 * os CSVs (dá pra marcar a pasta inteira: o resto é ignorado) e o Toba lê só estes:
 *   step_daily_trend (passos/distância do dia, source_type -2 = todos os aparelhos juntos;
 *                     sem ele, pedometer_day_summary com o maior do dia)
 *   calories_burned.details (repouso + ativas do dia)
 *   tracker.heart_rate (blocos de 1 h: média, mín., máx.)
 *   shealth.sleep + sleep_stage (noites e fases: 40001 acordado, 40002 leve, 40003 profundo, 40004 REM)
 *   shealth.exercise (treinos: tipo, tempo, kcal, km, FC média/máx.)
 * v1.94 (🩻 RAIO ULTRA X): também
 *   shealth.stress (blocos de 1 h: score 0-100) -> stress (média do dia), stressMax, stressPeak (hora), stressHigh (horas >= 70)
 *   shealth.vitality_score (Energy Score do dia) -> energy, hrv (HRV dormindo, ms), restHr (FC dormindo, se vazio)
 *   tracker.oxygen_saturation (noite) -> spo2 (média %), spo2Min
 *   health.skin_temperature (noite) -> temp (°C, 1 casa)
 *   health.respiratory_rate (noite) -> resp (respirações/min, 1 casa)
 *   tracker.floors_day_summary (+ health.floors_climbed onde faltar) -> floors
 *   shealth.sleep_snoring (noite) -> snoreMin (0 = mediu e não roncou)
 * Medida da noite vai pro dia em que acordou (end_time), igual o sono.
 * Horários do Samsung vêm em UTC ("AAAA-MM-DD HH:MM:SS.mmm"); o dia é o do celular.
 * Datas de dia (day_time) já vêm como o dia certo.
 *
 * REGRA: o que já veio do Health Connect manda. O import só preenche campo vazio do dia,
 * exercício novo só entra se não tiver outro começando a ±3 min, e sono só em dia sem sono.
 * Nada é apagado. Vai pro mesmo TOBA_HEALTH_DB.watch.days (mesmo formato do relogio.js),
 * e TOBA_HEALTH_DB.watch.samsungImport = { at, from, to, days } guarda o resumo.
 * Exercício importado com mais de 30 dias não aparece na caixinha de "Treinos do relógio",
 * nem a caminhada detectada sozinha pelo relógio (ex.auto = 1). ex.imp = 1 marca que veio
 * daqui: o 🔄 do Health Connect não tira ele do dia (só se tiver um do relógio no mesmo horário).
 */

const SAMSUNG_FILES = [
  { key: "steps", test: /step_daily_trend/i, label: "👟 passos" },
  { key: "pedometer", test: /pedometer_day_summary/i, label: "👟 passos (reserva)" },
  { key: "kcal", test: /calories_burned\.details/i, label: "🔥 calorias" },
  { key: "heart", test: /tracker\.heart_rate\.\d/i, label: "❤️ batimentos" },
  { key: "sleep", test: /shealth\.sleep\.\d/i, label: "😴 sono" },
  { key: "stage", test: /health\.sleep_stage\.\d/i, label: "😴 fases do sono" },
  { key: "exercise", test: /shealth\.exercise\.\d/i, label: "🏃 exercícios" },
  { key: "stress", test: /shealth\.stress\.\d/i, label: "😰 stress" },
  { key: "vitality", test: /vitality_score/i, label: "🔋 energy score e 💓 HRV" },
  { key: "spo2", test: /tracker\.oxygen_saturation\.\d/i, label: "🫁 oxigenação" },
  { key: "temp", test: /health\.skin_temperature\.\d/i, label: "🌡️ temperatura da pele" },
  { key: "resp", test: /health\.respiratory_rate\.\d/i, label: "😮‍💨 respiração" },
  { key: "floors", test: /floors_day_summary/i, label: "🪜 andares" },
  { key: "floorsRaw", test: /health\.floors_climbed\.\d/i, label: "🪜 andares (antigos)" },
  { key: "snore", test: /sleep_snoring/i, label: "😪 ronco" },
];

// Tipo do Samsung Health -> tipo do Health Connect (o mesmo que o APK manda), com nome quando precisa
const SAMSUNG_EX_TYPES = {
  1001: { type: 53 }, 1002: { type: 33 }, 13001: { type: 21 },
  11007: { type: 4 }, 15003: { type: 5 }, 15005: { type: 34 }, 15006: { type: 60 }, 15004: { type: 61 },
  14001: { type: 49 }, 9001: { type: 27 }, 9002: { type: 57 },
  15001: { type: 45 }, 15002: { type: 45 },
  12001: { type: 58, title: "Aeróbico" }, 10007: { type: 58, title: "Treino funcional" },
  0: { type: 0 },
};

let samsungPicked = [];

// CSV simples do Samsung: linha 1 = nome da tabela, linha 2 = cabeçalho. Aceita aspas.
function samsungCsvRows(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/);
  if (lines.length < 3) return { head: [], rows: [] };
  const split = (line) => {
    if (line.indexOf('"') < 0) return line.split(",");
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[1]);
  const rows = [];
  for (let i = 2; i < lines.length; i++) if (lines[i]) rows.push(split(lines[i]));
  return { head, rows };
}

// Coluna pelo nome: exato ou "prefixo.nome"
function samsungCol(head, name) {
  let i = head.indexOf(name);
  if (i < 0) i = head.findIndex((h) => h.endsWith(`.${name}`));
  return i;
}

function samsungUtc(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(String(s || ""));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0);
}

function samsungDayOf(s) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || ""));
  return m ? m[1] : "";
}

function samsungNum(v) {
  const n = Number(v);
  return v !== "" && v !== undefined && Number.isFinite(n) ? n : null;
}

function samsungReadFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("leitura"));
    r.readAsText(file);
  });
}

// Lê os CSVs e devolve { days: {ISO: {...}}, sleep: [...], exercises: [...], found: {key: linhas} }
async function samsungParse(files) {
  const byKey = {};
  files.forEach((f) => {
    const def = SAMSUNG_FILES.find((d) => d.test.test(f.name));
    if (def && (!byKey[def.key] || f.size > byKey[def.key].size)) byKey[def.key] = f;
  });
  const days = {};
  const day = (iso) => (days[iso] = days[iso] || {});
  const found = {};

  const stepsFile = byKey.steps || byKey.pedometer;
  if (stepsFile) {
    const { head, rows } = samsungCsvRows(await samsungReadFile(stepsFile));
    const cDay = samsungCol(head, "day_time"), cCount = samsungCol(head, byKey.steps ? "count" : "step_count");
    const cDist = samsungCol(head, "distance"), cSrc = samsungCol(head, "source_type");
    const best = {};
    rows.forEach((r) => {
      const iso = samsungDayOf(r[cDay]);
      const steps = samsungNum(r[cCount]);
      if (!iso || steps === null) return;
      const all = cSrc >= 0 && r[cSrc] === "-2";
      const cur = best[iso];
      // "-2" (todos os aparelhos) ganha; sem ele, o maior do dia
      if (!cur || (all && !cur.all) || (all === cur.all && steps > cur.steps)) best[iso] = { all, steps, dist: samsungNum(r[cDist]) };
    });
    Object.keys(best).forEach((iso) => {
      day(iso).steps = Math.round(best[iso].steps);
      if (best[iso].dist > 0) day(iso).distanceM = Math.round(best[iso].dist);
    });
    found[byKey.steps ? "steps" : "pedometer"] = Object.keys(best).length;
  }

  if (byKey.kcal) {
    const { head, rows } = samsungCsvRows(await samsungReadFile(byKey.kcal));
    const cDay = samsungCol(head, "day_time"), cRest = samsungCol(head, "rest_calorie"), cAct = samsungCol(head, "active_calorie");
    let n = 0;
    rows.forEach((r) => {
      const iso = samsungDayOf(r[cDay]);
      const rest = samsungNum(r[cRest]) || 0, act = samsungNum(r[cAct]) || 0;
      if (!iso || rest + act <= 0) return;
      const d = day(iso);
      if (!(d.kcal >= rest + act)) {
        d.kcal = Math.round(rest + act);
        if (act > 0) d.activeKcal = Math.round(act);
        n++;
      }
    });
    found.kcal = n;
  }

  if (byKey.heart) {
    const { head, rows } = samsungCsvRows(await samsungReadFile(byKey.heart));
    const cStart = samsungCol(head, "start_time"), cHr = samsungCol(head, "heart_rate");
    const cMin = samsungCol(head, "min"), cMax = samsungCol(head, "max");
    const acc = {};
    rows.forEach((r) => {
      const t = samsungUtc(r[cStart]), hr = samsungNum(r[cHr]);
      if (!Number.isFinite(t) || !(hr > 20 && hr < 250)) return;
      const iso = toIsoDate(new Date(t));
      const a = (acc[iso] = acc[iso] || { sum: 0, n: 0, min: Infinity, max: 0 });
      a.sum += hr; a.n++;
      const lo = samsungNum(r[cMin]), hi = samsungNum(r[cMax]);
      a.min = Math.min(a.min, lo > 20 ? lo : hr);
      a.max = Math.max(a.max, hi > 20 ? hi : hr);
    });
    Object.keys(acc).forEach((iso) => {
      const a = acc[iso], d = day(iso);
      d.hrAvg = Math.round(a.sum / a.n);
      d.hrMin = Math.round(a.min);
      d.hrMax = Math.round(a.max);
    });
    found.heart = Object.keys(acc).length;
  }

  const sleep = [];
  if (byKey.sleep) {
    const stages = {};
    if (byKey.stage) {
      const { head, rows } = samsungCsvRows(await samsungReadFile(byKey.stage));
      const cId = samsungCol(head, "sleep_id"), cS = samsungCol(head, "start_time"), cE = samsungCol(head, "end_time"), cSt = samsungCol(head, "stage");
      const names = { 40001: "awake", 40002: "light", 40003: "deep", 40004: "rem" };
      rows.forEach((r) => {
        const k = names[r[cSt]];
        const ms = samsungUtc(r[cE]) - samsungUtc(r[cS]);
        if (!k || !(ms > 0) || !r[cId]) return;
        const s = (stages[r[cId]] = stages[r[cId]] || { awake: 0, light: 0, deep: 0, rem: 0 });
        s[k] += ms;
      });
      found.stage = Object.keys(stages).length;
    }
    const { head, rows } = samsungCsvRows(await samsungReadFile(byKey.sleep));
    const cS = samsungCol(head, "start_time"), cE = samsungCol(head, "end_time");
    const cId = samsungCol(head, "datauuid"), cDur = samsungCol(head, "sleep_duration");
    rows.forEach((r) => {
      const start = samsungUtc(r[cS]), end = samsungUtc(r[cE]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      const st = stages[r[cId]];
      const m = (ms) => Math.round(ms / 60000);
      const s = { start, end };
      if (st) {
        Object.assign(s, { deep: m(st.deep), light: m(st.light), rem: m(st.rem), awake: m(st.awake) });
        s.min = s.deep + s.light + s.rem;
      }
      if (!(s.min > 0)) {
        const dur = samsungNum(r[cDur]);
        s.min = dur > 0 ? Math.round(dur) : m(end - start);
      }
      sleep.push(s);
    });
    found.sleep = sleep.length;
  }

  const exercises = [];
  if (byKey.exercise) {
    const { head, rows } = samsungCsvRows(await samsungReadFile(byKey.exercise));
    const c = (n) => samsungCol(head, n);
    const cS = c("start_time"), cE = c("end_time"), cT = c("exercise_type"), cK = c("calorie");
    const cD = c("distance"), cHa = c("mean_heart_rate"), cHm = c("max_heart_rate"), cTitle = c("title");
    const cSrc = head.indexOf("source_type");
    rows.forEach((r) => {
      const start = samsungUtc(r[cS]), end = samsungUtc(r[cE]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      const map = SAMSUNG_EX_TYPES[Number(r[cT])] || { type: 58 };
      const x = { start, end, type: map.type, imp: 1 };
      const title = (cTitle >= 0 && r[cTitle]) || map.title;
      if (title) x.title = String(title).slice(0, 80);
      const kcal = samsungNum(r[cK]), dist = samsungNum(r[cD]), ha = samsungNum(r[cHa]), hm = samsungNum(r[cHm]);
      if (kcal > 0) x.kcal = Math.round(kcal);
      if (dist > 0) x.distanceM = Math.round(dist);
      if (ha > 0) x.hrAvg = Math.round(ha);
      if (hm > 0) x.hrMax = Math.round(hm);
      // source_type 4 = caminhada que o relógio detectou sozinho (10-20 min): fica no dia, mas não na caixinha
      if (cSrc >= 0 && r[cSrc] === "4") x.auto = 1;
      exercises.push(x);
    });
    found.exercise = exercises.length;
  }
  await samsungParseBody(byKey, day, found);
  return { days, sleep, exercises, found };
}

// v1.94 (🩻 RAIO ULTRA X): stress, energy, HRV, SpO2, temperatura, respiração, andares e ronco
async function samsungParseBody(byKey, day, found) {
  const read = async (key) => (byKey[key] ? samsungCsvRows(await samsungReadFile(byKey[key])) : null);
  const local = (s) => { const t = samsungUtc(s); return Number.isFinite(t) ? { t, iso: toIsoDate(new Date(t)) } : null; };
  const one = (v) => Math.round(v * 10) / 10;

  const stress = await read("stress");
  if (stress) {
    const { head, rows } = stress;
    const cS = samsungCol(head, "start_time"), cScore = samsungCol(head, "score");
    const acc = {};
    rows.forEach((r) => {
      const at = local(r[cS]), v = samsungNum(r[cScore]);
      if (!at || !(v > 0) || v > 100) return;
      const a = (acc[at.iso] = acc[at.iso] || { sum: 0, n: 0, max: 0, peak: 0, high: 0 });
      a.sum += v; a.n++;
      if (v >= 70) a.high++;
      if (v > a.max) { a.max = v; a.peak = new Date(at.t).getHours(); }
    });
    Object.keys(acc).forEach((iso) => {
      const a = acc[iso];
      if (a.n < 3) return; // relógio no pulso só 1-2 h não diz nada do dia
      Object.assign(day(iso), { stress: Math.round(a.sum / a.n), stressMax: Math.round(a.max), stressPeak: a.peak, stressHigh: a.high });
    });
    found.stress = Object.keys(acc).length;
  }

  const vit = await read("vitality");
  if (vit) {
    const { head, rows } = vit;
    const cDay = samsungCol(head, "day_time"), cScore = samsungCol(head, "total_score");
    const cHrv = samsungCol(head, "shrv_value"), cShr = samsungCol(head, "shr_value");
    let n = 0;
    rows.forEach((r) => {
      const iso = samsungDayOf(r[cDay]);
      if (!iso) return;
      const d = day(iso);
      const e = samsungNum(r[cScore]), h = samsungNum(r[cHrv]), hr = samsungNum(r[cShr]);
      if (e > 0 && e <= 100) d.energy = Math.round(e);
      if (h > 0 && h < 200) d.hrv = Math.round(h);
      if (hr > 25 && hr < 150) d.restHr = Math.round(hr);
      n++;
    });
    found.vitality = n;
  }

  const spo2 = await read("spo2");
  if (spo2) {
    const { head, rows } = spo2;
    const cE = samsungCol(head, "end_time"), cS = samsungCol(head, "start_time"), cV = samsungCol(head, "spo2"), cMin = samsungCol(head, "min");
    const best = {};
    rows.forEach((r) => {
      const at = local(r[cE]), v = samsungNum(r[cV]), lo = samsungNum(r[cMin]);
      if (!at || !(v >= 70 && v <= 100)) return;
      const long = samsungUtc(r[cE]) - samsungUtc(r[cS]);
      // a medida da noite (longa) ganha da medida avulsa de 30 s
      if (!best[at.iso] || long > best[at.iso].long) best[at.iso] = { v, lo: lo >= 50 && lo <= 100 ? lo : null, long };
    });
    Object.keys(best).forEach((iso) => {
      const d = day(iso);
      d.spo2 = Math.round(best[iso].v);
      if (best[iso].lo !== null) d.spo2Min = Math.round(best[iso].lo);
    });
    found.spo2 = Object.keys(best).length;
  }

  const temp = await read("temp");
  if (temp) {
    const { head, rows } = temp;
    const cE = samsungCol(head, "end_time"), cV = samsungCol(head, "temperature");
    let n = 0;
    rows.forEach((r) => {
      const at = local(r[cE]), v = samsungNum(r[cV]);
      if (!at || !(v > 25 && v < 42)) return;
      day(at.iso).temp = one(v);
      n++;
    });
    found.temp = n;
  }

  const resp = await read("resp");
  if (resp) {
    const { head, rows } = resp;
    const cE = samsungCol(head, "end_time"), cV = samsungCol(head, "average");
    let n = 0;
    rows.forEach((r) => {
      const at = local(r[cE]), v = samsungNum(r[cV]);
      if (!at || !(v > 4 && v < 40)) return;
      day(at.iso).resp = one(v);
      n++;
    });
    found.resp = n;
  }

  const floors = {};
  const fl = await read("floors");
  if (fl) {
    const { head, rows } = fl;
    const cDay = samsungCol(head, "day_time"), cV = samsungCol(head, "floor_count");
    rows.forEach((r) => {
      const iso = samsungDayOf(r[cDay]), v = samsungNum(r[cV]);
      if (iso && v !== null && v >= 0) floors[iso] = Math.max(floors[iso] || 0, v);
    });
  }
  const flRaw = await read("floorsRaw");
  if (flRaw) {
    const { head, rows } = flRaw;
    const cS = samsungCol(head, "start_time"), cV = samsungCol(head, "floor");
    const sum = {};
    rows.forEach((r) => {
      const at = local(r[cS]), v = samsungNum(r[cV]);
      if (at && v > 0) sum[at.iso] = (sum[at.iso] || 0) + v;
    });
    Object.keys(sum).forEach((iso) => { if (floors[iso] === undefined) floors[iso] = sum[iso]; });
  }
  Object.keys(floors).forEach((iso) => { day(iso).floors = Math.round(floors[iso]); });
  if (fl || flRaw) found[fl ? "floors" : "floorsRaw"] = Object.keys(floors).length;

  const snore = await read("snore");
  if (snore) {
    const { head, rows } = snore;
    const cE = samsungCol(head, "end_time"), cD = samsungCol(head, "duration");
    const acc = {};
    rows.forEach((r) => {
      const at = local(r[cE]), ms = samsungNum(r[cD]);
      if (!at || ms === null || ms < 0 || at.iso < "2000-01-01") return;
      acc[at.iso] = (acc[at.iso] || 0) + ms;
    });
    Object.keys(acc).forEach((iso) => { day(iso).snoreMin = Math.round(acc[iso] / 60000); });
    found.snore = Object.keys(acc).length;
  }
}

// Junta no banco sem mexer no que já tinha. Devolve { days, from, to, filled }
function samsungApply(parsed) {
  const w = watchEnsureDb();
  if (!w.days || typeof w.days !== "object" || Array.isArray(w.days)) w.days = {};
  const nights = watchGroupSleep(parsed.sleep);
  const exByDay = {};
  parsed.exercises.forEach((x) => {
    const iso = toIsoDate(new Date(x.start));
    (exByDay[iso] = exByDay[iso] || []).push(x);
  });
  const dates = new Set([...Object.keys(parsed.days), ...Object.keys(nights), ...Object.keys(exByDay)]);
  const today = toIsoDate();
  let touched = 0, filled = 0;
  [...dates].sort().forEach((iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > today) return;
    const old = w.days[iso] && typeof w.days[iso] === "object" ? w.days[iso] : {};
    const next = { ...old };
    let changed = false;
    const src = parsed.days[iso] || {};
    Object.keys(src).forEach((f) => {
      if (next[f] === undefined || next[f] === null) { next[f] = src[f]; changed = true; filled++; }
    });
    if (nights[iso] && !next.sleep) { next.sleep = nights[iso]; changed = true; filled++; }
    if (exByDay[iso]) {
      const list = Array.isArray(next.ex) ? next.ex.slice() : [];
      exByDay[iso].forEach((x) => {
        if (list.some((y) => Math.abs(Number(y.start) - x.start) < 3 * 60000)) return;
        list.push(x);
        changed = true;
        filled++;
      });
      if (changed) next.ex = list.sort((a, b) => a.start - b.start);
    }
    if (!changed || !watchHasData(next)) return;
    next.at = Date.now();
    w.days[iso] = next;
    touched++;
  });
  const all = Object.keys(w.days).sort();
  w.samsungImport = { at: Date.now(), from: all[0] || "", to: all[all.length - 1] || "", days: touched };
  return { days: touched, filled, from: all[0] || "", to: all[all.length - 1] || "" };
}

function openSamsungImport() {
  samsungPicked = [];
  renderSamsungPicked();
  const last = watchDb() && watchDb().samsungImport;
  document.getElementById("samsungLast").textContent = last && last.at
    ? `Última importação: ${new Date(last.at).toLocaleDateString("pt-BR")} · ${watchInt(last.days)} dias atualizados.`
    : "";
  openTobaModal("samsungModal");
}

function renderSamsungPicked() {
  const el = document.getElementById("samsungFiles");
  const btn = document.getElementById("samsungGo");
  const hits = SAMSUNG_FILES.map((d) => ({ d, f: samsungPicked.find((f) => d.test.test(f.name)) }));
  el.innerHTML = hits
    .filter(({ d, f }) => d.key !== "pedometer" || (f && !hits[0].f))
    .map(({ d, f }) => `<div class="samsung-file"><span>${d.label}</span><span>${f ? "✅" : "—"}</span></div>`)
    .join("");
  btn.disabled = !hits.some(({ f }) => f);
}

function samsungPick(el) {
  samsungPicked = Array.from(el.files || []).filter((f) => /\.csv$/i.test(f.name));
  renderSamsungPicked();
  if (!samsungPicked.length && (el.files || []).length) {
    showPageMessage("Nenhum CSV do Samsung Health nesses arquivos. Procura a pasta Download › Samsung Health.", { title: "Não achei os arquivos" });
  }
}

async function samsungGo() {
  const btn = document.getElementById("samsungGo");
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "⏳ Lendo...";
  try {
    const parsed = await samsungParse(samsungPicked);
    const res = samsungApply(parsed);
    saveHealthDb();
    closeTobaModal("samsungModal");
    renderWatch();
    const fmt = (iso) => (iso ? iso.split("-").reverse().join("/") : "?");
    showPageMessage(
      res.days
        ? `${watchInt(res.days)} dias ganharam dado do Samsung Health (de ${fmt(res.from)} até ${fmt(res.to)}). O que já tinha vindo do relógio ficou igual.`
        : "Tudo que tinha nesses arquivos já estava no Toba. Nada mudou.",
      { title: "📥 Histórico importado" },
    );
  } catch (e) {
    showPageMessage(`Não consegui ler os arquivos.\n\n(${e && e.message ? e.message : e})`, { title: "Deu ruim" });
  } finally {
    btn.textContent = "📥 Importar";
    renderSamsungPicked();
  }
}

tobaActions({ openSamsungImport, samsungGo, samsungPick });
