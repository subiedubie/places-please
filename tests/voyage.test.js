import test from 'node:test';
import assert from 'node:assert/strict';
import voyage, { layoutOf, simulateShot, aimAt, aimPath, stepBall, launch } from '../meta/events/voyage.js';
import { EVENTS } from '../config/events.js';
import { rng } from '../meta/events/util.js';

// The entry proposed for config/events.js (key 'matinee'). Once it is in
// config/events.js the tests use that one instead; keep the two the same.
const PROPOSED = {
  type: 'voyage',
  title: 'The Pirate Matinee',
  blurb: 'Win levels for cannon shots, then sink the cardboard sea creatures. Twelve rounds, a chest every third.',
  shotsPerWin: [1, 2, 3, 5],
  startShots: 12,
  maxFlying: 40,
  field: { w: 100, h: 150, cannonY: 140, muzzle: 9, top: 6, bottom: 90, side: 3, gap: 2 },
  physics: {
    ballsPerShot: 3, gap: 0.12, speed: 125, gravity: 55, radius: 1.7,
    bounce: 0.92, wallBounce: 0.96, minSpeed: 40, hurtSpeed: 12,
    maxHitsPerBall: 12, maxSeconds: 9, step: 1 / 240, maxAim: 1.36, aimTail: 22,
  },
  kinds: ['octopus', 'crab', 'coil', 'jelly'],
  creatures: { octopus: { r: 8.5 }, crab: { r: 7 }, coil: { r: 6 }, jelly: { r: 6.5 }, whale: { r: 15 } },
  rounds: [
    { count: 4, hp: [2, 4] },
    { count: 5, hp: [2, 4] },
    { count: 6, hp: [3, 4], chest: { coins: 300, boosters: { spot: 1 } } },
    { count: 6, hp: [3, 5] },
    { count: 7, hp: [3, 5] },
    { count: 4, hp: [3, 5], boss: 18, chest: { coins: 600, packs: 1 } },
    { count: 7, hp: [3, 6] },
    { count: 8, hp: [3, 6] },
    { count: 8, hp: [4, 6], chest: { coins: 900, boosters: { show: 1, drill: 1 } } },
    { count: 9, hp: [3, 6] },
    { count: 9, hp: [4, 6] },
    { count: 6, hp: [5, 7], boss: 22 },
  ],
  grand: { coins: 5000, gold: 1, packs: 2, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
};
const cfg = EVENTS.matinee || PROPOSED;

const ctx = () => { const paid = []; return { paid, pay: (r, t) => paid.push(t), count() {} }; };
const fresh = (seed = 5) => { const inst = { seed, scale: 1, data: {}, state: 'running', done: false }; voyage.begin(inst, cfg); return inst; };
const live = (inst) => layoutOf(inst, cfg, inst.data.round).map((c, i) => ({ ...c, hp: inst.data.hp[i] }));

test('layouts: same seed same layout, every creature fits, no overlaps, round sizes grow', () => {
  const F = cfg.field;
  for (let s = 1; s < 80; s++) {
    const inst = fresh(s);
    cfg.rounds.forEach((R, r) => {
      const a = layoutOf(inst, cfg, r);
      assert.deepEqual(a, layoutOf(inst, cfg, r));
      assert.equal(a.length, R.count + (R.boss ? 1 : 0), `seed ${s} round ${r + 1}`);
      for (const c of a) {
        assert.ok(c.x - c.r >= 0 && c.x + c.r <= F.w && c.y - c.r >= F.top - 0.01 && c.y + c.r <= F.bottom + 0.01);
        assert.ok(c.hp >= 1);
      }
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
        assert.ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= a[i].r + a[j].r + cfg.physics.radius * 2);
      }
    });
  }
  assert.notDeepEqual(layoutOf(fresh(1), cfg, 0), layoutOf(fresh(2), cfg, 0));
  const total = (r) => cfg.rounds[r].count * (cfg.rounds[r].hp[0] + cfg.rounds[r].hp[1]) / 2 + (cfg.rounds[r].boss || 0);
  assert.ok(total(11) > total(0) * 4);
  assert.ok(cfg.rounds[5].boss && cfg.rounds[11].boss);
});

test('wins pay shots by tier; losses pay none; no shot, no fire', () => {
  const inst = fresh();
  inst.data.shots = 0;
  assert.equal(voyage.act(inst, cfg, { fire: true }, ctx()).ok, false);
  voyage.onLevel(inst, cfg, { won: true, tier: 3 }, ctx());
  assert.equal(inst.data.shots, cfg.shotsPerWin[3]);
  voyage.onLevel(inst, cfg, { won: false, tier: 3 }, ctx());
  assert.equal(inst.data.shots, cfg.shotsPerWin[3]);
});

test('hits never take a creature below 0, a volley counts once, unknown volleys are refused', () => {
  const inst = fresh(3);
  const c = ctx();
  const f = voyage.act(inst, cfg, { fire: true }, c);
  assert.ok(f.ok);
  const before = inst.data.hp.slice();
  const out = voyage.act(inst, cfg, { volley: f.volley, hits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 99, 'x', 1.5] }, c);
  assert.ok(out.ok);
  assert.equal(inst.data.hp[0], 0);
  assert.equal(out.applied, before[0]);
  assert.deepEqual(out.popped, [0]);
  // the same volley again: refused, nothing changes
  const again = voyage.act(inst, cfg, { volley: f.volley, hits: [1, 1] }, c);
  assert.equal(again.ok, false);
  assert.equal(inst.data.hp[1], before[1]);
  assert.equal(voyage.act(inst, cfg, { volley: 999, hits: [1] }, c).ok, false);
  // a volley cannot claim more hits than its balls can make
  const g = voyage.act(inst, cfg, { fire: true }, c);
  inst.data.hp[1] = 1000;
  const big = voyage.act(inst, cfg, { volley: g.volley, hits: new Array(500).fill(1) }, c);
  assert.equal(big.applied, cfg.physics.ballsPerShot * cfg.physics.maxHitsPerBall);
});

test('clearing a round pays its chest once and moves on; old volleys are ignored', () => {
  const inst = fresh(4);
  const c = ctx();
  inst.data.shots = 100;
  const clear = () => {
    const f = voyage.act(inst, cfg, { fire: true }, c);
    const hits = [];
    inst.data.hp.forEach((h, i) => { for (let k = 0; k < h; k++) hits.push(i); });
    return { f, out: voyage.act(inst, cfg, { volley: f.volley, hits }, c) };
  };
  const stale = voyage.act(inst, cfg, { fire: true }, c); // fired in round 1, lands later
  clear(); clear();
  assert.equal(inst.data.round, 2);
  assert.equal(voyage.act(inst, cfg, { volley: stale.volley, hits: [0] }, c).ok, false);
  const { out } = clear();
  assert.ok(out.roundDone && out.chest);
  assert.deepEqual(c.paid, ['Round 3 chest']);
  assert.equal(inst.data.round, 3);
  assert.ok(inst.data.hp.every((h) => h > 0));
});

test('all twelve rounds: chests after 3, 6, 9 and the grand prize, each paid once', () => {
  const inst = fresh(11);
  const c = ctx();
  inst.data.shots = 10000;
  let guard = 0;
  while (!inst.done && guard++ < 100) {
    const f = voyage.act(inst, cfg, { fire: true }, c);
    const hits = [];
    inst.data.hp.forEach((h, i) => { for (let k = 0; k < h; k++) hits.push(i); });
    voyage.act(inst, cfg, { volley: f.volley, hits }, c);
  }
  assert.ok(inst.done);
  assert.equal(inst.state, 'won');
  assert.deepEqual(c.paid, ['Round 3 chest', 'Round 6 chest', 'Round 9 chest', 'Grand prize']);
  assert.equal(cfg.grand.gold, 1);
  assert.equal(voyage.act(inst, cfg, { fire: true }, c).ok, false);
  const v = voyage.view(inst, cfg);
  assert.equal(v.summary, 'Complete');
  assert.ok(v.steps.every((s) => s.done));
});

test('physics: balls bounce off walls, top and creatures and always fall out', () => {
  const inst = fresh(2);
  for (const a of [-1.3, -0.6, 0, 0.4, 1.3]) {
    const cr = live(inst);
    const b = launch(cfg, a);
    let steps = 0;
    let h;
    do { h = stepBall(b, cr, cfg, cfg.physics.step); steps++; } while (h !== -4 && steps < 240 * 30);
    assert.equal(h, -4, `angle ${a} fell out`);
    assert.ok(b.x >= 0 && b.x <= cfg.field.w);
    assert.ok(b.hits <= cfg.physics.maxHitsPerBall);
  }
  // the aim line stops a little after its first bounce
  const p = aimPath(cfg, live(inst), 0.3);
  assert.ok(p.bounce);
  assert.ok(p.points.length > p.after);
  assert.ok(Math.abs(aimAt(cfg, -1000, cfg.field.cannonY)) <= cfg.physics.maxAim + 1e-9);
  // the ghost never hurts the real creatures
  const cr = live(inst);
  const sum = cr.reduce((s, c) => s + c.hp, 0);
  aimPath(cfg, cr, -0.2);
  assert.equal(cr.reduce((s, c) => s + c.hp, 0), sum);
});

// ---- SIZING -----------------------------------------------------------------
// A steady player: wins about 20 levels a day on weekdays, tiers drawn to
// average about 1.4 points a win, and spends every shot as it comes. Aim:
// at a random creature still standing, with a few degrees of shake (no
// planning of ricochets, so this is a modest player). A weekday block is
// Monday 00:00 to Friday 00:00, four days.
const TIERS = [[0, 0.75], [1, 0.15], [2, 0.07], [3, 0.03]]; // averages 1.41 points
function tierOf(r) { let x = r(); for (const [t, p] of TIERS) { if ((x -= p) < 0) return t; } return 0; }

// Returns the day (0-based, fractional) the player finishes, or Infinity.
function playBlock(seed, winsPerDay, days = 4, tries = 1) {
  const inst = fresh(seed);
  const c = ctx();
  const r = rng(seed * 31 + 7);
  const wins = winsPerDay * days;
  for (let w = 0; w <= wins; w++) {
    if (w > 0) voyage.onLevel(inst, cfg, { won: true, tier: tierOf(r) }, c);
    while (!inst.done && inst.data.shots > 0) {
      let best = 0;
      let bestHits = -1;
      for (let k = 0; k < tries; k++) {
        const alive = live(inst).filter((x) => x.hp > 0);
        const t = alive[Math.floor(r() * alive.length)];
        const ang = aimAt(cfg, t.x, t.y) + (r() + r() + r() - 1.5) * 0.12;
        if (tries === 1) { best = ang; break; }
        const n = simulateShot(cfg, live(inst), ang).length;
        if (n > bestHits) { bestHits = n; best = ang; }
      }
      const f = voyage.act(inst, cfg, { fire: true }, c);
      voyage.act(inst, cfg, { volley: f.volley, hits: simulateShot(cfg, live(inst), best) }, c);
    }
    if (inst.done) return w / winsPerDay;
  }
  return Infinity;
}

test('sizing: a steady weekday player finishes in the block, but not in the first two days', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
  const steady = seeds.map((s) => playBlock(s, 20));
  const careful = seeds.map((s) => playBlock(s, 20, 4, 4));
  const half = seeds.map((s) => playBlock(s, 10));
  const fmt = (a) => a.map((d) => (d === Infinity ? 'no' : d.toFixed(1))).join(' ');
  console.log(`  steady (20 wins/day, plain aim): finished on day ${fmt(steady)}`);
  console.log(`  careful (20 wins/day, best of 4 aims): day ${fmt(careful)}`);
  console.log(`  half pace (10 wins/day): ${fmt(half)}`);
  assert.ok(steady.every((d) => d <= 4), 'steady player always finishes in four days');
  assert.ok(steady.every((d) => d > 2.5), 'but not before the middle of day 3');
  assert.ok(careful.every((d) => d > 1.2), 'even a near-perfect aimer (it tries four aims and keeps the best) needs more than a day');
  assert.ok(half.every((d) => d === Infinity), 'half the play rate does not finish');
});
