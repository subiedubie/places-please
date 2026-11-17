import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleLevel } from '../meta/economy.js';
import { boardFrom } from './helpers.js';

function finished(status, tier, movesLeft, rows) {
  return { status, level: { tier }, movesLeft, board: boardFrom(rows) };
}

test('tier-0 win with 3 moves left and one Showstopper pays 20 + 15 + 20', () => {
  const game = finished('won', 0, 3, ['012', '1S0', '201']);
  const s = settleLevel(game);
  assert.equal(s.coins, 55);
  assert.equal(s.lines.length, 3);
  assert.deepEqual(s.lines.map((l) => l.coins), [20, 15, 20]);
  assert.equal(s.lines.reduce((a, l) => a + l.coins, 0), s.coins);
  for (const l of s.lines) assert.equal(typeof l.label, 'string');
});

test('a loss pays nothing', () => {
  const game = finished('lost', 0, 0, ['012', '1S0', '201']);
  assert.deepEqual(settleLevel(game), { coins: 0, lines: [] });
});

test('win coins follow the tier; no leftover lines when nothing is left', () => {
  const rows = ['012', '120', '201'];
  assert.deepEqual(
    [0, 1, 2, 3].map((tier) => settleLevel(finished('won', tier, 0, rows)).coins),
    [20, 40, 60, 100],
  );
  assert.equal(settleLevel(finished('won', 0, 0, rows)).lines.length, 1);
});

test('every kind of leftover power-up is counted; holes are ignored', () => {
  // H 10 + V 10 + U 10 + S 20 + P 30 + a second S 20 = 100, plus the win 20.
  const s = settleLevel(finished('won', 0, 0, ['HVU', 'SP#', 'S01']));
  assert.equal(s.coins, 120);
});

test('labels use the display names passed in, else the kind id', () => {
  const game = finished('won', 0, 1, ['012', '1S0', '201']);
  assert.ok(settleLevel(game, { show: 'Showstopper' }).lines[2].label.includes('Showstopper'));
  assert.ok(settleLevel(game).lines[2].label.includes('show'));
});
