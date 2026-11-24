// Doves from a dovecote, the tortoise's petals, and paint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, serialize, deserialize } from '../engine/game.js';
import { generateLevel } from '../levels/generate.js';
import { placeBlock, hitBlockEvents, get, isDrop, isPiece, floorAt, createBoard, piece, set, power, EMPTY } from '../engine/board.js';
import { settle } from '../engine/resolve.js';
import { fire } from '../engine/powers.js';
import { findLegalMoves } from '../engine/moves.js';
import { makeRng } from '../engine/rng.js';
import { DROP_RULES } from '../engine/drops.js';

const ctx = () => ({ colors: 5, rng: makeRng(5), dropRule: DROP_RULES.D1, targets: [], movesLeft: 9, history: {} });
const LEVEL = { n: 1, tier: 0, cols: 8, rows: 8, holes: [], colors: 5, moves: 60, targets: [{ color: 0, need: 999 }], blocks: [], drops: [], floor: [] };

// One random move: a swap, or a tap on a power-up if there is no swap.
function step(g, rng) {
  const ms = findLegalMoves(g.board);
  const i = g.board.cells.findIndex((c) => c && c.t === 'power');
  assert.ok(ms.length || i >= 0, `level ${g.level.n}: nothing to do`);
  act(g, ms.length ? { type: 'swap', ...rng.pick(ms) } : { type: 'tap', at: { x: i % g.board.cols, y: Math.floor(i / g.board.cols) } });
}

test('a broken dovecote lets three doves out, which are collected at the bottom', () => {
  const b = createBoard(6, 6);
  placeBlock(b, 2, 2, 'dovecote');
  let ev;
  for (let i = 0; i < 5; i++) ev = hitBlockEvents(b, 2, 2, 'match', 1, makeRng(1));
  assert.equal(ev[0].destroyed, true);
  assert.equal(b.cells.filter((c) => isDrop(c) && c.kind === 'dove').length, 3);
  const got = settle(b, ctx()).filter((e) => e.type === 'collect');
  assert.equal(got.length, 3);
  assert.ok(got.every((e) => e.kind === 'dove' && e.drop));
});

test('a tortoise at the bottom leaves petals all the way up its column', () => {
  const g = newGame({ ...LEVEL, drops: [{ x: 3, y: 6, kind: 'tortoise' }], targets: [{ block: 'tortoise', need: 1 }, { block: 'petals', need: 8 }] }, 4);
  set(g.board, 3, 7, EMPTY);
  settle(g.board, ctx());
  let n = 0;
  for (let y = 0; y < 8; y++) if (floorAt(g.board, 3, y) === 'petals') n++;
  assert.ok(n >= 5, `${n}`); // (a chain reaction may have cleared some)
  for (let y = 0; y < 8; y++) assert.equal(floorAt(g.board, 4, y), null);
});

test('a paint keg takes three hits and splashes two squares', () => {
  const b = createBoard(6, 6);
  b.paint = new Array(36).fill(0);
  placeBlock(b, 2, 2, 'paintkeg');
  for (let i = 0; i < 2; i++) hitBlockEvents(b, 2, 2, 'match', 1, makeRng(i));
  assert.equal(b.paint.reduce((a, c) => a + c), 0);
  const ev = hitBlockEvents(b, 2, 2, 'match', 1, makeRng(3));
  assert.equal(ev.find((e) => e.type === 'paint').cells.length, 2);
  assert.equal(b.paint.reduce((a, c) => a + c), 2);
});

test('a match that touches paint paints its squares, one that does not leaves them dry', () => {
  for (const touch of [true, false]) {
    const b = createBoard(5, 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) set(b, x, y, piece((x + 2 * y) % 5));
    for (let x = 0; x < 3; x++) set(b, x, 3, piece(4));
    b.paint = new Array(20).fill(0);
    b.paint[touch ? 15 : 19] = 1;
    const first = settle(b, { ...ctx(), rng: makeRng(2) })[0];
    assert.equal(first.type, 'clear');
    assert.equal(Boolean(b.paint[16] && b.paint[17]), touch);
  }
});

test('a Missile through paint paints its row; a star from a painted square carries paint', () => {
  const b = createBoard(6, 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) set(b, x, y, piece((x + 2 * y) % 5));
  b.paint = new Array(36).fill(0);
  b.paint[2 * 6 + 5] = 1;
  set(b, 0, 2, power('spot-h'));
  fire(b, { x: 0, y: 2 }, { rng: makeRng(1) });
  for (let x = 0; x < 6; x++) assert.equal(b.paint[12 + x], 1);
  set(b, 1, 2, power('under'));
  const fly = fire(b, { x: 1, y: 2 }, { rng: makeRng(1), needs: (c, x, y) => y === 5 && x === 5 }).find((e) => e.type === 'fly');
  assert.deepEqual(fly.to, { x: 5, y: 5 });
  assert.equal(b.paint[35], 1);
});

test('paint levels: the count always matches the board, also after saving, and they can be won', () => {
  const rng = makeRng(9);
  let games = 0;
  let won = 0;
  for (let n = 29; n < 260 && games < 25; n++) {
    const L = generateLevel(n);
    if (!L.paint) continue;
    games++;
    let g = newGame(L, n);
    while (g.status === 'playing') {
      step(g, rng);
      assert.equal(g.targets[0].have, g.board.paint.reduce((a, c) => a + c), `level ${n}`);
      g = deserialize(serialize(g));
    }
    if (g.status === 'won') won++;
  }
  assert.ok(games >= 8 && won >= 2, `${won} of ${games}`);
});

test('dovecote and tortoise levels can be won, and petals never block a win for nothing', () => {
  const rng = makeRng(4);
  const seen = { dove: [0, 0], tortoise: [0, 0] };
  for (let n = 22; n < 260; n++) {
    const L = generateLevel(n);
    for (const k of ['dove', 'tortoise']) {
      if (!L.targets.some((t) => t.block === k) || seen[k][0] >= 24) continue;
      const g = newGame(L, n);
      while (g.status === 'playing') step(g, rng);
      seen[k][0]++;
      if (g.status === 'won') seen[k][1]++;
      const t = g.targets.find((x) => x.block === k);
      const left = g.board.cells.filter((c) => isDrop(c) && c.kind === k).length;
      if (k === 'tortoise') assert.equal(t.need - t.have, left);
      else assert.ok(left <= t.need - t.have);
    }
  }
  console.log('won with random play:', JSON.stringify(seen));
  assert.ok(seen.dove[1] >= 1 && seen.tortoise[1] >= 2);
});
