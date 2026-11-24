// MAIN: ties the screens, the board drawing, the touch input and the saved
// game together. The order of play is  Home -> Level -> Home (which shows
// what the level earned), with Settings reachable from Home.
//
// All the rules and the saving live in the Session object (meta/session.js).
// This file only asks it things and shows the answers.

import { createSession } from '../meta/session.js';
import { cloneBoard, get } from '../engine/board.js';
import { theme } from '../config/theme.js';
import { fitCanvas, layoutFor, drawBoard, drawTargetIcon } from './render.js';
import { attachInput } from './input.js';
import { playEvents, playSwap, wait } from './anim.js';
import { createScreens } from './screens.js';
import { createEvents } from './events.js';
import { createBoosterUi } from './boosters.js';
import { createStage } from './stage.js'; // the PixiJS drawing of the board
import { loadArt } from './art.js';
import { createShopUi } from './shop.js';
import { fx } from './fx.js';
import { flyTo } from './fly.js';
import { initHelp, showLevelIntro } from './help.js'; // rule cards, "?" and How to play

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
// The side games, rewards tray and album (ui/events.js). After a reward is
// claimed or an event started, Home is drawn again if it is showing.
const eventUi = createEvents(session, () => { if (!ui.$('screen-home').hidden) goHome(); });
const $ = ui.$;
const canvas = $('board');

let stage = null;    // PixiJS, or null if this phone cannot (then ctx is used)
let ctx = null;      // the drawing surface of the canvas
let layout = null;   // where the board sits inside the canvas
let shown = null;    // the board as currently drawn (our own copy)
let busy = false;    // true while a move is being played back
let pressed = null;  // the cell under the player's finger, if any
let onLevel = false; // true while the Level screen is showing

// The booster bar, the out-of-moves sheet and the pre-level boosters on Home
// (ui/boosters.js). A booster is played back through handleAction like a move.
const boosters = createBoosterUi({
  session, theme, canvas,
  getLayout: () => layout,
  isBusy: () => busy || !onLevel,
  play: (action) => handleAction(action),
  confirm: (text, yes, no) => ui.confirm(text, yes, no),
  onHomeChange: () => goHome(),
});

// The Box Office: opened from the coins card on Home.
const shopUi = createShopUi({
  session, eventUi,
  confirm: (text, yes, no) => ui.confirm(text, yes, no),
  onChange: () => { if (!ui.$('screen-home').hidden) goHome(); },
});

const speed = () => (session.save.settings && session.save.settings.speed) || 'normal';
const speedFactor = () => (speed() === 'fast' ? 0.5 : 1);

// ---- Drawing ----

// Paint a board. The animations call this many times a second.
function drawFrame(board, overlay) {
  if ((!ctx && !stage) || !layout || !board) return;
  shown = board;
  // superPrism: Magic Balls are drawn in their Super form on a Super level.
  const extra = { ...(overlay || {}), superPrism: !!(session.game && session.game.superPrism) };
  if (pressed && (!busy || open)) extra.pressed = pressed;
  if (stage) stage.draw(board, layout, extra);
  else drawBoard(ctx, board, layout, theme, extra);
}

// Measure the canvas again (first showing, phone rotated, window resized).
function refit() {
  if (!onLevel || !session.game) return;
  const fit = stage ? stage.fit() : fitCanvas(canvas);
  ctx = fit.ctx || null;
  const b = session.game.board;
  layout = layoutFor(fit.w, fit.h, b.cols, b.rows);
  drawFrame(shown || cloneBoard(b));
}
window.addEventListener('resize', refit);

// ---- Moving between screens ----

// round: leave out normally. Right after a level it is
//   { result, levelN, coinsBefore, before }   (see endLevel below)
// and Home then shows what the level earned: the banner, the coins counting
// up, and a "+3" on each side-game badge that gained something.
function goHome(round) {
  onLevel = false;
  if (stage) stage.show(false);
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
  // The last try at this level was lost: the button says Retry. (The side
  // games remember the lost level in the save, so this survives a restart.)
  const retry = !resuming && Boolean(save.events) && save.events.failedLevel === save.level;
  ui.home(save, tier, resuming, gift, retry);
  shopUi.home();
  boosters.refreshHome(resuming); // pre-level boosters, and the bonus-level name
  ui.show('home'); // before the badges: they are sized to the height of Home
  eventUi.home(round ? { result: round.result, before: round.before } : null);
  if (round) {
    ui.roundBanner(round.result, round.levelN,
      () => eventUi.openRound(round.result, round.levelN, (box) => ui.coinLines(round.result, box)));
    ui.tickCoins(round.coinsBefore, save.coins);
  }
}

// A level has ended (won, lost or quit): settle it and go straight back to
// Home, which shows what it earned. `settle` is session.finish or session.quit.
function endLevel(settle) {
  const levelN = session.game.level.n;
  const coinsBefore = session.save.coins;  // to count the coins card up from
  const before = eventUi.snapshot();       // what each badge showed before
  const result = settle();
  if (!result) { goHome(); return; }
  goHome({ result, levelN, coinsBefore, before });
}

function goLevel() {
  const game = session.startLevel(); // carries on a level in progress if there is one
  shown = cloneBoard(game.board);
  busy = false;
  pressed = null;
  onLevel = true;
  ui.hideRoundBanner(); // the last level's banner on Home, if it is still up
  ui.hud(game);
  boosters.disarm();
  boosters.refreshBar(); // the booster bar under the board
  eventUi.level(); // the boost banner; before refit() because it takes height
  ui.show('level');
  if (stage) stage.show(true);
  refit(); // must come after show(): a hidden canvas has no size
}

// The old stand-alone Results screen. Nothing sends the player here any
// more (a level ends on Home, see endLevel); it is kept so it can be
// switched back on by calling it from endLevel.
function goResults(result, levelN) {
  onLevel = false;
  ui.results(result, levelN);
  eventUi.results(result);
  ui.show('results');
}

function goSettings(message) {
  onLevel = false;
  if (stage) stage.show(false);
  ui.settings(session, message);
  eventUi.settings();
  ui.show('settings');
}

// ---- Playing a move ----

// EARLY MOVES: while a move is playing out the player may already make the
// next one. It waits here until the pieces it needs have landed.
let open = false;      // true while early moves are being accepted
let wanted = null;     // { action, held } as the finger made it
let accepted = null;   // the one that will be made when this step ends
let landing = false;   // true while the step being played ends on a full board

const sameCell = (p, q) => JSON.stringify(p) === JSON.stringify(q);
const heldCells = (action, board) => (action.type === 'swap' ? [action.a, action.b] : [action.at]).map((p) => get(board, p.x, p.y));

// Can the waiting move be made on the board the pieces are landing on?
function considerEarly() {
  if (!wanted || accepted || !landing || !session.game) return;
  const now = heldCells(wanted.action, session.game.board);
  const { action, held } = wanted;
  wanted = null;
  if (now.every((c, i) => sameCell(c, held[i])) && session.canMove(action)) {
    accepted = action;
    pressed = null;
  }
}

function earlyAction(action) {
  if (action.type !== 'swap' && action.type !== 'tap') return;
  wanted = { action, held: heldCells(action, shown) };
  considerEarly();
}

async function handleAction(action) {
  if (!onLevel) return;
  if (busy) { if (open) earlyAction(action); return; }
  busy = true;
  pressed = null;
  wanted = null;
  accepted = null;
  try {
    const before = shown; // the board as the player sees it now
    const swapMs = 70 * speedFactor();
    const stepped = action.type === 'swap' || action.type === 'tap';
    // A booster goes through the same playback as a move, in one piece. 'wake'
    // does nothing on the board: it re-opens the out-of-moves sheet (startLevel).
    const move = stepped ? session.startMove(action) : null;
    let step = move ? move.next() : null;
    const events = stepped ? (step ? step.events : [])
      : action.type === 'booster' ? session.useBooster(action.kind, action.at) : [{ type: 'wake' }];
    const nothingHappened = !events || (events.length === 0 && !stepped) || (events[0] && events[0].type === 'invalid');

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
      if (!stepped) await playEvents(events, drawFrame, theme, speed(), before);
      else {
        open = true;
        while (step) {
          landing = step.landed;
          accepted = null;
          considerEarly(); // one made a moment ago, while gems were bursting
          await playEvents(step.events, drawFrame, theme, speed(), shown, landing ? () => accepted : null);
          rememberTargets();
          const early = accepted;
          step = move.next(early || undefined);
          ui.hud({ ...session.game, targets: shownTargets });
        }
        open = false;
      }
      // Finish on exactly what the rules say the board is now.
      drawFrame(cloneBoard(session.game.board));
    }
    rememberTargets();
    ui.hud(session.game);

    // Out of moves: offer more moves before the level is closed as a loss.
    // If the player buys them the level simply carries on.
    if (session.isOver() && session.game.status === 'lost' && await boosters.outOfMoves()) {
      ui.hud(session.game);
    } else if (session.isOver()) {
      await wait(350); // a moment to see the final board
      endLevel(() => session.finish()); // settle it and go straight to Home
    }
  } catch (err) {
    console.error(err);
    if (session.game) drawFrame(cloneBoard(session.game.board));
  } finally {
    busy = false;
    open = false;
    wanted = null;
    accepted = null;
  }
}

// The target counts as last shown, so they change only when the pieces have
// finished clearing on screen (the moves number changes straight away).
let shownTargets = [];
function rememberTargets() {
  shownTargets = session.game.targets.map((t) => ({ ...t }));
}

// Something the level still wants was just collected at cell (x, y): it flies
// up to its count at the top of the screen.
fx.collect = (x, y, cell) => {
  if (!onLevel || !layout) return;
  const i = shownTargets.findIndex((t) => t.have < t.need
    && (cell.t === 'piece' ? t.color === cell.color || (cell.fuse !== undefined && t.block === 'propbomb') || (cell.mimic && t.block === 'chameleon') : t.block === cell.kind));
  const chip = i >= 0 ? $('hud-targets').children[i] : null;
  if (!chip) return;
  const r = canvas.getBoundingClientRect();
  const from = {
    x: r.left + layout.originX + (x + 0.5) * layout.cell,
    y: r.top + layout.originY + (y + 0.5) * layout.cell,
  };
  const target = shownTargets[i];
  flyTo((g, size) => drawTargetIcon(g, target, size, theme), layout.cell * 0.8, from, chip,
    620 * speedFactor(), Math.random() * 120 * speedFactor());
};

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
  // (while a booster is armed, taps belong to it: see ui/boosters.js)
  () => (busy && !open) || !onLevel || !layout || !shown || Boolean(boosters.armed()),
  (cell) => { // highlight the cell under the finger
    pressed = cell;
    if (!busy && shown) drawFrame(shown);
  },
);

// ---- Buttons ----

function startLevel() {
  goLevel();
  rememberTargets();
  // A level closed while the out-of-moves sheet was showing: show it again.
  if (session.isOver()) handleAction({ type: 'wake' });
  // A card for each obstacle the player has not met before (ui/help.js).
  else showLevelIntro(session.game.level, session);
}
initHelp({ session }); // the "?" and "How to play" buttons

$('home-play').onclick = startLevel;
$('home-settings').onclick = () => goSettings('');
$('results-next').onclick = startLevel;
$('results-home').onclick = () => goHome();
$('settings-back').onclick = () => { ui.hideRoundBanner(); goHome(); };

$('level-quit').onclick = async () => {
  if (busy) return;
  const yes = await ui.confirm('Quit this level? It will count as a loss.', 'Quit level', 'Keep playing');
  if (!yes || busy) return;
  endLevel(() => session.quit()); // counts as a loss; straight back to Home
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

// Wait a moment for the pictures and the PixiJS stage; if either is slow or
// missing the game opens anyway with the simpler drawing.
const within = (p, ms, other) => Promise.race([p, wait(ms).then(() => other)]);
const stageReady = createStage(canvas, theme);
await within(loadArt(), 6000, false);
stage = await stageReady;
goHome();

// Lets the game open without a network connection once it has been loaded.
// Offline support. Skipped on this PC (localhost) so that edits show up at once
// while developing; on the phone it is always on.
const onDevPc = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw=1');
if ('serviceWorker' in navigator && !onDevPc) navigator.serviceWorker.register('./sw.js').catch(() => {});
