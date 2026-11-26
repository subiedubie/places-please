// SET PIECES: levels built round one big obstacle, each on its own outline.
// They come round in turn (see `ORDER`), on the level numbers ending in LAST,
// except on a level that introduces something else.
import { makeRng } from '../engine/rng.js';
import { OBSTACLES, OBSTACLES2 } from '../config/obstacles.js';

export const LAST = [1, 2, 4, 6, 9];
// How much a Medium or Hard set piece's moves are cut (normal, medium, hard, -).
export const FACTOR = [1, 0.95, 0.88, 0.88];
export const FIRST = 4;
export const ORDER = ['chandelier', 'rolldrop', 'squibs', 'hatboxes', 'vine', 'lifts', 'laser', 'cannon', 'flyer', 'cobwebs', 'masks', 'barrel',
  'gallery', 'thunder', 'greasepot', 'rush', 'poster', 'acts', 'trail', 'bubbles', 'belt', 'carpets', 'flamepot', 'fusebox', 'straw',
  'trophies', 'dressing', 'tubes', 'gel', 'fireworks', 'wardrobes', 'weights', 'followspot', 'safes', 'rope', 'flowercart', 'dryice',
  'safetycurtain', 'programs', 'rocketrack', 'truss'];
export const COLORS = [4, 4, 4, 4]; // gem colors, by tier
// Moves each set gets on a normal level (harder levels get fewer, see FACTOR).
export const MOVES = {
  rolldrop: 29, vine: 15, cannon: 15, barrel: 25, greasepot: 17, acts: 36, belt: 15, fusebox: 26, dressing: 22, fireworks: 20,
  followspot: 19, rope: 27, dryice: 21, truss: 21, chandelier: 20, laser: 15, masks: 25, flyer: 33, thunder: 18, poster: 17,
  bubbles: 21, flamepot: 24, trophies: 20, gel: 29, weights: 15, safes: 29, flowercart: 17, safetycurtain: 28, programs: 18,
  rocketrack: 23, hatboxes: 22, squibs: 27, cobwebs: 28, straw: 27, gallery: 16, tubes: 17, carpets: 15, wardrobes: 12, lifts: 15, trail: 24, rush: 99,
};

// THE BOARDS, drawn as text:   .  a gem    #  no cell there    -  covered by the
// big obstacle up and to the left    *  a gem on a painted square
// Any other character is an obstacle; `is` says which.
const H = { kind: 'hatbox' };
const C = { kind: 'crate' };
const MAPS = {
  chandelier: { is: { D: { kind: 'dimmer' }, C: { kind: 'chandelier' }, h: H }, map: [
    '##.....##', '.........', '.........', '.D-...D-.', '.--...--.', '...D-....', '...--....', 'hhhhhhhhh', 'hhhC-hhhh', 'hhh--hhhh', '#hhhhhhh#'] },
  laser: { is: { L: { kind: 'laser' }, h: H }, map: [
    '.........', '.........', '#.......#', '#.L...L.#', '..-...-..', '..-...-..', '.........', '.........', 'hhhhhhhhh', 'hhhhhhhhh'] },
  masks: { fixed: true, is: { M: { kind: 'maskrack', w: 6 } }, map: [
    '.........', '.........', '..#...#..', '..#...#..', '.........', 'M-----...', 'M-----...', 'M-----...', 'M-----...'] },
  flyer: { is: { F: { drop: 'flyer' }, h: H, c: C }, map: [
    'F.#.F.#.F', '..#...#..', '..#...#..', '.........', '.........', 'ccccccccc', 'hhhhhhhhh', '.........', '.........', '.........'] },
  thunder: { is: { T: { kind: 'thunder' }, h: H }, map: [
    '###...###', '##.....##', '#.......#', '.........', 'T-.....T-', '--.....--', '.........', 'hhhhhhhhh', 'hhhhhhhhh', 'hhhhhhhhh'] },
  poster: { is: { p: { kind: 'pastepot' }, P: { kind: 'poster' }, c: C }, map: [
    '#......#', '........', '........', '........', '........', 'pppppppp', '..P---..', '..----..', 'cccccccc', 'cccccccc', '#cccccc#'] },
  bubbles: { is: { b: { kind: 'bubbles' } }, map: [
    '.........', '#.......#', '..bbbbb..', '..bbbbb..', '..bbbbb..', '..bbbbb..', '..bbbbb..', '..bbbbb..', '#.......#', '.........'] },
  flamepot: { is: { f: { kind: 'flamepot' }, h: H }, map: [
    '.........', '.........', '.........', '..#...#..', 'f.#.f.#.f', '.........', '.........', 'hhhhhhhhh', 'hhhhhhhhh', 'hhhh#hhhh'] },
  trophies: { is: { K: { kind: 'trophycase' } }, map: [
    '#.......#', '.........', '.K-...K-.', '.--...--.', '.........', '##.....##', '.........', '..K-.K-..', '..--.--..', '.........'] },
  gel: { is: { 0: { kind: 'gel', color: 0 }, 1: { kind: 'gel', color: 1 }, 2: { kind: 'gel', color: 2 }, 3: { kind: 'gel', color: 3 } }, map: [
    '........', '........', '#......#', '........', '00000000', '........', '11111111', '#......#', '22222222', '........'] },
  weights: { is: { W: { kind: 'weight' }, n: { kind: 'pin' } }, map: [
    '.........', '.........', '.........', '#.......#', '#.......#', '..Wn.nW..', '..-n.n-..', '..-n.n-..', '..-n.n-..', '..-n.n-..', '.........'] },
  safes: { is: { S: { kind: 'grandsafe' } }, map: [
    '##.....##', '##.....##', '.........', '.S-...S-.', '.--...--.', '.........', '...S-....', '...--....', '.........', '##.....##'] },
  flowercart: { is: { o: { kind: 'flowercart' } }, map: [
    '.........', '#.......#', '..o......', '#.......#', '......o..', '#.......#', '..o......', '#.......#', '......o..', '.........'] },
  // Hat Boxes: three hits each, then the Crate or Trunk underneath must go too.
  hatboxes: { is: { H: { kind: 'pinkbox', under: 'crate' }, T: { kind: 'pinkbox', under: 'trunk' } }, map: [
    '.........', '.........', '#.......#', '...HHH...', '...HTH...', '.........', '.........', 'HT.....TH', '.........', '.........'] },
  safetycurtain: { is: { S: { kind: 'safetycurtain', w: 4, h: 3 } }, map: [
    '#.......#', '.........', '.........', '.........', '.........', '.........', 'S---#S---', '----#----', '----#----'] },
  programs: { is: { P: { kind: 'programs', open: true }, Q: { kind: 'programs', open: false } }, map: [
    '#.......#', '.........', '.P-...Q-.', '.--...--.', '.........', '#..P-...#', '#..--...#', '.........', '.Q-...P-.', '.--...--.', '.........'] },
  rocketrack: { is: { R: { kind: 'rocketrack' }, h: H }, map: [
    '.........', '.........', '#.......#', 'R...R...R', '-...-...-', '-...-...-', '#.......#', '.........', 'hhhhhhhhh', 'hhhhhhhhh'] },
  rolldrop: { is: { R: { kind: 'rolldrop', w: 4, h: 4 }, c: C }, map: [
    '.........', '.........', '.........', '.........', '.........', 'R---#R---', '----#----', '----#----', '----#----', '.ccc#ccc.'] },
  vine: { fixed: true, is: { V: { kind: 'vine', w: 7 } }, map: [
    '#......#', '........', '........', '........', '#......#', 'V------.', '........', '.V------', '........', 'V------.', '........'] },
  cannon: { is: { n: { kind: 'cannon' }, b: { kind: 'cashbox' } }, map: [
    '.........', '.n.n.n.n.', '.........', '..n.n.n..', '#.......#', '#.......#', '.........', 'bbb...bbb', 'bbb...bbb', 'bbb...bbb'] },
  barrel: { is: { B: { kind: 'barrel' }, g: { kind: 'rigbag' }, t: { kind: 'trunk' } }, map: [
    '.........', '.........', '#.......#', '#.......#', '.ggg.ggg.', 'Btttttttt', '-tttttttt', '-tttttttB', 'tttttttt-', 'tttttttt-'] },
  greasepot: { is: { p: { kind: 'greasepot' } }, map: [
    '##.....##', '#.......#', '..p...p..', '.........', '....p....', '.........', '..p...p..', '#.......#', '##.....##'] },
  acts: { is: { c: C }, map: [
    '.........', '.........', '.........', '.........', '.........', '#ccccccc#', 'ccccccccc', 'ccccccccc', 'ccccccccc', '#ccccccc#'],
  next: { is: { h: H }, map: [
    '##.....##', '.........', '.........', '.........', '.........', '.........', '.........', 'hhhh.hhhh', 'hhhh.hhhh', 'hhhh#hhhh'] } },
  belt: { is: { p: { kind: 'propcase' } }, map: [
    '.........', '.........', '.........', 'ppppppppp', '#.......#', '#.......#', 'ppppppppp', '#.......#', '#.......#', 'ppppppppp'] },
  fusebox: { is: { x: { kind: 'fusebox' } }, map: [
    '##.....##', '.........', '.........', '.........', 'xxxxxxxx.', '.........', '.xxxxxxxx', '.........', 'xxxxxxxx.', '.........'] },
  dressing: { is: { D: { kind: 'dressing' } }, map: [
    '.........', '.D-...D-.', '.--...--.', '.........', '###...###', '.........', '.D-...D-.', '.--...--.', '.........'] },
  fireworks: { is: { F: { kind: 'fireworks' }, h: H }, map: [
    '........', '........', '........', '........', '........', 'F-....F-', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhh#', 'hhhhhh##'] },
  followspot: { is: { S: { kind: 'followspot' }, h: H, c: C }, map: [
    '.........', '.........', '.........', '#.......#', 'S-.......', '--hhhhhhh', '.........', 'cccccccS-', 'hhhhhhh--', '#.......#'] },
  rope: { is: { r: { kind: 'rope' } }, map: [
    '.........', '.........', '.........', '.........', 'rrrrrrrrr', 'rrrr#rrrr', 'rrr###rrr', 'rrrr#rrrr', 'rrrrrrrrr', '#rrrrrrr#'] },
  dryice: { fixed: true, is: { I: { kind: 'dryice', w: 8 } }, map: [
    '#.......#', '.........', '.........', '.........', '.........', 'I-------.', 'I-------.', 'I-------.', 'I-------.', 'I-------.'] },
  truss: { fixed: true, is: { T: { kind: 'truss', w: 5 } }, map: [
    '.........', '.........', '#.......#', '.........', '.........', 'T----....', 'T----....', 'T----....', 'T----....', '####.....'] },
  // Batch 5
  squibs: { is: { q: { kind: 'squib' } }, map: [
    '.........', '.........', '.........', '#.......#', '.qqqqqqq.', '.qqqqqqq.', 'qqqqqqqqq', 'qqqqqqqqq', '#qqqqqqq#'] },
  cobwebs: { is: { w: { kind: 'cobweb' } }, map: [
    '.........', '.........', '.........', '.........', '..#...#..', '..#...#..', '.........', 'wwwwwwwww', 'wwwwwwwww'] },
  straw: { fixed: true, is: { s: { kind: 'straw' } }, map: [
    '#......#', '........', '........', '........', '........', 'ssssssss', '........', 'ssssssss', 'ssssssss', 'ssssssss'],
  hidden: [{ x: 1, y: 5, w: 2, h: 1 }, { x: 5, y: 5, w: 2, h: 1 }, { x: 1, y: 7, w: 2, h: 2 }, { x: 5, y: 8, w: 2, h: 2 }] },
  gallery: { is: { G: { kind: 'gallery' } }, map: [
    '.........', '.........', '.G--.G--.', '.---.---.', '.---.---.', '.........', '##.....##', '##.G--.##', '...---...', '...---...', '.........'] },
  tubes: { paint: true, is: { t: { kind: 'painttube' } }, map: [
    't.......t', '.t.....t.', '..t...t..', '...t.t...', '....t....', '.........', '#.t...t.#', '.........', '.........'] },
  carpets: { is: { K: { kind: 'carpet', w: 8 } }, map: [
    '........', '........', '........', '#......#', 'K-------', '........', 'K-------', '........', 'K-------', '........'] },
  wardrobes: { is: { W: { kind: 'wardrobe' } }, map: [
    '##.....##', '.........', '..W-.W-..', '..--.--..', '.........', '.........', '..W-.W-..', '..--.--..', '##.....##'] },
  lifts: { is: { h: H, 0: { kind: 'lift', color: 0, need: 18 }, 1: { kind: 'lift', color: 1, need: 18 }, 2: { kind: 'lift', color: 2, need: 18 }, 3: { kind: 'lift', color: 3, need: 18 } }, map: [
    '.........', '.........', '..hhhhh..', '..hhhhh..', '..hhhhh..', '..hhhhh..', '..hhhhh..', '..hhhhh..', '.........', '##01230##'] },
  trail: { paint: true, trail: true, is: { l: { kind: 'lamp' } }, map: [
    '........l', '.........', '..#...#..', '*.#...#..', '.........', '....l....', '.........', '..#...#..', 'l.......l'] },
  rush: { seconds: 90, is: { c: C, h: H }, map: [
    '.........', '.........', '.........', 'ccc...ccc', 'ccc...ccc', 'hhh...hhh', 'ccccccccc', 'ccccccccc', 'hhhhhhhhh'] },
};

// Turn a drawing into a size, holes and obstacles.
function read({ map, is }, flip) {
  const rows = map.length;
  const cols = map[0].length;
  const out = { cols, rows, holes: [], blocks: [], drops: [], painted: [] };
  map.forEach((line, y) => {
    [...line].forEach((ch, x0) => {
      const at = (w = 1) => ({ x: flip ? cols - x0 - w : x0, y });
      if (ch === '#') out.holes.push(at());
      else if (ch === '*') out.painted.push(at());
      else if (is[ch] && is[ch].drop) out.drops.push({ ...at(), kind: is[ch].drop });
      else if (is[ch]) {
        const size = (OBSTACLES[is[ch].kind] || OBSTACLES2[is[ch].kind]).size || [1, 1];
        out.blocks.push({ ...at(is[ch].w || size[0]), ...is[ch] });
      }
    });
  });
  return out;
}
const count = (blocks, kind) => blocks.filter((b) => b.kind === kind).length;
const open = (L) => L.cols * L.rows - L.holes.length;

// What each asks for, where it is not simply "break them all".
const ASKS = {
  rolldrop: (L, t) => t.map((x) => (x.block === 'crate' ? { ...x, need: x.need + 32 } : x)),
  masks: (L, t) => [...t, { block: 'mask', need: 24 }],
  flyer: (L) => [{ block: 'flyer', need: L.drops.length }, { block: 'capsule', need: 2 * L.drops.length }],
  greasepot: (L, t) => [...t, { block: 'goo', need: 9 * L.blocks.length }],
  dressing: (L, t) => [...t, { block: 'giftbox', need: 3 * L.blocks.length }],
  bubbles: () => [{ block: 'duck', need: 6 }],
  trophies: (L) => [{ block: 'trophy', need: L.blocks.length }],
  safes: (L, t) => [...t, { block: 'cashbox', need: 4 * L.blocks.length }],
  flowercart: (L, t) => [...t, { block: 'petals', need: 9 * L.blocks.length }],
  safetycurtain: (L, t) => [...t, { block: 'crate', need: 24 }],
  hatboxes: (L, t) => [...t, { block: 'crate', need: L.blocks.filter((b) => b.under === 'crate').length }, { block: 'trunk', need: L.blocks.filter((b) => b.under === 'trunk').length }],
  programs: (L) => [{ block: 'program', need: 4 * L.blocks.length }],
  wardrobes: (L) => [{ block: 'glove', need: 5 * L.blocks.length }],
  cobwebs: (L) => [{ block: 'dust', need: L.blocks.length }],
  straw: (L) => [{ block: 'treasure', need: L.hidden.length }],
  tubes: (L) => [{ block: 'paint_floor', need: open(L) }],
};
const breakAll = (blocks) => [...new Set(blocks.map((b) => b.kind))].map((k) => ({ block: k, need: count(blocks, k) }));

// Which set piece level n is (null: none). `taken(n)`: does something else
// need that level?
export function setFor(n, taken = () => false) {
  if (!isSetNumber(n, taken)) return null;
  let i = 0;
  for (let m = FIRST; m < n; m++) if (isSetNumber(m, taken)) i++;
  return ORDER[i % ORDER.length];
}
const isSetNumber = (n, taken) => n >= FIRST && LAST.includes(n % 10) && !taken(n);

export function buildSet(name, n, tier) {
  const rng = makeRng(n).fork('set');
  const m = MAPS[name];
  const flip = !m.fixed && rng.int(2) === 1; // half the time it is the other way round
  const L = {
    n, tier, set: name, ...read(m, flip), colors: COLORS[tier], moves: MOVES[name], floor: [], bonus: false,
  };
  if (m.hidden) L.hidden = m.hidden.map((h) => ({ ...h, under: 'straw' }));
  if (m.paint) L.paint = true;
  if (m.seconds) { L.seconds = m.seconds; L.moves = 99; }
  if (name === 'bubbles') {
    const spots = L.blocks.filter((b) => b.y > 2);
    for (let i = 0; i < 6; i++) spots.splice(rng.int(spots.length), 1)[0].inside = { t: 'drop', kind: 'duck' };
  }
  if (name === 'belt') L.belts = [...new Set(L.blocks.map((b) => b.y))].map((y, i) => ({ y, x0: 0, x1: L.cols - 1, dir: i % 2 ? 1 : -1 }));
  if (name === 'gel') { const r = rng.int(4); for (const b of L.blocks) b.color = (b.color + r) % 4; }
  if (m.next) {
    const b = read(m.next, flip);
    L.acts = [{ holes: b.holes, blocks: b.blocks, drops: [], floor: [], targets: breakAll(b.blocks) }];
  }
  const t = breakAll(L.blocks);
  L.targets = (ASKS[name] ? ASKS[name](L, t) : t).slice(0, 3);
  return L;
}
