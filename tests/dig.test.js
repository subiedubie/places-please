import test from 'node:test';
import assert from 'node:assert/strict';
import dig, { layoutOf } from '../meta/events/dig.js';
import { EVENTS } from '../config/events.js';

const cfg = EVENTS.understage;
const ctx = () => { const paid = []; return { paid, pay: (r, t) => paid.push(t), count() {} }; };
const fresh = (seed = 5) => { const inst = { seed, scale: 1, data: {}, state: 'running', done: false }; dig.begin(inst, cfg); return inst; };

test('every gate fits all its gems without overlap', () => {
  for (let s = 1; s < 60; s++) {
    const inst = fresh(s);
    cfg.gates.forEach((gate, g) => {
      const lay = layoutOf(inst, cfg, g);
      assert.equal(lay.gems.filter(Boolean).length, gate.gems.length);
      const seen = new Set();
      for (const gm of lay.gems) for (let y = gm.y; y < gm.y + gm.h; y++) for (let x = gm.x; x < gm.x + gm.w; x++) {
        assert.ok(x < lay.cols && y < lay.rows);
        assert.ok(!seen.has(y * lay.cols + x));
        seen.add(y * lay.cols + x);
      }
    });
  }
});

test('wins pay hammers by difficulty; losses pay none', () => {
  const inst = fresh();
  const start = inst.data.tools;
  dig.onLevel(inst, cfg, { won: true, tier: 3 }, ctx());
  assert.equal(inst.data.tools, start + cfg.toolsPerWin[3]);
  dig.onLevel(inst, cfg, { won: false, tier: 3 }, ctx());
  assert.equal(inst.data.tools, start + cfg.toolsPerWin[3]);
});

test('no hammer, no dig; the view never shows undug gems', () => {
  const inst = fresh();
  inst.data.tools = 0;
  assert.equal(dig.act(inst, cfg, { dig: 0 }, ctx()).ok, false);
  const v = dig.view(inst, cfg).game;
  assert.ok(v.cells.every((c) => c.gem === -1 && !c.dug));
  assert.ok(v.gems.every((g) => g.x === undefined));
});

test('digging every block opens all five gates and pays the grand prize', () => {
  const inst = fresh(9);
  inst.data.tools = 9999;
  const c = ctx();
  let guard = 0;
  while (!inst.done && guard++ < 5000) {
    const v = dig.view(inst, cfg).game;
    const cell = v.cells.findIndex((x) => !x.dug);
    dig.act(inst, cfg, { dig: cell }, c);
  }
  assert.ok(inst.done);
  assert.deepEqual(c.paid, ['Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5', 'Grand prize']);
});
