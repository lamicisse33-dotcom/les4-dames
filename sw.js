/* Les Quatre Dames — service worker
   Règle d'or : le HTML passe TOUJOURS par le réseau d'abord.
   Sinon une mise à jour du jeu ne remonte jamais sur l'appareil. */

var CACHE = 'lqd-v3.3';
var FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(FICHIERS.map(function (f) {
        return c.add(f).catch(function () { /* un fichier manquant ne bloque pas l'install */ });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.map(function (n) {
        if (n !== CACHE) return caches.delete(n);
      }));
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      return self.clients.matchAll({ type: 'window' });
    }).then(function (fenetres) {
      fenetres.forEach(function (f) { f.navigate(f.url); });
    }).catch(function () {})
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var estPage = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (estPage) {
    // réseau d'abord : la dernière version gagne toujours
    e.respondWith(
      fetch(req).then(function (rep) {
        var copie = rep.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copie); });
        return rep;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // images, manifeste : cache d'abord, c'est stable
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (rep) {
        var copie = rep.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copie); });
        return rep;
      });
    }).catch(function () { return caches.match('./index.html'); })
  );
});
