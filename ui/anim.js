// ANIMATION: plays back the list of events the rules engine returns.
//
// The engine does a whole move at once and hands back a list of what
// happened, in order. The entries that matter most are "frame" events: each
// carries a complete picture of the board after one visible step. This file
// shows those pictures one after another with a short pause, and uses the
// "clear" / "fall" / "refill" events in between to make the step smooth
// (cleared pieces shrink away, falling pieces slide down). Obstacles that
// are hit ("block" events) flash briefly, and a broken obstacle or a
// collected sandbag ("collect" events) shrinks away like a cleared piece.
//
// No celebration effects. Event types this file does not know are skipped.

const key = (x, y) => x + ',' + y;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPos = (p) => p && isNum(p.x) && isNum(p.y);

// Wait `ms` thousandths of a second.
export function wait(ms) {
  return new Promise((done) => setTimeout(done, Math.max(0, ms)));
}

// Call step(t) repeatedly with t going from 0 to 1 over `ms`, in time with
// the screen's refresh. Always finishes with step(1).
export function tween(ms, step) {
  return new Promise((done) => {
    if (!(ms > 0)) { step(1); done(); return; }
    const hasRaf = typeof requestAnimationFrame === 'function';
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now();
    const next = (fn) => (hasRaf ? requestAnimationFrame(fn) : setTimeout(fn, 16));
    function tick() {
      const t = Math.min(1, (now() - t0) / ms);
      step(t);
      if (t < 1) next(tick); else done();
    }
    next(tick);
  });
}

// How much to shorten the timings: the "fast" setting halves them.
function speedFactor(speed) {
  return speed === 'fast' ? 0.5 : 1;
}

// events     the list from the engine
// drawFrame  function (board, overlay) that paints the board (see render.js)
// theme      for clearMs and fallMs
// speed      'normal' or 'fast'
// before     optional: the board as it was before these events
export async function playEvents(events, drawFrame, theme, speed, before) {
  if (!Array.isArray(events)) return;
  const k = speedFactor(speed);
  const clearMs = (theme.clearMs ?? 80) * k;
  const fallMs = (theme.fallMs ?? 90) * k;

  // What has happened since the last picture was shown.
  let clears = [];
  let falls = [];
  let spawns = [];
  let hits = [];        // obstacles hit and sandbags collected
  let lastBoard = before || null; // the previous picture, to know what a hit cell held

  for (const ev of events) {
    if (!ev || typeof ev.type !== 'string') continue;

    if (ev.type === 'clear' && Array.isArray(ev.cells)) clears.push(...ev.cells);
    else if (ev.type === 'fall' && Array.isArray(ev.falls)) falls.push(...ev.falls);
    else if (ev.type === 'refill' && Array.isArray(ev.spawns)) spawns.push(...ev.spawns);
    else if ((ev.type === 'block' || ev.type === 'collect') && isPos(ev)) hits.push(ev);
    else if (ev.type === 'frame' && ev.board) {
      const board = ev.board;
      try {
        const extras = hitExtras(hits, lastBoard);
        if (falls.length || spawns.length) {
          await playFall(board, falls, spawns, drawFrame, fallMs, extras);
        } else if (clears.length || extras.ghosts.length || extras.flashes.length) {
          await playClear(board, clears, drawFrame, clearMs, extras);
        } else {
          // A picture with no detail about how it came to be: just show it.
          drawFrame(board);
          await wait(clearMs);
        }
      } catch {
        // If the fancy version trips on an unexpected shape, fall back to
        // simply showing the picture, so the game never sticks.
        drawFrame(board);
        await wait(clearMs);
      }
      clears = [];
      falls = [];
      spawns = [];
      hits = [];
      lastBoard = board;
    }
    // Every other event type (fly, spawn-power, transform, cascade,
    // reshuffle, invalid, and any added later) needs no drawing here.
  }
}

// Turn the "block" and "collect" events of one step into things to draw:
//   flashes  a brief white flash on every obstacle that was hit
//   ghosts   a broken obstacle, or a collected sandbag, shrinking away
// `before` is the previous picture of the board (or null if there is none);
// it tells us exactly what the cell held, for example a paint can's color.
function hitExtras(hits, before) {
  const flashes = [];
  const ghosts = [];
  for (const h of hits) {
    if (h.type === 'collect') {
      ghosts.push({ x: h.x, y: h.y, cell: { t: 'drop', kind: h.kind || 'sandbag' }, scale: 1 });
      continue;
    }
    flashes.push({ x: h.x, y: h.y, alpha: 1 });
    if (h.destroyed) {
      let was = null;
      if (before && Array.isArray(before.cells) && isNum(before.cols)) {
        was = before.cells[h.y * before.cols + h.x] || null;
      }
      const cell = was && was.t === 'block' && was.kind === h.kind
        ? { ...was, hp: 1, inside: undefined }  // (a padlock's contents stay behind)
        : { t: 'block', kind: h.kind, hp: 1 };
      ghosts.push({ x: h.x, y: h.y, cell, scale: 1 });
    }
  }
  return { flashes, ghosts };
}

// Cleared pieces shrink away over the new picture.
async function playClear(board, clears, drawFrame, ms, extras) {
  const flashes = extras ? extras.flashes : [];
  const ghosts = extras ? extras.ghosts.slice() : [];
  for (const c of clears) {
    if (isPos(c) && c.was && typeof c.was.t === 'string') {
      ghosts.push({ x: c.x, y: c.y, cell: c.was, scale: 1 });
    }
  }
  if (ghosts.length === 0 && flashes.length === 0) {
    drawFrame(board);
    return wait(ms);
  }
  await tween(ms, (t) => {
    for (const g of ghosts) g.scale = 1 - t;
    for (const f of flashes) f.alpha = 1 - t;
    drawFrame(board, { ghosts, flashes });
  });
  drawFrame(board);
}

// Pieces slide from where they were to where the new picture has them.
async function playFall(board, falls, spawns, drawFrame, ms, extras) {
  const flashes = extras ? extras.flashes : [];
  const ghosts = extras ? extras.ghosts : [];
  // For each moved cell: how far back (in cells) it starts from.
  const starts = new Map();

  // New pieces drop in together from above: each starts as many cells up as
  // there are new pieces in its column.
  const perColumn = new Map();
  const spawnAt = [];
  for (const s of spawns) {
    const p = s && (isPos(s.at) ? s.at : isPos(s.to) ? s.to : isPos(s) ? s : null);
    if (!p) continue;
    spawnAt.push(p);
    perColumn.set(p.x, (perColumn.get(p.x) || 0) + 1);
  }
  for (const p of spawnAt) starts.set(key(p.x, p.y), { dx: 0, dy: -perColumn.get(p.x) });

  // Pieces already on the board: start from their old cell. If a piece moved
  // twice in one step, chain the moves so it starts from its first cell.
  const origin = new Map(); // "to" cell -> first "from" cell
  for (const f of falls) {
    if (!f || !isPos(f.from) || !isPos(f.to)) continue;
    const first = origin.get(key(f.from.x, f.from.y)) || f.from;
    origin.delete(key(f.from.x, f.from.y));
    origin.set(key(f.to.x, f.to.y), first);
  }
  for (const [toKey, from] of origin) {
    const [tx, ty] = toKey.split(',').map(Number);
    starts.set(toKey, { dx: from.x - tx, dy: from.y - ty });
  }

  if (starts.size === 0 && ghosts.length === 0 && flashes.length === 0) {
    drawFrame(board);
    return wait(ms);
  }

  const offsets = new Map();
  await tween(ms, (t) => {
    const left = 1 - t * t; // starts slow, ends fast, like falling
    for (const [k, s] of starts) offsets.set(k, { dx: s.dx * left, dy: s.dy * left });
    for (const g of ghosts) g.scale = 1 - t;
    for (const f of flashes) f.alpha = 1 - t;
    drawFrame(board, { offsets, ghosts, flashes });
  });
  drawFrame(board);
}

// Slide two neighbouring cells into each other's places on `board` (the
// board as it was before the move). With bounceBack = true they slide over
// and return, which is how a move that does nothing is shown.
export async function playSwap(board, a, b, drawFrame, ms, bounceBack) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const offsets = new Map();
  await tween(bounceBack ? ms * 2 : ms, (t) => {
    let p = bounceBack ? 1 - Math.abs(1 - t * 2) : t; // 0 -> 1, or 0 -> 1 -> 0
    if (bounceBack) p *= 0.5;                         // only go halfway, then back
    offsets.set(key(a.x, a.y), { dx: dx * p, dy: dy * p });
    offsets.set(key(b.x, b.y), { dx: -dx * p, dy: -dy * p });
    drawFrame(board, { offsets });
  });
}
