// Little pictures that fly across the page: gems going up to the target count
// during a level, and gems flying into the side-game badges on Home.

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let inAir = 0;
const MAX_IN_AIR = 24;

// paint   (ctx, size) => draws the picture
// from    { x, y } on the page; to: the element to fly to
// Returns a promise that settles when it has landed (at once if nothing flies).
export function flyTo(paint, size, from, to, ms, delay) {
  if (still() || inAir >= MAX_IN_AIR || !to || typeof to.animate !== 'function') return Promise.resolve();
  const box = to.getBoundingClientRect();
  if (!box.width) return Promise.resolve();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;pointer-events:none;z-index:40;`
    + 'filter:drop-shadow(0 3px 4px rgba(20,30,60,.35));will-change:transform;opacity:0';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  paint(g, size);
  document.body.appendChild(c);
  inAir += 1;
  const x0 = from.x - size / 2;
  const y0 = from.y - size / 2;
  const x1 = box.left + box.width / 2 - size / 2;
  const y1 = box.top + box.height / 2 - size / 2;
  const side = (x1 > x0 ? -1 : 1) * Math.min(70, Math.hypot(x1 - x0, y1 - y0) * 0.22); // bows outward
  const frames = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const u = 1 - t;
    const mx = (x0 + x1) / 2 + side;
    const my = Math.min(y0, y1) + Math.abs(y1 - y0) * 0.45;
    const x = u * u * x0 + 2 * u * t * mx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * my + t * t * y1;
    const s = t < 0.25 ? 1 + t * 1.2 : 1.3 - (t - 0.25) * 0.93;
    frames.push({ transform: `translate(${x}px,${y}px) scale(${s}) rotate(${t * 220}deg)`, opacity: 1 });
  }
  const anim = c.animate(frames, { duration: ms, delay: delay || 0, easing: 'cubic-bezier(.35,0,.65,1)' });
  return anim.finished.catch(() => {}).then(() => {
    inAir -= 1;
    c.remove();
    to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220 });
  });
}
