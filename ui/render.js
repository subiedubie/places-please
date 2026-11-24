// DRAWING: paints the board on the canvas. No game rules here.
//
// All sizes are in "CSS pixels" (the units the page is laid out in).
// fitCanvas() makes the canvas sharp on high-resolution phone screens by
// giving it more real pixels (devicePixelRatio) and scaling the drawing.

import { get } from '../engine/board.js';
import { OBSTACLES, OBSTACLES2, DROPPER } from '../config/obstacles.js';
import { drawArt, hasArt } from './art.js'; // the rendered pictures

const TAU = Math.PI * 2;
const GLOW = 'rgba(255, 255, 255, 0.45)'; // lighter detail drawn on a piece
const MAX_CELL = 64;                      // cells never get bigger than this
const BOARD_PAD = 6;                      // free space kept around the board

// Match the canvas's real pixel size to its size on the page.
// Returns { ctx, w, h } with w and h in CSS pixels.
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // from here on, draw in CSS pixels
  return { ctx, w, h };
}

// Work out where the board goes: the biggest square cells that fit,
// centered in the canvas.
export function layoutFor(canvasW, canvasH, cols, rows) {
  const cell = Math.max(8, Math.min(
    MAX_CELL,
    Math.floor((canvasW - BOARD_PAD * 2) / cols),
    Math.floor((canvasH - BOARD_PAD * 2) / rows),
  ));
  return {
    originX: Math.round((canvasW - cell * cols) / 2),
    originY: Math.round((canvasH - cell * rows) / 2),
    cell, cols, rows, canvasW, canvasH,
  };
}

// How much of the tray shows around the lighter square inside each cell.
function cellGap(cell) {
  return Math.max(1.5, cell * 0.05);
}

// ---- The outline of the board. ----
// A board can have "holes": spots where gems never go. The tray is drawn
// only under the playable cells, so its edge has to be traced: round the
// outside of the board AND round every hole inside it.
//
// Returns a list of closed loops. Each loop is a list of corner points
// [x, y], counted in cells from the board's top-left corner.
function boardLoops(board) {
  const { cols, rows } = board;
  const playable = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && get(board, x, y) !== null;
  // Every side of a playable cell that faces a hole or the outside is one
  // piece of the edge. Each piece is stored as an arrow from one grid corner
  // to the next, going clockwise round the playable area.
  const arrows = new Map(); // "x,y" of a corner -> the arrows that start there
  const add = (x1, y1, x2, y2) => {
    const id = x1 + ',' + y1;
    if (!arrows.has(id)) arrows.set(id, []);
    arrows.get(id).push({ x1, y1, x2, y2, used: false });
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!playable(x, y)) continue;
      if (!playable(x, y - 1)) add(x, y, x + 1, y);         // top side
      if (!playable(x + 1, y)) add(x + 1, y, x + 1, y + 1); // right side
      if (!playable(x, y + 1)) add(x + 1, y + 1, x, y + 1); // bottom side
      if (!playable(x - 1, y)) add(x, y + 1, x, y);         // left side
    }
  }
  // Join the arrows end to start into loops.
  const loops = [];
  for (const list of arrows.values()) {
    for (const first of list) {
      if (first.used) continue;
      const loop = [];
      let arrow = first;
      while (arrow && !arrow.used) {
        arrow.used = true;
        // A new corner point is needed only where the edge turns.
        const last = loop[loop.length - 1];
        const dx = arrow.x2 - arrow.x1;
        const dy = arrow.y2 - arrow.y1;
        if (!last || last.dx !== dx || last.dy !== dy) loop.push({ x: arrow.x1, y: arrow.y1, dx, dy });
        // Where two cells touch only at a corner, two arrows start at the
        // same point: take the one that turns right, which stays with the
        // same cell.
        const next = (arrows.get(arrow.x2 + ',' + arrow.y2) || []).filter((n) => !n.used);
        arrow = next.find((n) => n.x2 - n.x1 === -dy && n.y2 - n.y1 === dx) || next[0];
      }
      // If the loop ends going the same way it began, its first point is
      // not a real corner.
      if (loop.length > 1 && loop[0].dx === loop[loop.length - 1].dx && loop[0].dy === loop[loop.length - 1].dy) loop.shift();
      if (loop.length >= 4) loops.push(loop.map((p) => [p.x, p.y]));
    }
  }
  return loops;
}

// The loops of the last few board shapes (a shape never changes during a
// level, and the board is repainted many times a second).
const loopCache = new Map();
function loopsFor(board) {
  let id = board.cols + 'x' + board.rows + ':';
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) id += get(board, x, y) === null ? '0' : '1';
  }
  let loops = loopCache.get(id);
  if (!loops) {
    if (loopCache.size > 20) loopCache.clear();
    loops = boardLoops(board);
    loopCache.set(id, loops);
  }
  return loops;
}

// Trace the whole edge of the tray as one path, with every corner rounded.
function traceTray(ctx, board, layout) {
  const { originX, originY, cell } = layout;
  const r = cell * 0.2; // how round the corners are
  ctx.beginPath();
  for (const loop of loopsFor(board)) {
    const n = loop.length;
    const px = (i) => originX + loop[(i + n) % n][0] * cell;
    const py = (i) => originY + loop[(i + n) % n][1] * cell;
    // Start halfway along the last side, then round each corner in turn.
    ctx.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
    for (let i = 0; i < n; i++) ctx.arcTo(px(i), py(i), px(i + 1), py(i + 1), r);
    ctx.closePath();
  }
}

// A rectangle with rounded corners (written out because older phones lack
// the built-in one).
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- The five gems. Each is drawn around (0, 0) with "radius" r. ----
// Every gem is built the same way, from flat polygons, like a cut stone:
//   outline  the points of its outer edge (its silhouette), going clockwise
//   shrink   how big the flat face in the middle (the "table") is
//   cy       how far down the middle of the gem sits (0 = dead centre)
//   steps    optional: extra thin rings between edge and table (a "step cut")
//   glint    where the small white sparkle goes
// The strips between the outline and the table are the facets. The ones
// facing up and left are lighter, the ones facing down and right darker, as
// if lit from the top left. Each gem has a different outline, so the five
// can be told apart by shape alone.

// The points of a regular many-sided shape (used for the round gem).
function ringPoints(n, radius) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) * TAU) / n;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return pts;
}

const GEMS = {
  // Topaz: a triangle with its three tips cut off (a "trillion" cut).
  topaz: {
    outline: [[-0.17, -0.92], [0.17, -0.92], [1.0, 0.52], [0.83, 0.82], [-0.83, 0.82], [-1.0, 0.52]],
    shrink: 0.5, cy: 0.16, glint: [-0.14, -0.04],
  },
  // Ruby: a square with cut corners (a "cushion" cut).
  ruby: {
    outline: [[-0.66, -0.9], [0.66, -0.9], [0.9, -0.66], [0.9, 0.66],
      [0.66, 0.9], [-0.66, 0.9], [-0.9, 0.66], [-0.9, -0.66]],
    shrink: 0.55, cy: 0, glint: [-0.22, -0.24],
  },
  // Sapphire: round (a "brilliant" cut). Twelve facets: enough to look
  // round, few enough to stay clean on a small phone cell.
  sapphire: { outline: ringPoints(12, 0.98), shrink: 0.55, cy: 0, glint: [-0.22, -0.24] },
  // Emerald: tall and narrow with long cut corners, and a ring of steps.
  emerald: {
    outline: [[-0.34, -1], [0.34, -1], [0.68, -0.62], [0.68, 0.62],
      [0.34, 1], [-0.34, 1], [-0.68, 0.62], [-0.68, -0.62]],
    shrink: 0.5, cy: 0, steps: [0.76], glint: [-0.14, -0.3],
  },
  // Amethyst: a kite, pointed top and bottom.
  amethyst: {
    outline: [[0, -1], [0.76, -0.16], [0, 1], [-0.76, -0.16]],
    shrink: 0.5, cy: -0.04, glint: [-0.1, -0.24],
  },
};

// Work out the table and how much light each facet gets, once per gem.
for (const gem of Object.values(GEMS)) {
  const scaled = (s) => gem.outline.map(([x, y]) => [x * s, gem.cy + (y - gem.cy) * s]);
  gem.table = scaled(gem.shrink);
  gem.rings = (gem.steps || []).map(scaled);
  gem.light = gem.outline.map(([x, y], i) => {
    const [x2, y2] = gem.outline[(i + 1) % gem.outline.length];
    const mx = (x + x2) / 2;
    const my = (y + y2) / 2 - gem.cy;
    const len = Math.hypot(mx, my) || 1;
    return (mx / len) * -0.45 + (my / len) * -0.89; // +1 faces the light, -1 faces away
  });
}

// The fill colors of one gem in one body color (remembered, because the
// board is repainted many times a second).
const gemLooks = new Map();
function gemLook(name, color) {
  const id = name + '|' + color;
  let look = gemLooks.get(id);
  if (!look) {
    look = {
      facets: GEMS[name].light.map((l) => (l >= 0
        ? mixColor(color, '#ffffff', 0.6 * l)
        : mixColor(color, '#000000', 0.4 * -l))),
      table: mixColor(color, '#ffffff', 0.16),
      edge: mixColor(color, '#000000', 0.62),
    };
    gemLooks.set(id, look);
  }
  return look;
}

// Trace a closed shape through a list of [x, y] points, scaled by r.
function polygon(ctx, pts, r) {
  ctx.beginPath();
  for (const [x, y] of pts) ctx.lineTo(x * r, y * r);
  ctx.closePath();
}

// Draw one gem around (0, 0). `small` = true for the little gem markers drawn
// on obstacles: no shadow underneath.
function drawGem(ctx, name, r, color, small) {
  const gem = GEMS[name];
  const look = gemLook(name, color);
  const out = gem.outline;
  const tab = gem.table;
  const n = out.length;
  ctx.lineJoin = 'round';
  // A soft shadow just under the gem lifts it off the cell.
  if (!small) {
    ctx.save();
    ctx.translate(0, r * 0.12);
    ctx.fillStyle = 'rgba(20, 28, 55, 0.3)';
    polygon(ctx, out, r * 1.05);
    ctx.fill();
    ctx.restore();
  }
  // The facets: one flat four-sided strip per edge of the outline.
  ctx.lineWidth = 0.6;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ctx.fillStyle = look.facets[i];
    ctx.strokeStyle = look.facets[i]; // (hides the hairline gap between strips)
    ctx.beginPath();
    ctx.moveTo(out[i][0] * r, out[i][1] * r);
    ctx.lineTo(out[j][0] * r, out[j][1] * r);
    ctx.lineTo(tab[j][0] * r, tab[j][1] * r);
    ctx.lineTo(tab[i][0] * r, tab[i][1] * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The table: the flat face in the middle, with a pale line around it.
  ctx.fillStyle = look.table;
  polygon(ctx, tab, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = Math.max(0.9, r * 0.07);
  ctx.stroke();
  if (!small) {
    for (const ring of gem.rings) { // the steps of a step cut
      polygon(ctx, ring, r);
      ctx.stroke();
    }
  }
  // The dark outline, the same weight on every gem (about 2 px on a phone),
  // in a dark shade of the gem's own color.
  ctx.strokeStyle = look.edge;
  ctx.lineWidth = Math.max(1, r * 0.13);
  polygon(ctx, out, r);
  ctx.stroke();
  // One small white glint, always toward the top left (where the light is).
  sparkle(ctx, gem.glint[0] * r, gem.glint[1] * r, 0.24 * r, '#ffffff');
}

const SHAPES = {
  topaz: (ctx, r, color, small) => drawGem(ctx, 'topaz', r, color, small),
  ruby: (ctx, r, color, small) => drawGem(ctx, 'ruby', r, color, small),
  sapphire: (ctx, r, color, small) => drawGem(ctx, 'sapphire', r, color, small),
  emerald: (ctx, r, color, small) => drawGem(ctx, 'emerald', r, color, small),
  amethyst: (ctx, r, color, small) => drawGem(ctx, 'amethyst', r, color, small),
  // The names the pieces had before they were gems, so an older theme file
  // still draws something sensible.
  mask: (ctx, r, color, small) => drawGem(ctx, 'topaz', r, color, small),
  quill: (ctx, r, color, small) => drawGem(ctx, 'sapphire', r, color, small),
  lantern: (ctx, r, color, small) => drawGem(ctx, 'emerald', r, color, small),
  fan: (ctx, r, color, small) => drawGem(ctx, 'amethyst', r, color, small),

  rose: (ctx, r, color, small) => drawGem(ctx, 'ruby', r, color, small),
};

// Draw one ordinary piece (a gem) centered at (cx, cy). `size` is the width
// of the square it should fit in: the gem fills about 80% of it. Also used
// for the small target pictures.
export function drawPiece(ctx, colorIndex, cx, cy, size, theme) {
  const info = theme.pieces[colorIndex];
  if (!info) return; // a color this theme does not know: draw nothing
  if (drawArt(ctx, 'gem' + colorIndex, cx, cy, size * 1.02, size * 1.02)) return;
  const shape = SHAPES[info.shape] || SHAPES.rose;
  ctx.save();
  ctx.translate(cx, cy);
  shape(ctx, size * 0.4, info.color);
  ctx.restore();
}

// ---- The power-ups. Each sits on a light tile so it never looks like a piece. ----

// True while the board being painted is in Super Magic Ball mode (drawBoard
// sets this from overlay.superPrism), so every Magic Ball on it is drawn Super.
let superMode = false;

// `opts` is optional:
//   superPrism  true = draw a Magic Ball in its Super form
//   bare        true = leave out the glowing tile (used while a power-up flies)
function drawPower(ctx, kind, cx, cy, size, theme, opts) {
  const pc = theme.powerColors;
  const ink = pc.star || '#1b2030';
  const isSuper = kind === 'prism' && (opts && opts.superPrism !== undefined ? !!opts.superPrism : superMode);
  const art = isSuper ? 'prism-super' : opts && opts.bare && hasArt(kind + '-bare') ? kind + '-bare' : kind;
  if (drawArt(ctx, art, cx, cy, size * 0.96, size * 0.96)) return;
  const r = size * 0.4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';

  // The glowing tile: a soft gold halo, then a pale tile with a gold edge.
  if (!(opts && opts.bare)) {
    const t = size * 0.88;
    ctx.fillStyle = pc.glow || 'rgba(255, 196, 0, 0.3)';
    roundRect(ctx, -size * 0.49, -size * 0.49, size * 0.98, size * 0.98, size * 0.24);
    ctx.fill();
    ctx.fillStyle = pc.tile;
    roundRect(ctx, -t / 2, -t / 2, t, t, size * 0.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; // the bright middle of the tile
    dot(ctx, 0, 0, t * 0.4);
    if (pc.tileEdge) {
      ctx.strokeStyle = pc.tileEdge;
      ctx.lineWidth = Math.max(1.5, size * 0.055); // about 2 px, like every outline
      roundRect(ctx, -t / 2, -t / 2, t, t, size * 0.2);
      ctx.stroke();
    }
  }

  if (kind === 'spot-h' || kind === 'spot-v') {
    // Missile: one chunky arrow with a head at both ends, lying along the
    // row ('spot-h') or standing along the column ('spot-v').
    if (kind === 'spot-v') ctx.rotate(Math.PI / 2);
    const arrow = [[-1.04, 0], [-0.36, -0.7], [-0.36, -0.3], [0.36, -0.3], [0.36, -0.7],
      [1.04, 0], [0.36, 0.7], [0.36, 0.3], [-0.36, 0.3], [-0.36, 0.7]];
    ctx.fillStyle = pc.missile;
    polygon(ctx, arrow, r);
    ctx.fill();
    ctx.fillStyle = pc.missileLight || 'rgba(255, 255, 255, 0.4)'; // the lit top half
    polygon(ctx, [[-1.04, 0], [-0.36, -0.7], [-0.36, -0.3], [0.36, -0.3], [0.36, -0.7], [1.04, 0]], r);
    ctx.fill();
    ctx.strokeStyle = pc.missileEdge || ink;
    ctx.lineWidth = Math.max(1, r * 0.13);
    polygon(ctx, arrow, r);
    ctx.stroke();
    ctx.fillStyle = '#ffffff'; // a white band round the middle
    ctx.fillRect(-0.11 * r, -0.24 * r, 0.22 * r, 0.48 * r);
  } else if (kind === 'under') {
    // Ninja Star: four steel blades, each half light and half dark, and a
    // colored middle.
    const tip = 1.06 * r;
    const waist = 0.34 * r;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;      // which way this blade points
      const tx = Math.cos(a) * tip;
      const ty = Math.sin(a) * tip;
      for (const side of [-1, 1]) {
        const b = a + side * (Math.PI / 4);           // the notch beside the blade
        ctx.fillStyle = side < 0 ? (pc.starLight || '#e3e8f0') : (pc.starDark || '#8792a4');
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tx, ty);
        ctx.lineTo(Math.cos(b) * waist, Math.sin(b) * waist);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? tip : waist;
      const ang = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = pc.starCentre || '#e5383b';
    dot(ctx, 0, 0, 0.26 * r);
    ctx.stroke(); // (dot() left its circle as the current path)
  } else if (kind === 'show') {
    // Grenade: a round black bomb with a shine, a short fuse and a spark.
    ctx.strokeStyle = pc.fuse || '#8a5a2b'; // the fuse, curling up to the right
    ctx.lineWidth = 0.16 * r;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.3 * r, -0.56 * r);
    ctx.quadraticCurveTo(0.42 * r, -0.98 * r, 0.74 * r, -0.8 * r);
    ctx.stroke();
    ctx.fillStyle = pc.grenade; // the body
    dot(ctx, -0.04 * r, 0.16 * r, 0.8 * r);
    ctx.fillStyle = pc.band;    // the brass collar the fuse comes out of
    ctx.save();
    ctx.translate(0.3 * r, -0.56 * r);
    ctx.rotate(0.5);
    ctx.fillRect(-0.24 * r, -0.13 * r, 0.48 * r, 0.26 * r);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // the shine, top left
    ctx.beginPath();
    ctx.ellipse(-0.38 * r, -0.16 * r, 0.17 * r, 0.3 * r, 0.6, 0, TAU);
    ctx.fill();
    sparkle(ctx, 0.76 * r, -0.8 * r, 0.36 * r, pc.spark || '#ff8a00'); // the spark
    sparkle(ctx, 0.76 * r, -0.8 * r, 0.18 * r, '#fff3a0');
  } else if (kind === 'prism') {
    // Magic Ball: a glossy ball with a swirl of all the piece colors.
    // Super Magic Ball: the same ball, bigger, on a gold ring of spikes,
    // with a small "x2" badge.
    const R = (isSuper ? 0.98 : 0.88) * r;
    if (isSuper) {
      const spikes = 12;
      ctx.fillStyle = pc.superGold || '#ffc400';
      ctx.strokeStyle = pc.superEdge || '#a86a00';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const rad = (i % 2 === 0 ? 1.24 : 1.02) * r;
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const n = Math.max(1, theme.pieces.length);
    const rim = (a) => [Math.cos(a) * R, Math.sin(a) * R];
    const bend = (a) => [Math.cos(a - 0.9) * R * 0.55, Math.sin(a - 0.9) * R * 0.55];
    for (let i = 0; i < n; i++) {
      // One curved wedge: out from the middle along a bent line, round the
      // rim, and back along the next bent line. The bend makes the swirl.
      const a0 = (i / n) * TAU - Math.PI / 2;
      const a1 = ((i + 1) / n) * TAU - Math.PI / 2;
      const [x0, y0] = rim(a0);
      const [bx0, by0] = bend(a0);
      const [bx1, by1] = bend(a1);
      ctx.fillStyle = theme.pieces[i] ? theme.pieces[i].color : ink;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(bx0, by0, x0, y0);
      ctx.arc(0, 0, R, a0, a1);
      ctx.quadraticCurveTo(bx1, by1, 0, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'; // a shadow on the lower right, for roundness
    ctx.beginPath();
    ctx.arc(0, 0, R, -0.3, Math.PI - 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, 0.13 * r);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffffff'; // the middle of the swirl
    dot(ctx, 0, 0, 0.16 * R);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // the white highlight
    ctx.beginPath();
    ctx.ellipse(-0.36 * R, -0.44 * R, 0.3 * R, 0.17 * R, -0.7, 0, TAU);
    ctx.fill();
    if (isSuper) {
      // The "x2" badge, bottom right.
      const bw = 0.5 * size;
      const bh = 0.3 * size;
      const bx = size * 0.49 - bw;
      const by = size * 0.49 - bh;
      ctx.fillStyle = pc.badge || '#c62f2f';
      roundRect(ctx, bx, by, bw, bh, bh * 0.45);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(size * 0.26) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x2', bx + bw / 2, by + bh / 2 + size * 0.01);
    }
  } else {
    // A power-up kind this file does not know yet: a plain dot.
    ctx.fillStyle = pc.star;
    ctx.beginPath();
    ctx.arc(0, 0, 0.5 * r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---- The obstacles. Each is drawn around (0, 0); "u" is half its width. ----
// The colors come from obstacleColors in config/theme.js (called "oc" here).
// What each obstacle is and how it breaks is in config/obstacles.js.

// One straight line.
function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// One filled circle.
function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ---- Helpers every obstacle drawing shares. ----
// The house style: one bold shape that nearly fills the cell, a dark outline
// about 2 px wide in a darker shade of the object's own color, a few flat
// colors, one highlight toward the top left. No thin lines: they turn to
// mush on a phone.

// How thick an obstacle's outline is: about 2 px on a phone cell.
function edgeW(u) {
  return Math.max(1.5, u * 0.13);
}

// A darker shade of a "#rrggbb" color, used for outlines (remembered,
// because the board is repainted many times a second).
const darkShades = new Map();
function dark(color, amount = 0.55) {
  const id = color + '|' + amount;
  let shade = darkShades.get(id);
  if (!shade) {
    shade = mixColor(color, '#000000', amount);
    darkShades.set(id, shade);
  }
  return shade;
}

// Fill the shape that was just traced, then draw its outline.
// Leave out `stroke` for no outline; pass null as `fill` for outline only.
function ink(ctx, fill, stroke, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// A rounded box, filled and outlined.
function box(ctx, x, y, w, h, r, fill, stroke, lw) {
  roundRect(ctx, x, y, w, h, r);
  ink(ctx, fill, stroke, lw);
}

// A circle, filled and outlined.
function disc(ctx, x, y, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ink(ctx, fill, stroke, lw);
}

// A closed shape through [x, y] points (stretched by sx and sy), filled and outlined.
function poly(ctx, pts, sx, sy, fill, stroke, lw) {
  ctx.beginPath();
  for (const [x, y] of pts) ctx.lineTo(x * sx, y * sy);
  ctx.closePath();
  ink(ctx, fill, stroke, lw);
}

// Several overlapping circles drawn as ONE lump with one outline around the
// lot (a bush, a heap of popcorn). Each circle is [x, y, radius].
function lump(ctx, circles, sx, sy, fill, stroke, lw) {
  for (const [x, y, r] of circles) disc(ctx, x * sx, y * sy, r * sx + lw, stroke);
  for (const [x, y, r] of circles) disc(ctx, x * sx, y * sy, r * sx, fill);
}

// A thick line with an outline: drawn twice, wide and dark, then narrower in color.
function pipe(ctx, trace, width, fill, stroke, lw) {
  ctx.lineCap = 'round';
  for (const [color, w] of [[stroke, width + lw * 2], [fill, width]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    trace();
    ctx.stroke();
  }
}

// A five-point star around (x, y).
function star5(ctx, x, y, r, fill, stroke, lw) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.46;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ink(ctx, fill, stroke, lw);
}

// One big crack: a fat pale zigzag with a dark line down its middle, so it
// shows on dark and light obstacles alike. `pale` is the color of the fat
// part (white unless something should glow through the crack).
function crack(ctx, pts, sx, sy, u, pale) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, width] of [[pale || '#ffffff', 0.36], ['#1b2030', 0.15]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * u;
    ctx.beginPath();
    for (const [px, py] of pts) ctx.lineTo(px * sx, py * sy);
    ctx.stroke();
  }
}

// THE "HITS LEFT" BADGE: a dark circle with a white number. Drawn at the
// bottom right of an obstacle whenever it needs more than one more hit.
function hitBadge(ctx, x, y, r, n, oc) {
  disc(ctx, x, y, r, oc.badge || '#1b2030', oc.badgeText || '#ffffff', Math.max(1, r * 0.2));
  ctx.fillStyle = oc.badgeText || '#ffffff';
  ctx.font = 'bold ' + (r * 1.55).toFixed(1) + 'px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x, y + r * 0.1);
}

// THE "POWER-UPS ONLY" BADGE: a gold circle with a dark lightning bolt.
// Drawn at the top left of an obstacle while its next hit must come from a
// power-up (a match next to it would do nothing).
function powerMark(ctx, x, y, r, oc) {
  disc(ctx, x, y, r, oc.gold || '#ffc400', oc.badge || '#1b2030', Math.max(1, r * 0.2));
  ctx.fillStyle = oc.badge || '#1b2030';
  ctx.beginPath();
  for (const [bx, by] of [[0.22, -0.78], [-0.52, 0.14], [-0.06, 0.14], [-0.22, 0.78], [0.52, -0.14], [0.06, -0.14]]) {
    ctx.lineTo(x + bx * r, y + by * r);
  }
  ctx.closePath();
  ctx.fill();
}

// THE "HOW FAR ALONG" BADGE of the two obstacles that never break (Top Hat,
// Popcorn Cart): a white circle cut in three, with one slice turned gold
// for each match already made toward the next dove or popcorn.
function pieBadge(ctx, x, y, r, n, oc) {
  disc(ctx, x, y, r, '#ffffff');
  for (let i = 0; i < 3; i++) {
    const from = -Math.PI / 2 + (i * TAU) / 3;
    ctx.fillStyle = i < n ? (oc.gold || '#ffc400') : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, from, from + TAU / 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = oc.badge || '#1b2030'; // the cuts between the slices
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
  }
  disc(ctx, x, y, r, null, oc.badge || '#1b2030', Math.max(1, r * 0.2));
}

// THE "MATCH THIS COLOR" MARKER: the gem itself, in its own color and
// shape, on a white disc. Used by every obstacle that needs one color.
function gemMark(ctx, x, y, r, colorIndex, theme, rim) {
  disc(ctx, x, y, r, '#ffffff', rim, Math.max(1, r * 0.16));
  const info = theme.pieces[colorIndex];
  if (!info) return;
  ctx.save();
  ctx.translate(x, y);
  (SHAPES[info.shape] || SHAPES.rose)(ctx, r * 0.74, info.color, true);
  ctx.restore();
}

// Each drawing below gets one "o" object:
//   u      the unit: 0.42 of one cell, so -u..u spans about 85% of the cell
//   a, b   half the width and half the height of the area the obstacle covers
//          (the same as u for a one-cell obstacle; bigger for a big block)
//   lw     the outline width (edgeW above)
//   oc     obstacleColors from config/theme.js
//   cell   the board cell (for color, colors, count, open)
//   theme  the theme (for the gem colors and shapes)
//   plain  true for the small target picture: draw it whole and new
//   hp     hits still needed          taken  hits already landed
// Everything is drawn around (0, 0), the middle of the area.
const BLOCKS = {
  // Crate: a pale wooden box: a wide frame, a darker middle panel and one
  // fat diagonal plank across it.
  crate(ctx, { u, oc, lw }) {
    box(ctx, -0.96 * u, -0.96 * u, 1.92 * u, 1.92 * u, 0.16 * u, oc.wood, dark(oc.woodDark, 0.3), lw);
    box(ctx, -0.58 * u, -0.58 * u, 1.16 * u, 1.16 * u, 0.06 * u, oc.crateFrame);
    ctx.save(); // the plank, kept inside the middle panel
    ctx.clip();
    ctx.strokeStyle = oc.wood;
    ctx.lineWidth = 0.34 * u;
    line(ctx, -0.7 * u, 0.7 * u, 0.7 * u, -0.7 * u);
    ctx.restore();
    box(ctx, -0.74 * u, -0.8 * u, 1.1 * u, 0.13 * u, 0.06 * u, GLOW); // the highlight
  },

  // Hatbox: a striped round box seen from the side, with a wider lid and a knob.
  // 2 hits. New: the pink lid is on. After the first hit: the lid is gone
  // and you look into the dark open box.
  hatbox(ctx, { u, oc, lw, taken }) {
    const edge = oc.hatBlack;
    box(ctx, -0.84 * u, -0.26 * u, 1.68 * u, 1.22 * u, 0.2 * u, oc.hatWhite, edge, lw);
    ctx.save(); // three fat black stripes, kept inside the body
    ctx.clip();
    ctx.fillStyle = oc.hatBlack;
    for (const c of [-0.56, 0, 0.56]) ctx.fillRect((c - 0.14) * u, -0.3 * u, 0.28 * u, 1.3 * u);
    ctx.restore();
    if (taken > 0) {
      // Open: a dark oval mouth with a pink rim where the lid used to sit.
      ctx.beginPath();
      ctx.ellipse(0, -0.24 * u, 0.84 * u, 0.3 * u, 0, 0, TAU);
      ink(ctx, oc.safeInside, dark(oc.hatLid, 0.35), lw);
      return;
    }
    box(ctx, -0.98 * u, -0.66 * u, 1.96 * u, 0.56 * u, 0.16 * u, oc.hatLid, dark(oc.hatLid), lw);
    box(ctx, -0.74 * u, -0.56 * u, 0.8 * u, 0.12 * u, 0.06 * u, GLOW);
    disc(ctx, 0, -0.76 * u, 0.2 * u, oc.hatLid, dark(oc.hatLid), lw); // the knob
  },

  // Trunk: a dark brown travel trunk with a rounded lid, pale straps and a
  // brass latch. 3 hits: each hit snaps one strap, and the last one left
  // shows a crack.
  trunk(ctx, { u, oc, lw, hp, taken }) {
    const edge = dark(oc.trunk, 0.6);
    box(ctx, -0.98 * u, -0.8 * u, 1.96 * u, 1.74 * u, 0.34 * u, oc.trunk, edge, lw);
    ctx.save(); // keep the lid line and the straps inside the trunk
    ctx.clip();
    ctx.fillStyle = oc.trunkDark; // where the lid closes
    ctx.fillRect(-u, -0.2 * u, 2 * u, 0.16 * u);
    ctx.fillStyle = GLOW;         // the highlight along the top of the lid
    ctx.fillRect(-0.66 * u, -0.66 * u, 0.9 * u, 0.13 * u);
    const straps = Math.max(0, hp - 1); // 2 when new, then 1, then none
    ctx.fillStyle = oc.strap;
    if (straps >= 1) ctx.fillRect(-0.68 * u, -u, 0.3 * u, 2 * u);
    if (straps >= 2) ctx.fillRect(0.38 * u, -u, 0.3 * u, 2 * u);
    ctx.restore();
    box(ctx, -0.98 * u, -0.8 * u, 1.96 * u, 1.74 * u, 0.34 * u, null, edge, lw);
    box(ctx, -0.2 * u, -0.38 * u, 0.4 * u, 0.5 * u, 0.08 * u, oc.brass, dark(oc.brass), lw * 0.8); // the latch
    if (taken >= 2) crack(ctx, [[0.9, -0.5], [0.42, -0.1], [0.62, 0.26], [0.2, 0.8]], u, u, u);
  },

  // Paint Can: a tin of paint in ONE gem color, with that gem on its white
  // label. Only a match of that color (or a power-up) opens it.
  paint(ctx, { u, oc, lw, cell, theme }) {
    const info = theme.pieces[cell.color];
    const color = info ? info.color : oc.paintNone;
    const edge = dark(color, 0.6);
    pipe(ctx, () => ctx.arc(0, -0.5 * u, 0.56 * u, Math.PI, 0), 0.1 * u, oc.tin, dark(oc.shackle, 0.4), lw * 0.6); // the wire handle
    box(ctx, -0.8 * u, -0.46 * u, 1.6 * u, 1.42 * u, 0.16 * u, color, edge, lw);
    box(ctx, -0.92 * u, -0.62 * u, 1.84 * u, 0.32 * u, 0.1 * u, oc.tin, dark(oc.shackle, 0.4), lw); // the metal rim
    if (info) gemMark(ctx, 0, 0.3 * u, 0.56 * u, cell.color, theme, edge);
    else disc(ctx, 0, 0.3 * u, 0.5 * u, '#ffffff', edge, lw * 0.7);
  },

  // Dry Ice: a bright icy block with a pale face, two fat white shine
  // marks, and white fog curling off the bottom.
  dryice(ctx, { u, oc, lw }) {
    box(ctx, -0.94 * u, -0.96 * u, 1.88 * u, 1.8 * u, 0.26 * u, oc.iceBody, oc.iceLine, lw);
    box(ctx, -0.62 * u, -0.64 * u, 1.24 * u, 1.16 * u, 0.14 * u, oc.iceLight);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.2 * u;
    line(ctx, -0.36 * u, -0.1 * u, -0.06 * u, -0.4 * u);
    line(ctx, -0.36 * u, 0.3 * u, 0.34 * u, -0.4 * u);
    // The fog: one white lump along the bottom edge.
    lump(ctx, [[-0.62, 0.8, 0.22], [-0.2, 0.86, 0.26], [0.26, 0.82, 0.24], [0.66, 0.86, 0.2]],
      u, u, '#ffffff', oc.iceLine, lw * 0.7);
  },

  // Cash Box: a steel-blue money box with a big gold coin dropping into the
  // slot on top and a round lock on the front. Power-ups only.
  cashbox(ctx, { u, oc, lw }) {
    const edge = dark(oc.cashbox, 0.62);
    disc(ctx, 0.3 * u, -0.46 * u, 0.48 * u, oc.brass, dark(oc.brass), lw); // the coin
    disc(ctx, 0.3 * u, -0.46 * u, 0.24 * u, oc.gold);
    box(ctx, -0.96 * u, -0.36 * u, 1.92 * u, 1.32 * u, 0.18 * u, oc.cashbox, edge, lw);
    ctx.fillStyle = edge;                                                // the coin slot
    ctx.fillRect(-0.6 * u, -0.36 * u, 1.2 * u, 0.14 * u);
    box(ctx, -0.7 * u, -0.1 * u, 0.9 * u, 0.13 * u, 0.06 * u, GLOW);     // the highlight
    disc(ctx, 0, 0.44 * u, 0.3 * u, oc.brass, edge, lw * 0.8);           // the lock
    disc(ctx, 0, 0.44 * u, 0.1 * u, edge);
  },

  // Scenery Flat: a piece of stage wall, built of seven big pale stone
  // blocks with dark gaps between them. Power-ups only, 3 hits: each hit
  // knocks one block out of the wall.
  flat(ctx, { u, oc, lw, taken }) {
    box(ctx, -0.97 * u, -0.97 * u, 1.94 * u, 1.94 * u, 0.14 * u, oc.stoneGap, oc.stoneGap, lw);
    const e = 0.86 * u;             // half the width of the wall
    const gap = 0.13 * u;           // the dark gap between blocks
    const h = (2 * e - 2 * gap) / 3; // three rows
    // Each block: [row, left edge, right edge] with the edges from -1 to 1.
    const blocks = [
      [0, -1, -0.08], [0, 0.08, 1],
      [1, -1, -0.56], [1, -0.4, 0.4], [1, 0.56, 1],
      [2, -1, -0.08], [2, 0.08, 1],
    ];
    const gone = [1, 5, 3].slice(0, taken); // which blocks have been knocked out
    blocks.forEach(([row, x1, x2], i) => {
      if (gone.includes(i)) return;
      const y = -e + row * (h + gap);
      box(ctx, x1 * e, y, (x2 - x1) * e, h, 0.07 * u, oc.stone);
      box(ctx, x1 * e, y, (x2 - x1) * e, h * 0.36, 0.07 * u, oc.stoneLight); // its lit top
    });
  },

  // Strongbox: a near-black safe with a big brass dial. First a power-up
  // must blow the door open (then you see the gold inside); after that one
  // match next to it finishes it.
  strongbox(ctx, { u, oc, lw, taken }) {
    const edge = dark(oc.safe, 0.7);
    box(ctx, -0.97 * u, -0.97 * u, 1.94 * u, 1.94 * u, 0.2 * u, oc.safe, edge, lw);
    if (taken > 0) {
      // Open: the dark inside, three gold bars, and the door swung to the right.
      box(ctx, -0.72 * u, -0.72 * u, 1.3 * u, 1.44 * u, 0.1 * u, oc.safeInside);
      for (const [x, y] of [[-0.58, 0.3], [-0.06, 0.3], [-0.32, -0.08]]) {
        box(ctx, x * u, y * u, 0.5 * u, 0.34 * u, 0.06 * u, oc.gold, dark(oc.brass), lw * 0.6);
      }
      box(ctx, 0.6 * u, -0.9 * u, 0.3 * u, 1.8 * u, 0.1 * u, oc.safeDoor, edge, lw * 0.8);
      return;
    }
    box(ctx, -0.72 * u, -0.72 * u, 1.44 * u, 1.44 * u, 0.12 * u, oc.safeDoor);
    box(ctx, -0.56 * u, -0.6 * u, 0.7 * u, 0.12 * u, 0.06 * u, GLOW);    // the highlight
    disc(ctx, 0, 0.04 * u, 0.44 * u, oc.brass, edge, lw);                // the dial
    disc(ctx, 0, 0.04 * u, 0.16 * u, oc.safe);
    ctx.fillStyle = oc.safe;                                             // its pointer
    ctx.fillRect(-0.06 * u, -0.38 * u, 0.12 * u, 0.26 * u);
  },

  // Costume Bag: a round teal pouch pulled shut with a gold cord, with a
  // big gold star on the front (there is a power-up inside). 3 hits: each
  // hit rips the bag, and gold light shows through the rip.
  costume(ctx, { u, oc, lw, taken }) {
    const edge = dark(oc.bag, 0.6);
    ctx.beginPath();
    ctx.moveTo(-0.32 * u, -0.46 * u);
    ctx.bezierCurveTo(-1.16 * u, 0, -1.02 * u, 0.98 * u, 0, 0.98 * u);
    ctx.bezierCurveTo(1.02 * u, 0.98 * u, 1.16 * u, 0, 0.32 * u, -0.46 * u);
    ctx.lineTo(0.66 * u, -0.98 * u);
    ctx.lineTo(0, -0.8 * u);
    ctx.lineTo(-0.66 * u, -0.98 * u);
    ctx.closePath();
    ink(ctx, oc.bag, edge, lw);
    ctx.fillStyle = oc.bagLight; // the lit side
    ctx.beginPath();
    ctx.ellipse(-0.5 * u, 0.2 * u, 0.16 * u, 0.36 * u, 0.3, 0, TAU);
    ctx.fill();
    box(ctx, -0.46 * u, -0.6 * u, 0.92 * u, 0.24 * u, 0.1 * u, oc.gold, dark(oc.brass), lw * 0.7); // the cord
    star5(ctx, 0.06 * u, 0.3 * u, 0.44 * u, oc.gold, dark(oc.brass), lw * 0.7);
    if (taken >= 1) crack(ctx, [[-0.86, -0.02], [-0.5, 0.2], [-0.7, 0.46], [-0.36, 0.78]], u, u, u, oc.gold);
    if (taken >= 2) crack(ctx, [[0.86, 0.0], [0.56, 0.28], [0.74, 0.5], [0.4, 0.8]], u, u, u, oc.gold);
  },

  // Padlock: a brass lock with a steel hoop and a dark keyhole. (When it
  // holds something, drawBlock below draws that first, then chains, then
  // this lock on top.) Power-ups only.
  padlock(ctx, { u, oc, lw }) {
    pipe(ctx, () => {
      ctx.moveTo(-0.44 * u, -0.06 * u);
      ctx.lineTo(-0.44 * u, -0.46 * u);
      ctx.arc(0, -0.46 * u, 0.44 * u, Math.PI, 0);
      ctx.lineTo(0.44 * u, -0.06 * u);
    }, 0.2 * u, oc.chain, oc.chainDark, lw);
    box(ctx, -0.82 * u, -0.16 * u, 1.64 * u, 1.14 * u, 0.22 * u, oc.brass, dark(oc.brass, 0.6), lw);
    box(ctx, -0.6 * u, -0.02 * u, 0.8 * u, 0.13 * u, 0.06 * u, GLOW); // the highlight
    ctx.fillStyle = oc.badge;                                         // the keyhole
    dot(ctx, 0, 0.34 * u, 0.2 * u);
    ctx.fillRect(-0.09 * u, 0.36 * u, 0.18 * u, 0.4 * u);
  },
};

// ---- Batch 2 obstacles (docs/OBSTACLES2.md). ----
// Each drawing gets the same "o" object as the batch-1 drawings above. For a
// big block, a and b are half the width and height of its whole w x h area.

// How many cells wide and high each big block is when the cell does not say.
const BIG_SIZE = {
  planter: [2, 2], dovecote: [2, 2], footlights: [2, 2],
  fireworks: [2, 1], truss: [3, 1], ticketbooth: [3, 1],
};

// Mix two "#rrggbb" colors: t = 0 gives a, t = 1 gives b.
function mixColor(a, b, t) {
  const parse = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
    ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return a;
  const ch = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return 'rgb(' + ch[0] + ', ' + ch[1] + ', ' + ch[2] + ')';
}

// The fill color of piece number c, or grey if the theme has no such piece.
function pieceColor(theme, c, oc) {
  const info = theme.pieces[c];
  return info ? info.color : (oc.paintNone || '#8c95a6');
}

// A flower: a colored bloom with a dark outline and a yellow middle.
function bloom(ctx, x, y, r, color, oc, lw) {
  disc(ctx, x, y, r, color, dark(color, 0.5), lw);
  ctx.fillStyle = oc.flowerMid;
  dot(ctx, x, y, r * 0.42);
}

// A four-point sparkle.
function sparkle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.3;
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

// Which of `slots` places hold a color. The colors still to go sit in the
// LAST places, so that taking away the first color (what a power hit does)
// leaves the others where they were. Returns a list of color-or-null.
function slotColors(cell, slots, plain) {
  const list = plain || !Array.isArray(cell.colors)
    ? Array.from({ length: slots }, (_, i) => i)
    : cell.colors.slice(0, slots);
  const out = [];
  for (let i = 0; i < slots; i++) {
    const j = i - (slots - list.length);
    out.push(j >= 0 ? list[j] : null);
  }
  return out;
}

const BLOCKS2 = {
  // Planter (2x2): a terracotta pot with a round green bush growing out.
  // 5 matches: it carries one big flower for every hit still needed, so a
  // flower is picked with each hit.
  planter(ctx, { a, b, oc, lw, hp }) {
    lump(ctx, [[-0.5, -0.3, 0.46], [0.5, -0.3, 0.46], [0, -0.48, 0.5], [0, 0, 0.5]],
      a, b, oc.leaf, dark(oc.leafDark, 0.45), lw);
    const spots = [[0, -0.62], [-0.58, -0.4], [0.58, -0.4], [-0.26, -0.1], [0.3, -0.12]];
    for (let i = 0; i < Math.min(hp, spots.length); i++) {
      bloom(ctx, spots[i][0] * a, spots[i][1] * b, 0.2 * a, i % 2 === 0 ? oc.flowerA : oc.flowerB, oc, lw * 0.8);
    }
    const edge = dark(oc.pot, 0.6);
    poly(ctx, [[-0.86, 0.2], [0.86, 0.2], [0.68, 0.97], [-0.68, 0.97]], a, b, oc.pot, edge, lw);
    box(ctx, -0.97 * a, 0.06 * b, 1.94 * a, 0.3 * b, 0.08 * a, oc.potRim, edge, lw); // the rim
  },

  // Dovecote (2x2): a white birdhouse with a red roof, a round dark door and
  // a perch. 5 matches: every hit adds one big crack.
  dovecote(ctx, { a, b, u, oc, lw, taken }) {
    const edge = dark(oc.coteEdge, 0.5);
    box(ctx, -0.72 * a, -0.24 * b, 1.44 * a, 1.2 * b, 0.08 * a, oc.cote, edge, lw);
    poly(ctx, [[-1.0, -0.14], [0, -0.98], [1.0, -0.14]], a, b, oc.roof, dark(oc.roof, 0.6), lw);
    box(ctx, -0.42 * a, 0.68 * b, 0.84 * a, 0.14 * b, 0.05 * b, oc.woodDark, dark(oc.woodDark, 0.5), lw * 0.7); // the perch
    disc(ctx, 0, 0.2 * b, 0.27 * a, oc.safeInside);                       // the round door
    const cracks = [
      [[-0.68, -0.1], [-0.46, 0.16], [-0.6, 0.4], [-0.42, 0.66]],
      [[0.68, 0.0], [0.48, 0.3], [0.62, 0.56], [0.44, 0.88]],
      [[-0.3, -0.7], [-0.44, -0.5], [-0.26, -0.38], [-0.4, -0.18]],
      [[0.36, -0.66], [0.24, -0.48], [0.42, -0.36], [0.3, -0.18]],
    ];
    for (let i = 0; i < Math.min(taken, cracks.length); i++) crack(ctx, cracks[i], a, b, u);
  },

  // Lighting Truss (w x 1): a long steel girder (two pale rails with a fat
  // zigzag between them) with two stage lamps hanging under it. Power-ups
  // only, 2 hits: the first hit breaks one lamp and cracks the girder.
  truss(ctx, { a, b, u, oc, lw, taken }) {
    const edge = dark(oc.steelDark, 0.65);
    for (const side of [-1, 1]) { // the lamps (drawn first: they hang behind the girder)
      const x = side * 0.5 * a;
      const lit = !(taken > 0 && side > 0); // the right-hand lamp goes dark after a hit
      poly(ctx, [[-0.34, 0.1], [0.34, 0.1], [0.6, 0.74], [-0.6, 0.74]].map(([px, py]) => [x / b + px, py]),
        b, b, oc.hat, edge, lw);
      box(ctx, x - 0.62 * b, 0.6 * b, 1.24 * b, 0.38 * b, 0.12 * b, lit ? oc.lampLight : oc.safeDoor, edge, lw);
    }
    box(ctx, -a, -0.96 * b, 2 * a, 1.2 * b, 0.16 * b, oc.steelDark, edge, lw);
    ctx.save(); // the zigzag and the rails, kept inside the girder
    ctx.clip();
    const n = Math.max(2, Math.round((2 * a) / (0.8 * b))); // number of zigzag legs
    ctx.strokeStyle = oc.steel;
    ctx.lineWidth = 0.2 * b;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) ctx.lineTo(-a + (2 * a * i) / n, (i % 2 === 0 ? 0.06 : -0.78) * b);
    ctx.stroke();
    ctx.fillStyle = oc.steel;
    ctx.fillRect(-a, -0.96 * b, 2 * a, 0.32 * b);
    ctx.fillRect(-a, -0.06 * b, 2 * a, 0.3 * b);
    ctx.fillStyle = '#ffffff'; // the highlight along the top rail
    ctx.fillRect(-a, -0.86 * b, 2 * a, 0.1 * b);
    ctx.restore();
    box(ctx, -a, -0.96 * b, 2 * a, 1.2 * b, 0.16 * b, null, edge, lw);
    if (taken > 0) crack(ctx, [[0.1, -0.92], [-0.1, -0.56], [0.12, -0.3], [-0.06, 0.2]].map(([px, py]) => [px * b, py * b]), 1, 1, u);
  },

  // Ticket Booth (3x1): a cream booth with fat red stripes, a gold sign
  // with lights along the top, and a window in the middle. First the window
  // is shuttered in grey steel (a power-up must open it); then it shows a
  // gold star (the power-ups inside) and takes 3 matches.
  ticketbooth(ctx, { a, b, oc, lw, taken, plain }) {
    const shut = !plain && taken === 0;
    const edge = dark(oc.boothStripe, 0.6);
    box(ctx, -a, -0.6 * b, 2 * a, 1.57 * b, 0.18 * b, oc.booth, edge, lw);
    ctx.save(); // keep the stripes inside the body
    ctx.clip();
    ctx.fillStyle = oc.boothStripe;
    const stripe = (2 * a) / 9;
    for (let i = 0; i < 9; i += 2) ctx.fillRect(-a + i * stripe, -0.6 * b, stripe, 1.6 * b);
    ctx.restore();
    box(ctx, -a, -0.6 * b, 2 * a, 1.57 * b, 0.18 * b, null, edge, lw);
    // The sign across the top, with five light bulbs.
    box(ctx, -0.6 * a, -0.98 * b, 1.2 * a, 0.5 * b, 0.16 * b, oc.gold, dark(oc.brass, 0.6), lw);
    for (let i = 0; i < 5; i++) disc(ctx, (i - 2) * 0.24 * a, -0.73 * b, 0.11 * b, '#ffffff');
    // The window.
    const wx = -0.36 * a;
    const ww = 0.72 * a;
    if (shut) {
      box(ctx, wx, -0.36 * b, ww, 1.14 * b, 0.1 * b, oc.tin, oc.chainDark, lw);
      ctx.fillStyle = oc.shackle; // two fat slats
      ctx.fillRect(wx + lw, -0.06 * b, ww - lw * 2, 0.18 * b);
      ctx.fillRect(wx + lw, 0.34 * b, ww - lw * 2, 0.18 * b);
    } else {
      box(ctx, wx, -0.36 * b, ww, 1.14 * b, 0.1 * b, oc.boothGlass, oc.chainDark, lw);
      star5(ctx, 0, 0.22 * b, 0.46 * b, oc.gold, dark(oc.brass, 0.6), lw * 0.6);
    }
  },

  // Footlights (2x2): a dark panel with four sockets. A socket holds a round
  // bulb in a piece color while that color is still to go; a spent one is dark.
  // The gem in each lamp is the color to match next to it.
  footlights(ctx, { a, b, oc, lw, cell, theme, plain }) {
    box(ctx, -0.97 * a, -0.97 * b, 1.94 * a, 1.94 * b, 0.14 * a, oc.safe, dark(oc.safe, 0.7), lw);
    const colors = slotColors(cell, 4, plain);
    const r = 0.37 * Math.min(a, b);
    colors.forEach((c, i) => {
      const x = (i % 2 === 0 ? -0.46 : 0.46) * a;
      const y = (i < 2 ? -0.46 : 0.46) * b;
      if (c === null) { // a lamp that is done: a dark empty socket
        disc(ctx, x, y, r, oc.safeInside, oc.safeDoor, lw);
        return;
      }
      disc(ctx, x, y, r + lw, oc.lampLight); // the glow round a lit lamp
      gemMark(ctx, x, y, r, c, theme, null);
    });
  },

  // Fireworks (2x1): a red crate with gold bursts on its front and up to
  // three rockets standing in it. The head of each rocket IS a gem: match
  // that color next to the crate to fire it.
  fireworks(ctx, { a, b, oc, lw, cell, theme, plain }) {
    const colors = slotColors(cell, 3, plain);
    colors.forEach((c, i) => {
      if (c === null) return;
      const x = (i - 1) * 0.62 * a;
      const color = pieceColor(theme, c, oc);
      box(ctx, x - 0.13 * a, -0.3 * b, 0.26 * a, 0.9 * b, 0.04 * a, color, dark(color, 0.6), lw * 0.8); // the stick
      const info = theme.pieces[c];
      if (!info) return;
      ctx.save();
      ctx.translate(x, -0.36 * b);
      (SHAPES[info.shape] || SHAPES.rose)(ctx, 0.58 * b, info.color, true);
      ctx.restore();
    });
    // The front of the crate hides the rockets' feet. It is red, with a
    // gold explosion mark: when the last rocket goes, it blasts.
    box(ctx, -0.98 * a, 0.2 * b, 1.96 * a, 0.77 * b, 0.14 * b, oc.fireworkBox, dark(oc.fireworkBox, 0.6), lw);
    for (const x of [-0.62, 0, 0.62]) {
      ctx.beginPath(); // a spiky burst
      for (let i = 0; i < 16; i++) {
        const rad = (i % 2 === 0 ? 0.32 : 0.15) * b;
        const ang = (i * Math.PI) / 8;
        ctx.lineTo(x * a + Math.cos(ang) * rad, 0.58 * b + Math.sin(ang) * rad);
      }
      ctx.closePath();
      ink(ctx, oc.gold);
    }
  },

  // Bouquet: three big pink flowers in a cream paper cone tied with a pink
  // ribbon. 2 hits: after the first, one flower is left on bare green stems.
  bouquet(ctx, { u, oc, lw, taken }) {
    const green = dark(oc.leafDark, 0.45);
    // Green leaves poking out at both sides, then the stems.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 0.72 * u, -0.1 * u, 0.36 * u, 0.2 * u, side * -0.7, 0, TAU);
      ink(ctx, oc.leaf, green, lw * 0.8);
    }
    pipe(ctx, () => {
      for (const x of [-0.46, 0, 0.46]) { ctx.moveTo(0, 0.3 * u); ctx.lineTo(x * u, -0.5 * u); }
    }, 0.1 * u, oc.leaf, green, lw * 0.6);
    // The flowers: five round petals each, with a yellow middle.
    const flower = (x, y, r, color) => {
      const petals = [];
      for (let i = 0; i < 5; i++) {
        const ang = (i * TAU) / 5 - Math.PI / 2;
        petals.push([x + Math.cos(ang) * r * 0.56, y + Math.sin(ang) * r * 0.56, r * 0.48]);
      }
      lump(ctx, petals, u, u, color, dark(color, 0.55), lw * 0.8);
      disc(ctx, x * u, y * u, r * 0.34 * u, oc.flowerMid);
    };
    if (taken > 0) flower(0, -0.56, 0.42, oc.flowerA);
    else {
      flower(-0.5, -0.46, 0.42, oc.flowerA);
      flower(0.5, -0.46, 0.42, oc.flowerC);
      flower(0, -0.6, 0.42, oc.flowerB);
    }
    // The paper wrap, with a notch at the top, and a bow.
    poly(ctx, [[-0.8, -0.16], [0, 0.1], [0.8, -0.16], [0.2, 0.98], [-0.2, 0.98]], u, u, oc.wrap, dark(oc.wrapEdge, 0.5), lw);
    for (const side of [-1, 1]) {
      poly(ctx, [[0, 0.56], [side * 0.5, 0.36], [side * 0.5, 0.78]], u, u, oc.petalEdge, dark(oc.petalEdge, 0.5), lw * 0.6);
    }
  },

  // Top Hat: a black hat with a red band. It never breaks: every third
  // match next to it lets a dove out. The pie badge shows how far along.
  tophat(ctx, { u, oc, lw }) {
    const edge = dark(oc.hat, 0.7);
    box(ctx, -0.62 * u, -0.96 * u, 1.24 * u, 1.6 * u, 0.12 * u, oc.hat, edge, lw); // the crown
    ctx.fillStyle = oc.roof;                                                        // the band
    ctx.fillRect(-0.62 * u + lw / 2, 0.12 * u, 1.24 * u - lw, 0.32 * u);
    box(ctx, -0.42 * u, -0.78 * u, 0.18 * u, 0.74 * u, 0.08 * u, GLOW);             // the highlight
    box(ctx, -1.0 * u, 0.5 * u, 2.0 * u, 0.4 * u, 0.2 * u, oc.hat, edge, lw);       // the brim
  },

  // Popcorn Cart: a red roof, a glass box heaped with yellow popcorn, a red
  // cart body with a white panel, two wheels. It never breaks: every third
  // match next to it pops one popcorn. The pie badge shows how far along.
  popper(ctx, { u, oc, lw }) {
    const edge = dark(oc.roof, 0.62);
    box(ctx, -0.74 * u, -0.72 * u, 1.48 * u, 0.86 * u, 0.06 * u, oc.glass, edge, lw); // the glass box
    lump(ctx, [[-0.36, -0.12, 0.2], [0, -0.26, 0.24], [0.36, -0.12, 0.2], [0, -0.04, 0.2]],
      u, u, oc.candyB, dark(oc.brass, 0.5), lw * 0.6);                                // the popcorn
    box(ctx, -0.92 * u, -0.99 * u, 1.84 * u, 0.36 * u, 0.12 * u, oc.roof, edge, lw);  // the roof
    disc(ctx, -0.5 * u, 0.76 * u, 0.24 * u, oc.hat);                                  // the wheels
    disc(ctx, 0.5 * u, 0.76 * u, 0.24 * u, oc.hat);
    box(ctx, -0.88 * u, 0.08 * u, 1.76 * u, 0.6 * u, 0.12 * u, oc.roof, edge, lw);    // the cart body
    box(ctx, -0.5 * u, 0.24 * u, 1.0 * u, 0.26 * u, 0.08 * u, '#ffffff');             // its white panel
  },

  // Candy Jar: a clear glass jar with a red lid, holding one big candy for
  // every hit still needed (3, then 2, then 1).
  candyjar(ctx, { u, oc, lw, hp }) {
    box(ctx, -0.78 * u, -0.56 * u, 1.56 * u, 1.53 * u, 0.36 * u, oc.glass, oc.iceLine, lw);
    const spots = [[0, 0.56], [-0.34, 0.04], [0.34, 0.04]];
    const colors = [oc.candyA, oc.candyB, oc.candyC];
    for (let i = 0; i < Math.min(hp, 3); i++) {
      disc(ctx, spots[i][0] * u, spots[i][1] * u, 0.3 * u, colors[i], dark(colors[i], 0.5), lw * 0.7);
      ctx.fillStyle = GLOW;
      dot(ctx, (spots[i][0] - 0.1) * u, (spots[i][1] - 0.1) * u, 0.09 * u);
    }
    box(ctx, -0.64 * u, -0.98 * u, 1.28 * u, 0.48 * u, 0.12 * u, oc.roof, dark(oc.roof, 0.62), lw); // the lid
    box(ctx, -0.48 * u, -0.9 * u, 0.6 * u, 0.11 * u, 0.05 * u, GLOW);
  },

  // Makeup Case: open = a pink case with its lid up, a mirror in the lid and
  // a sparkle; closed = the same case shut and grey (a hit does nothing then).
  // OPEN is the only time a match next to it counts: bright, tall, with its
  // mirror showing. CLOSED it is dull, low and shut tight.
  makeupcase(ctx, { u, oc, lw, cell, plain }) {
    const open = plain || cell.open === true;
    if (open) {
      const edge = oc.caseEdge;
      box(ctx, -0.86 * u, -0.98 * u, 1.72 * u, 0.98 * u, 0.18 * u, oc.caseOpen, edge, lw);   // the raised lid
      box(ctx, -0.6 * u, -0.78 * u, 1.2 * u, 0.56 * u, 0.1 * u, oc.glass);                   // the mirror
      sparkle(ctx, 0.28 * u, -0.5 * u, 0.3 * u, '#ffffff');
      box(ctx, -0.96 * u, -0.02 * u, 1.92 * u, 0.98 * u, 0.2 * u, oc.caseOpen, edge, lw);    // the body
      box(ctx, -0.7 * u, 0.2 * u, 1.4 * u, 0.48 * u, 0.12 * u, oc.caseLid);                  // the tray
      [oc.roof, oc.gold, oc.flowerC].forEach((c, i) => {                                    // three pots of makeup
        ctx.fillStyle = c;
        dot(ctx, (i - 1) * 0.42 * u, 0.44 * u, 0.16 * u);
      });
    } else {
      const edge = dark(oc.caseClosed, 0.6);
      pipe(ctx, () => ctx.arc(0, -0.36 * u, 0.34 * u, Math.PI, 0), 0.12 * u, oc.caseClosed, edge, lw * 0.7); // the handle
      box(ctx, -0.96 * u, -0.36 * u, 1.92 * u, 1.32 * u, 0.2 * u, oc.caseClosed, edge, lw);
      ctx.fillStyle = edge; // where the lid shuts on the body
      ctx.fillRect(-0.9 * u, 0.06 * u, 1.8 * u, 0.12 * u);
      box(ctx, -0.2 * u, -0.08 * u, 0.4 * u, 0.44 * u, 0.08 * u, oc.tin, edge, lw * 0.7);     // the clasp
    }
  },

  // Curtain: a velvet drape filling the whole cell IN THE COLOR OF ONE GEM,
  // hanging from a gold rail, with that gem on a white disc. Clearing
  // enough gems of that color opens it. Whatever is behind stays hidden.
  curtain(ctx, { a, u, oc, lw, cell, theme }) {
    const info = typeof cell.color === 'number' ? theme.pieces[cell.color] : null;
    const color = info ? info.color : oc.velvet;
    const e = a * 1.12; // nearly the full cell, so neighbouring curtains join up
    const hem = 0.82 * e;
    // The drape: straight at the top and sides, four hanging swags at the hem.
    ctx.beginPath();
    ctx.moveTo(-e, -e);
    ctx.lineTo(e, -e);
    ctx.lineTo(e, hem);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(e - (i + 0.5) * e / 2, hem + 0.4 * e, e - (i + 1) * e / 2, hem);
    ctx.closePath();
    ink(ctx, color, dark(color, 0.62), lw);
    ctx.save(); // the pleats: dark folds between the swags, a lit stripe on each
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-e + i * e / 2 - 0.09 * e, -e, 0.18 * e, 2.4 * e);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(-e + (i + 0.5) * e / 2 - 0.07 * e, -e, 0.14 * e, 2.4 * e);
    }
    ctx.restore();
    box(ctx, -e, -e, 2 * e, 0.34 * e, 0.1 * u, oc.gold, dark(oc.brass, 0.6), lw); // the rail
    if (info) gemMark(ctx, 0, 0.2 * e, 0.56 * u, cell.color, theme, dark(color, 0.62));
  },
};

// ---- The floor layer: confetti or petals lying on a cell, under its content. ----
// A floor must show even with a gem sitting on it, and a gem covers the
// middle of its cell. So the WHOLE cell is filled with a strong color and
// gets a patterned border right at its edge:
//   Confetti  bright yellow, with a border of red, blue and green dashes
//   Petals    strong pink, with a dark pink scalloped border
// (x0, y0) is the cell's top-left corner; `seed` only varies the colors.
function drawFloor(ctx, kind, x0, y0, cell, theme, seed) {
  if (drawArt(ctx, kind, x0 + cell / 2, y0 + cell / 2, cell, cell)) return;
  const oc = theme.obstacleColors || {};
  const confetti = kind === 'confetti';
  if (!confetti && kind !== 'petals') return; // a floor kind not known here
  const gap = cellGap(cell);
  const side = cell - gap * 2;
  const band = Math.max(2.5, cell * 0.1); // how wide the border is
  ctx.save();
  roundRect(ctx, x0 + gap, y0 + gap, side, side, cell * 0.14);
  ctx.fillStyle = confetti ? oc.confettiFill : oc.petalFill;
  ctx.fill();
  ctx.clip(); // nothing below may spill out of the cell
  if (confetti) {
    // The border: one line round the cell, drawn three times as dashes in
    // three colors, each shifted along so the colors follow one another.
    const colors = [oc.confettiA, oc.confettiB, oc.confettiC];
    const dash = (side - band) / 6; // six dashes fit along each side
    ctx.lineWidth = band;
    ctx.lineCap = 'butt';
    ctx.setLineDash([dash, dash * 2]);
    colors.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineDashOffset = -i * dash;
      ctx.strokeRect(x0 + gap + band / 2, y0 + gap + band / 2, side - band, side - band);
    });
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // A few big dots in the middle, for a cell with nothing standing on it.
    [[0.32, 0.36], [0.66, 0.34], [0.5, 0.62], [0.3, 0.68], [0.7, 0.66]].forEach(([fx, fy], i) => {
      ctx.fillStyle = [oc.confettiA, oc.confettiB, oc.confettiC, oc.confettiD][(i + seed) % 4];
      dot(ctx, x0 + fx * cell, y0 + fy * cell, cell * 0.06);
    });
  } else {
    // The border: a row of dark pink half-circles along every side.
    ctx.fillStyle = oc.petalEdge;
    const n = 5;
    const r = side / (n * 2);
    for (let i = 0; i < n; i++) {
      const along = gap + r + i * 2 * r;
      dot(ctx, x0 + along, y0 + gap, r * 0.86);
      dot(ctx, x0 + along, y0 + cell - gap, r * 0.86);
      dot(ctx, x0 + gap, y0 + along, r * 0.86);
      dot(ctx, x0 + cell - gap, y0 + along, r * 0.86);
    }
    // A few loose petals in the middle, for a cell with nothing standing on it.
    [[0.36, 0.34, 1.0], [0.66, 0.5, -0.5], [0.4, 0.7, -0.1]].forEach(([fx, fy, turn]) => {
      ctx.beginPath();
      ctx.ellipse(x0 + fx * cell, y0 + fy * cell, cell * 0.11, cell * 0.06, turn, 0, TAU);
      ctx.fill();
    });
  }
  ctx.restore();
}

// ---- Small pictures for the targets that are not obstacles themselves. ----
// Each is drawn around (0, 0) with the usual unit "u".
const ICONS = {
  // Dove: a small white bird on a pale blue disc (so the white shows).
  dove(ctx, u, oc) {
    ctx.fillStyle = oc.ice;
    dot(ctx, 0, 0, 0.98 * u);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = dark(oc.coteEdge, 0.5);
    ctx.lineWidth = edgeW(u) * 0.7;
    ctx.lineJoin = 'round';
    ctx.beginPath(); // the tail
    ctx.moveTo(-0.3 * u, 0.1 * u);
    ctx.lineTo(-0.82 * u, 0.02 * u);
    ctx.lineTo(-0.74 * u, 0.4 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // the body
    ctx.ellipse(0, 0.16 * u, 0.5 * u, 0.32 * u, -0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // the head
    ctx.arc(0.44 * u, -0.2 * u, 0.22 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // the raised wing
    ctx.moveTo(-0.24 * u, 0.1 * u);
    ctx.quadraticCurveTo(-0.3 * u, -0.7 * u, 0.12 * u, -0.74 * u);
    ctx.quadraticCurveTo(0.2 * u, -0.2 * u, 0.2 * u, 0.12 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = oc.brass; // the beak
    ctx.beginPath();
    ctx.moveTo(0.64 * u, -0.26 * u);
    ctx.lineTo(0.86 * u, -0.16 * u);
    ctx.lineTo(0.64 * u, -0.1 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = oc.ink; // the eye
    dot(ctx, 0.48 * u, -0.24 * u, 0.045 * u);
  },

  // Popcorn: a red-and-white striped tub heaped with popcorn.
  popcorn(ctx, u, oc) {
    lump(ctx, [[-0.4, -0.3, 0.28], [0, -0.42, 0.28], [0.4, -0.3, 0.28], [-0.2, -0.62, 0.26], [0.22, -0.62, 0.26]],
      u, u, oc.candyB, dark(oc.brass, 0.5), edgeW(u) * 0.7);
    const tub = () => {
      ctx.beginPath();
      ctx.moveTo(-0.72 * u, -0.22 * u);
      ctx.lineTo(0.72 * u, -0.22 * u);
      ctx.lineTo(0.5 * u, 0.94 * u);
      ctx.lineTo(-0.5 * u, 0.94 * u);
      ctx.closePath();
    };
    ctx.fillStyle = '#ffffff';
    tub();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = oc.roof;
    for (const x of [-0.6, -0.12, 0.36]) ctx.fillRect(x * u, -0.22 * u, 0.24 * u, 1.16 * u);
    ctx.restore();
    ctx.strokeStyle = dark(oc.roof, 0.62);
    ctx.lineWidth = edgeW(u);
    ctx.lineJoin = 'round';
    tub();
    ctx.stroke();
  },

  // Candy: a round wrapped sweet with a twist of paper at each end.
  candy(ctx, u, oc) {
    const lw = edgeW(u);
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      poly(ctx, [[side * 0.4, 0], [side * 0.98, -0.46], [side * 0.98, 0.46]], u, u,
        oc.candyB, dark(oc.brass, 0.5), lw * 0.8);
    }
    disc(ctx, 0, 0, 0.58 * u, oc.candyA, dark(oc.candyA, 0.55), lw);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.12 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 0.3 * u, 0.4, 0.4 + Math.PI);
    ctx.stroke();
  },
};

// The rendered picture of an obstacle, if there is one, with the gems it asks
// for drawn on top. The middle of the obstacle is at (0, 0).
function blockArt(ctx, cell, hp, w, h, size, theme, plain) {
  const kind = cell.kind;
  const colored = kind === 'paint' || kind === 'curtain';
  const color = Number.isInteger(cell.color) ? cell.color : -1;
  if (colored && color < 0 && !hasArt(kind)) return false;
  const names = [];
  if (kind === 'truss') names.push('truss' + w + (hp < 2 ? '-1' : ''));
  if (kind === 'makeupcase') names.push(kind + (cell.open || plain ? '-open' : '-closed'));
  if (colored) names.push(kind + '-' + color);
  names.push(kind + '-' + hp, kind);
  const name = names.find(hasArt);
  if (!name || !drawArt(ctx, name, 0, 0, w * size, h * size)) return false;
  const gem = (c, x, y, s) => drawPiece(ctx, c, x * size, y * size, s * size, theme);
  if (colored && color >= 0) gem(color, 0, 0, kind === 'paint' ? 0.38 : 0.5);
  const colors = Array.isArray(cell.colors) ? cell.colors : plain ? [0, 1, 2, 3] : [];
  if (kind === 'footlights') colors.slice(0, 4).forEach((c, i) => gem(c, (i % 2) - 0.5, (i >> 1) - 0.5, 0.52));
  if (kind === 'fireworks') colors.slice(0, 3).forEach((c, i) => gem(c, (i - 1) * 0.6, 0, 0.44));
  return true;
}

// Draw one batch-2 obstacle. (cx, cy) is the middle of its anchor cell (the
// top-left cell of a big block) and `size` is the width of one cell; a big
// block spreads right and down from there over its w x h cells.
function drawBlock2(ctx, cell, cx, cy, size, theme, plain) {
  const oc = theme.obstacleColors || {};
  const std = BIG_SIZE[cell.kind] || [1, 1];
  const w = Number.isInteger(cell.w) && cell.w > 0 ? cell.w : std[0];
  const h = Number.isInteger(cell.h) && cell.h > 0 ? cell.h : std[1];
  const u = size * 0.42;
  const lw = edgeW(u);
  const a = (w * size) / 2 - size * 0.08; // half the width of the drawing
  const b = (h * size) / 2 - size * 0.08; // half its height
  // How many hits it needs when new, how many are left, how many have landed.
  const def = OBSTACLES2[cell.kind];
  const hits = def && Array.isArray(def.hits) ? def.hits : [];
  const full = hits.length;
  const hp = plain || typeof cell.hp !== 'number' ? full : Math.max(0, Math.min(full, cell.hp));
  const taken = full - hp;
  ctx.save();
  ctx.translate(cx + ((w - 1) * size) / 2, cy + ((h - 1) * size) / 2); // middle of the area
  ctx.lineJoin = 'round';
  if (!blockArt(ctx, cell, hp, w, h, size, theme, plain)) BLOCKS2[cell.kind](ctx, { a, b, u, lw, oc, cell, theme, plain, hp, taken });

  if (!plain) {
    // Top left: the lightning badge while the next hit must be a power-up.
    if (hits[taken] === 'power') powerMark(ctx, -a + 0.3 * u, -b + 0.3 * u, 0.38 * u, oc);
    // Bottom right: the number of hits left, or (for the two obstacles that
    // never break) the pie that shows how far along the next gift is.
    if (hp > 1) hitBadge(ctx, a - 0.3 * u, b - 0.3 * u, 0.42 * u, hp, oc);
    else if (def && def.generator) pieBadge(ctx, a - 0.3 * u, b - 0.3 * u, 0.42 * u, (cell.count | 0) % 3, oc);
  }
  ctx.restore();
}

// Draw one obstacle centered at (cx, cy).
// With plain = true it is drawn whole and new, with no badges and nothing
// inside it (used for the small target pictures).
function drawBlock(ctx, cell, cx, cy, size, theme, plain) {
  // Batch-2 kinds (and big blocks) have their own drawing routine.
  if (Object.hasOwn(BLOCKS2, cell.kind)) { drawBlock2(ctx, cell, cx, cy, size, theme, plain); return; }
  const oc = theme.obstacleColors || {};
  const u = size * 0.42;
  const lw = edgeW(u);
  // How many hits it needs when new, how many are left, how many have landed.
  const info = OBSTACLES[cell.kind];
  const hits = info && Array.isArray(info.hits) ? info.hits : [];
  const full = hits.length || 1;
  const hp = plain || typeof cell.hp !== 'number' ? full : Math.max(0, Math.min(full, cell.hp));
  const taken = full - hp;
  const o = { a: u, b: u, u, lw, oc, cell, theme, plain, hp, taken };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';

  if (cell.kind === 'padlock') {
    const holds = !plain && cell.inside;
    if (holds) {
      // The padlock holds something. Draw that thing first (so its color
      // and shape still show), then two chains crossed over it, then a
      // smaller lock in the middle.
      drawContent(ctx, cell.inside, 0, 0, size, theme);
      if (!drawArt(ctx, 'padlock', 0, 0, size, size)) {
      ctx.save();
      roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.14);
      ctx.clip(); // the chains stop at the edge of the cell
      for (const dir of [1, -1]) {
        pipe(ctx, () => { ctx.moveTo(-size / 2, -dir * size / 2); ctx.lineTo(size / 2, dir * size / 2); },
          0.15 * u, oc.chain, oc.chainDark, lw * 0.75);
      }
      ctx.restore();
      const small = u * 0.5;
      ctx.translate(0, 0.14 * u);
      BLOCKS.padlock(ctx, { ...o, u: small, lw: edgeW(small) });
      ctx.translate(0, -0.14 * u);
      }
    } else if (!drawArt(ctx, 'padlock', 0, 0, size, size)) BLOCKS.padlock(ctx, o);
  } else if (blockArt(ctx, cell, hp, 1, 1, size, theme, plain)) {
    // drawn from its rendered picture
  } else if (BLOCKS[cell.kind]) {
    BLOCKS[cell.kind](ctx, o);
  } else {
    // An obstacle kind this file does not know yet: a plain grey box.
    box(ctx, -0.9 * u, -0.9 * u, 1.8 * u, 1.8 * u, 0.16 * u, oc.paintNone || '#8c95a6', oc.badge, lw);
  }

  if (!plain) {
    // Top left: the lightning badge while the next hit must be a power-up.
    if (hits[taken] === 'power') powerMark(ctx, -0.72 * u, -0.72 * u, 0.38 * u, oc);
    // Bottom right: the number of hits left, when more than one.
    if (hp > 1) hitBadge(ctx, 0.72 * u, 0.72 * u, 0.42 * u, hp, oc);
  }
  ctx.restore();
}

// Sandbag (the dropper): a heavy tan sack with a flat bottom, tied at the
// neck, hanging from a rope ring, with a big white DOWN arrow: it has to be
// brought down to the bottom of its column.
function drawDrop(ctx, cx, cy, size, theme) {
  if (drawArt(ctx, DROPPER.id, cx, cy, size, size)) return;
  const oc = theme.obstacleColors || {};
  const u = size * 0.42;
  const lw = edgeW(u);
  const edge = oc.sackBand;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  disc(ctx, 0, -0.8 * u, 0.15 * u, null, edge, 0.14 * u); // the rope ring
  ctx.beginPath();                                        // the sack
  ctx.moveTo(-0.3 * u, -0.6 * u);
  ctx.bezierCurveTo(-0.5 * u, -0.3 * u, -1.04 * u, 0.2 * u, -0.9 * u, 0.74 * u);
  ctx.quadraticCurveTo(-0.84 * u, 0.98 * u, -0.56 * u, 0.98 * u);
  ctx.lineTo(0.56 * u, 0.98 * u);
  ctx.quadraticCurveTo(0.84 * u, 0.98 * u, 0.9 * u, 0.74 * u);
  ctx.bezierCurveTo(1.04 * u, 0.2 * u, 0.5 * u, -0.3 * u, 0.3 * u, -0.6 * u);
  ctx.closePath();
  ink(ctx, oc.sack, edge, lw);
  box(ctx, -0.4 * u, -0.72 * u, 0.8 * u, 0.24 * u, 0.1 * u, oc.sackDark, edge, lw * 0.7); // the tie
  // The down arrow.
  poly(ctx, [[-0.16, -0.22], [0.16, -0.22], [0.16, 0.24], [0.46, 0.24], [0, 0.8], [-0.46, 0.24], [-0.16, 0.24]],
    u, u, '#ffffff', edge, lw * 0.8);
  ctx.restore();
}

// Draw whatever is in a cell (piece, power-up, obstacle or sandbag)
// centered at (cx, cy).
function drawContent(ctx, cell, cx, cy, size, theme) {
  if (!cell) return;
  if (cell.t === 'piece') {
    const special = cell.fuse !== undefined || cell.mimic;
    drawPiece(ctx, cell.color, cx, cy, special ? size * 0.88 : size, theme);
    if (cell.mimic && !drawArt(ctx, 'mimic', cx, cy, size, size)) {
      ctx.strokeStyle = '#ff5bd0'; ctx.lineWidth = size * 0.08; ctx.beginPath(); ctx.arc(cx, cy, size * 0.44, 0, TAU); ctx.stroke();
    }
    if (cell.fuse !== undefined) {
      const bx = cx + size * 0.25;
      const by = cy + size * 0.25;
      if (!drawArt(ctx, 'fuse', cx, cy, size, size)) { ctx.fillStyle = '#1b2030'; dot(ctx, bx, by, size * 0.22); }
      ctx.fillStyle = cell.fuse <= 2 ? '#ff5a4d' : '#ffffff';
      ctx.font = `800 ${Math.round(size * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.fuse), bx, by + size * 0.01);
    }
  }
  else if (cell.t === 'power') drawPower(ctx, cell.kind, cx, cy, size, theme);
  else if (cell.t === 'block') drawBlock(ctx, cell, cx, cy, size, theme, false);
  else if (cell.t === 'drop') drawDrop(ctx, cx, cy, size, theme);
  // { t: 'empty' } has nothing to draw: the plain cell square shows.
}

// A small picture of a power-up, filling a square of side `size` whose
// top-left corner is at (0, 0). Used on the Home screen for the streak gift.
// `opts` is optional: { superPrism: true } draws the Super Magic Ball.
export function drawPowerIcon(ctx, kind, size, theme, opts) {
  drawPower(ctx, kind, size / 2, size / 2, size, theme,
    { superPrism: !!(opts && opts.superPrism) });
}

// A small picture of what a target asks for, filling a square of side
// `size` whose top-left corner is at (0, 0).
//   { color: n }     -> that piece
//   { block: kind }  -> that obstacle ('sandbag' -> the sandbag)
export function drawTargetIcon(ctx, target, size, theme) {
  if (!target) return;
  const mid = size / 2;
  if (typeof target.block === 'string') {
    const kind = target.block;
    const oc = theme.obstacleColors || {};
    if (kind === DROPPER.id) drawDrop(ctx, mid, mid, size, theme);
    else if (['propbomb', 'chameleon', 'treasure', 'revolve'].includes(kind)) {
      // Twists that are not obstacles.
      drawArt(ctx, kind === 'revolve' ? 'turntable2' : kind, mid, mid, size, size);
    }
    else if (kind === 'confetti' || kind === 'petals') {
      // A floor target: one cell with that floor on it, and a dark line
      // round it so the small picture has a clear edge.
      drawFloor(ctx, kind, 0, 0, size, theme, 0);
      const g = cellGap(size);
      ctx.strokeStyle = dark(kind === 'confetti' ? oc.confettiEdge : oc.petalEdge, 0.45);
      ctx.lineWidth = Math.max(1, size * 0.05);
      roundRect(ctx, g, g, size - g * 2, size - g * 2, size * 0.14);
      ctx.stroke();
    } else if (Object.hasOwn(ICONS, kind) && hasArt(kind)) {
      drawArt(ctx, kind, mid, mid, size, size);
    } else if (Object.hasOwn(ICONS, kind)) {
      // Something a generator gives out: dove, popcorn or candy.
      ctx.save();
      ctx.translate(mid, mid);
      ICONS[kind](ctx, size * 0.42, oc);
      ctx.restore();
    } else if (BIG_SIZE[kind]) {
      // A big block: shrink it so its whole w x h area fits in the square.
      // (The long thin ones are drawn only 2 cells wide here; at their real
      // 3-cell width they would come out too small to make out.)
      const [w, h] = BIG_SIZE[kind][1] === 1 ? [2, 1] : BIG_SIZE[kind];
      const s = size / Math.max(w, h);
      drawBlock(ctx, { t: 'block', kind, w, h }, mid - ((w - 1) * s) / 2, mid - ((h - 1) * s) / 2, s, theme, true);
    } else drawBlock(ctx, { t: 'block', kind: target.block, color: target.color }, mid, mid, size, theme, true);
  } else if (typeof target.color === 'number') {
    drawPiece(ctx, target.color, mid, mid, size, theme);
  }
}

const key = (x, y) => x + ',' + y;

// One cell's content on its own (used by ui/stage.js to make its pictures).
export function drawCellPicture(ctx, cell, cx, cy, size, theme, opts) {
  if (cell.t === 'power') drawPower(ctx, cell.kind, cx, cy, size, theme, { bare: !!opts.bare, superPrism: !!opts.superPrism });
  else drawContent(ctx, cell, cx, cy, size, theme);
}

// The tray the board sits in, its cells, and the floor layer.
export function drawTray(ctx, board, layout, theme, shade) {
  const { originX, originY, cell } = layout;
  const ui = theme.ui;
  // THE TRAY: one solid tinted slab under the playable cells only, with a
  // crisp dark line all the way round it, and round every hole inside it.
  // A hole (a spot where gems never go) gets nothing at all: the plain page
  // shows there, so it reads as a gap you can see through.
  ctx.lineJoin = 'round';
  // With shade = true only a white shape of the tray is drawn (ui/stage.js
  // tints it dark to dim the board behind a power-up going off).
  if (shade) {
    traceTray(ctx, board, layout);
    ctx.fillStyle = '#ffffff';
    ctx.fill('evenodd');
    return;
  }
  // First the same shape in the dark edge color, a few pixels lower: it
  // shows as a dark lip under the tray and along the top of every hole, so
  // the tray looks like a raised slab with the holes cut right through it.
  const lip = Math.min(4, cell * 0.11);
  ctx.save();
  ctx.translate(0, lip);
  traceTray(ctx, board, layout);
  ctx.fillStyle = ui.boardEdge || ui.text;
  ctx.fill('evenodd');
  ctx.restore();
  traceTray(ctx, board, layout);
  ctx.fillStyle = ui.board || ui.tray || ui.panel;
  ctx.fill('evenodd');
  ctx.strokeStyle = ui.boardEdge || ui.text;
  ctx.lineWidth = Math.max(2, Math.min(3, cell * 0.065)); // 2 to 3 px
  ctx.stroke();

  // The lighter square inside every playable cell, so the grid reads.
  // An empty cell is just this square.
  const gap = cellGap(cell);
  ctx.fillStyle = ui.boardCell || ui.cell;
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      if (get(board, x, y) === null) continue;
      roundRect(ctx, originX + x * cell + gap, originY + y * cell + gap,
        cell - gap * 2, cell - gap * 2, cell * 0.14);
      ctx.fill();
    }
  }

  // Revolving stages, and treasure lying under the confetti.
  for (const r of board.revolves || []) {
    const w = r.size * cell;
    drawArt(ctx, 'turntable' + r.size, originX + r.x * cell + w / 2, originY + r.y * cell + w / 2, w, w);
  }
  for (const t of board.hidden || []) {
    if (!t.found) drawArt(ctx, 'treasure', originX + (t.x + t.w / 2) * cell, originY + (t.y + t.h / 2) * cell, t.w * cell, t.h * cell);
  }

  // The floor layer (confetti, petals), on top of the lighter squares and
  // under everything else. A board saved before floors existed has no
  // `floor` list: that means no floor anywhere.
  if (Array.isArray(board.floor)) {
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        const kind = board.floor[y * board.cols + x];
        if (!kind || get(board, x, y) === null) continue;
        drawFloor(ctx, kind, originX + x * cell, originY + y * cell, cell, theme, x + y * 3);
      }
    }
  }
}

// Draw the whole board.
// `overlay` is optional and is only used by the animations:
//   offsets  Map of "x,y" -> { dx, dy }: draw that cell's content shifted by
//            this many cells (used for falling and swapping)
//   ghosts   list of { x, y, cell, scale }: extra pieces drawn on top,
//            shrunk (used for pieces that are being cleared)
//   flashes  list of { x, y, alpha }: a brief white flash over a cell
//            (used when an obstacle is hit)
//   pressed  { x, y }: the cell under the player's finger
//   superPrism  true while the level is in Super Magic Ball mode
//   hide     Set of "x,y": do not draw that cell's content (an animation is
//            drawing it itself, as a sprite)
//   sprites  list of { cell, x, y, scale, sx, rot, flash, bare }: loose
//            pieces drawn on top at cell position (x, y), which may be a
//            fraction; scale = size, sx = sideways squeeze (for a flip),
//            rot = turn in radians, flash = strength of a white flash (0-1)
//   fx       list of light effects (see drawFx below)
// An entry in `offsets` may also carry { sx, sy }: stretch the piece by
// these amounts, standing on the bottom of its cell (the landing bounce).
export function drawBoard(ctx, board, layout, theme, overlay) {
  const { originX, originY, cell } = layout;
  const ui = theme.ui;
  const offsets = overlay && overlay.offsets;
  const hide = overlay && overlay.hide;
  superMode = !!(overlay && overlay.superPrism);

  // Flat background over the whole canvas.
  ctx.fillStyle = ui.background;
  ctx.fillRect(0, 0, layout.canvasW ?? ctx.canvas.width, layout.canvasH ?? ctx.canvas.height);
  if (!board) return;

  drawTray(ctx, board, layout, theme);
  const gap = cellGap(cell);

  // A soft ring on the cell being pressed.
  if (overlay && overlay.pressed) {
    const p = overlay.pressed;
    ctx.strokeStyle = ui.accent;
    ctx.lineWidth = Math.max(2, cell * 0.06);
    roundRect(ctx, originX + p.x * cell + gap, originY + p.y * cell + gap,
      cell - gap * 2, cell - gap * 2, cell * 0.16);
    ctx.stroke();
  }

  // The pieces. Nothing is allowed to show outside the board's rectangle
  // (new pieces slide in from above it).
  ctx.save();
  ctx.beginPath();
  ctx.rect(originX, originY, cell * board.cols, cell * board.rows);
  ctx.clip();
  const moving = []; // shifted cells are drawn last so they pass over the others
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const c = get(board, x, y);
      if (!c || c.t === 'empty') continue;
      if (hide && hide.has(key(x, y))) continue;
      const off = offsets && offsets.get(key(x, y));
      if (off) { moving.push({ x, y, c, off }); continue; }
      drawContent(ctx, c, originX + (x + 0.5) * cell, originY + (y + 0.5) * cell, cell, theme);
    }
  }
  for (const m of moving) {
    const mx = originX + (m.x + m.off.dx + 0.5) * cell;
    const my = originY + (m.y + m.off.dy + 0.5) * cell;
    if (m.off.sx > 0 && m.off.sy > 0 && (m.off.sx !== 1 || m.off.sy !== 1)) {
      // Squashed or stretched, standing on the bottom edge of its cell.
      ctx.save();
      ctx.translate(mx, my + cell / 2);
      ctx.scale(m.off.sx, m.off.sy);
      drawContent(ctx, m.c, 0, -cell / 2, cell, theme);
      ctx.restore();
    } else drawContent(ctx, m.c, mx, my, cell, theme);
  }
  if (overlay && overlay.fx) drawFx(ctx, overlay.fx, layout, board, theme, true);
  if (overlay && overlay.ghosts) {
    for (const g of overlay.ghosts) {
      if (!(g.scale > 0.02)) continue;
      drawContent(ctx, g.cell, originX + (g.x + 0.5) * cell, originY + (g.y + 0.5) * cell,
        cell * g.scale, theme);
    }
  }
  if (overlay && overlay.flashes) {
    for (const f of overlay.flashes) {
      if (!(f.alpha > 0.02)) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(0.85, f.alpha * 0.85) + ')';
      roundRect(ctx, originX + f.x * cell + gap, originY + f.y * cell + gap,
        cell - gap * 2, cell - gap * 2, cell * 0.16);
      ctx.fill();
    }
  }
  if (overlay && overlay.sprites) {
    for (const s of overlay.sprites) {
      if (!s || !s.cell || !(s.scale > 0.02)) continue;
      const sx = s.sx === undefined ? 1 : s.sx;
      if (!(Math.abs(sx) > 0.02)) continue; // edge-on in a flip: nothing to see
      ctx.save();
      ctx.translate(originX + (s.x + 0.5) * cell, originY + (s.y + 0.5) * cell);
      if (s.rot) ctx.rotate(s.rot);
      ctx.scale(s.scale * sx, s.scale);
      if (s.cell.t === 'power' && s.bare) drawPower(ctx, s.cell.kind, 0, 0, cell, theme, { bare: true });
      else drawContent(ctx, s.cell, 0, 0, cell, theme);
      if (s.flash > 0.02) { // the white flash of a gem as it pops
        ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(0.9, s.flash) + ')';
        dot(ctx, 0, 0, cell * 0.42);
      }
      ctx.restore();
    }
  }
  if (overlay && overlay.fx) drawFx(ctx, overlay.fx, layout, board, theme, false);
  ctx.restore();
}

// The light effects of the power-ups. Each entry of `list` is one of:
//   { type: 'streak', x, y, dir: 'h' | 'v', p, alpha, big }
//       a Missile: a bright bar growing both ways from cell (x, y) along its
//       row ('h') or column ('v'); p = 0..1 how far it has got
//   { type: 'ring', x, y, radius, p, alpha, big }
//       a Grenade or a combo: a ring growing from cell (x, y) out to
//       `radius` cells, over a fading flash
//   { type: 'beams', x, y, to: [{ x, y }], p, alpha }
//       a Magic Ball: thin beams from cell (x, y) to every cell in `to`
// alpha (0..1) fades the whole effect; big = the stronger combo version.
// Flashes and beams are drawn under the loose pieces (`under` = true), the
// streak and the ring line over them.
function drawFx(ctx, list, layout, board, theme, under) {
  const { originX, originY, cell } = layout;
  const pc = theme.powerColors || {};
  const px = (x) => originX + (x + 0.5) * cell;
  const py = (y) => originY + (y + 0.5) * cell;
  for (const f of list) {
    if (!f || !(f.alpha > 0.02)) continue;
    const p = Math.max(0, Math.min(1, f.p));
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.alpha);
    ctx.lineCap = 'round';
    if (f.type === 'streak' && !under) {
      const horizontal = f.dir !== 'v';
      // How far the bar reaches each way: to the far edge of the board.
      const span = horizontal ? Math.max(f.x + 1, board.cols - f.x) : Math.max(f.y + 1, board.rows - f.y);
      const reach = p * span * cell;
      const thick = cell * (f.big ? 0.7 : 0.42);
      ctx.translate(px(f.x), py(f.y));
      if (!horizontal) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = pc.streakGlow || 'rgba(255, 170, 40, 0.55)';
      roundRect(ctx, -reach, -thick / 2, reach * 2, thick, thick / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -reach, -thick * 0.22, reach * 2, thick * 0.44, thick * 0.22);
      ctx.fill();
      for (const side of [-1, 1]) dot(ctx, side * reach, 0, thick * 0.55); // the two bright heads
    } else if (f.type === 'ring') {
      const rad = Math.max(0.1, p * f.radius) * cell;
      if (under) {
        ctx.globalAlpha = Math.min(1, f.alpha) * (f.big ? 0.6 : 0.4) * (1 - p * 0.6);
        ctx.fillStyle = pc.blast || '#ffb020';
        dot(ctx, px(f.x), py(f.y), rad);
      } else {
        for (const [color, width] of [[pc.blast || '#ffb020', 0.3], ['#ffffff', 0.14]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = cell * width * (f.big ? 1.5 : 1);
          ctx.beginPath();
          ctx.arc(px(f.x), py(f.y), rad, 0, TAU);
          ctx.stroke();
        }
      }
    } else if (f.type === 'beams' && under && Array.isArray(f.to)) {
      for (const [color, width] of [[pc.beam || '#b07cff', 0.16], ['#ffffff', 0.07]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, cell * width * (f.big ? 1.5 : 1));
        ctx.beginPath();
        for (const t of f.to) {
          ctx.moveTo(px(f.x), py(f.y));
          ctx.lineTo(px(f.x + (t.x - f.x) * p), py(f.y + (t.y - f.y) * p));
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
