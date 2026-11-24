// OVERLAPPING MOVES: the player may move in one part of the board while gems
// are still bursting or falling in another. No screen code.
//
// The rules side is always finished with a thing at once: when a match clears,
// the gems above it have already fallen as far as the rules are concerned. The
// screen plays that out afterwards, and tells the rules which cells are still
// in motion through `ready(x, y)`. Only cells at rest can be moved, and only a
// match whose gems are all at rest clears.
//
// When nothing moves and nothing matches any more, the move is ended the
// ordinary way with finishSteps (engine/game.js).
import { applyMove, recordEvents, dropContext, stillNeeded, targetsMet, serialize, deserialize } from './game.js';
import { findGroups } from './matches.js';
import { clearGroups, dropAndFill } from './resolve.js';
import { uncover } from './twists.js';
import { cloneBoard, get } from './board.js';

const isReady = (group, ready) => group.cells.every((c) => ready(c.x, c.y));
const partOf = (group, origins) => group.cells.some((c) => origins.some((o) => o.x === c.x && o.y === c.y));
const cellsOf = (action) => (action.type === 'swap' ? [action.a, action.b] : [action.at]);

// Clear these groups and let everything fall. Returns the events.
function wave(game, groups, origins) {
  const board = game.board;
  const ctx = { ...dropContext(game), needs: stillNeeded(game) };
  const events = [];
  if (groups.length) {
    clearGroups(board, ctx, groups, origins, events);
    events.push({ type: 'frame', board: cloneBoard(board) });
  }
  dropAndFill(board, ctx, events, false);
  const found = uncover(board); // treasure
  if (found.length) events.splice(Math.max(0, events.length - 1), 0, ...found);
  recordEvents(game, events);
  return events;
}

// Why a move cannot be made right now: 'over' (no moves left, or won),
// 'wait' (something it needs is still moving), 'no' (not a legal move), or
// null if it can be made.
export function liveRefusal(game, action, ready) {
  if (!action || game.status !== 'playing' || game.movesLeft <= 0 || targetsMet(game)) return 'over';
  if (action.type !== 'swap' && action.type !== 'tap') return 'no';
  if (!cellsOf(action).every((p) => p && get(game.board, p.x, p.y) !== null && ready(p.x, p.y))) return 'wait';
  const copy = deserialize(serialize(game));
  const move = applyMove(copy, action);
  if (!move) return 'no';
  if (move.origins.length) {
    const mine = findGroups(copy.board).filter((g) => partOf(g, move.origins));
    if (!mine.some((g) => isReady(g, ready))) return 'wait';
  }
  return null;
}

// Make the player's move. Returns its events, or null if it is refused.
export function liveMove(game, action, ready) {
  if (liveRefusal(game, action, ready) !== null) return null;
  const move = applyMove(game, action);
  recordEvents(game, move.events);
  const groups = move.origins.length
    ? findGroups(game.board).filter((g) => partOf(g, move.origins) && isReady(g, ready)) : [];
  return [...move.events, ...wave(game, groups, move.origins)];
}

// The next matches of a chain reaction: every group that has come to rest
// clears. Returns the events, or null if there is none.
export function liveWave(game, ready) {
  const groups = findGroups(game.board).filter((g) => isReady(g, ready));
  return groups.length ? [{ type: 'cascade', depth: 2 }, ...wave(game, groups, [])] : null;
}

// Is there nothing left to clear?
export const liveQuiet = (game) => findGroups(game.board).length === 0;
