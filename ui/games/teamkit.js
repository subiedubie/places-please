// Shared drawing pieces for the board-style side games (Mission Control,
// Mission Pursuit, the Company Tournament, the Grand Circuit, the Battle of
// the Companies): avatars, reward lines drawn on the canvas, progress bars,
// a flick-scroll list, time left and a counter that rolls up.
import { GAME_FONT, TAU, rr, coin, bigText, clamp01, ease } from './kit.js';

// Castmate avatars (the same emoji as the team page in ui/events.js).
export const AVATAR = { piggy: '🐷', cat: '🐱', fox: '🦊', owl: '🦉', bunny: '🐰', bear: '🐻', frog: '🐸', panda: '🐼' };

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function emoji(ctx, ch, x, y, size) {
  ctx.save();
  ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y + size * 0.06);
  ctx.restore();
}

// A round avatar badge with a ring.
export function avatarDisc(ctx, id, cx, cy, r, ring = '#ffc21a', fill = '#fff3d8') {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.12, r, 0, TAU); ctx.fill();
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, TAU); ctx.fill();
  ctx.restore();
  emoji(ctx, AVATAR[id] || '🎭', cx, cy, r * 1.15);
}

export const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');

// "2d 4h", "3h 12m", "12m", "45s"
export function timeLeft(endsAt, now = Date.now()) {
  if (endsAt === null || endsAt === undefined) return '';
  const s = Math.max(0, Math.floor((endsAt - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// A reward as short pieces: [{ icon: 'coin' | emoji, text }].
const BOOSTER = { spot: '🚀', show: '💣', prism: '🔮', drill: '🔨', stageleft: '↔️', trapdoor: '↕️', coinflip: '🔀' };
export function rewardBits(reward) {
  const out = [];
  if (!reward) return out;
  if (reward.coins) out.push({ icon: 'coin', text: fmt(reward.coins) });
  if (reward.gold) out.push({ icon: '🌟', text: `${reward.gold}` });
  if (reward.packs) out.push({ icon: '🎴', text: `${reward.packs}` });
  for (const [k, n] of Object.entries(reward.boosters || {})) if (n) out.push({ icon: BOOSTER[k] || '🎁', text: `${n}` });
  if (reward.boost) out.push({ icon: '⚡', text: `${reward.boost.minutes}m` });
  if (reward.lives) out.push({ icon: '❤️', text: `${reward.lives}m` });
  return out;
}

// Draw a reward on one line, centred on (cx, cy) (or starting at cx when
// align = 'left'). Returns the width used. Pieces past maxW are dropped.
export function drawReward(ctx, reward, cx, cy, size = 16, align = 'center', maxW = 999) {
  const bits = rewardBits(reward);
  ctx.save();
  ctx.font = `${size}px ${GAME_FONT}`;
  const widths = bits.map((b) => size * 1.1 + ctx.measureText(b.text).width + size * 0.5);
  let keep = bits.length;
  let total = widths.reduce((a, b) => a + b, 0);
  while (keep > 1 && total > maxW) total -= widths[--keep];
  let x = align === 'center' ? cx - total / 2 : cx;
  for (let i = 0; i < keep; i++) {
    const b = bits[i];
    if (b.icon === 'coin') coin(ctx, x + size * 0.5, cy, size * 0.5);
    else emoji(ctx, b.icon, x + size * 0.5, cy, size * 0.95);
    bigText(ctx, b.text, x + size * 1.1, cy + 1, size, '#fff', '#2a0a5e', 'left');
    x += widths[i];
  }
  ctx.restore();
  return total;
}

// A progress bar with a gold rim; frac 0..1. `glow` adds a moving shine.
export function bar(ctx, x, y, w, h, frac, fill = ['#7af07a', '#18a040'], t = 0) {
  ctx.save();
  ctx.fillStyle = '#4a2000';
  rr(ctx, x - 2, y - 2, w + 4, h + 4, h / 2 + 2);
  ctx.fill();
  ctx.fillStyle = '#ffc21a';
  rr(ctx, x - 1, y - 1, w + 2, h + 2, h / 2 + 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,6,50,.85)';
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const f = clamp01(frac);
  if (f > 0) {
    const fw = Math.max(h, w * f);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, fill[0]);
    g.addColorStop(1, fill[1]);
    ctx.fillStyle = g;
    rr(ctx, x, y, fw, h, h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    rr(ctx, x + 3, y + 2, fw - 6, h * 0.3, h * 0.15);
    ctx.fill();
    if (t) {
      // a shine running along the fill
      ctx.save();
      rr(ctx, x, y, fw, h, h / 2);
      ctx.clip();
      const sx = x + ((t * 120) % (fw + 80)) - 40;
      const sg = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,.45)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 20, y, 40, h);
      ctx.restore();
    }
  }
  ctx.restore();
}

// A number that rolls toward its target (for counters that climb).
export function roller(start = 0) {
  return {
    shown: start,
    target: start,
    set(n) { this.target = n; },
    step(dt) {
      const gap = this.target - this.shown;
      if (Math.abs(gap) < 0.5) { this.shown = this.target; return false; }
      this.shown += gap * Math.min(1, dt * 3.2) + Math.sign(gap) * Math.min(Math.abs(gap), dt * 4);
      return true;
    },
  };
}

// A vertical list that scrolls with a drag and keeps gliding after a flick.
// Use: s.max = content height - view height; s.y is the offset (0..max).
export function scroller() {
  const s = {
    y: 0, max: 0, v: 0, held: false, lastY: 0, lastT: 0, moved: 0,
    start(y) { s.held = true; s.lastY = y; s.lastT = performance.now(); s.v = 0; s.moved = 0; },
    move(y) {
      if (!s.held) return;
      const now = performance.now();
      const dy = s.lastY - y;
      s.y = Math.max(-40, Math.min(s.max + 40, s.y + dy));
      s.moved += Math.abs(dy);
      const dt = Math.max(1, now - s.lastT);
      s.v = (dy / dt) * 1000;
      s.lastY = y;
      s.lastT = now;
    },
    end() { s.held = false; },
    step(dt) {
      if (s.held) return;
      if (Math.abs(s.v) > 5) { s.y += s.v * dt; s.v *= Math.pow(0.04, dt); } else s.v = 0;
      if (s.y < 0) { s.y += (0 - s.y) * Math.min(1, dt * 12); s.v = 0; }
      if (s.y > s.max) { s.y += (s.max - s.y) * Math.min(1, dt * 12); s.v = 0; }
    },
  };
  return s;
}

// A pop-in scale for something that has just appeared (age in seconds).
export const pop = (age, len = 0.35) => ease.outBack(clamp01(age / len));

// Wrap words to fit `maxW`; returns lines.
export function wrap(ctx, text, maxW, size) {
  ctx.save();
  ctx.font = `${size}px ${GAME_FONT}`;
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryLine).width > maxW && line) { lines.push(line); line = w; } else line = tryLine;
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

// Plain small text (not outlined), for notes on panels.
export function smallText(ctx, text, x, y, size, color = '#ffe9a8', align = 'center') {
  ctx.save();
  ctx.font = `${size}px ${GAME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Fit text into a width by shrinking the size; returns the size to use.
export function fitSize(ctx, text, maxW, size) {
  ctx.save();
  ctx.font = `${size}px ${GAME_FONT}`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w > maxW ? Math.max(9, Math.floor(size * (maxW / w))) : size;
}
