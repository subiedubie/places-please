// Match detection: finds every set of pieces that should clear right now.
//
// A "group" is a connected patch of same-colored pieces in which every cell
// takes part in a straight run of three or more, or in a 2x2 block.
// Only ordinary pieces can be in a group; holes, empty cells and power-ups
// never match anything.
//
//   Group = { color, cells: [{x, y}, ...], shape }
//   shape = 'three' | 'line4h' | 'line4v' | 'square' | 'lt' | 'line5'

import { get, isPiece } from './board.js';

export function findGroups(board) {
  const { cols, rows } = board;
  const size = cols * rows;
  const idx = (x, y) => y * cols + x;

  // The color at a cell, or -1 when the cell is not an ordinary piece.
  const colorAt = (x, y) => {
    const cell = get(board, x, y);
    return isPiece(cell) ? cell.color : -1;
  };

  // For every cell: how long is the same-color run it sits in, across (hRun)
  // and down (vRun)? And is it part of a 2x2 block (inSquare)?
  const hRun = new Uint8Array(size);
  const vRun = new Uint8Array(size);
  const inSquare = new Uint8Array(size);

  // Step 1a: horizontal runs. Walk each row, measuring stretches of one color.
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      const color = colorAt(x, y);
      let end = x + 1;
      if (color >= 0) {
        while (end < cols && colorAt(end, y) === color) end++;
        for (let i = x; i < end; i++) hRun[idx(i, y)] = end - x;
      }
      x = end;
    }
  }

  // Step 1b: vertical runs, the same idea down each column.
  for (let x = 0; x < cols; x++) {
    let y = 0;
    while (y < rows) {
      const color = colorAt(x, y);
      let end = y + 1;
      if (color >= 0) {
        while (end < rows && colorAt(x, end) === color) end++;
        for (let i = y; i < end; i++) vRun[idx(x, i)] = end - y;
      }
      y = end;
    }
  }

  // Step 1c: 2x2 blocks. (x, y) is the block's top-left corner.
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const color = colorAt(x, y);
      if (
        color >= 0 &&
        colorAt(x + 1, y) === color &&
        colorAt(x, y + 1) === color &&
        colorAt(x + 1, y + 1) === color
      ) {
        inSquare[idx(x, y)] = 1;
        inSquare[idx(x + 1, y)] = 1;
        inSquare[idx(x, y + 1)] = 1;
        inSquare[idx(x + 1, y + 1)] = 1;
      }
    }
  }

  // A cell "matches" if it is in a run of 3+ either way, or in a 2x2.
  const matches = (i) => hRun[i] >= 3 || vRun[i] >= 3 || inSquare[i] === 1;

  // Step 2: join touching matched cells of one color into groups (flood fill).
  // Because overlapping shapes (an L, a T, a five crossing a three) share
  // cells, they end up as ONE group, so they make one power-up and each cell
  // is cleared once.
  const seen = new Uint8Array(size);
  const groups = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const start = idx(x, y);
      if (seen[start] || !matches(start)) continue;
      const color = colorAt(x, y);
      const cells = [];
      const queue = [{ x, y }];
      seen[start] = 1;
      while (queue.length > 0) {
        const c = queue.shift();
        cells.push(c);
        const neighbours = [
          { x: c.x + 1, y: c.y },
          { x: c.x - 1, y: c.y },
          { x: c.x, y: c.y + 1 },
          { x: c.x, y: c.y - 1 },
        ];
        for (const n of neighbours) {
          if (colorAt(n.x, n.y) !== color) continue; // also rejects off-board
          const ni = idx(n.x, n.y);
          if (seen[ni] || !matches(ni)) continue;
          seen[ni] = 1;
          queue.push(n);
        }
      }
      // Fixed order (top row first, left to right) so results are repeatable.
      cells.sort((a, b) => a.y - b.y || a.x - b.x);

      // Step 3: name the group's shape, highest-value shape first.
      let longestH = 0;
      let longestV = 0;
      let hasSquare = false;
      for (const c of cells) {
        const i = idx(c.x, c.y);
        if (hRun[i] > longestH) longestH = hRun[i];
        if (vRun[i] > longestV) longestV = vRun[i];
        if (inSquare[i]) hasSquare = true;
      }
      let shape;
      if (longestH >= 5 || longestV >= 5) shape = 'line5'; // five (or more) in a line
      else if (longestH >= 3 && longestV >= 3) shape = 'lt'; // an L or a T
      else if (longestH === 4) shape = 'line4h'; // four across
      else if (longestV === 4) shape = 'line4v'; // four down
      else if (hasSquare) shape = 'square'; // a 2x2
      else shape = 'three';

      groups.push({ color, cells, shape });
    }
  }
  return groups;
}

// Which power-up a shape makes (null = none). A four across makes a Spotlight
// that fires down its column, and a four down one that fires along its row.
export function powerForShape(shape) {
  switch (shape) {
    case 'line5':
      return 'prism';
    case 'lt':
      return 'show';
    case 'line4h':
      return 'spot-v';
    case 'line4v':
      return 'spot-h';
    case 'square':
      return 'under';
    default:
      return null;
  }
}
