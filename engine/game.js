// One attempt at one level: the board, the moves left, the targets, and the
// single function `act` that applies a player's move and reports what happened.
//
// Nothing here touches the screen. The UI calls act(), gets back a list of
// events (including 'frame' snapshots of the board), and plays them.

import {
  createBoard, get, set, piece, cloneBoard, adjacent,
  isPiece, isPower, isBlock, EMPTY, POWER_KINDS, block, drop,
} from './board.js';
import { DROPPER } from '../config/obstacles.js';
import { makeRng } from './rng.js';
import { findGroups } from './matches.js';
import { DROP_RULES } from './drops.js';
import { settle } from './resolve.js';
import { fire, combine } from './powers.js';
import { hasLegalMove, reshuffle } from './moves.js';

const INVALID = () => [{ type: 'invalid' }];

// Fill a fresh board so that it starts with no ready-made match.
// For each cell we rule out any color that would finish a line of three
// (looking left and up) or a 2x2 square, then pick among the rest.
function fillStart(board, colors, rng) {
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      if (get(board, x, y) === null) continue; // hole
      const banned = new Set();
      const l1 = get(board, x - 1, y), l2 = get(board, x - 2, y);
      if (isPiece(l1) && isPiece(l2) && l1.color === l2.color) banned.add(l1.color);
      const u1 = get(board, x, y - 1), u2 = get(board, x, y - 2);
      if (isPiece(u1) && isPiece(u2) && u1.color === u2.color) banned.add(u1.color);
      const ul = get(board, x - 1, y - 1);
      if (isPiece(l1) && isPiece(u1) && isPiece(ul) && l1.color === u1.color && u1.color === ul.color) {
        banned.add(l1.color);
      }
      const choices = [];
      for (let c = 0; c < colors; c++) if (!banned.has(c)) choices.push(c);
      set(board, x, y, piece(rng.pick(choices.length ? choices : [0])));
    }
  }
}

// Put the level's obstacles and droppers on a freshly filled board.
//   level.blocks = [{ x, y, kind, color?, inside? }]   level.drops = [{ x, y }]
// Both lists are optional. Entries that point at a hole or off the board are
// ignored. A padlock with no `inside` given locks up the piece that the fill
// put in that cell.
function placeObstacles(board, level) {
  // `inside` may itself be a block; make sure it has its hit points.
  const asCell = (c) => (c && c.t === 'block' && c.hp === undefined ? block(c.kind, { color: c.color, inside: asCell(c.inside) }) : c);
  for (const b of level.blocks || []) {
    const there = get(board, b.x, b.y);
    if (there === null) continue; // a hole, or off the board
    let inside = asCell(b.inside);
    if (b.kind === 'padlock' && !inside && isPiece(there)) inside = there;
    set(board, b.x, b.y, block(b.kind, { color: b.color, inside }));
  }
  for (const d of level.drops || []) {
    if (get(board, d.x, d.y) === null) continue;
    set(board, d.x, d.y, drop());
  }
}

// options.startPowers: a list of power-up kinds to place on the board before
// the first move (the streak gift, and later the pre-level boosters).
export function newGame(level, attemptSeed, dropRule = DROP_RULES.D1, options = {}) {
  const base = makeRng(attemptSeed);
  const board = createBoard(level.cols, level.rows, level.holes);
  const setupRng = base.fork('setup');
  fillStart(board, level.colors, setupRng);
  // Obstacles and droppers replace some of the pieces just placed.
  placeObstacles(board, level);
  // Safety net: the fill above avoids matches, but make sure a move exists.
  if (findGroups(board).length > 0 || !hasLegalMove(board)) reshuffle(board, setupRng);

  // Each gift replaces one ordinary piece, chosen at random. Replacing a piece
  // with a power-up cannot create a match, so the board stays clean.
  const giftRng = base.fork('gifts');
  for (const kind of options.startPowers || []) {
    const spots = [];
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) if (isPiece(get(board, x, y))) spots.push({ x, y });
    }
    if (spots.length === 0) break;
    const at = giftRng.pick(spots);
    set(board, at.x, at.y, { t: 'power', kind: kind === 'spot-h' && giftRng.int(2) ? 'spot-v' : kind });
  }

  const game = {
    level,
    board,
    movesLeft: level.moves,
    // A target is { color, need, have } (clear pieces of that color) or
    // { block, need, have } (break obstacles of that kind; 'sandbag' = collect droppers).
    targets: level.targets.map((t) =>
      t.block !== undefined
        ? { block: t.block, need: t.need, have: 0 }
        : { color: t.color, need: t.need, have: 0 },
    ),
    status: 'playing',
    tally: {
      cleared: [0, 0, 0, 0, 0], // pieces cleared, per color
      made: {},                 // power-ups created, per kind
      fired: {},                // power-ups the player set off, per kind
      cascades: 0,              // chain reactions after the first clear
    },
    attemptSeed,
    moveCount: 0,
    history: {},                // room for later drop rules (retries, streaks, purchases)
    superPrism: !!options.superPrism, // Magic Balls have double effect this level
  };
  // Not saved as-is (functions and generator state); see serialize().
  Object.defineProperty(game, '_rng', { value: base.fork('drops'), writable: true, enumerable: false });
  Object.defineProperty(game, '_dropRule', { value: dropRule, writable: true, enumerable: false });
  return game;
}

// What the falling-piece rule is allowed to see.
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

// What a Ninja Star (and a tapped Magic Ball) should go for: a piece of a
// color the level still needs, a block of a kind the level still needs, or a
// padlock that is holding such a block.
function stillNeeded(game) {
  const open = (t) => t.have < t.need;
  const needs = (cell) => {
    if (isPiece(cell)) return game.targets.some((t) => t.color === cell.color && open(t));
    if (isBlock(cell)) {
      if (game.targets.some((t) => t.block === cell.kind && open(t))) return true;
      return cell.kind === 'padlock' && isBlock(cell.inside) && needs(cell.inside);
    }
    return false;
  };
  return (cell) => needs(cell);
}

// Add one to the target for breaking this kind of block (if the level has one).
function countBlock(game, kind) {
  const t = game.targets.find((t) => t.block === kind);
  if (t) t.have = Math.min(t.need, t.have + 1);
}

function bump(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

// Read the event list and update the targets and the running counts.
function recordEvents(game, events) {
  for (const e of events) {
    // 'transform' is a Magic Ball turning pieces into power-ups: those pieces
    // count as cleared too (the later clear only sees the power-up).
    if (e.type === 'clear' || e.type === 'transform') {
      for (const c of e.cells) {
        if (isPiece(c.was)) {
          game.tally.cleared[c.was.color]++;
          const t = game.targets.find((t) => t.color === c.was.color);
          if (t) t.have = Math.min(t.need, t.have + 1);
        }
      }
    } else if (e.type === 'block') {
      // An obstacle took a hit; it only counts once it is destroyed.
      if (e.destroyed) countBlock(game, e.kind);
    } else if (e.type === 'collect') {
      // A dropper reached the bottom.
      countBlock(game, DROPPER.id);
    } else if (e.type === 'spawn-power') {
      bump(game.tally.made, e.kind);
    } else if (e.type === 'cascade') {
      game.tally.cascades++;
    }
  }
}

function swapCells(board, a, b) {
  const ca = get(board, a.x, a.y), cb = get(board, b.x, b.y);
  set(board, a.x, a.y, cb);
  set(board, b.x, b.y, ca);
}

// Apply one player action. Returns the ordered list of events.
//   action = { type: 'swap', a: {x,y}, b: {x,y} }   or   { type: 'tap', at: {x,y} }
// An action that is not allowed returns [{ type: 'invalid' }] and changes nothing.
export function act(game, action) {
  if (game.status !== 'playing' || !action) return INVALID();
  const board = game.board;
  const events = [];
  // superPrism: set when the level was started on a 10-win streak.
  const opts = { rng: game._rng, needs: stillNeeded(game), superPrism: !!game.superPrism };
  let origins = [];

  if (action.type === 'tap') {
    const at = action.at;
    const cell = at ? get(board, at.x, at.y) : null;
    if (!isPower(cell)) return INVALID();
    bump(game.tally.fired, cell.kind);
    events.push(...fire(board, at, opts));
  } else if (action.type === 'swap') {
    const { a, b } = action;
    if (!a || !b || !adjacent(a, b)) return INVALID();
    const ca = get(board, a.x, a.y), cb = get(board, b.x, b.y);
    // Only pieces and power-ups can be swapped: not holes, empty cells,
    // obstacles or droppers.
    if (!(isPiece(ca) || isPower(ca)) || !(isPiece(cb) || isPower(cb))) return INVALID();

    if (isPower(ca) && isPower(cb)) {
      // Two power-ups together: the bigger combined effect, centred on b.
      bump(game.tally.fired, ca.kind);
      bump(game.tally.fired, cb.kind);
      events.push({ type: 'swap', a, b });
      events.push(...combine(board, a, b, opts));
    } else if (isPower(ca) || isPower(cb)) {
      // A power-up swapped with a piece: it moves one step and fires there.
      const powerCell = isPower(ca) ? ca : cb;
      const pieceCell = isPower(ca) ? cb : ca;
      const powerNowAt = isPower(ca) ? b : a;
      swapCells(board, a, b);
      events.push({ type: 'swap', a, b }, { type: 'frame', board: cloneBoard(board) });
      bump(game.tally.fired, powerCell.kind);
      events.push(...fire(board, powerNowAt, { ...opts, swapColor: pieceCell.color }));
    } else {
      // Two ordinary pieces: only allowed if it makes a match.
      swapCells(board, a, b);
      if (findGroups(board).length === 0) {
        swapCells(board, a, b); // put them back
        return INVALID();
      }
      events.push({ type: 'swap', a, b }, { type: 'frame', board: cloneBoard(board) });
      origins = [b, a];
    }
  } else {
    return INVALID();
  }

  // Clear matches, let pieces fall, refill, and repeat until the board is still.
  events.push(...settle(board, dropContext(game), origins));
  recordEvents(game, events);

  game.movesLeft -= 1;
  game.moveCount += 1;

  // Never leave the player stuck.
  if (!hasLegalMove(board)) {
    reshuffle(board, game._rng);
    events.push({ type: 'reshuffle' }, { type: 'frame', board: cloneBoard(board) });
  }

  if (game.targets.every((t) => t.have >= t.need)) game.status = 'won';
  else if (game.movesLeft <= 0) game.status = 'lost';
  if (game.status !== 'playing') events.push({ type: 'end', status: game.status });

  return events;
}

// Turn a game into plain data that can be stored as JSON, and back.
export function serialize(game) {
  return {
    level: game.level,
    board: { cols: game.board.cols, rows: game.board.rows, cells: game.board.cells },
    movesLeft: game.movesLeft,
    targets: game.targets,
    status: game.status,
    tally: game.tally,
    attemptSeed: game.attemptSeed,
    moveCount: game.moveCount,
    history: game.history,
    superPrism: !!game.superPrism,
    rngState: game._rng.getState(),
  };
}

export function deserialize(data, dropRule = DROP_RULES.D1) {
  const d = JSON.parse(JSON.stringify(data)); // private copy
  const cells = d.board.cells.map((c) => (c && c.t === 'empty' ? EMPTY : c));
  const game = {
    level: d.level,
    board: { cols: d.board.cols, rows: d.board.rows, cells },
    movesLeft: d.movesLeft,
    targets: d.targets,
    status: d.status,
    tally: d.tally,
    attemptSeed: d.attemptSeed,
    moveCount: d.moveCount,
    history: d.history || {},
    superPrism: !!d.superPrism,
  };
  const rng = makeRng(d.attemptSeed).fork('drops');
  rng.setState(d.rngState);
  Object.defineProperty(game, '_rng', { value: rng, writable: true, enumerable: false });
  Object.defineProperty(game, '_dropRule', { value: dropRule, writable: true, enumerable: false });
  return game;
}

export { POWER_KINDS };
