// CALENDAR: which side games run when. The names on the right ('critics',
// 'props-rose' ...) are the entries in config/events.js.
//
// The week has two blocks, in the phone's local time:
//   weekday  Monday 00:00 to Friday 00:00
//   weekend  Friday 00:00 to Monday 00:00
//
// A SLOT is one place on the Home screen. Where a slot lists several events,
// they take turns week by week (first one this week, second one next week,
// and so on). When you finish a slot's event early, the next one in its list
// replaces it for the rest of the block.

export const CALENDAR = {
  // Always running. `period` is how long one run lasts:
  //   'month' = the 1st to the last day, 'week' = Monday to Sunday,
  //   'forever' = never ends.
  always: [
    { slot: 'season', period: 'month', events: ['season'] },
    { slot: 'missions', period: 'week', events: ['callsheet'] },
    { slot: 'weekly', period: 'week', events: ['weekly'] },
    { slot: 'encore', period: 'forever', events: ['encore'] },
  ],

  // Added Monday to Thursday.
  weekday: [
    { slot: 'race', events: ['critics', 'critics-streak'] },
    { slot: 'collect', events: ['props-rose', 'techweek', 'props-star'], replace: true },
    { slot: 'group', events: ['company'], replace: true },
    { slot: 'streak', events: ['scottish', 'ghostlight'], replace: true },
    { slot: 'quick', events: ['quickchange-star', 'callbacks'] },
  ],

  // Added Friday to Sunday.
  weekend: [
    { slot: 'race', events: ['critics-streak', 'critics'] },
    { slot: 'collect', events: ['techweek', 'props-lantern', 'props-star'], replace: true },
    { slot: 'group', events: ['dash'], replace: true },
    { slot: 'streak', events: ['ghostlight', 'scottish'], replace: true },
    { slot: 'quick', events: ['callbacks', 'quickchange-grenade'] },
  ],

  // Slots marked `replace: true` start their next event when the current one
  // is finished early. This is the most replacements one slot gets in one
  // block, so prizes cannot be collected without limit.
  maxReplacements: 3,

  // A replacement runs only to the end of the block, so its coin prizes are
  // scaled by the share of the block that is left. They never drop below
  // this share (0.25 = a quarter of the full prize).
  minPrizeScale: 0.25,
};
