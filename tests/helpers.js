// Test helper: build a board from rows of text, one character per cell.
//   0-4  piece of that color      .  empty        #  hole
//   H  spot-h   V  spot-v   U  under   S  show   P  prism
// Obstacles (lower-case letters):
//   c  crate   h  hatbox   t  trunk   i  dryice   b  cashbox
//   f  flat    s  strongbox   g  costume bag      d  the sandbag dropper
// A paint can and a padlock need extra data, so build those in the test:
//   set(board, x, y, block('paint', { color: 2 }))
import { createBoard, set, piece, power, block, drop, EMPTY } from '../engine/board.js';

const POWER_CHARS = { H: 'spot-h', V: 'spot-v', U: 'under', S: 'show', P: 'prism' };
const BLOCK_CHARS = {
  c: 'crate', h: 'hatbox', t: 'trunk', i: 'dryice', b: 'cashbox',
  f: 'flat', s: 'strongbox', g: 'costume',
};

export function boardFrom(rows) {
  const board = createBoard(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') set(board, x, y, null);
      else if (ch === '.') set(board, x, y, EMPTY);
      else if (POWER_CHARS[ch]) set(board, x, y, power(POWER_CHARS[ch]));
      else if (BLOCK_CHARS[ch]) set(board, x, y, block(BLOCK_CHARS[ch]));
      else if (ch === 'd') set(board, x, y, drop());
      else set(board, x, y, piece(Number(ch)));
    });
  });
  return board;
}

// A full board with no ready-made matches: colors laid out so no three line up
// and no 2x2 forms. Useful as a neutral background for power-up tests.
export function quietBoard(cols = 9, rows = 9, colors = 5) {
  const board = createBoard(cols, rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      set(board, x, y, piece((x + 2 * y) % colors));
    }
  }
  return board;
}

// A storage stand-in for save tests (same getItem/setItem as localStorage).
export function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}
