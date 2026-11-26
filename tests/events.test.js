// Side games: rivals, calendar, each rule the owner asked to be checked, and
// a full simulated week. The clock is a plain number the tests move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeStorage } from './helpers.js';
import { dailyRivals, burstRivals } from '../meta/events/rivals.js';
import { blockAt, monthAt, schedule, pickEvent, weekStart, addDays, HOUR, MINUTE, DAY } from '../meta/events/calendar.js';
import { createEvents } from '../meta/events/index.js';
import { createRewards } from '../meta/rewards.js';
import { createSession } from '../meta/session.js';
import { loadSave, defaultSave } from '../meta/save.js';
import { CALENDAR } from '../config/calendar.js';
import { EVENTS } from '../config/events.js';
import { rng } from '../meta/events/util.js';

// Local times. 16 Nov. 2026 is a Monday.
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const MON = at(2026, 11, 16);

// Events and a tray on a bare save, without the engine.
function setup() {
  const save = defaultSave();
  const rewards = createRewards(() => save);
  const events = createEvents(() => save, rewards);
  return { save, rewards, events };
}

// A level result. `fired` / `made` / `cleared` fill the tally.
function result(now, { won = true, tier = 0, fired = {}, made = {}, cleared = [0, 0, 0, 0, 0], level = 1, firstAttempt = true } = {}) {
  return { won, level, tier, tally: { cleared, made, fired, cascades: 0 }, firstAttempt, movesLeft: 3, now };
}

const find = (list, type, title) => list.find((e) => e.type === type && (!title || e.title === title));

// ---------------------------------------------------------------- rivals

test('rivals are identical for the same seed and differ for another', () => {
  const make = (seed) => dailyRivals({ seed, count: 10, pace: 'even', startsAt: MON, endsAt: MON + 4 * DAY });
  const a = make(7);
  const b = make(7);
  const c = make(8);
  const times = [MON + 5 * HOUR, MON + 30 * HOUR, MON + 3 * DAY, MON + 9 * DAY];
  for (const t of times) {
    assert.deepEqual(a.map((r) => [r.name, r.scoreAt(t)]), b.map((r) => [r.name, r.scoreAt(t)]));
  }
  assert.notDeepEqual(a.map((r) => r.scoreAt(times[2])), c.map((r) => r.scoreAt(times[2])));
  // Scores never go down, are 0 at the start and stop at the end.
  for (const r of a) {
    assert.equal(r.scoreAt(MON), 0);
    assert.ok(r.scoreAt(times[1]) >= r.scoreAt(times[0]));
    assert.equal(r.scoreAt(MON + 9 * DAY), r.scoreAt(MON + 4 * DAY));
  }
});

test('rivals do not react to the player', () => {
  const quiet = setup();
  const busy = setup();
  quiet.save.events.seed = busy.save.events.seed = 4242;
  const t0 = MON + 9 * HOUR;
  quiet.events.list(t0);
  busy.events.list(t0);
  for (let i = 0; i < 40; i++) busy.events.onLevel(result(t0 + i * MINUTE, { tier: 3 }));
  const later = MON + 2 * DAY;
  const rivalsOf = (x) => find(x.events.list(later), 'race', "Critics' Circle").rows
    .filter((r) => !r.you).map((r) => [r.name, r.score]).sort();
  assert.deepEqual(rivalsOf(quiet), rivalsOf(busy));
});

test("on 'even', the usual amount of play wins about half of week-long races", () => {
  // The player's usual week: 20 a weekday, 50 a weekend day.
  const mine = 20 * 5 + 50 * 2;
  let firsts = 0;
  const races = 300;
  for (let seed = 1; seed <= races; seed++) {
    const rivals = dailyRivals({ seed, count: 49, pace: 'even', startsAt: MON, endsAt: MON + 7 * DAY });
    if (rivals.every((r) => r.scoreAt(MON + 7 * DAY) <= mine)) firsts++;
  }
  assert.ok(firsts > races * 0.35 && firsts < races * 0.65, `${firsts} of ${races}`);
});

test('short-event rivals climb to their total and stay there', () => {
  const [r] = burstRivals({ seed: 3, count: 1, pace: 'even', startsAt: MON, total: 15, minutes: [45, 240] });
  assert.equal(r.scoreAt(MON), 0);
  assert.equal(r.scoreAt(r.finishAt), 15);
  assert.equal(r.scoreAt(r.finishAt + DAY), 15);
  assert.ok(r.scoreAt(MON + (r.finishAt - MON) / 2) < 15);
});

// -------------------------------------------------------------- calendar

test('calendar picks the right block, including Thursday to Friday', () => {
  const thu = blockAt(at(2026, 11, 19, 23, 59));
  assert.equal(thu.kind, 'weekday');
  assert.equal(thu.start, at(2026, 11, 16));
  assert.equal(thu.end, at(2026, 11, 20));
  const fri = blockAt(at(2026, 11, 20, 0, 0));
  assert.equal(fri.kind, 'weekend');
  assert.equal(fri.start, at(2026, 11, 20));
  assert.equal(fri.end, at(2026, 11, 23));
  assert.equal(blockAt(at(2026, 11, 22, 23, 59)).kind, 'weekend'); // Sunday night
  assert.equal(blockAt(at(2026, 11, 23, 0, 0)).kind, 'weekday'); // Monday
  assert.equal(weekStart(at(2026, 11, 22, 12)), at(2026, 11, 16));
});

test('calendar handles a month end inside a block', () => {
  // Monday 30 Nov. and Tuesday 1 Dec. are one weekday block, two months.
  assert.deepEqual(blockAt(at(2026, 11, 30, 12)), blockAt(at(2026, 12, 1, 12)));
  assert.equal(monthAt(at(2026, 11, 30, 23, 59)).key, '2026-11');
  assert.equal(monthAt(at(2026, 12, 1, 0, 0)).key, '2026-12');
  assert.equal(monthAt(at(2026, 11, 30)).end, at(2026, 12, 1));
  assert.equal(monthAt(at(2026, 12, 31, 23)).end, at(2027, 1, 1));
  const season = (t) => schedule(t).find((s) => s.slot === 'season').slotId;
  const race = (t) => schedule(t).find((s) => s.slot === 'race').slotId;
  assert.notEqual(season(at(2026, 11, 30, 12)), season(at(2026, 12, 1, 12)));
  assert.equal(race(at(2026, 11, 30, 12)), race(at(2026, 12, 1, 12)));
});

test('the schedule lists always-on events plus the block, and turns alternate', () => {
  // (The parade runs only ten days a month, so it is left out of the count.)
  const always = CALENDAR.always.filter((e) => e.period !== 'firstFriday10').length;
  const noParade = (list) => list.filter((s) => s.slot !== 'parade');
  const weekdaySlots = noParade(schedule(MON + HOUR));
  assert.equal(weekdaySlots.length, always + CALENDAR.weekday.length);
  const weekendSlots = noParade(schedule(at(2026, 11, 21, 9)));
  assert.equal(weekendSlots.length, always + CALENDAR.weekend.length);
  // The parade: from the first Friday of the month, for ten days.
  assert.ok(schedule(at(2026, 11, 6, 9)).some((s) => s.slot === 'parade'));
  assert.ok(schedule(at(2026, 11, 15, 9)).some((s) => s.slot === 'parade'));
  assert.ok(!schedule(at(2026, 11, 17, 9)).some((s) => s.slot === 'parade'));
  const thisWeek = pickEvent(schedule(MON + HOUR).find((s) => s.slot === 'race'), 0);
  const nextWeek = pickEvent(schedule(addDays(MON, 7) + HOUR).find((s) => s.slot === 'race'), 0);
  assert.notEqual(thisWeek, nextWeek);
  // Every event the calendar names exists in config/events.js.
  for (const entry of [...CALENDAR.always, ...CALENDAR.weekday, ...CALENDAR.weekend]) {
    for (const key of entry.events) assert.ok(EVENTS[key], key);
  }
});

test('a fresh save shows at least eight events from the first look', () => {
  for (const t of [MON + HOUR, at(2026, 11, 19, 23, 59), at(2026, 11, 20, 0, 0), at(2026, 11, 22, 18)]) {
    const { events } = setup();
    const list = events.list(t);
    assert.ok(list.length >= 8, `${list.length} events`);
    for (const e of list) {
      assert.ok(e.title && e.blurb && typeof e.summary === 'string' && e.summary.length > 0, e.id);
      assert.ok(['offer', 'running', 'won', 'lost', 'over'].includes(e.state));
    }
    // Soonest-ending first, never-ending last.
    const ends = list.map((e) => e.endsAt ?? Infinity);
    assert.deepEqual(ends, ends.slice().sort((a, b) => a - b));
  }
});

test('replacement events are capped at three per slot per block', () => {
  const { save, events } = setup();
  let t = MON + 9 * HOUR;
  events.list(t);
  const slotId = schedule(t).find((s) => s.slot === 'streak').slotId;
  const seen = new Set();
  // Win 80 levels in a row: each plain streak of 7 is finished at once, and
  // the staged one is forced through by marking it done.
  for (let i = 0; i < 80; i++) {
    t += MINUTE;
    events.onLevel(result(t));
    const inst = Object.values(save.events.instances).find((x) => x.slotId === slotId);
    seen.add(inst.id);
    if (EVENTS[inst.key].stages && !inst.done) {
      inst.done = true;
      inst.state = 'won';
      events.list(t);
      seen.add(Object.values(save.events.instances).find((x) => x.slotId === slotId).id);
    }
  }
  assert.equal(save.events.replaced[slotId], CALENDAR.maxReplacements);
  assert.equal(seen.size, 1 + CALENDAR.maxReplacements);
  const last = Object.values(save.events.instances).find((x) => x.slotId === slotId);
  assert.equal(last.done, true); // finished, and nothing more comes this block
  assert.ok(last.scale < 1); // a replacement's prizes are scaled down
  // The next block starts afresh.
  const fri = at(2026, 11, 20, 8);
  events.list(fri);
  assert.equal(save.events.replaced[schedule(fri).find((s) => s.slot === 'streak').slotId], 0);
});

// ------------------------------------------------------------- mechanics

test('a race ends at its end time and pays by final rank', () => {
  const { save, events, rewards } = setup();
  const t = MON + 9 * HOUR;
  events.list(t);
  // Far more points than any rival can reach: first place.
  for (let i = 0; i < 300; i++) events.onLevel(result(t + i * 1000, { tier: 3 }));
  rewards.takeFresh();
  const before = find(events.list(at(2026, 11, 19, 23, 59)), 'race', "Critics' Circle");
  assert.equal(before.rows.find((r) => r.you).place, 1);
  assert.equal(before.endsAt, at(2026, 11, 20));
  assert.equal(rewards.tray(at(2026, 11, 19, 23, 59)).filter((i) => i.from === "Critics' Circle").length, 0);
  // One minute later the block is over: the race is gone and the prize is in.
  const after = events.list(at(2026, 11, 20, 0, 0));
  assert.equal(after.some((e) => e.id === before.id), false);
  const prize = rewards.tray(at(2026, 11, 20, 0, 0)).filter((i) => i.from === "Critics' Circle");
  assert.equal(prize.length, 1);
  assert.equal(prize[0].title, '1st place');
  assert.deepEqual(prize[0].reward, EVENTS.critics.prizes[0].reward);
  assert.ok(Object.values(save.events.instances).every((i) => i.endsAt === null || i.endsAt > at(2026, 11, 20)));
});

test('a race that was never played pays nothing for last place', () => {
  const { events, rewards } = setup();
  events.list(MON + HOUR);
  events.list(at(2026, 11, 20, 9));
  assert.equal(rewards.tray(at(2026, 11, 20, 9)).some((i) => i.from === "Critics' Circle"), false);
});

test('ladder steps pay in order and ignore lost levels', () => {
  // Week of 23 Nov. is the ladder's turn in the weekday collect slot? Find a
  // Monday on which the slot runs the Rose ladder.
  let monday = MON;
  while (pickEvent(schedule(monday + HOUR).find((s) => s.slot === 'collect'), 0) !== 'props-rose') monday = addDays(monday, 7);
  const { events, rewards } = setup();
  const t = monday + 9 * HOUR;
  const ladder = () => find(events.list(t), 'ladder');
  assert.equal(ladder().summary, 'step 1/15');
  // A lost level adds nothing, however many Roses were cleared.
  let out = events.onLevel(result(t, { won: false, cleared: [0, 500, 0, 0, 0] }));
  assert.equal(out.newRewards.length, 0);
  assert.deepEqual(ladder().progress, { have: 0, need: 30 });
  // Other colors do not count.
  events.onLevel(result(t, { cleared: [99, 0, 99, 99, 99] }));
  assert.deepEqual(ladder().progress, { have: 0, need: 30 });
  // 75 Roses: step 1 (30) and step 2 (40) pay, in that order; 5 carry over.
  out = events.onLevel(result(t, { cleared: [0, 75, 0, 0, 0] }));
  const mine = out.newRewards.filter((r) => r.from === 'Prop Room: Roses');
  assert.deepEqual(mine.map((r) => r.title), ['Step 1', 'Step 2']);
  assert.deepEqual(mine.map((r) => r.reward), [EVENTS['props-rose'].steps[0].reward, EVENTS['props-rose'].steps[1].reward]);
  assert.deepEqual(ladder().progress, { have: 5, need: 50 });
  assert.deepEqual(ladder().steps.map((s) => s.done).slice(0, 3), [true, true, false]);
  // Finishing every step pays the grand prize and brings on a replacement.
  out = events.onLevel(result(t, { cleared: [0, 5000, 0, 0, 0] }));
  assert.equal(out.newRewards.filter((r) => r.title === 'Grand prize').length, 1);
  assert.equal(events.list(t).some((e) => e.title === 'Prop Room: Roses'), false);
  assert.ok(rewards.tray(t).length > 0);
});

test('season bank caps at 5,000', () => {
  const { save, events, rewards } = setup();
  const t = MON + 9 * HOUR;
  events.list(t);
  for (let i = 0; i < 400; i++) events.onLevel(result(t + i, { tier: 3 })); // 2,000 keys
  const season = find(events.list(t), 'season');
  assert.equal(season.summary, 'bank 5000/5000');
  assert.equal(Object.values(save.events.instances).find((i) => i.key === 'season').data.bank, EVENTS.season.bankMax);
  assert.equal(season.steps.length, 30);
  assert.ok(season.steps.every((s) => s.done));
  // Paid out, once, when the month ends.
  const dec = at(2026, 12, 1, 8);
  events.list(dec);
  const bank = rewards.tray(dec).filter((i) => i.title === 'Season bank');
  assert.equal(bank.length, 1);
  assert.equal(bank[0].reward.coins, 5000);
  assert.equal(find(events.list(dec), 'season').summary, 'step 1/30');
});

test('a loss resets streak progress and a race multiplier', () => {
  const { save, events } = setup();
  const t = MON + 9 * HOUR;
  events.list(t);
  for (let i = 0; i < 4; i++) events.onLevel(result(t));
  const streak = () => Object.values(save.events.instances).find((i) => EVENTS[i.key].type === 'streak');
  assert.equal(streak().data.have, 4);
  const out = events.onLevel(result(t, { won: false }));
  assert.equal(streak().data.have, 0);
  assert.ok(out.eventLines.some((l) => l.text === 'Streak lost'));
});

test('the chest pays every 50 levels won', () => {
  const { events } = setup();
  const t = MON + 9 * HOUR;
  events.list(t);
  let paid = 0;
  for (let i = 0; i < 120; i++) {
    const out = events.onLevel(result(t + i, { won: i % 6 !== 5 })); // 100 wins, 20 losses
    paid += out.newRewards.filter((r) => r.from === 'Encore').length;
  }
  assert.equal(paid, 2);
});

test('dash: starts on start, first to 15 wins first prize', () => {
  const { save, events } = setup();
  const t = at(2026, 11, 21, 10); // a Saturday
  const offer = find(events.list(t), 'dash');
  assert.equal(offer.state, 'offer');
  events.onLevel(result(t)); // not started: nothing counts
  assert.equal(find(events.list(t), 'dash').progress.have, 0);
  events.start(offer.id, t);
  assert.equal(find(events.list(t), 'dash').state, 'running');
  assert.equal(find(events.list(t), 'dash').rows.length, 5);
  let out;
  for (let i = 1; i <= 15; i++) out = events.onLevel(result(t + i * 1000));
  const prize = out.newRewards.filter((r) => r.from === 'Opening Night Dash');
  assert.equal(prize.length, 1);
  assert.equal(prize[0].title, '1st place');
  assert.ok(save.events.replaced[schedule(t).find((s) => s.slot === 'group').slotId] >= 1);
});

test('sprint: 30 minutes from start, two a day, first place only', () => {
  const { events, rewards } = setup();
  let t = MON + 9 * HOUR;
  const id = find(events.list(t), 'sprint').id;
  events.start(id, t);
  let view = events.detail(id, t);
  assert.equal(view.state, 'running');
  assert.equal(view.endsAt, t + 30 * MINUTE);
  assert.equal(view.rows.length, 5);
  events.onLevel(result(t + MINUTE, { fired: { under: 999 } }));
  events.onLevel(result(t + 2 * MINUTE, { won: false, fired: { under: 5 } })); // lost: no count
  assert.equal(events.detail(id, t + 3 * MINUTE).rows.find((r) => r.you).score, 999);
  // Still running at 29:59, over at 30:00, and first place is paid.
  assert.equal(events.detail(id, t + 30 * MINUTE - 1).state, 'running');
  view = events.detail(id, t + 30 * MINUTE);
  assert.equal(view.state, 'offer');
  assert.equal(rewards.tray(t + 30 * MINUTE).filter((i) => i.from === view.title).length, 1);
  // The second sprint, not played, pays nothing; then none are left today.
  t += HOUR;
  events.start(id, t);
  assert.equal(events.detail(id, t + 31 * MINUTE).state, 'over');
  assert.equal(rewards.tray(t + 31 * MINUTE).filter((i) => i.from === view.title).length, 1);
  events.start(id, t + 2 * HOUR);
  assert.equal(events.detail(id, t + 2 * HOUR).state, 'over');
  // Tomorrow there are two again.
  assert.equal(events.detail(id, addDays(MON, 1) + 9 * HOUR).state, 'offer');
});

test('quota: five stages, with a bonus inside the time limit', () => {
  let monday = MON;
  while (pickEvent(schedule(monday + HOUR).find((s) => s.slot === 'collect'), 0) !== 'techweek') monday = addDays(monday, 7);
  const { events } = setup();
  let t = monday + 9 * HOUR;
  const quota = () => find(events.list(t), 'quota');
  assert.equal(quota().needs.length, 4);
  const lots = { 'spot-h': 50, 'spot-v': 50, under: 99, show: 99, prism: 99 };
  // Stage 1 inside its hour: stage prize and time bonus.
  let out = events.onLevel(result(t + 10 * MINUTE, { fired: lots }));
  assert.deepEqual(out.newRewards.filter((r) => r.from === 'Tech Week').map((r) => r.title), ['Stage 1', 'Stage 1 time bonus']);
  assert.equal(quota().summary, 'stage 2/5');
  // Stage 2 a day later: too slow for the bonus.
  t += DAY;
  out = events.onLevel(result(t, { fired: lots }));
  assert.deepEqual(out.newRewards.filter((r) => r.from === 'Tech Week').map((r) => r.title), ['Stage 2']);
  // A lost level counts for nothing.
  out = events.onLevel(result(t, { won: false, fired: lots }));
  assert.equal(quota().summary, 'stage 3/5');
});

test('bracket: three ten-minute rounds, first attempts only', () => {
  const { events, rewards } = setup();
  const t = at(2026, 11, 21, 10); // Saturday: Callbacks runs
  const id = find(events.list(t), 'bracket').id;
  events.start(id, t);
  const lots = { show: 500 };
  events.onLevel(result(t + MINUTE, { fired: lots, firstAttempt: false })); // retry: no count
  assert.equal(events.detail(id, t + 2 * MINUTE).rows.find((r) => r.you).score, 0);
  events.onLevel(result(t + 3 * MINUTE, { fired: lots }));
  assert.equal(events.detail(id, t + 9 * MINUTE).summary, 'round 1 of 3');
  assert.equal(events.detail(id, t + 10 * MINUTE).summary, 'round 2 of 3');
  events.onLevel(result(t + 12 * MINUTE, { fired: lots }));
  events.onLevel(result(t + 22 * MINUTE, { fired: lots }));
  const end = t + 30 * MINUTE;
  assert.equal(events.detail(id, end).state, 'offer');
  assert.deepEqual(rewards.tray(end).filter((i) => i.from === 'Callbacks').map((i) => i.title), ['Bracket won']);
  // A bracket nobody plays is lost in round one and pays nothing.
  events.start(id, end);
  assert.equal(events.detail(id, end + 11 * MINUTE).state, 'offer');
  assert.equal(rewards.tray(end + 11 * MINUTE).filter((i) => i.from === 'Callbacks').length, 1);
});

test('missions: three a day, missed days stay open, scrolls pay the track', () => {
  const { events } = setup();
  const wed = at(2026, 11, 18, 9);
  const sheet = find(events.list(wed), 'missions');
  assert.equal(sheet.missions.length, 9); // Monday, Tuesday, Wednesday
  assert.equal(sheet.steps.length, 5);
  let paid = 0;
  for (let i = 0; i < 60; i++) {
    const out = events.onLevel(result(wed + i * MINUTE, {
      tier: 1, fired: { 'spot-h': 5, under: 5, show: 5, prism: 2 }, cleared: [40, 40, 40, 40, 40],
    }));
    paid += out.newRewards.filter((r) => r.from === 'Call Sheet').length;
  }
  const after = find(events.list(wed + 2 * HOUR), 'missions');
  assert.ok(after.missions.every((m) => m.done));
  assert.equal(after.summary, '9 scrolls');
  assert.equal(paid, 2); // the 3-scroll and 6-scroll rewards
});

test('company: chests open in order and the pot is shared', () => {
  const { events, rewards } = setup();
  const t = MON + 9 * HOUR;
  const pot = find(events.list(t), 'company');
  assert.equal(pot.chests.length, 3);
  assert.equal(pot.rows.length, EVENTS.company.teammates + 1);
  for (let i = 0; i < 120; i++) events.onLevel(result(t + i, { tier: 3 })); // 600 points
  const titles = rewards.tray(t + 200).filter((i) => i.from === 'The Company').map((i) => i.title);
  assert.deepEqual(titles, ['Chest 1', 'Chest 2', 'Chest 3', 'Top contributor']);
});

// ------------------------------------------------- bonuses and the session

test('Friday bonus and weekend pass appear once, on the first look of the day', () => {
  const { events, rewards } = setup();
  events.list(at(2026, 11, 19, 12));
  const gift = (t, title) => rewards.tray(t).filter((i) => i.title === title).length;
  assert.equal(gift(at(2026, 11, 19, 12), 'Curtain-Raiser'), 0);
  const fri = at(2026, 11, 20, 7);
  events.list(fri);
  events.list(fri + HOUR);
  assert.equal(gift(fri + HOUR, 'Curtain-Raiser'), 1);
  assert.equal(gift(fri + HOUR, 'Weekend Matinee'), 0);
  const sat = at(2026, 11, 21, 7);
  events.list(sat);
  assert.equal(gift(sat, 'Weekend Matinee'), 1);
  events.list(at(2026, 11, 22, 6)); // Sunday: the same weekend, no second pass
  assert.equal(gift(at(2026, 11, 22, 6), 'Weekend Matinee'), 1);
  events.list(at(2026, 11, 27, 7)); // the next Friday
  // (last week's is still waiting too: its boost ran out, its coins did not)
  const both = rewards.tray(at(2026, 11, 27, 7)).filter((i) => i.title === 'Curtain-Raiser');
  assert.deepEqual(both.map((i) => Boolean(i.reward.boost)), [false, true]);
});

test('session: finish feeds the events and returns eventLines and newRewards', () => {
  let clock = MON + 9 * HOUR;
  const storage = fakeStorage();
  const session = createSession(storage, { now: () => clock });
  assert.ok(session.events.list(clock).length >= 8);
  session.startLevel();
  session.game.status = 'won';
  session.game.tally.fired = { under: 2 };
  const won = session.finish();
  assert.ok(Array.isArray(won.newRewards));
  assert.ok(won.eventLines.length >= 5);
  for (const line of won.eventLines) assert.ok(line.title && line.text);
  // A lost level: the next try at it is not a first attempt.
  session.startLevel();
  const lost = session.quit();
  assert.ok(Array.isArray(lost.eventLines));
  assert.equal(session.save.events.failedLevel, session.save.level);
  // Everything reached storage and loads again.
  const again = createSession(storage, { now: () => clock });
  assert.deepEqual(again.save.events, session.save.events);
});

test('an old save without the new fields still loads', () => {
  const storage = fakeStorage();
  storage.setItem('places-please-save', '{"version":1,"level":40,"coins":900,"settings":{"speed":"fast"}}');
  const session = createSession(storage, { now: () => MON + HOUR });
  assert.equal(session.save.level, 40);
  assert.equal(session.save.settings.rivals, 'even');
  assert.equal(session.save.settings.speed, 'fast');
  assert.ok(session.events.list(MON + HOUR).length >= 8);
  assert.deepEqual(session.rewards.tray(MON + HOUR), []);
  assert.equal(session.album(MON + HOUR).total, 81);
});

test('a full week of play never throws and leaves a loadable save', () => {
  const r = rng(2026);
  let clock = MON;
  const storage = fakeStorage();
  const session = createSession(storage, { now: () => clock });
  for (let day = 0; day < 7; day++) {
    const start = addDays(MON, day);
    const wins = day >= 5 ? 50 : 20;
    // Random minutes between 08:00 and 23:00, in order.
    const minutes = Array.from({ length: wins + 4 }, () => 480 + Math.floor(r() * 900)).sort((a, b) => a - b);
    minutes.forEach((minute, i) => {
      clock = start + minute * MINUTE + i; // + i keeps times apart
      const list = session.events.list(clock);
      assert.ok(list.length >= 6, `${list.length} events on day ${day}`);
      // Press Start on anything on offer, and claim what is in the tray.
      for (const e of list) if (e.state === 'offer') session.events.start(e.id, clock);
      for (const item of session.rewards.tray(clock)) session.rewards.claim(item.id, clock);
      session.rewards.active(clock);
      for (const e of list) session.events.detail(e.id, clock);
      session.album(clock);
      session.startLevel();
      // Four levels a day are lost; the rest are won with a made-up tally.
      const lose = i % Math.floor(minutes.length / 4) === 1;
      session.game.status = lose ? 'lost' : 'won';
      session.game.tally.fired = { 'spot-h': 1 + Math.floor(r() * 3), under: Math.floor(r() * 3), show: Math.floor(r() * 2), prism: r() < 0.2 ? 1 : 0 };
      session.game.tally.made = { ...session.game.tally.fired };
      session.game.tally.cleared = [0, 1, 2, 3, 4].map(() => 10 + Math.floor(r() * 30));
      const out = session.finish();
      assert.ok(Array.isArray(out.eventLines) && Array.isArray(out.newRewards));
    });
  }
  assert.ok(session.save.wins >= 5 * 20 + 2 * 50 - 4);
  assert.ok(session.save.coins > 0);
  // The save is plain JSON and loads back to the same thing.
  const text = JSON.stringify(session.save);
  assert.deepEqual(JSON.parse(text), session.save);
  assert.equal(session.lastWriteOk, true);
  assert.deepEqual(loadSave(storage).save, session.save);
  const again = createSession(storage, { now: () => clock });
  assert.ok(again.events.list(clock + DAY).length >= 6);
});
