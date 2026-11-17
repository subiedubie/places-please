// THE SHOP: buying boosters and extra moves with coins, and the pay for a
// bonus level. No screen code. Every price is in config/economy.js; this
// file only reads them.
//
// What can be bought (the `kind` argument everywhere below):
//   'moves'                                    extra moves when a level is lost
//   'drill' 'stageleft' 'trapdoor' 'coinflip'  boosters used during a level
//   'spot' 'show' 'prism'                      boosters chosen before a level
// Boosters the player owns are counted in save.inventory.

import { ECONOMY } from '../config/economy.js';

// Boosters used during a level, and boosters chosen on Home before a level.
export const IN_LEVEL_BOOSTERS = ['drill', 'stageleft', 'trapdoor', 'coinflip'];
export const PRE_LEVEL_BOOSTERS = ['spot', 'show', 'prism'];

// Which power-up each pre-level booster puts on the board at the start.
// ('spot-h' may be turned into a column Missile by the engine, at random.)
export const PRE_BOOSTER_POWER = { spot: 'spot-h', show: 'show', prism: 'prism' };

// How many moves one purchase of extra moves gives.
export function extraMovesCount(economy = ECONOMY) {
  return (economy.extraMoves && economy.extraMoves.count) || 5;
}

// The price of one item in coins, or null if there is no such item.
// The extra-moves price is FLAT: it is the same every time, however many
// times it has been bought in one level (the owner's decision).
export function priceOf(kind, economy = ECONOMY) {
  if (kind === 'moves') return economy.extraMoves ? economy.extraMoves.price : null;
  const p = economy.boosterPrices ? economy.boosterPrices[kind] : undefined;
  return typeof p === 'number' ? p : null;
}

// Does the player have enough coins for this item?
export function canAfford(save, kind, economy = ECONOMY) {
  const price = priceOf(kind, economy);
  return price !== null && (save.coins || 0) >= price;
}

// How many of a booster the player owns.
export function countOf(save, kind) {
  return (save.inventory && save.inventory[kind]) || 0;
}

// Buy one item. Returns the NEW save (the old one is untouched), or null if
// the item does not exist or the player has too few coins.
//   a booster: coins go down, save.inventory[kind] goes up by one
//   'moves':   coins go down (the caller adds the moves to the game)
export function buy(save, kind, economy = ECONOMY) {
  if (!canAfford(save, kind, economy)) return null;
  const next = { ...save, coins: save.coins - priceOf(kind, economy) };
  if (kind !== 'moves') {
    next.inventory = { ...(save.inventory || {}), [kind]: countOf(save, kind) + 1 };
  }
  return next;
}

// Take one booster out of the inventory. Returns the new save, or null if
// the player has none.
export function spend(save, kind) {
  if (countOf(save, kind) <= 0) return null;
  return { ...save, inventory: { ...save.inventory, [kind]: countOf(save, kind) - 1 } };
}

// ---- Bonus levels ("Benefit Night", every 10th level) ----------------------

// The extra line of pay for a bonus level: so many coins for every piece of
// the level's FIRST target color that was cleared (all of them, not only the
// number the target asked for). Returns { label, coins }, or null if the
// level is not a bonus level or was not won.
//   pieceNames: optional list of piece names by color number, for the label.
export function bonusLine(game, pieceNames = [], economy = ECONOMY) {
  if (!game || !game.level || !game.level.bonus || game.status !== 'won') return null;
  const first = (game.level.targets || []).find((t) => typeof t.color === 'number');
  if (!first) return null;
  const pieces = (game.tally && game.tally.cleared && game.tally.cleared[first.color]) || 0;
  const each = economy.bonusCoinPerPiece ?? 1;
  const name = pieceNames[first.color];
  const label = name ? `${pieces} x ${name} cleared` : `${pieces} target pieces cleared`;
  return { label, coins: pieces * each };
}

// ---- Session methods --------------------------------------------------------
//
// meta/session.js calls attachShop(session, write) once. It adds the booster
// and shop methods to the session object, so that file stays short.
//   write: the session's own "store the save now" function.
import { useBooster as engineUseBooster, addMoves } from '../engine/boosters.js';
import { serialize } from '../engine/game.js';

export function attachShop(session, write, economy = ECONOMY) {
  // Pre-level boosters switched on for the next level (not saved: choosing
  // them again after closing the app costs nothing).
  session.preBoosters = [];

  // The starting boosters (config/economy.js, startingInventory) are handed
  // out ONCE per save. The note that it has happened is kept with the
  // settings, so it travels with the save file.
  if (!session.save.settings || !session.save.settings.starterBoosters) {
    const gift = economy.startingInventory || {};
    const inventory = { ...(session.save.inventory || {}) };
    for (const kind of Object.keys(gift)) inventory[kind] = (inventory[kind] || 0) + gift[kind];
    session.save = {
      ...session.save,
      inventory,
      settings: { ...(session.save.settings || {}), starterBoosters: true },
    };
    write();
  }

  // Use one in-level booster on the level being played. Takes one from the
  // inventory and saves. Returns the event list for the screen to play;
  // [{ type: 'invalid' }] if there is no level, the player owns none, or the
  // booster could do nothing (then nothing is spent).
  session.useBooster = (kind, at) => {
    if (!session.game || !IN_LEVEL_BOOSTERS.includes(kind) || countOf(session.save, kind) <= 0) {
      return [{ type: 'invalid' }];
    }
    const events = engineUseBooster(session.game, kind, at);
    if (events.length > 0 && events[0].type === 'invalid') return events;
    session.save = spend(session.save, kind);
    session.save.current = serialize(session.game);
    write();
    return events;
  };

  // Buy one booster (any of the seven kinds) with coins. true if bought.
  session.buyBooster = (kind) => {
    if (!IN_LEVEL_BOOSTERS.includes(kind) && !PRE_LEVEL_BOOSTERS.includes(kind)) return false;
    const next = buy(session.save, kind, economy);
    if (!next) return false;
    session.save = next;
    write();
    return true;
  };

  // Buy extra moves for the level being played (normally one that has just
  // run out of moves). Flat price, every time. true if bought.
  session.buyMoves = () => {
    const game = session.game;
    if (!game || game.status === 'won') return false;
    const next = buy(session.save, 'moves', economy);
    if (!next) return false;
    addMoves(game, extraMovesCount(economy));
    session.save = next;
    session.save.current = serialize(game);
    write();
    return true;
  };

  // Choose the pre-level boosters for the next level (a list of 'spot',
  // 'show', 'prism'). Only kinds the player owns are kept, each once.
  session.setPreBoosters = (kinds) => {
    const wanted = Array.isArray(kinds) ? kinds : [];
    session.preBoosters = PRE_LEVEL_BOOSTERS.filter(
      (k) => wanted.includes(k) && countOf(session.save, k) > 0,
    );
    return session.preBoosters.slice();
  };

  // Called by startLevel when a NEW attempt begins: spends one of each chosen
  // pre-level booster and returns the power-ups they put on the board.
  session.takePreBoosters = () => {
    const powers = [];
    for (const kind of session.preBoosters) {
      const next = spend(session.save, kind);
      if (!next) continue;
      session.save = next;
      powers.push(PRE_BOOSTER_POWER[kind]);
    }
    session.preBoosters = [];
    return powers;
  };

  // Called by doAction after every move: a bonus level cannot be lost, so
  // running out of moves there counts as a win.
  session.bonusNeverLost = (events) => {
    const game = session.game;
    if (!game || !game.level.bonus || game.status !== 'lost') return;
    game.status = 'won';
    for (const e of events) if (e.type === 'end') e.status = 'won';
  };

  // Called by finish: adds the bonus level's per-piece pay to the settlement.
  session.addBonusPay = (game, settlement) => {
    const line = bonusLine(game, [], economy);
    if (!line) return settlement;
    return { ...settlement, coins: settlement.coins + line.coins, lines: [...settlement.lines, line] };
  };
}
