// THEME: every name and color the player sees lives in this file.
// You can change any text or color here without touching the game rules.
// Colors are ordinary web colors ("#rrggbb").

export const theme = {
  // The name of the game, shown on the Home screen.
  name: 'Places, Please',

  // The five pieces. Their position in this list is their number in the
  // rules (0 = Mask, 1 = Rose, ...), so reorder with care.
  //   name   what the piece is called
  //   color  its fill color
  //   shape  which drawing to use. The drawings are in ui/render.js;
  //          the choices are: 'mask', 'rose', 'quill', 'lantern', 'fan'.
  //          Each one has a different outline, so the pieces can be told
  //          apart even without color.
  pieces: [
    // These are strong colors on purpose: each one must stand out clearly
    // against a white cell. A pale color (light yellow, say) would not.
    { name: 'Mask',    color: '#d97706', shape: 'mask' },    // amber
    { name: 'Rose',    color: '#d7263d', shape: 'rose' },    // crimson
    { name: 'Quill',   color: '#1f6fe5', shape: 'quill' },   // blue
    { name: 'Lantern', color: '#0b8a48', shape: 'lantern' }, // green
    { name: 'Fan',     color: '#7b3fe4', shape: 'fan' },     // violet
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
    missile: '#c62f2f',  // the Missile arrow
    star: '#1b2030',     // the Ninja Star
    grenade: '#2b2f3a',  // the Grenade body
    band: '#e0a100',     // the Grenade band
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
  },

  // Difficulty tier names, easiest first.
  tiers: ['Rehearsal', 'Preview', 'Opening Night', 'Command Performance'],

  // Animation timing, in thousandths of a second per step.
  // Smaller = faster. The "fast" setting in the game halves both.
  clearMs: 80, // how long a clearing step takes
  fallMs: 90,  // how long a falling step takes

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
