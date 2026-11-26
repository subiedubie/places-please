// PINATA PARTY: its own screen (a ladder with `pinata: true`; rules in
// meta/events/ladder.js). Three big pinatas, one per step. Candies from
// levels won fill the one hanging now (harder levels pay three and five
// times as many). When it is full its prize is already in the tray, and
// the screen hands you the stick: tap to whack it (it swings and cracks),
// and on the last hit it bursts, showering candy and showing the prize.
//   api.act({ smash: step })  tells the rules it was opened
import { addPicture } from '../eventicons.js';
import {
  openGame, panel, bigText, ribbon, burst, sparks, floaters, rays, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { num, clockText, drawReward, seenNote, footer, bar, launchOrbs, drawOrbs } from './showkit.js';

const MAX_W = 520;
const PAPER = [
  ['#ff4f9a', '#ffd23a', '#3ad0ff', '#7a3ad8'],
  ['#ff7a1a', '#3ee07a', '#ff3a5a', '#ffe070'],
  ['#ffd23a', '#ffb000', '#fff3a0', '#ff4f9a'],
];
const CANDY = ['#ff3a5a', '#3a8bff', '#ffd23a', '#3ee07a', '#a64bff', '#ff7ab0'];
const TIER_NAMES = ['Rehearsal', 'Preview', 'Opening Night', 'Command Perf.'];

// A star pinata, `s` across, with crack lines (0..1) and a swing angle.
function pinata(ctx, x, y, s, colors, crack = 0, angle = 0, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // the cones
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(s * 0.25, 0, s * 0.62, 0);
    g.addColorStop(0, colors[i % 4]);
    g.addColorStop(1, colors[(i + 1) % 4]);
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(60,0,40,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.22, -s * 0.13);
    ctx.lineTo(s * 0.6, 0);
    ctx.lineTo(s * 0.22, s * 0.13);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // a tassel on each tip
    ctx.strokeStyle = colors[(i + 2) % 4];
    ctx.lineWidth = 2;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.6, 0);
      ctx.lineTo(s * 0.68 + Math.sin(t * 6 + k + i) * 2, k * 3);
      ctx.stroke();
    }
    ctx.restore();
  }
  // the round body with frilly paper stripes
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.clip();
  for (let k = -4; k <= 4; k++) {
    ctx.fillStyle = colors[(k + 8) % 4];
    ctx.fillRect(-s * 0.3, k * s * 0.075 - s * 0.0375, s * 0.6, s * 0.075);
    // the fringe
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let f = -6; f <= 6; f++) {
      ctx.beginPath();
      ctx.moveTo(f * s * 0.05, k * s * 0.075 + s * 0.0375);
      ctx.lineTo(f * s * 0.05 + s * 0.025, k * s * 0.075 + s * 0.0375);
      ctx.lineTo(f * s * 0.05 + s * 0.0125, k * s * 0.075 + s * 0.012);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,0,40,.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.stroke();
  // cracks
  if (crack > 0) {
    ctx.strokeStyle = '#2a0a1a';
    ctx.lineWidth = Math.max(1.5, s * 0.012);
    const n = Math.ceil(crack * 6);
    for (let i = 0; i < n; i++) {
      let px = Math.cos(i * 2.4) * s * 0.06;
      let py = Math.sin(i * 2.4) * s * 0.06;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let j = 0; j < 4; j++) {
        px += Math.cos(i * 2.4 + j * 0.8 - 0.4) * s * 0.07 * crack;
        py += Math.sin(i * 2.4 + j * 1.1) * s * 0.07 * crack;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // a smiley face
  ctx.fillStyle = '#2a0a1a';
  ctx.beginPath(); ctx.arc(-s * 0.09, -s * 0.05, s * 0.025, 0, TAU); ctx.arc(s * 0.09, -s * 0.05, s * 0.025, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a0a1a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.08, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function candy(ctx, x, y, r, color, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.7, -r * 0.6); ctx.lineTo(-r * 1.7, r * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 1.7, -r * 0.6); ctx.lineTo(r * 1.7, r * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.25, r * 0.35, r * 0.18, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

function stick(ctx, x, y, s, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-s * 0.05, 0, s * 0.05, 0);
  g.addColorStop(0, '#ffcf8a');
  g.addColorStop(1, '#a0602a');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#4a2000';
  ctx.lineWidth = 2;
  rr(ctx, -s * 0.05, -s, s * 0.1, s, s * 0.05); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff3a5a';
  for (let i = 0; i < 4; i++) ctx.fillRect(-s * 0.05, -s + i * s * 0.22 + s * 0.05, s * 0.1, s * 0.06);
  ctx.restore();
}

addPicture('pinata', {
  ids: ['pinata'],
  colors: ['#ff4f9a', '#8a0a4a'],
  badge: ['#ffe6f1', '#ef9fc2'],
  paint(ctx) {
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, 4); ctx.lineTo(50, 22); ctx.stroke();
    pinata(ctx, 50, 52, 76, PAPER[0], 0, 0.12, 0);
  },
});

export function openPinata(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#7a1a8a', bottom: '#2a0638', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const orbs = [];
  const candies = []; // falling candies: { x, y, vx, vy, c, spin, vs, age }
  const seen = seenNote(api, v);
  const before = seen.get();
  let swing = 0; // pinata swing angle velocity model
  let angle = 0;
  let hits = 0;
  let whack = -1; // stick animation age
  let burstAge = -1; // the pinata bursting
  let busy = false;
  let shownHave = before && before.step === v.game.step ? Math.min(before.have || 0, v.game.have) : v.game.have;
  const L = {};

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    if (G.toSmash.length) { g.buttons([]); window.dispatchEvent(new Event('resize')); }
    else footer(g, api);
    const pt = G.perTier || [1, 1, 1, 1];
    g.note(G.toSmash.length ? 'Tap the piñata to swing the stick!' : `Candies per win: ${pt[0]} · ${pt[1]} · ${pt[2]} (Opening Night) · ${pt[3]} (Command Performance)`);
  }
  refresh();
  seen.set({ step: v.game.step, have: v.game.have });
  // Candies won since the last look fly in.
  if (before && v.game.toSmash.length === 0 && v.game.have > shownHave) {
    const gain = v.game.have - shownHave;
    setTimeout(() => {
      words.push({ text: `+${num(gain)} candies`, x: g.w / 2, y: (L.py || 200) + 90, age: 0, size: 26, color: '#fff3a0', life: 1.6 });
      launchOrbs(orbs, Math.min(20, Math.max(4, Math.round(gain / 10))), { x: g.w / 2, y: g.h - 30, spread: g.w * 0.7 }, { x: g.w / 2, y: L.py || 200 }, {
        colors: CANDY, delay: 0.1,
        onArrive: (o) => { shownHave = Math.min(v.game.have, shownHave + gain / Math.min(20, Math.max(4, Math.round(gain / 10)))); swing += 0.6 * (Math.random() - 0.5); if (o.last) shownHave = v.game.have; },
      });
    }, 300);
  } else shownHave = v.game.have;

  g.onTap = (x, y) => {
    const G = v.game;
    if (!G.toSmash.length || busy || burstAge >= 0) {
      burst(fx, x, y, { n: 8, colors: CANDY, speed: 120, size: 3, gravity: 0, life: 0.4 });
      return;
    }
    if (whack >= 0) return;
    whack = 0; // wind up, then hit (see draw)
  };

  function hit() {
    const G = v.game;
    hits++;
    swing += (Math.random() < 0.5 ? -1 : 1) * (0.6 + hits * 0.12);
    burst(fx, g.w / 2, L.py, { n: 10, colors: PAPER[Math.min(G.toSmash[0], 2)], speed: 220, size: 4, kind: 'chip', life: 0.6 });
    words.push({ text: hits >= G.hits ? 'SMASH!' : ['WHACK!', 'BONK!', 'THWACK!'][hits % 3], x: g.w / 2 + (Math.random() - 0.5) * 80, y: L.py - 60, age: 0, size: 28 + hits * 3 });
    if (hits >= G.hits) smash();
  }

  async function smash() {
    const G = v.game;
    const i = G.toSmash[0];
    busy = true;
    const out = api.act({ smash: i });
    if (!out || !out.ok) { busy = false; hits = 0; refresh(); return; }
    burstAge = 0;
    burst(fx, g.w / 2, L.py, { n: 60, colors: [...PAPER[Math.min(i, 2)], '#fff'], speed: 460, size: 6, kind: 'chip', life: 1.3 });
    burst(fx, g.w / 2, L.py, { n: 30, colors: ['#fff3a0', '#fff'], speed: 380, size: 6, kind: 'star', life: 1.1 });
    for (let k = 0; k < 70; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const sp = 200 + Math.random() * 420;
      candies.push({ x: g.w / 2, y: L.py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: CANDY[k % CANDY.length], spin: Math.random() * TAU, vs: (Math.random() - 0.5) * 12, age: 0 });
    }
    await wait(1300);
    await g.prize(out.reward, `Piñata ${i + 1} smashed!`, 'Sweet!');
    if (out.grand) await g.prize(out.grand, 'Party complete!', 'The grand prize, for all three.');
    hits = 0;
    burstAge = -1;
    busy = false;
    api.changed();
    if (out.allDone) { g.close(); return; }
    refresh();
    shownHave = v.game.have;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    // ---- the party room ----
    const bg = ctx.createLinearGradient(0, 0, 0, g.h);
    bg.addColorStop(0, '#7a1a8a');
    bg.addColorStop(1, '#2a0638');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, g.w, g.h);
    const spot = ctx.createRadialGradient(g.w / 2, g.h * 0.4, 0, g.w / 2, g.h * 0.4, g.h * 0.6);
    spot.addColorStop(0, 'rgba(255,220,255,.22)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, g.w, g.h);
    // bunting
    for (let row = 0; row < 2; row++) {
      const yb = 16 + row * 22;
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, yb); ctx.quadraticCurveTo(g.w / 2, yb + 18, g.w, yb); ctx.stroke();
      for (let i = 0, x = row * 14; x < g.w; i++, x += 28) {
        const sag = yb + Math.sin((x / g.w) * Math.PI) * 9;
        ctx.fillStyle = CANDY[(i + row * 3) % CANDY.length];
        ctx.beginPath(); ctx.moveTo(x, sag); ctx.lineTo(x + 20, sag); ctx.lineTo(x + 10, sag + 16 + Math.sin(t * 3 + i) * 1.5); ctx.closePath(); ctx.fill();
      }
    }

    // ---- the three pinatas, small, as the steps ----
    const pyTop = 70;
    for (let i = 0; i < G.stepCount; i++) {
      const x = X + W / 2 + (i - (G.stepCount - 1) / 2) * 96;
      const smashed = G.smashed.includes(i);
      const full = i < G.step;
      const cur = i === (G.toSmash[0] ?? G.step);
      ctx.globalAlpha = smashed ? 0.35 : 1;
      if (cur) rays(ctx, x, pyTop + 18, 40, t, 'rgba(255,240,170,.3)', 10);
      pinata(ctx, x, pyTop + 18, 50, PAPER[Math.min(i, 2)], smashed ? 1 : 0, Math.sin(t * 2 + i) * 0.1, t);
      ctx.globalAlpha = 1;
      bigText(ctx, smashed ? '✓' : full ? 'FULL!' : num(v.steps[i].need), x, pyTop + 56, 13, full && !smashed ? '#7affa0' : '#ffe9a8');
    }

    // ---- the big one ----
    const cur = G.toSmash.length ? G.toSmash[0] : Math.min(G.step, G.stepCount - 1);
    // as big as fits between the small row and the candy card (later ones bigger)
    const size = Math.max(90, Math.min(W * 0.72 * (1 + 0.1 * cur), (g.h - pyTop - 110 - 92) / 1.25));
    L.py = pyTop + 110 + size * 0.55;
    // swinging on its rope (a damped pendulum)
    swing += -angle * 18 * dt;
    swing *= Math.pow(0.25, dt);
    angle += swing * dt;
    const idle = G.toSmash.length ? Math.sin(t * 3) * 0.04 : Math.sin(t * 1.3) * 0.05;
    const ang = angle + idle;
    const ropeTop = pyTop + 78;
    const px = g.w / 2 + Math.sin(ang) * (L.py - ropeTop);
    ctx.strokeStyle = '#d8b080';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(g.w / 2, ropeTop); ctx.lineTo(px, L.py - size * 0.3); ctx.stroke();
    if (burstAge < 0) {
      if (G.toSmash.length) rays(ctx, px, L.py, size * 0.8, t * 1.5, 'rgba(255,240,170,.22)', 14);
      const shake = G.toSmash.length && hits > 0 ? (Math.random() - 0.5) * hits * 1.5 : 0;
      pinata(ctx, px + shake, L.py, size, PAPER[Math.min(cur, 2)], G.toSmash.length ? hits / G.hits : 0, ang * 0.6, t);
    } else burstAge += dt;

    // ---- the stick ----
    if (G.toSmash.length && burstAge < 0) {
      let a = -0.4 + Math.sin(t * 2) * 0.05;
      if (whack >= 0) {
        whack += dt;
        if (whack < 0.16) a = lerp(-0.4, -1.3, ease.out(whack / 0.16)); // wind-up
        else if (whack < 0.26) a = lerp(-1.3, 0.5, ease.in((whack - 0.16) / 0.1));
        else a = lerp(0.5, -0.4, clamp01((whack - 0.26) / 0.2));
        if (whack >= 0.26 && !L.struck) { L.struck = true; hit(); }
        if (whack >= 0.46) { whack = -1; L.struck = false; }
      }
      stick(ctx, g.w / 2 + size * 0.62, L.py + size * 0.75, size * 0.85, a - 0.3);
      if (hits === 0 && whack < 0) {
        const k = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.globalAlpha = 0.7 + 0.3 * k;
        ribbon(ctx, 'TAP TO SMASH!', g.w / 2, L.py + size * 0.58, 200, 34, ['#ffd23a', '#c07000']);
        ctx.globalAlpha = 1;
      }
      // hits left, as little sticks
      for (let i = 0; i < G.hits; i++) {
        ctx.globalAlpha = i < hits ? 0.25 : 1;
        stick(ctx, X + W / 2 + (i - (G.hits - 1) / 2) * 18, g.h - 30, 26, 0);
        ctx.globalAlpha = 1;
      }
    }

    // ---- falling candy ----
    for (let i = candies.length - 1; i >= 0; i--) {
      const c = candies[i];
      c.age += dt;
      c.vy += 900 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.spin += c.vs * dt;
      if (c.y > g.h - 16) { c.y = g.h - 16; c.vy *= -0.35; c.vx *= 0.7; }
      if (c.age > 3) { candies.splice(i, 1); continue; }
      ctx.globalAlpha = clamp01(3 - c.age);
      candy(ctx, c.x, c.y, 7, c.c, c.spin);
      ctx.globalAlpha = 1;
    }

    // ---- the candy count ----
    if (!G.toSmash.length && G.step < G.stepCount) {
      const cy = g.h - 78;
      panel(ctx, X + 16, cy, W - 32, 68, 16, ['#5b24b8', '#2a0b6e']);
      candy(ctx, X + 42, cy + 22, 10, CANDY[0], 0.3);
      bar(ctx, X + 64, cy + 10, W - 100, 22, shownHave / G.need, ['#ffb0d8', '#e0187a'], `${num(Math.round(shownHave))} / ${num(G.need)} candies`, 14);
      bigText(ctx, 'Inside:', X + 40, cy + 50, 13, '#ffe9a8', '#2a0a5e', 'left');
      drawReward(ctx, v.steps[G.step].reward, X + 96, cy + 50, 15, 'left');
    }
    if (G.step >= G.stepCount && !G.toSmash.length) bigText(ctx, 'All three smashed!', X + W / 2, g.h - 40, 22, '#ffe070', '#3a1000');
    if (v.endsAt) clockText(ctx, v.endsAt, X + W - 14, 58, 13, 'right');

    drawOrbs(ctx, orbs, dt);
    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
