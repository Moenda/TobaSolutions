/* =====================================================================
 * Toba · página do Perfil do jogador (Toba-Perfil.html)
 * Depende de toba-common.js, health-metrics.js, toba-player.js,
 * TobaHealth/js/hall-shared.js e perfil-hall.js (Hall dos Heróis, desde v1.47).
 * Só desenha o estado calculado por computePlayer(); grava apenas
 * playerDb.settings / playerDb.equipped (TOBA_PLAYER_DB) e toba_player_prefs.
 * ===================================================================== */
let profileTab = "title";

function formatProfileDate(iso) {
  return iso ? isoToBrDate(iso) : "";
}

function renderProfileHero(state) {
  const look = getPlayerLook(state);
  const nextTitle = PLAYER_LEVEL_TITLES.find((t) => t.min > state.level);
  document.getElementById("pfHero").innerHTML = `
    ${renderPlayerAvatar(state, "lg")}
    <div class="pf-hero-title">${look.title.icon} ${escapeHtml(look.title.name)}</div>
    <div class="pf-hero-level">Nível ${state.level}</div>
    ${renderPlayerBar(state.ratio)}
    <div class="pf-hero-xp">
      <span>${formatPlayerNumber(state.into)} / ${formatPlayerNumber(state.need)} XP</span>
      <span>faltam ${formatPlayerNumber(state.next - state.xp)} para o nível ${state.level + 1}</span>
    </div>
    ${nextTitle ? `<div class="pf-hero-next">Próximo título no nível ${nextTitle.min}: ${nextTitle.icon} ${nextTitle.name}</div>` : ""}`;

  const unlocked = state.achievements.filter((a) => a.unlocked).length;
  const stat = (label, value, sub, extra = "") => `
    <div class="toba-stat${extra}">
      <span class="toba-stat-label">${label}</span>
      <span class="toba-stat-value">${value}</span>
      <span class="toba-stat-sub">${sub}</span>
    </div>`;
  document.getElementById("pfStats").innerHTML = [
    stat("🔥 Streak", `<span class="text-coral">${state.streak.current} ${state.streak.current === 1 ? "dia" : "dias"}</span>`, `Recorde: ${state.streak.best} ${state.streak.best === 1 ? "dia" : "dias"}`),
    stat("✨ XP total", `<span class="text-gold">${formatPlayerNumber(state.xp)}</span>`, `${formatPlayerNumber(state.stats.workouts)} treinos contados`),
    stat("🏅 Conquistas", `<span class="text-green">${unlocked}/${state.achievements.length}</span>`, `${Math.round((unlocked / state.achievements.length) * 100)}% do álbum`),
    stat("📈 Recordes", `<span class="text-blue">${formatPlayerNumber(state.stats.records)}</span>`, "pessoais batidos"),
  ].join("");
}

function renderProfileStreak(state) {
  const streak = state.streak;
  const week = streak.week;
  const labels = ["S", "T", "Q", "Q", "S", "S", "D"];
  const dots = week.days.map((day, i) => {
    const cls = week.trained[i] ? " is-done" : day === state.today ? " is-today" : day > state.today ? " is-future" : "";
    return `<span class="pf-day${cls}"><span class="pf-day-dot">${week.trained[i] ? "🔥" : ""}</span><span>${labels[i]}</span></span>`;
  }).join("");
  const nextMilestone = PLAYER_STREAK_MILESTONES.find((m) => m.days > streak.current);
  const status = streak.current
    ? `Começou em ${formatProfileDate(streak.start)}. ${nextMilestone ? `Faltam ${nextMilestone.days - streak.current} dias para o bônus de ${nextMilestone.days} dias (+${formatPlayerNumber(nextMilestone.xp)} XP).` : "Você passou de todos os marcos. Lenda."}`
    : "Sem streak agora. Treine e bata a meta da semana para acender o 🔥.";
  document.getElementById("pfStreak").innerHTML = `
    <div class="pf-streak-head">
      <span class="pf-streak-big${streak.current ? " is-on" : ""}">🔥 ${streak.current}</span>
      <span class="pf-streak-text"><strong>${describePlayerWeek(streak)}</strong><span>${status}</span></span>
    </div>
    <div class="pf-week">${dots}</div>
    <p class="pf-note">Regra: o streak conta os dias seguidos e não apaga enquanto toda semana (seg a dom) tiver pelo menos <strong>${week.goal} ${week.goal === 1 ? "dia" : "dias"} de treino</strong>. Dá para mudar a meta na ⚙️. Bônus em 7, 30, 100 e 365 dias.</p>`;
}

function renderProfileAchievements(state) {
  const unlocked = state.achievements.filter((a) => a.unlocked).length;
  document.getElementById("pfAchCount").textContent = `${unlocked}/${state.achievements.length}`;
  document.getElementById("pfAchievements").innerHTML = PLAYER_ACHIEVEMENT_CATS.map((cat) => {
    const items = state.achievements.filter((a) => a.cat === cat.id);
    if (!items.length) return "";
    const done = items.filter((a) => a.unlocked).length;
    const tiles = items.map((a) => {
      const mystery = isPlayerAchievementHidden(a, state);
      return `
        <button type="button" class="pf-ach${a.unlocked ? " is-unlocked" : ""}" data-click="openAchievement" data-id="${a.id}">
          <span class="tp-medal tp-tier-${a.tier}">${mystery ? "❓" : a.icon}</span>
          <span class="pf-ach-name">${mystery ? "???" : escapeHtml(a.name)}</span>
          ${a.unlocked ? "" : renderPlayerBar(a.progress, " is-mini")}
        </button>`;
    }).join("");
    return `
      <div class="pf-ach-group">
        <div class="pf-ach-title"><span>${cat.name}</span><span>${done}/${items.length}</span></div>
        <div class="pf-ach-grid">${tiles}</div>
      </div>`;
  }).join("");
}

function openAchievement(id) {
  const state = tobaPlayerState;
  const a = state?.achievements.find((item) => item.id === id);
  if (!a) return;
  const mystery = isPlayerAchievementHidden(a, state);
  const goalText = a.goal >= 1000 ? formatPlayerNumber(a.goal) : Number(a.goal.toFixed(1)).toLocaleString("pt-BR");
  const valueText = a.value >= 1000 ? formatPlayerNumber(Math.min(a.value, a.goal)) : Number(Math.min(a.value, a.goal).toFixed(1)).toLocaleString("pt-BR");
  document.getElementById("achModalTitle").textContent = a.unlocked ? "🏅 Conquistada!" : "🔒 Ainda não";
  document.getElementById("achModalContent").innerHTML = `
    <div class="pf-ach-detail">
      <span class="tp-medal tp-tier-${a.tier} is-big${a.unlocked ? "" : " is-locked"}">${mystery ? "❓" : a.icon}</span>
      <strong>${mystery ? `??? (conquista ${a.tier === "lenda" ? "lendária" : "secreta"})` : escapeHtml(a.name)}</strong>
      <span class="pf-tier pf-tier-${a.tier}">${PLAYER_TIERS[a.tier].name} · +${formatPlayerNumber(a.xp)} XP</span>
      <p>${a.unlocked ? escapeHtml(a.desc) : escapeHtml(a.hint)}</p>
      ${a.unlocked ? `<span class="pf-note">Desbloqueada em ${formatProfileDate(a.date)}</span>` : `
        ${renderPlayerBar(a.progress)}
        <span class="pf-note">${valueText} de ${goalText} · ${Math.floor(a.progress * 100)}%</span>`}
      ${a.title && !mystery ? `<span class="tp-chip">🎖️ Dá o título ${escapeHtml(a.title)}</span>` : ""}
    </div>`;
  openTobaModal("achModal");
}

function renderProfileRewards(state) {
  document.querySelectorAll(".pf-tabs .tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === profileTab));
  const look = getPlayerLook(state);
  const need = (item) => {
    if (!item.achievement) return `Nível ${item.level}`;
    const a = PLAYER_ACHIEVEMENTS.find((x) => x.id === item.achievement);
    return isPlayerAchievementHidden(a, state) ? "Conquista ???" : `Conquista: ${a.name}`;
  };
  const tile = ({ id, unlocked, active, preview, name, lockText }) => `
    <button type="button" class="pf-reward${active ? " is-active" : ""}${unlocked ? "" : " is-locked"}" data-click="equipReward" data-kind="${profileTab}" data-id="${id}"${unlocked ? "" : ` data-locked="${escapeHtml(lockText)}"`}>
      <span class="pf-reward-preview">${unlocked ? preview : "🔒"}</span>
      <span class="pf-reward-name">${name}</span>
      ${unlocked ? "" : `<span class="pf-reward-lock">${escapeHtml(lockText)}</span>`}
    </button>`;
  let html = "";
  if (profileTab === "title") {
    const auto = playerLevelTitle(state.level);
    html = `<div class="pf-title-list">
      ${tile({ id: "", unlocked: true, active: !look.title.id, preview: auto.icon, name: `Automático (${auto.name})`, lockText: "" })}
      ${getPlayerTitles(state).map((t) => tile({ id: t.id, unlocked: t.unlocked, active: look.title.id === t.id, preview: t.icon, name: t.unlocked || !t.need.includes("???") ? escapeHtml(t.name) : "???", lockText: t.need })).join("")}
    </div>`;
  } else {
    const list = { avatar: PLAYER_AVATARS, frame: PLAYER_FRAMES, color: PLAYER_COLORS }[profileTab];
    const current = look[profileTab].id;
    html = `<div class="pf-reward-grid">${list.map((item) => {
      const unlocked = isPlayerRewardUnlocked(item, state);
      let preview = item.icon || "";
      if (profileTab === "frame") preview = `<span class="tp-avatar is-sm tp-frame-${item.id}"><span class="tp-avatar-icon">${look.avatar.icon}</span></span>`;
      if (profileTab === "color") preview = `<span class="pf-color" style="background:${item.color}"></span>`;
      return tile({ id: item.id, unlocked, active: current === item.id, preview, name: item.name || "", lockText: need(item) });
    }).join("")}</div>`;
  }
  document.getElementById("pfRewards").innerHTML = html;
}

async function equipReward(el) {
  if (el.dataset.locked) {
    showPageMessage(`Ainda bloqueado. Libera com: ${el.dataset.locked}.`, { title: "Calma, apressado", icon: "🔒" });
    return;
  }
  if (!isPlayerDbLoaded) return;
  playerDb.equipped[el.dataset.kind] = el.dataset.id;
  if (savePlayerDb()) tobaSaved("Equipado ✓");
  renderProfile(tobaPlayerState);
}

const PLAYER_EVENT_KINDS = {
  workout: "🏋️ Treinos",
  record: "📈 Recordes",
  achievement: "🏅 Conquistas",
  streak: "🔥 Bônus de streak",
  task: "✅ Rotina",
  oneoff: "🛠️ Tasks",
};

function renderProfileLedger(state) {
  const totals = {};
  state.events.forEach((e) => {
    totals[e.kind] = (totals[e.kind] || 0) + e.xp;
  });
  const summary = Object.keys(PLAYER_EVENT_KINDS)
    .map((kind) => `<div class="kv-row"><span>${PLAYER_EVENT_KINDS[kind]}</span><strong>${formatPlayerNumber(totals[kind] || 0)} XP</strong></div>`)
    .join("");
  const recent = [...state.events].reverse().filter((e) => e.xp > 0).slice(0, 30);
  const capped = state.events.some((e) => e.capped);
  document.getElementById("pfLedger").innerHTML = `
    <div class="kv-list">${summary}<div class="kv-row is-total"><span>Total</span><strong>${formatPlayerNumber(state.xp)} XP</strong></div></div>
    <div class="pf-ledger">${recent.length ? recent.map((e) => `
      <div class="pf-ledger-row">
        <span class="pf-ledger-icon">${e.icon}</span>
        <span class="pf-ledger-text"><strong>${escapeHtml(e.label)}</strong><span>${formatProfileDate(e.date)}</span></span>
        <span class="pf-ledger-xp">+${formatPlayerNumber(e.xp)}</span>
      </div>`).join("") : tobaEmpty("🫙", "Nenhum XP ainda", "Registre um treino no Toba Health.", { compact: true })}</div>
    <p class="pf-note">Treino: 40 XP + 1 por minuto (até 90) + 3 por série (até 60) + 1 a cada 10 flexões/abdominais/agachamentos (até 60) + 8 por km (até 80). Máximo de ${PLAYER_XP.dayCap} XP de treino por dia${capped ? " (alguns dias bateram no teto)" : ""}. Recorde pessoal: +${PLAYER_XP.record} (até ${PLAYER_XP.recordsPerWorkout} por treino). Rotina: ☕ fácil 10, 😐 médio 25, 🧘 difícil 60 (atrasada vale metade; até ${ROUTINE_XP_DAY_CAP} XP de rotina por dia). Task: 20 XP por hora feita (mínimo 15, até 150 por vez), fora do teto da rotina. Cozinha: receita feita não dá XP sozinha, só as conquistas 🍳. Apagou um treino ou desmarcou uma tarefa? O XP sai junto.</p>`;
}

function renderProfileLevels(state) {
  let total = 0;
  const rows = [];
  for (let level = 1; level <= 60; level++) {
    const title = PLAYER_LEVEL_TITLES.find((t) => t.min === level);
    rows.push(`<tr class="${level === state.level ? "is-current" : level < state.level ? "is-done" : ""}">
      <td>${level}</td><td>${formatPlayerNumber(total)}</td><td>${formatPlayerNumber(playerXpToNext(level))}</td><td>${title ? `${title.icon} ${title.name}` : ""}</td>
    </tr>`);
    total += playerXpToNext(level);
  }
  document.getElementById("pfLevels").innerHTML = `
    <table class="pf-level-table">
      <thead><tr><th>Nv.</th><th>XP total</th><th>Próximo</th><th>Título</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
    <p class="pf-note">Cada nível pede 60·n + 3·n² XP (arredondado). Depois do 60 continua subindo, mas o título já é o máximo.</p>`;
}

function renderProfile(state) {
  if (!state) return;
  document.getElementById("pfLocked").hidden = isPlayerDbLoaded;
  renderProfileHero(state);
  renderProfileHall(state);
  renderProfileStreak(state);
  renderProfileAchievements(state);
  renderProfileRewards(state);
  renderProfileLedger(state);
  renderProfileLevels(state);
  fillProfileSettings();
}

function fillProfileSettings() {
  const prefs = getPlayerPrefs();
  const goal = document.getElementById("pfGoalValue");
  if (!goal) return;
  goal.textContent = playerDb.settings.weeklyGoal;
  document.getElementById("pfSound").checked = prefs.sound;
  document.getElementById("pfVibrate").checked = prefs.vibrate;
}

/* ---------------------------------------------------------------------
 * Backup só do perfil (a ⚙️ desta página)
 * ------------------------------------------------------------------- */
function exportPlayerBackup() {
  tobaDownloadJson(playerDb, `toba_perfil_backup_${toIsoDate()}.json`);
}

async function importPlayerBackup(text) {
  try {
    const data = JSON.parse(text);
    const looksLike = data && typeof data === "object" && !Array.isArray(data) && (data.seen || data.equipped || data.settings);
    if (!looksLike) throw new Error("Não é backup do perfil");
    playerDb = normalizePlayerDb(data);
  } catch (err) {
    showPageMessage("Esse arquivo não é um backup do Perfil do jogador.", { title: "Arquivo inválido", icon: "🤨" });
    return;
  }
  isPlayerDbLoaded = true;
  playerIsNew = false;
  savePlayerDb();
  closeDataModal();
  tobaPlayerCheck({ silent: true });
  showPageMessage("Perfil restaurado! O XP é recalculado dos seus treinos.", { title: "Tudo de volta", icon: "✅" });
}

async function resetPlayerProfile() {
  const confirmed = await showPageMessage(
    "Zera as recompensas escolhidas, a meta do streak e o que já foi comemorado. O XP e as conquistas NÃO somem: eles vêm dos seus treinos.",
    { title: "Recomeçar perfil?", icon: "🔄", confirm: true, confirmLabel: "Recomeçar" },
  );
  if (!confirmed) return;
  try {
    localStorage.removeItem(PLAYER_KEY);
  } catch (err) {
    // segue: a próxima gravação substitui
  }
  playerDb = createEmptyPlayerDb();
  isPlayerDbLoaded = true;
  playerIsNew = true;
  closeDataModal();
  tobaPlayerCheck();
}

tobaSetupApp({
  name: "Perfil do jogador",
  exportBackup: exportPlayerBackup,
  importBackup: importPlayerBackup,
  resetData: resetPlayerProfile,
  dataHint: "O XP, o nível e as conquistas são calculados dos seus treinos, então não se perdem. Este backup guarda só a meta do streak, as recompensas escolhidas e o que já foi comemorado. O backup geral do portal já inclui o perfil.",
});

tobaActions({
  showRewardTab: (el) => {
    profileTab = el.dataset.tab;
    if (tobaPlayerState) renderProfileRewards(tobaPlayerState);
  },
  equipReward,
  openAchievement: (el) => openAchievement(el.dataset.id),
  changeWeeklyGoal: (el) => {
    if (!isPlayerDbLoaded) return;
    const goal = Math.min(7, Math.max(1, playerDb.settings.weeklyGoal + Number(el.dataset.step)));
    if (goal === playerDb.settings.weeklyGoal) return;
    playerDb.settings.weeklyGoal = goal;
    if (savePlayerDb()) tobaSaved();
    fillProfileSettings();
    // Mudar a meta recalcula o streak do histórico inteiro: sem festa por isso.
    tobaPlayerCheck({ silent: true });
  },
  updatePlayerPrefs: () => {
    setPlayerPrefs({ sound: document.getElementById("pfSound").checked, vibrate: document.getElementById("pfVibrate").checked });
    tobaSaved();
  },
  testLevelUp: () => {
    if (!tobaPlayerState) return;
    closeDataModal();
    queuePlayerCelebration(() => showPlayerLevelUp(Math.max(0, tobaPlayerState.level - 1), tobaPlayerState));
  },
});

document.addEventListener("toba:player", (event) => renderProfile(event.detail));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tobaPlayerCheck();
});
tobaPlayerCheck();
