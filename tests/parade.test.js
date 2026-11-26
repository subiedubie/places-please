import test from 'node:test';
import assert from 'node:assert/strict';
import parade, { simulate, tableOf, newBall, stepBall, tokensFor, TABLE } from '../meta/events/parade.js';
import { EVENTS } from '../config/events.js';
import { USUAL, RIVAL_HOURS } from '../config/rivals.js';
import { hash, rng } from '../meta/events/util.js';

// The entry proposed for config/events.js (used until it is added there).
const PROPOSED = {
  type: 'parade',
  title: 'Paper Dragon Parade',
  blurb: 'Your team of four builds four giant paper dragons. Win levels for balls, drop them down the parade table, and feed the dragon.',
  ballsPerWin: [1, 2, 3, 5],
  startBalls: 5,
  slots: [1, 2, 5, 10, 5, 2, 1],
  slotWidths: [1.2, 1.05, 1, 0.42, 1, 1.05, 1.2],
  points: { bumper: 10, kicker: 5 },
  minPoints: 5,
  maxPoints: 500,
  teammates: 3,
  mateTokensPerLevel: 150,
  youShare: 0.4,
  dragons: [
    { name: 'Crimson Lantern', colors: ['#ff3a4a', '#8a0a1a', '#ffd23a'], stages: [
      { need: 6000, reward: { coins: 150 } },
      { need: 7500, reward: { boosters: { spot: 1 } } },
      { need: 9000, reward: { coins: 300, packs: 1 } } ] },
    { name: 'Jade River', colors: ['#2ad07a', '#0a5a30', '#fff0a0'], stages: [
      { need: 10000, reward: { coins: 250 } },
      { need: 11500, reward: { boosters: { drill: 1, coinflip: 1 } } },
      { need: 13000, reward: { coins: 500, packs: 1 } } ] },
    { name: 'Midnight Pearl', colors: ['#4a7bff', '#1a1a6a', '#ff9ae0'], stages: [
      { need: 14000, reward: { coins: 400 } },
      { need: 15500, reward: { boosters: { show: 1, stageleft: 1 } } },
      { need: 17000, reward: { coins: 800, packs: 2 } } ] },
    { name: 'Golden Sun', colors: ['#ffc21a', '#a04a00', '#ff4a8a'], stages: [
      { need: 18500, reward: { coins: 600, boosters: { prism: 1 } } },
      { need: 21000, reward: { boost: { powers: ['prism', 'show'], minutes: 30 } } },
      { need: 24000, reward: { coins: 1500, packs: 2 } } ] },
  ],
  grand: { coins: 5000, gold: 1, packs: 2, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 60 } },
};
const cfg = EVENTS.parade || PROPOSED;

const HOUR = 3600e3;
const DAY = 24 * HOUR;
// A first Friday at midnight, local time (6 Nov. 2026 is a Friday).
const START = new Date(2026, 10, 6).getTime();
const END = new Date(2026, 10, 16).getTime();

function ctx(now = START) {
  const paid = [];
  return { now, paid, pay: (r, t) => paid.push(t), count() {} };
}
function fresh({ pace = 'even', seed = 7 } = {}) {
  const inst = { id: 'parade@1', seed, pace, scale: 1, startsAt: START, endsAt: END, data: {}, state: 'running', done: false };
  parade.begin(inst, cfg);
  return inst;
}

test('the table has seven slots with the right multipliers, 10x in the middle', () => {
  const t = tableOf(cfg);
  assert.deepEqual(t.slots, [1, 2, 5, 10, 5, 2, 1]);
  assert.equal(t.edges.length, 8);
  assert.ok(Math.abs(t.edges[7] - TABLE.w) < 1e-9);
});

test('the same ball from the same spot always takes the same path', () => {
  for (const x of [30, 120, 180, 251, 330]) {
    const a = simulate(cfg, x, 3, 42);
    const b = simulate(cfg, x, 3, 42);
    assert.deepEqual(a, b);
  }
  // step by step too (the screen runs it frame by frame)
  const t = tableOf(cfg);
  const one = newBall(180, 9, 42);
  const hits = [];
  while (!one.done) hits.push(...stepBall(one, t).map((h) => h.id));
  const two = newBall(180, 9, 42);
  const hits2 = [];
  while (!two.done) hits2.push(...stepBall(two, t).map((h) => h.id));
  assert.deepEqual(hits, hits2);
  assert.equal(one.slot, two.slot);
});

test('fair table: every ball lands, 10x is reachable but rare, and no spot is a sure thing', () => {
  const t = tableOf(cfg);
  const mid = t.slots.indexOf(10);
  const count = new Array(7).fill(0);
  let n = 0;
  let slow = 0;
  let maxPts = 0;
  let worstSpot = 0;
  for (let x = TABLE.dropMin; x <= TABLE.dropMax; x += 4) {
    let tens = 0;
    for (let ball = 1; ball <= 60; ball++) {
      const r = simulate(cfg, x, ball, 2026);
      count[r.slot]++;
      n++;
      if (r.slot === mid) tens++;
      if (r.seconds >= TABLE.maxSeconds) slow++;
      maxPts = Math.max(maxPts, r.points);
    }
    worstSpot = Math.max(worstSpot, tens / 60);
  }
  const share = count.map((c) => c / n);
  assert.ok(share[mid] > 0.02 && share[mid] < 0.09, `10x share ${share[mid]}`);
  assert.ok(share.every((s) => s > 0.02), 'every slot can be reached');
  assert.ok(worstSpot < 0.25, `best single spot hits 10x ${worstSpot}`);
  assert.ok(slow / n < 0.002, `stuck balls ${slow}/${n}`);
  assert.ok(maxPts <= cfg.maxPoints * 1.5);
});

test('wins pay balls by difficulty; losses pay none', () => {
  const inst = fresh();
  const s = inst.data.balls;
  parade.onLevel(inst, cfg, { won: true, tier: 2 }, ctx());
  assert.equal(inst.data.balls, s + cfg.ballsPerWin[2]);
  parade.onLevel(inst, cfg, { won: false, tier: 3 }, ctx());
  assert.equal(inst.data.balls, s + cfg.ballsPerWin[2]);
});

test('no ball, no drop; a ball lands once; a lying screen is capped', () => {
  const inst = fresh();
  inst.data.balls = 1;
  const c = ctx(START + 9 * HOUR);
  const d = parade.act(inst, cfg, { drop: 100 }, c);
  assert.ok(d.ok);
  assert.equal(parade.act(inst, cfg, { drop: 100 }, c).reason, 'balls');
  const land = parade.act(inst, cfg, { land: { ball: d.ball, points: 1e9, mult: 1000 } }, c);
  assert.ok(land.ok);
  assert.equal(land.mult, 1); // not a slot on the table
  assert.equal(land.tokens, cfg.maxPoints);
  assert.ok(land.capped);
  assert.equal(parade.act(inst, cfg, { land: { ball: d.ball, points: 10, mult: 10 } }, c).ok, false);
  assert.ok(tokensFor(cfg, 1e9, 10) <= cfg.maxPoints * 10);
  assert.equal(tokensFor(cfg, -5, 10), 0);
  assert.equal(parade.act(inst, cfg, { land: { ball: 999, points: 10, mult: 10 } }, c).ok, false);
});

test('dropped balls wait in the save until they land (replayed after a close)', () => {
  const inst = fresh();
  const c = ctx(START + 9 * HOUR);
  const d = parade.act(inst, cfg, { drop: 177.4 }, c);
  const v = parade.view(inst, cfg, c).game;
  assert.deepEqual(v.pending, [{ ball: d.ball, x: 177 }]);
  const r = simulate(cfg, v.pending[0].x, d.ball, v.seed);
  const land = parade.act(inst, cfg, { land: { ball: d.ball, points: r.points, mult: r.mult } }, c);
  assert.equal(land.tokens, r.tokens);
  assert.equal(parade.view(inst, cfg, c).game.pending.length, 0);
});

test('teammates cannot carry a stage alone; your share is needed', () => {
  const inst = fresh({ pace: 'tough' });
  const c = ctx(END - 1);
  parade.tick(inst, cfg, c);
  assert.equal(inst.data.stage, 0);
  const v = parade.view(inst, cfg, c);
  assert.ok(v.game.waiting);
  assert.equal(v.game.teammates.length, 3);
  assert.ok(v.game.teammates.every((m) => m.gave > 0));
  assert.equal(v.rows.length, 4);
  assert.ok(v.game.yourPart > 0);
});

test('filling every stage pays twelve prizes and the grand prize, then ends', () => {
  const inst = fresh();
  const c = ctx(START + 10 * HOUR);
  inst.data.balls = 100000;
  let guard = 0;
  while (!inst.done && guard++ < 10000) {
    const d = parade.act(inst, cfg, { drop: 180 }, c);
    parade.act(inst, cfg, { land: { ball: d.ball, points: cfg.maxPoints, mult: 10 } }, c);
  }
  assert.ok(inst.done);
  assert.equal(inst.state, 'won');
  assert.equal(c.paid.length, 13);
  assert.equal(c.paid[12], 'Grand prize');
  assert.ok(cfg.grand.gold >= 1);
  assert.equal(parade.act(inst, cfg, { drop: 180 }, c).ok, false);
});

// ---- SIZING ---------------------------------------------------------------
// A steady player: wins USUAL levels a day (20 weekdays, 50 Saturdays and
// Sundays) spread over waking hours, tiers drawn so a win averages about
// 1.4 balls, and drops every ball straight away at a random spot.
// Returns the time the parade was finished (or null) and the share you gave.
function play({ pace, seed, effort = 1 }) {
  const inst = fresh({ pace, seed });
  const r = rng(hash('player', seed));
  const tiers = [0.75, 0.15, 0.07, 0.03]; // -> 1.41 balls a win
  const c = ctx(START);
  for (let day = START; day < END && !inst.done; day += DAY) {
    const wd = new Date(day).getDay(); // 0 Sunday .. 6 Saturday
    const wins = Math.round((wd === 0 || wd === 6 ? USUAL.weekend : USUAL.weekday) * effort);
    const open = day + RIVAL_HOURS.wake * HOUR;
    const span = (RIVAL_HOURS.sleep - RIVAL_HOURS.wake) * HOUR;
    for (let i = 0; i < wins && !inst.done; i++) {
      c.now = open + ((i + 0.5) / wins) * span;
      parade.tick(inst, cfg, c);
      let u = r();
      let tier = 0;
      while (tier < 3 && u >= tiers[tier]) { u -= tiers[tier]; tier++; }
      parade.onLevel(inst, cfg, { won: true, tier }, c);
      while (inst.data.balls > 0 && !inst.done) {
        const d = parade.act(inst, cfg, { drop: TABLE.dropMin + r() * (TABLE.dropMax - TABLE.dropMin) }, c);
        const s = simulate(cfg, d.x, d.ball, d.seed);
        parade.act(inst, cfg, { land: { ball: d.ball, points: s.points, mult: s.mult } }, c);
      }
    }
  }
  const v = parade.view(inst, cfg, c).game;
  const theirs = v.teammates.reduce((a, m) => a + m.gave, 0);
  return { at: inst.done ? c.now : null, stage: inst.data.stage, share: v.mine / (v.mine + theirs) };
}

test('sizing: a steady player finishes inside the ten days, but not early or by half effort', () => {
  const lines = [];
  for (const pace of ['relaxed', 'even', 'tough']) {
    const days = [];
    let finished = 0;
    let shares = 0;
    const N = 12;
    for (let s = 1; s <= N; s++) {
      const out = play({ pace, seed: s * 31 });
      if (out.at) { finished++; days.push((out.at - START) / DAY); }
      shares += out.share;
    }
    days.sort((a, b) => a - b);
    const med = days.length ? days[Math.floor(days.length / 2)] : NaN;
    lines.push(`${pace}: finished ${finished}/${N}, median day ${med.toFixed(1)} of 10, earliest ${days[0]?.toFixed(1)}, your share ${(100 * shares / N).toFixed(0)}%`);
    if (pace === 'even') {
      assert.ok(finished >= N - 1, `even: only ${finished}/${N} finish`);
      assert.ok(days[0] > 6, `even: finished too early (day ${days[0]})`);
    }
    if (pace === 'relaxed') assert.ok(finished >= N * 0.5, `relaxed: only ${finished}/${N} finish`);
  }
  // Half the usual play does not finish (on the even pace).
  let half = 0;
  let halfStage = 0;
  for (let s = 1; s <= 6; s++) {
    const out = play({ pace: 'even', seed: s * 31, effort: 0.5 });
    if (out.at) half++;
    halfStage += out.stage;
  }
  lines.push(`even, half effort: finished ${half}/6, average stages ${(halfStage / 6).toFixed(1)} of 12`);
  console.log('    ' + lines.join('\n    '));
  assert.equal(half, 0);
});
