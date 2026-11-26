// THE COMPANY POT screen (type 'company', rules in meta/events/company.js).
// One giant marquee counter for the whole company's total, a bar with the
// three chests sitting at their totals (each bursts open when reached),
// your own share, and everyone who put something in. Since the last look
// the counter rolls up and any chest reached meanwhile opens.
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, TAU,
} from './kit.js';
import {
  youFace, faceOf, token, ordinal, num, clockText, drawReward, counter, seenNote, scroller, footer,
  launchOrbs, drawOrbs,
} from './showkit.js';

const MAX_W = 520;
const ROW_H = 42;
const REFRESH = 3;

// A marquee board of light bulbs with the number on it.
function marquee(ctx, x, y, w, h, text, t) {
  panel(ctx, x, y, w, h, 18, ['#8a1030', '#3a0012']);
  const n = Math.floor((w + h) / 16);
  for (let i = 0; i < n * 2; i++) {
    const k = i / (n * 2);
    let bx; let by;
    const per = 2 * (w + h);
    const d = k * per;
    if (d < w) { bx = x + d; by = y + 6; }
    else if (d < w + h) { bx = x + w - 6; by = y + d - w; }
    else if (d < 2 * w + h) { bx = x + w - (d - w - h); by = y + h - 6; }
    else { bx = x + 6; by = y + h - (d - 2 * w - h); }
    const on = (Math.floor(t * 6) + i) % 3 !== 0;
    ctx.fillStyle = on ? '#fff3a0' : '#8a5a20';
    ctx.beginPath(); ctx.arc(bx, by, 3, 0, TAU); ctx.fill();
  }
  bigText(ctx, text, x + w / 2, y + h / 2 + 2, Math.min(h * 0.62, (w - 30) / Math.max(3, text.length) * 1.6), '#fff3a0', '#5a1000');
}

export function openPot(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#0e4a3a', bottom: '#06201a', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const orbs = [];
  const sc = scroller();
  const seen = seenNote(api, v);
  const before = seen.get();
  const total = counter(before && Number.isFinite(before.total) ? Math.min(before.total, v.total.have) : v.total.have);
  const mine = counter(before && Number.isFinite(before.mine) ? Math.min(before.mine, v.game.mine) : v.game.mine);
  const chestAge = new Map(); // chest -> age of its opening
  const shownOpen = new Set((v.chests || []).map((c, i) => (before && i < (before.opened ?? 0) ? i : c.open && !before ? i : -1)).filter((i) => i >= 0));
  let since = 0;
  const L = {};

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    total.to = v.total.have;
    mine.to = v.game.mine;
    seen.set({ total: v.total.have, mine: v.game.mine, opened: v.game.opened });
  }
  footer(g, api);
  g.note('Every level you win adds to the pot (harder levels add more). Teammates keep adding while you are away.');
  refresh();
  if (before && v.total.have > (before.total ?? 0)) {
    setTimeout(() => {
      const gain = v.total.have - (before.total ?? 0);
      words.push({ text: `+${num(gain)} while you were away`, x: g.w / 2, y: (L.counterY || 80) + 70, age: 0, size: 20, color: '#7affa0', stroke: '#063a1a', life: 2 });
      launchOrbs(orbs, Math.min(18, Math.max(4, Math.round(gain / 3))), { x: g.w / 2, y: g.h, spread: g.w }, { x: g.w / 2, y: (L.counterY || 80) + 30 }, { delay: 0.2 });
    }, 350);
  }

  g.onDrag = { start(x, y) { sc.start(y); }, move(x, y) { sc.move(y); }, end() { sc.end(); }, cancel() { sc.end(); } };
  g.onTap = (x, y) => burst(fx, x, y, { n: 8, colors: ['#fff', '#ffe070'], speed: 120, size: 3, gravity: 0, life: 0.4 });

  g.draw = (ctx, dt, t) => {
    since += dt;
    if (since > REFRESH) { since = 0; refresh(); if (!v) return; }
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    backdrop(ctx, g.w, g.h, '#0e4a3a', '#06201a', 'rgba(200,255,220,.14)');
    sc.step(dt);
    ctx.save();
    ctx.translate(0, -sc.y);
    const G = v.game;
    let y = 10;
    if (v.endsAt) clockText(ctx, v.endsAt, X + W / 2, y + 12, 14);
    y += 30;
    // ---- the counter ----
    L.counterY = y;
    const shown = total.step(dt);
    rays(ctx, X + W / 2, y + 50, 160, t, 'rgba(255,240,170,.12)', 16);
    marquee(ctx, X + 20, y, W - 40, 100, num(Math.round(shown)), t);
    bigText(ctx, 'the company total', X + W / 2, y + 116, 14, '#c8ffe0', '#06301a');
    y += 140;
    // ---- the bar with its chests ----
    const goal = v.total.need;
    const bx = X + 30;
    const bw = W - 60;
    const by = y + 50;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    rr(ctx, bx, by, bw, 22, 11); ctx.fill();
    const part = clamp01(shown / goal);
    const fill = ctx.createLinearGradient(0, by, 0, by + 22);
    fill.addColorStop(0, '#fff3a0');
    fill.addColorStop(1, '#e09a00');
    ctx.fillStyle = fill;
    if (part > 0) { rr(ctx, bx + 2, by + 2, Math.max(18, (bw - 4) * part), 18, 9); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    if (part > 0) { rr(ctx, bx + 6, by + 4, Math.max(0, (bw - 12) * part), 5, 3); ctx.fill(); }
    (v.chests || []).forEach((c, i) => {
      const cx = bx + bw * clamp01(c.at / goal);
      const reached = shown >= c.at;
      if (reached && !shownOpen.has(i)) {
        shownOpen.add(i);
        chestAge.set(i, 0);
        burst(fx, cx, by - 20, { n: 36, colors: ['#ffe070', '#fff', '#7affa0'], speed: 320, size: 6, kind: 'star', life: 1.2 });
        g.toast(`Chest ${i + 1} open! Its prize is in your tray.`);
      }
      const age = chestAge.get(i);
      if (age !== undefined) chestAge.set(i, age + dt);
      const open = shownOpen.has(i) ? (age !== undefined ? clamp01(age / 0.3) : 1) : 0;
      const near = !reached && shown / c.at > 0.85 ? Math.sin(t * 28) * 0.07 : 0;
      if (open > 0) rays(ctx, cx, by - 18, 40, t, 'rgba(255,230,140,.3)', 10);
      ctx.save();
      ctx.translate(cx, by - 18);
      ctx.rotate(near);
      chest(ctx, 0, 0, i === 2 ? 48 : 40, open, i === 2 ? ['#ffcf3a', '#a05a00'] : undefined);
      ctx.restore();
      bigText(ctx, num(c.at), cx, by + 36, 14, '#fff');
      drawReward(ctx, c.reward, Math.max(X + 50, Math.min(X + W - 50, cx)), by + 58, 13, 'center', 2);
    });
    y = by + 84;
    // ---- you ----
    const rows = v.rows || [];
    const me = rows.find((r) => r.you);
    panel(ctx, X + 16, y, W - 32, 86, 18, me && me.place <= G.topPlaces ? ['#2ec070', '#0a6a34'] : ['#1a8a5a', '#0a3a2a']);
    token(ctx, youFace(G.avatar), X + 54, y + 43, 26, true, 0.3);
    bigText(ctx, `You put in ${num(Math.round(mine.step(dt)))}`, X + 92, y + 26, 20, '#fff', '#06301a', 'left');
    if (me) {
      const inTop = me.place <= G.topPlaces;
      const cut = rows[G.topPlaces - 1];
      const line = inTop ? `${ordinal(me.place)} in the company: top ${G.topPlaces} get a bonus!` : `${ordinal(me.place)}: ${num(Math.max(1, cut.score - me.score))} more for the top ${G.topPlaces}`;
      bigText(ctx, line, X + 92, y + 52, 13, inTop ? '#e8ffe8' : '#ffe9a8', '#06301a', 'left');
      drawReward(ctx, G.topBonus, X + 92, y + 72, 14, 'left', 2);
    }
    y += 104;
    // ---- everyone ----
    ribbon(ctx, 'The company', X + W / 2, y + 12, 150, 26, ['#3ee07a', '#0a7a3a']);
    y += 36;
    rows.forEach((r, i) => {
      const ry = y + i * ROW_H;
      ctx.fillStyle = r.you ? 'rgba(122,255,160,.28)' : i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)';
      rr(ctx, X + 14, ry, W - 28, ROW_H - 6, 12); ctx.fill();
      const mid = ry + (ROW_H - 6) / 2;
      bigText(ctx, String(r.place), X + 36, mid, 15, r.place <= G.topPlaces ? '#ffe070' : '#fff');
      token(ctx, r.you ? youFace(G.avatar) : faceOf(r.name), X + 72, mid, 14, r.you);
      bigText(ctx, r.you ? 'You' : r.name, X + 94, mid, 15, '#fff', '#06301a', 'left');
      if (r.place <= G.topPlaces) bigText(ctx, '★', X + W - 82, mid, 16, '#ffe070', '#5a3000');
      bigText(ctx, num(r.score), X + W - 30, mid, 17, '#fff', '#06301a', 'right');
    });
    y += rows.length * ROW_H + 10;
    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
    ctx.restore();
    sc.max = Math.max(0, y - g.h);
    sc.clamp();
    drawOrbs(ctx, orbs, dt);
  };
  return g;
}
