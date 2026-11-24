// Power-ups: what happens when one goes off (fire) and what happens when two
// are swapped into each other (combine).
//
// The five kinds:
//   'spot-h'  Spotlight, clears its whole row
//   'spot-v'  Spotlight, clears its whole column
//   'under'   Understudy, clears its 4 neighbours, then flies to one target
//   'show'    Showstopper, clears the 5x5 square around it
//   'prism'   Prism, clears every piece of one color
//
// Both fire() and combine() CHANGE the board they are given and return a list
// of events, in order, that says what happened:
//   { type: 'clear', cause, cells: [{ x, y, was }] }   cells that were emptied;
//        `was` is what sat in the cell before (so the caller can count colors)
//   { type: 'block', x, y, kind, hpLeft, destroyed, by: 'power' }
//        an obstacle (block) inside a blast took a hit
//   { type: 'fly', from, to }                          an Understudy's flight
//   { type: 'transform', kind, cells: [{ x, y, was, kind }] } pieces turned
//        into power-ups (Prism combinations); `was` is the piece that was
//        there, the cell's own `kind` is what it became (Spotlights alternate)
//   { type: 'frame', board }                           a snapshot of the board
//        at that moment, so the screen can show the blast step by step
//
// Rules that hold everywhere in this file:
//   - Holes (null cells) are never touched.
//   - A cell is listed in at most one 'clear' event per call.
//   - An obstacle (block) inside a blast is not cleared: it takes ONE power
//     hit from that power-up's effect. A later power-up in the same chain
//     whose blast also covers it hits it again.
//   - The dropper (sandbag) is not touched by anything.
//   - A power-up caught in a blast goes off too, in the order it was reached,
//     and each one goes off at most once. That is what guarantees an end.
//   - Random choices use only opts.rng (never Math.random).

import {
  block,
  EMPTY, get, set, inBounds, cloneBoard, isPiece, isPower, power,
  isBlock, isPart, isDrop, hitBlockEvents, takesHit, anchorOf, footprint, liftFloor, isPainted, spreadPaint,
} from './board.js';

// The name a cell goes by inside the "already fired" and "already cleared" sets.
function keyOf(x, y) {
  return `${x},${y}`;
}

// One "run" holds everything a single fire() or combine() call needs to
// remember while it works.
function startRun(board, opts) {
  return {
    board,
    opts,
    fired: opts.fired ?? new Set(), // cells whose power-up has gone off (may be shared by the caller)
    cleared: new Set(), // cells already listed in a clear event during this call
    hitNow: new Set(), // blocks already hit by the effect going off right now (emptied for each new effect)
    queue: [], // power-ups waiting their turn: { x, y, kind, swapColor? }
    events: [], // the list we hand back
  };
}

// Add a snapshot of the board to the event list.
function pushFrame(run) {
  run.events.push({ type: 'frame', board: cloneBoard(run.board) });
}

// Empty a list of cells and record it as ONE clear event.
//   - cells off the board, holes, already-empty cells and cells this call has
//     already cleared are skipped (so no cell is ever reported twice);
//   - if a skipped cell holds a power-up that was placed there after it was
//     cleared (the Understudy's carried power-up), it is quietly removed;
//   - a power-up caught here is put in the queue to go off later, unless
//     `chain` is false or it has already gone off;
//   - the dropper is skipped: nothing damages it;
//   - a block is not cleared. It takes one power hit (which only lands if the
//     block accepts power hits right now) and is then left alone for the rest
//     of this effect, whatever it turned into. It is NOT added to
//     run.cleared, so a later effect in the chain can hit it again.
function clearArea(run, coords, cause, chain = true, carry = false) {
  const { board } = run;
  const cells = [];
  const blockHits = [];
  for (const { x, y } of coords) {
    if (!inBounds(board, x, y)) continue;
    const was = get(board, x, y);
    if (was === null) continue; // a hole
    if (isDrop(was)) continue; // the dropper cannot be damaged
    const key = keyOf(x, y);
    if (run.hitNow.has(key)) continue; // a block this effect has already hit
    if (isBlock(was) || isPart(was)) {
      // A part of a big block stands for the whole block. Mark every cell the
      // block covers, so this effect hits it once and then leaves alone
      // whatever it turns into.
      const at = anchorOf(board, x, y);
      if (!at) continue;
      const foot = footprint(at.cell, at.x, at.y);
      for (const p of foot) run.hitNow.add(keyOf(p.x, p.y));
      const touched = foot.filter((p) => coords.some((q) => q.x === p.x && q.y === p.y));
      const hits = hitBlockEvents(board, at.x, at.y, 'power', undefined, run.opts.rng, touched);
      blockHits.push(...hits);
      for (const h of hits) {
        // What it leaves behind is not hit by this same effect.
        if (h.type === 'goo') for (const p of h.cells) run.hitNow.add(keyOf(p.x, p.y));
        if (h.type === 'block') run.hitNow.add(keyOf(h.x, h.y));
      }
      // Fireworks, cannons and the like that just broke go off, in their turn.
      if (hits.length > 0 && hits[0].special) run.queue.push({ ...hits[0].special, special: true });
      continue;
    }
    if (run.cleared.has(key)) {
      if (isPower(was)) set(board, x, y, EMPTY);
      continue;
    }
    if (was.t === 'empty') continue;
    run.cleared.add(key);
    set(board, x, y, EMPTY);
    cells.push({ x, y, was });
    // Floor under a cleared cell is removed (reported after the clear event).
    const lifted = liftFloor(board, x, y);
    if (lifted) blockHits.push(lifted);
    if (chain && isPower(was) && !run.fired.has(key)) {
      run.fired.add(key);
      run.queue.push({ x, y, kind: was.kind });
    }
  }
  if (cells.length > 0) run.events.push({ type: 'clear', cause, cells });
  const painted = spreadPaint(board, cells, carry); // paint goes where the blast goes
  if (painted) run.events.push(painted);
  run.events.push(...blockHits);
  return cells;
}

// ---- Shapes of the blasts (plain lists of coordinates) ---------------------

function rowCells(board, y) {
  const out = [];
  for (let x = 0; x < board.cols; x++) out.push({ x, y });
  return out;
}

function colCells(board, x) {
  const out = [];
  for (let y = 0; y < board.rows; y++) out.push({ x, y });
  return out;
}

// A square reaching `radius` cells out from the centre (radius 2 = 5x5).
// Cells off the board are dropped later by clearArea.
function squareCells(cx, cy, radius) {
  const out = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) out.push({ x, y });
  }
  return out;
}

// The cell itself plus the four cells touching its sides.
function plusCells(x, y) {
  return [
    { x, y },
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y },
  ];
}

function allCells(board) {
  const out = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) out.push({ x, y });
  }
  return out;
}

// Every piece of one color.
function colorCells(board, color) {
  return allCells(board).filter(({ x, y }) => {
    const c = get(board, x, y);
    return isPiece(c) && c.color === color;
  });
}

// The color with the most pieces on the board right now. On a tie the lowest
// color number wins. Returns undefined if there are no pieces at all.
function mostCommonColor(board) {
  const counts = [];
  for (const cell of board.cells) {
    if (isPiece(cell)) counts[cell.color] = (counts[cell.color] ?? 0) + 1;
  }
  let best;
  for (let color = 0; color < counts.length; color++) {
    if (counts[color] && (best === undefined || counts[color] > counts[best])) best = color;
  }
  return best;
}

// ---- The Understudy's flight -----------------------------------------------

// Pick where a Ninja Star flies: the MOST HELPFUL landing spot.
// `footprint(x, y)` lists the cells that would be cleared if it landed at
// (x, y): just that cell for a plain Ninja Star, a whole row or column when it
// carries a Missile, a 5x5 area when it carries a Grenade.
// Every possible landing cell is scored: 1000 points for each cell in the
// footprint that the level still needs (opts.needs says yes), plus 1 point for
// each ordinary piece. The highest score wins; ties are broken at random.
// A block counts like any other cell (1000 points if opts.needs says the level
// needs it), but only if a power hit would actually land on it.
// Cells that are holes, empty, or already cleared in this call do not count;
// nor do droppers, or blocks this effect has already hit.
// Returns { x, y } or null if nothing is left to hit.
function chooseTarget(run, footprint = (x, y) => [{ x, y }]) {
  const { board, opts } = run;
  const live = (x, y) => {
    let cell = get(board, x, y); // null for holes and off the board
    if (isPart(cell)) cell = get(board, cell.ax, cell.ay); // a part stands for its block
    if (cell === null || cell.t === 'empty' || isDrop(cell)) return null;
    if (run.cleared.has(keyOf(x, y))) return null;
    if (run.hitNow.has(keyOf(x, y))) return null; // a block this effect already hit (or what it left behind)
    if (isBlock(cell) && !takesHit(cell, 'power')) return null; // a power hit would do nothing
    return cell;
  };
  let best = [];
  let bestScore = 0;
  for (const { x, y } of allCells(board)) {
    if (!live(x, y)) continue;
    let score = 0;
    for (const p of footprint(x, y)) {
      const cell = live(p.x, p.y);
      if (!cell) continue;
      if (opts.needs && opts.needs(cell, p.x, p.y)) score += 1000;
      else if (isPiece(cell)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = [{ x, y }];
    } else if (score === bestScore && score > 0) {
      best.push({ x, y });
    }
  }
  if (best.length === 0) return null;
  // With no rng supplied, take the first candidate rather than use Math.random.
  return opts.rng ? opts.rng.pick(best) : best[0];
}

// Fly from `from` to the chosen target and clear it. Returns the target or null.
function flyAndClear(run, from, cause, footprint) {
  const to = chooseTarget(run, footprint);
  if (to === null) return null;
  run.events.push({ type: 'fly', from: { x: from.x, y: from.y }, to });
  clearArea(run, [to], cause, true, isPainted(run.board, from.x, from.y)); // a star from a painted square carries paint
  return to;
}

// The MOST HELPFUL color for a Magic Ball that was tapped (not swapped with a
// piece): the color the level still needs that has the most pieces on the
// board. If the level needs no color that is on the board, the most common one.
function helpfulColor(run) {
  const { board, opts } = run;
  if (opts.needs) {
    const counts = [];
    for (const { x, y } of allCells(board)) {
      const cell = get(board, x, y);
      if (isPiece(cell) && opts.needs(cell, x, y)) counts[cell.color] = (counts[cell.color] ?? 0) + 1;
    }
    let best;
    for (let color = 0; color < counts.length; color++) {
      if (counts[color] && (best === undefined || counts[color] > counts[best])) best = color;
    }
    if (best !== undefined) return best;
  }
  return mostCommonColor(board);
}

// The MOST HELPFUL color for a Magic Ball swapped with another power-up: every
// piece of that color becomes the power-up, so each color is scored by what
// those power-ups would hit, 1000 points for each cell the level still needs
// (plus 1000 for each Ninja Star, which flies to one more) and 1 point for each
// other piece. A tie goes to the color with the most pieces, then the lowest.
function comboColor(run, other, skip) {
  const { board, opts } = run;
  let best, bestScore = -1, bestCount = 0;
  const colors = [...new Set(board.cells.filter(isPiece).map((c) => c.color))].sort((a, b) => a - b);
  for (const color of colors) {
    if (color === skip) continue;
    const from = colorCells(board, color);
    const seen = new Set();
    let score = opts.needs && other === 'under' ? from.length * 1000 : 0;
    from.forEach((p, i) => {
      const area = isSpot(other) ? (i % 2 === 0 ? rowCells(board, p.y) : colCells(board, p.x))
        : other === 'under' ? plusCells(p.x, p.y) : squareCells(p.x, p.y, 2);
      for (const { x, y } of area) {
        if (!inBounds(board, x, y) || seen.has(keyOf(x, y))) continue;
        seen.add(keyOf(x, y));
        let cell = get(board, x, y);
        if (isPart(cell)) cell = get(board, cell.ax, cell.ay);
        if (cell === null || cell.t === 'empty' || isDrop(cell)) continue;
        if (isBlock(cell) && !takesHit(cell, 'power')) continue;
        if (opts.needs && opts.needs(cell, x, y)) score += 1000;
        else if (opts.needs && isPiece(cell)) score += 1;
      }
    });
    if (score > bestScore || (score === bestScore && from.length > bestCount)) {
      best = color; bestScore = score; bestCount = from.length;
    }
  }
  return best;
}

// ---- One power-up going off ------------------------------------------------

// Carry out the effect of one queued power-up, then add a snapshot.
function runPower(run, item) {
  const { board } = run;
  run.hitNow = new Set(); // a new effect: every block may be hit once more
  const { x, y, kind } = item;
  if (item.special) {
    runSpecial(run, item);
  } else if (kind === 'spot-h') {
    clearArea(run, rowCells(board, y), kind);
  } else if (kind === 'spot-v') {
    clearArea(run, colCells(board, x), kind);
  } else if (kind === 'show') {
    // (Fireworks use the same 5x5 blast, reported with cause 'fireworks'.)
    clearArea(run, squareCells(x, y, 2), item.cause ?? kind);
  } else if (kind === 'under') {
    clearArea(run, plusCells(x, y), kind);
    flyAndClear(run, { x, y }, kind);
  } else if (kind === 'prism') {
    // The Prism clears itself first, then the color: the one it was swapped
    // with if the caller gave one, otherwise the most common color.
    clearArea(run, [{ x, y }], kind);
    const color = item.swapColor ?? helpfulColor(run);
    if (color !== undefined) clearArea(run, colorCells(board, color), kind);
    // SUPER Magic Ball (earned by a 10-win streak): double effect, so it also
    // clears the most common color that is left.
    if (run.opts.superPrism) {
      const second = helpfulColor(run);
      if (second !== undefined) clearArea(run, colorCells(board, second), kind);
    }
  }
  // (Several spikes or rockets fly at the same time.)
  const next = run.queue[0];
  if (item.special && next && next.special && next.kind === kind && (kind === 'spike' || kind === 'rocket')) return;
  pushFrame(run);
}

// What an obstacle sets off when it breaks (`leaves` in config/obstacles.js).
function runSpecial(run, item) {
  const { board, opts } = run;
  const { x, y, w, h, kind } = item;
  const rng = opts.rng;
  if (kind === 'blast') {
    clearArea(run, squareCells(x, y, 2), 'fireworks');
  } else if (kind === 'bigblast') {
    // A round blast, four and a half squares in every direction.
    const cx = x + (w - 1) / 2;
    clearArea(run, allCells(board).filter((p) => Math.hypot(p.x - cx, p.y - y) <= 4.5), 'fireworks');
  } else if (kind === 'rocket') {
    const to = flyAndClear(run, { x, y }, 'rocket');
    if (to) [...run.events].reverse().find((e) => e.type === 'fly').look = 'rocket';
  } else if (kind === 'beam') {
    // Its rows and its columns, all the way across.
    const area = [];
    for (let i = 0; i < h; i++) area.push(...rowCells(board, y + i));
    for (let i = 0; i < w; i++) area.push(...colCells(board, x + i));
    run.events.push({ type: 'beam', x, y, w, h });
    clearArea(run, area, 'beam');
  } else if (kind === 'toss') {
    const free = allCells(board).filter((p) => {
      const c = get(board, p.x, p.y);
      return isPiece(c) && c.fuse === undefined && !c.mimic && !run.cleared.has(keyOf(p.x, p.y));
    });
    for (let i = 0; i < item.count && free.length; i++) {
      const p = free.splice(rng ? rng.int(free.length) : 0, 1)[0];
      set(board, p.x, p.y, block(item.what));
      run.events.push({ type: 'fly', from: { x: x + 0.5, y: y + 0.5 }, to: p, look: item.what, lands: true });
    }
  } else if (kind === 'spike') {
    const barrels = allCells(board).filter((p) => {
      const c = get(board, p.x, p.y);
      return isBlock(c) && c.charge > 0;
    });
    barrels.sort((a, b) => Math.hypot(a.x - x, a.y + 1 - y) - Math.hypot(b.x - x, b.y + 1 - y));
    const at = barrels[0];
    if (at) {
      const c = get(board, at.x, at.y);
      const charge = c.charge - 1;
      set(board, at.x, at.y, { ...c, charge });
      run.events.push({ type: 'fly', from: { x, y }, to: { x: at.x, y: at.y + 1 }, look: 'spike' });
      if (charge === 0) run.queue.push({ special: true, kind: 'roll', x: at.x, y: at.y, w: 1, h: c.h || 1 });
    }
  } else if (kind === 'roll') {
    // The barrel rolls across the board: everything in its rows is hit twice.
    const c = get(board, x, y);
    if (!isBlock(c)) return;
    for (const p of footprint(c, x, y)) set(board, p.x, p.y, EMPTY);
    run.events.push({ type: 'roll', x, y, h, dir: x < board.cols / 2 ? 1 : -1 });
    run.events.push({ type: 'block', x, y, kind: c.kind, hpLeft: 0, destroyed: true, by: 'power', w: 1, h });
    const area = [];
    for (let i = 0; i < h; i++) area.push(...rowCells(board, y + i));
    for (let i = 0; i < 2; i++) { run.hitNow = new Set(); clearArea(run, area, 'roll'); }
  }
}

// Set off what an obstacle left behind. Changes the board; returns the events.
export function special(board, items, opts = {}) {
  const run = startRun(board, opts);
  for (const item of [].concat(items)) run.queue.push({ ...item, special: true });
  drain(run);
  return run.events;
}

// Work through the queue until it is empty. A power-up reached by a blast is
// added to the back of the queue, so they go off in the order they were
// reached. Each cell can be queued only once, so this always ends.
function drain(run) {
  while (run.queue.length > 0) runPower(run, run.queue.shift());
}

// ---- fire -------------------------------------------------------------------

// Set off the power-up at `at`. Changes the board; returns the event list.
//   opts.rng        random numbers (needed by the Understudy)
//   opts.swapColor  for a Prism: the color it was swapped with
//   opts.needs      (cell, x, y) => true for cells the level still needs
//   opts.fired      a Set of "x,y" keys to share between several calls
export function fire(board, at, opts = {}) {
  const cell = get(board, at.x, at.y);
  if (!isPower(cell)) return []; // nothing to set off
  const run = startRun(board, opts);
  const key = keyOf(at.x, at.y);
  if (run.fired.has(key)) return []; // already went off
  run.fired.add(key);
  run.queue.push({ x: at.x, y: at.y, kind: cell.kind, swapColor: opts.swapColor });
  drain(run);
  return run.events;
}

// ---- blast ------------------------------------------------------------------

// A Grenade-sized (5x5) blast centred on `at` with no power-up there: what
// Fireworks do when they break. Pieces are cleared, blocks take a power hit,
// power-ups caught in it go off. Changes the board; returns the event list.
export function blast(board, at, opts = {}) {
  const run = startRun(board, opts);
  run.queue.push({ x: at.x, y: at.y, kind: 'show', cause: 'fireworks' });
  drain(run);
  return run.events;
}

// ---- combine ----------------------------------------------------------------

const isSpot = (kind) => kind === 'spot-h' || kind === 'spot-v';

// Two power-ups swapped into each other. `a` is where the swipe began, `b` is
// the cell swiped into; the effect is centred on `b`. Both power-ups are used
// up (they do not also go off on their own). Changes the board; returns the
// event list. `opts` is the same as for fire().
export function combine(board, a, b, opts = {}) {
  const cellA = get(board, a.x, a.y);
  const cellB = get(board, b.x, b.y);
  if (!isPower(cellA) || !isPower(cellB)) return [];
  const ka = cellA.kind;
  const kb = cellB.kind;
  const kinds = [ka, kb];
  const run = startRun(board, opts);

  // Mark both as already gone off, so the blast below does not set them off
  // a second time.
  run.fired.add(keyOf(a.x, a.y));
  run.fired.add(keyOf(b.x, b.y));
  const both = [
    { x: a.x, y: a.y },
    { x: b.x, y: b.y },
  ];

  if (ka === 'prism' && kb === 'prism') {
    // Prism + Prism: the whole board. Nothing chains, because nothing is left.
    // Every block takes one power hit.
    const before = run.events.length;
    clearArea(run, both.concat(allCells(board)), 'combo', false);
    if (opts.superPrism) {
      // SUPER Magic Ball: a second power hit for every block that is still
      // standing after the first.
      const again = run.events
        .slice(before)
        .filter((e) => e.type === 'block' && !e.destroyed)
        .map((e) => ({ x: e.x, y: e.y }));
      run.hitNow = new Set();
      clearArea(run, again, 'combo', false);
    }
  } else if (kinds.includes('prism')) {
    // Prism + another power-up: every piece of the most helpful color turns
    // into that power-up, then they all go off.
    const other = ka === 'prism' ? kb : ka;
    clearArea(run, both, 'combo');
    const color = comboColor(run, other);
    let cells = color === undefined ? [] : colorCells(board, color);
    // SUPER Magic Ball: the second most helpful color too.
    if (opts.superPrism && color !== undefined) {
      const second = comboColor(run, other, color);
      if (second !== undefined) cells = cells.concat(colorCells(board, second));
    }
    const changed = [];
    cells.forEach(({ x, y }, i) => {
      // Spotlights alternate: row, column, row, column ...
      const kind = isSpot(other) ? (i % 2 === 0 ? 'spot-h' : 'spot-v') : other;
      changed.push({ x, y, was: get(board, x, y), kind });
      set(board, x, y, power(kind));
    });
    if (changed.length > 0) {
      run.events.push({
        type: 'transform',
        kind: other, // the power-up the Prism was swapped with
        cells: changed, // each: { x, y, was (the piece), kind (what it became) }
      });
      pushFrame(run);
      // Queue them all up front, in board order, so each goes off exactly once.
      for (const { x, y, kind } of changed) {
        run.fired.add(keyOf(x, y));
        run.queue.push({ x, y, kind });
      }
    }
  } else if (ka === 'under' && kb === 'under') {
    // Understudy + Understudy: clear around b, then three flights to three
    // different targets (a cleared target cannot be picked again).
    clearArea(run, both.concat(plusCells(b.x, b.y)), 'combo');
    for (let i = 0; i < 3; i++) flyAndClear(run, b, 'combo');
  } else if (kinds.includes('under')) {
    // Understudy + Spotlight or Showstopper: clear around b, fly to a target
    // carrying the other power-up, and set it off there.
    const carried = ka === 'under' ? kb : ka;
    clearArea(run, both.concat(plusCells(b.x, b.y)), 'combo');
    // Land where the carried power-up will do the most good.
    const footprint =
      carried === 'spot-h' ? (x, y) => rowCells(board, y)
      : carried === 'spot-v' ? (x, y) => colCells(board, x)
      : (x, y) => squareCells(x, y, 2);
    const target = chooseTarget(run, footprint);
    const to = target ?? { x: b.x, y: b.y }; // no target left: go off in place
    if (target) run.events.push({ type: 'fly', from: { x: b.x, y: b.y }, to });
    if (anchorOf(board, to.x, to.y)) {
      // Landing on a block: the block stays where it is, and the carried
      // power-up goes off from that spot (its blast gives the block its hit).
    } else {
      if (target) clearArea(run, [to], 'combo');
      set(board, to.x, to.y, power(carried)); // shown on the board until it goes off
    }
    run.queue.push({ x: to.x, y: to.y, kind: carried });
  } else if (isSpot(ka) && isSpot(kb)) {
    // Spotlight + Spotlight: the row and the column through b.
    clearArea(run, both.concat(rowCells(board, b.y), colCells(board, b.x)), 'combo');
  } else if (ka === 'show' && kb === 'show') {
    // Showstopper + Showstopper: everything within 4 cells of b (a 9x9 square).
    clearArea(run, both.concat(squareCells(b.x, b.y, 4)), 'combo');
  } else {
    // Spotlight + Showstopper: three rows and three columns through b.
    let area = both;
    for (let d = -1; d <= 1; d++) {
      area = area.concat(rowCells(board, b.y + d), colCells(board, b.x + d));
    }
    clearArea(run, area, 'combo');
  }

  pushFrame(run);
  drain(run); // any power-ups caught in the blast (and the queued ones) go off now
  if (run.events[run.events.length - 1].type !== 'frame') pushFrame(run);
  return run.events;
}
