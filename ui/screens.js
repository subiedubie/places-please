// SCREENS: fills in the words and numbers on Home, Level, Results and
// Settings. The screens themselves are laid out in index.html; this file
// only shows one at a time and writes the current values into them.
// What happens when a button is pressed is decided in ui/main.js.

import { drawTargetIcon, drawPowerIcon } from './render.js';
import { drawArt } from './art.js';
import { ECONOMY } from '../config/economy.js';
import { nameFor } from '../config/help.js';
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
    c.style.width = c.style.height = size + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx);
    return c;
  }

  // What a target is called: a piece name, an obstacle name, or 'Sandbag'.
  function targetName(t) {
    if (typeof t.block === 'string') {
      if (t.block === DROPPER.id) return DROPPER.name;
      return nameFor(t.block);
    }
    return theme.pieces[t.color] ? theme.pieces[t.color].name : 'Piece';
  }

  // ---- Home ----
  // save: the saved progress.  tier: the tier of the next level if known.
  // resuming: true if a level is in progress (the button then says Continue).
  // gift: what the win streak gives the next level, from session.nextGift():
  //       { powers: ['spot-h', ...], superPrism: true/false }. Leave it out
  //       (or pass null) to show nothing.
  // retry: true if the last try at this level was lost (the button says Retry).
  function home(save, tier, resuming, gift, retry) {
    $('home-title').textContent = theme.name;
    $('home-tier').textContent = tierName(tier);
    $('screen-home').dataset.tier = tier ? String(tier) : '';
    $('home-level').textContent = 'Level ' + num(save.level);
    stopCoinTick(); // a count-up still running would write over the new number
    $('home-coins').textContent = num(save.coins);
    // (The win streak has no box of its own: it shows as the gift card below.)
    $('home-play').textContent = resuming ? 'Continue' : (retry ? 'Retry' : 'Play');

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

    // A dot on Settings when the save has not been exported for a while.
    const last = save.lastExport;
    $('home-settings').classList.toggle('due', !last || Date.now() - last > EXPORT_REMINDER_DAYS * DAY_MS);
  }

  // ---- Home, right after a level: the coins counting up, and the banner ----

  const COIN_TICK_MS = 1000;   // how long the coin count takes to climb
  const BANNER_MS = 7000;      // how long the round banner stays before it leaves by itself

  // People who ask their phone for less motion get the final numbers at once.
  const lessMotion = () => Boolean(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let coinTick = 0; // the running count-up, so it can be stopped
  function stopCoinTick() {
    if (coinTick) cancelAnimationFrame(coinTick);
    coinTick = 0;
  }

  // Count the coins card up from `from` to `to` over about a second.
  function tickCoins(from, to) {
    stopCoinTick();
    const el = $('home-coins');
    if (lessMotion() || from === to) { el.textContent = num(to); return; }
    const began = performance.now();
    el.textContent = num(from);
    const step = (t) => {
      const part = Math.min(1, (t - began) / COIN_TICK_MS);
      const eased = 1 - (1 - part) * (1 - part); // quick at first, slowing at the end
      el.textContent = num(Math.round(from + (to - from) * eased));
      coinTick = part < 1 ? requestAnimationFrame(step) : 0;
    };
    coinTick = requestAnimationFrame(step);
  }

  // The banner in the title's place: "Level 23 won", "+175 coins", details.
  // It leaves after a few seconds or when tapped. onDetails: what the
  // "details" link does.
  let bannerTimer = 0;
  function hideRoundBanner() {
    clearTimeout(bannerTimer);
    // Guarded: an older copy of the page (mid-update on the phone) has no banner.
    const banner = $('home-round');
    const title = $('home-title');
    if (banner) banner.hidden = true;
    if (title) title.style.visibility = '';
  }
  function roundBanner(result, levelN, onDetails) {
    const won = result.status === 'won';
    const coins = (result.settlement && result.settlement.coins) || 0;
    const box = $('home-round');
    box.classList.toggle('won', won);
    box.classList.toggle('lost', !won);
    $('home-round-title').textContent = `Level ${num(levelN)} ${won ? 'won' : 'lost'}`;
    $('home-round-coins').textContent = coins > 0 ? `+${num(coins)} coins` : 'No coins this time';
    box.hidden = false;
    $('home-title').style.visibility = 'hidden'; // the banner covers the title
    box.onclick = hideRoundBanner; // a tap anywhere on it sends it away
    $('home-round-details').onclick = (e) => {
      e.stopPropagation(); // do not also dismiss the banner
      onDetails();
    };
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideRoundBanner, BANNER_MS);
  }

  // ---- Level: the bar above the board ----
  // A small picture of a target (a piece or an obstacle) for the target list.
  function targetIcon(target) {
    return iconCanvas(34, (ctx) => drawTargetIcon(ctx, target, 34, theme));
  }

  let targetKey = '';   // which targets the chips were built for
  let targetCounts = []; // the number element of each chip

  function hud(game) {
    // A bonus level (every 10th) shows its own name instead of the tier.
    $('screen-level').dataset.tier = game.level.tier ? String(game.level.tier) : '';
    $('hud-tier').textContent = game.level.bonus && theme.bonusName ? theme.bonusName : tierName(game.level.tier);
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

    coinLines(result, $('results-lines'));
  }

  // The coin lines of a finished level ("Level won +50 ... Total 175 coins"),
  // written into `box`. Used by the Results screen and by the details sheet
  // that opens from the banner on Home.
  function coinLines(result, box) {
    const won = result.status === 'won';
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

  // ---- Before a level: what it asks for, and the boosters to start with ----
  // extra: what winning it pays on top (a Medium or Hard level), or null.
  function prelevel(level, save, extra, renderReward) {
    $('pre-title').textContent = 'Level ' + num(save.level);
    $('pre-tier').textContent = level && level.bonus && theme.bonusName ? theme.bonusName : tierName(level && level.tier);
    const box = $('pre-targets');
    box.textContent = '';
    for (const t of (level && level.targets) || []) {
      const chip = document.createElement('div');
      chip.className = 'target';
      chip.setAttribute('aria-label', targetName(t));
      const n = document.createElement('span');
      n.textContent = num(t.need);
      chip.append(iconCanvas(44, (ctx) => drawTargetIcon(ctx, t, 44, theme)), n);
      box.appendChild(chip);
    }
    const win = $('pre-win');
    win.textContent = '';
    win.hidden = !extra;
    if (extra) {
      const label = document.createElement('div');
      label.className = 'pre-win-label';
      label.textContent = `Win for ${level.tier + 1}x event points and`;
      win.append(label, renderReward({ coins: ECONOMY.winCoins[level.tier], ...extra }, 28));
    }
    $('prelevel').dataset.tier = level && !level.bonus ? String(level.tier) : '';
    $('prelevel').hidden = false;
    $('pre-play').focus({ preventScroll: true });
  }

  // ---- After a level: stays up until it is closed ----
  // fill(box) adds what the side games gained.
  function finish(result, levelN, fill) {
    return new Promise((done) => {
      const won = result.status === 'won';
      const box = $('finish');
      box.classList.toggle('lost', !won);
      $('fin-title').textContent = 'Level ' + num(levelN);
      $('fin-word').textContent = won ? 'Bravo!' : 'Not this time';
      const art = $('fin-art');
      art.textContent = '';
      const name = won ? 'badge-trophy' : 'badge-masks';
      art.appendChild(iconCanvas(120, (ctx) => drawArt(ctx, name, 60, 60, 120, 120)));
      coinLines(result, $('fin-lines'));
      const more = $('fin-events');
      more.textContent = '';
      fill(more);
      more.scrollTop = 0;
      box.hidden = false;
      const close = () => {
        box.hidden = true;
        $('fin-ok').onclick = null;
        $('fin-x').onclick = null;
        done();
      };
      $('fin-ok').onclick = close;
      $('fin-x').onclick = close;
    });
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

  return { show, home, hud, results, coinLines, tickCoins, roundBanner, hideRoundBanner, settings, confirm, prelevel, finish, $ };
}
