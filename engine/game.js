// One attempt at one level: the board, the moves left, the targets, and the
// single function `act` that applies a player's move and reports what happened.
//
// Nothing here touches the screen. The UI calls act(), gets back a list of
// events (including 'frame' snapshots of the board), and plays them.

import {
  createBoard, get, set, piece, cloneBoard, adjacent,
  isPiece, isPower, isBlock, isDrop, isPart, isPainted, EMPTY, POWER_KINDS, block, drop,
  placeBlock, setFloor, floorAt, liftFloor, obstacleDef, anchorOf,
} from './board.js';
import { OBSTACLES2, DROPPERS } from '../config/obstacles.js';
import { makeRng } from './rng.js';
import { findGroups } from './matches.js';
import { DROP_RULES } from './drops.js';
import { settleSteps } from './resolve.js';
import { placeTwists, takeTurn, uncover, syncTargets } from './twists.js';
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
function placeObstacles(board, level, rng) {
  // `inside` may itself be a block; make sure it has its hit points.
  const asCell = (c) => (c && c.t === 'block' && c.hp === undefined ? block(c.kind, { ...c, inside: asCell(c.inside) }) : c);
  for (const b of level.blocks || []) {
    const there = get(board, b.x, b.y);
    if (there === null) continue; // a hole, or off the board
    let inside = asCell(b.inside);
    if (b.kind === 'padlock' && !inside && isPiece(there)) inside = there;
    const extra = { color: b.color, inside };
    const def = OBSTACLES2[b.kind];
    if (b.w) extra.w = b.w;
    if (b.h) extra.h = b.h;
    if (def) {
      // Batch-2 extras: a truss's width, a color list, a curtain's count,
      // whether a makeup case starts open.
      extra.need = b.need;
      extra.open = b.open;
      extra.colors = b.colors;
      if (def.colorList && !b.colors) {
        // No colors given: draw them at random from the level's colors,
        // all different while there are enough to go round.
        let pool = [];
        extra.colors = [];
        for (let i = 0; i < def.colorList; i++) {
          if (pool.length === 0) pool = Array.from({ length: level.colors }, (_, c) => c);
          extra.colors.push(pool.splice(rng.int(pool.length), 1)[0]);
        }
      }
    }
    // placeBlock also lays the 'part' cells of a block bigger than one cell.
    placeBlock(board, b.x, b.y, b.kind, extra);
  }
  for (const d of level.drops || []) {
    if (get(board, d.x, d.y) === null) continue;
    set(board, d.x, d.y, drop(d.kind));
  }
  // The floor layer: level.floor = [{ x, y, kind }] ('confetti' or 'petals').
  for (const f of level.floor || []) {
    if (get(board, f.x, f.y) === null) continue;
    setFloor(board, f.x, f.y, f.kind);
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
  placeObstacles(board, level, setupRng);
  // Safety net: the fill above avoids matches, but make sure a move exists.
  if (findGroups(board).length > 0 || !hasLegalMove(board)) reshuffle(board, setupRng);

  placeTwists(board, level);
  if (level.belts) board.belts = level.belts.map((b) => ({ ...b }));
  if (level.paint) board.paint = new Array(board.cells.length).fill(0);

  // Each gift replaces one ordinary piece, chosen at random. Replacing a piece
  // with a power-up cannot create a match, so the board stays clean.
  const giftRng = base.fork('gifts');
  for (const kind of options.startPowers || []) {
    const spots = [];
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        const c = get(board, x, y);
        if (isPiece(c) && c.fuse === undefined && !c.mimic) spots.push({ x, y });
      }
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
    act: 0,                     // which board of a level with several (level.acts)
    history: {},                // room for later drop rules (retries, streaks, purchases)
    superPrism: !!options.superPrism, // Magic Balls have double effect this level
  };
  // Not saved as-is (functions and generator state); see serialize().
  syncTargets(game);
  Object.defineProperty(game, '_rng', { value: base.fork('drops'), writable: true, enumerable: false });
  Object.defineProperty(game, '_dropRule', { value: dropRule, writable: true, enumerable: false });
  return game;
}

// What the falling-piece rule is allowed to see.
export function dropContext(game) {
  return {
    colors: game.level.colors,
    rng: game._rng,
    dropRule: game._dropRule,
    targets: game.targets,
    movesLeft: game.movesLeft,
    history: game.history,
  };
}

// What a Ninja Star (and a tapped Magic Ball) should go for:
//   - a piece of a color the level still needs;
//   - a block of a kind the level still needs (a part of a big block counts as
//     its block), or a padlock that is holding such a block;
//   - any cell whose floor (confetti, petals) the level still needs;
//   - a candy jar when the level still needs candy;
//   - a piece or obstacle in the column below a sandbag the level still needs
//     (clearing it lets the sandbag fall);
//   - a piece of a color that opens a curtain the level still needs;
//   - a piece right next to a generator (top hat, popcorn cart) whose product
//     the level still needs. The generator itself is never aimed at: a power
//     hit does nothing to it.
// The (x, y) of the cell is optional; without it only the cell itself is judged.
export function stillNeeded(game) {
  const drops = Object.keys(DROPPERS).filter((k) => game.targets.some((t) => t.block === k && t.have < t.need));
  const open = (id) => game.targets.some((t) => t.block === id && t.have < t.need);
  const blockNeeded = (cell) => {
    if (open(cell.kind)) return true;
    if (cell.kind === 'dovecote' && open('dove')) return true;
    if (cell.kind === 'dressing' && open('giftbox')) return true;
    if (cell.kind === 'greasepot' && open('goo')) return true;
    if (cell.kind === 'rigbag' && open('barrel')) return true;
    if (cell.kind === 'rolldrop' && open('crate')) return true;
    if (cell.kind === 'paintkeg' && open('paint_floor')) return true;
    const def = obstacleDef(cell.kind);
    if (def.product && !def.generator && open(def.product)) return true;
    return cell.kind === 'padlock' && isBlock(cell.inside) && blockNeeded(cell.inside);
  };
  return (cell, x, y) => {
    const board = game.board;
    const placed = x !== undefined && y !== undefined;
    if (placed) {
      const floor = floorAt(board, x, y);
      if (floor !== null && (open(floor) || open('treasure'))) return true;
    }
    if (placed && drops.length) {
      for (let up = y - 1; up >= 0; up--) {
        const c = get(board, x, up);
        if (isDrop(c) && drops.includes(c.kind)) return true;
      }
    }
    if (placed && open('paint_floor') && !isPainted(board, x, y)) return true;
    if (isPart(cell)) cell = get(board, cell.ax, cell.ay);
    if (isPiece(cell)) {
      if (open('curtain') && board.cells.some((c) => isBlock(c) && c.kind === 'curtain' && c.color === cell.color)) return true;
      if (game.targets.some((t) => t.color === cell.color && t.have < t.need)) return true;
      if (cell.fuse !== undefined && open('propbomb')) return true;
      if (cell.mimic && open('chameleon')) return true;
      if (!placed) return false;
      // Next to a generator whose product is needed?
      return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
        const n = get(board, x + dx, y + dy);
        if (!isBlock(n)) return false;
        const def = obstacleDef(n.kind);
        return !!def.generator && open(def.product);
      });
    }
    if (isBlock(cell)) return blockNeeded(cell);
    return false;
  };
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
export function recordEvents(game, events) {
  for (const e of events) {
    // 'transform' is a Magic Ball turning pieces into power-ups: those pieces
    // count as cleared too (the later clear only sees the power-up).
    if (e.type === 'clear' || e.type === 'transform') {
      for (const c of e.cells) {
        if (isPiece(c.was)) {
          game.tally.cleared[c.was.color]++;
          const t = game.targets.find((t) => t.color === c.was.color);
          if (t) t.have = Math.min(t.need, t.have + 1);
          if (c.was.fuse !== undefined) countBlock(game, 'propbomb');
          if (c.was.mimic) countBlock(game, 'chameleon');
        }
      }
    } else if (e.type === 'block') {
      // An obstacle took a hit; it only counts once it is destroyed.
      if (e.destroyed) countBlock(game, e.kind);
      if (e.destroyed && e.kind === 'ivy') game.history.ivyCut = true; // it does not grow this move
    } else if (e.type === 'collect') {
      // A dropper reached the bottom ('sandbag'), or a generator or candy jar
      // handed something out ('dove', 'popcorn', 'candy').
      countBlock(game, e.kind);
    } else if (e.type === 'floor') {
      // A bit of floor was removed ('confetti' or 'petals').
      countBlock(game, e.kind);
    } else if (e.type === 'paint') {
      for (let i = 0; i < e.cells.length; i++) countBlock(game, 'paint_floor');
    } else if (e.type === 'spawn-power') {
      bump(game.tally.made, e.kind);
    } else if (e.type === 'cascade') {
      game.tally.cascades++;
    }
  }
}

// Curtains: every curtain cell whose color has been cleared often enough
// (game.tally.cleared[color] has reached the cell's `need`) opens. The cell
// becomes what was behind it (`inside`) or empty. Returns the events.
function openCurtains(game) {
  const board = game.board;
  const events = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const cell = get(board, x, y);
      if (!isBlock(cell) || cell.kind !== 'curtain') continue;
      if ((game.tally.cleared[cell.color] || 0) < cell.need) continue;
      set(board, x, y, cell.inside ?? EMPTY);
      events.push({ type: 'block', x, y, kind: 'curtain', hpLeft: 0, destroyed: true, by: 'count' });
      const lifted = liftFloor(board, x, y);
      if (lifted) events.push(lifted);
    }
  }
  return events;
}

// Makeup cases: every one flips open/closed. Returns the cells that flipped.
function flipMakeupCases(board) {
  const cells = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const cell = get(board, x, y);
      if (!isBlock(cell) || !obstacleDef(cell.kind).toggles) continue;
      set(board, x, y, { ...cell, open: !cell.open }); // a fresh object, so old snapshots stay true
      cells.push({ x, y, open: !cell.open });
    }
  }
  return cells;
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
  const events = [];
  for (const step of actSteps(game, action)) events.push(...step.events);
  return events;
}

// Carry out just the move itself: the swap, or the power-up going off.
// Returns { events, origins }, or null if it is not allowed (nothing changed).
export function applyMove(game, action) {
  const board = game.board;
  const events = [];
  // superPrism: set when the level was started on a long enough win streak.
  const opts = { rng: game._rng, needs: stillNeeded(game), superPrism: !!game.superPrism };
  let origins = [];

  if (action.type === 'tap') {
    const at = action.at;
    const cell = at ? get(board, at.x, at.y) : null;
    if (!isPower(cell)) return null;
    bump(game.tally.fired, cell.kind);
    events.push(...fire(board, at, opts));
  } else if (action.type === 'swap') {
    const { a, b } = action;
    if (!a || !b || !adjacent(a, b)) return null;
    const ca = get(board, a.x, a.y), cb = get(board, b.x, b.y);
    // Pieces, power-ups and things that fall can be swapped: not holes, empty
    // cells or obstacles.
    const loose = (c) => isPiece(c) || isPower(c) || isDrop(c);
    if (!loose(ca) || !loose(cb) || (isDrop(ca) && isDrop(cb))) return null;

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
      // (The match must include one of the two pieces: during a chain reaction
      // there may be other matches waiting that this swap has no part in.)
      const part = (c) => (c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y);
      if (!findGroups(board).some((g) => g.cells.some(part))) {
        swapCells(board, a, b); // put them back
        return null;
      }
      events.push({ type: 'swap', a, b }, { type: 'frame', board: cloneBoard(board) });
      origins = [b, a];
    }
  } else {
    return null;
  }
  game.movesLeft -= 1;
  game.moveCount += 1;
  return { events, origins };
}

// Bring on the next board of a level with acts. Moves carry over, and so do
// the power-ups that were made.
function nextAct(game) {
  const { level, board } = game;
  const act = level.acts[game.act];
  const rng = game._rng;
  const kept = board.cells.filter(isPower);
  game.act += 1;
  const fresh = createBoard(board.cols, board.rows, act.holes || level.holes);
  fillStart(fresh, level.colors, rng);
  placeObstacles(fresh, { ...level, ...act }, rng);
  if (findGroups(fresh).length > 0 || !hasLegalMove(fresh)) reshuffle(fresh, rng);
  const spots = [];
  fresh.cells.forEach((c, i) => { if (isPiece(c)) spots.push(i); });
  for (const p of kept) if (spots.length) fresh.cells[spots.splice(rng.int(spots.length), 1)[0]] = p;
  board.cells = fresh.cells;
  board.floor = fresh.floor;
  game.targets = act.targets.map((t) => ({ ...t, have: 0 }));
  syncTargets(game);
  return [{ type: 'act', n: game.act }, { type: 'frame', board: cloneBoard(board) }];
}

export const targetsMet = (game) => game.targets.every((t) => t.have >= t.need);

// Would this move be accepted right now? (Tried on a copy.)
export function isLegal(game, action) {
  if (!action || game.status !== 'playing' || game.movesLeft <= 0 || targetsMet(game)) return false;
  const copy = deserialize(serialize(game));
  return applyMove(copy, action) !== null;
}

// A whole move, one step at a time, so the screen can play each step before
// the rules go on. Each step is { events, landed }.
// EARLY MOVES: after a step with landed = true the caller may pass the
// player's next action to next(). It is made at once, before the matches that
// were about to clear do so, so it may help or spoil them. The step that
// answers it has `early: true` if it was accepted.
export function* actSteps(game, action) {
  if (game.status !== 'playing' || !action) { yield { events: INVALID(), landed: false }; return; }
  const move = applyMove(game, action);
  if (!move) { yield { events: INVALID(), landed: false }; return; }
  recordEvents(game, move.events);
  yield { events: move.events, landed: false };
  yield* finishSteps(game, move.origins);
}

// Let the board come to rest (clear, fall, refill, repeat), then end the move.
export function* finishSteps(game, origins = []) {
  const board = game.board;
  let turned = false; // the twists (engine/twists.js) take their turn once, when the board is still
  for (;;) {
    const ctx = { ...dropContext(game), needs: stillNeeded(game) };
    let again = false;
    for (const step of settleSteps(board, ctx, origins)) {
      // Treasure uncovered in this step (told just before its last picture).
      const found = uncover(board);
      if (found.length > 0) step.events.splice(Math.max(0, step.events.length - 1), 0, ...found);
      recordEvents(game, step.events);
      const early = yield step;
      if (!early || !step.landed || game.movesLeft <= 0 || targetsMet(game)) continue;
      const move = applyMove(game, early);
      if (!move) continue;
      const flipped = flipMakeupCases(board); // the move before this one is over
      if (flipped.length > 0) move.events.push({ type: 'toggle', cells: flipped }, { type: 'frame', board: cloneBoard(board) });
      recordEvents(game, move.events);
      yield { events: move.events, landed: false, early: true };
      origins = move.origins;
      again = true;
      break;
    }
    if (again) continue;
    origins = [];

    // Curtains open once enough of their color has been cleared this level.
    // What was behind them may fall or match, so the board settles again.
    const opened = openCurtains(game);
    if (opened.length === 0) {
      if (targetsMet(game) && game.act < (game.level.acts || []).length) {
        // The next act: a new board, with its own targets.
        yield { events: nextAct(game), landed: false };
        turned = true;
        continue;
      }
      if (turned || targetsMet(game)) break;
      turned = true;
      const acted = takeTurn(game);
      if (acted.length === 0) break;
      yield { events: acted, landed: false };
      continue; // what moved may now match
    }
    const events = [...opened, { type: 'frame', board: cloneBoard(board) }];
    recordEvents(game, events);
    yield { events, landed: false };
  }

  // Makeup cases flip open/closed after every move.
  const events = [];
  const flipped = flipMakeupCases(board);
  if (flipped.length > 0) {
    events.push({ type: 'toggle', cells: flipped }, { type: 'frame', board: cloneBoard(board) });
  }

  // Never leave the player stuck.
  if (!hasLegalMove(board)) {
    reshuffle(board, game._rng);
    // Nothing a shuffle can do (too few gems left in reach): a gem becomes a
    // power-up, so there is always something to set off.
    if (!hasLegalMove(board) && !board.cells.some(isPower)) {
      const gems = board.cells.map((c, i) => (isPiece(c) ? i : -1)).filter((i) => i >= 0);
      if (gems.length) board.cells[game._rng.pick(gems)] = { t: 'power', kind: 'under' };
    }
    events.push({ type: 'reshuffle' }, { type: 'frame', board: cloneBoard(board) });
  }

  if (targetsMet(game)) game.status = 'won';
  else if (game.movesLeft <= 0) game.status = 'lost';
  if (game.status !== 'playing') events.push({ type: 'end', status: game.status });
  if (events.length > 0) yield { events, landed: false };
}

// Turn a game into plain data that can be stored as JSON, and back.
export function serialize(game) {
  return {
    level: game.level,
    board: {
      cols: game.board.cols,
      rows: game.board.rows,
      cells: game.board.cells,
      // The floor layer (an old game without one saves as all null).
      floor: game.board.floor || new Array(game.board.cells.length).fill(null),
      ...(game.board.revolves ? { revolves: game.board.revolves } : {}),
      ...(game.board.hidden ? { hidden: game.board.hidden } : {}),
      ...(game.board.paint ? { paint: game.board.paint } : {}),
      ...(game.board.belts ? { belts: game.board.belts } : {}),
    },
    movesLeft: game.movesLeft,
    act: game.act || 0,
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
    // An old save has no floor layer: that reads as no floor anywhere.
    board: { cols: d.board.cols, rows: d.board.rows, cells, floor: d.board.floor || new Array(cells.length).fill(null), ...(d.board.revolves ? { revolves: d.board.revolves } : {}), ...(d.board.hidden ? { hidden: d.board.hidden } : {}), ...(d.board.paint ? { paint: d.board.paint } : {}), ...(d.board.belts ? { belts: d.board.belts } : {}) },
    act: d.act || 0,
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
