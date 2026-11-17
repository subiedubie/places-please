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

// ---- The five piece shapes. Each is drawn around (0, 0) with "radius" r. ----

const SHAPES = {
  // Mask: flat top, pointed chin, two eye holes.
  mask(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r, -0.72 * r);
    ctx.lineTo(r, -0.72 * r);
    ctx.bezierCurveTo(r, 0.45 * r, 0.5 * r, r, 0, r);
    ctx.bezierCurveTo(-0.5 * r, r, -r, 0.45 * r, -r, -0.72 * r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SHADE;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 0.43 * r, -0.18 * r, 0.25 * r, 0.16 * r, 0, 0, TAU);
      ctx.fill();
    }
  },

  // Rose: a round bloom with a ring and a center.
  rose(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 0.95 * r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = SHADE;
    ctx.lineWidth = 0.16 * r;
    ctx.beginPath();
    ctx.arc(0, 0, 0.52 * r, 0.3, TAU * 0.8);
    ctx.stroke();
    ctx.fillStyle = SHADE;
    ctx.beginPath();
    ctx.arc(0, 0, 0.16 * r, 0, TAU);
    ctx.fill();
  },

  // Quill: a slanted feather with a shaft down the middle.
  quill(ctx, r, color) {
    ctx.save();
    ctx.rotate(0.7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -1.15 * r);
    ctx.quadraticCurveTo(0.95 * r, -0.1 * r, 0, 1.0 * r);
    ctx.quadraticCurveTo(-0.95 * r, -0.1 * r, 0, -1.15 * r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = SHADE;
    ctx.lineWidth = 0.13 * r;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -0.75 * r);
    ctx.lineTo(0, 1.2 * r);
    ctx.stroke();
    ctx.restore();
  },

  // Lantern: a tall box with a cap top and bottom and a light inside.
  lantern(ctx, r, color) {
    ctx.fillStyle = color;
    roundRect(ctx, -0.66 * r, -0.7 * r, 1.32 * r, 1.4 * r, 0.3 * r);
    ctx.fill();
    ctx.fillRect(-0.36 * r, -1.02 * r, 0.72 * r, 0.24 * r);
    ctx.fillRect(-0.36 * r, 0.78 * r, 0.72 * r, 0.24 * r);
    ctx.fillStyle = GLOW;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.24 * r, 0.42 * r, 0, 0, TAU);
    ctx.fill();
  },

  // Fan: an open hand fan (a wide wedge) with two ribs.
  fan(ctx, r, color) {
    const cy = 0.75 * r;
    const reach = 1.6 * r;
    const from = Math.PI * 1.17;
    const to = Math.PI * 1.83;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.arc(0, cy, reach, from, to);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = SHADE;
    ctx.lineWidth = 0.1 * r;
    for (const f of [1 / 3, 2 / 3]) {
      const ang = from + (to - from) * f;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(Math.cos(ang) * reach * 0.94, cy + Math.sin(ang) * reach * 0.94);
      ctx.stroke();
    }
  },
};

// Draw one ordinary piece centered at (cx, cy). `size` is the width of the
// square it should fit in. Also used for the small target pictures.
export function drawPiece(ctx, colorIndex, cx, cy, size, theme) {
  const info = theme.pieces[colorIndex];
  if (!info) return; // a color this theme does not know: draw nothing
  const shape = SHAPES[info.shape] || SHAPES.rose;
  ctx.save();
  ctx.translate(cx, cy);
  shape(ctx, size * 0.36, info.color);
  ctx.restore();
}

// ---- The power-ups. Each sits on a light tile so it never looks like a piece. ----

function drawPower(ctx, kind, cx, cy, size, theme) {
  const pc = theme.powerColors;
  const r = size * 0.36;
  ctx.save();
  ctx.translate(cx, cy);

  // The light tile.
  const t = size * 0.84;
  ctx.fillStyle = pc.tile;
  roundRect(ctx, -t / 2, -t / 2, t, t, size * 0.2);
  ctx.fill();
  // A thin gold edge, so the pale tile still shows on a white cell.
  if (pc.tileEdge) {
    ctx.strokeStyle = pc.tileEdge;
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.stroke();
  }

  if (kind === 'spot-h' || kind === 'spot-v') {
    // Missile: an arrow with a head at both ends, lying along the row
    // ('spot-h') or standing along the column ('spot-v').
    if (kind === 'spot-v') ctx.rotate(Math.PI / 2);
    ctx.fillStyle = pc.missile;
    ctx.fillRect(-0.5 * r, -0.2 * r, 1.0 * r, 0.4 * r);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 1.02 * r, 0);
      ctx.lineTo(side * 0.4 * r, -0.56 * r);
      ctx.lineTo(side * 0.4 * r, 0.56 * r);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 'under') {
    // Ninja Star: four points and a hole in the middle.
    ctx.fillStyle = pc.star;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? 1.02 * r : 0.36 * r;
      const ang = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pc.tile;
    ctx.beginPath();
    ctx.arc(0, 0, 0.15 * r, 0, TAU);
    ctx.fill();
  } else if (kind === 'show') {
    // Grenade: a round body, a cap on top, a band across.
    ctx.fillStyle = pc.grenade;
    ctx.beginPath();
    ctx.arc(0, 0.16 * r, 0.76 * r, 0, TAU);
    ctx.fill();
    ctx.fillRect(-0.24 * r, -0.98 * r, 0.48 * r, 0.44 * r);
    ctx.fillRect(0.1 * r, -0.98 * r, 0.56 * r, 0.16 * r); // the lever
    ctx.fillStyle = pc.band;
    ctx.fillRect(-0.74 * r, 0.06 * r, 1.48 * r, 0.2 * r);
  } else if (kind === 'prism') {
    // Magic Ball: a ball showing all the piece colors.
    const n = theme.pieces.length;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = theme.pieces[i].color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 0.92 * r, (i / n) * TAU - Math.PI / 2, ((i + 1) / n) * TAU - Math.PI / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = pc.star;
    ctx.lineWidth = 0.14 * r;
    ctx.beginPath();
    ctx.arc(0, 0, 0.92 * r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = pc.tile;
    ctx.beginPath();
    ctx.arc(0, 0, 0.26 * r, 0, TAU);
    ctx.fill();
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
export function drawPowerIcon(ctx, kind, size, theme) {
  drawPower(ctx, kind, size / 2, size / 2, size, theme);
}

// A small picture of what a target asks for, filling a square of side
// `size` whose top-left corner is at (0, 0).
//   { color: n }     -> that piece
//   { block: kind }  -> that obstacle ('sandbag' -> the sandbag)
export function drawTargetIcon(ctx, target, size, theme) {
  if (!target) return;
  const mid = size / 2;
  if (typeof target.block === 'string') {
    if (target.block === DROPPER.id) drawDrop(ctx, mid, mid, size, theme);
    else drawBlock(ctx, { t: 'block', kind: target.block, color: target.color }, mid, mid, size, theme, true);
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
export function drawBoard(ctx, board, layout, theme, overlay) {
  const { originX, originY, cell } = layout;
  const ui = theme.ui;
  const offsets = overlay && overlay.offsets;

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
      const off = offsets && offsets.get(key(x, y));
      if (off) { moving.push({ x, y, c, off }); continue; }
      drawContent(ctx, c, originX + (x + 0.5) * cell, originY + (y + 0.5) * cell, cell, theme);
    }
  }
  for (const m of moving) {
    drawContent(ctx, m.c,
      originX + (m.x + m.off.dx + 0.5) * cell,
      originY + (m.y + m.off.dy + 0.5) * cell, cell, theme);
  }
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
  ctx.restore();
}
