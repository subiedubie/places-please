// The calendar: turns a time into "which block, week and month is this" and
// "which events should be running". All times are milliseconds, read in the
// phone's local time. What runs when is in config/calendar.js.
import { CALENDAR } from '../../config/calendar.js';

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Midnight at the start of the local day that `now` is in.
export function dayStart(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// The same clock time `n` days later (safe across daylight-saving changes).
export function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Day of the week: 0 = Monday ... 6 = Sunday.
export function weekday(now) {
  return (new Date(now).getDay() + 6) % 7;
}

// Monday 00:00 of the week that `now` is in.
export function weekStart(now) {
  return addDays(dayStart(now), -weekday(now));
}

// A running count of weeks, used to take turns between events week by week.
export function weekNumber(now) {
  return Math.round(weekStart(now) / (7 * DAY));
}

// The block `now` is in:
//   { kind: 'weekday', start: Monday 00:00, end: Friday 00:00 }  or
//   { kind: 'weekend', start: Friday 00:00, end: Monday 00:00 }
export function blockAt(now) {
  const monday = weekStart(now);
  const friday = addDays(monday, 4);
  if (now < friday) return { kind: 'weekday', start: monday, end: friday };
  return { kind: 'weekend', start: friday, end: addDays(monday, 7) };
}

// The month `now` is in: { key: '2026-11', start, end }.
export function monthAt(now) {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    start: new Date(y, m, 1).getTime(),
    end: new Date(y, m + 1, 1).getTime(),
  };
}

// Start and end of a period named in the calendar config.
function periodAt(period, now) {
  if (period === 'month') return monthAt(now);
  if (period === 'week') return { start: weekStart(now), end: addDays(weekStart(now), 7) };
  if (period === 'forever') return { start: 0, end: null };
  if (period === 'firstFriday10') {
    // From the first Friday of the month, for ten days; otherwise not running.
    const m = monthAt(now);
    let f = m.start;
    while (weekday(f) !== 4) f = addDays(f, 1);
    const end = addDays(f, 10);
    return now >= f && now < end ? { start: f, end } : { skip: true };
  }
  return blockAt(now);
}

// Every slot that should have an event running at `now`:
//   [{ slot, slotId, start, end, events, turn, replace }]
// slotId names this slot for this period (it changes when the period does).
// `turn` says whose turn it is in the slot's list this week.
export function schedule(now, calendar = CALENDAR) {
  const out = [];
  const turn = weekNumber(now);
  for (const entry of calendar.always || []) {
    const p = periodAt(entry.period, now);
    if (p.skip) continue;
    out.push({ slot: entry.slot, slotId: `${entry.slot}@${p.start}`, start: p.start, end: p.end, events: entry.events, turn, replace: false });
  }
  const block = blockAt(now);
  for (const entry of calendar[block.kind] || []) {
    out.push({
      slot: entry.slot,
      slotId: `${block.kind}-${entry.slot}@${block.start}`,
      start: block.start,
      end: block.end,
      events: entry.events,
      turn,
      replace: !!entry.replace,
    });
  }
  return out;
}

// The event a slot runs: `n` is 0 for the block's first event, 1 for its
// first replacement, and so on. Returns null when no more are allowed.
export function pickEvent(slot, n, calendar = CALENDAR) {
  if (n > 0 && (!slot.replace || n > calendar.maxReplacements)) return null;
  return slot.events[(slot.turn + n) % slot.events.length];
}

// How much of its prizes a replacement started at `now` pays (1 = all).
export function prizeScale(slot, now, calendar = CALENDAR) {
  if (slot.end === null) return 1;
  const share = (slot.end - now) / (slot.end - slot.start);
  return Math.min(1, Math.max(calendar.minPrizeScale ?? 0.25, share));
}
