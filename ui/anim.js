// ANIMATION: plays back the list of events the rules engine returns.
//
// The engine does a whole move at once and hands back a list of what
// happened, in order. The entries that matter most are "frame" events: each
// carries a complete picture of the board after one visible step. This file
// shows those pictures one after another, and uses the events in between to
// make each step move:
//   clear        matched gems pop; a power-up going off shows its streak
//                (Missile), ring (Grenade) or beams (Magic Ball) first
//   spawn-power  the matched gems slide together and the new power-up grows in
//   fly          a Ninja Star spins along an arc to its target
//   transform    gems flip over into power-ups, one after another
//   fall/refill  gems fall, speeding up, and bounce a little on landing
// Obstacles that are hit ("block" events) flash briefly, and a broken
// obstacle or a collected sandbag ("collect" events) shrinks away.
// All the timings are in config/theme.js. The drawing itself is in
// ui/render.js (see the `overlay` notes above drawBoard there).
//
// No celebration effects. Event types this file does not know are skipped,
// and a step that cannot be animated is simply shown as its picture.

import { emit } from './fx.js'; // announces shards, trails and sparkles to ui/stage.js

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
// early      optional: a function giving the early move the player has made
//            while this is playing (or null); it slides while the rest falls
export async function playEvents(events, drawFrame, theme, speed, before, early) {
  if (!Array.isArray(events)) return;
  const k = speedFactor(speed);

  // How long each kind of motion lasts, in thousandths of a second.
  const T = {
    pop: (theme.clearMs ?? 140) * k,  // matched gems popping
    fall: (theme.fallMs ?? 180) * k,  // one falling step
    fly: (theme.flyMs ?? 260) * k,    // a Ninja Star's flight
    fx: (theme.fxMs ?? 110) * k,      // a streak, ring or beams shooting out
    flip: (theme.flipMs ?? 90) * k,   // one gem flipping into a power-up
  };

  // Cut the list into steps: everything that happened up to each picture.
  let steps = null;
  try {
    steps = splitSteps(events, before || null);
  } catch {
    steps = null;
  }
  if (!steps) {
    // The list has a shape this file cannot read: just show the pictures
    // one after another, so the game never sticks.
    for (const ev of events) {
      if (ev && ev.type === 'frame' && ev.board) {
        drawFrame(ev.board);
        await pause(T.pop);
      }
    }
    return;
  }

  // A long chain reaction is sped up evenly so the whole move still fits
  // in theme.moveBudgetMs (the player should never wait long).
  const budget = theme.moveBudgetMs ?? 1400;
  let total = 0;
  let parts = 0; // how many separate motions there are in all
  for (const step of steps) {
    total += stepCost(step, T);
    parts += 1 + (step.flies.length ? 1 : 0) + (step.effects.length ? 1 : 0);
  }
  // Each motion runs a little over its time (it ends on a screen refresh,
  // about 16 ms apart), so allow for that when fitting the budget.
  const room = budget - parts * 16;
  if (budget > 0 && total > room) {
    // (A very long chain, such as Magic Ball + Ninja Star, ends up with each
    // motion lasting only a screen refresh or two.)
    const squeeze = Math.max(0.05, room / total);
    for (const name of Object.keys(T)) T[name] *= squeeze;
  }

  for (const step of steps) {
    try {
      if (step.falls.length || step.spawns.length) await playFall(step, drawFrame, T, early, 90 * k);
      else await playBurst(step, drawFrame, T);
    } catch {
      // If the fancy version trips on an unexpected shape, fall back to
      // simply showing the picture.
      try { drawFrame(step.board); } catch { /* nothing more can be done for this picture */ }
      await pause(T.pop * 0.5);
    }
  }
}

// Wait `ms` in time with the screen's refresh, drawing nothing.
function pause(ms) {
  return tween(ms, () => {});
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// An empty step: what has happened since the last picture was shown.
function newStep() {
  return {
    board: null,     // the picture this step ends on
    prev: null,      // the picture before it (to know what a hit cell held)
    clears: [],      // groups of cleared cells: { cause, cells: [{ x, y, was }] }
    effects: [],     // streaks, rings and beams to draw (see drawFx in render.js)
    falls: [],
    spawns: [],
    swapped: false,  // two pieces changed places (already shown sliding)
    hits: [],        // obstacles hit, floor swept, things collected
    flies: [],       // Ninja Star flights: { from, to }
    flips: [],       // gems turned into power-ups: { x, y, was, kind }
    powers: [],      // power-ups created by a match: { at, kind }
  };
}

// Cut the engine's event list into steps, one per "frame" event.
// Event types this file does not know are skipped.
function splitSteps(events, before) {
  const steps = [];
  const armed = []; // power-ups already cleared that have not gone off yet: { x, y, kind }
  let step = newStep();
  let last = before;
  for (const ev of events) {
    if (!ev || typeof ev.type !== 'string') continue;
    if (ev.type === 'clear' && Array.isArray(ev.cells)) {
      const cells = ev.cells.filter((c) => isPos(c) && c.was && typeof c.was.t === 'string');
      if (cells.length === 0) continue;
      step.clears.push({ cause: ev.cause, cells });
      step.effects.push(...effectsFor(ev.cause, cells, armed));
      // A power-up cleared here goes off in a later step: remember where it was.
      for (const c of cells) {
        if (c.was.t === 'power' && c.was.kind !== ev.cause) armed.push({ x: c.x, y: c.y, kind: c.was.kind });
      }
    } else if (ev.type === 'fall' && Array.isArray(ev.falls)) step.falls.push(...ev.falls);
    else if (ev.type === 'refill' && Array.isArray(ev.spawns)) step.spawns.push(...ev.spawns);
    else if ((ev.type === 'block' || ev.type === 'collect' || ev.type === 'floor') && isPos(ev)) step.hits.push(ev);
    else if (ev.type === 'fly' && isPos(ev.from) && isPos(ev.to)) step.flies.push(ev);
    else if (ev.type === 'transform' && Array.isArray(ev.cells)) {
      for (const c of ev.cells) {
        if (isPos(c) && c.was && typeof c.was.t === 'string' && typeof c.kind === 'string') step.flips.push(c);
      }
    } else if (ev.type === 'spawn-power' && isPos(ev.at) && typeof ev.kind === 'string') step.powers.push(ev);
    else if (ev.type === 'swap') step.swapped = true;
    else if (ev.type === 'frame' && ev.board) {
      step.board = ev.board;
      step.prev = last;
      steps.push(step);
      last = ev.board;
      step = newStep();
    }
    // ('toggle', 'cascade', 'reshuffle', 'swap', 'end' and any type added
    // later need nothing here: the next picture shows the result.)
  }
  return steps;
}

// Find, and take off the list, a remembered power-up of this kind that
// passes `test`. Returns { x, y, kind } or null.
function takeArmed(armed, kind, test) {
  const i = armed.findIndex((p) => p.kind === kind && test(p));
  return i < 0 ? null : armed.splice(i, 1)[0];
}

// The light effects for one group of cleared cells, by what cleared them:
//   a Missile      a streak along its row or column, from the missile's cell
//   a Grenade      a ring growing over its area
//   a Magic Ball   beams from the ball to every gem it clears
//   a combo        the same, bigger and brighter
//   a plain match  nothing (the gems just pop)
function effectsFor(cause, cells, armed) {
  if (cause === 'match' || cause === 'under') return [];
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const mid = {
    x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2),
  };
  // The power-up itself, if it is among the cells it cleared.
  const own = (kind) => cells.find((c) => c.was.t === 'power' && c.was.kind === kind) || null;
  const inBox = (p) => p.x >= Math.min(...xs) - 1 && p.x <= Math.max(...xs) + 1
    && p.y >= Math.min(...ys) - 1 && p.y <= Math.max(...ys) + 1;

  if (cause === 'spot-h' || cause === 'spot-v') {
    const h = cause === 'spot-h';
    const at = own(cause)
      || takeArmed(armed, cause, (p) => (h ? p.y === cells[0].y : p.x === cells[0].x))
      || (h ? { x: mid.x, y: cells[0].y } : { x: cells[0].x, y: mid.y });
    return [{ type: 'streak', x: at.x, y: at.y, dir: h ? 'h' : 'v', p: 0, alpha: 1, big: false }];
  }
  if (cause === 'prism') {
    // The ball first clears itself, then the gems of its color (twice when it
    // is Super): the beams start from where the ball was.
    const self = own('prism');
    if (self) armed.ball = { x: self.x, y: self.y };
    if (self && cells.length === 1) return [];
    const at = armed.ball || takeArmed(armed, 'prism', () => true) || mid;
    return [{ type: 'beams', x: at.x, y: at.y, to: cells.map((c) => ({ x: c.x, y: c.y })), p: 0, alpha: 1 }];
  }
  if (cause === 'combo') {
    // Two Missiles make a cross: if every cell is on one row or one column,
    // show two big streaks from where they meet.
    const count = (list) => {
      const n = new Map();
      for (const v of list) n.set(v, (n.get(v) || 0) + 1);
      return [...n.entries()].sort((a, b) => b[1] - a[1])[0];
    };
    const [rowY, rowN] = count(ys);
    const [colX, colN] = count(xs);
    if (rowN >= 3 && colN >= 3 && cells.every((c) => c.y === rowY || c.x === colX)) {
      return [
        { type: 'streak', x: colX, y: rowY, dir: 'h', p: 0, alpha: 1, big: true },
        { type: 'streak', x: colX, y: rowY, dir: 'v', p: 0, alpha: 1, big: true },
      ];
    }
  }
  // A Grenade, a combo, or a cause added later: a ring over the whole area.
  const at = (cause === 'show' && (own('show') || takeArmed(armed, 'show', inBox))) || mid;
  let radius = 0.9;
  for (const c of cells) radius = Math.max(radius, Math.hypot(c.x - at.x, c.y - at.y) + 0.6);
  return [{ type: 'ring', x: at.x, y: at.y, radius, p: 0, alpha: 1, big: cause === 'combo' }];
}

// How long the flips of a Magic Ball combo take in all: one after another,
// but never more than four flips' worth of time however many there are.
function flipPlan(n, T) {
  const gap = n > 1 ? Math.min(T.flip * 0.35, (T.flip * 3) / (n - 1)) : 0;
  return { gap, total: T.flip + gap * (n - 1) };
}

// How long one step takes to play (used to keep a whole move within budget).
function stepCost(step, T) {
  if (step.falls.length || step.spawns.length) return T.fall;
  let ms = 0;
  if (step.flies.length) ms += T.fly;
  if (step.effects.length) ms += T.fx;
  let main = 0;
  if (step.clears.length || step.hits.length) main = T.pop;
  if (step.powers.length) main = T.pop * 1.3;
  if (step.flips.length) main = Math.max(main, flipPlan(step.flips.length, T).total);
  return ms + (main || (ms ? 0 : T.pop * 0.5));
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
    if (h.type === 'floor') {
      // Confetti or petals swept off a cell: a faint flash is enough.
      flashes.push({ x: h.x, y: h.y, alpha: 0.5, peak: 0.5 });
      continue;
    }
    if (h.type === 'collect' && h.kind && h.kind !== 'sandbag') {
      // A dove, popcorn or candy given out by a generator (or any collect
      // kind added later): the generator stays, so just flash its cell.
      flashes.push({ x: h.x, y: h.y, alpha: 1 });
      continue;
    }
    if (h.type === 'collect') {
      ghosts.push({ x: h.x, y: h.y, cell: { t: 'drop', kind: h.kind || 'sandbag' }, scale: 1 });
      continue;
    }
    flashes.push({ x: h.x, y: h.y, alpha: 1 });
    if (h.destroyed) {
      let was = null;
      if (before && Array.isArray(before.cells) && isNum(before.cols)) {
        was = before.cells[h.y * before.cols + h.x] || null;
        // A hit reported on one cell of a big block: use the block's real
        // (top-left) cell, so the whole block is what shrinks away.
        if (was && was.t === 'part' && isNum(was.ax) && isNum(was.ay)) {
          const anchor = before.cells[was.ay * before.cols + was.ax] || null;
          if (anchor && anchor.t === 'block' && anchor.kind === h.kind) {
            ghosts.push({ x: was.ax, y: was.ay, cell: { ...anchor, hp: 1, inside: undefined }, scale: 1 });
            continue;
          }
        }
      }
      const cell = was && was.t === 'block' && was.kind === h.kind
        ? { ...was, hp: 1, inside: undefined }  // (a padlock's contents stay behind)
        : { t: 'block', kind: h.kind, hp: 1 };
      ghosts.push({ x: h.x, y: h.y, cell, scale: 1 });
    }
  }
  return { flashes, ghosts };
}

// A step where things are cleared or changed in place. It plays in up to
// three parts, over the new picture of the board:
//   1. a Ninja Star (or the power-up it carries) spins along an arc to its target;
//   2. each power-up that went off shoots out its streak, ring or beams;
//   3. the cleared gems pop (grow a little, flash white, shrink to nothing).
//      Gems matched into a new power-up slide into its cell instead and the
//      power-up grows in; gems changed by a Magic Ball combo flip over one
//      after another.
async function playBurst(step, drawFrame, T) {
  const board = step.board;
  const { flashes, ghosts } = hitExtras(step.hits, step.prev);
  const hide = new Set();   // cells of the new picture not to draw yet
  const sprites = [];       // every loose piece this step draws itself
  const fx = step.effects;

  // The cleared pieces, drawn as they were until they pop.
  const pops = [];
  for (const group of step.clears) {
    const made = step.powers.find((p) => group.cause === 'match'
      && group.cells.some((c) => c.x === p.at.x && c.y === p.at.y));
    for (const c of group.cells) {
      pops.push({
        cell: c.was, x: c.x, y: c.y, x0: c.x, y0: c.y, scale: 1, flash: 0,
        into: made ? made.at : null, // slides into the new power-up's cell
      });
    }
  }
  sprites.push(...pops);

  // New power-ups made by a match: hidden until the gems have slid in.
  const born = step.powers.map((p) => {
    hide.add(key(p.at.x, p.at.y));
    return { cell: { t: 'power', kind: p.kind }, x: p.at.x, y: p.at.y, scale: 0 };
  });
  sprites.push(...born);

  // Gems a Magic Ball combo turned into power-ups: shown as the old gem
  // until their turn to flip.
  const flips = step.flips.map((c) => {
    hide.add(key(c.x, c.y));
    return { cell: c.was, x: c.x, y: c.y, scale: 1, sx: 1, was: c.was, kind: c.kind };
  });
  sprites.push(...flips);

  const nothing = sprites.length === 0 && ghosts.length === 0 && flashes.length === 0
    && step.flies.length === 0;
  if (nothing) {
    // A picture with no detail about how it came to be: just show it.
    drawFrame(board);
    return step.swapped ? undefined : pause(T.pop * 0.5);
  }
  const draw = () => drawFrame(board, { ghosts, flashes, sprites, hide, fx });
  for (const f of flashes) f.alpha = 0;
  for (const f of fx) f.alpha = 0;

  // 1. The flights.
  if (step.flies.length) {
    const flyers = step.flies.map((f) => {
      // If the target cell now holds a power-up, that is what was carried.
      const cells = board.cells;
      const there = Array.isArray(cells) && isNum(board.cols) ? cells[f.to.y * board.cols + f.to.x] : null;
      const carried = there && there.t === 'power' && typeof there.kind === 'string' ? there.kind : 'under';
      if (carried !== 'under') hide.add(key(f.to.x, f.to.y));
      // The star leaves its own cell: do not also show it sitting there.
      for (const p of pops) {
        if (p.x0 === f.from.x && p.y0 === f.from.y && p.cell.t === 'power') p.gone = true;
      }
      const dist = Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y);
      return {
        cell: { t: 'power', kind: carried }, bare: true, from: f.from, to: f.to,
        lift: Math.min(1.2, 0.3 + dist * 0.3), x: f.from.x, y: f.from.y, scale: 1, rot: 0,
      };
    });
    for (const p of pops) if (p.gone) p.scale = 0;
    sprites.push(...flyers);
    await tween(T.fly, (t) => {
      const e = t * t * (3 - 2 * t); // gentle start and finish
      for (const s of flyers) {
        s.x = s.from.x + (s.to.x - s.from.x) * e;
        s.y = s.from.y + (s.to.y - s.from.y) * e - Math.sin(Math.PI * e) * s.lift; // the arc
        s.rot = e * Math.PI * 4;                                                   // two full turns
        s.scale = 1.1 + 0.45 * Math.sin(Math.PI * e);
        emit('trail', s.x, s.y);
      }
      draw();
    });
    for (const s of flyers) {
      s.scale = 0; // landed
      hide.delete(key(s.to.x, s.to.y));
    }
  }

  // 2. The streaks, rings and beams shoot out.
  if (fx.length) {
    await tween(T.fx, (t) => {
      for (const f of fx) {
        f.p = 1 - (1 - t) * (1 - t); // fast at first, then easing off
        f.alpha = 1;
      }
      draw();
    });
  }

  // 3. The pop (and the slide-in, and the flips).
  const popMs = step.powers.length ? T.pop * 1.3 : T.pop;
  // Everything broken throws off shards; gems the level wants fly to the top.
  let shattered = false;
  const shatter = () => {
    if (shattered) return;
    shattered = true;
    for (const p of pops) if (!p.gone && !p.into) emit('burst', p.x0, p.y0, p.cell);
    for (const g of ghosts) emit('burst', g.x, g.y, g.cell);
    for (const p of pops) if (p.cell.t === 'piece') emit('collect', p.x0, p.y0, p.cell);
    for (const g of ghosts) emit('collect', g.x, g.y, g.cell);
  };
  const sparkled = new Set();
  const plan = flipPlan(flips.length, T);
  const total = Math.max(popMs, flips.length ? plan.total : 0);
  await tween(total, (t) => {
    const ms = t * total;
    const tp = popMs > 0 ? clamp01(ms / popMs) : 1;
    if (tp >= 0.22) shatter();
    for (const p of pops) {
      if (p.gone) continue;
      if (p.into) {
        // Slide into the new power-up's cell, shrinking on the way.
        const e = clamp01(tp / 0.7);
        p.x = p.x0 + (p.into.x - p.x0) * e * e;
        p.y = p.y0 + (p.into.y - p.y0) * e * e;
        p.scale = e < 1 ? 1 - 0.4 * e : 0;
        p.flash = 0.6 * e;
      } else {
        // Swell, flash, then burst into shards.
        p.scale = tp < 0.22 ? 1 + 0.18 * (tp / 0.22) : 1.18 * Math.max(0, 1 - (tp - 0.22) / 0.3);
        p.flash = 0.85 * Math.sin(Math.PI * clamp01(tp / 0.5));
      }
    }
    for (const b of born) {
      if (tp > 0.5 && !sparkled.has(b)) { sparkled.add(b); emit('spark', b.x, b.y); }
      // Grow in during the second half, a little too big, then settle.
      const u = clamp01((tp - 0.5) / 0.5);
      b.scale = u < 0.7 ? 1.2 * (u / 0.7) : 1.2 - 0.2 * ((u - 0.7) / 0.3);
    }
    flips.forEach((s, i) => {
      // Turn edge-on as the old gem, then open out as the new power-up.
      const u = T.flip > 0 ? clamp01((ms - i * plan.gap) / T.flip) : 1;
      if (u < 0.5) {
        s.cell = s.was;
        s.sx = 1 - 2 * u;
        s.scale = 1;
      } else {
        s.cell = { t: 'power', kind: s.kind };
        s.sx = 2 * u - 1;
        s.scale = 1 + 0.15 * Math.sin(Math.PI * (u - 0.5) * 2);
      }
    });
    for (const f of fx) { f.p = 1; f.alpha = 1 - tp; }
    for (const g of ghosts) g.scale = 1 - tp;
    for (const f of flashes) f.alpha = (f.peak ?? 1) * (1 - tp);
    draw();
  });
  drawFrame(board);
}

// Pieces fall from where they were to where the new picture has them:
// slowly at first, then faster, with a small squash as they land. New
// pieces drop in from above the board.
async function playFall(step, drawFrame, T, early, swapMs) {
  const { board, falls, spawns } = step;
  const ms = T.fall;
  const { flashes, ghosts } = hitExtras(step.hits, step.prev);
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
    return pause(ms);
  }

  // Each piece has its own short clock: lower pieces go first, longer drops
  // take longer, and every landing squashes and springs back.
  const offsets = new Map();
  const far = Math.max(1, ...[...starts.values()].map((s) => Math.hypot(s.dx, s.dy)));
  for (const [k, s] of starts) {
    const [x, y] = k.split(',').map(Number);
    s.delay = 0.16 * (1 - y / Math.max(1, board.rows - 1)) + 0.05 * (((x * 7) % 5) / 5);
    s.drop = 0.3 + 0.2 * Math.sqrt(Math.hypot(s.dx, s.dy) / far);
  }
  // An early move: its two pieces slide as soon as both are down, while
  // others are still in the air.
  let slide = null; // { a, b, from } (from = when it began, in ms)
  const slideStep = (now) => {
    if (!early) return;
    const act = early();
    if (!slide && act && act.type === 'swap') {
      const down = (p) => {
        const s = starts.get(key(p.x, p.y));
        return !s || now >= (s.delay + s.drop) * ms;
      };
      if (down(act.a) && down(act.b)) slide = { a: act.a, b: act.b, from: now };
    }
    if (!slide) return;
    const p = clamp01((now - slide.from) / Math.max(1, swapMs));
    const { a, b } = slide;
    offsets.set(key(a.x, a.y), { dx: (b.x - a.x) * p, dy: (b.y - a.y) * p });
    offsets.set(key(b.x, b.y), { dx: (a.x - b.x) * p, dy: (a.y - b.y) * p });
  };
  await tween(ms, (t) => {
    for (const [k, s] of starts) {
      const f = clamp01((t - s.delay) / s.drop);
      const left = 1 - f * f; // starts slow, ends fast, like falling
      let sx = 1;
      let sy = 1;
      if (f < 1) { sx = 1 - 0.07 * f; sy = 1 + 0.1 * f; } // stretched by its speed
      else {
        const u = clamp01((t - s.delay - s.drop) / Math.max(0.05, 1 - s.delay - s.drop));
        const w = Math.cos(u * Math.PI * 2.5) * (1 - u) * (1 - u); // a damped spring
        sx = 1 + 0.17 * w;
        sy = 1 - 0.2 * w;
      }
      offsets.set(k, { dx: s.dx * left, dy: s.dy * left, sx, sy });
    }
    for (const g of ghosts) g.scale = 1 - t;
    for (const f of flashes) f.alpha = (f.peak ?? 1) * (1 - t);
    slideStep(t * ms);
    drawFrame(board, { offsets, ghosts, flashes });
  });
  // If the slide began late, let it finish.
  if (early && early() && early().type === 'swap') {
    const t0 = slide ? Math.min(swapMs, ms - slide.from) : 0;
    if (t0 < swapMs) {
      offsets.clear();
      await tween(swapMs - t0, (t) => { slideStep(ms + t * (swapMs - t0)); drawFrame(board, { offsets }); });
    }
    return; // the next step begins with the two already changed over
  }
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
