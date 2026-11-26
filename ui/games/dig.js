// UNDER THE STAGE: the dig's own play screen (rules in meta/events/dig.js).
// A gate of stone blocks; tap a block to break it with a hammer. The gems
// to find are shown at the top in their real shapes, so once a corner of
// one shows you can work out where the rest of it lies.
import { drawArt, hasArt } from '../art.js';
import {
  openGame, panel, bigText, ribbon, chest, hammer, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';

const GEM_TINT = ['#ffb21a', '#ff3a5a', '#3a7bff', '#18c060', '#a64bff'];

function gemPic(ctx, color, cx, cy, w, h) {
  if (hasArt('gem' + color) && drawArt(ctx, 'gem' + color, cx, cy, Math.min(w, h) * 1.02 * (w === h ? 1 : 1), Math.min(w, h) * 1.02)) {
    if (w !== h) {
      // A long gem: draw the jewel stretched along a glowing bar.
    }
    return;
  }
  ctx.fillStyle = GEM_TINT[color % 5];
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.42, 0, TAU);
  ctx.fill();
}

// A buried gem of w x h cells: a cut jewel set in a gold mount, as big as
// its shape, so a 3 x 1 one reads as a bar and a 2 x 2 as a big stone.
function bigGem(ctx, color, x, y, w, h, glow = 0) {
  ctx.save();
  if (glow > 0) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h));
    g.addColorStop(0, `rgba(255,250,200,${0.7 * glow})`);
    g.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - h, w * 3, h * 3);
  }
  const pad = Math.min(w, h) * 0.08;
  const mount = ctx.createLinearGradient(0, y, 0, y + h);
  mount.addColorStop(0, '#fff0a8');
  mount.addColorStop(0.5, '#ffc21a');
  mount.addColorStop(1, '#a05a00');
  ctx.fillStyle = '#4a2000';
  rr(ctx, x + pad - 2, y + pad - 2, w - 2 * pad + 4, h - 2 * pad + 4, Math.min(w, h) * 0.3);
  ctx.fill();
  ctx.fillStyle = mount;
  rr(ctx, x + pad, y + pad, w - 2 * pad, h - 2 * pad, Math.min(w, h) * 0.28);
  ctx.fill();
  // the jewels along the mount: one per cell-ish, the middle one biggest
  const cells = Math.round(Math.max(w, h) / Math.min(w, h));
  const s = Math.min(w, h);
  const horiz = w >= h;
  for (let i = 0; i < cells; i++) {
    const cx = horiz ? x + s * (i + 0.5) : x + w / 2;
    const cy = horiz ? y + h / 2 : y + s * (i + 0.5);
    gemPic(ctx, color, cx, cy, s * 0.86, s * 0.86);
  }
  ctx.restore();
}

// One stone block. `seed` gives each its own cracks and colour.
function stone(ctx, x, y, s, seed, hurt = 0) {
  const r = (n) => { const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  ctx.save();
  const inset = s * 0.04;
  const g = ctx.createLinearGradient(x, y, x, y + s);
  const warm = r(1) * 18;
  g.addColorStop(0, `hsl(${32 + warm}, 46%, 70%)`);
  g.addColorStop(1, `hsl(${24 + warm}, 40%, 42%)`);
  ctx.fillStyle = '#3a2410';
  rr(ctx, x + inset, y + inset + s * 0.04, s - 2 * inset, s - 2 * inset, s * 0.16);
  ctx.fill();
  ctx.fillStyle = g;
  rr(ctx, x + inset, y + inset, s - 2 * inset, s - 2 * inset, s * 0.16);
  ctx.fill();
  // carved inner square and light on the top edge
  ctx.strokeStyle = 'rgba(255,240,210,.55)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  rr(ctx, x + s * 0.16, y + s * 0.14, s * 0.68, s * 0.68, s * 0.1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,0,.35)';
  rr(ctx, x + s * 0.18, y + s * 0.18, s * 0.66, s * 0.66, s * 0.1);
  ctx.stroke();
  // a little rune in the middle
  ctx.fillStyle = 'rgba(90,50,10,.35)';
  ctx.beginPath();
  const k = Math.floor(r(2) * 3);
  if (k === 0) { ctx.arc(x + s / 2, y + s / 2, s * 0.09, 0, TAU); }
  else if (k === 1) { ctx.moveTo(x + s / 2, y + s * 0.38); ctx.lineTo(x + s * 0.62, y + s * 0.6); ctx.lineTo(x + s * 0.38, y + s * 0.6); ctx.closePath(); }
  else { ctx.rect(x + s * 0.42, y + s * 0.42, s * 0.16, s * 0.16); }
  ctx.fill();
  // cracks (more when hit)
  ctx.strokeStyle = 'rgba(50,25,0,.55)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  const n = 1 + Math.floor(r(3) * 2) + Math.round(hurt * 4);
  for (let i = 0; i < n; i++) {
    let px = x + s * (0.2 + r(10 + i) * 0.6);
    let py = y + s * (0.2 + r(20 + i) * 0.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let j = 0; j < 3; j++) {
      px += (r(30 + i * 3 + j) - 0.5) * s * 0.3;
      py += (r(40 + i * 3 + j) - 0.5) * s * 0.3;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function hole(ctx, x, y, s) {
  ctx.save();
  const g = ctx.createRadialGradient(x + s / 2, y + s * 0.45, s * 0.05, x + s / 2, y + s / 2, s * 0.7);
  g.addColorStop(0, '#5a3418');
  g.addColorStop(1, '#22120a');
  ctx.fillStyle = g;
  rr(ctx, x + s * 0.03, y + s * 0.03, s * 0.94, s * 0.94, s * 0.12);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.1);
  ctx.restore();
}

function paintHammerChip(c, cx, cy, s) { hammer(c, cx, cy + s * 0.06, s * 0.95, -0.7); }

// id: the event's id. api: { view(), act(action), play(), changed() }
export function openDig(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#4a1a6e', bottom: '#1a0622' });
  const fx = [];
  const words = [];
  let swing = null; // { cell, age }
  const breaking = new Map(); // cell -> age of crumble
  let flying = []; // gems flying up to the tray: { gem, from:{x,y,w,h}, age }
  let busy = false;
  let dropIn = 0; // blocks dropping in for a new gate (0..1)
  let gateOpen = -1; // chest animation age
  let shake = 0;

  const L = {};
  function layout() {
    const G = v.game;
    const W = g.w;
    const H = g.h;
    L.trayY = 8;
    L.trayH = Math.min(118, H * 0.18);
    L.gateY = L.trayY + L.trayH + 26;
    const top = L.gateY + 26;
    const bottom = H - 70;
    L.s = Math.floor(Math.min((W - 24) / G.cols, (bottom - top) / G.rows));
    L.gw = L.s * G.cols;
    L.gh = L.s * G.rows;
    L.gx = Math.round((W - L.gw) / 2);
    L.gy = Math.round(top + Math.min(24, (bottom - top - L.gh) / 2));
    L.prizeY = L.gy + L.gh + 34;
    // tray slots: each gem drawn at a scale that fits
    const gems = G.gems;
    const unit = Math.min(36, (W - 40) / gems.reduce((a, gm) => a + gm.w + 0.8, 0), (L.trayH - 30) / Math.max(...gems.map((gm) => gm.h)));
    L.unit = unit;
    let x = (W - gems.reduce((a, gm) => a + gm.w * unit + unit * 0.8, -unit * 0.8)) / 2;
    L.slots = gems.map((gm) => {
      const slot = { x, y: L.trayY + 22 + (L.trayH - 26 - gm.h * unit) / 2, w: gm.w * unit, h: gm.h * unit };
      x += gm.w * unit + unit * 0.8;
      return slot;
    });
  }
  g.onResize = layout;
  layout();

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    layout();
    g.chip(String(v.game.tools), paintHammerChip);
    const per = v.game.toolsPerWin;
    g.note(v.game.tools > 0
      ? 'Tap a block to break it. The shapes at the top are what is buried.'
      : `Out of hammers. Win a level for ${per[0]} (harder levels up to ${per[per.length - 1]}).`);
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  refresh();

  function cellAt(x, y) {
    const G = v.game;
    const cx = Math.floor((x - L.gx) / L.s);
    const cy = Math.floor((y - L.gy) / L.s);
    if (cx < 0 || cy < 0 || cx >= G.cols || cy >= G.rows) return -1;
    return cy * G.cols + cx;
  }

  g.onTap = (x, y) => {
    if (busy || gateOpen >= 0) return;
    const c = cellAt(x, y);
    if (c < 0 || v.game.cells[c].dug) return;
    if (v.game.tools < 1) { g.toast('No hammers left. Win levels to earn more.'); shake = 0.3; return; }
    busy = true;
    swing = { cell: c, age: 0 };
  };

  // The hammer lands: ask the rules what was under the block.
  function strike(c) {
    const G = v.game;
    const before = v;
    const out = api.act({ dig: c });
    if (!out || !out.ok) { busy = false; refresh(); return; }
    const x = L.gx + (c % G.cols) * L.s + L.s / 2;
    const y = L.gy + Math.floor(c / G.cols) * L.s + L.s / 2;
    breaking.set(c, 0);
    burst(fx, x, y, { n: 14, colors: ['#e8c090', '#b07840', '#7a4a20'], speed: 260, size: L.s * 0.1, kind: 'chip', life: 0.7 });
    burst(fx, x, y, { n: 6, colors: ['#fff6d0'], speed: 140, size: 3, gravity: 0, life: 0.35 });
    shake = 0.12;
    if (out.under === 'cache') {
      words.push({ text: `+${out.cache} hammers`, x, y, age: 0, size: 22 });
      burst(fx, x, y, { n: 18, colors: ['#ffe070', '#fff'], speed: 200, size: 6, kind: 'star', life: 1 });
    }
    if (out.under === 'gem' && !out.gemDone) {
      burst(fx, x, y, { n: 10, colors: [GEM_TINT[before.game.gems[out.gem].color], '#fff'], speed: 120, size: 4, gravity: 0, life: 0.6, kind: 'star' });
    }
    if (out.gemDone) {
      // Where the whole gem lies, from the view after the dig.
      const after = api.view();
      const src = (out.gateDone ? null : after.game.gems[out.gem]);
      const gm = before.game.gems[out.gem];
      let rect;
      if (src && src.x !== undefined) rect = { x: L.gx + src.x * L.s, y: L.gy + src.y * L.s, w: gm.w * L.s, h: gm.h * L.s };
      else rect = { x: x - L.s / 2, y: y - L.s / 2, w: gm.w * L.s, h: gm.h * L.s };
      flying.push({ gem: out.gem, color: gm.color, from: rect, age: 0, slot: L.slots[out.gem] });
      burst(fx, rect.x + rect.w / 2, rect.y + rect.h / 2, { n: 30, colors: [GEM_TINT[gm.color], '#fff', '#ffe070'], speed: 320, size: 5, kind: 'star', life: 1.1 });
      words.push({ text: 'Found!', x: rect.x + rect.w / 2, y: rect.y, age: 0, size: 28 });
    }
    // Hold the old picture until the found gem has flown up, then move on.
    const finish = async () => {
      if (out.gateDone) {
        gateOpen = 0;
        await wait(1100);
        await g.prize(out.reward, out.allDone ? 'All gates open!' : `Gate ${before.game.gate + 1} open!`, out.allDone ? 'The grand prize is yours too.' : 'On to the next gate.');
        gateOpen = -1;
        if (out.allDone) { api.changed(); g.close(); return; }
        dropIn = 0.0001;
      }
      breaking.clear();
      refresh();
      api.changed();
      busy = false;
    };
    if (out.gemDone || out.gateDone) setTimeout(finish, 750);
    else { setTimeout(() => { refresh(); api.changed(); busy = false; }, 260); }
    // show the hole at once for plain blocks
    v = out.gateDone ? v : api.view();
    if (!out.gateDone) g.chip(String(v.game.tools), paintHammerChip);
    else g.chip(String(out.tools), paintHammerChip);
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    backdrop(ctx, g.w, g.h, '#4a1a6e', '#1a0622');
    let ox = 0;
    let oy = 0;
    if (shake > 0) { shake -= dt; ox = (Math.random() - 0.5) * 6; oy = (Math.random() - 0.5) * 6; }
    ctx.save();
    ctx.translate(ox, oy);

    // ---- the tray of gems to find ----
    panel(ctx, 12, L.trayY, g.w - 24, L.trayH, 16, ['#2a0f5c', '#16063a']);
    bigText(ctx, 'Find these', g.w / 2, L.trayY + 12, 15, '#ffe070', '#3a1000');
    G.gems.forEach((gm, i) => {
      const sl = L.slots[i];
      const isFlying = flying.some((f) => f.gem === i);
      // the outline cells
      ctx.save();
      for (let yy = 0; yy < gm.h; yy++) for (let xx = 0; xx < gm.w; xx++) {
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.strokeStyle = 'rgba(255,240,180,.5)';
        ctx.lineWidth = 1.2;
        rr(ctx, sl.x + xx * L.unit + 1, sl.y + yy * L.unit + 1, L.unit - 2, L.unit - 2, 4);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      if (gm.found && !isFlying) {
        bigGem(ctx, gm.color, sl.x, sl.y, sl.w, sl.h, 0.3 + 0.2 * Math.sin(t * 3 + i));
      } else if (!gm.found) {
        ctx.globalAlpha = 0.3;
        bigGem(ctx, gm.color, sl.x, sl.y, sl.w, sl.h);
        ctx.globalAlpha = 1;
      }
    });

    // ---- the gate's progress: five doors ----
    const n = G.gates;
    const dw = Math.min(34, (g.w - 60) / n - 8);
    const total = n * dw + (n - 1) * 10;
    let dx = (g.w - total) / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,120,.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx + dw / 2, L.gateY);
    ctx.lineTo(dx + total - dw / 2, L.gateY);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < n; i++) {
      const cur = i === G.gate;
      const done = i < G.gate;
      const s = cur ? dw * 1.15 : dw;
      const cx = dx + dw / 2;
      if (cur) rays(ctx, cx, L.gateY, s * 1.1, t, 'rgba(255,230,140,.25)', 10);
      panel(ctx, cx - s / 2, L.gateY - s / 2, s, s, s * 0.3, done ? ['#3ee07a', '#0a8a3a'] : cur ? ['#ff6a9a', '#b0103c'] : ['#6a5a8a', '#3a2a5a'], true);
      bigText(ctx, done ? '✓' : String(i + 1), cx, L.gateY + 1, s * 0.55);
      dx += dw + 10;
    }

    // ---- the blocks ----
    if (dropIn > 0) dropIn = Math.min(1, dropIn + dt * 1.6);
    for (let c = 0; c < G.cols * G.rows; c++) {
      const cx = c % G.cols;
      const cy = Math.floor(c / G.cols);
      const x = L.gx + cx * L.s;
      let y = L.gy + cy * L.s;
      const cell = G.cells[c];
      const br = breaking.get(c);
      if (dropIn > 0 && dropIn < 1) {
        const lag = clamp01((dropIn - (G.rows - cy) * 0.06) / 0.5);
        y = lerp(-L.s * 2, y, ease.outBack(lag));
      }
      if (cell.dug || br !== undefined) {
        hole(ctx, x, y, L.s);
        if (cell.gem >= 0) {
          const gm = G.gems[cell.gem];
          if (!gm.found) gemPic(ctx, gm.color, x + L.s / 2, y + L.s / 2, L.s * 0.66, L.s * 0.66);
        }
        if (cell.cache) {
          ctx.globalAlpha = 0.5;
          hammer(ctx, x + L.s / 2, y + L.s / 2, L.s * 0.6, -0.7);
          ctx.globalAlpha = 1;
        }
        if (br !== undefined && br < 0.35) {
          // the block crumbling away
          const k = br / 0.35;
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.translate(x + L.s / 2, y + L.s / 2 + k * L.s * 0.3);
          ctx.scale(1 - k * 0.4, 1 - k * 0.6);
          stone(ctx, -L.s / 2, -L.s / 2, L.s, c + G.gate * 97, 1);
          ctx.restore();
          breaking.set(c, br + dt);
        }
      } else {
        const hurt = swing && swing.cell === c ? clamp01(swing.age / 0.22) : 0;
        stone(ctx, x, y, L.s, c + G.gate * 97, hurt);
      }
    }
    // found gems lying in place on the board (still in their holes)
    G.gems.forEach((gm, i) => {
      if (gm.found && gm.x !== undefined && !flying.some((f) => f.gem === i)) {
        // (it has already gone up to the tray)
      }
    });

    // ---- the hammer swinging at a block ----
    if (swing) {
      swing.age += dt;
      const c = swing.cell;
      const x = L.gx + (c % G.cols) * L.s + L.s * 0.75;
      const y = L.gy + Math.floor(c / G.cols) * L.s + L.s * 0.2;
      const k = clamp01(swing.age / 0.2);
      const a = lerp(-1.6, 0.2, ease.in(k));
      hammer(ctx, x, y, L.s * 1.1, a);
      if (swing.age >= 0.2 && !swing.hit) { swing.hit = true; strike(c); }
      if (swing.age >= 0.34) swing = null;
    }

    // ---- gems flying up to their slot ----
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.age += dt;
      const hold = 0.35;
      if (f.age < hold) {
        const p = f.age / hold;
        bigGem(ctx, f.color, f.from.x, f.from.y - p * 6, f.from.w, f.from.h, 1);
      } else {
        const k = ease.inOut(clamp01((f.age - hold) / 0.55));
        const sl = f.slot;
        const x = lerp(f.from.x, sl.x, k);
        const y = lerp(f.from.y, sl.y, k) - Math.sin(k * Math.PI) * 60;
        const w = lerp(f.from.w, sl.w, k);
        const h = lerp(f.from.h, sl.h, k);
        bigGem(ctx, f.color, x, y, w, h, 1 - k * 0.6);
        if (f.age - hold > 0.55) {
          burst(fx, sl.x + sl.w / 2, sl.y + sl.h / 2, { n: 16, colors: ['#fff', '#ffe070'], speed: 160, size: 4, kind: 'star', gravity: 0, life: 0.6 });
          flying.splice(i, 1);
        }
      }
    }

    // ---- the gate's prize under the board ----
    if (v.game.reward) {
      const cy = Math.min(g.h - 30, L.prizeY);
      ribbon(ctx, `Gate ${G.gate + 1} prize`, g.w / 2 - 30, cy, 170, 30);
      chest(ctx, g.w / 2 + 92, cy - 4, 42, 0);
    }

    // ---- a gate opening: the chest in the middle ----
    if (gateOpen >= 0) {
      gateOpen += dt;
      ctx.fillStyle = `rgba(10,2,30,${Math.min(0.6, gateOpen)})`;
      ctx.fillRect(-10, -10, g.w + 20, g.h + 20);
      const k = ease.outBack(clamp01(gateOpen / 0.45));
      rays(ctx, g.w / 2, g.h * 0.48, 220 * k, t, 'rgba(255,230,140,.3)', 16);
      chest(ctx, g.w / 2, g.h * 0.48, 140 * k, clamp01((gateOpen - 0.5) / 0.4));
      if (gateOpen > 0.6 && !g._burstDone) {
        g._burstDone = true;
        burst(fx, g.w / 2, g.h * 0.45, { n: 50, colors: ['#ffe070', '#fff', '#ff7ab0', '#7ad8ff'], speed: 420, size: 6, kind: 'star', life: 1.4 });
      }
    } else g._burstDone = false;

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
    ctx.restore();
  };
  return g;
}
