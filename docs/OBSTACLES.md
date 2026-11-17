# Obstacles — shared spec (batch 1, 16 Nov. 2026)

Three developers work from this file at the same time: engine, levels, screens. The data lives in `config/obstacles.js` (already written; read it).

## Cells

Two new cell types join `null` (hole), `{t:'empty'}`, `{t:'piece', color}`, `{t:'power', kind}`:

- `{ t: 'block', kind, hp, color?, inside? }` — a fixed obstacle. `kind` is a key of `OBSTACLES`. `hp` = hits still needed (starts at `OBSTACLES[kind].hits.length`). `color` only for `paint`. `inside` (a piece or power-up cell, or another block) only for `padlock`. Never falls, never matches, cannot be swapped or tapped.
- `{ t: 'drop', kind: 'sandbag' }` — the dropper. Falls like a piece. Never matches, cannot be swapped or tapped, is not damaged or cleared by anything. Collected when it sits in the lowest non-hole cell of its column.

`engine/board.js` gains: `block(kind, extra = {})` (sets hp from config), `drop()`, `isBlock(cell)`, `isDrop(cell)`, `isMovable(cell)` (piece, power or drop).

## Hits

The next hit a block needs is `OBSTACLES[kind].hits[hits.length - hp]`.

- **Match hit:** when a group of pieces is cleared, every block orthogonally next to any cell of that group takes ONE match hit (once per group), carrying the group's color.
- **Power hit:** a block inside the area cleared by one power-up effect or combination blast takes ONE power hit from that effect. A second power-up whose blast also covers it (a chain) hits it again. A Magic Ball's color clear hits no blocks. Magic Ball + Magic Ball: every block takes one power hit (two when `opts.superPrism`).
- A hit lands only if it fits the needed type: `'any'` takes both; `'match'` only match; `'power'` only power; `'color'` takes a match of `cell.color` or any power hit. A hit that does not fit does nothing.
- When `hp` reaches 0 the cell becomes: `inside` if `leaves === 'inside'` and it has one; a random power-up (`rng.pick(['spot-h','spot-v','under','show','prism'])`) if `leaves === 'power'`; otherwise `{t:'empty'}`.
- Every hit that lands emits `{ type: 'block', x, y, kind, hpLeft, destroyed: boolean, by: 'match' | 'power' }`, followed (as today) by a `frame` snapshot at the end of the step.

## Falling (replaces the current collapse + refill)

Blocks and holes never move. Holes still let things fall through them (as now); blocks do not.

Repeat until nothing changes:
1. **Straight:** every empty cell whose nearest non-hole cell above holds a movable thing takes it. An empty cell with no non-hole cell above it (open to the top) gets a new piece from the drop rule.
2. **Diagonal, only when step 1 can do nothing more:** take the lowest empty cell that has a movable thing at upper-left `(x-1, y-1)` or upper-right `(x+1, y-1)` (try left first on even x, right first on odd x) and slide it in. Then go back to step 1.
3. **Collect droppers:** when steps 1 and 2 are stuck, remove every `drop` cell sitting in the lowest non-hole cell of its column, emit `{ type: 'collect', x, y, kind: 'sandbag' }`, and go back to step 1.

Cells sealed in by blocks may stay empty until the blocks break. That is allowed.

`fall` events must still carry `falls: [{from, to}]` with each thing's start and final position for the whole step (track each moved cell), and `refill` its `spawns: [{at, cell}]` (final positions). A `frame` follows.

## Moves

A swap is legal only between two cells that are each a piece or a power-up. Blocks, droppers, holes and empties can never be swapped. `hasLegalMove`, `findLegalMoves`, `reshuffle` (pieces only, as now) and `act` all follow this.

## Levels and targets

`Level` gains `blocks: [{ x, y, kind, color?, inside? }]` and `drops: [{ x, y }]` (both may be empty). `newGame` places them after filling the board, then makes sure there is no ready-made match and a legal move exists.

A target is one of:
- `{ color: n, need, have }` (as now), or
- `{ block: kind, need, have }` — counts blocks of that kind destroyed; for `block: 'sandbag'` it counts droppers collected.

The Ninja Star's `needs(cell)` is true for a piece of a still-needed color, and for any block whose kind is a still-needed target (and a padlock holding one).

## Not in this batch
Two-by-two obstacles, spreading grass/leaves, generators, curtains, boxes that open and close.
