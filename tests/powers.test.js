// Tests for a single power-up going off (fire) and for chains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fire } from '../engine/powers.js';
import { get, set, power, isPiece, isPower } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { quietBoard } from './helpers.js';

// Every cell listed in the clear events, in order.
function clearedCells(events) {
  return events.filter((e) => e.type === 'clear').flatMap((e) => e.cells);
}

// Fails if any cell is listed twice; returns the set of "x,y" names.
function assertEachOnce(events) {
  const seen = new Set();
  for (const { x, y } of clearedCells(events)) {
    const key = `${x},${y}`;
    assert.ok(!seen.has(key), `cell ${key} cleared more than once`);
    seen.add(key);
  }
  return seen;
}

// How many playable cells on the board are now empty.
function emptyCount(board) {
  return board.cells.filter((c) => c !== null && c.t === 'empty').length;
}

function countColor(board, color) {
  return board.cells.filter((c) => isPiece(c) && c.color === color).length;
}

// A quiet 9x9 board with power-ups placed on it: put(board, 'spot-h', 4, 4).
function put(board, kind, x, y) {
  set(board, x, y, power(kind));
  return { x, y };
}

test('spot-h clears its whole row (9)', () => {
  const b = quietBoard();
  const at = put(b, 'spot-h', 4, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 9);
  assert.equal(emptyCount(b), 9);
  for (let x = 0; x < 9; x++) assert.equal(get(b, x, 4).t, 'empty');
  assert.equal(events.find((e) => e.type === 'clear').cause, 'spot-h');
});

test('spot-v clears its whole column (9)', () => {
  const b = quietBoard();
  const at = put(b, 'spot-v', 2, 6);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 9);
  assert.equal(emptyCount(b), 9);
  for (let y = 0; y < 9; y++) assert.equal(get(b, 2, y).t, 'empty');
});

test('show clears 5x5 in the centre (25)', () => {
  const b = quietBoard();
  const at = put(b, 'show', 4, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 25);
  assert.equal(emptyCount(b), 25);
});

test('show in a corner clears only the part on the board (9)', () => {
  const b = quietBoard();
  const at = put(b, 'show', 0, 0);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 9);
  assert.equal(emptyCount(b), 9);
});

test('under clears 4 neighbours + 1 target + itself (6) and reports the flight', () => {
  const b = quietBoard();
  const at = put(b, 'under', 4, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 6);
  assert.equal(emptyCount(b), 6);
  const flights = events.filter((e) => e.type === 'fly');
  assert.equal(flights.length, 1);
  assert.deepEqual(flights[0].from, { x: 4, y: 4 });
  assert.equal(get(b, flights[0].to.x, flights[0].to.y).t, 'empty');
  // the target is not one of the cells already cleared around the Understudy
  const d = Math.abs(flights[0].to.x - 4) + Math.abs(flights[0].to.y - 4);
  assert.ok(d > 1);
});

test('under flies to a cell the level needs when there is one', () => {
  const b = quietBoard();
  const at = put(b, 'under', 4, 4);
  const needs = (cell, x, y) => x === 8 && y === 0;
  const events = fire(b, at, { rng: makeRng(1), needs });
  assert.deepEqual(events.find((e) => e.type === 'fly').to, { x: 8, y: 0 });
  assert.equal(get(b, 8, 0).t, 'empty');
});

test('under: same seed gives the same target', () => {
  const run = () => {
    const b = quietBoard();
    return fire(b, put(b, 'under', 4, 4), { rng: makeRng(1) }).find((e) => e.type === 'fly').to;
  };
  assert.deepEqual(run(), run());
});

test('prism with swapColor clears exactly that color', () => {
  const b = quietBoard();
  const at = put(b, 'prism', 4, 4);
  const n = countColor(b, 3);
  const events = fire(b, at, { rng: makeRng(1), swapColor: 3 });
  const cells = clearedCells(events);
  assertEachOnce(events);
  assert.equal(cells.filter((c) => isPiece(c.was) && c.was.color === 3).length, n);
  assert.equal(cells.length, n + 1); // the color plus the Prism itself
  assert.equal(countColor(b, 3), 0);
  assert.equal(emptyCount(b), n + 1);
});

test('prism without swapColor clears the most common color (ties: lowest)', () => {
  const b = quietBoard();
  const at = put(b, 'prism', 0, 0);
  const counts = [0, 1, 2, 3, 4].map((c) => countColor(b, c));
  const best = counts.indexOf(Math.max(...counts));
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(countColor(b, best), 0);
  assert.equal(clearedCells(events).length, counts[best] + 1);
});

test('clear events carry what was in each cell, and frames carry a snapshot', () => {
  const b = quietBoard();
  const before = get(b, 0, 4);
  const at = put(b, 'spot-h', 4, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  const cells = clearedCells(events);
  assert.deepEqual(cells.find((c) => c.x === 0).was, before);
  assert.deepEqual(cells.find((c) => c.x === 4).was, { t: 'power', kind: 'spot-h' });
  const frame = events[events.length - 1];
  assert.equal(frame.type, 'frame');
  assert.notEqual(frame.board, b);
  assert.deepEqual(frame.board.cells, b.cells);
});

test('holes are never touched', () => {
  const b = quietBoard();
  set(b, 0, 4, null);
  set(b, 8, 4, null);
  const at = put(b, 'spot-h', 4, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(clearedCells(events).length, 7);
  assert.equal(get(b, 0, 4), null);
  assert.equal(get(b, 8, 4), null);
});

test('firing a cell that is not a power-up does nothing', () => {
  const b = quietBoard();
  assert.deepEqual(fire(b, { x: 1, y: 1 }, { rng: makeRng(1) }), []);
  assert.equal(emptyCount(b), 0);
});

test('chain: spot-h with a show in its row clears row + 5x5 (29)', () => {
  const b = quietBoard();
  const at = put(b, 'spot-h', 1, 4);
  put(b, 'show', 6, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 9 + 25 - 5);
  assert.equal(emptyCount(b), 29);
  assert.deepEqual(
    events.filter((e) => e.type === 'clear').map((e) => e.cause),
    ['spot-h', 'show'],
  );
});

test('two Spotlights in the same row fire once each and the call returns (9)', () => {
  const b = quietBoard();
  const at = put(b, 'spot-h', 1, 4);
  put(b, 'spot-h', 7, 4);
  const fired = new Set();
  const events = fire(b, at, { rng: makeRng(1), fired });
  assert.equal(assertEachOnce(events).size, 9);
  assert.equal(emptyCount(b), 9);
  assert.deepEqual([...fired].sort(), ['1,4', '7,4']);
  assert.equal(events.filter((e) => e.type === 'frame').length, 2); // one per power-up
});

test('a row Spotlight and a column Spotlight pointing at each other (17)', () => {
  const b = quietBoard();
  const at = put(b, 'spot-h', 1, 4);
  put(b, 'spot-v', 7, 4);
  const events = fire(b, at, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 17);
  assert.equal(emptyCount(b), 17);
});

test('a power-up already in the shared fired set does not go off again', () => {
  const b = quietBoard();
  const at = put(b, 'spot-h', 4, 4);
  const fired = new Set(['4,4']);
  assert.deepEqual(fire(b, at, { rng: makeRng(1), fired }), []);
});

test('a board full of power-ups ends with every cell cleared exactly once', () => {
  // Row and column Spotlights in a checkerboard, with the other kinds mixed in.
  const b = quietBoard();
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) put(b, (x + y) % 2 === 0 ? 'spot-h' : 'spot-v', x, y);
  }
  put(b, 'show', 0, 0);
  put(b, 'under', 8, 8);
  put(b, 'prism', 2, 6);
  put(b, 'under', 6, 2);
  put(b, 'prism', 8, 0);
  const fired = new Set();
  const events = fire(b, { x: 4, y: 4 }, { rng: makeRng(1), fired });
  assert.equal(assertEachOnce(events).size, 81);
  assert.equal(emptyCount(b), 81);
  assert.equal(fired.size, 81); // every power-up went off, once
  assert.ok(clearedCells(events).every((c) => isPower(c.was)));
});
