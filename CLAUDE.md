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
- Dois apps dentro do portal:
  - **Toba Bank** — Gastos, Investimentos, Raxador (divisão de contas).
  - **Toba Health** — Pesagem (balança) e Treinos (inclui Treino de Força).
- Única dependência externa: Chart.js **fixado** em `chart.js@4.4.7` (jsdelivr). Nunca usar versão flutuante.
- Commits seguem o padrão `vX.YY - descrição` (ex.: `v1.16 - Novo modulo de treino de força...`).

## 2. Estrutura

```
index.html                 Portal (cards, config dos cards, backup GERAL) -> assets/portal.js + portal.css
manifest.webmanifest       PWA (atalhos: add_expense, Pesagem, Treinos)
sw.js                      Service worker (lista PRECACHE + VERSION)
assets/toba-common.js      Base de TODOS os apps: datas, dinheiro, decimais, escapeHtml, ações
                           (data-click...), folhas/modais, avisos, "Salvo ✓", estado vazio, ⚙️, backup
                           e a régua de arrastar tobaWheelPicker
assets/toba-common.css     Base visual de TODOS os apps: cores, botões, cards, quadradinhos, folhas, cabeçalho
assets/portal.js / .css    Só do portal
assets/pwa-register.js     Registra o sw.js (caminho relativo ao próprio script)
_molde-app/                Molde de app novo (copiar e preencher; ver _molde-app/README.md). Fora do PRECACHE.
icons/
TobaBank/
  TobaBank-Index.html      Hub do Bank (carrega o bank-core só para a ⚙️/backup)
  TobaBank-Gastos.html       -> js/bank-core.js + js/bank-metrics.js + js/gastos.js
  TobaBank-Investimento.html -> Chart.js + js/bank-core.js + js/investimento.js
  TobaBank-Raxador.html      -> js/bank-core.js + js/raxador.js
  css/bank-base.css + 1 css por módulo
TobaHealth/
  TobaHealth-Index.html    Hub do Health (carrega o health-core só para a ⚙️/backup)
  TobaHealth-Pesagem.html    -> js/health-core.js + js/pesagem.js
  TobaHealth-Treinos.html    -> js/health-core.js + js/hall.js + js/forca.js + js/sessao.js + js/treinos.js
  css/health-base.css + 1 css por módulo
TobaAndroid/               App Android (APK): WebView que abre o site publicado + ponte window.TobaNative
                           (gastos lidos das notificações, alarmes, salvar arquivo). Java puro, Android Studio.
                           Fora do PRECACHE. Passo a passo em TobaAndroid/README.md (ver seção 4.1)
PATCH-NOTES.md             Notas de cada patch (antigo LEIA-ME.md — ver seção 0.1)
CLAUDE.md                  Este guia
```

- Tudo é **global** (funções e variáveis no `window`). A ordem dos `<script>` importa: `../assets/toba-common.js` vem **primeiro** em toda página, depois o `*-core.js`, depois o módulo; em Treinos a ordem é `health-core.js` → `hall.js` (páginas de detalhe do Hall do Herói, view `viewDetail`; só leitura do banco) → `forca.js` → `sessao.js` (treino ao vivo, view `viewSession`) → `treinos.js`; `hall.js`, `forca.js`, `sessao.js` (e qualquer arquivo novo carregado antes de `treinos.js`) só chama funções de `treinos.js` dentro de funções (nunca na carga do arquivo). Arquivo JS novo: acrescente o `<script>` na ordem certa **e** no `PRECACHE` do `sw.js`.
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
| `TOBA_HEALTH_DB` | `health-core.js` | Banco principal do Toba Health (JSON) |
| `TOBA_HEALTH_DB_PRE_REFACTOR_BACKUP` | `health-core.js` | Cópia única, mesma regra acima |
| `TOBA_HEALTH_DB_AUTO_BACKUP` | `health-core.js` | Cópia do valor **anterior** do banco, atualizada a cada `saveHealthDb()` e no load (desde v1.21) |
| `TOBA_HEALTH_DB_CORRUPT_<timestamp>` | `health-core.js` | Texto original quando o JSON do Health não pôde ser lido (uma cópia por conteúdo) |
| `TOBA_HEALTH_ACTIVE_SESSION` | `TobaHealth/js/sessao.js` | Treino ao vivo em andamento (desde v1.27): `{ v: 1, id, startedAt (ms), date, routineId, title, current, exercises: [{ exerciseId, skipped, sets: [{ reps, kg, done }] }], rest: { duration, startedAt, endsAt, alerted }, restDefault, updatedAt }`. Temporário: apagado ao finalizar (vira um treino `strength` normal em `workouts`, só com as séries `done`) ou descartar. Ilegível = só oferece "Descartar". Não é lido por backup do módulo nem por `normalizeHealthDb` |
| `toba_modules_config` | `assets/portal.js` | `[{ id, visible }]` — ordem/visibilidade dos cards do portal |
| `toba_bank_card_config` | `assets/portal.js` | `{ type: "personalizado"\|"simples", orcamento, cofre, gastos, sobra, addGasto, privacy }` (mesclado com defaults) |

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
- **Categorias** do Bank são gravadas como o **texto do `value`** do `<option>` (ex.: `"Moradia - Aluguel/Condomínio"`). Mudar o `value` de uma opção deixa os gastos antigos órfãos. Para renomear, mantenha o `value` antigo ou migre no load.

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
  transactions: [ { id, description, amount, category, date, notifId? } ], // gasto à vista
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
- **Gastos automáticos (app Android):** `importNativePurchases()` em `gastos.js` (no load do Gastos e no `window.onTobaAppResume`) lê a fila do app (`TOBA_NATIVE.getPendingPurchases()`), lança cada compra como `transactions` normal com `notifId`, pula as que já têm esse `notifId`, e só chama `ackPurchases()` se o `saveDatabase()` devolveu `true`. Nunca tire da fila antes de gravar.
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
  metricsOrder: [ { key, label, type: "int"|"dec1"|"dec2", active, color?, placeholder, unit } ],
  weighIns: [ {
    id: number, date: "AAAA-MM-DD", weight: number,
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
  strengthRoutines: [ { id, name, exercises: [ { exerciseId, sets: [ { reps, kg } ] } ] } ]
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
- **`metricsOrder` é salvo no banco do usuário.** Adicionar uma métrica em `DEFAULT_METRICS_ORDER` **não** faz ela aparecer para quem já tem dados. Para isso, acrescente em `normalizeHealthDb()` um merge: para cada métrica padrão cuja `key` não existe em `db.metricsOrder`, dar `push` (preservando ordem/`active` do usuário). Para remover uma métrica, filtre por `key` (como já é feito com `bmi`), mas **não apague** o valor dos `weighIns` antigos.
- Ao salvar uma pesagem, métricas inativas (fora da tela) **mantêm o valor antigo** do registro — preserve esse comportamento.
- **Catálogo de força** (`STRENGTH_GROUPS` / `STRENGTH_EXERCISES` em [forca.js](TobaHealth/js/forca.js)): os `id` são referência gravada.
  - `strengthRoutines` guardam **só** `exerciseId` → nunca renomeie nem remova um `id` de exercício; para "remover", esconda da UI mas mantenha no catálogo.
  - `workouts` de força guardam um **snapshot** de `name` e `group` (histórico não muda se o catálogo mudar). O `group` alimenta o futuro mapa de calor; mantenha-o gravado.
  - Pode renomear o `name` exibido; o `id` fica.
- **Peso levantado com peso do corpo** (só cálculo, nada gravado): os campos `pushups/squats/situps` (Saitama) e os exercícios do catálogo com `bodyweight` somam `reps × peso do corpo × fração` (`BODYWEIGHT_FIELDS` em treinos.js; `bodyweight` em `STRENGTH_EXERCISES`). O peso do corpo é a pesagem mais recente até a data do treino (`getBodyWeightOn`, padrão 75 kg). `BODYWEIGHT_FIELDS` também dá o **grupo muscular** desses campos; `getWorkoutMuscleWork(workout)` devolve `[{ group, exerciseId, reps, kg }]` de qualquer treino e é a base do futuro mapa de calor. Campo novo de exercício de peso do corpo precisa entrar ali com grupo.
- Treinos `custom` antigos usam `sets/reps/weightKg` soltos; treinos `strength` usam `exercises[]` e deixam esses campos `null`. `getWorkoutLift()` trata os dois casos — qualquer métrica nova de treino precisa tratar os dois também.
- **Página de um treino** (`viewWorkout`, `openWorkoutView`/`renderWorkoutView` em treinos.js, desde v1.29): só leitura; `renderWorkoutScreen()` redesenha a página aberta depois de editar e volta para o mês se o treino foi excluído.
- **Mapa de calor** (hall.js, desde v1.30): `getMuscleHeat(workouts)` soma **repetições** (e kg) por grupo; `renderMuscleMini` (card do mês, sem toque) e `renderMuscleSection` (mês e página do treino, músculo tocável → `showMuscleHeat`). Cardio e km soltos (Saitama/personalizado) entram como reps equivalentes por km via `CARDIO_MUSCLES`/`getMuscleExtras` (desde v1.31); tipo de treino novo precisa entrar ali. O boneco é SVG à mão em `MUSCLE_SHAPES`, uma peça por id do `STRENGTH_GROUPS`; grupo novo precisa de forma ali e de frase em `MUSCLE_LAZY_LINES`.
- **Treino ao vivo** ([sessao.js](TobaHealth/js/sessao.js)): grava só na chave `TOBA_HEALTH_ACTIVE_SESSION` enquanto acontece; no fim monta o treino no **mesmo formato** do `registerStrengthWorkout` e só apaga a sessão depois de conferir que o `TOBA_HEALTH_DB` gravou. Tempos (cronômetro e descanso) são horários `Date.now()`, nunca contagem de `setInterval` (o celular congela a aba). Frases de descanso são só de tela.
- Todo treino precisa ter `type` conhecido; tipos novos precisam de ícone em `WORKOUT_TYPE_ICONS` (senão cai no 🏅) e de tratamento nos cálculos (distância, reps do Saitama etc.).

### 3.6 Leitores "fora do dono" (precisam acompanhar mudanças de formato)

- **Portal `assets/portal.js` → `obterMetricasReaisTobaBank()`** lê `TOBA_BANK_DB` direto, mas o cálculo é o **mesmo** da tela de Gastos: os dois chamam `calcBankMonthSummary()` de [TobaBank/js/bank-metrics.js](TobaBank/js/bank-metrics.js) (desde v1.21). Regra nova do painel do Gastos entra **só** em `bank-metrics.js`. Esse arquivo não pode depender de `bank-core.js` (o portal carrega ele sozinho) e só lê o banco, nunca grava.
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
- [ ] Datas gravadas em `AAAA-MM-DD` local; dinheiro como `number` em reais; IDs no tipo da coleção.
- [ ] Migração idempotente (abrir a página duas vezes dá o mesmo resultado).
- [ ] Nenhum `alert`/`confirm`/`on*=` novo e nenhum erro no console ao carregar cada página.

---

## 4. Service worker / PWA

- [sw.js](sw.js): páginas/JS/CSS **network-first** (timeout 4 s, cai no cache); jsdelivr **cache-first**. O network-first usa `fetch(..., { cache: "no-cache" })` de propósito: o GitHub Pages manda `max-age=600`, e sem isso o celular misturava HTML novo com JS antigo logo depois de publicar. Não tire.
- **Arquivo novo ou renomeado?** Acrescente em `PRECACHE` **e** aumente `VERSION` (hoje `"toba-v7"` → `"toba-v8"`…). Sem isso, o app offline fica sem o arquivo.
- Atualizar a versão do Chart.js exige trocar a URL nos HTML **e** no `PRECACHE`.
- Toda página nova deve incluir `<script src="../assets/pwa-register.js"></script>` (ou `assets/...` na raiz), as metas de `color-scheme: dark` e o link do manifest, como as existentes.

### 4.1 App Android (`TobaAndroid/`)

- O APK só abre `https://moenda.github.io/TobaSolutions/` (`START_URL`/`SITE_HOST` em `app/build.gradle`). **Patch no site não precisa de APK novo.** Mudou algo em `TobaAndroid/`? Aumente `versionCode`/`versionName` e avise o usuário que precisa gerar e instalar o APK de novo.
- O armazenamento do app (WebView) é **separado** do Chrome: os dados vão por backup geral. Mudar o domínio/caminho do site também esvazia o app (mesma regra da 3.1).
- No site, a ponte é `TOBA_NATIVE` (toba-common; `null` no navegador) / `tobaIsApp()`. Todo uso tem que funcionar sem ela. Métodos (todos texto/JSON): `getPendingPurchases`, `ackPurchases`, `getPurchaseLog`, `allowApp`, `hasNotificationAccess`, `openNotificationAccess`, `openAppInfo`, `getReminder`/`setReminder`/`clearReminder`, `scheduleRest`/`cancelRest`, `keepScreenOn`, `saveFile`, `canPostNotifications`/`requestNotificationPermission`. Mudou um método? Mude em `TobaBridge.java` e no site juntos.
- No app o WebView não baixa arquivo gerado pelo site: `tobaDownloadJson` usa `TOBA_NATIVE.saveFile` (Downloads/Toba). Download novo deve passar por ela.
- Texto de notificação de banco mudou? Ajuste `PurchaseParser.java` (listas de apps e palavras). Fila/log/lembretes ficam em SharedPreferences (`TobaStore.java`), nunca no `localStorage`.
- Nunca commitar a chave de assinatura (`*.jks`, já no `TobaAndroid/.gitignore`): o repositório é público.

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
- **App novo:** copie `_molde-app/` e siga o `_molde-app/README.md` (página, core, PRECACHE, backup, card no portal).
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
