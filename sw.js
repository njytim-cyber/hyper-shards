'use strict';
// Service Worker — installable, offline-capable shell.
//
// Strategy (revised after v1 pinned players to a stale cache):
//   - HTML / CSS / JS:  network-first, cache fallback. A refresh always
//                       picks up the latest deploy when online; cached
//                       copy serves only when the network fails.
//   - audio/*:          network-first with cache fallback (unchanged).
//   - icons / manifest: cache-first (rarely change).
//
// Bumping CACHE_VERSION wipes stale shells on the next activate.

const CACHE_VERSION = 'hs-shell-v2';
const CACHE_AUDIO   = 'hs-audio-v1';

// Files to pre-cache so the shell is fully offline-playable after first
// load. We still pre-cache, but the fetch handler prefers network for
// these so an updated deploy lands without a cache bust.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
  './css/style.css',
  './js/01-core.js',
  './js/02-input.js',
  './js/03-actors.js',
  './js/04-enemies.js',
  './js/05-flow.js',
  './js/06-audio.js',
  './js/07-loop.js',
  './js/08-update.js',
  './js/09-boss-ai.js',
  './js/10-modes.js',
  './js/11-render.js',
  './js/12-icons.js',
  './js/13-hub.js',
  './js/14-boss-arena.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop every cache that isn't the current shell or audio bucket.
    // This is what evicts hs-shell-v1 when v2 takes over.
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_VERSION && k !== CACHE_AUDIO).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Network-first with cache-fallback. Used for app shell (HTML/CSS/JS).
async function networkFirst(req, cacheName) {
  try {
    const r = await fetch(req);
    if (r && r.ok) {
      const c = await caches.open(cacheName);
      c.put(req, r.clone());
    }
    return r;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw new Error('network failed and no cache');
  }
}

// Cache-first. Used for icons/manifest where network round-trips
// outweigh freshness.
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const r = await fetch(req);
  if (r && r.ok) {
    const c = await caches.open(cacheName);
    c.put(req, r.clone());
  }
  return r;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Audio: network-first; cache opportunistically for offline play.
  if (/\/audio\//.test(url.pathname)) {
    event.respondWith(networkFirst(req, CACHE_AUDIO));
    return;
  }

  // Icons / manifest: rarely change — cache-first is fine.
  if (/\.(svg|webmanifest|ico|png)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, CACHE_VERSION));
    return;
  }

  // App shell (HTML / CSS / JS): network-first so a deploy lands on
  // the next refresh without waiting for a cache version bump.
  event.respondWith(networkFirst(req, CACHE_VERSION));
});
