// Computer rivals and teammates. Each one's score is a pure function of
// time, worked out from a seed: scoreAt(t) gives the same answer whenever it
// is asked and whatever the player has done. Nothing is stored; the rivals
// are rebuilt from the seed each time, so they "keep playing" while the app
// is closed. The paces are in config/rivals.js.
import { PACES, DEFAULT_PACE, USUAL, RIVAL_HOURS, DAY_JITTER, RIVAL_NAMES } from '../../config/rivals.js';
import { hash, rng, between } from './util.js';
import { dayStart, addDays, weekday, HOUR, DAY, MINUTE } from './calendar.js';

export function paceTable(name) {
  return PACES[name] || PACES[DEFAULT_PACE];
}

// `count` different names, chosen by the seed.
export function rivalNames(seed, count) {
  const r = rng(hash(seed, 'names'));
  const pool = RIVAL_NAMES.slice();
  const out = [];
  for (let i = 0; i < count; i++) {
    if (pool.length === 0) {
      out.push(`Player ${i + 1}`);
      continue;
    }
    out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }
  return out;
}

// Rivals for events that last days (races, the shared pot).
//   seed       the event's seed
//   count      how many rivals
//   pace       'relaxed' | 'even' | 'tough'
//   startsAt, endsAt   the event's times; scores are 0 before the start and
//              stop growing at the end
//   perLevel   points per level a rival wins
// Returns [{ name, scoreAt(t) }].
export function dailyRivals({ seed, count, pace, startsAt, endsAt, perLevel = 1 }) {
  const table = paceTable(pace);
  const names = rivalNames(seed, count);
  const r = rng(hash(seed, 'pace'));
  // One rival is the leader; the rest play at a share of the leader's pace.
  const leader = between(r, table.leader);
  const leaderIndex = Math.floor(r() * count);
  const rivals = [];
  for (let i = 0; i < count; i++) {
    const share = i === leaderIndex ? leader : leader * between(r, table.pack);
    const mySeed = hash(seed, 'rival', i);
    rivals.push({
      name: names[i],
      scoreAt(t) {
        const stop = endsAt === null || endsAt === undefined ? t : Math.min(t, endsAt);
        if (stop <= startsAt) return 0;
        let levels = 0;
        // Add up each day: the day's levels are spread evenly over the
        // rival's waking hours.
        for (let day = dayStart(startsAt); day < stop; day = addDays(day, 1)) {
          const usual = weekday(day) >= 5 ? USUAL.weekend : USUAL.weekday;
          const wobble = 1 + DAY_JITTER * (2 * rng(hash(mySeed, Math.round(day / DAY)))() - 1);
          const open = day + RIVAL_HOURS.wake * HOUR;
          const close = day + RIVAL_HOURS.sleep * HOUR;
          const from = Math.max(open, startsAt);
          const to = Math.min(close, stop);
          if (to > from) levels += (usual * share * wobble * (to - from)) / (close - open);
        }
        return Math.floor(levels * perLevel);
      },
    });
  }
  return rivals;
}

// Rivals for short timed events (dash, sprint, bracket, staged streak).
// Each one climbs from 0 to its total over its own length of time.
//   total     the final score: a number, or [lo, hi] to draw one per rival
//             (a drawn total is multiplied by the pace table's `speed`)
//   minutes   how long the climb takes: a number, or [lo, hi] to draw one
//             per rival (a drawn time is divided by `speed`)
// Returns [{ name, total, finishAt, scoreAt(t) }].
export function burstRivals({ seed, count, pace, startsAt, total, minutes }) {
  const table = paceTable(pace);
  const names = rivalNames(seed, count);
  const r = rng(hash(seed, 'burst'));
  const rivals = [];
  for (let i = 0; i < count; i++) {
    const myTotal = Array.isArray(total) ? Math.round(between(r, total) * table.speed) : total;
    const myMinutes = Array.isArray(minutes) ? between(r, minutes) / table.speed : minutes;
    const length = myMinutes * MINUTE;
    // Below 1 = quick start then slowing; above 1 = slow start then a rush.
    const shape = between(r, [0.8, 1.3]);
    rivals.push({
      name: names[i],
      total: myTotal,
      finishAt: startsAt + length,
      scoreAt(t) {
        if (t <= startsAt) return 0;
        if (t >= startsAt + length) return myTotal;
        return Math.floor(myTotal * Math.pow((t - startsAt) / length, shape));
      },
    });
  }
  return rivals;
}
