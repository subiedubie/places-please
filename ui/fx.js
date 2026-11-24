// A small notice board between the animations and whatever shows the extra
// sparkle: ui/anim.js announces ("a gem broke here"); ui/stage.js and
// ui/main.js listen.
export const fx = { burst: null, trail: null, spark: null, collect: null, splash: null };

export function emit(what, ...args) {
  const fn = fx[what];
  if (fn) {
    try { fn(...args); } catch { /* decoration must never stop the game */ }
  }
}
