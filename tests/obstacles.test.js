// Obstacles (blocks) and the sandbag dropper. The rules are in docs/OBSTACLES.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  get, set, piece, power, block, drop,
  isBlock, isDrop, isEmpty, isPiece, isPower, isMovable, POWER_KINDS,
} from '../engine/board.js';
import { settle } from '../engine/resolve.js';
import { fire, combine } from '../engine/powers.js';
import { findGroups } from '../engine/matches.js';
import { findLegalMoves, hasLegalMove } from '../engine/moves.js';
import { newGame, act, serialize, deserialize } from '../engine/game.js';
import { makeRng } from '../engine/rng.js';
import { OBSTACLES } from '../config/obstacles.js';
import { boardFrom, quietBoard } from './helpers.js';

// A drop rule whose new pieces never match anything: every new piece gets a
// color number nobody else has. That keeps each test to exactly the hits it
// sets up (no lucky chain reactions).
function quietCtx() {
  let next = 100;
  return { colors: 5, rng: makeRng(7), dropRule: () => next++ };
}

const events = (list, type) => list.filter((e) => e.type === type);

// ---- board.js helpers --------------------------------------------------------

test('block() takes its hit points from the config; drop() makes the sandbag', () => {
  for (const kind of Object.keys(OBSTACLES)) {
    assert.equal(block(kind).hp, OBSTACLES[kind].hits.length, kind);
  }
  assert.deepEqual(block('paint', { color: 2 }), { t: 'block', kind: 'paint', hp: 1, color: 2 });
  assert.deepEqual(block('padlock', { inside: piece(3) }).inside, piece(3));
  assert.deepEqual(drop(), { t: 'drop', kind: 'sandbag' });
  assert.ok(isBlock(block('crate')) && !isBlock(piece(0)) && !isBlock(null));
  assert.ok(isDrop(drop()) && !isDrop(piece(0)) && !isDrop(null));
  assert.ok(isMovable(piece(0)) && isMovable(power('show')) && isMovable(drop()));
  assert.ok(!isMovable(block('crate')) && !isMovable(null) && !isMovable({ t: 'empty' }));
});

test('boardFrom knows the obstacle letters', () => {
  const b = boardFrom(['chtib', 'fsgd0']);
  const kinds = [0, 1, 2, 3, 4].map((x) => get(b, x, 0).kind);
  assert.deepEqual(kinds, ['crate', 'hatbox', 'trunk', 'dryice', 'cashbox']);
  assert.deepEqual([0, 1, 2].map((x) => get(b, x, 1).kind), ['flat', 'strongbox', 'costume']);
  assert.ok(isDrop(get(b, 3, 1)));
  assert.ok(isPiece(get(b, 4, 1)));
});

// ---- how each obstacle breaks -------------------------------------------------

// A small rig: the block under test sits at the top-left corner.
//   'm' / 'm2'  make a match (of color 0, or the color given) right under it
//   'p'         set off a Missile in its row
// After each step we read how many hits the block still needs (0 = gone).
function hpAfterEach(cell, steps) {
  const board = boardFrom(['X34', '120', '123']);
  set(board, 0, 0, cell);
  const ctx = quietCtx();
  const out = [];
  for (const step of steps) {
    if (step[0] === 'm') {
      const color = step.length > 1 ? Number(step[1]) : 0;
      for (let x = 0; x < 3; x++) set(board, x, 1, piece(color));
      settle(board, ctx);
    } else {
      set(board, 1, 0, power('spot-h'));
      fire(board, { x: 1, y: 0 }, { rng: ctx.rng });
      settle(board, ctx);
    }
    const now = get(board, 0, 0);
    out.push(isBlock(now) ? now.hp : 0);
  }
  return { board, hp: out };
}

test('crate: one hit of either type', () => {
  assert.deepEqual(hpAfterEach(block('crate'), ['m']).hp, [0]);
  assert.deepEqual(hpAfterEach(block('crate'), ['p']).hp, [0]);
});

test('hatbox: two hits; trunk: three; dry ice: one', () => {
  assert.deepEqual(hpAfterEach(block('hatbox'), ['m', 'm']).hp, [1, 0]);
  assert.deepEqual(hpAfterEach(block('hatbox'), ['p', 'm']).hp, [1, 0]);
  assert.deepEqual(hpAfterEach(block('trunk'), ['m', 'p', 'm']).hp, [2, 1, 0]);
  assert.deepEqual(hpAfterEach(block('dryice'), ['p']).hp, [0]);
  assert.deepEqual(hpAfterEach(block('dryice'), ['m']).hp, [0]);
});

test('cash box: a match next to it does nothing, a power-up breaks it', () => {
  assert.deepEqual(hpAfterEach(block('cashbox'), ['m', 'm', 'p']).hp, [1, 1, 0]);
});

test('scenery flat: three power-up hits, matches do nothing', () => {
  assert.deepEqual(hpAfterEach(block('flat'), ['m', 'p', 'm', 'p', 'p']).hp, [3, 2, 2, 1, 0]);
});

test('strongbox: a power-up, then a match (in that order only)', () => {
  assert.deepEqual(hpAfterEach(block('strongbox'), ['m', 'p', 'p', 'm']).hp, [2, 1, 1, 0]);
});

test('paint can: ignores a match of another color, breaks on its own color or a power-up', () => {
  assert.deepEqual(hpAfterEach(block('paint', { color: 2 }), ['m0', 'm1', 'm2']).hp, [1, 1, 0]);
  assert.deepEqual(hpAfterEach(block('paint', { color: 2 }), ['m0', 'p']).hp, [1, 0]);
});

test('costume bag: three hits, then it leaves a power-up', () => {
  const { board, hp } = hpAfterEach(block('costume'), ['m', 'm', 'm']);
  assert.deepEqual(hp, [2, 1, 0]);
  // The new power-up is free to fall, so look for it anywhere on the board.
  const left = board.cells.filter(isPower);
  assert.equal(left.length, 1, 'a power-up is left behind');
  assert.ok(POWER_KINDS.includes(left[0].kind));
});

test('padlock: power-ups only, and it leaves what it held', () => {
  const { board, hp } = hpAfterEach(block('padlock', { inside: piece(3) }), ['m', 'p']);
  assert.deepEqual(hp, [1, 0]);
  assert.deepEqual(get(board, 0, 0), piece(3));
  // A padlock can hold another obstacle.
  const two = hpAfterEach(block('padlock', { inside: block('hatbox') }), ['p']);
  assert.deepEqual(get(two.board, 0, 0), block('hatbox'));
});

test('a hit that lands is reported as a block event', () => {
  const board = boardFrom(['h34', '000', '123']);
  const ev = events(settle(board, quietCtx()), 'block');
  assert.deepEqual(ev, [{ type: 'block', x: 0, y: 0, kind: 'hatbox', hpLeft: 1, destroyed: false, by: 'match' }]);
  set(board, 1, 0, power('spot-h'));
  const ev2 = events(fire(board, { x: 1, y: 0 }, {}), 'block');
  assert.deepEqual(ev2, [{ type: 'block', x: 0, y: 0, kind: 'hatbox', hpLeft: 0, destroyed: true, by: 'power' }]);
});

test('one match touching a block with two of its cells still gives one hit', () => {
  // The 0s make an L that wraps round the hatbox, touching it from above and from the left.
  const board = boardFrom(['000', '0h1', '023']);
  const ev = events(settle(board, quietCtx()), 'block');
  assert.equal(ev.length, 1);
  assert.equal(get(board, 1, 1).hp, 1);
});

test('two separate matches next to one block give two hits', () => {
  const board = boardFrom(['000', '2h3', '111']);
  const ev = events(settle(board, quietCtx()), 'block');
  assert.equal(ev.length, 2);
  assert.ok(!isBlock(get(board, 1, 1)));
});

// ---- power-ups and blocks ------------------------------------------------------

test('a blast covering three hatboxes hits each exactly once', () => {
  const board = boardFrom(['hhHh', '1234']);
  const ev = events(fire(board, { x: 2, y: 0 }, {}), 'block');
  assert.equal(ev.length, 3);
  for (const x of [0, 1, 3]) assert.equal(get(board, x, 0).hp, 1, `hatbox at ${x}`);
});

test('a chained power-up hits the same block again', () => {
  // The first Missile clears the row and sets off the second, whose row blast also covers the hatbox.
  const board = boardFrom(['hHH', '123']);
  const ev = events(fire(board, { x: 1, y: 0 }, {}), 'block');
  assert.deepEqual(ev.map((e) => e.hpLeft), [1, 0]);
  assert.ok(isEmpty(get(board, 0, 0)));
});

test('a Magic Ball color clear hits no blocks', () => {
  const board = boardFrom(['P0c', '0c0', 'c00']);
  const ev = fire(board, { x: 0, y: 0 }, { swapColor: 0 });
  assert.equal(events(ev, 'block').length, 0);
  assert.equal(board.cells.filter(isBlock).length, 3);
  assert.equal(board.cells.filter(isPiece).length, 0);
});

test('Magic Ball + Magic Ball: every block takes one power hit (two when super)', () => {
  const rows = ['PPh', 'cf1', 'bs2'];
  const b1 = boardFrom(rows);
  combine(b1, { x: 0, y: 0 }, { x: 1, y: 0 }, {});
  assert.equal(get(b1, 2, 0).hp, 1, 'hatbox hit once');
  assert.ok(isEmpty(get(b1, 0, 1)), 'crate gone');
  assert.equal(get(b1, 1, 1).hp, 2, 'flat hit once');
  assert.ok(isEmpty(get(b1, 0, 2)), 'cash box gone');
  assert.equal(get(b1, 1, 2).hp, 1, 'strongbox hit once');

  const b2 = boardFrom(rows);
  combine(b2, { x: 0, y: 0 }, { x: 1, y: 0 }, { superPrism: true });
  assert.ok(isEmpty(get(b2, 2, 0)), 'hatbox hit twice');
  assert.equal(get(b2, 1, 1).hp, 1, 'flat hit twice');
  assert.equal(get(b2, 1, 2).hp, 1, 'strongbox: its second hit must be a match');
});

test('a Ninja Star flies to a block the level needs and hits it', () => {
  const board = quietBoard(5, 5);
  set(board, 0, 0, power('under'));
  set(board, 4, 4, block('hatbox'));
  const ev = fire(board, { x: 0, y: 0 }, { rng: makeRng(3), needs: (cell) => isBlock(cell) });
  assert.deepEqual(events(ev, 'fly')[0].to, { x: 4, y: 4 });
  assert.equal(get(board, 4, 4).hp, 1);
});

test('a Ninja Star carrying a Missile gives a needed block one hit and never replaces it', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const board = quietBoard(5, 5);
    set(board, 0, 0, power('under'));
    set(board, 1, 0, power('spot-h'));
    set(board, 2, 4, block('flat'));
    combine(board, { x: 0, y: 0 }, { x: 1, y: 0 }, { rng: makeRng(seed), needs: (cell) => isBlock(cell) });
    const cell = get(board, 2, 4);
    assert.ok(isBlock(cell), `seed ${seed}: the flat is still a block`);
    assert.equal(cell.hp, 2, `seed ${seed}: exactly one hit`);
  }
});

// ---- falling -------------------------------------------------------------------

test('pieces do not fall through a block', () => {
  const board = boardFrom(['1', 'c', '.']);
  const ev = settle(board, quietCtx());
  assert.deepEqual(ev, [], 'nothing can move');
  assert.ok(isEmpty(get(board, 0, 2)), 'the cell under the crate stays empty');
  assert.equal(get(board, 0, 0).color, 1);
});

test('pieces still fall through a hole', () => {
  const board = boardFrom(['1', '#', '.']);
  settle(board, quietCtx());
  assert.equal(get(board, 0, 2).color, 1);
  assert.equal(get(board, 0, 1), null);
});

test('an empty cell under a block is filled by a diagonal slide', () => {
  const board = boardFrom(['12', 'c3', '.4']);
  const ev = settle(board, quietCtx());
  assert.equal(get(board, 0, 2).color, 3, 'the 3 slid down-left under the crate');
  assert.equal(get(board, 1, 1).color, 2, 'the 2 dropped into the gap it left');
  assert.ok(board.cells.every((c) => !isEmpty(c)), 'no gaps left');
  const fall = events(ev, 'fall')[0];
  assert.ok(fall.falls.some((f) => f.from.x === 1 && f.from.y === 1 && f.to.x === 0 && f.to.y === 2));
  assert.equal(events(ev, 'refill')[0].spawns.length, 1);
  assert.deepEqual(events(ev, 'refill')[0].spawns[0].at, { x: 1, y: 0 });
});

test('fall events give each thing one entry, from its start to its final cell', () => {
  // The 3 drops straight down one cell, then slides diagonally: one entry, start to finish.
  const board = boardFrom(['c3', '5.', 'c.', '.6']);
  // column 1: 3 falls to row 2; the cell under the lower crate (0,3) then takes it diagonally.
  const ev = settle(board, quietCtx());
  const falls = events(ev, 'fall').flatMap((e) => e.falls);
  const three = falls.filter((f) => f.from.x === 1 && f.from.y === 0);
  assert.equal(three.length, 1);
  assert.deepEqual(three[0].to, { x: 0, y: 3 });
});

// ---- the dropper ---------------------------------------------------------------

test('a dropper falls like a piece and is collected at the bottom', () => {
  const board = boardFrom(['d1', '.2', '.3']);
  const ev = settle(board, quietCtx());
  assert.deepEqual(events(ev, 'collect'), [{ type: 'collect', x: 0, y: 2, kind: 'sandbag' }]);
  assert.ok(!board.cells.some(isDrop), 'the dropper has left the board');
  assert.ok(board.cells.every((c) => !isEmpty(c)), 'and its column was refilled');
});

test('a dropper above a hole is collected at the lowest real cell', () => {
  const board = boardFrom(['d', '.', '#']);
  const ev = settle(board, quietCtx());
  assert.deepEqual(events(ev, 'collect'), [{ type: 'collect', x: 0, y: 1, kind: 'sandbag' }]);
});

test('a dropper is never part of a match', () => {
  const board = boardFrom(['00d00', '12312']);
  assert.equal(findGroups(board).length, 0);
});

test('a Grenade does not clear a dropper; it falls and is collected afterwards', () => {
  const board = quietBoard(5, 5);
  set(board, 1, 1, drop());
  set(board, 2, 2, power('show'));
  fire(board, { x: 2, y: 2 }, {});
  assert.ok(isDrop(get(board, 1, 1)), 'still there after the blast');
  const ev = settle(board, quietCtx());
  assert.deepEqual(events(ev, 'collect'), [{ type: 'collect', x: 1, y: 4, kind: 'sandbag' }]);
  assert.ok(!board.cells.some(isDrop));
});

test('a Ninja Star never flies to a dropper', () => {
  const board = boardFrom(['Ud', '..']);
  const ev = fire(board, { x: 0, y: 0 }, { rng: makeRng(1) });
  assert.equal(events(ev, 'fly').length, 0);
  assert.ok(isDrop(get(board, 1, 0)));
});

// ---- moves ---------------------------------------------------------------------

test('no legal move ever involves a block or a dropper', () => {
  // Swapping the crate with the 0 above it would line up three 0s, but it is not allowed.
  const board = boardFrom(['12012', '0c034', 'd1234']);
  for (const m of findLegalMoves(board)) {
    for (const p of [m.a, m.b]) {
      const cell = get(board, p.x, p.y);
      assert.ok(isPiece(cell) || isPower(cell));
    }
  }
  assert.ok(!hasLegalMove(boardFrom(['0c0', '1d1'])));
});

const LEVEL = {
  n: 1, tier: 0, cols: 7, rows: 8, holes: [{ x: 0, y: 7 }], colors: 4, moves: 5,
  targets: [{ color: 0, need: 999 }],
  blocks: [
    { x: 3, y: 3, kind: 'crate' },
    { x: 2, y: 5, kind: 'paint', color: 2 },
    { x: 4, y: 5, kind: 'padlock' },
    { x: 5, y: 6, kind: 'padlock', inside: { t: 'block', kind: 'hatbox' } },
    { x: 0, y: 7, kind: 'trunk' }, // on a hole: ignored
  ],
  drops: [{ x: 1, y: 0 }, { x: 5, y: 0 }],
};

test('newGame places blocks and droppers and still starts clean', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = newGame(LEVEL, seed);
    assert.deepEqual(get(g.board, 3, 3), block('crate'));
    assert.deepEqual(get(g.board, 2, 5), block('paint', { color: 2 }));
    const lock = get(g.board, 4, 5);
    assert.equal(lock.kind, 'padlock');
    assert.ok(isPiece(lock.inside), 'a padlock with nothing given holds the piece that was there');
    assert.deepEqual(get(g.board, 5, 6).inside, block('hatbox'));
    assert.equal(get(g.board, 0, 7), null, 'the hole stays a hole');
    assert.ok(isDrop(get(g.board, 1, 0)) && isDrop(get(g.board, 5, 0)));
    assert.equal(findGroups(g.board).length, 0);
    assert.ok(hasLegalMove(g.board));
  }
});

test('a level without blocks or drops starts exactly as before', () => {
  const plain = { ...LEVEL, blocks: undefined, drops: undefined };
  const empty = { ...LEVEL, blocks: [], drops: [] };
  assert.deepEqual(newGame(plain, 5).board, newGame(empty, 5).board);
});

test('a swap with a block or a dropper, or a tap on one, is refused and costs no move', () => {
  const g = newGame(LEVEL, 3);
  const before = JSON.stringify(serialize(g));
  const tries = [
    { type: 'swap', a: { x: 3, y: 3 }, b: { x: 4, y: 3 } }, // crate
    { type: 'swap', a: { x: 2, y: 3 }, b: { x: 3, y: 3 } },
    { type: 'swap', a: { x: 1, y: 0 }, b: { x: 2, y: 0 } }, // dropper
    { type: 'swap', a: { x: 1, y: 1 }, b: { x: 1, y: 0 } },
    { type: 'tap', at: { x: 3, y: 3 } },
    { type: 'tap', at: { x: 1, y: 0 } },
  ];
  for (const action of tries) {
    assert.deepEqual(act(g, action), [{ type: 'invalid' }]);
  }
  assert.equal(g.movesLeft, LEVEL.moves);
  assert.equal(JSON.stringify(serialize(g)), before, 'nothing changed');
});

test('even a swap with a block that would make a match is refused', () => {
  const g = newGame({ ...LEVEL, cols: 5, rows: 3, holes: [], blocks: [], drops: [] }, 1);
  g.board = boardFrom(['12012', '0c034', '31234']);
  assert.deepEqual(act(g, { type: 'swap', a: { x: 1, y: 1 }, b: { x: 1, y: 0 } }), [{ type: 'invalid' }]);
  assert.equal(g.movesLeft, LEVEL.moves);
});

// ---- targets ---------------------------------------------------------------------

test('a level asking for 3 crates is won when the third crate breaks', () => {
  const level = { n: 1, tier: 0, cols: 5, rows: 5, holes: [], colors: 5, moves: 5, targets: [{ block: 'crate', need: 3 }] };
  const g = newGame(level, 11);
  assert.deepEqual(g.targets, [{ block: 'crate', need: 3, have: 0 }]);
  g.board = boardFrom([
    'cc123',
    '00134',
    '34012',
    '1234c',
    '4012V',
  ]);
  // Move 1: three 0s line up under the two crates in the top row.
  act(g, { type: 'swap', a: { x: 2, y: 1 }, b: { x: 2, y: 2 } });
  assert.equal(g.targets[0].have, 2);
  assert.equal(g.status, 'playing');
  // Move 2: the Missile clears its column, which holds the third crate.
  assert.ok(isBlock(get(g.board, 4, 3)) && isPower(get(g.board, 4, 4)));
  const ev = act(g, { type: 'tap', at: { x: 4, y: 4 } });
  assert.equal(g.targets[0].have, 3);
  assert.equal(g.status, 'won');
  assert.deepEqual(ev[ev.length - 1], { type: 'end', status: 'won' });
});

test('a sandbag target counts droppers collected', () => {
  const level = { n: 1, tier: 0, cols: 5, rows: 3, holes: [], colors: 5, moves: 5, targets: [{ block: 'sandbag', need: 1 }] };
  const g = newGame(level, 4);
  g.board = boardFrom(['12341', 'd3012', '00123']);
  const ev = act(g, { type: 'swap', a: { x: 2, y: 1 }, b: { x: 2, y: 2 } });
  assert.equal(events(ev, 'collect').length, 1);
  assert.equal(g.targets[0].have, 1);
  assert.equal(g.status, 'won');
});

test('a hit that does not destroy a block does not count toward the target', () => {
  const level = { n: 1, tier: 0, cols: 5, rows: 3, holes: [], colors: 5, moves: 5, targets: [{ block: 'hatbox', need: 1 }] };
  // New pieces are random here, so a lucky chain reaction may hit the hatbox a
  // second time. Whatever happens, the target must equal the hatboxes destroyed.
  let sawHalfBroken = false;
  for (let seed = 1; seed <= 20; seed++) {
    const g = newGame(level, seed);
    g.board = boardFrom(['12341', 'h3012', '00123']);
    const ev = act(g, { type: 'swap', a: { x: 2, y: 1 }, b: { x: 2, y: 2 } });
    const hits = events(ev, 'block');
    assert.ok(hits.length >= 1);
    assert.equal(g.targets[0].have, hits.filter((e) => e.destroyed).length, `seed ${seed}`);
    if (hits.length === 1) {
      sawHalfBroken = true;
      assert.equal(g.targets[0].have, 0);
      assert.equal(g.status, 'playing');
      assert.equal(get(g.board, 0, 1).hp, 1);
    }
  }
  assert.ok(sawHalfBroken, 'at least one seed leaves the hatbox half broken');
});

// ---- saving ----------------------------------------------------------------------

test('serialize and deserialize round-trip blocks and droppers', () => {
  const g = newGame({ ...LEVEL, targets: [{ block: 'crate', need: 1 }, { color: 0, need: 9 }] }, 8);
  const text = JSON.stringify(serialize(g)); // what actually goes into storage
  const back = deserialize(JSON.parse(text));
  assert.deepEqual(back.board, g.board);
  assert.deepEqual(back.targets, g.targets);
  assert.deepEqual(get(back.board, 2, 5), block('paint', { color: 2 }));
  assert.deepEqual(get(back.board, 5, 6).inside, block('hatbox'));
  assert.ok(isDrop(get(back.board, 1, 0)));
  // Both copies play on identically.
  const move = findLegalMoves(g.board)[0];
  const a = act(g, { type: 'swap', ...move });
  const b = act(back, { type: 'swap', ...move });
  assert.deepEqual(b, a);
  assert.deepEqual(back.board, g.board);
});
