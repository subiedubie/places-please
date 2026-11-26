// LEADERBOARD RACE. Points for each level won (more on harder tiers) against
// computer rivals; paid by final place when the race ends. Optional
// multiplier that grows with wins in a row and resets on a loss.
// Saved: inst.data = { score, mult }
import { TIER_POINTS } from '../../config/events.js';
import { YOU } from '../../config/rivals.js';
import { dailyRivals } from './rivals.js';
import { prizeFor, prizeList, ordinal, rank } from './util.js';

// The full board at time t, best first.
function board(inst, cfg, t) {
  const rows = dailyRivals({
    seed: inst.seed,
    count: cfg.rivals,
    pace: inst.pace,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    perLevel: cfg.rivalPointsPerLevel ?? 1,
  }).map((r) => ({ name: r.name, score: r.scoreAt(t), you: false }));
  rows.push({ name: YOU, score: inst.data.score, you: true });
  rank(rows);
  for (const row of rows) row.prize = prizeFor(cfg.prizes, row.place, inst.scale);
  return rows;
}

export default {
  begin(inst) {
    inst.data = { score: 0, mult: 1 };
  },

  onLevel(inst, cfg, res) {
    const d = inst.data;
    if (!res.won) {
      d.mult = 1; // a loss resets the multiplier
      return null;
    }
    const points = (TIER_POINTS[res.tier] ?? 1) * d.mult;
    d.score += points;
    if (cfg.multiplier) d.mult = Math.min(cfg.multiplier.max, d.mult + 1);
    return `+${points} point${points === 1 ? '' : 's'}`;
  },

  // The race is over: pay by final place (the rivals' scores at the end time).
  end(inst, cfg, ctx) {
    const you = board(inst, cfg, inst.endsAt).find((r) => r.you);
    if (you.prize) ctx.pay(you.prize, `${ordinal(you.place)} place`, false);
  },

  view(inst, cfg, ctx) {
    const rows = board(inst, cfg, ctx.now);
    const you = rows.find((r) => r.you);
    return {
      summary: `${ordinal(you.place)} of ${rows.length}`,
      rows,
      prizes: prizeList(cfg.prizes, inst.scale),
      // The play screen (ui/games/board.js): the podium and the list.
      game: {
        kind: 'board',
        button: 'Play',
        mode: 'race',
        mult: inst.data.mult || 1,
        multMax: cfg.multiplier ? cfg.multiplier.max : 1,
        perWin: TIER_POINTS.slice(),
        avatar: ctx.team?.()?.avatar || null,
      },
    };
  },
};
