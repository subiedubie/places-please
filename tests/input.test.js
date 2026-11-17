// Tests for touch input (plan Task 10, Review Focus 5): touches that start on
// a hole, leave the board, arrive while pieces are falling, or come as two
// fingers must be ignored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gestureToAction, attachInput } from '../ui/input.js';
import { boardFrom } from './helpers.js';

// A 5x5 board. '#' is a hole at (2,2); 'H' is a power-up at (0,4).
const board = boardFrom([
  '01234',
  '12340',
  '23#01',
  '34012',
  'H0123',
]);

// The board's top-left corner is at (10, 20) and each cell is 40 wide.
const layout = { originX: 10, originY: 20, cell: 40, cols: 5, rows: 5 };

// The middle of a cell, in screen units.
const mid = (x, y) => ({ px: 10 + x * 40 + 20, py: 20 + y * 40 + 20 });
const moved = (p, dx, dy) => ({ px: p.px + dx, py: p.py + dy });

test('drag right swaps with the right neighbour', () => {
  const s = mid(1, 1);
  assert.deepEqual(gestureToAction(s, moved(s, 30, 4), layout, board),
    { type: 'swap', a: { x: 1, y: 1 }, b: { x: 2, y: 1 } });
});

test('drag left swaps with the left neighbour', () => {
  const s = mid(1, 1);
  assert.deepEqual(gestureToAction(s, moved(s, -30, -4), layout, board),
    { type: 'swap', a: { x: 1, y: 1 }, b: { x: 0, y: 1 } });
});

test('drag up swaps with the neighbour above', () => {
  const s = mid(1, 1);
  assert.deepEqual(gestureToAction(s, moved(s, 5, -25), layout, board),
    { type: 'swap', a: { x: 1, y: 1 }, b: { x: 1, y: 0 } });
});

test('drag down swaps with the neighbour below', () => {
  const s = mid(1, 1);
  assert.deepEqual(gestureToAction(s, moved(s, -5, 25), layout, board),
    { type: 'swap', a: { x: 1, y: 1 }, b: { x: 1, y: 2 } });
});

test('a long drag still swaps only with the adjacent cell', () => {
  const s = mid(0, 0);
  assert.deepEqual(gestureToAction(s, moved(s, 150, 0), layout, board),
    { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } });
});

test('the 0.3-cell threshold: 11px is a press, 12px is a drag', () => {
  const s = mid(1, 1);
  assert.equal(gestureToAction(s, moved(s, 11, 0), layout, board), null);
  assert.notEqual(gestureToAction(s, moved(s, 12, 0), layout, board), null);
});

test('a short drag on an ordinary piece is nothing', () => {
  const s = mid(3, 3);
  assert.equal(gestureToAction(s, moved(s, 5, 5), layout, board), null);
  assert.equal(gestureToAction(s, s, layout, board), null);
});

test('a short press on a power-up is a tap', () => {
  const s = mid(0, 4);
  assert.deepEqual(gestureToAction(s, moved(s, 3, -2), layout, board),
    { type: 'tap', at: { x: 0, y: 4 } });
});

test('a power-up can also be dragged into a swap', () => {
  const s = mid(0, 4);
  assert.deepEqual(gestureToAction(s, moved(s, 30, 0), layout, board),
    { type: 'swap', a: { x: 0, y: 4 }, b: { x: 1, y: 4 } });
});

test('starting on a hole is nothing', () => {
  const s = mid(2, 2);
  assert.equal(gestureToAction(s, moved(s, 30, 0), layout, board), null);
  assert.equal(gestureToAction(s, s, layout, board), null);
});

test('starting off the board is nothing', () => {
  assert.equal(gestureToAction({ px: 5, py: 100 }, { px: 60, py: 100 }, layout, board), null);
  assert.equal(gestureToAction({ px: 100, py: 10 }, { px: 100, py: 80 }, layout, board), null);
  assert.equal(gestureToAction({ px: 215, py: 100 }, { px: 150, py: 100 }, layout, board), null);
  assert.equal(gestureToAction({ px: 100, py: 225 }, { px: 100, py: 150 }, layout, board), null);
});

test('dragging off each edge is nothing', () => {
  assert.equal(gestureToAction(mid(0, 0), moved(mid(0, 0), -30, 0), layout, board), null);
  assert.equal(gestureToAction(mid(0, 0), moved(mid(0, 0), 0, -30), layout, board), null);
  assert.equal(gestureToAction(mid(4, 4), moved(mid(4, 4), 30, 0), layout, board), null);
  assert.equal(gestureToAction(mid(4, 4), moved(mid(4, 4), 0, 30), layout, board), null);
});

test('dragging into a hole is nothing', () => {
  assert.equal(gestureToAction(mid(1, 2), moved(mid(1, 2), 30, 0), layout, board), null);
  assert.equal(gestureToAction(mid(2, 1), moved(mid(2, 1), 0, 30), layout, board), null);
  assert.equal(gestureToAction(mid(3, 2), moved(mid(3, 2), -30, 0), layout, board), null);
  assert.equal(gestureToAction(mid(2, 3), moved(mid(2, 3), 0, -30), layout, board), null);
});

test('an empty cell cannot be moved', () => {
  const b = boardFrom(['.12', '120', '201']);
  const l = { originX: 0, originY: 0, cell: 40, cols: 3, rows: 3 };
  assert.equal(gestureToAction({ px: 20, py: 20 }, { px: 50, py: 20 }, l, b), null);
});

// ---- attachInput, driven by a stand-in canvas (no browser needed) ----

function fakeCanvas() {
  const handlers = {};
  return {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    removeEventListener: (type) => { delete handlers[type]; },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => {},
    fire(type, pointerId, p) {
      if (handlers[type]) handlers[type]({ pointerId, clientX: p.px, clientY: p.py, preventDefault() {} });
    },
  };
}

function rig() {
  const canvas = fakeCanvas();
  const actions = [];
  const state = { busy: false };
  attachInput(canvas, () => layout, () => board, (a) => actions.push(a), () => state.busy);
  return { canvas, actions, state };
}

test('attachInput: a one-finger drag gives exactly one swap', () => {
  const { canvas, actions } = rig();
  const s = mid(1, 1);
  canvas.fire('pointerdown', 1, s);
  canvas.fire('pointermove', 1, moved(s, 10, 0));
  canvas.fire('pointermove', 1, moved(s, 25, 0)); // far enough: acts here
  canvas.fire('pointermove', 1, moved(s, 60, 0));
  canvas.fire('pointerup', 1, moved(s, 60, 0));   // must not act a second time
  assert.deepEqual(actions, [{ type: 'swap', a: { x: 1, y: 1 }, b: { x: 2, y: 1 } }]);
});

test('attachInput: a short drag acts when the finger lifts', () => {
  const { canvas, actions } = rig();
  const s = mid(1, 1);
  canvas.fire('pointerdown', 1, s);
  canvas.fire('pointerup', 1, moved(s, 0, 15));
  assert.deepEqual(actions, [{ type: 'swap', a: { x: 1, y: 1 }, b: { x: 1, y: 2 } }]);
});

test('attachInput: a press on a power-up taps it', () => {
  const { canvas, actions } = rig();
  canvas.fire('pointerdown', 1, mid(0, 4));
  canvas.fire('pointerup', 1, mid(0, 4));
  assert.deepEqual(actions, [{ type: 'tap', at: { x: 0, y: 4 } }]);
});

test('attachInput: touches while pieces are falling are ignored', () => {
  const { canvas, actions, state } = rig();
  const s = mid(1, 1);

  // Finger goes down while busy; the whole gesture is thrown away, even
  // though the board is free again before the finger lifts.
  state.busy = true;
  canvas.fire('pointerdown', 1, s);
  state.busy = false;
  canvas.fire('pointermove', 1, moved(s, 30, 0));
  canvas.fire('pointerup', 1, moved(s, 30, 0));
  assert.deepEqual(actions, []);

  // Finger goes down while free, but the board is busy when it lifts.
  canvas.fire('pointerdown', 1, s);
  state.busy = true;
  canvas.fire('pointerup', 1, moved(s, 15, 0));
  assert.deepEqual(actions, []);

  // The next clean gesture works normally.
  state.busy = false;
  canvas.fire('pointerdown', 1, s);
  canvas.fire('pointerup', 1, moved(s, 15, 0));
  assert.equal(actions.length, 1);
});

test('attachInput: two fingers are ignored', () => {
  const { canvas, actions } = rig();
  const s = mid(1, 1);
  const t = mid(3, 3);

  canvas.fire('pointerdown', 1, s);
  canvas.fire('pointerdown', 2, t); // second finger: gesture is dead
  canvas.fire('pointermove', 1, moved(s, 30, 0));
  canvas.fire('pointermove', 2, moved(t, 30, 0));
  canvas.fire('pointerup', 2, moved(t, 30, 0));
  canvas.fire('pointermove', 1, moved(s, 35, 0)); // still dead with one finger left
  canvas.fire('pointerup', 1, moved(s, 35, 0));
  assert.deepEqual(actions, []);

  // After every finger has lifted, input works again.
  canvas.fire('pointerdown', 3, s);
  canvas.fire('pointerup', 3, moved(s, 15, 0));
  assert.equal(actions.length, 1);
});

test('attachInput: a cancelled touch does nothing and does not jam input', () => {
  const { canvas, actions } = rig();
  const s = mid(1, 1);
  canvas.fire('pointerdown', 1, s);
  canvas.fire('pointercancel', 1, s);
  assert.deepEqual(actions, []);
  canvas.fire('pointerdown', 2, s);
  canvas.fire('pointerup', 2, moved(s, 15, 0));
  assert.equal(actions.length, 1);
});
