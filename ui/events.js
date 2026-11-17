// EVENTS SCREENS: the grid of side-game badges on Home (the pictures are
// drawn by ui/eventicons.js), the detail sheet of each side
// game, the rewards tray, the card album, the timed-boost banners, the extra
// lines on Results and the "Rival toughness" choice in Settings.
//
// This file only SHOWS things. Every rule lives in the Session object
// (meta/); the shapes it hands over are written down in docs/EVENTS.md.
// Every call to the session is guarded, so the screens still work (and show
// "No events yet") while that logic is missing or returns nothing.
//
// index.html holds four empty boxes this file fills:
//   #home-events      under the Play button
//   #level-boost      in the bar above the board
//   #results-events   under the coin lines
//   #settings-rivals  in Settings
// The pop-up sheet is made here and added to #app.

import { drawPowerIcon } from './render.js';
import { drawEventIcon } from './eventicons.js'; // the round picture badges
import { theme } from '../config/theme.js';

// ---- Words and numbers you may want to change ----

const TEXT = {
  noEvents: 'No events yet',
  start: 'Start',          // the pulsing pill on an event waiting to be started
  waiting: 'to claim',     // under the Rewards badge when nothing is about to expire
  rewards: 'Rewards',
  album: 'Playbill',
  trayEmpty: 'No rewards waiting. Prizes you win appear here until you claim them.',
  trayNote: 'Nothing is claimed for you. A timed reward starts its clock when you claim it.',
  newRewards: 'New rewards in your tray',
  openTray: 'Open rewards',
  boost: 'Free starting power-ups',
  rivalsLabel: 'Rival toughness',
  rivalsNote: "Rivals' speed is fixed when an event starts and never reacts to how you play.",
  grand: 'Grand prize',
};

// What each booster is called. A name in config/theme.js (theme.boosters)
// wins over these if it is there.
const BOOSTER_NAMES = {
  spot: 'Missile', show: 'Grenade', prism: 'Magic Ball',
  drill: 'Drill', stageleft: 'Stage Left', trapdoor: 'Trapdoor', coinflip: 'Coin Flip',
};

// The three rival settings: the value that is saved, and the word shown.
const RIVALS = [['relaxed', 'Relaxed'], ['even', 'Even'], ['tough', 'Tough']];

// The short name written under each badge on Home (there is only room for
// about twelve letters). The names on the left are the event names in
// config/events.js. An event not listed here shows its full title, cut off
// with "…" if it is too long.
const SHORT_NAMES = {
  weekly: 'Long Run',
  critics: 'Critics',
  'critics-streak': 'Rave Run',
  'props-rose': 'Prop Room',
  'props-lantern': 'Prop Room',
  'props-star': 'Prop Room',
  techweek: 'Tech Week',
  company: 'Company',
  dash: 'Dash',
  scottish: 'Scottish Play',
  ghostlight: 'Ghost Light',
  'quickchange-star': 'Quick Change',
  'quickchange-grenade': 'Quick Change',
  callbacks: 'Callbacks',
  season: 'Season',
  encore: 'Encore',
  callsheet: 'Call Sheet',
};

const BADGE_PX = 68;                 // how wide a badge picture is on Home
const HERO_PX = 88;                  // how wide it is at the top of a detail sheet
const REFRESH_MS = 20 * 1000;        // how often standings are asked for again
const GOLD = '#e0a100';
const GOLD_DARK = '#a87400';
const STEEL = '#6f7a8c';

// ---- Small helpers ----

const $ = (id) => document.getElementById(id);
const num = (n) => Number(n || 0).toLocaleString('en-US');
const list = (v) => (Array.isArray(v) ? v : []);

// Make an element:  h('div', 'class names', 'text').
function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

// Run something that may not exist yet or may fail; give `fallback` instead.
function safe(fn, fallback) {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch (err) {
    console.warn('events:', err);
    return fallback;
  }
}

// Time left, in words: "2d 3h", "5h 12m", "26 min", "40 s", "ended".
export function timeLeft(ms) {
  if (!(ms > 0)) return 'ended';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins % 60}m`;
  if (mins >= 1) return `${mins} min`;
  return `${Math.max(1, Math.ceil(ms / 1000))} s`;
}

// A length of time given in minutes: "30 min", "1 hour", "12 hours".
function minutesText(m) {
  const n = Number(m) || 0;
  if (n >= 60 && n % 60 === 0) return n === 60 ? '1 hour' : `${n / 60} hours`;
  return `${n} min`;
}

// "1st", "2nd", "3rd", "12th".
function ordinal(n) {
  const v = Number(n) || 0;
  const tens = v % 100;
  if (tens >= 11 && tens <= 13) return v + 'th';
  return v + (['th', 'st', 'nd', 'rd'][v % 10] || 'th');
}

// A big number made short enough for a badge bubble: 950, 1.2k, 5k, 12k.
function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 10000) return Math.round(v / 1000) + 'k';
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(v);
}

// The name written under an event's badge on Home.
function shortName(ev) {
  const key = String(ev.id === undefined || ev.id === null ? '' : ev.id).split('@')[0];
  return SHORT_NAMES[key] || String(ev.title || 'Event').replace(/^The /, '');
}

// The few characters shown in the bubble at the top right of a badge: the
// player's rank ("12th"), a fraction ("4/7", "6/25") or "✓" when complete.
// It is read from the event's summary line first ("12th of 50", "step 6/25",
// "stage 1: 2/3"), then from its progress numbers, then from the player's
// row in the standings. '' means no bubble.
function bubbleText(ev) {
  const summary = String(ev.summary || '');
  if (/^complete/i.test(summary)) return '✓';
  const rank = summary.match(/^(?:finished\s+)?(\d+(?:st|nd|rd|th))\b/i);
  if (rank) return rank[1];
  const frac = summary.match(/(\d+)\s*\/\s*(\d+)/) || summary.match(/(\d+)\s+of\s+(\d+)/i); // "round 2 of 3"
  if (frac) return `${shortNum(frac[1])}/${shortNum(frac[2])}`;
  if (ev.progress && ev.progress.need > 0) return `${shortNum(ev.progress.have)}/${shortNum(ev.progress.need)}`;
  const you = list(ev.rows).find((r) => r && r.you);
  if (you && you.place > 0) return ordinal(you.place);
  const count = summary.match(/^(\d+)\b/); // "3 scrolls" -> "3"
  return count ? shortNum(count[1]) : '';
}

// ---- Small pictures ----

// A small sharp canvas that `paint(ctx, size)` draws one picture on.
function icon(size, paint, label) {
  const c = document.createElement('canvas');
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.className = 'ev-icon';
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  try {
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, size);
  } catch (err) { /* no drawing surface: the label below still says what it is */ }
  if (label) {
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', label);
    c.title = label;
  }
  return c;
}

// A rectangle with rounded corners (older phones lack ctx.roundRect).
function rounded(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, r);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A gold coin centered at (cx, cy).
function paintCoin(ctx, s, cx = s / 2, cy = s / 2, r = s * 0.4) {
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = GOLD_DARK;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
}

// A pack of cards: two cards, the front one red with a gold diamond.
function paintPack(ctx, s) {
  ctx.fillStyle = theme.ui.line;
  rounded(ctx, s * 0.3, s * 0.1, s * 0.5, s * 0.7, s * 0.08); ctx.fill();
  ctx.fillStyle = theme.ui.accent;
  rounded(ctx, s * 0.18, s * 0.2, s * 0.5, s * 0.7, s * 0.08); ctx.fill();
  ctx.fillStyle = GOLD;
  const cx = s * 0.43, cy = s * 0.55, d = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy);
  ctx.closePath(); ctx.fill();
}

// Drill: a red body with a steel bit pointing down.
function paintDrill(ctx, s) {
  ctx.fillStyle = theme.ui.accent;
  rounded(ctx, s * 0.28, s * 0.1, s * 0.44, s * 0.4, s * 0.08); ctx.fill();
  ctx.fillStyle = STEEL;
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.52); ctx.lineTo(s * 0.7, s * 0.52); ctx.lineTo(s * 0.5, s * 0.92);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = theme.ui.text;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(s * 0.36, s * 0.62); ctx.lineTo(s * 0.64, s * 0.62);
  ctx.moveTo(s * 0.43, s * 0.76); ctx.lineTo(s * 0.57, s * 0.76);
  ctx.stroke();
}

// Stage Left: three cells in a row with an arrow sweeping left across them.
// Trapdoor is the same picture turned so the arrow points down a column.
function paintLineShot(ctx, s, down) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  if (down) ctx.rotate(-Math.PI / 2);
  ctx.translate(-s / 2, -s / 2);
  ctx.fillStyle = theme.ui.tray;
  ctx.strokeStyle = theme.ui.line;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    rounded(ctx, s * (0.08 + i * 0.29), s * 0.36, s * 0.26, s * 0.28, s * 0.05);
    ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = theme.ui.accent;
  ctx.fillStyle = theme.ui.accent;
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.beginPath(); ctx.moveTo(s * 0.9, s * 0.5); ctx.lineTo(s * 0.3, s * 0.5); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.08, s * 0.5); ctx.lineTo(s * 0.36, s * 0.28); ctx.lineTo(s * 0.36, s * 0.72);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Coin Flip: a coin with two turning arrows around it.
function paintFlip(ctx, s) {
  const cx = s / 2, cy = s / 2, R = s * 0.4;
  paintCoin(ctx, s, cx, cy, s * 0.2);
  ctx.strokeStyle = theme.ui.text;
  ctx.fillStyle = theme.ui.text;
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  for (const [from, to] of [[-0.85 * Math.PI, -0.2 * Math.PI], [0.15 * Math.PI, 0.8 * Math.PI]]) {
    ctx.beginPath(); ctx.arc(cx, cy, R, from, to); ctx.stroke();
    // The arrow head at the end of the arc, pointing along it.
    const px = cx + R * Math.cos(to), py = cy + R * Math.sin(to);
    const tx = -Math.sin(to), ty = Math.cos(to); // the direction of travel
    const nx = Math.cos(to), ny = Math.sin(to);  // straight out from the middle
    const k = s * 0.13;
    ctx.beginPath();
    ctx.moveTo(px + tx * k, py + ty * k);
    ctx.lineTo(px + nx * k * 0.8, py + ny * k * 0.8);
    ctx.lineTo(px - nx * k * 0.8, py - ny * k * 0.8);
    ctx.closePath(); ctx.fill();
  }
}

// The name of a booster or power-up kind.
function kindName(kind) {
  return (theme.boosters && theme.boosters[kind] && theme.boosters[kind].name)
    || BOOSTER_NAMES[kind]
    || (theme.powers[kind] && theme.powers[kind].name)
    || String(kind);
}

// The picture of a booster or power-up kind, `size` pixels square.
function kindIcon(kind, size) {
  const name = kindName(kind);
  const boardKind = kind === 'spot' ? 'spot-h' : kind; // the Missile is drawn as a row Missile
  if (theme.powers[boardKind]) return icon(size, (ctx, s) => drawPowerIcon(ctx, boardKind, s, theme), name);
  if (kind === 'drill') return icon(size, paintDrill, name);
  if (kind === 'stageleft') return icon(size, (ctx, s) => paintLineShot(ctx, s, false), name);
  if (kind === 'trapdoor') return icon(size, (ctx, s) => paintLineShot(ctx, s, true), name);
  if (kind === 'coinflip') return icon(size, paintFlip, name);
  return h('span', 'ev-chip-text', name); // a kind this file does not know: show its name
}

// ---- Drawing a reward ----
// reward = { coins, boosters: { kind: count }, packs, boost: { powers, minutes } }
// Gives back one element holding a small chip for each part.
export function renderReward(reward, size = 22) {
  const box = h('span', 'ev-reward');
  if (!reward || typeof reward !== 'object') return box;
  const chip = (pic, text) => {
    const c = h('span', 'ev-chip');
    if (pic) c.appendChild(pic);
    if (text) c.appendChild(h('span', '', text));
    box.appendChild(c);
    return c;
  };
  if (reward.coins > 0) chip(icon(size, paintCoin, 'Coins'), num(reward.coins));
  for (const [kind, count] of Object.entries(reward.boosters || {})) {
    if (count > 0) chip(kindIcon(kind, size), '×' + num(count));
  }
  if (reward.packs > 0) chip(icon(size, paintPack, 'Card pack'), '×' + num(reward.packs));
  if (reward.boost && list(reward.boost.powers).length) {
    const c = chip(null, minutesText(reward.boost.minutes) + ': starts with');
    c.classList.add('ev-chip-boost');
    for (const kind of reward.boost.powers) c.appendChild(kindIcon(kind, size));
  }
  if (!box.childNodes.length) box.appendChild(h('span', 'ev-dim', '—'));
  return box;
}

// ---- The screens ----
// session: the Session object.  onChange: called after a reward is claimed
// or an event is started, so ui/main.js can redraw Home (coins may change).
export function createEvents(session, onChange) {
  const now = () => Date.now();

  // Guarded questions to the session.
  const getEvents = (t) => list(safe(() => session.events?.list?.(t), []));
  const getDetail = (id, t) => safe(() => session.events?.detail?.(id, t), null)
    || getEvents(t).find((e) => e.id === id) || null;
  const getTray = (t) => list(safe(() => session.rewards?.tray?.(t), []));
  const getActive = (t) => list(safe(() => session.rewards?.active?.(t), []));
  const getAlbum = (t) => safe(() => session.album?.(t), null);

  // Tell main.js something changed, then redraw what this file shows.
  function changed() {
    safe(() => onChange && onChange(), null);
    refresh();
  }

  // ---- Countdowns ----
  // Every countdown on screen is kept in this list and rewritten once a second.
  let ticks = [];
  function countdown(endsAt, prefix = '', cls = 'ev-time') {
    const el = h('span', cls);
    if (endsAt === null || endsAt === undefined) return el;
    const entry = { el, endsAt, prefix, wasLive: endsAt > now() };
    el.textContent = prefix + timeLeft(endsAt - now());
    ticks.push(entry);
    return el;
  }

  let lastRefresh = 0;
  function tick() {
    const t = now();
    let crossed = false; // did any countdown just reach zero?
    ticks = ticks.filter((k) => k.el.isConnected !== false);
    for (const k of ticks) {
      k.el.textContent = k.prefix + timeLeft(k.endsAt - t);
      if (k.wasLive && k.endsAt <= t) { k.wasLive = false; crossed = true; }
    }
    // Rivals move with the clock, so ask again now and then, and at once
    // when something ends.
    if (crossed || t - lastRefresh >= REFRESH_MS) refresh();
  }
  setInterval(tick, 1000);

  // Redraw whatever is showing: the Home list or the open sheet. (The banner
  // on the Level screen is left alone so the board never changes size.)
  function refresh() {
    lastRefresh = now();
    const homeEl = $('screen-home');
    if (homeEl && !homeEl.hidden) drawHome();
    if (sheet && !back.hidden) drawSheet(false);
  }

  // ---- The banner for timed boosts that are running ----
  function drawBoosts(mount, compact) {
    if (!mount) return;
    mount.textContent = '';
    const boosts = getActive(now());
    mount.hidden = boosts.length === 0;
    for (const b of boosts) {
      const row = h('div', 'ev-boost' + (compact ? ' compact' : ''));
      const pics = h('span', 'ev-boost-icons');
      for (const kind of list(b.powers)) pics.appendChild(kindIcon(kind, compact ? 20 : 26));
      row.append(pics, h('span', 'ev-boost-text', TEXT.boost), countdown(b.endsAt, '', 'ev-time strong'));
      mount.appendChild(row);
    }
  }

  // ---- The round picture badges ----
  // A badge picture is drawn once and then kept, so the 20-second refresh
  // (and the once-a-second countdown) never has to paint it again.
  const badgePics = new Map(); // "event id|type|size" -> its canvas
  function eventIcon(ev, size, label) {
    const key = ev.id + '|' + (ev.type || '') + '|' + size;
    let pic = badgePics.get(key);
    if (!pic) {
      if (badgePics.size > 80) badgePics.clear(); // old, finished events: start afresh
      pic = icon(size, (ctx, s) => drawEventIcon(ctx, ev, s, theme), '');
      pic.classList.add('ev-b-canvas');
      badgePics.set(key, pic);
    }
    if (label) pic.setAttribute('aria-label', label);
    return pic;
  }

  // One badge of the Home grid: the round picture, a short name under it,
  // then the time left. `o` holds:
  //   ev      what to draw ({ id, type })      name   the word under the picture
  //   bubble  text for the top-right bubble    count  true = red number bubble
  //   start   true = show the pulsing "Start" pill instead of the bubble
  //   dot     true = show the small red dot    time   the element for the time line
  //   label   what a screen reader says        onTap  what a tap does
  function badge(o) {
    const btn = h('button', 'ev-b' + (o.cls ? ' ' + o.cls : ''));
    btn.type = 'button';
    btn.setAttribute('aria-label', o.label || o.name);
    const pic = h('span', 'ev-b-pic');
    pic.appendChild(eventIcon(o.ev, BADGE_PX));
    if (o.start) pic.appendChild(h('span', 'ev-b-start', TEXT.start));
    else if (o.bubble) pic.appendChild(h('span', 'ev-b-bubble' + (o.count ? ' count' : ''), o.bubble));
    if (o.dot) pic.appendChild(h('span', 'ev-b-dot'));
    btn.append(pic, h('span', 'ev-b-name', o.name), o.time || h('span', 'ev-b-time'));
    btn.onclick = o.onTap;
    return btn;
  }

  // ---- Home: the boost banner, then the grid of badges ----
  // Rewards and the Playbill album come first, then every event in the order
  // the Session gives them (ending soonest first), four badges across.
  function drawHome() {
    const mount = $('home-events');
    if (!mount) return;
    const t = now();
    mount.textContent = '';

    const banner = h('div', 'ev-boosts');
    drawBoosts(banner, false);
    mount.appendChild(banner);

    const grid = h('div', 'ev-badges');

    // Rewards: the bubble is the number waiting; the time line counts down
    // to the first one that would expire.
    const tray = getTray(t);
    const expiries = tray.map((item) => item && item.expiresAt).filter((v) => typeof v === 'number');
    grid.appendChild(badge({
      ev: { id: 'rewards', type: 'tray' },
      name: TEXT.rewards,
      bubble: tray.length ? String(tray.length) : '',
      count: true,
      time: expiries.length ? countdown(Math.min(...expiries), '', 'ev-b-time')
        : h('span', 'ev-b-time', tray.length ? TEXT.waiting : ''),
      label: tray.length ? `${TEXT.rewards}, ${tray.length} waiting` : TEXT.rewards,
      onTap: openTray,
    }));

    // The Playbill album: the bubble is cards owned out of all cards.
    const album = getAlbum(t);
    if (album) {
      grid.appendChild(badge({
        ev: { id: 'album', type: 'album' },
        name: TEXT.album,
        bubble: `${shortNum(album.owned)}/${shortNum(album.total)}`,
        time: countdown(album.endsAt, '', 'ev-b-time'),
        label: `${TEXT.album}, ${num(album.owned)} of ${num(album.total)} cards`,
        onTap: openAlbum,
      }));
    }

    const events = getEvents(t);
    for (const ev of events) grid.appendChild(eventBadge(ev));
    mount.appendChild(grid);
    if (!events.length) mount.appendChild(h('p', 'note ev-empty', TEXT.noEvents));
  }

  // The word for a finished state, or '' while an event is still open.
  const stateWord = (state) => ({ won: 'Won', lost: 'Lost', over: 'Ended' }[state] || '');

  // The Home badge of one event. Tapping it opens the detail sheet (where
  // the Start button is, for an event waiting to be started).
  function eventBadge(ev) {
    const finished = stateWord(ev.state); // 'Won', 'Lost', 'Ended' or ''
    return badge({
      ev,
      cls: ev.state && ev.state !== 'running' ? ev.state : '',
      name: shortName(ev),
      start: ev.state === 'offer',
      bubble: finished || bubbleText(ev),
      dot: !!finished || !!ev.claimable, // just finished, or something to collect
      time: countdown(ev.endsAt, '', 'ev-b-time'),
      label: [ev.title || 'Event', finished, ev.summary, ev.state === 'offer' ? 'tap to start' : '']
        .filter(Boolean).join(', '),
      onTap: () => openDetail(ev.id),
    });
  }

  // The Start button of an event that is on offer.
  function startButton(id) {
    const btn = h('button', 'btn primary ev-start', 'Start');
    btn.type = 'button';
    btn.onclick = (e) => {
      e.stopPropagation(); // do not also open the detail sheet
      safe(() => session.events?.start?.(id, now()), null);
      changed();
    };
    return btn;
  }

  // ---- The pop-up sheet (one at a time) ----
  let back = null;  // the dimmed layer behind the sheet
  let sheet = null; // the sheet itself
  let sheetTitle = null;
  let sheetBack = null; // the "Back" button (album set -> album)
  let sheetBody = null;
  let view = null;  // { render(body, now, first) -> title, onBack }

  function buildSheet() {
    if (sheet) return;
    back = h('div', 'ev-back');
    back.hidden = true;
    sheet = h('div', 'ev-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    const head = h('div', 'ev-sheet-head');
    sheetBack = h('button', 'btn quiet ev-head-btn', 'Back');
    sheetBack.type = 'button';
    sheetBack.onclick = () => { if (view && view.onBack) view.onBack(); };
    sheetTitle = h('h2', 'title small ev-sheet-title');
    const close = h('button', 'btn quiet ev-head-btn', 'Close');
    close.type = 'button';
    close.onclick = closeSheet;
    head.append(sheetBack, sheetTitle, close);
    sheetBody = h('div', 'ev-sheet-body');
    sheet.append(head, sheetBody);
    back.appendChild(sheet);
    back.onclick = (e) => { if (e.target === back) closeSheet(); }; // tap outside closes
    ($('app') || document.body).appendChild(back);
  }

  function openSheet(newView) {
    buildSheet();
    view = newView;
    back.hidden = false;
    drawSheet(true);
  }

  function closeSheet() {
    if (back) back.hidden = true;
    view = null;
    if (sheetBody) sheetBody.textContent = '';
  }

  // Fill the sheet again. `first` is true when it has just been opened;
  // otherwise the scroll position is kept.
  function drawSheet(first) {
    if (!view || !sheetBody) return;
    const top = first ? 0 : sheetBody.scrollTop;
    sheetBody.textContent = '';
    const title = safe(() => view.render(sheetBody, now(), first), 'Event');
    // An event's sheet shows its title beside its big badge instead (see
    // openDetail), so the bar at the top is left blank for it.
    sheetTitle.textContent = view.titleInBody ? '' : title;
    sheet.setAttribute('aria-label', title);
    sheetBack.style.visibility = view.onBack ? 'visible' : 'hidden';
    sheetBody.scrollTop = top;
    if (first && view.afterOpen) safe(() => view.afterOpen(sheetBody), null);
  }

  // ---- Pieces the detail sheet is built from ----

  // A bar filled to have/need, with "have/need" written on the right.
  function progressBar(have, need, extraClass) {
    const wrap = h('div', 'ev-progress' + (extraClass ? ' ' + extraClass : ''));
    const track = h('div', 'ev-track');
    const fill = h('div', 'ev-fill');
    const part = need > 0 ? Math.max(0, Math.min(1, have / need)) : 0;
    fill.style.width = (part * 100).toFixed(1) + '%';
    track.appendChild(fill);
    wrap.append(track, h('div', 'ev-progress-num', `${num(have)}/${num(need)}`));
    return wrap;
  }

  // A heading inside the sheet.
  const heading = (text) => h('div', 'label ev-head', text);

  // The prize for a place: the row's own, or looked up in the prize table.
  function prizeFor(ev, row) {
    if (row.prize && typeof row.prize === 'object') return row.prize;
    const hit = list(ev.prizes).find((p) => p.place === row.place);
    return hit ? hit.reward : null;
  }

  // The ranked list. The player's own row is green and stays pinned to the
  // bottom (or top) edge of the sheet while it would otherwise be off screen.
  function rowsList(ev) {
    const box = h('div', 'ev-rows');
    list(ev.rows).forEach((r, i) => {
      const place = r.place || i + 1;
      const row = h('div', 'ev-row' + (r.you ? ' you' : '') + (place <= 3 ? ' top' : ''));
      row.appendChild(h('span', 'ev-place', place));
      row.appendChild(h('span', 'ev-name', r.you ? `${r.name || 'You'} (you)` : r.name));
      row.appendChild(h('span', 'ev-score', num(r.score)));
      const prize = prizeFor(ev, { ...r, place });
      const cell = h('span', 'ev-prize');
      if (prize) cell.appendChild(renderReward(prize, 18));
      row.appendChild(cell);
      box.appendChild(row);
    });
    return box;
  }

  // The step list of a ladder, quota, season or mission track.
  function stepsList(ev) {
    const steps = list(ev.steps);
    const box = h('div', 'ev-steps');
    steps.forEach((s, i) => {
      const last = i === steps.length - 1 && steps.length > 1;
      const row = h('div', 'ev-step' + (s.done ? ' done' : '') + (s.current ? ' current' : '') + (last ? ' grand' : ''));
      row.appendChild(h('span', 'ev-step-mark', s.done ? '✓' : i + 1));
      const mid = h('span', 'ev-step-need');
      mid.appendChild(h('span', '', last ? TEXT.grand : `Step ${i + 1}`));
      if (s.need !== undefined && s.need !== null && typeof s.need !== 'object') {
        mid.appendChild(h('span', 'ev-dim', ' · ' + num(s.need)));
      }
      row.append(mid, renderReward(s.reward, 20));
      box.appendChild(row);
    });
    return box;
  }

  // The staged streak race: one upright lane per racer, each marker
  // climbing from the bottom toward `need` at the top.
  function lanesBox(ev) {
    const box = h('div', 'ev-lanes');
    for (const lane of list(ev.lanes)) {
      const col = h('div', 'ev-lane' + (lane.you ? ' you' : ''));
      col.appendChild(h('div', 'ev-lane-goal', num(lane.need)));
      const track = h('div', 'ev-lane-track');
      const part = lane.need > 0 ? Math.max(0, Math.min(1, lane.have / lane.need)) : 0;
      const fill = h('div', 'ev-lane-fill');
      fill.style.height = (part * 100).toFixed(1) + '%';
      const marker = h('div', 'ev-lane-marker', num(lane.have));
      marker.style.bottom = (part * 100).toFixed(1) + '%';
      track.append(fill, marker);
      col.append(track, h('div', 'ev-lane-name', lane.you ? 'You' : lane.name));
      box.appendChild(col);
    }
    return box;
  }

  // The company's shared total: one bar with the three chests standing at
  // their thresholds, then the chests listed with what they hold.
  function potBox(ev) {
    const box = h('div', 'ev-pot');
    const have = ev.total ? ev.total.have : 0;
    const need = ev.total ? ev.total.need : 0;
    const chests = list(ev.chests);
    const scale = need || Math.max(1, ...chests.map((c) => c.at || 0));
    const wrap = h('div', 'ev-pot-bar');
    const track = h('div', 'ev-track');
    const fill = h('div', 'ev-fill');
    fill.style.width = (Math.max(0, Math.min(1, have / scale)) * 100).toFixed(1) + '%';
    track.appendChild(fill);
    wrap.appendChild(track);
    for (const c of chests) {
      const mark = h('div', 'ev-pot-chest' + (c.open ? ' open' : ''), c.open ? '✓' : '');
      mark.style.left = (Math.max(0, Math.min(1, (c.at || 0) / scale)) * 100).toFixed(1) + '%';
      mark.title = `Chest at ${num(c.at)}`;
      wrap.appendChild(mark);
    }
    box.append(wrap, h('div', 'ev-pot-num', `${num(have)}/${num(need)}`));
    const rows = h('div', 'ev-steps');
    chests.forEach((c, i) => {
      const row = h('div', 'ev-step' + (c.open ? ' done' : ''));
      row.appendChild(h('span', 'ev-step-mark', c.open ? '✓' : i + 1));
      const mid = h('span', 'ev-step-need');
      mid.appendChild(h('span', '', `Chest at ${num(c.at)}`));
      mid.appendChild(h('span', 'ev-dim', c.open ? ' · open' : ''));
      row.append(mid, renderReward(c.reward, 20));
      rows.appendChild(row);
    });
    box.appendChild(rows);
    return box;
  }

  // The prize header: the top prizes of the event, biggest first.
  function prizeHeader(ev) {
    const prizes = list(ev.prizes);
    if (!prizes.length) return null;
    const box = h('div', 'card ev-prizes');
    box.appendChild(h('div', 'label', prizes.length > 1 ? 'Prizes' : 'Prize'));
    for (const p of prizes.slice(0, 3)) {
      const line = h('div', 'ev-prize-line');
      const place = p.place;
      line.appendChild(h('span', 'ev-prize-place', typeof place === 'number' ? ordinal(place) : (place || '')));
      line.appendChild(renderReward(p.reward, 24));
      box.appendChild(line);
    }
    return box;
  }

  // ---- The detail sheet of one event ----
  // It is built from whichever parts the event has (rows, steps, lanes,
  // chests), so every type in docs/EVENTS.md is covered by the same code.
  function openDetail(id) {
    openSheet({
      titleInBody: true, // the title is written beside the badge, not in the top bar
      render(body, t) {
        const ev = getDetail(id, t);
        if (!ev) {
          body.appendChild(h('p', 'note ev-empty', 'This event is no longer running.'));
          return 'Event';
        }
        // Top: the big badge with the title and what the event is, then how
        // long is left, and Start if it is on offer.
        const top = h('div', 'ev-top');
        const hero = h('div', 'ev-hero');
        const words = h('div', 'ev-hero-text');
        words.appendChild(h('h2', 'ev-hero-title', ev.title || 'Event'));
        if (ev.blurb) words.appendChild(h('p', 'note', ev.blurb));
        hero.append(eventIcon(ev, HERO_PX), words);
        top.appendChild(hero);
        const meta = h('div', 'ev-meta');
        const word = stateWord(ev.state);
        if (word) meta.appendChild(h('span', 'ev-tag ' + ev.state, word));
        if (ev.summary) meta.appendChild(h('span', 'ev-summary', ev.summary));
        if (ev.endsAt !== null && ev.endsAt !== undefined) meta.appendChild(countdown(ev.endsAt, 'Ends in ', 'ev-time strong'));
        top.appendChild(meta);
        if (ev.state === 'offer') {
          const start = startButton(ev.id);
          start.classList.add('tall', 'wide');
          top.appendChild(start);
        }
        body.appendChild(top);

        const prizes = prizeHeader(ev);
        if (prizes) body.appendChild(prizes);

        // Progress toward the current step (or the next chest).
        if (ev.progress && !list(ev.lanes).length) {
          const left = Math.max(0, ev.progress.need - ev.progress.have);
          body.appendChild(heading(ev.type === 'chest' ? 'Next chest'
            : (list(ev.steps).length ? 'Current step' : 'Progress')));
          body.appendChild(progressBar(ev.progress.have, ev.progress.need));
          if (ev.type === 'chest') {
            body.appendChild(h('p', 'note', left > 0
              ? `${num(left)} more ${left === 1 ? 'level' : 'levels'} to the next chest.`
              : 'The chest is ready.'));
          }
        }

        if (list(ev.lanes).length) {
          body.appendChild(heading('The race'));
          body.appendChild(lanesBox(ev));
        }
        if (ev.total || list(ev.chests).length) {
          body.appendChild(heading('Company total'));
          body.appendChild(potBox(ev));
        }
        if (list(ev.steps).length) {
          body.appendChild(heading('Steps'));
          body.appendChild(stepsList(ev));
        }
        if (list(ev.rows).length) {
          body.appendChild(heading(ev.type === 'company' ? 'Members' : 'Standings'));
          body.appendChild(rowsList(ev));
        }
        return ev.title || 'Event';
      },
      // On opening, bring the current step into view in a long step list.
      afterOpen(body) {
        const cur = body.querySelector('.ev-step.current');
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
      },
    });
  }

  // ---- The rewards tray ----
  function openTray() {
    openSheet({
      render(body, t) {
        const items = getTray(t);
        if (!items.length) {
          body.appendChild(h('p', 'note ev-empty', TEXT.trayEmpty));
          return TEXT.rewards;
        }
        body.appendChild(h('p', 'note', TEXT.trayNote));
        for (const item of items) {
          const card = h('div', 'card ev-tray-item');
          const text = h('div', 'ev-tray-main');
          text.appendChild(h('div', 'ev-item-title', item.title || 'Reward'));
          if (item.from) text.appendChild(h('div', 'ev-item-sub', 'From ' + item.from));
          text.appendChild(renderReward(item.reward, 24));
          if (item.expiresAt !== null && item.expiresAt !== undefined) {
            text.appendChild(countdown(item.expiresAt, 'Expires in ', 'ev-time ev-expire'));
          }
          const claim = h('button', 'btn primary ev-claim', 'Claim');
          claim.type = 'button';
          claim.onclick = () => {
            safe(() => session.rewards?.claim?.(item.id, now()), null);
            changed();
          };
          card.append(text, claim);
          body.appendChild(card);
        }
        return TEXT.rewards;
      },
    });
  }

  // ---- The card album ----
  const ownedIn = (set) => list(set.cards).filter((c) => c.owned).length;

  function openAlbum() {
    openSheet({
      render(body, t) {
        const album = getAlbum(t);
        if (!album) {
          body.appendChild(h('p', 'note ev-empty', 'No album yet.'));
          return TEXT.album;
        }
        const top = h('div', 'ev-top');
        const meta = h('div', 'ev-meta');
        if (album.month) meta.appendChild(h('span', 'ev-summary', album.month));
        meta.appendChild(h('span', 'ev-summary', `${num(album.owned)}/${num(album.total)} cards`));
        if (album.endsAt !== null && album.endsAt !== undefined) meta.appendChild(countdown(album.endsAt, 'Ends in ', 'ev-time strong'));
        top.appendChild(meta);
        top.appendChild(progressBar(album.owned || 0, album.total || 0));
        body.appendChild(top);

        if (album.grandPrize) {
          const grand = h('div', 'card ev-prizes');
          grand.appendChild(h('div', 'label', TEXT.grand + ' for the whole album'));
          grand.appendChild(renderReward(album.grandPrize, 24));
          body.appendChild(grand);
        }

        // The nine sets, three across.
        const grid = h('div', 'ev-grid');
        list(album.sets).forEach((set, i) => {
          const have = ownedIn(set);
          const cell = h('button', 'ev-set' + (set.done ? ' done' : ''));
          cell.type = 'button';
          cell.appendChild(h('span', 'ev-set-name', set.name || `Set ${i + 1}`));
          cell.appendChild(h('span', 'ev-set-count', (set.done ? '✓ ' : '') + `${have}/${list(set.cards).length}`));
          cell.onclick = () => openSet(i);
          grid.appendChild(cell);
        });
        body.appendChild(grid);
        return TEXT.album;
      },
    });
  }

  // The nine cards of one set.
  function openSet(index) {
    openSheet({
      onBack: openAlbum,
      render(body, t) {
        const album = getAlbum(t);
        const set = album && list(album.sets)[index];
        if (!set) {
          body.appendChild(h('p', 'note ev-empty', 'This set is not available.'));
          return TEXT.album;
        }
        const top = h('div', 'ev-top');
        const meta = h('div', 'ev-meta');
        meta.appendChild(h('span', 'ev-summary', `${ownedIn(set)}/${list(set.cards).length} cards`));
        if (set.done) meta.appendChild(h('span', 'ev-tag won', 'Complete'));
        if (album.endsAt !== null && album.endsAt !== undefined) meta.appendChild(countdown(album.endsAt, 'Ends in ', 'ev-time strong'));
        top.appendChild(meta);
        body.appendChild(top);

        const grid = h('div', 'ev-grid');
        for (const card of list(set.cards)) {
          const cell = h('div', 'ev-card' + (card.owned ? ' owned' : ' missing'));
          const stars = Math.max(0, Math.min(5, Number(card.stars) || 0));
          const starEl = h('span', 'ev-stars', '★'.repeat(stars));
          starEl.setAttribute('aria-label', stars + ' stars');
          cell.append(starEl, h('span', 'ev-card-name', card.name || 'Card'));
          if (!card.owned) cell.appendChild(h('span', 'ev-card-missing', 'Missing'));
          grid.appendChild(cell);
        }
        body.appendChild(grid);

        if (set.reward) {
          const prize = h('div', 'card ev-prizes');
          prize.appendChild(h('div', 'label', 'For finishing this set'));
          prize.appendChild(renderReward(set.reward, 24));
          body.appendChild(prize);
        }
        return set.name || TEXT.album;
      },
    });
  }

  // ---- Called by ui/main.js when a screen is shown ----

  // Home is being shown: fill the banner, the buttons and the event list.
  function home() {
    lastRefresh = now();
    drawHome();
  }

  // The Level screen is being shown: fill the boost banner. Call this BEFORE
  // the board is measured, because the banner takes a little height.
  function level() {
    closeSheet();
    drawBoosts($('level-boost'), true);
  }

  // The Results screen is being shown. `result` is what session.finish() or
  // session.quit() returned: one line per event the level fed, then the
  // rewards that just went into the tray.
  function results(result) {
    const mount = $('results-events');
    if (!mount) return;
    mount.textContent = '';
    const lines = list(result && result.eventLines);
    const fresh = list(result && result.newRewards);
    mount.hidden = lines.length === 0 && fresh.length === 0;

    if (lines.length) {
      const card = h('div', 'card lines ev-lines');
      for (const line of lines) {
        const row = h('div', 'line');
        row.append(h('span', 'ev-line-title', line.title), h('span', 'ev-line-text', line.text));
        card.appendChild(row);
      }
      mount.appendChild(card);
    }
    if (fresh.length) {
      const card = h('div', 'card ev-new');
      card.appendChild(h('div', 'label', TEXT.newRewards));
      for (const item of fresh) {
        const row = h('div', 'ev-new-row');
        row.append(h('span', 'ev-new-title', item.title || item.from || 'Reward'), renderReward(item.reward, 20));
        card.appendChild(row);
      }
      const open = h('button', 'btn', TEXT.openTray);
      open.type = 'button';
      open.onclick = openTray;
      card.appendChild(open);
      mount.appendChild(card);
    }
  }

  // Settings is being shown: the Rival toughness choice.
  function settings() {
    const mount = $('settings-rivals');
    if (!mount) return;
    mount.textContent = '';
    const current = (session.save && session.save.settings && session.save.settings.rivals) || 'even';
    mount.appendChild(h('div', 'label', TEXT.rivalsLabel));
    const seg = h('div', 'ev-seg3');
    for (const [value, word] of RIVALS) {
      const btn = h('button', 'btn seg' + (value === current ? ' on' : ''), word);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(value === current));
      btn.onclick = () => {
        safe(() => session.setSetting?.('rivals', value), null);
        settings();
      };
      seg.appendChild(btn);
    }
    mount.append(seg, h('p', 'note', TEXT.rivalsNote));
  }

  return { home, level, results, settings, openTray, openAlbum, openDetail, closeSheet, renderReward };
}
