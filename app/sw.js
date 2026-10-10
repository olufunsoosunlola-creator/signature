// Signature — the service worker: a small helper the browser runs in the background.
// On first visit it saves every file the app needs on the phone; after that the app
// opens from those saved copies, with or without internet.
//
// VERSION is replaced automatically by the publish workflow with the commit id, so each
// new release gets a fresh copy of the files and the old copy is deleted.
const VERSION = 'dev';
const CACHE = 'signature-' + VERSION;
const FILES = [
  './',
  '_ds/classical-20f9543c-4b48-4898-9c80-1e2f739e756c/_ds_bundle.js',
  '_ds/classical-20f9543c-4b48-4898-9c80-1e2f739e756c/styles.css',
  'fonts.css',
  'fonts/058a83692109.woff2',
  'fonts/079deabaf2d4.woff2',
  'fonts/185c340909f8.woff2',
  'fonts/28d80079bbe9.woff2',
  'fonts/4735e8aba53c.woff2',
  'fonts/48072044ec67.woff2',
  'fonts/61f4626ada1f.woff2',
  'fonts/68087e60b5f4.woff2',
  'fonts/6896217e3da8.woff2',
  'fonts/7181e87dca27.woff2',
  'fonts/7b969e1fe3d4.woff2',
  'fonts/880eabe202cc.woff2',
  'fonts/8a9cab61ef9e.woff2',
  'fonts/a10288635e25.woff2',
  'fonts/a5c4bcb1cfb6.woff2',
  'fonts/ac5feb95324d.woff2',
  'fonts/b74390d4078f.woff2',
  'fonts/b746c46dce14.woff2',
  'fonts/ba465564e252.woff2',
  'fonts/d3090cc9f4ea.woff2',
  'fonts/e4dc741c7739.woff2',
  'fonts/f0ca3ec9685f.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'manifest.webmanifest',
  'signature-data.js',
  'signature-requests.js',
  'storage.js',
  'support.js',
  'vendor/react-dom.production.min.js',
  'vendor/react.production.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('signature-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Saved copy first; the internet only for anything not saved yet.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        if (hit) return hit;
        return fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => (req.mode === 'navigate' ? cache.match('./') : Response.error()));
      })
    )
  );
});
