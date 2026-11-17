# Obstacles, batch 2 — shared spec (16 Nov. 2026)

Builds on docs/OBSTACLES.md (read that first; everything there still holds). Three developers work from this at once: engine, levels, drawing. Names and art are ours.

Priority order if time runs short (engine): 1 floor + bouquet, 2 generators + candy jar, 3 big blocks, 4 color-list blocks, 5 makeup case, 6 curtain. Whatever is not finished must be left out of `config/obstacles.js` `BATCH2_READY` so levels never use it.

## New data shapes

**Floor layer.** `board.floor`: an array the same length as `board.cells`; each entry is `null`, `'confetti'` or `'petals'`. `createBoard` fills it with null; `cloneBoard` copies it; it serializes with the board. A missing `board.floor` must be treated as all null (old saves). Floor never moves. It is removed when the thing standing on that cell is cleared (a piece matched or blasted, a power-up fired there, a block destroyed there): emit `{ type: 'floor', x, y, kind }`. Level field: `floor: [{ x, y, kind }]`.

**Big blocks.** A block bigger than one cell has its real cell (the anchor) at its top-left: `{ t: 'block', kind, hp, w, h, ... }`. Every other cell it covers is `{ t: 'part', ax, ay }` pointing at the anchor. A hit on any part goes to the anchor, at most once per hit source (one group, one power-up effect). Parts never move, match, swap or count as targets. Level entry: `{ x, y, kind }` (size from config) or with `w` for a truss.

**Color-list blocks.** `colors: [c, ...]` = colors still to go. A match of one of those colors next to it removes that color (one per group). A power hit removes one color (the first). Destroyed when the list is empty. `hp` mirrors `colors.length`.

## The kinds (add to config/obstacles.js as `OBSTACLES2`, same style, with `size`, and export `BATCH2_READY`: the list of kinds the engine fully supports)

| id | Name | Like (reference only) | Size | Rule |
|---|---|---|---|---|
| confetti (floor) | Confetti | Grass | floor | removed when the cell's content is cleared; target `{block:'confetti'}` counts removals |
| petals (floor) | Petals | Leaves | floor | same; spread by a bouquet |
| planter | Planter | Bush | 2×2 | 5 match hits; when it breaks its four cells become empty with confetti floor |
| bouquet | Bouquet | Flowerpot | 1 | 2 hits of any kind; when it breaks, petals floor goes on its own cell and each orthogonal non-hole neighbour (not under blocks) |
| tophat | Top Hat | Magic Hat | 1 | generator: never breaks; every 3rd match hit emits `{type:'collect', x, y, kind:'dove'}`; target `{block:'dove'}` |
| popper | Popcorn Cart | Cauldron | 1 | generator: every 3rd match hit emits collect `'popcorn'`; target `{block:'popcorn'}` |
| candyjar | Candy Jar | Jar | 1 | 3 hits of any kind; EACH hit emits collect `'candy'`; target `{block:'candy'}` |
| dovecote | Dovecote | Birdhouse | 2×2 | 5 match hits; target `{block:'dovecote'}` counts destroyed |
| footlights | Footlights | Light Bulb | 2×2 | color-list of 4 colors |
| fireworks | Fireworks | Dynamite Box | 2×1 | color-list of 3 colors; when it breaks it blasts like a Grenade centred on its anchor (pieces cleared, blocks take a power hit, power-ups fire) |
| truss | Lighting Truss | Metal Tube | w×1 (w from the level entry, 3 to the full width) | 2 power hits |
| ticketbooth | Ticket Booth | Slot Machine | 3×1 | hits: power, then match, match, match; when it breaks each of its three cells becomes a random power-up |
| makeupcase | Makeup Case | Bow Tie box | 1 | has `open: boolean`; every case flips open/closed after each player move; only a match hit while open lands (1 hit); target counts destroyed |
| curtain | Curtain | Curtain | 1 per cell | `{ t:'block', kind:'curtain', color, need, inside? }`; takes no hits; all curtain cells of one color open together when the level's count of cleared pieces of that color reaches `need`; each then becomes its `inside` (or empty); emit `{type:'block', ..., destroyed:true, by:'count'}` per cell |

Generators keep `count` (match hits so far) on the cell instead of losing hp. The Ninja Star treats a cell as needed when: its floor is a needed target; it is (part of) a block of a needed kind; it is a generator or candy jar whose product is needed (a power hit on a generator does nothing, so prefer the piece next to it instead: generators are NOT targeted directly).

## Targets
`{ block: <id>, need, have }` where id may now also be `confetti`, `petals`, `dove`, `popcorn`, `candy`, or any batch-2 block kind (counts destroyed).
