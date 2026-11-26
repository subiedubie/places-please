// THE FIRE WALK. A new walk every day, midnight to midnight (local time).
// Press Start and you step out with 99 other players onto seven stepping
// stones across a pit of glowing stage coals. Every level you WIN ON THE
// FIRST TRY hops you one stone further. Lose a level, or win one that was a
// retry, and you slip off (a puff of smoke, back to the shore): that is the
// walk over until tomorrow. Everyone who reaches the far side splits the pot.
//
// The 99 others are computer players. Each day's crowd is fixed by the seed
// and the date the moment the day begins, and never reacts to you: for each
// one it is decided on which stone they slip (most slip early) or that they
// make it across, and at what time of day each of their hops happens.
//
// The event runs in an 'always' calendar slot (it never ends); this file
// turns it over at every midnight itself, so the chosen avatar is kept.
//
// Saved: inst.data = {
//   day,        // midnight that starts the day being played
//   avatar,     // the chosen walker: 'piggy' | 'cat' | 'fox' | 'owl' | 'bunny'
//   stone,      // stones crossed today (0..stones)
//   fell,       // the stone you slipped on today (0 = did not slip)
//   startedAt,  // when Start was pressed today (null = not yet)
//   finishedAt, share, winners,   // once across: the time, your coins, how many split
//   seen,       // how many of today's hops the play screen has already shown
//   seenEnd,    // the play screen has shown today's ending (slip or finish)
//   seenStart,  // the play screen has shown today's crowd of 100
//   last,       // yesterday in one line: { result, stone, share, winners, finishers }
// }
import { hash, rng, between, scaleReward } from './util.js';
import { dayStart, addDays, DAY, HOUR, MINUTE } from './calendar.js';

// Today's 99 computer players (rebuilt from the seed each time; nothing is
// stored). Returns { luck, list: [{ fall, times, finishAt }] } where
//   fall      the stone they slip on (1..stones), or stones + 1 = made it
//   times     the time of each stone they reached (a slip happens at the
//             time of the stone they slipped on)
//   finishAt  when they reached the far side, or null
export function walkers(inst, cfg, day) {
  const r = rng(hash(inst.seed, 'firewalk', Math.round(day / DAY)));
  // One draw per day makes the whole crowd a little luckier or unluckier,
  // so some days end with one winner and some with ten.
  const luck = between(r, cfg.luck);
  const list = [];
  for (let i = 0; i < cfg.rivals; i++) {
    let fall = cfg.stones + 1;
    for (let s = 1; s <= cfg.stones; s++) {
      const keep = Math.min(0.99, cfg.survive[s - 1] * luck);
      if (r() >= keep) { fall = s; break; }
    }
    let t = day + between(r, cfg.rivalStartHours) * HOUR;
    const times = [];
    for (let s = 1; s <= Math.min(fall, cfg.stones); s++) {
      t += between(r, cfg.stoneMinutes) * MINUTE;
      times.push(t);
    }
    list.push({ fall, times, finishAt: fall > cfg.stones ? times[cfg.stones - 1] : null });
  }
  return { luck, list };
}

// Players still on the stones after stone k (counting you, who got there).
export function leftAfter(crowd, k) {
  return 1 + crowd.list.filter((w) => w.fall > k).length;
}

// How many of the computer players make it across today.
export const finishersOf = (crowd, cfg) => crowd.list.filter((w) => w.fall > cfg.stones).length;

function fresh(day, avatar) {
  return {
    day, avatar, stone: 0, fell: 0, startedAt: null, finishedAt: null, share: 0, winners: 0,
    seen: 0, seenEnd: false, seenStart: false, last: null,
  };
}

// A new day: note how yesterday went and lay out today.
function roll(inst, cfg, now) {
  const day = dayStart(now);
  const d = inst.data || {};
  if (d.day === day) return;
  const avatar = cfg.avatars.includes(d.avatar) ? d.avatar : cfg.avatars[0];
  let last = null;
  if (Number.isFinite(d.day)) {
    const result = inst.state === 'won' ? 'won' : inst.state === 'lost' ? 'slipped' : inst.state === 'running' ? 'timeout' : 'skipped';
    last = { result, stone: d.stone || 0, share: d.share || 0, winners: d.winners || 0, finishers: finishersOf(walkers(inst, cfg, d.day), cfg) + (result === 'won' ? 1 : 0) };
  }
  inst.data = fresh(day, avatar);
  inst.data.last = last;
  inst.state = 'offer';
  inst.done = false;
}

function startWalk(inst, ctx) {
  if (inst.state !== 'offer') return false;
  inst.state = 'running';
  inst.data.startedAt = ctx.now;
  return true;
}

export default {
  begin(inst, cfg, ctx) {
    inst.data = {};
    roll(inst, cfg, ctx.now);
  },

  tick(inst, cfg, ctx) {
    roll(inst, cfg, ctx.now);
  },

  start(inst, cfg, ctx) {
    roll(inst, cfg, ctx.now);
    startWalk(inst, ctx);
  },

  onLevel(inst, cfg, res, ctx) {
    roll(inst, cfg, ctx.now);
    if (inst.state !== 'running') return null;
    const d = inst.data;
    // A loss, or a win that was a retry: you slip off this stone.
    if (!res.won || res.firstAttempt === false) {
      d.fell = d.stone + 1;
      inst.state = 'lost';
      return `Slipped off stone ${d.fell}: back tomorrow`;
    }
    d.stone++;
    const crowd = walkers(inst, cfg, d.day);
    if (d.stone >= cfg.stones) {
      d.winners = 1 + finishersOf(crowd, cfg);
      const pot = scaleReward({ coins: cfg.pot }, inst.scale).coins;
      d.share = Math.round(pot / d.winners);
      d.finishedAt = ctx.now;
      ctx.pay({ coins: d.share }, d.winners === 1 ? 'The whole pot' : `Split ${d.winners} ways`, false);
      inst.state = 'won';
      return `Across! ${d.share.toLocaleString('en-US')} coins`;
    }
    return `Stone ${d.stone}/${cfg.stones}: ${leftAfter(crowd, d.stone)} left`;
  },

  // The play screen's moves:
  //   { start: true }        press Start (same as the sheet's Start button)
  //   { avatar: 'fox' }      choose your walker
  //   { seen: n }            the screen has shown hops up to stone n
  //   { seenEnd: true }      the screen has shown today's slip or finish
  //   { seenStart: true }    the screen has shown the crowd of 100
  act(inst, cfg, action, ctx) {
    roll(inst, cfg, ctx.now);
    const d = inst.data;
    if (!action || typeof action !== 'object') return { ok: false };
    if (action.start) return { ok: startWalk(inst, ctx), state: inst.state };
    if (typeof action.avatar === 'string') {
      if (!cfg.avatars.includes(action.avatar)) return { ok: false };
      d.avatar = action.avatar;
      return { ok: true, avatar: d.avatar };
    }
    if (Number.isInteger(action.seen)) {
      d.seen = Math.max(d.seen, Math.min(action.seen, d.stone));
      return { ok: true, seen: d.seen };
    }
    if (action.seenEnd) { d.seenEnd = inst.state === 'won' || inst.state === 'lost'; return { ok: true }; }
    if (action.seenStart) { d.seenStart = inst.state !== 'offer'; return { ok: true }; }
    return { ok: false };
  },

  view(inst, cfg, ctx) {
    roll(inst, cfg, ctx.now);
    const d = inst.data;
    const crowd = walkers(inst, cfg, d.day);
    const endsAt = addDays(d.day, 1);
    const pot = scaleReward({ coins: cfg.pot }, inst.scale).coins;
    // Players left after each stone you have reached (only those: what is
    // still ahead stays hidden). crowd[0] is the 100 who started.
    const counts = [];
    for (let k = 0; k <= d.stone; k++) counts.push(leftAfter(crowd, k));
    const left = counts[counts.length - 1];
    const finishedSoFar = crowd.list.filter((w) => w.finishAt !== null && w.finishAt <= ctx.now).length;
    const st = inst.state;
    const summary = st === 'offer' ? `${cfg.rivals + 1} players, ${cfg.stones} stones`
      : st === 'won' ? 'Complete'
        : st === 'lost' ? `Slipped on stone ${d.fell}/${cfg.stones}`
          : `stone ${d.stone}/${cfg.stones} · ${left} left`;
    return {
      // Today's walk ends at midnight (the instance itself never ends).
      endsAt,
      summary,
      progress: { have: d.stone, need: cfg.stones },
      prizes: [{ place: 1, reward: { coins: pot } }],
      game: {
        kind: 'firewalk',
        button: st === 'offer' ? 'Start' : 'Play',
        state: st,
        stones: cfg.stones,
        stone: d.stone,
        fell: d.fell,
        players: cfg.rivals + 1,
        counts,
        left,
        pot,
        share: d.share,
        winners: d.winners,
        others: Math.max(0, d.winners - 1),
        finishedSoFar,
        endsAt,
        startedAt: d.startedAt,
        avatar: d.avatar,
        avatars: cfg.avatars.slice(),
        seen: d.seen,
        seenEnd: d.seenEnd,
        seenStart: d.seenStart,
        last: d.last,
      },
    };
  },
};
