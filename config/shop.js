// THE BOX OFFICE (the coin shop) and the boosters you earn by playing.
// Change a number, save, reload the game.
//   boosters  drill, stageleft, trapdoor, coinflip are used during a level;
//             spot (Missile), show (Grenade), prism (Magic Ball) before one
//   packs     Playbill card packs
//   boost     free starting power-ups on every level for so many minutes

export const SHOP = {
  title: 'Box Office',

  // FREE GIFT: one a day, taken from the shop. The list is gone through in
  // order, one per day, and then starts again.
  dailyGifts: [
    { boosters: { drill: 2 } },
    { boosters: { coinflip: 2, spot: 1 } },
    { boosters: { stageleft: 1, trapdoor: 1 } },
    { boosters: { show: 1, drill: 1 } },
    { packs: 1, boosters: { coinflip: 1 } },
    { boosters: { prism: 1, drill: 1 } },
    { boosters: { drill: 1, stageleft: 1, trapdoor: 1, coinflip: 1 } },
  ],

  // TODAY'S DEAL: one item from the shelves, different each day, once a day,
  // at this share of its price (0.5 = half price).
  dealShare: 0.5,

  // THE SHELVES. price is in coins.
  shelves: [
    {
      name: 'During a level',
      items: [
        { id: 'drill1', title: 'Drill', price: 150, reward: { boosters: { drill: 1 } } },
        { id: 'left1', title: 'Stage Left', price: 200, reward: { boosters: { stageleft: 1 } } },
        { id: 'trap1', title: 'Trapdoor', price: 200, reward: { boosters: { trapdoor: 1 } } },
        { id: 'flip1', title: 'Coin Flip', price: 100, reward: { boosters: { coinflip: 1 } } },
      ],
    },
    {
      name: 'Before a level',
      items: [
        { id: 'spot1', title: 'Missile', price: 150, reward: { boosters: { spot: 1 } } },
        { id: 'show1', title: 'Grenade', price: 250, reward: { boosters: { show: 1 } } },
        { id: 'prism1', title: 'Magic Ball', price: 350, reward: { boosters: { prism: 1 } } },
      ],
    },
    {
      name: 'Bundles',
      items: [
        { id: 'toolbox', title: 'Toolbox', price: 1000, reward: { boosters: { drill: 2, stageleft: 2, trapdoor: 2, coinflip: 2 } } },
        { id: 'opener', title: 'Opening Act', price: 1200, reward: { boosters: { spot: 2, show: 2, prism: 2 } } },
        { id: 'grand', title: 'Grand Finale', price: 3000, reward: { boosters: { drill: 4, stageleft: 4, trapdoor: 4, coinflip: 4, spot: 3, show: 3, prism: 3 } } },
      ],
    },
    {
      name: 'For a while',
      items: [
        { id: 'boost15', title: 'Quarter Hour', price: 500, reward: { boost: { powers: ['spot-h', 'show'], minutes: 15 } } },
        { id: 'boost30', title: 'Half Hour', price: 1200, reward: { boost: { powers: ['show', 'prism'], minutes: 30 } } },
        { id: 'boost60', title: 'Full Hour', price: 2500, reward: { boost: { powers: ['spot-h', 'show', 'prism'], minutes: 60 } } },
      ],
    },
    {
      name: 'Cards',
      items: [
        { id: 'pack1', title: 'Card pack', price: 400, reward: { packs: 1 } },
        { id: 'pack3', title: 'Three packs', price: 1050, reward: { packs: 3 } },
      ],
    },
  ],
};

// STAGE DOOR: boosters earned by winning levels.
export const DROPS = {
  title: 'Stage Door',
  // One of these every `everyWins` levels won, in order, then round again.
  everyWins: 3,
  cycle: [
    { boosters: { drill: 1 } },
    { boosters: { coinflip: 1 } },
    { boosters: { stageleft: 1 } },
    { boosters: { spot: 1 } },
    { boosters: { trapdoor: 1 } },
    { boosters: { drill: 1 } },
    { boosters: { show: 1 } },
    { boosters: { coinflip: 1 } },
    { boosters: { prism: 1 } },
  ],
  // Extra for winning a harder level: [normal, medium, hard, (not used)].
  byTier: [
    null,
    { boosters: { drill: 1, spot: 1 } },
    { packs: 1, boosters: { stageleft: 1, show: 1, prism: 1 } },
    { packs: 1, boosters: { trapdoor: 1, drill: 1, prism: 1 } },
  ],
  // Extra for a bonus level (every 10th).
  bonusLevel: { boosters: { stageleft: 1, trapdoor: 1, show: 1 } },
};
