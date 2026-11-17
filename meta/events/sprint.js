// SPRINT. 30 minutes of clock time from pressing Start. Counts uses of one
// named power-up in levels WON, against four rivals whose totals are fixed
// at Start. Only first place is paid. Two sprints a day.
// Saved: inst.data = { day, used, run: null | { startedAt, score }, last }
//   day = the local day `used` counts for; last = place in the last sprint
import { YOU } from '../../config/rivals.js';
import { burstRivals } from './rivals.js';
import { hash, countKind, rank, ordinal, scaleReward } from './util.js';
import { dayStart, MINUTE } from './calendar.js';

function rivalsOf(inst, cfg) {
  return burstRivals({
    seed: hash(inst.seed, 'run', inst.data.run.startedAt),
    count: cfg.rivals,
    pace: inst.pace,
    startsAt: inst.data.run.startedAt,
    total: cfg.rivalTotal,
    minutes: cfg.minutes,
  });
}

function board(inst, cfg, t) {
  const rows = rivalsOf(inst, cfg).map((r) => ({ name: r.name, score: r.scoreAt(t), you: false }));
  rows.push({ name: YOU, score: inst.data.run.score, you: true });
  rank(rows);
  for (const row of rows) row.prize = row.place === 1 ? scaleReward(cfg.reward, inst.scale) : null;
  return rows;
}

const runEnd = (inst, cfg) => inst.data.run.startedAt + cfg.minutes * MINUTE;

// Close a sprint whose time is up, start a new day's count, set the state.
function settle(inst, cfg, ctx) {
  const d = inst.data;
  if (d.run && ctx.now >= runEnd(inst, cfg)) {
    const you = board(inst, cfg, runEnd(inst, cfg)).find((r) => r.you);
    d.last = you.place;
    if (you.place === 1 && d.run.score > 0) ctx.pay(cfg.reward, 'First place');
    d.run = null;
  }
  const today = dayStart(ctx.now);
  if (!d.run && d.day !== today) {
    d.day = today;
    d.used = 0;
  }
  inst.state = d.run ? 'running' : d.used < cfg.perDay ? 'offer' : 'over';
}

export default {
  begin(inst, cfg, ctx) {
    inst.data = { day: dayStart(ctx.now), used: 0, run: null, last: null };
    inst.state = 'offer';
  },

  tick: settle,

  start(inst, cfg, ctx) {
    settle(inst, cfg, ctx);
    if (inst.state !== 'offer') return;
    inst.data.run = { startedAt: ctx.now, score: 0 };
    inst.data.used++;
    inst.state = 'running';
  },

  onLevel(inst, cfg, res) {
    const run = inst.data.run;
    if (!run || !res.won) return null;
    const got = countKind(res.tally.fired, cfg.power);
    if (got === 0) return null;
    run.score += got;
    return `+${got}`;
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const prizes = [{ place: 1, reward: scaleReward(cfg.reward, inst.scale) }];
    if (!d.run) {
      const left = cfg.perDay - d.used;
      return {
        summary: left > 0 ? `${cfg.minutes} minutes - ${left} left today` : 'Back tomorrow',
        prizes,
      };
    }
    const rows = board(inst, cfg, ctx.now);
    return {
      endsAt: runEnd(inst, cfg),
      summary: `${ordinal(rows.find((r) => r.you).place)} of ${rows.length}`,
      rows,
      prizes,
    };
  },
};
