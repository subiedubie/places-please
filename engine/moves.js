// Legal moves and reshuffling.
//
// A move is a swap of two side-by-side cells. It is legal when it makes a
// match, or when either cell is a power-up (swapping a power-up always fires
// it). When the board has no legal move, reshuffle() rearranges the pieces so
// the player is never stuck.

import { get, set, piece, isPiece, isPower } from './board.js';
import { findGroups } from './matches.js';

// Tuning numbers for reshuffle (kept here, at the top, so they are easy to find).
const SHUFFLE_TRIES = 200; // shuffles to try before giving up on keeping the same colors
const REPAIR_ROUNDS = 40; // per try: rounds of breaking up accidental matches
const REBUILD_TRIES = 5000; // safety stop for the from-scratch rebuild
const MIN_REBUILD_COLORS = 4; // the rebuild uses at least this many colors

// Can this cell be swapped? Only ordinary pieces and power-ups can. Holes,
// empty cells, obstacles (blocks) and the dropper never can.
function swappable(cell) {
  return isPiece(cell) || isPower(cell);
}

// Would swapping cells a and b make a match that includes a or b?
// We try the swap on the board, look, and always put it back.
function swapMakesGroup(board, a, b) {
  const ca = get(board, a.x, a.y);
  const cb = get(board, b.x, b.y);
  set(board, a.x, a.y, cb);
  set(board, b.x, b.y, ca);
  const made = findGroups(board).some((g) =>
    g.cells.some((c) => (c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y)),
  );
  set(board, a.x, a.y, ca);
  set(board, b.x, b.y, cb);
  return made;
}

// Walk every side-by-side pair once (each cell with its right and its lower
// neighbour, so no pair is listed twice) and collect the legal ones.
// With firstOnly = true it stops at the first legal move (a quick yes/no).
function scanMoves(board, firstOnly) {
  const moves = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const ca = get(board, x, y);
      if (!swappable(ca)) continue;
      const a = { x, y };
      for (const b of [{ x: x + 1, y }, { x, y: y + 1 }]) {
        const cb = get(board, b.x, b.y); // off the board reads as a hole
        if (!swappable(cb)) continue;
        let legal;
        if (isPower(ca) || isPower(cb)) legal = true; // power-up swaps always count
        else if (ca.color === cb.color) legal = false; // swapping twins changes nothing
        else legal = swapMakesGroup(board, a, b);
        if (legal) {
          moves.push({ a, b });
          if (firstOnly) return moves;
        }
      }
    }
  }
  return moves;
}

// Every legal swap on the board, as { a: {x, y}, b: {x, y} }.
export function findLegalMoves(board) {
  return scanMoves(board, false);
}

// Is the player able to do anything? True if any power-up exists (a power-up
// can always be tapped, even when boxed in) or any legal swap exists.
export function hasLegalMove(board) {
  if (board.cells.some((cell) => isPower(cell))) return true;
  return scanMoves(board, true).length > 0;
}

// The board is "playable" when the player has a move and nothing is already
// matched (a ready-made match would clear by itself).
function playable(board) {
  return findGroups(board).length === 0 && hasLegalMove(board);
}

// Positions of all ordinary pieces.
function piecePositions(board) {
  const spots = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      if (isPiece(get(board, x, y))) spots.push({ x, y });
    }
  }
  return spots;
}

// Break up accidental matches. For each matched group, "fix" is applied to its
// middle cell. Repeats for a few rounds; returns true once no matches remain.
function breakUpGroups(board, fix) {
  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const groups = findGroups(board);
    if (groups.length === 0) return true;
    for (const g of groups) fix(g.cells[Math.floor(g.cells.length / 2)]);
  }
  return findGroups(board).length === 0;
}

// reshuffle: rearrange the pieces so the board is playable again.
// Changes the board in place and returns the same board.
//   - Only ordinary pieces move; power-ups, holes, obstacles and droppers
//     stay where they are.
//   - First it keeps exactly the same pieces and just moves them around:
//     shuffle, then trade away any accidental matches, then check.
//   - If 200 tries fail (the colors on the board cannot make a playable
//     layout, e.g. only two of each), it deals brand-new random colors.
export function reshuffle(board, rng) {
  const spots = piecePositions(board);
  if (spots.length === 0) return board; // nothing to rearrange

  const colorOf = (p) => get(board, p.x, p.y).color;
  const setColor = (p, color) => set(board, p.x, p.y, piece(color));

  // --- Path 1: same pieces, new places ---
  for (let attempt = 0; attempt < SHUFFLE_TRIES; attempt++) {
    // Fisher-Yates shuffle of the colors, then deal them back out.
    const colors = spots.map(colorOf);
    for (let i = colors.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    spots.forEach((p, i) => setColor(p, colors[i]));

    // A random deal on a big board almost always contains a match somewhere,
    // so trade one piece of each match with a random other piece. Trading
    // keeps the same set of pieces on the board.
    breakUpGroups(board, (cell) => {
      const mine = colorOf(cell);
      for (let k = 0; k < 8; k++) {
        const other = rng.pick(spots);
        const theirs = colorOf(other);
        if (theirs === mine) continue;
        setColor(cell, theirs);
        setColor(other, mine);
        return;
      }
    });

    if (playable(board)) return board;
  }

  // --- Path 2: rebuild with fresh random colors ---
  // Uses as many colors as were on the board, but at least four.
  const distinct = new Set(spots.map(colorOf)).size;
  const n = Math.max(MIN_REBUILD_COLORS, distinct);
  for (let attempt = 0; attempt < REBUILD_TRIES; attempt++) {
    for (const p of spots) setColor(p, rng.int(n));
    // Re-roll one piece of each accidental match.
    breakUpGroups(board, (cell) => setColor(cell, rng.int(n)));
    if (playable(board)) return board;
  }

  // Only reachable on a board too small to ever hold a move (fewer than
  // three pieces in any line). Nothing more can be done here.
  return board;
}
