// COINS. Every payout is in this file. These are placeholders to be tuned in
// phase 2. Change a number, save, reload the game.

export const ECONOMY = {
  // Coins for winning a level, one value per tier:
  // [normal, medium, hard, (not used)].
  winCoins: [20, 75, 150, 200],

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

  // ---- THE SHOP (placeholder prices, to be tuned) ----

  // EXTRA MOVES, offered when a level runs out of moves: `count` more moves
  // for `price` coins. The price is FLAT: it stays the same however many
  // times it is bought in one level.
  extraMoves: { count: 5, price: 300 },

  // Price in coins of one booster.
  //   Used during a level:
  //     drill = clears one cell          stageleft = clears a row
  //     trapdoor = clears a column       coinflip = reshuffles the pieces
  //   Chosen on Home before a level (the level starts with that power-up):
  //     spot = a Missile     show = a Grenade     prism = a Magic Ball
  boosterPrices: {
    drill: 150, stageleft: 200, trapdoor: 200, coinflip: 100,
    spot: 150, show: 250, prism: 350,
  },

  // STARTING BOOSTERS: what every player is given once, the first time the
  // game opens (also given once to a save from before boosters existed), so
  // the boosters can be tried straight away. Set a number to 0 to give none.
  startingInventory: {
    drill: 3, stageleft: 3, trapdoor: 3, coinflip: 3, // used during a level
    spot: 2, show: 2, prism: 2,                       // chosen before a level
  },

  // BONUS LEVEL ("Benefit Night", every 10th level): coins for each piece of
  // the level's first target color cleared, on top of the usual win pay.
  bonusCoinPerPiece: 1,
};
