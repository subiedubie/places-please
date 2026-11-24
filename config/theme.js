// THEME: every name and color the player sees lives in this file.
// You can change any text or color here without touching the game rules.
// Colors are ordinary web colors ("#rrggbb").

export const theme = {
  // The name of the game, shown on the Home screen.
  name: 'Places, Please',

  // The five pieces: five cut gems. Their position in this list is their
  // number in the rules (0 = Topaz, 1 = Ruby, ...), so reorder with care.
  //   name   what the piece is called
  //   color  its body color (the lighter and darker facets are worked out
  //          from this one color)
  //   shape  which gem to draw. The drawings are in ui/render.js; the
  //          choices are:
  //            'topaz'     a triangle with blunt tips
  //            'ruby'      a square with cut corners
  //            'sapphire'  round
  //            'emerald'   a tall rectangle with cut corners
  //            'amethyst'  a kite, pointed top and bottom
  //          Each one has a different outline, so the pieces can be told
  //          apart even without color.
  pieces: [
    // These are strong colors on purpose: each one must stand out clearly
    // against a white cell. A pale color (light yellow, say) would not.
    { name: 'Topaz',    color: '#e88a00', shape: 'topaz' },    // amber
    { name: 'Ruby',     color: '#dc1f3c', shape: 'ruby' },     // red
    { name: 'Sapphire', color: '#1766e0', shape: 'sapphire' }, // blue
    { name: 'Emerald',  color: '#0c9a4e', shape: 'emerald' },  // green
    { name: 'Amethyst', color: '#8a3ff0', shape: 'amethyst' }, // violet
  ],

  // The power-ups. The short ids on the left ('spot-h' and so on) are what
  // the rules call them; do not change those. Change only the names.
  //   'spot-h' = clears a row      'spot-v' = clears a column
  //   'under'  = flies to a target 'show'   = clears an area
  //   'prism'  = clears one color
  powers: {
    'spot-h': { name: 'Missile' },
    'spot-v': { name: 'Missile' },
    'under':  { name: 'Ninja Star' },
    'show':   { name: 'Grenade' },
    'prism':  { name: 'Magic Ball' },
  },

  // Colors used to draw the power-ups.
  powerColors: {
    tile: '#ffe07a',     // the gold tile every power-up sits on
    tileEdge: '#a86a00', // the dark gold line around that tile
    glow: 'rgba(255, 196, 0, 0.3)', // the soft gold glow around that tile
    missile: '#d92b2b',  // the Missile arrow
    missileLight: 'rgba(255, 255, 255, 0.4)', // the lit top half of the arrow
    missileEdge: '#6e1010', // the line around the arrow
    star: '#1b2030',     // dark outlines: Ninja Star, Magic Ball
    starLight: '#e3e8f0', // the light half of each Ninja Star blade
    starDark: '#8792a4',  // the dark half of each blade
    starCentre: '#e5383b', // the dot in the middle of the Ninja Star
    grenade: '#2b2f3a',  // the Grenade body
    band: '#e0a100',     // the brass collar on the Grenade
    fuse: '#8a5a2b',     // the Grenade fuse
    spark: '#ff8a00',    // the spark on the fuse
    superGold: '#ffc400', // the ring of spikes behind a Super Magic Ball
    superEdge: '#a86a00', // the line around those spikes
    badge: '#c62f2f',     // the "x2" badge on a Super Magic Ball
    // The light effects when a power-up goes off:
    streakGlow: 'rgba(255, 170, 40, 0.55)', // the glow around a Missile's streak
    blast: '#ffb020',    // the Grenade's ring and flash (and a combo's)
    beam: '#b07cff',     // the Magic Ball's beams
  },

  // Colors used to draw the obstacles (the drawings are in ui/render.js;
  // the obstacle names and rules are in config/obstacles.js).
  obstacleColors: {
    wood: '#d9a066',      // Crate boards
    woodDark: '#8a5a2b',  // Crate outline, the Dovecote perch
    trunk: '#6b3f2a',     // Trunk body
    strap: '#d9b382',     // Trunk straps
    brass: '#e0a100',     // latches, the Padlock body, the Strongbox dial, coins
    tin: '#c3cad6',       // Paint Can metal, Strongbox handle
    shackle: '#6f7a8c',   // the steel hoop of the Padlock
    paintNone: '#8c95a6', // a Paint Can shown without a color (target picture)
    ice: '#cfeafc',       // the pale blue disc behind the Dove picture
    cashbox: '#6f8296',   // Cash Box metal
    safe: '#2f3645',      // Strongbox body, the Footlights panel
    safeDoor: '#454e61',  // Strongbox door
    bag: '#1f8a8a',       // Costume Bag
    sack: '#d8b98a',      // Sandbag
    sackDark: '#8a6a3c',  // Sandbag tie, seams and arrow
    ink: '#1b2030',       // dark details: slots, keyholes, cracks, hit pips
    // Batch 2 (docs/OBSTACLES2.md)
    confettiEdge: '#f2b705', // the line around the small Confetti target picture
    confettiA: '#e5383b',    // the Confetti colors: its border dashes and its dots
    confettiB: '#1f9de0',
    confettiC: '#17a35a',
    confettiD: '#f08a00',
    leaf: '#3faa55',         // Planter and Bouquet foliage
    leafDark: '#2a8244',     // darker foliage, flower stems
    flowerA: '#f25c8a',      // flower colors (Planter, Bouquet)
    flowerB: '#ffb703',
    flowerC: '#8f6fe8',
    flowerMid: '#fff1a8',    // the middle of a flower
    cote: '#ffffff',         // Dovecote walls
    coteEdge: '#aab4c4',     // Dovecote outline, the Dove's outline
    roof: '#d7263d',         // red: Dovecote roof, hat band, cart stripes, lids, ribbon
    steel: '#c9d1dc',        // Lighting Truss rails
    steelDark: '#8792a4',    // Lighting Truss bracing and end plates
    lampLight: '#ffd84a',    // the lit front of a truss lamp
    booth: '#fff7e6',        // Ticket Booth body
    boothStripe: '#e5484d',  // Ticket Booth stripes
    boothGlass: '#27405e',   // Ticket Booth window when open
    glass: '#e3f3fd',        // glass: Candy Jar, Popcorn Cart box, case mirror
    wrap: '#fdf1d6',         // Bouquet paper
    wrapEdge: '#d9b382',     // Bouquet paper outline
    caseLid: '#fbd0e0',      // Makeup Case tray (open)
    velvet: '#b3202e',       // Curtain shown without a color (target picture)
    // The clearer artwork (18 Nov. 2026). Every obstacle gets a dark outline;
    // that outline color is worked out from the colors here (a darker shade).
    crateFrame: '#b9783c',   // Crate: the darker middle panel
    hatWhite: '#fffaf0',     // Hatbox body
    hatBlack: '#2b2f3a',     // Hatbox stripes
    hatLid: '#f06aa5',       // Hatbox lid and knob
    trunkDark: '#4a2a1b',    // Trunk: the line where the lid closes
    iceLight: '#9fe0ff',     // Dry Ice: the paler face of the block
    iceBody: '#46b4ee',      // Dry Ice: the block itself
    iceLine: '#0f5687',      // Dry Ice and glass outlines
    fireworkBox: '#c8324a',  // Fireworks crate
    stone: '#c9c0b2',        // Scenery Flat: the wall blocks
    stoneLight: '#e6dfd3',   // Scenery Flat: the lit top of each block
    stoneGap: '#4d463d',     // Scenery Flat: the gaps between blocks and the outline
    safeInside: '#0b0e18',   // Strongbox: the inside, once the door is blown open
    bagLight: '#35b3ad',     // Costume Bag: the lit side
    gold: '#ffc400',         // gold: stars, the power-only badge, light leaking from a torn bag
    chain: '#9aa5b8',        // Padlock chains
    chainDark: '#2f3645',    // Padlock chain outline
    sackBand: '#6e5226',     // Sandbag: the tie and the outline of its arrow
    pot: '#d0683c',          // Planter pot
    potRim: '#e58a5a',       // Planter pot rim
    candyA: '#ff6fa8',       // Candy Jar candies
    candyB: '#ffd23f',
    candyC: '#3fd0b0',
    hat: '#262b3a',          // Top Hat
    caseEdge: '#7a1f58',     // Makeup Case outline
    caseOpen: '#e0409a',     // Makeup Case when open
    caseClosed: '#a58d9c',   // Makeup Case when closed (dull on purpose)
    badge: '#1b2030',        // the round "hits left" badge
    badgeText: '#ffffff',    // the number on it
    confettiFill: '#ffe066', // the strong yellow of a Confetti cell
    petalFill: '#ffb3d1',    // the strong pink of a Petals cell
    petalEdge: '#d92e78',    // the scalloped border of a Petals cell
  },

  // Difficulty tier names, easiest first.
  tiers: ['', 'Medium level', 'Hard level', 'Hard level'], // ('' = an ordinary level)

  // What a bonus level (every 10th level) is called, shown in place of the
  // tier name on the Home and Level screens.
  bonusName: 'Benefit Night',

  // The boosters. The ids on the left are fixed; change only the names.
  boosters: {
    drill:     { name: 'Drill' },       // clears one cell
    stageleft: { name: 'Stage Left' },  // clears a row
    trapdoor:  { name: 'Trapdoor' },    // clears a column
    coinflip:  { name: 'Coin Flip' },   // reshuffles the pieces
    spot:      { name: 'Missile' },     // start the level with a Missile
    show:      { name: 'Grenade' },     // start the level with a Grenade
    prism:     { name: 'Magic Ball' },  // start the level with a Magic Ball
  },
  // Colors used to draw the booster icons.
  boosterColors: {
    steel: '#6f7a8c',    // the Drill bit
    handle: '#c62f2f',   // the Drill body and the two arrows
    coin: '#e0a100',     // the Coin Flip coin
    coinEdge: '#8a5a2b', // its rim and mark
  },

  // Animation timing, in thousandths of a second per step.
  // Smaller = faster. The "fast" setting in the game halves them all.
  clearMs: 260, // how long matched gems take to pop
  fallMs: 380,  // how long a falling step takes (with its landing bounce)
  flyMs: 750,   // how long a Ninja Star takes to fly to its target
  fxMs: 260,    // how long a power-up's streak, ring or beams take to shoot out
  flipMs: 150,  // how long one gem takes to flip into a power-up (Magic Ball combo)
  // The longest one whole move may take to play. A long chain reaction is
  // sped up evenly so that it still fits in this time.
  moveBudgetMs: 4500,

  // Screen colors (a bright white house with one curtain-red accent).
  ui: {
    background: '#ffffff', // the page behind everything
    panel: '#f6f8fb',      // boxes and cards
    tray: '#e6ebf2',       // the board tray behind the cells, and plain buttons
    line: '#d3dae5',       // thin outlines around boxes and quiet buttons
    cell: '#ffffff',       // white squares elsewhere on the page (not the board)
    // The board. Only the cells you can play on get the tray; a spot where
    // gems never go (a "hole") shows the page background instead.
    board: '#8497bd',      // the tray under the playable cells
    boardEdge: '#2b3654',  // the dark line around the tray, and around every hole
    boardCell: '#dde5f3',  // the lighter square inside each playable cell
    text: '#1b2030',       // main text
    dim: '#5c6478',        // quieter text
    accent: '#c62f2f',     // the main button and highlights (curtain red)
    accentText: '#ffffff', // text on top of the accent color
    danger: '#8a1c1c',     // the Quit / replace confirm button (darker red)
  },
};

export default theme;
