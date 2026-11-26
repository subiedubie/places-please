// MISSION CONTROL: the stage manager's lighting desk (rules in
// meta/events/control.js). Four cue cards on the mission board, each with a
// lamp, a progress bar and its prize. Under them the desk: four faders that
// rise with the cues, feeding the big chest in the middle. A cue finished
// since you last looked is stamped DONE, its light runs down to the chest,
// and when all four are lit the chest bursts open.
import {
  openGame, panel, bigText, ribbon, chest, coin, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { addPicture } from '../eventicons.js';
import { emoji, drawReward, bar, wrap, smallText, timeLeft, fitSize } from './teamkit.js';

addPicture('control', {
  types: ['control'],
  colors: ['#1aa8a0', '#0a4a50'],
  badge: ['#d8fff8', '#6ad0c8'],
  paint(ctx) {
    // a lighting desk: four faders and a lamp
    ctx.fillStyle = '#2a3a4a';
    ctx.strokeStyle = '#0a1a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(14, 40, 72, 44, 8) : ctx.rect(14, 40, 72, 44);
    ctx.fill();
    ctx.stroke();
    const knobs = [0.3, 0.7, 0.5, 0.9];
    knobs.forEach((k, i) => {
      const x = 26 + i * 16;
      ctx.fillStyle = '#0a1a2a';
      ctx.fillRect(x - 1.5, 48, 3, 28);
      ctx.fillStyle = i === 3 ? '#ffd23a' : '#7af0e0';
      ctx.fillRect(x - 5, 72 - k * 24, 10, 6);
    });
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(50, 24, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a4a00';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(46, 20, 4, 0, TAU); ctx.fill();
  },
});

const ICON = { wins: '🏆', coins: 'coin', cards: '🎴', gems: '💎', pairs: '🎭', prizes: '🎁' };
const LAMP = ['#ffb21a', '#ff4f7a', '#3ad0ff', '#9a6aff'];

function lamp(ctx, cx, cy, r, color, on, t) {
  ctx.save();
  if (on > 0) {
    const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    gl.addColorStop(0, color + 'aa');
    gl.addColorStop(1, color + '00');
    ctx.fillStyle = gl;
    ctx.globalAlpha = on * (0.75 + 0.25 * Math.sin(t * 5));
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#1a1020';
  ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  g.addColorStop(0, on > 0 ? '#fff' : '#6a6080');
  g.addColorStop(0.4, on > 0 ? color : '#4a4060');
  g.addColorStop(1, on > 0 ? '#3a1000' : '#1a1428');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.restore();
}

export function openControl(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#0e3a4a', bottom: '#060e1c' });
  const fx = [];
  const words = [];
  const L = { cards: [] };
  // Animation state per task: stamp age (null = no stamp yet), fader level.
  const anim = v.game.tasks.map((tk) => ({ stamp: tk.done && !tk.fresh ? 9 : null, fader: tk.have / tk.need, beam: null }));
  let ring = v.game.tasks.filter((tk) => tk.done && !tk.fresh).length; // lit segments
  let ringShown = ring;
  let opening = v.game.grandPaid && !v.game.grandFresh ? 1 : 0; // chest lid
  let busy = false;
  let since = 0;
  let intro = 0;

  function layout() {
    const W = g.w;
    const H = g.h;
    const pad = 12;
    L.boardY = 8;
    const cw = (W - pad * 3) / 2;
    const ch = Math.min(150, (H * 0.56 - 30) / 2);
    L.cw = cw;
    L.ch = ch;
    L.cards = [0, 1, 2, 3].map((i) => ({ x: pad + (i % 2) * (cw + pad), y: L.boardY + 26 + Math.floor(i / 2) * (ch + pad), w: cw, h: ch }));
    L.deskY = L.boardY + 26 + 2 * (ch + pad) + 4;
    L.deskH = Math.max(150, H - L.deskY - 10);
    L.chestX = W / 2;
    L.chestY = L.deskY + L.deskH * 0.52;
    L.chestS = Math.min(110, L.deskH * 0.5, W * 0.28);
  }
  g.onResize = layout;
  layout();

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    g.chip(`${G.finished}/4`, (c, cx, cy, s) => chest(c, cx, cy + s * 0.1, s * 0.8, G.grandPaid ? 1 : 0));
    const left = G.tasks.filter((tk) => !tk.done);
    g.note(G.grandPaid
      ? 'Every cue is run. The grand prize is in your tray.'
      : left.length === 4 && left.every((tk) => tk.have === 0)
        ? 'Play levels and the other side games: these cues fill by themselves.'
        : `${left.length} cue${left.length === 1 ? '' : 's'} to go. Tap a card to see what counts.`);
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  refresh();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Celebrate cues finished since the last visit, one by one, then the chest.
  async function celebrate() {
    busy = true;
    await wait(500);
    const fresh = v.game.tasks.map((tk, i) => (tk.fresh ? i : -1)).filter((i) => i >= 0);
    for (const i of fresh) {
      if (g.closed) return;
      anim[i].stamp = 0;
      const c = L.cards[i];
      burst(fx, c.x + c.w / 2, c.y + c.h / 2, { n: 30, colors: ['#7af07a', '#fff', LAMP[i]], speed: 300, size: 5, kind: 'star', life: 1 });
      words.push({ text: 'DONE!', x: c.x + c.w / 2, y: c.y + c.h * 0.35, age: 0, size: 30, color: '#b0ffb0', stroke: '#0a4a1a' });
      await wait(350);
      anim[i].beam = 0;
      await wait(550);
      ring++;
      burst(fx, L.chestX, L.chestY, { n: 14, colors: [LAMP[i], '#fff'], speed: 160, size: 4, gravity: 0, life: 0.6, kind: 'star' });
      await wait(150);
    }
    if (g.closed) return;
    if (fresh.length) api.act({ seen: fresh });
    if (v.game.grandFresh) {
      await wait(300);
      opening = 0.0001;
      await wait(1100);
      if (g.closed) return;
      await g.prize(v.game.grand, 'All four cues run!', 'The big chest is yours.');
      api.act({ grand: true });
    }
    refresh();
    api.changed();
    busy = false;
  }
  if (v.game.tasks.some((tk) => tk.fresh) || v.game.grandFresh) celebrate();

  g.onTap = (x, y) => {
    if (busy) return;
    const i = L.cards.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i >= 0) {
      const tk = v.game.tasks[i];
      if (!tk) return;
      g.toast(tk.done ? 'Done. Its prize is in your tray.' : tk.hint || tk.text);
      anim[i].wiggle = 0;
      return;
    }
    if (Math.hypot(x - L.chestX, y - L.chestY) < L.chestS * 0.7) {
      const n = 4 - v.game.finished;
      g.toast(v.game.grandPaid ? 'Opened! The grand prize is in your tray.' : `Finish ${n} more cue${n === 1 ? '' : 's'} and this chest opens by itself.`);
      words.push({ text: v.game.grandPaid ? '★' : `${v.game.finished}/4`, x: L.chestX, y: L.chestY - L.chestS * 0.5, age: 0, size: 24 });
    }
  };

  function card(ctx, i, t, dt) {
    const tk = v.game.tasks[i];
    const c = L.cards[i];
    const a = anim[i];
    if (!tk) return;
    let wob = 0;
    if (a.wiggle !== undefined) { a.wiggle += dt; wob = Math.sin(a.wiggle * 30) * 3 * Math.max(0, 1 - a.wiggle * 3); if (a.wiggle > 0.4) delete a.wiggle; }
    const k = ease.outBack(clamp01((intro - i * 0.08) / 0.4));
    ctx.save();
    ctx.translate(c.x + c.w / 2 + wob, c.y + c.h / 2);
    ctx.scale(k, k);
    ctx.translate(-c.w / 2, -c.h / 2);
    const done = tk.done && a.stamp !== null;
    panel(ctx, 0, 0, c.w, c.h, 14, done ? ['#1a6a4a', '#0a3a2a'] : ['#1e3a5a', '#0c1a30']);
    // the lamp and the icon
    const lit = done ? 1 : tk.have > 0 ? 0.6 : 0;
    lamp(ctx, 18, 18, 8, done ? '#5aff8a' : LAMP[i], lit, t + i);
    const icon = ICON[tk.counter] || '⭐';
    if (icon === 'coin') coin(ctx, c.w - 20, 20, 11);
    else emoji(ctx, icon, c.w - 20, 20, 20);
    smallText(ctx, `CUE ${i + 1}`, 34, 19, 12, '#9ad8ff', 'left');
    // the words
    const size = c.w < 150 ? 14 : 15;
    const lines = wrap(ctx, tk.text, c.w - 18, size).slice(0, 2);
    lines.forEach((ln, j) => bigText(ctx, ln, c.w / 2, 44 + j * (size + 3), fitSize(ctx, ln, c.w - 14, size), '#fff', '#061428'));
    // the bar
    const by = c.h - 46;
    a.fader = lerp(a.fader, tk.have / tk.need, Math.min(1, dt * 4));
    bar(ctx, 10, by, c.w - 20, 14, done ? 1 : a.fader, done ? ['#9affb0', '#18a040'] : ['#ffe070', '#e08a00'], tk.have > 0 && !done ? t : 0);
    bigText(ctx, `${tk.have.toLocaleString('en-US')}/${tk.need.toLocaleString('en-US')}`, c.w / 2, by + 7, 12, '#fff', '#1a0a00');
    // the prize
    drawReward(ctx, tk.reward, c.w / 2, c.h - 16, 14, 'center', c.w - 16);
    // the DONE stamp
    if (done) {
      a.stamp += dt;
      const s = a.stamp < 0.25 ? lerp(2.6, 1, ease.in(a.stamp / 0.25)) : 1;
      ctx.save();
      ctx.translate(c.w / 2, c.h * 0.42);
      ctx.rotate(-0.18);
      ctx.scale(s, s);
      ctx.globalAlpha = clamp01(a.stamp * 5) * 0.92;
      ctx.strokeStyle = '#5aff8a';
      ctx.lineWidth = 4;
      rr(ctx, -50, -18, 100, 36, 8);
      ctx.stroke();
      bigText(ctx, 'DONE', 0, 1, 26, '#7aff9a', '#0a3a1a');
      ctx.restore();
    }
    ctx.restore();
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    intro = Math.min(2, intro + dt);
    since += dt;
    if (since > 5 && !busy) { since = 0; refresh(); }
    backdrop(ctx, g.w, g.h, '#0e3a4a', '#060e1c', 'rgba(120,255,240,.12)');
    // the board title and time left
    ribbon(ctx, 'Mission board', g.w / 2, L.boardY + 10, Math.min(220, g.w - 120), 26, ['#2ab8b0', '#0a6a68']);
    if (v.endsAt) smallText(ctx, `⏱ ${timeLeft(v.endsAt)}`, g.w - 14, L.boardY + 10, 13, '#bff', 'right');
    for (let i = 0; i < 4; i++) card(ctx, i, t, dt);

    // ---- the desk ----
    const dy = L.deskY;
    panel(ctx, 8, dy, g.w - 16, L.deskH, 18, ['#2a2a3e', '#121220']);
    // brushed strip
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let k = 0; k < 6; k++) ctx.fillRect(12, dy + 10 + k * 6, g.w - 24, 2);
    // four faders: two each side of the chest
    const fx0 = [g.w * 0.1, g.w * 0.22, g.w * 0.78, g.w * 0.9];
    const top = dy + 24;
    const bot = dy + L.deskH - 26;
    G.tasks.forEach((tk, i) => {
      const x = fx0[i];
      ctx.fillStyle = '#05050c';
      rr(ctx, x - 4, top, 8, bot - top, 4);
      ctx.fill();
      const lvl = tk.done && anim[i].stamp !== null ? 1 : anim[i].fader;
      const ky = lerp(bot - 8, top + 8, lvl);
      // the lit channel
      const lg = ctx.createLinearGradient(0, bot, 0, ky);
      lg.addColorStop(0, LAMP[i] + '22');
      lg.addColorStop(1, LAMP[i] + 'cc');
      ctx.fillStyle = lg;
      rr(ctx, x - 3, ky, 6, bot - ky, 3);
      ctx.fill();
      panel(ctx, x - 13, ky - 8, 26, 16, 5, ['#e8e8f0', '#8a8aa0'], false);
      ctx.fillStyle = LAMP[i];
      ctx.fillRect(x - 10, ky - 1, 20, 3);
      smallText(ctx, String(i + 1), x, bot + 13, 12, '#9ad8ff');
      // a beam running from the card to the chest
      const a = anim[i];
      if (a.beam !== null && a.beam < 1) {
        a.beam += dt * 1.6;
        const c = L.cards[i];
        const sx = c.x + c.w / 2;
        const sy = c.y + c.h;
        const p = ease.inOut(clamp01(a.beam));
        const bx = lerp(sx, L.chestX, p);
        const byy = lerp(sy, L.chestY, p);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(bx, byy, 0, bx, byy, 26);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.3, LAMP[i]);
        rg.addColorStop(1, LAMP[i] + '00');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx, byy, 26, 0, TAU); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.6) fx.push({ x: bx, y: byy, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, g: 0, life: 0.4, age: 0, size: 3, color: LAMP[i], kind: 'spark', spin: 0 });
      }
    });

    // the ring of four segments around the chest
    ringShown = lerp(ringShown, ring, Math.min(1, dt * 6));
    const R = L.chestS * 0.78;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a0 = -Math.PI / 2 + i * (TAU / 4) + 0.12;
      const a1 = a0 + TAU / 4 - 0.24;
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(L.chestX, L.chestY, R, a0, a1); ctx.stroke();
      const f = clamp01(ringShown - i);
      if (f > 0) {
        ctx.strokeStyle = LAMP[i];
        ctx.shadowColor = LAMP[i];
        ctx.shadowBlur = 12;
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(L.chestX, L.chestY, R, a0, a0 + (a1 - a0) * f); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
    if (G.grandPaid || ring >= 4) rays(ctx, L.chestX, L.chestY, R * 1.5, t, 'rgba(255,230,140,.2)', 14);
    if (opening > 0 && opening < 1) {
      opening = Math.min(1, opening + dt * 1.2);
      if (opening > 0.4 && !g._boom) {
        g._boom = true;
        burst(fx, L.chestX, L.chestY - 10, { n: 60, colors: ['#ffe070', '#fff', '#7af0e0', '#ff7ab0'], speed: 460, size: 6, kind: 'star', life: 1.4 });
        words.push({ text: 'GRAND PRIZE!', x: L.chestX, y: L.chestY - L.chestS * 0.7, age: 0, size: 30 });
      }
    }
    const breathe = G.grandPaid ? 1 : 1 + 0.03 * Math.sin(t * 3) * (ring / 4);
    const shakeX = !G.grandPaid && ring === 3 ? Math.sin(t * 40) * 1.2 : 0;
    chest(ctx, L.chestX + shakeX, L.chestY + 6, L.chestS * breathe, ease.out(opening), ['#ffcf4a', '#a05a00']);
    bigText(ctx, 'Grand prize', L.chestX, dy + 16, 15, '#ffe070', '#3a1000');
    drawReward(ctx, G.grand, L.chestX, bot + 13, 14, 'center', g.w * 0.48);

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
