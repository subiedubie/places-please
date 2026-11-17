// SEASON TRACK. One month, 30 steps. Every level won gives keys (more on
// harder tiers). After the last step, every 10 keys banks 100 coins, up to
// 5,000; the bank is paid when the month ends.
// Saved: inst.data = { step, have, bank }
//   have = keys toward the current step (after the last step: spare keys)
import { TIER_POINTS } from '../../config/events.js';

export default {
  begin(inst) {
    inst.data = { step: 0, have: 0, bank: 0 };
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won) return null;
    const d = inst.data;
    const keys = TIER_POINTS[res.tier] ?? 1;
    d.have += keys;
    while (d.step < cfg.steps.length && d.have >= cfg.steps[d.step].need) {
      d.have -= cfg.steps[d.step].need;
      ctx.pay(cfg.steps[d.step].reward, `Step ${d.step + 1}`);
      d.step++;
    }
    if (d.step >= cfg.steps.length) {
      // Past the last step: turn every full group of keys into banked coins.
      const groups = Math.floor(d.have / cfg.bankEvery);
      d.have -= groups * cfg.bankEvery;
      d.bank = Math.min(cfg.bankMax, d.bank + groups * cfg.bankCoins);
    }
    return `+${keys} key${keys === 1 ? '' : 's'}`;
  },

  // Month over: pay out the bank.
  end(inst, cfg, ctx) {
    if (inst.data.bank > 0) ctx.pay({ coins: inst.data.bank }, 'Season bank', false);
  },

  view(inst, cfg) {
    const d = inst.data;
    const last = d.step >= cfg.steps.length;
    return {
      summary: last ? `bank ${d.bank}/${cfg.bankMax}` : `step ${d.step + 1}/${cfg.steps.length}`,
      progress: last ? { have: d.bank, need: cfg.bankMax } : { have: d.have, need: cfg.steps[d.step].need },
      steps: cfg.steps.map((s, i) => ({ need: s.need, reward: s.reward, done: i < d.step, current: i === d.step })),
      bank: { have: d.bank, max: cfg.bankMax },
    };
  },
};
