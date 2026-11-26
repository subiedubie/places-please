// THE LIVE SIDE-GAME COUNTER: while a level is played, one small chip per
// side game that counts something on the board (a ladder collecting Roses,
// a sprint counting Grenades ...), showing its badge and "+N" for this level.
// The matching pieces carry a gold marker on the board (ui/stage.js).
import { drawEventIcon } from './eventicons.js';
import { theme } from '../config/theme.js';

let mount = null;
let list = [];
const last = new Map();

function chip(w) {
  const c = document.createElement('span');
  c.className = 'watch-chip';
  const pic = document.createElement('canvas');
  const s = 26;
  const d = Math.min(3, window.devicePixelRatio || 1);
  pic.width = s * d;
  pic.height = s * d;
  pic.style.width = s + 'px';
  pic.style.height = s + 'px';
  const ctx = pic.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  try { drawEventIcon(ctx, { id: w.id }, s, theme); } catch { /* the plain chip will do */ }
  const n = document.createElement('span');
  n.className = 'watch-n';
  n.textContent = '+0';
  c.append(pic, n);
  c.title = w.title;
  return c;
}

// At the start of a level: what to watch (session.events.watch()).
export function startWatch(watch) {
  list = watch || [];
  last.clear();
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'hud-watch';
    mount.className = 'hud-watch';
    const targets = document.getElementById('hud-targets');
    if (targets && targets.parentElement) targets.parentElement.insertBefore(mount, targets.nextSibling);
    else return;
  }
  mount.textContent = '';
  for (const w of list) mount.appendChild(chip(w));
  mount.hidden = list.length === 0;
}

// The colours and power-up kinds to mark on the board.
export function markersOf(watch) {
  return {
    colors: (watch || []).filter((w) => w.color !== undefined).map((w) => w.color),
    powers: (watch || []).flatMap((w) => w.powers || []),
  };
}

// After every move: update each chip's count from the game's tally.
export function updateWatch(game) {
  if (!mount || !game || !game.tally) return;
  const t = game.tally;
  list.forEach((w, i) => {
    let n = 0;
    if (w.color !== undefined) n = (t.cleared && t.cleared[w.color]) || 0;
    else if (w.powers) n = w.powers.reduce((a, k) => a + ((w.made ? t.made : t.fired) || {})[k] || 0, 0);
    const el = mount.children[i];
    if (!el) return;
    if (last.get(i) !== n) {
      el.querySelector('.watch-n').textContent = '+' + n;
      if (last.has(i)) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
      last.set(i, n);
    }
  });
}
