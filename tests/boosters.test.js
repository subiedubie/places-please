// Tests for engine/boosters.js: the four in-level boosters and extra moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom } from './helpers.js';
import { newGame } from '../engine/game.js';
import { get, isPiece, isBlock, isDrop, isPower } from '../engine/board.js';
import { useBooster, addMoves, BOOSTER_KINDS } from '../engine/boosters.js';

// A game on a hand-built board. The board must have no ready-made match.
// `targets` defaults to "clear 99 of color 4", which these boards never meet.
function gameOn(rows, targets = [{ color: 4, need: 99 }], moves = 10) {
  const level = { n: 1, tier: 0, cols: rows[0].length, rows: rows.length, holes: [], colors: 5, moves, targets };
  const game = newGame(level, 777);
  game.board = boardFrom(rows);
  return game;
}

const QUIET = [
  '01234',
  '23401',
  '40123',
  '12340',
  '34012',
];

const clearsBy = (events, cause) => events.filter((e) => e.type === 'clear' && e.cause === cause);
const count = (board, test) => board.cells.filter((c) => test(c)).length;
const noGaps = (board) => board.cells.every((c) => c === null || c.t !== 'empty');

test('the four booster kinds are listed', () => {
  assert.deepEqual(BOOSTER_KINDS, ['drill', 'stageleft', 'trapdoor', 'coinflip']);
});

test('drill clears one piece, costs no move, and counts toward the target', () => {
  const game = gameOn(QUIET, [{ color: 2, need: 50 }]);
  const events = useBooster(game, 'drill', { x: 2, y: 0 }); // a color-2 piece
  const clears = clearsBy(events, 'drill');
  assert.equal(clears.length, 1);
  assert.deepEqual(clears[0].cells.map((c) => [c.x, c.y, c.was.color]), [[2, 0, 2]]);
  assert.equal(game.movesLeft, 10);
  assert.equal(game.moveCount, 0);
  assert.equal(game.status, 'playing');
  assert.ok(game.targets[0].have >= 1);
  assert.ok(game.tally.cleared[2] >= 1);
  assert.ok(noGaps(game.board), 'the board is refilled');
});

test('drill sets off a power-up', () => {
  const game = gameOn(['01234', '23H01', '40123', '12340', '34012']);
  const events = useBooster(game, 'drill', { x: 2, y: 1 });
  const row = clearsBy(events, 'spot-h');
  assert.equal(row.length, 1);
  assert.equal(row[0].cells.length, 5); // the whole row, the Missile included
  assert.equal(game.tally.fired['spot-h'], 1);
  assert.equal(game.movesLeft, 10);
});

test('drill gives an obstacle one power hit and counts it when destroyed', () => {
  // b = cash box (one power hit). The target is "break 1 cash box".
  const game = gameOn(['01234', '23b01', '40123', '12340', '34012'], [{ block: 'cashbox', need: 1 }, { color: 4, need: 99 }]);
  const events = useBooster(game, 'drill', { x: 2, y: 1 });
  const hit = events.find((e) => e.type === 'block');
  assert.equal(hit.kind, 'cashbox');
  assert.equal(hit.destroyed, true);
  assert.equal(hit.by, 'power');
  assert.equal(game.targets[0].have, 1);
});

test('a booster refuses a hole, an off-board cell, an empty target and a finished game', () => {
  const game = gameOn(['01234', '23#01', '4d123', '12340', '34012']);
  const before = JSON.stringify(game.board.cells);
  assert.deepEqual(useBooster(game, 'drill', { x: 2, y: 1 }), [{ type: 'invalid' }]); // hole
  assert.deepEqual(useBooster(game, 'stageleft', { x: 9, y: 9 }), [{ type: 'invalid' }]); // off the board
  assert.deepEqual(useBooster(game, 'drill', { x: 1, y: 2 }), [{ type: 'invalid' }]); // sandbag: nothing to do
  assert.deepEqual(useBooster(game, 'drill', null), [{ type: 'invalid' }]);
  assert.deepEqual(useBooster(game, 'nonsense', { x: 0, y: 0 }), [{ type: 'invalid' }]);
  assert.equal(JSON.stringify(game.board.cells), before);
  game.status = 'lost';
  assert.deepEqual(useBooster(game, 'drill', { x: 0, y: 0 }), [{ type: 'invalid' }]);
  assert.deepEqual(useBooster(game, 'coinflip'), [{ type: 'invalid' }]);
});

test('stage left clears the whole row: pieces go, blocks take one hit, hole and sandbag stay', () => {
  // Row 2 holds: piece, hatbox (2 hits), hole, sandbag, piece.
  const game = gameOn(['01234', '23401', '4h#d3', '12340', '34012'], [{ color: 4, need: 99 }]);
  const events = useBooster(game, 'stageleft', { x: 4, y: 2 });
  const clear = clearsBy(events, 'stageleft')[0];
  assert.deepEqual(clear.cells.map((c) => c.x).sort(), [0, 4]);
  assert.ok(clear.cells.every((c) => c.y === 2));
  const hits = events.filter((e) => e.type === 'block' && e.by === 'power');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].hpLeft, 1);
  assert.equal(hits[0].destroyed, false);
  assert.equal(get(game.board, 2, 2), null, 'the hole is still a hole');
  assert.equal(count(game.board, isDrop), 1, 'the sandbag is untouched');
  assert.equal(game.movesLeft, 10);
  assert.ok(game.targets[0].have >= 1, 'the color-4 piece at the row start is counted');
});

test('trapdoor clears the whole column and sets off a power-up caught in it', () => {
  const game = gameOn(['01234', '23401', '40H23', '12340', '34012'], [{ color: 4, need: 99 }]);
  const events = useBooster(game, 'trapdoor', { x: 2, y: 0 });
  const clear = clearsBy(events, 'trapdoor')[0];
  assert.equal(clear.cells.length, 4); // four pieces; the Missile is set off, not cleared by the booster
  assert.ok(clear.cells.every((c) => c.x === 2));
  assert.equal(clearsBy(events, 'spot-h').length, 1, 'the Missile went off');
  assert.equal(game.tally.fired['spot-h'], 1);
  assert.equal(game.movesLeft, 10);
  assert.ok(noGaps(game.board));
});

test('coin flip reshuffles the pieces and costs no move', () => {
  const game = gameOn(['01234', '23401', '40H23', '1c340', '34012']);
  const colorsBefore = game.board.cells.filter(isPiece).map((c) => c.color).sort().join('');
  const events = useBooster(game, 'coinflip');
  assert.equal(events[0].type, 'reshuffle');
  assert.equal(events[1].type, 'frame');
  // The snapshot right after the shuffle holds exactly the same pieces.
  const colorsAfter = events[1].board.cells.filter(isPiece).map((c) => c.color).sort().join('');
  assert.equal(colorsAfter, colorsBefore);
  assert.ok(isPower(get(game.board, 2, 2)), 'power-ups stay put');
  assert.ok(isBlock(get(game.board, 1, 3)), 'obstacles stay put');
  assert.equal(game.movesLeft, 10);
  assert.equal(game.status, 'playing');
});

test('a booster can win the level', () => {
  const game = gameOn(QUIET, [{ color: 2, need: 1 }]);
  const events = useBooster(game, 'drill', { x: 2, y: 0 });
  assert.equal(game.status, 'won');
  assert.deepEqual(events[events.length - 1], { type: 'end', status: 'won' });
  assert.equal(game.movesLeft, 10);
});

test('a booster never loses the level, even with no moves left', () => {
  const game = gameOn(QUIET, [{ color: 4, need: 99 }], 1);
  game.movesLeft = 0; // (an odd state, but a booster must not turn it into a loss)
  useBooster(game, 'stageleft', { x: 0, y: 4 });
  assert.equal(game.status, 'playing');
  assert.equal(game.movesLeft, 0);
});

test('the same seed gives the same result (no Math.random)', () => {
  const run = () => {
    const game = gameOn(QUIET);
    useBooster(game, 'trapdoor', { x: 1, y: 0 });
    useBooster(game, 'coinflip');
    return JSON.stringify(game.board.cells);
  };
  assert.equal(run(), run());
});

test('addMoves adds moves and revives a lost game', () => {
  const game = gameOn(QUIET);
  game.movesLeft = 0;
  game.status = 'lost';
  addMoves(game, 5);
  assert.equal(game.movesLeft, 5);
  assert.equal(game.status, 'playing');
  addMoves(game, 5);
  assert.equal(game.movesLeft, 10);
  // A game already won is left alone.
  game.status = 'won';
  addMoves(game, 5);
  assert.equal(game.movesLeft, 10);
  assert.equal(game.status, 'won');
});
