// SCREENS: fills in the words and numbers on Home, Level, Results and
// Settings. The screens themselves are laid out in index.html; this file
// only shows one at a time and writes the current values into them.
// What happens when a button is pressed is decided in ui/main.js.

import { drawTargetIcon, drawPowerIcon } from './render.js';
import { OBSTACLES, DROPPER } from '../config/obstacles.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPORT_REMINDER_DAYS = 14; // remind to export after this many days

const $ = (id) => document.getElementById(id);
const num = (n) => Number(n || 0).toLocaleString('en-US');

export function createScreens(theme) {
  const screens = {
    home: $('screen-home'),
    level: $('screen-level'),
    results: $('screen-results'),
    settings: $('screen-settings'),
  };

  // Show one screen and hide the others.
  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  }

  // The name of a difficulty tier, or '' if we do not know the tier.
  function tierName(tier) {
    return typeof tier === 'number' && theme.tiers[tier] ? theme.tiers[tier] : '';
  }

  // A small canvas, sharp on high-resolution screens, that `paint(ctx)`
  // draws one picture on. The picture fills a square of side `size`.
  function iconCanvas(size, paint) {
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx);
    return c;
  }

  // What a target is called: a piece name, an obstacle name, or 'Sandbag'.
  function targetName(t) {
    if (typeof t.block === 'string') {
      if (t.block === DROPPER.id) return DROPPER.name;
      return OBSTACLES[t.block] ? OBSTACLES[t.block].name : 'Obstacle';
    }
    return theme.pieces[t.color] ? theme.pieces[t.color].name : 'Piece';
  }

  // ---- Home ----
  // save: the saved progress.  tier: the tier of the next level if known.
  // resuming: true if a level is in progress (the button then says Continue).
  // gift: what the win streak gives the next level, from session.nextGift():
  //       { powers: ['spot-h', ...], superPrism: true/false }. Leave it out
  //       (or pass null) to show nothing.
  function home(save, tier, resuming, gift) {
    $('home-title').textContent = theme.name;
    $('home-tier').textContent = tierName(tier) || 'Next up';
    $('home-level').textContent = 'Level ' + num(save.level);
    $('home-coins').textContent = num(save.coins);
    $('home-streak').textContent = num(save.streak);
    $('home-play').textContent = resuming ? 'Continue' : 'Play';

    // The streak gift: the free power-ups the next level starts with, and
    // whether the Super Magic Ball is on.
    const powers = gift && Array.isArray(gift.powers) ? gift.powers : [];
    const superOn = Boolean(gift && gift.superPrism);
    const giftIcons = $('home-gift-icons');
    giftIcons.textContent = '';
    for (const kind of powers) {
      const icon = iconCanvas(36, (ctx) => drawPowerIcon(ctx, kind, 36, theme));
      const name = theme.powers[kind] ? theme.powers[kind].name : 'Power-up';
      icon.setAttribute('role', 'img');
      icon.setAttribute('aria-label', name);
      giftIcons.appendChild(icon);
    }
    $('home-gift-label').hidden = powers.length === 0;
    giftIcons.hidden = powers.length === 0;
    $('home-gift-super').hidden = !superOn;
    $('home-gift').hidden = powers.length === 0 && !superOn;

    // One line asking for an export if there has never been one, or the
    // last one is more than 14 days old.
    const last = save.lastExport;
    const reminder = $('home-reminder');
    if (!last) {
      reminder.textContent = 'Your progress has not been exported yet. Export it in Settings.';
      reminder.hidden = false;
    } else if (Date.now() - last > EXPORT_REMINDER_DAYS * DAY_MS) {
      const days = Math.floor((Date.now() - last) / DAY_MS);
      reminder.textContent = `Last export was ${days} days ago. Export again in Settings.`;
      reminder.hidden = false;
    } else {
      reminder.hidden = true;
    }
  }

  // ---- Level: the bar above the board ----
  // A small picture of a target (a piece or an obstacle) for the target list.
  function targetIcon(target) {
    return iconCanvas(34, (ctx) => drawTargetIcon(ctx, target, 34, theme));
  }

  let targetKey = '';   // which targets the chips were built for
  let targetCounts = []; // the number element of each chip

  function hud(game) {
    $('hud-tier').textContent = tierName(game.level.tier);
    $('hud-level').textContent = 'Level ' + num(game.level.n);
    $('hud-moves').textContent = String(game.movesLeft);

    // Build the target chips once per level; after that only the numbers change.
    // (A target is either a piece color or an obstacle kind.)
    const key = game.level.n + ':' + game.targets
      .map((t) => (typeof t.block === 'string' ? 'b-' + t.block : 'c-' + t.color)).join(',');
    const box = $('hud-targets');
    if (key !== targetKey) {
      targetKey = key;
      targetCounts = [];
      box.textContent = '';
      for (const t of game.targets) {
        const chip = document.createElement('div');
        chip.className = 'target';
        chip.setAttribute('aria-label', targetName(t));
        chip.appendChild(targetIcon(t));
        const count = document.createElement('span');
        chip.appendChild(count);
        box.appendChild(chip);
        targetCounts.push(count);
      }
    }
    game.targets.forEach((t, i) => {
      const left = Math.max(0, t.need - t.have); // how many are still needed
      // Show how many are left, or a check mark once the target is met.
      targetCounts[i].textContent = left === 0 ? '\u2713' : String(left);
      targetCounts[i].parentElement.classList.toggle('done', left === 0);
    });
  }

  // ---- Results ----
  // result: what session.finish() or session.quit() returned.
  // levelN: the number of the level that was just played.
  function results(result, levelN) {
    const won = result.status === 'won';
    $('results-sub').textContent = 'Level ' + num(levelN);
    $('results-title').textContent = won ? 'Won' : 'Lost';
    $('results-next').textContent = won ? 'Next' : 'Retry';

    const box = $('results-lines');
    box.textContent = '';
    const addLine = (label, value, cls) => {
      const row = document.createElement('div');
      row.className = 'line' + (cls ? ' ' + cls : '');
      const a = document.createElement('span');
      a.textContent = label;
      const b = document.createElement('span');
      b.textContent = value;
      row.append(a, b);
      box.appendChild(row);
    };
    const settlement = result.settlement || { coins: 0, lines: [] };
    for (const line of settlement.lines || []) addLine(line.label, '+' + num(line.coins));
    if (!won && (settlement.lines || []).length === 0) addLine('No coins this time', '');
    addLine('Total', num(settlement.coins) + ' coins', 'total');
  }

  // ---- Settings ----
  // message: one line of feedback ("Save exported", an import error...).
  function settings(session, message) {
    const speed = (session.save.settings && session.save.settings.speed) || 'normal';
    $('speed-normal').classList.toggle('on', speed !== 'fast');
    $('speed-fast').classList.toggle('on', speed === 'fast');

    const last = session.save.lastExport;
    $('settings-export-note').textContent = last
      ? 'Last exported ' + new Date(last).toLocaleDateString()
      : 'Never exported. Progress lives only on this phone until you export it.';

    $('settings-recovered').hidden = !session.recovered;
    $('settings-msg').textContent = message || '';
  }

  // ---- A yes/no question. Gives back true for yes, false for no. ----
  function confirm(text, yesLabel, noLabel) {
    return new Promise((answer) => {
      const box = $('confirm');
      $('confirm-text').textContent = text;
      $('confirm-yes').textContent = yesLabel;
      $('confirm-no').textContent = noLabel;
      box.hidden = false;
      const close = (value) => {
        box.hidden = true;
        $('confirm-yes').onclick = null;
        $('confirm-no').onclick = null;
        answer(value);
      };
      $('confirm-yes').onclick = () => close(true);
      $('confirm-no').onclick = () => close(false);
    });
  }

  return { show, home, hud, results, settings, confirm, $ };
}
