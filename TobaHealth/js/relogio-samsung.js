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
 * Horários do Samsung vêm em UTC ("AAAA-MM-DD HH:MM:SS.mmm"); o dia é o do celular.
 * Datas de dia (day_time) já vêm como o dia certo.
 *
 * REGRA: o que já veio do Health Connect manda. O import só preenche campo vazio do dia,
 * exercício novo só entra se não tiver outro começando a ±3 min, e sono só em dia sem sono.
 * Nada é apagado. Vai pro mesmo TOBA_HEALTH_DB.watch.days (mesmo formato do relogio.js),
 * e TOBA_HEALTH_DB.watch.samsungImport = { at, from, to, days } guarda o resumo.
 * Exercício importado com mais de 30 dias não aparece na caixinha de "Treinos do relógio",
 * nem a caminhada detectada sozinha pelo relógio (ex.auto = 1).
 */

const SAMSUNG_FILES = [
  { key: "steps", test: /step_daily_trend/i, label: "👟 passos" },
  { key: "pedometer", test: /pedometer_day_summary/i, label: "👟 passos (reserva)" },
  { key: "kcal", test: /calories_burned\.details/i, label: "🔥 calorias" },
  { key: "heart", test: /tracker\.heart_rate\.\d/i, label: "❤️ batimentos" },
  { key: "sleep", test: /shealth\.sleep\.\d/i, label: "😴 sono" },
  { key: "stage", test: /health\.sleep_stage\.\d/i, label: "😴 fases do sono" },
  { key: "exercise", test: /shealth\.exercise\.\d/i, label: "🏃 exercícios" },
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
      const x = { start, end, type: map.type };
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
  return { days, sleep, exercises, found };
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
