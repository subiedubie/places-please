import test from 'node:test';
import assert from 'node:assert/strict';
import firewalk, { walkers, leftAfter, finishersOf } from '../meta/events/firewalk.js';
import { EVENTS } from '../config/events.js';
import { HOUR, MINUTE, addDays } from '../meta/events/calendar.js';

// The entry proposed for config/events.js (used until it is added there).
const PROPOSED = {
  type: 'firewalk',
  title: 'The Fire Walk',
  blurb: 'A hundred step out; seven stones over the coals. Win seven levels in a row, each on the first try, before midnight. Everyone across splits 10,000 coins.',
  rivals: 99,
  stones: 7,
  pot: 10000,
  survive: [0.70, 0.68, 0.66, 0.65, 0.62, 0.55, 0.50],
  luck: [0.9, 1.1],
  rivalStartHours: [8, 16],
  stoneMinutes: [15, 60],
  avatars: ['piggy', 'cat', 'fox', 'owl', 'bunny'],
};
const cfg = EVENTS.firewalk || PROPOSED;

const DAY0 = new Date(2026, 10, 24, 0, 0, 0, 0).getTime(); // a Tuesday, local midnight
const at = (h, m = 0) => DAY0 + h * HOUR + m * MINUTE;
const mkctx = () => { const paid = []; return { paid, now: 0, pay: (r, t) => paid.push({ r, t }), count() {} }; };
function fresh(seed = 7, now = at(9)) {
  const inst = { seed, scale: 1, data: {}, state: 'running', done: false, endsAt: null };
  const c = mkctx();
  c.now = now;
  firewalk.begin(inst, cfg, c);
  return inst;
}
const win = (now, first = true) => ({ won: true, tier: 0, firstAttempt: first, now });
const lose = (now) => ({ won: false, tier: 0, firstAttempt: true, now });
const step = (inst, res) => { const c = mkctx(); c.now = res.now; const line = firewalk.onLevel(inst, cfg, res, c); return { line, paid: c.paid }; };
const view = (inst, now) => firewalk.view(inst, cfg, { now }).game;

test('waits for Start; levels before Start do nothing', () => {
  const inst = fresh();
  assert.equal(inst.state, 'offer');
  assert.equal(step(inst, win(at(9, 5))).line, null);
  assert.equal(inst.data.stone, 0);
  firewalk.start(inst, cfg, { now: at(9, 10) });
  assert.equal(inst.state, 'running');
  assert.equal(view(inst, at(9, 10)).counts[0], 100);
});

test('the play screen can press Start and choose the avatar', () => {
  const inst = fresh();
  assert.equal(firewalk.act(inst, cfg, { avatar: 'dragon' }, { now: at(9) }).ok, false);
  assert.equal(firewalk.act(inst, cfg, { avatar: 'fox' }, { now: at(9) }).ok, true);
  assert.equal(inst.data.avatar, 'fox');
  assert.equal(firewalk.act(inst, cfg, { start: true }, { now: at(9) }).state, 'running');
  assert.equal(firewalk.act(inst, cfg, { start: true }, { now: at(9) }).ok, false);
});

test('first-try wins hop one stone; the crowd only ever shrinks', () => {
  const inst = fresh(11);
  firewalk.start(inst, cfg, { now: at(9) });
  for (let k = 1; k <= 3; k++) step(inst, win(at(9 + k)));
  const g = view(inst, at(13));
  assert.equal(g.stone, 3);
  assert.equal(g.counts.length, 4);
  for (let k = 1; k < g.counts.length; k++) assert.ok(g.counts[k] <= g.counts[k - 1]);
  assert.equal(g.left, g.counts[3]);
});

test('a loss ends the walk for the day', () => {
  const inst = fresh();
  firewalk.start(inst, cfg, { now: at(9) });
  step(inst, win(at(10)));
  step(inst, lose(at(11)));
  assert.equal(inst.state, 'lost');
  assert.equal(inst.data.fell, 2);
  assert.equal(step(inst, win(at(12))).line, null);
  assert.equal(inst.data.stone, 1);
});

test('a win on a retry also ends it', () => {
  const inst = fresh();
  firewalk.start(inst, cfg, { now: at(9) });
  step(inst, win(at(10), false));
  assert.equal(inst.state, 'lost');
  assert.equal(inst.data.fell, 1);
});

test('seven first-try wins pay an even, rounded share of the pot', () => {
  const inst = fresh(3);
  firewalk.start(inst, cfg, { now: at(9) });
  let paid = [];
  for (let k = 1; k <= cfg.stones; k++) paid = paid.concat(step(inst, win(at(9 + k))).paid);
  assert.equal(inst.state, 'won');
  const winners = 1 + finishersOf(walkers(inst, cfg, DAY0), cfg);
  assert.equal(inst.data.winners, winners);
  assert.equal(paid.length, 1);
  assert.equal(paid[0].r.coins, Math.round(cfg.pot / winners));
  const g = view(inst, at(17));
  assert.equal(g.others, winners - 1);
  assert.equal(g.share, paid[0].r.coins);
});

test('midnight starts a new walk, keeps the avatar and notes yesterday', () => {
  const inst = fresh();
  firewalk.act(inst, cfg, { avatar: 'owl' }, { now: at(9) });
  firewalk.start(inst, cfg, { now: at(9) });
  step(inst, win(at(10)));
  firewalk.tick(inst, cfg, { now: addDays(DAY0, 1) + 5 * MINUTE });
  assert.equal(inst.state, 'offer');
  assert.equal(inst.data.stone, 0);
  assert.equal(inst.data.avatar, 'owl');
  assert.equal(inst.data.last.result, 'timeout');
  assert.equal(inst.data.last.stone, 1);
  const v = firewalk.view(inst, cfg, { now: addDays(DAY0, 1) + HOUR });
  assert.equal(v.endsAt, addDays(DAY0, 2));
});

test('the crowd is fixed by the seed and the day, and is done by midnight', () => {
  const a = walkers({ seed: 42 }, cfg, DAY0);
  const b = walkers({ seed: 42 }, cfg, DAY0);
  assert.deepEqual(a, b);
  const c = walkers({ seed: 42 }, cfg, addDays(DAY0, 1));
  assert.notDeepEqual(a.list.map((w) => w.fall), c.list.map((w) => w.fall));
  for (let s = 1; s < 200; s++) {
    for (const w of walkers({ seed: s }, cfg, DAY0).list) {
      if (w.finishAt !== null) assert.ok(w.finishAt < addDays(DAY0, 1));
    }
  }
});

test('pot sizing: about 3 to 6 across on average, sometimes alone, sometimes 10+', (t) => {
  const N = 3000;
  let sum = 0;
  let alone = 0;
  let ten = 0;
  let firstDrop = 0;
  for (let s = 1; s <= N; s++) {
    const crowd = walkers({ seed: s * 7919 }, cfg, DAY0);
    const w = 1 + finishersOf(crowd, cfg);
    sum += w;
    if (w === 1) alone++;
    if (w >= 10) ten++;
    firstDrop += 100 - leftAfter(crowd, 1);
  }
  const mean = sum / N;
  t.diagnostic(`winners incl. you: mean ${mean.toFixed(2)}; alone ${(100 * alone / N).toFixed(1)}%; 10+ ${(100 * ten / N).toFixed(1)}%; first stone drops ${(firstDrop / N).toFixed(1)}`);
  assert.ok(mean >= 3 && mean <= 6);
  assert.ok(alone / N > 0.02 && alone / N < 0.15);
  assert.ok(ten / N > 0.01 && ten / N < 0.1);
  assert.ok(firstDrop / N > 25 && firstDrop / N < 35);
});

// A steady player: 20 wins on a weekday (50 at weekends) spread over 8:00 to
// 23:00. Every attempt is a first try with chance p of winning; the walk
// needs seven wins in a row. (Tier does not matter here: any first-try win
// is one stone.)
function simulate({ p, winsPerDay, startHour, days = 4000, seed = 1 }) {
  let s = seed >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const attemptMinutes = (15 * 60) / (winsPerDay / p); // attempts per day = wins / p
  let made = 0;
  let late = 0;
  let minutes = 0;
  for (let d = 0; d < days; d++) {
    let t = startHour * 60;
    let stones = 0;
    while (stones < 7) {
      t += attemptMinutes;
      if (t >= 24 * 60) { late++; break; }
      if (r() < p) stones++;
      else break;
    }
    if (stones === 7) { made++; minutes += t - startHour * 60; }
  }
  return { rate: made / days, late: late / days, hours: made ? minutes / made / 60 : 0 };
}

test('sizing: a steady player can finish in the day, but not trivially', (t) => {
  for (const [label, winsPerDay] of [['weekday', 20], ['weekend', 50]]) {
    for (const p of [0.75, 0.85, 0.95]) {
      const out = simulate({ p, winsPerDay, startHour: 9 });
      t.diagnostic(`${label} ${winsPerDay} wins/day, first-try win rate ${p}: across ${(100 * out.rate).toFixed(0)}% of days, ${out.hours.toFixed(1)} h of play, out of time ${(100 * out.late).toFixed(1)}%`);
      // Time is never what stops a player who starts in the morning...
      assert.equal(out.late, 0);
      // ...and seven wins take a weekday player well under a waking day.
      if (label === 'weekday') assert.ok(out.hours < 8);
    }
  }
  // Not trivial: even a strong player fails on some days; an average one on most.
  assert.ok(simulate({ p: 0.95, winsPerDay: 20, startHour: 9 }).rate < 0.8);
  assert.ok(simulate({ p: 0.85, winsPerDay: 20, startHour: 9 }).rate < 0.45);
  assert.ok(simulate({ p: 0.85, winsPerDay: 20, startHour: 9 }).rate > 0.2);
  // Starting late on a weekday can run out the clock.
  assert.ok(simulate({ p: 0.95, winsPerDay: 20, startHour: 20 }).late > 0);
});
