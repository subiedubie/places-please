// YOUR COMPANY: the team of computer castmates. 49 of them, made once from
// the save's seed, each with a name, an avatar, a level and a pace. They send
// you lives and cards when you ask, ask you for cards and lives in turn, and
// play in the team events (The Company, the Tournament, Team Battle).
// Everything they do is worked out from the seed and the clock, so it is the
// same whenever you look, and keeps happening while the app is closed.
// Tunable numbers are in config/team.js.
//
// Kept in the save as:
//   save.team = { name, seed, made, helps: { week, count }, avatar,
//                 asks: { lives: time asked, card: { ... } }, given: [request ids],
//                 lifeGifts: [times], }
import { TEAM } from '../config/team.js';
import { rivalNames } from './events/rivals.js';
import { hash, rng } from './events/util.js';
import { weekStart, dayStart, MINUTE, HOUR, DAY } from './events/calendar.js';

export function createTeam(getSave, config = TEAM) {
  function box(now) {
    const save = getSave();
    if (!save.team || typeof save.team !== 'object') {
      save.team = {
        name: config.name,
        seed: hash(save.events?.seed || 1, 'team'),
        made: now,
        avatar: config.avatars[0],
        helps: { week: weekStart(now), count: 0 },
        asks: {},
        given: [],
      };
    }
    const t = save.team;
    if (!t.helps || t.helps.week !== weekStart(now)) t.helps = { week: weekStart(now), count: 0 };
    if (!t.asks || typeof t.asks !== 'object') t.asks = {};
    if (!Array.isArray(t.given)) t.given = [];
    return t;
  }

  // The 49 castmates (rebuilt from the seed each time).
  function members(t) {
    const r = rng(hash(t.seed, 'members'));
    return rivalNames(t.seed, config.size).map((name, i) => ({
      id: i,
      name,
      avatar: config.avatars[Math.floor(r() * config.avatars.length)],
      level: Math.round(config.levels[0] + (config.levels[1] - config.levels[0]) * r() ** 1.6),
      // How keen they are to help: 0..1
      kind: 0.3 + 0.7 * r(),
    }));
  }

  // Requests from castmates for one day: [{ id, member, kind: 'card'|'life',
  //   card: [set, card], at, closesAt }]. Someone else fills most of them
  // (closesAt); you can fill one before then.
  function requestsOn(t, day) {
    const r = rng(hash(t.seed, 'asks', day));
    const people = members(t);
    const n = config.requestsPerDay[0] + Math.floor(r() * (config.requestsPerDay[1] - config.requestsPerDay[0] + 1));
    const out = [];
    for (let i = 0; i < n; i++) {
      const at = day + (config.hours[0] + r() * (config.hours[1] - config.hours[0])) * HOUR;
      const card = r() < config.cardShare;
      out.push({
        id: `${day}-${i}`,
        member: people[Math.floor(r() * people.length)],
        kind: card ? 'card' : 'life',
        pick: r(), // which card (chosen by the album from what can be asked)
        at,
        closesAt: at + (config.fillMinutes[0] + r() * (config.fillMinutes[1] - config.fillMinutes[0])) * MINUTE,
      });
    }
    return out;
  }

  const api = {
    config,
    // The team as the screens show it.
    view(now) {
      const t = box(now);
      return {
        name: t.name,
        avatar: t.avatar,
        helps: t.helps.count,
        members: members(t),
        size: config.size + 1,
      };
    },

    members(now) {
      return members(box(now));
    },

    setAvatar(name, now) {
      const t = box(now);
      if (config.avatars.includes(name)) t.avatar = name;
    },

    avatar(now) {
      return box(now).avatar;
    },

    // Open requests from castmates right now (yesterday's and today's that
    // nobody has filled yet), newest first.
    openRequests(now) {
      const t = box(now);
      const today = dayStart(now);
      const list = requestsOn(t, today - DAY).concat(requestsOn(t, today));
      return list.filter((q) => q.at <= now && now < q.closesAt && !t.given.includes(q.id)).sort((a, b) => b.at - a.at);
    },

    // You filled a castmate's request.
    helped(id, now) {
      const t = box(now);
      if (t.given.includes(id)) return false;
      t.given.push(id);
      if (t.given.length > 200) t.given.splice(0, t.given.length - 200);
      t.helps.count++;
      return true;
    },

    // ASKING FOR LIVES: once every `lifeAskHours`. Castmates send them over
    // the next while; returns the times they arrive.
    askLives(now) {
      const t = box(now);
      if (t.asks.lives && now - t.asks.lives < config.lifeAskHours * HOUR) return null;
      t.asks.lives = now;
      const r = rng(hash(t.seed, 'lives', now));
      const n = config.livesSent[0] + Math.floor(r() * (config.livesSent[1] - config.livesSent[0] + 1));
      const times = [];
      for (let i = 0; i < n; i++) times.push(now + (config.lifeMinutes[0] + r() * (config.lifeMinutes[1] - config.lifeMinutes[0])) * MINUTE);
      return times.sort((a, b) => a - b);
    },
    nextLifeAsk(now) {
      const t = box(now);
      return t.asks.lives ? t.asks.lives + config.lifeAskHours * HOUR : 0;
    },

    // A castmate's name, for "Maya sent you a card".
    pickName(seedPart, now) {
      const people = members(box(now));
      return people[hash(box(now).seed, seedPart) % people.length].name;
    },
  };
  return api;
}
