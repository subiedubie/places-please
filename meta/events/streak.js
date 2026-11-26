// STREAK. Three forms, chosen by the config entry:
//   plain   (cfg.need)    win that many levels in a row; a loss resets to 0
//   staged  (cfg.stages + cfg.lanes)  three stages (3, 5, 7 wins in a row),
//           each a race up the lanes against rivals. If a rival finishes a
//           stage first, the stage starts again with new rivals.
//   tour    (cfg.stages + cfg.grids, no lanes)  THE LONG TOUR. Stages of
//           wins in a row with no rivals. `restartOnLoss: true` sends a loss
//           back to the start of stage 1 ('stage' = only back to the start
//           of the stage you are on). The first time each stage is cleared
//           it opens a REVEAL GRID: face-down tiles (laid out by the seed);
//           turn them one at a time (act({ flip: i })) until three of one
//           prize tier show; that tier's prize is paid. The event is done
//           when the last stage is cleared and every grid is turned.
// Saved: inst.data = { have }                              (plain)
//        inst.data = { stage, have, stageStart, tries }    (staged)
//        inst.data = { stage, have, cleared, grids: [{ stage, turned: [i] }],
//                      results: [{ stage, tier }], falls, seen }   (tour)
//          cleared = stages cleared at least once; grids = grids waiting
import { YOU } from '../../config/rivals.js';
import { burstRivals } from './rivals.js';
import { hash, rng, scaleReward } from './util.js';
import { okSeen } from './ladder.js';

// The rivals of the current stage (fixed by the seed, stage and try number).
function lanesOf(inst, cfg) {
  const d = inst.data;
  return burstRivals({
    seed: hash(inst.seed, 'stage', d.stage, d.tries),
    count: cfg.lanes[d.stage] - 1,
    pace: inst.pace,
    startsAt: d.stageStart,
    total: cfg.stages[d.stage],
    minutes: cfg.rivalMinutes[d.stage],
  });
}

const isTour = (cfg) => !!(cfg.stages && cfg.grids);

// The tiles of stage `stage`'s grid, face up: a tier number per tile.
// The same seed always gives the same layout, so only the turned tiles are saved.
export function gridOf(inst, cfg, stage) {
  const spec = cfg.grids[Math.min(stage, cfg.grids.length - 1)];
  const tiles = [];
  spec.tiles.forEach((n, tier) => { for (let k = 0; k < n; k++) tiles.push(tier); });
  const r = rng(hash(inst.seed, 'grid', stage));
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function tourDone(inst, cfg) {
  const d = inst.data;
  if (d.cleared >= cfg.stages.length) {
    inst.state = 'won';
    if (d.grids.length === 0) inst.done = true;
  }
}

export default {
  begin(inst, cfg, ctx) {
    if (isTour(cfg)) inst.data = { stage: 0, have: 0, cleared: 0, grids: [], results: [], falls: 0 };
    else inst.data = cfg.stages ? { stage: 0, have: 0, stageStart: ctx.now, tries: 0 } : { have: 0 };
  },

  tick(inst, cfg, ctx) {
    if (!cfg.stages || !cfg.lanes || inst.done) return;
    const d = inst.data;
    // A rival got there first: the stage starts over now, with new rivals.
    if (lanesOf(inst, cfg).some((r) => r.finishAt <= ctx.now)) {
      d.tries++;
      d.have = 0;
      d.stageStart = ctx.now;
    }
  },

  onLevel(inst, cfg, res, ctx) {
    if (inst.done) return null;
    const d = inst.data;
    if (isTour(cfg)) {
      if (d.cleared >= cfg.stages.length) return null; // finished; grids may still wait
      if (!res.won) {
        const had = d.have + d.stage;
        d.have = 0;
        if (cfg.restartOnLoss === true) d.stage = 0;
        if (had > 0) d.falls++;
        return had > 0 ? (cfg.restartOnLoss === true ? 'Streak lost: back to stage 1' : 'Streak lost: this town starts again') : null;
      }
      d.have++;
      const need = cfg.stages[d.stage];
      const line = `${d.have}/${need} in a row`;
      if (d.have >= need) {
        const done = d.stage;
        if (d.stage >= d.cleared) {
          // First time through this stage: a grid to turn, and its prize.
          d.cleared = d.stage + 1;
          d.grids.push({ stage: d.stage, turned: [] });
          if (cfg.rewards && cfg.rewards[d.stage]) ctx.pay(cfg.rewards[d.stage], `Stage ${d.stage + 1}`);
        }
        d.have = 0;
        if (d.stage < cfg.stages.length - 1) d.stage++;
        tourDone(inst, cfg);
        return `Stage ${done + 1} cleared!`;
      }
      return line;
    }
    if (!res.won) {
      const had = d.have;
      d.have = 0; // one slip and the run is over
      return had > 0 ? 'Streak lost' : null;
    }
    d.have++;
    if (!cfg.stages) {
      if (d.have >= cfg.need) {
        ctx.pay(cfg.reward, `${cfg.need} in a row`);
        inst.state = 'won';
        inst.done = true;
      }
      return `${d.have}/${cfg.need} in a row`;
    }
    const need = cfg.stages[d.stage];
    const line = `${d.have}/${need} in a row`;
    if (d.have >= need) {
      ctx.pay(cfg.rewards[d.stage], `Stage ${d.stage + 1}`);
      d.stage++;
      d.have = 0;
      d.tries = 0;
      d.stageStart = ctx.now;
      if (d.stage >= cfg.stages.length) {
        d.stage = cfg.stages.length - 1;
        inst.state = 'won';
        inst.done = true;
      }
    }
    return line;
  },

  // action = { flip: tile }  turn one tile of the oldest waiting grid. Returns
  //            { ok, tile, tier, count (of that tier showing), won: tier|null,
  //              reward, tiles (the whole layout, once won), allDone }
  //          { seen: {...} }  remember what the play screen last showed
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (action && action.seen !== undefined) {
      if (!okSeen(action.seen)) return { ok: false };
      d.seen = action.seen;
      return { ok: true };
    }
    if (!isTour(cfg) || !action || !Number.isInteger(action.flip)) return { ok: false };
    const grid = d.grids[0];
    if (!grid) return { ok: false, reason: 'none' };
    const tiles = gridOf(inst, cfg, grid.stage);
    const i = action.flip;
    if (i < 0 || i >= tiles.length || grid.turned.includes(i)) return { ok: false };
    grid.turned.push(i);
    const tier = tiles[i];
    const count = grid.turned.filter((k) => tiles[k] === tier).length;
    const out = { ok: true, tile: i, tier, count, won: null, reward: null, tiles: null, stage: grid.stage, allDone: false };
    if (count >= 3) {
      const spec = cfg.grids[Math.min(grid.stage, cfg.grids.length - 1)];
      out.won = tier;
      out.reward = scaleReward(spec.prizes[tier], inst.scale);
      out.tiles = tiles;
      ctx.pay(spec.prizes[tier], `${cfg.tiers[tier]} prize`);
      d.results.push({ stage: grid.stage, tier });
      d.grids.shift();
      tourDone(inst, cfg);
      out.allDone = !!inst.done;
    }
    return out;
  },

  view(inst, cfg, ctx) {
    const d = inst.data;
    const avatar = ctx && typeof ctx.team === 'function' ? ctx.team()?.avatar || null : null;
    if (isTour(cfg)) {
      const finished = d.cleared >= cfg.stages.length;
      const need = cfg.stages[d.stage];
      const grid = d.grids[0];
      let gridView = null;
      if (grid) {
        const tiles = gridOf(inst, cfg, grid.stage);
        const spec = cfg.grids[Math.min(grid.stage, cfg.grids.length - 1)];
        gridView = {
          stage: grid.stage,
          cols: cfg.gridCols || 3,
          rows: cfg.gridRows || 4,
          // Only turned tiles show their tier.
          tiles: tiles.map((t, i) => (grid.turned.includes(i) ? t : -1)),
          prizes: spec.prizes.map((p) => scaleReward(p, inst.scale)),
          left: spec.tiles.slice(),
        };
      }
      return {
        summary: finished ? (grid ? 'Prize to reveal!' : 'Complete') : `stage ${d.stage + 1}: ${d.have}/${need}`,
        progress: finished ? null : { have: d.have, need },
        steps: cfg.stages.map((n, i) => ({
          need: n,
          reward: scaleReward(cfg.grids[Math.min(i, cfg.grids.length - 1)].prizes.at(-1), inst.scale),
          done: i < d.cleared,
          current: !finished && i === d.stage,
        })),
        game: {
          kind: 'tour',
          button: grid ? 'Reveal!' : 'Play',
          mode: 'tour',
          stage: d.stage,
          stages: cfg.stages.slice(),
          have: finished ? 0 : d.have,
          cleared: d.cleared,
          restart: cfg.restartOnLoss === true ? 'start' : 'stage',
          tiers: cfg.tiers.slice(),
          grid: gridView,
          waiting: d.grids.length,
          results: d.results.slice(),
          falls: d.falls,
          avatar,
          seen: d.seen ?? null,
        },
      };
    }
    if (!cfg.stages) {
      return {
        summary: `${d.have}/${cfg.need}`,
        progress: { have: d.have, need: cfg.need },
        prizes: [{ place: 1, reward: scaleReward(cfg.reward, inst.scale) }],
        game: {
          kind: 'tour',
          button: 'Play',
          mode: 'plain',
          stage: 0,
          stages: [cfg.need],
          have: d.have,
          cleared: inst.done ? 1 : 0,
          restart: 'start',
          reward: scaleReward(cfg.reward, inst.scale),
          grid: null,
          waiting: 0,
          avatar,
          seen: d.seen ?? null,
        },
      };
    }
    const need = cfg.stages[d.stage];
    const lanes = inst.done ? [] : lanesOf(inst, cfg).map((r) => ({ name: r.name, have: r.scoreAt(ctx.now), need, you: false }));
    lanes.push({ name: YOU, have: inst.done ? need : d.have, need, you: true });
    return {
      summary: inst.done ? 'Complete' : `stage ${d.stage + 1}: ${d.have}/${need}`,
      progress: { have: inst.done ? need : d.have, need },
      lanes,
      steps: cfg.stages.map((n, i) => ({
        need: n,
        reward: scaleReward(cfg.rewards[i], inst.scale),
        done: inst.done || i < d.stage,
        current: !inst.done && i === d.stage,
      })),
      game: {
        kind: 'lanes',
        button: 'Play',
        mode: 'streak',
        stage: d.stage,
        stages: cfg.stages.slice(),
        tries: d.tries,
        avatar,
        seen: d.seen ?? null,
      },
    };
  },
};
