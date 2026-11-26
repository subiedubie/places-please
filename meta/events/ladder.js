// COLLECTION LADDER. Collect one piece color, or one made power-up, across
// levels WON. Each step pays as it is filled, in order; the grand prize
// comes after the last step. Lost levels add nothing.
//
// Variants, chosen by the config entry:
//   collect  (omitted)  every level WON counts instead, `perTier[tier]` each
//                       (1 each when there is no perTier list)
//   balloons: 3         BALLOON RISE. The climber starts every step holding
//                       that many balloons. Each LOST level pops one; when
//                       the last one pops, the climber drops back to the
//                       start of the current step (its progress is lost)
//                       and holds a fresh bunch again.
//   pinata: true        PINATA PARTY. Each step is a pinata. Its prize is
//                       paid the moment its goal is reached; the play screen
//                       then lets you smash it open (act({ smash: step })),
//                       which only shows the prize. The event counts as done
//                       once every pinata has been smashed.
//
// Saved: inst.data = { step, have,          (have = collected toward this step)
//                      balloons, pops, falls,   (balloon rise: held now, popped
//                                                in all, drops to the step start)
//                      smashed: [step ...],     (pinatas already smashed)
//                      seen }                   (what the play screen showed last)
import { countKind, scaleReward } from './util.js';

// How much one won level adds.
function gain(cfg, res) {
  if (cfg.collect) {
    return cfg.collect.made !== undefined
      ? countKind(res.tally.made, cfg.collect.made)
      : (res.tally.cleared?.[cfg.collect.color] || 0);
  }
  if (cfg.perTier) return cfg.perTier[res.tier] ?? cfg.perTier[0];
  return 1;
}

// Pinatas whose goal is reached but which have not been smashed yet.
function toSmash(inst, cfg) {
  const d = inst.data;
  const out = [];
  for (let i = 0; i < Math.min(d.step, cfg.steps.length); i++) if (!(d.smashed || []).includes(i)) out.push(i);
  return out;
}

function finishIfAllDone(inst, cfg) {
  const d = inst.data;
  if (d.step < cfg.steps.length) return;
  inst.state = 'won';
  if (!cfg.pinata || toSmash(inst, cfg).length === 0) inst.done = true;
}

// The "last seen" note a play screen keeps: small plain JSON only.
export function okSeen(x) {
  try { return JSON.stringify(x).length <= 400; } catch { return false; }
}

export default {
  begin(inst, cfg) {
    inst.data = { step: 0, have: 0 };
    if (cfg.balloons) Object.assign(inst.data, { balloons: cfg.balloons, pops: 0, falls: 0 });
    if (cfg.pinata) inst.data.smashed = [];
  },

  onLevel(inst, cfg, res, ctx) {
    if (inst.done) return null;
    const d = inst.data;
    if (d.step >= cfg.steps.length) return null; // all filled (pinatas still to smash)
    if (!res.won) {
      if (!cfg.balloons) return null;
      if (!Number.isInteger(d.balloons)) d.balloons = cfg.balloons;
      d.balloons--;
      d.pops = (d.pops || 0) + 1;
      if (d.balloons > 0) return `Balloon popped: ${d.balloons} left`;
      // The last balloon: back to the start of this step, with a new bunch.
      d.have = 0;
      d.balloons = cfg.balloons;
      d.falls = (d.falls || 0) + 1;
      return `Last balloon popped: step ${d.step + 1} starts again`;
    }
    const got = gain(cfg, res);
    if (got === 0) return null;
    d.have += got;
    // What is left over after filling a step carries into the next one.
    while (d.step < cfg.steps.length && d.have >= cfg.steps[d.step].need) {
      d.have -= cfg.steps[d.step].need;
      ctx.pay(cfg.steps[d.step].reward, `Step ${d.step + 1}`);
      d.step++;
      if (cfg.balloons) d.balloons = cfg.balloons; // a fresh bunch for every step
    }
    if (d.step >= cfg.steps.length) {
      ctx.pay(cfg.grand, 'Grand prize');
      finishIfAllDone(inst, cfg);
    }
    const word = cfg.pinata ? (got === 1 ? 'candy' : 'candies') : cfg.collect ? 'collected' : 'up';
    return `+${got} ${word}`;
  },

  // action = { smash: step }  open a filled pinata (its prize was paid already)
  //          { seen: {...} }  remember what the play screen last showed
  act(inst, cfg, action) {
    const d = inst.data;
    if (action && action.seen !== undefined) {
      if (!okSeen(action.seen)) return { ok: false };
      d.seen = action.seen;
      return { ok: true };
    }
    if (cfg.pinata && action && Number.isInteger(action.smash)) {
      const i = action.smash;
      if (!toSmash(inst, cfg).includes(i)) return { ok: false };
      d.smashed = [...(d.smashed || []), i];
      const last = i === cfg.steps.length - 1;
      finishIfAllDone(inst, cfg);
      return {
        ok: true,
        step: i,
        reward: scaleReward(cfg.steps[i].reward, inst.scale),
        grand: last ? scaleReward(cfg.grand, inst.scale) : null,
        allDone: !!inst.done,
      };
    }
    return { ok: false };
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const last = d.step >= cfg.steps.length;
    const smash = cfg.pinata ? toSmash(inst, cfg) : [];
    const avatar = ctx && typeof ctx.team === 'function' ? ctx.team()?.avatar || null : null;
    return {
      summary: last ? (smash.length ? 'Smash it open!' : 'Complete') : `step ${d.step + 1}/${cfg.steps.length}`,
      progress: last ? null : { have: d.have, need: cfg.steps[d.step].need },
      steps: cfg.steps.map((s, i) => ({
        need: s.need,
        reward: scaleReward(s.reward, inst.scale),
        done: i < d.step,
        current: i === d.step,
      })),
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
      game: {
        kind: cfg.balloons ? 'balloon' : cfg.pinata ? 'pinata' : 'climb',
        button: smash.length ? 'Smash!' : 'Play',
        mode: 'ladder',
        step: d.step,
        stepCount: cfg.steps.length,
        have: last ? 0 : d.have,
        need: last ? 0 : cfg.steps[d.step].need,
        collect: cfg.collect || null,
        perTier: cfg.perTier || null,
        grand: scaleReward(cfg.grand, inst.scale),
        avatar,
        seen: d.seen ?? null,
        ...(cfg.balloons ? { balloons: d.balloons ?? cfg.balloons, maxBalloons: cfg.balloons, pops: d.pops || 0, falls: d.falls || 0 } : {}),
        ...(cfg.pinata ? { smashed: (d.smashed || []).slice(), toSmash: smash, hits: cfg.hits || 4 } : {}),
      },
    };
  },
};
