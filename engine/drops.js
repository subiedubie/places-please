// Drop rules: how the color of each new piece is chosen.
//
// Every new piece in the game is chosen by calling a drop rule with a context
// object:  ctx = { board, x, colors, rng, targets, movesLeft, history }
// so that smarter rules can be plugged in later without touching other code.

// D1: pure chance. Every color 0..colors-1 is equally likely.
export function D1(ctx) {
  return ctx.rng.int(ctx.colors);
}

export const DROP_RULES = { D1 };
