// The config entries proposed for the five team / meta side games (control,
// pursuit, tournament, circuit, battle). Once they are in config/events.js
// the tests use those instead (EVENTS[key] ?? PROPOSED[key]).
import { EVENTS } from '../config/events.js';

// Every power-up free at the start of every level ("super everything").
const ALL_POWERS = ['prism', 'show', 'spot-h', 'under'];

export const PROPOSED = {
  // ---- MISSION CONTROL (type 'control') -------------------------------
  // Four tasks drawn from `pool`, each on a different running total of the
  // whole game, counted from the moment the event starts. Each finished
  // task pays its prize from `rewards` (in board order); when all four are
  // done, `grand` is paid by itself.
  //   tasks    how many tasks are on the board
  //   pool     counter: 'wins' (levels won), 'coins' (coins earned from
  //            levels), 'cards' (album cards gained), 'gems' (jewels found
  //            Under the Stage), 'pairs' (Costume Pairs matches), 'prizes'
  //            (prizes paid by the other side games)
  //            need: [weekday block, weekend block]
  //            with: only drawn when that event is on the calendar this block
  //            text: what the card says; {n} is the number
  // Sizing: a weekday block is about 80 wins, a weekend about 120.
  control: {
    type: 'control',
    title: 'Mission Control',
    blurb: 'Four cues on the lighting desk, each tied to the rest of the game. Run all four and the big chest opens by itself.',
    tasks: 4,
    pool: [
      { counter: 'wins', need: [30, 50], text: 'Win {n} levels', hint: 'Every level you win counts.' },
      { counter: 'coins', need: [3000, 5000], text: 'Earn {n} coins in levels', hint: 'Coins paid for winning levels count.' },
      { counter: 'cards', need: [15, 25], text: 'Collect {n} Playbill cards', hint: 'Open card packs from your rewards.' },
      { counter: 'gems', need: [10, 10], with: 'understage', text: 'Find {n} jewels Under the Stage', hint: 'Dig Under the Stage.' },
      { counter: 'pairs', need: [25, 25], with: 'costumepairs', text: 'Match {n} Costume Pairs', hint: 'Play Costume Pairs.' },
      { counter: 'prizes', need: [6, 10], text: 'Win {n} prizes in other events', hint: 'Prizes from any other side game count.' },
    ],
    rewards: [
      { coins: 300, boosters: { spot: 1 } },
      { coins: 500, packs: 1 },
      { coins: 700, boosters: { show: 1, drill: 1 } },
      { coins: 1000, packs: 2 },
    ],
    grand: { coins: 3000, gold: 1, boosters: { prism: 1 }, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 30 } },
  },

  // ---- MISSION PURSUIT (type 'pursuit') -------------------------------
  // Three races in turn, each against `rivals` computer runners: first to
  // win targets[0] levels, then targets[1], then targets[2]. Wins need not
  // be in a row. A race starts when you press Start; if a runner gets there
  // first the race is lost and starts again (on Start) with new runners.
  //   minutesPerWin  how long a runner takes per win, between the two
  //                  (each runner its own; Tough makes them 1.3x quicker)
  //   races          the prize for winning each race
  pursuit: {
    type: 'pursuit',
    title: 'Mission Pursuit',
    blurb: 'Seven runners, three races: first to win 3 levels, then 5, then 7. Press Start when you are ready to play.',
    rivals: 6,
    targets: [3, 5, 7],
    minutesPerWin: [5, 12],
    races: [
      { reward: { coins: 300, boosters: { spot: 1 } } },
      { reward: { coins: 600, packs: 1, boosters: { show: 1 } } },
      { reward: { coins: 1500, gold: 1, boost: { powers: ['prism', 'show'], minutes: 30 } } },
    ],
  },

  // ---- THE COMPANY TOURNAMENT (type 'tournament') ---------------------
  // You and your 49 castmates add every level won to one team total.
  //   mateShare   each castmate wins this share of YOUR usual number of
  //               levels (drawn once per castmate, between the two). 1.0-1.95
  //               puts the team near 8,800 by Sunday night (8,000 reached
  //               around Sunday evening)
  //   milestones  at = team total; mustWin = levels YOU must have won to be
  //               paid it (paid the moment both are true)
  //               lives = minutes of unlimited lives
  //   topShown    how many top contributors the screen lists
  tournament: {
    type: 'tournament',
    title: 'The Company Tournament',
    blurb: 'Your whole company of fifty counts every level it wins. 2,000, 5,000 and 8,000 wins open three big prizes. Everybody has to play.',
    mates: 49,
    mateShare: [1.0, 1.95],
    milestones: [
      { at: 2000, mustWin: 5, reward: { boost: { powers: ALL_POWERS, minutes: 15 }, lives: 15 } },
      { at: 5000, mustWin: 15, reward: { boost: { powers: ALL_POWERS, minutes: 30 }, lives: 30 } },
      { at: 8000, mustWin: 30, reward: { coins: 10000 } },
    ],
    topShown: 10,
  },

  // ---- THE GRAND CIRCUIT (type 'circuit') -----------------------------
  // A league of `players` (you + computer players) for one block. Wins pay
  // crownsPerWin by difficulty. At the end the top `up` move up a division,
  // the bottom `down` move down. Your division is remembered between runs.
  //   rivalCrownsPerLevel  crowns a rival gets per level it wins (you
  //                        average about 1.4): higher = a faster division
  //   prizes               by final place in that division
  circuit: {
    type: 'circuit',
    title: 'The Grand Circuit',
    blurb: 'Twenty players tour the circuit. Win levels for crowns; the top five move up a stage, the bottom five move down.',
    players: 20,
    crownsPerWin: [1, 2, 3, 5],
    up: 5,
    down: 5,
    divisions: [
      {
        name: 'Bronze Stage',
        colors: ['#e09050', '#7a3a10'],
        rivalCrownsPerLevel: 1.3,
        prizes: [
          { place: 1, reward: { coins: 800, packs: 1 } },
          { place: 2, reward: { coins: 500 } },
          { place: 3, reward: { coins: 400 } },
          { place: 4, to: 5, reward: { coins: 250 } },
          { place: 6, to: 10, reward: { coins: 100 } },
        ],
      },
      {
        name: 'Silver Stage',
        colors: ['#d8e0f0', '#5a6a8a'],
        rivalCrownsPerLevel: 1.8,
        prizes: [
          { place: 1, reward: { coins: 1500, packs: 2 } },
          { place: 2, reward: { coins: 1000, packs: 1 } },
          { place: 3, reward: { coins: 700, packs: 1 } },
          { place: 4, to: 5, reward: { coins: 400 } },
          { place: 6, to: 10, reward: { coins: 200 } },
        ],
      },
      {
        name: 'Gold Stage',
        colors: ['#ffd84a', '#a06000'],
        rivalCrownsPerLevel: 2.3,
        prizes: [
          { place: 1, reward: { coins: 3000, gold: 1, packs: 2 } },
          { place: 2, reward: { coins: 2000, packs: 2 } },
          { place: 3, reward: { coins: 1500, packs: 1 } },
          { place: 4, to: 5, reward: { coins: 800 } },
          { place: 6, to: 10, reward: { coins: 400 } },
          { place: 11, to: 15, reward: { coins: 150 } },
        ],
      },
    ],
  },

  // ---- BATTLE OF THE COMPANIES (type 'battle') ------------------------
  // Twenty companies; each one's score is the shields its members win. At
  // the end of the block the top companies are paid, and so are the top
  // contributors inside yours. You must add at least `minShields`.
  //   members            people in your company (you + castmates)
  //   shieldsPerWin      your shields for a win, by difficulty
  //   mateShare          each castmate wins this share of your usual levels
  //   mateSkew           2 = most castmates near the low end, a few keen
  //                      ones near the top (1 = spread evenly). With these,
  //                      the top three need about 1.3-1.6x your usual play
  //   mateShieldsPerWin  shields a castmate gets per level won
  //   rivalStrength      the other companies' totals as a share of what
  //                      yours wins on average, by the Relaxed / Even /
  //                      Tough setting
  //   companyNames       names the other companies are drawn from
  battle: {
    type: 'battle',
    title: 'Battle of the Companies',
    blurb: 'Twenty companies, one block. Every level your company wins is a shield. Top five companies are paid, and the top three in yours.',
    teams: 20,
    members: 50,
    shieldsPerWin: [1, 2, 3, 5],
    mateShare: [0.2, 1.6],
    mateSkew: 2,
    mateShieldsPerWin: 1.4,
    rivalStrength: { relaxed: [0.5, 1.0], even: [0.6, 1.1], tough: [0.7, 1.2] },
    minShields: 10,
    companyNames: [
      'The Lantern Players', 'Marigold Rep', 'The Velvet Rope Co.', 'Ironbridge Theatre', 'Crescent Moon Players',
      'The Saltwater Stage', 'Pennywhistle Rep', 'The Gaslamp Guild', 'Bramblewood Players', 'The Copper Kettle Co.',
      'Harbourlight Theatre', 'The Paper Moon Co.', 'Old Mill Players', 'The Juniper Stage', 'Starling Street Rep',
      'The Thimble Theatre', 'Foxglove Players', 'The Lark Rise Co.', 'Northgate Rep', 'The Blue Shutter Players',
      'Wicker Chair Theatre', 'The Gilded Attic', 'Canal Street Players', 'The Hollyhock Co.', 'Riverbend Rep',
      'The Tin Whistle Co.', 'Maple Hall Players', 'The Quayside Stage',
    ],
    teamPrizes: [
      { place: 1, reward: { coins: 2500, packs: 2, boost: { powers: ['prism', 'show'], minutes: 30 } } },
      { place: 2, reward: { coins: 1800, packs: 2 } },
      { place: 3, reward: { coins: 1200, packs: 1 } },
      { place: 4, to: 5, reward: { coins: 600 } },
    ],
    memberPrizes: [
      { place: 1, reward: { coins: 1500, gold: 1 } },
      { place: 2, reward: { coins: 1000, packs: 1 } },
      { place: 3, reward: { coins: 600, packs: 1 } },
    ],
  },
};

export const cfgOf = (key) => EVENTS[key] ?? PROPOSED[key];
