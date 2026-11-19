// ART GALLERY (a checking tool, not part of the game).
// Draws every gem, power-up, obstacle state, floor and a few whole boards
// with the game's real drawing code, so the artwork can be judged at the
// size it has on a phone.

import { createBoard, set, piece, power, placeBlock, setFloor, drop } from '../engine/board.js';
import { generateLevel } from '../levels/generate.js';
import { newGame } from '../engine/game.js';

// Load the drawing code and the colors fresh every time the page is
// reloaded (the "?t=" part stops the browser re-using an old copy).
const stamp = '?t=' + Date.now();
const R = await import('../ui/render.js' + stamp);
const { theme } = await import('../config/theme.js' + stamp);

const DPR = 3;   // a phone screen has 3 real pixels per page pixel
const PAD = 6;   // the free space render.js keeps round a board
const only = new URLSearchParams(location.search).get('only');
const compact = new URLSearchParams(location.search).has('compact');
const root = document.getElementById('gallery');
let row = null;

// Start a new titled section. Returns false if "?only=" asked for another one.
function section(id, title) {
  if (only && only !== id) { row = null; return false; }
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  row = document.createElement('div');
  row.className = 'row';
  root.appendChild(row);
  return true;
}

// One canvas, w x h page pixels, sharp at phone resolution, shown `zoom` times as big.
function makeCanvas(w, h, zoom, paint) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * DPR);
  c.height = Math.round(h * DPR);
  c.style.width = w * zoom + 'px';
  c.style.height = h * zoom + 'px';
  c.dataset.zoom = zoom;
  const ctx = c.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  paint(ctx);
  return c;
}

function card(label, canvases) {
  if (!row) return;
  const div = document.createElement('div');
  div.className = 'card';
  const b = document.createElement('b');
  b.textContent = label;
  div.appendChild(b);
  const pics = document.createElement('div');
  pics.className = 'pics';
  // "?compact=1" leaves out the enlarged pictures, to judge true size only.
  for (const c of canvases) if (!compact || c.dataset.zoom === '1') pics.appendChild(c);
  div.appendChild(pics);
  row.appendChild(div);
}

// Draw a small board (built by `setup`) with the real drawBoard.
function boardCanvas(board, cell, zoom, overlay) {
  const w = board.cols * cell + PAD * 2;
  const h = board.rows * cell + PAD * 2;
  return makeCanvas(w, h, zoom, (ctx) => {
    R.drawBoard(ctx, board, R.layoutFor(w, h, board.cols, board.rows), theme, overlay);
  });
}

// One labelled card showing a tiny board at 36 px, 47 px and 36 px enlarged.
function show(label, cols, rows, setup, overlay) {
  if (!row) return;
  const board = createBoard(cols, rows, []);
  setup(board);
  card(label, [boardCanvas(board, 36, 1, overlay), boardCanvas(board, 47, 1, overlay), boardCanvas(board, 36, 3, overlay)]);
}

// Put a block on a board and then change it (its hits left, and so on).
function put(board, x, y, kind, extra, change) {
  const cell = placeBlock(board, x, y, kind, extra || {});
  if (cell && change) Object.assign(cell, change);
  return cell;
}

const NAMES = theme.pieces.map((p) => p.name);

// ---- Gems and power-ups ----
if (section('gems', 'Gems and power-ups')) {
  show('All five gems, then the power-ups', 5, 2, (b) => {
    for (let c = 0; c < 5; c++) set(b, c, 0, piece(c));
    ['spot-h', 'spot-v', 'under', 'show', 'prism'].forEach((k, i) => set(b, i, 1, power(k)));
  });
  theme.pieces.forEach((p, c) => show(p.name, 1, 1, (b) => set(b, 0, 0, piece(c))));
  [['spot-h', 'Missile (row)'], ['spot-v', 'Missile (column)'], ['under', 'Ninja Star'], ['show', 'Grenade'], ['prism', 'Magic Ball']]
    .forEach(([k, name]) => show(name, 1, 1, (b) => set(b, 0, 0, power(k))));
  show('Super Magic Ball', 1, 1, (b) => set(b, 0, 0, power('prism')), { superPrism: true });
  // The same gems in grey, to check they can be told apart by shape alone.
  if (row) {
    const grey = { ...theme, pieces: theme.pieces.map((p) => ({ ...p, color: '#7d7d7d' })) };
    const board = createBoard(5, 1, []);
    for (let c = 0; c < 5; c++) set(board, c, 0, piece(c));
    const w = 5 * 36 + PAD * 2;
    const h = 36 + PAD * 2;
    const draw = (zoom) => makeCanvas(w, h, zoom, (ctx) => R.drawBoard(ctx, board, R.layoutFor(w, h, 5, 1), grey));
    card('Gems without colour (shape only)', [draw(1), draw(3)]);
  }
}

// ---- Obstacles, batch 1 ----
if (section('obstacles', 'Obstacles, batch 1 (one cell)')) {
  show('Crate', 1, 1, (b) => put(b, 0, 0, 'crate'));
  show('Hatbox: 2 hits left, 1 left', 2, 1, (b) => { put(b, 0, 0, 'hatbox'); put(b, 1, 0, 'hatbox', {}, { hp: 1 }); });
  show('Trunk: 3, 2, 1', 3, 1, (b) => { put(b, 0, 0, 'trunk'); put(b, 1, 0, 'trunk', {}, { hp: 2 }); put(b, 2, 0, 'trunk', {}, { hp: 1 }); });
  show('Paint Can: each colour', 5, 1, (b) => { for (let c = 0; c < 5; c++) put(b, c, 0, 'paint', { color: c }); });
  show('Dry Ice', 1, 1, (b) => put(b, 0, 0, 'dryice'));
  show('Cash Box (power-ups only)', 1, 1, (b) => put(b, 0, 0, 'cashbox'));
  show('Scenery Flat: 3, 2, 1 (power-ups only)', 3, 1, (b) => { put(b, 0, 0, 'flat'); put(b, 1, 0, 'flat', {}, { hp: 2 }); put(b, 2, 0, 'flat', {}, { hp: 1 }); });
  show('Strongbox: shut (power-up), then open (match)', 2, 1, (b) => { put(b, 0, 0, 'strongbox'); put(b, 1, 0, 'strongbox', {}, { hp: 1 }); });
  show('Costume Bag: 3, 2, 1', 3, 1, (b) => { put(b, 0, 0, 'costume'); put(b, 1, 0, 'costume', {}, { hp: 2 }); put(b, 2, 0, 'costume', {}, { hp: 1 }); });
  show('Padlock: over each gem, over a hatbox, over a Missile', 7, 1, (b) => {
    for (let c = 0; c < 5; c++) put(b, c, 0, 'padlock', { inside: piece(c) });
    put(b, 5, 0, 'padlock', { inside: { t: 'block', kind: 'hatbox', hp: 2 } });
    put(b, 6, 0, 'padlock', { inside: power('spot-h') });
  });
  show('Sandbag', 1, 1, (b) => set(b, 0, 0, drop()));
  show('All batch 1 side by side, with gems', 6, 3, (b) => {
    ['crate', 'hatbox', 'trunk', 'dryice', 'cashbox', 'flat'].forEach((k, i) => put(b, i, 0, k));
    put(b, 0, 1, 'strongbox'); put(b, 1, 1, 'costume'); put(b, 2, 1, 'padlock', { inside: piece(2) });
    set(b, 3, 1, drop()); put(b, 4, 1, 'paint', { color: 1 }); put(b, 5, 1, 'paint', { color: 3 });
    for (let c = 0; c < 5; c++) set(b, c, 2, piece(c));
    set(b, 5, 2, power('show'));
  });
}

// ---- Obstacles, batch 2 ----
if (section('obstacles', 'Obstacles, batch 2')) {
  show('Planter: 5, 3, 1 hits left', 6, 2, (b) => { put(b, 0, 0, 'planter'); put(b, 2, 0, 'planter', {}, { hp: 3 }); put(b, 4, 0, 'planter', {}, { hp: 1 }); });
  show('Bouquet: 2, 1', 2, 1, (b) => { put(b, 0, 0, 'bouquet'); put(b, 1, 0, 'bouquet', {}, { hp: 1 }); });
  show('Top Hat: 0, 1, 2 of 3 matches', 3, 1, (b) => { put(b, 0, 0, 'tophat'); put(b, 1, 0, 'tophat', {}, { count: 1 }); put(b, 2, 0, 'tophat', {}, { count: 2 }); });
  show('Popcorn Cart: 0, 1, 2 of 3 matches', 3, 1, (b) => { put(b, 0, 0, 'popper'); put(b, 1, 0, 'popper', {}, { count: 1 }); put(b, 2, 0, 'popper', {}, { count: 2 }); });
  show('Candy Jar: 3, 2, 1', 3, 1, (b) => { put(b, 0, 0, 'candyjar'); put(b, 1, 0, 'candyjar', {}, { hp: 2 }); put(b, 2, 0, 'candyjar', {}, { hp: 1 }); });
  show('Dovecote: 5, 3, 1 hits left', 6, 2, (b) => { put(b, 0, 0, 'dovecote'); put(b, 2, 0, 'dovecote', {}, { hp: 3 }); put(b, 4, 0, 'dovecote', {}, { hp: 1 }); });
  show('Footlights: 4 colours left, 2 left, 1 left', 6, 2, (b) => {
    put(b, 0, 0, 'footlights', { colors: [0, 1, 2, 3] });
    put(b, 2, 0, 'footlights', { colors: [4, 1] });
    put(b, 4, 0, 'footlights', { colors: [2] });
  });
  show('Fireworks: 3 colours left, 2, 1', 6, 1, (b) => {
    put(b, 0, 0, 'fireworks', { colors: [0, 1, 2] });
    put(b, 2, 0, 'fireworks', { colors: [3, 4] });
    put(b, 4, 0, 'fireworks', { colors: [1] });
  });
  show('Lighting Truss: 2 hits left (3 wide), 1 left (4 wide)', 7, 1, (b) => { put(b, 0, 0, 'truss', { w: 3 }); put(b, 3, 0, 'truss', { w: 4 }, { hp: 1 }); });
  show('Ticket Booth: shut (4), then 3, 2, 1', 6, 2, (b) => {
    put(b, 0, 0, 'ticketbooth'); put(b, 3, 0, 'ticketbooth', {}, { hp: 3 });
    put(b, 0, 1, 'ticketbooth', {}, { hp: 2 }); put(b, 3, 1, 'ticketbooth', {}, { hp: 1 });
  });
  show('Makeup Case: open, closed', 2, 1, (b) => { put(b, 0, 0, 'makeupcase', { open: true }); put(b, 1, 0, 'makeupcase', { open: false }); });
  show('Curtain: each colour', 5, 1, (b) => { for (let c = 0; c < 5; c++) put(b, c, 0, 'curtain', { color: c, need: 10 }); });
  show('All one-cell batch 2 side by side, with gems', 6, 2, (b) => {
    ['bouquet', 'tophat', 'popper', 'candyjar'].forEach((k, i) => put(b, i, 0, k));
    put(b, 4, 0, 'makeupcase', { open: true }); put(b, 5, 0, 'makeupcase', { open: false });
    for (let c = 0; c < 5; c++) set(b, c, 1, piece(c));
    put(b, 5, 1, 'curtain', { color: 0, need: 5 });
  });
}

// ---- Floors ----
if (section('floors', 'Floors (they lie under a cell)')) {
  for (const kind of ['confetti', 'petals']) {
    show(kind + ': empty cell, each gem, a power-up, a crate; plain cells below', 8, 2, (b) => {
      for (let x = 0; x < 8; x++) setFloor(b, x, 0, kind);
      for (let c = 0; c < 5; c++) { set(b, c + 1, 0, piece(c)); set(b, c + 1, 1, piece(c)); }
      set(b, 6, 0, power('under')); set(b, 6, 1, power('under'));
      put(b, 7, 0, 'crate'); put(b, 7, 1, 'crate');
    });
  }
}

// ---- The small target pictures ----
if (section('icons', 'Target pictures (22 px, 28 px, and 28 px enlarged 3 times)')) {
  const kinds = ['crate', 'hatbox', 'trunk', 'paint', 'dryice', 'cashbox', 'flat', 'strongbox', 'costume', 'padlock', 'sandbag',
    'confetti', 'petals', 'planter', 'bouquet', 'tophat', 'popper', 'candyjar', 'dovecote', 'footlights', 'fireworks',
    'truss', 'ticketbooth', 'makeupcase', 'curtain', 'dove', 'popcorn', 'candy'];
  const icon = (target, size, zoom) => makeCanvas(size, size, zoom, (ctx) => {
    ctx.fillStyle = theme.ui.panel; // the chips sit on the light panel color
    ctx.fillRect(0, 0, size, size);
    R.drawTargetIcon(ctx, target, size, theme);
  });
  for (const kind of kinds) card(kind, [icon({ block: kind }, 22, 1), icon({ block: kind }, 28, 1), icon({ block: kind }, 28, 3)]);
  NAMES.forEach((name, c) => card(name, [icon({ color: c }, 22, 1), icon({ color: c }, 28, 1), icon({ color: c }, 28, 3)]));
  for (const k of ['spot-h', 'under', 'show', 'prism']) {
    const pic = (size, zoom) => makeCanvas(size, size, zoom, (ctx) => R.drawPowerIcon(ctx, k, size, theme));
    card(theme.powers[k].name, [pic(28, 1), pic(36, 1), pic(36, 3)]);
  }
}

// ---- Whole boards with holes ----
if (section('boards', 'Boards with holes (36 px cells; then enlarged 2 times)')) {
  const levels = (new URLSearchParams(location.search).get('levels') || '23,57,75').split(',').map(Number);
  for (const n of levels) {
    const level = generateLevel(n);
    const game = newGame(level, 1);
    card('Level ' + n + ' (' + (level.holes || []).length + ' holes)', [boardCanvas(game.board, 36, 1), boardCanvas(game.board, 36, 2)]);
  }
  // A made-up board with every awkward kind of hole: a single hole in the
  // middle, a hole at a corner, a notch in a side, two holes touching corner to corner.
  const holes = [{ x: 3, y: 3 }, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 1 }, { x: 0, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 6 }, { x: 2, y: 6 }];
  const b = createBoard(7, 7, holes);
  let i = 0;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (!holes.some((h) => h.x === x && h.y === y)) set(b, x, y, piece((x * 2 + y * 3 + i++) % 5));
  placeBlock(b, 1, 1, 'crate'); placeBlock(b, 2, 1, 'flat'); setFloor(b, 4, 2, 'confetti'); setFloor(b, 5, 2, 'petals');
  set(b, 1, 3, { t: 'empty' });
  card('Test board: holes of every kind (one empty cell at left of the middle hole... two cells left)', [boardCanvas(b, 36, 1), boardCanvas(b, 36, 2), boardCanvas(b, 47, 1)]);
}

document.title = 'gallery ready';
