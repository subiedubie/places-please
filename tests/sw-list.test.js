import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readSwList, scanShippedFiles } from '../tools/update-sw-list.js';

const HINT = 'Run "node tools/update-sw-list.js", then raise the version in CACHE in sw.js.';

test('every shipped file is in the service worker list', () => {
  const listed = new Set(readSwList());
  const missing = scanShippedFiles().filter((file) => !listed.has(file));
  assert.deepEqual(missing, [], `Not in sw.js: ${missing.join(', ')}. ${HINT}`);
});

test('every file in the service worker list exists', () => {
  const gone = readSwList().filter((file) => {
    if (file === './') return false;
    const path = join(ROOT, file);
    return !existsSync(path) || !statSync(path).isFile();
  });
  assert.deepEqual(gone, [], `Listed in sw.js but not on disk: ${gone.join(', ')}. ${HINT}`);
});

test('the list has no duplicates and includes the start address', () => {
  const listed = readSwList();
  assert.equal(new Set(listed).size, listed.length);
  assert.ok(listed.includes('./'));
});
