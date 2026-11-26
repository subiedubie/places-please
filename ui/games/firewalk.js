// THE FIRE WALK: its own play screen (rules in meta/events/firewalk.js).
// A striped big top, a pit of glowing stage coals and seven stepping stones
// across it. Your walker (piggy, cat, fox, owl or bunny) hops one stone for
// every level won on the first try. After each hop the crowd count drops
// with a big "-30!". A slip is a puff of smoke and a bounce back to the shore.
//
// The hops happen while you play levels, so this screen replays whatever it
// has not shown yet when it opens (the rules keep `seen` for that).
import {
  openGame, panel, bigText, ribbon, chest, coin, burst, sparks, floaters, rays, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { addPicture } from '../eventicons.js';

// ---- The walkers ----
const LOOKS = {
  piggy: { body: '#ffb0c8', dark: '#d8708e', ear: '#ff8fb0', name: 'Piggy' },
  cat: { body: '#ffb35a', dark: '#c2742a', ear: '#ffcf96', name: 'Cat' },
  fox: { body: '#ff7a2a', dark: '#b84a10', ear: '#3a1a08', name: 'Fox' },
  owl: { body: '#b48a5e', dark: '#6e4e30', ear: '#8a643e', name: 'Owl' },
  bunny: { body: '#f4eefc', dark: '#b8a8d8', ear: '#ffb8d0', name: 'Bunny' },
};

// One walker, standing on (x, y) (its feet), `s` tall. sx / sy squash and
// stretch it; blink 0..1 closes the eyes; dizzy draws stars round its head.
export function drawWalker(ctx, kind, x, y, s, { sx = 1, sy = 1, blink = 0, dizzy = 0, t = 0, sooty = 0 } = {}) {
  const L = LOOKS[kind] || LOOKS.piggy;
  const r = s * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.translate(0, -r);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.strokeStyle = '#3a1020';
  const fillBody = () => {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.25, L.body);
    g.addColorStop(1, L.dark);
    return g;
  };
  // ears (behind the head)
  ctx.fillStyle = L.body;
  if (kind === 'bunny') {
    for (const d of [-1, 1]) {
      ctx.save();
      ctx.rotate(d * 0.18);
      ctx.beginPath();
      ctx.ellipse(d * r * 0.38, -r * 1.25, r * 0.22, r * 0.62, 0, 0, TAU);
      ctx.fillStyle = L.body;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(d * r * 0.38, -r * 1.22, r * 0.1, r * 0.45, 0, 0, TAU);
      ctx.fillStyle = L.ear;
      ctx.fill();
      ctx.restore();
    }
  } else if (kind === 'owl') {
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * r * 0.35, -r * 0.75);
      ctx.lineTo(d * r * 0.85, -r * 1.25);
      ctx.lineTo(d * r * 0.8, -r * 0.45);
      ctx.closePath();
      ctx.fillStyle = L.ear;
      ctx.fill();
      ctx.stroke();
    }
  } else {
    const tall = kind === 'fox' ? 1.35 : kind === 'cat' ? 1.15 : 0.95;
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * r * 0.2, -r * 0.8);
      ctx.lineTo(d * r * 0.72, -r * tall);
      ctx.lineTo(d * r * 0.88, -r * 0.35);
      ctx.closePath();
      ctx.fillStyle = L.body;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d * r * 0.36, -r * 0.72);
      ctx.lineTo(d * r * 0.7, -r * (tall - 0.12));
      ctx.lineTo(d * r * 0.78, -r * 0.48);
      ctx.closePath();
      ctx.fillStyle = L.ear;
      ctx.fill();
    }
  }
  // head / body: one round shape
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.96, 0, 0, TAU);
  ctx.fillStyle = fillBody();
  ctx.fill();
  ctx.stroke();
  // face patches
  if (kind === 'fox') {
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, r * 0.05);
    ctx.quadraticCurveTo(-r * 0.3, r * 0.05, 0, r * 0.55);
    ctx.quadraticCurveTo(r * 0.3, r * 0.05, r * 0.85, r * 0.05);
    ctx.quadraticCurveTo(r * 0.6, r * 0.85, 0, r * 0.92);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.85, -r * 0.85, r * 0.05);
    ctx.fill();
  }
  if (kind === 'owl') {
    ctx.fillStyle = '#f6e2c0';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.5, r * 0.42, 0, 0, TAU);
    ctx.fill();
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(d * r * 0.36, -r * 0.12, r * 0.33, 0, TAU);
      ctx.fillStyle = '#fff4dc';
      ctx.fill();
      ctx.strokeStyle = '#8a5a2a';
      ctx.stroke();
    }
    ctx.strokeStyle = '#3a1020';
  }
  // eyes
  const ey = kind === 'owl' ? -r * 0.12 : -r * 0.12;
  const ex = kind === 'owl' ? r * 0.36 : r * 0.34;
  const er = kind === 'owl' ? r * 0.16 : r * 0.12;
  for (const d of [-1, 1]) {
    if (dizzy > 0) {
      ctx.strokeStyle = '#2a0a1a';
      ctx.lineWidth = Math.max(1.5, s * 0.035);
      ctx.beginPath();
      ctx.moveTo(d * ex - er, ey - er);
      ctx.lineTo(d * ex + er, ey + er);
      ctx.moveTo(d * ex + er, ey - er);
      ctx.lineTo(d * ex - er, ey + er);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#2a0a1a';
    ctx.beginPath();
    ctx.ellipse(d * ex, ey, er, er * Math.max(0.12, 1 - blink), 0, 0, TAU);
    ctx.fill();
    if (blink < 0.5) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(d * ex - er * 0.35, ey - er * 0.4, er * 0.38, 0, TAU);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#3a1020';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  // noses and mouths
  if (kind === 'piggy') {
    ctx.fillStyle = '#ff8fb0';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.3, r * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#9a2a4a';
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * r * 0.1, r * 0.3, r * 0.05, r * 0.08, 0, 0, TAU); ctx.fill(); }
  } else if (kind === 'owl') {
    ctx.fillStyle = '#ffb21a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.08);
    ctx.lineTo(r * 0.12, r * 0.08);
    ctx.lineTo(0, r * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = kind === 'bunny' ? '#ff8fb0' : '#3a1020';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.14);
    ctx.lineTo(r * 0.1, r * 0.14);
    ctx.lineTo(0, r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, r * 0.34);
    ctx.quadraticCurveTo(-r * 0.05, r * 0.42, 0, r * 0.28);
    ctx.quadraticCurveTo(r * 0.05, r * 0.42, r * 0.16, r * 0.34);
    ctx.stroke();
    if (kind === 'bunny') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-r * 0.07, r * 0.36, r * 0.14, r * 0.14);
      ctx.strokeRect(-r * 0.07, r * 0.36, r * 0.14, r * 0.14);
    }
    if (kind === 'cat') {
      ctx.lineWidth = Math.max(1, s * 0.02);
      for (const d of [-1, 1]) for (const k of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * r * 0.25, r * (0.2 + k * 0.1));
        ctx.lineTo(d * r * 0.75, r * (0.12 + k * 0.2));
        ctx.stroke();
      }
    }
  }
  // rosy cheeks
  ctx.fillStyle = 'rgba(255,80,120,.28)';
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * r * 0.6, r * 0.22, r * 0.14, r * 0.09, 0, 0, TAU); ctx.fill(); }
  // a little soot after a slip
  if (sooty > 0) {
    ctx.globalAlpha = 0.45 * sooty;
    ctx.fillStyle = '#2a2a2a';
    for (const [a, b, c] of [[-0.5, 0.5, 0.2], [0.45, -0.55, 0.16], [0.2, 0.6, 0.12]]) { ctx.beginPath(); ctx.arc(r * a, r * b, r * c, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (dizzy > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, dizzy);
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * TAU) / 3;
      star(ctx, x + Math.cos(a) * r * 0.9, y - s * 0.98 + Math.sin(a) * r * 0.25, s * 0.09, '#ffe070');
    }
    ctx.restore();
  }
}

function star(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const rr2 = k % 2 ? s * 0.45 : s;
    const a = -Math.PI / 2 + (k * TAU) / 10;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fill();
}

// A flame tongue standing on (x, y), `h` tall, flickering with t.
function flame(ctx, x, y, w, h, t, seed) {
  const f = 0.85 + 0.15 * Math.sin(t * 9 + seed * 3.1) + 0.08 * Math.sin(t * 17 + seed);
  const top = y - h * f;
  const lean = Math.sin(t * 3 + seed) * w * 0.25;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.5 * f, x + lean, top);
  ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.5 * f, x + w / 2, y);
  ctx.closePath();
  ctx.fill();
}

// A stepping stone: a flat rock lit orange from the coals underneath.
function stoneRock(ctx, x, y, w, crossed, pulse, seed) {
  const h = w * 0.42;
  ctx.save();
  // glow from below
  const gl = ctx.createRadialGradient(x, y + h * 0.4, 0, x, y + h * 0.4, w * 0.8);
  gl.addColorStop(0, 'rgba(255,150,40,.55)');
  gl.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x - w, y - h, w * 2, h * 2.4);
  // side
  ctx.fillStyle = '#2a1410';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.28, w * 0.5, h * 0.55, 0, 0, TAU);
  ctx.fill();
  const side = ctx.createLinearGradient(0, y, 0, y + h * 0.8);
  side.addColorStop(0, '#5a3a34');
  side.addColorStop(1, '#ff7a20');
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.2, w * 0.48, h * 0.5, 0, 0, Math.PI);
  ctx.fill();
  // top
  const top = ctx.createLinearGradient(0, y - h * 0.5, 0, y + h * 0.3);
  if (crossed) { top.addColorStop(0, '#fff0a8'); top.addColorStop(1, '#d08a20'); }
  else { top.addColorStop(0, '#9a8a94'); top.addColorStop(1, '#4e4048'); }
  ctx.fillStyle = top;
  ctx.strokeStyle = crossed ? '#7a4000' : '#2a1a20';
  ctx.lineWidth = Math.max(1.5, w * 0.03);
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.48, h * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // a crack and a highlight
  ctx.strokeStyle = crossed ? 'rgba(120,60,0,.4)' : 'rgba(20,10,10,.4)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.2, y - h * 0.05 + (seed % 3) * 2);
  ctx.lineTo(x - w * 0.02, y + h * 0.08);
  ctx.lineTo(x + w * 0.16, y - h * 0.1);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.16, y - h * 0.16, w * 0.14, h * 0.08, -0.2, 0, TAU);
  ctx.fill();
  if (pulse > 0) {
    ctx.strokeStyle = `rgba(255,230,120,${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, w * (0.56 + 0.06 * pulse), h * (0.52 + 0.06 * pulse), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
function timeLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}
const DOT_COLORS = ['#ff4f7a', '#3a9bff', '#18c060', '#ffb21a', '#a64bff', '#ff8412', '#0fb4d0', '#ffe070'];
const ZIG = [-0.5, 0.45, -0.38, 0.55, -0.45, 0.3, -0.12];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function paintCoinChip(c, cx, cy, s) { coin(c, cx, cy, s * 0.4); }

// api: { view(), act(action), play(), changed() }
export function openFirewalk(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#4a0a1a', bottom: '#1a0408' });
  const fx = [];
  const words = [];
  const embers = [];
  let bg = null; // the big top and the pit, drawn once per size
  const L = {};

  // What is on screen (it lags the rules while animations play).
  let shownStone = 0;   // where the walker stands: 0 = shore, 1..7 stones, 8 = far side
  let leftShown = 100;  // the players-left number as drawn
  let leftTo = 100;
  let leftBump = 0;
  let anim = null;      // the animation playing now
  let busy = false;
  let picking = false;  // the avatar chooser is open
  let blinkAt = 2;
  let crowdDots = [];   // the 100 dots of the opening crowd
  let banner = null;    // { text, color, age }
  let celebrate = 0;
  let soot = 0;
  let idleHop = 0;   // a little jump when the walker is tapped
  let endShown = false; // today's slip or finish has been played

  function layout() {
    const W = g.w;
    const H = g.h;
    L.hudY = 8;
    L.hudH = 70;
    L.farY = L.hudY + L.hudH + Math.min(80, H * 0.11);
    L.nearY = H - 54;
    L.stoneW = Math.min(W * 0.22, 92);
    L.amp = Math.min(W * 0.3, 150);
    L.spots = [];
    // 0 = the near shore, 1..7 the stones, 8 = the far side.
    for (let i = 0; i <= 8; i++) {
      const d = i / 8;
      const k = i === 8 ? 1 : ease.out(d) * 0.9; // a clear gap before the far side
      const y = lerp(L.nearY - 10, L.farY + 12, k);
      const x = i === 0 || i === 8 ? W / 2 : W / 2 + ZIG[i - 1] * L.amp * (1 - d * 0.35);
      L.spots.push({ x, y, s: lerp(1, 0.6, d) });
    }
    bg = null;
  }

  // The still parts, drawn once: tent stripes, valance, bunting, the pit.
  function paintBackdrop() {
    const W = g.w;
    const H = g.h;
    const c = document.createElement('canvas');
    c.width = Math.round(W * g.dpr);
    c.height = Math.round(H * g.dpr);
    const b = c.getContext('2d');
    b.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    // the tent: stripes fanning from a peak above the screen
    const px = W / 2;
    const py = -H * 0.35;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * 0.18 + (Math.PI * 0.64 * i) / n;
      const a1 = Math.PI * 0.18 + (Math.PI * 0.64 * (i + 1)) / n;
      b.fillStyle = i % 2 ? '#f6e4c8' : '#c8102e';
      b.beginPath();
      b.moveTo(px, py);
      b.lineTo(px + Math.cos(a0) * H * 3, py + Math.sin(a0) * H * 3);
      b.lineTo(px + Math.cos(a1) * H * 3, py + Math.sin(a1) * H * 3);
      b.closePath();
      b.fill();
    }
    // darken toward the bottom (the tent in shadow behind the fire)
    const dk = b.createLinearGradient(0, 0, 0, H);
    dk.addColorStop(0, 'rgba(40,0,20,.35)');
    dk.addColorStop(0.5, 'rgba(30,0,10,.7)');
    dk.addColorStop(1, 'rgba(10,0,0,.95)');
    b.fillStyle = dk;
    b.fillRect(0, 0, W, H);
    // the gold valance with scallops along the top (behind the counters)
    b.fillStyle = '#7a3c00';
    b.fillRect(0, 0, W, 6);
    const sc = 26;
    for (let x = 0; x < W + sc; x += sc) {
      const gg = b.createLinearGradient(0, 0, 0, sc * 0.6);
      gg.addColorStop(0, '#ffe070');
      gg.addColorStop(1, '#c07000');
      b.fillStyle = gg;
      b.beginPath();
      b.arc(x, 4, sc / 2, 0, Math.PI);
      b.fill();
    }
    // the pit of coals between the shores
    const top = L.farY - 4;
    const bot = L.nearY + 4;
    b.save();
    b.beginPath();
    b.moveTo(W * 0.2, top);
    b.lineTo(W * 0.8, top);
    b.lineTo(W + 20, bot);
    b.lineTo(-20, bot);
    b.closePath();
    const pit = b.createLinearGradient(0, top, 0, bot);
    pit.addColorStop(0, '#5a0c00');
    pit.addColorStop(0.5, '#c83200');
    pit.addColorStop(1, '#ff6a00');
    b.fillStyle = pit;
    b.fill();
    b.clip();
    // coal lumps with hot cracks
    let s = 1234;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 260; i++) {
      const y = lerp(top, bot, Math.sqrt(rnd()));
      const d = (y - top) / (bot - top);
      const x = rnd() * W;
      const r = lerp(3, 11, d) * (0.6 + rnd() * 0.6);
      b.fillStyle = `rgba(${30 + rnd() * 30},${8 + rnd() * 10},${6},.9)`;
      b.beginPath();
      b.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
      b.fill();
      if (rnd() < 0.6) {
        b.strokeStyle = `rgba(255,${120 + rnd() * 100},20,.8)`;
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(x - r * 0.5, y);
        b.lineTo(x + r * 0.1, y - r * 0.2);
        b.lineTo(x + r * 0.5, y + r * 0.1);
        b.stroke();
      }
    }
    b.restore();
    // the far side: a little platform with a flag
    const far = L.spots[8];
    panel(b, far.x - 70, far.y - 4, 140, 22, 8, ['#8a4a1a', '#4a1a08'], true);
    b.fillStyle = '#5a2a10';
    b.fillRect(far.x + 52, far.y - 46, 3, 44);
    b.fillStyle = '#ffc21a';
    b.beginPath();
    b.moveTo(far.x + 55, far.y - 46);
    b.lineTo(far.x + 78, far.y - 39);
    b.lineTo(far.x + 55, far.y - 32);
    b.closePath();
    b.fill();
    // the near shore: stage planks
    const ny = L.nearY;
    const planks = b.createLinearGradient(0, ny, 0, H);
    planks.addColorStop(0, '#b0682a');
    planks.addColorStop(1, '#5a2a0a');
    b.fillStyle = planks;
    b.fillRect(0, ny, W, H - ny);
    b.fillStyle = '#ffd890';
    b.fillRect(0, ny, W, 3);
    b.strokeStyle = 'rgba(60,20,0,.5)';
    b.lineWidth = 1;
    for (let x = 30; x < W; x += 46) { b.beginPath(); b.moveTo(x, ny + 3); b.lineTo(x - 8, H); b.stroke(); }
    bg = c;
  }

  g.onResize = layout;
  layout();

  // ---- the footer, the chip and the note ----
  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    g.chip(fmt(G.pot), paintCoinChip);
    const list = [];
    if (G.state === 'offer') list.push({ text: 'Start the walk', cls: 'primary', onClick: startWalk });
    else if (G.state === 'running') list.push({ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } });
    list.push({ text: `Walker: ${LOOKS[G.avatar]?.name || 'Piggy'}`, cls: '', onClick: () => { picking = !picking; } });
    g.buttons(list);
    if (G.state === 'offer') {
      const last = G.last;
      g.note(last && last.result === 'won' ? `Yesterday you made it across: ${fmt(last.share)} coins. Again?`
        : 'Win 7 levels in a row, each on the first try, before midnight.');
    } else if (G.state === 'running') {
      const left = G.stones - G.stone;
      g.note(`${left} more first-try ${left === 1 ? 'win' : 'wins'} to cross. A loss or a retry and you slip.`);
    } else if (G.state === 'won') {
      g.note(G.others ? `You and ${G.others} ${G.others === 1 ? 'other' : 'others'} shared ${fmt(G.pot)}. A new walk at midnight.` : `You crossed alone: all ${fmt(G.pot)} were yours. A new walk at midnight.`);
    } else {
      g.note(`You slipped on stone ${G.fell}. A new walk starts at midnight.`);
    }
  }

  function startWalk() {
    if (busy) return;
    const out = api.act({ start: true });
    api.changed();
    refresh();
    if (out && out.ok) play();
  }

  // ---- the replay: crowd, hops, then the ending ----
  async function play() {
    if (busy) return;
    busy = true;
    let G = v.game;
    if (G.state !== 'offer' && !G.seenStart) {
      await crowdIntro(G.players);
      api.act({ seenStart: true });
    }
    G = (v = api.view()).game;
    for (let k = G.seen + 1; k <= G.stone; k++) {
      await hop(k, G.counts[k - 1] - G.counts[k], G.counts[k]);
      api.act({ seen: k });
      await wait(250);
    }
    G = (v = api.view()).game;
    if (!G.seenEnd && (G.state === 'won' || G.state === 'lost')) {
      if (G.state === 'won') await finish(G);
      else await slip();
      endShown = true;
      api.act({ seenEnd: true });
    }
    api.changed();
    refresh();
    busy = false;
  }

  // An animation that runs for `dur` seconds; draw(k, age) is called each frame.
  const run = (kind, dur) => new Promise((done) => { anim = { kind, dur, age: 0, done }; });

  function crowdIntro(players) {
    const sp = L.spots[0];
    crowdDots = [];
    for (let i = 0; i < players; i++) {
      const a = Math.random() * TAU;
      const r = 30 + Math.random() * Math.min(g.w * 0.42, 170);
      crowdDots.push({ x0: sp.x, y0: sp.y - 10, x1: sp.x + Math.cos(a) * r, y1: sp.y - 20 + Math.sin(a) * r * 0.35, c: DOT_COLORS[i % DOT_COLORS.length], d: Math.random() * 0.6 });
    }
    leftShown = 0;
    leftTo = 0;
    banner = { text: `${players} players step up!`, color: ['#ffb21a', '#b05a00'], age: 0 };
    return run('crowd', 2.4).then(() => { crowdDots = []; leftShown = players; leftTo = players; });
  }

  // One hop to stone `to`; then the crowd count drops by `drop` to `left`.
  async function hop(to, drop, left) {
    await run('hop', 1.15);
    shownStone = to;
    await wait(180); // a beat of suspense before the number
    leftTo = left;
    leftBump = 1;
    if (drop > 0) words.push({ text: `-${drop}!`, x: g.w / 2, y: L.hudY + L.hudH + 120, age: 0, size: 60, life: 1.6, color: '#ff5a3a', stroke: '#3a0000' });
    else words.push({ text: 'Nobody fell!', x: g.w / 2, y: L.hudY + L.hudH + 120, age: 0, size: 28, life: 1.4 });
    await wait(700);
  }

  function slip() {
    return run('slip', 2.6).then(() => {
      shownStone = 0;
      banner = { text: 'Slipped! Back tomorrow', color: ['#7a7a9a', '#3a3a5a'], age: 0 };
      return wait(900);
    });
  }

  async function finish(G) {
    await run('hop', 1.15);
    shownStone = 8;
    celebrate = 0.0001;
    banner = { text: 'Across the coals!', color: ['#3ee07a', '#0a8a3a'], age: 0 };
    burst(fx, L.spots[8].x, L.spots[8].y - 30, { n: 60, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 420, size: 6, kind: 'star', life: 1.5 });
    await wait(2300); // let the banner finish first
    const sub = G.others
      ? `You and ${G.others} ${G.others === 1 ? 'other' : 'others'} share ${fmt(G.pot)}: ${fmt(G.share)} each.`
      : `You walked it alone: all ${fmt(G.pot)} coins are yours!`;
    await g.prize({ coins: G.share }, 'You crossed!', sub);
  }

  // ---- taps: only the avatar chooser lives on the canvas ----
  function pickerCells() {
    const n = v.game.avatars.length;
    const cw = Math.min(64, (g.w - 60) / n);
    const x0 = (g.w - cw * n) / 2;
    const y = g.h * 0.5;
    return v.game.avatars.map((a, i) => ({ a, x: x0 + cw * i + cw / 2, y, r: cw / 2 }));
  }
  g.onTap = (x, y) => {
    if (!picking) {
      // a tap on the walker makes it jump for joy
      const sp = L.spots[shownStone];
      if (!anim && Math.hypot(x - sp.x, y - (sp.y - 30)) < 50) { idleHop = 0.0001; burst(fx, sp.x, sp.y - 20, { n: 8, colors: ['#ffe070', '#fff'], speed: 140, size: 4, kind: 'star', gravity: 0, life: 0.5 }); }
      return;
    }
    for (const c of pickerCells()) {
      if (Math.hypot(x - c.x, y - c.y) < c.r + 6) {
        const out = api.act({ avatar: c.a });
        if (out && out.ok) {
          burst(fx, c.x, c.y, { n: 18, colors: ['#ffe070', '#fff', '#ff7ab0'], speed: 200, size: 5, kind: 'star', life: 0.8 });
          words.push({ text: LOOKS[c.a].name + '!', x: c.x, y: c.y - c.r - 10, age: 0, size: 22 });
          setTimeout(() => { picking = false; refresh(); }, 450);
          v = api.view();
        }
        return;
      }
    }
    picking = false;
  };

  // ---- drawing ----
  function walkerAt(i) { const sp = L.spots[i]; return { x: sp.x, y: sp.y - L.stoneW * sp.s * 0.12, s: 62 * sp.s }; }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    if (!bg) paintBackdrop();
    ctx.drawImage(bg, 0, 0, g.w, g.h);

    // the coals breathe
    const glow = 0.22 + 0.08 * Math.sin(t * 2.3) + 0.04 * Math.sin(t * 7.1);
    const mid = (L.farY + L.nearY) / 2;
    const gl = ctx.createRadialGradient(g.w / 2, mid + 40, 10, g.w / 2, mid + 40, g.h * 0.55);
    gl.addColorStop(0, `rgba(255,190,60,${glow})`);
    gl.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, L.farY - 20, g.w, L.nearY - L.farY + 40);

    // flames licking up along both sides of the pit
    ctx.fillStyle = 'rgba(255,120,20,.75)';
    for (let i = 0; i < 4; i++) {
      const d = (i + 0.5) / 4;
      const y = lerp(L.farY + 20, L.nearY - 4, d);
      const xl = lerp(g.w * 0.2, -10, d) + 14;
      const xr = g.w - xl;
      const h = lerp(26, 52, d);
      flame(ctx, xl, y, h * 0.5, h, t, i);
      flame(ctx, xr, y, h * 0.5, h, t, i + 7);
    }
    ctx.fillStyle = 'rgba(255,230,120,.8)';
    for (let i = 0; i < 4; i++) {
      const d = (i + 0.5) / 4;
      const y = lerp(L.farY + 20, L.nearY - 4, d);
      const xl = lerp(g.w * 0.2, -10, d) + 14;
      const h = lerp(13, 26, d);
      flame(ctx, xl, y, h * 0.5, h, t * 1.3, i + 3);
      flame(ctx, g.w - xl, y, h * 0.5, h, t * 1.3, i + 11);
    }

    // embers drifting up
    if (embers.length < 46 && Math.random() < dt * 30) {
      embers.push({ x: g.w * (0.1 + Math.random() * 0.8), y: lerp(L.farY, L.nearY, Math.random()), vy: -30 - Math.random() * 50, life: 1.2 + Math.random() * 1.6, age: 0, r: 1 + Math.random() * 2.2, ph: Math.random() * TAU });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.age += dt;
      if (e.age > e.life) { embers.splice(i, 1); continue; }
      e.y += e.vy * dt;
      const x = e.x + Math.sin(t * 2 + e.ph) * 8;
      ctx.globalAlpha = 1 - e.age / e.life;
      ctx.fillStyle = e.r > 2 ? '#ffe070' : '#ff8a2a';
      ctx.beginPath();
      ctx.arc(x, e.y, e.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // the stones, far ones first
    // after a slip the walker is back on the shore, but the stones it
    // reached stay gold
    const reached = endShown && G.state === 'lost' ? G.stone : Math.min(7, shownStone);
    for (let i = 7; i >= 1; i--) {
      const sp = L.spots[i];
      const next = G.state === 'running' && !busy && i === shownStone + 1;
      stoneRock(ctx, sp.x, sp.y, L.stoneW * sp.s, i <= reached, next ? 0.5 + 0.5 * Math.sin(t * 5) : 0, i);
      if (next) bigText(ctx, String(i), sp.x, sp.y + L.stoneW * sp.s * 0.02, 14 * sp.s + 4, '#ffe070', '#3a1000');
    }

    // the pot waiting on the far side
    const far = L.spots[8];
    rays(ctx, far.x - 46, far.y - 18, 40, t, 'rgba(255,230,140,.25)', 10);
    chest(ctx, far.x - 46, far.y - 14, 34, celebrate > 0 ? clamp01(celebrate * 2) : 0);
    bigText(ctx, fmt(G.pot), far.x + 34, far.y + 7, 13, '#ffe070', '#3a1000');

    // the opening crowd: dots burst out of the shore, then fly to the counter
    if (crowdDots.length && anim) {
      const age = anim.age;
      const hudX = g.w / 2;
      const hudY = L.hudY + L.hudH / 2;
      let arrived = 0;
      for (const d of crowdDots) {
        const k1 = ease.outBack(clamp01(age / 0.6));
        let x = lerp(d.x0, d.x1, k1);
        let y = lerp(d.y0, d.y1, k1) - Math.sin(clamp01(age / 0.6) * Math.PI) * 30;
        const k2 = clamp01((age - 0.8 - d.d) / 0.55);
        if (k2 >= 1) { arrived++; continue; }
        if (k2 > 0) {
          const e = ease.in(k2);
          x = lerp(x, hudX, e);
          y = lerp(y, hudY, e) - Math.sin(k2 * Math.PI) * 40;
        }
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.arc(x, y, 4.5 * (1 - k2 * 0.4), 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath();
        ctx.arc(x - 1.3, y - 1.5, 1.4, 0, TAU);
        ctx.fill();
      }
      if (arrived > leftShown) leftBump = 0.4;
      leftShown = leftTo = arrived;
    }

    if (G.state === 'offer' && !crowdDots.length) {
      // the crowd waiting on the shore
      const sp = L.spots[0];
      for (let i = 0; i < 26; i++) {
        const x = sp.x + (i - 12.5) * Math.min(12, g.w / 30) + Math.sin(i * 7.3) * 4;
        const y = sp.y + 12 + Math.sin(i * 3.1) * 5 - Math.abs(Math.sin(t * 3 + i)) * 3;
        ctx.fillStyle = DOT_COLORS[i % DOT_COLORS.length];
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, TAU);
        ctx.fill();
      }
    }
    // ---- the walker ----
    blinkAt -= dt;
    let blink = 0;
    if (blinkAt < 0.12) blink = 1 - Math.abs(blinkAt / 0.06 - 1);
    if (blinkAt < 0) blinkAt = 2 + Math.random() * 3;
    let wx;
    let wy;
    let ws;
    let sx = 1;
    let sy = 1;
    let dizzy = 0;
    const here = walkerAt(shownStone);
    wx = here.x; wy = here.y; ws = here.s;
    const breathe = 1 + 0.03 * Math.sin(t * 3);
    sy = breathe; sx = 2 - breathe;
    if (soot > 0) soot = Math.max(0, soot - dt * 0.2);

    if (anim) {
      anim.age += dt;
      const a = anim.age;
      if (anim.kind === 'hop') {
        // HOP: wind-up squash, flight with stretch, landing squash
        const from = walkerAt(shownStone);
        const to = walkerAt(Math.min(8, shownStone + 1));
        if (a < 0.2) {
          const k = a / 0.2;
          sx = 1 + 0.3 * ease.out(k); sy = 1 - 0.3 * ease.out(k);
        } else if (a < 0.72) {
          const k = (a - 0.2) / 0.52;
          wx = lerp(from.x, to.x, k);
          // a high arc, but never up behind the counters
          const lift = Math.min(48 + Math.abs(to.y - from.y) * 0.3, Math.min(from.y, to.y) - (L.hudY + L.hudH + 40));
          wy = lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * Math.max(20, lift);
          ws = lerp(from.s, to.s, k);
          const st = Math.sin(k * Math.PI);
          sx = 1 - 0.18 * (1 - st); sy = 1 + 0.25 * (1 - st);
          if (Math.random() < 0.5) burst(fx, wx, wy, { n: 1, colors: ['#ffe070', '#ff8a2a'], speed: 30, size: 3, gravity: -60, life: 0.4 });
        } else {
          const k = clamp01((a - 0.72) / 0.43);
          wx = to.x; wy = to.y; ws = to.s;
          if (!anim.landed) {
            anim.landed = true;
            burst(fx, to.x, to.y, { n: 18, colors: ['#ffe070', '#ff8a2a', '#fff'], speed: 220, size: 4, life: 0.7 });
            burst(fx, to.x, to.y, { n: 8, colors: ['#ffc21a'], speed: 120, size: 6, kind: 'star', gravity: 0, life: 0.6 });
          }
          const sq = Math.sin(k * Math.PI) * (1 - k);
          sx = 1 + 0.35 * sq; sy = 1 - 0.35 * sq;
        }
      } else if (anim.kind === 'slip') {
        // SLIP: jump for the next stone, fall short, puff of smoke, bounce home
        const from = walkerAt(shownStone);
        const goal = walkerAt(Math.min(7, shownStone + 1));
        const pitX = lerp(from.x, goal.x, 0.55);
        const pitY = lerp(from.y, goal.y, 0.55) + 10;
        const home = walkerAt(0);
        if (a < 0.2) { const k = a / 0.2; sx = 1 + 0.3 * k; sy = 1 - 0.3 * k; }
        else if (a < 0.65) {
          const k = (a - 0.2) / 0.45;
          wx = lerp(from.x, pitX, k);
          wy = lerp(from.y, pitY, k) - Math.sin(k * Math.PI) * 50;
          ws = lerp(from.s, goal.s, k * 0.5);
        } else if (a < 1.25) {
          wx = pitX; wy = pitY + 18; ws = from.s; sx = 1.1; sy = 0.4;
          if (!anim.puffed) {
            anim.puffed = true;
            burst(fx, pitX, pitY, { n: 26, colors: ['#d8d0e0', '#9a90a8', '#ffffff', '#6a6070'], speed: 160, size: 11, gravity: -120, life: 1.2 });
            burst(fx, pitX, pitY, { n: 12, colors: ['#ffe070', '#ff8a2a'], speed: 260, size: 3, life: 0.6 });
            words.push({ text: 'Ouch!', x: pitX, y: pitY - 40, age: 0, size: 30, color: '#fff', stroke: '#3a0000' });
            soot = 1;
          }
          ctx.globalAlpha = 0; // hidden in the smoke
        } else {
          // boing, boing, home
          const k = clamp01((a - 1.25) / 1.1);
          const hops = 2;
          const seg = Math.min(hops - 1, Math.floor(k * hops));
          const kk = k * hops - seg;
          const p0 = seg === 0 ? { x: pitX, y: pitY } : { x: lerp(pitX, home.x, 0.5), y: lerp(pitY, home.y, 0.5) };
          const p1 = seg === 0 ? { x: lerp(pitX, home.x, 0.5), y: lerp(pitY, home.y, 0.5) } : home;
          wx = lerp(p0.x, p1.x, kk);
          wy = lerp(p0.y, p1.y, kk) - Math.sin(kk * Math.PI) * (seg === 0 ? 110 : 50);
          ws = lerp(from.s, home.s, k);
          dizzy = 1;
          const st = Math.sin(kk * Math.PI);
          sx = 1 - 0.12 * (1 - st); sy = 1 + 0.15 * (1 - st);
        }
      } else if (anim.kind === 'crowd') {
        // the crowd intro: the walker bounces with excitement
        wy -= Math.abs(Math.sin(a * 8)) * 10;
      }
      if (anim.age >= anim.dur) {
        const done = anim.done;
        anim = null;
        ctx.globalAlpha = 1;
        done();
      }
    } else if (idleHop > 0) {
      idleHop += dt;
      const k = clamp01(idleHop / 0.5);
      wy -= Math.sin(k * Math.PI) * 30;
      sx = 1 - 0.1 * Math.sin(k * Math.PI); sy = 1 + 0.12 * Math.sin(k * Math.PI);
      if (k >= 1) idleHop = 0;
    } else if (v.game.state === 'lost') {
      dizzy = 0.6;
    }
    // shadow
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.35;
    ctx.fillStyle = '#000';
    const ground = walkerAt(shownStone);
    ctx.beginPath();
    ctx.ellipse(wx, Math.max(wy, ground.y) + 2, ws * 0.36, ws * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    drawWalker(ctx, v.game.avatar, wx, wy, ws, { sx, sy, blink, dizzy, t, sooty: soot });
    ctx.globalAlpha = 1;
    if (v.game.state === 'won' && shownStone === 8 && !anim) {
      // a little crown for the one who crossed
      ctx.fillStyle = '#ffc21a';
      ctx.strokeStyle = '#7a4000';
      ctx.lineWidth = 1.5;
      const cy = wy - ws * 0.98;
      ctx.beginPath();
      ctx.moveTo(wx - 12, cy + 8); ctx.lineTo(wx - 12, cy - 2); ctx.lineTo(wx - 6, cy + 3); ctx.lineTo(wx, cy - 6);
      ctx.lineTo(wx + 6, cy + 3); ctx.lineTo(wx + 12, cy - 2); ctx.lineTo(wx + 12, cy + 8); ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (celebrate > 0) {
      celebrate += dt;
      if (Math.random() < dt * 8) burst(fx, Math.random() * g.w, L.farY - 20, { n: 6, colors: DOT_COLORS, speed: 120, size: 4, kind: 'chip', gravity: 300, life: 1.4 });
    }

    // ---- the HUD: pot, players left, time left ----
    const gap = 8;
    const pw = (g.w - 24 - gap * 2) / 3;
    const y0 = L.hudY;
    const ph = L.hudH;
    // players left (middle, biggest)
    if (Math.abs(leftShown - leftTo) > 0.01) leftShown = leftTo < leftShown ? Math.max(leftTo, leftShown - dt * Math.max(20, (leftShown - leftTo) * 3)) : leftTo;
    if (leftBump > 0) leftBump = Math.max(0, leftBump - dt * 2);
    const bump = 1 + 0.25 * ease.out(leftBump);
    panel(ctx, 12, y0, pw, ph, 14, ['#6a1a3a', '#3a0a1a']);
    bigText(ctx, 'POT', 12 + pw / 2, y0 + 14, 12, '#ffe070', '#3a1000');
    coin(ctx, 12 + 16, y0 + 44, 9);
    bigText(ctx, fmt(G.pot), 12 + pw / 2 + 8, y0 + 44, Math.min(22, pw * 0.2), '#fff', '#3a1000');
    const mx = 12 + pw + gap;
    panel(ctx, mx, y0 - 4, pw, ph + 8, 16, ['#ff6a1a', '#a01a00']);
    bigText(ctx, 'PLAYERS LEFT', mx + pw / 2, y0 + 10, Math.min(12, pw * 0.11), '#fff3c0', '#5a1000');
    bigText(ctx, String(Math.round(G.state === 'offer' && !crowdDots.length ? G.players : leftShown)), mx + pw / 2, y0 + 42, 34 * bump, '#fff', '#5a1000');
    const rx = 12 + 2 * (pw + gap);
    panel(ctx, rx, y0, pw, ph, 14, ['#6a1a3a', '#3a0a1a']);
    bigText(ctx, 'TIME LEFT', rx + pw / 2, y0 + 14, 12, '#ffe070', '#3a1000');
    bigText(ctx, timeLeft(G.endsAt - Date.now()), rx + pw / 2, y0 + 44, Math.min(20, pw * 0.18), '#fff', '#3a1000');

    // stone progress pips under the HUD
    const pipY = y0 + ph + 18;
    const pipW = Math.min(26, (g.w - 80) / 7);
    const px0 = g.w / 2 - (pipW * 7 + 6 * 6) / 2;
    for (let i = 0; i < 7; i++) {
      const on = i < reached;
      const x = px0 + i * (pipW + 6);
      ctx.fillStyle = on ? '#ffc21a' : 'rgba(40,0,10,.65)';
      ctx.strokeStyle = on ? '#7a4000' : 'rgba(255,220,160,.5)';
      ctx.lineWidth = 1.5;
      rr(ctx, x, pipY - 6, pipW, 12, 6);
      ctx.fill();
      ctx.stroke();
    }

    // the state ribbon over the near shore
    if (!anim && !banner) {
      const by = L.nearY + 26;
      if (G.state === 'offer') ribbon(ctx, 'Press Start to walk', g.w / 2, by, 210, 30, ['#ffb21a', '#b05a00']);
      else if (G.state === 'running' && !busy) ribbon(ctx, shownStone ? `Stone ${shownStone} of 7` : 'Win to hop on!', g.w / 2, by, 170, 30);
      else if (G.state === 'won') ribbon(ctx, `${fmt(G.share)} coins each`, g.w / 2, by, 200, 30, ['#3ee07a', '#0a8a3a']);
      else if (G.state === 'lost') ribbon(ctx, 'Back tomorrow', g.w / 2, by, 170, 30, ['#7a7a9a', '#3a3a5a']);
    }
    if (banner) {
      banner.age += dt;
      const k = ease.outBack(clamp01(banner.age / 0.35));
      const fade = banner.age > 1.8 ? 1 - clamp01((banner.age - 1.8) / 0.4) : 1;
      ctx.globalAlpha = fade;
      ctx.save();
      ctx.translate(g.w / 2, g.h * 0.46);
      ctx.scale(k, k);
      ribbon(ctx, banner.text, 0, 0, Math.min(g.w - 60, 290), 42, banner.color);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (banner.age > 2.2) banner = null;
    }

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);

    // ---- the avatar chooser ----
    if (picking) {
      ctx.fillStyle = 'rgba(10,2,20,.7)';
      ctx.fillRect(0, 0, g.w, g.h);
      const cells = pickerCells();
      const top = cells[0].y - cells[0].r - 70;
      panel(ctx, 16, top, g.w - 32, cells[0].r * 2 + 120, 20, ['#5b24b8', '#2a0b6e']);
      bigText(ctx, 'Choose your walker', g.w / 2, top + 26, 22, '#ffe070', '#3a1000');
      for (const c of cells) {
        const mine = c.a === v.game.avatar;
        if (mine) rays(ctx, c.x, c.y, c.r * 1.2, t, 'rgba(255,230,140,.3)', 10);
        ctx.fillStyle = mine ? 'rgba(255,230,140,.25)' : 'rgba(255,255,255,.08)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, TAU);
        ctx.fill();
        drawWalker(ctx, c.a, c.x, c.y + c.r * 0.55, c.r * 1.35, { t, blink: 0 });
        bigText(ctx, LOOKS[c.a].name, c.x, c.y + c.r + 16, 13, mine ? '#ffe070' : '#fff', '#2a0a5e');
      }
      bigText(ctx, 'Tap one', g.w / 2, cells[0].y + cells[0].r + 40, 14, '#fff3c0', '#2a0a5e');
    }
  };

  // Start where the screen last left off, then replay what is new.
  refresh();
  {
    const G = v.game;
    shownStone = G.state === 'won' && G.seenEnd ? 8 : G.state === 'lost' && G.seenEnd ? 0 : Math.min(G.seen, G.stone);
    endShown = !!G.seenEnd;
    const base = G.seenStart ? G.counts[Math.min(shownStone, G.stone)] ?? G.players : G.players;
    leftShown = leftTo = G.state === 'offer' ? G.players : base;
    if (G.state !== 'offer') play();
  }
  return g;
}

// ---- The Home badge: a stepping stone over glowing coals, with a flame ----
addPicture('firewalk', {
  types: ['firewalk'],
  colors: ['#ff6a1a', '#6a1400'],
  badge: ['#ffe2c0', '#e07a30'],
  paint(ctx) {
    const pit = ctx.createLinearGradient(0, 56, 0, 92);
    pit.addColorStop(0, '#c83200');
    pit.addColorStop(1, '#ff8a10');
    ctx.fillStyle = pit;
    ctx.beginPath();
    ctx.ellipse(50, 74, 40, 16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a1008';
    for (const [x, y, r] of [[30, 74, 5], [44, 80, 6], [62, 78, 5], [72, 72, 4], [38, 68, 3]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,140,20,.9)';
    flame(ctx, 26, 70, 14, 30, 0.3, 1);
    flame(ctx, 76, 70, 12, 24, 0.9, 4);
    ctx.fillStyle = '#ffe070';
    flame(ctx, 26, 70, 7, 15, 0.3, 2);
    stoneRock(ctx, 50, 66, 40, false, 0, 1);
    drawWalker(ctx, 'piggy', 50, 64, 40, {});
  },
});
