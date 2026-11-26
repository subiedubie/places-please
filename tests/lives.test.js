import test from 'node:test';
import assert from 'node:assert/strict';
import { createLives } from '../meta/lives.js';
import { createHistory } from '../meta/history.js';
import { LIVES } from '../config/lives.js';

const T = new Date(2026, 10, 25, 9).getTime();
const MIN = 60000;

test('losing costs a life; one comes back every refillMinutes', () => {
  const save = { coins: 0 };
  const lives = createLives(() => save);
  assert.equal(lives.view(T).have, LIVES.max);
  lives.lose(T);
  lives.lose(T);
  assert.equal(lives.view(T).have, LIVES.max - 2);
  assert.equal(lives.view(T + LIVES.refillMinutes * MIN).have, LIVES.max - 1);
  assert.equal(lives.view(T + 2 * LIVES.refillMinutes * MIN).have, LIVES.max);
  assert.equal(lives.view(T + 9 * LIVES.refillMinutes * MIN).have, LIVES.max);
});

test('no lives: cannot play; refill for coins; unlimited lives', () => {
  const save = { coins: 1000 };
  const lives = createLives(() => save);
  for (let i = 0; i < 9; i++) lives.lose(T);
  assert.equal(lives.canPlay(T), false);
  assert.equal(lives.refill(T), true);
  assert.equal(save.coins, 1000 - LIVES.refillCost);
  assert.equal(lives.view(T).have, LIVES.max);
  lives.unlimited(30, T);
  for (let i = 0; i < 9; i++) lives.lose(T + MIN);
  assert.equal(lives.view(T + MIN).have, LIVES.max);
});

test('lives from castmates arrive on time and may pass the maximum', () => {
  const save = {};
  const lives = createLives(() => save);
  lives.expect([T + 5 * MIN, T + 10 * MIN, T + 20 * MIN], T);
  assert.equal(lives.view(T + 11 * MIN).have, LIVES.max + 2);
});

test('the play log records each level with moves bought and boosters', () => {
  const save = {};
  const h = createHistory(() => save);
  h.begin({ n: 7, tier: 2, moves: 20 }, T, ['spot'], 2);
  h.note('moves');
  h.note('drill');
  h.end({ level: { n: 7, tier: 2, moves: 20 }, status: 'won', movesLeft: 3 }, T + 90000);
  assert.equal(save.history.length, 1);
  assert.deepEqual({ ...save.history[0], at: 0 }, { n: 7, tier: 2, moves: 20, bought: 1, boosters: { drill: 1 }, pre: ['spot'], gift: 2, at: 0, won: true, movesLeft: 3, ms: 90000 });
  assert.equal(h.summary()[2].bought, 1);
});
