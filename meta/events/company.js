// SHARED POT. You and computer teammates add to one total. Three chests
// open at three totals, each paying you. When the third opens (or the block
// ends) the top contributors get a bonus.
// Saved: inst.data = { mine, opened }   (opened = chests already paid)
import { TIER_POINTS } from '../../config/events.js';
import { YOU } from '../../config/rivals.js';
import { dailyRivals } from './rivals.js';
import { rank, scaleReward } from './util.js';

function members(inst, cfg, t) {
  const rows = dailyRivals({
    seed: inst.seed,
    count: cfg.teammates,
    pace: inst.pace,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    perLevel: cfg.rivalPointsPerLevel ?? 1,
  }).map((r) => ({ name: r.name, score: r.scoreAt(t), you: false }));
  rows.push({ name: YOU, score: inst.data.mine, you: true });
  rank(rows);
  for (const row of rows) {
    row.prize = row.place <= cfg.topBonus.places ? scaleReward(cfg.topBonus.reward, inst.scale) : null;
  }
  return rows;
}

// A replacement has less time, so its chest totals shrink with its prizes.
const chestAt = (inst, chest) => Math.max(1, Math.round(chest.at * inst.scale));

// Open every chest the total has reached; finish when all are open.
function settle(inst, cfg, ctx, t) {
  if (inst.done) return;
  const d = inst.data;
  const rows = members(inst, cfg, t);
  const total = rows.reduce((sum, r) => sum + r.score, 0);
  while (d.opened < cfg.chests.length && total >= chestAt(inst, cfg.chests[d.opened])) {
    ctx.pay(cfg.chests[d.opened].reward, `Chest ${d.opened + 1}`);
    d.opened++;
  }
  if (d.opened >= cfg.chests.length) {
    const you = rows.find((r) => r.you);
    if (you.prize) ctx.pay(cfg.topBonus.reward, 'Top contributor');
    inst.state = 'won';
    inst.done = true;
  }
}

export default {
  begin(inst) {
    inst.data = { mine: 0, opened: 0 };
  },

  // Teammates keep adding while the app is closed, so chests can open then.
  tick(inst, cfg, ctx) {
    settle(inst, cfg, ctx, ctx.now);
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won || inst.done) return null;
    const points = TIER_POINTS[res.tier] ?? 1;
    inst.data.mine += points;
    settle(inst, cfg, ctx, ctx.now);
    return `+${points} to the pot`;
  },

  // Block over with chests still shut: the top-contributor bonus is still
  // paid if at least one chest opened.
  end(inst, cfg, ctx) {
    if (inst.done) return;
    settle(inst, cfg, ctx, inst.endsAt);
    if (inst.done || inst.data.opened === 0) return;
    const you = members(inst, cfg, inst.endsAt).find((r) => r.you);
    if (you.prize) ctx.pay(cfg.topBonus.reward, 'Top contributor');
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const rows = members(inst, cfg, ctx.now);
    const total = rows.reduce((sum, r) => sum + r.score, 0);
    const goal = chestAt(inst, cfg.chests[cfg.chests.length - 1]);
    return {
      summary: `${Math.min(total, goal)}/${goal}`,
      rows,
      chests: cfg.chests.map((c, i) => ({ at: chestAt(inst, c), reward: scaleReward(c.reward, inst.scale), open: i < d.opened })),
      total: { have: total, need: goal },
    };
  },
};
