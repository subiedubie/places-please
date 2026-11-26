import test from 'node:test';
import assert from 'node:assert/strict';
import archery, { makeRange, stepsFor, rng } from '../meta/events/archery.js';
import { EVENTS, TIER_POINTS } from '../config/events.js';
import { USUAL } from '../config/rivals.js';
import { addDays, weekday } from '../meta/events/calendar.js';

// The entry proposed for config/events.js (used until it is there).
const PROPOSED = {
  type: 'archery',
  title: 'The Bullseye Fair',
  blurb: 'A new archery contest every day, Friday to Sunday. Win levels for arrows (wins in a row multiply them), then shoot the fairground targets. Top ten each day are paid.',
  arrowsPerWin: [1, 1, 2, 3],
  multiplier: { max: 5, step: 1 },
  streakResetsDaily: true,
  startArrows: 0,
  dailyArrows: 5,
  targets: { balloon: 1, board: 3, duck: 5, gold: 25 },
  maxPointsPerArrow: 60,
  maxInFlight: 50,
  rivals: 49,
  rivalPointsPerLevel: 19,
  steps: [10, 20, 35, 50, 75, 100, 135, 170, 205, 245, 290, 335, 380, 430, 480, 530, 585, 645, 705, 760].map((need, i) => ({
    need,
    reward: [
      { coins: 50 }, { coins: 75 }, { boosters: { spot: 1 } }, { coins: 100 }, { packs: 1 },
      { coins: 100 }, { boosters: { drill: 1 } }, { coins: 150 }, { boost: { powers: ['spot-h'], minutes: 15 } }, { coins: 300, packs: 1 },
      { coins: 150 }, { boosters: { coinflip: 1 } }, { coins: 200 }, { boosters: { show: 1 } }, { coins: 400, packs: 1 },
      { coins: 200 }, { boosters: { stageleft: 1 } }, { coins: 250 }, { boosters: { prism: 1 } }, { coins: 1000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 15 } },
    ][i],
  })),
  prizes: [
    { place: 1, reward: { coins: 1500, packs: 1, boost: { powers: ['prism', 'show'], minutes: 20 } } },
    { place: 2, reward: { coins: 900, packs: 1 } },
    { place: 3, reward: { coins: 600, packs: 1 } },
    { place: 4, to: 10, reward: { coins: 200 } },
  ],
};
const cfg = EVENTS.bullseye || PROPOSED;

const HOUR = 3600e3;
const FRIDAY = new Date(2026, 10, 27).getTime(); // Friday 27 Nov. 2026, 00:00 local
const MONDAY = addDays(FRIDAY, 3);

function ctxAt(now) {
  const paid = [];
  return { now, paid, pay: (r, t) => paid.push({ t, r }), count() {}, counters: () => ({}), team: () => null };
}
function fresh(seed = 11, pace = 'even', now = FRIDAY + 9 * HOUR) {
  const inst = { id: 'bullseye@x', key: 'bullseye', seed, startsAt: FRIDAY, endsAt: MONDAY, pace, scale: 1, state: 'running', done: false, data: {} };
  archery.begin(inst, cfg, ctxAt(now));
  return inst;
}
const shoot = (inst, points, c) => {
  const a = archery.act(inst, cfg, { shoot: true }, c);
  if (!a.ok) return a;
  return archery.act(inst, cfg, { score: { arrow: a.arrow, points } }, c);
};

test('the test dates are a Friday to Monday', () => {
  assert.equal(weekday(FRIDAY), 4);
  assert.equal(weekday(MONDAY), 0);
});

test('wins pay arrows by tier times the streak multiplier; a loss resets it', () => {
  const inst = fresh();
  const c = ctxAt(FRIDAY + 10 * HOUR);
  const start = inst.data.arrows;
  assert.equal(start, (cfg.startArrows || 0) + (cfg.dailyArrows || 0));
  let expect = start;
  for (let i = 0; i < 7; i++) {
    const mult = inst.data.mult;
    assert.equal(mult, Math.min(cfg.multiplier.max, i + 1));
    archery.onLevel(inst, cfg, { won: true, tier: 2 }, c);
    expect += cfg.arrowsPerWin[2] * mult;
    assert.equal(inst.data.arrows, expect);
  }
  assert.equal(inst.data.mult, cfg.multiplier.max);
  const line = archery.onLevel(inst, cfg, { won: false, tier: 2 }, c);
  assert.match(line, /back to x1/);
  assert.equal(inst.data.mult, 1);
  assert.equal(inst.data.arrows, expect);
  assert.equal(archery.view(inst, cfg, c).game.mult, 1);
});

test('no arrow, no shot; only a fired arrow can bank, once, and points are capped', () => {
  const inst = fresh();
  const c = ctxAt(FRIDAY + 10 * HOUR);
  inst.data.arrows = 1;
  const a = archery.act(inst, cfg, { shoot: true }, c);
  assert.ok(a.ok);
  assert.equal(a.arrows, 0);
  assert.equal(archery.act(inst, cfg, { shoot: true }, c).reason, 'arrows');
  assert.equal(archery.act(inst, cfg, { score: { arrow: 999, points: 5 } }, c).ok, false);
  const s = archery.act(inst, cfg, { score: { arrow: a.arrow, points: 10000 } }, c);
  assert.equal(s.points, cfg.maxPointsPerArrow);
  assert.equal(archery.act(inst, cfg, { score: { arrow: a.arrow, points: 5 } }, c).ok, false);
  inst.data.arrows = 1;
  assert.equal(shoot(inst, -7, c).points, 0);
  assert.equal(inst.data.score, cfg.maxPointsPerArrow);
});

test('step prizes are paid in order as points pass each step; view shows them', () => {
  const inst = fresh();
  const c = ctxAt(FRIDAY + 12 * HOUR);
  inst.data.arrows = 1000;
  const ladder = stepsFor(cfg, FRIDAY);
  assert.equal(ladder.length, cfg.steps.length);
  let guard = 0;
  while (inst.data.stepsDone < ladder.length && guard++ < 1000) shoot(inst, 20, c);
  assert.deepEqual(c.paid.map((p) => p.t), ladder.map((_, i) => `Step ${i + 1}`));
  const v = archery.view(inst, cfg, c);
  assert.ok(v.steps.every((s) => s.done));
  assert.equal(v.progress, null);
  assert.equal(v.game.stepNeed, null);
});

test('a 50-player board whose 49 rivals do not react to the player', () => {
  const a = fresh(3);
  const b = fresh(3);
  const t = FRIDAY + 15 * HOUR;
  b.data.score = 5000;
  const ra = archery.view(a, cfg, ctxAt(t)).rows.filter((r) => !r.you).map((r) => [r.name, r.score]);
  const rb = archery.view(b, cfg, ctxAt(t)).rows.filter((r) => !r.you).map((r) => [r.name, r.score]);
  assert.equal(ra.length, 49);
  assert.deepEqual(ra.sort(), rb.sort());
  const v = archery.view(b, cfg, ctxAt(t));
  assert.equal(v.rows.length, 50);
  assert.equal(v.rows[0].you, true);
  assert.match(v.summary, /^1st of 50/);
  assert.ok(v.rows.slice(0, 10).every((r) => r.prize));
  assert.ok(v.rows.slice(10).every((r) => !r.prize));
  // before 8 am the rivals have not started
  assert.ok(archery.view(a, cfg, ctxAt(FRIDAY + 2 * HOUR)).rows.every((r) => r.score === 0));
});

test('each day is its own contest: midnight pays the top ten and starts again', () => {
  const inst = fresh(21);
  const c = ctxAt(FRIDAY + 20 * HOUR);
  inst.data.arrows = 100;
  for (let i = 0; i < 40; i++) shoot(inst, 30, c); // 1200 on a Friday: surely 1st
  archery.onLevel(inst, cfg, { won: true, tier: 0 }, c);
  archery.onLevel(inst, cfg, { won: true, tier: 0 }, c);
  assert.equal(inst.data.mult, 3);
  const arrows = inst.data.arrows;
  // Saturday morning
  const sat = ctxAt(addDays(FRIDAY, 1) + 9 * HOUR);
  archery.tick(inst, cfg, sat);
  assert.equal(sat.paid.length, 1);
  assert.equal(sat.paid[0].t, '1st place, Friday');
  assert.equal(inst.data.score, 0);
  assert.equal(inst.data.stepsDone, 0);
  assert.equal(inst.data.mult, cfg.streakResetsDaily ? 1 : 3);
  assert.equal(inst.data.arrows, arrows + (cfg.dailyArrows || 0));
  assert.equal(archery.view(inst, cfg, sat).game.day, 'Saturday');
  assert.equal(archery.view(inst, cfg, sat).game.dayNumber, 2);
  // Nothing played on Saturday; the app is next opened after the weekend.
  // The engine ticks at the end time and then calls end().
  const endCtx = ctxAt(MONDAY);
  archery.tick(inst, cfg, endCtx);
  archery.end(inst, cfg, endCtx);
  assert.equal(endCtx.paid.length, 0); // 0 points on Saturday: 50th, no prize
  assert.deepEqual(inst.data.results.map((r) => r.place), [1, 50]);
  assert.equal(inst.data.day, null);
});

test('a played Sunday is paid when the weekend ends', () => {
  const inst = fresh(5);
  const sun = ctxAt(addDays(FRIDAY, 2) + 22 * HOUR);
  archery.tick(inst, cfg, sun);
  inst.data.arrows = 100;
  for (let i = 0; i < 60; i++) shoot(inst, 30, sun);
  const endCtx = ctxAt(MONDAY);
  archery.tick(inst, cfg, endCtx);
  archery.end(inst, cfg, endCtx);
  assert.deepEqual(endCtx.paid.map((p) => p.t), ['1st place, Sunday']);
});

test('the range: arrows pierce through several targets and report once', () => {
  const R = makeRange({ w: 375, h: 560, targets: cfg.targets, rand: rng(4) });
  let done = 0;
  let multi = 0;
  for (let k = 0; k < 200; k++) {
    R.fire(-Math.PI / 2 + (k % 9 - 4) * 0.12, k);
    for (let i = 0; i < 40; i++) for (const e of R.step(1 / 60)) {
      if (e.type === 'done') { done++; if (e.hits > 1) multi++; assert.ok(e.points >= 0); }
    }
  }
  assert.equal(done, 200);
  assert.ok(multi > 10, `multi-hit arrows: ${multi}`);
});

// ---- SIZING ---------------------------------------------------------------
// Points per arrow come from shooting at the real range with two simple
// "players": one who sprays anywhere upward, one who aims at a target where
// it is now (without leading moving ones). Then whole days are played: the
// owner's rate (about 20 wins on Friday, 50 on Saturday and Sunday), tiers
// averaging about 1.4 points, 4 wins in 5 levels.
function pointsSample(bot, seed, shots = 500) {
  const rand = rng(seed);
  const R = makeRange({ w: 375, h: 560, targets: cfg.targets, range: cfg.range, rand });
  const out = [];
  let fired = 0;
  let clock = 0;
  for (let i = 0; i < 60 * 60 * 30 && out.length < shots; i++) {
    clock += 1 / 60;
    if (fired < shots && clock >= 0.6) {
      clock = 0;
      let ang;
      if (bot === 'spray') ang = -Math.PI * (0.15 + 0.7 * rand());
      else {
        const live = R.items.filter((o) => o.alive && (o.kind !== 'board' || o.down <= 0));
        const o = live[Math.floor(rand() * live.length)];
        ang = Math.atan2(o.y - R.bow.y, o.x - R.bow.x);
      }
      R.fire(ang, fired++);
    }
    for (const e of R.step(1 / 60)) if (e.type === 'done') out.push(e.points);
  }
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const TIER_ODDS = [0.75, 0.15, 0.07, 0.03];
function drawTier(r) {
  let x = r();
  for (let i = 0; i < TIER_ODDS.length; i++) { x -= TIER_ODDS[i]; if (x < 0) return i; }
  return 0;
}

// Play one day. share = how much of the usual number of wins the player gets.
function playDay(seed, dayIndex, share, sample, pace = 'even') {
  const r = rng(seed * 7 + dayIndex);
  const day = addDays(FRIDAY, dayIndex);
  const inst = fresh(seed, pace, day + 1 * HOUR);
  if (dayIndex > 0) archery.tick(inst, cfg, ctxAt(day + 1 * HOUR));
  const wins = Math.round((weekday(day) >= 5 ? USUAL.weekend : USUAL.weekday) * share);
  const ladder = stepsFor(cfg, day);
  let won = 0;
  let doneAt = null;
  let levels = 0;
  while (won < wins) {
    levels++;
    const t = day + 9 * HOUR + (14 * HOUR * won) / wins;
    const c = ctxAt(t);
    const w = r() < 0.8;
    archery.onLevel(inst, cfg, { won: w, tier: drawTier(r) }, c);
    if (!w) continue;
    won++;
    while (inst.data.arrows > 0) shoot(inst, sample[Math.floor(r() * sample.length)], c);
    if (doneAt === null && inst.data.stepsDone >= ladder.length) doneAt = won / wins;
  }
  const v = archery.view(inst, cfg, ctxAt(addDays(day, 1) - 1));
  return { score: inst.data.score, steps: inst.data.stepsDone, doneAt, place: v.rows.find((x) => x.you).place, shots: inst.data.shots, levels };
}

test('sizing: a steady player finishes the step ladder late in the day and places, but not trivially', () => {
  const spray = pointsSample('spray', 1);
  const aim = pointsSample('aim', 2);
  const tierAvg = TIER_ODDS.reduce((a, p, i) => a + p * TIER_POINTS[i], 0);
  assert.ok(tierAvg > 1.3 && tierAvg < 1.5);
  const lines = [`points per arrow: spray ${mean(spray).toFixed(2)}, aim ${mean(aim).toFixed(2)}; spray misses ${(spray.filter((p) => p === 0).length / spray.length * 100).toFixed(0)}%`];
  // Shooting matters more than aiming: spraying still scores.
  assert.ok(mean(spray) > 2, 'spraying should still score');
  assert.ok(mean(aim) > mean(spray));
  const report = {};
  for (const [who, share, sample] of [['steady aim', 1, aim], ['steady spray', 1, spray], ['light (60%) aim', 0.6, aim]]) {
    for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
      const runs = [];
      for (let s = 1; s <= 12; s++) runs.push(playDay(s, dayIndex, share, sample));
      const key = `${who} ${['Fri', 'Sat', 'Sun'][dayIndex]}`;
      const finished = runs.filter((x) => x.doneAt !== null);
      report[key] = {
        finished: finished.length / runs.length,
        doneAt: finished.length ? mean(finished.map((x) => x.doneAt)) : null,
        top10: runs.filter((x) => x.place <= 10).length / runs.length,
        first: runs.filter((x) => x.place === 1).length / runs.length,
        place: mean(runs.map((x) => x.place)),
        score: mean(runs.map((x) => x.score)),
        shots: mean(runs.map((x) => x.shots)),
      };
      const q = report[key];
      lines.push(`${key.padEnd(22)} ladder done ${(q.finished * 100).toFixed(0).padStart(3)}%` +
        `${q.doneAt ? ` at ${(q.doneAt * 100).toFixed(0)}% of wins` : '              '}` +
        `  top10 ${(q.top10 * 100).toFixed(0).padStart(3)}%  1st ${(q.first * 100).toFixed(0).padStart(3)}%  avg place ${q.place.toFixed(1)}  points ${q.score.toFixed(0)}  arrows ${q.shots.toFixed(0)}`);
    }
  }
  console.log(lines.join('\n'));
  for (const d of ['Fri', 'Sat', 'Sun']) {
    const st = report[`steady aim ${d}`];
    assert.ok(st.finished >= 0.6, `${d}: steady aim should usually finish the ladder`);
    assert.ok(st.doneAt > 0.6, `${d}: but not early in the day`);
    assert.ok(st.top10 >= 0.6, `${d}: steady should usually make the top ten`);
    assert.ok(st.first < 0.9, `${d}: first place should not be a given`);
    const light = report[`light (60%) aim ${d}`];
    assert.ok(light.finished <= 0.25, `${d}: a light day should not finish the ladder`);
  }
});
