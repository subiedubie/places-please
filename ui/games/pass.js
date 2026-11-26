// THE SEASON: its own screen. A tall track of 30 steps: the free prize on
// the left, the step's key count in the middle, the gold row's prize on the
// right (locked until the gold row is bought with coins). Keys come from
// levels won; the current step glows and is scrolled into view.
import { rewardChips } from './kit.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const num = (n) => Number(n || 0).toLocaleString('en-US');

export function openPass(api) {
  const root = el('div', 'mg pass');
  root.style.setProperty('--mg-top', '#2a0f6e');
  root.style.setProperty('--mg-bottom', '#0e0430');
  (document.getElementById('app') || document.body).appendChild(root);
  const close = () => { root.remove(); api.changed(); };

  function draw(first) {
    const v = api.view();
    if (!v || !v.game) { close(); return; }
    const G = v.game;
    const old = root.querySelector('.pass-track');
    const scroll = old ? old.scrollTop : 0;
    root.textContent = '';
    const head = el('div', 'mg-head');
    const back = el('button', 'mg-back', 'Back');
    back.type = 'button';
    back.onclick = close;
    head.append(back, el('h2', 'mg-title marquee', v.title), el('div', 'pass-keys', `🔑 ${num(G.have)}`));
    root.appendChild(head);

    // The gold row: what it gives, and the button to open it.
    const gold = el('div', 'pass-gold' + (G.gold ? ' open' : ''));
    if (G.gold) {
      gold.append(el('div', 'pass-gold-title', '★ Gold row open ★'), el('div', 'pass-gold-perks', G.perks.join(' · ')));
    } else {
      gold.append(el('div', 'pass-gold-title', 'Open the gold row'));
      const ul = el('ul', 'pass-perks');
      for (const p of G.perks) ul.appendChild(el('li', '', p));
      gold.appendChild(ul);
      const buy = el('button', 'btn primary pass-buy', `Open for ${num(G.price)} coins`);
      buy.type = 'button';
      buy.onclick = () => {
        const r = api.act({ buyGold: true });
        if (r && r.ok) {
          draw(false);
          const g2 = root.querySelector('.pass-gold');
          if (g2) g2.classList.add('pop');
        } else buy.textContent = `You need ${num(G.price)} coins`;
      };
      gold.appendChild(buy);
    }
    root.appendChild(gold);

    // The track.
    const track = el('div', 'pass-track');
    const cols = el('div', 'pass-cols');
    cols.append(el('span', '', 'Free'), el('span', '', 'Keys'), el('span', 'g', 'Gold'));
    track.appendChild(cols);
    let current = null;
    (v.steps || []).forEach((s, i) => {
      const row = el('div', 'pass-row' + (s.done ? ' done' : '') + (s.current ? ' current' : ''));
      const free = el('div', 'pass-prize');
      free.appendChild(rewardChips(s.reward, 22));
      if (s.done) free.appendChild(el('span', 'pass-tick', '✓'));
      const mid = el('div', 'pass-node');
      mid.appendChild(el('span', 'pass-step', String(i + 1)));
      if (s.current) {
        const bar = el('div', 'pass-bar');
        const fill = el('span', 'pass-fill');
        fill.style.width = Math.min(100, (G.have / s.need) * 100).toFixed(0) + '%';
        bar.appendChild(fill);
        mid.append(bar, el('span', 'pass-need', `${num(G.have)}/${num(s.need)}`));
      } else mid.appendChild(el('span', 'pass-need', `🔑 ${num(s.need)}`));
      const gp = el('div', 'pass-prize gold' + (G.gold ? '' : ' locked') + ((i + 1) % 5 === 0 ? ' big' : ''));
      if (s.gold) gp.appendChild(rewardChips(s.gold, 22));
      if (!G.gold) gp.appendChild(el('span', 'pass-lock', '🔒'));
      else if (s.done) gp.appendChild(el('span', 'pass-tick', '✓'));
      row.append(free, mid, gp);
      track.appendChild(row);
      if (s.current) current = row;
    });
    const bank = el('div', 'pass-bank');
    bank.append(el('div', 'pass-gold-title', 'The takings'), el('p', '', `After step 30, every 10 keys bank 100 coins, up to ${num(G.bankMax)}. Banked: ${num(G.bank)}.`));
    track.appendChild(bank);
    root.appendChild(track);
    const foot = el('div', 'mg-foot');
    const play = el('button', 'btn primary', 'Play a level');
    play.type = 'button';
    play.onclick = () => { close(); api.play(); };
    foot.appendChild(play);
    root.appendChild(foot);
    if (first && current) setTimeout(() => current.scrollIntoView({ block: 'center' }), 30);
    else if (scroll) track.scrollTop = scroll;
  }

  draw(true);
  return { close };
}
