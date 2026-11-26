// SAVE THE VIOLINIST: the rescue episode's own screen (rules in
// meta/rescue.js, numbers and words in config/rescue.js).
//
// A stage scene is drawn on top: the Violinist on her chair, and the danger
// creeping toward her (the pit flooding, the curtain burning, the sandbag
// rig fraying, a trapdoor opening). Underneath is a small board played with
// the real engine (engine/game.js) and drawn with the real board drawing
// (ui/render.js) and animations (ui/anim.js), so matches, power-ups and chain
// reactions work exactly as on a level.
//
//   maybeOfferRescue({ getSave, persist, onChange })
//       call after a level is won; opens the episode a moment later if one
//       is due (meta/rescue.js rescueDue). Returns true if one is coming.
//   openRescue({ getSave, persist, onChange })
//       opens the episode now.
//   getSave()  the save object (save.rescue and save.coins are changed in it)
//   persist()  writes the save to storage
//   onChange() optional: called after coins were paid (to redraw Home)
//
// Nothing here costs a life or coins. Closing it (Back or Skip) is free.
import { theme } from '../../config/theme.js';
import { RESCUE } from '../../config/rescue.js';
import {
  rescueDue, episodeFor, episodeAt, sceneOf, rescueLevel, startRun, afterMove, tick, left, ropesLeft,
  markOffered, recordResult,
} from '../../meta/rescue.js';
import { newGame, actSteps } from '../../engine/game.js';
import { cloneBoard, get } from '../../engine/board.js';
import { drawBoard, drawPiece } from '../render.js';
import { playEvents, playSwap } from '../anim.js';
import { gestureToAction, EARLY_COMMIT } from '../input.js';
import { fx } from '../fx.js';
import {
  openGame, panel, bigText, ribbon, coin, burst, sparks, floaters, rays, backdrop, rr, ease, clamp01, lerp, TAU, GAME_FONT,
} from './kit.js';

// ---- Settings for the look (the rules' numbers are in config/rescue.js) ----
const MAX_CELL = 52;        // board cells never bigger than this
const BOARD_SHARE = 0.52;   // most of the screen height the board may take
const MAX_BITS = 140;       // most sparks / drops / confetti at once (phones)
const MAX_FLYERS = 18;      // most gems flying to the bucket at once
const SWAP_MS = 80;

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// The board drawn with a see-through background, so the stage shows round it.
const boardTheme = { ...theme, ui: { ...theme.ui, background: 'rgba(0,0,0,0)' } };

// ---- Offering it ----

let offerTimer = 0;
export function maybeOfferRescue(api, cfg = RESCUE) {
  if (!rescueDue(api.getSave(), cfg)) return false;
  clearTimeout(offerTimer);
  let waited = 0;
  // Open once Home is showing with nothing else on top of it.
  const tryOpen = () => {
    const home = document.getElementById('screen-home');
    const busy = document.querySelector('.mg, .overlay:not([hidden]), .help-card:not([hidden])');
    if (home && !home.hidden && !busy) { openRescue(api, cfg); return; }
    waited += 1000;
    if (waited < 120000 && rescueDue(api.getSave(), cfg)) offerTimer = setTimeout(tryOpen, 1000);
  };
  offerTimer = setTimeout(tryOpen, cfg.offerDelayMs || 0);
  return true;
}

// ---- The screen ----

export function openRescue(api, cfg = RESCUE) {
  const save0 = api.getSave();
  const T = cfg.text;
  // Mark it offered straight away: skipping it now means it is gone.
  save0.rescue = markOffered(save0.rescue, save0);
  api.persist();

  let ep = episodeFor(save0, cfg);
  const scene = sceneOf(ep, cfg);
  const goal = scene.goal;
  const g = openGame({ title: T.title, top: '#2a0c4a', bottom: '#0c0420', onClose: () => restoreFx() });

  // ---- State ----
  let game = null;          // the engine's game
  let run = null;           // meta/rescue.js run
  let view = { board: null, overlay: null }; // what the board shows right now
  let busy = false;         // a move is being played
  let phase = 'intro';      // 'intro' | 'play' | 'won' | 'lost'
  let phaseAge = 0;         // seconds in this phase
  let shownHave = 0;        // the bucket count as shown (gems arrive one by one)
  let liveDanger = null;    // the danger shown during a move (null = run.danger)
  let shownDanger = 0;      // eased toward the real danger each frame
  let pressed = null;
  let paid = 0;             // coins paid for this win
  let lastRopes = scene.ropes || 0;
  let bubbleAt = 0;         // when the "Help me!" bubble last showed
  const bits = [];          // sparks, drops, confetti, smoke (kit.sparks)
  const smoke = [];         // soft puffs: { x, y, r, age, life, vx, vy }
  const flyers = [];        // gems flying up to the bucket
  const words = [];         // kit.floaters
  const roses = [];         // thrown flowers: { x0, y0, x1, y1, age, delay, spin }
  let L = null;             // layout

  function newTry(tryNo) {
    ep = episodeAt(ep.index, cfg, tryNo);
    game = newGame(rescueLevel(ep, cfg), ep.seed);
    run = startRun(ep, cfg);
    view = { board: cloneBoard(game.board), overlay: null };
    shownHave = 0;
    liveDanger = null;
    shownDanger = 0;
    lastRopes = scene.ropes || 0;
    flyers.length = 0;
    roses.length = 0;
    smoke.length = 0;
  }
  newTry(0);

  // ---- The engine's animations announce gems popping (ui/fx.js). While this
  // screen is open, they come here instead of the level screen. ----
  const saved = { ...fx };
  for (const k of Object.keys(fx)) fx[k] = null;
  fx.collect = (x, y, cell) => {
    if (!cell || cell.t !== 'piece' || phase !== 'play') return;
    if (goal.color !== undefined && cell.color !== goal.color) return;
    if (!L || flyers.length >= MAX_FLYERS) { bumpHave(); return; }
    const c = L.layout.cell;
    flyers.push({ x0: L.layout.originX + (x + 0.5) * c, y0: L.layout.originY + (y + 0.5) * c, color: cell.color, age: 0, delay: Math.random() * 0.12 });
  };
  fx.burst = (x, y, cell) => {
    if (!L || bits.length > MAX_BITS || !cell || cell.t !== 'piece') return;
    const c = L.layout.cell;
    const tint = (theme.pieces[cell.color] || {}).color || '#fff';
    burst(bits, L.layout.originX + (x + 0.5) * c, L.layout.originY + (y + 0.5) * c, { n: reduced() ? 2 : 5, colors: [tint, '#ffffff'], speed: 150, size: 3.2, life: 0.45, kind: 'chip' });
  };
  function restoreFx() {
    clearTimeout(offerTimer);
    Object.assign(fx, saved);
  }
  function bumpHave() {
    const before = shownHave;
    shownHave = Math.min(run.need, shownHave + 1);
    if (shownHave > before && liveDanger !== null) liveDanger = Math.max(0, liveDanger - scene.pushBack);
  }

  // ---- Layout ----
  function lay() {
    const W = g.w, H = g.h;
    const { cols, rows } = game.board;
    const cell = Math.max(22, Math.min(MAX_CELL, Math.floor((W - 20) / cols), Math.floor((H * BOARD_SHARE - 10) / rows)));
    const bw = cell * cols, bh = cell * rows;
    const ox = Math.round((W - bw) / 2);
    const oy = Math.round(H - bh - 10);
    const hudH = 42;
    const hud = { x: Math.max(8, ox - 4), y: oy - hudH - 12, w: Math.min(W - 16, bw + 8), h: hudH };
    const sceneR = { x: 0, y: 0, w: W, h: Math.max(90, hud.y - 6) };
    L = { layout: { originX: ox, originY: oy, cell, cols, rows, canvasW: W, canvasH: H }, hud, scene: sceneR };
  }
  g.onResize = () => { if (game) lay(); };
  lay();

  // ---- Buttons ----
  function setPhase(p) {
    phase = p;
    phaseAge = 0;
    if (p === 'intro') {
      g.note(T.costsNothing);
      g.buttons([
        { text: T.start, cls: 'primary', onClick: () => setPhase('play') },
        { text: T.skip, onClick: () => g.close() },
      ]);
    } else if (p === 'play') {
      g.note(scene.ask);
      g.buttons([{ text: T.skip, onClick: () => g.close() }]);
    } else if (p === 'won') {
      g.note(scene.won);
      g.buttons([]);
      setTimeout(() => {
        if (g.closed || phase !== 'won') return;
        g.buttons([{ text: paid > 0 ? `${T.collect} ${paid}` : T.collect, cls: 'primary', onClick: () => g.close() }]);
      }, 2400);
    } else if (p === 'lost') {
      g.note(scene.lost);
      g.buttons([]);
      setTimeout(() => {
        if (g.closed || phase !== 'lost') return;
        g.buttons([
          { text: T.again, cls: 'primary', onClick: () => { newTry(ep.try + 1); setPhase('play'); } },
          { text: T.skip, onClick: () => g.close() },
        ]);
      }, 1600);
    }
  }
  setPhase('intro');
  g.chip(String(cfg.prizeCoins), (c, x, y, s) => coin(c, x, y, s * 0.42));

  // ---- Playing a move ----
  const drawFrame = (board, overlay) => { if (board) view = { board, overlay: overlay || null }; };

  async function doMove(action) {
    if (busy || phase !== 'play' || !action) return;
    const before = cloneBoard(game.board);
    const steps = actSteps(game, action);
    let r = steps.next();
    if (r.done || !r.value.events.length || r.value.events[0].type === 'invalid') {
      // Not a move. It costs nothing: the two gems slide over and back.
      if (action.type === 'swap') {
        const ok = (p) => { const c = get(before, p.x, p.y); return c && (c.t === 'piece' || c.t === 'power'); };
        if (ok(action.a) && ok(action.b)) {
          busy = true;
          try { await playSwap(before, action.a, action.b, drawFrame, SWAP_MS, true); } finally { busy = false; }
          drawFrame(cloneBoard(game.board));
        }
      }
      return;
    }
    busy = true;
    pressed = null;
    liveDanger = clamp01(run.danger + (scene.clock === 'moves' ? 1 / scene.limit : 0));
    try {
      if (action.type === 'swap') await playSwap(before, action.a, action.b, drawFrame, SWAP_MS, false);
      let was = before;
      while (!r.done) {
        await playEvents(r.value.events, drawFrame, theme, 'normal', was);
        was = cloneBoard(game.board);
        r = steps.next();
        if (g.closed) return;
      }
    } catch (err) {
      console.error(err);
    }
    drawFrame(cloneBoard(game.board));
    run = afterMove(run, game.tally.cleared, cfg);
    shownHave = run.have;
    liveDanger = null;
    busy = false;
    if (run.status === 'won') win();
    else if (run.status === 'lost') lose();
  }

  function finish(won) {
    const save = api.getSave();
    const res = recordResult(save.rescue, ep, won, cfg);
    save.rescue = res.state;
    if (res.coins > 0) save.coins = (save.coins || 0) + res.coins;
    api.persist();
    if (res.coins > 0 && api.onChange) { try { api.onChange(); } catch (e) { console.error(e); } }
    return res.coins;
  }
  function win() {
    paid = finish(true);
    setPhase('won');
  }
  function lose() {
    finish(false);
    setPhase('lost');
  }

  // ---- Touch ----
  let start = null;
  g.onDrag = {
    start(x, y) {
      if (busy || phase !== 'play') { start = null; return; }
      start = { px: x, py: y };
      const lo = L.layout;
      const cx = Math.floor((x - lo.originX) / lo.cell), cy = Math.floor((y - lo.originY) / lo.cell);
      pressed = cx >= 0 && cy >= 0 && cx < lo.cols && cy < lo.rows && get(view.board, cx, cy) ? { x: cx, y: cy } : null;
    },
    move(x, y) {
      if (!start) return;
      const reach = Math.max(Math.abs(x - start.px), Math.abs(y - start.py)) / L.layout.cell;
      if (reach < EARLY_COMMIT) return;
      const action = gestureToAction(start, { px: x, py: y }, L.layout, view.board);
      start = null;
      pressed = null;
      doMove(action);
    },
    end(x, y) {
      if (!start) { pressed = null; return; }
      const action = gestureToAction(start, { px: x, py: y }, L.layout, view.board);
      start = null;
      pressed = null;
      doMove(action);
    },
    cancel() { start = null; pressed = null; },
  };

  // ---- Every frame ----
  g.draw = (ctx, dt, t) => {
    if (!L) lay();
    phaseAge += dt;
    if (phase === 'play' && !busy) {
      run = tick(run, dt, cfg);
      if (run.status === 'lost') lose();
    }
    const real = liveDanger !== null ? liveDanger : run.danger;
    const target = phase === 'intro' ? 0.12 : real;
    shownDanger += (target - shownDanger) * Math.min(1, dt * 5);

    backdrop(ctx, g.w, g.h, '#2a0c4a', '#0c0420');
    drawScene(ctx, t, dt);
    drawHud(ctx, t);
    // The board.
    const overlay = { ...(view.overlay || {}) };
    if (pressed) overlay.pressed = pressed;
    drawBoard(ctx, view.board, L.layout, boardTheme, overlay);
    if (phase === 'intro') drawIntroCard(ctx, t);
    sparks(ctx, bits, dt);
    drawFlyers(ctx, dt);
    floaters(ctx, words, dt);
  };

  // ---- The bucket and the danger count ----
  function bucketAt() {
    const h = L.hud;
    return { x: h.x + 26, y: h.y + h.h / 2 };
  }
  function drawHud(ctx, t) {
    const h = L.hud;
    panel(ctx, h.x, h.y, h.w, h.h, 12, ['#4a1a8a', '#22084e']);
    const b = bucketAt();
    bucket(ctx, b.x, b.y + 2, 30, goal);
    // The meter.
    const mx = h.x + 48, mw = Math.max(40, h.w * 0.46), my = h.y + h.h / 2 - 7;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    rr(ctx, mx, my, mw, 14, 7);
    ctx.fill();
    const p = clamp01(shownHave / run.need);
    if (p > 0) {
      const gr = ctx.createLinearGradient(0, my, 0, my + 14);
      gr.addColorStop(0, '#9af0ff');
      gr.addColorStop(1, '#1a8ad8');
      ctx.fillStyle = gr;
      rr(ctx, mx, my, Math.max(14, mw * p), 14, 7);
      ctx.fill();
    }
    bigText(ctx, `${shownHave}/${run.need}`, mx + mw / 2, my + 7, 15);
    // Moves or time left.
    const n = phase === 'intro' ? scene.limit : phase === 'lost' ? 0 : left({ ...run, danger: liveDanger !== null ? liveDanger : run.danger }, cfg);
    const timed = scene.clock === 'seconds';
    const label = timed ? T.time : T.moves;
    const val = timed ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : String(n);
    const low = timed ? n <= 10 : n <= 3;
    const rx = h.x + h.w - 12;
    ctx.save();
    ctx.font = `13px ${GAME_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(label, rx, h.y + 13);
    ctx.restore();
    const pulse = low && phase === 'play' ? 1 + 0.12 * Math.sin(t * 10) : 1;
    bigText(ctx, val, rx, h.y + h.h / 2 + 7, 20 * pulse, low ? '#ff8a8a' : '#fff', low ? '#5a0010' : '#2a0a5e', 'right');
  }

  function drawFlyers(ctx, dt) {
    const b = bucketAt();
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.age += dt;
      const k = clamp01((f.age - f.delay) / 0.45);
      if (k >= 1) { flyers.splice(i, 1); bumpHave(); continue; }
      const e = ease.inOut(k);
      const x = lerp(f.x0, b.x, e);
      const y = lerp(f.y0, b.y, e) - Math.sin(e * Math.PI) * 50;
      const s = lerp(L.layout.cell * 0.7, 18, e);
      drawPiece(ctx, f.color, x, y, s, theme);
    }
  }

  function drawIntroCard(ctx, t) {
    const lo = L.layout;
    const bw = lo.cell * lo.cols, bh = lo.cell * lo.rows;
    ctx.fillStyle = 'rgba(10,2,30,.55)';
    rr(ctx, lo.originX - 4, lo.originY - 4, bw + 8, bh + 8, 14);
    ctx.fill();
    const w = Math.min(bw - 16, 320), h = 150;
    const x = lo.originX + (bw - w) / 2, y = lo.originY + (bh - h) / 2;
    panel(ctx, x, y, w, h, 18, ['#ff5a8a', '#8a0a4a']);
    bigText(ctx, scene.title, x + w / 2, y + 26, 20);
    // The goal: the gem (or a bucket of any color) x need.
    const gy = y + 74;
    if (goal.color !== undefined) drawPiece(ctx, goal.color, x + w / 2 - 34, gy, 40, theme);
    else bucket(ctx, x + w / 2 - 34, gy, 40, goal);
    bigText(ctx, '× ' + goal.need, x + w / 2 + 22, gy, 26);
    ctx.save();
    ctx.font = `14px ${GAME_FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    wrap(ctx, scene.ask, x + w / 2, y + 116, w - 24, 17);
    ctx.restore();
  }

  // ---- The stage ----
  function drawScene(ctx, t, dt) {
    const R = L.scene;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    const u = Math.max(0.6, Math.min((R.h - 52) / 170, R.w / 150)); // one unit; she is about 120 units tall
    const floorY = R.y + R.h - 14 * u;
    const herX = R.x + R.w * 0.5;
    const S = { R, u, floorY, herX, t, dt, d: shownDanger, age: phaseAge, phase };
    if (ep.sceneId === 'flood') flood(ctx, S);
    else if (ep.sceneId === 'fire') fire(ctx, S);
    else if (ep.sceneId === 'sandbags') sandbags(ctx, S);
    else trapdoor(ctx, S);
    drawSmoke(ctx, dt);
    if (phase === 'won') winExtras(ctx, S);
    // The title ribbon, and the cry for help.
    if (phase === 'won') ribbon(ctx, T.saved, R.x + R.w / 2, R.y + 24, Math.min(R.w - 60, 200), 32, ['#ffd23a', '#d08a00']);
    else if (phase === 'lost') ribbon(ctx, T.oops, R.x + R.w / 2, R.y + 24, Math.min(R.w - 60, 200), 32);
    else ribbon(ctx, scene.title, R.x + R.w / 2, R.y + 24, Math.min(R.w - 60, 300), 30);
    if (phase === 'play' && shownDanger > 0.45) {
      if (t - bubbleAt > 5) bubbleAt = t;
      if (t - bubbleAt < 1.8) bubble(ctx, herX + 30 * u, floorY - (S.standY || 0) - 104 * u, u, T.help, t);
    }
    ctx.restore();
  }

  // Win: flowers thrown on, confetti, and the bow.
  function winExtras(ctx, S) {
    const { R, u, floorY, herX } = S;
    if (S.age > 1 && roses.length === 0) {
      for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1;
        roses.push({ x0: herX + side * R.w * 0.6, y0: floorY + 20 * u, x1: herX + side * (16 + i * 7) * u, y1: floorY - (i % 3) * 3 * u, age: 0, delay: i * 0.16, spin: Math.random() * TAU });
      }
      if (bits.length < MAX_BITS) {
        burst(bits, herX - R.w * 0.3, R.y + 30, { n: reduced() ? 8 : 26, colors: ['#ff4f7a', '#ffd23a', '#3aa8ff', '#5ad46a', '#c86aff'], speed: 260, size: 4, gravity: 300, life: 1.8, kind: 'chip' });
        burst(bits, herX + R.w * 0.3, R.y + 30, { n: reduced() ? 8 : 26, colors: ['#ff4f7a', '#ffd23a', '#3aa8ff', '#5ad46a', '#c86aff'], speed: 260, size: 4, gravity: 300, life: 1.8, kind: 'chip' });
      }
    }
    for (const r of roses) {
      r.age += S.dt;
      const k = clamp01((r.age - r.delay) / 0.7);
      if (k <= 0) continue;
      const x = lerp(r.x0, r.x1, k);
      const y = lerp(r.y0, r.y1, k) - Math.sin(k * Math.PI) * 70 * u;
      rose(ctx, x, y, u, r.spin + k * 6);
    }
    if (S.age > 2.2) {
      // The prize.
      const w = 118, h = 44, x = R.x + 10, y = R.y + 48;
      ctx.globalAlpha = clamp01((S.age - 2.2) * 3);
      panel(ctx, x, y, w, h, 14, ['#fff6c0', '#ffc21c']);
      if (paid > 0) {
        coin(ctx, x + 26, y + h / 2, 14);
        bigText(ctx, '+' + paid, x + w / 2 + 14, y + h / 2 + 1, 24, '#fff', '#7a3c00');
      } else bigText(ctx, 'Bravo!', x + w / 2, y + h / 2 + 1, 22, '#fff', '#7a3c00');
      ctx.globalAlpha = 1;
    }
  }

  // ---- Soft smoke and steam ----
  function puff(x, y, r, n = 4, color = '200,200,210') {
    for (let i = 0; i < n && smoke.length < 40; i++) {
      smoke.push({ x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r * 0.6, r: r * (0.4 + Math.random() * 0.4), vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, age: 0, life: 0.9 + Math.random() * 0.6, color });
    }
  }
  function drawSmoke(ctx, dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.age += dt;
      if (p.age > p.life) { smoke.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.age / p.life;
      ctx.fillStyle = `rgba(${p.color},${0.55 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + k * 1.2), 0, TAU);
      ctx.fill();
    }
  }

  // The mood from the danger: calm, worried, then panicking.
  const moodOf = (d, worry = 0.35, panic = 0.62) => (d < worry ? 'calm' : d < panic ? 'worried' : 'panic');

  // The common bit of every win: she stands and bows (after the danger is gone).
  function winPose(S, sitBase) {
    const a = S.age;
    if (a < 1) return { ...sitBase, face: 'happy' };
    const bowT = a - 1.2;
    const bowAmt = bowT > 0 ? Math.max(0, Math.sin(Math.min(bowT, 3) * 2.2)) : 0;
    return { sit: 0, arms: bowT > 0 ? 'out' : 'up', face: 'happy', bow: bowAmt, hop: a < 1.3 ? Math.sin(((a - 1) / 0.3) * Math.PI) * 6 : 0 };
  }

  // ===== SCENE 1: THE ORCHESTRA PIT FLOODING =====
  function flood(ctx, S) {
    const { R, u, floorY, herX, t } = S;
    // The pit's back wall: dark wood panels, with the stage lip and its
    // footlights along the top.
    const wall = ctx.createLinearGradient(0, R.y, 0, floorY);
    wall.addColorStop(0, '#3a1a10');
    wall.addColorStop(1, '#1e0c08');
    ctx.fillStyle = wall;
    ctx.fillRect(R.x, R.y, R.w, floorY - R.y);
    ctx.strokeStyle = 'rgba(255,200,140,.08)';
    ctx.lineWidth = 2;
    for (let x = R.x + 30 * u; x < R.x + R.w; x += 46 * u) { ctx.beginPath(); ctx.moveTo(x, R.y + 52 * u); ctx.lineTo(x, floorY); ctx.stroke(); }
    ctx.fillStyle = '#5a2a14';
    ctx.fillRect(R.x, R.y + 40 * u, R.w, 12 * u);
    for (let x = R.x + 16 * u; x < R.x + R.w; x += 34 * u) {
      const gl = ctx.createRadialGradient(x, R.y + 46 * u, 0, x, R.y + 46 * u, 16 * u);
      gl.addColorStop(0, 'rgba(255,230,150,.9)');
      gl.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 16 * u, R.y + 30 * u, 32 * u, 32 * u);
    }
    floorBoards(ctx, R, floorY, u, '#4a2a18');
    // A music stand beside her.
    musicStand(ctx, herX - 52 * u, floorY, u, t);

    const d = S.d;
    const maxRise = 135 * u;
    let level = d * maxRise;
    let pose;
    if (S.phase === 'lost') {
      level = maxRise * (1 - ease.out(clamp01(S.age / 0.9)));
      pose = { sit: 1, arms: 'play', face: 'soggy', hair: 'wet', still: true };
      if (S.age > 0.5 && S.age < 3 && Math.random() < 0.25 && bits.length < MAX_BITS) {
        bits.push({ x: herX + (Math.random() - 0.5) * 24 * u, y: floorY - 105 * u, vx: 0, vy: 20, g: 400, life: 0.6, age: 0, size: 2.2 * u, color: '#7ac8ff', kind: 'spark', spin: 0 });
      }
    } else if (S.phase === 'won') {
      level = d * maxRise * (1 - ease.out(clamp01(S.age / 0.9)));
      pose = winPose(S, { sit: 1, arms: 'play', face: 'happy' });
    } else {
      // (she climbs up on her chair before the water reaches her chin)
      const mood = moodOf(d, 0.28, 0.5);
      pose = mood === 'panic'
        ? { sit: 0, onChair: 1, arms: 'up', face: 'scared', shake: 1.5 }
        : { sit: 1, arms: 'play', face: mood === 'calm' ? 'calm' : 'worried' };
    }
    S.standY = pose.onChair ? 30 * u : 0;
    violinist(ctx, herX, floorY, u, t, pose);
    if (S.phase === 'lost' && S.age > 0.8) fish(ctx, herX + 2 * u, floorY - 118 * u, u, t);
    // The water, in front of everything.
    if (level > 1) {
      const top = floorY - level;
      ctx.beginPath();
      ctx.moveTo(R.x, R.y + R.h);
      for (let x = R.x; x <= R.x + R.w + 8; x += 8) {
        ctx.lineTo(x, top + Math.sin(x * 0.045 / u + t * 2.2) * 3 * u + Math.sin(x * 0.11 / u - t * 3.1) * 1.5 * u);
      }
      ctx.lineTo(R.x + R.w, R.y + R.h);
      ctx.closePath();
      const wg = ctx.createLinearGradient(0, top, 0, R.y + R.h);
      wg.addColorStop(0, 'rgba(70,170,255,.72)');
      wg.addColorStop(1, 'rgba(20,70,170,.85)');
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Bubbles, and a rubber duck that has wandered in.
      ctx.fillStyle = 'rgba(220,245,255,.5)';
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.4 + i * 0.37) % 1;
        const bx = R.x + R.w * ((i * 0.173 + 0.1) % 1);
        const by = lerp(R.y + R.h, top + 6 * u, k);
        if (by > top + 4 * u) { ctx.beginPath(); ctx.arc(bx + Math.sin(t * 3 + i) * 3, by, (1.5 + (i % 3)) * u, 0, TAU); ctx.fill(); }
      }
      duck(ctx, herX + 64 * u + Math.sin(t * 0.7) * 10 * u, top + Math.sin(herX * 0.045 / u + t * 2.2) * 3 * u, u, t);
    }
  }

  // ===== SCENE 2: THE CURTAIN ON FIRE =====
  function fire(ctx, S) {
    const { R, u, floorY, herX, t } = S;
    // A soft back wall and the floor.
    const wall = ctx.createLinearGradient(0, R.y, 0, floorY);
    wall.addColorStop(0, '#2a0a30');
    wall.addColorStop(1, '#14041a');
    ctx.fillStyle = wall;
    ctx.fillRect(R.x, R.y, R.w, floorY - R.y);
    floorBoards(ctx, R, floorY, u, '#5a3420');
    spotlight(ctx, herX, R.y, floorY, u);
    // The drapes and the valance across the top.
    const dw = Math.max(30 * u, R.w * 0.18);
    drape(ctx, R.x, R.y, dw, floorY - R.y, 1, t);
    drape(ctx, R.x + R.w - dw, R.y, dw, floorY - R.y, -1, t);
    const vH = 30 * u, vY = R.y + 44 + 14 * u; // (below the title ribbon)
    ctx.fillStyle = '#a0122c';
    ctx.fillRect(R.x, R.y, R.w, vY - R.y);
    ctx.beginPath();
    ctx.moveTo(R.x, vY);
    for (let x = R.x; x <= R.x + R.w; x += 24 * u) ctx.quadraticCurveTo(x + 12 * u, vY + vH * 0.5, x + 24 * u, vY);
    ctx.lineTo(R.x + R.w, R.y);
    ctx.lineTo(R.x, R.y);
    ctx.fill();
    ctx.strokeStyle = '#ffc21a';
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(R.x, vY);
    for (let x = R.x; x <= R.x + R.w; x += 24 * u) ctx.quadraticCurveTo(x + 12 * u, vY + vH * 0.5, x + 24 * u, vY);
    ctx.stroke();
    // A tassel cord hanging over her head.
    const cordTop = vY + 6 * u, cordEnd = floorY - 136 * u;
    ctx.strokeStyle = '#ffc21a';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(herX, cordTop);
    ctx.lineTo(herX + Math.sin(t * 1.3) * 2 * u, cordEnd);
    ctx.stroke();
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath();
    ctx.moveTo(herX - 4 * u, cordEnd + 8 * u);
    ctx.lineTo(herX + 4 * u, cordEnd + 8 * u);
    ctx.lineTo(herX, cordEnd - 2 * u);
    ctx.fill();

    let d = S.d;
    let scale = 1;
    let pose;
    if (S.phase === 'won') {
      scale = 1 - clamp01(S.age / 0.8);
      if (S.age < 0.8 && Math.random() < 0.5) puff(R.x + Math.random() * R.w * d * 0.8, vY, 14 * u, 1, '230,240,255');
      if (S.age < 0.6 && bits.length < MAX_BITS && Math.random() < 0.6) burst(bits, R.x + Math.random() * R.w * 0.8, R.y + 10, { n: 3, colors: ['#9ad8ff', '#ffffff'], speed: 80, size: 3, gravity: 500, life: 0.7 });
      pose = winPose(S, { sit: 1, arms: 'play', face: 'happy' });
    } else if (S.phase === 'lost') {
      if (S.age < 0.05 && smoke.length < 10) puff(herX, floorY - 112 * u, 26 * u, 8);
      else if (Math.random() < 0.06) puff(herX + (Math.random() - 0.5) * 20 * u, floorY - 124 * u, 5 * u, 1, '120,115,120'); // still smoking a little
      scale = 1 - clamp01(S.age / 0.5);
      d = 1;
      pose = { sit: 1, arms: 'play', face: 'soot', hair: 'frizz', still: true };
    } else {
      const mood = moodOf(d);
      pose = mood === 'panic'
        ? { sit: 1, arms: 'up', face: 'scared', shake: 1.5 }
        : { sit: 1, arms: 'play', face: mood === 'calm' ? 'calm' : 'worried' };
    }
    if (scale > 0.01) {
      // Flames up the left drape, then along the valance toward her.
      const reach = R.x + (herX - R.x) * Math.min(1, d * 1.25);
      const burnTop = floorY - (floorY - vY) * Math.min(1, 0.25 + d * 3);
      for (let y = floorY - 20 * u; y > Math.max(vY, burnTop); y -= 22 * u) {
        flame(ctx, R.x + dw * 0.5 + Math.sin(y) * 6 * u, y, 24 * u * scale, t, y);
      }
      for (let x = R.x + 8 * u; x < reach; x += 15 * u) flame(ctx, x, vY + 8 * u, 22 * u * scale, t, x * 0.37);
      // Past the middle the cord catches and the flame climbs down toward her.
      const k = clamp01((d - 0.75) / 0.25);
      if (k > 0) flame(ctx, herX, lerp(cordTop + 10 * u, cordEnd + 6 * u, k), 16 * u * scale, t, 9);
      if (Math.random() < 0.08 * scale) puff(lerp(R.x, reach, Math.random()), vY - 10 * u, 12 * u, 1, '90,80,90');
    }
    violinist(ctx, herX, floorY, u, t, pose);
  }

  // ===== SCENE 3: THE SANDBAG RIG =====
  function sandbags(ctx, S) {
    const { R, u, floorY, herX, t } = S;
    // A brick wall backstage.
    ctx.fillStyle = '#5a1e1a';
    ctx.fillRect(R.x, R.y, R.w, floorY - R.y);
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1.5;
    const bh = 12 * u;
    for (let y = R.y, row = 0; y < floorY; y += bh, row++) {
      ctx.beginPath();
      ctx.moveTo(R.x, y);
      ctx.lineTo(R.x + R.w, y);
      for (let x = R.x + (row % 2 ? 13 * u : 0); x < R.x + R.w; x += 26 * u) { ctx.moveTo(x, y); ctx.lineTo(x, y + bh); }
      ctx.stroke();
    }
    floorBoards(ctx, R, floorY, u, '#4a2a18');
    spotlight(ctx, herX, R.y, floorY, u);
    // The batten (a pipe) the ropes hang from.
    const by = R.y + 46; // (just below the title ribbon)
    const pipe = ctx.createLinearGradient(0, by - 4 * u, 0, by + 4 * u);
    pipe.addColorStop(0, '#d8dce8');
    pipe.addColorStop(1, '#6a7088');
    ctx.fillStyle = pipe;
    ctx.fillRect(R.x, by - 4 * u, R.w, 8 * u);

    const N = scene.ropes || 5;
    let d = S.d;
    let n = ropesLeft(d, N);
    let bagY = floorY - 138 * u;
    let bagX = herX;
    let pose;
    let bonk = false;
    if (S.phase === 'won') {
      n = N;
      bagY -= ease.inOut(clamp01((S.age - 0.2) / 0.8)) * 120 * u;
      pose = winPose(S, { sit: 1, arms: 'play', face: 'happy' });
    } else if (S.phase === 'lost') {
      n = 0;
      const k = clamp01(S.age / 0.3);
      bagY = lerp(bagY, floorY - 128 * u, ease.in(k));
      if (k >= 1) bonk = true;
      pose = { sit: 1, arms: 'play', face: bonk ? 'dizzy' : 'scared', squash: bonk ? Math.max(0, 0.15 - (S.age - 0.3) * 0.4) : 0, still: true };
    } else {
      const mood = moodOf(d);
      pose = mood === 'panic'
        ? { sit: 1, arms: 'up', face: 'scared', shake: 1.2 }
        : { sit: 1, arms: 'play', face: mood === 'calm' ? 'calm' : 'worried' };
    }
    // A rope snapping: a little "snap!" and some fibres.
    if (S.phase === 'play' && n < lastRopes) {
      words.push({ text: 'snap!', x: herX + 48 * u, y: by + 50 * u, age: 0, size: 18, color: '#ffe9a8' });
      if (bits.length < MAX_BITS) burst(bits, herX, by + 14 * u, { n: 6, colors: ['#e8c890', '#b08850'], speed: 90, size: 2.5, life: 0.6 });
    }
    if (S.phase === 'play' || S.phase === 'won') lastRopes = n;
    if (S.phase === 'lost' && bonk && lastRopes !== -1) {
      lastRopes = -1;
      words.push({ text: 'BONK!', x: herX + 52 * u, y: floorY - 96 * u, age: 0, size: 30, color: '#fff3a0' });
    }
    const sway = S.phase === 'play' ? Math.sin(t * 1.7) * 0.03 + d * Math.sin(t * 3.1) * 0.12 : 0;
    // The ropes: whole ones hold the bag, snapped ones dangle from the pipe.
    for (let i = 0; i < N; i++) {
      const ax = herX + (i - (N - 1) / 2) * 16 * u;
      const tieX = bagX + Math.sin(sway) * 16 * u, tieY = bagY - 17 * u;
      ctx.strokeStyle = '#d8b878';
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      if (i < n) {
        ctx.moveTo(ax, by);
        ctx.lineTo(tieX, tieY);
      } else {
        const swing = Math.sin(t * 2 + i) * 0.25;
        const ex = ax + Math.sin(swing) * 16 * u, ey = by + Math.cos(swing) * 16 * u;
        ctx.moveTo(ax, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const f of [-1, 0, 1]) { ctx.moveTo(ex, ey); ctx.lineTo(ex + f * 3 * u, ey + 4 * u); }
      }
      ctx.stroke();
    }
    if (bonk) {
      violinist(ctx, herX, floorY, u, t, pose);
      sandbag(ctx, herX + 4 * u, floorY - 128 * u, u * 0.8, 0.25);
      stars(ctx, herX, floorY - 112 * u, u, t);
    } else {
      violinist(ctx, herX, floorY, u, t, pose);
      sandbag(ctx, bagX, bagY, u * 0.8, sway);
    }
  }

  // ===== SCENE 4: THE TRAPDOOR =====
  function trapdoor(ctx, S) {
    const { R, u, floorY, herX, t } = S;
    const wall = ctx.createLinearGradient(0, R.y, 0, floorY);
    wall.addColorStop(0, '#1a2a5a');
    wall.addColorStop(1, '#0a1230');
    ctx.fillStyle = wall;
    ctx.fillRect(R.x, R.y, R.w, floorY - R.y);
    // Painted stars on the backcloth.
    ctx.fillStyle = 'rgba(255,240,180,.5)';
    for (let i = 0; i < 14; i++) {
      const sx = R.x + R.w * ((i * 0.618) % 1), sy = R.y + (floorY - R.y) * ((i * 0.37) % 0.7) + 10;
      ctx.beginPath();
      ctx.arc(sx, sy, (1 + (i % 3) * 0.6) * u * (0.8 + 0.2 * Math.sin(t * 2 + i)), 0, TAU);
      ctx.fill();
    }
    spotlight(ctx, herX, R.y, floorY, u);
    floorBoards(ctx, R, floorY, u, '#5a3a20');
    // The crank at the side: it turns when gems are cleared.
    crank(ctx, R.x + R.w - 30 * u, floorY - 30 * u, u, -shownHave * 0.35);

    let gap = S.d * 36 * u;
    let drop = 0;
    let pose;
    if (S.phase === 'won') {
      gap *= 1 - ease.out(clamp01(S.age / 0.5));
      if (S.age > 0.45 && S.age < 0.5 && smoke.length < 8) { puff(herX, floorY, 20 * u, 6, '200,180,150'); words.push({ text: 'CLUNK!', x: herX + 50 * u, y: floorY - 30 * u, age: 0, size: 20 }); }
      pose = winPose(S, { sit: 1, arms: 'play', face: 'happy' });
    } else if (S.phase === 'lost') {
      gap = 40 * u;
      const a = S.age;
      // Down she goes ... and pops back up, head and shoulders out of the hole.
      if (a < 0.45) drop = ease.in(a / 0.45) * 130 * u;
      else drop = lerp(130 * u, 78 * u, ease.outBack(clamp01((a - 0.6) / 0.4)));
      if (a > 0.6 && a < 0.65 && smoke.length < 8) puff(herX, floorY, 24 * u, 6, '200,180,150');
      pose = { sit: 1, arms: a > 0.6 ? 'up' : 'up', face: a > 0.9 ? 'dizzy' : 'scared', still: a > 0.9 };
    } else {
      const mood = moodOf(S.d);
      pose = mood === 'panic'
        ? { sit: 1, arms: 'up', face: 'scared', shake: 1.2, wobble: 0.04 }
        : { sit: 1, arms: 'play', face: mood === 'calm' ? 'calm' : 'worried', wobble: mood === 'worried' ? 0.015 : 0 };
    }
    // The trap: a dark gap opening between two sliding panels.
    const tw = 64 * u, th = 8 * u;
    // Yellow-and-black warning edge round the trap, then the dark hole.
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(herX - tw / 2 - 3 * u, floorY - 2 * u, tw + 6 * u, 3 * u);
    ctx.fillStyle = '#1a1a1a';
    for (let x = herX - tw / 2; x < herX + tw / 2; x += 8 * u) ctx.fillRect(x, floorY - 2 * u, 4 * u, 3 * u);
    if (gap > 0.5) {
      const hole = ctx.createLinearGradient(0, floorY - 6 * u, 0, floorY + th + 6 * u);
      hole.addColorStop(0, '#000000');
      hole.addColorStop(1, '#2a1030');
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.ellipse(herX, floorY + 2 * u, gap / 2 + 2 * u, Math.min(9 * u, gap * 0.3 + 2 * u), 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(herX - gap / 2, floorY, gap, th + 6 * u);
    }
    ctx.fillStyle = '#7a5030';
    ctx.strokeStyle = '#2a1408';
    ctx.lineWidth = 1.5;
    ctx.fillRect(herX - tw / 2 - gap / 2, floorY, tw / 2, th);
    ctx.strokeRect(herX - tw / 2 - gap / 2, floorY, tw / 2, th);
    ctx.fillRect(herX + gap / 2, floorY, tw / 2, th);
    ctx.strokeRect(herX + gap / 2, floorY, tw / 2, th);
    // Her: clipped at the floor when she has fallen in.
    ctx.save();
    if (drop > 0) {
      ctx.beginPath();
      ctx.rect(R.x, R.y, R.w, floorY - R.y);
      ctx.clip();
    }
    violinist(ctx, herX, floorY + drop, u, t, pose);
    ctx.restore();
    if (S.phase === 'lost' && S.age > 0.9) stars(ctx, herX, floorY + drop - 112 * u, u, t);
  }

  // ===== THE VIOLINIST =====
  // (cx, floorY): the floor under her chair. u: one unit. pose:
  //   sit 1 on the chair, 0 standing     onChair: standing ON the chair
  //   arms 'play' | 'up' | 'out'         face 'calm' | 'worried' | 'scared' |
  //   'happy' | 'soggy' | 'soot' | 'dizzy'   hair 'bun' | 'wet' | 'frizz'
  //   bow 0..1  shake  wobble  squash  hop  still (no bow stroke)
  function violinist(ctx, cx, floorY, u, t, pose) {
    const sit = pose.sit ?? 1;
    const shake = pose.shake ? Math.sin(t * 40) * pose.shake * u : 0;
    ctx.save();
    ctx.translate(cx + shake, floorY - (pose.hop || 0) * u);
    ctx.scale(u, u);
    if (pose.wobble) ctx.rotate(Math.sin(t * 9) * pose.wobble);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 4, 0, 0, TAU);
    ctx.fill();
    // The chair (behind her). Standing to bow, she steps in front of it.
    chair(ctx);
    const lift = pose.onChair ? -30 : 0;
    ctx.translate(0, lift);
    if (pose.squash) ctx.scale(1 + pose.squash * 0.6, 1 - pose.squash);
    const waist = sit ? -60 : -70;
    // Skirt.
    ctx.fillStyle = '#c8183a';
    ctx.strokeStyle = '#5a0018';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (sit) {
      ctx.moveTo(-10, waist); ctx.lineTo(10, waist); ctx.lineTo(23, -40); ctx.lineTo(25, -5); ctx.lineTo(-25, -5); ctx.lineTo(-23, -40);
    } else {
      ctx.moveTo(-10, waist); ctx.lineTo(10, waist); ctx.quadraticCurveTo(18, -30, 27, -2); ctx.lineTo(-27, -2); ctx.quadraticCurveTo(-18, -30, -10, waist);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(sit ? -25 : -27, -8, sit ? 50 : 54, 3);
    // Shoes.
    ctx.fillStyle = '#1a0a1a';
    ctx.beginPath(); ctx.ellipse(-9, -2, 5, 2.5, 0, 0, TAU); ctx.ellipse(9, -2, 5, 2.5, 0, 0, TAU); ctx.fill();
    // Upper body, from the waist. A bow squashes it forward.
    ctx.save();
    ctx.translate(0, waist);
    const bow = pose.bow || 0;
    ctx.scale(1, 1 - bow * 0.32);
    upper(ctx, pose, t);
    ctx.restore();
    ctx.restore();
  }

  function chair(ctx) {
    ctx.fillStyle = '#7a3f1a';
    ctx.strokeStyle = '#3a1808';
    ctx.lineWidth = 1.5;
    for (const x of [-18, 14]) { ctx.fillRect(x, -38, 4, 38); ctx.strokeRect(x, -38, 4, 38); }
    for (const x of [-19, 15]) { ctx.fillRect(x, -82, 4, 44); ctx.strokeRect(x, -82, 4, 44); }
    rr(ctx, -21, -86, 42, 8, 3); ctx.fill(); ctx.stroke();
    rr(ctx, -22, -42, 44, 6, 2); ctx.fill(); ctx.stroke();
  }

  // Everything above the waist; (0, 0) is the waist.
  function upper(ctx, pose, t) {
    const SKIN = '#e9b48c', SKIN_D = '#a86a44';
    const arms = pose.arms || 'play';
    const p = pose.still ? 0 : Math.sin(t * 5.5); // the bow stroke
    const limb = (pts, w = 5) => {
      ctx.strokeStyle = SKIN_D;
      ctx.lineWidth = w + 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = SKIN;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const hand = (x, y) => { ctx.fillStyle = SKIN; ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); ctx.stroke(); };
    // Back hair (behind the head and body).
    const hy = -38; // head centre
    if (pose.hair === 'frizz') {
      ctx.fillStyle = '#1a1214';
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 13, hy - 4 + Math.sin(a) * 11, 8, 0, TAU); ctx.fill(); }
    } else {
      ctx.fillStyle = '#2a1a3a';
      ctx.beginPath(); ctx.ellipse(0, hy + 1, 13, 13, 0, 0, TAU); ctx.fill();
      if (pose.hair === 'wet') { ctx.fillRect(-13, hy, 5, 22); ctx.fillRect(8, hy, 5, 22); }
    }
    // Bodice and neck.
    ctx.fillStyle = SKIN;
    ctx.fillRect(-3, hy + 8, 6, 8);
    ctx.fillStyle = '#c8183a';
    ctx.strokeStyle = '#5a0018';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(-12, -22); ctx.quadraticCurveTo(0, -18, 12, -22); ctx.lineTo(10, 0); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Arms and the instrument.
    if (arms === 'play') {
      // Violin under her chin on her left (our right); the bow in her right hand.
      violin(ctx, 11, -24, -0.42, 1);
      limb([[11, -20], [24, -12], [28, -31]]);
      hand(28, -31);
      const d = [Math.cos(0.32), Math.sin(0.32)];
      const contact = [13, -25];
      const back = 20 + 11 * p;
      const hx = contact[0] - d[0] * back, hy2 = contact[1] - d[1] * back;
      limb([[-11, -20], [-24, -16], [hx, hy2]]);
      bowStick(ctx, hx, hy2, hx + d[0] * 54, hy2 + d[1] * 54);
      hand(hx, hy2);
    } else if (arms === 'up') {
      const w = Math.sin(t * 12) * 3;
      limb([[-11, -20], [-22, -34], [-21 + w, -50]]);
      limb([[11, -20], [22, -34], [21 - w, -50]]);
      bowStick(ctx, -21 + w, -50, -40 + w, -64);
      violin(ctx, 22 - w, -56, -Math.PI / 2 + 0.3 + w * 0.05, 0.9);
      hand(-21 + w, -50);
      hand(21 - w, -50);
    } else if (arms === 'out') {
      limb([[-11, -20], [-22, -10], [-30, 0]]);
      limb([[11, -20], [22, -10], [30, 0]]);
      bowStick(ctx, -30, 0, -44, 26);
      violin(ctx, 34, 6, 1.2, 0.9);
      hand(-30, 0);
      hand(30, 0);
    }
    // Head.
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = SKIN_D;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, hy, 11, 0, TAU); ctx.fill(); ctx.stroke();
    face(ctx, 0, hy, pose.face || 'calm', t);
    // Front hair: bangs and the bun (or what is left of it).
    if (pose.hair === 'frizz') {
      ctx.fillStyle = '#1a1214';
      ctx.beginPath(); ctx.arc(-6, hy - 10, 6, 0, TAU); ctx.arc(6, hy - 10, 6, 0, TAU); ctx.arc(0, hy - 13, 6, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#2a1a3a';
      ctx.beginPath();
      ctx.moveTo(-11, hy - 1);
      ctx.quadraticCurveTo(-10, hy - 14, 0, hy - 12);
      ctx.quadraticCurveTo(10, hy - 14, 11, hy - 1);
      ctx.quadraticCurveTo(6, hy - 8, 0, hy - 7);
      ctx.quadraticCurveTo(-6, hy - 8, -11, hy - 1);
      ctx.fill();
      if (pose.hair === 'wet') {
        ctx.beginPath(); ctx.ellipse(9, hy - 9, 6, 4, 0.8, 0, TAU); ctx.fill(); // a soggy bun, slid sideways
      } else {
        ctx.beginPath(); ctx.arc(0, hy - 15, 6.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffc21a';
        ctx.fillRect(-5, hy - 11, 10, 2.2);
      }
    }
  }

  function face(ctx, x, y, kind, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    const ink = '#2a1020';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 1.4;
    const blush = () => { ctx.fillStyle = 'rgba(255,90,120,.35)'; ctx.beginPath(); ctx.arc(-7, 4, 2.4, 0, TAU); ctx.arc(7, 4, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = ink; };
    const blink = (t % 3.2) < 0.12;
    if (kind === 'calm') {
      // Eyes shut, lost in the music.
      for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, 0, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 4, 2.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      blush();
    } else if (kind === 'worried') {
      for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex + 0.6, 0.5, blink ? 0.4 : 1.5, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-2.5, -5.5); ctx.moveTo(6, -4); ctx.lineTo(2.5, -5.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2.5, 6); ctx.quadraticCurveTo(-1, 4.8, 0, 6); ctx.quadraticCurveTo(1, 7, 2.5, 5.8); ctx.stroke();
      ctx.fillStyle = 'rgba(160,220,255,.9)'; ctx.beginPath(); ctx.ellipse(10, -3 + (t % 1) * 3, 1.3, 2, 0, 0, TAU); ctx.fill();
    } else if (kind === 'scared') {
      for (const ex of [-4, 4]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, 0, 2.8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(ex, 0.3, 1, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-2, -6.5); ctx.moveTo(7, -5); ctx.lineTo(2, -6.5); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 6, 2.3, 2.8 + Math.sin(t * 14) * 0.4, 0, 0, TAU); ctx.fill();
    } else if (kind === 'happy') {
      for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc(ex, 1, 2.2, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-3.5, 4); ctx.quadraticCurveTo(0, 10, 3.5, 4); ctx.closePath(); ctx.fillStyle = '#7a1028'; ctx.fill();
      blush();
    } else if (kind === 'soggy') {
      for (const ex of [-4, 4]) { ctx.beginPath(); ctx.moveTo(ex - 2, 0.5); ctx.lineTo(ex + 2, 0.5); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-3, 6); for (let i = 0; i <= 6; i++) ctx.lineTo(-3 + i, 6 + (i % 2 ? -0.8 : 0.8)); ctx.stroke();
    } else if (kind === 'soot') {
      ctx.fillStyle = 'rgba(30,20,20,.7)';
      ctx.beginPath(); ctx.arc(-5, 3, 4, 0, TAU); ctx.arc(5, -1, 3.5, 0, TAU); ctx.arc(1, 6, 3, 0, TAU); ctx.fill();
      for (const ex of [-4, 4]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, 0, blink ? 0.3 : 2, 0, TAU); ctx.fill(); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(ex, 0, blink ? 0.2 : 0.8, 0, TAU); ctx.fill(); }
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 6, 1.3, 0, TAU); ctx.fill();
    } else if (kind === 'dizzy') {
      for (const ex of [-4, 4]) {
        ctx.beginPath();
        for (let a = 0; a < 4 * Math.PI; a += 0.4) { const r = a * 0.2; ctx.lineTo(ex + Math.cos(a + t * 6) * r, Math.sin(a + t * 6) * r); }
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-3, 6); ctx.quadraticCurveTo(0, 4, 3, 7); ctx.stroke();
    }
    ctx.restore();
  }

  // A violin with its body at (x, y), its neck pointing along `angle`.
  function violin(ctx, x, y, angle, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(s, s);
    ctx.fillStyle = '#b8541a';
    ctx.strokeStyle = '#4a1a04';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-4, 0, 6.5, 7.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(5, 0, 5, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d87a30';
    ctx.beginPath(); ctx.ellipse(-4, -2, 3, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1008';
    ctx.fillRect(9, -1.3, 16, 2.6);
    ctx.beginPath(); ctx.arc(26.5, 0, 2.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,.8)';
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(-8, -0.6); ctx.lineTo(25, -0.6); ctx.moveTo(-8, 0.6); ctx.lineTo(25, 0.6); ctx.stroke();
    ctx.restore();
  }
  function bowStick(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = '#4a2408';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,230,.85)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x1 + 1, y1 + 1.5); ctx.lineTo(x2 + 1, y2 + 1.5); ctx.stroke();
  }

  // ---- Bits of scenery ----
  function floorBoards(ctx, R, floorY, u, color) {
    ctx.fillStyle = color;
    ctx.fillRect(R.x, floorY, R.w, R.y + R.h - floorY);
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = R.x + 20 * u; x < R.x + R.w; x += 40 * u) { ctx.moveTo(x, floorY); ctx.lineTo(x - 8 * u, R.y + R.h); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,160,.15)';
    ctx.fillRect(R.x, floorY, R.w, 2);
  }
  function spotlight(ctx, x, top, floorY, u) {
    const gr = ctx.createLinearGradient(0, top, 0, floorY);
    gr.addColorStop(0, 'rgba(255,240,200,.02)');
    gr.addColorStop(1, 'rgba(255,240,200,.16)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - 10 * u, top);
    ctx.lineTo(x + 10 * u, top);
    ctx.lineTo(x + 50 * u, floorY);
    ctx.lineTo(x - 50 * u, floorY);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.14)';
    ctx.beginPath();
    ctx.ellipse(x, floorY, 50 * u, 6 * u, 0, 0, TAU);
    ctx.fill();
  }
  function drape(ctx, x, y, w, h, dir, t) {
    const gr = ctx.createLinearGradient(x, 0, x + w, 0);
    for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, i % 2 ? '#7a0a20' : '#c01834');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    const sway = Math.sin(t * 0.8) * 2;
    ctx.quadraticCurveTo(x + w * (dir > 0 ? 0.7 : 0.3) + sway, y + h * 0.6, x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  }
  function musicStand(ctx, x, floorY, u, t) {
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(x, floorY); ctx.lineTo(x, floorY - 70 * u);
    ctx.moveTo(x - 10 * u, floorY); ctx.lineTo(x, floorY - 12 * u); ctx.lineTo(x + 10 * u, floorY);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, floorY - 82 * u);
    ctx.rotate(-0.15);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(-14 * u, -10 * u, 28 * u, 20 * u);
    ctx.strokeStyle = '#3a3040';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-12 * u, (-6 + i * 4) * u); ctx.lineTo(12 * u, (-6 + i * 4) * u); ctx.stroke(); }
    ctx.fillStyle = '#3a3040';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((-9 + i * 5) * u, (-5 + ((i * 3) % 4) * 3) * u, 1.2 * u, 0, TAU); ctx.fill(); }
    ctx.restore();
    // Notes drifting up while she plays.
    if (phase !== 'lost') {
      ctx.fillStyle = 'rgba(255,240,200,.75)';
      ctx.font = `${Math.round(12 * u)}px ${GAME_FONT}`;
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillText(i % 2 ? '♪' : '♫', x + 70 * u + Math.sin(k * 6 + i) * 8 * u, floorY - 110 * u - k * 40 * u);
      }
      ctx.globalAlpha = 1;
    }
  }
  function flame(ctx, x, y, size, t, seed) {
    const h = size * (0.85 + 0.25 * Math.sin(t * 9 + seed * 3.1));
    const w = size * 0.42;
    const sway = Math.sin(t * 6 + seed) * size * 0.15;
    ctx.fillStyle = 'rgba(255,110,20,.85)';
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w, y - h * 0.6, x + sway, y - h);
    ctx.quadraticCurveTo(x + w, y - h * 0.6, x + w, y);
    ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,225,90,.9)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.35, x + sway * 0.6, y - h * 0.6);
    ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.35, x + w * 0.5, y);
    ctx.fill();
  }
  function sandbag(ctx, x, y, u, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#c8a46a';
    ctx.strokeStyle = '#5a4020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6 * u, -20 * u);
    ctx.quadraticCurveTo(-18 * u, -10 * u, -16 * u, 8 * u);
    ctx.quadraticCurveTo(0, 18 * u, 16 * u, 8 * u);
    ctx.quadraticCurveTo(18 * u, -10 * u, 6 * u, -20 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-7 * u, -22 * u, 14 * u, 4 * u);
    ctx.fillStyle = 'rgba(60,30,10,.75)';
    ctx.font = `${Math.round(8 * u)}px ${GAME_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('SAND', 0, 4 * u);
    ctx.restore();
  }
  function stars(ctx, x, y, u, t) {
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#9a6a00';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = t * 3 + (i * TAU) / 5;
      const sx = x + Math.cos(a) * 20 * u, sy = y + Math.sin(a) * 6 * u;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = (k % 2 ? 1.8 : 4.2) * u;
        const b = (k * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  function crank(ctx, x, y, u, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#5a6078';
    ctx.fillRect(-3 * u, 0, 6 * u, 30 * u);
    ctx.rotate(a);
    ctx.strokeStyle = '#c8cce0';
    ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.arc(0, 0, 12 * u, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos((i * TAU) / 4) * 12 * u, Math.sin((i * TAU) / 4) * 12 * u); ctx.stroke(); }
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath(); ctx.arc(12 * u, 0, 3 * u, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function fish(ctx, x, y, u, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 8) * 0.3);
    ctx.fillStyle = '#ff8a2a';
    ctx.strokeStyle = '#8a3a00';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 8 * u, 4 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7 * u, 0); ctx.lineTo(13 * u, -4 * u); ctx.lineTo(13 * u, 4 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(-4 * u, -1 * u, 1 * u, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function duck(ctx, x, y, u, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2) * 0.1);
    ctx.fillStyle = '#ffd21f';
    ctx.strokeStyle = '#9a6a00';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -3 * u, 8 * u, 5 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-5 * u, -10 * u, 4 * u, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.moveTo(-9 * u, -10 * u); ctx.lineTo(-13 * u, -9 * u); ctx.lineTo(-9 * u, -8 * u); ctx.fill();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(-6 * u, -11 * u, 0.9 * u, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function rose(ctx, x, y, u, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.strokeStyle = '#2a8a3a';
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12 * u); ctx.stroke();
    ctx.fillStyle = '#ff2a5a';
    ctx.strokeStyle = '#8a0024';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 4.5 * u, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,0,30,.7)';
    ctx.beginPath(); ctx.arc(0, 0, 2.2 * u, 0, 4); ctx.stroke();
    ctx.restore();
  }
  function bubble(ctx, x, y, u, text, t) {
    const s = 1 + 0.05 * Math.sin(t * 8);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.font = `${Math.max(14, Math.round(15 * u))}px ${GAME_FONT}`;
    const w = ctx.measureText(text).width + 18;
    const h = 26;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#2a0a5e';
    ctx.lineWidth = 2;
    rr(ctx, 0, -h, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -2); ctx.lineTo(2, 8); ctx.lineTo(16, -2);
    ctx.fill();
    ctx.fillStyle = '#d6183a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 9, -h / 2 + 1);
    ctx.restore();
  }

  // For checking the screen by hand from the browser console.
  g.debug = {
    state: () => ({ phase, busy, run: { ...run }, shownHave, shownDanger }),
    danger: (d) => { run = { ...run, danger: clamp01(d) }; },
    move: (action) => doMove(action),
    board: () => game.board,
    end: (won) => (won ? win() : lose()),
  };
  return g;
}

// A wooden bucket with the goal's gem on its front (any color: a splash).
function bucket(ctx, x, y, s, goal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#a8642a';
  ctx.strokeStyle = '#4a2408';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.32);
  ctx.lineTo(s * 0.42, -s * 0.32);
  ctx.lineTo(s * 0.32, s * 0.4);
  ctx.lineTo(-s * 0.32, s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c8cce0';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.12); ctx.lineTo(s * 0.4, -s * 0.12); ctx.moveTo(-s * 0.35, s * 0.22); ctx.lineTo(s * 0.35, s * 0.22); ctx.stroke();
  ctx.fillStyle = '#5ab8ff';
  ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.42, s * 0.08, 0, 0, TAU); ctx.fill();
  if (goal.color !== undefined) drawPiece(ctx, goal.color, 0, s * 0.04, s * 0.5, theme);
  else { ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.arc(0, s * 0.04, s * 0.14, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Text wrapped to a width, centered on x, lines `lh` apart.
function wrap(ctx, text, x, y, w, lh) {
  const words = String(text).split(' ');
  let line = '';
  const lines = [];
  for (const wd of words) {
    const tryLine = line ? line + ' ' + wd : wd;
    if (ctx.measureText(tryLine).width > w && line) { lines.push(line); line = wd; } else line = tryLine;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
}
