// Tests for the second batch of obstacles (docs/OBSTACLES2.md), in the spec's
// priority order: floor + bouquet, generators + candy jar, big blocks,
// color-list blocks, makeup case, curtain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  get, set, block, piece, power, EMPTY, cloneBoard, placeBlock, floorAt, setFloor,
  hitBlockEvents, hitBlock, takesHit, isPart, isBlock, isEmpty, isPower, anchorOf,
} from '../engine/board.js';
import { settle } from '../engine/resolve.js';
import { fire } from '../engine/powers.js';
import { findLegalMoves } from '../engine/moves.js';
import { newGame, act, serialize, deserialize } from '../engine/game.js';
import { D1 } from '../engine/drops.js';
import { makeRng } from '../engine/rng.js';
import { OBSTACLES2, BATCH2_READY, FLOORS } from '../config/obstacles.js';
import { boardFrom, quietBoard } from './helpers.js';

const ctx = () => ({ colors: 5, rng: makeRng(3), dropRule: D1 });

// A small board with exactly one move that makes a match: swapping (2,0) with
// (2,1) lines up three 0s at (0,1), (1,1), (2,1).
const SWAP_ROWS = ['1203', '0034', '1241'];
const SWAP = { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } };

// A game whose board is replaced by a hand-made one.
function gameOn(rows, targets = [{ color: 4, need: 999 }]) {
  // `rows` is either rows of text (see helpers.js) or a ready-made board.
  const board = Array.isArray(rows) ? boardFrom(rows) : rows;
  const level = {
    n: 1, tier: 0, cols: board.cols, rows: board.rows, colors: 5, moves: 20,
    holes: [], targets, blocks: [], drops: [],
  };
  const game = newGame(level, 7);
  game.board = board;
  return game;
}

// The events up to (not including) the first time anything falls.
const beforeFall = (events) => events.slice(0, events.findIndex((e) => e.type === 'fall'));

// ---- 1. Floor + bouquet -----------------------------------------------------

test('config lists every batch-2 kind with a size; BATCH2_READY names real kinds', () => {
  for (const [kind, def] of Object.entries(OBSTACLES2)) {
    assert.ok(def.name && Array.isArray(def.size) && Array.isArray(def.hits), kind);
  }
  for (const kind of BATCH2_READY) assert.ok(OBSTACLES2[kind] || FLOORS[kind], kind);
});

test('a new board has an all-null floor, and cloneBoard copies it', () => {
  const board = boardFrom(['12', '34']);
  assert.deepEqual(board.floor, [null, null, null, null]);
  setFloor(board, 1, 0, 'confetti');
  const copy = cloneBoard(board);
  setFloor(board, 1, 0, null);
  assert.equal(floorAt(copy, 1, 0), 'confetti');
  assert.equal(floorAt(board, 1, 0), null);
});

test('a board with no floor layer at all still works (old saves)', () => {
  const board = boardFrom(['1234', '2341', '0001']);
  delete board.floor;
  assert.equal(floorAt(board, 0, 0), null);
  const events = settle(board, ctx());
  assert.ok(events.some((e) => e.type === 'clear'));
  assert.ok(!events.some((e) => e.type === 'floor'));
  assert.equal(cloneBoard(board).floor, undefined);
});

test('floor is removed when the piece on it is matched', () => {
  const board = boardFrom(['1234', '2341', '0001']);
  setFloor(board, 0, 2, 'confetti');
  setFloor(board, 3, 0, 'petals'); // nothing is cleared here in the first pass
  const first = beforeFall(settle(board, ctx()));
  assert.deepEqual(first.filter((e) => e.type === 'floor'), [{ type: 'floor', x: 0, y: 2, kind: 'confetti' }]);
  assert.equal(floorAt(board, 0, 2), null);
});

test('floor is removed by a power-up blast, including under the power-up itself', () => {
  const board = boardFrom(['H123', '2341']);
  setFloor(board, 0, 0, 'petals');
  setFloor(board, 2, 0, 'confetti');
  setFloor(board, 2, 1, 'confetti'); // not in the blast
  const events = fire(board, { x: 0, y: 0 }, { rng: makeRng(1) });
  const floors = events.filter((e) => e.type === 'floor');
  assert.deepEqual(floors, [
    { type: 'floor', x: 0, y: 0, kind: 'petals' },
    { type: 'floor', x: 2, y: 0, kind: 'confetti' },
  ]);
  assert.equal(floorAt(board, 2, 1), 'confetti');
});

test('floor under a block goes only when the block is destroyed', () => {
  const board = boardFrom(['1h3']);
  setFloor(board, 1, 0, 'confetti');
  assert.equal(hitBlockEvents(board, 1, 0, 'match', 0).length, 1);
  assert.equal(floorAt(board, 1, 0), 'confetti');
  const events = hitBlockEvents(board, 1, 0, 'power');
  assert.equal(events[0].destroyed, true);
  assert.deepEqual(events[1], { type: 'floor', x: 1, y: 0, kind: 'confetti' });
  assert.equal(floorAt(board, 1, 0), null);
});

test('a bouquet takes two hits of any kind, then lays petals on itself and its open neighbours', () => {
  const board = boardFrom(['#1#', 'c23', '141']);
  placeBlock(board, 1, 1, 'bouquet');
  // Neighbours of (1,1): up is a piece, left is a crate, right and down are pieces.
  set(board, 1, 0, null); // make "up" a hole instead
  assert.equal(hitBlockEvents(board, 1, 1, 'power')[0].hpLeft, 1);
  const events = hitBlockEvents(board, 1, 1, 'match', 2);
  assert.equal(events[0].destroyed, true);
  assert.deepEqual(events[1], { type: 'spread', kind: 'petals', cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }] });
  assert.ok(isEmpty(get(board, 1, 1)));
  assert.equal(floorAt(board, 1, 1), 'petals');
  assert.equal(floorAt(board, 2, 1), 'petals');
  assert.equal(floorAt(board, 1, 2), 'petals');
  assert.equal(floorAt(board, 0, 1), null, 'not under the crate');
  assert.equal(floorAt(board, 1, 0), null, 'not on the hole');
});

test('newGame places level.floor, and a save round-trips it', () => {
  const level = {
    n: 1, tier: 0, cols: 6, rows: 6, colors: 4, moves: 10, holes: [{ x: 0, y: 0 }],
    targets: [{ block: 'confetti', need: 2 }],
    floor: [{ x: 0, y: 0, kind: 'confetti' }, { x: 1, y: 1, kind: 'confetti' }, { x: 2, y: 2, kind: 'petals' }],
  };
  const game = newGame(level, 5);
  assert.equal(floorAt(game.board, 0, 0), null, 'no floor on a hole');
  assert.equal(floorAt(game.board, 1, 1), 'confetti');
  assert.equal(floorAt(game.board, 2, 2), 'petals');
  assert.deepEqual(game.targets, [{ block: 'confetti', need: 2, have: 0 }]);
  const saved = JSON.parse(JSON.stringify(serialize(game)));
  const back = deserialize(saved);
  assert.deepEqual(back.board.floor, game.board.floor);
  // An old save without a floor layer loads as all null.
  delete saved.board.floor;
  assert.ok(deserialize(saved).board.floor.every((f) => f === null));
});

test('removed floor counts toward a confetti / petals target', () => {
  const game = gameOn(SWAP_ROWS, [{ block: 'confetti', need: 2 }, { block: 'petals', need: 5 }]);
  setFloor(game.board, 0, 1, 'confetti');
  setFloor(game.board, 1, 1, 'confetti');
  setFloor(game.board, 2, 1, 'petals');
  act(game, SWAP);
  assert.equal(game.targets[0].have, 2);
  assert.equal(game.targets[1].have, 1);
  assert.equal(game.status, 'playing');
});

test('a Ninja Star flies to a cell whose floor the level still needs', () => {
  const game = gameOn(quietBoard(5, 5), [{ block: 'petals', need: 1 }]);
  set(game.board, 0, 0, power('under'));
  setFloor(game.board, 4, 4, 'petals');
  const events = act(game, { type: 'tap', at: { x: 0, y: 0 } });
  assert.deepEqual(events.find((e) => e.type === 'fly').to, { x: 4, y: 4 });
  assert.equal(game.status, 'won');
});

// ---- 2. Generators + candy jar ----------------------------------------------

test('a top hat gives a dove on every third match hit and never breaks', () => {
  const board = boardFrom(['1.3']);
  placeBlock(board, 1, 0, 'tophat');
  const kinds = [];
  for (let i = 1; i <= 7; i++) {
    const events = hitBlockEvents(board, 1, 0, 'match', 0);
    assert.equal(events[0].type, 'block');
    assert.equal(events[0].destroyed, false);
    assert.equal(events[0].count, i);
    kinds.push(events.length === 2 ? events[1].kind : '-');
    if (events.length === 2) assert.deepEqual(events[1], { type: 'collect', x: 1, y: 0, kind: 'dove' });
  }
  assert.deepEqual(kinds, ['-', '-', 'dove', '-', '-', 'dove', '-']);
  assert.equal(get(board, 1, 0).count, 7);
  assert.equal(get(board, 1, 0).hp, 1);
  // A power hit does nothing at all.
  assert.deepEqual(hitBlockEvents(board, 1, 0, 'power'), []);
  assert.equal(takesHit(get(board, 1, 0), 'power'), false);
});

test('a popcorn cart works the same way and gives popcorn', () => {
  const board = boardFrom(['1.3']);
  placeBlock(board, 1, 0, 'popper');
  hitBlockEvents(board, 1, 0, 'match', 0);
  hitBlockEvents(board, 1, 0, 'match', 1);
  assert.deepEqual(hitBlockEvents(board, 1, 0, 'match', 2)[1], { type: 'collect', x: 1, y: 0, kind: 'popcorn' });
});

test('a candy jar gives a candy on each of its three hits, then is gone', () => {
  const board = boardFrom(['1.3']);
  placeBlock(board, 1, 0, 'candyjar');
  for (const [by, left] of [['match', 2], ['power', 1], ['match', 0]]) {
    const events = hitBlockEvents(board, 1, 0, by, 0);
    assert.equal(events[0].hpLeft, left);
    assert.equal(events[0].destroyed, left === 0);
    assert.deepEqual(events[1], { type: 'collect', x: 1, y: 0, kind: 'candy' });
  }
  assert.ok(isEmpty(get(board, 1, 0)));
});

test('doves, popcorn and candy count toward their targets during play', () => {
  const game = gameOn(SWAP_ROWS, [{ block: 'dove', need: 1 }, { block: 'candy', need: 9 }, { block: 'popcorn', need: 9 }]);
  set(game.board, 0, 2, block('tophat', { count: 2 })); // one more match hit = a dove
  set(game.board, 1, 2, block('candyjar'));
  set(game.board, 3, 1, block('popper'));
  const events = act(game, SWAP);
  const first = beforeFall(events);
  assert.equal(first.filter((e) => e.type === 'collect' && e.kind === 'dove').length, 1);
  assert.equal(first.filter((e) => e.type === 'collect' && e.kind === 'candy').length, 1);
  assert.equal(game.targets[0].have, 1);
  assert.ok(game.targets[1].have >= 1);
  assert.equal(get(game.board, 3, 1).kind, 'popper');
  assert.ok(get(game.board, 3, 1).count >= 1);
});

test('a Ninja Star goes for a candy jar directly, but for the piece NEXT to a generator', () => {
  const jar = gameOn(quietBoard(5, 5), [{ block: 'candy', need: 3 }]);
  set(jar.board, 0, 0, power('under'));
  set(jar.board, 4, 4, block('candyjar'));
  assert.deepEqual(act(jar, { type: 'tap', at: { x: 0, y: 0 } }).find((e) => e.type === 'fly').to, { x: 4, y: 4 });
  assert.equal(jar.targets[0].have, 1);

  const hat = gameOn(quietBoard(5, 5), [{ block: 'dove', need: 3 }]);
  set(hat.board, 0, 0, power('under'));
  set(hat.board, 4, 4, block('tophat'));
  const to = act(hat, { type: 'tap', at: { x: 0, y: 0 } }).find((e) => e.type === 'fly').to;
  assert.ok((to.x === 3 && to.y === 4) || (to.x === 4 && to.y === 3), `flew to ${to.x},${to.y}`);
});

// ---- 3. Big blocks ----------------------------------------------------------

test('placeBlock lays an anchor and parts; it refuses to hang over an edge or a hole', () => {
  const board = quietBoard(5, 5);
  const before = cloneBoard(board);
  assert.equal(placeBlock(board, 4, 4, 'planter'), null);
  set(board, 1, 1, null);
  assert.equal(placeBlock(board, 0, 0, 'planter'), null);
  set(board, 1, 1, before.cells[6]);
  assert.deepEqual(board.cells, before.cells, 'a refused block changes nothing');

  const cell = placeBlock(board, 1, 2, 'planter');
  assert.deepEqual(cell, { t: 'block', kind: 'planter', hp: 5, w: 2, h: 2 });
  assert.equal(get(board, 1, 2), cell);
  for (const [x, y] of [[2, 2], [1, 3], [2, 3]]) assert.deepEqual(get(board, x, y), { t: 'part', ax: 1, ay: 2 });
  assert.deepEqual(anchorOf(board, 2, 3), { x: 1, y: 2, cell });

  const truss = placeBlock(board, 0, 0, 'truss', { w: 4 });
  assert.equal(truss.w, 4);
  assert.equal(truss.h, 1);
  assert.ok(isPart(get(board, 3, 0)) && !isPart(get(board, 4, 0)));
  // Fireworks are two cells wide and one high.
  const fw = placeBlock(board, 3, 4, 'fireworks', { colors: [1, 2, 3] });
  assert.equal(fw.w, 2);
  assert.ok(isPart(get(board, 4, 4)));
});

test('a planter takes 5 match hits (through any part), then leaves four empty cells with confetti', () => {
  const board = quietBoard(4, 4);
  placeBlock(board, 1, 1, 'planter');
  assert.deepEqual(hitBlockEvents(board, 2, 2, 'power'), [], 'power hits do nothing');
  for (let i = 4; i >= 1; i--) assert.equal(hitBlockEvents(board, 2, 2, 'match', 0)[0].hpLeft, i);
  const events = hitBlockEvents(board, 1, 2, 'match', 0);
  assert.deepEqual(events[0], { type: 'block', x: 1, y: 1, kind: 'planter', hpLeft: 0, destroyed: true, by: 'match', w: 2, h: 2 });
  assert.equal(events[1].type, 'spread');
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
    assert.ok(isEmpty(get(board, x, y)));
    assert.equal(floorAt(board, x, y), 'confetti');
  }
});

test('one group touching two cells of a big block hits it once', () => {
  // The three 0s on the bottom row touch both lower cells of the dovecote.
  const board = boardFrom(['1..3', '2..4', '0001']);
  placeBlock(board, 1, 0, 'dovecote');
  const first = beforeFall(settle(board, ctx()));
  const hits = first.filter((e) => e.type === 'block');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].hpLeft, 4);
  assert.deepEqual([hits[0].x, hits[0].y], [1, 0]);
});

test('a truss takes one power hit per blast, however many of its cells the blast covers', () => {
  const board = boardFrom(['H....', '12341', 'V2341']);
  placeBlock(board, 1, 0, 'truss', { w: 4 });
  const one = fire(board, { x: 0, y: 0 }, { rng: makeRng(1) }).filter((e) => e.type === 'block');
  assert.equal(one.length, 1);
  assert.equal(one[0].hpLeft, 1);
  assert.deepEqual(hitBlockEvents(board, 2, 0, 'match', 1), [], 'match hits do nothing');
  const two = hitBlockEvents(board, 4, 0, 'power');
  assert.equal(two[0].destroyed, true);
  for (let x = 1; x <= 4; x++) assert.ok(isEmpty(get(board, x, 0)));
});

test('a dovecote counts toward its target when destroyed', () => {
  const game = gameOn(SWAP_ROWS.concat(['....', '....']), [{ block: 'dovecote', need: 1 }]);
  // Rows 3-4 hold the dovecote, right under the board's bottom pieces... so
  // put it where the match at (0..2, 1) touches it instead:
  const board = boardFrom(['1203', '0034', '..41', '..23']);
  const game2 = gameOn(board, [{ block: 'dovecote', need: 1 }]);
  placeBlock(board, 0, 2, 'dovecote');
  set(board, 0, 2, { ...get(board, 0, 2), hp: 1 });
  act(game2, SWAP);
  assert.equal(game2.targets[0].have, 1);
  assert.equal(game2.status, 'won');
  assert.equal(game.status, 'playing');
});

test('a ticket booth needs a power hit, then three matches, then becomes three power-ups', () => {
  const board = boardFrom(['1...1', '23412']);
  placeBlock(board, 1, 0, 'ticketbooth');
  assert.deepEqual(hitBlockEvents(board, 2, 0, 'match', 0), []);
  assert.equal(hitBlockEvents(board, 2, 0, 'power')[0].hpLeft, 3);
  assert.deepEqual(hitBlockEvents(board, 2, 0, 'power'), []);
  hitBlockEvents(board, 3, 0, 'match', 0);
  hitBlockEvents(board, 3, 0, 'match', 0);
  const last = hitBlockEvents(board, 1, 0, 'match', 0, makeRng(4));
  assert.equal(last[0].destroyed, true);
  for (let x = 1; x <= 3; x++) assert.ok(isPower(get(board, x, 0)));
});

test('parts are fixed: nothing falls through them, and they cannot be swapped or tapped', () => {
  // A truss right across the board seals the empty row under it.
  const board = boardFrom(['1234', '....', '....', '2341']);
  placeBlock(board, 0, 1, 'truss', { w: 4 });
  assert.deepEqual(settle(board, ctx()), []);
  for (let x = 0; x < 4; x++) assert.ok(isEmpty(get(board, x, 2)));

  const game = gameOn(boardFrom(['1203', '0034', '1241', '....']));
  placeBlock(game.board, 0, 3, 'truss', { w: 4 });
  const before = JSON.stringify(game.board.cells);
  assert.deepEqual(act(game, { type: 'swap', a: { x: 1, y: 2 }, b: { x: 1, y: 3 } }), [{ type: 'invalid' }]);
  assert.deepEqual(act(game, { type: 'tap', at: { x: 1, y: 3 } }), [{ type: 'invalid' }]);
  assert.equal(JSON.stringify(game.board.cells), before);
  for (const m of findLegalMoves(game.board)) {
    assert.ok(m.a.y < 3 && m.b.y < 3, 'no legal move involves a part or an anchor');
  }
});

test('newGame places big blocks from the level, and a save round-trips them', () => {
  const level = {
    n: 1, tier: 0, cols: 8, rows: 8, colors: 4, moves: 10, holes: [],
    targets: [{ block: 'planter', need: 1 }],
    blocks: [
      { x: 0, y: 0, kind: 'planter' }, { x: 3, y: 3, kind: 'dovecote' },
      { x: 2, y: 6, kind: 'truss', w: 5 }, { x: 5, y: 0, kind: 'ticketbooth' },
      { x: 7, y: 7, kind: 'planter' }, // does not fit: ignored
    ],
  };
  const game = newGame(level, 11);
  const b = game.board;
  assert.equal(get(b, 0, 0).kind, 'planter');
  assert.deepEqual(get(b, 1, 1), { t: 'part', ax: 0, ay: 0 });
  assert.equal(get(b, 2, 6).w, 5);
  assert.deepEqual(get(b, 6, 6), { t: 'part', ax: 2, ay: 6 });
  assert.deepEqual(get(b, 7, 0), { t: 'part', ax: 5, ay: 0 });
  assert.equal(get(b, 7, 7).t, 'piece');
  const back = deserialize(JSON.parse(JSON.stringify(serialize(game))));
  assert.deepEqual(back.board.cells, b.cells);
});

// ---- 4. Color-list blocks ---------------------------------------------------

test('footlights lose one listed color per matching group, and the first color per power hit', () => {
  const board = quietBoard(4, 4);
  const cell = placeBlock(board, 1, 1, 'footlights', { colors: [0, 1, 2, 3] });
  assert.equal(cell.hp, 4);
  assert.deepEqual(hitBlockEvents(board, 2, 2, 'match', 4), [], 'a color not on the list does nothing');
  let ev = hitBlockEvents(board, 2, 2, 'match', 2)[0];
  assert.equal(ev.color, 2);
  assert.equal(ev.hpLeft, 3);
  assert.deepEqual(get(board, 1, 1).colors, [0, 1, 3]);
  assert.deepEqual(hitBlockEvents(board, 1, 2, 'match', 2), [], 'that color is done');
  ev = hitBlockEvents(board, 1, 2, 'power')[0];
  assert.equal(ev.color, 0);
  assert.deepEqual(get(board, 1, 1).colors, [1, 3]);
  assert.equal(get(board, 1, 1).hp, 2);
  hitBlockEvents(board, 1, 1, 'match', 3);
  ev = hitBlockEvents(board, 1, 1, 'match', 1)[0];
  assert.equal(ev.destroyed, true);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) assert.ok(isEmpty(get(board, x, y)));
});

test('fireworks blast like a Grenade when a match takes their last color', () => {
  // The 0s on row 3 sit under the fireworks (anchor 1,2). The blast is the 5x5
  // square around the anchor.
  const board = boardFrom(['12341234', '23412341', '3..23412', '40003123', '12341234', '23412341']);
  placeBlock(board, 1, 2, 'fireworks', { colors: [0] });
  set(board, 3, 1, power('spot-v')); // caught in the blast: it goes off too
  set(board, 0, 0, block('crate')); // in the blast: takes a power hit
  const first = beforeFall(settle(board, ctx()));
  const hit = first.find((e) => e.type === 'block' && e.kind === 'fireworks');
  assert.equal(hit.destroyed, true);
  assert.equal(hit.blast, true);
  const boom = first.find((e) => e.type === 'clear' && e.cause === 'fireworks');
  assert.ok(boom, 'a clear event with cause fireworks');
  assert.ok(boom.cells.every((c) => Math.abs(c.x - 1) <= 2 && Math.abs(c.y - 2) <= 2));
  assert.ok(boom.cells.some((c) => c.x === 3 && c.y === 4));
  assert.ok(first.some((e) => e.type === 'block' && e.kind === 'crate' && e.by === 'power'));
  assert.ok(first.some((e) => e.type === 'clear' && e.cause === 'spot-v'), 'the Spotlight in the blast fired');
});

test('fireworks broken by a power-up blast go off in the same chain', () => {
  const board = boardFrom(['12341', 'H..23', '34123', '41234']);
  placeBlock(board, 1, 1, 'fireworks', { colors: [2] });
  const events = fire(board, { x: 0, y: 1 }, { rng: makeRng(1) });
  assert.ok(events.find((e) => e.type === 'block' && e.kind === 'fireworks').blast);
  const boom = events.find((e) => e.type === 'clear' && e.cause === 'fireworks');
  assert.ok(boom && boom.cells.some((c) => c.x === 1 && c.y === 3));
});

test('newGame gives a color-list block its colors (from the level, or drawn at random)', () => {
  const level = {
    n: 1, tier: 0, cols: 8, rows: 8, colors: 4, moves: 10, holes: [], targets: [{ block: 'footlights', need: 1 }],
    blocks: [{ x: 0, y: 0, kind: 'footlights' }, { x: 4, y: 4, kind: 'fireworks', colors: [3, 3, 1] }],
  };
  const game = newGame(level, 2);
  assert.deepEqual([...get(game.board, 0, 0).colors].sort(), [0, 1, 2, 3]);
  assert.deepEqual(get(game.board, 4, 4).colors, [3, 3, 1]);
  assert.equal(get(game.board, 4, 4).hp, 3);
});

// ---- 5. Makeup case ---------------------------------------------------------

test('a makeup case only takes a match hit, and only while open', () => {
  const board = boardFrom(['1.3']);
  placeBlock(board, 1, 0, 'makeupcase');
  assert.equal(get(board, 1, 0).open, false);
  assert.deepEqual(hitBlockEvents(board, 1, 0, 'match', 0), []);
  set(board, 1, 0, block('makeupcase', { open: true }));
  assert.deepEqual(hitBlockEvents(board, 1, 0, 'power'), []);
  assert.equal(hitBlock(board, 1, 0, 'match', 0).destroyed, true);
  assert.ok(isEmpty(get(board, 1, 0)));
});

test('every makeup case flips after each accepted move, with a toggle event and a frame', () => {
  const game = gameOn(SWAP_ROWS.concat(['3412']), [{ block: 'makeupcase', need: 2 }]);
  set(game.board, 3, 3, block('makeupcase')); // closed, away from the match
  set(game.board, 3, 1, block('makeupcase', { open: true })); // open, next to the match: destroyed
  // A move that is refused flips nothing.
  assert.deepEqual(act(game, { type: 'swap', a: { x: 0, y: 3 }, b: { x: 1, y: 3 } }), [{ type: 'invalid' }]);
  assert.equal(get(game.board, 3, 3).open, false);
  const events = act(game, SWAP);
  assert.ok(events.some((e) => e.type === 'block' && e.kind === 'makeupcase' && e.destroyed));
  assert.equal(game.targets[0].have, 1);
  const i = events.findIndex((e) => e.type === 'toggle');
  assert.ok(i > 0);
  assert.deepEqual(events[i].cells, [{ x: 3, y: 3, open: true }]);
  assert.equal(events[i + 1].type, 'frame');
  assert.equal(get(events[i + 1].board, 3, 3).open, true);
  assert.equal(get(game.board, 3, 3).open, true);
});

test('a board without makeup cases gets no toggle event', () => {
  const game = gameOn(SWAP_ROWS);
  assert.ok(!act(game, SWAP).some((e) => e.type === 'toggle'));
});

// ---- 6. Curtain -------------------------------------------------------------

test('a curtain takes no hits of any kind', () => {
  const board = boardFrom(['1.3']);
  set(board, 1, 0, block('curtain', { color: 0, need: 5 }));
  assert.deepEqual(get(board, 1, 0), { t: 'block', kind: 'curtain', hp: 1, color: 0, need: 5 });
  assert.deepEqual(hitBlockEvents(board, 1, 0, 'match', 0), []);
  assert.deepEqual(hitBlockEvents(board, 1, 0, 'power'), []);
});

test('all curtains of a color open together once enough of that color is cleared', () => {
  const game = gameOn(SWAP_ROWS.concat(['3412']), [{ block: 'curtain', need: 2 }]);
  set(game.board, 0, 3, block('curtain', { color: 0, need: 3, inside: power('show') }));
  set(game.board, 3, 3, block('curtain', { color: 0, need: 3 }));
  set(game.board, 2, 3, block('curtain', { color: 0, need: 500 })); // needs far more
  set(game.board, 1, 3, block('curtain', { color: 3, need: 400 })); // another color
  setFloor(game.board, 3, 3, 'petals');
  const events = act(game, SWAP);
  const opened = events.filter((e) => e.type === 'block' && e.by === 'count');
  assert.deepEqual(opened, [
    { type: 'block', x: 0, y: 3, kind: 'curtain', hpLeft: 0, destroyed: true, by: 'count' },
    { type: 'block', x: 3, y: 3, kind: 'curtain', hpLeft: 0, destroyed: true, by: 'count' },
  ]);
  // The snapshot right after shows what was behind them; then falling runs.
  const i = events.indexOf(opened[1]);
  const frame = events.slice(i).find((e) => e.type === 'frame');
  assert.deepEqual(get(frame.board, 0, 3), power('show'));
  assert.ok(isEmpty(get(frame.board, 3, 3)));
  assert.ok(events.slice(i).some((e) => e.type === 'floor' && e.x === 3 && e.y === 3));
  assert.ok(!isEmpty(get(game.board, 3, 3)), 'the opened cell was refilled');
  assert.equal(get(game.board, 2, 3).kind, 'curtain');
  assert.equal(get(game.board, 1, 3).kind, 'curtain');
  assert.equal(game.targets[0].have, 2);
  assert.equal(game.status, 'won');
});

test('newGame places curtains with their color, count and what is behind them', () => {
  const level = {
    n: 1, tier: 0, cols: 6, rows: 6, colors: 4, moves: 10, holes: [], targets: [{ block: 'curtain', need: 2 }],
    blocks: [
      { x: 0, y: 5, kind: 'curtain', color: 2, need: 12 },
      { x: 1, y: 5, kind: 'curtain', color: 2, need: 12, inside: { t: 'block', kind: 'hatbox' } },
      { x: 5, y: 0, kind: 'makeupcase', open: true },
    ],
  };
  const game = newGame(level, 9);
  assert.deepEqual(get(game.board, 0, 5), { t: 'block', kind: 'curtain', hp: 1, color: 2, need: 12 });
  assert.deepEqual(get(game.board, 1, 5).inside, { t: 'block', kind: 'hatbox', hp: 2 });
  assert.equal(get(game.board, 5, 0).open, true);
  const back = deserialize(JSON.parse(JSON.stringify(serialize(game))));
  assert.deepEqual(back.board.cells, game.board.cells);
});
