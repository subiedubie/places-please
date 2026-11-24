// SET PIECES: levels built round one big obstacle, each with its own layout.
// They come round in turn (see `ORDER`), on the level numbers ending in LAST,
// except on a level that introduces something else.
import { makeRng } from '../engine/rng.js';

export const LAST = [1, 2, 4, 6, 9];
// How much a Medium or Hard set piece's moves are cut (normal, medium, hard, -).
export const FACTOR = [1, 0.95, 0.88, 0.88];
export const FIRST = 4;
export const ORDER = ['chandelier', 'rolldrop', 'laser', 'vine', 'masks', 'cannon', 'flyer', 'barrel', 'thunder', 'greasepot',
  'poster', 'acts', 'bubbles', 'belt', 'flamepot', 'fusebox', 'trophies', 'dressing', 'gel', 'fireworks', 'weights', 'followspot',
  'safes', 'rope', 'flowercart', 'dryice', 'safetycurtain', 'programs', 'rocketrack', 'truss'];
export const COLORS = [4, 4, 4, 4]; // gem colors, by tier
// Moves each set gets on a normal level (harder levels get fewer, see movesFactor).
export const MOVES = {
  rolldrop: 19, vine: 16, cannon: 15, barrel: 20, greasepot: 18, acts: 33, belt: 15, fusebox: 21,
  dressing: 20, fireworks: 27, followspot: 17, rope: 19, dryice: 19, truss: 21,
  chandelier: 17, laser: 16, masks: 19, flyer: 27, thunder: 17, poster: 19, bubbles: 18, flamepot: 17, trophies: 21, gel: 25,
  weights: 17, safes: 26, flowercart: 18, safetycurtain: 22, programs: 22, rocketrack: 19,
};

const COLS = 8;
const ROWS = 10;
const fill = (kind, x0, x1, y0, y1, skip = () => false) => {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!skip(x, y)) out.push({ x, y, kind });
  return out;
};
const count = (blocks, kind) => blocks.filter((b) => b.kind === kind).length;
const all = (blocks, ...kinds) => kinds.map((k) => ({ block: k, need: count(blocks, k) })).filter((t) => t.need > 0);

// Each gives { blocks, targets, ... }. rng: so that they differ a little each time round.
const BUILD = {
  rolldrop(rng) {
    const blocks = rng.int(2)
      ? [{ x: 0, y: 6, kind: 'rolldrop', w: 4, h: 4 }, { x: 4, y: 6, kind: 'rolldrop', w: 4, h: 4 }]
      : [{ x: 0, y: 5, kind: 'rolldrop', w: 3, h: 4 }, { x: 5, y: 5, kind: 'rolldrop', w: 3, h: 4 }, ...fill('hatbox', 3, 4, 7, 8)];
    const crates = blocks.reduce((n, b) => n + (b.kind === 'rolldrop' ? b.w * b.h : 0), 0);
    return { blocks, targets: [{ block: 'rolldrop', need: 2 }, { block: 'crate', need: crates }, ...all(blocks, 'hatbox')] };
  },
  vine(rng) {
    const x = rng.int(2);
    const blocks = [3, 5, 7, 9].map((y, i) => ({ x: (i + x) % 2, y, kind: 'vine', w: 7 }));
    return { blocks, targets: all(blocks, 'vine') };
  },
  cannon(rng) {
    const blocks = [];
    for (let y = 1; y <= 5; y++) for (let x = 0; x < COLS; x++) if ((x + 2 * y + rng.int(2)) % 4 === 0) blocks.push({ x, y, kind: 'cannon' });
    blocks.push(...fill('cashbox', 0, 2, 7, 9), ...fill('cashbox', 5, 7, 7, 9));
    return { blocks, targets: all(blocks, 'cashbox', 'cannon') };
  },
  barrel() {
    const blocks = [...fill('rigbag', 1, 6, 4, 4), { x: 0, y: 5, kind: 'barrel' }, { x: 7, y: 7, kind: 'barrel' }];
    blocks.push(...fill('trunk', 0, 7, 5, 9, (x, y) => (x === 0 && y <= 7) || (x === 7 && y >= 7)));
    return { blocks, targets: all(blocks, 'trunk', 'barrel') };
  },
  greasepot(rng) {
    const at = rng.int(2) ? [[1, 2], [6, 2], [1, 7], [6, 7], [3, 5]] : [[2, 2], [5, 4], [1, 5], [6, 8], [3, 8]];
    const blocks = at.map(([x, y]) => ({ x, y, kind: 'greasepot' }));
    return { blocks, targets: [...all(blocks, 'greasepot'), { block: 'goo', need: 9 * blocks.length }] };
  },
  acts() {
    const one = fill('crate', 0, 7, 6, 9);
    const two = fill('hatbox', 0, 7, 7, 9);
    return { blocks: one, targets: all(one, 'crate'), acts: [{ blocks: two, drops: [], floor: [], targets: all(two, 'hatbox') }] };
  },
  belt(rng) {
    const r = rng.int(2);
    const blocks = [3, 6, 9].flatMap((y) => fill('propcase', 0, 7, y, y));
    return { blocks, targets: all(blocks, 'propcase'), belts: [3, 6, 9].map((y, i) => ({ y, x0: 0, x1: 7, dir: (i + r) % 2 ? 1 : -1 })) };
  },
  fusebox() {
    const blocks = [...fill('fusebox', 0, 6, 4, 4), ...fill('fusebox', 1, 7, 6, 6), ...fill('fusebox', 0, 6, 8, 8)];
    return { blocks, targets: all(blocks, 'fusebox') };
  },
  dressing() {
    const blocks = [[0, 2], [6, 2], [0, 6], [6, 6]].map(([x, y]) => ({ x, y, kind: 'dressing' }));
    return { blocks, targets: [...all(blocks, 'dressing'), { block: 'giftbox', need: 3 * blocks.length }] };
  },
  fireworks(rng) {
    const blocks = [{ x: 0, y: 5, kind: 'fireworks' }, { x: 6, y: 5, kind: 'fireworks' }, ...fill(rng.int(2) ? 'hatbox' : 'trunk', 0, 7, 6, 9)];
    return { blocks, targets: all(blocks, 'fireworks', 'hatbox', 'trunk') };
  },
  followspot() {
    const blocks = [{ x: 0, y: 4, kind: 'followspot' }, { x: 6, y: 7, kind: 'followspot' }];
    blocks.push(...fill('hatbox', 2, 7, 5, 5), ...fill('hatbox', 0, 5, 8, 8), ...fill('crate', 1, 5, 7, 7));
    return { blocks, targets: all(blocks, 'followspot', 'hatbox', 'crate') };
  },
  rope() {
    const blocks = fill('rope', 0, 7, 4, 9);
    return { blocks, targets: all(blocks, 'rope') };
  },
  dryice() {
    const blocks = [5, 6, 7, 8, 9].map((y) => ({ x: 0, y, kind: 'dryice', w: 7 }));
    return { blocks, targets: all(blocks, 'dryice') };
  },
  chandelier(rng) {
    const blocks = [{ x: 0, y: 4, kind: 'dimmer' }, { x: 6, y: 4, kind: 'dimmer' }, { x: 3, y: rng.int(2) ? 7 : 8, kind: 'chandelier' }, { x: 3, y: 3, kind: 'dimmer' }];
    const c = blocks[2];
    blocks.push(...fill('hatbox', 0, 7, 7, 9, (x, y) => x >= c.x && x <= c.x + 1 && y >= c.y && y <= c.y + 1));
    return { blocks, targets: all(blocks, 'dimmer', 'chandelier', 'hatbox') };
  },
  laser(rng) {
    const blocks = [{ x: 1 + rng.int(2), y: 4, kind: 'laser' }, { x: 5 + rng.int(2), y: 4, kind: 'laser' }, ...fill('hatbox', 0, 7, 8, 9)];
    return { blocks, targets: all(blocks, 'laser', 'hatbox') };
  },
  masks() {
    const blocks = [6, 7, 8, 9].map((y) => ({ x: 0, y, kind: 'maskrack', w: 5 }));
    return { blocks, targets: [...all(blocks, 'maskrack'), { block: 'mask', need: 20 }] };
  },
  flyer(rng) {
    const xs = rng.int(2) ? [1, 4, 6] : [1, 3, 6];
    const blocks = fill('hatbox', 0, 7, 6, 7);
    return { blocks, drops: xs.map((x) => ({ x, y: 0, kind: 'flyer' })), targets: [{ block: 'flyer', need: xs.length }, ...all(blocks, 'hatbox')] };
  },
  thunder() {
    const blocks = [{ x: 0, y: 4, kind: 'thunder' }, { x: 6, y: 4, kind: 'thunder' }, ...fill('hatbox', 0, 7, 7, 9)];
    return { blocks, targets: all(blocks, 'thunder', 'hatbox') };
  },
  poster() {
    const blocks = [{ x: 2, y: 6, kind: 'poster' }, ...fill('pastepot', 0, 7, 5, 5), ...fill('crate', 0, 7, 8, 9)];
    return { blocks, targets: all(blocks, 'pastepot', 'poster', 'crate') };
  },
  bubbles(rng) {
    const x0 = 2;
    const blocks = fill('bubbles', x0, x0 + 3, 3, 9);
    const spots = blocks.map((_, i) => i).filter((i) => blocks[i].y > 3);
    for (let i = 0; i < 5; i++) blocks[spots.splice(rng.int(spots.length), 1)[0]].inside = { t: 'drop', kind: 'duck' };
    return { blocks, targets: [{ block: 'duck', need: 5 }] };
  },
  flamepot() {
    const blocks = [...[[1, 4], [6, 4], [3, 5], [4, 5]].map(([x, y]) => ({ x, y, kind: 'flamepot' })), ...fill('hatbox', 0, 7, 7, 9)];
    return { blocks, targets: all(blocks, 'flamepot', 'hatbox') };
  },
  trophies(rng) {
    const r = rng.int(2);
    const blocks = [[0 + r, 2], [5 + r, 2], [2, 5 + r], [4, 5 + r]].map(([x, y]) => ({ x, y, kind: 'trophycase' }));
    return { blocks, targets: [{ block: 'trophy', need: blocks.length }] };
  },
  gel(rng) {
    const r = rng.int(4);
    const blocks = [4, 6, 8].flatMap((y, i) => fill('gel', 0, 7, y, y).map((b) => ({ ...b, color: (r + i) % 4 })));
    return { blocks, targets: all(blocks, 'gel') };
  },
  weights() {
    const blocks = [{ x: 1, y: 5, kind: 'weight' }, { x: 6, y: 5, kind: 'weight' }, ...fill('pin', 2, 2, 5, 9), ...fill('pin', 5, 5, 5, 9)];
    return { blocks, targets: all(blocks, 'pin', 'weight') };
  },
  safes() {
    const blocks = [{ x: 1, y: 4, kind: 'grandsafe' }, { x: 5, y: 4, kind: 'grandsafe' }, { x: 3, y: 7, kind: 'grandsafe' }];
    return { blocks, targets: [...all(blocks, 'grandsafe'), { block: 'cashbox', need: 12 }] };
  },
  flowercart(rng) {
    const r = rng.int(2);
    const blocks = [[r, 3], [7 - r, 5], [2 + r, 7], [5 - r, 9]].map(([x, y]) => ({ x, y, kind: 'flowercart' }));
    return { blocks, targets: [...all(blocks, 'flowercart'), { block: 'petals', need: 32 }] };
  },
  safetycurtain() {
    const blocks = [{ x: 0, y: 5, kind: 'safetycurtain' }, { x: 4, y: 5, kind: 'safetycurtain' }];
    return { blocks, targets: [...all(blocks, 'safetycurtain'), { block: 'crate', need: 24 }] };
  },
  programs() {
    const blocks = [[0, 3], [6, 3], [0, 7], [6, 7], [3, 5]].map(([x, y], i) => ({ x, y, kind: 'programs', open: i % 2 === 0 }));
    return { blocks, targets: [{ block: 'program', need: 20 }] };
  },
  rocketrack() {
    const blocks = [{ x: 0, y: 4, kind: 'rocketrack' }, { x: 7, y: 4, kind: 'rocketrack' }, { x: 3, y: 5, kind: 'rocketrack' }, ...fill('hatbox', 0, 7, 8, 9)];
    return { blocks, targets: all(blocks, 'rocketrack', 'hatbox') };
  },
  truss() {
    const blocks = [5, 6, 7, 8].map((y) => ({ x: 0, y, kind: 'truss', w: 5 }));
    return { blocks, targets: all(blocks, 'truss') };
  },
};

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
  const made = BUILD[name](makeRng(n).fork('set'));
  return {
    n, tier, set: name, cols: COLS, rows: ROWS, holes: [], colors: COLORS[tier], moves: MOVES[name],
    drops: [], floor: [], bonus: false, ...made, targets: made.targets.slice(0, 3),
  };
}
