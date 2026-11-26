// THE LEVEL-474 FREEZE (version 27). On the phone the board stopped taking
// moves while the boosters still worked, and the counter said "8 masks left"
// with none on the board. Checked here:
//   - an error while drawing an animation frame can no longer leave the
//     animation unfinished (which kept the gems "in motion" for ever);
//   - a booster updates the counts of things still to come (masks lost in a
//     big blast stop being counted), as a move does;
//   - the one-time repair gives back the win streak lost by quitting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tween } from '../ui/anim.js';
import { repairFrozenQuit } from '../meta/history.js';
import { generateLevel } from '../levels/generate.js';
import { newGame } from '../engine/game.js';
import { useBooster } from '../engine/boosters.js';
import { set, isBlock } from '../engine/board.js';

test('an animation whose drawing throws still finishes', async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    let calls = 0;
    const out = await Promise.race([
      tween(200, () => { calls++; throw new Error('draw failed'); }).then(() => 'finished'),
      new Promise((r) => setTimeout(() => r('hung'), 1500)),
    ]);
    assert.equal(out, 'finished');
    assert.equal(calls, 1, 'cut short at the first bad frame');
    assert.equal(await tween(0, () => { throw new Error('x'); }).then(() => 'finished'), 'finished');
  } finally {
    console.error = quiet;
  }
});

test('a booster brings the "masks left" count down to what can still come', () => {
  const g = newGame(generateLevel(474), 3);
  const mask = g.targets.find((t) => t.block === 'mask');
  assert.ok(mask && mask.need === 24);
  // Take every mask rack off the board (as a whole-board blast can): those
  // masks can never come any more.
  g.board.cells.forEach((c, i) => {
    if (isBlock(c) && c.kind === 'maskrack') set(g.board, i % g.board.cols, Math.floor(i / g.board.cols), { t: 'piece', color: 0 });
  });
  g.board.cells.forEach((c, i) => { if (c && c.t === 'part') g.board.cells[i] = { t: 'piece', color: 1 }; });
  const events = useBooster(g, 'coinflip');
  assert.notEqual(events[0].type, 'invalid');
  assert.equal(mask.need, mask.have, 'nothing left to wait for');
});

const W = (n) => ({ n, won: true });
const L = (n) => ({ n, won: false });

test('repair: the quit on 474 gives the streak back, plus the wins since', () => {
  const save = { streak: 2, history: [L(460), W(468), W(469), W(470), W(471), W(472), W(473), L(474), W(474), W(475)] };
  assert.equal(repairFrozenQuit(save), true);
  assert.equal(save.streak, 8, 'six before it, two since');
  assert.deepEqual(save.fixes, ['freeze-474']);
  save.streak = 0;
  assert.equal(repairFrozenQuit(save), false, 'only once');
  assert.equal(save.streak, 0);
});

test('repair: left alone when a level was lost since, or 474 not reached', () => {
  const lostSince = { streak: 0, history: [W(472), W(473), L(474), W(474), L(475)] };
  assert.equal(repairFrozenQuit(lostSince), false);
  assert.equal(lostSince.streak, 0);
  assert.deepEqual(lostSince.fixes, ['freeze-474'], 'and not tried again');
  const early = { streak: 3, history: [W(470), W(471), W(472)] };
  assert.equal(repairFrozenQuit(early), false);
  assert.deepEqual(early.fixes, [], 'tried again on a later launch');
  const higher = { streak: 20, history: [W(473), L(474), W(474)] };
  assert.equal(repairFrozenQuit(higher), false, 'never lowers a streak');
  assert.equal(higher.streak, 20);
});
