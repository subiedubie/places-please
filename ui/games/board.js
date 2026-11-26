// THE LEADERBOARD SCREEN for the races (race), the Quick Change sprints
// (sprint) and Callbacks (bracket); rules in meta/events/race.js,
// sprint.js and bracket.js. One tall page you drag up and down:
//   race / sprint  the podium of the top three, a big "you" card (your
//                  place, how many points to pass the player above), then
//                  the whole board with each place's prize
//   bracket        you against this round's opponent, the three rounds
// An event on offer (sprint, bracket) shows what it is and a Start button.
// Since the last look: your score counts up and a climb in places is called.
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU, GAME_FONT,
} from './kit.js';
import {
  youFace, faceOf, token, ordinal, num, clockText, drawReward, counter, seenNote, startEvent,
  scroller, footer, powerIcon, emoji, bar,
} from './showkit.js';

const ROW_H = 46;
const MAX_W = 520; // the page is never wider than this; wider screens centre it
const REFRESH = 2; // seconds between looks at the rivals' scores

// A pedestal of the podium.
function pedestal(ctx, x, y, w, h, place) {
  const tops = { 1: ['#fff3a0', '#ffc21a', '#b06400'], 2: ['#ffffff', '#c8d0e8', '#6a7090'], 3: ['#ffd0a0', '#d0803a', '#7a3a10'] }[place];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  rr(ctx, x + 3, y + 6, w, h, 10); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tops[0]);
  g.addColorStop(0.3, tops[1]);
  g.addColorStop(1, tops[2]);
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  rr(ctx, x + 4, y + 4, w - 8, 8, 4); ctx.fill();
  ctx.restore();
  bigText(ctx, String(place), x + w / 2, y + Math.max(h * 0.62, 30), Math.min(34, h * 0.42), '#fff', tops[2]);
}

function crown(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = '#ffd21a';
  ctx.strokeStyle = '#8a4a00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.5);
  ctx.lineTo(x - s, y - s * 0.3);
  ctx.lineTo(x - s * 0.5, y + s * 0.1);
  ctx.lineTo(x, y - s * 0.6);
  ctx.lineTo(x + s * 0.5, y + s * 0.1);
  ctx.lineTo(x + s, y - s * 0.3);
  ctx.lineTo(x + s, y + s * 0.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff3a5a';
  ctx.beginPath(); ctx.arc(x, y + s * 0.15, s * 0.16, 0, TAU); ctx.fill();
  ctx.restore();
}

export function openBoard(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#3a1078', bottom: '#12052e', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const sc = scroller();
  const seen = seenNote(api, v);
  const before = seen.get();
  const you = () => (v.rows || []).find((r) => r.you);
  const myScore = counter(before && Number.isFinite(before.score) ? Math.min(before.score, you()?.score ?? 0) : you()?.score ?? 0);
  const shownScores = new Map(); // name -> counter, for the podium
  let showPrizes = false;
  let since = 0;
  let intro = 0; // podium rise, 0..1
  let cardPop = 0;
  const L = { w: 0, x: 0 };

  function noteSeen() {
    const me = you();
    if (me) seen.set({ place: me.place, score: me.score });
  }

  function refresh(first) {
    const old = you();
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const me = you();
    if (me) {
      myScore.to = me.score;
      if (!first && old && me.place < old.place) {
        words.push({ text: `Up to ${ordinal(me.place)}!`, x: g.w / 2, y: L.cardY || 300, age: 0, size: 26, color: '#7affa0', stroke: '#063a1a', life: 1.6 });
        cardPop = 1;
      }
    }
    buttons();
  }

  function buttons() {
    const G = v.game;
    const extra = [];
    if ((v.prizes || []).length > 1) extra.push({ text: showPrizes ? 'Board' : 'Prizes', onClick: () => { showPrizes = !showPrizes; buttons(); } });
    if (v.state === 'offer') {
      g.buttons([...extra, { text: 'Start', cls: 'primary', onClick: () => { startEvent(api); refresh(false); intro = 0; burst(fx, g.w / 2, g.h * 0.4, { n: 40, kind: 'star', speed: 360, size: 6, life: 1.1 }); } }]);
      window.dispatchEvent(new Event('resize'));
      return;
    }
    if (G.mode !== 'race' && !v.rows) { g.buttons(extra); window.dispatchEvent(new Event('resize')); return; }
    footer(g, api, extra);
  }
  refresh(true);

  // Since the last look: count your score up and call a climb in places.
  if (before && you()) {
    const me = you();
    if (before.place && me.place < before.place) {
      setTimeout(() => {
        words.push({ text: `▲ ${before.place - me.place} place${before.place - me.place === 1 ? '' : 's'}!`, x: g.w / 2, y: L.cardY || 300, age: 0, size: 30, color: '#7affa0', stroke: '#063a1a', life: 1.8 });
        cardPop = 1;
        burst(fx, g.w / 2, L.cardY || 300, { n: 30, colors: ['#7affa0', '#fff', '#ffe070'], kind: 'star', speed: 280, size: 5, life: 1 });
      }, 700);
    } else if (before.place && me.place > before.place) {
      setTimeout(() => g.toast(`Rivals passed you: ${ordinal(before.place)} → ${ordinal(me.place)}. Win levels to climb back!`, 2600), 600);
    }
  }
  noteSeen();

  g.onDrag = {
    start(x, y) { sc.start(y); },
    move(x, y) { sc.move(y); },
    end() { sc.end(); },
    cancel() { sc.end(); },
  };
  g.onTap = (x, y) => {
    if (showPrizes) { showPrizes = false; buttons(); return; }
    // A tap on a podium token: sparkle.
    burst(fx, x, y, { n: 8, colors: ['#fff', '#ffe070'], speed: 120, size: 3, gravity: 0, life: 0.4 });
  };

  // ---- drawing ----
  function header(ctx, t) {
    const G = v.game;
    // the countdown, and what the event counts
    const ends = v.endsAt;
    if (ends) clockText(ctx, ends, L.x + 14, 22, 15, 'left');
    if (G.mode === 'race' && G.multMax > 1) {
      const hot = G.mult > 1;
      const x = L.x + L.w - 44;
      if (hot) rays(ctx, x, 22, 30, t * 2, 'rgba(255,140,60,.3)', 10);
      panel(ctx, x - 30, 8, 60, 28, 14, hot ? ['#ff6a3a', '#a0100c'] : ['#6a5a8a', '#3a2a5a']);
      bigText(ctx, `x${G.mult}`, x, 23, 20);
    }
    if (G.mode === 'sprint' && G.power) {
      const x = L.x + L.w - 70;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      rr(ctx, x - 20, 8, 84, 30, 15); ctx.fill();
      powerIcon(ctx, G.power, x, 23, 24);
      bigText(ctx, 'fired', x + 32, 23, 14, '#ffe9a8');
    }
  }

  function podium(ctx, t, y0) {
    const rows = v.rows || [];
    const top = [rows[1], rows[0], rows[2]];
    const W = L.w;
    const pw = Math.min(104, (W - 40) / 3);
    const heights = [70, 100, 52];
    const places = [2, 1, 3];
    const base = y0 + 190;
    intro = Math.min(1, intro + 0.02);
    const k = ease.outBack(clamp01(intro * 1.4));
    // the light behind the winner
    rays(ctx, L.x + W / 2, base - heights[1] - 40, 150, t, 'rgba(255,230,140,.16)', 16);
    top.forEach((r, i) => {
      const x = L.x + W / 2 + (i - 1) * (pw + 8) - pw / 2;
      const h = heights[i] * k;
      pedestal(ctx, x, base - h, pw, h, places[i]);
      if (!r) return;
      let c = shownScores.get(r.name);
      if (!c) { c = counter(0); shownScores.set(r.name, c); }
      c.to = r.score;
      c.step(1 / 60);
      const cy = base - h - 34;
      const bob = Math.sin(t * 2.2 + i) * 2;
      token(ctx, r.you ? youFace(v.game.avatar) : faceOf(r.name), x + pw / 2, cy + bob, i === 1 ? 28 : 24, r.you, r.you ? 0.6 + 0.4 * Math.sin(t * 4) : 0);
      if (i === 1) crown(ctx, x + pw / 2, cy - 34 + bob, 14);
      const name = r.you ? 'You' : r.name;
      bigText(ctx, name.length > 11 ? name.slice(0, 10) + '…' : name, x + pw / 2, cy - (i === 1 ? 58 : 32), 14, r.you ? '#7affa0' : '#fff');
      bigText(ctx, num(c.shown), x + pw / 2, base - h + 14, 15, '#fff', '#3a1a00');
    });
    // the stage edge
    const fl = ctx.createLinearGradient(0, base, 0, base + 16);
    fl.addColorStop(0, '#8a3a10');
    fl.addColorStop(1, '#3a1000');
    ctx.fillStyle = fl;
    rr(ctx, L.x + 8, base, W - 16, 14, 6); ctx.fill();
    ctx.fillStyle = '#ffc21a';
    ctx.fillRect(L.x + 8, base, W - 16, 3);
    return base + 22;
  }

  function youCard(ctx, t, y) {
    const rows = v.rows || [];
    const me = you();
    if (!me) return y;
    const W = L.w;
    cardPop = Math.max(0, cardPop - 1 / 40);
    const s = 1 + 0.06 * Math.sin(cardPop * Math.PI);
    const h = 104;
    L.cardY = y + 20;
    ctx.save();
    ctx.translate(L.x + W / 2, y + h / 2);
    ctx.scale(s, s);
    ctx.translate(-(L.x + W / 2), -(y + h / 2));
    panel(ctx, L.x + 14, y, W - 28, h, 18, me.prize ? ['#2ec070', '#0a6a34'] : ['#5b24b8', '#2a0b6e']);
    token(ctx, youFace(v.game.avatar), L.x + 52, y + 40, 26, true, 0.3);
    bigText(ctx, ordinal(me.place), L.x + 52, y + 84, 22, '#ffe070', '#3a1000');
    myScore.step(1 / 60);
    bigText(ctx, num(myScore.shown), L.x + 96, y + 30, 32, '#fff', '#06301a', 'left');
    const unit = v.game.mode === 'race' ? 'points' : v.game.mode === 'sprint' ? 'fired' : 'this round';
    ctx.save();
    ctx.font = `32px ${GAME_FONT}`;
    const wNum = ctx.measureText(num(myScore.shown)).width;
    ctx.restore();
    bigText(ctx, unit, L.x + 102 + wNum, y + 34, 14, '#e8ffe8', '#06301a', 'left');
    const above = rows[me.place - 2];
    let line;
    if (!above) {
      const below = rows[me.place];
      const by = below ? me.score - below.score : 0;
      line = me.score === 0 ? 'Score one to take the lead!' : by > 0 ? `You lead by ${num(by)}!` : 'Level at the top: a tie goes to you!';
    } else {
      const need = Math.max(1, above.score - me.score);
      line = `${num(need)} more to pass ${above.name}`;
    }
    bigText(ctx, line, L.x + 96, y + 64, 16, '#fff', '#06301a', 'left');
    // what this place pays, or what the next paid place needs
    if (me.prize && me.score > 0) {
      bigText(ctx, 'Paying now:', L.x + 96, y + 88, 13, '#e8ffe8', '#06301a', 'left');
      drawReward(ctx, me.prize, L.x + 180, y + 88, 18, 'left', 2);
    } else {
      const paid = rows.filter((r) => r.prize);
      const lastPaid = paid[paid.length - 1];
      if (lastPaid) bigText(ctx, `${num(Math.max(1, lastPaid.score - me.score))} more for a prize (${ordinal(lastPaid.place)})`, L.x + 96, y + 88, 13, '#ffe9a8', '#2a0a5e', 'left');
    }
    ctx.restore();
    return y + h + 18;
  }

  function list(ctx, t, y) {
    const rows = v.rows || [];
    const W = L.w;
    ribbon(ctx, v.game.mode === 'race' ? 'The board' : 'Standings', L.x + W / 2, y + 14, 150, 28);
    y += 40;
    rows.forEach((r, i) => {
      const ry = y + i * ROW_H;
      if (ry - sc.y > g.h + 40 || ry - sc.y < -ROW_H - 40) return; // off screen
      ctx.fillStyle = r.you ? 'rgba(62,224,122,.32)' : i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)';
      rr(ctx, L.x + 12, ry, W - 24, ROW_H - 6, 12); ctx.fill();
      if (r.you) { ctx.strokeStyle = '#7affa0'; ctx.lineWidth = 2; rr(ctx, L.x + 12, ry, W - 24, ROW_H - 6, 12); ctx.stroke(); }
      const mid = ry + (ROW_H - 6) / 2;
      bigText(ctx, ordinal(r.place), L.x + 40, mid, 15, r.place <= 3 ? '#ffe070' : '#fff');
      token(ctx, r.you ? youFace(v.game.avatar) : faceOf(r.name), L.x + 80, mid, 15, r.you);
      bigText(ctx, r.you ? 'You' : r.name, L.x + 102, mid, 15, '#fff', '#2a0a5e', 'left');
      if (r.prize) drawReward(ctx, r.prize, L.x + W - 86, mid, 15, 'right', 1);
      bigText(ctx, num(r.score), L.x + W - 26, mid, 17, '#fff', '#2a0a5e', 'right');
    });
    return y + rows.length * ROW_H + 10;
  }

  function prizeLadder(ctx) {
    const W = L.w;
    const list2 = v.prizes || [];
    const ph = 70 + list2.length * 40;
    const py = Math.max(10, (g.h - ph) / 2);
    ctx.fillStyle = 'rgba(10,2,30,.6)';
    ctx.fillRect(0, 0, g.w, g.h);
    panel(ctx, L.x + 20, py, W - 40, ph, 18, ['#3a137e', '#1a0640']);
    bigText(ctx, 'Prizes', L.x + W / 2, py + 26, 24, '#ffe070', '#3a1000');
    const me = you();
    list2.forEach((p, i) => {
      const y = py + 62 + i * 40;
      const mine = me && me.place >= p.place && me.place <= (p.to ?? p.place);
      if (mine) { ctx.fillStyle = 'rgba(62,224,122,.35)'; rr(ctx, L.x + 30, y - 16, W - 60, 34, 10); ctx.fill(); }
      const label = p.to ? `${ordinal(p.place)}–${ordinal(p.to)}` : ordinal(p.place);
      if (p.place <= 3 && !p.to) chest(ctx, L.x + 50, y + 2, 26, 0, p.place === 1 ? ['#ffcf3a', '#a05a00'] : undefined);
      bigText(ctx, label, L.x + 74, y, 17, '#fff', '#2a0a5e', 'left');
      drawReward(ctx, p.reward, L.x + W - 40, y, 18, 'right', 3);
    });
    bigText(ctx, 'Tap to close', L.x + W / 2, py + ph - 14, 12, '#c8b8ff');
  }

  // An event on offer, or between runs (sprint, bracket).
  function offerCard(ctx, t) {
    const G = v.game;
    const W = L.w;
    const y = 30;
    rays(ctx, L.x + W / 2, y + 110, 180, t, 'rgba(255,230,140,.16)', 16);
    panel(ctx, L.x + 20, y, W - 40, 300, 22, ['#5b24b8', '#2a0b6e']);
    if (G.mode === 'sprint') {
      powerIcon(ctx, G.power, L.x + W / 2, y + 70, 74);
      bigText(ctx, `${G.minutes} minutes`, L.x + W / 2, y + 130, 30, '#ffe070', '#3a1000');
      bigText(ctx, 'Fire more of these than four', L.x + W / 2, y + 166, 16);
      bigText(ctx, 'rivals, in levels you win.', L.x + W / 2, y + 188, 16);
    } else {
      // bracket: eight entrants, three rounds
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        token(ctx, faceOf('entrant' + i), L.x + W / 2 + Math.cos(a) * 58, y + 82 + Math.sin(a) * 46, 15, false);
      }
      emoji(ctx, '🎭', L.x + W / 2, y + 82, 40);
      bigText(ctx, `${G.entrants} hopefuls · ${G.rounds} rounds`, L.x + W / 2, y + 160, 20, '#ffe070', '#3a1000');
      bigText(ctx, `${G.roundMinutes} minutes a round. Fire power-ups`, L.x + W / 2, y + 190, 15);
      bigText(ctx, 'on first attempts to go through.', L.x + W / 2, y + 210, 15);
    }
    const prize = (v.prizes || [])[0];
    if (prize) {
      bigText(ctx, 'First prize', L.x + W / 2, y + 236, 14, '#ffe9a8');
      drawReward(ctx, prize.reward, L.x + W / 2, y + 262, 22, 'center', 3);
    }
    const lastLine = G.mode === 'sprint'
      ? (G.last ? `Last sprint: ${ordinal(G.last)}` : '')
      : (G.last === 'won' ? 'Last bracket: you won it!' : G.last ? `Last bracket: out in round ${G.last}` : '');
    const more = v.state === 'offer' ? `${G.left} of ${G.perDay} left today · tap Start` : 'All used today. Back tomorrow!';
    bigText(ctx, more, L.x + W / 2, y + 330, 16, '#fff');
    if (lastLine) bigText(ctx, lastLine, L.x + W / 2, y + 356, 15, '#c8b8ff');
    return y + 380;
  }

  // Bracket: you against this round's opponent.
  function versus(ctx, t) {
    const G = v.game;
    const W = L.w;
    const rows = v.rows || [];
    const me = rows.find((r) => r.you);
    const them = rows.find((r) => !r.you);
    const y = 44;
    // the three rounds
    for (let i = 0; i < G.rounds; i++) {
      const x = L.x + W / 2 + (i - (G.rounds - 1) / 2) * 92;
      const done = i < G.round;
      const cur = i === G.round;
      if (cur) rays(ctx, x, y + 14, 34, t, 'rgba(255,230,140,.25)', 10);
      panel(ctx, x - 38, y, 76, 28, 14, done ? ['#3ee07a', '#0a8a3a'] : cur ? ['#ff6a9a', '#b0103c'] : ['#6a5a8a', '#3a2a5a']);
      bigText(ctx, i === G.rounds - 1 ? 'Final' : `Round ${i + 1}`, x, y + 15, 15);
    }
    const cy = y + 140;
    const lead = me && them ? me.score - them.score : 0;
    const pulse = 1 + 0.04 * Math.sin(t * 5);
    panel(ctx, L.x + 16, cy - 80, W / 2 - 24, 190, 20, lead >= 0 ? ['#2ec070', '#0a6a34'] : ['#5b24b8', '#2a0b6e']);
    panel(ctx, L.x + W / 2 + 8, cy - 80, W / 2 - 24, 190, 20, lead < 0 ? ['#ff5a6a', '#8a0a1a'] : ['#5b24b8', '#2a0b6e']);
    token(ctx, youFace(G.avatar), L.x + W / 4 + 2, cy - 22, 34 * (lead >= 0 ? pulse : 1), true, lead >= 0 ? 0.5 : 0);
    token(ctx, faceOf(them ? them.name : '?'), L.x + (W * 3) / 4 - 2, cy - 22, 34 * (lead < 0 ? pulse : 1), false);
    bigText(ctx, 'You', L.x + W / 4 + 2, cy + 26, 17, '#7affa0');
    bigText(ctx, them ? them.name : '', L.x + (W * 3) / 4 - 2, cy + 26, 17);
    myScore.step(1 / 60);
    bigText(ctx, num(myScore.shown), L.x + W / 4 + 2, cy + 70, 44);
    bigText(ctx, num(them ? them.score : 0), L.x + (W * 3) / 4 - 2, cy + 70, 44);
    // the VS medallion
    ctx.save();
    ctx.translate(L.x + W / 2, cy + 10);
    ctx.rotate(Math.sin(t * 2) * 0.08);
    ctx.fillStyle = '#4a2000';
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
    const gg = ctx.createLinearGradient(0, -26, 0, 26);
    gg.addColorStop(0, '#fff0a8'); gg.addColorStop(1, '#b06400');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
    ctx.restore();
    bigText(ctx, 'VS', L.x + W / 2, cy + 11, 22, '#fff', '#5a2000');
    const msg = lead > 0 ? `Ahead by ${lead}! Keep firing.` : lead === 0 ? (me && me.score > 0 ? 'Level! A tie goes to you.' : 'Fire power-ups on first attempts') : `${-lead} behind: fire power-ups on first tries!`;
    bigText(ctx, msg, L.x + W / 2, cy + 140, 17, lead >= 0 ? '#7affa0' : '#ffb0c0');
    if (v.endsAt) clockText(ctx, v.endsAt, L.x + W / 2, cy + 172, 16);
    const prize = (v.prizes || [])[0];
    if (prize) {
      bigText(ctx, 'Win all three:', L.x + W / 2, cy + 210, 14, '#ffe9a8');
      drawReward(ctx, prize.reward, L.x + W / 2, cy + 236, 20);
    }
    return tree(ctx, t, cy + 262, me, them);
  }

  // The bracket of eight: your path lit up to the trophy.
  function tree(ctx, t, y0, me, them) {
    const G = v.game;
    const W = L.w;
    const h = 150;
    panel(ctx, L.x + 16, y0, W - 32, h, 16, ['#3a137e', '#1a0640']);
    const cols = G.rounds + 1; // 8, 4, 2, then the winner
    const colX = (c) => L.x + 44 + (c * (W - 120)) / (cols - 1);
    const slotY = (c, i) => {
      const n = 2 ** (G.rounds - c);
      return y0 + 14 + ((i + 0.5) * (h - 28)) / n;
    };
    for (let c = 0; c < cols; c++) {
      const n = 2 ** (G.rounds - c);
      for (let i = 0; i < n; i++) {
        const x = colX(c);
        const y = slotY(c, i);
        // the line to the next round
        if (c < cols - 1) {
          const ny = slotY(c + 1, Math.floor(i / 2));
          const mine = i === 0 && c < G.round;
          ctx.strokeStyle = mine ? '#7affa0' : 'rgba(255,255,255,.25)';
          ctx.lineWidth = mine ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo((x + colX(c + 1)) / 2, y); ctx.lineTo((x + colX(c + 1)) / 2, ny); ctx.lineTo(colX(c + 1) - 9, ny); ctx.stroke();
        }
        if (c === cols - 1) { emoji(ctx, '🏆', x, y, 26); continue; }
        // who sits here: you on the top line as far as you have got
        const youHere = i === 0 && c <= G.round;
        const rival = c === G.round && i === 1 && them;
        const r = c === 0 ? 8 : 10;
        if (youHere) token(ctx, youFace(G.avatar), x, y, r, true, c === G.round ? 0.5 + 0.4 * Math.sin(t * 4) : 0);
        else if (rival) token(ctx, faceOf(them.name), x, y, r, false);
        else if (c === 0) token(ctx, faceOf(`entrant${i}`), x, y, r, false);
        else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); bigText(ctx, '?', x, y + 1, 11, '#c8b8ff'); }
      }
    }
    return y0 + h + 14;
  }

  g.draw = (ctx, dt, t) => {
    since += dt;
    if (since > REFRESH) { since = 0; refresh(false); if (!v) return; }
    L.w = Math.min(g.w, MAX_W);
    L.x = Math.round((g.w - L.w) / 2);
    backdrop(ctx, g.w, g.h, '#3a1078', '#12052e');
    sc.step(dt);
    ctx.save();
    ctx.translate(0, -sc.y);
    const G = v.game;
    let bottom;
    if (!v.rows) bottom = offerCard(ctx, t);
    else if (G.mode === 'bracket') bottom = versus(ctx, t);
    else {
      header(ctx, t);
      let y = podium(ctx, t, 46);
      y = youCard(ctx, t, y);
      bottom = list(ctx, t, y);
    }
    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
    ctx.restore();
    sc.max = Math.max(0, bottom - g.h + 10);
    sc.clamp();
    if (sc.max > 0 && sc.y < 4) bigText(ctx, '▼ drag for the full board', g.w / 2, g.h - 12, 12, 'rgba(255,240,200,.75)');
    if (showPrizes) prizeLadder(ctx);
  };
  return g;
}
