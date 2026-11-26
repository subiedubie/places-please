// MILESTONE CHEST (Encore). Pays every 50 levels WON, for ever.
// Saved: inst.data = { count }   (levels won since this event began)

export default {
  begin(inst) {
    inst.data = { count: 0 };
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won) return null;
    const d = inst.data;
    d.count++;
    if (d.count % cfg.every === 0) {
      ctx.pay(cfg.reward, `${d.count} levels won`);
      return 'Chest earned';
    }
    return `${d.count % cfg.every}/${cfg.every}`;
  },

  view(inst, cfg) {
    const have = inst.data.count % cfg.every;
    return {
      summary: `${have}/${cfg.every}`,
      progress: { have, need: cfg.every },
      prizes: [{ place: 1, reward: cfg.reward }],
      // The play screen (ui/games/climb.js): one tall step to the chest.
      game: {
        kind: 'climb',
        button: 'Play',
        mode: 'chest',
        step: 0,
        stepCount: 1,
        have,
        need: cfg.every,
        count: inst.data.count,
        reward: cfg.reward,
      },
    };
  },
};
