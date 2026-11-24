// THE DIFFICULTY CURVE. Every number that decides what a level looks like is
// in this file. Change a value here, save, reload the game: nothing else needs
// editing. levels/generate.js reads this file and builds level number n.
//
// "Tier" means how hard a level is meant to be:
//   0 = regular, 1 = hard, 2 = super hard, 3 = extremely hard.
// Lists written as [a, b, c, d] below are "one value per tier", in that order.

// A full board with no holes, written as rows of dots (helper for BOARDS below).
function full(cols, rows) {
  return new Array(rows).fill('.'.repeat(cols));
}

export const CURVE = {
  // ---- Which levels are hard -------------------------------------------
  tierPattern: {
    // Looks at the LAST DIGIT of the level number.
    // 5: 1 means levels 5, 15, 25 ... are tier 1 (hard).
    // 8: 2 means levels 8, 18, 28 ... are tier 2 (super hard).
    // Levels ending in 0 are reserved for the bonus level (a later phase);
    // for now they are regular levels, so they are not listed here.
    byLastDigit: { 5: 1, 8: 2 },
    // Extremely hard levels: one in every `every` levels, at position `at`.
    // every 30, at 23 gives levels 23, 53, 83 ...
    tier3: { every: 30, at: 23 },
  },

  // ---- How many piece colors ---------------------------------------------
  colors: {
    early: 4, // number of colors on the early levels
    earlyThroughLevel: 0, // the last level that uses the `early` number
    later: 5, // number of colors after that
    alwaysLaterFromTier: 2, // tiers this high or higher always use `later`
  },

  // ---- Board shapes ------------------------------------------------------
  // Each board is drawn as text, one character per cell:
  //   .  a playable cell        #  a hole (no cell there)
  // Every row of one board must be the same length.
  // fromLevel / toLevel: the levels where this shape may be used
  // (toLevel: null means "no end"). When several shapes are allowed for a
  // level, one is picked by a random number fixed by the level number, so a
  // given level always gets the same shape.
  // Rule the tests enforce: every column keeps at least 4 playable cells.
  boards: [
    // Plain rectangles: only at the very start of each board size, and
    // the large one stays in the mix as one shape among many.
    { name: 'full 7x8', fromLevel: 1, toLevel: 4, layout: full(7, 8) },
    { name: 'full 8x9', fromLevel: 11, toLevel: 13, layout: full(8, 9) },
    { name: 'full 9x10', fromLevel: 21, toLevel: null, layout: full(9, 10) },
    // Shaped boards. To add one, copy an entry and redraw it.
    {
      name: '7: cut corners',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '#.....#',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '#.....#',
      ],
    },
    {
      name: '7: top notch',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '...#...',
        '...#...',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
      ],
    },
    {
      name: '7: side bites',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '.......',
        '.......',
        '#.....#',
        '#.....#',
        '.......',
        '.......',
        '.......',
        '.......',
      ],
    },
    {
      name: '7: waist',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '.......',
        '.......',
        '#.....#',
        '##...##',
        '#.....#',
        '.......',
        '.......',
        '.......',
      ],
    },
    {
      name: '7: two towers',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '..###..',
        '..###..',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
      ],
    },
    {
      name: '7: centre gap',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '.......',
        '.......',
        '.......',
        '...#...',
        '...#...',
        '.......',
        '.......',
        '.......',
      ],
    },
    {
      name: '7: diamond',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '##...##',
        '#.....#',
        '.......',
        '.......',
        '.......',
        '.......',
        '#.....#',
        '##...##',
      ],
    },
    {
      name: '7: stairs',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '....###',
        '.....##',
        '......#',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
      ],
    },
    {
      name: '7: split floor',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '...#...',
        '...#...',
      ],
    },
    {
      name: '7: twin pillars',
      fromLevel: 3,
      toLevel: 24,
      layout: [
        '.......',
        '.......',
        '..#.#..',
        '..#.#..',
        '..#.#..',
        '..#.#..',
        '.......',
        '.......',
      ],
    },
    {
      name: '8: cut corners',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '##....##',
        '#......#',
        '........',
        '........',
        '........',
        '........',
        '........',
        '#......#',
        '##....##',
      ],
    },
    {
      name: '8: centre block',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '........',
        '........',
        '........',
        '...##...',
        '...##...',
        '........',
        '........',
        '........',
        '........',
      ],
    },
    {
      name: '8: top notch',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '...##...',
        '...##...',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ],
    },
    {
      name: '8: side bites',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '........',
        '........',
        '........',
        '#......#',
        '#......#',
        '#......#',
        '........',
        '........',
        '........',
      ],
    },
    {
      name: '8: letter H',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '..####..',
        '..####..',
        '........',
        '........',
        '........',
        '........',
        '........',
        '..####..',
        '..####..',
      ],
    },
    {
      name: '8: four posts',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '........',
        '........',
        '..#..#..',
        '........',
        '........',
        '........',
        '..#..#..',
        '........',
        '........',
      ],
    },
    {
      name: '8: arrowhead',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '###..###',
        '##....##',
        '#......#',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ],
    },
    {
      name: '8: zigzag',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '........',
        '........',
        '##......',
        '##......',
        '........',
        '......##',
        '......##',
        '........',
        '........',
      ],
    },
    {
      name: '8: castle wall',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '#.#..#.#',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ],
    },
    {
      name: '8: funnel',
      fromLevel: 11,
      toLevel: null,
      layout: [
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '#......#',
        '##....##',
        '###..###',
      ],
    },
    {
      name: 'cut corners',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '##.....##',
        '#.......#',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '#.......#',
        '##.....##',
      ],
    },
    {
      name: 'centre pillar',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '....#....',
        '....#....',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'side notches',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '#.......#',
        '#.......#',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'four posts',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '..#...#..',
        '.........',
        '.........',
        '..#...#..',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'hourglass',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '#.......#',
        '##.....##',
        '##.....##',
        '#.......#',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'big corners',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '###...###',
        '##.....##',
        '#.......#',
        '.........',
        '.........',
        '.........',
        '.........',
        '#.......#',
        '##.....##',
        '###...###',
      ],
    },
    {
      name: 'two rooms',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '....#....',
        '....#....',
        '....#....',
        '....#....',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'window',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '...###...',
        '...###...',
        '...###...',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'battlements',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.#.#.#.#.',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'horseshoe',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '...###...',
        '...###...',
        '...###...',
        '...###...',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'narrow waist',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '#.......#',
        '#.......#',
        '#.......#',
        '#.......#',
        '#.......#',
        '#.......#',
        '.........',
        '.........',
      ],
    },
    {
      name: 'diagonal bites',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '##.......',
        '#........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '........#',
        '.......##',
      ],
    },
    {
      name: 'four windows',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.##...##.',
        '.##...##.',
        '.........',
        '.........',
        '.##...##.',
        '.##...##.',
        '.........',
        '.........',
      ],
    },
    {
      name: 'butterfly',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '#...#...#',
        '#...#...#',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'narrow top',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '###...###',
        '###...###',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    {
      name: 'split floor',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '...###...',
        '...###...',
        '...###...',
      ],
    },
    {
      name: 'steps',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '......###',
        '.......##',
        '........#',
        '.........',
        '.........',
        '.........',
        '.........',
        '#........',
        '##.......',
        '###......',
      ],
    },
    {
      name: 'keyhole',
      fromLevel: 21,
      toLevel: null,
      layout: [
        '##.....##',
        '##.....##',
        '.........',
        '.........',
        '.........',
        '....#....',
        '...###...',
        '....#....',
        '.........',
        '.........',
      ],
    },
  ],

  // ---- Targets (what the player must collect) ----------------------------
  targets: {
    oneTargetThroughLevel: 10, // levels up to this one have exactly 1 target
    maxTargets: 3, // after that: 1 up to this many, picked per level
    // How many pieces a level asks for when it has ONE target, per tier.
    baseNeed: [30, 40, 50, 60],
    // With more targets, each one asks for less. Position 1 = one target,
    // position 2 = two targets, position 3 = three targets.
    // need for each target = baseNeed for the tier x this factor, rounded.
    // Example: tier 0 with 3 targets = 30 x 0.45 = 14 of each color.
    needFactor: [1, 0.6, 0.45],
  },

  // ---- Moves -------------------------------------------------------------
  // Moves the player gets, per tier. Deliberately generous for now so every
  // level can be won; phase 2's simulator will replace these.
  baseMoves: [24, 24, 23, 22],

  // ---- Obstacles ---------------------------------------------------------
  // What each obstacle is and how it breaks is in config/obstacles.js.
  // This part decides WHERE and WHEN obstacles show up.
  obstacles: {
    // The level where each obstacle first appears. On that level it is the
    // only obstacle, so the player meets it on its own. If the level named
    // here is one that has no obstacles (see `skipLastDigits` below), the
    // obstacle is introduced on the next level that does have them
    // (so 20 becomes 21 and 50 becomes 51).
    intro: {
      crate: 4,
      hatbox: 7,
      dryice: 11,
      paint: 14,
      trunk: 17,
      cashbox: 21,
      costume: 24,
      strongbox: 27,
      flat: 31,
      padlock: 34,
      sandbag: 37,
    },

    // The same for the second batch of obstacles (docs/OBSTACLES2.md).
    // A kind listed here is only used once the game engine says it supports
    // it (BATCH2_READY in config/obstacles.js); until then the generator
    // behaves as if the line were not here.
    intro2: {
      confetti: 41,
      bouquet: 44,
      candyjar: 47,
      tophat: 51,
      popper: 54,
      planter: 57,
      dovecote: 61,
      truss: 64,
      ticketbooth: 67,
      footlights: 71,
      fireworks: 72,
      makeupcase: 74,
      curtain: 75,
    },

    // Which levels have obstacles at all.
    fromLevel: 4, // levels before this one never have obstacles
    everyNth: 1, // 1 = every level from `fromLevel` on, 2 = every second level, ...
    skipLastDigits: [0], // levels ending in these digits never have obstacles (10, 20, 30 ... will be bonus levels)

    // The most different obstacle kinds on one level, per tier.
    // (The sandbag counts as a kind.)
    maxKinds: [2, 3, 3, 4],

    // How many cells one obstacle kind covers on a level: a number between
    // `min` and `max` is picked for each kind. `max` is one value per tier.
    cellsPerKind: { min: 4, max: [9, 14, 18, 22] },

    // Safety rules for every level.
    freeTopRows: 2, // this many rows at the top never hold obstacles, so pieces can enter
    minOrdinaryShare: 0.4, // at least this share of the board's cells stay ordinary (0.4 = 40%)
    maxSealedShare: 0.25, // at most this share of the cells may be cut off from falling pieces at the start

    // Obstacles that need a power-up to break. They are rationed.
    // (truss and ticketbooth are from batch 2; every cell they cover counts.)
    powerOnlyKinds: ['cashbox', 'flat', 'strongbox', 'padlock', 'truss', 'ticketbooth'],
    powerOnlyMax: 8, // at most this many power-only cells on one level, all kinds together
    maxPerKind: { flat: 5 }, // a tighter limit for single kinds

    // Paint cans are laid in straight lines, each line one color.
    paint: { minLines: 2, maxLines: 3 },

    // Padlocks: the chance (0 to 1) that a padlock holds another obstacle of
    // the same level instead of an ordinary piece.
    padlockHoldsBlockChance: 0.5,

    // Sandbags (the obstacle that falls and is collected at the bottom).
    sandbags: {
      min: 2, // fewest on a level
      max: 5, // most on a level
      startRows: [2, 3], // rows they may start in (the top row is row 0)
    },

    // When a level with obstacles still has room for another target, the
    // chance (0 to 1) that a color target is added. 0.33 = about 1 level in 3.
    colorTargetChance: 0.33,

    // Extra moves for obstacle levels, on top of baseMoves.
    // Each hit an obstacle needs adds this many moves; each sandbag adds
    // `perSandbag`. The total is rounded and never goes above `cap`.
    // Placeholders, deliberately generous, until the simulator tunes them.
    extraMoves: {
      perMatchHit: 0.5, // a hit that a normal match can give
      perPowerHit: 1.4, // a hit that only a power-up can give
      perSandbag: 2,
      // Batch 2 (placeholders too):
      perFloorCell: 0.3, // each confetti floor cell
      perProduct: 2, // each dove or popcorn the level asks for
      perBigHit: 0.8, // each match hit a planter or dovecote needs
      perListColor: 1.5, // each color on a footlights or fireworks block
      perMakeupCase: 1.5, // each makeup case
      perCurtainPiece: 0.5, // each piece a curtain needs before it opens
      cap: 60, // the most moves any level gets
    },

    // ---- Batch 2 placement (docs/OBSTACLES2.md) ---------------------------
    batch2: {
      // How many cells wide and tall each big block is: [width, height].
      // Must agree with config/obstacles.js (if that file gives a size for
      // a kind, the generator uses that one). A truss is 1 tall and as wide
      // as `truss` below says.
      sizes: {
        planter: [2, 2],
        dovecote: [2, 2],
        footlights: [2, 2],
        fireworks: [2, 1],
        ticketbooth: [3, 1],
      },
      // How many of each kind go on a level: [fewest, most].
      // (Kinds not listed here have their own block below.)
      counts: {
        bouquet: [3, 6],
        candyjar: [3, 6],
        makeupcase: [4, 8],
        planter: [1, 3],
        dovecote: [1, 2],
        footlights: [1, 2],
        fireworks: [2, 4],
        truss: [1, 2],
        ticketbooth: [1, 2],
      },
      // Confetti floor: how many cells it covers. `max` is one value per tier.
      confetti: { min: 8, max: [14, 16, 18, 20] },
      // Top hats and popcorn carts (they never break, they hand out doves
      // and popcorn). `needPerPair` = how many products the level asks for
      // per two generators; the total never goes above `needCap`.
      generators: { min: 2, max: 6, needPerPair: 6, needCap: 24 },
      bigHits: { planter: 5, dovecote: 5 }, // match hits each one takes (for the move allowance)
      candyPerJar: 3, // candies one jar gives (one per hit)
      confettiPerPlanter: 4, // confetti cells a planter leaves when it breaks
      // How many colors a color-list block starts with (never more than the
      // level has).
      listColors: { footlights: 4, fireworks: 3 },
      truss: { minWidth: 3, maxWidth: 5 }, // cells wide
      // Curtains: a rectangle standing on the bottom row.
      curtain: {
        heights: [2, 3], // rows tall: one of these is picked
        sideMargin: 1, // columns left open at each side
        maxColors: 2, // one color, or the left half one color and the right half another
        needMin: 20, // pieces of its color to clear before a curtain opens: between
        needMax: 30, //   needMin and needMax, picked per color
        insideChance: 0.3, // chance (0 to 1) that a curtain cell hides an ordinary piece
      },
    },

    // Placement patterns. Each one lists board cells as [column, row], in
    // the order they should be filled; the generator takes as many as it
    // needs from the front of the list and skips holes, the free top rows
    // and cells already taken. `cols` and `rows` are the board size (the top
    // row is row 0, the left column is column 0). To retire a pattern,
    // delete it; to add one, copy one and change the name and the cells.
    patterns: {
      // The two bottom rows, lowest row first.
      'bottom rows': (cols, rows) => {
        const out = [];
        for (let y = rows - 1; y >= rows - 2; y--) {
          for (let x = 0; x < cols; x++) out.push([x, y]);
        }
        return out;
      },
      // A solid block in the middle of the board, 3 rows tall.
      'centre block': (cols, rows) => {
        const w = cols % 2 === 1 ? 3 : 4;
        const x0 = (cols - w) / 2;
        const y0 = Math.floor((rows - 3) / 2) + 1;
        const out = [];
        for (let y = y0 + 2; y >= y0; y--) {
          for (let x = x0; x < x0 + w; x++) out.push([x, y]);
        }
        return out;
      },
      // The left and right edge columns, from the bottom up.
      'side columns': (cols, rows) => {
        const out = [];
        for (let y = rows - 1; y >= 2; y--) out.push([0, y], [cols - 1, y]);
        return out;
      },
      // A frame one cell in from the edges: bottom first, then the two
      // sides, the top last (so a short ring is a cup that is open on top).
      ring: (cols, rows) => {
        const out = [];
        for (let x = 1; x <= cols - 2; x++) out.push([x, rows - 2]);
        for (let y = rows - 3; y >= 4; y--) out.push([1, y], [cols - 2, y]);
        for (let x = 1; x <= cols - 2; x++) out.push([x, 3]);
        return out;
      },
      // Every second cell of a patch in the lower middle, like a chessboard.
      'checkerboard patch': (cols, rows) => {
        const out = [];
        for (let y = rows - 2; y >= rows - 5; y--) {
          for (let x = 1; x <= cols - 2; x++) {
            if ((x + y) % 2 === 0) out.push([x, y]);
          }
        }
        return out;
      },
      // Single cells sprinkled anywhere below the free top rows.
      // (`rng` is the level's own random number source.)
      'scattered singles': (cols, rows, rng) => {
        const out = [];
        for (let y = 2; y < rows; y++) {
          for (let x = 0; x < cols; x++) out.push([x, y]);
        }
        for (let i = out.length - 1; i > 0; i--) {
          const j = rng.int(i + 1);
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      },
      // A band just under the free top rows; the two edge columns stay open
      // so pieces can still get past it.
      'top band': (cols) => {
        const out = [];
        for (let y = 2; y <= 3; y++) {
          for (let x = 1; x <= cols - 2; x++) out.push([x, y]);
        }
        return out;
      },
      // A heap on the floor: wide at the bottom, narrower each row up.
      pyramid: (cols, rows) => {
        const out = [];
        for (let step = 0; step < 4; step++) {
          for (let x = 1 + step; x <= cols - 2 - step; x++) out.push([x, rows - 1 - step]);
        }
        return out;
      },
    },
  },
};
