import test from 'node:test';
import assert from 'node:assert/strict';
import control, { drawTasks } from '../meta/events/control.js';
import { ECONOMY } from '../config/economy.js';
import { cfgOf } from './sidegames-config.js';

const cfg = cfgOf('control');
const MON = new Date(2026, 10, 23).getTime();
const FRI = new Date(2026, 10, 27).getTime();
const NEXT = new Date(2026, 10, 30).getTime();

// A stand-in for the engine: shared counters, and pay() counts a prize the
// way meta/events/index.js does.
function setup(seed = 3, startsAt = MON, endsAt = FRI, counters = { wins: 40, coins: 9000, prizes: 12 }) {
  const paid = [];
  const c = counters;
  const ctx = (now) => ({ now, pay: (r, t) => { paid.push({ r, t }); c.prizes = (c.prizes || 0) + 1; }, count: (k, n = 1) => { c[k] = (c[k] || 0) + n; }, counters: () => c, team: () => null });
  const inst = { id: 'm', seed, scale: 1, startsAt, endsAt, pace: 'even', state: 'running', done: false, data: {} };
  control.begin(inst, cfg, ctx(startsAt));
  return { inst, paid, ctx, c };
}

test('four tasks on four different totals, counted from the start', () => {
  for (let s = 1; s < 80; s++) {
    const { inst, ctx } = setup(s);
    const v = control.view(inst, cfg, ctx(MON + 1)).game;
    assert.equal(v.tasks.length, 4);
    assert.equal(new Set(v.tasks.map((t) => t.counter)).size, 4);
    // Totals from before the event do not count.
    assert.ok(v.tasks.every((t) => t.have === 0));
  }
});

test('only side games on the calendar this block are asked for', () => {
  for (let s = 1; s < 80; s++) {
    const wk = setup(s, MON, FRI).inst.data.tasks.map((t) => cfg.pool[t.pool].counter);
    assert.ok(!wk.includes('pairs'), 'Costume Pairs is a weekend game');
    const we = setup(s, FRI, NEXT).inst.data.tasks.map((t) => cfg.pool[t.pool].counter);
    assert.ok(!we.includes('gems'), 'Under the Stage is a weekday game');
  }
  // With nothing else running, neither is drawn.
  const { inst } = setup(5);
  const picks = drawTasks(inst, cfg, new Set()).map((t) => cfg.pool[t.pool].counter);
  assert.ok(!picks.includes('gems') && !picks.includes('pairs'));
});

test('each task pays when its total grows enough; the fifth pays itself', () => {
  const { inst, paid, ctx, c } = setup(7);
  const tasks = inst.data.tasks.map((t) => ({ counter: cfg.pool[t.pool].counter, need: t.need }));
  tasks.forEach((tk, i) => {
    if (tk.counter === 'prizes') return; // filled by the other payouts below
    c[tk.counter] = (c[tk.counter] || 0) + tk.need - 1;
    control.tick(inst, cfg, ctx(MON + 100));
    assert.ok(!inst.data.done[i], 'paid one short');
    c[tk.counter] += 1;
    control.tick(inst, cfg, ctx(MON + 100));
    assert.ok(inst.data.done[i]);
  });
  // This event's own prizes never count toward a 'prizes' task.
  const pi = tasks.findIndex((t) => t.counter === 'prizes');
  if (pi >= 0) {
    assert.ok(!inst.data.done[pi]);
    c.prizes += tasks[pi].need;
    control.tick(inst, cfg, ctx(MON + 200));
  }
  assert.ok(inst.done);
  assert.equal(paid.length, 5);
  assert.equal(paid[4].t, 'All four done');
  assert.equal(paid[4].r.gold, 1);
  const v = control.view(inst, cfg, ctx(MON + 300)).game;
  assert.ok(v.grandPaid && v.grandFresh);
  control.act(inst, cfg, { seen: [0, 1, 2, 3], grand: true }, ctx(MON + 301));
  const v2 = control.view(inst, cfg, ctx(MON + 302)).game;
  assert.ok(!v2.grandFresh && v2.tasks.every((t) => !t.fresh));
});

// SIZING. A simulated steady player: about 20 wins a weekday and 50 a
// weekend day, tiers mixed so they average about 1.4 points per win.
// The other totals per win are ESTIMATES (not measured in play):
//   coins   winCoins by tier + about 4 moves left x perLeftoverMove
//   cards   about one card pack (4.5 cards) per 10 wins from other events
//   gems    1.4 hammers per win; about one jewel per 8 hammers
//   pairs   3.2 tickets per win; about one match per 3 tickets
//   prizes  about one prize from another side game per 6 wins
// All four tasks should be done by the end of the block, but not in the
// first third of it.
test('sizing: a steady player finishes all four in the block, not at once', (t) => {
  const tiers = [0.75, 0.15, 0.07, 0.03];
  const coinsPerWin = tiers.reduce((a, p, i) => a + p * ECONOMY.winCoins[i], 0) + 4 * ECONOMY.perLeftoverMove;
  const rate = { wins: 1, coins: coinsPerWin, cards: 0.45, gems: 1.4 / 8, pairs: 3.2 / 3, prizes: 1 / 6 };
  for (const [start, end, perDay, label] of [[MON, FRI, [20, 20, 20, 20], 'weekday'], [FRI, NEXT, [20, 50, 50], 'weekend']]) {
    const doneAt = [];
    for (let s = 1; s <= 200; s++) {
      const { inst, ctx, c } = setup(s * 17, start, end, {});
      const total = perDay.reduce((a, b) => a + b, 0);
      const acc = {};
      let w = 0;
      for (let d = 0; d < perDay.length && !inst.done; d++) {
        for (let k = 0; k < perDay[d] && !inst.done; k++) {
          w++;
          for (const [name, r] of Object.entries(rate)) {
            acc[name] = (acc[name] || 0) + r;
            const n = Math.floor(acc[name]);
            if (n) { c[name] = (c[name] || 0) + n; acc[name] -= n; }
          }
          control.tick(inst, cfg, ctx(start + 1));
        }
      }
      doneAt.push(inst.done ? w / total : Infinity);
    }
    doneAt.sort((a, b) => a - b);
    t.diagnostic(`${label}: all four done after ${(doneAt[0] * 100).toFixed(0)}%-${(doneAt[199] * 100).toFixed(0)}% of the block's wins (middle ${(doneAt[100] * 100).toFixed(0)}%)`);
    assert.ok(doneAt[199] <= 0.9, `${label}: not finishable in time`);
    assert.ok(doneAt[0] >= 0.35, `${label}: finished too soon`);
  }
});
