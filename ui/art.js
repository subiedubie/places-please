// THE RENDERED PICTURES (art/atlas.webp): loads them and draws one by name.
// Until they have loaded, or if one is missing, render.js draws its own
// simpler shapes instead.
import { FRAMES } from '../art/atlas.js';

let sheet = null;

export function loadArt() {
  return new Promise((done) => {
    if (typeof Image === 'undefined') { done(false); return; }
    const img = new Image();
    img.onload = () => { sheet = img; done(true); };
    img.onerror = () => done(false);
    img.src = new URL('../art/atlas.webp', import.meta.url).href;
  });
}

export const hasArt = (name) => Boolean(sheet && FRAMES[name]);

// Draw a picture centered at (cx, cy), w x h in size. False if there is none.
export function drawArt(ctx, name, cx, cy, w, h) {
  if (!hasArt(name)) return false;
  const [x, y, fw, fh] = FRAMES[name];
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, x, y, fw, fh, cx - w / 2, cy - h / 2, w, h);
  return true;
}
