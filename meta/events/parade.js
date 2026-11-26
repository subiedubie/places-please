// PAPER DRAGON PARADE (type 'parade'). A team of four (you and three
// computer teammates) builds four giant paper-dragon parade puppets, one
// after another, each in three stages: twelve stages in all. Every stage
// needs a number of tokens from the whole team; its prize goes to you.
// Finishing the fourth dragon pays the grand prize and ends the event.
//
// Tokens come from the plinko table. Every level you win pays balls (more
// for harder levels). On the table you slide the launcher along the top
// and let go: the ball falls through pegs and round bumpers (each hit adds
// points) and lands in one of seven slots that multiply the points:
// 1x 2x 5x 10x 5x 2x 1x. Points x multiplier = tokens.
//
// Teammates: each one's gifts follow a schedule fixed by the seed when the
// event starts (meta/events/rivals.js); they never react to you. They can
// carry at most part of each stage (cfg.youShare): the rest has to come
// from you, so a stage always needs you to play.
//
// Balls not used when the event ends are lost.
//
// The ball physics is in this file too (pure numbers, no screen), so the
// play screen and the tests run exactly the same steps: the same drop from
// the same place with the same ball number always takes the same path.
// The screen runs the ball and reports where it landed; the rules check
// the report and cap it, so a broken screen cannot overpay.
//
// Saved: inst.data = {
//   balls,        balls you can drop
//   mine,         tokens you have given in all
//   stage,        stages finished (0..12)
//   next,         number of the next ball dropped
//   pending: { ball: x }  dropped but not yet landed (replayed if the
//                          screen was closed while they fell)
//   best,         your best single ball, in tokens
//   tens,         how many of your balls found the 10x slot
// }
import { YOU } from '../../config/rivals.js';
import { dailyRivals } from './rivals.js';
import { hash, rng, rank, scaleReward } from './util.js';

// ---------------------------------------------------------------------------
// THE TABLE. All sizes are in table units: the table is TABLE.w wide and
// TABLE.h tall; the screen scales it to fit. The point values and the
// multipliers come from config (cfg.points, cfg.slots, cfg.slotWidths).

export const TABLE = {
  w: 360,
  h: 560,
  ball: 7, // ball radius
  gravity: 1000, // units per second per second
  step: 1 / 240, // one physics step, in seconds (fixed, so paths repeat)
  maxSpeed: 950,
  dropY: 22, // where the ball starts
  jitter: 60, // each ball starts with its own sideways speed, up to this either way
  dropMin: 24, // the launcher's range along the top
  dropMax: 336,
  slotTop: 478, // the top of the slot dividers
  landY: 540, // a ball this low has landed
  maxSeconds: 14, // a ball still bouncing after this lands where it is
  bumperKick: 330, // extra speed a bumper throws the ball away with
  kickerKick: 200, // extra speed a side kicker throws it back in with
  drag: 0.12, // air: share of speed lost per second
  kickFade: 7, // seconds over which the bumpers' kick fades away
};

// The obstacles: pegs, bumpers, side kickers and the slot dividers.
// Built once per config and cached.
const tableCache = new WeakMap();
export function tableOf(cfg) {
  if (tableCache.has(cfg)) return tableCache.get(cfg);
  const T = TABLE;
  const pts = cfg.points;
  const circles = []; // { x, y, r, kind: 'peg' | 'bumper' | 'cap', points, kick, e, id }
  const segs = []; // { ax, ay, bx, by, kind: 'wall' | 'kicker', kick, e, id }
  // Ten big round bumpers, all worth the same, in three staggered rows
  // (3, 4, 3) with open lanes between them: the ball is thrown from one to
  // the next and rattles around before it drops into a slot. No small pins.
  const bumpers = [];
  const rowsAt = [[150, [80, 180, 280]], [245, [54, 138, 222, 306]], [340, [80, 180, 280]]];
  for (const [y, xs] of rowsAt) for (const x of xs) bumpers.push({ x, y, r: 22, points: pts.bumper });
  for (const b of bumpers) circles.push({ ...b, kind: 'bumper', kick: T.bumperKick, e: 0.7 });
  // Side walls, and kickers: slanted rails low on each side that throw the
  // ball back toward the middle.
  segs.push({ ax: 0, ay: 0, bx: T.w, by: 0, kind: 'wall', kick: 0, e: 0.3 });
  segs.push({ ax: 0, ay: 0, bx: 0, by: T.h, kind: 'wall', kick: 0, e: 0.45 });
  segs.push({ ax: T.w, ay: 0, bx: T.w, by: T.h, kind: 'wall', kick: 0, e: 0.45 });
  segs.push({ ax: 0, ay: 372, bx: 34, by: 420, kind: 'kicker', kick: T.kickerKick, e: 0.6, points: pts.kicker });
  segs.push({ ax: T.w, ay: 372, bx: T.w - 34, by: 420, kind: 'kicker', kick: T.kickerKick, e: 0.6, points: pts.kicker });
  // The slots: widths from config, dividers between them with round caps.
  const widths = cfg.slotWidths;
  const sum = widths.reduce((a, b) => a + b, 0);
  const edges = [0];
  for (const wd of widths) edges.push(edges[edges.length - 1] + (wd / sum) * T.w);
  for (let i = 1; i < edges.length - 1; i++) {
    segs.push({ ax: edges[i], ay: T.slotTop, bx: edges[i], by: T.h, kind: 'wall', kick: 0, e: 0.3 });
    circles.push({ x: edges[i], y: T.slotTop, r: 3, kind: 'cap', points: 0, kick: 0, e: 0.4 });
  }
  circles.forEach((c, i) => { c.id = i; });
  segs.forEach((s, i) => { s.id = circles.length + i; });
  const out = { circles, segs, edges, slots: cfg.slots.slice() };
  tableCache.set(cfg, out);
  return out;
}

// Which slot a table x is over.
export function slotAt(table, x) {
  for (let i = 0; i < table.slots.length; i++) if (x < table.edges[i + 1]) return i;
  return table.slots.length - 1;
}

// The launcher snaps to whole units, so a drop is just a whole number.
export function dropX(x) {
  return Math.round(Math.max(TABLE.dropMin, Math.min(TABLE.dropMax, x)));
}

// A new ball dropped at x. `ball` is its number: it gives the ball a small
// sideways nudge of its own, so the same spot does not give the same
// result every time, but the same ball from the same spot always does.
export function newBall(x, ball, seed = 0) {
  const r = rng(hash(seed, 'ball', ball));
  return {
    x: dropX(x),
    y: TABLE.dropY,
    vx: (r() - 0.5) * 2 * TABLE.jitter,
    vy: 0,
    age: 0,
    points: 0,
    hits: {}, // obstacle id -> age of last hit (so one touch scores once)
    done: false,
    slot: -1,
  };
}

// Move a ball one physics step. Returns a list of what it hit this step:
//   [{ kind, id, x, y, points }]   (kind 'peg' | 'bumper' | 'kicker')
// When it lands, b.done = true and b.slot is set.
export function stepBall(b, table) {
  const T = TABLE;
  const dt = T.step;
  const out = [];
  if (b.done) return out;
  b.age += dt;
  b.vy += T.gravity * dt;
  b.vx *= 1 - T.drag * dt;
  b.vy *= 1 - T.drag * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > T.maxSpeed) {
    b.vx *= T.maxSpeed / sp;
    b.vy *= T.maxSpeed / sp;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const R = T.ball;
  const hit = (o, nx, ny) => {
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + o.e) * vn * nx;
      b.vy -= (1 + o.e) * vn * ny;
      if (o.kick) {
        // The kick fades as the ball ages, so a long rally always ends.
        const fade = Math.max(0.1, 1 - b.age / TABLE.kickFade);
        b.vx += nx * o.kick * fade;
        b.vy += ny * o.kick * fade;
      }
      const last = b.hits[o.id];
      if (o.points && (last === undefined || b.age - last > 0.12)) {
        b.points += o.points;
        out.push({ kind: o.kind, id: o.id, x: b.x, y: b.y, points: o.points });
      }
      b.hits[o.id] = b.age;
    }
  };
  for (const c of table.circles) {
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const rr = R + c.r;
    if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    let d = Math.sqrt(d2);
    let nx;
    let ny;
    if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
    b.x = c.x + nx * rr;
    b.y = c.y + ny * rr;
    hit(c, nx, ny);
  }
  for (const s of table.segs) {
    const ex = s.bx - s.ax;
    const ey = s.by - s.ay;
    const len2 = ex * ex + ey * ey;
    let k = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / len2;
    k = Math.max(0, Math.min(1, k));
    const px = s.ax + ex * k;
    const py = s.ay + ey * k;
    const dx = b.x - px;
    const dy = b.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    let d = Math.sqrt(d2);
    let nx;
    let ny;
    if (d < 1e-6) {
      // exactly on the line: push toward the middle of the table
      nx = b.x < T.w / 2 ? 1 : -1; ny = 0; d = 0;
    } else { nx = dx / d; ny = dy / d; }
    b.x = px + nx * R;
    b.y = py + ny * R;
    hit(s, nx, ny);
  }
  // Never leave the table sideways.
  b.x = Math.max(R, Math.min(T.w - R, b.x));
  if (b.y >= T.landY || b.age >= T.maxSeconds) {
    b.done = true;
    b.slot = slotAt(table, b.x);
  }
  return out;
}

// Run a whole drop at once: { slot, mult, points, tokens, seconds }.
// (Used by the tests and by the screen to settle balls left falling.)
export function simulate(cfg, x, ball, seed = 0) {
  const table = tableOf(cfg);
  const b = newBall(x, ball, seed);
  while (!b.done) stepBall(b, table);
  const points = Math.max(cfg.minPoints || 0, b.points);
  const mult = table.slots[b.slot];
  return { slot: b.slot, mult, points, tokens: tokensFor(cfg, points, mult), seconds: b.age };
}

// Points x multiplier, capped. The cap is the most one ball can bank.
export function tokensFor(cfg, points, mult) {
  const p = Math.max(0, Math.min(cfg.maxPoints, Math.floor(Number(points) || 0)));
  const m = cfg.slots.includes(mult) ? mult : 1;
  return Math.min(cfg.maxPoints * Math.max(...cfg.slots), p * m);
}

// ---------------------------------------------------------------------------
// THE TEAM AND THE STAGES

// Every stage in order: [{ dragon, stage, need, at, reward }] where `at` is
// the team total at which it is finished. A replacement event (less time)
// asks for less, in the same share as its prizes.
function stagesOf(inst, cfg) {
  const out = [];
  let at = 0;
  cfg.dragons.forEach((dr, di) => {
    dr.stages.forEach((st, si) => {
      const need = Math.max(1, Math.round(st.need * (inst.scale ?? 1)));
      at += need;
      out.push({ dragon: di, stage: si, need, at, reward: st.reward });
    });
  });
  return out;
}

function mates(inst, cfg) {
  return dailyRivals({
    seed: inst.seed,
    count: cfg.teammates,
    pace: inst.pace,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    perLevel: cfg.mateTokensPerLevel,
  });
}

// The team at time t: teammates' gifts, what of them counts toward the
// current stage, and the team total that counts.
function teamAt(inst, cfg, t) {
  const d = inst.data;
  const list = mates(inst, cfg).map((m) => ({ name: m.name, gave: m.scoreAt(t) }));
  const theirs = list.reduce((a, m) => a + m.gave, 0);
  const stages = stagesOf(inst, cfg);
  const cur = stages[Math.min(d.stage, stages.length - 1)];
  // Teammates can carry at most (1 - youShare) of everything up to the end
  // of the current stage; the rest must be yours.
  const room = Math.floor(cur.at * (1 - cfg.youShare));
  const counted = Math.min(theirs, room);
  return { list, theirs, counted, total: d.mine + counted, stages, cur, waiting: theirs > room };
}

// Finish every stage the team total has reached; pay each one.
// Returns the stages just finished: [{ dragon, stage, reward }].
function settle(inst, cfg, ctx, t) {
  const done = [];
  if (inst.done) return done;
  const d = inst.data;
  for (;;) {
    const team = teamAt(inst, cfg, t);
    if (d.stage >= team.stages.length || team.total < team.cur.at) break;
    const st = team.cur;
    const dr = cfg.dragons[st.dragon];
    ctx.pay(st.reward, `${dr.name}: stage ${st.stage + 1}`);
    done.push({ dragon: st.dragon, stage: st.stage, reward: scaleReward(st.reward, inst.scale) });
    d.stage++;
    if (d.stage >= team.stages.length) {
      ctx.pay(cfg.grand, 'Grand prize');
      inst.state = 'won';
      inst.done = true;
      break;
    }
  }
  return done;
}

export default {
  begin(inst, cfg) {
    inst.data = { balls: cfg.startBalls || 0, mine: 0, stage: 0, next: 1, pending: {}, best: 0, tens: 0 };
  },

  // Teammates keep giving while the app is closed, so a stage can finish
  // then (if your share of it is already in).
  tick(inst, cfg, ctx) {
    settle(inst, cfg, ctx, ctx.now);
  },

  onLevel(inst, cfg, res) {
    if (!res.won || inst.done) return null;
    const n = cfg.ballsPerWin[res.tier] ?? cfg.ballsPerWin[0];
    inst.data.balls += n;
    return `+${n} ${n === 1 ? 'ball' : 'balls'}`;
  },

  // Balls left over are simply lost; nothing else to settle (tick has
  // already run at the end time).
  end() {},

  // The play screen's moves:
  //   { drop: x }  spend a ball at launcher position x (table units).
  //       -> { ok, ball, x, seed, balls }   or { ok: false, reason: 'balls' | 'done' }
  //   { land: { ball, points, mult } }  bank a ball that has landed.
  //       -> { ok, ball, tokens, mult, points, capped, finished: [{dragon, stage, reward}],
  //            allDone, mine, total, stage, balls }
  //   A ball can land once; points over cfg.maxPoints are cut to it, and
  //   a multiplier not on the table counts as 1x.
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (!action || typeof action !== 'object') return { ok: false, balls: d.balls };
    if (action.drop !== undefined) {
      if (inst.done) return { ok: false, reason: 'done', balls: d.balls };
      if (d.balls < 1) return { ok: false, reason: 'balls', balls: 0 };
      const x = dropX(Number(action.drop) || 0);
      d.balls--;
      const ball = d.next++;
      d.pending[ball] = x;
      return { ok: true, ball, x, seed: inst.seed, balls: d.balls };
    }
    if (action.land && typeof action.land === 'object') {
      const { ball, points, mult } = action.land;
      if (!(ball in d.pending)) return { ok: false, reason: 'ball', balls: d.balls };
      delete d.pending[ball];
      if (inst.done) return { ok: false, reason: 'done', balls: d.balls };
      const raw = Math.max(cfg.minPoints || 0, Math.floor(Number(points) || 0));
      const m = cfg.slots.includes(mult) ? mult : 1;
      const tokens = tokensFor(cfg, raw, m);
      d.mine += tokens;
      if (tokens > d.best) d.best = tokens;
      if (m === Math.max(...cfg.slots)) d.tens++;
      const finished = settle(inst, cfg, ctx, ctx.now);
      const team = teamAt(inst, cfg, ctx.now);
      return {
        ok: true, ball, tokens, mult: m, points: Math.min(raw, cfg.maxPoints), capped: raw > cfg.maxPoints,
        finished, allDone: inst.done, mine: d.mine, total: team.total, stage: d.stage, balls: d.balls,
      };
    }
    return { ok: false, balls: d.balls };
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const team = teamAt(inst, cfg, ctx.now);
    const stages = team.stages;
    const over = d.stage >= stages.length;
    const cur = stages[Math.min(d.stage, stages.length - 1)];
    const from = cur.at - cur.need;
    const have = over ? cur.need : Math.max(0, Math.min(cur.need, team.total - from));
    const dr = cfg.dragons[cur.dragon];
    const rows = team.list.map((m) => ({ name: m.name, score: m.gave, you: false }));
    rows.push({ name: YOU, score: d.mine, you: true });
    rank(rows);
    for (const r of rows) r.prize = null;
    // What you alone still have to give for this stage, if the teammates
    // have already put in all they may.
    const yourPart = over ? 0 : Math.max(0, cur.at - team.total);
    return {
      summary: over ? 'Parade complete' : `${dr.name} ${cur.stage + 1}/3 · ${d.balls} balls`,
      progress: over ? null : { have, need: cur.need },
      steps: stages.map((s, i) => ({ need: s.need, reward: scaleReward(s.reward, inst.scale), done: i < d.stage, current: i === d.stage })),
      rows,
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
      game: {
        kind: 'plinko',
        button: 'Play',
        balls: d.balls,
        ballsPerWin: cfg.ballsPerWin,
        seed: inst.seed,
        pending: Object.entries(d.pending).map(([ball, x]) => ({ ball: Number(ball), x })),
        slots: cfg.slots,
        slotWidths: cfg.slotWidths,
        points: cfg.points,
        minPoints: cfg.minPoints || 0,
        maxPoints: cfg.maxPoints,
        // the dragon being built
        dragon: cur.dragon,
        dragons: cfg.dragons.map((x) => ({ name: x.name, colors: x.colors })),
        stage: over ? 3 : cur.stage, // 0..2 (3 = all done)
        stageNo: d.stage, // 0..12 stages finished
        stageCount: stages.length,
        have, // tokens in the current stage
        need: cur.need,
        reward: over ? null : scaleReward(cur.reward, inst.scale),
        grand: scaleReward(cfg.grand, inst.scale),
        over,
        mine: d.mine,
        teammates: team.list, // [{ name, gave }]
        waiting: !over && team.waiting, // teammates have given all they may: the rest is yours
        yourPart,
        best: d.best,
        tens: d.tens,
      },
    };
  },
};
