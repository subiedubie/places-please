// COSTUME PAIRS: the wardrobe memory game's own play screen (rules in
// meta/events/pairs.js). Face-down cards with a red velvet back; tap two to
// turn them over (one ticket a turn). A match stays up and its costume
// flies to the rail at the top; a miss turns back after a short look.
// Cards you have turned before carry a small chalk tick, never the picture.
import { addPicture } from '../eventicons.js';
import {
  openGame, panel, bigText, ribbon, chest, coin, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU, GAME_FONT, SHOW_FONT,
} from './kit.js';

// ---- The wardrobe: one painter per costume piece, drawn in a box of side
// s centred on (0, 0). `tint` is the pale card colour behind each piece, so
// pieces read apart at a glance even before the shape does.
const TINT = {
  crown: '#fff2c0', tophat: '#dfe6ff', fan: '#f2dcff', mask: '#d4fbf2', wig: '#e8ecff', cape: '#ffe0e0',
  shoe: '#ffe6ee', boa: '#ffd8f4', tiara: '#e2f6ff', monocle: '#fff0d8', cane: '#f0e6d8', ruff: '#eef0f4',
};

function grad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
function line(ctx, w, color) { ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

const PAINT = {
  crown(ctx, s) {
    const w = s * 0.78; const h = s * 0.52; const x = -w / 2; const y = -h * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.15);
    ctx.lineTo(x + w * 0.25, y + h * 0.55);
    ctx.lineTo(0, y - h * 0.12);
    ctx.lineTo(x + w * 0.75, y + h * 0.55);
    ctx.lineTo(x + w, y + h * 0.15);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, y, y + h, ['#fff6b0', '#ffc21a', '#c07000']);
    ctx.fill();
    line(ctx, s * 0.035, '#6a3a00');
    ctx.stroke();
    ctx.fillStyle = '#c0103c';
    rr(ctx, x, y + h * 0.78, w, h * 0.22, s * 0.02); ctx.fill(); ctx.stroke();
    for (const [gx, gy, c] of [[x, y + h * 0.15, '#ff3a5a'], [0, y - h * 0.12, '#3a7bff'], [x + w, y + h * 0.15, '#ff3a5a']]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(gx, gy, s * 0.06, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#18c060';
    ctx.beginPath(); ctx.arc(0, y + h * 0.6, s * 0.065, 0, TAU); ctx.fill(); ctx.stroke();
  },
  tophat(ctx, s) {
    const bw = s * 0.84; const cw = s * 0.5; const ch = s * 0.5; const top = -s * 0.36;
    ctx.fillStyle = grad(ctx, top, top + ch, ['#5a5a70', '#1a1a26']);
    line(ctx, s * 0.035, '#000');
    rr(ctx, -cw / 2, top, cw, ch, s * 0.04); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e01a40';
    ctx.fillRect(-cw / 2, top + ch * 0.62, cw, ch * 0.2);
    ctx.beginPath();
    ctx.ellipse(0, top + ch + s * 0.02, bw / 2, s * 0.09, 0, 0, TAU);
    ctx.fillStyle = '#2a2a36'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(-cw / 2 + s * 0.06, top + s * 0.05, s * 0.06, ch * 0.5);
  },
  fan(ctx, s) {
    const r = s * 0.46; const cy = s * 0.26;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI + (i / n) * Math.PI;
      const a1 = Math.PI + ((i + 1) / n) * Math.PI;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.arc(0, cy, r, a0, a1); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#a64bff' : '#d890ff';
      ctx.fill();
    }
    line(ctx, s * 0.03, '#4a1080');
    ctx.beginPath(); ctx.arc(0, cy, r, Math.PI, TAU); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ffe070';
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88, s * 0.025, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#7a4a1a';
    ctx.beginPath(); ctx.arc(0, cy, s * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff6a9a';
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(-s * 0.05, cy + s * 0.18); ctx.lineTo(s * 0.05, cy + s * 0.18); ctx.closePath(); ctx.fill();
  },
  mask(ctx, s) {
    const w = s * 0.8; const h = s * 0.36;
    ctx.save(); ctx.translate(0, -s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.3);
    ctx.quadraticCurveTo(-w * 0.25, -h * 0.75, 0, -h * 0.25);
    ctx.quadraticCurveTo(w * 0.25, -h * 0.75, w / 2, -h * 0.3);
    ctx.quadraticCurveTo(w * 0.45, h * 0.55, w * 0.12, h * 0.4);
    ctx.quadraticCurveTo(0, h * 0.1, -w * 0.12, h * 0.4);
    ctx.quadraticCurveTo(-w * 0.45, h * 0.55, -w / 2, -h * 0.3);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -h, h, ['#6af0d8', '#0aa08a', '#05605a']);
    ctx.fill();
    line(ctx, s * 0.04, '#c08a00'); ctx.stroke();
    ctx.fillStyle = '#1a0a2a';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * w * 0.2, -h * 0.05, w * 0.1, h * 0.17, sx * 0.3, 0, TAU); ctx.fill(); }
    ctx.restore();
    line(ctx, s * 0.05, '#c08a00');
    ctx.beginPath(); ctx.moveTo(w * 0.38, s * 0.02); ctx.lineTo(w * 0.5, s * 0.42); ctx.stroke();
    ctx.fillStyle = '#ff6a9a';
    ctx.beginPath(); ctx.ellipse(-w * 0.45, -s * 0.2, s * 0.05, s * 0.12, -0.5, 0, TAU); ctx.fill();
  },
  wig(ctx, s) {
    const puffs = [[0, -0.28, 0.17], [-0.2, -0.2, 0.15], [0.2, -0.2, 0.15], [-0.3, 0.02, 0.14], [0.3, 0.02, 0.14], [-0.3, 0.24, 0.12], [0.3, 0.24, 0.12], [-0.1, -0.06, 0.14], [0.1, -0.06, 0.14]];
    line(ctx, s * 0.03, '#7a80a8');
    for (const [x, y, r] of puffs) {
      ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, TAU);
      ctx.fillStyle = grad(ctx, (y - r) * s, (y + r) * s, ['#ffffff', '#d4d8f0']);
      ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#f8d8b8';
    ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.17, s * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a7bff';
    ctx.beginPath(); ctx.moveTo(0, s * 0.36); ctx.lineTo(-s * 0.14, s * 0.28); ctx.lineTo(-s * 0.14, s * 0.44); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, s * 0.36); ctx.lineTo(s * 0.14, s * 0.28); ctx.lineTo(s * 0.14, s * 0.44); ctx.closePath(); ctx.fill();
  },
  cape(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.34);
    ctx.lineTo(s * 0.12, -s * 0.34);
    ctx.quadraticCurveTo(s * 0.3, s * 0.05, s * 0.4, s * 0.42);
    ctx.quadraticCurveTo(s * 0.2, s * 0.34, 0, s * 0.42);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.34, -s * 0.4, s * 0.42);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.05, -s * 0.12, -s * 0.34);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -s * 0.34, s * 0.42, ['#ff4a5a', '#c0102a', '#70061a']);
    ctx.fill();
    line(ctx, s * 0.035, '#4a0010'); ctx.stroke();
    ctx.fillStyle = '#7a2ad8';
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.3); ctx.lineTo(-s * 0.02, s * 0.36); ctx.lineTo(-s * 0.2, s * 0.38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath(); ctx.arc(0, -s * 0.32, s * 0.08, 0, TAU); ctx.fill();
    line(ctx, s * 0.025, '#7a4000'); ctx.stroke();
  },
  shoe(ctx, s) {
    // a pointe shoe, side on, with its ribbons
    line(ctx, s * 0.035, '#c0607a');
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.06);
    ctx.quadraticCurveTo(-s * 0.42, s * 0.26, -s * 0.2, s * 0.26);
    ctx.lineTo(s * 0.3, s * 0.26);
    ctx.quadraticCurveTo(s * 0.44, s * 0.24, s * 0.4, s * 0.1);
    ctx.quadraticCurveTo(s * 0.1, s * 0.02, -s * 0.02, -s * 0.06);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.06, -s * 0.38, s * 0.06);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -s * 0.06, s * 0.26, ['#ffe0e8', '#ff9ab8']);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0607a';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, s * 0.04, s * 0.14, s * 0.05, 0.1, 0, TAU); ctx.fill();
    line(ctx, s * 0.05, '#ff6a9a');
    ctx.beginPath(); ctx.moveTo(-s * 0.02, s * 0.0); ctx.quadraticCurveTo(-s * 0.1, -s * 0.25, s * 0.05, -s * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.02); ctx.quadraticCurveTo(-s * 0.3, -s * 0.22, -s * 0.18, -s * 0.38); ctx.stroke();
  },
  boa(ctx, s) {
    // a feather boa looped in an S
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push([Math.sin(t * TAU * 1.1) * s * 0.28, (t - 0.5) * s * 0.78]);
    }
    for (const [i, [x, y]] of pts.entries()) {
      ctx.fillStyle = i % 2 ? '#ff3aa8' : '#ff7ac8';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + i;
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * s * 0.06, y + Math.sin(a) * s * 0.05, s * 0.07, s * 0.035, a, 0, TAU); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (const [x, y] of pts.filter((_, i) => i % 3 === 0)) { ctx.beginPath(); ctx.arc(x - s * 0.02, y - s * 0.02, s * 0.02, 0, TAU); ctx.fill(); }
  },
  tiara(ctx, s) {
    line(ctx, s * 0.05, '#8a9ab8');
    ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.4, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    ctx.fillStyle = grad(ctx, -s * 0.3, s * 0.1, ['#ffffff', '#b8c8e8', '#7088b0']);
    ctx.beginPath();
    const base = s * 0.0;
    ctx.moveTo(-s * 0.32, base);
    for (let i = 0; i <= 6; i++) {
      const x = -s * 0.32 + (i / 6) * s * 0.64;
      const peak = i === 3 ? -s * 0.38 : i % 2 ? -s * 0.2 : -s * 0.08;
      ctx.lineTo(x, i % 2 || i === 3 ? peak : base - s * 0.04);
    }
    ctx.lineTo(s * 0.32, base);
    ctx.quadraticCurveTo(0, -s * 0.08, -s * 0.32, base);
    ctx.fill();
    line(ctx, s * 0.025, '#5a6a90'); ctx.stroke();
    ctx.fillStyle = '#40c8ff';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.06, -s * 0.2); ctx.lineTo(0, -s * 0.1); ctx.lineTo(-s * 0.06, -s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7ab0';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * s * 0.16, -s * 0.1, s * 0.035, 0, TAU); ctx.fill(); }
  },
  monocle(ctx, s) {
    line(ctx, s * 0.025, '#a06a00');
    ctx.setLineDash([s * 0.04, s * 0.03]);
    ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.12); ctx.quadraticCurveTo(s * 0.4, s * 0.3, s * 0.1, s * 0.44); ctx.stroke();
    ctx.setLineDash([]);
    const g = ctx.createRadialGradient(-s * 0.1, -s * 0.12, s * 0.02, -s * 0.04, -s * 0.04, s * 0.3);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#bfe8ff'); g.addColorStop(1, '#6ab0e0');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(-s * 0.04, -s * 0.04, s * 0.26, 0, TAU); ctx.fill();
    line(ctx, s * 0.07, '#ffc21a'); ctx.stroke();
    line(ctx, s * 0.02, '#7a4000');
    ctx.beginPath(); ctx.arc(-s * 0.04, -s * 0.04, s * 0.3, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.ellipse(-s * 0.13, -s * 0.13, s * 0.06, s * 0.03, -0.7, 0, TAU); ctx.fill();
  },
  cane(ctx, s) {
    line(ctx, s * 0.09, '#2a1408');
    ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.44); ctx.lineTo(s * 0.0, -s * 0.18); ctx.stroke();
    line(ctx, s * 0.055, '#8a4a1a');
    ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.44); ctx.lineTo(s * 0.0, -s * 0.18); ctx.stroke();
    // the gold crook
    line(ctx, s * 0.1, '#7a4000');
    ctx.beginPath(); ctx.arc(-s * 0.13, -s * 0.2, s * 0.14, 0, Math.PI * 1.15, true); ctx.stroke();
    line(ctx, s * 0.065, '#ffc21a');
    ctx.beginPath(); ctx.arc(-s * 0.13, -s * 0.2, s * 0.14, 0, Math.PI * 1.15, true); ctx.stroke();
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath(); ctx.arc(-s * 0.04, -s * 0.31, s * 0.025, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(s * 0.06, s * 0.36, s * 0.07, s * 0.08);
  },
  ruff(ctx, s) {
    const n = 14; const R = s * 0.42; const r = s * 0.2;
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rad = i % 2 ? R : R * 0.82;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.62);
    }
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -R * 0.6, R * 0.6, ['#ffffff', '#e0e4f0', '#b8bcd0']);
    ctx.fill();
    line(ctx, s * 0.025, '#7a7ea0'); ctx.stroke();
    line(ctx, s * 0.015, 'rgba(120,124,160,.7)');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.62); ctx.lineTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85 * 0.62); ctx.stroke();
    }
    ctx.fillStyle = '#3a1a5a';
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath(); ctx.arc(0, r * 0.62, s * 0.045, 0, TAU); ctx.fill();
  },
};

// Draw one costume piece centred at (cx, cy) in a box of side s.
export function costume(ctx, face, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  const p = PAINT[face];
  if (p) p(ctx, s);
  else bigText(ctx, String(face || '?').slice(0, 1).toUpperCase(), 0, 0, s * 0.6, '#fff', '#3a1a5a');
  ctx.restore();
}

// ---- Cards. Backs and faces are painted once per size into small
// off-screen canvases, so a frame only copies pictures.
const cache = new Map();
function cached(key, w, h, paint) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const k = `${key}|${w}|${h}|${dpr}`;
  let c = cache.get(k);
  if (!c) {
    if (cache.size > 120) cache.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr) + 8;
    c.height = Math.ceil(h * dpr) + 8;
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 2, 2);
    paint(x, w, h);
    c.dpr = dpr;
    cache.set(k, c);
  }
  return c;
}

function paintBack(ctx, w, h) {
  const r = Math.min(w, h) * 0.12;
  // gold rim
  ctx.fillStyle = '#4a2000';
  rr(ctx, 0, 0, w, h, r); ctx.fill();
  ctx.fillStyle = grad(ctx, 0, h, ['#fff0a8', '#ffc21a', '#b06400']);
  rr(ctx, 1.5, 1.5, w - 3, h - 3, r - 1); ctx.fill();
  // red velvet
  const v = ctx.createRadialGradient(w * 0.4, h * 0.3, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, '#e8264a');
  v.addColorStop(0.55, '#a00a2a');
  v.addColorStop(1, '#4e0012');
  ctx.fillStyle = v;
  const i = Math.max(3, w * 0.07);
  rr(ctx, i, i, w - 2 * i, h - 2 * i, r * 0.7); ctx.fill();
  // the velvet's pile: fine diagonal lines
  ctx.save();
  rr(ctx, i, i, w - 2 * i, h - 2 * i, r * 0.7); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 1;
  for (let d = -h; d < w; d += 4) { ctx.beginPath(); ctx.moveTo(d, h); ctx.lineTo(d + h, 0); ctx.stroke(); }
  // a soft sheen
  ctx.fillStyle = 'rgba(255,200,220,.12)';
  ctx.beginPath(); ctx.ellipse(w * 0.35, h * 0.22, w * 0.45, h * 0.16, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
  // thin gold inner line
  ctx.strokeStyle = 'rgba(255,214,90,.75)';
  ctx.lineWidth = 1.2;
  rr(ctx, i + 3, i + 3, w - 2 * i - 6, h - 2 * i - 6, r * 0.5); ctx.stroke();
  // the crest: a gold medallion with PP
  const cr = Math.min(w, h) * 0.27;
  ctx.fillStyle = '#5a2a00';
  ctx.beginPath(); ctx.arc(w / 2, h / 2 + 1.5, cr + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = grad(ctx, h / 2 - cr, h / 2 + cr, ['#fff6c0', '#ffc21a', '#b06400']);
  ctx.beginPath(); ctx.arc(w / 2, h / 2, cr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a0a2a';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, cr * 0.78, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd84a';
  ctx.font = `${Math.round(cr * 0.95)}px ${SHOW_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PP', w / 2, h / 2 + cr * 0.06);
  // little laurel dots round the medallion
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    ctx.fillStyle = '#ffe070';
    ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * cr * 1.25, h / 2 + Math.sin(a) * cr * 1.25, Math.max(1, cr * 0.07), 0, TAU); ctx.fill();
  }
}

function paintFace(face, spot) {
  return (ctx, w, h) => {
    const r = Math.min(w, h) * 0.12;
    ctx.fillStyle = '#4a2000';
    rr(ctx, 0, 0, w, h, r); ctx.fill();
    ctx.fillStyle = spot ? grad(ctx, 0, h, ['#ffffff', '#fff070', '#ffb000']) : grad(ctx, 0, h, ['#fff0a8', '#ffc21a', '#b06400']);
    rr(ctx, 1.5, 1.5, w - 3, h - 3, r - 1); ctx.fill();
    const i = Math.max(3, w * 0.07);
    const tint = TINT[face] || '#fff4e0';
    const bg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.6, tint);
    bg.addColorStop(1, spot ? '#ffd060' : '#d8c8b0');
    ctx.fillStyle = bg;
    rr(ctx, i, i, w - 2 * i, h - 2 * i, r * 0.7); ctx.fill();
    if (spot) {
      // a spotlight: a pale cone from the top, and a star in the corner
      ctx.save();
      rr(ctx, i, i, w - 2 * i, h - 2 * i, r * 0.7); ctx.clip();
      ctx.fillStyle = 'rgba(255,250,200,.55)';
      ctx.beginPath(); ctx.moveTo(w * 0.42, i); ctx.lineTo(w * 0.58, i); ctx.lineTo(w * 0.95, h); ctx.lineTo(w * 0.05, h); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const s = Math.min(w - 2 * i, (h - 2 * i) * 0.95);
    ctx.fillStyle = 'rgba(60,30,80,.12)';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + s * 0.42, s * 0.32, s * 0.06, 0, 0, TAU); ctx.fill();
    costume(ctx, face, w / 2, h / 2, s * 0.86);
    if (spot) {
      ctx.fillStyle = '#ff9a00';
      ctx.strokeStyle = '#7a3a00';
      ctx.lineWidth = 1;
      const cx = w - i - s * 0.1; const cy = i + s * 0.1; const rr2 = s * 0.09;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const rad = k % 2 ? rr2 * 0.45 : rr2; ctx.lineTo(cx + Math.cos(-Math.PI / 2 + (k * TAU) / 10) * rad, cy + Math.sin(-Math.PI / 2 + (k * TAU) / 10) * rad); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  };
}

function blit(ctx, c, x, y, w, h) {
  ctx.drawImage(c, x - 2 / c.dpr, y - 2 / c.dpr, c.width / c.dpr, c.height / c.dpr);
}

// A chalk tick, a little rough, in the card's top-left corner.
function chalk(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.6, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.12);
  ctx.lineTo(x + s * 0.08, y + s * 0.2);
  ctx.lineTo(x + s * 0.24, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.02, y + s * 0.15);
  ctx.lineTo(x + s * 0.09, y + s * 0.22);
  ctx.lineTo(x + s * 0.25, y + s * 0.03);
  ctx.stroke();
  ctx.restore();
}

// A theatre ticket (the chip and the "-1" pops).
function ticket(ctx, cx, cy, s, angle = -0.25) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const w = s * 0.9; const h = s * 0.52;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.arc(w / 2, 0, h * 0.18, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.arc(-w / 2, 0, h * 0.18, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, -h / 2, h / 2, ['#ff8aa8', '#e0204a', '#9a0a2a']);
  ctx.fill();
  ctx.strokeStyle = '#5a0018';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,140,.9)';
  ctx.setLineDash([s * 0.04, s * 0.04]);
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath(); ctx.moveTo(w * 0.18, -h * 0.4); ctx.lineTo(w * 0.18, h * 0.4); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffe070';
  ctx.beginPath();
  const sr = h * 0.26; const sx = -w * 0.12;
  for (let k = 0; k < 10; k++) { const rad = k % 2 ? sr * 0.45 : sr; ctx.lineTo(sx + Math.cos(-Math.PI / 2 + (k * TAU) / 10) * rad, Math.sin(-Math.PI / 2 + (k * TAU) / 10) * rad); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function paintTicketChip(c, cx, cy, s) { ticket(c, cx, cy, s * 1.05, -0.3); }

// A brass costume rail with a hanger.
function hanger(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = '#d8d0c0';
  ctx.lineWidth = Math.max(1.4, s * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y + s * 0.08, s * 0.1, Math.PI * 1.1, Math.PI * 0.2, false);
  ctx.moveTo(x, y + s * 0.18);
  ctx.lineTo(x - s * 0.36, y + s * 0.42);
  ctx.lineTo(x + s * 0.36, y + s * 0.42);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// A prize in a few words for the ribbon: "500 coins + pack".
function prizeWords(r) {
  if (!r) return '';
  const out = [];
  if (r.gold) out.push('gold pack');
  if (r.coins) out.push(`${r.coins} coins`);
  if (r.packs) out.push(r.packs === 1 ? 'pack' : `${r.packs} packs`);
  if (r.boosters) { const n = Object.values(r.boosters).reduce((a, b) => a + b, 0); out.push(n === 1 ? 'booster' : `${n} boosters`); }
  if (r.boost) out.push(`${r.boost.minutes}-min boost`);
  return out.slice(0, 2).join(' + ');
}

// id: the event's id. api: { view(), act(action), play(), changed() }
export function openPairs(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#3e0f5e', bottom: '#12041e' });
  const fx = [];
  const words = [];
  let cards = []; // local copy of the board: { face, up, t, matched, seen, spot, glow, wob, pop }
  let G = v.game;
  let busy = false; // waiting for an animation; taps are held
  let look = null; // a miss being looked at: { a, b, age }
  let reveal = null; // spotlight: { age, cells, phase }
  let flying = []; // costumes flying to the rail: { face, from, slot, age }
  let railShown = []; // faces hanging on the rail (drawn)
  let dealIn = 1; // 0..1, cards dropping in for a new board
  let finale = null; // board done: { age, chest }
  let lastNoTicket = -10;
  const L = {};

  function layout() {
    const W = g.w;
    const H = g.h;
    L.stepsY = 18;
    L.railY = 50; // the rail bar
    L.railH = Math.min(70, H * 0.11);
    L.top = L.railY + L.railH + 16;
    L.bottom = H - 52;
    const gap = Math.max(5, Math.min(10, W * 0.018));
    const cw = (W - 24 - gap * (G.cols - 1)) / G.cols;
    const ch = (L.bottom - L.top - gap * (G.rows - 1)) / G.rows;
    // Cards are 3:4, as big as fit.
    L.ch = Math.floor(Math.min(ch, (cw * 4) / 3));
    L.cw = Math.floor((L.ch * 3) / 4);
    L.gap = gap;
    L.bw = L.cw * G.cols + gap * (G.cols - 1);
    L.bh = L.ch * G.rows + gap * (G.rows - 1);
    L.bx = Math.round((W - L.bw) / 2);
    L.by = Math.round(L.top + (L.bottom - L.top - L.bh) / 2);
    L.prizeY = Math.min(H - 24, L.by + L.bh + 28);
    // rail slots
    const n = G.pairs;
    L.railX0 = 22;
    L.railX1 = W - 22;
    L.slotW = (L.railX1 - L.railX0) / n;
    L.slotS = Math.min(L.slotW * 0.95, L.railH * 0.72);
  }
  g.onResize = () => layout();

  function cellRect(c) {
    const x = L.bx + (c % G.cols) * (L.cw + L.gap);
    const y = L.by + Math.floor(c / G.cols) * (L.ch + L.gap);
    return { x, y, w: L.cw, h: L.ch };
  }
  function slotAt(i) {
    return { x: L.railX0 + L.slotW * (i + 0.5), y: L.railY + 10 + L.railH * 0.5 };
  }

  // Take the board from the rules' view (after any move, or a new board).
  function fromView(keepAnim = true) {
    G = v.game;
    layout();
    const old = cards;
    cards = G.cards.map((k, i) => {
      const o = keepAnim && old.length === G.cards.length ? old[i] : null;
      return {
        face: k.face || (o && o.face && k.matched ? o.face : null),
        up: !!(k.matched || k.open),
        t: o ? o.t : (k.matched || k.open ? 1 : 0),
        matched: k.matched,
        seen: k.seen,
        spot: k.spot,
        glow: o ? o.glow : 0,
        wob: o ? o.wob : 0,
        pop: o ? o.pop : 0,
      };
    });
    railShown = G.rail.slice();
  }

  function note() {
    const per = G.ticketsPerWin;
    if (G.over) { g.note('Every rail is full. Bravo!'); return; }
    if (G.tickets < 1 && G.open < 0) g.note(`Win levels for tickets (${per[0]} each, hard ones up to ${per[per.length - 1]}).`);
    else if (G.open >= 0) g.note('Now find its partner.');
    else g.note('Turn over two cards. Remember where each costume is!');
  }

  function refresh(keepAnim = true) {
    v = api.view();
    if (!v || !v.game) { g.close(); return false; }
    fromView(keepAnim);
    g.chip(String(G.tickets), paintTicketChip);
    note();
    return true;
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  fromView(false);
  g.chip(String(G.tickets), paintTicketChip);
  note();
  dealIn = 0;

  function cellAt(x, y) {
    for (let c = 0; c < cards.length; c++) {
      const r = cellRect(c);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return c;
    }
    return -1;
  }

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  g.onTap = (x, y) => {
    if (finale || reveal || dealIn < 1) return;
    if (look) { endLook(); return; } // a tap hurries the look along
    if (busy || G.over) return;
    const c = cellAt(x, y);
    if (c < 0) return;
    const k = cards[c];
    if (k.matched || k.up) { k.wob = 0.25; return; }
    if (G.tickets < 1 && G.open < 0) {
      g.chip(String(G.tickets), paintTicketChip); // the chip bumps
      k.wob = 0.35;
      if (g.t - lastNoTicket > 1.2) { g.toast('No tickets left. Win levels to earn more.'); lastNoTicket = g.t; }
      return;
    }
    const out = api.act({ flip: c });
    if (!out || !out.ok) {
      if (out && out.reason === 'tickets') g.toast('No tickets left. Win levels to earn more.');
      refresh();
      return;
    }
    k.face = out.face;
    k.up = true;
    k.spot = out.spot;
    k.seen = true;
    k.pop = 1;
    const r = cellRect(c);
    if (out.first) {
      G.tickets = out.tickets;
      G.open = c;
      g.chip(String(out.tickets), paintTicketChip);
      words.push({ text: '-1 ticket', x: r.x + r.w / 2, y: r.y + r.h * 0.2, age: 0, size: 16, color: '#ffb0c0', stroke: '#5a0018', life: 0.9 });
      burst(fx, r.x + r.w / 2, r.y + r.h / 2, { n: 8, colors: ['#fff3a0', '#ffc21a'], speed: 120, size: 3, gravity: 0, life: 0.4 });
      if (out.spot) words.push({ text: 'Spotlight card!', x: r.x + r.w / 2, y: r.y, age: 0, size: 18, color: '#fff070' });
      note();
      api.changed();
      return;
    }
    // the second card of the turn
    G.open = -1;
    busy = true;
    g.note(out.match ? 'A match!' : 'Not a pair. Remember them!');
    const o = cards[out.other];
    o.face = out.otherFace;
    api.changed();
    if (out.match) setTimeout(() => matched(out), 330);
    else {
      setTimeout(() => {
        look = { a: out.other, b: c, age: 0, ms: G.missMs };
        cards[out.other].wob = 0.4;
        cards[c].wob = 0.4;
      }, 300);
    }
  };

  function endLook() {
    if (!look) return;
    const { a, b } = look;
    look = null;
    cards[a].up = false;
    cards[b].up = false;
    setTimeout(() => { busy = false; refresh(); }, 230);
  }

  async function matched(out) {
    const a = cards[out.other];
    const b = cards[out.cell];
    a.matched = b.matched = true;
    a.glow = b.glow = 1;
    const ra = cellRect(out.other);
    const rb = cellRect(out.cell);
    for (const r of [ra, rb]) {
      burst(fx, r.x + r.w / 2, r.y + r.h / 2, { n: 18, colors: ['#fff', '#ffe070', '#ff7ab0', '#7ad8ff'], speed: 240, size: 5, kind: 'star', life: 0.9 });
    }
    const mid = { x: (ra.x + rb.x + ra.w) / 2, y: (ra.y + rb.y) / 2 };
    words.push({ text: out.streak >= 2 ? `Match! x${out.streak}` : 'Match!', x: mid.x, y: mid.y, age: 0, size: 26 });
    // the costume flies to the rail
    const slot = railShown.length;
    flying.push({ face: out.face, from: { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2, s: Math.min(rb.w, rb.h) * 0.8 }, slot, age: 0 });
    if (out.quick) {
      setTimeout(() => {
        words.push({ text: `Quick change! +${out.quick}`, x: g.w / 2, y: L.by + L.bh * 0.45, age: 0, size: 28, color: '#7affc8', stroke: '#003a2a', life: 1.5 });
        burst(fx, g.w - 40, 6, { n: 16, colors: ['#ff8aa8', '#ffe070', '#fff'], speed: 180, size: 5, kind: 'star', life: 0.8 });
        g.chip(String(out.tickets), paintTicketChip);
      }, 350);
    } else g.chip(String(out.tickets), paintTicketChip);
    G.tickets = out.tickets;
    await wait(750);

    if (out.reveal && out.reveal.length) {
      // Spotlight: a short wind-up, then every face for a moment.
      words.push({ text: 'SPOTLIGHT!', x: g.w / 2, y: L.by + L.bh / 2, age: 0, size: 38, color: '#fff070', stroke: '#5a2a00', life: 1.1 });
      reveal = { age: 0, cells: out.reveal, phase: 0, ms: G.spotlightMs };
      for (const x of out.reveal) cards[x.cell].face = x.face;
      return; // the frame loop finishes the reveal and calls back
    }
    if (out.stepDone) { await boardDone(out); return; }
    busy = false;
    refresh();
  }

  async function boardDone(out) {
    finale = { age: 0, chest: out.chest };
    burst(fx, g.w / 2, L.railY + 20, { n: 40, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 380, size: 6, kind: 'star', life: 1.3 });
    await wait(out.chest ? 1500 : 900);
    const head = out.chest ? 'Wardrobe chest!' : `Rail ${out.board + 1} full!`;
    await g.prize(out.reward, head, out.allDone ? 'Every rail is full.' : 'A fresh rack is on its way.');
    if (out.allDone) {
      await g.prize(out.grand, 'Grand prize!', 'The whole wardrobe, matched. Bravo!');
      finale = null;
      api.changed();
      g.close();
      return;
    }
    finale = null;
    flying = [];
    busy = false;
    if (!refresh(false)) return;
    dealIn = 0;
    api.changed();
  }

  function endReveal() {
    const cells = reveal.cells;
    reveal = null;
    for (const x of cells) { const k = cards[x.cell]; if (!k.matched) { k.face = null; k.seen = true; } }
    busy = false;
    refresh();
  }

  g.draw = (ctx, dt, t) => {
    backdrop(ctx, g.w, g.h, '#3e0f5e', '#12041e', 'rgba(255,200,230,.14)');
    // curtain swags at the sides
    ctx.save();
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : g.w;
      const gr = ctx.createLinearGradient(x0, 0, x0 - side * 26, 0);
      gr.addColorStop(0, 'rgba(160,10,40,.75)');
      gr.addColorStop(1, 'rgba(160,10,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(side < 0 ? 0 : g.w - 26, 0, 26, g.h);
    }
    ctx.restore();

    // ---- the fifteen steps ----
    const n = G.steps;
    const ds = Math.min(18, (g.w - 40) / n - 4);
    const span = n * ds + (n - 1) * 4;
    let dx = (g.w - span) / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,120,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dx + ds / 2, L.stepsY); ctx.lineTo(dx + span - ds / 2, L.stepsY); ctx.stroke();
    ctx.restore();
    const chests = new Set(G.chests);
    for (let i = 0; i < n; i++) {
      const cx = dx + ds / 2;
      const cur = i === G.step && !G.over;
      const done = i < G.step || G.over;
      const s = cur ? ds * 1.35 : ds;
      if (cur) rays(ctx, cx, L.stepsY, s * 1.2, t, 'rgba(255,230,140,.25)', 10);
      if (chests.has(i)) {
        chest(ctx, cx, L.stepsY + 1, s * 1.15, done ? 1 : 0, done ? ['#3ee07a', '#0a6a2a'] : undefined);
      } else {
        panel(ctx, cx - s / 2, L.stepsY - s / 2, s, s, s * 0.3, done ? ['#3ee07a', '#0a8a3a'] : cur ? ['#ff6a9a', '#b0103c'] : ['#6a5a8a', '#3a2a5a'], cur);
        bigText(ctx, done ? '✓' : String(i + 1), cx, L.stepsY + 1, s * 0.6);
      }
      dx += ds + 4;
    }

    // ---- the costume rail ----
    const railBarY = L.railY + 6;
    panel(ctx, 12, L.railY - 2, g.w - 24, L.railH + 14, 14, ['#2a0f4c', '#16062c']);
    ctx.save();
    ctx.fillStyle = grad(ctx, railBarY - 3, railBarY + 3, ['#fff0a8', '#d89a20', '#7a4a00']);
    rr(ctx, L.railX0 - 6, railBarY - 3, L.railX1 - L.railX0 + 12, 6, 3);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < G.pairs; i++) {
      const p = slotAt(i);
      hanger(ctx, p.x, railBarY - 2, L.slotS * 0.7);
      const face = railShown[i];
      const isFlying = flying.some((f) => f.slot === i);
      if (face && !isFlying) {
        const swing = Math.sin(t * 2 + i) * 0.04;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(swing);
        costume(ctx, face, 0, 0, L.slotS);
        ctx.restore();
      } else if (!face) {
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.arc(p.x, p.y + 2, L.slotS * 0.3, 0, TAU); ctx.fill();
      }
    }
    // quick change pips (top right of the rail) and the board count
    const qe = G.quickEvery;
    if (qe > 0) {
      const have = G.streak % qe;
      for (let i = 0; i < qe; i++) {
        const px = g.w - 30 - (qe - 1 - i) * 13;
        const py = L.railY + L.railH + 2;
        ctx.fillStyle = i < have ? '#7affc8' : 'rgba(255,255,255,.18)';
        ctx.strokeStyle = '#0a3a2a';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.save();
      ctx.font = `12px ${GAME_FONT}`;
      ctx.fillStyle = 'rgba(200,255,230,.85)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('quick change', g.w - 30 - qe * 13, L.railY + L.railH + 2);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(`${railShown.length}/${G.pairs} on the rail`, 24, L.railY + L.railH + 2);
      ctx.restore();
    }

    // ---- the cards ----
    if (dealIn < 1) dealIn = Math.min(1, dealIn + dt * 1.5);
    const spotOn = reveal && reveal.phase === 1;
    for (let c = 0; c < cards.length; c++) {
      const k = cards[c];
      const r = cellRect(c);
      let { x, y } = r;
      const target = k.up || k.matched || (spotOn && k.face) ? 1 : 0;
      k.t += Math.sign(target - k.t) * Math.min(Math.abs(target - k.t), dt / 0.2);
      if (dealIn < 1) {
        const lag = clamp01((dealIn - (c / cards.length) * 0.5) / 0.5);
        y = lerp(-r.h * 1.5, y, ease.outBack(lag));
        x = lerp(g.w / 2 - r.w / 2, x, ease.out(lag));
      }
      let wobX = 0;
      if (k.wob > 0) { k.wob = Math.max(0, k.wob - dt); wobX = Math.sin(k.wob * 50) * 4 * (k.wob / 0.4); }
      if (k.pop > 0) k.pop = Math.max(0, k.pop - dt * 4);
      const sx = Math.abs(Math.cos(k.t * Math.PI));
      const showFace = k.t > 0.5 && k.face;
      const lift = Math.sin(k.t * Math.PI) * 6 + k.pop * 3;
      ctx.save();
      ctx.translate(x + r.w / 2 + wobX, y + r.h / 2 - lift);
      ctx.scale(Math.max(0.02, sx) * (1 + k.pop * 0.06), 1 + k.pop * 0.06);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      rr(ctx, -r.w / 2 + 2, -r.h / 2 + 4 + lift, r.w, r.h, r.w * 0.12);
      ctx.fill();
      if (showFace) {
        const pic = cached(`f:${k.face}:${k.spot ? 1 : 0}`, r.w, r.h, paintFace(k.face, k.spot));
        blit(ctx, pic, -r.w / 2, -r.h / 2);
        if (k.matched) {
          ctx.fillStyle = 'rgba(40,10,60,.18)';
          rr(ctx, -r.w / 2, -r.h / 2, r.w, r.h, r.w * 0.12); ctx.fill();
        }
      } else {
        blit(ctx, cached('back', r.w, r.h, paintBack), -r.w / 2, -r.h / 2);
        if (k.seen && !k.matched) chalk(ctx, -r.w / 2 + r.w * 0.12, -r.h / 2 + r.w * 0.12, r.w * 0.6);
      }
      if (k.glow > 0) {
        k.glow = Math.max(0, k.glow - dt * 1.2);
        ctx.strokeStyle = `rgba(255,250,190,${k.glow})`;
        ctx.lineWidth = 4;
        rr(ctx, -r.w / 2 - 2, -r.h / 2 - 2, r.w + 4, r.h + 4, r.w * 0.14);
        ctx.stroke();
      }
      ctx.restore();
    }
    // the open first card gently glows, so you know a turn is half done
    if (G.open >= 0 && cards[G.open] && !busy) {
      const r = cellRect(G.open);
      ctx.save();
      ctx.strokeStyle = `rgba(255,240,150,${0.5 + 0.4 * Math.sin(t * 6)})`;
      ctx.lineWidth = 3;
      rr(ctx, r.x - 3, r.y - 9, r.w + 6, r.h + 6, r.w * 0.15);
      ctx.stroke();
      ctx.restore();
    }

    // ---- the miss: a short look, then back over ----
    if (look) {
      look.age += dt;
      if (look.age * 1000 >= look.ms) endLook();
    }

    // ---- the spotlight: a beam sweeps in, the board lights, then dark ----
    if (reveal) {
      reveal.age += dt;
      const wind = 0.55;
      const hold = reveal.ms / 1000;
      if (reveal.phase === 0 && reveal.age >= wind) reveal.phase = 1;
      if (reveal.phase === 1 && reveal.age >= wind + hold) { reveal.phase = 2; }
      if (reveal.phase === 2 && reveal.age >= wind + hold + 0.25) endReveal();
      if (reveal) {
        const k = reveal.phase === 0 ? reveal.age / wind : reveal.phase === 1 ? 1 : 1 - (reveal.age - wind - hold) / 0.25;
        const sweep = reveal.phase === 0 ? lerp(-0.6, 0, ease.out(k)) : 0;
        ctx.save();
        // darken the house, light a cone on the board
        ctx.fillStyle = `rgba(5,0,15,${0.35 * k})`;
        ctx.fillRect(0, 0, g.w, g.h);
        ctx.translate(g.w / 2, -20);
        ctx.rotate(sweep);
        const cone = ctx.createLinearGradient(0, 0, 0, L.by + L.bh);
        cone.addColorStop(0, `rgba(255,250,210,${0.5 * k})`);
        cone.addColorStop(1, `rgba(255,250,210,${0.12 * k})`);
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        ctx.lineTo(L.bw * 0.75, L.by + L.bh + 30); ctx.lineTo(-L.bw * 0.75, L.by + L.bh + 30);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        if (reveal.phase === 1) {
          // the time left of the look, as a shrinking gold bar
          const left = 1 - (reveal.age - wind) / hold;
          ctx.fillStyle = 'rgba(0,0,0,.4)';
          rr(ctx, L.bx, L.by - 10, L.bw, 6, 3); ctx.fill();
          ctx.fillStyle = '#ffe070';
          rr(ctx, L.bx, L.by - 10, L.bw * clamp01(left), 6, 3); ctx.fill();
        }
      }
    }

    // ---- costumes flying to the rail ----
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.age += dt;
      const p = slotAt(f.slot);
      const k = ease.inOut(clamp01((f.age - 0.15) / 0.55));
      const x = lerp(f.from.x, p.x, k);
      const y = lerp(f.from.y, p.y, k) - Math.sin(k * Math.PI) * 50;
      const s = lerp(f.from.s, L.slotS, k);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(k * Math.PI) * 0.5);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.8);
      glow.addColorStop(0, 'rgba(255,250,200,.6)');
      glow.addColorStop(1, 'rgba(255,250,200,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      costume(ctx, f.face, 0, 0, s);
      ctx.restore();
      if (f.age > 0.7) {
        burst(fx, p.x, p.y, { n: 12, colors: ['#fff', '#ffe070'], speed: 140, size: 4, kind: 'star', gravity: 0, life: 0.5 });
        if (!railShown[f.slot]) railShown[f.slot] = f.face;
        flying.splice(i, 1);
      }
    }

    // ---- this board's prize, under the cards ----
    if (G.reward && !G.over) {
      const cy = L.prizeY;
      const rw = Math.min(g.w - 110, 250);
      ribbon(ctx, `Rail ${G.step + 1}: ${prizeWords(G.reward)}`, g.w / 2 - 22, cy, rw, 28, G.chest ? ['#ffb21a', '#b05a00'] : undefined);
      if (G.chest) chest(ctx, g.w / 2 - 22 + rw / 2 + 30, cy - 3, 38, 0);
      else if (G.reward.coins) coin(ctx, g.w / 2 - 22 + rw / 2 + 28, cy, 13);
      if (G.hasSpot) {
        ctx.save();
        ctx.font = `12px ${GAME_FONT}`;
        ctx.fillStyle = 'rgba(255,240,170,.85)';
        ctx.textAlign = 'center';
        ctx.fillText('★ one pair here is a spotlight', g.w / 2, Math.min(g.h - 6, cy + 24));
        ctx.restore();
      }
    }

    // ---- out of tickets: say so on the board ----
    if (!busy && !finale && G.tickets < 1 && G.open < 0 && !G.over && dealIn >= 1) {
      const bob = Math.sin(t * 3) * 3;
      const w = Math.min(g.w - 40, 300);
      panel(ctx, (g.w - w) / 2, L.by + L.bh / 2 - 34 + bob, w, 68, 16, ['#ff4f7a', '#8a0a3a']);
      bigText(ctx, 'Out of tickets', g.w / 2, L.by + L.bh / 2 - 12 + bob, 24);
      bigText(ctx, `Win a level for ${G.ticketsPerWin[0]}+ more`, g.w / 2, L.by + L.bh / 2 + 16 + bob, 16, '#ffe9a8', '#5a0020');
    }

    // ---- a full rail: the rail glows, a chest bursts on chest steps ----
    if (finale) {
      finale.age += dt;
      ctx.save();
      ctx.strokeStyle = `rgba(255,240,150,${0.6 + 0.4 * Math.sin(t * 10)})`;
      ctx.lineWidth = 4;
      rr(ctx, 10, L.railY - 4, g.w - 20, L.railH + 18, 16);
      ctx.stroke();
      ctx.restore();
      if (finale.chest) {
        ctx.fillStyle = `rgba(10,2,30,${Math.min(0.6, finale.age)})`;
        ctx.fillRect(0, 0, g.w, g.h);
        const k = ease.outBack(clamp01(finale.age / 0.45));
        rays(ctx, g.w / 2, g.h * 0.48, 220 * k, t, 'rgba(255,230,140,.3)', 16);
        // a wobble before it bursts
        const shake = finale.age > 0.45 && finale.age < 0.9 ? Math.sin(finale.age * 60) * 4 : 0;
        chest(ctx, g.w / 2 + shake, g.h * 0.48, 140 * k, clamp01((finale.age - 0.9) / 0.35));
        if (finale.age > 0.95 && !finale.burst) {
          finale.burst = true;
          burst(fx, g.w / 2, g.h * 0.45, { n: 60, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 440, size: 6, kind: 'star', life: 1.4 });
        }
      }
    }

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}

// The round badge on Home: a face-down velvet card behind a crowned one.
addPicture('pairs', {
  types: ['pairs'],
  colors: ['#c0103c', '#4e0012'],
  badge: ['#ffe4ec', '#e07090'],
  paint(ctx) {
    ctx.save();
    ctx.translate(20, 40);
    ctx.rotate(-0.22);
    paintBack(ctx, 34, 46);
    ctx.restore();
    ctx.save();
    ctx.translate(48, 14);
    ctx.rotate(0.18);
    paintFace('crown', false)(ctx, 34, 46);
    ctx.restore();
  },
});
