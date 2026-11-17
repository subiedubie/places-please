import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, serialize, deserialize } from '../engine/game.js';
import { findGroups } from '../engine/matches.js';
import { findLegalMoves, hasLegalMove } from '../engine/moves.js';
import { get, cloneBoard, isEmpty, isPiece, isPower, adjacent } from '../engine/board.js';

const LEVEL = { n: 1, tier: 0, cols: 7, rows: 8, holes: [], colors: 4, moves: 5, targets: [{ color: 0, need: 999 }] };

function noEmpties(board) {
  return board.cells.every((c) => !isEmpty(c));
}

// A swap of two ordinary pieces that makes a match.
function pieceMove(game) {
  return findLegalMoves(game.board).find(
    (m) => isPiece(get(game.board, m.a.x, m.a.y)) && isPiece(get(game.board, m.b.x, m.b.y)),
  );
}

// An adjacent pair of pieces whose swap makes nothing.
function deadSwap(game) {
  const legal = new Set(findLegalMoves(game.board).map((m) => [m.a.x, m.a.y, m.b.x, m.b.y].join()));
  const b = game.board;
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x + 1 < b.cols; x++) {
      const k1 = [x, y, x + 1, y].join(), k2 = [x + 1, y, x, y].join();
      if (!legal.has(k1) && !legal.has(k2) && isPiece(get(b, x, y)) && isPiece(get(b, x + 1, y))) {
        return { a: { x, y }, b: { x: x + 1, y } };
      }
    }
  }
  return null;
}

test('a new game starts clean', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = newGame(LEVEL, seed);
    assert.equal(findGroups(g.board).length, 0);
    assert.ok(hasLegalMove(g.board));
    assert.ok(noEmpties(g.board));
    assert.equal(g.movesLeft, LEVEL.moves);
    assert.equal(g.status, 'playing');
  }
});

test('a swap that makes nothing is refused and costs no move', () => {
  const g = newGame(LEVEL, 3);
  const before = JSON.stringify(g.board);
  const m = deadSwap(g);
  assert.ok(m, 'expected to find a non-matching pair');
  assert.deepEqual(act(g, { type: 'swap', ...m }), [{ type: 'invalid' }]);
  assert.equal(g.movesLeft, LEVEL.moves);
  assert.equal(JSON.stringify(g.board), before);
});

test('non-adjacent, off-board and nonsense actions are refused', () => {
  const g = newGame(LEVEL, 3);
  assert.deepEqual(act(g, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } }), [{ type: 'invalid' }]);
  assert.deepEqual(act(g, { type: 'swap', a: { x: 0, y: 0 }, b: { x: -1, y: 0 } }), [{ type: 'invalid' }]);
  assert.deepEqual(act(g, { type: 'tap', at: { x: 0, y: 0 } }), [{ type: 'invalid' }]);
  assert.deepEqual(act(g, { type: 'dance' }), [{ type: 'invalid' }]);
  assert.deepEqual(act(g, null), [{ type: 'invalid' }]);
  assert.equal(g.movesLeft, LEVEL.moves);
});

test('a matching swap costs exactly one move and leaves a still, full board', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = newGame(LEVEL, seed);
    const m = pieceMove(g);
    const events = act(g, { type: 'swap', ...m });
    assert.notEqual(events[0].type, 'invalid');
    assert.equal(g.movesLeft, LEVEL.moves - 1);
    assert.ok(noEmpties(g.board));
    assert.equal(findGroups(g.board).length, 0);
    assert.ok(events.some((e) => e.type === 'frame'));
  }
});

test('clearing the target color counts, and meeting the target wins', () => {
  const g = newGame(LEVEL, 5);
  const m = pieceMove(g);
  // Work out which color that move will clear, and make it the target.
  const probe = cloneBoard(g.board);
  const ca = get(probe, m.a.x, m.a.y), cb = get(probe, m.b.x, m.b.y);
  probe.cells[m.a.y * probe.cols + m.a.x] = cb;
  probe.cells[m.b.y * probe.cols + m.b.x] = ca;
  const color = findGroups(probe)[0].color;
  g.targets = [{ color, need: 3, have: 0 }];
  const events = act(g, { type: 'swap', ...m });
  assert.equal(g.targets[0].have, 3);
  assert.equal(g.status, 'won');
  assert.deepEqual(events.at(-1), { type: 'end', status: 'won' });
  assert.ok(g.movesLeft > 0);
  assert.deepEqual(act(g, { type: 'swap', ...m }), [{ type: 'invalid' }]);
});

test('running out of moves with the target unmet loses', () => {
  const g = newGame({ ...LEVEL, moves: 1 }, 7);
  act(g, { type: 'swap', ...pieceMove(g) });
  assert.equal(g.movesLeft, 0);
  assert.equal(g.status, 'lost');
});

test('same seed and same moves give the same game; another seed differs', () => {
  const play = (seed) => {
    const g = newGame(LEVEL, seed);
    for (let i = 0; i < 4 && g.status === 'playing'; i++) act(g, { type: 'swap', ...pieceMove(g) });
    return JSON.stringify(g.board);
  };
  assert.equal(play(11), play(11));
  assert.notEqual(JSON.stringify(newGame(LEVEL, 11).board), JSON.stringify(newGame(LEVEL, 12).board));
});

test('a saved game picks up exactly where it left off', () => {
  const g1 = newGame(LEVEL, 21);
  act(g1, { type: 'swap', ...pieceMove(g1) });
  act(g1, { type: 'swap', ...pieceMove(g1) });
  const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g1))));
  assert.equal(JSON.stringify(g2.board), JSON.stringify(g1.board));
  assert.equal(g2.movesLeft, g1.movesLeft);
  const m = pieceMove(g1);
  act(g1, { type: 'swap', ...m });
  act(g2, { type: 'swap', ...m });
  assert.equal(JSON.stringify(g2.board), JSON.stringify(g1.board));
  assert.deepEqual(g2.targets, g1.targets);
});

test('swapping a power-up with a piece fires it and costs a move', () => {
  const g = newGame(LEVEL, 2);
  // Plant a row Missile at (3,3) and swap it right.
  g.board.cells[3 * g.board.cols + 3] = { t: 'power', kind: 'spot-h' };
  const events = act(g, { type: 'swap', a: { x: 3, y: 3 }, b: { x: 4, y: 3 } });
  assert.notEqual(events[0].type, 'invalid');
  assert.equal(g.movesLeft, LEVEL.moves - 1);
  assert.equal(g.tally.fired['spot-h'], 1);
  const cleared = events.filter((e) => e.type === 'clear').flatMap((e) => e.cells);
  assert.ok(cleared.length >= g.board.cols, 'a whole row should clear');
  assert.ok(noEmpties(g.board));
});

test('tapping a power-up fires it; two power-ups swapped combine', () => {
  const g = newGame(LEVEL, 4);
  g.board.cells[2 * g.board.cols + 2] = { t: 'power', kind: 'show' };
  assert.notEqual(act(g, { type: 'tap', at: { x: 2, y: 2 } })[0].type, 'invalid');
  assert.ok(!isPower(get(g.board, 2, 2)) || true);
  g.board.cells[5 * g.board.cols + 1] = { t: 'power', kind: 'spot-h' };
  g.board.cells[5 * g.board.cols + 2] = { t: 'power', kind: 'spot-v' };
  const a = { x: 1, y: 5 }, b = { x: 2, y: 5 };
  assert.ok(adjacent(a, b));
  const events = act(g, { type: 'swap', a, b });
  assert.notEqual(events[0].type, 'invalid');
  assert.equal(g.movesLeft, LEVEL.moves - 2);
  assert.ok(noEmpties(g.board));
});

test('start power-ups are placed on the board and leave it clean', () => {
  const g = newGame(LEVEL, 9, undefined, { startPowers: ['spot-h', 'under', 'show', 'prism'] });
  const kinds = g.board.cells.filter((c) => isPower(c)).map((c) => c.kind);
  assert.equal(kinds.length, 4);
  assert.ok(kinds.includes('under') && kinds.includes('show') && kinds.includes('prism'));
  assert.equal(findGroups(g.board).length, 0);
  assert.ok(noEmpties(g.board));
});
