// DAILY MISSIONS (Call Sheet). Each day of the week unlocks three missions
// drawn from the pool in config/events.js. A finished mission is one scroll;
// scroll totals at five points in the week pay a reward. Missed days stay
// open until the week ends.
// Saved: inst.data = { days: { '0'..'6': [{ pick, have, done }] }, scrolls, paid }
//   pick = position of the mission in the config pool; paid = track rewards paid
import { hash, rng, countKind } from './util.js';
import { weekday, dayStart } from './calendar.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// How much one won level adds to a mission.
function amount(mission, res) {
  switch (mission.kind) {
    case 'win': return 1;
    case 'fire': return countKind(res.tally.fired, mission.power);
    case 'clear': return res.tally.cleared?.[mission.color] || 0;
    case 'movesLeft': return (res.movesLeft || 0) >= mission.moves ? 1 : 0;
    case 'hardFirst': return res.tier > 0 && res.firstAttempt ? 1 : 0;
    default: return 0;
  }
}

// Unlock the missions of every day up to today.
function unlock(inst, cfg, now) {
  const d = inst.data;
  const today = now >= inst.endsAt ? 6 : dayStart(now) < inst.startsAt ? -1 : weekday(now);
  for (let day = 0; day <= today; day++) {
    if (d.days[day]) continue;
    const r = rng(hash(inst.seed, 'day', day));
    const picks = cfg.pool.map((_, i) => i);
    const list = [];
    for (let i = 0; i < cfg.perDay && picks.length > 0; i++) {
      list.push({ pick: picks.splice(Math.floor(r() * picks.length), 1)[0], have: 0, done: false });
    }
    d.days[day] = list;
  }
}

export default {
  begin(inst, cfg, ctx) {
    inst.data = { days: {}, scrolls: 0, paid: 0 };
    unlock(inst, cfg, ctx.now);
  },

  tick(inst, cfg, ctx) {
    unlock(inst, cfg, ctx.now);
  },

  onLevel(inst, cfg, res, ctx) {
    if (!res.won) return null;
    const d = inst.data;
    let finished = 0;
    for (const list of Object.values(d.days)) {
      for (const m of list) {
        const mission = cfg.pool[m.pick];
        if (m.done || !mission) continue;
        m.have = Math.min(mission.need, m.have + amount(mission, res));
        if (m.have >= mission.need) {
          m.done = true;
          d.scrolls++;
          finished++;
        }
      }
    }
    while (d.paid < cfg.track.length && d.scrolls >= cfg.track[d.paid].need) {
      ctx.pay(cfg.track[d.paid].reward, `${cfg.track[d.paid].need} scrolls`);
      d.paid++;
    }
    return finished > 0 ? `${finished} mission${finished === 1 ? '' : 's'} done` : null;
  },

  view(inst, cfg) {
    const d = inst.data;
    const missions = [];
    for (const day of Object.keys(d.days).sort()) {
      for (const m of d.days[day]) {
        const mission = cfg.pool[m.pick];
        if (!mission) continue;
        missions.push({ day: DAY_NAMES[day], text: mission.text, have: m.have, need: mission.need, done: m.done });
      }
    }
    const next = cfg.track[Math.min(d.paid, cfg.track.length - 1)];
    return {
      summary: `${d.scrolls} scroll${d.scrolls === 1 ? '' : 's'}`,
      progress: { have: Math.min(d.scrolls, next.need), need: next.need },
      steps: cfg.track.map((s, i) => ({ need: s.need, reward: s.reward, done: i < d.paid, current: i === d.paid })),
      missions,
    };
  },
};
