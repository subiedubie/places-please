// The card album (Playbill). One album a month: 9 sets of 9 cards; the last
// card of each set is a gold card. Packs are drawn by seeded chance, so the
// same save always draws the same cards. Extra copies are kept: they are what
// you give to castmates who ask. Once a day you may ask your company for a
// card you are missing. Set names, card names, weights and prizes are in
// config/album.js.
// Kept in the save as:
//   save.album = { month: '2026-11', seed, opened, owned: { 'set-card': count },
//                  setsPaid: [set numbers], grandPaid,
//                  ask: { s, c, at, arrivesAt, from, ok, done } | null }
import { ALBUM } from '../config/album.js';
import { monthAt, MINUTE, HOUR } from './events/calendar.js';
import { hash, rng } from './events/util.js';

// getSave: a function returning the current save object.
// rewards: the tray (meta/rewards.js), for set and album prizes.
// team: meta/team.js (castmates' names and their requests), optional.
// count: (name, n) adds to the events' running totals, optional.
export function createAlbum(getSave, rewards, config = ALBUM, team = null, count = null) {
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
        ask: null,
      };
    }
    const a = save.album;
    if (!a.owned || typeof a.owned !== 'object') a.owned = {};
    if (!Array.isArray(a.setsPaid)) a.setsPaid = [];
    // A card you asked for arrives.
    if (a.ask && !a.ask.done && now >= a.ask.arrivesAt) {
      a.ask.done = true;
      if (a.ask.ok) add(a, a.ask.s, a.ask.c, now);
    }
    return a;
  }

  const cardId = (s, c) => `${s}-${c}`;
  const isGold = (c) => c === config.goldCard;
  const have = (a, s, c) => a.owned[cardId(s, c)] || 0;
  const setDone = (a, s) => config.sets[s].cards.every((_, c) => have(a, s, c) > 0);

  function add(a, s, c, now) {
    a.owned[cardId(s, c)] = have(a, s, c) + 1;
    if (count) count('cards', 1);
    payFinished(a, now);
  }

  // Pay any set finished, and the album if it is complete (once each).
  function payFinished(a, now) {
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
  }

  // Draw one card: pick its stars by weight, then a card of those stars,
  // missing cards more likely. goldOnly: draw a gold card (else never gold).
  function draw(a, r, weights, goldOnly) {
    const pool = [];
    config.sets.forEach((set, s) => set.stars.forEach((stars, c) => {
      if (goldOnly ? !isGold(c) : isGold(c)) return;
      pool.push({ s, c, stars });
    }));
    // Each card's chance: its star weight shared among the cards of that
    // rating, times newCardBoost if you do not have it yet.
    const per = {};
    for (const p of pool) per[p.stars] = (per[p.stars] || 0) + 1;
    const wts = pool.map((p) => ((weights[p.stars] || 0) / per[p.stars]) * (have(a, p.s, p.c) ? 1 : goldOnly ? config.newGoldBoost : config.newCardBoost));
    let y = r() * wts.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < pool.length; i++) {
      y -= wts[i];
      if (y < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function cardOut(a, s, c, isNew) {
    return {
      setIndex: s,
      cardIndex: c,
      set: config.sets[s].name,
      name: config.sets[s].cards[c],
      stars: config.sets[s].stars[c],
      gold: isGold(c),
      isNew,
      count: have(a, s, c),
      setHave: config.sets[s].cards.filter((_, k) => have(a, s, k) > 0).length,
    };
  }

  // Which card a castmate's request is for (from its `pick`): any card that
  // is not gold.
  function requestedCard(pick) {
    const plain = [];
    config.sets.forEach((set, s) => set.cards.forEach((_, c) => { if (!isGold(c)) plain.push([s, c]); }));
    return plain[Math.floor(pick * plain.length) % plain.length];
  }

  const api = {
    // Open one pack (gold = a gold pack). Returns the cards drawn:
    //   [{ setIndex, cardIndex, set, name, stars, gold, isNew, count, setHave }]
    // A finished set or album puts its prize in the tray, once.
    openPack(now, gold = false) {
      const a = book(now);
      const r = rng(hash(a.seed, 'pack', a.opened));
      a.opened++;
      const [lo, hi] = gold ? config.goldPackSize : config.packSize;
      const size = lo + Math.floor(r() * (hi - lo + 1));
      const cards = [];
      for (let i = 0; i < size; i++) {
        const goldNow = gold && i === size - 1; // the last card of a gold pack is gold
        const p = draw(a, r, gold ? config.goldStarWeights : config.starWeights, goldNow);
        const isNew = !have(a, p.s, p.c);
        a.owned[cardId(p.s, p.c)] = have(a, p.s, p.c) + 1;
        cards.push(cardOut(a, p.s, p.c, isNew));
      }
      if (count) count('cards', cards.length);
      payFinished(a, now);
      return cards;
    },

    // Ask your company for card (s, c). Only a missing, non-gold card, and
    // only once every requestHours. Returns true if asked.
    ask(s, c, now) {
      const a = book(now);
      if (!config.sets[s] || isGold(c) || have(a, s, c) > 0) return false;
      if (a.ask && now - a.ask.at < config.requestHours * HOUR) return false;
      const r = rng(hash(a.seed, 'ask', now));
      const mins = config.requestMinutes[0] + r() * (config.requestMinutes[1] - config.requestMinutes[0]);
      a.ask = {
        s, c, at: now,
        arrivesAt: now + mins * MINUTE,
        ok: r() < config.requestChance,
        from: team ? team.pickName(`card${now}`, now) : 'A castmate',
        done: false,
      };
      return true;
    },

    // Give an extra copy to a castmate who asked (request id from the view).
    give(id, now) {
      const a = book(now);
      if (!team) return false;
      const q = team.openRequests(now).find((x) => x.id === id && x.kind === 'card');
      if (!q) return false;
      const [s, c] = requestedCard(q.pick);
      if (have(a, s, c) < 2) return false; // keep your own copy
      a.owned[cardId(s, c)]--;
      team.helped(id, now);
      if (team.config.helpReward) rewards.add(team.config.helpReward, `Card for ${q.member.name}`, config.title, now);
      return true;
    },

    // The album as the screens show it (AlbumView in docs/EVENTS.md, plus
    // copies, gold cards, your request and your castmates' requests).
    view(now) {
      const a = book(now);
      let owned = 0;
      let total = 0;
      const sets = config.sets.map((set, s) => ({
        name: set.name,
        cards: set.cards.map((name, c) => {
          const n = have(a, s, c);
          total++;
          if (n) owned++;
          return { name, stars: set.stars[c], owned: n > 0, count: n, gold: isGold(c) };
        }),
        done: setDone(a, s),
        reward: config.setReward,
      }));
      const canAskAt = a.ask ? a.ask.at + config.requestHours * HOUR : 0;
      const ask = a.ask ? {
        set: a.ask.s, card: a.ask.c, name: config.sets[a.ask.s].cards[a.ask.c],
        from: a.ask.from, arrivesAt: a.ask.arrivesAt,
        state: !a.ask.done ? 'waiting' : a.ask.ok ? 'arrived' : 'none',
      } : null;
      const asks = team ? team.openRequests(now).filter((q) => q.kind === 'card').map((q) => {
        const [s, c] = requestedCard(q.pick);
        return {
          id: q.id, member: q.member.name, avatar: q.member.avatar,
          set: s, card: c, name: config.sets[s].cards[c], stars: config.sets[s].stars[c],
          canGive: have(a, s, c) >= 2, closesAt: q.closesAt,
        };
      }) : [];
      return {
        month: a.month, sets, owned, total, grandPrize: config.grandPrize, endsAt: monthAt(now).end,
        ask, canAskAt, askHours: config.requestHours, asks,
      };
    },
  };
  return api;
}
