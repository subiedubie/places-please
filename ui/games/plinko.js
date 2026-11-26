// PAPER DRAGON PARADE: the plinko table's own play screen (rules and ball
// physics in meta/events/parade.js). At the top, the paper dragon your team
// is building, growing and taking colour as its stage fills, with the stage
// bar beside it; under it, what each of the four team-mates has given; then
// the tall table. Slide the lantern launcher along the top and let go to
// drop a ball; drop more while the first is still falling.
//
// Every ball runs the rules file's own physics step, so the path on screen
// is the path the rules would compute. When a ball lands the screen reports
// { ball, points, mult }; the rules cap it.
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU, GAME_FONT,
} from './kit.js';
import { addPicture } from '../eventicons.js';
import { TABLE, tableOf, newBall, stepBall } from '../../meta/events/parade.js';

// ---- Look (all tunable here) ----
const SLOT_COLORS = { 1: ['#7a5ad8', '#3a1a8a'], 2: ['#3aa0ff', '#0a4a9a'], 5: ['#ff5aa8', '#9a0a4a'], 10: ['#ffe070', '#c07000'] };
const PAPER = ['#fbf3e2', '#e2d2b2']; // an uncoloured paper segment
const MAX_FALLING = 10; // balls on the table at once
const DROP_GAP = 0.22; // seconds between two drops
const WINDUP = 0.16; // the launcher's little wind-up before a ball pops out
const SEGMENTS = [6, 8, 10]; // body segments of the dragon at stages 1, 2, 3
const REFRESH_SECONDS = 4; // how often the teammates' gifts are looked up again

// The badge on Home: a red paper-dragon head on a lantern-gold disc.
addPicture('parade', {
  types: ['parade'],
  colors: ['#e0283a', '#6a0012'],
  badge: ['#fff0c8', '#e0a030'],
  paint(ctx) {
    dragonHead(ctx, 44, 56, 58, ['#ff3a4a', '#8a0a1a', '#ffd23a'], 1, 0);
  },
});

const fmt = (n) => {
  n = Math.max(0, Math.round(n));
  if (n >= 100000) return Math.round(n / 1000) + 'k';
  if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('en-US');
};

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// ---- The dragon ----

// The head, facing right, centred at (x, y), `s` across. colored 0..1.
function dragonHead(ctx, x, y, s, colors, colored, t) {
  ctx.save();
  ctx.translate(x, y);
  const k = s / 100;
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const main = mix(PAPER[0], colors[0], colored);
  const dark = mix(PAPER[1], colors[1], colored);
  const acc = mix('#d8c8a8', colors[2], colored);
  const line = colored > 0.3 ? '#3a0a10' : '#8a7a5a';
  // mane spikes behind
  ctx.fillStyle = acc;
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = -2.2 + i * 0.42 + Math.sin(t * 3 + i) * 0.05;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 26 - 10, Math.sin(a) * 26);
    ctx.lineTo(Math.cos(a - 0.15) * 50 - 14, Math.sin(a - 0.15) * 50);
    ctx.lineTo(Math.cos(a + 0.2) * 28 - 10, Math.sin(a + 0.2) * 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // horns
  ctx.fillStyle = mix('#efe4c8', '#ffe9a0', colored);
  for (const [hx, hy, a] of [[-6, -26, -0.9], [8, -28, -0.6]]) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-4, -26, -14, -36);
    ctx.quadraticCurveTo(4, -24, 5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // the skull and snout
  const g = ctx.createLinearGradient(0, -30, 0, 30);
  g.addColorStop(0, main);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-30, -6);
  ctx.quadraticCurveTo(-28, -32, 4, -30);
  ctx.quadraticCurveTo(30, -28, 44, -14);
  ctx.quadraticCurveTo(52, -8, 50, 0);
  ctx.lineTo(20, 2);
  ctx.lineTo(48, 10);
  ctx.quadraticCurveTo(40, 26, 10, 26);
  ctx.quadraticCurveTo(-26, 26, -30, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // mouth (open a little, with a tongue of flame-red)
  ctx.fillStyle = colored > 0.2 ? '#7a0010' : '#bfae8a';
  ctx.beginPath();
  ctx.moveTo(20, 2);
  ctx.lineTo(50, 0);
  ctx.lineTo(48, 9);
  ctx.closePath();
  ctx.fill();
  // brow ridge stripes
  ctx.strokeStyle = acc;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -20);
  ctx.quadraticCurveTo(4, -28, 22, -20);
  ctx.stroke();
  // eye
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(10, -12, 9, 7, -0.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colored > 0.2 ? '#1a0a20' : '#8a7a5a';
  ctx.beginPath();
  ctx.arc(12 + Math.sin(t * 1.3) * 1.5, -12, 3.6, 0, TAU);
  ctx.fill();
  // nostril
  ctx.fillStyle = line;
  ctx.beginPath();
  ctx.arc(42, -10, 2.4, 0, TAU);
  ctx.fill();
  // whiskers, waving
  {
    ctx.strokeStyle = acc;
    ctx.lineWidth = 3;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(40, sgn < 0 ? -6 : 8);
      const w = Math.sin(t * 2.4 + sgn) * 8;
      ctx.bezierCurveTo(60, sgn * 10 - 4, 66, sgn * 22 + w, 80, sgn * 18 + w);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The whole parade puppet: tail at the left, head at the right, segments
// on poles between. stage 0..2 (3 = complete), fill 0..1 of this stage.
function drawDragon(ctx, x, y, w, h, colors, stage, fill, t, glow = 0) {
  const st = Math.min(2, stage);
  const total = SEGMENTS[st];
  const before = stage >= 3 ? total : st === 0 ? 0 : SEGMENTS[st - 1];
  // how many segments are coloured: those from earlier stages, then the
  // new ones one by one as the stage fills
  const colored = stage >= 3 ? total : before + fill * (total - before);
  const grow = 0.72 + 0.11 * st + 0.04 * (stage >= 3 ? 1 : fill);
  const segW = (w * 0.72) / Math.max(total, 1);
  const s = Math.min(h * 0.36, segW * 1.6) * grow;
  const head = s * 1.9;
  const len = segW * total * grow;
  // from the tip of the tail fan to the tip of the whiskers
  const span = s * 1.1 + len + head * 1.12;
  const startX = x + w / 2 - span / 2 + s * 1.1;
  const base = y + h * 0.48;
  const amp = h * 0.1;
  const wave = (i) => base + Math.sin(t * 2.2 - i * 0.62) * amp;
  ctx.save();
  // shrink to fit the box if the grown dragon is wider than it
  const fit = Math.min(1, w / span);
  if (fit < 1) {
    ctx.translate(x + w / 2, base);
    ctx.scale(fit, fit);
    ctx.translate(-(x + w / 2), -base);
  }
  if (glow > 0) rays(ctx, x + w / 2, base, Math.max(w, h) * 0.6, t, `rgba(255,230,140,${0.28 * glow})`, 14);
  // the ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h - 6, len * 0.62, 6, 0, 0, TAU);
  ctx.fill();
  // poles (the puppeteers' sticks)
  ctx.strokeStyle = '#6a3a10';
  ctx.lineWidth = Math.max(2, s * 0.08);
  for (let i = 0; i <= total; i += 2) {
    const px = startX + i * segW * grow + segW * 0.5;
    ctx.beginPath();
    ctx.moveTo(px, wave(i));
    ctx.lineTo(px, y + h - 6);
    ctx.stroke();
  }
  // tail fan
  {
    const tx = startX;
    const ty = wave(-0.6);
    const k = clamp01(colored / Math.max(1, total) * 3);
    ctx.fillStyle = mix(PAPER[0], colors[2], stage > 0 || colored > 0 ? Math.max(0.3, k) : 0);
    ctx.strokeStyle = colored > 0 ? '#3a0a10' : '#8a7a5a';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const a = Math.PI + i * 0.32 + Math.sin(t * 3 + i) * 0.06;
      ctx.beginPath();
      ctx.moveTo(tx + 4, ty);
      ctx.lineTo(tx + Math.cos(a - 0.12) * s * 1.1, ty + Math.sin(a - 0.12) * s * 1.1);
      ctx.lineTo(tx + Math.cos(a + 0.12) * s * 1.1, ty + Math.sin(a + 0.12) * s * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // body segments, tail first, so the head sits on top
  for (let i = 0; i < total; i++) {
    const cx = startX + (i + 0.5) * segW * grow;
    const cy = wave(i);
    const k = clamp01(colored - i); // 0 = paper, 1 = full colour
    const r = s * (0.42 + 0.12 * Math.sin((i / Math.max(1, total - 1)) * Math.PI));
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, mix(PAPER[0], colors[0], k));
    g.addColorStop(1, mix(PAPER[1], colors[1], k));
    ctx.fillStyle = g;
    ctx.strokeStyle = k > 0.3 ? '#3a0a10' : '#9a8a6a';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    if (k < 0.05) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, segW * grow * 0.62, r, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    // paper ribs
    ctx.strokeStyle = k > 0.3 ? 'rgba(60,10,10,.35)' : 'rgba(120,100,70,.35)';
    ctx.lineWidth = 1;
    for (const f of [-0.35, 0, 0.35]) {
      ctx.beginPath();
      ctx.ellipse(cx + f * segW * grow * 0.6, cy, segW * grow * 0.12, r * 0.92, 0, 0, TAU);
      ctx.stroke();
    }
    // belly stripe and spine spike in the accent colour once coloured
    if (k > 0) {
      ctx.globalAlpha = k;
      ctx.fillStyle = colors[2];
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.55, segW * grow * 0.5, r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - segW * grow * 0.25, cy - r * 0.85);
      ctx.lineTo(cx, cy - r * 1.45);
      ctx.lineTo(cx + segW * grow * 0.25, cy - r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3a0a10';
      ctx.stroke();
      // the last stage adds gold scales
      if (st >= 2) {
        ctx.strokeStyle = '#ffe9a0';
        ctx.lineWidth = 1.4;
        for (let q = -1; q <= 1; q++) {
          ctx.beginPath();
          ctx.arc(cx + q * segW * grow * 0.22, cy - r * 0.1, r * 0.18, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    // the next segment to colour twinkles
    if (stage < 3 && i === Math.floor(colored) && k < 1) {
      ctx.fillStyle = `rgba(255,240,170,${0.35 + 0.25 * Math.sin(t * 6)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, segW * grow * 0.66, r * 1.05, 0, 0, TAU);
      ctx.fill();
    }
  }
  const hx = startX + total * segW * grow + head * 0.32;
  const headColored = stage >= 1 ? 1 : clamp01(fill * 2);
  dragonHead(ctx, hx, wave(total) - s * 0.15, head, colors, headColored, t);
  ctx.restore();
}

// ---- Table pieces ----

function paintBallChip(c, cx, cy, s) { lacquerBall(c, cx, cy, s * 0.38); }

function lacquerBall(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff2c0');
  g.addColorStop(0.35, '#ff4a3a');
  g.addColorStop(1, '#7a0a10');
  ctx.fillStyle = '#3a0008';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.08, r * 1.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, -0.3, Math.PI + 0.3);
  ctx.stroke();
}

function bumperLook(points) {
  if (points >= 50) return ['#ffe070', '#c07000', '#5a2a00'];
  if (points >= 25) return ['#ff6ab0', '#a0105a', '#4a0020'];
  return ['#6ad8ff', '#1a6ab0', '#0a2a50'];
}

export function openPlinko(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const pending = [];
  const g = openGame({ title: v.title, top: '#4a0e3a', bottom: '#14031c', onClose: () => settleAll() });
  const table = tableOf({ slots: v.game.slots, slotWidths: v.game.slotWidths, points: v.game.points });
  const fx = [];
  const words = [];
  const falling = []; // { b, ball, delay, trail: [[x,y]...] }
  const lit = new Map(); // obstacle id -> glow 0..1
  const slotFlash = new Array(table.slots.length).fill(0);
  const orbs = []; // tokens flying up to the stage bar: { x, y, age, n }
  const pops = []; // big "x10!" pops: { text, x, y, age, color, big }
  let launcherX = 180;
  let aiming = false;
  let windup = 0;
  let lastDrop = -1;
  let shownHave = v.game.have;
  let barBump = 0;
  let celebrate = null; // { age, done: [...], allDone }
  let growIn = 0;
  let refreshT = 0;
  let mateBump = {};
  let lastGave = {};
  let jiggle = 0;
  let closing = false;
  let staticLayer = null;

  const L = {};
  function layout() {
    const W = g.w;
    const H = g.h;
    L.bandH = Math.round(Math.max(118, Math.min(170, H * 0.21)));
    L.bandY = 6;
    L.teamY = L.bandY + L.bandH + 10;
    L.teamH = 40;
    const top = L.teamY + L.teamH + 10;
    const availH = H - top - 6;
    L.s = Math.min((W - 16) / TABLE.w, availH / TABLE.h);
    L.tw = TABLE.w * L.s;
    L.th = TABLE.h * L.s;
    L.tx = Math.round((W - L.tw) / 2);
    L.ty = Math.round(top + (availH - L.th) / 2);
    L.barW = 34;
    L.barX = W - 12 - L.barW;
    L.dragonW = L.barX - 22;
    staticLayer = null;
  }
  g.onResize = layout;
  layout();
  const tx = (x) => L.tx + x * L.s;
  const ty = (y) => L.ty + y * L.s;

  // The pegs, rails, frame and slot dividers never move: drawn once.
  function buildStatic() {
    const c = document.createElement('canvas');
    const d = g.dpr;
    c.width = Math.ceil(g.w * d);
    c.height = Math.ceil(g.h * d);
    const x = c.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    panel(x, L.tx, L.ty, L.tw, L.th, 14 * L.s + 4, ['#2a0a4a', '#12041e']);
    // soft lantern light at the top
    const gl = x.createRadialGradient(L.tx + L.tw / 2, L.ty, 0, L.tx + L.tw / 2, L.ty, L.th * 0.8);
    gl.addColorStop(0, 'rgba(255,150,90,.22)');
    gl.addColorStop(1, 'rgba(255,150,90,0)');
    x.fillStyle = gl;
    x.fillRect(L.tx, L.ty, L.tw, L.th);
    // slot floors, coloured by multiplier
    for (let i = 0; i < table.slots.length; i++) {
      const m = table.slots[i];
      const [a, b] = SLOT_COLORS[m] || SLOT_COLORS[1];
      const x0 = tx(table.edges[i]);
      const x1 = tx(table.edges[i + 1]);
      const y0 = ty(TABLE.slotTop + 8);
      const y1 = ty(TABLE.h) - 2;
      const gr = x.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, a);
      x.fillStyle = gr;
      x.fillRect(x0 + 1, y0, x1 - x0 - 2, y1 - y0);
    }
    for (const sg of table.segs) {
      if (sg.kind === 'kicker') continue; // drawn live (they flash)
      if (sg.ay === 0 && sg.by === 0) continue; // the ceiling is the frame
      if (sg.ax === sg.bx && (sg.ax === 0 || sg.ax === TABLE.w)) continue; // side walls are the frame
      x.strokeStyle = '#ffc83d';
      x.lineWidth = Math.max(2, 3 * L.s);
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(tx(sg.ax), ty(sg.ay));
      x.lineTo(tx(sg.bx), ty(sg.by) - 3);
      x.stroke();
    }
    for (const ci of table.circles) {
      if (ci.kind === 'bumper') continue; // drawn live
      const r = Math.max(2, ci.r * L.s);
      x.fillStyle = 'rgba(0,0,0,.4)';
      x.beginPath();
      x.arc(tx(ci.x), ty(ci.y) + 1.5, r, 0, TAU);
      x.fill();
      const pg = x.createRadialGradient(tx(ci.x) - r * 0.4, ty(ci.y) - r * 0.4, 0, tx(ci.x), ty(ci.y), r);
      pg.addColorStop(0, '#fff8d0');
      pg.addColorStop(1, ci.kind === 'cap' ? '#d09020' : '#e8b040');
      x.fillStyle = pg;
      x.beginPath();
      x.arc(tx(ci.x), ty(ci.y), r, 0, TAU);
      x.fill();
    }
    staticLayer = c;
  }

  function refresh() {
    const nv = api.view();
    if (!nv || !nv.game) { closing = true; g.close(); return; }
    // teammates who just gave more get a little bump
    for (const m of nv.game.teammates) {
      if (lastGave[m.name] !== undefined && m.gave > lastGave[m.name]) mateBump[m.name] = 1;
      lastGave[m.name] = m.gave;
    }
    v = nv;
    g.chip(String(v.game.balls), paintBallChip);
    const per = v.game.ballsPerWin;
    let text;
    if (v.game.over) text = 'The parade is complete. Every dragon is dancing!';
    else if (v.game.balls > 0) text = v.game.waiting
      ? `Your team gave all it can: ${fmt(v.game.yourPart)} more must come from you.`
      : 'Slide the lantern along the top and let go to drop a ball.';
    else text = `Out of balls. Win a level for ${per[0]} (harder ones up to ${per[per.length - 1]}).`;
    if (text !== noteText) {
      noteText = text;
      g.note(text);
      // The footer may have grown or shrunk: fit the canvas to what is left.
      // (The kit refits on a window resize.)
      requestAnimationFrame(() => { if (!g.closed) window.dispatchEvent(new Event('resize')); });
    }
  }
  let noteText = '';
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  for (const m of v.game.teammates) lastGave[m.name] = m.gave;
  refresh();

  // Balls dropped before (the screen was closed while they fell) run again
  // from the top: the same ball from the same spot takes the same path.
  for (const p of v.game.pending) {
    falling.push({ b: newBall(p.x, p.ball, v.game.seed), ball: p.ball, delay: 0.3 + falling.length * 0.25, trail: [] });
  }

  function inTable(x, y) { return x >= L.tx - 10 && x <= L.tx + L.tw + 10 && y >= L.ty - 30 && y <= L.ty + L.th; }
  const toTableX = (x) => Math.max(TABLE.dropMin, Math.min(TABLE.dropMax, (x - L.tx) / L.s));

  g.onDrag = {
    start(x, y) {
      if (!inTable(x, y) || celebrate) return;
      aiming = true;
      launcherX = toTableX(x);
    },
    move(x) { if (aiming) launcherX = toTableX(x); },
    end(x) {
      if (!aiming) return;
      aiming = false;
      launcherX = toTableX(x);
      tryDrop();
    },
    cancel() { aiming = false; },
  };

  function tryDrop() {
    if (v.game.over) return;
    if (v.game.balls < 1) {
      g.toast('No balls left. Win levels to earn more.');
      jiggle = 0.35;
      return;
    }
    if (g.t - lastDrop < DROP_GAP || falling.length >= MAX_FALLING) return;
    const out = api.act({ drop: launcherX });
    if (!out || !out.ok) { refresh(); return; }
    lastDrop = g.t;
    windup = WINDUP;
    v.game.balls = out.balls;
    g.chip(String(out.balls), paintBallChip);
    falling.push({ b: newBall(out.x, out.ball, out.seed), ball: out.ball, delay: WINDUP, trail: [] });
    burst(fx, tx(out.x), ty(TABLE.dropY) - 8, { n: 8, colors: ['#ffe070', '#fff'], speed: 90, size: 3, gravity: 0, life: 0.35 });
  }

  // A ball has landed: bank it and make a fuss.
  function landed(f) {
    const b = f.b;
    const points = Math.max(v.game.minPoints || 0, b.points);
    const mult = table.slots[b.slot];
    const out = api.act({ land: { ball: f.ball, points, mult } });
    if (closing) return out;
    const sx = tx((table.edges[b.slot] + table.edges[b.slot + 1]) / 2);
    const sy = ty(TABLE.slotTop + 30);
    slotFlash[b.slot] = 1;
    const big = mult >= 10;
    pops.push({ text: `×${mult}${big ? '!' : ''}`, x: sx, y: sy - 18, age: 0, color: (SLOT_COLORS[mult] || SLOT_COLORS[1])[0], big });
    burst(fx, sx, sy, { n: big ? 46 : 14 + mult * 2, colors: big ? ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'] : ['#fff3a0', (SLOT_COLORS[mult] || SLOT_COLORS[1])[0]], speed: big ? 420 : 200, size: big ? 6 : 4, kind: 'star', life: big ? 1.3 : 0.8 });
    if (big) jiggle = 0.25;
    if (!out || !out.ok) return out;
    v.game.mine = out.mine; // your card counts up at once
    words.push({ text: `+${fmt(out.tokens)}`, x: sx, y: sy - 46, age: 0, size: big ? 34 : 24, color: '#fff3a0', life: 1.4 });
    // tokens fly up to the stage bar
    const n = Math.min(10, 3 + Math.round(Math.log2(1 + out.tokens / 40)));
    for (let i = 0; i < n; i++) orbs.push({ x: sx + (Math.random() - 0.5) * 30, y: sy - 10, age: -i * 0.05, n: out.tokens / n });
    if (out.finished && out.finished.length) {
      // (a second stage filling during the celebration joins the queue)
      if (celebrate) { celebrate.done.push(...out.finished); celebrate.allDone = celebrate.allDone || out.allDone; }
      else celebrate = { age: 0, done: out.finished.slice(), allDone: out.allDone, shown: false };
    } else {
      // keep the bar honest with the rules (teammates may have given too)
      setTimeout(() => { if (!celebrate && !g.closed) refresh(); }, 650);
    }
    api.changed();
    return out;
  }

  // Leaving with balls still falling: finish them at once.
  function settleAll() {
    closing = true;
    for (const f of falling) {
      while (!f.b.done) stepBall(f.b, table);
      landed(f);
    }
    falling.length = 0;
    api.changed();
  }

  // After a stage fills: the dragon glows, then the prize card(s).
  async function runCelebration() {
    const c = celebrate;
    await new Promise((r) => setTimeout(r, 900));
    for (const st of c.done) {
      if (g.closed) return;
      const dr = v.game.dragons[st.dragon];
      const last = st.stage === 2;
      await g.prize(st.reward, last ? `${dr.name} is finished!` : `${dr.name}: stage ${st.stage + 1}!`,
        last ? 'Your team carries it into the parade.' : 'The dragon grows and takes more colour.');
    }
    if (c.allDone && !g.closed) {
      await g.prize(v.game.grand, 'The parade is complete!', 'All four dragons are dancing. The grand prize is yours.');
    }
    celebrate = null;
    if (g.closed) return;
    const oldDragon = v.game.dragon;
    refresh();
    shownHave = v.game.have;
    if (v.game.dragon !== oldDragon || c.done.length) growIn = 0.0001;
    if (c.allDone) { api.changed(); }
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    backdrop(ctx, g.w, g.h, '#4a0e3a', '#14031c', 'rgba(255,180,120,.16)');
    let jx = 0;
    if (jiggle > 0) { jiggle -= dt; jx = Math.sin(t * 60) * 3 * clamp01(jiggle / 0.25); }

    // live teammates
    refreshT += dt;
    if (refreshT > REFRESH_SECONDS && !celebrate) { refreshT = 0; refresh(); }

    // ---- the dragon and its stage bar ----
    panel(ctx, 10, L.bandY + 4, g.w - 20, L.bandH - 4, 16, ['#5a1440', '#2a0620']);
    const dIndex = G.dragon;
    const dr = G.dragons[Math.min(dIndex, G.dragons.length - 1)];
    const target = celebrate ? G.need : G.have;
    shownHave = lerp(shownHave, target, clamp01(dt * 5));
    if (Math.abs(shownHave - target) < 1) shownHave = target;
    const fill = G.over ? 1 : clamp01(shownHave / Math.max(1, G.need));
    let gscale = 1;
    if (growIn > 0) { growIn = Math.min(1, growIn + dt * 1.8); gscale = ease.outBack(growIn); if (growIn >= 1) growIn = 0; }
    ctx.save();
    const dcx = 10 + L.dragonW / 2;
    const dcy = L.bandY + L.bandH / 2 + 8;
    ctx.translate(dcx, dcy);
    ctx.scale(gscale, gscale);
    ctx.translate(-dcx, -dcy);
    drawDragon(ctx, 18, L.bandY + 26, L.dragonW - 8, L.bandH - 30, dr.colors, G.over ? 3 : G.stage, fill, t, celebrate ? 1 : G.over ? 0.6 : 0);
    ctx.restore();
    bigText(ctx, dr.name, 24, L.bandY + 20, 17, '#fff3a0', '#4a0018', 'left');
    bigText(ctx, G.over ? 'Complete!' : `Dragon ${dIndex + 1}/4 · Stage ${G.stage + 1}/3`, 24, L.bandY + 38, 12, '#ffd8e8', '#3a0018', 'left');
    // the bar
    const bx = L.barX;
    const by = L.bandY + 18;
    const bh = L.bandH - 64;
    if (barBump > 0) barBump = Math.max(0, barBump - dt * 3);
    const bw = L.barW * (1 + barBump * 0.12);
    panel(ctx, bx + (L.barW - bw) / 2, by, bw, bh, 10, ['#1a0418', '#0a0010']);
    const fh = (bh - 6) * fill;
    if (fh > 0) {
      const fg = ctx.createLinearGradient(0, by + bh - fh, 0, by + bh);
      fg.addColorStop(0, '#fff3a0');
      fg.addColorStop(0.3, dr.colors[0]);
      fg.addColorStop(1, dr.colors[1]);
      ctx.fillStyle = fg;
      rr(ctx, bx + (L.barW - bw) / 2 + 3, by + bh - 3 - fh, bw - 6, fh, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(bx + (L.barW - bw) / 2 + 6, by + bh - 3 - fh + 2, 4, Math.max(0, fh - 4));
    }
    // three notches: one per stage of this dragon
    for (let i = 0; i < 3; i++) {
      const px = bx + L.barW / 2 + (i - 1) * 11;
      const py = by + bh + 12;
      const done = G.over || i < G.stage;
      ctx.fillStyle = done ? '#3ee07a' : i === G.stage ? dr.colors[0] : 'rgba(255,255,255,.25)';
      ctx.beginPath();
      ctx.arc(px, py, i === G.stage && !G.over ? 5 : 4, 0, TAU);
      ctx.fill();
    }
    bigText(ctx, G.over ? 'Done' : `${fmt(shownHave)}`, bx + L.barW / 2, by + bh + 25, 12, '#fff', '#2a0018');
    bigText(ctx, G.over ? '' : `of ${fmt(G.need)}`, bx + L.barW / 2, by + bh + 37, 10, '#ffd0e0', '#2a0018');
    if (G.reward && !G.over) chest(ctx, bx + L.barW / 2, by - 4, 22, 0);
    if (G.waiting && !G.over && !celebrate) ribbon(ctx, 'The team is waiting on you!', 10 + L.dragonW / 2, L.bandY + L.bandH - 12, Math.min(230, L.dragonW - 40), 20);

    // ---- the team ----
    const team = [{ name: 'You', gave: G.mine, you: true }, ...G.teammates];
    const cw = (g.w - 20 - 6 * 3) / 4;
    team.forEach((m, i) => {
      const x = 10 + i * (cw + 6);
      const y = L.teamY;
      const bump = mateBump[m.name] || 0;
      if (bump > 0) mateBump[m.name] = Math.max(0, bump - dt * 2);
      const pulse = m.you && G.waiting ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
      panel(ctx, x, y - bump * 3, cw, L.teamH, 10, m.you ? [mix('#ffb21a', '#ff6a3a', pulse), '#a04a00'] : ['#4a2a7a', '#22104a'], m.you);
      ctx.save();
      ctx.font = `12px ${GAME_FONT}`;
      let name = m.name;
      while (name.length > 3 && ctx.measureText(name).width > cw - 10) name = name.slice(0, -1);
      if (name !== m.name) name = name.slice(0, -1) + '…';
      ctx.restore();
      bigText(ctx, name, x + cw / 2, y + 11 - bump * 3, 12, m.you ? '#fff' : '#e8d8ff', '#1a0630');
      bigText(ctx, fmt(m.gave), x + cw / 2, y + 28 - bump * 3, 16, '#fff3a0', '#2a0a00');
    });

    // ---- the table ----
    ctx.save();
    ctx.translate(jx, 0);
    if (!staticLayer) buildStatic();
    ctx.drawImage(staticLayer, 0, 0, g.w, g.h);
    // kickers
    for (const sg of table.segs) {
      if (sg.kind !== 'kicker') continue;
      const l = lit.get(sg.id) || 0;
      ctx.strokeStyle = mix('#ff4a8a', '#ffffff', l);
      ctx.lineWidth = Math.max(4, (6 + l * 3) * L.s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx(sg.ax), ty(sg.ay));
      ctx.lineTo(tx(sg.bx), ty(sg.by));
      ctx.stroke();
    }
    // bumpers
    for (const c of table.circles) {
      if (c.kind !== 'bumper') continue;
      const l = lit.get(c.id) || 0;
      const [a, b, line] = bumperLook(c.points);
      const r = c.r * L.s * (1 + 0.18 * ease.out(l));
      const x = tx(c.x);
      const y = ty(c.y);
      if (l > 0) {
        const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        gl.addColorStop(0, `rgba(255,250,210,${0.65 * l})`);
        gl.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = line;
      ctx.beginPath();
      ctx.arc(x, y + 2, r + 2, 0, TAU);
      ctx.fill();
      const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      bg.addColorStop(0, mix('#ffffff', a, 0.4 - 0.4 * l));
      bg.addColorStop(0.55, l > 0.5 ? '#ffffff' : a);
      bg.addColorStop(1, b);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fff3c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, 0, TAU);
      ctx.stroke();
      bigText(ctx, String(c.points), x, y + 1, Math.max(10, r * 0.85), '#fff', line);
    }
    for (const [id, l] of lit) { const n = l - dt * 2.5; if (n <= 0) lit.delete(id); else lit.set(id, n); }
    // slot labels and flashes
    for (let i = 0; i < table.slots.length; i++) {
      const m = table.slots[i];
      const x0 = tx(table.edges[i]);
      const x1 = tx(table.edges[i + 1]);
      const cx = (x0 + x1) / 2;
      const fl = slotFlash[i];
      if (fl > 0) {
        slotFlash[i] = Math.max(0, fl - dt * 1.6);
        ctx.fillStyle = `rgba(255,250,200,${0.55 * fl})`;
        ctx.fillRect(x0 + 1, ty(TABLE.slotTop), x1 - x0 - 2, ty(TABLE.h) - ty(TABLE.slotTop) - 2);
        if (m >= 10) rays(ctx, cx, ty(TABLE.h - 30), 90 * fl, t, `rgba(255,230,140,${0.35 * fl})`, 12);
      }
      const glowTen = m >= 10 ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
      const size = Math.min(20, (x1 - x0) * 0.5) * (1 + fl * 0.35 + glowTen * 0.06);
      bigText(ctx, `×${m}`, cx, ty(TABLE.h - 22), size, (SLOT_COLORS[m] || SLOT_COLORS[1])[0], '#1a0420');
    }

    // ---- the launcher (a paper lantern on a rail) ----
    const lx = tx(launcherX);
    const ly = L.ty - 2 + 14 * L.s;
    ctx.strokeStyle = 'rgba(255,220,140,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx(TABLE.dropMin), L.ty + 4);
    ctx.lineTo(tx(TABLE.dropMax), L.ty + 4);
    ctx.stroke();
    if (windup > 0) windup = Math.max(0, windup - dt);
    const squash = windup > 0 ? Math.sin((1 - windup / WINDUP) * Math.PI) : 0;
    const noBalls = G.balls < 1 || G.over;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(1 + squash * 0.25, 1 - squash * 0.3);
    ctx.globalAlpha = noBalls ? 0.45 : 1;
    const lw = 26 * Math.max(0.8, L.s);
    const lh = 20 * Math.max(0.8, L.s);
    const lg = ctx.createLinearGradient(0, -lh / 2, 0, lh / 2);
    lg.addColorStop(0, '#ff6a4a');
    lg.addColorStop(1, '#a00a1a');
    ctx.fillStyle = lg;
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, lw / 2, lh / 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(-lw * 0.22, -lh / 2 - 3, lw * 0.44, 4);
    ctx.fillRect(-lw * 0.22, lh / 2 - 1, lw * 0.44, 4);
    if (!noBalls) lacquerBall(ctx, 0, lh / 2 + 4, TABLE.ball * L.s * 0.8);
    ctx.restore();
    if (aiming) {
      // a dotted guide straight down from the lantern
      ctx.strokeStyle = 'rgba(255,240,180,.35)';
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(lx, ly + 14);
      ctx.lineTo(lx, ty(110));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!noBalls && !aiming && falling.length === 0 && g.t - lastDrop > 1.5) {
      // a hint: the hand sliding back and forth
      const hx = lx + Math.sin(t * 2) * 30;
      bigText(ctx, '⟷', hx, ly + 26, 18, 'rgba(255,240,180,.8)', 'rgba(40,0,30,.6)');
    }

    // ---- falling balls ----
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.acc = (f.acc || 0) + Math.min(dt, 0.05);
      while (f.acc >= TABLE.step && !f.b.done) {
        f.acc -= TABLE.step;
        for (const h of stepBall(f.b, table)) {
          lit.set(h.id, 1);
          if (h.kind !== 'peg') {
            words.push({ text: `+${h.points}`, x: tx(h.x), y: ty(h.y) - 8, age: 0, size: h.points >= 50 ? 24 : h.points >= 25 ? 20 : 16, color: h.points >= 50 ? '#ffe070' : '#fff', life: 0.9 });
            burst(fx, tx(h.x), ty(h.y), { n: h.points >= 25 ? 10 : 6, colors: [bumperLook(h.points)[0], '#fff'], speed: 160, size: 3, gravity: 200, life: 0.45, kind: 'star' });
          } else if (Math.random() < 0.5) {
            burst(fx, tx(h.x), ty(h.y), { n: 2, colors: ['#fff3a0'], speed: 60, size: 2, gravity: 0, life: 0.25 });
          }
        }
      }
      f.trail.push([tx(f.b.x), ty(f.b.y)]);
      if (f.trail.length > 6) f.trail.shift();
      f.trail.forEach(([x, y], k) => {
        ctx.fillStyle = `rgba(255,160,90,${(k / f.trail.length) * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, TABLE.ball * L.s * (0.4 + 0.5 * k / f.trail.length), 0, TAU);
        ctx.fill();
      });
      lacquerBall(ctx, tx(f.b.x), ty(f.b.y), TABLE.ball * L.s);
      // a running score above the ball
      if (f.b.points > 0) bigText(ctx, String(f.b.points), tx(f.b.x), ty(f.b.y) - TABLE.ball * L.s - 9, 11, '#fff', '#2a0a20');
      if (f.b.done) { falling.splice(i, 1); landed(f); }
    }
    ctx.restore();

    // ---- big pops ("x10!") ----
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.age += dt;
      const life = p.big ? 1.6 : 1.0;
      if (p.age > life) { pops.splice(i, 1); continue; }
      const k = p.age / life;
      const s = (p.big ? 54 : 30) * ease.outBack(clamp01(p.age / 0.25)) * (1 - 0.2 * k);
      ctx.globalAlpha = 1 - k * k;
      if (p.big) rays(ctx, p.x, p.y - 40 * k, s * 1.6, t, 'rgba(255,230,140,.3)', 12);
      bigText(ctx, p.text, p.x, p.y - 60 * ease.out(k), s, p.color, '#2a0420');
      ctx.globalAlpha = 1;
    }

    // ---- token orbs flying to the bar ----
    const ax = L.barX + L.barW / 2;
    const ay = L.bandY + 18 + (L.bandH - 64) * (1 - fill);
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.age += dt;
      if (o.age < 0) continue;
      const k = ease.inOut(clamp01(o.age / 0.75));
      const x = lerp(o.x, ax, k) + Math.sin(k * Math.PI) * 40 * (i % 2 ? 1 : -1);
      const y = lerp(o.y, ay, k) - Math.sin(k * Math.PI) * 50;
      ctx.fillStyle = '#ffe070';
      ctx.strokeStyle = '#a05a00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (o.age >= 0.75) {
        orbs.splice(i, 1);
        barBump = 1;
        burst(fx, ax, ay, { n: 4, colors: ['#fff3a0', dr.colors[0]], speed: 90, size: 3, gravity: 0, life: 0.35, kind: 'star' });
      }
    }

    // ---- a stage filling: the band glows, then the prizes ----
    if (celebrate) {
      celebrate.age += dt;
      if (!celebrate.shown) {
        celebrate.shown = true;
        burst(fx, 10 + L.dragonW / 2, L.bandY + L.bandH / 2, { n: 60, colors: ['#ffe070', '#fff', dr.colors[0], dr.colors[2]], speed: 380, size: 6, kind: 'star', life: 1.4 });
        words.push({ text: 'Stage complete!', x: g.w / 2, y: L.bandY + L.bandH / 2, age: 0, size: 30, color: '#fff3a0', life: 1.6 });
        runCelebration();
      }
    }

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);

    // ---- nothing to drop ----
    if (G.balls < 1 && !G.over && falling.length === 0 && !celebrate) {
      const w = Math.min(280, g.w - 40);
      const y = L.ty + L.th * 0.42;
      ctx.fillStyle = 'rgba(10,2,20,.55)';
      rr(ctx, L.tx, L.ty, L.tw, L.th, 14);
      ctx.fill();
      panel(ctx, g.w / 2 - w / 2, y - 50, w, 100, 18, ['#7a1a4a', '#3a0624']);
      bigText(ctx, 'Out of balls!', g.w / 2, y - 22, 26, '#fff3a0', '#3a0018');
      bigText(ctx, `Win a level: +${G.ballsPerWin[0]} to +${G.ballsPerWin[G.ballsPerWin.length - 1]} balls`, g.w / 2, y + 10, 15, '#fff', '#3a0018');
      bigText(ctx, 'Tap "Play a level" below', g.w / 2, y + 32, 13, '#ffd8e8', '#3a0018');
    }
  };
  return g;
}
