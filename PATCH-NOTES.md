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
