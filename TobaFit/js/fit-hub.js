/* Toba Fit (v2.17) · hub: resumo do mês. Só LÊ o healthDb (health-core.js)
 * pelo calcHealthSummary (health-metrics.js), o mesmo do card do portal. */

function renderFitHub() {
  const box = document.getElementById("fitHubStats");
  if (!box) return;
  const h = calcHealthSummary(typeof healthDb === "object" ? healthDb : {});
  const n = (v, d = 0) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
  const tile = (label, value, sub) => `
    <div class="toba-stat">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </div>`;
  if (!h.monthCount && !h.weekCount && !h.monthSaitamaReps) {
    box.innerHTML = `<div class="fit-empty-span">${tobaEmpty("🛋️", "Nada treinado no mês ainda", "Abre o 🏋️ Treinos & Cargas e manda o primeiro. O sofá não vai sentir falta.", { compact: true })}</div>`;
    return;
  }
  box.innerHTML = [
    tile("🏋️ Treinos mês", `<span class="text-green">${n(h.monthCount)}</span>`, `em ${n(h.monthActiveDays)} de ${n(h.elapsedDays)} dias`),
    tile("📅 Semana", n(h.weekCount), "desde segunda"),
    tile("📍 Km no mês", `<span class="text-blue">${n(h.monthKm, 2)} km</span>`, "caminhada e cardio"),
    tile("👊 Saitama", `<span class="text-coral">${n(h.monthSaitamaReps)} reps</span>`, "flex + abd + agach"),
  ].join("");
}

document.addEventListener("DOMContentLoaded", renderFitHub);
window.onHealthDataReplaced = renderFitHub;
