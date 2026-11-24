// BOOSTERS used during a level, and extra moves.
//
// A booster is a helper the player owns (bought with coins or won in an
// event). Using one changes the board but does NOT cost a move.
//
//   'drill'      one cell: a piece is cleared, a power-up goes off, an
//                obstacle takes one power hit
//   'stageleft'  the whole ROW of the chosen cell
//   'trapdoor'   the whole COLUMN of the chosen cell
//   'coinflip'   reshuffles the pieces (no cell needed)
//
// Nothing here touches the screen, and nothing uses Math.random: every random
// choice comes from the game's own generator (game._rng), exactly as a normal
// move does, so a saved game replays the same way.
//
// This file only uses functions the other engine files export. The small
// amount of counting that engine/game.js does after a move (targets, tally,
// win check) is repeated here on purpose, so game.js did not have to change.

import {
  get, set, cloneBoard, EMPTY, isPiece, isPower, isBlock, hitBlockEvents, spreadPaint,
} from './board.js';
import { fire } from './powers.js';
import { stillNeeded } from './game.js'; // what a Ninja Star set off by a booster aims at
import { settle } from './resolve.js';
import { uncover } from './twists.js';
import { hasLegalMove, reshuffle } from './moves.js';

// The four in-level boosters, in the order the booster bar shows them.
export const BOOSTER_KINDS = ['drill', 'stageleft', 'trapdoor', 'coinflip'];

const INVALID = () => [{ type: 'invalid' }];

// ---- Counting (the same rules as recordEvents in engine/game.js) -----------

// Add one to the target for this kind of block / floor / collected thing.
function countBlock(game, kind) {
  const t = game.targets.find((t) => t.block === kind);
  if (t) t.have = Math.min(t.need, t.have + 1);
}

function bump(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

// Read the event list and update the targets and the running counts.
// Written defensively: an event of a shape this file does not know is skipped.
function recordEvents(game, events) {
  const tally = game.tally || (game.tally = { cleared: [0, 0, 0, 0, 0], made: {}, fired: {}, cascades: 0 });
  for (const e of events) {
    if (!e) continue;
    if ((e.type === 'clear' || e.type === 'transform') && Array.isArray(e.cells)) {
      // Pieces cleared (or turned into power-ups by a Magic Ball) count
      // toward the color targets.
      for (const c of e.cells) {
        if (c && isPiece(c.was)) {
          tally.cleared[c.was.color] = (tally.cleared[c.was.color] || 0) + 1;
          const t = game.targets.find((t) => t.color === c.was.color);
          if (t) t.have = Math.min(t.need, t.have + 1);
          if (c.was.fuse !== undefined) countBlock(game, 'propbomb');
          if (c.was.mimic) countBlock(game, 'chameleon');
        }
      }
    } else if (e.type === 'block') {
      // An obstacle took a hit; it only counts once it is destroyed.
      if (e.destroyed) countBlock(game, e.kind);
    } else if (e.type === 'collect') {
      // A sandbag reached the bottom (no kind given), or a generator gave
      // something (kind given: 'dove', 'popcorn', 'candy').
      countBlock(game, e.kind || 'sandbag');
    } else if (e.type === 'floor') {
      // A floor tile (confetti, petals) was removed.
      countBlock(game, e.kind);
    } else if (e.type === 'paint') {
      for (let i = 0; i < e.cells.length; i++) countBlock(game, 'paint_floor');
    } else if (e.type === 'spawn-power') {
      bump(tally.made, e.kind);
    } else if (e.type === 'cascade') {
      tally.cascades = (tally.cascades || 0) + 1;
    }
  }
}

// What the falling-piece rule is allowed to see (same as in engine/game.js).
function dropContext(game) {
  return {
    colors: game.level.colors,
    rng: game._rng,
    dropRule: game._dropRule,
    targets: game.targets,
    movesLeft: game.movesLeft,
    history: game.history,
  };
}

// ---- The blast --------------------------------------------------------------

// Apply a booster to a list of cells. CHANGES the board; returns the events.
//   - a piece is cleared;
//   - an obstacle takes one power hit (at most one per obstacle, even a big
//     one that covers several of the cells);
//   - a power-up goes off (after the pieces are gone, in the order listed);
//   - holes, sandbags and empty cells are left alone.
function blast(game, coords, cause) {
  const board = game.board;
  const events = [];
  const cleared = [];   // pieces removed, for one 'clear' event
  const floorGone = []; // floor tiles removed with them
  const blockHits = [];
  const powers = [];    // power-ups caught, set off afterwards
  const hitOnce = new Set(); // obstacles already hit by this booster

  for (const { x, y } of coords) {
    let cell = get(board, x, y);
    if (cell === null) continue; // a hole, or off the board
    let bx = x, by = y;
    // One cell of a big obstacle points at the obstacle's real cell.
    if (cell.t === 'part') {
      bx = cell.ax; by = cell.ay;
      cell = get(board, bx, by);
      if (cell === null) continue;
    }
    if (isPiece(cell)) {
      set(board, x, y, EMPTY);
      cleared.push({ x, y, was: cell });
      // A floor tile under a cleared piece goes with it (boards without a
      // floor layer simply skip this).
      const i = y * board.cols + x;
      if (Array.isArray(board.floor) && board.floor[i]) {
        floorGone.push({ type: 'floor', x, y, kind: board.floor[i] });
        board.floor[i] = null;
      }
    } else if (isPower(cell)) {
      powers.push({ x, y });
    } else if (isBlock(cell)) {
      const key = bx + ',' + by;
      if (hitOnce.has(key)) continue;
      hitOnce.add(key);
      blockHits.push(...hitBlockEvents(board, bx, by, 'power', undefined, game._rng));
    }
    // anything else (empty cell, sandbag): untouched
  }

  if (cleared.length > 0) events.push({ type: 'clear', cause, cells: cleared });
  const painted = spreadPaint(board, cleared);
  if (painted) events.push(painted);
  events.push(...floorGone, ...blockHits);
  if (events.length > 0) events.push({ type: 'frame', board: cloneBoard(board) });

  // Now the power-ups. They share one "already gone off" list, so a power-up
  // set off by another one's blast does not go off twice.
  const fired = new Set();
  const opts = { rng: game._rng, needs: stillNeeded(game), superPrism: !!game.superPrism, fired };
  for (const at of powers) {
    const cell = get(board, at.x, at.y);
    if (!isPower(cell)) continue; // an earlier blast already took it
    const out = fire(board, at, opts);
    if (out.length > 0) {
      bump(game.tally.fired, cell.kind);
      events.push(...out);
    }
  }
  return events;
}

// ---- useBooster -------------------------------------------------------------

// Use one in-level booster. Returns the ordered event list, in the same shapes
// a normal move gives (so the screen plays it the same way).
//   kind: 'drill' | 'stageleft' | 'trapdoor' | 'coinflip'
//   at:   { x, y } the chosen cell (ignored for 'coinflip')
// Returns [{ type: 'invalid' }] and changes nothing when:
//   - the level is not being played (already won or lost);
//   - the chosen cell is a hole or off the board;
//   - the booster would do nothing at all (for example a Drill on an empty
//     cell or a sandbag), so the player does not waste it.
// A booster NEVER changes movesLeft and can never lose the level.
export function useBooster(game, kind, at) {
  if (!game || game.status !== 'playing') return INVALID();
  const board = game.board;
  let events = [];

  if (kind === 'coinflip') {
    reshuffle(board, game._rng);
    events.push({ type: 'reshuffle' }, { type: 'frame', board: cloneBoard(board) });
  } else if (kind === 'drill' || kind === 'stageleft' || kind === 'trapdoor') {
    if (!at || get(board, at.x, at.y) === null) return INVALID();
    const coords = [];
    if (kind === 'drill') coords.push({ x: at.x, y: at.y });
    else if (kind === 'stageleft') for (let x = 0; x < board.cols; x++) coords.push({ x, y: at.y });
    else for (let y = 0; y < board.rows; y++) coords.push({ x: at.x, y });
    events = blast(game, coords, kind);
    if (events.length === 0) return INVALID(); // nothing there to act on
  } else {
    return INVALID(); // not a booster this file knows
  }

  // Let pieces fall, refill, and clear any matches that form, until still.
  events.push(...settle(board, dropContext(game), []));
  events.push(...uncover(board));
  recordEvents(game, events);

  // Never leave the player stuck.
  if (!hasLegalMove(board)) {
    reshuffle(board, game._rng);
    events.push({ type: 'reshuffle' }, { type: 'frame', board: cloneBoard(board) });
  }

  // A booster can win the level, never lose it (no move was spent).
  if (game.targets.every((t) => t.have >= t.need)) {
    game.status = 'won';
    events.push({ type: 'end', status: 'won' });
  }
  return events;
}

// ---- addMoves ---------------------------------------------------------------

// Give the player n more moves. A level that was lost because the moves ran
// out is being played again afterwards. A level already won is left alone.
// Returns the game.
export function addMoves(game, n) {
  if (!game || game.status === 'won') return game;
  const add = Math.max(0, Math.floor(Number(n) || 0));
  game.movesLeft = Math.max(0, game.movesLeft) + add;
  if (game.status === 'lost' && game.movesLeft > 0) game.status = 'playing';
  return game;
}
