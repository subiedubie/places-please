import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../engine/rng.js';

test('same seed, same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('different seeds differ', () => {
  const a = makeRng(1), b = makeRng(2);
  let same = true;
  for (let i = 0; i < 5; i++) if (a.next() !== b.next()) same = false;
  assert.equal(same, false);
});

test('int stays in range and is roughly even', () => {
  const r = makeRng(9);
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 10000; i++) {
    const v = r.int(5);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 5);
    counts[v]++;
  }
  for (const c of counts) assert.ok(c >= 1500);
});

test('fork is stable and independent', () => {
  const a = makeRng(7).fork('drops'), b = makeRng(7).fork('drops'), c = makeRng(7).fork('level');
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 10; i++) { sa.push(a.next()); sb.push(b.next()); sc.push(c.next()); }
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('state can be saved and restored', () => {
  const a = makeRng(3);
  a.next(); a.next();
  const b = makeRng(0);
  b.setState(a.getState());
  assert.equal(a.next(), b.next());
});
