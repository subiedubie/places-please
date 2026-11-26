// SAVE THE VIOLINIST: the optional rescue episode (rules in meta/rescue.js,
// screen in ui/games/rescue.js).
//
// Every few levels won, the Violinist gets into trouble on stage: the pit
// floods, the curtain catches fire, the sandbag rig frays, a trapdoor opens.
// The player clears gems on a small board to save her. It is optional: it can
// be skipped, and losing it costs nothing (no life, no coins). Winning pays
// a coin prize once per episode.
//
// Change a number or a line of text here, save, and reload the game.

export const RESCUE = {
  // Set to false to switch the rescue episodes off completely.
  enabled: true,

  // Offered after every this-many levels won (8 = after the 8th, 16th, 24th
  // ... win). It counts the player's total wins.
  everyWins: 8,

  // Coins for saving her. Paid once per episode, however many tries it took.
  prizeCoins: 50,

  // How long to wait after Home appears before the episode is offered
  // (thousandths of a second), so the level's own coins can count up first.
  offerDelayMs: 1400,

  // The little board: columns, rows and gem colors (4 = Topaz, Ruby,
  // Sapphire, Emerald). Every scene uses it unless the scene says otherwise.
  board: { cols: 7, rows: 8, colors: 4 },

  // The scenes come round in this order, one per episode.
  order: ['flood', 'fire', 'sandbags', 'trapdoor'],

  // THE SCENES
  //   title     the words on the ribbon above the scene
  //   goal      what to clear: { color: 0..3, need } for one gem color
  //             (0 Topaz, 1 Ruby, 2 Sapphire, 3 Emerald), or { need } alone
  //             for gems of any color
  //   clock     'moves': the danger moves on one step every move
  //             'seconds': the danger moves on all the time (it waits while
  //             gems are falling)
  //   limit     how many moves (or seconds) until the danger reaches her if
  //             nothing is cleared
  //   pushBack  how far each counted gem pushes the danger back, as a share of
  //             the whole way (0.004 = each gem wins back 0.4 % of the way)
  //   ask       the line under the title before play starts
  //   lost      the line shown when she is not saved (keep it silly)
  //   won       the line shown when she is saved
  scenes: {
    flood: {
      title: 'The pit is flooding!',
      goal: { color: 2, need: 65 },
      clock: 'moves',
      limit: 13,
      pushBack: 0.004,
      ask: 'Clear the blue gems to bail out the orchestra pit.',
      lost: 'Soaked to the strings!',
      won: 'Dry feet and a standing ovation!',
    },
    fire: {
      title: 'The curtain is on fire!',
      goal: { need: 240 },
      clock: 'seconds',
      limit: 45,
      pushBack: 0.0008,
      ask: 'Clear gems of any color to fill the fire buckets.',
      lost: 'Well, that is a new hairdo.',
      won: 'Fire out! The show goes on!',
    },
    sandbags: {
      title: 'The rig is fraying!',
      goal: { color: 0, need: 66 },
      clock: 'moves',
      limit: 12,
      pushBack: 0.004,
      ropes: 5, // ropes holding the sandbag; they snap one by one
      ask: 'Clear the amber gems to tie the ropes back up.',
      lost: 'BONK! She is seeing stars.',
      won: 'Tied off tight. Bravo!',
    },
    trapdoor: {
      title: 'The trapdoor is opening!',
      goal: { color: 1, need: 65 },
      clock: 'moves',
      limit: 13,
      pushBack: 0.004,
      ask: 'Clear the red gems to crank the trapdoor shut.',
      lost: 'Down she goes! (She is fine. Mostly dusty.)',
      won: 'Shut tight. Encore!',
    },
  },

  // Words on the screen.
  text: {
    title: 'Rescue!', // the heading at the top of the screen (keep it short)
    help: 'Help me!',
    start: 'Save her!',
    skip: 'Skip',
    again: 'Try again',
    collect: 'Collect',
    later: 'Not now',
    saved: 'Saved!',
    oops: 'Oh no!',
    moves: 'Moves',
    time: 'Time',
    costsNothing: 'Free to play: no lives, no coins.',
  },
};
