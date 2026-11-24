// OBSTACLES. Each entry says how an obstacle is broken. Edit the numbers and
// names here; the rules read this file.
//
// `hits` lists what each hit must be, from the first hit to the last. The
// obstacle is gone when the list is used up. Each entry is one of:
//   'any'    a match right next to it, or a power-up blast
//   'match'  only a match right next to it
//   'power'  only a power-up blast
//   'color'  a match right next to it in the obstacle's own color, or a power-up blast
//
// `leaves` says what is left behind when it breaks:
//   'nothing' (the default), 'inside' (whatever it was holding), or
//   'power' (a random power-up).
//
// The Royal Match obstacle each one behaves like is noted for reference only;
// the names and the artwork are ours.

export const OBSTACLES = {
  crate:     { name: 'Crate',       hits: ['any'] },                    // like the Royal Egg: one match next to it
  hatbox:    { name: 'Hatbox',      hits: ['any', 'any'] },             // like the Vase: two
  trunk:     { name: 'Trunk',       hits: ['any', 'any', 'any'] },      // like the Oyster: three
  paint:     { name: 'Paint Can',   hits: ['color'] },                  // like the Color Box: a match of its own color
  dryice:    { name: 'Dry Ice',     size: [1, 1], hits: ['any'], retract: true }, // a bar: every match beside it melts one square off its end
  cashbox:   { name: 'Cash Box',    hits: ['power'] },                  // like the Porcelain Piggy: power-ups only
  flat:      { name: 'Scenery Flat', hits: ['power', 'power', 'power'] }, // like Stone: three power-up hits
  strongbox: { name: 'Strongbox',   hits: ['power', 'match'] },         // like the Rock: a power-up, then a match
  costume:   { name: 'Costume Bag', hits: ['any', 'any', 'any'], leaves: 'power' }, // like the Pouch: reveals a power-up
  padlock:   { name: 'Padlock',     hits: ['power'], leaves: 'inside' }, // like the Chain: frees what it holds
};

// The one obstacle that moves: it falls like a piece and is collected when it
// reaches the bottom of its column (like the Frog).
export const DROPPER = { id: 'sandbag', name: 'Sandbag' };
// Every kind of thing that falls and is collected at the bottom.
export const DROPPERS = { sandbag: 'Sandbag', dove: 'Dove', tortoise: 'Tortoise', trophy: 'Trophy', duck: 'Rubber Duck', flyer: 'Flying Rig' };

// ---- Batch 2 (docs/OBSTACLES2.md) -------------------------------------------
//
// The floor layer: something lying UNDER a cell. It is removed when whatever
// stands on that cell is cleared.
export const FLOORS = {
  confetti: { name: 'Confetti' }, // like Grass
  petals:   { name: 'Petals' },   // like Leaves; spread by a bouquet
};

// Same style as OBSTACLES above, with a few more settings:
//   size       [width, height] in cells (a truss takes its width from the level)
//   leaves     also: 'confetti' / 'petals' (floor is laid when it breaks),
//              'blast' (it goes off like a Grenade), 'power' (EVERY cell it
//              covered becomes a random power-up)
//   generator  true = never breaks; every `every`-th match hit gives one `product`
//   product    what a hit hands the player (counted by a target of that name)
//   colorList  how many colors it starts with; each must be matched next to it
//   toggles    true = opens and closes after every move; only hit while open
//   curtain    true = takes no hits; opens when enough of its color is cleared
// Batch 3 (23 Nov. 2026):
//   retract    a bar: every hit takes one square off its far end
//   vine       a bar of segments; each loses its flowers, then is cut, and
//              everything beyond the cut falls off with it
//   roll       covers an area; every hit rolls it up by one row, and the row it
//              leaves holds Crates
//   linked     when one breaks, every one of them joined to it in the row does
//   leaves     also: 'bigblast', 'rocket' (flies at something needed), 'beam'
//              (clears its rows and columns), 'toss' (throws `count` of `what`
//              onto gems), 'goo' (covers the 3x3 around it), 'spike' (flies to
//              the nearest Barrel)
//   charge     takes no hits; after that many spikes it rolls across the board
// Batch 4 (24 Nov. 2026):
//   feeds      (with leaves 'spike') which charged obstacle its spike flies to;
//              `look` is the picture that flies
//   release    what a charged obstacle does when it is full: 'roll' (the
//              default), 'shatter' (hits the whole board), 'bigblast', 'drop'
//              (it just falls away)
//   each       what EVERY hit sets off (the last one by `leaves`)
//   leaves     also: 'laser' (its middle row and three columns), 'storm' (hits
//              `count` things anywhere), 'bursts' (`count` small blasts where
//              they help most), 'under' (shows the crates behind it), 'drop'
//              (a falling `what`), 'petalrow' (petals all along its row)
const M5 = ['match', 'match', 'match', 'match', 'match'];
export const OBSTACLES2 = {
  planter:     { name: 'Planter',        size: [2, 2], hits: M5, leaves: 'confetti' },            // like the Bush
  bouquet:     { name: 'Bouquet',        size: [1, 1], hits: ['any', 'any'], leaves: 'petals' },  // like the Flowerpot
  tophat:      { name: 'Top Hat',        size: [1, 1], hits: [], generator: true, every: 3, product: 'dove' },    // like the Magic Hat
  popper:      { name: 'Popcorn Cart',   size: [1, 1], hits: [], generator: true, every: 3, product: 'popcorn' }, // like the Cauldron
  candyjar:    { name: 'Candy Jar',      size: [1, 1], hits: ['any', 'any', 'any'], product: 'candy' },           // like the Jar
  dovecote:    { name: 'Dovecote',       size: [2, 2], hits: M5, leaves: 'doves' },               // like the Birdhouse: doves fall out
  footlights:  { name: 'Footlights',     size: [2, 2], hits: [], colorList: 4 },                  // like the Light Bulb
  fireworks:   { name: 'Fireworks',      size: [2, 1], hits: [], colorList: 3, leaves: 'bigblast' }, // a huge round blast
  truss:       { name: 'Lighting Truss', size: [3, 1], hits: ['power'], retract: true },                // a bar: every power-up takes one square off
  ticketbooth: { name: 'Ticket Booth',   size: [3, 1], hits: ['power', 'match', 'match', 'match'], leaves: 'power' }, // like the Slot Machine
  makeupcase:  { name: 'Makeup Case',    size: [1, 1], hits: ['match'], toggles: true },          // like the Bow Tie box
  // Twists (config/twists.js): they act by themselves; see engine/twists.js.
  ivy:         { name: 'Creeping Ivy',   size: [1, 1], hits: ['any'], twist: true },
  mouse:       { name: 'Stage Mouse',    size: [1, 1], hits: ['any'], twist: true },
  paintkeg:    { name: 'Paint Keg',      size: [1, 1], hits: ['any', 'any', 'any'], leaves: 'paint', twist: true }, // bursts and splashes paint
  // Batch 3: they come on the set pieces (levels/sets.js).
  vine:        { name: 'Rose Vine',      size: [6, 1], hits: ['any'], vine: true, set: true },
  rolldrop:    { name: 'Painted Drop',   size: [4, 4], hits: ['any'], roll: true, set: true },
  fusebox:     { name: 'Fuse Box',       size: [1, 1], hits: ['power', 'power'], linked: true, set: true },
  rigbag:      { name: 'Tool Bag',       size: [1, 1], hits: ['any', 'any'], leaves: 'spike', set: true },
  barrel:      { name: 'Barrel',         size: [1, 3], hits: [], charge: 3, set: true },
  followspot:  { name: 'Follow Spot',    size: [2, 2], hits: ['power', 'any', 'any', 'any'], leaves: 'beam', set: true },
  dressing:    { name: 'Dressing Room',  size: [2, 2], hits: ['any', 'any', 'any', 'any'], leaves: 'toss', what: 'giftbox', count: 3, set: true },
  giftbox:     { name: 'Fan Gift',       size: [1, 1], hits: ['any', 'any'], set: true },
  greasepot:   { name: 'Greasepaint',    size: [1, 1], hits: ['any', 'any'], leaves: 'goo', set: true },
  goo:         { name: 'Spilled Paint',  size: [1, 1], hits: ['any'], set: true },
  propcase:    { name: 'Prop Case',      size: [1, 1], hits: ['any', 'any'], set: true },
  rope:        { name: 'Backstage',      size: [1, 1], hits: ['any'], set: true },
  cannon:      { name: 'Streamer Cannon', size: [1, 1], hits: ['any', 'any'], leaves: 'rocket', set: true },
  // Batch 4: more set pieces.
  dimmer:      { name: 'Dimmer Box',     size: [2, 2], hits: ['any', 'any', 'any', 'any'], leaves: 'spike', feeds: 'chandelier', look: 'zap', set: true },
  chandelier:  { name: 'Chandelier',     size: [2, 2], hits: [], charge: 3, release: 'shatter', set: true },
  flamepot:    { name: 'Flame Pot',      size: [1, 1], hits: ['power', 'any', 'any', 'any'], leaves: 'bursts', count: 3, look: 'fireball', set: true },
  laser:       { name: 'Laser',          size: [1, 3], hits: ['any', 'any', 'any', 'any', 'any'], leaves: 'laser', set: true },
  thunder:     { name: 'Thunder Machine', size: [2, 2], hits: ['any', 'any', 'any', 'any', 'any'], leaves: 'storm', count: 12, set: true },
  flowercart:  { name: 'Flower Cart',    size: [1, 1], hits: ['any', 'any', 'any'], leaves: 'petalrow', set: true },
  maskrack:    { name: 'Mask Rack',      size: [5, 1], hits: ['any'], retract: true, each: 'toss', leaves: 'toss', what: 'mask', count: 1, set: true },
  mask:        { name: 'Mask',           size: [1, 1], hits: ['any'], set: true },
  grandsafe:   { name: 'Grand Safe',     size: [2, 2], hits: ['power', 'power', 'power'], leaves: 'toss', what: 'cashbox', count: 4, set: true },
  pastepot:    { name: 'Paste Pot',      size: [1, 1], hits: ['any', 'any'], leaves: 'spike', feeds: 'poster', look: 'scrap', set: true },
  poster:      { name: 'Poster',         size: [4, 2], hits: [], charge: 8, release: 'bigblast', set: true },
  trophycase:  { name: 'Trophy Case',    size: [2, 2], hits: ['any', 'any', 'any', 'any', 'any'], leaves: 'drop', what: 'trophy', set: true },
  safetycurtain: { name: 'Safety Curtain', size: [4, 3], hits: ['any', 'any', 'any', 'any', 'any'], leaves: 'under', set: true },
  gel:         { name: 'Color Gel',      size: [1, 1], hits: ['color', 'any'], set: true },
  programs:    { name: 'Program Stand',  size: [2, 2], hits: ['any', 'any', 'any', 'any'], toggles: true, product: 'program', set: true },
  bubbles:     { name: 'Bubble Bath',    size: [1, 1], hits: ['any'], leaves: 'inside', set: true },
  pin:         { name: 'Belaying Pin',   size: [1, 1], hits: ['any', 'any'], leaves: 'spike', feeds: 'weight', look: 'pin', set: true },
  weight:      { name: 'Counterweight',  size: [1, 5], hits: [], charge: 5, release: 'drop', set: true },
  rocketrack:  { name: 'Rocket Rack',    size: [1, 3], hits: ['power', 'power', 'power'], each: 'rocket', leaves: 'rocket', set: true },
  curtain:     { name: 'Curtain',        size: [1, 1], hits: [], curtain: true },                 // like the Curtain
};

// The batch-2 kinds the rules fully support. Levels may only use these.
// ('confetti' is the floor kind levels may lay; 'petals' only appears when a
// bouquet breaks, or when a hand-made level lists it in `floor`.)
// (Left out on 23 Nov. 2026 because they were boring: 'tophat' and 'popper',
// which never break and give something every third match beside them. Add
// their names back to bring them back.)
export const BATCH2_READY = [
  'confetti', 'bouquet',                              // 1 floor + bouquet
  'candyjar',                                         // 2 candy jar
  'planter', 'dovecote', 'truss', 'ticketbooth',      // 3 big blocks
  'footlights', 'fireworks',                          // 4 color-list blocks
  'makeupcase',                                       // 5 makeup case
  'curtain',                                          // 6 curtain
];
