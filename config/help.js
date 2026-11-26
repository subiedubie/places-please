// HELP: every rule sentence the player can read lives in this file.
// You can change any sentence here without touching the game rules.
//
// The RULES themselves (how many hits, what kind of hit) are in
// config/obstacles.js. If you change a number there, change the sentence
// here too. The test tests/help.test.js checks that every obstacle has a
// sentence, and that a sentence mentions the right number of hits.
//
// The NAMES of the obstacles are not typed here: they are read from
// config/obstacles.js (see nameFor below), so a renamed obstacle is renamed
// in the help as well. The names inside the sentences are plain text, though,
// so after renaming an obstacle, fix its sentence below by hand.

import * as OB from './obstacles.js';

// The obstacle tables. (`|| {}` so this file still loads if one of them is
// ever removed from config/obstacles.js.)
const OBSTACLES = OB.OBSTACLES || {};
const OBSTACLES2 = OB.OBSTACLES2 || {};
const FLOORS = OB.FLOORS || {};
const DROPPER = OB.DROPPER || { id: 'sandbag', name: 'Sandbag' };

// ---- One sentence per thing on the board ------------------------------------
// The word on the left is the id the game uses; do not change it.
// Change only the sentence on the right.
export const RULES = {
  // Twists (config/twists.js)
  ivy: 'Make a match next to Creeping Ivy to cut it. It grows after every move unless you cut some, so clear it all.',
  mouse: 'The Stage Mouse hops after every move. Make a match next to it, or blast it, to catch it.',
  propbomb: 'Match a Prop Bomb before its number runs out and it explodes for you. Too late, and it leaves a Crate and turns up somewhere else.',
  chameleon: 'A Chameleon changes color after every move. Match it while it is the color you need.',
  treasure: 'Clear all the confetti over a Hidden Treasure to collect it.',
  revolve: 'The Revolving Stage turns one step after every move. Plan for where the gems will be.',
  tortoise: 'Bring the Tortoise down to the bottom. It leaves Petals all the way up its column, so clear those too.',
  paintkeg: 'Break a Paint Keg with 3 hits. It splashes paint on two squares.',
  paint_floor: 'Paint every square. A match or blast that touches paint paints all the squares it clears.',
  // Batch 1 obstacles
  crate:     'Make a match next to a Crate to break it.',
  hatbox:    'Make 2 matches next to a Hatbox to break it.',
  pinkbox:   'Break a Hat Box with 3 matches next to it or power-ups. There is another block underneath: break that too.',
  trunk:     'Make 3 matches next to a Trunk to break it.',
  paint:     "Match the Paint Can's own colour next to it to break it.",
  dryice:    'Every match next to Dry Ice melts one square off its end.',
  cashbox:   'Only power-ups break a Cash Box.',
  flat:      'Hit a Scenery Flat with power-ups 3 times.',
  strongbox: 'Hit a Strongbox with a power-up, then make a match next to it.',
  costume:   'Make 3 matches next to a Costume Bag to win a power-up.',
  padlock:   'Hit a Padlock with a power-up to free what it holds.',

  // The one obstacle that falls
  sandbag:   'Bring the Sandbag down to the bottom of the board to collect it.',

  // Floors (they lie under a piece)
  dust:      'Clear whatever stands on Dust before the Cobwebs creep back.',
  confetti:  'Clear whatever stands on Confetti to sweep it up.',
  petals:    'Clear whatever stands on Petals to sweep them up. A broken Bouquet scatters more.',

  // Batch 2 obstacles
  planter:     'Make 5 matches next to a Planter to break it. Power-ups do not hurt it. It leaves Confetti behind.',
  bouquet:     'Make 2 matches next to a Bouquet to break it. It scatters Petals around it.',
  tophat:      'Make 3 matches next to a Top Hat to release a Dove. The hat never breaks.',
  popper:      'Make 3 matches next to a Popcorn Cart to pop one Popcorn. The cart never breaks.',
  candyjar:    'Make 3 matches next to a Candy Jar to empty it. Every hit gives one Candy.',
  dovecote:    'Make 5 matches next to a Dovecote to break it. Power-ups do not hurt it. Three Doves fall out: bring them to the bottom.',
  footlights:  'Match each of the 4 colours shown on the Footlights next to them.',
  fireworks:   'Match each of the 3 colours shown on the Fireworks next to them. Then they go off in a huge blast.',
  truss:       'Every power-up that hits a Lighting Truss takes one square off its end.',
  ticketbooth: 'Hit a Ticket Booth with a power-up, then make 3 matches next to it to win three power-ups.',
  makeupcase:  'Make a match next to a Makeup Case while it is open. It opens and closes after every move.',
  curtain:     "The meter on a Curtain shows how many more of its gem to clear, anywhere on the board. At 0 every Curtain of that color opens.",

  // Set pieces (levels/sets.js)
  vine:        'A match next to a Rose Vine takes off its flowers; another cuts it there, and everything beyond the cut falls. Work toward the pot.',
  rolldrop:    'Every match next to a Painted Drop rolls it up one row. There are Crates behind it.',
  fusebox:     'Hit a Fuse Box with power-ups 2 times and the whole row blows.',
  rigbag:      'Make 2 matches next to a Tool Bag. Its spike flies to the nearest Barrel.',
  barrel:      '3 spikes from Tool Bags set a Barrel rolling across the board.',
  followspot:  'Hit a Follow Spot with a power-up, then make 3 matches next to it. Its light clears its rows and its columns.',
  dressing:    'Make 4 matches next to a Dressing Room and it throws out Fan Gifts.',
  giftbox:     'Make 2 matches next to a Fan Gift to open it.',
  greasepot:   'Make 2 matches next to the Greasepaint. It spills over everything around it.',
  goo:         'Make a match next to Spilled Paint to wipe it up.',
  propcase:    'Make 2 matches next to a Prop Case. The belt moves after every move.',
  rope:        'Make a match next to the Backstage squares to open them up.',
  cannon:      'Make 2 matches next to a Streamer Cannon. It shoots at something you need.',
  squib:       'Make 3 matches next to a Squib and it goes off, hitting what is beside it.',
  cobweb:      'Make a match next to a Cobweb to sweep it away. It leaves Dust, and Cobwebs creep back over Dust unless you sweep one away every move.',
  straw:       'Make 2 matches next to Packing Straw to clear it. There are treasures underneath.',
  gallery:     'Make 4 matches next to a Shooting Gallery, then hit it with a power-up.',
  painttube:   'Make a match next to a Paint Tube to burst it. It paints its own square and the four beside it.',
  carpet:      'Make 5 matches next to a Rolled Carpet to take the whole roll away.',
  wardrobe:    'Every match next to a Wardrobe gives one Glove. Each holds 5.',
  lift:        'Clear as many gems of its color as the Stage Lift shows and it shoots up through its column.',
  lamp:        'Lead the paint to a Cue Lamp to light it. A match or blast that touches paint paints every square it clears.',
  capsule:     'Make a match next to a Parcel to open it.',
  dimmer:      'Make 4 matches next to a Dimmer Box to send its power to the Chandelier.',
  chandelier:  'Power from 3 Dimmer Boxes makes the Chandelier shatter and hit the whole board.',
  flamepot:    'Hit a Flame Pot with a power-up, then make 3 matches next to it. It throws three fireballs.',
  laser:       'Make 5 matches next to a Laser. It burns through its row and three columns.',
  thunder:     'Make 5 matches next to a Thunder Machine. Lightning strikes twelve things you need.',
  flowercart:  'Make 3 matches next to a Flower Cart. It strews Petals all along its row: clear those too.',
  maskrack:    'Every match next to a Mask Rack takes one square off its end and throws a Mask onto the board.',
  mask:        'Make a match next to a Mask to collect it.',
  grandsafe:   'Hit a Grand Safe with power-ups 3 times. Four Cash Boxes fly out.',
  pastepot:    'Make 2 matches next to a Paste Pot to paste one piece onto the Poster.',
  poster:      'Paste on all 8 pieces and the Poster goes off in a huge blast.',
  trophycase:  'Make 5 matches next to a Trophy Case. Bring the Trophy that falls out down to the bottom.',
  safetycurtain: 'Make 5 matches next to the Safety Curtain to bring it down. There are Crates behind it.',
  gel:         "Match a Color Gel's own color next to it, then make any match next to it.",
  programs:    'Make a match next to a Program Stand while it is open for one Program. Each holds 4, and it opens and closes after every move.',
  bubbles:     'Make a match next to the Bubble Bath to pop it. Rubber Ducks are hiding inside.',
  pin:         'Make 2 matches next to a Belaying Pin to pull it out.',
  weight:      'Pull out 5 Belaying Pins and a Counterweight falls away.',
  rocketrack:  'Every power-up that hits a Rocket Rack fires a rocket. It takes 3 hits.',

  // Things a level can ask you to collect
  dove:    'Doves fall out of a broken Dovecote. Bring each one down to the bottom of the board.',
  trophy:  'Bring each Trophy down to the bottom of the board.',
  duck:    'Bring each Rubber Duck down to the bottom of the board.',
  flyer:   'Bring the Flying Rig down to the bottom. It takes off again, clears its whole column and drops 2 Parcels.',
  glove: 'Make a match next to a Wardrobe for each Glove.',
  program: 'Make a match next to an open Program Stand for each Program.',
  popcorn: 'Make 3 matches next to a Popcorn Cart to pop each Popcorn.',
  candy:   'Every hit on a Candy Jar gives one Candy.',
};

// Names for the collectibles (the obstacles get their names from
// config/obstacles.js).
export const COLLECTIBLE_NAMES = {
  propbomb: 'Prop Bomb', chameleon: 'Chameleon', treasure: 'Hidden Treasure', revolve: 'Revolving Stage', tortoise: 'Tortoise', paint_floor: 'Paint',
  dove: 'Dove',
  trophy: 'Trophy',
  duck: 'Rubber Duck',
  flyer: 'Flying Rig',
  program: 'Program',
  glove: 'Glove',
  popcorn: 'Popcorn',
  candy: 'Candy',
};

// Which collectible each obstacle hands out. Read from config/obstacles.js
// (`product`), so there is nothing to edit here.
export const PRODUCT_OF = Object.fromEntries(
  Object.entries(OBSTACLES2).filter(([, o]) => o.product).map(([kind, o]) => [kind, o.product]));

// ---- "How to play" ----------------------------------------------------------
// Each entry is one section of the rules sheet: a heading and its lines.
export const HOW_TO_PLAY = [
  {
    title: 'The basics',
    lines: [
      'Swap two pieces that sit side by side to line up 3 or more of the same kind.',
      'Every swap costs one move. Finish the targets at the top before the moves run out.',
      'A match next to an obstacle hits it. A power-up blast hits most obstacles too.',
    ],
  },
  {
    title: 'Making power-ups',
    lines: [
      '4 in a line makes a Missile. It clears a whole row or column.',
      '4 in a 2x2 square makes a Ninja Star. It flies to something the level still needs.',
      '5 in an L or T makes a Grenade. It clears the area around it.',
      '5 in a line makes a Magic Ball. Swap it with a piece to clear every piece of that kind.',
      'Tap a power-up, or swap it with a piece, to set it off.',
      'Power-ups always aim at what the level still needs.',
    ],
  },
  {
    title: 'Combining power-ups',
    intro: 'Swap two power-ups into each other for a bigger effect.',
    lines: [
      'Missile + Missile: clears a row and a column.',
      'Missile + Grenade: clears 3 rows and 3 columns.',
      'Grenade + Grenade: one very large blast.',
      'Ninja Star + Missile: flies to a target, then clears its row or column.',
      'Ninja Star + Grenade: flies to a target, then blasts a large area there.',
      'Ninja Star + Ninja Star: three stars fly to three targets.',
      'Magic Ball + Missile: turns the most useful piece into Missiles, and all go off.',
      'Magic Ball + Ninja Star: turns the most useful piece into Ninja Stars, and all fly.',
      'Magic Ball + Grenade: turns the most useful piece into Grenades, and all go off.',
      'Magic Ball + Magic Ball: clears the whole board.',
    ],
  },
  {
    title: 'Win streak',
    lines: [
      'Win levels in a row and the next level starts with free power-ups: a Missile and a Ninja Star after 1 win, a Grenade as well after 2, a Magic Ball as well after 3.',
      'After 5 wins in a row you get the Super Magic Ball: every Magic Ball clears two kinds of piece instead of one.',
      'One defeat ends the streak, and the gifts and the Super Magic Ball are lost.',
    ],
  },
  {
    title: 'Boosters',
    lines: [
      'The boosters under the board cost no move.',
      'Drill: clears one cell.',
      'Stage Left: clears a row.',
      'Trapdoor: clears a column.',
      'Coin Flip: shuffles the pieces.',
    ],
  },
];

// ---- Functions the screens use (nothing to edit below) ----------------------

// The rule sentence for a kind ('crate', 'sandbag', 'confetti', 'dove', ...).
// Gives '' for a kind that has no sentence.
export function ruleFor(kind) {
  return Object.hasOwn(RULES, kind) ? RULES[kind] : '';
}

// What a kind is called on screen.
export function nameFor(kind) {
  if (kind === DROPPER.id) return DROPPER.name;
  const entry = OBSTACLES[kind] || OBSTACLES2[kind] || FLOORS[kind];
  if (entry && entry.name) return entry.name;
  return COLLECTIBLE_NAMES[kind] || kind;
}

// Every kind that has a rule, in the order the rules sheet lists them:
// batch 1, the sandbag, the floors, batch 2, then the collectibles.
export const ALL_KINDS = [
  ...Object.keys(OBSTACLES),
  DROPPER.id,
  ...Object.keys(FLOORS),
  ...Object.keys(OBSTACLES2),
  ...Object.keys(COLLECTIBLE_NAMES),
].filter((kind, i, list) => list.indexOf(kind) === i);
