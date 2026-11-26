import test from 'node:test';
import assert from 'node:assert/strict';
import pursuit, { runnersOf } from '../meta/events/pursuit.js';
import { rng } from '../meta/events/util.js';
import { cfgOf } from './sidegames-config.js';

const cfg = cfgOf('pursuit');
const MIN = 60e3;
const MON = new Date(2026, 10, 23).getTime();
const FRI = new Date(2026, 10, 27).getTime();

function setup(seed = 8) {
  const paid = [];
  const inst = { id: 'p', seed, scale: 1, startsAt: MON, endsAt: FRI, pace: 'even', state: 'running', done: false, data: {} };
  const ctx = (now) => ({ now, pay: (r, t) => paid.push({ r, t }), count() {}, counters: () => ({}), team: () => null });
  pursuit.begin(inst, cfg, ctx(MON));
  return { inst, paid, ctx };
}

test('waits for Start; wins before Start do not count', () => {
  const { inst, ctx } = setup();
  assert.equal(inst.state, 'offer');
  assert.equal(pursuit.onLevel(inst, cfg, { won: true, tier: 0 }, ctx(MON + MIN)), null);
  assert.equal(inst.data.wins, 0);
  assert.equal(runnersOf(inst, cfg), null);
  const out = pursuit.act(inst, cfg, { start: true }, ctx(MON + 2 * MIN));
  assert.ok(out.started);
  assert.equal(inst.state, 'running');
  assert.equal(runnersOf(inst, cfg).length, 6);
});

test('quick wins (not in a row) take all three races; prizes in order', () => {
  const { inst, paid, ctx } = setup();
  let t = MON + 10 * MIN;
  for (let race = 0; race < 3; race++) {
    pursuit.act(inst, cfg, { start: true }, ctx(t));
    for (let w = 0; w < cfg.targets[race]; w++) {
      t += 30e3;
      pursuit.onLevel(inst, cfg, { won: false, tier: 0 }, ctx(t)); // a loss in between
      t += 30e3;
      pursuit.onLevel(inst, cfg, { won: true, tier: 0 }, ctx(t));
    }
  }
  assert.deepEqual(paid.map((p) => p.t), ['Race 1 won', 'Race 2 won', 'Race 3 won']);
  assert.ok(inst.done);
  assert.equal(inst.state, 'won');
  assert.ok(paid[2].r.gold >= 1);
});

test('a runner who finishes first loses the race; it restarts with new runners', () => {
  const { inst, paid, ctx } = setup();
  pursuit.act(inst, cfg, { start: true }, ctx(MON));
  const before = runnersOf(inst, cfg).map((r) => r.finishAt - inst.data.startedAt);
  const first = Math.min(...runnersOf(inst, cfg).map((r) => r.finishAt));
  pursuit.onLevel(inst, cfg, { won: true, tier: 0 }, ctx(MON + MIN));
  pursuit.tick(inst, cfg, ctx(first + 1));
  assert.equal(inst.state, 'offer');
  assert.equal(inst.data.wins, 0);
  assert.equal(inst.data.tries, 1);
  assert.ok(inst.data.lost && inst.data.lost.race === 0);
  assert.equal(paid.length, 0);
  pursuit.act(inst, cfg, { start: true }, ctx(first + MIN));
  const after = runnersOf(inst, cfg).map((r) => r.finishAt - inst.data.startedAt);
  assert.notDeepEqual(after, before);
});

// SIZING. Nobody knows the owner's exact minutes per level; assume a level
// takes 2.5 to 4.5 minutes and he wins 7 in 10 (about 5 minutes per win).
// A steady player who keeps playing once a race starts should usually win
// each race and finish all three within a few hours of play (one evening or
// two): a weekday block has far more than that. A slow player (4 in 10
// won) should lose most races.
function simulate(winChance, seeds = 300) {
  const raceWins = [0, 0, 0];
  const raceTries = [0, 0, 0];
  const playMinutes = [];
  for (let s = 1; s <= seeds; s++) {
    const { inst, ctx } = setup(s * 31);
    const r = rng(s);
    let t = MON + 9 * 60 * MIN;
    let played = 0;
    let guard = 0;
    while (!inst.done && guard++ < 60) {
      const race = inst.data.race;
      pursuit.act(inst, cfg, { start: true }, ctx(t));
      raceTries[race]++;
      while (inst.data.race === race && inst.state === 'running') {
        const len = (2.5 + 2 * r()) * MIN;
        t += len;
        played += len;
        pursuit.onLevel(inst, cfg, { won: r() < winChance, tier: 0 }, ctx(t));
      }
      if (inst.data.race > race) raceWins[race]++;
      t += 5 * MIN;
    }
    playMinutes.push(inst.done ? played / MIN : Infinity);
  }
  playMinutes.sort((a, b) => a - b);
  return { firstTry: raceWins.map((w, i) => w / raceTries[i]), playMinutes };
}

test('sizing: a steady player wins most races; a slow one loses most', (t) => {
  const steady = simulate(0.7);
  const slow = simulate(0.4);
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  t.diagnostic(`steady (7 in 10 won): races won per try ${steady.firstTry.map(pct).join(' / ')}; minutes of play to finish all three: middle ${steady.playMinutes[150].toFixed(0)}, 90th ${steady.playMinutes[270].toFixed(0)}`);
  t.diagnostic(`slow (4 in 10 won): races won per try ${slow.firstTry.map(pct).join(' / ')}`);
  for (const p of steady.firstTry) assert.ok(p > 0.5 && p < 0.98, `steady race chance ${p}`);
  for (const p of slow.firstTry) assert.ok(p < 0.45, `slow race chance ${p}`);
  assert.ok(steady.playMinutes[270] < 6 * 60, 'steady play should finish within a few hours');
});
