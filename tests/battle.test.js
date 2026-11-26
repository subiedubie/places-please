import test from 'node:test';
import assert from 'node:assert/strict';
import battle, { battleAt, rivalTeams } from '../meta/events/battle.js';
import { cfgOf } from './sidegames-config.js';

const cfg = cfgOf('battle');
// Monday 23 Nov. 2026 00:00 to Friday 27 Nov. 00:00 (a weekday block).
const MON = new Date(2026, 10, 23).getTime();
const FRI = new Date(2026, 10, 27).getTime();

function setup(seed = 4, pace = 'even', team = null) {
  const paid = [];
  const inst = { id: 'b', seed, scale: 1, startsAt: MON, endsAt: FRI, pace, state: 'running', done: false, data: {} };
  const ctx = (now) => ({ now, pay: (r, t) => paid.push({ r, t }), count() {}, counters: () => ({}), team: () => team });
  battle.begin(inst, cfg, ctx(MON));
  return { inst, paid, ctx };
}

test('twenty companies with different seeded names; yours is named from the team', () => {
  const { inst, ctx } = setup(4, 'even', { name: 'The Ghost Light Company', seed: 99, avatar: 'fox' });
  const b = battleAt(inst, cfg, ctx(FRI), FRI);
  assert.equal(b.teams.length, 20);
  assert.equal(new Set(b.teams.map((t) => t.name)).size, 20);
  assert.equal(b.team.name, 'The Ghost Light Company');
  assert.equal(b.members.length, 50);
  assert.equal(b.me.name, 'You');
  // Same seed, same companies.
  assert.deepEqual(rivalTeams(inst, cfg).map((t) => t.name), rivalTeams(inst, cfg).map((t) => t.name));
});

test('shields by difficulty; only wins count', () => {
  const { inst, ctx } = setup();
  battle.onLevel(inst, cfg, { won: true, tier: 3 }, ctx(MON + 1));
  battle.onLevel(inst, cfg, { won: false, tier: 3 }, ctx(MON + 1));
  assert.equal(inst.data.mine, cfg.shieldsPerWin[3]);
});

test('the end pays the company place and your place in it, once', () => {
  // Find a seed where the company finishes in the paid places.
  for (let s = 1; s < 200; s++) {
    const { inst, paid, ctx } = setup(s);
    inst.data.mine = 400; // a big week: top of the company
    const b = battleAt(inst, cfg, ctx(FRI), FRI);
    if (b.team.place > 5) continue;
    battle.end(inst, cfg, ctx(FRI));
    battle.end(inst, cfg, ctx(FRI));
    assert.equal(paid.length, 2);
    assert.match(paid[1].t, /in your company/);
    return;
  }
  assert.fail('no seed put the company in the top five');
});

test('nothing is paid to a player who added fewer than minShields', () => {
  const { inst, paid, ctx } = setup(2, 'relaxed');
  inst.data.mine = cfg.minShields - 1;
  battle.end(inst, cfg, ctx(FRI));
  assert.equal(paid.length, 0);
});

// SIZING (weekday block, about 80 wins = 113 shields at the usual 1.41 per
// win). Over 300 seeds: the company is paid (top five) about half the time
// on Even; a top-three place inside the company needs well above usual play.
test('sizing: company places and member places', (t) => {
  for (const pace of ['relaxed', 'even', 'tough']) {
    for (const mult of [1, 1.4]) {
      const tp = [];
      const mp = [];
      for (let s = 1; s <= 300; s++) {
        const { inst, ctx } = setup(s * 13, pace);
        inst.data.mine = Math.round(80 * mult * 1.41);
        const b = battleAt(inst, cfg, ctx(FRI), FRI);
        tp.push(b.team.place);
        mp.push(b.me.place);
      }
      const top5 = tp.filter((p) => p <= 5).length / 3;
      const top3 = mp.filter((p) => p <= 3).length / 3;
      t.diagnostic(`${pace}, ${mult}x usual play: company top five ${top5.toFixed(0)}%, you top three in it ${top3.toFixed(0)}%`);
      if (pace === 'even' && mult === 1) {
        assert.ok(top5 > 35 && top5 < 80, `company top five ${top5}%`);
        assert.ok(top3 < 10, 'top three too easy at usual play');
      }
      if (pace === 'even' && mult === 1.4) assert.ok(top3 > 15, 'top three out of reach');
    }
  }
});
