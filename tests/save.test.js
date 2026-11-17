import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION,
  defaultSave,
  loadSave,
  writeSave,
  exportText,
  importText,
  applyResult,
} from '../meta/save.js';
import { fakeStorage } from './helpers.js';

const KEY = 'places-please-save';
const BAD = 'places-please-save-bad';

test('defaults', () => {
  assert.equal(SAVE_VERSION, 1);
  assert.deepEqual(defaultSave(), {
    version: 1,
    level: 1,
    coins: 0,
    wins: 0,
    streak: 0,
    current: null,
    stats: { played: 0, won: 0 },
    lastExport: null,
    settings: { speed: 'normal' },
  });
});

test('empty storage gives defaults', () => {
  assert.deepEqual(loadSave(fakeStorage()), { save: defaultSave(), recovered: null });
});

test('text that is not JSON gives defaults and keeps the text', () => {
  const st = fakeStorage();
  st.setItem(KEY, '{{{');
  const { save, recovered } = loadSave(st);
  assert.deepEqual(save, defaultSave());
  assert.equal(recovered, '{{{');
  assert.equal(st.getItem(BAD), '{{{');
});

test('missing fields are filled from defaults', () => {
  const st = fakeStorage();
  st.setItem(KEY, '{"version":1,"coins":50}');
  const { save, recovered } = loadSave(st);
  assert.equal(recovered, null);
  assert.equal(save.level, 1);
  assert.equal(save.coins, 50);
  assert.deepEqual(save, { ...defaultSave(), coins: 50 });
});

test('a partly filled nested object is completed', () => {
  const st = fakeStorage();
  st.setItem(KEY, '{"version":1,"stats":{"played":7},"settings":{}}');
  const { save } = loadSave(st);
  assert.deepEqual(save.stats, { played: 7, won: 0 });
  assert.deepEqual(save.settings, { speed: 'normal' });
});

test('a newer version is unreadable: defaults, text kept', () => {
  const st = fakeStorage();
  st.setItem(KEY, '{"version":99}');
  const { save, recovered } = loadSave(st);
  assert.deepEqual(save, defaultSave());
  assert.equal(recovered, '{"version":99}');
  assert.equal(st.getItem(BAD), '{"version":99}');
});

test('wrong-shaped JSON (a list, a number, null) is unreadable', () => {
  for (const raw of ['[1,2]', '5', 'null', '"hi"']) {
    const st = fakeStorage();
    st.setItem(KEY, raw);
    const { save, recovered } = loadSave(st);
    assert.deepEqual(save, defaultSave());
    assert.equal(recovered, raw);
  }
});

test('a field of the wrong type falls back to its default', () => {
  const st = fakeStorage();
  st.setItem(KEY, '{"version":1,"coins":"lots","level":4}');
  const { save } = loadSave(st);
  assert.equal(save.coins, 0);
  assert.equal(save.level, 4);
});

test('write then load round-trips', () => {
  const st = fakeStorage();
  const save = { ...defaultSave(), level: 12, coins: 340, current: { any: 'thing' } };
  assert.equal(writeSave(st, save), true);
  assert.deepEqual(loadSave(st), { save, recovered: null });
});

test('export then import round-trips', () => {
  const save = { ...defaultSave(), level: 9, coins: 77, streak: 2, wins: 8 };
  assert.deepEqual(importText(exportText(save)), save);
});

test('importText rejects anything that is not a save', () => {
  for (const text of ['hello', '[]', '{}', '{"version":99}', 'null']) {
    assert.throws(() => importText(text), { message: 'not a save file' });
  }
});

test('applyResult: win', () => {
  const before = { ...defaultSave(), level: 3, coins: 10, wins: 2, streak: 2, current: { x: 1 } };
  const after = applyResult(before, { status: 'won' }, { coins: 55, lines: [] });
  assert.equal(after.level, 4);
  assert.equal(after.coins, 65);
  assert.equal(after.wins, 3);
  assert.equal(after.streak, 3);
  assert.equal(after.current, null);
  assert.deepEqual(after.stats, { played: 1, won: 1 });
});

test('applyResult: loss', () => {
  const before = { ...defaultSave(), level: 3, coins: 10, wins: 2, streak: 2, current: { x: 1 } };
  const after = applyResult(before, { status: 'lost' }, { coins: 0, lines: [] });
  assert.equal(after.level, 3);
  assert.equal(after.coins, 10);
  assert.equal(after.wins, 2);
  assert.equal(after.streak, 0);
  assert.equal(after.current, null);
  assert.deepEqual(after.stats, { played: 1, won: 0 });
});

test('writeSave reports false when storage throws (full)', () => {
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(writeSave(full, defaultSave()), false);
});

test('loadSave survives storage that throws', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {},
  };
  assert.deepEqual(loadSave(broken), { save: defaultSave(), recovered: null });
});
