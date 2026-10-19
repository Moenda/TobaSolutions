/* Toba · service worker
 * - Páginas, scripts e estilos: tenta a rede primeiro (você sempre vê a versão
 *   mais nova publicada) e cai no cache se estiver offline ou a rede demorar.
 * - Chart.js (CDN): cache primeiro, para os gráficos funcionarem offline.
 * - NUNCA mexe no localStorage: seus dados não passam por aqui.
 * Mudou a lista de arquivos? Aumente a versão abaixo. */
const VERSION = "toba-v9";
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/pwa-register.js",
  "./assets/toba-common.css",
  "./assets/toba-common.js",
  "./assets/portal.css",
  "./assets/portal.js",
  "./TobaBank/TobaBank-Index.html",
  "./TobaBank/TobaBank-Gastos.html",
  "./TobaBank/TobaBank-Investimento.html",
  "./TobaBank/TobaBank-Raxador.html",
  "./TobaBank/css/bank-base.css",
  "./TobaBank/css/gastos.css",
  "./TobaBank/css/investimento.css",
  "./TobaBank/css/raxador.css",
  "./TobaBank/js/bank-core.js",
  "./TobaBank/js/bank-metrics.js",
  "./TobaBank/js/categorias.js",
  "./TobaBank/js/gastos.js",
  "./TobaBank/js/investimento.js",
  "./TobaBank/js/raxador.js",
  "./TobaHealth/TobaHealth-Index.html",
  "./TobaHealth/TobaHealth-Pesagem.html",
  "./TobaHealth/TobaHealth-Treinos.html",
  "./TobaHealth/css/health-base.css",
  "./TobaHealth/css/pesagem.css",
  "./TobaHealth/css/treinos.css",
  "./TobaHealth/css/sessao.css",
  "./TobaHealth/js/health-core.js",
  "./TobaHealth/js/pesagem.js",
  "./TobaHealth/js/hall.js",
  "./TobaHealth/js/forca.js",
  "./TobaHealth/js/sessao.js",
  "./TobaHealth/js/sessao-saitama.js",
  "./TobaHealth/js/treinos.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // Um arquivo que falhe não impede a instalação dos outros.
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () =>
      caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html"));
    const timer = setTimeout(() => {
      fromCache().then((hit) => { if (hit && !settled) { settled = true; resolve(hit); } });
    }, NETWORK_TIMEOUT_MS);
    // "no-cache": confere com o servidor se o arquivo mudou, em vez de usar a
    // cópia de até 10 min que o GitHub Pages deixa no navegador. Sem isso, logo
    // depois de publicar, a página nova podia carregar com um JS antigo.
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        clearTimeout(timer);
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        if (!settled) { settled = true; resolve(response); }
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then((hit) => {
          if (!settled) { settled = true; resolve(hit || Response.error()); }
        });
      });
  });
}

function cacheFirst(request) {
  return caches.match(request).then((hit) =>
    hit || fetch(request).then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(cacheFirst(request));
  }
});

// Toque numa notificação do Toba (ex.: "Descanso acabou"): volta para a aba
// do app se ela ainda estiver aberta, senão abre a página do aviso.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const same = list.find((client) => client.url.split("#")[0] === url.split("#")[0]) || list[0];
      if (same) return same.focus();
      return self.clients.openWindow(url);
    }),
  );
});
