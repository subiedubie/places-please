// DRAWING: paints the board on the canvas. No game rules here.
//
// All sizes are in "CSS pixels" (the units the page is laid out in).
// fitCanvas() makes the canvas sharp on high-resolution phone screens by
// giving it more real pixels (devicePixelRatio) and scaling the drawing.

import { get } from '../engine/board.js';
import { OBSTACLES, DROPPER } from '../config/obstacles.js';

const TAU = Math.PI * 2;
const SHADE = 'rgba(0, 0, 0, 0.28)';      // darker detail drawn on a piece
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
    outline: [[-0.58, -0.92], [0.58, -0.92], [0.92, -0.58], [0.92, 0.58],
      [0.58, 0.92], [-0.58, 0.92], [-0.92, 0.58], [-0.92, -0.58]],
    shrink: 0.55, cy: 0, glint: [-0.22, -0.24],
  },
  // Sapphire: round (a "brilliant" cut), with many small facets.
  sapphire: { outline: ringPoints(16, 0.98), shrink: 0.55, cy: 0, glint: [-0.22, -0.24] },
  // Emerald: a tall rectangle with cut corners and a ring of steps.
  emerald: {
    outline: [[-0.42, -1], [0.42, -1], [0.7, -0.72], [0.7, 0.72],
      [0.42, 1], [-0.42, 1], [-0.7, 0.72], [-0.7, -0.72]],
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
        ? mixColor(color, '#ffffff', 0.55 * l)
        : mixColor(color, '#000000', 0.42 * -l))),
      table: mixColor(color, '#ffffff', 0.14),
      edge: mixColor(color, '#000000', 0.5),
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

// Draw one gem around (0, 0).
function drawGem(ctx, name, r, color) {
  const gem = GEMS[name];
  const look = gemLook(name, color);
  const out = gem.outline;
  const tab = gem.table;
  const n = out.length;
  ctx.lineJoin = 'round';
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
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = Math.max(0.75, r * 0.05);
  ctx.stroke();
  for (const ring of gem.rings) { // the steps of a step cut
    polygon(ctx, ring, r);
    ctx.stroke();
  }
  // A thin dark outline, so the gem stays crisp on a white cell.
  ctx.strokeStyle = look.edge;
  ctx.lineWidth = Math.max(1, r * 0.1);
  polygon(ctx, out, r);
  ctx.stroke();
  // One small white glint.
  sparkle(ctx, gem.glint[0] * r, gem.glint[1] * r, 0.22 * r, '#ffffff');
}

const SHAPES = {
  topaz: (ctx, r, color) => drawGem(ctx, 'topaz', r, color),
  ruby: (ctx, r, color) => drawGem(ctx, 'ruby', r, color),
  sapphire: (ctx, r, color) => drawGem(ctx, 'sapphire', r, color),
  emerald: (ctx, r, color) => drawGem(ctx, 'emerald', r, color),
  amethyst: (ctx, r, color) => drawGem(ctx, 'amethyst', r, color),
  // The names the pieces had before they were gems, so an older theme file
  // still draws something sensible.
  mask: (ctx, r, color) => drawGem(ctx, 'topaz', r, color),
  quill: (ctx, r, color) => drawGem(ctx, 'sapphire', r, color),
  lantern: (ctx, r, color) => drawGem(ctx, 'emerald', r, color),
  fan: (ctx, r, color) => drawGem(ctx, 'amethyst', r, color),

  rose: (ctx, r, color) => drawGem(ctx, 'ruby', r, color),
};

// Draw one ordinary piece (a gem) centered at (cx, cy). `size` is the width
// of the square it should fit in: the gem fills about 80% of it. Also used
// for the small target pictures.
export function drawPiece(ctx, colorIndex, cx, cy, size, theme) {
  const info = theme.pieces[colorIndex];
  if (!info) return; // a color this theme does not know: draw nothing
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // the bright middle of the tile
    dot(ctx, 0, 0, t * 0.36);
    if (pc.tileEdge) {
      ctx.strokeStyle = pc.tileEdge;
      ctx.lineWidth = Math.max(1, size * 0.045);
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
    ctx.lineWidth = Math.max(1, r * 0.11);
    polygon(ctx, arrow, r);
    ctx.stroke();
    ctx.fillStyle = '#ffffff'; // a white band round the middle
    ctx.fillRect(-0.09 * r, -0.3 * r, 0.18 * r, 0.6 * r);
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
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? tip : waist;
      const ang = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = pc.starCentre || '#e5383b';
    dot(ctx, 0, 0, 0.24 * r);
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; // the shine
    ctx.beginPath();
    ctx.ellipse(-0.36 * r, -0.14 * r, 0.2 * r, 0.3 * r, 0.6, 0, TAU);
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
    ctx.lineWidth = Math.max(1, 0.1 * r);
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

const BLOCKS = {
  // Crate: a square wooden box with a dark frame, two slats and a brace.
  crate(ctx, u, oc) {
    ctx.fillStyle = oc.wood;
    roundRect(ctx, -u, -u, 2 * u, 2 * u, 0.14 * u);
    ctx.fill();
    ctx.strokeStyle = oc.woodDark;
    ctx.lineWidth = 0.16 * u;
    roundRect(ctx, -0.92 * u, -0.92 * u, 1.84 * u, 1.84 * u, 0.1 * u);
    ctx.stroke();
    ctx.lineWidth = 0.07 * u;
    line(ctx, -0.84 * u, -0.3 * u, 0.84 * u, -0.3 * u);
    line(ctx, -0.84 * u, 0.3 * u, 0.84 * u, 0.3 * u);
    ctx.lineWidth = 0.14 * u;
    line(ctx, -0.8 * u, 0.8 * u, 0.8 * u, -0.8 * u);
  },

  // Hatbox: a striped round box seen from the side, with a wider lid and a knob.
  hatbox(ctx, u, oc) {
    ctx.fillStyle = oc.hatbox;
    roundRect(ctx, -0.8 * u, -0.3 * u, 1.6 * u, 1.25 * u, 0.12 * u);
    ctx.fill();
    ctx.save(); // keep the stripes inside the body
    ctx.clip();
    ctx.fillStyle = oc.hatStripe;
    for (const c of [-0.5, 0, 0.5]) ctx.fillRect((c - 0.11) * u, -0.3 * u, 0.22 * u, 1.25 * u);
    ctx.restore();
    ctx.strokeStyle = oc.hatStripe;
    ctx.lineWidth = 0.06 * u;
    roundRect(ctx, -0.8 * u, -0.3 * u, 1.6 * u, 1.25 * u, 0.12 * u);
    ctx.stroke();
    ctx.fillStyle = oc.hatStripe;
    roundRect(ctx, -0.95 * u, -0.62 * u, 1.9 * u, 0.42 * u, 0.12 * u);
    ctx.fill();
    dot(ctx, 0, -0.72 * u, 0.17 * u);
  },

  // Trunk: a wide dark travel trunk with a handle, two straps and a brass latch.
  trunk(ctx, u, oc) {
    ctx.strokeStyle = oc.trunk;
    ctx.lineWidth = 0.12 * u;
    ctx.beginPath();
    ctx.arc(0, -0.62 * u, 0.3 * u, Math.PI, 0); // the handle on top
    ctx.stroke();
    ctx.fillStyle = oc.trunk;
    roundRect(ctx, -u, -0.62 * u, 2 * u, 1.5 * u, 0.16 * u);
    ctx.fill();
    ctx.fillStyle = oc.strap;
    ctx.fillRect(-0.64 * u, -0.62 * u, 0.22 * u, 1.5 * u);
    ctx.fillRect(0.42 * u, -0.62 * u, 0.22 * u, 1.5 * u);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; // where the lid meets the body
    ctx.lineWidth = 0.07 * u;
    line(ctx, -u, -0.12 * u, u, -0.12 * u);
    ctx.fillStyle = oc.brass;
    roundRect(ctx, -0.15 * u, -0.26 * u, 0.3 * u, 0.36 * u, 0.05 * u);
    ctx.fill();
  },

  // Paint Can: a can filled with one piece color, with that piece's shape
  // in white on the front, so it is clear which color match opens it.
  paint(ctx, u, oc, cell, theme) {
    const info = theme.pieces[cell.color];
    ctx.strokeStyle = oc.tin;
    ctx.lineWidth = 0.1 * u;
    ctx.beginPath();
    ctx.arc(0, -0.5 * u, 0.5 * u, Math.PI, 0); // the wire handle
    ctx.stroke();
    ctx.fillStyle = info ? info.color : oc.paintNone;
    roundRect(ctx, -0.72 * u, -0.5 * u, 1.44 * u, 1.42 * u, 0.1 * u);
    ctx.fill();
    ctx.fillStyle = oc.tin; // metal rims top and bottom
    ctx.fillRect(-0.8 * u, -0.56 * u, 1.6 * u, 0.2 * u);
    ctx.fillRect(-0.76 * u, 0.78 * u, 1.52 * u, 0.16 * u);
    if (info) {
      ctx.save();
      ctx.translate(0, 0.21 * u);
      (SHAPES[info.shape] || SHAPES.rose)(ctx, 0.36 * u, '#ffffff');
      ctx.restore();
    }
  },

  // Dry Ice: a pale blue frosted block with white shine marks and a frost star.
  dryice(ctx, u, oc) {
    ctx.fillStyle = oc.ice;
    roundRect(ctx, -0.9 * u, -0.9 * u, 1.8 * u, 1.8 * u, 0.22 * u);
    ctx.fill();
    ctx.strokeStyle = oc.iceEdge;
    ctx.lineWidth = 0.1 * u;
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.14 * u;
    line(ctx, -0.55 * u, -0.2 * u, -0.2 * u, -0.55 * u);
    line(ctx, -0.55 * u, 0.25 * u, 0.25 * u, -0.55 * u);
    ctx.strokeStyle = oc.iceEdge;
    ctx.lineWidth = 0.07 * u;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      const dx = Math.cos(a) * 0.28 * u;
      const dy = Math.sin(a) * 0.28 * u;
      line(ctx, 0.36 * u - dx, 0.36 * u - dy, 0.36 * u + dx, 0.36 * u + dy);
    }
  },

  // Cash Box: a low steel box with a handle, a coin slot on top and a coin on the front.
  cashbox(ctx, u, oc) {
    ctx.strokeStyle = oc.cashbox;
    ctx.lineWidth = 0.1 * u;
    ctx.beginPath();
    ctx.arc(0, -0.42 * u, 0.26 * u, Math.PI, 0); // the handle
    ctx.stroke();
    ctx.fillStyle = oc.cashbox;
    roundRect(ctx, -0.9 * u, -0.42 * u, 1.8 * u, 1.3 * u, 0.12 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; // where the lid meets the body
    ctx.lineWidth = 0.06 * u;
    line(ctx, -0.9 * u, 0, 0.9 * u, 0);
    ctx.fillStyle = oc.ink; // the coin slot
    roundRect(ctx, -0.36 * u, -0.28 * u, 0.72 * u, 0.13 * u, 0.06 * u);
    ctx.fill();
    ctx.fillStyle = oc.brass; // the coin
    dot(ctx, 0, 0.44 * u, 0.27 * u);
    ctx.fillStyle = SHADE;
    dot(ctx, 0, 0.44 * u, 0.12 * u);
  },

  // Scenery Flat: a section of painted brick wall in a thin wooden frame.
  flat(ctx, u, oc) {
    ctx.fillStyle = oc.wood;
    roundRect(ctx, -u, -u, 2 * u, 2 * u, 0.08 * u);
    ctx.fill();
    const e = 0.86 * u; // half the width of the brick area
    const rowH = e / 2; // four rows of bricks
    ctx.fillStyle = oc.brick;
    ctx.fillRect(-e, -e, 2 * e, 2 * e);
    ctx.strokeStyle = oc.mortar;
    ctx.lineWidth = 0.07 * u;
    for (let i = 1; i < 4; i++) line(ctx, -e, -e + i * rowH, e, -e + i * rowH);
    for (let i = 0; i < 4; i++) {
      const xs = i % 2 === 0 ? [-e / 3, e / 3] : [-2 * e / 3, 0, 2 * e / 3];
      for (const x of xs) line(ctx, x, -e + i * rowH, x, -e + (i + 1) * rowH);
    }
  },

  // Strongbox: a dark safe with a door, a brass dial and a handle.
  strongbox(ctx, u, oc) {
    ctx.fillStyle = oc.safe;
    roundRect(ctx, -0.95 * u, -0.95 * u, 1.9 * u, 1.9 * u, 0.16 * u);
    ctx.fill();
    ctx.fillStyle = oc.safeDoor;
    roundRect(ctx, -0.72 * u, -0.72 * u, 1.44 * u, 1.44 * u, 0.1 * u);
    ctx.fill();
    ctx.fillStyle = oc.brass;
    dot(ctx, -0.12 * u, 0, 0.36 * u);
    ctx.strokeStyle = oc.safe; // the marks around the dial
    ctx.lineWidth = 0.06 * u;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(ctx, -0.12 * u + Math.cos(a) * 0.2 * u, Math.sin(a) * 0.2 * u,
        -0.12 * u + Math.cos(a) * 0.32 * u, Math.sin(a) * 0.32 * u);
    }
    ctx.fillStyle = oc.safe;
    dot(ctx, -0.12 * u, 0, 0.11 * u);
    ctx.fillStyle = oc.tin; // the handle
    roundRect(ctx, 0.4 * u, -0.3 * u, 0.15 * u, 0.6 * u, 0.07 * u);
    ctx.fill();
  },

  // Costume Bag: a round teal drawstring bag with a flared top, a cord and a star.
  costume(ctx, u, oc) {
    ctx.fillStyle = oc.bag;
    ctx.beginPath();
    ctx.moveTo(-0.3 * u, -0.42 * u);
    ctx.bezierCurveTo(-1.05 * u, 0, -0.95 * u, 0.95 * u, 0, 0.95 * u);
    ctx.bezierCurveTo(0.95 * u, 0.95 * u, 1.05 * u, 0, 0.3 * u, -0.42 * u);
    ctx.lineTo(0.55 * u, -0.95 * u);
    ctx.lineTo(-0.55 * u, -0.95 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = oc.cord;
    ctx.lineWidth = 0.12 * u;
    ctx.lineCap = 'round';
    line(ctx, -0.34 * u, -0.44 * u, 0.34 * u, -0.44 * u);
    line(ctx, 0.3 * u, -0.44 * u, 0.56 * u, -0.14 * u); // the loose end of the cord
    ctx.fillStyle = oc.cord; // a five-point star on the front
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = (i % 2 === 0 ? 0.32 : 0.14) * u;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rad, 0.3 * u + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  },

  // Padlock: a brass lock with a steel hoop and a keyhole.
  padlock(ctx, u, oc) {
    ctx.strokeStyle = oc.shackle;
    ctx.lineWidth = 0.22 * u;
    ctx.beginPath();
    ctx.moveTo(-0.42 * u, -0.05 * u);
    ctx.lineTo(-0.42 * u, -0.42 * u);
    ctx.arc(0, -0.42 * u, 0.42 * u, Math.PI, 0);
    ctx.lineTo(0.42 * u, -0.05 * u);
    ctx.stroke();
    ctx.fillStyle = oc.brass;
    roundRect(ctx, -0.72 * u, -0.15 * u, 1.44 * u, 1.1 * u, 0.16 * u);
    ctx.fill();
    ctx.fillStyle = oc.ink; // the keyhole
    dot(ctx, 0, 0.28 * u, 0.15 * u);
    ctx.fillRect(-0.06 * u, 0.3 * u, 0.12 * u, 0.36 * u);
  },
};

// ---- Batch 2 obstacles (docs/OBSTACLES2.md). ----
// Each drawing gets one "box" object:
//   a, b   half the width and half the height of the area it covers
//          (a one-cell obstacle has a = b; a big block covers w x h cells)
//   u      the same unit the batch-1 drawings use (0.42 of one cell)
//   oc     obstacleColors from config/theme.js
//   cell   the board cell (for hp, colors, count, open, color)
//   theme  the theme (for the piece colors and shapes)
//   plain  true for the small target picture: draw it whole and new
// Everything is drawn around (0, 0), the middle of the area.

// How many cells wide and high each big block is when the cell does not say.
const BIG_SIZE = {
  planter: [2, 2], dovecote: [2, 2], footlights: [2, 2],
  fireworks: [2, 1], truss: [3, 1], ticketbooth: [3, 1],
};

// Hits needed when new, for the kinds that show cracks and hit pips.
const FULL_HP2 = { planter: 5, dovecote: 5, truss: 2, ticketbooth: 4 };

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

// A small flower: a colored bloom with a yellow middle.
function bloom(ctx, x, y, r, color, oc) {
  ctx.fillStyle = color;
  dot(ctx, x, y, r);
  ctx.fillStyle = oc.flowerMid;
  dot(ctx, x, y, r * 0.4);
}

// A small progress ring: a white disc with three arc pieces around it,
// `n` of them lit. Used by the Top Hat and the Popcorn Cart.
function progressRing(ctx, x, y, r, n, oc) {
  ctx.fillStyle = '#ffffff';
  dot(ctx, x, y, r);
  ctx.lineWidth = r * 0.42;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 3; i++) {
    const from = -Math.PI / 2 + (i * TAU) / 3 + 0.2;
    ctx.strokeStyle = i < n ? oc.ringOn : oc.ringOff;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.68, from, from + TAU / 3 - 0.4);
    ctx.stroke();
  }
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
  // Planter (2x2): a wooden box with green foliage and flowers growing out.
  planter(ctx, { a, b, oc }) {
    const leaves = [[-0.58, -0.3, 0.4], [0, -0.48, 0.46], [0.58, -0.3, 0.4], [-0.28, -0.08, 0.4], [0.3, -0.08, 0.4]];
    leaves.forEach(([x, y, r], i) => {
      ctx.fillStyle = i % 2 === 0 ? oc.leaf : oc.leafDark;
      dot(ctx, x * a, y * b, r * a);
    });
    const flowers = [[-0.62, -0.45], [0, -0.66], [0.6, -0.42], [-0.24, -0.2], [0.3, -0.24]];
    flowers.forEach(([x, y], i) => {
      bloom(ctx, x * a, y * b, 0.13 * a, [oc.flowerA, oc.flowerB, oc.flowerC][i % 3], oc);
    });
    ctx.fillStyle = oc.wood;
    roundRect(ctx, -0.92 * a, 0.08 * b, 1.84 * a, 0.86 * b, 0.08 * a);
    ctx.fill();
    ctx.strokeStyle = oc.woodDark;
    ctx.lineWidth = 0.07 * a;
    ctx.stroke();
    ctx.lineWidth = 0.04 * a;
    for (const x of [-0.46, 0, 0.46]) line(ctx, x * a, 0.12 * b, x * a, 0.9 * b);
    ctx.fillStyle = oc.woodDark; // the thick rim along the top of the box
    roundRect(ctx, -a, 0.02 * b, 2 * a, 0.18 * b, 0.05 * a);
    ctx.fill();
  },

  // Dovecote (2x2): a small white birdhouse, red roof, round door, a perch.
  dovecote(ctx, { a, b, oc }) {
    ctx.fillStyle = oc.cote;
    roundRect(ctx, -0.68 * a, -0.3 * b, 1.36 * a, 1.2 * b, 0.08 * a);
    ctx.fill();
    ctx.strokeStyle = oc.coteEdge;
    ctx.lineWidth = 0.05 * a;
    ctx.stroke();
    ctx.fillStyle = oc.roof;
    ctx.beginPath();
    ctx.moveTo(-0.98 * a, -0.22 * b);
    ctx.lineTo(0, -0.98 * b);
    ctx.lineTo(0.98 * a, -0.22 * b);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = oc.ink; // the round door
    dot(ctx, 0, 0.18 * b, 0.26 * a);
    ctx.strokeStyle = oc.woodDark; // the perch under the door
    ctx.lineWidth = 0.08 * a;
    ctx.lineCap = 'round';
    line(ctx, -0.3 * a, 0.56 * b, 0.3 * a, 0.56 * b);
  },

  // Lighting Truss (w x 1): two silver rails with zigzag bracing between
  // them, a dark plate at each end and two small lamps hanging below.
  truss(ctx, { a, b, oc }) {
    const top = -0.78 * b;
    const bottom = 0.02 * b;
    ctx.strokeStyle = oc.steelDark;
    ctx.lineWidth = 0.09 * b;
    ctx.lineJoin = 'round';
    const n = Math.max(2, Math.round((2 * a) / (0.8 * b))); // number of zigzag legs
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      ctx.lineTo(-0.94 * a + (1.88 * a * i) / n, i % 2 === 0 ? bottom : top);
    }
    ctx.stroke();
    ctx.fillStyle = oc.steel; // the two rails
    roundRect(ctx, -a, top - 0.1 * b, 2 * a, 0.2 * b, 0.08 * b);
    ctx.fill();
    roundRect(ctx, -a, bottom - 0.1 * b, 2 * a, 0.2 * b, 0.08 * b);
    ctx.fill();
    ctx.fillStyle = oc.steelDark; // the end plates
    ctx.fillRect(-a, top - 0.1 * b, 0.14 * b, bottom - top + 0.2 * b);
    ctx.fillRect(a - 0.14 * b, top - 0.1 * b, 0.14 * b, bottom - top + 0.2 * b);
    for (const side of [-1, 1]) { // the lamps
      const x = side * 0.55 * a;
      ctx.fillStyle = oc.ink;
      ctx.beginPath();
      ctx.moveTo(x - 0.2 * b, 0.12 * b);
      ctx.lineTo(x + 0.2 * b, 0.12 * b);
      ctx.lineTo(x + 0.36 * b, 0.62 * b);
      ctx.lineTo(x - 0.36 * b, 0.62 * b);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = oc.lampLight;
      roundRect(ctx, x - 0.36 * b, 0.58 * b, 0.72 * b, 0.2 * b, 0.08 * b);
      ctx.fill();
    }
  },

  // Ticket Booth (3x1): a striped booth with a sign panel on top and a
  // window. The window has a closed shutter until the first power hit.
  ticketbooth(ctx, { a, b, oc, cell, plain }) {
    const shut = !plain && !(typeof cell.hp === 'number' && cell.hp < FULL_HP2.ticketbooth);
    ctx.fillStyle = oc.booth;
    roundRect(ctx, -a, -0.6 * b, 2 * a, 1.55 * b, 0.14 * b);
    ctx.fill();
    ctx.save(); // keep the stripes inside the body
    ctx.clip();
    ctx.fillStyle = oc.boothStripe;
    const stripe = (2 * a) / 13;
    for (let i = 0; i < 13; i += 2) ctx.fillRect(-a + i * stripe, -0.6 * b, stripe, 1.55 * b);
    ctx.restore();
    // The window: dark glass with a counter, or a grey slatted shutter.
    ctx.fillStyle = shut ? oc.tin : oc.boothGlass;
    roundRect(ctx, -0.36 * a, -0.34 * b, 0.72 * a, 0.92 * b, 0.1 * b);
    ctx.fill();
    ctx.strokeStyle = oc.ink;
    ctx.lineWidth = 0.07 * b;
    ctx.stroke();
    if (shut) {
      ctx.strokeStyle = oc.shackle;
      ctx.lineWidth = 0.05 * b;
      for (const y of [-0.14, 0.06, 0.26, 0.44]) line(ctx, -0.33 * a, y * b, 0.33 * a, y * b);
    } else {
      ctx.fillStyle = GLOW; // a shine on the glass
      ctx.fillRect(-0.3 * a, -0.26 * b, 0.1 * a, 0.5 * b);
      ctx.fillStyle = oc.brass; // the counter
      ctx.fillRect(-0.4 * a, 0.42 * b, 0.8 * a, 0.16 * b);
    }
    // The sign: a gold panel with a row of small marks standing for letters.
    ctx.fillStyle = oc.brass;
    roundRect(ctx, -0.5 * a, -b, a, 0.52 * b, 0.1 * b);
    ctx.fill();
    ctx.strokeStyle = oc.ink;
    ctx.lineWidth = 0.06 * b;
    ctx.stroke();
    ctx.fillStyle = oc.ink;
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(-0.4 * a + i * (0.8 * a / 7) + 0.02 * a, -0.86 * b, 0.07 * a, 0.24 * b);
    }
  },

  // Footlights (2x2): a dark panel with four sockets. A socket holds a round
  // bulb in a piece color while that color is still to go; a spent one is dark.
  footlights(ctx, { a, b, oc, cell, theme, plain }) {
    ctx.fillStyle = oc.safe;
    roundRect(ctx, -0.96 * a, -0.96 * b, 1.92 * a, 1.92 * b, 0.12 * a);
    ctx.fill();
    ctx.strokeStyle = oc.safeDoor;
    ctx.lineWidth = 0.08 * a;
    ctx.stroke();
    const colors = slotColors(cell, 4, plain);
    const r = 0.3 * Math.min(a, b);
    colors.forEach((c, i) => {
      const x = (i % 2 === 0 ? -0.45 : 0.45) * a;
      const y = (i < 2 ? -0.45 : 0.45) * b;
      ctx.fillStyle = oc.ink; // the socket
      dot(ctx, x, y, r * 1.18);
      if (c === null) return;
      ctx.fillStyle = pieceColor(theme, c, oc);
      dot(ctx, x, y, r);
      ctx.fillStyle = GLOW;
      dot(ctx, x - r * 0.3, y - r * 0.3, r * 0.3);
    });
  },

  // Fireworks (2x1): a wooden crate with up to three rockets standing in it,
  // one per color still to go.
  fireworks(ctx, { a, b, oc, cell, theme, plain }) {
    const colors = slotColors(cell, 3, plain);
    colors.forEach((c, i) => {
      if (c === null) return;
      const x = (i - 1) * 0.56 * a;
      const w = 0.13 * a;
      ctx.fillStyle = pieceColor(theme, c, oc);
      ctx.fillRect(x - w, -0.56 * b, 2 * w, 0.8 * b);
      ctx.beginPath(); // the pointed nose
      ctx.moveTo(x - w * 1.25, -0.56 * b);
      ctx.lineTo(x, -b);
      ctx.lineTo(x + w * 1.25, -0.56 * b);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff'; // a white band
      ctx.fillRect(x - w, -0.36 * b, 2 * w, 0.12 * b);
    });
    ctx.fillStyle = oc.wood; // the front of the crate hides the rockets' feet
    roundRect(ctx, -0.96 * a, -0.05 * b, 1.92 * a, 0.98 * b, 0.1 * b);
    ctx.fill();
    ctx.strokeStyle = oc.woodDark;
    ctx.lineWidth = 0.1 * b;
    ctx.stroke();
    ctx.lineWidth = 0.06 * b;
    line(ctx, -0.9 * a, 0.44 * b, 0.9 * a, 0.44 * b);
    sparkle(ctx, 0, 0.44 * b, 0.3 * b, oc.roof); // a red burst mark on the front
  },

  // Bouquet: flowers in a cream paper wrap tied with a ribbon. With one hit
  // left it looks picked over: two flowers and bare stems.
  bouquet(ctx, { u, oc, cell, plain }) {
    const picked = !plain && cell.hp === 1;
    ctx.strokeStyle = oc.leafDark; // the stems
    ctx.lineWidth = 0.07 * u;
    ctx.lineCap = 'round';
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) line(ctx, 0, 0.3 * u, x * u, -0.5 * u);
    if (!picked) {
      ctx.fillStyle = oc.leaf;
      dot(ctx, -0.34 * u, -0.3 * u, 0.34 * u);
      dot(ctx, 0.34 * u, -0.3 * u, 0.34 * u);
    }
    const spots = picked
      ? [[-0.28, -0.52], [0.4, -0.4]]
      : [[-0.52, -0.42], [0, -0.66], [0.52, -0.42], [-0.24, -0.24], [0.26, -0.24]];
    spots.forEach(([x, y], i) => {
      bloom(ctx, x * u, y * u, 0.25 * u, [oc.flowerA, oc.flowerB, oc.flowerC][i % 3], oc);
    });
    ctx.fillStyle = oc.wrap; // the paper wrap
    ctx.beginPath();
    ctx.moveTo(-0.66 * u, -0.14 * u);
    ctx.lineTo(0.66 * u, -0.14 * u);
    ctx.lineTo(0.12 * u, 0.95 * u);
    ctx.lineTo(-0.12 * u, 0.95 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = oc.wrapEdge;
    ctx.lineWidth = 0.06 * u;
    ctx.stroke();
    ctx.strokeStyle = oc.roof; // the ribbon
    ctx.lineWidth = 0.13 * u;
    line(ctx, -0.3 * u, 0.46 * u, 0.3 * u, 0.46 * u);
  },

  // Top Hat: a black hat with a red band. The ring shows how many of the
  // three match hits toward the next dove have landed.
  tophat(ctx, { u, oc, cell, plain }) {
    ctx.fillStyle = oc.ink;
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * u, 0.95 * u, 0.2 * u, 0, 0, TAU); // the brim
    ctx.fill();
    roundRect(ctx, -0.56 * u, -0.8 * u, 1.12 * u, 1.42 * u, 0.1 * u); // the crown
    ctx.fill();
    ctx.fillStyle = oc.roof;
    ctx.fillRect(-0.56 * u, 0.2 * u, 1.12 * u, 0.26 * u);
    ctx.fillStyle = GLOW;
    ctx.fillRect(-0.4 * u, -0.66 * u, 0.12 * u, 0.7 * u);
    if (!plain) progressRing(ctx, 0.64 * u, -0.64 * u, 0.34 * u, (cell.count | 0) % 3, oc);
  },

  // Popcorn Cart: a red-and-white striped cart on two wheels with a glass
  // box of popcorn on top, and the same progress ring as the Top Hat.
  popper(ctx, { u, oc, cell, plain }) {
    ctx.fillStyle = oc.glass; // the glass box
    roundRect(ctx, -0.62 * u, -0.78 * u, 1.24 * u, 0.8 * u, 0.08 * u);
    ctx.fill();
    ctx.strokeStyle = oc.iceEdge;
    ctx.lineWidth = 0.05 * u;
    ctx.stroke();
    ctx.fillStyle = oc.popcorn;
    for (const [x, y] of [[-0.36, -0.2], [-0.1, -0.26], [0.16, -0.2], [0.4, -0.24], [-0.22, -0.44], [0.08, -0.48], [0.3, -0.44]]) {
      dot(ctx, x * u, y * u, 0.15 * u);
    }
    ctx.fillStyle = oc.roof; // the canopy
    roundRect(ctx, -0.76 * u, -0.96 * u, 1.52 * u, 0.24 * u, 0.08 * u);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; // the cart body
    roundRect(ctx, -0.8 * u, -0.04 * u, 1.6 * u, 0.7 * u, 0.1 * u);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = oc.roof;
    for (let i = 0; i < 7; i += 2) ctx.fillRect(-0.8 * u + i * (1.6 * u / 7), -0.04 * u, 1.6 * u / 7, 0.7 * u);
    ctx.restore();
    ctx.strokeStyle = oc.roof;
    ctx.lineWidth = 0.05 * u;
    roundRect(ctx, -0.8 * u, -0.04 * u, 1.6 * u, 0.7 * u, 0.1 * u);
    ctx.stroke();
    ctx.fillStyle = oc.ink; // the wheels
    dot(ctx, -0.46 * u, 0.76 * u, 0.2 * u);
    dot(ctx, 0.46 * u, 0.76 * u, 0.2 * u);
    ctx.fillStyle = oc.tin;
    dot(ctx, -0.46 * u, 0.76 * u, 0.08 * u);
    dot(ctx, 0.46 * u, 0.76 * u, 0.08 * u);
    if (!plain) progressRing(ctx, 0.64 * u, -0.64 * u, 0.34 * u, (cell.count | 0) % 3, oc);
  },

  // Candy Jar: a glass jar with a red lid holding one candy per hit left.
  candyjar(ctx, { u, oc, cell, theme, plain }) {
    const n = plain || typeof cell.hp !== 'number' ? 3 : Math.max(0, Math.min(5, cell.hp));
    ctx.fillStyle = oc.glass;
    roundRect(ctx, -0.66 * u, -0.5 * u, 1.32 * u, 1.44 * u, 0.3 * u);
    ctx.fill();
    ctx.strokeStyle = oc.iceEdge;
    ctx.lineWidth = 0.08 * u;
    ctx.stroke();
    const spots = [[-0.28, 0.58], [0.28, 0.58], [0, 0.16], [-0.3, -0.16], [0.3, -0.16]];
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = pieceColor(theme, (i * 2 + 1) % Math.max(1, theme.pieces.length), oc);
      dot(ctx, spots[i][0] * u, spots[i][1] * u, 0.24 * u);
      ctx.fillStyle = GLOW;
      dot(ctx, (spots[i][0] - 0.08) * u, (spots[i][1] - 0.08) * u, 0.08 * u);
    }
    ctx.fillStyle = oc.roof; // the lid
    roundRect(ctx, -0.5 * u, -0.86 * u, u, 0.36 * u, 0.1 * u);
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; // a shine on the glass
    ctx.lineWidth = 0.1 * u;
    ctx.lineCap = 'round';
    line(ctx, -0.46 * u, -0.22 * u, -0.46 * u, 0.4 * u);
  },

  // Makeup Case: open = a pink case with its lid up, a mirror in the lid and
  // a sparkle; closed = the same case shut and grey (a hit does nothing then).
  makeupcase(ctx, { u, oc, cell, plain }) {
    const open = plain || cell.open === true;
    if (open) {
      ctx.fillStyle = oc.caseLid; // the raised lid
      roundRect(ctx, -0.8 * u, -0.95 * u, 1.6 * u, 0.82 * u, 0.12 * u);
      ctx.fill();
      ctx.fillStyle = oc.glass; // the mirror
      roundRect(ctx, -0.62 * u, -0.8 * u, 1.24 * u, 0.54 * u, 0.08 * u);
      ctx.fill();
      ctx.fillStyle = oc.casePink; // the body
      roundRect(ctx, -0.86 * u, -0.1 * u, 1.72 * u, 0.98 * u, 0.14 * u);
      ctx.fill();
      ctx.fillStyle = oc.caseLid; // the tray with three colors of makeup
      roundRect(ctx, -0.7 * u, 0.04 * u, 1.4 * u, 0.4 * u, 0.08 * u);
      ctx.fill();
      [oc.roof, oc.flowerB, oc.flowerC].forEach((c, i) => {
        ctx.fillStyle = c;
        dot(ctx, (i - 1) * 0.42 * u, 0.24 * u, 0.14 * u);
      });
      sparkle(ctx, 0.36 * u, -0.56 * u, 0.3 * u, oc.brass);
    } else {
      ctx.fillStyle = oc.caseShut;
      roundRect(ctx, -0.86 * u, -0.38 * u, 1.72 * u, 1.26 * u, 0.14 * u);
      ctx.fill();
      ctx.strokeStyle = oc.shackle; // where the lid meets the body
      ctx.lineWidth = 0.07 * u;
      line(ctx, -0.86 * u, 0, 0.86 * u, 0);
      ctx.beginPath(); // the handle
      ctx.arc(0, -0.38 * u, 0.28 * u, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = oc.shackle; // the latch
      roundRect(ctx, -0.14 * u, -0.12 * u, 0.28 * u, 0.3 * u, 0.05 * u);
      ctx.fill();
    }
  },

  // Curtain: a velvet drape filling the whole cell, red tinted toward the
  // color of the piece that opens it, with that piece's shape on a white
  // badge. Whatever is behind it stays hidden.
  curtain(ctx, { a, u, oc, cell, theme }) {
    const info = typeof cell.color === 'number' ? theme.pieces[cell.color] : null;
    const e = a * 1.1; // nearly the full cell, so neighbouring curtains join up
    ctx.fillStyle = info ? mixColor(oc.velvet, info.color, 0.5) : oc.velvet;
    roundRect(ctx, -e, -e, 2 * e, 2 * e, 0.1 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'; // the folds
    for (const x of [-0.75, -0.25, 0.25, 0.75]) ctx.fillRect(x * e - 0.09 * e, -e, 0.18 * e, 2 * e);
    ctx.fillStyle = oc.brass; // the rail along the top
    ctx.fillRect(-e, -e, 2 * e, 0.16 * e);
    if (info) {
      ctx.fillStyle = '#ffffff';
      dot(ctx, 0, 0.08 * u, 0.56 * u);
      ctx.save();
      ctx.translate(0, 0.08 * u);
      (SHAPES[info.shape] || SHAPES.rose)(ctx, 0.32 * u, info.color);
      ctx.restore();
    }
  },
};

// ---- The floor layer: confetti or petals lying on a cell, under its content. ----
// The cell gets a tint and an inset colored line, with the marks placed
// around the edges and corners, so it still shows with a piece on top.
// (x0, y0) is the cell's top-left corner; `seed` only varies the colors.
function drawFloor(ctx, kind, x0, y0, cell, theme, seed) {
  const oc = theme.obstacleColors || {};
  const confetti = kind === 'confetti';
  if (!confetti && kind !== 'petals') return; // a floor kind not known here
  const gap = Math.max(1, cell * 0.035);
  ctx.fillStyle = confetti ? oc.confettiTint : oc.petalTint;
  roundRect(ctx, x0 + gap, y0 + gap, cell - gap * 2, cell - gap * 2, cell * 0.16);
  ctx.fill();
  ctx.strokeStyle = confetti ? oc.confettiEdge : oc.petal;
  ctx.lineWidth = Math.max(1, cell * 0.04);
  roundRect(ctx, x0 + gap * 2, y0 + gap * 2, cell - gap * 4, cell - gap * 4, cell * 0.14);
  ctx.stroke();
  if (confetti) {
    const colors = [oc.confettiA, oc.confettiB, oc.confettiC, oc.confettiD];
    const spots = [[0.15, 0.15], [0.5, 0.11], [0.85, 0.16], [0.11, 0.5], [0.89, 0.52],
      [0.16, 0.85], [0.5, 0.89], [0.85, 0.85], [0.3, 0.3], [0.71, 0.7]];
    spots.forEach(([fx, fy], i) => {
      ctx.fillStyle = colors[(i + seed) % colors.length];
      dot(ctx, x0 + fx * cell, y0 + fy * cell, cell * (i % 2 === 0 ? 0.055 : 0.04));
    });
  } else {
    const spots = [[0.17, 0.17, 0.6], [0.83, 0.18, -0.6], [0.5, 0.12, 0], [0.13, 0.55, 1.2],
      [0.87, 0.55, -1.2], [0.2, 0.85, -0.7], [0.8, 0.85, 0.7], [0.5, 0.89, 0.2]];
    spots.forEach(([fx, fy, turn], i) => {
      ctx.fillStyle = (i + seed) % 3 === 0 ? oc.petalDark : oc.petal;
      ctx.beginPath();
      ctx.ellipse(x0 + fx * cell, y0 + fy * cell, cell * 0.1, cell * 0.055, turn, 0, TAU);
      ctx.fill();
    });
  }
}

// ---- Small pictures for the targets that are not obstacles themselves. ----
// Each is drawn around (0, 0) with the usual unit "u".
const ICONS = {
  // Dove: a small white bird on a pale blue disc (so the white shows).
  dove(ctx, u, oc) {
    ctx.fillStyle = oc.ice;
    dot(ctx, 0, 0, 0.98 * u);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = oc.coteEdge;
    ctx.lineWidth = 0.06 * u;
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
    ctx.fillStyle = oc.popcorn;
    for (const [x, y] of [[-0.4, -0.3], [0, -0.42], [0.4, -0.3], [-0.2, -0.6], [0.22, -0.6]]) {
      dot(ctx, x * u, y * u, 0.26 * u);
    }
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
    ctx.strokeStyle = oc.roof;
    ctx.lineWidth = 0.06 * u;
    tub();
    ctx.stroke();
  },

  // Candy: a round wrapped sweet with a twist of paper at each end.
  candy(ctx, u, oc) {
    ctx.fillStyle = oc.flowerB;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 0.4 * u, 0);
      ctx.lineTo(side * 0.98 * u, -0.42 * u);
      ctx.lineTo(side * 0.98 * u, 0.42 * u);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = oc.roof;
    dot(ctx, 0, 0, 0.56 * u);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.12 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 0.3 * u, 0.4, 0.4 + Math.PI);
    ctx.stroke();
  },
};

// Draw one batch-2 obstacle. (cx, cy) is the middle of its anchor cell (the
// top-left cell of a big block) and `size` is the width of one cell; a big
// block spreads right and down from there over its w x h cells.
function drawBlock2(ctx, cell, cx, cy, size, theme, plain) {
  const oc = theme.obstacleColors || {};
  const std = BIG_SIZE[cell.kind] || [1, 1];
  const w = Number.isInteger(cell.w) && cell.w > 0 ? cell.w : std[0];
  const h = Number.isInteger(cell.h) && cell.h > 0 ? cell.h : std[1];
  const u = size * 0.42;
  const a = (w * size) / 2 - size * 0.08; // half the width of the drawing
  const b = (h * size) / 2 - size * 0.08; // half its height
  ctx.save();
  ctx.translate(cx + ((w - 1) * size) / 2, cy + ((h - 1) * size) / 2); // middle of the area
  BLOCKS2[cell.kind](ctx, { a, b, u, oc, cell, theme, plain });

  const full = FULL_HP2[cell.kind];
  if (!plain && full) {
    const hp = typeof cell.hp === 'number' ? cell.hp : full;        // hits still needed
    const taken = Math.max(0, Math.min(CRACKS.length, full - hp)); // hits already taken
    // The same damage marks as batch 1, stretched over the whole area:
    // a lighter tint and one more crack per hit taken.
    if (taken > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.12 * taken) + ')';
      ctx.fillRect(-a, -b, 2 * a, 2 * b);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < taken; i++) {
        for (const [color, width] of [['#ffffff', 0.15], [oc.ink || '#1b2030', 0.07]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = width * u;
          ctx.beginPath();
          for (const [px, py] of CRACKS[i]) ctx.lineTo(px * a, py * b);
          ctx.stroke();
        }
      }
    }
    // One small dot per hit still needed, along the bottom edge.
    if (hp > 1) {
      const step = 0.36 * u;
      for (let i = 0; i < hp; i++) {
        const px = (i - (hp - 1) / 2) * step;
        ctx.fillStyle = '#ffffff';
        dot(ctx, px, b - 0.2 * u, 0.16 * u);
        ctx.fillStyle = oc.ink || '#1b2030';
        dot(ctx, px, b - 0.2 * u, 0.105 * u);
      }
    }
  }
  ctx.restore();
}

// Up to three crack lines, as points in units of "u". One more crack is
// drawn for every hit an obstacle has already taken.
const CRACKS = [
  [[-0.8, -0.62], [-0.38, -0.3], [-0.52, 0.02], [-0.12, 0.3]],
  [[0.82, -0.5], [0.42, -0.22], [0.56, 0.14], [0.16, 0.42]],
  [[-0.25, 0.9], [0.02, 0.52], [-0.1, 0.22], [0.2, -0.05]],
];

// Draw one obstacle centered at (cx, cy).
// With plain = true it is drawn whole, with no cracks, hit pips or contents
// (used for the small target pictures).
function drawBlock(ctx, cell, cx, cy, size, theme, plain) {
  // Batch-2 kinds (and big blocks) have their own drawing routine.
  if (Object.hasOwn(BLOCKS2, cell.kind)) { drawBlock2(ctx, cell, cx, cy, size, theme, plain); return; }
  const oc = theme.obstacleColors || {};
  const u = size * 0.42;
  ctx.save();
  ctx.translate(cx, cy);

  if (cell.kind === 'padlock') {
    // The padlock holds something: draw that first, fade it, then the lock on top.
    const holds = !plain && cell.inside;
    if (holds) {
      drawContent(ctx, cell.inside, 0, 0, size, theme);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.16);
      ctx.fill();
    }
    BLOCKS.padlock(ctx, holds ? u * 0.74 : u, oc);
  } else if (BLOCKS[cell.kind]) {
    BLOCKS[cell.kind](ctx, u, oc, cell, theme);
  } else {
    // An obstacle kind this file does not know yet: a plain grey box.
    ctx.fillStyle = oc.paintNone || '#8c95a6';
    roundRect(ctx, -0.9 * u, -0.9 * u, 1.8 * u, 1.8 * u, 0.16 * u);
    ctx.fill();
  }

  if (!plain) {
    const info = OBSTACLES[cell.kind];
    const full = info && Array.isArray(info.hits) ? info.hits.length : 1; // hits when new
    const hp = typeof cell.hp === 'number' ? cell.hp : full;               // hits still needed
    const taken = Math.max(0, Math.min(CRACKS.length, full - hp));         // hits already taken

    // The more hits it has taken, the more broken it looks: a lighter tint
    // and one more crack per hit.
    if (taken > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.16 * taken) + ')';
      ctx.fillRect(-u * 1.1, -u * 1.1, u * 2.2, u * 2.2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < taken; i++) {
        // Each crack is drawn twice: a wide white line under a thin dark
        // one, so it shows on dark and light obstacles alike.
        for (const [color, width] of [['#ffffff', 0.15], [oc.ink || '#1b2030', 0.07]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = width * u;
          ctx.beginPath();
          for (const [px, py] of CRACKS[i]) ctx.lineTo(px * u, py * u);
          ctx.stroke();
        }
      }
    }

    // One small dot per hit still needed, shown when more than one is left.
    if (hp > 1) {
      const step = 0.36 * u;
      for (let i = 0; i < hp; i++) {
        const px = (i - (hp - 1) / 2) * step;
        ctx.fillStyle = '#ffffff';
        dot(ctx, px, 0.8 * u, 0.16 * u);
        ctx.fillStyle = oc.ink || '#1b2030';
        dot(ctx, px, 0.8 * u, 0.105 * u);
      }
    }
  }
  ctx.restore();
}

// Sandbag (the dropper): a tan sack tied at the top, with a small down
// arrow to show it has to reach the bottom of its column.
function drawDrop(ctx, cx, cy, size, theme) {
  const oc = theme.obstacleColors || {};
  const u = size * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = oc.sack;
  ctx.beginPath();
  ctx.moveTo(-0.26 * u, -0.5 * u);
  ctx.bezierCurveTo(-1.0 * u, -0.1 * u, -0.95 * u, 0.92 * u, 0, 0.92 * u);
  ctx.bezierCurveTo(0.95 * u, 0.92 * u, 1.0 * u, -0.1 * u, 0.26 * u, -0.5 * u);
  ctx.lineTo(0.4 * u, -0.95 * u);
  ctx.lineTo(-0.4 * u, -0.95 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = oc.sackDark; // the tie
  ctx.lineWidth = 0.14 * u;
  ctx.lineCap = 'round';
  line(ctx, -0.3 * u, -0.52 * u, 0.3 * u, -0.52 * u);
  ctx.fillStyle = oc.sackDark;   // the down arrow
  ctx.fillRect(-0.09 * u, -0.14 * u, 0.18 * u, 0.42 * u);
  ctx.beginPath();
  ctx.moveTo(-0.3 * u, 0.26 * u);
  ctx.lineTo(0.3 * u, 0.26 * u);
  ctx.lineTo(0, 0.64 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Draw whatever is in a cell (piece, power-up, obstacle or sandbag)
// centered at (cx, cy).
function drawContent(ctx, cell, cx, cy, size, theme) {
  if (!cell) return;
  if (cell.t === 'piece') drawPiece(ctx, cell.color, cx, cy, size, theme);
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
    else if (kind === 'confetti' || kind === 'petals') {
      // A floor target: a small white cell with that floor on it.
      ctx.fillStyle = theme.ui.cell;
      roundRect(ctx, size * 0.04, size * 0.04, size * 0.92, size * 0.92, size * 0.16);
      ctx.fill();
      drawFloor(ctx, kind, 0, 0, size, theme, 0);
    } else if (Object.hasOwn(ICONS, kind)) {
      // Something a generator gives out: dove, popcorn or candy.
      ctx.save();
      ctx.translate(mid, mid);
      ICONS[kind](ctx, size * 0.42, oc);
      ctx.restore();
    } else if (BIG_SIZE[kind]) {
      // A big block: shrink it so its whole w x h area fits in the square.
      const [w, h] = BIG_SIZE[kind];
      const s = size / Math.max(w, h);
      drawBlock(ctx, { t: 'block', kind, w, h }, mid - ((w - 1) * s) / 2, mid - ((h - 1) * s) / 2, s, theme, true);
    } else drawBlock(ctx, { t: 'block', kind: target.block, color: target.color }, mid, mid, size, theme, true);
  } else if (typeof target.color === 'number') {
    drawPiece(ctx, target.color, mid, mid, size, theme);
  }
}

const key = (x, y) => x + ',' + y;

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

  // The light grey tray the whole board sits in.
  const rim = Math.min(4, BOARD_PAD);
  ctx.fillStyle = ui.tray || ui.panel;
  roundRect(ctx, originX - rim, originY - rim,
    cell * board.cols + rim * 2, cell * board.rows + rim * 2, cell * 0.2);
  ctx.fill();

  // The white square behind every playable cell. Holes get nothing, so the
  // tray shows through. An empty cell is just this square.
  const gap = Math.max(1, cell * 0.035);
  ctx.fillStyle = ui.cell;
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      if (get(board, x, y) === null) continue;
      roundRect(ctx, originX + x * cell + gap, originY + y * cell + gap,
        cell - gap * 2, cell - gap * 2, cell * 0.16);
      ctx.fill();
    }
  }

  // The floor layer (confetti, petals), on top of the white squares and
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
