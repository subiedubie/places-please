// BALLOON RISE: its own screen (a ladder with `balloons`; rules in
// meta/events/ladder.js). The player's avatar rides a little basket under
// a bunch of balloons, floating up a painted sky past ten numbered clouds,
// each carrying its prize. Every win lifts the basket; every lost level
// pops one balloon; when the last one pops the basket sinks to the start
// of the cloud it was climbing to, and a fresh bunch is tied on.
// When the screen opens it replays what happened since the last look:
// the pops (and any drop), then the climb, chests opening on passed clouds.
import { addPicture } from '../eventicons.js';
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { youFace, emoji, num, clockText, drawReward, seenNote, footer, bar } from './showkit.js';

const MAX_W = 520;
const GAP = 150; // sky pixels between two clouds
const COLORS = [['#ff3a5a', '#a0102c'], ['#3a8bff', '#1a4aa0'], ['#ffb21a', '#a06000'], ['#18c060', '#087a3a'], ['#a64bff', '#5a1aa0']];

function balloon(ctx, x, y, r, c, squash = 0) {
  r = Math.max(1, r);
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.2, c[0]);
  g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, r * (0.92 + squash), r * (1.1 - squash), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = c[1];
  ctx.beginPath(); ctx.moveTo(x, y + r * 1.05); ctx.lineTo(x - r * 0.16, y + r * 1.26); ctx.lineTo(x + r * 0.16, y + r * 1.26); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function cloud(ctx, x, y, s, glow = 0) {
  ctx.save();
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 1.4);
    g.addColorStop(0, `rgba(255,250,200,${0.6 * glow})`);
    g.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, s * 1.4, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(80,60,140,.25)';
  for (const [dx, dy, r] of [[-0.5, 0.18, 0.36], [0, 0.12, 0.46], [0.5, 0.18, 0.36]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s + 6, r * s, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff';
  for (const [dx, dy, r] of [[-0.5, 0.1, 0.34], [-0.15, -0.12, 0.42], [0.25, -0.08, 0.38], [0.55, 0.12, 0.3], [0, 0.14, 0.4]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(200,210,255,.55)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.3, s * 0.75, s * 0.12, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function basket(ctx, x, y, s, face) {
  ctx.save();
  emoji(ctx, face, x, y - s * 0.42, s * 0.8);
  const g = ctx.createLinearGradient(0, y - s * 0.2, 0, y + s * 0.4);
  g.addColorStop(0, '#e0a060');
  g.addColorStop(1, '#7a3a10');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#4a2000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.12);
  ctx.lineTo(x + s * 0.5, y - s * 0.12);
  ctx.lineTo(x + s * 0.38, y + s * 0.38);
  ctx.lineTo(x - s * 0.38, y + s * 0.38);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,20,0,.45)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.5 + i * s * 0.25, y - s * 0.12); ctx.lineTo(x - s * 0.38 + i * s * 0.19, y + s * 0.38); ctx.stroke(); }
  ctx.fillStyle = '#ffc21a';
  ctx.fillRect(x - s * 0.52, y - s * 0.16, s * 1.04, s * 0.08);
  ctx.restore();
}

addPicture('balloonrise', {
  ids: ['balloonrise'],
  colors: ['#3a8bff', '#0a3a8a'],
  badge: ['#e0f0ff', '#8ab8e8'],
  paint(ctx) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    for (const [x, y] of [[34, 30], [52, 22], [68, 32]]) { ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(50, 66); ctx.stroke(); }
    balloon(ctx, 34, 30, 13, COLORS[0]);
    balloon(ctx, 68, 32, 13, COLORS[2]);
    balloon(ctx, 52, 22, 14, COLORS[3]);
    basket(ctx, 50, 74, 30, '🦊');
  },
});

export function openBalloon(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#3a8bff', bottom: '#ffb0c8', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const seen = seenNote(api, v);
  const before = seen.get();
  const G0 = v.game;
  const posOf = (G) => (G.step >= G.stepCount ? G.stepCount : G.step + clamp01(G.have / Math.max(1, G.need)));
  // What is shown now (replays toward the real state).
  // (Only a drop takes the basket down, so without one it never starts above where it is.)
  const fell = before && G0.falls > (before.falls || 0);
  let pos = before && Number.isFinite(before.pos) ? (fell ? before.pos : Math.min(before.pos, posOf(G0))) : posOf(G0);
  let held = before && Number.isFinite(before.balloons) ? before.balloons : G0.balloons;
  let popsLeft = before ? Math.max(0, G0.pops - (before.pops || 0)) : 0;
  let target = pos;
  let camera = null;
  let busy = 0.6; // a beat before the replay starts
  let inflate = 1; // new balloons growing (0..1)
  let popping = -1; // the balloon being popped and its age
  let poppedIdx = -1;
  const cloudOpen = new Map();
  let doneCheer = false;

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    if (G.step >= G.stepCount) { g.buttons([]); window.dispatchEvent(new Event('resize')); }
    else footer(g, api);
    g.note(G.step >= G.stepCount ? 'You floated to the very top!' : 'Win levels to float up. A loss pops a balloon; lose all three and you sink to the start of this cloud.');
  }
  refresh();
  seen.set({ pos: posOf(G0), balloons: G0.balloons, pops: G0.pops, falls: G0.falls });

  g.onTap = (x, y) => {
    burst(fx, x, y, { n: 8, colors: ['#fff', '#ffe070'], speed: 120, size: 3, gravity: 0, life: 0.4 });
  };

  // The replay: pops (with drops) first, then the climb.
  function script(dt) {
    if (busy > 0) { busy -= dt; return; }
    const G = v.game;
    if (popping >= 0) return; // a pop is playing
    if (popsLeft > 0) {
      popsLeft--;
      popping = 0;
      poppedIdx = held - 1;
      return;
    }
    target = posOf(G);
    held = G.balloons;
  }

  function popDone() {
    held--;
    popping = -1;
    busy = 0.35;
    if (held <= 0) {
      // the last one: sink to the start of the step, then a fresh bunch
      target = Math.floor(pos + 1e-6); // sink (the climb follows after)
      words.push({ text: 'Down to the start of this cloud!', x: g.w / 2, y: g.h * 0.32, age: 0, size: 18, color: '#fff', stroke: '#7a0020', life: 1.8 });
      held = v.game.maxBalloons;
      inflate = 0;
      busy = 1;
    }
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    script(dt);
    // climb toward the target
    if (pos < target) {
      const before2 = Math.floor(pos);
      pos = Math.min(target, pos + Math.max(dt * 0.6, (target - pos) * dt * 1.5));
      if (Math.floor(pos) > before2) {
        const k = Math.floor(pos); // reached cloud k
        cloudOpen.set(k, 0);
      }
    } else if (pos > target) pos = Math.max(target, pos - dt * 2.5);
    // the camera follows the basket
    const worldY = (p) => -p * GAP; // up is negative
    const want = worldY(pos);
    camera = camera === null ? want : camera + (want - camera) * Math.min(1, dt * 3);
    const toScreen = (wy) => g.h * 0.62 + (wy - camera);

    // ---- the painted sky (colour shifts as you rise) ----
    const k = clamp01(pos / G.stepCount);
    const sky = ctx.createLinearGradient(0, 0, 0, g.h);
    sky.addColorStop(0, `hsl(${lerp(205, 250, k)}, ${lerp(80, 60, k)}%, ${lerp(62, 30, k)}%)`);
    sky.addColorStop(1, `hsl(${lerp(330, 280, k)}, ${lerp(90, 60, k)}%, ${lerp(84, 55, k)}%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.w, g.h);
    // stars come out near the top
    if (k > 0.4) {
      ctx.fillStyle = `rgba(255,255,255,${(k - 0.4) * 1.4})`;
      for (let i = 0; i < 30; i++) {
        const sx = (i * 97.3) % g.w;
        const sy = (i * 53.7) % (g.h * 0.6);
        ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3) * 0.5 + 0.4 * Math.sin(t * 3 + i), 0, TAU); ctx.fill();
      }
    }
    // far drifting puffs (parallax)
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
      const py = ((i * 211 - camera * 0.3) % (g.h + 200) + g.h + 200) % (g.h + 200) - 100;
      cloud(ctx, ((i * 137 + t * 8) % (g.w + 160)) - 80, py, 30 + (i % 3) * 10);
    }
    ctx.globalAlpha = 1;
    // the ground at the start
    const gy = toScreen(worldY(0)) + 60;
    if (gy < g.h + 40) {
      ctx.fillStyle = '#5ab84a';
      ctx.beginPath(); ctx.ellipse(g.w / 2, gy + 60, g.w, 80, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(g.w / 2 - 40, gy - 6, 80, 10);
    }

    // ---- the numbered clouds with their prizes ----
    const steps = v.steps || [];
    for (let c = 1; c <= G.stepCount; c++) {
      const sy = toScreen(worldY(c)) + 46;
      if (sy < -80 || sy > g.h + 80) continue;
      const side = c % 2 ? -1 : 1;
      const cx = X + W / 2 + side * Math.min(110, W * 0.26);
      const passed = c <= Math.floor(pos + 1e-6);
      const next = c === Math.floor(pos + 1e-6) + 1;
      cloud(ctx, cx, sy, 54, next ? 0.6 + 0.3 * Math.sin(t * 3) : 0);
      // the dotted height line across to the basket's column
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X + 20, sy - 46); ctx.lineTo(X + W - 20, sy - 46); ctx.stroke();
      ctx.setLineDash([]);
      const last = c === G.stepCount;
      const age = cloudOpen.get(c);
      if (age !== undefined) {
        cloudOpen.set(c, age + dt);
        if (age === 0) {
          burst(fx, cx, sy - 18, { n: 34, colors: ['#ffe070', '#fff', '#ff7ab0'], speed: 300, size: 6, kind: 'star', life: 1.1 });
          words.push({ text: last ? 'THE TOP!' : `Cloud ${c}!`, x: cx, y: sy - 50, age: 0, size: 26 });
        }
      }
      const open = passed ? (age !== undefined ? clamp01(age / 0.3) : 1) : 0;
      if (open > 0 && age !== undefined && age < 1.5) rays(ctx, cx, sy - 20, 50, t, 'rgba(255,240,170,.35)', 10);
      chest(ctx, cx, sy - 20, last ? 46 : 34, open, last ? ['#ffcf3a', '#a05a00'] : undefined);
      // the cloud's number
      ctx.fillStyle = passed ? '#3ee07a' : '#7a4bd8';
      ctx.beginPath(); ctx.arc(cx - side * 52, sy - 6, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      bigText(ctx, String(c), cx - side * 52, sy - 5, 16);
      const reward = last ? G.grand : steps[c - 1] && steps[c - 1].reward;
      if (reward) drawReward(ctx, reward, cx, sy + 26, 13, 'center', 2);
    }

    // ---- the basket and its balloons ----
    const bx = X + W / 2 + Math.sin(t * 0.9) * 8;
    const byy = toScreen(worldY(pos)) + Math.sin(t * 1.7) * 4;
    inflate = Math.min(1, inflate + dt * 1.6);
    const maxB = G.maxBalloons || 3;
    const spots = [];
    for (let i = 0; i < maxB; i++) {
      const a = (i - (maxB - 1) / 2) * 0.45;
      spots.push({ x: bx + Math.sin(a) * 46 + Math.sin(t * 2 + i) * 3, y: byy - 96 - Math.cos(a) * 20 + Math.cos(t * 1.6 + i) * 3 });
    }
    for (let i = 0; i < maxB; i++) {
      if (i >= held && !(popping >= 0 && i === poppedIdx)) continue;
      const s = spots[i];
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(bx, byy - 30); ctx.quadraticCurveTo((bx + s.x) / 2 + 6, (byy - 30 + s.y) / 2, s.x, s.y + 24); ctx.stroke();
      let r = 22 * (i >= held - (inflate < 1 ? maxB : 0) ? ease.outBack(inflate) : 1);
      let squash = 0;
      if (popping >= 0 && i === poppedIdx) {
        popping += dt;
        // anticipation: it swells and wobbles, then bursts
        const p = clamp01(popping / 0.45);
        r *= 1 + 0.3 * p;
        squash = Math.sin(popping * 40) * 0.08 * p;
        if (popping >= 0.45) {
          burst(fx, s.x, s.y, { n: 16, colors: [COLORS[i % 5][0], '#fff', COLORS[i % 5][1]], speed: 260, size: 5, kind: 'chip', life: 0.7 });
          words.push({ text: 'POP!', x: s.x, y: s.y, age: 0, size: 30, color: '#fff', stroke: COLORS[i % 5][1] });
          popDone();
          continue;
        }
      }
      if (r > 1) balloon(ctx, s.x, s.y, r, COLORS[i % 5], squash);
    }
    basket(ctx, bx, byy, 58, youFace(G.avatar));

    // ---- the status card at the bottom ----
    const cy = g.h - 74;
    panel(ctx, X + 14, cy, W - 28, 62, 16, ['#5b24b8', '#2a0b6e']);
    if (G.step >= G.stepCount) {
      bigText(ctx, 'Top of the sky!', X + W / 2, cy + 22, 22, '#ffe070', '#3a1000');
      bigText(ctx, 'Every prize is in your tray', X + W / 2, cy + 46, 14, '#e8d8ff');
      if (!doneCheer) { doneCheer = true; burst(fx, g.w / 2, g.h * 0.4, { n: 60, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 420, size: 6, kind: 'star', life: 1.5 }); }
    } else {
      bigText(ctx, `Cloud ${G.step + 1} of ${G.stepCount}`, X + 30, cy + 18, 15, '#ffe070', '#3a1000', 'left');
      bar(ctx, X + 30, cy + 32, W - 150, 18, G.have / G.need, ['#9ad8ff', '#1a7ad8'], `${G.have}/${G.need}`, 13);
      // the balloons left, small
      for (let i = 0; i < maxB; i++) {
        const lx = X + W - 100 + i * 26;
        ctx.globalAlpha = i < G.balloons ? 1 : 0.25;
        balloon(ctx, lx, cy + 30, 10, COLORS[i % 5]);
        ctx.globalAlpha = 1;
      }
    }
    if (v.endsAt) clockText(ctx, v.endsAt, X + 18, cy - 16, 13, 'left');

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
