/* Registra o service worker (permite instalar o app e abrir offline).
 * O sw.js fica na raiz do site; o caminho é calculado a partir deste arquivo,
 * então funciona de qualquer pasta e em qualquer endereço do GitHub Pages. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  var script = document.currentScript;
  if (!script) return;
  var swUrl = new URL("../sw.js", script.src).href;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register(swUrl).catch(function (err) {
      console.warn("Service worker não registrado:", err);
    });
  });
})();
