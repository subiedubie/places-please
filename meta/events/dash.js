// FIRST TO FINISH. Waits as an offer until Start is pressed. Then five
// racers; the first to win 15 levels takes first prize. Only the top three
// are paid, and only if they finish.
// Saved: inst.data = { startedAt, have, place }
import { YOU } from '../../config/rivals.js';
import { burstRivals } from './rivals.js';
import { prizeFor, prizeList, ordinal, rank } from './util.js';

function racers(inst, cfg) {
  return burstRivals({
    seed: inst.seed,
    count: cfg.rivals,
    pace: inst.pace,
    startsAt: inst.data.startedAt,
    total: cfg.target,
    minutes: cfg.rivalMinutes,
  });
}

// How many rivals had already finished at time t.
const finishedBy = (inst, cfg, t) => racers(inst, cfg).filter((r) => r.finishAt <= t).length;

export default {
  begin(inst) {
    inst.data = { startedAt: null, have: 0, place: null };
    inst.state = 'offer';
  },

  start(inst, cfg, ctx) {
    if (inst.state !== 'offer') return;
    inst.data.startedAt = ctx.now;
    inst.state = 'running';
  },

  tick(inst, cfg, ctx) {
    if (inst.state !== 'running') return;
    // Three rivals are home: no paid place is left.
    if (finishedBy(inst, cfg, ctx.now) >= 3) {
      inst.state = 'lost';
      inst.done = true;
    }
  },

  onLevel(inst, cfg, res, ctx) {
    if (inst.state !== 'running' || !res.won) return null;
    const d = inst.data;
    d.have++;
    if (d.have >= cfg.target) {
      d.place = finishedBy(inst, cfg, ctx.now) + 1;
      const prize = prizeFor(cfg.prizes, d.place);
      if (prize) ctx.pay(prize, `${ordinal(d.place)} place`);
      inst.state = 'won';
      inst.done = true;
      return `Finished ${ordinal(d.place)}`;
    }
    return `${d.have}/${cfg.target}`;
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const prizes = prizeList(cfg.prizes, inst.scale);
    if (inst.state === 'offer') {
      return { summary: `First to ${cfg.target}`, progress: { have: 0, need: cfg.target }, prizes };
    }
    const rows = racers(inst, cfg).map((r) => ({ name: r.name, score: r.scoreAt(ctx.now), you: false, finishAt: r.finishAt }));
    rows.push({ name: YOU, score: d.have, you: true });
    rank(rows);
    for (const row of rows) row.prize = prizeFor(cfg.prizes, row.place, inst.scale);
    return {
      summary: d.place ? `Finished ${ordinal(d.place)}` : `${d.have}/${cfg.target}`,
      progress: { have: d.have, need: cfg.target },
      rows,
      prizes,
    };
  },
};
