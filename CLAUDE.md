# CLAUDE.md — Toba Solutions

Guia para qualquer IA (ou pessoa) que for mexer neste repositório. **Leia tudo antes de alterar código.**

## ⚠️ REGRA Nº 1: NÃO QUEBRE OS DADOS DOS USUÁRIOS

O Toba Solutions está **em produção há meses**, publicado no GitHub Pages, e é usado diariamente por pessoas reais
(finanças, pesagens e treinos). **Não existe servidor nem banco na nuvem**: todos os dados vivem **só no
`localStorage` do navegador de cada usuário**. Se o código mudar o formato do banco, a pessoa abre o app e
**perde meses de histórico** — e nós não temos como recuperar, porque nunca vimos esses dados.

Portanto, é **PROIBIDO**, sem pedido explícito do dono do projeto:

1. **Renomear ou trocar qualquer chave do `localStorage`** (lista completa abaixo).
2. **Renomear, remover ou mudar o tipo de qualquer campo** já gravado (ex.: `amount` virar `value`, `date`
   mudar de `"YYYY-MM-DD"` para timestamp, `id` mudar de string para número ou vice‑versa).
3. **Mudar a estrutura** (ex.: transformar array em objeto, aninhar coisas que hoje são planas, separar um banco
   em vários).
4. **Apagar dados "velhos" ou "legados"** durante a migração. Campos antigos podem ser ignorados, nunca destruídos.
5. **Mudar o formato dos arquivos de backup** (`.json` exportado) de um jeito que backups antigos deixem de
   importar. Backups de meses atrás **precisam continuar restaurando**.
6. **Mudar o endereço do site / nome do repositório / caminho das páginas.** O `localStorage` é preso à origem
   (domínio + caminho do GitHub Pages). Mudou o endereço = app abre "vazio" para todo mundo.
7. **Renomear os arquivos HTML** (`TobaBank-Gastos.html` etc.). Usuários têm favoritos, atalhos na tela inicial e o
   `manifest.webmanifest` aponta para eles.

### O que É permitido (do jeito certo)

- **Adicionar** campos novos, coleções novas ou chaves novas — sempre **opcionais**.
- Todo campo novo precisa de **valor padrão na carga** (`normalizeHealthDb` / `loadDatabase`), porque bancos antigos
  não têm o campo. Ex.: `if (!Array.isArray(db.strengthRoutines)) db.strengthRoutines = [];`
- Todo código de leitura deve tolerar o campo ausente (`x || 0`, `x ?? null`, `(arr || [])`).
- Se for indispensável transformar um dado, faça uma **migração aditiva e idempotente** na função de carga (pode
  rodar 1000 vezes sem estragar nada), mantendo o dado original legível. Veja como `bank-core.js` converte
  `config.fixedTotal` → `config.fixedExpenses` e `startDate` `DD/MM/YYYY` → `YYYY-MM-DD` sem perder informação.
- O botão de importar backup deve continuar aceitando backups antigos — a importação passa pela mesma
  normalização.

> Em caso de dúvida: **não mude o banco.** Adapte o código de tela ao formato existente, não o contrário.

---

## Visão geral

- App pessoal em **HTML + CSS + JavaScript puro** (sem framework, sem build, sem npm, sem bundler, sem testes
  automatizados). Os arquivos são servidos exatamente como estão no repositório.
- Hospedado no **GitHub Pages**. Publicar = dar push na branch publicada.
- Instalável como **PWA** (Android "Instalar app", iPhone "Adicionar à Tela de Início") e funciona **offline**.
- Idioma: **português do Brasil** em tudo (interface, comentários, mensagens de commit). O tom da interface é
  bem‑humorado/zoeiro (emojis, kaomojis, piadas) — mantenha o estilo.
- Tema **sempre escuro** (paleta estilo GitHub dark: `#0d1117`, `#161b22`, `#30363d`, verde `#3fb950`, vermelho
  `#f85149`, azul `#58a6ff`, amarelo `#d29922`). Todas as páginas declaram `color-scheme: dark` (meta + CSS) para
  o Chrome não aplicar "Auto Dark Mode". Não remova isso.
- **Mobile first**: o uso principal é no celular. Teste mentalmente em ~375px de largura.

## Estrutura

```
index.html                    Portal (hub). Cards dos módulos, card resumo do Toba Bank,
                              ⚙️ config (ordem/visibilidade dos cards) e backup GERAL de todo o localStorage.
manifest.webmanifest          PWA (nome, ícones, atalhos: Adicionar gasto, Pesagem, Treinos)
sw.js                         Service worker (cache/offline)
assets/pwa-register.js        Registra o sw.js (incluído em todas as páginas)
icons/                        Ícones do PWA
LEIA-ME.md                    Notas de versão/patches para o usuário

TobaBank/                     Finanças
  TobaBank-Index.html         Hub do banco
  TobaBank-Gastos.html        Gastos do mês, parcelados, gastos fixos, orçamento diário, previsão de sobra
  TobaBank-Investimento.html  Fundos/investimentos e cofrinhos (usa Chart.js)
  TobaBank-Raxador.html       "Raxador": divisão de contas em grupo
  css/bank-base.css           Estilo comum + 1 css por módulo
  js/bank-core.js             Banco (load/save/backup/reset), helpers de dinheiro/data, modal Dados & Backup
  js/gastos.js | investimento.js | raxador.js

TobaHealth/                   Saúde
  TobaHealth-Index.html       Hub da saúde
  TobaHealth-Pesagem.html     Pesagens da balança de bioimpedância + gráfico SVG próprio
  TobaHealth-Treinos.html     Treinos (cardio, Saitama, personalizado, treino de força), Hall dos Heróis
  css/health-base.css         Estilo comum + 1 css por módulo
  js/health-core.js           Banco (load/save/backup/reset), máscaras decimais, modais compartilhados
  js/pesagem.js | treinos.js | forca.js (catálogo de exercícios + treino de força)
```

- Scripts são `<script src>` clássicos (não módulos ES), carregados no fim do `<body>`, **nesta ordem**:
  `*-core.js` → script(s) do módulo → `../assets/pwa-register.js`. Em Treinos: `health-core.js` → `forca.js` →
  `treinos.js`. As funções são globais e os `onclick="..."` do HTML dependem delas — não renomeie funções
  globais sem procurar usos no HTML.
- Cada página "sobrescreve" um hook do core: Bank → `onBankDataSaved()`; Health → `onHealthDataReplaced()`.
- O portal (`index.html`) tem todo o JS inline e **lê o `TOBA_BANK_DB` diretamente** para montar o card resumo
  (`obterMetricasReaisTobaBank`). Mudanças no formato do banco quebram também o portal.
- Chart.js é carregado de CDN com **versão fixa** (`chart.js@4.4.7`). Não troque para "latest". Se mudar a
  versão, mude também em `sw.js`.

## Chaves do localStorage (CONGELADAS)

| Chave | Quem usa | Conteúdo |
|---|---|---|
| `TOBA_BANK_DB` | `TobaBank/js/bank-core.js`, `index.html` | Banco do Toba Bank (JSON) |
| `TOBA_BANK_DB_AUTO_BACKUP` | `bank-core.js` | Cópia do valor anterior, atualizada a cada gravação |
| `TOBA_BANK_DB_PRE_REFACTOR_BACKUP` | `bank-core.js` | Cópia única feita antes da reorganização (v1.15). Nunca sobrescrever |
| `TOBA_HEALTH_DB` | `TobaHealth/js/health-core.js` | Banco do Toba Health (JSON) |
| `TOBA_HEALTH_DB_PRE_REFACTOR_BACKUP` | `health-core.js` | Cópia única pré‑reorganização. Nunca sobrescrever |
| `TOBA_HEALTH_DB_CORRUPT_<timestamp>` | `health-core.js` | Texto original de um banco ilegível, guardado para recuperação manual |
| `toba_modules_config` | `index.html` | `[{ id, visible }]` — ordem e visibilidade dos cards do portal |
| `toba_bank_card_config` | `index.html` | `{ type: "simples"\|"personalizado", orcamento, cofre, gastos, sobra, addGasto, privacy }` |

O backup geral do portal exporta **todas** as chaves do `localStorage` como strings (`{ chave: "valor-string" }`)
e a importação faz `setItem` de cada uma. Não mude esse formato.

## Formato do banco — Toba Bank (`TOBA_BANK_DB`)

```js
{
  version: 29,                       // número; loadDatabase força 29. Não é usado para migrar.
  config: {
    startDate: "YYYY-MM-DD",         // legado aceito: "DD/MM/YYYY" (convertido na carga)
    fixedExpenses: [ { id: "string", name, amount: number, category } ],
    // legado: fixedTotal: number   (convertido para fixedExpenses na carga)
  },
  months: {
    "YYYY-MM": {
      dailyBudget: number,
      fixedExpensesSnapshot: [ ...cópia de fixedExpenses daquele mês... ]
    }
  },
  transactions: [ { id: "string", description, amount: number, category, date: "YYYY-MM-DD" } ],
  installments: [ { id: "string", description, totalAmount: number, totalInstallments: number,
                    startDate: "YYYY-MM-DD", category } ],
  investmentFunds: [ {
    id, name, isCofrinho: bool, isFinished: bool, irAmount: number,
    deposits:    [ { id: "string", date: "YYYY-MM-DD", amount: number } ],
    withdrawals: [ { id: "string", date, amount } ],
    balanceLogs: [ { id: "string", date, amount, isSystem?: true } ],
    ...
  } ],
  splitterGroups: [ {
    id: "string", name, category, date, members: ["nome", ...], isFinished: bool,
    expenses: [ { id: "string", desc, amount, payer, date, shares: { [membro]: valor } } ]
  } ]
}
```

- Valores em **reais como número** (`12.5`), nunca centavos inteiros, nunca string formatada.
- IDs no Bank são **strings** (`Date.now().toString()`). Comparações usam `String(a) === String(b)` — mantenha.
- Datas são strings `YYYY-MM-DD` em horário **local** (`getTodayIsoDateStr`). Não use `toISOString()` para "hoje"
  no Bank (dá o dia errado à noite no fuso do Brasil).
- Proteções que **devem ser mantidas** em `bank-core.js`:
  - `isDbLoaded`: se o JSON falhar no parse, **nenhuma gravação acontece** (o banco não é sobrescrito com vazio).
  - Auto‑backup em `TOBA_BANK_DB_AUTO_BACKUP` antes de cada gravação.
  - Valores padrão para cada coleção/campo ausente em `loadDatabase()`.

## Formato do banco — Toba Health (`TOBA_HEALTH_DB`)

```js
{
  age: number|null, height: number|null /* cm */, gender: "Masculino"|"Feminino"|null,
  metricsOrder: [ { key, label, type: "int"|"dec1"|"dec2", active: bool, color?, placeholder, unit } ],
  weighIns: [ {
    id: number /* Date.now(), NÚMERO */, date: "YYYY-MM-DD", weight: number,
    score, fat, muscle, water, bmr, visceral, protein, bone, bodyAge   // number|null, uma por key de metricsOrder
  } ],
  workouts: [ {
    id: "string", type: "saitama"|"walking"|"bike"|"elliptical"|"custom"|"strength",
    title, date: "YYYY-MM-DD",
    durationMinutes, calories, distanceKm, pushups, situps, squats, sets, reps, weightKg,  // number|null
    notes: "string",
    // só type "strength":
    routineId: "string",
    exercises: [ { exerciseId, name, group, sets: [ { reps: number, kg: number } ] } ]
  } ],
  strengthRoutines: [ { id: "r-...", name, exercises: [ { exerciseId, sets: [ { reps, kg } ] } ] } ]
}
```

- Atenção: `weighIns[].id` é **número**; `workouts[].id` é **string**. Não "padronize" — quebraria edição/exclusão
  de registros antigos.
- `metricsOrder` é configurável pelo usuário (ordem e ativo/inativo). Ao editar uma pesagem, métricas ocultas
  **mantêm o valor que já existia** — não zere.
- A métrica `bmi` (IMC) foi removida de `metricsOrder` na normalização; o IMC é calculado a partir de `height`.
- `exerciseId` referencia o catálogo `STRENGTH_EXERCISES` em `forca.js`. **Nunca renomeie/remova um `id` de
  exercício ou de grupo (`STRENGTH_GROUPS`)** — treinos antigos apontam para eles. Pode adicionar novos.
- `normalizeHealthDb()` é o único lugar para defaults de campos novos. Ela roda na carga **e** na importação de
  backup.
- Se o JSON estiver ilegível, o texto original é guardado em `TOBA_HEALTH_DB_CORRUPT_<ts>` antes de seguir — mantenha.

## Service worker / PWA

- `sw.js`: páginas/CSS/JS do próprio site = **network‑first** (timeout 4s, cai no cache); Chart.js (jsdelivr) =
  **cache‑first**. O SW nunca toca no `localStorage`.
- **Adicionou, removeu ou renomeou um arquivo?** Atualize a lista `PRECACHE` em `sw.js` **e aumente `VERSION`**
  (`"toba-v1"` → `"toba-v2"`...). Sem isso, usuários offline ficam com versão velha/quebrada.
- No iPhone, o app instalado tem armazenamento **separado** do Safari (o usuário precisa importar backup lá dentro).
- Atalhos do manifest usam `TobaBank/TobaBank-Gastos.html?action=add_expense` (tratado em `gastos.js`) —
  não quebre esse parâmetro.

## Convenções de código

- JS puro, sem dependências novas. Não introduza npm, build, TypeScript, frameworks ou módulos ES.
- Comentários e textos em português. Mantenha o nível de comentário existente (explica o **porquê**).
- Dinheiro: inputs com classe `smart-money` (máscara por centavos em `bank-core.js`); ler com `getMoney(id)`;
  exibir com `formatCurrency()` (pt‑BR, BRL). Decimais do Health: classes `toba-mask-dec1/dec2`,
  `parseTobaDecimal()`, `formatDec1/2()`.
- Health usa `showPageMessage()` (modal próprio, retorna Promise) em vez de `alert/confirm`. O Bank ainda usa
  `alert/confirm` nativos.
- "Apagar tudo" de um módulo remove **apenas a chave daquele módulo**, nunca `localStorage.clear()`.
- CSS: comum vai em `*-base.css`; específico do módulo no css do módulo.

## Como testar (não há testes automatizados)

1. Servir a pasta com um servidor estático, ex.: `python3 -m http.server 8000`, e abrir `http://localhost:8000/`.
2. **Sempre testar com dados antigos**: antes de mudar algo no banco, importe um backup real/antigo (ou monte um
   JSON no formato antigo, sem os campos novos) e confirme que:
   - todas as telas abrem sem erro no console;
   - os números batem com antes da mudança;
   - exportar → importar devolve o mesmo dado;
   - o card resumo do portal (`index.html`) continua correto.
3. Testar também com `localStorage` vazio (usuário novo).
4. Testar em largura de celular e no modo offline (DevTools → Network → Offline) depois do primeiro carregamento.

## Versionamento e publicação

- Commits no formato da história do repo: `vX.YY - Descrição curta com emoji` (ex.: `v1.16 - Novo modulo de treino
  de força ...`). Próxima versão = incrementa o último número.
- Mudanças relevantes para o usuário vão para o `LEIA-ME.md` (seção "Patch N").
- Publicar = push na branch do GitHub Pages. O nome do repositório e o endereço **não podem mudar** (ver Regra nº 1).

## Checklist antes de entregar qualquer mudança

- [ ] Nenhuma chave de `localStorage` foi renomeada/removida.
- [ ] Nenhum campo existente mudou de nome, tipo ou formato; campos novos são opcionais e têm default na carga.
- [ ] Backups antigos (`.json`) ainda importam; backup geral do portal ainda funciona.
- [ ] Nenhum id de exercício/grupo do catálogo de força foi alterado.
- [ ] `sw.js`: `PRECACHE` atualizado e `VERSION` incrementada se arquivos mudaram.
- [ ] Nenhum HTML renomeado; caminhos e atalhos do manifest continuam válidos.
- [ ] Testado com dados antigos e com banco vazio, no tamanho de celular.
