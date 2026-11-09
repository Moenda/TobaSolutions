/* =====================================================================
 * Toba Health · 🏋️ Treinos · ⌚ Treinos do relógio (v2.04, pedido do Rafa)
 * - A caixinha "⌚ Treinos do relógio" (🔗 Mesclar / ➕ Virar treino / 🙈 Ignorar) e o
 *   "🗑️ Sumiu do relógio" saíram do 🩻 Raio-X e moram SÓ aqui, com o botão ⌚ Sincronizar
 *   (puxa do Health Connect na hora, pelo APK).
 * - O motor continua no relogio.js (carregado nesta página também): watchPull,
 *   onTobaHealthData, watchMerge, watchAutoMerge, renderWatchInbox, renderWatchGone...
 *   Fora do Raio-X o renderWatch() de lá chama o watchPageRefresh() daqui.
 * - Nada muda nos dados: tudo segue no TOBA_HEALTH_DB.watch (handled/gone/goneDone).
 * ===================================================================== */

function trainingWatchPendingCount() {
  return (Array.isArray(healthDb.workouts) ? healthDb.workouts : []).filter((w) => w && w.watchPending && !w.watch).length;
}

function renderTrainingWatch() {
  const box = document.getElementById("trainingWatch");
  if (!box || typeof watchCanNative !== "function") return;
  const native = watchCanNative();
  // Só aparece pra quem usa o relógio (já tem dado dele) ou tá no app com o Health Connect
  if (!native && !workoutWatchUsable()) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  renderWatchGone();
  renderWatchInbox();
  const btn = document.getElementById("trainingWatchSyncBtn");
  if (btn) {
    btn.disabled = watchUi.pulling;
    btn.textContent = watchUi.pulling ? "⏳ Puxando..." : "⌚ Sincronizar";
  }
  const line = document.getElementById("trainingWatchLine");
  if (line) {
    const at = watchState().pulledAt;
    const pending = trainingWatchPendingCount();
    const bits = [watchUi.pulling ? "⏳ Puxando do relógio..." : at ? `⌚ Relógio puxado ${watchAgo(at)}` : "⌚ Relógio ainda não puxado"];
    if (pending) bits.push(`${pending} ${pending === 1 ? "treino esperando" : "treinos esperando"} o relógio`);
    line.textContent = bits.join(" · ");
  }
}

// Chamado pelo renderWatch() do relogio.js nesta página (puxou, mesclou, virou treino, ignorou...)
function watchPageRefresh() {
  renderTrainingWatch();
  const active = document.querySelector(".app-view.active");
  if (!active) return;
  if (active.id === "viewTraining" || active.id === "viewMonth") renderWorkoutScreen();
  if (active.id === "viewWorkout" && typeof renderWorkoutView === "function") renderWorkoutView();
}

function trainingWatchSync() {
  if (!watchCanNative()) {
    watchExplainBrowser();
    return;
  }
  watchPull({ full: false });
  renderTrainingWatch();
}

tobaActions({ trainingWatchSync });

// Abriu o Treinos (ou voltou pro app): puxa calado se já tem permissão e faz +10 min,
// pra o "⌚ Vai mesclar com o relógio?" se resolver sozinho.
document.addEventListener("DOMContentLoaded", () => {
  renderTrainingWatch();
  if (typeof watchAutoPull === "function") watchAutoPull();
});
