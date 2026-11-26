// SHOW KIT: the pieces shared by the play screens of the "list" side games
// (leaderboards, lanes, ladders, the company pot, balloons, the pinata and
// the long tour). Built on ui/games/kit.js; nothing here reads the rules.
import { bigText, coin, rr, TAU, GAME_FONT, ease, clamp01, lerp } from './kit.js';
import { drawPiece, drawPowerIcon } from '../render.js';
import { theme } from '../../config/theme.js';

// The player's avatar (the same list as the company screen in ui/events.js).
export const AVATAR = { piggy: '🐷', cat: '🐱', fox: '🦊', owl: '🦉', bunny: '🐰', bear: '🐻', frog: '🐸', panda: '🐼' };
// Faces for the computer players, picked from their name.
const FACES = ['🐷', '🐱', '🦊', '🦉', '🐰', '🐻', '🐸', '🐼', '🐨', '🐯', '🦁', '🐵', '🐧', '🦄', '🐙', '🐢'];

export const youFace = (avatar) => AVATAR[avatar] || '🎭';
export function faceOf(name) {
  let h = 7;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FACES[h % FACES.length];
}

// An emoji (or any character) drawn centred.
export function emoji(ctx, ch, x, y, size) {
  ctx.save();
  ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; // (colour emoji ignore it; a plain-glyph fallback stays dark)
  ctx.globalAlpha = 1;
  ctx.fillText(ch, x, y + size * 0.06);
  ctx.restore();
}

// A round avatar token: a gold ring with a face in it.
export function token(ctx, face, x, y, r, you = false, glow = 0) {
  ctx.save();
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2);
    g.addColorStop(0, `rgba(255,240,150,${0.6 * glow})`);
    g.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(10,0,30,.35)';
  ctx.beginPath(); ctx.arc(x, y + r * 0.12, r + 2, 0, TAU); ctx.fill();
  const rim = ctx.createLinearGradient(0, y - r, 0, y + r);
  rim.addColorStop(0, you ? '#b8ffcf' : '#fff0a8');
  rim.addColorStop(1, you ? '#0a8a3a' : '#b06400');
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const f = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
  f.addColorStop(0, you ? '#e8fff0' : '#fff8ec');
  f.addColorStop(1, you ? '#9adcb4' : '#e8cfb0');
  ctx.fillStyle = f;
  ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.fill();
  ctx.restore();
  emoji(ctx, face, x, y, r * 1.15);
}

export function ordinal(n) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}
export const num = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

// "2d 4h", "3h 12m", "12:05"
export function timeLeft(endsAt, now = Date.now()) {
  if (endsAt === null || endsAt === undefined) return '';
  const ms = Math.max(0, endsAt - now);
  const d = Math.floor(ms / 86400e3);
  const h = Math.floor((ms % 86400e3) / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  const s = Math.floor((ms % 60e3) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// A little clock face beside a countdown.
export function clockText(ctx, endsAt, x, y, size = 15, align = 'center') {
  const text = timeLeft(endsAt);
  if (!text) return;
  ctx.save();
  ctx.font = `${size}px ${GAME_FONT}`;
  const w = ctx.measureText(text).width + size * 1.6;
  ctx.restore();
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, left, y - size * 0.8, w, size * 1.6, size * 0.8);
  ctx.fill();
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(left + size * 0.75, y, size * 0.42, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left + size * 0.75, y); ctx.lineTo(left + size * 0.75, y - size * 0.28); ctx.moveTo(left + size * 0.75, y); ctx.lineTo(left + size * 0.95, y); ctx.stroke();
  bigText(ctx, text, left + size * 1.3, y, size, '#fff', '#2a0a5e', 'left');
}

// ---- Rewards, drawn on the canvas ----
const BOOSTER_EMOJI = { drill: '🔩', stageleft: '🪝', trapdoor: '🚪', coinflip: '🪙' };

function packPic(ctx, x, y, s, gold) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, gold ? '#fff3a0' : '#ff8ac0');
  g.addColorStop(1, gold ? '#c07000' : '#b0185c');
  ctx.fillStyle = '#3a0a28';
  rr(ctx, -s * 0.36 - 1.5, -s / 2 - 1.5, s * 0.72 + 3, s + 3, s * 0.12); ctx.fill();
  ctx.fillStyle = g;
  rr(ctx, -s * 0.36, -s / 2, s * 0.72, s, s * 0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.08 : s * 0.2; ctx.lineTo(Math.cos((k * TAU) / 10 - Math.PI / 2) * r, Math.sin((k * TAU) / 10 - Math.PI / 2) * r); }
  ctx.fill();
  ctx.restore();
}

// The parts of a reward as icons + numbers: [{ paint(ctx,x,y,s), text }]
export function rewardParts(reward) {
  const out = [];
  if (!reward) return out;
  if (reward.coins) out.push({ paint: (c, x, y, s) => coin(c, x, y, s * 0.42), text: num(reward.coins) });
  if (reward.gold) out.push({ paint: (c, x, y, s) => packPic(c, x, y, s * 0.85, true), text: `x${reward.gold}` });
  if (reward.packs) out.push({ paint: (c, x, y, s) => packPic(c, x, y, s * 0.85, false), text: `x${reward.packs}` });
  for (const [kind, n] of Object.entries(reward.boosters || {})) {
    if (!n) continue;
    if (BOOSTER_EMOJI[kind]) out.push({ paint: (c, x, y, s) => emoji(c, BOOSTER_EMOJI[kind], x, y, s * 0.8), text: `x${n}` });
    else out.push({ paint: (c, x, y, s) => powerIcon(c, kind, x, y, s * 0.95), text: `x${n}` });
  }
  if (reward.boost) out.push({ paint: (c, x, y, s) => emoji(c, '⏱️', x, y, s * 0.8), text: `${reward.boost.minutes}m` });
  if (reward.lives) out.push({ paint: (c, x, y, s) => emoji(c, '❤️', x, y, s * 0.75), text: `${reward.lives}m` });
  return out;
}

// Draws a reward in one line; returns its width. align: 'center' | 'left' | 'right'.
export function drawReward(ctx, reward, x, y, size = 20, align = 'center', max = 3) {
  const parts = rewardParts(reward).slice(0, max);
  if (!parts.length) return 0;
  ctx.save();
  ctx.font = `${size * 0.8}px ${GAME_FONT}`;
  const widths = parts.map((p) => size + 3 + ctx.measureText(p.text).width);
  ctx.restore();
  const gap = size * 0.4;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  parts.forEach((p, i) => {
    p.paint(ctx, px + size / 2, y, size);
    bigText(ctx, p.text, px + size + 3, y + 1, size * 0.8, '#fff', '#2a0a5e', 'left');
    px += widths[i] + gap;
  });
  return total;
}

export function powerIcon(ctx, kind, x, y, s) {
  const k = kind === 'spot' ? 'spot-h' : kind;
  try {
    if (!theme.powers || !theme.powers[k]) return false;
    ctx.save();
    ctx.translate(x - s / 2, y - s / 2);
    drawPowerIcon(ctx, k, s, theme);
    ctx.restore();
    return true;
  } catch { return false; }
}
export function pieceIcon(ctx, color, x, y, s) {
  try { drawPiece(ctx, color, x, y, s, theme); return true; } catch { return false; }
}

// ---- Numbers that count up ----
export function counter(start = 0) {
  return {
    v: start,
    to: start,
    step(dt) {
      if (this.v === this.to) return this.v;
      const d = this.to - this.v;
      const move = Math.sign(d) * Math.max(dt * 6, Math.abs(d) * dt * 4);
      this.v = Math.abs(move) >= Math.abs(d) ? this.to : this.v + move;
      return this.v;
    },
    get shown() { return Math.round(this.v); },
  };
}

// ---- "Last seen": what the screen showed the last time it was opened ----
// Kept in the event's own save (act({ seen })) where the rules allow it,
// otherwise in this phone's local storage (a convenience only).
export function seenNote(api, v) {
  const key = `pp-seen:${v.id}`;
  return {
    get() {
      if (v.game && v.game.seen) return v.game.seen;
      try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
    },
    set(obj) {
      const out = api.act({ seen: obj });
      if (out && out.ok) return;
      try { localStorage.setItem(key, JSON.stringify(obj)); } catch { /* fine */ }
    },
  };
}

// Press Start on an event that is on offer (dash, sprint, bracket).
export function startEvent(api) {
  try {
    if (api.session && api.session.events && api.session.events.start) api.session.events.start(api.id, Date.now());
  } catch (e) { console.error(e); }
  api.changed();
}

// ---- Orbs that fly into a target (progress gained since the last look) ----
export function launchOrbs(list, n, from, to, { delay = 0, gap = 0.07, colors = ['#fff3a0', '#ffc21a'], onArrive = null, size = 9 } = {}) {
  for (let i = 0; i < n; i++) {
    list.push({
      x0: from.x + (Math.random() - 0.5) * (from.spread || 60),
      y0: from.y + (Math.random() - 0.5) * (from.spread || 30),
      tx: to.x, ty: to.y,
      age: -(delay + i * gap),
      life: 0.65 + Math.random() * 0.2,
      bend: (Math.random() - 0.5) * 180,
      color: colors[i % colors.length],
      size,
      onArrive,
      last: i === n - 1,
    });
  }
}
export function drawOrbs(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    o.age += dt;
    if (o.age < 0) continue;
    const k = clamp01(o.age / o.life);
    const e = ease.inOut(k);
    const x = lerp(o.x0, o.tx, e) + Math.sin(k * Math.PI) * o.bend;
    const y = lerp(o.y0, o.ty, e) - Math.sin(k * Math.PI) * 40;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, o.size * 2.2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, o.color);
    g.addColorStop(1, 'rgba(255,200,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, o.size * 2.2, 0, TAU); ctx.fill();
    ctx.restore();
    if (k >= 1) {
      list.splice(i, 1);
      if (o.onArrive) o.onArrive(o);
    }
  }
}

// ---- A vertical drag-to-scroll with a little glide ----
export function scroller() {
  return {
    y: 0, min: 0, max: 0, v: 0, held: false, lastY: 0, moved: 0,
    clamp() { this.y = Math.max(this.min, Math.min(this.max, this.y)); },
    start(y) { this.held = true; this.lastY = y; this.v = 0; this.moved = 0; },
    move(y) { if (!this.held) return; const d = this.lastY - y; this.y += d; this.v = d * 60; this.moved += Math.abs(d); this.lastY = y; this.clamp(); },
    end() { this.held = false; },
    step(dt) {
      if (this.held || Math.abs(this.v) < 5) return;
      this.y += this.v * dt;
      this.v *= Math.pow(0.04, dt);
      this.clamp();
    },
    to(y) { this.y = y; this.clamp(); },
  };
}

// A thick progress bar with a shine; part 0..1.
export function bar(ctx, x, y, w, h, part, fill = ['#9affc0', '#18a050'], label = '', labelSize = null) {
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,180,.7)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, h / 2); ctx.stroke();
  const p = clamp01(part);
  if (p > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, fill[0]);
    g.addColorStop(1, fill[1]);
    ctx.fillStyle = g;
    rr(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * p), h - 4, (h - 4) / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    rr(ctx, x + 5, y + 4, Math.max(0, (w - 10) * p), h * 0.22, h * 0.11); ctx.fill();
  }
  if (label) bigText(ctx, label, x + w / 2, y + h / 2 + 1, labelSize || h * 0.62);
}

// The footer: "Play a level" (and more). Refits the canvas after.
export function footer(g, api, extra = []) {
  g.buttons([...extra, { text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  window.dispatchEvent(new Event('resize'));
}
