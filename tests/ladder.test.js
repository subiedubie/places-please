// The collection ladder's two new forms: BALLOON RISE (lost levels pop
// balloons; the last pop drops you to the start of the step) and PINATA
// PARTY (candies from wins, harder tiers pay more; each filled step is a
// pinata to smash). Plus a sizing check of each against the owner's play
// rate. The plain ladder is checked in tests/events.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import ladder from '../meta/events/ladder.js';
import { EVENTS } from '../config/events.js';
import { rng } from '../meta/events/util.js';

// The entries proposed for config/events.js (used until they are added there).
export const PROPOSED = {
  balloonrise: {
    type: 'ladder',
    title: 'Balloon Rise',
    blurb: 'Float up past ten clouds. Every win lifts you; every loss pops a balloon. Lose all three and you sink to the start of that cloud.',
    balloons: 3,
    perTier: [1, 1, 2, 3],
    steps: [
      { need: 3, reward: { coins: 100 } },
      { need: 4, reward: { boosters: { spot: 1 } } },
      { need: 4, reward: { coins: 200 } },
      { need: 5, reward: { boosters: { drill: 1 } } },
      { need: 5, reward: { coins: 300, packs: 1 } },
      { need: 6, reward: { boost: { powers: ['spot-h'], minutes: 15 } } },
      { need: 6, reward: { coins: 400 } },
      { need: 7, reward: { boosters: { show: 1, coinflip: 1 } } },
      { need: 7, reward: { coins: 500, packs: 1 } },
      { need: 8, reward: { coins: 800, boosters: { prism: 1 } } },
    ],
    grand: { coins: 2000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } },
  },
  pinata: {
    type: 'ladder',
    title: 'Piñata Party',
    blurb: 'Win levels for candies (hard levels pay three and five times as many). Fill a piñata, then smash it open.',
    pinata: true,
    perTier: [10, 10, 30, 50],
    hits: 4,
    steps: [
      { need: 150, reward: { coins: 400, boosters: { spot: 1 } } },
      { need: 250, reward: { coins: 800, packs: 1 } },
      { need: 400, reward: { coins: 1500, packs: 2, boosters: { prism: 1 } } },
    ],
    grand: { coins: 1000, boost: { powers: ['prism', 'show'], minutes: 30 } },
  },
};
const cfgOf = (key) => EVENTS[key] || PROPOSED[key];

function ctx() {
  const paid = [];
  return { paid, now: 0, pay: (r, t) => { if (r) paid.push(t); }, count() {}, team: () => ({ avatar: 'fox' }) };
}
const fresh = (cfg, seed = 3) => {
  const inst = { seed, scale: 1, data: {}, state: 'running', done: false };
  ladder.begin(inst, cfg, ctx());
  return inst;
};
const win = (tier = 0) => ({ won: true, tier, tally: { cleared: [0, 0, 0, 0, 0], made: {}, fired: {} } });
const loss = () => ({ won: false, tier: 0, tally: { cleared: [0, 0, 0, 0, 0], made: {}, fired: {} } });

// ---------------------------------------------------------------- balloons

test('balloon rise: wins climb by tier, each loss pops one balloon', () => {
  const cfg = cfgOf('balloonrise');
  const inst = fresh(cfg);
  const c = ctx();
  ladder.onLevel(inst, cfg, win(0), c);
  ladder.onLevel(inst, cfg, win(3), c); // 1 + 3 = 4 >= 3: step 1 done, 1 carried
  assert.equal(inst.data.step, 1);
  assert.equal(inst.data.have, 1);
  assert.deepEqual(c.paid, ['Step 1']);
  ladder.onLevel(inst, cfg, loss(), c);
  assert.equal(inst.data.balloons, 2);
  assert.equal(inst.data.have, 1, 'a pop alone keeps the progress');
  ladder.onLevel(inst, cfg, loss(), c);
  const text = ladder.onLevel(inst, cfg, loss(), c);
  assert.match(text, /starts again/);
  assert.equal(inst.data.have, 0, 'the third pop drops you to the start of the step');
  assert.equal(inst.data.step, 1, 'but never below the step');
  assert.equal(inst.data.balloons, 3, 'with a fresh bunch');
  assert.equal(inst.data.falls, 1);
  assert.equal(inst.data.pops, 3);
});

test('balloon rise: a finished step refills the balloons', () => {
  const cfg = cfgOf('balloonrise');
  const inst = fresh(cfg);
  const c = ctx();
  ladder.onLevel(inst, cfg, loss(), c);
  ladder.onLevel(inst, cfg, loss(), c);
  assert.equal(inst.data.balloons, 1);
  for (let i = 0; i < 3; i++) ladder.onLevel(inst, cfg, win(0), c);
  assert.equal(inst.data.step, 1);
  assert.equal(inst.data.balloons, 3);
  const g = ladder.view(inst, cfg, c).game;
  assert.equal(g.kind, 'balloon');
  assert.equal(g.balloons, 3);
  assert.equal(g.avatar, 'fox');
});

test('balloon rise: the top pays the grand prize and ends', () => {
  const cfg = cfgOf('balloonrise');
  const inst = fresh(cfg);
  const c = ctx();
  for (let i = 0; i < 200 && !inst.done; i++) ladder.onLevel(inst, cfg, win(0), c);
  assert.ok(inst.done);
  assert.equal(c.paid.length, cfg.steps.length + 1);
  assert.equal(c.paid.at(-1), 'Grand prize');
  assert.equal(ladder.onLevel(inst, cfg, loss(), c), null);
});

// ---------------------------------------------------------------- pinata

test('pinata: candies by tier; the prize is paid at the goal, the smash only shows it', () => {
  const cfg = cfgOf('pinata');
  const inst = fresh(cfg);
  const c = ctx();
  assert.equal(ladder.onLevel(inst, cfg, loss(), c), null, 'a loss adds nothing');
  ladder.onLevel(inst, cfg, win(3), c);
  assert.equal(inst.data.have, cfg.perTier[3]);
  ladder.onLevel(inst, cfg, win(2), c);
  assert.equal(inst.data.have, cfg.perTier[3] + cfg.perTier[2]);
  assert.equal(ladder.act(inst, cfg, { smash: 0 }, c).ok, false, 'not full yet');
  while (inst.data.step === 0) ladder.onLevel(inst, cfg, win(0), c);
  assert.deepEqual(c.paid, ['Step 1'], 'paid when the goal is reached');
  const v = ladder.view(inst, cfg, c).game;
  assert.equal(v.kind, 'pinata');
  assert.deepEqual(v.toSmash, [0]);
  assert.equal(v.button, 'Smash!');
  const out = ladder.act(inst, cfg, { smash: 0 }, c);
  assert.ok(out.ok);
  assert.deepEqual(out.reward, cfg.steps[0].reward);
  assert.deepEqual(c.paid, ['Step 1'], 'smashing pays nothing more');
  assert.equal(ladder.act(inst, cfg, { smash: 0 }, c).ok, false, 'only once');
});

test('pinata: the event is done only when every pinata is smashed', () => {
  const cfg = cfgOf('pinata');
  const inst = fresh(cfg);
  const c = ctx();
  for (let i = 0; i < 500 && inst.data.step < cfg.steps.length; i++) ladder.onLevel(inst, cfg, win(1), c);
  assert.equal(inst.state, 'won');
  assert.equal(inst.done, false, 'still waiting for the smashes');
  assert.equal(c.paid.at(-1), 'Grand prize');
  assert.equal(ladder.onLevel(inst, cfg, win(3), c), null, 'nothing more to collect');
  ladder.act(inst, cfg, { smash: 2 }, c);
  ladder.act(inst, cfg, { smash: 0 }, c);
  assert.equal(inst.done, false);
  const last = ladder.act(inst, cfg, { smash: 1 }, c);
  assert.ok(last.allDone);
  assert.ok(inst.done);
});

test('the play screen can keep a small "last seen" note, not a big one', () => {
  const cfg = cfgOf('pinata');
  const inst = fresh(cfg);
  assert.ok(ladder.act(inst, cfg, { seen: { have: 3, step: 0 } }).ok);
  assert.deepEqual(ladder.view(inst, cfg, ctx()).game.seen, { have: 3, step: 0 });
  assert.equal(ladder.act(inst, cfg, { seen: 'x'.repeat(1000) }).ok, false);
});

test('a plain ladder gets the climb screen and behaves as before', () => {
  const cfg = EVENTS['props-rose'];
  const inst = fresh(cfg);
  const c = ctx();
  ladder.onLevel(inst, cfg, { won: true, tier: 0, tally: { cleared: [0, 35, 0, 0, 0] } }, c);
  assert.equal(inst.data.step, 1);
  assert.equal(inst.data.have, 5);
  assert.equal(ladder.view(inst, cfg, c).game.kind, 'climb');
  assert.equal(inst.data.balloons, undefined);
});

// ---------------------------------------------------------------- sizing
// The owner wins about 20 levels on a weekday and 50 a day at weekends;
// tiers average about 1.4 points a win. A level is assumed to be won about
// four times in five (WIN_RATE). The weekday block (Mon-Thu) is ~80 wins,
// the weekend block (Fri-Sun) ~120.
export const TIER_MIX = [0.72, 0.18, 0.07, 0.03]; // 0.72 + 0.36 + 0.21 + 0.15 = 1.44 points a win
export const WIN_RATE = 0.8;
export function tierOf(r) {
  let x = r();
  for (let t = 0; t < TIER_MIX.length; t++) { if (x < TIER_MIX[t]) return t; x -= TIER_MIX[t]; }
  return 0;
}
// Plays `wins` wins (and the losses between them); returns wins used, or null.
function winsToFinish(cfg, seed, wins, winRate = WIN_RATE) {
  const r = rng(seed);
  const inst = fresh(cfg, seed);
  const c = ctx();
  let w = 0;
  while (w < wins) {
    if (r() < winRate) { w++; ladder.onLevel(inst, cfg, win(tierOf(r)), c); }
    else ladder.onLevel(inst, cfg, loss(), c);
    if (inst.state === 'won') return w;
  }
  return null;
}
function spread(cfg, wins, winRate) {
  const used = [];
  let fails = 0;
  for (let s = 1; s <= 400; s++) { const n = winsToFinish(cfg, s, wins, winRate); if (n === null) fails++; else used.push(n); }
  used.sort((a, b) => a - b);
  return { finished: (400 - fails) / 400, median: used[Math.floor(used.length / 2)] ?? Infinity, fastest: used[0] ?? Infinity };
}

test('sizing: Balloon Rise is finished in a weekday block, not in a day', () => {
  const s = spread(cfgOf('balloonrise'), 80);
  // (printed for the report)
  console.log(`balloon rise, 80 wins: ${(s.finished * 100).toFixed(0)}% finish, median ${s.median} wins, fastest ${s.fastest}`);
  assert.ok(s.finished >= 0.8, 'a steady player finishes inside the block');
  assert.ok(s.fastest > 20, 'nobody finishes on the first weekday');
  const worse = spread(cfgOf('balloonrise'), 80, 0.7);
  console.log(`balloon rise, 80 wins at 70% win rate: ${(worse.finished * 100).toFixed(0)}% finish, median ${worse.median}`);
});

test('sizing: Piñata Party is finished in a weekday block, not in a day', () => {
  const s = spread(cfgOf('pinata'), 80);
  console.log(`pinata, 80 wins: ${(s.finished * 100).toFixed(0)}% finish, median ${s.median} wins, fastest ${s.fastest}`);
  assert.ok(s.finished >= 0.8);
  assert.ok(s.fastest > 40, 'it takes more than two weekdays');
});
