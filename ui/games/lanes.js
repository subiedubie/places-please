// THE LANES SCREEN for Opening Night Dash (dash) and the Ghost Light Run
// (streak with lanes); rules in meta/events/dash.js and streak.js.
// Every racer has a lane climbing up the stage toward the chest on the
// finish line; one rung per win. When the screen opens, everyone climbs
// from where they were the last time you looked to where they are now.
// The dash pays the first three home; a staged streak pays each stage
// (and starts the stage again if a rival gets there first).
import {
  openGame, panel, bigText, ribbon, chest, burst, sparks, floaters, rays, backdrop, rr,
  ease, clamp01, lerp, TAU,
} from './kit.js';
import {
  youFace, faceOf, token, ordinal, num, clockText, drawReward, seenNote, startEvent, footer, bar,
} from './showkit.js';

const MAX_W = 520;
const CLIMB_SECONDS = 1.4; // how long the "since you last looked" climb takes
const REFRESH = 2;

export function openLanes(api) {
  let v = api.view();
  if (!v || !v.game) return null;
  const g = openGame({ title: v.title, top: '#2a0f5c', bottom: '#0e0428', onClose: () => api.changed() });
  const fx = [];
  const words = [];
  const seen = seenNote(api, v);
  const before = seen.get() || {};
  let climb = 0; // 0..1 of the opening climb
  let since = 0;
  let chestOpen = -1;
  const L = {};
  const finishedShown = new Set();
  const disp = new Map(); // racer -> the rung shown now (climbs toward the real one)

  // The racers: [{ name, have, need, you, finished, place }]
  function racers() {
    const G = v.game;
    if (G.mode === 'dash') {
      const rows = v.rows || [{ name: 'You', score: 0, you: true }];
      const need = G.target;
      const done = rows.filter((r) => !r.you && r.score >= need).sort((a, b) => a.finishAt - b.finishAt);
      return rows.map((r) => ({
        name: r.name, have: Math.min(need, r.score), need, you: r.you,
        place: r.you ? G.place : r.score >= need ? done.indexOf(r) + 1 : null,
      }));
    }
    return (v.lanes || []).map((l) => ({ name: l.name, have: Math.min(l.need, l.have), need: l.need, you: l.you, place: null }));
  }
  // Keep the order fixed: you in the middle lane.
  function ordered(list) {
    const others = list.filter((r) => !r.you).sort((a, b) => (a.name < b.name ? -1 : 1));
    const me = list.find((r) => r.you);
    const mid = Math.floor(others.length / 2);
    return [...others.slice(0, mid), me, ...others.slice(mid)].filter(Boolean);
  }

  function refresh() {
    v = api.view();
    if (!v || !v.game) { g.close(); return; }
    const G = v.game;
    if (v.state === 'offer') {
      g.buttons([{ text: 'Start the dash', cls: 'primary', onClick: () => {
        startEvent(api);
        refresh();
        burst(fx, g.w / 2, g.h * 0.5, { n: 40, kind: 'star', speed: 380, size: 6, life: 1.1 });
        words.push({ text: 'GO!', x: g.w / 2, y: g.h * 0.45, age: 0, size: 64, life: 1.2 });
      } }]);
      window.dispatchEvent(new Event('resize'));
    } else if (v.state === 'running') footer(g, api);
    else { g.buttons([]); window.dispatchEvent(new Event('resize')); }
    const me = racers().find((r) => r.you);
    g.note(G.mode === 'dash'
      ? (v.state === 'offer' ? `Five racers. First to win ${G.target} levels takes the house.` : me && me.place ? `You finished ${ordinal(me.place)}!` : `Win levels to climb. ${G.target - (me ? me.have : 0)} to go.`)
      : `Stage ${G.stage + 1} of ${G.stages.length}: win ${G.stages[G.stage]} in a row. A loss, or a rival home first, starts it again.`);
  }
  refresh();
  if (v.game.mode === 'streak' && before.tries !== undefined && v.game.tries > before.tries) {
    setTimeout(() => g.toast('A rival got home first: the stage started again with new rivals.', 2800), 500);
  }
  if (v.game.mode === 'streak' && before.stage !== undefined && v.game.stage > before.stage) {
    setTimeout(() => { chestOpen = 0; g.toast(`Stage ${before.stage + 1} cleared! Its prize is in your tray.`, 2600); }, CLIMB_SECONDS * 1000);
  }
  function remember() {
    const pos = {};
    for (const r of racers()) pos[r.you ? '@you' : r.name] = r.have;
    seen.set({ pos, stage: v.game.stage ?? 0, tries: v.game.tries ?? 0 });
  }
  remember();

  g.onTap = (x, y) => burst(fx, x, y, { n: 8, colors: ['#fff', '#ffe070'], speed: 120, size: 3, gravity: 0, life: 0.4 });

  function rung(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(255,220,150,.22)';
    rr(ctx, x - w / 2, y - 2, w, 4, 2); ctx.fill();
  }

  g.draw = (ctx, dt, t) => {
    since += dt;
    if (since > REFRESH) { since = 0; const was = racers(); refresh(); if (!v) return; celebrate(was); }
    const G = v.game;
    const W = Math.min(g.w, MAX_W);
    const X = Math.round((g.w - W) / 2);
    backdrop(ctx, g.w, g.h, '#2a0f5c', '#0e0428');
    climb = Math.min(1, climb + dt / CLIMB_SECONDS);
    const list = ordered(racers());
    const n = Math.max(1, list.length);
    const need = list[0] ? list[0].need : 1;

    // ---- top: stage pips (streak) or the prizes (dash) ----
    const topH = 74;
    if (G.mode === 'streak') {
      G.stages.forEach((s, i) => {
        const x = X + W / 2 + (i - (G.stages.length - 1) / 2) * 96;
        const cur = i === G.stage && v.state === 'running';
        const done = i < G.stage || v.state === 'won';
        if (cur) rays(ctx, x, 24, 36, t, 'rgba(255,230,140,.25)', 10);
        panel(ctx, x - 40, 10, 80, 30, 14, done ? ['#3ee07a', '#0a8a3a'] : cur ? ['#ff6a9a', '#b0103c'] : ['#6a5a8a', '#3a2a5a']);
        bigText(ctx, done ? '✓' : `${s} in a row`, x, 26, 15);
        const step = (v.steps || [])[i];
        if (step) drawReward(ctx, step.reward, x, 56, 15, 'center', 2);
      });
    } else {
      (v.prizes || []).slice(0, 3).forEach((p, i) => {
        const x = X + W / 2 + (i - 1) * 110;
        panel(ctx, x - 50, 8, 100, 54, 14, i === 0 ? ['#ffcf3a', '#a05a00'] : i === 1 ? ['#c8d0e8', '#5a6080'] : ['#d0803a', '#6a2a08']);
        bigText(ctx, ordinal(p.place), x, 22, 16);
        drawReward(ctx, p.reward, x, 46, 15, 'center', 2);
      });
    }

    // ---- the lanes ----
    const laneTop = topH + 60;
    const laneBottom = g.h - 92;
    const laneH = Math.max(120, laneBottom - laneTop);
    const lw = Math.min(70, (W - 24) / n);
    const left = X + (W - lw * n) / 2;
    // the finish line and its chest
    ctx.save();
    for (let i = 0; i < Math.ceil((lw * n) / 10); i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#fff' : '#1a0a2a';
        ctx.fillRect(left + i * 10, laneTop - 10 + j * 5, 10, 5);
      }
    }
    ctx.restore();
    const cx = X + W / 2;
    const cy = laneTop - 36;
    if (chestOpen >= 0) {
      chestOpen += dt;
      rays(ctx, cx, cy, 70 * ease.out(clamp01(chestOpen / 0.4)), t, 'rgba(255,230,140,.35)', 12);
      chest(ctx, cx, cy, 52 * (1 + 0.25 * Math.sin(clamp01(chestOpen / 0.5) * Math.PI)), clamp01(chestOpen / 0.3));
      if (chestOpen > 0.25 && !L.popped) { L.popped = true; burst(fx, cx, cy, { n: 40, colors: ['#ffe070', '#fff', '#7affa0'], speed: 320, size: 6, kind: 'star', life: 1.2 }); }
      if (chestOpen > 2.2) { chestOpen = -1; L.popped = false; }
    } else {
      rays(ctx, cx, cy, 52, t, 'rgba(255,230,140,.16)', 12);
      chest(ctx, cx, cy + Math.sin(t * 2) * 2, 50, 0);
    }

    list.forEach((r, i) => {
      const x = left + lw * (i + 0.5);
      // the lane: a strip of stage floor
      const lg = ctx.createLinearGradient(0, laneTop, 0, laneTop + laneH);
      lg.addColorStop(0, r.you ? 'rgba(62,224,122,.28)' : 'rgba(255,255,255,.1)');
      lg.addColorStop(1, r.you ? 'rgba(62,224,122,.08)' : 'rgba(255,255,255,.03)');
      ctx.fillStyle = lg;
      rr(ctx, x - lw / 2 + 4, laneTop, lw - 8, laneH, 12); ctx.fill();
      for (let k = 1; k < need; k++) rung(ctx, x, laneTop + laneH - (laneH * k) / need, lw - 18);
      // where this racer was, and where they are now
      const key = r.you ? '@you' : r.name;
      if (!disp.has(key)) {
        const was = (before.pos || {})[key];
        disp.set(key, Number.isFinite(was) && was <= r.have ? was : r.have);
      }
      let shown = disp.get(key);
      if (climb > 0.25) {
        if (shown < r.have) shown = Math.min(r.have, shown + Math.max(dt * 1.5, (r.have - shown) * dt * 2.5));
        else if (shown > r.have) shown = Math.max(r.have, shown - dt * need); // a stage started again
        disp.set(key, shown);
      }
      const ty = laneTop + laneH - (laneH * shown) / need - 4;
      // the trail
      if (shown > 0) {
        const tg = ctx.createLinearGradient(0, ty, 0, laneTop + laneH);
        tg.addColorStop(0, r.you ? 'rgba(122,255,160,.75)' : 'rgba(255,224,112,.5)');
        tg.addColorStop(1, 'rgba(255,224,112,0)');
        ctx.fillStyle = tg;
        rr(ctx, x - 4, ty, 8, laneTop + laneH - ty, 4); ctx.fill();
      }
      const hop = shown < r.have - 0.01 ? Math.abs(Math.sin(t * 14)) * 5 : Math.sin(t * 2 + i) * 1.5;
      const tr = Math.min(22, lw * 0.36);
      token(ctx, r.you ? youFace(G.avatar) : faceOf(r.name), x, ty - tr - hop, tr, r.you, r.you ? 0.5 + 0.3 * Math.sin(t * 4) : 0);
      if (r.place) {
        ctx.fillStyle = r.place === 1 ? '#ffd21a' : r.place === 2 ? '#d8dcea' : r.place === 3 ? '#e0904a' : '#9a8ab8';
        ctx.beginPath(); ctx.arc(x + tr * 0.8, ty - tr * 1.8 - hop, 10, 0, TAU); ctx.fill();
        bigText(ctx, String(r.place), x + tr * 0.8, ty - tr * 1.8 - hop + 1, 12);
      }
      // name and count under the lane
      const nm = r.you ? 'You' : r.name;
      bigText(ctx, nm.length > 8 ? nm.slice(0, 7) + '…' : nm, x, laneTop + laneH + 14, 12, r.you ? '#7affa0' : '#fff');
      bigText(ctx, `${num(Math.round(shown))}/${need}`, x, laneTop + laneH + 32, 15, '#ffe070', '#3a1000');
    });

    // ---- your line at the bottom ----
    const me = list.find((r) => r.you);
    if (me) {
      const ahead = list.filter((r) => !r.you && r.have > me.have).length;
      const msg = v.state === 'offer' ? 'Press Start when you are ready to play'
        : me.place ? `Home in ${ordinal(me.place)} place!`
          : v.state !== 'running' ? 'This race is over'
            : ahead === 0 ? `${list.some((r) => !r.you && r.have === me.have) ? 'Level at the front!' : 'You lead!'} ${me.need - me.have} more to the chest`
              : `${ahead} ahead of you · ${me.need - me.have} wins to the chest`;
      bigText(ctx, msg, X + W / 2, g.h - 30, 17, ahead === 0 ? '#7affa0' : '#fff');
    }
    if (G.mode === 'dash' && G.startedAt && v.state === 'running') {
      // How long since the start (the rivals keep their own pace).
      const mins = Math.floor((Date.now() - G.startedAt) / 60000);
      bigText(ctx, `${mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm'}`, X + W - 14, laneTop - 40, 13, '#c8b8ff', '#2a0a5e', 'right');
      bigText(ctx, 'since the start', X + W - 14, laneTop - 24, 11, '#c8b8ff', '#2a0a5e', 'right');
    }
    if (v.endsAt && G.mode === 'streak') clockText(ctx, v.endsAt, X + W - 12, laneTop - 30, 13, 'right');

    sparks(ctx, fx, dt);
    floaters(ctx, words, dt);
  };

  // Someone just crossed the line while the screen was open.
  function celebrate(was) {
    const now = racers();
    for (const r of now) {
      const old = was.find((w) => w.name === r.name);
      if (old && old.have < r.need && r.have >= r.need && !finishedShown.has(r.name)) {
        finishedShown.add(r.name);
        g.toast(r.you ? 'You crossed the line!' : `${r.name} is home${r.place ? ` (${ordinal(r.place)})` : ''}`);
      }
    }
    remember();
  }
  return g;
}
