// MISSION PURSUIT: a seven-lane race track (rules in meta/events/pursuit.js).
// Three races, first to 3, 5 and 7 wins. Press Start, then win levels: your
// runner moves one post per win; the six computer runners move by the
// clock. Cross the finish line first to take the race's prize.
import {
  openGame, panel, bigText, ribbon, burst, sparks, floaters, rays, backdrop,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { addPicture } from '../eventicons.js';
import { avatarDisc, drawReward, smallText, timeLeft, emoji, fitSize } from './teamkit.js';

addPicture('pursuit', {
  types: ['pursuit'],
  colors: ['#ff6a2a', '#7a2000'],
  badge: ['#ffe8d8', '#f0a070'],
  paint(ctx) {
    // a chequered flag on a pole
    ctx.strokeStyle = '#5a2a00';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(28, 86); ctx.lineTo(28, 16); ctx.stroke();
    const s = 11;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#1a1a2a' : '#ffffff';
      ctx.fillRect(30 + x * s, 18 + y * s + Math.sin(x * 0.9) * 3, s, s);
    }
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 18, 5 * s, 4 * s + 3);
  },
});

const LANE = ['#3a1a6a', '#2e1458'];

export function openPursuit(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#5a1a2a', bottom: '#14060e' });
  const fx = [];
  const words = [];
  const L = {};
  // Shown position of each lane's runner (0..1), eased toward the real one.
  let shown = [];
  let busy = false;
  let since = 0;
  let count = -1; // start countdown age (-1 = none)
  let shake = 0;
  let wasRunning = v.game.running;

  function layout() {
    const W = g.w;
    const H = g.h;
    L.headY = 10;
    L.headH = 92;
    L.trackY = L.headY + L.headH + 22;
    L.trackH = Math.max(240, H - L.trackY - 16);
    L.laneH = L.trackH / 7;
    L.x0 = 58; // start line
    L.x1 = W - 40; // finish line
  }
  g.onResize = layout;
  layout();

  function setButtons() {
    const G = v.game;
    const list = [];
    if (!G.running && !G.over) list.push({ text: G.lost && G.lost.race === G.race ? 'Run it again' : `Start race ${G.race + 1}`, cls: 'primary', onClick: startRace });
    if (G.running) list.push({ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } });
    if (G.over) list.push({ text: 'Play a level', cls: '', onClick: () => { g.close(); api.play(); } });
    g.buttons(list);
  }

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    g.chip(G.over ? '★' : `${G.wins}/${G.target}`, (c, cx, cy, s) => emoji(c, '🏁', cx, cy, s * 0.8));
    if (wasRunning && !G.running && G.lost && G.lost.race === G.race) {
      shake = 0.4;
      g.toast(`${G.lost.by} crossed first!`);
    }
    wasRunning = G.running;
    if (G.over) g.note('All three races won. Well run!');
    else if (G.running) g.note(`Win ${G.target - G.wins} more level${G.target - G.wins === 1 ? '' : 's'} before anyone else. Losses do not move you back.`);
    else if (G.lost && G.lost.race === G.race) g.note(`${G.lost.by} won that one. New runners are on the line; start when you have time to play.`);
    else g.note(`Race ${G.race + 1}: first to win ${G.target} levels. The others start running when you press Start.`);
    setButtons();
    if (shown.length !== (G.lanes.length || 7)) shown = new Array(G.lanes.length || 7).fill(0);
  }
  refresh();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function startRace() {
    if (busy) return;
    busy = true;
    const out = api.act({ start: true });
    if (!out || !out.started) { busy = false; refresh(); return; }
    shown = new Array(7).fill(0);
    count = 0;
    refresh();
    api.changed();
    await wait(2000);
    busy = false;
  }

  async function celebrate(races) {
    busy = true;
    await wait(500);
    for (const r of races) {
      if (g.closed) return;
      burst(fx, g.w / 2, g.h * 0.4, { n: 60, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 420, size: 6, kind: 'star', life: 1.4 });
      words.push({ text: `Race ${r + 1} won!`, x: g.w / 2, y: g.h * 0.36, age: 0, size: 34 });
      await wait(900);
      if (g.closed) return;
      await g.prize(v.game.rewards[r], `First to ${v.game.targets[r]}!`, r === v.game.targets.length - 1 ? 'All three races are yours.' : 'The next race is ready when you are.');
    }
    if (g.closed) return;
    api.act({ seenWon: v.game.seenWon });
    refresh();
    api.changed();
    busy = false;
  }
  if (v.game.fresh && v.game.fresh.length) celebrate(v.game.fresh);

  g.onTap = (x, y) => {
    if (busy) return;
    const G = v.game;
    if (y > L.trackY && G.running) {
      const i = Math.floor((y - L.trackY) / L.laneH);
      const ln = G.lanes[i];
      if (ln) {
        g.toast(ln.you ? `You: ${ln.have} of ${ln.need}` : `${ln.name}: ${ln.have} of ${ln.need}`);
        words.push({ text: `${ln.have}/${ln.need}`, x: lerp(L.x0, L.x1, shown[i] || 0), y: L.trackY + (i + 0.5) * L.laneH - 16, age: 0, size: 18 });
      }
    } else if (y < L.headY + L.headH) {
      const i = Math.floor((x - 14) / ((g.w - 28) / 3));
      if (G.targets[i] !== undefined) g.toast(`Race ${i + 1}: first to win ${G.targets[i]} levels`);
    }
  };

  function medal(ctx, cx, cy, r, n, state, t) {
    // state: 'done' | 'now' | 'later'
    if (state === 'now') rays(ctx, cx, cy, r * 1.7, t, 'rgba(255,230,140,.25)', 10);
    const fill = state === 'done' ? ['#fff3a0', '#d08a00'] : state === 'now' ? ['#ff7a4a', '#b0281a'] : ['#6a5a8a', '#3a2a5a'];
    panel(ctx, cx - r, cy - r, r * 2, r * 2, r, fill, true);
    bigText(ctx, state === 'done' ? '✓' : String(n), cx, cy + 1, r * 1.05, '#fff', '#3a0a00');
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    since += dt;
    if (since > 2.5 && !busy) { since = 0; refresh(); }
    backdrop(ctx, g.w, g.h, '#5a1a2a', '#14060e', 'rgba(255,200,160,.14)');
    let ox = 0;
    if (shake > 0) { shake -= dt; ox = Math.sin(t * 60) * 5 * shake; }
    ctx.save();
    ctx.translate(ox, 0);

    // ---- the three races ----
    panel(ctx, 12, L.headY, g.w - 24, L.headH, 16, ['#3a1440', '#1a0820']);
    const cw = (g.w - 28) / 3;
    G.targets.forEach((n, i) => {
      const cx = 14 + cw * (i + 0.5);
      const state = i < G.race ? 'done' : i === G.race && !G.over ? 'now' : G.over ? 'done' : 'later';
      const r = state === 'now' ? 22 + Math.sin(t * 4) * 1.5 : 18;
      medal(ctx, cx, L.headY + 30, r, n, state, t);
      smallText(ctx, `first to ${n}`, cx, L.headY + 62, 12, state === 'later' ? '#b8a8d8' : '#ffe9a8');
      drawReward(ctx, G.rewards[i], cx, L.headY + 80, 12, 'center', cw - 8);
      if (i < 2) {
        ctx.strokeStyle = 'rgba(255,220,140,.4)';
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + 28, L.headY + 30); ctx.lineTo(cx + cw - 28, L.headY + 30); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    const tl = v.endsAt ? `ends in ${timeLeft(v.endsAt)}` : '';
    smallText(ctx, tl, g.w - 16, L.trackY - 11, 12, '#ffd0b0', 'right');
    const lead = G.running ? G.lanes.filter((l) => !l.you).reduce((a, b) => (b.have > a.have ? b : a), { have: -1 }) : null;
    if (lead && lead.have >= 0) smallText(ctx, `Leader: ${lead.name} ${lead.have}/${G.target}`, 16, L.trackY - 11, 12, '#ffd0b0', 'left');

    // ---- the track ----
    const ty = L.trackY;
    panel(ctx, 8, ty - 4, g.w - 16, L.trackH + 8, 12, ['#2a0e3a', '#160620']);
    for (let i = 0; i < 7; i++) {
      const y = ty + i * L.laneH;
      ctx.fillStyle = LANE[i % 2];
      ctx.fillRect(10, y, g.w - 20, L.laneH);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(10, y + L.laneH - 1, g.w - 20, 1);
      smallText(ctx, String(i + 1), 22, y + L.laneH / 2, 12, 'rgba(255,255,255,.35)');
    }
    // posts: one per win needed
    for (let k = 1; k < G.target; k++) {
      const x = lerp(L.x0, L.x1, k / G.target);
      ctx.fillStyle = 'rgba(255,240,200,.18)';
      ctx.fillRect(x - 1, ty, 2, L.trackH);
      smallText(ctx, String(k), x, ty + L.trackH + 9, 10, 'rgba(255,230,200,.5)');
    }
    // start and finish lines
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(L.x0 - 2, ty, 3, L.trackH);
    const sq = Math.max(5, L.laneH / 6);
    for (let yy = 0; yy * sq < L.trackH; yy++) for (let xx = 0; xx < 2; xx++) {
      ctx.fillStyle = (xx + yy) % 2 ? '#111' : '#fff';
      ctx.fillRect(L.x1 + xx * sq - sq, ty + yy * sq, sq, Math.min(sq, L.trackH - yy * sq));
    }

    // ---- the runners ----
    const r = Math.min(L.laneH * 0.36, 20);
    const lanes = G.running ? G.lanes : new Array(7).fill(null).map((_, i) => (i === 3 ? { you: true, have: 0, need: G.target, avatar: G.avatar, name: 'You' } : null));
    lanes.forEach((ln, i) => {
      const cy = ty + (i + 0.5) * L.laneH;
      if (!ln) {
        // an empty starting block
        ctx.save();
        ctx.strokeStyle = 'rgba(200,180,240,.4)';
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(L.x0 - r - 4, cy, r * 0.8, 0, TAU); ctx.stroke();
        ctx.restore();
        smallText(ctx, '?', L.x0 - r - 4, cy, r, 'rgba(220,200,255,.5)');
        return;
      }
      if (ln.you) {
        ctx.fillStyle = 'rgba(255,210,80,.22)';
        ctx.fillRect(10, cy - L.laneH / 2, g.w - 20, L.laneH);
      }
      const target = clamp01(ln.have / ln.need);
      const before = shown[i] || 0;
      shown[i] = lerp(before, target, Math.min(1, dt * (ln.you ? 3 : 1.6)));
      const moving = Math.abs(shown[i] - target) > 0.01;
      const x = lerp(L.x0, L.x1 - r, shown[i]);
      const hop = moving ? Math.abs(Math.sin(t * 14 + i)) * 5 : Math.abs(Math.sin(t * 2 + i)) * 1.2;
      if (moving && Math.random() < 0.4) fx.push({ x: x - r, y: cy + r * 0.7, vx: -40 - Math.random() * 40, vy: -20 * Math.random(), g: 60, life: 0.4, age: 0, size: 3, color: 'rgba(255,220,180,.7)', kind: 'spark', spin: 0 });
      if (ln.have >= ln.need) rays(ctx, x, cy, r * 2.2, t, 'rgba(255,230,140,.3)', 10);
      avatarDisc(ctx, ln.avatar, x, cy - hop, r, ln.you ? '#ffd23a' : '#c0b0e0');
      const name = ln.you ? 'YOU' : ln.name;
      const nx = Math.min(x + r + 4, L.x1 - 70);
      const fs = fitSize(ctx, name, 66, 12);
      bigText(ctx, name, x > L.x1 - 90 ? x - r - 4 : nx, cy - 2, fs, ln.you ? '#ffe070' : '#fff', '#1a0a2a', x > L.x1 - 90 ? 'right' : 'left');
      smallText(ctx, `${ln.have}/${ln.need}`, x > L.x1 - 90 ? x - r - 4 : nx, cy + 11, 10, 'rgba(255,240,220,.75)', x > L.x1 - 90 ? 'right' : 'left');
    });

    // ---- not running: the call to start ----
    if (!G.running && !busy) {
      const bw = Math.min(300, g.w - 50);
      const bh = 116;
      const bx = (g.w - bw) / 2;
      const by = ty + L.trackH / 2 - bh / 2;
      const k = 1 + Math.sin(t * 3) * 0.015;
      ctx.save();
      ctx.translate(g.w / 2, by + bh / 2);
      ctx.scale(k, k);
      ctx.translate(-g.w / 2, -(by + bh / 2));
      if (G.over) {
        rays(ctx, g.w / 2, by + bh / 2, 170, t, 'rgba(255,230,140,.25)', 16);
        panel(ctx, bx, by, bw, bh, 18, ['#ff9a3a', '#b0401a']);
        emoji(ctx, '🏆', g.w / 2, by + 40, 44);
        bigText(ctx, 'All three won!', g.w / 2, by + 88, 24);
      } else {
        const lost = G.lost && G.lost.race === G.race;
        panel(ctx, bx, by, bw, bh, 18, lost ? ['#6a2a4a', '#3a0a20'] : ['#5b24b8', '#2a0b6e']);
        ribbon(ctx, lost ? 'Beaten to the line' : `Race ${G.race + 1}`, g.w / 2, by, bw * 0.7, 30, lost ? ['#a04a6a', '#5a1030'] : ['#ff7a4a', '#b0281a']);
        bigText(ctx, `First to ${G.target} wins`, g.w / 2, by + 46, 24);
        const line = lost ? `${G.lost.by} got there first.` : 'Six runners are waiting.';
        smallText(ctx, line, g.w / 2, by + 74, 14);
        smallText(ctx, 'Press Start below', g.w / 2, by + 96, 14, '#ffd84a');
      }
      ctx.restore();
    }

    // ---- 3, 2, 1, GO ----
    if (count >= 0) {
      count += dt;
      const step = Math.floor(count / 0.5);
      const word = ['3', '2', '1', 'GO!'][step];
      if (word) {
        const p = (count % 0.5) / 0.5;
        ctx.globalAlpha = 1 - p * 0.6;
        bigText(ctx, word, g.w / 2, ty + L.trackH / 2, (word === 'GO!' ? 80 : 90) * (1.4 - 0.4 * ease.out(p)), word === 'GO!' ? '#7aff9a' : '#fff', '#3a0a00');
        ctx.globalAlpha = 1;
        if (p < dt * 2.5 && word === 'GO!') burst(fx, g.w / 2, ty + L.trackH / 2, { n: 40, colors: ['#7aff9a', '#fff', '#ffe070'], speed: 380, size: 5, kind: 'star', life: 1 });
      } else count = -1;
    }

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
    ctx.restore();
  };
  return g;
}
