# Molde de app novo (Kitchen, Routine, Tasks...)

Esta pasta é um app **funcionando** de exemplo: abra `_molde-app/TobaMolde-Index.html` no navegador para ver. Ela não aparece no portal nem entra no cache offline (`sw.js`). Não apague; é a referência para os próximos apps.

## Copiar e preencher (exemplo: Toba Kitchen)

1. **Pasta:** copie `_molde-app/` para `TobaKitchen/` e renomeie os arquivos:
   - `TobaMolde-Index.html` → `TobaKitchen-Index.html` (hub do app)
   - `TobaMolde-Modulo.html` → `TobaKitchen-Receitas.html` (um por módulo)
   - `js/molde-core.js` → `js/kitchen-core.js`, `js/modulo.js` → `js/receitas.js`
   - `css/molde-base.css` → `css/kitchen-base.css`
2. **Trocar nomes** dentro dos arquivos (buscar e substituir, respeitando maiúsculas):
   `TobaMolde` → `TobaKitchen`, `Toba Molde` → `Toba Kitchen`, `MOLDE` → `KITCHEN`, `Molde` → `Kitchen`, `molde` → `kitchen`, e o emoji 🧪 pelo do app.
   - A chave do banco fica `TOBA_KITCHEN_DB` (+ `TOBA_KITCHEN_DB_AUTO_BACKUP`). **Depois de publicado, nunca mais muda.**
   - Cor do app: `--accent` em `css/kitchen-base.css`.
3. **Banco:** defina o formato em `createEmptyKitchenDb()` e todo campo novo ganha default em `normalizeKitchenDb()`. Documente a chave e o formato no `CLAUDE.md` (seção 3).
4. **Cache offline:** acrescente todos os arquivos novos no `PRECACHE` do `sw.js` **e** aumente `VERSION`.
5. **Portal:** no `index.html`, troque o card "Em breve" do app por um link de verdade:
   ```html
   <a href="./TobaKitchen/TobaKitchen-Index.html" class="app-card" data-id="toba-kitchen">
     <div class="app-card-top">
       <span class="app-icon">🍳</span>
       <span class="app-title">Toba Kitchen</span>
       <span class="badge badge-beta">🔥 Beta</span>
     </div>
     <div class="app-desc">Frase cômica do app <b>(˶ڡ˶)⁠و</b></div>
   </a>
   ```
   Mantenha o `data-id` (ele é a chave da ordem salva em `toba_modules_config`).
6. **PATCH-NOTES.md:** entrada nova no final, como todo patch.

## Regras do molde (iguais em todos os apps)

- **Ordem dos scripts:** `../assets/toba-common.js` → `js/<app>-core.js` → `js/<módulo>.js` → `../assets/pwa-register.js`.
- **Nada de `onclick=`/`onchange=`/`onsubmit=` no HTML.** Use `data-click`, `data-change`, `data-input`, `data-submit` e registre a função em `tobaActions({ ... })`. `data-close` fecha a folha; `data-open="id"` abre.
- **Avisos:** só `showPageMessage(...)` (nunca `alert`/`confirm`/`prompt`). Depois de gravar, o core chama `tobaSaved()` ("Salvo ✓").
- **Lista vazia:** `tobaEmpty("🫙", "Título", "dica do que fazer")`.
- **Cabeçalho:** `‹` volta um nível (hub do app → portal); o título leva ao mesmo lugar; ⚙️ à direita. Em "subpáginas" dentro do mesmo HTML use `tobaSetHeader({ page, back: "acao" })`.
- **Folhas (modais):** `.toba-modal > .toba-sheet`, com o botão principal dentro de `.toba-sheet-footer` (fica preso no rodapé, acima do teclado).
- **⚙️ Configurações** vem pronta (backup do app, restaurar, apagar tudo) via `tobaSetupApp`. Itens só da página vão num `<div id="tobaSettingsExtra" hidden>`.
- **Telas de 360px (S24) a 384px (S24+):** rótulos dos quadradinhos curtos (cabem em 1 linha) e nada de largura fixa.
