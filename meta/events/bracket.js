// BRACKET. Eight entrants, three 10-minute head-to-head rounds, one after
// another from pressing Start. Your score in a round is the number of
// power-ups fired during first attempts at levels in that round. Each
// opponent's score curve is fixed by the seed. Losing a round ends the
// bracket. Three brackets a day.
// Saved: inst.data = { day, used, run: null | { startedAt, round, scores: [..] }, last }
//   last = how the last bracket ended: 'won', or the round it was lost in
import { YOU } from '../../config/rivals.js';
import { burstRivals } from './rivals.js';
import { hash, countKind, rank, prizeFor, prizeList } from './util.js';
import { dayStart, MINUTE } from './calendar.js';

// The opponent of round `round` (0, 1, 2).
function opponent(inst, cfg, round) {
  const run = inst.data.run;
  return burstRivals({
    seed: hash(inst.seed, 'bracket', run.startedAt, round),
    count: 1,
    pace: inst.pace,
    startsAt: run.startedAt + round * cfg.roundMinutes * MINUTE,
    total: cfg.rivalTotal,
    minutes: cfg.roundMinutes,
  })[0];
}

const roundEnd = (inst, cfg, round) => inst.data.run.startedAt + (round + 1) * cfg.roundMinutes * MINUTE;

function settle(inst, cfg, ctx) {
  const d = inst.data;
  // Decide every round whose time is up (a tie goes to you).
  while (d.run && ctx.now >= roundEnd(inst, cfg, d.run.round)) {
    const run = d.run;
    const theirs = opponent(inst, cfg, run.round).scoreAt(roundEnd(inst, cfg, run.round));
    if (run.scores[run.round] >= theirs && run.scores[run.round] > 0) {
      run.round++;
      if (run.round >= cfg.rounds) {
        ctx.pay(prizeFor(cfg.prizes, 1), 'Bracket won');
        d.last = 'won';
        d.run = null;
      }
    } else {
      // Losing the final is second place; earlier rounds pay nothing.
      const prize = run.round === cfg.rounds - 1 ? prizeFor(cfg.prizes, 2) : null;
      if (prize) ctx.pay(prize, 'Runner-up');
      d.last = run.round + 1;
      d.run = null;
    }
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
    inst.data.run = { startedAt: ctx.now, round: 0, scores: new Array(cfg.rounds).fill(0) };
    inst.data.used++;
    inst.state = 'running';
  },

  // Counts on any finished level (won or lost), first attempts only.
  onLevel(inst, cfg, res) {
    const run = inst.data.run;
    if (!run || !res.firstAttempt) return null;
    const got = countKind(res.tally.fired, 'any');
    if (got === 0) return null;
    run.scores[run.round] += got;
    return `+${got} this round`;
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const prizes = prizeList(cfg.prizes, inst.scale);
    if (!d.run) {
      const left = cfg.perDay - d.used;
      return {
        summary: left > 0 ? `${cfg.entrants} entrants - ${left} left today` : 'Back tomorrow',
        prizes,
      };
    }
    const run = d.run;
    const them = opponent(inst, cfg, run.round);
    const rows = rank([
      { name: them.name, score: them.scoreAt(ctx.now), you: false, prize: null },
      { name: YOU, score: run.scores[run.round], you: true, prize: null },
    ]);
    return {
      endsAt: roundEnd(inst, cfg, run.round),
      summary: `round ${run.round + 1} of ${cfg.rounds}`,
      progress: { have: run.round, need: cfg.rounds },
      rows,
      prizes,
    };
  },
};
