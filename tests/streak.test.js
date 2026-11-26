// THE LONG TOUR: the streak's third form. Stages of wins in a row with no
// rivals; a loss sends you back to the start of stage 1; the first clear of
// each stage opens a reveal grid of face-down tiles (turn until three of a
// tier match). Plus a sizing check. The plain and lane forms are checked in
// tests/events.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import streak, { gridOf } from '../meta/events/streak.js';
import { EVENTS } from '../config/events.js';
import { rng } from '../meta/events/util.js';

export const PROPOSED = {
  longtour: {
    type: 'streak',
    title: 'The Long Tour',
    blurb: 'Five, seven, then ten wins in a row. One loss and the tour goes back to the first town. Each new town opens a prize grid: turn tiles until three match.',
    stages: [5, 7, 10],
    restartOnLoss: true,
    gridCols: 3,
    gridRows: 4,
    tiers: ['Bronze', 'Silver', 'Gold'],
    grids: [
      { tiles: [5, 4, 3], prizes: [{ coins: 150 }, { coins: 300, boosters: { spot: 1 } }, { coins: 600, packs: 1 }] },
      { tiles: [4, 4, 4], prizes: [{ coins: 300 }, { coins: 600, packs: 1 }, { coins: 1200, packs: 1, boosters: { prism: 1 } }] },
      { tiles: [3, 4, 5], prizes: [{ coins: 800, packs: 1 }, { coins: 1500, packs: 2 }, { coins: 3000, gold: 1, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } }] },
    ],
  },
};
const cfgOf = (key) => EVENTS[key] || PROPOSED[key];

function ctx() {
  const paid = [];
  return { paid, now: 0, pay: (r, t) => { if (r) paid.push(t); }, count() {}, team: () => null };
}
const fresh = (cfg, seed = 11) => {
  const inst = { seed, scale: 1, data: {}, state: 'running', done: false };
  streak.begin(inst, cfg, ctx());
  return inst;
};
const W = { won: true, tier: 0 };
const L = { won: false, tier: 0 };

// Turn tiles in order until the grid pays; returns the last act() result.
function turnAll(inst, cfg, c) {
  let out = null;
  for (let i = 0; i < 12; i++) {
    out = streak.act(inst, cfg, { flip: i }, c);
    if (out.won !== null) return out;
  }
  return out;
}

test('long tour: a loss sends you back to the start of stage 1', () => {
  const cfg = cfgOf('longtour');
  const inst = fresh(cfg);
  const c = ctx();
  for (let i = 0; i < 5; i++) streak.onLevel(inst, cfg, W, c);
  assert.equal(inst.data.stage, 1);
  assert.equal(inst.data.grids.length, 1);
  streak.onLevel(inst, cfg, W, c);
  streak.onLevel(inst, cfg, W, c);
  assert.match(streak.onLevel(inst, cfg, L, c), /stage 1/);
  assert.equal(inst.data.stage, 0);
  assert.equal(inst.data.have, 0);
  // Clearing stage 1 again opens no second grid.
  for (let i = 0; i < 5; i++) streak.onLevel(inst, cfg, W, c);
  assert.equal(inst.data.grids.length, 1);
  assert.equal(inst.data.stage, 1);
  assert.ok(!streak.view(inst, cfg, c).lanes, 'no rival lanes');
  streak.tick(inst, cfg, c); // no rivals to restart anything
  assert.equal(inst.data.stage, 1);
});

test('long tour: the grid is fixed by the seed and hides unturned tiles', () => {
  const cfg = cfgOf('longtour');
  const a = fresh(cfg, 5);
  const b = fresh(cfg, 5);
  assert.deepEqual(gridOf(a, cfg, 0), gridOf(b, cfg, 0));
  assert.notDeepEqual(gridOf(a, cfg, 0), gridOf(fresh(cfg, 6), cfg, 0));
  const tiles = gridOf(a, cfg, 2);
  assert.equal(tiles.length, 12);
  assert.deepEqual([0, 1, 2].map((t) => tiles.filter((x) => x === t).length), cfg.grids[2].tiles);
  const c = ctx();
  for (let i = 0; i < 5; i++) streak.onLevel(a, cfg, W, c);
  const v = streak.view(a, cfg, c).game;
  assert.equal(v.kind, 'tour');
  assert.equal(v.button, 'Reveal!');
  assert.ok(v.grid.tiles.every((t) => t === -1));
  streak.act(a, cfg, { flip: 4 }, c);
  const v2 = streak.view(a, cfg, c).game;
  assert.equal(v2.grid.tiles[4], gridOf(a, cfg, 0)[4]);
  assert.equal(v2.grid.tiles.filter((t) => t !== -1).length, 1);
  assert.equal(streak.act(a, cfg, { flip: 4 }, c).ok, false, 'a tile turns once');
  assert.equal(streak.act(a, cfg, { flip: 12 }, c).ok, false);
});

test('long tour: three of a tier pay that tier, within seven tiles', () => {
  const cfg = cfgOf('longtour');
  for (let seed = 1; seed < 80; seed++) {
    const inst = fresh(cfg, seed);
    const c = ctx();
    for (let i = 0; i < 5; i++) streak.onLevel(inst, cfg, W, c);
    let turned = 0;
    let out;
    // Turn in a seeded random order, like a player would.
    const order = [...Array(12).keys()].sort(() => rng(seed)() - 0.5);
    for (const i of order) {
      out = streak.act(inst, cfg, { flip: i }, c);
      turned++;
      if (out.won !== null) break;
    }
    assert.ok(turned <= 7, 'three tiers of 12 tiles: some tier matches by the 7th');
    assert.equal(out.count, 3);
    assert.deepEqual(out.reward, cfg.grids[0].prizes[out.won]);
    assert.deepEqual(c.paid, [`${cfg.tiers[out.won]} prize`]);
    assert.equal(out.tiles.length, 12);
    assert.equal(inst.data.grids.length, 0);
    assert.equal(streak.act(inst, cfg, { flip: 0 }, c).ok, false, 'nothing left to turn');
  }
});

test('long tour: done after the last stage and its grid', () => {
  const cfg = cfgOf('longtour');
  const inst = fresh(cfg);
  const c = ctx();
  for (let i = 0; i < 22; i++) streak.onLevel(inst, cfg, W, c);
  assert.equal(inst.state, 'won');
  assert.equal(inst.done, false);
  assert.equal(inst.data.grids.length, 3, 'three grids waiting, oldest first');
  assert.equal(streak.onLevel(inst, cfg, L, c), null, 'a loss after the end changes nothing');
  turnAll(inst, cfg, c);
  turnAll(inst, cfg, c);
  const last = turnAll(inst, cfg, c);
  assert.equal(last.stage, 2);
  assert.ok(last.allDone);
  assert.ok(inst.done);
  assert.equal(c.paid.length, 3);
});

test('the old streaks get their screens and keep their rules', () => {
  const plain = EVENTS.scottish;
  const p = fresh(plain);
  const c = ctx();
  streak.onLevel(p, plain, W, c);
  assert.equal(streak.view(p, plain, c).game.kind, 'tour');
  const staged = EVENTS.ghostlight;
  const s = { seed: 1, scale: 1, pace: 'even', data: {}, state: 'running', done: false };
  streak.begin(s, staged, { now: 1e12 });
  const v = streak.view(s, staged, { now: 1e12 });
  assert.equal(v.game.kind, 'lanes');
  assert.equal(v.lanes.length, staged.lanes[0]);
});

// ---------------------------------------------------------------- sizing
// A level is won about four times in five (see tests/ladder.test.js); the
// weekday block is ~80 wins, the weekend ~120. Prints the share who finish.
function finishShare(cfg, wins, winRate) {
  let done = 0;
  const cleared = [0, 0, 0, 0];
  for (let seed = 1; seed <= 1000; seed++) {
    const r = rng(seed * 7 + 1);
    const inst = fresh(cfg, seed);
    const c = ctx();
    let w = 0;
    while (w < wins && inst.state !== 'won') {
      if (r() < winRate) { w++; streak.onLevel(inst, cfg, W, c); } else streak.onLevel(inst, cfg, L, c);
    }
    cleared[inst.data.cleared]++;
    if (inst.state === 'won') done++;
  }
  return { finish: done / 1000, cleared: cleared.map((n) => n / 1000) };
}

test('sizing: The Long Tour (prints the finish rates for the report)', () => {
  const cfg = cfgOf('longtour');
  for (const rate of [0.7, 0.8, 0.9]) {
    for (const wins of [80, 120]) {
      const s = finishShare(cfg, wins, rate);
      console.log(`long tour ${cfg.stages.join('/')}, win rate ${rate}, ${wins} wins: ${(s.finish * 100).toFixed(0)}% finish; stages cleared 0/1/2/3 = ${s.cleared.map((x) => (x * 100).toFixed(0) + '%').join(' ')}`);
    }
  }
  // Nearly everyone sees at least the first grid; finishing is hard.
  const s = finishShare(cfg, 120, 0.8);
  assert.ok(s.cleared[0] < 0.02);
  assert.ok(s.finish < 0.5, 'not trivial');
  // At a 90% win rate a steady player finishes inside the weekend.
  assert.ok(finishShare(cfg, 120, 0.9).finish > 0.6);
});
