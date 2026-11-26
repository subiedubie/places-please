// THE COMPANY TOURNAMENT (type 'tournament'). Your whole company, you and
// your 49 castmates, counts every level it wins into one team total. Three
// milestones: 2,000 wins opens 15 minutes of everything (every starting
// power-up free, plus unlimited lives), 5,000 opens 30 minutes of it, and
// 8,000 pays 10,000 coins. Everybody has to pull their weight: a milestone
// the team has reached is paid to you once you have won `mustWin` levels
// yourself (and at once if you already have).
//
// Castmates' wins follow schedules fixed by the seed when the tournament
// starts (meta/events/castmates.js); they never react to you.
//
// Saved: inst.data = { mine: your wins, paid: [true/false per milestone],
//                      seen: team total the screen last showed }
import { hash, scaleReward, rank } from './util.js';
import { YOU } from '../../config/rivals.js';
import { castmates, mateSchedules, teamName, yourAvatar } from './castmates.js';

// A replacement event has less time, so its milestones shrink with it.
const atOf = (inst, m) => Math.max(1, Math.round(m.at * (inst.scale ?? 1)));

function mates(inst, cfg) {
  return mateSchedules({
    seed: hash(inst.seed, 'tournament'),
    count: cfg.mates ?? 49,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    share: cfg.mateShare,
    perLevel: 1,
  });
}

// The team at time t: each castmate's wins, and the total.
export function teamAt(inst, cfg, t) {
  const scores = mates(inst, cfg).map((m) => m.scoreAt(t));
  const total = scores.reduce((a, b) => a + b, 0) + inst.data.mine;
  return { scores, total };
}

// Pay every milestone that is reached and that you have earned.
function settle(inst, cfg, ctx, t) {
  if (inst.done) return [];
  const d = inst.data;
  const { total } = teamAt(inst, cfg, t);
  const paidNow = [];
  cfg.milestones.forEach((m, i) => {
    if (d.paid[i] || total < atOf(inst, m) || d.mine < (m.mustWin || 0)) return;
    d.paid[i] = true;
    ctx.pay(m.reward, `Milestone ${i + 1}`);
    paidNow.push(i);
  });
  if (d.paid.every(Boolean)) {
    inst.state = 'won';
    inst.done = true;
  }
  return paidNow;
}

export default {
  begin(inst, cfg) {
    inst.data = { mine: 0, paid: cfg.milestones.map(() => false), seen: 0 };
  },

  tick(inst, cfg, ctx) {
    settle(inst, cfg, ctx, ctx.now);
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won || inst.done) return null;
    inst.data.mine += 1;
    const paid = settle(inst, cfg, ctx, ctx.now);
    return paid.length ? `Milestone ${paid[paid.length - 1] + 1} unlocked!` : '+1 to the team';
  },

  // action = { seen: total } (the screen showed the counter up to there).
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (action && Number.isFinite(action.seen)) d.seen = Math.max(d.seen || 0, Math.floor(action.seen));
    return { ok: true, paid: settle(inst, cfg, ctx, ctx.now) };
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const now = ctx.now;
    const team = teamAt(inst, cfg, now);
    const people = castmates(ctx, inst);
    const goal = atOf(inst, cfg.milestones[cfg.milestones.length - 1]);
    const rows = team.scores.map((s, i) => ({
      name: (people[i] && people[i].name) || `Castmate ${i + 1}`,
      avatar: (people[i] && people[i].avatar) || 'cat',
      score: s,
      you: false,
    }));
    rows.push({ name: YOU, avatar: yourAvatar(ctx), score: d.mine, you: true });
    rank(rows);
    const shown = cfg.topShown ?? 10;
    const top = rows.slice(0, shown);
    const me = rows.find((r) => r.you);
    if (me.place > shown) top.push(me);
    const milestones = cfg.milestones.map((m, i) => {
      const at = atOf(inst, m);
      const reached = team.total >= at;
      return {
        at,
        reward: scaleReward(m.reward, inst.scale),
        mustWin: m.mustWin || 0,
        reached,
        paid: !!d.paid[i],
        // Reached, but you have not won enough levels yourself yet.
        locked: reached && !d.paid[i] && d.mine < (m.mustWin || 0),
      };
    });
    const next = milestones.findIndex((m) => !m.paid);
    return {
      summary: inst.done ? 'All three won' : `${team.total.toLocaleString('en-US')} / ${goal.toLocaleString('en-US')}`,
      total: { have: Math.min(team.total, goal), need: goal },
      progress: { have: Math.min(team.total, goal), need: goal },
      chests: milestones.map((m) => ({ at: m.at, reward: m.reward, open: m.paid })),
      rows: top.map((r) => ({ name: r.name, score: r.score, you: r.you, place: r.place, prize: null })),
      game: {
        kind: 'tournament',
        button: 'Play',
        team: teamName(ctx),
        size: rows.length,
        total: team.total,
        seen: Math.min(d.seen || 0, team.total),
        mine: d.mine,
        place: me.place,
        milestones,
        next,
        top,
        endsAt: inst.endsAt,
        done: inst.done,
      },
    };
  },
};
