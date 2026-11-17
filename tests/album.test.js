// The card album: 9 sets of 9, seeded draws, duplicates to coins, set and
// album prizes paid once into the tray, a new album each month.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAlbum } from '../meta/album.js';
import { createRewards } from '../meta/rewards.js';
import { defaultSave } from '../meta/save.js';
import { ALBUM } from '../config/album.js';

const NOV = new Date(2026, 10, 16, 9).getTime();
const DEC = new Date(2026, 11, 2, 9).getTime();

function setup(seed = 99) {
  const save = defaultSave();
  save.events.seed = seed;
  const rewards = createRewards(() => save);
  const album = createAlbum(() => save, rewards);
  return { save, rewards, album };
}

test('the album is 9 sets of 9 cards with 1 to 5 stars and no repeated names', () => {
  assert.equal(ALBUM.sets.length, 9);
  const names = new Set();
  for (const set of ALBUM.sets) {
    assert.equal(set.cards.length, 9);
    assert.equal(set.stars.length, 9);
    for (const s of set.stars) assert.ok(s >= 1 && s <= 5);
    for (const c of set.cards) names.add(c);
    names.add(set.name);
  }
  assert.equal(names.size, 90);
  const view = setup().album.view(NOV);
  assert.equal(view.total, 81);
  assert.equal(view.owned, 0);
  assert.equal(view.month, '2026-11');
  assert.equal(view.endsAt, new Date(2026, 11, 1).getTime());
});

test('draws are deterministic by seed', () => {
  const a = setup(5);
  const b = setup(5);
  const c = setup(6);
  const draw = (x) => [1, 2, 3, 4, 5].map(() => x.album.openPack(NOV).map((card) => card.name));
  const da = draw(a);
  assert.deepEqual(da, draw(b));
  assert.notDeepEqual(da, draw(c));
  for (const pack of da) assert.ok(pack.length >= 3 && pack.length <= 5);
});

test('rare cards are rarer, and duplicates pay coins', () => {
  const { save, album } = setup();
  const seen = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let coins = 0;
  for (let i = 0; i < 400; i++) {
    for (const card of album.openPack(NOV)) {
      seen[card.stars]++;
      if (card.isNew) assert.equal(card.coins, 0);
      else assert.equal(card.coins, ALBUM.duplicateCoins[card.stars]);
      coins += card.coins;
    }
  }
  assert.ok(seen[1] > seen[3] && seen[3] > seen[5]);
  assert.ok(coins > 0);
  assert.equal(save.coins, coins);
});

test('a full set pays once, and the full album pays the grand prize once', () => {
  const { save, rewards, album } = setup();
  // Own all of set 0 but one card, then open packs until it turns up.
  ALBUM.sets[0].cards.forEach((_, c) => {
    if (c !== 0) save.album.owned[`0-${c}`] = 1;
  });
  album.view(NOV); // (starts the November album, which clears the above)
  ALBUM.sets[0].cards.forEach((_, c) => {
    if (c !== 0) save.album.owned[`0-${c}`] = 1;
  });
  let packs = 0;
  while (!album.view(NOV).sets[0].done && packs < 500) {
    album.openPack(NOV);
    packs++;
  }
  assert.ok(album.view(NOV).sets[0].done);
  const setPrizes = () => rewards.tray(NOV).filter((i) => i.title === `${ALBUM.sets[0].name} complete`);
  assert.equal(setPrizes().length, 1);
  assert.deepEqual(setPrizes()[0].reward, ALBUM.setReward);
  for (let i = 0; i < 50; i++) album.openPack(NOV);
  assert.equal(setPrizes().length, 1); // not paid again

  // Fill everything but one card of the last set, then draw to the end.
  ALBUM.sets.forEach((set, s) => set.cards.forEach((_, c) => {
    if (!(s === 8 && c === 0)) save.album.owned[`${s}-${c}`] = 1;
  }));
  packs = 0;
  while (album.view(NOV).owned < 81 && packs < 3000) {
    album.openPack(NOV);
    packs++;
  }
  assert.equal(album.view(NOV).owned, 81);
  for (let i = 0; i < 20; i++) album.openPack(NOV);
  assert.equal(rewards.tray(NOV).filter((i) => i.title === 'Album complete').length, 1);
  assert.equal(save.album.setsPaid.length, 9);
});

test('a new album starts on the 1st', () => {
  const { album } = setup();
  for (let i = 0; i < 10; i++) album.openPack(NOV);
  assert.ok(album.view(NOV).owned > 0);
  const dec = album.view(DEC);
  assert.equal(dec.month, '2026-12');
  assert.equal(dec.owned, 0);
});
