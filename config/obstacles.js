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
  dryice:    { name: 'Dry Ice',     hits: ['any'] },                    // like Ice
  cashbox:   { name: 'Cash Box',    hits: ['power'] },                  // like the Porcelain Piggy: power-ups only
  flat:      { name: 'Scenery Flat', hits: ['power', 'power', 'power'] }, // like Stone: three power-up hits
  strongbox: { name: 'Strongbox',   hits: ['power', 'match'] },         // like the Rock: a power-up, then a match
  costume:   { name: 'Costume Bag', hits: ['any', 'any', 'any'], leaves: 'power' }, // like the Pouch: reveals a power-up
  padlock:   { name: 'Padlock',     hits: ['power'], leaves: 'inside' }, // like the Chain: frees what it holds
};

// The one obstacle that moves: it falls like a piece and is collected when it
// reaches the bottom of its column (like the Frog).
export const DROPPER = { id: 'sandbag', name: 'Sandbag' };

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
const M5 = ['match', 'match', 'match', 'match', 'match'];
export const OBSTACLES2 = {
  planter:     { name: 'Planter',        size: [2, 2], hits: M5, leaves: 'confetti' },            // like the Bush
  bouquet:     { name: 'Bouquet',        size: [1, 1], hits: ['any', 'any'], leaves: 'petals' },  // like the Flowerpot
  tophat:      { name: 'Top Hat',        size: [1, 1], hits: [], generator: true, every: 3, product: 'dove' },    // like the Magic Hat
  popper:      { name: 'Popcorn Cart',   size: [1, 1], hits: [], generator: true, every: 3, product: 'popcorn' }, // like the Cauldron
  candyjar:    { name: 'Candy Jar',      size: [1, 1], hits: ['any', 'any', 'any'], product: 'candy' },           // like the Jar
  dovecote:    { name: 'Dovecote',       size: [2, 2], hits: M5 },                                // like the Birdhouse
  footlights:  { name: 'Footlights',     size: [2, 2], hits: [], colorList: 4 },                  // like the Light Bulb
  fireworks:   { name: 'Fireworks',      size: [2, 1], hits: [], colorList: 3, leaves: 'blast' }, // like the Dynamite Box
  truss:       { name: 'Lighting Truss', size: [3, 1], hits: ['power', 'power'] },                // like the Metal Tube
  ticketbooth: { name: 'Ticket Booth',   size: [3, 1], hits: ['power', 'match', 'match', 'match'], leaves: 'power' }, // like the Slot Machine
  makeupcase:  { name: 'Makeup Case',    size: [1, 1], hits: ['match'], toggles: true },          // like the Bow Tie box
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
