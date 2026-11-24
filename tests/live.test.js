// Overlapping moves (engine/live.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, finishSteps, serialize, deserialize, targetsMet } from '../engine/game.js';
import { liveMove, liveWave, liveQuiet, liveRefusal } from '../engine/live.js';
import { generateLevel } from '../levels/generate.js';
import { findLegalMoves } from '../engine/moves.js';
import { findGroups } from '../engine/matches.js';
import { makeRng } from '../engine/rng.js';
import { createSession } from '../meta/session.js';
import { fakeStorage } from './helpers.js';

const plain = (g) => JSON.stringify(serialize(g));
const still = () => true;

test('one move at a time, everything at rest: the same as an ordinary move', () => {
  for (let n = 2; n < 90; n++) {
    if (n % 10 === 0) continue;
    const a = newGame(generateLevel(n), n);
    const b = deserialize(serialize(a));
    for (let i = 0; i < 5 && a.status === 'playing'; i++) {
      const ms = findLegalMoves(a.board);
      if (!ms.length) break;
      const m = { type: 'swap', ...ms[i % ms.length] };
      act(a, m);
      assert.ok(liveMove(b, m, still));
      while (liveWave(b, still)) { /* chain */ }
      for (const s of finishSteps(b)) void s;
      assert.deepEqual(serialize(b).board, serialize(a).board, `level ${n} move ${i}`);
      assert.deepEqual(b.targets, a.targets);
      assert.equal(b.movesLeft, a.movesLeft);
      assert.equal(b.status, a.status);
    }
  }
});

test('overlapping moves on every kind of level: nothing breaks, every move is counted', () => {
  const rng = makeRng(11);
  let overlapped = 0;
  for (let n = 1; n <= 240; n++) {
    const g = newGame(generateLevel(n), n * 3);
    let clips = []; // { cells: Set, ends }
    let t = 0;
    let made = 0;
    const start = g.movesLeft;
    const ready = (x, y) => !clips.some((c) => c.cells.has(x + ',' + y));
    const touch = (before) => {
      const cells = new Set();
      g.board.cells.forEach((c, i) => {
        if (JSON.stringify(c) !== JSON.stringify(before[i])) cells.add((i % g.board.cols) + ',' + Math.floor(i / g.board.cols));
      });
      clips.push({ cells, ends: t + 1 + rng.int(4) });
    };
    let guard = 0;
    while (g.status === 'playing' && ++guard < 900) {
      t++;
      clips = clips.filter((c) => c.ends > t);
      const ms = findLegalMoves(g.board);
      if (ms.length && rng.int(2)) {
        const m = { type: 'swap', ...rng.pick(ms) };
        const was = g.board.cells.slice();
        const left = g.movesLeft;
        const why = liveRefusal(g, m, ready);
        const ev = liveMove(g, m, ready);
        assert.equal(Boolean(ev), why === null);
        if (ev) { if (clips.length) overlapped++; made++; assert.equal(g.movesLeft, left - 1); touch(was); }
      }
      const was = g.board.cells.slice();
      if (liveWave(g, ready)) touch(was);
      if (clips.length === 0 && liveQuiet(g) && made) {
        for (const s of finishSteps(g)) void s;
        assert.equal(findGroups(g.board).length, 0);
        if (!findLegalMoves(g.board).length) break; // (power-ups to tap)
      }
    }
    assert.ok(guard < 900, `level ${n} never ends`);
    assert.equal(g.movesLeft, start - made);
    assert.equal(g.status === 'won', targetsMet(g) && g.status !== 'playing');
  }
  assert.ok(overlapped > 800, `${overlapped}`);
});

test('a match with a gem still in the air waits; no moves left or won: refused', () => {
  const g = newGame(generateLevel(2), 5);
  const m = { type: 'swap', ...findLegalMoves(g.board)[0] };
  assert.equal(liveRefusal(g, m, () => false), 'wait');
  assert.equal(liveMove(g, m, () => false), null);
  g.movesLeft = 0;
  assert.equal(liveRefusal(g, m, still), 'over');
});

test('closing the app while gems are falling loses nothing', () => {
  const storage = fakeStorage();
  const s = createSession(storage, { now: () => 777 });
  s.startLevel();
  const m = { type: 'swap', ...findLegalMoves(s.game.board)[0] };
  const twin = deserialize(serialize(s.game));
  act(twin, m);
  s.live.move(m, still);
  const again = createSession(storage, { now: () => 777 });
  again.startLevel();
  assert.equal(plain(again.game), plain(twin));
});
