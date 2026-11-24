// What the twists (config/twists.js) do: placing them on a new board, and
// their turn after every move. No screen code.
//   ivy, mouse        obstacles ({ t: 'block' }) that move or grow
//   propbomb          a piece with `fuse`: moves left before it fizzles
//   chameleon         a piece with `mimic: true`
//   board.revolves    [{ x, y, size }]: rings of cells that turn
//   board.hidden      [{ x, y, w, h, found }]: treasure under the floor
import { TWISTS } from '../config/twists.js';
import { get, set, block, isPiece, isMovable, isBlock, floorAt, cloneBoard } from './board.js';

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function placeTwists(board, level) {
  for (const s of level.specials || []) {
    const c = get(board, s.x, s.y);
    if (!isPiece(c)) continue;
    set(board, s.x, s.y, s.mimic ? { ...c, mimic: true } : { ...c, fuse: s.fuse });
  }
  if ((level.revolves || []).length) board.revolves = level.revolves.map((r) => ({ ...r }));
  if ((level.hidden || []).length) board.hidden = level.hidden.map((h) => ({ ...h, found: false }));
}

// Treasure whose last bit of floor has just gone. Returns 'collect' events.
export function uncover(board) {
  const out = [];
  (board.hidden || []).forEach((h, i) => {
    if (h.found) return;
    for (let y = h.y; y < h.y + h.h; y++) {
      for (let x = h.x; x < h.x + h.w; x++) if (floorAt(board, x, y) !== null) return;
    }
    board.hidden = board.hidden.map((o, j) => (j === i ? { ...o, found: true } : o)); // old snapshots stay true
    out.push({ type: 'collect', x: h.x, y: h.y, kind: 'treasure' });
  });
  return out;
}

// The cells of a ring, clockwise from its top left corner.
export function ringOf({ x, y, size }) {
  const out = [];
  for (let i = 0; i < size - 1; i++) out.push({ x: x + i, y });
  for (let i = 0; i < size - 1; i++) out.push({ x: x + size - 1, y: y + i });
  for (let i = size - 1; i > 0; i--) out.push({ x: x + i, y: y + size - 1 });
  for (let i = size - 1; i > 0; i--) out.push({ x, y: y + i });
  return out;
}

const cellsWhere = (board, test) => {
  const out = [];
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) if (test(get(board, x, y))) out.push({ x, y });
  return out;
};
const plain = (c) => isPiece(c) && c.fuse === undefined && !c.mimic;
export const countKind = (board, kind) => cellsWhere(board, (c) => isBlock(c) && c.kind === kind).length;

// The twists' turn, after a move has come to rest. Returns the events (none
// if the board has no twists).
export function takeTurn(game) {
  const board = game.board;
  const rng = game._rng;
  const events = [];
  const still = [];  // changes that happen on the spot

  // Ivy: grows into a neighbouring piece, unless some was cut this move.
  const ivy = cellsWhere(board, (c) => isBlock(c) && c.kind === 'ivy');
  if (ivy.length && !game.history.ivyCut) {
    const playable = board.cells.filter((c) => c !== null).length;
    const next = ivy.flatMap((p) => SIDES.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))).filter((p) => plain(get(board, p.x, p.y)));
    if (next.length && ivy.length < playable * TWISTS.ivyMostShare) {
      const p = rng.pick(next);
      set(board, p.x, p.y, block('ivy'));
      still.push({ type: 'grow', x: p.x, y: p.y });
    }
  }
  delete game.history.ivyCut;

  // Prop bombs count down.
  for (const p of cellsWhere(board, (c) => isPiece(c) && c.fuse !== undefined)) {
    const c = get(board, p.x, p.y);
    if (c.fuse > 1) { set(board, p.x, p.y, { ...c, fuse: c.fuse - 1 }); still.push(null); continue; }
    // Too late: a crate is left behind and the bomb turns up elsewhere.
    const free = cellsWhere(board, plain).filter((q) => q.y >= 1);
    if (!free.length) continue;
    const q = rng.pick(free);
    set(board, q.x, q.y, { ...get(board, q.x, q.y), fuse: TWISTS.fuse });
    set(board, p.x, p.y, block('crate'));
    still.push({ type: 'grow', x: p.x, y: p.y }, { type: 'grow', x: q.x, y: q.y });
  }

  // Chameleons change color.
  for (const p of cellsWhere(board, (c) => isPiece(c) && c.mimic)) {
    const c = get(board, p.x, p.y);
    set(board, p.x, p.y, { ...c, color: (c.color + 1) % game.level.colors });
    still.push({ type: 'grow', x: p.x, y: p.y });
  }
  if (still.length) events.push(...still.filter(Boolean), { type: 'frame', board: cloneBoard(board) });

  // Mice hop: each changes places with a piece beside it.
  const hops = [];
  const moved = new Set();
  for (const p of cellsWhere(board, (c) => isBlock(c) && c.kind === 'mouse')) {
    const to = SIDES.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
      .filter((q) => isPiece(get(board, q.x, q.y)) && !moved.has(q.x + ',' + q.y));
    if (!to.length) continue;
    const q = rng.pick(to);
    const mouse = get(board, p.x, p.y);
    set(board, p.x, p.y, get(board, q.x, q.y));
    set(board, q.x, q.y, mouse);
    moved.add(q.x + ',' + q.y);
    moved.add(p.x + ',' + p.y);
    hops.push({ from: p, to: q }, { from: q, to: p });
  }
  if (hops.length) events.push({ type: 'slide', moves: hops }, { type: 'frame', board: cloneBoard(board) });

  // Revolving stages turn one step (a ring with a fixed thing on it is stuck).
  const turns = [];
  for (const r of board.revolves || []) {
    const ring = ringOf(r);
    const held = ring.map((p) => get(board, p.x, p.y));
    if (!held.every(isMovable)) continue;
    ring.forEach((p, i) => {
      const to = ring[(i + 1) % ring.length];
      set(board, to.x, to.y, held[i]);
      turns.push({ from: p, to });
    });
  }
  if (turns.length) events.push({ type: 'slide', moves: turns }, { type: 'frame', board: cloneBoard(board) });

  syncTargets(game);
  return events;
}

// "Clear all the ivy": how many are needed follows how many there are.
export function syncTargets(game) {
  const t = game.targets.find((x) => x.block === 'ivy');
  if (t) t.need = t.have + countKind(game.board, 'ivy');
  // Petals on a tortoise level: those lying now, and a column for each tortoise to come.
  const p = game.targets.find((x) => x.block === 'petals');
  if (p && (game.level.drops || []).some((d) => d.kind === 'tortoise')) {
    const tor = game.targets.find((x) => x.block === 'tortoise');
    const lying = (game.board.floor || []).filter((f) => f === 'petals').length;
    p.need = p.have + lying + (tor ? tor.need - tor.have : 0) * game.board.rows;
  }
  // (A fizzled bomb may leave crates; they count only if the level asks for crates.)
}
