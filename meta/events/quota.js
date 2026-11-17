// POWER-UP QUOTA. Five stages. Each asks for a count of each power-up FIRED
// in levels won. A stage pays when every count is met; finishing it inside
// its time limit pays a bonus on top.
// Saved: inst.data = { stage, have: { kind: count }, stageStart }
import { countKind, scaleReward } from './util.js';
import { MINUTE } from './calendar.js';

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

export default {
  begin(inst, cfg, ctx) {
    inst.data = { stage: 0, have: {}, stageStart: ctx.now };
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won || inst.done) return null;
    const d = inst.data;
    const stage = cfg.stages[d.stage];
    let added = 0;
    for (const [kind, need] of Object.entries(stage.need)) {
      const before = d.have[kind] || 0;
      d.have[kind] = Math.min(need, before + countKind(res.tally.fired, kind));
      added += d.have[kind] - before;
    }
    if (Object.entries(stage.need).every(([kind, need]) => (d.have[kind] || 0) >= need)) {
      ctx.pay(stage.reward, `Stage ${d.stage + 1}`);
      if (stage.bonus && ctx.now - d.stageStart <= stage.bonusMinutes * MINUTE) {
        ctx.pay(stage.bonus, `Stage ${d.stage + 1} time bonus`);
      }
      d.stage++;
      d.have = {};
      d.stageStart = ctx.now;
      if (d.stage >= cfg.stages.length) {
        inst.state = 'won';
        inst.done = true;
      }
    }
    return added > 0 ? `+${added} cue${added === 1 ? '' : 's'}` : null;
  },

  view(inst, cfg) {
    const d = inst.data;
    const stage = cfg.stages[d.stage];
    return {
      summary: inst.done ? 'Complete' : `stage ${d.stage + 1}/${cfg.stages.length}`,
      progress: inst.done ? null : { have: sum(d.have), need: sum(stage.need) },
      steps: cfg.stages.map((s, i) => ({
        need: sum(s.need),
        reward: scaleReward(s.reward, inst.scale),
        done: i < d.stage,
        current: i === d.stage,
      })),
      // The counts of the current stage, one row per power-up.
      needs: inst.done ? null : Object.entries(stage.need).map(([kind, need]) => ({ kind, have: d.have[kind] || 0, need })),
      // When the current stage's time bonus runs out.
      bonusEndsAt: inst.done || !stage.bonus ? null : d.stageStart + stage.bonusMinutes * MINUTE,
    };
  },
};
