// Adds twists (config/twists.js) to a generated level.
import { makeRng } from '../engine/rng.js';
import { TWISTS } from '../config/twists.js';

// Which twists level n has.
export function twistsFor(n, tier, cfg = TWISTS) {
  if (n % 10 === 0) return []; // bonus levels stay plain
  const intro = Object.entries(cfg.intro).find(([, at]) => at === n);
  if (intro) return [intro[0]];
  const known = Object.keys(cfg.intro).filter((k) => cfg.intro[k] < n);
  const rng = makeRng(n).fork('twists');
  if (known.length === 0 || rng.next() >= cfg.share[tier]) return [];
  const first = rng.pick(known);
  const rest = known.filter((k) => k !== first);
  return rest.length && rng.next() < cfg.secondShare ? [first, rng.pick(rest)] : [first];
}

const TARGET = { ivy: 'ivy', mouse: 'mouse', propbomb: 'propbomb', chameleon: 'chameleon', treasure: 'treasure' };

// Returns the level with its twists added (the level itself if it has none).
export function addTwists(level, cfg = TWISTS) {
  const wanted = twistsFor(level.n, level.tier, cfg);
  if (wanted.length === 0) return level;
  const rng = makeRng(level.n).fork('twist-places');
  const L = { ...level, blocks: level.blocks.slice(), floor: level.floor.slice(), targets: level.targets.slice(), specials: [], revolves: [], hidden: [] };

  // Cells already spoken for.
  const key = (x, y) => x + ',' + y;
  const used = new Set(L.holes.map((h) => key(h.x, h.y)));
  for (const b of L.blocks) {
    const [w, h] = sizeOf(b);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used.add(key(b.x + dx, b.y + dy));
  }
  for (const d of L.drops) used.add(key(d.x, d.y));
  const clear = (x, y, w, h) => {
    if (x < 0 || y < 0 || x + w > L.cols || y + h > L.rows) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (used.has(key(x + dx, y + dy))) return false;
    return true;
  };
  const take = (x, y, w, h) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used.add(key(x + dx, y + dy));
  };
  const spots = (w, h, top) => {
    const out = [];
    for (let y = top; y + h <= L.rows; y++) for (let x = 0; x + w <= L.cols; x++) if (clear(x, y, w, h)) out.push({ x, y });
    return out;
  };
  const howMany = (kind) => cfg.counts[kind][0] + rng.int(cfg.counts[kind][1] - cfg.counts[kind][0] + 1);
  let extra = 0;

  for (const kind of wanted) {
    const full = L.targets.length >= 3;
    if (TARGET[kind] && full) {
      // Room for its target: it takes the place of a color target, if any.
      const i = L.targets.findIndex((t) => t.color !== undefined);
      if (i < 0) continue;
      L.targets.splice(i, 1);
    }
    let made = 0;
    const n = howMany(kind);
    if (kind === 'revolve') {
      for (let i = 0; i < n; i++) {
        const size = rng.int(2) ? 3 : 2;
        const at = spots(size, size, 1);
        if (!at.length) continue;
        const p = rng.pick(at);
        take(p.x, p.y, size, size);
        L.revolves.push({ x: p.x, y: p.y, size });
        made++;
      }
    } else if (kind === 'treasure') {
      if (L.floor.length > 0) continue; // the confetti is busy
      for (let i = 0; i < n; i++) {
        const at = spots(2, 2, 2);
        if (!at.length) continue;
        const p = rng.pick(at);
        take(p.x, p.y, 2, 2);
        L.hidden.push({ x: p.x, y: p.y, w: 2, h: 2 });
        made++;
      }
      // Confetti over the treasure and a ring of cells round it, so where it
      // lies is a guess.
      const covered = new Set();
      for (const t of L.hidden) {
        const ox = rng.int(2);
        const oy = rng.int(2);
        for (let y = t.y - oy; y < t.y - oy + 3; y++) {
          for (let x = t.x - ox; x < t.x - ox + 3; x++) {
            const inside = x >= t.x && x < t.x + 2 && y >= t.y && y < t.y + 2;
            if (x < 0 || y < 0 || x >= L.cols || y >= L.rows || covered.has(key(x, y))) continue;
            if (!inside && used.has(key(x, y))) continue;
            covered.add(key(x, y));
            L.floor.push({ x, y, kind: 'confetti' });
          }
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const at = spots(1, 1, 2);
        if (!at.length) continue;
        const p = rng.pick(at);
        take(p.x, p.y, 1, 1);
        if (kind === 'propbomb') L.specials.push({ ...p, fuse: cfg.fuse });
        else if (kind === 'chameleon') L.specials.push({ ...p, mimic: true });
        else L.blocks.push({ ...p, kind });
        made++;
      }
    }
    if (made && TARGET[kind]) L.targets.push({ block: TARGET[kind], need: made });
    extra += made * cfg.moves[kind];
  }
  if (L.targets.length === 0) L.targets = level.targets.slice();
  L.moves = Math.min(60, Math.round(level.moves + extra));
  return L;
}

// How many cells a block covers.
import { OBSTACLES2 } from '../config/obstacles.js';
function sizeOf(b) {
  const def = OBSTACLES2[b.kind];
  const [w, h] = (def && def.size) || [1, 1];
  return [b.w || w, h];
}
