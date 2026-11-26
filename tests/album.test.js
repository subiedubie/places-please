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
  for (const pack of da) assert.ok(pack.length >= ALBUM.packSize[0] && pack.length <= ALBUM.packSize[1]);
});

test('rare cards are rarer; extra copies are kept; gold cards only in gold packs', () => {
  const { album } = setup();
  const seen = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < 400; i++) {
    for (const card of album.openPack(NOV)) {
      seen[card.stars]++;
      assert.equal(card.gold, false);
    }
  }
  assert.ok(seen[1] > seen[3] && seen[3] > seen[5]);
  const v = album.view(NOV);
  assert.ok(v.sets.some((set) => set.cards.some((c) => c.count > 1)));
  const gold = album.openPack(NOV, true);
  assert.ok(gold.length >= ALBUM.goldPackSize[0] && gold.length <= ALBUM.goldPackSize[1]);
  assert.equal(gold.filter((c) => c.gold).length, 1);
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
    if (!(s === 8 && c === ALBUM.goldCard)) save.album.owned[`${s}-${c}`] = 1;
  }));
  packs = 0;
  while (album.view(NOV).owned < 81 && packs < 3000) {
    album.openPack(NOV, true);
    packs++;
  }
  assert.equal(album.view(NOV).owned, 81);
  for (let i = 0; i < 20; i++) album.openPack(NOV);
  assert.equal(rewards.tray(NOV).filter((i) => i.title === 'Album complete').length, 1);
  assert.equal(save.album.setsPaid.length, 9);
});

test('asking: once a day, a missing plain card, and it arrives from a castmate', () => {
  const { album } = setup();
  assert.equal(album.ask(0, ALBUM.goldCard, NOV), false); // no gold cards
  assert.equal(album.ask(0, 0, NOV), true);
  assert.equal(album.ask(0, 1, NOV + 60000), false); // once a day
  assert.equal(album.view(NOV).ask.state, 'waiting');
  const later = NOV + 3 * 3600000;
  const v = album.view(later);
  assert.ok(v.ask.state === 'arrived' || v.ask.state === 'none');
  if (v.ask.state === 'arrived') assert.ok(v.sets[0].cards[0].owned);
  assert.equal(album.ask(0, 1, NOV + 25 * 3600000), true);
});

test('a steady month finishes the album (packs, gold packs and daily asks)', () => {
  // About one pack a day from events, plus a gold pack every two or three
  // days from big wins, plus one ask a day.
  let finished = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { album } = setup(seed);
    for (let day = 0; day < 28; day++) {
      const t = NOV - 15 * 86400000 + day * 86400000;
      const at = new Date(2026, 10, 1 + day, 10).getTime();
      album.openPack(at);
      if (day % 3 !== 2) album.openPack(at);
      if (day % 2 === 0) album.openPack(at, true);
      const v = album.view(at);
      const miss = [];
      v.sets.forEach((set, s) => set.cards.forEach((c, k) => { if (!c.owned && !c.gold) miss.push([s, k]); }));
      miss.sort((x, y) => ALBUM.sets[y[0]].stars[y[1]] - ALBUM.sets[x[0]].stars[x[1]]); // the rarest first
      if (miss.length) album.ask(miss[0][0], miss[0][1], at);
      void t;
    }
    if (album.view(new Date(2026, 10, 29, 23).getTime()).owned === 81) finished++;
  }
  assert.ok(finished >= 30, `finished ${finished} of 40`);
});

test('a new album starts on the 1st', () => {
  const { album } = setup();
  for (let i = 0; i < 10; i++) album.openPack(NOV);
  assert.ok(album.view(NOV).owned > 0);
  const dec = album.view(DEC);
  assert.equal(dec.month, '2026-12');
  assert.equal(dec.owned, 0);
});
