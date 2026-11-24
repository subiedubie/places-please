// The rewards tray. A reward is never applied silently: every prize is put
// in the tray, and nothing happens until the player claims it.
//   - coins, boosters and card packs are added to the save on claim
//   - a timed boost ("30 minutes of free starting power-ups") starts its
//     clock on claim, so it can be banked until wanted
//   - a timed boost left unclaimed disappears after 24 hours (config/events.js,
//     REWARDS.trayHours); coins, boosters and packs wait for ever
// Kept in the save as:
//   save.rewards = { nextId, items: [RewardItem], active: [{ powers, endsAt }] }
//   save.inventory = { spot, show, prism, drill, stageleft, trapdoor, coinflip }
import { REWARDS } from '../config/events.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// getSave: a function returning the current save object.
// openPack(now): opens one card pack (meta/album.js); may be left out.
export function createRewards(getSave, { openPack = null } = {}) {
  // Rewards added since the list was last taken (for finish()'s newRewards).
  let fresh = [];

  function box() {
    const save = getSave();
    if (!save.rewards || typeof save.rewards !== 'object') save.rewards = {};
    const b = save.rewards;
    if (typeof b.nextId !== 'number') b.nextId = 1;
    if (!Array.isArray(b.items)) b.items = [];
    if (!Array.isArray(b.active)) b.active = [];
    if (!save.inventory || typeof save.inventory !== 'object') save.inventory = {};
    return b;
  }

  // Drop tray items past their time and boosts that have run out.
  function prune(now) {
    const b = box();
    b.items = b.items.filter((item) => {
      if (typeof item.expiresAt !== 'number' || now < item.expiresAt) return true;
      // Only the timed boost runs out; whatever came with it stays.
      const { boost, ...rest } = item.reward || {};
      item.reward = rest;
      item.expiresAt = null;
      return Object.keys(rest).length > 0;
    });
    b.active = b.active.filter((boost) => now < boost.endsAt);
    return b;
  }

  const api = {
    // Put a reward in the tray. title = what it is for ("1st place"),
    // from = the event's title. Returns the RewardItem.
    add(reward, title, from, now) {
      const b = box();
      const item = {
        id: `r${b.nextId++}`,
        title,
        from,
        reward,
        expiresAt: reward && reward.boost ? now + REWARDS.trayHours * HOUR : null,
      };
      b.items.push(item);
      fresh.push(item);
      return item;
    },

    // Unclaimed rewards, oldest first.
    tray(now) {
      return prune(now).items.slice();
    },

    // Apply one reward and take it out of the tray. An id that is not in the
    // tray (already claimed, or expired) does nothing. Returns
    // { cards } - the cards drawn if the reward held packs, else [].
    claim(id, now) {
      const b = prune(now);
      const index = b.items.findIndex((item) => item.id === id);
      if (index < 0) return { cards: [] };
      const [item] = b.items.splice(index, 1);
      return api.grant(item.reward, now);
    },

    // Give a reward straight away (a claim, or something bought in the shop).
    grant(given, now) {
      const b = box();
      const save = getSave();
      const reward = given || {};
      if (reward.coins) save.coins = (save.coins || 0) + reward.coins;
      for (const [kind, count] of Object.entries(reward.boosters || {})) {
        save.inventory[kind] = (save.inventory[kind] || 0) + count;
      }
      if (reward.boost) {
        // The clock starts now.
        b.active.push({ powers: reward.boost.powers.slice(), endsAt: now + reward.boost.minutes * MINUTE });
      }
      const cards = [];
      for (let i = 0; i < (reward.packs || 0); i++) {
        if (openPack) cards.push(...openPack(now));
      }
      return { cards };
    },

    // Timed boosts running now: [{ powers, endsAt }].
    active(now) {
      return prune(now).active.map((boost) => ({ powers: boost.powers.slice(), endsAt: boost.endsAt }));
    },

    // Every power-up the running boosts add to the start of a level.
    startPowers(now) {
      return api.active(now).flatMap((boost) => boost.powers);
    },

    // The rewards added since this was last called.
    takeFresh() {
      const out = fresh;
      fresh = [];
      return out;
    },
  };
  return api;
}
