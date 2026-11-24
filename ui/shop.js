// THE BOX OFFICE on screen: a striped-awning stall with the free gift, today's
// deal and the shelves. Prices and rules: meta/market.js and config/shop.js.
import { drawArt, hasArt } from './art.js';

// The color of each shelf's cards, in the order of the shelves.
const SHELF_COLORS = [['#ffb52e', '#e06a00'], ['#5aa8ff', '#1450d0'], ['#c07bff', '#6a1ed0'], ['#3fd68a', '#067a42'], ['#ff7ab8', '#c01468']];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const num = (n) => Number(n || 0).toLocaleString('en-US');

// A sharp canvas with several pictures on it. Each one is
// [name, x, y, size, lean]: its middle and size out of 100, lean in degrees.
function collage(size, parts) {
  const c = document.createElement('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d');
  g.scale((size * dpr) / 100, (size * dpr) / 100);
  for (const [name, x, y, s, lean] of parts) {
    g.save();
    g.translate(x, y);
    g.rotate(((lean || 0) * Math.PI) / 180);
    drawArt(g, name, 0, 0, s, s);
    g.restore();
  }
  return c;
}

// A rendered picture from the atlas, or null if there is none by that name.
export function picture(name, size) {
  return hasArt(name) ? collage(size, [[name, 50, 50, 100]]) : null;
}

const ART = { spot: 'spot-h' }; // a booster whose picture has another name
const artOf = (kind) => ART[kind] || kind;

// The picture that stands for an item: one thing, or a heap of them.
function itemPicture(reward, size) {
  const kinds = Object.keys(reward.boosters || {}).map(artOf);
  if (kinds.length === 1) return picture(kinds[0], size) || el('span');
  if (kinds.length > 4) {
    return collage(size, [['coinflip', 18, 34, 36, -22], ['trapdoor', 82, 34, 36, 22], ['show', 36, 22, 38, -8],
      ['prism', 64, 22, 38, 8], ['chest-open', 50, 66, 70], ['drill', 18, 76, 36, -10], ['spot-h', 83, 76, 36, 10]]);
  }
  if (kinds.length > 1) {
    const fan = kinds.map((k, i) => {
      const t = (i / (kinds.length - 1)) * 2 - 1;
      return [k, 50 + t * 34, 28 + Math.abs(t) * 9, 42, t * 20];
    });
    return collage(size, [...fan, ['chest-open', 50, 70, 60]]);
  }
  if (reward.packs > 1) return collage(size, [['cardpack', 26, 54, 60, -16], ['cardpack', 74, 54, 60, 16], ['cardpack', 50, 48, 70]]);
  if (reward.packs) return picture('cardpack', size) || el('span');
  if (reward.boost) {
    const p = reward.boost.powers;
    const at = p.length === 1 ? [[50, 76]] : p.length === 2 ? [[26, 76], [74, 76]] : [[20, 72], [80, 72], [50, 80]];
    return collage(size, [['badge-stopwatch', 50, 38, 72], ...p.map((k, i) => [k, ...at[i % at.length], 42])]);
  }
  return picture('gift', size) || el('span');
}

// session, the event screens (for their sheet and reward chips), and what to
// do after something changed (Home is drawn again).
export function createShopUi({ session, eventUi, confirm, onChange }) {
  let note = '';
  let bought = ''; // the item that was just bought: its card jumps

  function priceButton(item, disabled) {
    const b = el('button', 'shop-buy');
    b.type = 'button';
    const coin = picture('coin', 22);
    if (coin) b.appendChild(coin);
    b.appendChild(el('span', '', num(item.price)));
    b.disabled = disabled;
    return b;
  }

  async function buy(item) {
    if (item.price >= 1000 && !(await confirm(`Buy ${item.title} for ${num(item.price)} coins?`, 'Buy', 'Cancel'))) return;
    const got = session.market.buy(item.id);
    bought = got ? item.id : '';
    if (!got) note = 'Not enough coins for that.';
    else if (got.cards && got.cards.length) note = 'You got: ' + got.cards.map((c) => c.name + (c.isNew ? ' (new)' : '')).join(', ');
    else note = `${item.title}: bought.`;
    onChange();
    eventUi.refreshSheet();
  }

  function stand(reward, size, owned) {
    const pic = el('div', 'shop-pic');
    pic.append(el('span', 'show-rays'), itemPicture(reward, size));
    if (owned !== null && owned !== undefined) pic.appendChild(el('span', 'shop-owned', 'have ' + owned));
    return pic;
  }

  function card(item, coins, wide) {
    const box = el('div', 'shop-item' + (wide ? ' wide' : '') + (bought === item.id ? ' bought' : ''));
    box.append(stand(item.reward, wide ? 104 : 74, item.owned));
    const side = el('div', 'shop-side');
    side.appendChild(el('div', 'shop-name', item.title));
    if (wide || item.reward.boost || item.reward.packs > 1) side.appendChild(eventUi.renderReward(item.reward, 20));
    const b = priceButton(item, coins < item.price);
    b.onclick = () => buy(item);
    side.appendChild(b);
    box.appendChild(side);
    return box;
  }

  function open() {
    note = '';
    bought = '';
    eventUi.openSheet({
      cls: 'shop-sheet',
      render(body) {
        const v = session.market.view();
        const front = el('div', 'shop-front');
        front.appendChild(el('div', 'shop-sign marquee', session.market.title));
        const purse = el('div', 'shop-purse');
        const pile = picture('coin-stack', 38) || picture('coin', 30);
        if (pile) purse.appendChild(pile);
        purse.appendChild(el('span', 'shop-coins', num(v.coins)));
        front.appendChild(purse);
        body.appendChild(front);
        if (note) body.appendChild(el('p', 'shop-note', note));

        const top = el('div', 'shop-top');
        const gift = el('div', 'shop-feature gift' + (v.gift.ready ? ' ready' : ''));
        const box = el('div', 'shop-pic');
        box.append(el('span', 'show-rays'), picture('gift', 92) || el('span'));
        gift.append(el('div', 'shop-tag', 'Free today'), box, eventUi.renderReward(v.gift.reward, 22));
        const take = el('button', 'shop-buy free', v.gift.ready ? 'Open' : 'Tomorrow');
        take.type = 'button';
        take.disabled = !v.gift.ready;
        take.onclick = () => {
          if (session.market.takeGift()) note = 'Free gift opened.';
          onChange();
          eventUi.refreshSheet();
        };
        gift.appendChild(take);
        const deal = el('div', 'shop-feature deal');
        deal.append(el('div', 'shop-tag', "Today's deal"), stand(v.deal.reward, 92));
        const off = Math.round((1 - v.deal.price / v.deal.was) * 100);
        if (v.deal.ready && off > 0) deal.appendChild(el('div', 'shop-burst', `${off}%
off`));
        const name = el('div', 'shop-name', v.deal.title + ' ');
        name.appendChild(el('s', '', num(v.deal.was)));
        deal.appendChild(name);
        const db = priceButton(v.deal, !v.deal.ready || v.coins < v.deal.price);
        if (!v.deal.ready) db.textContent = 'Sold out';
        db.onclick = () => buy(v.deal);
        deal.appendChild(db);
        top.append(gift, deal);
        body.appendChild(top);

        v.shelves.forEach((shelf, i) => {
          const wide = shelf.items.some((it) => Object.keys(it.reward.boosters || {}).length > 1);
          const sect = el('section', 'shop-section');
          const [c, d] = SHELF_COLORS[i % SHELF_COLORS.length];
          sect.style.setProperty('--c', c);
          sect.style.setProperty('--d', d);
          sect.appendChild(el('h3', 'shop-shelf', shelf.name));
          const n = shelf.items.length;
          const grid = el('div', 'shop-grid' + (wide ? ' one' : n === 4 || n === 2 ? ' two' : ''));
          for (const it of shelf.items) grid.appendChild(card(it, v.coins, wide));
          sect.appendChild(grid);
          body.appendChild(sect);
        });
        return session.market.title;
      },
    });
  }

  // The button on Home's coins card, with a dot while the free gift is waiting.
  function home() {
    const b = document.getElementById('home-shop');
    if (!b) return;
    b.textContent = '';
    const pic = picture('shop', 46) || picture('coin', 28);
    if (pic) b.appendChild(pic);
    b.appendChild(el('span', '', 'Shop'));
    if (session.market.view().gift.ready) b.appendChild(el('span', 'shop-dot'));
    b.onclick = open;
  }

  return { open, home };
}
