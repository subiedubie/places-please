// Saved progress: one JSON object kept under one key. `storage` is anything
// with getItem/setItem (the browser's localStorage, or a fake in tests), and
// is always passed in, so this file runs the same in the browser and in Node.

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'places-please-save';
// Where unreadable save text is parked so it can still be exported.
export const BAD_KEY = 'places-please-save-bad';

// A brand-new player's save. Every field a save can have is listed here;
// loadSave fills in anything missing from this.
export function defaultSave() {
  return {
    version: SAVE_VERSION,
    level: 1, // the level the player is on
    coins: 0,
    wins: 0, // levels won in total
    streak: 0, // wins in a row
    current: null, // the level in progress (a serialized Game), or null
    stats: { played: 0, won: 0 },
    lastExport: null, // time of the last export (milliseconds), or null
    // speed: animation speed, 'normal' or 'fast'.
    // rivals: how fast computer rivals play, 'relaxed' | 'even' | 'tough'
    // (the pace tables are in config/rivals.js).
    settings: { speed: 'normal', rivals: 'even' },
    // Side games (meta/events/index.js explains each field).
    events: { seed: 0, instances: {}, replaced: {}, gifts: {}, failedLevel: 0 },
    // The rewards tray and the timed boosts running (meta/rewards.js).
    rewards: { nextId: 1, items: [], active: [] },
    // The monthly card album (meta/album.js).
    album: { month: '', seed: 0, opened: 0, owned: {}, setsPaid: [], grandPaid: false },
    // Your company of computer castmates (meta/team.js); made on first look.
    team: null,
    // Lives (meta/lives.js) and the log of every level played (meta/history.js).
    lives: null,
    history: [],
    logNow: null,
    // Boosters owned. spot/show/prism are chosen before a level; the other
    // four are used during one. Prices are in config/economy.js.
    inventory: { spot: 0, show: 0, prism: 0, drill: 0, stageleft: 0, trapdoor: 0, coinflip: 0 },
    // Save the Violinist (meta/rescue.js); null until the first episode.
    rescue: null,
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Is this parsed data something we can read as a save?
// An object with no version number is accepted as an old save; a version newer
// than this code knows is not (we cannot know what its fields mean).
function readable(data) {
  if (!isPlainObject(data)) return false;
  if (data.version === undefined) return true;
  return typeof data.version === 'number' && data.version <= SAVE_VERSION;
}

// Copy the fields we know from `data` over the defaults. A field that is
// missing or of the wrong type keeps its default. Fields whose default is
// null (current, lastExport) accept whatever was saved.
function fill(defaults, data) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const v = data[key];
    if (v === undefined) out[key] = d;
    else if (d === null) out[key] = v;
    else if (isPlainObject(d)) out[key] = isPlainObject(v) ? { ...fill(d, v), ...extra(d, v) } : d;
    else out[key] = typeof v === typeof d ? v : d;
  }
  return out;
}

// Keys inside a nested object (settings, stats) that the defaults do not
// list are kept, so a setting added by the screen code is not thrown away.
function extra(defaults, data) {
  const out = {};
  for (const key of Object.keys(data)) {
    if (!(key in defaults)) out[key] = data[key];
  }
  return out;
}

function normalize(data) {
  const save = fill(defaultSave(), data);
  save.version = SAVE_VERSION;
  return save;
}

// Read the save. Never throws: whatever is in storage, the game opens.
// Returns { save, recovered }. `recovered` is null normally; if the stored
// text could not be read it holds that text (also copied under BAD_KEY).
export function loadSave(storage) {
  let raw = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { save: defaultSave(), recovered: null };
  }
  if (raw === null || raw === undefined) return { save: defaultSave(), recovered: null };

  let data;
  let ok = true;
  try {
    data = JSON.parse(raw);
  } catch {
    ok = false;
  }
  if (!ok || !readable(data)) {
    try {
      storage.setItem(BAD_KEY, raw);
    } catch {
      // Storage full or blocked: the text is still returned in `recovered`.
    }
    return { save: defaultSave(), recovered: raw };
  }
  return { save: normalize(data), recovered: null };
}

// Write the save. Returns true if it was stored, false if storage refused
// (for example, it is full).
export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

// The text of a save file for the Export button.
export function exportText(save) {
  return JSON.stringify(save, null, 2);
}

// Turn the text of a save file back into a save. Stricter than loadSave:
// the text must be a save with a version number this code understands.
export function importText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a save file');
  }
  if (!isPlainObject(data) || typeof data.version !== 'number' || data.version > SAVE_VERSION) {
    throw new Error('not a save file');
  }
  return normalize(data);
}

// The save after a level ends. Returns a new object; the old one is untouched.
//   win:  next level, coins added, wins + 1, streak + 1
//   loss: streak back to 0 (level and coins unchanged)
//   both: no level in progress, played + 1
export function applyResult(save, game, settlement) {
  const won = game.status === 'won';
  return {
    ...save,
    level: won ? save.level + 1 : save.level,
    coins: won ? save.coins + settlement.coins : save.coins,
    wins: won ? save.wins + 1 : save.wins,
    streak: won ? save.streak + 1 : 0,
    current: null,
    stats: {
      ...save.stats,
      played: save.stats.played + 1,
      won: won ? save.stats.won + 1 : save.stats.won,
    },
  };
}
