// STREAK. Two forms, chosen by the config entry:
//   plain   (cfg.need)    win that many levels in a row; a loss resets to 0
//   staged  (cfg.stages)  three stages (3, 5, 7 wins in a row), each a race
//           up the lanes against rivals. If a rival finishes a stage first,
//           the stage starts again with new rivals.
// Saved: inst.data = { have }                              (plain)
//        inst.data = { stage, have, stageStart, tries }    (staged)
import { YOU } from '../../config/rivals.js';
import { burstRivals } from './rivals.js';
import { hash, scaleReward } from './util.js';

// The rivals of the current stage (fixed by the seed, stage and try number).
function lanesOf(inst, cfg) {
  const d = inst.data;
  return burstRivals({
    seed: hash(inst.seed, 'stage', d.stage, d.tries),
    count: cfg.lanes[d.stage] - 1,
    pace: inst.pace,
    startsAt: d.stageStart,
    total: cfg.stages[d.stage],
    minutes: cfg.rivalMinutes[d.stage],
  });
}

export default {
  begin(inst, cfg, ctx) {
    inst.data = cfg.stages ? { stage: 0, have: 0, stageStart: ctx.now, tries: 0 } : { have: 0 };
  },

  tick(inst, cfg, ctx) {
    if (!cfg.stages || inst.done) return;
    const d = inst.data;
    // A rival got there first: the stage starts over now, with new rivals.
    if (lanesOf(inst, cfg).some((r) => r.finishAt <= ctx.now)) {
      d.tries++;
      d.have = 0;
      d.stageStart = ctx.now;
    }
  },

  onLevel(inst, cfg, res, ctx) {
    if (inst.done) return null;
    const d = inst.data;
    if (!res.won) {
      const had = d.have;
      d.have = 0; // one slip and the run is over
      return had > 0 ? 'Streak lost' : null;
    }
    d.have++;
    if (!cfg.stages) {
      if (d.have >= cfg.need) {
        ctx.pay(cfg.reward, `${cfg.need} in a row`);
        inst.state = 'won';
        inst.done = true;
      }
      return `${d.have}/${cfg.need} in a row`;
    }
    const need = cfg.stages[d.stage];
    const line = `${d.have}/${need} in a row`;
    if (d.have >= need) {
      ctx.pay(cfg.rewards[d.stage], `Stage ${d.stage + 1}`);
      d.stage++;
      d.have = 0;
      d.tries = 0;
      d.stageStart = ctx.now;
      if (d.stage >= cfg.stages.length) {
        d.stage = cfg.stages.length - 1;
        inst.state = 'won';
        inst.done = true;
      }
    }
    return line;
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    if (!cfg.stages) {
      return {
        summary: `${d.have}/${cfg.need}`,
        progress: { have: d.have, need: cfg.need },
        prizes: [{ place: 1, reward: scaleReward(cfg.reward, inst.scale) }],
      };
    }
    const need = cfg.stages[d.stage];
    const lanes = inst.done ? [] : lanesOf(inst, cfg).map((r) => ({ name: r.name, have: r.scoreAt(ctx.now), need, you: false }));
    lanes.push({ name: YOU, have: inst.done ? need : d.have, need, you: true });
    return {
      summary: inst.done ? 'Complete' : `stage ${d.stage + 1}: ${d.have}/${need}`,
      progress: { have: inst.done ? need : d.have, need },
      lanes,
      steps: cfg.stages.map((n, i) => ({
        need: n,
        reward: scaleReward(cfg.rewards[i], inst.scale),
        done: inst.done || i < d.stage,
        current: !inst.done && i === d.stage,
      })),
    };
  },
};
