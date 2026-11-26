// COSTUME PAIRS (the wardrobe memory game). Fifteen boards of face-down
// cards, each picture twice. Levels won pay tickets (more for harder
// levels); turning over two cards costs one ticket. A pair that matches
// stays face up and goes to the costume rail; a miss turns back over, so
// the skill is remembering where you saw each piece.
//   Spotlight: on some boards one pair has a gold spotlight frame. Matching
//              it lights the whole board for a moment (the screen shows
//              every face for `spotlightMs`). A good memory gets the most
//              out of it.
//   Quick change: every `quickEvery` matches in a row refund one ticket.
//   Chalk mark: a card you have turned over before carries a small chalk
//              tick (the picture is NOT shown), so you can tell "seen" from
//              "never seen". Remembering WHAT you saw is still on you.
// The deal of every board comes from the event's seed and the step number,
// so only what you have done needs saving.
// Saved: inst.data = { tickets, step, matched: [cells], seen: [cells],
//                      open: cell or -1 (first card of a paid turn),
//                      streak (matches in a row), turns, pairs }
import { hash, rng, scaleReward } from './util.js';

function shuffle(list, r) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The deal of board `s`: { cols, rows, faces: [face name per cell],
// spot: face name of the spotlight pair or null }.
export function dealOf(inst, cfg, s) {
  const board = cfg.steps[s];
  const { cols, rows } = board;
  const n = (cols * rows) / 2;
  const r = rng(hash(inst.seed, 'pairs', s));
  const chosen = shuffle(cfg.wardrobe.slice(), r).slice(0, n);
  const faces = shuffle(chosen.concat(chosen), r);
  return { cols, rows, faces, spot: board.spot ? chosen[0] : null };
}

export default {
  begin(inst, cfg) {
    inst.data = { tickets: cfg.startTickets || 0, step: 0, matched: [], seen: [], open: -1, streak: 0, turns: 0, pairs: 0 };
  },

  onLevel(inst, cfg, res) {
    if (!res.won || inst.done) return null;
    const n = cfg.ticketsPerWin[res.tier] ?? cfg.ticketsPerWin[0];
    inst.data.tickets += n;
    return `+${n} ${n === 1 ? 'ticket' : 'tickets'}`;
  },

  // action = { flip: cell number }. The first card of a turn costs the
  // ticket; the second is part of the same turn. Returns
  //   first card:  { ok, first: true, cell, face, spot, tickets }
  //   second card: { ok, first: false, cell, face, other, otherFace, match,
  //                  spot, quick (tickets refunded), streak,
  //                  reveal: [{ cell, face }] | null (spotlight: every card
  //                  still face down), stepDone, reward, chest, allDone,
  //                  tickets }
  //   refused:     { ok: false, reason: 'tickets' | 'card' | 'done', tickets }
  act(inst, cfg, action, ctx) {
    const d = inst.data;
    if (inst.done) return { ok: false, reason: 'done', tickets: d.tickets };
    if (!action || !Number.isInteger(action.flip)) return { ok: false, reason: 'card', tickets: d.tickets };
    const deal = dealOf(inst, cfg, d.step);
    const cell = action.flip;
    if (cell < 0 || cell >= deal.faces.length || d.matched.includes(cell) || cell === d.open) {
      return { ok: false, reason: 'card', tickets: d.tickets };
    }
    const face = deal.faces[cell];
    const isSpot = face === deal.spot;
    if (d.open < 0 && d.tickets < 1) return { ok: false, reason: 'tickets', tickets: 0 };
    if (!d.seen.includes(cell)) d.seen.push(cell);

    if (d.open < 0) {
      d.tickets--;
      d.turns++;
      d.open = cell;
      return { ok: true, first: true, cell, face, spot: isSpot, tickets: d.tickets };
    }

    const other = d.open;
    const otherFace = deal.faces[other];
    d.open = -1;
    const out = {
      ok: true, first: false, cell, face, other, otherFace, match: face === otherFace, spot: false,
      quick: 0, streak: 0, reveal: null, stepDone: false, reward: null, chest: false, allDone: false,
    };
    if (out.match) {
      d.matched.push(other, cell);
      d.pairs++;
      d.streak++;
      ctx.count('pairs', 1);
      const every = cfg.quickEvery || 0;
      if (every > 0 && d.streak % every === 0) {
        out.quick = cfg.quickRefund || 1;
        d.tickets += out.quick;
      }
      if (isSpot) {
        out.spot = true;
        out.reveal = [];
        deal.faces.forEach((f, c) => {
          if (d.matched.includes(c)) return;
          out.reveal.push({ cell: c, face: f });
          if (!d.seen.includes(c)) d.seen.push(c);
        });
      }
    } else {
      d.streak = 0;
    }
    out.streak = d.streak;

    if (d.matched.length >= deal.faces.length) {
      const st = cfg.steps[d.step];
      out.stepDone = true;
      out.chest = !!st.chest;
      out.reward = scaleReward(st.reward, inst.scale);
      out.board = d.step;
      ctx.pay(st.reward, st.chest ? `Wardrobe chest ${d.step + 1}` : `Rail ${d.step + 1}`);
      d.step++;
      d.matched = [];
      d.seen = [];
      d.open = -1;
      // The reveal of a finished board means nothing.
      out.reveal = null;
      if (d.step >= cfg.steps.length) {
        ctx.pay(cfg.grand, 'Grand prize');
        out.allDone = true;
        out.grand = scaleReward(cfg.grand, inst.scale);
        inst.state = 'won';
        inst.done = true;
      }
    }
    out.tickets = d.tickets;
    return out;
  },

  view(inst, cfg) {
    const d = inst.data;
    const over = d.step >= cfg.steps.length;
    const s = Math.min(d.step, cfg.steps.length - 1);
    const deal = dealOf(inst, cfg, s);
    const st = cfg.steps[s];
    // Only faces that are up are shown: matched pairs and the open card.
    const cards = deal.faces.map((f, c) => {
      const up = !over && (d.matched.includes(c) || c === d.open);
      return {
        matched: !over && d.matched.includes(c),
        open: !over && c === d.open,
        seen: !over && cfg.chalk !== false && d.seen.includes(c),
        face: up ? f : null,
        spot: up && f === deal.spot,
      };
    });
    const rail = [];
    for (const c of over ? [] : d.matched) if (!rail.includes(deal.faces[c])) rail.push(deal.faces[c]);
    const pairs = deal.faces.length / 2;
    return {
      summary: over ? 'Complete' : `rail ${d.step + 1}/${cfg.steps.length} · ${d.tickets} 🎟`,
      progress: over ? null : { have: rail.length, need: pairs },
      steps: cfg.steps.map((x, i) => ({ need: (x.cols * x.rows) / 2, reward: scaleReward(x.reward, inst.scale), done: i < d.step, current: i === d.step, chest: !!x.chest })),
      prizes: [{ place: 1, reward: scaleReward(cfg.grand, inst.scale) }],
      game: {
        kind: 'pairs',
        button: 'Play',
        tickets: d.tickets,
        step: d.step,
        steps: cfg.steps.length,
        over,
        cols: deal.cols,
        rows: deal.rows,
        cards,
        rail,
        pairs,
        // Does this board have a spotlight pair (not where it is)?
        hasSpot: !!deal.spot,
        open: over ? -1 : d.open,
        streak: d.streak,
        quickEvery: cfg.quickEvery || 0,
        spotlightMs: cfg.spotlightMs || 1000,
        missMs: cfg.missMs || 900,
        chest: !over && !!st.chest,
        reward: over ? null : scaleReward(st.reward, inst.scale),
        chests: cfg.steps.map((x, i) => (x.chest ? i : -1)).filter((i) => i >= 0),
        grand: scaleReward(cfg.grand, inst.scale),
        ticketsPerWin: cfg.ticketsPerWin,
        turns: d.turns,
      },
    };
  },
};
