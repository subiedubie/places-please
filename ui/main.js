// MAIN: ties the screens, the board drawing, the touch input and the saved
// game together. The order of play is  Home -> Level -> Results -> Home,
// with Settings reachable from Home.
//
// All the rules and the saving live in the Session object (meta/session.js).
// This file only asks it things and shows the answers.

import { createSession } from '../meta/session.js';
import { cloneBoard, get } from '../engine/board.js';
import { theme } from '../config/theme.js';
import { fitCanvas, layoutFor, drawBoard } from './render.js';
import { attachInput } from './input.js';
import { playEvents, playSwap, wait } from './anim.js';
import { createScreens } from './screens.js';

// Copy the colors from config/theme.js into the page, so that file is the
// one place to change them.
const css = document.documentElement.style;
css.setProperty('--bg', theme.ui.background);
css.setProperty('--panel', theme.ui.panel);
css.setProperty('--cell', theme.ui.cell);
css.setProperty('--tray', theme.ui.tray);
css.setProperty('--line', theme.ui.line);
css.setProperty('--text', theme.ui.text);
css.setProperty('--dim', theme.ui.dim);
css.setProperty('--accent', theme.ui.accent);
css.setProperty('--accent-text', theme.ui.accentText);
css.setProperty('--danger', theme.ui.danger);
const themeColorTag = document.querySelector('meta[name="theme-color"]');
if (themeColorTag) themeColorTag.content = theme.ui.background;
document.title = theme.name;

// Display names for the power-ups, used in the results lines.
const powerNames = Object.fromEntries(Object.entries(theme.powers || theme.powerups || {}).map(([k, v]) => [k, v.name]));
const session = createSession(window.localStorage, { names: powerNames });
const ui = createScreens(theme);
const $ = ui.$;
const canvas = $('board');

let ctx = null;      // the drawing surface of the canvas
let layout = null;   // where the board sits inside the canvas
let shown = null;    // the board as currently drawn (our own copy)
let busy = false;    // true while a move is being played back
let pressed = null;  // the cell under the player's finger, if any
let onLevel = false; // true while the Level screen is showing

const speed = () => (session.save.settings && session.save.settings.speed) || 'normal';
const speedFactor = () => (speed() === 'fast' ? 0.5 : 1);

// ---- Drawing ----

// Paint a board. The animations call this many times a second.
function drawFrame(board, overlay) {
  if (!ctx || !layout || !board) return;
  shown = board;
  const extra = pressed && !busy ? { ...(overlay || {}), pressed } : overlay;
  drawBoard(ctx, board, layout, theme, extra);
}

// Measure the canvas again (first showing, phone rotated, window resized).
function refit() {
  if (!onLevel || !session.game) return;
  const fit = fitCanvas(canvas);
  ctx = fit.ctx;
  const b = session.game.board;
  layout = layoutFor(fit.w, fit.h, b.cols, b.rows);
  drawFrame(shown || cloneBoard(b));
}
window.addEventListener('resize', refit);

// ---- Moving between screens ----

function goHome() {
  onLevel = false;
  const save = session.save;
  const game = session.game;
  // The tier of the next level, if anything can tell us.
  let tier = null;
  if (game && game.status === 'playing') tier = game.level.tier;
  else if (save.current && save.current.level) tier = save.current.level.tier;
  else if (typeof session.peekLevel === 'function') tier = session.peekLevel().tier;
  // The streak gift is shown only before a level starts: a level already in
  // progress has had its gift.
  const resuming = Boolean(save.current);
  const gift = !resuming && typeof session.nextGift === 'function' ? session.nextGift() : null;
  ui.home(save, tier, resuming, gift);
  ui.show('home');
}

function goLevel() {
  const game = session.startLevel(); // carries on a level in progress if there is one
  shown = cloneBoard(game.board);
  busy = false;
  pressed = null;
  onLevel = true;
  ui.hud(game);
  ui.show('level');
  refit(); // must come after show(): a hidden canvas has no size
}

function goResults(result, levelN) {
  onLevel = false;
  ui.results(result, levelN);
  ui.show('results');
}

function goSettings(message) {
  onLevel = false;
  ui.settings(session, message);
  ui.show('settings');
}

// ---- Playing a move ----

async function handleAction(action) {
  if (busy || !onLevel) return;
  busy = true;
  pressed = null;
  try {
    const before = shown; // the board as the player sees it now
    const events = session.doAction(action);
    const nothingHappened = !events || events.length === 0 || events[0].type === 'invalid';
    const swapMs = 70 * speedFactor();

    if (nothingHappened) {
      // Not a legal move. It costs nothing; show a small "no".
      // Only pieces and power-ups can slide; an obstacle, a sandbag or an
      // empty cell stays put and the board gives a small shake instead.
      const canSlide = (p) => {
        const c = get(before, p.x, p.y);
        return Boolean(c) && (c.t === 'piece' || c.t === 'power');
      };
      if (action.type === 'swap' && canSlide(action.a) && canSlide(action.b)) {
        await playSwap(before, action.a, action.b, drawFrame, swapMs, true);
      } else shake();
      drawFrame(before);
    } else {
      ui.hud({ ...session.game, targets: shownTargets }); // moves drop at once
      if (action.type === 'swap') await playSwap(before, action.a, action.b, drawFrame, swapMs, false);
      await playEvents(events, drawFrame, theme, speed(), before);
      // Finish on exactly what the rules say the board is now.
      drawFrame(cloneBoard(session.game.board));
    }
    rememberTargets();
    ui.hud(session.game);

    if (session.isOver()) {
      const levelN = session.game.level.n;
      await wait(350); // a moment to see the final board
      const result = session.finish();
      goResults(result, levelN);
    }
  } catch (err) {
    console.error(err);
    if (session.game) drawFrame(cloneBoard(session.game.board));
  } finally {
    busy = false;
  }
}

// The target counts as last shown, so they change only when the pieces have
// finished clearing on screen (the moves number changes straight away).
let shownTargets = [];
function rememberTargets() {
  shownTargets = session.game.targets.map((t) => ({ ...t }));
}

function shake() {
  canvas.classList.remove('shake');
  void canvas.offsetWidth; // lets the same shake play twice in a row
  canvas.classList.add('shake');
}

attachInput(
  canvas,
  () => layout,
  () => shown,
  handleAction,
  () => busy || !onLevel || !layout || !shown,
  (cell) => { // highlight the cell under the finger
    pressed = cell;
    if (!busy && shown) drawFrame(shown);
  },
);

// ---- Buttons ----

function startLevel() {
  goLevel();
  rememberTargets();
}

$('home-play').onclick = startLevel;
$('home-settings').onclick = () => goSettings('');
$('results-next').onclick = startLevel;
$('results-home').onclick = goHome;
$('settings-back').onclick = goHome;

$('level-quit').onclick = async () => {
  if (busy) return;
  const yes = await ui.confirm('Quit this level? It will count as a loss.', 'Quit level', 'Keep playing');
  if (!yes || busy) return;
  const levelN = session.game.level.n;
  goResults(session.quit(), levelN);
};

$('speed-normal').onclick = () => { session.setSetting('speed', 'normal'); ui.settings(session, ''); };
$('speed-fast').onclick = () => { session.setSetting('speed', 'fast'); ui.settings(session, ''); };

// Hand the player a file to keep.
function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Today's date as YYYY-MM-DD, for file names.
function today() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

$('settings-export').onclick = () => {
  try {
    downloadText(`places-please-save-${today()}.json`, session.exportText(), 'application/json');
    // Record that an export happened (this stops the reminder on Home).
    if (typeof session.markExported === 'function') session.markExported();
    ui.settings(session, 'Save exported. Keep the file somewhere safe.');
  } catch (err) {
    ui.settings(session, 'Export did not work: ' + err.message);
  }
};

$('settings-import').onclick = () => {
  $('settings-file').value = ''; // so picking the same file twice still works
  $('settings-file').click();
};

$('settings-file').onchange = async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const yes = await ui.confirm(
    `Replace your current progress with "${file.name}"? This cannot be undone.`,
    'Replace', 'Cancel');
  if (!yes) return;
  try {
    session.importText(await file.text());
    ui.settings(session, `Imported. You are on level ${session.save.level}.`);
  } catch (err) {
    ui.settings(session, 'That file is not a Places, Please save. Nothing was changed.');
  }
};

$('settings-recovered-btn').onclick = () => {
  if (!session.recovered) return;
  downloadText(`places-please-recovered-${today()}.txt`, session.recovered, 'text/plain');
};

// ---- Start ----

goHome();

// Lets the game open without a network connection once it has been loaded.
// Offline support. Skipped on this PC (localhost) so that edits show up at once
// while developing; on the phone it is always on.
const onDevPc = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw=1');
if ('serviceWorker' in navigator && !onDevPc) navigator.serviceWorker.register('./sw.js').catch(() => {});
