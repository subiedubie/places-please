// THE GRAND CIRCUIT (type 'circuit'). A touring league of 20 players (you
// and 19 computer players) in three divisions: Bronze Stage, Silver Stage,
// Gold Stage. Every level you win pays crowns (more for harder levels).
// Each run lasts one block (Monday-Thursday or Friday-Sunday). When it
// ends, everyone is paid by place; the top `up` move up a division and the
// bottom `down` move down. Higher divisions have faster rivals and better
// prizes.
//
// Your division outlives the run: it is kept in the shared running totals
// (ctx.counters(): circuitDivision = 0 / 1 / 2, and circuitLast =
// { from, to, place, at } for the banner at the start of the next run).
//
// Rivals' schedules are fixed by the seed when the run starts
// (meta/events/rivals.js dailyRivals); they never react to you.
//
// Saved: inst.data = { division, crowns, wins, settled, seenMove }
import { YOU } from '../../config/rivals.js';
import { TEAM } from '../../config/team.js';
import { dailyRivals } from './rivals.js';
import { hash, rng, rank, prizeFor, prizeList, ordinal } from './util.js';

const clampDiv = (cfg, n) => Math.max(0, Math.min(cfg.divisions.length - 1, Number.isInteger(n) ? n : 0));

function board(inst, cfg, t, you = null) {
  const d = inst.data;
  const div = cfg.divisions[d.division];
  const r = rng(hash(inst.seed, 'avatars'));
  const rows = dailyRivals({
    seed: hash(inst.seed, 'circuit', d.division),
    count: cfg.players - 1,
    pace: inst.pace,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    perLevel: div.rivalCrownsPerLevel,
  }).map((rv) => ({ name: rv.name, avatar: TEAM.avatars[Math.floor(r() * TEAM.avatars.length)], score: rv.scoreAt(t), you: false }));
  rows.push({ name: YOU, avatar: you || TEAM.avatars[0], score: d.crowns, you: true });
  rank(rows);
  const n = rows.length;
  for (const row of rows) {
    row.prize = prizeFor(div.prizes, row.place, inst.scale);
    // 'up' / 'down' / null: where this place moves when the run ends.
    row.zone = row.place <= cfg.up && d.division < cfg.divisions.length - 1 ? 'up'
      : row.place > n - cfg.down && d.division > 0 ? 'down' : null;
  }
  return rows;
}

export default {
  begin(inst, cfg, ctx) {
    const c = ctx && ctx.counters ? ctx.counters() : null;
    inst.data = { division: clampDiv(cfg, c ? c.circuitDivision : 0), crowns: 0, wins: 0, settled: false, seenMove: false };
  },

  onLevel(inst, cfg, res) {
    if (!res.won || inst.done) return null;
    const n = cfg.crownsPerWin[res.tier] ?? cfg.crownsPerWin[0];
    inst.data.crowns += n;
    inst.data.wins += 1;
    return `+${n} ${n === 1 ? 'crown' : 'crowns'}`;
  },

  // action = { seenMove: true } (the promotion banner has been shown).
  act(inst, cfg, action) {
    if (action && action.seenMove) inst.data.seenMove = true;
    return { ok: true };
  },

  // The run is over: pay by place, then move up or down a division.
  end(inst, cfg, ctx) {
    const d = inst.data;
    if (d.settled) return;
    d.settled = true;
    const rows = board(inst, cfg, inst.endsAt);
    const me = rows.find((x) => x.you);
    const prize = prizeFor(cfg.divisions[d.division].prizes, me.place, 1);
    if (prize) ctx.pay(prize, `${ordinal(me.place)} on the ${cfg.divisions[d.division].name}`);
    const to = clampDiv(cfg, d.division + (me.zone === 'up' ? 1 : me.zone === 'down' ? -1 : 0));
    const c = ctx.counters ? ctx.counters() : null;
    if (c) {
      c.circuitDivision = to;
      c.circuitLast = { from: d.division, to, place: me.place, at: inst.endsAt };
    }
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const div = cfg.divisions[d.division];
    const t = ctx.team ? ctx.team() : null;
    const rows = board(inst, cfg, ctx.now, t && t.avatar);
    const me = rows.find((x) => x.you);
    const c = ctx.counters ? ctx.counters() : null;
    // The last run's move, shown once at the start of this one.
    const last = c && c.circuitLast && !d.seenMove && c.circuitLast.at <= inst.startsAt + 1 && c.circuitLast.at >= inst.startsAt - 7 * 864e5 ? c.circuitLast : null;
    return {
      summary: `${ordinal(me.place)} · ${div.name}`,
      rows: rows.map((r) => ({ name: r.name, score: r.score, you: r.you, place: r.place, prize: r.prize })),
      prizes: prizeList(div.prizes, inst.scale),
      game: {
        kind: 'circuit',
        button: 'Play',
        division: d.division,
        divisions: cfg.divisions.map((x) => ({ name: x.name, colors: x.colors })),
        name: div.name,
        rows,
        place: me.place,
        crowns: d.crowns,
        wins: d.wins,
        up: d.division < cfg.divisions.length - 1 ? cfg.up : 0,
        down: d.division > 0 ? cfg.down : 0,
        crownsPerWin: cfg.crownsPerWin,
        last: last ? { ...last, fromName: cfg.divisions[last.from].name, toName: cfg.divisions[last.to].name } : null,
        endsAt: inst.endsAt,
      },
    };
  },
};
