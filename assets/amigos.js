/* =====================================================================
 * Toba · página Toba dos amigos (Toba-Amigos.html, desde v1.61)
 * Lista de amigos, pedidos, Adicionar/Compartilhar e o comparador de
 * troféus (estilo PS5). Depende de toba-common, toba-cloud, toba-player
 * (+ os *-metrics) e toba-social.js. Não grava nenhum banco TOBA_*:
 * só a vitrine/amizades na nuvem e o cache toba_social_state.
 * ===================================================================== */
const AM = {
  phase: "loading", // loading | offline | login | off | on
  friends: null,
  requests: [],
  friend: null, // { uid, name, vitrine, ghost }
  tab: "trofeus",
  openCats: new Set(["amizade"]),
  filter: "todos",
  editing: false,
  shareDraft: null,
  pendingAdd: "",
};

const AM_TIER_ORDER = ["lenda", "ouro", "prata", "bronze"];
const AM_TIER_ICON = { lenda: "💎", ouro: "🥇", prata: "🥈", bronze: "🥉" };

function amEl(id) {
  return document.getElementById(id);
}

function amAgo(ms) {
  if (!ms) return "";
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function amShortDate(iso) {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y.slice(2)}` : "";
}

function amNum(value, dec = 0) {
  const n = Number(value) || 0;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

function amPlayerName(v) {
  return (v && v.name) || "Amigo";
}

/* ---------------------------------------------------------------------
 * Eu (sempre completo: na minha tela eu vejo tudo meu)
 * ------------------------------------------------------------------- */
function amMine() {
  const state = tobaPlayerState;
  if (!state) return null;
  const me = typeof TOBA_CLOUD !== "undefined" && TOBA_CLOUD.user ? socialMyState() : socialReadState();
  const show = {};
  SOCIAL_SECTIONS.forEach((s) => { show[s.id] = true; });
  const v = socialBuildVitrine(state, { ...me, show });
  v.name = "Você";
  v.isMe = true;
  return v;
}

/* ---------------------------------------------------------------------
 * Rival fantasma 👻 (só na tela, nada vai pra nuvem)
 * ------------------------------------------------------------------- */
function amSeeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function amGhostVitrine() {
  const mine = amMine();
  const rnd = amSeeded(171717);
  const ach = {};
  const today = toIsoDate();
  PLAYER_ACHIEVEMENTS.forEach((a) => {
    const have = mine && mine.ach[a.id];
    const chance = have ? 0.62 : a.tier === "lenda" ? 0.05 : a.tier === "ouro" ? 0.15 : 0.32;
    if (rnd() < chance) {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(rnd() * 300));
      ach[a.id] = toIsoDate(d) > today ? today : toIsoDate(d);
    }
  });
  const stats = {};
  SOCIAL_STATS.forEach((s) => {
    const base = mine ? Number(mine.stats[s.key]) || 0 : 0;
    const fake = Math.max(base * (0.55 + rnd() * 0.9), rnd() * 20);
    stats[s.key] = s.dec ? Math.round(fake * 10) / 10 : Math.round(fake);
  });
  stats.peso = null;
  stats.trophies = Object.keys(ach).length;
  const info = playerLevelInfo(stats.xp);
  stats.level = info.level;
  const show = socialDefaultShow();
  return {
    v: 1,
    name: "Maracujeba 👻",
    username: "maracujeba",
    look: { avatar: "🦍", frame: "prata", color: "#3fb950", ring: "", titleIcon: "🥭", title: "Fantasma da Bancada" },
    level: info.level,
    xp: stats.xp,
    into: info.into,
    need: info.need,
    ratio: info.ratio,
    show,
    stats,
    ach,
    achTotal: PLAYER_ACHIEVEMENTS.length,
    updatedAt: Date.now(),
  };
}

/* ---------------------------------------------------------------------
 * Lista (gate, pedidos, amigos)
 * ------------------------------------------------------------------- */
function amRenderGate() {
  const gate = amEl("amGate");
  const home = amEl("amHome");
  home.hidden = AM.phase !== "on";
  if (AM.phase === "on") {
    gate.innerHTML = "";
    return;
  }
  const cards = {
    loading: `<div class="card am-gate"><div class="am-gate-icon">⏳</div><p>Chamando a nuvem...</p></div>`,
    offline: `<div class="card am-gate"><div class="am-gate-icon">📴</div><strong>Sem internet agora</strong><p>O Toba dos amigos mora na nuvem. Volta quando tiver sinal (ou brinca com o fantasma ali embaixo 👻).</p><button type="button" class="btn btn-secondary" data-click="amRefresh">🔄 Tentar de novo</button></div>`,
    login: `<div class="card am-gate"><div class="am-gate-icon">☁️</div><strong>Entra na Conta Toba primeiro</strong><p>Pra visitar o Toba dos amigos e mostrar o teu, precisa estar logado. Teus dados continuam aqui no aparelho igual sempre.</p><button type="button" class="btn btn-primary" data-click="tobaCloudOpen">☁️ Entrar na Conta Toba</button></div>`,
    off: `<div class="card am-gate"><div class="am-gate-icon">🤝</div><strong>Liga teu Toba social</strong><p>Escolhe um <b>@username</b> e o que os amigos podem ver. Eles só veem um resumo (nível, troféus e números somados), nunca teus dados de verdade. O 💰 Bank não aparece nunca.</p><button type="button" class="btn btn-primary" data-click="amOpenShare">🚀 Escolher meu @username</button></div>`,
  };
  gate.innerHTML = cards[AM.phase] || "";
}

function amRenderRequests() {
  const box = amEl("amRequests");
  if (!AM.requests.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `
    <div class="section-title">🔔 Pedidos de amizade <span class="am-count">${AM.requests.length}</span></div>
    ${AM.requests.map((r) => `
      <div class="card am-request">
        <span class="am-request-text"><strong>@${escapeHtml(r.name || "alguém")}</strong><small>quer comparar o Toba com você · ${escapeHtml(amAgo(r.at))}</small></span>
        <span class="am-request-btns">
          <button type="button" class="btn btn-primary" data-click="amAccept" data-uid="${escapeHtml(r.uid)}">✅ Aceitar</button>
          <button type="button" class="btn btn-secondary" data-click="amReject" data-uid="${escapeHtml(r.uid)}" aria-label="Recusar">✕</button>
        </span>
      </div>`).join("")}`;
}

function amRenderFriends() {
  const box = amEl("amFriends");
  const count = amEl("amFriendCount");
  if (AM.friends === null) {
    box.innerHTML = `<div class="card am-gate"><p>⏳ Buscando a tropa...</p></div>`;
    count.textContent = "";
    return;
  }
  count.textContent = AM.friends.length ? String(AM.friends.length) : "";
  if (!AM.friends.length) {
    box.innerHTML = tobaEmpty("🦗", "Nenhum amigo ainda", "Toca em ➕ e digita o @ do Maracujeba, ou manda o teu @ pra ele pelo 📤.");
    return;
  }
  const order = { ok: 0, pending: 1, off: 2, gone: 3, error: 4 };
  const list = [...AM.friends].sort((a, b) => (order[a.status] - order[b.status]) || ((b.vitrine?.xp || 0) - (a.vitrine?.xp || 0)));
  box.innerHTML = list.map((f) => {
    const name = escapeHtml(f.vitrine ? amPlayerName(f.vitrine) : f.name || "amigo");
    if (f.status === "ok") {
      const v = f.vitrine;
      const trophies = Object.keys(v.ach || {}).length;
      return `
        <div class="card am-friend" role="button" tabindex="0" data-click="amOpenFriend" data-uid="${escapeHtml(f.uid)}">
          ${socialAvatar(v, "md")}
          <span class="am-friend-body">
            <strong>${name}</strong>
            <small>${escapeHtml(v.look?.titleIcon || "")} ${escapeHtml(v.look?.title || "")} · Nível ${Number(v.level) || 1}</small>
            <small>🏆 ${trophies} troféus · ✨ ${formatPlayerNumber(v.xp)} XP</small>
          </span>
          <span class="am-friend-go">⚔️</span>
        </div>`;
    }
    const texts = {
      pending: `⏳ Esperando <b>@${name}</b> aceitar`,
      off: `😴 <b>@${name}</b> desligou o Toba social`,
      gone: `🚫 <b>@${name}</b> recusou ou desfez a amizade`,
      error: `📴 Não deu pra carregar <b>@${name}</b>`,
    };
    return `
      <div class="card am-friend is-dim">
        <span class="am-friend-body"><span>${texts[f.status] || texts.error}</span></span>
        <button type="button" class="chip-btn" data-click="amRemove" data-uid="${escapeHtml(f.uid)}">${f.status === "pending" ? "Cancelar" : "Tirar"}</button>
      </div>`;
  }).join("");
}

function amRenderHome() {
  amRenderGate();
  const me = socialMyState();
  const at = amEl("amMyAt");
  if (at) at.textContent = me.username ? `teu @: ${socialAt(me.username)}` : "manda teu @ pra tropa";
  if (AM.phase === "on") {
    amRenderRequests();
    amRenderFriends();
  }
}

async function amLoadLists() {
  AM.friends = null;
  amRenderHome();
  try {
    const [friends, requests] = await Promise.all([socialListFriends(), socialListRequests()]);
    AM.friends = friends;
    AM.requests = requests;
    friends.filter((f) => f.status === "ok").forEach((f) => socialNoteFact("friends", f.uid));
  } catch (err) {
    console.warn("amigos: não carregou", err);
    AM.friends = [];
    tobaToast("📴 Não deu pra falar com a nuvem agora");
  }
  amRenderHome();
}

async function amStart() {
  AM.phase = "loading";
  amRenderHome();
  try {
    await socialReady();
  } catch (err) {
    AM.phase = "offline";
    amRenderHome();
    return;
  }
  socialHookAuth();
}

// Chamado pelo socialHookAuth a cada troca de conta (entrou/saiu)
async function amOnUser(user) {
  if (!user) {
    AM.phase = "login";
    AM.friends = null;
    AM.requests = [];
    amRenderHome();
    return;
  }
  AM.phase = "loading";
  amRenderHome();
  try {
    const mine = await socialLoadMine();
    AM.phase = mine.on ? "on" : "off";
  } catch (err) {
    AM.phase = "offline";
  }
  amRenderHome();
  if (AM.phase === "on") {
    await amLoadLists();
    if (AM.pendingAdd) amOpenAdd(null, AM.pendingAdd);
  } else if (AM.phase === "off" && AM.pendingAdd) {
    tobaToast("Escolhe teu @ primeiro e já adiciono o amigo 👊");
    amOpenShare();
  }
  // Veio do Perfil (?open=share|add): abre a folha certa
  if (AM.pendingShare && (AM.phase === "on" || AM.phase === "off")) {
    AM.pendingShare = false;
    amOpenShare();
  } else if (AM.pendingAddOpen && (AM.phase === "on" || AM.phase === "off")) {
    AM.pendingAddOpen = false;
    amOpenAdd();
  }
}

/* ---------------------------------------------------------------------
 * Adicionar amigo
 * ------------------------------------------------------------------- */
function amOpenAdd(el, prefill = "") {
  if (AM.phase !== "on") {
    if (AM.phase === "off") return amOpenShare();
    if (AM.phase === "login") return tobaCloudOpen();
    return;
  }
  amEl("amAddInput").value = prefill || "";
  amEl("amAddError").hidden = true;
  openTobaModal("amAddModal");
  setTimeout(() => amEl("amAddInput").focus(), 50);
}

async function amAddSubmit() {
  const input = amEl("amAddInput");
  const err = amEl("amAddError");
  const btn = amEl("amAddBtn");
  err.hidden = true;
  btn.disabled = true;
  try {
    const res = await socialAddByUsername(input.value);
    if (!res.ok) {
      err.textContent = res.msg;
      err.hidden = false;
      return;
    }
    // Ele já tinha me pedido? Adicionar = aceitar (o pedido some).
    if (AM.requests.some((r) => r.uid === res.uid)) await socialReject(res.uid).catch(() => {});
    AM.pendingAdd = "";
    closeTobaModal("amAddModal");
    tobaToast(`🤝 Pedido mandado pra @${res.name}!`);
    await amLoadLists();
  } catch (e) {
    err.textContent = tobaCloudErrorText(e);
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

async function amAccept(el) {
  const req = AM.requests.find((r) => r.uid === el.dataset.uid);
  if (!req) return;
  el.disabled = true;
  try {
    await socialAccept(req.uid, req);
    tobaToast(`🤝 Agora você e @${req.name} são da mesma tropa!`);
    await amLoadLists();
  } catch (e) {
    el.disabled = false;
    showPageMessage(tobaCloudErrorText(e), { title: "Não deu", icon: "📴" });
  }
}

async function amReject(el) {
  const req = AM.requests.find((r) => r.uid === el.dataset.uid);
  if (!req) return;
  const ok = await showPageMessage(`@${req.name} não vai ver teu Toba. Dá pra adicionar depois se quiser.`, { title: "Recusar o pedido?", icon: "🙅", confirm: true, confirmLabel: "Recusar" });
  if (!ok) return;
  await socialReject(req.uid).catch(() => {});
  await amLoadLists();
}

async function amRemove(el) {
  const uid = el.dataset.uid;
  const f = (AM.friends || []).find((x) => x.uid === uid);
  const name = f ? (f.vitrine ? amPlayerName(f.vitrine) : f.name) : "esse amigo";
  const ok = await showPageMessage(`Vocês param de ver o Toba um do outro na hora. Dá pra adicionar de novo depois.`, { title: `Desfazer com @${name}?`, icon: "💔", confirm: true, confirmLabel: "Desfazer" });
  if (!ok) return;
  await socialRemove(uid);
  if (AM.friend && AM.friend.uid === uid) amCloseFriend();
  await amLoadLists();
}

/* ---------------------------------------------------------------------
 * Compartilhar / ligar / editar
 * ------------------------------------------------------------------- */
function amShareLink(username) {
  const base = location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  return `${base}Toba-Amigos.html?add=${encodeURIComponent(username)}`;
}

function amOpenShare() {
  if (AM.phase === "login") return tobaCloudOpen();
  if (AM.phase !== "on" && AM.phase !== "off") return;
  const me = socialMyState();
  AM.editing = AM.phase === "off";
  AM.shareDraft = { username: me.username || socialDefaultName(), show: { ...me.show } };
  amRenderShare();
  openTobaModal("amShareModal");
}

function amRenderShare() {
  const me = socialMyState();
  const body = amEl("amShareBody");
  const footer = amEl("amShareFooter");
  if (AM.editing) {
    const d = AM.shareDraft;
    const chips = SOCIAL_SECTIONS.map((s) => `<button type="button" class="tc-chip${d.show[s.id] ? " is-on" : ""}" data-click="amToggleSection" data-id="${s.id}">${s.icon} ${escapeHtml(s.name)}</button>`).join("");
    body.innerHTML = `
      <div class="form-group">
        <label for="amUsername" class="am-label-help">Teu username <button type="button" class="am-help-btn" data-click="amHelp" data-help="username" aria-label="Sobre o username">❔</button></label>
        <div class="am-at-field">
          <span>@</span>
          <input class="form-control" id="amUsername" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20" placeholder="Bertoba" value="${escapeHtml(d.username)}" data-input="amDraftName" />
        </div>
        <small class="am-hint">É assim que a tropa te acha e te vê. Letras, números, _ e ponto. Maiúscula vale só pro visual.</small>
      </div>
      <div class="toba-settings-label am-label-help">O que os amigos veem <button type="button" class="am-help-btn" data-click="amHelp" data-help="privacidade" aria-label="O que os amigos veem">❔</button></div>
      <div class="tc-chips">
        <span class="tc-chip is-on is-fixed">⭐ Nível, XP e troféus</span>
        ${chips}
        <span class="tc-chip is-locked">💰 Bank 🔒 nunca</span>
      </div>
      <p class="am-hint">Desligado = os números e os troféus daquele app somem da tua vitrine. Ninguém vê treino por treino, tarefa, receita, lugar ou dinheiro: só os totais.</p>
      <div class="tc-error" id="amShareError" hidden></div>`;
    footer.innerHTML = `<button type="button" class="btn btn-primary" id="amShareSave" data-click="amShareSave">${AM.phase === "on" ? "💾 Salvar" : "🚀 Ligar meu Toba social"}</button>`;
    return;
  }
  const link = amShareLink(me.username);
  body.innerHTML = `
    <div class="am-share-at">${escapeHtml(socialAt(me.username))}</div>
    <p class="toba-sheet-text am-center">Manda teu @ (ou o link) pra tropa. Quem te adicionar aparece em 🔔 Pedidos pra você aceitar.</p>
    <div class="am-share-link">${escapeHtml(link)}</div>
    <div class="toba-menu">
      <button type="button" class="toba-menu-btn" data-click="amShareSend">
        <span class="toba-menu-icon">📤</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Mandar meu @</span><span class="toba-menu-desc">WhatsApp, Telegram, o que tiver aí</span></span>
      </button>
      <button type="button" class="toba-menu-btn" data-click="amShareCopy">
        <span class="toba-menu-icon">📋</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Copiar o link</span><span class="toba-menu-desc">Abre direto o Adicionar com teu @</span></span>
      </button>
      <button type="button" class="toba-menu-btn" data-click="amShareEdit">
        <span class="toba-menu-icon">✏️</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Trocar @ ou o que aparece</span><span class="toba-menu-desc">${SOCIAL_SECTIONS.filter((s) => me.show[s.id]).map((s) => s.icon).join(" ") || "Só nível e troféus"}</span></span>
        <span class="toba-hub-chevron">›</span>
      </button>
      <button type="button" class="toba-menu-btn is-danger" data-click="amShareOff">
        <span class="toba-menu-icon">🔕</span>
        <span class="toba-menu-text"><span class="toba-menu-title">Desligar meu Toba social</span><span class="toba-menu-desc">Tua vitrine some e o @ fica livre</span></span>
      </button>
    </div>`;
  footer.innerHTML = "";
}

async function amShareSave() {
  const btn = amEl("amShareSave");
  const err = amEl("amShareError");
  const d = AM.shareDraft;
  d.username = amEl("amUsername").value;
  const problem = socialUsernameError(d.username);
  if (problem) {
    err.textContent = problem;
    err.hidden = false;
    return;
  }
  if (!tobaPlayerState || !tobaPlayerState.ok) {
    err.textContent = "Teu Perfil ainda não terminou de calcular (ou algum banco não pôde ser lido). Tenta de novo em 1 segundo.";
    err.hidden = false;
    return;
  }
  btn.disabled = true;
  err.hidden = true;
  try {
    const wasOn = AM.phase === "on";
    const res = await socialEnable({ username: d.username, show: d.show });
    if (!res.ok) {
      err.textContent = res.msg;
      err.hidden = false;
      return;
    }
    AM.phase = "on";
    AM.editing = false;
    amRenderShare();
    tobaToast(wasOn ? "Salvo ✓" : `🎉 Agora você é ${socialAt(res.state.username)}!`);
    await amLoadLists();
    if (AM.pendingAdd) {
      closeTobaModal("amShareModal");
      amOpenAdd(null, AM.pendingAdd);
    }
  } catch (e) {
    err.textContent = tobaCloudErrorText(e);
    err.hidden = false;
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
}

async function amCopyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

async function amShareSend() {
  const me = socialMyState();
  const link = amShareLink(me.username);
  const text = `Bora ver quem é mais monstro no Toba? 🏆 Me adiciona: ${socialAt(me.username)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Toba dos amigos", text, url: link });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }
  const ok = await amCopyText(`${text}\n${link}`);
  if (ok) tobaToast("📋 Copiado! Cola no zap da tropa");
  else showPageMessage(`${text}\n${link}`, { title: "Copia e manda", icon: "📤" });
}

async function amShareCopy() {
  const ok = await amCopyText(amShareLink(socialMyState().username));
  if (ok) tobaToast("📋 Link copiado!");
  else showPageMessage(amShareLink(socialMyState().username), { title: "Copia o link", icon: "📋" });
}

async function amShareOff() {
  const ok = await showPageMessage("Tua vitrine some da nuvem e os amigos param de ver teu Toba. Tua lista de amigos fica guardada: ligou de novo, volta tudo.", { title: "Desligar o Toba social?", icon: "🔕", confirm: true, confirmLabel: "Desligar" });
  if (!ok) return;
  try {
    await socialDisable();
    AM.phase = "off";
    closeTobaModal("amShareModal");
    amRenderHome();
    tobaToast("🔕 Toba social desligado");
  } catch (e) {
    showPageMessage(tobaCloudErrorText(e), { title: "Não deu", icon: "📴" });
  }
}

/* ---------------------------------------------------------------------
 * Toba do amigo + comparador
 * ------------------------------------------------------------------- */
function amOpenFriend(el) {
  const f = (AM.friends || []).find((x) => x.uid === el.dataset.uid && x.status === "ok");
  if (!f) return;
  AM.friend = { uid: f.uid, vitrine: f.vitrine, ghost: false };
  AM.tab = "trofeus";
  AM.filter = "todos";
  amShowFriend();
}

function amOpenGhost() {
  if (!tobaPlayerState) return tobaToast("⏳ Calculando teu Perfil...");
  AM.friend = { uid: "ghost", vitrine: amGhostVitrine(), ghost: true };
  AM.tab = "trofeus";
  AM.filter = "todos";
  amShowFriend();
}

function amShowFriend() {
  if (AM.friend.ghost) socialNoteFact("ghostAt");
  else socialNoteFact("duels", AM.friend.uid);
  amEl("amMainView").hidden = true;
  amEl("amFriendView").hidden = false;
  tobaSetHeader({ page: `⚔️ ${amPlayerName(AM.friend.vitrine)}`, back: "amCloseFriend" });
  amRenderFriend();
  window.scrollTo(0, 0);
}

function amCloseFriend() {
  AM.friend = null;
  amEl("amFriendView").hidden = true;
  amEl("amMainView").hidden = false;
  tobaSetHeader({ page: "🤝 Toba dos amigos" });
}

// Tem o troféu? Seção escondida = null (não sabemos).
function amHas(v, a) {
  const section = SOCIAL_CAT_SECTION[a.cat] || "base";
  if (!v.isMe && section !== "base" && !(v.show || {})[section]) return null;
  return (v.ach || {})[a.id] || "";
}

function amTierCounts(v) {
  const counts = { lenda: 0, ouro: 0, prata: 0, bronze: 0 };
  const byId = new Map(PLAYER_ACHIEVEMENTS.map((a) => [a.id, a]));
  Object.keys(v.ach || {}).forEach((id) => {
    const a = byId.get(id);
    if (a && counts[a.tier] !== undefined) counts[a.tier] += 1;
  });
  return counts;
}

function amVisibleTotal(v) {
  if (v.isMe) return PLAYER_ACHIEVEMENTS.length;
  return PLAYER_ACHIEVEMENTS.filter((a) => amHas(v, a) !== null).length;
}

function amSideHtml(v, extra = "") {
  const counts = amTierCounts(v);
  const total = amVisibleTotal(v);
  const got = PLAYER_ACHIEVEMENTS.filter((a) => amHas(v, a)).length;
  const pct = total ? Math.round((got / total) * 100) : 0;
  return `
    <div class="am-side${extra}">
      ${socialAvatar(v, "lg")}
      <strong class="am-side-name">${escapeHtml(amPlayerName(v))}</strong>
      <span class="am-side-title">${escapeHtml(v.look?.titleIcon || "")} ${escapeHtml(v.look?.title || "")}</span>
      <span class="am-side-trophies">🏆 ${got}</span>
      <span class="am-tiers">${AM_TIER_ORDER.map((t) => `<span class="am-tier am-tier-${t}" title="${PLAYER_TIERS[t].name}">${AM_TIER_ICON[t]} ${counts[t]}</span>`).join("")}</span>
      <span class="am-pct">${renderPlayerBar(pct / 100)}<small>${pct}%</small></span>
    </div>`;
}

function amRenderFriend() {
  const mine = amMine();
  const box = amEl("amFriendView");
  if (!mine || !AM.friend) {
    box.innerHTML = `<div class="card am-gate"><p>⏳ Calculando teu Perfil...</p></div>`;
    return;
  }
  const v = AM.friend.vitrine;
  const tabs = [["trofeus", "🏆 Troféus"], ["duelo", "📊 Duelo"], ["perfil", "👤 Toba dele"]];
  const ghostNote = AM.friend.ghost ? `<div class="hint-box">👻 Isso é um exemplo de mentira, gerado só na tua tela. Quando o Maracujeba de verdade entrar, aparece igualzinho.</div>` : "";
  box.innerHTML = `
    ${ghostNote}
    <section class="card am-vs">
      ${amSideHtml(mine)}
      <span class="am-vs-badge">VS</span>
      ${amSideHtml(v, " is-right")}
    </section>
    <div class="tab-nav am-tabs" role="tablist">
      ${tabs.map(([id, label]) => `<button type="button" class="tab-btn${AM.tab === id ? " active" : ""}" data-click="amTab" data-tab="${id}">${label}</button>`).join("")}
    </div>
    <div id="amTabBody"></div>`;
  amRenderTab(mine, v);
}

function amRenderTab(mine, v) {
  const body = amEl("amTabBody");
  if (AM.tab === "duelo") body.innerHTML = amDuelHtml(mine, v);
  else if (AM.tab === "perfil") body.innerHTML = amFriendProfileHtml(v);
  else body.innerHTML = amTrophiesHtml(mine, v);
}

function amTrophiesHtml(mine, v) {
  const myState = tobaPlayerState;
  const mineById = new Map(myState.achievements.map((a) => [a.id, a]));
  const filters = [["todos", "Todos"], ["eu", "Só eu"], ["ele", "Só ele"], ["dois", "Os dois"], ["ninguem", "Ninguém"]];
  const rowsByCat = PLAYER_ACHIEVEMENT_CATS.map((cat) => {
    const items = PLAYER_ACHIEVEMENTS.filter((a) => a.cat === cat.id);
    if (!items.length) return "";
    const hidden = items.every((a) => amHas(v, a) === null);
    const myCount = items.filter((a) => amHas(mine, a)).length;
    const hisCount = hidden ? null : items.filter((a) => amHas(v, a)).length;
    const rows = items.filter((a) => {
      const m = Boolean(amHas(mine, a));
      const h = amHas(v, a);
      switch (AM.filter) {
        case "eu": return m && !h;
        case "ele": return !m && Boolean(h);
        case "dois": return m && Boolean(h);
        case "ninguem": return !m && h !== null && !h;
        default: return true;
      }
    }).map((a) => {
      const my = mineById.get(a.id) || a;
      const myDate = amHas(mine, a);
      const hisDate = amHas(v, a);
      const mystery = !myDate && isPlayerAchievementHidden(my, myState);
      const myCell = myDate ? `<span class="am-cell is-got">✅<small>${amShortDate(myDate)}</small></span>`
        : `<span class="am-cell">🔒<small>${Math.floor((my.progress || 0) * 100)}%</small></span>`;
      const hisCell = hisDate === null ? `<span class="am-cell is-hidden">🙈<small>escondido</small></span>`
        : hisDate ? `<span class="am-cell is-got">✅<small>${amShortDate(hisDate)}</small></span>`
          : `<span class="am-cell">🔒</span>`;
      const first = myDate && hisDate ? (myDate < hisDate ? " is-me-first" : myDate > hisDate ? " is-him-first" : "") : "";
      return `
        <button type="button" class="am-trow${myDate || hisDate ? " is-some" : ""}${first}" data-click="amOpenTrophy" data-id="${a.id}">
          <span class="tp-medal tp-tier-${a.tier}${myDate ? "" : " is-locked"}">${mystery ? "❓" : a.icon}</span>
          <span class="am-trow-name"><strong>${mystery ? "???" : escapeHtml(a.name)}</strong><small>${PLAYER_TIERS[a.tier].name}${mystery && hisDate ? " · ele já tem 👀" : ""}</small></span>
          ${myCell}${hisCell}
        </button>`;
    }).join("");
    if (!rows) return "";
    const open = AM.filter !== "todos" || AM.openCats.has(cat.id);
    return `
      <details class="am-cat" data-cat="${cat.id}"${open ? " open" : ""}>
        <summary class="am-cat-head">
          <span>${cat.name} <span class="am-cat-chev" aria-hidden="true">›</span></span>
          <span class="am-cat-score"><b class="${hisCount !== null && myCount > hisCount ? "is-win" : ""}">${myCount}</b> x <b class="${hisCount !== null && hisCount > myCount ? "is-win" : ""}">${hisCount === null ? "🙈" : hisCount}</b> <small>/ ${items.length}</small></span>
        </summary>
        <div class="am-cat-cols"><span></span><span></span><span>Você</span><span>${escapeHtml(amPlayerName(v).split(" ")[0])}</span></div>
        ${rows}
      </details>`;
  }).join("");
  return `
    <div class="am-help-line"><span>Toca na categoria pra abrir · ⚡ = pegou primeiro</span><button type="button" class="am-help-btn" data-click="amHelp" data-help="trofeus" aria-label="Como ler os troféus">❔</button></div>
    <div class="tc-chips am-filters">${filters.map(([id, label]) => `<button type="button" class="tc-chip${AM.filter === id ? " is-on" : ""}" data-click="amFilter" data-filter="${id}">${label}</button>`).join("")}</div>
    ${rowsByCat || tobaEmpty("🤷", "Nada nesse filtro", "Troca o filtro ali em cima.")}`;
}

function amOpenTrophy(el) {
  const a = PLAYER_ACHIEVEMENTS.find((x) => x.id === el.dataset.id);
  if (!a || !AM.friend) return;
  const mine = amMine();
  const v = AM.friend.vitrine;
  const my = tobaPlayerState.achievements.find((x) => x.id === a.id) || a;
  const myDate = amHas(mine, a);
  const hisDate = amHas(v, a);
  const mystery = !myDate && isPlayerAchievementHidden(my, tobaPlayerState);
  const name = amPlayerName(v);
  let first = "";
  if (myDate && hisDate) first = myDate < hisDate ? "⚡ Você pegou primeiro!" : myDate > hisDate ? `⚡ ${escapeHtml(name)} pegou primeiro` : "🤝 Pegaram no mesmo dia";
  amEl("amAchTitle").textContent = mystery ? "🏆 Troféu secreto" : "🏆 Troféu";
  amEl("amAchBody").innerHTML = `
    <div class="pf-ach-detail">
      <span class="tp-medal tp-tier-${a.tier} is-big${myDate ? "" : " is-locked"}">${mystery ? "❓" : a.icon}</span>
      <strong>${mystery ? "???" : escapeHtml(a.name)}</strong>
      <span class="pf-tier pf-tier-${a.tier}">${PLAYER_TIERS[a.tier].name} · +${formatPlayerNumber(my.xp ?? PLAYER_TIERS[a.tier].xp)} XP</span>
      <p>${mystery ? "Segredo. Desbloqueia pra descobrir. 🤫" : escapeHtml(myDate ? a.desc : a.hint)}</p>
      <div class="am-ach-two">
        <span><b>Você</b>${myDate ? `✅ ${isoToBrDate(myDate)}` : `🔒 ${Math.floor((my.progress || 0) * 100)}%`}</span>
        <span><b>${escapeHtml(name)}</b>${hisDate === null ? "🙈 escondeu" : hisDate ? `✅ ${isoToBrDate(hisDate)}` : "🔒 ainda não"}</span>
      </div>
      ${first ? `<span class="tp-chip">${first}</span>` : ""}
    </div>`;
  openTobaModal("amAchModal");
}

function amDuelHtml(mine, v) {
  let me = 0;
  let him = 0;
  const rows = SOCIAL_STATS.map((s) => {
    const shown = s.section === "base" || (v.show || {})[s.section];
    const a = mine.stats[s.key];
    const b = shown ? v.stats?.[s.key] : undefined;
    // Peso só aparece se o amigo também mostra o dele
    if (s.key === "peso" && (b === null || b === undefined || a === null || a === undefined)) return "";
    const fmt = (x) => (x === null || x === undefined ? "--" : `${amNum(x, s.dec || 0)}${s.unit ? ` <small>${s.unit}</small>` : ""}`);
    let winA = false;
    let winB = false;
    if (shown && !s.noCrown && b !== null && b !== undefined) {
      const na = Number(a) || 0;
      const nb = Number(b) || 0;
      if (na > nb) { winA = true; me += 1; }
      if (nb > na) { winB = true; him += 1; }
    }
    return `
      <div class="am-duel-row">
        <span class="am-duel-val${winA ? " is-win" : ""}">${winA ? "👑 " : ""}${fmt(a)}</span>
        <span class="am-duel-label">${s.icon} ${escapeHtml(s.label)}</span>
        <span class="am-duel-val is-right${winB ? " is-win" : ""}">${shown ? fmt(b) : "🙈"}${winB ? " 👑" : ""}</span>
      </div>`;
  }).join("");
  if (me > him && AM.friend && !AM.friend.ghost) setTimeout(() => socialNoteFact("beat", AM.friend.uid), 0);
  const name = escapeHtml(amPlayerName(v));
  const verdict = me > him ? "Tu tá amassando. 😎🔥" : him > me ? `${name} tá na frente. Bora treinar! 💪` : "Empate técnico. Nunca foi sorte. 🙏";
  return `
    <div class="card am-score">
      <span class="am-score-num${me > him ? " is-win" : ""}">${me}</span>
      <span class="am-score-mid">👑 Placar <button type="button" class="am-help-btn" data-click="amHelp" data-help="duelo" aria-label="Como funciona o placar">❔</button><small>${verdict}</small></span>
      <span class="am-score-num${him > me ? " is-win" : ""}">${him}</span>
    </div>
    <div class="card am-duel">${rows}</div>`;
}

function amFriendProfileHtml(v) {
  const name = escapeHtml(amPlayerName(v));
  const shares = SOCIAL_SECTIONS.filter((s) => (v.show || {})[s.id]).map((s) => `<span class="tp-chip">${s.icon} ${escapeHtml(s.name)}</span>`).join("");
  const tiles = SOCIAL_STATS.filter((s) => s.section !== "base" && (v.show || {})[s.section] && v.stats?.[s.key] !== null && v.stats?.[s.key] !== undefined)
    .map((s) => `
      <div class="toba-stat">
        <span class="toba-stat-label">${s.icon} ${escapeHtml(s.label)}</span>
        <span class="toba-stat-value">${amNum(v.stats[s.key], s.dec || 0)}</span>
        <span class="toba-stat-sub">${s.unit || ""}</span>
      </div>`).join("");
  return `
    <section class="card pf-hero am-hero">
      ${socialAvatar(v, "lg")}
      <div class="pf-hero-title">${escapeHtml(v.look?.titleIcon || "")} ${escapeHtml(v.look?.title || "")}</div>
      <div class="pf-hero-level">${name} · Nível ${Number(v.level) || 1}</div>
      ${renderPlayerBar(Number(v.ratio) || 0)}
      <div class="pf-hero-xp"><span>${formatPlayerNumber(v.into)} / ${formatPlayerNumber(v.need)} XP</span><span>✨ ${formatPlayerNumber(v.xp)} XP total</span></div>
      <div class="am-updated">${v.username ? `${escapeHtml(socialAt(v.username))} · ` : ""}atualizado ${escapeHtml(amAgo(v.updatedAt) || "--")}</div>
    </section>
    <div class="section-title">👀 O que ${name} mostra</div>
    <div class="tc-chips">${shares || `<span class="tp-chip">⭐ Só nível e troféus</span>`}</div>
    ${tiles ? `<div class="toba-stats am-stats">${tiles}</div>` : ""}
    ${AM.friend && !AM.friend.ghost ? `<button type="button" class="btn btn-secondary am-unfriend" data-click="amRemove" data-uid="${escapeHtml(AM.friend.uid)}">💔 Desfazer amizade</button>` : ""}`;
}

/* ---------------------------------------------------------------------
 * ❔ Ajuda (jeito Toberson de explicar)
 * ------------------------------------------------------------------- */
const AM_HELP = {
  geral: {
    title: "🤝 Como funciona o Toba dos amigos",
    html: `
      <p><b>1. Escolhe teu @.</b> Em 📤 Compartilhar meu Toba tu cria um username (tipo <b>@Bertoba</b>). Ninguém mais pega o mesmo.</p>
      <p><b>2. Chama a tropa.</b> Manda teu @ ou o link pro Maracujeba. Ou toca em ➕ e digita o @ dele.</p>
      <p><b>3. Aceita o pedido.</b> Quem te adicionar aparece em 🔔 Pedidos. Aceitou, um vê o Toba do outro.</p>
      <p><b>4. X1 de troféus.</b> Toca no amigo e compara: 🏆 Troféus estilo PS5, 📊 Duelo dos números e 👤 o Toba dele.</p>
      <p>🔒 Teus dados de verdade nunca saem daqui: o amigo vê só um <b>resumo</b> (nível, troféus e totais). O 💰 Bank não aparece nunca, nem se tu pedir com jeitinho.</p>
      <p>👻 Sem amigo ainda? Abre o exemplo do Maracujeba fantasma lá embaixo pra ver como fica.</p>`,
  },
  privacidade: {
    title: "🙈 O que os amigos veem",
    html: `
      <p>Sempre: teu <b>@</b>, avatar, título, <b>nível, XP e troféus</b>.</p>
      <p>Cada chip ligado mostra os <b>totais</b> daquele app: 🏋️ treinos, kg levantado, km, streak · ✅ tarefas feitas · 🍳 pratos feitos · 🏁 abastecidas e km · 📍 lugares e cidades.</p>
      <p>Desligou um chip? Os números e os troféus daquele app somem da tua vitrine (o amigo vê 🙈).</p>
      <p>⚖️ <b>Teu peso</b> vem desligado. Só aparece se tu ligar.</p>
      <p>Nunca aparece: 💰 Bank, treino por treino, nome de tarefa, receita, lista de lugares, endereço. Isso fica só contigo. 🤐</p>
      <p>A vitrine se atualiza sozinha quando teu Perfil muda (abrindo o portal, o Perfil ou esta tela).</p>`,
  },
  username: {
    title: "🏷️ Username",
    html: `
      <p>É o teu nome na tropa: <b>3 a 20</b> letras sem acento, números, <b>_</b> ou ponto.</p>
      <p>Maiúscula é só visual: <b>@Bertoba</b> e <b>@bertoba</b> são o mesmo, então ninguém te imita trocando uma letrinha. 😏</p>
      <p>Dá pra trocar quando quiser. O @ antigo fica livre e os amigos continuam amigos.</p>`,
  },
  trofeus: {
    title: "🏆 Comparar troféus",
    html: `
      <p>Igual o comparador do PS5: cada linha é um troféu, com <b>Você</b> de um lado e o amigo do outro.</p>
      <p>✅ + data = pegou. 🔒 = ainda não (do teu lado mostra quanto falta em %). 🙈 = o amigo escondeu esse app.</p>
      <p>⚡ do lado de quem pegou <b>primeiro</b>. Toca no troféu pra ver os detalhes.</p>
      <p>Os filtros mostram o que <b>só tu tem</b> (pra tirar sarro), o que <b>só ele tem</b> (pra correr atrás), o que os dois têm e o que ninguém pegou.</p>
      <p>❓ Troféu secreto continua secreto até TU pegar. Se o amigo já tem, aparece "ele já tem 👀".</p>
      <p>🥉 Bronze · 🥈 Prata · 🥇 Ouro · 💎 Lendária.</p>`,
  },
  duelo: {
    title: "👑 Placar do Duelo",
    html: `
      <p>Cada número vale um ponto pra quem tiver mais: ganhou a linha, leva a 👑.</p>
      <p>O placar soma as coroas. Empate na linha não vale ponto, e o ⚖️ peso não tem coroa (não é competição de quem pesa mais 😂).</p>
      <p>Linha 🙈 = o amigo escondeu aquele app, então não conta.</p>
      <p>Ganhou o placar contra um amigo de verdade? Tem troféu 🤝 Amizade esperando por ti.</p>`,
  },
  adicionar: {
    title: "➕ Adicionar amigo",
    html: `
      <p>Digita o <b>@</b> do amigo (sem o @ também vale). Ele recebe o pedido em 🔔.</p>
      <p>Mandou o pedido? Ele já pode ver o teu Toba. Tu vê o dele quando ele <b>aceitar</b>.</p>
      <p>Mudou de ideia? Toca em <b>Cancelar</b> na lista. Desfazer a amizade corta o acesso dos dois na hora. 💔</p>`,
  },
};

function amHelp(key) {
  const help = AM_HELP[key] || AM_HELP.geral;
  amEl("amHelpTitle").textContent = help.title;
  amEl("amHelpBody").innerHTML = help.html;
  openTobaModal("amHelpModal");
}

/* ---------------------------------------------------------------------
 * Ações e partida
 * ------------------------------------------------------------------- */
tobaActions({
  amRefresh: () => {
    if (AM.phase === "offline" || AM.phase === "loading") return amStart();
    if (AM.phase === "on") return amLoadLists().then(() => {
      if (AM.friend && !AM.friend.ghost) {
        const f = (AM.friends || []).find((x) => x.uid === AM.friend.uid && x.status === "ok");
        if (f) {
          AM.friend.vitrine = f.vitrine;
          amRenderFriend();
        } else amCloseFriend();
      }
    });
    return null;
  },
  amOpenAdd: () => amOpenAdd(),
  amAddSubmit,
  amAccept,
  amReject,
  amRemove,
  amOpenShare,
  amShareSave,
  amShareSend,
  amShareCopy,
  amShareOff,
  amShareEdit: () => {
    const me = socialMyState();
    AM.editing = true;
    AM.shareDraft = { username: me.username, show: { ...me.show } };
    amRenderShare();
  },
  amToggleSection: (el) => {
    const id = el.dataset.id;
    AM.shareDraft.show[id] = !AM.shareDraft.show[id];
    el.classList.toggle("is-on", AM.shareDraft.show[id]);
  },
  amDraftName: (el) => {
    AM.shareDraft.username = el.value;
  },
  amOpenFriend,
  amOpenGhost,
  amCloseFriend,
  amTab: (el) => {
    AM.tab = el.dataset.tab;
    amRenderFriend();
  },
  amFilter: (el) => {
    AM.filter = el.dataset.filter;
    amRenderTab(amMine(), AM.friend.vitrine);
  },
  amOpenTrophy,
  amHelp: (el) => amHelp(el.dataset.help),
});

document.addEventListener("toba:social-user", (event) => amOnUser(event.detail));
document.addEventListener("toba:player", () => {
  if (AM.friend) {
    if (AM.friend.ghost) AM.friend.vitrine = amGhostVitrine();
    amRenderFriend();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  // Tira o ?add=/?open= da barra: recarregar não abre de novo
  if (location.search) history.replaceState(null, "", location.pathname);
  AM.pendingAdd = socialCleanUsername(params.get("add") || "");
  const open = params.get("open");
  if (open === "ghost") setTimeout(() => amOpenGhost(), 400);
  if (open === "share") AM.pendingShare = true;
  if (open === "add" && !AM.pendingAdd) AM.pendingAddOpen = true;
  amRenderHome();
  tobaPlayerCheck();
  amStart();
});

// Lembra quais categorias de troféu ficaram abertas (o redesenho não fecha)
document.addEventListener("toggle", (event) => {
  const el = event.target;
  if (!(el instanceof Element) || !el.matches(".am-cat") || AM.filter !== "todos") return;
  if (el.open) AM.openCats.add(el.dataset.cat);
  else AM.openCats.delete(el.dataset.cat);
}, true);
