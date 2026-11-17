import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fakeStorage } from './helpers.js';

// meta/session.js imports engine/game.js, which is written separately; these
// tests skip until it exists (hence the dynamic import inside each test).
const gameUrl = new URL('../engine/game.js', import.meta.url);
const noGame = existsSync(gameUrl) ? false : 'engine/game.js not written yet';

async function open(storage, now = () => 12345) {
  const { createSession } = await import('../meta/session.js');
  return createSession(storage, { now });
}

// Try every side-by-side swap until the engine accepts one. An invalid swap
// changes nothing, so trying them is harmless.
function playOneLegalMove(session) {
  const { cols, rows } = session.game.board;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (x + dx >= cols || y + dy >= rows) continue;
        const events = session.doAction({
          type: 'swap',
          a: { x, y },
          b: { x: x + dx, y: y + dy },
        });
        if (events.length > 0 && events[0].type !== 'invalid') return events;
      }
    }
  }
  throw new Error('no legal move found');
}

test('a win advances the level and adds coins', { skip: noGame }, async () => {
  const storage = fakeStorage();
  const session = await open(storage);
  assert.equal(session.save.level, 1);
  const game = session.startLevel();
  assert.equal(game.status, 'playing');
  assert.equal(session.isOver(), false);
  playOneLegalMove(session);

  // Force the win rather than play it out.
  session.game.status = 'won';
  for (const t of session.game.targets) t.have = t.need;
  assert.equal(session.isOver(), true);
  const result = session.finish();

  assert.equal(result.status, 'won');
  assert.ok(result.settlement.coins > 0);
  assert.equal(session.save.level, 2);
  assert.equal(session.save.coins, result.settlement.coins);
  assert.equal(session.save.streak, 1);
  assert.equal(session.save.current, null);
  assert.equal(session.game, null);
  // And it reached storage.
  const again = await open(storage);
  assert.equal(again.save.level, 2);
  assert.equal(again.save.coins, result.settlement.coins);
});

test('a loss keeps the level', { skip: noGame }, async () => {
  const storage = fakeStorage();
  const session = await open(storage);
  session.startLevel();
  playOneLegalMove(session);
  session.game.status = 'lost';
  const result = session.finish();
  assert.equal(result.status, 'lost');
  assert.equal(result.settlement.coins, 0);
  assert.equal(session.save.level, 1);
  assert.equal(session.save.coins, 0);
  assert.equal(session.save.streak, 0);
  assert.equal(session.save.stats.played, 1);

  // Quitting is a loss too.
  session.startLevel();
  assert.equal(session.quit().status, 'lost');
  assert.equal(session.save.level, 1);
  assert.equal(session.save.stats.played, 2);
});

test('a session rebuilt from storage mid-level resumes the same game', { skip: noGame }, async () => {
  const storage = fakeStorage();
  const first = await open(storage, () => 111);
  first.startLevel();
  playOneLegalMove(first);

  // A different clock proves the resumed game is not a fresh attempt.
  const second = await open(storage, () => 999);
  const resumed = second.startLevel();
  assert.deepEqual(resumed.board, first.game.board);
  assert.equal(resumed.movesLeft, first.game.movesLeft);
  assert.equal(resumed.movesLeft, first.level.moves - 1);
  assert.deepEqual(resumed.targets, first.game.targets);
  assert.equal(resumed.attemptSeed, 111);
});

test('export, import and settings go through the session', { skip: noGame }, async () => {
  const storage = fakeStorage();
  const session = await open(storage, () => 500);
  session.setSetting('speed', 'fast');
  const text = session.exportText();
  assert.equal(session.save.lastExport, 500);

  const other = await open(fakeStorage());
  other.importText(text);
  assert.equal(other.save.settings.speed, 'fast');
  assert.throws(() => other.importText('hello'), { message: 'not a save file' });
  assert.equal(other.save.settings.speed, 'fast');
});

// Streak gift (added 16 Nov. 2026)
import { streakGift } from '../meta/session.js';
test('streak gift grows with wins in a row and stops at four power-ups', () => {
  assert.deepEqual(streakGift(0), []);
  assert.deepEqual(streakGift(1), ['spot-h', 'under']);
  assert.deepEqual(streakGift(2), ['spot-h', 'under', 'show']);
  assert.deepEqual(streakGift(3), ['spot-h', 'under', 'show', 'prism']);
  assert.deepEqual(streakGift(25), ['spot-h', 'under', 'show', 'prism']);
});
