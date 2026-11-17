// BOOSTERS ON SCREEN: the booster bar under the board, the "out of moves"
// sheet, and the row of pre-level boosters on Home. Also draws the four
// booster icons (ui/events.js uses the same drawings for rewards).
//
// The rules and the prices are not here: this file asks the Session
// (meta/session.js, meta/shop.js) and shows the answers. The places these
// things appear in are laid out in index.html (ids: booster-bar,
// booster-hint, home-boosters, out-of-moves).

import { cellAt } from './input.js';
import { drawPowerIcon } from './render.js';
import { priceOf, countOf, canAfford, extraMovesCount, IN_LEVEL_BOOSTERS, PRE_LEVEL_BOOSTERS, PRE_BOOSTER_POWER } from '../meta/shop.js';

const $ = (id) => document.getElementById(id);
const num = (n) => Number(n || 0).toLocaleString('en-US');

// ---- The icons --------------------------------------------------------------

// A small picture of a booster, filling a square of side `size` whose
// top-left corner is at (0, 0).
//   kind: 'drill' | 'stageleft' | 'trapdoor' | 'coinflip'
//         ('spot' | 'show' | 'prism' draw the power-up the booster gives)
// Colors come from theme.boosterColors (config/theme.js).
export function drawBoosterIcon(ctx, kind, size, theme) {
  const col = (theme && theme.boosterColors) || {};
  const steel = col.steel || '#6f7a8c';
  const red = col.handle || '#c62f2f';
  const gold = col.coin || '#e0a100';
  const goldEdge = col.coinEdge || '#8a5a2b';
  const s = size;

  if (PRE_BOOSTER_POWER[kind]) {
    drawPowerIcon(ctx, PRE_BOOSTER_POWER[kind], size, theme);
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (kind === 'drill') {
    // A hand drill pointing down and to the right: red body, steel bit.
    ctx.translate(s / 2, s / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = red;
    ctx.fillRect(-s * 0.38, -s * 0.16, s * 0.34, s * 0.32);   // body
    ctx.fillRect(-s * 0.30, s * 0.10, s * 0.14, s * 0.24);    // grip
    ctx.fillStyle = goldEdge;
    ctx.fillRect(-s * 0.04, -s * 0.10, s * 0.08, s * 0.20);   // collar
    ctx.fillStyle = steel;
    ctx.beginPath();                                          // the bit
    ctx.moveTo(s * 0.04, -s * 0.09);
    ctx.lineTo(s * 0.42, 0);
    ctx.lineTo(s * 0.04, s * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';                              // the twist marks
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const x of [0.12, 0.22]) {
      ctx.beginPath();
      ctx.moveTo(s * x, -s * 0.06 * (1 - x));
      ctx.lineTo(s * (x + 0.05), s * 0.06 * (1 - x));
      ctx.stroke();
    }
  } else if (kind === 'stageleft' || kind === 'trapdoor') {
    // A row of three cells with an arrow through it. Stage Left points
    // left along a row; Trapdoor is the same picture turned to point down.
    ctx.translate(s / 2, s / 2);
    if (kind === 'trapdoor') ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = steel;
    ctx.globalAlpha = 0.35;
    const box = s * 0.22;
    for (const i of [-1, 0, 1]) ctx.fillRect(i * (box + s * 0.04) - box / 2, -box / 2, box, box);
    ctx.globalAlpha = 1;
    ctx.fillStyle = red;
    ctx.beginPath();                                          // the arrow
    ctx.moveTo(-s * 0.42, 0);
    ctx.lineTo(-s * 0.14, -s * 0.24);
    ctx.lineTo(-s * 0.14, -s * 0.09);
    ctx.lineTo(s * 0.40, -s * 0.09);
    ctx.lineTo(s * 0.40, s * 0.09);
    ctx.lineTo(-s * 0.14, s * 0.09);
    ctx.lineTo(-s * 0.14, s * 0.24);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'coinflip') {
    // A gold coin, with two small marks showing it spinning.
    ctx.fillStyle = gold;
    ctx.strokeStyle = goldEdge;
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();                                          // the mark on the coin
    ctx.moveTo(s * 0.50, s * 0.36);
    ctx.lineTo(s * 0.60, s * 0.50);
    ctx.lineTo(s * 0.50, s * 0.64);
    ctx.lineTo(s * 0.40, s * 0.50);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = red;                                    // the spin marks
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, -Math.PI * 0.85, -Math.PI * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, Math.PI * 0.15, Math.PI * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

// A small sharp canvas with one booster drawn on it.
function iconCanvas(kind, size, theme) {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement('canvas');
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBoosterIcon(ctx, kind, size, theme);
  return c;
}

// ---- The screens ------------------------------------------------------------

// Set up the booster parts of the screens. ui/main.js calls this once.
//   session    the Session (meta/session.js)
//   theme      config/theme.js
//   canvas     the board canvas (a tap on it uses the armed booster)
//   getLayout  () => where the board sits in the canvas
//   isBusy     () => true while a move is being played back
//   play       (action) => plays { type: 'booster', kind, at } like a move
//   confirm    (text, yes, no) => Promise<boolean>, the yes/no question
//   onHomeChange  () => redraw Home (after a purchase changes the coins)
export function createBoosterUi({ session, theme, canvas, getLayout, isBusy, play, confirm, onHomeChange }) {
  let armed = null; // the booster waiting for a cell to be tapped, or null

  const nameOf = (kind) => (theme.boosters && theme.boosters[kind] ? theme.boosters[kind].name : kind);
  const hint = (text) => { const el = $('booster-hint'); if (el) el.textContent = text || ''; };

  // One round button: the icon, and under it how many the player owns
  // (or the price, when they own none).
  function button(kind) {
    const have = countOf(session.save, kind);
    const b = document.createElement('button');
    b.className = 'booster' + (have === 0 ? ' empty' : '');
    b.setAttribute('aria-label', have > 0 ? `${nameOf(kind)}, ${have} left` : `Buy ${nameOf(kind)} for ${priceOf(kind)} coins`);
    b.appendChild(iconCanvas(kind, 34, theme));
    const tag = document.createElement('span');
    tag.className = 'booster-count';
    tag.textContent = have > 0 ? String(have) : '+' + num(priceOf(kind));
    b.appendChild(tag);
    return b;
  }

  // Ask to buy one booster. Returns true if it was bought.
  async function offerToBuy(kind) {
    const price = priceOf(kind);
    if (!canAfford(session.save, kind)) {
      hint(`${nameOf(kind)} costs ${num(price)} coins. You have ${num(session.save.coins)}.`);
      return false;
    }
    const yes = await confirm(`Buy one ${nameOf(kind)} for ${num(price)} coins? You have ${num(session.save.coins)}.`, 'Buy', 'Cancel');
    return yes && session.buyBooster(kind);
  }

  // ---- The bar under the board ----
  function refreshBar() {
    const bar = $('booster-bar');
    if (!bar) return;
    bar.textContent = '';
    for (const kind of IN_LEVEL_BOOSTERS) {
      const b = button(kind);
      b.classList.toggle('armed', armed === kind);
      b.onclick = async () => {
        if (isBusy() || !session.game) return;
        hint('');
        if (countOf(session.save, kind) === 0) {
          // None left: offer one at its price.
          armed = null;
          await offerToBuy(kind);
          refreshBar();
        } else if (kind === 'coinflip') {
          // Needs no cell: goes off at once.
          armed = null;
          refreshBar();
          await play({ type: 'booster', kind });
          refreshBar();
        } else {
          // Arm it; a second tap on the same button cancels.
          armed = armed === kind ? null : kind;
          hint(armed ? `${nameOf(kind)}: tap a square on the board. Tap the button again to cancel.` : '');
          refreshBar();
        }
      };
      bar.appendChild(b);
    }
  }

  function disarm() {
    if (!armed) return;
    armed = null;
    hint('');
    refreshBar();
  }

  // A tap on the board while a booster is armed uses it on that cell.
  // (While armed, main.js tells the normal swipe input to stand aside.)
  canvas.addEventListener('pointerup', async (e) => {
    if (!armed || isBusy()) return;
    const layout = getLayout();
    if (!layout) return;
    const r = canvas.getBoundingClientRect();
    const at = cellAt(e.clientX - r.left, e.clientY - r.top, layout);
    if (!at) return; // off the board: stay armed
    const kind = armed;
    armed = null;
    hint('');
    refreshBar();
    await play({ type: 'booster', kind, at });
    refreshBar();
  });

  // ---- The "out of moves" sheet ----
  // Shown when a level is lost. Gives back true if the player bought more
  // moves (the level carries on), false if they gave up.
  function outOfMoves() {
    return new Promise((answer) => {
      const box = $('out-of-moves');
      const price = priceOf('moves');
      const count = extraMovesCount();
      const enough = canAfford(session.save, 'moves');
      $('oom-buy').textContent = `${count} more moves for ${num(price)} coins`;
      $('oom-buy').disabled = !enough;
      $('oom-note').textContent = enough
        ? `You have ${num(session.save.coins)} coins.`
        : `Not enough coins: you have ${num(session.save.coins)}, this costs ${num(price)}.`;
      box.hidden = false;
      const close = (value) => {
        box.hidden = true;
        $('oom-buy').onclick = null;
        $('oom-quit').onclick = null;
        answer(value);
      };
      $('oom-buy').onclick = () => close(session.buyMoves());
      $('oom-quit').onclick = () => close(false);
    });
  }

  // ---- Home: the pre-level boosters, and the bonus-level label ----
  // resuming: true if a level is already in progress (its boosters were
  // chosen when it started, so the row is hidden).
  function refreshHome(resuming) {
    // A bonus level shows its own name where the tier name goes.
    const next = resuming && session.save.current ? session.save.current.level : session.peekLevel();
    if (next && next.bonus && theme.bonusName && $('home-tier')) $('home-tier').textContent = theme.bonusName;

    const row = $('home-boosters');
    if (!row) return;
    row.hidden = Boolean(resuming);
    row.textContent = '';
    if (resuming) return;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = 'Start with (tap to choose)';
    const icons = document.createElement('div');
    icons.className = 'booster-bar';
    const note = document.createElement('div');
    note.className = 'note';
    note.id = 'booster-hint-home';
    for (const kind of PRE_LEVEL_BOOSTERS) {
      const b = button(kind);
      b.classList.toggle('armed', session.preBoosters.includes(kind));
      b.setAttribute('aria-pressed', String(session.preBoosters.includes(kind)));
      b.onclick = async () => {
        if (countOf(session.save, kind) === 0) {
          const price = priceOf(kind);
          if (!canAfford(session.save, kind)) {
            note.textContent = `${nameOf(kind)} costs ${num(price)} coins. You have ${num(session.save.coins)}.`;
            return;
          }
          const yes = await confirm(`Buy one ${nameOf(kind)} for ${num(price)} coins? You have ${num(session.save.coins)}.`, 'Buy', 'Cancel');
          if (yes && session.buyBooster(kind)) onHomeChange(); // coins changed: redraw Home
          return;
        }
        // Switch it on or off for the next level.
        const on = session.preBoosters.includes(kind);
        session.setPreBoosters(on ? session.preBoosters.filter((k) => k !== kind) : session.preBoosters.concat(kind));
        refreshHome(false);
      };
      icons.appendChild(b);
    }
    row.append(label, icons, note);
  }

  return { refreshBar, refreshHome, outOfMoves, disarm, armed: () => armed };
}
