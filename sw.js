// Service worker: keeps a copy of every game file on the device so the game
// opens with no network.
//
// To publish an update:
//   1. run `node tools/update-sw-list.js` (rewrites the list below)
//   2. raise the version number in CACHE (v1 -> v2 -> ...)
const CACHE = 'places-please-v26';

// The list between the two markers is written by tools/update-sw-list.js.
// Do not edit it by hand.
// FILES-START
const FILES = [
  './',
  './art/atlas.js',
  './art/atlas.webp',
  './art/fonts/lilita-one-OFL.txt',
  './art/fonts/lilita-one.woff2',
  './art/fonts/limelight-OFL.txt',
  './art/fonts/limelight.woff2',
  './config/album.js',
  './config/calendar.js',
  './config/curve.js',
  './config/economy.js',
  './config/events.js',
  './config/help.js',
  './config/lives.js',
  './config/obstacles.js',
  './config/rescue.js',
  './config/rivals.js',
  './config/shop.js',
  './config/team.js',
  './config/theme.js',
  './config/twists.js',
  './engine/board.js',
  './engine/boosters.js',
  './engine/drops.js',
  './engine/finale.js',
  './engine/game.js',
  './engine/live.js',
  './engine/matches.js',
  './engine/moves.js',
  './engine/powers.js',
  './engine/resolve.js',
  './engine/rng.js',
  './engine/twists.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './levels/generate.js',
  './levels/sets.js',
  './levels/twists.js',
  './manifest.webmanifest',
  './meta/album.js',
  './meta/economy.js',
  './meta/events/archery.js',
  './meta/events/battle.js',
  './meta/events/bracket.js',
  './meta/events/calendar.js',
  './meta/events/castmates.js',
  './meta/events/chest.js',
  './meta/events/circuit.js',
  './meta/events/company.js',
  './meta/events/control.js',
  './meta/events/dash.js',
  './meta/events/dig.js',
  './meta/events/firewalk.js',
  './meta/events/index.js',
  './meta/events/ladder.js',
  './meta/events/missions.js',
  './meta/events/pairs.js',
  './meta/events/parade.js',
  './meta/events/pursuit.js',
  './meta/events/quota.js',
  './meta/events/race.js',
  './meta/events/rivals.js',
  './meta/events/season.js',
  './meta/events/sprint.js',
  './meta/events/streak.js',
  './meta/events/tournament.js',
  './meta/events/util.js',
  './meta/events/voyage.js',
  './meta/history.js',
  './meta/lives.js',
  './meta/market.js',
  './meta/rescue.js',
  './meta/rewards.js',
  './meta/save.js',
  './meta/session.js',
  './meta/shop.js',
  './meta/team.js',
  './ui/anim.js',
  './ui/art.js',
  './ui/boosters.js',
  './ui/eventicons.js',
  './ui/events.css',
  './ui/events.js',
  './ui/fancy.css',
  './ui/fly.js',
  './ui/fx.js',
  './ui/games/archery.js',
  './ui/games/balloon.js',
  './ui/games/battle.js',
  './ui/games/board.js',
  './ui/games/cannon.js',
  './ui/games/circuit.js',
  './ui/games/climb.js',
  './ui/games/control.js',
  './ui/games/dig.js',
  './ui/games/firewalk.js',
  './ui/games/games.css',
  './ui/games/index.js',
  './ui/games/kit.js',
  './ui/games/lanes.js',
  './ui/games/packs.js',
  './ui/games/pairs.js',
  './ui/games/pass.js',
  './ui/games/pinata.js',
  './ui/games/plinko.js',
  './ui/games/pot.js',
  './ui/games/pursuit.js',
  './ui/games/rescue.js',
  './ui/games/showkit.js',
  './ui/games/teamkit.js',
  './ui/games/tour.js',
  './ui/games/tournament.js',
  './ui/help.css',
  './ui/help.js',
  './ui/input.js',
  './ui/live.js',
  './ui/main.js',
  './ui/render.js',
  './ui/screens.js',
  './ui/shop.css',
  './ui/shop.js',
  './ui/stage.js',
  './ui/style.css',
  './ui/watch.js',
  './vendor/pixi-LICENSE.txt',
  './vendor/pixi.min.js',
];
// FILES-END

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch((error) => {
        // Offline and not in the cache: a page load still gets the game.
        if (request.mode === 'navigate') {
          return caches.match('./index.html').then((page) => page || Promise.reject(error));
        }
        throw error;
      });
    })
  );
});
