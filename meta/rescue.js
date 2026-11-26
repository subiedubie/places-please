// SAVE THE VIOLINIST: the rules of the optional rescue episode, with no
// screen code (the screen is ui/games/rescue.js, the numbers config/rescue.js).
//
// Every function here is pure: it reads what it is given and returns new
// objects, so it runs the same in the browser and in the tests.
//
// The saved state (save.rescue, null for a new player) is small:
//   { offeredAt, saved, tries, paid: [episode ids] }
//   offeredAt  the win count at which an episode was last offered (so the
//              same one is never offered twice)
//   saved      how many times she has been saved
//   tries      how many tries in all (won or not)
//   paid       the episodes whose prize has been paid (each pays once)
//
// One try ("run") is:
//   { sceneId, need, have, counted, danger, moves, seconds, status }
//   danger goes from 0 (all well) to 1 (it reaches her). Each move (or each
//   second, on a timed scene) moves it on; every counted gem pushes it back.
//   status: 'playing' | 'won' | 'lost'.

import { RESCUE } from '../config/rescue.js';

const EPS = 1e-9;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Is an episode due right now? True once the win count reaches a multiple of
// cfg.everyWins, until it has been offered at that count.
export function rescueDue(save, cfg = RESCUE) {
  if (!cfg.enabled || !save) return false;
  const wins = save.wins | 0;
  if (wins < cfg.everyWins || wins % cfg.everyWins !== 0) return false;
  const st = save.rescue || {};
  return st.offeredAt !== wins;
}

// A number fixed by the episode and the try: the board's random seed.
function seedFor(index, tries) {
  let h = (0x5eed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = (h + Math.imul(tries, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// The episode for the save's current win count: which scene, and its seed.
// try_ (0, 1, 2 ...) changes the board for "Try again".
export function episodeFor(save, cfg = RESCUE, try_ = 0) {
  const wins = (save && save.wins) | 0;
  const index = Math.max(0, Math.floor(wins / cfg.everyWins) - 1);
  return episodeAt(index, cfg, try_);
}

// The episode with this number (0 = the first one ever offered).
export function episodeAt(index, cfg = RESCUE, try_ = 0) {
  const sceneId = cfg.order[index % cfg.order.length];
  return { id: 'rescue-' + (index + 1), index, sceneId, seed: seedFor(index, try_), try: try_ };
}

export function sceneOf(episode, cfg = RESCUE) {
  const scene = cfg.scenes[episode.sceneId];
  if (!scene) throw new Error('unknown rescue scene: ' + episode.sceneId);
  return scene;
}

// The level the engine plays (engine/game.js newGame). The engine is given
// targets it can never finish and moves it never runs out of: this file
// decides when the episode is won or lost. For a one-color goal the engine's
// target is that color (so a Ninja Star flies to it); for "any color" every
// color is a target.
export function rescueLevel(episode, cfg = RESCUE) {
  const scene = sceneOf(episode, cfg);
  const b = { ...cfg.board, ...(scene.board || {}) };
  const NEVER = 99999;
  const targets = scene.goal.color !== undefined
    ? [{ color: scene.goal.color, need: NEVER }]
    : Array.from({ length: b.colors }, (_, color) => ({ color, need: NEVER }));
  return {
    n: 0, tier: 0, rescue: episode.sceneId, bonus: false,
    cols: b.cols, rows: b.rows, holes: (b.holes || []).map((h) => ({ ...h })), colors: b.colors,
    moves: NEVER, targets, blocks: [], drops: [], floor: [],
  };
}

// The gems that count toward the goal, from the engine's tally
// (game.tally.cleared: gems cleared per color).
export function countOf(goal, cleared) {
  if (!cleared) return 0;
  if (goal.color !== undefined) return cleared[goal.color] | 0;
  let n = 0;
  for (const c of cleared) n += c | 0;
  return n;
}

// A fresh try.
export function startRun(episode, cfg = RESCUE) {
  const scene = sceneOf(episode, cfg);
  return { sceneId: episode.sceneId, need: scene.goal.need, have: 0, counted: 0, danger: 0, moves: 0, seconds: 0, status: 'playing' };
}

// Take in the gems counted so far: the goal fills and the danger is pushed back.
function absorb(run, scene, cleared) {
  const total = countOf(scene.goal, cleared);
  const gained = Math.max(0, total - run.counted);
  return { ...run, counted: total, have: Math.min(run.need, total), danger: clamp01(run.danger - gained * scene.pushBack) };
}

function settle(run) {
  if (run.status !== 'playing') return run;
  if (run.have >= run.need) return { ...run, status: 'won' };
  if (run.danger >= 1 - EPS) return { ...run, danger: 1, status: 'lost' };
  return run;
}

// A move has finished (the board is still). `cleared` = game.tally.cleared.
// On a 'moves' scene the danger steps on first, then the gems push it back,
// so a good move can win back more than it cost.
export function afterMove(run, cleared, cfg = RESCUE) {
  if (run.status !== 'playing') return run;
  const scene = cfg.scenes[run.sceneId];
  let r = { ...run, moves: run.moves + 1 };
  if (scene.clock === 'moves') r.danger = clamp01(r.danger + 1 / scene.limit);
  r = absorb(r, scene, cleared);
  // The goal is checked before the danger: finishing on the last move wins.
  return settle(r);
}

// Time passes on a 'seconds' scene (nothing happens on a 'moves' scene).
// The screen calls this only while no gems are moving.
export function tick(run, seconds, cfg = RESCUE) {
  if (run.status !== 'playing') return run;
  const scene = cfg.scenes[run.sceneId];
  if (scene.clock !== 'seconds' || !(seconds > 0)) return run;
  return settle({ ...run, seconds: run.seconds + seconds, danger: clamp01(run.danger + seconds / scene.limit) });
}

// Moves (or whole seconds) left before the danger reaches her, as shown on
// screen. Pushing the danger back adds to it.
export function left(run, cfg = RESCUE) {
  const scene = cfg.scenes[run.sceneId];
  return Math.max(0, Math.ceil((1 - run.danger) * scene.limit - EPS));
}

// The ropes still holding the sandbag (the sandbag scene): they snap one by
// one as the danger rises; the last one goes when it reaches 1.
export function ropesLeft(danger, ropes) {
  if (danger >= 1 - EPS) return 0;
  return Math.max(1, Math.ceil((1 - danger) * ropes - EPS));
}

// The episode has been offered (whether played or skipped).
export function markOffered(state, save) {
  return { ...(state || {}), offeredAt: (save && save.wins) | 0 };
}

// A try has ended. Returns { state, coins }: coins is the prize to pay now
// (only for a win, and only the first win of that episode).
export function recordResult(state, episode, won, cfg = RESCUE) {
  const st = { offeredAt: null, saved: 0, tries: 0, paid: [], ...(state || {}) };
  const paid = Array.isArray(st.paid) ? st.paid.slice() : [];
  let coins = 0;
  if (won && !paid.includes(episode.id)) {
    coins = cfg.prizeCoins;
    paid.push(episode.id);
  }
  // Only the last few ids are kept; old episodes never come back.
  while (paid.length > 20) paid.shift();
  return {
    state: { ...st, tries: (st.tries | 0) + 1, saved: (st.saved | 0) + (won ? 1 : 0), paid },
    coins,
  };
}
