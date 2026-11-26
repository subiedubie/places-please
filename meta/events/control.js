// MISSION CONTROL (type 'control'). Four tasks on the board, each tied to
// what you do across the whole game: win levels, earn coins from levels,
// collect album cards, find jewels Under the Stage, match Costume Pairs,
// win prizes in the other side games. Each task finished pays its own
// prize; when all four are done the fifth, bigger prize is paid by itself.
//
// Progress is the growth of the game's running totals (ctx.counters(),
// kept by meta/events/index.js) since the event began. The four tasks are
// drawn by seed from cfg.pool, all on different totals, and only from
// tasks whose side game is on the calendar this block (`with`).
//
// Saved: inst.data = {
//   base,     the running totals when the event began
//   tasks,    the four chosen: [{ pool: index in cfg.pool, need }]
//   done,     [true/false] per task (prize paid)
//   own,      prizes this event has paid (not counted toward a 'prizes' task)
//   grand,    true once the fifth prize is paid
//   shown,    [task numbers] the screen has already celebrated
//   shownGrand
// }
import { hash, rng, scaleReward } from './util.js';
import { schedule, pickEvent, blockAt } from './calendar.js';

const COUNTERS = ['wins', 'coins', 'cards', 'gems', 'prizes', 'pairs'];

// The config keys of the events that run in the block of time t.
function runningKeys(t) {
  const keys = new Set();
  try {
    for (const slot of schedule(t)) {
      const k = pickEvent(slot, 0);
      if (k) keys.add(k);
    }
  } catch { /* no calendar: nothing extra */ }
  return keys;
}

// Pick the four tasks: different running totals, drawn by seed.
export function drawTasks(inst, cfg, keys) {
  const r = rng(hash(inst.seed, 'control'));
  const weekend = blockAt(inst.startsAt).kind === 'weekend';
  const open = cfg.pool.map((p, i) => ({ p, i })).filter(({ p }) => !p.with || keys.has(p.with));
  const out = [];
  const used = new Set();
  while (out.length < cfg.tasks && open.length) {
    const k = Math.floor(r() * open.length);
    const { p, i } = open.splice(k, 1)[0];
    if (used.has(p.counter)) continue;
    used.add(p.counter);
    const base = Array.isArray(p.need) ? p.need[weekend ? 1 : 0] : p.need;
    out.push({ pool: i, need: Math.max(1, Math.ceil(base * Math.min(1, inst.scale ?? 1))) });
  }
  return out;
}

// How far each task has got: [{ have, need }].
function progressOf(inst, cfg, ctx) {
  const d = inst.data;
  const c = (ctx.counters && ctx.counters()) || {};
  return d.tasks.map((tk) => {
    const p = cfg.pool[tk.pool];
    let have = (c[p.counter] || 0) - (d.base[p.counter] || 0);
    if (p.counter === 'prizes') have -= d.own;
    return { have: Math.max(0, have), need: tk.need };
  });
}

function settle(inst, cfg, ctx) {
  const d = inst.data;
  if (inst.done) return [];
  const got = [];
  const prog = progressOf(inst, cfg, ctx);
  prog.forEach((p, i) => {
    if (d.done[i] || p.have < p.need) return;
    d.done[i] = true;
    d.own++; // (paying counts as a prize in the running totals)
    ctx.pay(cfg.rewards[i % cfg.rewards.length], `Task ${i + 1}`);
    got.push(i);
  });
  if (d.done.length && d.done.every(Boolean) && !d.grand) {
    d.grand = true;
    d.own++;
    ctx.pay(cfg.grand, 'All four done');
    inst.state = 'won';
    inst.done = true;
  }
  return got;
}

function textOf(p, need) {
  return p.text.replace('{n}', need.toLocaleString('en-US'));
}

export default {
  begin(inst, cfg, ctx) {
    const c = (ctx && ctx.counters && ctx.counters()) || {};
    const base = {};
    for (const k of COUNTERS) base[k] = c[k] || 0;
    inst.data = { base, tasks: [], done: [], own: 0, grand: false, shown: [], shownGrand: false };
    inst.data.tasks = drawTasks(inst, cfg, runningKeys(inst.startsAt));
    inst.data.done = inst.data.tasks.map(() => false);
  },

  // Other side games and the album move the totals, so check on every look.
  tick(inst, cfg, ctx) {
    settle(inst, cfg, ctx);
  },

  onLevel(inst, cfg, res, ctx) {
    if (inst.done || !res.won) return null;
    // The level's win is counted just after the events hear of it, so add
    // it here for the line shown on the results screen.
    const i = inst.data.tasks.findIndex((tk, n) => !inst.data.done[n] && cfg.pool[tk.pool].counter === 'wins');
    if (i < 0) return null;
    const p = progressOf(inst, cfg, ctx)[i];
    return `Task ${i + 1}: ${Math.min(p.need, p.have + 1)}/${p.need}`;
  },

  // action = { seen: [task numbers], grand: true } (celebrated on screen).
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (action && Array.isArray(action.seen)) {
      for (const i of action.seen) if (Number.isInteger(i) && d.done[i] && !d.shown.includes(i)) d.shown.push(i);
    }
    if (action && action.grand && d.grand) d.shownGrand = true;
    return { ok: true, paid: settle(inst, cfg, ctx) };
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const prog = progressOf(inst, cfg, ctx);
    const tasks = d.tasks.map((tk, i) => {
      const p = cfg.pool[tk.pool];
      return {
        counter: p.counter,
        text: textOf(p, tk.need),
        have: d.done[i] ? tk.need : Math.min(tk.need, prog[i].have),
        need: tk.need,
        done: !!d.done[i],
        fresh: !!d.done[i] && !d.shown.includes(i),
        reward: scaleReward(cfg.rewards[i % cfg.rewards.length], inst.scale),
        hint: p.hint || '',
      };
    });
    const finished = d.done.filter(Boolean).length;
    return {
      summary: d.grand ? 'Complete' : `${finished}/${tasks.length} tasks`,
      progress: { have: finished, need: tasks.length },
      steps: tasks.map((t, i) => ({ need: t.need, reward: t.reward, done: t.done, current: !t.done && tasks.findIndex((x) => !x.done) === i })),
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
      game: {
        kind: 'control',
        button: 'Play',
        tasks,
        finished,
        grand: scaleReward(cfg.grand, inst.scale),
        grandPaid: d.grand,
        grandFresh: d.grand && !d.shownGrand,
        endsAt: inst.endsAt,
      },
    };
  },
};
