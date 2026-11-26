// THE BULLSEYE FAIR: the archery contest's own play screen (rules in
// meta/events/archery.js). A fairground range full of moving targets:
// balloons drifting up, spinning boards on posts, a duck parade on a rail
// and, now and then, a big gold bullseye crossing the booth. Drag to aim
// from the bow (a dashed line shows where the arrow goes), let go to shoot;
// a quick tap shoots straight at the tap. Arrows fly straight and go through
// everything in their path, so one good line pops several targets.
//
// The targets and arrows themselves are makeRange() from the rules file;
// this file only draws them and passes each arrow's result to the rules:
//   api.act({ shoot: true })               spend an arrow (returns its number)
//   api.act({ score: { arrow, points } })  bank what it hit
import { addPicture } from '../eventicons.js';
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU, GAME_FONT,
} from './kit.js';
import { makeRange } from '../../meta/events/archery.js';

const BALLOON = ['#ff3a5a', '#3a8bff', '#18c060', '#ffb21a', '#a64bff', '#ff7ab0'];
const BALLOON_DARK = ['#a0102c', '#1a4aa0', '#087a3a', '#a06000', '#5a1aa0', '#b0306a'];
const MAX_W = 480; // the range is never wider than this (CSS px); wider screens get a centred booth

// ---- Drawing pieces ----

// An arrow pointing along `angle`, its tip at (x, y).
function drawArrow(ctx, x, y, angle, len, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (glow > 0) {
    ctx.strokeStyle = `rgba(255,240,160,${0.35 * glow})`;
    ctx.lineWidth = len * 0.22;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-len * 1.4, 0); ctx.lineTo(0, 0); ctx.stroke();
  }
  // shaft
  ctx.strokeStyle = '#6a3a10';
  ctx.lineWidth = Math.max(2, len * 0.075);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len * 0.1, 0); ctx.stroke();
  ctx.strokeStyle = '#e8b070';
  ctx.lineWidth = Math.max(1, len * 0.035);
  ctx.beginPath(); ctx.moveTo(-len, -0.5); ctx.lineTo(-len * 0.1, -0.5); ctx.stroke();
  // head
  ctx.fillStyle = '#dfe4f4';
  ctx.strokeStyle = '#4a5070';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-len * 0.2, -len * 0.1); ctx.lineTo(-len * 0.15, 0); ctx.lineTo(-len * 0.2, len * 0.1); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // fletching
  ctx.fillStyle = '#ff3a5a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-len * 0.78, 0); ctx.lineTo(-len * 1.02, s * len * 0.13); ctx.lineTo(-len * 1.08, s * len * 0.11); ctx.lineTo(-len * 0.95, 0); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// A bullseye face: rings from the outside in. sx squeezes it (a spinning board).
function bullseye(ctx, x, y, r, sx = 1, rings = ['#fff', '#e8183c', '#fff', '#e8183c', '#ffc21a']) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.04, sx), 1);
  ctx.fillStyle = '#3a1000';
  ctx.beginPath(); ctx.arc(0, 0, r * 1.06, 0, TAU); ctx.fill();
  rings.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, r * (1 - i / rings.length), 0, TAU); ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.35, r * 0.18, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

function balloonPic(ctx, x, y, r, color, t, phase) {
  ctx.save();
  // string
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.15);
  for (let k = 1; k <= 4; k++) ctx.lineTo(x + Math.sin(t * 3 + phase + k) * 3, y + r * 1.15 + k * r * 0.35);
  ctx.stroke();
  // body
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.18, BALLOON[color]);
  g.addColorStop(1, BALLOON_DARK[color]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 1.1, 0, 0, TAU); ctx.fill();
  // knot
  ctx.fillStyle = BALLOON_DARK[color];
  ctx.beginPath(); ctx.moveTo(x, y + r * 1.05); ctx.lineTo(x - r * 0.16, y + r * 1.25); ctx.lineTo(x + r * 0.16, y + r * 1.25); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function duckPic(ctx, x, y, r, down = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (down > 0) { ctx.rotate(down * 1.4); ctx.globalAlpha = 1 - down; }
  ctx.fillStyle = '#ffd21a';
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.25, r * 0.95, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.4, r * 0.48, 0, TAU); ctx.fill(); ctx.stroke();
  // tail and wing
  ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.1); ctx.lineTo(-r * 1.25, -r * 0.3); ctx.lineTo(-r * 0.7, -r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb000';
  ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.2, r * 0.45, r * 0.25, -0.3, 0, TAU); ctx.fill();
  // beak and eye
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.45); ctx.lineTo(r * 1.25, -r * 0.3); ctx.lineTo(r * 0.85, -r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a1000';
  ctx.beginPath(); ctx.arc(r * 0.58, -r * 0.5, r * 0.09, 0, TAU); ctx.fill();
  ctx.restore();
}

// The bow, turned toward `angle`; pull = 0 (rest) ... 1 (fully drawn).
function bowPic(ctx, x, y, s, angle, pull, nocked) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  const back = s * 0.45 * pull;
  // limbs
  ctx.strokeStyle = '#4a1a00';
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s, s * 0.25); ctx.quadraticCurveTo(0, -s * 0.75, s, s * 0.25); ctx.stroke();
  const lg = ctx.createLinearGradient(-s, 0, s, 0);
  lg.addColorStop(0, '#c07030'); lg.addColorStop(0.5, '#ffcf7a'); lg.addColorStop(1, '#c07030');
  ctx.strokeStyle = lg;
  ctx.lineWidth = s * 0.1;
  ctx.beginPath(); ctx.moveTo(-s, s * 0.25); ctx.quadraticCurveTo(0, -s * 0.75, s, s * 0.25); ctx.stroke();
  // grip
  ctx.fillStyle = '#ffc21a';
  rr(ctx, -s * 0.12, -s * 0.36, s * 0.24, s * 0.22, s * 0.05); ctx.fill();
  // string
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-s, s * 0.25); ctx.lineTo(0, s * 0.25 + back); ctx.lineTo(s, s * 0.25); ctx.stroke();
  ctx.restore();
  if (nocked) {
    const tipBack = s * 0.25 + back;
    const len = s * 1.15;
    const tipX = x + Math.cos(angle) * (len - tipBack);
    const tipY = y + Math.sin(angle) * (len - tipBack);
    drawArrow(ctx, tipX, tipY, angle, len, pull);
  }
}

// The multiplier medallion: bigger and hotter with the streak.
function multBadge(ctx, x, y, r, mult, max, t, bump) {
  const hot = (mult - 1) / Math.max(1, max - 1);
  ctx.save();
  if (mult > 1) {
    // flames behind
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.33;
      const fl = r * (0.45 + 0.35 * hot) * (0.8 + 0.25 * Math.sin(t * 9 + i * 1.7));
      ctx.fillStyle = i % 2 ? '#ff7a1a' : '#ffd21a';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - 0.22) * r * 0.85, y + Math.sin(a - 0.22) * r * 0.85);
      ctx.lineTo(x + Math.cos(a) * (r + fl), y + Math.sin(a) * (r + fl));
      ctx.lineTo(x + Math.cos(a + 0.22) * r * 0.85, y + Math.sin(a + 0.22) * r * 0.85);
      ctx.fill();
    }
  }
  const s = 1 + 0.25 * bump + (mult > 1 ? 0.04 * Math.sin(t * 6) : 0);
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#4a2000';
  ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#fff0a8'); g.addColorStop(0.5, '#ffc21a'); g.addColorStop(1, '#b06400');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, TAU); ctx.fill();
  const f = ctx.createLinearGradient(0, -r, 0, r);
  f.addColorStop(0, mult > 1 ? '#ff5a3a' : '#7a4bd8');
  f.addColorStop(1, mult > 1 ? '#a0100c' : '#3a137e');
  ctx.fillStyle = f;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.fill();
  ctx.restore();
  bigText(ctx, `x${mult}`, x, y - 1, r * (mult >= 10 ? 0.8 : 0.95));
  // the streak pips under it
  const pip = Math.min(7, (r * 2.4) / max);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < mult ? '#ffd21a' : 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.arc(x + (i - (max - 1) / 2) * pip * 1.3, y + r + 10, pip / 2, 0, TAU); ctx.fill();
  }
}

function paintArrowChip(c, cx, cy, s) { drawArrow(c, cx + s * 0.38, cy - s * 0.38, -Math.PI / 4, s * 0.95); }

// ---- Badge for Home (drawn out of 100) ----
addPicture('archery', {
  types: ['archery'],
  colors: ['#e8183c', '#5a0018'],
  badge: ['#fff0d0', '#e8a040'],
  paint(ctx) {
    bullseye(ctx, 46, 54, 34);
    drawArrow(ctx, 50, 50, -2.45 + Math.PI, 46);
    ctx.fillStyle = '#ffd21a';
    for (const [x, y] of [[78, 22], [20, 24], [84, 66]]) {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const r = k % 2 ? 2.5 : 7; ctx.lineTo(x + Math.cos((k * TAU) / 8) * r, y + Math.sin((k * TAU) / 8) * r); }
      ctx.fill();
    }
  },
});

// ---- The screen ----
// api: { view(), act(action), play(), changed() }
export function openArchery(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  let R = null; // the range (targets + arrows)
  const fx = [];
  const words = [];
  let aim = null; // { x, y, age } while a finger is down
  let restAngle = -Math.PI / 2;
  let recoil = 0;
  let jiggle = 0;
  let shownScore = v.game.score;
  let multBump = 0;
  let chestPop = -1; // age of the step chest bursting open
  let board = false; // the standings panel is up
  let outShown = false;
  let lastPlace = v.game.place;
  let changedTimer = 0;
  const L = {};

  const g = openGame({
    title: v.title,
    top: '#3a1078',
    bottom: '#12052e',
    onClose() {
      // Bank what any arrow still in flight has hit so far.
      if (R) for (const a of R.arrows) if (!a.done && a.tag !== undefined) api.act({ score: { arrow: a.tag, points: a.points } });
      clearTimeout(changedTimer);
      api.changed();
    },
  });

  function layout() {
    const W = g.w;
    const H = g.h;
    L.hudH = 108;
    L.rw = Math.min(W, MAX_W);
    L.rx = Math.round((W - L.rw) / 2);
    L.ry = L.hudH;
    L.rh = Math.max(200, H - L.hudH - 4);
    const old = R;
    R = makeRange({ w: L.rw, h: L.rh, targets: v.game.targets, range: v.game.range });
    // Anything in flight when the screen changed size is banked as it stands.
    if (old) for (const a of old.arrows) if (!a.done && a.tag !== undefined) bank(a.tag, a.points, null);
  }
  g.onResize = () => { if (!R || Math.abs(R.w - Math.min(g.w, MAX_W)) > 2 || Math.abs(R.h - Math.max(200, g.h - 112)) > 2) layout(); };
  layout();

  function soon() {
    clearTimeout(changedTimer);
    changedTimer = setTimeout(() => api.changed(), 900);
  }

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    g.chip(String(G.arrows), paintArrowChip);
    const left = Math.max(0, (G.dayEndsAt || 0) - Date.now());
    const hrs = Math.floor(left / 3600e3);
    const mins = Math.floor((left % 3600e3) / 60e3);
    const when = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    g.note(`${G.day}'s contest (day ${G.dayNumber} of ${G.days}) · ends in ${when}`);
    if (G.place < lastPlace && lastPlace - G.place >= 1 && shownScore > 0) {
      words.push({ text: `Up to ${ordinalOf(G.place)}!`, x: g.w - 50, y: 70, age: 0, size: 18, color: '#7affa0', stroke: '#063a1a' });
    }
    lastPlace = G.place;
  }
  g.buttons([
    { text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } },
    { text: 'Standings', onClick: () => { board = !board; } },
  ]);
  refresh();
  // The footer has grown by the note and buttons: let the kit refit the canvas.
  window.dispatchEvent(new Event('resize'));
  if (v.game.results.length) {
    const r = v.game.results[v.game.results.length - 1];
    if (v.game.shots === 0 || v.game.score === 0) g.toast(`${r.day}: you finished ${ordinalOf(r.place)} with ${r.score}`, 2600);
  }

  // Where the bow is, in screen pixels.
  const bowX = () => L.rx + R.bow.x;
  const bowY = () => L.ry + R.bow.y;
  function angleTo(x, y) {
    const dx = x - bowX();
    const dy = y - bowY();
    // A finger below the bow pulls back (like a slingshot); above, it points.
    const a = dy < -6 ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx);
    return Math.max(-Math.PI + 0.18, Math.min(-0.18, a));
  }

  g.onDrag = {
    start(x, y) {
      if (board) { board = false; return; }
      aim = { x, y, age: 0 };
    },
    move(x, y) { if (aim) { aim.x = x; aim.y = y; } },
    end(x, y) {
      if (!aim) return;
      aim.x = x; aim.y = y;
      const a = angleTo(x, y);
      aim = null;
      shoot(a);
    },
    cancel() { aim = null; },
  };

  function shoot(angle) {
    restAngle = angle;
    const out = api.act({ shoot: true });
    if (!out || !out.ok) {
      jiggle = 0.25;
      g.toast(out && out.reason === 'arrows' ? 'Out of arrows! Win a level to earn more.' : 'The contest is closed.');
      outShown = true;
      return;
    }
    v.game.arrows = out.arrows;
    g.chip(String(out.arrows), paintArrowChip);
    R.fire(angle, out.arrow);
    recoil = 1;
    burst(fx, bowX() + Math.cos(angle) * 30, bowY() + Math.sin(angle) * 30, { n: 5, colors: ['#fff6d0'], speed: 120, size: 2.5, gravity: 0, life: 0.25 });
  }

  // An arrow has left the range: give its points to the rules.
  function bank(arrow, points, at) {
    const res = api.act({ score: { arrow, points } });
    if (!res || !res.ok) return;
    if (at && points > 0 && at.hits > 1) {
      words.push({ text: `${at.hits >= 5 ? 'MEGA ' : ''}PIERCE x${at.hits}  +${points}`, x: at.x, y: at.y, age: 0, size: 20 + Math.min(12, at.hits * 2), color: '#7ad8ff', stroke: '#06204a', life: 1.4 });
    }
    for (const s of res.steps || []) {
      chestPop = 0;
      words.push({ text: `Step ${s.step}!`, x: g.w - 40, y: 92, age: 0, size: 20, color: '#7affa0', stroke: '#063a1a', life: 1.6 });
      if (s.last) {
        setTimeout(() => g.prize(s.reward, 'Ladder complete!', `All ${v.game.stepCount} step prizes for today. Keep shooting for the top ten.`), 700);
      } else g.toast(`Step ${s.step} prize: it is in your rewards tray`);
    }
    refresh();
    soon();
  }

  function ordinalOf(n) {
    const t = n % 100;
    if (t >= 11 && t <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  }

  // ---- frame ----
  g.draw = (ctx, dt, t) => {
    const G = v.game;
    const W = g.w;
    backdrop(ctx, W, g.h, '#3a1078', '#12052e');

    // Move the range on and react to what happened.
    for (const e of R.step(dt)) {
      if (e.type === 'hit') {
        const o = e.item;
        const x = L.rx + o.x;
        const y = L.ry + o.y;
        const big = o.kind === 'gold';
        if (o.kind === 'balloon') burst(fx, x, y, { n: 14, colors: [BALLOON[o.color], '#fff', BALLOON_DARK[o.color]], speed: 240, size: 4, life: 0.6, kind: 'chip' });
        else burst(fx, x, y, { n: big ? 46 : 16, colors: big ? ['#fff3a0', '#ffc21a', '#fff', '#ff7ab0'] : ['#fff3a0', '#ffc21a', '#fff'], speed: big ? 380 : 220, size: big ? 6 : 4, life: big ? 1.2 : 0.7, kind: 'star' });
        words.push({ text: `+${e.points}`, x, y: y - o.r * 0.5, age: 0, size: big ? 40 : o.kind === 'duck' ? 28 : o.kind === 'board' ? 26 : 22, color: big ? '#ffe070' : '#fff', life: big ? 1.6 : 1 });
        jiggle = Math.max(jiggle, big ? 0.3 : 0.08);
      } else if (e.type === 'done') {
        const a = e.arrow;
        bank(a.tag, e.points, { x: L.rx + Math.max(90, Math.min(R.w - 90, a.x)), y: L.ry + 56, hits: e.hits });
      }
    }

    let ox = 0;
    let oy = 0;
    if (jiggle > 0) { jiggle -= dt; ox = (Math.random() - 0.5) * 5 * jiggle * 4; oy = (Math.random() - 0.5) * 5 * jiggle * 4; }

    // ---- the booth ----
    ctx.save();
    ctx.translate(L.rx + ox, L.ry + oy);
    const rw = R.w;
    const rh = R.h;
    ctx.save();
    rr(ctx, 4, 0, rw - 8, rh, 18);
    ctx.clip();
    // back wall: a soft night sky with string lights
    const sky = ctx.createLinearGradient(0, 0, 0, rh);
    sky.addColorStop(0, '#2a1060');
    sky.addColorStop(1, '#5a1a5a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, rw, rh);
    // tent stripes
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let x = 0; x < rw; x += 56) ctx.fillRect(x, 0, 28, rh);
    // the canopy scallops at the top
    for (let i = 0, x = 0; x < rw + 30; i++, x += 30) {
      ctx.fillStyle = i % 2 ? '#fff0d8' : '#e8183c';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 30, 10); ctx.arc(x + 15, 10, 15, 0, Math.PI); ctx.closePath(); ctx.fill();
    }
    for (let x = 12; x < rw; x += 34) {
      const on = (Math.floor(t * 3) + Math.round(x / 34)) % 3 !== 0;
      ctx.fillStyle = on ? '#fff3a0' : '#a08040';
      ctx.beginPath(); ctx.arc(x, 30, 3, 0, TAU); ctx.fill();
    }
    // the posts of the boards and the duck rail
    const railY = rh * 0.2;
    ctx.fillStyle = '#7a3a10';
    for (const o of R.items) if (o.kind === 'board') ctx.fillRect(o.x - 3, o.y, 6, rh * 0.18);

    // ---- targets (gold last, on top) ----
    for (const o of R.items) {
      if (o.kind === 'board') {
        if (o.down > 0) {
          // knocked back: lying flat, then swinging up again
          const k = clamp01(o.down / 0.5);
          ctx.save();
          ctx.translate(o.x, o.y + o.r);
          ctx.scale(1, 1 - k * 0.85);
          bullseye(ctx, 0, -o.r, o.r, 1, ['#d8d0c8', '#a06070', '#d8d0c8', '#a06070', '#c0a040']);
          ctx.restore();
        } else bullseye(ctx, o.x, o.y, o.r, Math.cos(o.angle));
      } else if (o.kind === 'balloon' && o.alive) balloonPic(ctx, o.x, o.y, o.r, o.color, t, o.phase);
    }
    for (const o of R.items) if (o.kind === 'duck') duckPic(ctx, o.x, o.y, o.r, o.alive ? 0 : clamp01((R.t - o.hitAt) * 2));
    // the water strip in front of the ducks
    ctx.fillStyle = '#1a6ad8';
    ctx.beginPath();
    ctx.moveTo(0, railY + 30);
    for (let x = 0; x <= rw; x += 12) ctx.lineTo(x, railY + 14 + Math.sin(x * 0.25 + t * 4) * 3);
    ctx.lineTo(rw, railY + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(0, railY + 28, rw, 5);
    for (const o of R.items) {
      if (o.kind !== 'gold' || !o.alive) continue;
      rays(ctx, o.x, o.y, o.r * 2.2, t * 2, 'rgba(255,230,140,.28)', 12);
      bullseye(ctx, o.x, o.y, o.r, 1, ['#ffe070', '#ffc21a', '#fff6c0', '#e8a000', '#fff']);
      bigText(ctx, String(o.points), o.x, o.y + 1, o.r * 0.7, '#fff', '#8a4a00');
    }
    // "Gold incoming" warning
    if (R.goldWarning > 0) {
      const k = 0.5 + 0.5 * Math.sin(t * 16);
      ctx.globalAlpha = 0.6 + 0.4 * k;
      ribbon(ctx, 'GOLD BULLSEYE!', rw / 2, rh * 0.33, 190, 30, ['#ffd21a', '#c07000']);
      ctx.globalAlpha = 1;
    }

    // ---- the aim line ----
    const pull = aim ? ease.out(clamp01((aim.age += dt) / 0.16)) : 0;
    let angle = restAngle;
    if (aim) angle = angleTo(aim.x, aim.y);
    if (aim && G.arrows > 0) {
      ctx.save();
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -t * 60;
      ctx.strokeStyle = 'rgba(255,240,170,.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(R.bow.x, R.bow.y);
      const far = Math.hypot(rw, rh) * 1.2;
      ctx.lineTo(R.bow.x + Math.cos(angle) * far, R.bow.y + Math.sin(angle) * far);
      ctx.stroke();
      ctx.restore();
    }

    // ---- arrows in flight ----
    for (const a of R.arrows) if (!a.done) drawArrow(ctx, a.x, a.y, a.angle, 34 * R.u, 0.6);

    // ---- the counter and the bow ----
    const cy = R.bow.y + 8;
    const wood = ctx.createLinearGradient(0, cy, 0, rh);
    wood.addColorStop(0, '#c07030');
    wood.addColorStop(1, '#5a2408');
    ctx.fillStyle = wood;
    ctx.fillRect(0, cy, rw, rh - cy);
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(0, cy, rw, 4);
    recoil = Math.max(0, recoil - dt * 5);
    bowPic(ctx, R.bow.x, R.bow.y + recoil * 6, 30 * R.u, angle, Math.max(pull, 0), G.arrows > 0 && recoil < 0.3);
    if (G.shots === 0 && G.arrows > 0 && !aim) bigText(ctx, 'Drag to aim · let go to shoot', rw / 2, R.bow.y - 56 * R.u, 16, '#ffe9a8');
    // arrows left, as a quiver of little arrows
    const show = Math.min(G.arrows, 12);
    for (let i = 0; i < show; i++) drawArrow(ctx, 22 + i * 7, cy + 2 - (i % 2) * 3, -Math.PI / 2, 22);
    if (G.arrows > 12) bigText(ctx, `+${G.arrows - 12}`, 22 + 12 * 7 + 14, cy + 10, 14);
    ctx.restore(); // clip

    // the gold rim of the booth
    ctx.strokeStyle = '#ffc21a';
    ctx.lineWidth = 3;
    rr(ctx, 4, 0, rw - 8, rh, 18);
    ctx.stroke();

    // ---- out of arrows ----
    const flying = R.arrows.some((a) => !a.done);
    if (G.arrows < 1 && !flying) {
      const pw = Math.min(rw - 40, 300);
      const px = (rw - pw) / 2;
      const py = rh * 0.36;
      panel(ctx, px, py, pw, 132, 18, ['#5b24b8', '#2a0b6e']);
      bigText(ctx, outShown || G.shots > 0 ? 'Out of arrows!' : 'No arrows yet', rw / 2, py + 26, 26, '#ffe070', '#3a1000');
      bigText(ctx, `Win a level: +${G.nextWin} arrows`, rw / 2, py + 62, 19);
      bigText(ctx, G.mult > 1 ? `Your x${G.mult} streak multiplies them!` : 'Wins in a row multiply them', rw / 2, py + 90, 15, '#ffd0f0');
      bigText(ctx, 'Tap "Play a level" below', rw / 2, py + 114, 14, '#c8b8ff');
    }
    ctx.restore(); // translate

    // ---- HUD: multiplier, score, place, step bar ----
    multBump = Math.max(0, multBump - dt * 3);
    multBadge(ctx, 42, 36, 27, G.mult, G.maxMult, t, multBump);
    shownScore = shownScore < G.score ? Math.min(G.score, shownScore + Math.max(1, (G.score - shownScore) * dt * 8)) : G.score;
    bigText(ctx, String(Math.floor(shownScore)), W / 2, 28, 36, '#fff');
    bigText(ctx, 'points today', W / 2, 54, 13, '#ffe9a8');
    // place
    const pw = 74;
    panel(ctx, W - pw - 12, 10, pw, 48, 12, G.place <= 10 ? ['#3ee07a', '#0a8a3a'] : ['#6a5a8a', '#3a2a5a']);
    bigText(ctx, ordinalOf(G.place), W - pw / 2 - 12, 28, 22);
    bigText(ctx, `of ${G.players}`, W - pw / 2 - 12, 48, 12, '#e8ffe8');
    // the step bar
    const bx = 16;
    const bw = W - 84;
    const by = 78;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    rr(ctx, bx, by, bw, 18, 9); ctx.fill();
    const part = G.stepNeed ? clamp01((G.score - G.stepFrom) / (G.stepNeed - G.stepFrom)) : 1;
    const fill = ctx.createLinearGradient(0, by, 0, by + 18);
    fill.addColorStop(0, '#9affc0'); fill.addColorStop(1, '#18a050');
    ctx.fillStyle = fill;
    rr(ctx, bx, by, Math.max(18, bw * part), 18, 9); ctx.fill();
    bigText(ctx, G.stepNeed ? `Step ${G.step + 1}/${G.stepCount}: ${G.score}/${G.stepNeed}` : `All ${G.stepCount} steps done!`, bx + bw / 2, by + 10, 13);
    // the step chest: shakes when close, bursts open when reached
    const near = G.stepNeed && part > 0.8 ? Math.sin(t * 30) * 0.08 : 0;
    ctx.save();
    ctx.translate(W - 36, by + 6);
    ctx.rotate(near);
    if (chestPop >= 0) {
      chestPop += dt;
      rays(ctx, 0, 0, 40 * ease.out(clamp01(chestPop / 0.3)), t, 'rgba(255,230,140,.35)', 10);
      chest(ctx, 0, 0, 34 * (1 + 0.3 * Math.sin(clamp01(chestPop / 0.4) * Math.PI)), clamp01(chestPop / 0.25));
      if (chestPop > 0.2 && !g._popped) { g._popped = true; burst(fx, W - 36, by + 2, { n: 26, colors: ['#ffe070', '#fff', '#7affa0'], speed: 260, size: 5, kind: 'star', life: 1 }); }
      if (chestPop > 1.1) { chestPop = -1; g._popped = false; }
    } else chest(ctx, 0, 0, 34, 0);
    ctx.restore();

    // ---- standings ----
    if (board) drawBoard(ctx, W);

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };

  function drawBoard(ctx, W) {
    const G = v.game;
    const pw = Math.min(W - 24, 360);
    const px = (W - pw) / 2;
    const rows = G.top.slice();
    const you = G.near.find((r) => r.you);
    const extra = you && you.place > 10 ? G.near.filter((r) => r.place > 10) : [];
    const rowH = 26;
    const ph = 56 + (rows.length + extra.length) * rowH + (extra.length ? 14 : 0) + 30;
    const py = Math.max(8, L.ry + 8);
    ctx.fillStyle = 'rgba(10,2,30,.55)';
    ctx.fillRect(0, 0, W, g.h);
    panel(ctx, px, py, pw, ph, 18, ['#3a137e', '#1a0640']);
    bigText(ctx, `${G.day}'s standings`, W / 2, py + 22, 20, '#ffe070', '#3a1000');
    bigText(ctx, 'top ten are paid at midnight', W / 2, py + 42, 12, '#c8b8ff');
    let y = py + 60;
    const line = (r) => {
      if (r.you) { ctx.fillStyle = 'rgba(62,224,122,.35)'; rr(ctx, px + 8, y - 2, pw - 16, rowH - 2, 8); ctx.fill(); }
      ctx.save();
      ctx.font = `15px ${GAME_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = r.place <= 3 ? '#ffe070' : '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(ordinalOf(r.place), px + 16, y + rowH / 2 - 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(r.you ? 'You' : r.name, px + 62, y + rowH / 2 - 1);
      ctx.textAlign = 'right';
      ctx.fillText(String(r.score), px + pw - 16, y + rowH / 2 - 1);
      ctx.restore();
      y += rowH;
    };
    rows.forEach(line);
    if (extra.length) {
      bigText(ctx, '· · ·', W / 2, y + 5, 14, '#c8b8ff');
      y += 14;
      extra.forEach(line);
    }
    bigText(ctx, 'Tap to close', W / 2, y + 14, 12, '#c8b8ff');
  }

  // A win while the screen was closed bumps the medallion when we come back.
  if (v.game.mult > 1) multBump = 1;
  return g;
}
