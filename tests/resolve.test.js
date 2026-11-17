// Tests for engine/resolve.js and engine/drops.js (plan Task 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapse, refill, settle } from '../engine/resolve.js';
import { DROP_RULES, D1 } from '../engine/drops.js';
import { findGroups } from '../engine/matches.js';
import { get, isEmpty } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { boardFrom } from './helpers.js';

// A drop rule that hands out a fixed list of colors in order and counts calls.
function scripted(colors) {
  const rule = (ctx) => {
    rule.calls.push(ctx);
    return colors[(rule.calls.length - 1) % colors.length];
  };
  rule.calls = [];
  return rule;
}

function ctxWith(dropRule, seed = 1, colors = 5) {
  return { colors, rng: makeRng(seed), dropRule, targets: [], movesLeft: 10, history: [] };
}

const noEmpties = (board) => !board.cells.some((c) => isEmpty(c));

test('D1 picks a color in range and is listed in DROP_RULES', () => {
  assert.equal(DROP_RULES.D1, D1);
  const rng = makeRng(3);
  for (let i = 0; i < 200; i++) {
    const c = D1({ rng, colors: 4 });
    assert.ok(Number.isInteger(c) && c >= 0 && c < 4);
  }
});

test('collapse moves a piece above an empty down one', () => {
  const b = boardFrom(['1', '.']);
  const falls = collapse(b);
  assert.deepEqual(falls, [{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }]);
  assert.deepEqual(get(b, 0, 1), { t: 'piece', color: 1 });
  assert.ok(isEmpty(get(b, 0, 0)));
});

test('collapse: a piece above a hole above an empty lands below the hole', () => {
  const b = boardFrom(['2', '#', '.']);
  const falls = collapse(b);
  assert.deepEqual(falls, [{ from: { x: 0, y: 0 }, to: { x: 0, y: 2 } }]);
  assert.deepEqual(get(b, 0, 2), { t: 'piece', color: 2 });
  assert.equal(get(b, 0, 1), null); // the hole stays a hole
  assert.ok(isEmpty(get(b, 0, 0)));
});

test('collapse keeps order, moves power-ups too, and leaves settled columns alone', () => {
  const b = boardFrom(['1H0', '.20', '2.0', '..0']);
  const falls = collapse(b);
  assert.deepEqual(get(b, 0, 3), { t: 'piece', color: 2 });
  assert.deepEqual(get(b, 0, 2), { t: 'piece', color: 1 });
  assert.deepEqual(get(b, 1, 3), { t: 'piece', color: 2 });
  assert.deepEqual(get(b, 1, 2), { t: 'power', kind: 'spot-h' });
  assert.equal(falls.length, 4);
  assert.ok(falls.every((f) => f.from.x !== 2)); // full column: nothing moved
});

test('refill leaves no empties and calls the drop rule once per empty cell', () => {
  const b = boardFrom(['..#', '1..', '12.']);
  const rule = scripted([3]);
  const spawns = refill(b, ctxWith(rule));
  assert.equal(rule.calls.length, 5);
  assert.equal(spawns.length, 5);
  assert.ok(noEmpties(b));
  assert.equal(get(b, 2, 0), null); // hole untouched
  // the rule is told the board and the column it is filling
  assert.equal(rule.calls[0].board, b);
  assert.equal(rule.calls[0].x, 0);
  // each column fills from its lowest empty cell upward
  assert.deepEqual(spawns.filter((s) => s.at.x === 1).map((s) => s.at.y), [1, 0]);
  assert.deepEqual(spawns[0].cell, { t: 'piece', color: 3 });
});

test('settle on one horizontal three clears 3 cells and leaves a quiet full board', () => {
  const b = boardFrom(['0120', '1201', '2333', '0120']);
  const events = settle(b, ctxWith(DROP_RULES.D1, 11));
  const clears = events.filter((e) => e.type === 'clear');
  assert.equal(clears[0].cells.length, 3);
  assert.equal(clears[0].color, 3);
  assert.equal(clears[0].cause, 'match');
  assert.deepEqual(clears[0].cells[0], { x: 1, y: 2, was: { t: 'piece', color: 3 } });
  assert.ok(noEmpties(b));
  assert.deepEqual(findGroups(b), []);
  // event order for the first pass
  assert.deepEqual(
    events.slice(0, 5).map((e) => e.type),
    ['clear', 'frame', 'fall', 'refill', 'frame'],
  );
});

test('settle on a quiet full board does nothing', () => {
  const b = boardFrom(['0120', '1201', '2012']);
  assert.deepEqual(settle(b, ctxWith(DROP_RULES.D1)), []);
});

test('settle first drops and refills when the board starts with empties', () => {
  const b = boardFrom(['01.', '1.0', '201']);
  const rule = scripted([3, 4]);
  const events = settle(b, ctxWith(rule));
  assert.deepEqual(events.map((e) => e.type), ['fall', 'refill', 'frame']);
  assert.ok(noEmpties(b));
});

test('a scripted drop that makes a new match gives cascade depth 2', () => {
  // Bottom row clears; the 2s in column 0 fall, and the first new piece is a
  // 2, which completes a column of three.
  const b = boardFrom(['234', '243', '111']);
  const rule = scripted([2, 0, 1, 0, 1, 0]);
  const events = settle(b, ctxWith(rule));
  const cascades = events.filter((e) => e.type === 'cascade');
  assert.deepEqual(cascades, [{ type: 'cascade', depth: 2 }]);
  assert.equal(events.filter((e) => e.type === 'clear').length, 2);
  assert.equal(rule.calls.length, 6);
  assert.ok(noEmpties(b));
  assert.deepEqual(findGroups(b), []);
});

test('a four-group puts its Spotlight at the origin when the origin is in the group', () => {
  const b = boardFrom(['01201', '33332', '01201']);
  const events = settle(b, ctxWith(scripted([0, 1, 2, 4])), [{ x: 3, y: 1 }]);
  const spawn = events.find((e) => e.type === 'spawn-power');
  assert.deepEqual(spawn, { type: 'spawn-power', at: { x: 3, y: 1 }, kind: 'spot-v' });
  // the frame right after the clears shows the power-up sitting in the gap
  const frame = events.find((e) => e.type === 'frame');
  assert.deepEqual(get(frame.board, 3, 1), { t: 'power', kind: 'spot-v' });
  assert.ok(isEmpty(get(frame.board, 0, 1)));
});

test('the first origin that is in the group wins; origins outside are ignored', () => {
  const b = boardFrom(['01201', '33332', '01201']);
  const events = settle(b, ctxWith(scripted([0, 1, 2, 4])), [{ x: 4, y: 1 }, { x: 0, y: 1 }]);
  assert.deepEqual(events.find((e) => e.type === 'spawn-power').at, { x: 0, y: 1 });
});

test('without an origin the Spotlight goes to the centre cell', () => {
  const b = boardFrom(['01201', '33332', '01201']);
  const events = settle(b, ctxWith(scripted([0, 1, 2, 4])));
  assert.deepEqual(events.find((e) => e.type === 'spawn-power').at, { x: 1, y: 1 });
  // and a five: the exact middle
  const b5 = boardFrom(['0120120', '4444412', '0120120']);
  const e5 = settle(b5, ctxWith(scripted([0, 1, 2, 3])));
  assert.deepEqual(e5.find((e) => e.type === 'spawn-power'), {
    type: 'spawn-power',
    at: { x: 2, y: 1 },
    kind: 'prism',
  });
});

test('overlapping shapes make exactly one power-up and clear each cell once (Review Focus 1)', () => {
  // an L of five 2s
  const b = boardFrom(['2010', '2101', '2220', '0101']);
  const events = settle(b, ctxWith(scripted([3, 4, 3, 4, 0])));
  const firstFrame = events.findIndex((e) => e.type === 'frame');
  const firstPass = events.slice(0, firstFrame);
  const clears = firstPass.filter((e) => e.type === 'clear');
  const spawns = firstPass.filter((e) => e.type === 'spawn-power');
  assert.equal(clears.length, 1);
  assert.equal(clears[0].cells.length, 5);
  assert.equal(new Set(clears[0].cells.map((c) => `${c.x},${c.y}`)).size, 5);
  assert.equal(spawns.length, 1);
  assert.equal(spawns[0].kind, 'show');
});

test('same seed and same board give the identical event list', () => {
  const rows = ['012340', '234012', '401234', '111401', '340123', '012340'];
  const run = (seed) => {
    const b = boardFrom(rows);
    return { events: settle(b, ctxWith(DROP_RULES.D1, seed)), board: b };
  };
  const one = run(99);
  const two = run(99);
  assert.ok(one.events.length > 0);
  assert.deepEqual(one.events, two.events);
  assert.deepEqual(one.board, two.board);
  assert.ok(noEmpties(one.board));
  assert.deepEqual(findGroups(one.board), []);
});

test('settle always ends full and quiet across many seeds', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const b = boardFrom(['0000#11', '2222211', '33.3344', '0123401', '4444123']);
    settle(b, ctxWith(DROP_RULES.D1, seed));
    assert.ok(noEmpties(b));
    assert.deepEqual(findGroups(b), []);
    assert.equal(get(b, 4, 0), null);
  }
});
