// YOUR COMPANY (the team). Computer castmates who help you and ask for help.
export const TEAM = {
  // The team's name on the team page.
  name: 'The Ghost Light Company',
  // How many castmates besides you.
  size: 49,
  // Their levels: between these two (most nearer the low end).
  levels: [40, 2400],
  // Avatars you (and they) can have. Drawn in ui/team.js.
  avatars: ['piggy', 'cat', 'fox', 'owl', 'bunny', 'bear', 'frog', 'panda'],

  // ---- Their requests (cards and lives) ----
  // How many castmates ask for something each day: between these two.
  requestsPerDay: [5, 9],
  // The hours of the day in which they ask (24-hour clock).
  hours: [8, 23],
  // Share of requests that are for a card (the rest are for a life).
  cardShare: 0.6,
  // Someone else fills a request this many minutes after it is made (between
  // the two). You can fill it first.
  fillMinutes: [20, 300],
  // What you get for helping a castmate.
  helpReward: { coins: 20 },

  // ---- Asking for lives ----
  // You may ask once every this many hours.
  lifeAskHours: 4,
  // How many lives arrive, between these two, over these many minutes.
  livesSent: [3, 5],
  lifeMinutes: [2, 45],
};
