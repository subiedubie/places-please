// SET PIECES: levels built round one big obstacle, each with its own layout.
// They come round in turn (see `ORDER`), on the level numbers ending in LAST,
// except on a level that introduces something else.
import { makeRng } from '../engine/rng.js';

export const LAST = [1, 2, 4, 6, 9];
// How much a Medium or Hard set piece's moves are cut (normal, medium, hard, -).
export const FACTOR = [1, 0.95, 0.88, 0.88];
export const FIRST = 4;
export const ORDER = ['rolldrop', 'vine', 'cannon', 'barrel', 'greasepot', 'acts', 'belt', 'fusebox',
  'dressing', 'fireworks', 'followspot', 'rope', 'dryice', 'truss'];
export const COLORS = [4, 4, 4, 4]; // gem colors, by tier
// Moves each set gets on a normal level (harder levels get fewer, see movesFactor).
export const MOVES = {
  rolldrop: 19, vine: 16, cannon: 15, barrel: 20, greasepot: 18, acts: 33, belt: 15, fusebox: 21,
  dressing: 20, fireworks: 27, followspot: 17, rope: 19, dryice: 19, truss: 21,
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
