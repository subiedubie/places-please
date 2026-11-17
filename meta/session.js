// The flow of play with no screen code: start a level, take actions, finish,
// and keep the save up to date after every step. The screens (ui/) call this.
import { generateLevel } from '../levels/generate.js';
import { newGame, act, serialize, deserialize } from '../engine/game.js';
import { settleLevel } from './economy.js';
import { ECONOMY } from '../config/economy.js';

// Which free power-ups the next level starts with, given the current win
// streak. The steps are in config/economy.js (streakGift).
export function streakGift(streak) {
  const steps = ECONOMY.streakGift || [];
  if (!streak || steps.length === 0) return [];
  return steps[Math.min(streak, steps.length) - 1].slice();
}
import {
  loadSave,
  writeSave,
  applyResult,
  exportText as saveToText,
  importText as textToSave,
} from './save.js';

// storage: localStorage in the browser, a fake in tests.
// options:
//   now   - function giving the current time in milliseconds (the seed of
//           each new attempt, and the time stamped on an export)
//   names - display names for power-ups, passed on to settleLevel
export function createSession(storage, { now = () => Date.now(), names = {} } = {}) {
  const loaded = loadSave(storage);

  const session = {
    save: loaded.save, // the current save object
    recovered: loaded.recovered, // unreadable old save text, or null
    game: null, // the Game being played, or null
    level: null, // its Level, or null
    lastWriteOk: true, // false if the last write to storage failed

    // The level that Play would start next (without starting it).
    peekLevel() {
      return generateLevel(session.save.level);
    },
    // What the current win streak gives the next level.
    nextGift() {
      return {
        powers: streakGift(session.save.streak),
        superPrism: session.save.streak >= (ECONOMY.superPrismStreak || Infinity),
      };
    },

    // Start (or resume) the level the save says the player is on.
    startLevel() {
      const level = generateLevel(session.save.level);
      let game = null;
      // A level left half-played is picked up where it stopped.
      if (session.save.current) {
        try {
          const resumed = deserialize(session.save.current);
          if (resumed && resumed.level && resumed.level.n === level.n) game = resumed;
        } catch {
          game = null; // unreadable: fall through to a fresh attempt
        }
      }
      // Streak gift: free power-ups on the board for wins in a row.
      if (!game) game = newGame(level, now(), undefined, {
        startPowers: streakGift(session.save.streak),
        // Super Magic Ball: active while the win streak is at least this long.
        superPrism: session.save.streak >= (ECONOMY.superPrismStreak || Infinity),
      });
      session.level = game.level;
      session.game = game;
      session.save.current = serialize(game);
      write();
      return game;
    },

    // One swap or tap. Returns the engine's event list for the screen to play.
    doAction(action) {
      if (!session.game) return [{ type: 'invalid' }];
      const events = act(session.game, action);
      const invalid = events.length > 0 && events[0].type === 'invalid';
      if (!invalid) {
        // Saved after every move, so closing the app loses nothing.
        session.save.current = serialize(session.game);
        write();
      }
      return events;
    },

    isOver() {
      return session.game !== null && session.game.status !== 'playing';
    },

    // End the level: work out coins, update the save, clear the game.
    // A level ended while still 'playing' pays nothing and counts as a loss.
    finish() {
      const game = session.game;
      if (!game) return null;
      const settlement = settleLevel(game, names);
      session.save = applyResult(session.save, game, settlement);
      write();
      session.game = null;
      session.level = null;
      return { status: game.status, settlement, save: session.save };
    },

    // Give up: the same as finish, but always a loss.
    quit() {
      if (!session.game) return null;
      session.game.status = 'lost';
      return session.finish();
    },

    // Text for the Export button. Also records when the export happened.
    exportText() {
      session.save.lastExport = now();
      write();
      return saveToText(session.save);
    },

    // Replace the save with an imported one. Throws Error('not a save file')
    // on bad text, in which case nothing changes.
    importText(text) {
      session.save = textToSave(text);
      session.game = null;
      session.level = null;
      write();
    },

    setSetting(key, value) {
      session.save.settings[key] = value;
      write();
    },
  };

  function write() {
    session.lastWriteOk = writeSave(storage, session.save);
  }

  return session;
}
