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
import {
  get, cloneBoard, isEmpty, isPower, isPiece, isBlock, isDrop, isPart, obstacleDef, footprint, floorAt,
} from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { OBSTACLES, OBSTACLES2, FLOORS, BATCH2_READY } from '../config/obstacles.js';

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
      const floor = floorAt(board, x, y);
      assert.ok(floor === null || FLOORS[floor], `${label}: strange floor at ${x},${y}`);
      if (isEmpty(cell)) empties++;
      else if (isBlock(cell)) {
        const def = obstacleDef(cell.kind);
        assert.ok(def, `${label}: unknown block kind`);
        // Generators, color-list blocks and curtains have no hit list; their
        // hp only has to be at least 1.
        const most = def.hits.length || (cell.colors ? cell.colors.length : 1);
        assert.ok(cell.hp >= 1 && cell.hp <= most, `${label}: bad hp at ${x},${y}`);
        // Every other cell of a big block must be a part pointing back at it.
        for (const p of footprint(cell, x, y)) {
          if (p.x === x && p.y === y) continue;
          assert.deepEqual(get(board, p.x, p.y), { t: 'part', ax: x, ay: y }, `${label}: big block at ${x},${y} lost a part`);
        }
      } else if (isPart(cell)) {
        // A part must belong to a block that really covers it.
        const owner = get(board, cell.ax, cell.ay);
        assert.ok(isBlock(owner), `${label}: orphan part at ${x},${y}`);
        assert.ok(
          footprint(owner, cell.ax, cell.ay).some((p) => p.x === x && p.y === y),
          `${label}: part at ${x},${y} outside its block`,
        );
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

// ---- Hand-made batch-2 levels (docs/OBSTACLES2.md) --------------------------

const F = (x, y, kind) => ({ x, y, kind });

const BATCH2_LEVELS = [
  // D: every batch-2 block kind on one 9x9 board, with both kinds of floor.
  {
    n: 9101, tier: 0, cols: 9, rows: 9, colors: 4, moves: 35,
    holes: [{ x: 0, y: 0 }, { x: 8, y: 0 }],
    targets: [{ block: 'confetti', need: 8 }, { block: 'dove', need: 3 }, { block: 'candy', need: 3 }, { block: 'planter', need: 1 }],
    blocks: [
      B(0, 3, 'planter'), B(7, 3, 'dovecote'), B(3, 5, 'footlights'), B(5, 2, 'fireworks'),
      B(2, 7, 'truss', { w: 5 }), B(3, 1, 'ticketbooth'), B(2, 2, 'bouquet'),
      B(8, 6, 'tophat'), B(0, 6, 'popper'), B(4, 4, 'candyjar'), B(6, 5, 'makeupcase'),
      B(1, 8, 'curtain', { color: 0, need: 10 }), B(7, 8, 'curtain', { color: 0, need: 10 }),
      B(1, 0, 'curtain', { color: 1, need: 20, inside: { t: 'power', kind: 'show' } }),
    ],
    drops: [],
    floor: [
      F(2, 3, 'confetti'), F(3, 3, 'confetti'), F(4, 3, 'confetti'), F(5, 4, 'confetti'), F(6, 4, 'confetti'),
      F(1, 6, 'confetti'), F(2, 6, 'confetti'), F(6, 6, 'confetti'), F(7, 6, 'confetti'), F(4, 8, 'confetti'),
      F(4, 4, 'confetti'), F(1, 8, 'petals'), F(8, 8, 'petals'), F(0, 8, 'petals'),
    ],
  },
  // E: five colors, holes in the middle, batch-1 blocks and a sandbag mixed in.
  {
    n: 9102, tier: 0, cols: 8, rows: 9, colors: 5, moves: 30,
    holes: [{ x: 3, y: 4 }, { x: 4, y: 4 }, { x: 0, y: 8 }],
    targets: [{ block: 'petals', need: 4 }, { block: 'popcorn', need: 2 }, { block: 'curtain', need: 2 }, { color: 2, need: 30 }],
    blocks: [
      B(0, 1, 'fireworks', { colors: [0, 1] }), B(6, 1, 'fireworks'), B(3, 2, 'bouquet'), B(4, 2, 'bouquet'),
      B(0, 4, 'tophat'), B(7, 4, 'popper'), B(1, 5, 'makeupcase', { open: true }), B(6, 5, 'makeupcase'),
      B(2, 6, 'planter'), B(4, 6, 'footlights', { colors: [0, 1, 2, 3] }), B(6, 7, 'dovecote'),
      B(1, 3, 'candyjar'), B(6, 3, 'candyjar'), B(3, 0, 'truss'), B(1, 8, 'ticketbooth'),
      B(4, 8, 'curtain', { color: 3, need: 8, inside: { t: 'block', kind: 'crate' } }),
      B(5, 8, 'curtain', { color: 3, need: 8 }), B(2, 5, 'hatbox'), B(5, 5, 'padlock'),
    ],
    drops: [{ x: 7, y: 0 }],
    floor: [
      F(3, 3, 'petals'), F(4, 3, 'petals'), F(2, 4, 'petals'), F(5, 4, 'petals'), F(3, 5, 'petals'),
      F(4, 5, 'petals'), F(0, 0, 'confetti'), F(7, 2, 'confetti'), F(3, 2, 'confetti'),
    ],
  },
];

test('150 random games on batch-2 levels never break the board', () => {
  // The two layouts must use every kind the engine says is ready.
  const used = new Set(BATCH2_LEVELS.flatMap((l) => l.blocks.map((b) => b.kind).concat(l.floor.map((f) => f.kind))));
  for (const kind of BATCH2_READY) assert.ok(used.has(kind), `${kind} is in BATCH2_READY but in neither soak level`);
  // Every big block in the layouts really fits (nothing silently left out).
  for (const level of BATCH2_LEVELS) {
    const game = newGame(level, 1);
    for (const b of level.blocks) {
      assert.equal(get(game.board, b.x, b.y).kind, b.kind, `level ${level.n}: ${b.kind} at ${b.x},${b.y} was not placed`);
    }
  }

  const rng = makeRng(1117);
  const results = { won: 0, lost: 0 };
  const seen = { hits: 0, destroyed: {}, collected: {}, floor: {}, toggles: 0, opened: 0 };
  const watch = (events) => {
    for (const e of events) {
      if (e.type === 'block') {
        seen.hits++;
        if (e.destroyed) seen.destroyed[e.kind] = (seen.destroyed[e.kind] || 0) + 1;
        if (e.by === 'count') seen.opened++;
      } else if (e.type === 'collect') seen.collected[e.kind] = (seen.collected[e.kind] || 0) + 1;
      else if (e.type === 'floor') seen.floor[e.kind] = (seen.floor[e.kind] || 0) + 1;
      else if (e.type === 'toggle') seen.toggles++;
    }
  };
  for (let i = 0; i < 150; i++) {
    const level = BATCH2_LEVELS[i % BATCH2_LEVELS.length];
    const game = newGame(level, 7000 + i);
    playOut(game, rng, `batch-2 level ${level.n}`, watch);
    results[game.status]++;
  }
  // Be sure the games really exercised the new rules.
  assert.ok(seen.floor.confetti > 0 && seen.floor.petals > 0, 'floor was removed');
  for (const kind of ['dove', 'popcorn', 'candy']) assert.ok(seen.collected[kind] > 0, `no ${kind} was ever collected`);
  assert.ok(seen.toggles > 0, 'makeup cases flipped');
  assert.ok(seen.opened > 0, 'curtains opened');
  for (const kind of Object.keys(OBSTACLES2)) {
    if (OBSTACLES2[kind].generator || OBSTACLES2[kind].twist) continue; // generators never break; twists have their own tests
    assert.ok(seen.destroyed[kind] > 0, `no ${kind} was ever destroyed in 150 games`);
  }
  console.log(
    `batch-2 soak: ${results.won} won, ${results.lost} lost; ${seen.hits} block hits; ` +
    `destroyed: ${JSON.stringify(seen.destroyed)}; collected: ${JSON.stringify(seen.collected)}; ` +
    `floor: ${JSON.stringify(seen.floor)}; ${seen.toggles} toggles`,
  );
});
