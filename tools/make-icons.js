// Draws the app icons (a gold theatre mask on the midnight-plum background)
// and writes them as PNG files into icons/. No dependencies.
//
// Run:  node tools/make-icons.js
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Settings ----
const SIZES = [180, 192, 512];
const BACKGROUND = [0x1b, 0x14, 0x20]; // #1b1420
const GOLD = [0xe8, 0xb8, 0x4a];       // #e8b84a
const SAMPLES = 4;                     // 4x4 samples per pixel for smooth edges
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// ---- The mask shape ----
// u and v run from -1 (left / top edge) to +1 (right / bottom edge).
// The whole mask stays inside 0.6 of the half-width, well within the central
// circle that iOS and Android keep when they round or crop the icon.
function inEllipse(u, v, cx, cy, rx, ry) {
  const dx = (u - cx) / rx;
  const dy = (v - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function isGold(u, v) {
  // Face: an ellipse that narrows toward the chin.
  const taper = 1 - 0.24 * Math.max(0, v) / 0.58;
  if (!inEllipse(u, v, 0, 0, 0.47 * taper, 0.58)) return false;
  // Two eye holes.
  if (inEllipse(u, v, -0.19, -0.13, 0.115, 0.075)) return false;
  if (inEllipse(u, v, 0.19, -0.13, 0.115, 0.075)) return false;
  // Smile: a crescent (inside the lower circle, outside the upper one).
  if (inEllipse(u, v, 0, 0.10, 0.27, 0.27) && !inEllipse(u, v, 0, -0.03, 0.30, 0.30)) return false;
  return true;
}

// ---- PNG writing ----
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function makeIconPng(size) {
  const rowLength = 1 + size * 3; // one filter byte, then RGB per pixel
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const u = ((x + (sx + 0.5) / SAMPLES) / size) * 2 - 1;
          const v = ((y + (sy + 0.5) / SAMPLES) / size) * 2 - 1;
          if (isGold(u, v)) hits++;
        }
      }
      const t = hits / (SAMPLES * SAMPLES);
      const at = y * rowLength + 1 + x * 3;
      for (let c = 0; c < 3; c++) {
        raw[at + c] = Math.round(BACKGROUND[c] + (GOLD[c] - BACKGROUND[c]) * t);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;  // bits per channel
  header[9] = 2;  // colour type: RGB (no transparency, as iOS wants)
  header[10] = 0; // compression
  header[11] = 0; // filter
  header[12] = 0; // not interlaced
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  const png = makeIconPng(size);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`);
}
