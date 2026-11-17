// Tests for engine/matches.js (plan Task 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGroups, powerForShape } from '../engine/matches.js';
import { boardFrom } from './helpers.js';

// Shorthand: the single group on a board (fails if there is not exactly one).
function onlyGroup(rows) {
  const groups = findGroups(boardFrom(rows));
  assert.equal(groups.length, 1);
  return groups[0];
}

test('three in a row', () => {
  const g = onlyGroup(['0012', '1110', '0021']);
  assert.equal(g.shape, 'three');
  assert.equal(g.color, 1);
  assert.deepEqual(g.cells, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
});

test('three in a column', () => {
  const g = onlyGroup(['201', '210', '201', '012']);
  assert.equal(g.shape, 'three');
  assert.equal(g.color, 2);
  assert.equal(g.cells.length, 3);
});

test('four horizontal makes a vertical Spotlight', () => {
  const g = onlyGroup(['01201', '33332', '01201']);
  assert.equal(g.shape, 'line4h');
  assert.equal(g.cells.length, 4);
  assert.equal(powerForShape(g.shape), 'spot-v');
});

test('four vertical makes a horizontal Spotlight', () => {
  const g = onlyGroup(['301', '312', '301', '312', '120']);
  assert.equal(g.shape, 'line4v');
  assert.equal(g.cells.length, 4);
  assert.equal(powerForShape(g.shape), 'spot-h');
});

test('five in a line, and six in a line, are line5', () => {
  const five = onlyGroup(['0120120', '4444412', '0120120']);
  assert.equal(five.shape, 'line5');
  assert.equal(five.cells.length, 5);
  const six = onlyGroup(['0120120', '4444441', '0120120']);
  assert.equal(six.shape, 'line5');
  assert.equal(six.cells.length, 6);
  const fiveDown = onlyGroup(['40', '41', '40', '41', '40']);
  assert.equal(fiveDown.shape, 'line5');
});

test('2x2 is a square', () => {
  const g = onlyGroup(['0120', '1332', '0331', '1202']);
  assert.equal(g.shape, 'square');
  assert.equal(g.cells.length, 4);
  assert.equal(powerForShape(g.shape), 'under');
});

test('2x2 with one side extended into a three is one square group of 5', () => {
  const g = onlyGroup(['0120', '3331', '3302', '1021']);
  assert.equal(g.shape, 'square');
  assert.equal(g.cells.length, 5);
});

test('L shape is lt with 5 cells', () => {
  const g = onlyGroup(['2010', '2101', '2220', '0101']);
  assert.equal(g.shape, 'lt');
  assert.equal(g.cells.length, 5);
  assert.equal(powerForShape(g.shape), 'show');
});

test('T shape is lt with 5 cells', () => {
  const g = onlyGroup(['2220', '0201', '1210', '0101']);
  assert.equal(g.shape, 'lt');
  assert.equal(g.cells.length, 5);
});

test('line of five crossed by a three is one line5 group of 7 (Review Focus 1)', () => {
  // five 4s across row 1, crossed by three 4s down column 2
  const cross = onlyGroup(['0140120', '4444412', '0140120', '1201201']);
  assert.equal(cross.shape, 'line5');
  assert.equal(cross.cells.length, 7);
  assert.equal(powerForShape(cross.shape), 'prism');
  // every cell appears once
  const keys = new Set(cross.cells.map((c) => `${c.x},${c.y}`));
  assert.equal(keys.size, 7);
});

test('2x2 touching a line of four is one group; the line wins (Review Focus 1)', () => {
  const g = onlyGroup(['01201', '33332', '33201', '01012']);
  assert.equal(g.shape, 'line4h');
  assert.equal(g.cells.length, 6);
  assert.equal(powerForShape(g.shape), 'spot-v');
});

test('two separate matches of different colors are two groups', () => {
  const groups = findGroups(boardFrom(['00012', '12120', '21222']));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.color).sort(), [0, 2]);
});

test('each cell is in at most one group', () => {
  const groups = findGroups(boardFrom(['00011', '00111', '22201', '12012']));
  const all = groups.flatMap((g) => g.cells.map((c) => `${c.x},${c.y}`));
  assert.equal(new Set(all).size, all.length);
});

test('holes, empties and power-ups never join or bridge a group', () => {
  assert.deepEqual(findGroups(boardFrom(['11#11', '0H0.0', 'HHH22', '...01'])), []);
  // a power-up in the middle of a would-be three blocks it
  assert.deepEqual(findGroups(boardFrom(['1P1', '020', '101'])), []);
});

test('no matches gives an empty list', () => {
  assert.deepEqual(findGroups(boardFrom(['0120', '1201', '2012'])), []);
});

test('powerForShape table', () => {
  assert.equal(powerForShape('line5'), 'prism');
  assert.equal(powerForShape('lt'), 'show');
  assert.equal(powerForShape('line4h'), 'spot-v');
  assert.equal(powerForShape('line4v'), 'spot-h');
  assert.equal(powerForShape('square'), 'under');
  assert.equal(powerForShape('three'), null);
});
