// The card album (Playbill). One album a month: 9 sets of 9 cards. Packs
// are drawn by seeded chance, so the same save always draws the same cards.
// Set names, card names, star weights and prizes are in config/album.js.
// Kept in the save as:
//   save.album = { month: '2026-11', seed, opened, owned: { 'set-card': count },
//                  setsPaid: [set numbers], grandPaid }
import { ALBUM } from '../config/album.js';
import { monthAt } from './events/calendar.js';
import { hash, rng } from './events/util.js';

// getSave: a function returning the current save object.
// rewards: the tray (meta/rewards.js), for set and album prizes.
export function createAlbum(getSave, rewards, config = ALBUM) {
  // The album for the month `now` is in; starts a new one on the 1st.
  function book(now) {
    const save = getSave();
    const month = monthAt(now);
    if (!save.album || typeof save.album !== 'object' || save.album.month !== month.key) {
      save.album = {
        month: month.key,
        seed: hash(save.events?.seed || 0, 'album', month.key),
        opened: 0,
        owned: {},
        setsPaid: [],
        grandPaid: false,
      };
    }
    const a = save.album;
    if (!a.owned || typeof a.owned !== 'object') a.owned = {};
    if (!Array.isArray(a.setsPaid)) a.setsPaid = [];
    return a;
  }

  const cardId = (s, c) => `${s}-${c}`;
  const setDone = (a, s) => config.sets[s].cards.every((_, c) => a.owned[cardId(s, c)] > 0);

  // Every card of each star rating, as [set, card] pairs.
  const byStars = {};
  config.sets.forEach((set, s) => {
    set.stars.forEach((stars, c) => {
      (byStars[stars] ||= []).push([s, c]);
    });
  });

  // Pick a star rating by the weights in the config.
  function drawStars(r) {
    const entries = Object.entries(config.starWeights).filter(([stars]) => byStars[stars]);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let x = r() * total;
    for (const [stars, w] of entries) {
      x -= w;
      if (x < 0) return Number(stars);
    }
    return Number(entries[entries.length - 1][0]);
  }

  return {
    // Open one pack. Returns the cards drawn:
    //   [{ set, name, stars, isNew, coins }]  (coins > 0 for a duplicate)
    // New cards are added to the album; duplicate coins go straight to the
    // save (the pack itself was already claimed from the tray). A finished
    // set or album puts its prize in the tray, once.
    openPack(now) {
      const a = book(now);
      const save = getSave();
      const r = rng(hash(a.seed, 'pack', a.opened));
      a.opened++;
      const [lo, hi] = config.packSize;
      const size = lo + Math.floor(r() * (hi - lo + 1));
      const cards = [];
      for (let i = 0; i < size; i++) {
        const stars = drawStars(r);
        const list = byStars[stars];
        const [s, c] = list[Math.floor(r() * list.length)];
        const id = cardId(s, c);
        const isNew = !a.owned[id];
        a.owned[id] = (a.owned[id] || 0) + 1;
        const coins = isNew ? 0 : config.duplicateCoins[stars] || 0;
        if (coins) save.coins = (save.coins || 0) + coins;
        cards.push({ set: config.sets[s].name, name: config.sets[s].cards[c], stars, isNew, coins });
      }
      // Pay any set finished by this pack, and the album if it is complete.
      config.sets.forEach((set, s) => {
        if (setDone(a, s) && !a.setsPaid.includes(s)) {
          a.setsPaid.push(s);
          rewards.add(config.setReward, `${set.name} complete`, config.title, now);
        }
      });
      if (!a.grandPaid && config.sets.every((_, s) => setDone(a, s))) {
        a.grandPaid = true;
        rewards.add(config.grandPrize, 'Album complete', config.title, now);
      }
      return cards;
    },

    // The album as the screens show it (AlbumView in docs/EVENTS.md).
    view(now) {
      const a = book(now);
      let owned = 0;
      let total = 0;
      const sets = config.sets.map((set, s) => ({
        name: set.name,
        cards: set.cards.map((name, c) => {
          const have = a.owned[cardId(s, c)] > 0;
          total++;
          if (have) owned++;
          return { name, stars: set.stars[c], owned: have };
        }),
        done: setDone(a, s),
        reward: config.setReward,
      }));
      return { month: a.month, sets, owned, total, grandPrize: config.grandPrize, endsAt: monthAt(now).end };
    },
  };
}
