// The side games as a whole: keeps the right events running for the date,
// feeds each one the result of every finished level, ends them on time and
// builds what the screens show (the shapes are in docs/EVENTS.md).
// Each mechanic is one file in this folder; each event is one entry in
// config/events.js; what runs when is in config/calendar.js.
//
// Kept in the save as:
//   save.events = {
//     seed,                  // fixed once; every rival schedule comes from it
//     instances: { id: {     // the events running now
//       id, key, slotId, startsAt, endsAt, seed, pace, scale,
//       state,               // 'offer' | 'running' | 'won' | 'lost' | 'over'
//       done,                // true = finished early (may be replaced)
//       data } },            // the mechanic's own numbers
//     replaced: { slotId: n },  // replacements used by each slot this block
//     gifts: { friday, weekend },  // when the Friday / weekend gift was given
//     failedLevel,           // the level last lost (for "first attempt")
//   }
import { EVENTS, BONUSES } from '../../config/events.js';
import { DEFAULT_PACE, PACES } from '../../config/rivals.js';
import { schedule, pickEvent, prizeScale, blockAt, dayStart, weekday } from './calendar.js';
import { hash, scaleReward } from './util.js';
import race from './race.js';
import ladder from './ladder.js';
import season from './season.js';
import company from './company.js';
import chest from './chest.js';
import missions from './missions.js';
import streak from './streak.js';
import dash from './dash.js';
import sprint from './sprint.js';
import quota from './quota.js';
import bracket from './bracket.js';
import dig from './dig.js';
import firewalk from './firewalk.js';
import archery from './archery.js';
import pairs from './pairs.js';
import voyage from './voyage.js';
import parade from './parade.js';
import control from './control.js';
import pursuit from './pursuit.js';
import tournament from './tournament.js';
import circuit from './circuit.js';
import battle from './battle.js';

const MECHANICS = { race, ladder, season, company, chest, missions, streak, dash, sprint, quota, bracket, dig, firewalk, archery, pairs, voyage, parade, control, pursuit, tournament, circuit, battle };

// More mechanics can be added from outside (each mini-game file registers
// its own), so this file does not have to list every one.
export function addMechanic(type, m) { MECHANICS[type] = m; }

// getSave: a function returning the current save object.
// rewards: the tray (meta/rewards.js).
export function createEvents(getSave, rewards, events = EVENTS) {
  function box(now) {
    const save = getSave();
    if (!save.events || typeof save.events !== 'object') save.events = {};
    const ev = save.events;
    if (!ev.seed) ev.seed = hash('places-please', now) || 1;
    if (!ev.instances || typeof ev.instances !== 'object') ev.instances = {};
    if (!ev.replaced || typeof ev.replaced !== 'object') ev.replaced = {};
    if (!ev.gifts || typeof ev.gifts !== 'object') ev.gifts = {};
    // Running totals other events can watch (Mission Control): cards
    // collected, gems dug up, levels won, coins earned, event prizes won.
    if (!ev.counters || typeof ev.counters !== 'object') ev.counters = {};
    return ev;
  }

  // What a mechanic is handed: the time, and a way to pay into the tray.
  // pay(reward, title, scaled): coins are scaled for replacement events
  // unless `scaled` is false (used when the reward was scaled already).
  function ctxFor(inst, cfg, now) {
    return {
      now,
      pay(reward, title, scaled = true) {
        if (!reward) return;
        rewards.add(scaled ? scaleReward(reward, inst.scale) : reward, title, cfg.title, now);
        count('prizes', 1);
      },
      count,
      // Take coins from the player (the gold row). true if there were enough.
      spend(coins) {
        const s = getSave();
        if ((s.coins || 0) < coins) return false;
        s.coins -= coins;
        return true;
      },
      counters: () => box(now).counters,
      // The level last lost (a retry of it is not a first attempt).
      failedLevel: () => getSave().events?.failedLevel || 0,
      team: () => getSave().team || null,
    };
  }

  // Add to one of the running totals (see box()).
  function count(name, n = 1) {
    const c = getSave().events?.counters;
    if (c && n) c[name] = (c[name] || 0) + n;
  }

  // Start the event for a slot. n = 0 for the block's own event (it starts
  // at the block's start, so its rivals have been playing since then);
  // n > 0 for a replacement (starts now, rivals from zero, prizes scaled).
  function begin(ev, slot, n, now) {
    const key = pickEvent(slot, n);
    const cfg = key && events[key];
    if (!cfg || !MECHANICS[cfg.type]) return;
    const save = getSave();
    const id = `${key}@${slot.start}${n ? `#${n}` : ''}`;
    const inst = {
      id,
      key,
      slotId: slot.slotId,
      startsAt: n === 0 ? slot.start : now,
      endsAt: slot.end,
      seed: hash(ev.seed, id),
      pace: PACES[save.settings?.rivals] ? save.settings.rivals : DEFAULT_PACE,
      scale: n === 0 ? 1 : prizeScale(slot, now),
      state: 'running',
      done: false,
      data: {},
    };
    MECHANICS[cfg.type].begin(inst, cfg, ctxFor(inst, cfg, now));
    ev.instances[id] = inst;
  }

  // Bring everything up to date for time `now`: let events react to the
  // clock, end the ones whose time is up, start what the calendar asks for.
  function sync(now) {
    const ev = box(now);
    for (const inst of Object.values(ev.instances)) {
      const cfg = events[inst.key];
      const m = cfg && MECHANICS[cfg.type];
      if (!m) {
        delete ev.instances[inst.id]; // an event no longer in the config
        continue;
      }
      const ctx = ctxFor(inst, cfg, now);
      if (inst.endsAt !== null && now >= inst.endsAt) {
        // Settle at the end time, not at "now": the app may have been closed.
        const endCtx = { ...ctx, now: inst.endsAt };
        endCtx.pay = ctx.pay;
        if (m.tick) m.tick(inst, cfg, endCtx);
        if (m.end) m.end(inst, cfg, ctx);
        delete ev.instances[inst.id];
      } else if (m.tick) {
        m.tick(inst, cfg, ctx);
      }
    }
    const slots = schedule(now);
    const live = new Set(slots.map((s) => s.slotId));
    for (const id of Object.keys(ev.replaced)) if (!live.has(id)) delete ev.replaced[id];
    for (const slot of slots) {
      const current = Object.values(ev.instances).find((i) => i.slotId === slot.slotId);
      if (!current) {
        // Nothing yet this period (or the cap was reached and it ended).
        if (!(slot.slotId in ev.replaced)) {
          ev.replaced[slot.slotId] = 0;
          begin(ev, slot, 0, now);
        }
        continue;
      }
      // Finished early: bring on the next one, if the cap allows.
      if (current.done && slot.replace) {
        const n = (ev.replaced[slot.slotId] || 0) + 1;
        if (pickEvent(slot, n)) {
          delete ev.instances[current.id];
          ev.replaced[slot.slotId] = n;
          begin(ev, slot, n, now);
        }
      }
    }
    return ev;
  }

  // Friday bonus and weekend pass: put in the tray on the first look of
  // the day (Friday) or of the weekend (Saturday / Sunday).
  function gifts(ev, now) {
    const day = weekday(now);
    if (day === 4 && ev.gifts.friday !== dayStart(now)) {
      ev.gifts.friday = dayStart(now);
      rewards.add(BONUSES.friday.reward, BONUSES.friday.title, BONUSES.friday.title, now);
    }
    if (day >= 5 && ev.gifts.weekend !== blockAt(now).start) {
      ev.gifts.weekend = blockAt(now).start;
      rewards.add(BONUSES.weekend.reward, BONUSES.weekend.title, BONUSES.weekend.title, now);
    }
  }

  // One event as the screens show it. Every field is always present.
  function viewOf(inst, now) {
    const cfg = events[inst.key];
    return {
      id: inst.id,
      type: cfg.type,
      title: cfg.title,
      blurb: cfg.blurb,
      endsAt: inst.endsAt,
      state: inst.state,
      summary: '',
      progress: null,
      rows: null,
      steps: null,
      lanes: null,
      chests: null,
      total: null,
      prizes: null,
      missions: null, // missions only: [{ day, text, have, need, done }]
      needs: null, // quota only: [{ kind, have, need }]
      ...MECHANICS[cfg.type].view(inst, cfg, ctxFor(inst, cfg, now)),
    };
  }

  return {
    // Every event to show on Home, soonest-ending first.
    list(now) {
      const ev = sync(now);
      gifts(ev, now);
      return Object.values(ev.instances)
        .map((inst) => viewOf(inst, now))
        .sort((a, b) => (a.endsAt ?? Infinity) - (b.endsAt ?? Infinity));
    },

    // One event with its full rows; null if it is no longer running.
    detail(id, now) {
      const inst = sync(now).instances[id];
      return inst ? viewOf(inst, now) : null;
    },

    // Press Start on an event in state 'offer' (dash, sprint, bracket).
    start(id, now) {
      const inst = sync(now).instances[id];
      const cfg = inst && events[inst.key];
      const m = cfg && MECHANICS[cfg.type];
      if (m && m.start) m.start(inst, cfg, ctxFor(inst, cfg, now));
    },

    // Feed a finished level to every running event.
    //   result = { won, level, tier, tally, firstAttempt, movesLeft, now }
    // Returns { eventLines: [{ title, text }], newRewards: [RewardItem] }.
    onLevel(result) {
      const now = result.now;
      rewards.takeFresh(); // only rewards from this level are reported
      const ev = sync(now);
      const res = { ...result, tally: result.tally || { cleared: [], made: {}, fired: {} } };
      const eventLines = [];
      for (const inst of Object.values(ev.instances)) {
        const cfg = events[inst.key];
        const text = MECHANICS[cfg.type].onLevel(inst, cfg, res, ctxFor(inst, cfg, now));
        // (id lets Home find this event's badge to show the "+3" on it)
        if (text) eventLines.push({ id: inst.id, title: cfg.title, text });
      }
      // Remember a lost level, so the next try at it is not a first attempt.
      ev.failedLevel = result.won ? 0 : result.level;
      if (result.won) count('wins', 1);
      sync(now); // start replacements for anything just completed
      return { eventLines, newRewards: rewards.takeFresh() };
    },

    // A move made inside an event's own play screen (digging a block,
    // dropping a ball ...). Returns what the mechanic says happened, or null.
    act(id, action, now) {
      const inst = sync(now).instances[id];
      const cfg = inst && events[inst.key];
      const m = cfg && MECHANICS[cfg.type];
      if (!m || !m.act) return null;
      const out = m.act(inst, cfg, action, ctxFor(inst, cfg, now));
      sync(now); // a finished event makes room for the next one
      return out;
    },

    // Add to a running total from outside the events (cards, coins).
    count(name, n, now) {
      box(now);
      count(name, n);
    },

    // What the running side games count during a level, for the markers on
    // the board and the live counter: [{ id, title, color } | { id, title, powers }]
    watch(now) {
      const ev = sync(now);
      const out = [];
      for (const inst of Object.values(ev.instances)) {
        const cfg = events[inst.key];
        if (!cfg || inst.done || inst.state !== 'running') continue;
        if (cfg.type === 'ladder' && cfg.collect) {
          if (cfg.collect.color !== undefined) out.push({ id: inst.id, title: cfg.title, color: cfg.collect.color });
          else if (cfg.collect.made) out.push({ id: inst.id, title: cfg.title, powers: cfg.collect.made === 'spot' ? ['spot-h', 'spot-v'] : [cfg.collect.made], made: true });
        } else if (cfg.type === 'sprint' && cfg.power) {
          out.push({ id: inst.id, title: cfg.title, powers: cfg.power === 'spot' ? ['spot-h', 'spot-v'] : [cfg.power] });
        }
      }
      return out;
    },

    // Is the Season's gold row open now? (lives up to 8)
    passGold(now) {
      const ev = getSave().events;
      return Object.values(ev?.instances || {}).some((i) => events[i.key]?.type === 'season' && i.data && i.data.gold && (i.endsAt === null || now < i.endsAt));
    },

    // Was this the first attempt at level number `n`?
    firstAttempt(n) {
      return getSave().events?.failedLevel !== n;
    },
  };
}
