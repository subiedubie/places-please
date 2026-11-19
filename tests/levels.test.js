import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generateLevel as generate, introLevels, blockSize } from '../levels/generate.js';
import { CURVE } from '../config/curve.js';
import { OBSTACLES, DROPPER } from '../config/obstacles.js';

// The batch-1 tests below run with no batch-2 kind switched on, whatever the
// engine says it supports today. The batch-2 tests are at the end of the file.
const generateLevel = (n) => generate(n, CURVE, { ready: [] });

// engine/game.js is written separately; tests that need it skip until it exists.
const gameUrl = new URL('../engine/game.js', import.meta.url);
const noGame = existsSync(gameUrl) ? false : 'engine/game.js not written yet';

test('generateLevel is a pure function of n', () => {
  for (let n = 1; n <= 200; n++) {
    assert.deepEqual(generateLevel(n), generateLevel(n));
  }
});

test('tier pattern', () => {
  for (const n of [5, 15, 25]) assert.equal(generateLevel(n).tier, 1, `level ${n}`);
  for (const n of [8, 18]) assert.equal(generateLevel(n).tier, 2, `level ${n}`);
  for (const n of [23, 53]) assert.equal(generateLevel(n).tier, 3, `level ${n}`);
  for (const n of [10, 30]) assert.equal(generateLevel(n).tier, 0, `level ${n}`);
  for (let n = 1; n <= 300; n++) {
    const expected = n % 30 === 23 ? 3 : n % 10 === 5 ? 1 : n % 10 === 8 ? 2 : 0;
    assert.equal(generateLevel(n).tier, expected, `level ${n}`);
  }
});

test('every level is well formed', () => {
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    assert.equal(L.n, n);
    assert.ok(L.colors === 4 || L.colors === 5, `level ${n} colors`);
    assert.ok(L.moves > 0, `level ${n} moves`);
    assert.ok(L.targets.length >= 1 && L.targets.length <= 3, `level ${n} target count`);
    const seen = new Set();
    for (const t of L.targets) {
      if (t.block !== undefined) {
        // An obstacle target: a known kind (or the sandbag), named once.
        assert.ok(t.block === DROPPER.id || t.block in OBSTACLES, `level ${n} target kind ${t.block}`);
        assert.equal(t.color, undefined, `level ${n} target is both color and block`);
        assert.ok(!seen.has(t.block), `level ${n} repeated target kind`);
        seen.add(t.block);
      } else {
        assert.ok(Number.isInteger(t.color) && t.color >= 0 && t.color < L.colors, `level ${n} target color`);
        assert.ok(!seen.has(t.color), `level ${n} repeated target color`);
        seen.add(t.color);
      }
      assert.ok(Number.isInteger(t.need) && t.need > 0, `level ${n} need`);
    }
    assert.ok(Array.isArray(L.blocks) && Array.isArray(L.drops), `level ${n} blocks/drops lists`);
  }
});

test('colors and target counts follow the curve', () => {
  for (let n = 1; n <= 10; n++) assert.equal(generateLevel(n).targets.length, 1);
  for (let n = 1; n <= 20; n++) {
    const L = generateLevel(n);
    // The number of colors comes from the settings (five from level 1 since
    // 18 Nov. 2026, when the owner found the game too easy).
    const C = CURVE.colors;
    const want = n <= C.earlyThroughLevel && L.tier < C.alwaysLaterFromTier ? C.early : C.later;
    assert.equal(L.colors, want, `level ${n}`);
  }
  for (let n = 21; n <= 100; n++) assert.equal(generateLevel(n).colors, 5);
  // Levels 1-10 use the small 7x8 board; the first two are plain rectangles.
  for (let n = 1; n <= 10; n++) {
    const L = generateLevel(n);
    assert.deepEqual([L.cols, L.rows], [7, 8]);
  }
  for (let n = 1; n <= 2; n++) assert.equal(generateLevel(n).holes.length, 0);
  // Board shapes vary: the first 60 levels use many different layouts
  // (the owner asked for this on 17 Nov. 2026: "the board designs are always the same").
  const layouts = new Set();
  for (let n = 1; n <= 60; n++) {
    const L = generateLevel(n);
    layouts.add(`${L.cols}x${L.rows}:` + L.holes.map((h) => `${h.x},${h.y}`).sort().join(';'));
  }
  assert.ok(layouts.size >= 20, `only ${layouts.size} different board shapes in levels 1-60`);
  // Somewhere later, more than one target and a board with holes both turn up.
  const later = [];
  for (let n = 11; n <= 200; n++) later.push(generateLevel(n));
  assert.ok(later.some((L) => L.targets.length === 3));
  assert.ok(later.some((L) => L.holes.length > 0));
});

test('holes are inside the board and leave 4+ playable cells per column', () => {
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    const perColumn = new Array(L.cols).fill(L.rows);
    const seen = new Set();
    for (const h of L.holes) {
      assert.ok(h.x >= 0 && h.x < L.cols && h.y >= 0 && h.y < L.rows, `level ${n} hole off board`);
      assert.ok(!seen.has(`${h.x},${h.y}`), `level ${n} repeated hole`);
      seen.add(`${h.x},${h.y}`);
      perColumn[h.x]--;
    }
    for (const count of perColumn) assert.ok(count >= 4, `level ${n} column too short`);
  }
});

// ---- Obstacles ---------------------------------------------------------------

const O = CURVE.obstacles;
const key = (c) => `${c.x},${c.y}`;
const isPowerOnly = (kind) => O.powerOnlyKinds.includes(kind);
// Kinds on a level's board, counted the way targets count them.
function kindCounts(L) {
  const counts = {};
  for (const b of L.blocks) {
    counts[b.kind] = (counts[b.kind] || 0) + 1;
    if (b.inside && b.inside.t === 'block') counts[b.inside.kind] = (counts[b.inside.kind] || 0) + 1;
  }
  if (L.drops.length > 0) counts[DROPPER.id] = L.drops.length;
  return counts;
}

test('blocks and drops are a pure function of n (1..300)', () => {
  for (let n = 1; n <= 300; n++) {
    const a = generateLevel(n);
    const b = generateLevel(n);
    assert.deepEqual(a.blocks, b.blocks, `level ${n} blocks`);
    assert.deepEqual(a.drops, b.drops, `level ${n} drops`);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `level ${n}`);
  }
});

test('levels 1-3 and levels ending in 0 have no obstacles; the others do', () => {
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    if (n <= 3 || n % 10 === 0) {
      assert.deepEqual([L.blocks, L.drops], [[], []], `level ${n}`);
      for (const t of L.targets) assert.equal(t.block, undefined, `level ${n} block target`);
    } else {
      assert.ok(L.blocks.length + L.drops.length > 0, `level ${n} has no obstacles`);
    }
  }
});

test('an introduction level contains exactly the introduced kind', () => {
  const intro = introLevels(CURVE, []);
  // Config levels that end in 0 move to the next level; the rest stay put.
  for (const [kind, n] of Object.entries(O.intro)) {
    assert.equal(intro[kind], n % 10 === 0 ? n + 1 : n, `${kind} intro level`);
  }
  assert.equal(new Set(Object.values(intro)).size, Object.keys(intro).length);
  for (const [kind, n] of Object.entries(intro)) {
    const L = generateLevel(n);
    assert.deepEqual(Object.keys(kindCounts(L)), [kind], `level ${n} introduces ${kind}`);
    assert.deepEqual(L.targets.filter((t) => t.block !== undefined).map((t) => t.block), [kind]);
    // No kind shows up before its introduction.
    for (let m = 1; m < n; m++) {
      assert.ok(!(kind in kindCounts(generateLevel(m))), `${kind} on level ${m}, before level ${n}`);
    }
  }
});

test('obstacles sit on free, playable cells below the top two rows', () => {
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    const holes = new Set(L.holes.map(key));
    const used = new Set();
    for (const c of [...L.blocks, ...L.drops]) {
      assert.ok(c.x >= 0 && c.x < L.cols && c.y >= 0 && c.y < L.rows, `level ${n} obstacle off board`);
      assert.ok(!holes.has(key(c)), `level ${n} obstacle on a hole`);
      assert.ok(c.y >= 2, `level ${n} obstacle in the top two rows`);
      assert.ok(!used.has(key(c)), `level ${n} two obstacles on ${key(c)}`);
      used.add(key(c));
    }
    const playable = L.cols * L.rows - L.holes.length;
    assert.ok(playable - used.size >= 0.4 * playable, `level ${n} under 40% ordinary cells`);
  }
});

test('block kinds, paint colors, padlock contents and power-only limits', () => {
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    let powerOnly = 0;
    let flats = 0;
    for (const b of L.blocks) {
      assert.ok(b.kind in OBSTACLES, `level ${n} unknown kind ${b.kind}`);
      if (b.kind === 'paint') {
        assert.ok(Number.isInteger(b.color) && b.color >= 0 && b.color < L.colors, `level ${n} paint color`);
      } else {
        assert.equal(b.color, undefined, `level ${n} color on ${b.kind}`);
      }
      if (b.kind === 'padlock') {
        const i = b.inside;
        assert.ok(i && (i.t === 'piece' || i.t === 'block'), `level ${n} padlock contents`);
        if (i.t === 'piece') assert.ok(i.color >= 0 && i.color < L.colors, `level ${n} padlock piece color`);
        if (i.t === 'block') {
          assert.ok(i.kind in OBSTACLES && i.kind !== 'padlock', `level ${n} padlock holds ${i.kind}`);
          assert.equal(i.hp, OBSTACLES[i.kind].hits.length, `level ${n} padlock contents hp`);
          assert.ok(introLevels(CURVE, [])[i.kind] < n, `level ${n} padlock holds a kind not introduced yet`);
        }
      } else {
        assert.equal(b.inside, undefined, `level ${n} inside on ${b.kind}`);
      }
      if (isPowerOnly(b.kind)) powerOnly++;
      if (b.kind === 'flat') flats++;
    }
    assert.ok(powerOnly <= 8, `level ${n} has ${powerOnly} power-only cells`);
    assert.ok(flats <= 5, `level ${n} has ${flats} flats`);
    const kinds = Object.keys(kindCounts(L)).length;
    assert.ok(kinds <= CURVE.obstacles.maxKinds[L.tier], `level ${n} has ${kinds} kinds`);
  }
});

test('paint cans lie in one-color rows or columns', () => {
  let seen = 0;
  for (let n = 1; n <= 500; n++) {
    const paint = generateLevel(n).blocks.filter((b) => b.kind === 'paint');
    if (paint.length === 0) continue;
    seen++;
    // Along one of the two axes, every line holds a single color.
    const oneColorLines = ['x', 'y'].some((axis) => {
      const byLine = new Map();
      for (const b of paint) byLine.set(b[axis], (byLine.get(b[axis]) || new Set()).add(b.color));
      return [...byLine.values()].every((colors) => colors.size === 1);
    });
    assert.ok(oneColorLines, `level ${n} paint lines mix colors`);
  }
  assert.ok(seen > 0, 'no paint level found');
});

test('sandbags: 2-5, one per column, nothing in their way that needs a power-up', () => {
  let seen = 0;
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    if (L.drops.length === 0) continue;
    seen++;
    assert.ok(L.drops.length >= 2 && L.drops.length <= 5, `level ${n} has ${L.drops.length} sandbags`);
    assert.equal(new Set(L.drops.map((d) => d.x)).size, L.drops.length, `level ${n} two sandbags in a column`);
    for (const d of L.drops) {
      assert.ok(d.y >= 2 && d.y < L.rows - 1, `level ${n} sandbag row`);
      for (const h of L.holes) assert.ok(!(h.x === d.x && h.y > d.y), `level ${n} hole under a sandbag`);
      for (const b of L.blocks) {
        assert.ok(!(b.x === d.x && b.y > d.y && isPowerOnly(b.kind)), `level ${n} power-only block under a sandbag`);
      }
    }
  }
  assert.ok(seen > 0, 'no sandbag level found');
});

test('power-only blocks never cut a cell off from falling pieces', () => {
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    const holes = new Set(L.holes.map(key));
    const walls = new Set(L.blocks.filter((b) => isPowerOnly(b.kind)).map(key));
    const fed = new Set();
    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        if (holes.has(`${x},${y}`) || walls.has(`${x},${y}`)) continue;
        let above = y - 1;
        while (above >= 0 && holes.has(`${x},${above}`)) above--;
        const ok = above < 0 || fed.has(`${x},${above}`) || fed.has(`${x - 1},${y - 1}`) || fed.has(`${x + 1},${y - 1}`);
        assert.ok(ok, `level ${n} cell ${x},${y} is walled in by power-only blocks`);
        fed.add(`${x},${y}`);
      }
    }
  }
});

test('obstacle targets ask for everything on the board; moves follow the allowance', () => {
  let withColor = 0;
  let obstacleLevels = 0;
  for (let n = 1; n <= 500; n++) {
    const L = generateLevel(n);
    const counts = kindCounts(L);
    const blockTargets = L.targets.filter((t) => t.block !== undefined);
    assert.deepEqual(
      Object.fromEntries(blockTargets.map((t) => [t.block, t.need])),
      counts,
      `level ${n} block targets`,
    );
    if (blockTargets.length === 0) {
      assert.equal(L.moves, CURVE.baseMoves[L.tier], `level ${n} moves`);
      continue;
    }
    obstacleLevels++;
    const colorTargets = L.targets.length - blockTargets.length;
    assert.ok(colorTargets <= 1, `level ${n} has ${colorTargets} color targets`);
    withColor += colorTargets;
    // Moves = base + allowance per hit needed and per sandbag, rounded, capped.
    const e = O.extraMoves;
    let extra = L.drops.length * e.perSandbag;
    const hits = (kind) => OBSTACLES[kind].hits.reduce((sum, h) => sum + (h === 'power' ? e.perPowerHit : e.perMatchHit), 0);
    for (const b of L.blocks) extra += hits(b.kind) + (b.inside && b.inside.t === 'block' ? hits(b.inside.kind) : 0);
    // Within one move: the generator adds the same allowances in a different
    // order, and a total landing on a half can round either way.
    const expected = Math.min(e.cap, Math.round(CURVE.baseMoves[L.tier] + extra));
    assert.ok(Math.abs(L.moves - expected) <= 1, `level ${n} moves: ${L.moves} vs ${expected}`);
    assert.ok(L.moves <= 60 && L.moves >= CURVE.baseMoves[L.tier], `level ${n} moves range`);
  }
  // A color target joins some obstacle levels, but not most of them.
  assert.ok(withColor > 0 && withColor < obstacleLevels / 2, `${withColor} of ${obstacleLevels}`);
});

test('newGame accepts every level 1..500', { skip: noGame }, async () => {
  const { newGame } = await import('../engine/game.js');
  for (let n = 1; n <= 500; n++) {
    const game = newGame(generate(n), 1);
    assert.equal(game.status, 'playing', `level ${n}`);
    assert.equal(game.movesLeft, generate(n).moves, `level ${n}`);
  }
});

// ---- Obstacles, batch 2 (docs/OBSTACLES2.md) ---------------------------------
// These tests switch every batch-2 kind on themselves, so they do not depend
// on how far the engine is.

const B2 = O.batch2;
const ALL2 = Object.keys(O.intro2);
const gen2 = (n) => generate(n, CURVE, { ready: ALL2 });
const PRODUCT = { tophat: 'dove', popper: 'popcorn', candyjar: 'candy' };
// Every cell a block covers, as 'x,y' strings.
function cellsOf(b) {
  const [w, h] = blockSize(b);
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push(`${b.x + dx},${b.y + dy}`);
  return out;
}

test('batch 2 off: levels 1..400 use no batch-2 kinds and are the same every time', () => {
  // (This used to compare against a recording made before batch 2. The
  // recording was retired on 17 Nov. 2026 when the board shapes and obstacle
  // density were changed on purpose.)
  for (let n = 1; n <= 400; n++) {
    const L = generateLevel(n);
    assert.deepEqual(L.floor, [], `level ${n} floor`);
    for (const b of L.blocks) assert.ok(b.kind in OBSTACLES, `level ${n} uses ${b.kind}`);
    assert.deepEqual(generateLevel(n), L, `level ${n} is not repeatable`);
  }
});

test('batch 2: a kind that is not ready is never used; levels before the first intro do not change', () => {
  const some = ['confetti', 'tophat'];
  for (let n = 1; n <= 400; n++) {
    const L = generate(n, CURVE, { ready: some });
    for (const b of L.blocks) assert.ok(b.kind in OBSTACLES || some.includes(b.kind), `level ${n} uses ${b.kind}`);
    if (n < O.intro2.confetti) assert.deepEqual(gen2(n), generateLevel(n), `level ${n}`);
  }
});

test('batch 2: generation is a pure function of n (1..400), all kinds ready', () => {
  for (let n = 1; n <= 400; n++) {
    assert.equal(JSON.stringify(gen2(n)), JSON.stringify(gen2(n)), `level ${n}`);
  }
});

test('batch 2: an introduction level contains the introduced kind, alone', () => {
  const intro = introLevels(CURVE, ALL2);
  for (const kind of ALL2) {
    assert.equal(intro[kind], O.intro2[kind], `${kind} intro level`);
    const L = gen2(intro[kind]);
    if (kind === 'confetti') {
      assert.ok(L.floor.length > 0 && L.floor.every((f) => f.kind === 'confetti'), 'confetti intro has floor');
      assert.deepEqual(L.blocks, []);
    } else {
      assert.ok(L.blocks.length > 0 && L.blocks.every((b) => b.kind === kind), `level ${intro[kind]} introduces ${kind}`);
      assert.deepEqual(L.floor, []);
    }
    assert.deepEqual(L.drops, []);
    // No kind shows up before its introduction.
    for (let m = 1; m < intro[kind]; m++) {
      const E = gen2(m);
      assert.ok(!E.blocks.some((b) => b.kind === kind), `${kind} on level ${m}`);
      if (kind === 'confetti') assert.deepEqual(E.floor, [], `floor on level ${m}`);
    }
  }
});

test('batch 2: blocks fit on the board, never overlap, keep 40% ordinary; power-only limit counts cells', () => {
  for (let n = 1; n <= 400; n++) {
    const L = gen2(n);
    const holes = new Set(L.holes.map(key));
    const used = new Set();
    let powerOnly = 0;
    for (const b of L.blocks) {
      const [w, h] = blockSize(b);
      if (b.kind === 'truss') assert.ok(Number.isInteger(b.w) && b.w >= 3 && b.w <= L.cols, `level ${n} truss width`);
      else assert.equal(b.w, undefined, `level ${n} w on ${b.kind}`);
      assert.ok(b.y >= 2, `level ${n} ${b.kind} in the top two rows`);
      assert.ok(b.x >= 0 && b.x + w <= L.cols && b.y + h <= L.rows, `level ${n} ${b.kind} off the board`);
      for (const c of cellsOf(b)) {
        assert.ok(!holes.has(c), `level ${n} ${b.kind} on a hole`);
        assert.ok(!used.has(c), `level ${n} two blocks on ${c}`);
        used.add(c);
      }
      if (isPowerOnly(b.kind)) powerOnly += w * h;
    }
    for (const d of L.drops) {
      assert.ok(!used.has(key(d)), `level ${n} sandbag on a block`);
      used.add(key(d));
    }
    assert.ok(isPowerOnly('truss') && isPowerOnly('ticketbooth'));
    assert.ok(powerOnly <= O.powerOnlyMax, `level ${n} has ${powerOnly} power-only cells`);
    const playable = L.cols * L.rows - L.holes.length;
    assert.ok(playable - used.size >= O.minOrdinaryShare * playable, `level ${n} under 40% ordinary cells`);
  }
});

test('batch 2: nothing a match cannot open cuts a cell off; sealed share holds', () => {
  const hard = (kind) => isPowerOnly(kind) || ['tophat', 'popper', 'curtain'].includes(kind);
  const unfed = (L, walls) => {
    const holes = new Set(L.holes.map(key));
    const fed = new Set();
    let count = 0;
    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        if (holes.has(`${x},${y}`) || walls.has(`${x},${y}`)) continue;
        let above = y - 1;
        while (above >= 0 && holes.has(`${x},${above}`)) above--;
        if (above < 0 || fed.has(`${x},${above}`) || fed.has(`${x - 1},${y - 1}`) || fed.has(`${x + 1},${y - 1}`)) fed.add(`${x},${y}`);
        else count++;
      }
    }
    return count;
  };
  for (let n = 1; n <= 400; n++) {
    const L = gen2(n);
    assert.equal(unfed(L, new Set(L.blocks.filter((b) => hard(b.kind)).flatMap(cellsOf))), 0, `level ${n} walled in`);
    const playable = L.cols * L.rows - L.holes.length;
    assert.ok(unfed(L, new Set(L.blocks.flatMap(cellsOf))) <= O.maxSealedShare * playable, `level ${n} sealed share`);
  }
});

test('batch 2: floor cells are on playable cells with no block or sandbag on them', () => {
  let seen = 0;
  for (let n = 1; n <= 400; n++) {
    const L = gen2(n);
    assert.ok(Array.isArray(L.floor), `level ${n} floor list`);
    if (L.floor.length > 0) seen++;
    const holes = new Set(L.holes.map(key));
    const taken = new Set([...L.blocks.flatMap(cellsOf), ...L.drops.map(key)]);
    const mine = new Set();
    for (const f of L.floor) {
      assert.equal(f.kind, 'confetti', `level ${n} floor kind`);
      assert.ok(f.x >= 0 && f.x < L.cols && f.y >= 0 && f.y < L.rows && !holes.has(key(f)), `level ${n} floor off the board`);
      assert.ok(!taken.has(key(f)), `level ${n} floor under a block`);
      assert.ok(!mine.has(key(f)), `level ${n} repeated floor cell`);
      mine.add(key(f));
    }
  }
  assert.ok(seen > 5, 'too few confetti levels');
});

test('batch 2: footlights and fireworks colors, makeup cases, curtains', () => {
  const seen = {};
  for (let n = 1; n <= 400; n++) {
    const L = gen2(n);
    const curtainNeed = {};
    for (const b of L.blocks) {
      seen[b.kind] = true;
      if (b.kind === 'footlights' || b.kind === 'fireworks') {
        assert.equal(b.colors.length, Math.min(B2.listColors[b.kind], L.colors), `level ${n} ${b.kind} color count`);
        assert.equal(new Set(b.colors).size, b.colors.length, `level ${n} ${b.kind} repeated color`);
        for (const c of b.colors) assert.ok(Number.isInteger(c) && c >= 0 && c < L.colors, `level ${n} ${b.kind} color`);
      } else {
        assert.equal(b.colors, undefined, `level ${n} colors on ${b.kind}`);
      }
      if (b.kind === 'makeupcase') assert.equal(b.open, (b.x + b.y) % 2 === 0, `level ${n} makeup case`);
      else assert.equal(b.open, undefined, `level ${n} open on ${b.kind}`);
      if (b.kind === 'curtain') {
        assert.ok(Number.isInteger(b.color) && b.color >= 0 && b.color < L.colors, `level ${n} curtain color`);
        assert.ok(b.need >= B2.curtain.needMin && b.need <= B2.curtain.needMax, `level ${n} curtain need`);
        assert.ok(b.y >= L.rows / 2, `level ${n} curtain above the lower half`);
        // Every curtain cell of one color carries the same need.
        assert.equal(curtainNeed[b.color] ?? b.need, b.need, `level ${n} curtain needs differ`);
        curtainNeed[b.color] = b.need;
        if (b.inside !== undefined) {
          assert.equal(b.inside.t, 'piece');
          assert.ok(b.inside.color >= 0 && b.inside.color < L.colors, `level ${n} curtain inside`);
        }
      }
    }
    assert.ok(Object.keys(curtainNeed).length <= B2.curtain.maxColors, `level ${n} curtain colors`);
  }
  for (const kind of ALL2) if (kind !== 'confetti') assert.ok(seen[kind], `${kind} never placed`);
});

test('batch 2: generators come 2-6 at a time, each with two ordinary neighbours', () => {
  for (let n = 1; n <= 400; n++) {
    const L = gen2(n);
    const holes = new Set(L.holes.map(key));
    const taken = new Set([...L.blocks.flatMap(cellsOf), ...L.drops.map(key)]);
    for (const kind of ['tophat', 'popper']) {
      const mine = L.blocks.filter((b) => b.kind === kind);
      if (mine.length === 0) continue;
      assert.ok(mine.length >= B2.generators.min && mine.length <= B2.generators.max, `level ${n} has ${mine.length} ${kind}`);
      for (const g of mine) {
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
          const x = g.x + dx;
          const y = g.y + dy;
          return x >= 0 && x < L.cols && y >= 0 && y < L.rows && !holes.has(`${x},${y}`) && !taken.has(`${x},${y}`);
        });
        assert.ok(open.length >= 2, `level ${n} ${kind} at ${key(g)} has ${open.length} ordinary neighbours`);
      }
    }
  }
});

test('batch 2: target needs match the board; at most 3 targets; moves stay in range', () => {
  for (let n = 1; n <= 400; n++) {
    const L = gen2(n);
    assert.ok(L.targets.length >= 1 && L.targets.length <= 3, `level ${n} has ${L.targets.length} targets`);
    const counts = kindCounts(L);
    const expected = {};
    for (const [kind, count] of Object.entries(counts)) {
      if (kind === 'tophat' || kind === 'popper') {
        expected[PRODUCT[kind]] = Math.min(B2.generators.needCap, Math.round((B2.generators.needPerPair * count) / 2));
      } else if (kind === 'candyjar') expected.candy = 3 * count;
      else expected[kind] = count;
    }
    const confetti = L.floor.length + 4 * (counts.planter || 0);
    if (confetti > 0) expected.confetti = confetti;
    const blockTargets = L.targets.filter((t) => t.block !== undefined);
    assert.deepEqual(Object.fromEntries(blockTargets.map((t) => [t.block, t.need])), expected, `level ${n} targets`);
    assert.equal(new Set(blockTargets.map((t) => t.block)).size, blockTargets.length, `level ${n} repeated target`);
    for (const t of L.targets) assert.ok(Number.isInteger(t.need) && t.need > 0, `level ${n} need`);
    if (blockTargets.length > 0) assert.ok(L.targets.length - blockTargets.length <= 1, `level ${n} color targets`);
    assert.ok(Number.isInteger(L.moves) && L.moves >= CURVE.baseMoves[L.tier] && L.moves <= O.extraMoves.cap, `level ${n} moves ${L.moves}`);
  }
});
