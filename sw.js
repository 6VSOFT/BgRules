// Bump VERSION whenever shell files or rules change; it also busts the CDN cache on install.
const VERSION = 'v13';
const SHELL = `shell-${VERSION}`;
const GAMES = `games-${VERSION}`;
const FONTS = 'fonts-v1';

const SHELL_FILES = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'fx.js',
  'menu.js',
  'vendor/gsap/gsap.min.js',
  'vendor/gsap/ScrollTrigger.min.js',
  'vendor/gsap/SplitText.min.js',
  'vendor/lenis/lenis.min.js',
  'vendor/lenis/lenis.css',
  'vendor/react/react.production.min.js',
  'vendor/react/react-dom.production.min.js',
  'vendor/reactbits/SplitText.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/logo.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'games/index.json',
];

// Each game's rules page + images are precached so the whole book works offline.
const GAME_FILES = {
  harmonies: [
    'rules.html',
    ...['cover_art', 'take_tokens_example', 'orientations', 'score_example', 'pouch', 'animal_row',
      'personal_boards', 'aid_stacking', 'setup_full', 'stacking', 'animal_card', 'endgame_art',
      'score_trees', 'score_mountains', 'score_fields', 'score_buildings', 'score_river',
      'score_islands', 'score_animals', 'nature_spirit', 'solo'].map(n => `img/${n}.jpg`),
  ],
  kraken: [
    'rules.html',
    ...['captain', 'contents', 'cover', 'crew', 'execute_steps', 'ic_armed', 'ic_cabin', 'ic_cult', 'ic_disarmed', 'ic_drunk', 'ic_feed', 'ic_flog', 'ic_mermaid', 'ic_telescope', 'ic_tongue', 'kraken_statue', 'map', 'monkey', 'mutiny_table', 'offduty_table', 'parrot', 'pirate_drink', 'pirate_woman', 'rit_convert', 'rit_guns', 'rit_search', 'strategy_captain', 'teams_table'].map(n => `img/${n}.jpg`),
  ],
  minodice: [
    'rules.html',
    'img/cover.jpg',
    ...['dice_overview', 'ic_minotaur', 'ic_griffin', 'ic_mermaid', 'ranking',
      'example_round', 'example_bonus'].map(n => `img/${n}.png`),
  ],
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await precache(SHELL, SHELL_FILES);
    for (const [id, files] of Object.entries(GAME_FILES)) {
      await precache(GAMES, files.map(f => `games/${id}/${f}`));
    }
  })());
});

// Fetch each file as `url?v=VERSION`: a URL the CDN (GitHub Pages caches ~10 min) and the
// browser have never seen, so a new VERSION can't pick up a stale copy. Store it under the
// clean URL so normal page requests match. Any failure aborts the install (old version stays).
async function precache(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.all(urls.map(async u => {
    const clean = new URL(u, self.registration.scope);
    const busted = new URL(clean);
    busted.searchParams.set('v', VERSION);
    const res = await fetch(busted, { cache: 'reload' });
    if (!res.ok) throw new Error(`precache ${u}: ${res.status}`);
    await cache.put(clean, res);
  }));
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL, GAMES, FONTS];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache-first, stored as they're used.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== location.origin) return;

  // Navigations → app shell.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match('index.html')) || Response.error()));
    return;
  }
  // Everything else same-origin: cache first, fall back to network and store.
  event.respondWith(cacheFirst(req, url.pathname.includes('/games/') ? GAMES : SHELL));
});

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') (await caches.open(cacheName)).put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}
