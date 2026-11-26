// THE STAGE: draws the board with PixiJS (vendor/pixi.min.js), which uses the
// phone's graphics chip. Every cell's picture is made once by ui/render.js and
// reused; this file moves them and adds glow, shards and sparkles.
//
// No sound, no screen shake, no vibration (the owner's choice).
// If the phone cannot do this, createStage returns null and the board is
// drawn the old way.
import { drawCellPicture, drawTray, curtainGroups, curtainMeterBox, drawCurtainMeter } from './render.js';
import { fx } from './fx.js';

// ---- Settings ----
const SHARDS = 9;            // pieces a gem breaks into
const MAX_PARTICLES = 420;   // most loose bits on screen at once
const IDLE_SPARKLE_MS = 700; // a glint on a random gem about this often
const DIM = 0.42;            // how dark the board goes behind a power-up going off

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const keyOf = (x, y) => x + ',' + y;

// The color of the shards an obstacle breaks into.
const PROP_COLORS = {
  crate: 0xc98b4a, hatbox: 0xe85a9b, trunk: 0x8a5530, dryice: 0x6fd6ff, cashbox: 0x7c9cc4,
  flat: 0xc9bfae, strongbox: 0x55606f, costume: 0x1fb5a8, padlock: 0xe0a100, planter: 0x4caf50,
  bouquet: 0xff7aa8, candyjar: 0xff5a6e, dovecote: 0xd94b3d, footlights: 0x44506b,
  fireworks: 0xd6283c, truss: 0xaab4c4, ticketbooth: 0xd6283c, makeupcase: 0xe04fb5, ivy: 0x3fae49, mouse: 0xa9a9b8, paintkeg: 0x6a2ce0, dove: 0xffffff, tortoise: 0x3fae6a,
  vine: 0x2fc452, rolldrop: 0xff5f9e, fusebox: 0x6a4bff, rigbag: 0xb5541e, barrel: 0xa8622c, followspot: 0xffd75a, dressing: 0xff5a9a, giftbox: 0x2aa8ff,
  greasepot: 0xff9a24, goo: 0xff9a24, propcase: 0x3f5688, rope: 0x5a3a8a, cannon: 0x18b8a8,
  dimmer: 0x16a4d8, chandelier: 0x8ff0ff, flamepot: 0x7a3ac0, laser: 0xff3adf, thunder: 0xffd21f, flowercart: 0xff5f9a, maskrack: 0xc01f4a, mask: 0xfff6e6,
  grandsafe: 0x2aa070, pastepot: 0x2a8fe0, poster: 0xe0246e, trophycase: 0xa85a24, safetycurtain: 0x2f9aa8, gel: 0x8e96ad, programs: 0x3ab8d8, program: 0xfff4dc,
  bubbles: 0xffb4dc, pin: 0xe8a04a, weight: 0x56638f, rocketrack: 0x4a34b8, pinkbox: 0xff4fa8, squib: 0xff3f5a, cobweb: 0xeef2ff, straw: 0xf2b632, gallery: 0xf0183c, painttube: 0xb02af0, carpet: 0xe0183c, wardrobe: 0x9a4bff, glove: 0xfff4fb, lift: 0x39456e, lamp: 0xfff2a0, capsule: 0xe8a04a, trophy: 0xffc42a, duck: 0xffd21f, flyer: 0xe0246e,
};

export async function createStage(canvas, theme) {
  let PIXI;
  let renderer;
  try {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return null;
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    PIXI = await import('../vendor/pixi.min.js');
    renderer = new PIXI.WebGLRenderer();
    await renderer.init({
      canvas, width: 10, height: 10, resolution: 1, backgroundAlpha: 0, antialias: false,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('PixiJS stage not available:', err);
    return null;
  }

  // ---- Layers, back to front ----
  const root = new PIXI.Container();
  const tray = new PIXI.Sprite();
  const dim = new PIXI.Sprite();
  const under = new PIXI.Container();   // glow behind the pieces
  const trails = new PIXI.Container();  // what a flying star leaves behind
  const pieces = new PIXI.Container();
  const clip = new PIXI.Graphics();
  const over = new PIXI.Container();    // glow in front
  const bits = new PIXI.Container();    // shards and sparkles
  const meters = new PIXI.Container();  // how many gems a curtain still wants
  root.addChild(tray, dim, under, trails, pieces, meters, over, bits, clip);
  pieces.mask = clip;
  dim.tint = 0x0d1430;
  dim.alpha = 0;

  let dpr = 1;
  let layout = null;
  let board = null;
  let overlay = null;
  let dirty = false;
  let redrawNext = false;
  let dimNow = 0;
  let live = false; // true while the level screen is showing

  // ---- Pictures made once and reused ----
  let cache = new Map();
  function toTexture(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    paint(g);
    return PIXI.Texture.from(c, true);
  }
  function clearCache() {
    const old = [...cache.values()];
    cache = new Map();
    // (after the next frame, when nothing on screen uses them any more)
    setTimeout(() => old.forEach((p) => p.tex.destroy(true)), 200);
  }
  // The picture of a cell. Big obstacles get a bigger picture.
  function pictureOf(cell, bare, isSuper) {
    const name = JSON.stringify(cell) + (bare ? 'b' : '') + (isSuper ? 's' : '');
    let hit = cache.get(name);
    if (!hit) {
      const s = layout.cell;
      const block = cell.t === 'block';
      const w = block && cell.w > 1 ? cell.w : 1;
      const h = block && cell.h > 1 ? cell.h : 1;
      const tex = toTexture((w + 0.3) * s, (h + 0.3) * s,
        (g) => drawCellPicture(g, cell, s * 0.65, s * 0.65, s, theme, { bare, superPrism: isSuper }));
      // where the middle of the (top-left) cell is in the picture
      hit = { tex, ax: (s * 0.65 * dpr) / tex.width, ay: (s * 0.65 * dpr) / tex.height };
      if (cache.size > 260) clearCache();
      cache.set(name, hit);
    }
    return hit;
  }

  // Small soft shapes used for the light effects.
  const fixed = {};
  function shape(name, size, paint) {
    if (!fixed[name]) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      paint(c.getContext('2d'), size);
      fixed[name] = PIXI.Texture.from(c, true);
    }
    return fixed[name];
  }
  const fade = (g, n, r, stops) => {
    for (const [at, a] of stops) r.addColorStop(at, 'rgba(255,255,255,' + a + ')');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  };
  const softDot = () => shape('dot', 64, (g, n) => fade(g, n,
    g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2), [[0, 1], [0.35, 0.55], [1, 0]]));
  const ringTex = () => shape('ring', 256, (g, n) => fade(g, n,
    g.createRadialGradient(n / 2, n / 2, n * 0.28, n / 2, n / 2, n / 2), [[0, 0], [0.72, 0.25], [0.88, 1], [1, 0]]));
  const beamTex = () => shape('beam', 64, (g, n) => fade(g, n,
    g.createLinearGradient(0, 0, 0, n), [[0, 0], [0.42, 0.35], [0.5, 1], [0.58, 0.35], [1, 0]]));
  const SHARD_SHAPES = [[[0.1, 0.85], [0.55, 0.05], [0.9, 0.7]],
    [[0.2, 0.1], [0.9, 0.35], [0.6, 0.95], [0.1, 0.7]], [[0.5, 0.02], [0.75, 0.5], [0.45, 0.98], [0.25, 0.45]]];
  const shardTex = (k) => shape('shard' + (k % 3), 48, (g, n) => {
    g.beginPath();
    SHARD_SHAPES[k % 3].forEach(([x, y], i) => (i ? g.lineTo(x * n, y * n) : g.moveTo(x * n, y * n)));
    g.closePath();
    const r = g.createLinearGradient(0, 0, n, n);
    r.addColorStop(0, '#ffffff');
    r.addColorStop(0.5, '#cccccc');
    r.addColorStop(1, '#888888');
    g.fillStyle = r;
    g.fill();
  });
  const glintTex = () => shape('glint', 64, (g, n) => {
    g.fillStyle = '#ffffff';
    for (const [a, b] of [[n / 2, 4], [4, n / 2]]) {
      g.beginPath();
      g.ellipse(n / 2, n / 2, a, b, 0, 0, Math.PI * 2);
      g.fill();
    }
  });

  // ---- A list of sprites reused from one frame to the next ----
  function pool(layer) {
    const all = [];
    let n = 0;
    return {
      begin() { n = 0; },
      next() {
        let s = all[n];
        if (!s) { s = new PIXI.Sprite(); all.push(s); layer.addChild(s); }
        n += 1;
        s.visible = true;
        s.alpha = 1;
        s.rotation = 0;
        s.tint = 0xffffff;
        s.blendMode = 'normal';
        return s;
      },
      end() { for (let i = n; i < all.length; i++) all[i].visible = false; },
    };
  }
  const piecePool = pool(pieces);
  const underPool = pool(under);
  const overPool = pool(over);

  const X = (x) => layout.originX + (x + 0.5) * layout.cell;
  const Y = (y) => layout.originY + (y + 0.5) * layout.cell;

  function put(cell, x, y, sx, sy, rot, bare) {
    if (!cell || cell.t === 'empty' || cell.t === 'part') return null;
    const pic = pictureOf(cell, bare, Boolean(overlay && overlay.superPrism && cell.kind === 'prism'));
    const s = piecePool.next();
    s.texture = pic.tex;
    s.anchor.set(pic.ax, pic.ay);
    s.position.set(x, y);
    s.scale.set(sx / dpr, sy / dpr);
    s.rotation = rot || 0;
    return s;
  }
  // EVENT MARKERS: a small gold token on every piece (by color) or power-up
  // (by kind) that counts for a side game running now. setMarkers() picks them.
  let markers = null;
  const marked = (c) => markers && ((c.t === 'piece' && markers.colors.includes(c.color)) || (c.t === 'power' && markers.powers.includes(c.kind)));
  const markTex = () => shape('mark', 64, (g, n) => {
    const r = n * 0.42;
    g.fillStyle = '#3a1a00';
    g.beginPath(); g.arc(n / 2, n / 2 + 2, r, 0, Math.PI * 2); g.fill();
    const gr = g.createLinearGradient(0, n / 2 - r, 0, n / 2 + r);
    gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#ffc21a'); gr.addColorStop(1, '#c07000');
    g.fillStyle = gr;
    g.beginPath(); g.arc(n / 2, n / 2, r * 0.86, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a1ab8';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? r * 0.24 : r * 0.58;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      g.lineTo(n / 2 + Math.cos(a) * rr, n / 2 + Math.sin(a) * rr);
    }
    g.fill();
  });
  function mark(x, y, k) {
    const s = layout.cell;
    const spr = glow(overPool, markTex(), x + s * 0.3 * k, y - s * 0.3 * k, s * 0.4, s * 0.4, 0xffffff, 1);
    spr.blendMode = 'normal';
  }

  function glow(p, tex, x, y, w, h, color, alpha, rot) {
    const s = p.next();
    s.texture = tex;
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set(Math.max(0.001, w / tex.width), Math.max(0.001, h / tex.height));
    s.tint = color;
    s.alpha = alpha;
    s.rotation = rot || 0;
    s.blendMode = 'add';
    return s;
  }

  let trayKey = '';
  function paintTray() {
    const k = [layout.cell, layout.originX, layout.originY, layout.canvasW, layout.canvasH, dpr].join()
      + '|' + board.cols + '|' + board.cells.map((c) => (c === null ? '#' : '.')).join('')
      + '|' + (board.floor || []).map((f) => (f ? f[0] : '-')).join('')
      + '|' + JSON.stringify([board.revolves, board.hidden, board.belts]) + '|' + (board.paint || []).join('');
    if (k === trayKey) return;
    trayKey = k;
    for (const [sprite, shade] of [[tray, false], [dim, true]]) {
      const old = sprite.texture;
      sprite.texture = toTexture(layout.canvasW, layout.canvasH, (g) => drawTray(g, board, layout, theme, shade));
      sprite.scale.set(1 / dpr);
      if (old && old !== PIXI.Texture.EMPTY) old.destroy(true);
    }
    clip.clear().rect(layout.originX, layout.originY, layout.cell * board.cols, layout.cell * board.rows).fill(0xffffff);
  }

  // The meter on each curtain. Its picture is kept until its number changes.
  const meterPics = new Map(); // color -> { key, sprite }
  function paintMeters() {
    const groups = overlay && overlay.tally ? curtainGroups(board) : [];
    const seen = new Set();
    for (const g of groups) {
      seen.add(g.color);
      const s = layout.cell;
      const at = curtainMeterBox(g);
      const have = Math.min(g.need, overlay.tally[g.color] || 0);
      const key = [have, g.need, at.w, s, dpr].join();
      let m = meterPics.get(g.color);
      if (!m) { m = { key: '', sprite: new PIXI.Sprite() }; meterPics.set(g.color, m); meters.addChild(m.sprite); }
      if (m.key !== key) {
        const old = m.sprite.texture;
        const pad = s * 0.15;
        m.sprite.texture = toTexture(at.w * s + 2 * pad, at.h * s + 2 * pad, (c) => {
          c.translate(pad, pad);
          drawCurtainMeter(c, g.color, have, g.need, at.w * s, at.h * s, theme);
        });
        if (old && old !== PIXI.Texture.EMPTY) old.destroy(true);
        m.key = key;
      }
      m.sprite.visible = true;
      m.sprite.anchor.set(0.5);
      m.sprite.scale.set(1 / dpr);
      m.sprite.position.set(layout.originX + at.x * s, layout.originY + at.y * s);
    }
    for (const [color, m] of meterPics) if (!seen.has(color)) m.sprite.visible = false;
  }

  // ---- The light of a power-up going off (see effectsFor in ui/anim.js) ----
  const HUES = [0xff9a08, 0xff3b5c, 0x4d8dff, 0x2fe080, 0xb06bff];
  function drawEffect(f) {
    const s = layout.cell;
    const a = Math.min(1, f.alpha);
    const p = f.p;
    const b = f.big ? 1.5 : 1;
    if (f.type === 'streak') {
      const h = f.dir !== 'v';
      const span = h ? Math.max(f.x + 1, board.cols - f.x) : Math.max(f.y + 1, board.rows - f.y);
      const reach = p * span * s;
      const rot = h ? 0 : Math.PI / 2;
      glow(overPool, beamTex(), X(f.x), Y(f.y), reach * 2, s * 1.6 * b, f.look === 'laser' ? 0xff20c8 : 0xff5a1f, a, rot);
      glow(overPool, beamTex(), X(f.x), Y(f.y), reach * 2, s * 0.8 * b, f.look === 'laser' ? 0xffc8f4 : 0xffe9b0, a, rot);
      for (const d of [-1, 1]) {
        const hx = X(f.x) + (h ? d * reach : 0);
        const hy = Y(f.y) + (h ? 0 : d * reach);
        glow(overPool, softDot(), hx, hy, s * 1.9 * b, s * 1.9 * b, 0xff9a3c, a);
        glow(overPool, softDot(), hx, hy, s * 0.9 * b, s * 0.9 * b, 0xffffff, a);
        if (p < 1) for (let i = 0; i < 2; i++) spark(hx, hy, 0xffb347, s * 3);
      }
    } else if (f.type === 'ring') {
      const r = Math.max(0.1, p * f.radius) * s;
      const core = r * 1.6 * (1.2 - p * 0.7);
      glow(underPool, softDot(), X(f.x), Y(f.y), r * 2.6, r * 2.6, 0xff7a18, a);
      glow(overPool, softDot(), X(f.x), Y(f.y), core, core, 0xfff0c0, a * (1 - p * 0.5));
      glow(overPool, ringTex(), X(f.x), Y(f.y), r * 2.3, r * 2.3, 0xffd089, a);
      if (p < 1) for (let i = 0; i < 4 * b; i++) {
        const t = Math.random() * 6.283;
        spark(X(f.x) + Math.cos(t) * r, Y(f.y) + Math.sin(t) * r, 0xffa030, s * 4, t);
      }
    } else if (f.type === 'roller') {
      const x = f.x + f.dir * p * board.cols;
      const my = f.y + (f.h - 1) / 2;
      put({ t: 'block', kind: 'barrel', w: 1, h: f.h, hp: 1, charge: 0 }, X(x), Y(f.y), 1, 1);
      glow(underPool, softDot(), X(x), Y(my), s * 3, s * (f.h + 1), 0xffc24a, a * 0.6);
      if (p < 1) for (let i = 0; i < 5; i++) spark(X(x), Y(f.y) + Math.random() * s * (f.h - 1), 0xffb347, s * 4);
    } else if (f.type === 'bolts') {
      // Forked lightning to every cell it strikes, jumping about as it goes.
      const reach = Math.min(1, p * 1.6);
      for (const t of f.to || []) {
        let px = X(f.x);
        let py = Y(f.y);
        const dx = X(t.x) - px;
        const dy = Y(t.y) - py;
        const n = 4;
        for (let i = 1; i <= n * reach; i++) {
          const side = i === n ? 0 : (Math.random() - 0.5) * s * 0.9;
          const len0 = Math.hypot(dx, dy) || 1;
          const qx = X(f.x) + (dx * i) / n - (dy / len0) * side;
          const qy = Y(f.y) + (dy * i) / n + (dx / len0) * side;
          const len = Math.hypot(qx - px, qy - py);
          const rot = Math.atan2(qy - py, qx - px);
          glow(overPool, beamTex(), (px + qx) / 2, (py + qy) / 2, len * 1.1, s * 0.5, 0x6ab4ff, a * 0.7, rot);
          glow(overPool, beamTex(), (px + qx) / 2, (py + qy) / 2, len * 1.1, s * 0.14, 0xffffff, a * 0.9, rot);
          px = qx;
          py = qy;
        }
        if (reach === 1) glow(overPool, softDot(), X(t.x), Y(t.y), s * 1.3, s * 1.3, 0xbfe4ff, a * 0.8);
      }
      glow(overPool, softDot(), X(f.x), Y(f.y), s * 2.4, s * 2.4, 0xbfe4ff, a);
    } else if (f.type === 'beams') {
      (f.to || []).forEach((t, i) => {
        const dx = (t.x - f.x) * s * p;
        const dy = (t.y - f.y) * s * p;
        const len = Math.hypot(dx, dy);
        const rot = Math.atan2(dy, dx);
        const col = HUES[i % HUES.length];
        glow(overPool, beamTex(), X(f.x) + dx / 2, Y(f.y) + dy / 2, len, s * 0.62, col, a * 0.75, rot);
        glow(overPool, beamTex(), X(f.x) + dx / 2, Y(f.y) + dy / 2, len, s * 0.14, 0xffffff, a * 0.45, rot);
        glow(overPool, softDot(), X(f.x) + dx, Y(f.y) + dy, s * 1.1, s * 1.1, col, a * 0.8);
      });
      glow(overPool, softDot(), X(f.x), Y(f.y), s * 1.7, s * 1.7, 0xb48cff, a * 0.5);
    }
  }

  // ---- The whole board, once per drawing ----
  function sync() {
    const s = layout.cell;
    const o = overlay || {};
    paintTray();
    paintMeters();
    piecePool.begin();
    underPool.begin();
    overPool.begin();
    if (o.pressed) glow(underPool, softDot(), X(o.pressed.x), Y(o.pressed.y), s * 1.7, s * 1.7, 0xffb300, 0.9).blendMode = 'normal';

    const moving = [];
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        const c = board.cells[y * board.cols + x];
        if (!c || c.t === 'empty' || c.t === 'part') continue;
        const k = keyOf(x, y);
        if (o.hide && o.hide.has(k)) continue;
        const off = o.offsets && o.offsets.get(k);
        if (off) { moving.push([c, x, y, off]); continue; }
        const held = o.pressed && o.pressed.x === x && o.pressed.y === y && (c.t === 'piece' || c.t === 'power');
        put(c, X(x), Y(y), held ? 1.1 : 1, held ? 1.1 : 1);
        if (marked(c)) mark(X(x), Y(y), held ? 1.1 : 1);
      }
    }
    for (const [c, x, y, off] of moving) {
      const sx = off.sx > 0 ? off.sx : 1;
      const sy = off.sy > 0 ? off.sy : 1;
      put(c, X(x + off.dx), Y(y + off.dy) + (s / 2) * (1 - sy), sx, sy); // squashed onto its feet
      if (marked(c)) mark(X(x + off.dx), Y(y + off.dy), 1);
    }
    for (const g of o.ghosts || []) {
      if (!(g.scale > 0.02)) continue;
      const spr = put(g.cell, X(g.x), Y(g.y), g.scale, g.scale);
      if (spr) spr.alpha = Math.min(1, g.scale * 1.5);
    }
    for (const f of o.flashes || []) {
      if (f.alpha > 0.02) glow(overPool, softDot(), X(f.x), Y(f.y), s * 1.5, s * 1.5, 0xffffff, Math.min(1, f.alpha));
    }
    for (const p of o.sprites || []) {
      if (!p || !p.cell || !(p.scale > 0.02)) continue;
      const sx = p.sx === undefined ? 1 : p.sx;
      if (!(Math.abs(sx) > 0.02)) continue;
      put(p.cell, X(p.x), Y(p.y), p.scale * sx, p.scale, p.rot, p.bare);
      if (p.bare) glow(underPool, softDot(), X(p.x), Y(p.y), s * 2, s * 2, 0xffc24a, 0.7);
      if (p.flash > 0.02) glow(overPool, softDot(), X(p.x), Y(p.y), s * 1.3, s * 1.3, 0xffffff, Math.min(1, p.flash));
    }
    dimNow = 0;
    for (const f of o.fx || []) {
      if (!f || !(f.alpha > 0.02)) continue;
      dimNow = Math.max(dimNow, Math.min(1, f.alpha) * DIM);
      drawEffect(f);
    }
    piecePool.end();
    underPool.end();
    overPool.end();
  }

  // ---- Loose bits: shards, sparks, glints ----
  const loose = [];
  const spare = [];
  function bit(tex, x, y, size, color, o) {
    if (loose.length >= MAX_PARTICLES || reduced()) return;
    const s = spare.pop() || new PIXI.Sprite();
    (o.below ? trails : bits).addChild(s);
    s.texture = tex;
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set(size / tex.width);
    s.rotation = o.spin ? Math.random() * 6.283 : 0;
    s.tint = color;
    s.blendMode = o.add ? 'add' : 'normal';
    s.alpha = 1;
    s.visible = true;
    loose.push({
      s, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, spin: o.spin || 0,
      age: 0, life: o.life, base: size / tex.width, grow: o.grow || 0, twinkle: o.twinkle,
    });
  }
  function spark(x, y, color, v, dir) {
    const t = dir === undefined ? Math.random() * 6.283 : dir + Math.random() - 0.5;
    const sp = v * (0.3 + Math.random());
    bit(softDot(), x, y, layout.cell * (0.12 + Math.random() * 0.16), color,
      { vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, life: 0.25 + Math.random() * 0.3, add: true });
  }
  function colorOf(cell) {
    if (cell.t === 'piece' && theme.pieces[cell.color]) return parseInt(theme.pieces[cell.color].color.slice(1), 16);
    if (cell.t === 'power') return 0xffc43d;
    return PROP_COLORS[cell.kind] || 0xb8c0cf;
  }
  // Something broke at cell (x, y).
  function burst(x, y, cell) {
    if (!layout || !live) return;
    const s = layout.cell;
    const col = colorOf(cell);
    const px = X(x + (cell.w > 1 ? (cell.w - 1) / 2 : 0));
    const py = Y(y + (cell.h > 1 ? (cell.h - 1) / 2 : 0));
    const n = cell.t === 'piece' ? SHARDS : SHARDS + 5;
    for (let i = 0; i < n; i++) {
      const t = Math.random() * 6.283;
      const v = s * (1.6 + Math.random() * 3.6);
      bit(shardTex(i), px + Math.cos(t) * s * 0.15, py + Math.sin(t) * s * 0.15, s * (0.14 + Math.random() * 0.2), col, {
        vx: Math.cos(t) * v, vy: Math.sin(t) * v - s * 1.6, g: s * 13,
        spin: (Math.random() - 0.5) * 16, life: 0.45 + Math.random() * 0.3,
      });
    }
    bit(ringTex(), px, py, s * 0.5, col, { life: 0.28, grow: 4 });
    bit(softDot(), px, py, s * 1.5, 0xffffff, { life: 0.16, add: true });
    for (let i = 0; i < 2; i++) {
      bit(glintTex(), px + (Math.random() - 0.5) * s, py + (Math.random() - 0.5) * s, s * 0.34, 0xffffff,
        { life: 0.35 + Math.random() * 0.25, twinkle: true });
    }
  }
  // A Ninja Star passing (x, y), in fractions of a cell.
  function trail(x, y) {
    if (!layout || !live) return;
    const s = layout.cell;
    bit(softDot(), X(x), Y(y), s * 0.65, 0xff9a1f, { life: 0.4, grow: -0.8, below: true });
    if (Math.random() < 0.6) {
      bit(glintTex(), X(x) + (Math.random() - 0.5) * s * 0.5, Y(y) + (Math.random() - 0.5) * s * 0.5, s * 0.3, 0xfff3c4,
        { life: 0.4, twinkle: true, vy: s * 0.5, below: true });
    }
  }
  // A new power-up appeared.
  function born(x, y) {
    if (!layout || !live) return;
    const s = layout.cell;
    bit(ringTex(), X(x), Y(y), s * 0.4, 0xffb300, { life: 0.42, grow: 5 });
    for (let i = 0; i < 10; i++) spark(X(x), Y(y), 0xffc94d, s * 3.2);
  }
  // Paint lands on cell `to` (from a keg, or spreading there).
  function splash(from, to, color = 0x6a2ce0) {
    if (!layout || !live) return;
    const s = layout.cell;
    if (from) {
      for (let i = 0; i < 5; i++) {
        const life = 0.36 + i * 0.03;
        bit(softDot(), X(from.x), Y(from.y), s * (0.8 - i * 0.1), color,
          { vx: (X(to.x) - X(from.x)) / life, vy: (Y(to.y) - Y(from.y)) / life, life });
      }
    }
    for (let i = 0; i < 7; i++) {
      const t = Math.random() * 6.283;
      bit(softDot(), X(to.x), Y(to.y), s * (0.16 + Math.random() * 0.22), color,
        { vx: Math.cos(t) * s * 2.4, vy: Math.sin(t) * s * 2.4 - s, g: s * 8, life: 0.4 + Math.random() * 0.25 });
    }
  }
  fx.splash = splash;
  fx.burst = burst;
  fx.trail = trail;
  fx.spark = born;

  // ---- The clock: moves the loose bits and paints when something changed ----
  let last = 0;
  let nextGlint = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!live || !layout || !board) return;
    if (now > nextGlint && !reduced()) {
      nextGlint = now + IDLE_SPARKLE_MS * (0.6 + Math.random());
      const i = Math.floor(Math.random() * board.cells.length);
      const c = board.cells[i];
      if (c && (c.t === 'piece' || c.t === 'power')) {
        const s = layout.cell;
        bit(glintTex(), X(i % board.cols) - s * 0.18, Y(Math.floor(i / board.cols)) - s * 0.2, s * 0.42, 0xffffff,
          { life: 0.5, twinkle: true });
      }
    }
    for (let i = loose.length - 1; i >= 0; i--) {
      const p = loose[i];
      p.age += dt;
      const u = p.age / p.life;
      if (u >= 1) {
        p.s.visible = false;
        spare.push(p.s);
        loose[i] = loose[loose.length - 1];
        loose.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      if (p.twinkle) {
        const k = Math.sin(Math.PI * u);
        p.s.scale.set(p.base * (0.2 + k));
        p.s.alpha = k;
      } else {
        p.s.scale.set(Math.max(0.0001, p.base * (1 + p.grow * u)));
        p.s.alpha = u < 0.5 ? 1 : 2 - 2 * u;
      }
    }
    if (dim.alpha < dimNow) dim.alpha = Math.min(dimNow, dim.alpha + dt * 6);
    else dim.alpha = Math.max(dimNow, dim.alpha - dt * 2.2);
    const more = loose.length > 0 || Math.abs(dim.alpha - dimNow) > 0.001;
    if (dirty || more || redrawNext) {
      redrawNext = more; // one more after the last bit, to wipe it
      dirty = false;
      renderer.render(root);
    }
  }
  requestAnimationFrame(tick);

  return {
    // The canvas changed size. Returns its size on the page.
    fit() {
      dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      renderer.resize(w, h, dpr);
      clearCache();
      trayKey = '';
      return { w, h };
    },
    draw(b, newLayout, o) {
      if (layout && layout.cell !== newLayout.cell) clearCache();
      layout = newLayout;
      board = b;
      overlay = o;
      sync();
      dirty = true;
    },
    // { colors: [piece colors], powers: [power-up kinds] } or null for none.
    setMarkers(m) {
      markers = m && (m.colors.length || m.powers.length) ? { colors: m.colors.slice(), powers: m.powers.slice() } : null;
      dirty = true;
    },
    show(on) {
      live = on;
      dirty = true;
      if (on) return;
      for (const p of loose) { p.s.visible = false; spare.push(p.s); }
      loose.length = 0;
    },
  };
}
