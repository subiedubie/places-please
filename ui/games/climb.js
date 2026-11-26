// THE CLIMB SCREEN for the step-by-step side games: the Prop Room ladders
// (ladder), Tech Week (quota), the Call Sheet (missions) and Encore (chest);
// rules in meta/events/ladder.js, quota.js, missions.js and chest.js.
// At the top, what you are collecting now; under it, a winding climb of
// steps, each with its prize chest (open once paid), the current one
// glowing. What you gained since the last look flies in as orbs, the bar
// counts up, and any step passed meanwhile bursts its chest.
// Encore is one step for ever: a big chest that fills, ring by ring.
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU, GAME_FONT,
} from './kit.js';
import {
  num, clockText, drawReward, counter, seenNote, scroller, footer, bar, powerIcon, pieceIcon,
  launchOrbs, drawOrbs, emoji,
} from './showkit.js';

const MAX_W = 520;
const STEP_GAP = 104; // pixels between two steps of the climb
const POWER_NAME = { spot: 'Missiles', 'spot-h': 'Missiles', under: 'Ninja Stars', show: 'Grenades', prism: 'Magic Balls' };
const COLOR_NAME = ['Masks', 'Roses', 'Quills', 'Lanterns', 'Fans'];

export function openClimb(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#3a1078', bottom: '#12052e', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const orbs = [];
  const sc = scroller();
  const seen = seenNote(api, v);
  const before = seen.get();
  const shownHave = counter(0);
  let shownStep = v.game.step;
  let popAt = new Map(); // step -> age of its chest bursting
  let placed = false;
  const L = {};

  // Total progress as one number, to tell what was gained since the last look.
  // (The Call Sheet's steps are running scroll totals; the others' are sizes.)
  const stepSize = (k) => {
    const st = v.steps || [];
    if (!st[k]) return 1;
    return v.game.mode === 'missions' ? st[k].need - (k > 0 ? st[k - 1].need : 0) : st[k].need;
  };
  const totalOf = (step, have) => {
    let sum = have;
    for (let k = 0; k < step; k++) sum += stepSize(k);
    return sum;
  };

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    footer(g, api);
    const G = v.game;
    if (G.mode === 'ladder') {
      const what = G.collect ? (G.collect.made !== undefined ? POWER_NAME[G.collect.made] || 'power-ups' : COLOR_NAME[G.collect.color] || 'pieces') : 'wins';
      g.note(G.collect && G.collect.made !== undefined ? `Make ${what} in levels you win.` : `Clear ${what} in levels you win. Each step pays as it fills.`);
    } else if (G.mode === 'quota') g.note('Fire these power-ups in levels you win. Beat the clock for a bonus.');
    else if (G.mode === 'missions') g.note('Every call done is a scroll. Missed days stay open all week.');
    else g.note(`Every ${G.need} levels won, the house calls you back for a chest.`);
  }
  refresh();

  // ---- since the last look ----
  const G0 = v.game;
  const nowTotal = G0.mode === 'chest' ? G0.count : totalOf(G0.step, G0.have);
  const thenTotal = before && Number.isFinite(before.total) ? Math.min(before.total, nowTotal) : nowTotal;
  const gained = nowTotal - thenTotal;
  if (before && Number.isFinite(before.step) && G0.mode !== 'chest') shownStep = Math.min(before.step, G0.step);
  if (G0.mode === 'chest') shownHave.v = shownHave.to = thenTotal % G0.need;
  else if (shownStep < G0.step) shownHave.v = shownHave.to = before ? before.have || 0 : 0;
  else shownHave.v = shownHave.to = before ? Math.min(before.have || 0, G0.have) : G0.have;
  seen.set({ total: nowTotal, step: G0.step, have: G0.have });

  // The gained orbs fly into the current step, one batch per step passed.
  function playGain() {
    if (gained <= 0) { shownHave.to = v.game.have; return; }
    const target = L.orbTarget || { x: g.w / 2, y: 120 };
    const n = Math.min(24, Math.max(3, Math.round(gained)));
    const per = gained / n;
    let got = 0;
    words.push({ text: `+${num(gained)}`, x: target.x, y: target.y + 30, age: -0.4, size: 30, color: '#7affa0', stroke: '#063a1a', life: 1.6 });
    launchOrbs(orbs, n, { x: g.w / 2, y: g.h - 40, spread: g.w * 0.6 }, target, {
      delay: 0.35,
      onArrive: (o) => {
        got += per;
        advance(per);
        burst(fx, o.tx, o.ty, { n: 3, colors: ['#fff', '#ffe070'], speed: 90, size: 3, gravity: 0, life: 0.3 });
        if (o.last) { shownStep = v.game.step; shownHave.to = v.game.have; }
      },
    });
  }
  // One orb's worth of progress: fill the bar, pass steps as they fill.
  function advance(amount) {
    const G = v.game;
    if (G.mode === 'chest') {
      shownHave.to += amount;
      if (shownHave.to >= G.need - 0.001) { shownHave.to -= G.need; shownHave.v = 0; popAt.set(0, 0); }
      return;
    }
    shownHave.to += amount;
    while (shownStep < G.step && v.steps[shownStep] && shownHave.to >= stepSize(shownStep) - 0.001) {
      shownHave.to -= stepSize(shownStep);
      shownHave.v = 0;
      popAt.set(shownStep, 0);
      shownStep++;
    }
  }
  setTimeout(playGain, 250);

  g.onDrag = { start(x, y) { sc.start(y); }, move(x, y) { sc.move(y); }, end() { sc.end(); }, cancel() { sc.end(); } };
  g.onTap = (x, y) => burst(fx, x, y, { n: 8, colors: ['#fff', '#ffe070'], speed: 120, size: 3, gravity: 0, life: 0.4 });

  // ---- the goal card at the top ----
  function goalCard(ctx, t, X, W) {
    const G = v.game;
    const y = 10;
    const stepNeed = G.need;
    const have = shownHave.step(1 / 60);
    if (G.mode === 'quota' && v.needs) {
      const rows = v.needs;
      const h = 56 + rows.length * 30;
      panel(ctx, X + 12, y, W - 24, h, 18, ['#5b24b8', '#2a0b6e']);
      bigText(ctx, `Stage ${G.step + 1} of ${G.stepCount}`, X + 30, y + 22, 18, '#ffe070', '#3a1000', 'left');
      if (v.bonusEndsAt && v.bonusEndsAt > Date.now() && G.bonus) {
        clockText(ctx, v.bonusEndsAt, X + W - 30, y + 22, 13, 'right');
        bigText(ctx, 'bonus', X + W - 150, y + 22, 12, '#ffe9a8', '#2a0a5e', 'right');
        drawReward(ctx, G.bonus, X + W - 146, y + 22, 14, 'left', 1);
      }
      rows.forEach((r, i) => {
        const ry = y + 52 + i * 30;
        powerIcon(ctx, r.kind, X + 40, ry, 24);
        bar(ctx, X + 62, ry - 9, W - 160, 18, r.have / r.need, r.have >= r.need ? ['#9affc0', '#18a050'] : ['#ffe070', '#d08000']);
        bigText(ctx, r.have >= r.need ? '✓' : `${r.have}/${r.need}`, X + W - 52, ry, 16, r.have >= r.need ? '#7affa0' : '#fff');
      });
      L.orbTarget = { x: X + W / 2, y: y + 40 };
      return y + h + 8;
    }
    if (G.mode === 'missions' && v.missions) {
      const open = v.missions.filter((m) => !m.done);
      const today = v.missions.slice(-3);
      const showList = [...today, ...open.filter((m) => !today.includes(m))].slice(0, 5);
      const h = 64 + showList.length * 30;
      panel(ctx, X + 12, y, W - 24, h, 18, ['#5b24b8', '#2a0b6e']);
      emoji(ctx, '📜', X + 38, y + 24, 24);
      bigText(ctx, `${num(G.scrolls)} scroll${G.scrolls === 1 ? '' : 's'}`, X + 58, y + 24, 22, '#ffe070', '#3a1000', 'left');
      if (stepNeed) bigText(ctx, `${Math.max(0, stepNeed - G.have)} to the next prize`, X + W - 28, y + 24, 13, '#ffe9a8', '#2a0a5e', 'right');
      showList.forEach((m, i) => {
        const ry = y + 58 + i * 30;
        ctx.fillStyle = m.done ? 'rgba(62,224,122,.25)' : 'rgba(255,255,255,.08)';
        rr(ctx, X + 22, ry - 13, W - 44, 26, 9); ctx.fill();
        bigText(ctx, m.done ? '✓' : '•', X + 34, ry, 15, m.done ? '#7affa0' : '#ffe070');
        const label = `${m.text}${today.includes(m) ? '' : ` (${m.day})`}`;
        bigText(ctx, label.length > 34 ? label.slice(0, 33) + '…' : label, X + 46, ry, 13, '#fff', '#2a0a5e', 'left');
        bigText(ctx, m.done ? 'done' : `${num(m.have)}/${num(m.need)}`, X + W - 32, ry, 13, m.done ? '#7affa0' : '#fff', '#2a0a5e', 'right');
      });
      L.orbTarget = { x: X + 60, y: y + 24 };
      return y + h + 8;
    }
    // ladder (and the one-step chest uses its own big picture below)
    const h = 92;
    panel(ctx, X + 12, y, W - 24, h, 18, ['#5b24b8', '#2a0b6e']);
    const ix = X + 52;
    const iy = y + 46;
    rays(ctx, ix, iy, 40, t, 'rgba(255,230,140,.2)', 10);
    const c = G.collect;
    if (c && c.made !== undefined) powerIcon(ctx, c.made, ix, iy, 50);
    else if (c && Number.isInteger(c.color)) pieceIcon(ctx, c.color, ix, iy, 52);
    else emoji(ctx, '⭐', ix, iy, 40);
    if (stepNeed) {
      bigText(ctx, `Step ${Math.min(shownStep, G.stepCount - 1) + 1} of ${G.stepCount}`, X + 92, y + 24, 16, '#ffe070', '#3a1000', 'left');
      bigText(ctx, `${num(have)}`, X + 92, y + 52, 28, '#fff', '#2a0a5e', 'left');
      ctx.save(); ctx.font = `28px ${GAME_FONT}`; const wd = ctx.measureText(num(have)).width; ctx.restore();
      const curNeed = v.steps[Math.min(shownStep, v.steps.length - 1)].need;
      bigText(ctx, ` / ${num(curNeed)}`, X + 92 + wd, y + 54, 18, '#e8d8ff', '#2a0a5e', 'left');
      bar(ctx, X + 92, y + 68, W - 128, 14, have / curNeed);
    } else {
      bigText(ctx, 'All steps done!', X + 92, y + 40, 24, '#7affa0', '#063a1a', 'left');
      drawReward(ctx, G.grand, X + 92, y + 70, 18, 'left');
    }
    L.orbTarget = { x: X + 92 + (W - 128) * clamp01(have / Math.max(1, stepNeed || 1)), y: y + 75 };
    return y + h + 8;
  }

  // ---- the winding climb ----
  function track(ctx, t, X, W, top) {
    const G = v.game;
    const steps = v.steps || [];
    const n = steps.length;
    const viewH = g.h - top;
    const contentH = (n + 1) * STEP_GAP + 60;
    sc.max = Math.max(0, contentH - viewH);
    sc.min = 0;
    // position k (0 = first step) from the bottom of the content
    const posOf = (k) => {
      const y = contentH - 60 - k * STEP_GAP;
      const x = X + W / 2 + Math.sin(k * 1.1) * Math.min(90, W * 0.22);
      return { x, y };
    };
    const cur = posOf(Math.min(shownStep, n));
    if (!placed) {
      placed = true;
      sc.to(cur.y - viewH * 0.55);
    } else if (orbs.length && !sc.held) {
      // follow the climb while the gained orbs are flying in
      sc.to(sc.y + (cur.y - viewH * 0.55 - sc.y) * 0.06);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, g.w, viewH);
    ctx.clip();
    ctx.translate(0, top - sc.y);
    // the rope between the steps
    ctx.strokeStyle = 'rgba(255,220,150,.35)';
    ctx.lineWidth = 6;
    ctx.setLineDash([2, 12]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const p = posOf(k); if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    ctx.setLineDash([]);
    // the grand prize at the top
    if (G.grand && n > 1) {
      const p = posOf(n);
      rays(ctx, p.x, p.y, 70, t, 'rgba(255,230,140,.22)', 14);
      chest(ctx, p.x, p.y, 64, shownStep >= n ? 1 : 0, ['#ffcf3a', '#a05a00']);
      ribbon(ctx, 'Grand prize', p.x, p.y + 46, 120, 24);
      drawReward(ctx, G.grand, p.x, p.y + 72, 15);
    }
    for (let k = n - 1; k >= 0; k--) {
      const s = steps[k];
      const p = posOf(k);
      const screenY = p.y - sc.y + top;
      if (screenY < top - 80 || screenY > g.h + 80) continue;
      const done = k < shownStep;
      const cur = k === shownStep;
      const side = Math.sin(k * 1.1) > 0 ? -1 : 1; // the prize sits on the inside of the bend
      // the prize chest beside the node
      const pa = popAt.get(k);
      const cxp = p.x + side * 74;
      if (pa !== undefined) {
        popAt.set(k, pa + 1 / 60);
        rays(ctx, cxp, p.y, 50 * ease.out(clamp01(pa / 0.3)), t, 'rgba(255,230,140,.35)', 10);
        if (pa < 0.05) { burst(fx, cxp, p.y - sc.y + top, { n: 30, colors: ['#ffe070', '#fff', '#7affa0'], speed: 300, size: 5, kind: 'star', life: 1 }); words.push({ text: 'Paid!', x: cxp, y: p.y - sc.y + top - 20, age: 0, size: 22, color: '#7affa0', stroke: '#063a1a' }); }
      }
      chest(ctx, cxp, p.y - 4, cur ? 44 : 36, done ? (pa !== undefined ? clamp01(pa / 0.3) : 1) : 0);
      drawReward(ctx, s.reward, cxp, p.y + 30, 13, 'center', 2);
      // the node
      if (cur) {
        rays(ctx, p.x, p.y, 54, t, 'rgba(255,230,140,.3)', 12);
        ctx.save();
        ctx.shadowColor = '#ffe070';
        ctx.shadowBlur = 18 + 8 * Math.sin(t * 4);
        panel(ctx, p.x - 30, p.y - 30, 60, 60, 30, ['#ff6a9a', '#b0103c']);
        ctx.restore();
        // the progress ring
        const part = clamp01(shownHave.v / Math.max(1, stepSize(k)));
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 38, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#7affa0';
        ctx.beginPath(); ctx.arc(p.x, p.y, 38, -Math.PI / 2, -Math.PI / 2 + TAU * part); ctx.stroke();
        bigText(ctx, String(k + 1), p.x, p.y + 1, 28);
      } else {
        panel(ctx, p.x - 22, p.y - 22, 44, 44, 22, done ? ['#3ee07a', '#0a8a3a'] : ['#6a5a8a', '#3a2a5a']);
        bigText(ctx, done ? '✓' : String(k + 1), p.x, p.y + 1, 20);
      }
      bigText(ctx, `${num(s.need)}`, p.x, p.y + (cur ? 50 : 36), 12, '#ffe9a8');
    }
    ctx.restore();
    if (sc.y > 4 && shownStep > 0) bigText(ctx, '▲ more steps above', g.w / 2, top + 12, 12, 'rgba(255,240,200,.7)');
  }

  // Encore: one big chest filling ring by ring.
  function bigChest(ctx, t, X, W) {
    const G = v.game;
    const cx = X + W / 2;
    const cy = g.h * 0.42;
    const r = Math.min(W * 0.38, g.h * 0.3);
    const pa = popAt.get(0);
    rays(ctx, cx, cy, r * 1.3, t, 'rgba(255,230,140,.18)', 16);
    // the ring of rungs: one per level won
    const have = shownHave.step(1 / 60);
    for (let i = 0; i < G.need; i++) {
      const a = -Math.PI / 2 + (i / G.need) * TAU;
      const lit = i < Math.floor(have);
      ctx.fillStyle = lit ? '#ffe070' : 'rgba(255,255,255,.15)';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, lit ? 6 : 4.5, 0, TAU); ctx.fill();
    }
    let open = 0;
    if (pa !== undefined) {
      popAt.set(0, pa + 1 / 60);
      open = clamp01(pa / 0.3);
      if (pa < 0.05) burst(fx, cx, cy, { n: 50, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 420, size: 6, kind: 'star', life: 1.3 });
      if (pa > 2.5) popAt.delete(0);
    }
    const shakeA = have / G.need > 0.85 && pa === undefined ? Math.sin(t * 30) * 0.05 : 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shakeA);
    chest(ctx, 0, 0, r * 0.95, open, ['#ffcf3a', '#a05a00']);
    ctx.restore();
    bigText(ctx, `${Math.floor(have)}/${G.need}`, cx, cy + r * 0.72, 30);
    bigText(ctx, 'levels won', cx, cy + r * 0.72 + 26, 14, '#ffe9a8');
    drawReward(ctx, G.reward, cx, cy - r - 30, 18);
    bigText(ctx, `${num(G.count)} wins so far · ${Math.floor(G.count / G.need)} chest${Math.floor(G.count / G.need) === 1 ? '' : 's'} earned`, cx, g.h - 24, 14, '#c8b8ff');
    L.orbTarget = { x: cx, y: cy };
  }

  g.draw = (ctx, dt, t) => {
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    backdrop(ctx, g.w, g.h, '#3a1078', '#12052e');
    sc.step(dt);
    if (v.game.mode === 'chest') bigChest(ctx, t, X, W);
    else {
      const top = goalCard(ctx, t, X, W);
      track(ctx, t, X, W, top);
    }
    drawOrbs(ctx, orbs, dt);
    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
