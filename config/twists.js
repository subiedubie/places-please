// TWISTS: things on the board that act by themselves, unlike the obstacles you
// clear by matching beside them.
//   ivy        Creeping Ivy      grows one cell after a move unless you cut some
//   mouse      Stage Mouse       hops to a new cell after every move
//   propbomb   Prop Bomb         a gem with a countdown: match it in time and it
//                                explodes for you; too late and it leaves a Crate
//                                behind and turns up somewhere else
//   chameleon  Chameleon         a gem that changes color after every move
//   revolve    Revolving Stage   a ring of cells turns one step after every move
//   doves      Dovecotes         break one and three doves fall out; bring them down
//   tortoise   Tortoise          falls; at the bottom it leaves petals up its column
//   paint      Paint Kegs        break them; matches that touch paint spread it;
//                                paint the whole board (has a level to itself)
//   treasure   Hidden Treasure   lies under confetti; clear all of it to collect
export const TWISTS = {
  // The first level each one appears on (alone among the twists).
  intro: { treasure: 5, mouse: 9, revolve: 13, doves: 16, propbomb: 19, tortoise: 22, ivy: 26, paint: 29, chameleon: 33 },

  // After that: the share of levels that get a twist, by tier
  // [regular, hard, super hard, extremely hard], and the share of those that
  // get a second one.
  share: [0.6, 0.65, 0.65, 0.65],
  secondShare: 0.2,

  // How many are on a level, [fewest, most].
  counts: { ivy: [2, 4], mouse: [2, 4], propbomb: [3, 5], chameleon: [4, 7], revolve: [1, 2], treasure: [1, 2], doves: [1, 2], tortoise: [2, 3], paint: [3, 4] },

  fuse: 7,          // moves before a Prop Bomb fizzles
  ivyMostShare: 0.3, // ivy never covers more than this share of the board

  // Extra moves a level gets for each one on it.
  moves: { ivy: 4.5, mouse: 2, propbomb: 0.8, chameleon: 1.2, revolve: 0, treasure: 4.5, doves: 15, tortoise: 5, paint: 0 },

  // Paint: how many squares each broken keg splashes, and the moves a paint
  // level gets: so many for each square to paint, by tier.
  kegSplash: 2,
  paintMoves: [0.78, 0.72, 0.66, 0.6],
};
