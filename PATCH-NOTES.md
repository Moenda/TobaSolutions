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
