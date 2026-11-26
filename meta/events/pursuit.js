// MISSION PURSUIT (type 'pursuit'). Three races, one after another: first
// to win 3 levels, then first to 5, then first to 7. Seven runners in each
// race (you and 6 computer players). The wins do not have to be in a row:
// a lost level just does not move you. Finish first and the race's prize is
// yours and the next race waits for you to press Start. If a computer
// player gets there first, that race is lost: it starts over (when you
// press Start) against new runners.
//
// Each race begins when you press Start, so nobody runs while you are away.
// The runners' finishing times are fixed by the seed the moment the race
// starts (meta/events/rivals.js burstRivals); they never react to you.
//
// Saved: inst.data = {
//   race,       races won so far (0..3); the one being run is races[race]
//   tries,      starts of this race so far (new runners each time)
//   startedAt,  when this race was started (null = waiting for Start)
//   wins,       your wins in this race
//   lost,       { race, by, at } the last race lost, for the screen
//   won,        [{ race, at, time }] races won
//   seenWon,    how many of those the screen has celebrated
// }
import { burstRivals } from './rivals.js';
import { TEAM } from '../../config/team.js';
import { hash, rng, scaleReward } from './util.js';

// The computer runners of the race being run: [{ name, avatar, total,
// finishAt, scoreAt(t) }]. null when no race is running.
export function runnersOf(inst, cfg) {
  const d = inst.data;
  if (d.startedAt === null || d.race >= cfg.targets.length) return null;
  const target = cfg.targets[d.race];
  const seed = hash(inst.seed, 'race', d.race, d.tries);
  const r = rng(hash(seed, 'avatars'));
  return burstRivals({
    seed,
    count: cfg.rivals,
    pace: inst.pace,
    startsAt: d.startedAt,
    total: target,
    minutes: [cfg.minutesPerWin[0] * target, cfg.minutesPerWin[1] * target],
  }).map((x) => ({ ...x, avatar: TEAM.avatars[Math.floor(r() * TEAM.avatars.length)] }));
}

// Has a runner finished before time t? Then the race is lost.
function checkLost(inst, cfg, t) {
  const d = inst.data;
  const runners = runnersOf(inst, cfg);
  if (!runners) return false;
  const first = runners.reduce((a, b) => (b.finishAt < a.finishAt ? b : a));
  if (first.finishAt > t) return false;
  d.lost = { race: d.race, by: first.name, at: first.finishAt };
  d.startedAt = null;
  d.wins = 0;
  d.tries++;
  inst.state = 'offer';
  return true;
}

function start(inst, cfg, now) {
  const d = inst.data;
  if (inst.done || d.startedAt !== null || d.race >= cfg.targets.length) return false;
  if (inst.endsAt !== null && now >= inst.endsAt) return false;
  d.startedAt = now;
  d.wins = 0;
  d.lost = null;
  inst.state = 'running';
  return true;
}

export default {
  begin(inst) {
    inst.data = { race: 0, tries: 0, startedAt: null, wins: 0, lost: null, won: [], seenWon: 0 };
    inst.state = 'offer';
  },

  // The Start button on the event's sheet.
  start(inst, cfg, ctx) {
    start(inst, cfg, ctx.now);
  },

  tick(inst, cfg, ctx) {
    if (!inst.done) checkLost(inst, cfg, ctx.now);
  },

  onLevel(inst, cfg, res, ctx) {
    const d = inst.data;
    if (inst.done || d.startedAt === null) return null;
    if (checkLost(inst, cfg, ctx.now)) return `${d.lost.by} won race ${d.lost.race + 1}`;
    if (!res.won) return null;
    d.wins++;
    const target = cfg.targets[d.race];
    if (d.wins < target) return `${d.wins}/${target} in race ${d.race + 1}`;
    // First across the line.
    ctx.pay(cfg.races[d.race].reward, `Race ${d.race + 1} won`);
    d.won.push({ race: d.race, at: ctx.now, time: ctx.now - d.startedAt });
    d.race++;
    d.startedAt = null;
    d.wins = 0;
    d.tries = 0;
    if (d.race >= cfg.targets.length) {
      inst.state = 'won';
      inst.done = true;
      return 'All three races won!';
    }
    inst.state = 'offer';
    return `Race ${d.race} won!`;
  },

  // action = { start: true }  -> { ok, started }
  //          { seenWon: n }   the screen has celebrated n races won
  act(inst, cfg, action, ctx) {
    if (action && Number.isInteger(action.seenWon)) inst.data.seenWon = Math.max(inst.data.seenWon || 0, Math.min(action.seenWon, inst.data.won.length));
    if (action && action.start) return { ok: true, started: start(inst, cfg, ctx.now) };
    checkLost(inst, cfg, ctx.now);
    return { ok: true };
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const now = ctx.now;
    const over = d.race >= cfg.targets.length;
    const runners = runnersOf(inst, cfg) || [];
    const target = over ? cfg.targets[cfg.targets.length - 1] : cfg.targets[d.race];
    const lanes = runners.map((x) => ({ name: x.name, have: Math.min(target, x.scoreAt(now)), need: target, you: false, avatar: x.avatar, finishAt: x.finishAt }));
    lanes.splice(3, 0, { name: 'You', have: d.wins, need: target, you: true, avatar: (ctx.team && ctx.team()?.avatar) || TEAM.avatars[0] });
    const running = d.startedAt !== null && !over;
    return {
      summary: over ? 'All three won' : running ? `race ${d.race + 1}: ${d.wins}/${target}` : `race ${d.race + 1} · first to ${target}`,
      progress: over ? null : { have: d.wins, need: target },
      lanes: running ? lanes.map(({ name, have, need, you }) => ({ name, have, need, you })) : null,
      steps: cfg.targets.map((t, i) => ({ need: t, reward: scaleReward(cfg.races[i].reward, inst.scale), done: i < d.race, current: i === d.race })),
      prizes: [{ place: 1, reward: scaleReward(cfg.races[Math.min(d.race, cfg.races.length - 1)].reward, inst.scale) }],
      game: {
        kind: 'pursuit',
        button: running ? 'Play' : 'Start',
        race: d.race,
        targets: cfg.targets,
        target,
        wins: d.wins,
        running,
        over,
        startedAt: d.startedAt,
        tries: d.tries,
        lanes: running ? lanes : [],
        avatar: (ctx.team && ctx.team()?.avatar) || TEAM.avatars[0],
        lost: d.lost,
        won: d.won,
        // Races won that the screen has not celebrated yet: [race numbers].
        fresh: d.won.slice(d.seenWon || 0).map((w) => w.race),
        seenWon: d.won.length,
        rewards: cfg.races.map((r) => scaleReward(r.reward, inst.scale)),
        minutesPerWin: cfg.minutesPerWin,
        now,
        endsAt: inst.endsAt,
      },
    };
  },
};
