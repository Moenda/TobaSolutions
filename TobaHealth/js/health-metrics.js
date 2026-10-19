/* =====================================================================
 * Toba Health · resumo do mês para o portal (card do Toba Health)
 * - Só lê o banco recebido; não grava nada e não depende de health-core.js
 *   (o portal carrega este arquivo sozinho, depois do toba-common.js).
 * - Treinos do mês seguem a MESMA regra de getWorkoutMonthStats (treinos.js):
 *   treinos do mês até hoje; flexão/abdominal/agachamento só do Saitama.
 *   Mudou a regra lá? Mude aqui também, senão o card e a tela não batem.
 * - Peso levantado fica de fora: depende do catálogo de força (forca.js).
 * ===================================================================== */

function calcHealthSummary(healthData, referenceDate = new Date()) {
  const data = healthData && typeof healthData === "object" ? healthData : {};
  const today = toIsoDate(referenceDate);
  const monthKey = today.slice(0, 7);
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  const num = (value) => Number(value) || 0;

  /* ---------- Pesagens ---------- */
  // Mais recente primeiro (mesma ordem da tela de Pesagem). Data igual: o
  // id maior (Date.now()) é o registro mais novo.
  const weighIns = (Array.isArray(data.weighIns) ? data.weighIns : [])
    .filter((w) => w && isIso(w.date) && num(w.weight) > 0 && w.date <= today)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || num(b.id) - num(a.id));
  const latest = weighIns[0] || null;
  const previous = weighIns[1] || null;
  // Base do mês: última pesagem antes do mês; sem ela, a primeira do mês.
  const beforeMonth = weighIns.find((w) => w.date < `${monthKey}-01`);
  const inMonth = weighIns.filter((w) => w.date.startsWith(monthKey));
  const monthBase = beforeMonth || inMonth[inMonth.length - 1] || null;
  const daysSince = (iso) =>
    Math.round((new Date(`${today}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);

  /* ---------- Treinos ---------- */
  const workouts = (Array.isArray(data.workouts) ? data.workouts : []).filter(
    (w) => w && isIso(w.date) && w.date <= today,
  );
  const monthWorkouts = workouts.filter((w) => w.date.startsWith(monthKey));
  const saitama = monthWorkouts.filter((w) => w.type === "saitama");
  const sum = (field, items = monthWorkouts) => items.reduce((total, w) => total + num(w[field]), 0);

  const monday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStart = toIsoDate(monday);
  const lastWorkout = workouts.reduce((best, w) => (!best || w.date > best.date ? w : best), null);

  return {
    weight: latest ? num(latest.weight) : null,
    weightDate: latest ? latest.date : "",
    weightDaysAgo: latest ? daysSince(latest.date) : null,
    weightDiff: latest && previous ? num(latest.weight) - num(previous.weight) : null,
    weightMonthDiff: latest && monthBase && monthBase !== latest ? num(latest.weight) - num(monthBase.weight) : null,
    weighInsMonth: inMonth.length,
    fat: latest && latest.fat !== null && latest.fat !== undefined && latest.fat !== "" ? num(latest.fat) : null,
    monthCount: monthWorkouts.length,
    monthActiveDays: new Set(monthWorkouts.map((w) => w.date)).size,
    elapsedDays: referenceDate.getDate(),
    monthMinutes: sum("durationMinutes"),
    monthCalories: sum("calories"),
    monthKm: sum("distanceKm"),
    monthSaitamaReps: sum("pushups", saitama) + sum("situps", saitama) + sum("squats", saitama),
    weekCount: workouts.filter((w) => w.date >= weekStart).length,
    todayWorkouts: workouts.filter((w) => w.date === today),
    lastWorkoutDaysAgo: lastWorkout ? daysSince(lastWorkout.date) : null,
  };
}
