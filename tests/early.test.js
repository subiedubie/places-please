// Early moves: making the next move while the last one is still playing out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, actSteps, isLegal, serialize, deserialize } from '../engine/game.js';
import { generateLevel } from '../levels/generate.js';
import { findLegalMoves } from '../engine/moves.js';
import { findGroups } from '../engine/matches.js';
import { makeRng } from '../engine/rng.js';
import { createSession } from '../meta/session.js';
import { fakeStorage } from './helpers.js';

const plain = (g) => JSON.stringify(serialize(g));
const swaps = (g) => findLegalMoves(g.board).map((m) => ({ type: 'swap', ...m }));

test('played step by step without early moves, a move comes out the same', () => {
  for (const n of [3, 14, 27, 44, 57, 75]) {
    const a = newGame(generateLevel(n), 5);
    const b = newGame(generateLevel(n), 5);
    for (let i = 0; i < 8 && a.status === 'playing'; i++) {
      const move = swaps(a)[0];
      const all = act(a, move);
      const got = [];
      for (const s of actSteps(b, move)) got.push(...s.events);
      assert.deepEqual(got, all);
      assert.equal(plain(a), plain(b));
    }
  }
});

test('an early move costs a move, is made before waiting matches clear, and the board ends still', () => {
  let made = 0;
  let duringChain = 0;
  let changed = 0;
  const rng = makeRng(4);
  for (let seed = 1; seed <= 120; seed++) {
    const g = newGame(generateLevel(1 + (seed % 75)), seed);
    const first = swaps(g)[0];
    const twin = deserialize(serialize(g));
    act(twin, first);
    const left = g.movesLeft;
    let mine = 0;
    const it = actSteps(g, first);
    let send;
    for (let r = it.next(); !r.done; r = it.next(send)) {
      send = undefined;
      if (r.value.early) mine++;
      if (r.value.landed && mine < 2) {
        const waiting = findGroups(g.board).length > 0;
        const options = swaps(g).filter((m) => isLegal(g, m));
        if (options.length) { send = rng.pick(options); if (waiting) duringChain++; }
      }
    }
    made += mine;
    assert.equal(g.movesLeft, left - 1 - mine);
    assert.equal(findGroups(g.board).length, 0, `seed ${seed}: match left`);
    if (g.status === 'playing') assert.ok(swaps(g).length > 0 || g.board.cells.some((c) => c && c.t === 'power'));
    if (JSON.stringify(g.board) !== JSON.stringify(twin.board)) changed++;
  }
  assert.ok(made > 100, `${made} early moves`);
  assert.ok(duringChain > 20, `${duringChain} during a chain`);
  assert.ok(changed > 60);
});

test('an early move that makes no match of its own is refused and costs nothing', () => {
  let tried = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = newGame(generateLevel(2), seed);
    const left = g.movesLeft;
    const it = actSteps(g, swaps(g)[0]);
    let send;
    for (let r = it.next(); !r.done; r = it.next(send)) {
      send = undefined;
      assert.ok(!r.value.early);
      if (!r.value.landed) continue;
      const bad = [];
      for (let x = 0; x < g.board.cols - 1; x++) {
        const m = { type: 'swap', a: { x, y: 4 }, b: { x: x + 1, y: 4 } };
        if (!isLegal(g, m)) bad.push(m);
      }
      if (bad.length) { send = bad[0]; tried++; }
    }
    assert.equal(g.movesLeft, left - 1);
  }
  assert.ok(tried > 20);
});

test('no early move with no moves left, or once the targets are met', () => {
  for (const change of [{ moves: 1 }, { targets: [{ color: 0, need: 0 }] }]) {
    const g = newGame({ ...generateLevel(2), ...change }, 9);
    const it = actSteps(g, swaps(g)[0]);
    let send;
    for (let r = it.next(); !r.done; r = it.next(send)) {
      assert.ok(!r.value.early);
      send = r.value.landed ? swaps(g)[0] : undefined;
    }
    assert.notEqual(g.status, 'playing');
  }
});

test('closing the app in the middle of a move loses nothing', () => {
  const storage = fakeStorage();
  const s = createSession(storage, { now: () => 777 });
  s.startLevel();
  const move = swaps(s.game)[0];
  const twin = deserialize(serialize(s.game));
  act(twin, move);
  const m = s.startMove(move);
  m.next();
  const again = createSession(storage, { now: () => 777 });
  again.startLevel();
  assert.equal(plain(again.game), plain(twin));
  while (m.next()) { /* play it out */ }
  assert.equal(plain(s.game), plain(twin));
});
