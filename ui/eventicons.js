// EVENT ICONS: the round picture badge of each side game, drawn in code.
//
//   drawEventIcon(ctx, event, size, theme)
//
// draws one badge filling a square of side `size` whose top-left corner is
// at (0, 0). `event` only needs an `id` and a `type` (what the Session hands
// over is fine). The picture is chosen by the event's id first (the name in
// config/events.js, e.g. 'critics'), then by its type, and anything unknown
// gets a plain gold star.
//
// Two extra ids are understood for the Home buttons that are not events:
//   'rewards'  the rewards tray (a present)
//   'album'    the Playbill card album (a little booklet)
//
// Every picture is drawn on a 100 x 100 sheet and then scaled to `size`, so
// all the numbers below are "out of 100": (50, 50) is the middle of the badge.

import { drawPiece, drawPowerIcon } from './render.js';
import { EVENTS } from '../config/events.js';
import { theme as defaultTheme } from '../config/theme.js';

// ---- Which picture each event gets ----

// By event id (the names on the left in config/events.js).
const PICTURE_BY_ID = {
  weekly: 'laurel',
  critics: 'trophy',
  'critics-streak': 'trophyFlame',
  'props-rose': 'ladder',
  'props-lantern': 'ladder',
  'props-star': 'ladder',
  techweek: 'clapper',
  company: 'chest',
  dash: 'flag',
  scottish: 'crown',
  ghostlight: 'ghostlight',
  'quickchange-star': 'stopwatch',
  'quickchange-grenade': 'stopwatch',
  callbacks: 'masks',
  season: 'ticket',
  encore: 'gift',
  callsheet: 'clipboard',
  rewards: 'present',
  album: 'booklet',
};

// By event type, for an event whose id is not in the list above.
const PICTURE_BY_TYPE = {
  race: 'trophy',
  ladder: 'ladder',
  quota: 'clapper',
  company: 'chest',
  dash: 'flag',
  streak: 'crown',
  sprint: 'stopwatch',
  bracket: 'masks',
  season: 'ticket',
  chest: 'gift',
  missions: 'clipboard',
  tray: 'present',
  album: 'booklet',
};

// The soft background of each badge and the thin darker ring around it.
const BADGE = {
  trophy:      ['#ffe3e0', '#ef9d95'],
  trophyFlame: ['#ffe3e0', '#ef9d95'],
  laurel:      ['#e6ecff', '#9db1ee'],
  clapper:     ['#ffecc7', '#eab85c'],
  chest:       ['#dff5e6', '#8fd0a6'],
  crown:       ['#efe3ff', '#b99be8'],
  ghostlight:  ['#dfe7f5', '#9fb0cc'],
  stopwatch:   ['#dff1ff', '#86bdee'],
  flag:        ['#e3f7ef', '#86cfb0'],
  ladder:      ['#fff0d9', '#e9bd7e'],
  masks:       ['#ffe6f1', '#ef9fc2'],
  ticket:      ['#e2f4fb', '#8ccbe3'],
  clipboard:   ['#eaf3dc', '#a9cd7c'],
  gift:        ['#f1e6ff', '#bda0ea'],
  present:     ['#fff1c9', '#ecc35a'],
  booklet:     ['#e5ecff', '#9db1ee'],
  star:        ['#eef1f6', '#b4bfd0'],
};

// Colors shared by several pictures.
const GOLD = '#ffc83d';
const GOLD_DEEP = '#e0a100';
const GOLD_EDGE = '#a87400';
const INK = '#1b2030';
const WHITE = '#ffffff';

// ---- Small drawing helpers (all on the 100 x 100 sheet) ----

// The outline of a rectangle with rounded corners.
function box(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fill the outline just made, then draw a line around it.
function paint(ctx, fill, edge, width = 2.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// A filled circle, with an optional line around it.
function disc(ctx, x, y, r, fill, edge, width) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, fill, edge, width);
}

// A straight line with round ends.
function stroke(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// The outline of a five-pointed star, `r` from middle to tip.
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const reach = i % 2 === 0 ? r : r * 0.46; // tip, then the dip between tips
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + reach * Math.cos(a);
    const y = cy + reach * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// A star, filled and outlined.
function star(ctx, cx, cy, r, fill, edge, width = 2) {
  starPath(ctx, cx, cy, r);
  paint(ctx, fill, edge, width);
}

// The small white highlight that makes a shape look glossy: a slim tilted oval.
function shine(ctx, x, y, long, thin, tilt = -0.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(long, thin);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A little flame, `h` tall, standing on (cx, cy).
function flame(ctx, cx, cy, h) {
  const one = (k, fill, edge) => {
    const w = h * k;
    ctx.beginPath();
    ctx.moveTo(cx, cy - w);
    ctx.bezierCurveTo(cx + w * 0.75, cy - w * 0.25, cx + w * 0.6, cy + w * 0.55, cx, cy + w * 0.55);
    ctx.bezierCurveTo(cx - w * 0.6, cy + w * 0.55, cx - w * 0.75, cy - w * 0.25, cx, cy - w);
    ctx.closePath();
    paint(ctx, fill, edge, 2);
  };
  one(1, '#ff7a1a', '#b84300');
  ctx.save();
  ctx.translate(0, h * 0.2);
  one(0.5, '#ffd84a', null);
  ctx.restore();
}

// A small power-up picture (Missile, Ninja Star, Grenade, Magic Ball) with
// its top-left corner at (x, y). Draws nothing for a kind the theme lacks.
function powerAt(ctx, kind, x, y, size, theme) {
  const boardKind = kind === 'spot' ? 'spot-h' : kind; // "Missile" = the row Missile
  if (!theme.powers || !theme.powers[boardKind]) return false;
  ctx.save();
  ctx.translate(x, y);
  drawPowerIcon(ctx, boardKind, size, theme);
  ctx.restore();
  return true;
}

// ---- The pictures ----
// Each takes (ctx, info): info.cfg is the event's entry in config/events.js
// (or an empty object), info.theme the theme, info.bg the badge's own color.

const PICTURES = {
  // Critics' Circle and any other leaderboard race: a gold cup with a star.
  trophy(ctx) {
    // The two handles, behind the cup.
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = GOLD_EDGE;
    ctx.beginPath(); ctx.arc(31, 39, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(69, 39, 8, 0, Math.PI * 2); ctx.stroke();
    // The foot: a short stem on a red-brown block.
    ctx.fillStyle = GOLD_DEEP;
    ctx.fillRect(46, 58, 8, 11);
    box(ctx, 35, 68, 30, 10, 3);
    paint(ctx, '#c0563a', '#7c2e1c');
    // The cup.
    ctx.beginPath();
    ctx.moveTo(30, 25);
    ctx.lineTo(70, 25);
    ctx.bezierCurveTo(70, 49, 61, 60, 50, 60);
    ctx.bezierCurveTo(39, 60, 30, 49, 30, 25);
    ctx.closePath();
    ctx.lineJoin = 'round';
    paint(ctx, GOLD, GOLD_EDGE);
    star(ctx, 50, 41, 9, '#fff6d6', GOLD_EDGE, 1.5);
    shine(ctx, 37, 33, 6, 2.2, -1.2);
  },

  // The Rave Run (points multiply for wins in a row): the cup with a flame.
  trophyFlame(ctx, info) {
    PICTURES.trophy(ctx, info);
    flame(ctx, 73, 68, 13);
  },

  // The Long Run (the week-long race): a laurel wreath around a gold medal.
  laurel(ctx) {
    // Six leaves up each side of a circle that is open at the top.
    for (const side of [1, -1]) {
      for (let i = 0; i < 6; i++) {
        // `a` walks from the bottom up the left side of the circle; the
        // right side (side = 1) is the same thing mirrored.
        const a = Math.PI * (0.6 + i * 0.15);
        const x = 50 - side * 29 * Math.cos(a);
        const y = 52 + 29 * Math.sin(a);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-side * (a - 0.35)); // along the circle, tips leaning outward
        ctx.scale(4.2, 8);
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.restore();
        paint(ctx, i % 2 ? '#3dbb74' : '#2fa866', '#1c7a47', 1.5);
      }
    }
    // The red knot where the two branches meet.
    disc(ctx, 50, 81, 4.5, '#e5484d', '#9c1f24', 1.5);
    // The medal.
    disc(ctx, 50, 50, 16, GOLD, GOLD_EDGE);
    star(ctx, 50, 50.5, 9.5, '#fff6d6', GOLD_EDGE, 1.5);
    shine(ctx, 41, 41, 4.5, 1.8, -0.8);
  },

  // Tech Week (the power-up quota): a film-style clapperboard.
  clapper(ctx) {
    // The board.
    box(ctx, 24, 45, 52, 31, 5);
    paint(ctx, '#3a4358', '#161a24');
    // The striped strip along its top edge.
    ctx.fillStyle = WHITE;
    for (let i = 0; i < 4; i++) {
      const x = 29 + i * 12;
      ctx.beginPath();
      ctx.moveTo(x, 46.5); ctx.lineTo(x + 6, 46.5); ctx.lineTo(x + 2, 53); ctx.lineTo(x - 4, 53);
      ctx.closePath(); ctx.fill();
    }
    // The hinged stick, lifted open.
    ctx.save();
    ctx.translate(25, 44);
    ctx.rotate(-0.24);
    box(ctx, -1, -11, 52, 10, 3);
    paint(ctx, '#3a4358', '#161a24');
    ctx.fillStyle = WHITE;
    for (let i = 0; i < 4; i++) {
      const x = 5 + i * 12;
      ctx.beginPath();
      ctx.moveTo(x, -9.5); ctx.lineTo(x + 6, -9.5); ctx.lineTo(x + 2, -2.5); ctx.lineTo(x - 4, -2.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Two written lines and a gold star on the board.
    stroke(ctx, 31, 61, 48, 61, '#aab4c8', 3);
    stroke(ctx, 31, 68, 43, 68, '#aab4c8', 3);
    star(ctx, 63, 64, 8, GOLD, GOLD_EDGE, 1.5);
  },

  // The Company (the shared pot): a treasure chest with a comedy mask on it.
  chest(ctx) {
    // The rounded lid.
    ctx.beginPath();
    ctx.moveTo(23, 50);
    ctx.lineTo(23, 42);
    ctx.quadraticCurveTo(23, 27, 38, 27);
    ctx.lineTo(62, 27);
    ctx.quadraticCurveTo(77, 27, 77, 42);
    ctx.lineTo(77, 50);
    ctx.closePath();
    paint(ctx, '#d98845', '#6b3a17');
    // The box under it.
    box(ctx, 23, 48, 54, 28, 4);
    paint(ctx, '#b5682f', '#6b3a17');
    // The gold band between lid and box.
    ctx.fillStyle = GOLD;
    ctx.fillRect(24.2, 45, 51.6, 5);
    shine(ctx, 36, 34, 6, 2, -0.3);
    // The smiling mask on the front.
    ctx.beginPath();
    ctx.moveTo(39, 49);
    ctx.lineTo(61, 49);
    ctx.bezierCurveTo(62, 62, 57, 71, 50, 72);
    ctx.bezierCurveTo(43, 71, 38, 62, 39, 49);
    ctx.closePath();
    ctx.lineJoin = 'round';
    paint(ctx, '#ffe07a', GOLD_EDGE, 2);
    ctx.strokeStyle = '#5a3a10';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(45, 57, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); // eyes
    ctx.beginPath(); ctx.arc(55, 57, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(50, 61, 5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); // smile
  },

  // The Scottish Play and other streaks: a crown with a dagger behind it.
  crown(ctx) {
    // The dagger, slanting from lower left to upper right.
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(0.7);
    box(ctx, -3, -6, 6, 40, 3);          // handle
    paint(ctx, '#7b4a2f', '#4a2a18', 2);
    disc(ctx, 0, 36, 4.5, GOLD, GOLD_EDGE, 1.5); // the knob at its end
    ctx.beginPath();                      // blade
    ctx.moveTo(-4.5, -8); ctx.lineTo(-4.5, -30); ctx.lineTo(0, -41); ctx.lineTo(4.5, -30); ctx.lineTo(4.5, -8);
    ctx.closePath();
    ctx.lineJoin = 'round';
    paint(ctx, '#e6ecf3', '#6f7a8c', 2);
    stroke(ctx, 0, -12, 0, -32, '#b4bfd0', 1.5);
    ctx.restore();
    // The crown: three points and a band.
    ctx.beginPath();
    ctx.moveTo(27, 63); ctx.lineTo(23, 38); ctx.lineTo(37, 49); ctx.lineTo(50, 31);
    ctx.lineTo(63, 49); ctx.lineTo(77, 38); ctx.lineTo(73, 63);
    ctx.closePath();
    ctx.lineJoin = 'round';
    paint(ctx, GOLD, GOLD_EDGE);
    disc(ctx, 23, 38, 3.5, GOLD, GOLD_EDGE, 1.5);
    disc(ctx, 50, 31, 3.5, GOLD, GOLD_EDGE, 1.5);
    disc(ctx, 77, 38, 3.5, GOLD, GOLD_EDGE, 1.5);
    box(ctx, 26, 60, 48, 11, 3.5);
    paint(ctx, GOLD_DEEP, GOLD_EDGE);
    disc(ctx, 50, 65.5, 3.2, '#e5484d', null);
    disc(ctx, 37, 65.5, 2.5, '#3f8cff', null);
    disc(ctx, 63, 65.5, 2.5, '#3f8cff', null);
    shine(ctx, 33, 52, 4, 1.6, -1.1);
  },

  // Ghost Light Run: the single bare lamp left burning on an empty stage.
  ghostlight(ctx) {
    // Rays around the bulb.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1 + i / 6); // a fan over the top half
      stroke(ctx, 50 + 17 * Math.cos(a), 36 + 17 * Math.sin(a),
        50 + 23 * Math.cos(a), 36 + 23 * Math.sin(a), '#ffb703', 3);
    }
    // The stand.
    ctx.fillStyle = '#7a8599';
    ctx.fillRect(48, 48, 4, 28);
    box(ctx, 35, 74, 30, 7, 3.5);
    paint(ctx, '#454e61', '#232a3a', 2);
    // The bulb and its socket.
    disc(ctx, 50, 36, 12, '#ffe066', '#c98f00');
    box(ctx, 44.5, 46, 11, 7, 2);
    paint(ctx, '#454e61', '#232a3a', 2);
    shine(ctx, 45, 31, 4, 2, -0.9);
  },

  // Quick Change (the 30-minute sprint): a stopwatch with a lightning bolt,
  // and the power-up it counts small in the corner.
  stopwatch(ctx, info) {
    // The button on top and the knob at the side.
    box(ctx, 45, 19, 10, 10, 2.5);
    paint(ctx, '#2f6fd0', '#1c468a', 2);
    ctx.save();
    ctx.translate(69, 33);
    ctx.rotate(Math.PI / 4);
    box(ctx, -3.5, -5, 7, 9, 2);
    paint(ctx, '#2f6fd0', '#1c468a', 2);
    ctx.restore();
    // The watch.
    disc(ctx, 50, 53, 24, '#3f8cff', '#1c468a');
    disc(ctx, 50, 53, 18, WHITE, null);
    // The bolt.
    ctx.beginPath();
    ctx.moveTo(54, 38); ctx.lineTo(41, 56); ctx.lineTo(49, 56);
    ctx.lineTo(45, 69); ctx.lineTo(59, 50); ctx.lineTo(51, 50);
    ctx.closePath();
    ctx.lineJoin = 'round';
    paint(ctx, '#ffc400', GOLD_EDGE, 2);
    shine(ctx, 33, 40, 5, 1.8, -0.9);
    // The power-up this sprint counts, if the event names one.
    const kind = info.cfg.power;
    if (kind) powerAt(ctx, kind, 52, 52, 30, info.theme);
  },

  // Opening Night Dash (first to finish): a chequered finish flag.
  flag(ctx) {
    stroke(ctx, 31, 26, 31, 79, '#7b4a2f', 5); // pole
    // The waving cloth.
    const cloth = () => {
      ctx.beginPath();
      ctx.moveTo(33, 27);
      ctx.quadraticCurveTo(45, 20, 56, 28);
      ctx.quadraticCurveTo(67, 36, 78, 29);
      ctx.lineTo(78, 56);
      ctx.quadraticCurveTo(67, 63, 56, 55);
      ctx.quadraticCurveTo(45, 47, 33, 54);
      ctx.closePath();
    };
    cloth();
    ctx.fillStyle = WHITE;
    ctx.fill();
    // Dark squares, kept inside the cloth.
    ctx.save();
    cloth();
    ctx.clip();
    ctx.fillStyle = '#2a3142';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if ((row + col) % 2 === 0) ctx.fillRect(33 + col * 9, 18 + row * 9, 9, 9);
      }
    }
    ctx.restore();
    cloth();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    disc(ctx, 31, 24, 4.5, GOLD, GOLD_EDGE, 1.5); // the gold knob on the pole
    shine(ctx, 42, 28, 5, 1.6, -0.3);
  },

  // Prop Room (collection ladders): a ladder with the collected thing on top.
  ladder(ctx, info) {
    // Rungs first, then the two rails over their ends.
    for (const y of [72, 62, 52]) {
      const lean = ((80 - y) / 40) * 6;
      stroke(ctx, 36 + lean, y, 64 - lean, y, '#e0a868', 4);
    }
    stroke(ctx, 36, 80, 42, 42, '#b5682f', 5);
    stroke(ctx, 64, 80, 58, 42, '#b5682f', 5);
    // On top: the gem of the event's color, the power-up it counts, or a star.
    const collect = info.cfg.collect || {};
    let drawn = false;
    if (Number.isInteger(collect.color) && info.theme.pieces && info.theme.pieces[collect.color]) {
      drawPiece(ctx, collect.color, 50, 30, 38, info.theme);
      drawn = true;
    } else if (collect.made) {
      drawn = powerAt(ctx, collect.made, 32, 12, 36, info.theme);
    }
    if (!drawn) {
      star(ctx, 50, 30, 15, GOLD, GOLD_EDGE);
      shine(ctx, 45, 25, 3.5, 1.4, -0.8);
    }
    // A little sparkle beside it.
    star(ctx, 71, 22, 5, WHITE, GOLD_DEEP, 1.2);
  },

  // Callbacks (the bracket): a comedy and a tragedy mask, face to face.
  masks(ctx) {
    const mask = (x, y, tilt, fill, edge, ink, happy) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-14, -14);
      ctx.quadraticCurveTo(0, -19, 14, -14);
      ctx.bezierCurveTo(15, 4, 9, 17, 0, 18);
      ctx.bezierCurveTo(-9, 17, -15, 4, -14, -14);
      ctx.closePath();
      ctx.lineJoin = 'round';
      paint(ctx, fill, edge);
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (const ex of [-6, 6]) { // eyes: arched when happy, drooping when sad
        ctx.beginPath();
        if (happy) ctx.arc(ex, -3, 3.2, Math.PI * 1.1, Math.PI * 1.9);
        else ctx.arc(ex, -7, 3.2, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
      ctx.beginPath(); // mouth: an open grin, or a frown
      if (happy) { ctx.arc(0, 4, 6.5, 0, Math.PI); ctx.closePath(); ctx.fill(); }
      else { ctx.arc(0, 13, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      shine(ctx, -8, -10.5, 3.5, 1.4, -0.3);
      ctx.restore();
    };
    mask(64, 55, 0.2, '#7fb2ff', '#2456b0', '#12306b', false); // tragedy, behind
    mask(37, 46, -0.2, '#ffd24a', GOLD_EDGE, '#5a3a10', true); // comedy, in front
  },

  // The Season (the month-long track): a ticket stub with a star.
  ticket(ctx, info) {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(-0.22);
    box(ctx, -31, -18, 62, 36, 5);
    paint(ctx, '#ff8a5c', '#b84a22');
    // The half-round bites out of each end (filled with the badge's color).
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 31, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = info.bg;
      ctx.fill();
      ctx.beginPath();
      if (side < 0) ctx.arc(-31, 0, 6, -Math.PI / 2, Math.PI / 2);
      else ctx.arc(31, 0, 6, Math.PI / 2, Math.PI * 1.5);
      ctx.strokeStyle = '#b84a22';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // The dotted tear line and the star.
    for (let y = -12; y <= 12; y += 6) disc(ctx, 13, y, 1.5, '#ffe3d2', null);
    star(ctx, -7, 0, 10.5, '#fff3b0', '#b84a22', 1.5);
    shine(ctx, -20, -12, 5, 1.6, 0);
    ctx.restore();
  },

  // Call Sheet (daily missions): a clipboard with three ticks.
  clipboard(ctx) {
    box(ctx, 27, 25, 46, 55, 6);
    paint(ctx, '#cf9455', '#7d4f22');
    box(ctx, 32, 32, 36, 43, 3);
    paint(ctx, WHITE, null);
    box(ctx, 40, 19, 20, 11, 3.5);
    paint(ctx, '#9aa6bd', '#56607a', 2);
    ctx.lineJoin = 'round';
    for (const y of [42, 53, 64]) {
      ctx.strokeStyle = '#17a35a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(36.5, y); ctx.lineTo(39.5, y + 3); ctx.lineTo(44.5, y - 4);
      ctx.stroke();
      stroke(ctx, 49, y, 62, y, '#c3cad6', 3);
    }
    shine(ctx, 46, 22.5, 3, 1.2, 0);
  },

  // Encore (the chest every fifty wins): a violet gift box with a gold bow.
  gift(ctx) {
    box(ctx, 28, 46, 44, 31, 4);
    paint(ctx, '#9a5cf0', '#5b2fa8');
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(45.5, 47, 9, 29);
    box(ctx, 24, 36, 52, 13, 4);
    paint(ctx, '#b684ff', '#5b2fa8');
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(45.5, 37.2, 9, 10.6);
    // The bow: two loops and a knot.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(50 + side * 9, 29);
      ctx.rotate(side * -0.45);
      ctx.scale(9, 5.5);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
      paint(ctx, '#ffd24a', GOLD_EDGE, 2);
    }
    disc(ctx, 50, 32, 4.5, GOLD_DEEP, GOLD_EDGE, 2);
    shine(ctx, 33, 41, 4.5, 1.5, 0);
  },

  // The rewards tray: a red present with its lid popping off and two sparkles.
  present(ctx) {
    box(ctx, 28, 50, 44, 28, 4);
    paint(ctx, '#e5484d', '#9c1f24');
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(45.5, 51, 9, 26);
    // The lid, tipped up at one side.
    ctx.save();
    ctx.translate(50, 40);
    ctx.rotate(-0.2);
    box(ctx, -27, -6, 54, 12, 4);
    paint(ctx, '#ff6b6f', '#9c1f24');
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(-4.5, -4.8, 9, 9.6);
    for (const side of [-1, 1]) {
      disc(ctx, side * 6.5, -11, 5.5, '#fff3c4', '#c9a23a', 2);
    }
    disc(ctx, 0, -8.5, 3.5, '#ffd24a', '#c9a23a', 1.5);
    shine(ctx, -18, -2, 4.5, 1.4, 0);
    ctx.restore();
    star(ctx, 77, 31, 5.5, GOLD, GOLD_EDGE, 1.2);
    star(ctx, 22, 26, 4, GOLD, GOLD_EDGE, 1.2);
  },

  // The Playbill album: a little programme booklet with a star on the cover.
  booklet(ctx) {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(0.12);
    box(ctx, -18, -27, 44, 56, 4); // the pages peeking out behind
    paint(ctx, WHITE, '#9aa6bd', 2);
    box(ctx, -23, -29, 44, 57, 4); // the cover
    paint(ctx, '#ffd24a', GOLD_EDGE);
    ctx.fillStyle = INK;           // the dark title band
    ctx.fillRect(-19.5, -25.5, 37, 11);
    stroke(ctx, -13, -20, 11, -20, '#ffd24a', 2.5);
    star(ctx, -1, 6, 13, '#e5484d', '#9c1f24', 2);
    shine(ctx, -5, 1, 3, 1.3, -0.8);
    stroke(ctx, -13, 23, 11, 23, GOLD_EDGE, 2);
    ctx.restore();
  },

  // Anything this file does not know: a plain gold star.
  star(ctx) {
    star(ctx, 50, 52, 27, GOLD, GOLD_EDGE, 3);
    shine(ctx, 43, 41, 5, 2, -0.9);
  },
};

// ---- The one function the screens call ----

// The event's name in config/events.js. A running event's id looks like
// "critics@1731900000000#2": the part before the "@" is that name.
function configKey(event) {
  if (event && typeof event.key === 'string') return event.key;
  const id = event && event.id !== undefined && event.id !== null ? String(event.id) : '';
  return id.split('@')[0];
}

// Which picture an event gets: 'trophy', 'ladder', ... or 'star'.
export function eventPicture(event) {
  const key = configKey(event);
  const type = event && typeof event.type === 'string' ? event.type : '';
  const cfgType = EVENTS[key] ? EVENTS[key].type : '';
  return PICTURE_BY_ID[key] || PICTURE_BY_TYPE[type] || PICTURE_BY_TYPE[cfgType] || 'star';
}

// Draw the badge of `event` in a square of side `size` at (0, 0).
export function drawEventIcon(ctx, event, size, theme) {
  const s = Number(size);
  if (!ctx || !(s > 0)) return;
  const th = theme || defaultTheme;
  const name = eventPicture(event);
  const [bg, ring] = BADGE[name] || BADGE.star;
  // What the picture may need to know: the event's own settings (the power-up
  // a sprint counts, the color a ladder collects). Fields on the event itself
  // win over config/events.js.
  const fromConfig = EVENTS[configKey(event)] || {};
  const cfg = {
    power: (event && event.power) || fromConfig.power,
    collect: (event && event.collect) || fromConfig.collect,
  };

  ctx.save();
  ctx.scale(s / 100, s / 100); // from here on everything is "out of 100"

  // The round badge: soft color, thin darker ring, a pale gleam across the top.
  disc(ctx, 50, 50, 47, bg, ring, 3);
  ctx.save();
  ctx.beginPath();
  ctx.arc(50, 50, 45, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(50, -12, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The picture. If one ever fails, the plain star is drawn in its place.
  ctx.save();
  try {
    PICTURES[name](ctx, { cfg, theme: th, bg });
  } catch (err) {
    console.warn('event icon:', name, err);
    ctx.restore();
    ctx.save();
    PICTURES.star(ctx);
  }
  ctx.restore();

  ctx.restore();
}
