// TOUCH INPUT: turns a finger movement on the board into a game action.
//
// Two parts:
//   gestureToAction  pure arithmetic: "finger went from here to there" ->
//                    "swap these two cells" / "tap this power-up" / nothing.
//                    It touches no screen objects, so it is tested in Node.
//   attachInput      listens to the real finger events on the canvas and
//                    calls gestureToAction.

import { get, isPower, isEmpty } from '../engine/board.js';

// A drag must travel this far (as a fraction of one cell) to count as a swap.
// Anything shorter is a press.
export const DRAG_THRESHOLD = 0.3;

// While the finger is still down, a drag this long (fraction of a cell) is
// acted on at once, without waiting for the finger to lift. This is what
// makes swaps feel immediate.
export const EARLY_COMMIT = 0.5;

// Which cell is under a point? Returns {x, y}, or null if the point is off
// the board. `layout` says where the board sits: its top-left corner
// (originX, originY), the cell size, and how many columns and rows.
export function cellAt(px, py, layout) {
  const x = Math.floor((px - layout.originX) / layout.cell);
  const y = Math.floor((py - layout.originY) / layout.cell);
  if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) return null;
  return { x, y };
}

// start, end: where the finger went down and where it is now / lifted,
//             as { px, py } in the same units as the layout.
// Returns { type:'swap', a, b }, { type:'tap', at }, or null (ignore).
export function gestureToAction(start, end, layout, board) {
  if (!start || !end || !layout || !board) return null;

  // The gesture must start on a real cell that holds something.
  const a = cellAt(start.px, start.py, layout);
  if (!a) return null; // started off the board
  const startCell = get(board, a.x, a.y);
  if (startCell === null) return null; // started on a hole
  if (isEmpty(startCell)) return null; // nothing there to move

  const dx = end.px - start.px;
  const dy = end.py - start.py;
  const reach = Math.max(Math.abs(dx), Math.abs(dy)) / layout.cell;

  // Short movement: a press. Only power-ups respond to a press.
  if (reach < DRAG_THRESHOLD) {
    return isPower(startCell) ? { type: 'tap', at: a } : null;
  }

  // Long movement: a swap with the neighbour in the direction the finger
  // moved most (left/right if it moved more sideways, else up/down).
  const b = { x: a.x, y: a.y };
  if (Math.abs(dx) >= Math.abs(dy)) b.x += dx > 0 ? 1 : -1;
  else b.y += dy > 0 ? 1 : -1;

  // get() gives null for a hole and for anything off the board, so this one
  // check covers "dragged off the edge" and "dragged into a hole".
  if (get(board, b.x, b.y) === null) return null;

  return { type: 'swap', a, b };
}

// Wire the canvas up.
//   getLayout()  -> the current layout (it changes when the screen resizes)
//   getBoard()   -> the board as currently shown
//   onAction(a)  -> called with each action the player makes
//   isBusy()     -> true while pieces are still moving; input is ignored then
//   onPress(c)   -> optional: called with the cell under the finger (or null
//                   when the finger lifts) so the screen can highlight it
// Returns a function that removes the listeners again.
export function attachInput(canvas, getLayout, getBoard, onAction, isBusy, onPress) {
  const fingers = new Set(); // ids of the fingers currently down
  let start = null;          // where the current gesture began, or null
  let dead = false;          // true = ignore this gesture until all fingers lift

  // Finger position measured from the canvas's top-left corner.
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  }

  function press(cell) {
    if (onPress) onPress(cell);
  }

  function kill() {
    start = null;
    dead = true;
    press(null);
  }

  function down(e) {
    if (e.preventDefault) e.preventDefault();
    fingers.add(e.pointerId);

    // A second finger cancels whatever the first one was doing.
    if (fingers.size > 1) return kill();

    // A touch that arrives while pieces are moving is thrown away whole,
    // even if the pieces stop before the finger lifts.
    if (isBusy()) return kill();

    dead = false;
    start = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not vital */ }

    const cell = cellAt(start.px, start.py, getLayout());
    press(cell && get(getBoard(), cell.x, cell.y) !== null ? cell : null);
  }

  function move(e) {
    if (!start || dead) return;
    if (isBusy()) return kill();
    const layout = getLayout();
    const now = pos(e);
    const reach = Math.max(Math.abs(now.px - start.px), Math.abs(now.py - start.py)) / layout.cell;
    if (reach < EARLY_COMMIT) return;

    // Dragged far enough: act now, and ignore the rest of this gesture.
    const action = gestureToAction(start, now, layout, getBoard());
    kill();
    if (action) onAction(action);
  }

  function up(e) {
    fingers.delete(e.pointerId);
    if (start && !dead && !isBusy()) {
      const action = gestureToAction(start, pos(e), getLayout(), getBoard());
      start = null;
      press(null);
      if (action) onAction(action);
    }
    start = null;
    press(null);
    if (fingers.size === 0) dead = false; // all fingers up: ready for the next gesture
  }

  // The phone took the touch away (a system gesture, an alert...).
  function cancel(e) {
    fingers.delete(e.pointerId);
    start = null;
    press(null);
    if (fingers.size === 0) dead = false;
  }

  const stop = (e) => e.preventDefault();

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('contextmenu', stop);

  return function detach() {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('lostpointercapture', cancel);
    canvas.removeEventListener('contextmenu', stop);
  };
}
