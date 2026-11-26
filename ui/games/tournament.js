// THE COMPANY TOURNAMENT: the whole company's wins on one giant counter
// (rules in meta/events/tournament.js). The counter rolls up from what you
// last saw; the track under it fills toward three milestone chests (2,000,
// 5,000, 8,000) that burst open as it passes them. Below: what you have put
// in, what you still need to collect, and the top contributors.
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { addPicture } from '../eventicons.js';
import { avatarDisc, drawReward, bar, smallText, timeLeft, emoji, fmt, roller, scroller, fitSize } from './teamkit.js';

addPicture('tournament', {
  types: ['tournament'],
  colors: ['#2a7aff', '#0a2a7a'],
  badge: ['#e0ecff', '#7aa0f0'],
  paint(ctx) {
    // a big trophy cup with three stars
    ctx.fillStyle = '#ffc21a';
    ctx.strokeStyle = '#7a4000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 22); ctx.lineTo(70, 22); ctx.quadraticCurveTo(70, 58, 50, 62); ctx.quadraticCurveTo(30, 58, 30, 22);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(30, 36, 9, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(70, 36, 9, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    ctx.fillRect(45, 62, 10, 10);
    ctx.fillRect(36, 72, 28, 8);
    ctx.strokeRect(36, 72, 28, 8);
    ctx.fillStyle = '#fff';
    for (const [x, y] of [[40, 34], [50, 30], [60, 34]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  },
});

const MEDAL = ['#ffd23a', '#d8e0f0', '#e09050'];

export function openTournament(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#12306a', bottom: '#060a22' });
  const fx = [];
  const words = [];
  const L = {};
  const count = roller(v.game.seen);
  // Chests already open when the screen opened stay open; the others open
  // as the rolling counter passes them.
  const lid = v.game.milestones.map((m) => (m.paid && m.at <= v.game.seen ? 1 : 0));
  const popped = v.game.milestones.map((m) => m.at <= v.game.seen);
  const list = scroller();
  let since = 0;
  let busy = false;
  let reported = v.game.seen;

  function layout() {
    const W = g.w;
    L.counterY = 12;
    L.counterH = 96;
    L.trackY = L.counterY + L.counterH + 64;
    L.trackX0 = 26;
    L.trackX1 = W - 26;
    L.youY = L.trackY + 74;
    L.youH = 58;
    L.listY = L.youY + L.youH + 16;
    L.listH = Math.max(120, g.h - L.listY - 8);
    L.rowH = 38;
  }
  g.onResize = layout;
  layout();

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    count.set(G.total);
    g.chip(fmt(G.mine), (c, cx, cy, s) => emoji(c, '🏆', cx, cy, s * 0.8));
    const next = G.milestones[G.next];
    if (G.done) g.note('All three milestones are yours. Thanks for playing your part!');
    else if (next && next.locked) g.note(`Your company reached ${fmt(next.at)}! Win ${next.mustWin - G.mine} more level${next.mustWin - G.mine === 1 ? '' : 's'} to collect it.`);
    else if (next) g.note(`Every level you win adds 1. Next chest at ${fmt(next.at)}; you need ${next.mustWin} wins of your own to collect it.`);
    list.max = Math.max(0, G.top.length * L.rowH + 30 - L.listH);
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  refresh();

  g.onDrag = {
    start(x, y) { if (y > L.listY) list.start(y); },
    move(x, y) { list.move(y); },
    end() { list.end(); },
  };

  const xAt = (n) => {
    const goal = v.game.milestones[v.game.milestones.length - 1].at;
    return lerp(L.trackX0, L.trackX1, clamp01(n / goal));
  };

  g.onTap = (x, y) => {
    if (busy) return;
    const G = v.game;
    G.milestones.forEach((m, i) => {
      const cx = xAt(m.at) - (i === G.milestones.length - 1 ? 16 : 0);
      if (Math.abs(x - cx) < 30 && Math.abs(y - (L.trackY - 30)) < 34) {
        g.toast(m.paid ? 'Opened: the prize is in your tray.' : m.locked ? `Reached! Win ${m.mustWin - G.mine} more levels to collect.` : `${fmt(m.at - G.total)} more wins by the company. You need ${m.mustWin} of your own.`);
      }
    });
  };

  async function payout(i) {
    busy = true;
    const m = v.game.milestones[i];
    await new Promise((r) => setTimeout(r, 700));
    if (g.closed) return;
    await g.prize(m.reward, `${fmt(m.at)} wins!`, i === 2 ? 'The company did it. 10,000 coins!' : 'Super everything: every power-up free, unlimited lives.');
    busy = false;
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    since += dt;
    if (since > 5 && !busy) { since = 0; refresh(); }
    const rolling = count.step(dt);
    if (!rolling && Math.round(count.shown) > reported) { reported = Math.round(count.shown); api.act({ seen: reported }); }
    backdrop(ctx, g.w, g.h, '#12306a', '#060a22', 'rgba(160,200,255,.16)');

    // ---- the big counter ----
    const cy = L.counterY + L.counterH / 2;
    if (rolling) rays(ctx, g.w / 2, cy, 150, t, 'rgba(160,210,255,.16)', 14);
    panel(ctx, 16, L.counterY, g.w - 32, L.counterH, 18, ['#1a1040', '#0a0620']);
    // marquee bulbs around the box
    const n = 18;
    for (let k = 0; k < n; k++) {
      const on = (Math.floor(t * 6) + k) % 3 === 0;
      ctx.fillStyle = on ? '#fff3a0' : 'rgba(255,220,120,.35)';
      const bx = 26 + ((g.w - 52) * k) / (n - 1);
      ctx.beginPath(); ctx.arc(bx, L.counterY + 7, 2.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, L.counterY + L.counterH - 7, 2.6, 0, TAU); ctx.fill();
    }
    const big = fmt(count.shown);
    bigText(ctx, big, g.w / 2, cy - 6, fitSize(ctx, big, g.w - 80, 52) * (rolling ? 1 + 0.03 * Math.sin(t * 30) : 1), '#fff3a0', '#3a1a00');
    smallText(ctx, `levels won by ${G.team}`, g.w / 2, cy + 30, 13, '#bcd4ff');
    if (v.endsAt) smallText(ctx, `⏱ ${timeLeft(v.endsAt)}`, g.w - 26, L.counterY + 20, 12, '#bcd4ff', 'right');
    smallText(ctx, `${G.size} players`, 26, L.counterY + 20, 12, '#bcd4ff', 'left');

    // ---- the milestone track ----
    const ty = L.trackY;
    bar(ctx, L.trackX0, ty, L.trackX1 - L.trackX0, 16, clamp01(count.shown / G.milestones[G.milestones.length - 1].at), ['#7ad8ff', '#2a6aff'], t);
    G.milestones.forEach((m, i) => {
      const last = i === G.milestones.length - 1;
      const x = xAt(m.at) - (last ? 16 : 0);
      // passing a milestone: pop its chest
      if (!popped[i] && count.shown >= m.at) {
        popped[i] = true;
        burst(fx, x, ty - 30, { n: 40, colors: ['#ffe070', '#fff', '#7ad8ff'], speed: 360, size: 6, kind: 'star', life: 1.2 });
        words.push({ text: m.paid ? 'Unlocked!' : 'Reached!', x, y: ty - 60, age: 0, size: 24 });
        if (m.paid) payout(i);
      }
      if (popped[i] && m.paid) lid[i] = Math.min(1, lid[i] + dt * 2);
      ctx.fillStyle = '#ffc21a';
      ctx.fillRect(x - 1.5, ty - 6, 3, 28);
      const s = last ? 50 : 40;
      const wob = m.locked ? Math.sin(t * 8) * 0.06 : 0;
      ctx.save();
      ctx.translate(x, ty - 26);
      ctx.rotate(wob);
      if (m.paid) rays(ctx, 0, 0, s * 0.9, t, 'rgba(255,230,140,.3)', 10);
      chest(ctx, 0, 0, s, ease.out(lid[i]), last ? ['#ffcf4a', '#a05a00'] : ['#c0602a', '#6a2a0a']);
      ctx.restore();
      if (m.locked) emoji(ctx, '🔒', x + s * 0.4, ty - 40, 16);
      if (m.paid) bigText(ctx, '✓', x + s * 0.42, ty - 42, 18, '#7aff9a', '#0a3a1a');
      bigText(ctx, fmt(m.at), x, ty + 30, 14, m.reached ? '#fff3a0' : '#fff', '#0a1a4a');
      drawReward(ctx, m.reward, x, ty + 48, 12, 'center', last ? 80 : 70);
    });

    // ---- you ----
    const yy = L.youY;
    panel(ctx, 16, yy, g.w - 32, L.youH, 14, ['#3a2a7a', '#1a1050']);
    avatarDisc(ctx, (G.top.find((r) => r.you) || {}).avatar, 44, yy + L.youH / 2, 18);
    bigText(ctx, `You: ${fmt(G.mine)} win${G.mine === 1 ? '' : 's'}`, 70, yy + 20, 17, '#ffe070', '#1a0a2a', 'left');
    const next = G.milestones[G.next];
    const need = next ? Math.max(0, next.mustWin - G.mine) : 0;
    smallText(ctx, G.done ? 'All three collected' : need > 0 ? `${need} more to collect the next chest` : 'Ready to collect the next chest', 70, yy + 42, 12, need > 0 ? '#ffb0c0' : '#b0ffc0', 'left');
    bigText(ctx, `#${G.place}`, g.w - 36, yy + L.youH / 2, 22, '#fff', '#1a0a2a', 'right');

    // ---- top contributors ----
    list.step(dt);
    ctx.save();
    rr(ctx, 12, L.listY, g.w - 24, L.listH, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,6,40,.6)';
    ctx.fillRect(12, L.listY, g.w - 24, L.listH);
    bigText(ctx, 'Top contributors', g.w / 2, L.listY + 14 - list.y, 15, '#ffe070', '#1a0a2a');
    G.top.forEach((row, i) => {
      const y = L.listY + 30 + i * L.rowH - list.y;
      if (y < L.listY - L.rowH || y > L.listY + L.listH) return;
      if (row.you) { ctx.fillStyle = 'rgba(255,210,80,.25)'; rr(ctx, 16, y, g.w - 32, L.rowH - 4, 10); ctx.fill(); }
      const p = row.place;
      if (p <= 3) { ctx.fillStyle = MEDAL[p - 1]; ctx.beginPath(); ctx.arc(34, y + L.rowH / 2 - 2, 12, 0, TAU); ctx.fill(); }
      bigText(ctx, String(p), 34, y + L.rowH / 2 - 2, 14, '#fff', '#2a0a2a');
      avatarDisc(ctx, row.avatar, 66, y + L.rowH / 2 - 2, 14, row.you ? '#ffd23a' : '#9ab0e0');
      bigText(ctx, row.you ? 'You' : row.name, 88, y + L.rowH / 2 - 2, fitSize(ctx, row.name, g.w - 190, 15), row.you ? '#ffe070' : '#fff', '#0a0a2a', 'left');
      bigText(ctx, fmt(row.score), g.w - 28, y + L.rowH / 2 - 2, 16, '#fff', '#0a0a2a', 'right');
    });
    ctx.restore();

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
