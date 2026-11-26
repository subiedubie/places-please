import test from 'node:test';
import assert from 'node:assert/strict';
import circuit from '../meta/events/circuit.js';
import { cfgOf } from './sidegames-config.js';

const cfg = cfgOf('circuit');
const MON = new Date(2026, 10, 23).getTime();
const FRI = new Date(2026, 10, 27).getTime();
const NEXT = new Date(2026, 10, 30).getTime();

function run(counters, seed, startsAt, endsAt) {
  const paid = [];
  const inst = { id: 'c', seed, scale: 1, startsAt, endsAt, pace: 'even', state: 'running', done: false, data: {} };
  const ctx = (now) => ({ now, pay: (r, t) => paid.push({ r, t }), count() {}, counters: () => counters, team: () => null });
  circuit.begin(inst, cfg, ctx(startsAt));
  return { inst, paid, ctx };
}

test('crowns by difficulty; twenty on the board; zones marked', () => {
  const c = {};
  const { inst, ctx } = run(c, 5, MON, FRI);
  circuit.onLevel(inst, cfg, { won: true, tier: 2 }, ctx(MON + 1));
  circuit.onLevel(inst, cfg, { won: false, tier: 2 }, ctx(MON + 1));
  assert.equal(inst.data.crowns, cfg.crownsPerWin[2]);
  const v = circuit.view(inst, cfg, ctx(MON + 864e5)).game;
  assert.equal(v.rows.length, 20);
  assert.equal(v.division, 0);
  // Bronze: nobody moves down; the top five move up.
  assert.equal(v.rows.filter((r) => r.zone === 'down').length, 0);
  assert.equal(v.rows.filter((r) => r.zone === 'up').length, 5);
});

test('top five move up, and the division carries into the next run', () => {
  const c = {};
  const a = run(c, 5, MON, FRI);
  a.inst.data.crowns = 9999; // first place
  circuit.end(a.inst, cfg, a.ctx(FRI));
  assert.equal(c.circuitDivision, 1);
  assert.equal(a.paid.length, 1);
  assert.deepEqual(c.circuitLast, { from: 0, to: 1, place: 1, at: FRI });
  const b = run(c, 6, FRI, NEXT);
  assert.equal(b.inst.data.division, 1);
  const v = circuit.view(b.inst, cfg, b.ctx(FRI + 1)).game;
  assert.equal(v.name, 'Silver Stage');
  assert.equal(v.last.toName, 'Silver Stage');
  circuit.act(b.inst, cfg, { seenMove: true }, b.ctx(FRI + 2));
  assert.equal(circuit.view(b.inst, cfg, b.ctx(FRI + 3)).game.last, null);
  // A run with no wins at all ends at the bottom: back down to Bronze.
  circuit.end(b.inst, cfg, b.ctx(NEXT));
  assert.equal(c.circuitDivision, 0);
});

test('the Gold Stage is the top: first place there stays there', () => {
  const c = { circuitDivision: 2 };
  const a = run(c, 9, MON, FRI);
  a.inst.data.crowns = 9999;
  circuit.end(a.inst, cfg, a.ctx(FRI));
  assert.equal(c.circuitDivision, 2);
  assert.ok(a.paid[0].r.gold >= 1);
});

// SIZING. A usual weekday is about 80 wins (113 crowns), a weekend about 120
// (170 crowns). Over 300 seeds per division: Bronze is a quick climb, Silver
// is about a coin toss to leave, Gold is hard to win and easy to keep if you
// play your usual amount, and a light week (0.7x) sends you down from Gold.
test('sizing: where a usual player finishes in each division', (t) => {
  const share = {};
  for (const [start, end, wins, label] of [[MON, FRI, 80, 'weekday'], [FRI, NEXT, 120, 'weekend']]) {
    for (let div = 0; div < 3; div++) {
      for (const mult of [0.7, 1, 1.3]) {
        let up = 0;
        let down = 0;
        const places = [];
        for (let s = 1; s <= 300; s++) {
          const { inst, ctx } = run({ circuitDivision: div }, s * 7, start, end);
          inst.data.crowns = Math.round(wins * mult * 1.41);
          const v = circuit.view(inst, cfg, ctx(end)).game;
          places.push(v.place);
          const me = v.rows.find((r) => r.you);
          if (me.zone === 'up') up++;
          if (me.zone === 'down') down++;
        }
        places.sort((a, b) => a - b);
        share[`${label}-${div}-${mult}`] = { up: up / 3, down: down / 3 };
        t.diagnostic(`${label} ${cfg.divisions[div].name}, ${mult}x usual: middle place ${places[150]}, up ${(up / 3).toFixed(0)}%, down ${(down / 3).toFixed(0)}%`);
      }
    }
  }
  for (const label of ['weekday', 'weekend']) {
    assert.ok(share[`${label}-0-1`].up > 80, 'Bronze should be a quick climb');
    assert.ok(share[`${label}-1-1`].up > 30 && share[`${label}-1-1`].up < 85, 'Silver should be a contest');
    assert.ok(share[`${label}-2-1`].up < 25 && share[`${label}-2-1`].down < 15, 'Gold: hard to top, easy to keep');
    assert.ok(share[`${label}-2-0.7`].down > 30, 'a light week should risk Gold');
  }
});
