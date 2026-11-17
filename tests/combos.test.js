// Tests for two power-ups swapped into each other (combine).
// In every test `a` is where the swipe starts and `b` is the cell swiped into;
// the effect is centred on `b`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine } from '../engine/powers.js';
import { get, set, power, cloneBoard, isPiece, isPower, EMPTY } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { quietBoard, boardFrom } from './helpers.js';
import { fire } from '../engine/powers.js';

const A = { x: 3, y: 4 };
const B = { x: 4, y: 4 }; // the centre of a 9x9 board

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

function emptyCount(board) {
  return board.cells.filter((c) => c !== null && c.t === 'empty').length;
}

// A quiet 9x9 board with power-up kindA at A and kindB at B.
function pairBoard(kindA, kindB) {
  const b = quietBoard();
  set(b, A.x, A.y, power(kindA));
  set(b, B.x, B.y, power(kindB));
  return b;
}

// Run a combination; check the bookkeeping that must hold for every one.
function run(kindA, kindB, opts = {}) {
  const board = pairBoard(kindA, kindB);
  const events = combine(board, A, B, { rng: makeRng(1), ...opts });
  const cleared = assertEachOnce(events);
  assert.equal(emptyCount(board), cleared.size, 'board and events agree');
  assert.equal(get(board, A.x, A.y).t, 'empty');
  assert.equal(get(board, B.x, B.y).t, 'empty');
  assert.equal(events[events.length - 1].type, 'frame');
  assert.deepEqual(events[events.length - 1].board.cells, board.cells);
  return { board, events, cleared };
}

// The most common color once the two power-ups are out of the way.
function mostCommon(board) {
  const counts = [0, 0, 0, 0, 0];
  for (const c of board.cells) if (isPiece(c)) counts[c.color]++;
  const color = counts.indexOf(Math.max(...counts));
  return { color, count: counts[color] };
}

const corner = (cell, x, y) => x === 0 && y === 0;

test('Spotlight + Spotlight at the centre: row and column (17)', () => {
  assert.equal(run('spot-h', 'spot-h').cleared.size, 17);
  assert.equal(run('spot-h', 'spot-v').cleared.size, 17);
  const { events } = run('spot-v', 'spot-v');
  assert.equal(clearedCells(events).length, 17);
  assert.equal(events[0].cause, 'combo');
});

test('Spotlight + Showstopper at the centre: 3 rows and 3 columns (45)', () => {
  assert.equal(run('spot-h', 'show').cleared.size, 45);
});

test('Showstopper + Showstopper at the centre: 9x9 (81)', () => {
  assert.equal(run('show', 'show').cleared.size, 81);
});

test('Showstopper + Showstopper is clipped to the board', () => {
  const board = quietBoard();
  set(board, 0, 0, power('show'));
  set(board, 1, 0, power('show'));
  const events = combine(board, { x: 1, y: 0 }, { x: 0, y: 0 }, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 25); // columns 0-4, rows 0-4
});

test('Understudy + Spotlight: neighbours, a flight, then the row at the target', () => {
  const { events, cleared, board } = run('under', 'spot-h', { needs: corner });
  const flights = events.filter((e) => e.type === 'fly');
  assert.equal(flights.length, 1);
  // It lands anywhere on the needed cell's row: the row blast then reaches it.
  assert.deepEqual(flights[0].from, B);
  assert.equal(flights[0].to.y, 0);
  // b + its 4 neighbours (a is one of them) = 5, then row 0 = 9
  assert.equal(cleared.size, 5 + 9);
  for (let x = 0; x < 9; x++) assert.equal(get(board, x, 0).t, 'empty');
  // the carried Spotlight was shown at the target before it went off
  const frames = events.filter((e) => e.type === 'frame');
  assert.deepEqual(get(frames[0].board, flights[0].to.x, 0), power('spot-h'));
});

test('Understudy + Showstopper: neighbours, a flight, then 5x5 at the target', () => {
  const { cleared, board } = run('show', 'under', { needs: corner });
  // It lands wherever its 5x5 blast covers the needed corner cell and the
  // most other pieces, so at least the 9 cells of a corner blast are cleared.
  assert.ok(cleared.size >= 5 + 9);
  assert.equal(get(board, 0, 0).t, 'empty');
});

test('Understudy + Spotlight with a random target is repeatable from the seed', () => {
  const one = run('under', 'spot-v');
  const two = run('under', 'spot-v');
  assert.deepEqual([...one.cleared], [...two.cleared]);
  assert.equal(one.cleared.size, 5 + 9); // target column never crosses the cleared plus? checked below
});

test('Understudy + Understudy: three flights to three different targets (8)', () => {
  const { events, cleared } = run('under', 'under');
  const flights = events.filter((e) => e.type === 'fly');
  assert.equal(flights.length, 3);
  assert.equal(new Set(flights.map((f) => `${f.to.x},${f.to.y}`)).size, 3);
  assert.equal(cleared.size, 5 + 3);
});

test('Prism + Spotlight converts exactly the most common color, then all fire', () => {
  const probe = pairBoard('prism', 'spot-h');
  const { color, count } = mostCommon(probe);
  const { events, board } = run('prism', 'spot-h');
  const transforms = events.filter((e) => e.type === 'transform');
  assert.equal(transforms.length, 1);
  assert.equal(transforms[0].cells.length, count);
  assert.equal(transforms[0].kind, 'spot-h');
  for (const c of transforms[0].cells) assert.deepEqual(get(probe, c.x, c.y), { t: 'piece', color });
  // Spotlights alternate row / column
  transforms[0].cells.forEach((c, i) => assert.equal(c.kind, i % 2 === 0 ? 'spot-h' : 'spot-v'));
  // every converted cell went off as a power-up and none is left
  const asPower = clearedCells(events).filter((c) => isPower(c.was));
  assert.equal(asPower.length, count + 2); // the converted ones plus the two swapped
  assert.ok(!board.cells.some(isPower));
});

test('Prism + Understudy converts the most common color; each one flies', () => {
  const { count } = mostCommon(pairBoard('under', 'prism'));
  const { events, board } = run('under', 'prism');
  const t = events.find((e) => e.type === 'transform');
  assert.equal(t.cells.length, count);
  assert.ok(t.cells.every((c) => c.kind === 'under'));
  assert.equal(events.filter((e) => e.type === 'fly').length, count);
  assert.ok(!board.cells.some(isPower));
});

test('Prism + Showstopper converts the most common color', () => {
  const { count } = mostCommon(pairBoard('prism', 'show'));
  const { events, board } = run('prism', 'show');
  const t = events.find((e) => e.type === 'transform');
  assert.equal(t.cells.length, count);
  assert.ok(t.cells.every((c) => c.kind === 'show'));
  assert.ok(!board.cells.some(isPower));
});

test('Prism + Prism clears every cell that is not a hole', () => {
  assert.equal(run('prism', 'prism').cleared.size, 81);
  const board = pairBoard('prism', 'prism');
  const holes = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 7 }];
  for (const h of holes) set(board, h.x, h.y, null);
  set(board, 6, 6, power('show')); // other power-ups are simply cleared
  const events = combine(board, A, B, { rng: makeRng(1) });
  assert.equal(assertEachOnce(events).size, 81 - 3);
  assert.equal(events.filter((e) => e.type === 'clear').length, 1);
  for (const h of holes) assert.equal(get(board, h.x, h.y), null);
  assert.equal(emptyCount(board), 78);
});

test('order does not matter when both centre on the same cell', () => {
  const pairs = [
    ['spot-h', 'show', {}],
    ['spot-h', 'spot-v', {}],
    ['under', 'spot-h', { needs: corner }],
    ['under', 'show', { needs: corner }],
    ['prism', 'show', {}],
    ['prism', 'under', {}],
  ];
  for (const [k1, k2, opts] of pairs) {
    const one = run(k1, k2, opts).cleared;
    const two = run(k2, k1, opts).cleared;
    assert.deepEqual([...one].sort(), [...two].sort(), `${k1} + ${k2}`);
  }
});

test('a power-up caught in a combination goes off once', () => {
  const board = pairBoard('spot-h', 'spot-h');
  set(board, 8, 4, power('show')); // in b's row
  const fired = new Set();
  const events = combine(board, A, B, { rng: makeRng(1), fired });
  // row + column (17) plus the 5x5 at (8,4) clipped to 3x5 = 15, less the 3 row cells already counted
  assert.equal(assertEachOnce(events).size, 17 + 15 - 3);
  assert.deepEqual([...fired].sort(), ['3,4', '4,4', '8,4']);
  assert.deepEqual(events.filter((e) => e.type === 'clear').map((e) => e.cause), ['combo', 'show']);
});

test('combine on cells that are not both power-ups does nothing', () => {
  const board = quietBoard();
  set(board, B.x, B.y, power('show'));
  const before = cloneBoard(board);
  assert.deepEqual(combine(board, A, B, { rng: makeRng(1) }), []);
  assert.deepEqual(board.cells, before.cells);
  assert.notEqual(get(board, B.x, B.y), EMPTY);
});

// Super Magic Ball (added 16 Nov. 2026)
import { isPiece as _isPiece } from '../engine/board.js';
function colorCounts(board) {
  const n = [0, 0, 0, 0, 0];
  for (const c of board.cells) if (_isPiece(c)) n[c.color]++;
  return n;
}
test('super Magic Ball swapped with a piece clears that color and the next most common', () => {
  const b = boardFrom(['00011', '22011', 'P3344', '00122', '34012']);
  const before = colorCounts(b); // color 0: 7, 1: 6, 2: 5, 3: 3, 4: 3
  const events = fire(b, { x: 0, y: 2 }, { rng: makeRng(1), swapColor: 3, superPrism: true });
  const cleared = events.filter((e) => e.type === 'clear').flatMap((e) => e.cells).filter((c) => _isPiece(c.was));
  assert.equal(cleared.filter((c) => c.was.color === 3).length, before[3]);
  assert.equal(cleared.filter((c) => c.was.color === 0).length, before[0]);
  assert.equal(cleared.length, before[3] + before[0]);
});
test('super Magic Ball + Grenade converts the two most common colors', () => {
  const b = boardFrom(['00011', '22011', 'PS344', '00122', '34012']);
  const before = colorCounts(b);
  const sorted = [...before].sort((x, y) => y - x);
  const events = combine(b, { x: 0, y: 2 }, { x: 1, y: 2 }, { rng: makeRng(1), superPrism: true });
  const t = events.find((e) => e.type === 'transform');
  assert.equal(t.cells.length, sorted[0] + sorted[1]);
  const plain = boardFrom(['00011', '22011', 'PS344', '00122', '34012']);
  const t2 = combine(plain, { x: 0, y: 2 }, { x: 1, y: 2 }, { rng: makeRng(1) }).find((e) => e.type === 'transform');
  assert.equal(t2.cells.length, sorted[0]);
});


// Most helpful aiming (added 16 Nov. 2026): a flying combo lands where its
// blast clears the most cells the level still needs.
test('Ninja Star + Missile flies to the row holding the most needed cells', () => {
  const needRow7 = (cell, x, y) => y === 7 && x >= 2; // 7 needed cells, all on row 7
  const { events, board } = run('under', 'spot-h', { needs: needRow7 });
  const fly = events.find((e) => e.type === 'fly');
  assert.equal(fly.to.y, 7);
  for (let x = 0; x < 9; x++) assert.equal(get(board, x, 7).t, 'empty');
});
test('Ninja Star + column Missile flies to the column holding the most needed cells', () => {
  const needCol1 = (cell, x, y) => x === 1;
  const { events, board } = run('under', 'spot-v', { needs: needCol1 });
  assert.equal(events.find((e) => e.type === 'fly').to.x, 1);
  for (let y = 0; y < 9; y++) assert.equal(get(board, 1, y).t, 'empty');
});
test('Ninja Star + Grenade flies to where the 5x5 covers the most needed cells', () => {
  const block = (cell, x, y) => x >= 6 && y >= 0 && y <= 2; // a 3x3 block in the top right
  const { board } = run('under', 'show', { needs: block });
  for (let y = 0; y <= 2; y++) for (let x = 6; x <= 8; x++) assert.equal(get(board, x, y).t, 'empty');
});
test('a tapped Magic Ball clears the needed color, not just the most common one', () => {
  const b = boardFrom(['00011', '22011', 'P3344', '00122', '34012']); // color 0 is most common, color 4 has 3
  const needs4 = (cell) => _isPiece(cell) && cell.color === 4;
  const events = fire(b, { x: 0, y: 2 }, { rng: makeRng(1), needs: needs4 });
  const colors = new Set(events.filter((e) => e.type === 'clear').flatMap((e) => e.cells).filter((c) => _isPiece(c.was)).map((c) => c.was.color));
  assert.deepEqual([...colors], [4]);
});
