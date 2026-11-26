// BATTLE OF THE COMPANIES: twenty theatre companies on one board (rules in
// meta/events/battle.js). Two tabs: the companies, with yours highlighted
// and the paid places marked; and your own company, every member's shields
// with the top three marked. Your company's shield count rolls up from what
// you last saw.
import {
  openGame, panel, bigText, ribbon, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import { addPicture } from '../eventicons.js';
import { ordinal } from '../../meta/events/util.js';
import { avatarDisc, drawReward, smallText, timeLeft, fmt, roller, scroller, fitSize, emoji } from './teamkit.js';

// A heraldic shield (the battle's points). `tint` colours its field.
export function shield(ctx, cx, cy, s, tint = ['#ff4f7a', '#9a1030']) {
  ctx.save();
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.45, cy - s * 0.42);
    ctx.lineTo(cx + s * 0.45, cy - s * 0.42);
    ctx.lineTo(cx + s * 0.42, cy + s * 0.05);
    ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.38, cx, cy + s * 0.52);
    ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.38, cx - s * 0.42, cy + s * 0.05);
    ctx.closePath();
  };
  ctx.fillStyle = '#ffc21a';
  ctx.strokeStyle = '#5a2a00';
  ctx.lineWidth = Math.max(1.2, s * 0.07);
  path();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.76, 0.76);
  ctx.translate(-cx, -cy);
  const g = ctx.createLinearGradient(0, cy - s * 0.4, 0, cy + s * 0.5);
  g.addColorStop(0, tint[0]);
  g.addColorStop(1, tint[1]);
  ctx.fillStyle = g;
  path();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillRect(cx - s * 0.05, cy - s * 0.28, s * 0.1, s * 0.56);
  ctx.fillRect(cx - s * 0.25, cy - s * 0.08, s * 0.5, s * 0.1);
  ctx.restore();
}

addPicture('battle', {
  types: ['battle'],
  colors: ['#d8304a', '#5a0a1a'],
  badge: ['#ffe0e4', '#f08a98'],
  paint(ctx) {
    // two crossed swords behind a shield
    ctx.strokeStyle = '#c8d0e8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(80, 80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(82, 18); ctx.lineTo(20, 80); ctx.stroke();
    ctx.strokeStyle = '#7a4a00';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(24, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(86, 14); ctx.lineTo(76, 24); ctx.stroke();
    shield(ctx, 50, 52, 48);
  },
});

const MEDAL = ['#ffd23a', '#d8e0f0', '#e09050'];

export function openBattle(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#5a1020', bottom: '#14040a' });
  const fx = [];
  const words = [];
  const L = {};
  const lists = { teams: scroller(), members: scroller() };
  let tab = 'teams';
  let since = 0;
  let intro = 0;
  const count = roller(v.game.seen);
  let reported = v.game.seen;

  function layout() {
    L.headY = 10;
    L.headH = 96;
    L.tabY = L.headY + L.headH + 12;
    L.tabH = 36;
    L.listY = L.tabY + L.tabH + 8;
    L.listH = Math.max(160, g.h - L.listY - 8);
    L.rowH = 46;
  }
  g.onResize = layout;
  layout();

  function rows() { return tab === 'teams' ? v.game.teams : v.game.members; }
  function scrollToMe() {
    const s = lists[tab];
    const i = rows().findIndex((r) => r.you);
    s.max = Math.max(0, rows().length * L.rowH + 12 - L.listH);
    s.y = Math.max(0, Math.min(s.max, i * L.rowH - L.listH / 2 + L.rowH / 2));
  }

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    count.set(G.ours);
    g.chip(fmt(G.mine), (c, cx, cy, s) => shield(c, cx, cy, s * 0.85));
    const per = G.shieldsPerWin;
    if (G.needMore > 0) g.note(`Add ${G.needMore} more shield${G.needMore === 1 ? '' : 's'} to be paid at the end. Wins pay ${per.join(', ')} by difficulty.`);
    else g.note(`Every win adds shields to ${G.team}: ${per.join(', ')} by difficulty. Top five companies are paid.`);
    for (const k of Object.keys(lists)) lists[k].max = Math.max(0, (k === 'teams' ? G.teams : G.members).length * L.rowH + 12 - L.listH);
  }
  g.buttons([{ text: 'Play a level', cls: 'primary', onClick: () => { g.close(); api.play(); } }]);
  refresh();
  scrollToMe();

  g.onDrag = {
    start(x, y) { if (y > L.listY) lists[tab].start(y); },
    move(x, y) { lists[tab].move(y); },
    end() { lists[tab].end(); },
  };
  g.onTap = (x, y) => {
    if (y >= L.tabY && y <= L.tabY + L.tabH) {
      const next = x < g.w / 2 ? 'teams' : 'members';
      if (next !== tab) { tab = next; intro = 0; scrollToMe(); }
      return;
    }
    if (y > L.listY && lists[tab].moved < 10) {
      const i = Math.floor((y - L.listY - 6 + lists[tab].y) / L.rowH);
      const r = rows()[i];
      if (!r) return;
      if (r.prize) g.toast(tab === 'teams' ? `${ordinal(r.place)} place pays every member` : `${ordinal(r.place)} in the company is paid`);
      else g.toast(tab === 'teams' ? `${r.name}: ${fmt(r.score)} shields` : `${r.you ? 'You' : r.name}: ${fmt(r.score)} shields`);
    }
  };

  function header(ctx, t, dt) {
    const G = v.game;
    const cx = g.w / 2;
    const rolling = count.step(dt);
    if (!rolling && Math.round(count.shown) > reported) {
      // the roll has landed: a pop of sparks off the shield
      burst(fx, 52, L.headY + 50, { n: 24, colors: ['#ffe070', '#fff', '#ff7a9a'], speed: 260, size: 5, kind: 'star', life: 0.9 });
      words.push({ text: `+${fmt(Math.round(count.shown) - reported)}`, x: 120, y: L.headY + 50, age: 0, size: 22 });
      reported = Math.round(count.shown);
      api.act({ seen: reported });
    }
    if (G.teamPlace <= 5) rays(ctx, cx, L.headY + 48, 140, t, 'rgba(255,220,140,.14)', 12);
    panel(ctx, 14, L.headY, g.w - 28, L.headH, 18, ['#8a1a30', '#3a0614']);
    shield(ctx, 52, L.headY + 50, 58 * (rolling ? 1 + 0.05 * Math.sin(t * 30) : 1));
    const name = G.team;
    bigText(ctx, name, 92, L.headY + 24, fitSize(ctx, name, g.w - 130, 17), '#fff3a0', '#2a0008', 'left');
    bigText(ctx, fmt(count.shown), 92, L.headY + 56, 34, '#fff', '#2a0008', 'left');
    smallText(ctx, `${ordinal(G.teamPlace)} of ${G.teams.length} companies`, 92, L.headY + 84, 13, G.teamPlace <= 5 ? '#b0ffc0' : '#ffd0d8', 'left');
    if (v.endsAt) smallText(ctx, `⏱ ${timeLeft(v.endsAt)}`, g.w - 26, L.headY + 16, 12, '#ffd0d8', 'right');
    // your place inside it
    smallText(ctx, `you: ${ordinal(G.myPlace)}`, g.w - 26, L.headY + 84, 13, G.myPlace <= 3 ? '#b0ffc0' : '#ffd0d8', 'right');
  }

  function tabs(ctx) {
    const w = (g.w - 36) / 2;
    [['teams', 'Companies'], ['members', 'Your company']].forEach(([k, label], i) => {
      const x = 14 + i * (w + 8);
      const on = tab === k;
      panel(ctx, x, L.tabY, w, L.tabH, 12, on ? ['#ffcf4a', '#c07000'] : ['#4a1a3a', '#2a0a1a'], on);
      bigText(ctx, label, x + w / 2, L.tabY + L.tabH / 2 + 1, 16, on ? '#fff' : '#d8b0c0', on ? '#5a2a00' : '#1a0010');
    });
  }

  g.draw = (ctx, dt, t) => {
    const G = v.game;
    since += dt;
    intro = Math.min(3, intro + dt);
    if (since > 6) { since = 0; refresh(); }
    backdrop(ctx, g.w, g.h, '#5a1020', '#14040a', 'rgba(255,190,190,.14)');
    header(ctx, t, dt);
    tabs(ctx);

    const s = lists[tab];
    s.step(dt);
    ctx.save();
    rr(ctx, 10, L.listY, g.w - 20, L.listH, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(20,4,10,.55)';
    ctx.fillRect(10, L.listY, g.w - 20, L.listH);
    const list = rows();
    const paidUpTo = tab === 'teams' ? Math.max(0, ...G.teamPrizes.map((p) => p.to ?? p.place)) : Math.max(0, ...G.memberPrizes.map((p) => p.to ?? p.place));
    list.forEach((row, i) => {
      const y = L.listY + 6 + i * L.rowH - s.y;
      if (y < L.listY - L.rowH || y > L.listY + L.listH) return;
      const k = ease.outBack(clamp01((intro - Math.min(i, 14) * 0.03) / 0.35));
      ctx.save();
      ctx.translate(lerp(g.w * 0.6, 0, k), 0);
      ctx.globalAlpha = clamp01(k * 1.5);
      if (row.you) {
        ctx.fillStyle = `rgba(255,210,80,${0.3 + 0.1 * Math.sin(t * 4)})`;
        rr(ctx, 14, y, g.w - 28, L.rowH - 5, 12);
        ctx.fill();
        ctx.strokeStyle = '#ffd23a';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = row.place <= paidUpTo ? 'rgba(80,220,140,.16)' : i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)';
        rr(ctx, 14, y, g.w - 28, L.rowH - 5, 12);
        ctx.fill();
      }
      const my = y + (L.rowH - 5) / 2;
      if (row.place <= 3) { ctx.fillStyle = MEDAL[row.place - 1]; ctx.beginPath(); ctx.arc(34, my, 13, 0, TAU); ctx.fill(); }
      bigText(ctx, String(row.place), 34, my, 15, '#fff', '#2a0a1a');
      let nx = 54;
      if (tab === 'members') { avatarDisc(ctx, row.avatar, 70, my, 15, row.you ? '#ffd23a' : '#c8a0b0'); nx = 92; }
      else { shield(ctx, 66, my, 24, row.you ? ['#ffd23a', '#c07000'] : ['#ff4f7a', '#9a1030']); nx = 84; }
      const name = row.you && tab === 'members' ? 'You' : row.name;
      bigText(ctx, name, nx, my - (row.prize ? 8 : 0), fitSize(ctx, name, g.w - nx - 84, 15), row.you ? '#ffe070' : '#fff', '#14040a', 'left');
      if (row.prize) drawReward(ctx, row.prize, nx, my + 10, 11, 'left', g.w - nx - 84);
      bigText(ctx, fmt(row.score), g.w - 28, my, 16, '#fff', '#14040a', 'right');
      ctx.restore();
      // a line under the last paid place
      if (row.place === paidUpTo && i < list.length - 1) {
        ctx.fillStyle = 'rgba(120,255,170,.6)';
        ctx.fillRect(22, y + L.rowH - 3, g.w - 44, 2);
      }
    });
    ctx.restore();

    // not enough shields yet: a banner over the list
    if (G.needMore > 0) {
      const by = L.listY + L.listH - 46;
      const pulse = 1 + 0.03 * Math.sin(t * 5);
      ctx.save();
      ctx.translate(g.w / 2, by + 18);
      ctx.scale(pulse, pulse);
      panel(ctx, -150, -18, 300, 36, 12, ['#ff7a4a', '#b0281a']);
      bigText(ctx, `${G.needMore} more shield${G.needMore === 1 ? '' : 's'} to be paid`, 0, 1, 16);
      ctx.restore();
    }

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };
  return g;
}
