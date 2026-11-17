// Tests for meta/shop.js and the booster / shop / bonus-level parts of the session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeStorage } from './helpers.js';
import { ECONOMY } from '../config/economy.js';
import { defaultSave, loadSave, SAVE_KEY } from '../meta/save.js';
import { priceOf, canAfford, buy, spend, countOf, bonusLine } from '../meta/shop.js';
import { createSession } from '../meta/session.js';
import { generateLevel } from '../levels/generate.js';
import { findLegalMoves } from '../engine/moves.js';

// A session whose save starts from the given fields.
function sessionWith(fields) {
  const storage = fakeStorage();
  // starterBoosters: true = the one-time starting boosters were already given,
  // so the inventory is exactly what the test says.
  const settings = { speed: 'normal', starterBoosters: true };
  storage.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), settings, ...fields }));
  return createSession(storage, { now: () => 4242 });
}

// Play any legal move (a swap, or a tap on a power-up).
function playAnyMove(session) {
  const board = session.game.board;
  const moves = findLegalMoves(board);
  if (moves.length > 0) return session.doAction({ type: 'swap', a: moves[0].a, b: moves[0].b });
  const i = board.cells.findIndex((c) => c !== null && c.t === 'power');
  return session.doAction({ type: 'tap', at: { x: i % board.cols, y: Math.floor(i / board.cols) } });
}

test('the prices are the ones the owner set', () => {
  assert.equal(priceOf('moves'), 300);
  assert.equal(ECONOMY.extraMoves.count, 5);
  assert.equal(priceOf('drill'), 150);
  assert.equal(priceOf('stageleft'), 200);
  assert.equal(priceOf('trapdoor'), 200);
  assert.equal(priceOf('coinflip'), 100);
  assert.equal(priceOf('spot'), 150);
  assert.equal(priceOf('show'), 250);
  assert.equal(priceOf('prism'), 350);
  assert.equal(priceOf('nonsense'), null);
});

test('buy takes the coins and adds one to the inventory; the old save is untouched', () => {
  const save = { ...defaultSave(), coins: 400 };
  const next = buy(save, 'drill');
  assert.equal(next.coins, 250);
  assert.equal(next.inventory.drill, 1);
  assert.equal(save.coins, 400);
  assert.equal(save.inventory.drill, 0);
  assert.equal(countOf(buy(next, 'drill'), 'drill'), 2);
});

test('buy refuses when coins are short or the item does not exist', () => {
  const save = { ...defaultSave(), coins: 149 };
  assert.equal(canAfford(save, 'drill'), false);
  assert.equal(buy(save, 'drill'), null);
  assert.equal(canAfford(save, 'coinflip'), true);
  assert.equal(buy({ ...save, coins: 9999 }, 'nonsense'), null);
  assert.equal(spend(save, 'drill'), null); // owns none
});

test('an old save with no inventory gets one on load', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, level: 3, coins: 7 }));
  const { save } = loadSave(storage);
  for (const kind of ['spot', 'show', 'prism', 'drill', 'stageleft', 'trapdoor', 'coinflip']) {
    assert.equal(save.inventory[kind], 0);
  }
  // A partly filled one keeps what it has.
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, inventory: { drill: 2 } }));
  assert.equal(loadSave(storage).save.inventory.drill, 2);
  assert.equal(loadSave(storage).save.inventory.prism, 0);
});

test('extra moves cost the same flat price every time within one level', () => {
  const session = sessionWith({ coins: 1000 });
  const game = session.startLevel();
  game.status = 'lost';
  game.movesLeft = 0;
  assert.equal(session.buyMoves(), true);
  assert.equal(session.save.coins, 700);
  assert.equal(game.movesLeft, 5);
  assert.equal(game.status, 'playing');
  assert.equal(session.isOver(), false);
  assert.equal(session.buyMoves(), true); // second time in the same level
  assert.equal(session.save.coins, 400);
  assert.equal(session.buyMoves(), true); // third
  assert.equal(session.save.coins, 100);
  assert.equal(game.movesLeft, 15);
  // Not enough coins now: refused, nothing changes.
  assert.equal(session.buyMoves(), false);
  assert.equal(session.save.coins, 100);
  assert.equal(game.movesLeft, 15);
  // The purchase was saved with the level in progress.
  assert.equal(session.save.current.movesLeft, 15);
});

test('session.buyBooster and session.useBooster keep the inventory and the save in step', () => {
  const session = sessionWith({ coins: 250 });
  session.startLevel();
  assert.deepEqual(session.useBooster('coinflip'), [{ type: 'invalid' }]); // owns none
  assert.equal(session.buyBooster('coinflip'), true);
  assert.equal(session.save.coins, 150);
  assert.equal(session.save.inventory.coinflip, 1);
  assert.equal(session.buyBooster('trapdoor'), false); // 200 > 150
  const moves = session.game.movesLeft;
  const events = session.useBooster('coinflip');
  assert.equal(events[0].type, 'reshuffle');
  assert.equal(session.save.inventory.coinflip, 0);
  assert.equal(session.game.movesLeft, moves);
  // A booster that can do nothing is not spent.
  session.buyBooster('drill');
  assert.deepEqual(session.useBooster('drill', { x: -1, y: -1 }), [{ type: 'invalid' }]);
  assert.equal(session.save.inventory.drill, 1);
});

test('pre-level boosters are spent when the level starts and put power-ups on the board', () => {
  const session = sessionWith({ level: 1, inventory: { ...defaultSave().inventory, show: 2, prism: 1 } });
  // 'spot' is dropped: the player owns none.
  assert.deepEqual(session.setPreBoosters(['prism', 'spot', 'show']), ['show', 'prism']);
  const game = session.startLevel();
  const kinds = game.board.cells.filter((c) => c !== null && c.t === 'power').map((c) => c.kind).sort();
  assert.deepEqual(kinds, ['prism', 'show']);
  assert.equal(session.save.inventory.show, 1);
  assert.equal(session.save.inventory.prism, 0);
  assert.deepEqual(session.preBoosters, []); // chosen for one level only
});

test('every 10th level is a bonus level with no obstacles', () => {
  for (const n of [10, 20, 50, 100]) {
    const level = generateLevel(n);
    assert.equal(level.bonus, true);
    assert.equal(level.blocks.length + level.drops.length, 0);
  }
  for (const n of [1, 9, 11, 25]) assert.equal(generateLevel(n).bonus, false);
});

test('a bonus level cannot be lost: out of moves counts as won and pays per piece', () => {
  const session = sessionWith({ level: 10, coins: 0 });
  const game = session.startLevel();
  assert.equal(game.level.bonus, true);
  game.targets.forEach((t) => { t.need = 100000; }); // the targets can never be met
  let last = [];
  for (let i = 0; i < 500 && !session.isOver(); i++) last = playAnyMove(session);
  assert.equal(game.movesLeft, 0);
  assert.equal(game.status, 'won');
  assert.deepEqual(last[last.length - 1], { type: 'end', status: 'won' });

  const color = game.level.targets[0].color;
  const pieces = game.tally.cleared[color];
  assert.ok(pieces > 0);
  assert.deepEqual(bonusLine(game), { label: `${pieces} target pieces cleared`, coins: pieces * ECONOMY.bonusCoinPerPiece });

  const result = session.finish();
  assert.equal(result.status, 'won');
  const line = result.settlement.lines.find((l) => l.label.includes('target pieces cleared'));
  assert.equal(line.coins, pieces * ECONOMY.bonusCoinPerPiece);
  assert.ok(result.settlement.coins >= ECONOMY.winCoins[game.level.tier] + line.coins);
  assert.equal(session.save.coins, result.settlement.coins);
  assert.equal(session.save.level, 11);
});

test('an ordinary level can still be lost, and pays no bonus line', () => {
  const session = sessionWith({ level: 1 });
  const game = session.startLevel();
  game.targets.forEach((t) => { t.need = 100000; });
  for (let i = 0; i < 500 && !session.isOver(); i++) playAnyMove(session);
  assert.equal(game.status, 'lost');
  assert.equal(bonusLine(game), null);
});

test('a new player is given the starting boosters once', () => {
  const storage = fakeStorage();
  const first = createSession(storage, { now: () => 1 });
  assert.deepEqual(first.save.inventory, { ...defaultSave().inventory, ...ECONOMY.startingInventory });
  assert.equal(ECONOMY.startingInventory.drill, 3);
  assert.equal(ECONOMY.startingInventory.prism, 2);
  // Opening the game again does not give them a second time.
  const second = createSession(storage, { now: () => 2 });
  assert.deepEqual(second.save.inventory, first.save.inventory);
  // A save from before boosters existed (no inventory at all) gets them too.
  const old = fakeStorage();
  old.setItem(SAVE_KEY, JSON.stringify({ version: 1, level: 7, coins: 50 }));
  assert.equal(createSession(old, { now: () => 3 }).save.inventory.coinflip, ECONOMY.startingInventory.coinflip);
});
