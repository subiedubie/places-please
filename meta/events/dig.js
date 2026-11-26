// UNDER THE STAGE (the dig). Gates of stone blocks with gems buried under
// them in known shapes. Every level won pays hammers (more for harder
// levels); one hammer breaks one block. Find every gem of a gate to open it
// and take its prize; after the last gate comes the grand prize.
// The shapes to find are shown before you dig, so you can work out where
// the rest of a gem must be once you have uncovered a corner of it.
// Some blocks hide a few spare hammers instead.
// Saved: inst.data = { tools, gate, dug: [cell numbers dug in this gate],
//                      found: [gem numbers found in this gate], gems }
import { hash, rng, scaleReward } from './util.js';

// Where the gems of gate `g` lie. The same seed always gives the same
// layout, so only the dug cells need saving.
//   { cols, rows, gems: [{ w, h, x, y, color }], caches: { cell: hammers } }
export function layoutOf(inst, cfg, g) {
  const gate = cfg.gates[g];
  const r = rng(hash(inst.seed, 'gate', g));
  const { cols, rows } = gate;
  const taken = new Array(cols * rows).fill(false);
  const gems = [];
  // Biggest first, so they always fit.
  const shapes = gate.gems.map((s, i) => ({ s, i })).sort((a, b) => b.s[0] * b.s[1] - a.s[0] * a.s[1]);
  for (const { s, i } of shapes) {
    for (let tries = 0; tries < 500; tries++) {
      const turn = s[0] !== s[1] && r() < 0.5;
      const w = turn ? s[1] : s[0];
      const h = turn ? s[0] : s[1];
      if (w > cols || h > rows) continue;
      const x = Math.floor(r() * (cols - w + 1));
      const y = Math.floor(r() * (rows - h + 1));
      let free = true;
      for (let yy = y; yy < y + h && free; yy++) for (let xx = x; xx < x + w; xx++) if (taken[yy * cols + xx]) { free = false; break; }
      if (!free) continue;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) taken[yy * cols + xx] = true;
      gems[i] = { w, h, x, y, color: (g + i) % 5 };
      break;
    }
  }
  const caches = {};
  let left = gate.caches || 0;
  for (let tries = 0; left > 0 && tries < 500; tries++) {
    const c = Math.floor(r() * cols * rows);
    if (taken[c] || caches[c]) continue;
    caches[c] = cfg.cacheHammers || 3;
    left--;
  }
  return { cols, rows, gems, caches };
}

function gemAt(lay, cell) {
  const x = cell % lay.cols;
  const y = Math.floor(cell / lay.cols);
  return lay.gems.findIndex((g) => g && x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h);
}

export default {
  begin(inst, cfg) {
    inst.data = { tools: cfg.startTools || 0, gate: 0, dug: [], found: [], gems: 0 };
  },

  onLevel(inst, cfg, res) {
    if (!res.won || inst.done) return null;
    const n = cfg.toolsPerWin[res.tier] ?? cfg.toolsPerWin[0];
    inst.data.tools += n;
    return `+${n} ${n === 1 ? 'hammer' : 'hammers'}`;
  },

  // action = { dig: cell number }. Returns
  //   { ok, under: 'gem' | 'cache' | 'stone', gem, gemDone, cache,
  //     gateDone, reward, allDone, tools }
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (inst.done || !action || !Number.isInteger(action.dig)) return { ok: false, tools: d.tools };
    const lay = layoutOf(inst, cfg, d.gate);
    const cell = action.dig;
    if (cell < 0 || cell >= lay.cols * lay.rows || d.dug.includes(cell)) return { ok: false, tools: d.tools };
    if (d.tools < 1) return { ok: false, reason: 'tools', tools: 0 };
    d.tools--;
    d.dug.push(cell);
    const out = { ok: true, under: 'stone', gem: -1, gemDone: false, cache: 0, gateDone: false, reward: null, allDone: false };
    const k = gemAt(lay, cell);
    if (k >= 0) {
      out.under = 'gem';
      out.gem = k;
      const g = lay.gems[k];
      let all = true;
      for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) if (!d.dug.includes(y * lay.cols + x)) all = false;
      if (all && !d.found.includes(k)) {
        d.found.push(k);
        d.gems++;
        out.gemDone = true;
        ctx.count('gems', 1);
      }
    } else if (lay.caches[cell]) {
      out.under = 'cache';
      out.cache = lay.caches[cell];
      d.tools += out.cache;
    }
    if (d.found.length >= lay.gems.length) {
      out.gateDone = true;
      out.reward = scaleReward(cfg.gates[d.gate].reward, inst.scale);
      ctx.pay(cfg.gates[d.gate].reward, `Gate ${d.gate + 1}`);
      d.gate++;
      d.dug = [];
      d.found = [];
      if (d.gate >= cfg.gates.length) {
        ctx.pay(cfg.grand, 'Grand prize');
        inst.state = 'won';
        inst.done = true;
        out.allDone = true;
      }
    }
    out.tools = d.tools;
    return out;
  },

  view(inst, cfg) {
    const d = inst.data;
    const over = d.gate >= cfg.gates.length;
    const g = Math.min(d.gate, cfg.gates.length - 1);
    const lay = layoutOf(inst, cfg, g);
    // Only what has been dug is shown; the rest stays hidden.
    const cells = [];
    for (let c = 0; c < lay.cols * lay.rows; c++) {
      const dug = !over && d.dug.includes(c);
      const k = dug ? gemAt(lay, c) : -1;
      cells.push({ dug, gem: k, cache: dug && k < 0 ? lay.caches[c] || 0 : 0 });
    }
    return {
      summary: over ? 'Complete' : `gate ${d.gate + 1}/${cfg.gates.length} · ${d.tools} 🔨`,
      progress: over ? null : { have: d.found.length, need: lay.gems.length },
      steps: cfg.gates.map((gt, i) => ({ need: gt.gems.length, reward: scaleReward(gt.reward, inst.scale), done: i < d.gate, current: i === d.gate })),
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
      game: {
        kind: 'dig',
        tools: d.tools,
        gate: d.gate,
        gates: cfg.gates.length,
        cols: lay.cols,
        rows: lay.rows,
        cells,
        // Every gem to find, with its place only once it is found.
        gems: lay.gems.map((gm, i) => ({ w: gm.w, h: gm.h, color: gm.color, found: !over && d.found.includes(i), ...(d.found.includes(i) ? { x: gm.x, y: gm.y } : {}) })),
        reward: over ? null : scaleReward(cfg.gates[g].reward, inst.scale),
        toolsPerWin: cfg.toolsPerWin,
      },
    };
  },
};
