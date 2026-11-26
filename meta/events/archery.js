// THE BULLSEYE FAIR (type 'archery'). A fairground archery contest that runs
// as one contest a DAY: Friday, Saturday and Sunday, each midnight to
// midnight, against 49 computer archers.
//
//   - Every level you win pays arrows (more for harder levels) TIMES your
//     streak multiplier: x1, x2, x3 ... up to a maximum. A lost level puts
//     the multiplier back to x1. The multiplier shown is the one your next
//     win will use.
//   - On the range, every target an arrow passes through scores points (an
//     arrow flies straight and pierces everything in its path). The points
//     are your score in today's contest.
//   - Your own points climb a ladder of step prizes during the day, and at
//     midnight the top ten of the fifty are paid. Then the next day's
//     contest starts from zero (unspent arrows are kept for the weekend).
//
// The rules cannot see the shooting. The play screen reports each arrow:
//   act({ shoot: true })                 spends one arrow; returns its number
//   act({ score: { arrow, points } })    banks what that arrow scored (the
//                                        points are capped per arrow here)
//
// Also in this file: makeRange(), the moving targets and the flying arrows
// of the range itself, with no drawing in it, so the play screen and the
// tests share exactly the same targets.
//
// Saved: inst.data = { arrows, mult, day, score, stepsDone, next, open,
//                      shots, hits, best, results: [{ day, score, place }] }
import { YOU, USUAL } from '../../config/rivals.js';
import { dailyRivals } from './rivals.js';
import { dayStart, addDays, weekday } from './calendar.js';
import { prizeFor, prizeList, ordinal, rank, scaleReward, hash, rng } from './util.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// How big a day's contest is, as a share of a weekend day: a weekday (the
// Friday) is sized from the levels you usually win on a weekday
// (config/rivals.js USUAL), so the step ladder is as reachable on Friday as
// on Saturday. The rivals use the same USUAL numbers.
export function daySize(day) {
  return weekday(day) >= 5 ? 1 : USUAL.weekday / USUAL.weekend;
}

// The step ladder of one day: [{ need, reward }], needs scaled to the day.
export function stepsFor(cfg, day) {
  const k = daySize(day);
  return cfg.steps.map((s) => ({ need: Math.max(1, Math.round(s.need * k)), reward: s.reward }));
}

// The fifty-player board of the contest of `day` at time t, best first.
function board(inst, cfg, day, t, score) {
  const end = addDays(day, 1);
  const rows = dailyRivals({
    seed: hash(inst.seed, 'day', day),
    count: cfg.rivals,
    pace: inst.pace,
    startsAt: day,
    endsAt: end,
    perLevel: cfg.rivalPointsPerLevel,
  }).map((r) => ({ name: r.name, score: r.scoreAt(Math.min(t, end)), you: false }));
  rows.push({ name: YOU, score, you: true });
  rank(rows);
  for (const row of rows) row.prize = prizeFor(cfg.prizes, row.place, inst.scale);
  return rows;
}

// A fresh day's contest (keeps the arrows; the streak starts again at x1
// when cfg.streakResetsDaily is true).
function openDay(inst, cfg, day) {
  const d = inst.data;
  d.day = day;
  d.score = 0;
  d.stepsDone = 0;
  d.open = [];
  d.best = 0;
  if (cfg.streakResetsDaily) d.mult = 1;
  d.arrows += cfg.dailyArrows || 0;
}

// The day `d.day` is over: pay its top-ten prize.
function closeDay(inst, cfg, ctx) {
  const d = inst.data;
  const day = d.day;
  const rows = board(inst, cfg, day, addDays(day, 1), d.score);
  const you = rows.find((r) => r.you);
  d.results.push({ day, score: d.score, place: you.place });
  if (you.prize) ctx.pay(you.prize, `${ordinal(you.place)} place, ${DAY_NAMES[weekday(day)]}`, false);
}

// Move the contest on to the day that `now` is in (paying every day that
// has ended). Nothing happens after the event's end time.
function roll(inst, cfg, ctx) {
  const d = inst.data;
  const today = dayStart(ctx.now);
  if (d.day === today) return;
  if (d.day !== null && d.day < today) closeDay(inst, cfg, ctx);
  if (inst.endsAt === null || ctx.now < inst.endsAt) openDay(inst, cfg, today);
  else d.day = null; // the weekend is over; end() has nothing left to pay
}

function arrowsFor(cfg, tier, mult) {
  const base = cfg.arrowsPerWin[tier] ?? cfg.arrowsPerWin[0];
  return base * mult;
}

export default {
  begin(inst, cfg, ctx) {
    inst.data = { arrows: cfg.startArrows || 0, mult: 1, day: null, score: 0, stepsDone: 0, next: 1, open: [], shots: 0, hits: 0, best: 0, results: [] };
    // The first day's own daily arrows are given by openDay.
    const now = Math.max(ctx.now, inst.startsAt);
    if (inst.endsAt === null || now < inst.endsAt) openDay(inst, cfg, dayStart(now));
  },

  tick(inst, cfg, ctx) {
    roll(inst, cfg, ctx);
  },

  end(inst, cfg, ctx) {
    // sync() has already ticked at the end time, which paid the last day.
    // If it has not (an older save), pay it now.
    if (inst.data.day !== null) closeDay(inst, cfg, ctx);
    inst.data.day = null;
  },

  onLevel(inst, cfg, res, ctx) {
    roll(inst, cfg, ctx);
    const d = inst.data;
    if (!res.won) {
      const had = d.mult;
      d.mult = 1; // a loss puts the multiplier back to x1
      return had > 1 ? `Streak lost: back to x1 (was x${had})` : null;
    }
    const n = arrowsFor(cfg, res.tier ?? 0, d.mult);
    const used = d.mult;
    d.arrows += n;
    d.mult = Math.min(cfg.multiplier.max, d.mult + (cfg.multiplier.step || 1));
    return `+${n} ${n === 1 ? 'arrow' : 'arrows'}${used > 1 ? ` (x${used})` : ''}`;
  },

  // action = { shoot: true }
  //   -> { ok, arrow, arrows }            or { ok: false, reason: 'arrows' }
  // action = { score: { arrow, points } }
  //   -> { ok, points, score, place, steps: [{ step, reward }], arrows }
  act(inst, cfg, action, ctx) {
    roll(inst, cfg, ctx);
    const d = inst.data;
    if (inst.done || d.day === null || !action) return { ok: false, arrows: d.arrows };
    if (action.shoot) {
      if (d.arrows < 1) return { ok: false, reason: 'arrows', arrows: 0 };
      d.arrows--;
      d.shots++;
      const id = d.next++;
      d.open.push(id);
      // Arrows whose result never came back (the app was closed mid-flight)
      // are forgotten after a while, so the list stays short.
      const keep = cfg.maxInFlight || 50;
      if (d.open.length > keep) d.open.splice(0, d.open.length - keep);
      return { ok: true, arrow: id, arrows: d.arrows };
    }
    if (action.score && typeof action.score === 'object') {
      const { arrow } = action.score;
      const i = d.open.indexOf(arrow);
      if (i < 0) return { ok: false, reason: 'arrow', arrows: d.arrows }; // unknown or already banked
      d.open.splice(i, 1);
      let points = Math.floor(Number(action.score.points) || 0);
      points = Math.max(0, Math.min(cfg.maxPointsPerArrow, points));
      d.score += points;
      if (points > 0) d.hits++;
      d.best = Math.max(d.best, points);
      const ladder = stepsFor(cfg, d.day);
      const paid = [];
      while (d.stepsDone < ladder.length && d.score >= ladder[d.stepsDone].need) {
        const s = ladder[d.stepsDone];
        ctx.pay(s.reward, `Step ${d.stepsDone + 1}`);
        paid.push({ step: d.stepsDone + 1, reward: scaleReward(s.reward, inst.scale), last: d.stepsDone === ladder.length - 1 });
        d.stepsDone++;
      }
      const you = board(inst, cfg, d.day, ctx.now, d.score).find((r) => r.you);
      return { ok: true, points, score: d.score, place: you.place, steps: paid, arrows: d.arrows };
    }
    return { ok: false, arrows: d.arrows };
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const day = d.day === null ? dayStart(ctx.now) : d.day;
    const rows = board(inst, cfg, day, ctx.now, d.score);
    const you = rows.find((r) => r.you);
    const ladder = stepsFor(cfg, day);
    const next = ladder[d.stepsDone];
    const prev = d.stepsDone > 0 ? ladder[d.stepsDone - 1].need : 0;
    const dayName = DAY_NAMES[weekday(day)];
    return {
      summary: `${ordinal(you.place)} of ${rows.length} · x${d.mult}`,
      progress: next ? { have: d.score, need: next.need } : null,
      steps: ladder.map((s, i) => ({ need: s.need, reward: scaleReward(s.reward, inst.scale), done: i < d.stepsDone, current: i === d.stepsDone })),
      rows,
      prizes: prizeList(cfg.prizes, inst.scale),
      game: {
        kind: 'archery',
        button: 'Shoot',
        arrows: d.arrows,
        mult: d.mult,
        maxMult: cfg.multiplier.max,
        arrowsPerWin: cfg.arrowsPerWin,
        nextWin: arrowsFor(cfg, 0, d.mult), // arrows the next Rehearsal win pays
        score: d.score,
        place: you.place,
        players: rows.length,
        day: dayName,
        dayEndsAt: Math.min(addDays(day, 1), inst.endsAt ?? Infinity),
        // Which of the contest's days this is (Friday = 1 of 3).
        dayNumber: Math.max(1, Math.round((day - dayStart(inst.startsAt)) / 864e5) + 1),
        days: inst.endsAt ? Math.round((inst.endsAt - dayStart(inst.startsAt)) / 864e5) : 1,
        step: d.stepsDone, // steps done today
        stepCount: ladder.length,
        stepFrom: prev,
        stepNeed: next ? next.need : null,
        stepReward: next ? scaleReward(next.reward, inst.scale) : null,
        targets: cfg.targets,
        range: cfg.range || null,
        maxPointsPerArrow: cfg.maxPointsPerArrow,
        // The top of the board, and the rows around yours.
        top: rows.slice(0, 10).map((r) => ({ name: r.name, score: r.score, place: r.place, you: r.you, prize: r.prize })),
        near: rows.slice(Math.max(0, you.place - 3), you.place + 2).map((r) => ({ name: r.name, score: r.score, place: r.place, you: r.you })),
        results: d.results.map((r) => ({ day: DAY_NAMES[weekday(r.day)], score: r.score, place: r.place })),
        shots: d.shots,
        best: d.best,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// THE RANGE: the moving targets and the arrows, with no drawing. The play
// screen draws what is in `items` and `arrows`; the tests shoot at it to
// size the contest. Everything is in CSS pixels of a field w x h (the bow
// sits at the bottom middle). Sizes are worked out from the width of a
// phone (375), so a wider field gets bigger targets, not emptier space.
//
// cfg.range may change any of these (config/events.js):
export const RANGE = {
  balloons: 14, // balloons drifting up at once
  balloonSpeed: [34, 62], // how fast they rise, pixels a second (at 375 wide)
  boards: 4, // spinning boards on sliding posts
  boardSpin: [1.4, 2.4], // turns a second (a board edge-on cannot be hit)
  boardBack: 2.2, // seconds a knocked board takes to swing back up
  duckSpeed: 82, // the duck parade's speed along its rail, pixels a second
  duckGap: 60, // pixels between ducks on the rail
  goldEvery: [7, 12], // seconds between gold bullseyes
  goldSpeed: [95, 135], // how fast the gold one crosses, pixels a second
  goldWarn: 1.4, // seconds of "Gold incoming!" before it appears
  arrowSpeed: 1250, // pixels a second
};

// Sizes (radius, at 375 wide) and where each kind lives (share of height).
const SIZE = { balloon: 19, board: 27, duck: 18, gold: 31 };
const BALLOON_COLORS = 6;

// rand: a function returning 0..1 (Math.random on screen, seeded in tests).
export function makeRange({ w, h, targets, range, rand = Math.random }) {
  const P = { ...RANGE, ...(range || {}) };
  const u = w / 375;
  const pts = (k) => (targets && targets[k]) || { balloon: 1, board: 3, duck: 5, gold: 25 }[k] || 1;
  const between = ([lo, hi]) => lo + (hi - lo) * rand();
  const R = {
    w, h, u, t: 0,
    bow: { x: w / 2, y: h - 34 * u },
    items: [],
    arrows: [],
    goldIn: between(P.goldEvery) * 0.6, // the first one comes a little sooner
    goldWarning: 0, // seconds until a gold one appears (0 = none coming)
    duckClock: 0,
    nextId: 1,
  };
  const top = h * 0.06; // the highest a target goes
  const low = h * 0.7; // the lowest a target goes (above the bow)

  function add(o) {
    o.id = R.nextId++;
    o.alive = true;
    o.age = 0;
    R.items.push(o);
    return o;
  }
  function balloon(y0) {
    const r = SIZE.balloon * u * (0.9 + 0.25 * rand());
    return add({ kind: 'balloon', r, x: r + rand() * (w - 2 * r), base: 0, y: y0, vy: -between(P.balloonSpeed) * u, phase: rand() * 6.28, color: Math.floor(rand() * BALLOON_COLORS), points: pts('balloon') });
  }
  // Balloons start spread over the whole sky.
  for (let i = 0; i < P.balloons; i++) {
    const b = balloon(top + (low - top) * ((i + rand()) / P.balloons));
    b.base = b.x;
  }
  // Boards in a row in the middle, each on a post that slides a little.
  for (let i = 0; i < P.boards; i++) {
    const cx = (w * (i + 0.5)) / P.boards;
    add({ kind: 'board', r: SIZE.board * u, cx, x: cx, y: h * 0.47, spin: between(P.boardSpin), phase: rand() * 6.28, slide: w * 0.045, slidePhase: rand() * 6.28, angle: rand() * 6.28, down: 0, points: pts('board') });
  }
  // The duck rail near the top: start with it full.
  const rail = h * 0.2;
  for (let x = -SIZE.duck * u; x < w + SIZE.duck * u; x += P.duckGap * u) {
    add({ kind: 'duck', r: SIZE.duck * u, x, y: rail, vx: P.duckSpeed * u, points: pts('duck') });
  }

  // Is item o hittable now, and where is it?
  function solid(o) {
    if (!o.alive) return false;
    if (o.kind === 'board') return o.down <= 0 && Math.abs(Math.cos(o.angle)) > 0.28;
    return true;
  }

  // Fire an arrow from the bow at `angle` (radians; -PI/2 is straight up).
  R.fire = (angle, tag) => {
    const a = Math.max(-Math.PI + 0.18, Math.min(-0.18, angle));
    const s = P.arrowSpeed * u;
    const arrow = { tag, x: R.bow.x, y: R.bow.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, angle: a, hits: [], points: 0, done: false, age: 0 };
    R.arrows.push(arrow);
    return arrow;
  };

  // Move everything on by dt seconds. Returns what happened:
  //   { type: 'hit', arrow, item, points, combo }   (combo = hits so far by that arrow)
  //   { type: 'done', arrow, points, hits }          (the arrow has left the field)
  //   { type: 'gold' }                                (a gold bullseye just came on)
  R.step = (dt) => {
    const out = [];
    R.t += dt;
    // ---- targets ----
    let balloons = 0;
    for (const o of R.items) {
      o.age += dt;
      if (!o.alive) continue;
      if (o.kind === 'balloon') {
        o.y += o.vy * dt;
        o.x = o.base + Math.sin(R.t * 1.3 + o.phase) * 10 * u;
        if (o.y < -o.r * 2.5) o.alive = false;
        else balloons++;
      } else if (o.kind === 'board') {
        o.angle += o.spin * dt * Math.PI;
        o.x = o.cx + Math.sin(R.t * 0.6 + o.slidePhase) * o.slide;
        if (o.down > 0) o.down = Math.max(0, o.down - dt);
      } else if (o.kind === 'duck') {
        o.x += o.vx * dt;
        if (o.x > w + o.r * 2) o.alive = false;
      } else if (o.kind === 'gold') {
        o.x += o.vx * dt;
        o.y = o.baseY + Math.sin(R.t * 2.2) * 14 * u;
        if (o.x < -o.r * 2.5 || o.x > w + o.r * 2.5) o.alive = false;
      }
    }
    // keep the sky full of balloons, rising from below the targets
    for (let k = balloons; k < P.balloons; k++) {
      const b = balloon(low + SIZE.balloon * u * (1 + rand() * 2));
      b.base = b.x;
    }
    // new ducks on the rail
    R.duckClock += dt;
    if (R.duckClock >= P.duckGap / P.duckSpeed) {
      R.duckClock = 0;
      add({ kind: 'duck', r: SIZE.duck * u, x: -SIZE.duck * u * 1.5, y: rail, vx: P.duckSpeed * u, points: pts('duck') });
    }
    // the gold bullseye: a warning, then across the field
    if (R.goldWarning > 0) {
      R.goldWarning -= dt;
      if (R.goldWarning <= 0) {
        R.goldWarning = 0;
        const left = rand() < 0.5;
        const r = SIZE.gold * u;
        const baseY = h * (0.3 + rand() * 0.06);
        add({ kind: 'gold', r, x: left ? -r * 2 : w + r * 2, y: baseY, baseY, vx: (left ? 1 : -1) * between(P.goldSpeed) * u, points: pts('gold') });
        out.push({ type: 'gold' });
      }
    } else if (!R.items.some((o) => o.kind === 'gold' && o.alive)) {
      R.goldIn -= dt;
      if (R.goldIn <= 0) {
        R.goldIn = between(P.goldEvery);
        R.goldWarning = P.goldWarn;
      }
    }
    // ---- arrows: move in short hops and pierce whatever they cross ----
    for (const a of R.arrows) {
      if (a.done) continue;
      a.age += dt;
      const dist = Math.hypot(a.vx, a.vy) * dt;
      const hops = Math.max(1, Math.ceil(dist / (8 * u)));
      for (let k = 0; k < hops; k++) {
        const x0 = a.x;
        const y0 = a.y;
        a.x += (a.vx * dt) / hops;
        a.y += (a.vy * dt) / hops;
        for (const o of R.items) {
          if (!solid(o) || a.hits.includes(o.id)) continue;
          if (segDist(o.x, o.y, x0, y0, a.x, a.y) < o.r) {
            a.hits.push(o.id);
            a.points += o.points;
            if (o.kind === 'board') o.down = P.boardBack; // knocked back, swings up later
            else o.alive = false;
            o.hitAt = R.t;
            out.push({ type: 'hit', arrow: a, item: o, points: o.points, combo: a.hits.length });
          }
        }
      }
      if (a.y < -40 * u || a.x < -40 * u || a.x > w + 40 * u) {
        a.done = true;
        out.push({ type: 'done', arrow: a, points: a.points, hits: a.hits.length });
      }
    }
    // forget what is long gone (popped items are kept briefly for the screen)
    R.items = R.items.filter((o) => o.alive || R.t - (o.hitAt ?? -99) < 1);
    R.arrows = R.arrows.filter((a) => !a.done || a.age < 0.05);
    return out;
  };
  return R;
}

// Distance from point (px, py) to the segment (x0, y0)-(x1, y1).
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

// A seeded random-number maker for the range in tests (re-exported).
export { rng };
