// Small shared helpers for the side games: seeded random numbers, prize
// lookup and prize scaling. Nothing here reads the clock.

// Turn any list of numbers / strings into one whole number (a seed).
// The same inputs always give the same seed.
export function hash(...parts) {
  let h = 2166136261;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Extra mixing so that seeds that differ a little give very different draws.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

// A random-number maker that always gives the same sequence for the same
// seed. Each call returns a number from 0 up to (not including) 1.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A number between lo and hi, using the next draw from `r`.
export function between(r, [lo, hi]) {
  return lo + (hi - lo) * r();
}

// Count of one power-up kind in a tally part (tally.fired or tally.made).
// 'spot' counts both Missile directions together; 'any' counts everything.
export function countKind(part, kind) {
  if (!part) return 0;
  if (kind === 'spot') return (part['spot-h'] || 0) + (part['spot-v'] || 0);
  if (kind === 'any') return Object.values(part).reduce((a, b) => a + (b || 0), 0);
  return part[kind] || 0;
}

// A prize made smaller for a replacement event. Coins are multiplied by
// `scale` and rounded to the nearest 10 (never below 10); boosters, packs
// and timed boosts are left as they are.
export function scaleReward(reward, scale = 1) {
  if (!reward) return reward;
  const out = JSON.parse(JSON.stringify(reward));
  if (scale < 1 && out.coins) out.coins = Math.max(10, Math.round((out.coins * scale) / 10) * 10);
  return out;
}

// The prize for finishing in `place`, from a list like
// [{ place: 1, reward }, { place: 4, to: 10, reward }]. null if none.
export function prizeFor(prizes, place, scale = 1) {
  for (const p of prizes || []) {
    if (place >= p.place && place <= (p.to ?? p.place)) return scaleReward(p.reward, scale);
  }
  return null;
}

// The prize list as the screens show it, already scaled.
export function prizeList(prizes, scale = 1) {
  return (prizes || []).map((p) => ({
    place: p.place,
    ...(p.to ? { to: p.to } : {}),
    reward: scaleReward(p.reward, scale),
  }));
}

// 1 -> "1st", 2 -> "2nd", 12 -> "12th".
export function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

// Sort leaderboard rows (highest score first; you win a tie) and number them.
export function rank(rows) {
  rows.sort((a, b) => b.score - a.score || (b.you ? 1 : 0) - (a.you ? 1 : 0));
  rows.forEach((r, i) => {
    r.place = i + 1;
  });
  return rows;
}
