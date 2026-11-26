// LIVES. Losing a level (or quitting one) costs a life; with none left you
// wait, ask your company, or buy a refill.
export const LIVES = {
  // Lives when full.
  max: 5,
  // Lives when full while the Season's gold row is open (meta/events/season.js).
  passMax: 8,
  // One life comes back every this many minutes, until full.
  refillMinutes: 30,
  // A full refill costs this many coins.
  refillCost: 900,
  // Castmates may send you lives beyond your maximum, up to this many.
  overflow: 10,
};
