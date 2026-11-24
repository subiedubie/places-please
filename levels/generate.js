// Builds level number n. The result depends only on n and config/curve.js,
// so level 37 is the same level every time, on every device.
import { addTwists } from './twists.js';
import { makeRng } from '../engine/rng.js';
import { CURVE } from '../config/curve.js';
import * as OB from '../config/obstacles.js';

const { OBSTACLES, DROPPER } = OB;
// The batch-2 kinds (docs/OBSTACLES2.md) the engine supports right now. The
// engine exports this list; until it does, no batch-2 kind is ever used.
const READY = OB.BATCH2_READY || [];

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

// The introduction levels as written in the config: batch 1, plus the
// batch-2 kinds that are in `ready`. Returns { kind: level }.
function introConfig(curve, ready) {
  const o = curve.obstacles;
  const out = { ...o.intro };
  for (const [kind, n] of Object.entries(o.intro2 || {})) {
    if (ready.includes(kind)) out[kind] = n;
  }
  return out;
}

// How many cells wide and tall a block is: [width, height]. One cell for
// most kinds; big blocks take their size from config/obstacles.js when it
// gives one, otherwise from curve.obstacles.batch2.sizes; a truss is as
// wide as its own `w`.
export function blockSize(b, curve = CURVE) {
  const b2 = curve.obstacles.batch2 || {};
  if (b.kind === 'truss') return [b.w || b2.truss.minWidth, 1];
  const given = OB.OBSTACLES2 && OB.OBSTACLES2[b.kind] ? OB.OBSTACLES2[b.kind].size : undefined;
  if (Array.isArray(given) && given.length === 2 && given.every(Number.isInteger)) return [given[0], given[1]];
  if (given && Number.isInteger(given.w) && Number.isInteger(given.h)) return [given.w, given.h];
  if (typeof given === 'string') {
    const m = /^(\d+)\s*[x×]\s*(\d+)$/.exec(given.trim());
    if (m) return [Number(m[1]), Number(m[2])];
  }
  return (b2.sizes && b2.sizes[b.kind]) || [1, 1];
}

// The names of the targets a kind brings with it. Most kinds are their own
// target; generators and jars are counted by what they hand out, and a
// planter also asks for the confetti it leaves behind.
function targetIdsFor(kind) {
  if (kind === 'planter') return ['confetti', 'planter'];
  if (kind === 'tophat') return ['dove'];
  if (kind === 'popper') return ['popcorn'];
  if (kind === 'candyjar') return ['candy'];
  return [kind];
}

// The level where each kind is really introduced: the level named in the
// config, moved forward to the next level that has obstacles (and that no
// earlier kind has already taken). Returns { kind: level }.
// `ready` = the batch-2 kinds that may be used.
export function introLevels(curve = CURVE, ready = READY) {
  const o = curve.obstacles;
  const cfg = introConfig(curve, ready);
  const kinds = Object.keys(cfg).sort((a, b) => cfg[a] - cfg[b]);
  const taken = new Set();
  const out = {};
  for (const kind of kinds) {
    let n = Math.max(cfg[kind], o.fromLevel);
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

// Choose the obstacles for level n. Returns { blocks, drops, floor }.
function buildObstacles(n, tier, cols, rows, holes, colors, kindLimit, targetLimit, curve, ready) {
  const o = curve.obstacles;
  const b2 = o.batch2 || {};
  const rng = makeRng(n).fork('obstacles');
  const intro = introLevels(curve, ready);

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
    if (limit < 1) return { blocks: [], drops: [], floor: [] };
    const count = 1 + rng.int(limit);
    kinds = [];
    for (let i = 0; i < count; i++) kinds.push(available.splice(rng.int(available.length), 1)[0]);
    kinds.sort((a, b) => intro[a] - intro[b]);
    // A planter brings two targets. If the kinds together would need more
    // targets than the level may have, drop the newest kinds.
    const targetCount = () => new Set(kinds.flatMap(targetIdsFor)).size;
    while (kinds.length > 1 && targetCount() > targetLimit) kinds.pop();
  }

  const holeSet = new Set(holes.map((h) => `${h.x},${h.y}`));
  const isHole = (x, y) => holeSet.has(`${x},${y}`);
  const playable = cols * rows - holes.length;
  // How many cells may hold a block or a sandbag while 40% stay ordinary.
  let budget = playable - Math.ceil(playable * o.minOrdinaryShare);
  let powerBudget = o.powerOnlyMax;
  const isPowerOnly = (kind) => o.powerOnlyKinds.includes(kind);

  const blocks = [];
  const blockAt = new Map(); // 'x,y' -> block (a big block is listed under every cell it covers)
  const patternNames = Object.keys(o.patterns);
  // Cells that must stay ordinary: the neighbours of top hats and popcorn carts.
  const reserved = new Set();
  // Kinds a match can never open: power-only blocks, generators (they never
  // break) and curtains (they open by a count).
  const isHard = (kind) => isPowerOnly(kind) || kind === 'tophat' || kind === 'popper' || kind === 'curtain';
  const cellsOf = (b) => {
    const [w, h] = blockSize(b, curve);
    const out = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([b.x + dx, b.y + dy]);
    return out;
  };
  const put = (b) => cellsOf(b).forEach(([x, y]) => blockAt.set(`${x},${y}`, b));
  const remove = (b) => cellsOf(b).forEach(([x, y]) => blockAt.delete(`${x},${y}`));
  const onBoard = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows && !isHole(x, y);
  // An ordinary cell: on the board with no block on it.
  const ordinary = (x, y) => onBoard(x, y) && !blockAt.has(`${x},${y}`);
  // A cell a new block may take.
  const free = (x, y) => y >= o.freeTopRows && ordinary(x, y) && !reserved.has(`${x},${y}`);
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  // The two reachability rules. Rule 1: power-only blocks alone must never
  // cut a cell off (a match could not open the way). Rule 2: all blocks
  // together may cut off only a limited share of the board at the start.
  const placementIsSafe = () => {
    const cutByPower = countUnfed(cols, rows, isHole, (x, y) => {
      const b = blockAt.get(`${x},${y}`);
      return b !== undefined && isHard(b.kind);
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

  // ---- Batch 2 (docs/OBSTACLES2.md) ----
  // Put block `b` on the board if all its cells are free and the board
  // stays safe. Returns true when it was placed.
  const tryPut = (b) => {
    if (b.kind === 'dovecote' && b.y > rows / 2) return false; // the doves need a way to go
    const cells = cellsOf(b);
    if (!cells.every(([x, y]) => free(x, y))) return false;
    put(b);
    if (placementIsSafe()) return true;
    remove(b);
    return false;
  };
  // A number between the two ends of a [fewest, most] pair.
  const between = ([lo, hi]) => lo + rng.int(hi - lo + 1);
  // `count` different colors of this level.
  const someColors = (count) => {
    const pool = [];
    for (let i = 0; i < colors; i++) pool.push(i);
    return shuffle(pool).slice(0, Math.min(count, colors)).sort((a, b) => a - b);
  };

  // Place one batch-2 kind; returns the blocks it placed.
  const placeBatch2 = (kind) => {
    const mine = [];

    // Top hats and popcorn carts: on the side edges, or in mirrored pairs
    // and trios across a row. Each keeps at least two ordinary neighbours.
    if (kind === 'tophat' || kind === 'popper') {
      const g = b2.generators;
      const want = Math.min(between([g.min, g.max]), budget);
      const sides = [];
      for (let y = rows - 2; y > o.freeTopRows; y -= 2) sides.push([[0, y], [cols - 1, y]]);
      const across = [];
      const mid = (cols - 1) / 2;
      const rowsToUse = [Math.floor(rows / 2), Math.floor(rows / 2) + 2, Math.floor(rows / 2) - 2];
      if (cols % 2 === 1) for (const y of rowsToUse) across.push([[1, y], [mid, y], [cols - 2, y]]);
      for (const y of rowsToUse) across.push([[2, y], [cols - 3, y]]);
      const groups = rng.int(2) === 0 ? sides.concat(across) : across.concat(sides);
      const around = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const group of groups) {
        if (mine.length + group.length > want) continue;
        const inGroup = new Set(group.map(([x, y]) => `${x},${y}`));
        const fits = group.every(
          ([x, y]) =>
            free(x, y) &&
            around(x, y).filter(([ax, ay]) => ordinary(ax, ay) && !inGroup.has(`${ax},${ay}`)).length >= 2,
        );
        if (!fits) continue;
        const added = group.map(([x, y]) => ({ x, y, kind }));
        added.forEach(put);
        if (!placementIsSafe()) {
          added.forEach(remove);
          continue;
        }
        for (const [x, y] of group) {
          for (const [ax, ay] of around(x, y)) if (ordinary(ax, ay)) reserved.add(`${ax},${ay}`);
        }
        mine.push(...added);
      }
      // Fewer than the minimum: this level goes without them.
      if (mine.length < g.min) {
        mine.forEach(remove);
        mine.length = 0;
      }
      return mine;
    }

    // Curtains: a rectangle standing on the bottom row, one color or the
    // left half one color and the right half another.
    if (kind === 'curtain') {
      const cu = b2.curtain;
      const height = rng.pick(cu.heights);
      const picked = someColors(1 + rng.int(cu.maxColors));
      const needs = picked.map(() => between([cu.needMin, cu.needMax]));
      for (let y = rows - 1; y > rows - 1 - height && y >= Math.ceil(rows / 2); y--) {
        for (let x = cu.sideMargin; x < cols - cu.sideMargin; x++) {
          if (mine.length >= budget) break;
          const side = picked.length > 1 && x >= cols / 2 ? 1 : 0;
          const b = { x, y, kind, color: picked[side], need: needs[side] };
          if (rng.next() < cu.insideChance) b.inside = { t: 'piece', color: rng.int(colors) };
          if (tryPut(b)) mine.push(b);
        }
      }
      return mine;
    }

    // Everything else: a number of blocks, each w x h cells.
    let w = 1;
    let h = 1;
    if (kind === 'truss') {
      const t = b2.truss;
      const widest = Math.min(t.maxWidth, cols, powerBudget, budget);
      if (widest < t.minWidth) return mine;
      w = t.minWidth + rng.int(widest - t.minWidth + 1);
    } else {
      [w, h] = blockSize({ kind }, curve);
    }
    let want = between(b2.counts[kind]);
    want = Math.min(want, Math.floor(budget / (w * h)));
    if (isPowerOnly(kind)) want = Math.min(want, Math.floor(powerBudget / (w * h)));

    // Where: single cells follow a pattern from the library; big blocks
    // try every place they fit, in a random order.
    let candidates;
    if (w * h === 1) {
      candidates = o.patterns[rng.pick(patternNames)](cols, rows, rng);
    } else {
      candidates = [];
      for (let y = o.freeTopRows; y + h <= rows; y++) {
        for (let x = 0; x + w <= cols; x++) candidates.push([x, y]);
      }
      shuffle(candidates);
    }
    for (const [x, y] of candidates) {
      if (mine.length >= want) break;
      const b = { x, y, kind };
      if (kind === 'truss') b.w = w;
      if (!tryPut(b)) continue;
      if (b2.listColors[kind] !== undefined) b.colors = someColors(b2.listColors[kind]);
      if (kind === 'makeupcase') b.open = (x + y) % 2 === 0;
      mine.push(b);
    }
    return mine;
  };

  for (const kind of kinds) {
    if (o.intro2 && kind in o.intro2) {
      // Confetti is a floor, laid last (below) so it never ends up under a block.
      if (kind === 'confetti') continue;
      const mine = placeBatch2(kind);
      blocks.push(...mine);
      const used = mine.reduce((sum, b) => sum + cellsOf(b).length, 0);
      budget -= used;
      if (isPowerOnly(kind)) powerBudget -= used;
      continue;
    }
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
      if (isHole(x, y) || blockAt.has(key) || reserved.has(key)) continue;
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
        if (y < o.freeTopRows || y >= rows - 1 || isHole(x, y) || blockAt.has(`${x},${y}`) || reserved.has(`${x},${y}`)) continue;
        let clear = true;
        for (let below = y + 1; below < rows; below++) {
          const b = blockAt.get(`${x},${below}`);
          if (isHole(x, below) || (b && isHard(b.kind))) clear = false;
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

  // Confetti floor: a region from the pattern library, under ordinary
  // pieces only (never under a block or a sandbag).
  const floor = [];
  if (kinds.includes('confetti')) {
    const f = b2.confetti;
    const want = f.min + rng.int(Math.max(1, f.max[tier] - f.min + 1));
    const taken = new Set(drops.map((d) => `${d.x},${d.y}`));
    for (const [x, y] of o.patterns[rng.pick(patternNames)](cols, rows, rng)) {
      if (floor.length >= want) break;
      const key = `${x},${y}`;
      if (!ordinary(x, y) || taken.has(key)) continue;
      taken.add(key);
      floor.push({ x, y, kind: 'confetti' });
    }
  }

  return { blocks, drops, floor, rng };
}

// The obstacle targets of a level, in the order the kinds were introduced.
// Batch 1: clear ALL of every kind on the board (blocks held inside padlocks
// count too). Batch 2: see docs/OBSTACLES2.md and the comments below.
function obstacleTargets(blocks, drops, floor, curve) {
  const b2 = curve.obstacles.batch2 || {};
  const counts = {};
  for (const b of blocks) {
    counts[b.kind] = (counts[b.kind] || 0) + 1;
    if (b.inside && b.inside.t === 'block') counts[b.inside.kind] = (counts[b.inside.kind] || 0) + 1;
  }
  if (drops.length > 0) counts[DROPPER.id] = drops.length;
  // Confetti: every floor cell, plus the cells each planter leaves behind.
  const confetti =
    floor.filter((f) => f.kind === 'confetti').length + (counts.planter || 0) * (b2.confettiPerPlanter || 0);
  if (confetti > 0) counts.confetti = confetti;

  const order = { ...curve.obstacles.intro, ...curve.obstacles.intro2 };
  return Object.keys(counts)
    .sort((a, b) => order[a] - order[b])
    .map((kind) => {
      const count = counts[kind];
      // Generators: so many products per pair of generators, up to a cap.
      if (kind === 'tophat' || kind === 'popper') {
        const g = b2.generators;
        const need = Math.min(g.needCap, Math.round((g.needPerPair * count) / 2));
        return { block: kind === 'tophat' ? 'dove' : 'popcorn', need };
      }
      // Dovecotes: every dove that falls out.
      if (kind === 'dovecote') return { block: 'dove', need: 3 * count };
      // Candy jars: every candy of every jar.
      if (kind === 'candyjar') return { block: 'candy', need: b2.candyPerJar * count };
      // Everything else: all of them (for curtains, every curtain cell).
      return { block: kind, need: count };
    });
}

// Move limit for a level with obstacles: the tier's base moves plus an
// allowance for every hit the obstacles need, for every sandbag, and for
// the batch-2 kinds (all numbers are in curve.obstacles.extraMoves).
function movesFor(tier, blocks, drops, floor, targets, curve) {
  const e = curve.obstacles.extraMoves;
  const b2 = curve.obstacles.batch2 || {};
  let extra = drops.length * e.perSandbag;
  const addHits = (kind) => {
    for (const hit of OBSTACLES[kind].hits) extra += hit === 'power' ? e.perPowerHit : e.perMatchHit;
  };
  const curtainNeed = {}; // color -> pieces needed (counted once per color)
  for (const b of blocks) {
    if (OBSTACLES[b.kind]) {
      addHits(b.kind);
      if (b.inside && b.inside.t === 'block') addHits(b.inside.kind);
    } else if (b.kind === 'bouquet') extra += 2 * e.perMatchHit;
    else if (b.kind === 'candyjar') extra += b2.candyPerJar * e.perMatchHit;
    else if (b.kind === 'planter' || b.kind === 'dovecote') extra += b2.bigHits[b.kind] * e.perBigHit;
    else if (b.colors) extra += b.colors.length * e.perListColor;
    else if (b.kind === 'truss') extra += 2 * e.perPowerHit;
    else if (b.kind === 'ticketbooth') extra += e.perPowerHit + 3 * e.perMatchHit;
    else if (b.kind === 'makeupcase') extra += e.perMakeupCase;
    else if (b.kind === 'curtain') curtainNeed[b.color] = b.need;
  }
  for (const need of Object.values(curtainNeed)) extra += need * e.perCurtainPiece;
  extra += floor.length * e.perFloorCell;
  // Doves and popcorn: an allowance for each one the level asks for.
  for (const t of targets) {
    if (t.block === 'dove' || t.block === 'popcorn') extra += t.need * e.perProduct;
  }
  return Math.min(e.cap, Math.round(curve.baseMoves[tier] + extra));
}

// ---- The level -------------------------------------------------------------

// `options.ready`: the batch-2 kinds that may be used (default: the list the
// engine exports as BATCH2_READY). Tests pass their own list.
// options.ready: the batch-2 kinds to use (for tests; a level made that way has
// no twists unless options.twists is true).
export function generateLevel(n, curve = CURVE, options = {}) {
  const level = plainLevel(n, curve, options);
  return options.twists ?? !options.ready ? addTwists(level) : level;
}

function plainLevel(n, curve, options) {
  const ready = options.ready || READY;
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
  let floor = [];
  let obstacleRng = null;
  if (hasObstacles(n, curve)) {
    const kindLimit = Math.min(curve.obstacles.maxKinds[tier], targetLimit);
    ({ blocks, drops, floor, rng: obstacleRng } = buildObstacles(
      n, tier, cols, rows, holes, colors, kindLimit, targetLimit, curve, ready,
    ));
  }

  const targets = [];
  let moves = curve.baseMoves[tier];
  if (blocks.length + drops.length + floor.length > 0) {
    // Obstacle level: clear ALL of every kind on the board (batch 2 has
    // its own counting rules, see obstacleTargets).
    targets.push(...obstacleTargets(blocks, drops, floor, curve));
    // Room left? Sometimes add one color target with the usual need.
    if (targets.length < targetLimit && obstacleRng.next() < curve.obstacles.colorTargetChance) {
      const need = Math.round(t.baseNeed[tier] * t.needFactor[targets.length]);
      targets.push({ color: targetRng.int(colors), need });
    }
    moves = movesFor(tier, blocks, drops, floor, targets, curve);
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

  // Every 10th level is a bonus level ("Benefit Night"): it cannot be lost
  // and pays coins per piece cleared (see meta/shop.js, bonusLine).
  const bonus = n % 10 === 0;

  return { n, tier, cols, rows, holes, colors, moves, targets, blocks, drops, floor, bonus };
}
