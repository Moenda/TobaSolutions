# Toba Android (APK)

App Android que abre o site do Toba (`https://moenda.github.io/TobaSolutions/`) dentro dele e acrescenta o que só um app nativo consegue:

- **Gastos automáticos:** lê as notificações de compra do banco/carteira (Google Wallet, Samsung Wallet, Nubank, Itaú, Inter, C6, Bradesco, Next, Santander, BB, Caixa, PicPay, Mercado Pago, Neon) e lança no Gastos.
- **Lembretes de verdade:** 08:00 / 14:00 / 22:00 (gastos), pesagem e treino, avisados pelo próprio Toba, mesmo com o app fechado.
- **Fim do descanso** no treino ao vivo na hora certa, mesmo com a tela apagada.
- Backup salvo direto em `Downloads/Toba`.

Projeto Java puro, sem bibliotecas. Não entra no site (o `sw.js` não precisa dele).

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

---

## Para quem for mexer no código

- `MainActivity.java`: o WebView. Só abre páginas de `SITE_HOST`; links de fora vão para o navegador. Chama `window.onTobaAppResume()` ao voltar para a frente.
- `TobaBridge.java`: vira `window.TobaNative` no site. O site testa `TOBA_NATIVE` / `tobaIsApp()` (toba-common.js); no navegador é `null`.
- `PurchaseListener.java` + `PurchaseParser.java`: leem as notificações e guardam a fila em SharedPreferences (`TobaStore.java`). Nada é gravado no banco do site por aqui: o `gastos.js` (`importNativePurchases`) é quem lança, e só tira da fila (`ackPurchases`) depois que o `saveDatabase()` gravou.
- `Alarms.java` + `AlarmReceiver.java` + `BootReceiver.java`: lembretes e descanso.
- `targetSdk 34` de propósito (no 35 o site fica embaixo da barra de status). Não vai para a Play Store: usa `USE_EXACT_ALARM` e leitura de notificações.
