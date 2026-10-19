# Como instalar o app Toba no seu Android

Passo a passo para instalar o APK do Toba num celular Android usando um PC com Windows. Leva uns 15 minutos na primeira vez; as próximas atualizações levam 1 minuto.

## Por que não dá só para abrir o arquivo?

O app lê as notificações de compra do banco para lançar os gastos sozinho. No Brasil, o Google **bloqueia** (sem opção de "instalar mesmo assim") qualquer app de fora da Play Store que peça isso, quando ele é aberto pelo navegador, WhatsApp, Drive ou gerenciador de arquivos. É uma proteção contra golpe. **Pelo cabo USB, a partir do PC, a instalação é permitida.** Por isso o caminho é esse.

## O que você precisa

- Celular **Android 10 ou mais novo**. iPhone não roda APK; lá o Toba continua funcionando pelo Safari.
- PC com **Windows**.
- **Cabo USB que passe dados** (o que veio com o celular é o mais garantido; alguns cabos só carregam).
- O arquivo **`app-release.apk`**, que o Rafael te manda. Salve na pasta **Downloads** do PC.

---

## 1. Preparar o PC (só na 1ª vez)

1. Baixe o **SDK Platform-Tools para Windows** no site oficial do Android: `developer.android.com/tools/releases/platform-tools` → "Download SDK Platform-Tools for Windows".
2. Extraia o `.zip` direto no `C:\`. Tem que ficar a pasta `C:\platform-tools` com o `adb.exe` dentro.
3. **Celular Samsung:** instale também o **Samsung Android USB Driver** (site de desenvolvedores da Samsung: `developer.samsung.com` → Android USB Driver). Sem ele o PC não reconhece o celular.
   Outras marcas costumam funcionar sem driver. Se não funcionar, procure "USB driver" + a marca do celular, sempre no site oficial do fabricante.

## 2. Preparar o celular (só na 1ª vez)

1. **Configurações → Sobre o telefone** (na Samsung: **→ Informações do software**).
2. Toque **7 vezes** em **Número de compilação** e digite o PIN. Vai aparecer "Modo de desenvolvedor ativado".
3. Volte em **Configurações → Opções do desenvolvedor** (no fim da lista, ou dentro de "Sistema" em algumas marcas) e ligue **Depuração USB**.

## 3. Conectar

1. Ligue o celular no PC pelo cabo e **desbloqueie a tela**.
2. Puxe a barra de notificações, toque no aviso do USB e escolha **Transferência de arquivos**.
3. Vai aparecer **"Permitir depuração USB?"**: marque **Sempre permitir neste computador** → **Permitir**.

## 4. Instalar

1. No PC, abra o **PowerShell**: tecla Windows → digite `PowerShell` → Enter.
2. Cole este comando e dê Enter. Ele confere se o PC vê o celular:

```powershell
C:\platform-tools\adb.exe devices
```

   - Apareceu um código com **`device`** do lado? Siga para o próximo comando.
   - Apareceu **`unauthorized`**? Olhe a tela do celular e toque em **Permitir**. Rode o comando de novo.
   - Não apareceu nada? Veja a tabela de problemas no fim.

3. Cole este e dê Enter. Ele instala o app:

```powershell
C:\platform-tools\adb.exe install -r "$env:USERPROFILE\Downloads\app-release.apk"
```

   Tem que aparecer **`Success`**. Pronto, o **Toba** está na gaveta de apps.

Depois disso pode desligar a **Depuração USB**; o app continua funcionando.

---

## 5. Primeira vez no app

1. Abra o **Toba** e permita as **notificações**.
2. **Seus dados:** o app começa vazio, porque guarda os dados separado do navegador.
   - Já usava o Toba no Chrome? No **Chrome**, na tela inicial do Toba: **⚙️ → Dados & Backup → Baixar backup**. Depois, no **app**: **⚙️ → Dados & Backup → Restaurar backup** e escolha o arquivo baixado.
   - Nunca usou? É só começar. A partir daqui, use só o app.
3. **Gastos automáticos:** **Gastos → ⚙️ → 🤖 Ler notificações de compra → Abrir** e ative o **Toba**.
   - Se a opção estiver **cinza** ("configuração restrita"): volte ao Toba, toque em **⚠️ Liberar configuração restrita**, toque nos **⋮** (canto de cima) → **Permitir configurações restritas**, e repita.
4. **Bateria:** Configurações → Apps → Toba → **Bateria → Sem restrições**. Sem isso o celular pode desligar a leitura das compras e os lembretes para economizar.
5. **Lembretes (opcional):** Gastos → ⚙️ → **🔔 Lembrete de gastos → Ligar lembrete** (08:00, 14:00 e 22:00). Também tem para pesagem e treino.

**No dia a dia:** pague com o cartão. Chega "💸 R$ 25,90 · PADARIA"; ao abrir o Gastos o gasto já está lançado. Para conferir: **Gastos → ⚙️ → 🧾 O que o Toba leu**. Se o seu banco aparecer **"fora da lista"**, toque em **Ler este app**. Se o valor ou a loja vierem estranhos, mande um print dessa tela para o Rafael.

## 6. Atualizar depois

Quando o Rafael mandar um `app-release.apk` novo: salve em Downloads, ligue a Depuração USB, conecte o cabo e rode só o comando de instalar (passo 4.3). **Os dados ficam.**

⚠️ **Nunca desinstale o Toba para "reinstalar limpo":** desinstalar **apaga todos os dados** do app. Se precisar mesmo, baixe o backup antes (⚙️ → Dados & Backup → Baixar backup, que vai para `Downloads/Toba`).

Lembrando: quase toda novidade do Toba chega sozinha, sem APK novo. O app abre o site, então é só fechar e abrir o app. APK novo só quando mudar a parte do Android.

---

## Deu problema?

| O que aparece | O que fazer |
|---|---|
| `adb devices` não mostra nada | Desbloqueie a tela, escolha **Transferência de arquivos**, troque o cabo ou a porta USB. Samsung: confira se instalou o driver (passo 1.3) e tire e ponha o cabo. |
| `unauthorized` | Toque em **Permitir** no celular. Se o aviso não aparecer: Opções do desenvolvedor → **Revogar autorizações de depuração USB**, tire e ponha o cabo. |
| `'C:\platform-tools\adb.exe' não é reconhecido` | A pasta não ficou em `C:\platform-tools`. Confira onde o zip foi extraído. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Já existe um Toba instalado com outra assinatura. **Baixe o backup antes**, desinstale o Toba antigo e instale de novo. |
| `No such file` / arquivo não encontrado | O APK não está em Downloads com o nome `app-release.apk`. Arraste o arquivo para dentro do PowerShell para colar o caminho certo. |
| A opção de notificações fica cinza | Passo 5.3: **Liberar configuração restrita**. |
| Compras pararam de entrar | Passo 5.4 (bateria **Sem restrições**) e confira se o acesso às notificações continua ligado (Gastos → ⚙️ → 🤖). |
