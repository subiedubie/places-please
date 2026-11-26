// LIVES: hearts that losing costs. One comes back every refillMinutes up to
// the maximum; a refill can be bought; castmates send lives when asked;
// "unlimited lives" prizes stop them being spent for a while.
// Kept in the save as:
//   save.lives = { have, since, unlimitedUntil, incoming: [arrival times] }
//   (since = when the next life started filling)
import { LIVES } from '../config/lives.js';
import { MINUTE } from './events/calendar.js';

export function createLives(getSave, config = LIVES, { maxNow = () => config.max } = {}) {
  function box(now) {
    const s = getSave();
    if (!s.lives || typeof s.lives !== 'object') s.lives = { have: config.max, since: now, unlimitedUntil: 0, incoming: [] };
    const l = s.lives;
    if (!Array.isArray(l.incoming)) l.incoming = [];
    const max = maxNow(now);
    // Castmates' lives that have arrived.
    const arrived = l.incoming.filter((t) => t <= now);
    if (arrived.length) {
      l.incoming = l.incoming.filter((t) => t > now);
      l.have = Math.min(config.overflow, l.have + arrived.length);
    }
    // The clock refills up to the maximum.
    if (l.have >= max) l.since = now;
    else {
      const step = config.refillMinutes * MINUTE;
      const gained = Math.floor((now - l.since) / step);
      if (gained > 0) {
        l.have = Math.min(max, l.have + gained);
        l.since = l.have >= max ? now : l.since + gained * step;
      }
    }
    return l;
  }

  const api = {
    config,
    // { have, max, unlimited (ms left, 0 = none), nextIn (ms to the next life, 0 = full), incoming }
    view(now) {
      const l = box(now);
      const max = maxNow(now);
      return {
        have: l.have,
        max,
        unlimited: Math.max(0, (l.unlimitedUntil || 0) - now),
        nextIn: l.have >= max ? 0 : Math.max(0, l.since + config.refillMinutes * MINUTE - now),
        incoming: l.incoming.length,
        refillCost: config.refillCost,
      };
    },
    canPlay(now) {
      const l = box(now);
      return l.have > 0 || (l.unlimitedUntil || 0) > now;
    },
    // A level lost or quit.
    lose(now) {
      const l = box(now);
      if ((l.unlimitedUntil || 0) > now) return;
      if (l.have >= maxNow(now)) l.since = now; // the refill clock starts now
      l.have = Math.max(0, l.have - 1);
    },
    // Unlimited lives for `minutes` (stacks with any running now).
    unlimited(minutes, now) {
      const l = box(now);
      l.unlimitedUntil = Math.max(now, l.unlimitedUntil || 0) + minutes * MINUTE;
    },
    // Fill up for coins. true if bought.
    refill(now) {
      const s = getSave();
      const l = box(now);
      const max = maxNow(now);
      if (l.have >= max || (s.coins || 0) < config.refillCost) return false;
      s.coins -= config.refillCost;
      l.have = max;
      l.since = now;
      return true;
    },
    // Lives coming from castmates at these times.
    expect(times, now) {
      const l = box(now);
      l.incoming.push(...times);
    },
  };
  return api;
}
