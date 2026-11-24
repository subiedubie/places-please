// The rewards tray: nothing is applied until claimed; items expire after 24
// hours; a timed boost starts on claim and adds start power-ups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeStorage } from './helpers.js';
import { createRewards } from '../meta/rewards.js';
import { createSession } from '../meta/session.js';
import { defaultSave } from '../meta/save.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const T0 = new Date(2026, 10, 16, 9).getTime();

test('a reward waits in the tray and is applied only on claim', () => {
  const save = defaultSave();
  const rewards = createRewards(() => save);
  const item = rewards.add({ coins: 500, boosters: { drill: 2, spot: 1 } }, '1st place', "Critics' Circle", T0);
  assert.deepEqual(Object.keys(item).sort(), ['expiresAt', 'from', 'id', 'reward', 'title']);
  assert.equal(save.coins, 0);
  assert.equal(save.inventory.drill, 0);
  assert.deepEqual(rewards.tray(T0 + HOUR).map((i) => i.id), [item.id]);
  rewards.claim(item.id, T0 + HOUR);
  assert.equal(save.coins, 500);
  assert.equal(save.inventory.drill, 2);
  assert.equal(save.inventory.spot, 1);
  assert.deepEqual(rewards.tray(T0 + HOUR), []);
  // Claiming again does nothing.
  rewards.claim(item.id, T0 + HOUR);
  assert.equal(save.coins, 500);
});

test('only a timed boost expires, after 24 hours', () => {
  const save = defaultSave();
  const rewards = createRewards(() => save);
  const item = rewards.add({ coins: 100, boost: { powers: ['show'], minutes: 15 } }, 'Step 1', 'Prop Room', T0);
  assert.equal(item.expiresAt, T0 + 24 * HOUR);
  assert.ok(rewards.tray(T0 + 24 * HOUR - 1)[0].reward.boost);
  const left = rewards.tray(T0 + 24 * HOUR);
  assert.deepEqual(left[0].reward, { coins: 100 }); // the boost is gone, the coins wait
  rewards.claim(item.id, T0 + 240 * HOUR);
  assert.equal(save.coins, 100);
  rewards.add({ boost: { powers: ['show'], minutes: 15 } }, 'Step 2', 'Prop Room', T0);
  assert.equal(rewards.tray(T0 + 25 * HOUR).length, 0);
});

test('a claimed 30-minute boost is active for exactly 30 minutes', () => {
  const save = defaultSave();
  const rewards = createRewards(() => save);
  const item = rewards.add({ boost: { powers: ['prism', 'show'], minutes: 30 } }, 'Stage 3', 'Ghost Light Run', T0);
  // Banked: not running until claimed, even 23 hours later.
  assert.deepEqual(rewards.active(T0 + 23 * HOUR), []);
  const claimAt = T0 + 23 * HOUR;
  rewards.claim(item.id, claimAt);
  assert.deepEqual(rewards.active(claimAt), [{ powers: ['prism', 'show'], endsAt: claimAt + 30 * MINUTE }]);
  assert.deepEqual(rewards.startPowers(claimAt + MINUTE), ['prism', 'show']);
  assert.equal(rewards.active(claimAt + 30 * MINUTE - 1).length, 1);
  assert.equal(rewards.active(claimAt + 30 * MINUTE).length, 0);
  assert.deepEqual(rewards.startPowers(claimAt + 30 * MINUTE), []);
});

test('an active boost adds its power-ups to the start of a level', () => {
  let clock = T0;
  const session = createSession(fakeStorage(), { now: () => clock });
  const countPowers = (game) => game.board.cells.filter((c) => c !== null && c.t === 'power').length;

  // No boost: a first level starts with no power-ups (no streak yet).
  const plain = session.startLevel();
  const base = countPowers(plain);
  session.quit();

  // Put a 30-minute boost in the tray through a real event prize path.
  session.save.rewards.items.push({
    id: 'test', title: 'Test', from: 'Test', expiresAt: clock + HOUR,
    reward: { boost: { powers: ['prism', 'show'], minutes: 30 } },
  });
  session.rewards.claim('test', clock);
  assert.equal(session.rewards.active(clock).length, 1);
  const boosted = session.startLevel();
  assert.equal(countPowers(boosted), base + 2);
  session.quit();

  // 30 minutes later the boost is over.
  clock += 30 * MINUTE;
  assert.equal(session.rewards.active(clock).length, 0);
  assert.equal(countPowers(session.startLevel()), base);
});

test('packs are opened on claim and the cards are returned', () => {
  let clock = T0;
  const session = createSession(fakeStorage(), { now: () => clock });
  session.save.rewards.items.push({ id: 'p', title: 'Pack', from: 'Test', expiresAt: clock + HOUR, reward: { packs: 2 } });
  const { cards } = session.rewards.claim('p', clock);
  assert.ok(cards.length >= 6 && cards.length <= 10);
  assert.ok(session.album(clock).owned > 0);
});
