// Checks config/help.js against config/obstacles.js: every obstacle, floor,
// the sandbag and every collectible must have a rule sentence, and a sentence
// must mention the number of hits the rules ask for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as OB from '../config/obstacles.js';
import { RULES, HOW_TO_PLAY, ALL_KINDS, PRODUCT_OF, ruleFor, nameFor } from '../config/help.js';

const OBSTACLES = OB.OBSTACLES || {};
const OBSTACLES2 = OB.OBSTACLES2 || {};
const FLOORS = OB.FLOORS || {};

const hasSentence = (kind) => typeof ruleFor(kind) === 'string' && ruleFor(kind).trim().length > 10;

test('every batch-1 obstacle has a rule sentence', () => {
  const missing = Object.keys(OBSTACLES).filter((k) => !hasSentence(k));
  assert.deepEqual(missing, [], 'Add a sentence to RULES in config/help.js for: ' + missing.join(', '));
});

test('every batch-2 obstacle has a rule sentence', () => {
  const missing = Object.keys(OBSTACLES2).filter((k) => !hasSentence(k));
  assert.deepEqual(missing, [], 'Add a sentence to RULES in config/help.js for: ' + missing.join(', '));
});

test('every floor has a rule sentence', () => {
  const missing = Object.keys(FLOORS).filter((k) => !hasSentence(k));
  assert.deepEqual(missing, [], 'Add a sentence to RULES in config/help.js for: ' + missing.join(', '));
});

test('the sandbag has a rule sentence', () => {
  assert.ok(OB.DROPPER && hasSentence(OB.DROPPER.id));
});

test('everything a generator or jar hands out has a rule sentence and a name', () => {
  for (const product of Object.values(PRODUCT_OF)) {
    assert.ok(hasSentence(product), 'no sentence for ' + product);
    assert.notEqual(nameFor(product), product, 'no name for ' + product + ' in COLLECTIBLE_NAMES');
  }
});

test('a sentence mentions the number of hits when more than one is needed', () => {
  for (const [kind, o] of Object.entries({ ...OBSTACLES, ...OBSTACLES2 })) {
    // How many times in a row the same kind of hit is asked for, at most
    // (hatbox 2, trunk 3, ticket booth 3 matches...), and how many colours.
    let most = 0;
    let run = 0;
    (o.hits || []).forEach((h, i, hits) => {
      run = i > 0 && hits[i - 1] === h ? run + 1 : 1;
      most = Math.max(most, run);
    });
    for (const n of [most, o.colorList || 0, o.every || 0]) {
      if (n > 1) assert.ok(ruleFor(kind).includes(String(n)), `"${ruleFor(kind)}" should mention ${n} (${kind})`);
    }
  }
});

test('names come from config/obstacles.js', () => {
  assert.equal(nameFor('crate'), OBSTACLES.crate.name);
  assert.equal(nameFor(OB.DROPPER.id), OB.DROPPER.name);
});

test('no sentence is left over for a kind that no longer exists', () => {
  const extra = Object.keys(RULES).filter((k) => !ALL_KINDS.includes(k));
  assert.deepEqual(extra, []);
});

test('ruleFor gives an empty string for an unknown kind', () => {
  assert.equal(ruleFor('no-such-thing'), '');
  assert.equal(ruleFor('toString'), '');
});

test('how to play: every section has a title and lines; ten combinations', () => {
  assert.ok(HOW_TO_PLAY.length >= 4);
  for (const s of HOW_TO_PLAY) {
    assert.ok(s.title && Array.isArray(s.lines) && s.lines.length > 0);
    for (const line of s.lines) assert.equal(typeof line, 'string');
  }
  const combos = HOW_TO_PLAY.find((s) => /combin/i.test(s.title));
  assert.equal(combos.lines.length, 10);
});
