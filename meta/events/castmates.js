// Shared pieces for the team side games (the Company Tournament, the Battle
// of the Companies): your 49 castmates as the team page shows them, and
// play schedules for castmates and whole computer teams.
//
// Every schedule is a pure function of the clock, fixed by a seed when the
// event starts (like meta/events/rivals.js): it never reacts to you, and it
// keeps going while the app is closed. Unlike the rival races, these do NOT
// use the Relaxed / Even / Tough leader draw: a team event should not get
// harder for you because your own castmates were drawn slow.
import { TEAM } from '../../config/team.js';
import { USUAL, RIVAL_HOURS, DAY_JITTER } from '../../config/rivals.js';
import { createTeam } from '../team.js';
import { hash, rng } from './util.js';
import { dayStart, addDays, weekday, HOUR, DAY } from './calendar.js';

// The name of your team, for the screens.
export function teamName(ctx) {
  const t = ctx && ctx.team ? ctx.team() : null;
  return (t && t.name) || 'Your company';
}

// Your avatar (an id like 'fox'; ui draws it).
export function yourAvatar(ctx) {
  const t = ctx && ctx.team ? ctx.team() : null;
  return (t && t.avatar) || TEAM.avatars[0];
}

// The 49 castmates: [{ id, name, avatar, level }], the same people the team
// page lists. Without a team in the save (tests, a very old save) a team is
// made up from the event's seed, so there is always someone to play with.
export function castmates(ctx, inst) {
  const t = ctx && ctx.team ? ctx.team() : null;
  // A copy, so that looking at the team never changes the save.
  const team = t
    ? { ...t }
    : { name: 'Your company', seed: hash(inst.seed, 'company'), made: 0, avatar: TEAM.avatars[0], asks: {}, given: [] };
  try {
    return createTeam(() => ({ team, events: {} })).members(ctx && ctx.now ? ctx.now : 0);
  } catch {
    return [];
  }
}

// How many levels a player of YOUR usual pace wins between `startsAt` and
// time `t` (stopping at `endsAt`). Each day has its own small wobble, from
// `seed`. Levels are spread evenly over the waking hours (config/rivals.js).
export function usualLevels(seed, startsAt, endsAt, t) {
  const stop = endsAt === null || endsAt === undefined ? t : Math.min(t, endsAt);
  if (stop <= startsAt) return 0;
  let levels = 0;
  for (let day = dayStart(startsAt); day < stop; day = addDays(day, 1)) {
    const usual = weekday(day) >= 5 ? USUAL.weekend : USUAL.weekday;
    const wobble = 1 + DAY_JITTER * (2 * rng(hash(seed, Math.round(day / DAY)))() - 1);
    const open = day + RIVAL_HOURS.wake * HOUR;
    const close = day + RIVAL_HOURS.sleep * HOUR;
    const from = Math.max(open, startsAt);
    const to = Math.min(close, stop);
    if (to > from) levels += (usual * wobble * (to - from)) / (close - open);
  }
  return levels;
}

// Schedules for `count` castmates. Each plays at `share` of your usual pace
// (drawn between the two numbers, once, from the seed) and scores
// `perLevel` per level. skew 1 = shares spread evenly; 2 = most castmates
// near the low end and a few keen ones near the top (a mean of lo + a
// third of the range). Returns [{ share, scoreAt(t) }].
export function mateSchedules({ seed, count, startsAt, endsAt, share, perLevel = 1, skew = 1 }) {
  const r = rng(hash(seed, 'mates'));
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = share[0] + (share[1] - share[0]) * Math.pow(r(), skew);
    const mySeed = hash(seed, 'mate', i);
    out.push({ share: s, scoreAt: (t) => Math.floor(usualLevels(mySeed, startsAt, endsAt, t) * s * perLevel) });
  }
  return out;
}

// The average share drawn by mateSchedules for [lo, hi] and `skew`.
export const meanShare = ([lo, hi], skew = 1) => lo + (hi - lo) / (skew + 1);
