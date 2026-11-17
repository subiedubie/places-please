// Tests for engine/moves.js (plan Task 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLegalMoves, hasLegalMove, reshuffle } from '../engine/moves.js';
import { findGroups } from '../engine/matches.js';
import { get, cloneBoard, adjacent } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { boardFrom } from './helpers.js';

// A dead board: same colors are five apart along every row and column, and no
// 2x2 holds a repeated color, so no single swap can make a match.
const DEAD = ['012340', '234012', '401234', '123401', '340123', '012340'];

// The sorted list of piece colors on a board (to compare "same pieces").
const colorsOf = (board) =>
  board.cells
    .filter((c) => c !== null && c.t === 'piece')
    .map((c) => c.color)
    .sort();

test('a dead board has no legal moves', () => {
  const b = boardFrom(DEAD);
  assert.deepEqual(findGroups(b), []);
  assert.deepEqual(findLegalMoves(b), []);
  assert.equal(hasLegalMove(b), false);
});

test('finds the swap that makes a three, once, and leaves the board unchanged', () => {
  const b = boardFrom(['0010', '1202', '2121']);
  const before = cloneBoard(b);
  const moves = findLegalMoves(b);
  assert.deepEqual(b, before);
  // swapping (2,0) with (3,0) lines up three 0s
  assert.ok(moves.some((m) => m.a.x === 2 && m.a.y === 0 && m.b.x === 3 && m.b.y === 0));
  assert.ok(moves.every((m) => adjacent(m.a, m.b)));
  const keys = moves.map((m) => `${m.a.x},${m.a.y}-${m.b.x},${m.b.y}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(hasLegalMove(b), true);
});

test('a swap that would make a 2x2 is legal', () => {
  const b = boardFrom(['110', '101', '022']);
  assert.ok(findLegalMoves(b).length > 0);
});

test('adding one power-up to a dead board makes it legal', () => {
  const rows = DEAD.slice();
  rows[2] = '40H234';
  const b = boardFrom(rows);
  const moves = findLegalMoves(b);
  // the power-up at (2,2) can swap with each of its four neighbours
  assert.equal(moves.length, 4);
  assert.ok(moves.every((m) => (m.a.x === 2 && m.a.y === 2) || (m.b.x === 2 && m.b.y === 2)));
  assert.equal(hasLegalMove(b), true);
});

test('power-ups do not swap with holes or empties, but a boxed-in one can still be tapped', () => {
  const b = boardFrom(['#.#', '#H#', '###']);
  assert.deepEqual(findLegalMoves(b), []);
  assert.equal(hasLegalMove(b), true);
});

test('two neighbouring power-ups are listed as one move, not two', () => {
  const b = boardFrom(['HV', '##']);
  assert.equal(findLegalMoves(b).length, 1);
});

test('reshuffle of a dead board: same pieces, a legal move, no groups, 100 seeds (Review Focus 3)', () => {
  const want = colorsOf(boardFrom(DEAD));
  for (let seed = 1; seed <= 100; seed++) {
    const b = boardFrom(DEAD);
    const out = reshuffle(b, makeRng(seed));
    assert.equal(out, b, 'returns the same board object');
    assert.deepEqual(colorsOf(b), want, `seed ${seed}: same multiset of colors`);
    assert.equal(findLegalMoves(b).length > 0, true, `seed ${seed}: has a legal move`);
    assert.deepEqual(findGroups(b), [], `seed ${seed}: no ready-made match`);
  }
});

test('reshuffle works on a full-size 9x10 dead board with holes', () => {
  // same (x + 2y) % 5 pattern, with four holes
  for (let seed = 1; seed <= 20; seed++) {
    const rows = [];
    for (let y = 0; y < 10; y++) {
      let row = '';
      for (let x = 0; x < 9; x++) {
        const hole = (x === 0 || x === 8) && (y === 0 || y === 9);
        row += hole ? '#' : String((x + 2 * y) % 5);
      }
      rows.push(row);
    }
    const b = boardFrom(rows);
    assert.equal(hasLegalMove(b), false);
    const want = colorsOf(b);
    reshuffle(b, makeRng(seed));
    assert.deepEqual(colorsOf(b), want);
    assert.equal(get(b, 0, 0), null);
    assert.equal(get(b, 8, 9), null);
    assert.ok(hasLegalMove(b));
    assert.deepEqual(findGroups(b), []);
  }
});

test('reshuffle leaves power-ups and holes where they are', () => {
  const rows = ['01#340', '234012', '4012S4', '123401', '3401#3', '012340'];
  for (let seed = 1; seed <= 20; seed++) {
    const b = boardFrom(rows);
    reshuffle(b, makeRng(seed));
    assert.equal(get(b, 2, 0), null);
    assert.equal(get(b, 4, 4), null);
    assert.deepEqual(get(b, 4, 2), { t: 'power', kind: 'show' });
    assert.deepEqual(findGroups(b), []);
    assert.equal(colorsOf(b).length, 33);
  }
});

test('colors that can never match (two of each) still give a playable board via the rebuild', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const b = boardFrom(['0123', '2301']);
    reshuffle(b, makeRng(seed));
    assert.equal(findLegalMoves(b).length > 0, true, `seed ${seed}: has a legal move`);
    assert.deepEqual(findGroups(b), [], `seed ${seed}: no ready-made match`);
    // still eight ordinary pieces, colors within the rebuild range 0..3
    const colors = colorsOf(b);
    assert.equal(colors.length, 8);
    assert.ok(colors.every((c) => c >= 0 && c < 4));
  }
});

test('reshuffle is repeatable for the same seed', () => {
  const a = reshuffle(boardFrom(DEAD), makeRng(5));
  const b = reshuffle(boardFrom(DEAD), makeRng(5));
  assert.deepEqual(a, b);
});
