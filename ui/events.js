// EVENTS SCREENS: the two columns of side-game badges down the left and
// right edges of Home (the pictures are drawn by ui/eventicons.js), the
// "+3" each badge shows right after a level, the detail sheet of each side
// game, the rewards tray, the card album, the timed-boost banners, the extra
// lines on Results and the "Rival toughness" choice in Settings.
//
// This file only SHOWS things. Every rule lives in the Session object
// (meta/); the shapes it hands over are written down in docs/EVENTS.md.
// Every call to the session is guarded, so the screens still work (and show
// "No events yet") while that logic is missing or returns nothing.
//
// index.html holds these empty boxes this file fills:
//   #home-left, #home-right   the badge columns at the two edges of Home
//   #home-events      under the Play button (timed boosts that are running)
//   #level-boost      in the bar above the board
//   #results-events   under the coin lines
//   #settings-rivals  in Settings
// The pop-up sheet is made here and added to #app.

import { drawPowerIcon, drawPiece } from './render.js';
import { flyTo } from './fly.js';
import { drawArt, hasArt } from './art.js';
import { drawEventIcon, eventColors } from './eventicons.js'; // the round picture badges
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

const BADGE_PX = 60;                 // how wide a badge picture is on Home at most (and how sharply it is drawn)
const BADGE_MIN_PX = 40;             // the smallest it may shrink to on a short screen
const PILL_PX = 27;                  // the timer pill under a badge, with its small gap (see .ev-b-time)
const GAP_MIN_PX = 4;                // the least and the most room between two badges in a column
const GAP_MAX_PX = 28;
const GAIN_START_MS = 450;           // after a level: the wait before the first "+3" pops in
const GAIN_STEP_MS = 150;            // ...and the wait between one badge's "+3" and the next
const GAIN_FLOAT_MS = 1500;          // how long a "+3" floats (keep the same as ev-plus in ui/events.css)
const HERO_PX = 116;                  // how wide it is at the top of a detail sheet
const REFRESH_MS = 20 * 1000;        // how often standings are asked for again
const SHOW_MS = 6000;                // how long one competition stays on the marquee
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
// A rendered picture from the atlas as an element (nothing if there is none).
export function artPic(name, size, label) {
  if (!hasArt(name)) return document.createElement('span');
  const pic = icon(size, (ctx, s) => drawArt(ctx, name, s / 2, s / 2, s, s), label || '');
  pic.classList.add('art');
  return pic;
}

// A colored disc with the first letter of a player's name.
const FACE_COLORS = ['#f0183c', '#1e7bff', '#06b34c', '#9a3cff', '#ff8412', '#0fb4d0', '#e0286a', '#5a6cff'];
function face(name, you) {
  const text = you ? 'You' : String(name || '?');
  let n = 0;
  for (const ch of text) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const el = h('span', 'ev-face', you ? '★' : text[0].toUpperCase());
  el.style.setProperty('--c', you ? '#0b8a48' : FACE_COLORS[n % FACE_COLORS.length]);
  return el;
}

// How far along an event is, from 0 to 1: its progress, or the player's place.
function partOf(ev) {
  if (ev.state === 'won') return 1;
  if (ev.total && ev.total.need > 0) return Math.min(1, ev.total.have / ev.total.need);
  if (ev.progress && ev.progress.need > 0) return Math.max(0, Math.min(1, ev.progress.have / ev.progress.need));
  const rows = list(ev.rows);
  const you = rows.find((r) => r && r.you);
  if (you && you.place > 0 && rows.length > 1) return 1 - (you.place - 1) / (rows.length - 1);
  return 0;
}
function paintColors(el, ev) {
  const [c, d] = eventColors(ev);
  el.style.setProperty('--c', c);
  el.style.setProperty('--d', d);
}

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
  if (hasArt(kind)) return icon(size, (ctx, s) => drawArt(ctx, kind, s / 2, s / 2, s, s), name);
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
  if (reward.coins > 0) chip(icon(size, hasArt('coin') ? (ctx, s) => drawArt(ctx, 'coin', s / 2, s / 2, s, s) : paintCoin, 'Coins'), num(reward.coins));
  for (const [kind, count] of Object.entries(reward.boosters || {})) {
    if (count > 0) chip(kindIcon(kind, size), '×' + num(count));
  }
  if (reward.packs > 0) chip(icon(size, hasArt('cardpack') ? (ctx, s) => drawArt(ctx, 'cardpack', s / 2, s / 2, s, s) : paintPack, 'Card pack'), '×' + num(reward.packs));
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

  // One badge of a Home column: the round picture with a small timer pill
  // under it. (The name is not written out; a screen reader still says it.)
  // `o` holds:
  //   ev      what to draw ({ id, type })      name   its name (for screen readers)
  //   bubble  text for the top-right bubble    count  true = red number bubble
  //   start   true = show the pulsing "Start" pill instead of the bubble
  //   dot     true = show the small red dot    time   the element for the time line
  //   label   what a screen reader says        onTap  what a tap does
  function badge(o) {
    const btn = h('button', 'ev-b' + (o.cls ? ' ' + o.cls : ''));
    btn.type = 'button';
    btn.setAttribute('aria-label', o.label || o.name);
    paintColors(btn, o.ev);
    const pic = h('span', 'ev-b-pic');
    const ring = h('span', 'ev-b-ring'); // fills as the event goes on
    ring.style.setProperty('--part', String(o.part || 0));
    pic.append(ring, eventIcon(o.ev, BADGE_PX));
    if (o.start) pic.appendChild(h('span', 'ev-b-start', TEXT.start));
    else if (o.bubble) pic.appendChild(h('span', 'ev-b-bubble' + (o.count ? ' count' : '') + ({ '1st': ' p1', '2nd': ' p2', '3rd': ' p3' }[o.bubble] || ''), o.bubble));
    if (o.dot) pic.appendChild(h('span', 'ev-b-dot'));
    btn.append(pic, o.time || h('span', 'ev-b-time'));
    btn.dataset.ev = String(o.ev.id); // lets the "+3" after a level find this badge
    btn.onclick = o.onTap;
    return btn;
  }

  // ---- Home: the two columns of badges, and the boost banner ----
  // Rewards heads the left column and the Playbill album the right one; then
  // every event in the order the Session gives them (ending soonest first),
  // dealt out left, right, left, right.
  // `round` is given only right after a level (see home() below): the badges
  // that gained something then show their "+3".
  function drawHome(round) {
    const mount = $('home-events');
    const left = $('home-left');
    const right = $('home-right');
    if (!mount || !left || !right) return;
    const t = now();
    mount.textContent = '';
    left.textContent = '';
    right.textContent = '';

    const banner = h('div', 'ev-boosts');
    drawBoosts(banner, false);
    mount.appendChild(banner);

    // Badges are handed to `grid` in order; it deals them into the two columns.
    let dealt = 0;
    const grid = { appendChild(b) { (dealt++ % 2 === 0 ? left : right).appendChild(b); } };

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
      part: album.total ? album.owned / album.total : 0,
        bubble: `${shortNum(album.owned)}/${shortNum(album.total)}`,
        time: countdown(album.endsAt, '', 'ev-b-time'),
        label: `${TEXT.album}, ${num(album.owned)} of ${num(album.total)} cards`,
        onTap: openAlbum,
      }));
    }

    const events = getEvents(t);
    for (const ev of events) grid.appendChild(eventBadge(ev));
    if (!events.length) mount.appendChild(h('p', 'note ev-empty', TEXT.noEvents));
    drawShow(events, false);
    fitBadges();
    if (round) showGains(round, events, tray.length);
  }

  // ---- The marquee: one competition at a time, in the middle of Home ----
  let showId = null;   // the one that is up
  let showTimer = 0;
  // What to say about an event in one exciting line.
  function pitch(ev) {
    const rows = list(ev.rows);
    const i = rows.findIndex((r) => r && r.you);
    if (ev.state === 'offer') return 'Ready when you are';
    if (i === 0 && rows.length > 1) return rows[0].score > 0 ? 'You are in the lead!' : 'Be the first to score';
    if (i > 0 && !ev.total && !ev.lanes) {
      const gap = rows[i - 1].score - rows[i].score + 1;
      return `${num(gap)} more to pass ${rows[i - 1].name}`;
    }
    if (ev.total) return `${num(Math.max(0, ev.total.need - ev.total.have))} more fills the pot`;
    if (ev.progress && ev.progress.need > 0) {
      const left = Math.max(0, ev.progress.need - ev.progress.have);
      return left ? `${num(left)} more to the next prize` : 'Ready to collect';
    }
    return ev.summary || '';
  }
  function drawShow(events, next) {
    const mount = $('home-show');
    if (!mount) return;
    const open = events.filter((e) => !stateWord(e.state));
    mount.hidden = !open.length;
    if (!open.length) { mount.textContent = ''; return; }
    let i = Math.max(0, open.findIndex((e) => e.id === showId));
    if (next) i = (i + 1) % open.length;
    const ev = getDetail(open[i].id, now()) || open[i];
    const fresh = showId !== ev.id;
    showId = ev.id;
    mount.textContent = '';
    const card = h('button', 'show' + (fresh ? ' turn' : ''));
    card.type = 'button';
    paintColors(card, ev);
    card.setAttribute('aria-label', [ev.title, ev.summary].filter(Boolean).join(', '));
    card.onclick = () => openDetail(ev.id);
    const pic = h('span', 'show-pic');
    pic.appendChild(icon(92, (ctx, s) => drawEventIcon(ctx, ev, s, theme), ''));
    card.append(h('span', 'show-rays'), h('span', 'show-name', ev.title || 'Event'), pic);
    const say = bubbleText(ev);
    if (ev.state === 'offer') card.appendChild(h('span', 'show-go', TEXT.start));
    else if (say) card.appendChild(h('span', 'show-big', say));
    if (ev.state !== 'offer' && (ev.progress || ev.total)) {
      const track = h('span', 'show-track');
      const fill = h('span', 'show-fill');
      fill.style.width = (partOf(ev) * 100).toFixed(1) + '%';
      track.appendChild(fill);
      card.appendChild(track);
    }
    card.appendChild(h('span', 'show-line', pitch(ev)));
    const prize = list(ev.prizes)[0] && list(ev.prizes)[0].reward;
    const step = list(ev.steps).find((x) => x.current);
    const win = prize || (step && step.reward);
    if (win) {
      const row = h('span', 'show-prize');
      row.appendChild(renderReward(win, 22));
      card.appendChild(row);
    }
    if (ev.endsAt !== null && ev.endsAt !== undefined) card.appendChild(countdown(ev.endsAt, '', 'show-time'));
    mount.appendChild(card);
    const dots = h('div', 'show-dots');
    open.forEach((e, n) => {
      const d = h('button', 'show-dot' + (n === i ? ' on' : ''));
      d.type = 'button';
      d.setAttribute('aria-label', e.title || 'Event');
      d.onclick = () => { showId = e.id; drawShow(getEvents(now()), false); };
      dots.appendChild(d);
    });
    mount.appendChild(dots);
    clearTimeout(showTimer);
    if (open.length > 1) {
      showTimer = setTimeout(() => {
        const home = $('screen-home');
        if (home && !home.hidden && (!back || back.hidden)) drawShow(getEvents(now()), true);
        else showId = ev.id;
      }, SHOW_MS);
    }
  }

  // Choose the badge size and the gap between badges so that the longer
  // column fits the height of the screen without scrolling. The pictures are
  // drawn once at BADGE_PX and only shown smaller, so nothing is repainted.
  function fitBadges() {
    const body = $('home-body');
    const left = $('home-left');
    const right = $('home-right');
    if (!body || !left || !right || !body.clientHeight) return; // Home is not showing
    const n = Math.max(left.children.length, right.children.length, 1);
    const room = body.clientHeight - 14; // less the padding above and below the columns
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const size = clamp(Math.floor((room - (n - 1) * GAP_MIN_PX) / n) - PILL_PX, BADGE_MIN_PX, BADGE_PX);
    const gap = n > 1
      ? clamp(Math.floor((room - n * (size + PILL_PX)) / (n - 1)), GAP_MIN_PX, GAP_MAX_PX)
      : GAP_MIN_PX;
    body.style.setProperty('--ev-size', size + 'px');
    body.style.setProperty('--ev-gap', gap + 'px');
  }
  if (typeof window !== 'undefined') window.addEventListener('resize', fitBadges);

  // ---- Right after a level: what each badge gained ----

  // What every badge shows just BEFORE a level is settled, so that Home can
  // start from the old numbers and tick over to the new ones.
  // Gives back { bubbles: { event id: bubble text }, tray: number waiting }.
  function snapshot() {
    const t = now();
    const bubbles = {};
    for (const ev of getEvents(t)) bubbles[ev.id] = stateWord(ev.state) || bubbleText(ev);
    return { bubbles, tray: getTray(t).length };
  }

  // The words that float beside a badge: "+3" when the line starts with a
  // number ("+3 collected"); for a fraction ("4/7") the difference from the
  // old bubble ("+1"); a small sparkle when there is no number; '' when the
  // line reports a loss ("Streak lost") and nothing should float.
  function gainText(line, oldBubble) {
    const text = String(line.text || '');
    if (/lost/i.test(text)) return '';
    const plus = text.match(/^\+\s*(\d[\d,]*)/);
    if (plus) return '+' + plus[1];
    const frac = text.match(/^(\d+)\s*\/\s*(\d+)/);
    const was = String(oldBubble || '').match(/^(\d+)\/(\d+)$/);
    if (frac && was && frac[2] === was[2]) {
      const diff = Number(frac[1]) - Number(was[1]);
      return diff > 0 ? '+' + diff : '';
    }
    if (frac && Number(frac[1]) === 0) return ''; // back to nothing: not a gain
    return '✦';
  }

  const lessMotion = () => typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // round = { result, before }: what session.finish() returned, and the
  // snapshot() taken just before it. Each badge with a line in
  // result.eventLines goes back to its old bubble; then, one badge after
  // another down the left column and then the right, its "+3" pops in and
  // the bubble changes to the new number. Last, the Rewards badge bounces if
  // new prizes went into the tray.
  function showGains(round, events, trayNow) {
    if (lessMotion()) return; // the new numbers are already showing; nothing floats
    const result = round.result || {};
    const before = round.before || { bubbles: {}, tray: trayNow };
    const lineOf = {};
    for (const line of list(result.eventLines)) if (line && line.id) lineOf[line.id] = line;
    const badges = [...$('home-left').children, ...$('home-right').children];

    let step = 0;
    for (const btn of badges) {
      const line = lineOf[btn.dataset.ev];
      if (!line) continue;
      const bubble = btn.querySelector('.ev-b-bubble');
      const newText = bubble ? bubble.textContent : '';
      const oldText = before.bubbles[btn.dataset.ev];
      if (bubble && oldText) bubble.textContent = oldText; // start from the old number
      const words = gainText(line, oldText);
      // A gem flies from the middle of the screen into the badge, and the
      // number changes as it lands.
      const gem = step % 5;
      setTimeout(async () => {
        const pic = btn.querySelector('.ev-b-pic');
        await flyTo((g, size) => drawPiece(g, gem, size / 2, size / 2, size, theme), 38,
          { x: window.innerWidth / 2, y: window.innerHeight * 0.4 }, pic, 650, 0);
        if (bubble) {
          bubble.textContent = newText;
          bubble.classList.add('ev-b-bump'); // a small swell as the number changes
        }
        if (words) floatBeside(btn, words);
      }, GAIN_START_MS + step * GAIN_STEP_MS);
      step++;
    }

    // The Rewards badge: back to the old count, then the new one with a bounce.
    const fresh = list(result.newRewards).length;
    const rewardsBtn = badges.find((b) => b.dataset.ev === 'rewards');
    if (fresh && rewardsBtn) {
      const bubble = rewardsBtn.querySelector('.ev-b-bubble');
      if (bubble && before.tray > 0) bubble.textContent = String(before.tray);
      else if (bubble) bubble.style.visibility = 'hidden'; // there was none before
      setTimeout(() => {
        if (bubble) { bubble.textContent = String(trayNow); bubble.style.visibility = ''; }
        const pic = rewardsBtn.querySelector('.ev-b-pic');
        if (pic) pic.classList.add('ev-b-bounce');
      }, GAIN_START_MS + step * GAIN_STEP_MS);
    }
  }

  // The little "+3" that pops in beside a badge, floats up and fades.
  function floatBeside(btn, words) {
    const pic = btn.querySelector('.ev-b-pic');
    if (!pic) return;
    const el = h('span', 'ev-b-plus', words);
    el.setAttribute('aria-hidden', 'true');
    pic.appendChild(el);
    setTimeout(() => el.remove(), GAIN_FLOAT_MS + 100);
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
      part: partOf(ev),
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
    const close = h('button', 'btn quiet ev-head-btn ev-x', '✕');
    close.setAttribute('aria-label', 'Close');
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
    sheet.className = 'ev-sheet ' + (view.cls || '');
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
    const podium = list(ev.rows).length >= 3 && ev.type !== 'company';
    list(ev.rows).forEach((r, i) => {
      const place = r.place || i + 1;
      if (podium && i < 3) return; // they stand on the podium
      const row = h('div', 'ev-row' + (r.you ? ' you' : '') + (place <= 3 ? ' top' : ''));
      row.appendChild(place <= 3 ? artPic('medal-' + place, 34, ordinal(place)) : h('span', 'ev-place', place));
      row.appendChild(face(r.name, r.you));
      row.appendChild(h('span', 'ev-name', r.you ? 'You' : r.name));
      row.appendChild(h('span', 'ev-score', num(r.score)));
      const prize = prizeFor(ev, { ...r, place });
      const cell = h('span', 'ev-prize');
      if (prize) cell.appendChild(renderReward(prize, 18));
      row.appendChild(cell);
      box.appendChild(row);
    });
    return box;
  }

  // The first three on their podium: second, first, third.
  function podiumBox(ev) {
    const rows = list(ev.rows);
    const box = h('div', 'podium');
    for (const i of [1, 0, 2]) {
      const r = rows[i];
      const col = h('div', 'podium-col p' + (i + 1) + (r.you ? ' you' : ''));
      if (i === 0) col.appendChild(artPic('crown', 42));
      col.append(face(r.name, r.you), h('span', 'podium-name', r.you ? 'You' : r.name));
      const block = h('div', 'podium-block');
      block.append(artPic('medal-' + (i + 1), 46, ordinal(i + 1)), h('span', 'podium-score', num(r.score)));
      const prize = prizeFor(ev, { ...r, place: i + 1 });
      if (prize && prize.coins) block.appendChild(renderReward({ coins: prize.coins }, 18));
      col.appendChild(block);
      box.appendChild(col);
    }
    return box;
  }

  // The step list of a ladder, quota, season or mission track.
  function stepsList(ev) {
    const steps = list(ev.steps);
    const box = h('div', 'ev-steps');
    steps.forEach((s, i) => {
      const last = i === steps.length - 1 && steps.length > 1;
      const row = h('div', 'ev-step' + (s.done ? ' done' : '') + (s.current ? ' current' : '') + (last ? ' grand' : ''));
      row.appendChild(last ? artPic(s.done ? 'chest-open' : 'chest', 46) : h('span', 'ev-step-mark', s.done ? '✓' : i + 1));
      const mid = h('span', 'ev-step-need');
      mid.appendChild(h('span', '', last ? TEXT.grand : `Step ${i + 1}`));
      if (s.need !== undefined && s.need !== null && typeof s.need !== 'object') {
        mid.appendChild(h('span', 'ev-dim', ' needs ' + num(s.need)));
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
      const mark = h('div', 'ev-pot-chest' + (c.open ? ' open' : ''));
      mark.appendChild(artPic(c.open ? 'chest-open' : 'chest', 44));
      mark.style.left = (Math.max(0, Math.min(1, (c.at || 0) / scale)) * 100).toFixed(1) + '%';
      mark.title = `Chest at ${num(c.at)}`;
      wrap.appendChild(mark);
    }
    box.append(wrap, h('div', 'ev-pot-num', `${num(have)}/${num(need)}`));
    const rows = h('div', 'ev-steps');
    chests.forEach((c, i) => {
      const row = h('div', 'ev-step' + (c.open ? ' done' : ''));
      row.appendChild(artPic(c.open ? 'chest-open' : 'chest', 44));
      const mid = h('span', 'ev-step-need');
      mid.appendChild(h('span', '', `Chest at ${num(c.at)}`));
      mid.appendChild(h('span', 'ev-dim', c.open ? ' open' : ''));
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
      const one = prizes.length === 1;
      if (one) line.appendChild(artPic('chest', 54));
      else if (place >= 1 && place <= 3) line.appendChild(artPic('medal-' + place, 44, ordinal(place)));
      else line.appendChild(h('span', 'ev-prize-place', typeof place === 'number' ? ordinal(place) : (place || '')));
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
      titleInBody: true, // the title is written under the badge, not in the top bar
      cls: 'show-sheet',
      render(body, t) {
        const ev = getDetail(id, t);
        if (!ev) {
          body.appendChild(h('p', 'note ev-empty', 'This event is no longer running.'));
          return 'Event';
        }
        // Top: the big badge with the title and what the event is, then how
        // long is left, and Start if it is on offer.
        const top = h('div', 'ev-top');
        paintColors(sheet, ev);
        const hero = h('div', 'ev-hero');
        const words = h('div', 'ev-hero-text');
        words.appendChild(h('h2', 'ev-hero-title', ev.title || 'Event'));
        if (ev.blurb) words.appendChild(h('p', 'note', ev.blurb));
        hero.append(h('span', 'show-rays'), eventIcon(ev, HERO_PX), words);
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
          if (list(ev.rows).length >= 3 && ev.type !== 'company') body.appendChild(podiumBox(ev));
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
        body.appendChild(artPic('chest-open', 96));
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

  // Home is being shown: fill the boost banner and the two badge columns.
  // Call this AFTER Home is on screen (the badges are sized to its height).
  // round: leave out normally. Right after a level pass
  //   { result: what session.finish() returned, before: snapshot() from just before it }
  // and the badges that gained something show it.
  function home(round) {
    lastRefresh = now();
    drawHome(round || null);
  }

  // The sheet behind the "details" link of the round banner on Home: the
  // coin lines and the event lines the old Results screen showed.
  //   fillCoins(box) writes the coin lines into a box (ui/screens.js does it).
  function openRound(result, levelN, fillCoins) {
    openSheet({
      render(body) {
        const coins = h('div', 'card lines');
        safe(() => fillCoins(coins), null);
        body.appendChild(coins);
        resultsInto(body, result);
        return `Level ${num(levelN)} ${result && result.status === 'won' ? 'won' : 'lost'}`;
      },
    });
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
    mount.hidden = !resultsInto(mount, result);
  }

  // Add the event lines and the new rewards of a finished level to `mount`
  // (the Results screen, or the details sheet). Gives back false if there
  // was nothing to add.
  function resultsInto(mount, result) {
    const lines = list(result && result.eventLines);
    const fresh = list(result && result.newRewards);

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
    return lines.length > 0 || fresh.length > 0;
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

  return { home, snapshot, openRound, level, results, settings, openTray, openAlbum, openDetail, closeSheet, renderReward, openSheet, refreshSheet: () => drawSheet(false) };
}
