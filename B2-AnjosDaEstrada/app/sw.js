// Guarda os arquivos do app para abrir sem internet.
// Ao publicar uma versao nova, troque o numero em VERSAO.
const VERSAO = 'anjos-v1';
const ARQUIVOS = [
  './', 'index.html', 'estilo.css', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png',
  'js/app.js', 'js/ble.js', 'js/dom.js', 'js/protocolo.js', 'js/faixas.js', 'js/caminhao.js',
  'js/caminhao-falso.js', 'js/tela.js', 'js/som.js', 'js/simulador.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(caches.match(evento.request).then(guardado => guardado || fetch(evento.request)));
});
