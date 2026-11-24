// The Box Office (coin shop), its free daily gift and daily deal, and the
// boosters earned by winning (the Stage Door). No screen code. Everything that
// can be tuned is in config/shop.js.
import { SHOP, DROPS } from '../config/shop.js';

// A day number in local time, so "one a day" turns over at midnight.
export function dayNumber(now) {
  const d = new Date(now);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// getSave: gives the current save. rewards: meta/rewards.js.
export function createMarket(getSave, rewards, shop = SHOP, drops = DROPS) {
  const all = () => shop.shelves.flatMap((s) => s.items);

  // What the shop remembers. (Kept with the settings so it travels in the save.)
  function memory() {
    const save = getSave();
    if (!save.settings || typeof save.settings !== 'object') save.settings = {};
    if (!save.settings.market || typeof save.settings.market !== 'object') save.settings.market = {};
    return save.settings.market;
  }

  const api = {
    title: shop.title,

    // { coins, shelves: [{ name, items: [{ id, title, price, reward, owned }] }],
    //   gift: { reward, ready }, deal: { id, title, price, was, reward, ready } }
    view(now) {
      const save = getSave();
      const day = dayNumber(now);
      const m = memory();
      const items = all();
      const deal = items[(day * 7) % items.length];
      return {
        coins: save.coins || 0,
        shelves: shop.shelves.map((s) => ({
          name: s.name,
          items: s.items.map((it) => {
            const kinds = Object.keys(it.reward.boosters || {});
            return { ...it, owned: kinds.length === 1 ? (save.inventory && save.inventory[kinds[0]]) || 0 : null };
          }),
        })),
        gift: { reward: shop.dailyGifts[day % shop.dailyGifts.length], ready: m.giftDay !== day },
        deal: {
          id: 'deal', title: deal.title, reward: deal.reward, was: deal.price,
          price: Math.round((deal.price * shop.dealShare) / 5) * 5, ready: m.dealDay !== day,
        },
      };
    },

    // Buy one thing. Returns { cards } (any cards drawn), or null if there is
    // no such thing, it is gone for today, or there are too few coins.
    buy(id, now) {
      const save = getSave();
      const v = api.view(now);
      const item = id === 'deal' ? (v.deal.ready ? v.deal : null) : all().find((it) => it.id === id);
      if (!item || (save.coins || 0) < item.price) return null;
      save.coins -= item.price;
      if (id === 'deal') memory().dealDay = dayNumber(now);
      return rewards.grant(item.reward, now);
    },

    // Take today's free gift. Returns its reward, or null if already taken.
    takeGift(now) {
      const { gift } = api.view(now);
      if (!gift.ready) return null;
      memory().giftDay = dayNumber(now);
      rewards.grant(gift.reward, now);
      return gift.reward;
    },

    // A level was won or lost: put any boosters it earned in the tray.
    // Returns the line for the results list, or null.
    onLevel({ won, tier, bonus, now }) {
      if (!won) return null;
      const m = memory();
      m.wins = (m.wins || 0) + 1;
      const extra = (drops.byTier || [])[tier];
      if (extra) rewards.add(extra, 'Hard level won', drops.title, now);
      if (bonus && drops.bonusLevel) rewards.add(drops.bonusLevel, 'Benefit Night', drops.title, now);
      if (m.wins % drops.everyWins === 0) {
        const turn = m.wins / drops.everyWins - 1;
        rewards.add(drops.cycle[turn % drops.cycle.length], `${drops.everyWins} levels won`, drops.title, now);
        return { title: drops.title, text: 'new booster' };
      }
      return { title: drops.title, text: `${m.wins % drops.everyWins}/${drops.everyWins} to the next booster` };
    },
  };
  return api;
}
