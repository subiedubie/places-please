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

export const EVENTS = {
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
