// SIDE GAMES (events). One entry per event; `type` says which mechanic it
// uses (the rules for each mechanic are in meta/events/<type>.js). Which
// event runs when is in config/calendar.js. Rival speeds are in
// config/rivals.js. All numbers here are starting values to tune.
//
// A REWARD is written like this (leave out what you do not want):
//   { coins: 500,
//     boosters: { spot: 1, show: 1, prism: 1,            // before a level
//                 drill: 1, stageleft: 1, trapdoor: 1, coinflip: 1 }, // in a level
//     packs: 1,                                           // Playbill card packs
//     boost: { powers: ['prism', 'show'], minutes: 30 } } // free power-ups at
//                                                         // the start of every
//                                                         // level for 30 minutes
// Power-up ids: 'spot-h' / 'spot-v' = Missile (row / column), 'under' = Ninja
// Star, 'show' = Grenade, 'prism' = Magic Ball. Where an event counts
// Missiles, write 'spot' to count both directions together.
// Piece colors: 0 = Mask, 1 = Rose, 2 = Quill, 3 = Lantern, 4 = Fan.

// Points (and season keys) for winning a level, by how hard it was:
// [Rehearsal, Preview, Opening Night, Command Performance].
export const TIER_POINTS = [1, 2, 3, 5];

// THE REWARDS TRAY.
export const REWARDS = {
  // An unclaimed reward disappears after this many hours.
  trayHours: 24,
};

// Builds a list of steps from a list of sizes and a list of rewards that
// repeats. needs[i] is how much step i asks for.
function steps(needs, rewards) {
  return needs.map((need, i) => ({ need, reward: rewards[i % rewards.length] }));
}

// Small prizes that the step-by-step events cycle through.
const SMALL = [
  { coins: 100 },
  { boosters: { spot: 1 } },
  { coins: 150 },
  { boosters: { drill: 1 } },
  { coins: 200 },
  { boost: { powers: ['spot-h'], minutes: 15 } },
  { packs: 1 },
  { boosters: { show: 1 } },
  { coins: 250 },
  { boosters: { coinflip: 1 } },
];

// Leaderboard prizes: 1st, 2nd, 3rd, then 4th to 10th.
const RACE_PRIZES = [
  { place: 1, reward: { coins: 2000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } } },
  { place: 2, reward: { coins: 1200, packs: 1, boosters: { prism: 1 } } },
  { place: 3, reward: { coins: 800, packs: 1 } },
  { place: 4, to: 10, reward: { coins: 300 } },
];

// Every power-up kind (for 'super everything' prizes).
const ALL_POWERS = ['prism', 'show', 'spot-h', 'under'];

export const EVENTS = {
  // ---- MISSION CONTROL, MISSION PURSUIT, THE COMPANY TOURNAMENT, THE GRAND
  // CIRCUIT, BATTLE OF THE COMPANIES (meta/events/control.js ... battle.js) ----
  // ---- MISSION CONTROL (type 'control') -------------------------------
  // Four tasks drawn from `pool`, each on a different running total of the
  // whole game, counted from the moment the event starts. Each finished
  // task pays its prize from `rewards` (in board order); when all four are
  // done, `grand` is paid by itself.
  //   tasks    how many tasks are on the board
  //   pool     counter: 'wins' (levels won), 'coins' (coins earned from
  //            levels), 'cards' (album cards gained), 'gems' (jewels found
  //            Under the Stage), 'pairs' (Costume Pairs matches), 'prizes'
  //            (prizes paid by the other side games)
  //            need: [weekday block, weekend block]
  //            with: only drawn when that event is on the calendar this block
  //            text: what the card says; {n} is the number
  // Sizing: a weekday block is about 80 wins, a weekend about 120.
  control: {
    type: 'control',
    title: 'Mission Control',
    blurb: 'Four cues on the lighting desk, each tied to the rest of the game. Run all four and the big chest opens by itself.',
    tasks: 4,
    pool: [
      { counter: 'wins', need: [30, 50], text: 'Win {n} levels', hint: 'Every level you win counts.' },
      { counter: 'coins', need: [3000, 5000], text: 'Earn {n} coins in levels', hint: 'Coins paid for winning levels count.' },
      { counter: 'cards', need: [15, 25], text: 'Collect {n} Playbill cards', hint: 'Open card packs from your rewards.' },
      { counter: 'gems', need: [10, 10], with: 'understage', text: 'Find {n} jewels Under the Stage', hint: 'Dig Under the Stage.' },
      { counter: 'pairs', need: [25, 25], with: 'costumepairs', text: 'Match {n} Costume Pairs', hint: 'Play Costume Pairs.' },
      { counter: 'prizes', need: [6, 10], text: 'Win {n} prizes in other events', hint: 'Prizes from any other side game count.' },
    ],
    rewards: [
      { coins: 300, boosters: { spot: 1 } },
      { coins: 500, packs: 1 },
      { coins: 700, boosters: { show: 1, drill: 1 } },
      { coins: 1000, packs: 2 },
    ],
    grand: { coins: 3000, gold: 1, boosters: { prism: 1 }, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
  },

  // ---- MISSION PURSUIT (type 'pursuit') -------------------------------
  // Three races in turn, each against `rivals` computer runners: first to
  // win targets[0] levels, then targets[1], then targets[2]. Wins need not
  // be in a row. A race starts when you press Start; if a runner gets there
  // first the race is lost and starts again (on Start) with new runners.
  //   minutesPerWin  how long a runner takes per win, between the two
  //                  (each runner its own; Tough makes them 1.3x quicker)
  //   races          the prize for winning each race
  pursuit: {
    type: 'pursuit',
    title: 'Mission Pursuit',
    blurb: 'Seven runners, three races: first to win 3 levels, then 5, then 7. Press Start when you are ready to play.',
    rivals: 6,
    targets: [3, 5, 7],
    minutesPerWin: [5, 12],
    races: [
      { reward: { coins: 300, boosters: { spot: 1 } } },
      { reward: { coins: 600, packs: 1, boosters: { show: 1 } } },
      { reward: { coins: 1500, gold: 1, boost: { powers: ['prism', 'show'], minutes: 30 } } },
    ],
  },

  // ---- THE COMPANY TOURNAMENT (type 'tournament') ---------------------
  // You and your 49 castmates add every level won to one team total.
  //   mateShare   each castmate wins this share of YOUR usual number of
  //               levels (drawn once per castmate, between the two). 1.0-1.95
  //               puts the team near 8,800 by Sunday night (8,000 reached
  //               around Sunday evening)
  //   milestones  at = team total; mustWin = levels YOU must have won to be
  //               paid it (paid the moment both are true)
  //               lives = minutes of unlimited lives
  //   topShown    how many top contributors the screen lists
  tournament: {
    type: 'tournament',
    title: 'The Company Tournament',
    blurb: 'Your whole company of fifty counts every level it wins. 2,000, 5,000 and 8,000 wins open three big prizes. Everybody has to play.',
    mates: 49,
    mateShare: [1.0, 1.95],
    milestones: [
      { at: 2000, mustWin: 5, reward: { boost: { powers: ALL_POWERS, minutes: 15 }, lives: 15 } },
      { at: 5000, mustWin: 15, reward: { boost: { powers: ALL_POWERS, minutes: 30 }, lives: 30 } },
      { at: 8000, mustWin: 30, reward: { coins: 10000 } },
    ],
    topShown: 10,
  },

  // ---- THE GRAND CIRCUIT (type 'circuit') -----------------------------
  // A league of `players` (you + computer players) for one block. Wins pay
  // crownsPerWin by difficulty. At the end the top `up` move up a division,
  // the bottom `down` move down. Your division is remembered between runs.
  //   rivalCrownsPerLevel  crowns a rival gets per level it wins (you
  //                        average about 1.4): higher = a faster division
  //   prizes               by final place in that division
  circuit: {
    type: 'circuit',
    title: 'The Grand Circuit',
    blurb: 'Twenty players tour the circuit. Win levels for crowns; the top five move up a stage, the bottom five move down.',
    players: 20,
    crownsPerWin: [1, 2, 3, 5],
    up: 5,
    down: 5,
    divisions: [
      {
        name: 'Bronze Stage',
        colors: ['#e09050', '#7a3a10'],
        rivalCrownsPerLevel: 1.3,
        prizes: [
          { place: 1, reward: { coins: 800, packs: 1 } },
          { place: 2, reward: { coins: 500 } },
          { place: 3, reward: { coins: 400 } },
          { place: 4, to: 5, reward: { coins: 250 } },
          { place: 6, to: 10, reward: { coins: 100 } },
        ],
      },
      {
        name: 'Silver Stage',
        colors: ['#d8e0f0', '#5a6a8a'],
        rivalCrownsPerLevel: 1.8,
        prizes: [
          { place: 1, reward: { coins: 1500, packs: 2 } },
          { place: 2, reward: { coins: 1000, packs: 1 } },
          { place: 3, reward: { coins: 700, packs: 1 } },
          { place: 4, to: 5, reward: { coins: 400 } },
          { place: 6, to: 10, reward: { coins: 200 } },
        ],
      },
      {
        name: 'Gold Stage',
        colors: ['#ffd84a', '#a06000'],
        rivalCrownsPerLevel: 2.3,
        prizes: [
          { place: 1, reward: { coins: 3000, gold: 1, packs: 2 } },
          { place: 2, reward: { coins: 2000, packs: 2 } },
          { place: 3, reward: { coins: 1500, packs: 1 } },
          { place: 4, to: 5, reward: { coins: 800 } },
          { place: 6, to: 10, reward: { coins: 400 } },
          { place: 11, to: 15, reward: { coins: 150 } },
        ],
      },
    ],
  },

  // ---- BATTLE OF THE COMPANIES (type 'battle') ------------------------
  // Twenty companies; each one's score is the shields its members win. At
  // the end of the block the top companies are paid, and so are the top
  // contributors inside yours. You must add at least `minShields`.
  //   members            people in your company (you + castmates)
  //   shieldsPerWin      your shields for a win, by difficulty
  //   mateShare          each castmate wins this share of your usual levels
  //   mateSkew           2 = most castmates near the low end, a few keen
  //                      ones near the top (1 = spread evenly). With these,
  //                      the top three need about 1.3-1.6x your usual play
  //   mateShieldsPerWin  shields a castmate gets per level won
  //   rivalStrength      the other companies' totals as a share of what
  //                      yours wins on average, by the Relaxed / Even /
  //                      Tough setting
  //   companyNames       names the other companies are drawn from
  battle: {
    type: 'battle',
    title: 'Battle of the Companies',
    blurb: 'Twenty companies, one block. Every level your company wins is a shield. Top five companies are paid, and the top three in yours.',
    teams: 20,
    members: 50,
    shieldsPerWin: [1, 2, 3, 5],
    mateShare: [0.2, 1.6],
    mateSkew: 2,
    mateShieldsPerWin: 1.4,
    rivalStrength: { relaxed: [0.5, 1.0], even: [0.6, 1.1], tough: [0.7, 1.2] },
    minShields: 10,
    companyNames: [
      'The Lantern Players', 'Marigold Rep', 'The Velvet Rope Co.', 'Ironbridge Theatre', 'Crescent Moon Players',
      'The Saltwater Stage', 'Pennywhistle Rep', 'The Gaslamp Guild', 'Bramblewood Players', 'The Copper Kettle Co.',
      'Harbourlight Theatre', 'The Paper Moon Co.', 'Old Mill Players', 'The Juniper Stage', 'Starling Street Rep',
      'The Thimble Theatre', 'Foxglove Players', 'The Lark Rise Co.', 'Northgate Rep', 'The Blue Shutter Players',
      'Wicker Chair Theatre', 'The Gilded Attic', 'Canal Street Players', 'The Hollyhock Co.', 'Riverbend Rep',
      'The Tin Whistle Co.', 'Maple Hall Players', 'The Quayside Stage',
    ],
    teamPrizes: [
      { place: 1, reward: { coins: 2500, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } } },
      { place: 2, reward: { coins: 1800, packs: 2 } },
      { place: 3, reward: { coins: 1200, packs: 1 } },
      { place: 4, to: 5, reward: { coins: 600 } },
    ],
    memberPrizes: [
      { place: 1, reward: { coins: 1500, gold: 1 } },
      { place: 2, reward: { coins: 1000, packs: 1 } },
      { place: 3, reward: { coins: 600, packs: 1 } },
    ],
  },

  // ---- THE DIG (type 'dig') -------------------------------------------
  // Gates of stone blocks with gems buried in known shapes. Levels won pay
  // hammers; one hammer breaks one block.
  //   toolsPerWin   hammers for a win, by difficulty [Rehearsal, Preview,
  //                 Opening Night, Command Performance]
  //   startTools    hammers given when it starts
  //   gates         each: cols x rows of blocks, the gem shapes buried in it
  //                 ([width, height]; may lie either way round), how many
  //                 blocks hide spare hammers, and its prize
  //   cacheHammers  how many hammers one hidden cache holds
  understage: {
    type: 'dig',
    title: 'Under the Stage',
    blurb: 'Win levels for hammers, then dig under the stage for lost jewels. You can see the shapes you are looking for.',
    toolsPerWin: [1, 2, 3, 5],
    startTools: 10,
    cacheHammers: 4,
    gates: [
      { cols: 5, rows: 5, gems: [[1, 1], [2, 1], [2, 2]], caches: 1, reward: { coins: 200, boosters: { spot: 1 } } },
      { cols: 5, rows: 6, gems: [[1, 1], [1, 1], [3, 1], [2, 2]], caches: 1, reward: { coins: 300, packs: 1 } },
      { cols: 6, rows: 6, gems: [[1, 1], [2, 1], [2, 1], [3, 1], [2, 2]], caches: 2, reward: { coins: 500, boosters: { show: 1, drill: 1 } } },
      { cols: 6, rows: 6, gems: [[1, 1], [2, 1], [3, 1], [2, 2], [2, 3]], caches: 2, reward: { coins: 800, packs: 2 } },
      { cols: 6, rows: 7, gems: [[1, 1], [2, 1], [3, 1], [2, 2], [2, 3], [3, 3]], caches: 2, reward: { coins: 1200, boosters: { prism: 1 }, packs: 2 } },
    ],
    grand: { coins: 5000, gold: 1, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
  },

  // ---- THE FIRE WALK (type 'firewalk') --------------------------------
  // A new walk every day, midnight to midnight. Press Start, then win levels
  // ON THE FIRST TRY: each one hops you one stone across the coals. A loss,
  // or a win on a retry, and you slip off: over until tomorrow. Everyone
  // who crosses (you and the computer players) splits the pot evenly.
  //   rivals           computer players walking with you (100 with you)
  //   stones           first-try wins needed to cross
  //   pot              coins shared by everyone who crosses (rounded share)
  //   survive          chance a computer player gets past each stone, in
  //                    order. 0.70 on stone 1 drops about 30 of the 99. With
  //                    these numbers about 4.7 cross on average, counting you.
  //   luck             each day the whole crowd is this much luckier or
  //                    unluckier (0.9 to 1.1)
  //   rivalStartHours  hours of the day when the computer players set out
  //   stoneMinutes     minutes each of their hops takes (between the two)
  //   avatars          walkers you can choose on the play screen
  firewalk: {
    type: 'firewalk',
    title: 'The Fire Walk',
    blurb: 'A hundred step out; seven stones over the coals. Win seven levels in a row, each on the first try, before midnight. Everyone across splits 10,000 coins.',
    rivals: 99,
    stones: 7,
    pot: 10000,
    survive: [0.70, 0.68, 0.66, 0.65, 0.62, 0.55, 0.50],
    luck: [0.9, 1.1],
    rivalStartHours: [8, 16],
    stoneMinutes: [15, 60],
    avatars: ['piggy', 'cat', 'fox', 'owl', 'bunny'],
  },

  // ---- THE BULLSEYE FAIR (type 'archery') ------------------------------
  // A fairground archery contest, one per day on Friday, Saturday and Sunday
  // (each midnight to midnight) against 49 computer archers.
  //   arrowsPerWin     arrows for a win, by difficulty ...
  //   multiplier       ... times your streak: x1, x2, x3 ... up to `max` for
  //                    wins in a row (`step` added per win); a loss = x1
  //   streakResetsDaily  true = each day's contest starts the streak at x1
  //   startArrows      arrows given when the weekend starts
  //   dailyArrows      free arrows at the start of each day's contest
  //   targets          points for hitting each kind of target
  //   maxPointsPerArrow  the most one arrow can score
  //   maxInFlight      arrows fired but not yet reported that are remembered
  //   rivals           computer archers on each day's board
  //   rivalPointsPerLevel  points a rival scores per level it wins
  //   steps            20 step prizes for your own points in one day (for
  //                    Saturday/Sunday; Friday's are scaled down)
  //   prizes           paid at midnight each day by final place
  bullseye: {
    type: 'archery',
    title: 'The Bullseye Fair',
    blurb: 'A new archery contest every day, Friday to Sunday. Win levels for arrows (wins in a row multiply them), then shoot the fairground targets. Top ten each day are paid.',
    arrowsPerWin: [1, 1, 2, 3],
    multiplier: { max: 5, step: 1 },
    streakResetsDaily: true,
    startArrows: 0,
    dailyArrows: 5,
    targets: { balloon: 1, board: 3, duck: 5, gold: 25 },
    maxPointsPerArrow: 60,
    maxInFlight: 50,
    rivals: 49,
    rivalPointsPerLevel: 19,
    steps: [10, 20, 35, 50, 75, 100, 135, 170, 205, 245, 290, 335, 380, 430, 480, 530, 585, 645, 705, 760].map((need, i) => ({
      need,
      reward: [
        { coins: 50 }, { coins: 75 }, { boosters: { spot: 1 } }, { coins: 100 }, { packs: 1 },
        { coins: 100 }, { boosters: { drill: 1 } }, { coins: 150 }, { boost: { powers: ['spot-h'], minutes: 15 } }, { coins: 300, packs: 1 },
        { coins: 150 }, { boosters: { coinflip: 1 } }, { coins: 200 }, { boosters: { show: 1 } }, { coins: 400, packs: 1 },
        { coins: 200 }, { boosters: { stageleft: 1 } }, { coins: 250 }, { boosters: { prism: 1 } }, { coins: 1000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 15 } },
      ][i],
    })),
    prizes: [
      { place: 1, reward: { coins: 1500, gold: 1, boost: { powers: ['prism', 'show'], minutes: 20 } } },
      { place: 2, reward: { coins: 900, packs: 1 } },
      { place: 3, reward: { coins: 600, packs: 1 } },
      { place: 4, to: 10, reward: { coins: 200 } },
    ],
  },

  // ---- COSTUME PAIRS (type 'pairs') -----------------------------------
  // A memory game. Fifteen boards of face-down wardrobe cards, each costume
  // piece twice. Levels won pay tickets; turning over two cards costs one
  // ticket. A match stays up and goes to the rail; a miss turns back.
  //   ticketsPerWin  tickets for a win, by difficulty
  //   startTickets   tickets given when it starts
  //   quickEvery     this many matches in a row refund `quickRefund` tickets
  //   chalk          true = cards you have turned before show a chalk tick
  //                  (never the picture)
  //   spotlightMs    how long a matched spotlight pair lights the whole board
  //   missMs         how long a missed pair stays face up before turning back
  //   wardrobe       the costume pieces (the screen has a picture for each)
  //   steps          each board: cols x rows of cards (must be even), spot =
  //                  one pair is a spotlight pair, chest = shown as a chest
  //   grand          paid after the last board
  costumepairs: {
    type: 'pairs',
    title: 'Costume Pairs',
    blurb: 'Win levels for tickets, then turn over wardrobe cards two at a time. Remember where each piece was.',
    ticketsPerWin: [2, 3, 4, 6],
    startTickets: 10,
    quickEvery: 3,
    quickRefund: 1,
    chalk: true,
    spotlightMs: 1000,
    missMs: 900,
    wardrobe: ['crown', 'tophat', 'fan', 'mask', 'wig', 'cape', 'shoe', 'boa', 'tiara', 'monocle', 'cane', 'ruff'],
    steps: [
      { cols: 3, rows: 4, reward: { coins: 100 } },
      { cols: 3, rows: 4, reward: { boosters: { spot: 1 } } },
      { cols: 3, rows: 4, spot: true, reward: { coins: 150 } },
      { cols: 4, rows: 4, spot: true, reward: { boosters: { drill: 1 } } },
      { cols: 4, rows: 4, spot: true, chest: true, reward: { coins: 500, packs: 1, boosters: { show: 1 } } },
      { cols: 4, rows: 4, spot: true, reward: { coins: 200 } },
      { cols: 4, rows: 5, spot: true, reward: { boost: { powers: ['spot-h'], minutes: 15 } } },
      { cols: 4, rows: 5, spot: true, reward: { packs: 1 } },
      { cols: 4, rows: 5, spot: true, reward: { coins: 250, boosters: { coinflip: 1 } } },
      { cols: 4, rows: 5, spot: true, chest: true, reward: { coins: 1000, packs: 2, boosters: { prism: 1 } } },
      { cols: 4, rows: 6, spot: true, reward: { coins: 300 } },
      { cols: 4, rows: 6, spot: true, reward: { boosters: { stageleft: 1, trapdoor: 1 } } },
      { cols: 4, rows: 6, spot: true, reward: { coins: 200, packs: 1 } },
      { cols: 4, rows: 6, spot: true, reward: { coins: 400, boosters: { show: 1 } } },
      { cols: 4, rows: 6, spot: true, chest: true, reward: { coins: 2000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } } },
    ],
    grand: { coins: 5000, gold: 1, packs: 2, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
  },

  // ---- THE PIRATE MATINEE (type 'voyage') -----------------------------
  // A pirate show on a painted stage sea. Levels won pay cannon shots; one
  // shot fires a burst of cannonballs that ricochet off the walls, the top
  // and the cardboard sea creatures. Each bounce off a creature takes one of
  // its points; at 0 it pops. Clear every creature to finish a round.
  // (All the physics numbers are explained in meta/events/voyage.js.)
  //   shotsPerWin   shots for a win, by difficulty
  //   startShots    shots given when it starts
  //   rounds        twelve: how many small creatures, their points [lo, hi],
  //                 a whale with `boss` points, and a `chest` paid when the
  //                 round is cleared
  //   grand         paid after round 12
  matinee: {
    type: 'voyage',
    title: 'The Pirate Matinee',
    blurb: 'Win levels for cannon shots, then sink the cardboard sea creatures. Twelve rounds, a chest every third.',
    shotsPerWin: [1, 2, 3, 5],
    startShots: 12,
    maxFlying: 40,
    field: { w: 100, h: 150, cannonY: 140, muzzle: 9, top: 6, bottom: 90, side: 3, gap: 2 },
    physics: {
      ballsPerShot: 3, gap: 0.12, speed: 125, gravity: 55, radius: 1.7,
      bounce: 0.92, wallBounce: 0.96, minSpeed: 40, hurtSpeed: 12,
      maxHitsPerBall: 12, maxSeconds: 9, step: 1 / 240, maxAim: 1.36, aimTail: 22,
    },
    kinds: ['octopus', 'crab', 'coil', 'jelly'],
    creatures: { octopus: { r: 8.5 }, crab: { r: 7 }, coil: { r: 6 }, jelly: { r: 6.5 }, whale: { r: 15 } },
    rounds: [
      { count: 4, hp: [2, 4] },
      { count: 5, hp: [2, 4] },
      { count: 6, hp: [3, 4], chest: { coins: 300, boosters: { spot: 1 } } },
      { count: 6, hp: [3, 5] },
      { count: 7, hp: [3, 5] },
      { count: 4, hp: [3, 5], boss: 18, chest: { coins: 600, packs: 1 } },
      { count: 7, hp: [3, 6] },
      { count: 8, hp: [3, 6] },
      { count: 8, hp: [4, 6], chest: { coins: 900, boosters: { show: 1, drill: 1 } } },
      { count: 9, hp: [3, 6] },
      { count: 9, hp: [4, 6] },
      { count: 6, hp: [5, 7], boss: 20 },
    ],
    grand: { coins: 5000, gold: 1, packs: 2, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
  },

  // ---- PAPER DRAGON PARADE (type 'parade') ----------------------------
  // A co-op plinko event. You and three computer teammates build four
  // paper-dragon parade puppets, 3 stages each (12 stages). Levels won pay
  // balls; each ball dropped down the table scores points (pegs, bumpers,
  // kickers) times the slot it lands in. Stage prizes go to you; the 12th
  // stage pays the grand prize and ends the event. Unused balls are lost.
  parade: {
    type: 'parade',
    title: 'Paper Dragon Parade',
    blurb: 'Your team of four builds four giant paper dragons. Win levels for balls, drop them down the parade table, and feed the dragon.',
    ballsPerWin: [1, 2, 3, 5],   // balls per level won: Rehearsal, Preview, Opening Night, Command Performance
    startBalls: 5,               // balls you start with
    slots: [1, 2, 5, 10, 5, 2, 1],                  // the 7 slot multipliers, left to right
    slotWidths: [1.2, 1.05, 1, 0.42, 1, 1.05, 1.2],  // relative widths; a narrow middle keeps 10x rare (~5%)
    points: { bumper: 10, kicker: 5 }, // points per hit: every big bumper 10, the side kickers 5
    minPoints: 5,                // every ball scores at least this many points
    maxPoints: 500,              // points one ball can bank
    teammates: 3,                // computer teammates
    mateTokensPerLevel: 150,     // tokens a teammate gives per level they play
    youShare: 0.4,               // at least this share of the running total must be yours
    dragons: [                   // 4 dragons x 3 stages; need = tokens from the whole team for that stage
      { name: 'Crimson Lantern', colors: ['#ff3a4a', '#8a0a1a', '#ffd23a'], stages: [
        { need: 6000, reward: { coins: 150 } },
        { need: 7500, reward: { boosters: { spot: 1 } } },
        { need: 9000, reward: { coins: 300, packs: 1 } } ] },
      { name: 'Jade River', colors: ['#2ad07a', '#0a5a30', '#fff0a0'], stages: [
        { need: 10000, reward: { coins: 250 } },
        { need: 11500, reward: { boosters: { drill: 1, coinflip: 1 } } },
        { need: 13000, reward: { coins: 500, packs: 1 } } ] },
      { name: 'Midnight Pearl', colors: ['#4a7bff', '#1a1a6a', '#ff9ae0'], stages: [
        { need: 14000, reward: { coins: 400 } },
        { need: 15500, reward: { boosters: { show: 1, stageleft: 1 } } },
        { need: 17000, reward: { coins: 800, packs: 2 } } ] },
      { name: 'Golden Sun', colors: ['#ffc21a', '#a04a00', '#ff4a8a'], stages: [
        { need: 17000, reward: { coins: 600, boosters: { prism: 1 } } },
        { need: 19000, reward: { boost: { powers: ['prism', 'show'], minutes: 30 } } },
        { need: 21500, reward: { coins: 1500, gold: 1, packs: 2 } } ] },
    ],
    grand: { coins: 5000, gold: 1, packs: 2, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 60 } },
  },

  // ---- LEADERBOARD RACES (type 'race') --------------------------------
  //   rivals               how many computer players are on the board
  //   rivalPointsPerLevel  points a rival gets per level they win (you get
  //                        TIER_POINTS, which averages a little over 1)
  //   multiplier           optional: your points are multiplied by 1, 2, 3...
  //                        for wins in a row, up to `max`; a loss resets it
  //   prizes               paid by final place when the race ends
  weekly: {
    type: 'race',
    title: 'The Long Run',
    blurb: 'A week on the boards. Every level won is a point; harder houses pay more.',
    rivals: 49,
    rivalPointsPerLevel: 1.3,
    prizes: [
      { place: 1, reward: { coins: 5000, packs: 3, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 60 } } },
      { place: 2, reward: { coins: 3000, packs: 2 } },
      { place: 3, reward: { coins: 2000, packs: 1 } },
      { place: 4, to: 10, reward: { coins: 600 } },
      { place: 11, to: 25, reward: { coins: 200 } },
    ],
  },
  critics: {
    type: 'race',
    title: "Critics' Circle",
    blurb: 'Win levels to climb the notices. Top ten are paid when the block ends.',
    rivals: 29,
    rivalPointsPerLevel: 1.3,
    prizes: RACE_PRIZES,
  },
  'critics-streak': {
    type: 'race',
    title: "Critics' Circle: Rave Run",
    blurb: 'Wins in a row multiply your points, up to five times. One flop and it is back to one.',
    rivals: 29,
    // Higher than above because your multiplier lifts your own score.
    rivalPointsPerLevel: 3.5,
    multiplier: { max: 5 },
    prizes: RACE_PRIZES,
  },

  // ---- COLLECTION LADDERS (type 'ladder') -----------------------------
  //   collect  what counts, in levels you WIN:
  //              { color: 1 }      pieces of that color cleared
  //              { made: 'under' } power-ups of that kind made
  //   steps    how many each step asks for, and its prize, in order
  //   grand    paid after the last step
  // Sizing: a weekday block is about 80 wins, a weekend about 120.
  'props-rose': {
    type: 'ladder',
    title: 'Prop Room: Roses',
    blurb: 'Clear Roses in levels you win to stock the prop room, shelf by shelf.',
    collect: { color: 1 },
    steps: steps([30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170], SMALL),
    grand: { coins: 3000, packs: 2 },
  },
  'props-lantern': {
    type: 'ladder',
    title: 'Prop Room: Lanterns',
    blurb: 'Clear Lanterns in levels you win to stock the prop room, shelf by shelf.',
    collect: { color: 3 },
    steps: steps([40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230], SMALL),
    grand: { coins: 5000, packs: 3 },
  },
  'props-star': {
    type: 'ladder',
    title: 'Prop Room: Ninja Stars',
    blurb: 'Make Ninja Stars in levels you win. Every one goes on the shelf.',
    collect: { made: 'under' },
    steps: steps([3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22], SMALL),
    grand: { coins: 3000, packs: 2 },
  },

  // BALLOON RISE (type 'ladder' with balloons). Float up ten clouds. Every
  // level WON lifts you `perTier` steps ([Rehearsal, Preview, Opening Night,
  // Command Performance]); every level LOST pops one of `balloons`; when the
  // last pops you sink to the start of the cloud you were climbing to and
  // get a fresh bunch. A finished cloud also gives a fresh bunch.
  balloonrise: {
    type: 'ladder',
    title: 'Balloon Rise',
    blurb: 'Float up past ten clouds. Every win lifts you; every loss pops a balloon. Lose all three and you sink to the start of that cloud.',
    balloons: 3,            // balloons held at the start of every cloud
    perTier: [1, 1, 2, 3],  // steps up for a win, by difficulty
    steps: [                // need = steps up to reach that cloud
      { need: 3, reward: { coins: 100 } },
      { need: 4, reward: { boosters: { spot: 1 } } },
      { need: 4, reward: { coins: 200 } },
      { need: 5, reward: { boosters: { drill: 1 } } },
      { need: 5, reward: { coins: 300, packs: 1 } },
      { need: 6, reward: { boost: { powers: ['spot-h'], minutes: 15 } } },
      { need: 6, reward: { coins: 400 } },
      { need: 7, reward: { boosters: { show: 1, coinflip: 1 } } },
      { need: 7, reward: { coins: 500, packs: 1 } },
      { need: 8, reward: { coins: 800, boosters: { prism: 1 } } },
    ],
    grand: { coins: 2000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } },
  },
  // PIÑATA PARTY (type 'ladder' with pinata). Candies from levels WON fill
  // three piñatas in turn; each one's prize is paid when it is full, then you
  // smash it open on the play screen (the smash only shows the prize).
  pinata: {
    type: 'ladder',
    title: 'Piñata Party',
    blurb: 'Win levels for candies (hard levels pay three and five times as many). Fill a piñata, then smash it open.',
    pinata: true,
    perTier: [10, 10, 30, 50], // candies for a win, by difficulty (x3 and x5 on the hard ones)
    hits: 4,                   // taps of the stick to smash a piñata (screen only)
    steps: [                   // candies to fill each piñata, and what is inside
      { need: 150, reward: { coins: 400, boosters: { spot: 1 } } },
      { need: 250, reward: { coins: 800, packs: 1 } },
      { need: 400, reward: { coins: 1500, packs: 2, boosters: { prism: 1 } } },
    ],
    grand: { coins: 1000, boost: { powers: ['prism', 'show'], minutes: 30 } },
  },
  // THE LONG TOUR (type 'streak', tour form: stages + grids, no lanes).
  //   stages         wins in a row for each town
  //   restartOnLoss  true = a loss goes back to the start of stage 1;
  //                  'stage' = only back to the start of the current stage
  //   gridCols/Rows  the reveal grid (12 tiles)
  //   tiers          prize kinds on the tiles, cheapest first
  //   grids          one per stage: how many tiles of each tier (must add up
  //                  to 12; three of a tier pays it), and each tier's prize.
  //                  A grid opens only the FIRST time its stage is cleared.
  longtour: {
    type: 'streak',
    title: 'The Long Tour',
    blurb: 'Five, seven, then ten wins in a row. A loss starts the town you are in again; towns you finished stay finished. Each new town opens a prize grid: turn tiles until three match.',
    stages: [5, 7, 10],
    restartOnLoss: 'stage',
    gridCols: 3,
    gridRows: 4,
    tiers: ['Bronze', 'Silver', 'Gold'],
    grids: [
      { tiles: [5, 4, 3], prizes: [{ coins: 150 }, { coins: 300, boosters: { spot: 1 } }, { coins: 600, packs: 1 }] },
      { tiles: [4, 4, 4], prizes: [{ coins: 300 }, { coins: 600, packs: 1 }, { coins: 1200, packs: 1, boosters: { prism: 1 } }] },
      { tiles: [3, 4, 5], prizes: [{ coins: 800, packs: 1 }, { coins: 1500, packs: 2 }, { coins: 3000, gold: 1, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } }] },
    ],
  },

  // ---- POWER-UP QUOTA (type 'quota') ----------------------------------
  // Five stages. Each asks for a number of each power-up FIRED in levels
  // you win. Finish a stage within `bonusMinutes` of starting it and the
  // `bonus` is paid on top of the stage `reward`.
  techweek: {
    type: 'quota',
    title: 'Tech Week',
    blurb: 'Run every cue: fire the listed power-ups in levels you win. Beat the clock for a bonus.',
    stages: [
      { need: { spot: 6, under: 4, show: 3, prism: 1 }, reward: { coins: 300 }, bonusMinutes: 60, bonus: { coins: 150 } },
      { need: { spot: 10, under: 8, show: 5, prism: 2 }, reward: { coins: 500, boosters: { spot: 1 } }, bonusMinutes: 120, bonus: { coins: 250 } },
      { need: { spot: 15, under: 12, show: 8, prism: 3 }, reward: { coins: 700, packs: 1 }, bonusMinutes: 180, bonus: { coins: 350 } },
      { need: { spot: 20, under: 16, show: 10, prism: 4 }, reward: { coins: 900, boosters: { show: 1, drill: 1 } }, bonusMinutes: 240, bonus: { coins: 450 } },
      { need: { spot: 25, under: 20, show: 12, prism: 5 }, reward: { coins: 2500, packs: 2 }, bonusMinutes: 300, bonus: { coins: 1000 } },
    ],
  },

  // ---- SHARED POT (type 'company') ------------------------------------
  //   teammates   computer players adding to the same total
  //   chests      the three totals at which a chest opens, and what it pays you
  //   topBonus    extra for being among the top `places` contributors
  // Sizing: nine teammates add about 430 over a weekday block; you add ~100.
  company: {
    type: 'company',
    title: 'The Company',
    blurb: 'The whole company fills one pot. Three chests open as the total grows.',
    teammates: 9,
    rivalPointsPerLevel: 1.3,
    chests: [
      { at: 150, reward: { coins: 400 } },
      { at: 320, reward: { coins: 800, packs: 1 } },
      { at: 500, reward: { coins: 1500, packs: 1, boosters: { prism: 1 } } },
    ],
    topBonus: { places: 3, reward: { coins: 1000, boost: { powers: ['show'], minutes: 30 } } },
  },

  // ---- FIRST TO FINISH (type 'dash') ----------------------------------
  // Starts when you press Start. First of five to win `target` levels.
  //   rivalMinutes  each rival takes between these many minutes to finish
  //   prizes        top three only, and only if they finish
  dash: {
    type: 'dash',
    title: 'Opening Night Dash',
    blurb: 'Five companies, one opening night. First to win 15 levels takes the house.',
    rivals: 4,
    target: 15,
    rivalMinutes: [45, 240],
    prizes: [
      { place: 1, reward: { coins: 2500, packs: 2 } },
      { place: 2, reward: { coins: 1200, packs: 1 } },
      { place: 3, reward: { coins: 600 } },
    ],
  },

  // ---- STREAKS (type 'streak') ----------------------------------------
  // Plain: win `need` levels in a row; a loss puts you back to nothing.
  scottish: {
    type: 'streak',
    title: 'The Scottish Play',
    blurb: 'Win seven in a row. One slip and the run starts over.',
    need: 7,
    reward: { coins: 2000, packs: 1, boost: { powers: ['prism'], minutes: 30 } },
  },
  // Staged: three stages, each a race up the lanes against rivals.
  //   stages        wins in a row needed in each stage
  //   lanes         racers in each stage, counting you
  //   rivalMinutes  how long a rival takes to finish each stage (between
  //                 the two numbers). If a rival gets there first, the stage
  //                 starts again with new rivals.
  //   rewards       one per stage
  ghostlight: {
    type: 'streak',
    title: 'Ghost Light Run',
    blurb: 'Three, five, then seven wins in a row, before the other companies get there.',
    stages: [3, 5, 7],
    lanes: [5, 4, 3],
    rivalMinutes: [[30, 240], [60, 360], [90, 480]],
    rewards: [
      { coins: 500 },
      { coins: 1000, packs: 1 },
      { coins: 2500, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } },
    ],
  },

  // ---- SPRINT (type 'sprint') -----------------------------------------
  // 30 minutes from pressing Start. Counts one power-up fired in levels you
  // win. Only first place is paid.
  //   perDay      how many sprints a day
  //   rivalTotal  each rival's total for the whole sprint (between the two)
  'quickchange-star': {
    type: 'sprint',
    title: 'Quick Change: Ninja Stars',
    blurb: 'Thirty minutes. Fire more Ninja Stars than the other four, in levels you win.',
    power: 'under',
    minutes: 30,
    perDay: 2,
    rivals: 4,
    rivalTotal: [6, 22],
    reward: { coins: 800, packs: 1 },
  },
  'quickchange-grenade': {
    type: 'sprint',
    title: 'Quick Change: Grenades',
    blurb: 'Thirty minutes. Fire more Grenades than the other four, in levels you win.',
    power: 'show',
    minutes: 30,
    perDay: 2,
    rivals: 4,
    rivalTotal: [4, 16],
    reward: { coins: 800, packs: 1 },
  },

  // ---- BRACKET (type 'bracket') ---------------------------------------
  // Eight entrants, three head-to-head rounds. Your score in a round is the
  // number of power-ups you fire during first attempts at levels.
  //   roundMinutes  length of one round
  //   perDay        brackets a day
  //   rivalTotal    an opponent's score for one round (between the two)
  //   prizes        place 1 = won the final, place 2 = lost the final
  callbacks: {
    type: 'bracket',
    title: 'Callbacks',
    blurb: 'Eight hopefuls, three ten-minute rounds. Fire power-ups on first attempts to go through.',
    entrants: 8,
    rounds: 3,
    roundMinutes: 10,
    perDay: 3,
    rivalTotal: [4, 18],
    prizes: [
      { place: 1, reward: { coins: 1500, packs: 1 } },
      { place: 2, reward: { coins: 400 } },
    ],
  },

  // ---- SEASON TRACK (type 'season') -----------------------------------
  // One month, 30 steps. Each level won gives keys (TIER_POINTS). After the
  // last step, every `bankEvery` keys banks `bankCoins` coins, up to
  // `bankMax`; the bank is paid when the month ends.
  // Sizing: about 800 wins a month is about 1,000 keys.
  season: {
    type: 'season',
    title: 'The Season',
    blurb: 'A month of repertory. Every win turns a key; thirty doors, then the takings pile up.',
    steps: steps(new Array(30).fill(25), SMALL),
    bankEvery: 10,
    bankCoins: 100,
    bankMax: 5000,
    // THE GOLD ROW, bought with coins once a month. It pays `rewards` at
    // every step (in turn) and one of `big` at every fifth step; steps
    // already passed are paid at once when it is bought. `perks` are the
    // lines shown on the screen (lives up to 8 is in config/lives.js).
    gold: {
      price: 6000,
      rewards: [
        { coins: 200, boosters: { spot: 1 } },
        { boosters: { drill: 1, coinflip: 1 } },
        { packs: 1, coins: 150 },
        { boost: { powers: ['prism'], minutes: 30 } },
      ],
      big: [
        { gold: 1, coins: 500 },
        { gold: 1, lives: 60, boosters: { prism: 1 } },
        { gold: 1, coins: 1000, boosters: { show: 2 } },
        { gold: 1, lives: 120, packs: 2 },
        { gold: 1, coins: 1500, boosters: { prism: 2, drill: 2 } },
        { gold: 2, coins: 3000, lives: 180, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 60 } },
      ],
      perks: ['Up to 8 lives', 'A second, golden prize at every step', 'A gold card pack every fifth step', 'Your name in gold on the leaderboards'],
    },
  },

  // ---- MILESTONE CHEST (type 'chest') ---------------------------------
  encore: {
    type: 'chest',
    title: 'Encore',
    blurb: 'Every fifty levels won, the house calls you back for a chest.',
    every: 50,
    reward: { coins: 1000, packs: 1, boosters: { drill: 1, coinflip: 1 } },
  },

  // ---- DAILY MISSIONS (type 'missions') -------------------------------
  // Each day unlocks `perDay` missions drawn from `pool`. Each finished
  // mission is one scroll; `track` pays at five scroll totals in the week.
  // Mission kinds (all counted in levels you WIN):
  //   win        win `need` levels
  //   fire       fire `need` of `power`
  //   clear      clear `need` pieces of `color`
  //   movesLeft  win `need` levels with at least `moves` moves to spare
  //   hardFirst  win `need` levels harder than Rehearsal on the first attempt
  callsheet: {
    type: 'missions',
    title: 'Call Sheet',
    blurb: 'Three calls a day. Each one done earns a scroll toward the week\'s rewards.',
    perDay: 3,
    pool: [
      { kind: 'win', need: 5, text: 'Win 5 levels' },
      { kind: 'win', need: 10, text: 'Win 10 levels' },
      { kind: 'fire', power: 'spot', need: 12, text: 'Fire 12 Missiles' },
      { kind: 'fire', power: 'under', need: 8, text: 'Fire 8 Ninja Stars' },
      { kind: 'fire', power: 'show', need: 6, text: 'Fire 6 Grenades' },
      { kind: 'fire', power: 'prism', need: 2, text: 'Fire 2 Magic Balls' },
      { kind: 'clear', color: 0, need: 150, text: 'Clear 150 Masks' },
      { kind: 'clear', color: 2, need: 150, text: 'Clear 150 Quills' },
      { kind: 'clear', color: 4, need: 150, text: 'Clear 150 Fans' },
      { kind: 'movesLeft', moves: 5, need: 2, text: 'Win 2 levels with 5 moves to spare' },
      { kind: 'hardFirst', need: 1, text: 'Win a hard level on the first attempt' },
    ],
    track: [
      { need: 3, reward: { coins: 300 } },
      { need: 6, reward: { boosters: { spot: 1, drill: 1 } } },
      { need: 10, reward: { coins: 600, packs: 1 } },
      { need: 15, reward: { boost: { powers: ['prism', 'show'], minutes: 30 } } },
      { need: 21, reward: { coins: 2000, packs: 2 } },
    ],
  },
};

// FRIDAY BONUS AND WEEKEND PASS. Each is put in the rewards tray the first
// time the Home screen is opened on that day (Friday; Saturday or Sunday).
// Nothing starts by itself: the timed part begins when it is claimed.
export const BONUSES = {
  friday: {
    title: 'Curtain-Raiser',
    reward: {
      coins: 5000,
      // One hour of a free Magic Ball and Grenade at the start of every level.
      boost: { powers: ['prism', 'show'], minutes: 60 },
      // Stands in for "the row shot is free for the hour".
      boosters: { stageleft: 5 },
    },
  },
  weekend: {
    title: 'Weekend Matinee',
    reward: {
      coins: 10000,
      // Twelve hours of a free Magic Ball, Grenade and Missile each level.
      boost: { powers: ['prism', 'show', 'spot-h'], minutes: 720 },
      boosters: { drill: 3, stageleft: 3, trapdoor: 3, coinflip: 3 },
    },
  },
};
