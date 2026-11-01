# Toba — Patch Notes

> Cada patch novo entra no final deste arquivo.

# Toba — versão reorganizada

## Antes de publicar (2 minutos, não pule)
1. No app **atual**, abra o portal → ⚙️ → exporte o backup geral (guarde o `.json`).
2. Publique esta pasta **no mesmo repositório do GitHub**, sem mudar o nome do repositório nem o endereço.
   Os dados ficam no navegador e estão presos ao endereço do site: se o endereço mudar, o app abre "vazio".
3. Os nomes dos arquivos HTML continuam iguais, então links e favoritos antigos funcionam.

## O que mudou
```
index.html                      portal
manifest.webmanifest, sw.js     instalar como app + abrir offline
assets/  icons/
TobaBank/    TobaBank-Index / -Gastos / -Investimento / -Raxador .html
             css/ (bank-base + 1 por módulo)   js/ (bank-core + 1 por módulo)
TobaHealth/  TobaHealth-Index / -Pesagem / -Treinos .html
             css/ (health-base + 1 por módulo) js/ (health-core + 1 por módulo)
```
- Cada módulo agora tem só o próprio código. O que é comum fica em `*-core.js` e `*-base.css`.
- As chaves do `localStorage` e o formato dos dados **não mudaram**.
- Na primeira abertura é criada uma cópia dos dados antigos em `TOBA_HEALTH_DB_PRE_REFACTOR_BACKUP` e `TOBA_BANK_DB_PRE_REFACTOR_BACKUP` (uma vez só).

## Bugs corrigidos
- Toba Health: "Apagar Tudo" não dava para confirmar (o aviso ficava escondido atrás do pop-up).
- Toba Health: a Pesagem e o Treinos tinham versões diferentes do código (o IMC antigo só era limpo pela Pesagem).
- Portal: "Adicionar Gasto Rápido" apontava para `TobaBank.html`, que não existe mais.
- Bank: Chart.js agora usa versão fixa (antes pegava sempre a "mais nova").

## Pequenas mudanças de uso
- Pesagem: ⚙️ abre um menu (Perfil, Balança, **Dados & Backup**). Backup/apagar saiu de dentro do Perfil.
- Treinos: ⚙️ abre direto Dados & Backup.
- Bank: Investimentos e Raxador também têm ⚙️ → Dados & Backup. Em Gastos, o backup ficou em "Configurações → Backup e Zona de Perigo".

## Instalar como app
- **Android (Chrome):** menu ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- Atenção no iPhone: o app instalado tem armazenamento **separado** do Safari. Se instalar, importe seu backup dentro do app instalado.
- Depois de publicar uma atualização, feche e abra o app uma vez para ela aparecer.

---

## Patch 2 (Treinos + modo escuro)
**Arquivos que mudaram** (se você só quiser atualizar esses): `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `TobaHealth/css/health-base.css`, `TobaBank/css/bank-base.css` e o `<head>` de todas as páginas `.html` (index.html, hubs, módulos).

1. **Modo escuro forçado:** todas as páginas agora declaram `color-scheme: dark` (meta + CSS). Isso avisa o Chrome que o app já é escuro, para ele não aplicar o "Auto Dark Mode". Não consegui reproduzir o problema do seu amigo aqui; se continuar, peça para ele desligar em `chrome://flags` → *Auto Dark Mode for Web Contents*, ou me diga o navegador.
2. **Histórico mensal:** começa fechado. Cada mês é um card com o resumo; tocando nele abre o **Hall do Herói do mês** (mesmos cards do Hall geral) e a lista de treinos daquele mês.
3. **Registros de treino:** novo card com ícone do tipo de treino, informações em "etiquetas" e botões de editar/excluir em traço fino, sem fundo branco.
4. **Treinos do mês:** o bloco grande do Saitama virou um card pequeno ("570 reps" com a divisão embaixo).
5. **Peso levantado:** carga × séries × repetições dos treinos com carga (hoje, o treino personalizado). Aparece no mês, no Hall de cada mês e no Hall geral, onde abre a escala de comparações (gatos, Fuscas, elefantes, Boeings 747, Titanics...). Também tem o gráfico da semana.

---

## Patch 3 (Hall dos Heróis, barras e Treino de Força)
**Arquivos novos/alterados:** `TobaHealth/js/forca.js` (NOVO), `TobaHealth/js/treinos.js`, `TobaHealth/js/health-core.js`, `TobaHealth/css/treinos.css`, `TobaHealth/TobaHealth-Treinos.html`, `sw.js`.

1. **Hall dos Heróis:** os cards ficam dentro de um painel mais escuro e as caixinhas ficam mais claras (também no Hall de cada mês).
2. **Barras:** a distância (cidades) e o peso levantado mostram todas as barras. Ao passar de 100%, o valor vira "12×" e aparece a frase ("Você já foi de São Paulo ao Rio de Janeiro 11 vezes", "Você já levantou 600 gatos").
3. **Treino de força** (Registrar treino → 💪 Treino de força):
   - Escolha o **grupo muscular** (Peito, Costas, Ombros, Bíceps, Tríceps, Quadríceps, Posterior de coxa, Glúteos, Panturrilha, Abdômen) e depois o **exercício** (59 no catálogo).
   - Cada exercício tem séries com repetições e carga. Ele já vem com os valores da última vez.
   - **Salvar treino** guarda o modelo (Treino A, B, C...). Ao abrir de novo, é só tocar nele; o app mostra "feito N×" e a data da última vez.
   - O treino registrado entra no histórico com os exercícios, entra no "Peso levantado" e guarda o grupo muscular de cada exercício (base do futuro mapa de calor).
   - Os dados novos ficam no mesmo banco (`strengthRoutines`), então entram no backup. Bancos antigos continuam funcionando.

---

## v1.18 — Hall do Herói em páginas

**Arquivos novos/alterados:** `TobaHealth/js/hall.js` (NOVO), `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `TobaHealth/TobaHealth-Treinos.html`, `sw.js`, `PATCH-NOTES.md` (era o `LEIA-ME.md`), `CLAUDE.md`.

1. **Sem pop-up:** Energia, Distância, Peso levantado e Saitama agora abrem como página inteira, com botão **‹ Voltar** (volta ao Hall geral ou ao resumo do mês, de onde você veio).
2. **Menos poluição:** cada tela tem um resumo com número grande e uma frase do Toba, depois **🏅 Conquistado** (cards compactos com a frase e uma piada) e **🎯 Próximos desafios** (só 3 barras; o resto fica em "Ver os outros N desafios").
3. **Energia:** 12 comidas (brigadeiro, pão de queijo, cerveja, temaki, coxinha, pizza, pastel, açaí, Big Mac, feijoada, X-tudo e rodízio de japonês).
4. **Distância:** ganhou Buenos Aires e Lisboa. **Saitama:** layout compacto.
5. **Histórico mensal** agora abre já aberto: cada mês é um clique para o resumo do mês.
6. **Notas de versão:** o `LEIA-ME.md` virou este `PATCH-NOTES.md`; cada patch novo entra aqui no final.

**Dados:** nenhuma mudança no banco. As telas novas só leem os treinos que já existem.

**Como testar:** Treinos → Hall do Herói → tocar em Energia, Distância, Peso levantado e Saitama: cada um abre como página, e o **‹ Voltar** retorna para onde você estava. Repetir pelo resumo de um mês no Histórico mensal. Depois de publicar, feche e abra o app uma vez (o `sw.js` mudou para `toba-v2`).

**Commit sugerido:** `v1.18 - Hall do Heroi em paginas (sem pop-up) e patch notes`

---

## v1.19 — Rendimento dos investimentos com retiradas

**Arquivos novos/alterados:** `TobaBank/js/investimento.js`, `TobaBank/TobaBank-Investimento.html`, `PATCH-NOTES.md`, `CLAUDE.md`

1. **Retiradas agora contam no rendimento:** antes o app comparava o saldo só com o total de aportes, ignorando o que foi retirado. Ex.: Caixinha com R$ 52.000 aportados, R$ 8.650 retirados e saldo de R$ 52.028 aparecia com +0,05%; agora mostra **Investido R$ 43.350** e **Rendimento +R$ 8.678 (+20,02%)**.
2. **Card do investimento:** "Aportado" virou **"Investido"** (aportes − retiradas) e o Rendimento mostra o valor em R$ e o %, embaixo.
3. **Projeção 12 meses:** passa a ser o **ganho estimado nos próximos 12 meses** sobre o saldo atual. A taxa considera quando cada aporte e retirada aconteceu (dinheiro que entrou ontem não "puxa" a média pra baixo).
4. **Saldo atual:** último saldo que você informou + aportes − retiradas lançados depois dele. Antes, um aporte feito depois da última atualização de saldo não aparecia no saldo.
5. **Resumo do topo, gráficos e histórico mensal** usam a mesma conta. "Total Aportado (Ativos)" virou "Total Investido (Ativos)".

**Dados:** Nenhuma mudança no banco. Retiradas novas não criam mais um registro de saldo automático (eles eram calculados errado quando havia aportes depois); os registros automáticos antigos continuam guardados, só não entram mais na conta.

**Como testar:** abrir Investimentos → card da Caixinha: Investido = aportes − retiradas e Rendimento = Saldo − Investido. Fazer uma retirada: Saldo e Investido caem o mesmo valor e o Rendimento em R$ não muda. Conferir os gráficos (Patrimônio e Projeção) e o Histórico mensal.

**Commit sugerido:** `v1.19 - Rendimento dos investimentos considera retiradas`

---

## v1.20 — Correção: encerrar/resgatar investimento

**Arquivos novos/alterados:** `TobaBank/js/investimento.js`, `PATCH-NOTES.md`.

1. **Confirmar Retirada volta a funcionar:** na janela **Resgatar / Finalizar** dos Investimentos, o botão **Confirmar Retirada** não salvava: a página recarregava e o investimento continuava como "rendimento ativo". Agora o **Resgate Total** encerra o investimento (ele vai para os encerrados com valor bruto, IR e data) e o **Resgate Parcial** registra a retirada.
2. **Valor Líquido no Bolso atualiza na hora:** o texto verde agora recalcula enquanto você digita o valor bruto ou o imposto (antes ficava parado no valor sugerido).

**Dados:** nenhuma mudança no banco. Os campos gravados (`isFinished`, `closeAmount`, `closeDate`, `irAmount`, `withdrawals`, `balanceLogs`) são os mesmos de antes.

**Como testar:** Toba Bank → Investimentos → num rendimento ativo, abrir **Resgatar / Finalizar** → **Resgate Total** → mudar o valor bruto e o IR e ver o texto verde mudar junto → **Confirmar Retirada**: o investimento sai dos ativos e aparece nos encerrados. Repetir com **Resgate Parcial** num outro investimento e conferir que a retirada aparece e a página não recarregou.

**Commit sugerido:** `v1.20 - Corrige Confirmar Retirada e valor liquido ao encerrar investimento`

---

## v1.21 — Proteção dos dados e correções de bugs

**Arquivos novos/alterados:** `TobaBank/js/bank-metrics.js` (NOVO), `TobaBank/js/bank-core.js`, `TobaBank/js/gastos.js`, `TobaBank/js/investimento.js`, `TobaBank/js/raxador.js`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/TobaBank-Investimento.html`, `TobaHealth/js/health-core.js`, `TobaHealth/js/pesagem.js`, `index.html`, `sw.js`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Formulários conferidos:** todos os formulários e botões do app estão ligados (conferido tela por tela). O botão de retirada da janela do investimento volta a mostrar o nome certo ("Efetuar Saque" no cofrinho).
2. **Texto digitado não quebra mais a tela no Bank:** um gasto chamado `Pizza <b>` aparece exatamente assim, sem deixar o resto em negrito. Vale para gastos, parcelas, gastos fixos, investimentos e Raxador (nome do rolê, participantes, descrições).
3. **Health protegido como o Bank:** se os dados salvos vierem estragados, o app avisa ("Dados protegidos") e não grava nada por cima do original. Para sair disso: importar um backup ou Apagar Tudo. O Health também ganhou um auto-backup: a versão anterior dos dados fica guardada a cada gravação.
4. **IDs antigos não somem mais:** no Bank, editar ou apagar um item com ID numérico (bancos antigos) falhava em silêncio. Agora funciona em todos os 33 lugares. Na Pesagem, editar um registro com ID em texto não faz mais a pesagem sumir.
5. **Card do Toba Bank no portal = tela de Gastos:** os dois usam a mesma conta (arquivo novo `bank-metrics.js`). A "Sobra Prevista" do card podia ser diferente da tela de Gastos no mês em que o controle começou; agora bate.
6. **Outros bugs encontrados na varredura:**
   - Cofrinho: apagar um **saque** pelo histórico não apagava nada. Corrigido.
   - Investimentos: tocar em "Atualizar saldo" com o campo vazio zerava o saldo do investimento. Agora pede o valor.
   - Investimentos: aporte/retirada com a data apagada agora usam a data de hoje (antes gravavam sem data).
   - Raxador: participante com apóstrofo no nome (ex.: D'Ávila) travava a divisão por porcentagem. Nomes repetidos ("Ana, Ana") viram um só. Tirar da lista alguém que já tem gastos agora pede confirmação. Editar um gasto pago por alguém que saiu da lista não troca mais o pagador sozinho.
   - Bank: se a memória do navegador encher, o app avisa que não salvou (antes parecia salvo e sumia ao recarregar).
   - Restaurar backup do Bank não trava mais antes de recarregar, e o backup automático não é trocado por um banco estragado.
   - Health: importar por engano o backup do Bank ou o backup geral apagava todas as pesagens e treinos. Agora o arquivo é recusado.
   - Portal: importar por engano o backup de um módulo no backup geral agora é recusado (antes gravava lixo no navegador).
   - Gasto antigo sem categoria não quebra mais a lista (aparece como "Outros").

**Dados:** campo nenhum mudou. Chave nova `TOBA_HEALTH_DB_AUTO_BACKUP` (cópia automática do Health, como a do Bank); bancos e backups antigos continuam funcionando e entram no backup geral normalmente.

**Como testar:**
- Gastos: lançar um gasto `Pizza <b>` e ver o texto aparecer igual na lista. Conferir que Orçamento/Dia, Cofre, Gastos Mês e Sobra Prevista do card no portal batem com a tela de Gastos.
- Investimentos: abrir um investimento → Atualizar saldo com o campo vazio (deve pedir o valor). Num cofrinho, apagar um saque pelo histórico.
- Raxador: criar um rolê com `Ana, D'Ávila`, lançar um gasto e desmarcar/mudar a % de cada um.
- Health (no console do navegador, em `localhost`): `localStorage.setItem("TOBA_HEALTH_DB", "{quebrado")` e recarregar a Pesagem: aparece "Dados protegidos" e o valor continua `{quebrado` depois de tentar salvar. Depois, importar um backup volta ao normal.
- Exportar → importar o backup do Bank, do Health e o geral.
- Depois de publicar, feche e abra o app uma vez (o `sw.js` mudou para `toba-v3`).

**Commit sugerido:** `v1.21 - Protecao dos dados do Health, escape de texto no Bank, IDs e card do portal`

---

## v1.22 — Cara nova padronizada e base comum para os próximos apps

**Arquivos novos/alterados:** `assets/toba-common.js` (NOVO), `assets/toba-common.css` (NOVO), `assets/portal.js` (NOVO), `assets/portal.css` (NOVO), `_molde-app/` (NOVO: `README.md`, `TobaMolde-Index.html`, `TobaMolde-Modulo.html`, `js/molde-core.js`, `js/modulo.js`, `css/molde-base.css`), `index.html`, `sw.js`, `TobaBank/TobaBank-Index.html`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/TobaBank-Investimento.html`, `TobaBank/TobaBank-Raxador.html`, `TobaBank/css/bank-base.css`, `TobaBank/css/gastos.css`, `TobaBank/css/investimento.css`, `TobaBank/css/raxador.css`, `TobaBank/js/bank-core.js`, `TobaBank/js/gastos.js`, `TobaBank/js/investimento.js`, `TobaBank/js/raxador.js`, `TobaHealth/TobaHealth-Index.html`, `TobaHealth/TobaHealth-Pesagem.html`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/css/health-base.css`, `TobaHealth/css/pesagem.css`, `TobaHealth/css/treinos.css`, `TobaHealth/js/health-core.js`, `TobaHealth/js/pesagem.js`, `TobaHealth/js/treinos.js`, `TobaHealth/js/forca.js`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Tudo com a mesma cara:** portal, Bank e Health agora têm o mesmo cabeçalho. O `‹` à esquerda sempre sobe um nível (tela → hub do app → Toba Solutions), o nome do app e da tela ficam no meio, e o "+" e a ⚙️ ficam sempre à direita. Botões, cards, quadradinhos de números e espaçamentos vêm de um estilo só.
2. **⚙️ igual em todo lugar:** a engrenagem abre "Configurações" com os ajustes da tela (orçamento no Gastos, perfil e balança na Pesagem, card do Bank e ordem dos apps no portal) e, no fim, o item de menu **💾 Dados & Backup**. Ele abre uma folha própria com Baixar backup, Restaurar backup e a Zona de perigo (Apagar tudo), todos no mesmo estilo de menu.
3. **Um jeito só de avisar:** acabaram os `alert`/`confirm`/`prompt` do navegador (eram 22 no Bank e 10 no portal). Todo aviso e confirmação usa a janelinha do Toba. Editar gasto fixo agora abre uma folha de edição de verdade (antes eram 3 `prompt` seguidos).
4. **Botão principal acima do teclado:** em todas as folhas de cadastro (gasto, parcela, retirada, pesagem, treino, rolê...), o botão de salvar fica preso no rodapé. O "Confirmar Retirada" não some mais atrás do teclado.
5. **"Salvo ✓" e telas vazias:** depois de gravar aparece um aviso rápido "Salvo ✓". Listas vazias mostram o que fazer ("Nenhum gasto ainda, toque em + Gasto").
6. **Do S24 ao S24+:** textos, abas e quadradinhos revisados em 360px e 384px para não quebrar em 2 linhas (ex.: "Livre hoje", "Parcelas/dia", abas "Mês · Parcelas · Fixos · Meses", métricas da balança com nome curto, resumo do mês nos Treinos).
7. **Telas repaginadas:**
   - Gastos: "Sobra prevista" em destaque com 4 quadradinhos; histórico de meses virou aba.
   - Investimentos: resumo da carteira em quadradinhos e cards mais limpos.
   - Pesagem: peso atual com a variação contra a pesagem anterior; o comparativo de cada métrica abre como tela com o `‹` no cabeçalho.
   - Treinos: o resumo do mês em quadradinhos; "+ Treino" no cabeçalho; os tipos de treino viraram uma lista mais enxuta.
   - Portal: logo em uma linha só, card do Bank com os mesmos nomes do Gastos ("Livre hoje", "Cofre", "Sobra").
8. **Base para Kitchen, Routine e Tasks:** o código repetido entre Bank e Health (datas, dinheiro, avisos, janelas, backup) virou um arquivo só (`assets/toba-common.js`). Nenhum `onclick=` no HTML: os botões chamam funções registradas, e um nome errado aparece no console em vez de quebrar em silêncio (o que derrubou o Confirmar Retirada). A pasta `_molde-app/` é um app de exemplo pronto: copiar, trocar o nome e seguir o passo a passo do `README.md` dela.

**Dados:** "Nenhuma mudança no banco." Nenhuma chave nem campo mudou; os backups do Bank, do Health e o geral continuam no mesmo formato (os antigos importam normalmente). O app de exemplo do molde usa a chave `TOBA_MOLDE_DB` só se você abrir as páginas dele.

**Como testar:**
- Abrir cada tela no celular (ou no DevTools em 360px e 384px) e conferir que nada quebra em 2 linhas.
- Investimentos: abrir um investimento → Retirada, digitar o valor com o teclado aberto e tocar em "Confirmar Retirada".
- Gastos: lançar um gasto (aparece "Salvo ✓"), editar um gasto fixo tocando nele, apagar algo (confirmação do Toba, não do navegador).
- Pesagem: ⚙️ → Sua balança → desmarcar uma métrica; editar uma pesagem antiga e salvar: o valor escondido continua lá quando você remarcar.
- Treinos: registrar uma caminhada e um treino de força; abrir Hall do Herói → um detalhe → voltar duas vezes pelo `‹`.
- ⚙️ de cada app → Dados & Backup: baixar backup → Apagar tudo → Restaurar. No portal: backup geral baixar/restaurar.
- Abrir `_molde-app/TobaMolde-Modulo.html` para ver o molde funcionando.
- Depois de publicar, feche e abra o app uma vez (o `sw.js` mudou para `toba-v4`).

**Commit sugerido:** `v1.22 - Base comum (toba-common), visual padronizado, avisos do Toba e molde de app novo`

---

## v1.23 — Flexão conta no peso levantado

**Arquivos alterados:** `TobaHealth/js/treinos.js`, `TobaHealth/js/forca.js`, `TobaHealth/js/hall.js`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Peso levantado sem academia:** flexão, agachamento e abdominal agora contam no "Peso levantado" (Treinos e Hall do Herói). Cada repetição soma uma parte do seu peso: flexão ~64%, agachamento ~70%, abdominal ~30%. O peso usado é o da pesagem mais recente até o dia do treino (sem pesagem: 75 kg). Vale também para os treinos antigos, porque é só conta: nada é gravado. No Treino de força, Flexão, Barra fixa (~95%), Mergulho (~90%), Abdominais (~30%) e o novo "Agachamento (peso do corpo)" (~70%) também somam o peso do corpo à carga. Cada um desses exercícios tem grupo muscular (flexão → peito, agachamento → quadríceps, abdominal → abdômen), pronto para o futuro mapa de calor.

**Dados:** "Nenhuma mudança no banco." É só cálculo na hora de mostrar; o exercício novo "Agachamento (peso do corpo)" entra no catálogo com id novo, sem mexer nos existentes.

**Como testar:**
- Treinos: o "Levantado" do mês agora soma as flexões, agachamentos e abdominais do Saitama, inclusive nos treinos antigos.
- Hall do Herói → Peso levantado: o rodapé explica a conta (64/70/30%).
- Treino de força: registrar Flexão 2×10 com 0 kg e conferir que o levantado não fica zerado.

**Commit sugerido:** `v1.23 - Flexao, agachamento e abdominal contam no peso levantado (com grupo muscular)`

---

## v1.24 — Janelas no meio da tela

**Arquivos alterados:** `assets/toba-common.css`, `_molde-app/README.md`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Janelas no meio da tela:** todas as janelas (Configurações, cadastro de gasto, pesagem, treino, gráficos, backup...) abrem centralizadas, como uma caixa, em vez de grudadas no fundo da tela do celular. O botão de salvar continua preso no rodapé da caixa, então o teclado não esconde ele.
2. **Respiro no ⚙️:** o título "💾 Dados" das Configurações ganhou o mesmo espaço que os outros títulos (não fica mais colado nos cards de cima).

**Dados:** "Nenhuma mudança no banco."

**Como testar:**
- Abrir a ⚙️ na Pesagem: a janela aparece no meio e o "DADOS" tem espaço igual ao "PESAGEM".
- Treinos → + Treino → Caminhada: tocar num campo, o teclado sobe e o "Salvar treino" continua visível.
- Gastos → + Gasto e Investimentos → Retirada: mesmo teste do teclado.

**Commit sugerido:** `v1.24 - Janelas centralizadas e espaco no titulo Dados das configuracoes`

---

## v1.25 — Resumo do treino de força, antebraço e remada baixa

**Arquivos novos/alterados:** `TobaHealth/js/forca.js`, `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `TobaHealth/TobaHealth-Treinos.html`

1. **Resumo do treino:** ao tocar em **Registrar treino** no treino de força, abre uma tela de resumo feita para tirar print e mandar no GymRats: peso levantado no treino (com a comparação divertida, tipo "≈ 2,9 hipopótamos"), exercícios, séries, repetições, tempo e calorias, quanto você levantou a mais ou a menos que da última vez naquele mesmo treino (A, B, C...) e os grupos musculares.
2. **Recordes pessoais (PR):** o resumo mostra em destaque cada exercício em que você bateu o seu recorde — maior carga, ou mais repetições com a mesma carga — comparando com todo o seu histórico, com o "antes" embaixo. Exercícios feitos pela primeira vez aparecem como 🆕.
3. **Rever o resumo depois:** os treinos de força no histórico ganharam o botão 🏆, que abre o resumo daquele dia.
4. **Observações mais visíveis:** no histórico, a observação do treino agora aparece com 📝, num quadrinho e com letra mais clara (antes era um texto cinza miúdo embaixo da lista de exercícios).
5. **Antebraço:** novo grupo muscular com 5 exercícios: rosca de punho (flexão), rosca de punho inversa (extensão), rosca inversa (pegada pronada), rosca Zottman e rolo de punho.
6. **Remada baixa:** agora tem as duas versões, **Remada baixa normal (polia)** e **Remada baixa unilateral (polia)**. Os treinos antigos com "Remada baixa (polia)" continuam contando como a normal.

**Dados:** Nenhuma mudança no banco. O resumo e os recordes são calculados na hora a partir dos treinos que já existem.

**Como testar:** Treinos → + Treino → Treino de força → abrir um treino salvo, aumentar a carga de um exercício e tocar em Registrar treino: deve abrir o resumo com o recorde em destaque. Tocar em Fechar (ou no ‹) volta para Treinos. Abrir o mês no Histórico mensal → botão 🏆 de um treino de força. Editar um treino e salvar não abre o resumo. Conferir o grupo Antebraço e as duas remadas baixas em Costas.

**Commit sugerido:** `v1.25 - Resumo do treino de forca com recordes, antebraco e remada baixa unilateral`

---

## v1.26 — App sempre pega a versão nova depois de publicar

**Arquivos novos/alterados:** `sw.js`, `CLAUDE.md`

1. **Atualização sem "meio a meio":** logo depois de publicar, o celular podia abrir a página nova junto com arquivos antigos guardados pelo navegador (o GitHub Pages deixa cada arquivo guardado por até 10 minutos). Era isso que fazia o resumo do treino da v1.25 não aparecer. Agora o app sempre confere com o site se cada arquivo mudou antes de usar o guardado; offline continua funcionando igual.

**Dados:** Nenhuma mudança no banco.

**Como testar:** depois de publicar, feche e abra o app no celular uma vez (ou recarregue a página). Registre um treino de força: o resumo deve aparecer.

**Commit sugerido:** `v1.26 - Service worker sempre confere a versao nova dos arquivos`

---

## v1.27 — Iniciar treino: modo ao vivo com régua e timer de descanso

**Arquivos novos/alterados:** `TobaHealth/js/sessao.js` (NOVO), `TobaHealth/css/sessao.css` (NOVO), `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/js/treinos.js`, `assets/toba-common.js`, `assets/toba-common.css`, `sw.js`, `CLAUDE.md`

1. **▶ Iniciar treino:** botão novo no topo de Treinos. Você escolhe um dos seus treinos salvos (A, B, C...) ou começa um **treino livre**, adicionando exercícios do catálogo na hora.
2. **Treino ao vivo:** cronômetro do treino no topo, um exercício por vez, bolinhas mostrando quantos faltam (toque numa para pular direto), botões Anterior / Pular / Próximo e **➕ Exercício extra** no meio do treino. Cada série já vem com o que você fez da última vez naquele exercício; é só ajustar e tocar em **✓ Série feita**. Dá para pôr ou tirar série, e mexer na carga da série atual já ajusta as próximas que estavam iguais.
3. **Sem teclado para reps e carga:** uma régua de arrastar para o lado (reps de 1 a 50, carga de 0 a 300 kg com traço maior a cada 5 kg). O número do meio fica destacado e o celular vibra de leve a cada valor. No PC funciona arrastando com o mouse, com a rodinha ou com as setas. Cargas com meio quilo da última vez (ex.: 62,5 kg) aparecem arredondadas (63 kg).
4. **Timer de descanso anti-reels:** ao marcar a série começa o descanso (90 s, com atalhos 60/90/120/180 s e −15 s / +15 s), com contagem grande e anel de progresso. Ao zerar, o celular vibra e manda você largar o reels. Se passar muito do tempo aparece, em vermelho, o **tempo perdido no feed**; se você sair do app e voltar, leva uma bronca ("Te peguei no reels, né? 👀"). O timer conta pelo relógio, então continua certo mesmo se a tela apagar ou você trocar de app. O painel do timer pode ser minimizado (▾).
5. **Tela acesa:** durante o treino o app pede para a tela não apagar (onde o navegador permite). Se apagar mesmo assim, nada se perde.
6. **Não perde o treino:** se o app fechar, a tela apagar ou a página recarregar, ao abrir Treinos aparece **"Treino em andamento → Continuar / Descartar"**.
7. **Finalizar treino:** pede (opcional) calorias e observação, e permite **salvar como modelo** (treino livre) ou **atualizar o modelo** com o que você fez hoje. Salva como um treino de força normal (só as séries marcadas ✓, com a duração do cronômetro) e abre o resumo com os recordes. **Cancelar treino** pede confirmação antes de jogar fora.

**Dados:** Nada muda em `TOBA_HEALTH_DB` (treinos e modelos continuam no mesmo formato). O treino em andamento fica numa chave nova e temporária, `TOBA_HEALTH_ACTIVE_SESSION`, apagada ao finalizar ou descartar. Bancos e backups antigos continuam funcionando; o backup geral do portal já leva essa chave junto, se houver treino aberto.

**Como testar:**
- No PC (VS Code): `python -m http.server 8080`, abrir `http://localhost:8080/TobaHealth/TobaHealth-Treinos.html` (de preferência com o DevTools no modo celular, 360 e 384 px).
- Iniciar treino → Treino A: conferir que as séries vêm com a última vez. Arrastar as réguas com o mouse, usar a rodinha e as setas ‹ ›.
- Marcar ✓ uma série: o timer aparece. Testar 60/120 s, −15 s / +15 s, ▾ minimizar e Pular descanso.
- Recarregar a página (F5) no meio: aparece "em andamento" → Continuar volta igual, com o timer certo.
- Pular um exercício, adicionar um exercício extra, pôr e tirar série, Finalizar → conferir o resumo e o treino no Histórico. Treino livre + "Salvar como modelo" vira um treino salvo novo.
- Cancelar treino → confirma → some o aviso de em andamento.
- **No celular** (depois de publicar): arrastar as réguas com o dedo (a página não pode rolar junto; deve vibrar no Android), marcar uma série, sair para o Instagram por uns 2 minutos e voltar (bronca + tempo perdido), deixar a tela apagar no meio e conferir o cronômetro, fechar o app e reabrir (Continuar).

**Commit sugerido:** `v1.27 - Iniciar treino: modo ao vivo com regua de arrastar e timer de descanso`

---

## v1.28 — Notificações: fim do descanso e lembretes na agenda

**Arquivos novos/alterados:** `assets/toba-common.js`, `assets/toba-common.css`, `TobaHealth/js/sessao.js`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/js/gastos.js`, `TobaHealth/TobaHealth-Pesagem.html`, `TobaHealth/js/pesagem.js`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/js/treinos.js`, `sw.js`, `CLAUDE.md`

1. **"⏱ Descanso acabou!" fora do app:** no treino ao vivo, se o descanso acabar enquanto você está em outro app (reels...), chega uma notificação na barra do celular. Tocar nela volta para o treino. Na 1ª vez que abrir o treino ao vivo, o app pede permissão para notificar. Se a tela ficar apagada por muito tempo, o celular pode congelar o app e o aviso atrasar; a vibração e a bronca na volta continuam iguais.
2. **Lembrete de gastos na agenda:** em Gastos → ⚙️ → **🔔 Lembretes → Lembrete de gastos**. Já vem com **08:00, 14:00 e 22:00, todo dia**, com o aviso "Gastou algo hoje? Põe no Toba!". Dá para mudar os horários e os dias antes de criar.
3. **Lembrete de pesagem** (Pesagem → ⚙️) e **lembrete de treino** (Treinos → ⚙️, que agora tem a seção 🔔 Lembretes): você escolhe o horário e os dias da semana.
4. **Como os lembretes funcionam:** o botão **📅 Criar na agenda** baixa um arquivo de agenda (.ics). Abra o arquivo e toque em Adicionar: quem avisa é o **calendário do celular**, no horário certo, mesmo com o app fechado e sem internet. Criar de novo o mesmo lembrete substitui o anterior (na maioria das agendas); para tirar, apague o evento na agenda.

**Dados:** Nenhuma mudança no banco. Os lembretes ficam na agenda do celular, não no Toba.

**Como testar:**
- No PC: `python -m http.server 8080` → Gastos → ⚙️ → Lembrete de gastos → Criar na agenda: deve baixar `toba-lembrete-gastos.ics`. Abrir no Outlook/Calendário do Windows mostra os 3 eventos diários. Testar também Pesagem e Treinos, desmarcando todos os dias (tem que pedir para escolher um).
- Larguras 360 e 384 px: os 7 dias cabem numa linha.
- **No celular** (depois de publicar): criar o lembrete de gastos e abrir o arquivo baixado (no S24 abre no Samsung Calendar; no iPhone, toque no arquivo e em "Adicionar tudo"). Conferir na agenda que repete todo dia.
- Treino ao vivo: iniciar, aceitar a permissão, marcar uma série com descanso de 60 s, ir para outro app e esperar a notificação. Tocar nela e conferir que volta para o treino.

**Commit sugerido:** `v1.28 - Notificacao do fim do descanso e lembretes na agenda (gastos 08h/14h/22h, pesagem e treino)`

---

## v1.29 — Treinos com destaque e página de cada treino

**Arquivos alterados:** `assets/toba-common.css`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Quadradinhos com destaque:** os quadradinhos que ficam soltos na tela (não dentro de um card) agora são mais escuros que o fundo, igual aos do Toba Bank. Nos Treinos, cada número ganhou cor: calorias em dourado, distância em azul, Saitama em coral e levantado em verde.
2. **Cards do histórico com contraste:** os treinos do mês (Histórico mensal → um mês) também ficaram mais escuros que o fundo, com a borda acendendo ao tocar e um "Ver o treino ›" no canto.
3. **Página "Como foi o treino":** tocar em qualquer treino do histórico abre a página dele: tipo, data e dia da semana, grupos musculares, peso levantado em destaque (com a comparação divertida), tempo, energia, distância (com min/km), flexões/abdominais/agachamentos e, no treino de força, cada exercício série por série (reps e carga), quanto cada exercício levantou e 🏅 nos recordes. Embaixo: **🏆 Ver resumo com recordes** (força), **Editar** e **Excluir**. O `‹` volta para o mês. Os botões 🏆, lápis e lixeira do card continuam funcionando direto.

**Dados:** "Nenhuma mudança no banco."

**Como testar:**
- Treinos: os quadradinhos do mês têm fundo mais escuro e números coloridos (360 e 384 px).
- Histórico mensal → Outubro → tocar no "Treino A": abre a página com as séries. Tocar em Ver resumo e voltar pelo `‹` duas vezes (página → mês).
- Na página, Editar e salvar: a página atualiza. Excluir: confirma e volta para o mês.
- Tocar na lixeira do card (sem abrir a página): só pergunta se quer excluir.
- Conferir que Gastos, Investimentos e o portal continuam com os quadradinhos como antes.

**Commit sugerido:** `v1.29 - Quadradinhos com destaque nos Treinos e pagina de detalhe de cada treino`

---

## v1.30 — Mapa de calor dos músculos (1ª versão)

**Arquivos alterados:** `TobaHealth/js/hall.js`, `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `TobaHealth/TobaHealth-Treinos.html`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Boneco no card do mês:** cada mês do Histórico mensal mostra um bonequinho (frente e costas) com os músculos que você treinou pintados de verde: quanto mais forte o verde, mais repetições naquele grupo. Do lado aparecem os 3 mais treinados e uma zoeira com quem ficou de fora ("Costas pedindo socorro 🆘", "Panturrilha de férias 🏖️"...).
2. **Mapa de calor na página do mês:** abaixo do Hall do mês, o boneco grande e um ranking com barra por grupo. Tocar num músculo mostra "Peito: 68 reps · 3.877 kg · último há 2 dias".
3. **Músculos do treino:** a página "Como foi o treino" também mostra o boneco só daquele treino.
4. **Como mede:** repetições por grupo muscular (kg puro faria a perna sempre ganhar), comparando com o grupo mais treinado do período. Conta os treinos de força e as flexões, agachamentos e abdominais do Saitama. Caminhada, bike e elíptico ainda não pintam o boneco.

**Dados:** "Nenhuma mudança no banco." É só cálculo em cima dos treinos que já existem.

**Como testar:**
- Treinos → Histórico mensal: o card do mês mostra o boneco e os mais treinados (360 e 384 px).
- Abrir o mês: seção "🔥 Mapa de calor"; tocar no peito e nas costas (aparece o aviso embaixo).
- Abrir um treino de força: "🔥 Músculos do treino" com só os grupos dele.

**Commit sugerido:** `v1.30 - Mapa de calor dos musculos no historico, no mes e no treino`

---

## v1.31 — Todo treino pinta o mapa de calor, do verde ao vermelho

**Arquivos alterados:** `TobaHealth/js/hall.js`, `TobaHealth/css/treinos.css`, `CLAUDE.md`, `PATCH-NOTES.md`.

1. **Caminhada, bike e elíptico contam:** cada km vira "repetições equivalentes" nos músculos que a atividade trabalha. Sem distância, o app estima pelo tempo.
   - Caminhada / corrida, por km: panturrilha 12, quadríceps 6, glúteos 4, posterior 3.
   - Bike, por km: quadríceps 5, panturrilha 2, glúteos 2.
   - Elíptico, por km: quadríceps 6, glúteos 4, panturrilha 4, posterior 2.
2. **Todo exercício conta:** os km do Treino Saitama e do treino personalizado (futebol, trilha...) entram como caminhada/corrida. Personalizado sem distância não diz o músculo, então espalha um pouco no corpo todo.
3. **Ranking sem corte:** "Posterior de coxa" aparece como "Posterior" no ranking, para caber numa linha.
4. **Do verde ao vermelho:** o mapa agora muda de cor conforme o quanto você treinou cada músculo no período: verde clarinho (pouco) → verde → amarelo → laranja → vermelho (pegando fogo 🔥, o mais treinado). A página do mês tem a legenda "pouco → pegando fogo" embaixo do boneco, e as barras do ranking seguem as mesmas cores.

**Dados:** "Nenhuma mudança no banco." É só cálculo; vale também para os treinos antigos.

**Como testar:** Treinos → Histórico mensal: num mês com caminhada, a panturrilha e o quadríceps aparecem pintados. Abrir uma caminhada ("Ver o treino"): "🔥 Músculos do treino" mostra as pernas. Tocar na panturrilha mostra as reps. O músculo mais treinado do mês fica vermelho.

**Commit sugerido:** `v1.31 - Todo treino conta no mapa de calor (caminhada, bike, eliptico, km do Saitama) e cores do verde ao vermelho`

---

## v1.32 — Correções visuais: fim das janelas e mapa de calor

**Arquivos alterados:** `assets/toba-common.css`, `TobaHealth/js/hall.js`, `PATCH-NOTES.md`.

1. **Último item da janela não fica mais colado na borda:** em "Registrar treino" o "Treino personalizado" e no "Treino de força" o "Montar treino do zero" encostavam no fim da janela. Era a folha achando que tinha um rodapé fixo (o botão "Salvar treino", que fica escondido até escolher o tipo) e tirando o respiro de baixo. Agora o respiro só some quando o rodapé está aparecendo de verdade. Conferi todas as janelas do portal, Bank e Health em 360 px.
2. **"Frente" e "Costas" abaixo dos pés:** no mapa de calor, os rótulos ficavam atrás dos pés do boneco. Agora ficam embaixo, em todo lugar onde o mapa aparece (card do mês, página do mês e página do treino).

**Dados:** "Nenhuma mudança no banco."

**Como testar:**
- Treinos → + Treino: rolar até o fim, o "Treino personalizado" tem espaço embaixo. Tocar em Treino de força: o "Montar treino do zero" também.
- Abrir um cadastro com botão de salvar (gasto, pesagem, caminhada): o botão continua preso embaixo.
- Mapa de calor no card do mês e na página do mês: "FRENTE" e "COSTAS" aparecem inteiros, abaixo dos pés.

**Commit sugerido:** `v1.32 - Respiro no fim das janelas e rotulos do mapa de calor abaixo dos pes`


## v1.33 — Mapa de calor da vida no Hall do Herói

**Arquivos alterados:** `TobaHealth/js/hall.js`, `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `PATCH-NOTES.md`.

1. **Quadradinho "🔥 Mapa de calor da vida" no Hall do Herói:** logo abaixo do Treino Saitama, um mapa do boneco somando todos os treinos da vida (força, peso do corpo, caminhada, corrida, bike, elíptico e km do Saitama). Do lado vem o veredito do shape.
2. **Triângulo ou retângulo:** compara as repetições de tronco (peito, costas, ombros, bíceps, tríceps, antebraço e abdômen) com as de perna. Se um lado tem mais de 1,3× o outro: 🔻 Triângulo invertido (tronco manda) ou 🔺 Triângulo (perna manda). Senão: ▭ Retângulo. Mostra também o % de cada lado.
3. **Página do mapa da vida:** tocar no quadradinho abre o resumo do shape e o mapa músculo por músculo, com o ranking e o toque em cada músculo mostrando reps, kg e o último treino.

**Dados:** "Nenhuma mudança no banco." Só cálculo em cima dos treinos já salvos.

**Como testar:**
- Treinos → 🏆 Hall do Herói: o quadradinho do mapa aparece por último, com o veredito e o % de tronco e perna.
- Tocar nele: abre "🔥 Mapa de calor da vida" com o resumo e o mapa. Tocar num músculo mostra o resumo dele.
- Hall de um mês específico: o quadradinho não aparece (é só da vida toda).

**Commit sugerido:** `v1.33 - Mapa de calor da vida no Hall do Heroi (triangulo ou retangulo)`

---

## v1.34 — App Android (APK) com gastos automáticos pelas notificações

**Arquivos novos/alterados:** `TobaAndroid/` (NOVO: projeto do app Android e `TobaAndroid/README.md` com o passo a passo), `assets/toba-common.js`, `TobaBank/js/gastos.js`, `TobaBank/js/bank-core.js`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/css/gastos.css`, `TobaHealth/js/sessao.js`, `TobaHealth/TobaHealth-Pesagem.html`, `TobaHealth/TobaHealth-Treinos.html`, `CLAUDE.md`

1. **Toba como app Android:** a pasta `TobaAndroid` gera um APK que abre o site do Toba dentro dele. Patch no site continua chegando sozinho no app; só precisa gerar APK de novo quando mudar a parte do Android (raro). Passo a passo (gerar, instalar, levar os dados) no `TobaAndroid/README.md`.
2. **Gastos automáticos:** com o app instalado e o acesso às notificações ligado (Gastos → ⚙️ → 🤖 Gastos automáticos), toda notificação de compra do Google Wallet, Samsung Wallet ou dos principais bancos vira um aviso "💸 R$ 25,90 · PADARIA". Ao abrir o Gastos, a compra já entra como gasto à vista, com a data da compra e a categoria da última vez que você usou aquela loja (ou um palpite: Uber → Uber/App, iFood/padaria → Alimentação, posto → Combustível, mercado, farmácia, streaming...; senão "Outros"). Uma janela mostra o que entrou, e dá para editar ou apagar no histórico como qualquer gasto.
3. **Não entra repetido:** a mesma compra avisada pela carteira e pelo banco conta uma vez só, e um gasto já lançado nunca entra de novo. Recebimentos, Pix recebido, estornos, cashback e avisos de fatura são ignorados.
4. **🧾 O que o Toba leu:** mostra as últimas notificações com R$ e o que aconteceu com cada uma. Se o seu banco aparecer "fora da lista", toque em **Ler este app**.
5. **Lembretes de verdade no app:** em Gastos, Pesagem e Treinos (⚙️ → 🔔 Lembretes), o botão vira **🔔 Ligar lembrete**: o próprio Toba avisa nos horários (ex.: 08:00, 14:00, 22:00 "Gastou algo hoje? Põe no Toba!"), mesmo com o app fechado e depois de reiniciar o celular. Tem **Desligar**. No navegador continua indo pela agenda (.ics).
6. **Descanso no horário certo:** no app, o fim do descanso do treino ao vivo é avisado pelo Android na hora exata, mesmo com a tela apagada ou no Instagram, e a tela fica acesa durante o treino.
7. **Backup no app:** "Baixar backup" grava em `Downloads/Toba` (no app não existe o download do navegador).

**Dados:** Os gastos lançados pelo app ganham um campo opcional novo, `notifId` (texto), em `transactions`. Ele só serve para não lançar a mesma notificação duas vezes; gastos antigos e manuais não têm o campo, e bancos/backups antigos continuam funcionando igual. A fila de compras lidas, os lembretes e o descanso agendado ficam guardados na parte Android do app, fora do `localStorage`. **Atenção:** o app tem armazenamento separado do Chrome; na 1ª vez, leve os dados pelo backup geral do portal (passo 3 do README).

**Como testar:**
- No PC (site): abrir Gastos, Pesagem e Treinos: nada muda no navegador (a seção 🤖 não aparece, os lembretes continuam criando a agenda), sem erros no console.
- Gerar o APK pelo Android Studio (README, passo 1) e instalar no S24.
- No app: levar os dados pelo backup geral, ligar o acesso às notificações (e a "configuração restrita", se pedir) e pôr a bateria do Toba em "Sem restrições".
- Fazer uma compra com o celular → conferir o aviso "💸" → abrir o Gastos → o gasto entra. Abrir de novo → não duplica. Ver em 🧾 O que o Toba leu.
- Ligar o lembrete de gastos com um horário daqui a 2 minutos, fechar o app e esperar o aviso. Desligar depois.
- Treino ao vivo: marcar uma série, apagar a tela e esperar o aviso do fim do descanso.
- Gastos → ⚙️ → Dados & Backup → Baixar backup → conferir o arquivo em Downloads/Toba.

**Commit sugerido:** `v1.34 - App Android (APK) com gastos automaticos pelas notificacoes e lembretes nativos`

---

## v1.35 — Livre hoje cobra o estouro de ontem, ? no mapa de calor e categorias novas no Gastos

**Arquivos novos/alterados:** `TobaBank/js/bank-metrics.js`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/js/hall.js`, `TobaHealth/js/treinos.js`, `TobaHealth/css/treinos.css`, `TobaBank/js/categorias.js` (NOVO), `TobaBank/js/bank-core.js`, `TobaBank/js/gastos.js`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/css/gastos.css`, `sw.js`, `CLAUDE.md`

1. **Estourou, paga amanhã:** o "💵 Livre hoje" agora carrega a dívida. Orçamento de 150 e gastou 300 hoje? Amanhã você começa em −150, e somando os 150 do dia o Livre hoje mostra R$ 0,00. Segura um dia sem gastar e no outro volta pros 150. Estourou mais? A dívida vai passando de dia em dia até ser paga. O Toba não é só controle, é economia 💪
2. **Sobra não vira crédito:** gastou menos que o orçamento? O dia seguinte começa normal; a sobra vai pro 🐷 Cofre do mês, como sempre.
3. **Só dentro do mês:** a dívida conta a partir do início do controle e zera na virada do mês, junto com o cofre.
4. **Portal junto:** o card do Toba Bank no portal usa a mesma conta, então o "Livre hoje" de lá bate com o do Gastos.
5. Isso nunca tinha funcionado assim (desde a v1.04 o Livre hoje era só "orçamento do dia − gasto de hoje"); não foi um patch que quebrou.
6. **Botão ? no mapa de calor:** do lado do título do mapa (página do mês, página do treino e "Mapa de calor da vida" do Hall do Herói) tem um ? redondinho. Tocar abre o "🔥 Manual do boneco", no jeito Toba: o que as cores querem dizer (vermelho é o campeão do período, não lesão), o que entra na conta (força, peso do corpo/Saitama, caminhada, bike e elíptico) e por que conta reps e não kg.
7. **Modelos de shape explicados:** quais músculos são tronco e quais são perna, a regra do 1,3× (uns 57% do total) e o que é 🔻 Triângulo invertido, 🔺 Triângulo e ▭ Retângulo.
8. **Como equilibrar:** caçar os músculos cinzas, o que treinar se virou 🔻 ou 🔺, e o lembrete de que a meta é o boneco colorido por igual, não tudo vermelho. A dica embaixo do mapa ficou mais curta e aponta pro ?.
9. **Categorias novas no Gastos:** 21 categorias que fazem sentido, em 6 grupos: 🏡 Casa (Moradia, Contas, Casa), 🍔 Comida & rolê (Mercado / Feira, Comida fora, Rolês & bares), 🎮 Lazer (Viagens, Assinaturas, Games), 🚗 Transporte (Combustível, Uber / Estacionamento, Carro), 🧍 Você (Saúde, Pets, Cuidados, Roupas, Estudos, Presentes) e 📦 Resto (💸 Taxas & juros, que é nova, Investimentos e Outros).
10. **Adeus select cinza:** tocar em Categoria (novo gasto, editar gasto, editar compra parcelada, gasto fixo) abre a gaveta "🏷️ Onde foi parar o dinheiro?" com botões grandes de emoji, 3 por linha, e o escolhido aceso. O gráfico e as listas mostram emoji + nome curto, sem quebrar linha no S24.
11. **O passado vem junto:** na 1ª abertura, todo gasto, parcelado e fixo antigo troca sozinho para a categoria nova (Alimentação → Comida fora, Lazer → Rolês & bares, Transporte - Manutenção/IPVA → Carro...). Categoria que não estava na lista vira 📦 Outros, e o nome antigo fica guardado.
12. **Categoria da compra parcelada:** o "✏️ Editar compra parcelada" ganhou o campo Categoria (antes não dava pra trocar depois de lançar). Muda a categoria de todas as parcelas, inclusive as que já passaram.
13. **Gastos automáticos do app** já chutam nas categorias novas, e agora estacionamento, Zona Azul, Sem Parar/pedágio caem em Uber / Estacionamento e tarifa, anuidade, juros e IOF em Taxas & juros.

**Dados:** Livre hoje e mapa de calor: nenhuma mudança no banco, é só conta. Categorias: o campo `category` de `transactions`, `installments`, `config.fixedExpenses` e das cópias de fixos dos meses passa a guardar um código curto (`"mercado"`, `"uber"`...) em vez do texto antigo. A troca acontece no load (rodar de novo não muda nada), o texto antigo fica num campo opcional novo, `oldCategory`, e antes da 1ª troca o banco inteiro é copiado uma vez para a chave nova `TOBA_BANK_DB_PRE_CATEGORIES_BACKUP` (nunca sobrescrita). Backups antigos continuam importando: passam pela mesma troca. Essa conversão fica no código de vez (é pequena, e sem ela backup antigo importado voltaria com categoria desconhecida).

**Como testar:**
- Abrir o Gastos: se ontem você gastou mais que o orçamento líquido do dia, o Livre hoje aparece menor (ou vermelho). Ex.: 18/10 com R$ 341,04 gastos e R$ 123,64/dia → em 19/10 o Livre hoje começa em −R$ 93,76.
- Num dia em que ontem ficou abaixo do orçamento, o Livre hoje continua o valor cheio.
- Abrir o portal e conferir que o "Livre hoje" do card bate com o do Gastos.
- Console sem erros nas duas telas.
- Treinos → tocar num mês do histórico: no "🔥 Mapa de calor" aparece o ? à direita do título. Tocar abre o Manual do boneco; rolar até o fim e fechar no ✕. O ? também aparece em "🔥 Músculos do treino" (página do treino) e em "🔥 Músculo por músculo" (Hall do Herói → mapa da vida).

- Gastos: abrir com os dados de sempre. O gráfico "📊 Gastos por categoria" e os lançamentos já aparecem com as categorias novas (emoji + nome), inclusive nos meses fechados e nos fixos.
- Tocar em + Gasto → Categoria: abre a gaveta, escolher uma, salvar. Editar um gasto antigo: a gaveta abre com a categoria dele acesa.
- Fixos → Novo gasto fixo e editar um fixo: mesma gaveta.
- Parcelas → tocar numa parcela → Categoria mostra a atual; trocar, salvar e conferir no gráfico.
- Console: `localStorage.getItem("TOBA_BANK_DB_PRE_CATEGORIES_BACKUP")` tem a cópia de antes. Recarregar a página duas vezes não muda nada.
- ⚙️ → importar um backup antigo do Bank: volta com as categorias novas.

**Commit sugerido:** `v1.35 - Livre hoje carrega o estouro do dia anterior, botao ? no mapa de calor e categorias novas no Gastos`

---

## v1.36 — Treino do Saitama ao vivo e tela sempre acesa

**Arquivos novos/alterados:** `TobaHealth/js/sessao-saitama.js` (NOVO), `TobaHealth/js/sessao.js`, `TobaHealth/css/sessao.css`, `TobaHealth/TobaHealth-Treinos.html`, `sw.js`, `CLAUDE.md`

1. **Acabou a injustiça com quem não puxa ferro:** no "▶ Iniciar treino" agora tem o card **👊 Treino do Saitama**, logo no topo, antes dos Treinos A/B/C.
2. **Contador de bolso:** a tela mostra três quadradões (💪 Flexão, 🔥 Abdominal, 🦵 Agachamento) com o total do dia e uma barrinha até os 100 do careca. Não tem ordem: fez 20 flexões, toca no quadrado da flexão e soma. Chegou nos 100, o quadrado fica dourado e o careca aprova 💯.
3. **Quanto soma cada toque:** fileira **+1 · +5 · +10 · +20**. O app lembra o último que você usou.
4. **↩ Desfazer** tira o último toque (dedo gordo acontece), e o "Hoje no treino" mostra as últimas levas com o horário.
5. **Descanso automático:** ligado, cada toque já começa o mesmo timer de descanso do treino de força (anel, 60/90/120/180 s, ±15 s), com frases novas do Saitama. Desligado, vira só contador. Tem também o botão **⏱ Descansar** pra puxar um descanso na mão. O app lembra a escolha.
6. **Finalizar:** pergunta os km (se correu ou caminhou), calorias e observações e salva como um Treino do Mestre Saitama normal, com o tempo do cronômetro. Abre direto a página "Como foi o treino". Hall do Herói, mapa de calor e peso levantado contam igual a antes.
7. **Fechou o app no meio?** O treino fica guardado e aparece "⏸ Treino do Saitama em andamento" com Continuar/Descartar, igual o de força.
8. **🔆 Manter a tela acesa no treino:** a tela já ficava acesa no treino ao vivo de força. Agora tem um interruptor no fim da tela do treino (força e Saitama), ligado por padrão. Desligou, a tela pode apagar sozinha; a escolha vale pros próximos treinos.

**Dados:** Nenhuma mudança no banco: o treino salvo é um treino `saitama` no mesmo formato do formulário. O treino em andamento (chave temporária `TOBA_HEALTH_ACTIVE_SESSION`) ganhou os campos opcionais `kind` e `saitama`; treino de força em andamento de antes continua abrindo normal. Chave nova só de preferência de tela: `toba_health_live_prefs` (tela acesa, passo, descanso automático e tempo do descanso do Saitama); sem ela, vale o padrão.

**Como testar:**
- Treinos → ▶ Iniciar treino → 👊 Treino do Saitama. Tocar 3× em Flexão: mostra 30 e o descanso começa.
- Trocar pra +20, tocar em Agachamento, depois ↩ Desfazer: volta o último toque.
- Desmarcar "Descanso automático" e tocar num quadrado: soma sem abrir o timer.
- Recarregar a página: aparece "⏸ Treino do Saitama em andamento"; ▶ Continuar volta com os números.
- 🏁 Finalizar → pôr 2,5 km → Salvar: abre "Como foi o treino" com as reps e os km; no mês, o quadradinho 👊 Saitama soma.
- Começar um treino de força livre: a folha de finalizar continua com nome e "Salvar como modelo", sem o campo de km.
- No celular: com "🔆 Manter a tela acesa" ligado a tela não apaga durante o treino; desligado, apaga no tempo normal.

**Commit sugerido:** `v1.36 - Treino do Saitama ao vivo com contador e interruptor de tela acesa`

---

## v1.37 — Card do Health com números, Configurador de cards e conserto do modo offline

**Arquivos novos/alterados:** `index.html`, `assets/portal.js`, `assets/portal.css`, `TobaHealth/js/health-metrics.js` (NOVO), `sw.js`, `CLAUDE.md`

1. **🧩 Configurador de cards:** na ⚙️ do portal, os ajustes de card agora ficam num menu só, **Configurador de cards**, com um item por app (Toba Bank e Toba Health). Quando chegarem mais apps com números no card, eles entram ali sem encher a ⚙️.
2. **🥗 Card do Toba Health com dado de verdade:** igual ao card do Bank, ele pode ser **Simples** ou **Com números**. Em ⚙️ → Configurador de cards → **Toba Health** você marca o que aparece: peso atual (com a setinha vs a pesagem anterior), peso no mês (quanto subiu/desceu desde a última pesagem do mês passado), treinos no mês, km no mês, treinos na semana, calorias, tempo treinado, reps do Saitama e gordura. Padrão: peso, peso no mês, treinos e km. Tem botão 🙈 pra esconder o peso e atalhos pra Treinos e Pesagem. Quem ainda não tem pesagem nem treino vê o card normal, sem um monte de "--".
3. **🐛 Tela quebrada offline:** sem internet, se um JS ou CSS não estivesse guardado no celular, o app entregava a página do portal no lugar dele e a tela quebrava sem aviso. Agora só página cai no portal; arquivo faltando dá erro normal.

**Dados:** Nenhuma mudança nos bancos. O portal só **lê** o `TOBA_HEALTH_DB` (do mesmo jeito que já lia o do Bank). Uma chave nova de preferência de tela: `toba_health_card_config` (o que o card do Health mostra); sem ela, vale o padrão. O backup geral já leva ela.

**Como testar:**
- ⚙️ → Configurador de cards: aparecem Toba Bank e Toba Health; o do Bank abre igual antes.
- Card do Health: peso e setinha batem com a tela da Pesagem; treinos e km do mês batem com os quadradinhos do Treinos.
- Configurador → Toba Health: ligar "Reps do Saitama" e "Gordura", recarregar: continuam ligados. Tocar 🙈 Esconder no card: peso vira "** kg".
- Registrar um treino e voltar pelo ‹: o card já mostra o treino novo.
- Aba anônima (sem dados): portal abre sem erro no console, card do Health com a frase de sempre.
- Offline: com o app aberto uma vez, DevTools → Application → Service Workers deve mostrar `toba-v10`; em Network marcar Offline e recarregar: tudo abre igual.

**Commit sugerido:** `v1.37 - Card do Health com numeros, configurador de cards e fallback offline so pra paginas`

---

## v1.38 — Correção: APK não compilava e passo a passo de instalação

**Arquivos novos/alterados:** `TobaAndroid/app/src/main/res/values/colors.xml`, `TobaAndroid/INSTALAR.md` (NOVO), `TobaAndroid/README.md`, `CLAUDE.md`

1. **APK volta a compilar:** um comentário no arquivo de cores do app Android tinha dois hífens seguidos, o que não é permitido nesse tipo de arquivo. O Android Studio parava com "A string '--' não é permitida nos comentários". Só o comentário mudou; as cores são as mesmas.
2. **Guia:** o `CLAUDE.md` passa a citar a versão certa (v1.34) do campo novo dos gastos automáticos.
3. **Passo a passo para outras pessoas instalarem o app:** `TobaAndroid/INSTALAR.md` explica, do zero, como instalar o APK pelo cabo USB (no Brasil o Play Protect bloqueia abrir o APK direto no celular), levar os dados do Chrome, ligar os gastos automáticos, atualizar depois, e o que fazer em cada erro. O `README.md` do app foi corrigido com esse caminho.

**Dados:** Nenhuma mudança no banco.

**Como testar:** no Android Studio, **Build → Rebuild Project** e depois **Build → Generate Signed App Bundle / APK** sem erros. Ler o `TobaAndroid/INSTALAR.md` no VS Code (pré-visualização do Markdown) e conferir os passos.

**Commit sugerido:** `v1.38 - Corrige build do APK e passo a passo de instalacao pelo cabo USB`

---

## v1.39 — Notificação do treino ao vivo, régua até 999 kg e carga por halter

**Arquivos novos/alterados:** `TobaHealth/js/sessao.js`, `TobaHealth/js/treinos.js`, `TobaHealth/js/forca.js`, `TobaHealth/js/health-core.js`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/css/treinos.css`, `assets/toba-common.js`, `assets/toba-common.css`, `TobaAndroid/app/build.gradle`, `TobaAndroid/app/src/main/java/br/com/toba/app/` (`Notifier.java`, `TobaBridge.java`, `TobaStore.java`, `Alarms.java`, `AlarmReceiver.java`), `CLAUDE.md`

1. **🏋️ Notificação fixa do treino (app Android):** enquanto um treino ao vivo estiver aberto, a barra mostra "Treino X em andamento" com o tempo correndo, mesmo com o app fechado (o Android conta o tempo a partir da hora de início). Se você arrastar ela para fora, ela volta. Some quando o treino é finalizado ou descartado, e volta sozinha se o celular reiniciar no meio do treino. No navegador não existe essa notificação.
2. **👆 Tocar na notificação abre o treino:** vai direto para a tela do treino ao vivo, com séries feitas e cronômetro do jeito que estavam. O aviso de "descanso acabou" também abre direto o treino agora.
3. **📏 Régua de carga até 999 kg:** a régua de kg do treino ao vivo vai de 0 a 999 (antes parava em 300) e continua de 1 em 1, parando certinho no valor. Ela só desenha os números perto do centro, então fica leve. A régua de repetições continua de 1 a 50.
4. **⚖️ Tipo de carga do exercício:** embaixo do nome do exercício (no treino ao vivo e na página de um treino) aparece o chip **⚖️ Total**. Tocando nele você escolhe:
   - **Carga anotada:** "Total" (barra, máquina, peso do corpo) ou "Por halter / mão" (o peso conta 2×).
   - **Unilateral:** um lado de cada vez, reps por lado (as reps contam 2×). Com halter e unilateral juntos conta 2× (um halter por vez), não 4×.
   Vale para todos os treinos daquele exercício, inclusive os antigos: o Hall do Herói, o resumo, a página do treino, os gráficos e o mapa de calor recalculam na hora.

**Dados:** campo novo opcional `exerciseSettings` dentro do `TOBA_HEALTH_DB` (`{ "supino-reto-halter": { load: "perHand", unilateral: false } }`). Banco ou backup antigo sem ele = todo exercício "Total / bilateral", ou seja, os números antigos não mudam até você editar. O app Android guarda o treino em andamento só nas preferências dele (`workout`), nunca no `localStorage`.

**APK novo:** versão 1.1 (versionCode 2). Precisa gerar e instalar de novo para ter a notificação (itens 1 e 2). Sem o APK novo o site funciona normal, só sem a notificação.

**Como testar:**
- Navegador (`python -m http.server 8080`): Treinos → Iniciar treino → a régua de kg vai até 999, não passa de 0, e as teclas Home/End vão às pontas.
- Tocar no chip ⚖️ de um exercício de halter → "Por halter" → Salvar: o chip muda e os kg levantados da página do treino e do Hall dobram para aquele exercício. Voltar para "Total" desfaz.
- Abrir `TobaHealth-Treinos.html?live=1` com um treino em andamento: abre direto no treino.
- No celular com o APK novo: iniciar treino → notificação com cronômetro; fechar o app e esperar: o tempo continua certo; tocar → abre o treino; arrastar para fora → volta; finalizar ou descartar → some.

**Commit sugerido:** `v1.39 - Notificacao fixa do treino ao vivo, regua de kg ate 999 e tipo de carga por halter/unilateral`

---

## v1.40 — Perfil do jogador: XP, nível, streak e conquistas

**Arquivos novos/alterados:** `assets/toba-player.js` (NOVO), `assets/toba-player.css` (NOVO), `Toba-Perfil.html` (NOVO), `assets/perfil.js` (NOVO), `assets/perfil.css` (NOVO), `index.html`, `assets/portal.js`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/js/health-metrics.js`, `TobaHealth/js/forca.js`, `TobaHealth/js/hall.js`, `TobaHealth/js/treinos.js`, `TobaHealth/js/sessao.js`, `TobaHealth/js/sessao-saitama.js`, `sw.js`, `CLAUDE.md`

1. **🎮 Perfil do jogador no portal:** card novo no topo com avatar, nível, título, barra de XP e o 🔥 do streak. Tocar abre a página do perfil.
2. **✨ XP por treino, já contando o passado:** todo treino dá XP (base + minutos + séries + repetições do Saitama + km). Recordes pessoais, conquistas e marcos de streak dão bônus. Na primeira abertura o Toba conta todos os seus treinos antigos e mostra "Você já é nível X". O XP é recalculado dos treinos, então nunca duplica, e apagar um treino tira o XP dele.
3. **📈 Níveis e títulos:** cada nível pede um pouco mais de XP que o anterior. Os títulos vão de 🐣 Frango de Academia até 👊 Saitama, passando pelas classes C, B, A e S de herói. A tabela completa está no perfil.
4. **🔥 Streak "dias + meta semanal":** conta os dias seguidos e não apaga enquanto toda semana (seg a dom) tiver pelo menos 3 dias de treino. A meta dá para mudar na ⚙️ do perfil. Bônus em 7, 30, 100 e 365 dias, e o recorde de streak fica guardado. Aparece no portal, no perfil e numa faixa no topo do Treinos.
5. **🏅 55 conquistas:** treinos, peso levantado (do gato ao Titanic), distância (do Rio à volta ao mundo), calorias, Saitama, mapa de calor, recordes, streak e pesagens. As bloqueadas aparecem em cinza com a barra de progresso; as lendárias ficam como "???". Tocar mostra o detalhe.
6. **🎉 Comemorações:** ao salvar ou finalizar um treino sobe um "+XP" com a barra enchendo, depois a medalha das conquistas novas e, se subir de nível, uma tela cheia de level up com confete e o que foi desbloqueado. Som e vibração são opcionais (⚙️ do perfil).
7. **🎁 Recompensas:** títulos especiais ganhos em conquistas, avatares, molduras (bronze, prata, ouro, diamante, em chamas) e cores do avatar, liberados por nível ou conquista.
8. **Por dentro:** o catálogo de exercícios, as escalas do Hall e a conta do peso levantado foram para o `health-metrics.js`, para o portal e o Treinos darem exatamente o mesmo número. Os números do Treinos e do Hall não mudam.

**Dados:**
- Chave nova `TOBA_PLAYER_DB` (+ `TOBA_PLAYER_DB_AUTO_BACKUP`) com só a meta do streak, as recompensas escolhidas e o que já foi comemorado. O XP em si não é gravado: vem dos treinos.
- Preferência nova `toba_player_prefs` (som e vibração).
- O `TOBA_HEALTH_DB` não mudou. Bancos e backups antigos funcionam igual; o backup geral do portal já leva o perfil. Perfil ilegível não é sobrescrito: fica uma cópia em `TOBA_PLAYER_DB_CORRUPT_<data>`.

**Como testar:**
- `python -m http.server 8080` e abrir `http://localhost:8080/` com dados (restaurar um backup geral): aparece a tela "Perfil de jogador liberado" uma vez só; recarregar não repete.
- Portal: o card do jogador mostra nível, XP e streak; tocar abre o perfil.
- Perfil: conferir conquistas (tocar numa bloqueada e numa liberada), equipar um avatar/moldura/cor/título, abrir "De onde veio seu XP" e a "Tabela de níveis". Na ⚙️: mudar a meta (o streak recalcula), ligar e desligar som/vibração, "Ver a tela de level up".
- Treinos: faixa 🔥 no topo. Registrar um treino → "+XP" subindo; fazer 100/100/100 no Saitama → medalha "Dia do careca". O kg levantado do Hall continua igual ao de antes.
- Apagar o treino de teste: o XP volta, sem aviso.
- Aba anônima (sem dados): portal abre com nível 1, sem erro no console.
- Backup geral: exportar → importar → o perfil continua igual.
- APK: nada muda no app Android; ele abre o site novo normalmente.

**Commit sugerido:** `v1.40 - Perfil do jogador com XP, nivel, streak semanal e conquistas`

---

## v1.41 — Toba Routine: tarefas com XP e notificações que cobram

**Arquivos novos/alterados:** `TobaRoutine/TobaRoutine-Index.html` (NOVO), `TobaRoutine/js/routine-core.js` (NOVO), `TobaRoutine/js/routine-metrics.js` (NOVO), `TobaRoutine/js/routine-alerts.js` (NOVO), `TobaRoutine/js/routine.js` (NOVO), `TobaRoutine/css/routine-base.css` (NOVO), `assets/toba-player.js`, `assets/perfil.js`, `assets/portal.js`, `assets/portal.css`, `index.html`, `Toba-Perfil.html`, `TobaHealth/TobaHealth-Treinos.html`, `manifest.webmanifest`, `sw.js`, `CLAUDE.md`, `TobaAndroid/README.md`, `TobaAndroid/app/build.gradle`, `TobaAndroid/app/src/main/java/br/com/toba/app/` (`TobaBridge.java`, `TobaStore.java`, `Alarms.java`, `AlarmReceiver.java`, `Notifier.java`)

1. **⚡ Toba Routine saiu do "em breve":** o card do portal agora abre o app e mostra como está o dia ("✅ 2/5 hoje · ⏰ 1 atrasada"). Tem também um atalho "Rotina de hoje" no ícone do app.
2. **📋 Tarefas:** cada tarefa tem nome, emoji, quando (todo dia, dias da semana, um dia do mês ou "quando der", sem agenda), horário opcional e dificuldade. Na primeira abertura aparecem sugestões (lavar banheiro, regar plantas, passear com o cachorro, dormir na hora certa e outras). Apagar uma tarefa tira ela da lista, mas o histórico e o XP que ela já deu ficam.
3. **✅ Tela de hoje:** um toque no círculo marca como feita, com "+XP" subindo e a barra do nível andando. Tocar de novo desmarca, e o XP sai junto. As atrasadas dos últimos 7 dias aparecem logo abaixo e valem metade do XP. As tarefas "quando der" têm o botão **Fiz agora**.
4. **🔥 Streak por tarefa e histórico:** cada tarefa tem o 🔥 de vezes seguidas e o recorde. O histórico mostra os últimos 14 dias, com ✨ nos dias perfeitos.
5. **☕😐🧘 Dificuldade:**
   - Fácil, "Café com leite": 10 XP.
   - Médio, "Não fez mais que sua obrigação": 25 XP.
   - Difícil, "Monge tibetano da proatividade": 60 XP.
   - Teto de 250 XP de rotina por dia. Para comparar, um treino comum dá entre 100 e 200 XP.
6. **😈 Cobranças zoeiras:** tarefa com horário avisa na hora e, se continuar sem fazer, cobra de novo depois de 30 min e de 2 h, cada vez mais debochado. São no máximo 3 avisos por tarefa por dia, e dá para desligar a cobrança em cada tarefa. As frases mudam pela dificuldade e pelo assunto (banheiro, planta, cachorro, dormir, lixo, louça, roupa, água, remédio). Marcar a tarefa cancela as cobranças. Tocar na notificação abre o Routine com a tarefa destacada.
7. **🏅 Conquistas da rotina no Perfil do jogador:** 10 novas, entre elas "Adulto funcional", "Sono de bebê" (7 dias seguidos dormindo na hora), "Hábito de ferro/titânio/vibranium" (7/30/100 seguidas), "Dia perfeito", "Monge tibetano" e "CEO da própria vida". O XP das tarefas entra no mesmo perfil dos treinos, e o extrato do perfil ganhou a linha "✅ Rotina".

**Onde a cobrança funciona:**
- **App Android (APK 1.2):** avisa no horário e cobra com o app fechado. A notificação tem o botão **✅ Feito**, que marca sem abrir o app. Os avisos dos próximos 3 dias são refeitos sempre que você abre o portal ou o Routine; se passar mais de 3 dias sem abrir o Toba, os avisos param até a próxima abertura.
- **Navegador (site/PWA):** não existe aviso agendado com o site fechado, porque o Toba não tem servidor e os navegadores não deixam agendar notificação. Com o portal ou o Routine abertos (ou recém-minimizados), o Toba avisa e cobra normalmente. Fora isso, as tarefas do dia e as atrasadas aparecem quando você abrir. Opção: dentro da tarefa, **📅 Pôr na agenda do celular**; a agenda avisa no horário, mas não sabe quando você fez.
- **APK antigo (1.1):** o Routine funciona, mas mostra um aviso pedindo o APK novo para as cobranças.

**APK novo:** versão 1.2 (versionCode 3). Precisa gerar e instalar de novo para as cobranças e o botão Feito. Sem ele, o resto do site funciona normal.

**Dados:**
- Chave nova `TOBA_ROUTINE_DB` (+ `TOBA_ROUTINE_DB_AUTO_BACKUP`) com as tarefas e o histórico (formato no `CLAUDE.md`, seção 3.10). Entra sozinha no backup geral do portal, e o Routine tem backup próprio na ⚙️.
- O XP não é gravado: o perfil recalcula a partir do histórico.
- Nada muda no `TOBA_HEALTH_DB` nem no `TOBA_PLAYER_DB`.
- O app Android guarda os avisos e os "Feito" pendentes nas preferências dele (`task_alerts`, `task_done`), nunca no `localStorage`.

**Como testar:**
- Navegador (`python -m http.server 8080`):
  - Portal → card Toba Routine → aparecem as sugestões → Adicionar.
  - Marcar uma tarefa: "+XP" e a conquista "Adulto funcional". Desmarcar: o XP volta, sem aviso.
  - Criar tarefa semanal, mensal e "quando der": conferir que aparecem só nos dias certos (aba Tarefas).
  - Para ver atrasadas: no console, `routineDb.tasks.forEach(t => t.createdAt = "2026-10-12"); saveRoutineDb(); renderRoutine()`.
  - Avisos: ⚙️ → Permitir notificações; criar tarefa para daqui a 2 minutos e deixar a aba aberta.
  - Perfil e Treinos: o XP total é o mesmo do portal; a categoria "✅ Rotina" aparece nas conquistas.
  - Backup: ⚙️ do Routine → baixar → apagar tudo → restaurar. Backup geral do portal: exportar/importar.
- APK 1.2: Android Studio → Rebuild → gerar o APK assinado → instalar por cima.
  - Criar tarefa para daqui a 2 minutos e fechar o app: chega "🐕 Passear com o cachorro". Sem tocar, chega "😒 Ainda não: …" 30 min depois.
  - Tocar em **✅ Feito**: vira "✅ Anotado!" e as próximas cobranças não chegam. Abrir o Routine: a tarefa está marcada e o XP entrou.
  - Tocar na notificação (sem o Feito): abre o Routine com a tarefa destacada.
  - Reiniciar o celular: os avisos continuam agendados.

**Commit sugerido:** `v1.41 - Toba Routine com tarefas, XP por dificuldade e cobrancas por notificacao`

## v1.42 — Toba Routine vira hub: Rotina + Task (o Toba acha o dia), tarefa que expira e "Amanhã"

**Arquivos novos:** `TobaRoutine/TobaRoutine-Rotina.html` (NOVO), `TobaRoutine/TobaRoutine-Task.html` (NOVO), `TobaRoutine/js/routine-plan.js` (NOVO), `TobaRoutine/js/task.js` (NOVO)

**Arquivos alterados:** `TobaRoutine/TobaRoutine-Index.html` (agora é o hub), `TobaRoutine/css/routine-base.css`, `TobaRoutine/js/routine-core.js`, `TobaRoutine/js/routine-metrics.js`, `TobaRoutine/js/routine-alerts.js`, `TobaRoutine/js/routine.js`, `assets/toba-player.js`, `assets/perfil.js`, `sw.js`, `manifest.webmanifest`, `CLAUDE.md`

### Parte 1: tarefa que expira e "Amanhã"

1. **↪️ "Se não fizer, passa pro dia seguinte":** opção nova dentro de cada tarefa (não aparece nas "quando der").
   - **Ligada (padrão):** igual era antes. Não fez no dia, vira atrasada e vale metade do XP.
   - **Desligada:** a tarefa expira à meia-noite. Não aparece nas atrasadas, não conta no "⏰ atrasadas" do portal e não dá mais pra marcar o dia que passou. Serve pra coisa tipo "😴 Dormir na hora certa": dormir às 3 da manhã não é dormir na hora 😂
   - Na lista, a tarefa que expira mostra **⌛ só hoje** (tela de hoje) e **⌛** (aba Tarefas).
2. **🌅 Amanhã:** a tela de hoje mostra, depois das atrasadas, as tarefas agendadas pra amanhã (com o dia da semana). É só pra ver o que vem: não dá pra marcar antes do dia, mas tocar abre a tarefa pra editar.
3. **😴 Sugestão "Dormir na hora certa"** já vem com a opção desligada para quem adicionar agora.

**Cobranças:** tarefa que expira não cobra depois da meia-noite. Ex: dormir às 23:00 avisa às 23:00 e 23:30; a de +2 h (01:00) não vai. Um "✅ Feito" da notificação tocado depois da meia-noite nessa tarefa é ignorado (o dia dela já acabou).

**XP e streak (nada muda no que já foi feito):**
- `computePlayer()`/`calcRoutinePlayer` continuam iguais: o XP de tudo que já está no histórico é o mesmo, inclusive atrasadas antigas de uma tarefa que agora você desligou.
- O 🔥 por tarefa já quebrava quando um dia passava sem fazer, então a regra é a mesma. Expirar não tira XP, só deixa de existir a chance de pegar a metade.
- Dia perfeito, conquistas e streak do jogador: sem mudança.

**Dados:**
- Campo novo `carryOver` em `TOBA_ROUTINE_DB.tasks[]` (formato no `CLAUDE.md`, seção 3.10). Tarefa sem o campo (todas as que já existem) vale `true`, ou seja, continua passando pro dia seguinte. **A sua "Dormir na hora certa" também**: abra ela e desligue a opção.
- Backup antigo importa normal (o campo ganha o padrão no `normalizeRoutineDb`).
- Nenhum arquivo novo, então o `sw.js` não mudou. Não precisa de APK novo.

**Como testar:**
- Routine → tocar na tarefa de dormir → desligar "↪️ Se não fizer, passa pro dia seguinte" → Salvar. A linha ganha "⌛ só hoje".
- Ver as atrasadas sumirem pra ela: no console, `routineDb.tasks.forEach(t => t.createdAt = "2026-10-15"); saveRoutineDb(); renderRoutine()`. Só as tarefas com a opção ligada aparecem em "⏰ Atrasadas".
- "🌅 Amanhã" aparece embaixo das atrasadas com as tarefas de amanhã (semanal só no dia certo).
- Perfil: o XP total é o mesmo de antes do patch.

### Parte 2: hub com módulos, Task e Meu dia fixo

1. **⚡ Hub do Routine:** igualzinho ao do Toba Bank. Abrir o Routine pelo portal agora mostra dois cards: **🔁 Rotina** (a tela de sempre, com Hoje / Tarefas / Histórico) e **🛠️ Task**. Embaixo, uma faixa **🆓 Seu tempo livre** com quanto sobra em cada dia da semana (tocar abre o Meu dia fixo).
   - Notificação, botão "Feito" e o atalho "Rotina de hoje" continuam abrindo direto a Rotina (até as notificações já agendadas no celular).
2. **🛠️ Task (tarefas não rotineiras):** pintar o quarto, fazer as marmitas, consertar a privada, ler um livro...
   - **+ Task:** nome, emoji, quanto tempo leva no total, se dá pra fazer em pedaços, se é pesada e prazo (opcional).
   - **Chute do Toba:** escreveu "Pintar o quarto"? Ele já chuta 6h e pesada. "Ler o livro" vira 8h em pedaços. É só ajustar se ele viajou.
   - Salvou, o Toba já abre a sugestão: **"OLHA PAI, MELHOR SÁBADO 24/10, TU TÁ COM 15H30 LIVRE"**, com mais duas opções (e quanto o dia já tem de sono, trampo, rotina...). Um toque em **Agendar** e pronto.
   - **Em pedaços:** ele monta o plano (pedaço pequeno em dia de trampo, até 3× maior na folga), evitando dia que já tem outra task.
   - **Não cabe inteira em nenhum dia?** Ele avisa e oferece **🍕 Fatiar em pedaços**.
   - Tocar numa task abre o detalhe: progresso, os dias marcados (✕ tira um dia), **escolher o dia na mão**, **🔮 Remarcar**, **✅ Já terminei** e **↩ Ainda não acabou**.
   - Furou o dia marcado? Ela volta pra **📥 Fila** com "🙈 furou dd/mm" e a Rotina avisa pra reagendar.
3. **Tasks na Rotina:** a tela de hoje ganhou **🛠️ Tasks de hoje** (marcar ali vale igual) e o **🌅 Amanhã** mostra as tasks de amanhã também.
4. **🕰️ Meu dia fixo** (⚙️ de qualquer página do Routine): 😴 sono, 💼 trabalho, 🚌 transporte (minutos de ida + volta, só nos dias presenciais) e **➕ Outro bloco fixo** (faculdade, inglês...). Cada um com seus dias da semana. Mais o **🚿 respiro** por dia (padrão 1h30, porque precisamos tomar banho). A folha mostra o livre de cada dia enquanto você mexe. Enquanto não salvar, o Toba usa um chute (9h–18h, dorme 23h30) e avisa.
5. **⏱️ Quanto tempo leva** nas tarefas da Rotina (opcional): entra na conta do tempo livre. Sem preencher, vale o chute pela dificuldade (☕ 15 min, 😐 30, 🧘 1h).
6. **XP da Task:** 20 XP por hora feita (mínimo 15, até 150 por vez), **fora** do teto de 250 XP/dia da rotina, pra pintar o quarto valer a pena. Aparece como "🛠️ Tasks" no extrato do Perfil.
7. **Conquistas novas:** 🛠️ Resolvedor (1ª task), 🧰 Faz-tudo (10), 🧱 Pedreiro de fim de semana (task de 4h+) e 🏗️ Empreiteiro (50, com título).

**Dados (parte 2):**
- Tudo no mesmo `TOBA_ROUTINE_DB`, só campos novos: `dayPlan` (Meu dia fixo), `oneoffs` (as tasks e seus dias) e `tasks[].minutes` (opcional). Formato no `CLAUDE.md`, seção 3.10.
- Banco ou backup antigo abre normal: ganha o dia fixo padrão e a lista de tasks vazia. `tasks` e `log` não mudaram, então o XP da rotina é o mesmo.
- O XP da task é calculado das sessões feitas (nada de XP gravado), igual ao resto.
- Arquivos novos → `sw.js` foi pra `toba-v13`. Não precisa de APK novo.

**Como testar (parte 2):**
- Portal → Toba Routine: abre o hub com Rotina, Task e o 🆓 Seu tempo livre.
- ⚙️ → 🕰️ Meu dia fixo: mudar o fim do trabalho, adicionar um bloco "Inglês" seg/qua 19h–21h, respiro 1h. Ver o livre por dia mudar na hora → Salvar.
- Task → + Task → "Pintar o quarto": o chute vira 6h pesada → Salvar e achar o dia → deve sugerir sábado ou domingo → Agendar.
- + Task → "Ler o livro": em pedaços → plano de vários dias → Agendar tudo.
- + Task de 20h sem pedaços → "não cabe" → 🍕 Fatiar em pedaços.
- Tocar numa task → Escolher o dia na mão = hoje → Rotina mostra em "🛠️ Tasks de hoje" → marcar → +XP e conquista Resolvedor.
- Abrir `TobaRoutine/TobaRoutine-Index.html?task=qualquer` → cai na Rotina (notificação antiga).
- Perfil → extrato com "🛠️ Tasks".

**Commit sugerido:** `v1.42 - Routine vira hub com Rotina e Task, dia fixo e sugestao do melhor dia, tarefa que expira e lista de amanha`

---

## v1.43 — Card do Toba Routine com números e nasce o Toba Kitchen 🍳

**Arquivos novos:** `TobaKitchen/TobaKitchen-Index.html` (NOVO), `TobaKitchen/TobaKitchen-Receitas.html` (NOVO), `TobaKitchen/TobaKitchen-Semana.html` (NOVO), `TobaKitchen/css/kitchen-base.css` (NOVO), `TobaKitchen/js/kitchen-recipes.js` (NOVO), `TobaKitchen/js/kitchen-core.js` (NOVO), `TobaKitchen/js/receitas.js` (NOVO), `TobaKitchen/js/semana.js` (NOVO)

**Arquivos alterados:** `index.html`, `assets/portal.js`, `assets/portal.css`, `TobaRoutine/js/routine-metrics.js`, `sw.js`, `CLAUDE.md`

### Parte 1: card do Toba Routine personalizável

1. **⚡ Card do Routine com números:** igual aos do Bank e do Health. ⚙️ do portal → 🧩 Configurador de cards → **⚡ Toba Routine**. Dá pra escolher:
   - ✅ **Tarefas de hoje** (feitas/total), 🆓 **Tempo livre na semana** (de hoje até domingo, o mesmo número do hub do Routine), 📆 **Tarefas feitas no mês** e 🛠️ **Tasks em aberto** (ligados por padrão).
   - ⏳ Tempo livre hoje, 📅 Feitas na semana, 🌅 Agendadas pra amanhã, ⏰ Atrasadas, 🔥 Maior sequência (e de qual tarefa) e ⭐ XP da rotina no mês (desligados, é só marcar).
   - 🔗 **Atalhos Rotina e Task** direto no card.
   - **Simples** volta pro card de antes (a frase + a linha "✅ 1/2 hoje · ⏰ atrasadas").
   - Quem não tem nenhuma tarefa vê a frase do card e os atalhos, sem um monte de zero.
2. **🎯 Toba Tasks (em breve) saiu do portal:** virou o módulo Task do Routine na v1.42, então o card fantasma foi de base. 🪦

### Parte 2: Toba Kitchen (beta) 🍳

O card do Kitchen no portal agora abre o app de verdade, com dois módulos:

1. **📖 Livro de Receitas**
   - **11 receitas de exemplo** já carregadas: ovos mexidos, tapioca de queijo, tapioca com abacate, panqueca de banana, frango com batata-doce, feijoada, onigiri de atum, espaguete alho e óleo, omelete, brigadeiro de panela e a mousse de maracujá do Maracujeba 🍮. As receitas ficam no código (a gente vai acrescentando por aqui).
   - **Categorias:** ☕ Café da manhã, 🍛 Almoço, 🥪 Lanche da tarde, 🌙 Janta e 🍰 Sobremesa (uma receita pode estar em mais de uma), mais a busca por nome ou ingrediente.
   - **🧺 O que tem aí na geladeira?** Marca os ingredientes que você tem e a aba **🍳 Dá pra fazer** responde: **"Você tem tudo pra fazer o Onigiri de atum!"**, **"Dá pra fazer, mas falta o tomate"** ou "faltam o tomate e a cebola". Sal, açúcar, óleo, azeite e temperos o Toba já conta que você tem. O que você marcou fica guardado.
   - **Receita aberta:** tempo, calorias por porção (estimativa), quantas vezes você já fez, **porções com − e +** (as quantidades se ajustam sozinhas), ingredientes com ✅ no que você tem em casa, dica e o passo a passo.
   - **👨‍🍳 Modo cozinha:** um passo por vez em letra grande, bolinhas de progresso (✓ nos feitos), **timer nos passos que pedem** ("Leva a batata pro forno · 30 min") que vibra e avisa quando acaba, 🧺 pra espiar os ingredientes no meio e **🔆 manter a tela acesa** (ligado por padrão, igual ao treino ao vivo). Minimizou ou fechou? Volta de onde parou.
   - **Contador:** terminou o modo cozinha (ou tocou em **✅ Já fiz (+1)**), conta mais uma. O hub mostra o placar: receitas feitas, no mês, quantas diferentes já testou e a mais feita.
2. **📅 Programação da Semana**
   - Semana de segunda a domingo (‹ › troca de semana). Em cada dia, **➕ Receita** e escolhe (dá pra filtrar por refeição). Também dá pra mandar uma receita pra semana direto do livro: **📅 Pôr na semana**.
   - Tocar numa receita do dia: trocar a refeição, porções, **👨‍🍳 Cozinhar agora** (abre o modo cozinha), **✅ Fiz / comi** (conta no contador e fica ✅ no dia), ver a receita ou tirar do dia.
   - **🛒 Lista de compras:** junta tudo da semana, soma as quantidades (2 receitas com alho = alho somado) e separa por seção do mercado (🥬 Hortifruti, 🥩 Açougue, 🧀 Frios, 🥫 Mercearia). O que você marcou no 🧺 vai pra **🏠 Já tem em casa** e os básicos pra **🧂 confere se tem**. Vai marcando no mercado (fica salvo por semana) e **📤 Mandar lista** manda pro WhatsApp (ou copia).
   - Cada dia mostra as calorias aproximadas (1 porção de cada receita).

**Dados:**
- Bancos/chaves novas, nada antigo mudou: `TOBA_KITCHEN_DB` (+ `TOBA_KITCHEN_DB_AUTO_BACKUP`) com `cooked`, `pantry`, `plan` e `shopping`; `toba_kitchen_live` (modo cozinha em andamento) e `toba_kitchen_prefs` (tela acesa); `toba_routine_card_config` (o card do Routine). Formatos no `CLAUDE.md` (3.2 e 3.11).
- As receitas não ficam no banco, só o id delas. Por isso o id de uma receita nunca muda.
- O ⚙️ do Kitchen tem backup só do Kitchen (`toba_kitchen_backup_*.json`) e "apagar tudo" (apaga contador/programação/despensa, as receitas continuam). O backup geral do portal já leva tudo.
- Kitchen ainda não dá XP nem fala com o Health/Routine (ver abaixo).
- Arquivos novos → `sw.js` foi pra `toba-v14`. Não precisa de APK novo (a tela acesa usa o `keepScreenOn` que o APK já tem).

**Como testar:**
- Portal: ⚙️ → 🧩 Configurador de cards → ⚡ Toba Routine → ligar tudo. Conferir "Livre semana" com a soma dos dias no hub do Routine (de hoje até domingo) e "Hoje" com a tela da Rotina. Trocar pra Simples = card de antes. O card "Toba Tasks" sumiu.
- Portal → 🍳 Toba Kitchen → 📖 Livro → 🧺 O que tem aí? → marcar ovo, queijo, tapioca → aba Dá pra fazer: tapioca de queijo em "Tem tudo", omelete com "falta o tomate".
- Abrir Frango com batata-doce → + porção (quantidades sobem) → 👨‍🍳 Modo cozinha → passo 3 → ▶️ Começar o timer → minimizar e voltar (continua contando) → ir até o fim → 🍽️ Terminei! → contador 1×.
- 📅 Semana → ➕ Receita na terça (feijoada) e na quarta (frango) → 🛒 Lista de compras → marcar uns itens → 📤 Mandar lista.
- Tocar na feijoada → ✅ Fiz / comi → fica ✅ e o hub conta +1.
- ⚙️ do Kitchen → baixar backup → apagar tudo → restaurar.

**Ideias pro próximo (não liguei, só deixei o dado pronto):** "comi" virar ✅ de uma tarefa do Routine e as calorias da receita (`kcal` por porção, já em todas) aparecerem no Toba Health ("EITA PAI, 480 KCAL, BORA TREINAR"); XP por receita feita; cadastrar receita pelo app.

**Commit sugerido:** `v1.43 - Card do Routine com numeros, Toba Kitchen com livro de receitas, modo cozinha e programacao da semana com lista de compras`

---

## v1.44 — Conquistas da 🍳 Cozinha no Perfil do jogador

**Arquivos alterados:** `assets/toba-player.js`, `assets/perfil.js`, `Toba-Perfil.html`, `index.html`, `TobaHealth/TobaHealth-Treinos.html`, `TobaRoutine/TobaRoutine-Rotina.html`, `TobaRoutine/TobaRoutine-Task.html`, `TobaKitchen/TobaKitchen-Receitas.html`, `TobaKitchen/TobaKitchen-Semana.html`, `TobaKitchen/js/kitchen-recipes.js`, `TobaKitchen/js/kitchen-core.js`, `TobaKitchen/js/receitas.js`, `TobaKitchen/js/semana.js`, `CLAUDE.md`

Categoria nova no Perfil com 14 conquistas (receita feita não dá XP sozinha; o XP vem da medalha: bronze 50, prata 150, ouro 400, lendária 1000):

| | Conquista | Como pega |
|---|---|---|
| 🍳 | Adeus, miojo (bronze) | 1ª receita feita |
| 👨‍🍳 | Cozinheiro de respeito (prata) | 10 receitas |
| 🔪 | Chef de cozinha (ouro) | 50 receitas · título **👨‍🍳 Chef Toba** |
| 🏆 | MasterChef Toba (lendária) | 100 receitas · título **🏆 MasterChef** |
| 📖 | Zerou o livro (ouro) | fez todas as receitas do livro. Chegou receita nova? Tranca de novo até fazer ela (DLC de comida) |
| 🍽️ | Cardápio completo (prata) | café, almoço, lanche, janta e sobremesa |
| 🌞 | Rango o dia inteiro (ouro) | café, almoço e janta no mesmo dia |
| 🩹 | Gambiarra gourmet (bronze) | fez faltando 1 ingrediente |
| 🧪 | Cientista maluco (ouro) | 10 gambiarras · título **🧪 Rei da Gambiarra** |
| 🏠 | Prato da casa (bronze) | a mesma receita 5 vezes |
| 🫘 | Paciência de feijoada (prata) | receita de 2 h ou mais |
| 🐜 | Formiga (bronze) | 5 sobremesas |
| 🌙 | Larica da madrugada (bronze) | terminou uma receita entre 0h e 5h |
| 📅 | Semana no controle (prata) | 7 receitas da programação feitas na mesma semana |

- **Gambiarra:** na hora de contar a receita (fim do modo cozinha, ✅ Já fiz ou ✅ Fiz / comi), se pelo seu 🧺 faltava exatamente 1 ingrediente o Toba pergunta: **"Pelo seu 🧺 faltava o tomate 🍅. Fez sem mesmo? 😂"** → **Fiz sem! 🩹** ou **Não, eu tinha**. Sem nada marcado no 🧺 ele não pergunta.
- Contou a receita = comemoração de conquista/level up ali mesmo no Kitchen.

**Dados:**
- Campo opcional novo `cooked[].improvised` (o ingrediente que faltou). Nada muda no Perfil (`TOBA_PLAYER_DB`): as conquistas são calculadas do `TOBA_KITCHEN_DB`, igual às outras. Desfazer uma receita tira a conquista (e o XP) se ela dependia dela.
- `kitchen-recipes.js` agora carrega em todas as páginas que mostram o Perfil (portal, Perfil, Treinos, Rotina, Task, Kitchen), pro XP bater em todas.
- Nenhum arquivo novo, então o `sw.js` não mudou. Não precisa de APK novo.

**Como testar:**
- Kitchen → 🧺 marcar só ovo e queijo → abrir Omelete → ✅ Já fiz → "faltava o tomate" → Fiz sem! → +XP com 🍳 Adeus, miojo e 🩹 Gambiarra gourmet.
- Perfil → categoria 🍳 Cozinha. O XP tem que ser o mesmo no portal, Perfil, Treinos, Rotina e Task.
- Desfazer a receita (📜 Vezes que você fez → ↩ Desfazer): as duas conquistas trancam de novo e o XP volta.

**Commit sugerido:** `v1.44 - Conquistas da cozinha no perfil do jogador (14 medalhas e a gambiarra gourmet)`

---

## v1.45 — Músculos que trabalham junto, Task com dia preferido e o "pisou na jaca" do Bank

**Arquivos alterados:** `TobaHealth/js/health-metrics.js`, `TobaHealth/js/hall.js`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/css/treinos.css`, `TobaRoutine/js/routine-metrics.js`, `TobaRoutine/js/routine-core.js`, `TobaRoutine/js/routine.js`, `TobaRoutine/js/task.js`, `TobaRoutine/TobaRoutine-Rotina.html`, `TobaRoutine/TobaRoutine-Task.html`, `TobaRoutine/css/routine-base.css`, `TobaBank/js/bank-metrics.js`, `TobaBank/js/gastos.js`, `TobaBank/TobaBank-Gastos.html`, `sw.js`, `CLAUDE.md`

1. **Mapa de calor mais esperto (ideia do Rafa com o Maracujeba):** nenhum exercício trabalha um músculo só. Os 68 exercícios do catálogo foram revisados e cada um divide o esforço entre os músculos que trabalham de verdade. Exemplos:
   - Flexão: 55% peito, 15% tríceps, 10% ombro, 10% costas, 10% abdômen (pedido era 60/20/20 com bíceps; ficou tríceps porque flexão empurra, quem puxa é o bíceps).
   - Agachamento: 50% quadríceps, 25% glúteo, 10% posterior, 5% panturrilha, 5% abdômen, 5% costas (lombar). **A parte de trás da coxa agora pega** 🦵
   - Barra fixa: 55% costas, 20% bíceps, 10% antebraço, 10% abdômen, 5% ombro. Supino: peito + tríceps + ombro. Terra: costas, posterior, glúteo, quadríceps e antebraço. E por aí vai.
2. **O peso conta, mas comparado com o normal:** cada exercício tem uma **carga normal** (o que um cara comum de 30 anos faz 10 reps: supino 60 kg, rosca 25 kg, leg press 150 kg, flexão ~48 kg do corpo...). Cada rep vale **sua carga ÷ carga normal** (entre 0,25× e 2×). Assim 200 kg no leg press (1,33×) e 25 kg na rosca (1×) pesam parecido, e a perna não fica vermelha só porque o número de kg é maior. Série sem carga anotada vale 0,5×. O ranking e o toque no músculo mostram **pts** (1 pt = 1 rep na carga normal).
3. **"?" do mapa reescrito:** explica a conta em 3 passos com o exemplo do leg press x rosca. O Hall do Herói (tronco x perna) usa a mesma conta.
4. **Task: "📅 Melhor fazer quando?"** no lugar do "É pesada": 🎲 Tanto faz, 🛋️ No FDS (fim de semana ou folga sem trampo) ou 💼 Na semana. O Toba sugere primeiro os dias que você escolheu; se não couber em nenhum, aí ele oferece os outros. Task antiga marcada como pesada vira "No FDS" sozinha.
5. **Rotina: tarefa de 0 min.** No "⏱️ Quanto tempo leva" tem "0 min (não ocupa tempo)", pra coisa tipo dormir às 23h, tomar remédio... Ela não come o tempo livre do dia na hora do Toba encaixar uma task.
6. **Bank: "Eita pai, pisou na jaca."** Com o 💵 Livre hoje negativo aparece uma faixa vermelha em cima do card: "Economize por X dias pra voltar pro verdin 🤑". X = quantos dias seguidos **sem gastar nada** (a partir de amanhã) até o Livre ficar positivo, pela mesma regra da dívida que passa de um dia pro outro. Se nem zerando dá antes do mês acabar (a dívida some na virada), a faixa avisa que só a virada salva.

**Dados:**
- Mapa de calor e Bank: só cálculo, nada gravado. O XP do Perfil não muda (ele não usa o mapa).
- `TOBA_ROUTINE_DB`: campo novo opcional `oneoffs[].when` (`"any"`, `"weekend"`, `"weekday"`); sem ele, vale `heavy` (pesada = `"weekend"`). Ao salvar, `heavy` acompanha (`when === "weekend"`) pra leitor antigo. `tasks[].minutes` agora aceita `0` (não ocupa tempo); ausente continua sendo o chute pela dificuldade. Backups antigos continuam importando igual.
- `sw.js` VERSION `toba-v15` (nenhum arquivo novo, só pra renovar o cache). Não precisa de APK novo.

**Como testar:**
- Treinos → abrir um treino do Saitama → "🔥 Músculos do treino": costas, posterior e glúteo agora pintam; tocar no posterior mostra os pts. Um treino de força com leg press 200 kg + rosca 25 kg fica com quadríceps e bíceps parecidos. Tocar no **?** mostra a conta com exemplo.
- Task → ➕ → escolher 💼 Na semana → Salvar e achar o dia: as opções são dias de semana. Com 🛋️ No FDS, sábado/domingo primeiro. Escrever "Faxina geral" no nome já marca No FDS.
- Rotina → ✏️ numa tarefa → ⏱️ "0 min (não ocupa tempo)" → salvar e reabrir: continua 0. O tempo livre do hub não muda com ela.
- Gastos → lançar um gasto maior que o Livre hoje → aparece a faixa com X dias. Exemplo: Livre de R$ 100/dia e gastou R$ 250 hoje = -R$ 150 → 2 dias. Apagar o gasto → a faixa some. Card do portal continua batendo.

**Commit sugerido:** `v1.45 - Mapa de calor com esforco dividido entre musculos e peso levantado, task com dia preferido, tarefa de 0 min e aviso do pisou na jaca no Gastos`

---

## v1.46 — Agenda do Toba Routine: o seu dia em 24 h, estilo Outlook 📅

**Arquivos novos/alterados:** `TobaRoutine/TobaRoutine-Agenda.html` (NOVO), `TobaRoutine/js/agenda.js` (NOVO), `TobaRoutine/css/agenda.css` (NOVO), `TobaRoutine/js/routine-metrics.js`, `TobaRoutine/TobaRoutine-Index.html`, `TobaRoutine/css/routine-base.css`, `sw.js`, `CLAUDE.md`

1. **Tocar no "🆓 Seu tempo livre" agora abre a Agenda** (antes abria o Meu dia fixo, que já mora na ⚙️). Tocar no card abre a semana; tocar num dia (Qua, Sáb...) abre direto aquele dia.
2. **Visão 📆 Dia e 🗓️ Semana**, com as 24 horas: sono (listrado roxo, com "⏰ acorda" e "😴 dorme"), trabalho, transporte, blocos fixos (curso, faculdade...) e as rotinas com horário no horário delas, lado a lado quando batem. Linha vermelha marca a hora de agora. ‹ › ou arrastar o dedo pro lado troca de dia/semana; o botão **Hoje** volta.
3. **Rotina sem horário e sessão de task** não têm hora marcada, então ficam na faixa **📌 Sem horário** no topo do dia (tipo o "dia inteiro" do Outlook). Na semana elas aparecem como emojis em cima de cada dia. O Toba não inventa hora que você não marcou: se quiser ela no calendário, é só pôr horário na tarefa.
4. **Transporte** não tem horário no dia fixo, só minutos: a agenda põe metade antes do trabalho (ida) e metade depois (volta). Dia sem trabalho = vai pro "sem horário".
5. **Brechas verdes:** o que sobra sem nada marcado aparece pontilhado em verde ("🆓 brecha de 2h"). O "🆓 Livre" lá em cima é o mesmo número do Hub, que também desconta o sem horário e o respiro, por isso pode ser menor que a soma das brechas.
6. Feita ✅ fica apagadinha; a que passou do dia sem fazer fica com borda vermelha 🙈. Configurar o dia continua na ⚙️ → Meu dia fixo (também dá pra abrir pela ⚙️ da Agenda).

**Dados:** Nenhuma mudança no banco. A Agenda só lê o `TOBA_ROUTINE_DB` (função nova `calcRoutineDayAgenda` em routine-metrics.js, só cálculo). `sw.js` VERSION `toba-v16` (3 arquivos novos no PRECACHE). Não precisa de APK novo.

**Como testar:**
- Hub do Routine → tocar no texto do card "Seu tempo livre" → abre a Semana desta semana, com hoje em amarelo e a linha vermelha na hora atual.
- Voltar → tocar em "Sáb" → abre o Dia do sábado. ‹ › troca de dia; "Hoje" volta pra hoje.
- Uma rotina com horário (ex.: 19h30, 1 h) aparece no bloco certo; uma sem horário aparece no "📌 Sem horário". Marcar como feita na Rotina e voltar: fica com ✅.
- ⚙️ → Meu dia fixo → mudar a hora de dormir → salvar: a agenda redesenha na hora.
- Testar em 360px e 384px: nada passa da tela.
- Rotina (com alguma atrasada): deslizar o card pra esquerda até o meio → ele sai e aparece "Desfazer". Tocar em Desfazer → volta. Deslizar só um pouquinho e soltar → volta pro lugar sem marcar. Rolar a tela passando o dedo em cima dos cards → rola normal.
- Rotina → 📜 Histórico → o dia mostra 🗑️ na tarefa descartada → tocar → "Trazer de volta?" → ela volta pras atrasadas.
- APK 1.3: tarefa com horário que já notificou ontem → no app, deslizar ela pra lá → a notificação some da barra e não vem mais cobrança dela.
- APK (qualquer versão) → fazer uma compra no cartão → a notificação "💸" do Toba aparece → tocar → abre o Gastos com a lista de pendentes. Nada entrou no mês ainda. Lançar uma (mudando a categoria), descartar outra, conferir que o card some quando acabar.
- Portal (no app): com pendente, aparece a faixa amarela; tocar abre a lista.
- **Simular notificação repetida/antiga (APK 1.3):** com uma compra recente na barra do celular, reinicie o celular (o Samsung Wallet costuma postar de novo o que estava na barra). No 🧾 O que o Toba leu, a repetição aparece como "♻️ Repetida · Mesma notificação de novo" e não vira pendente. Pra ver uma "antiga": desligue a internet/modo avião, faça um pagamento por aproximação, espere 6 h e reconecte; ela chega nas pendentes com "⏳". Dá pra mandar o log pelo 📋 Copiar tudo.

**Commit sugerido:** `v1.46 - Agenda do Toba Routine com visao de dia e semana em 24h, aberta pelo tempo livre do hub`

---

## v1.47 — Hall dos Heróis no Perfil, marcos novos, manadas, exercícios novos, atrasada deslizando pro lixo e compras do cartão pra aprovar

**Arquivos novos/alterados:** `TobaHealth/js/hall-shared.js` (NOVO), `assets/perfil-hall.js` (NOVO), `TobaHealth/js/health-metrics.js`, `TobaHealth/js/hall.js`, `TobaHealth/js/treinos.js`, `TobaHealth/js/forca.js`, `TobaHealth/js/sessao.js`, `TobaHealth/TobaHealth-Treinos.html`, `TobaHealth/css/treinos.css`, `Toba-Perfil.html`, `assets/perfil.js`, `assets/perfil.css`, `assets/toba-player.js`, `assets/toba-player.css`, `assets/toba-common.css`, `sw.js`, `CLAUDE.md`, `TobaRoutine/js/routine.js`, `TobaRoutine/js/routine-core.js`, `TobaRoutine/js/routine-metrics.js`, `TobaRoutine/js/routine-alerts.js`, `TobaRoutine/js/agenda.js`, `TobaRoutine/css/routine-base.css`, `TobaBank/js/gastos.js`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/css/gastos.css`, `index.html`, `assets/portal.js`, `assets/portal.css`, `TobaAndroid/app/src/main/java/br/com/toba/app/TobaBridge.java`, `TobaAndroid/app/src/main/java/br/com/toba/app/PurchaseListener.java`, `TobaAndroid/app/src/main/java/br/com/toba/app/TobaStore.java`, `TobaAndroid/app/src/main/java/br/com/toba/app/Notifier.java`, `TobaAndroid/app/build.gradle`

**🏋️ Exercícios novos**
1. **Cadeira adutora** (fecha as pernas, parte de dentro da coxa), **Leg press 90°** (o vertical) e **Leg press 180°** (o horizontal). Os três já entram certinho no mapa de calor e no peso levantado.
2. **A adutora aparece em dois lugares:** em Glúteos, do lado da abdutora, e em Quadríceps. No mapa de calor ela pinta a coxa (frente e trás) e um pouco o glúteo. O boneco não ganhou peça nova, então "Corpo completo" e "Não pula perna" continuam iguais.
3. **Leg press 90° e 180°:** você empurra o peso todo (no 45° a rampa alivia uns 30%), então 100 kg neles já é carga "normal" de esforço, contra 150 kg no 45°.

**🏆 Hall dos Heróis mudou pro Perfil do jogador**
4. **Agora mora no 🎮 Perfil**, logo abaixo do seu nível. No Treinos saiu o Hall da vida toda. O Hall de cada mês (no 📜 Histórico mensal) continua lá, igualzinho.
5. **Cara nova:** vitrine dourada com o peso levantado da vida em número gigante ("291 t = 1 Airbus A380 🛬"), uma barra do marco atual até o próximo e "faltam X t pro próximo". Embaixo, 4 cards: 🌍 Distância, 🔥 Energia (em coxinhas, rodízios...), 👊 Saitama e 🔥 Mapa de calor.
6. **Toque num card e abre a página dele:** número que conta do zero, o **🎯 Próximo marco** pulsando e **🪜 a escada toda** (o que você já levantou aceso com "3×", o próximo piscando e os bem distantes recolhidos em "🔒 Mais N marcos lá em cima"). O ‹ e o voltar do celular voltam pro Perfil.
7. **Marco batido nos últimos 7 dias** ganha o selo brilhante **NOVO!**. Animações desligam sozinhas se o celular estiver com "reduzir movimento".

**💪 10 marcos novos de peso levantado** (com o peso real de cada coisa)
8. 🪖 Tanque Leopard 2 (62 t), 🚛 Rodotrem carregado (74 t), 🐋 Baleia-azul (110 t), 🛬 Airbus A380 vazio (277 t), 🛫 Boeing 747 lotado (397 t), 🚀 Foguete Falcon 9 (549 t), 🚄 Trem-bala japonês (715 t), ⛏️ BelAZ, o maior caminhão do mundo carregado (810 t), 🐉 Foguete Longa Marcha 5 (870 t) e 🗿 Pedra da Grávida de Baalbek (1.000 t). Cada um vira conquista: os 3 primeiros são prata (+150 XP) e o resto ouro (+400). A baleia libera o avatar 🐋. Nada de argentinossauro: aqui é Brasil.

**🐘 Conquistas novas: Manadas & multidões** (categoria nova no Perfil)
9. 13 conquistas de coisa pesada em bando, com a conta na descrição: 🐈 Gateiro profissional (50 gatos), 🐕 Abrigo de caramelos (100), 🦁 Bando do Rei Leão (20), 🚇 Vagão do metrô às 18h (300 pessoas), 🚗 Estacionamento de Fuscas (50), 🐘 Manada de elefantes (10), 🐂 Passando a boiada (300 bois), 🛶 Arca de Noé (2 de cada bicho), 🐳 Família de baleias (5), 🚌 Garagem de ônibus (50), 🪖 Desfile de 7 de Setembro (12 tanques), 🏟️ Maracanã lotado (78.838 torcedores) e ✈️ Pátio de aeroporto (20 jumbos lotados).
10. Bloqueadas aparecem como **❓ ???**, mas com dica e barra de progresso. Valem metade do XP normal (bronze 25, prata 75, ouro 200, lendária 500), porque é o mesmo peso que já dá os marcos.
11. **Recompensas:** avatar 🐂 (boiada), moldura nova **Arquibancada** verde e amarela (Maracanã) e os títulos 🐘 Dono da Manada, 🛶 Capitão Noé, 🪖 General do Supino, 🏟️ Levanta Arquibancada e ✈️ Controlador de Pátio.
12. Tudo vale pros treinos que você já registrou: se já levantou o suficiente, a medalha cai na hora em que abrir o app.

**🗑️ Rotina: deixar pra lá uma atrasada**
13. **Deslize o card da atrasada pro lado** (dedo ou mouse): o fundo vermelho mostra "🗑️ Deixar pra lá" e, passando de um terço da largura, o card sai voando. Soltou antes? Ele volta pro lugar. Rolar a tela pra cima e pra baixo continua normal, e o deslize nunca marca a tarefa como feita sem querer.
14. Some **só aquela ocorrência**: a tarefa continua na rotina e cai normal nos próximos dias. Sai também do "⏰ X atrasadas" do topo e do card do Routine no portal.
15. **Desfazer** numa barrinha embaixo por 5 segundos. Depois disso, no **📜 Histórico** toque no 🗑️ do dia pra trazer de volta.
16. Não dá XP e **quebra o 🔥 da tarefa**, igual a não fazer.
17. As cobranças que ainda iam tocar pra ela são canceladas. No APK novo (1.3), a notificação que já estava na barra do celular também some.
18. **Histórico novo:** nos "📅 Últimos 14 dias" cada tarefa aparece com a situação: ✅ feita, ⏰ atrasada, ⌛ expirou (as "só no dia"), 🗑️ deixou pra lá e 💤 perdida (passou dos 7 dias sem fazer). Na Agenda, a deixada pra lá aparece com 🗑️ em vez de 🙈.

**🤖 Bank: compras do cartão agora esperam sua aprovação**
19. **O "bug" das compras de vários dias:** eram compras de verdade. O app lê a notificação na hora, mas só lançava quando você abria o Gastos; ficou uns dias sem abrir, entrou tudo junto. Mesmo assim, fechamos uma brecha: se o Samsung Wallet (ou outro app) reenviar uma notificação antiga, ela não vira compra nova (APK 1.3).
20. **Nada entra sozinho no mês.** As compras lidas ficam num card amarelo no topo do Gastos: "🤖 3 compras do cartão esperando você". Tocar abre a lista com valor, loja, data, app de origem, categoria sugerida e o texto original da notificação.
21. **✅ Lançar** abre o formulário já preenchido, pra você mudar descrição, valor, categoria ou data antes de salvar. **❌ Descartar** tira da lista e ela não volta mais. Com 2 ou mais, aparece **✅ Lançar todas**.
22. **Avisos:** "⚠️ Parece repetida" quando já tem gasto ou outra pendente com o mesmo valor, loja e dia (só avisa, você decide). "⏳ Notificação antiga reenviada" quando o app mandou a notificação mais de 6 h depois da compra.
23. **No portal** (app Android) aparece a faixa "🤖 N compras do cartão esperando aprovação", que leva direto pra lista. Tocar na notificação "💸" do Toba também abre a lista.
24. Fechou o app no meio? Nada se perde: a compra só sai da fila do celular depois que o gasto foi gravado ou você descartou. Gastos que já tinham entrado sozinhos antes continuam como estão.
25. **🧾 O que o Toba leu** (Gastos → ⚙️) ganhou o botão **📋 Copiar tudo**, com o texto bruto de cada notificação, pra mandar quando algo vier estranho.

**Dados:**
- `TOBA_ROUTINE_DB`: campo novo opcional `skipped: [{ id, taskId, date, at }]` (as atrasadas deixadas pra lá). Banco e backup antigos abrem com a lista vazia. Nada mais muda na rotina: o XP continua saindo só do log.
- Os exercícios novos são só catálogo, com IDs novos (`cadeira-adutora`, `leg-press-90`, `leg-press-180`).
- Hall, marcos e conquistas são só cálculo. O XP vem dos treinos, como sempre. As conquistas que você já tinha **continuam com o mesmo nível e XP**: o nível delas passou a ser fixado pelo id, então marco novo no meio da lista não mexe nas antigas.
- `sw.js` VERSION `toba-v17` (2 arquivos novos no PRECACHE).
- `TOBA_BANK_DB`: nenhuma mudança. As compras pendentes moram na fila do app Android (como antes); o gasto lançado continua levando `notifId`.
- **APK novo (1.3, versionCode 4)**: tira da barra a notificação de uma atrasada deixada pra lá (`clearTaskNotice`), dá id estável pras compras lidas (a mesma notificação reenviada não vira compra de novo), usa a hora original da compra como data, marca as reenviadas com atraso e abre a lista de pendentes ao tocar na notificação "💸". **Com o APK 1.2 o site novo funciona**: as compras vão pras pendentes do mesmo jeito, só sem essas proteções. E o APK 1.3 com um site antigo em cache continua lançando como antes, sem quebrar.

**Como testar:**
- Treinos → Treino de Força → Montar treino → Glúteos: tem "Cadeira adutora". Em Quadríceps: adutora, "Leg press 90°" e "Leg press 180° (horizontal)". No treino ao vivo (➕ exercício), a mesma coisa.
- Treinos: o botão "🏆 Hall do Herói" sumiu. 📜 Histórico mensal → tocar num mês → o Hall do mês e as páginas dele (energia, distância, peso, Saitama) continuam abrindo.
- Perfil → 🏆 Hall dos Heróis: os números contam do zero, a barra enche. Tocar na vitrine abre a escada do peso, e no fim as 🐘 Manadas. Tocar numa manada abre a medalha (bloqueada = ???). ‹ volta pro Perfil, e o voltar do celular também.
- Perfil → Conquistas: a categoria "🐘 Manadas & multidões" aparece. O XP total das medalhas antigas não mudou (compare a aba "📜 De onde veio seu XP" com antes).
- Testar em 360px e 384px: nada passa da tela.

**Commit sugerido:** `v1.47 - Hall dos Herois no Perfil, 10 marcos novos de peso, manadas e multidoes, adutora e leg press 90 e 180, deslizar pra deixar atrasada pra la, compras do cartao pendentes pra aprovar`

---

## v1.48 — Semana copiada, receitas do Bertoba, card do Routine com tarefas e filtro de categoria no Gastos

**Arquivos alterados:** `TobaKitchen/TobaKitchen-Semana.html`, `TobaKitchen/js/semana.js`, `TobaKitchen/js/receitas.js`, `TobaKitchen/js/kitchen-recipes.js`, `TobaKitchen/css/kitchen-base.css`, `Toba-Perfil.html`, `assets/perfil.css`, `index.html`, `assets/portal.js`, `assets/portal.css`, `TobaRoutine/js/routine-metrics.js`, `TobaBank/TobaBank-Gastos.html`, `TobaBank/js/gastos.js`, `TobaBank/css/gastos.css`, `CLAUDE.md`

1. **📋 Copiar da semana anterior (Kitchen → Semana):** botão novo embaixo dos números. Copia as receitas da semana passada pro mesmo dia, mesma refeição e mesmas porções (o café de sempre, sem programar tudo de novo). O que já está igual nesta semana é pulado, então tocar duas vezes não duplica. Se a semana já tem coisa, ele pergunta antes.
2. **Folha "➕ Receita" não fecha mais a cada receita:** toca no onigiri, no café, no que quiser, e ela continua aberta até o ✕. As que já estão no dia ficam **contornadas de amarelo** com "✓ no dia: 🍛 Almoço". Tocou numa amarela? Tira do dia (a que já foi feita fica, por causa do contador). Aparece um aviso rápido a cada toque.
3. **Autor das receitas:** cada receita mostra quem escreveu (🤖 Cloba ou 👨‍🍳 Bertoba), na lista e embaixo do nome da receita. Dá pra buscar "bertoba" no livro.
4. **Tapioca proteica de queijo (do Bertoba):** 100 g de goma + 1 ovo virando massaroca, frigideira untada com um fio de óleo, timer de 2 min, vira, mais 1,5 min, RANGO. Com 30 g de queijo na hora de virar (QUEIJO, sim). 🧀 Mesma receita de antes: contador e programação continuam valendo.
5. **Panqueca de banana com aveia e whey (do Bertoba):** igual à de antes + 1 scoop de whey de chocolate, água se ficar viscosa demais e a manha de tirar do fogo por uns segundos (ou usar panela boa) até conseguir virar. Ingrediente novo: Whey de chocolate.
6. **⚙️ Configurações do Perfil arrumada:** meta do streak, som e vibrar agora são linhas iguais, com o controle alinhado na direita (antes os quadradinhos ficavam tortos colados no texto).
7. **Portal sem "Beta":** saiu o selo dos cards do Health, Routine e Kitchen.
8. **Tarefas de hoje no card do Routine:** no configurador de cards (⚡ Card do Toba Routine) tem a opção nova **📋 Tarefas de hoje no card (marca dali)**. Ligada, o card lista as tarefas do dia com o horário; tocar marca como feita (com o XP e a comemoração de sempre) e tocar de novo desmarca. Vale no card simples e no com números. Mais de 8 tarefas: mostra as que faltam primeiro e "+ N na Rotina".
9. **Filtro por categoria no Gastos:** toca numa categoria em "📊 Gastos por categoria" (ex: ⛽ Combustível) e os "💸 Lançamentos do mês" mostram só ela, com o total e a contagem (2/30). As outras categorias ficam apagadinhas. Toca de novo na mesma ou em "✕ Limpar" pra ver tudo.

**Dados:**
- `TOBA_KITCHEN_DB`: nenhuma mudança de formato. Copiar a semana só cria entradas novas em `plan` (id novo). Ids das receitas não mudaram (`tapioca-queijo`, `panqueca-banana`); ingrediente novo `whey-chocolate` e unidade nova `scoop` só no catálogo. Campo novo opcional `author` nas receitas do código (sem ele = Cloba).
- `toba_routine_card_config`: campo novo opcional `todayList` (ausente = desligado).
- `TOBA_ROUTINE_DB`: sem campo novo. O card do portal grava no `log` do mesmo jeito da Rotina, copiando o valor anterior no auto-backup antes; se o banco estiver ilegível, não grava nada.
- `TOBA_BANK_DB`: nenhuma mudança (o filtro é só de tela). `sw.js`: sem arquivo novo, VERSION continua `toba-v17`.

**Como testar:**
- Kitchen → Semana: com receitas na semana passada, aparece "📋 Copiar da semana anterior (N)". Toca e confere os dias. Toca "➕ Receita", escolhe 2 ou 3: a folha fica aberta, as escolhidas ficam amarelas; toca numa amarela e ela sai.
- Livro de receitas: tapioca e panqueca com "👨‍🍳 Bertoba"; as outras com "🤖 Cloba". Modo cozinha da tapioca: o passo 4 tem timer de 1:30.
- Perfil → ⚙️: as três linhas alinhadas.
- Portal → ⚙️ → Configurar cards → Routine → ligar "📋 Tarefas de hoje". Marcar uma no card, abrir a Rotina e ver que ficou ✅ lá também; desmarcar.
- Gastos: tocar em uma categoria, conferir a lista filtrada e o "✕ Limpar".
- Testar em 360px e 384px.

**Commit sugerido:** `v1.48 - Copiar semana anterior e folha de receitas que fica aberta no Kitchen, receitas do Bertoba, configuracoes do perfil alinhadas, tarefas de hoje no card do Routine e filtro por categoria no Gastos`

---

## v1.49 — 📅 Toba Calendar no Routine, rotina que conclui e edita pela Agenda e filtro do Gastos mais claro

**Arquivos novos/alterados:** `TobaRoutine/TobaRoutine-Calendar.html` (NOVO), `TobaRoutine/js/calendar.js` (NOVO), `TobaRoutine/css/calendar.css` (NOVO), `TobaRoutine/js/routine-events.js` (NOVO), `TobaRoutine/js/routine-task-sheet.js` (NOVO), `TobaRoutine/TobaRoutine-Index.html`, `TobaRoutine/TobaRoutine-Agenda.html`, `TobaRoutine/TobaRoutine-Rotina.html`, `TobaRoutine/js/agenda.js`, `TobaRoutine/js/routine.js`, `TobaRoutine/js/routine-core.js`, `TobaRoutine/js/routine-metrics.js`, `TobaRoutine/js/routine-alerts.js`, `TobaRoutine/css/agenda.css`, `TobaRoutine/css/routine-base.css`, `TobaBank/js/gastos.js`, `TobaBank/css/gastos.css`, `sw.js`, `CLAUDE.md`

1. **📅 Calendar (módulo novo no Routine):** pra coisa que tem dia marcado mas não é rotina nem task: a cirurgia do dia 04/11, o churrasco do Maracujeba, a viagem. Card novo no Hub (mostra o próximo: "🔜 🏥 Cirurgia em 13 dias"). A página tem o mês em grade (os dias com evento mostram o emoji, ‹ › ou arrastar troca de mês), a lista do dia tocado com "➕ Evento nesse dia", **🔜 Próximos** e **📜 Já foi**.
2. **Evento com hora ou dia inteiro:** com hora (começa/termina; terminou antes de começar = passou da meia-noite, tipo churras das 14h às 2h) ou **🌞 Dia inteiro**, que pode durar vários dias ("Até"). Escreveu "cirurgia", "churrasco", "dentista", "aniversário"... o Toba chuta o emoji. Tem 📝 observação (ex: jejum de 8 h).
3. **🚫 Dia tomado:** evento de dia inteiro pode marcar o dia como tomado (cirurgia, viagem e mudança já vêm marcados). Nesse dia o livre fica zerado e o Toba **não sugere task** pra ele.
4. **Na Agenda:** evento com hora aparece rosa no horário dele (tocar abre pra editar); dia inteiro fica na faixa **📅 Eventos** no topo do dia (na semana, o emoji em cima do dia). Botão **+ Evento** na Agenda já nasce no dia que está na tela. O tempo livre do Hub e da Agenda desconta os eventos com hora.
5. **🔔 Avisos:** véspera às 20h ("Amanhã: 🏥 Cirurgia") e no dia 1 h antes (ou às 8h, se for dia inteiro), com a observação junto. No app Android vão com os avisos da rotina (o "✅ Feito" ali vale como "ciente"); no navegador, só com o Toba aberto. Dá pra desligar por evento.
6. **Rotina clicável na Agenda:** na visão Dia, tocar numa tarefa da rotina (a plantinha com horário errado, por exemplo) abre a bolinha pra **concluir** ali mesmo (XP e comemoração de sempre; tocar de novo desmarca) e o **✏️ Editar tarefa**, a mesma folha da Rotina. Atrasada vale metade, igual na Rotina; dia que ainda não chegou não deixa marcar. Na Semana, tocar no dia abre o Dia.
7. **Filtro de categoria do Gastos:** agora a faixa mostra em cima a categoria (⛽ Combustível) e embaixo "R$ 501,41 em 2 compras". O botão virou **✕ Limpar filtro** (não parece mais que vai apagar os gastos 😅).

**Dados:**
- `TOBA_ROUTINE_DB`: campo novo opcional `events` (lista de eventos: nome, emoji, dia, hora/fim ou dia inteiro com "até", dia tomado, aviso, observação). Banco e backup antigos sem ele abrem com a lista vazia (`normalizeRoutineEvents`). Eventos não dão XP: Perfil e card do portal não mudam (só o "livre" do card, que agora desconta evento com hora).
- Marcar pela Agenda grava no `log` do mesmo jeito da Rotina (a regra foi pra uma função só, `routineToggleOccurrence`). A folha de editar tarefa saiu do HTML da Rotina e agora é posta pelo JS (`routine-task-sheet.js`), igualzinha.
- `TOBA_BANK_DB`: nenhuma mudança (o filtro é só tela).
- `sw.js` VERSION `toba-v18` (5 arquivos novos no PRECACHE). Não precisa de APK novo.

**Como testar:**
- Hub do Routine → card 📅 Calendar → + Evento → "Cirurgia no joelho" (vira 🏥 e já marca 🚫 Dia tomado com 🌞 Dia inteiro) → dia 04/11 → Salvar. O dia aparece com 🏥 no mês e em 🔜 Próximos; o Hub mostra a contagem.
- + Evento → "Churrasco" no sábado, 14h às 02h → aparece rosa na Agenda do sábado e um pedacinho no domingo até 02h. O livre do sábado no Hub diminui.
- Task → uma task inteira grande → 🔮 Dia? → o dia da cirurgia nunca aparece.
- Agenda → Dia de hoje → tocar numa rotina com horário → bolinha marca (XP sobe), tocar de novo desmarca → ✏️ Editar tarefa → muda o horário → salva e ela pula pro horário novo. Na Rotina, a mesma tarefa aparece feita/desfeita igual.
- Rotina → tocar numa tarefa → a folha de editar continua igual (salvar, apagar, 📅 Pôr na agenda do celular).
- Agenda → tocar no evento → editar/apagar.
- Gastos → tocar numa categoria → faixa com "⛽ Combustível" / "R$ X em N compras" e "✕ Limpar filtro".
- ⚙️ → baixar backup do Routine → Apagar tudo → importar → eventos voltam. Importar um backup antigo (sem eventos) → abre normal.
- Testar em 360px e 384px.

**Commit sugerido:** `v1.49 - Toba Calendar no Routine (eventos com dia marcado, dia tomado, avisos), rotina que conclui e edita pela Agenda e filtro de categoria do Gastos mais claro`

---

## v1.50 — ⏭ Nova série automática, careca que confere o dia todo e panqueca com avocado

**Arquivos alterados:** `TobaHealth/js/sessao.js`, `TobaHealth/js/sessao-saitama.js`, `TobaHealth/css/sessao.css`, `TobaHealth/TobaHealth-Treinos.html`, `assets/toba-player.js`, `TobaKitchen/js/kitchen-recipes.js`, `CLAUDE.md`

1. **⏭ Nova série automática:** caixinha nova no timer de descanso do treino ao vivo (força e Saitama), com explicação curta. Ligada, quando o timer zera o descanso fecha sozinho e já é a próxima série: sem ficar contando "perdidos no feed" e sem precisar tocar em "Bora pra próxima série". Feita pra quem já começa nos 3 segundos finais 😎. Vem desligada; a escolha fica guardada no aparelho.
2. **👊 Conquistas do careca olham o dia:** "Dia do careca" agora vale com 100 flexões, 100 abdominais e 100 agachamentos **no mesmo dia** (pode ser em mais de um treino do Saitama). "Careca completo" pede isso + **10 km de Caminhada / Corrida no mesmo dia** (treinos de caminhada/corrida do dia somam). Km antigos que já estavam dentro de um Saitama continuam contando, então nenhuma conquista some.
3. **Fim do treino do Saitama sem os km:** a folha de finalizar não pergunta mais "correu / caminhou?". No lugar, um aviso: a caminhada/corrida entra como **exercício próprio** (➕ Registrar treino › 🚶 Caminhada / Corrida, que tem distância, tempo e calorias) e vale pro Careca completo no mesmo dia. O formulário manual do Saitama continua com o campo de km (pra editar treinos antigos).
4. **🥞 Panqueca do Bertoba com avocado:** passo novo no fim: meio avocado amassado no garfo com uma pitadinha de sal, por cima da panqueca pronta. Ingrediente novo "Avocado" (entra na lista de compras e no 🧺). kcal da porção foi de ~450 pra ~570.

**Dados:**
- `toba_health_live_prefs`: campo novo opcional `autoNext` (ausente = desligado). Nada muda no `TOBA_HEALTH_DB`.
- Treino do Saitama feito ao vivo grava `distanceKm: null` (os outros campos iguais). Treinos antigos não mudam.
- Kitchen: ingrediente novo `avocado`; o id da receita (`panqueca-banana`) e os outros ids não mudaram. O passo novo entrou no fim, então um modo cozinha aberto não se perde.
- XP/conquistas continuam recalculados na hora (nada gravado); só a regra do careca mudou de "mesmo treino" pra "mesmo dia".
- `sw.js` sem mudança (nenhum arquivo novo). Não precisa de APK novo.

**Como testar:**
- Treinos → ▶ Treino ao vivo → Saitama → toca num quadrado (descanso começa) → marca **⏭ Nova série automática** no timer → no −15s até zerar: o painel fecha sozinho com "⏭ Próxima leva! 👊". Desmarca e vê que volta a esperar o toque. Mesmo teste num treino de força (✓ numa série).
- Finalizar o Saitama → aparece o aviso 🚶 no lugar do campo de km; salvar sem nenhuma rep pede pelo menos uma leva.
- Num dia de teste: Saitama com 100/100/100 → ganha "Dia do careca". Registrar 🚶 Caminhada / Corrida de 10 km no mesmo dia → "Careca completo" 🦲 aparece no Perfil. Com 6 km + 4 km no mesmo dia também vale.
- Kitchen → Receitas → Panqueca de banana → avocado e pitada de sal nos ingredientes e o passo final. Semana com a panqueca → avocado na lista de compras (Hortifruti).
- Testar em 360px e 384px (o timer ficou um pouco mais alto).

**Commit sugerido:** `v1.50 - Nova serie automatica no descanso, conquistas do Saitama pelo dia com caminhada/corrida de 10 km e avocado na panqueca do Bertoba`

---

## v1.51 — 🏁 Toba Racing (combustível e km/l), balança que pula de campo certo, Amigo da balança destravado, média no filtro do Gastos e receitas em ordem alfabética

**Arquivos novos:** `TobaRacing/TobaRacing-Index.html`, `TobaRacing/TobaRacing-Combustivel.html`, `TobaRacing/css/racing-base.css`, `TobaRacing/js/racing-metrics.js`, `TobaRacing/js/racing-core.js`, `TobaRacing/js/combustivel.js`

**Arquivos alterados:** `index.html`, `assets/portal.js`, `assets/toba-common.js`, `assets/toba-player.js`, `sw.js`, `TobaHealth/js/health-core.js`, `TobaHealth/js/health-metrics.js`, `TobaHealth/js/pesagem.js`, `TobaHealth/TobaHealth-Pesagem.html`, `TobaHealth/css/pesagem.css`, `TobaBank/js/gastos.js`, `TobaBank/css/gastos.css`, `TobaKitchen/js/kitchen-recipes.js`, `TobaKitchen/js/receitas.js`, `TobaKitchen/js/semana.js`, `CLAUDE.md`

1. **🏁 Toba Racing (app novo, Beta):** card novo no portal (depois do Routine). Primeiro módulo: **⛽ Combustível**. Em cada parada você anota data, **odômetro**, litros, preço por litro e total (preencheu 2 dos 3, o Toba faz a conta do outro), o combustível (gasolina, etanol, diesel) e se **encheu o tanque**. O km/l sai de **tanque cheio a tanque cheio** (o jeito certo: km rodados ÷ litros colocados), com abastecimento parcial no meio entrando na conta. A tela mostra:
   - **Último tanque** em destaque com o selo 🟢 **Pé leve** / 🟡 **Na média** / 🔴 **Pé de chumbo** (comparado com a sua média, margem de 3%);
   - média geral, **custo por km**, gasto do mês e a **autonomia** (com o tamanho do tanque cadastrado em ⚙️ › 🚗 Meu carro);
   - **gráfico do histórico de km/l** (verde = média ou melhor, vermelho = abaixo, linha tracejada = média);
   - **🌽 Etanol ou ⛽ gasolina?**: até quanto o etanol compensa com o preço da última gasolina (regra dos 70% até ter um tanque cheio de cada; depois usa o rendimento do SEU carro);
   - lista dos abastecimentos com o km/l de cada tanque.
   Esqueceu de anotar uma parada? Marca "🙈 Teve abastecimento antes deste que eu não anotei" e aquele trecho sai da conta. O Toba recusa odômetro repetido ou que não bate com a data. Hub com "Abastecer agora" (já abre a folha). Por enquanto **não dá XP**.
2. **⚖️ Balança: formato do visor e pulo de campo certo:** na ⚙️ › Métricas da balança, cada campo (e o **peso**) ganhou o **Visor**: escolha como o número aparece na balança (`00,00`, `0,00`, `000`...). O pulo automático pro próximo campo segue isso. E o bug do "digito 919 e já troca" era a máscara contando o **zero da frente** ("0,91" + 9 contava 4 dígitos): consertado. O pulo também não para mais no campo de data/hora, e os campos sem vírgula (pontuação, metabolismo, visceral, idade) agora pulam também. Editar uma pesagem sem mexer num campo mantém o valor exatamente como estava.
3. **🏆 "Amigo da balança" destravado:** a pesagem grava data **e hora**, e o Perfil só aceitava data pura, então todas as pesagens contavam 0. Agora contam pelo dia (as antigas também, na hora). O mesmo bug deixava o card do Health no portal sem o peso: consertado junto.
4. **📊 Média por compra no filtro do Gastos:** tocar numa categoria mostra dois quadradinhos: **Total no mês** ("em 3 compras") e **Média por compra** em dourado.
5. **🍳 Receitas em ordem alfabética:** no Livro de Receitas, no "🧺 O que tem aí?" (desempate) e na escolha de receita da Semana.

**Dados:**
- Chave nova `TOBA_RACING_DB` (+ `TOBA_RACING_DB_AUTO_BACKUP`), formato no CLAUDE.md seção 3.12. Entra sozinha no backup geral do portal; ⚙️ do Racing tem backup só dele (`toba_racing_backup_*.json`).
- `TOBA_HEALTH_DB`: campos novos opcionais `metricsOrder[].digits` e `weightFormat` (bancos e backups antigos ganham o padrão no load). `metricsOrder[].type` agora pode ser trocado pela ⚙️ (valores de sempre: int/dec1/dec2). Nenhuma pesagem é regravada.
- XP/conquistas continuam calculados na hora: quem já tem 10 pesagens ganha o "Amigo da balança" ao abrir o Perfil.
- `sw.js`: 6 arquivos novos no PRECACHE, VERSION `toba-v19`. Não precisa de APK novo.

**Como testar:**
- Portal → card 🏁 Toba Racing → Combustível → + Abastecer: odômetro, litros (4 dígitos pula pro preço), preço (5,899 pula pro total, que já vem calculado). Faça um tanque cheio, depois um parcial e outro cheio: aparece o km/l, o gráfico (a partir de 2 tanques) e o selo. Tentar um odômetro menor que o anterior com data posterior → aviso "Viagem no tempo?". ⚙️ › 🚗 Meu carro → tanque 50 → aparece a Autonomia.
- Pesagem → ⚙️ Métricas da balança → Visor do peso `00,00`, Massa Óssea `0,00` → Nova pesagem: digitar 9195 só pula no 4º número; 330 na óssea pula no 3º. Editar uma pesagem antiga e salvar sem mexer → valores iguais.
- Perfil → ⚖️ Amigo da balança mostra "N de 10" com as suas pesagens.
- Gastos → tocar em ⛽ Combustível nas categorias → quadradinhos de total e média.
- Kitchen → Receitas e Semana › ➕ Receita: lista de A a Z.
- Testar em 360px e 384px.

**Commit sugerido:** `v1.51 - Toba Racing com controle de combustivel e historico de km/l, visor da balanca com pulo de campo certo, Amigo da balanca contando pesagens, media por compra no filtro do Gastos e receitas em ordem alfabetica`

---

## v1.52 — 📟 Visor da balança bonitão e hub do Racing só com módulos

**Arquivos alterados:** `TobaHealth/js/pesagem.js`, `TobaHealth/TobaHealth-Pesagem.html`, `TobaHealth/css/pesagem.css`, `TobaRacing/TobaRacing-Index.html`, `TobaRacing/css/racing-base.css`, `CLAUDE.md`

1. **📟 Visor da balança sem cara de robô:** na ⚙️ › Métricas da balança, o "Visor" de cada campo virou um botãozinho com o número em verde de display. Tocar abre uma folha de quadradinhos no estilo da gaveta de categorias do Gastos ("Onde foi parar o dinheiro?"), separada em 🔢 Sem vírgula / ☝️ 1 casa / ✌️ 2 casas, cada um com um exemplo (`00,00` → ex: 23,50). Sai o seletor nativo do Android.
2. **🏁 Hub do Racing só com módulos:** saiu o card "Abastecer agora" (era a mesma coisa do "+ Abastecer" do Combustível). O hub fica igual aos outros apps, um card por módulo, pronto pros próximos (Drive, Mario Kart...).

**Dados:** Nenhuma mudança no banco. `sw.js` sem mudança (nenhum arquivo novo).

**Como testar:**
- Pesagem → ⚙️ Métricas da balança → tocar no Visor do peso e de uma métrica → folha de quadradinhos, o atual marcado em verde → escolher outro → o botão muda e a Nova pesagem pula de campo no formato novo.
- Racing → Hub mostra só o card ⛽ Combustível + o placar.
- Testar em 360px e 384px.

**Commit sugerido:** `v1.52 - Visor da balanca com folha de quadradinhos e hub do Racing so com os modulos`

---

## v1.53 — 🛒 Modo lista de compras com itens avulsos

**Arquivos novos/alterados:** `TobaKitchen/TobaKitchen-Compras.html` (NOVO), `TobaKitchen/js/compras.js` (NOVO), `TobaKitchen/TobaKitchen-Index.html`, `TobaKitchen/TobaKitchen-Semana.html`, `TobaKitchen/js/semana.js`, `TobaKitchen/js/kitchen-recipes.js`, `TobaKitchen/js/kitchen-core.js`, `TobaKitchen/css/kitchen-base.css`, `sw.js`, `CLAUDE.md`

1. **🛒 Lista de compras virou módulo:** card novo no hub do Kitchen ("N itens pra pegar no mercado"). A lista saiu de dentro da Semana e ganhou página própria; o botão 🛒 da Semana continua lá e abre a lista daquela semana (dá pra trocar de semana pelas setinhas).
2. **➕ Itens avulsos:** botão **+ Item** pra pôr qualquer coisa além das receitas (papel higiênico, ração do Killua e do Gon, café pra V60...), com quantidade opcional e categoria em quadradinhos. A folha fica aberta pra pôr vários seguidos e já chuta a categoria pelo nome ("ração" → 🐾 Pets, "detergente" → 🧽 Limpeza). Nome repetido não duplica.
3. **🔤 Categorias em ordem alfabética:** avulsos e ingredientes das receitas aparecem juntos na mesma categoria, em ordem alfabética dentro de cada uma, com "N pra pegar" no título. Categorias novas: 🥖 Padaria, 🥤 Bebidas, 🧽 Limpeza, 🧴 Higiene, 🐾 Pets e 📦 Outros.
4. **🧹 Comprou, tirou:** avulso marcado continua na lista (vale pra qualquer semana) até tocar no ✕ ou em "🧹 Tirar avulsos comprados". O que sai fica em "↺ Já comprou antes" no + Item: um toque e volta pra lista. "📤 Mandar lista" já leva os avulsos com a quantidade.

**Dados:** campos novos opcionais no `TOBA_KITCHEN_DB`: `extras` (itens avulsos) e `extrasRecent` (já comprou antes). Bancos e backups antigos ganham listas vazias ao abrir/importar; nada do que já existia muda (os marcados das receitas continuam em `shopping` por semana). `sw.js`: 2 arquivos novos no PRECACHE, VERSION `toba-v20`. Não precisa de APK novo.

**Como testar:**
- Kitchen → Hub: card 🛒 Lista de compras com a contagem.
- Lista → + Item → "Papel higiênico" (cai em Higiene sozinho), "12 rolos" → Pôr na lista → "Ração" → Pôr na lista → ✕. Os dois aparecem nas categorias certas, misturados em A–Z com os ingredientes das receitas.
- Marcar um avulso → aparece "🧹 Tirar avulsos comprados (1)" → tirar → + Item mostra ele em "↺ Já comprou antes" → tocar volta pra lista.
- Trocar de semana pelas setas: avulsos continuam; os ingredientes mudam conforme a programação.
- Semana → 🛒 Lista de compras (N pra pegar) abre a lista daquela semana.
- ⚙️ → baixar backup → importar de volta (e um backup antigo da v1.52): nada some.
- Testar em 360px e 384px.

**Commit sugerido:** `v1.53 - Lista de compras virou modulo do Kitchen com itens avulsos por categoria em ordem alfabetica`

---

## v1.54 — 🧺 Lista de compras de tocar e escolher (sem digitar item por item)

**Arquivos alterados:** `TobaKitchen/TobaKitchen-Compras.html`, `TobaKitchen/js/compras.js`, `TobaKitchen/js/kitchen-recipes.js`, `TobaKitchen/js/kitchen-core.js`, `TobaKitchen/css/kitchen-base.css`, `CLAUDE.md`

1. **🧺 Escolher, no estilo do "O que tem aí?":** sai a folha "+ Item" de digitar item por item. A lista ganhou a aba **🧺 Escolher**: o básico do mercado já vem pronto em chips por categoria, em ordem alfabética (uns 90 itens + todos os ingredientes das receitas): é só ir tocando. Tocou = entra na lista, tocou de novo = sai. Tem busca no topo. O que já vem das receitas da semana aparece com 🍳 (não duplica).
2. **✍️ Outros:** não achou? Digita no Outros e ele vira chip. Depois de comprado e tirado da lista, o chip continua lá pra marcar de novo com um toque (se o nome tiver cara de categoria, tipo "ração" ou "detergente", ele vai pra categoria certa).
3. **🛒 Aba Lista:** a lista de antes (por categoria, A–Z, marcando no mercado). Lista vazia abre direto no 🧺 Escolher. Avulso que você já tinha posto na v1.53 continua lá (e acende o chip dele se tiver no catálogo).

**Dados:** item escolhido pelo chip grava `itemId` (opcional) no `extras` que já existia desde a v1.53; `extrasRecent` agora guarda só os digitados no Outros. Nada é apagado nem regravado; avulsos da v1.53 continuam funcionando. `sw.js` sem mudança (nenhum arquivo novo).

**Como testar:**
- Kitchen → 🛒 Lista de compras: com a lista vazia abre direto no 🧺 Escolher.
- Tocar em Café, Ração de gato, Detergente, Papel higiênico → ficam acesos; tocar de novo → apaga. Ingrediente de receita da semana aparece com 🍳 e não entra duas vezes.
- ✍️ Outros → "Filtro da V60" → ➕ → chip novo aceso.
- 🛒 Lista → tudo por categoria em A–Z. Marcar o filtro → "🧹 Tirar comprados da lista" → volta no 🧺 Escolher: o chip do filtro continua lá, apagado.
- Setas da semana na Lista: os escolhidos continuam, os ingredientes mudam conforme a programação.
- ⚙️ → baixar backup → importar de volta: nada some.
- Testar em 360px e 384px.

**Commit sugerido:** `v1.54 - Lista de compras com catalogo de itens pra tocar por categoria e Outros digitado`
