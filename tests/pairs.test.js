import test from 'node:test';
import assert from 'node:assert/strict';
import pairs, { dealOf } from '../meta/events/pairs.js';
import { EVENTS, TIER_POINTS } from '../config/events.js';
import { rng, hash } from '../meta/events/util.js';

// The entry the lead adds to config/events.js as `costumepairs`. Until it
// is there, the copy below is tested (keep the two the same).
const LOCAL = {
  type: 'pairs',
  title: 'Costume Pairs',
  blurb: 'Win levels for tickets, then turn over wardrobe cards two at a time. Remember where each piece was.',
  ticketsPerWin: [2, 3, 4, 6],
  startTickets: 10,
  quickEvery: 3,
  quickRefund: 1,
  chalk: true,
  spotlightMs: 1000,
  missMs: 900,
  wardrobe: ['crown', 'tophat', 'fan', 'mask', 'wig', 'cape', 'shoe', 'boa', 'tiara', 'monocle', 'cane', 'ruff'],
  steps: [
    { cols: 3, rows: 4, reward: { coins: 100 } },
    { cols: 3, rows: 4, reward: { boosters: { spot: 1 } } },
    { cols: 3, rows: 4, spot: true, reward: { coins: 150 } },
    { cols: 4, rows: 4, spot: true, reward: { boosters: { drill: 1 } } },
    { cols: 4, rows: 4, spot: true, chest: true, reward: { coins: 500, packs: 1, boosters: { show: 1 } } },
    { cols: 4, rows: 4, spot: true, reward: { coins: 200 } },
    { cols: 4, rows: 5, spot: true, reward: { boost: { powers: ['spot-h'], minutes: 15 } } },
    { cols: 4, rows: 5, spot: true, reward: { packs: 1 } },
    { cols: 4, rows: 5, spot: true, reward: { coins: 250, boosters: { coinflip: 1 } } },
    { cols: 4, rows: 5, spot: true, chest: true, reward: { coins: 1000, packs: 2, boosters: { prism: 1 } } },
    { cols: 4, rows: 6, spot: true, reward: { coins: 300 } },
    { cols: 4, rows: 6, spot: true, reward: { boosters: { stageleft: 1, trapdoor: 1 } } },
    { cols: 4, rows: 6, spot: true, reward: { coins: 200, packs: 1 } },
    { cols: 4, rows: 6, spot: true, reward: { coins: 400, boosters: { show: 1 } } },
    { cols: 4, rows: 6, spot: true, chest: true, reward: { coins: 2000, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } } },
  ],
  grand: { coins: 5000, gold: 1, packs: 2, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
};
const cfg = EVENTS.costumepairs || LOCAL;
if (EVENTS.costumepairs) {
  test('config entry matches the tested copy', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(EVENTS.costumepairs)), JSON.parse(JSON.stringify(LOCAL)));
  });
}

const ctx = () => { const paid = []; return { paid, pay: (r, t) => paid.push(t), count() {} }; };
const fresh = (seed = 5) => { const inst = { seed, scale: 1, data: {}, state: 'running', done: false }; pairs.begin(inst, cfg); return inst; };

test('every board is an even grid; each picture appears exactly twice', () => {
  assert.equal(cfg.steps.length, 15);
  for (let s = 1; s < 40; s++) {
    const inst = fresh(s);
    cfg.steps.forEach((st, i) => {
      const deal = dealOf(inst, cfg, i);
      assert.equal(deal.faces.length, st.cols * st.rows);
      assert.equal(deal.faces.length % 2, 0);
      const n = {};
      for (const f of deal.faces) n[f] = (n[f] || 0) + 1;
      assert.ok(Object.values(n).every((k) => k === 2));
      assert.ok(Object.keys(n).every((f) => cfg.wardrobe.includes(f)));
      if (st.spot) assert.ok(n[deal.spot] === 2); else assert.equal(deal.spot, null);
    });
  }
});

test('boards grow from 3x4 to 4x6; chests on steps 5, 10, 15; grand pays gold', () => {
  assert.deepEqual([cfg.steps[0].cols, cfg.steps[0].rows], [3, 4]);
  assert.deepEqual([cfg.steps[14].cols, cfg.steps[14].rows], [4, 6]);
  assert.deepEqual(cfg.steps.map((s, i) => (s.chest ? i + 1 : 0)).filter(Boolean), [5, 10, 15]);
  assert.equal(cfg.grand.gold, 1);
});

test('the same seed always deals the same board; different seeds differ', () => {
  const a = dealOf(fresh(7), cfg, 3).faces.join();
  assert.equal(dealOf(fresh(7), cfg, 3).faces.join(), a);
  assert.notEqual(dealOf(fresh(8), cfg, 3).faces.join(), a);
});

test('wins pay tickets by difficulty; losses pay none', () => {
  const inst = fresh();
  const start = inst.data.tickets;
  pairs.onLevel(inst, cfg, { won: true, tier: 2 }, ctx());
  assert.equal(inst.data.tickets, start + cfg.ticketsPerWin[2]);
  pairs.onLevel(inst, cfg, { won: false, tier: 3 }, ctx());
  assert.equal(inst.data.tickets, start + cfg.ticketsPerWin[2]);
});

test('a turn costs one ticket; a miss turns back; a match stays up', () => {
  const inst = fresh(3);
  const deal = dealOf(inst, cfg, 0);
  const c = ctx();
  const t0 = inst.data.tickets;
  const a = 0;
  const miss = deal.faces.findIndex((f, i) => i !== a && f !== deal.faces[a]);
  const hit = deal.faces.findIndex((f, i) => i !== a && f === deal.faces[a]);
  const r1 = pairs.act(inst, cfg, { flip: a }, c);
  assert.ok(r1.ok && r1.first && r1.face === deal.faces[a]);
  assert.equal(inst.data.tickets, t0 - 1);
  // the open card cannot be flipped again
  assert.equal(pairs.act(inst, cfg, { flip: a }, c).ok, false);
  const r2 = pairs.act(inst, cfg, { flip: miss }, c);
  assert.ok(r2.ok && !r2.match && r2.otherFace === deal.faces[a]);
  assert.equal(inst.data.tickets, t0 - 1); // second card is free
  let v = pairs.view(inst, cfg).game;
  assert.ok(v.cards.every((k) => !k.matched && k.face === null));
  assert.ok(v.cards[a].seen && v.cards[miss].seen);
  pairs.act(inst, cfg, { flip: a }, c);
  const r3 = pairs.act(inst, cfg, { flip: hit }, c);
  assert.ok(r3.match);
  v = pairs.view(inst, cfg).game;
  assert.ok(v.cards[a].matched && v.cards[hit].matched && v.cards[a].face === deal.faces[a]);
  assert.deepEqual(v.rail, [deal.faces[a]]);
  // matched cards cannot be flipped
  assert.equal(pairs.act(inst, cfg, { flip: hit }, c).ok, false);
});

test('no ticket, no turn; the view never shows a face-down picture', () => {
  const inst = fresh();
  inst.data.tickets = 0;
  const r = pairs.act(inst, cfg, { flip: 0 }, ctx());
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'tickets');
  const v = pairs.view(inst, cfg).game;
  assert.ok(v.cards.every((k) => k.face === null && !k.seen));
  assert.equal(JSON.stringify(v).includes(dealOf(inst, cfg, 0).faces[0] + '"'), false);
});

test('an open first card survives leaving the screen, and its second card is free', () => {
  const inst = fresh(4);
  inst.data.tickets = 1;
  pairs.act(inst, cfg, { flip: 2 }, ctx());
  const saved = JSON.parse(JSON.stringify(inst));
  const v = pairs.view(saved, cfg).game;
  assert.equal(v.open, 2);
  assert.ok(v.cards[2].face);
  assert.equal(saved.data.tickets, 0);
  assert.equal(pairs.act(saved, cfg, { flip: 3 }, ctx()).ok, true);
});

test('quick change: three matches in a row refund a ticket; a miss resets it', () => {
  const inst = fresh(11);
  inst.data.step = 3; // a 4x4 board
  inst.data.tickets = 50;
  const deal = dealOf(inst, cfg, 3);
  const c = ctx();
  const pairsLeft = [];
  const done = new Set();
  deal.faces.forEach((f, i) => { if (done.has(i)) return; const j = deal.faces.indexOf(f, i + 1); done.add(i); done.add(j); pairsLeft.push([i, j, f]); });
  // skip the spotlight pair so the reveal does not get in the way
  const plain = pairsLeft.filter((p) => p[2] !== deal.spot);
  const before = inst.data.tickets;
  let quick = 0;
  for (let k = 0; k < 3; k++) {
    pairs.act(inst, cfg, { flip: plain[k][0] }, c);
    quick += pairs.act(inst, cfg, { flip: plain[k][1] }, c).quick;
  }
  assert.equal(quick, 1);
  assert.equal(inst.data.tickets, before - 3 + 1);
  // a miss
  pairs.act(inst, cfg, { flip: plain[3][0] }, c);
  const m = pairs.act(inst, cfg, { flip: plain[4][0] }, c);
  assert.equal(m.match, false);
  assert.equal(inst.data.streak, 0);
});

test('the spotlight pair reveals every face-down card, and marks them seen', () => {
  const inst = fresh(12);
  inst.data.step = 4;
  inst.data.tickets = 5;
  const deal = dealOf(inst, cfg, 4);
  const a = deal.faces.indexOf(deal.spot);
  const b = deal.faces.indexOf(deal.spot, a + 1);
  const r1 = pairs.act(inst, cfg, { flip: a }, ctx());
  assert.equal(r1.spot, true);
  const r = pairs.act(inst, cfg, { flip: b }, ctx());
  assert.ok(r.match && r.spot);
  assert.equal(r.reveal.length, deal.faces.length - 2);
  for (const x of r.reveal) assert.equal(x.face, deal.faces[x.cell]);
  const v = pairs.view(inst, cfg).game;
  assert.ok(v.cards.every((k) => k.seen || k.matched));
  // still face down in the view: the reveal was only a glimpse
  assert.equal(v.cards.filter((k) => k.face).length, 2);
});

test('clearing all fifteen boards pays every step and the grand prize', () => {
  const inst = fresh(9);
  inst.data.tickets = 9999;
  const c = ctx();
  let guard = 0;
  while (!inst.done && guard++ < 5000) {
    const deal = dealOf(inst, cfg, inst.data.step);
    const i = deal.faces.findIndex((_, k) => !inst.data.matched.includes(k));
    const j = deal.faces.findIndex((f, k) => k !== i && f === deal.faces[i]);
    pairs.act(inst, cfg, { flip: i }, c);
    pairs.act(inst, cfg, { flip: j }, c);
  }
  assert.ok(inst.done);
  assert.equal(inst.state, 'won');
  assert.equal(c.paid.length, 16);
  assert.deepEqual(c.paid.filter((t) => t.startsWith('Wardrobe chest')), ['Wardrobe chest 5', 'Wardrobe chest 10', 'Wardrobe chest 15']);
  assert.equal(c.paid[15], 'Grand prize');
  assert.equal(pairs.act(inst, cfg, { flip: 0 }, c).ok, false);
  assert.equal(pairs.view(inst, cfg).summary, 'Complete');
});

// ---- SIZING: a weekend of play -------------------------------------------
// The owner wins about 20 levels on Friday and 50 on each of Saturday and
// Sunday (120 in all). Tiers are drawn so their points average about 1.4 a
// win. Between two sittings at the wardrobe the player plays a level, so a
// player who does not bank tickets has to play from memory across levels.
// Players differ in memory and in habit:
//   perfect  remembers every card ever turned and the whole spotlight flash
//            (a ceiling no person reaches); spends after every win
//   steady   remembers the last 6 cards and 4 from a flash, forgets the
//            board between sittings, but saves tickets until it has as many
//            as the board has pairs, then clears in one go (the intended
//            good play)
//   sloppy   remembers the last 2 cards, forgets between sittings, spends
//            after every win
//   random   turns face-down cards at random
// All use the chalk marks: the first card is one never turned, if any left.
const TIER_P = [0.72, 0.18, 0.06, 0.04]; // Rehearsal ... Command Performance
const PLAYERS = {
  perfect: { cap: Infinity, flash: Infinity, forget: false, bank: false },
  steady: { cap: 6, flash: 4, forget: true, bank: true },
  casual: { cap: 4, flash: 2, forget: true, bank: false },
  sloppy: { cap: 2, flash: 0, forget: true, bank: false },
  random: { cap: 0, flash: 0, forget: true, bank: false, random: true },
};

function weekendWins(seed) {
  const r = rng(hash('weekend', seed));
  const out = [];
  for (let i = 0; i < 120; i++) {
    const u = r();
    let t = 0;
    let acc = TIER_P[0];
    while (u > acc && t < 3) acc += TIER_P[++t];
    out.push(t);
  }
  return out;
}

function makePlayer(kind, seed) {
  const P = PLAYERS[kind];
  const r = rng(hash('player', kind, seed));
  let mem = new Map(); // cell -> face, oldest first
  let step = -1;
  const remember = (cell, face) => {
    mem.delete(cell);
    mem.set(cell, face);
    while (mem.size > P.cap) mem.delete(mem.keys().next().value);
  };
  const pick = (list) => list[Math.floor(r() * list.length)];
  const p = {
    P,
    breakTime() { if (P.forget) mem = new Map(); },
    after(out) {
      if (out.ok) {
        remember(out.cell, out.face);
        if (out.reveal && P.flash > 0) {
          const take = out.reveal.slice().sort(() => r() - 0.5).slice(0, Math.min(out.reveal.length, P.flash));
          for (const x of take) remember(x.cell, x.face);
        }
      }
      return out;
    },
    turn(inst) {
      if (inst.data.step !== step) { step = inst.data.step; mem = new Map(); }
      const v = pairs.view(inst, cfg).game;
      const down = v.cards.map((k, i) => i).filter((i) => !v.cards[i].matched);
      for (const c of [...mem.keys()]) if (v.cards[c].matched) mem.delete(c);
      const flip = (cell) => pairs.act(inst, cfg, { flip: cell }, { pay() {}, count() {} });
      if (P.random) {
        const a = pick(down);
        if (!flip(a).ok) return false;
        return flip(pick(down.filter((x) => x !== a))).ok;
      }
      // 1. a pair already known
      const byFace = new Map();
      for (const [c, f] of mem) {
        if (byFace.has(f)) {
          if (!flip(byFace.get(f)).ok) return false;
          return p.after(flip(c)).ok;
        }
        byFace.set(f, c);
      }
      // 2. a new card, then its partner if known, else another new card
      const new1 = down.filter((i) => !v.cards[i].seen && !mem.has(i));
      const unknown = down.filter((i) => !mem.has(i));
      const a = pick(new1.length ? new1 : unknown.length ? unknown : down);
      const r1 = flip(a);
      if (!r1.ok) return false;
      const partner = [...mem].find(([c, f]) => f === r1.face && c !== a);
      remember(a, r1.face);
      if (partner) return p.after(flip(partner[0])).ok;
      const rest = down.filter((i) => i !== a && !v.cards[i].seen && !mem.has(i));
      const rest2 = down.filter((i) => i !== a && !mem.has(i));
      const b = pick(rest.length ? rest : rest2.length ? rest2 : down.filter((i) => i !== a));
      return p.after(flip(b)).ok;
    },
  };
  return p;
}

function weekend(kind, seed) {
  const inst = fresh(hash('inst', seed));
  const p = makePlayer(kind, seed);
  const wins = weekendWins(seed);
  let finishedAt = null;
  const sit = () => {
    if (p.P.bank) {
      const v = pairs.view(inst, cfg).game;
      const left = v.pairs - v.rail.length;
      if (inst.data.tickets < left) return; // keep saving
    }
    while (!inst.done && inst.data.tickets > 0) if (!p.turn(inst)) break;
    p.breakTime();
  };
  sit(); // the starting tickets
  wins.forEach((tier, i) => {
    if (inst.done) return;
    pairs.onLevel(inst, cfg, { won: true, tier }, {});
    sit();
    if (inst.done && finishedAt === null) finishedAt = i + 1;
  });
  return { finishedAt, step: inst.data.step };
}

function summary(kind, runs = 200) {
  const res = [];
  for (let s = 1; s <= runs; s++) res.push(weekend(kind, s));
  const at = res.filter((x) => x.finishedAt !== null).map((x) => x.finishedAt).sort((a, b) => a - b);
  const steps = res.map((x) => x.step).sort((a, b) => a - b);
  return {
    kind,
    finished: at.length / runs,
    winsToFinish: at.length ? { fastest: at[0], median: at[Math.floor(at.length / 2)], slowest: at[at.length - 1] } : null,
    medianStepsDone: steps[Math.floor(steps.length / 2)],
  };
}

test('sizing: tier mix averages about 1.4 points a win', () => {
  const w = weekendWins(1).concat(weekendWins(2), weekendWins(3));
  const avg = w.reduce((a, t) => a + TIER_POINTS[t], 0) / w.length;
  assert.ok(avg > 1.25 && avg < 1.6, `avg ${avg}`);
});

test('sizing: a weekend of 120 wins — memory decides it, not luck', () => {
  const res = Object.keys(PLAYERS).map((k) => summary(k));
  const [perfect, steady, casual, sloppy, random] = res;
  for (const x of res) console.log(`  ${x.kind.padEnd(8)} finished ${(x.finished * 100).toFixed(0)}%  wins to finish ${JSON.stringify(x.winsToFinish)}  median steps done ${x.medianStepsDone}`);
  // A perfect memory always finishes, with Sunday to spare (70 wins = the
  // end of Saturday, 120 = the end of Sunday).
  assert.equal(perfect.finished, 1);
  assert.ok(perfect.winsToFinish.slowest <= 100, 'perfect too slow');
  // ... but never before Saturday is under way (20 wins = end of Friday).
  assert.ok(perfect.winsToFinish.fastest >= 45, 'perfect too fast');
  // Steady, sensible play (save up, clear a board in one sitting) finishes,
  // and later than perfect: on Sunday.
  assert.ok(steady.finished >= 0.9, `steady finished ${steady.finished}`);
  assert.ok(steady.winsToFinish.median > 90 && steady.winsToFinish.median > perfect.winsToFinish.median + 15);
  // Playing from a short memory after every level does not finish, though
  // it still opens the first chests; sloppy and random play fall further short.
  assert.ok(casual.finished < 0.5, `casual finished ${casual.finished}`);
  assert.ok(casual.medianStepsDone >= 5, 'casual should still reach the first chest');
  assert.equal(sloppy.finished, 0);
  assert.equal(random.finished, 0);
  assert.ok(random.medianStepsDone < sloppy.medianStepsDone);
});

// The ticket cost of clearing all fifteen boards with tickets to spare.
// Run with PAIRS_PROBE=1 to print it (for tuning).
if (process.env.PAIRS_PROBE) {
  test('probe: tickets needed for all fifteen boards', () => {
    for (const kind of Object.keys(PLAYERS)) {
      const costs = [];
      for (let s = 1; s <= 100; s++) {
        const inst = fresh(hash('inst', s));
        inst.data.tickets = 100000;
        const p = makePlayer(kind, s);
        let g = 0;
        while (!inst.done && g++ < 100000) p.turn(inst);
        costs.push(100000 - inst.data.tickets);
      }
      costs.sort((a, b) => a - b);
      console.log(`  ${kind} tickets p10/p50/p90 ${costs[10]} ${costs[50]} ${costs[90]}`);
    }
  });
}
