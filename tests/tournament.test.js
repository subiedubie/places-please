import test from 'node:test';
import assert from 'node:assert/strict';
import tournament, { teamAt } from '../meta/events/tournament.js';
import { cfgOf } from './sidegames-config.js';

const cfg = cfgOf('tournament');
const HOUR = 3600e3;
// Friday 27 Nov. 2026 00:00 to Monday 30 Nov. 00:00 (a weekend block).
const FRI = new Date(2026, 10, 27).getTime();
const MON = new Date(2026, 10, 30).getTime();

function setup(seed = 3) {
  const paid = [];
  const inst = { id: 't', seed, scale: 1, startsAt: FRI, endsAt: MON, pace: 'even', state: 'running', done: false, data: {} };
  const ctx = (now) => ({ now, pay: (r, t) => paid.push({ r, t }), count() {}, counters: () => ({}), team: () => null });
  tournament.begin(inst, cfg, ctx(FRI));
  return { inst, paid, ctx };
}

test('the team total is castmates plus you, and never goes down', () => {
  const { inst } = setup();
  let last = -1;
  for (let t = FRI; t <= MON; t += 3 * HOUR) {
    const tot = teamAt(inst, cfg, t).total;
    assert.ok(tot >= last);
    last = tot;
  }
  inst.data.mine = 7;
  assert.equal(teamAt(inst, cfg, MON).total, last + 7);
});

test('a reached milestone waits until you have won enough yourself', () => {
  const { inst, paid, ctx } = setup();
  // Late Sunday: all three totals reached, but you have won nothing.
  const late = MON - HOUR;
  tournament.tick(inst, cfg, ctx(late));
  assert.equal(paid.length, 0);
  const v = tournament.view(inst, cfg, ctx(late)).game;
  assert.ok(v.milestones[0].reached && v.milestones[0].locked);
  // Win levels: each milestone is paid as soon as your own wins reach it.
  for (let i = 0; i < cfg.milestones[0].mustWin; i++) tournament.onLevel(inst, cfg, { won: true, tier: 0 }, ctx(late));
  assert.deepEqual(paid.map((p) => p.t), ['Milestone 1']);
  for (let i = 0; i < cfg.milestones[2].mustWin; i++) tournament.onLevel(inst, cfg, { won: true, tier: 0 }, ctx(late));
  assert.deepEqual(paid.map((p) => p.t), ['Milestone 1', 'Milestone 2', 'Milestone 3']);
  assert.ok(inst.done);
  assert.equal(paid[2].r.coins, 10000);
  assert.deepEqual(paid[0].r.boost.powers.sort(), ['prism', 'show', 'spot-h', 'under'].sort());
  assert.equal(paid[0].r.lives, 15);
  assert.equal(paid[1].r.lives, 30);
});

test('losses add nothing; the screen gets a top-ten list with you in it', () => {
  const { inst, ctx } = setup();
  tournament.onLevel(inst, cfg, { won: false, tier: 3 }, ctx(FRI + 10 * HOUR));
  assert.equal(inst.data.mine, 0);
  const v = tournament.view(inst, cfg, ctx(FRI + 30 * HOUR)).game;
  assert.equal(v.size, 50);
  assert.ok(v.top.some((r) => r.you));
  assert.ok(v.top.length <= cfg.topShown + 1);
});

// SIZING. The owner wins about 120 levels in a weekend block. Castmates'
// schedules are drawn from the seed; over 200 seeds the team must reach
// 8,000 by Sunday night every time, but only on Sunday (not trivially).
test('sizing: an active team reaches 8,000 on Sunday, not before', (t) => {
  const hours = [];
  const finals = [];
  for (let s = 1; s <= 200; s++) {
    const { inst } = setup(s * 11);
    inst.data.mine = 120;
    finals.push(teamAt(inst, cfg, MON).total);
    let reached = null;
    for (let h = 0; h <= 72; h++) if (teamAt(inst, cfg, FRI + h * HOUR).total >= 8000) { reached = h; break; }
    hours.push(reached);
  }
  assert.ok(hours.every((h) => h !== null), 'some team never reached 8,000');
  hours.sort((a, b) => a - b);
  finals.sort((a, b) => a - b);
  t.diagnostic(`team total at the end: lowest ${finals[0]}, middle ${finals[100]}, highest ${finals[199]}`);
  t.diagnostic(`8,000 reached after ${hours[0]}-${hours[199]} hours of 72 (middle ${hours[100]})`);
  assert.ok(hours[0] >= 48, '8,000 reached before Sunday');
});
