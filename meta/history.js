// THE PLAY LOG: one line for every level played, so how hard the game feels
// can be checked against what really happened (Settings > Export save carries
// it). Kept in the save as:
//   save.history = [{ n, tier, won, moves, movesLeft, bought, boosters, pre,
//                     gift, at, ms }]      (newest last, at most KEEP lines)
//   save.logNow  = the line for the level being played, until it ends
export const KEEP = 3000;

export function createHistory(getSave) {
  const box = () => {
    const s = getSave();
    if (!Array.isArray(s.history)) s.history = [];
    return s;
  };
  return {
    // A new attempt begins. pre: pre-level boosters chosen; gift: how many
    // free power-ups it started with (streak gift and timed boosts).
    begin(level, now, pre = [], gift = 0) {
      box().logNow = { n: level.n, tier: level.tier, moves: level.moves, bought: 0, boosters: {}, pre: pre.slice(), gift, at: now };
    },
    // Something spent during the level: 'moves' or an in-level booster kind.
    note(kind) {
      const l = box().logNow;
      if (!l) return;
      if (kind === 'moves') l.bought++;
      else l.boosters[kind] = (l.boosters[kind] || 0) + 1;
    },
    // The level ended.
    end(game, now) {
      const s = box();
      const l = s.logNow || { n: game.level.n, tier: game.level.tier, moves: game.level.moves, bought: 0, boosters: {}, pre: [], gift: 0, at: now };
      s.history.push({ ...l, won: game.status === 'won', movesLeft: game.movesLeft, ms: Math.max(0, now - l.at) });
      if (s.history.length > KEEP) s.history.splice(0, s.history.length - KEEP);
      s.logNow = null;
    },
    // A short summary: per tier, attempts, wins, levels that needed bought
    // moves or boosters, and moves left on wins.
    summary() {
      const out = {};
      for (const h of box().history) {
        const t = (out[h.tier] ||= { played: 0, won: 0, bought: 0, boosted: 0, movesLeft: 0 });
        t.played++;
        if (h.won) { t.won++; t.movesLeft += h.movesLeft || 0; }
        if (h.bought) t.bought++;
        if (Object.keys(h.boosters || {}).length) t.boosted++;
      }
      for (const t of Object.values(out)) t.movesLeft = t.won ? +(t.movesLeft / t.won).toFixed(1) : 0;
      return out;
    },
  };
}

// ONE-TIME REPAIR (version 27): level 474 froze on the phone and had to be
// quit, which counted as a loss and ended the win streak (and with it the
// Super Magic Ball). If the play log shows that quit, the streak is put back
// to what it was before it, plus the wins since, as long as every level since
// was won. Runs once (save.fixes). Returns true if the streak was changed.
export function repairFrozenQuit(save, n = 474, tag = 'freeze-474') {
  if (!save || !Array.isArray(save.history)) return false;
  if (!Array.isArray(save.fixes)) save.fixes = [];
  if (save.fixes.includes(tag)) return false;
  const h = save.history;
  let at = -1;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].n === n && !h[i].won) { at = i; break; }
  if (at < 0) return false; // not reached yet: try again on a later launch
  save.fixes.push(tag);
  let before = 0;
  for (let i = at - 1; i >= 0 && h[i].won; i--) before++;
  const after = h.slice(at + 1);
  if (!after.every((x) => x.won)) return false;
  const streak = before + after.length;
  if (!(streak > (save.streak || 0))) return false;
  save.streak = streak;
  return true;
}
