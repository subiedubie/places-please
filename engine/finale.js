// THE FINALE: after a win, every move left over turns a gem into a power-up
// and they all go off. Only for show: it plays on a copy of the game, so it
// changes neither the pay nor the save. No screen code.
import { serialize, deserialize, dropContext } from './game.js';
import { cloneBoard, get, set, isPiece, isPower, power } from './board.js';
import { fire } from './powers.js';
import { settleSteps } from './resolve.js';

export const FINALE = { most: 8, rounds: 2, waves: 3, kinds: ['spot-h', 'spot-v', 'show'] };

const where = (board, test) => {
  const out = [];
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) if (test(get(board, x, y))) out.push({ x, y });
  return out;
};

// One list of events at a time. Nothing at all if there is nothing to set off.
export function* finaleSteps(game) {
  const copy = deserialize(serialize(game));
  const { board, _rng: rng } = copy;
  const gems = where(board, isPiece);
  const changed = [];
  for (let i = Math.min(copy.movesLeft, FINALE.most); i > 0 && gems.length; i--) {
    const p = gems.splice(rng.int(gems.length), 1)[0];
    const kind = rng.pick(FINALE.kinds);
    changed.push({ ...p, was: get(board, p.x, p.y), kind });
    set(board, p.x, p.y, power(kind));
  }
  if (changed.length) yield [{ type: 'transform', kind: 'show', cells: changed }, { type: 'frame', board: cloneBoard(board) }];
  for (let round = 0; round < FINALE.rounds; round++) {
    const ready = where(board, isPower);
    if (!ready.length) return;
    const fired = new Set();
    for (const at of ready) if (isPower(get(board, at.x, at.y))) yield fire(board, at, { rng, fired });
    let n = 0;
    for (const step of settleSteps(board, dropContext(copy))) {
      yield step.events;
      if (step.landed && ++n >= FINALE.waves) break;
    }
  }
}
