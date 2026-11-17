// COMPUTER RIVALS AND TEAMMATES. Their names and how fast they play.
// A rival's whole score schedule is fixed from a random seed the moment an
// event starts. It depends only on the clock, never on how you are doing.

// How many levels YOU usually win in a day. Every rival pace below is a
// fraction of this, so if your habits change, change these two numbers.
export const USUAL = {
  weekday: 20, // Monday to Friday
  weekend: 50, // Saturday and Sunday
};

// The hours of the day in which rivals play (24-hour clock, local time).
// Outside these hours their scores stand still.
export const RIVAL_HOURS = { wake: 8, sleep: 23 };

// A rival's day varies by this much either way (0.15 = up to 15% more or
// less than their average), so their scores do not climb in a straight line.
export const DAY_JITTER = 0.15;

// THE PACE TABLES. The setting in the game (Relaxed / Even / Tough) picks
// one of these. It is the only thing that makes rivals faster or slower.
//   leader  the fastest rival's pace, as a fraction of YOUR usual pace,
//           drawn between the two numbers. On 'even' it is centred on 1.0,
//           so if you play your usual amount you finish first in about
//           half of the races.
//   pack    every other rival's pace, as a fraction of the LEADER's pace.
//   speed   for short timed events (the dash, the sprint, the bracket, the
//           staged streak): rivals are this many times faster than the
//           times and totals written in config/events.js.
export const PACES = {
  relaxed: { leader: [0.6, 1.0], pack: [0.3, 0.9], speed: 0.75 },
  even: { leader: [0.8, 1.2], pack: [0.3, 0.9], speed: 1.0 },
  tough: { leader: [1.0, 1.4], pack: [0.4, 0.95], speed: 1.3 },
};

// The pace used when the save has no valid setting.
export const DEFAULT_PACE = 'even';

// What your own row is called on a leaderboard.
export const YOU = 'You';

// Names for rivals and teammates: plain first names and theatre handles.
// An event draws as many as it needs, without repeats. Keep at least 60.
export const RIVAL_NAMES = [
  'Ada', 'Ben', 'Cleo', 'Dev', 'Elsa', 'Finn', 'Gus', 'Hana', 'Ivo', 'June',
  'Kit', 'Lena', 'Milo', 'Nell', 'Omar', 'Pia', 'Quinn', 'Rosa', 'Sam', 'Tess',
  'Uma', 'Vik', 'Wren', 'Yara', 'Zeb', 'Amos', 'Bea', 'Cal', 'Dot', 'Ezra',
  'Flo', 'Gia', 'Hugo', 'Ines', 'Jay', 'Kai', 'Luz', 'Mae', 'Nico', 'Opal',
  'StageDoorSue', 'PropMaster', 'UnderstudyNo1', 'FlyGalleryFan', 'CueToCue',
  'BreakALeg', 'GreenRoomGus', 'SpotOp', 'FootlightFay', 'TheDresser',
  'HouseLeft', 'CallBoy', 'WingsAndBorders', 'FrontOfHouse', 'PitViolin',
  'LimelightLou', 'BoxOfficeBo', 'CurtainCallCat', 'GaffTape', 'HalfHourCall',
  'TrapRoomTom', 'Soubrette', 'SecondSpear', 'MatineeIdol', 'ScrimShady',
  'ProsceniumPat', 'GhostLight', 'DressRunDee', 'PromptBook', 'StrikeNight',
];
