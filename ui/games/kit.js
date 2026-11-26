// THE MINI-GAME KIT: what every side game's own play screen is built from.
// A full-screen stage (a canvas with a marquee header and a footer), a
// frame loop, taps and drags, and the drawing pieces that give every mini-
// game the same look as the board: gold rims, enamel buttons, the Limelight
// marquee, Lilita One numbers, chests, coins and bursts of sparks.
//
//   const g = openGame({ title, top: '#2a0f5c', bottom: '#120430' });
//   g.draw = (ctx, dt, t) => { ... };      // called every frame
//   g.onTap = (x, y) => { ... };            // CSS pixels inside the canvas
//   g.onDrag = { start(x, y), move(x, y), end(x, y) };
//   g.chip('12', paintHammer);              // the counter at the top right
//   await g.prize(reward, 'Gate 1 open!');  // the big prize card
//   g.close();
export const TAU = Math.PI * 2;
export const GAME_FONT = '"Lilita One", ui-rounded, system-ui, sans-serif';
export const SHOW_FONT = 'Limelight, Georgia, serif';

export const ease = {
  out: (t) => 1 - (1 - t) * (1 - t),
  outBack: (t) => { const c = 1.7; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  in: (t) => t * t,
};
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const lerp = (a, b, t) => a + (b - a) * t;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let renderRewardFn = null;
// ui/events.js hands over its reward chips, so the kit need not import it.
export function useRewardChips(fn) { renderRewardFn = fn; }

export function openGame({ title, top = '#3a1078', bottom = '#12052e', onClose = null } = {}) {
  const root = el('div', 'mg');
  root.style.setProperty('--mg-top', top);
  root.style.setProperty('--mg-bottom', bottom);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  const head = el('div', 'mg-head');
  const back = el('button', 'mg-back', 'Back');
  back.type = 'button';
  const name = el('h2', 'mg-title marquee', title || '');
  const chipBox = el('div', 'mg-chip');
  const chipPic = el('canvas', 'mg-chip-pic');
  chipPic.width = 0;
  chipPic.height = 0;
  chipPic.style.width = '0px';
  const chipNum = el('span', 'mg-chip-num', '');
  chipBox.append(chipPic, chipNum);
  head.append(back, name, chipBox);
  const box = el('div', 'mg-box');
  const canvas = el('canvas', 'mg-canvas');
  box.appendChild(canvas);
  const foot = el('div', 'mg-foot');
  const toastEl = el('div', 'mg-toast');
  toastEl.setAttribute('role', 'status');
  root.append(head, box, foot, toastEl);
  (document.getElementById('app') || document.body).appendChild(root);

  const ctx = canvas.getContext('2d');
  const g = {
    root, canvas, ctx, foot, head, w: 0, h: 0, dpr: 1, t: 0,
    draw: null, onTap: null, onDrag: null, closed: false,
  };

  function fit() {
    const r = box.getBoundingClientRect();
    g.dpr = Math.min(3, window.devicePixelRatio || 1);
    g.w = Math.max(1, Math.round(r.width));
    g.h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(g.w * g.dpr);
    canvas.height = Math.round(g.h * g.dpr);
    canvas.style.width = g.w + 'px';
    canvas.style.height = g.h + 'px';
    if (g.onResize) g.onResize(g.w, g.h);
  }
  fit();
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  // Refit whenever the box changes size (the footer filling in, a rotation).
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const r = box.getBoundingClientRect();
      if (Math.round(r.width) !== g.w || Math.round(r.height) !== g.h) fit();
    });
    ro.observe(box);
  }

  let last = 0;
  let raf = 0;
  function frame(ms) {
    if (g.closed) return;
    const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
    last = ms;
    g.t += dt;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    if (g.draw) {
      try { g.draw(ctx, dt, g.t); } catch (e) { console.error(e); }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Taps and drags, in CSS pixels inside the canvas.
  let down = null;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [x, y] = at(e);
    down = { x, y, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (g.onDrag && g.onDrag.start) g.onDrag.start(x, y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const [x, y] = at(e);
    if (Math.hypot(x - down.x, y - down.y) > 8) down.moved = true;
    if (g.onDrag && g.onDrag.move) g.onDrag.move(x, y);
  });
  const up = (e) => {
    if (!down) return;
    const [x, y] = at(e);
    const was = down;
    down = null;
    if (g.onDrag && g.onDrag.end) g.onDrag.end(x, y);
    if (!was.moved && g.onTap) g.onTap(x, y);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = null; if (g.onDrag && g.onDrag.cancel) g.onDrag.cancel(); });

  g.chip = (text, paint) => {
    chipNum.textContent = text;
    if (paint) {
      const s = 30;
      const d = Math.min(3, window.devicePixelRatio || 1);
      chipPic.width = s * d;
      chipPic.height = s * d;
      chipPic.style.width = s + 'px';
      chipPic.style.height = s + 'px';
      const c = chipPic.getContext('2d');
      c.setTransform(d, 0, 0, d, 0, 0);
      c.clearRect(0, 0, s, s);
      paint(c, s / 2, s / 2, s);
    }
    chipBox.classList.remove('bump');
    void chipBox.offsetWidth;
    chipBox.classList.add('bump');
  };

  let toastTimer = 0;
  g.toast = (text, ms = 1800) => {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
  };

  // A big card with the prize. Resolves when it is closed.
  g.prize = (reward, heading, sub) => new Promise((done) => {
    const back2 = el('div', 'mg-prize-back');
    const card = el('div', 'mg-prize');
    card.append(el('span', 'show-rays'));
    card.append(el('div', 'mg-prize-title', heading || 'Prize!'));
    if (sub) card.append(el('p', 'mg-prize-sub', sub));
    if (reward && renderRewardFn) {
      const chips = renderRewardFn(reward, 34);
      chips.classList.add('mg-prize-chips');
      card.append(chips);
    }
    card.append(el('p', 'mg-prize-note', 'It is waiting in your rewards tray.'));
    const ok = el('button', 'btn primary tall mg-prize-ok', 'Collect');
    ok.type = 'button';
    card.append(ok);
    back2.append(card);
    root.append(back2);
    ok.onclick = () => { back2.remove(); done(); };
  });

  // A row of buttons at the bottom: [{ text, cls, onClick }]
  g.buttons = (list) => {
    for (const b of [...foot.querySelectorAll('.btn')]) b.remove(); // (the note stays)
    for (const b of list) {
      const btn = el('button', 'btn ' + (b.cls || ''), b.text);
      btn.type = 'button';
      btn.onclick = b.onClick;
      if (b.disabled) btn.disabled = true;
      foot.append(btn);
    }
  };
  g.note = (text) => {
    let n = foot.querySelector('.mg-note');
    if (!n) { n = el('p', 'mg-note'); foot.prepend(n); }
    n.textContent = text;
  };

  g.close = () => {
    if (g.closed) return;
    g.closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    if (ro) ro.disconnect();
    root.remove();
    if (onClose) onClose();
  };
  back.onclick = g.close;
  return g;
}

// ---- Drawing pieces ----

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A panel with a gold rim, like the board's frame.
export function panel(ctx, x, y, w, h, r, fill = ['#5b24b8', '#2a0b6e'], rim = true) {
  ctx.save();
  if (rim) {
    ctx.fillStyle = 'rgba(20, 6, 50, .45)';
    rr(ctx, x - 2, y + 4, w + 4, h + 4, r + 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#fff0a8');
    g.addColorStop(0.45, '#ffc21a');
    g.addColorStop(1, '#b06400');
    ctx.fillStyle = '#4a2000';
    rr(ctx, x - 4, y - 4, w + 8, h + 8, r + 4);
    ctx.fill();
    ctx.fillStyle = g;
    rr(ctx, x - 2.5, y - 2.5, w + 5, h + 5, r + 2.5);
    ctx.fill();
  }
  const f = ctx.createLinearGradient(0, y, 0, y + h);
  f.addColorStop(0, fill[0]);
  f.addColorStop(1, fill[1]);
  ctx.fillStyle = f;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

// Big game numbers / words: white with a dark outline.
export function bigText(ctx, text, x, y, size, color = '#fff', stroke = '#2a0a5e', align = 'center') {
  ctx.save();
  ctx.font = `${size}px ${GAME_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, size * 0.2);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// A ribbon banner across, with words on it.
export function ribbon(ctx, text, cx, cy, w, h = 34, color = ['#ff4f7a', '#b0103c']) {
  ctx.save();
  const x = cx - w / 2;
  ctx.fillStyle = '#6a0024';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    const ex = s < 0 ? x - h * 0.5 : x + w + h * 0.5;
    const ix = s < 0 ? x + h * 0.4 : x + w - h * 0.4;
    ctx.moveTo(ix, cy - h * 0.3);
    ctx.lineTo(ex, cy - h * 0.3);
    ctx.lineTo(ex + s * h * 0.3, cy + h * 0.2);
    ctx.lineTo(ex, cy + h * 0.7);
    ctx.lineTo(ix, cy + h * 0.7);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, color[0]);
  g.addColorStop(1, color[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = '#4a0018';
  ctx.lineWidth = 2;
  rr(ctx, x, cy - h / 2, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(x + 4, cy - h / 2 + 3, w - 8, h * 0.18);
  ctx.restore();
  bigText(ctx, text, cx, cy + 1, h * 0.58, '#fff', '#5a0020');
}

// A treasure chest; open = 0 (shut) ... 1 (lid thrown back).
export function chest(ctx, cx, cy, s, open = 0, wood = ['#c0602a', '#6a2a0a']) {
  ctx.save();
  const w = s;
  const h = s * 0.62;
  const x = cx - w / 2;
  const y = cy - h * 0.2;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(cx, y + h + s * 0.06, w * 0.55, s * 0.08, 0, 0, TAU);
  ctx.fill();
  if (open > 0) {
    // light pouring out
    const gl = ctx.createRadialGradient(cx, y, 0, cx, y, s * 1.2);
    gl.addColorStop(0, `rgba(255,240,160,${0.8 * open})`);
    gl.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(cx, y, s * 1.2, 0, TAU);
    ctx.fill();
  }
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, wood[0]);
  body.addColorStop(1, wood[1]);
  ctx.fillStyle = body;
  ctx.strokeStyle = '#3a1000';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  rr(ctx, x, y, w, h, s * 0.08);
  ctx.fill();
  ctx.stroke();
  // gold bands
  ctx.fillStyle = '#ffc21a';
  for (const bx of [x + w * 0.18, x + w * 0.74]) { ctx.fillRect(bx, y, w * 0.08, h); }
  // the lid
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(1, 1 - 1.8 * ease.out(open));
  const lid = ctx.createLinearGradient(0, -h * 0.55, 0, 0);
  lid.addColorStop(0, wood[0]);
  lid.addColorStop(1, wood[1]);
  ctx.fillStyle = lid;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -h * 0.3);
  ctx.quadraticCurveTo(0, -h * 0.75, w / 2, -h * 0.3);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // the lock
  ctx.fillStyle = '#ffe070';
  ctx.strokeStyle = '#7a4000';
  rr(ctx, cx - s * 0.08, y - s * 0.04, s * 0.16, s * 0.18, s * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// A gold coin.
export function coin(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#fff3a0');
  g.addColorStop(0.5, '#ffc21a');
  g.addColorStop(1, '#c07000');
  ctx.fillStyle = '#6a3a00';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,0,.6)';
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.58, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// A stage hammer (the dig's tool), head toward the top right.
export function hammer(ctx, cx, cy, s, angle = -0.6) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  // handle
  const hg = ctx.createLinearGradient(-s * 0.06, 0, s * 0.06, 0);
  hg.addColorStop(0, '#e0a060');
  hg.addColorStop(1, '#8a4a1a');
  ctx.fillStyle = hg;
  ctx.strokeStyle = '#3a1800';
  ctx.lineWidth = Math.max(1, s * 0.05);
  rr(ctx, -s * 0.07, -s * 0.2, s * 0.14, s * 0.62, s * 0.05);
  ctx.fill();
  ctx.stroke();
  // head
  const g = ctx.createLinearGradient(0, -s * 0.42, 0, -s * 0.16);
  g.addColorStop(0, '#f4f6ff');
  g.addColorStop(0.5, '#a8b0cc');
  g.addColorStop(1, '#5a6080');
  ctx.fillStyle = g;
  rr(ctx, -s * 0.34, -s * 0.44, s * 0.68, s * 0.28, s * 0.07);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffc21a';
  ctx.fillRect(-s * 0.09, -s * 0.44, s * 0.18, s * 0.28);
  ctx.restore();
}

// ---- Sparks ----
// A list of particles that fly, fall and fade. burst() adds, sparks() draws.
export function burst(list, x, y, { n = 16, colors = ['#fff3a0', '#ffc21a', '#ff7ab0'], speed = 220, size = 5, gravity = 600, life = 0.8, kind = 'spark' } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const v = speed * (0.4 + Math.random() * 0.8);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g: gravity, life, age: 0, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind, spin: Math.random() * TAU });
  }
}
export function sparks(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += dt;
    if (p.age >= p.life) { list.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.spin += dt * 8;
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = Math.min(1, a * 1.5);
    ctx.fillStyle = p.color;
    if (p.kind === 'chip') {
      // a flake of stone
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size * 0.6);
      ctx.lineTo(p.size, -p.size * 0.3);
      ctx.lineTo(p.size * 0.3, p.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'star') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const r = k % 2 ? p.size * 0.4 : p.size;
        ctx.lineTo(Math.cos((k * TAU) / 8) * r, Math.sin((k * TAU) / 8) * r);
      }
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Words that float up and fade ("+3 hammers").
export function floaters(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    f.age += dt;
    if (f.age > (f.life || 1.2)) { list.splice(i, 1); continue; }
    const t = f.age / (f.life || 1.2);
    ctx.globalAlpha = 1 - t * t;
    bigText(ctx, f.text, f.x, f.y - 50 * ease.out(t), (f.size || 24) * (1 + 0.3 * (1 - ease.outBack(Math.min(1, t * 4)))), f.color || '#fff3a0', f.stroke || '#5a2a00');
  }
  ctx.globalAlpha = 1;
}

// Spinning rays of light behind something.
export function rays(ctx, cx, cy, r, t, color = 'rgba(255,240,170,.22)', n = 14) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.4);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a, a + TAU / n / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// The deep stage backdrop: a gradient with a soft spotlight.
export function backdrop(ctx, w, h, top = '#3a1078', bottom = '#12052e', spot = 'rgba(255,220,255,.18)') {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const s = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, Math.max(w, h) * 0.7);
  s.addColorStop(0, spot);
  s.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w, h);
}

// The reward chips (coins, boosters, packs ...) as a DOM element.
export function rewardChips(reward, size = 22) {
  return renderRewardFn ? renderRewardFn(reward, size) : document.createElement('span');
}
