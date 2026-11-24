// The flow of play with no screen code: start a level, take actions, finish,
// and keep the save up to date after every step. The screens (ui/) call this.
import { generateLevel } from '../levels/generate.js';
import { newGame, act, actSteps, finishSteps, isLegal, serialize, deserialize } from '../engine/game.js';
import { liveMove, liveRefusal, liveWave, liveQuiet } from '../engine/live.js';
import { settleLevel } from './economy.js';
import { ECONOMY } from '../config/economy.js';
import { createMarket } from './market.js'; // the coin shop, and boosters earned by winning
import { attachShop } from './shop.js'; // boosters, extra moves, bonus-level pay
import { createEvents } from './events/index.js'; // the side games
import { createRewards } from './rewards.js'; // the rewards tray
import { createAlbum } from './album.js'; // the card album

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
        // ...plus the pre-level boosters chosen on Home (each spends one).
        // ...plus the power-ups of any timed boost running now (rewards tray).
        startPowers: streakGift(session.save.streak)
          .concat(session.takePreBoosters())
          .concat(rewards.startPowers(now())),
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
    // A move played one step at a time (see actSteps in engine/game.js).
    // Returns an object with next(earlyAction) -> step, or null when the move
    // is over. What the board will come to if nothing more is done is saved
    // straight away, so closing the app half way loses nothing.
    startMove(action) {
      const game = session.game;
      if (!game) return { next: () => null };
      const steps = actSteps(game, action);
      const savePlanned = () => {
        const copy = deserialize(serialize(game));
        for (const step of finishSteps(copy)) void step;
        if (copy.level.bonus && copy.status === 'lost') copy.status = 'won';
        session.save.current = serialize(copy);
        write();
      };
      let first = true;
      let made = false;
      return {
        next(early) {
          const r = steps.next(early);
          if (r.done) {
            if (made) {
              session.bonusNeverLost([]); // a bonus level out of moves counts as won
              session.save.current = serialize(game);
              write();
            }
            return null;
          }
          const step = r.value;
          if (first) made = !(step.events.length > 0 && step.events[0].type === 'invalid');
          if (made && (first || step.early)) savePlanned();
          first = false;
          return step;
        },
      };
    },
    // OVERLAPPING MOVES (engine/live.js). After each move, what the board will
    // come to by itself is saved, so closing the app half way loses nothing.
    live: {
      refusal: (action, ready) => (session.game ? liveRefusal(session.game, action, ready) : 'over'),
      move(action, ready) {
        const game = session.game;
        const events = game ? liveMove(game, action, ready) : null;
        if (!events) return null;
        const copy = deserialize(serialize(game));
        for (const step of finishSteps(copy)) void step;
        if (copy.level.bonus && copy.status === 'lost') copy.status = 'won';
        session.save.current = serialize(copy);
        write();
        return events;
      },
      wave: (ready) => liveWave(session.game, ready),
      quiet: () => liveQuiet(session.game),
      // Everything is at rest: end the move. Yields the steps to play.
      * finish() {
        const game = session.game;
        yield* finishSteps(game);
        session.bonusNeverLost([]);
        session.save.current = serialize(game);
        write();
      },
    },
    // Would this be accepted as an early move right now?
    canMove: (action) => Boolean(session.game) && isLegal(session.game, action),
    doAction(action) {
      if (!session.game) return [{ type: 'invalid' }];
      const events = act(session.game, action);
      session.bonusNeverLost(events); // a bonus level out of moves counts as won
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
      // (addBonusPay adds the per-piece coins of a bonus level; see meta/shop.js)
      const settlement = session.addBonusPay(game, settleLevel(game, names));
      const firstAttempt = events.firstAttempt(game.level.n);
      session.save = applyResult(session.save, game, settlement);
      // Tell every running side game about this level. eventLines says what
      // it added to each; newRewards are the prizes just put in the tray.
      const { eventLines, newRewards } = events.onLevel({
        won: game.status === 'won',
        level: game.level.n,
        tier: game.level.tier,
        tally: game.tally,
        firstAttempt,
        movesLeft: game.movesLeft,
        now: now(),
      });
      const dropLine = market.onLevel({
        won: game.status === 'won', tier: game.level.tier, bonus: game.level.bonus, now: now(),
      });
      if (dropLine) eventLines.push(dropLine);
      newRewards.push(...rewards.takeFresh());
      write();
      session.game = null;
      session.level = null;
      return { status: game.status, settlement, save: session.save, eventLines, newRewards };
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

  // Side games, rewards tray and card album (docs/EVENTS.md). They read the
  // save through a function, so they follow an imported or replaced save.
  // Each call below saves afterwards, because looking at the list can itself
  // start or end an event when the clock has moved on.
  const getSave = () => session.save;
  const album = createAlbum(getSave, {
    add: (...args) => rewards.add(...args),
  });
  const rewards = createRewards(getSave, { openPack: (t) => album.openPack(t) });
  const events = createEvents(getSave, rewards);
  const saved = (value) => {
    write();
    return value;
  };
  session.events = {
    list: (t) => saved(events.list(t)),
    detail: (id, t) => saved(events.detail(id, t)),
    start: (id, t) => saved(events.start(id, t)),
  };
  // The Box Office.
  const market = createMarket(getSave, rewards);
  session.market = {
    title: market.title,
    tierReward: market.tierReward,
    view: () => market.view(now()),
    buy: (id) => saved(market.buy(id, now())),
    takeGift: () => saved(market.takeGift(now())),
  };
  session.rewards = {
    tray: (t) => saved(rewards.tray(t)),
    claim: (id, t) => saved(rewards.claim(id, t)),
    active: (t) => saved(rewards.active(t)),
  };
  session.album = (t) => saved(album.view(t));

  // Adds useBooster, buyBooster, buyMoves, setPreBoosters (meta/shop.js).
  attachShop(session, write);

  return session;
}
