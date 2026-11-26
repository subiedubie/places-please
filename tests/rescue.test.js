import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act } from '../engine/game.js';
import { findLegalMoves } from '../engine/moves.js';
import { findGroups } from '../engine/matches.js';
import { isPower, get, set, cloneBoard } from '../engine/board.js';
import { makeRng } from '../engine/rng.js';
import { RESCUE } from '../config/rescue.js';
import {
  rescueDue, episodeFor, episodeAt, sceneOf, rescueLevel, countOf, startRun, afterMove, tick, left,
  ropesLeft, markOffered, recordResult,
} from '../meta/rescue.js';

// ---- When it is offered ----

test('offered after every Nth win, once per win count, never before', () => {
  const n = RESCUE.everyWins;
  assert.equal(rescueDue({ wins: 0, rescue: null }), false);
  assert.equal(rescueDue({ wins: n - 1, rescue: null }), false);
  assert.equal(rescueDue({ wins: n, rescue: null }), true);
  assert.equal(rescueDue({ wins: n + 1, rescue: null }), false);
  const save = { wins: n, rescue: null };
  save.rescue = markOffered(save.rescue, save);
  assert.equal(rescueDue(save), false, 'not offered twice at the same win count');
  save.wins = 2 * n;
  assert.equal(rescueDue(save), true);
  assert.equal(rescueDue({ wins: n }, { ...RESCUE, enabled: false }), false);
});

test('scenes come round in order and each try gets its own board', () => {
  const n = RESCUE.everyWins;
  const ids = [1, 2, 3, 4, 5].map((k) => episodeFor({ wins: k * n }).sceneId);
  assert.deepEqual(ids, [...RESCUE.order, RESCUE.order[0]].slice(0, 5));
  const a = episodeFor({ wins: n }, RESCUE, 0);
  const b = episodeFor({ wins: n }, RESCUE, 1);
  assert.equal(a.id, b.id);
  assert.notEqual(a.seed, b.seed);
  assert.equal(episodeFor({ wins: n }).seed, a.seed, 'the same episode is the same board every time');
  for (const id of RESCUE.order) assert.ok(RESCUE.scenes[id], `scene ${id} is configured`);
  assert.ok(RESCUE.order.length >= 3);
});

test('the board is small, four colors, and the engine never ends it by itself', () => {
  for (let i = 0; i < RESCUE.order.length; i++) {
    const ep = episodeAt(i);
    const level = rescueLevel(ep);
    assert.ok(level.cols >= 7 && level.cols <= 8 && level.rows >= 7 && level.rows <= 8);
    assert.equal(level.colors, 4);
    const game = newGame(level, ep.seed);
    assert.equal(game.status, 'playing');
    assert.ok(findLegalMoves(game.board).length > 0);
  }
});

// ---- One try ----

test('the danger steps on each move and counted gems push it back', () => {
  const ep = episodeAt(0); // flood: one color, by moves
  const scene = sceneOf(ep);
  const c = scene.goal.color;
  const cleared = [0, 0, 0, 0, 0];
  let run = startRun(ep);
  run = afterMove(run, cleared);
  assert.ok(Math.abs(run.danger - 1 / scene.limit) < 1e-9);
  assert.equal(left(run), scene.limit - 1);
  cleared[c] = 10;
  cleared[(c + 1) % 4] = 50; // other colors do not count
  const before = run.danger;
  run = afterMove(run, cleared);
  assert.equal(run.have, 10);
  assert.ok(Math.abs(run.danger - (before + 1 / scene.limit - 10 * scene.pushBack)) < 1e-9);
  assert.equal(countOf({ need: 1 }, [1, 2, 3, 4, 0]), 10, 'any color: all count');
});

test('no gems: lost after exactly `limit` moves; the goal reached on the last move still wins', () => {
  const ep = episodeAt(0);
  const scene = sceneOf(ep);
  let run = startRun(ep);
  const zero = [0, 0, 0, 0, 0];
  for (let i = 0; i < scene.limit - 1; i++) run = afterMove(run, zero);
  assert.equal(run.status, 'playing');
  const last = afterMove(run, zero);
  assert.equal(last.status, 'lost');
  const full = [0, 0, 0, 0, 0];
  full[scene.goal.color] = scene.goal.need;
  assert.equal(afterMove(run, full).status, 'won');
  assert.equal(afterMove(last, full).status, 'lost', 'a finished try stays finished');
});

test('a timed scene moves on with the clock, not with moves', () => {
  const i = RESCUE.order.indexOf('fire');
  const ep = episodeAt(i);
  const scene = sceneOf(ep);
  assert.equal(scene.clock, 'seconds');
  let run = startRun(ep);
  run = afterMove(run, [0, 0, 0, 0, 0]);
  assert.equal(run.danger, 0);
  run = tick(run, scene.limit / 2);
  assert.ok(Math.abs(run.danger - 0.5) < 1e-9);
  assert.equal(left(run), Math.ceil(scene.limit / 2));
  run = tick(run, scene.limit);
  assert.equal(run.status, 'lost');
  // A moves scene ignores the clock.
  assert.equal(tick(startRun(episodeAt(0)), 30).danger, 0);
});

test('ropes snap one by one and the last goes at the very end', () => {
  const ropes = RESCUE.scenes.sandbags.ropes;
  assert.equal(ropesLeft(0, ropes), ropes);
  assert.equal(ropesLeft(0.999, ropes), 1);
  assert.equal(ropesLeft(1, ropes), 0);
  let last = ropes;
  for (let d = 0; d <= 1.0001; d += 0.01) {
    const n = ropesLeft(Math.min(1, d), ropes);
    assert.ok(n <= last);
    last = n;
  }
});

test('a win pays the prize once per episode; a loss pays nothing and costs nothing', () => {
  const ep = episodeAt(0);
  let r = recordResult(null, ep, false);
  assert.equal(r.coins, 0);
  assert.equal(r.state.tries, 1);
  r = recordResult(r.state, ep, true);
  assert.equal(r.coins, RESCUE.prizeCoins);
  assert.equal(r.state.saved, 1);
  r = recordResult(r.state, ep, true);
  assert.equal(r.coins, 0, 'the same episode does not pay twice');
  r = recordResult(r.state, episodeAt(1), true);
  assert.equal(r.coins, RESCUE.prizeCoins);
  assert.equal(r.state.tries, 4);
  // The state is plain data (it is stored in the save as JSON).
  assert.deepEqual(JSON.parse(JSON.stringify(r.state)), r.state);
});

// ---- Can it be won? ----

// A simple bot that plays like a careful person: it looks only at the board in
// front of it (never at the gems still to fall), and takes the swap that
// clears the most gems that count, preferring a power-up when there is one.
function botMove(game, goal, rng) {
  const board = game.board;
  let best = -1;
  let pick = null;
  const consider = (action, score) => {
    const v = score + rng.next() * 0.3;
    if (v > best) { best = v; pick = action; }
  };
  board.cells.forEach((c, i) => {
    if (isPower(c)) consider({ type: 'tap', at: { x: i % board.cols, y: Math.floor(i / board.cols) } }, 5);
  });
  for (const m of findLegalMoves(board)) {
    const ca = get(board, m.a.x, m.a.y);
    const cb = get(board, m.b.x, m.b.y);
    if (isPower(ca) || isPower(cb)) { consider({ type: 'swap', ...m }, 6); continue; }
    const b = cloneBoard(board);
    set(b, m.a.x, m.a.y, cb);
    set(b, m.b.x, m.b.y, ca);
    let score = 0;
    for (const g of findGroups(b)) {
      if (!g.cells.some((c) => (c.x === m.a.x && c.y === m.a.y) || (c.x === m.b.x && c.y === m.b.y))) continue;
      for (const c of g.cells) score += goal.color === undefined || get(b, c.x, c.y).color === goal.color ? 1 : 0.1;
      if (g.cells.length >= 4) score += 2; // it makes a power-up
    }
    consider({ type: 'swap', ...m }, score);
  }
  return pick;
}

// On a timed scene the bot is given this many seconds of thinking per move
// (the clock waits while the gems fall).
const BOT_SECONDS_PER_MOVE = 3.5;

function playEpisode(index, chooser) {
  const ep = episodeAt(index);
  const scene = sceneOf(ep);
  const game = newGame(rescueLevel(ep), ep.seed);
  let run = startRun(ep);
  const rng = makeRng(ep.seed ^ 0xb07);
  while (run.status === 'playing' && run.moves < 300) {
    const action = chooser(game, scene.goal, rng);
    assert.ok(action, 'there is always a move');
    const events = act(game, action);
    assert.notEqual(events[0].type, 'invalid');
    if (scene.clock === 'seconds') run = tick(run, BOT_SECONDS_PER_MOVE);
    run = afterMove(run, game.tally.cleared);
  }
  return run;
}

const randomMove = (game, goal, rng) => {
  const all = findLegalMoves(game.board).map((m) => ({ type: 'swap', ...m }));
  return rng.pick(all.length ? all : [botMove(game, goal, rng)]);
};

test('a careful bot saves her in most episodes, but it takes real work', () => {
  const PER_SCENE = 16;
  for (const [s, id] of RESCUE.order.entries()) {
    const scene = RESCUE.scenes[id];
    let wins = 0;
    let randomWins = 0;
    const used = [];
    for (let k = 0; k < PER_SCENE; k++) {
      const index = s + k * RESCUE.order.length; // episodes of this scene
      const run = playEpisode(index, botMove);
      if (run.status === 'won') { wins++; used.push(run.moves); }
      if (playEpisode(index, randomMove).status === 'won') randomWins++;
    }
    used.sort((a, b) => a - b);
    const median = used[used.length >> 1];
    const limitMoves = scene.clock === 'seconds' ? scene.limit / BOT_SECONDS_PER_MOVE : scene.limit;
    if (process.env.RESCUE_STATS) console.log(id, { wins, randomWins, median, limitMoves });
    // Most episodes can be won ...
    assert.ok(wins / PER_SCENE >= 0.65, `${id}: careful bot won ${wins}/${PER_SCENE}`);
    // ... but not in a couple of lucky moves ...
    assert.ok(median >= limitMoves * 0.5, `${id}: median win took ${median} moves of ${limitMoves.toFixed(1)}`);
    // ... and not by swapping at random.
    assert.ok(randomWins < wins, `${id}: random ${randomWins} vs careful ${wins}`);
    assert.ok(randomWins / PER_SCENE <= 0.6, `${id}: random bot won ${randomWins}/${PER_SCENE}`);
  }
});
