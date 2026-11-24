// Rewrites the FILES list in sw.js so it names every file the game ships.
// Run after adding, removing or renaming any game file:
//
//   node tools/update-sw-list.js
//
// Then raise the version in CACHE at the top of sw.js.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---- Settings ----
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SHIPPED_FILES = ['index.html', 'manifest.webmanifest'];
export const SHIPPED_FOLDERS = ['engine', 'levels', 'meta', 'ui', 'config', 'icons', 'art', 'vendor'];
export const START_MARKER = '// FILES-START';
export const END_MARKER = '// FILES-END';

function walk(root, folder, found) {
  for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
    const relative = `${folder}/${entry.name}`;
    if (entry.isDirectory()) walk(root, relative, found);
    else if (entry.isFile()) found.push(`./${relative}`);
  }
}

// Every shipped file as a sorted list of relative URLs ("./engine/rng.js"),
// plus "./" itself (the address the game is opened at).
export function scanShippedFiles(root = ROOT) {
  const found = ['./'];
  for (const file of SHIPPED_FILES) {
    if (existsSync(join(root, file))) found.push(`./${file}`);
  }
  for (const folder of SHIPPED_FOLDERS) {
    if (existsSync(join(root, folder))) walk(root, folder, found);
  }
  return found.sort();
}

function findMarkers(text) {
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`sw.js must contain "${START_MARKER}" and "${END_MARKER}"`);
  }
  return { start, end };
}

// The list currently written in sw.js, read from between the two markers.
export function readSwList(root = ROOT) {
  const text = readFileSync(join(root, 'sw.js'), 'utf8');
  const { start, end } = findMarkers(text);
  const block = text.slice(start + START_MARKER.length, end);
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

export function writeSwList(root = ROOT) {
  const path = join(root, 'sw.js');
  const text = readFileSync(path, 'utf8');
  const { start, end } = findMarkers(text);
  const files = scanShippedFiles(root);
  const lines = files.map((file) => `  '${file}',`).join('\n');
  const block = `${START_MARKER}\nconst FILES = [\n${lines}\n];\n`;
  writeFileSync(path, text.slice(0, start) + block + text.slice(end));
  return files;
}

// Only rewrite sw.js when this file is run directly, not when it is imported.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = writeSwList();
  console.log(`sw.js now lists ${files.length} entries.`);
  console.log('Remember to raise the version in CACHE at the top of sw.js.');
}
