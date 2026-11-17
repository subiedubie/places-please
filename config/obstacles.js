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
