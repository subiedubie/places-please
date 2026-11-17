// Seeded random numbers (mulberry32). Every random choice in the game comes
// from one of these, so any game can be replayed exactly from its seed.

function hashLabel(seed, label) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed) {
  const seed0 = seed >>> 0;
  let s = seed0;
  const rng = {
    // float in [0, 1)
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // integer 0..n-1
    int(n) {
      return Math.floor(rng.next() * n);
    },
    pick(arr) {
      return arr[rng.int(arr.length)];
    },
    // independent stream named by label; depends only on the original seed
    fork(label) {
      return makeRng(hashLabel(seed0, label));
    },
    // for saving a game mid-level
    getState() {
      return s;
    },
    setState(v) {
      s = v >>> 0;
    },
  };
  return rng;
}
