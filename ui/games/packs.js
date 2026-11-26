// OPENING PLAYBILL PACKS: the screen that appears when you claim card packs.
// Each pack waits sealed in the spotlight until you tap it; it shakes, bursts
// and deals its cards out, turning them over one by one (tap to hurry).
// New cards get a NEW ribbon; gold cards shine. Then the next pack.
//   openPacks([{ gold, cards: [{ set, setIndex, name, stars, gold, isNew, count, setHave }] }])
import { openGame, panel, bigText, burst, sparks, rays, backdrop, rr, ease, clamp01, lerp, TAU, GAME_FONT } from './kit.js';

// One emblem and colour per play (set), in album order.
export const SET_LOOK = [
  { icon: '⚓', c: ['#3a9ad8', '#0a3a7a'] },
  { icon: '🎻', c: ['#e0802a', '#7a2a00'] },
  { icon: '🚂', c: ['#4ab07a', '#0a5a30'] },
  { icon: '🕰️', c: ['#c8a040', '#6a4a00'] },
  { icon: '🌕', c: ['#6a6ad8', '#1a1a6a'] },
  { icon: '🎭', c: ['#e04a7a', '#7a0a34'] },
  { icon: '🎩', c: ['#a04ad8', '#3a0a6a'] },
  { icon: '🏮', c: ['#e04a3a', '#7a1000'] },
  { icon: '🕯️', c: ['#3a3a5a', '#0a0a1a'] },
];

// One card face, w x h, top-left at (x, y).
export function drawCard(ctx, card, x, y, w, h, t = 0) {
  const look = SET_LOOK[card.setIndex % SET_LOOK.length];
  ctx.save();
  // frame
  if (card.gold) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.3 + 0.2 * Math.sin(t * 2), '#ffc21a');
    g.addColorStop(0.7, '#fff0a0');
    g.addColorStop(1, '#b06a00');
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#fff8ea';
  ctx.strokeStyle = card.gold ? '#7a4000' : '#3a2a4a';
  ctx.lineWidth = Math.max(1.5, w * 0.025);
  rr(ctx, x, y, w, h, w * 0.1);
  ctx.fill();
  ctx.stroke();
  // picture window
  const px = x + w * 0.08;
  const py = y + h * 0.08;
  const pw = w * 0.84;
  const ph = h * 0.5;
  const bg = ctx.createLinearGradient(0, py, 0, py + ph);
  bg.addColorStop(0, look.c[0]);
  bg.addColorStop(1, look.c[1]);
  ctx.fillStyle = bg;
  rr(ctx, px, py, pw, ph, w * 0.06);
  ctx.fill();
  ctx.save();
  rr(ctx, px, py, pw, ph, w * 0.06);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(px + pw / 2, py + ph * 1.1);
    ctx.arc(px + pw / 2, py + ph * 1.1, ph * 1.4, -Math.PI + i * 0.5 + 0.1, -Math.PI + i * 0.5 + 0.32);
    ctx.fill();
  }
  ctx.restore();
  ctx.font = `${Math.round(ph * 0.56)}px system-ui, "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(look.icon, px + pw / 2, py + ph * 0.54);
  // stars
  const n = card.stars || 1;
  const sr = w * 0.055;
  for (let i = 0; i < n; i++) {
    const sx = x + w / 2 + (i - (n - 1) / 2) * sr * 2.4;
    const sy = py + ph + h * 0.07;
    ctx.fillStyle = '#ffc21a';
    ctx.strokeStyle = '#7a4000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? sr * 0.45 : sr;
      const a = -Math.PI / 2 + (k * TAU) / 10;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // name, up to two lines
  ctx.fillStyle = card.gold ? '#4a2000' : '#2a1a3a';
  const fs = Math.max(9, Math.round(w * 0.1));
  ctx.font = `${fs}px ${GAME_FONT}`;
  const words = String(card.name).split(' ');
  const lines = [];
  let line = '';
  for (const wd of words) {
    const tryLine = line ? line + ' ' + wd : wd;
    if (ctx.measureText(tryLine).width > w * 0.86 && line) { lines.push(line); line = wd; } else line = tryLine;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, x + w / 2, py + ph + h * 0.17 + i * fs * 1.1));
  if (card.gold) {
    // a moving shine across a gold card
    ctx.save();
    rr(ctx, x, y, w, h, w * 0.1);
    ctx.clip();
    const sx = x - w + ((t * 0.6) % 1.6) * w * 2;
    const gl = ctx.createLinearGradient(sx, y, sx + w * 0.5, y + h);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,.55)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  ctx.restore();
}

export function drawCardBack(ctx, x, y, w, h, gold) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, gold ? '#ffd84a' : '#d0183c');
  g.addColorStop(1, gold ? '#b06a00' : '#6a0420');
  ctx.fillStyle = g;
  ctx.strokeStyle = gold ? '#6a3a00' : '#3a0010';
  ctx.lineWidth = Math.max(1.5, w * 0.025);
  rr(ctx, x, y, w, h, w * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = gold ? 'rgba(255,255,220,.8)' : '#ffc83d';
  ctx.lineWidth = Math.max(1, w * 0.02);
  rr(ctx, x + w * 0.08, y + w * 0.08, w * 0.84, h - w * 0.16, w * 0.06);
  ctx.stroke();
  bigText(ctx, 'PP', x + w / 2, y + h / 2, w * 0.32, gold ? '#fff8d0' : '#ffe070', gold ? '#7a4000' : '#5a0020');
  ctx.restore();
}

// The sealed pack: a theatre ticket envelope, red velvet or gold foil.
function drawPack(ctx, cx, cy, s, gold, t, shake) {
  ctx.save();
  ctx.translate(cx + (shake ? (Math.random() - 0.5) * 8 * shake : 0), cy + Math.sin(t * 2.2) * 6);
  ctx.rotate(Math.sin(t * 1.3) * 0.04 + (shake ? (Math.random() - 0.5) * 0.1 * shake : 0));
  const w = s * 0.72;
  const h = s;
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  if (gold) { g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ffc21a'); g.addColorStop(1, '#a05a00'); }
  else { g.addColorStop(0, '#ff4f7a'); g.addColorStop(0.5, '#c0103c'); g.addColorStop(1, '#5a0420'); }
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  rr(ctx, -w / 2 + 6, -h / 2 + 10, w, h, s * 0.08);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.strokeStyle = gold ? '#6a3a00' : '#3a0010';
  ctx.lineWidth = 3;
  rr(ctx, -w / 2, -h / 2, w, h, s * 0.08);
  ctx.fill();
  ctx.stroke();
  // flap and seal
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2 + 4);
  ctx.lineTo(0, -h * 0.12);
  ctx.lineTo(w / 2, -h / 2 + 4);
  ctx.fill();
  ctx.fillStyle = gold ? '#c0103c' : '#ffc21a';
  ctx.beginPath();
  ctx.arc(0, -h * 0.12, s * 0.09, 0, TAU);
  ctx.fill();
  bigText(ctx, '★', 0, -h * 0.12, s * 0.1, '#fff', gold ? '#6a0020' : '#7a4000');
  bigText(ctx, 'PLAYBILL', 0, h * 0.18, s * 0.1, '#fff', gold ? '#6a3a00' : '#5a0020');
  if (gold) bigText(ctx, 'GOLD', 0, h * 0.32, s * 0.08, '#fff8d0', '#6a3a00');
  // shine
  const sh = ctx.createLinearGradient(-w, -h, w, h);
  const p = (t * 0.4) % 1;
  sh.addColorStop(Math.max(0, p - 0.1), 'rgba(255,255,255,0)');
  sh.addColorStop(p, 'rgba(255,255,255,.35)');
  sh.addColorStop(Math.min(1, p + 0.1), 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  rr(ctx, -w / 2, -h / 2, w, h, s * 0.08);
  ctx.fill();
  ctx.restore();
}

export function openPacks(packs, onDone) {
  const list = (packs || []).filter((p) => p && p.cards && p.cards.length);
  if (!list.length) { if (onDone) onDone(); return null; }
  const g = openGame({ title: 'Playbill', top: '#3a0a4a', bottom: '#12031e', onClose: onDone });
  const fx = [];
  let i = 0;          // which pack
  let phase = 'wait'; // 'wait' | 'burst' | 'deal' | 'done'
  let age = 0;
  let dealt = 0;      // cards turned over
  let flipAge = 0;

  function show() {
    g.chip(`${i + 1}/${list.length}`);
    g.buttons([]);
    g.note(list[i].gold ? 'A gold pack! Tap it to open.' : 'Tap the pack to open it.');
  }
  show();

  function grid(n) {
    const cols = n <= 3 ? n : n <= 6 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const w = Math.min(110, (g.w - 24 - (cols - 1) * 10) / cols);
    const h = w * 1.4;
    const top = Math.max(16, (g.h - rows * h - (rows - 1) * 12) / 2 - 20);
    return { cols, rows, w, h, top, left: (g.w - cols * w - (cols - 1) * 10) / 2 };
  }

  g.onTap = () => {
    if (phase === 'wait') {
      phase = 'burst';
      age = 0;
    } else if (phase === 'deal') {
      dealt = list[i].cards.length; // hurry
    }
  };

  function finishPack() {
    phase = 'done';
    const last = i === list.length - 1;
    const fresh = list[i].cards.filter((c) => c.isNew).length;
    g.note(fresh ? `${fresh} new ${fresh === 1 ? 'card' : 'cards'} for your album!` : 'Extra copies: give them to castmates who ask.');
    g.buttons([{ text: last ? 'Done' : 'Next pack', cls: 'primary', onClick: () => {
      if (last) { g.close(); return; }
      i++;
      phase = 'wait';
      dealt = 0;
      show();
    } }]);
  }

  g.draw = (ctx, dt, t) => {
    backdrop(ctx, g.w, g.h, '#3a0a4a', '#12031e', 'rgba(255,200,255,.2)');
    const pack = list[i];
    age += dt;
    if (phase === 'wait' || phase === 'burst') {
      const s = Math.min(g.w * 0.62, g.h * 0.5);
      rays(ctx, g.w / 2, g.h * 0.45, s * 1.2, t, pack.gold ? 'rgba(255,220,120,.28)' : 'rgba(255,160,220,.22)', 16);
      const shake = phase === 'burst' ? clamp01(age / 0.5) : 0;
      if (phase === 'burst' && age > 0.55) {
        burst(fx, g.w / 2, g.h * 0.45, { n: 60, colors: pack.gold ? ['#fff6b0', '#ffc21a', '#fff'] : ['#ff7ab0', '#ffe070', '#fff', '#7ad8ff'], speed: 520, size: 7, kind: 'star', life: 1.3 });
        phase = 'deal';
        age = 0;
        dealt = 0;
        flipAge = 0;
      } else {
        drawPack(ctx, g.w / 2, g.h * 0.45, s * (1 + shake * 0.15), pack.gold, t, shake);
      }
    }
    if (phase === 'deal' || phase === 'done') {
      const L = grid(pack.cards.length);
      pack.cards.forEach((card, k) => {
        const col = k % L.cols;
        const row = Math.floor(k / L.cols);
        const tx = L.left + col * (L.w + 10);
        const ty = L.top + row * (L.h + 12);
        // fly out from the middle
        const fly = ease.outBack(clamp01((age - k * 0.06) / 0.4));
        const x = lerp(g.w / 2 - L.w / 2, tx, fly);
        const y = lerp(g.h * 0.45 - L.h / 2, ty, fly);
        let turn = k < dealt ? 1 : 0;
        if (k === dealt && phase === 'deal' && age > 0.5) turn = clamp01(flipAge / 0.28);
        const sx = Math.abs(Math.cos(turn * Math.PI));
        ctx.save();
        ctx.translate(x + L.w / 2, y + L.h / 2);
        ctx.scale(Math.max(0.02, sx), 1);
        if (turn < 0.5) drawCardBack(ctx, -L.w / 2, -L.h / 2, L.w, L.h, pack.gold);
        else {
          if (card.gold) rays(ctx, 0, 0, L.w, t, 'rgba(255,230,140,.35)', 12);
          drawCard(ctx, card, -L.w / 2, -L.h / 2, L.w, L.h, t);
        }
        ctx.restore();
        if (turn >= 1 && card.isNew) {
          // NEW ribbon on the corner
          ctx.save();
          ctx.translate(x + L.w - 6, y + 8);
          ctx.rotate(0.5);
          ctx.fillStyle = '#18c060';
          rr(ctx, -24, -9, 48, 18, 5);
          ctx.fill();
          bigText(ctx, 'NEW', 0, 1, 12, '#fff', '#064020');
          ctx.restore();
        } else if (turn >= 1 && card.count > 1) {
          ctx.save();
          ctx.fillStyle = '#5a24b8';
          rr(ctx, x + L.w - 30, y + L.h - 22, 28, 18, 8);
          ctx.fill();
          bigText(ctx, `×${card.count}`, x + L.w - 16, y + L.h - 13, 12);
          ctx.restore();
        }
      });
      if (phase === 'deal' && age > 0.5) {
        flipAge += dt;
        if (flipAge >= 0.3) {
          const card = pack.cards[dealt];
          if (card) {
            const col = dealt % L.cols;
            const row = Math.floor(dealt / L.cols);
            const cx = L.left + col * (L.w + 10) + L.w / 2;
            const cy = L.top + row * (L.h + 12) + L.h / 2;
            if (card.isNew || card.gold) burst(fx, cx, cy, { n: card.gold ? 40 : 18, colors: card.gold ? ['#fff6b0', '#ffc21a'] : ['#7affb0', '#fff'], speed: 260, size: 5, kind: 'star', gravity: 120, life: 0.9 });
          }
          dealt++;
          flipAge = 0;
        }
        if (dealt >= pack.cards.length) finishPack();
      }
      // the set counts under the cards
      if (phase === 'done') {
        const L2 = grid(pack.cards.length);
        const y = L2.top + L2.rows * (L2.h + 12) + 14;
        if (y < g.h - 10) {
          const sets = [...new Set(pack.cards.map((c) => c.setIndex))].slice(0, 4);
          sets.forEach((s, k) => {
            const c = pack.cards.find((x) => x.setIndex === s);
            const bx = g.w / 2 + (k - (sets.length - 1) / 2) * 86;
            panel(ctx, bx - 38, y, 76, 26, 10, SET_LOOK[s % SET_LOOK.length].c, false);
            bigText(ctx, `${SET_LOOK[s % SET_LOOK.length].icon} ${c.setHave}/9`, bx, y + 14, 14);
          });
        }
      }
    }
    sparks(ctx, fx, dt);
  };
  return g;
}
