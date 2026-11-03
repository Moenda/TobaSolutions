/* =====================================================================
 * Toba · página do Perfil do jogador (Toba-Perfil.html)
 * Depende de toba-common.js, health-metrics.js, toba-player.js,
 * TobaHealth/js/hall-shared.js e perfil-hall.js (Hall dos Heróis, desde v1.47).
 * Só desenha o estado calculado por computePlayer(); grava apenas
 * playerDb.settings / playerDb.equipped (TOBA_PLAYER_DB) e toba_player_prefs.
 * ===================================================================== */
let profileTab = "title";
let profileCustomOpen = false;
let profileSeasonOpen = false;
let profileSeasonPick = ""; // "halloween-2026" escolhida no calendário

// Bloquinho de lego do 🧱 Personalizar (SVG pra não depender de emoji)
const PROFILE_LEGO_SVG = `<svg viewBox="0 0 32 24" aria-hidden="true" class="pf-lego-svg">
  <rect x="6" y="1" width="7" height="5" rx="1.5"/><rect x="19" y="1" width="7" height="5" rx="1.5"/>
  <rect x="1" y="5" width="30" height="18" rx="3"/>
  <rect x="4" y="8" width="24" height="3" rx="1.5" class="pf-lego-shine"/>
</svg>`;

function formatProfileDate(iso) {
  return iso ? isoToBrDate(iso) : "";
}

function renderProfileHero(state) {
  const look = getPlayerLook(state);
  const nextTitle = PLAYER_LEVEL_TITLES.find((t) => t.min > state.level);
  document.getElementById("pfHero").innerHTML = `
    <span class="pf-hero-glow tp-bg-${look.bg.id}" aria-hidden="true"></span>
    ${renderPlayerFx(look.bg.id)}
    ${renderProfileSeasonButton(state)}
    <button type="button" class="pf-lego" data-click="openCustomize" aria-label="Personalizar o perfil">${PROFILE_LEGO_SVG}<span>Personalizar</span></button>
    <button type="button" class="pf-hero-avatar" data-click="openCustomize" aria-label="Personalizar o perfil">${renderPlayerAvatar(state, "lg")}</button>
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

// 🎉 Botãozinho da Temporada (v1.64, no lugar do aviso fixo da v1.63).
// Mostra o emoji da festa rolando (ou da próxima); o pontinho pisca se tem troféu pra pegar.
function renderProfileSeasonButton(state) {
  const hits = playerSeasonsOn(state.today);
  const next = hits[0] || profileSeasonTimeline(state.today).find((h) => h.start > state.today);
  const icon = next ? next.season.icon : "🎉";
  const live = hits.length > 0;
  const pending = hits.some((h) => !state.unlockedIds.has(`ss-${h.key}`));
  const label = live ? `Temporada: ${hits.map((h) => h.season.label).join(" + ")} rolando` : "Temporadas do Toba";
  return `<button type="button" class="pf-season-btn${live ? " is-live" : ""}" data-click="openSeason" aria-label="${escapeHtml(label)}">
      <span class="pf-season-btn-icon">${icon}</span><span>Temporada</span>${pending ? `<i class="pf-season-dot" aria-hidden="true"></i>` : ""}
    </button>`;
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

/* ---------------------------------------------------------------------
 * 🧱 Personalizar (v1.62): título, avatar, moldura, cor e fundo.
 * Abre no lugar do Perfil (igual ao Hall). Só grava playerDb.equipped.
 * ------------------------------------------------------------------- */
const PROFILE_CUSTOM_TABS = [
  { id: "title", name: "Título", hint: "O título aparece embaixo do avatar e pra tropa no 🤝 Toba dos amigos." },
  { id: "avatar", name: "Avatar", hint: "Uns liberam subindo de nível, outros só com conquista. Pega todos, monstro." },
  { id: "frame", name: "Moldura", hint: "O aro em volta do avatar. As brabas giram e brilham. ✨" },
  { id: "color", name: "Cor", hint: "Pinta o selo do nível (e o aro, se a moldura for a Simples)." },
  { id: "bg", name: "Fundo", hint: "O fundo do círculo e o brilho do teu card. Lá embaixo tem a ULTIMATE EDITION. 🌈" },
];

function profileRewardList(tab) {
  return { avatar: PLAYER_AVATARS, frame: PLAYER_FRAMES, color: PLAYER_COLORS, bg: PLAYER_BGS }[tab] || [];
}

function profileTabCount(tab, state) {
  if (tab === "title") {
    const titles = getPlayerTitles(state);
    return `${titles.filter((t) => t.unlocked).length}/${titles.length}`;
  }
  const list = profileRewardList(tab);
  return `${list.filter((item) => isPlayerRewardUnlocked(item, state)).length}/${list.length}`;
}

function renderProfileCustomPreview(state) {
  const look = getPlayerLook(state);
  document.getElementById("pfCustomPreview").innerHTML = `
    <span class="pf-hero-glow tp-bg-${look.bg.id}" aria-hidden="true"></span>
    ${renderPlayerFx(look.bg.id)}
    ${renderPlayerAvatar(state, "lg")}
    <div class="pf-hero-title">${look.title.icon} ${escapeHtml(look.title.name)}</div>
    <div class="pf-custom-parts">
      <span>${look.avatar.icon} Avatar</span>
      <span>🖼️ ${escapeHtml(look.frame.name)}</span>
      <span>🎨 ${escapeHtml(look.color.name)}</span>
      <span>${look.bg.ultimate ? "✨" : "🖌️"} ${escapeHtml(look.bg.name)}</span>
    </div>`;
}

// Mini avatar com uma peça trocada (pra ver como fica antes de pôr)
function profileMiniAvatar(look, over) {
  const frame = over.frame || look.frame.id;
  const bg = over.bg || look.bg.id;
  const color = over.color || look.color;
  return `<span class="tp-avatar is-sm tp-frame-${frame} tp-bg-${bg}" style="${playerColorStyle(color)}"><span class="tp-avatar-icon">${over.icon || look.avatar.icon}</span></span>`;
}

// Quadradinho de item (Personalizar e Temporada). kind = aba (avatar, frame, color, bg, title).
function profileRewardTile({ kind, id, unlocked, active, preview, name, lockText }) {
  return `
    <button type="button" class="pf-reward${active ? " is-active" : ""}${unlocked ? "" : " is-locked"}" data-click="equipReward" data-kind="${kind}" data-id="${id}"${unlocked ? "" : ` data-locked="${escapeHtml(lockText)}"`}>
      <span class="pf-reward-preview">${preview}</span>
      ${name ? `<span class="pf-reward-name">${name}</span>` : ""}
      ${unlocked ? "" : `<span class="pf-reward-lock">🔒 ${escapeHtml(lockText)}</span>`}
    </button>`;
}

// Prévia do item: avatar = emoji; moldura/cor/fundo = mini avatar com a peça trocada
function profileRewardPreview(kind, item, look) {
  if (kind === "frame") return profileMiniAvatar(look, { frame: item.id });
  if (kind === "color") return profileMiniAvatar(look, { color: item, frame: "simples" });
  if (kind === "bg") return profileMiniAvatar(look, { bg: item.id });
  return item.icon || "";
}

function renderProfileRewards(state) {
  if (!profileCustomOpen) return;
  renderProfileCustomPreview(state);
  document.getElementById("pfCustomTabs").innerHTML = PROFILE_CUSTOM_TABS.map((t) => `
    <button type="button" class="tab-btn${t.id === profileTab ? " active" : ""}" data-click="showRewardTab" data-tab="${t.id}">
      ${t.name}<small>${profileTabCount(t.id, state)}</small>
    </button>`).join("");
  document.getElementById("pfCustomHint").textContent = `${(PROFILE_CUSTOM_TABS.find((t) => t.id === profileTab) || PROFILE_CUSTOM_TABS[0]).hint} Segura num liberado pra ver como pegou. 👆`;
  const look = getPlayerLook(state);
  const need = (item) => {
    if (item.season) return playerSeasonNeed(item);
    if (!item.achievement) return `Nível ${item.level}`;
    const a = PLAYER_ACHIEVEMENTS.find((x) => x.id === item.achievement);
    if (!a) return "Conquista";
    return isPlayerAchievementHidden(a, state) ? "Conquista ???" : `Conquista: ${a.name}`;
  };
  const tile = (opts) => profileRewardTile({ kind: profileTab, ...opts });
  let html = "";
  if (profileTab === "title") {
    const auto = playerLevelTitle(state.level);
    html = `<div class="pf-title-list">
      ${tile({ id: "", unlocked: true, active: !look.title.id, preview: auto.icon, name: `Automático (${auto.name})`, lockText: "" })}
      ${getPlayerTitles(state).map((t) => tile({ id: t.id, unlocked: t.unlocked, active: look.title.id === t.id, preview: t.unlocked ? t.icon : "🔒", name: t.unlocked || !t.need.includes("???") ? escapeHtml(t.name) : "???", lockText: t.need })).join("")}
    </div>`;
  } else {
    const list = profileRewardList(profileTab);
    const current = look[profileTab].id;
    const tiles = (items) => items.map((item) => {
      const unlocked = isPlayerRewardUnlocked(item, state);
      let preview = profileRewardPreview(profileTab, item, look);
      const name = item.name ? escapeHtml(item.name) : "";
      if (profileTab === "avatar") {
        const a = item.achievement ? PLAYER_ACHIEVEMENTS.find((x) => x.id === item.achievement) : null;
        if (!unlocked && a && isPlayerAchievementHidden(a, state)) preview = "❓";
      }
      return tile({ id: item.id, unlocked, active: current === item.id, preview, name, lockText: need(item) });
    }).join("");
    const grid = profileTab === "avatar" ? " is-avatars" : "";
    const regular = list.filter((item) => !item.season);
    const seasonal = list.filter((item) => item.season);
    if (profileTab === "bg") {
      html = `<div class="pf-reward-grid">${tiles(regular.filter((item) => !item.ultimate))}</div>
        <div class="pf-ultimate-title">✨ ULTIMATE EDITION ✨</div>
        <div class="pf-reward-grid is-ultimate">${tiles(regular.filter((item) => item.ultimate))}</div>`;
    } else {
      html = `<div class="pf-reward-grid${grid}">${tiles(regular)}</div>`;
    }
    // Sazonais (v1.63): libera usando o Toba no mês da festa
    if (seasonal.length) {
      html += `<div class="pf-season-title" id="pfSeasonItems">🎉 Temporadas</div>
        <p class="pf-season-text">As festas do mundo no Toba: ${PLAYER_SEASONS.map((x) => x.icon).join(" ")}. Usou o Toba na festa, leva o troféu do ano e libera os itens dela pra sempre. Datas no 🎉 Temporada do card.</p>
        <div class="pf-reward-grid is-season${grid}">${tiles(seasonal)}</div>`;
    }
  }
  document.getElementById("pfRewards").innerHTML = html;
}

function openCustomize({ push = true } = {}) {
  if (!tobaPlayerState) return;
  profileCustomOpen = true;
  document.getElementById("pfMainView").hidden = true;
  document.getElementById("pfCustomView").hidden = false;
  tobaSetHeader({ page: "🧱 Personalizar", back: "closeCustomize" });
  if (push) history.pushState({ custom: 1 }, "");
  renderProfileRewards(tobaPlayerState);
  window.scrollTo(0, 0);
}

function closeCustomize({ fromHistory = false } = {}) {
  if (!profileCustomOpen) return;
  if (!fromHistory && history.state?.custom) {
    history.back(); // o popstate chama de novo com fromHistory
    return;
  }
  profileCustomOpen = false;
  document.getElementById("pfCustomView").hidden = true;
  document.getElementById("pfMainView").hidden = false;
  tobaSetHeader({ page: "🎮 Perfil do jogador", back: "" });
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------------
 * 🎉 Temporada (v1.64): telona da festa (rolando ou a próxima) com datas,
 * troféu, itens que libera e o calendário do ano. Abre no lugar do Perfil
 * pelo botãozinho do card. Só lê; equipar usa o mesmo equipReward.
 * ------------------------------------------------------------------- */
// Festas deste ano e do próximo, em ordem de data: [{ season, year, key, start, end }]
function profileSeasonTimeline(today) {
  const year = Number(String(today).slice(0, 4));
  const list = [];
  [year, year + 1].forEach((y) => {
    if (y < PLAYER_SEASON_FIRST_YEAR) return;
    PLAYER_SEASONS.forEach((season) => {
      const range = season.range(y);
      if (range) list.push({ season, year: y, key: `${season.id}-${y}`, start: range[0], end: range[1] });
    });
  });
  return list.sort((a, b) => a.start.localeCompare(b.start));
}

function profileDaysBetween(fromIso, toIso) {
  const utc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}

// "14/03/2026" · "01/10 a 31/10/2026" · "31/12/2026 a 07/01/2027"
function profileSeasonDates(hit) {
  if (hit.start === hit.end) return isoToBrDate(hit.start);
  const a = isoToBrDate(hit.start);
  const b = isoToBrDate(hit.end);
  return hit.start.slice(0, 4) === hit.end.slice(0, 4) ? `${a.slice(0, 5)} a ${b}` : `${a} a ${b}`;
}

function profileSeasonStatus(hit, today, got) {
  if (today >= hit.start && today <= hit.end) {
    const left = profileDaysBetween(today, hit.end);
    return { cls: "is-live", text: left === 0 ? "🔴 Rolando agora · acaba hoje" : `🔴 Rolando agora · acaba em ${left} ${left === 1 ? "dia" : "dias"}`, badge: got ? "✅ agora" : "🔴 agora" };
  }
  if (hit.start > today) {
    const n = profileDaysBetween(today, hit.start);
    return { cls: "is-soon", text: n === 1 ? "⏳ Começa amanhã" : `⏳ Começa em ${n} dias`, badge: n === 1 ? "amanhã" : `em ${n} dias` };
  }
  return got
    ? { cls: "is-done", text: "✅ Já passou, e tu pegou", badge: "✅" }
    : { cls: "is-past", text: "💨 Já passou. Ano que vem tem de novo", badge: "💨" };
}

const PROFILE_SEASON_KINDS = [
  { kind: "avatar", name: "😎 Avatares", list: () => PLAYER_AVATARS },
  { kind: "frame", name: "🖼️ Molduras", list: () => PLAYER_FRAMES },
  { kind: "color", name: "🎨 Cores", list: () => PLAYER_COLORS },
  { kind: "bg", name: "✨ Fundos (com efeito no card)", list: () => PLAYER_BGS },
];

function renderProfileSeason(state) {
  if (!profileSeasonOpen) return;
  const view = document.getElementById("pfSeasonView");
  const today = state.today;
  const year = Number(today.slice(0, 4));
  const timeline = profileSeasonTimeline(today);
  const live = playerSeasonsOn(today);
  const pick = timeline.find((h) => h.key === profileSeasonPick) || live[0] || timeline.find((h) => h.start > today) || timeline[0];
  if (!pick) {
    view.innerHTML = tobaEmpty("🎉", "Sem festa no calendário", "Volta mais perto da próxima temporada.");
    return;
  }
  profileSeasonPick = pick.key;
  const season = pick.season;
  const trophyId = `ss-${pick.key}`;
  const got = state.unlockedIds.has(trophyId);
  const inAlbum = state.achievements.find((x) => x.id === trophyId);
  const trophy = inAlbum || PLAYER_ACHIEVEMENTS.find((x) => x.id === trophyId);
  const status = profileSeasonStatus(pick, today, got);
  const look = getPlayerLook(state);
  const bg = PLAYER_BGS.find((x) => x.season === season.id);

  let total = 0;
  let mine = 0;
  const groups = PROFILE_SEASON_KINDS.map((k) => {
    const items = k.list().filter((item) => item.season === season.id);
    if (!items.length) return "";
    const tiles = items.map((item) => {
      const unlocked = isPlayerRewardUnlocked(item, state);
      total += 1;
      if (unlocked) mine += 1;
      return profileRewardTile({
        kind: k.kind, id: item.id, unlocked, active: look[k.kind].id === item.id,
        preview: profileRewardPreview(k.kind, item, look), name: item.name ? escapeHtml(item.name) : "", lockText: playerSeasonNeed(item),
      });
    }).join("");
    return `<div class="pf-ss-kind">${k.name}</div><div class="pf-reward-grid${k.kind === "avatar" ? " is-avatars" : ""}">${tiles}</div>`;
  }).join("");

  const xp = trophy ? trophy.xp ?? PLAYER_TIERS[trophy.tier].xp : 0;
  const trophyText = got
    ? `Na conta desde ${formatProfileDate(trophy.date)} · +${formatPlayerNumber(xp)} XP`
    : trophy ? `${escapeHtml(trophy.hint)} +${formatPlayerNumber(xp)} XP` : "";
  const calendar = timeline.filter((h) => h.year === year || h.start <= `${year}-12-31`);

  view.innerHTML = `
    <section class="card pf-ss-hero">
      ${bg ? `<span class="pf-hero-glow tp-bg-${bg.id}" aria-hidden="true"></span>${renderPlayerFx(bg.id)}` : ""}
      <span class="pf-ss-icon">${season.icon}</span>
      <h2 class="pf-ss-name">${escapeHtml(season.label)} ${pick.year}</h2>
      <div class="pf-ss-dates">📅 ${profileSeasonDates(pick)}</div>
      <span class="pf-ss-status ${status.cls}">${status.text}</span>
      <p class="pf-ss-how">Vale qualquer coisa no Toba ${escapeHtml(season.when)}: treino, tarefa, receita ou só abrir o app. O troféu libera os itens pra sempre.</p>
    </section>

    ${trophy ? `
    <div class="section-title">🏆 Troféu</div>
    <button type="button" class="card pf-ss-trophy${got ? " is-got" : ""}"${inAlbum ? ` data-click="openAchievement" data-id="${trophyId}"` : ""}>
      <span class="tp-medal tp-tier-${trophy.tier}${got ? "" : " is-locked"}">${season.icon}</span>
      <span class="pf-ss-trophy-text"><strong>${escapeHtml(trophy.name)}</strong><span>${trophyText}</span></span>
    </button>` : ""}

    ${total ? `
    <div class="section-title">🎁 O que dá pra ganhar <span class="pf-count">${mine}/${total}</span></div>
    <div class="card pf-ss-items">${groups}</div>` : ""}

    <div class="section-title">📅 Calendário ${year}</div>
    <div class="card pf-ss-cal">${calendar.map((h) => {
      const st = profileSeasonStatus(h, today, state.unlockedIds.has(`ss-${h.key}`));
      return `
      <button type="button" class="pf-ss-row ${st.cls}${h.key === pick.key ? " is-picked" : ""}" data-click="pickSeason" data-key="${h.key}">
        <span class="pf-ss-row-icon">${h.season.icon}</span>
        <span class="pf-ss-row-text"><strong>${escapeHtml(h.season.label)}</strong><span>${profileSeasonDates(h)}</span></span>
        <span class="pf-ss-row-badge">${st.badge}</span>
      </button>`;
    }).join("")}</div>`;
}

function openSeason({ push = true } = {}) {
  if (!tobaPlayerState) return;
  if (push) profileSeasonPick = "";
  profileSeasonOpen = true;
  document.getElementById("pfMainView").hidden = true;
  document.getElementById("pfSeasonView").hidden = false;
  tobaSetHeader({ page: "🎉 Temporada", back: "closeSeason" });
  if (push) history.pushState({ season: 1 }, "");
  renderProfileSeason(tobaPlayerState);
  window.scrollTo(0, 0);
}

function closeSeason({ fromHistory = false } = {}) {
  if (!profileSeasonOpen) return;
  if (!fromHistory && history.state?.season) {
    history.back(); // o popstate chama de novo com fromHistory
    return;
  }
  profileSeasonOpen = false;
  document.getElementById("pfSeasonView").hidden = true;
  document.getElementById("pfMainView").hidden = false;
  tobaSetHeader({ page: "🎮 Perfil do jogador", back: "" });
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------------
 * 👆 Segurar num item liberado = balãozinho "como pegou" + data (v1.64).
 * Tocar continua equipando; o balão some sozinho ou no próximo toque.
 * ------------------------------------------------------------------- */
// Dia em que o XP acumulado chegou no nível (os eventos já vêm em ordem de data)
function profileLevelDate(state, level) {
  let need = 0;
  for (let l = 1; l < level; l++) need += playerXpToNext(l);
  let sum = 0;
  for (const e of state.events) {
    sum += e.xp;
    if (sum >= need) return e.date;
  }
  return "";
}

function profileHowInfo(kind, id, state) {
  const byAch = (achId) => {
    const a = state.achievements.find((x) => x.id === achId);
    return a ? { how: `🏅 Conquista: ${a.name}`, date: a.date } : { how: "🏅 Com uma conquista", date: "" };
  };
  const byLevel = (level) => (level <= 1
    ? { how: "🏭 Vem de fábrica: liberado desde o nível 1", date: "" }
    : { how: `⬆️ Chegou no nível ${level}`, date: profileLevelDate(state, level) });
  if (kind === "title") {
    if (!id) return { how: "🤖 Automático: acompanha o título do teu nível", date: "" };
    if (id.startsWith("nivel-")) return byLevel(Number(id.slice(6)));
    if (id.startsWith("conq-")) return byAch(id.slice(5));
    return null;
  }
  const item = profileRewardList(kind).find((x) => x.id === id);
  if (!item) return null;
  if (item.achievement) return byAch(item.achievement);
  if (item.season) {
    const got = state.achievements.filter((a) => a.unlocked && a.season === item.season).sort((a, b) => a.date.localeCompare(b.date));
    if (!got.length) return null;
    return { how: `🎉 ${got[0].name}${got.length > 1 ? ` (e mais ${got.length - 1})` : ""}`, date: got[0].date };
  }
  return byLevel(item.level || 1);
}

let profileHowTimer = 0;

function hideProfileHow() {
  clearTimeout(profileHowTimer);
  const box = document.getElementById("pfHow");
  if (box) box.hidden = true;
}

function showProfileHow(tile) {
  const state = tobaPlayerState;
  const box = document.getElementById("pfHow");
  if (!state || !box) return;
  const info = profileHowInfo(tile.dataset.kind, tile.dataset.id, state);
  if (!info) return;
  box.innerHTML = `<strong>${escapeHtml(info.how)}</strong>${info.date ? `<span>📅 ${formatProfileDate(info.date)}</span>` : ""}`;
  box.hidden = false;
  const r = tile.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const left = Math.min(window.innerWidth - b.width - 8, Math.max(8, r.left + r.width / 2 - b.width / 2));
  let top = r.top - b.height - 8;
  if (top < 8) top = r.bottom + 8;
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
  clearTimeout(profileHowTimer);
  profileHowTimer = setTimeout(hideProfileHow, 4000);
}

function setupProfileHold() {
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let fired = false;
  const cancel = () => clearTimeout(timer);
  document.addEventListener("pointerdown", (event) => {
    hideProfileHow();
    fired = false;
    cancel();
    const tile = event.target instanceof Element ? event.target.closest(".pf-reward") : null;
    if (!tile || tile.dataset.locked) return;
    startX = event.clientX;
    startY = event.clientY;
    timer = setTimeout(() => {
      fired = true;
      showProfileHow(tile);
    }, 450);
  });
  document.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
  });
  document.addEventListener("pointerup", cancel);
  document.addEventListener("pointercancel", cancel);
  window.addEventListener("scroll", () => { cancel(); hideProfileHow(); }, { passive: true });
  // Segurou: o "click" que vem depois não equipa
  document.addEventListener("click", (event) => {
    if (!fired) return;
    fired = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener("contextmenu", (event) => {
    if (event.target instanceof Element && event.target.closest(".pf-reward")) event.preventDefault();
  });
}

async function equipReward(el) {
  if (el.dataset.locked) {
    const item = profileRewardList(el.dataset.kind).find((x) => x.id === el.dataset.id);
    const season = item && item.season ? PLAYER_SEASONS.find((x) => x.id === item.season) : null;
    const text = season ? `Item de temporada. Use o Toba ${season.when} e leva o troféu ${season.icon} que libera ele pra sempre.` : `Ainda bloqueado. Libera com: ${el.dataset.locked}.`;
    showPageMessage(text, { title: "Calma, apressado", icon: season ? season.icon : "🔒" });
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
  renderProfileSeason(state);
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
  openCustomize: () => openCustomize(),
  openSeason: () => openSeason(),
  closeSeason: () => closeSeason(),
  pickSeason: (el) => {
    profileSeasonPick = el.dataset.key;
    if (tobaPlayerState) renderProfileSeason(tobaPlayerState);
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  closeCustomize: () => closeCustomize(),
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
// Recarregou com o Personalizar/Temporada no histórico: começa no Perfil
if (history.state?.custom || history.state?.season) history.replaceState(null, "");
window.addEventListener("popstate", (event) => {
  hideProfileHow();
  if (event.state?.custom) openCustomize({ push: false });
  else closeCustomize({ fromHistory: true });
  if (event.state?.season) openSeason({ push: false });
  else closeSeason({ fromHistory: true });
});
setupProfileHold();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tobaPlayerCheck();
});
tobaPlayerCheck();
