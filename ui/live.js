// SEVERAL THINGS MOVING AT ONCE. Each move, and each step of a chain reaction,
// is played by its own "clip" (with the animations of ui/anim.js). This file
// puts the clips together into one picture: every cell is drawn the way the
// clip that last touched it has it, and cells no clip has anything to do with
// are drawn as they are. A cell counts as at rest (`ready`) when no clip has
// touched it or is going to.
import { playEvents, playSwap, splitSteps } from './anim.js';

const key = (x, y) => x + ',' + y;

// A clip that has drawn nothing for this long while the app is on screen is
// taken to be stuck and is dropped (the board then shows the rules' board).
export const STALL_MS = 2500;

// The cells (as numbers) that one step changes.
function touchedBy(step, cols) {
  const out = new Set();
  const add = (p) => { if (p && Number.isInteger(p.x) && Number.isInteger(p.y)) out.add(p.y * cols + p.x); };
  if (step.prev && step.board) {
    step.board.cells.forEach((c, i) => {
      const was = step.prev.cells[i];
      if (c !== was && JSON.stringify(c) !== JSON.stringify(was)) out.add(i);
    });
  }
  for (const g of step.clears) g.cells.forEach(add);
  for (const f of step.falls) { add(f.from); add(f.to); }
  for (const s of step.spawns) add(s.at);
  for (const m of step.slides) { add(m.from); add(m.to); }
  for (const p of step.powers) add(p.at);
  step.flips.forEach(add);
  step.hits.forEach(add);
  return out;
}

//   paint(board, overlay)   draws one picture
//   current()               the board as the rules have it now
//   options()               { theme, speed, swapMs }
//   onEnd()                 called each time a clip has finished
export function createLive({ paint, current, options, onEnd }) {
  const clips = []; // oldest first
  let dirty = false;

  const ready = (x, y) => {
    const b = current();
    const i = y * b.cols + x;
    return !clips.some((c) => c.pending.has(i) || c.touched.has(i));
  };

  // Which clip shows each cell (null: none of them).
  function ownerOf(i) {
    for (let n = clips.length - 1; n >= 0; n--) if (clips[n].touched.has(i)) return clips[n];
    for (const c of clips) if (c.pending.has(i)) return c;
    return null;
  }

  function compose() {
    dirty = false;
    const now = current();
    const board = { ...now, cells: now.cells.slice(), floor: (now.floor || []).slice() };
    if (now.paint) board.paint = now.paint.slice();
    const o = { offsets: new Map(), hide: new Set(), ghosts: [], flashes: [], sprites: [], fx: [] };
    const owner = board.cells.map((_, i) => ownerOf(i));
    owner.forEach((c, i) => {
      if (!c || !c.board) return;
      board.cells[i] = c.board.cells[i];
      if (c.board.floor) board.floor[i] = c.board.floor[i];
      if (board.paint && c.board.paint) board.paint[i] = c.board.paint[i];
    });
    for (const c of clips) {
      const ov = c.overlay || {};
      const mine = (k) => { const [x, y] = k.split(',').map(Number); return owner[y * board.cols + x] === c; };
      if (ov.offsets) for (const [k, v] of ov.offsets) if (mine(k)) o.offsets.set(k, v);
      if (ov.hide) for (const k of ov.hide) if (mine(k)) o.hide.add(k);
      for (const name of ['ghosts', 'flashes', 'sprites', 'fx']) if (ov[name]) o[name].push(...ov[name]);
    }
    paint(board, o);
  }
  function soon() {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(() => { if (dirty) compose(); });
  }

  // Where the thing shown at a cell is right now, as an offset in cells.
  function offsetAt(x, y, cols) {
    const c = ownerOf(y * cols + x);
    const v = c && c.overlay && c.overlay.offsets && c.overlay.offsets.get(key(x, y));
    return v ? { dx: v.dx, dy: v.dy } : null;
  }

  // A clip takes cells over from the clips before it.
  function take(clip, cells) {
    for (const i of cells) {
      clip.touched.add(i);
      for (const other of clips) {
        if (other === clip) break; // (the later ones keep theirs)
        other.touched.delete(i);
        other.pending.delete(i);
      }
    }
  }

  // Play a list of events. before: the board before them. swap: the action,
  // if two things are to be seen changing places first.
  async function play(events, before, swap) {
    const { theme, speed, swapMs } = options();
    const cols = before.cols;
    const steps = splitSteps(events, before);
    const parts = steps.map((s) => touchedBy(s, cols));
    const clip = { board: before, overlay: null, touched: new Set(), pending: new Set() };
    for (const p of parts) for (const i of p) clip.pending.add(i);
    if (swap) for (const p of [swap.a, swap.b]) clip.pending.add(p.y * cols + p.x);
    clips.push(clip);
    let lastDraw = Date.now();
    const draw = (board, overlay) => { lastDraw = Date.now(); clip.board = board; clip.overlay = overlay || null; soon(); };
    let watch = null;
    const stalled = new Promise((resolve) => {
      watch = setInterval(() => {
        const hidden = typeof document !== 'undefined' && document.hidden;
        if (hidden) { lastDraw = Date.now(); return; } // (nothing is drawn in the background)
        if (Date.now() - lastDraw > STALL_MS) resolve('stalled');
      }, 500);
    });
    const run = async () => {
      if (swap) {
        take(clip, [swap.a, swap.b].map((p) => p.y * cols + p.x));
        await playSwap(before, swap.a, swap.b, draw, swapMs, false);
      }
      let lifts = new Map();
      await playEvents(events, draw, theme, speed, before, null, {
        step(n) {
          // What falls from where it is seen now, not from where it would
          // have come to rest.
          lifts = new Map();
          for (const f of steps[n].falls) {
            const at = offsetAt(f.from.x, f.from.y, cols);
            if (at) lifts.set(key(f.from.x, f.from.y), at);
          }
          take(clip, parts[n]);
        },
        lift: (x, y) => lifts.get(key(x, y)) || null,
      });
    };
    try {
      const how = await Promise.race([run(), stalled]);
      if (how === 'stalled') console.error('an animation stopped drawing; it was dropped');
    } catch (err) {
      console.error(err);
    }
    clearInterval(watch);
    if (clips.includes(clip)) clips.splice(clips.indexOf(clip), 1);
    compose();
    onEnd();
  }

  return { play, ready, active: () => clips.length > 0, redraw: compose, clear() { clips.length = 0; } };
}
