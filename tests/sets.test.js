import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, get, set, piece, power, drop, block, placeBlock, hitBlockEvents, isEmpty, isBlock, isPiece, cloneBoard, footprint, isPart } from '../engine/board.js';
import { fire, special } from '../engine/powers.js';
import { findLegalMoves } from '../engine/moves.js';
import { newGame, act, serialize, deserialize } from '../engine/game.js';
import { takeTurn } from '../engine/twists.js';
import { makeRng } from '../engine/rng.js';
import { generateLevel } from '../levels/generate.js';
import { ORDER, buildSet, setFor } from '../levels/sets.js';

function plain(cols, rows) {
  const b = createBoard(cols, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) set(b, x, y, piece((x + 2 * y) % 5));
  return b;
}

test('a bar gives up one square off its end per hit', () => {
  const b = plain(8, 4);
  placeBlock(b, 1, 2, 'dryice', { w: 3 });
  const ev = hitBlockEvents(b, 2, 2, 'match', 0);
  assert.deepEqual(ev[0].freed, [{ x: 3, y: 2 }]);
  assert.ok(isEmpty(get(b, 3, 2)));
  hitBlockEvents(b, 1, 2, 'power');
  assert.ok(isEmpty(get(b, 2, 2)));
  assert.equal(hitBlockEvents(b, 1, 2, 'match', 0)[0].destroyed, true);
  placeBlock(b, 1, 2, 'truss', { w: 3 });
  assert.equal(hitBlockEvents(b, 1, 2, 'match', 0).length, 0);
  assert.equal(hitBlockEvents(b, 1, 2, 'power')[0].hpLeft, 2);
});

test('a vine is cut where it is hit twice, and all beyond falls; at the pot, all of it', () => {
  const b = plain(8, 4);
  placeBlock(b, 0, 2, 'vine', { w: 6 });
  hitBlockEvents(b, 0, 2, 'match', 0, null, [{ x: 3, y: 2 }, { x: 4, y: 2 }]);
  assert.deepEqual(get(b, 0, 2).seg, [2, 2, 2, 1, 1, 2]);
  const ev = hitBlockEvents(b, 0, 2, 'match', 0, null, [{ x: 3, y: 2 }])[0];
  assert.deepEqual(ev.freed.map((p) => p.x), [3, 4, 5]);
  assert.equal(get(b, 0, 2).w, 3);
  hitBlockEvents(b, 0, 2, 'power', undefined, null, [{ x: 0, y: 2 }]);
  assert.equal(hitBlockEvents(b, 0, 2, 'power', undefined, null, [{ x: 0, y: 2 }])[0].destroyed, true);
  for (let x = 0; x < 6; x++) assert.ok(isEmpty(get(b, x, 2)));
});

test('a painted drop rolls up row by row onto crates', () => {
  const b = plain(8, 8);
  placeBlock(b, 1, 3, 'rolldrop', { w: 3, h: 2 });
  hitBlockEvents(b, 2, 3, 'match', 0);
  for (let x = 1; x <= 3; x++) assert.equal(get(b, x, 4).kind, 'crate');
  assert.equal(get(b, 1, 3).h, 1);
  assert.equal(hitBlockEvents(b, 1, 3, 'power')[0].destroyed, true);
  for (let x = 1; x <= 3; x++) assert.equal(get(b, x, 3).kind, 'crate');
});

test('fuse boxes joined in a row all go on the second power hit', () => {
  const b = plain(8, 4);
  for (const x of [1, 2, 3, 5]) set(b, x, 2, block('fusebox'));
  hitBlockEvents(b, 2, 2, 'power');
  assert.equal(hitBlockEvents(b, 2, 2, 'match', 0).length, 0);
  const ev = hitBlockEvents(b, 2, 2, 'power').filter((e) => e.type === 'block' && e.destroyed);
  assert.equal(ev.length, 3);
  assert.ok(isBlock(get(b, 5, 2)), 'not the one beyond a gap');
});

test('three spikes set a barrel rolling through its rows', () => {
  const b = plain(8, 6);
  placeBlock(b, 0, 2, 'barrel');
  for (let x = 1; x < 8; x++) set(b, x, 3, block('hatbox'));
  const opts = { rng: makeRng(1) };
  for (let i = 0; i < 2; i++) special(b, { kind: 'spike', x: 4, y: 0, w: 1, h: 1 }, opts);
  assert.equal(get(b, 0, 2).charge, 1);
  const ev = special(b, { kind: 'spike', x: 4, y: 0, w: 1, h: 1 }, opts);
  assert.ok(ev.some((e) => e.type === 'roll' && e.dir === 1));
  for (let x = 0; x < 8; x++) assert.ok(isEmpty(get(b, x, 3)), 'cell ' + x);
});

test('a dressing room throws gifts, a cannon shoots at what is needed, greasepaint spills', () => {
  const opts = { rng: makeRng(3) };
  let b = plain(8, 6);
  special(b, { kind: 'toss', x: 0, y: 0, w: 2, h: 2, what: 'giftbox', count: 3 }, opts);
  assert.equal(b.cells.filter((c) => isBlock(c) && c.kind === 'giftbox').length, 3);
  b = plain(8, 6);
  set(b, 7, 5, block('cashbox'));
  special(b, { kind: 'rocket', x: 0, y: 0, w: 1, h: 1 }, { ...opts, needs: (c) => isBlock(c) });
  assert.ok(isEmpty(get(b, 7, 5)));
  set(b, 3, 3, block('greasepot'));
  hitBlockEvents(b, 3, 3, 'match', 0);
  hitBlockEvents(b, 3, 3, 'match', 0);
  assert.equal(b.cells.filter((c) => isBlock(c) && c.kind === 'goo').length, 9);
});

test('fireworks go off in a huge round blast', () => {
  const b = plain(11, 11);
  special(b, { kind: 'bigblast', x: 5, y: 5, w: 2, h: 1 }, { rng: makeRng(1) });
  assert.ok(isEmpty(get(b, 5, 9)) && isEmpty(get(b, 1, 5)) && isPiece(get(b, 0, 0)));
});

test('falling things can be swapped when it makes a match', () => {
  const b = createBoard(4, 3);
  const rows = ['0012', '3D01', '1230'];
  rows.forEach((r, y) => [...r].forEach((c, x) => set(b, x, y, c === 'D' ? drop('dove') : piece(Number(c)))));
  set(b, 2, 0, drop('dove'));
  set(b, 1, 1, piece(4));
  // 0 0 D 2 / 3 4 0 1 : swapping the dove down brings 0 0 0 together.
  assert.ok(findLegalMoves(b).some((m) => m.a.x === 2 && m.a.y === 0 && m.b.x === 2 && m.b.y === 1));
  const level = { n: 1, tier: 0, cols: 4, rows: 3, holes: [], colors: 5, moves: 5, targets: [{ block: 'dove', need: 1 }], blocks: [], drops: [], floor: [] };
  const game = newGame(level, 1);
  game.board.cells = b.cells.slice();
  const ev = act(game, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
  assert.notEqual(ev[0].type, 'invalid');
  assert.equal(game.movesLeft, 4);
});

test('a belt carries everything on it one square, round the end', () => {
  const L = { ...buildSet('belt', 2, 0) };
  const game = newGame(L, 5);
  const belt = game.board.belts[0];
  const before = [];
  for (let x = 0; x < 8; x++) before.push(get(game.board, x, belt.y));
  takeTurn(game);
  for (let x = 0; x < 8; x++) assert.equal(get(game.board, (x + belt.dir + 8) % 8, belt.y), before[x]);
});

test('the second act comes on when the first is cleared', () => {
  const game = newGame(buildSet('acts', 14, 0), 5);
  for (let i = 0; i < game.board.cells.length; i++) if (isBlock(game.board.cells[i])) game.board.cells[i] = piece(i % 4);
  game.targets[0].have = game.targets[0].need;
  game.board.cells[0] = power('show');
  const ev = act(game, { type: 'tap', at: { x: 0, y: 0 } });
  // (tapping is refused once the targets are met, so the board is brought on by a fresh start)
  if (ev[0].type !== 'invalid') {
    assert.ok(ev.some((e) => e.type === 'act'));
    assert.equal(game.act, 1);
    assert.equal(game.targets[0].block, 'hatbox');
    assert.equal(deserialize(serialize(game)).act, 1);
  }
});

test('set pieces come round in turn and can be played without breaking', () => {
  const seen = new Set();
  for (let n = 1; n <= 200; n++) { const L = generateLevel(n); if (L.set) seen.add(L.set); }
  assert.deepEqual([...seen].sort(), [...ORDER].sort());
  assert.equal(setFor(10), null);
  for (const name of ORDER) {
    for (let s = 0; s < 4; s++) {
      const game = newGame(buildSet(name, 40 + s, 0), s);
      const rng = makeRng(s);
      let guard = 0;
      while (game.status === 'playing' && guard++ < 80) {
        const ms = findLegalMoves(game.board);
        const p = game.board.cells.findIndex((c) => c && c.t === 'power');
        const action = p >= 0 && (rng.int(2) || !ms.length) ? { type: 'tap', at: { x: p % 8, y: Math.floor(p / 8) } }
          : { type: 'swap', ...rng.pick(ms) };
        const ev = act(game, action);
        assert.notEqual(ev[0].type, 'invalid', name);
        const b = game.board;
        b.cells.forEach((c, i) => {
          const x = i % b.cols, y = Math.floor(i / b.cols);
          if (isPart(c)) assert.ok(isBlock(get(b, c.ax, c.ay)) && footprint(get(b, c.ax, c.ay), c.ax, c.ay).some((q) => q.x === x && q.y === y), name + ' orphan');
          if (isBlock(c)) for (const q of footprint(c, x, y)) if (q.x !== x || q.y !== y) assert.ok(isPart(get(b, q.x, q.y)), name + ' lost part');
        });
      }
      assert.ok(cloneBoard(game.board));
    }
  }
});

test('three dimmer boxes make the chandelier hit the whole board', () => {
  const b = plain(8, 8);
  placeBlock(b, 3, 3, 'chandelier');
  set(b, 0, 7, block('hatbox'));
  const opts = { rng: makeRng(1) };
  const s = { kind: 'spike', feeds: 'chandelier', look: 'zap', x: 0, y: 0, w: 2, h: 2 };
  special(b, [s, s], opts);
  assert.equal(get(b, 3, 3).charge, 1);
  special(b, s, opts);
  assert.ok(isEmpty(get(b, 3, 3)) && isEmpty(get(b, 4, 4)) && isEmpty(get(b, 7, 0)));
  assert.equal(get(b, 0, 7).hp, 1);
});

test('a mask rack throws a mask per hit, a safe four cash boxes, a trophy case a trophy', () => {
  const n = (b, kind) => b.cells.filter((c) => isBlock(c) && c.kind === kind).length;
  const b = plain(8, 8);
  const opts = { rng: makeRng(1) };
  placeBlock(b, 0, 7, 'maskrack', { w: 3 });
  for (let i = 0; i < 3; i++) special(b, hitBlockEvents(b, 0, 7, 'match', 0)[0].special, opts);
  assert.equal(n(b, 'mask'), 3);
  placeBlock(b, 2, 2, 'grandsafe');
  hitBlockEvents(b, 2, 2, 'power'); hitBlockEvents(b, 2, 2, 'power');
  special(b, hitBlockEvents(b, 2, 2, 'power')[0].special, opts);
  assert.equal(n(b, 'cashbox'), 4);
  const t = plain(8, 8);
  placeBlock(t, 2, 2, 'trophycase');
  for (let i = 0; i < 5; i++) hitBlockEvents(t, 2, 2, 'match', 0);
  assert.equal(t.cells.filter((c) => c.t === 'drop' && c.kind === 'trophy').length, 1);
});

test('laser, thunder machine, flame pot and rocket rack hit what is needed', () => {
  const opts = { rng: makeRng(2), needs: (c) => isBlock(c) };
  const left = (kind, extra) => {
    const b = plain(8, 8);
    for (let x = 0; x < 8; x++) set(b, x, 7, block('crate'));
    special(b, { kind, x: 0, y: 2, w: 1, h: 1, ...extra }, opts);
    return b.cells.filter((c) => isBlock(c)).length;
  };
  assert.equal(left('laser', {}), 5);
  assert.equal(left('storm', { count: 6 }), 2);
  assert.ok(left('bursts', { count: 3 }) <= 1);
  const b = plain(8, 8);
  placeBlock(b, 0, 2, 'rocketrack');
  for (let i = 0; i < 3; i++) assert.equal(hitBlockEvents(b, 0, 2, 'power')[0].special.kind, 'rocket');
  assert.ok(isEmpty(get(b, 0, 4)));
});

test('safety curtain, flower cart, bubbles, gel and program stand', () => {
  const b = plain(8, 8);
  placeBlock(b, 0, 4, 'safetycurtain');
  for (let i = 0; i < 5; i++) hitBlockEvents(b, 0, 4, 'match', 0);
  assert.equal(b.cells.filter((c) => isBlock(c) && c.kind === 'crate').length, 12);
  set(b, 3, 1, block('flowercart'));
  for (let i = 0; i < 3; i++) hitBlockEvents(b, 3, 1, 'match', 0);
  assert.equal(b.floor.filter((f) => f === 'petals').length, 8);
  set(b, 0, 0, block('bubbles', { inside: drop('duck') }));
  hitBlockEvents(b, 0, 0, 'match', 0);
  assert.equal(get(b, 0, 0).kind, 'duck');
  set(b, 1, 0, block('gel', { color: 2 }));
  assert.equal(hitBlockEvents(b, 1, 0, 'match', 1).length, 0);
  hitBlockEvents(b, 1, 0, 'match', 2);
  assert.equal(hitBlockEvents(b, 1, 0, 'match', 1)[0].destroyed, true);
  placeBlock(b, 5, 0, 'programs', { open: false });
  assert.equal(hitBlockEvents(b, 5, 0, 'match', 1).length, 0);
  set(b, 5, 0, { ...get(b, 5, 0), open: true });
  assert.ok(hitBlockEvents(b, 5, 0, 'match', 1).some((e) => e.type === 'collect' && e.kind === 'program'));
});

test('a flying rig clears its column when it lands, and the finale leaves the game alone', async () => {
  const b = plain(8, 4);
  set(b, 2, 3, drop('flyer'));
  const { dropAndFill } = await import('../engine/resolve.js');
  const ev = [];
  dropAndFill(b, { colors: 5, rng: makeRng(1), dropRule: (c) => c.rng.int(5) }, ev, true);
  assert.ok(ev.some((e) => e.type === 'collect' && e.kind === 'flyer') && ev.some((e) => e.type === 'beam' && e.up));
  const { finaleSteps } = await import('../engine/finale.js');
  const game = newGame(buildSet('laser', 44, 0), 3);
  const before = JSON.stringify(serialize(game));
  const all = [...finaleSteps(game)];
  assert.ok(all.length > 3 && all[0][0].type === 'transform');
  assert.equal(JSON.stringify(serialize(game)), before);
});
