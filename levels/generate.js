// Builds level number n. The result depends only on n and config/curve.js,
// so level 37 is the same level every time, on every device.
import { makeRng } from '../engine/rng.js';
import { CURVE } from '../config/curve.js';
import { OBSTACLES, DROPPER } from '../config/obstacles.js';

// How hard level n is: 0 regular, 1 hard, 2 super hard, 3 extremely hard.
export function tierFor(n, curve = CURVE) {
  const p = curve.tierPattern;
  // The extremely-hard rule is checked first so it wins any overlap.
  if (n % p.tier3.every === p.tier3.at) return 3;
  const byDigit = p.byLastDigit[n % 10];
  return byDigit === undefined ? 0 : byDigit;
}

// Turn a text drawing ('.' cell, '#' hole) into a size and a list of holes.
function readLayout(layout) {
  const rows = layout.length;
  const cols = layout[0].length;
  const holes = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (layout[y][x] === '#') holes.push({ x, y });
    }
  }
  return { cols, rows, holes };
}

// ---- Obstacles -------------------------------------------------------------

// Does level n have obstacles at all?
export function hasObstacles(n, curve = CURVE) {
  const o = curve.obstacles;
  if (!o || n < o.fromLevel) return false;
  if ((n - o.fromLevel) % o.everyNth !== 0) return false;
  return !o.skipLastDigits.includes(n % 10);
}

// The level where each kind is really introduced: the level named in the
// config, moved forward to the next level that has obstacles (and that no
// earlier kind has already taken). Returns { kind: level }.
export function introLevels(curve = CURVE) {
  const o = curve.obstacles;
  const kinds = Object.keys(o.intro).sort((a, b) => o.intro[a] - o.intro[b]);
  const taken = new Set();
  const out = {};
  for (const kind of kinds) {
    let n = Math.max(o.intro[kind], o.fromLevel);
    // The search always ends: obstacle levels repeat at least every
    // everyNth x 10 levels unless every last digit is skipped.
    for (let guard = 0; guard < 10000 && (!hasObstacles(n, curve) || taken.has(n)); guard++) n++;
    taken.add(n);
    out[kind] = n;
  }
  return out;
}

// Which playable cells can falling pieces reach, if the cells for which
// `isBarrier(x, y)` is true never move? Follows the spec's Falling rules:
// straight down (through holes), or diagonally from the row above.
// Returns how many playable, non-barrier cells are NOT reachable.
function countUnfed(cols, rows, isHole, isBarrier) {
  const fed = new Set();
  let unfed = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isHole(x, y) || isBarrier(x, y)) continue;
      // Nearest non-hole cell above; none means the cell is open to the top.
      let above = y - 1;
      while (above >= 0 && isHole(x, above)) above--;
      const ok =
        above < 0 ||
        fed.has(`${x},${above}`) ||
        fed.has(`${x - 1},${y - 1}`) ||
        fed.has(`${x + 1},${y - 1}`);
      if (ok) fed.add(`${x},${y}`);
      else unfed++;
    }
  }
  return unfed;
}

// Choose the obstacles for level n. Returns { blocks, drops }.
function buildObstacles(n, tier, cols, rows, holes, colors, kindLimit, curve) {
  const o = curve.obstacles;
  const rng = makeRng(n).fork('obstacles');
  const intro = introLevels(curve);

  // Which kinds: on an introduction level only the new kind; otherwise a
  // random few of the kinds introduced before this level.
  const introduced = Object.keys(intro).find((k) => intro[k] === n);
  let kinds;
  if (introduced) {
    kinds = [introduced];
  } else {
    const available = Object.keys(intro)
      .filter((k) => intro[k] < n)
      .sort((a, b) => intro[a] - intro[b]);
    const limit = Math.min(kindLimit, available.length);
    if (limit < 1) return { blocks: [], drops: [] };
    const count = 1 + rng.int(limit);
    kinds = [];
    for (let i = 0; i < count; i++) kinds.push(available.splice(rng.int(available.length), 1)[0]);
    kinds.sort((a, b) => intro[a] - intro[b]);
  }

  const holeSet = new Set(holes.map((h) => `${h.x},${h.y}`));
  const isHole = (x, y) => holeSet.has(`${x},${y}`);
  const playable = cols * rows - holes.length;
  // How many cells may hold a block or a sandbag while 40% stay ordinary.
  let budget = playable - Math.ceil(playable * o.minOrdinaryShare);
  let powerBudget = o.powerOnlyMax;
  const isPowerOnly = (kind) => o.powerOnlyKinds.includes(kind);

  const blocks = [];
  const blockAt = new Map(); // 'x,y' -> block
  const patternNames = Object.keys(o.patterns);

  // The two reachability rules. Rule 1: power-only blocks alone must never
  // cut a cell off (a match could not open the way). Rule 2: all blocks
  // together may cut off only a limited share of the board at the start.
  const placementIsSafe = () => {
    const cutByPower = countUnfed(cols, rows, isHole, (x, y) => {
      const b = blockAt.get(`${x},${y}`);
      return b !== undefined && isPowerOnly(b.kind);
    });
    if (cutByPower > 0) return false;
    const sealed = countUnfed(cols, rows, isHole, (x, y) => blockAt.has(`${x},${y}`));
    return sealed <= playable * o.maxSealedShare;
  };

  // Kinds a padlock on this level may hold: the level's other kinds that an
  // ordinary match can break (so no new kind and no extra power-ups needed).
  const holdable = kinds.filter(
    (k) => OBSTACLES[k] && !isPowerOnly(k) && k !== 'paint' && OBSTACLES[k].hits.every((h) => h === 'any'),
  );

  for (const kind of kinds) {
    if (kind === DROPPER.id || !OBSTACLES[kind]) continue;

    // How many cells this kind gets.
    const c = o.cellsPerKind;
    let want = c.min + rng.int(Math.max(1, c.max[tier] - c.min + 1));
    if (o.maxPerKind[kind] !== undefined) want = Math.min(want, o.maxPerKind[kind]);
    if (isPowerOnly(kind)) want = Math.min(want, powerBudget);
    want = Math.min(want, budget);

    // Where: paint goes in one-color lines, everything else follows a pattern.
    // Each candidate is [x, y] or, for paint, [x, y, color].
    let candidates;
    if (kind === 'paint') {
      const lines = o.paint.minLines + rng.int(o.paint.maxLines - o.paint.minLines + 1);
      const firstColor = rng.int(colors);
      const perLine = Math.max(2, Math.floor(want / lines));
      candidates = [];
      if (rng.int(2) === 0) {
        // Rows: stacked rows somewhere below the free top rows.
        const top = o.freeTopRows + rng.int(Math.max(1, rows - o.freeTopRows - lines + 1));
        const x0 = Math.max(0, Math.floor((cols - perLine) / 2));
        for (let i = 0; i < lines; i++) {
          for (let x = x0; x < x0 + perLine && x < cols; x++) {
            candidates.push([x, top + i, (firstColor + i) % colors]);
          }
        }
      } else {
        // Columns: evenly spread columns standing on the floor.
        for (let i = 0; i < lines; i++) {
          const x = Math.round(((i + 1) * (cols - 1)) / (lines + 1));
          for (let y = rows - 1; y > rows - 1 - perLine; y--) {
            candidates.push([x, y, (firstColor + i) % colors]);
          }
        }
      }
    } else {
      candidates = o.patterns[rng.pick(patternNames)](cols, rows, rng);
    }

    const mine = [];
    for (const [x, y, color] of candidates) {
      if (mine.length >= want) break;
      const key = `${x},${y}`;
      if (x < 0 || x >= cols || y < o.freeTopRows || y >= rows) continue;
      if (isHole(x, y) || blockAt.has(key)) continue;
      const b = { x, y, kind };
      if (kind === 'paint') b.color = color;
      if (kind === 'padlock') {
        const holdsBlock = holdable.length > 0 && rng.next() < o.padlockHoldsBlockChance;
        if (holdsBlock) {
          const inner = rng.pick(holdable);
          b.inside = { t: 'block', kind: inner, hp: OBSTACLES[inner].hits.length };
        } else {
          b.inside = { t: 'piece', color: rng.int(colors) };
        }
      }
      mine.push(b);
      blockAt.set(key, b);
    }
    // If this kind broke a reachability rule, take its last cells away
    // again until the board is safe.
    while (mine.length > 0 && !placementIsSafe()) {
      const b = mine.pop();
      blockAt.delete(`${b.x},${b.y}`);
    }
    blocks.push(...mine);
    budget -= mine.length;
    if (isPowerOnly(kind)) powerBudget -= mine.length;
  }

  // Sandbags: one per column, only in columns with no hole and no
  // power-only block below the starting cell.
  const drops = [];
  if (kinds.includes(DROPPER.id)) {
    const s = o.sandbags;
    const spots = [];
    for (let x = 0; x < cols; x++) {
      // Try the allowed start rows in a random order; keep the first that works.
      const startRows = s.startRows.slice();
      for (let i = startRows.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [startRows[i], startRows[j]] = [startRows[j], startRows[i]];
      }
      for (const y of startRows) {
        if (y < o.freeTopRows || y >= rows - 1 || isHole(x, y) || blockAt.has(`${x},${y}`)) continue;
        let clear = true;
        for (let below = y + 1; below < rows; below++) {
          const b = blockAt.get(`${x},${below}`);
          if (isHole(x, below) || (b && isPowerOnly(b.kind))) clear = false;
        }
        if (clear) {
          spots.push({ x, y });
          break;
        }
      }
    }
    const want = Math.min(s.min + rng.int(s.max - s.min + 1), spots.length, budget);
    // Fewer places than the minimum: this level goes without sandbags.
    for (let i = 0; want >= s.min && i < want; i++) drops.push(spots.splice(rng.int(spots.length), 1)[0]);
    drops.sort((a, b) => a.x - b.x);
  }

  return { blocks, drops, rng };
}

// How many of each obstacle kind are on the board (blocks held inside
// padlocks count too), in the order the kinds were introduced.
function countKinds(blocks, drops, curve) {
  const counts = {};
  for (const b of blocks) {
    counts[b.kind] = (counts[b.kind] || 0) + 1;
    if (b.inside && b.inside.t === 'block') counts[b.inside.kind] = (counts[b.inside.kind] || 0) + 1;
  }
  if (drops.length > 0) counts[DROPPER.id] = drops.length;
  const order = curve.obstacles.intro;
  return Object.keys(counts)
    .sort((a, b) => order[a] - order[b])
    .map((kind) => ({ kind, count: counts[kind] }));
}

// Move limit for a level with obstacles: the tier's base moves plus an
// allowance for every hit the obstacles need and for every sandbag.
function movesFor(tier, blocks, drops, curve) {
  const e = curve.obstacles.extraMoves;
  let extra = drops.length * e.perSandbag;
  const addHits = (kind) => {
    for (const hit of OBSTACLES[kind].hits) extra += hit === 'power' ? e.perPowerHit : e.perMatchHit;
  };
  for (const b of blocks) {
    addHits(b.kind);
    if (b.inside && b.inside.t === 'block') addHits(b.inside.kind);
  }
  return Math.min(e.cap, Math.round(curve.baseMoves[tier] + extra));
}

// ---- The level -------------------------------------------------------------

export function generateLevel(n, curve = CURVE) {
  const tier = tierFor(n, curve);
  // One random stream per decision, each fixed by the level number, so
  // changing how targets are picked never changes which board a level gets.
  const base = makeRng(n);

  // Colors: few on early levels, more later; the hardest tiers always get more.
  const c = curve.colors;
  const colors =
    n <= c.earlyThroughLevel && tier < c.alwaysLaterFromTier ? c.early : c.later;

  // Board shape: pick one of the shapes allowed at this level.
  const allowed = curve.boards.filter(
    (b) => n >= b.fromLevel && (b.toLevel === null || n <= b.toLevel),
  );
  // If the config leaves a level with no shape, fall back to the first one.
  const shape = allowed.length > 0 ? base.fork('shape').pick(allowed) : curve.boards[0];
  const { cols, rows, holes } = readLayout(shape.layout);

  const t = curve.targets;
  const targetRng = base.fork('targets');
  // The most targets this level may have (early levels have exactly one).
  const targetLimit = n <= t.oneTargetThroughLevel ? 1 : Math.min(t.maxTargets, t.needFactor.length);

  // Obstacles, if this level has them.
  let blocks = [];
  let drops = [];
  let obstacleRng = null;
  if (hasObstacles(n, curve)) {
    const kindLimit = Math.min(curve.obstacles.maxKinds[tier], targetLimit);
    ({ blocks, drops, rng: obstacleRng } = buildObstacles(n, tier, cols, rows, holes, colors, kindLimit, curve));
  }

  const targets = [];
  let moves = curve.baseMoves[tier];
  if (blocks.length + drops.length > 0) {
    // Obstacle level: clear ALL of every kind on the board.
    for (const { kind, count } of countKinds(blocks, drops, curve)) {
      targets.push({ block: kind, need: count });
    }
    // Room left? Sometimes add one color target with the usual need.
    if (targets.length < targetLimit && obstacleRng.next() < curve.obstacles.colorTargetChance) {
      const need = Math.round(t.baseNeed[tier] * t.needFactor[targets.length]);
      targets.push({ color: targetRng.int(colors), need });
    }
    moves = movesFor(tier, blocks, drops, curve);
  } else {
    // No obstacles: color targets — how many, which colors, how many of each.
    let count = n <= t.oneTargetThroughLevel ? 1 : 1 + targetRng.int(t.maxTargets);
    count = Math.min(count, colors, t.needFactor.length);
    // Draw `count` different colors: take one at random out of the remaining pool.
    const pool = [];
    for (let i = 0; i < colors; i++) pool.push(i);
    const need = Math.round(t.baseNeed[tier] * t.needFactor[count - 1]);
    for (let i = 0; i < count; i++) {
      const color = pool.splice(targetRng.int(pool.length), 1)[0];
      targets.push({ color, need });
    }
  }

  return { n, tier, cols, rows, holes, colors, moves, targets, blocks, drops };
}
