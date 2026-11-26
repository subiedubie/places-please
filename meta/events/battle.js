// BATTLE OF THE COMPANIES (type 'battle'). Twenty theatre companies fight
// for the block. A company's score is the shields its members win: every
// level you win pays shields (more for harder levels), and so do your 49
// castmates' wins. When the block ends the top companies are paid (you, as
// a member of yours), and so are the top contributors inside your company.
// You must have added at least `minShields` yourself to be paid anything.
//
// Your castmates and the other 19 companies follow schedules fixed by the
// seed when the battle starts (meta/events/castmates.js). They never react
// to you. The other companies' strength depends on the Relaxed / Even /
// Tough setting (cfg.rivalStrength).
//
// Saved: inst.data = { mine: your shields, wins: your wins, seen, paid }
import { YOU } from '../../config/rivals.js';
import { hash, rng, between, rank, prizeFor, prizeList, ordinal } from './util.js';
import { castmates, mateSchedules, usualLevels, teamName, yourAvatar, meanShare } from './castmates.js';

function mates(inst, cfg) {
  return mateSchedules({
    seed: hash(inst.seed, 'battle-mates'),
    count: cfg.members - 1,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    share: cfg.mateShare,
    perLevel: cfg.mateShieldsPerWin,
    skew: cfg.mateSkew ?? 1,
  });
}

// The other companies: [{ name, strength, scoreAt(t) }]. A strength of 1
// is a company that wins as many shields as yours would on average.
export function rivalTeams(inst, cfg) {
  const r = rng(hash(inst.seed, 'teams'));
  const pool = cfg.companyNames.slice();
  const range = cfg.rivalStrength[inst.pace] || cfg.rivalStrength.even;
  // What your company wins per "usual level" on average.
  const base = (cfg.members - 1) * meanShare(cfg.mateShare, cfg.mateSkew ?? 1) * cfg.mateShieldsPerWin + 1.4;
  const out = [];
  for (let i = 0; i < cfg.teams - 1; i++) {
    const name = pool.length ? pool.splice(Math.floor(r() * pool.length), 1)[0] : `Company ${i + 1}`;
    const strength = between(r, range);
    const mySeed = hash(inst.seed, 'team', i);
    out.push({ name, strength, scoreAt: (t) => Math.floor(usualLevels(mySeed, inst.startsAt, inst.endsAt, t) * strength * base) });
  }
  return out;
}

// Everything at time t: your company's members, the board of companies.
export function battleAt(inst, cfg, ctx, t) {
  const people = castmates(ctx, inst);
  const members = mates(inst, cfg).map((m, i) => ({
    name: (people[i] && people[i].name) || `Castmate ${i + 1}`,
    avatar: (people[i] && people[i].avatar) || 'cat',
    score: m.scoreAt(t),
    you: false,
  }));
  members.push({ name: YOU, avatar: yourAvatar(ctx), score: inst.data.mine, you: true });
  rank(members);
  const ours = members.reduce((a, m) => a + m.score, 0);
  const teams = rivalTeams(inst, cfg).map((tm) => ({ name: tm.name, score: tm.scoreAt(t), you: false }));
  teams.push({ name: teamName(ctx), score: ours, you: true });
  rank(teams);
  for (const tm of teams) tm.prize = prizeFor(cfg.teamPrizes, tm.place, inst.scale);
  for (const m of members) m.prize = prizeFor(cfg.memberPrizes, m.place, inst.scale);
  return { members, teams, ours, team: teams.find((x) => x.you), me: members.find((x) => x.you) };
}

export default {
  begin(inst) {
    inst.data = { mine: 0, wins: 0, seen: 0, paid: null };
  },

  onLevel(inst, cfg, res) {
    if (!res.won || inst.done) return null;
    const n = cfg.shieldsPerWin[res.tier] ?? cfg.shieldsPerWin[0];
    inst.data.mine += n;
    inst.data.wins += 1;
    return `+${n} ${n === 1 ? 'shield' : 'shields'}`;
  },

  // action = { seen: score } (the screen counted your company up to there).
  act(inst, cfg, action) {
    if (action && Number.isFinite(action.seen)) inst.data.seen = Math.max(inst.data.seen || 0, Math.floor(action.seen));
    return { ok: true };
  },

  // The block is over: pay the company's place and your place in it.
  end(inst, cfg, ctx) {
    const d = inst.data;
    if (d.paid) return;
    const b = battleAt(inst, cfg, ctx, inst.endsAt);
    d.paid = { team: b.team.place, member: b.me.place };
    if (d.mine < (cfg.minShields || 0)) return;
    const tp = prizeFor(cfg.teamPrizes, b.team.place, 1);
    if (tp) ctx.pay(tp, `${ordinal(b.team.place)} company`);
    const mp = prizeFor(cfg.memberPrizes, b.me.place, 1);
    if (mp) ctx.pay(mp, `${ordinal(b.me.place)} in your company`);
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const b = battleAt(inst, cfg, ctx, ctx.now);
    const short = d.mine < (cfg.minShields || 0);
    return {
      summary: `${ordinal(b.team.place)} of ${cfg.teams}`,
      rows: b.teams.map((t) => ({ name: t.name, score: t.score, you: t.you, place: t.place, prize: t.prize })),
      prizes: prizeList(cfg.teamPrizes, inst.scale),
      progress: null,
      game: {
        kind: 'battle',
        button: 'Play',
        team: b.team.name,
        teamPlace: b.team.place,
        teams: b.teams,
        members: b.members,
        myPlace: b.me.place,
        mine: d.mine,
        wins: d.wins,
        ours: b.ours,
        seen: Math.min(d.seen || 0, b.ours),
        minShields: cfg.minShields || 0,
        needMore: short ? (cfg.minShields || 0) - d.mine : 0,
        shieldsPerWin: cfg.shieldsPerWin,
        teamPrizes: prizeList(cfg.teamPrizes, inst.scale),
        memberPrizes: prizeList(cfg.memberPrizes, inst.scale),
        endsAt: inst.endsAt,
      },
    };
  },
};
