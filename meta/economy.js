// Works out the coins earned at the end of a level. The amounts come from
// config/economy.js; this file only adds them up.
import { ECONOMY } from '../config/economy.js';

// game:  the finished Game (reads status, level.tier, movesLeft, board).
// names: optional display names for power-ups, e.g. { show: 'Showstopper' }.
//        A kind with no name is shown by its id.
// Returns { coins, lines } where lines is the itemised list for the results
// screen: [{ label, coins }]. A loss pays nothing.
export function settleLevel(game, names = {}, economy = ECONOMY) {
  if (game.status !== 'won') return { coins: 0, lines: [] };

  const lines = [];

  // 1. The win itself, by tier.
  lines.push({ label: 'Level won', coins: economy.winCoins[game.level.tier] ?? 0 });

  // 2. Moves not used.
  const left = game.movesLeft;
  if (left > 0) {
    lines.push({
      label: left === 1 ? '1 move left' : `${left} moves left`,
      coins: left * economy.perLeftoverMove,
    });
  }

  // 3. Power-ups still on the board: count each kind, one line per kind.
  const counts = {};
  for (const cell of game.board.cells) {
    if (cell !== null && cell.t === 'power') {
      counts[cell.kind] = (counts[cell.kind] || 0) + 1;
    }
  }
  // Listed in the order the config lists them, so the screen is always the same.
  for (const kind of Object.keys(economy.leftoverPower)) {
    const count = counts[kind];
    if (!count) continue;
    const name = names[kind] || kind;
    lines.push({
      label: count === 1 ? `${name} left on the board` : `${count} x ${name} left on the board`,
      coins: count * economy.leftoverPower[kind],
    });
  }

  const coins = lines.reduce((sum, line) => sum + line.coins, 0);
  return { coins, lines };
}
