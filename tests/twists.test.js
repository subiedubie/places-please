// The twists: ivy, mice, prop bombs, chameleons, revolving stages, treasure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, serialize, deserialize, stillNeeded } from '../engine/game.js';
import { ringOf, countKind } from '../engine/twists.js';
import { generateLevel } from '../levels/generate.js';
import { twistsFor } from '../levels/twists.js';
import { TWISTS } from '../config/twists.js';
import { findLegalMoves } from '../engine/moves.js';
import { findGroups } from '../engine/matches.js';
import { get, isPiece, isPower } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';

const LEVEL = { n: 1, tier: 0, cols: 8, rows: 8, holes: [], colors: 5, moves: 40, targets: [{ color: 0, need: 999 }], blocks: [], drops: [], floor: [] };
const swap = (g) => ({ type: 'swap', ...findLegalMoves(g.board).find((m) => isPiece(get(g.board, m.a.x, m.a.y)) && isPiece(get(g.board, m.b.x, m.b.y))) });
// A move that gets a target, if there is one; otherwise any.
function aim(g) {
  for (const m of findLegalMoves(g.board)) {
    const a = { type: 'swap', ...m };
    const copy = deserialize(serialize(g));
    act(copy, a);
    if (copy.targets[0].have > 0) return a;
  }
  return swap(g);
}
const all = (g, f) => g.board.cells.filter((c) => c && f(c));

test('ivy grows when none is cut, and not when some is', () => {
  let grew = 0;
  let cut = 0;
  for (let s = 1; s <= 60; s++) {
    const g = newGame({ ...LEVEL, blocks: [{ x: 3, y: 5, kind: 'ivy' }, { x: 4, y: 5, kind: 'ivy' }], targets: [{ block: 'ivy', need: 2 }] }, s);
    const before = countKind(g.board, 'ivy');
    act(g, s % 2 ? aim(g) : swap(g));
    const now = countKind(g.board, 'ivy');
    if (g.targets[0].have === 0) { assert.equal(now, before + 1); grew++; } else { assert.equal(now, before - g.targets[0].have); cut++; }
    assert.equal(g.targets[0].need - g.targets[0].have, now);
    assert.equal(g.status === 'won', now === 0);
  }
  assert.ok(grew > 10 && cut > 3, `${grew} ${cut}`);
});

test('a mouse changes cell each move until it is caught', () => {
  let hops = 0;
  for (let s = 1; s <= 30; s++) {
    const g = newGame({ ...LEVEL, blocks: [{ x: 4, y: 6, kind: 'mouse' }], targets: [{ block: 'mouse', need: 1 }] }, s);
    act(g, swap(g));
    if (countKind(g.board, 'mouse')) { if (get(g.board, 4, 6)?.kind !== 'mouse') hops++; } else assert.equal(g.status, 'won');
  }
  assert.ok(hops > 15);
});

test('a prop bomb counts down, and a matched one explodes and counts', () => {
  let matched = 0;
  for (let s = 1; s <= 80; s++) {
    const g = newGame({ ...LEVEL, specials: [{ x: 2, y: 4, fuse: 7 }, { x: 5, y: 4, fuse: 7 }], targets: [{ block: 'propbomb', need: 2 }] }, s);
    assert.equal(all(g, (c) => c.fuse !== undefined).length, 2);
    const ev = act(g, s % 2 ? aim(g) : swap(g));
    const left = all(g, (c) => c.fuse !== undefined);
    assert.equal(left.length + g.targets[0].have, 2);
    for (const c of left) assert.equal(c.fuse, g.status === 'won' ? 7 : 6);
    if (g.targets[0].have && ev.some((e) => e.type === 'clear' && e.cause === 'fireworks')) matched++;
  }
  assert.ok(matched > 2, `${matched}`);
});

test('a prop bomb that runs out leaves a crate and turns up elsewhere', () => {
  let seen = 0;
  for (let s = 1; s <= 30; s++) {
    const g = newGame({ ...LEVEL, specials: [{ x: 0, y: 7, fuse: 1 }], targets: [{ block: 'propbomb', need: 1 }] }, s);
    act(g, swap(g));
    if (g.status === 'won') continue;
    assert.equal(all(g, (c) => c.fuse === TWISTS.fuse).length, 1);
    assert.equal(countKind(g.board, 'crate'), 1);
    seen++;
  }
  assert.ok(seen > 15);
});

test('a chameleon changes color each move; a revolving stage turns one step', () => {
  for (let s = 1; s <= 20; s++) {
    const g = newGame({ ...LEVEL, specials: [{ x: 0, y: 7, mimic: true }], targets: [{ block: 'chameleon', need: 1 }] }, s);
    const was = get(g.board, 0, 7).color;
    const ev = act(g, swap(g));
    if (g.status !== 'won' && get(g.board, 0, 7).mimic && !ev.some((e) => e.type === 'reshuffle')) {
      assert.equal(get(g.board, 0, 7).color, (was + 1) % 5);
    }
  }
  assert.equal(ringOf({ x: 0, y: 0, size: 2 }).length, 4);
  assert.equal(ringOf({ x: 0, y: 0, size: 3 }).length, 8);
  const g = newGame({ ...LEVEL, revolves: [{ x: 2, y: 2, size: 3 }] }, 4);
  const slides = act(g, swap(g)).filter((e) => e.type === 'slide');
  assert.equal(slides.length, 1);
  assert.equal(slides[0].moves.length, 8);
});

test('treasure is collected when the last confetti over it goes', () => {
  const floor = [];
  for (let y = 4; y < 6; y++) for (let x = 3; x < 5; x++) floor.push({ x, y, kind: 'confetti' });
  let done = 0;
  for (let s = 1; s <= 30; s++) {
    const g = newGame({ ...LEVEL, floor, hidden: [{ x: 3, y: 4, w: 2, h: 2 }], targets: [{ block: 'treasure', need: 1 }], moves: 60 }, s);
    while (g.status === 'playing') {
      const bare = floor.every((f) => g.board.floor[f.y * 8 + f.x] === null);
      assert.equal(bare, false);
      const ms = findLegalMoves(g.board);
      const near = ms.find((m) => [m.a, m.b].some((p) => floor.some((f) => f.x === p.x && f.y === p.y && g.board.floor[f.y * 8 + f.x])));
      act(g, { type: 'swap', ...(near || ms[0]) });
    }
    if (g.status === 'won') done++;
  }
  assert.ok(done > 15, `${done}`);
});

test('every twist has its introduction level, and the levels are well formed', () => {
  for (const [kind, n] of Object.entries(TWISTS.intro)) {
    assert.deepEqual(twistsFor(n, 0), [kind]);
    const L = generateLevel(n);
    const there = kind === 'revolve' ? L.revolves.length : L.targets.some((t) => t.block === ({ doves: 'dove', paint: 'paint_floor' }[kind] || kind));
    assert.ok(there, `${kind} is on level ${n}`);
  }
  const seen = {};
  for (let n = 1; n <= 400; n++) {
    const L = generateLevel(n);
    assert.deepEqual(generateLevel(n), L);
    assert.ok(L.targets.length >= 1 && L.targets.length <= 3, `level ${n}`);
    assert.ok(L.moves <= 60);
    for (const t of L.targets) seen[t.block] = (seen[t.block] || 0) + 1;
    const g = newGame(L, 3);
    for (const t of L.targets) {
      if (t.block === 'propbomb') assert.equal(all(g, (c) => c.fuse !== undefined).length, t.need, `level ${n}`);
      if (t.block === 'chameleon') assert.equal(all(g, (c) => c.mimic).length, t.need, `level ${n}`);
      if (t.block === 'mouse' || t.block === 'ivy') assert.equal(countKind(g.board, t.block), t.need, `level ${n}`);
      if (t.block === 'treasure') assert.equal(g.board.hidden.length, t.need);
    }
    assert.equal(JSON.stringify(serialize(deserialize(serialize(g)))), JSON.stringify(serialize(g)));
  }
  for (const k of ['ivy', 'mouse', 'propbomb', 'chameleon', 'treasure']) assert.ok(seen[k] >= 10, `${k}: ${seen[k]}`);
});

test('400 random games on twist levels never break', () => {
  const rng = makeRng(8);
  let won = 0;
  for (let i = 0; i < 400; i++) {
    const L = generateLevel(5 + i);
    const g = newGame(L, i);
    let n = 0;
    while (g.status === 'playing') {
      const ms = findLegalMoves(g.board);
      const p = g.board.cells.findIndex((c) => isPower(c));
      assert.ok(ms.length || p >= 0, `level ${L.n} stuck`);
      const a = ms.length ? { type: 'swap', ...rng.pick(ms) } : { type: 'tap', at: { x: p % L.cols, y: Math.floor(p / L.cols) } };
      assert.notEqual(act(g, a)[0].type, 'invalid');
      assert.equal(findGroups(g.board).length, 0, `level ${L.n}`);
      assert.ok(++n <= L.moves);
    }
    if (g.status === 'won') won++;
  }
  console.log(`twists: ${won} of 400 won with random play`);
});

test('aiming: below a wanted sandbag, under a wanted curtain color, and mice', () => {
  const g = newGame({ ...LEVEL, drops: [{ x: 2, y: 3 }], blocks: [{ x: 6, y: 6, kind: 'mouse' }], targets: [{ block: 'sandbag', need: 1 }, { block: 'mouse', need: 1 }] }, 2);
  const need = stillNeeded(g);
  const at = (x, y) => need(get(g.board, x, y), x, y);
  const col = [...Array(8).keys()].flatMap((x) => [...Array(8).keys()].filter((y) => g.board.cells[y * 8 + x]?.t === 'drop').map((y) => ({ x, y })));
  assert.ok(col.length >= 1);
  assert.equal(at(col[0].x, col[0].y + 1), true);
  assert.equal(at((col[0].x + 1) % 8 === 6 ? 0 : (col[0].x + 1) % 8, 7), false);
  assert.equal(at(6, 6), true);
});
