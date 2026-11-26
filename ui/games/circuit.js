// THE GRAND CIRCUIT: a touring league table (rules in meta/events/circuit.js).
// A division banner (Bronze, Silver or Gold Stage) over a 20-row board. The
// top rows are the promotion zone, the bottom rows the relegation zone,
// your row glows gold. The last run's move up or down is announced once.
import {
  openGame, panel, bigText, ribbon, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { addPicture } from '../eventicons.js';
import { ordinal } from '../../meta/events/util.js';
import { avatarDisc, drawReward, smallText, timeLeft, fmt, scroller, fitSize } from './teamkit.js';

// A little crown (the circuit's points).
export function crown(ctx, cx, cy, s, fill = '#ffd23a') {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#6a3a00';
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.3);
  ctx.lineTo(cx - s * 0.5, cy - s * 0.25);
  ctx.lineTo(cx - s * 0.25, cy);
  ctx.lineTo(cx, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.25, cy);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.25);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff3a5a';
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.12, s * 0.09, 0, TAU); ctx.fill();
  ctx.restore();
}

addPicture('circuit', {
  types: ['circuit'],
  colors: ['#c08a2a', '#5a3400'],
  badge: ['#fff2d0', '#e0b060'],
  paint(ctx) {
    // three podium steps with a crown on top
    const steps = [[18, 58, 22, 26, '#d8e0f0'], [39, 44, 22, 40, '#ffd23a'], [60, 64, 22, 20, '#e09050']];
    for (const [x, y, w, h, c] of steps) {
      ctx.fillStyle = c;
      ctx.strokeStyle = '#3a2000';
      ctx.lineWidth = 2.5;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
    crown(ctx, 50, 30, 30);
  },
});

const ZONE = { up: ['rgba(60,220,120,.22)', '#5aff8a'], down: ['rgba(255,70,90,.22)', '#ff6a7a'] };

export function openCircuit(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const G0 = v.game;
  const colors = G0.divisions[G0.division].colors || ['#ffd84a', '#a06000'];
  const g = openGame({ title: v.title, top: '#3a2050', bottom: '#100616' });
  const fx = [];
  const words = [];
  const L = {};
  const list = scroller();
  let since = 0;
  let intro = 0;
  let banner = G0.last ? 0 : -1; // the move announcement's age
  let busy = !!G0.last;

  function layout() {
    L.headY = 10;
    L.headH = 104;
    L.listY = L.headY + L.headH + 12;
    L.listH = Math.max(160, g.h - L.listY - 8);
    L.rowH = 44;
    L.zoneGap = 22; // room for the zone labels
  }
  g.onResize = layout;
  layout();

  function rowY(i) {
    // rows, with a label strip after the promotion zone and before the relegation zone
    const G = v.game;
    let y = L.listY + 6 + i * L.rowH;
    if (G.up && i >= G.up) y += L.zoneGap;
    if (G.down && i >= G.rows.length - G.down) y += L.zoneGap;
    return y;
  }
  const contentH = () => rowY(v.game.rows.length) - L.listY + 10;

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    g.chip(fmt(G.crowns), (c, cx, cy, s) => crown(c, cx, cy + 2, s * 0.8));
    const per = G.crownsPerWin;
    const me = G.rows.find((r) => r.you);
    const zone = me.zone === 'up' ? 'You are in the promotion zone.' : me.zone === 'down' ? 'You are in the relegation zone!' : '';
    g.note(`${zone} Win levels for crowns: ${per.join(', ')} by difficulty.`.trim());
    list.max = Math.max(0, contentH() - L.listH);
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  refresh();
  // Start with your row in view.
  list.y = Math.max(0, Math.min(list.max, rowY(v.game.place - 1) - L.listY - L.listH / 2 + L.rowH / 2));

  g.onDrag = {
    start(x, y) { if (y > L.listY) list.start(y); },
    move(x, y) { list.move(y); },
    end() { list.end(); },
  };
  g.onTap = (x, y) => {
    if (banner >= 0 && banner > 1) {
      banner = -1;
      busy = false;
      api.act({ seenMove: true });
      api.changed();
      return;
    }
    if (busy || y < L.listY || list.moved > 10) return;
    const G = v.game;
    const i = G.rows.findIndex((r, k) => y + list.y >= rowY(k) && y + list.y < rowY(k) + L.rowH);
    const r = G.rows[i];
    if (r) {
      g.toast(r.zone === 'up' ? `${r.place}: moves up a stage at the end` : r.zone === 'down' ? `${r.place}: moves down a stage at the end` : `${r.place}: stays on the ${G.name}`);
    }
  };

  function plaque(ctx, t) {
    const G = v.game;
    const c = G.divisions[G.division].colors || colors;
    const cx = g.w / 2;
    rays(ctx, cx, L.headY + 44, 120, t, 'rgba(255,240,200,.12)', 12);
    panel(ctx, 14, L.headY, g.w - 28, L.headH, 18, [c[0], c[1]]);
    // stars for the stage: one, two or three
    for (let k = 0; k < G.divisions.length; k++) {
      const on = k <= G.division;
      crown(ctx, cx + (k - (G.divisions.length - 1) / 2) * 30, L.headY + 22, 22, on ? '#fff3a0' : 'rgba(0,0,0,.25)');
    }
    bigText(ctx, G.name, cx, L.headY + 54, fitSize(ctx, G.name, g.w - 80, 30), '#fff', '#2a1400');
    const me = G.rows.find((r) => r.you);
    smallText(ctx, `You are ${ordinal(me.place)} of ${G.rows.length}`, cx, L.headY + 80, 14, '#fff');
    if (v.endsAt) smallText(ctx, `⏱ ${timeLeft(v.endsAt)}`, g.w - 26, L.headY + 14, 12, '#fff', 'right');
    smallText(ctx, `${G.wins} wins`, 26, L.headY + 14, 12, '#fff', 'left');
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    since += dt;
    intro = Math.min(3, intro + dt);
    if (since > 6 && !busy) { since = 0; refresh(); }
    backdrop(ctx, g.w, g.h, '#3a2050', '#100616', 'rgba(255,220,180,.14)');
    plaque(ctx, t);

    // ---- the board ----
    list.step(dt);
    ctx.save();
    rr(ctx, 10, L.listY, g.w - 20, L.listH, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,4,20,.55)';
    ctx.fillRect(10, L.listY, g.w - 20, L.listH);
    const n = G.rows.length;
    // zone labels
    if (G.up) {
      const y = rowY(G.up) - L.zoneGap - list.y;
      ctx.fillStyle = ZONE.up[1];
      ctx.fillRect(18, y + L.zoneGap / 2 - 1, g.w - 36, 2);
      ribbon(ctx, '▲ PROMOTION ▲', g.w / 2, y + L.zoneGap / 2, 150, 18, ['#3ae07a', '#0a7a3a']);
    }
    if (G.down) {
      const y = rowY(n - G.down) - L.zoneGap - list.y;
      ctx.fillStyle = ZONE.down[1];
      ctx.fillRect(18, y + L.zoneGap / 2 - 1, g.w - 36, 2);
      ribbon(ctx, '▼ RELEGATION ▼', g.w / 2, y + L.zoneGap / 2, 150, 18, ['#ff5a6a', '#9a1028']);
    }
    G.rows.forEach((row, i) => {
      const y0 = rowY(i) - list.y;
      if (y0 < L.listY - L.rowH || y0 > L.listY + L.listH) return;
      const k = ease.outBack(clamp01((intro - i * 0.035) / 0.35));
      const y = y0;
      const x = lerp(g.w, 0, k);
      ctx.save();
      ctx.translate(x, 0);
      const z = row.zone ? ZONE[row.zone] : null;
      if (row.you) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4);
        ctx.fillStyle = `rgba(255,210,80,${0.28 + 0.12 * pulse})`;
        rr(ctx, 14, y, g.w - 28, L.rowH - 4, 12);
        ctx.fill();
        ctx.strokeStyle = '#ffd23a';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (z) {
        ctx.fillStyle = z[0];
        rr(ctx, 14, y, g.w - 28, L.rowH - 4, 12);
        ctx.fill();
      } else {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)';
        rr(ctx, 14, y, g.w - 28, L.rowH - 4, 12);
        ctx.fill();
      }
      const my = y + (L.rowH - 4) / 2;
      bigText(ctx, String(row.place), 34, my, 16, z ? z[1] : '#fff', '#1a0a1a');
      avatarDisc(ctx, row.avatar, 64, my, 15, row.you ? '#ffd23a' : '#b0a0c8');
      const name = row.you ? 'You' : row.name;
      bigText(ctx, name, 86, my - (row.prize ? 7 : 0), fitSize(ctx, name, g.w - 200, 15), row.you ? '#ffe070' : '#fff', '#120612', 'left');
      if (row.prize) drawReward(ctx, row.prize, 86, my + 10, 11, 'left', g.w - 200);
      crown(ctx, g.w - 34, my, 18);
      bigText(ctx, fmt(row.score), g.w - 48, my, 17, '#fff', '#120612', 'right');
      ctx.restore();
    });
    ctx.restore();

    // ---- last run's move ----
    if (banner >= 0) {
      banner += dt;
      const L2 = G.last;
      if (L2) {
        const upMove = L2.to > L2.from;
        const same = L2.to === L2.from;
        ctx.fillStyle = `rgba(10,2,20,${Math.min(0.7, banner)})`;
        ctx.fillRect(0, 0, g.w, g.h);
        const k = ease.outBack(clamp01(banner / 0.5));
        const cy = g.h * 0.42;
        rays(ctx, g.w / 2, cy, 240 * k, t, upMove ? 'rgba(255,230,140,.3)' : 'rgba(200,200,255,.18)', 16);
        ctx.save();
        ctx.translate(g.w / 2, cy);
        ctx.scale(k, k);
        const bw = Math.min(320, g.w - 40);
        panel(ctx, -bw / 2, -80, bw, 160, 20, upMove ? ['#ffcf4a', '#a05a00'] : same ? ['#5b24b8', '#2a0b6e'] : ['#6a5a8a', '#2a2040']);
        bigText(ctx, upMove ? 'Promoted!' : same ? 'Held your stage' : 'Down a stage', 0, -44, 30);
        smallText(ctx, `You finished ${ordinal(L2.place)} last run`, 0, -12, 15, '#fff');
        bigText(ctx, L2.toName, 0, 24, 26, '#fff3a0', '#3a1a00');
        smallText(ctx, 'Tap to continue', 0, 60, 13, 'rgba(255,255,255,.8)');
        ctx.restore();
        if (banner > 0.45 && !g._boom && upMove) {
          g._boom = true;
          burst(fx, g.w / 2, cy, { n: 60, colors: ['#ffe070', '#fff', '#ff7ab0'], speed: 420, size: 6, kind: 'star', life: 1.4 });
        }
      } else banner = -1;
    }

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
