# Toba Android (APK)

App Android que abre o site do Toba (`https://moenda.github.io/TobaSolutions/`) dentro dele e acrescenta o que só um app nativo consegue:

- **Gastos automáticos:** lê as notificações de compra do banco/carteira (Google Wallet, Samsung Wallet, Nubank, Itaú, Inter, C6, Bradesco, Next, Santander, BB, Caixa, PicPay, Mercado Pago, Neon) e lança no Gastos.
- **Lembretes de verdade:** 08:00 / 14:00 / 22:00 (gastos), pesagem e treino, avisados pelo próprio Toba, mesmo com o app fechado.
- **Fim do descanso** no treino ao vivo na hora certa, mesmo com a tela apagada.
- Backup salvo direto em `Downloads/Toba`.
- **🚘 Android Auto (APK 1.4, desde v1.75):** o 🧭 Toba Drive na tela do carro, com mapa, voz, trânsito do TomTom e recálculo. Ver a seção 6.

Projeto Java puro. Única biblioteca (desde o APK 1.4): a **Car App Library** do Android Auto. Não entra no site (o `sw.js` não precisa dele).

---

## Atualizar o Toba depois

| O que mudou | O que fazer |
|---|---|
| Site (HTML/JS/CSS): quase todo patch | Nada no APK. Commit + push como sempre; o app abre a versão nova. |
| Parte nativa (esta pasta) | Aumente `versionCode` (+1) e `versionName` em `app/build.gradle`, gere o APK de novo e instale **por cima**. |

---

## 1. Gerar o APK (1ª vez)

1. Instale o **Android Studio** (developer.android.com/studio).
2. **File → Open** → escolha a pasta `TobaAndroid` (não a raiz do repositório). Espere o "Gradle sync" terminar; se ele oferecer atualizar o Gradle ou o plugin do Android, pode aceitar.
3. **Build → Generate Signed App Bundle / APK… → APK → Next.**
4. Em *Key store path*, clique **Create new…**:
   - Salve a chave **fora** da pasta do repositório (ex.: `Documentos/toba-chave.jks`). O repositório é público.
   - Escolha as senhas e preencha só o nome em *First and Last Name*.
5. **Next → release → Create.** O APK sai em `TobaAndroid/app/release/app-release.apk`.

> ⚠️ **Guarde a chave (`.jks`) e as senhas em dois lugares** (ex.: Drive + pendrive). Sem ela a próxima versão não instala por cima. Aí seria preciso desinstalar, e desinstalar **apaga os dados do app**.

## 2. Instalar no celular

Abrir o APK direto no celular **não funciona no Brasil**: o Play Protect bloqueia, sem "instalar mesmo assim", app de fora da loja que lê notificações. Instale pelo cabo USB a partir do PC (adb). Passo a passo completo, que serve também para outra pessoa instalar: **[INSTALAR.md](INSTALAR.md)**.

Neste PC o adb já vem com o Android Studio:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r TobaAndroid\app\release\app-release.apk
```

## 3. Levar os dados para o app (1ª vez)

O app guarda os dados separados do Chrome. Uma vez só:

1. No **Chrome**, no portal do Toba (a tela inicial): **⚙️ → Dados & Backup → Baixar backup** (é o backup geral, com todos os apps).
2. No **app**, no portal: **⚙️ → Dados & Backup → Restaurar backup** e escolha o arquivo baixado.

Depois disso, use só o app (o que for lançado no Chrome não aparece no app, e vice-versa).

## 4. Ligar os gastos automáticos

1. No app: **Gastos → ⚙️ → 🤖 Gastos automáticos → Ler notificações de compra → Abrir** e ligue o **Toba**.
2. Se a opção estiver **cinza** ("configuração restrita", acontece com APK de fora da loja): volte, toque em **⚠️ Liberar configuração restrita**, toque nos **⋮** (canto de cima) → **Permitir configurações restritas**, e repita o passo 1.
3. **Samsung:** Configurações → Apps → Toba → **Bateria → Sem restrições**. Sem isso o Android pode desligar a leitura e os lembretes para economizar bateria.

Como funciona: a cada compra aparece "💸 R$ 25,90 · PADARIA". Ao abrir o Gastos (ou tocar nessa notificação), os gastos entram sozinhos, com a categoria da última vez que você usou aquela loja (ou um palpite pelo nome; senão "Outros").

**Não reconheceu uma compra?** Gastos → ⚙️ → **🧾 O que o Toba leu** mostra as últimas notificações com R$ e por que cada uma foi ignorada. Banco fora da lista → **Ler este app**. Se o texto for diferente do esperado, mande o texto dessa tela para ajustar o `PurchaseParser.java`.

## 5. Lembretes

Gastos / Pesagem / Treinos → ⚙️ → 🔔 Lembretes. No app, o botão vira **🔔 Ligar lembrete** (e **Desligar** depois). No navegador continua criando o evento na agenda (.ics).

**Toba Routine (APK 1.2+):** toda tarefa com horário avisa na hora e, se continuar sem fazer, cobra de novo depois de 30 min e de 2 h (canal "Cobranças da rotina"). A notificação tem o botão **✅ Feito**: marca a tarefa sem abrir o app e cancela as cobranças do dia; o XP entra quando você abrir o Toba. Os avisos dos próximos 3 dias são refeitos cada vez que você abre o portal ou o Routine.

## 6. 🚘 Android Auto (APK 1.4+)

**Desde o APK 1.7 (v1.78):** mapa 3D clean (o mesmo Mapbox do Toba Drive, modo noturno seguindo o carro), botões 🧊 2D/3D e 🎨 skin no canto do mapa, velocidade do carro + placa da rua, trânsito só na rota. A rota é uma só: começou no carro, aparece no celular; deu Partiu no celular, o carro segue. Sem internet pro mapa 3D, volta o mapa de imagens com os cartões do Auto.

O Toba aparece no Android Auto como app de **navegação**: tela do carro com mapa, botões **Buscar** e **Recentes**, prévia da rota (tempo, km e trânsito) e **Bora!**. Navegando: cartão da próxima manobra, chegada prevista, voz em pt-BR que abaixa a música, recálculo quando sai da rota e "🏁 Chegou! Nunca foi sorte, Cloba." no fim.

- **Rota e busca:** TomTom (a mesma chave do Toba Drive do site). **Mapa:** Mapbox (estilos de navegação dia/noite, seguindo o farol do carro). As chaves **não ficam no APK**: o app lê do próprio site (`assets/toba-maps.js`) e guarda no celular. Trocou a chave no site? O carro pega sozinho.
- **Teclado só com o carro parado** (regra do Android Auto). Andando, use **Recentes**.
- **Simular:** na prévia da rota, o botão **Simular** dirige sozinho a 50 km/h pela rota. Serve pra testar no PC ou parado na garagem.
- O que é do carro fica no celular (`toba_auto`: recentes, mudo e um diário das viagens). Os ⭐ favoritos, os km e as conquistas do Toba Drive do site **ainda não** conversam com o carro.

### 6.1 Liberar o Android Auto pra app de fora da Play Store (1 vez)

1. No celular: **Configurações → Dispositivos conectados → Preferências de conexão → Android Auto** (na Samsung: Configurações → Conexões → Android Auto). Ou abra o app **Android Auto**.
2. Role até o fim e toque **10 vezes em "Versão"** → aceite o modo desenvolvedor.
3. **⋮ (canto de cima) → Configurações do desenvolvedor → marque "Fontes desconhecidas"** (*Unknown sources*). Sem isso o Toba não aparece no carro.
4. Instale o APK **pelo KingInstaller** (não pelo `adb install`): no Android Auto 17+ o validador do carro recusa app instalado por fora da Play ("Package DENIED" no log) mesmo com Fontes desconhecidas. KingInstaller → escolha o `app-release.apk` → instalar por cima. **Toda versão nova do APK vai pelo KingInstaller** (por cima, nunca desinstalar: os dados do Toba moram no app). Abra o Toba uma vez no celular.
5. Configurações → Apps → Toba → **Permissões → Localização → Permitir durante o uso** (o carro também pede na 1ª vez). Samsung: **Bateria → Sem restrições**.

### 6.2 Testar no PC (DHU, sem carro)

1. Android Studio → **Tools → SDK Manager → SDK Tools** → marque **Android Auto Desktop Head Unit Emulator** → Apply.
2. No celular (com o 6.1 feito): app Android Auto → **⋮ → Iniciar servidor da unidade principal** (*Start head unit server*).
3. Cabo USB + depuração USB ligada. No PowerShell:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" forward tcp:5277 tcp:5277
   & "$env:LOCALAPPDATA\Android\Sdk\extras\google\auto\desktop-head-unit.exe"
   ```
4. Na janela do DHU: toque no ícone de apps → **Toba**. Buscar → escolha um destino → **Simular**.

### 6.3 No carro (Peugeot)

1. Com o 6.1 feito, plugue o celular no cabo do carro (ou sem fio, se o Peugeot tiver).
2. Na tela do carro: ícone de apps → **Toba**. Não apareceu? No celular: Android Auto → **Personalizar o acesso rápido/Iniciador** e marque o Toba.
3. Parado: **Buscar** → destino → **Bora!**. Andando, só **Recentes** e os botões grandes.
4. Deu ruim? O aviso aparece na própria tela do carro (sem internet, chave recusada, cota do dia). A rota tem trava de 300 por dia.

## 7. ⌚ Relógio / Health Connect (APK 2.2+)

O Toba Health › ⌚ Relógio lê passos, sono, calorias, distância, batimentos e exercícios do **Health Connect** (já vem dentro do Android 14+). Só leitura.

1. **Samsung Health** › ⋮ › **Configurações** › **Health Connect** (Conexão Saúde): libera o Samsung Health a **escrever** passos, sono, calorias, frequência cardíaca e exercícios. O Galaxy Watch sincroniza com o Samsung Health sozinho.
2. Toba › Health › ⌚ Relógio › **Ligar o Health Connect** › marca tudo › **Permitir**.
3. Não abriu a tela das permissões (negou 2 vezes, o Android para de perguntar)? ⚙️ do Relógio › **🔐 Permissões do Health Connect** e liga as chavinhas na mão.
4. O Health Connect só deixa ler uns 30 dias antes da 1ª permissão: o Relógio começa com esse mês e vai guardando daí pra frente. O passado vem pelo ⚙️ › **📥 Importar histórico do Samsung Health** (v1.89).
5. **APK 2.3** (v1.89, versionCode 14, ponte 11): cada exercício vem com kcal, km, passos e FC média/máx. do horário dele (pro 🔗 Mesclar do 🩻 Raio-X) e o `<input type="file" multiple>` deixa marcar vários arquivos de uma vez.

---

## Para quem for mexer no código

- `HealthReader.java` (APK 2.2, v1.87): ⌚ Relógio. Usa a API do próprio Android 14 (`android.health.connect`), sem biblioteca no Gradle; só carrega com `SDK_INT >= 34`. Números por dia via `aggregateGroupByPeriod` (o Health Connect tira a duplicata celular + relógio), sono e exercícios via `readRecords`. Ponte: `healthStatus`, `healthAsk` (→ `window.onTobaHealthPerms`), `healthRead(from, to, reqId)` (→ `window.onTobaHealthData`), `healthOpenSettings`. APK 2.3 (v1.89): `sessionStats` soma kcal/ativas/distância/passos/FC dentro do horário de cada `ExerciseSessionRecord` (falhou um, fica sem aquele número). Permissão nova = `uses-permission` no manifest **e** `HealthReader.PERMS`. O `activity-alias` `ViewPermissionUsageActivity` no manifest é obrigatório (sem ele o Health Connect nem lista o Toba); ele abre o Relógio.
- `SamsungReader.java` (APK 2.6, v1.98): 🌡️ temperatura da pele, 🔋 Energy Score e nota de sono direto do Samsung Health (Samsung Health Data SDK, só leitura; o Samsung não manda esses pro Health Connect). Roda dentro do `healthRead` (resposta ganha `samsung`). Ponte: `samsungAsk` / `samsungStatus` (→ `window.onTobaSamsungStatus`). Precisa do **Developer Mode for Data Read** no Samsung Health (⋮ › Configurações › Sobre › 10 toques na versão). O `samsung-health-data-api-1.1.0.aar` fica em `app/libs/` (baixar em developer.samsung.com/health/data) e **não vai pro git**.

- `MainActivity.java`: o WebView. Só abre páginas de `SITE_HOST`; links de fora vão para o navegador. Chama `window.onTobaAppResume()` ao voltar para a frente. O seletor de arquivo aceita vários (`EXTRA_ALLOW_MULTIPLE` + `ClipData`) desde o APK 2.3. Desde o APK 2.1 (v1.85) recebe o **Compartilhar** do Android (`ACTION_SEND` `text/plain`, ex.: Google Maps › Compartilhar › Toba) e abre `TobaTurism/TobaTurism-Places.html?title=&text=` com o Lugar novo preenchido.
- `TobaBridge.java`: vira `window.TobaNative` no site. O site testa `TOBA_NATIVE` / `tobaIsApp()` (toba-common.js); no navegador é `null`. `clipboardText()` (ponte 9, APK 2.1) devolve o texto copiado, pro 📋 Colar do Maps do Places (o WebView bloqueia o `navigator.clipboard.readText` do site).
- `PurchaseListener.java` + `PurchaseParser.java`: leem as notificações e guardam a fila em SharedPreferences (`TobaStore.java`). Nada é gravado no banco do site por aqui: o `gastos.js` (`importNativePurchases`) é quem lança, e só tira da fila (`ackPurchases`) depois que o `saveDatabase()` gravou.
- `Alarms.java` + `AlarmReceiver.java` + `BootReceiver.java`: lembretes, descanso e os avisos de uma vez só do Toba Routine (`setTaskAlerts` recebe a lista inteira; o "✅ Feito" vai para a fila `task_done`, lida pelo `routine.js` com `getDoneTasks`/`ackDoneTasks`).
- **Android Auto** mora em `app/auto/br/com/toba/auto/` (pacote `br.com.toba.auto`; a pasta fica fora de `src/main/java` de propósito, ligada pelo `sourceSets` do `app/build.gradle`). `TobaCarAppService` → `TobaCarSession` (dona do mapa e do motor) → telas `HomeScreen` (NavigationTemplate), `SearchScreen`, `RecentScreen`, `PreviewScreen`. `NavEngine` = GPS, posição na rota, manobra, voz (`Voice`), recálculo, chegada e simulador; `NavService` = serviço em primeiro plano (tipo location) só enquanto tem rota. `MapRenderer` desenha na superfície do carro: pede ao **Mapbox Static Images** uma imagem já girada pro rumo e com a rota pintada e só desliza/gira entre uma e outra (imagem nova a cada ~15% de tela andada ou 28° de curva). `TobaApi` = chaves lidas do site + TomTom Search/Routing + Mapbox, sempre com `Referer` do site (chave limitada ao domínio continua valendo). Ícones de manobra em `res/drawable/ic_turn_*.xml`.
- `targetSdk 34` de propósito (no 35 o site fica embaixo da barra de status). Não vai para a Play Store: usa `USE_EXACT_ALARM` e leitura de notificações.
