// COINS. Every payout is in this file. These are placeholders to be tuned in
// phase 2. Change a number, save, reload the game.

export const ECONOMY = {
  // Coins for winning a level, one value per tier:
  // [regular, hard, super hard, extremely hard].
  winCoins: [20, 40, 60, 100],

  // Coins for each move the player still had left when the level was won.
  perLeftoverMove: 5,

  // Coins for each power-up still sitting on the board when the level was won.
  // The names on the left are the engine's ids:
  //   spot-h / spot-v = Spotlight (row / column), under = Understudy,
  //   show = Showstopper, prism = Prism.
  leftoverPower: { 'spot-h': 10, 'spot-v': 10, under: 10, show: 20, prism: 30 },

  // STREAK GIFT ("Standing Ovation"): free power-ups placed on the board at
  // the start of the next level while you keep winning. One list per step:
  //   after 1 win in a row:  a Missile and a Ninja Star
  //   after 2 wins in a row: those plus a Grenade
  //   after 3 or more:       those plus a Magic Ball
  // One loss resets the streak to nothing.
  // SUPER MAGIC BALL: after this many wins in a row, every Magic Ball has
  // double effect (two colors instead of one) until you lose a level.
  superPrismStreak: 5,

  streakGift: [
    ['spot-h', 'under'],
    ['spot-h', 'under', 'show'],
    ['spot-h', 'under', 'show', 'prism'],
  ],
};
