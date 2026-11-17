// Soak test: a bot that plays random legal moves through hundreds of games.
// It is not trying to win; it is checking that the board never ends up in a
// broken state (gaps, leftover matches, pieces in holes, negative moves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act } from '../engine/game.js';
import { generateLevel } from '../levels/generate.js';
import { findGroups } from '../engine/matches.js';
import { findLegalMoves } from '../engine/moves.js';
import { settle } from '../engine/resolve.js';
import { D1 } from '../engine/drops.js';
import { get, cloneBoard, isEmpty, isPower, isPiece, isBlock, isDrop } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { OBSTACLES } from '../config/obstacles.js';

function randomAction(game, rng) {
  const moves = findLegalMoves(game.board);
  if (moves.length) return { type: 'swap', ...rng.pick(moves) };
  const b = game.board;
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      if (isPower(get(b, x, y))) return { type: 'tap', at: { x, y } };
    }
  }
  return null;
}

// The checks made after every move.
//   - no ready-made match is left
//   - holes are still holes, and no other cell has turned into one
//   - every cell holds something the engine knows about
//   - an empty cell is only allowed where blocks seal it in, i.e. where
//     nothing can fall or slide into it: running the falling step again on a
//     copy of the board must change nothing.
function checkBoard(game, holes, label) {
  const board = game.board;
  assert.equal(findGroups(board).length, 0, `${label}: match left on board`);
  let empties = 0;
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const cell = get(board, x, y);
      if (holes.has(`${x},${y}`)) {
        assert.equal(cell, null, `${label}: hole got filled`);
        continue;
      }
      assert.notEqual(cell, null, `${label}: cell became a hole`);
      if (isEmpty(cell)) empties++;
      else if (isBlock(cell)) {
        assert.ok(OBSTACLES[cell.kind], `${label}: unknown block kind`);
        assert.ok(cell.hp >= 1 && cell.hp <= OBSTACLES[cell.kind].hits.length, `${label}: bad hp at ${x},${y}`);
      } else {
        assert.ok(isPiece(cell) || isPower(cell) || isDrop(cell), `${label}: strange cell at ${x},${y}`);
      }
    }
  }
  if (empties > 0) {
    const copy = cloneBoard(board);
    const ctx = { colors: game.level.colors, rng: makeRng(1), dropRule: D1 };
    assert.deepEqual(settle(copy, ctx), [], `${label}: a gap was left that something could still fall into`);
  }
}

// Play one game to the end with random legal moves, checking after each one.
// `watch` (optional) is shown every event list, so a test can count things.
function playOut(game, rng, label, watch) {
  const level = game.level;
  const holes = new Set((level.holes || []).map((h) => `${h.x},${h.y}`));
  checkBoard(game, holes, `${label} (start)`);
  let actions = 0;
  while (game.status === 'playing') {
    const action = randomAction(game, rng);
    assert.ok(action, `${label}: no legal action but game still playing`);
    const events = act(game, action);
    assert.notEqual(events[0].type, 'invalid', `${label}: legal action refused`);
    if (watch) watch(events);
    actions++;
    // A game can never take more actions than it has moves. This is also the
    // sanity counter: an engine that stopped using up moves would fail here.
    assert.ok(actions <= level.moves, `${label}: more actions than moves`);
    assert.ok(game.movesLeft >= 0);
    // Targets never run past what they asked for.
    for (const t of game.targets) assert.ok(t.have >= 0 && t.have <= t.need, `${label}: target overshot`);
    checkBoard(game, holes, label);
  }
}

test('300 random games never break the board', () => {
  const rng = makeRng(2026);
  const results = { won: 0, lost: 0 };
  for (let i = 0; i < 300; i++) {
    const level = generateLevel(1 + (i % 60));
    const game = newGame(level, 1000 + i);
    playOut(game, rng, `level ${level.n}`);
    results[game.status]++;
  }
  console.log(`soak: ${results.won} won, ${results.lost} lost with random play`);
});

// ---- Hand-made obstacle levels ---------------------------------------------

// Every obstacle kind in config/obstacles.js plus droppers, in three layouts.
const B = (x, y, kind, extra = {}) => ({ x, y, kind, ...extra });

const OBSTACLE_LEVELS = [
  // A: a full wall of blocks across the middle (one of nearly every kind), so
  // the lower half can only be refilled once blocks break, partly by
  // diagonal slides.
  {
    n: 9001, tier: 0, cols: 9, rows: 9, colors: 4, moves: 30,
    holes: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }, { x: 8, y: 8 }],
    targets: [{ color: 0, need: 999 }],
    blocks: [
      B(0, 4, 'crate'), B(1, 4, 'hatbox'), B(2, 4, 'trunk'), B(3, 4, 'paint', { color: 1 }),
      B(4, 4, 'dryice'), B(5, 4, 'cashbox'), B(6, 4, 'flat'), B(7, 4, 'strongbox'),
      B(8, 4, 'costume'), B(4, 6, 'padlock'),
    ],
    drops: [{ x: 2, y: 0 }, { x: 6, y: 0 }],
  },
  // B: scattered blocks, holes in the middle, obstacle and sandbag targets.
  {
    n: 9002, tier: 0, cols: 8, rows: 9, colors: 4, moves: 35,
    holes: [{ x: 3, y: 4 }, { x: 4, y: 4 }, { x: 0, y: 8 }],
    targets: [{ block: 'crate', need: 4 }, { block: 'sandbag', need: 3 }, { block: 'flat', need: 2 }],
    blocks: [
      B(1, 2, 'crate'), B(6, 2, 'crate'), B(1, 6, 'crate'), B(6, 6, 'crate'),
      B(3, 2, 'flat'), B(4, 2, 'flat'), B(2, 5, 'hatbox'), B(5, 5, 'trunk'),
      B(3, 7, 'paint', { color: 0 }), B(4, 7, 'paint', { color: 3 }),
      B(0, 3, 'dryice'), B(7, 3, 'dryice'), B(2, 8, 'cashbox'), B(5, 8, 'strongbox'),
      B(3, 6, 'costume'), B(4, 6, 'padlock', { inside: { t: 'power', kind: 'show' } }),
      B(7, 7, 'padlock', { inside: { t: 'block', kind: 'hatbox' } }),
    ],
    drops: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 7, y: 0 }],
  },
  // C: a small five-color board with sealed pockets (power-only blocks on top
  // of cells) and droppers that start in the middle of the board.
  {
    n: 9003, tier: 0, cols: 7, rows: 8, colors: 5, moves: 25,
    holes: [{ x: 3, y: 0 }, { x: 3, y: 7 }],
    targets: [{ block: 'costume', need: 2 }, { color: 2, need: 40 }],
    blocks: [
      B(0, 5, 'cashbox'), B(1, 5, 'flat'), B(5, 5, 'strongbox'), B(6, 5, 'padlock'),
      B(2, 3, 'costume'), B(4, 3, 'costume'), B(3, 3, 'trunk'),
      B(0, 1, 'hatbox'), B(6, 1, 'crate'), B(3, 5, 'paint', { color: 4 }), B(2, 6, 'dryice'),
    ],
    drops: [{ x: 1, y: 0 }, { x: 5, y: 2 }, { x: 4, y: 6 }],
  },
];

test('200 random games on obstacle levels never break the board', () => {
  // Make sure the three layouts really do cover every obstacle kind.
  const used = new Set(OBSTACLE_LEVELS.flatMap((l) => l.blocks.map((b) => b.kind)));
  assert.deepEqual([...used].sort(), Object.keys(OBSTACLES).sort());

  const rng = makeRng(1116);
  const results = { won: 0, lost: 0 };
  // Count what happens, to be sure the games really exercise the obstacles.
  const seen = { hits: 0, destroyed: {}, collected: 0 };
  const watch = (events) => {
    for (const e of events) {
      if (e.type === 'block') {
        seen.hits++;
        if (e.destroyed) seen.destroyed[e.kind] = (seen.destroyed[e.kind] || 0) + 1;
      } else if (e.type === 'collect') seen.collected++;
    }
  };
  for (let i = 0; i < 200; i++) {
    const level = OBSTACLE_LEVELS[i % OBSTACLE_LEVELS.length];
    const game = newGame(level, 5000 + i);
    playOut(game, rng, `obstacle level ${level.n}`, watch);
    results[game.status]++;
  }
  assert.ok(seen.hits > 0 && seen.collected > 0, 'the games hit blocks and collected droppers');
  for (const kind of Object.keys(OBSTACLES)) {
    assert.ok(seen.destroyed[kind] > 0, `no ${kind} was ever destroyed in 200 games`);
  }
  console.log(
    `obstacle soak: ${results.won} won, ${results.lost} lost; ${seen.hits} block hits, ` +
    `${seen.collected} droppers collected; destroyed: ${JSON.stringify(seen.destroyed)}`,
  );
});
