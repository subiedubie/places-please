// COLLECTION LADDER. Collect one piece color, or one made power-up, across
// levels WON. Each step pays as it is filled, in order; the grand prize
// comes after the last step. Lost levels add nothing.
// Saved: inst.data = { step, have }   (have = collected toward this step)
import { countKind, scaleReward } from './util.js';

export default {
  begin(inst) {
    inst.data = { step: 0, have: 0 };
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won || inst.done) return null;
    const d = inst.data;
    const got = cfg.collect.made !== undefined
      ? countKind(res.tally.made, cfg.collect.made)
      : (res.tally.cleared?.[cfg.collect.color] || 0);
    if (got === 0) return null;
    d.have += got;
    // What is left over after filling a step carries into the next one.
    while (d.step < cfg.steps.length && d.have >= cfg.steps[d.step].need) {
      d.have -= cfg.steps[d.step].need;
      ctx.pay(cfg.steps[d.step].reward, `Step ${d.step + 1}`);
      d.step++;
    }
    if (d.step >= cfg.steps.length) {
      ctx.pay(cfg.grand, 'Grand prize');
      inst.state = 'won';
      inst.done = true;
    }
    return `+${got} collected`;
  },

  view(inst, cfg) {
    const d = inst.data;
    const last = d.step >= cfg.steps.length;
    return {
      summary: last ? 'Complete' : `step ${d.step + 1}/${cfg.steps.length}`,
      progress: last ? null : { have: d.have, need: cfg.steps[d.step].need },
      steps: cfg.steps.map((s, i) => ({
        need: s.need,
        reward: scaleReward(s.reward, inst.scale),
        done: i < d.step,
        current: i === d.step,
      })),
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
    };
  },
};
