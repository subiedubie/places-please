// The board: a grid of cells. x = column from the left, y = row from the top.
//
// A cell is one of:
//   null                               a hole (no cell there at all)
//   { t: 'empty' }                     a playable cell with nothing in it
//   { t: 'piece', color: 0..4 }        an ordinary piece
//   { t: 'power', kind }               a power-up; kind is one of POWER_KINDS
//   { t: 'block', kind, hp, color?, inside? }
//                                      a fixed obstacle (see config/obstacles.js).
//                                      hp = hits still needed. color only for a
//                                      paint can; inside only for a padlock.
//                                      Never falls, never matches, cannot be
//                                      swapped or tapped.
//   { t: 'part', ax, ay }              one of the other cells of a block bigger
//                                      than one cell; (ax, ay) is the block's
//                                      real cell (its top-left). Fixed like a block.
//   { t: 'drop', kind: 'sandbag' }     the dropper: falls like a piece, cannot
//                                      be matched, swapped, tapped or damaged,
//                                      and is collected at the bottom of its column

import { OBSTACLES, OBSTACLES2, DROPPER } from '../config/obstacles.js';
import { TWISTS } from '../config/twists.js';

// The config entry for an obstacle kind, from either batch.
export function obstacleDef(kind) {
  return OBSTACLES[kind] || OBSTACLES2[kind];
}

export const POWER_KINDS = ['spot-h', 'spot-v', 'under', 'show', 'prism'];

export const EMPTY = Object.freeze({ t: 'empty' });

export function piece(color) {
  return { t: 'piece', color };
}

export function power(kind) {
  return { t: 'power', kind };
}

// A new obstacle of the given kind. Its hp starts at the number of hits the
// config lists for it. `extra` carries the optional parts:
//   { color }   a paint can or a curtain      { inside }  a padlock or a curtain
//   { w }       how wide a truss is           { colors }  a color-list block
//   { need }    a curtain's count             { open }    a makeup case
// For a block bigger than one cell this makes only the anchor (top-left) cell;
// use placeBlock to put the whole thing on a board.
export function block(kind, extra = {}) {
  const def = obstacleDef(kind);
  if (!def) throw new Error(`unknown obstacle kind: ${kind}`);
  const cell = { t: 'block', kind, hp: def.hits.length };
  if (extra.color !== undefined) cell.color = extra.color;
  if (extra.inside !== undefined && extra.inside !== null) cell.inside = extra.inside;
  if (extra.under) cell.under = extra.under; // the block left underneath when it breaks
  if (def.size) {
    const w = extra.w ?? def.size[0];
    const h = extra.h ?? def.size[1];
    if (w > 1 || h > 1) {
      cell.w = w;
      cell.h = h;
    }
  }
  if (def.retract) cell.hp = cell.w || 1;
  if (def.roll) cell.hp = cell.h || 1;
  if (def.vine) cell.seg = new Array(cell.w || 1).fill(2); // layers left on each square, the pot first
  if (def.charge) { cell.hp = 1; cell.charge = extra.charge ?? def.charge; cell.full = cell.charge; } // spikes still to come
  if (def.generator) {
    cell.hp = 1; // never goes down: a generator cannot break
    cell.count = extra.count ?? 0; // match hits so far
  }
  if (def.colorList) {
    // Colors still to go. With none given: 0, 1, 2 ... as many as the config says.
    cell.colors = extra.colors ? extra.colors.slice() : Array.from({ length: def.colorList }, (_, i) => i);
    cell.hp = cell.colors.length;
  }
  if (def.toggles) cell.open = !!extra.open;
  if (def.lift) { cell.hp = 1; cell.need = extra.need ?? 0; cell.left = cell.need; }
  if (def.lamp) cell.hp = 1;
  if (def.curtain) {
    cell.hp = 1;
    cell.need = extra.need ?? 0;
  }
  return cell;
}

// The cells a block covers, given its anchor (top-left) position.
export function footprint(cell, x, y) {
  const out = [];
  for (let dy = 0; dy < (cell.h || 1); dy++) {
    for (let dx = 0; dx < (cell.w || 1); dx++) out.push({ x: x + dx, y: y + dy });
  }
  return out;
}

// Put an obstacle on the board with its anchor (top-left cell) at (x, y).
// Every other cell a big block covers becomes a 'part' pointing at the anchor.
// Returns the anchor cell, or null (board unchanged) when the block would
// stick out over the edge, over a hole, or over another block.
export function placeBlock(board, x, y, kind, extra = {}) {
  const cell = block(kind, extra);
  const cells = footprint(cell, x, y);
  const big = cells.length > 1;
  if (cells.some((p) => get(board, p.x, p.y) === null || (big && isFixed(get(board, p.x, p.y))))) return null;
  for (const p of cells) set(board, p.x, p.y, { t: 'part', ax: x, ay: y });
  set(board, x, y, cell);
  return cell;
}

// A new dropper (the sandbag).
export function drop(kind = DROPPER.id) {
  return { t: 'drop', kind };
}

export function createBoard(cols, rows, holes = []) {
  const cells = new Array(cols * rows).fill(EMPTY);
  // floor: what lies UNDER each cell (null, 'confetti' or 'petals').
  const board = { cols, rows, cells, floor: new Array(cols * rows).fill(null) };
  for (const h of holes) set(board, h.x, h.y, null);
  return board;
}

export function inBounds(b, x, y) {
  return x >= 0 && y >= 0 && x < b.cols && y < b.rows;
}

// Out-of-bounds reads return null, the same as a hole.
export function get(b, x, y) {
  if (!inBounds(b, x, y)) return null;
  return b.cells[y * b.cols + x];
}

export function set(b, x, y, cell) {
  if (!inBounds(b, x, y)) return;
  b.cells[y * b.cols + x] = cell;
}

export function cloneBoard(b) {
  const copy = { cols: b.cols, rows: b.rows, cells: b.cells.slice() };
  if (b.floor) copy.floor = b.floor.slice(); // old boards may have no floor
  if (b.revolves) copy.revolves = b.revolves; // (these two are never changed in place)
  if (b.hidden) copy.hidden = b.hidden;
  if (b.paint) copy.paint = b.paint.slice();
  if (b.belts) copy.belts = b.belts; // (never changed in place)
  return copy;
}

// The floor under a cell: null, 'confetti' or 'petals'. A board without a
// floor layer (an old save) reads as all null.
export function floorAt(b, x, y) {
  if (!b.floor || !inBounds(b, x, y)) return null;
  return b.floor[y * b.cols + x] ?? null;
}

export function setFloor(b, x, y, kind) {
  if (!inBounds(b, x, y)) return;
  if (!b.floor) b.floor = new Array(b.cols * b.rows).fill(null);
  b.floor[y * b.cols + x] = kind;
}

// Take the floor off a cell because what stood on it was cleared.
// Returns the 'floor' event, or null when there was no floor there.
export function liftFloor(b, x, y) {
  const kind = floorAt(b, x, y);
  if (kind === null) return null;
  setFloor(b, x, y, null);
  return { type: 'floor', x, y, kind };
}

// PAINT (only on paint levels): board.paint holds 1 for every painted cell.
export const isPainted = (b, x, y) => Boolean(b.paint && inBounds(b, x, y) && b.paint[y * b.cols + x]);

// Paint cells. Returns the 'paint' event for the ones that were not painted
// yet, or null. `from`: the keg the paint flew out of, if it did.
export function paintCells(b, cells, from) {
  if (!b.paint) return null;
  const fresh = [];
  for (const { x, y } of cells) {
    if (get(b, x, y) === null || isPainted(b, x, y)) continue;
    b.paint[y * b.cols + x] = 1;
    fresh.push({ x, y });
  }
  if (!fresh.length) return null;
  return { type: 'paint', x: fresh[0].x, y: fresh[0].y, cells: fresh, ...(from ? { from } : {}) };
}

// Cells cleared together: if one of them is painted (or `carry`), all are.
export function spreadPaint(b, cells, carry = false) {
  if (!b.paint || !(carry || cells.some((c) => isPainted(b, c.x, c.y)))) return null;
  return paintCells(b, cells);
}

export function adjacent(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function isPiece(cell) {
  return cell !== null && cell.t === 'piece';
}

export function isPower(cell) {
  return cell !== null && cell.t === 'power';
}

export function isEmpty(cell) {
  return cell !== null && cell.t === 'empty';
}

export function isHole(cell) {
  return cell === null;
}

export function isBlock(cell) {
  return cell !== null && cell.t === 'block';
}

export function isDrop(cell) {
  return cell !== null && cell.t === 'drop';
}

// Things that fall: pieces, power-ups and the dropper.
export function isMovable(cell) {
  return cell !== null && (cell.t === 'piece' || cell.t === 'power' || cell.t === 'drop');
}

// One of the extra cells of a block bigger than one cell.
export function isPart(cell) {
  return cell !== null && cell.t === 'part';
}

// Things that never move and stop falling pieces: blocks and their parts.
export function isFixed(cell) {
  return isBlock(cell) || isPart(cell);
}

// The block that owns the cell at (x, y): the cell itself for a block, the
// anchor it points at for a part. Returns { x, y, cell } or null.
export function anchorOf(board, x, y) {
  let cell = get(board, x, y);
  if (isPart(cell)) {
    x = cell.ax;
    y = cell.ay;
    cell = get(board, x, y);
  }
  return isBlock(cell) ? { x, y, cell } : null;
}

// Would this block accept a hit right now?
//   by = 'match' (a group cleared next to it; `color` is the group's color)
//   by = 'power' (it was inside a power-up blast)
// The next hit a block needs is read from the config list, counting from the
// first entry: a block with all its hp left needs entry 0, and so on.
export function takesHit(cell, by, color) {
  if (!isBlock(cell)) return false;
  const def = obstacleDef(cell.kind);
  if (def.curtain || def.charge || def.lift || def.lamp) return false; // a curtain only opens by its count, a barrel by spikes
  if (def.retract || def.roll || def.vine) return def.hits[0] === 'any' || def.hits[0] === by;
  if (def.generator) return by === 'match'; // a power hit does nothing
  if (def.toggles && !cell.open) return false; // a closed makeup case
  if (cell.colors) return by === 'power' || cell.colors.includes(color);
  const hits = def.hits;
  const need = hits[hits.length - cell.hp];
  if (need === 'any') return true;
  if (need === 'color') return by === 'power' || color === cell.color;
  return need === by; // 'match' or 'power'
}

// Give the block at (x, y) one hit. CHANGES the board. A hit on a part of a
// big block goes to its anchor.
// Returns the list of events it caused (empty when there is no block there or
// the hit is of the wrong type; then nothing changes):
//   { type: 'block', x, y, kind, hpLeft, destroyed, by }   always first
//        (+ w, h for a big block; color = the color taken off a color-list;
//         count for a generator; blast: true for fireworks going off, which
//         the CALLER must carry out)
//   { type: 'collect', x, y, kind }     a generator's or candy jar's product
//   { type: 'floor', x, y, kind }       floor removed under a destroyed block
//   { type: 'spread', kind, cells }     new floor laid (planter, bouquet)
// When the last hit lands, the cells become what the config says it leaves.
// `rng` is only used for random power-ups.
// `touched`: the cells of the block that were hit (for a vine, which is cut
// where it is hit). `ev.special` says what it sets off; the CALLER carries it
// out (special() in powers.js).
export function hitBlockEvents(board, x, y, by, color, rng, touched) {
  const at = anchorOf(board, x, y);
  if (!at || !takesHit(at.cell, by, color)) return [];
  const cell = at.cell;
  x = at.x;
  y = at.y;
  const def = obstacleDef(cell.kind);
  const ev = { type: 'block', x, y, kind: cell.kind, hpLeft: cell.hp, destroyed: false, by };
  if (cell.w) {
    ev.w = cell.w;
    ev.h = cell.h;
  }
  const out = [ev];

  if (def.vine) return hitVine(board, cell, x, y, ev, touched || [{ x, y }]);
  if (def.retract && (cell.w || 1) > 1) {
    const end = { x: x + cell.w - 1, y };
    const w = cell.w - 1;
    const short = { ...cell, w, hp: w };
    if (w === 1) { delete short.w; delete short.h; }
    set(board, x, y, short);
    set(board, end.x, end.y, EMPTY);
    ev.hpLeft = w;
    ev.freed = [end];
    if (def.each) ev.special = specialOf(def, def.each, short, x, y);
    const lifted = liftFloor(board, end.x, end.y);
    if (lifted) out.push(lifted);
    return out;
  }
  if (def.roll) {
    const h = (cell.h || 1) - 1;
    const w = cell.w || 1;
    ev.hpLeft = h;
    ev.destroyed = h === 0;
    if (h > 0) set(board, x, y, { ...cell, h, hp: h });
    ev.rolled = [];
    for (let i = 0; i < w; i++) {
      set(board, x + i, y + h, block(cell.under || 'crate'));
      ev.rolled.push({ x: x + i, y: y + h });
    }
    return out;
  }

  // A generator never breaks: it counts match hits and hands out its product
  // on every third one (the number is `every` in the config).
  if (def.generator) {
    const count = cell.count + 1;
    set(board, x, y, { ...cell, count }); // a fresh object, so old snapshots stay true
    ev.count = count;
    if (count % def.every === 0) out.push({ type: 'collect', x, y, kind: def.product });
    return out;
  }

  // A fresh object, so earlier snapshots of the board keep the old hp.
  const next = { ...cell, hp: cell.hp - 1 };
  if (cell.colors) {
    // A match takes off its own color; a power hit takes off the first one.
    const i = by === 'match' ? cell.colors.indexOf(color) : 0;
    ev.color = cell.colors[i];
    next.colors = cell.colors.filter((_, k) => k !== i);
    next.hp = next.colors.length;
  }
  ev.hpLeft = next.hp;
  if (def.product) out.push({ type: 'collect', x, y, kind: def.product }); // candy jar: every hit
  if (next.hp > 0) {
    set(board, x, y, next);
    if (def.each) ev.special = specialOf(def, def.each, cell, x, y);
    return out;
  }

  // Destroyed. First the floor under it goes, then it leaves what the config says.
  ev.destroyed = true;
  const cells = footprint(cell, x, y);
  for (const p of cells) {
    const lifted = liftFloor(board, p.x, p.y);
    if (lifted) out.push(lifted);
  }
  for (const p of cells) set(board, p.x, p.y, EMPTY);
  const leaves = def.leaves;
  if (leaves === 'inside' && cell.inside) {
    set(board, x, y, cell.inside);
  } else if (leaves === 'power') {
    for (const p of cells) set(board, p.x, p.y, power(rng ? rng.pick(POWER_KINDS) : POWER_KINDS[0]));
  } else if (leaves === 'confetti') {
    // Planter: confetti under each of its cells.
    for (const p of cells) setFloor(board, p.x, p.y, 'confetti');
    out.push({ type: 'spread', kind: 'confetti', cells });
  } else if (leaves === 'petals') {
    // Bouquet: petals under its own cell and under each side neighbour that is
    // a real cell, not under a block, and has no floor yet.
    const laid = [];
    for (const [dx, dy] of [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = get(board, x + dx, y + dy);
      if (n === null || isFixed(n) || floorAt(board, x + dx, y + dy) !== null) continue;
      setFloor(board, x + dx, y + dy, 'petals');
      laid.push({ x: x + dx, y: y + dy });
    }
    out.push({ type: 'spread', kind: 'petals', cells: laid });
  } else if (leaves === 'doves') {
    // Dovecote: a dove in all of its cells but one.
    const gap = rng ? rng.int(cells.length) : cells.length - 1;
    cells.forEach((p, i) => { if (i !== gap) set(board, p.x, p.y, drop('dove')); });
  } else if (leaves === 'drop') {
    // A trophy: one thing that falls, from the middle of it.
    const p = cells[Math.floor((cells.length - 1) / 2)];
    set(board, p.x, p.y, drop(def.what));
  } else if (leaves === 'dust') {
    setFloor(board, x, y, 'dust');
    out.push({ type: 'spread', kind: 'dust', cells: [{ x, y }] });
  } else if (leaves === 'splat') {
    const splash = paintCells(board, [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => ({ x: x + dx, y: y + dy })), { x, y });
    if (splash) out.push(splash);
  } else if (leaves === 'under') {
    ev.rolled = cells;
    for (const p of cells) set(board, p.x, p.y, block(cell.under || 'crate'));
  } else if (leaves === 'petalrow') {
    // Flower cart: petals under everything in its row.
    const laid = [];
    for (let px = 0; px < board.cols; px++) {
      if (get(board, px, y) === null || floorAt(board, px, y) !== null) continue;
      setFloor(board, px, y, 'petals');
      laid.push({ x: px, y });
    }
    out.push({ type: 'spread', kind: 'petals', cells: laid });
  } else if (leaves === 'paint') {
    // Paint keg: paint flies to squares anywhere on the board.
    const dry = [];
    for (let py = 0; py < board.rows; py++) {
      for (let px = 0; px < board.cols; px++) {
        if (get(board, px, py) !== null && !isPainted(board, px, py)) dry.push({ x: px, y: py });
      }
    }
    const hit = [];
    for (let i = 0; i < TWISTS.kegSplash && dry.length; i++) hit.push(dry.splice(rng ? rng.int(dry.length) : 0, 1)[0]);
    const splash = paintCells(board, hit, { x, y });
    if (splash) out.push(splash);
  } else if (leaves === 'goo') {
    // Greasepaint: covers the gems around it.
    const laid = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = get(board, x + dx, y + dy);
        if (!(isPiece(c) || (dx === 0 && dy === 0))) continue;
        set(board, x + dx, y + dy, block('goo'));
        laid.push({ x: x + dx, y: y + dy });
      }
    }
    out.push({ type: 'goo', x, y, cells: laid });
  } else if (['blast', 'bigblast', 'rocket', 'beam', 'toss', 'spike', 'laser', 'storm', 'bursts', 'pop'].includes(leaves)) {
    ev.special = specialOf(def, leaves, cell, x, y);
    if (leaves === 'blast' || leaves === 'bigblast') ev.blast = true;
  }
  if (def.linked) {
    // The ones joined to it in its row go too, one after the other.
    for (const d of [-1, 1]) {
      for (let nx = x + d; ; nx += d) {
        const c = get(board, nx, y);
        if (!isBlock(c) || c.kind !== cell.kind) break;
        set(board, nx, y, EMPTY);
        out.push({ type: 'block', x: nx, y, kind: cell.kind, hpLeft: 0, destroyed: true, by });
        const lifted = liftFloor(board, nx, y);
        if (lifted) out.push(lifted);
      }
    }
  }
  return out;
}

// What an obstacle sets off, for special() in powers.js.
const specialOf = (def, kind, cell, x, y) => ({
  kind, x, y, w: cell.w || 1, h: cell.h || 1, what: def.what, count: def.count, feeds: def.feeds, look: def.look,
});

// A vine: every square that was hit loses a layer. One with none left is cut,
// and everything beyond it (away from the pot) falls off. Cut at the pot, the
// whole vine goes.
function hitVine(board, cell, x, y, ev, touched) {
  const out = [ev];
  const seg = cell.seg.slice();
  for (const t of touched) {
    const i = t.x - x;
    if (t.y === y && i >= 0 && i < seg.length && seg[i] > 0) seg[i] -= 1;
  }
  const cut = seg.indexOf(0);
  if (cut < 0) {
    set(board, x, y, { ...cell, seg });
    return out;
  }
  ev.freed = [];
  for (let i = cut; i < seg.length; i++) {
    set(board, x + i, y, EMPTY);
    ev.freed.push({ x: x + i, y });
    const lifted = liftFloor(board, x + i, y);
    if (lifted) out.push(lifted);
  }
  if (cut === 0) {
    ev.hpLeft = 0;
    ev.destroyed = true;
  } else {
    const left = { ...cell, w: cut, seg: seg.slice(0, cut) };
    if (cut === 1) { delete left.w; delete left.h; }
    set(board, x, y, left);
  }
  return out;
}

// The older, one-event form of hitBlockEvents: returns just the 'block' event
// (or null). The rules themselves use hitBlockEvents so nothing is lost.
export function hitBlock(board, x, y, by, color, rng) {
  return hitBlockEvents(board, x, y, by, color, rng)[0] ?? null;
}
