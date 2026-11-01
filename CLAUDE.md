# CLAUDE.md — Toba Solutions

Guia para quem (humano ou IA) for mexer neste projeto. **O ponto mais sensível é o banco de dados**: ele vive no `localStorage` do navegador de cada usuário, não existe servidor nem migração centralizada. Um erro de formato apaga ou corrompe dados reais que não dá para recuperar daqui. Leia a seção "Banco de dados" inteira antes de alterar qualquer coisa que grave dados.

---

## 0. Fluxo de trabalho (OBRIGATÓRIO)

**Proibido fazer qualquer `git push`, `git commit`, `git add`/stage, criar branch, PR, tag ou publicar qualquer coisa automaticamente.** Também não rodar nada que altere o histórico ou o remoto (`reset`, `rebase`, `merge`, `pull`, `stash` etc.). Comandos de leitura (`git status`, `git diff`, `git log`) são permitidos.

O fluxo é sempre este:

1. O usuário pede o patch (descreve o que quer / o patch notes).
2. A IA **só edita os arquivos locais** nesta pasta e registra o patch no `PATCH-NOTES.md` (ver abaixo).
3. O usuário abre os arquivos no **VS Code** e testa.
4. **O usuário** faz o commit e o push, se e quando achar necessário.

Ao terminar um patch, informe a lista de arquivos alterados e o que testar — nunca ofereça nem execute commit/push. Mesmo que pareça conveniente, não pule essa regra; ela só muda se o próprio usuário editar este arquivo.

### 0.1 PATCH-NOTES.md (obrigatório em TODO patch)

- As notas de versão ficam em **`PATCH-NOTES.md`** na raiz (substitui o antigo `LEIA-ME.md`). Se o `PATCH-NOTES.md` ainda não existir e houver um `LEIA-ME.md`, no primeiro patch renomeie o `LEIA-ME.md` para `PATCH-NOTES.md` **mantendo todo o conteúdo** e troque as referências a ele.
- **Todo patch, sem exceção**, ganha uma entrada nova no `PATCH-NOTES.md`, acrescentada no **final** do arquivo (o conteúdo antigo nunca é apagado nem reescrito).
- Modelo da entrada (em pt-BR, linguagem de usuário, sem jargão técnico):

```markdown
---

## vX.YY — Título curto do patch

**Arquivos novos/alterados:** `caminho/arquivo1.js`, `caminho/arquivo2.css` (NOVO), ...

1. **Nome da mudança:** o que muda para quem usa o app.
2. ...

**Dados:** "Nenhuma mudança no banco." — ou descreva o campo novo, onde ele fica e que bancos/backups antigos continuam funcionando.

**Como testar:** passos rápidos para conferir no VS Code / navegador.

**Commit sugerido:** `vX.YY - descrição`
```

- A versão segue a sequência do último commit (`git log -1`): depois de `v1.16` vem `v1.17`, e assim por diante. Vários pedidos antes de um push entram na **mesma** entrada (atualize-a em vez de criar outra).

---

## 1. Visão geral

- PWA estático (HTML + CSS + JS puro, **sem build, sem npm, sem framework, sem módulos ES**). Publicado no **GitHub Pages**.
- Idioma da interface, comentários e commits: **português (pt-BR)**. Valores em **BRL**, datas exibidas como `dd/mm/aaaa`.
- Três apps dentro do portal, mais o Perfil do jogador (XP de tudo):
  - **Toba Bank** — Gastos, Investimentos, Raxador (divisão de contas).
  - **Toba Health** — Pesagem (balança) e Treinos (inclui Treino de Força).
  - **Toba Routine** — Rotina (tarefas com XP e cobranças, desde v1.41), Task (tarefas não rotineiras com sugestão de dia, desde v1.42), Agenda (24 h, desde v1.46) e Calendar (eventos com dia marcado, desde v1.49).
  - **Toba Kitchen** — Livro de Receitas (receitas no código, busca pelo que tem em casa, modo cozinha) e Programação da Semana, desde v1.43, e Lista de compras com catálogo do mercado pra tocar (página própria desde v1.53).
  - **Toba Racing** — Combustível (abastecimentos e histórico de km/l de tanque cheio a tanque cheio), desde v1.51. Dá só conquistas no Perfil (categoria 🏁 Pista, desde v1.56).
  - **Toba Turism** (na tela **"Toba Tourism"** desde v1.56; pasta, arquivos e banco continuam `TobaTurism`/`TOBA_TURISM_DB`) — Toba Places (listas de lugares pra visitar com link do Google Maps, tipo, anotação, "por que entrou", nota/custo-benefício/"iria de novo" de quem já foi e 🗺️ Mapa com os pinos desde v1.56), desde v1.55; Toba Travel aparece no hub como "SOON" (desabilitado). Não dá XP.
- Dependências externas, sempre **fixadas** (nunca versão flutuante), pelo jsdelivr: Chart.js `chart.js@4.4.7` e, desde v1.56, Leaflet `leaflet@1.9.4` (só o 🗺️ Mapa do Toba Places, carregado na hora que abre; os dois no `PRECACHE`). O mapa usa os quadradinhos do OpenStreetMap da CARTO (`basemaps.cartocdn.com/rastertiles/<estilo>/...png?key=`, não vão pro cache): desde v1.60 o padrão é o colorido `voyager` (o escuro `dark_all` ficava preto demais pra ler), com o 🌙/☀️ da barra do mapa pra trocar; a escolha fica só no celular em `localStorage["toba_turism_map_style"]` ("light"|"dark", conveniência, não é dado nem vai pra nuvem). **Desde v1.57 a CARTO exige chave**: a chave grátis de navegador do Rafa fica em `TURISM_CARTO_KEY` (places-map.js), pública no site como toda chave de mapa de front-end; trocar/limitar ao domínio é no painel da CARTO (Basemaps). Sem `{r}`/`@2x` na URL (não confirmado no endpoint novo) e a busca de endereço do Nominatim (`nominatim.openstreetmap.org`, sem chave, no máximo 1 busca por segundo).
- Commits seguem o padrão `vX.YY - descrição` (ex.: `v1.16 - Novo modulo de treino de força...`).

## 2. Estrutura

```
index.html                 Portal (card do jogador, cards, Configurador de cards, backup GERAL)
                             -> TobaBank/js/bank-metrics.js + TobaHealth/js/health-metrics.js + TobaRoutine/js/routine-metrics.js
                                + assets/toba-player.js + TobaRoutine/js/routine-alerts.js + TobaKitchen/js/kitchen-recipes.js
                                + TobaRacing/js/racing-metrics.js (desde v1.51) + TobaTurism/js/turism-metrics.js (desde v1.55)
                                + assets/portal.js + portal.css
Toba-Perfil.html           Perfil do jogador (XP, nível, streak, conquistas, recompensas, 🏆 Hall dos Heróis desde v1.47)
                             -> TobaHealth/js/health-metrics.js + TobaRoutine/js/routine-metrics.js + TobaKitchen/js/kitchen-recipes.js
                                + assets/toba-player.js + TobaHealth/js/hall-shared.js + assets/perfil-hall.js + assets/perfil.js + perfil.css
manifest.webmanifest       PWA (atalhos: add_expense, Pesagem, Treinos, Rotina de hoje -> TobaRoutine-Rotina.html;
                           share_target desde v1.55: "Compartilhar" do Google Maps -> TobaTurism-Places.html?title=&text=&url=)
sw.js                      Service worker (lista PRECACHE + VERSION)
assets/toba-common.js      Base de TODOS os apps: datas, dinheiro, decimais, escapeHtml, ações
                           (data-click...), folhas/modais, avisos, "Salvo ✓", estado vazio, ⚙️, backup
                           e a régua de arrastar tobaWheelPicker
assets/toba-common.css     Base visual de TODOS os apps: cores, botões, cards, quadradinhos, folhas, cabeçalho
assets/portal.js / .css    Só do portal
assets/toba-player.js/.css Perfil do jogador (desde v1.40): cálculo de XP/nível/streak/conquistas e as comemorações
                           (+XP, medalha, level up). Usado no portal, no Toba-Perfil.html e no Treinos (ver 3.9)
assets/perfil.js / .css    Só da página Toba-Perfil.html
assets/perfil-hall.js      Hall dos Heróis no Perfil (desde v1.47): vitrine do peso, grade 2×2 e páginas (só lê o TOBA_HEALTH_DB)
assets/pwa-register.js     Registra o sw.js (caminho relativo ao próprio script)
_molde-app/                Molde de app novo (copiar e preencher; ver _molde-app/README.md). Fora do PRECACHE.
icons/
TobaBank/
  TobaBank-Index.html      Hub do Bank (carrega o bank-core só para a ⚙️/backup)
  TobaBank-Gastos.html       -> js/bank-core.js + js/bank-metrics.js + js/categorias.js (gaveta de categorias) + js/gastos.js
  TobaBank-Investimento.html -> Chart.js + js/bank-core.js + js/investimento.js
  TobaBank-Raxador.html      -> js/bank-core.js + js/raxador.js
  css/bank-base.css + 1 css por módulo
TobaHealth/
  TobaHealth-Index.html    Hub do Health (carrega o health-core só para a ⚙️/backup)
  TobaHealth-Pesagem.html    -> js/health-core.js + js/pesagem.js
  TobaHealth-Treinos.html    -> js/health-core.js + js/health-metrics.js + ../TobaRoutine/js/routine-metrics.js + ../TobaKitchen/js/kitchen-recipes.js + ../assets/toba-player.js + js/hall-shared.js + js/hall.js + js/forca.js + js/sessao.js + js/sessao-saitama.js + js/treinos.js
  js/hall-shared.js        Cálculo puro do Hall (totais, mapa de calor, boneco SVG, formato do corpo, escadas de marcos,
                           frases). Recebe o banco por parâmetro; usado no Treinos e no Perfil (desde v1.47)
  css/health-base.css + 1 css por módulo
TobaRoutine/
  TobaRoutine-Index.html   Hub do Routine (desde v1.42; antes era a rotina). Chegou com ?task=... (notificação/atalho
                           antigo) = redireciona pra Rotina. -> js/routine-metrics.js + js/routine-core.js + js/routine-plan.js
  TobaRoutine-Rotina.html  Rotina (Hoje / Tarefas / Histórico) + as sessões de task do dia
                             -> js/routine-metrics.js + js/routine-core.js + ../TobaHealth/js/health-metrics.js
                                + ../assets/toba-player.js + js/routine-alerts.js + js/routine-plan.js
                                + js/routine-task-sheet.js + js/routine.js
  TobaRoutine-Task.html    Task (tarefas não rotineiras, sugestão de dia) -> mesma ordem, com js/task.js no fim
  TobaRoutine-Agenda.html  Agenda (desde v1.46): calendário 24 h em Dia/Semana. Abre do "Seu tempo livre" do
                           Hub (?view=day|week&date=AAAA-MM-DD) -> js/routine-metrics.js + js/routine-core.js
                           + ../TobaHealth/js/health-metrics.js + ../TobaKitchen/js/kitchen-recipes.js + ../assets/toba-player.js
                           + js/routine-alerts.js + js/routine-plan.js + js/routine-task-sheet.js + js/routine-events.js
                           + js/agenda.js; css/routine-base.css + css/agenda.css. Desde v1.49 grava: concluir/editar
                           rotina (visão Dia) e criar/editar evento
  TobaRoutine-Calendar.html  Calendar (desde v1.49): eventos com dia marcado (mês + próximos + já foi, ?date=)
                           -> js/routine-metrics.js + js/routine-core.js + js/routine-alerts.js + js/routine-plan.js
                           + js/routine-events.js + js/calendar.js; css/routine-base.css + css/calendar.css
  js/routine-metrics.js    Regras puras (quando a tarefa cai, streak por tarefa, XP, dia livre, sugestão de dia da task).
                           Também no portal, Perfil e Treinos
  js/routine-alerts.js     Frases das cobranças + agenda de avisos (APK) / conferência com a página aberta. Também no portal
  js/routine-plan.js       ⚙️ "Meu dia fixo" (folha) + marcar sessão de task. Em todas as páginas do Routine
  js/routine-task-sheet.js Folha da tarefa da rotina (#taskSheet, posta pelo JS) + routineToggleOccurrence (regra única
                           de marcar/desmarcar). Na Rotina e na Agenda (desde v1.49); cada página define onRoutineTaskSaved()
  js/routine-events.js     Folha de evento do Calendar (#eventSheet, posta pelo JS). No Calendar e na Agenda (desde v1.49)
  css/routine-base.css
TobaKitchen/                 (desde v1.43; ver 3.11)
  TobaKitchen-Index.html   Hub do Kitchen (placar de receitas feitas) -> js/kitchen-recipes.js + js/kitchen-core.js
  TobaKitchen-Receitas.html  Livro de Receitas + "O que tem aí?" + detalhe + Modo cozinha
                             -> js/kitchen-recipes.js + ../TobaHealth/js/health-metrics.js + ../TobaRoutine/js/routine-metrics.js
                                + ../assets/toba-player.js + js/kitchen-core.js + js/receitas.js
  TobaKitchen-Semana.html    Programação da Semana -> mesma ordem, com js/semana.js no fim
  TobaKitchen-Compras.html   Lista de compras (desde v1.53; 🧺 Escolher itens por chip + 🛒 Lista desde v1.54); ?semana=AAAA-MM-DD abre aquela semana, ?aba=escolher abre no Escolher
                             -> js/kitchen-recipes.js + js/kitchen-core.js + js/compras.js (não carrega o player: não dá XP)
  js/kitchen-recipes.js    CATÁLOGO das receitas e ingredientes (no código, não no banco) + regras puras
                           (falta o quê, lista de compras, resumo). Também no portal
  css/kitchen-base.css
TobaRacing/                  (desde v1.51; ver 3.12)
  TobaRacing-Index.html    Hub do Racing (um card por módulo + resumo; Combustivel?add=1 abre a folha) -> js/racing-metrics.js + js/racing-core.js
  TobaRacing-Combustivel.html  Abastecimentos + km/l (último tanque, média, gráfico, etanol x gasolina)
                             -> js/racing-metrics.js + ../TobaHealth/js/health-metrics.js + ../TobaRoutine/js/routine-metrics.js
                                + ../TobaKitchen/js/kitchen-recipes.js + ../TobaTurism/js/turism-metrics.js + ../assets/toba-player.js (desde v1.56)
                                + js/racing-core.js + js/combustivel.js
  js/racing-metrics.js     Regras puras do km/l (trechos de tanque cheio a cheio, resumo). Também no portal
  js/racing-core.js        Dono do TOBA_RACING_DB + ⚙️ "🚗 Meu carro" (apelido e litros do tanque)
  css/racing-base.css
TobaTurism/                  (desde v1.55; ver 3.13)
  TobaTurism-Index.html    Hub do Turism (card do Toba Places + Toba Travel "SOON" desabilitado + resumo) -> js/turism-metrics.js + js/turism-core.js
  TobaTurism-Places.html   Toba Places: listas (?lista=<id> abre uma) e lugares; ?title=&text=&url= = veio do Compartilhar (abre "Lugar novo" já preenchido)
                             -> js/turism-metrics.js + ../TobaHealth/js/health-metrics.js + ../TobaRoutine/js/routine-metrics.js
                                + ../TobaKitchen/js/kitchen-recipes.js + ../TobaRacing/js/racing-metrics.js + ../assets/toba-player.js (desde v1.56)
                                + js/turism-core.js + js/places-map.js + js/places.js
  js/places-map.js         🗺️ Mapa (Leaflet carregado na hora, pinos, busca no Nominatim, pôr pino tocando, "perto de mim") (desde v1.56)
  js/turism-metrics.js     Regras puras (resumo, link do Maps / busca, roteiro) + catálogos TURISM_TAGS e TURISM_RATINGS. Também no portal
  js/turism-core.js        Dono do TOBA_TURISM_DB + turismOpenExternal (abre o Maps; no APK vai pelo próprio WebView)
  css/turism-base.css
TobaAndroid/               App Android (APK): WebView que abre o site publicado + ponte window.TobaNative
                           (gastos lidos das notificações, alarmes, salvar arquivo). Java puro, Android Studio.
                           Fora do PRECACHE. Passo a passo em TobaAndroid/README.md (ver seção 4.1)
PATCH-NOTES.md             Notas de cada patch (antigo LEIA-ME.md — ver seção 0.1)
CLAUDE.md                  Este guia
```

- Tudo é **global** (funções e variáveis no `window`). A ordem dos `<script>` importa: `../assets/toba-common.js` vem **primeiro** em toda página, depois o `*-core.js`, depois o módulo; em Treinos a ordem é `health-core.js` → `health-metrics.js` (catálogo de força, escalas do Hall e conta do kg levantado, desde v1.40) → `../TobaRoutine/js/routine-metrics.js` → `../assets/toba-player.js` → `hall-shared.js` (cálculo puro do Hall, desde v1.47) → `hall.js` (páginas de detalhe do Hall **do mês**, view `viewDetail`; só leitura do banco) → `forca.js` → `sessao.js` (treino ao vivo, view `viewSession`) → `sessao-saitama.js` (Saitama ao vivo, mesma view) → `treinos.js`; `hall.js`, `forca.js`, `sessao.js`, `sessao-saitama.js` (e qualquer arquivo novo carregado antes de `treinos.js`) só chama funções de `treinos.js` dentro de funções (nunca na carga do arquivo). Arquivo JS novo: acrescente o `<script>` na ordem certa **e** no `PRECACHE` do `sw.js`.
- Desde a v1.22 os cores não repetem mais helpers (tudo comum está no `toba-common.js`) e cada um tem nomes próprios (`exportBankBackup`/`exportHealthBackup`...). Ainda assim cada página registra **um** app em `tobaSetupApp` (a ⚙️ faz backup de um app só); não misture dois cores numa página sem necessidade.
- Os nomes dos arquivos HTML **não podem mudar** (links, favoritos, atalhos do manifest e o atalho `?action=add_expense` dependem deles).

---

## 3. Banco de dados (LEIA ANTES DE MEXER)

### 3.1 Princípios inegociáveis

1. **Os dados estão presos à origem do site** (domínio + caminho do GitHub Pages). Mudar o nome do repositório, o domínio ou mover para outro host = o usuário abre o app "vazio". Não faça isso sem um plano de exportar/importar backup.
2. **Nunca renomeie as chaves do `localStorage`** nem campos já existentes. Só **acrescente** campos novos.
3. **Todo campo novo precisa ser opcional na leitura**: bancos antigos e backups `.json` antigos não terão o campo. Garanta o valor padrão na função de normalização (ver 3.4) **e** leia de forma defensiva (`x || []`, `x ?? null`, `Number(x) || 0`).
4. **Nunca remova dados do usuário silenciosamente.** Se precisar transformar formato, transforme em memória no load e mantenha compatibilidade de import/export.
5. **Não grave antes de carregar.** O Bank tem trava (`isDbLoaded`); respeite-a.
6. **Backups antigos precisam continuar importáveis.** Qualquer mudança de formato tem que passar pelo mesmo normalizador usado no load.
7. O service worker **nunca** toca no `localStorage`; não mude isso.

### 3.2 Chaves do `localStorage`

| Chave | Dono | Conteúdo |
|---|---|---|
| `TOBA_BANK_DB` | `bank-core.js` | Banco principal do Toba Bank (JSON) |
| `TOBA_BANK_DB_AUTO_BACKUP` | `bank-core.js` | Cópia do valor **anterior** do banco, atualizada a cada `saveDatabase()` e no load |
| `TOBA_BANK_DB_PRE_REFACTOR_BACKUP` | `bank-core.js` | Cópia única feita na 1ª abertura da versão reorganizada. **Nunca sobrescrever** |
| `TOBA_BANK_DB_PRE_CATEGORIES_BACKUP` | `bank-core.js` | Cópia única do banco antes da 1ª troca para as categorias novas (v1.35). **Nunca sobrescrever** |
| `TOBA_HEALTH_DB` | `health-core.js` | Banco principal do Toba Health (JSON) |
| `TOBA_HEALTH_DB_PRE_REFACTOR_BACKUP` | `health-core.js` | Cópia única, mesma regra acima |
| `TOBA_HEALTH_DB_AUTO_BACKUP` | `health-core.js` | Cópia do valor **anterior** do banco, atualizada a cada `saveHealthDb()` e no load (desde v1.21) |
| `TOBA_HEALTH_DB_CORRUPT_<timestamp>` | `health-core.js` | Texto original quando o JSON do Health não pôde ser lido (uma cópia por conteúdo) |
| `TOBA_HEALTH_ACTIVE_SESSION` | `TobaHealth/js/sessao.js` | Treino ao vivo em andamento (desde v1.27): `{ v: 1, id, startedAt (ms), date, routineId, title, current, exercises: [{ exerciseId, skipped, sets: [{ reps, kg, done }] }], rest: { duration, startedAt, endsAt, alerted }, restDefault, updatedAt, kind?, saitama? }`. `kind` (desde v1.36): ausente/`"strength"` ou `"saitama"`; no Saitama `exercises` fica `[]` e `saitama = { pushups, situps, squats, step, autoRest, log: [{ field, n, at }] }`. Temporário: apagado ao finalizar (vira um treino `strength` normal em `workouts`, só com as séries `done`, ou um treino `saitama` normal com os totais) ou descartar. Ilegível = só oferece "Descartar". Não é lido por backup do módulo nem por `normalizeHealthDb` |
| `toba_health_live_prefs` | `TobaHealth/js/sessao.js` | Preferências de tela do treino ao vivo (desde v1.36): `{ keepAwake, saitamaStep, saitamaAutoRest, saitamaRest, autoNext }`. Ausente = tela acesa ligada, passo 10, descanso automático ligado, 60 s, nova série automática desligada. `autoNext` (desde v1.50): descanso que zera fecha sozinho (força e Saitama) |
| `TOBA_PLAYER_DB` | `assets/toba-player.js` | Perfil do jogador (desde v1.40), ver 3.9: `{ v: 1, createdAt, settings: { weeklyGoal }, seen: { xp, level, achievements: [ids] }, equipped: { title, avatar, frame, color } }`. **Não guarda XP de verdade**: o XP é calculado dos treinos; `seen` só serve para saber o que já foi comemorado |
| `TOBA_PLAYER_DB_AUTO_BACKUP` | `assets/toba-player.js` | Cópia do valor **anterior** do perfil, atualizada a cada `savePlayerDb()` e no load |
| `TOBA_PLAYER_DB_CORRUPT_<timestamp>` | `assets/toba-player.js` | Texto original quando o perfil não pôde ser lido (uma cópia por conteúdo); com ele ilegível nada é gravado até restaurar ou "Recomeçar perfil" |
| `toba_player_prefs` | `assets/toba-player.js` | `{ sound, vibrate }` das comemorações (desde v1.40). Ausente = os dois ligados |
| `TOBA_ROUTINE_DB` | `TobaRoutine/js/routine-core.js` | Banco do Toba Routine (desde v1.41), ver 3.10 |
| `TOBA_ROUTINE_DB_AUTO_BACKUP` | `TobaRoutine/js/routine-core.js` | Cópia do valor **anterior** da rotina, atualizada a cada `saveRoutineDb()` e no load |
| `TOBA_KITCHEN_DB` | `TobaKitchen/js/kitchen-core.js` | Banco do Toba Kitchen (desde v1.43), ver 3.11 |
| `TOBA_KITCHEN_DB_AUTO_BACKUP` | `TobaKitchen/js/kitchen-core.js` | Cópia do valor **anterior** do Kitchen, atualizada a cada `saveKitchenDb()` |
| `toba_kitchen_live` | `TobaKitchen/js/receitas.js` | Modo cozinha em andamento (desde v1.43): `{ v: 1, recipeId, servings, planId, step, done: [índices], startedAt, timer: { step, endsAt (ms) \| null, left (ms), alerted } \| null }`. Temporário: apagado ao terminar (vira entrada em `cooked`) ou largar. Ilegível = ignorado |
| `toba_kitchen_prefs` | `TobaKitchen/js/receitas.js` | `{ keepAwake }` do modo cozinha (desde v1.43). Ausente = tela acesa ligada |
| `TOBA_RACING_DB` | `TobaRacing/js/racing-core.js` | Banco do Toba Racing (desde v1.51), ver 3.12 |
| `TOBA_RACING_DB_AUTO_BACKUP` | `TobaRacing/js/racing-core.js` | Cópia do valor **anterior** do Racing, atualizada a cada `saveRacingDb()` |
| `TOBA_TURISM_DB` | `TobaTurism/js/turism-core.js` | Banco do Toba Turism (desde v1.55), ver 3.13 |
| `TOBA_TURISM_DB_AUTO_BACKUP` | `TobaTurism/js/turism-core.js` | Cópia do valor **anterior** do Turism, atualizada a cada `saveTurismDb()` |
| `toba_modules_config` | `assets/portal.js` | `[{ id, visible }]` — ordem/visibilidade dos cards do portal |
| `toba_bank_card_config` | `assets/portal.js` | `{ type: "personalizado"\|"simples", orcamento, cofre, gastos, sobra, addGasto, privacy }` (mesclado com defaults) |
| `toba_health_card_config` | `assets/portal.js` | Desde v1.37: `{ type: "personalizado"\|"simples", metrics: { peso, pesoMes, treinos, km, semana, kcal, minutos, saitama, gordura }, links, privacy }`. `metrics` é mesclado com os defaults de `HEALTH_CARD_METRICS` (número novo = item novo na lista, nunca renomear a `key`) |
| `toba_routine_card_config` | `assets/portal.js` | Desde v1.43: `{ type: "personalizado"\|"simples", metrics: { hoje, livreSemana, mes, tasks, livreHoje, semana, amanha, atrasadas, streak, xp }, links, todayList? }`, mesma regra do Health (`ROUTINE_CARD_METRICS`). "Simples" = a linha de chips de antes. `todayList` (desde v1.48, ausente = `false`): lista das tarefas de hoje no card, vale nos dois tipos |
| `toba_cloud_state` | `assets/toba-cloud.js` | Desde v1.59: estado da ☁️ Conta **deste aparelho**: `{ v: 1, deviceId, uid, email, syncedUid, lastSync, keys: { CHAVE: { hash, at } }, localAt: { CHAVE: ms }, deleted: { CHAVE: ms }, off: { CHAVE: true }, daily: { CHAVE: "AAAA-MM-DD" }, presync: { uid: ms } }`. Só o `toba-cloud.js` grava (o `setItem` de fora nessa chave é ignorado de propósito: um backup geral antigo traria o estado de outro aparelho). Não é dado do usuário; apagar só faz o próximo login perguntar de novo |

Ao criar uma chave nova: use prefixo `TOBA_` (bancos) ou `toba_` (preferências de UI) e documente aqui. O backup geral do portal já pega **todas** as chaves automaticamente.

### 3.3 Convenções de tipos (onde mais dá erro)

- **Datas**: string ISO local `"AAAA-MM-DD"`. Mês: `"AAAA-MM"` (chave de `db.months`). Gerar com `toIsoDate()` (toba-common; aceita um `Date`). **Não use `new Date().toISOString().slice(0,10)` para dado gravado** — é UTC e erra o dia à noite no Brasil. Comparações de data são feitas como string (`startsWith(monthKey)`, `<`), então o formato tem que ser exatamente esse.
- **Dinheiro**: `number` em **reais** (float, ex.: `12.5`), não centavos. Ler inputs com `getMoney(id)`; exibir com `formatCurrency()` / `formatMoneyInput()`.
- **Decimais do Health**: `number` ou `null`. Ler com `parseTobaDecimal()`; exibir com `formatDec1/formatDec2` (mostram `--` para null).
- **IDs** (tipos diferentes por coleção — não "padronize" sem migração):
  - Bank (tudo): **string** `Date.now().toString()`. Compare sempre com `String(a) === String(b)`.
  - Health `weighIns[].id`: **number** `Date.now()` (compare com `String(a) === String(b)`; na edição o id original é mantido).
  - Health `workouts[].id`: **string** `` `${Date.now()}-${rand6}` `` (bancos antigos podem ter outros formatos; compare com `String()`).
  - Health `strengthRoutines[].id`: **string** `` `r-${Date.now()}-${rand4}` ``.
  - Cuidado: dois `Date.now()` no mesmo tick geram o mesmo id (veja `newFund`, que usa `Date.now() + 1`). Ao criar vários itens de uma vez, acrescente sufixo aleatório.
- **Categorias** do Gastos (desde v1.35) são gravadas como **id** curto (`"mercado"`, `"uber"`...) da tabela `BANK_CATEGORY_GROUPS` em `bank-core.js`; nome e emoji vêm de lá (`getBankCategory`/`getCleanCategory`). Nunca troque nem remova um `id` (deixa gastos órfãos); renomear é só mudar `name`/`short`. Categoria nova = item novo na tabela. O texto antigo (até v1.34, ex. `"Moradia - Aluguel/Condomínio"`) é convertido no load por `migrateBankCategories()` via `BANK_CATEGORY_MIGRATION` (em `transactions`, `installments`, `config.fixedExpenses` e `fixedExpensesSnapshot`); o texto original fica em `oldCategory` (opcional) e texto desconhecido vira `"outros"`. **Não remova essa migração**: backup antigo importado depende dela. Na tela, campo de categoria = `<input type="hidden">` + botão `.category-field` (`categorias.js`); mude o valor pelo JS com `setCategoryField(id, valor)`. O Raxador tem categorias próprias (texto com emoji), fora disso.

### 3.4 Toba Bank — `TOBA_BANK_DB`

Arquivo: [TobaBank/js/bank-core.js](TobaBank/js/bank-core.js). Variável global `db`.

```js
{
  version: 29,                       // hoje é fixado em 29 no load (não é usado para migrar)
  config: {
    startDate: "AAAA-MM-DD",         // início do controle (formato antigo "dd/mm/aaaa" é convertido no load)
    fixedExpenses: [ { id, name, amount, category } ],
    // fixedTotal: number            // LEGADO — convertido em fixedExpenses no load
  },
  months: {
    "AAAA-MM": {
      dailyBudget: number,           // orçamento diário do mês
      fixedExpensesSnapshot: [ ... ] // cópia de config.fixedExpenses congelada para meses passados
    }
  },
  transactions: [ { id, description, amount, category, date, notifId?, oldCategory? } ], // gasto à vista; category = id (3.3)
                                     // notifId (opcional, desde v1.34): id da notificação de compra que o app
                                     // Android leu; só evita lançar duas vezes. Sem default no load (ausente = manual)
  installments: [ { id, description, totalAmount, totalInstallments, startDate, category } ],
  investmentFunds: [ {
    id, name,
    isCofrinho: bool,                // cofrinho não tem balanceLogs de rendimento
    deposits:    [ { id, date, amount } ],
    withdrawals: [ { id, date, amount } ],
    balanceLogs: [ { id, date, amount, isSystem?: true } ], // isSystem = gerado pelo app (criação, resgate, encerramento)
    isFinished: bool,
    irAmount: number,
    closeAmount?: number, closeDate?: "AAAA-MM-DD"            // só quando encerrado
  } ],
  splitterGroups: [ {
    id, name, category, date,
    members: [ "Nome", ... ],        // nomes são a CHAVE (ver armadilhas)
    expenses: [ { id, desc, amount, payer: "Nome", date, shares: { "Nome": pct } } ], // pct soma 100
    isFinished: bool
  } ]
}
```

**Ciclo de vida**
- `loadDatabase()` roda no `DOMContentLoaded` de cada página do Bank. Ele: cria o `_PRE_REFACTOR_BACKUP` (uma vez), faz `JSON.parse`, **preenche campos ausentes** (é a "migração"), atualiza o `_AUTO_BACKUP`, e só então marca `isDbLoaded = true`.
- Se o JSON estiver ilegível: mostra alerta e **não** libera gravação (`isDbLoaded` fica `false`) — isso protege o dado original. Não "conserte" isso trocando por um banco vazio.
- Se não há dado: grava o banco padrão.
- `saveDatabase(options)`: copia o valor atual para `_AUTO_BACKUP`, grava `JSON.stringify(db)`, chama `onBankDataSaved()` (cada página sobrescreve para redesenhar) e mostra "Salvo ✓" (`{ silent: true }` não mostra). Devolve `true` se gravou, `false` se não (desde v1.34).
- **Gastos automáticos (app Android), pendentes desde v1.47:** a fila do app (`TOBA_NATIVE.getPendingPurchases()`) **não** entra mais sozinha no mês. `refreshPendingPurchases()` em `gastos.js` (no load do Gastos e no `window.onTobaAppResume`) lê a fila, tira lixo e o que já tem gasto com o mesmo `notifId` (ack automático) e mostra o card "🤖 N compras esperando você" + a folha `pendingModal`. Lançar = formulário de gasto preenchido (`expensePendingId`), grava com `notifId` e só então `ackPurchases`; "Lançar todas" idem em lote; descartar = `ackPurchases` direto. A pendente mora **só na fila do app** (nada novo no `TOBA_BANK_DB`). "⚠️ Parece repetida" (mesmo valor + loja + dia) só avisa. O portal mostra a faixa `#portalPending` (renderPortalPending, só leitura). Nunca tire da fila antes de gravar.
- `importBankBackup(text)`: aceita JSON com `version` ou `transactions`, grava **sem normalizar** e dá `location.reload()` — a normalização acontece no load seguinte. Logo, **toda migração precisa estar em `loadDatabase()`**.
- `resetBankData()`: remove só `TOBA_BANK_DB` (os backups automáticos ficam).

**Como adicionar um campo/coleção no Bank (receita)**
1. Adicione o default no objeto inicial `db` (topo do `bank-core.js`).
2. Adicione o preenchimento em `loadDatabase()` no mesmo estilo: `if (!parsed.novoCampo) parsed.novoCampo = [];` (e, para itens de lista, dentro do `forEach` correspondente com `=== undefined`).
3. Leia de forma defensiva em todo lugar (inclusive no portal, ver 3.6).
4. Se for uma transformação real de formato, faça-a idempotente (rodar 2× não pode estragar) — o load roda em toda abertura de página.
5. Se quiser começar a usar `version` para migrações, faça `if ((parsed.version || 0) < 30) { ...; }` **antes** da linha que fixa `parsed.version`, e atualize o número nos dois lugares (objeto inicial e load).

### 3.5 Toba Health — `TOBA_HEALTH_DB`

Arquivo: [TobaHealth/js/health-core.js](TobaHealth/js/health-core.js). Variável global `healthDb`.

```js
{
  age: number|null, height: number|null /* cm */, gender: "Masculino"|"Feminino"|null,
  metricsOrder: [ { key, label, type: "int"|"dec1"|"dec2", active, color?, placeholder, unit, digits? } ],
  weightFormat: { type: "dec1"|"dec2", digits: 1..3 },   // desde v1.51; ausente = { "dec2", 2 }
  weighIns: [ {
    id: number, date: "AAAA-MM-DDTHH:MM" /* data E hora (datetime-local) */, weight: number,
    // + uma propriedade por métrica de metricsOrder (score, fat, muscle, water, bmr,
    //   visceral, protein, bone, bodyAge), valor number|null
  } ],
  workouts: [ {
    id: string, type: "saitama"|"walking"|"bike"|"elliptical"|"custom"|"strength",
    title, date: "AAAA-MM-DD",
    durationMinutes, calories, distanceKm, pushups, situps, squats, sets, reps, weightKg, // number|null
    notes: string,
    // só type "strength":
    routineId: string,               // "" se não veio de um treino salvo
    exercises: [ { exerciseId, name, group, sets: [ { reps, kg } ] } ]
  } ],
  strengthRoutines: [ { id, name, exercises: [ { exerciseId, sets: [ { reps, kg } ] } ] } ],
  exerciseSettings: { [exerciseId]: { load: "total"|"perHand", unilateral: bool } } // desde v1.39; ausente = Total/bilateral
}
```

**Ciclo de vida**
- `healthDb = loadHealthDb()` roda **na carga do script** (não no DOMContentLoaded).
- `normalizeHealthDb()` é a função de migração: usada no load **e** no `importHealthBackup()`. Toda compatibilidade nova entra **aqui**.
- Trava `isHealthDbLoaded` (igual ao `isDbLoaded` do Bank): só vira `true` quando o banco foi lido (ou não existia). Se o JSON estiver ilegível, o texto original vai para `TOBA_HEALTH_DB_CORRUPT_<ts>` (uma vez por conteúdo), o app abre vazio, mostra o aviso "Dados protegidos" e **`saveHealthDb()` não grava nada**. Importar um backup ou "Apagar Tudo" liberam a trava. Não "conserte" isso gravando o banco vazio.
- `saveHealthDb()`: copia o valor atual para `TOBA_HEALTH_DB_AUTO_BACKUP` e grava tudo; em erro (quota) mostra aviso.
- `importHealthBackup()` só aceita arquivo com `weighIns`, `workouts` ou `metricsOrder` (`looksLikeHealthBackup`): backup do Bank ou geral do portal seriam lidos como banco vazio.
- Depois de importar/apagar, chama `onHealthDataReplaced()` (cada página sobrescreve).
- `clearHealthData()` remove só `TOBA_HEALTH_DB`.

**Armadilhas específicas do Health**
- **`weighIns[].date` tem hora** (`"AAAA-MM-DDTHH:MM"`, campo `datetime-local` da Pesagem; backups antigos podem ter só `"AAAA-MM-DD"`). Quem compara por dia usa `String(date).slice(0, 10)` (`computePlayer`, `calcHealthSummary`, `getBodyWeightOn`). Até a v1.50 o Perfil e o card do Health testavam o texto inteiro contra `AAAA-MM-DD` e ignoravam todas as pesagens com hora (conquista "Amigo da balança" travada em 0).
- **Formato do campo na balança** (desde v1.51, ⚙️ "Métricas da balança" → "Visor"): `metricsOrder[].type` (casas decimais: `int`/`dec1`/`dec2`, agora escolhível) + `metricsOrder[].digits` (dígitos antes da vírgula, 1–4; ausente = `DEFAULT_METRIC_DIGITS`; escolhido na folha de quadradinhos `#formatPickerModal`, desde v1.52) e `weightFormat` pro peso (só muda o campo de digitar; a tela continua mostrando o peso com 2 casas). A máscara (`toba-mask-*` + `data-digits`, toba-common) pula pro próximo campo quando completa dígitos + casas. Editar uma pesagem sem mexer num campo mantém o valor gravado exato (`data-orig`), mesmo que o formato novo mostre menos casas.
- **`metricsOrder` é salvo no banco do usuário.** Adicionar uma métrica em `DEFAULT_METRICS_ORDER` **não** faz ela aparecer para quem já tem dados. Para isso, acrescente em `normalizeHealthDb()` um merge: para cada métrica padrão cuja `key` não existe em `db.metricsOrder`, dar `push` (preservando ordem/`active` do usuário). Para remover uma métrica, filtre por `key` (como já é feito com `bmi`), mas **não apague** o valor dos `weighIns` antigos.
- Ao salvar uma pesagem, métricas inativas (fora da tela) **mantêm o valor antigo** do registro — preserve esse comportamento.
- **Catálogo de força** (`STRENGTH_GROUPS` / `STRENGTH_EXERCISES` em [health-metrics.js](TobaHealth/js/health-metrics.js) desde v1.40, antes em forca.js): os `id` são referência gravada.
  - `strengthRoutines` guardam **só** `exerciseId` → nunca renomeie nem remova um `id` de exercício; para "remover", esconda da UI mas mantenha no catálogo.
  - `workouts` de força guardam um **snapshot** de `name` e `group` (histórico não muda se o catálogo mudar). O `group` alimenta o futuro mapa de calor; mantenha-o gravado.
  - Pode renomear o `name` exibido; o `id` fica.
  - `alsoIn` (opcional, desde v1.47): grupos extras onde o exercício aparece na lista de escolha (`getStrengthExercisesInGroup`); o gravado continua sendo `group`.
- **Peso levantado com peso do corpo** (só cálculo, nada gravado): os campos `pushups/squats/situps` (Saitama) e os exercícios do catálogo com `bodyweight` somam `reps × peso do corpo × fração` (`BODYWEIGHT_FIELDS` em health-metrics.js; `bodyweight` em `STRENGTH_EXERCISES`). O peso do corpo é a pesagem mais recente até a data do treino (`getBodyWeightOn`, padrão 75 kg). `BODYWEIGHT_FIELDS` também dá o **grupo muscular** desses campos; `getWorkoutMuscleWork(workout)` devolve `[{ group, exerciseId, reps, kg }]` de qualquer treino e é a base do futuro mapa de calor. Campo novo de exercício de peso do corpo precisa entrar ali com grupo.
- **Volume (kg levantados)** só em `calcStrengthLift()` / `calcWorkoutLift()` (health-metrics.js, desde v1.40; `getStrengthLift`/`getWorkoutLift`/`getBodyWeightOn` em forca.js/treinos.js só repassam o `healthDb`), que aplica `exerciseSettings`: por halter (bilateral) dobra a carga, unilateral dobra as reps. Vale para todo o histórico do exercício (não é snapshot). Chip ⚖️ (`renderExerciseLoadChip`) no treino ao vivo e na página do treino abre a folha `exerciseLoadModal`.
- Treinos `custom` antigos usam `sets/reps/weightKg` soltos; treinos `strength` usam `exercises[]` e deixam esses campos `null`. `getWorkoutLift()` trata os dois casos — qualquer métrica nova de treino precisa tratar os dois também.
- **Página de um treino** (`viewWorkout`, `openWorkoutView`/`renderWorkoutView` em treinos.js, desde v1.29): só leitura; `renderWorkoutScreen()` redesenha a página aberta depois de editar e volta para o mês se o treino foi excluído.
- **Hall dos Heróis** (desde v1.47): o da vida toda mora no Perfil (`perfil-hall.js`, lendo o `TOBA_HEALTH_DB` por `readPlayerSource`, só leitura); o Treinos só tem o Hall de cada mês. As contas ficam em `hall-shared.js` (`calcHallLifetimeStats`, `calcMuscleHeat`, `calcWorkoutMuscleWork`, `calcHallLadder`), que recebem o banco por parâmetro; `treinos.js`/`hall.js` só repassam o `healthDb`. O CSS do boneco (`.muscle-map`, níveis, ranking) mora no `toba-common.css`.
- **Mapa de calor** (hall-shared.js, desde v1.30): `getMuscleHeat(workouts)` soma por grupo o **esforço** (`effort`, "pts", desde v1.45) = reps × intensidade × fatia do músculo. Intensidade (`calcMuscleIntensity`) = carga por rep (mesma conta do `calcStrengthLift`, peso do corpo incluso) ÷ `MUSCLE_REF_KG[exercício]` (carga normal de 10 reps de um cara de 30 anos), presa entre 0,25 e 2; série sem carga = 0,5. `calcExerciseEffort` faz isso série por série. Fatias em `MUSCLE_SPLITS` (cada exercício reparte entre vários grupos, somam 1). Também guarda `reps`/`kg` já repartidos. Exercício novo no catálogo = linha nova em `MUSCLE_SPLITS` **e** `MUSCLE_REF_KG` (sem elas, 100% no grupo dele e intensidade 1). Níveis, ranking e o formato do corpo usam `effort`; `renderMuscleMini` (card do mês, sem toque) e `renderMuscleSection` (mês e página do treino, músculo tocável → `showMuscleHeat`). Cardio e km soltos (Saitama/personalizado) entram como reps equivalentes por km via `CARDIO_MUSCLES`/`getMuscleExtras` (desde v1.31; cada rep vale `MUSCLE_CARDIO_INTENSITY` = 0,4 pt); tipo de treino novo precisa entrar ali. O boneco é SVG à mão em `MUSCLE_SHAPES`, uma peça por id do `STRENGTH_GROUPS`; grupo novo precisa de forma ali e de frase em `MUSCLE_LAZY_LINES`.
- **Treino ao vivo** ([sessao.js](TobaHealth/js/sessao.js)): grava só na chave `TOBA_HEALTH_ACTIVE_SESSION` enquanto acontece; no fim monta o treino no **mesmo formato** do `registerStrengthWorkout` e só apaga a sessão depois de conferir que o `TOBA_HEALTH_DB` gravou. Tempos (cronômetro e descanso) são horários `Date.now()`, nunca contagem de `setInterval` (o celular congela a aba). Frases de descanso são só de tela. O Saitama ao vivo ([sessao-saitama.js](TobaHealth/js/sessao-saitama.js), desde v1.36) usa a mesma chave/tela com `kind: "saitama"` e no fim grava um treino `saitama` no **mesmo formato** do formulário (`pushups/situps/squats/distanceKm/durationMinutes/calories/notes`); desde v1.50 o fim ao vivo não pede km (`distanceKm: null`) e mostra o aviso de que a caminhada/corrida é um treino `walking` à parte. A tela acesa (Wake Lock no navegador, `keepScreenOn` no APK) obedece `keepAwake` de `toba_health_live_prefs`. No APK (desde v1.39) `storeLiveSession`/`dropLiveSession` mostram/tiram a notificação fixa com cronômetro (o Android conta a partir do `startedAt`); tocar abre `TobaHealth-Treinos.html?live=1`, que vai direto para o treino.
- Todo treino precisa ter `type` conhecido; tipos novos precisam de ícone em `WORKOUT_TYPE_ICONS` (senão cai no 🏅) e de tratamento nos cálculos (distância, reps do Saitama etc.).

### 3.6 Leitores "fora do dono" (precisam acompanhar mudanças de formato)

- **Faixa "pisou na jaca"** do Gastos (desde v1.45, `renderJacaBanner` em gastos.js): usa `recoveryDays`/`recoveryInMonth` de `calcBankMonthSummary` = dias sem gastar (a partir de amanhã) até o Livre hoje ficar positivo pela regra do `carryDebt`.
- **Portal `assets/portal.js` → `obterMetricasReaisTobaBank()`** lê `TOBA_BANK_DB` direto, mas o cálculo é o **mesmo** da tela de Gastos: os dois chamam `calcBankMonthSummary()` de [TobaBank/js/bank-metrics.js](TobaBank/js/bank-metrics.js) (desde v1.21). Regra nova do painel do Gastos entra **só** em `bank-metrics.js`. Esse arquivo não pode depender de `bank-core.js` (o portal carrega ele sozinho) e só lê o banco, nunca grava.
- **Portal → card do Health** (desde v1.37) lê `TOBA_HEALTH_DB` direto por `calcHealthSummary()` de [TobaHealth/js/health-metrics.js](TobaHealth/js/health-metrics.js) (só leitura, não depende de `health-core.js`). Treinos do mês seguem a **mesma regra** de `getWorkoutMonthStats` (treinos.js): mudou lá, mude aqui. Peso levantado fica de fora do card. Campo novo em pesagem/treino que o card mostre precisa de leitura defensiva ali.
- **Portal → card do Routine** (desde v1.43) lê `TOBA_ROUTINE_DB` por `readRoutineDbRaw()` + `calcRoutineSummary()` de [routine-metrics.js](TobaRoutine/js/routine-metrics.js), que só junta as regras das telas (`calcRoutineToday`, `calcRoutineDayLoad` = mesmo livre do hub, `routineOneoffStatus`, `calcRoutineTaskStreak`, `calcRoutinePlayer` pro XP do mês). Regra nova da rotina entra nessas funções, não no portal. **Exceção que grava (desde v1.48):** a lista "📋 Tarefas de hoje" do card (`calcRoutineTodayList` + `toggleRoutineFromCard` em portal.js) marca/desmarca a tarefa de **hoje** mexendo só em `log` (entrada no mesmo formato do `routineToggleOccurrence`, routine-task-sheet.js, usado pela Rotina e pela Agenda), relendo o texto cru na hora, copiando o valor anterior em `TOBA_ROUTINE_DB_AUTO_BACKUP` e devolvendo o resto do banco como estava. Banco ilegível = não grava. Mudou o formato do `log` ou a regra de marcar na Rotina? Mude aqui junto.
- **Portal → card do Turism** (desde v1.55) lê `TOBA_TURISM_DB` direto por `calcTurismSummary()` de [turism-metrics.js](TobaTurism/js/turism-metrics.js) (só leitura; lugar de lista apagada não conta; ilegível = card sem números).
- **Portal → card do Kitchen** (desde v1.43) lê `TOBA_KITCHEN_DB` direto por `calcKitchenSummary()` de [kitchen-recipes.js](TobaKitchen/js/kitchen-recipes.js) (só leitura; ilegível = card sem números).
- **Backup geral do portal** (`exportAllData`/`importAllData`): formato `{ "<chave localStorage>": "<valor como STRING>" }`. Na importação, cada chave do arquivo é gravada como está (chaves ausentes no arquivo não são apagadas). A importação recusa arquivo sem nenhuma chave `TOBA_`/`toba_` ou com valor que não seja texto (backup de módulo). Não mude para guardar objetos já parseados — quebraria backups existentes.
- **Backups por módulo** (`toba_bank_backup_*.json`, `toba_health_backup_*.json`): são o objeto do banco puro. Não misturar com o formato do backup geral.

### 3.7 Outras armadilhas conhecidas

- `getFixedExpensesForMonth()` (gastos.js) **grava** `db.months[mKey].fixedExpensesSnapshot` como efeito colateral de leitura: o mês atual sempre recebe cópia de `config.fixedExpenses`; meses passados congelam a primeira cópia criada. Alterar gasto fixo hoje **não** deve mudar meses passados.
- Parcelas: valor da parcela = `totalAmount / totalInstallments`; ativas enquanto `0 <= diferençaDeMeses < totalInstallments`, contando a partir do mês de `startDate`.
- Raxador: membros são identificados **pelo nome**. `payer` e as chaves de `shares` são nomes. Editar a lista de membros (`saveSplitterMembers`) não renomeia nas despesas — renomear alguém deixa despesas órfãs. Se implementar renomear, atualize `payer` e `shares` juntos.
- Investimentos (longo prazo): toda conta passa por `getFundStats()` em `investimento.js`. Saldo atual = último `balanceLogs` **não** `isSystem` + `deposits` − `withdrawals` com data posterior a ele; sem log, é `deposits` − `withdrawals`. Investido = `deposits` − `withdrawals`. Logs `isSystem` (criação, resgates antigos, encerramento) são ignorados nos cálculos — não os apague. Retiradas não geram mais log `isSystem` (desde v1.18). Cofrinhos têm conta própria (`withdrawals` = rendimento sacado).
- `localStorage` tem limite (~5 MB por origem). Sempre envolver `setItem` em `try/catch` (padrão já usado). Não guardar imagens/base64 no banco.
- iPhone: app instalado na Tela de Início tem `localStorage` **separado** do Safari.

### 3.8 Checklist antes de entregar qualquer mudança que toque dados

- [ ] Nenhuma chave de `localStorage` renomeada/removida; nenhum campo existente renomeado.
- [ ] Campo novo tem default no objeto inicial **e** no normalizador (`loadDatabase` / `normalizeHealthDb`).
- [ ] Testado abrindo com **banco antigo** (sem o campo novo) e com **banco vazio** (aba anônima).
- [ ] Testado **exportar → apagar tudo → importar** o backup do módulo, e importar um backup **antigo**.
- [ ] Testado o backup **geral** do portal (exportar/importar).
- [ ] Se mudou algo do Gastos: o card do Toba Bank no portal continua batendo com a tela de Gastos.
- [ ] Se mudou pesagens/treinos: o card do Toba Health continua batendo com Pesagem e Treinos (`health-metrics.js`).
- [ ] Se mudou tarefas/log da rotina: o Perfil do jogador e o card do Routine no portal continuam batendo (`routine-metrics.js`, inclusive `calcRoutineSummary`).
- [ ] Se mexeu no catálogo do Kitchen: nenhum `id` de receita/ingrediente/refeição renomeado ou apagado sem querer.
- [ ] Se mudou treinos/pesagens: o Perfil do jogador (`computePlayer` em `toba-player.js`) continua lendo o formato (XP, kg levantado igual ao Hall).
- [ ] Datas gravadas em `AAAA-MM-DD` local; dinheiro como `number` em reais; IDs no tipo da coleção.
- [ ] Migração idempotente (abrir a página duas vezes dá o mesmo resultado).
- [ ] Nenhum `alert`/`confirm`/`on*=` novo e nenhum erro no console ao carregar cada página.

### 3.9 Perfil do jogador — `TOBA_PLAYER_DB` (desde v1.40)

Arquivo: [assets/toba-player.js](assets/toba-player.js). Variável global `playerDb`; estado calculado em `tobaPlayerState`.

- **O XP é calculado, nunca somado.** `computePlayer()` relê o `TOBA_HEALTH_DB` e o `TOBA_ROUTINE_DB` (direto do `localStorage`, só leitura; a rotina via `calcRoutinePlayer` de routine-metrics.js, desde v1.41) e devolve XP, nível, streak, recordes, conquistas e o extrato (`events`). Apagar um treino tira o XP dele; o histórico antigo já conta. Não crie "XP ganho" gravado: some regra nova em `computePlayer()`.
- **Regras** (todas no topo do arquivo): `PLAYER_XP` (treino: 40 + 1/min até 90 + 3/série até 60 + 1 a cada 10 reps de flexão/abdominal/agachamento até 60 + 8/km até 80; teto 300 XP de treino por dia; recorde +30, até 3 por treino), `PLAYER_TIERS` (conquista 50/150/400/1000), `PLAYER_STREAK_MILESTONES` (7/30/100/365 dias, a cada streak). Nível: `playerXpToNext(n) = 60·n + 3·n²` arredondado para dezenas.
- **Recorde pessoal** = mesma regra do `getStrengthRecords` (maior carga; empate, mais reps; 1ª vez não conta), mais maior distância e mais reps do Saitama num treino.
- **Streak "dias + meta semanal"** (`calcPlayerStreak`): conta os dias desde o 1º treino da sequência; não quebra enquanto toda semana seg–dom fechada tiver `settings.weeklyGoal` dias com treino; a semana atual só quebra quando não dá mais para bater a meta. Mudar a meta recalcula o histórico inteiro (sem comemoração).
- **Conquistas** (`PLAYER_ACHIEVEMENTS`): `id` gravado em `seen.achievements` → nunca troque. As de peso/distância usam o `id` de `WORKOUT_LIFT_EQUIVALENTS`/`WORKOUT_DISTANCE_DESTINATIONS` (health-metrics.js). Conquista nova = item novo com `metric(stats)` e `goal`. "Dia do careca"/"Careca completo" (desde v1.50) olham o **dia**: soma flexão/abdominal/agachamento de todos os treinos `saitama` da data e os km dos treinos `walking` da mesma data (km antigos gravados dentro do Saitama também contam, pra ninguém perder conquista). Opcionais (desde v1.47): `xp` (substitui o XP do nível) e `mystery` (bloqueada aparece como ???, igual às lendárias; `isPlayerAchievementHidden`).
- **Nível das conquistas de peso** é fixado por id em `PLAYER_LIFT_TIERS` (desde v1.47; antes era pela posição na lista). Marco novo na escala = item novo na ordem de `size` **e** linha nova em `PLAYER_LIFT_TIERS`; nunca mude o nível de um id antigo (muda o XP de quem já tem).
- **Manadas & multidões** (`gr-*`, desde v1.47, `buildPlayerCrowdAchievements`): coleções sobre o mesmo kg levantado, com o peso de cada item tirado da escala (boi 500 kg e torcedor 75 kg ficam ali). XP = metade do nível (`PLAYER_CROWD_XP`).
- **Recompensas** (`PLAYER_AVATARS`, `PLAYER_FRAMES`, `PLAYER_COLORS`, títulos de `PLAYER_LEVEL_TITLES` e `title` das conquistas): só visual; `equipped` guarda o `id` ("" = automático). Item bloqueado/sumido cai no automático.
- **Comemorações**: `tobaPlayerCheck({ reason, silent })` (com espera de 200 ms) compara o calculado com `seen`: +XP, medalha nova, level up, e na 1ª vez (sem `TOBA_PLAYER_DB`) a tela de boas-vindas "você já é nível X". Depois grava o novo `seen`. Se algum banco não pôde ser lido (`state.ok === false`) ou o perfil está travado, só mostra, não comemora nem grava. Chame depois de gravar algo que vale XP (Treinos já chama em `renderWorkoutScreen`, `saveWorkout`, `registerStrengthWorkout`, fim do treino ao vivo e do Saitama). A tela escuta o evento `toba:player` para redesenhar.
- **Toda página que carrega `toba-player.js` precisa carregar também `health-metrics.js`, `routine-metrics.js`, `TobaKitchen/js/kitchen-recipes.js` (desde v1.44), `TobaRacing/js/racing-metrics.js` e `TobaTurism/js/turism-metrics.js` (desde v1.56) antes.** Sem eles o XP sairia diferente entre as telas; por isso, sem algum deles, `state.ok` fica `false` (não comemora nem grava `seen`). Hoje carregam o player: portal, Toba-Perfil, Treinos, Rotina, Task, Agenda, Kitchen Receitas, Kitchen Semana, Racing Combustível e Toba Places (os dois últimos desde v1.56).
- **Pista e Rolês** (desde v1.56, categorias `pista` e `roles`): `calcRacingPlayer` (racing-metrics.js, conquistas `rc-*`) e `calcTurismPlayer` (turism-metrics.js, conquistas `tu-*`) devolvem a `timeline` de números em ordem de data, igual à cozinha. Só conquistas, sem XP por abastecimento/visita. Visita conta no `visitedAt` (lugar de lista apagada não conta); lugar com visita antes do `addedAt` "entra" no dia da visita. App novo que dê XP: regra pura num `*-metrics.js` próprio, carregado em todas essas páginas, e um bloco em `computePlayer()`.
- **Backup**: o geral do portal já leva `TOBA_PLAYER_DB`; a ⚙️ do Toba-Perfil.html tem backup só do perfil (`toba_perfil_backup_*.json`, objeto puro) e "Recomeçar perfil" (apaga só `TOBA_PLAYER_DB`; XP e conquistas voltam do cálculo).

### 3.10 Toba Routine — `TOBA_ROUTINE_DB` (desde v1.41)

Arquivo: [TobaRoutine/js/routine-core.js](TobaRoutine/js/routine-core.js). Variável global `routineDb`; trava `isRoutineDbLoaded` (ilegível = não grava).

```js
{
  version: 1,
  seeded: bool,                       // já mostrou as sugestões da 1ª abertura
  tasks: [ {
    id: "t-<ts>-<rand4>", name, emoji,
    recurrence: { type: "daily"|"weekly"|"monthly"|"situational", days?: ["MO","WE"], monthDay?: 1-31 },
    time: "HH:MM" | "",               // sem horário = sem aviso
    difficulty: "easy"|"medium"|"hard",
    nag: bool,                        // cobrar de novo +30 min e +2 h
    carryOver: bool,                  // desde v1.42: não fez no dia vira atrasada (true, padrão) ou expira à meia-noite (false)
    createdAt: "AAAA-MM-DD",
    archivedAt?: "AAAA-MM-DD"         // "apagada": não cai mais desse dia em diante; histórico e XP ficam
  } ],
  log: [ { id, taskId, date: "AAAA-MM-DD" /* dia da tarefa */, doneAt: ms, difficulty /* cópia na hora */ } ],
  // desde v1.42:
  dayPlan: {                          // ⚙️ "Meu dia fixo" (routine-plan.js)
    configured: bool,                 // false = ainda no chute padrão (routineDefaultBlocks)
    breathing: minutos,               // respiro por dia (padrão 90)
    blocks: [ { id, kind: "sleep"|"work"|"commute"|"custom", name, emoji, days: ["MO".."SU"],
                start: "HH:MM", end: "HH:MM" /* passa da meia-noite = soma 24 h */, minutes? /* só commute */ } ]
  },
  oneoffs: [ {                        // módulo Task
    id: "o-<ts>-<rand4>", name, emoji, minutes /* total */, split: bool, chunk: minutos, heavy: bool,
    when: "any"|"weekend"|"weekday" /* desde v1.45; ausente = heavy ? "weekend" : "any" (routineOneoffWhen) */,
    deadline: "AAAA-MM-DD" | "", createdAt, doneAt?: ms /* terminou */, archivedAt?: "AAAA-MM-DD",
    sessions: [ { id: "s-<ts>-<rand4>", date: "AAAA-MM-DD" /* dia marcado */, minutes, doneAt?: ms } ]
  } ]
}
// skipped (desde v1.47): [ { id: "k-<ts>-<rand4>", taskId, date: "AAAA-MM-DD", at: ms } ] = atrasadas "deixadas pra lá"
//   (deslizar o card). Uma por taskId|data; ausente = [] (normalizeRoutineDb).
// tasks[].minutes? (desde v1.42): quanto a tarefa ocupa do dia; ausente = ROUTINE_DEFAULT_MINUTES pela dificuldade;
//   0 (desde v1.45) = não ocupa tempo (ex: dormir às 23h). Não confunda 0 com ausente.
// events (desde v1.49, módulo Calendar; ausente = [] em normalizeRoutineEvents):
//   [ { id: "e-<ts>-<rand4>", name, emoji, date: "AAAA-MM-DD",
//       time: "HH:MM" | "" /* "" = dia inteiro */, end: "HH:MM" | "" /* só com time; vazio = 1 h; antes do time = passa da meia-noite */,
//       endDate: "AAAA-MM-DD" | "" /* só dia inteiro: vários dias */, busy: bool /* só dia inteiro: dia tomado */,
//       remind: bool /* padrão true */, note: texto até 300, createdAt } ]
```

- **Quando cai** (`isRoutineTaskDue`, routine-metrics.js): diária todo dia; semanal nos `days`; mensal no `monthDay` (dia 31 em mês curto = último dia); situacional nunca (aparece em "Quando acontecer", vale XP até 3× por dia). Nada antes de `createdAt` nem a partir de `archivedAt`.
- **XP** (`ROUTINE_DIFFICULTIES`: fácil 10, médio 25, difícil 60): sai do `log` com a dificuldade **copiada** na entrada; feita depois do dia (`doneAt` > `date`) vale metade; teto `ROUTINE_XP_DAY_CAP` (250) por dia. Desmarcar = apagar a entrada do log (o XP sai junto). A `key` da dificuldade é gravada: não renomeie.
- **Atrasadas**: ocorrências dos últimos 7 dias sem entrada no log, só de tarefas com `carryOver` (`routineCarriesOver`, routine-metrics.js). Com `carryOver: false` a ocorrência expira: some das atrasadas e do contador do portal, `toggleTask` não marca dia passado, `buildRoutineAlerts` não cobra depois da meia-noite e `importNativeRoutineDone` ignora "Feito" tocado depois do dia. O XP (`calcRoutinePlayer`) e o streak **não** olham `carryOver`: entrada atrasada que já existe continua valendo metade. A tela de hoje também lista as tarefas de amanhã (só leitura). **Streak por tarefa** (`calcRoutineTaskStreak`): ocorrências seguidas feitas; a de hoje aberta não quebra.
- **Deixar pra lá** (desde v1.47): deslizar uma atrasada grava em `skipped` (routine.js, `skipOverdue`). Só tira a ocorrência das atrasadas, do contador e dos avisos; não entra no `log`, não dá XP e quebra o streak igual a não fazer (o streak só olha o `log`). A situação de cada ocorrência sai de `routineOccurrenceStatus` (routine-metrics.js: done/skipped/today/overdue/expired/missed), usada na lista, no `calcRoutineToday` (portal) e no Histórico. "Desfazer" por 5 s; depois, tocar no 🗑️ do Histórico traz de volta. "✅ Feito" da notificação de uma ocorrência descartada ganha (vira log e apaga o descarte). No APK 1.3 `clearTaskNotice` tira a notificação já mostrada.
- **Avisos** (`routine-alerts.js`): `buildRoutineAlerts` monta os próximos 3 dias `[{ key: "taskId|data|nível", at, title, body, url, taskId, date }]` (nível 0 no horário, 1 = +30 min, 2 = +2 h; no máximo 300), com frases sorteadas de `ROUTINE_NAG_LINES`/`ROUTINE_TOPIC_LINES`. No APK vão por `TOBA_NATIVE.setTaskAlerts` (substitui a lista), refeito ao abrir o portal ou a rotina e a cada gravação (`onRoutineDataSaved`). No navegador `startRoutineWatcher` confere a cada 30 s só com a página aberta.
- **"✅ Feito" da notificação** (APK): o Android guarda em `task_done` e cancela as cobranças do dia; `importNativeRoutineDone()` (routine.js, no load e no `onTobaAppResume`) vira entrada do log e só chama `ackDoneTasks` depois de gravar. O `buildRoutineAlerts` já trata os pendentes da fila como feitos.
- **Task** (`oneoffs`, desde v1.42): estado sai de `routineOneoffStatus` (feito = soma das sessões com `doneAt`; agendado = sessões sem `doneAt` de hoje em diante; "furou" = sem `doneAt` antes de hoje, volta a precisar de dia). Inteira (`split: false`): marcar a sessão termina a task (`doneAt`) e apaga as sessões futuras. Em pedaços: termina quando a soma feita chega em `minutes`. Apagar: sem nada feito some de vez; com sessão feita vira `archivedAt` (o XP fica).
- **XP da Task** (`calcRoutinePlayer`, evento `kind: "oneoff"`): cada sessão feita vale `routineOneoffXp(minutes)` = 20/h, mínimo 15, teto 150, no dia do `doneAt`, **fora** do `ROUTINE_XP_DAY_CAP`. Task terminada soma `routineOneoffs` (e `routineBigOneoff` se ≥ 4 h) para as conquistas `tk-*`.
- **Dia livre e sugestão** (routine-metrics.js): `calcRoutineDayLoad(db, dia)` = 1440 − blocos do dia fixo − rotina do dia (`routineTaskMinutes`) − sessões de task do dia − respiro; hoje só conta o que falta até a hora de dormir. `suggestRoutineOneoff` olha `ROUTINE_PLAN_DAYS` (14) dias ou até o prazo: inteira = até 3 dias onde cabe (dias do `when` preferido primeiro, desde v1.45: "weekend" = fim de semana ou folga sem trabalho, "weekday" = seg–sex; depois a nota: mais livre, perde se já tem task no dia, leve preferência por mais cedo); em pedaços = uma sessão por dia (`chunk` em dia de trabalho, até 3× na folga), primeiro nos dias preferidos sem outra task. Só cálculo, nada gravado; quem grava é `task.js` ao tocar em Agendar.
- **Agenda** (desde v1.46, `TobaRoutine-Agenda.html` + `js/agenda.js`): `calcRoutineDayAgenda(db, dia)` (routine-metrics.js) diz o que cai em cada hora. Bloco do dia fixo que passa da meia-noite aparece nos dois dias; transporte (só tem minutos) vira metade antes e metade depois do trabalho, e sem trabalho no dia vai pra faixa "sem horário"; rotina com `time` entra na hora (`routineTaskMinutes`, 0 = risquinho); rotina sem `time` e sessão de task (só tem `date`) vão pra faixa "📌 Sem horário" do topo: a agenda **não inventa hora**. As brechas verdes são só o que sobra fora dos blocos e rotinas com hora; o "🆓 Livre" do dia continua sendo o `calcRoutineDayLoad` (que também tira o sem horário e o respiro). Nada gravado; configurar continua na ⚙️ → Meu dia fixo.
- **Calendar** (desde v1.49, `TobaRoutine-Calendar.html` + `js/calendar.js`; folha em `js/routine-events.js`): eventos com dia marcado (cirurgia, churrasco, viagem). Não dão XP e não repetem. Regras puras em routine-metrics.js: `routineEventsOn(db, dia)` (o que cada evento ocupa no dia; com hora que passa da meia-noite pinta o dia seguinte até o `end`), `routineUpcomingEvents`, `routineEventWhen`, `routineEventCountdown`, `routineGuessEvent` (emoji pelo nome; cirurgia/viagem/mudança já vêm como dia tomado). **Pesam no tempo livre:** `calcRoutineDayLoad` tira os minutos do evento com hora (e, hoje, só o que falta) e dia inteiro com `busy` zera o livre (`busyDay`); por isso `suggestRoutineOneoff` não põe task nesse dia (nem no "não cabe em lugar nenhum"). Na Agenda, com hora entra em `timed` (`kind: "event"`) e dia inteiro em `allDay` (faixa "📅 Eventos" no Dia, emoji no topo da Semana); dia tomado não mostra brecha. **Avisos:** `buildRoutineAlerts` junta `routineEventAlerts` (véspera 20h; no dia 1 h antes, ou 8h no dia inteiro) com `taskId` = id do evento, `key` = `id|date|0/1`; o "✅ Feito" do APK vira "ciente" (o Android cancela os avisos do evento e o `importNativeRoutineDone` só tira da fila, porque não acha tarefa). Apagar evento = some de vez (não tem XP). Calendar e Agenda carregam o routine-alerts.js e chamam `syncRoutineAlerts` a cada gravação.
- **Concluir/editar na Agenda** (desde v1.49): na visão Dia, tocar numa rotina abre `#agendaTaskSheet` (bolinha + ✏️ Editar). Marcar usa `routineToggleOccurrence` (routine-task-sheet.js), a **mesma** função do `toggleTask` da Rotina (inclui a trava do `carryOver: false` e tira o descarte do `skipped` se marcar uma deixada pra lá); dia futuro não marca. Editar abre a mesma `#taskSheet` da Rotina. O card do portal (`toggleRoutineFromCard`) ainda repete a regra do log: mudou `routineToggleOccurrence`, mude lá junto.
- Backup do app: `toba_routine_backup_*.json` (objeto puro, precisa de `tasks`). Importar passa pelo `normalizeRoutineDb()` (que também dá default ao `dayPlan`, ao `oneoffs`, ao `skipped` e ao `events`).

### 3.11 Toba Kitchen — `TOBA_KITCHEN_DB` (desde v1.43)

- Livro e escolha da Semana listam as receitas em ordem alfabética (`kitchenRecipesByName`, desde v1.51), sem mexer na ordem do `KITCHEN_RECIPES`.

Arquivos: [TobaKitchen/js/kitchen-core.js](TobaKitchen/js/kitchen-core.js) (dono do banco; variável `kitchenDb`, trava `isKitchenDbLoaded`) e [TobaKitchen/js/kitchen-recipes.js](TobaKitchen/js/kitchen-recipes.js) (catálogo + regras puras).

```js
{
  version: 1,
  cooked: [ { id: "c-<ts>-<rand4>", recipeId, date: "AAAA-MM-DD", doneAt: ms, servings, planId? } ], // contador "receitas feitas"
  pantry: [ "id de ingrediente" ],    // marcados em "O que tem aí?" (vale pra busca e pro "Já tem em casa" da lista)
  plan: [ { id: "p-<ts>-<rand4>", date: "AAAA-MM-DD", recipeId, meal: "cafe"|"almoco"|"lanche"|"janta"|"sobremesa", servings } ],
  shopping: { "<segunda AAAA-MM-DD>": { checked: [ "id de ingrediente" ] } }, // itens marcados na lista de cada semana
  extras: [ { id: "x-<ts>-<rand4>", itemId? /* v1.54: id de kitchenShopCatalog; ausente = digitado no Outros (ou avulso da v1.53) */, name, aisle /* key de KITCHEN_AISLES */, qty /* texto livre, "" = sem */, checked: bool, addedAt: ms } ], // v1.53, opcional
  extrasRecent: [ { name, aisle } ] // v1.53, opcional: digitados no Outros que saíram da lista (seguem como chip), mais novo primeiro, até 24
}
```

- **As receitas moram no código** (`KITCHEN_RECIPES`), não no banco: o banco só guarda o `id`. **Id de receita, de ingrediente (`KITCHEN_INGREDIENTS`) e a `key` das refeições (`KITCHEN_MEALS`) nunca mudam** depois de publicados (contador, programação e despensa apontam pra eles). Receita nova = item novo em `KITCHEN_RECIPES` (ingrediente novo = item novo em `KITCHEN_INGREDIENTS`). Receita apagada do catálogo some das telas, mas as entradas antigas ficam no banco.
- Receita: `{ id, name, emoji, author? /* key de KITCHEN_AUTHORS, desde v1.48; ausente = "cloba" */, meals: [keys], minutes, servings, kcal /* por porção, estimativa */, ingredients: [{ id, qty /* null = a gosto */, unit /* KITCHEN_UNITS */, note?, optional? }], steps: [{ text, timer? /* min, pode ter decimal (1.5) */ }], tip? }`. Autores: `cloba` (receitas do Cloba) e `bertoba` (as do Rafa).
- **Programação (Semana, desde v1.48):** a folha "➕ Receita" fica aberta (fecha no ✕); receita já no dia fica contornada de amarelo e tocar de novo tira a última entrada **não feita** dela. "📋 Copiar da semana anterior" cria entradas novas (id novo) no mesmo dia da semana/refeição/porções e pula o que já está igual (`data|recipeId|meal`), então tocar duas vezes não duplica.
- **Falta o quê** (`kitchenMatchRecipe`): só ingrediente não `optional` e não `staple` (sal, açúcar, óleo, azeite, temperos) conta como falta.
- **Lista de compras** (`kitchenShoppingList`): soma as receitas da semana (seg–dom, `kitchenWeekMonday`) já na quantidade de porções de cada entrada, por ingrediente (unidades diferentes ficam "2 colheres de sopa + 1 colher de chá"). Seções: comprar (por `KITCHEN_AISLES`), "🏠 Já tem em casa" (está no `pantry`) e "🧂 Básicos" (`staple`). Só cálculo; o que fica gravado são os marcados em `shopping`.
- **Lista de compras** (página `TobaKitchen-Compras.html` / `compras.js` desde v1.53; abas 🧺 Escolher e 🛒 Lista desde v1.54): o Escolher mostra `kitchenShopCatalog()` = `KITCHEN_SHOP_ITEMS` (básico do mercado, kitchen-recipes.js) + todo `KITCHEN_INGREDIENTS` (id `"i-<ingrediente>"`), sem repetir nome, em chips por seção A–Z; tocar põe/tira um item em `extras` (com `itemId`). **O `id` de item do catálogo nunca muda** (item novo = linha nova). Ingrediente que já vem das receitas da semana aparece com 🍳 e não entra de novo. "✍️ Outros" grava sem `itemId` (seção por palpite, `KITCHEN_AISLE_HINTS` em compras.js, senão `"outros"`) e, ao sair da lista, vai pra `extrasRecent` e segue como chip. Na Lista, `extras` entram no `kitchenShoppingList` (`extra: true`, `key` = id do item) misturados com os ingredientes e **em ordem alfabética dentro de cada seção**. Escolhido não é por semana: o marcado dele é o próprio `checked` (o dos ingredientes continua em `shopping[segunda]`) e fica até ✕ ou "🧹 Tirar comprados". `aisle` desconhecido aparece em "📦 Outros" sem regravar. `kitchenShoppingPending` = quantos faltam (hub e botão da Semana). Seções novas do `KITCHEN_AISLES` (padaria, bebidas, limpeza, higiene, pet, outros): `key` nunca muda, a ordem do array é só a da tela.
- **Fiz / comi**: `kitchenMarkCooked` (modo cozinha no fim, "✅ Já fiz" na receita ou "✅ Fiz / comi" na semana, este com `planId`). Desfazer = apagar a entrada. Antes de contar, `kitchenAskImprovised` pergunta "fez sem o X?" quando pelo `pantry` faltava exatamente 1 ingrediente (despensa vazia = não pergunta); sim = `cooked[].improvised: [id]` (campo opcional).
- **Conquistas no Perfil** (desde v1.44): `calcKitchenPlayer()` (kitchen-recipes.js) devolve a `timeline` de números (`kitchenCooked`, `kitchenDistinct`, `kitchenMeals`, `kitchenFullDay`, `kitchenImprovised`, `kitchenRepeat`, `kitchenLong`, `kitchenSweet`, `kitchenNight`, `kitchenWeekPlan`) e o `computePlayer()` confere as conquistas `kt-*` (categoria "🍳 Cozinha"). Receita feita **não** dá XP sozinha, só as conquistas. "Zerou o livro" usa o tamanho atual de `KITCHEN_RECIPES`: receita nova tranca de novo até ser feita. Refeição de uma vez feita = a da programação (`planId`); fora dela vale toda `meals` da receita.
- **Modo cozinha**: guarda em `toba_kitchen_live`; timer por passo é horário (`endsAt`), nunca contagem. Tela acesa igual ao treino ao vivo (Wake Lock / `TOBA_NATIVE.keepScreenOn`), obedecendo `toba_kitchen_prefs.keepAwake`.
- Backup do app: `toba_kitchen_backup_*.json` (objeto puro, precisa de `cooked` e `plan`). Importar passa pelo `normalizeKitchenDb()`.

### 3.12 Toba Racing — `TOBA_RACING_DB` (desde v1.51)

Arquivos: [TobaRacing/js/racing-core.js](TobaRacing/js/racing-core.js) (dono do banco; variável `racingDb`, trava `isRacingDbLoaded`) e [TobaRacing/js/racing-metrics.js](TobaRacing/js/racing-metrics.js) (regras puras, também no portal).

```js
{
  version: 1,
  car: { name: "", tank: number|null },   // apelido e litros do tanque (⚙️ "🚗 Meu carro"); tank dá a autonomia
  fuelings: [ {
    id: "f-<ts>-<rand4>", date: "AAAA-MM-DD", odometer: number /* km do painel */,
    liters: number, price: number|null /* R$/l, até 3 casas */, total: number|null /* R$ */,
    fuel: "gasolina"|"etanol"|"diesel" /* key de RACING_FUELS */, full: bool /* encheu o tanque */,
    missed: bool /* teve abastecimento antes deste que não foi anotado */, note: string, createdAt: ms
  } ]
}
```

- **km/l de tanque cheio a tanque cheio** (`calcRacingSegments`): abastecimentos em ordem de **odômetro**; entre dois `full`, km = diferença do odômetro e litros = soma dos litros de todos depois do primeiro cheio (parciais inclusos, o primeiro não). Um `missed` no meio (ou no cheio que fecha) invalida aquele trecho. Antes do 1º cheio nada é medido. Regra nova de consumo entra **só** em `racing-metrics.js` (tela, hub e portal leem dali).
- **Média** = soma dos km ÷ soma dos litros dos trechos (não média das médias). "Pé leve"/"Pé de chumbo" = último trecho contra a média dos anteriores, margem `RACING_TREND_MARGIN` (3%).
- **Etanol x gasolina**: rendimento do etanol ÷ gasolina medido nos trechos de um combustível só; sem os dois, 70% (`RACING_ETHANOL_DEFAULT_RATIO`).
- Salvar recusa odômetro repetido e odômetro que não bate com a data (menor que um abastecimento mais antigo ou maior que um mais novo). Litros/preço/total: preencheu 2, o terceiro é calculado.
- `fuel` é key gravada: nunca renomeie; combustível novo = item novo em `RACING_FUELS`.
- Conquistas `rc-*` no Perfil desde v1.56 (ver 3.9). Portal: linha do card (`renderRacingCard`, só leitura, ilegível = card sem números). Se for dar XP por abastecimento, siga a regra da 3.9 (`racing-metrics.js` em todas as páginas do player + bloco em `computePlayer()`).
- Backup do app: `toba_racing_backup_*.json` (objeto puro, precisa de `fuelings`). Importar passa pelo `normalizeRacingDb()`.

### 3.13 Toba Turism — `TOBA_TURISM_DB` (desde v1.55)

Arquivos: [TobaTurism/js/turism-core.js](TobaTurism/js/turism-core.js) (dono do banco; variável `turismDb`, trava `isTurismDbLoaded`) e [TobaTurism/js/turism-metrics.js](TobaTurism/js/turism-metrics.js) (regras puras, também no portal).

```js
{
  version: 1,
  lists: [ { id: "l-<ts>-<rand4>", name, emoji, city /* "" = sem cidade */, createdAt: ms } ],
  places: [ {
    id: "p-<ts>-<rand4>", listId /* id da lista, String */, name, url /* link do Maps colado, "" = sem */,
    address /* "" = sem; vem do texto do Compartilhar */, note, tags: [ "key de TURISM_TAGS" ],
    status: "want"|"been", rating: "top"|"bom"|"ok"|"nem"|null /* key de TURISM_RATINGS */,
    visitedAt: "AAAA-MM-DD"|null /* dia do ✅ Fui */, addedAt: ms,
    // v1.56 (opcionais, default no normalizeTurismDb):
    kind: "key de TURISM_KINDS"|null /* tipo: pizza, japonesa, parque... */,
    value: "vale"|"justo"|"caro"|null /* custo-benefício, TURISM_VALUES */, again: "sim"|"nao"|null /* iria de novo, TURISM_AGAIN */,
    lat: number|null, lng: number|null /* pino do 🗺️ Mapa */, geoMiss: bool /* a busca automática não achou */,
    // v1.57:
    region: "" /* bairro/região, texto livre até 40 ("Pinheiros", "Zona Sul"); "" = sem */
  } ]
}
```

- **Keys de `TURISM_KINDS` (38 tipos em 2 grupos, `TURISM_KIND_GROUPS`), `TURISM_VALUES` e `TURISM_AGAIN` também são gravadas**: mesma regra. Lista com emoji conhecido sugere o tipo do lugar novo (`TURISM_EMOJI_KIND` em places.js).
- **Pino do mapa**: link comprido do Maps já dá a coordenada (`turismCoordsFromUrl`, também aplicada em memória no `normalizeTurismDb`); senão, depois de salvar, busca no Nominatim (fila, 1,1 s entre buscas: endereço, depois nome + cidade); senão a pessoa toca no mapa. Mudou link ou endereço = pino zerado e procurado de novo. **Desde v1.58 a busca fica presa na cidade da lista**: o centro da cidade é buscado 1 vez (`featureType=city`, guardado só em memória em `placesMap.cities`) e vira uma caixa `viewbox` ±0,6° com `bounded=1`; resultado a mais de 80 km do centro é descartado. Sem cidade, o centro é a mediana dos pinos (3+). Pino a mais de 80 km aparece no mapa como "🌍 longe" e o 🔎 Achar apaga e procura de novo. Toda chamada ao Nominatim passa por `turismNominatim` (1 a cada 1,1 s). O ❔ da barra do mapa (`mapHelp`) explica isso pra pessoa: mudou a regra, muda o texto junto. Bug que isso corrigiu: "Café X, São Paulo" achava a freguesia São Paulo de Lisboa. O link curto `maps.app.goo.gl` não dá pra abrir pra ler o endereço (CORS do Google; precisaria de servidor).
- **Bairro/região** (v1.57, `region`): digitado ou tocando nos chips dos já usados (mesma cidade primeiro). Vem sozinho: do endereço do Compartilhar (`turismRegionFromAddress`, formato "Rua, nº - Bairro, Cidade - UF"), da busca do pino no Nominatim (`addressdetails`, campo `suburb`) ou da busca reversa quando a pessoa põe o pino na mão; nunca sobrescreve um bairro já preenchido. Aparece no card, no balão do mapa e no Roteiro; filtro por bairro na lista (comparação sem acento/caixa, `turismNorm`); 🎲 Sorteia respeita. Sem endereço, entra na busca do Maps e do pino (nome, bairro, cidade). 📤 Mandar leva numa linha `🏘️` (o 📥 Colar lê).
- **Roteiro** desde v1.56 usa o formato de caminho `https://www.google.com/maps/dir//A/B/C` (origem vazia = onde a pessoa está): o app do Maps no celular ignorava o `waypoints` do formato `api=1` e abria só o destino.
- **Colar do Maps**: o "Copiar link" do Maps manda só o link curto `maps.app.goo.gl`, sem nome; o site não consegue abrir esse link pra ler o nome (precisaria de servidor), então a tela leva pro campo do nome. O Compartilhar › Toba (share_target, app instalado pelo Chrome) traz nome + endereço + link.
- **Keys de `TURISM_TAGS` ("por que entrou": insta, tiktok, indicacao, passei, nota, date, tropa, barato, especial, trampo, pet, noite) e de `TURISM_RATINGS` (top, bom, ok, nem) ficam gravadas: nunca renomeie**; item novo = linha nova. Key desconhecida é ignorada na tela (sem regravar).
- Um lugar mora numa lista só (`listId`); trocar a lista na folha do lugar só muda esse campo. Apagar a lista apaga os lugares dela (com confirmação).
- **Abrir no Maps** (`turismMapsUrl`): o `url` colado; sem ele, busca `google.com/maps/search/?api=1&query=nome, endereço ou cidade`. **Roteiro** (`turismRouteUrl`): formato de caminho `maps/dir//A/B` com até 10 lugares (ver acima). Link externo abre por `turismOpenExternal` (no APK, `location.href` cai no `shouldOverrideUrlLoading` e abre o app do Maps).
- **Colar do Maps** (`turismParseShared` em places.js): do texto do Compartilhar pega 1ª linha = nome, 2ª = endereço, link do Maps (ou o 1º link); só o link comprido `/maps/place/<nome>/` também dá o nome. O link curto `maps.app.goo.gl` não é aberto (sem rede/CORS), só guardado.
- **📤 Mandar / 📥 Colar lista**: texto pra WhatsApp (`turismListText`) que o `turismParseListText` lê de volta: cabeçalho `emoji nome · cidade`, cada lugar começa com `📌`/`✅` e tem linhas `📍` endereço, `🗺️` link, `📝` anotação, `🏷️` tags pelo rótulo. Importar junta numa lista de mesmo nome+cidade (pula nome repetido) ou cria uma nova; tudo entra como `want` (o "já fui" é de quem mandou). Mudou o formato do Mandar? Mude o leitor junto, e continue lendo o antigo.
- Conquistas `tu-*` no Perfil desde v1.56 (ver 3.9); visitar não dá XP sozinho. 📤 Mandar leva o tipo na linha `🏷️` (antes das tags) e custo-benefício/"iria de novo" numa linha `💬` (o 📥 Colar ignora a `💬`).
- Backup do app: `toba_turism_backup_*.json` (objeto puro, precisa de `lists` e `places`). Importar passa pelo `normalizeTurismDb()`.

---

## 4. Service worker / PWA

- [sw.js](sw.js): páginas/JS/CSS **network-first** (timeout 4 s, cai no cache); jsdelivr **cache-first**. Sem cópia no cache, só **navegação** (`request.mode === "navigate"`) cai no `index.html`; JS/CSS faltando devolvem erro (desde v1.37 — antes o HTML ia no lugar do script e a tela quebrava offline sem aviso). O network-first usa `fetch(..., { cache: "no-cache" })` de propósito: o GitHub Pages manda `max-age=600`, e sem isso o celular misturava HTML novo com JS antigo logo depois de publicar. Não tire.
- **Arquivo novo ou renomeado?** Acrescente em `PRECACHE` **e** aumente `VERSION` (hoje `"toba-v23"` → `"toba-v24"`…). Sem isso, o app offline fica sem o arquivo.
- Atualizar a versão do Chart.js exige trocar a URL nos HTML **e** no `PRECACHE`.
- Toda página nova deve incluir `<script src="../assets/pwa-register.js"></script>` (ou `assets/...` na raiz), as metas de `color-scheme: dark` e o link do manifest, como as existentes.

### 4.1 App Android (`TobaAndroid/`)

- O APK só abre `https://moenda.github.io/TobaSolutions/` (`START_URL`/`SITE_HOST` em `app/build.gradle`). **Patch no site não precisa de APK novo.** Mudou algo em `TobaAndroid/`? Aumente `versionCode`/`versionName` e avise o usuário que precisa gerar e instalar o APK de novo.
- O armazenamento do app (WebView) é **separado** do Chrome: os dados vão por backup geral. Mudar o domínio/caminho do site também esvazia o app (mesma regra da 3.1).
- No site, a ponte é `TOBA_NATIVE` (toba-common; `null` no navegador) / `tobaIsApp()`. Todo uso tem que funcionar sem ela. Métodos (todos texto/JSON): `getPendingPurchases`, `ackPurchases`, `getPurchaseLog`, `allowApp`, `hasNotificationAccess`, `openNotificationAccess`, `openAppInfo`, `getReminder`/`setReminder`/`clearReminder`, `scheduleRest`/`cancelRest`, `showWorkout`/`hideWorkout` (notificação fixa do treino ao vivo, desde v1.39; o site checa se existe, APK antigo não tem), `keepScreenOn`, `saveFile`, `canPostNotifications`/`requestNotificationPermission`, `setTaskAlerts`/`getDoneTasks`/`ackDoneTasks` (avisos do Toba Routine, desde v1.41 / APK 1.2; o site checa se existem), `clearTaskNotice(taskId, date)` (tira da barra a notificação de uma atrasada deixada pra lá, desde v1.47 / APK 1.3; o site checa se existe). `version()` devolve 3 no APK 1.3 (2 no 1.2). Mudou um método? Mude em `TobaBridge.java` e no site juntos.
- **Compras lidas** (`PurchaseListener.java`, APK 1.3): id estável `n<hora da compra>-<hash>` (pacote + texto + `Notification.when`), lista de já vistas `purchase_seen` (300 / 60 dias) pra notificação reenviada não virar compra de novo, data = `when` (hora original) e `old: true` quando chegou mais de 6 h depois (o site mostra "⏳ notificação antiga"). Item da fila: `{ id, amount, desc, date, app, at, postedAt?, raw?, old? }` (os com `?` só no APK 1.3). Tocar na notificação "💸" abre `TobaBank-Gastos.html?pending=1` (abre a folha das pendentes).
- No app o WebView não baixa arquivo gerado pelo site: `tobaDownloadJson` usa `TOBA_NATIVE.saveFile` (Downloads/Toba). Download novo deve passar por ela.
- Texto de notificação de banco mudou? Ajuste `PurchaseParser.java` (listas de apps e palavras). Fila/log/lembretes ficam em SharedPreferences (`TobaStore.java`), nunca no `localStorage`.
- Nunca commitar a chave de assinatura (`*.jks`, já no `TobaAndroid/.gitignore`): o repositório é público.

### 4.2 ☁️ Conta e nuvem (`assets/toba-cloud.js`, desde v1.59)

- **Local primeiro:** o `localStorage` continua sendo a casa dos dados; a nuvem (Firebase, projeto `toba-solutions`, Firestore em São Paulo) guarda uma **cópia por conta**. Sem login nada muda e o Firebase nem é baixado (SDK compat 10.14.1 pelo jsdelivr, só quando o aparelho já entrou ou abriu a ☁️).
- **Toda página carrega `toba-cloud.js` logo depois do `toba-common.js`** (antes dos cores). Página nova = mesma linha. Ele embrulha `localStorage.setItem/removeItem` só para **perceber** gravações nas chaves de `TOBA_CLOUD_KEYS` (os 7 `TOBA_*_DB` + preferências de card/tela); os cores não sabem da nuvem e não precisam mudar. Banco novo de app novo = item novo em `TOBA_CLOUD_KEYS` (nunca troque uma `key`: é o id na nuvem).
- **Regra do sync** (ao abrir página logado, ao voltar pro app depois de 30 s, ao voltar a internet e 2,5 s depois de cada gravação): compara o hash de cada chave com o último sincronizado (`toba_cloud_state.keys`). Mudou só aqui = sobe; só na nuvem = desce e **a página recarrega** (os apps guardam o banco na memória; sem recarregar, a próxima gravação passaria por cima); nos dois = o mais novo ganha (`localAt` x `at` da nuvem) e o outro vira versão "conflito". 1º login de um aparelho com dados dos dois lados = folha "Com qual eu fico?" (sugere o lado maior).
- **Nada some sem cópia:** antes do 1º sync baixa um backup geral e sobe cópia "antes"; ao descer da nuvem o valor daqui vai pra `<CHAVE>_AUTO_BACKUP`; 1ª subida do dia guarda versão "dia" (7 dias); "Apagar tudo" num app sobe a deleção mas guarda versão "apagado" (nos outros aparelhos o valor local vai pro `_AUTO_BACKUP`). Chave que sumiu sem "Apagar tudo" (dados do navegador limpos) é devolvida pela nuvem.
- **Firestore:** `users/{uid}` = resumo `{ apps: { CHAVE: { hash, at, device, size, chunks, deleted } } }` (1 leitura por página); `users/{uid}/apps/{CHAVE}` = valor; texto maior que 300 mil caracteres vai em pedaços em `users/{uid}/chunks/` (doc tem limite de 1 MB; cada versão vai num envio próprio por causa do limite de 10 MB por envio); `users/{uid}/versions/{id}` = versões guardadas (o valor sempre em pedaços, a lista fica leve). Regras: só o dono lê/grava `users/{uid}/**`, o resto fechado (copiadas em `/mnt/project-files/toba-online/firestore.rules` no projeto do Claude; mudou a estrutura, mude as regras no console).
- **Login:** e-mail + senha em todo lugar; Google só no navegador (no APK o Google bloqueia login dentro de WebView, então o botão some e a conta Google cria senha em ☁️ › "Criar senha pro app"). A config do Firebase no arquivo é pública por natureza: quem protege é a regra do Firestore. **Nunca** coloque chave de serviço/admin no repo.
- **Volta de versão:** ☁️ › 🕰️ Versões guardadas baixa no formato do backup geral (`{ CHAVE: "texto" }`), que se restaura pelo portal.
- Teste sem Firebase de verdade: um mock de `window.firebase` (auth + firestore compat) injetado antes da página; o `toba-cloud.js` não baixa o SDK se `window.firebase.firestore` já existe.

## 5. Estilo de código

- JS puro, funções globais, `const`/`let`, aspas duplas, ponto e vírgula, indentação de 2 espaços.
- HTML gerado via template string; escapar texto do usuário antes de inserir no DOM com `escapeHtml()` (toba-common). Passe id/índice em `data-id`/`data-index` e busque o dado na função.
- **Nada de `onclick=`/`onchange=`/`onsubmit=`/`on*=` no HTML (nem no gerado por JS).** Use `data-click`, `data-change`, `data-input` ou `data-submit` com o nome de uma função registrada em `tobaActions({ nome(el, event) {...} })`. `data-close` fecha a folha onde está; `data-open="id"` abre uma. Ação com nome errado aparece no console. (O Treino de Força usa `data-action` com handler próprio no painel; não reaproveite esse nome.)
- **Número sem teclado:** `tobaWheelPicker(el, { min, max, step, value, majorEvery, unit, label, onChange })` (toba-common) cria a régua de arrastar. Não redesenhe a régua dentro do próprio `onChange` (o dedo perde o arraste); atualize só textos.
- **Notificações / lembretes:** não há servidor, então não existe push agendado (no app Android, `tobaOpenReminder` e o descanso usam alarmes nativos pela ponte; ver 4.1). `tobaNotify(title, body, { tag })` (toba-common) mostra notificação do sistema só com o app aberto ou recém-minimizado (pede permissão com `tobaAskNotify()`, sempre num toque); o clique é tratado no `notificationclick` do `sw.js`. Lembrete com horário vai pela agenda: `tobaOpenReminder({ id, title, message, times, days })` baixa um `.ics` com repetição (o `id` fixo faz a agenda substituir em vez de duplicar). Nada disso grava no `localStorage`.
- **Avisos e confirmações:** só `showPageMessage(msg, { title, icon, confirm, confirmLabel })` (retorna Promise). Proibido `alert`/`confirm`/`prompt`.
- **Feedback:** gravou → "Salvo ✓" (`tobaSaved()`, já chamado pelos cores). Lista vazia → `tobaEmpty(icone, titulo, dica)`.
- **Padrão de tela** (igual em todos os apps): cabeçalho `.toba-header` com `‹` à esquerda (sobe um nível: módulo → hub do app → portal), título do app + página no meio, botão "+" e ⚙️ à direita. "Subpáginas" no mesmo HTML usam `tobaSetHeader({ page, back: "acao" })`. Números em quadradinhos `.toba-stats > .toba-stat` (desde a v1.29 o quadradinho é mais escuro que a tela; dentro de `.card`/`.app-card` ele fica mais claro, para sempre destacar do fundo). Card de lista que abre detalhe: `role="button" tabindex="0" data-click=...` no card inteiro; botões dentro dele com `data-click` próprio têm prioridade.
- **Folhas (modais):** `.toba-modal > .toba-sheet` com `.toba-sheet-header` e o botão principal dentro de `.toba-sheet-footer` (preso no rodapé da caixa, o teclado não esconde). Desde a v1.24 a folha abre **no meio da tela** (não grudada no fundo); páginas com formulário precisam do `interactive-widget=resizes-content` no meta viewport para a caixa encolher junto com o teclado. Abrir/fechar com `openTobaModal(id)` / `closeTobaModal(id)`; `data-backdrop="static"` impede fechar tocando fora.
- **⚙️ Configurações** é a mesma em todo app: `tobaSetupApp({ name, exportBackup, importBackup, resetData })` no core; itens só da página ficam num `<div id="tobaSettingsExtra" hidden>`.
- Cada página sobrescreve o hook do core: `onBankDataSaved()` (Bank) / `onHealthDataReplaced()` (Health).
- **Telas de 360px (S24) a 384px (S24+):** rótulos curtos que caibam em 1 linha; teste nas duas larguras.
- **App novo:** copie `_molde-app/` e siga o `_molde-app/README.md` (página, core, PRECACHE, backup, card no portal). Card com números configuráveis entra no **Configurador de cards** do portal (`#cardsModal` no `index.html`, desde v1.37): um botão por app ali + a folha dele; nunca um item solto na ⚙️.
- Tema sempre escuro: use as variáveis de `toba-common.css` (`--bg`, `--surface`, `--border`, `--blue`, `--green`, `--red`, `--gold`...). Cada app define só `--accent` no seu CSS base.
- Interface responsiva pensada primeiro para celular (retrato).

## 6. Como rodar/testar

Não há build nem testes automatizados. Sirva a pasta com um servidor estático (o service worker não funciona em `file://`):

```bash
python -m http.server 8080
```

Abra `http://localhost:8080/`. Para testar migrações, cole um JSON antigo em `localStorage.setItem("TOBA_BANK_DB", ...)` pelo console e recarregue. Lembre: `localhost` é outra origem, não afeta os dados do site publicado.

## 7. Ao lançar versão

1. Acrescentar a entrada do patch no `PATCH-NOTES.md` (seção 0.1).
2. Se mudou lista de arquivos: `PRECACHE` + `VERSION` no `sw.js`.
3. Sugerir a mensagem de commit no padrão `vX.YY - descrição` — **quem commita e faz push é o usuário** (ver seção 0).
