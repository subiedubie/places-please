// The Box Office and the boosters earned by winning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../meta/session.js';
import { SHOP, DROPS } from '../config/shop.js';
import { fakeStorage } from './helpers.js';

const DAY = 24 * 3600 * 1000;
function make(coins = 5000) {
  const t = { now: new Date(2026, 10, 24, 10).getTime() };
  const storage = fakeStorage();
  const s = createSession(storage, { now: () => t.now });
  s.save.coins = coins;
  return { s, t, storage };
}
const total = (s) => Object.values(s.save.inventory).reduce((a, b) => a + b, 0);
function win(s, level) {
  s.save.level = level;
  s.save.current = null;
  s.startLevel();
  for (const x of s.game.targets) x.have = x.need;
  s.game.status = 'won';
  return s.finish();
}

test('every shelf item can be bought for its price and gives what it says', () => {
  for (const item of SHOP.shelves.flatMap((x) => x.items)) {
    const { s, storage, t } = make(9000);
    const before = { ...s.save.inventory };
    assert.ok(s.market.buy(item.id), item.id);
    const cardCoins = item.reward.packs ? s.save.coins - (9000 - item.price) : 0;
    assert.ok(cardCoins >= 0);
    if (!item.reward.packs) assert.equal(s.save.coins, 9000 - item.price);
    for (const [k, n] of Object.entries(item.reward.boosters || {})) assert.equal(s.save.inventory[k], before[k] + n);
    if (item.reward.boost) assert.equal(s.rewards.active(t.now)[0].endsAt, t.now + item.reward.boost.minutes * 60000);
    // it is saved
    assert.equal(createSession(storage, { now: () => t.now }).save.coins, s.save.coins);
  }
});

test('too few coins, or an unknown item: nothing happens', () => {
  const { s } = make(99);
  const before = total(s);
  assert.equal(s.market.buy('drill1'), null);
  assert.equal(s.market.buy('nonsense'), null);
  assert.equal(s.save.coins, 99);
  assert.equal(total(s), before);
});

test('one free gift and one deal a day', () => {
  const { s, t } = make();
  assert.ok(s.market.takeGift());
  assert.equal(s.market.takeGift(), null);
  assert.ok(s.market.buy('deal'));
  assert.equal(s.market.buy('deal'), null);
  t.now += DAY;
  assert.ok(s.market.view().gift.ready && s.market.view().deal.ready);
  assert.ok(s.market.takeGift());
  assert.equal(s.market.view().deal.price < s.market.view().deal.was, true);
});

test('winning pays a booster every few levels, and more for harder levels', () => {
  const { s } = make();
  let boosters = 0;
  for (let i = 0; i < 20; i++) {
    const r = win(s, 11 + i);
    assert.ok(r.eventLines.some((l) => l.title === DROPS.title));
    for (const n of r.newRewards) if (n.from === DROPS.title) boosters += Object.values(n.reward.boosters).reduce((a, b) => a + b, 0);
  }
  assert.ok(boosters >= 12, `${boosters} boosters in 20 wins`);
  console.log(`stage door: ${boosters} boosters in 20 wins`);
});

test('boosters and coins in the tray never expire; a timed boost does', () => {
  const { s, t } = make();
  s.save.rewards = { nextId: 1, items: [], active: [] };
  win(s, 13); win(s, 14); win(s, 16);
  const kept = s.rewards.tray(t.now).filter((i) => i.from === DROPS.title).length;
  assert.ok(kept > 0);
  assert.equal(s.rewards.tray(t.now + 30 * DAY).filter((i) => i.from === DROPS.title).length, kept);
});
