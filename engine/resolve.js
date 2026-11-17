// Falling, refilling and cascades.
//
// All three functions here CHANGE the board they are given (they do not make
// a copy) and return a list describing what happened, so the screen code can
// play it back as animation.

import {
  get, set, cloneBoard, piece, power, EMPTY,
  isEmpty, isHole, isBlock, isDrop, isMovable, hitBlock,
} from './board.js';
import { findGroups, powerForShape } from './matches.js';

// ---- Falling ----------------------------------------------------------------
//
// The rules (docs/OBSTACLES.md, "Falling"):
//   - Holes and obstacles (blocks) never move. Things fall THROUGH holes, but
//     a block stops them.
//   - Step 1, straight: things drop straight down into empty cells, and empty
//     cells that are open to the top of the board get new pieces.
//   - Step 2, diagonal: only when step 1 can do nothing more, ONE thing slides
//     down-and-sideways into the lowest empty cell that has something movable
//     at its upper-left or upper-right. Then step 1 runs again.
//   - Step 3, collect: when both are stuck, a dropper resting on the lowest
//     cell of its column is taken off the board.
// Cells sealed in by blocks may stay empty until the blocks break.

// A column is cut into "stretches" by its blocks. Within one stretch things
// can fall freely; nothing passes a block. Each stretch is the list of its
// rows from the bottom up (holes left out). The LAST stretch in the list is
// the one that reaches the top of the board, which is the only one new pieces
// can drop into.
function stretchesOf(board, x) {
  const out = [];
  let rows = [];
  for (let y = board.rows - 1; y >= 0; y--) {
    const cell = get(board, x, y);
    if (isHole(cell)) continue; // things pass straight through holes
    if (isBlock(cell)) {
      out.push(rows);
      rows = [];
    } else {
      rows.push(y);
    }
  }
  out.push(rows);
  return out;
}

// Move one thing from one cell to another, leaving an empty cell behind.
// `track` (optional) remembers where each thing started; see fallUntilStuck.
function moveCell(board, track, fx, fy, tx, ty) {
  set(board, tx, ty, get(board, fx, fy));
  set(board, fx, fy, EMPTY);
  if (track) {
    track[ty * board.cols + tx] = track[fy * board.cols + fx];
    track[fy * board.cols + fx] = null;
  }
}

// Step 1a: everything drops straight down as far as it can go.
// Returns Fall[] where Fall = { from: {x, y}, to: {x, y} }.
function collapseTracked(board, track) {
  const falls = [];
  for (let x = 0; x < board.cols; x++) {
    for (const rows of stretchesOf(board, x)) {
      // "write" = the next slot waiting to be filled, starting at the bottom.
      let write = 0;
      for (let read = 0; read < rows.length; read++) {
        if (isEmpty(get(board, x, rows[read]))) continue; // nothing here to drop
        if (read !== write) {
          // Move this cell down to the lowest free slot.
          moveCell(board, track, x, rows[read], x, rows[write]);
          falls.push({ from: { x, y: rows[read] }, to: { x, y: rows[write] } });
        }
        write++;
      }
    }
  }
  return falls;
}

// Step 1b: a new piece for every empty cell that is open to the top.
// Each column is filled from its lowest open empty cell upward, and every
// color is chosen by the drop rule, which is told the board and the column.
// Returns Spawn[] where Spawn = { at: {x, y}, cell }.
function refillTracked(board, ctx, track) {
  const spawns = [];
  for (let x = 0; x < board.cols; x++) {
    const top = stretchesOf(board, x).pop(); // the stretch that reaches the top
    for (const y of top) {
      if (!isEmpty(get(board, x, y))) continue;
      const cell = piece(ctx.dropRule({ ...ctx, board, x }));
      set(board, x, y, cell);
      if (track) track[y * board.cols + x] = 'new';
      spawns.push({ at: { x, y }, cell });
    }
  }
  return spawns;
}

// Step 2: ONE diagonal slide. Looks for the lowest empty cell that has a
// movable thing at its upper-left or upper-right and slides that thing in.
// On even columns the left side is tried first, on odd columns the right.
// Returns true if something slid.
function slideOne(board, track) {
  for (let y = board.rows - 1; y >= 1; y--) {
    for (let x = 0; x < board.cols; x++) {
      if (!isEmpty(get(board, x, y))) continue;
      const sides = x % 2 === 0 ? [-1, 1] : [1, -1];
      for (const dx of sides) {
        if (isMovable(get(board, x + dx, y - 1))) {
          moveCell(board, track, x + dx, y - 1, x, y);
          return true;
        }
      }
    }
  }
  return false;
}

// Steps 1 and 2 together, repeated until nothing can move.
// Returns { falls, spawns } for the WHOLE step: each thing is listed once,
// with where it started and where it finally came to rest.
function fallUntilStuck(board, ctx) {
  // track[i] says where the thing now in cell i started: its own {x, y} for
  // something that was already on the board, 'new' for a new piece.
  const track = board.cells.map((cell, i) =>
    isMovable(cell) ? { x: i % board.cols, y: Math.floor(i / board.cols) } : null,
  );
  for (;;) {
    collapseTracked(board, track);
    refillTracked(board, ctx, track);
    if (!slideOne(board, track)) break; // steps 1 and 2 are both stuck
  }
  // Read the result off the board: column by column, bottom row first.
  const falls = [];
  const spawns = [];
  for (let x = 0; x < board.cols; x++) {
    for (let y = board.rows - 1; y >= 0; y--) {
      const from = track[y * board.cols + x];
      if (from === null) continue;
      if (from === 'new') spawns.push({ at: { x, y }, cell: get(board, x, y) });
      else if (from.x !== x || from.y !== y) falls.push({ from, to: { x, y } });
    }
  }
  return { falls, spawns };
}

// Step 3: take every dropper that sits in the lowest (non-hole) cell of its
// column off the board. Returns the 'collect' events.
function collectDroppers(board) {
  const collected = [];
  for (let x = 0; x < board.cols; x++) {
    for (let y = board.rows - 1; y >= 0; y--) {
      const cell = get(board, x, y);
      if (isHole(cell)) continue;
      // This is the column's lowest real cell: collect it if it is a dropper.
      if (isDrop(cell)) {
        set(board, x, y, EMPTY);
        collected.push({ type: 'collect', x, y, kind: cell.kind });
      }
      break;
    }
  }
  return collected;
}

// collapse: let everything fall straight down (step 1a only).
// Returns Fall[] where Fall = { from: {x, y}, to: {x, y} }.
export function collapse(board) {
  return collapseTracked(board, null);
}

// refill: put a new piece in every empty cell that is open to the top
// (step 1b only). On a board without obstacles that is every empty cell.
//   ctx = { colors, rng, dropRule, targets, movesLeft, history }
// Returns Spawn[] where Spawn = { at: {x, y}, cell }.
export function refill(board, ctx) {
  return refillTracked(board, ctx, null);
}

// The whole Falling procedure, recording the events for playback:
//   'fall' + 'refill' + 'frame' for each round of falling, and after a round
//   that ends with droppers at the bottom, one 'collect' per dropper + 'frame',
//   then another round.
// With `always` false, a first round in which nothing moved is left out of the
// event list (used at the start of settle, where the board may hold empty
// cells that are sealed in by blocks and cannot be filled).
function dropAndFill(board, ctx, events, always) {
  for (let round = 1; ; round++) {
    const { falls, spawns } = fallUntilStuck(board, ctx);
    if (falls.length > 0 || spawns.length > 0 || (always && round === 1)) {
      events.push({ type: 'fall', falls });
      events.push({ type: 'refill', spawns });
      events.push({ type: 'frame', board: cloneBoard(board) });
    }
    const collected = collectDroppers(board);
    if (collected.length === 0) break;
    events.push(...collected);
    events.push({ type: 'frame', board: cloneBoard(board) });
  }
}

// When a group is cleared, every block touching any of its cells (side by
// side, not diagonally) takes ONE match hit carrying the group's color, no
// matter how many of the group's cells it touches. Returns the 'block' events
// of the hits that landed.
function hitNeighbours(board, group, ctx) {
  const done = new Set();
  const out = [];
  for (const c of group.cells) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = `${x},${y}`;
      if (done.has(key) || !isBlock(get(board, x, y))) continue;
      done.add(key);
      const hit = hitBlock(board, x, y, 'match', group.color, ctx.rng);
      if (hit) out.push(hit);
    }
  }
  return out;
}

// Where a group's power-up goes: the first of the player's swapped cells
// ("origins") that is in the group; otherwise the group cell closest to the
// middle of the group (ties go to the upper-left-most cell).
function powerSpot(group, origins) {
  for (const o of origins) {
    if (group.cells.some((c) => c.x === o.x && c.y === o.y)) return { x: o.x, y: o.y };
  }
  let cx = 0;
  let cy = 0;
  for (const c of group.cells) {
    cx += c.x;
    cy += c.y;
  }
  cx /= group.cells.length;
  cy /= group.cells.length;
  let best = group.cells[0];
  let bestDist = Infinity;
  for (const c of group.cells) {
    const d = (c.x - cx) ** 2 + (c.y - cy) ** 2;
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return { x: best.x, y: best.y };
}

// settle: keep resolving the board until nothing matches.
//   1. If anything can fall already (e.g. a power-up just fired), drop and
//      refill first.
//   2. Then repeat: find groups; stop if there are none; clear each group and
//      hit the blocks next to it; place the power-up each group earned; drop
//      and refill.
// "origins" are the cells the player just swapped. They decide where a new
// power-up appears, and only count on the first pass (later passes are
// cascades the player did not directly cause).
// Returns the ordered list of events (see the event shapes pushed below).
export function settle(board, ctx, origins = []) {
  const events = [];

  dropAndFill(board, ctx, events, false);

  for (let pass = 1; ; pass++) {
    const groups = findGroups(board);
    if (groups.length === 0) break;

    // Every pass after the first is a cascade (chain reaction).
    if (pass > 1) events.push({ type: 'cascade', depth: pass });

    // Clear every group. "was" remembers what each cell held, so the game
    // can count cleared colors and the screen can animate them.
    for (const group of groups) {
      const cells = group.cells.map((c) => ({ x: c.x, y: c.y, was: get(board, c.x, c.y) }));
      for (const c of group.cells) set(board, c.x, c.y, EMPTY);
      events.push({ type: 'clear', cause: 'match', color: group.color, cells });
      // Blocks next to the group take a match hit:
      //   { type: 'block', x, y, kind, hpLeft, destroyed, by: 'match' }
      events.push(...hitNeighbours(board, group, ctx));
    }

    // Each group makes at most one power-up, decided by its shape.
    for (const group of groups) {
      const kind = powerForShape(group.shape);
      if (kind === null) continue;
      const at = powerSpot(group, pass === 1 ? origins : []);
      set(board, at.x, at.y, power(kind));
      events.push({ type: 'spawn-power', at, kind });
    }

    // A snapshot of the board with the cleared gaps and new power-ups.
    events.push({ type: 'frame', board: cloneBoard(board) });

    dropAndFill(board, ctx, events, true);
  }

  return events;
}
