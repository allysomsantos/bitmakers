// Guarda os arquivos do app para abrir sem internet.
// Ao publicar uma versao nova, troque o numero em VERSAO.
const VERSAO = 'amicao-v1';
const ARQUIVOS = [
  './', 'index.html', 'estilo.css', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png',
  'js/app.js', 'js/ble.js', 'js/banco.js', 'js/dom.js', 'js/foto.js', 'js/pesos.js',
  'js/protocolo.js', 'js/arduino-falso.js', 'js/simulador.js', 'js/telas.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n.startsWith('amicao-') && n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(caches.match(evento.request).then(guardado => guardado || fetch(evento.request)));
});
