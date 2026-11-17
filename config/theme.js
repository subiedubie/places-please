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
    tile: '#fff1c2',     // the pale gold tile every power-up sits on
    tileEdge: '#e0a100', // the thin gold line around that tile
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
    wood: '#d9a066',      // Crate boards, Scenery Flat frame
    woodDark: '#8a5a2b',  // Crate edges and slats
    hatbox: '#fbe3ea',    // Hatbox body
    hatStripe: '#e0559a', // Hatbox stripes and lid
    trunk: '#6b3f2a',     // Trunk body
    strap: '#d9b382',     // Trunk straps
    brass: '#e0a100',     // latches, the Padlock body, the Strongbox dial, coins
    tin: '#c3cad6',       // Paint Can metal, Strongbox handle
    shackle: '#6f7a8c',   // the steel hoop of the Padlock
    paintNone: '#8c95a6', // a Paint Can shown without a color (target picture)
    ice: '#cfeafc',       // Dry Ice block
    iceEdge: '#7fc1ee',   // Dry Ice outline and frost marks
    cashbox: '#6f8296',   // Cash Box metal
    brick: '#c8553d',     // Scenery Flat bricks
    mortar: '#f3d9c9',    // lines between the bricks
    safe: '#2f3645',      // Strongbox body
    safeDoor: '#454e61',  // Strongbox door
    bag: '#1f8a8a',       // Costume Bag
    cord: '#fff1c2',      // Costume Bag drawstring
    sack: '#d8b98a',      // Sandbag
    sackDark: '#8a6a3c',  // Sandbag tie, seams and arrow
    ink: '#1b2030',       // dark details: slots, keyholes, cracks, hit pips
    // Batch 2 (docs/OBSTACLES2.md)
    confettiTint: '#fff4c7', // cell tint under Confetti
    confettiEdge: '#f2b705', // the line around a Confetti cell
    confettiA: '#e5383b',    // the four Confetti dot colors
    confettiB: '#1f9de0',
    confettiC: '#17a35a',
    confettiD: '#f08a00',
    petalTint: '#ffe3ee',    // cell tint under Petals
    petal: '#f58fb3',        // Petals, and the line around a Petals cell
    petalDark: '#e0608f',    // every third petal
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
    popcorn: '#fff0b8',      // popcorn
    wrap: '#fdf1d6',         // Bouquet paper
    wrapEdge: '#d9b382',     // Bouquet paper outline
    ringOn: '#e0a100',       // a lit piece of the progress ring
    ringOff: '#d3dae5',      // an unlit piece of the progress ring
    casePink: '#f277a6',     // Makeup Case body (open)
    caseLid: '#fbd0e0',      // Makeup Case lid and tray (open)
    caseShut: '#b4bcc9',     // Makeup Case when closed
    velvet: '#b3202e',       // Curtain (mixed with its piece color)
  },

  // Difficulty tier names, easiest first.
  tiers: ['Rehearsal', 'Preview', 'Opening Night', 'Command Performance'],

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
    cell: '#ffffff',       // the square behind each piece on the board
    text: '#1b2030',       // main text
    dim: '#5c6478',        // quieter text
    accent: '#c62f2f',     // the main button and highlights (curtain red)
    accentText: '#ffffff', // text on top of the accent color
    danger: '#8a1c1c',     // the Quit / replace confirm button (darker red)
  },
};

export default theme;
