// SEASON TRACK. One month, 30 steps. Every level won gives keys (more on
// harder tiers). After the last step, every 10 keys banks 100 coins, up to
// 5,000; the bank is paid when the month ends.
// THE GOLD ROW: bought once a month with coins (cfg.gold.price). It pays a
// second, richer prize at every step (back-paid for steps already passed),
// and while it is open lives go up to 8 and your name is in gold.
// Saved: inst.data = { step, have, bank, gold }
//   have = keys toward the current step (after the last step: spare keys)
import { TIER_POINTS } from '../../config/events.js';

// The gold row's prize at step i (0-based): cfg.gold.rewards repeats, and
// every fifth step pays the big one.
function goldReward(cfg, i) {
  const g = cfg.gold;
  return (i + 1) % 5 === 0 ? g.big[Math.floor(i / 5) % g.big.length] : g.rewards[i % g.rewards.length];
}

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
      if (d.gold && cfg.gold) ctx.pay(goldReward(cfg, d.step), `Step ${d.step + 1}, gold row`);
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

  // Buy the gold row: action { buyGold: true }.
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (!action || !action.buyGold || d.gold || !cfg.gold) return { ok: false };
    if (!ctx.spend(cfg.gold.price)) return { ok: false, reason: 'coins' };
    d.gold = true;
    for (let i = 0; i < d.step; i++) ctx.pay(goldReward(cfg, i), `Step ${i + 1}, gold row`);
    return { ok: true, paid: d.step };
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
      steps: cfg.steps.map((s, i) => ({ need: s.need, reward: s.reward, gold: cfg.gold ? goldReward(cfg, i) : null, done: i < d.step, current: i === d.step })),
      bank: { have: d.bank, max: cfg.bankMax },
      passGold: Boolean(d.gold),
      game: { kind: 'pass', button: 'Open the Season', step: d.step, have: d.have, gold: Boolean(d.gold), price: cfg.gold ? cfg.gold.price : 0, perks: cfg.gold ? cfg.gold.perks : [], bank: d.bank, bankMax: cfg.bankMax },
    };
  },
};
