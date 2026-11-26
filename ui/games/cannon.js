// THE PIRATE MATINEE: the cannon game's own play screen (rules and physics
// in meta/events/voyage.js). A pirate show: painted cardboard sea creatures
// hang on fly lines over a stage sea of sliding wave strips. The ship's bow
// sits at the bottom with a swivel cannon. Drag anywhere to aim (the dashed
// line shows the path to the first bounce), let go to fire: one shot is
// three cannonballs. Balls ricochet off the proscenium, the top and the
// props; every bounce off a prop takes one point. Fire again while balls
// are still flying.
//
// The screen does the flying and reports each volley's hits when its last
// ball has fallen (and any still in the air when the screen is closed).
import { addPicture } from '../eventicons.js';
import {
  openGame, panel, bigText, ribbon, chest, coin, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { stepBall, launch, aimAt, aimPath } from '../../meta/events/voyage.js';

// ---- Pictures --------------------------------------------------------------

const CARD = '#5a3418'; // the brown edge of the cardboard
const INK = '#2a160a';

// A cannonball: dark iron with a shine.
function ball(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#9aa0b8');
  g.addColorStop(0.45, '#3a3e52');
  g.addColorStop(1, '#0c0d16');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// Each prop: `shape` makes the outline path (used for the cardboard edge and
// the white hit flash), `face` paints the front. Drawn round (0, 0), radius R.
const PROPS = {
  octopus: {
    shape(ctx, R) {
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.18, R * 0.78, R * 0.7, 0, 0, TAU);
      for (let i = 0; i < 5; i++) {
        const x = -R * 0.68 + i * R * 0.34;
        ctx.moveTo(x + R * 0.21, R * 0.52);
        ctx.arc(x, R * 0.52, R * 0.21, 0, TAU);
      }
    },
    face(ctx, R, t) {
      const g = ctx.createLinearGradient(0, -R, 0, R);
      g.addColorStop(0, '#ff8ad0');
      g.addColorStop(1, '#a02a8a');
      ctx.fillStyle = g;
      PROPS.octopus.shape(ctx, R);
      ctx.fill();
      // curly tentacle tips
      ctx.strokeStyle = '#7a1a6a';
      ctx.lineWidth = Math.max(1, R * 0.07);
      for (let i = 0; i < 5; i++) {
        const x = -R * 0.68 + i * R * 0.34;
        ctx.beginPath();
        ctx.arc(x, R * 0.55, R * 0.1, Math.PI * 0.2, Math.PI * 1.6 + Math.sin(t * 3 + i) * 0.3);
        ctx.stroke();
      }
      // spots
      ctx.fillStyle = 'rgba(255,230,250,.55)';
      for (const [x, y, s] of [[-0.45, -0.55, 0.1], [0.5, -0.45, 0.08], [0.1, -0.75, 0.07]]) {
        ctx.beginPath(); ctx.arc(x * R, y * R, s * R, 0, TAU); ctx.fill();
      }
      eyes(ctx, R, -0.28, -0.15, 0.2, t);
    },
  },
  crab: {
    shape(ctx, R) {
      ctx.beginPath();
      ctx.ellipse(0, R * 0.15, R * 0.8, R * 0.52, 0, 0, TAU);
      for (const s of [-1, 1]) {
        ctx.moveTo(s * R * 0.7 + R * 0.3, -R * 0.5);
        ctx.arc(s * R * 0.7, -R * 0.5, R * 0.3, 0, TAU);
      }
    },
    face(ctx, R, t) {
      ctx.strokeStyle = '#8a1a0a';
      ctx.lineWidth = Math.max(1.5, R * 0.1);
      ctx.lineCap = 'round';
      // legs and arms (behind)
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(s * R * 0.5, R * (0.25 + k * 0.15));
          ctx.lineTo(s * R * 0.98, R * (0.4 + k * 0.2));
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(s * R * 0.4, 0);
        ctx.lineTo(s * R * 0.65, -R * 0.35);
        ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, -R, 0, R);
      g.addColorStop(0, '#ff8a4a');
      g.addColorStop(1, '#c0300a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, R * 0.15, R * 0.8, R * 0.52, 0, 0, TAU);
      ctx.fill();
      // claws that snap
      const snap = 0.25 + 0.2 * Math.max(0, Math.sin(t * 4));
      for (const s of [-1, 1]) {
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s * R * 0.7, -R * 0.5, R * 0.3, s > 0 ? -Math.PI + snap : snap, s > 0 ? Math.PI - snap : TAU - snap);
        ctx.lineTo(s * R * 0.7, -R * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,220,180,.5)';
      ctx.beginPath();
      ctx.ellipse(-R * 0.25, -R * 0.05, R * 0.25, R * 0.1, -0.3, 0, TAU);
      ctx.fill();
      eyes(ctx, R, -0.2, -0.12, 0.15, t, true);
    },
  },
  coil: {
    // a hump of sea serpent rising out of a painted wave
    shape(ctx, R) {
      ctx.beginPath();
      ctx.arc(0, R * 0.35, R * 0.95, Math.PI, 0);
      ctx.lineTo(R * 0.95, R * 0.75);
      ctx.lineTo(-R * 0.95, R * 0.75);
      ctx.closePath();
    },
    face(ctx, R, t) {
      // the hump
      ctx.lineCap = 'butt';
      const g = ctx.createLinearGradient(0, -R, 0, R * 0.5);
      g.addColorStop(0, '#7af07a');
      g.addColorStop(1, '#1a8a4a');
      ctx.strokeStyle = g;
      ctx.lineWidth = R * 0.62;
      ctx.beginPath();
      ctx.arc(0, R * 0.45, R * 0.62, Math.PI, 0);
      ctx.stroke();
      // spines along the top
      ctx.fillStyle = '#ffd23a';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i + 0.5) * (Math.PI / 5);
        const x = Math.cos(a) * R * 0.92;
        const y = R * 0.45 + Math.sin(a) * R * 0.92;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-R * 0.1, 0);
        ctx.lineTo(0, -R * 0.24);
        ctx.lineTo(R * 0.1, 0);
        ctx.fill();
        ctx.restore();
      }
      // belly stripes
      ctx.strokeStyle = 'rgba(230,255,200,.6)';
      ctx.lineWidth = Math.max(1, R * 0.06);
      for (let i = 1; i < 5; i++) {
        const a = Math.PI + i * (Math.PI / 5);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.38, R * 0.45 + Math.sin(a) * R * 0.38);
        ctx.lineTo(Math.cos(a) * R * 0.55, R * 0.45 + Math.sin(a) * R * 0.55);
        ctx.stroke();
      }
      // its own little wave in front
      ctx.save();
      PROPS.coil.shape(ctx, R);
      ctx.clip();
      waveStrip(ctx, -R * 1.2, R * 0.5, R * 2.4, R * 0.12, R * 0.5, t * 0.5, ['#4ac0e8', '#1a5a9a']);
      ctx.restore();
    },
  },
  jelly: {
    shape(ctx, R) {
      ctx.beginPath();
      ctx.arc(0, R * 0.05, R * 0.85, Math.PI, 0);
      ctx.lineTo(R * 0.85, R * 0.25);
      ctx.lineTo(R * 0.5, R * 0.9);
      ctx.lineTo(-R * 0.5, R * 0.9);
      ctx.lineTo(-R * 0.85, R * 0.25);
      ctx.closePath();
    },
    face(ctx, R, t) {
      // tentacles (wavy)
      ctx.strokeStyle = 'rgba(255,170,240,.85)';
      ctx.lineWidth = Math.max(1, R * 0.08);
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const x0 = -R * 0.45 + i * R * 0.3;
        ctx.beginPath();
        ctx.moveTo(x0, R * 0.2);
        for (let k = 1; k <= 4; k++) ctx.lineTo(x0 + Math.sin(t * 3 + i + k) * R * 0.1, R * (0.2 + k * 0.17));
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(-R * 0.2, -R * 0.4, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#e8fbff');
      g.addColorStop(0.5, '#7ad8ff');
      g.addColorStop(1, '#3a6ad8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, R * 0.05, R * 0.85, Math.PI, 0);
      // frilly hem
      for (let i = 0; i <= 6; i++) {
        const x = R * 0.85 - i * (R * 1.7 / 6);
        ctx.lineTo(x, R * (i % 2 ? 0.32 : 0.18));
      }
      ctx.closePath();
      ctx.fill();
      eyes(ctx, R, -0.25, -0.15, 0.15, t);
    },
  },
  whale: {
    shape(ctx, R) {
      ctx.beginPath();
      ctx.ellipse(-R * 0.08, R * 0.05, R * 0.9, R * 0.66, 0, 0, TAU);
      ctx.moveTo(R * 0.7, -R * 0.05);
      ctx.lineTo(R * 1.02, -R * 0.45);
      ctx.lineTo(R * 1.0, R * 0.2);
      ctx.closePath();
    },
    face(ctx, R, t) {
      // tail
      ctx.fillStyle = '#3a5a9a';
      ctx.beginPath();
      ctx.moveTo(R * 0.7, -R * 0.05);
      ctx.lineTo(R * 1.02, -R * 0.45 + Math.sin(t * 2) * R * 0.05);
      ctx.lineTo(R * 1.0, R * 0.2);
      ctx.closePath();
      ctx.fill();
      const g = ctx.createLinearGradient(0, -R * 0.7, 0, R * 0.7);
      g.addColorStop(0, '#7aa0e8');
      g.addColorStop(1, '#2a3e7a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-R * 0.08, R * 0.05, R * 0.9, R * 0.66, 0, 0, TAU);
      ctx.fill();
      // belly
      ctx.fillStyle = '#e8f0ff';
      ctx.beginPath();
      ctx.ellipse(-R * 0.2, R * 0.42, R * 0.6, R * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,100,160,.5)';
      ctx.lineWidth = Math.max(1, R * 0.03);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-R * 0.6 + i * R * 0.25, R * 0.3);
        ctx.lineTo(-R * 0.55 + i * R * 0.25, R * 0.55);
        ctx.stroke();
      }
      // mouth and eye
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, R * 0.05);
      ctx.beginPath();
      ctx.moveTo(-R * 0.95, R * 0.12);
      ctx.quadraticCurveTo(-R * 0.6, R * 0.3, -R * 0.25, R * 0.12);
      ctx.stroke();
      eyes(ctx, R, -0.55, -0.1, 0.13, t, false, true);
      // a pirate captain's hat: the boss
      ctx.fillStyle = '#1a1020';
      ctx.beginPath();
      ctx.moveTo(-R * 0.55, -R * 0.52);
      ctx.quadraticCurveTo(-R * 0.15, -R * 1.05, R * 0.25, -R * 0.52);
      ctx.quadraticCurveTo(-R * 0.15, -R * 0.62, -R * 0.55, -R * 0.52);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-R * 0.15, -R * 0.72, R * 0.07, 0, TAU);
      ctx.fill();
    },
  },
};

// Big googly eyes that look about.
function eyes(ctx, R, x, y, s, t, stalks = false, one = false) {
  const look = Math.sin(t * 0.9) * 0.35;
  for (const k of one ? [0] : [0, 1]) {
    const ex = (x + k * Math.abs(x) * 2) * R;
    const ey = y * R - (stalks ? R * 0.3 : 0);
    if (stalks) {
      ctx.strokeStyle = '#8a1a0a';
      ctx.lineWidth = Math.max(1, R * 0.07);
      ctx.beginPath();
      ctx.moveTo(ex, y * R);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, R * 0.04);
    ctx.beginPath();
    ctx.arc(ex, ey, s * R, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + look * s * R, ey + s * R * 0.15, s * R * 0.5, 0, TAU);
    ctx.fill();
  }
}

// A strip of cardboard wave: scallops along the top, filled down `deep`.
function waveStrip(ctx, x, y, w, amp, len, phase, colors) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - amp * 3, w, amp * 8);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y - amp, 0, y + amp * 3);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  const off = ((phase % 1) + 1) % 1 * len;
  ctx.moveTo(x, y + amp * 4);
  ctx.lineTo(x, y);
  for (let px = x - off; px < x + w + len; px += len) {
    ctx.quadraticCurveTo(px + len * 0.5, y - amp * 2, px + len, y);
  }
  ctx.lineTo(x + w, y + amp * 4);
  ctx.closePath();
  ctx.clip();
  ctx.fillRect(x, y - amp * 2, w, amp * 6);
  // white foam on the crests
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = Math.max(1.5, amp * 0.35);
  ctx.beginPath();
  for (let px = x - off; px < x + w + len; px += len) {
    ctx.moveTo(px + len * 0.2, y - amp * 0.55);
    ctx.quadraticCurveTo(px + len * 0.5, y - amp * 1.15, px + len * 0.8, y - amp * 0.55);
  }
  ctx.stroke();
  ctx.restore();
}

function paintBallChip(c, cx, cy, s) { ball(c, cx, cy + 1, s * 0.36); }

// ---- The screen ------------------------------------------------------------

// api: { view(), act(action), play(), changed() }
export function openCannon(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  let G = v.game;
  let P = { field: G.field, physics: G.physics };

  const volleys = []; // { id, hits: [], left, t, angle, live }
  const balls = []; // { x, y, vx, vy, age, hits, vol }
  const fx = [];
  const words = [];
  let crit = []; // the screen's copy of the creatures (hp falls as balls hit)
  let aim = 0; // radians from straight up
  let aiming = false;
  let path = null;
  let pathKey = '';
  let recoil = 0;
  let windup = 0;
  let acc = 0; // physics time not yet stepped
  let phase = 'play'; // 'play' | 'clearing' | 'celebrate'
  let pending = null; // the rules' answer that finished the round
  let banner = null; // { text, sub, age }
  let chestAnim = -1;
  let signWobble = 0;
  let shots = G.shots;

  const g = openGame({ title: v.title, top: '#241056', bottom: '#0a0420', onClose: flushAll });

  const L = {};
  function layout() {
    const F = G.field;
    L.hud = 62;
    L.s = Math.min(g.w / F.w, (g.h - L.hud) / F.h);
    L.fw = F.w * L.s;
    L.fh = F.h * L.s;
    L.ox = (g.w - L.fw) / 2;
    L.oy = g.h - L.fh;
  }
  g.onResize = layout;
  layout();
  const X = (x) => L.ox + x * L.s;
  const Y = (y) => L.oy + y * L.s;

  function fromView(drop) {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    G = v.game;
    P = { field: G.field, physics: G.physics };
    shots = G.shots;
    crit = G.creatures.map((c, i) => ({ ...c, flash: 0, pop: c.hp > 0 ? -1 : 9, bob: i * 1.7, drop: drop ? -0.08 * i : 1 }));
    pathKey = '';
    layout();
    g.chip(String(shots), paintBallChip);
    noteText();
  }
  function noteText() {
    const per = G.shotsPerWin;
    if (G.over) g.note('The show is over. Bravo!');
    else if (shots > 0) g.note('Drag to aim, let go to fire. Every shot is 3 cannonballs.');
    else g.note(`Out of shots. Win a level for ${per[0]} (harder levels up to ${per[per.length - 1]}).`);
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  fromView(true);
  if (!G.over) banner = { text: `Round ${G.round + 1}`, sub: crit.some((c) => c.kind === 'whale') ? 'The whale takes the stage!' : 'Sink every prop!', age: 0 };

  // ---- aiming and firing ----
  const toField = (x, y) => [(x - L.ox) / L.s, (y - L.oy) / L.s];
  const canFire = () => phase === 'play' && !G.over && crit.some((c) => c.hp > 0);
  g.onDrag = {
    start(x, y) {
      if (!canFire()) return;
      aiming = true;
      aim = aimAt(P, ...toField(x, y));
    },
    move(x, y) { if (aiming) aim = aimAt(P, ...toField(x, y)); },
    end(x, y) {
      if (!aiming) return;
      aiming = false;
      aim = aimAt(P, ...toField(x, y));
      fire();
    },
    cancel() { aiming = false; },
  };

  function fire() {
    if (!canFire()) return;
    if (shots < 1) {
      g.toast('No shots left. Win levels to load the cannon.');
      signWobble = 0.6;
      return;
    }
    const out = api.act({ fire: true });
    if (!out || !out.ok) { if (!volleys.length) fromView(false); return; }
    shots = out.shots;
    g.chip(String(shots), paintBallChip);
    noteText();
    // a short wind-up before the first ball
    windup = 0.14;
    volleys.push({ id: out.volley, hits: [], left: G.physics.ballsPerShot, t: -0.14, angle: aim, live: 0 });
  }

  // A volley's last ball has fallen: tell the rules.
  function report(vol) {
    const i = volleys.indexOf(vol);
    if (i >= 0) volleys.splice(i, 1);
    const out = api.act({ volley: vol.id, hits: vol.hits });
    if (vol.hits.length >= 8 && phase !== 'celebrate') {
      words.push({ text: `${vol.hits.length} hits!`, x: g.w / 2, y: Y(G.field.bottom) + 10, age: 0, size: 30, color: '#fff3a0' });
    }
    if (out && out.roundDone) pending = out;
    api.changed();
  }

  // Leaving with balls still in the air: count what they hit so far.
  function flushAll() {
    for (const vol of volleys.slice()) report(vol);
    balls.length = 0;
    api.changed();
  }

  function onHit(i, b) {
    const c = crit[i];
    c.flash = 1;
    const x = X(b.x);
    const y = Y(b.y);
    if (fx.length < 500) burst(fx, x, y, { n: 5, colors: ['#fff', '#ffe070'], speed: 140, size: 3, gravity: 0, life: 0.28 });
    if (c.hp === 0) pop(c);
    if (phase === 'play' && crit.every((k) => k.hp <= 0)) phase = 'clearing';
  }

  function pop(c) {
    c.pop = 0;
    const x = X(c.x);
    const y = Y(c.y);
    const R = c.r * L.s;
    burst(fx, x, y, { n: 26, colors: ['#bfefff', '#5ac8ff', '#ffffff', '#2a8ad8'], speed: 300, size: R * 0.14, gravity: 700, life: 1 });
    burst(fx, x, y, { n: 22, colors: ['#ff4f7a', '#ffe070', '#5aff9a', '#a64bff', '#ff9a3a'], speed: 260, size: R * 0.13, gravity: 300, life: 1.3, kind: 'chip' });
    burst(fx, x, y, { n: 10, colors: ['#fff3a0'], speed: 160, size: 6, gravity: 0, life: 0.6, kind: 'star' });
    words.push({ text: c.kind === 'whale' ? 'WHALE DOWN!' : 'POP!', x, y: y - R * 0.3, age: 0, size: c.kind === 'whale' ? 34 : 26 });
  }

  // The round is over: banner, chest, prize, then the next wave flies in.
  async function celebrate(out) {
    phase = 'celebrate';
    const n = out.round + 1;
    banner = { text: out.allDone ? 'Final curtain!' : `Round ${n} cleared!`, sub: out.chest ? 'A treasure chest!' : '', age: 0 };
    burst(fx, g.w / 2, g.h * 0.35, { n: 40, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 380, size: 6, kind: 'star', life: 1.4 });
    await wait(1100);
    if (out.chest || out.allDone) {
      chestAnim = 0;
      await wait(1500);
      await g.prize(out.reward, out.allDone ? 'The grand prize!' : `Round ${n} chest!`, out.allDone ? 'All twelve rounds sunk. Take a bow.' : 'Three more rounds to the next chest.');
      chestAnim = -1;
    }
    if (out.allDone) { api.changed(); g.close(); return; }
    fromView(true);
    banner = { text: `Round ${G.round + 1}`, sub: crit.some((c) => c.kind === 'whale') ? 'The whale takes the stage!' : 'Sink every prop!', age: 0 };
    pending = null;
    phase = 'play';
    api.changed();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- the physics, in fixed small steps ----
  function physics(dt) {
    const Ph = G.physics;
    acc = Math.min(acc + dt, 0.05);
    while (acc >= Ph.step) {
      acc -= Ph.step;
      for (const vol of volleys) {
        if (vol.left <= 0) continue;
        vol.t += Ph.step;
        const due = Ph.ballsPerShot - vol.left;
        if (vol.t >= due * Ph.gap) {
          const b = launch(P, vol.angle);
          b.vol = vol;
          balls.push(b);
          vol.left--;
          vol.live++;
          recoil = 1;
          const mx = X(G.field.w / 2 + Math.sin(vol.angle) * (G.field.muzzle + 2));
          const my = Y(G.field.cannonY - Math.cos(vol.angle) * (G.field.muzzle + 2));
          if (fx.length < 500) {
            burst(fx, mx, my, { n: 8, colors: ['#fff3a0', '#ffb21a', '#ff6a2a'], speed: 180, size: 4, gravity: 0, life: 0.25 });
            burst(fx, mx, my, { n: 4, colors: ['rgba(220,220,240,.7)', 'rgba(170,170,200,.6)'], speed: 50, size: 9, gravity: -60, life: 0.8 });
          }
        }
      }
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        const h = stepBall(b, crit, P, Ph.step);
        if (h >= 0) { b.vol.hits.push(h); onHit(h, b); }
        else if (h === -4) {
          balls.splice(i, 1);
          b.vol.live--;
          if (b.vol.left <= 0 && b.vol.live <= 0) report(b.vol);
        }
      }
    }
    // Everything has landed after the last prop went: the round is done.
    if (phase === 'clearing' && volleys.length === 0) {
      if (pending) celebrate(pending);
      else { phase = 'play'; fromView(false); } // out of step with the rules: start again from them
    }
  }

  // ---- drawing ----
  function stage(ctx, t) {
    backdrop(ctx, g.w, g.h, '#241056', '#0a0420');
    const F = G.field;
    // side curtains when the screen is wider than the stage
    if (L.ox > 2) {
      for (const s of [0, 1]) {
        const x0 = s ? L.ox + L.fw : 0;
        const w = L.ox;
        const cg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
        cg.addColorStop(0, '#7a0a24');
        cg.addColorStop(0.5, '#c0203e');
        cg.addColorStop(1, '#5a0618');
        ctx.fillStyle = cg;
        ctx.fillRect(x0, L.hud - 4, w, g.h);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        for (let k = 1; k < 4; k++) ctx.fillRect(x0 + (w * k) / 4, L.hud - 4, 3, g.h);
      }
    }
    // the painted backcloth: night sky over a painted sea
    const hz = Y(F.bottom + 8);
    const sky = ctx.createLinearGradient(0, L.oy, 0, hz);
    sky.addColorStop(0, '#0e1650');
    sky.addColorStop(1, '#2a5a9a');
    ctx.fillStyle = sky;
    ctx.fillRect(L.ox, L.oy, L.fw, hz - L.oy);
    const sea = ctx.createLinearGradient(0, hz, 0, g.h);
    sea.addColorStop(0, '#1a6a9a');
    sea.addColorStop(1, '#0a2a5a');
    ctx.fillStyle = sea;
    ctx.fillRect(L.ox, hz, L.fw, g.h - hz);
    // a painted moon and stars
    ctx.fillStyle = 'rgba(255,248,210,.85)';
    ctx.beginPath();
    ctx.arc(X(84), Y(12), 6 * L.s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0e1650';
    ctx.beginPath();
    ctx.arc(X(86.5), Y(10.5), 5.2 * L.s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,.8)';
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 37) % 97) + 1.5;
      const sy = ((i * 53) % 80) + 3;
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
      ctx.globalAlpha = tw;
      ctx.fillRect(X(sx), Y(sy), 2, 2);
    }
    ctx.globalAlpha = 1;
    // back wave rows (they slide, like a stage wave machine)
    waveStrip(ctx, L.ox, Y(F.bottom + 12), L.fw, 2.2 * L.s, 14 * L.s, t * 0.18, ['#2a8ac0', '#155080']);
    waveStrip(ctx, L.ox, Y(F.bottom + 24), L.fw, 2.4 * L.s, 16 * L.s, -t * 0.22 + 0.3, ['#3aa8d8', '#1a5a9a']);
  }

  function prop(ctx, c, t, dt) {
    if (c.pop > 1) return;
    const R = c.r * L.s;
    let x = X(c.x);
    let y = Y(c.y) + Math.sin(t * 1.6 + c.bob) * 0.7 * L.s;
    let sc = 1;
    let rot = Math.sin(t * 1.1 + c.bob) * 0.04;
    let alpha = 1;
    if (c.drop < 1) {
      c.drop = Math.min(1, c.drop + dt * 1.8);
      const k = ease.outBack(clamp01(c.drop));
      y = lerp(L.oy - R - 30, y, k);
    }
    if (c.pop >= 0) {
      // popped: a squash, then it is yanked up into the flies, spinning
      c.pop += dt * 1.6;
      const k = c.pop;
      if (k < 0.15) sc = 1 + k * 2;
      else { sc = 1.3 - (k - 0.15); y -= ease.in((k - 0.15) / 0.85) * (y - L.oy + R * 2); rot += k * 6; alpha = 1 - k * 0.6; }
    }
    if (c.flash > 0) {
      c.flash = Math.max(0, c.flash - dt * 5);
      sc *= 1 + 0.12 * c.flash;
      rot += Math.sin(c.flash * 20) * 0.08 * c.flash;
    }
    // the fly line it hangs from
    ctx.strokeStyle = 'rgba(230,220,190,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, L.oy);
    ctx.lineTo(x, y - R * 0.6);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    const pic = PROPS[c.kind] || PROPS.octopus;
    // the cardboard edge
    ctx.save();
    ctx.translate(R * 0.07, R * 0.1);
    ctx.fillStyle = CARD;
    pic.shape(ctx, R);
    ctx.fill();
    ctx.restore();
    pic.face(ctx, R, t + c.bob);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, R * 0.05);
    pic.shape(ctx, R);
    ctx.stroke();
    if (c.flash > 0) {
      ctx.globalAlpha = alpha * c.flash * 0.8;
      ctx.fillStyle = '#fff';
      pic.shape(ctx, R);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    // the points left, on a gold token
    if (c.pop < 0) {
      const big = c.kind === 'whale';
      const br = Math.max(11, R * (big ? 0.26 : 0.4));
      const by = big ? R * 0.15 : R * 0.72;
      ctx.fillStyle = '#4a2000';
      ctx.beginPath();
      ctx.arc(0, by + 1.5, br + 2, 0, TAU);
      ctx.fill();
      const tg = ctx.createLinearGradient(0, by - br, 0, by + br);
      tg.addColorStop(0, '#fff3a0');
      tg.addColorStop(1, '#e08a00');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(0, by, br, 0, TAU);
      ctx.fill();
      bigText(ctx, String(c.hp), 0, by + 1, br * (c.hp >= 10 ? 1.05 : 1.3), '#fff', '#6a2a00');
    }
    ctx.restore();
  }

  function aimLine(ctx, t) {
    if (!canFire() || shots < 1) return;
    const key = aim.toFixed(4) + '|' + crit.map((c) => (c.hp > 0 ? 1 : 0)).join('');
    if (key !== pathKey) { pathKey = key; path = aimPath(P, crit, aim); }
    if (!path) return;
    const pts = path.points;
    ctx.save();
    ctx.globalAlpha = aiming ? 1 : 0.4;
    ctx.fillStyle = '#fff6c8';
    // dots every few units, marching outward
    let carry = (t * 30) % 5;
    let lastX = pts[0][0];
    let lastY = pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i];
      const seg = Math.hypot(x - lastX, y - lastY);
      let d = 5 - carry;
      while (d <= seg) {
        const k = d / seg;
        const px = lerp(lastX, x, k);
        const py = lerp(lastY, y, k);
        const tail = i > path.after && path.bounce ? 1 - (i - path.after) / (pts.length - path.after) : 1;
        ctx.globalAlpha = (aiming ? 1 : 0.4) * tail;
        ctx.beginPath();
        ctx.arc(X(px), Y(py), Math.max(1.6, 0.75 * L.s), 0, TAU);
        ctx.fill();
        d += 5;
      }
      carry = seg - (d - 5);
      lastX = x;
      lastY = y;
    }
    if (path.bounce) {
      ctx.globalAlpha = aiming ? 1 : 0.5;
      ctx.strokeStyle = '#fff6c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(path.bounce[0]), Y(path.bounce[1]), (2.4 + Math.sin(t * 8) * 0.5) * L.s, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function ship(ctx, t, dt) {
    const F = G.field;
    const cx = X(F.w / 2);
    const cy = Y(F.cannonY);
    const s = L.s;
    // the bow rail and deck
    ctx.save();
    const hull = ctx.createLinearGradient(0, cy - 6 * s, 0, g.h);
    hull.addColorStop(0, '#b0602a');
    hull.addColorStop(1, '#4a1e08');
    ctx.fillStyle = CARD;
    ctx.beginPath();
    ctx.moveTo(cx - 30 * s, g.h);
    ctx.quadraticCurveTo(cx - 22 * s, cy - 2 * s, cx, cy - 9 * s);
    ctx.quadraticCurveTo(cx + 22 * s, cy - 2 * s, cx + 30 * s, g.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(cx - 28 * s, g.h);
    ctx.quadraticCurveTo(cx - 20 * s, cy - 1 * s, cx, cy - 7.5 * s);
    ctx.quadraticCurveTo(cx + 20 * s, cy - 1 * s, cx + 28 * s, g.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffc21a';
    ctx.lineWidth = Math.max(2, s * 0.8);
    ctx.stroke();
    // planks
    ctx.strokeStyle = 'rgba(60,20,0,.45)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - (28 - k * 2) * s, g.h);
      ctx.quadraticCurveTo(cx - (20 - k * 4) * s, cy + k * 2 * s, cx, cy - (7.5 - k * 2.4) * s);
      ctx.quadraticCurveTo(cx + (20 - k * 4) * s, cy + k * 2 * s, cx + (28 - k * 2) * s, g.h);
      ctx.stroke();
    }
    ctx.restore();
    // the cannon on its swivel
    if (windup > 0) windup = Math.max(0, windup - dt);
    recoil = Math.max(0, recoil - dt * 6);
    const back = recoil * 2.2 * s + (windup > 0 ? (1 - windup / 0.14) * 1.4 * s : 0);
    const squash = windup > 0 ? 1 + 0.12 * (1 - windup / 0.14) : 1 + recoil * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aim);
    ctx.translate(0, back);
    ctx.scale(squash, 1 / squash);
    const bl = G.field.muzzle * s;
    const bw = 2.8 * s;
    const bg = ctx.createLinearGradient(-bw, 0, bw, 0);
    bg.addColorStop(0, '#1a1c28');
    bg.addColorStop(0.4, '#6a7090');
    bg.addColorStop(1, '#14151f');
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-bw * 1.15, 0);
    ctx.lineTo(-bw * 0.8, -bl);
    ctx.lineTo(bw * 0.8, -bl);
    ctx.lineTo(bw * 1.15, 0);
    ctx.arc(0, 0, bw * 1.15, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // gold bands and the muzzle ring
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(-bw * 1.02, -bl * 0.35, bw * 2.04, 1.1 * s);
    rr(ctx, -bw * 0.98, -bl - 0.6 * s, bw * 1.96, 1.6 * s, 0.6 * s);
    ctx.fill();
    ctx.restore();
    // the swivel block
    ctx.fillStyle = '#3a1a08';
    ctx.beginPath();
    ctx.arc(cx, cy + 1.2 * s, 3.2 * s, 0, TAU);
    ctx.fill();
    coin(ctx, cx, cy + 1.2 * s, 1.6 * s);
  }

  function hud(ctx, t) {
    const n = G.rounds;
    const W = Math.min(g.w - 16, 520);
    const x0 = (g.w - W) / 2;
    panel(ctx, x0, 6, W, L.hud - 14, 14, ['#3a1478', '#1c0848']);
    // the voyage: twelve stops, chests at 3, 6, 9 and the grand prize at 12
    const left = x0 + 22;
    const right = x0 + W - 26;
    const ty = 22;
    const step = (right - left) / (n - 1);
    ctx.strokeStyle = 'rgba(255,220,120,.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, ty);
    ctx.lineTo(right, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    if (G.round > 0) {
      ctx.strokeStyle = '#ffc21a';
      ctx.beginPath();
      ctx.moveTo(left, ty);
      ctx.lineTo(left + step * Math.min(G.round, n - 1), ty);
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const x = left + step * i;
      const done = i < G.round;
      const cur = i === G.round;
      if (G.chestRounds.includes(i + 1)) {
        if (cur) rays(ctx, x, ty, 18, t, 'rgba(255,230,140,.3)', 10);
        chest(ctx, x, ty + 2, i === n - 1 ? 22 : 17, done ? 1 : 0, i === n - 1 ? ['#ffd23a', '#a05a00'] : undefined);
      } else {
        const r = cur ? 7 + Math.sin(t * 5) * 0.8 : 5;
        ctx.fillStyle = done ? '#ffc21a' : cur ? '#ff5a8a' : '#5a4a8a';
        ctx.strokeStyle = '#2a0a5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, ty, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    // the round and what is left of it
    const left2 = crit.reduce((a, c) => a + Math.max(0, c.hp), 0);
    const total = Math.max(1, G.total);
    bigText(ctx, `Round ${Math.min(G.round + 1, n)}`, x0 + 14, 42, 15, '#ffe070', '#3a1000', 'left');
    const bx = x0 + 86;
    const bw = W - 100;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    rr(ctx, bx, 36, bw, 12, 6);
    ctx.fill();
    const k = clamp01(1 - left2 / total);
    if (k > 0) {
      const pg = ctx.createLinearGradient(0, 36, 0, 48);
      pg.addColorStop(0, '#7affb0');
      pg.addColorStop(1, '#10a050');
      ctx.fillStyle = pg;
      rr(ctx, bx, 36, Math.max(12, bw * k), 12, 6);
      ctx.fill();
    }
    bigText(ctx, `${left2} to sink`, bx + bw / 2, 42.5, 12, '#fff', '#0a3a1a');
  }

  function outOfShots(ctx, t, dt) {
    if (shots > 0 || volleys.length || phase !== 'play' || G.over) return;
    signWobble = Math.max(0, signWobble - dt);
    const w = Math.min(280, g.w - 40);
    const h = 104;
    const x = g.w / 2 - w / 2;
    const y = Y(G.field.bottom) + 6;
    ctx.save();
    ctx.translate(g.w / 2, y + h / 2);
    ctx.rotate(Math.sin(signWobble * 30) * 0.06 * signWobble);
    ctx.translate(-g.w / 2, -(y + h / 2));
    panel(ctx, x, y, w, h, 18, ['#ff5a8a', '#9a0a44']);
    bigText(ctx, 'Out of shots!', g.w / 2, y + 30, 26);
    bigText(ctx, 'Win levels to load the cannon', g.w / 2, y + 60, 15, '#ffe9a8', '#5a0020');
    const per = G.shotsPerWin;
    bigText(ctx, `+${per[0]} a win · up to +${per[per.length - 1]} on hard ones`, g.w / 2, y + 82, 13, '#fff', '#5a0020');
    ctx.restore();
    // a bouncing arrow down to the Play button
    const ay = g.h - 16 + Math.sin(t * 6) * 5;
    ctx.fillStyle = '#ffe070';
    ctx.strokeStyle = '#5a2a00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.w / 2 - 12, ay - 12);
    ctx.lineTo(g.w / 2 + 12, ay - 12);
    ctx.lineTo(g.w / 2, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  g.draw = (ctx, dt, t) => {
    physics(dt);
    stage(ctx, t);
    for (const c of crit) prop(ctx, c, t, dt);
    aimLine(ctx, t);
    // balls, with a short smear behind them
    const br = G.physics.radius * L.s;
    for (const b of balls) {
      const x = X(b.x);
      const y = Y(b.y);
      ctx.strokeStyle = 'rgba(255,240,200,.25)';
      ctx.lineWidth = br * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - b.vx * 0.025 * L.s, y - b.vy * 0.025 * L.s);
      ctx.lineTo(x, y);
      ctx.stroke();
      ball(ctx, x, y, br);
    }
    ship(ctx, t, dt);
    // the front wave row, over the ship's hull
    waveStrip(ctx, L.ox, Y(G.field.h - 3), L.fw, 2.2 * L.s, 18 * L.s, t * 0.26 + 0.6, ['#5ac8f0', '#1a6aa8']);
    // proscenium posts (the side walls the balls bounce off)
    const pg = ctx.createLinearGradient(0, 0, 6, 0);
    pg.addColorStop(0, '#ffe9a0');
    pg.addColorStop(1, '#b06400');
    ctx.fillStyle = pg;
    ctx.fillRect(L.ox - 3, L.oy, 4, L.fh);
    ctx.fillRect(L.ox + L.fw - 1, L.oy, 4, L.fh);
    ctx.fillStyle = 'rgba(255,230,160,.5)';
    ctx.fillRect(L.ox, L.oy, L.fw, 2);

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
    outOfShots(ctx, t, dt);
    hud(ctx, t);

    if (banner) {
      banner.age += dt;
      const a = banner.age;
      if (a > 1.6) banner = null;
      else {
        const k = ease.outBack(clamp01(a / 0.35));
        const fade = a > 1.3 ? 1 - (a - 1.3) / 0.3 : 1;
        ctx.globalAlpha = fade;
        const cy = L.oy + L.fh * 0.36;
        ribbon(ctx, banner.text, g.w / 2, cy, Math.min(g.w - 60, 260) * k, 44);
        if (banner.sub) bigText(ctx, banner.sub, g.w / 2, cy + 42, 18, '#fff3a0', '#3a1000');
        ctx.globalAlpha = 1;
      }
    }

    if (chestAnim >= 0) {
      chestAnim += dt;
      ctx.fillStyle = `rgba(10,2,30,${Math.min(0.6, chestAnim)})`;
      ctx.fillRect(0, 0, g.w, g.h);
      const cx = g.w / 2;
      const cy = g.h * 0.48;
      const k = ease.outBack(clamp01(chestAnim / 0.4));
      // anticipation: the chest rattles before it bursts open
      const shake = chestAnim > 0.4 && chestAnim < 1.0 ? Math.sin(chestAnim * 60) * 4 * (chestAnim - 0.4) : 0;
      const open = clamp01((chestAnim - 1.0) / 0.3);
      if (open > 0) rays(ctx, cx, cy, 230, t, 'rgba(255,230,140,.32)', 16);
      chest(ctx, cx + shake, cy, 150 * k, open);
      if (open > 0 && !g._burst) {
        g._burst = true;
        burst(fx, cx, cy - 20, { n: 60, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff', '#5aff9a'], speed: 460, size: 7, kind: 'star', life: 1.5 });
        for (let i = 0; i < 8; i++) {
          words.push({ text: '●', x: cx + (Math.random() - 0.5) * 120, y: cy - 30, age: 0, size: 18, color: '#ffc21a', life: 1 });
        }
      }
    } else g._burst = false;
  };
  return g;
}

// ---- The badge on Home ----
addPicture('cannon', {
  types: ['voyage'],
  colors: ['#2a7ac0', '#0a2a5a'],
  badge: ['#dff2ff', '#5aa0d8'],
  paint(ctx) {
    // a wave, a cannon pointing up-right, a ball in flight
    ctx.fillStyle = '#3aa8d8';
    ctx.beginPath();
    ctx.moveTo(10, 90);
    ctx.lineTo(10, 74);
    for (let x = 10; x < 90; x += 20) ctx.quadraticCurveTo(x + 10, 62, x + 20, 74);
    ctx.lineTo(90, 90);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(40, 70);
    ctx.rotate(0.6);
    ctx.fillStyle = '#2a2c3a';
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-8, -40);
    ctx.lineTo(8, -40);
    ctx.lineTo(11, 0);
    ctx.arc(0, 0, 11, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(-10, -42, 20, 6);
    ctx.restore();
    ball(ctx, 76, 22, 9);
    ctx.fillStyle = '#fff3a0';
    for (const [x, y] of [[64, 34], [58, 42]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  },
});
