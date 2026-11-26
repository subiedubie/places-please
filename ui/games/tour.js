// THE TOUR SCREEN for the streaks without rival lanes: The Long Tour
// (stages + reveal grids) and The Scottish Play (one plain streak); rules
// in meta/events/streak.js.
// A road snakes up the page through the towns of the tour; every win in a
// row moves the company's wagon one stop on; a loss drives it back (to the
// first town on the Long Tour). Each town reached for the first time opens
// a REVEAL GRID: twelve face-down tiles; tap them one by one until three
// coin bags of one kind show. That kind's prize is yours.
//   api.act({ flip: tile })  turns one tile
import { addPicture } from '../eventicons.js';
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { youFace, emoji, num, clockText, drawReward, seenNote, footer, scroller } from './showkit.js';

const MAX_W = 520;
const PER_ROW = 4; // stops in one row of the road
const ROW_H = 78;
const TIER_COLORS = [['#f0a060', '#8a4010'], ['#f4f6ff', '#7a84a8'], ['#fff07a', '#c08000']];

// A coin bag in a tier's colours.
function bag(ctx, x, y, s, tier) {
  const c = TIER_COLORS[Math.min(tier, 2)];
  ctx.save();
  const g = ctx.createRadialGradient(x - s * 0.15, y - s * 0.05, s * 0.05, x, y + s * 0.1, s * 0.55);
  g.addColorStop(0, c[0]);
  g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(40,10,0,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, y - s * 0.28);
  ctx.quadraticCurveTo(x - s * 0.5, y, x - s * 0.36, y + s * 0.32);
  ctx.quadraticCurveTo(x, y + s * 0.46, x + s * 0.36, y + s * 0.32);
  ctx.quadraticCurveTo(x + s * 0.5, y, x + s * 0.16, y - s * 0.28);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // the tied neck
  ctx.beginPath();
  ctx.moveTo(x - s * 0.2, y - s * 0.4); ctx.lineTo(x, y - s * 0.3); ctx.lineTo(x + s * 0.2, y - s * 0.4); ctx.lineTo(x + s * 0.12, y - s * 0.26); ctx.lineTo(x - s * 0.12, y - s * 0.26); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8183c';
  ctx.fillRect(x - s * 0.16, y - s * 0.3, s * 0.32, s * 0.06);
  // a coin mark
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = `${Math.round(s * 0.34)}px "Lilita One", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', x, y + s * 0.1);
  ctx.restore();
}

// A little touring theatre: the town at the end of a stage.
function town(ctx, x, y, s, lit, flag) {
  ctx.save();
  if (lit) rays(ctx, x, y, s * 1.1, performance.now() / 1000, 'rgba(255,230,140,.25)', 12);
  ctx.fillStyle = '#5a1a2a';
  ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.1); ctx.lineTo(x, y - s * 0.55); ctx.lineTo(x + s * 0.55, y - s * 0.1); ctx.closePath(); ctx.fill();
  panel(ctx, x - s * 0.48, y - s * 0.12, s * 0.96, s * 0.6, s * 0.06, lit ? ['#ff6a9a', '#a0103c'] : ['#8a7aa8', '#4a3a6a'], true);
  ctx.fillStyle = '#2a0a1a';
  rr(ctx, x - s * 0.14, y + s * 0.12, s * 0.28, s * 0.36, s * 0.12); ctx.fill();
  if (flag) {
    ctx.strokeStyle = '#4a2000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x, y - s * 0.95); ctx.stroke();
    ctx.fillStyle = '#3ee07a';
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.95); ctx.lineTo(x + s * 0.34, y - s * 0.84); ctx.lineTo(x, y - s * 0.72); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function wagon(ctx, x, y, s, face, t, bounce) {
  ctx.save();
  ctx.translate(x, y - Math.abs(Math.sin(t * 16)) * 4 * bounce);
  emoji(ctx, face, 0, -s * 0.5, s * 0.6);
  ctx.fillStyle = '#c0502a';
  ctx.strokeStyle = '#4a1000';
  ctx.lineWidth = 2;
  rr(ctx, -s * 0.45, -s * 0.22, s * 0.9, s * 0.36, s * 0.08); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffc21a';
  ctx.fillRect(-s * 0.45, -s * 0.12, s * 0.9, s * 0.06);
  for (const wx of [-0.27, 0.27]) {
    ctx.fillStyle = '#3a1a08';
    ctx.beginPath(); ctx.arc(wx * s, s * 0.16, s * 0.14, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffc21a';
    ctx.beginPath(); ctx.arc(wx * s, s * 0.16, s * 0.08, t * 6, t * 6 + 4); ctx.stroke();
  }
  ctx.restore();
}

addPicture('longtour', {
  ids: ['longtour'],
  colors: ['#c0502a', '#5a1a08'],
  badge: ['#fff0d9', '#e9bd7e'],
  paint(ctx) {
    ctx.strokeStyle = '#c8a070';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 84); ctx.quadraticCurveTo(50, 70, 40, 52); ctx.quadraticCurveTo(30, 36, 70, 28); ctx.stroke();
    town(ctx, 72, 32, 30, true, true);
    bag(ctx, 30, 70, 30, 2);
  },
});

export function openTour(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#4a2a6e', bottom: '#1a0a2a', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const sc = scroller();
  const seen = seenNote(api, v);
  const before = seen.get();
  const L = {};
  // The wagon's place on the road: stops passed since the start of stage 1.
  const placeOf = (G) => {
    if (G.cleared >= G.stages.length && G.mode === 'tour' && G.have === 0 && G.stage === G.stages.length - 1) return G.stages.reduce((a, b) => a + b, 0);
    return G.stages.slice(0, G.stage).reduce((a, b) => a + b, 0) + G.have;
  };
  let shown = before && Number.isFinite(before.place) ? before.place : placeOf(v.game);
  let target = shown;
  let backTrip = before && v.game.falls !== undefined && v.game.falls > (before.falls || 0);
  let wait = 0.6;
  let placed = false;
  // the grid
  const flips = new Map(); // tile -> { age, tier }
  let won = null; // { tier, tiles, age, reward }
  let gridBusy = false;
  let gridIn = -1; // age of the grid overlay sliding in (it waits for the wagon)

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    if (G.grid) { g.buttons([]); window.dispatchEvent(new Event('resize')); }
    else if (G.cleared >= G.stages.length) { g.buttons([]); window.dispatchEvent(new Event('resize')); }
    else footer(g, api);
    if (G.grid) g.note('Turn tiles until three coin bags match.');
    else if (G.mode === 'plain') g.note(`Win ${G.stages[0]} levels in a row. One slip and the run starts over.`);
    else g.note(G.restart === 'start' ? 'Win levels in a row. A loss takes the tour back to the first town.' : 'Win levels in a row. A loss starts the stage again.');
  }
  refresh();
  seen.set({ place: placeOf(v.game), falls: v.game.falls || 0 });

  // ---- road geometry (content coordinates; row 0 at the bottom) ----
  const total = () => v.game.stages.reduce((a, b) => a + b, 0);
  function point(k, W, X, contentH) {
    const row = Math.floor(k / PER_ROW);
    const i = k % PER_ROW;
    const col = row % 2 ? PER_ROW - 1 - i : i;
    const x = X + 50 + (col * (W - 100)) / (PER_ROW - 1);
    const y = contentH - 110 - row * ROW_H; // (room under the start for the status card)
    return { x, y };
  }
  function pointAt(f, W, X, H) {
    const k = Math.floor(f);
    const a = point(k, W, X, H);
    const b = point(Math.min(k + 1, total()), W, X, H);
    const u = f - k;
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }

  g.onDrag = { start(x, y) { if (!v.game.grid) sc.start(y); }, move(x, y) { sc.move(y); }, end() { sc.end(); }, cancel() { sc.end(); } };
  g.onTap = (x, y) => {
    const G = v.game;
    if (!G.grid || gridBusy || won || gridIn < 0.35) { burst(fx, x, y, { n: 8, colors: ['#fff', '#ffe070'], speed: 120, size: 3, gravity: 0, life: 0.4 }); return; }
    const i = tileAt(x, y);
    if (i < 0 || G.grid.tiles[i] !== -1 || flips.has(i)) return;
    const out = api.act({ flip: i });
    if (!out || !out.ok) { refresh(); return; }
    flips.set(i, { age: 0, tier: out.tier });
    if (out.count === 2) words.push({ text: `Two ${G.tiers[out.tier]}!`, x: g.w / 2, y: L.gridY + L.tile, age: 0.2, size: 30, color: '#ffe070' });
    if (out.won !== null) {
      gridBusy = true;
      setTimeout(() => {
        won = { tier: out.won, tiles: out.tiles, age: 0, reward: out.reward };
        burst(fx, g.w / 2, g.h * 0.45, { n: 60, colors: [TIER_COLORS[Math.min(out.won, 2)][0], '#fff', '#ffe070'], speed: 420, size: 6, kind: 'star', life: 1.4 });
      }, 450);
      setTimeout(async () => {
        await g.prize(out.reward, `${G.tiers[out.won]} prize!`, `Three ${G.tiers[out.won]} bags on stage ${out.stage + 1}'s grid.`);
        won = null;
        flips.clear();
        gridBusy = false;
        api.changed();
        if (out.allDone) { g.close(); return; }
        refresh();
      }, 1900);
    }
  };
  function tileAt(x, y) {
    const G = v.game.grid;
    if (!G || !L.tile) return -1;
    const cx = Math.floor((x - L.gridX) / (L.tile + L.gapT));
    const cy = Math.floor((y - L.gridY) / (L.tile + L.gapT));
    if (cx < 0 || cy < 0 || cx >= G.cols || cy >= G.rows) return -1;
    const lx = x - L.gridX - cx * (L.tile + L.gapT);
    const ly = y - L.gridY - cy * (L.tile + L.gapT);
    if (lx > L.tile || ly > L.tile) return -1;
    return cy * G.cols + cx;
  }

  function drawGrid(ctx, t) {
    const G = v.game;
    const grid = G.grid;
    ctx.fillStyle = 'rgba(10,2,30,.72)';
    ctx.fillRect(0, 0, g.w, g.h);
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    // the tiers, what they pay and how many are showing
    const shownTier = grid.tiles.map((x, i) => (x !== -1 ? x : flips.has(i) && flips.get(i).age > 0.15 ? flips.get(i).tier : -1));
    const top = 12;
    panel(ctx, X + 14, top, W - 28, 34 + G.tiers.length * 30, 16, ['#5b24b8', '#2a0b6e']);
    bigText(ctx, `Stage ${grid.stage + 1} prize grid`, X + W / 2, top + 16, 17, '#ffe070', '#3a1000');
    G.tiers.forEach((name, ti) => {
      const y = top + 42 + ti * 30;
      const have = shownTier.filter((x) => x === ti).length;
      bag(ctx, X + 40, y, 24, ti);
      bigText(ctx, name, X + 60, y, 15, '#fff', '#2a0a5e', 'left');
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k < have ? TIER_COLORS[Math.min(ti, 2)][0] : 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.arc(X + 136 + k * 18, y, 6, 0, TAU); ctx.fill();
      }
      const glow = won && won.tier === ti;
      if (glow) { ctx.strokeStyle = '#7affa0'; ctx.lineWidth = 3; rr(ctx, X + 22, y - 13, W - 44, 26, 9); ctx.stroke(); }
      drawReward(ctx, grid.prizes[ti], X + W - 30, y, 15, 'right', 2);
    });
    // the tiles
    const gy = top + 46 + G.tiers.length * 30 + 12;
    L.gapT = 10;
    L.tile = Math.floor(Math.min((W - 60 - L.gapT * (grid.cols - 1)) / grid.cols, (g.h - gy - 20 - L.gapT * (grid.rows - 1)) / grid.rows));
    const gw = L.tile * grid.cols + L.gapT * (grid.cols - 1);
    L.gridX = Math.round((g.w - gw) / 2);
    L.gridY = gy;
    if (won) won.age += 1 / 60;
    for (let i = 0; i < grid.cols * grid.rows; i++) {
      const x = L.gridX + (i % grid.cols) * (L.tile + L.gapT);
      const y = L.gridY + Math.floor(i / grid.cols) * (L.tile + L.gapT);
      const f = flips.get(i);
      let tier = grid.tiles[i];
      let face = tier !== -1 ? 1 : 0;
      if (f) { f.age += 1 / 60; face = clamp01(f.age / 0.3); tier = f.tier; }
      // once the grid is won, the rest turn over too (dimmed)
      let dim = false;
      if (won && tier === -1) { tier = won.tiles[i]; face = clamp01((won.age - 0.3 - i * 0.03) / 0.25); dim = true; }
      const sx = Math.abs(Math.cos(face * Math.PI));
      const showFace = face > 0.5;
      ctx.save();
      ctx.translate(x + L.tile / 2, y + L.tile / 2);
      ctx.scale(Math.max(0.04, sx), 1);
      if (dim) ctx.globalAlpha = 0.45;
      if (showFace) {
        const match = won && won.tier === tier && !dim;
        panel(ctx, -L.tile / 2, -L.tile / 2, L.tile, L.tile, 14, match ? ['#9affc0', '#18a050'] : ['#fff6e0', '#e8c8a0']);
        bag(ctx, 0, 4, L.tile * 0.7, tier);
      } else {
        const hover = Math.sin(t * 3 + i) * 1.5;
        panel(ctx, -L.tile / 2, -L.tile / 2 + hover, L.tile, L.tile, 14, ['#7a3ad8', '#3a137e']);
        ctx.strokeStyle = 'rgba(255,220,120,.5)';
        ctx.lineWidth = 2;
        rr(ctx, -L.tile / 2 + 8, -L.tile / 2 + 8, L.tile - 16, L.tile - 16, 10); ctx.stroke();
        bigText(ctx, '?', 0, 2, L.tile * 0.42, '#ffe070', '#3a1000');
      }
      ctx.restore();
      if (f && f.age < 0.02) burst(fx, x + L.tile / 2, y + L.tile / 2, { n: 10, colors: [TIER_COLORS[Math.min(f.tier, 2)][0], '#fff'], speed: 160, size: 4, kind: 'star', gravity: 0, life: 0.5 });
    }
    if (G.waiting > 1) bigText(ctx, `${G.waiting - 1} more grid${G.waiting > 2 ? 's' : ''} after this one`, g.w / 2, g.h - 10, 12, '#c8b8ff');
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    backdrop(ctx, g.w, g.h, '#4a2a6e', '#1a0a2a');
    // ---- the wagon's trip since the last look ----
    if (wait > 0) wait -= dt;
    else if (backTrip) {
      // the loss first: back to where the rules sent it
      target = G.restart === 'start' ? 0 : G.stages.slice(0, G.stage).reduce((a, b) => a + b, 0);
      if (shown <= target + 0.01) {
        backTrip = false;
        g.toast(G.restart === 'start' ? 'A loss: the tour went back to the first town.' : 'A loss: the stage started again.', 2400);
        wait = 0.5;
      }
    } else target = placeOf(G);
    const prev = shown;
    if (shown < target) shown = Math.min(target, shown + dt * 3.2);
    else if (shown > target) shown = Math.max(target, shown - dt * 9);
    // a stop reached: a little puff; a town reached: a bigger one
    const towns = [];
    G.stages.reduce((a, b) => { towns.push(a + b); return a + b; }, 0);
    const n = total();
    const rows = Math.ceil((n + 1) / PER_ROW);
    const contentH = rows * ROW_H + 190;
    const top = 60;
    const viewH = g.h - top;
    sc.max = Math.max(0, contentH - viewH);
    const here = pointAt(Math.min(shown, n), W, X, contentH);
    if (!placed) { placed = true; sc.to(here.y - viewH * 0.55); }
    if (!sc.held && Math.abs(shown - target) > 0.01) sc.to(sc.y + (here.y - viewH * 0.55 - sc.y) * Math.min(1, dt * 3));
    sc.step(dt);
    if (Math.floor(shown) !== Math.floor(prev) && shown > prev) {
      const k = Math.floor(shown);
      const p = point(k, W, X, contentH);
      const isTown = towns.includes(k);
      burst(fx, p.x, p.y - sc.y + top, { n: isTown ? 30 : 6, colors: ['#ffe070', '#fff'], speed: isTown ? 300 : 120, size: isTown ? 5 : 3, kind: 'star', life: 0.7 });
      if (isTown) words.push({ text: `Town ${towns.indexOf(k) + 1}!`, x: p.x, y: p.y - sc.y + top - 50, age: 0, size: 26 });
    }

    // ---- the header: stage strip ----
    G.stages.forEach((s, i) => {
      const x = X + W / 2 + (i - (G.stages.length - 1) / 2) * 104;
      const cur = i === G.stage && G.cleared < G.stages.length;
      const done = i < G.cleared;
      panel(ctx, x - 44, 8, 88, 40, 14, done ? ['#3ee07a', '#0a8a3a'] : cur ? ['#ff6a9a', '#b0103c'] : ['#6a5a8a', '#3a2a5a']);
      bigText(ctx, G.mode === 'plain' ? 'The run' : `Stage ${i + 1}`, x, 21, 14);
      bigText(ctx, done ? '✓ cleared' : `${s} in a row`, x, 38, 11, '#ffe9a8');
    });
    if (v.endsAt) clockText(ctx, v.endsAt, X + W - 12, top + 14, 12, 'right');

    // ---- the road ----
    ctx.save();
    ctx.beginPath(); ctx.rect(0, top, g.w, viewH); ctx.clip();
    ctx.translate(0, top - sc.y);
    ctx.strokeStyle = '#c8a070';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const p = point(k, W, X, contentH); if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    // the start gate
    const p0 = point(0, W, X, contentH);
    ribbon(ctx, 'Start', p0.x, p0.y + 30, 70, 22, ['#3a8bff', '#1a4aa0']);
    for (let k = 1; k <= n; k++) {
      const p = point(k, W, X, contentH);
      const ti = towns.indexOf(k);
      if (ti >= 0) {
        const cleared = ti < G.cleared;
        town(ctx, p.x, p.y - 8, 52, ti === G.stage && !cleared, cleared);
        if (G.mode === 'plain') {
          chest(ctx, p.x + 40, p.y - 6, 32, cleared ? 1 : 0, ['#ffcf3a', '#a05a00']);
          if (G.reward) drawReward(ctx, G.reward, p.x, p.y + 38, 13, 'center', 2);
        } else {
          bag(ctx, p.x + 38, p.y - 4, 28, Math.min(ti, 2));
          bigText(ctx, cleared ? 'grid won' : 'prize grid', p.x, p.y + 34, 12, cleared ? '#7affa0' : '#ffe9a8');
        }
      } else {
        const passed = k <= Math.floor(shown + 1e-6);
        ctx.fillStyle = passed ? '#ffe070' : '#5a3a7a';
        ctx.strokeStyle = passed ? '#8a4a00' : '#c8b8ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    const w = pointAt(Math.min(shown, n), W, X, contentH);
    wagon(ctx, w.x, w.y - 14, 44, youFace(G.avatar), t, Math.abs(shown - target) > 0.01 ? 1 : 0);
    ctx.restore();

    // ---- your line ----
    const need = G.stages[G.stage];
    let line;
    if (G.cleared >= G.stages.length) line = G.grid ? 'Tour complete! Reveal your prizes.' : 'Tour complete!';
    else line = `${G.have}/${need} in a row · ${need - G.have} to ${G.mode === 'plain' ? 'the prize' : `town ${G.stage + 1}`}`;
    panel(ctx, X + 30, g.h - 44, W - 60, 34, 14, ['#5b24b8', '#2a0b6e']);
    bigText(ctx, line, X + W / 2, g.h - 26, 15);

    // the grid comes up once the wagon has arrived
    if (G.grid && gridIn < 0 && wait <= 0 && !backTrip && Math.abs(shown - target) < 0.01) {
      gridIn = 0;
      words.push({ text: 'Prize grid!', x: g.w / 2, y: g.h * 0.4, age: 0, size: 34, life: 1.2 });
    }
    if (!G.grid) gridIn = -1;
    if (G.grid && gridIn >= 0) {
      gridIn += dt;
      const k = ease.outBack(clamp01(gridIn / 0.35));
      ctx.save();
      ctx.translate(g.w / 2, g.h / 2);
      ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      ctx.translate(-g.w / 2, -g.h / 2);
      ctx.globalAlpha = clamp01(gridIn / 0.2);
      drawGrid(ctx, t);
      ctx.restore();
    }
    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
