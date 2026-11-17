// HELP: the rule cards and rule sheets.
//
//   showLevelIntro(level, session)  when a level starts, one card over the
//                                   board for every obstacle the player has
//                                   not met before ("Make 2 matches next to a
//                                   Hatbox to break it."), each with an OK button
//   openBoardHelp(game)             the "?" button on the Level screen: the
//                                   rule for every obstacle on the board now
//   openRules()                     "How to play": the full rules sheet
//   initHelp({ session })           connects the three buttons in index.html
//
// The SENTENCES are in config/help.js; change them there. This file only
// shows them. It builds its own cards and sheets, so index.html holds
// nothing but the buttons. The look is in ui/help.css.

import * as OB from '../config/obstacles.js';
import { theme } from '../config/theme.js';
import { ruleFor, nameFor, ALL_KINDS, PRODUCT_OF, HOW_TO_PLAY } from '../config/help.js';
import { drawTargetIcon } from './render.js';

const DROPPER_ID = (OB.DROPPER && OB.DROPPER.id) || 'sandbag';
const FLOORS = OB.FLOORS || {};
const OBSTACLES2 = OB.OBSTACLES2 || {};

// The setting that remembers which rule cards have been shown
// (save.settings.seenRules, a list of kinds).
const SEEN_KEY = 'seenRules';

// ---- Working out which kinds are where --------------------------------------

// Add a kind to the set, plus what it hands out (a Top Hat brings the Dove).
function addKind(set, kind) {
  if (typeof kind !== 'string' || !ruleFor(kind)) return;
  set.add(kind);
  if (PRODUCT_OF[kind]) set.add(PRODUCT_OF[kind]);
}

// Add a block and, for a padlock or curtain, the block it is holding.
function addBlock(set, b) {
  let cell = b;
  for (let depth = 0; cell && depth < 4; depth++) { // (4: a safe limit on nesting)
    if (cell.t === 'drop') addKind(set, DROPPER_ID);
    else if (cell.kind && cell.t !== 'power' && cell.t !== 'piece') addKind(set, cell.kind);
    cell = cell.inside;
  }
}

// Put kinds in the order the rules sheet uses.
function inOrder(set) {
  return ALL_KINDS.filter((kind) => set.has(kind));
}

// Every kind a level starts with: its obstacles, sandbags, floors and what
// its targets ask for.
export function kindsOnLevel(level) {
  const set = new Set();
  if (!level) return [];
  for (const b of level.blocks || []) addBlock(set, b);
  if ((level.drops || []).length > 0) addKind(set, DROPPER_ID);
  for (const f of level.floor || []) addKind(set, f && f.kind);
  for (const t of level.targets || []) if (t && typeof t.block === 'string') addKind(set, t.block);
  return inOrder(set);
}

// Every kind on the board right now, plus what the targets still ask for.
export function kindsOnBoard(game) {
  const set = new Set();
  if (!game) return [];
  const board = game.board || {};
  for (const cell of board.cells || []) {
    if (cell && (cell.t === 'block' || cell.t === 'drop')) addBlock(set, cell);
  }
  for (const f of board.floor || []) addKind(set, f);
  for (const t of game.targets || []) if (t && typeof t.block === 'string') addKind(set, t.block);
  return inOrder(set);
}

// Every kind the levels can use: batch 1, the sandbag, and the batch-2 kinds
// that config/obstacles.js lists as ready (BATCH2_READY). If that list is
// not there at all, everything is shown.
function kindsInGame() {
  const ready = Array.isArray(OB.BATCH2_READY) ? new Set(OB.BATCH2_READY) : null;
  return ALL_KINDS.filter((kind) => {
    if (!ready) return true;
    const isBatch2 = Object.hasOwn(OBSTACLES2, kind) || Object.hasOwn(FLOORS, kind);
    if (isBatch2) return ready.has(kind);
    // A Dove is in the game only when the Top Hat is, and so on.
    const maker = Object.keys(PRODUCT_OF).find((k) => PRODUCT_OF[k] === kind);
    return maker ? ready.has(maker) : true;
  });
}

// ---- Small building blocks ---------------------------------------------------

// Make an element: el('div', 'class names', 'text').
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// A small sharp picture of an obstacle, `size` pixels square.
function kindIcon(kind, size) {
  const dpr = window.devicePixelRatio || 1;
  const c = el('canvas', 'help-icon');
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', nameFor(kind));
  try {
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTargetIcon(ctx, { block: kind }, size, theme);
  } catch (err) {
    console.error(err); // a missing drawing must never stop the rule from showing
  }
  return c;
}

// One row of a sheet: picture, name, sentence.
function ruleRow(kind) {
  const row = el('div', 'help-row');
  row.appendChild(kindIcon(kind, 44));
  const words = el('div', 'help-words');
  words.appendChild(el('div', 'help-name', nameFor(kind)));
  words.appendChild(el('div', 'help-rule', ruleFor(kind)));
  row.appendChild(words);
  return row;
}

// The dark layer everything in this file is shown on. Made once, reused.
let layer = null;
function getLayer() {
  if (!layer) {
    layer = el('div', 'overlay help-overlay');
    layer.hidden = true;
    (document.getElementById('app') || document.body).appendChild(layer);
  }
  return layer;
}
function closeLayer() {
  if (!layer) return;
  layer.hidden = true;
  layer.textContent = '';
}

// ---- The "new obstacle" cards -----------------------------------------------

function seenList(session) {
  const s = session && session.save && session.save.settings;
  return s && Array.isArray(s[SEEN_KEY]) ? s[SEEN_KEY] : [];
}

// Show one card; the promise finishes when OK is tapped.
function showCard(kind, index, count) {
  return new Promise((done) => {
    const box = getLayer();
    box.textContent = '';
    const card = el('div', 'dialog help-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.appendChild(el('div', 'label', count > 1 ? `New (${index + 1} of ${count})` : 'New'));
    card.appendChild(kindIcon(kind, 72));
    card.appendChild(el('div', 'help-card-name', nameFor(kind)));
    card.appendChild(el('p', 'help-card-rule', ruleFor(kind)));
    const ok = el('button', 'btn primary tall', 'OK');
    ok.onclick = () => done();
    card.appendChild(ok);
    box.appendChild(card);
    box.hidden = false;
  });
}

let introRunning = false; // so two calls never show cards on top of each other

// Call when a level starts. Shows a card for each kind on the level that the
// player has not seen a card for, one after another, and remembers them.
// Gives back a promise that finishes when the last card is closed.
export async function showLevelIntro(level, session) {
  if (introRunning || !level || !session) return;
  // The level as generated, plus the board as it stands (a resumed level).
  const here = new Set(kindsOnLevel(level));
  if (session.game && session.game.level === level) for (const k of kindsOnBoard(session.game)) here.add(k);
  const seen = seenList(session);
  const fresh = inOrder(here).filter((kind) => !seen.includes(kind));
  if (fresh.length === 0) return;
  introRunning = true;
  try {
    for (let i = 0; i < fresh.length; i++) {
      await showCard(fresh[i], i, fresh.length);
      // Remembered as soon as its OK is tapped (saved at once).
      const now = seenList(session);
      if (!now.includes(fresh[i])) session.setSetting(SEEN_KEY, now.concat(fresh[i]));
    }
  } finally {
    introRunning = false;
    closeLayer();
  }
}

// ---- The sheets --------------------------------------------------------------

// A tall white sheet with a title, a Close button and a body that scrolls.
function openSheet(title, fill) {
  if (introRunning) return;
  const box = getLayer();
  box.textContent = '';
  const sheet = el('div', 'help-sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const top = el('div', 'help-sheet-top');
  top.appendChild(el('h2', 'title small', title));
  const close = el('button', 'btn quiet', 'Close');
  close.onclick = closeLayer;
  top.appendChild(close);
  sheet.appendChild(top);
  const body = el('div', 'help-sheet-body');
  fill(body);
  sheet.appendChild(body);
  box.appendChild(sheet);
  box.hidden = false;
}

// The "?" button: the rules for what is on the board now.
export function openBoardHelp(game) {
  const kinds = kindsOnBoard(game);
  openSheet('On this board', (body) => {
    if (kinds.length === 0) {
      body.appendChild(el('p', 'note', 'No obstacles on this board. Collect the pieces shown at the top.'));
    }
    for (const kind of kinds) body.appendChild(ruleRow(kind));
    const all = el('button', 'btn help-more', 'How to play');
    all.onclick = () => openRules();
    body.appendChild(all);
  });
}

// "How to play": the how-to list, then every obstacle in the game.
export function openRules() {
  openSheet('How to play', (body) => {
    for (const section of HOW_TO_PLAY) {
      body.appendChild(el('div', 'label help-head', section.title));
      if (section.intro) body.appendChild(el('p', 'help-intro', section.intro));
      const list = el('ul', 'help-list');
      for (const line of section.lines) list.appendChild(el('li', '', line));
      body.appendChild(list);
    }
    body.appendChild(el('div', 'label help-head', 'Obstacles'));
    for (const kind of kindsInGame()) body.appendChild(ruleRow(kind));
  });
}

// Connect the buttons in index.html (each is skipped if it is not there).
//   level-help     the "?" on the Level screen
//   home-help      "How to play" on Home
//   settings-help  "How to play" in Settings
export function initHelp({ session }) {
  const on = (id, fn) => {
    const b = document.getElementById(id);
    if (b) b.onclick = fn;
  };
  on('level-help', () => { if (session.game) openBoardHelp(session.game); });
  on('home-help', openRules);
  on('settings-help', openRules);
}
