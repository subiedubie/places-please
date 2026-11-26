// THE PIRATE MATINEE (type 'voyage'). A pirate show on a painted stage sea.
// Twelve rounds; each round is a wave of cardboard sea creatures (octopus,
// crab, sea-serpent coils, jellyfish, and a whale in rounds 6 and 12), each
// with a number of hit points. Every level won pays shots (more for harder
// levels). One shot fires three cannonballs from the ship's bow along the
// aimed line; they ricochet off the walls, the top and the creatures, and
// every bounce off a creature takes one point. At 0 it pops. Clear every
// creature to finish the round. Chests after rounds 3, 6 and 9, and the
// grand prize after round 12.
//
// The play screen does the flying (the physics below is shared with it, so
// the tests can fire real volleys). The rules only keep score:
//   act({ fire: true })              spend a shot -> { ok, volley, shots }
//   act({ volley, hits: [i, ...] })  when that volley's balls have all
//                                    fallen: the creatures it struck, one
//                                    entry per hit, in order.
// A creature's points never go below 0, a volley is counted once, and a
// round's prize is paid once (the round moves on in the same step).
//
// Saved: inst.data = { shots, round, hp: [points left, per creature],
//                      flying: [{ id, round }], next, fired, done }
import { hash, rng, scaleReward } from './util.js';

// ---- The round's layout (same seed, same layout) --------------------------
// Returns [{ kind, x, y, r, hp }] in field units (see cfg.field).
export function layoutOf(inst, cfg, round) {
  const R = cfg.rounds[round];
  const F = cfg.field;
  const r = rng(hash(inst.seed, 'voyage', round));
  const out = [];
  const gap = cfg.physics.radius * 2 + F.gap; // room for a ball between props
  const fits = (x, y, rad) => out.every((c) => Math.hypot(c.x - x, c.y - y) >= c.r + rad + gap);
  if (R.boss) {
    // The whale sits high in the middle, so the small fry swim round it.
    const w = cfg.creatures.whale;
    out.push({ kind: 'whale', x: F.w / 2, y: F.top + w.r, r: w.r, hp: R.boss });
  }
  const kinds = R.kinds || cfg.kinds;
  for (let k = 0; k < R.count; k++) {
    const kind = kinds[Math.floor(r() * kinds.length)];
    const rad = cfg.creatures[kind].r;
    const hp = R.hp[0] + Math.floor(r() * (R.hp[1] - R.hp[0] + 1));
    for (let tries = 0; tries < 400; tries++) {
      const x = F.side + rad + r() * (F.w - 2 * (F.side + rad));
      const y = F.top + rad + r() * (F.bottom - F.top - 2 * rad);
      if (!fits(x, y, rad)) continue;
      out.push({ kind, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: rad, hp });
      break;
    }
  }
  return out;
}

// ---- The physics (pure; the screen and the tests both use it) -------------
// A ball: { x, y, vx, vy, age, hits }. Field units; time in seconds.
// Creatures: [{ x, y, r, hp }]; only those with hp > 0 are solid, and a hit
// takes 1 from the creature's hp in the list passed in (the screen's copy).

// A new ball leaving the muzzle at `angle` (radians from straight up,
// negative = left).
export function launch(cfg, angle) {
  const F = cfg.field;
  const P = cfg.physics;
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return { x: F.w / 2 + sx * F.muzzle, y: F.cannonY + sy * F.muzzle, vx: sx * P.speed, vy: sy * P.speed, age: 0, hits: 0 };
}

// Keep the aim upward: at most cfg.physics.maxAim radians from straight up.
export function clampAim(cfg, angle) {
  const m = cfg.physics.maxAim;
  return Math.max(-m, Math.min(m, angle));
}

// The aim from the cannon toward a point (field units).
export function aimAt(cfg, x, y) {
  const F = cfg.field;
  return clampAim(cfg, Math.atan2(x - F.w / 2, Math.max(1, F.cannonY - y)));
}

// One fixed time step for one ball. Returns:
//   >= 0  the index of the creature it struck (that creature's hp went down 1)
//   -1    nothing happened
//   -2    it bounced off a wall or the top
//   -3    it touched a creature too gently to hurt it (or its hits ran out)
//   -4    it has fallen off the bottom: remove it
export function stepBall(b, creatures, cfg, dt) {
  const F = cfg.field;
  const P = cfg.physics;
  const rad = P.radius;
  b.vy += P.gravity * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.age += dt;
  if (b.y > F.h + rad * 2) return -4;
  let out = -1;
  if (b.x < rad) { b.x = rad; b.vx = Math.abs(b.vx) * P.wallBounce; out = -2; }
  else if (b.x > F.w - rad) { b.x = F.w - rad; b.vx = -Math.abs(b.vx) * P.wallBounce; out = -2; }
  if (b.y < rad) { b.y = rad; b.vy = Math.abs(b.vy) * P.wallBounce; out = -2; }
  // After its time is up, a ball no longer bounces off creatures and drops.
  if (b.age > P.maxSeconds) return out;
  for (let i = 0; i < creatures.length; i++) {
    const c = creatures[i];
    if (c.hp <= 0) continue;
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const R = c.r + rad;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    const dot = b.vx * nx + b.vy * ny;
    b.x = c.x + nx * R;
    b.y = c.y + ny * R;
    if (dot >= 0) continue; // already moving away
    b.vx -= (1 + P.bounce) * dot * nx;
    b.vy -= (1 + P.bounce) * dot * ny;
    // Keep a little speed so balls do not settle on top of a prop.
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < P.minSpeed) { b.vx = (b.vx / (sp || 1)) * P.minSpeed; b.vy = (b.vy / (sp || 1)) * P.minSpeed; }
    if (-dot >= P.hurtSpeed && b.hits < P.maxHitsPerBall) {
      b.hits++;
      c.hp--;
      return i;
    }
    return -3;
  }
  return out;
}

// The dashed aim line: the path from the muzzle up to and including the
// first bounce, then a short stretch after it. Nobody is hurt (it works on
// a copy). Returns { points: [[x, y], ...], bounce: [x, y] | null, after }
// where points[after...] is the part after the bounce.
export function aimPath(cfg, creatures, angle) {
  const P = cfg.physics;
  const ghost = creatures.map((c) => ({ x: c.x, y: c.y, r: c.r, hp: c.hp }));
  const b = launch(cfg, angle);
  b.hits = P.maxHitsPerBall; // touches, does not hurt
  const dt = P.step;
  const points = [[b.x, b.y]];
  let bounce = null;
  let after = 0;
  let travelled = 0;
  for (let n = 0; n < 4000; n++) {
    const px = b.x;
    const py = b.y;
    const hit = stepBall(b, ghost, cfg, dt);
    if (hit === -4) break;
    travelled += Math.hypot(b.x - px, b.y - py);
    if (n % 3 === 0 || hit !== -1) points.push([b.x, b.y]);
    if (!bounce && hit !== -1) { bounce = [b.x, b.y]; after = points.length - 1; travelled = 0; }
    if (bounce && travelled > P.aimTail) break;
  }
  return { points, bounce, after };
}

// Fire one whole shot (all its balls, the gap between them) at `creatures`
// and run it until every ball has fallen. Returns the list of creature
// indexes hit, in order. Used by the tests and the sizing simulation.
export function simulateShot(cfg, creatures, angle) {
  const P = cfg.physics;
  const hits = [];
  const balls = [];
  let t = 0;
  let launched = 0;
  for (let n = 0; n < 200000; n++) {
    while (launched < P.ballsPerShot && t >= launched * P.gap) { balls.push(launch(cfg, angle)); launched++; }
    for (let i = balls.length - 1; i >= 0; i--) {
      const h = stepBall(balls[i], creatures, cfg, P.step);
      if (h >= 0) hits.push(h);
      else if (h === -4) balls.splice(i, 1);
    }
    t += P.step;
    if (launched >= P.ballsPerShot && balls.length === 0) break;
  }
  return hits;
}

// ---- The rules ------------------------------------------------------------
function startRound(inst, cfg, round) {
  const d = inst.data;
  d.round = round;
  d.hp = round < cfg.rounds.length ? layoutOf(inst, cfg, round).map((c) => c.hp) : [];
  d.flying = d.flying.filter((f) => f.round === round);
}

// The next prize from round `round` on: { at (round number, 1-based), reward, grand }
function nextPrize(cfg, round, scale) {
  for (let i = round; i < cfg.rounds.length; i++) {
    if (i === cfg.rounds.length - 1) return { at: i + 1, reward: scaleReward(cfg.grand, scale), grand: true };
    if (cfg.rounds[i].chest) return { at: i + 1, reward: scaleReward(cfg.rounds[i].chest, scale), grand: false };
  }
  return null;
}

export default {
  begin(inst, cfg) {
    inst.data = { shots: cfg.startShots || 0, round: 0, hp: [], flying: [], next: 1, fired: 0, done: false };
    startRound(inst, cfg, 0);
  },

  onLevel(inst, cfg, res) {
    if (!res.won || inst.done) return null;
    const n = cfg.shotsPerWin[res.tier] ?? cfg.shotsPerWin[0];
    inst.data.shots += n;
    return `+${n} ${n === 1 ? 'shot' : 'shots'}`;
  },

  act(inst, cfg, action, ctx) {
    const d = inst.data;
    const P = cfg.physics;
    if (!action || inst.done || d.done) return { ok: false, reason: 'over', shots: d.shots };

    // ---- spend a shot ----
    if (action.fire) {
      if (d.shots < 1) return { ok: false, reason: 'shots', shots: 0 };
      d.shots--;
      d.fired++;
      const id = d.next++;
      d.flying.push({ id, round: d.round });
      // An app closed mid-flight never reports; keep the list short.
      while (d.flying.length > cfg.maxFlying) d.flying.shift();
      return { ok: true, volley: id, round: d.round, shots: d.shots };
    }

    // ---- a volley has landed: its hits ----
    if (Array.isArray(action.hits)) {
      const k = d.flying.findIndex((f) => f.id === action.volley);
      if (k < 0) return { ok: false, reason: 'volley', shots: d.shots };
      const fl = d.flying[k];
      d.flying.splice(k, 1);
      if (fl.round !== d.round) return { ok: false, reason: 'volley', shots: d.shots };
      const most = P.ballsPerShot * P.maxHitsPerBall;
      const popped = [];
      let applied = 0;
      for (const i of action.hits.slice(0, most)) {
        if (!Number.isInteger(i) || i < 0 || i >= d.hp.length || d.hp[i] <= 0) continue;
        d.hp[i]--;
        applied++;
        if (d.hp[i] === 0) popped.push(i);
      }
      const out = { ok: true, applied, popped, hp: d.hp.slice(), round: d.round, roundDone: false, chest: false, reward: null, allDone: false, shots: d.shots };
      if (applied > 0 && d.hp.every((h) => h === 0)) {
        const r = d.round;
        out.roundDone = true;
        const last = r === cfg.rounds.length - 1;
        if (cfg.rounds[r].chest && !last) {
          out.chest = true;
          out.reward = scaleReward(cfg.rounds[r].chest, inst.scale);
          ctx.pay(cfg.rounds[r].chest, `Round ${r + 1} chest`);
        }
        if (last) {
          out.allDone = true;
          out.reward = scaleReward(cfg.grand, inst.scale);
          ctx.pay(cfg.grand, 'Grand prize');
          d.done = true;
          inst.state = 'won';
          inst.done = true;
          d.round = cfg.rounds.length;
          d.hp = [];
          d.flying = [];
        } else {
          startRound(inst, cfg, r + 1);
        }
        out.next = d.round;
      }
      return out;
    }
    return { ok: false, reason: 'action', shots: d.shots };
  },

  view(inst, cfg) {
    const d = inst.data;
    const over = d.done || d.round >= cfg.rounds.length;
    const r = Math.min(d.round, cfg.rounds.length - 1);
    const lay = over ? [] : layoutOf(inst, cfg, r);
    const prize = over ? null : nextPrize(cfg, r, inst.scale);
    const left = d.hp.reduce((a, b) => a + b, 0);
    const total = lay.reduce((a, c) => a + c.hp, 0);
    // The prize points along the voyage (rounds 3, 6, 9 and 12).
    const marks = cfg.rounds
      .map((R, i) => (i === cfg.rounds.length - 1 ? { i, reward: cfg.grand } : R.chest ? { i, reward: R.chest } : null))
      .filter(Boolean);
    return {
      summary: over ? 'Complete' : `round ${d.round + 1}/${cfg.rounds.length} · ${d.shots} shots`,
      progress: over ? null : { have: d.round, need: cfg.rounds.length },
      steps: marks.map((m) => ({ need: m.i + 1, reward: scaleReward(m.reward, inst.scale), done: d.round > m.i || over, current: !over && prize && prize.at === m.i + 1 })),
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
      game: {
        kind: 'cannon',
        button: 'Play',
        shots: d.shots,
        round: d.round,
        rounds: cfg.rounds.length,
        over,
        // Each creature with its points left (popped ones have hp 0).
        creatures: lay.map((c, i) => ({ kind: c.kind, x: c.x, y: c.y, r: c.r, max: c.hp, hp: d.hp[i] ?? 0 })),
        left,
        total,
        prize, // { at, reward, grand } the next chest or the grand prize
        chestRounds: marks.map((m) => m.i + 1),
        shotsPerWin: cfg.shotsPerWin,
        field: cfg.field,
        physics: cfg.physics,
      },
    };
  },
};
