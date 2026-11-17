// The board: a grid of cells. x = column from the left, y = row from the top.
//
// A cell is one of:
//   null                               a hole (no cell there at all)
//   { t: 'empty' }                     a playable cell with nothing in it
//   { t: 'piece', color: 0..4 }        an ordinary piece
//   { t: 'power', kind }               a power-up; kind is one of POWER_KINDS
//   { t: 'block', kind, hp, color?, inside? }
//                                      a fixed obstacle (see config/obstacles.js).
//                                      hp = hits still needed. color only for a
//                                      paint can; inside only for a padlock.
//                                      Never falls, never matches, cannot be
//                                      swapped or tapped.
//   { t: 'drop', kind: 'sandbag' }     the dropper: falls like a piece, cannot
//                                      be matched, swapped, tapped or damaged,
//                                      and is collected at the bottom of its column

import { OBSTACLES, DROPPER } from '../config/obstacles.js';

export const POWER_KINDS = ['spot-h', 'spot-v', 'under', 'show', 'prism'];

export const EMPTY = Object.freeze({ t: 'empty' });

export function piece(color) {
  return { t: 'piece', color };
}

export function power(kind) {
  return { t: 'power', kind };
}

// A new obstacle of the given kind. Its hp starts at the number of hits the
// config lists for it. `extra` carries the optional parts: { color } for a
// paint can, { inside } for a padlock.
export function block(kind, extra = {}) {
  const def = OBSTACLES[kind];
  if (!def) throw new Error(`unknown obstacle kind: ${kind}`);
  const cell = { t: 'block', kind, hp: def.hits.length };
  if (extra.color !== undefined) cell.color = extra.color;
  if (extra.inside !== undefined && extra.inside !== null) cell.inside = extra.inside;
  return cell;
}

// A new dropper (the sandbag).
export function drop() {
  return { t: 'drop', kind: DROPPER.id };
}

export function createBoard(cols, rows, holes = []) {
  const cells = new Array(cols * rows).fill(EMPTY);
  const board = { cols, rows, cells };
  for (const h of holes) set(board, h.x, h.y, null);
  return board;
}

export function inBounds(b, x, y) {
  return x >= 0 && y >= 0 && x < b.cols && y < b.rows;
}

// Out-of-bounds reads return null, the same as a hole.
export function get(b, x, y) {
  if (!inBounds(b, x, y)) return null;
  return b.cells[y * b.cols + x];
}

export function set(b, x, y, cell) {
  if (!inBounds(b, x, y)) return;
  b.cells[y * b.cols + x] = cell;
}

export function cloneBoard(b) {
  return { cols: b.cols, rows: b.rows, cells: b.cells.slice() };
}

export function adjacent(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function isPiece(cell) {
  return cell !== null && cell.t === 'piece';
}

export function isPower(cell) {
  return cell !== null && cell.t === 'power';
}

export function isEmpty(cell) {
  return cell !== null && cell.t === 'empty';
}

export function isHole(cell) {
  return cell === null;
}

export function isBlock(cell) {
  return cell !== null && cell.t === 'block';
}

export function isDrop(cell) {
  return cell !== null && cell.t === 'drop';
}

// Things that fall: pieces, power-ups and the dropper.
export function isMovable(cell) {
  return cell !== null && (cell.t === 'piece' || cell.t === 'power' || cell.t === 'drop');
}

// Would this block accept a hit right now?
//   by = 'match' (a group cleared next to it; `color` is the group's color)
//   by = 'power' (it was inside a power-up blast)
// The next hit a block needs is read from the config list, counting from the
// first entry: a block with all its hp left needs entry 0, and so on.
export function takesHit(cell, by, color) {
  if (!isBlock(cell)) return false;
  const hits = OBSTACLES[cell.kind].hits;
  const need = hits[hits.length - cell.hp];
  if (need === 'any') return true;
  if (need === 'color') return by === 'power' || color === cell.color;
  return need === by; // 'match' or 'power'
}

// Give the block at (x, y) one hit. CHANGES the board.
// Returns the 'block' event describing it, or null when there is no block
// there or the hit is of the wrong type (then nothing changes).
// When the last hit lands, the cell becomes what the config says it leaves:
// what it was holding ('inside'), a random power-up ('power'), or nothing.
// `rng` is only used for the random power-up.
export function hitBlock(board, x, y, by, color, rng) {
  const cell = get(board, x, y);
  if (!takesHit(cell, by, color)) return null;
  const hpLeft = cell.hp - 1;
  if (hpLeft > 0) {
    // A fresh object, so earlier snapshots of the board keep the old hp.
    set(board, x, y, { ...cell, hp: hpLeft });
  } else {
    const leaves = OBSTACLES[cell.kind].leaves;
    if (leaves === 'inside' && cell.inside) set(board, x, y, cell.inside);
    else if (leaves === 'power') set(board, x, y, power(rng ? rng.pick(POWER_KINDS) : POWER_KINDS[0]));
    else set(board, x, y, EMPTY);
  }
  return { type: 'block', x, y, kind: cell.kind, hpLeft, destroyed: hpLeft === 0, by };
}
