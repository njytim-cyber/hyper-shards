'use strict';
// Service Worker — gives Hyper Shards an installable, offline-capable
// shell. Strategy: cache-first for the static app shell (HTML / CSS /
// JS / icons / manifest), network-first for audio (so a deploy that
// updates a track is picked up promptly). Bumping CACHE_VERSION wipes
// old shells on the next activate.

const CACHE_VERSION = 'hs-shell-v1';
const CACHE_AUDIO   = 'hs-audio-v1';

// Files to pre-cache. The shell is small (~290 lines HTML, 14 JS files,
// 1 CSS, 2 SVGs); fetching all on install means subsequent loads are
// truly offline.
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
    // Clear any caches that aren't the current shell or audio bucket so
    // the install size doesn't grow unbounded across deploys.
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_VERSION && k !== CACHE_AUDIO).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Audio: network-first so updated tracks land quickly. Falls back to
  // cache when offline; opportunistically caches successful responses
  // for next-time offline play.
  if (/\/audio\//.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) {
          const c = await caches.open(CACHE_AUDIO);
          c.put(req, r.clone());
        }
        return r;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error('audio fetch failed and not cached');
      }
    })());
    return;
  }

  // Shell: cache-first. The version-check banner in 01-core.js is what
  // notifies players that a new deploy is live; a refresh fetches the
  // new HTML and the new sw.js, which cycles the cache via skipWaiting.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const r = await fetch(req);
      if (r.ok) {
        const c = await caches.open(CACHE_VERSION);
        c.put(req, r.clone());
      }
      return r;
    } catch {
      // Last-resort fallback for navigation: serve the cached shell.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw new Error('fetch failed');
    }
  })());
});
